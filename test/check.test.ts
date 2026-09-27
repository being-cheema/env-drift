import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { runCheck } from '../src/commands/check.js';

describe('CLI command: env-drift check', () => {
  it('detects all 3 drift categories in a project with drift', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'env-drift-check-test-'));

    try {
      // 1. Create schema with 3 vars: PORT, DATABASE_URL, REDIS_URL
      fs.writeFileSync(
        path.join(tempDir, 'env.schema.ts'),
        `
export const schema = {
  PORT: { type: 'number', default: 3000, description: 'Application port' },
  DATABASE_URL: { type: 'url', required: true, description: 'Database connection URL' },
  REDIS_URL: { type: 'url', required: true, description: 'Redis cache URL' },
};
`,
        'utf-8',
      );

      // 2. Create .env with only PORT and DATABASE_URL (missing REDIS_URL)
      fs.writeFileSync(
        path.join(tempDir, '.env'),
        `
PORT=3000
DATABASE_URL=postgres://localhost:5432/app
`,
        'utf-8',
      );

      // 3. Create .env.example with PORT, DATABASE_URL, and an extra OLD_DEPRECATED_VAR (missing REDIS_URL)
      fs.writeFileSync(
        path.join(tempDir, '.env.example'),
        `
PORT=3000
DATABASE_URL=
OLD_DEPRECATED_VAR=legacy
`,
        'utf-8',
      );

      // 4. Create source file referencing UNDECLARED_SECRET
      const srcDir = path.join(tempDir, 'src');
      fs.mkdirSync(srcDir, { recursive: true });
      fs.writeFileSync(
        path.join(srcDir, 'server.ts'),
        `
const port = process.env.PORT || 3000;
const secret = process.env.UNDECLARED_SECRET;
`,
        'utf-8',
      );

      // Run check
      const result = await runCheck({ cwd: tempDir });

      expect(result.isClean).toBe(false);

      // Category A: declared in schema but missing from .env / .env.example
      const missingFromEnvKeys = result.report.missingFromEnv.map((m) => m.key);
      expect(missingFromEnvKeys).toContain('REDIS_URL');

      const missingFromExampleKeys = result.report.missingFromExample.map((m) => m.key);
      expect(missingFromExampleKeys).toContain('REDIS_URL');

      // Category B: present in .env.example but not declared in schema
      expect(result.report.extraInExample).toContain('OLD_DEPRECATED_VAR');

      // Category C: referenced in code via process.env.X but not declared in schema
      const undeclaredInCodeKeys = result.report.undeclaredInCode.map((u) => u.key);
      expect(undeclaredInCodeKeys).toContain('UNDECLARED_SECRET');
      expect(undeclaredInCodeKeys).not.toContain('PORT'); // PORT is declared in schema

      // Output formatting contains drift notices
      expect(result.output).toContain('REDIS_URL');
      expect(result.output).toContain('OLD_DEPRECATED_VAR');
      expect(result.output).toContain('UNDECLARED_SECRET');
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('passes cleanly when schema, .env, .env.example, and source code are in sync', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'env-drift-clean-test-'));

    try {
      fs.writeFileSync(
        path.join(tempDir, 'env.schema.ts'),
        `
export const schema = {
  PORT: { type: 'number', default: 3000, description: 'Port' },
  DATABASE_URL: { type: 'url', required: true, description: 'Database URL' },
};
`,
        'utf-8',
      );

      fs.writeFileSync(
        path.join(tempDir, '.env'),
        `
PORT=3000
DATABASE_URL=postgres://localhost:5432/app
`,
        'utf-8',
      );

      fs.writeFileSync(
        path.join(tempDir, '.env.example'),
        `
# Port
PORT=3000

# Database URL
DATABASE_URL=
`,
        'utf-8',
      );

      const srcDir = path.join(tempDir, 'src');
      fs.mkdirSync(srcDir, { recursive: true });
      fs.writeFileSync(
        path.join(srcDir, 'index.ts'),
        `
const port = process.env.PORT;
const db = process.env.DATABASE_URL;
`,
        'utf-8',
      );

      const result = await runCheck({ cwd: tempDir });

      expect(result.isClean).toBe(true);
      expect(result.report.totalIssues).toBe(0);
      expect(result.output).toContain('No environment drift detected');
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('formats plain text output when ci option is enabled', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'env-drift-ci-test-'));

    try {
      fs.writeFileSync(
        path.join(tempDir, 'env.schema.ts'),
        `
export const schema = {
  PORT: { type: 'number', default: 3000 },
};
`,
        'utf-8',
      );

      fs.writeFileSync(path.join(tempDir, '.env.example'), 'PORT=3000\n', 'utf-8');
      fs.writeFileSync(path.join(tempDir, '.env'), 'PORT=3000\n', 'utf-8');

      const result = await runCheck({ cwd: tempDir, ci: true });
      expect(result.isClean).toBe(true);
      expect(result.output).toContain('[OK]');
      // Ensure no ANSI escape sequences
      expect(result.output).not.toContain('\x1b[');
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
