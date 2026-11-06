#!/usr/bin/env node
// PreToolUse hook entry point. Reads the tool call from stdin and prints a deny
// decision if a rule blocks it. If the hook itself fails, the call goes ahead:
// these rules catch mistakes, so a bug here shouldn't stop all work.

import { readFileSync } from "node:fs";
import { findBlockReason } from "./rules.mjs";

try {
  const reason = findBlockReason(JSON.parse(readFileSync(0, "utf8")));
  if (reason) {
    console.log(
      JSON.stringify({
        hookSpecificOutput: {
          hookEventName: "PreToolUse",
          permissionDecision: "deny",
          permissionDecisionReason:
            `Blocked by the guardrails plugin: ${reason} ` +
            "Don't try to get around this. If it's really needed, ask the user " +
            "to do it themselves.",
        },
      }),
    );
  }
} catch (error) {
  console.error(`guardrails hook skipped: ${error.message}`);
}
