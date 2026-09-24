# Diagnostic calendar-sync — V1.1.32

Après déploiement, lancer **Netlify > Functions > calendar-sync > Run now**.

Le log affiche une ligne JSON de ce type :

```json
{"event":"bleus3000-calendar-config","API_FOOTBALL_KEY":true,"SUPABASE_URL":true,"SUPABASE_SECRET_KEY":false,"BLEUS_API_TEAM_MAP_present":true,"BLEUS_API_TEAM_MAP_valid":true,"BLEUS_API_TEAM_MAP_entries":13}
```

Aucune valeur secrète n’est affichée. `false` indique exactement le réglage à corriger.
