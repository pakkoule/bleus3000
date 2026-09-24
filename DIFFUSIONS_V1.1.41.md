# 3615 Bleus V1.1.41 — chaînes de diffusion

- Menu **Profil → Chaînes de diffusion**.
- Une chaîne possède une entité `broadcast_channels` et un tag lié.
- TF1 et YouTube sont initialisés depuis les valeurs déjà présentes dans les matchs.
- Le sync TheSportsDB crée automatiquement une nouvelle entité/tag lorsqu'une nouvelle chaîne est rencontrée dans la programmation TV.
- Sans logo : rendu sous forme de tag texte.
- Avec logo importé : le calendrier et le référentiel Matchs affichent le logo à la place du tag texte.
- Les logos sont stockés dans le bucket existant `tag-icons`.
- Les relations match ↔ chaîne sont conservées dans `match_broadcast_channels`.
