# Référence API

Base locale : `http://localhost:3000/api`

| Méthode | Route | Auth | Rôle | Fonction |
|---|---|---|---|---|
| GET | `/health` | Non | — | Vérifier serveur + DB |
| GET | `/categories` | Non | — | Liste catégories |
| GET | `/products` | Non | — | Catalogue (`?category=...&search=...&featured=true`) |
| GET | `/products/:slug` | Non | — | Fiche produit |
| POST | `/auth/register` | Non | — | Créer un compte |
| POST | `/auth/login` | Non | — | Ouvrir une session |
| POST | `/auth/logout` | Session | — | Fermer la session |
| GET | `/auth/me` | Non | — | Utilisateur courant |
| GET | `/account/orders` | Session | Client | Historique commandes |
| GET | `/admin/products` | Session | Admin | Catalogue complet |
| POST | `/admin/products` | Session | Admin | Créer un produit |
| PUT | `/admin/products/:id` | Session | Admin | Modifier un produit |
| DELETE | `/admin/products/:id` | Session | Admin | Archiver un produit |
| GET | `/admin/orders` | Session | Admin | Voir commandes |
| PATCH | `/admin/orders/:id/status` | Session | Admin | Changer statut |
| POST | `/checkout/session` | Non | — | Créer une session Stripe |
| POST | `/payments/webhook` | Signature Stripe | — | Confirmer le paiement |

Les sessions sont stockées côté client dans un cookie HTTP-only avec le store de session par défaut d'Express dans ce starter. Pour la production, remplace le store mémoire par un store persistant SQLite/PostgreSQL.
