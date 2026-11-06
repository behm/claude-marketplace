import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { after, before, describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { findBlockReason, isProtectedEnvFile, parseCommands } from "./rules.mjs";

const hookPath = join(dirname(fileURLToPath(import.meta.url)), "guard.mjs");

function git(cwd, ...args) {
  execFileSync(
    "git",
    ["-c", "user.name=test", "-c", "user.email=test@example.invalid", "-C", cwd, ...args],
    { stdio: "ignore" },
  );
}

function bash(command, cwd) {
  return findBlockReason({ tool_name: "Bash", tool_input: { command }, cwd });
}

function powershell(command, cwd) {
  return findBlockReason({ tool_name: "PowerShell", tool_input: { command }, cwd });
}

describe("force pushes", () => {
  const cwd = tmpdir();

  for (const command of [
    "git push --force",
    "git push -f origin my-branch",
    "git push -uf origin my-branch",
    "git push --force-with-lease",
    "git push --force-with-lease=main:abc123",
    "git push origin +my-branch",
    "git -C some/dir push --force",
    "git -c core.quotepath=false push -f",
    "/usr/bin/git push -f",
    "git.exe push -f",
    "npm test && git push --force",
    "(git push --force)",
    "echo $(git push --force)",
    'echo "$(git push --force)"',
    'bash -c "git push --force"',
    "sh -c 'npm test && git push -f'",
    "eval git push -f",
    "FOO=bar git push -f",
    "sudo git push -f",
    "if true; then git push -f; fi",
    "git \\\n  push \\\n  --force",
  ]) {
    it(`blocks: ${command}`, () => assert.match(bash(command, cwd), /force push/));
  }

  it("blocks them in PowerShell", () => {
    assert.match(powershell("git push --force", cwd), /force push/);
    assert.match(powershell("npm test; git push -f", cwd), /force push/);
    assert.match(powershell('pwsh -Command "git push -f"', cwd), /force push/);
  });

  for (const command of [
    "git push",
    "git push -u origin my-branch",
    "git push origin my-branch",
    "git push --force --dry-run",
    "git push --help",
    'echo "git push --force"',
    "echo git push --force",
    "# git push --force",
    "grep -r 'git push --force' .",
    'git commit --allow-empty -m "docs: never git push --force"',
    "git log --grep=--force",
    "cat <<'EOF'\ngit push --force\nEOF",
    'git commit -m "$(cat <<\'EOF\'\nDon\'t "git push --force" (ever)\n\ngit push --force\nEOF\n)"',
    "cat <<-EOF\n\tgit push -f\n\tEOF\necho done",
  ]) {
    it(`allows: ${command.replaceAll("\n", "\\n")}`, () => {
      const onBranch = bash(command, cwd);
      assert.equal(onBranch?.includes("force push") ?? false, false);
    });
  }

  it("ignores PowerShell here-strings", () => {
    const command = "git log --format=@'\ndon't\ngit push --force\n'@\necho done";
    assert.equal(powershell(command, cwd), null);
  });

  it("still sees commands after a heredoc", () => {
    assert.match(bash("cat <<EOF\nhello\nEOF\ngit push -f", cwd), /force push/);
  });
});

describe("commits to the default branch", () => {
  let repo;

  before(() => {
    repo = mkdtempSync(join(tmpdir(), "guardrails-"));
    git(repo, "init", "-b", "master");
    git(repo, "commit", "--allow-empty", "-m", "base");
    git(repo, "branch", "feature");
  });

  after(() => rmSync(repo, { recursive: true, force: true }));

  it("blocks a commit on master", () => {
    assert.match(bash('git commit -m "x"', repo), /default branch \(master\)/);
    assert.match(powershell('git commit -m "x"', repo), /default branch \(master\)/);
  });

  it("blocks when -C or cd points at the repo", () => {
    const cwd = tmpdir();
    assert.match(bash(`git -C "${repo}" commit -m x`, cwd), /default branch/);
    assert.match(bash(`cd "${repo}" && git commit -m x`, cwd), /default branch/);
    assert.match(powershell(`Set-Location '${repo}'; git commit -m x`, cwd), /default branch/);
  });

  it("allows a commit after switching to a new branch in the same command", () => {
    assert.equal(bash("git switch -c new-work && git commit -m x", repo), null);
    assert.equal(bash("git checkout -b new-work && git commit -m x", repo), null);
    assert.equal(bash("git switch feature && git commit -m x", repo), null);
  });

  it("blocks a commit after switching to the default branch", () => {
    assert.match(bash("git switch main && git commit -m x", repo), /default branch \(main\)/);
  });

  it("allows a dry run and help", () => {
    assert.equal(bash("git commit --dry-run", repo), null);
    assert.equal(bash("git commit --help", repo), null);
  });

  it("allows other git commands on master", () => {
    assert.equal(bash("git status && git add . && git log", repo), null);
  });

  it("uses the branch that origin marks as default", () => {
    const other = mkdtempSync(join(tmpdir(), "guardrails-"));
    try {
      git(other, "init", "-b", "trunk");
      git(other, "commit", "--allow-empty", "-m", "base");
      git(other, "update-ref", "refs/remotes/origin/trunk", "HEAD");
      git(other, "symbolic-ref", "refs/remotes/origin/HEAD", "refs/remotes/origin/trunk");
      assert.match(bash("git commit -m x", other), /default branch \(trunk\)/);
    } finally {
      rmSync(other, { recursive: true, force: true });
    }
  });

  it("allows a commit on a feature branch", () => {
    const other = mkdtempSync(join(tmpdir(), "guardrails-"));
    try {
      git(other, "init", "-b", "master");
      git(other, "commit", "--allow-empty", "-m", "base");
      git(other, "switch", "-c", "feature");
      assert.equal(bash("git commit -m x", other), null);
    } finally {
      rmSync(other, { recursive: true, force: true });
    }
  });

  it("allows the first commit in a new repo", () => {
    const other = mkdtempSync(join(tmpdir(), "guardrails-"));
    try {
      git(other, "init", "-b", "master");
      assert.equal(bash("git commit -m first", other), null);
    } finally {
      rmSync(other, { recursive: true, force: true });
    }
  });

  it("allows a commit outside a repo", () => {
    const other = mkdtempSync(join(tmpdir(), "guardrails-"));
    try {
      assert.equal(bash("git commit -m x", other), null);
    } finally {
      rmSync(other, { recursive: true, force: true });
    }
  });
});

describe(".env files", () => {
  const cwd = tmpdir();

  for (const path of [".env", ".env.local", ".ENV", "/app/.env.production", "C:\\app\\.env"]) {
    it(`protects ${path}`, () => assert.equal(isProtectedEnvFile(path), true));
  }

  for (const path of [
    ".env.example",
    ".env.sample",
    ".env.template",
    ".env.dist",
    "env",
    ".environment",
    "my.env.js",
    "C:\\.env\\config.json",
  ]) {
    it(`doesn't protect ${path}`, () => assert.equal(isProtectedEnvFile(path), false));
  }

  it("blocks the Edit and Write tools", () => {
    for (const tool of ["Edit", "Write"]) {
      const input = { tool_name: tool, tool_input: { file_path: "C:\\app\\.env" }, cwd };
      assert.match(findBlockReason(input), /\.env file/);
    }
  });

  it("allows other files with the Edit and Write tools", () => {
    const input = { tool_name: "Write", tool_input: { file_path: "/app/.env.example" }, cwd };
    assert.equal(findBlockReason(input), null);
  });

  for (const command of [
    "echo KEY=1 > .env",
    "echo KEY=1 >> .env.local",
    "echo KEY=1 &> .env",
    "echo KEY=1 2> .env",
    "echo KEY=1 | tee .env",
    "echo KEY=1>.env",
  ]) {
    it(`blocks: ${command}`, () => assert.match(bash(command, cwd), /\.env/));
  }

  it("blocks PowerShell writes", () => {
    assert.match(powershell("Set-Content .env 'KEY=1'", cwd), /\.env/);
    assert.match(powershell("'KEY=1' | Out-File -FilePath C:\\app\\.env", cwd), /\.env/);
    assert.match(powershell("'KEY=1' > C:\\app\\.env", cwd), /\.env/);
  });

  for (const command of [
    "cat .env",
    "cat < .env",
    "echo KEY=1 > .env.example",
    "cat .env.example > out.txt",
    "npm test 2>&1",
    "npm test > out.log 2>&1",
    'echo "> .env"',
  ]) {
    it(`allows: ${command}`, () => assert.equal(bash(command, cwd), null));
  }
});

describe("parseCommands", () => {
  it("splits on shell operators", () => {
    const words = parseCommands("a 1 && b 2 || c; d | e & f\ng").map((c) => c.words[0]);
    assert.deepEqual(words, ["a", "b", "c", "d", "e", "f", "g"]);
  });

  it("joins quoted and unquoted text into one word", () => {
    assert.deepEqual(parseCommands(`echo a"b c"'d e'f`)[0].words, ["echo", "ab cd ef"]);
  });

  it("keeps PowerShell paths intact", () => {
    assert.deepEqual(parseCommands("cat C:\\app\\file", "powershell")[0].words, ["cat", "C:\\app\\file"]);
  });

  it("handles unterminated quotes without failing", () => {
    assert.deepEqual(parseCommands(`echo "abc`)[0].words, ["echo", "abc"]);
    assert.deepEqual(parseCommands("echo 'abc")[0].words, ["echo", "abc"]);
  });
});

describe("hook process", () => {
  function runHook(stdin) {
    return spawnSync(process.execPath, [hookPath], { input: stdin, encoding: "utf8" });
  }

  it("prints a deny decision for a blocked call", () => {
    const input = { tool_name: "Bash", tool_input: { command: "git push -f" }, cwd: tmpdir() };
    const result = runHook(JSON.stringify(input));
    const { hookSpecificOutput: output } = JSON.parse(result.stdout);
    assert.equal(result.status, 0);
    assert.equal(output.hookEventName, "PreToolUse");
    assert.equal(output.permissionDecision, "deny");
    assert.match(output.permissionDecisionReason, /guardrails plugin/);
  });

  it("prints nothing for an allowed call", () => {
    const input = { tool_name: "Bash", tool_input: { command: "npm test" }, cwd: tmpdir() };
    const result = runHook(JSON.stringify(input));
    assert.equal(result.status, 0);
    assert.equal(result.stdout, "");
  });

  it("lets the call go ahead if the input can't be read", () => {
    const result = runHook("not json");
    assert.equal(result.status, 0);
    assert.equal(result.stdout, "");
    assert.match(result.stderr, /guardrails hook skipped/);
  });

  it("ignores other tools and missing fields", () => {
    for (const input of [{ tool_name: "Read", tool_input: {} }, { tool_name: "Bash" }, { tool_name: "Write" }]) {
      const result = runHook(JSON.stringify(input));
      assert.equal(result.status, 0);
      assert.equal(result.stdout, "");
    }
  });
});
