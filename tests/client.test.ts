import { describe, expect, it, vi } from 'vitest';
import { VisorandoClient } from '../src/client.js';

const response = (body: string): Response =>
  new Response(body, { status: 200, headers: { 'content-type': 'text/html; charset=UTF-8' } });

describe('VisorandoClient', () => {
  it('encode la recherche et met les réponses en cache', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockImplementation(() =>
        Promise.resolve(response('<section><a id="randonnees"></a><ul></ul></section>')),
      );
    const client = new VisorandoClient({ fetch: fetchMock, cacheTtlMs: 60_000 });
    await client.searchHikes('lac bleu');
    await client.searchHikes('lac bleu');
    expect(fetchMock).toHaveBeenCalledOnce();
    const requestedUrl = fetchMock.mock.calls[0]?.[0];
    expect(requestedUrl).toBeInstanceOf(URL);
    expect((requestedUrl as URL).searchParams.get('mainSearchInput')).toBe('lac bleu');
  });

  it.each([
    'https://evil.example/randonnee-test/',
    'https://www.visorando.com/index.php',
    'javascript:alert(1)',
  ])('bloque les références non sûres: %s', (reference) => {
    const client = new VisorandoClient();
    expect(() => client.normalizeHikeUrl(reference)).toThrow(/publiques/iu);
  });

  it('accepte un slug Visorando', () => {
    const client = new VisorandoClient();
    expect(client.normalizeHikeUrl('randonnee-lac-bleu/').toString()).toBe(
      'https://www.visorando.com/randonnee-lac-bleu/',
    );
  });

  it('nettoie les paramètres et rejette une URL syntaxiquement invalide', () => {
    const client = new VisorandoClient();
    expect(
      client.normalizeHikeUrl('https://www.visorando.com/randonnee-lac.html?x=1#avis').toString(),
    ).toBe('https://www.visorando.com/randonnee-lac.html');
    expect(() => client.normalizeHikeUrl('http://[')).toThrow(/invalide/iu);
  });

  it('classe les randonnées selon la distance cible et applique la tolérance', async () => {
    const searchHtml = `<section><a id="randonnees"></a><ul>
      <li><a href="https://www.visorando.com/randonnee-neuf/">Neuf kilomètres</a><span class="text-neutral-7">Pédestre • 9 km</span></li>
      <li><a href="https://www.visorando.com/randonnee-dix/">Dix kilomètres</a><span class="text-neutral-7">Pédestre • 10,2 km</span></li>
      <li><a href="https://www.visorando.com/randonnee-loin/">Trop loin</a><span class="text-neutral-7">Pédestre • 15 km</span></li>
    </ul></section>`;
    const detailHtml = (title: string, distance: string): string =>
      `<h1>${title}</h1><section><h2>Fiche technique</h2><div class="vr-walk-datasheet--dataset"><strong>Distance :</strong>${distance} km</div></section>`;
    const fetchMock = vi.fn<typeof fetch>().mockImplementation((input) => {
      const url =
        input instanceof URL ? input : new URL(typeof input === 'string' ? input : input.url);
      if (url.pathname === '/index.php') return Promise.resolve(response(searchHtml));
      if (url.pathname.includes('randonnee-dix'))
        return Promise.resolve(response(detailHtml('Dix kilomètres', '10,2')));
      return Promise.resolve(response(detailHtml('Neuf kilomètres', '9')));
    });
    const client = new VisorandoClient({ fetch: fetchMock });

    const results = await client.findHikes('Guebwiller', 10, 1.5, 5);

    expect(results.map(({ title }) => title)).toEqual(['Dix kilomètres', 'Neuf kilomètres']);
    expect(results.map(({ distanceDifferenceKm }) => distanceDifferenceKm)).toEqual([0.2, 1]);
  });

  it('conserve un résultat si sa fiche détaillée est indisponible', async () => {
    const searchHtml = `<section><a id="randonnees"></a><ul><li><a href="https://www.visorando.com/randonnee-lac/">Le lac</a><span class="text-neutral-7">Pédestre • 10 km</span></li></ul></section>`;
    const fetchMock = vi.fn<typeof fetch>().mockImplementation((input) => {
      const url =
        input instanceof URL ? input : new URL(typeof input === 'string' ? input : input.url);
      return Promise.resolve(
        url.pathname === '/index.php'
          ? response(searchHtml)
          : new Response('indisponible', { status: 503, headers: { 'content-type': 'text/html' } }),
      );
    });
    const client = new VisorandoClient({ fetch: fetchMock });
    await expect(client.findHikes('Lac', 10)).resolves.toEqual([
      expect.objectContaining({ title: 'Le lac', distanceKm: 10, distanceDifferenceKm: 0 }),
    ]);
  });

  it('résout une fiche par numéro et signale un numéro inconnu', async () => {
    const searchHtml = `<section><a id="randonnees"></a><ul><li><a href="https://www.visorando.com/randonnee-lac/">Randonnée 12345</a><span class="text-neutral-7">Pédestre • 5 km</span></li></ul></section>`;
    const fetchMock = vi.fn<typeof fetch>().mockImplementation((input) => {
      const url =
        input instanceof URL ? input : new URL(typeof input === 'string' ? input : input.url);
      return Promise.resolve(
        response(url.pathname === '/index.php' ? searchHtml : '<h1>Randonnée 12345</h1>'),
      );
    });
    const client = new VisorandoClient({ fetch: fetchMock });
    await expect(client.getHike('12345')).resolves.toMatchObject({ title: 'Randonnée 12345' });

    const emptyClient = new VisorandoClient({
      fetch: vi
        .fn<typeof fetch>()
        .mockResolvedValue(response('<section><a id="randonnees"></a><ul></ul></section>')),
    });
    await expect(emptyClient.getHike('99999')).rejects.toThrow(/aucune randonnée/iu);
  });

  it('signale les réponses HTTP et formats inattendus', async () => {
    const httpClient = new VisorandoClient({
      fetch: vi
        .fn<typeof fetch>()
        .mockResolvedValue(
          new Response('erreur', { status: 429, headers: { 'content-type': 'text/html' } }),
        ),
    });
    await expect(httpClient.searchHikes('Guebwiller')).rejects.toThrow(/429/u);
    const jsonClient = new VisorandoClient({
      fetch: vi
        .fn<typeof fetch>()
        .mockResolvedValue(
          new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } }),
        ),
    });
    await expect(jsonClient.searchHikes('Guebwiller')).rejects.toThrow(/format inattendu/iu);
  });

  it('recharge une entrée de cache expirée', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockImplementation(() =>
        Promise.resolve(response('<section><a id="randonnees"></a><ul></ul></section>')),
      );
    const client = new VisorandoClient({ fetch: fetchMock, cacheTtlMs: 0 });
    await client.searchHikes('Guebwiller');
    await client.searchHikes('Guebwiller');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
