# V1.1.66 — Rassemblements & recadrage joueur

- « Événements récents » devient **Mise à jour** et affiche l’intégralité des changements.
- Suppression des blocs **Liste annoncée** et **Historique des modifications** dans les tuiles.
- Les événements `replacement`, `withdrawal` et `reinforcement` réconcilient automatiquement `callup_players`.
- Les remplaçants sont ajoutés à la liste courante ; les joueurs remplacés restent visibles avec le statut **Forfait**.
- Filtre des convoqués : Tous / Gardiens / Défenseurs / Milieux / Attaquants.
- Matchs passés et futurs sélectionnables dans l’éditeur du rassemblement.
- Sélection du sélectionneur directement dans l’éditeur principal du rassemblement.
- Outil de recadrage manuel du portrait joueur : zoom + déplacement horizontal/vertical, sortie WebP 512×512.
- Migration `MIGRATION_V1.1.66_RECONCILE_CALLUP_ROSTER_EVENTS.sql`.
