# 3615 Bleus — V1.3.2 — optimisation iPhone / Safari iOS

## Audit ciblé

La passe mobile a identifié plusieurs coûts évitables :

- Navigation repositionnée sur tous les événements `scroll`, y compris les scrolls internes capturés.
- Plusieurs référentiels remplaçaient leur contenu par « Chargement… » à chaque rendu, même lorsque leurs données étaient déjà chargées.
- Les overlays mélangeaient encore `vh`, `dvh` et le viewport de layout, ce qui peut provoquer des sauts avec la barre d’adresse et le clavier Safari.
- Le logo d’interface chargeait un PNG 1330×1235 d’environ 1,1 Mo alors qu’il est affiché autour de 110–170 px.
- Des listes de cartes pouvaient rester entièrement peintes même hors écran.
- Les images injectées dynamiquement ne possédaient pas toutes des attributs de lazy loading/décodage asynchrone.
- Le verrouillage `body.style.overflow='hidden'` utilisé par plusieurs modales pouvait faire perdre la position de page sur iOS.
- Les recherches de référentiel relançaient un rendu complet à chaque frappe sans délai minimal.

## Correctifs

### Viewport et clavier

- `visualViewport` alimente désormais `--b3k-vvh`, `--b3k-vvw`, `--b3k-vv-top` et l’état clavier.
- Utilisation de `svh`/`dvh` en fallback CSS.
- Les modales, panneaux de compte, résultats de recherche et panneaux administrateur sont limités au viewport réellement visible.
- Un champ masqué par le clavier est recentré uniquement lorsqu’il sort réellement du viewport visuel.
- Les champs de recherche utilisent `enterkeyhint="search"`, sans autocorrection/autocapitalisation.

### Navigation

- Repositionnement limité à un `requestAnimationFrame` au lieu d’un recalcul synchrone à chaque événement.
- Suppression du `capture:true` sur le scroll global : le scroll interne de l’overlay ne déclenche plus le repositionnement complet.
- Support direct des événements `visualViewport.resize/scroll`.
- Hauteur maximale calculée depuis la zone réellement visible de Safari.
- Cibles tactiles proches de 44 px et transition raccourcie sur écran tactile.

### Scroll / overlays

- Verrouillage iOS par position fixe avec mémorisation de `scrollY`, puis restauration exacte à la fermeture de la dernière modale.
- Pas de double scroll derrière les fenêtres.
- `overscroll-behavior: contain` + inertie tactile sur les zones scrollables.
- Conservation en session de la position de scroll de chaque bloc du référentiel Navigation.
- Actions principales des gros éditeurs ADMIN rendues sticky en bas sur mobile.

### Rendu des listes

- `content-visibility:auto` + taille intrinsèque de secours sur les longues listes/cartes lorsque le navigateur le supporte.
- Les référentiels Joueurs, Matchs relationnels, Rassemblements et Maillots ne remplacent plus leur contenu par un écran de chargement lorsque leurs données sont déjà en mémoire.
- Recherche interne de référentiel légèrement temporisée sur écran tactile pour éviter un rerender complet à chaque frappe rapide.

### Images

- Images dynamiques : `loading="lazy"`, `decoding="async"` et priorité basse hors zone critique.
- Logo d’interface remplacé par `3615-bleus-logo-ui.webp` (360×334, ~32 Ko) au lieu du PNG source ~1,1 Mo.
- Le PNG haute définition reste conservé pour les exports qui en ont besoin.

## Compatibilité

Aucune migration Supabase n’est nécessaire. La couche V1.3 Cache First et l’indice Équipe type V1.3.1 sont conservés.
