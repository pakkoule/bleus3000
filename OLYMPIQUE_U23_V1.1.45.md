# OLYMPIQUE U23 — V1.1.45

3615 Bleus conserve `FRA-ESP-M` comme référentiel technique commun U21/U23 pour ne pas casser les données existantes.

Affichage :
- France U21 → tag `ESPOIRS`
- France U23 dans une compétition olympique → tag `OLYMPIQUE U23`

Le tag est un override d’affichage de section au niveau du match. Il ne modifie pas le référentiel technique ni les statistiques U21 déjà présentes.

`calendar-sync` applique ce tag aux événements TheSportsDB dont l’équipe France correspond à l’ID U23 `143161` et dont la compétition contient `Olympic`.

`history-espoirs` applique la même règle aux matchs historiques retrouvés et indique le nombre de candidats olympiques U23 encore non importés.
