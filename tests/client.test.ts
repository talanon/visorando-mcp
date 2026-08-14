import { describe, expect, it, vi } from 'vitest';
import { VisorandoClient } from '../src/client.js';

const response = (body: string) => new Response(body, { status: 200, headers: { 'content-type': 'text/html; charset=UTF-8' } });

describe('VisorandoClient', () => {
  it('encode la recherche et met les réponses en cache', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(response('<section><a id="randonnees"></a><ul></ul></section>'));
    const client = new VisorandoClient({ fetch: fetchMock, cacheTtlMs: 60_000 });
    await client.searchHikes('lac bleu');
    await client.searchHikes('lac bleu');
    expect(fetchMock).toHaveBeenCalledOnce();
    const requestedUrl = fetchMock.mock.calls[0]?.[0];
    expect(requestedUrl).toBeInstanceOf(URL);
    expect((requestedUrl as URL).searchParams.get('mainSearchInput')).toBe('lac bleu');
  });

  it.each(['https://evil.example/randonnee-test/', 'https://www.visorando.com/index.php', 'javascript:alert(1)'])('bloque les références non sûres: %s', (reference) => {
    const client = new VisorandoClient();
    expect(() => client.normalizeHikeUrl(reference)).toThrow(/publiques/iu);
  });

  it('accepte un slug Visorando', () => {
    const client = new VisorandoClient();
    expect(client.normalizeHikeUrl('randonnee-lac-bleu/').toString()).toBe('https://www.visorando.com/randonnee-lac-bleu/');
  });

  it('classe les randonnées selon la distance cible et applique la tolérance', async () => {
    const searchHtml = `<section><a id="randonnees"></a><ul>
      <li><a href="https://www.visorando.com/randonnee-neuf/">Neuf kilomètres</a><span class="text-neutral-7">Pédestre • 9 km</span></li>
      <li><a href="https://www.visorando.com/randonnee-dix/">Dix kilomètres</a><span class="text-neutral-7">Pédestre • 10,2 km</span></li>
      <li><a href="https://www.visorando.com/randonnee-loin/">Trop loin</a><span class="text-neutral-7">Pédestre • 15 km</span></li>
    </ul></section>`;
    const detailHtml = (title: string, distance: string) => `<h1>${title}</h1><section><h2>Fiche technique</h2><div class="vr-walk-datasheet--dataset"><strong>Distance :</strong>${distance} km</div></section>`;
    const fetchMock = vi.fn<typeof fetch>().mockImplementation((input) => {
      const url = input instanceof URL ? input : new URL(typeof input === 'string' ? input : input.url);
      if (url.pathname === '/index.php') return Promise.resolve(response(searchHtml));
      if (url.pathname.includes('randonnee-dix')) return Promise.resolve(response(detailHtml('Dix kilomètres', '10,2')));
      return Promise.resolve(response(detailHtml('Neuf kilomètres', '9')));
    });
    const client = new VisorandoClient({ fetch: fetchMock });

    const results = await client.findHikes('Guebwiller', 10, 1.5, 5);

    expect(results.map(({ title }) => title)).toEqual(['Dix kilomètres', 'Neuf kilomètres']);
    expect(results.map(({ distanceDifferenceKm }) => distanceDifferenceKm)).toEqual([0.2, 1]);
  });
});
