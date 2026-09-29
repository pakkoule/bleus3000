# 3615 Bleus — V1.1.92

## Interface outils

- **Five supprimé** de la navigation et de la bibliothèque de compositions.
- **Onze** et **Liste** disposent chacun de leur icône directement dans la barre d’outils.
- L’icône **Calendrier** est retirée de la barre d’outils ; le calendrier reste accessible depuis le bloc Calendrier de l’accueil et ses boutons dédiés.
- Le menu Profil affiche désormais **Mes Onze**.

## État courant

- Référentiel France A masculine.
- Bloc **Numéros portés** retiré des fiches joueurs, filtres et éditeur.
- Ancien système de numéros de flocage PNG supprimé du runtime et du dépôt.
- **Mon Onze** : rendu Photos ou **Points du maillot** ; les couleurs du point viennent du maillot associé au match quand il existe.
- Référentiel **Matchs** : une seule tuile visible par page avec pagination précédent/suivant.
- Les matchs terminés sont affichés par défaut ; la case **Afficher les prochains matchs** ajoute les rencontres futures.
- Aucune migration Supabase nécessaire pour V1.1.79.

## V1.1.78 — feuille visuelle & surlignage pays

- Feuille de match : le maillot utilisé est affiché sans nom, uniquement par sa photo.
- La Une de journal et le ballon sont affichés en grand.
- Maillot, Une et ballon disposent d’un aperçu agrandi au survol de la souris, dans un calque flottant qui n’est pas rogné par la tuile match.
- Le clic sur les médias visuels n’ouvre plus de nouvel onglet ; l’icône YouTube reste un lien normal sans `target=_blank`.
- Les noms de pays n’utilisent plus de halo lumineux ni de contour de texte. Les deux couleurs existantes servent à un surlignage overlay discret derrière le nom.
- Le menu Profil reprend exactement ce nouveau rendu dans son aperçu.
- Aucune migration Supabase nécessaire.

## V1.1.80 — accueil, matchs, export Onze, icônes Compétitions

- Accueil : `À venir` devient **Calendrier**, `Derniers résultats` devient **Résultats**, `Événements` devient **Actus** ; suppression des sous-titres descriptifs.
- Référentiel Matchs : contenu des tuiles recentré.
- Export PNG/JPG Onze : suppression des mentions `3615 BLEUS · COMPOSITION FICTION`, `Composition libre...` et de la note légale basse ; remplacement du cartouche logo par le visuel Footix coach fourni.
- Compétitions : icône visible par entité principale, presets + icône personnalisée pour ADMIN/SUPERADMIN.
- `competition_entities.icon_text` ajouté au baseline Supabase ; migration déjà appliquée à la production `bleus3000`.


## V1.1.81 — résultats, pagination et édition Compétitions

- Référentiel Matchs : pagination une-tuile recentrée dans le bloc.
- Accueil Résultats : titre, pagination et bouton `Tous les matchs` restent sur une seule ligne.
- Les faits de jeu sont séparés en deux blocs **France / adversaire**, puis en lignes **Buts / Cartons**.
- Accueil Calendrier : compte à rebours plus grand et plus lisible.
- Compétitions : bouton Modifier pour ADMIN/SUPERADMIN avec édition du nom, édition, type, statut, genre, catégorie et icône.
- L’icône reste stockée au niveau de l’entité principale lorsqu’une entité canonique est liée.
- Aucune migration Supabase supplémentaire nécessaire pour V1.1.81.


## V1.1.82 — Résultats · Footix · Compétitions éditables

- Accueil Résultats : affiche uniquement les buts, séparés entre France et adversaire.
- Les tags de sélection/compétition sont alignés sur la même ligne que l’icône Feuille de match.
- Le logo d’export Onze utilise le Footix coach fourni le 29/09/2026.
- Les tuiles Compétitions sont modifiables à trois niveaux : tuile principale/famille, entité canonique et édition.
- Modification des noms, types, alias, icône d’entité, année/libellé d’édition et notes avec synchronisation des tables canoniques/legacy liées.
- Aucune migration Supabase supplémentaire.


## V1.1.87 — Footix export robuste
- Le logo Footix coach est encodé directement dans le JavaScript d’export Onze.
- Aucun fetch du logo n’est nécessaire lors de la génération PNG/JPG.
- Nouveau fichier d’aperçu : `assets/footix-coach-export-v1186.png`.


## V1.1.92 — responsive · surlignages pays · logos compétitions

- Responsive fluidifié et barre d’outils centrée sous 1024 px.
- Surlignage pays renforcé : 2 à 5 couleurs, dégradé linéaire/radial, angle, intensité et hauteur.
- Compétitions : roue crantée de configuration placée à gauche de `Modifier la tuile`.
- Logos image importables séparément pour chaque entité et chaque édition.
- Stockage des logos dans le bucket existant `tag-icons`.
