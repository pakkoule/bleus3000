# 3615 Bleus — V1.1.65

## Rassemblements

- Les compteurs `forfaits` et `remplacements` ne reposent plus uniquement sur le statut courant de `callup_players`.
- Un événement `replacement` compte comme un remplacement **et** comme le forfait du joueur sortant.
- Un événement `withdrawal` compte comme un forfait.
- Les événements `withdrawal`, `replacement` et `reinforcement` sont intégrés à l'accordéon **Historique des modifications**.
- Le bloc d'accueil récapitulant les forfaits tient compte des événements historiques.
- `MIGRATION_V1.1.65_GATHERING_EVENT_HISTORY_LINKS.sql` backfill les événements existants dans `callup_roster_history` sans supprimer ni modifier les événements.

## Import PDF FFF

Lorsqu'un nom détecté n'a pas de correspondance satisfaisante, le contrôle d'import propose **Créer la tuile joueur**.

La création :

- reprend le nom et la date de naissance du PDF ;
- crée ou rattache le joueur dans `players` ;
- crée son contexte `FRA-A-M` dans `player_selection_stats` avec le statut `called_only` ;
- marque le joueur comme appelé en France A ;
- recharge le registre joueurs ;
- sélectionne automatiquement la nouvelle tuile dans la ligne du PDF.

Le groupe FFF (Gardien / Défenseur / Milieu / Attaquant) reste une information du rassemblement et ne crée pas artificiellement un poste détaillé sur la fiche joueur.
