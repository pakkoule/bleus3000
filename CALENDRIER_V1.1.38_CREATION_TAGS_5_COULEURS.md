# 3615 Bleus V1.1.38 — Création calendrier & tags 5 couleurs

## Ajouter un match
Ouvrir le calendrier puis utiliser **+ Ajouter un match**.

Champs disponibles :
- date et heure ;
- sélection ;
- domicile / extérieur ;
- adversaire ;
- stade et ville ;
- compétition ;
- tag de section et tag de compétition ;
- score facultatif ;
- diffusion TV et URL facultative.

Le classement est automatique : une date antérieure à l'heure courante est affichée dans **Matchs passés**, une date future dans **À venir**.

La création écrit directement dans `public.matches` et rattache l'entrée aux tables `opponents`, `competitions` et `places`. Une entrée créée manuellement reste modifiable avec le même éditeur que les matchs TheSportsDB.

## Dégradés de tags
Dans **Profil > Tags & étiquettes**, les deux premières couleurs constituent le dégradé de base. Les couleurs 3, 4 et 5 peuvent être activées individuellement. Le rendu CSS est un `linear-gradient()` utilisant tous les arrêts sélectionnés, dans leur ordre.

Les anciens tags à deux couleurs restent compatibles sans modification visuelle.
