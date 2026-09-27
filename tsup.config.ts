import { defineConfig } from 'tsup';

export default defineConfig([
  // Main library bundle (ESM + CJS)
  {
    entry: ['src/index.ts'],
    format: ['esm', 'cjs'],
    dts: true,
    clean: true,
    sourcemap: true,
    treeshake: true,
    splitting: false,
    outDir: 'dist',
  },
  // CLI executable bundle (ESM + CJS)
  {
    entry: ['src/cli.ts'],
    format: ['esm', 'cjs'],
    dts: false,
    clean: false,
    sourcemap: true,
    banner: {
      js: '#!/usr/bin/env node',
    },
    onSuccess: 'chmod +x dist/cli.js dist/cli.cjs',
    outDir: 'dist',
  },
]);
