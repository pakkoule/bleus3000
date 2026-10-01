# V1.3.3 — Authentification administrateur uniquement

3615 Bleus fonctionne désormais en lecture publique et réserve l'authentification aux comptes ADMIN / SUPERADMIN existants.

## Frontend
- suppression du menu Profil public dans le header ;
- suppression de toute interface de création de compte ;
- suppression de tout appel `supabase.auth.signUp()` ;
- suppression de Supabase Presence et de l'indicateur d'utilisateurs en ligne ;
- suppression du module social `Bleus_3000_V8_social_profiles.*` du chargement ;
- ajout du lien discret `Administration` dans le footer ;
- après authentification ADMIN / SUPERADMIN, ouverture du `Tableau de bord administrateur` ;
- les contrôles d'édition restent pilotés par `C3K_ACCOUNT_STATE` / `b3k-can-edit`.

## Supabase
La migration `migration déjà appliquée directement sur le projet Supabase` est appliquée au projet de production.

- un trigger `BEFORE INSERT` sur `auth.users` refuse toute nouvelle création de compte ;
- sa fonction est privée : aucun droit `EXECUTE` pour `anon` ou `authenticated` ;
- les comptes Auth existants restent intacts ;
- la policy `profiles_update_self_or_superadmin` remplace l'ancienne policy plus large : un ADMIN ne peut modifier que son propre profil, un SUPERADMIN peut administrer les profils ;
- le trigger historique `protect_profile_role` continue de contrôler les changements de rôle.

Au moment de la migration, la base contient exactement deux comptes Auth : un ADMIN et un SUPERADMIN.

## Test serveur
Un INSERT de test dans `auth.users` a été tenté après migration et a bien été refusé avec :

`3615 Bleus: creation de nouveaux comptes desactivee`

Le test n'a créé aucun compte.
