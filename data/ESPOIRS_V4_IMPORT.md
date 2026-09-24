# France Espoirs masculins — import V4

Source embarquée : `Bleus3000_Espoirs_Masculins_2004_2026_V4_FEUILLES_PLUS.xlsx`.

Import réalisé dans Supabase Bleus 3000 :
- 318 joueurs reliés à France Espoirs / U21 masculin ;
- 150 identités existantes réutilisées, 168 nouvelles identités créées ;
- 226 matchs ;
- 809 observations joueur-match issues des feuilles disponibles ;
- 117 liens d'officiels/arbitres ;
- 25 événements de but ;
- 131 associations joueur/numéro pour 119 joueurs à partir des feuilles détaillées ;
- 16 lignes de capitanat observé.

Important : les feuilles détaillées ne couvrent que 38 matchs sur 226. Les numéros et capitanats issus de ces feuilles sont donc des minimums documentés et ne doivent pas être interprétés comme des totaux historiques exhaustifs.

Le tag ESPOIRS existant est réutilisé. Le tag GENERAL est une vue calculée : aucune fausse sélection GENERAL n'est créée dans `player_selection_stats`.
