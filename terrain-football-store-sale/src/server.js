import express from "express";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import session from "express-session";
import rateLimit from "express-rate-limit";
import Stripe from "stripe";
import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import multer from "multer";
import { config } from "./config.js";
import { sendPurchaseReceipt, sendShippedNotification } from "./mailer.js";
import { db } from "./db.js";
import { createUser, verifyCredentials, publicUser, requireAuth, requireAdmin, resetUserPassword } from "./auth.js";
import { registerSchema, loginSchema, productSchema, checkoutSchema } from "./validators.js";
import { listProducts, getProductById, getProductBySlug, createProduct, updateProduct } from "./products.js";
import "./seed.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const uploadDirectory = path.resolve(__dirname, "../public/uploads");
fs.mkdirSync(uploadDirectory, { recursive: true });
const imageUpload = multer({
  storage: multer.diskStorage({
    destination: uploadDirectory,
    filename: (_req, file, callback) => callback(null, `${crypto.randomUUID()}${path.extname(file.originalname).toLowerCase()}`)
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, callback) => callback(null, ["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.mimetype))
});
const stripe = config.stripeSecretKey.startsWith("sk_") ? new Stripe(config.stripeSecretKey) : null;

async function completePaidOrder(orderId, paymentIntent) {
  const tx = db.transaction(() => {
    const order = db.prepare("SELECT * FROM orders WHERE id=?").get(orderId);
    if (!order) return null;
    if (order.status !== "paid") {
      db.prepare(`UPDATE orders SET status='paid', stripe_payment_intent=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`)
        .run(String(paymentIntent || ""), orderId);
      const items = db.prepare("SELECT product_id, quantity FROM order_items WHERE order_id=?").all(orderId);
      for (const item of items) {
        if (item.product_id) {
          db.prepare("UPDATE products SET stock=MAX(0, stock-?), updated_at=CURRENT_TIMESTAMP WHERE id=?")
            .run(item.quantity, item.product_id);
        }
      }
    }
    return db.prepare("SELECT id,email,total_cents,receipt_sent_at FROM orders WHERE id=?").get(orderId);
  });
  const order = tx();
  if (!order) return null;
  const items = db.prepare("SELECT product_name,size,quantity,unit_price_cents FROM order_items WHERE order_id=?").all(orderId);
  if (!order.receipt_sent_at) {
    try {
      if (await sendPurchaseReceipt({ order, items })) {
        db.prepare("UPDATE orders SET receipt_sent_at=CURRENT_TIMESTAMP WHERE id=?").run(orderId);
      }
    } catch (error) {
      console.error("Receipt email error:", error.message);
    }
  }
  return { order, items };
}

app.set("trust proxy", 1);
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cookieParser());

// Stripe webhook must receive the raw body before express.json().
app.post("/api/payments/webhook", express.raw({ type: "application/json" }), async (req, res) => {
  if (!stripe || !config.stripeWebhookSecret) return res.status(503).send("Stripe webhook non configuré.");
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, req.headers["stripe-signature"], config.stripeWebhookSecret);
  } catch (err) {
    return res.status(400).send(`Webhook invalide: ${err.message}`);
  }
  if (event.type === "checkout.session.completed") {
    const checkout = event.data.object;
    const orderId = Number(checkout.metadata?.orderId);
    await completePaidOrder(orderId, checkout.payment_intent);
  }
  res.json({ received: true });
});

app.use(express.json({ limit: "1mb" }));
app.use(session({
  name: "terrain.sid",
  secret: config.sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: "lax", secure: config.nodeEnv === "production", maxAge: 1000 * 60 * 60 * 24 * 7 }
}));
app.use("/api/auth", rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false }));

function validate(schema, req, res) {
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Données invalides.", details: parsed.error.flatten() });
    return null;
  }
  return parsed.data;
}

app.get("/api/health", (_req, res) => {
  const row = db.prepare("SELECT 1 AS ok").get();
  res.json({ status: "ok", database: row.ok === 1, timestamp: new Date().toISOString() });
});

app.get("/api/config", (_req, res) => {
  res.json({ supportEmail: config.supportEmail });
});

app.get("/api/categories", (_req, res) => {
  res.json(db.prepare(`
    SELECT id,slug,name,description FROM categories
    WHERE is_active=1
    ORDER BY CASE slug
      WHEN 'maillots-actuels' THEN 1
      WHEN 'vintage-oversize' THEN 2
      WHEN 'editions-speciales' THEN 3
      ELSE 4
    END
  `).all());
});

app.get("/api/products", (req, res) => {
  const products = listProducts({
    category: typeof req.query.category === "string" ? req.query.category : undefined,
    search: typeof req.query.search === "string" ? req.query.search.slice(0, 80) : undefined,
    featured: req.query.featured === "true"
  });
  res.json(products);
});

app.get("/api/products/:slug", (req, res) => {
  const product = getProductBySlug(req.params.slug);
  if (!product) return res.status(404).json({ error: "Produit introuvable." });
  res.json(product);
});

app.post("/api/auth/register", (req, res) => {
  const data = validate(registerSchema, req, res);
  if (!data) return;
  try {
    const user = createUser(data);
    req.session.user = { id: user.id, email: user.email, role: user.role, first_name: user.first_name, last_name: user.last_name };
    res.status(201).json({ user: publicUser(req.session.user) });
  } catch (err) {
    if (String(err.message).includes("UNIQUE")) return res.status(409).json({ error: "Cette adresse e-mail est déjà utilisée." });
    throw err;
  }
});

app.post("/api/auth/login", (req, res) => {
  const data = validate(loginSchema, req, res);
  if (!data) return;
  const user = verifyCredentials(data.email, data.password);
  if (!user) return res.status(401).json({ error: "E-mail ou mot de passe incorrect." });
  req.session.regenerate((err) => {
    if (err) return res.status(500).json({ error: "Impossible d'ouvrir la session." });
    req.session.user = user;
    res.json({ user: publicUser(user) });
  });
});

app.post("/api/auth/logout", (req, res) => {
  req.session.destroy(() => {
    res.clearCookie("terrain.sid");
    res.json({ ok: true });
  });
});

app.get("/api/auth/me", (req, res) => {
  res.json({ user: publicUser(req.session.user) });
});

app.get("/api/account/orders", requireAuth, (req, res) => {
  const orders = db.prepare(`
    SELECT id,status,total_cents,created_at,updated_at FROM orders WHERE user_id=? ORDER BY created_at DESC
  `).all(req.session.user.id).map(o => ({
    id:o.id,status:o.status,totalCents:o.total_cents,createdAt:o.created_at,updatedAt:o.updated_at,
    items: db.prepare(`
      SELECT oi.product_name,oi.size,oi.quantity,oi.unit_price_cents,p.image_url
      FROM order_items oi LEFT JOIN products p ON p.id=oi.product_id
      WHERE oi.order_id=?
    `).all(o.id).map(item => ({ name:item.product_name, size:item.size, quantity:item.quantity,
      unitPriceCents:item.unit_price_cents, imageUrl:item.image_url || "" }))
  }));
  res.json(orders);
});

app.get("/api/admin/products", requireAdmin, (_req, res) => {
  const archived = _req.query.archived === "true";
  res.json(listProducts(archived ? { archivedOnly: true } : { activeOnly: true }));
});

app.get("/api/admin/categories", requireAdmin, (_req, res) => {
  res.json(db.prepare("SELECT id,slug,name,description,is_active FROM categories ORDER BY id").all()
    .map(category => ({ ...category, isActive: Boolean(category.is_active) })));
});

app.post("/api/admin/uploads", requireAdmin, (req, res) => {
  imageUpload.single("image")(req, res, error => {
    if (error) return res.status(400).json({ error: "Image invalide. Utilise JPG, PNG, WEBP ou GIF (5 Mo maximum)." });
    if (!req.file) return res.status(400).json({ error: "Sélectionne une image à téléverser." });
    res.status(201).json({ imageUrl: `/uploads/${req.file.filename}` });
  });
});

app.post("/api/admin/products", requireAdmin, (req, res) => {
  const data = validate(productSchema, req, res);
  if (!data) return;
  const category = db.prepare("SELECT id FROM categories WHERE id=? AND is_active=1").get(data.categoryId);
  if (!category) return res.status(400).json({ error: "Catégorie inconnue." });
  try { res.status(201).json(createProduct(data)); }
  catch (err) {
    if (String(err.message).includes("UNIQUE")) return res.status(409).json({ error: "Ce slug existe déjà." });
    throw err;
  }
});

app.post("/api/admin/categories", requireAdmin, (req, res) => {
  const name = typeof req.body.name === "string" ? req.body.name.trim() : "";
  const description = typeof req.body.description === "string" ? req.body.description.trim() : "";
  const slugInput = typeof req.body.slug === "string" ? req.body.slug.trim().toLowerCase() : "";
  const slug = slugInput || name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  if (name.length < 2 || name.length > 80 || !slug || slug.length > 80) {
    return res.status(400).json({ error: "Le nom doit contenir entre 2 et 80 caractères et produire un slug valide." });
  }
  try {
    const result = db.prepare("INSERT INTO categories (slug,name,description) VALUES (?,?,?)")
      .run(slug, name, description);
    res.status(201).json(db.prepare("SELECT id,slug,name,description FROM categories WHERE id=?").get(result.lastInsertRowid));
  } catch (err) {
    if (String(err.message).includes("UNIQUE")) return res.status(409).json({ error: "Cette catégorie existe déjà." });
    throw err;
  }
});

app.put("/api/admin/categories/:id", requireAdmin, (req, res) => {
  const categoryId = Number(req.params.id);
  const name = typeof req.body.name === "string" ? req.body.name.trim() : "";
  const description = typeof req.body.description === "string" ? req.body.description.trim() : "";
  const slug = typeof req.body.slug === "string" ? req.body.slug.trim().toLowerCase() : "";
  if (!Number.isInteger(categoryId) || name.length < 2 || name.length > 80 ||
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 80) {
    return res.status(400).json({ error: "Nom ou slug de catégorie invalide." });
  }
  try {
    const result = db.prepare("UPDATE categories SET slug=?,name=?,description=? WHERE id=?")
      .run(slug, name, description, categoryId);
    if (!result.changes) return res.status(404).json({ error: "Catégorie introuvable." });
    res.json(db.prepare("SELECT id,slug,name,description,is_active FROM categories WHERE id=?").get(categoryId));
  } catch (err) {
    if (String(err.message).includes("UNIQUE")) return res.status(409).json({ error: "Cette catégorie existe déjà." });
    throw err;
  }
});

app.delete("/api/admin/categories/:id", requireAdmin, (req, res) => {
  const categoryId = Number(req.params.id);
  const result = db.prepare("UPDATE categories SET is_active=0 WHERE id=?").run(categoryId);
  if (!result.changes) return res.status(404).json({ error: "Catégorie introuvable." });
  res.json({ ok: true, message: "Catégorie archivée." });
});

app.patch("/api/admin/categories/:id/restore", requireAdmin, (req, res) => {
  const result = db.prepare("UPDATE categories SET is_active=1 WHERE id=?").run(Number(req.params.id));
  if (!result.changes) return res.status(404).json({ error: "Catégorie introuvable." });
  res.json({ ok: true, message: "Catégorie désarchivée." });
});

app.delete("/api/admin/categories/:id/permanent", requireAdmin, (req, res) => {
  const categoryId = Number(req.params.id);
  const product = db.prepare("SELECT 1 FROM products WHERE category_id=? LIMIT 1").get(categoryId);
  if (product) return res.status(409).json({ error: "Impossible de supprimer cette catégorie : des produits y sont encore rattachés." });
  const result = db.prepare("DELETE FROM categories WHERE id=?").run(categoryId);
  if (!result.changes) return res.status(404).json({ error: "Catégorie introuvable." });
  res.json({ ok: true, message: "Catégorie supprimée définitivement." });
});

app.put("/api/admin/products/:id", requireAdmin, (req, res) => {
  const data = validate(productSchema, req, res);
  if (!data) return;
  const category = db.prepare("SELECT id FROM categories WHERE id=? AND is_active=1").get(data.categoryId);
  if (!category) return res.status(400).json({ error: "Catégorie inconnue ou archivée." });
  const product = updateProduct(Number(req.params.id), data);
  if (!product) return res.status(404).json({ error: "Produit introuvable." });
  res.json(product);
});

app.delete("/api/admin/products/:id", requireAdmin, (req, res) => {
  const result = db.prepare("UPDATE products SET is_active=0, updated_at=CURRENT_TIMESTAMP WHERE id=?").run(Number(req.params.id));
  if (!result.changes) return res.status(404).json({ error: "Produit introuvable." });
  res.json({ ok: true, message: "Produit archivé." });
});

app.patch("/api/admin/products/:id/restore", requireAdmin, (req, res) => {
  const result = db.prepare("UPDATE products SET is_active=1, updated_at=CURRENT_TIMESTAMP WHERE id=?").run(Number(req.params.id));
  if (!result.changes) return res.status(404).json({ error: "Produit introuvable." });
  res.json({ ok: true, message: "Produit désarchivé." });
});

app.delete("/api/admin/products/:id/permanent", requireAdmin, (req, res) => {
  const productId = Number(req.params.id);
  const deleteProduct = db.transaction(() => {
    const product = db.prepare("SELECT id,image_url FROM products WHERE id=?").get(productId);
    if (!product) return false;
    db.prepare("UPDATE order_items SET product_id=NULL WHERE product_id=?").run(productId);
    db.prepare("DELETE FROM products WHERE id=?").run(productId);
    if (typeof product.image_url === "string" && product.image_url.startsWith("/uploads/")) {
      const imagePath = path.resolve(uploadDirectory, path.basename(product.image_url));
      fs.rmSync(imagePath, { force: true });
    }
    return true;
  });
  if (!deleteProduct()) return res.status(404).json({ error: "Produit introuvable." });
  res.json({ ok: true, message: "Produit supprimé définitivement." });
});

app.get("/api/admin/users", requireAdmin, (_req, res) => {
  res.json(db.prepare(`
    SELECT id,email,first_name,last_name,role,is_banned,created_at
    FROM users ORDER BY created_at DESC
  `).all().map(user => ({
    id: user.id, email: user.email, firstName: user.first_name, lastName: user.last_name,
    role: user.role, isBanned: Boolean(user.is_banned), createdAt: user.created_at
  })));
});

app.patch("/api/admin/users/:id/ban", requireAdmin, (req, res) => {
  const userId = Number(req.params.id);
  if (!Number.isInteger(userId) || userId === req.session.user.id) {
    return res.status(400).json({ error: "Action impossible sur ce compte." });
  }
  const banned = req.body.banned === true;
  const result = db.prepare("UPDATE users SET is_banned=? WHERE id=?").run(banned ? 1 : 0, userId);
  if (!result.changes) return res.status(404).json({ error: "Utilisateur introuvable." });
  res.json({ ok: true, isBanned: banned });
});

app.post("/api/admin/users/:id/reset-password", requireAdmin, (req, res) => {
  const userId = Number(req.params.id);
  const password = typeof req.body.password === "string" ? req.body.password : "";
  if (!Number.isInteger(userId) || password.length < 10 || password.length > 100) {
    return res.status(400).json({ error: "Le nouveau mot de passe doit contenir entre 10 et 100 caractères." });
  }
  if (!db.prepare("SELECT id FROM users WHERE id=?").get(userId)) {
    return res.status(404).json({ error: "Utilisateur introuvable." });
  }
  resetUserPassword(userId, password);
  res.json({ ok: true });
});

app.get("/api/admin/orders", requireAdmin, (_req, res) => {
  res.json(db.prepare(`
    SELECT o.id,o.email,o.status,o.total_cents,o.created_at,u.first_name,u.last_name
    FROM orders o LEFT JOIN users u ON u.id=o.user_id ORDER BY o.created_at DESC LIMIT 200
  `).all());
});

app.patch("/api/admin/orders/:id/status", requireAdmin, async (req, res) => {
  const allowed = ["processing","shipped","cancelled","refunded"];
  if (!allowed.includes(req.body.status)) return res.status(400).json({ error: "Statut non autorisé." });
  const orderId = Number(req.params.id);
  const previousOrder = db.prepare("SELECT id,email,status,shipped_mail_sent_at FROM orders WHERE id=?").get(orderId);
  if (!previousOrder || !["paid", "processing", "shipped"].includes(previousOrder.status)) {
    return res.status(404).json({ error: "Commande introuvable ou statut incompatible." });
  }
  const result = db.prepare("UPDATE orders SET status=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status IN ('paid','processing','shipped')").run(req.body.status, orderId);
  if (!result.changes) return res.status(404).json({ error: "Commande introuvable ou statut incompatible." });
  let shippedMailSent = Boolean(previousOrder.shipped_mail_sent_at);
  if (req.body.status === "shipped" && previousOrder.status !== "shipped" && !shippedMailSent) {
    try {
      shippedMailSent = await sendShippedNotification({ order: { id: previousOrder.id, email: previousOrder.email } });
      if (shippedMailSent) {
        db.prepare("UPDATE orders SET shipped_mail_sent_at=CURRENT_TIMESTAMP WHERE id=?").run(orderId);
      }
    } catch (error) {
      console.error(`Shipping email error for order #${orderId}:`, error.message);
      return res.status(502).json({ ok: true, warning: "Statut mis à jour, mais le mail d'expédition n'a pas pu être envoyé." });
    }
  }
  res.json({ ok: true, shippedMailSent });
});

app.get("/api/checkout/confirmation", async (req, res) => {
  if (!stripe) return res.status(503).json({ error: "Stripe n'est pas configuré." });
  const sessionId = typeof req.query.session_id === "string" ? req.query.session_id : "";
  if (!sessionId.startsWith("cs_")) return res.status(400).json({ error: "Session Stripe invalide." });
  try {
    const checkout = await stripe.checkout.sessions.retrieve(sessionId);
    const orderId = Number(checkout.metadata?.orderId);
    if (checkout.payment_status !== "paid" || !orderId) {
      return res.status(409).json({ error: "Le paiement est encore en cours de confirmation." });
    }
    const result = await completePaidOrder(orderId, checkout.payment_intent);
    if (!result) return res.status(404).json({ error: "Commande introuvable." });
    res.json({
      orderId: result.order.id,
      email: result.order.email,
      totalCents: result.order.total_cents,
      items: result.items
    });
  } catch (error) {
    console.error("Stripe confirmation error:", error.message);
    res.status(502).json({ error: "Impossible de vérifier le paiement Stripe." });
  }
});

app.post("/api/checkout/session", async (req, res) => {
  if (!stripe) return res.status(503).json({ error: "Stripe n'est pas configuré. Ajoute une clé sk_test_ dans .env." });
  const data = validate(checkoutSchema, req, res);
  if (!data) return;
  const normalized = [];
  for (const item of data.items) {
    const product = getProductById(item.productId);
    if (!product || !product.isActive) return res.status(400).json({ error: `Produit indisponible (ID ${item.productId}).` });
    if (!product.sizes.includes(item.size)) return res.status(400).json({ error: `Taille ${item.size} indisponible pour ${product.name}.` });
    if (product.stock < item.quantity) return res.status(400).json({ error: `Stock insuffisant pour ${product.name}.` });
    normalized.push({ product, size: item.size, quantity: item.quantity });
  }
  const total = normalized.reduce((sum, item) => sum + item.product.priceCents * item.quantity, 0);
  const createOrder = db.transaction(() => {
    const result = db.prepare("INSERT INTO orders (user_id,email,total_cents) VALUES (?,?,?)")
      .run(req.session.user?.id || null, data.customerEmail, total);
    const orderId = Number(result.lastInsertRowid);
    const insert = db.prepare("INSERT INTO order_items (order_id,product_id,product_name,size,quantity,unit_price_cents) VALUES (?,?,?,?,?,?)");
    for (const item of normalized) insert.run(orderId,item.product.id,item.product.name,item.size,item.quantity,item.product.priceCents);
    return orderId;
  });

  const orderId = createOrder();
  try {
    const checkout = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card", "revolut_pay"],
      customer_email: data.customerEmail,
      invoice_creation: { enabled: true },
      payment_intent_data: { receipt_email: data.customerEmail },
      line_items: normalized.map(item => ({
        quantity: item.quantity,
        price_data: {
          currency: "eur",
          unit_amount: item.product.priceCents,
          product_data: { name: `${item.product.name} — taille ${item.size}`, images: item.product.imageUrl.startsWith("https://") ? [item.product.imageUrl] : [] }
        }
      })),
      success_url: `${config.publicBaseUrl}/?payment=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${config.publicBaseUrl}/?payment=cancelled`,
      metadata: { orderId: String(orderId) }
    });
    db.prepare("UPDATE orders SET stripe_session_id=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").run(checkout.id,orderId);
    res.status(201).json({ url: checkout.url, orderId });
  } catch (err) {
    db.prepare("UPDATE orders SET status='cancelled',updated_at=CURRENT_TIMESTAMP WHERE id=?").run(orderId);
    console.error("Stripe checkout error:", err.message);
    res.status(502).json({ error: "Stripe n'a pas pu créer le paiement. Vérifie la configuration test." });
  }
});

app.use(express.static(path.resolve(__dirname, "../public")));
app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api/")) return next();
  res.sendFile(path.resolve(__dirname, "../public/index.html"));
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "Erreur serveur inattendue." });
});

if (process.env.NODE_ENV !== "test") {
  app.listen(config.port, () => console.log(`Terrain Football Store : http://localhost:${config.port}`));
}
export default app;
