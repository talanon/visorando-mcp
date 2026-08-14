import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { VisorandoClient } from './client.js';

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

export function createServer(client = new VisorandoClient()): McpServer {
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
        'Trouve et classe des randonnées autour d’un lieu selon une distance cible. Exemple : « trouve une randonnée de 10 km autour de Guebwiller » devient location="Guebwiller", targetDistanceKm=10.',
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
            text: `Recherche des randonnées Visorando autour de ${place}. ${preferences ?? ''} Utilise find_hikes dès qu’une distance est demandée ; sinon utilise search_hikes. Consulte les meilleures fiches avec get_hike, compare leurs données et rappelle de vérifier les conditions locales avant le départ.`,
          },
        },
      ],
    }),
  );

  return server;
}
