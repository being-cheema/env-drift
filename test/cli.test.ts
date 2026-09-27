import { execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const CLI_PATH = path.resolve(__dirname, '../dist/cli.js');

describe('CLI executable end-to-end', () => {
  it('displays help when invoked with --help', () => {
    const stdout = execSync(`node "${CLI_PATH}" --help`, { encoding: 'utf-8' });
    expect(stdout).toContain('env-drift - Schema-driven environment variable validator');
    expect(stdout).toContain('COMMANDS');
    expect(stdout).toContain('check');
    expect(stdout).toContain('sync');
  });

  it('displays version with --version', () => {
    const stdout = execSync(`node "${CLI_PATH}" --version`, { encoding: 'utf-8' });
    expect(stdout.trim()).toBe('env-drift v0.1.0');
  });

  it('exits with code 0 on check when project is clean', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'env-drift-cli-clean-'));

    try {
      fs.writeFileSync(
        path.join(tempDir, 'env.schema.ts'),
        `export const schema = { PORT: { type: 'number', default: 3000 } };`,
      );
      fs.writeFileSync(path.join(tempDir, '.env'), 'PORT=3000\n');
      fs.writeFileSync(path.join(tempDir, '.env.example'), 'PORT=3000\n');

      const stdout = execSync(`node "${CLI_PATH}" check --ci`, {
        cwd: tempDir,
        encoding: 'utf-8',
      });

      expect(stdout).toContain('[OK]');
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('exits with code 1 on check when drift is detected', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'env-drift-cli-drift-'));

    try {
      fs.writeFileSync(
        path.join(tempDir, 'env.schema.ts'),
        `export const schema = { SECRET: { type: 'string', required: true } };`,
      );
      fs.writeFileSync(path.join(tempDir, '.env.example'), '');
      fs.writeFileSync(path.join(tempDir, '.env'), '');

      let errorExitCode: number | null = null;
      let output = '';

      try {
        execSync(`node "${CLI_PATH}" check --ci`, {
          cwd: tempDir,
          encoding: 'utf-8',
          stdio: 'pipe',
        });
      } catch (err: any) {
        errorExitCode = err.status;
        output = err.stdout?.toString() || '';
      }

      expect(errorExitCode).toBe(1);
      expect(output).toContain('[DRIFT]');
      expect(output).toContain('SECRET');
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('synchronizes .env.example using cli sync command', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'env-drift-cli-sync-'));

    try {
      fs.writeFileSync(
        path.join(tempDir, 'env.schema.ts'),
        `export const schema = { API_KEY: { type: 'string', description: 'Secret API key' } };`,
      );

      const stdout = execSync(`node "${CLI_PATH}" sync --ci`, {
        cwd: tempDir,
        encoding: 'utf-8',
      });

      expect(stdout).toContain('Successfully synchronized');

      const generated = fs.readFileSync(path.join(tempDir, '.env.example'), 'utf-8');
      expect(generated).toContain('# Secret API key\nAPI_KEY=');
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
