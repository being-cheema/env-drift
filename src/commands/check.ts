import path from 'node:path';
import { createColors } from '../utils/colors.js';
import { readEnvFile } from '../utils/env-file.js';
import { scanSourceTree } from '../utils/scanner.js';
import { loadSchema } from '../utils/schema-loader.js';
import type { DriftReport, Schema } from '../types.js';

export interface CheckOptions {
  schema?: string;
  env?: string;
  example?: string;
  cwd?: string;
  ci?: boolean;
  include?: string[];
  exclude?: string[];
  skipEnv?: boolean;
}

export interface CheckResult {
  report: DriftReport;
  output: string;
  isClean: boolean;
}

/**
 * Runs the drift check comparing Schema, .env, .env.example, and source code references.
 */
export async function runCheck(options: CheckOptions = {}): Promise<CheckResult> {
  const cwd = path.resolve(options.cwd ?? process.cwd());
  const envPath = path.resolve(cwd, options.env ?? '.env');
  const examplePath = path.resolve(cwd, options.example ?? '.env.example');

  // 1. Load Schema
  const { schema, resolvedPath: schemaFullPath } = await loadSchema(options.schema, cwd);
  const schemaKeys = new Set(Object.keys(schema));

  // 2. Read .env and .env.example files
  const envData = options.skipEnv ? null : readEnvFile(envPath);
  const exampleData = readEnvFile(examplePath);

  const envFileExists = envData !== null;
  const exampleFileExists = exampleData !== null;

  const envKeys = new Set(envData ? Object.keys(envData) : []);
  const exampleKeys = new Set(exampleData ? Object.keys(exampleData) : []);

  // a) Vars declared in schema but missing from .env / .env.example
  const missingFromEnv: DriftReport['missingFromEnv'] = [];
  const missingFromExample: DriftReport['missingFromExample'] = [];

  for (const [key, def] of Object.entries(schema)) {
    if (!options.skipEnv && (!envFileExists || !envKeys.has(key))) {
      missingFromEnv.push({
        key,
        description: def.description,
        required: def.required,
      });
    }

    if (!exampleFileExists || !exampleKeys.has(key)) {
      missingFromExample.push({
        key,
        description: def.description,
        required: def.required,
      });
    }
  }

  // b) Vars present in .env.example but not declared in the schema
  const extraInExample: string[] = [];
  if (exampleData) {
    for (const key of Object.keys(exampleData)) {
      if (!schemaKeys.has(key)) {
        extraInExample.push(key);
      }
    }
  }
  extraInExample.sort();

  // c) Vars referenced via process.env.X in source tree but not declared in schema
  const codeRefs = scanSourceTree({
    cwd,
    schemaPath: schemaFullPath,
    include: options.include,
    exclude: options.exclude,
  });

  const undeclaredInCode = codeRefs.filter((ref) => !schemaKeys.has(ref.key));

  const totalIssues =
    missingFromEnv.length +
    missingFromExample.length +
    extraInExample.length +
    undeclaredInCode.length;

  const isClean = totalIssues === 0;

  const report: DriftReport = {
    missingFromEnv,
    missingFromExample,
    extraInExample,
    undeclaredInCode,
    envFileExists,
    exampleFileExists,
    isClean,
    totalIssues,
  };

  const output = formatCheckReport(report, {
    cwd,
    schemaPath: schemaFullPath,
    envPath,
    examplePath,
    ci: options.ci,
    skipEnv: options.skipEnv,
    schema,
  });

  return { report, output, isClean };
}

interface FormatReportOptions {
  cwd: string;
  schemaPath: string;
  envPath: string;
  examplePath: string;
  ci?: boolean;
  skipEnv?: boolean;
  schema: Schema;
}

export function formatCheckReport(report: DriftReport, opts: FormatReportOptions): string {
  const c = createColors({ ci: opts.ci });
  const lines: string[] = [];

  const relSchema = path.relative(opts.cwd, opts.schemaPath) || opts.schemaPath;
  const relExample = path.relative(opts.cwd, opts.examplePath) || opts.examplePath;
  const relEnv = path.relative(opts.cwd, opts.envPath) || opts.envPath;

  const varCount = Object.keys(opts.schema).length;

  if (report.isClean) {
    lines.push(
      c.green(
        `${opts.ci ? '[OK]' : '✔'} No environment drift detected across schema (${varCount} vars), ${relExample}, ${opts.skipEnv ? '' : `${relEnv}, `}and source code.`,
      ),
    );
    return lines.join('\n');
  }

  // Drift detected header
  lines.push(
    c.bold(
      c.red(
        `${opts.ci ? '[DRIFT]' : '✖'} Environment drift detected (${report.totalIssues} issue${report.totalIssues === 1 ? '' : 's'} found):`,
      ),
    ),
  );
  lines.push(c.dim(`  Schema: ${relSchema} (${varCount} variables defined)`));
  lines.push('');

  // 1. Missing from .env
  if (!opts.skipEnv && report.missingFromEnv.length > 0) {
    const header = report.envFileExists
      ? `Missing from ${relEnv}:`
      : `Missing from ${relEnv} (file does not exist):`;
    lines.push(c.bold(c.yellow(`  ${opts.ci ? '!' : '⚠'} ${header}`)));
    for (const item of report.missingFromEnv) {
      const desc = item.description ? c.dim(` — ${item.description}`) : '';
      const req = item.required ? c.red(' [required]') : '';
      lines.push(`    • ${c.bold(item.key)}${req}${desc}`);
    }
    lines.push('');
  }

  // 2. Missing from .env.example
  if (report.missingFromExample.length > 0) {
    const header = report.exampleFileExists
      ? `Missing from ${relExample}:`
      : `Missing from ${relExample} (file does not exist):`;
    lines.push(c.bold(c.yellow(`  ${opts.ci ? '!' : '⚠'} ${header}`)));
    for (const item of report.missingFromExample) {
      const desc = item.description ? c.dim(` — ${item.description}`) : '';
      lines.push(`    • ${c.bold(item.key)}${desc}`);
    }
    lines.push('');
  }

  // 3. Extra in .env.example
  if (report.extraInExample.length > 0) {
    lines.push(
      c.bold(c.magenta(`  ${opts.ci ? '!' : '⚠'} Present in ${relExample} but not in schema:`)),
    );
    for (const key of report.extraInExample) {
      lines.push(`    • ${c.bold(key)}`);
    }
    lines.push('');
  }

  // 4. Undeclared in code
  if (report.undeclaredInCode.length > 0) {
    lines.push(
      c.bold(c.red(`  ${opts.ci ? '!' : '⚠'} Referenced in source code but not in schema:`)),
    );
    for (const item of report.undeclaredInCode) {
      lines.push(`    • ${c.bold(item.key)}`);
      for (const loc of item.locations) {
        lines.push(c.dim(`        at ${loc.file}:${loc.line}:${loc.column}`));
      }
    }
    lines.push('');
  }

  // Help tip
  if (report.missingFromExample.length > 0 || report.extraInExample.length > 0) {
    lines.push(
      c.dim(`Tip: Run \`npx env-drift sync\` to automatically synchronize ${relExample}.`),
    );
  }

  return lines.join('\n');
}
