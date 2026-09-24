# Calendrier API-Football — V1.1.34

Correctif spécifique au plan gratuit API-Football.

## Requête utilisée
`GET /fixtures?team=<ID>&season=<ANNEE>&timezone=Europe/Paris`

Le paramètre `next` n'est pas disponible sur le plan Free. La fonction récupère donc les fixtures de la saison courante et conserve uniquement les matchs à venir ou en cours.

## Saison
Par défaut, l'année courante est utilisée. La variable Netlify facultative `API_FOOTBALL_SEASON` permet de forcer une année si nécessaire.

## Quota
Le mapping contient 14 IDs API-Football. Les fonctions restent divisées en deux shards de 7 appels, espacés de deux minutes.
