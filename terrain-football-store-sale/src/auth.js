import bcrypt from "bcryptjs";
import { db } from "./db.js";

export function createUser({ email, password, firstName, lastName, role = "customer" }) {
  const passwordHash = bcrypt.hashSync(password, 12);
  const result = db.prepare(`
    INSERT INTO users (email, password_hash, first_name, last_name, role)
    VALUES (?, ?, ?, ?, ?)
  `).run(email.toLowerCase(), passwordHash, firstName, lastName, role);
  return db.prepare("SELECT id, email, first_name, last_name, role, created_at FROM users WHERE id = ?").get(result.lastInsertRowid);
}

export function verifyCredentials(email, password) {
  const user = db.prepare("SELECT * FROM users WHERE email = ? COLLATE NOCASE").get(email);
  if (user?.is_banned) return null;
  if (!user || !bcrypt.compareSync(password, user.password_hash)) return null;
  const { password_hash, ...safeUser } = user;
  return safeUser;
}

export function publicUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    email: user.email,
    firstName: user.first_name,
    lastName: user.last_name,
    role: user.role,
    createdAt: user.created_at
  };
}

export function requireAuth(req, res, next) {
  if (!req.session.user) return res.status(401).json({ error: "Connexion requise." });
  const user = db.prepare("SELECT is_banned FROM users WHERE id=?").get(req.session.user.id);
  if (!user || user.is_banned) {
    return req.session.destroy(() => res.status(403).json({ error: "Ce compte est banni." }));
  }
  next();
}

export function requireAdmin(req, res, next) {
  if (!req.session.user || req.session.user.role !== "admin") {
    return res.status(403).json({ error: "Accès administrateur requis." });
  }
  next();
}

export function resetUserPassword(id, password) {
  const passwordHash = bcrypt.hashSync(password, 12);
  return db.prepare("UPDATE users SET password_hash=? WHERE id=?").run(passwordHash, id);
}
