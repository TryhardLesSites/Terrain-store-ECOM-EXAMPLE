# Architecture technique — TERRAIN

## 1. Vue d'ensemble

```mermaid
flowchart TD
    U[Visiteur / Client] --> WEB[Frontend HTML CSS JS]
    WEB --> API[API REST Express]
    API --> AUTH[Authentification par session]
    API --> DB[(SQLite)]
    API --> STRIPE[Stripe Checkout]
    STRIPE --> WH[Webhook signé]
    WH --> DB
    ADMIN[Administrateur] --> WEB
    WEB -->|CRUD via API| API
```

## 2. Cycle de commande

```mermaid
sequenceDiagram
    actor Client
    participant UI as Boutique
    participant API as Express API
    participant SQL as SQLite
    participant Stripe
    Client->>UI: Ajoute maillot + taille au panier
    Client->>UI: Clique sur payer
    UI->>API: POST /api/checkout/session
    API->>SQL: Vérifie produit, taille, stock
    API->>SQL: Crée commande pending + lignes
    API->>Stripe: Crée Checkout Session
    Stripe-->>UI: URL de paiement
    Client->>Stripe: Paie en mode test
    Stripe->>API: Webhook checkout.session.completed
    API->>SQL: Passe commande à paid et décrémente stock
```

## 3. Modèle relationnel

```mermaid
erDiagram
    USERS ||--o{ ORDERS : passe
    CATEGORIES ||--o{ PRODUCTS : classe
    ORDERS ||--|{ ORDER_ITEMS : contient
    PRODUCTS ||--o{ ORDER_ITEMS : reference
    USERS {
      int id PK
      string email UK
      string password_hash
      string role
    }
    CATEGORIES {
      int id PK
      string slug UK
      string name
    }
    PRODUCTS {
      int id PK
      string slug UK
      int category_id FK
      int price_cents
      int stock
    }
    ORDERS {
      int id PK
      int user_id FK
      string email
      string status
      int total_cents
      string stripe_session_id
    }
    ORDER_ITEMS {
      int id PK
      int order_id FK
      int product_id FK
      string product_name
      string size
      int quantity
      int unit_price_cents
    }
```

## 4. Pages de la boutique

- `#home` : accueil, catégories, sélection mise en avant.
- `#shop` : catalogue, filtres, recherche.
- `#product/:slug` : fiche produit et choix de taille.
- `#cart` : panier et redirection Stripe.
- `#account` : inscription, connexion, commandes.
- `#admin` : back-office (visible pour un compte admin).

La page admin est un espace protégé, pas une page publique de vente.
