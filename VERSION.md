# Bleus 3000 — V1.1.36

## Tags globaux + drapeaux SVG
- Le calendrier affiche désormais les vrais tags Bleus 3000 liés aux sélections : **INTERNATIONAL**, **ESPOIRS**, U20, U19, U18, U17, U16 et leurs équivalents féminins.
- Les 14 sections disposent d'un tag global dans `public.tags` et d'une liaison `selection_teams.team_tag_id`.
- Les 42 compétitions présentes au moment de la migration disposent désormais elles aussi d'un tag global modifiable.
- Toute nouvelle compétition créée par `calendar-sync` reçoit automatiquement son tag de compétition.
- Les tags globaux restent modifiables dans **Profil > Tags & étiquettes** et leurs changements se répercutent dans Matchs et Calendrier.
- La fenêtre **Modifier le match** permet de surcharger, uniquement pour ce match, le tag de section et le tag de compétition via `matches.manual_overrides`.
- L'option **Automatique** revient au tag global de la sélection / compétition ; **Revenir aux données source** supprime toutes les corrections manuelles du match.
- Les drapeaux emoji du calendrier sont remplacés par des drapeaux **SVG ISO** avec résolution automatique des noms français/anglais et des catégories Uxx/féminines.
- Le référentiel Matchs utilise également ces drapeaux SVG.
- Migration Supabase `v1_1_36_tags_drapeaux` appliquée sur le projet Bleus 3000.

## TheSportsDB
- Un seul `calendar-sync` / un seul **Run now**.
- Livescore via `/api/sportsdb-live`.
- Les corrections manuelles restent prioritaires sur les données TheSportsDB, champ par champ.
