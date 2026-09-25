# 3615 Bleus — GitHub / Netlify / Supabase

## Déploiement courant

Le projet Supabase de production `bleus3000` est déjà migré. Pour une mise à jour normale du site :

1. remplacer le contenu du dépôt GitHub par le package complet ;
2. laisser Netlify redéployer ;
3. conserver les variables Netlify existantes (`THESPORTSDB_KEY`, `SUPABASE_SECRET_KEY`, `SUPABASE_URL`) ;
4. ne pas exécuter `SUPABASE_BASELINE.sql` sur la base de production existante.

`calendar-sync` reste planifié toutes les 6 heures et peut être lancé manuellement depuis Netlify si nécessaire.

## Nouveau projet Supabase

Le package ne contient plus les migrations historiques individuelles. Elles ont été consolidées dans un fichier unique :

- `SUPABASE_BASELINE.sql` — schéma cumulatif Bleus 3000 (tables, fonctions, RLS, policies, buckets et données bootstrap prévues par les migrations historiques) ;
- `SUPABASE_FIRST_ADMIN.sql` — aide pour attribuer le rôle SUPERADMIN au premier compte si nécessaire.

Pour une nouvelle instance Supabase :

1. créer un projet Supabase neuf ;
2. exécuter `SUPABASE_BASELINE.sql` une seule fois dans SQL Editor ;
3. configurer `bleus_config.js` avec l’URL et la clé publique/publishable ;
4. créer/valider le premier compte ;
5. exécuter `SUPABASE_FIRST_ADMIN.sql` si l’attribution du premier SUPERADMIN doit être faite manuellement.

Le baseline ne contient pas les données de production (joueurs, matchs, photos, etc.). Ces données doivent être importées/restaurées séparément si une reconstruction complète du contenu est nécessaire.

## Sécurité

`bleus_config.js` ne doit contenir que les informations publiques nécessaires au navigateur. Ne jamais y placer `SUPABASE_SECRET_KEY`, une clé `service_role` ou `THESPORTSDB_KEY`.

## V1.1.61.16 — baseline consolidé

- suppression des 36 fichiers `MIGRATION_*.sql` de la racine ;
- suppression de l’ancien `supabase_setup.sql` ;
- remplacement par `SUPABASE_BASELINE.sql` ;
- conservation de `SUPABASE_FIRST_ADMIN.sql` ;
- aucun changement appliqué à la base de production ;
- centrage renforcé du logo Équipementier dans les tuiles Maillots.


## V1.1.61.16 — Synchronisation live des feuilles de match

Aucune migration Supabase supplémentaire. Le déploiement Netlify ajoute `/api/match-sheet-sync` et un cron toutes les 3 minutes. Les variables `THESPORTSDB_KEY` (ou `SPORTSDB_KEY`), `SUPABASE_URL` et `SUPABASE_SECRET_KEY` / `SUPABASE_SERVICE_ROLE_KEY` doivent rester configurées. Le moteur utilise les endpoints TheSportsDB V2 `lookup/event`, `lookup/event_lineup` et `lookup/event_timeline`.
