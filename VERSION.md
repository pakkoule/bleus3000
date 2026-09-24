# 3615 Bleus — V1.1.46

## Jeux Olympiques 2024 — import France U23

- Import automatique des 6 matchs de la France U23 aux Jeux Olympiques de Paris 2024 depuis TheSportsDB.
- Les matchs restent techniquement dans `FRA-ESP-M` pour préserver la structure existante.
- Le tag de section affiché est `OLYMPIQUE U23`, distinct du tag `ESPOIRS` des U21.
- Création/association de la compétition `Jeux Olympiques 2024` et du tag compétition `JEUX OLYMPIQUES`.
- Récupération : date/heure, adversaire, domicile/extérieur, score, phase, stade, affluence quand disponible, IDs fournisseur et payload source.
- Déduplication par ID TheSportsDB puis par date + adversaire.
- Les lignes `locked` ne sont jamais écrasées ; les données existantes sont uniquement complétées quand elles sont vides.
- L'import est lancé automatiquement au prochain `calendar-sync` et devient ensuite un no-op dès que les 6 matchs sont présents.
- Une fonction manuelle `import-olympique-u23` reste disponible pour contrôle/réimport.

La migration Supabase V1.1.46 a déjà été appliquée au projet courant.
