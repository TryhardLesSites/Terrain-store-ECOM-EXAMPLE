import test from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import fs from "node:fs";
import path from "node:path";

const testDb = path.resolve("./data/test-store.db");
process.env.NODE_ENV = "test";
process.env.DATABASE_FILE = testDb;
process.env.SESSION_SECRET = "test-session-secret-which-is-long-enough-123456";
process.env.ADMIN_EMAIL = "admin@terrain.test";
process.env.ADMIN_PASSWORD = "ChangeMe-Now-2026!";

const { default: app } = await import("../src/server.js");
const { db } = await import("../src/db.js");

function ensureTestFixture() {
  let category = db.prepare("SELECT id FROM categories WHERE slug=?").get("tests-catalogue");
  if (!category) {
    const result = db.prepare("INSERT INTO categories (slug,name,description) VALUES (?,?,?)")
      .run("tests-catalogue", "Catalogue test", "Catégorie temporaire utilisée par les tests.");
    category = { id: Number(result.lastInsertRowid) };
  }
  let product = db.prepare("SELECT id,name,price_cents FROM products WHERE slug=?").get("test-fixture");
  if (!product) {
    const result = db.prepare(`
      INSERT INTO products
      (slug,name,description,category_id,price_cents,compare_at_cents,image_url,sizes_json,stock,is_featured,is_active,condition_label)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
    `).run("test-fixture","Produit test","Produit temporaire utilisé par les tests automatisés.",category.id,4500,null,"",JSON.stringify(["M","L"]),5,0,1,"Neuf");
    product = db.prepare("SELECT id,name,price_cents FROM products WHERE id=?").get(result.lastInsertRowid);
  }
  return { category, product };
}

test("health endpoint confirms SQLite connection", async () => {
  const res = await request(app).get("/api/health").expect(200);
  assert.equal(res.body.status, "ok");
  assert.equal(res.body.database, true);
});

test("catalogue API returns seeded categories and products", async () => {
  ensureTestFixture();
  const cats = await request(app).get("/api/categories").expect(200);
  const products = await request(app).get("/api/products").expect(200);
  assert.ok(cats.body.length >= 1);
  assert.ok(products.body.length >= 1);
  assert.ok(products.body[0].priceCents > 0);
});

test("demo catalogue inserts exactly nine marked products once", async () => {
  const demos = db.prepare("SELECT * FROM products WHERE is_demo=1").all();
  assert.equal(demos.length, 9);
  assert.equal(new Set(demos.map(product => product.slug)).size, 9);
  assert.equal(db.prepare("SELECT value FROM seed_state WHERE key='demo_catalog_initialized'").get().value, "true");

  const marker = db.prepare("SELECT value FROM seed_state WHERE key='demo_catalog_initialized'").get();
  assert.equal(Boolean(marker), true);
  const ownerProduct = db.prepare("INSERT OR IGNORE INTO products (slug,name,description,category_id,price_cents,image_url,sizes_json,stock,is_demo) SELECT 'owner-real-product','Produit réel test','Produit créé par le propriétaire.',id,4500,'', '[\"M\",\"L\"]',5,0 FROM categories LIMIT 1").run();
  assert.equal(ownerProduct.changes <= 1, true);
  const owner = db.prepare("SELECT is_demo FROM products WHERE slug='owner-real-product'").get();
  assert.equal(owner.is_demo, 0);
});

test("admin can delete demo catalogue without deleting real products", async () => {
  ensureTestFixture();
  const agent = request.agent(app);
  await agent.post("/api/auth/login").send({email:"admin@terrain.test",password:"ChangeMe-Now-2026!"}).expect(200);
  const beforeReal = db.prepare("SELECT COUNT(*) AS count FROM products WHERE is_demo=0").get().count;
  await agent.delete("/api/admin/demo-products").expect(200);
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM products WHERE is_demo=1").get().count, 0);
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM products WHERE is_demo=0").get().count, beforeReal);
  await agent.delete("/api/admin/demo-products").expect(200);
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM products WHERE is_demo=1").get().count, 0);
});

test("register, login and protected account endpoint work", async () => {
  const fixture = ensureTestFixture();
  const agent = request.agent(app);
  await agent.post("/api/auth/register").send({
    email:"test-buyer@example.com",password:"VeryStrongPass123",
    firstName:"Test",lastName:"Buyer"
  }).expect(201);
  const me = await agent.get("/api/auth/me").expect(200);
  assert.equal(me.body.user.email,"test-buyer@example.com");
  await agent.get("/api/account/orders").expect(200);
  const product = fixture.product;
  const order = db.prepare("INSERT INTO orders (user_id,email,total_cents,status) VALUES (?,?,?,?)")
    .run((await agent.get("/api/auth/me")).body.user.id, "test-buyer@example.com", product.price_cents, "paid");
  db.prepare("INSERT INTO order_items (order_id,product_id,product_name,size,quantity,unit_price_cents) VALUES (?,?,?,?,?,?)")
    .run(order.lastInsertRowid, product.id, product.name, "M", 1, product.price_cents);
  const trackedOrders = await agent.get("/api/account/orders").expect(200);
  assert.equal(trackedOrders.body[0].status, "paid");
  assert.equal(trackedOrders.body[0].items[0].name, product.name);
  await agent.post("/api/auth/logout").expect(200);
  await agent.get("/api/account/orders").expect(401);
  await agent.post("/api/auth/login").send({email:"test-buyer@example.com",password:"VeryStrongPass123"}).expect(200);
});

test("admin product creation and archival use protected API routes", async () => {
  const fixture = ensureTestFixture();
  const agent = request.agent(app);
  await agent.post("/api/auth/login").send({email:"admin@terrain.test",password:"ChangeMe-Now-2026!"}).expect(200);
  const category = fixture.category;
  const created = await agent.post("/api/admin/products").send({
    name:"Test jersey API",slug:"test-jersey-api",description:"Produit de test suffisamment descriptif.",
    categoryId:category.id,priceCents:4500,compareAtCents:null,
    imageUrl:"https://example.com/test.jpg",sizes:["S","M","L"],stock:5,
    isFeatured:false,isActive:true,conditionLabel:"Neuf"
  }).expect(201);
  assert.equal(created.body.slug,"test-jersey-api");
  await agent.delete(`/api/admin/products/${created.body.id}`).expect(200);
  const publicList = await request(app).get("/api/products").expect(200);
  assert.equal(publicList.body.some(p=>p.slug==="test-jersey-api"),false);
  const activeAdminList = await agent.get("/api/admin/products").expect(200);
  const archivedAdminList = await agent.get("/api/admin/products?archived=true").expect(200);
  assert.equal(activeAdminList.body.some(p=>p.slug==="test-jersey-api"),false);
  assert.equal(archivedAdminList.body.some(p=>p.slug==="test-jersey-api"),true);
  await agent.patch(`/api/admin/products/${created.body.id}/restore`).expect(200);
  const restoredList = await request(app).get("/api/products").expect(200);
  assert.equal(restoredList.body.some(p=>p.slug==="test-jersey-api"),true);
  await agent.delete(`/api/admin/products/${created.body.id}`).expect(200);
  await agent.delete(`/api/admin/products/${created.body.id}/permanent`).expect(200);
  const adminList = await agent.get("/api/admin/products").expect(200);
  assert.equal(adminList.body.some(p=>p.slug==="test-jersey-api"),false);
  const archivedAfterDelete = await agent.get("/api/admin/products?archived=true").expect(200);
  assert.equal(archivedAfterDelete.body.some(p=>p.slug==="test-jersey-api"),false);
});

test("admin image upload returns a local gallery path", async () => {
  const agent = request.agent(app);
  await agent.post("/api/auth/login").send({email:"admin@terrain.test",password:"ChangeMe-Now-2026!"}).expect(200);
  const uploaded = await agent.post("/api/admin/uploads")
    .attach("image", Buffer.from("fake-image"), "shirt.jpg")
    .expect(201);
  assert.match(uploaded.body.imageUrl, /^\/uploads\/[a-f0-9-]+\.jpg$/);
  fs.unlinkSync(path.resolve("./public", uploaded.body.imageUrl.slice(1)));
});

test("admin can create a category and it appears in the public category API", async () => {
  const agent = request.agent(app);
  await agent.post("/api/auth/login").send({email:"admin@terrain.test",password:"ChangeMe-Now-2026!"}).expect(200);
  const created = await agent.post("/api/admin/categories").send({
    name:"Tests vintage", description:"Catégorie créée par le test."
  }).expect(201);
  assert.equal(created.body.name, "Tests vintage");
  assert.match(created.body.slug, /^tests-vintage$/);
  assert.equal(typeof created.body.id, "number");
  const categories = await request(app).get("/api/categories").expect(200);
  assert.equal(categories.body.some(category => category.id === created.body.id), true);
  db.prepare("DELETE FROM categories WHERE id=?").run(created.body.id);
});

test("category admin actions stay consistent with product references and public catalogue", async () => {
  const agent = request.agent(app);
  await agent.post("/api/auth/login").send({email:"admin@terrain.test",password:"ChangeMe-Now-2026!"}).expect(200);
  const created = await agent.post("/api/admin/categories").send({name:"Archive test", description:"Catégorie temporaire."}).expect(201);
  await agent.put(`/api/admin/categories/${created.body.id}`).send({
    name:"Archive test updated", slug:"archive-test-updated", description:"Catégorie modifiée."
  }).expect(200);
  await agent.delete(`/api/admin/categories/${created.body.id}`).expect(200);
  const publicCategories = await request(app).get("/api/categories").expect(200);
  assert.equal(publicCategories.body.some(category => category.id === created.body.id), false);
  await agent.patch(`/api/admin/categories/${created.body.id}/restore`).expect(200);
  const restoredCategories = await request(app).get("/api/categories").expect(200);
  assert.equal(restoredCategories.body.some(category => category.id === created.body.id), true);
  await agent.delete(`/api/admin/categories/${created.body.id}`).expect(200);
  await agent.delete(`/api/admin/categories/${created.body.id}/permanent`).expect(200);
  await agent.get("/api/admin/categories").expect(200);
});

test("admin order status changes are visible only to the owning customer", async () => {
  const fixture = ensureTestFixture();
  const first = request.agent(app);
  const second = request.agent(app);
  const admin = request.agent(app);
  await first.post("/api/auth/register").send({
    email:"tracking-first@example.com",password:"VeryStrongPass123",
    firstName:"Tracking",lastName:"First"
  }).expect(201);
  await second.post("/api/auth/register").send({
    email:"tracking-second@example.com",password:"VeryStrongPass123",
    firstName:"Tracking",lastName:"Second"
  }).expect(201);
  await admin.post("/api/auth/login").send({email:"admin@terrain.test",password:"ChangeMe-Now-2026!"}).expect(200);

  const firstUser = (await first.get("/api/auth/me").expect(200)).body.user;
  const product = fixture.product;
  const order = db.prepare("INSERT INTO orders (user_id,email,total_cents,status) VALUES (?,?,?,?)")
    .run(firstUser.id, firstUser.email, product.price_cents, "paid");
  db.prepare("INSERT INTO order_items (order_id,product_id,product_name,size,quantity,unit_price_cents) VALUES (?,?,?,?,?,?)")
    .run(order.lastInsertRowid, product.id, product.name, "M", 1, product.price_cents);

  assert.equal((await first.get("/api/account/orders").expect(200)).body.length, 1);
  assert.equal((await second.get("/api/account/orders").expect(200)).body.length, 0);
  await admin.patch(`/api/admin/orders/${order.lastInsertRowid}/status`).send({status:"processing"}).expect(200);

  const firstOrders = (await first.get("/api/account/orders").expect(200)).body;
  assert.equal(firstOrders[0].status, "processing");
  assert.equal((await second.get("/api/account/orders").expect(200)).body.length, 0);
});

test.after(() => {
  try { db.close(); } catch {}
  for (const suffix of ["","-shm","-wal"]) {
    try { fs.unlinkSync(testDb+suffix); } catch {}
  }
});
