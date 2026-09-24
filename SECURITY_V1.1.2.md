# Sécurité complémentaire — V1.1.35

- Ne jamais committer de fichier `.env` contenant des secrets.
- Conserver le Secret Scanning Netlify activé.
- `THESPORTSDB_KEY` et `SUPABASE_SECRET_KEY` doivent être marquées **Contains secret values** dans Netlify.
- `SUPABASE_URL` et les mappings d'IDs ne doivent pas être marqués secrets afin d'éviter les faux positifs de Secret Scanning.
- Les données TheSportsDB sont traitées comme une source externe : elles alimentent les champs source, tandis que `manual_overrides` permet de préserver les corrections Bleus 3000.
