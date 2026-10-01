# V1.3.5 — Synchronisation Staff / sélectionneurs

## Problème corrigé
Les feuilles historiques pouvaient contenir `sheet_coach_name` sans `coach_id`. Le bloc Staff étant construit sur `public.personnel` et les liaisons `matches.coach_id`, ces sélectionneurs n’avaient pas de tuile malgré leur présence textuelle dans les feuilles.

## Correction serveur
Un trigger `trg_sync_match_sheet_coach_reference` s’exécute avant insertion ou modification de `sheet_coach_name`. Il appelle le resolver existant `resolve_or_create_sheet_personnel(name, 'selectionneur')`, réutilise une personne existante après normalisation du nom ou crée la tuile Staff manquante, puis renseigne `matches.coach_id`.

Les droits restent protégés par les RLS de `matches` / `personnel` et `can_edit()`. La fonction trigger n’est pas exposée en RPC à `anon` ou `authenticated`.

## Backfill exécuté
Toutes les feuilles historiques avec un nom de sélectionneur ont été synchronisées. Contrôle après migration : 945 matchs concernés, 0 `coach_id` manquant, 19 entités sélectionneur dans `personnel`.

## Cache / frontend
Les écritures Match invalident maintenant aussi `personnel`. Le cache et l’index local de recherche ont été versionnés afin d’éviter de restaurer un ancien référentiel Staff incomplet. Une sauvegarde de feuille non validée invalide également le store relationnel du même onglet.
