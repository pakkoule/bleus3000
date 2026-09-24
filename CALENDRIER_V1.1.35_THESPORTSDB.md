# Calendrier Bleus 3000 — V1.1.35 · TheSportsDB

## Architecture

`TheSportsDB → Netlify Functions → Supabase public.matches → Référentiel Matchs + Calendrier`

Il n’existe plus deux bases parallèles pour les matchs. Le référentiel et le calendrier lisent la même table Supabase.

## Synchronisation

Une seule fonction : `netlify/functions/calendar-sync.js`. Elle est planifiée toutes les 6 heures et peut être déclenchée manuellement avec **Run now**.

Elle :
1. charge le mapping TheSportsDB des sélections ;
2. tente de découvrir les catégories encore sans ID ;
3. récupère les prochains et derniers matchs ;
4. rattache adversaires, compétitions et stades ;
5. évite les doublons en utilisant `idEvent` ;
6. enrichit progressivement les diffusions TV ;
7. ne crée pas une deuxième fiche quand un match historique Bleus 3000 correspondant existe déjà.

Le mapping connu est stocké dans `selection_teams.provider_ids`. France U21 (`136843`) et France U23 (`143161`) pointent toutes deux vers `FRA-ESP-M` / **Espoirs**.

## Correction manuelle sans perdre la synchro

`matches.manual_overrides` contient seulement les champs que l’éditeur a réellement corrigés.

Exemple : TheSportsDB remonte le mauvais stade. L’éditeur modifie uniquement `venue_name`. Le calendrier affiche la valeur manuelle ; TheSportsDB peut continuer à mettre à jour l’heure, le score, le statut live et la diffusion.

Le bouton **Revenir aux données source** vide ces corrections pour le match.

`data_state = locked` conserve son sens plus fort : la ligne entière n’est plus écrasée par la synchronisation serveur.

## Affichage

Format liste :
- ligne 1 : date et heure françaises en gras ;
- ligne 2 : équipes, drapeaux, score ;
- ligne 3 : stade et ville en italique ;
- ligne 4 : 📺 diffusion, lien internet éventuel, tag sélection, tag compétition.

Pendant un match couvert par TheSportsDB, un point vert lumineux/pulsant affiche **LIVE** avec la minute/progression.

## Référentiel Matchs

La grille utilise toute la largeur disponible. Les filtres sont : sélection, masculin/féminin, compétition, année et résultat. Les dates ISO brutes ne sont plus affichées.

## Variables Netlify

- `THESPORTSDB_KEY` — secret, clé Premium TheSportsDB.
- `SUPABASE_URL` — non secret.
- `SUPABASE_SECRET_KEY` — secret.
- `BLEUS_SPORTSDB_TEAM_MAP` — facultatif, non secret, pour surcharger/compléter le mapping sans modifier le code.
- `SPORTSDB_TV_ENRICH_LIMIT` — facultatif, défaut 12.

Les anciennes variables `API_FOOTBALL_KEY` et `BLEUS_API_TEAM_MAP` ne sont plus utilisées par V1.1.35 et peuvent être supprimées de Netlify.
