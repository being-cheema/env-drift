/**
 * Supported field types in env-drift.
 */
export type FieldType = 'string' | 'number' | 'boolean' | 'url' | 'enum';

/**
 * Base configuration common to all field definitions.
 */
export interface BaseFieldDef<T> {
  /**
   * Human-readable description of the environment variable.
   * Used to generate descriptive comments in `.env.example`.
   */
  description?: string;

  /**
   * Whether this environment variable must be provided.
   * If true and neither an environment value nor a default is provided, validation fails.
   */
  required?: boolean;

  /**
   * Default fallback value to use if the environment variable is not set.
   * Providing a default implicitly makes the field optional in the environment.
   */
  default?: T;

  /**
   * Optional placeholder or example value to use in generated `.env.example`
   * when no default value is defined.
   */
  example?: string;
}

/**
 * Schema definition for string environment variables.
 */
export interface StringFieldDef extends BaseFieldDef<string> {
  type: 'string';

  /**
   * Whether to allow empty string values ("" or whitespace only).
   * Default is false: empty or whitespace-only strings are treated as unset.
   */
  allowEmpty?: boolean;
}

/**
 * Schema definition for numeric environment variables.
 * Strings in process.env are parsed as numbers.
 */
export interface NumberFieldDef extends BaseFieldDef<number> {
  type: 'number';
}

/**
 * Schema definition for boolean environment variables.
 * Values like "true", "1", "yes" become true; "false", "0", "no" become false.
 */
export interface BooleanFieldDef extends BaseFieldDef<boolean> {
  type: 'boolean';
}

/**
 * Schema definition for valid URL environment variables.
 * Validates that the value is a valid URL parseable by URL().
 */
export interface UrlFieldDef extends BaseFieldDef<string> {
  type: 'url';
}

/**
 * Schema definition for enum environment variables with a fixed set of allowed values.
 */
export interface EnumFieldDef<T extends string = string> extends BaseFieldDef<T> {
  type: 'enum';

  /**
   * The list of permitted string values.
   */
  values: readonly T[];
}

/**
 * Discriminated union of all supported schema field definitions.
 */
export type FieldDef =
  StringFieldDef | NumberFieldDef | BooleanFieldDef | UrlFieldDef | EnumFieldDef<any>;

/**
 * Schema mapping environment variable names to their field definitions.
 */
export type Schema = Record<string, FieldDef>;

/**
 * Helper to infer the runtime type of a field definition.
 */
export type InferFieldType<T extends FieldDef> =
  T extends EnumFieldDef<infer U>
    ? U
    : T extends BooleanFieldDef
      ? boolean
      : T extends NumberFieldDef
        ? number
        : string;

/**
 * Helper to infer whether the field value is guaranteed to be present or optional.
 * A field is guaranteed non-undefined if it is marked required: true OR has a default value.
 */
export type InferField<T extends FieldDef> = T extends { default: InferFieldType<T> }
  ? InferFieldType<T>
  : T extends { required: true }
    ? InferFieldType<T>
    : InferFieldType<T> | undefined;

/**
 * Inferred typed environment object from an env-drift schema.
 */
export type InferEnv<S extends Schema> = {
  readonly [K in keyof S]: InferField<S[K]>;
};

/**
 * Options for defineEnv.
 */
export interface DefineEnvOptions {
  /**
   * Source environment dictionary, defaults to process.env.
   */
  source?: Record<string, string | undefined>;

  /**
   * If true, bypasses throwing validation errors.
   * Useful when inspecting the schema during CLI execution before .env is populated.
   */
  skipValidation?: boolean;
}

/**
 * Represents a single validation problem.
 */
export interface ValidationErrorIssue {
  key: string;
  message: string;
  received?: unknown;
}

/**
 * Source code location where an environment variable was detected.
 */
export interface CodeReferenceLocation {
  file: string;
  line: number;
  column: number;
  snippet?: string;
}

/**
 * An undeclared environment variable found in the source code.
 */
export interface UndeclaredVariableReference {
  key: string;
  locations: CodeReferenceLocation[];
}

/**
 * Detailed report of environment drift across schema, .env, .env.example, and source code.
 */
export interface DriftReport {
  /**
   * Variables declared in schema but missing from local .env.
   */
  missingFromEnv: Array<{ key: string; description?: string; required?: boolean }>;

  /**
   * Variables declared in schema but missing from .env.example.
   */
  missingFromExample: Array<{ key: string; description?: string; required?: boolean }>;

  /**
   * Variables present in .env.example but not declared in the schema.
   */
  extraInExample: string[];

  /**
   * Variables referenced via process.env.X in source code but not declared in the schema.
   */
  undeclaredInCode: UndeclaredVariableReference[];

  /**
   * Whether .env file was found on disk.
   */
  envFileExists: boolean;

  /**
   * Whether .env.example file was found on disk.
   */
  exampleFileExists: boolean;

  /**
   * True if no drift was found anywhere.
   */
  isClean: boolean;

  /**
   * Total number of distinct drift issues.
   */
  totalIssues: number;
}
