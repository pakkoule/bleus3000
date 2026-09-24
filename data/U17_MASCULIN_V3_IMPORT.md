# France U17 Masculin — import V1.1.29

Source de travail : `Bleus3000_U17_Masculine_2004_2026_V3_STATS.xlsx` fournie par l'utilisateur.

- 376 joueurs documentés sur 2004–2026.
- 86 joueurs ont un total Sélections U17 + Buts U17 sourcé dans la V3.
- 290 lignes conservent volontairement des statistiques vides lorsqu'elles ne sont pas sourcées.
- L'import SQL réutilise les profils joueurs globaux existants par nom normalisé (et date de naissance lorsqu'elle est disponible), afin de conserver les autres tags/sélections déjà connus.
- Le tag existant `U17 Masculin` (`u17`) est utilisé ; aucun doublon de tag n'est créé.
- Le contexte `GENERAL` est calculé automatiquement par l'interface à partir de toutes les sélections connues du joueur.
- Le classeur source n'est pas publié dans le frontend statique afin de ne pas exposer inutilement la base de travail.
