import { describe, expectTypeOf, it } from 'vitest';
import { defineEnv } from '../src/define-env.js';

describe('TypeScript type inference', () => {
  it('correctly infers strict types for all fields', () => {
    const env = defineEnv(
      {
        REQUIRED_STRING: { type: 'string', required: true },
        OPTIONAL_STRING: { type: 'string' },
        DEFAULT_STRING: { type: 'string', default: 'hello' },

        REQUIRED_NUMBER: { type: 'number', required: true },
        OPTIONAL_NUMBER: { type: 'number' },
        DEFAULT_NUMBER: { type: 'number', default: 8080 },

        REQUIRED_BOOL: { type: 'boolean', required: true },
        OPTIONAL_BOOL: { type: 'boolean' },
        DEFAULT_BOOL: { type: 'boolean', default: false },

        REQUIRED_URL: { type: 'url', required: true },
        OPTIONAL_URL: { type: 'url' },

        ENUM_VAL: {
          type: 'enum',
          values: ['dev', 'stage', 'prod'] as const,
          required: true,
        },
        DEFAULT_ENUM: {
          type: 'enum',
          values: ['a', 'b'] as const,
          default: 'a',
        },
        OPTIONAL_ENUM: {
          type: 'enum',
          values: ['x', 'y'] as const,
        },
      },
      {
        source: {
          REQUIRED_STRING: 'val',
          REQUIRED_NUMBER: '123',
          REQUIRED_BOOL: 'true',
          REQUIRED_URL: 'https://example.com',
          ENUM_VAL: 'dev',
        },
      },
    );

    // Type assertions
    expectTypeOf(env.REQUIRED_STRING).toEqualTypeOf<string>();
    expectTypeOf(env.OPTIONAL_STRING).toEqualTypeOf<string | undefined>();
    expectTypeOf(env.DEFAULT_STRING).toEqualTypeOf<string>();

    expectTypeOf(env.REQUIRED_NUMBER).toEqualTypeOf<number>();
    expectTypeOf(env.OPTIONAL_NUMBER).toEqualTypeOf<number | undefined>();
    expectTypeOf(env.DEFAULT_NUMBER).toEqualTypeOf<number>();

    expectTypeOf(env.REQUIRED_BOOL).toEqualTypeOf<boolean>();
    expectTypeOf(env.OPTIONAL_BOOL).toEqualTypeOf<boolean | undefined>();
    expectTypeOf(env.DEFAULT_BOOL).toEqualTypeOf<boolean>();

    expectTypeOf(env.REQUIRED_URL).toEqualTypeOf<string>();
    expectTypeOf(env.OPTIONAL_URL).toEqualTypeOf<string | undefined>();

    expectTypeOf(env.ENUM_VAL).toEqualTypeOf<'dev' | 'stage' | 'prod'>();
    expectTypeOf(env.DEFAULT_ENUM).toEqualTypeOf<'a' | 'b'>();
    expectTypeOf(env.OPTIONAL_ENUM).toEqualTypeOf<'x' | 'y' | undefined>();
  });
});
