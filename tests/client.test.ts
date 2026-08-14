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
});
