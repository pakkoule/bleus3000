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
