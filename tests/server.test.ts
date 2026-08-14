import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { VisorandoClient } from '../src/client.js';
import { createServer } from '../src/server.js';

describe('MCP server', () => {
  const closeCallbacks: Array<() => Promise<void>> = [];

  afterEach(async () => {
    await Promise.all(closeCallbacks.splice(0).map((close) => close()));
  });

  it('négocie le protocole et expose les trois outils', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response(
      '<section><a id="randonnees"></a><ul><li><a href="https://www.visorando.com/randonnee-lac/">Le lac</a><span class="text-neutral-7">Pédestre • 5 km</span></li></ul></section>',
      { status: 200, headers: { 'content-type': 'text/html' } },
    ));
    const server = createServer(new VisorandoClient({ fetch: fetchMock }));
    const mcpClient = new Client({ name: 'test-client', version: '1.0.0' });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(serverTransport), mcpClient.connect(clientTransport)]);
    closeCallbacks.push(() => mcpClient.close(), () => server.close());

    const tools = await mcpClient.listTools();
    expect(tools.tools.map(({ name }) => name)).toEqual(['search_hikes', 'get_hike', 'compare_hikes']);
    const result = await mcpClient.callTool({ name: 'search_hikes', arguments: { query: 'lac', limit: 1 } });
    expect(result.isError).not.toBe(true);
    expect(result.structuredContent).toMatchObject({ result: [{ title: 'Le lac', distanceKm: 5 }] });
  });
});
