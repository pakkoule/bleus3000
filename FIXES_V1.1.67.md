# 3615 Bleus — V1.1.67

## Rassemblements — matchs historiques
- Le sélecteur de matchs n'utilise plus un checkbox natif fragile : chaque ligne est un contrôle explicite qui bascule son état de sélection.
- Tous les matchs France A chargés dans le référentiel sont affichables et sélectionnables, passés comme futurs.
- La recherche porte sur adversaire, compétition, date et année sans limiter les résultats aux matchs à venir.

## Tenue de match — short
- Le choix du short dans la feuille de match ne dépend plus exclusivement des shorts pré-associés au maillot.
- Les shorts compatibles avec le maillot sont proposés en premier.
- Si aucun short n'est lié, toute la bibliothèque de shorts reste sélectionnable.
- Le choix continue d'être enregistré dans `match_jerseys.short_component_id`.

## Points du schéma de formation
- Couleur 1 : première moitié / couleur principale du point.
- Couleur 2 : seconde moitié / deuxième couleur du point.
- Couleur 3 : contour et halo lumineux uniquement.
- La couleur 3 est stockée dans le premier élément de `jerseys.accent_colors` et n'est pas utilisée par les couleurs pays/scoreboard.

## Couleurs des pays
- Ajout d'un mode `Uni` / `Dégradé`.
- Angle de dégradé configurable de 0 à 360°.
- Migration non destructive : `MIGRATION_V1.1.67_COUNTRY_GRADIENTS.sql`.
- La production `bleus3000` a déjà reçu cette migration pendant la préparation de la V1.1.67.
