# V1.3.11 — Validation des feuilles : correction des timeouts 57014

Les erreurs `canceling statement due to statement timeout` provenaient du trigger de recalcul de l'indice **Équipe type** déclenché pendant la validation d'une feuille.

Avant V1.3.11, la validation pouvait recalculer le match validé puis tous les matchs suivants du même sélectionneur dans la même transaction. Sur une correction historique, cela pouvait représenter des dizaines ou centaines de recalculs et dépasser le délai PostgREST.

## Correctif

- la validation de feuille ne lance plus ce recalcul historique lourd ;
- elle alimente une file interne `team_type_recalc_queue` ;
- la file est dédupliquée par match ;
- `pg_cron` traite jusqu'à 10 recalculs par minute ;
- un verrou advisory évite deux workers simultanés ;
- en cas d'échec, le match reste dans la file avec temporisation progressive ;
- aucun accès `anon` ou `authenticated` direct n'est accordé à la file ou au worker.

Le calcul d'un indice Équipe type isolé reste inchangé. Seule son orchestration après validation est devenue asynchrone.
