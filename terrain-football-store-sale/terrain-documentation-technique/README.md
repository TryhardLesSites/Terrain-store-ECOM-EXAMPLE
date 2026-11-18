# TERRAIN — Football E-commerce Starter

TERRAIN est un projet de boutique e-commerce spécialisé dans les maillots de football. Il fournit une interface web responsive, une API REST, un espace client, un back-office administrateur, un paiement via Stripe Checkout et des e-mails transactionnels via SMTP.

> **Nature du livrable :** code source d'un projet web personnalisable. Ce dépôt ne représente pas une entreprise exploitée et ne comprend ni stock, ni domaine, ni hébergement, ni compte de paiement ou de messagerie.

## Sommaire

- [Fonctionnalités](#fonctionnalités)
- [Technologies](#technologies)
- [Architecture](#architecture)
- [Installation](#installation)
- [Configuration](#configuration)
- [Commandes](#commandes)
- [Documentation technique](#documentation-technique)
- [Points à traiter avant production](#points-à-traiter-avant-production)

## Fonctionnalités

- Page d'accueil, catalogue, recherche et filtres.
- Fiches produit avec tailles, prix, disponibilité et état.
- Panier côté interface et création de session Stripe Checkout.
- Inscription, connexion et espace client avec historique des commandes.
- Back-office protégé pour gérer produits, catégories, utilisateurs et commandes.
- Téléversement d'images produits.
- Webhook Stripe signé pour confirmer les paiements.
- E-mails de confirmation de commande et de notification d'expédition via SMTP.

## Technologies

| Couche | Technologie |
|---|---|
| Serveur | Node.js 20+, Express 4 |
| Interface | HTML, CSS, JavaScript natif |
| Base de données | SQLite avec better-sqlite3 |
| Authentification | express-session, bcryptjs |
| Paiement | Stripe Checkout et webhook |
| E-mails | Nodemailer / SMTP |
| Validation | Zod |
| Sécurité HTTP | Helmet, express-rate-limit |
| Téléversements | Multer |

## Architecture

Le navigateur charge les fichiers statiques de `public/` et communique avec l'API Express située sous `/api`. Le serveur applique les contrôles d'accès, interagit avec SQLite et communique avec Stripe et le serveur SMTP configuré par l'exploitant.

Voir [`docs/architecture.md`](docs/architecture.md) pour les diagrammes Mermaid et les flux détaillés.

## Installation

Prérequis : Node.js 20 ou supérieur et npm.

```bash
npm install
```

Copier `.env.example` vers `.env` :

**Windows PowerShell**
```powershell
Copy-Item .env.example .env
```

**macOS / Linux**
```bash
cp .env.example .env
```

Renseigner les variables de configuration, puis initialiser l'administrateur et démarrer :

```bash
npm run db:seed
npm run dev
```

Ouvrir `http://localhost:3000`.

Pour démarrer le serveur sans le mode watch :

```bash
npm start
```

## Configuration

Les variables principales sont documentées dans `.env.example` :

- `SESSION_SECRET` : secret de signature des sessions.
- `ADMIN_EMAIL` et `ADMIN_PASSWORD` : compte administrateur initial.
- `PUBLIC_BASE_URL` : URL publique du site.
- `STRIPE_SECRET_KEY` et `STRIPE_WEBHOOK_SECRET` : clés Stripe du propriétaire du déploiement.
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `MAIL_FROM` : paramètres SMTP du propriétaire.
- `DATABASE_FILE` : chemin de la base SQLite.

Ne jamais committer `.env`, les secrets Stripe ou les identifiants SMTP. Utiliser des clés Stripe de test pendant la recette.

## Commandes

| Commande | Utilité |
|---|---|
| `npm install` | Installer les dépendances |
| `npm run dev` | Démarrer en développement avec rechargement |
| `npm start` | Démarrer le serveur |
| `npm run db:seed` | Créer l'administrateur initial si nécessaire |
| `npm test` | Exécuter la suite de tests Node |
| `npm run test:api` | Exécuter les tests API |

## Documentation technique

- [`docs/architecture.md`](docs/architecture.md) — architecture, parcours de paiement et diagrammes.
- [`docs/data-model.md`](docs/data-model.md) — tables et relations SQLite.
- [`docs/api-reference.md`](docs/api-reference.md) — routes API, méthodes et droits d'accès.
- [`docs/configuration-deployment.md`](docs/configuration-deployment.md) — configuration locale, Stripe, SMTP et déploiement.
- [`HANDOVER.md`](HANDOVER.md) — checklist de reprise existante du projet.

## Points à traiter avant production

Ce projet constitue une base personnalisable et doit être adapté et testé selon l'activité réelle de son futur propriétaire.

1. Le schéma actuel de checkout demande une adresse e-mail et les articles ; il ne collecte pas d'adresse postale de livraison. Ajouter cette collecte avant une vente de produits physiques.
2. Le serveur utilise le store de session par défaut d'Express. Le remplacer par un store persistant et adapté à l'hébergement avant une exploitation durable.
3. Vérifier et renforcer la gestion du stock en cas de commandes simultanées.
4. Renforcer la validation des fichiers téléversés : le filtre actuel se base sur le type MIME déclaré par le navigateur.
5. Les e-mails SMTP sont des confirmations et notifications. Le code ne génère pas et ne joint pas de facture PDF par SMTP. La création de facture Stripe est activée dans la session Checkout ; son comportement doit être configuré et vérifié dans le compte Stripe du marchand.
6. Configurer HTTPS, sauvegardes, supervision, politiques de confidentialité, mentions légales, TVA, livraison et retours selon le pays d'exploitation.
7. Exécuter les tests et l'audit de dépendances dans l'environnement cible avant livraison ou mise en production.

## Licence et droits

Les droits de revente, de modification et de redistribution doivent être définis explicitement par le vendeur dans une licence ou un contrat séparé. Vérifier les droits sur les logos, marques, photographies, polices et contenus ajoutés au projet avant toute commercialisation.
