# Bleus 3000 — Calendrier V1.1.30

## Affichage
- Bloc **Prochains matchs** directement sur l'accueil (5 prochains matchs).
- Icône calendrier dans la barre d'outils.
- Calendrier complet sous forme de **liste**, avec onglets À venir / Matchs passés et filtre par sélection.
- Chaque ligne affiche : date/heure, équipes + drapeaux emoji/SVG natifs, stade/ville, diffusion TV, lien internet éventuel, tag sélection et tag compétition.
- La diffusion et son URL sont éditables par les rôles `editor`, `admin` et `superadmin`.

## Données
Le calendrier lit directement `public.matches` : les matchs historiques déjà présents ne sont donc pas dupliqués. Les futurs matchs API sont ajoutés dans cette même table avec `provider='api-football'` et un identifiant fournisseur unique.

## Synchronisation API-Football
La fonction Netlify `calendar-sync` tourne toutes les 6 heures en production. Elle nécessite les variables Netlify suivantes :
- `API_FOOTBALL_KEY` : clé API-Football/API-Sports.
- `SUPABASE_URL` : URL du projet Supabase.
- `SUPABASE_SECRET_KEY` : clé serveur Supabase **secrète**, jamais exposée au navigateur.
- `BLEUS_API_TEAM_MAP` : objet JSON associant les codes Bleus 3000 aux IDs d'équipes API-Football, par exemple `{"FRA-A-M":2,"FRA-ESP-M":1234,"FRA-U17-M":5678}`. Les IDs doivent être vérifiés dans API-Football avant activation.

La fonction ne modifie jamais un match `data_state='locked'`. Les champs éditoriaux de diffusion ne sont pas écrasés par la synchro.

## Suite prévue
Le même `provider_fixture_id` servira à rattacher les lineups, joueurs et événements de but à `match_appearances` / `match_goal_events`, puis à recalculer les compteurs joueurs sans incréments fragiles.


## Correctif V1.1.31 — plusieurs IDs API pour une sélection
Le mapping peut contenir soit un ID simple, soit un tableau. Exemple :
```json
{
  "FRA-A-M": 2,
  "FRA-ESP-M": [8194,16621]
}
```
Les deux IDs sont synchronisés vers la même sélection Bleus 3000. Les fixtures restent dédoublonnées grâce à `provider + provider_fixture_id`.
