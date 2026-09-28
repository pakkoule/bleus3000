# 3615 Bleus — corrections d’audit V1.1.62

## Corrigé

- Rassemblements : `reinforcement` n’est plus injecté dans le statut global du rassemblement.
- Suppression des boutons Favoris et Historique devenus sans fonction.
- Suppression de l’ancienne fiche joueur de démonstration et de l’éditeur générique localStorage.
- Ancien tableau joueurs remplacé par un registre France A léger, chargé uniquement depuis `FRA-A-M`.
- Suppression des données métier fictives du fallback JS.
- Ajout réel Supabase pour Adversaires, Staff, Arbitres et Stades.
- Ajout canonique des compétitions via Famille → Entité → Édition ; le miroir `competitions` est conservé uniquement pour compatibilité avec les modules encore historiques.
- Suppression du monkey-patch du renderer Compétitions : l’application appelle directement le renderer canonique.
- Rôles ramenés à `USER / ADMIN / SUPERADMIN` dans le front, le baseline et la production.
- Suppression de la table vide et orpheline `user_display_preferences` ; `user_preferences` reste la source de préférences.
- Suppression d’assets de flocage hors périmètre France A : Olympique 2024, France féminine 2021 et 2023.
- Typographie consolidée : Bitter / Staatliches / European Teletext (fallback monospace si la police locale n’est pas installée).
- Version et cache-busting harmonisés en `1.1.62`.
- Plusieurs fonctions JS confirmées inutilisées ont été supprimées.

## Conservé volontairement

- Les tables historiques contenant encore au moins une ligne (`member_postit_styles`, `user_player_favorites`) ne sont pas supprimées automatiquement : aucune donnée utilisateur n’est détruite silencieusement.
- Les colonnes et la table legacy `competitions` restent présentes comme couche de compatibilité pendant la transition complète vers `competition_entities` / `competition_editions`.
- Les migrations historiques restent dans le dépôt à titre de traçabilité ; pour une nouvelle base, seul `SUPABASE_BASELINE.sql` doit être exécuté.

## Supabase production

La migration V1.1.62 a été appliquée au projet `bleus3000` :

- contrainte des rôles = `user`, `admin`, `superadmin` ;
- helpers `can_edit`, `can_contribute`, `can_edit_selections` alignés sur ADMIN/SUPERADMIN ;
- `user_display_preferences` supprimée après vérification qu’elle était vide et inutilisée.

## Points de sécurité laissés à traiter séparément

Le conseiller Supabase signale encore plusieurs fonctions `SECURITY DEFINER` exécutables par les utilisateurs authentifiés. Une partie est utilisée intentionnellement par les politiques RLS et les RPC applicatifs ; leur durcissement doit faire l’objet d’un audit fonction par fonction, pas d’une révocation globale. Supabase signale aussi que la protection contre les mots de passe compromis n’est pas activée dans Auth.
