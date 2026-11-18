# Architecture technique — TERRAIN

## 1. Vue logique

```mermaid
flowchart TB
    B[Visiteur / Client / Administrateur]
    FE[Frontend statique\npublic/index.html\npublic/styles.css\npublic/app.js]
    API[Serveur Express\nsrc/server.js]
    AUTH[Authentification & autorisations\nsrc/auth.js]
    VAL[Validation des entrées\nsrc/validators.js]
    PROD[Services produits\nsrc/products.js]
    DB[(SQLite\nsrc/db.js)]
    STRIPE[Stripe Checkout]
    WH[Webhook Stripe signé]
    MAIL[SMTP / Nodemailer\nsrc/mailer.js]
    UP[Images téléversées\npublic/uploads]

    B --> FE
    FE <-->|HTTP / JSON| API
    API --> AUTH
    API --> VAL
    API --> PROD
    AUTH --> DB
    PROD --> DB
    API <--> DB
    API -->|Créer session| STRIPE
    STRIPE -->|checkout.session.completed| WH
    WH --> API
    WH --> DB
    API --> MAIL
    API --> UP
```

## 2. Organisation du code

| Chemin | Responsabilité |
|---|---|
| `public/` | Interface client, styles, JavaScript navigateur et fichiers statiques |
| `src/server.js` | Initialisation Express, middleware, routes REST, Stripe et logique de commande |
| `src/config.js` | Lecture et validation des variables d'environnement |
| `src/db.js` | Ouverture SQLite, création des tables et migrations simples |
| `src/auth.js` | Création des comptes, vérification des mots de passe et gardes d'accès |
| `src/products.js` | Requêtes et transformations des produits |
| `src/validators.js` | Schémas Zod pour inscription, connexion, produits et checkout |
| `src/mailer.js` | Envoi des e-mails de commande et d'expédition |
| `src/seed.js`, `scripts/seed.js` | Initialisation des données / compte administrateur |
| `tests/` | Tests automatisés |

## 3. Séquence de paiement

```mermaid
sequenceDiagram
    actor Client
    participant UI as Navigateur
    participant API as Express
    participant DB as SQLite
    participant Stripe

    Client->>UI: Choisit produits, tailles et quantités
    UI->>API: POST /api/checkout/session
    API->>DB: Relit les produits et prix
    API->>DB: Crée commande en attente et lignes
    API->>Stripe: Crée Checkout Session
    Stripe-->>API: URL de paiement
    API-->>UI: URL Checkout
    UI->>Stripe: Redirection client vers paiement
    Stripe->>API: Webhook signé checkout.session.completed
    API->>API: Vérifie la signature
    API->>DB: Marque commande payée et décrémente le stock
    API->>API: Déclenche l'e-mail de confirmation
```

Le webhook est déclaré avant le middleware JSON afin de recevoir le corps brut requis pour la vérification de signature Stripe.

## 4. Séquence d'administration

```mermaid
sequenceDiagram
    actor Admin
    participant UI as Navigateur
    participant API as Express
    participant DB as SQLite

    Admin->>UI: Se connecte
    UI->>API: POST /api/auth/login
    API->>DB: Vérifie le compte et le hash bcrypt
    API-->>UI: Session HTTP-only
    Admin->>UI: Crée ou modifie un produit
    UI->>API: POST/PUT /api/admin/products
    API->>API: requireAdmin + validation Zod
    API->>DB: Écrit les données produit
    API-->>UI: Produit enregistré
```

## 5. Pages applicatives

- `#home` : accueil et sélections.
- `#shop` : catalogue, recherche et filtres.
- `#product/:slug` : fiche produit.
- `#cart` : panier et redirection vers Stripe Checkout.
- `#account` : inscription, connexion et commandes.
- `#admin` : interface d'administration protégée par le rôle `admin`.

## 6. Limites techniques connues dans cette version

- Le checkout demande l'e-mail client et les lignes de panier ; aucune adresse postale de livraison n'est collectée.
- Les sessions utilisent le store mémoire par défaut d'Express.
- Le stock est décrémenté lors de la réception du webhook de paiement ; la gestion de concurrence et de réservation préalable doit être renforcée pour une exploitation réelle.
- Le filtre d'upload accepte les types MIME JPEG, PNG, WEBP et GIF et limite la taille à 5 Mo, mais ne vérifie pas le contenu binaire réel du fichier.
- Les e-mails envoyés sont une confirmation de commande et une notification d'expédition ; aucune facture PDF n'est construite ni jointe par le module SMTP.
