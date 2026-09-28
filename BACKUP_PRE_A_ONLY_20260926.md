# Backup pré-recentrage France A — 26/09/2026

Avant l'élagage de la base de production, un snapshot complet a été créé directement dans le même projet Supabase, dans un schéma séparé :

`backup_pre_a_only_20260926`

## Contenu

Le snapshot contient la copie des 61 tables publiques existantes avant la purge, ainsi qu'un manifeste `_snapshot_meta` et des tables `_keep_*` ayant servi à déterminer exactement le périmètre conservé. Le schéma de backup contient 77 tables au total.

État principal avant recentrage :

- 2 008 joueurs ;
- 324 matchs ;
- 14 sélections ;
- 57 compétitions (ancien référentiel) ;
- 90 adversaires ;
- 57 lieux ;
- 134 entrées personnel ;
- 105 tags ;
- 55 sources.

## Périmètre conservé en production

La production est désormais centrée sur `FRA-A-M` — France A Masculin.

Les données hors A ont été retirées du schéma `public`, mais restent présentes dans le schéma de backup ci-dessus.

## Restauration

Ne pas supprimer le schéma `backup_pre_a_only_20260926`.

Une restauration éventuelle devra être effectuée par une migration contrôlée afin de réinjecter les lignes voulues dans les tables publiques en respectant leurs contraintes et leurs relations. Les tables du backup sont des snapshots de données et ne remplacent pas le schéma applicatif de production.
