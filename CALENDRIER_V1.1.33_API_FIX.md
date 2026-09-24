# Calendrier API-Football — correctif V1.1.33

Le log V1.1.32 a confirmé que les 4 variables Netlify sont correctement visibles. Deux problèmes API restaient :

1. `team + from + to` renvoyait `The Season field is required`. Le sync utilise maintenant `team + next=50`, pattern officiellement documenté pour récupérer les prochains matchs d’une équipe.
2. Le plan API-Football FREE est limité à 10 requêtes par minute. Le mapping contient actuellement 14 IDs API ; le sync est donc divisé en 2 fonctions de 7 appels, espacées de 2 minutes.

## Test manuel
1. Functions → `calendar-sync` → Run now.
2. Attendre au moins 60 secondes.
3. Functions → `calendar-sync-b` → Run now.

Chaque log indique `shard`, `apiRequests`, `imported`, `updated`, `errors`.
