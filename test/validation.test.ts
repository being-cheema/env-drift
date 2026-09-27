import { describe, expect, it } from 'vitest';
import { defineEnv } from '../src/define-env.js';
import { EnvValidationError } from '../src/errors.js';

describe('Field validation and coercion', () => {
  describe('string', () => {
    it('validates and preserves valid string values', () => {
      const env = defineEnv(
        {
          APP_NAME: { type: 'string', required: true },
        },
        { source: { APP_NAME: 'MyApp' } },
      );

      expect(env.APP_NAME).toBe('MyApp');
    });

    it('trims string values', () => {
      const env = defineEnv(
        {
          APP_NAME: { type: 'string', required: true },
        },
        { source: { APP_NAME: '   MyApp   ' } },
      );

      expect(env.APP_NAME).toBe('MyApp');
    });

    it('fails when required string is missing or undefined', () => {
      expect(() => {
        defineEnv(
          {
            APP_NAME: { type: 'string', required: true },
          },
          { source: {} },
        );
      }).toThrowError(EnvValidationError);
    });

    it('fails when required string is empty string or whitespace', () => {
      expect(() => {
        defineEnv(
          {
            APP_NAME: { type: 'string', required: true },
          },
          { source: { APP_NAME: '' } },
        );
      }).toThrow('APP_NAME: required but not set');

      expect(() => {
        defineEnv(
          {
            APP_NAME: { type: 'string', required: true },
          },
          { source: { APP_NAME: '   ' } },
        );
      }).toThrow('APP_NAME: required but not set');
    });

    it('allows empty string when allowEmpty is true', () => {
      const env = defineEnv(
        {
          OPTIONAL_PREFIX: { type: 'string', allowEmpty: true },
        },
        { source: { OPTIONAL_PREFIX: '' } },
      );

      expect(env.OPTIONAL_PREFIX).toBe('');
    });

    it('applies default value when string is not provided', () => {
      const env = defineEnv(
        {
          HOST: { type: 'string', default: 'localhost' },
        },
        { source: {} },
      );

      expect(env.HOST).toBe('localhost');
    });

    it('returns undefined when optional string without default is omitted', () => {
      const env = defineEnv(
        {
          OPTIONAL_KEY: { type: 'string' },
        },
        { source: {} },
      );

      expect(env.OPTIONAL_KEY).toBeUndefined();
    });
  });

  describe('number', () => {
    it('coerces valid numeric strings to numbers', () => {
      const env = defineEnv(
        {
          PORT: { type: 'number', required: true },
          FLOAT_VAL: { type: 'number', required: true },
          NEG_VAL: { type: 'number', required: true },
        },
        {
          source: {
            PORT: '3000',
            FLOAT_VAL: '3.14',
            NEG_VAL: '-42',
          },
        },
      );

      expect(env.PORT).toBe(3000);
      expect(env.FLOAT_VAL).toBe(3.14);
      expect(env.NEG_VAL).toBe(-42);
    });

    it('handles numeric strings with surrounding whitespace', () => {
      const env = defineEnv(
        {
          PORT: { type: 'number', required: true },
        },
        { source: { PORT: '  8080  ' } },
      );

      expect(env.PORT).toBe(8080);
    });

    it('fails when number string is invalid', () => {
      expect(() => {
        defineEnv(
          {
            PORT: { type: 'number', required: true },
          },
          { source: { PORT: 'abc' } },
        );
      }).toThrow("PORT: expected number, got 'abc'");
    });

    it('fails when required number is missing', () => {
      expect(() => {
        defineEnv(
          {
            PORT: { type: 'number', required: true },
          },
          { source: {} },
        );
      }).toThrow('PORT: required but not set');
    });

    it('applies default number when omitted', () => {
      const env = defineEnv(
        {
          PORT: { type: 'number', default: 3000 },
        },
        { source: {} },
      );

      expect(env.PORT).toBe(3000);
    });

    it('returns undefined when optional number without default is omitted', () => {
      const env = defineEnv(
        {
          TIMEOUT: { type: 'number' },
        },
        { source: {} },
      );

      expect(env.TIMEOUT).toBeUndefined();
    });
  });

  describe('boolean', () => {
    it('coerces truthy boolean strings to true', () => {
      const env = defineEnv(
        {
          A: { type: 'boolean', required: true },
          B: { type: 'boolean', required: true },
          C: { type: 'boolean', required: true },
          D: { type: 'boolean', required: true },
        },
        {
          source: {
            A: 'true',
            B: 'TRUE',
            C: '1',
            D: 'yes',
          },
        },
      );

      expect(env.A).toBe(true);
      expect(env.B).toBe(true);
      expect(env.C).toBe(true);
      expect(env.D).toBe(true);
    });

    it('coerces falsy boolean strings to false', () => {
      const env = defineEnv(
        {
          A: { type: 'boolean', required: true },
          B: { type: 'boolean', required: true },
          C: { type: 'boolean', required: true },
          D: { type: 'boolean', required: true },
        },
        {
          source: {
            A: 'false',
            B: 'FALSE',
            C: '0',
            D: 'no',
          },
        },
      );

      expect(env.A).toBe(false);
      expect(env.B).toBe(false);
      expect(env.C).toBe(false);
      expect(env.D).toBe(false);
    });

    it('fails when boolean string is invalid', () => {
      expect(() => {
        defineEnv(
          {
            DEBUG: { type: 'boolean', required: true },
          },
          { source: { DEBUG: 'not-a-boolean' } },
        );
      }).toThrow("DEBUG: expected boolean, got 'not-a-boolean'");
    });

    it('applies default boolean when omitted', () => {
      const env = defineEnv(
        {
          DEBUG: { type: 'boolean', default: false },
          ENABLED: { type: 'boolean', default: true },
        },
        { source: {} },
      );

      expect(env.DEBUG).toBe(false);
      expect(env.ENABLED).toBe(true);
    });
  });

  describe('url', () => {
    it('validates valid URLs', () => {
      const env = defineEnv(
        {
          API_URL: { type: 'url', required: true },
          DATABASE_URL: { type: 'url', required: true },
        },
        {
          source: {
            API_URL: 'https://api.example.com/v1',
            DATABASE_URL: 'postgres://user:secret@localhost:5432/mydb',
          },
        },
      );

      expect(env.API_URL).toBe('https://api.example.com/v1');
      expect(env.DATABASE_URL).toBe('postgres://user:secret@localhost:5432/mydb');
    });

    it('fails when URL is malformed', () => {
      expect(() => {
        defineEnv(
          {
            DATABASE_URL: { type: 'url', required: true },
          },
          { source: { DATABASE_URL: 'not-a-url' } },
        );
      }).toThrow("DATABASE_URL: expected valid URL, got 'not-a-url'");
    });

    it('fails when required URL is missing', () => {
      expect(() => {
        defineEnv(
          {
            DATABASE_URL: { type: 'url', required: true },
          },
          { source: {} },
        );
      }).toThrow('DATABASE_URL: required but not set');
    });

    it('applies default URL when omitted', () => {
      const env = defineEnv(
        {
          SERVICE_URL: { type: 'url', default: 'http://localhost:8080' },
        },
        { source: {} },
      );

      expect(env.SERVICE_URL).toBe('http://localhost:8080');
    });
  });

  describe('enum', () => {
    it('validates allowed enum values', () => {
      const env = defineEnv(
        {
          NODE_ENV: {
            type: 'enum',
            values: ['development', 'staging', 'production'] as const,
            required: true,
          },
        },
        { source: { NODE_ENV: 'production' } },
      );

      expect(env.NODE_ENV).toBe('production');
    });

    it('fails when enum value is not allowed', () => {
      expect(() => {
        defineEnv(
          {
            NODE_ENV: {
              type: 'enum',
              values: ['development', 'production'] as const,
              required: true,
            },
          },
          { source: { NODE_ENV: 'test' } },
        );
      }).toThrow("NODE_ENV: expected one of ['development', 'production'], got 'test'");
    });

    it('applies default enum value when omitted', () => {
      const env = defineEnv(
        {
          NODE_ENV: {
            type: 'enum',
            values: ['development', 'production'] as const,
            default: 'development',
          },
        },
        { source: {} },
      );

      expect(env.NODE_ENV).toBe('development');
    });
  });

  describe('fluent helper functions', () => {
    it('supports defineEnv.string, defineEnv.number, etc.', () => {
      const env = defineEnv(
        {
          PORT: defineEnv.number({ default: 3000 }),
          NAME: defineEnv.string({ required: true }),
          DEBUG: defineEnv.boolean({ default: false }),
          SITE_URL: defineEnv.url({ default: 'https://example.com' }),
          ENV: defineEnv.enum(['dev', 'prod'] as const, { default: 'dev' }),
        },
        {
          source: { NAME: 'EnvDrift' },
        },
      );

      expect(env.PORT).toBe(3000);
      expect(env.NAME).toBe('EnvDrift');
      expect(env.DEBUG).toBe(false);
      expect(env.SITE_URL).toBe('https://example.com');
      expect(env.ENV).toBe('dev');
    });
  });
});
