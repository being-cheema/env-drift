import { describe, expect, it } from 'vitest';
import { defineEnv } from '../src/define-env.js';
import { EnvValidationError } from '../src/errors.js';

describe('Aggregated error messages', () => {
  it('aggregates multiple validation problems into ONE clear error', () => {
    let thrownError: any = null;

    try {
      defineEnv(
        {
          DATABASE_URL: { type: 'url', required: true },
          PORT: { type: 'number', required: true },
          NODE_ENV: {
            type: 'enum',
            values: ['development', 'production'] as const,
            required: true,
          },
          ENABLED: { type: 'boolean', required: true },
        },
        {
          source: {
            PORT: 'abc',
            NODE_ENV: 'staging',
            ENABLED: 'invalid-bool',
          },
        },
      );
    } catch (err) {
      thrownError = err;
    }

    expect(thrownError).toBeInstanceOf(EnvValidationError);
    expect(thrownError.name).toBe('EnvValidationError');

    // Matches the required aggregated error structure
    const expectedMessage = [
      'Environment validation failed:',
      '  - DATABASE_URL: required but not set',
      "  - PORT: expected number, got 'abc'",
      "  - NODE_ENV: expected one of ['development', 'production'], got 'staging'",
      "  - ENABLED: expected boolean, got 'invalid-bool'",
    ].join('\n');

    expect(thrownError.message).toBe(expectedMessage);
    expect(thrownError.issues).toHaveLength(4);
    expect(thrownError.issues[0]).toEqual({
      key: 'DATABASE_URL',
      message: 'required but not set',
      received: undefined,
    });
    expect(thrownError.issues[1]).toEqual({
      key: 'PORT',
      message: "expected number, got 'abc'",
      received: 'abc',
    });
  });

  it('contains structured issues property on the error object', () => {
    try {
      defineEnv(
        {
          API_KEY: { type: 'string', required: true },
        },
        { source: {} },
      );
    } catch (err: any) {
      expect(err).toBeInstanceOf(EnvValidationError);
      expect(err.issues).toBeDefined();
      expect(err.issues[0].key).toBe('API_KEY');
      expect(err.issues[0].message).toBe('required but not set');
    }
  });
});
