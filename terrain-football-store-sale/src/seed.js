import bcrypt from "bcryptjs";
import { db } from "./db.js";
import { config } from "./config.js";

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
