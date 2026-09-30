## V1.2.10.13 — correction équipe par défaut des faits de jeu

- Feuille de match : tout nouveau **but** ajouté est désormais créé par défaut pour **France** et non pour l’adversaire.
- Feuille de match : même correction appliquée aux nouveaux **cartons** pour éviter le même défaut de saisie.
- Correction de la donnée Turquie – France du 25/09/2026 : **Kylian Mbappé, 54’**, équipe France et liaison au joueur rétablies.
- La vidéo auparavant associée au mauvais but Belgique – France est rattachée au but de Mbappé contre la Turquie.
- Aucun SQL à lancer manuellement : la donnée de production a déjà été corrigée.

## V1.2.10.12 — Tuiles But déclenchées uniquement par une vidéo

- Le référentiel **Buts** n’affiche plus les 1 763 faits de but : seules les entrées avec une **vidéo renseignée** deviennent des tuiles But.
- Bouton **Ajouter** réactivé dans le bloc Buts pour les ADMIN / SUPERADMIN.
- Nouveau flux d’ajout : recherche du **match ou du but**, sélection du **fait de but précis** déjà présent dans la feuille de match, puis import d’un fichier vidéo ou saisie d’une URL.
- La tuile créée reste liée au `match_goal_event` exact, donc le renvoi vers la feuille ouvre le bon match et le bon but.
- La suppression de la vidéo retire naturellement la tuile du référentiel Buts sans supprimer le fait de match.
- Aucun SQL supplémentaire requis.

## V1.2.10.11 — bloc Buts visible & export PNG match stabilisé

- Bloc **Buts** : rechargement forcé des données à chaque ouverture du référentiel pour éviter toute tuile de but manquante après ajout ou correction.
- Bloc **Buts** : ajout d’un **index compact de tous les matchs** en haut de la vue pour accéder directement à chaque page de match, y compris Turquie – France du 25/09/2026.
- Tuile de match : export **PNG** renforcé avec une version simplifiée du scoreline pour l’export, afin d’éviter l’aplat rouge parasite.
- Aucun SQL supplémentaire requis.

# 3615 Bleus

Version : **V1.2.10.10**







## V1.2.10.10 — Correctif cache Buts + Navigation compacte

- Correction du cache du référentiel **Buts** : après ajout ou modification d’un fait de match, la galerie est invalidée et recharge les buts depuis Supabase.
- Le raccourci **Buts** d’une feuille de match force également un rafraîchissement avant de cibler le match demandé, évitant le renvoi vers le match précédemment affiché.
- **Navigation** passe sur une seule colonne compacte, outils compris.
- Les pictogrammes du menu sont remplacés par de simples puces **• bleu marine**.
- Largeur maximale de l’overlay Navigation réduite pour conserver un format compact.
- Aucune migration Supabase requise.


## V1.2.10.9 — Correctif export PNG CORS + raccourci Médias → Buts

- Correction de l’erreur Chromium **`Tainted canvases may not be exported`** lors de l’export PNG d’une tuile match.
- Les images de la tuile sont converties en données locales avant rendu ; une image distante sans CORS est neutralisée sans faire échouer l’export complet.
- Les URL CSS externes et lecteurs distants sont retirés du rendu PNG afin de conserver un canvas exportable.
- Le SVG intermédiaire est chargé en **data URL autonome** avant conversion en PNG.
- Nouveau raccourci **🥅 Buts** dans le bloc Médias de la feuille, avec compteur ; il ouvre directement la page du match dans le référentiel Buts.
- **Aucune migration Supabase requise.**

## V1.2.10.8 — Arbitre sur la tuile · export PNG · lien But → feuille

- Le nom de l’**arbitre principal** est affiché directement dans les informations de la tuile match.
- Nouveau bouton **⇩ PNG** sur chaque tuile match : il exporte la tuile complète en haute définition, après chargement de la feuille de match, sans les boutons d’administration.
- Chaque tuile **But** possède maintenant un lien **Voir ce but dans la feuille ↗**.
- Ce lien ouvre automatiquement le bon match, sa feuille de match et fait défiler jusqu’au **but précis** correspondant.
- La ligne du but ciblé est surlignée temporairement pour être retrouvée immédiatement.
- **Aucune migration Supabase requise.**

## V1.2.10.7 — Sélection d’un ballon enregistré dans Médias

- `Ballon du match` propose désormais les ballons du référentiel dans un menu déroulant.
- La sélection réutilise la liaison `match_balls`, avec aperçu de l’image et du copyright.
- Un ballon lié est visible et peut être délié depuis la modale Médias.
- Le mode image personnalisée reste disponible.
- **Pas de migration Supabase requise.**

## V1.2.10.6 — Médias sous les faits de jeu, brassard capitaine & photo d’équipe

- Le bloc **Médias** de la feuille de match est désormais placé juste **sous Faits de jeu**.
- Le capitaine n’est plus signalé par la lettre `C` : l’icône PNG du **brassard tricolore** `achievement-capitanat.png` est affichée dans la composition et dans l’éditeur de feuille.
- Nouveau média **Photo d’équipe** : import d’image ou URL externe, titre et copyright comme les autres visuels de match.
- La Photo d’équipe apparaît dans le bloc Médias avec aperçu agrandi au survol.
- **Migration requise :** `MIGRATION_V1.2.10.6_TEAM_PHOTO_MEDIA.sql` pour autoriser le nouveau type `team_photo` dans `match_media_assets`.

## V1.2.10.5 — Banc automatique depuis le rassemblement

- Nouvelle case **Ajouter automatiquement les remplaçants restants** dans le bloc Rassemblement lié de la feuille de match.
- Une fois cochée, tous les convoqués qui ne font pas partie des 11 titulaires sont ajoutés automatiquement au banc.
- Si un titulaire est changé, le banc est recalculé immédiatement : le nouveau titulaire en sort et l'ancien titulaire redevient disponible parmi les remplaçants.
- Les données déjà saisies d'un joueur conservé sur le banc (numéro, poste, minutes, capitanat, remplacement) sont préservées.
- Les éventuelles anciennes valeurs manuelles hors rassemblement sont conservées afin d'éviter une perte de donnée historique.
- La case reste désactivée par défaut et n'écrit rien en base tant que la feuille n'est pas enregistrée.
- Aucune migration Supabase supplémentaire.

## V1.2.10.4 — Composition guidée par le rassemblement

- Lorsqu’un match est lié à un rassemblement, les champs **Joueur** de la composition deviennent automatiquement des menus déroulants.
- Les menus proposent les joueurs actifs convoqués dans le rassemblement lié, en excluant les forfaits (`withdrawn`).
- Le champ **Remplacé par** utilise la même liste de convoqués.
- Si plusieurs rassemblements sont liés au match, changer le rassemblement actualise immédiatement les menus.
- Une valeur déjà enregistrée hors liste est conservée pour éviter toute perte de donnée historique.
- Sans rassemblement lié, les champs texte habituels restent disponibles.
- Le bouton **Importer toute la liste** reste disponible pour remplir rapidement le groupe/remplaçants.
- Aucune migration Supabase supplémentaire.

## V1.2.10.3 — Buts paginés par match

- **Navigation → Buts** affiche désormais un seul match à la fois.
- Pagination par flèches **match précédent / match suivant** avec date, score, compétition et numéro de page.
- Les buts d’un même match sont ordonnés chronologiquement par minute.
- Grille desktop fixe à **2 tuiles par ligne**.
- Lorsqu’un match ne comporte qu’un seul but français, sa tuile occupe **toute la largeur utile de la modale**.
- Sur mobile, la grille repasse à une seule tuile par ligne.
- Les filtres de recherche restent actifs pendant la pagination.
- Aucune migration Supabase supplémentaire.

## V1.2.10.2 — Upload direct des vidéos de buts

- Dans **Navigation → Buts → ⚙**, ajout d’un sélecteur de fichier vidéo local.
- Formats acceptés : MP4, WebM, MOV et M4V, jusqu’à 50 Mo par clip.
- Upload direct vers le bucket Supabase Storage public `goal-videos`, puis rattachement automatique au but via `video_url`.
- L’URL YouTube / URL directe reste disponible comme solution alternative.
- Remplacer ou supprimer une vidéo importée supprime aussi l’ancien fichier du bucket lorsqu’il appartient à `goal-videos`.
- **Migration requise :** `MIGRATION_V1.2.10.2_GOAL_VIDEO_UPLOAD.sql`.

## V1.2.10.1 — Correctif largeur modale Buts

- La grille **Buts** occupe désormais toute la largeur utile du référentiel au lieu d'être enfermée dans une seule colonne.
- Modale Buts limitée à une largeur desktop cohérente et centrée.
- Grille adaptative : jusqu'à 3 cartes sur grand écran, 2 sur tablette, 1 sur mobile.
- Cache-busting appliqué aux fichiers CSS/JS concernés.

## V1.2.10 — Validation rapide, Livres, Buts notés & Panini

- Nouveau menu Profil **Validation rapide ⚡** : liste uniquement les feuilles déjà complètes et permet de valider une feuille, une sélection ou toutes les feuilles prêtes.
- La validation rapide reconstruit le snapshot statistique et refuse toute feuille à laquelle il manque encore une donnée obligatoire.
- Navigation : nouveau bloc **Livres** avec couverture, titre, auteur, ISBN, édition, année, éditeur, notes et copyright photo.
- Navigation : nouveau bloc **Buts** avec lecteur vidéo interne, édition vidéo par les admins et note communautaire de **1 à 100 %** visualisée par une courbe en dégradé.
- Navigation : nouveau bloc **Panini** avec tuiles d’albums puis galerie de stickers, numéro, joueur associé, photo, copyright et ordre personnalisable.
- Feuille de match : **Importer un rassemblement lié** ajoute rapidement les joueurs actifs du rassemblement au groupe sans inventer les 11 titulaires et sans créer de doublons.
- **Migration requise sur une base existante :** `MIGRATION_V1.2.10_COLLECTIONS_QUICK_VALIDATION.sql`.

## V1.2.9 — Recherche 3615 langage naturel étendu

- Confrontations directes : `France Angleterre`, avec compétition, édition, année, phase et résultat cumulables.
- Joueur + adversaire + compétition, ainsi que titulaire/remplaçant, poste, numéro et capitanat.
- Faits de jeu croisés : but, penalty, tête, coup franc, passe décisive, carton, entrée/sortie et tranche de minute.
- Croisements multiples : deux joueurs ensemble, capitaine + buteur, titulaire + buteur, numéro + but.
- Questions naturelles : `combien`, `qui a marqué`, premier/dernier match, première/dernière sélection, Nᵉ sélection.
- Chronologie : premier match après une compétition, premier match de chaque édition, recherches par décennie.
- Matchs : victoire/défaite/nul, clean sheet, seuil de buts, prolongation.
- Records : plus grosse victoire, dernier 0–0, XI le plus jeune/vieux/expérimenté, capitaines, sélections cumulées, remplacements.
- Matériel : maillots, équipementiers, shorts, chaussettes, manches longues et ballons lorsque les données sont disponibles.
- Aucun SQL supplémentaire requis.

## V1.2.7 — Copyright photos & référentiel Ballons

- Copyright photo optionnel et personnalisable : case **Copyright** à l’import, saisie de la source précédée de © et capsule blanche en bas à droite des visuels.
- Copyright pris en charge sur les portraits / photos en match des joueurs, photos de staff et stades, photos de maillots, médias visuels de match et photos de ballons.
- Suppression de l’icône flèche de sources sur les tuiles joueurs.
- Nouveau menu Profil **Base de données · Ballons** : modèle, équipementier, alias équipementier, compétition, édition, années, photo, copyright et notes.
- Nouveau lien relationnel `match_balls` pour associer rapidement un ballon à une feuille de match et permettre les statistiques par ballon.
- Les anciens médias `Ballon du match` sont automatiquement importés dans le nouveau référentiel lors de la migration.
- Dans la feuille de match, un sélecteur Ballon propose prioritairement les modèles correspondant à l’édition, la compétition et l’année du match.
- **Migration requise sur une base existante :** `MIGRATION_V1.2.7_PHOTO_COPYRIGHT_BALLS.sql`.
