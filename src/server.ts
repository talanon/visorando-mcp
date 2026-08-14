import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { AccessClient } from './access.js';
import { VisorandoClient } from './client.js';
import { estimateTrailDuration, estimateTrailNeeds } from './planner.js';

const toToolResult = (value: unknown): CallToolResult => ({
  content: [{ type: 'text' as const, text: JSON.stringify(value, null, 2) }],
  structuredContent: { result: value },
});

const errorResult = (error: unknown): CallToolResult => ({
  content: [
    { type: 'text' as const, text: error instanceof Error ? error.message : 'Erreur inconnue.' },
  ],
  isError: true,
});

export function createServer(
  client = new VisorandoClient(),
  accessClient = new AccessClient(),
): McpServer {
  const server = new McpServer({ name: 'visorando-mcp', version: '1.0.0' });

  server.registerTool(
    'search_hikes',
    {
      title: 'Rechercher des randonnées Visorando',
      description: 'Recherche des fiches publiques Visorando par lieu, titre, mot-clé ou numéro.',
      inputSchema: {
        query: z
          .string()
          .trim()
          .min(3)
          .max(120)
          .describe('Lieu, titre, mot-clé ou numéro de randonnée'),
        limit: z.number().int().min(1).max(20).default(10),
      },
    },
    async ({ query, limit }) => {
      try {
        return toToolResult(await client.searchHikes(query, limit));
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    'get_hike',
    {
      title: 'Consulter une randonnée Visorando',
      description:
        'Lit les métadonnées publiques d’une fiche sans reproduire sa description ni sa trace protégées.',
      inputSchema: {
        reference: z
          .string()
          .trim()
          .min(1)
          .max(500)
          .describe('URL Visorando, slug randonnee-… ou numéro'),
      },
    },
    async ({ reference }) => {
      try {
        return toToolResult(await client.getHike(reference));
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    'find_hikes',
    {
      title: 'Trouver une randonnée selon des critères',
      description:
        'Trouve et classe des randonnées autour d’un lieu selon une distance cible. Exemple : « trouve une randonnée de 10 km autour de Guebwiller » devient location="Guebwiller", targetDistanceKm=10. Commence avec toleranceKm=2. Si l’appel renvoie moins de deux résultats, rappelle cet outil en augmentant toleranceKm de 2, au maximum trois fois (4, 6 puis 8 km). Après ces trois élargissements, si aucun résultat n’a été trouvé, indique-le clairement. Dès qu’une sortie est proposée, appelle prepare_trail pour fournir aussi stationnement, eau et nourriture.',
      inputSchema: {
        location: z
          .string()
          .trim()
          .min(2)
          .max(120)
          .describe('Ville, commune ou lieu autour duquel chercher'),
        targetDistanceKm: z
          .number()
          .positive()
          .max(500)
          .describe('Distance souhaitée en kilomètres'),
        toleranceKm: z
          .number()
          .nonnegative()
          .max(100)
          .default(2)
          .describe('Écart maximal accepté autour de la distance cible'),
        limit: z
          .number()
          .int()
          .min(1)
          .max(10)
          .default(5)
          .describe('Nombre maximal de propositions'),
      },
    },
    async ({ location, targetDistanceKm, toleranceKm, limit }) => {
      try {
        return toToolResult(await client.findHikes(location, targetDistanceKm, toleranceKm, limit));
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    'compare_hikes',
    {
      title: 'Comparer des randonnées Visorando',
      description: 'Compare les métadonnées de deux à cinq fiches publiques.',
      inputSchema: {
        references: z.array(z.string().trim().min(1).max(500)).min(2).max(5),
      },
    },
    async ({ references }) => {
      try {
        return toToolResult(
          await Promise.all(references.map((reference) => client.getHike(reference))),
        );
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    'estimate_trail_needs',
    {
      title: 'Estimer glucides et eau pour un trail',
      description:
        'Calcule les glucides sur la base de 30 à 40 g/h, ainsi que l’eau, le sodium et les portions à emporter à partir de la durée prévue et des conditions. Il s’agit d’une aide indicative à tester à l’entraînement, pas d’un avis médical.',
      inputSchema: {
        durationMinutes: z.number().positive().max(10_000).describe('Durée prévue du trail'),
        temperature: z.enum(['cold', 'mild', 'hot']).default('mild'),
        sweatRateLitersPerHour: z
          .number()
          .positive()
          .max(3)
          .optional()
          .describe('Taux de sudation personnel mesuré ; omettre s’il est inconnu'),
        availableWaterLiters: z
          .number()
          .nonnegative()
          .max(100)
          .default(0)
          .describe('Eau potable fiable disponible aux ravitaillements'),
        reserveWaterLiters: z.number().nonnegative().max(5).default(0.25),
        carbsPerServingGrams: z
          .number()
          .positive()
          .max(200)
          .default(25)
          .describe('Glucides d’un gel, d’une portion ou d’une flasque énergétique'),
        saltySweater: z.boolean().default(false),
      },
    },
    (input) => {
      try {
        return Promise.resolve(toToolResult(estimateTrailNeeds(input)));
      } catch (error) {
        return Promise.resolve(errorResult(error));
      }
    },
  );

  server.registerTool(
    'find_hike_access',
    {
      title: 'Trouver parkings et transports près du départ',
      description:
        'Utilise le Départ/Arrivée Visorando comme stationnement indicatif avec coordonnées et lien Google Maps, puis recherche dans OpenStreetMap les parkings, gares, tramways et arrêts de bus proches. Renvoie des distances à vol d’oiseau et des liens de navigation à vérifier.',
      inputSchema: {
        reference: z.string().trim().min(1).max(500),
        radiusMeters: z.number().int().min(100).max(10_000).default(1500),
        limitPerCategory: z.number().int().min(1).max(10).default(5),
      },
    },
    async ({ reference, radiusMeters, limitPerCategory }) => {
      try {
        const hike = await client.getHike(reference);
        if (hike.latitude === undefined || hike.longitude === undefined)
          throw new Error(
            'La fiche ne fournit pas de coordonnées de départ exploitables pour rechercher les accès.',
          );
        return toToolResult(
          await accessClient.findAccess(
            hike.latitude,
            hike.longitude,
            radiusMeters,
            limitPerCategory,
          ),
        );
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    'prepare_trail',
    {
      title: 'Préparer entièrement une sortie trail',
      description:
        'Combine une fiche Visorando, une durée trail estimée, le plan glucides/eau, le Départ/Arrivée reporté sur Google Maps, les accès et les photos illustratives disponibles. Fournir expectedDurationMinutes dès que possible ; sinon l’outil estime la durée avec le km-effort à 6 min/km.',
      inputSchema: {
        reference: z.string().trim().min(1).max(500),
        expectedDurationMinutes: z.number().positive().max(10_000).optional(),
        flatPaceMinutesPerKm: z.number().positive().max(60).default(6),
        temperature: z.enum(['cold', 'mild', 'hot']).default('mild'),
        sweatRateLitersPerHour: z.number().positive().max(3).optional(),
        availableWaterLiters: z.number().nonnegative().max(100).default(0),
        reserveWaterLiters: z.number().nonnegative().max(5).default(0.25),
        carbsPerServingGrams: z.number().positive().max(200).default(25),
        saltySweater: z.boolean().default(false),
        includeAccess: z.boolean().default(true),
        accessRadiusMeters: z.number().int().min(100).max(10_000).default(1500),
        accessLimitPerCategory: z.number().int().min(1).max(10).default(5),
      },
    },
    async ({
      reference,
      expectedDurationMinutes,
      flatPaceMinutesPerKm,
      temperature,
      sweatRateLitersPerHour,
      availableWaterLiters,
      reserveWaterLiters,
      carbsPerServingGrams,
      saltySweater,
      includeAccess,
      accessRadiusMeters,
      accessLimitPerCategory,
    }) => {
      try {
        const hike = await client.getHike(reference);
        const duration = estimateTrailDuration(
          hike.distanceKm,
          hike.elevationGainM,
          expectedDurationMinutes,
          flatPaceMinutesPerKm,
        );
        const needs = estimateTrailNeeds({
          durationMinutes: duration.minutes,
          temperature,
          sweatRateLitersPerHour,
          availableWaterLiters,
          reserveWaterLiters,
          carbsPerServingGrams,
          saltySweater,
        });
        let access: Awaited<ReturnType<AccessClient['findAccess']>> | undefined;
        if (includeAccess && hike.latitude !== undefined && hike.longitude !== undefined) {
          try {
            access = await accessClient.findAccess(
              hike.latitude,
              hike.longitude,
              accessRadiusMeters,
              accessLimitPerCategory,
            );
          } catch (error) {
            needs.warnings.push(
              `Accès indisponible lors de cette recherche : ${error instanceof Error ? error.message : 'erreur inconnue'}. Réessayer avec find_hike_access.`,
            );
          }
        }
        if (expectedDurationMinutes === undefined)
          needs.warnings.push(
            'Durée estimée par km-effort (distance + D+/100) : remplacez-la par votre durée réaliste pour fiabiliser les quantités.',
          );
        if (
          includeAccess &&
          !access &&
          (hike.latitude === undefined || hike.longitude === undefined)
        )
          needs.warnings.push(
            'Accès non recherché car les coordonnées de départ manquent sur la fiche.',
          );
        return toToolResult({
          hike,
          estimatedDurationMinutes: duration.minutes,
          durationSource: duration.source,
          needs,
          photos: hike.imageUrl
            ? [
                {
                  url: hike.imageUrl,
                  caption: `Photo illustrative associée à la fiche « ${hike.title} »`,
                  sourceUrl: hike.url,
                },
              ]
            : [],
          ...(access ? { access } : {}),
        });
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerResource(
    'legal-notice',
    new ResourceTemplate('visorando://legal', { list: undefined }),
    {
      title: 'Périmètre légal et technique',
      description: 'Limites volontaires du connecteur non officiel.',
    },
    (uri) =>
      Promise.resolve({
        contents: [
          {
            uri: uri.href,
            mimeType: 'text/markdown',
            text: 'Ce serveur non officiel lit uniquement les pages publiques autorisées à l’indexation. Il ne reproduit pas les descriptions, cartes ou traces GPS, indiquées par Visorando comme propriété de leurs auteurs. Les résultats contiennent toujours un lien vers la fiche source.',
          },
        ],
      }),
  );

  server.registerResource(
    'trail-planning-method',
    new ResourceTemplate('visorando://trail-planning-method', { list: undefined }),
    {
      title: 'Méthode de préparation trail',
      description: 'Hypothèses et limites des estimations de durée, nutrition, eau et accès.',
    },
    (uri) =>
      Promise.resolve({
        contents: [
          {
            uri: uri.href,
            mimeType: 'text/markdown',
            text: 'Les glucides sont estimés par défaut entre 30 et 40 g/h. L’eau dépend en priorité du taux de sudation individuel ; les valeurs génériques varient avec la température. La durée de secours emploie le km-effort = distance (km) + D+ (m)/100, multiplié par une allure moyenne de 6 min/km. Les accès proviennent d’OpenStreetMap, les distances sont à vol d’oiseau et les horaires ne sont pas temps réel. Toutes les valeurs doivent être vérifiées et testées avant une sortie engagée.',
          },
        ],
      }),
  );

  server.registerPrompt(
    'choose_a_hike',
    {
      title: 'Choisir une randonnée',
      description: 'Guide la recherche puis la comparaison de randonnées Visorando.',
      argsSchema: {
        place: z.string().describe('Lieu souhaité'),
        preferences: z.string().optional().describe('Durée, difficulté et autres préférences'),
      },
    },
    ({ place, preferences }) => ({
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: `Recherche des randonnées Visorando autour de ${place}. ${preferences ?? ''} Utilise find_hikes dès qu’une distance est demandée ; sinon utilise search_hikes. Avec find_hikes, commence avec une tolérance de 2 km. Si tu obtiens moins de deux résultats, augmente-la de 2 km et recommence, au maximum trois fois (tolérances de 4, 6 puis 8 km). Si aucun résultat n’est trouvé après ces trois élargissements, indique-le clairement. Consulte les meilleures fiches avec get_hike et compare leurs données. Dès que tu proposes une sortie, appelle automatiquement prepare_trail sur le choix recommandé. Indique dans la même réponse le Départ/Arrivée Visorando comme stationnement indicatif avec ses coordonnées et son lien Google Maps, les éventuels parkings OpenStreetMap, combien d’eau porter et quoi prendre comme nourriture. Affiche en Markdown les photos illustratives renvoyées, avec un lien vers leur fiche source, sans prétendre qu’elles montrent exactement le parking. Sans durée personnelle, utilise l’estimation à 6 min/km-effort et 30 à 40 g de glucides par heure. Rappelle de vérifier les conditions locales avant le départ.`,
          },
        },
      ],
    }),
  );

  server.registerPrompt(
    'prepare_a_trail',
    {
      title: 'Préparer une sortie trail complète',
      description: 'Recherche puis prépare parcours, glucides, eau, parking et transports.',
      argsSchema: {
        place: z.string().describe('Lieu souhaité'),
        distance: z.string().optional().describe('Distance cible'),
        preferences: z
          .string()
          .optional()
          .describe('Durée personnelle, météo, sudation, ravitaillements et accès souhaité'),
      },
    },
    ({ place, distance, preferences }) => ({
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: `Prépare une sortie trail autour de ${place}, ${distance ?? 'sans distance imposée'}. ${preferences ?? ''} Recherche d’abord les itinéraires, consulte les meilleures fiches, puis appelle prepare_trail sur le choix retenu. Sans durée personnelle, utilise l’estimation à 6 min/km-effort et 30 à 40 g de glucides par heure. Indique toujours le Départ/Arrivée Visorando comme stationnement indicatif avec le libellé des coordonnées et le lien Google Maps, puis les éventuels parkings OpenStreetMap. Précise aussi combien d’eau porter et quoi prendre comme nourriture, sans attendre une demande complémentaire. Affiche en Markdown les photos illustratives renvoyées et leur fiche source, sans les présenter comme une vue certaine du parking. Distingue les données de la fiche, les estimations et les informations à vérifier. Demande la durée prévue, le taux de sudation et l’eau fiable disponible seulement si leur absence empêche une recommandation utile ; sinon fournis une fourchette prudente. Termine par une checklist concise et conserve le lien Visorando source.`,
          },
        },
      ],
    }),
  );

  return server;
}
