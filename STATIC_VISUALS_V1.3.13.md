# V1.3.13 — Simplification esthétique / BDD

- Cadre de diffusion figé localement avec le rendu actuellement utilisé : `#123b8f → #2563eb → #ffffff → #ef3340 → #ef3340`, angle 135°, bordure 3 px, rayon 12 px, lueur `#2563eb` 12 px.
- Bordure photo France A masculine figée localement : `#e22400 → #2563eb`, angle 135°, 4 px, rayon 16 px.
- Suppression des outils ADMIN permettant de modifier ces deux rendus.
- Suppression du système de surlignage pays : le scoreline affiche uniquement drapeau + texte.
- Score et `VS` réduits.
- Suppression des tables `calendar_feature_styles`, `selection_photo_borders`, `country_display_colors` et de la colonne `matches.feature_frame_mode`.
- Aucun appel Supabase n'est désormais nécessaire pour ces éléments visuels.
