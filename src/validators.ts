import type { FieldDef, ValidationErrorIssue } from './types.js';

export interface ValidationSuccess {
  value: any;
  issue?: undefined;
}

export interface ValidationFailure {
  value?: undefined;
  issue: ValidationErrorIssue;
}

export type ValidationResult = ValidationSuccess | ValidationFailure;

/**
 * Validates and coerces a single environment variable according to its field definition.
 */
export function validateAndCoerceField(
  key: string,
  rawVal: string | undefined,
  def: FieldDef,
): ValidationResult {
  const isUndefined = rawVal === undefined;
  const isWhitespaceOnly = typeof rawVal === 'string' && rawVal.trim() === '';

  // Determine if the value should be treated as "empty / unset"
  let isEmpty = isUndefined;
  if (!isUndefined && typeof rawVal === 'string') {
    if (def.type === 'string' && def.allowEmpty) {
      isEmpty = false;
    } else if (isWhitespaceOnly) {
      isEmpty = true;
    }
  }

  // Handle empty / unset values
  if (isEmpty) {
    if (def.default !== undefined) {
      return { value: def.default };
    }
    if (def.required) {
      return {
        issue: {
          key,
          message: 'required but not set',
          received: rawVal,
        },
      };
    }
    return { value: undefined };
  }

  // Value is present; validate and coerce based on type
  const val = rawVal as string;

  switch (def.type) {
    case 'string': {
      const result = def.allowEmpty ? val : val.trim();
      return { value: result };
    }

    case 'number': {
      const trimmed = val.trim();
      const num = Number(trimmed);
      if (trimmed === '' || Number.isNaN(num) || !Number.isFinite(num)) {
        return {
          issue: {
            key,
            message: `expected number, got '${val}'`,
            received: val,
          },
        };
      }
      return { value: num };
    }

    case 'boolean': {
      const trimmed = val.trim().toLowerCase();
      if (trimmed === 'true' || trimmed === '1' || trimmed === 'yes') {
        return { value: true };
      }
      if (trimmed === 'false' || trimmed === '0' || trimmed === 'no') {
        return { value: false };
      }
      return {
        issue: {
          key,
          message: `expected boolean, got '${val}'`,
          received: val,
        },
      };
    }

    case 'url': {
      const trimmed = val.trim();
      try {
        const parsed = new URL(trimmed);
        if (!parsed.protocol) {
          throw new Error('Missing protocol');
        }
        return { value: trimmed };
      } catch {
        return {
          issue: {
            key,
            message: `expected valid URL, got '${val}'`,
            received: val,
          },
        };
      }
    }

    case 'enum': {
      const trimmed = val.trim();
      if (def.values.includes(trimmed as any)) {
        return { value: trimmed };
      }
      const allowed = def.values.map((v) => `'${String(v)}'`).join(', ');
      return {
        issue: {
          key,
          message: `expected one of [${allowed}], got '${val}'`,
          received: val,
        },
      };
    }

    default: {
      const exhaustiveCheck: never = def;
      throw new Error(`Unsupported field type: ${(exhaustiveCheck as any)?.type}`);
    }
  }
}
