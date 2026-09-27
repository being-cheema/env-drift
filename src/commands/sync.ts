import fs from 'node:fs';
import path from 'node:path';
import { createColors } from '../utils/colors.js';
import { computeDiff, type DiffResult } from '../utils/diff.js';
import { formatEnvExample } from '../utils/env-file.js';
import { loadSchema } from '../utils/schema-loader.js';

export interface SyncOptions {
  schema?: string;
  example?: string;
  cwd?: string;
  dryRun?: boolean;
  ci?: boolean;
}

export interface SyncResult {
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
export async function runSync(options: SyncOptions = {}): Promise<SyncResult> {
  const cwd = path.resolve(options.cwd ?? process.cwd());
  const examplePath = path.resolve(cwd, options.example ?? '.env.example');
  const c = createColors({ ci: options.ci });

  // 1. Load schema
  const { schema, resolvedPath: schemaFullPath } = await loadSchema(options.schema, cwd);

  // 2. Generate new .env.example content
  const generatedContent = formatEnvExample(schema);

  // 3. Read current .env.example if present
  let currentContent: string | null = null;
  if (fs.existsSync(examplePath)) {
    currentContent = fs.readFileSync(examplePath, 'utf-8');
  }

  // 4. Compute diff
  const diff = computeDiff(currentContent, generatedContent, { ci: options.ci });

  const relSchema = path.relative(cwd, schemaFullPath) || schemaFullPath;
  const relExample = path.relative(cwd, examplePath) || examplePath;

  const lines: string[] = [];

  if (options.dryRun) {
    lines.push(
      c.bold(
        c.cyan(
          `${options.ci ? '[DRY-RUN]' : 'ℹ'} env-drift sync --dry-run: inspecting projected changes for ${relExample}`,
        ),
      ),
    );
    lines.push(c.dim(`  Source schema: ${relSchema}`));
    lines.push('');

    if (!diff.hasChanges) {
      lines.push(c.green(`✔ ${relExample} is already completely synchronized with schema.`));
    } else {
      lines.push(diff.formattedDiff);
      lines.push('');
      lines.push(c.dim(`Dry-run mode: no files were modified. Run without --dry-run to apply.`));
    }

    return {
      hasChanges: diff.hasChanges,
      output: lines.join('\n'),
      generatedContent,
      diff,
      written: false,
    };
  }

  // Live mode: apply changes
  if (!diff.hasChanges) {
    lines.push(c.green(`✔ ${relExample} is already up to date with schema.`));
    return {
      hasChanges: false,
      output: lines.join('\n'),
      generatedContent,
      diff,
      written: false,
    };
  }

  // Write new .env.example
  fs.writeFileSync(examplePath, generatedContent, 'utf-8');
  lines.push(c.green(`✔ Successfully synchronized ${relExample} from ${relSchema}!`));
  lines.push(c.dim(`  Updated ${Object.keys(schema).length} environment variable definitions.`));

  return {
    hasChanges: true,
    output: lines.join('\n'),
    generatedContent,
    diff,
    written: true,
  };
}
