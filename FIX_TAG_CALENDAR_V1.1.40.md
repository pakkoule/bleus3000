# 3615 Bleus V1.1.40 — Tags Compétitions → Calendrier

## Correctif
Un tag créé comme **tag de compétition** peut désormais être identifié comme tel même avant ou indépendamment de ses liens relationnels grâce au champ `tags.reference_scope`.

Le menu **Calendrier → Ajouter un match → Tag de compétition** affiche maintenant :
- les tags explicitement marqués `competition` ;
- les tags déjà utilisés par une entrée du référentiel Compétitions ;
- les familles historiques déjà prises en charge.

Après la création/modification d'un tag, le cache relationnel est invalidé puis rechargé avant le rafraîchissement du calendrier. Le nouveau tag devient donc disponible sans devoir attendre un nouveau chargement complet du site.

## Réparation de la donnée existante
Le tag `TOURNOI INTERNATIONAL DE LIMOGES` créé avant ce correctif a été réparé dans la base de production :
- portée `competition` ;
- création de l'entrée Compétitions correspondante ;
- association `tag_reference_links` ;
- `competitions.tag_id` renseigné.
