# 3615 Bleus V1.1.39 — Référentiel Statistiques

Le référentiel **Statistiques** est désormais alimenté par les tables relationnelles Supabase et non par les anciennes tuiles de démonstration.

## Filtres disponibles
- Classement : Buteurs / Capitanat / Sélections.
- Sexe : Mixte / Masculin / Féminin.
- Section : toutes les sélections ou une sélection précise.
- Compétition : toutes ou une compétition précise.
- Vue : classement joueurs / par sélection / par compétition / par match.

## Sources de calcul
- Buteurs généraux et sélections : `player_selection_stats`.
- Capitanat : `match_appearances.captain`.
- Détail des buts par match et compétition : `match_goal_events`.

Les vues événementielles par match/compétition sont affichées avec un indicateur de couverture car la collecte détaillée n'est pas encore complète pour tout l'historique.

## Tags de sélection → contexte statistique
Associer un tag de sélection à un joueur crée automatiquement, s'il n'existe pas, son enregistrement `player_selection_stats` pour cette sélection. Le contexte devient alors disponible dans le menu déroulant de la fiche joueur, son tag devient cliquable et le contexte GENERAL se recalcule par agrégation.

## Accomplissements
Aucune limite applicative n'est imposée au nombre d'accomplissements associés à un joueur. L'interface affiche et édite l'ensemble des accomplissements enregistrés.
