V1.3.17
- Accueil : flèche d’épinglage mini uniquement, logos TV restaurés, confrontation recentrée, séparation BBR, VS sans cadre, pays légèrement agrandis.

V1.3.15.3
- Correctif bloc Stades : cache places/matches renouvelé et lieux sans match relié masqués.
- France–Uruguay 2012 : le Stade CMA-CGM Océane est maintenant visible après rafraîchissement.

V1.3.14.4
- Maillots : année portée dérivée automatiquement des matchs liés.
- Stades : création/réutilisation automatique depuis stade + ville saisis sur un match.

V1.3.14.3
- Médias match : affichage harmonisé, cadres renforcés, colonnes corrigées, chevauchements supprimés.

# 3615 Bleus — V1.3.14.2

## Correctif export PNG Match
- Corrige `Cannot read properties of null (reading 'querySelector')`.
- L’export tolère désormais une feuille de match ou un sous-bloc absent.
- La tuile Match est reprise après chargement de la feuille pour éviter une référence DOM périmée.
- Aucun changement Supabase nécessaire.

Base fonctionnelle : V1.3.14.

- V1.3.15 : accueil calendrier (épinglage inline, suppression du compte à rebours sur les tuiles au profit compétition + TV) + médias de match harmonisés en cadres carrés avec aperçu hover/tactile.

- V1.3.15.1 : suppression du média Cartouche et uniformisation stricte des cadres Maillot/Médias en carrés sans chevauchement.

- V1.3.15.2 : correction liaison Match → Stade : priorité au stade effectivement affiché/manual override, création automatique de la tuile et invalidation ciblée du cache places.

- V1.3.16 : export Match null-safe, flèche d’épinglage réduite, média YouTube retiré des feuilles, bloc Staff renommé Sélectionneurs et grille améliorée.

- V1.3.18 : pays en français/majuscules, confrontation accueil recentrée, séparateurs BBR en dégradé fluide, noms de pays agrandis.
