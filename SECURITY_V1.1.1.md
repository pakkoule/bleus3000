# Sécurité — Bleus 3000 V1.1.1

- Les identifiants du nouveau Supabase ne sont pas fournis dans l'archive.
- La clé API-Football doit rester dans une variable d'environnement Netlify (`API_FOOTBALL_KEY`).
- Le navigateur appelle un proxy serveur avec liste blanche d'endpoints.
- RLS activé sur les tables Supabase.
- Les rôles sont : `user`, `contributor`, `editor`, `admin`, `superadmin`.
- Un trigger SQL bloque l'auto-promotion de rôle depuis le client.
- `admin` ne peut pas attribuer ni modifier le rôle `superadmin`; seul un superadmin le peut.
- L'écriture encyclopédique directe est réservée à `editor`, `admin` et `superadmin` dans cette version.
- Les signalements peuvent être créés par leur auteur et consultés/traités par l'administration.
- Les messages du mur peuvent être supprimés par leur auteur ou l'administration; l'épinglage passe par une fonction sécurisée.

Avant mise en production, vérifier les Redirect URLs Supabase, variables Netlify, politiques RLS et domaines autorisés.
