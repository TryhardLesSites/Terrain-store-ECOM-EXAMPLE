import { db } from "./db.js";

const productSelect = `
SELECT p.*, c.slug AS category_slug, c.name AS category_name
FROM products p JOIN categories c ON c.id = p.category_id
`;

export function mapProduct(row) {
  if (!row) return null;
  return {
    id: row.id, slug: row.slug, name: row.name, description: row.description,
    categoryId: row.category_id, categorySlug: row.category_slug,
    categoryName: row.category_name, priceCents: row.price_cents,
    compareAtCents: row.compare_at_cents, imageUrl: row.image_url,
    sizes: JSON.parse(row.sizes_json), stock: row.stock,
    isFeatured: Boolean(row.is_featured), isActive: Boolean(row.is_active),
    conditionLabel: row.condition_label, createdAt: row.created_at
  };
}

export function listProducts({ category, search, featured, activeOnly = true, archivedOnly = false } = {}) {
  const clauses = [];
  const values = [];
  if (archivedOnly) clauses.push("p.is_active = 0");
  else if (activeOnly) clauses.push("p.is_active = 1 AND c.is_active = 1");
  if (category) { clauses.push("c.slug = ?"); values.push(category); }
  if (search) {
    clauses.push("(p.name LIKE ? OR p.description LIKE ?)");
    values.push(`%${search}%`, `%${search}%`);
  }
  if (featured === true) clauses.push("p.is_featured = 1");
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  return db.prepare(`${productSelect} ${where} ORDER BY CASE c.slug WHEN 'maillots-actuels' THEN 1 WHEN 'vintage-oversize' THEN 2 WHEN 'editions-speciales' THEN 3 ELSE 4 END, p.is_featured DESC, p.created_at DESC`)
    .all(...values).map(mapProduct);
}

export function getProductById(id) {
  return mapProduct(db.prepare(`${productSelect} WHERE p.id = ?`).get(id));
}
export function getProductBySlug(slug) {
  return mapProduct(db.prepare(`${productSelect} WHERE p.slug = ? AND p.is_active = 1`).get(slug));
}

export function createProduct(data) {
  const result = db.prepare(`
    INSERT INTO products
    (slug,name,description,category_id,price_cents,compare_at_cents,image_url,sizes_json,stock,is_featured,is_active,condition_label)
    VALUES (@slug,@name,@description,@categoryId,@priceCents,@compareAtCents,@imageUrl,@sizesJson,@stock,@isFeatured,@isActive,@conditionLabel)
  `).run({
    ...data, sizesJson: JSON.stringify(data.sizes),
    isFeatured: data.isFeatured ? 1 : 0, isActive: data.isActive ? 1 : 0,
    compareAtCents: data.compareAtCents ?? null
  });
  return getProductById(Number(result.lastInsertRowid));
}

export function updateProduct(id, data) {
  const result = db.prepare(`
    UPDATE products SET slug=@slug,name=@name,description=@description,category_id=@categoryId,
    price_cents=@priceCents,compare_at_cents=@compareAtCents,image_url=@imageUrl,
    sizes_json=@sizesJson,stock=@stock,is_featured=@isFeatured,is_active=@isActive,
    condition_label=@conditionLabel,updated_at=CURRENT_TIMESTAMP WHERE id=@id
  `).run({
    ...data, id, sizesJson: JSON.stringify(data.sizes),
    isFeatured: data.isFeatured ? 1 : 0, isActive: data.isActive ? 1 : 0,
    compareAtCents: data.compareAtCents ?? null
  });
  return result.changes ? getProductById(id) : null;
}
