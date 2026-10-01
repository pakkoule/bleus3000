# 3615 Bleus — Système d’export V1.3.6

## Objectif
V1.3.6 remplace le chemin d’export fragile de la tuile Match par un moteur commun capable de produire des PNG/JPG haute résolution sans dépendre d’une capture d’écran serveur.

API navigateur : `window.BLEUS3000_EXPORT`.

Principales entrées :
- `exportElement(element, options)` : export d’un élément DOM en PNG/JPG ;
- `rasterize(element, options)` : retourne le canvas/blob sans téléchargement ;
- `assetToDataUrl(url)` : intègre une image dans le rendu ;
- `downloadCanvas(canvas, options)` : téléchargement commun des anciens exports Canvas ;
- `downloadBlob(blob, filename)` : téléchargement final avec nom propre.

Ce moteur peut être utilisé par Match, But, Joueur, Onze, Five, Liste et Rassemblement. Dans cette version, Match et But utilisent directement le rasteriseur DOM ; Joueur, Onze/Five et Liste réutilisent également le gestionnaire de téléchargement commun.

## Origine du morceau rouge dans l’ancien export Match
L’ancien export sérialisait la tuile entière avec les feuilles CSS globales dans un SVG `<foreignObject>`. Le scoreline affiche le marquage coloré sous les noms de pays avec les pseudo-éléments `.b3k-scoreline-name::before` et `::after`, alimentés par un gradient de pays pouvant contenir du rouge.

Lors de la rasterisation SVG/Canvas par Chromium, ces pseudo-éléments pouvaient être peints avec un clipping différent de celui de la page et produire un fragment coloré détaché dans le PNG.

V1.3.6 ne transporte plus ce mécanisme dans l’image finale :
1. les styles calculés utiles sont copiés dans le clone ;
2. tous les pseudo-éléments du clone d’export sont neutralisés ;
3. le scoreline est reconstruit avec de vrais éléments DOM ;
4. les drapeaux restent de vraies images ;
5. l’anneau Équipe type est reconstruit en SVG à segments colorés ;
6. les icônes qui dépendaient de pseudo-éléments sont matérialisées explicitement.

## Images et CORS
Avant le passage Canvas, le moteur convertit en Data URL :
- les balises `<img>` ;
- les images `<svg><image>` ;
- les `background-image` CSS calculés.

Le fetch utilise CORS et un cache mémoire par URL. Une ressource tierce qui refuse explicitement CORS est neutralisée individuellement par un pixel transparent afin de ne jamais contaminer tout le canvas.

Les buckets Supabase utilisés par les photos et médias publics de 3615 Bleus sont publics. Aucune clé `service_role` n’est utilisée et aucune modification RLS/Storage n’est nécessaire pour cet export.

Éléments couverts par le même chemin d’assets : drapeaux, logos/blasons, maillots, photos joueur/staff, brassard, icônes d’accomplissement, médias image de feuille et images Supabase Storage.

Les numéros et autres éléments textuels/vectoriels sont rasterisés directement depuis le DOM.

## Retina / Safari iPhone
Le facteur de rendu suit le `devicePixelRatio`, jusqu’à 3×. Pour éviter les crashes mémoire de Safari iOS, le moteur limite également :
- la plus grande dimension du canvas à 8192 px ;
- la surface à environ 15 millions de pixels.

Le `content-visibility` mobile est forcé à `visible` uniquement pendant l’export, puis restauré.

## Export Match
Le bouton `⇩ PNG` exporte la tuile Match et la feuille chargée. Les commandes d’édition/navigation sont retirées du clone, pas de la vraie interface.

Nom type : `3615_Bleus_match_895_France_Argentine_18-12-2022.png`.

## Téléchargement du But
Chaque tuile But affiche **TÉLÉCHARGER LE BUT** lorsqu’une vidéo est liée.

Ce bouton ne fait **aucun export image** de la tuile. Il télécharge le **fichier vidéo réel** :
- vidéo importée dans Supabase Storage `goal-videos` : récupération du Blob via Storage puis téléchargement local ;
- URL directe vers un fichier vidéo : téléchargement par `fetch` si le serveur autorise CORS ;
- lien YouTube : aucun faux fichier n’est généré, car 3615 Bleus ne possède alors pas le fichier vidéo source.

Le nom du fichier reprend le buteur, la minute, l’adversaire et la date, par exemple :
`3615_Bleus_but_Kylian_Mbappe_54_France_Turquie_25-09-2026.mp4`.

`BLEUS3000_COLLECTIONS.exportGoal` reste disponible pour compatibilité mais pointe désormais vers le téléchargement vidéo, pas vers le rasteriseur DOM.

## Validation technique
- syntaxe JS contrôlée sur l’ensemble du projet ;
- ressources locales déclarées par `index.html` contrôlées ;
- test headless Chromium du rasteriseur avec pseudo-élément rouge volontairement débordant : aucun fragment rouge parasite dans l’image produite ;
- test de matérialisation du scoreline, des drapeaux, de l’anneau Équipe type et de l’icône ballon ;
- le navigateur de test n’accède pas au site local complet dans cet environnement, donc la validation réelle des URLs distantes dépend du déploiement ; le moteur gère leur échec CORS ressource par ressource.
