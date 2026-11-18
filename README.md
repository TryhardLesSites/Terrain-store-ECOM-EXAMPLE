# Terrain Football Store

Boutique e-commerce complète avec catalogue, panier, comptes clients, paiement Stripe, suivi des commandes et back-office administrateur.

## Installation

Prérequis : Node.js 20+, npm.

```bash
npm install
cp .env.example .env
```

Configure ensuite `.env` avec les valeurs propres à ton compte Stripe, SMTP et à ton domaine.

## Configuration

Crée les secrets avec des valeurs longues et aléatoires :

```env
SESSION_SECRET=
ADMIN_EMAIL=
ADMIN_PASSWORD=
SUPPORT_EMAIL=
PUBLIC_BASE_URL=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
SMTP_HOST=
SMTP_PORT=
SMTP_USER=
SMTP_PASSWORD=
MAIL_FROM=
```

Ne partage jamais `.env`, tes clés Stripe ni ton mot de passe SMTP.

## Lancer

```bash
npm run db:seed
npm run dev
```

Ouvre `http://localhost:3000`.

Pour la production :

```bash
npm start
```

Configure HTTPS, les sauvegardes SQLite, les secrets et un store de session persisté avant un encaissement réel.

## Vérifications

```bash
npm test
npm audit --audit-level=high
```

## Stripe

Dans Stripe Dashboard :

1. récupère les clés du compte destinataire ;
2. configure le webhook vers `/api/payments/webhook` ;
3. copie son secret `whsec_...` dans `.env` ;
4. active les reçus/factures selon les besoins ;
5. utilise uniquement les cartes de test en environnement test.

## E-mails

Pour Gmail, utilise un mot de passe d'application propre au compte du destinataire, pas le mot de passe principal.

## Base de données

SQLite est créé automatiquement dans `data/store.db`.

La copie livrée ne contient aucune commande, aucun utilisateur, aucun produit ni aucune image de démonstration.

## Catalogue de démonstration

Avec `DEMO_CATALOG=true`, le premier démarrage crée neuf produits fictifs répartis dans les trois catégories principales. Ils sont marqués `is_demo` dans SQLite et affichés comme « PRODUIT DÉMO » dans la boutique.

Le catalogue n'est inséré qu'une fois. Les redémarrages ne le recréent pas et ne modifient aucun produit propriétaire.

Les neuf visuels sont des ressources photographiques de démonstration provenant d'Unsplash. Ils ne portent aucun logo officiel de club ou de marque. Remplace-les avant une utilisation commerciale par des visuels dont tu possèdes ou as vérifié les droits.

Dans le back-office, l'administrateur peut supprimer tous les produits de démonstration avec « SUPPRIMER TOUS LES PRODUITS DE DÉMO ». Ils restent supprimés définitivement aux redémarrages. Les produits réels restent intacts.
