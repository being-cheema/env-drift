# env-drift

> A schema-driven environment-variable validator for Node.js that keeps `.env.example` honest.

[![CI](https://github.com/being-cheema/env-drift/actions/workflows/ci.yml/badge.svg)](https://github.com/being-cheema/env-drift/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-Strict-blue.svg)](https://www.typescriptlang.org/)
[![Dual ESM/CJS](https://img.shields.io/badge/Module-ESM%20%2B%20CJS-green.svg)](https://nodejs.org/)

`env-drift` pairs runtime environment-variable validation with automated drift detection. It ensures your application gets strictly typed, validated configuration at boot time, and guarantees that your committed `.env.example` file and your source code never fall out of sync.

Feels as polished and minimal as `zod`, `dotenv`, or `chalk` — small API surface, zero unnecessary dependencies, strict TypeScript types, and aggregated terminal reports.

---

## Features

- **Typed Schema Builder (`defineEnv`)**: Validate strings, numbers, booleans, URLs, and enums with automatic type coercion and exact TypeScript inference.
- **Aggregated Error Reporting**: Never play whack-a-mole with missing environment variables. Reports every missing or malformed variable in a single, readable error.
- **Drift Detection (`env-drift check`)**: In one command, cross-references:
  1. Variables declared in the schema but missing from `.env` or `.env.example`.
  2. Outdated variables lingering in `.env.example` that are no longer in the schema.
  3. Undeclared `process.env.X` references scattered across your `.ts` and `.js` source files with line numbers.
- **Automated Sync (`env-drift sync`)**: Regenerates `.env.example` directly from the schema, including descriptions as comments, allowed enum values, and defaults or placeholders. Never modifies your actual `.env`.
- **Zero Unnecessary Runtime Dependencies**: Built with native Node.js capabilities and zero-dependency terminal styling. Uses only `jiti` for zero-config runtime loading of TypeScript and ESM/CJS schema files.
- **Dual Build**: Native support for ESM and CommonJS with bundled TypeScript declarations.

---

## Installation

```bash
# npm
npm install env-drift

# pnpm
pnpm add env-drift

# yarn
yarn add env-drift

# bun
bun add env-drift
```

---

## 30-Second Quickstart

### 1. Define your schema

Create `env.schema.ts` in your project root:

```ts
import { defineEnv } from 'env-drift';

export const env = defineEnv({
  PORT: {
    type: 'number',
    default: 3000,
    description: 'Port for the HTTP server to listen on',
  },
  DATABASE_URL: {
    type: 'url',
    required: true,
    description: 'PostgreSQL connection string',
  },
  NODE_ENV: {
    type: 'enum',
    values: ['development', 'test', 'production'] as const,
    default: 'development',
    description: 'Application runtime environment',
  },
  API_KEY: {
    type: 'string',
    required: true,
    description: 'Third-party secret API key',
  },
  ENABLE_ANALYTICS: {
    type: 'boolean',
    default: false,
    description: 'Toggle collection of application analytics',
  },
});
```

### 2. Use the typed `env` in your application

```ts
import { env } from './env.schema.js';

// env is fully typed!
// env.PORT is number
// env.DATABASE_URL is string
// env.NODE_ENV is 'development' | 'test' | 'production'
// env.ENABLE_ANALYTICS is boolean

console.log(`Starting server on port ${env.PORT} in ${env.NODE_ENV} mode...`);
```

If any required variable is missing or malformed, `defineEnv` throws an aggregated error at startup:

```
Environment validation failed:
  - DATABASE_URL: required but not set
  - PORT: expected number, got 'abc'
```

### 3. Check for drift

```bash
npx env-drift check
```

```
✖ Environment drift detected (3 issues found):
  Schema: env.schema.ts (5 variables defined)

  Missing from .env.example:
    • API_KEY — Third-party secret API key

  Present in .env.example but not in schema:
    • LEGACY_CACHE_TOKEN

  Referenced in source code but not in schema:
    • UNTRACKED_FEATURE_FLAG
        at src/server.ts:18:24

Tip: Run `npx env-drift sync` to automatically synchronize .env.example.
```

### 4. Synchronize `.env.example`

```bash
# Preview changes before writing:
npx env-drift sync --dry-run

# Write the updated .env.example:
npx env-drift sync
```

Generated `.env.example`:

```env
# Port for the HTTP server to listen on
PORT=3000

# PostgreSQL connection string
DATABASE_URL=

# Application runtime environment
# Allowed: development, test, production
NODE_ENV=development

# Third-party secret API key
API_KEY=

# Toggle collection of application analytics
ENABLE_ANALYTICS=false
```

---

## API Reference

### `defineEnv(schema, options?)`

Validates and coerces an environment variable map against a schema definition.

#### Parameters

- `schema: Record<string, FieldDef>`: An object mapping variable names to their definitions.
- `options?: DefineEnvOptions`:
  - `source?: Record<string, string | undefined>`: Environment dictionary to validate (defaults to `process.env`).
  - `skipValidation?: boolean`: If `true`, bypasses validation throwing. Useful for schema inspection tools.

#### Return Value

Returns a frozen, read-only object with coerced and validated values. TypeScript automatically infers the exact return type:

- Fields with `required: true` or a `default` value resolve to their primitive type.
- Optional fields without defaults resolve to `T | undefined`.

---

### Field Types

#### `string`

Accepts string values. Leading and trailing whitespace is trimmed. Empty strings (`""`) or whitespace-only values are treated as unset unless `allowEmpty: true` is configured.

```ts
defineEnv({
  APP_TITLE: {
    type: 'string',
    required: true,
    description: 'Application display name',
  },
  OPTIONAL_PREFIX: {
    type: 'string',
    allowEmpty: true,
  },
  HOST: {
    type: 'string',
    default: '0.0.0.0',
  },
});
```

#### `number`

Coerces numeric strings into `number`. Trims whitespace. Rejects non-numeric strings with `expected number, got '<val>'`.

```ts
defineEnv({
  PORT: {
    type: 'number',
    default: 3000,
    description: 'Server listening port',
  },
  MAX_CONNECTIONS: {
    type: 'number',
    required: true,
  },
});
```

#### `boolean`

Coerces string representations of booleans:

- `true`: `"true"`, `"1"`, `"yes"` (case-insensitive)
- `false`: `"false"`, `"0"`, `"no"` (case-insensitive)

Rejects other values with `expected boolean, got '<val>'`.

```ts
defineEnv({
  ENABLE_DEBUG: {
    type: 'boolean',
    default: false,
    description: 'Enable verbose debug logging',
  },
});
```

#### `url`

Validates that the value is a valid URL parseable by the WHATWG `URL` constructor with a defined protocol (e.g. `https://`, `postgres://`, `redis://`).

```ts
defineEnv({
  API_ENDPOINT: {
    type: 'url',
    required: true,
    description: 'Base endpoint URL for downstream service',
  },
});
```

#### `enum`

Restricts values to a specific set of allowed string literals.

```ts
defineEnv({
  LOG_LEVEL: {
    type: 'enum',
    values: ['debug', 'info', 'warn', 'error'] as const,
    default: 'info',
    description: 'Application logging level',
  },
});
```

---

### Fluent Builders

For concise definitions, helper functions are available on `defineEnv`:

```ts
import { defineEnv } from 'env-drift';

export const env = defineEnv({
  PORT: defineEnv.number({ default: 3000 }),
  HOST: defineEnv.string({ default: 'localhost' }),
  DEBUG: defineEnv.boolean({ default: false }),
  API_URL: defineEnv.url({ required: true }),
  NODE_ENV: defineEnv.enum(['development', 'production', 'test'] as const, {
    default: 'development',
  }),
});
```

---

### `EnvValidationError`

Thrown by `defineEnv` when validation fails. Contains the structured list of problems:

```ts
import { defineEnv, EnvValidationError } from 'env-drift';

try {
  defineEnv({ ... });
} catch (error) {
  if (error instanceof EnvValidationError) {
    console.error(error.message);
    // Access structured issues:
    for (const issue of error.issues) {
      console.log(issue.key, issue.message, issue.received);
    }
  }
}
```

---

## CLI Reference

### `npx env-drift check`

Cross-references the declared schema, `.env`, `.env.example`, and source files to verify project alignment.

#### Drift Categories Checked

1. **Missing from `.env` / `.env.example`**: Variables defined in your schema that are not yet configured in `.env` or documented in `.env.example`.
2. **Zombie variables in `.env.example`**: Variables lingering in `.env.example` that have been removed from the schema.
3. **Undeclared references in code**: Any usage of `process.env.VARIABLE_NAME`, `process.env['VARIABLE_NAME']`, or `const { VARIABLE_NAME } = process.env` in `.ts`, `.tsx`, `.js`, or `.jsx` source files that is not declared in the schema.

#### Exit Codes

- `0`: All environments and references are clean.
- `1`: One or more drift issues were discovered.

#### Options

| Flag                  | Description                                                             | Default                                      |
| --------------------- | ----------------------------------------------------------------------- | -------------------------------------------- |
| `-s, --schema <path>` | Path to the schema file                                                 | `./env.schema.ts` (or `.js`, `.mjs`, `.cjs`) |
| `-e, --env <path>`    | Path to the local `.env` file                                           | `./.env`                                     |
| `--example <path>`    | Path to the `.env.example` file                                         | `./.env.example`                             |
| `--ci`                | Disable colors and interactive symbols for plain CI logs                | `false`                                      |
| `--skip-env`          | Skip checking the local `.env` file (checks only `.env.example` & code) | `false`                                      |
| `-h, --help`          | Display CLI help                                                        |                                              |
| `-v, --version`       | Display version number                                                  |                                              |

---

### `npx env-drift sync`

Regenerates `.env.example` from the schema.

- Preserves each field's `description` as comments directly above the entry.
- Documents allowed enum values.
- Populates defaults or leaves empty placeholders (`KEY=`).
- **Safety guarantee**: Never modifies your real `.env` file.

#### Options

| Flag                  | Description                                                   | Default                                      |
| --------------------- | ------------------------------------------------------------- | -------------------------------------------- |
| `-s, --schema <path>` | Path to the schema file                                       | `./env.schema.ts` (or `.js`, `.mjs`, `.cjs`) |
| `--example <path>`    | Target path for `.env.example`                                | `./.env.example`                             |
| `--dry-run`           | Prints a unified colored diff without writing changes to disk | `false`                                      |
| `--ci`                | Disable terminal color codes in output                        | `false`                                      |

---

## CI / GitHub Actions Integration

Prevent drift from ever reaching your main branch by adding `env-drift check` to your CI workflow:

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  env-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - name: Verify Environment Schema Alignment
        run: npx env-drift check --ci --skip-env
```

> **Note:** The `--skip-env` flag ignores checking for the local `.env` file, which is typically not committed to version control.

---

## Programmatic API

You can also use the check and sync tools programmatically in scripts or automated pipelines:

```ts
import { runCheck, runSync } from 'env-drift';

// Run programmatic check
const checkResult = await runCheck({ cwd: process.cwd() });
if (!checkResult.isClean) {
  console.log(`Found ${checkResult.report.totalIssues} drift issues:`);
  console.log(checkResult.output);
}

// Run programmatic sync
const syncResult = await runSync({ dryRun: true });
console.log(syncResult.output);
```

---

## Design Principles & Dependencies

- **Zero unnecessary runtime dependencies**: We believe developer tooling should be lightweight and fast to install.
- **Single justified runtime dependency**: We use [`jiti`](https://github.com/unjs/jiti) (~0 sub-dependencies) to allow instant, zero-config execution of TypeScript (`.ts`) and ESM/CommonJS schema files on any Node.js version without requiring host projects to configure `tsx` or `ts-node`.
- **Pure ANSI styling**: Terminal colors and diff output are generated with zero external dependencies, automatically respecting `NO_COLOR` and `--ci`.

---

## License

[MIT](LICENSE) © Cheema
