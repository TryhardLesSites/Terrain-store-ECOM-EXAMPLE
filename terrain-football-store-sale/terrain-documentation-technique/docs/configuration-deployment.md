# Configuration et déploiement — TERRAIN

## 1. Environnement requis

- Node.js version 20 ou supérieure.
- npm.
- Un environnement d'exécution Node.js pour héberger le serveur Express.
- Un volume persistant pour SQLite (`data/`) et les images (`public/uploads/`) si ces données doivent survivre aux redéploiements.
- Un compte Stripe et un fournisseur SMTP pour activer paiement et e-mails.

## 2. Variables d'environnement

Copier `.env.example` vers `.env` et remplir les valeurs propres au propriétaire du déploiement.

| Variable | Fonction |
|---|---|
| `PORT` | Port HTTP du serveur (défaut 3000) |
| `NODE_ENV` | `development` ou `production` |
| `DATABASE_FILE` | Chemin du fichier SQLite |
| `SESSION_SECRET` | Secret de session fort et aléatoire |
| `ADMIN_EMAIL` | E-mail du compte administrateur initial |
| `ADMIN_PASSWORD` | Mot de passe initial de l'administrateur |
| `PUBLIC_BASE_URL` | URL publique du site |
| `SUPPORT_EMAIL` | Adresse de support communiquée au frontend |
| `STRIPE_SECRET_KEY` | Clé secrète Stripe du marchand |
| `STRIPE_WEBHOOK_SECRET` | Secret `whsec_...` du webhook |
| `SMTP_HOST` | Hôte SMTP |
| `SMTP_PORT` | Port SMTP, souvent 587 ou 465 |
| `SMTP_USER` | Identifiant SMTP |
| `SMTP_PASSWORD` | Mot de passe ou mot de passe d'application SMTP |
| `MAIL_FROM` | Expéditeur des e-mails |

Ne jamais ajouter `.env` à Git. Les clés Stripe et SMTP doivent être conservées dans les variables secrètes de l'hébergeur.

## 3. SMTP

Le module `src/mailer.js` crée un transport Nodemailer si `SMTP_HOST`, `SMTP_USER` et `SMTP_PASSWORD` sont renseignés.

- Port 587 : STARTTLS (option `secure: false`).
- Port 465 : TLS implicite (option `secure: true`).

Le fournisseur SMTP doit autoriser l'envoi depuis le compte concerné. `MAIL_FROM` doit être autorisé par ce fournisseur.

E-mails implémentés :
- confirmation de commande après traitement du webhook de paiement ;
- notification lorsque la commande passe au statut expédié.

Le module SMTP ne génère pas de facture PDF et ne joint pas de document de facture. La session Stripe Checkout active `invoice_creation`; le propriétaire doit vérifier les réglages et le rendu des factures dans son compte Stripe. Ne pas présenter l'e-mail de confirmation comme une facture fiscale.

## 4. Stripe

1. Utiliser les clés de test pendant le développement.
2. Configurer un endpoint webhook vers `https://votre-domaine/api/payments/webhook`.
3. Écouter l'événement `checkout.session.completed`.
4. Copier le secret du endpoint (`whsec_...`) dans `STRIPE_WEBHOOK_SECRET`.
5. Effectuer un paiement de test et vérifier la commande et le webhook.
6. Passer aux clés live uniquement après recette et configuration du compte marchand.

Test local avec Stripe CLI :

```bash
stripe listen --events checkout.session.completed --forward-to http://localhost:3000/api/payments/webhook
```

Le secret affiché par Stripe CLI est destiné à cet écouteur local et doit rester dans le `.env` local.

## 5. Initialisation et démarrage

```bash
npm install
npm run db:seed
npm start
```

En développement :

```bash
npm run dev
```

## 6. Vérifications avant production

```bash
npm test
npm audit --audit-level=high
```

Recette manuelle recommandée :
- inscription, connexion, déconnexion ;
- contrôle des rôles client et administrateur ;
- création, modification et archivage de produits et catégories ;
- téléversement d'images ;
- paiement Stripe test et réception du webhook ;
- réception des e-mails de confirmation et d'expédition ;
- historique de commandes ;
- sauvegarde et restauration de SQLite.

## 7. Points d'attention pour hébergement

Le projet écrit dans SQLite et dans `public/uploads`. Un hébergement dont le système de fichiers est éphémère peut perdre ces données lors d'un redémarrage ou redéploiement. Prévoir un disque persistant ou migrer vers une base et un stockage adaptés.

Le store de session Express par défaut n'est pas adapté à la production. Le remplacer par un store persistant avant mise en ligne durable.

Pour une boutique de produits physiques, ajouter la collecte, la validation et le stockage de l'adresse de livraison avant d'accepter des commandes réelles.

## 8. Sécurité et exploitation

- HTTPS obligatoire en production.
- Secrets distincts par environnement.
- Sauvegardes régulières et tests de restauration.
- Politique de mises à jour des dépendances.
- Journalisation et surveillance des erreurs.
- Vérification des droits de redistribution des médias, logos et marques.
- Conformité légale et fiscale à valider par le propriétaire du commerce.
