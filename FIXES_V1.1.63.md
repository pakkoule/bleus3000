# 3615 Bleus — Correctifs V1.1.63

## Interface
- Poppins forcée sur toute l’interface du site.
- Suppression de l’espace vide supérieur du header.

## Maillots / schéma de formation
- Ajout dans l’éditeur d’un maillot d’une palette de points tactiques de 1 à 5 couleurs.
- Réutilisation des colonnes Supabase existantes `primary_color`, `secondary_color` et `accent_colors` : aucune migration nécessaire.
- Aperçu de la palette directement sur la tuile maillot et dans le sélecteur de la feuille de match.
- Les points du schéma de formation utilisent automatiquement la palette du maillot sélectionné.
- Changer de maillot met à jour immédiatement les points du terrain.

## Rassemblements
- Remplacement des `<details>` natifs de « Liste annoncée » et « Historique des modifications » par des accordéons contrôlés.
- L’état ouvert/fermé est conservé lors des réinjections de contenu dans la tuile.
- Les événements récents affichent le nom du joueur concerné.
- Les remplacements affichent clairement `joueur sortant ➜ joueur entrant`.
