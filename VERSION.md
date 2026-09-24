# Bleus 3000 — V1.1.34

## Correctif API-Football — plan Free
- Remplacement de `team + next=50` (indisponible sur le plan Free) par `team + season`.
- Saison par défaut : année courante ; surcharge facultative via `API_FOOTBALL_SEASON`.
- Filtrage local des fixtures pour synchroniser uniquement les matchs à venir ou en cours et éviter les doublons avec l'historique éditorial.
- Mapping de 14 IDs API-Football réparti en 2 shards de 7 requêtes.
- `calendar-sync` à H:00 et `calendar-sync-b` à H:02 toutes les 6 heures pour rester sous la limite FREE de 10 requêtes/minute.
- Diagnostic sécurisé des variables Netlify conservé.
- Support multi-ID Espoirs conservé : `FRA-ESP-M: [8194,16621]`.
- Aucun changement de schéma Supabase.
