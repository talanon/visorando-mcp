---
name: find-visorando-hikes
description: Rechercher, sélectionner, comparer et préparer des randonnées ou itinéraires de trail Visorando à l’aide des outils MCP visorando. Utiliser pour toute demande de parcours autour d’un lieu, avec ou sans distance cible, pour consulter une fiche, comparer des itinéraires ou proposer une sortie avec stationnement, eau et nourriture.
---

# Trouver une randonnée Visorando

## Recherche

Utiliser uniquement les outils du serveur MCP `visorando` pour obtenir les métadonnées Visorando.

- Si une distance est demandée, appeler `find_hikes` avec le lieu, la distance cible et `toleranceKm: 2`.
- Si l’appel renvoie au moins deux résultats, conserver ces résultats.
- S’il renvoie zéro ou un résultat, rappeler `find_hikes` avec la même distance cible et des tolérances successives de 4, 6 puis 8 km.
- Arrêter dès que deux résultats au moins sont disponibles.
- Après l’essai à 8 km, indiquer clairement qu’aucun résultat n’a été trouvé si la liste est vide. S’il ne reste qu’un résultat, le présenter en précisant qu’aucune autre proposition n’a été trouvée.
- Si aucune distance n’est demandée, utiliser `search_hikes` avec le lieu ou les mots-clés fournis.

## Sélection et comparaison

- Consulter les meilleures fiches avec `get_hike` lorsque des détails sont nécessaires.
- Utiliser `compare_hikes` pour comparer deux à cinq fiches demandées ou présélectionnées.
- Classer les propositions par proximité avec les critères exprimés par l’utilisateur.
- Ne pas inventer une donnée absente des résultats.

## Réponse

- Dès qu’une sortie est proposée ou recommandée, appeler automatiquement `prepare_trail` sur la fiche retenue avec `includeAccess: true`, sans attendre une demande de logistique.
- Sans durée personnelle, conserver l’estimation par km-effort avec `flatPaceMinutesPerKm: 6`.
- Toujours indiquer dans la même réponse où se garer, le portage d’eau initial et la nourriture à prendre sur la base de 30 à 40 g de glucides par heure.
- Pour le stationnement principal, afficher le `suggestedParking` issu du Départ/Arrivée Visorando : libellé des coordonnées et lien Google Maps. Le qualifier d’indicatif et présenter séparément les parkings OpenStreetMap éventuels.
- Pour chaque proposition dont `prepare_trail` renvoie des `photos`, les afficher en Markdown avec leur légende et un lien vers `sourceUrl`. Les qualifier d’illustratives et ne jamais affirmer qu’elles montrent précisément le parking ou l’état actuel des lieux.
- Si la recherche d’accès échoue ou ne renvoie rien, appeler `find_hike_access` avec des rayons de 3 000 m puis 5 000 m. Ne pas omettre le volet eau et nourriture si l’accès reste indisponible.
- Toujours inclure le lien de la fiche source.
- Ne jamais reproduire une description, une carte ou une trace GPS protégée.
- Rappeler de vérifier la fiche originale, la météo et les conditions locales avant le départ.
