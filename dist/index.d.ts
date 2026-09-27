/**
 * Supported field types in env-drift.
 */
type FieldType = 'string' | 'number' | 'boolean' | 'url' | 'enum';
/**
 * Base configuration common to all field definitions.
 */
interface BaseFieldDef<T> {
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
interface StringFieldDef extends BaseFieldDef<string> {
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
interface NumberFieldDef extends BaseFieldDef<number> {
    type: 'number';
}
/**
 * Schema definition for boolean environment variables.
 * Values like "true", "1", "yes" become true; "false", "0", "no" become false.
 */
interface BooleanFieldDef extends BaseFieldDef<boolean> {
    type: 'boolean';
}
/**
 * Schema definition for valid URL environment variables.
 * Validates that the value is a valid URL parseable by URL().
 */
interface UrlFieldDef extends BaseFieldDef<string> {
    type: 'url';
}
/**
 * Schema definition for enum environment variables with a fixed set of allowed values.
 */
interface EnumFieldDef<T extends string = string> extends BaseFieldDef<T> {
    type: 'enum';
    /**
     * The list of permitted string values.
     */
    values: readonly T[];
}
/**
 * Discriminated union of all supported schema field definitions.
 */
type FieldDef = StringFieldDef | NumberFieldDef | BooleanFieldDef | UrlFieldDef | EnumFieldDef<any>;
/**
 * Schema mapping environment variable names to their field definitions.
 */
type Schema = Record<string, FieldDef>;
/**
 * Helper to infer the runtime type of a field definition.
 */
type InferFieldType<T extends FieldDef> = T extends EnumFieldDef<infer U> ? U : T extends BooleanFieldDef ? boolean : T extends NumberFieldDef ? number : string;
/**
 * Helper to infer whether the field value is guaranteed to be present or optional.
 * A field is guaranteed non-undefined if it is marked required: true OR has a default value.
 */
type InferField<T extends FieldDef> = T extends {
    default: InferFieldType<T>;
} ? InferFieldType<T> : T extends {
    required: true;
} ? InferFieldType<T> : InferFieldType<T> | undefined;
/**
 * Inferred typed environment object from an env-drift schema.
 */
type InferEnv<S extends Schema> = {
    readonly [K in keyof S]: InferField<S[K]>;
};
/**
 * Options for defineEnv.
 */
interface DefineEnvOptions {
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
interface ValidationErrorIssue {
    key: string;
    message: string;
    received?: unknown;
}
/**
 * Source code location where an environment variable was detected.
 */
interface CodeReferenceLocation {
    file: string;
    line: number;
    column: number;
    snippet?: string;
}
/**
 * An undeclared environment variable found in the source code.
 */
interface UndeclaredVariableReference {
    key: string;
    locations: CodeReferenceLocation[];
}
/**
 * Detailed report of environment drift across schema, .env, .env.example, and source code.
 */
interface DriftReport {
    /**
     * Variables declared in schema but missing from local .env.
     */
    missingFromEnv: Array<{
        key: string;
        description?: string;
        required?: boolean;
    }>;
    /**
     * Variables declared in schema but missing from .env.example.
     */
    missingFromExample: Array<{
        key: string;
        description?: string;
        required?: boolean;
    }>;
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

declare const SCHEMA_SYMBOL: unique symbol;
/**
 * Extracts the schema definition from an env object returned by defineEnv,
 * or returns the object directly if it is already a Schema.
 */
declare function getSchema(target: unknown): Schema | undefined;
/**
 * Validates environment variables against a typed schema.
 * Coerces types and throws an aggregated EnvValidationError if any issues are detected.
 */
declare function defineEnvImpl<S extends Schema>(schema: S, options?: DefineEnvOptions): InferEnv<S>;
declare namespace defineEnvImpl {
    export var string: (def?: Omit<StringFieldDef, "type">) => StringFieldDef;
    export var number: (def?: Omit<NumberFieldDef, "type">) => NumberFieldDef;
    export var boolean: (def?: Omit<BooleanFieldDef, "type">) => BooleanFieldDef;
    export var url: (def?: Omit<UrlFieldDef, "type">) => UrlFieldDef;
    var _a: <T extends string>(values: readonly T[], def?: Omit<EnumFieldDef<T>, "type" | "values">) => EnumFieldDef<T>;
    export { _a as enum };
}
declare const defineEnv: typeof defineEnvImpl & {
    string: typeof defineEnvImpl.string;
    number: typeof defineEnvImpl.number;
    boolean: typeof defineEnvImpl.boolean;
    url: typeof defineEnvImpl.url;
    enum: typeof defineEnvImpl.enum;
};

/**
 * Aggregated error thrown when one or more environment variables fail validation.
 * Lists all issues together in a clear, formatted message.
 */
declare class EnvValidationError extends Error {
    readonly issues: readonly ValidationErrorIssue[];
    constructor(issues: ValidationErrorIssue[]);
}

interface CheckOptions {
    schema?: string;
    env?: string;
    example?: string;
    cwd?: string;
    ci?: boolean;
    include?: string[];
    exclude?: string[];
    skipEnv?: boolean;
}
interface CheckResult {
    report: DriftReport;
    output: string;
    isClean: boolean;
}
/**
 * Runs the drift check comparing Schema, .env, .env.example, and source code references.
 */
declare function runCheck(options?: CheckOptions): Promise<CheckResult>;

interface DiffResult {
    hasChanges: boolean;
    formattedDiff: string;
}
/**
 * Computes a line-by-line colored diff between oldContent and newContent.
 * Zero-dependency implementation for CLI --dry-run output.
 */
declare function computeDiff(oldContent: string | null, newContent: string, options?: {
    ci?: boolean;
}): DiffResult;

interface SyncOptions {
    schema?: string;
    example?: string;
    cwd?: string;
    dryRun?: boolean;
    ci?: boolean;
}
interface SyncResult {
    hasChanges: boolean;
    output: string;
    generatedContent: string;
    diff: DiffResult;
    written: boolean;
}
/**
 * Synchronizes .env.example from the schema.
 * Never touches .env.
 * If dryRun is true, prints the diff without writing to disk.
 */
declare function runSync(options?: SyncOptions): Promise<SyncResult>;

/**
 * Parses an environment file (.env or .env.example) content into key-value pairs.
 * Zero-dependency implementation supporting comments, quotes, and export prefix.
 */
declare function parseEnvFile(content: string): Record<string, string>;
/**
 * Safely reads and parses an environment file. Returns null if the file does not exist.
 */
declare function readEnvFile(filePath: string): Record<string, string> | null;
/**
 * Generates formatted `.env.example` content from an env-drift schema.
 * Formats each field with its description comment above, plus allowed enum values and defaults.
 */
declare function formatEnvExample(schema: Schema): string;

interface ScanOptions {
    cwd?: string;
    include?: string[];
    exclude?: string[];
    schemaPath?: string;
}
/**
 * Recursively scans source code files for references to process.env.
 * Detects process.env.VAR, process.env['VAR'], and destructuring from process.env.
 */
declare function scanSourceTree(options?: ScanOptions): UndeclaredVariableReference[];

interface LoadedSchemaResult {
    schema: Schema;
    resolvedPath: string;
}
/**
 * Finds and resolves the schema file path from CLI options or default candidate locations.
 */
declare function resolveSchemaPath(customPath?: string, cwd?: string): string;
/**
 * Loads a schema file using jiti and extracts the Schema definition.
 */
declare function loadSchema(customPath?: string, cwd?: string): Promise<LoadedSchemaResult>;

/**
 * Zero-dependency terminal coloring and formatting utility using ANSI escape codes.
 * Respects NO_COLOR, CI flags, and non-TTY environments.
 */
interface Colors {
    bold: (text: string | number) => string;
    dim: (text: string | number) => string;
    red: (text: string | number) => string;
    green: (text: string | number) => string;
    yellow: (text: string | number) => string;
    blue: (text: string | number) => string;
    magenta: (text: string | number) => string;
    cyan: (text: string | number) => string;
    gray: (text: string | number) => string;
    white: (text: string | number) => string;
    reset: (text: string | number) => string;
}
declare function createColors(options?: {
    ci?: boolean;
    force?: boolean;
}): Colors;
declare const colors: Colors;

export { type BaseFieldDef, type BooleanFieldDef, type CheckOptions, type CheckResult, type CodeReferenceLocation, type DefineEnvOptions, type DriftReport, type EnumFieldDef, EnvValidationError, type FieldDef, type FieldType, type InferEnv, type InferField, type InferFieldType, type NumberFieldDef, SCHEMA_SYMBOL, type ScanOptions, type Schema, type StringFieldDef, type SyncOptions, type SyncResult, type UndeclaredVariableReference, type UrlFieldDef, type ValidationErrorIssue, colors, computeDiff, createColors, defineEnv, formatEnvExample, getSchema, loadSchema, parseEnvFile, readEnvFile, resolveSchemaPath, runCheck, runSync, scanSourceTree };
