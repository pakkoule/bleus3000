# V1.3.13 — Nettoyage du ZIP

- Suppression de tous les fichiers `MIGRATION_*.sql` du paquet de déploiement.
- Les migrations correspondantes ont déjà été appliquées directement au projet Supabase `bleus3000`.
- `SUPABASE_BASELINE.sql` est conservé comme référence historique de schéma ; il n’est pas exécuté au déploiement du frontend.
- Les messages frontend ne demandent plus d’exécuter manuellement un fichier de migration absent.
