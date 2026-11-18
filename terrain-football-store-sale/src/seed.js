import bcrypt from "bcryptjs";
import { db } from "./db.js";
import { config } from "./config.js";

const categories = [
  ["maillots-actuels", "Maillots actuels", "Maillots fictifs actuels pour la présentation du modèle."],
  ["vintage-oversize", "Vintage oversize", "Pièces fictives à coupe oversize pour la présentation du modèle."],
  ["editions-speciales", "Éditions spéciales", "Créations fictives et originales pour la présentation du modèle."]
];

if (config.demoCatalog) {
  const demoMarker = db.prepare("SELECT value FROM seed_state WHERE key='demo_catalog_initialized'").get();
  if (!demoMarker) {
    const insertCategory = db.prepare("INSERT OR IGNORE INTO categories (slug,name,description) VALUES (?,?,?)");
    for (const category of categories) insertCategory.run(...category);

    const demoProducts = [
      ["demo-france-home", "France Home — Démo", "Maillot national bleu présenté comme produit de démonstration, sans vente d'une reproduction officielle.", "maillots-actuels", 6490, ["S","M","L","XL","XXL"], 12, 1, "/uploads/demo-01.jpg"],
      ["demo-argentine-away", "Argentine Away — Démo", "Maillot bleu ciel présenté comme produit de démonstration vintage.", "maillots-actuels", 5990, ["S","M","L","XL"], 10, 0, "/uploads/demo-02.jpg"],
      ["demo-portugal-home", "Portugal Home — Démo", "Maillot rouge portugais présenté comme produit de démonstration.", "maillots-actuels", 6990, ["S","M","L","XL","XXL"], 8, 1, "/uploads/demo-03.jpg"],
      ["demo-suisse-2006", "Suisse 2006 — Démo", "Maillot rouge suisse d'époque présenté comme pièce de démonstration.", "vintage-oversize", 7490, ["M","L","XL","XXL","3XL"], 7, 1, "/uploads/demo-04.jpg"],
      ["demo-ecosse-vintage", "Écosse Vintage — Démo", "Maillot écossais rétro présenté comme pièce de démonstration.", "vintage-oversize", 8290, ["L","XL","XXL","3XL"], 5, 0, "/uploads/demo-05.jpg"],
      ["demo-autriche-2010", "Autriche 2010 — Démo", "Maillot autrichien bleu présenté comme pièce de démonstration.", "vintage-oversize", 6890, ["M","L","XL","XXL"], 11, 0, "/uploads/demo-06.jpg"],
      ["demo-lesotho-home", "Lesotho Home — Démo", "Maillot rouge Lesotho présenté comme pièce de démonstration.", "editions-speciales", 7990, ["S","M","L","XL"], 6, 1, "/uploads/demo-07.jpg"],
      ["demo-hong-kong-club", "HGFC — Démo", "Maillot de club présenté comme pièce de démonstration, sans affiliation commerciale.", "editions-speciales", 7290, ["S","M","L","XL","XXL"], 4, 1, "/uploads/demo-08.jpg"],
      ["demo-ubon-club", "Ubon UMt — Démo", "Maillot rouge de club présenté comme pièce de démonstration.", "editions-speciales", 8490, ["S","M","L","XL","XXL"], 3, 0, "/uploads/demo-09.jpg"]
    ];

    const insertDemo = db.prepare(`
      INSERT OR IGNORE INTO products
      (slug,name,description,category_id,price_cents,compare_at_cents,image_url,sizes_json,stock,is_featured,is_active,condition_label,is_demo)
      VALUES (?,?,?,?,?,?,?,?,?, ?,1,?,1)
    `);
    for (const [slug, name, description, categorySlug, price, sizes, stock, featured, imageUrl] of demoProducts) {
      const category = db.prepare("SELECT id FROM categories WHERE slug=?").get(categorySlug);
      insertDemo.run(slug, name, description, category.id, price, null, imageUrl, JSON.stringify(sizes), stock, featured, "Fictif — démonstration");
    }
    db.prepare("INSERT OR REPLACE INTO seed_state (key,value) VALUES ('demo_catalog_initialized','true')").run();
  }
}

if (config.adminEmail && config.adminPassword) {
  const existingAdmin = db.prepare("SELECT id FROM users WHERE email=?").get(config.adminEmail);
  if (!existingAdmin) {
    const hash = bcrypt.hashSync(config.adminPassword, 12);
    db.prepare("INSERT INTO users (email,password_hash,first_name,last_name,role) VALUES (?,?,?,?,?)")
      .run(config.adminEmail, hash, "Admin", "Store", "admin");
  }
  console.log("Compte administrateur vérifié.");
} else {
  console.log("Base prête. Configure ADMIN_EMAIL et ADMIN_PASSWORD dans .env.");
}
