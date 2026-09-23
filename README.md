# Bleus 3000 — V1.1.5

Fork UI/UX de Cotation 3000 V9 adapté à Bleus 3000.

Cette version ajoute :
- overlays du header toujours devant le contenu ;
- favoris à droite sous la toolbar ;
- gestion complète des Tags & étiquettes dans le profil ;
- stockage relationnel Supabase des tags et préparation des futures liaisons entre tuiles.

La configuration de production reste `https://bleus3000.netlify.app/` avec le projet Supabase dédié Bleus 3000.


### V1.1.5 — Icônes personnalisées des tags
- Import PNG/JPG/WebP dans l’éditeur de tags.
- Recadrage proportionnel dans un carré transparent 128×128 sans déformation.
- Conversion WebP côté navigateur avant envoi pour limiter le poids.
- Stockage dans le bucket Supabase `tag-icons`.
- Emoji conservé en fallback si aucune image personnalisée n’est définie.

## V1.1.6 — Référentiel Sélections
Le premier référentiel réel est désormais `Sélections`. Les données France A Masculin sont stockées dans Supabase et non dans un JSON frontend. Les autres catégories sont créées mais restent vides jusqu'à leur alimentation. Les fiches joueurs sont relationnelles et destinées à être réutilisées dans les convocations, matchs, compétitions et outils de composition.


## Correctif V1.1.7
- Les 949 joueurs France A Masculin utilisent le tag utilisateur existant `INTERNATIONAL` (alias `FRANCE A M`).
- Aucun tag France A n'est recréé automatiquement.
- Le rendu personnalisé du tag (icône image, couleurs, bordure) est repris sur les tuiles.


## V1.1.9 — Numéros de maillot visuels
- Sélecteur de numéro dans l’éditeur joueur, avec bouton `+ Ajouter`.
- Plusieurs numéros peuvent être associés à un joueur sans saisie manuelle par virgules.
- Chaque numéro est affiché sur un dos de maillot avec les chiffres graphiques France 1998 fournis pour le projet.
- Les numéros restent stockés individuellement dans `player_jersey_numbers`.


## V1.1.11
Le référentiel Sélections affiche désormais deux tuiles joueur par ligne sur les écrans de plus de 760 px.


## V1.1.11
Le référentiel Sélections ajoute des tris croissant/décroissant, un filtre par numéro porté, un filtre par tag et affiche toutes les étiquettes Supabase liées à chaque joueur.


## V1.1.12 — Joueurs convoqués sans cape
Dans le référentiel Sélections, une ligne joueur/sélection peut désormais être marquée `Convocation seulement`. La tuile affiche alors `Convocation` dans la zone d'ordre d'apparition au lieu d'un numéro international. Lors de la première cape, il suffit de passer le statut à `International` et de renseigner le numéro d'apparition.


## V1.1.13
Correctif grille Sélections : 2 tuiles réellement pleine largeur par ligne sur desktop et réparation du bouton ✎ de modification.


## V1.1.14 — Base joueurs globale
L’accueil abandonne les cartes de démonstration au profit d’un tableau compact inspiré de Cotation 3000. Les joueurs de toutes les catégories sont agrégés par identifiant unique. La colonne Poste vient de `players.primary_position`; la colonne Tags équipes vient des sélections représentées et de leur `team_tag_id`. Les autres référentiels restent accessibles depuis la barre d’outils.

## V1.1.15 — Tags liés aux référentiels
Les tags peuvent désormais être associés explicitement à une entrée du référentiel Sélections. Le tableau d'accueil filtre sur les tags réellement affiliés aux joueurs, et distingue les tags d'appartenance des tags de statut comme `VENU SANS JOUER`.


## V1.1.16 — Numéros portés sur l’accueil
La base joueurs affiche désormais une colonne **Numéros portés**. Les numéros sont composés avec les chiffres France 1998 en PNG transparents dans une capsule bleue compacte. L’affichage maillot complet reste réservé aux tuiles joueur du référentiel Sélections.


## V1.1.17 — France A Féminine
339 internationales France A féminine sont intégrées à Supabase et utilisent le tag existant INTERNATIONALE F. Le référentiel Sélections affiche désormais des compteurs dynamiques par catégorie.
