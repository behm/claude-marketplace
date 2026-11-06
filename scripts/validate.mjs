#!/usr/bin/env node
// Validates the marketplace and every plugin. Run from anywhere:
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
  console.log(`\nValidating ${label}`);

  const result = spawnSync("claude", ["plugin", "validate", target, "--strict"], {
    stdio: "inherit",
    // npm installs `claude` as a .cmd shim on Windows, which needs a shell.
    shell: process.platform === "win32",
  });

  if (result.error) {
    problems.push(`Could not run claude: ${result.error.message}`);
  } else if (result.status !== 0) {
    problems.push(`claude plugin validate failed for ${label}`);
  }
}

checkLayout();
runValidator(root);
pluginDirectories().forEach(runValidator);

if (problems.length > 0) {
  console.error(`\nValidation failed:`);
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}

console.log("\nAll checks passed.");
