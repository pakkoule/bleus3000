# Bleus 3000 — V1.1.33

## Correctif API-Football : calendrier + limite FREE
- Remplacement de la requête `team + from + to` par `team + next=50`, ce qui évite l’erreur API-Football « The Season field is required ».
- Le mapping de 14 IDs API-Football est réparti automatiquement en 2 shards de 7 requêtes.
- `calendar-sync` tourne à H:00 et `calendar-sync-b` à H:02 toutes les 6 heures afin de rester sous la limite FREE de 10 requêtes/minute.
- Le diagnostic sécurisé des variables Netlify reste actif (booléens uniquement, aucune clé affichée).
- Support multi-ID Espoirs conservé : `FRA-ESP-M: [8194,16621]`.
- Aucun changement de schéma Supabase.
