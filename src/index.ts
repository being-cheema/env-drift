export { defineEnv, getSchema, SCHEMA_SYMBOL } from './define-env.js';
export { EnvValidationError } from './errors.js';
export { runCheck, type CheckOptions, type CheckResult } from './commands/check.js';
export { runSync, type SyncOptions, type SyncResult } from './commands/sync.js';
export { parseEnvFile, readEnvFile, formatEnvExample } from './utils/env-file.js';
export { scanSourceTree, type ScanOptions } from './utils/scanner.js';
export { loadSchema, resolveSchemaPath } from './utils/schema-loader.js';
export { createColors, colors } from './utils/colors.js';
export { computeDiff } from './utils/diff.js';

export type {
  FieldType,
  BaseFieldDef,
  StringFieldDef,
  NumberFieldDef,
  BooleanFieldDef,
  UrlFieldDef,
  EnumFieldDef,
  FieldDef,
  Schema,
  InferFieldType,
  InferField,
  InferEnv,
  DefineEnvOptions,
  ValidationErrorIssue,
  CodeReferenceLocation,
  UndeclaredVariableReference,
  DriftReport,
} from './types.js';
