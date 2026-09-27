import fs from 'node:fs';
import type { Schema } from '../types.js';

/**
 * Parses an environment file (.env or .env.example) content into key-value pairs.
 * Zero-dependency implementation supporting comments, quotes, and export prefix.
 */
export function parseEnvFile(content: string): Record<string, string> {
  const result: Record<string, string> = {};
  const lines = content.split(/\r?\n/);

  for (let line of lines) {
    line = line.trim();

    // Ignore empty lines or comments
    if (!line || line.startsWith('#')) {
      continue;
    }

    // Strip leading "export "
    if (line.startsWith('export ')) {
      line = line.slice(7).trim();
    }

    const equalIndex = line.indexOf('=');
    if (equalIndex === -1) {
      continue;
    }

    const key = line.slice(0, equalIndex).trim();
    let val = line.slice(equalIndex + 1).trim();

    // Handle quoted values
    if (
      (val.startsWith('"') && val.endsWith('"') && val.length >= 2) ||
      (val.startsWith("'") && val.endsWith("'") && val.length >= 2)
    ) {
      const quote = val[0];
      val = val.slice(1, -1);
      if (quote === '"') {
        val = val
          .replace(/\\n/g, '\n')
          .replace(/\\r/g, '\r')
          .replace(/\\t/g, '\t')
          .replace(/\\"/g, '"');
      }
    } else {
      // Unquoted: strip inline comments if present (preceded by whitespace)
      const commentIndex = val.search(/\s+#/);
      if (commentIndex !== -1) {
        val = val.slice(0, commentIndex).trim();
      }
    }

    result[key] = val;
  }

  return result;
}

/**
 * Safely reads and parses an environment file. Returns null if the file does not exist.
 */
export function readEnvFile(filePath: string): Record<string, string> | null {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return parseEnvFile(content);
  } catch (error: any) {
    if (error && (error.code === 'ENOENT' || error.code === 'ENOTDIR')) {
      return null;
    }
    throw error;
  }
}

/**
 * Generates formatted `.env.example` content from an env-drift schema.
 * Formats each field with its description comment above, plus allowed enum values and defaults.
 */
export function formatEnvExample(schema: Schema): string {
  const chunks: string[] = [];

  for (const [key, field] of Object.entries(schema)) {
    const comments: string[] = [];

    if (field.description) {
      // Split multiline descriptions if necessary
      for (const line of field.description.split(/\r?\n/)) {
        comments.push(`# ${line}`);
      }
    }

    if (field.type === 'enum' && Array.isArray((field as any).values)) {
      comments.push(`# Allowed: ${(field as any).values.join(', ')}`);
    }

    let valueStr = '';
    if (field.default !== undefined) {
      valueStr = String(field.default);
    } else if (field.example !== undefined) {
      valueStr = String(field.example);
    }

    const commentBlock = comments.length > 0 ? comments.join('\n') + '\n' : '';
    chunks.push(`${commentBlock}${key}=${valueStr}`);
  }

  return chunks.length > 0 ? chunks.join('\n\n') + '\n' : '';
}
