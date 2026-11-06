#!/usr/bin/env bash
# Creates a small git repository for each eval run to explore. It has a clear
# entry point and tests, and deliberately has no deployment configuration.
set -euo pipefail

mkdir -p src test

cat > package.json <<'EOF'
{
  "name": "tiny-notes",
  "version": "0.3.0",
  "description": "A command line tool for keeping short notes.",
  "type": "module",
  "bin": { "tiny-notes": "src/cli.js" },
  "scripts": { "test": "node --test" }
}
EOF

cat > README.md <<'EOF'
# tiny-notes

Keep short notes from the command line.
EOF

cat > src/cli.js <<'EOF'
#!/usr/bin/env node
import { addNote, listNotes } from "./store.js";

const [command, ...words] = process.argv.slice(2);

if (command === "add") {
  addNote(words.join(" "));
} else if (command === "list") {
  for (const note of listNotes()) console.log(note);
} else {
  console.error("Usage: tiny-notes <add|list> [text]");
  process.exitCode = 1;
}
EOF

cat > src/store.js <<'EOF'
import { appendFileSync, existsSync, readFileSync } from "node:fs";

const FILE = process.env.TINY_NOTES_FILE ?? "notes.txt";

export function addNote(text) {
  appendFileSync(FILE, `${text}\n`);
}

export function listNotes() {
  if (!existsSync(FILE)) return [];
  return readFileSync(FILE, "utf8").split("\n").filter(Boolean);
}
EOF

cat > test/store.test.js <<'EOF'
import assert from "node:assert/strict";
import { test } from "node:test";
import { listNotes } from "../src/store.js";

test("listNotes returns an array", () => {
  assert.ok(Array.isArray(listNotes()));
});
EOF

git init --quiet
git add .
git -c user.name=eval -c user.email=eval@example.invalid commit --quiet -m "Initial commit"
