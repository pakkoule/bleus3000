# Mise en ligne de Bleus 3000 V1.1.35

## Ordre conseillé

1. GitHub : créer le dépôt Bleus 3000 et y envoyer le contenu du package.
2. Netlify : importer ce dépôt et effectuer un premier déploiement.
3. Supabase : créer un nouveau projet totalement séparé de Cotation 3000.
4. Supabase : exécuter `supabase_setup.sql`.
5. Configurer `bleus_config.js` avec le nouveau Project URL, la clé publique/anon et l'URL Netlify de production.
6. Commit/push de `bleus_config.js` vers GitHub ; Netlify redéploiera automatiquement.
7. Supabase Auth : définir le Site URL sur l'URL Netlify de production et ajouter la même URL dans les Redirect URLs.
8. Créer ton compte depuis Bleus 3000 puis confirmer l'adresse e-mail.
9. Dans Supabase SQL Editor, remplacer `TON_EMAIL_ICI` dans `SUPABASE_FIRST_ADMIN.sql` par ton e-mail et exécuter la requête.
10. Te déconnecter/reconnecter : le profil doit afficher le rôle SUPERADMIN.

## GitHub

Créer un dépôt vide, par exemple `bleus-3000`. Pour éviter les conflits lors du premier envoi, ne pré-remplis pas le dépôt avec un autre README ou une autre arborescence si tu comptes envoyer directement le package complet.

Le contenu du dossier `Bleus_3000_V1.1.2_HEADER_CLEAN_GITHUB_READY` doit se retrouver à la racine du dépôt : `index.html`, `netlify.toml`, `bleus_config.js`, les fichiers JS/CSS, `supabase_setup.sql` et le dossier `netlify/functions`.

## Netlify

Depuis Netlify, choisir Add new project > Import an existing project, sélectionner GitHub puis le dépôt Bleus 3000. Le fichier `netlify.toml` fourni définit déjà le publish directory (`.`) et les Netlify Functions.

Après le premier déploiement, note l'URL de production, par exemple `https://bleus-3000.netlify.app`.

## Supabase

Créer un projet neuf. Dans SQL Editor, ouvrir `supabase_setup.sql`, copier son contenu et exécuter le script complet.

Dans le panneau **Connect** de Supabase (ou dans **Settings > API Keys** pour la clé), récupérer :
- Project URL -> `SUPABASE_URL`
- clé **publishable** (`sb_publishable_...`) -> `SUPABASE_ANON_KEY`

Le nom `SUPABASE_ANON_KEY` est conservé dans Bleus 3000 pour compatibilité avec le code, mais une nouvelle installation peut utiliser la clé publishable moderne.

Modifier ensuite `bleus_config.js` :

```js
window.BLEUS3000_CONFIG = {
  SUPABASE_URL: 'https://TON-PROJET.supabase.co',
  SUPABASE_ANON_KEY: 'TA_CLE_PUBLIQUE',
  PRODUCTION_URL: 'https://TON-SITE.netlify.app',
  SPORTSDB_LIVE_PROXY: '/api/sportsdb-live'
};
```

Ces valeurs sont destinées au client web. N'ajoute jamais de clé **secret**, `service_role` ou toute autre clé à privilèges élevés dans ce fichier.

## Auth Supabase

Dans Authentication > URL Configuration :
- Site URL = URL Netlify de production
- Redirect URLs = au minimum cette même URL ; ajouter les URLs de preview uniquement si tu veux tester l'authentification sur des previews Netlify.

Conserver Confirm Email activé si tu veux que chaque utilisateur confirme son compte par e-mail.

## Premier SUPERADMIN

Une fois le site connecté à Supabase :
1. Ouvrir Bleus 3000.
2. Créer ton compte avec ton adresse e-mail.
3. Cliquer sur le lien de confirmation reçu par e-mail.
4. Vérifier que le compte peut se connecter.
5. Dans Supabase SQL Editor, ouvrir `SUPABASE_FIRST_ADMIN.sql`.
6. Remplacer `TON_EMAIL_ICI` par ton adresse exacte.
7. Exécuter le SQL.
8. Te déconnecter puis te reconnecter au site.

Le compte sera alors `SUPERADMIN`. Ensuite, le registre administrateur peut attribuer les autres rôles depuis l'interface.

## Calendrier TheSportsDB — V1.1.35

1. Exécuter `MIGRATION_V1.1.35_THESPORTSDB_CALENDRIER.sql` uniquement sur une installation neuve ou si la migration n’a pas encore été appliquée. Sur le projet Bleus 3000 actuel, elle est déjà appliquée.
2. Dans **Netlify > Project configuration > Environment variables**, créer :
   - `THESPORTSDB_KEY` → cocher **Contains secret values** ;
   - `SUPABASE_SECRET_KEY` → cocher **Contains secret values** ;
   - `SUPABASE_URL` → ne pas marquer secret ;
   - facultatif : `BLEUS_SPORTSDB_TEAM_MAP` → mapping JSON non secret.
3. Faire un nouveau deploy Netlify.
4. Dans **Functions > calendar-sync**, lancer une seule fois **Run now** pour le premier import.
5. Le cron fourni relance ensuite le sync toutes les 6 heures.

`THESPORTSDB_KEY` doit rester exclusivement côté Netlify. Elle ne doit jamais être ajoutée à `bleus_config.js`, GitHub ou au code du navigateur.

Les variables `API_FOOTBALL_KEY` et `BLEUS_API_TEAM_MAP` des versions précédentes peuvent être supprimées : elles ne sont plus lues.

## V1.1.36
La migration `v1_1_36_tags_drapeaux` est déjà appliquée sur le projet Supabase Bleus 3000.
Aucune nouvelle variable Netlify n'est requise.
Conserver : `THESPORTSDB_KEY`, `SUPABASE_URL`, `SUPABASE_SECRET_KEY`.
