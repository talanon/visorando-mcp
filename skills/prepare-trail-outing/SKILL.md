---
name: prepare-trail-outing
description: 'Préparer automatiquement de bout en bout une sortie trail à partir d’un lieu ou d’une fiche Visorando : sélectionner l’itinéraire, estimer la durée, calculer glucides et eau, puis trouver parking et transports. Utiliser pour toute proposition ou recommandation de sortie, même si l’utilisateur ne demande pas explicitement la logistique.'
---

# Préparer une sortie trail complète

## Workflow

1. Rechercher les itinéraires avec `find_hikes` si une distance est donnée, sinon avec `search_hikes`.
2. Consulter les meilleures fiches avec `get_hike` et comparer deux à cinq finalistes avec `compare_hikes` si nécessaire.
3. Choisir avec l’utilisateur ou sélectionner le meilleur résultat selon ses critères explicites.
4. Appeler systématiquement `prepare_trail` sur la fiche retenue avec `includeAccess: true`. Fournir en priorité sa durée prévue, puis température, taux de sudation, eau fiable disponible et taille d’une portion de glucides quand ces données existent.
5. Si l’accès ne donne rien, rappeler `find_hike_access` avec des rayons de 3 000 m puis 5 000 m.

## Règles

- Ne jamais employer la durée de marche Visorando comme durée de course personnelle sans le signaler.
- Sans durée personnelle, utiliser `flatPaceMinutesPerKm: 6` avec le km-effort.
- Sans stratégie nutritionnelle personnelle, utiliser 30 à 40 g de glucides par heure.
- Toute proposition de sortie doit répondre immédiatement à trois questions : où se garer, combien d’eau porter et quelle nourriture prendre.
- Présenter le `suggestedParking` du Départ/Arrivée Visorando avec `coordinateText` et le lien Google Maps, en précisant que le stationnement reste à vérifier. Distinguer les parkings OpenStreetMap alternatifs.
- Afficher en Markdown les `photos` illustratives disponibles, avec leur légende et leur fiche source. Ne pas les présenter comme une vue certaine du parking ou des conditions actuelles.
- Distinguer systématiquement données Visorando, calculs indicatifs et informations externes à vérifier.
- Ne pas inventer points d’eau, potabilité, horaires, disponibilité de parking ou conditions du terrain.
- Toujours inclure le lien de la fiche Visorando sans reproduire description, carte ou trace protégée.
- Terminer par une checklist : parcours et météo, durée, glucides, eau/ravitaillements, accès/retour, matériel et sécurité.
