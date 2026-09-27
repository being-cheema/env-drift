import { createColors } from './colors.js';

export interface DiffResult {
  hasChanges: boolean;
  formattedDiff: string;
}

/**
 * Computes a line-by-line colored diff between oldContent and newContent.
 * Zero-dependency implementation for CLI --dry-run output.
 */
export function computeDiff(
  oldContent: string | null,
  newContent: string,
  options: { ci?: boolean } = {},
): DiffResult {
  const c = createColors(options);

  if (oldContent === null) {
    // Brand new file
    const lines = newContent.split('\n');
    const formatted = lines.map((line) => (line.length > 0 ? c.green(`+ ${line}`) : '')).join('\n');
    return {
      hasChanges: true,
      formattedDiff: `${c.cyan('--- /dev/null')}\n${c.cyan('+++ .env.example')}\n${formatted}`,
    };
  }

  if (oldContent === newContent) {
    return {
      hasChanges: false,
      formattedDiff: c.dim('(no changes)'),
    };
  }

  const oldLines = oldContent.split('\n');
  const newLines = newContent.split('\n');

  // Simple and robust LCS-based or line-matching diff algorithm
  const diffLines: string[] = [
    c.cyan('--- .env.example (current)'),
    c.cyan('+++ .env.example (projected)'),
  ];

  // We can use a standard Myers / LCS algorithm or line comparison
  const lcs = computeLCS(oldLines, newLines);
  let oldIdx = 0;
  let newIdx = 0;

  for (const match of lcs) {
    // Lines deleted from old
    while (oldIdx < match.oldIndex) {
      diffLines.push(c.red(`- ${oldLines[oldIdx]}`));
      oldIdx++;
    }
    // Lines added in new
    while (newIdx < match.newIndex) {
      diffLines.push(c.green(`+ ${newLines[newIdx]}`));
      newIdx++;
    }
    // Common unchanged line
    diffLines.push(c.dim(`  ${oldLines[oldIdx]}`));
    oldIdx++;
    newIdx++;
  }

  while (oldIdx < oldLines.length) {
    diffLines.push(c.red(`- ${oldLines[oldIdx]}`));
    oldIdx++;
  }

  while (newIdx < newLines.length) {
    diffLines.push(c.green(`+ ${newLines[newIdx]}`));
    newIdx++;
  }

  return {
    hasChanges: true,
    formattedDiff: diffLines.join('\n'),
  };
}

interface Match {
  oldIndex: number;
  newIndex: number;
}

/**
 * Longest Common Subsequence of lines for clean unified diff output.
 */
function computeLCS(a: string[], b: string[]): Match[] {
  const n = a.length;
  const m = b.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < m; j++) {
      if (a[i] === b[j]) {
        dp[i + 1]![j + 1] = dp[i]![j]! + 1;
      } else {
        dp[i + 1]![j + 1] = Math.max(dp[i + 1]![j]!, dp[i]![j + 1]!);
      }
    }
  }

  const matches: Match[] = [];
  let i = n;
  let j = m;

  while (i > 0 && j > 0) {
    if (a[i - 1] === b[j - 1]) {
      matches.unshift({ oldIndex: i - 1, newIndex: j - 1 });
      i--;
      j--;
    } else if (dp[i - 1]![j]! >= dp[i]![j - 1]!) {
      i--;
    } else {
      j--;
    }
  }

  return matches;
}
