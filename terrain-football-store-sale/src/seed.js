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
      ["demo-bleu-nuit", "Maillot Bleu Nuit — Démo", "Création fictive aux couleurs bleu nuit, présentée uniquement à titre commercial.", "maillots-actuels", 6490, ["S","M","L","XL","XXL"], 12, 1, "https://images.unsplash.com/photo-1522778119026-d647f0596c20?w=1000"],
      ["demo-rouge-terre", "Maillot Rouge Terre — Démo", "Maillot conceptuel rouge sans affiliation à un club ou une marque réelle.", "maillots-actuels", 5990, ["S","M","L","XL"], 10, 0, "https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=1000"],
      ["demo-rayures-minuit", "Rayures Minuit — Démo", "Design fictif à rayures créé pour démontrer la création originale.", "maillots-actuels", 6990, ["S","M","L","XL","XXL"], 8, 1, "https://images.unsplash.com/photo-1517466787929-bc90951d0974?w=1000"],
      ["demo-terrace-oversize", "Terrace Oversize — Démo", "Pièce conceptuelle oversize inspirée de l'esthétique rétro, sans logo officiel.", "vintage-oversize", 7490, ["M","L","XL","XXL","3XL"], 7, 1, "https://images.unsplash.com/photo-1523398002811-999ca8dec234?w=1000"],
      ["demo-away-archive", "Away Archive — Démo", "Maillot fictif d'inspiration archive, créé pour tester la présentation vintage.", "vintage-oversize", 8290, ["L","XL","XXL","3XL"], 5, 0, "https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?w=1000"],
      ["demo-stadium-select", "Stadium Select — Démo", "Silhouette fictive d'inspiration stade, sans référence à une équipe existante.", "vintage-oversize", 6890, ["M","L","XL","XXL"], 11, 0, "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=1000"],
      ["demo-edition-nuit", "Édition Nuit — Démo", "Création originale sombre destinée uniquement à la démonstration commerciale.", "editions-speciales", 7990, ["S","M","L","XL"], 6, 1, "https://images.unsplash.com/photo-1551488831-00ddcb6c6bd3?w=1000"],
      ["demo-edition-coupe", "Édition Coupe — Démo", "Pièce conceptuelle de coupe, sans association officielle avec une compétition.", "editions-speciales", 7290, ["S","M","L","XL","XXL"], 4, 1, "https://images.unsplash.com/photo-1506629905607-d9a9b1e3c9f1?w=1000"],
      ["demo-edition-collector", "Édition Collector — Démo", "Produit fictif collector sans identité de club, créé pour présenter les fiches produit.", "editions-speciales", 8490, ["S","M","L","XL","XXL"], 3, 0, "https://images.unsplash.com/photo-1518091043644-c1d44503df89?w=1000"]
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
