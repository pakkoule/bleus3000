# 3615 Bleus — GitHub / Netlify / Supabase

## Déploiement courant — V1.1.68

La release applicative courante est la V1.1.68. V1.1.68 corrige uniquement le dédoublonnage visuel forfait/remplacement et ne nécessite aucune migration SQL supplémentaire. La V1.1.67 ajoutait deux colonnes non destructives à `country_display_colors` (`display_mode`, `gradient_angle`) pour gérer les dégradés pays. Pour une mise à jour normale du site :

1. remplacer le contenu du dépôt GitHub par le package complet ;
2. laisser Netlify redéployer ;
3. conserver les variables Netlify existantes (`THESPORTSDB_KEY`, `SUPABASE_SECRET_KEY`, `SUPABASE_URL`) ;
4. **ne pas exécuter `SUPABASE_BASELINE.sql` sur la base de production existante**.

`calendar-sync` reste planifié toutes les 6 heures et peut être lancé manuellement depuis Netlify si nécessaire.

### Migrations incrémentales

Les fichiers `MIGRATION_*.sql` présents dans le dépôt sont conservés comme historique d’évolution d’une base existante. Ils ne doivent pas être rejoués au hasard.

Pour une base existante, n’exécuter que les migrations qu’elle n’a pas encore reçues, dans l’ordre :
- `MIGRATION_V1.1.65_GATHERING_EVENT_HISTORY_LINKS.sql` — rattrape l’historique depuis les événements ;
- `MIGRATION_V1.1.66_RECONCILE_CALLUP_ROSTER_EVENTS.sql` — réconcilie forfaits/remplaçants avec la liste courante ;
- `MIGRATION_V1.1.67_COUNTRY_GRADIENTS.sql` — ajoute le mode uni/dégradé et l’angle pour les couleurs pays.

La production `bleus3000` a déjà reçu ces trois migrations pendant la préparation des V1.1.65 à V1.1.67 : **ne pas les rejouer sur cette production**.

## Nouveau projet Supabase

Pour une nouvelle instance Supabase, **ne pas exécuter les migrations historiques une par une**. Utiliser uniquement :

- `SUPABASE_BASELINE.sql` — schéma cumulatif courant (tables, fonctions, RLS, policies, buckets et bootstrap) ;
- `SUPABASE_FIRST_ADMIN.sql` — aide pour attribuer le rôle SUPERADMIN au premier compte si nécessaire.

Procédure :

1. créer un projet Supabase neuf ;
2. exécuter `SUPABASE_BASELINE.sql` une seule fois dans SQL Editor ;
3. configurer `bleus_config.js` avec l’URL et la clé publique/publishable ;
4. créer/valider le premier compte ;
5. exécuter `SUPABASE_FIRST_ADMIN.sql` uniquement si l’attribution automatique du premier SUPERADMIN doit être reprise manuellement.

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


## V1.1.61.17 — validation des feuilles

Le projet Supabase `bleus3000` a déjà reçu le nouveau schéma de validation et la remise à zéro demandée. Pour un nouveau projet, exécuter uniquement `SUPABASE_BASELINE.sql`, puis `SUPABASE_FIRST_ADMIN.sql` si nécessaire.

Après cette version, les agrégats joueurs (sélections, buts, V/N/D, numéros, postes, capitanat) sont reconstruits à partir des feuilles explicitement validées. **Enregistrer la feuille** ne valide jamais les statistiques.


## V1.1.61.18 — MATCH SHEET UX

Le projet Supabase de production a déjà reçu les colonnes `matches.sheet_formation` et `match_appearances.lineup_slot`, ainsi que la restriction d'écriture éditoriale à ADMIN/SUPERADMIN. Pour une installation neuve, `SUPABASE_BASELINE.sql` contient directement ces changements.


## V1.1.61.22 — Rassemblements
Le projet Supabase de production a déjà reçu l’évolution de schéma correspondante. Pour une nouvelle installation, `SUPABASE_BASELINE.sql` inclut désormais les champs et relations de rassemblement (`callups`, `callup_players`, `callup_matches`) ainsi que la synchronisation vers `calendar_events`.
