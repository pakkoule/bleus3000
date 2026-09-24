# 3615 Bleus — V1.1.40

## Correctif Tags Compétitions → Calendrier
- Ajout d'une portée persistante `reference_scope` aux tags (`selection`, `competition`, `general`).
- Un tag créé pour le référentiel **Compétitions** apparaît maintenant dans les listes de tags du calendrier, même si son association vient juste d'être créée.
- Après sauvegarde d'un tag, le référentiel relationnel est invalidé puis rechargé immédiatement avant le rafraîchissement du calendrier.
- En cas d'échec lors de la création automatique d'une nouvelle compétition, le tag nouvellement créé est nettoyé afin d'éviter un tag orphelin.
- Le tag existant **TOURNOI INTERNATIONAL DE LIMOGES** a été réparé et rattaché à une vraie entrée Compétitions.

## Héritage V1.1.39
- Familles de compétitions partagées : Match Amical, Euro U21, Qualif EURO U21, Coupe du monde U17, Coupe du monde U17 F, Ligue des Nations.
- Association tag sélection → contexte statistique joueur automatique.
- Référentiel Statistiques relationnel.
- Accomplissements sans limite applicative.

## Base de données
La migration `v1_1_40_tag_reference_scope_calendar_link` est déjà appliquée au projet Supabase de production.
Le fichier `MIGRATION_V1.1.40_TAG_SCOPE_CALENDAR.sql` documente la structure cible.
