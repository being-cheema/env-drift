import fs from 'node:fs';
import path from 'node:path';
import type { CodeReferenceLocation, UndeclaredVariableReference } from '../types.js';

export interface ScanOptions {
  cwd?: string;
  include?: string[];
  exclude?: string[];
  schemaPath?: string;
}

const DEFAULT_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);

const DEFAULT_EXCLUDES = [
  'node_modules',
  'dist',
  'build',
  '.git',
  '.next',
  '.turbo',
  '.output',
  'coverage',
  '.cache',
];

/**
 * Recursively scans source code files for references to process.env.
 * Detects process.env.VAR, process.env['VAR'], and destructuring from process.env.
 */
export function scanSourceTree(options: ScanOptions = {}): UndeclaredVariableReference[] {
  const cwd = path.resolve(options.cwd ?? process.cwd());
  const schemaFullPath = options.schemaPath ? path.resolve(cwd, options.schemaPath) : null;
  const excludePatterns = options.exclude ?? DEFAULT_EXCLUDES;

  const foundReferences = new Map<string, CodeReferenceLocation[]>();

  function shouldExclude(dirOrFilePath: string): boolean {
    const rel = path.relative(cwd, dirOrFilePath);
    if (!rel) return false;
    const parts = rel.split(path.sep);

    // Check if any path segment matches any exclude pattern
    for (const part of parts) {
      if (excludePatterns.some((pattern) => part === pattern || part.startsWith('.' + pattern))) {
        return true;
      }
    }

    if (schemaFullPath && path.resolve(dirOrFilePath) === schemaFullPath) {
      return true;
    }

    return false;
  }

  function walk(currentDir: string): void {
    if (shouldExclude(currentDir)) {
      return;
    }

    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(currentDir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);

      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name);
        if (!DEFAULT_EXTENSIONS.has(ext)) {
          continue;
        }

        if (schemaFullPath && path.resolve(fullPath) === schemaFullPath) {
          continue;
        }

        if (shouldExclude(fullPath)) {
          continue;
        }

        scanFile(fullPath, cwd, foundReferences);
      }
    }
  }

  walk(cwd);

  const results: UndeclaredVariableReference[] = [];
  for (const [key, locations] of foundReferences.entries()) {
    results.push({ key, locations });
  }

  return results.sort((a, b) => a.key.localeCompare(b.key));
}

/**
 * Scans a single source file for process.env references.
 */
export function scanFile(
  filePath: string,
  cwd: string,
  collector: Map<string, CodeReferenceLocation[]>,
): void {
  let content: string;
  try {
    content = fs.readFileSync(filePath, 'utf-8');
  } catch {
    return;
  }

  const relPath = path.relative(cwd, filePath);
  const lines = content.split(/\r?\n/);

  // Regex patterns:
  // 1. process.env.VAR_NAME
  const dotPattern = /\bprocess\.env\.([a-zA-Z_][a-zA-Z0-9_]*)\b/g;

  // 2. process.env['VAR_NAME'] or process.env["VAR_NAME"] or process.env[`VAR_NAME`]
  const bracketPattern = /\bprocess\.env\[\s*['"`]([a-zA-Z_][a-zA-Z0-9_]*)['"`]\s*\]/g;

  // 3. const/let/var { A, B: renamed, C = default } = process.env
  const destructurePattern =
    /\b(?:const|let|var)\s*\{\s*([^}]+)\s*\}\s*=\s*(?:[a-zA-Z0-9_.]+\.)?process\.env\b/g;

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex]!;
    const trimmed = line.trim();

    // Skip single-line comments
    if (trimmed.startsWith('//') || trimmed.startsWith('/*')) {
      continue;
    }

    // Match process.env.KEY
    let match: RegExpExecArray | null;
    dotPattern.lastIndex = 0;
    while ((match = dotPattern.exec(line)) !== null) {
      const key = match[1]!;
      addRef(collector, key, {
        file: relPath,
        line: lineIndex + 1,
        column: match.index + 1,
        snippet: trimmed,
      });
    }

    // Match process.env['KEY']
    bracketPattern.lastIndex = 0;
    while ((match = bracketPattern.exec(line)) !== null) {
      const key = match[1]!;
      addRef(collector, key, {
        file: relPath,
        line: lineIndex + 1,
        column: match.index + 1,
        snippet: trimmed,
      });
    }

    // Match destructuring
    destructurePattern.lastIndex = 0;
    while ((match = destructurePattern.exec(line)) !== null) {
      const rawVars = match[1]!;
      const parts = rawVars.split(',');

      for (const part of parts) {
        const cleaned = part.trim();
        if (!cleaned) continue;

        // Handles "KEY", "KEY: renamed", "KEY = default", "KEY: renamed = default"
        const keyMatch = cleaned.match(/^([a-zA-Z_][a-zA-Z0-9_]*)/);
        if (keyMatch) {
          const key = keyMatch[1]!;
          addRef(collector, key, {
            file: relPath,
            line: lineIndex + 1,
            column: match.index + 1,
            snippet: trimmed,
          });
        }
      }
    }
  }
}

function addRef(
  collector: Map<string, CodeReferenceLocation[]>,
  key: string,
  location: CodeReferenceLocation,
): void {
  const existing = collector.get(key);
  if (existing) {
    existing.push(location);
  } else {
    collector.set(key, [location]);
  }
}
