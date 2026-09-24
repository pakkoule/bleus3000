# TheSportsDB — exploitation historique pour 3615 Bleus

Oui, les données passées sont exploitables, mais elles doivent rester une source d'acquisition et non remplacer les données historiques déjà vérifiées de 3615 Bleus.

## Endpoints utiles

- `schedule/previous/team/{idTeam}` : derniers événements d'une équipe (V2 Premium, petite fenêtre récente).
- `schedule/full/team/{idTeam}` : calendrier complet d'une saison d'équipe (V2 Premium, jusqu'à 250 événements selon la documentation).
- `schedule/league/{idLeague}/{season}` : saison complète d'une compétition (V2 Premium, jusqu'à 3000 événements).
- V1 `eventsseason.php?id={idLeague}&s={season}` : saison complète d'une ligue/compétition ; particulièrement pratique pour remonter par édition puis filtrer les équipes de France.
- recherche d'événement : permet de retrouver un match précis et de compléter un identifiant fournisseur.

Les événements de saison exposent notamment : identifiant événement, équipes, scores, date/heure, compétition, saison, tour, stade, pays, statut, miniatures/vidéo quand disponibles.

## Stratégie recommandée

1. Partir des compétitions/éditions déjà connues dans Supabase.
2. Interroger TheSportsDB par compétition + saison.
3. Filtrer localement sur les IDs TheSportsDB de nos sélections françaises.
4. Faire un rapprochement avant insertion : sélection + date + adversaire normalisé.
5. Si le match existe déjà en `verified`/`locked`, rattacher seulement `provider_fixture_id` et conserver les données 3615 Bleus.
6. Créer une nouvelle ligne uniquement lorsqu'aucune correspondance sûre n'existe.
7. Garder les corrections manuelles prioritaires champ par champ.

Cette approche permet d'enrichir progressivement l'historique sans dupliquer ni écraser les référentiels vérifiés.
