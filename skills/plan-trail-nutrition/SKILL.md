---
name: plan-trail-nutrition
description: Estimer les glucides, l’eau, le sodium et le nombre de portions à préparer pour un trail ou une sortie d’endurance. Utiliser lorsqu’un coureur demande combien manger ou boire, combien de gels ou flasques emporter, comment tenir compte de la chaleur, de son taux de sudation ou de ravitaillements en eau.
---

# Planifier nutrition et hydratation d’un trail

## Calcul

- Utiliser `estimate_trail_needs` si la durée prévue est déjà connue.
- Utiliser `prepare_trail` si la demande porte sur une fiche Visorando et qu’il faut aussi exploiter distance et dénivelé.
- Privilégier la durée prévue par le coureur. À défaut, expliquer que `prepare_trail` emploie une estimation par km-effort.
- Sans préférence personnelle, retenir 30 à 40 g de glucides par heure et une allure de 6 min/km-effort.
- Transmettre le taux de sudation mesuré lorsqu’il est fourni. Ne pas l’inventer.
- Ne déduire avec `availableWaterLiters` que l’eau potable, ouverte et réellement accessible pendant la sortie.
- Adapter `carbsPerServingGrams` au produit du coureur pour obtenir un nombre de portions utile.

## Réponse

- Présenter une fourchette par heure, le total à préparer et le portage d’eau initial.
- Séparer les données personnelles, les hypothèses et les avertissements renvoyés par l’outil.
- Ne pas transformer l’estimation en prescription médicale. En cas de pathologie, traitement, antécédent d’hyponatrémie ou trouble digestif important, recommander un avis professionnel.
- Rappeler de tester la stratégie à l’entraînement et de ne jamais compter une source d’eau non vérifiée.
