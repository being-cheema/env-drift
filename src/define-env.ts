import { EnvValidationError } from './errors.js';
import type {
  BooleanFieldDef,
  DefineEnvOptions,
  EnumFieldDef,
  InferEnv,
  NumberFieldDef,
  Schema,
  StringFieldDef,
  UrlFieldDef,
  ValidationErrorIssue,
} from './types.js';
import { validateAndCoerceField } from './validators.js';

export const SCHEMA_SYMBOL = Symbol.for('keysmith.schema');
const LEGACY_SCHEMA_SYMBOL = Symbol.for('env-drift.schema');

/**
 * Extracts the schema definition from an env object returned by defineEnv,
 * or returns the object directly if it is already a Schema.
 */
export function getSchema(target: unknown): Schema | undefined {
  if (!target || typeof target !== 'object') {
    return undefined;
  }

  // If created via defineEnv, schema is stored under SCHEMA_SYMBOL
  if (SCHEMA_SYMBOL in target) {
    return (target as any)[SCHEMA_SYMBOL];
  }
  if (LEGACY_SCHEMA_SYMBOL in target) {
    return (target as any)[LEGACY_SCHEMA_SYMBOL];
  }

  // Check if target is a raw Schema object (keys with { type: ... })
  const entries = Object.entries(target);
  if (
    entries.length > 0 &&
    entries.every(
      ([, val]) =>
        val &&
        typeof val === 'object' &&
        'type' in val &&
        ['string', 'number', 'boolean', 'url', 'enum'].includes((val as any).type),
    )
  ) {
    return target as Schema;
  }

  return undefined;
}

/**
 * Validates environment variables against a typed schema.
 * Coerces types and throws an aggregated EnvValidationError if any issues are detected.
 */
function defineEnvImpl<S extends Schema>(schema: S, options: DefineEnvOptions = {}): InferEnv<S> {
  const source = options.source ?? process.env;
  const skipValidation =
    options.skipValidation ??
    (process.env.KEYSMITH_CLI === '1' || process.env.ENV_DRIFT_CLI === '1');

  const result: Record<string, any> = {};
  const issues: ValidationErrorIssue[] = [];

  for (const [key, fieldDef] of Object.entries(schema)) {
    if (skipValidation) {
      // In skipValidation mode (e.g. CLI schema inspection), return default or undefined
      result[key] = fieldDef.default ?? source[key];
      continue;
    }

    const rawVal = source[key];
    const validationResult = validateAndCoerceField(key, rawVal, fieldDef);

    if (validationResult.issue) {
      issues.push(validationResult.issue);
    } else {
      result[key] = validationResult.value;
    }
  }

  if (issues.length > 0) {
    throw new EnvValidationError(issues);
  }

  // Attach non-enumerable schema metadata
  Object.defineProperty(result, SCHEMA_SYMBOL, {
    value: schema,
    enumerable: false,
    writable: false,
    configurable: true,
  });

  return result as InferEnv<S>;
}

// Fluent helper builders for cleaner schema definitions
defineEnvImpl.string = (def: Omit<StringFieldDef, 'type'> = {}): StringFieldDef => ({
  type: 'string',
  ...def,
});

defineEnvImpl.number = (def: Omit<NumberFieldDef, 'type'> = {}): NumberFieldDef => ({
  type: 'number',
  ...def,
});

defineEnvImpl.boolean = (def: Omit<BooleanFieldDef, 'type'> = {}): BooleanFieldDef => ({
  type: 'boolean',
  ...def,
});

defineEnvImpl.url = (def: Omit<UrlFieldDef, 'type'> = {}): UrlFieldDef => ({
  type: 'url',
  ...def,
});

defineEnvImpl.enum = <T extends string>(
  values: readonly T[],
  def: Omit<EnumFieldDef<T>, 'type' | 'values'> = {},
): EnumFieldDef<T> => ({
  type: 'enum',
  values,
  ...def,
});

export const defineEnv = defineEnvImpl as typeof defineEnvImpl & {
  string: typeof defineEnvImpl.string;
  number: typeof defineEnvImpl.number;
  boolean: typeof defineEnvImpl.boolean;
  url: typeof defineEnvImpl.url;
  enum: typeof defineEnvImpl.enum;
};
