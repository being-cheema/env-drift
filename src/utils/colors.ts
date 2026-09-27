/**
 * Zero-dependency terminal coloring and formatting utility using ANSI escape codes.
 * Respects NO_COLOR, CI flags, and non-TTY environments.
 */

export interface Colors {
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

export function createColors(options: { ci?: boolean; force?: boolean } = {}): Colors {
  const isNoColor = Boolean(process.env.NO_COLOR);
  const isCi = Boolean(options.ci);
  const isColorSupported =
    options.force ||
    (!isNoColor && !isCi && (process.stdout.isTTY ?? false) && process.env.TERM !== 'dumb');

  const wrap = (open: string, close: string) => (text: string | number) =>
    isColorSupported ? `${open}${text}${close}` : String(text);

  return {
    bold: wrap('\x1b[1m', '\x1b[22m'),
    dim: wrap('\x1b[2m', '\x1b[22m'),
    red: wrap('\x1b[31m', '\x1b[39m'),
    green: wrap('\x1b[32m', '\x1b[39m'),
    yellow: wrap('\x1b[33m', '\x1b[39m'),
    blue: wrap('\x1b[34m', '\x1b[39m'),
    magenta: wrap('\x1b[35m', '\x1b[39m'),
    cyan: wrap('\x1b[36m', '\x1b[39m'),
    gray: wrap('\x1b[90m', '\x1b[39m'),
    white: wrap('\x1b[37m', '\x1b[39m'),
    reset: wrap('\x1b[0m', '\x1b[0m'),
  };
}

export const colors = createColors();
