# Bleus 3000 — V1.1.35

## Calendrier TheSportsDB + corrections éditoriales
- TheSportsDB remplace API-Football.
- Synchronisation unique `calendar-sync` toutes les 6 heures + un seul `Run now`.
- Livescore via `/api/sportsdb-live`, rafraîchi côté interface toutes les 2 minutes.
- Matchs passés et futurs lisent la même table `public.matches`.
- Les 226 matchs Espoirs historiques sont donc visibles dans le calendrier passé.
- Référentiel Matchs : grille réparée + filtres sélection/sexe/compétition/année/résultat.
- Corrections manuelles champ par champ dans `matches.manual_overrides` : l’API peut continuer à mettre à jour les autres champs sans écraser la correction.
- Mapping TheSportsDB stocké dans `selection_teams.provider_ids`; U21 + U23 masculins restent regroupés sous `FRA-ESP-M`.
- Migration Supabase V1.1.35 appliquée sur le projet Bleus 3000.
