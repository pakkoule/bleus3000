# Bleus 3000 — V1.1.24

Correctif intégral du moteur de recherche, sans modification de la base Supabase.

- moteur de recherche partagé accueil / Sélections / recherche universelle ;
- recherche progressive stable : `Kyli`, `Kylian`, `Kylian Mba`, `Kylian Mbappé` ;
- recherche par nom seul : `Platini` → Michel Platini ;
- tolérance accents et fautes de frappe contrôlée ;
- suppression des faux positifs causés par les tokens très courts (`A`, `M`, etc.) ;
- la recherche textuelle du tableau d'accueil porte sur le nom du joueur ; poste, tag équipe et numéro gardent leurs filtres dédiés.
