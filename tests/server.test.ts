import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { afterEach, describe, expect, it, vi } from 'vitest';
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
          : `<h1>${isMont ? 'Le mont' : 'Le lac'}</h1><section><h2>Fiche technique</h2><div class="vr-walk-datasheet--dataset"><strong>Distance :</strong>${isMont ? '6' : '5'} km</div></section>`;
      return Promise.resolve(
        new Response(body, { status: 200, headers: { 'content-type': 'text/html' } }),
      );
    });
    const server = createServer(new VisorandoClient({ fetch: fetchMock }));
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
    ]);

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

    const invalid = await mcpClient.callTool({
      name: 'get_hike',
      arguments: { reference: 'https://evil.example/randonnee-lac/' },
    });
    expect(invalid.isError).toBe(true);

    const resource = await mcpClient.readResource({ uri: 'visorando://legal' });
    expect(resource.contents[0]?.mimeType).toBe('text/markdown');

    const prompt = await mcpClient.getPrompt({
      name: 'choose_a_hike',
      arguments: { place: 'Guebwiller', preferences: '10 km' },
    });
    expect(prompt.messages[0]?.content).toMatchObject({ type: 'text' });
  });
});
