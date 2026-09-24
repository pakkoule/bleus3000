# 3615 Bleus

## V1.1.46 — Jeux Olympiques 2024 / OLYMPIQUE U23

Cette version importe les 6 matchs de la France U23 aux Jeux Olympiques de Paris 2024 via TheSportsDB. Les rencontres sont conservées dans le référentiel technique `FRA-ESP-M`, mais affichent le tag de section **OLYMPIQUE U23**. La compétition **Jeux Olympiques 2024** et le tag compétition **JEUX OLYMPIQUES** sont ajoutés. Le prochain `calendar-sync` effectue automatiquement l'import si les 6 matchs ne sont pas déjà présents, puis l'opération devient idempotente.

## V1.1.45 — Olympique U23

La sélection masculine U23 reste techniquement rattachée au référentiel `FRA-ESP-M`, mais les rencontres des Jeux olympiques disposent désormais du tag de section distinct **OLYMPIQUE U23**. Les rencontres U21 conservent **ESPOIRS**. Le sync TheSportsDB et le pilote historique appliquent automatiquement ce tag aux événements U23 dont la compétition est olympique.

## V1.1.44 — France U23 / Espoirs féminines

Import du classeur fourni `Bleus3000_Espoirs_Feminines_U23_2014_2026_V1.xlsx` : 72 matchs, 133 joueuses, 25 lignes de statistiques carrière vérifiées FFF, 152 observations joueuse-match, 22 buts détaillés et 4 périodes de sélectionneur. Le tag existant `ESPOIRS F` est réutilisé. L'import se lance une seule fois via la fonction Netlify `import-u23f`. Voir `U23_FEMININES_V1.1.44_IMPORT.md`.

## V1.1.43 — Calendrier paginé, affiches mises en avant, UI allégée
- `VS` remplace l'absence de score sur les rencontres futures.
- Calendrier accueil paginé (4 rencontres/page).
- Cadre de diffusion personnalisable et automatique sur France A M/F, avec override par match.
- Base joueurs à 10 lignes/page sur l'accueil.
- Raccourcis icône uniquement, accomplissements avec infobulle, descriptions et titularisations retirées.
- Origine fournisseur et attribution du modificateur retirées de l'affichage.
- Indicateur supérieur supprimé et vague rouge ajoutée au header.

## V1.1.41 — Diffusions, ergonomie joueur et historique TheSportsDB

Cette version ajoute un gestionnaire de chaînes de diffusion dans le menu profil, des entités et tags de diffusion avec logos, un calendrier plus compact et des noms de pays sans suffixe de section. La sauvegarde de la fiche joueur reste ouverte afin d'enchaîner les contextes de sélection. Les indicateurs visuels « manuel » ont été retirés.

TheSportsDB peut être exploité pour enrichir l'historique via ses calendriers précédents et ses calendriers de saison. L'import historique doit rester progressif et respecter les lignes `verified` / `locked`.


## V1.1.40 — Correctif Tags Compétitions → Calendrier

- Les tags disposent maintenant d’une portée persistante (`selection`, `competition`, `general`).
- Un nouveau tag de compétition est immédiatement visible dans **Calendrier → Ajouter un match → Tag de compétition**.
- Le cache relationnel est rechargé après création/modification d’un tag : plus besoin d’attendre un nouveau chargement complet.
- La création automatique d’une entrée Compétitions est conservée ; un échec ne laisse plus de tag orphelin.
- Le tag **TOURNOI INTERNATIONAL DE LIMOGES** a été réparé et relié à son entrée Compétitions.

Voir `FIX_TAG_CALENDAR_V1.1.40.md` et `MIGRATION_V1.1.40_TAG_SCOPE_CALENDAR.sql`.

---

# 3615 Bleus V1.1.38


## V1.1.38 — Création calendrier + tags 5 couleurs

- Nouveau bouton **+ Ajouter un match** dans le calendrier pour les éditeurs/admins.
- Classement automatique : date passée → **Matchs passés** ; date future → **À venir**.
- Création relationnelle des adversaires, compétitions et lieux si nécessaire.
- Les matchs créés apparaissent aussi immédiatement dans le référentiel **Matchs**.
- Les tags acceptent désormais des dégradés de **2 à 5 couleurs** avec aperçu en direct.
- Migration : `MIGRATION_V1.1.38_CALENDAR_CREATE_TAG_GRADIENTS.sql` (déjà appliquée au Supabase de production).

Voir `CALENDRIER_V1.1.38_CREATION_TAGS_5_COULEURS.md`.

**Évolution principale : calendrier TheSportsDB + corrections éditoriales.** Un seul sync Netlify alimente les matchs futurs/récents, le live est affiché dans le calendrier, le référentiel Matchs est réparé et filtrable, et chaque champ API peut être corrigé manuellement sans bloquer la synchronisation des autres champs.

Ajout du référentiel **France U17 Masculin 2004–2026** (376 joueurs), avec continuité des profils globaux, tag U17 Masculin existant et contexte GENERAL. Voir `MIGRATION_V1.1.29_U17_MASCULIN.sql`.

# Bleus 3000 V1.1.22

Correctif de démarrage Supabase : validation de la session persistée avant exposition du client aux modules, refresh automatique des JWT temporellement invalides, et retour en mode public si une session locale est irrécupérable.

# Bleus 3000 — V1.1.5


## V1.1.21 — recherche et base joueurs

La base globale de l’accueil dispose désormais d’un filtre par numéro porté, d’un accès direct à la tuile joueur par UUID, d’un surlignage des noms trouvés et d’une recherche plus tolérante aux fautes de frappe. La recherche universelle ne mélange plus les anciens joueurs de démonstration avec le registre Supabase : un joueur réel n’est proposé qu’une seule fois. Les derniers restes beige/marron/doré de Cotation 3000 ont également été remplacés par la palette Bleus 3000.

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

## V1.1.19 — Accomplissements · Capitanat
- Ajout du premier accomplissement structuré : `Capitanat`.
- Icône brassard affichée dans les tuiles avec compteur optionnel `×N` en bulle bleu marine bichrome.
- Sélection et saisie du nombre depuis l’éditeur de joueur.
- Valeur enregistrée par joueur et par sélection dans `player_achievements`.


## V1.1.19
- correction du rendu des icônes d’accomplissements dans les tuiles ;
- gestionnaire **Accomplissements** dans le menu Profil ;
- import PNG/JPG/WebP, normalisation automatique sur canevas transparent 128×128 ;
- affiliation d’un accomplissement à un ou plusieurs référentiels ;
- prise en charge de plusieurs postes par joueur (`primary_position` + `secondary_positions`) ;
- filtre Poste de l’accueil compatible avec les postes secondaires ;
- suppression de l’icône Sources en haut des tuiles et de la ligne Source en pied de tuile.


## V1.1.20 — France A Féminine enrichie
- 339/339 joueuses avec Victoires, Nuls et Défaites issus du référentiel V2.
- 51 associations de numéros de maillot observés pour 44 joueuses.
- 4 capitanats vérifiés dans l’échantillon fourni, enregistrés comme minimum vérifié non exhaustif.
- Les 12 écarts entre le compteur de sélections V1 et la source V/N/D sont conservés et tracés via `vnd_source_selections` / `vnd_coherence`, sans écraser la valeur V1.


## V1.1.24 — Recherche par nom
Correction du surlignage des correspondances et ajout de variantes de recherche par mots/suffixes du nom (ex. `Platini` → Michel Platini).


## V1.1.24 — moteur de recherche unifié
Le moteur de recherche a été réécrit côté frontend uniquement. Aucun changement de schéma ou de données Supabase. Les recherches par prénom, nom, nom complet, préfixes et fautes légères utilisent désormais la même logique dans la base d’accueil, Sélections et la recherche universelle.


## V1.1.25 — Accomplissements dans les fiches joueur

Le mode modification d’une tuile joueur possède désormais un sélecteur d’accomplissement, un bouton `+ Ajouter`, un champ numérique facultatif et un retrait individuel. Les choix proviennent du catalogue d’accomplissements affiliés au référentiel Sélections.

## V1.1.26 — Espoirs relationnels
- 318 joueurs France Espoirs/U21 reliés aux identités joueurs existantes.
- Tag ESPOIRS réutilisé et cliquable sur les tuiles joueur.
- Tag GENERAL virtuel : somme des statistiques de toutes les sélections liées au joueur.
- Sélecteur de contexte dans l’éditeur joueur pour modifier la ligne statistique d’une sélection précise.
- 226 matchs Espoirs sous forme de tuiles relationnelles.
- 8 sélectionneurs, 33 arbitres principaux et 77 autres officiels dans Personnel & Officiels.
- 809 observations joueur-match et 25 buts documentés conservés en base.

## V1.1.26 — Référentiel Espoirs relationnel

Le référentiel France Espoirs masculin 2004–2026 est intégré au même graphe d'identités que les autres sélections. Un joueur présent en A et en Espoirs conserve un seul `players.id` et plusieurs lignes `player_selection_stats`.

Les tags de sélection sur les tuiles sont cliquables et changent le contexte statistique sans créer de doublon de fiche. `GENERAL` additionne les statistiques connues de toutes les sélections liées au joueur et reste une vue calculée non éditable.

Les onglets Matchs et Personnel & Officiels utilisent désormais les premières données relationnelles Espoirs importées depuis le classeur V4. La source XLSX de l'import est conservée dans `data/`.


## V1.1.27 — Responsive iPhone / iPad

- Nouvelle couche `Bleus_3000_V127_responsive.css` chargée en dernier.
- Correction du zoom Safari/iOS sur les champs dont la taille de police historique était inférieure à 16 px.
- Header réorganisé sur tablette et mobile pour éviter les superpositions entre logo, recherche, compte et barre d’outils.
- Modales et panneaux compte adaptés aux safe areas et à la hauteur dynamique du clavier mobile.
- Tableaux joueurs conservés complets avec défilement horizontal tactile et colonne joueur figée.
- Référentiels, sélections, filtres, éditeurs, outils XI/Five, mur des membres et présence optimisés pour le tactile.
- Aucun blocage du zoom manuel : l’accessibilité navigateur est conservée.


## V1.1.36 — Tags globaux & drapeaux SVG
- Les tags du calendrier utilisent maintenant les tags métier de Bleus 3000 : **INTERNATIONAL**, **ESPOIRS**, U20/U19/U18/U17/U16 et leurs variantes féminines.
- Les 14 sections sont reliées à un tag global dans Supabase.
- Chaque compétition possède un `tag_id` et un tag modifiable depuis **Profil > Tags & étiquettes**.
- Les futures compétitions créées par TheSportsDB reçoivent automatiquement leur tag.
- Dans **Modifier le match**, le tag de section et le tag de compétition peuvent être surchargés pour une tuile précise, sans modifier le référentiel global.
- Les drapeaux emoji sont remplacés par des drapeaux SVG ISO dans le Calendrier et le référentiel Matchs.
- Migration : `MIGRATION_V1.1.36_TAGS_DRAPEAUX.sql` (déjà appliquée au Supabase Bleus 3000).

Voir `CALENDRIER_V1.1.36_TAGS_DRAPEAUX.md`.

## V1.1.35 — Calendrier TheSportsDB
- API-Football retirée du calendrier ; TheSportsDB devient le fournisseur automatique.
- Un seul `calendar-sync` et un seul **Run now** pour toutes les sélections mappées.
- France U21 + France U23 sont réunies sous le référentiel/tag **Espoirs**.
- Les 226 matchs Espoirs déjà présents dans `public.matches` alimentent maintenant aussi `Calendrier > Matchs passés`.
- Référentiel Matchs réparé visuellement, dates françaises et grille pleine largeur.
- Filtres Matchs : sélection, sexe, compétition, année et résultat.
- Score live TheSportsDB dans le calendrier avec indicateur vert lumineux et minute/progression.
- Diffusions TV TheSportsDB enrichies quand disponibles.
- Correction manuelle **champ par champ** : une correction de stade, ville, date, score, adversaire, compétition ou diffusion reste prioritaire sur l’API ; les autres champs continuent à se synchroniser.
- `data_state = locked` reste le verrouillage complet d’une ligne.
- Migration : `MIGRATION_V1.1.35_THESPORTSDB_CALENDRIER.sql`.
- Variables Netlify serveur : `THESPORTSDB_KEY`, `SUPABASE_URL`, `SUPABASE_SECRET_KEY`.

Voir `CALENDRIER_V1.1.35_THESPORTSDB.md`.

## V1.1.43 — pilote historique Espoirs

Ajout de la fonction Netlify manuelle `history-espoirs` pour auditer et rattacher sans destruction les données historiques TheSportsDB de France Espoirs/U21 à la base existante. Voir `HISTORIQUE_ESPOIRS_V1.1.43.md`.