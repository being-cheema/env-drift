import { runCheck } from './commands/check.js';
import { runSync } from './commands/sync.js';
import { createColors } from './utils/colors.js';

interface CliArgs {
  command?: 'check' | 'sync' | 'help' | 'version';
  schema?: string;
  env?: string;
  example?: string;
  ci?: boolean;
  dryRun?: boolean;
  skipEnv?: boolean;
  help?: boolean;
  version?: boolean;
}

function parseArgs(args: string[]): CliArgs {
  const result: CliArgs = {};
  const positional: string[] = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;

    if (arg === '--help' || arg === '-h') {
      result.help = true;
    } else if (arg === '--version' || arg === '-v') {
      result.version = true;
    } else if (arg === '--ci') {
      result.ci = true;
    } else if (arg === '--dry-run') {
      result.dryRun = true;
    } else if (arg === '--skip-env') {
      result.skipEnv = true;
    } else if (arg === '--schema' || arg === '-s') {
      result.schema = args[++i];
    } else if (arg === '--env' || arg === '-e') {
      result.env = args[++i];
    } else if (arg === '--example') {
      result.example = args[++i];
    } else if (!arg.startsWith('-')) {
      positional.push(arg);
    }
  }

  const cmd = positional[0]?.toLowerCase();
  if (cmd === 'check' || cmd === 'sync') {
    result.command = cmd;
  } else if (cmd === 'help') {
    result.help = true;
  } else if (cmd === 'version') {
    result.version = true;
  }

  return result;
}

function showHelp(ci?: boolean): void {
  const c = createColors({ ci });

  console.log(`
${c.bold('env-drift')} - Schema-driven environment variable validator & .env.example synchronizer

${c.bold('USAGE')}
  ${c.cyan('$')} npx env-drift ${c.yellow('<command>')} [options]

${c.bold('COMMANDS')}
  ${c.yellow('check')}     Cross-reference schema, .env, .env.example, and source code for drift
  ${c.yellow('sync')}      Regenerate .env.example from schema with comments & defaults

${c.bold('OPTIONS')}
  ${c.cyan('-s, --schema <path>')}   Path to schema file (default: ./env.schema.ts or .js)
  ${c.cyan('-e, --env <path>')}      Path to local .env file (default: ./.env)
  ${c.cyan('--example <path>')}      Path to .env.example file (default: ./.env.example)
  ${c.cyan('--dry-run')}             Print diff without writing to disk (sync only)
  ${c.cyan('--ci')}                  Disable colors and interactive symbols for CI logs
  ${c.cyan('--skip-env')}            Skip checking local .env file (check only)
  ${c.cyan('-h, --help')}            Display this help message
  ${c.cyan('-v, --version')}         Display version

${c.bold('EXAMPLES')}
  ${c.dim('# Check for drift locally')}
  ${c.cyan('$')} npx env-drift check

  ${c.dim('# Run in CI pipeline')}
  ${c.cyan('$')} npx env-drift check --ci

  ${c.dim('# Preview .env.example changes')}
  ${c.cyan('$')} npx env-drift sync --dry-run

  ${c.dim('# Regenerate .env.example')}
  ${c.cyan('$')} npx env-drift sync
`);
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  if (args.version) {
    console.log('env-drift v0.1.0');
    process.exit(0);
  }

  if (args.help || !args.command) {
    showHelp(args.ci);
    process.exit(args.help ? 0 : 1);
  }

  try {
    if (args.command === 'check') {
      const result = await runCheck({
        schema: args.schema,
        env: args.env,
        example: args.example,
        ci: args.ci,
        skipEnv: args.skipEnv,
      });

      console.log(result.output);
      process.exit(result.isClean ? 0 : 1);
    } else if (args.command === 'sync') {
      const result = await runSync({
        schema: args.schema,
        example: args.example,
        dryRun: args.dryRun,
        ci: args.ci,
      });

      console.log(result.output);
      process.exit(0);
    }
  } catch (error: any) {
    const c = createColors({ ci: args.ci });
    console.error(c.red(`Error: ${error?.message || error}`));
    process.exit(1);
  }
}

main();
