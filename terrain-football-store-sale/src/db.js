import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { config } from "./config.js";

const dbPath = path.resolve(config.databaseFile);
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

export const db = new Database(dbPath);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");
db.pragma("busy_timeout = 5000");

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'customer' CHECK(role IN ('customer','admin')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  category_id INTEGER NOT NULL REFERENCES categories(id),
  price_cents INTEGER NOT NULL CHECK(price_cents >= 0),
  compare_at_cents INTEGER,
  image_url TEXT NOT NULL DEFAULT '',
  sizes_json TEXT NOT NULL DEFAULT '["S","M","L","XL"]',
  stock INTEGER NOT NULL DEFAULT 0 CHECK(stock >= 0),
  is_featured INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  condition_label TEXT NOT NULL DEFAULT 'Neuf',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id),
  email TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','paid','processing','shipped','cancelled','refunded')),
  total_cents INTEGER NOT NULL,
  stripe_session_id TEXT UNIQUE,
  stripe_payment_intent TEXT,
  shipping_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id INTEGER REFERENCES products(id),
  product_name TEXT NOT NULL,
  size TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK(quantity > 0),
  unit_price_cents INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  sid TEXT PRIMARY KEY,
  sess TEXT NOT NULL,
  expired INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS seed_state (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_products_category_active ON products(category_id, is_active);
CREATE INDEX IF NOT EXISTS idx_orders_user_created ON orders(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expired ON sessions(expired);
`);

const userColumns = db.prepare("PRAGMA table_info(users)").all();
if (!userColumns.some((column) => column.name === "is_banned")) {
  db.exec("ALTER TABLE users ADD COLUMN is_banned INTEGER NOT NULL DEFAULT 0 CHECK(is_banned IN (0,1))");
}
const categoryColumns = db.prepare("PRAGMA table_info(categories)").all();
if (!categoryColumns.some((column) => column.name === "is_active")) {
  db.exec("ALTER TABLE categories ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0,1))");
}
const orderColumns = db.prepare("PRAGMA table_info(orders)").all();
if (!orderColumns.some((column) => column.name === "receipt_sent_at")) {
  db.exec("ALTER TABLE orders ADD COLUMN receipt_sent_at TEXT");
}
if (!orderColumns.some((column) => column.name === "shipped_mail_sent_at")) {
  db.exec("ALTER TABLE orders ADD COLUMN shipped_mail_sent_at TEXT");
}

export function closeDb() {
  db.close();
}
