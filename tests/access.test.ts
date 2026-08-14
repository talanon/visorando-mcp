import { describe, expect, it, vi } from 'vitest';
import { AccessClient } from '../src/access.js';

describe('AccessClient', () => {
  it('classe parkings et transports par distance et produit des liens', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          elements: [
            {
              type: 'way',
              id: 10,
              center: { lat: 48.001, lon: 7 },
              tags: { amenity: 'parking', name: 'Parking du col' },
            },
            {
              type: 'node',
              id: 11,
              lat: 48.002,
              lon: 7,
              tags: { highway: 'bus_stop', name: 'Mairie' },
            },
            {
              type: 'node',
              id: 12,
              lat: 48.01,
              lon: 7,
              tags: { railway: 'station', name: 'Gare' },
            },
            {
              type: 'node',
              id: 13,
              lat: 48.003,
              lon: 7,
              tags: { railway: 'tram_stop' },
            },
            {
              type: 'node',
              id: 14,
              lat: 48.004,
              lon: 7,
              tags: { public_transport: 'station', name: 'Pôle multimodal' },
            },
            {
              type: 'node',
              id: 15,
              lat: 48.005,
              lon: 7,
              tags: { bus: 'yes' },
            },
            { type: 'node', id: 16, tags: { tourism: 'viewpoint' } },
          ],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );
    const result = await new AccessClient({ fetch: fetchMock }).findAccess(48, 7, 2000, 5);

    expect(result.parkings).toEqual([
      expect.objectContaining({ kind: 'parking', name: 'Parking du col' }),
    ]);
    expect(result.publicTransport.map(({ name }) => name)).toEqual([
      'Mairie',
      'Arrêt sans nom',
      'Pôle multimodal',
      'Arrêt sans nom',
      'Gare',
    ]);
    expect(result.parkings[0]?.osmUrl).toBe('https://www.openstreetmap.org/way/10');
    expect(result.suggestedParking).toEqual({
      name: 'Stationnement indicatif au Départ/Arrivée Visorando',
      latitude: 48,
      longitude: 7,
      coordinateText: 'N 48° / E 7°',
      googleMapsUrl: 'https://www.google.com/maps/search/?api=1&query=48,7',
      verifiedParking: false,
    });
    const calledUrl = fetchMock.mock.calls[0]?.[0];
    expect(calledUrl).toBeInstanceOf(URL);
    expect((calledUrl as URL).searchParams.get('data')).toContain('amenity=parking');
  });

  it('conserve le Départ/Arrivée Visorando si Overpass est indisponible', async () => {
    const client = new AccessClient({
      fetch: vi.fn<typeof fetch>().mockResolvedValue(new Response('busy', { status: 503 })),
    });
    await expect(client.findAccess(48, 7)).resolves.toMatchObject({
      suggestedParking: {
        coordinateText: 'N 48° / E 7°',
        googleMapsUrl: 'https://www.google.com/maps/search/?api=1&query=48,7',
        verifiedParking: false,
      },
      parkings: [],
      notes: [expect.stringContaining('Départ/Arrivée'), expect.stringContaining('503')],
    });
  });

  it('accepte une réponse vide avec les options par défaut', async () => {
    const client = new AccessClient({
      fetch: vi
        .fn<typeof fetch>()
        .mockResolvedValue(
          new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } }),
        ),
    });
    await expect(client.findAccess(47.835626, 7.177279)).resolves.toMatchObject({
      start: {
        coordinateText: 'N 47.835626° / E 7.177279°',
        navigationUrl: 'https://www.google.com/maps/search/?api=1&query=47.835626,7.177279',
      },
      suggestedParking: {
        coordinateText: 'N 47.835626° / E 7.177279°',
        googleMapsUrl: 'https://www.google.com/maps/search/?api=1&query=47.835626,7.177279',
      },
      parkings: [],
      publicTransport: [],
    });
  });
});
