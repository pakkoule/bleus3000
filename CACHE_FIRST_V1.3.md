# 3615 Bleus — cache-first V1.3

## Objectif

Limiter fortement les lectures répétitives envoyées à Supabase sans sacrifier la cohérence des données ni la sécurité RLS. La couche est installée avant la création du client Supabase et intercepte uniquement les appels REST vers le projet configuré.

## Stratégie

1. **Mémoire** : réponse disponible immédiatement dans l’onglet courant.
2. **IndexedDB** : réponse persistante entre changements de vue et rechargements complets.
3. **Réseau Supabase** : utilisé uniquement si aucune réponse valide n’existe, si le cache a expiré ou après invalidation ciblée.
4. **Fallback hors-ligne** : une réponse expirée peut être servie uniquement si la requête réseau échoue.

Les appels simultanés strictement identiques partagent une seule promesse réseau. Les requêtes de compte privées ne sont jamais enregistrées dans IndexedDB. Les clés de cache persistantes sont cloisonnées par identité authentifiée (empreinte locale du `sub` JWT) ou contexte anonyme afin d’éviter toute réutilisation inter-compte.

## Durées principales

- Joueurs, compétitions, adversaires, lieux, personnels, tags et référentiels historiques : jusqu’à **24 h**.
- Statistiques dérivées et associations relativement stables : **30 min à 12 h** selon la table.
- Matchs : **15 min** par défaut ; les requêtes qui filtrent explicitement des années anciennes bénéficient d’un cache plus long.
- Rassemblements actifs et données associées : **3 à 5 min**.
- Données privées de compte : mémoire courte uniquement.

## Invalidation

Une écriture REST réussie invalide uniquement la table touchée et ses dépendances connues. Les RPC d’écriture de feuille de match invalident les tables sportives concernées. Une RPC inconnue reste volontairement conservatrice et provoque un vidage complet.

Les autres onglets ouverts sont avertis via `BroadcastChannel`. Leurs stores JavaScript sont marqués obsolètes, mais aucune lecture réseau n’est déclenchée automatiquement : la donnée sera rechargée uniquement lorsqu’elle sera réellement redemandée.

## Rafraîchissement administrateur

Le menu ADMIN/SUPERADMIN contient **Rafraîchir les données**. Cette action vide le cache de données puis recharge l’application. Elle sert de mécanisme de récupération explicite après une opération administrative exceptionnelle ou pour contrôler immédiatement la dernière version serveur.

## Diagnostic

Dans la console du navigateur :

```js
BLEUS3000_DATA_CACHE.stats()
```

renvoie notamment le nombre de lectures réseau, hits mémoire, hits IndexedDB, requêtes dédupliquées, écritures et invalidations depuis le chargement courant.

Aucune clé `service_role` n’est ajoutée au frontend. Le client continue d’utiliser la clé publishable et les règles RLS existantes.
