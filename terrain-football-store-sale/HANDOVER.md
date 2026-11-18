# Guide de reprise

## À compléter avant mise en production

1. Copie `.env.example` vers `.env`.
2. Remplace tous les identifiants, clés Stripe, secrets SMTP et adresses e-mail.
3. Remplace `SESSION_SECRET` par une valeur aléatoire longue.
4. Crée l'administrateur avec un nouveau mot de passe fort.
5. Configure `PUBLIC_BASE_URL` avec le domaine HTTPS final.
6. Configure `SUPPORT_EMAIL` avec l'adresse réelle du service client.
7. Configure le webhook Stripe réel sur `/api/payments/webhook`.
8. Ajoute les vrais produits, catégories et images via le back-office.
9. Vérifie les mentions légales, livraisons, retours, TVA et politique de confidentialité.
10. Configure les sauvegardes de `data/store.db` et `public/uploads`.

## Ne pas envoyer

La livraison ne contient pas :

- `.env` ;
- clés Stripe ;
- mots de passe SMTP ;
- mots de passe administrateur ;
- base SQLite locale ;
- utilisateurs ou commandes de test ;
- uploads locaux de démonstration ;
- dossier `node_modules` ;
- dossier `.git`.
