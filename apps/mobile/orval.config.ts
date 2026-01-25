import { defineConfig } from 'orval';

export default defineConfig({
  trainerApp: {
    input: {
      target: '../../docs/openapi.json',
    },
    output: {
      client: 'fetch',
      mode: 'single',
      target: './src/generated/api.ts',
      override: {
        mutator: {
          path: './src/api/custom-fetch.ts',
          name: 'customFetch',
        },
      },
    },
  },
});
