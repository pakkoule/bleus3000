# 3615 Bleus — V1.1.64

## Import PDF FFF dans les Rassemblements

- Ajout d'un bouton `PDF FFF` directement sur chaque tuile Rassemblement pour ADMIN / SUPERADMIN.
- Ajout d'un bouton `Importer PDF FFF` dans l'éditeur d'un rassemblement.
- Lecture du PDF dans le navigateur via PDF.js, sans envoi du fichier vers un serveur tiers.
- Détection des groupes FFF : Gardiens de but, Défenseurs, Milieux de terrain, Attaquants.
- Extraction nom, date de naissance et club.
- Rapprochement avec le registre France A 3615 Bleus par nom normalisé + date de naissance, avec tolérance aux espaces/tirets/accents et noms collés par l'extraction PDF.
- Écran de contrôle avant import : correspondances certaines, propositions à vérifier et choix manuel du joueur 3615 Bleus.
- Deux modes : `Ajouter / mettre à jour` ou `Remplacer la liste`.
- Aucun enregistrement automatique : les lignes sont injectées dans l'éditeur, puis le bouton `Enregistrer` du rassemblement reste nécessaire pour écrire en base.
- Le groupe FFF est stocké dans `position_group` ; aucun tag de poste détaillé (DC/DG/BU…) n'est inféré depuis le PDF.

## Compatibilité

Cette première version cible les PDF FFF contenant une couche texte exploitable, comme le PDF de test fourni. Les PDF purement scannés nécessiteraient un fallback OCR séparé.
