import { parseHikeDetails, parseSearchResults } from './parser.js';
import type { HikeDetails, HikeSummary } from './types.js';

const BASE_URL = 'https://www.visorando.com';
const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_CACHE_TTL_MS = 5 * 60_000;

interface CacheEntry {
  expiresAt: number;
  value: string;
}

export interface ClientOptions {
  fetch?: typeof globalThis.fetch;
  timeoutMs?: number;
  cacheTtlMs?: number;
  userAgent?: string;
}

export class VisorandoClient {
  private readonly fetchImpl: typeof globalThis.fetch;
  private readonly timeoutMs: number;
  private readonly cacheTtlMs: number;
  private readonly userAgent: string;
  private readonly cache = new Map<string, CacheEntry>();

  constructor(options: ClientOptions = {}) {
    this.fetchImpl = options.fetch ?? globalThis.fetch;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.cacheTtlMs = options.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS;
    this.userAgent = options.userAgent ?? 'visorando-mcp/1.0 (+https://github.com/talanon/visorando-mcp)';
  }

  async searchHikes(query: string, limit = 10): Promise<HikeSummary[]> {
    const url = new URL('/index.php', BASE_URL);
    url.searchParams.set('component', 'search');
    url.searchParams.set('task', 'searchRandonnee');
    url.searchParams.set('mainSearchInput', query);
    const html = await this.get(url);
    return parseSearchResults(html, limit);
  }

  async getHike(reference: string): Promise<HikeDetails> {
    if (/^\d+$/u.test(reference)) {
      const matches = await this.searchHikes(reference, 10);
      const exact = matches.find((item) => item.title.includes(reference)) ?? matches[0];
      if (!exact) throw new Error(`Aucune randonnée trouvée pour le numéro ${reference}.`);
      return this.getHike(exact.url);
    }
    const url = this.normalizeHikeUrl(reference);
    return parseHikeDetails(await this.get(url), url.toString());
  }

  normalizeHikeUrl(reference: string): URL {
    let url: URL;
    try {
      url = new URL(reference, BASE_URL);
    } catch {
      throw new Error('Référence de randonnée invalide. Utilisez une URL Visorando ou un slug.');
    }
    if (url.origin !== BASE_URL || !/^\/randonnee-[a-z0-9-]+(?:\/|\.html)$/iu.test(url.pathname)) {
      throw new Error('Seules les fiches publiques https://www.visorando.com/randonnee-… sont acceptées.');
    }
    url.search = '';
    url.hash = '';
    return url;
  }

  private async get(url: URL): Promise<string> {
    const key = url.toString();
    const cached = this.cache.get(key);
    if (cached && cached.expiresAt > Date.now()) return cached.value;
    const response = await this.fetchImpl(url, {
      headers: { accept: 'text/html,application/xhtml+xml', 'user-agent': this.userAgent },
      redirect: 'follow',
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    if (!response.ok) throw new Error(`Visorando a répondu avec le statut HTTP ${response.status}.`);
    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.includes('text/html')) throw new Error('Visorando a renvoyé un format inattendu.');
    const body = await response.text();
    this.cache.set(key, { expiresAt: Date.now() + this.cacheTtlMs, value: body });
    return body;
  }
}
