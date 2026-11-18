# Référence API — TERRAIN

Base locale : `http://localhost:3000/api`. Les réponses utilisent JSON sauf le webhook Stripe.

## Santé et configuration publiques

| Méthode | Route | Accès | Description |
|---|---|---|---|
| GET | `/health` | Public | Vérifie serveur et connexion SQLite |
| GET | `/config` | Public | Retourne l'adresse de support configurée |
| GET | `/categories` | Public | Liste les catégories actives |
| GET | `/products` | Public | Catalogue ; filtres `category`, `search`, `featured=true` |
| GET | `/products/:slug` | Public | Détail d'un produit actif |

## Authentification et espace client

| Méthode | Route | Accès | Description |
|---|---|---|---|
| POST | `/auth/register` | Public | Créer un compte client et ouvrir une session |
| POST | `/auth/login` | Public | Vérifier les identifiants et ouvrir une session |
| POST | `/auth/logout` | Session | Détruire la session courante |
| GET | `/auth/me` | Public | Retourner l'utilisateur courant ou `null` |
| GET | `/account/orders` | Client connecté | Historique des commandes du compte |

## Administration

Toutes les routes ci-dessous requièrent une session avec le rôle `admin`.

| Méthode | Route | Description |
|---|---|---|
| GET | `/admin/products` | Produits actifs ; `?archived=true` pour les archivés |
| POST | `/admin/products` | Créer un produit |
| PUT | `/admin/products/:id` | Modifier un produit |
| DELETE | `/admin/products/:id` | Archiver un produit |
| PATCH | `/admin/products/:id/restore` | Restaurer un produit archivé |
| DELETE | `/admin/products/:id/permanent` | Supprimer définitivement un produit |
| GET | `/admin/categories` | Lister toutes les catégories |
| POST | `/admin/categories` | Créer une catégorie |
| PUT | `/admin/categories/:id` | Modifier une catégorie |
| DELETE | `/admin/categories/:id` | Archiver une catégorie |
| PATCH | `/admin/categories/:id/restore` | Restaurer une catégorie |
| DELETE | `/admin/categories/:id/permanent` | Supprimer définitivement une catégorie |
| POST | `/admin/uploads` | Téléverser une image produit (champ multipart `image`) |
| GET | `/admin/users` | Lister les utilisateurs |
| PATCH | `/admin/users/:id/ban` | Bannir ou débannir un compte |
| POST | `/admin/users/:id/reset-password` | Réinitialiser le mot de passe d'un compte |
| GET | `/admin/orders` | Lister les commandes |
| PATCH | `/admin/orders/:id/status` | Modifier le statut d'une commande |

## Paiement

| Méthode | Route | Accès | Description |
|---|---|---|---|
| POST | `/checkout/session` | Public | Créer une commande en attente et une session Stripe Checkout |
| GET | `/checkout/confirmation` | Public | Lire l'état de confirmation d'une session Stripe |
| POST | `/payments/webhook` | Signature Stripe | Traiter `checkout.session.completed` |

## Notes d'intégration

- Les routes d'administration utilisent `requireAdmin`.
- Les routes de compte utilisent `requireAuth`.
- Les schémas d'inscription, connexion, produits et checkout sont validés avec Zod.
- La session est portée par le cookie HTTP-only `terrain.sid`.
- Le webhook Stripe doit être configuré sur `/api/payments/webhook` et écouter `checkout.session.completed`.
- Le webhook utilise le corps HTTP brut pour vérifier `stripe-signature`.
- Le schéma checkout actuel accepte `items` et `customerEmail` ; il ne reçoit pas d'adresse postale de livraison.
