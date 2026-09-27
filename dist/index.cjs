'use strict';

var path = require('path');
var fs4 = require('fs');
var jiti = require('jiti');

function _interopDefault (e) { return e && e.__esModule ? e : { default: e }; }

var path__default = /*#__PURE__*/_interopDefault(path);
var fs4__default = /*#__PURE__*/_interopDefault(fs4);

// src/errors.ts
var EnvValidationError = class _EnvValidationError extends Error {
  issues;
  constructor(issues) {
    const formattedIssues = issues.map((issue) => `  - ${issue.key}: ${issue.message}`).join("\n");
    const message = `Environment validation failed:
${formattedIssues}`;
    super(message);
    this.name = "EnvValidationError";
    this.issues = Object.freeze([...issues]);
    Object.setPrototypeOf(this, new.target.prototype);
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, _EnvValidationError);
    }
  }
};

// src/validators.ts
function validateAndCoerceField(key, rawVal, def) {
  const isUndefined = rawVal === void 0;
  const isWhitespaceOnly = typeof rawVal === "string" && rawVal.trim() === "";
  let isEmpty = isUndefined;
  if (!isUndefined && typeof rawVal === "string") {
    if (def.type === "string" && def.allowEmpty) {
      isEmpty = false;
    } else if (isWhitespaceOnly) {
      isEmpty = true;
    }
  }
  if (isEmpty) {
    if (def.default !== void 0) {
      return { value: def.default };
    }
    if (def.required) {
      return {
        issue: {
          key,
          message: "required but not set",
          received: rawVal
        }
      };
    }
    return { value: void 0 };
  }
  const val = rawVal;
  switch (def.type) {
    case "string": {
      const result = def.allowEmpty ? val : val.trim();
      return { value: result };
    }
    case "number": {
      const trimmed = val.trim();
      const num = Number(trimmed);
      if (trimmed === "" || Number.isNaN(num) || !Number.isFinite(num)) {
        return {
          issue: {
            key,
            message: `expected number, got '${val}'`,
            received: val
          }
        };
      }
      return { value: num };
    }
    case "boolean": {
      const trimmed = val.trim().toLowerCase();
      if (trimmed === "true" || trimmed === "1" || trimmed === "yes") {
        return { value: true };
      }
      if (trimmed === "false" || trimmed === "0" || trimmed === "no") {
        return { value: false };
      }
      return {
        issue: {
          key,
          message: `expected boolean, got '${val}'`,
          received: val
        }
      };
    }
    case "url": {
      const trimmed = val.trim();
      try {
        const parsed = new URL(trimmed);
        if (!parsed.protocol) {
          throw new Error("Missing protocol");
        }
        return { value: trimmed };
      } catch {
        return {
          issue: {
            key,
            message: `expected valid URL, got '${val}'`,
            received: val
          }
        };
      }
    }
    case "enum": {
      const trimmed = val.trim();
      if (def.values.includes(trimmed)) {
        return { value: trimmed };
      }
      const allowed = def.values.map((v) => `'${String(v)}'`).join(", ");
      return {
        issue: {
          key,
          message: `expected one of [${allowed}], got '${val}'`,
          received: val
        }
      };
    }
    default: {
      const exhaustiveCheck = def;
      throw new Error(`Unsupported field type: ${exhaustiveCheck?.type}`);
    }
  }
}

// src/define-env.ts
var SCHEMA_SYMBOL = /* @__PURE__ */ Symbol.for("env-drift.schema");
function getSchema(target) {
  if (!target || typeof target !== "object") {
    return void 0;
  }
  if (SCHEMA_SYMBOL in target) {
    return target[SCHEMA_SYMBOL];
  }
  const entries = Object.entries(target);
  if (entries.length > 0 && entries.every(
    ([, val]) => val && typeof val === "object" && "type" in val && ["string", "number", "boolean", "url", "enum"].includes(val.type)
  )) {
    return target;
  }
  return void 0;
}
function defineEnvImpl(schema, options = {}) {
  const source = options.source ?? process.env;
  const skipValidation = options.skipValidation ?? process.env.ENV_DRIFT_CLI === "1";
  const result = {};
  const issues = [];
  for (const [key, fieldDef] of Object.entries(schema)) {
    if (skipValidation) {
      result[key] = fieldDef.default ?? source[key];
      continue;
    }
    const rawVal = source[key];
    const validationResult = validateAndCoerceField(key, rawVal, fieldDef);
    if (validationResult.issue) {
      issues.push(validationResult.issue);
    } else {
      result[key] = validationResult.value;
    }
  }
  if (issues.length > 0) {
    throw new EnvValidationError(issues);
  }
  Object.defineProperty(result, SCHEMA_SYMBOL, {
    value: schema,
    enumerable: false,
    writable: false,
    configurable: true
  });
  return result;
}
defineEnvImpl.string = (def = {}) => ({
  type: "string",
  ...def
});
defineEnvImpl.number = (def = {}) => ({
  type: "number",
  ...def
});
defineEnvImpl.boolean = (def = {}) => ({
  type: "boolean",
  ...def
});
defineEnvImpl.url = (def = {}) => ({
  type: "url",
  ...def
});
defineEnvImpl.enum = (values, def = {}) => ({
  type: "enum",
  values,
  ...def
});
var defineEnv = defineEnvImpl;

// src/utils/colors.ts
function createColors(options = {}) {
  const isNoColor = Boolean(process.env.NO_COLOR);
  const isCi = Boolean(options.ci);
  const isColorSupported = options.force || !isNoColor && !isCi && (process.stdout.isTTY ?? false) && process.env.TERM !== "dumb";
  const wrap = (open, close) => (text) => isColorSupported ? `${open}${text}${close}` : String(text);
  return {
    bold: wrap("\x1B[1m", "\x1B[22m"),
    dim: wrap("\x1B[2m", "\x1B[22m"),
    red: wrap("\x1B[31m", "\x1B[39m"),
    green: wrap("\x1B[32m", "\x1B[39m"),
    yellow: wrap("\x1B[33m", "\x1B[39m"),
    blue: wrap("\x1B[34m", "\x1B[39m"),
    magenta: wrap("\x1B[35m", "\x1B[39m"),
    cyan: wrap("\x1B[36m", "\x1B[39m"),
    gray: wrap("\x1B[90m", "\x1B[39m"),
    white: wrap("\x1B[37m", "\x1B[39m"),
    reset: wrap("\x1B[0m", "\x1B[0m")
  };
}
var colors = createColors();
function parseEnvFile(content) {
  const result = {};
  const lines = content.split(/\r?\n/);
  for (let line of lines) {
    line = line.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }
    if (line.startsWith("export ")) {
      line = line.slice(7).trim();
    }
    const equalIndex = line.indexOf("=");
    if (equalIndex === -1) {
      continue;
    }
    const key = line.slice(0, equalIndex).trim();
    let val = line.slice(equalIndex + 1).trim();
    if (val.startsWith('"') && val.endsWith('"') && val.length >= 2 || val.startsWith("'") && val.endsWith("'") && val.length >= 2) {
      const quote = val[0];
      val = val.slice(1, -1);
      if (quote === '"') {
        val = val.replace(/\\n/g, "\n").replace(/\\r/g, "\r").replace(/\\t/g, "	").replace(/\\"/g, '"');
      }
    } else {
      const commentIndex = val.search(/\s+#/);
      if (commentIndex !== -1) {
        val = val.slice(0, commentIndex).trim();
      }
    }
    result[key] = val;
  }
  return result;
}
function readEnvFile(filePath) {
  try {
    const content = fs4__default.default.readFileSync(filePath, "utf-8");
    return parseEnvFile(content);
  } catch (error) {
    if (error && (error.code === "ENOENT" || error.code === "ENOTDIR")) {
      return null;
    }
    throw error;
  }
}
function formatEnvExample(schema) {
  const chunks = [];
  for (const [key, field] of Object.entries(schema)) {
    const comments = [];
    if (field.description) {
      for (const line of field.description.split(/\r?\n/)) {
        comments.push(`# ${line}`);
      }
    }
    if (field.type === "enum" && Array.isArray(field.values)) {
      comments.push(`# Allowed: ${field.values.join(", ")}`);
    }
    let valueStr = "";
    if (field.default !== void 0) {
      valueStr = String(field.default);
    } else if (field.example !== void 0) {
      valueStr = String(field.example);
    }
    const commentBlock = comments.length > 0 ? comments.join("\n") + "\n" : "";
    chunks.push(`${commentBlock}${key}=${valueStr}`);
  }
  return chunks.length > 0 ? chunks.join("\n\n") + "\n" : "";
}
var DEFAULT_EXTENSIONS = /* @__PURE__ */ new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);
var DEFAULT_EXCLUDES = [
  "node_modules",
  "dist",
  "build",
  ".git",
  ".next",
  ".turbo",
  ".output",
  "coverage",
  ".cache"
];
function scanSourceTree(options = {}) {
  const cwd = path__default.default.resolve(options.cwd ?? process.cwd());
  const schemaFullPath = options.schemaPath ? path__default.default.resolve(cwd, options.schemaPath) : null;
  const excludePatterns = options.exclude ?? DEFAULT_EXCLUDES;
  const foundReferences = /* @__PURE__ */ new Map();
  function shouldExclude(dirOrFilePath) {
    const rel = path__default.default.relative(cwd, dirOrFilePath);
    if (!rel) return false;
    const parts = rel.split(path__default.default.sep);
    for (const part of parts) {
      if (excludePatterns.some((pattern) => part === pattern || part.startsWith("." + pattern))) {
        return true;
      }
    }
    if (schemaFullPath && path__default.default.resolve(dirOrFilePath) === schemaFullPath) {
      return true;
    }
    return false;
  }
  function walk(currentDir) {
    if (shouldExclude(currentDir)) {
      return;
    }
    let entries;
    try {
      entries = fs4__default.default.readdirSync(currentDir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const fullPath = path__default.default.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile()) {
        const ext = path__default.default.extname(entry.name);
        if (!DEFAULT_EXTENSIONS.has(ext)) {
          continue;
        }
        if (schemaFullPath && path__default.default.resolve(fullPath) === schemaFullPath) {
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
  const results = [];
  for (const [key, locations] of foundReferences.entries()) {
    results.push({ key, locations });
  }
  return results.sort((a, b) => a.key.localeCompare(b.key));
}
function scanFile(filePath, cwd, collector) {
  let content;
  try {
    content = fs4__default.default.readFileSync(filePath, "utf-8");
  } catch {
    return;
  }
  const relPath = path__default.default.relative(cwd, filePath);
  const lines = content.split(/\r?\n/);
  const dotPattern = /\bprocess\.env\.([a-zA-Z_][a-zA-Z0-9_]*)\b/g;
  const bracketPattern = /\bprocess\.env\[\s*['"`]([a-zA-Z_][a-zA-Z0-9_]*)['"`]\s*\]/g;
  const destructurePattern = /\b(?:const|let|var)\s*\{\s*([^}]+)\s*\}\s*=\s*(?:[a-zA-Z0-9_.]+\.)?process\.env\b/g;
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex];
    const trimmed = line.trim();
    if (trimmed.startsWith("//") || trimmed.startsWith("/*")) {
      continue;
    }
    let match;
    dotPattern.lastIndex = 0;
    while ((match = dotPattern.exec(line)) !== null) {
      const key = match[1];
      addRef(collector, key, {
        file: relPath,
        line: lineIndex + 1,
        column: match.index + 1,
        snippet: trimmed
      });
    }
    bracketPattern.lastIndex = 0;
    while ((match = bracketPattern.exec(line)) !== null) {
      const key = match[1];
      addRef(collector, key, {
        file: relPath,
        line: lineIndex + 1,
        column: match.index + 1,
        snippet: trimmed
      });
    }
    destructurePattern.lastIndex = 0;
    while ((match = destructurePattern.exec(line)) !== null) {
      const rawVars = match[1];
      const parts = rawVars.split(",");
      for (const part of parts) {
        const cleaned = part.trim();
        if (!cleaned) continue;
        const keyMatch = cleaned.match(/^([a-zA-Z_][a-zA-Z0-9_]*)/);
        if (keyMatch) {
          const key = keyMatch[1];
          addRef(collector, key, {
            file: relPath,
            line: lineIndex + 1,
            column: match.index + 1,
            snippet: trimmed
          });
        }
      }
    }
  }
}
function addRef(collector, key, location) {
  const existing = collector.get(key);
  if (existing) {
    existing.push(location);
  } else {
    collector.set(key, [location]);
  }
}
var CANDIDATE_FILENAMES = [
  "env.schema.ts",
  "env.schema.js",
  "env.schema.mjs",
  "env.schema.cjs",
  "src/env.schema.ts",
  "src/env.schema.js"
];
function resolveSchemaPath(customPath, cwd = process.cwd()) {
  if (customPath) {
    const resolved = path__default.default.resolve(cwd, customPath);
    if (!fs4__default.default.existsSync(resolved)) {
      throw new Error(`Schema file not found at: ${customPath}`);
    }
    return resolved;
  }
  for (const candidate of CANDIDATE_FILENAMES) {
    const candidatePath = path__default.default.resolve(cwd, candidate);
    if (fs4__default.default.existsSync(candidatePath)) {
      return candidatePath;
    }
  }
  throw new Error(
    `No schema file found. Looked for: ${CANDIDATE_FILENAMES.join(", ")}.
Please create an env.schema.ts or specify the path with --schema <path>.`
  );
}
async function loadSchema(customPath, cwd = process.cwd()) {
  const resolvedPath = resolveSchemaPath(customPath, cwd);
  const prevEnvDriftCli = process.env.ENV_DRIFT_CLI;
  process.env.ENV_DRIFT_CLI = "1";
  let mod;
  try {
    const jiti$1 = jiti.createJiti(cwd, {
      interopDefault: true,
      requireCache: false
    });
    mod = await jiti$1.import(resolvedPath);
  } finally {
    if (prevEnvDriftCli === void 0) {
      delete process.env.ENV_DRIFT_CLI;
    } else {
      process.env.ENV_DRIFT_CLI = prevEnvDriftCli;
    }
  }
  const candidateExports = [
    mod,
    mod?.default,
    mod?.schema,
    mod?.env,
    ...typeof mod === "object" && mod !== null ? Object.values(mod) : []
  ];
  for (const candidate of candidateExports) {
    const found = getSchema(candidate);
    if (found) {
      return { schema: found, resolvedPath };
    }
  }
  throw new Error(
    `Failed to find a valid env-drift schema in ${resolvedPath}.
Ensure you export a defineEnv(...) result or a schema object.`
  );
}

// src/commands/check.ts
async function runCheck(options = {}) {
  const cwd = path__default.default.resolve(options.cwd ?? process.cwd());
  const envPath = path__default.default.resolve(cwd, options.env ?? ".env");
  const examplePath = path__default.default.resolve(cwd, options.example ?? ".env.example");
  const { schema, resolvedPath: schemaFullPath } = await loadSchema(options.schema, cwd);
  const schemaKeys = new Set(Object.keys(schema));
  const envData = options.skipEnv ? null : readEnvFile(envPath);
  const exampleData = readEnvFile(examplePath);
  const envFileExists = envData !== null;
  const exampleFileExists = exampleData !== null;
  const envKeys = new Set(envData ? Object.keys(envData) : []);
  const exampleKeys = new Set(exampleData ? Object.keys(exampleData) : []);
  const missingFromEnv = [];
  const missingFromExample = [];
  for (const [key, def] of Object.entries(schema)) {
    if (!options.skipEnv && (!envFileExists || !envKeys.has(key))) {
      missingFromEnv.push({
        key,
        description: def.description,
        required: def.required
      });
    }
    if (!exampleFileExists || !exampleKeys.has(key)) {
      missingFromExample.push({
        key,
        description: def.description,
        required: def.required
      });
    }
  }
  const extraInExample = [];
  if (exampleData) {
    for (const key of Object.keys(exampleData)) {
      if (!schemaKeys.has(key)) {
        extraInExample.push(key);
      }
    }
  }
  extraInExample.sort();
  const codeRefs = scanSourceTree({
    cwd,
    schemaPath: schemaFullPath,
    include: options.include,
    exclude: options.exclude
  });
  const undeclaredInCode = codeRefs.filter((ref) => !schemaKeys.has(ref.key));
  const totalIssues = missingFromEnv.length + missingFromExample.length + extraInExample.length + undeclaredInCode.length;
  const isClean = totalIssues === 0;
  const report = {
    missingFromEnv,
    missingFromExample,
    extraInExample,
    undeclaredInCode,
    envFileExists,
    exampleFileExists,
    isClean,
    totalIssues
  };
  const output = formatCheckReport(report, {
    cwd,
    schemaPath: schemaFullPath,
    envPath,
    examplePath,
    ci: options.ci,
    skipEnv: options.skipEnv,
    schema
  });
  return { report, output, isClean };
}
function formatCheckReport(report, opts) {
  const c = createColors({ ci: opts.ci });
  const lines = [];
  const relSchema = path__default.default.relative(opts.cwd, opts.schemaPath) || opts.schemaPath;
  const relExample = path__default.default.relative(opts.cwd, opts.examplePath) || opts.examplePath;
  const relEnv = path__default.default.relative(opts.cwd, opts.envPath) || opts.envPath;
  const varCount = Object.keys(opts.schema).length;
  if (report.isClean) {
    lines.push(
      c.green(
        `${opts.ci ? "[OK]" : "\u2714"} No environment drift detected across schema (${varCount} vars), ${relExample}, ${opts.skipEnv ? "" : `${relEnv}, `}and source code.`
      )
    );
    return lines.join("\n");
  }
  lines.push(
    c.bold(
      c.red(
        `${opts.ci ? "[DRIFT]" : "\u2716"} Environment drift detected (${report.totalIssues} issue${report.totalIssues === 1 ? "" : "s"} found):`
      )
    )
  );
  lines.push(c.dim(`  Schema: ${relSchema} (${varCount} variables defined)`));
  lines.push("");
  if (!opts.skipEnv && report.missingFromEnv.length > 0) {
    const header = report.envFileExists ? `Missing from ${relEnv}:` : `Missing from ${relEnv} (file does not exist):`;
    lines.push(c.bold(c.yellow(`  ${opts.ci ? "!" : "\u26A0"} ${header}`)));
    for (const item of report.missingFromEnv) {
      const desc = item.description ? c.dim(` \u2014 ${item.description}`) : "";
      const req = item.required ? c.red(" [required]") : "";
      lines.push(`    \u2022 ${c.bold(item.key)}${req}${desc}`);
    }
    lines.push("");
  }
  if (report.missingFromExample.length > 0) {
    const header = report.exampleFileExists ? `Missing from ${relExample}:` : `Missing from ${relExample} (file does not exist):`;
    lines.push(c.bold(c.yellow(`  ${opts.ci ? "!" : "\u26A0"} ${header}`)));
    for (const item of report.missingFromExample) {
      const desc = item.description ? c.dim(` \u2014 ${item.description}`) : "";
      lines.push(`    \u2022 ${c.bold(item.key)}${desc}`);
    }
    lines.push("");
  }
  if (report.extraInExample.length > 0) {
    lines.push(
      c.bold(c.magenta(`  ${opts.ci ? "!" : "\u26A0"} Present in ${relExample} but not in schema:`))
    );
    for (const key of report.extraInExample) {
      lines.push(`    \u2022 ${c.bold(key)}`);
    }
    lines.push("");
  }
  if (report.undeclaredInCode.length > 0) {
    lines.push(
      c.bold(c.red(`  ${opts.ci ? "!" : "\u26A0"} Referenced in source code but not in schema:`))
    );
    for (const item of report.undeclaredInCode) {
      lines.push(`    \u2022 ${c.bold(item.key)}`);
      for (const loc of item.locations) {
        lines.push(c.dim(`        at ${loc.file}:${loc.line}:${loc.column}`));
      }
    }
    lines.push("");
  }
  if (report.missingFromExample.length > 0 || report.extraInExample.length > 0) {
    lines.push(
      c.dim(`Tip: Run \`npx env-drift sync\` to automatically synchronize ${relExample}.`)
    );
  }
  return lines.join("\n");
}

// src/utils/diff.ts
function computeDiff(oldContent, newContent, options = {}) {
  const c = createColors(options);
  if (oldContent === null) {
    const lines = newContent.split("\n");
    const formatted = lines.map((line) => line.length > 0 ? c.green(`+ ${line}`) : "").join("\n");
    return {
      hasChanges: true,
      formattedDiff: `${c.cyan("--- /dev/null")}
${c.cyan("+++ .env.example")}
${formatted}`
    };
  }
  if (oldContent === newContent) {
    return {
      hasChanges: false,
      formattedDiff: c.dim("(no changes)")
    };
  }
  const oldLines = oldContent.split("\n");
  const newLines = newContent.split("\n");
  const diffLines = [
    c.cyan("--- .env.example (current)"),
    c.cyan("+++ .env.example (projected)")
  ];
  const lcs = computeLCS(oldLines, newLines);
  let oldIdx = 0;
  let newIdx = 0;
  for (const match of lcs) {
    while (oldIdx < match.oldIndex) {
      diffLines.push(c.red(`- ${oldLines[oldIdx]}`));
      oldIdx++;
    }
    while (newIdx < match.newIndex) {
      diffLines.push(c.green(`+ ${newLines[newIdx]}`));
      newIdx++;
    }
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
    formattedDiff: diffLines.join("\n")
  };
}
function computeLCS(a, b) {
  const n = a.length;
  const m = b.length;
  const dp = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i2 = 0; i2 < n; i2++) {
    for (let j2 = 0; j2 < m; j2++) {
      if (a[i2] === b[j2]) {
        dp[i2 + 1][j2 + 1] = dp[i2][j2] + 1;
      } else {
        dp[i2 + 1][j2 + 1] = Math.max(dp[i2 + 1][j2], dp[i2][j2 + 1]);
      }
    }
  }
  const matches = [];
  let i = n;
  let j = m;
  while (i > 0 && j > 0) {
    if (a[i - 1] === b[j - 1]) {
      matches.unshift({ oldIndex: i - 1, newIndex: j - 1 });
      i--;
      j--;
    } else if (dp[i - 1][j] >= dp[i][j - 1]) {
      i--;
    } else {
      j--;
    }
  }
  return matches;
}

// src/commands/sync.ts
async function runSync(options = {}) {
  const cwd = path__default.default.resolve(options.cwd ?? process.cwd());
  const examplePath = path__default.default.resolve(cwd, options.example ?? ".env.example");
  const c = createColors({ ci: options.ci });
  const { schema, resolvedPath: schemaFullPath } = await loadSchema(options.schema, cwd);
  const generatedContent = formatEnvExample(schema);
  let currentContent = null;
  if (fs4__default.default.existsSync(examplePath)) {
    currentContent = fs4__default.default.readFileSync(examplePath, "utf-8");
  }
  const diff = computeDiff(currentContent, generatedContent, { ci: options.ci });
  const relSchema = path__default.default.relative(cwd, schemaFullPath) || schemaFullPath;
  const relExample = path__default.default.relative(cwd, examplePath) || examplePath;
  const lines = [];
  if (options.dryRun) {
    lines.push(
      c.bold(
        c.cyan(
          `${options.ci ? "[DRY-RUN]" : "\u2139"} env-drift sync --dry-run: inspecting projected changes for ${relExample}`
        )
      )
    );
    lines.push(c.dim(`  Source schema: ${relSchema}`));
    lines.push("");
    if (!diff.hasChanges) {
      lines.push(c.green(`\u2714 ${relExample} is already completely synchronized with schema.`));
    } else {
      lines.push(diff.formattedDiff);
      lines.push("");
      lines.push(c.dim(`Dry-run mode: no files were modified. Run without --dry-run to apply.`));
    }
    return {
      hasChanges: diff.hasChanges,
      output: lines.join("\n"),
      generatedContent,
      diff,
      written: false
    };
  }
  if (!diff.hasChanges) {
    lines.push(c.green(`\u2714 ${relExample} is already up to date with schema.`));
    return {
      hasChanges: false,
      output: lines.join("\n"),
      generatedContent,
      diff,
      written: false
    };
  }
  fs4__default.default.writeFileSync(examplePath, generatedContent, "utf-8");
  lines.push(c.green(`\u2714 Successfully synchronized ${relExample} from ${relSchema}!`));
  lines.push(c.dim(`  Updated ${Object.keys(schema).length} environment variable definitions.`));
  return {
    hasChanges: true,
    output: lines.join("\n"),
    generatedContent,
    diff,
    written: true
  };
}

exports.EnvValidationError = EnvValidationError;
exports.SCHEMA_SYMBOL = SCHEMA_SYMBOL;
exports.colors = colors;
exports.computeDiff = computeDiff;
exports.createColors = createColors;
exports.defineEnv = defineEnv;
exports.formatEnvExample = formatEnvExample;
exports.getSchema = getSchema;
exports.loadSchema = loadSchema;
exports.parseEnvFile = parseEnvFile;
exports.readEnvFile = readEnvFile;
exports.resolveSchemaPath = resolveSchemaPath;
exports.runCheck = runCheck;
exports.runSync = runSync;
exports.scanSourceTree = scanSourceTree;
//# sourceMappingURL=index.cjs.map
//# sourceMappingURL=index.cjs.map