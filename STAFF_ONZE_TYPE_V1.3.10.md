# 3615 Bleus — V1.3.10 — ONZE TYPE d’un sélectionneur

## Principe
Le module **ONZE TYPE** est affiché dans chaque tuile Staff correspondant à un sélectionneur. Il reconstruit statistiquement les joueurs les plus régulièrement titularisés par ce sélectionneur à partir des feuilles de match France A masculine. Il ne mesure pas la qualité des joueurs et ne stocke aucun Onze manuel.

## Sources
- `matches.coach_id` ;
- `match_appearances.starter`, `appeared`, `position_id`, `position`, `minutes`, buts et passes ;
- `football_positions` ;
- `tactical_formations` / `tactical_formation_slots` ;
- compétitions et dates des matchs ;
- photos existantes du référentiel Joueurs.

## Calcul
Le RPC public `get_staff_best_xi_data(staff_id,start_date,end_date,competition_key)` renvoie un JSON compact contenant joueurs, titularisations, postes observés, couverture, années et compétitions disponibles. Le frontend réalise une affectation déterministe sans doublon des joueurs aux emplacements compatibles.

Les critères sont, dans l’ordre : titularisations au poste, minutes lorsqu’elles sont suffisamment fiables, matchs joués puis dernière titularisation. Aucun joueur n’est placé à un poste auquel il n’a jamais été observé dans une feuille.

## Données historiques incomplètes
La base actuelle contient très peu de postes historiques renseignés. Le module refuse donc d’inventer un Onze tactique à partir du poste général de la fiche joueur. Lorsque la couverture des postes est insuffisante, il affiche le classement des titularisations et un avertissement de couverture.

Une formation exacte n’est affichée que si sa couverture est suffisante. Sinon, lorsque 11 postes observés permettent de reconstruire les lignes, une structure générique Gardien / Défense / Milieu / Attaque est utilisée sans prétendre connaître une formation exacte.

## Filtres
- toute la période ;
- année ;
- intervalle de dates ;
- compétition.

## Cache
Résultats mis en cache localement par sélectionneur + filtres pendant 6 h. Le cache est invalidé lorsque des données Matchs, Apparitions, Joueurs, Postes, Compétitions ou Personnel changent. Le RPC est marqué en lecture seule dans la couche Cache First afin de ne pas invalider la base locale après une simple consultation.

## iPhone
Le module est responsive, tactile, sans largeur fixe, avec photos miniatures lazy-loaded et détail par poste en une colonne sur petit écran.
