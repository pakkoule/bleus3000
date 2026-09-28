# 3615 Bleus — V1.1.68

## État courant

- Interface globale en **Poppins**.
- Rassemblements : liste courante synchronisée avec forfaits/remplaçants/renforts et import PDF FFF.
- Rassemblements : sélection de tout match France A, passé ou futur.
- Maillots : points tactiques avec **2 couleurs de remplissage + 1 couleur de halo**.
- Feuille de match : choix du short dans la bibliothèque complète, les éléments liés au maillot restant prioritaires.
- Couleurs pays : mode **Uni** ou **Dégradé**, avec angle configurable.
- Production `bleus3000` : migrations V1.1.65, V1.1.66 et V1.1.67 déjà appliquées. V1.1.68 est un correctif front sans migration SQL.

## V1.1.61.47

- Feuille de match : chronologie des faits de jeu rendue plus compacte pour afficher toute la séquence sans déborder.
- Schéma tactique centré dans son bloc.
- Ligne horizontale médiane supprimée du terrain tactique.

## V1.1.61.46

- Référentiel Matchs : une seule tuile par ligne + filtre matchs terminés.
- Maillot affiché uniquement dans la feuille dépliée.
- Relations short/chaussettes/variante sécurisées et affichées dans la tenue portée.
- Chronologie compacte des faits de jeu au-dessus du schéma tactique.
- Schéma : format I.Nom, sans rappel du poste.
- Boutons de modification réservés aux ADMIN/SUPERADMIN.
- Compteur de matchs pour les numéros portés dans les tuiles joueurs.

# 3615 Bleus — V1.1.61.45

Correctif ciblé de l’éditeur de feuille de match.

- Correction de l’erreur PostgreSQL `invalid input syntax for type uuid: "null"`.
- Les apparitions sans lien joueur restent acceptées en brouillon sans être utilisées comme filtre UUID.
- Les faits de jeu nouvellement insérés mémorisent leur identifiant dès la première sauvegarde afin d’éviter leur duplication.
- Le match France–Angleterre affecté a été dédoublonné après sauvegarde de sécurité côté Supabase.

## V1.1.61.44 — Rassemblements / équipements / médias matchs

Recherche joueurs en saisie texte, import d’images pour les éléments de tenue, navigation stade/ville et confrontations, bibliothèque médias matchs (unes, billets, YouTube).

## V1.1.61.42 — Correctif événements rassemblement
- Remplacement : sortant rouge → entrant vert, dans le même sens que l’éditeur.
- Forfait simple : joueur rouge barré uniquement, sans flèche ni « À confirmer ».

# 3615 Bleus — V1.1.61.40

## Rassemblements & convocations enrichis
- La tuile Rassemblement devient un dossier : liste annoncée, liste actuelle, forfaits, remplaçants, renforts, matchs, sélectionneur et date d’annonce.
- `callup_announced_players` conserve l’instantané de la liste initialement annoncée sans l’écraser.
- `callup_roster_history` journalise les modifications de liste : forfaits, remplacements, renforts, ajouts et retraits.
- Comparateur de deux rassemblements : entrants, sortants et joueurs conservés.
- Statut automatique selon les feuilles liées : Convoqué, Forfait, Réserviste, Remplaçant, Non entré, Titulaire ou Entré en jeu.
- Rassemblements reliés aux éditions de compétition via `callup_competition_editions`, sans dupliquer les joueurs.
- PDF FFF de la convocation affiché avec une icône dédiée.
- Conférences et autres diffusions liées à plusieurs chaînes via `callup_broadcast_channels`, avec URL YouTube/diffusion.
- Bloc Événements d’accueil : typographie agrandie, récapitulatif des forfaits et remplacement visuel rouge → vert.

# 3615 Bleus — V1.1.61.38


## V1.1.61.36 — Maillots · tenue complète relationnelle
- Les tags compétition des tuiles Maillots réutilisent désormais leur style canonique défini dans Profil → Tags.
- Nouvelle bibliothèque de shorts et chaussettes, réutilisables et associables en plusieurs variantes au même maillot.
- Variantes de maillot : manches, domicile / extérieur, gardien et spéciale.
- La feuille de match mémorise l’équipement réellement porté : maillot, short, chaussettes, variante et patchs.
- Bibliothèque de patchs reliée aux tags compétition ENTITÉ / ÉDITION afin d’éviter les doublons.
- Exemple de flocage affichable sur la tuile.
- Priorisation automatique des maillots selon période, compétition et adversaire, avec choix manuel conservé.
- Vue Chronologie et galerie filtrable par sélection.

# 3615 Bleus — V1.1.61.32 · France A masculine uniquement

3615 Bleus est désormais centré exclusivement sur l’Équipe de France masculine A (`FRA-A-M`).

## Périmètre actif
- Internationaux A masculins uniquement.
- Matchs, calendrier, feuilles de match, faits de jeu et statistiques de la France A.
- Compétitions, éditions, adversaires, stades, arbitres, sélectionneurs, maillots, équipementiers, diffuseurs et sources uniquement lorsqu’ils sont reliés à la France A.
- Les anciennes catégories ne sont plus publiées ni proposées par l’interface.

## Sauvegarde avant recentrage
La base complète antérieure au recentrage est conservée dans Supabase sous le schéma `backup_pre_a_only_20260926`. Ne pas supprimer ce schéma : il permet une restauration contrôlée des anciennes données. Voir `BACKUP_PRE_A_ONLY_20260926.md`.

## Supabase
`SUPABASE_BASELINE.sql` représente le baseline GitHub de cette version et se termine par une purge canonique France A masculine. `SUPABASE_FIRST_ADMIN.sql` reste disponible pour l’initialisation du premier administrateur.

## Déploiement
Le dossier est GitHub-ready et prévu pour Netlify + Supabase.

## V1.1.61.32 — Poppins partout / Recherche 3615 minimale

- Poppins devient l’unique police d’interface, scores compris.
- European Teletext est retirée du projet et de ses assets.
- La Recherche 3615 est recentrée et réduite à sa barre seule : plus d’en-tête, sous-titre, aide ni exemples.

## V1.1.61.31 — Correctif grille accueil

Correction du chargement CSS du dashboard et verrouillage du layout : Recherche 3615 pleine largeur, puis À venir / Derniers résultats / Événements en trois colonnes égales. Les cartes résultats reprennent désormais exactement les dimensions des cartes de matchs à venir ; le score coloré reste l’indicateur de victoire, nul ou défaite.

## V1.1.61.30 — Accueil / événements / résultats

L’accueil est organisé en trois blocs sous Recherche 3615 : matchs à venir, derniers résultats et événements de rassemblements. Les résultats utilisent un code couleur vert/jaune/rouge sur la case score. Les rassemblements disposent désormais d’événements datés via `callup_events` (annonce, actu, forfait, remplacement, renfort, mise à jour).

## V1.1.61.29 — Interface

Poppins est utilisée sur toute l’interface, scores compris. Le bloc profil vit dans le header, et les cases pays du scoreboard adaptent leur fond au maillot France et au drapeau adverse.

## V1.1.61.25 — Mode Formation

- Nouveau référentiel `tactical_formations` + `tactical_formation_slots`.
- Éditeur graphique de schémas tactiques : 11 pions, coordonnées X/Y et poste canonique par emplacement.
- Les 7 formations déjà présentes ont été migrées dans Supabase et servent de base au nouveau mode.
- La géométrie ne se modifie jamais depuis une feuille de match : la feuille sélectionne un modèle et affecte les joueurs aux 11 emplacements figés.
- `matches.sheet_formation_id` conserve la formation et `matches.sheet_formation_snapshot` fige la géométrie utilisée pour la restitution historique.


## V1.1.61.24 — SMART SEARCH

- La recherche 3615 comprend désormais des requêtes statistiques en langage naturel en plus de la recherche classique.
- Exemples : `Passe décisive de Olise pour Mbappé`, `Buts de Thierry Henry en première mi-temps`, `Cartons rouges de Desailly`, `Matchs où Griezmann et Giroud étaient titulaires`, `Buts après la 80e minute`.
- Filtres reconnus : joueur, buteur, passeur, adversaire, compétition/famille, stade, phase, minute/période, cartons, titulaire, capitaine, numéro porté, remplacement, doublé/triplé et sélectionneur.
- Les résultats ouvrent directement le match ou sa feuille de match.
- Les faits de jeu « but » possèdent désormais un type (`jeu`, `tête`, `coup franc`, `penalty`, `autre`) afin d'alimenter les recherches futures comme `buts de la tête`.
- Index Supabase ajoutés sur les relations joueur / match / passeur afin de garder les recherches rapides quand les feuilles historiques seront nombreuses.

## V1.1.61.21 — Recherche accueil
La table joueurs de l’accueil a été remplacée par la recherche universelle 3615 ; la recherche du header a été retirée pour éviter le doublon. Les résultats utilisent un thème clair et affichent la photo/logo de la tuile quand disponible.


## V1.1.61.23 — Internationaux A · lignes déployables

- Remplacement de la grille de petites tuiles joueurs par une liste horizontale dense : portrait, nom, ordre d’apparition, sélections et buts.
- Chaque ligne se déplie au clic et affiche la fiche complète, les tags, numéros portés, accomplissements, sources et les matchs liés aux feuilles de match.
- Une seule fiche peut être ouverte à la fois.
- Nouveau champ `players.action_photo_path` : photo en match facultative utilisée comme fond de la fiche déployée avec fondu progressif vers le fond de tuile.
- L’éditeur joueur permet de gérer séparément le portrait et la photo en match.
- Responsive mobile dédié à ce nouvel affichage.


## V1.1.61.22 — Rassemblements
- Nouveau référentiel **Rassemblements**.
- Date d’annonce de la liste, dates de début/fin, lieu et notes.
- Joueurs avec statuts : sélectionné, forfait, remplaçant, réserve.
- Un remplaçant peut être relié au joueur qu’il remplace.
- Plusieurs matchs à venir peuvent être rattachés à une tuile rassemblement.
- Les rassemblements à venir sont intégrés au calendrier sans être traités comme des matchs.
- Création/modification réservée aux ADMIN et SUPERADMIN.

## V1.1.61.33 — Scoreboards pays & Éphéméride
- Recherche 3615 centrée.
- Scoreboards affinés avec noms complets des pays dans les cases.
- Suppression des légendes pays redondantes sous les scores.
- Gestion admin des couleurs pays via le Profil (`country_display_colors`).
- Éphéméride plus lisible.


## V1.1.61.35 — Largeur Internationaux & centrage 3615
- La liste Internationaux A s'étend sur toute la largeur du référentiel.
- Les lignes dépliées utilisent la même largeur complète.
- Le bloc Recherche 3615 est centré géométriquement sur toute la grille d'accueil, indépendamment des trois colonnes situées en dessous.


### V1.1.61.35
Correction du centrage de la Recherche 3615 : elle span désormais les 3 colonnes et reste centrée au-dessus de Derniers résultats.

## V1.1.61.39 — Joueurs & carrières
- Timeline internationale compacte au bas de la fiche joueur : convocations/rassemblements, matchs, buts et capitanats.
- Ligne Première / dernière sélection.
- Postes navigables vers les matchs joués au poste concerné.
- Clic sur un maillot numéroté : matchs joués avec ce numéro, avec maillot physique associé si disponible.
- Tags des compétitions disputées ajoutés à la ligne des tags en reprenant l’apparence canonique.
- Suppression du contexte cliquable GENERAL.
- Mini-fiche au survol / clic avant ouverture complète.
- Comparateur jusqu’à 3 joueurs depuis les filtres, champs d’export sélectionnables et export PNG.
- Export PNG individuel d’une fiche joueur.
- Historique des matchs paginé par 5 avec ordre chronologique/déchronologique.

## V1.1.61.41 — Rassemblements ergonomie
La gestion des rassemblements gagne la recherche nominative, l’ajout rapide depuis les listes précédentes, la création de nouveaux internationaux, l’état « Non remplacé » et une pagination de 5 événements sur l’accueil.


## V1.1.61.43
- Recherche 3615 : résultats en overlay.
- Événements rassemblement : codes couleur forfait/remplacement restaurés.
- Nouveau joueur depuis une liste : tuile créée et rechargée immédiatement.
- Matchs du rassemblement : recherche sur tout l’historique France A, y compris les matchs passés.


## V1.1.66 — Rassemblements : événements ↔ historique + nouveaux appelés PDF

- Les compteurs Forfaits / Remplacements utilisent désormais les événements explicites en plus du statut courant des joueurs.
- Les événements `withdrawal`, `replacement` et `reinforcement` alimentent l’historique des modifications.
- Les forfaits ayant conduit à un remplacement restent comptabilisés même si le joueur n’est plus présent comme ligne `withdrawn`.
- L’import PDF FFF permet de créer manuellement un joueur non reconnu : création de sa tuile International France A, date de naissance reprise du PDF, puis sélection automatique dans l’import.
- Migrations associées : `MIGRATION_V1.1.65_GATHERING_EVENT_HISTORY_LINKS.sql` puis `MIGRATION_V1.1.66_RECONCILE_CALLUP_ROSTER_EVENTS.sql`.

## V1.1.64 — Import PDF FFF

Les tuiles Rassemblements peuvent importer une liste FFF au format PDF avec aperçu et rapprochement des joueurs avant validation. Voir `FIXES_V1.1.64.md`.

## V1.1.67 — Matchs historiques · shorts · halo tactique · dégradés pays

- Le sélecteur de matchs des rassemblements permet explicitement de sélectionner tout l'historique France A.
- Le short d'une feuille de match peut être choisi dans toute la bibliothèque, même si aucun short n'est encore associé au maillot sélectionné.
- Les points tactiques utilisent désormais deux couleurs de remplissage et une troisième couleur exclusivement dédiée au contour/halo lumineux.
- Le halo tactique est indépendant des couleurs de pays et n'affecte pas le scoreboard France.
- Les couleurs manuelles des pays peuvent être affichées en aplat ou en dégradé avec un angle de 0 à 360°.
- Migration : `MIGRATION_V1.1.67_COUNTRY_GRADIENTS.sql`.


## V1.1.68 — dédoublonnage des actualités forfait/remplacement

- Un remplacement constitue désormais l’unique actualité pour le joueur sortant et son remplaçant.
- Une carte `Forfait` automatique n’est plus générée lorsqu’un événement `replacement` couvre déjà ce joueur sortant.
- Même dédoublonnage dans la section `Mise à jour` des tuiles Rassemblement.
- Les forfaits sans remplaçant restent affichés normalement.
- Aucun changement de schéma Supabase.
