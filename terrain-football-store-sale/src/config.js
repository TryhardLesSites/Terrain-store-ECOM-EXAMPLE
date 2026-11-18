
import dotenv from "dotenv";
dotenv.config();

export const config = {
  port: Number(process.env.PORT || 3000),
  nodeEnv: process.env.NODE_ENV || "development",
  databaseFile: process.env.DATABASE_FILE || "./data/store.db",
  sessionSecret: process.env.SESSION_SECRET || "dev-only-change-this-session-secret-please",
  adminEmail: (process.env.ADMIN_EMAIL || "").toLowerCase(),
  adminPassword: process.env.ADMIN_PASSWORD || "",
  stripeSecretKey: process.env.STRIPE_SECRET_KEY || "",
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET || "",
  publicBaseUrl: process.env.PUBLIC_BASE_URL || "",
  supportEmail: process.env.SUPPORT_EMAIL || "",
  smtpHost: process.env.SMTP_HOST || "",
  smtpPort: Number(process.env.SMTP_PORT || 587),
  smtpUser: process.env.SMTP_USER || "",
  smtpPassword: process.env.SMTP_PASSWORD || "",
  mailFrom: process.env.MAIL_FROM || ""
};

if (config.nodeEnv === "production") {
  if (config.sessionSecret === "dev-only-change-this-session-secret-please") {
    throw new Error("SESSION_SECRET doit être configuré en production.");
  }

  if (config.adminPassword.length < 12) {
    throw new Error("ADMIN_PASSWORD doit contenir au moins 12 caractères en production.");
  }

  if (config.publicBaseUrl && !config.publicBaseUrl.startsWith("https://")) {
    throw new Error("PUBLIC_BASE_URL doit utiliser HTTPS en production.");
  }
}
