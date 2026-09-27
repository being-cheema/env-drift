import { describe, expect, it } from 'vitest';
import { formatEnvExample, parseEnvFile } from '../src/utils/env-file.js';
import type { Schema } from '../src/types.js';

describe('.env file parsing and formatting', () => {
  describe('parseEnvFile', () => {
    it('parses standard KEY=value pairs', () => {
      const content = `
PORT=3000
HOST=localhost
`;
      const result = parseEnvFile(content);
      expect(result).toEqual({
        PORT: '3000',
        HOST: 'localhost',
      });
    });

    it('ignores comments and empty lines', () => {
      const content = `
# This is a comment
PORT=8080

# Another comment
DEBUG=true
`;
      const result = parseEnvFile(content);
      expect(result).toEqual({
        PORT: '8080',
        DEBUG: 'true',
      });
    });

    it('supports export prefix', () => {
      const content = `
export PORT=4000
export DB_NAME=test
`;
      const result = parseEnvFile(content);
      expect(result).toEqual({
        PORT: '4000',
        DB_NAME: 'test',
      });
    });

    it('handles quoted values correctly', () => {
      const content = `
DOUBLE="hello world"
SINGLE='single quoted'
ESCAPED="line1\\nline2"
`;
      const result = parseEnvFile(content);
      expect(result.DOUBLE).toBe('hello world');
      expect(result.SINGLE).toBe('single quoted');
      expect(result.ESCAPED).toBe('line1\nline2');
    });

    it('strips inline comments from unquoted values', () => {
      const content = `
PORT=3000 # Server port
SECRET=my_key   # Secret token
`;
      const result = parseEnvFile(content);
      expect(result.PORT).toBe('3000');
      expect(result.SECRET).toBe('my_key');
    });
  });

  describe('formatEnvExample', () => {
    it('generates .env.example with field descriptions and defaults', () => {
      const schema: Schema = {
        PORT: {
          type: 'number',
          default: 3000,
          description: 'Server listening port',
        },
        DATABASE_URL: {
          type: 'url',
          required: true,
          description: 'PostgreSQL connection string',
        },
        NODE_ENV: {
          type: 'enum',
          values: ['development', 'production', 'test'],
          default: 'development',
          description: 'Environment mode',
        },
      };

      const output = formatEnvExample(schema);

      expect(output).toContain('# Server listening port\nPORT=3000');
      expect(output).toContain('# PostgreSQL connection string\nDATABASE_URL=');
      expect(output).toContain(
        '# Environment mode\n# Allowed: development, production, test\nNODE_ENV=development',
      );
    });

    it('handles fields without descriptions', () => {
      const schema: Schema = {
        API_KEY: {
          type: 'string',
          required: true,
        },
      };

      const output = formatEnvExample(schema);
      expect(output.trim()).toBe('API_KEY=');
    });
  });
});
