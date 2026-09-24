# Sécurité Bleus 3000 — V1.1.35

- La clé TheSportsDB doit rester dans une variable d'environnement Netlify `THESPORTSDB_KEY` marquée secrète.
- La clé Supabase serveur doit rester dans `SUPABASE_SECRET_KEY` et ne jamais être exposée dans le navigateur, GitHub ou `bleus_config.js`.
- `SUPABASE_URL` et la clé Supabase publishable du client web sont publiques par conception ; les droits réels sont contrôlés par les grants/RLS.
- `/api/sportsdb-live` agit comme proxy serveur : le navigateur ne reçoit jamais `THESPORTSDB_KEY`.
- `calendar-sync` utilise la clé serveur Supabase uniquement dans Netlify Functions.
- Les corrections éditoriales de matchs sont protégées par les politiques existantes de `public.matches` et réservées aux rôles autorisés par `public.can_edit()`.
