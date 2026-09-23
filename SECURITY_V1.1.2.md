# Bleus 3000 — sécurité V1.1.2

- Projet Supabase obligatoirement distinct de Cotation 3000.
- Identifiants Supabase absents par défaut du package.
- RLS activé sur les tables applicatives.
- Auto-promotion de rôle interdite côté client ; ADMIN/SUPERADMIN protégés côté base.
- La clé API-Football reste uniquement dans une variable d'environnement Netlify et n'est jamais placée dans le navigateur.
- Les messages du mur peuvent être supprimés par leur auteur ou l'administration ; aucun mécanisme d'épinglage n'est présent.
- Les avatars membres ont été retirés du code, de la base et du package.
