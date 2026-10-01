# 3615 Bleus V1.3.8 — Génération · Actus

## Génération
Le filtre **Génération** du bloc Joueurs utilise `players.birth_date` déjà chargé avec la fiche joueur. Aucun référentiel supplémentaire n'est téléchargé pour cette vue. Après sélection d'une année, l'affichage devient volontairement compact : portrait, nom, date de naissance, une ligne par joueur. Le tri passe par défaut au nom de famille croissant ; le tri par date de naissance est également disponible.


## Actus accueil
Les tuiles `homepage_news` sont indépendantes des rassemblements. Elles disposent d'un titre, d'une note courte, d'une date/heure, d'un lien principal, d'un live YouTube et de chaînes de diffusion. Les relations chaînes utilisent `homepage_news_broadcast_channels` et le référentiel `broadcast_channels` existant. Lecture publique, écriture protégée par `can_edit()` pour ADMIN/SUPERADMIN.
