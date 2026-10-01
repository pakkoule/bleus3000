# 3615 Bleus V1.3.12 — Feuilles sans validation

## Principe
La feuille de match courante est la seule source de vérité. Il n’existe plus de statut Validée / À revalider / Brouillon, de Validation rapide, de centre Qualité des feuilles ni de Complétion des tuiles.

## Règle d’idempotence
Une information présente dans une feuille compte une fois pour ce match. Modifier puis réenregistrer la même feuille remplace l’état précédent : cela n’ajoute jamais une deuxième sélection, un deuxième capitanat ou un deuxième numéro porté.

`match_appearances` conserve l’unicité `(match_id, player_id)`. Les agrégats joueur sont reconstruits à partir des lignes courantes de `match_appearances`, `match_goal_events` et `match_card_events`.

## Sauvegarde
L’éditeur utilise un seul RPC `save_match_sheet`. Composition, buts, cartons, contexte, maillot et ballon sont enregistrés atomiquement. Le RPC recalcule seulement les joueurs touchés et met en file le recalcul Équipe type.

## Suppressions serveur
- `validated_match_player_stats`
- `validate_match_sheet`
- `quick_validate_existing_match_sheet`
- fonctions de champs manquants / validation rapide
- colonnes `sheet_validation_*` de `matches`
- triggers de revalidation

## Compatibilité
Le Bleu Moyen continue de travailler depuis les apparitions réellement enregistrées. Son indicateur de qualité affiche désormais les apparitions exploitables et ne dépend plus d’un statut de validation.
