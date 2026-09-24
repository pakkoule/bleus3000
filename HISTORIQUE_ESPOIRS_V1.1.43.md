# 3615 Bleus V1.1.43 — Pilote historique Espoirs / TheSportsDB

Cette version ajoute la fonction Netlify manuelle `history-espoirs`.

## Objectif

Tester réellement la couverture historique de TheSportsDB sur France Espoirs/U21 sans écraser le référentiel existant.

## Sécurité éditoriale

- cible uniquement `FRA-ESP-M` ;
- utilise les Team IDs TheSportsDB U21 + U23 déjà connus ;
- parcourt les saisons disponibles des compétitions U21/amicales détectées ;
- rapproche les événements sur **date + adversaire** ;
- rattache l'ID TheSportsDB aux matchs existants ;
- ne complète que les champs vides : score, stade et phase ;
- respecte les lignes `locked` ;
- **n'insère pas** les événements distants sans correspondance locale lors de ce pilote.

## Audit de données détaillées

Sur les 6 matchs matchés les plus récents (modifiable avec `ESPOIRS_HISTORY_DETAIL_LIMIT`), la fonction teste également :

- compositions ;
- timeline ;
- statistiques de match ;
- diffusions TV ;
- highlights vidéo.

Elle journalise le nombre de matchs pour lesquels chacun de ces blocs est réellement disponible.

## Exécution

Netlify → Functions → `history-espoirs` → **Run now**.

Le log final `3615bleus-history-espoirs` indique notamment :
`localMatches`, `remoteEvents`, `matched`, `attached`, `enrichedScores`, `enrichedVenues`, `unmatchedLocal`, `unmatchedRemote`, `detail`, `apiRequests`.

Aucune nouvelle variable n'est obligatoire : la fonction réutilise `THESPORTSDB_KEY`, `SUPABASE_URL` et `SUPABASE_SECRET_KEY`.
