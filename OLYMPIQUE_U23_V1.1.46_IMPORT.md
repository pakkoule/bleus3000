# OLYMPIQUE U23 — Import JO 2024 — V1.1.46

## Périmètre

TheSportsDB référence le tournoi masculin 2024 sous la compétition `Olympics Soccer` (`idLeague 5039`) et la France olympique sous `France U23` (`idTeam 143161`).

La V1.1.46 récupère le calendrier 2024 de cette compétition et conserve uniquement les événements auxquels participe France U23.

## Import

Les 6 rencontres attendues sont celles du tournoi olympique masculin de Paris 2024 : trois matchs de groupe, quart de finale, demi-finale et finale.

Les lignes sont stockées dans `matches` avec :

- `selection_team_id` = référentiel technique `FRA-ESP-M` ;
- override de tag de section = `OLYMPIQUE U23` ;
- compétition = `Jeux Olympiques 2024` ;
- fournisseur = `thesportsdb` ;
- `provider_fixture_id` = `idEvent` TheSportsDB.

La fonction complète date/heure, adversaire, domicile/extérieur, score, phase, stade et affluence lorsque le fournisseur les expose. Elle ne remplace jamais une ligne `locked` et ne remplace pas un champ métier déjà renseigné sur une ligne existante.

## Déclenchement

`calendar-sync` appelle l'import automatiquement avant sa synchronisation habituelle. Dès que les 6 matchs sont déjà liés, l'import est ignoré sans requête TheSportsDB supplémentaire.

Pour un contrôle manuel : `/.netlify/functions/import-olympique-u23`.
