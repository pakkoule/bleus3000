# Bleus 3000 — V1.1.32

## Diagnostic configuration Calendrier / API-Football
- `calendar-sync` indique maintenant précisément quelles variables Netlify sont visibles par la Function, sans afficher aucune valeur secrète.
- Vérification séparée de `API_FOOTBALL_KEY`, `SUPABASE_URL`, `SUPABASE_SECRET_KEY` et `BLEUS_API_TEAM_MAP`.
- Le mapping signale aussi s’il est absent, invalide JSON ou vide.
- Le support multi-ID de V1.1.31 est conservé (`FRA-ESP-M: [8194,16621]`).
- Aucun changement de schéma Supabase.
