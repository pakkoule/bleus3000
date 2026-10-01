# 3615 Bleus

> Les fichiers de migration SQL incrémentaux ne sont plus inclus dans le ZIP de déploiement. Les évolutions serveur de cette version sont déjà appliquées directement au projet Supabase de production. `SUPABASE_BASELINE.sql` est conservé uniquement comme référence historique de schéma.
 V1.3.13

# 3615 Bleus — V1.3.12

# 3615 Bleus

**Version actuelle : V1.3.15.1** — accueil calendrier et médias de match simplifiés.

## V1.3.8 — Génération · Actus
- Joueurs : filtre par année de naissance et liste compacte optimisée iPhone.
- Accueil : tuiles **Actu** indépendantes des rassemblements, avec liens, live YouTube et diffusion.
- Migration Supabase appliquée et incluse dans le ZIP. Voir `FEATURES_V1.3.8.md`.

## V1.3.7 — Match : anneau, faits par équipe, export complet
- Correction du chevauchement du libellé **Équipe type** avec l’anneau.
- Les faits de match sont séparés en deux colonnes **France / adversaire**.
- L’export PNG Match utilise un gabarit éditorial dédié et contient date, compétition, stade, sélectionneur, indice Équipe type, âge moyen, sélections moyennes, composition et faits de match.
- Export standardisé à 1040 px puis rasterisé en haute définition/Retina.
- Aucune migration Supabase requise. Voir `MATCH_TILE_EXPORT_V1.3.7.md`.

## V1.3.6 — Système d’export
- Export PNG Match réécrit sur le moteur commun `BLEUS3000_EXPORT`.
- Correctif du bloc rouge parasite provenant des pseudo-éléments du scoreline lors de la sérialisation SVG.
- Inlining local des images et backgrounds pour sécuriser CORS.
- Bouton **TÉLÉCHARGER LE BUT** : télécharge désormais le fichier vidéo associé au but (Supabase Storage ou URL vidéo directe), et non une capture PNG de la tuile.
- Retina/iPhone et noms de fichiers propres.
- Les exports Joueur, Onze/Five et Liste réutilisent le gestionnaire commun.
- Aucune migration Supabase requise. Voir `EXPORT_SYSTEM_V1.3.6.md`.

## V1.3.5 — Synchronisation sélectionneurs → Staff
- Toute saisie de sélectionneur dans une feuille matérialise/réutilise une entité Staff `selectionneur`.
- `matches.coach_id` est synchronisé avec `sheet_coach_name`.
- Backfill historique : 945 matchs avec un nom de sélectionneur, 0 liaison manquante.
- Migration : `migration déjà appliquée directement sur le projet Supabase`.

## V1.3.4 — Recherche 3615 transversale locale
- Index local IndexedDB couvrant les principaux référentiels et leurs relations.
- Recherche multi-blocs et multi-critères sans requête Supabase à chaque frappe.
- Matchs indexés avec compositions, faits, arbitrage, sélectionneur, lieu, compétition, maillot, ballon et médias.
- Joueurs indexés avec dates, stats, numéros, postes, accomplissements et historique relationnel.
- Abréviations, accents, pluriels et fautes légères pris en charge.
- Résultats ouvrant directement la fiche / tuile / feuille / but concerné.
- Aucune migration Supabase requise. Voir `SEARCH_3615_V1.3.4.md`.

## V1.3.3 — Administration uniquement
- Le site reste public en lecture, sans menu Profil public.
- Suppression de la création de compte et de tout appel frontend `signUp()`.
- Suppression de Supabase Presence, de l’icône utilisateur en ligne et du module social.
- Nouveau lien discret **Administration** dans le footer.
- Après connexion, affichage du **Tableau de bord administrateur** uniquement pour ADMIN / SUPERADMIN.
- Création de nouveaux comptes réellement bloquée côté Supabase par trigger sur `auth.users`.
- RLS `profiles` durcie : ADMIN = propre profil uniquement ; SUPERADMIN = administration des profils.
- Migration : `migration déjà appliquée directement sur le projet Supabase`.
- Documentation : `AUTH_ADMIN_ONLY_V1.3.3.md`.

## V1.3.2 — Optimisation iPhone / Safari iOS
- Viewport dynamique `visualViewport` + `dvh/svh` pour la barre d’adresse et le clavier.
- Navigation recalculée au maximum une fois par frame et plus sur chaque scroll interne.
- Overlays et modales sans double scroll, avec conservation de la position de page.
- Position de scroll des référentiels conservée dans la session.
- Rendu hors écran différé via `content-visibility` pour les grandes listes.
- Images dynamiques en lazy loading / décodage asynchrone.
- Logo UI optimisé : ~1,1 Mo → ~32 Ko ; source HD conservée pour les exports.
- Suppression de plusieurs flashes « Chargement… » quand les données sont déjà en cache/mémoire.
- Recherche interne temporisée sur tactile pour limiter les rerenders pendant la frappe.
- Actions ADMIN principales sticky et compatibles avec le clavier iOS.
- Aucune migration Supabase requise. Voir `MOBILE_IPHONE_V1.3.2.md`.

## V1.3.1 — Indice propriétaire « Équipe type »

- Nouvel indice temporel 0–100 calculé à partir des choix du sélectionneur connus à la date du match.
- Score brut à 4 décimales + confiance séparée + sous-scores explicatifs JSONB.
- Calcul lors de la validation/modification d’une feuille validée, jamais lors de l’affichage.
- Recalcul historique ciblé du match modifié vers les matchs suivants du même mandat.
- Anneau interactif sur la tuile match, compatible tactile/iPhone et sans requête supplémentaire à l’ouverture.
- 759 matchs à XI complet recalculés lors de la migration V1.3.1.
- Migration : `migration déjà appliquée directement sur le projet Supabase`.
- Documentation : `TEAM_TYPE_V1.3.1.md`.

## V1.3 — Cache First Supabase

- Cache mémoire + IndexedDB versionné, TTL par référentiel, déduplication et invalidation ciblée.
- Voir `CACHE_FIRST_V1.3.md`.


## V1.2.10.9 — Export PNG corrigé + accès aux Buts depuis Médias

- L’export PNG des tuiles match ne plante plus lorsqu’une image externe refuse le CORS : les ressources sont inlinées ou neutralisées avant le rendu canvas.
- Le rendu SVG → PNG utilise désormais une data URL autonome pour éviter les canvas contaminés.
- Le bloc **Médias** contient un raccourci **🥅** avec compteur vers les buts du match ; le référentiel Buts s’ouvre directement sur le bon match.
- Aucune migration Supabase supplémentaire.

## V1.2.10.8 — Tuiles match et liens de buts

- Arbitre principal visible sur la tuile match.
- Export PNG d’une tuile match en haute définition.
- Navigation depuis une tuile But vers le match et le fait de jeu exact dans la feuille de match.
- Surlignage temporaire du but ciblé.
- Aucune migration Supabase supplémentaire.

## V1.2.10.7 — Ballon du référentiel dans les médias

- Dans **Médias du match → Ballon du match**, un menu permet de choisir directement un ballon déjà enregistré dans **Base de données · Ballons**.
- La sélection crée la liaison canonique `match_balls` : aucune copie de l’image ou du nom du ballon.
- Aperçu du ballon et de son copyright directement dans la modale.
- Le ballon déjà lié apparaît parmi les médias et peut être délié depuis cette même fenêtre.
- L’import d’une image personnalisée reste disponible comme solution de secours.
- **Aucune migration Supabase supplémentaire.**

## V1.2.10.6 — Feuille de match : médias, capitaine et photo d’équipe

- **Médias** passe sous **Faits de jeu** dans la feuille de match.
- Le capitaine est identifié avec le PNG du brassard tricolore fourni, dans l’affichage et dans l’éditeur.
- Le bloc Médias accepte désormais une **Photo d’équipe** importée ou distante, avec copyright et zoom visuel.
- Pour une base existante, exécuter **`migration déjà appliquée directement sur le projet Supabase`** avant d’ajouter ce nouveau média.

## V1.2.10.5 — Remplaçants automatiques depuis les convoqués

- Dans une feuille reliée à un rassemblement, une case permet de **générer automatiquement le banc** à partir de tous les convoqués qui ne sont pas titulaires.
- Le banc se recalcule en direct dès qu'un titulaire change.
- Les informations déjà saisies pour les remplaçants conservés restent intactes.
- La fonction est facultative et désactivée par défaut.
- Aucun SQL supplémentaire.

## V1.2.10.4 — Composition guidée par le rassemblement

- Si un match est lié à un rassemblement, les champs **Joueur** et **Remplacé par** de la feuille de match deviennent des menus déroulants alimentés par les convoqués.
- Les forfaits sont exclus des choix.
- Plusieurs rassemblements liés restent sélectionnables et actualisent les menus sans recharger la modale.
- Les anciennes valeurs hors liste sont préservées pour ne pas effacer une composition historique existante.
- Sans rassemblement lié, la saisie libre reste inchangée.
- Aucun SQL supplémentaire.

## V1.2.10.3 — Galerie Buts : une page par match

- Une page de galerie correspond à un seul match.
- Navigation précédent/suivant entre les matchs.
- Deux tuiles de buts par ligne sur desktop.
- Si le match ne compte qu’un but français, la tuile prend toute la largeur de la modale.
- Aucun SQL supplémentaire : conserve simplement la migration Storage V1.2.10.2 déjà installée.

## V1.2.10.2 — Upload direct des vidéos de buts

- **Navigation → Buts → ⚙** permet désormais d’importer directement un clip vidéo depuis l’ordinateur ou le téléphone.
- Formats : MP4, WebM, MOV, M4V · 50 Mo maximum.
- Les fichiers sont stockés dans le bucket Supabase `goal-videos`; l’URL externe / YouTube reste utilisable.
- Pour une base existante, exécuter **`migration déjà appliquée directement sur le projet Supabase`** avant d’utiliser l’import fichier.

## V1.2.10 — Validation rapide, Livres, Buts notés & Panini

- **Profil → Validation rapide ⚡** : validation en un clic des feuilles déjà réellement complètes, avec sélection multiple et validation de toutes les feuilles prêtes.
- La validation rapide utilise une RPC dédiée, vérifie la complétude, reconstruit `validated_match_player_stats` et recalcule les statistiques joueurs.
- **Navigation → Livres** : tuiles avec photo/couverture, ISBN, édition, auteur, titre, année, éditeur, notes et copyright.
- **Navigation → Buts** : galerie des buts France avec lecteur interne, URL vidéo éditable, note utilisateur de 1 à 100 %, moyenne communautaire et courbe visuelle en dégradé.
- **Navigation → Panini** : albums en tuiles puis galerie de stickers, avec numéro, joueur lié, image, copyright et tri.
- **Feuille de match → Importer un rassemblement lié** : récupère les joueurs actifs du rassemblement associé, ignore les joueurs déjà présents et les forfaits, puis remplit le groupe/remplaçants. Aucun XI titulaire n’est inventé.
- Pour une base existante, exécuter **`migration déjà appliquée directement sur le projet Supabase`** avant de déployer le frontend V1.2.10.

## V1.2.9 — Recherche 3615 langage naturel étendu

- Croisements joueur + adversaire + compétition + année + résultat + phase.
- Joueur + titulaire/remplaçant + poste + numéro + capitanat.
- Deux joueurs ensemble et croisements buteur/capitaine/titulaire.
- Questions naturelles : « combien », « qui a marqué », premier/dernier match, première/dernière sélection, 100e sélection.
- Faits de jeu : buts, penalties, tête, coup franc, passes décisives, cartons, entrées/sorties et minutes.
- Matchs : victoires/défaites/nuls, sans encaisser, seuil de buts, prolongation, premier match après une compétition.
- Records : plus grosse victoire, dernier 0-0, XI le plus jeune/vieux/expérimenté, capitaines, sélections cumulées, remplacements.
- Matériel : recherches sur maillots, équipementiers, shorts, chaussettes, manches longues et ballons quand ces données sont renseignées.
- Aucun SQL supplémentaire requis.



## V1.2.8 — Recherche 3615 combinatoire

- Recherche directe de confrontations sans écrire « match » : **`France Angleterre`**, `France Brésil`, `France RFA`.
- Adversaire + compétition + édition/année combinables : **`France Angleterre Euro 2004`**, `France Brésil Coupe du monde 2006`, `Angleterre Euro 2024`.
- Joueur + fait de jeu + adversaire : **`Mbappé but Angleterre`**, `Mbappé penalty Angleterre`, `Platini rouge RFA`, `Henry entrée Portugal`.
- Les filtres déjà disponibles (stade, résultat, phase, minute, première/deuxième mi-temps, numéro, capitaine, titulaire) restent cumulables avec ces recherches.
- `penalty`, `tête`, `coup franc`, `jaune`, `rouge`, `entrée` et `sortie` peuvent désormais porter directement l’intention de recherche lorsqu’un joueur est cité.
- Aucun SQL supplémentaire n’est nécessaire.

## V1.2.7 — Copyright photos & référentiel Ballons

- Ajout d’une case **Copyright** lors des imports photo. Lorsqu’elle est cochée, un champ de source précédé automatiquement de **©** apparaît.
- La source s’affiche ensuite dans une capsule discrète, en écriture blanche, en bas à droite de la photo.
- Couverture : joueurs (portrait + photo en match), staff, stades, maillots, médias de match et ballons.
- Suppression de l’icône flèche de redirection / sources sur les tuiles joueurs.
- Nouveau menu Profil **Base de données · Ballons** avec modèle, équipementier, **alias équipementier**, compétition, édition, période, photo, copyright et notes.
- Nouveau sélecteur Ballon dans l’éditeur de feuille de match, avec suggestions selon compétition / édition / année.
- Les associations match ↔ ballon sont enregistrées dans `match_balls`, ce qui rend le référentiel directement exploitable pour les statistiques.
- Les anciens médias `asset_type = ball` sont repris automatiquement dans `football_balls` sans suppression de l’historique. Les futurs médias ballon restent synchronisés par trigger.
- Pour une base existante, exécuter **`migration déjà appliquée directement sur le projet Supabase`** avant de déployer le frontend V1.2.7.


## V1.2.6 — Stats fun des XI

- Ajout d’un bloc **Stats fun des XI** dans l’onglet Records.
- Records : XI le plus jeune, XI le plus âgé, XI le plus expérimenté, XI le moins expérimenté, plus jeune capitaine et capitaine le plus âgé.
- Les records utilisent uniquement les matchs disposant de 11 titulaires identifiés ; les records d’âge exigent les 11 dates de naissance.
- L’expérience est calculée à la date du match, match concerné inclus, à partir de l’historique réel des apparitions.
- Les feuilles de match affichent **Âge moyen du XI** et **Sélections moyennes** au-dessus de la composition.
- Aucun SQL supplémentaire à exécuter pour cette version.


## V1.2.5 — Fiabilisation des feuilles & qualité des archives

- Nouveau **Centre de qualité des feuilles** : taux de complétude, états, compteurs par information manquante, filtres cliquables et progression par décennie.
- Une feuille `validated` n’est plus automatiquement considérée complète : composition, stade, **ville**, arbitre, sélectionneur, édition, maillot et score sont réellement contrôlés.
- La feuille de match dispose désormais d’un champ **Ville** dédié.
- Le bouton **Valider la feuille** utilise la RPC Supabase `validate_match_sheet` : composition, faits de jeu, relations, maillot, snapshot validé et recalcul des statistiques sont traités dans une seule transaction.
- Toute modification structurante d’une feuille validée la bascule automatiquement en **À revalider** (arbitre, maillot, édition, stade/ville, sélectionneur, score, composition, buts/cartons et corrections éditoriales concernées).
- `matches.chronological_number` devient le numéro canonique en base ; il est recalculé automatiquement lorsque l’historique change.
- **À exécuter sur Supabase avant déploiement :** `migration déjà appliquée directement sur le projet Supabase`.


## V1.2.4 — Numéros chronologiques & administration des feuilles

- Chaque match reçoit un numéro chronologique recalculé automatiquement depuis la date effective.
- Nouveau menu administrateur compact pour contrôler les feuilles de match et leurs informations manquantes.
- Validation visible en vert / jaune / rouge avec accès direct à la feuille concernée.

## V1.2.3 — Matchs déployés, copie 3615, nettoyage maillots

- Référentiel **Matchs** : la tuile affichée charge directement sa feuille, sans accordéon, avec **Médias**, **Composition** et **Faits de jeu** visibles.
- Recherche **3615** : chaque groupe de résultats possède un bouton **Copier** pour récupérer toute la liste (ex. tous les buts d’un joueur dans une compétition).
- Référentiel **Maillots** : ordre chronologique automatique.
- Les éléments **shorts / chaussettes / patchs** ne sont plus affichés dans les tuiles Maillots ni dans les feuilles de match ; les variantes de maillot restent disponibles.
- Feuille de match : suppression du menu **Entité principale** ; l’édition canonique détermine automatiquement l’entité parent.
- Modification d’un match : suppression du menu **Tag de section** et retour au rattachement automatique.


## Interface outils

- **Five supprimé** de la navigation et de la bibliothèque de compositions.
- **Onze** et **Liste** disposent chacun de leur icône directement dans la barre d’outils.
- L’icône **Calendrier** est retirée de la barre d’outils ; le calendrier reste accessible depuis le bloc Calendrier de l’accueil et ses boutons dédiés.
- Le menu Profil affiche désormais **Mes Onze**.

## V1.2.1 — Recherche 3615 partout

- La barre 3615 interroge désormais les **joueurs, matchs, rassemblements, compétitions/éditions, adversaires, staff, arbitres, stades et maillots** en même temps.
- Les résultats ouvrent directement le bon référentiel ou la bonne tuile.
- Le moteur statistique comprend notamment : `but de Mbappé pendant la Coupe du monde 2026`, `cartons de Konaté contre l’Espagne`, `matchs au Stade de France en 2024`, `victoires contre la Belgique en 2026`, `passes de Olise pour Mbappé`, `matchs de Deschamps en 2022`.
- Les années/éditions sont maintenant des filtres explicites dans les requêtes statistiques.


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

## V1.1.93 — filtres repliables mobile

- Les barres de filtres des blocs et modales deviennent repliables sur mobile via un bouton **Filtres**.
- Les filtres sont masqués par défaut sur petit écran pour libérer la hauteur visible.
- Le bouton affiche le nombre de filtres actifs et permet de déployer / replier rapidement.


## V1.1.96 — tuiles Matchs

- Suppression de la navigation Précédente / Suivante entre confrontations.
- Suppression du compteur de confrontations dans la tuile Match.


## V1.1.96 — chargement restauré

- Retour au moteur de données de la V1.1.94.
- Le badge INTERNATIONAL / France A est désormais masqué uniquement en CSS, sans modifier les fonctions de rendu ou de chargement.


## V1.1.98 — Navigation

- Barre d’outils du header supprimée.
- Bouton **Navigation** sous Éphéméride.
- Overlay Navigation : **Mon Onze**, **Liste sélectionneur** et tous les référentiels.

## V1.1.98 — correctif chargement accueil

- Correction d’une boucle `MutationObserver` dans les filtres repliables mobile.
- L’observer ne réagit désormais qu’aux vraies barres de filtres et ignore ses propres boutons.
- Les mises à jour sont regroupées via `requestAnimationFrame`.
- Restaure le chargement normal de Calendrier, Résultats, Actus et du rail Navigation.


## V1.1.99 — Navigation dépliante

- Navigation n’utilise plus de fenêtre modale.
- Le panneau se déplie sous le bouton Éphéméride / Navigation et flotte au-dessus des blocs d’accueil.
- Aucun backdrop ni blocage du scroll de la page.
- Fermeture au second clic, au clic extérieur ou avec Échap.


## V1.2.1 — recherche abrégée

La recherche 3615 accepte maintenant les formulations télégraphiques et des alias football : `CDM` / `mondial` → Coupe du monde, `LDN` → Ligue des Nations, `JO` → Jeux olympiques, `PD` → passe décisive, `péno` → penalty, `tit` → titulaire, `cap` → capitaine. Exemple : `Kopa but cdm` est interprété comme « buts de Raymond Kopa en Coupe du Monde ». La détection des stades est désormais stricte afin qu'une compétition ne soit plus confondue avec un stade portant des mots similaires.


## V1.2.2 — dates de décès + Éphéméride

- Champ **Date de décès** dans l’éditeur Joueur.
- Champ **Date de décès** dans l’éditeur Staff / sélectionneur.
- Contrôle naissance → décès côté interface et Supabase.
- L’Éphéméride affiche les anniversaires de décès avec 🕯️ et le nombre d’années écoulées.
- Clic sur un hommage : ouverture de la fiche joueur ou du staff concerné.
- Rafraîchissement automatique de l’Éphéméride après sauvegarde.

## V1.2.10.9 — Export PNG et raccourci Buts
- Correctif de l’erreur navigateur `Tainted canvases may not be exported` sur les exports de tuiles match.
- Les médias externes non compatibles CORS n’empêchent plus l’export complet de la tuile.
- Ajout d’une icône 🥅 dans le bloc Médias pour ouvrir directement la page Buts correspondant au match.
## V1.3.9 — Le Bleu Moyen
Le bloc Statistiques propose désormais une référence statistique fictive calculée depuis les feuilles de match de l'Équipe de France masculine A, avec filtres historiques, couverture des données, évolution, percentiles et comparaison sur les fiches Joueurs. Les agrégats sont produits par un RPC compact et mis en cache localement. Voir `BLEU_MOYEN_V1.3.9.md`.



## V1.3.10 — Onze type sélectionneur
Chaque sélectionneur du bloc Staff dispose désormais d’un module **ONZE TYPE** dérivé des feuilles de match, avec filtres, statistiques contextuelles, détail par poste et garde-fous contre les données historiques manquantes. Voir `STAFF_ONZE_TYPE_V1.3.10.md`.

## V1.3.11 — Validation de feuilles / timeout 57014
Le recalcul historique de l'indice Équipe type n'est plus exécuté dans la transaction de validation d'une feuille. Les matchs concernés sont placés dans une file interne dédupliquée, traitée progressivement par `pg_cron`. Cela évite les timeouts PostgREST lors des validations en série ou des corrections historiques. Voir `VALIDATION_TIMEOUT_FIX_V1.3.11.md`.


## V1.3.12 — Feuilles sans validation
La feuille courante est la source de vérité. Une information ne compte qu’une fois par match, même après plusieurs modifications. Voir `NO_VALIDATION_V1.3.12.md`.


## V1.3.14
Accueil compact, pagination/épinglage des Actus et tag Évènement à venir.


## V1.3.14.3
- Refonte visuelle du bloc Médias des matchs : cartes plus homogènes, cadres plus lisibles, grille médias harmonisée et suppression des chevauchements d’icônes.


## V1.3.14.4
- Attribution d’un maillot à un match : première/dernière date portée synchronisées en base et année portée affichée automatiquement sur la tuile Maillot.
- Saisie d’un stade + ville sur un match : création ou réutilisation automatique de la tuile Stade et liaison `matches.place_id`.


## V1.3.15
- Tuile accueil calendrier : bouton d’épinglage déplacé à droite du numéro de match.
- Compte à rebours retiré des tuiles accueil, remplacé par compétition + chaîne TV.
- Médias de match : cadres centrés, carrés homogènes, aperçu agrandi au survol et au toucher.


## V1.3.15.1
- Suppression complète du média Cartouche.
- Maillot et tous les aperçus médias utilisent désormais exactement le même cadre carré ; plus de chevauchement.


## V1.3.15.2
- Correction de la création automatique des tuiles Stade depuis les matchs, y compris lorsque le stade est défini via les modifications manuelles de la tuile Match.


## V1.3.15.3
- Correction du référentiel Stades après création automatique depuis une tuile Match : nouveau cache versionné pour `places`/`matches` et masquage des lieux sans match affilié.


## V1.3.16
- Export PNG Match rendu tolérant aux blocs absents.
- Flèche d’épinglage accueil réduite.
- Suppression du média YouTube/diffusion dans les feuilles de match.
- Bloc Staff renommé Sélectionneurs avec grille de tuiles plus compacte.


## V1.3.17
- Calendrier accueil : flèche d’épinglage réduite sans réduire les logos de diffusion.
- Confrontation centrée verticalement entre date et séparation.
- Séparateurs Calendrier / Derniers résultats remplacés par une barre bleu-blanc-rouge.
- VS sans cadre ni arrière-plan.
- Noms des pays légèrement agrandis.
- Rendu relancé automatiquement quand les logos des chaînes sont chargés.


## V1.3.18
- Accueil : confrontation réellement centrée entre date et séparation.
- Séparateurs Calendrier/Derniers résultats : dégradé BBR continu inspiré des cadres.
- Pays : affichage français en majuscules, noms agrandis ; référentiel opponents normalisé côté Supabase.
