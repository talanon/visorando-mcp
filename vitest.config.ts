import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      include: ['src/{access,client,parser,planner,server}.ts'],
      reporter: ['text', 'json-summary'],
      thresholds: {
        statements: 95,
        branches: 90,
        functions: 100,
        lines: 95,
      },
    },
  },
});
