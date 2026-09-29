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
