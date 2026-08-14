---
name: plan-trail-access
description: Trouver où se garer ou comment venir en transport en commun près du départ d’une randonnée ou d’un trail Visorando. Utiliser pour rechercher parkings, gares, arrêts de bus ou tram, obtenir des liens de navigation et comparer les distances au départ.
---

# Préparer l’accès au départ

## Recherche

- Obtenir une référence de fiche Visorando, directement ou avec `search_hikes`, `find_hikes` puis `get_hike`.
- Appeler `find_hike_access` avec un rayon de 1 500 m par défaut.
- Élargir à 3 000 m puis 5 000 m si aucune option utile n’apparaît, sans dépasser 10 000 m.
- Pour une préparation complète incluant nutrition et eau, appeler plutôt `prepare_trail`.

## Interprétation

- Présenter d’abord `suggestedParking` comme « stationnement indicatif au Départ/Arrivée Visorando », avec `coordinateText` et un lien cliquable vers `googleMapsUrl`.
- Préciser que ces coordonnées localisent le départ mais ne prouvent ni l’existence, ni l’autorisation, ni la disponibilité d’un parking.
- Distinguer parking et transports en commun.
- Donner le nom, la distance à vol d’oiseau, le lien OpenStreetMap et le lien de navigation des meilleures options.
- Ne pas annoncer qu’un parking est gratuit, ouvert ou disponible si ces informations ne sont pas renvoyées.
- Ne pas présenter un arrêt comme une desserte garantie : les résultats ne contiennent ni horaires ni état temps réel.
- Demander au coureur de vérifier horaires, dernier retour, travaux, restrictions, capacité du parking et cheminement réel entre l’accès et le départ.
