import { describe, expect, it } from 'vitest';
import { parseHikeDetails, parseSearchResults } from '../src/parser.js';

describe('parseSearchResults', () => {
  it('extrait uniquement la section randonnées', () => {
    const html = `<section><a id="randonnees"></a><ul><li><a href="https://www.visorando.com/randonnee-lac-bleu/">Lac Bleu</a><span class="text-neutral-7">Pédestre • 10,54 km</span></li></ul></section><a href="https://www.visorando.com/randonnee-un-lieu.html">Lieu</a>`;
    expect(parseSearchResults(html, 10)).toEqual([{ title: 'Lac Bleu', url: 'https://www.visorando.com/randonnee-lac-bleu/', activity: 'Pédestre', distanceKm: 10.54 }]);
  });
});

describe('parseHikeDetails', () => {
  it('normalise les métriques françaises et les coordonnées ouest', () => {
    const html = `<h1>Une belle boucle</h1><script type="application/ld+json">{"@type":"Product","geo":{"latitude":"49.1","longitude":"-1.5"},"aggregateRating":{"ratingValue":4.7,"reviewCount":"12"}}</script><section><h2>Fiche technique</h2><span class="select-all">145444</span><time datetime="2024-01-01"></time><time datetime="2025-01-02"></time><div class="vr-walk-datasheet--dataset"><strong>Distance :</strong> 10,47 km</div><div class="vr-walk-datasheet--dataset"><strong>Durée moyenne :</strong> 3h 05</div><div class="vr-walk-datasheet--dataset"><strong>Dénivelé positif :</strong> + 1 202 m</div><div class="vr-walk-datasheet--dataset"><strong>Dénivelé négatif :</strong> - 65 m</div><div class="vr-walk-datasheet--dataset"><strong>Retour au départ :</strong> Oui</div><div class="vr-walk-datasheet--dataset"><strong>Départ/Arrivée :</strong> N 49.1° / O 1.5°</div></section>`;
    expect(parseHikeDetails(html, 'https://www.visorando.com/randonnee-test/')).toMatchObject({ id: '145444', distanceKm: 10.47, durationMinutes: 185, elevationGainM: 1202, elevationLossM: 65, loop: true, latitude: 49.1, longitude: -1.5, rating: 4.7, reviewCount: 12 });
  });

  it('rejette une page sans fiche', () => {
    expect(() => parseHikeDetails('<html></html>', 'https://www.visorando.com/randonnee-test/')).toThrow(/fiche/iu);
  });
});
