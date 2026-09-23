# Bleus 3000 — V1.1.2

Cette version conserve la coque UI/UX héritée de Cotation 3000 et corrige le header sans changer le langage graphique général.

## Changements V1.1.2

- Suppression complète du système d'avatars membres et de tous les fichiers d'avatars.
- Suppression du concept de message épinglé du mur des membres.
- Recherche universelle, compte/profil/connexion et Mur des membres réunis dans le header, à gauche du titre BLEUS 3000.
- Mur conservé avec messages courts, likes, suppression/modération et Realtime Supabase.
- Étiquettes personnalisées, présence, rôles, signalements, raccourcis favoris et personnalisation des messages conservés.

## Contenu fonctionnel

- Accueil : Ladder Bleu, Calendrier & compétitions, Prochain Bleu ?, dernières convocations et bibliothèque.
- Outils : Onze, Five, Liste de sélectionneur avec sauvegarde locale et export PNG/JPG.
- Bibliothèque : Internationaux, Convocations, Matchs, Compétitions, Adversaires, Personnel & Officiels, Équipements, Statistiques, Lieux, Bibliographie & Médias.
- Tuiles : tags, données synthétiques, Sources et Contributeurs.
- Fiche joueur : 5/10 dernières performances de démonstration, prête à être alimentée par API.
- Recherche universelle : joueurs, référentiels, entrées et échéances.
- Compte : inscription/connexion Supabase, rôles, présence, signalements, raccourcis favoris et étiquette personnalisée.

## Nouveau Supabase obligatoire

Cette archive est configurée avec des identifiants Supabase vides afin de ne jamais toucher au projet Cotation 3000.

1. Créer un nouveau projet Supabase dédié à Bleus 3000.
2. Exécuter `supabase_setup.sql` dans SQL Editor.
3. Renseigner `SUPABASE_URL`, `SUPABASE_ANON_KEY` et `PRODUCTION_URL` dans `bleus_config.js`.
4. Configurer l'URL du site et les Redirect URLs dans Supabase Auth.
5. Créer le premier compte depuis Bleus 3000 et confirmer l'e-mail.
6. Remplacer `TON_EMAIL_ICI` dans `SUPABASE_FIRST_ADMIN.sql`, puis exécuter le fichier pour promouvoir ce compte en SUPERADMIN.

Sans Supabase configuré, l'interface reste testable en mode local de démonstration.

## API football

La fonction `netlify/functions/football-api.js` sert de proxy serveur pour API-Football. Ajouter la variable secrète `API_FOOTBALL_KEY` dans Netlify lorsque tu voudras connecter le fournisseur.

## Déploiement

Le dépôt peut être envoyé tel quel sur GitHub puis importé par Netlify. `netlify.toml` configure le site statique, les Functions et les redirections.

Voir `INSTALLATION_GITHUB_NETLIFY_SUPABASE.md` pour la procédure complète.
