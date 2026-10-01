# 3615 Bleus — V1.3.1 — Indice « Équipe type »

## Objet

L’indice mesure la représentativité du XI titulaire par rapport à la hiérarchie réellement observable du sélectionneur à la date exacte du match. Il ne mesure ni la force du XI, ni sa performance, ni sa probabilité de victoire.

## Principe temporel

Pour un match à la date D, le statut des joueurs n’utilise que des matchs strictement antérieurs à D. Le résultat du match évalué n’entre jamais dans le calcul. La proximité d’une compétition majeure peut consulter uniquement le calendrier futur (dates + type de compétition), jamais les compositions, résultats ou performances futurs.

## Stockage

Colonnes ajoutées à `public.matches` :

- `team_type_score_raw numeric(7,4)` : score brut 0.0000–100.0000 ;
- `team_type_confidence numeric(5,2)` : confiance distincte du score ;
- `team_type_details jsonb` : sous-scores, contexte, paramètres et avertissements ;
- `team_type_model_version text` ;
- `team_type_calculated_at timestamptz`.

Le frontend arrondit uniquement pour l’affichage (`Math.round`) et utilise la valeur brute pour la progression de l’anneau.

## Formule V1.0.0

Score final :

- noyau / utilisation sous le sélectionneur : 30 % ;
- grands matchs : 20 % ;
- contexte compétition comparable : 15 % ;
- continuité du XI : 15 % ;
- expérience internationale antérieure : 10 % ;
- phase du mandat : 7 % ;
- capitanat / hiérarchie : 3 %.

Tous les paramètres sont centralisés dans `team_type_model_config()`.

### Récence

Pour chaque ancien match du sélectionneur :

`poids = exp(-0.00275 × jours) × exp(-0.07 × rang_récent)`

Fenêtre : 1 100 jours et maximum 24 matchs antérieurs du sélectionneur. La transformation du signal joueur est continue :

`score_joueur = 100 × signal^0.72`

Une titularisation vaut davantage qu’une entrée, et une simple présence dans le groupe vaut moins qu’une entrée.

### Importance du match

Coefficient centralisé, basé sur le type de compétition et la phase lorsqu’elle est réellement renseignée :

- amical : base 0.30 ;
- qualification : 0.64 ;
- Ligue des Nations / ligue : 0.70 ;
- tournoi : 0.72 ;
- olympique : 0.76 ;
- phase finale majeure : minimum 0.80–0.82 ;
- huitième / quart / demi / finale : bonus progressifs jusqu’à 1.00.

Aucune phase manquante n’est inventée.

### Contexte compétition

Le sous-score compare l’utilisation du joueur dans des matchs antérieurs dont l’enjeu est proche du match évalué. La proximité d’une Coupe du Monde / EURO peut renforcer le contexte avec une décroissance `exp(-jours/120)` lorsque le calendrier permet de l’établir.

### Continuité

75 % : recouvrement pondéré des trois XI précédents (55 / 30 / 15 %).

25 % : récurrence des paires de joueurs dans les dix derniers XI complets.

### Expérience

Uniquement les sélections et titularisations antérieures au match : saturation continue par exponentielle, jamais le total final de carrière.

### Capitanat

Historique du brassard sous le même sélectionneur, pondéré par récence et importance du match. Un léger signal supplémentaire est possible lorsque d’autres capitaines historiques sont présents, mais ce bloc reste limité à 3 % du score final.

### Phase du mandat

- 0–1 match antérieur : début de mandat ;
- 2–5 : construction ;
- 6–15 : stabilisation ;
- 16+ : maturité.

Le sous-score converge progressivement vers le score de noyau à mesure que les choix du sélectionneur deviennent observables. Le premier match n’est donc pas artificiellement présenté comme une hiérarchie déjà connue.

## Confiance du calcul

La confiance ne modifie jamais le score. Elle dépend de :

- quantité de matchs antérieurs du sélectionneur ;
- complétude des XI historiques récents ;
- expérience antérieure connue des 11 titulaires ;
- disponibilité du capitaine ;
- rattachement compétition/édition.

Sous 60, l’interface affiche `DONNÉES PARTIELLES`.

## Recalculs

- `recalculate_team_type_match(uuid)` : un match ;
- `recalculate_team_type_from_match(uuid)` : match modifié + matchs suivants du même mandat ;
- `recalculate_team_type_for_manager_from(text, uuid, timestamptz)` : plage chronologique ciblée d’un sélectionneur.

Le trigger `trg_team_type_after_validation` se déclenche uniquement lorsqu’une feuille validée change de révision. Une simple consultation n’effectue aucun calcul.

## Cas historiques

`sheet_coach_name` est utilisé quand `coach_id` n’est pas encore relié. Les noms sont normalisés avec `sheet_name_key`, ce qui regroupe par exemple les différences de casse. `Comités de sélection` est segmenté par année afin de ne pas reconstruire une fausse hiérarchie unique sur plusieurs décennies.

Un match sans exactement 11 titulaires reliés n’obtient pas de faux score. Son état reste partiel jusqu’à ce que les données nécessaires soient complétées.

## Interface

La tuile match reçoit un anneau tactile de 54–58 px : valeur arrondie au centre, progression basée sur le brut et couleur continue rouge → violet → bleu. Le tap/clic ouvre une popover ou un bottom sheet iPhone contenant les sous-scores persistés. Aucune requête Supabase n’est déclenchée par cette ouverture.

## Extensions d’interface V1.3.1
- **Statistiques → Records** affiche le match ayant le plus fort `team_type_score_raw`. Le classement utilise la valeur brute à 4 décimales ; l’affichage reste un indice sur 100.
- **Navigation → Matchs** propose un tri `Équipe type : décroissant` ou `Équipe type : croissant`. Les matchs sans indice sont toujours placés après les matchs calculés afin de ne pas fausser l’ordre.
