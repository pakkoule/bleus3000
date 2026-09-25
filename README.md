## V1.1.61.15 — BASELINE / CLEANUP SQL

- Les 36 migrations SQL historiques ont été consolidées dans `SUPABASE_BASELINE.sql`.
- `supabase_setup.sql` a été retiré ; `SUPABASE_FIRST_ADMIN.sql` est conservé.
- Aucun changement Supabase n’est requis sur la production existante.
- Le logo Équipementier est désormais centré horizontalement et verticalement dans sa case Maillot.

> Les noms `MIGRATION_*.sql` éventuellement cités dans l’historique ci-dessous sont des noms historiques ; leurs contenus sont désormais intégrés au baseline unique.

## V1.1.61.14 — CLEANUP sûr

- Nettoyage limité aux éléments audités comme supprimables à 100 %, sans modification de schéma Supabase ni suppression de données.
- Suppression de l’ancien module Statistiques V1.1.39, remplacé par le module V157 actif.
- Suppression de 4 pages de test/prévisualisation et des 10 anciens chiffres PNG France 98 désormais remplacés par `flocages_assets`.
- Retrait de code JS sans consommateur : anciens bindings Onze/Five, indicateur d’espace, helpers joueurs inutilisés, constantes inutilisées et tableau statique `callups`.
- Retrait des styles résiduels du Mur des membres, des anciens raccourcis profil et des anciens modes Largeur/Densité.
- Aucun élément classé « à voir » lors de l’audit n’a été supprimé.
- Aucune migration Supabase nécessaire.

## V1.1.61.13

- Nouveau menu Profil → **Équipementiers** inspiré des Chaînes de diffusion : création/modification, alias, site web et import de logo.
- Nouveau référentiel Supabase `equipment_manufacturers`, tags `reference_scope=equipment`, liens `tag_reference_links` et relation `jerseys.manufacturer_id`.
- Les anciens libellés d’équipementier sont repris automatiquement ; le champ texte `manufacturer` reste synchronisé pour compatibilité.
- Les tuiles Maillots affichent désormais l’équipementier relationnel et son logo ; l’édition d’un maillot utilise un **menu déroulant** d’équipementiers.
- Refonte complète de la **Liste du sélectionneur** : choix de compétition, groupes Gardien → Défense → Milieu → Attaquant, quantités ajustables au total et par poste, recherche nominative avec photo/initiales et blocage des doublons.
- Nouveau rendu graphique de la liste avec header 3615 Bleus + logo, compétition associée, intitulés de postes en gras et noms de joueurs en graisse normale.
- Sauvegarde des listes dans `user_compositions` avec `composition_type=selection_list`, bibliothèque « Mes listes » et export PNG/JPG.
- Aucun changement Supabase supplémentaire pour cette version : correctif front uniquement sur l’affichage compact des équipementiers.

## V1.1.61.11

- Suppression complète du système de **raccourcis favoris du profil** (interface, préférences et assets front associés).
- Suppression des contrôles **Largeur & densité** et de leur modale.
- Le bandeau de rappel des autres référentiels en haut des blocs est supprimé : chaque bloc s’ouvre désormais comme un espace autonome.
- Le champ de recherche du référentiel reste systématiquement présent, avec un libellé adapté au bloc ouvert.
- Filtres relationnels enrichis : Matchs (stade, sélectionneur, état de feuille), Compétitions (type + section), Maillots (sélection + compétition liées).
- Ajout d’une **recherche texte dans le calendrier complet**.
- Sur les tuiles du calendrier d’accueil, le **lieu est affiché à droite de la date**.
- L’**Éphéméride est fermée par défaut** au chargement.
- La modale **Modifier le match** est élargie et organisée sur deux colonnes sur desktop pour afficher tous les champs et boutons sans débordement horizontal.
- Aucune nouvelle migration Supabase nécessaire pour cette version.

## V1.1.61.10

- Accueil : header « Prochains matchs » compact sur une seule ligne avec bouton « Tout le calendrier » réduit.
- Pagination des 4 prochains matchs déplacée dans le header du calendrier.
- Suppression de la pagination basse de la Base joueurs ; la pagination haute reste la seule navigation de cette table.
- Alignement vertical des blocs Base joueurs / Prochains matchs : leurs bordures inférieures tombent au même niveau sur desktop.
- Aucune migration Supabase supplémentaire.

## V1.1.61.9

- Accueil : **4 prochains matchs par page** au lieu de 5.
- Pagination du bloc Prochains matchs réactivée pour parcourir la suite du programme sans ouvrir le calendrier complet.
- Ajout d’une action **↑ Épingler** sur les tuiles de match pour les éditeurs/admins : un seul match peut être placé en tête, et il y reste tant qu’il n’est pas terminé.
- Persistance Supabase avec désépinglage automatique sur statut `FT / FINISHED / COMPLETED…`.
- Migration `MIGRATION_V1.1.61.9_HOME_CALENDAR_PIN.sql` appliquée au projet `bleus3000`.

## V1.1.61.8

- Accueil : les **5 prochains matchs** sont affichés sous forme de tuiles compactes avec drapeaux, diffusion, tags, accès à la feuille de match, tuile Match et roue d’édition.
- Base joueurs : lignes légèrement réduites, sélection au clic et **favoris joueurs** synchronisés au profil, limités à 10 et remontés en tête de liste.
- Suppression du **Mur des membres** de l’interface.
- Ajout d’une **Éphéméride** dans le rail de gauche : anniversaires de joueurs et anniversaires de matchs du jour, avec liens vers les fiches correspondantes.
- Migration Supabase `MIGRATION_V1.1.61.8_PLAYER_FAVORITES.sql` appliquée.

## V1.1.61.7

- Nouveau niveau **Familles de compétitions** : une seule tuile pour les déclinaisons d’une même compétition selon les sélections.
- EURO, Qualifications EURO, Coupe du monde, Qualifications Coupe du monde, Jeux Olympiques, Ligue des Nations, Tournoi de France et Mondial de Montaigu sont regroupés.
- Les **tags de section** sur la tuile mère filtrent directement les éditions de la sélection concernée.
- Les phases finales et les qualifications restent volontairement séparées.

## V1.1.61.6

- L'enregistrement d'une fiche joueur n'ouvre plus le référentiel **Statistiques** en arrière-plan : son cache est seulement invalidé et sera recalculé à sa prochaine ouverture.
- Les **tags de poste cliquables** sont maintenant affichés directement sur la ligne `Postes ·` de la tuile joueur.
- Les tags de poste sont retirés de la rangée de tags générale en bas de la tuile pour éviter le doublon.
- L'ordre des tags privilégie le poste principal puis les postes secondaires de la fiche, avant les éventuels postes historiques issus des feuilles de match.
- Aucun changement Supabase supplémentaire par rapport à V1.1.61.5.

## V1.1.61.5

- Correction du bloc **Accomplissements** sur les tuiles joueurs : retour à la ligne des icônes et suppression du débordement horizontal.
- Texte des pastilles de quantité (`×1`, `×41`, etc.) forcé en blanc pour un contraste correct.
- Les cases **Postes** de l'éditeur joueur sont maintenant reliées au référentiel canonique et aux tags de poste.
- À l'enregistrement, les anciens tags de poste ne sont plus conservés aveuglément : ils sont recalculés depuis la fiche joueur et les feuilles de match.
- Trigger Supabase ajouté sur `players.primary_position / secondary_positions` pour garantir la synchronisation même hors de cette modale.

## V1.1.61.4

- Correctif définitif anti-**canvas tainted** sur les exports Onze/Five.
- Toutes les images HTTP(S), y compris les URL apparemment locales pouvant rediriger vers Supabase/CDN, passent désormais par `fetch(CORS) -> Blob local`.
- Chaque image est testée dans un mini-canvas isolé avec `getImageData()` avant d’être autorisée dans le canvas d’export.
- Une image refusée est remplacée par son fallback avant le premier `drawImage()` sur le canvas final.
- Aucune migration Supabase supplémentaire.

## V1.1.61.3

- Correction définitive du **canvas tainted** sur les exports PNG/JPG Onze/Five.
- Les images externes (photos joueurs, drapeaux SVG) ne sont plus dessinées directement : elles passent obligatoirement par `fetch` CORS puis un Blob local.
- Si une source distante refuse CORS, elle est ignorée au profit du fallback (initiales / drapeau emoji), sans bloquer tout le fichier.
- Aucun changement Supabase.

## V1.1.61.2

- Correctif du rendu **PNG/JPG** des outils Onze / Five : rechargement robuste des assets graphiques (logo, brassard, maillot, chiffres de flocage).
- Réintégration des **drapeaux** dans l’export lorsque la composition est liée à un match.
- Fallback de sécurité : si un asset de flocage ne charge pas, le numéro reste dessiné en texte pour éviter les emplacements vides.

## V1.1.61.1

- Correctif d’affichage du référentiel **Compétitions** : le catalogue occupe désormais toute la largeur de la fenêtre au lieu d’être comprimé dans la première colonne de `.ref-list`.
- Responsive conservé : 2 colonnes sur écran large, 1 colonne sur petit écran.
- Cache-busting CSS/JS actualisé pour éviter de conserver l’ancien rendu après déploiement.

## V1.1.61.0
- Maillot associé affiché directement sur chaque tuile de match.
- Sélecteur de maillot des feuilles de match piloté par les associations **sélection + compétition** ; le nom affiché est le nom de la tuile Maillot.
- Correction du plan de superposition de l’éditeur de feuille de match.
- Nouveau référentiel relationnel de **22 postes** : normalisation des anciens libellés précis, synchronisation automatique des tags joueurs depuis les feuilles de match, et clic sur un tag poste pour retrouver les matchs joués à ce poste.
- Nouveau catalogue canonique de **53 compétitions principales / 557 éditions** avec alias fusionnés, tags d’entités, sous-tags d’éditions et listing des matchs par boutons `+`.
- Simplification de l’éditeur Maillot : conservation des champs utiles, relations équipes/compétitions, photos, notes et sources.
- Onze / Five : drapeaux dans le choix de match et nouveau rendu **Numéros personnalisés** (badge rond bleu, numéro 0–99, flocage choisi dans le profil).
- Suppression complète de l’extracteur de fichiers FFF, de son interface et de sa Netlify Function.
- Migration Supabase : `MIGRATION_V1.1.61_RELATIONS_POSTES_COMPETITIONS.sql`.

## V1.1.60.4
- Correctif du bouton **Modifier la feuille de match**.
- L’éditeur s’ouvre désormais indépendamment du chargement du module Maillots ; le sélecteur de maillot est chargé après ouverture.
- Le clic recharge la feuille depuis Supabase si son état local est incomplet et affiche une erreur explicite en cas d’échec.

## V1.1.60.3
- Simplification des tuiles **Maillots** : photo, année, équipementier, tags équipes, séparation, tags compétitions uniquement.
- Ajout du bouton **+** : la tuile se déplie pour afficher les matchs réellement liés au maillot.
- Clic sur un tag équipe : ouverture du panneau en filtrant les matchs sur cette sélection française.
- Création du lien relationnel **Maillot ↔ Feuille de match** via `match_jerseys`.
- Ajout d’un sélecteur **Maillot utilisé par la France** dans l’éditeur de feuille de match.
- La feuille de match affiche ensuite le maillot associé et la tuile Maillot retrouve réciproquement les matchs concernés.
- Nouvelle migration `MIGRATION_V1.1.60.3_MAILLOTS_MATCHS.sql`.

## V1.1.60.2
- Correction définitive de la largeur des modules **Maillots** et **Statistiques** : leurs conteneurs spécialisés occupent désormais toutes les colonnes de `#referenceEntries`.
- Les cartes Maillots conservent une largeur minimale lisible et passent de 3 à 2 puis 1 colonne selon la largeur disponible.

## V1.1.60.1
- Suppression des anciens flocages simulés (polices, ombres et contours CSS).
- Les seuls styles proposés sont désormais les PNG réellement découpés depuis `flocages.zip`.
- Le choix du style est centralisé dans **Profil → Personnalisation** ; le sélecteur a été retiré de Onze / Five.
- La préférence s’applique aux **Onze / Five** et aux **numéros affichés sur les tuiles joueurs**.
- Les anciens identifiants de styles sont automatiquement remappés vers les nouveaux assets lorsqu’une préférence historique existe.

## V1.1.60
- Correctifs visuels ciblés sur **Maillots** et **Statistiques**.
- Ajout des flocages découpés chiffre par chiffre dans `flocages_assets/`.
- Moteur de flocage global : le style choisi peut être réutilisé sur l’ensemble du site.
- Préparation des numéros portés par sélection via `match_appearances.shirt_number`.
- Préparation de la liaison feuille de match ↔ maillot via `match_appearances.jersey_id`.
- Migration : `MIGRATION_V1.1.60_NUMEROS_FLOCAGES.sql`.

# 3615 Bleus — V1.1.57

Package GitHub-ready complet pour **3615 Bleus**.

## V1.1.57 · Statistiques V2

Le référentiel **Statistiques** passe en V2 avec cinq vues :

- **Parcours Bleu** : U17 → U18 → U19 → U20 → Espoirs → A, volumes et taux de conservation ;
- **Générations** : année de naissance, parcours individuel, niveau maximal atteint et conservation entre catégories ;
- **Connexions** : coéquipiers les plus fréquents et module duos offensifs ;
- **Bilans** : décennie, sélection, sélectionneur, stade, arbitre principal, compétition et adversaire ;
- **Records** : buteurs, sélections et capitanat.

Tous les résultats relationnels sont interactifs : les joueurs ouvrent leur tuile et les détails de bilan/duos permettent d'ouvrir les matchs concernés.

Les indicateurs sont calculés à partir des tables existantes (`player_selection_stats`, `matches`, `match_appearances`, `match_goal_events`, `match_officials`, etc.). Aucune nouvelle table n'est nécessaire.

## Versions précédentes conservées

- V1.1.56 : référentiel U18 Féminines, 105 joueuses reliées au tag U18 F ;
- V1.1.55 : styles de flocage Onze / Five ;
- toutes les migrations et fonctionnalités antérieures restent présentes dans le package.

## Migration

Aucune migration Supabase V1.1.57 n'est requise.


## V1.1.59 — Maillots
Le référentiel Équipements devient **Maillots**. Les fiches sont relationnelles et peuvent être affiliées à plusieurs équipes et plusieurs compétitions, avec séparation visuelle des deux familles de tags. Le système photo prévoit une photo principale et une galerie. Sur une base Supabase existante, exécuter `MIGRATION_V1.1.59_MAILLOTS.sql` avant le premier enregistrement.
