# Bleus 3000 V1.1.36 — Tags calendrier & drapeaux SVG

## Tags de section
Le calendrier ne fabrique plus une étiquette à partir du nom brut de la sélection.
Il lit `selection_teams.team_tag_id` puis le tag correspondant dans `public.tags`.

Exemples :
- `FRA-A-M` → `INTERNATIONAL`
- `FRA-ESP-M` → `ESPOIRS`
- `FRA-U17-M` → `U17`
- `FRA-A-F` → `INTERNATIONALE F`

Les 14 sections masculines et féminines disposent désormais d'un tag global.

## Tags de compétition
Chaque ligne de `public.competitions` possède désormais `tag_id`.
La migration V1.1.36 a généré un tag pour toutes les compétitions déjà présentes.
Le synchroniseur TheSportsDB génère automatiquement le tag d'une nouvelle compétition lorsqu'il crée cette compétition.

## Modification globale
Les tags de section et de compétition sont éditables depuis :

**Profil → Tags & étiquettes**

Le texte, l'icône, les couleurs, la bordure et l'association au référentiel restent configurables.
Une modification globale se répercute dans le référentiel Matchs et dans le Calendrier.

## Modification d'un match uniquement
Dans **Calendrier → Modifier**, deux sélecteurs ont été ajoutés :
- Tag de section
- Tag de compétition

Une valeur choisie est enregistrée dans `matches.manual_overrides`.
Elle n'altère donc pas le tag global et ne sera pas écrasée par la synchronisation TheSportsDB.
`Automatique` supprime la surcharge du tag concerné.

## Drapeaux SVG
Le calendrier et le référentiel Matchs n'utilisent plus les emoji de drapeaux du système.
`Bleus_3000_V136_flags.js` normalise les noms d'équipes (U17, U21, Women, etc.), retrouve le code pays ISO et affiche un fichier SVG.
Le catalogue couvre les codes ISO pays/territoires ainsi que Angleterre, Écosse, Pays de Galles et Irlande du Nord.

Les SVG sont servis depuis la collection `flag-icons` épinglée en version 7.3.2 afin d'éviter les différences d'affichage entre Windows, macOS, Android et iOS.
