# 3615 Bleus — V1.1.44 — France U23 / Espoirs féminines

Source importée : `data/Bleus3000_Espoirs_Feminines_U23_2014_2026_V1.xlsx`.

## Contenu du référentiel fourni

- 72 matchs entre 2014 et 2026
- bilan source : 42 victoires / 11 nuls / 19 défaites
- 152 buts marqués / 76 encaissés
- 133 joueuses documentées
- 25 joueuses avec statistiques carrière U23 vérifiées FFF
- 152 observations joueuse-match
- 7 feuilles de match détaillées
- 22 événements de but détaillés
- 4 périodes de sélectionneur
- officiels connus sur plusieurs rencontres

Les cellules vides du classeur restent des valeurs inconnues : aucune sélection, aucun but, aucune minute, aucun numéro et aucun résultat individuel ne sont extrapolés.

## Intégration 3615 Bleus

Le tag existant `ESPOIRS F` (`FRA-U23-F`) est réutilisé. L'import ne crée pas une nouvelle section.

La fonction Netlify `import-u23f` :

1. réutilise les profils féminins existants quand le nom correspond ;
2. crée uniquement les joueuses absentes ;
3. associe les 133 joueuses au tag ESPOIRS F ;
4. alimente `player_selection_stats` avec les 25 lignes vérifiées et conserve les autres lignes « À compléter » sans inventer de valeur ;
5. importe les 72 matchs en `verified` ;
6. crée/réutilise adversaires, lieux, compétitions annuelles et sélectionneurs ;
7. rattache toutes les compétitions annuelles U23 F au tag global `Match Amical` ;
8. importe feuilles de match, capitanats, buts et officiels connus ;
9. rattache les URLs FFF aux entités via `sources` / `entity_sources` ;
10. conserve les deux conflits documentés dans le JSON source d'import.

## Lancer l'import

Après déploiement GitHub/Netlify :

`Functions → import-u23f → Run now`

La fonction est idempotente : les matchs portent `external_ids.u23f_v1_id`, les statistiques sont upsertées sur `(player_id, selection_id)` et les feuilles/buts utilisent leurs clés relationnelles existantes.
