# 3615 Bleus V1.3.9 — Le Bleu Moyen

## Principe
`LE BLEU MOYEN` est un international fictif dérivé exclusivement des référentiels existants de l'Équipe de France masculine A. Un joueur entre dans la population lorsqu'il possède au moins une apparition réelle (`starter` ou `appeared`) dans un match `FRA-A-M`. Les joueurs seulement convoqués sont exclus.

## Calcul serveur compact
La migration `migration déjà appliquée directement sur le projet Supabase` ajoute :
- `bleu_moyen_player_metrics()` : carrière dérivée joueur par joueur depuis les feuilles de match ;
- `get_bleu_moyen_stats(start_year,end_year)` : moyenne, médiane, P25, P75, couverture, qualité et évolution historique dans un seul JSON ;
- `get_bleu_moyen_player_comparison(player_id)` : comparaison individuelle et percentiles réels ;
- `bleu_moyen_stats_version()` : empreinte des données ayant un impact sur le module.

Aucune table statistique parallèle n'est créée : les fonctions lisent les tables existantes.

## Population et époques
- GLOBAL
- 1904–1939
- 1940–1969
- 1970–1997
- 1998–2011
- 2012–année courante

L'époque d'un joueur est déterminée par l'année de sa première sélection.

## Qualité des données
- couverture >= 80 % : affichage normal ;
- 50 à 80 % : mention `Données partielles` ;
- < 50 % : valeur masquée par défaut.

Les statistiques spécifiques à une sous-population (ex. première sélection du premier but parmi les buteurs) affichent explicitement le nombre de joueurs concernés.

## Interface
L'onglet `👤 Bleu moyen` devient le premier onglet de Statistiques et n'entraîne pas le chargement de l'ancien dataset statistique lourd. Le RPC renvoie actuellement environ 7,5 Ko pour la vue globale, puis le résultat est mis en cache dans `localStorage` pendant 12 h.

Le module comprend :
- fiche fictive + silhouette 3615 ;
- principales moyennes ;
- carrière type ;
- moyenne/médiane/P25/P75 ;
- indicateurs de couverture ;
- graphique et tableau d'évolution historique ;
- comparaison automatique sur la fiche d'un joueur ;
- percentiles ;
- intégration à la Recherche 3615 (`Bleu moyen`, `Kopa bleu moyen`, etc.).

Le cache est invalidé dans le navigateur lors des événements `bleus:data-mutated` concernant joueurs, matchs, feuilles, faits, compétitions, personnel ou lieux.
