# 3615 Bleus — GitHub / Netlify / Supabase

## Mise à jour du site existant

Pour mettre à jour le site de production :

1. remplacer le contenu du dépôt GitHub par le contenu complet du ZIP ;
2. laisser Netlify redéployer ;
3. conserver les variables Netlify existantes : `THESPORTSDB_KEY`, `SUPABASE_SECRET_KEY` et `SUPABASE_URL` ;
4. **ne pas exécuter `SUPABASE_BASELINE.sql` sur la base de production existante**.

Les fonctions Netlify restent configurées par `netlify.toml` :

- `calendar-sync` : toutes les 6 heures ;
- `match-sheet-sync` : toutes les 3 minutes.

## Nouvelle instance Supabase

Pour créer une base neuve :

1. créer le projet Supabase ;
2. exécuter **une seule fois** `SUPABASE_BASELINE.sql` dans SQL Editor ;
3. renseigner dans `bleus_config.js` uniquement l’URL Supabase et la clé publique/publishable nécessaires au navigateur ;
4. créer le premier compte 3615 Bleus : le baseline le transforme automatiquement en `superadmin` ;
5. restaurer/importer séparément les données de production si nécessaire.

Le baseline ne contient pas les joueurs, matchs, photos et autres données de production.

## Sécurité

Ne jamais placer dans `bleus_config.js` :

- `SUPABASE_SECRET_KEY` ;
- une clé `service_role` ;
- `THESPORTSDB_KEY`.

Ces secrets doivent rester dans les variables d’environnement Netlify.

## Fichiers à conserver

- `index.html`, `404.html`, `mentions-legales.html` ;
- `Bleus_3000_*.js` et `Bleus_3000_*.css` ;
- `bleus_config.js` ;
- `SUPABASE_BASELINE.sql` ;
- `netlify.toml`, `_headers`, `.gitignore`, `.env.example` ;
- `site.webmanifest`, favicons et icônes ;
- `assets/`, `flocages_assets/`, `netlify/`.


## V1.1.82

`SUPABASE_BASELINE.sql` inclut désormais `competition_entities.icon_text`. La production bleus3000 a déjà reçu cet ajout. V1.1.82 ne nécessite aucune migration supplémentaire.


## V1.1.89
La production `bleus3000` a déjà reçu les colonnes de personnalisation avancée des surlignages pays ainsi que `logo_path` sur `competition_entities` et `competition_editions`. Le `SUPABASE_BASELINE.sql` inclut ces changements pour une installation neuve.

## V1.2.2

La production `bleus3000` a déjà reçu `death_date` sur `players` et `personnel`, avec une contrainte empêchant une date de décès antérieure à la date de naissance. `SUPABASE_BASELINE.sql` inclut ces champs pour toute nouvelle installation.




## Mise à niveau V1.2.7

Pour une base existante, exécuter **`MIGRATION_V1.2.7_PHOTO_COPYRIGHT_BALLS.sql`** dans le SQL Editor Supabase avant de déployer le frontend V1.2.7.

Cette migration :

- ajoute les champs de copyright photo ;
- crée `football_balls` et `match_balls` ;
- reprend automatiquement les anciens médias de type `ball` dans le nouveau référentiel ;
- maintient la synchronisation pour les futurs médias ballon ajoutés depuis les feuilles de match.

`SUPABASE_BASELINE.sql` contient déjà ces changements pour une nouvelle installation.

## Mise à niveau V1.2.6

La V1.2.6 ajoute uniquement des calculs et composants frontend pour les statistiques de XI. **Aucune nouvelle migration SQL n’est nécessaire.** Si la base n’a pas encore reçu la V1.2.5, exécuter d’abord `MIGRATION_V1.2.5_SHEET_RELIABILITY.sql`.

## Mise à niveau V1.2.5

Pour une base existante, exécuter **`MIGRATION_V1.2.5_SHEET_RELIABILITY.sql`** dans le SQL Editor Supabase avant de déployer le frontend V1.2.5. Cette migration ajoute la ville de feuille, la numérotation canonique, les triggers de revalidation et la validation transactionnelle.


## Mise à niveau V1.2.10

Pour une base existante, exécuter **`MIGRATION_V1.2.10_COLLECTIONS_QUICK_VALIDATION.sql`** dans le SQL Editor Supabase avant de déployer le frontend V1.2.10.

Cette migration :

- crée le référentiel `books` ;
- ajoute les champs vidéo aux buts et la table `goal_ratings` pour les notes 1–100 ;
- crée `panini_albums` et `panini_stickers` ;
- ajoute les RPC sécurisées de validation rapide des feuilles déjà complètes.

L’import d’un rassemblement vers une feuille de match réutilise les tables `callups`, `callup_matches` et `callup_players` déjà présentes et ne demande pas de table supplémentaire.

`SUPABASE_BASELINE.sql` contient déjà ces changements pour une nouvelle installation.


## V1.2.10.2 — Vidéos de buts
Sur une base existante, exécuter `MIGRATION_V1.2.10.2_GOAL_VIDEO_UPLOAD.sql` afin de créer le bucket Supabase Storage `goal-videos` et ses politiques RLS.


## Migration V1.2.10.6 — Photo d’équipe

Avant d’utiliser **Médias → Photo d’équipe**, exécuter `MIGRATION_V1.2.10.6_TEAM_PHOTO_MEDIA.sql` sur le projet Supabase. Cette migration étend la contrainte de `match_media_assets.asset_type` avec la valeur `team_photo`.
