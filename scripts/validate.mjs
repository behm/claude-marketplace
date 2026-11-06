#!/usr/bin/env node
// Validates the marketplace and every plugin, and runs each plugin's *.test.mjs
// files. Run from anywhere:
//   node scripts/validate.mjs
//
// `claude plugin validate` does not check that a plugin's `source` exists or
// that every folder under plugins/ is listed, so those checks are done here.

import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const pluginsDir = join(root, "plugins");
const problems = [];

// Warnings fail validation, as with `claude plugin validate --strict`, except
// this one: plugins omit `version` on purpose so users track commits.
const ALLOWED_WARNING = /^No version specified\./;

function pluginDirectories() {
  if (!existsSync(pluginsDir)) return [];
  return readdirSync(pluginsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => join(pluginsDir, entry.name));
}

function checkLayout() {
  let marketplace;
  try {
    marketplace = JSON.parse(
      readFileSync(join(root, ".claude-plugin", "marketplace.json"), "utf8"),
    );
  } catch (error) {
    // `claude plugin validate` reports the details for invalid JSON.
    problems.push(`Could not read marketplace.json: ${error.message}`);
    return;
  }

  const listed = new Set();
  for (const plugin of marketplace.plugins ?? []) {
    // Other source types, such as a GitHub repo, aren't local paths.
    if (typeof plugin.source !== "string") continue;

    const directory = resolve(root, plugin.source);
    listed.add(directory);
    if (!existsSync(directory) || !statSync(directory).isDirectory()) {
      problems.push(
        `Plugin "${plugin.name}": source "${plugin.source}" is not a directory`,
      );
    }
  }

  for (const directory of pluginDirectories()) {
    if (!listed.has(directory)) {
      const path = relative(root, directory).replaceAll("\\", "/");
      problems.push(`${path} is not listed in marketplace.json`);
    }
  }
}

function runValidator(target) {
  const label = relative(root, target).replaceAll("\\", "/") || ".";
  console.log(`Validating ${label}`);

  const result = spawnSync("claude", ["plugin", "validate", label, "--json"], {
    cwd: root,
    encoding: "utf8",
    // npm installs `claude` as a .cmd shim on Windows, which needs a shell.
    shell: process.platform === "win32",
  });

  if (result.error) {
    problems.push(`Could not run claude: ${result.error.message}`);
    return;
  }

  let report;
  try {
    report = JSON.parse(result.stdout);
  } catch {
    problems.push(
      `Could not read validator output for ${label}: ${result.stderr || result.stdout}`,
    );
    return;
  }

  const before = problems.length;
  for (const file of [report.manifest, ...(report.contents ?? [])]) {
    if (!file) continue;
    for (const { path, message } of file.errors ?? []) {
      problems.push(`${label}: ${path}: ${message}`);
    }
    for (const { path, message } of file.warnings ?? []) {
      if (!ALLOWED_WARNING.test(message)) {
        problems.push(`${label}: ${path}: ${message}`);
      }
    }
  }

  if (result.status !== 0 && problems.length === before) {
    problems.push(`claude plugin validate failed for ${label}`);
  }
}

function runTests() {
  const tests = readdirSync(pluginsDir, { recursive: true })
    .filter((path) => path.endsWith(".test.mjs"))
    .map((path) => join(pluginsDir, path));
  if (tests.length === 0) return;

  console.log("Running plugin tests");
  const result = spawnSync(process.execPath, ["--test", ...tests], {
    cwd: root,
    encoding: "utf8",
  });
  if (result.status !== 0) {
    console.error(result.stdout, result.stderr);
    problems.push("Plugin tests failed");
  }
}

checkLayout();
runValidator(root);
pluginDirectories().forEach(runValidator);
runTests();

if (problems.length > 0) {
  console.error(`\nValidation failed:`);
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}

console.log("All checks passed.");
