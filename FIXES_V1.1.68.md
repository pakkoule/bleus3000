# 3615 Bleus — V1.1.68

## Actualités Rassemblements

Correction du doublon entre une actualité `Forfait` et une actualité `Remplacement` concernant le même joueur sortant.

Règle appliquée :

- `replacement` avec joueur sortant + entrant → une seule carte **Remplacement** ;
- `withdrawal` sans remplacement associé → une carte **Forfait** ;
- le même dédoublonnage s’applique au flux d’accueil et à la section **Mise à jour** de la tuile Rassemblement.

La base de données ne contenait pas de doublons : le problème venait de la génération automatique côté front à partir du statut `withdrawn` de `callup_players`. Aucune migration SQL n’est nécessaire pour V1.1.68.
