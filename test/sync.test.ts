import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { runSync } from '../src/commands/sync.js';

describe('CLI command: env-drift sync', () => {
  it('correctly regenerates .env.example with descriptions and defaults', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'env-drift-sync-test-'));

    try {
      fs.writeFileSync(
        path.join(tempDir, 'env.schema.ts'),
        `
export const schema = {
  PORT: { type: 'number', default: 3000, description: 'Application port' },
  DATABASE_URL: { type: 'url', required: true, description: 'Database connection string' },
  NODE_ENV: {
    type: 'enum',
    values: ['development', 'production', 'test'],
    default: 'development',
    description: 'Environment mode',
  },
};
`,
        'utf-8',
      );

      // Create an existing .env that should NEVER be touched
      const envPath = path.join(tempDir, '.env');
      const originalEnvContent = 'PORT=9999\nDATABASE_URL=postgres://real:secret@db/prod\n';
      fs.writeFileSync(envPath, originalEnvContent, 'utf-8');

      const result = await runSync({ cwd: tempDir });

      expect(result.written).toBe(true);
      expect(result.hasChanges).toBe(true);

      const examplePath = path.join(tempDir, '.env.example');
      expect(fs.existsSync(examplePath)).toBe(true);

      const generated = fs.readFileSync(examplePath, 'utf-8');
      expect(generated).toContain('# Application port\nPORT=3000');
      expect(generated).toContain('# Database connection string\nDATABASE_URL=');
      expect(generated).toContain(
        '# Environment mode\n# Allowed: development, production, test\nNODE_ENV=development',
      );

      // Verify .env was NEVER touched
      const envAfter = fs.readFileSync(envPath, 'utf-8');
      expect(envAfter).toBe(originalEnvContent);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('correctly no-ops and prints diff with --dry-run without modifying files', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'env-drift-dryrun-test-'));

    try {
      fs.writeFileSync(
        path.join(tempDir, 'env.schema.ts'),
        `
export const schema = {
  PORT: { type: 'number', default: 3000, description: 'Port' },
};
`,
        'utf-8',
      );

      const examplePath = path.join(tempDir, '.env.example');
      const originalExampleContent = 'PORT=8080\n';
      fs.writeFileSync(examplePath, originalExampleContent, 'utf-8');

      const result = await runSync({ cwd: tempDir, dryRun: true });

      expect(result.written).toBe(false);
      expect(result.hasChanges).toBe(true);
      expect(result.output).toContain('dry-run');
      expect(result.output).toContain('--- .env.example');
      expect(result.output).toContain('+++ .env.example');

      // Crucial: File on disk was NOT modified
      const currentContent = fs.readFileSync(examplePath, 'utf-8');
      expect(currentContent).toBe(originalExampleContent);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('reports no changes when .env.example is already up to date', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'env-drift-uptodate-test-'));

    try {
      fs.writeFileSync(
        path.join(tempDir, 'env.schema.ts'),
        `
export const schema = {
  PORT: { type: 'number', default: 3000, description: 'Port' },
};
`,
        'utf-8',
      );

      // First sync writes the file
      await runSync({ cwd: tempDir });

      // Second sync should detect no changes
      const secondResult = await runSync({ cwd: tempDir });
      expect(secondResult.written).toBe(false);
      expect(secondResult.hasChanges).toBe(false);
      expect(secondResult.output).toContain('already up to date');
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
