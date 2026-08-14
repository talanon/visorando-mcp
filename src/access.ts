import type { AccessPoint, AccessPointKind, HikeAccessPlan } from './types.js';

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
const DEFAULT_TIMEOUT_MS = 12_000;

interface OverpassElement {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat?: number; lon?: number };
  tags?: Record<string, string>;
}

interface OverpassResponse {
  elements?: OverpassElement[];
}

export interface AccessClientOptions {
  fetch?: typeof globalThis.fetch;
  timeoutMs?: number;
  userAgent?: string;
}

const radians = (degrees: number): number => (degrees * Math.PI) / 180;

const distanceMeters = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const earthRadius = 6_371_000;
  const deltaLat = radians(lat2 - lat1);
  const deltaLon = radians(lon2 - lon1);
  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(radians(lat1)) * Math.cos(radians(lat2)) * Math.sin(deltaLon / 2) ** 2;
  return Math.round(earthRadius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
};

const kindOf = (tags: Record<string, string>): AccessPointKind | undefined => {
  if (tags['amenity'] === 'parking') return 'parking';
  if (tags['railway'] === 'station' || tags['public_transport'] === 'station')
    return 'rail_station';
  if (tags['railway'] === 'tram_stop') return 'tram_stop';
  if (tags['highway'] === 'bus_stop' || tags['bus'] === 'yes') return 'bus_stop';
  return undefined;
};

export class AccessClient {
  private readonly fetchImpl: typeof globalThis.fetch;
  private readonly timeoutMs: number;
  private readonly userAgent: string;

  constructor(options: AccessClientOptions = {}) {
    this.fetchImpl = options.fetch ?? globalThis.fetch;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.userAgent =
      options.userAgent ?? 'visorando-mcp/1.0 (+https://github.com/talanon/visorando-mcp)';
  }

  async findAccess(
    latitude: number,
    longitude: number,
    radiusMeters = 1500,
    limitPerCategory = 5,
  ): Promise<HikeAccessPlan> {
    const coordinateText = `N ${String(latitude)}° / E ${String(longitude)}°`;
    const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${String(latitude)},${String(longitude)}`;
    const start = {
      label: 'Départ/Arrivée Visorando',
      latitude,
      longitude,
      coordinateText,
      navigationUrl: googleMapsUrl,
    };
    const suggestedParking = {
      name: 'Stationnement indicatif au Départ/Arrivée Visorando',
      latitude,
      longitude,
      coordinateText,
      googleMapsUrl,
      verifiedParking: false as const,
    };
    const around = `${String(radiusMeters)},${String(latitude)},${String(longitude)}`;
    const query = `[out:json][timeout:10];(nwr[amenity=parking](around:${around});nwr[highway=bus_stop](around:${around});nwr[railway~"^(station|tram_stop)$"](around:${around});nwr[public_transport=station](around:${around}););out center tags;`;
    const url = new URL(OVERPASS_URL);
    url.searchParams.set('data', query);
    let payload: OverpassResponse;
    try {
      const response = await this.fetchImpl(url, {
        headers: { accept: 'application/json', 'user-agent': this.userAgent },
        signal: AbortSignal.timeout(this.timeoutMs),
      });
      if (!response.ok)
        throw new Error(
          `OpenStreetMap Overpass a répondu avec le statut ${String(response.status)}.`,
        );
      payload = (await response.json()) as OverpassResponse;
    } catch (error) {
      return {
        start,
        suggestedParking,
        parkings: [],
        publicTransport: [],
        notes: [
          'Le point Départ/Arrivée vient des coordonnées publiques de la fiche Visorando. Il sert de stationnement indicatif, mais ne garantit pas l’existence ni l’autorisation d’un parking à cet emplacement.',
          `Recherche OpenStreetMap indisponible : ${error instanceof Error ? error.message : 'erreur inconnue'}`,
        ],
      };
    }
    const points = (payload.elements ?? []).flatMap((element): AccessPoint[] => {
      const tags = element.tags ?? {};
      const kind = kindOf(tags);
      const pointLatitude = element.lat ?? element.center?.lat;
      const pointLongitude = element.lon ?? element.center?.lon;
      if (!kind || pointLatitude === undefined || pointLongitude === undefined) return [];
      const mode = kind === 'parking' ? 'driving' : 'transit';
      return [
        {
          kind,
          name: tags['name'] ?? (kind === 'parking' ? 'Parking sans nom' : 'Arrêt sans nom'),
          latitude: pointLatitude,
          longitude: pointLongitude,
          distanceFromStartMeters: distanceMeters(
            latitude,
            longitude,
            pointLatitude,
            pointLongitude,
          ),
          osmUrl: `https://www.openstreetmap.org/${element.type}/${String(element.id)}`,
          navigationUrl: `https://www.google.com/maps/dir/?api=1&destination=${String(pointLatitude)},${String(pointLongitude)}&travelmode=${mode}`,
        },
      ];
    });
    const nearest = (items: AccessPoint[]): AccessPoint[] =>
      items
        .sort((left, right) => left.distanceFromStartMeters - right.distanceFromStartMeters)
        .slice(0, limitPerCategory);
    return {
      start,
      suggestedParking,
      parkings: nearest(points.filter(({ kind }) => kind === 'parking')),
      publicTransport: nearest(points.filter(({ kind }) => kind !== 'parking')),
      notes: [
        'Le point Départ/Arrivée vient des coordonnées publiques de la fiche Visorando. Il sert de stationnement indicatif, mais ne garantit pas l’existence ni l’autorisation d’un parking à cet emplacement.',
        'Distances à vol d’oiseau depuis les coordonnées publiques du départ.',
        'Présence issue d’OpenStreetMap : vérifier accès, horaires, desserte, travaux, restrictions et capacité avant le départ.',
        'Les liens transport ouvrent un calculateur d’itinéraire ; ce résultat ne constitue pas un horaire en temps réel.',
      ],
    };
  }
}
