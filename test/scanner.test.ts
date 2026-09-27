import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { scanSourceTree } from '../src/utils/scanner.js';

describe('Source code scanner', () => {
  it('detects process.env.X references across source files', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'keysmith-scanner-test-'));

    try {
      const srcDir = path.join(tempDir, 'src');
      fs.mkdirSync(srcDir, { recursive: true });

      // Create a test source file with various process.env references
      fs.writeFileSync(
        path.join(srcDir, 'index.ts'),
        `
// Single-line comment: process.env.IGNORED_IN_COMMENT
const port = process.env.PORT || 3000;
const dbUrl = process.env['DATABASE_URL'];
const redisUrl = process.env["REDIS_URL"];
const { API_KEY, JWT_SECRET: secret } = process.env;
`,
        'utf-8',
      );

      const refs = scanSourceTree({ cwd: tempDir });
      const refKeys = refs.map((r) => r.key);

      expect(refKeys).toContain('PORT');
      expect(refKeys).toContain('DATABASE_URL');
      expect(refKeys).toContain('REDIS_URL');
      expect(refKeys).toContain('API_KEY');
      expect(refKeys).toContain('JWT_SECRET');
      expect(refKeys).not.toContain('IGNORED_IN_COMMENT');

      const portRef = refs.find((r) => r.key === 'PORT');
      expect(portRef?.locations[0]?.line).toBe(3);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('excludes node_modules and dist by default', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'keysmith-scanner-exclude-'));

    try {
      const nodeModulesDir = path.join(tempDir, 'node_modules', 'some-pkg');
      const distDir = path.join(tempDir, 'dist');
      fs.mkdirSync(nodeModulesDir, { recursive: true });
      fs.mkdirSync(distDir, { recursive: true });

      fs.writeFileSync(
        path.join(nodeModulesDir, 'index.js'),
        'console.log(process.env.DEPENDENCY_VAR);',
        'utf-8',
      );
      fs.writeFileSync(
        path.join(distDir, 'bundle.js'),
        'console.log(process.env.DIST_VAR);',
        'utf-8',
      );

      const refs = scanSourceTree({ cwd: tempDir });
      const refKeys = refs.map((r) => r.key);

      expect(refKeys).not.toContain('DEPENDENCY_VAR');
      expect(refKeys).not.toContain('DIST_VAR');
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
