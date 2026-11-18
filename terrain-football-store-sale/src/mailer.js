import nodemailer from "nodemailer";
import { config } from "./config.js";
const transport = config.smtpHost && config.smtpUser && config.smtpPassword
  ? nodemailer.createTransport({
      host: config.smtpHost,
      port: config.smtpPort,
      secure: config.smtpPort === 465,
      auth: { user: config.smtpUser, pass: config.smtpPassword }
    })
  : null;

export function isMailConfigured() {
  return Boolean(transport);
}

export async function sendPurchaseReceipt({ order, items }) {
  if (!transport) {
    console.warn("E-mail de reçu non envoyé : configuration SMTP absente.");
    return false;
  }
  const rows = items.map(item => `
    <tr>
      <td>${escapeHtml(item.product_name)} — taille ${escapeHtml(item.size)}</td>
      <td>${item.quantity}</td>
      <td>${formatMoney(item.unit_price_cents * item.quantity)}</td>
    </tr>
  `).join("");
  const shopUrl = `${config.publicBaseUrl.replace(/\/$/, "")}/`;
  await transport.sendMail({
    from: config.mailFrom,
    to: order.email,
    subject: `Merci pour ta commande #${order.id} — Terrain`,
    text: `Merci pour ton achat !\n\nCommande #${order.id}\nTotal : ${formatMoney(order.total_cents)}\n\nDécouvre la sélection Terrain : ${shopUrl}\n\nTerrain Football Store`,
    html: `<!doctype html>
<html lang="fr">
  <body style="margin:0;background:#f2f0e9;color:#171914;font-family:Arial,sans-serif">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f2f0e9">
      <tr><td align="center" style="padding:28px 12px">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:620px;background:#fff">
          <tr><td style="padding:28px 30px 20px">
            <p style="margin:0 0 18px;font-size:12px;letter-spacing:2px;color:#71736a">TERRAIN / FOOTBALL CULTURE</p>
            <h1 style="margin:0 0 12px;font-size:30px;line-height:1.1;color:#171914">Merci pour ton achat.</h1>
            <p style="margin:0;font-size:16px;line-height:1.6;color:#4d4f47">Ta commande <strong>#${order.id}</strong> est confirmée.</p>
          </td></tr>
          <tr><td style="padding:26px 30px 10px">
            <table role="presentation" width="100%" cellpadding="10" cellspacing="0" border="0" style="border-collapse:collapse;font-size:14px">
              <thead><tr style="background:#171914;color:#fff;text-align:left"><th>Article</th><th>Qté</th><th>Total</th></tr></thead>
              <tbody>${rows}</tbody>
            </table>
            <p style="margin:20px 0 0;text-align:right;font-size:18px"><strong>Total : ${formatMoney(order.total_cents)}</strong></p>
          </td></tr>
          <tr><td style="padding:10px 30px 30px;color:#4d4f47;font-size:15px;line-height:1.6">
            Nous préparerons ton colis avec soin.<br><br>
            <strong>Terrain Football Store</strong>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`
  });
  return true;
}

export async function sendShippedNotification({ order }) {
  if (!transport) {
    console.warn("E-mail d'expédition non envoyé : configuration SMTP absente.");
    return false;
  }
  const shopUrl = `${config.publicBaseUrl.replace(/\/$/, "")}/`;
  await transport.sendMail({
    from: config.mailFrom,
    to: order.email,
    subject: `Ta commande #${order.id} est en route — Terrain`,
    text: `Bonne nouvelle !\n\nTa commande #${order.id} vient d'être expédiée.\n\nDécouvre la sélection Terrain : ${shopUrl}\n\nTerrain Football Store`,
    html: `<!doctype html>
<html lang="fr">
  <body style="margin:0;background:#f2f0e9;color:#171914;font-family:Arial,sans-serif">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f2f0e9">
      <tr><td align="center" style="padding:28px 12px">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:620px;background:#fff">
          <tr><td style="padding:30px">
            <p style="margin:0 0 18px;font-size:12px;letter-spacing:2px;color:#71736a">TERRAIN / ORDER UPDATE</p>
            <h1 style="margin:0 0 12px;font-size:30px;line-height:1.1;color:#171914">Ta commande est en route.</h1>
            <p style="margin:0;font-size:16px;line-height:1.6;color:#4d4f47">La commande <strong>#${order.id}</strong> vient d'être expédiée.</p>
          </td></tr>
          <tr><td style="padding:28px 30px 34px;color:#4d4f47;font-size:15px;line-height:1.6">
            Tu recevras les informations de suivi dès qu'elles seront disponibles.<br><br>
            Merci de faire partie de la culture Terrain.<br><br>
            <strong>Terrain Football Store</strong>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`
  });
  return true;
}

function formatMoney(cents) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(cents / 100);
}

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[character]));
}
