import fs from 'node:fs';
import path from 'node:path';
// We use jiti as our single runtime dependency to allow seamless, zero-config
// loading of TypeScript (.ts) and ESM/CJS schema files across all Node.js versions
// without requiring the host project to pre-compile their schema or install tsx/ts-node.
import { createJiti } from 'jiti';
import { getSchema } from '../define-env.js';
import type { Schema } from '../types.js';

const CANDIDATE_FILENAMES = [
  'env.schema.ts',
  'env.schema.js',
  'env.schema.mjs',
  'env.schema.cjs',
  'src/env.schema.ts',
  'src/env.schema.js',
];

export interface LoadedSchemaResult {
  schema: Schema;
  resolvedPath: string;
}

/**
 * Finds and resolves the schema file path from CLI options or default candidate locations.
 */
export function resolveSchemaPath(customPath?: string, cwd: string = process.cwd()): string {
  if (customPath) {
    const resolved = path.resolve(cwd, customPath);
    if (!fs.existsSync(resolved)) {
      throw new Error(`Schema file not found at: ${customPath}`);
    }
    return resolved;
  }

  for (const candidate of CANDIDATE_FILENAMES) {
    const candidatePath = path.resolve(cwd, candidate);
    if (fs.existsSync(candidatePath)) {
      return candidatePath;
    }
  }

  throw new Error(
    `No schema file found. Looked for: ${CANDIDATE_FILENAMES.join(', ')}.\n` +
      `Please create an env.schema.ts or specify the path with --schema <path>.`,
  );
}

/**
 * Loads a schema file using jiti and extracts the Schema definition.
 */
export async function loadSchema(
  customPath?: string,
  cwd: string = process.cwd(),
): Promise<LoadedSchemaResult> {
  const resolvedPath = resolveSchemaPath(customPath, cwd);

  // Set KEYSMITH_CLI so that if the user's file calls defineEnv(...),
  // it bypasses runtime throwing if environment variables are not yet populated.
  const prevKeysmithCli = process.env.KEYSMITH_CLI;
  process.env.KEYSMITH_CLI = '1';

  let mod: any;
  try {
    const jiti = createJiti(cwd, {
      interopDefault: true,
      requireCache: false,
    });
    mod = await jiti.import(resolvedPath);
  } finally {
    if (prevKeysmithCli === undefined) {
      delete process.env.KEYSMITH_CLI;
    } else {
      process.env.KEYSMITH_CLI = prevKeysmithCli;
    }
  }

  // Attempt to extract the schema from common export patterns
  const candidateExports = [
    mod,
    mod?.default,
    mod?.schema,
    mod?.env,
    ...(typeof mod === 'object' && mod !== null ? Object.values(mod) : []),
  ];

  for (const candidate of candidateExports) {
    const found = getSchema(candidate);
    if (found) {
      return { schema: found, resolvedPath };
    }
  }

  throw new Error(
    `Failed to find a valid keysmith schema in ${resolvedPath}.\n` +
      `Ensure you export a defineEnv(...) result or a schema object.`,
  );
}
