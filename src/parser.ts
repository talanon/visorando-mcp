import { load } from 'cheerio';
import type { AnyNode } from 'domhandler';
import type { HikeDetails, HikeSummary } from './types.js';

const clean = (value: string): string => value.replace(/[\s\u00a0\u2009]+/gu, ' ').trim();

const parseFrenchNumber = (value: string): number | undefined => {
  const match = /-?[\d\s]+(?:[,.]\d+)?/u.exec(clean(value).replace(/[+−–]/gu, ''));
  if (!match) return undefined;
  const parsed = Number(match[0].replace(/\s/gu, '').replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : undefined;
};

const parseDuration = (value: string): number | undefined => {
  const normalized = clean(value);
  const hours = /(\d+)\s*h/u.exec(normalized)?.[1];
  const minutes = /h\s*(\d+)/u.exec(normalized)?.[1] ?? /^(\d+)\s*min/u.exec(normalized)?.[1];
  if (!hours && !minutes) return undefined;
  return Number(hours ?? 0) * 60 + Number(minutes ?? 0);
};

const scalarText = (value: unknown): string =>
  typeof value === 'string' || typeof value === 'number' ? String(value) : '';

const finiteNumber = (value: unknown): number | undefined => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

export function parseSearchResults(html: string, limit: number): HikeSummary[] {
  const $ = load(html);
  const results: HikeSummary[] = [];
  $('#randonnees')
    .closest('section')
    .find('li')
    .each((_, element) => {
      if (results.length >= limit) return;
      const item = $(element);
      const anchor = item.find('a[href*="/randonnee-"]').first();
      const title = clean(anchor.text());
      const url = anchor.attr('href');
      if (!title || !url) return;
      const metadata = clean(item.find('.text-neutral-7').text());
      const parts = metadata.split('•').map(clean);
      const result: HikeSummary = { title, url };
      if (parts[0]) result.activity = parts[0];
      const distanceKm = parseFrenchNumber(parts[1] ?? '');
      if (distanceKm !== undefined) result.distanceKm = distanceKm;
      results.push(result);
    });
  return results;
}

export function parseHikeDetails(html: string, canonicalUrl: string): HikeDetails {
  const $ = load(html);
  const dataset = new Map<string, string>();
  $('.vr-walk-datasheet--dataset').each((_, element) => {
    const label = clean($(element).find('strong').first().text()).replace(/\s*:\s*$/u, '');
    const clone = $(element).clone();
    clone.find('strong, i').remove();
    dataset.set(label, clean(clone.text()));
  });

  const title = clean($('h1').first().text());
  if (!title)
    throw new Error('La page ne contient pas de fiche de randonnée Visorando reconnaissable.');

  let structured: Record<string, unknown> = {};
  $('script[type="application/ld+json"]').each((_, element) => {
    try {
      const candidate = JSON.parse($(element).text()) as Record<string, unknown>;
      if (candidate['@type'] === 'Product') structured = candidate;
    } catch {
      // Une autre balise JSON-LD invalide ne doit pas empêcher la lecture de la fiche.
    }
  });

  const geo =
    typeof structured['geo'] === 'object' && structured['geo']
      ? (structured['geo'] as Record<string, unknown>)
      : {};
  const rating =
    typeof structured['aggregateRating'] === 'object' && structured['aggregateRating']
      ? (structured['aggregateRating'] as Record<string, unknown>)
      : {};
  const image = structured['image'];
  const section = $('h2')
    .filter((_, element) => clean($(element).text()) === 'Fiche technique')
    .closest('section');
  const dates = section
    .find('time')
    .toArray()
    .map((node: AnyNode) => $(node).attr('datetime'));
  const id = clean(section.find('.select-all').first().text()) || undefined;
  const coordinates = dataset.get('Départ/Arrivée') ?? '';
  const coordinateValues = [...coordinates.matchAll(/([NSOE])\s*([\d.,]+)/gu)];
  const coordinate = (index: number): number | undefined => {
    const item = coordinateValues[index];
    if (!item?.[1] || !item[2]) return undefined;
    const value = Number(item[2].replace(',', '.'));
    return ['S', 'O'].includes(item[1]) ? -value : value;
  };
  const numberValue = (key: string): number | undefined =>
    parseFrenchNumber(dataset.get(key) ?? '');
  const result: HikeDetails = { title, url: canonicalUrl };

  const values: [keyof HikeDetails, unknown][] = [
    ['id', id],
    ['activity', dataset.get('Activité')],
    ['distanceKm', numberValue('Distance')],
    ['durationMinutes', parseDuration(dataset.get('Durée moyenne') ?? '')],
    ['difficulty', dataset.get('Difficulté')],
    ['elevationGainM', numberValue('Dénivelé positif')],
    ['elevationLossM', Math.abs(numberValue('Dénivelé négatif') ?? Number.NaN)],
    ['highestPointM', numberValue('Point haut')],
    ['lowestPointM', numberValue('Point bas')],
    [
      'loop',
      dataset.has('Retour au départ')
        ? /^oui$/iu.test(dataset.get('Retour au départ') ?? '')
        : undefined,
    ],
    ['country', dataset.get('Pays')],
    ['municipality', dataset.get('Commune')],
    ['latitude', finiteNumber(geo['latitude']) ?? coordinate(0)],
    ['longitude', finiteNumber(geo['longitude']) ?? coordinate(1)],
    ['createdAt', dates[0]],
    ['updatedAt', dates[1]],
    ['lastReviewAt', dates[2]],
    ['rating', parseFrenchNumber(scalarText(rating['ratingValue']))],
    ['reviewCount', parseFrenchNumber(scalarText(rating['reviewCount']))],
    ['imageUrl', typeof image === 'string' ? image : undefined],
  ];
  for (const [key, value] of values) {
    if (
      value !== undefined &&
      value !== '' &&
      !(typeof value === 'number' && !Number.isFinite(value))
    ) {
      Object.assign(result, { [key]: value });
    }
  }
  return result;
}
