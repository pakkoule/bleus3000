# 3615 Bleus — V1.3.4 · Recherche 3615 transversale locale

## Objectif
La recherche 3615 devient un moteur transversal de la base, sans agrandir graphiquement le champ de recherche et sans exécuter une requête Supabase à chaque caractère saisi.

## Index local
Le module `Bleus_3000_V134_search_index.js` construit un index relationnel local versionné (`1.3.4-search-v1`).

- restauration depuis IndexedDB au démarrage lorsqu'un index existe ;
- aucune reconstruction réseau imposée à chaque visite ;
- première construction complète au premier usage de la recherche si aucun index n'existe ;
- conservation de l'index dans IndexedDB ;
- invalidation automatique lorsque les tables concernées sont modifiées ;
- reconstruction après une modification ADMIN / SUPERADMIN ;
- les données sources continuent de passer par la couche Cache First V1.3.

Après la première construction, la majorité des requêtes sont donc résolues entièrement dans le navigateur.

## Référentiels indexés
Selon les données présentes dans Supabase :

- Joueurs ;
- Matchs ;
- Buts ;
- Rassemblements ;
- Compétitions ;
- Éditions ;
- Adversaires ;
- Stades / Lieux ;
- Villes ;
- Pays ;
- Sélectionneurs ;
- Staff ;
- Arbitres ;
- Maillots ;
- Équipementiers ;
- Ballons ;
- Médias de match et médias bibliographiques ;
- Bibliographie ;
- Accomplissements ;
- Panini.

## Relations Match
Un Match indexe notamment :

- adversaire ;
- date, mois et année ;
- score ;
- compétition et édition ;
- phase lorsque renseignée ;
- stade, ville, pays ;
- sélectionneur ;
- arbitre ;
- titulaires ;
- remplaçants ;
- joueurs entrés en jeu ;
- capitaine ;
- numéros ;
- postes ;
- buteurs et passeurs ;
- cartons ;
- remplacements ;
- maillot et couleurs ;
- ballon ;
- médias ;
- diffusion.

## Relations Joueur
Une fiche Joueur indexe notamment :

- prénom / nom / nom affiché ;
- date et année de naissance ;
- date et année de décès ;
- lieu de naissance ;
- postes ;
- sélections ;
- buts ;
- titularisations ;
- numéro d'international ;
- numéros portés ;
- accomplissements ;
- tags ;
- matchs ;
- adversaires ;
- compétitions / éditions ;
- stades / villes / pays ;
- capitanat ;
- buts et passes décisives associés.

## Langage naturel et multi-critères
Le moteur utilise des termes normalisés, une logique AND multi-critères et une tolérance contrôlée aux fautes de frappe.

Abréviations prises en charge :

- `cdm` → Coupe du Monde ;
- `edf` → Équipe de France ;
- `ldn` → Ligue des Nations ;
- `jo` → Jeux Olympiques ;
- `euro` → Championnat d'Europe / EURO ;
- `pd` → passe décisive ;
- `cap` → capitaine ;
- `tit` → titulaire.

Accents, casse, pluriels et ordre des mots sont neutralisés pour la recherche.

Exemples destinés à fonctionner localement lorsque les relations correspondantes sont renseignées :

- `Kopa but cdm` ;
- `Platini Euro 1984 but` ;
- `Platini Parc des Princes` ;
- `Zidane Brésil` ;
- `Mbappé capitaine 2025` ;
- `match France Italie Paris` ;
- `Platini numéro 10` ;
- `match maillot blanc` ;
- `buts Stade de France` ;
- `arbitre France Brésil 1998` ;
- `ballon France Argentine 2022` ;
- `maillot porté Allemagne` ;
- `rassemblement septembre 2026` ;
- `matchs Zidane Henry` ;
- `buts Platini Belgique`.

Le moteur n'invente jamais une phase, une relation ou une donnée historique absente de la base. Une recherche comme `finale Zidane` dépend donc du fait que la phase / le contexte « finale » soit effectivement renseigné dans les données disponibles.

## Résultats et ouverture
Les résultats sont regroupés par type. Les actions ouvrent directement le contexte utile :

- fiche Joueur ;
- match ciblé ;
- but précis dans la feuille ;
- rassemblement ciblé ;
- tuile de référentiel filtrée et surlignée ;
- détail local avec liens vers les matchs / joueurs lorsque le référentiel n'a pas de fiche publique autonome.

## Recherche statistique existante
La recherche statistique V1.2.9 est conservée pour les questions très spécifiques (records, tranches de minutes, doublés/triplés, etc.). La recherche V1.3.4 passe d'abord par l'index local et ne bascule vers le moteur statistique que lorsqu'il est réellement nécessaire.

## Base de données
Aucune nouvelle table, vue, colonne ou migration n'est nécessaire pour V1.3.4.
