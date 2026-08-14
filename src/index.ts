#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createServer } from './server.js';

const server = createServer();
const transport = new StdioServerTransport();

try {
  await server.connect(transport);
} catch (error) {
  console.error('Impossible de démarrer visorando-mcp:', error);
  process.exitCode = 1;
}
