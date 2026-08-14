import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AccessClient } from '../src/access.js';
import { VisorandoClient } from '../src/client.js';
import { createServer } from '../src/server.js';

describe('MCP server', () => {
  const closeCallbacks: (() => Promise<void>)[] = [];

  afterEach(async () => {
    await Promise.all(closeCallbacks.splice(0).map((close) => close()));
  });

  it('expose et exécute outils, ressource et prompt', async () => {
    const searchHtml =
      '<section><a id="randonnees"></a><ul><li><a href="https://www.visorando.com/randonnee-lac/">Le lac</a><span class="text-neutral-7">Pédestre • 5 km</span></li><li><a href="https://www.visorando.com/randonnee-mont/">Le mont</a><span class="text-neutral-7">Pédestre • 6 km</span></li></ul></section>';
    const fetchMock = vi.fn<typeof fetch>().mockImplementation((input) => {
      const url =
        input instanceof URL ? input : new URL(typeof input === 'string' ? input : input.url);
      const isMont = url.pathname.includes('mont');
      const body =
        url.pathname === '/index.php'
          ? searchHtml
          : `<h1>${isMont ? 'Le mont' : 'Le lac'}</h1><script type="application/ld+json">{"@type":"Product","image":"https://images.example/trail.jpg","geo":{"latitude":48,"longitude":7}}</script><section><h2>Fiche technique</h2><div class="vr-walk-datasheet--dataset"><strong>Distance :</strong>${isMont ? '6' : '5'} km</div><div class="vr-walk-datasheet--dataset"><strong>Dénivelé positif :</strong>500 m</div></section>`;
      return Promise.resolve(
        new Response(body, { status: 200, headers: { 'content-type': 'text/html' } }),
      );
    });
    const accessFetch = vi.fn<typeof fetch>().mockImplementation(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            elements: [
              {
                type: 'node',
                id: 42,
                lat: 48.001,
                lon: 7,
                tags: { amenity: 'parking', name: 'Parking test' },
              },
            ],
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      ),
    );
    const server = createServer(
      new VisorandoClient({ fetch: fetchMock }),
      new AccessClient({ fetch: accessFetch }),
    );
    const mcpClient = new Client({ name: 'test-client', version: '1.0.0' });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(serverTransport), mcpClient.connect(clientTransport)]);
    closeCallbacks.push(
      () => mcpClient.close(),
      () => server.close(),
    );

    const tools = await mcpClient.listTools();
    expect(tools.tools.map(({ name }) => name)).toEqual([
      'search_hikes',
      'get_hike',
      'find_hikes',
      'compare_hikes',
      'estimate_trail_needs',
      'find_hike_access',
      'prepare_trail',
    ]);
    expect(tools.tools.find(({ name }) => name === 'find_hikes')?.description).toContain(
      '4, 6 puis 8 km',
    );

    const search = await mcpClient.callTool({
      name: 'search_hikes',
      arguments: { query: 'lac', limit: 1 },
    });
    expect(search.structuredContent).toMatchObject({ result: [{ title: 'Le lac' }] });

    const details = await mcpClient.callTool({
      name: 'get_hike',
      arguments: { reference: 'randonnee-lac/' },
    });
    expect(details.structuredContent).toMatchObject({ result: { title: 'Le lac', distanceKm: 5 } });

    const matches = await mcpClient.callTool({
      name: 'find_hikes',
      arguments: { location: 'Lac', targetDistanceKm: 5, toleranceKm: 2, limit: 2 },
    });
    expect(matches.structuredContent).toMatchObject({
      result: [{ title: 'Le lac' }, { title: 'Le mont' }],
    });

    const comparison = await mcpClient.callTool({
      name: 'compare_hikes',
      arguments: { references: ['randonnee-lac/', 'randonnee-mont/'] },
    });
    expect(comparison.structuredContent).toMatchObject({
      result: [{ title: 'Le lac' }, { title: 'Le mont' }],
    });

    const needs = await mcpClient.callTool({
      name: 'estimate_trail_needs',
      arguments: { durationMinutes: 180, temperature: 'mild' },
    });
    expect(needs.structuredContent).toMatchObject({
      result: {
        carbohydrateGramsPerHour: { min: 30, max: 40 },
        servingsToPack: 5,
      },
    });

    const access = await mcpClient.callTool({
      name: 'find_hike_access',
      arguments: { reference: 'randonnee-lac/', radiusMeters: 2000 },
    });
    expect(access.structuredContent).toMatchObject({
      result: { parkings: [{ name: 'Parking test' }] },
    });

    const prepared = await mcpClient.callTool({
      name: 'prepare_trail',
      arguments: {
        reference: 'randonnee-lac/',
        expectedDurationMinutes: 120,
        includeAccess: true,
      },
    });
    expect(prepared.isError, JSON.stringify(prepared.content)).not.toBe(true);
    expect(prepared.structuredContent).toMatchObject({
      result: {
        estimatedDurationMinutes: 120,
        durationSource: 'user',
        photos: [
          {
            url: 'https://images.example/trail.jpg',
            sourceUrl: 'https://www.visorando.com/randonnee-lac/',
          },
        ],
        access: {
          suggestedParking: {
            coordinateText: 'N 48° / E 7°',
            googleMapsUrl: 'https://www.google.com/maps/search/?api=1&query=48,7',
            verifiedParking: false,
          },
          parkings: [{ name: 'Parking test' }],
        },
      },
    });

    accessFetch.mockRejectedValueOnce(new Error('Overpass indisponible'));
    const preparedWithoutAccess = await mcpClient.callTool({
      name: 'prepare_trail',
      arguments: {
        reference: 'randonnee-lac/',
        expectedDurationMinutes: 120,
        includeAccess: true,
      },
    });
    expect(preparedWithoutAccess.isError).not.toBe(true);
    expect(JSON.stringify(preparedWithoutAccess.structuredContent)).toContain(
      'Overpass indisponible',
    );

    const estimated = await mcpClient.callTool({
      name: 'prepare_trail',
      arguments: { reference: 'randonnee-lac/', includeAccess: false },
    });
    expect(estimated.structuredContent).toMatchObject({
      result: { estimatedDurationMinutes: 60, durationSource: 'pace-and-km-effort' },
    });

    const invalidAccess = await mcpClient.callTool({
      name: 'find_hike_access',
      arguments: { reference: 'https://evil.example/randonnee-lac/' },
    });
    expect(invalidAccess.isError).toBe(true);

    const invalid = await mcpClient.callTool({
      name: 'get_hike',
      arguments: { reference: 'https://evil.example/randonnee-lac/' },
    });
    expect(invalid.isError).toBe(true);

    const resource = await mcpClient.readResource({ uri: 'visorando://legal' });
    expect(resource.contents[0]?.mimeType).toBe('text/markdown');
    const method = await mcpClient.readResource({ uri: 'visorando://trail-planning-method' });
    expect(method.contents[0]?.mimeType).toBe('text/markdown');

    const prompt = await mcpClient.getPrompt({
      name: 'choose_a_hike',
      arguments: { place: 'Guebwiller', preferences: '10 km' },
    });
    const promptContent = prompt.messages[0]?.content;
    expect(promptContent).toMatchObject({ type: 'text' });
    if (promptContent?.type !== 'text') throw new Error('Prompt texte attendu.');
    expect(promptContent.text).toContain('tolérances de 4, 6 puis 8 km');
    expect(promptContent.text).toContain('Départ/Arrivée Visorando');
    expect(promptContent.text).toContain('30 à 40 g');

    const trailPrompt = await mcpClient.getPrompt({
      name: 'prepare_a_trail',
      arguments: { place: 'Guebwiller', distance: '20 km' },
    });
    const trailPromptContent = trailPrompt.messages[0]?.content;
    expect(trailPromptContent).toMatchObject({ type: 'text' });
    if (trailPromptContent?.type !== 'text') throw new Error('Prompt texte attendu.');
    expect(trailPromptContent.text).toContain('prepare_trail');
    expect(trailPromptContent.text).toContain('6 min/km-effort');
  });
});
