# 3615 Bleus — V1.3.7 — Tuile Match / export complet

## Correctif Équipe type
Le chevauchement visuel du libellé `ÉQUIPE TYPE` provenait des sélecteurs génériques de la ligne `match-sheet-lineup-stats`, qui appliquaient les zones CSS Grid réservées aux blocs Âge/Sélections aux `<span>` internes de l’anneau.

La V1.3.7 limite ces règles aux enfants directs des deux cartes statistiques et impose une structure verticale stable à l’indice : cercle, libellé, puis éventuel avertissement de données partielles.

## Faits de match
Les faits sont désormais séparés en deux colonnes dans chaque feuille :
- France ;
- adversaire du match.

Buts et cartons utilisent `team_name` lorsqu’il est renseigné. Les événements liés à un joueur France restent rattachés à la colonne France. Les faits agrégés issus des apparitions françaises (cartons/passes sans événement détaillé) restent dans la colonne France.

## Export PNG Match
Le bouton PNG ne sérialise plus simplement la tuile d’écran telle quelle. Il construit un gabarit éditorial dédié de 1040 px avant rasterisation Retina.

L’export comprend :
- numéro du match ;
- date ;
- score et drapeaux ;
- compétition / phase ;
- stade / ville ;
- sélectionneur ;
- arbitre et diffusion lorsqu’ils existent ;
- indice Équipe type ;
- âge moyen du XI ;
- sélections moyennes ;
- titulaires ;
- remplaçants / groupe ;
- faits de match France / adversaire.

Les boutons d’administration, liens interactifs, médias et contrôles de navigation sont retirés du PNG.

Le moteur commun `BLEUS3000_EXPORT` reste chargé d’inliner les images et de neutraliser les pseudo-éléments/CORS avant rasterisation.
