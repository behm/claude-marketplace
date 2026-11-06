// Rules for the guardrails hook. These catch mistakes and aren't a security
// boundary: a command that hides its intent can still get past them.

import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

// Splits shell source into simple commands, including ones nested in $(...) or
// (...). Text in quotes, heredocs, and comments is never treated as a command.
export function parseCommands(source, shell = "bash") {
  const commands = [];
  const escapeChar = shell === "powershell" ? "`" : "\\";

  function lex(start, nested) {
    let i = start;
    let words = [];
    let redirects = [];
    let word = null;
    let sink = "words";
    let heredocs = [];

    const endWord = () => {
      if (word !== null) {
        if (sink === "words") words.push(word);
        if (sink === "redirects") redirects.push(word);
        word = null;
        sink = "words";
      }
    };
    const endCommand = () => {
      endWord();
      if (words.length > 0 || redirects.length > 0) commands.push({ words, redirects });
      words = [];
      redirects = [];
      sink = "words";
    };
    const skipHeredocBodies = () => {
      for (const { delimiter, stripTabs } of heredocs) {
        while (i < source.length) {
          let end = source.indexOf("\n", i);
          if (end === -1) end = source.length;
          let line = source.slice(i, end).replace(/\r$/, "");
          if (stripTabs) line = line.replace(/^\t+/, "");
          i = Math.min(end + 1, source.length);
          if (line === delimiter) break;
        }
      }
      heredocs = [];
    };

    while (i < source.length) {
      const c = source[i];

      if (c === escapeChar) {
        if (source[i + 1] !== "\n" && source[i + 1] !== "\r") {
          word = (word ?? "") + (source[i + 1] ?? "");
        }
        i += source[i + 1] === "\r" ? 3 : 2;
      } else if (shell === "powershell" && (source.startsWith("@'", i) || source.startsWith('@"', i))) {
        const close = source.indexOf(`\n${source[i + 1]}@`, i);
        word = (word ?? "") + source.slice(i + 2, close === -1 ? source.length : close);
        i = close === -1 ? source.length : close + 3;
      } else if (c === "'") {
        const close = source.indexOf("'", i + 1);
        word = (word ?? "") + source.slice(i + 1, close === -1 ? source.length : close);
        i = close === -1 ? source.length : close + 1;
      } else if (c === '"') {
        word ??= "";
        i += 1;
        while (i < source.length && source[i] !== '"') {
          // In bash, a backslash in double quotes only escapes these characters,
          // which keeps Windows paths such as "C:\Users" intact.
          const escapes =
            source[i] === escapeChar && (shell === "powershell" || '$`"\\\n'.includes(source[i + 1]));
          if (escapes) {
            word += source[i + 1] ?? "";
            i += 2;
          } else if (source.startsWith("$(", i)) {
            i = lex(i + 2, true);
          } else {
            word += source[i];
            i += 1;
          }
        }
        i += 1;
      } else if (c === "#" && word === null) {
        while (i < source.length && source[i] !== "\n") i += 1;
      } else if (c === "\n") {
        endCommand();
        i += 1;
        skipHeredocBodies();
      } else if (c === "(") {
        if (word === "$") word = null;
        i = lex(i + 1, true);
      } else if (c === ")") {
        endCommand();
        i += 1;
        if (nested) return i;
      } else if (c === "&" && source[i + 1] === ">") {
        endWord();
        i += 1;
      } else if (c === ";" || c === "|" || c === "&") {
        endCommand();
        i += 1;
      } else if (c === ">") {
        if (word !== null && /^\d+$/.test(word)) word = null;
        endWord();
        while (">|&".includes(source[i])) i += 1;
        sink = "redirects";
      } else if (source.startsWith("<<<", i)) {
        endWord();
        i += 3;
        sink = "ignored";
      } else if (source.startsWith("<<", i)) {
        endWord();
        i += 2;
        const stripTabs = source[i] === "-";
        if (stripTabs) i += 1;
        while (source[i] === " " || source[i] === "\t") i += 1;
        const match = /^(['"]?)([^\s'"]+)\1/.exec(source.slice(i));
        if (match) {
          heredocs.push({ delimiter: match[2], stripTabs });
          i += match[0].length;
        }
      } else if (c === "<") {
        endWord();
        i += 1;
        sink = "ignored";
      } else if (/\s/.test(c)) {
        endWord();
        i += 1;
      } else {
        word = (word ?? "") + c;
        i += 1;
      }
    }

    endCommand();
    return i;
  }

  lex(0, false);
  return commands;
}

const WRAPPERS = new Set([
  "{", "!", "if", "then", "elif", "else", "while", "until", "do", "time", "command", "exec", "sudo", "env",
]);
const SHELLS = new Map([
  ["bash", "bash"], ["sh", "bash"], ["zsh", "bash"], ["dash", "bash"],
  ["pwsh", "powershell"], ["powershell", "powershell"],
]);
const WRITERS = new Set(["tee", "set-content", "add-content", "out-file", "sc", "ac"]);
const DIRECTORY_CHANGERS = new Set(["cd", "pushd", "set-location", "sl", "push-location"]);
const GIT_OPTIONS_WITH_VALUES = new Set(["-C", "-c", "--git-dir", "--work-tree", "--namespace"]);

function programName(word) {
  const name = word.replaceAll("\\", "/").split("/").pop().toLowerCase();
  return name.endsWith(".exe") ? name.slice(0, -4) : name;
}

function withoutWrappers(words) {
  let i = 0;
  while (
    i < words.length &&
    (WRAPPERS.has(words[i]) || /^[A-Za-z_]\w*=/.test(words[i]))
  ) {
    i += 1;
  }
  return words.slice(i);
}

function parseGit(args) {
  let directory = null;
  let i = 0;
  while (i < args.length && args[i].startsWith("-")) {
    if (args[i] === "-C") directory = args[i + 1] ?? null;
    i += GIT_OPTIONS_WITH_VALUES.has(args[i]) ? 2 : 1;
  }
  return { subcommand: args[i], args: args.slice(i + 1), directory };
}

function isForcePush(args) {
  if (args.includes("--dry-run") || args.includes("-n") || args.includes("--help")) return false;
  return args.some(
    (arg) =>
      arg === "--force" ||
      /^--force-with-lease(=|$)/.test(arg) ||
      /^-[A-Za-z0-9]*f[A-Za-z0-9]*$/.test(arg) ||
      (arg.startsWith("+") && arg.length > 1),
  );
}

// Returns the branch a `git switch` or `git checkout` moves to, if there is one.
function branchSwitchedTo({ subcommand, args }) {
  if (subcommand !== "switch" && subcommand !== "checkout") return null;
  const positional = [];
  for (let i = 0; i < args.length; i += 1) {
    if (["-c", "-C", "-b", "-B", "--create", "--force-create"].includes(args[i])) {
      return args[i + 1] ?? null;
    }
    if (args[i] === "--") return null;
    if (!args[i].startsWith("-")) positional.push(args[i]);
  }
  return positional.length === 1 ? positional[0] : null;
}

function git(directory, ...args) {
  try {
    return execFileSync("git", ["-C", directory, ...args], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 5000,
    }).trim();
  } catch {
    return null;
  }
}

function defaultBranches(directory) {
  const branches = new Set(["main", "master"]);
  const originHead = git(directory, "symbolic-ref", "--short", "refs/remotes/origin/HEAD");
  if (originHead) branches.add(originHead.replace(/^origin\//, ""));
  return branches;
}

function checkCommit(args, directory, switchedBranch) {
  if (args.includes("--dry-run") || args.includes("-h") || args.includes("--help")) return null;

  // A repo with no commits yet has no branch to protect, and its first commit
  // has nowhere else to go.
  if (switchedBranch === null && git(directory, "rev-parse", "--verify", "--quiet", "HEAD") === null) {
    return null;
  }

  const branch = switchedBranch ?? git(directory, "symbolic-ref", "--short", "HEAD");
  if (branch && defaultBranches(directory).has(branch)) {
    return `this would commit directly to the default branch (${branch}). Create a branch first.`;
  }
  return null;
}

export function isProtectedEnvFile(path) {
  const name = path.replaceAll("\\", "/").split("/").pop();
  return /^\.env(\..+)?$/i.test(name) && !/\.(example|sample|template|dist)$/i.test(name);
}

const envReason = (path) =>
  `${path} looks like a .env file, which can hold secrets. Edit a template such as .env.example, or ask the user to make this change.`;

function checkCommands(source, shell, cwd) {
  let directory = cwd;
  let switchedBranch = null;

  for (const { words, redirects } of parseCommands(source, shell)) {
    const envRedirect = redirects.find(isProtectedEnvFile);
    if (envRedirect) return envReason(envRedirect);

    const [first, ...args] = withoutWrappers(words);
    if (first === undefined) continue;
    const program = programName(first);

    if (DIRECTORY_CHANGERS.has(program)) {
      const target = args.find((arg) => !arg.startsWith("-"));
      if (target) directory = resolve(directory, target);
      switchedBranch = null;
    } else if (WRITERS.has(program)) {
      const envTarget = args.find(isProtectedEnvFile);
      if (envTarget) return envReason(envTarget);
    } else if (program === "eval") {
      const reason = checkCommands(args.join(" "), shell, directory);
      if (reason) return reason;
    } else if (SHELLS.has(program)) {
      const flag = args.findIndex((arg) => /^-(c|command)$/i.test(arg));
      if (flag !== -1 && args[flag + 1]) {
        const reason = checkCommands(args[flag + 1], SHELLS.get(program), directory);
        if (reason) return reason;
      }
    } else if (program === "git") {
      const parsed = parseGit(args);
      const gitDirectory = parsed.directory ? resolve(directory, parsed.directory) : directory;

      if (parsed.subcommand === "push" && isForcePush(parsed.args)) {
        return "this would force push, which can overwrite other work.";
      }
      if (parsed.subcommand === "commit") {
        const reason = checkCommit(parsed.args, gitDirectory, switchedBranch);
        if (reason) return reason;
      }
      switchedBranch = branchSwitchedTo(parsed) ?? switchedBranch;
    }
  }
  return null;
}

// Returns why a tool call should be blocked, or null to let it go ahead.
export function findBlockReason({ tool_name: tool, tool_input: input, cwd }) {
  if (tool === "Edit" || tool === "Write") {
    return input?.file_path && isProtectedEnvFile(input.file_path)
      ? envReason(input.file_path)
      : null;
  }
  if ((tool === "Bash" || tool === "PowerShell") && typeof input?.command === "string") {
    const shell = tool === "PowerShell" ? "powershell" : "bash";
    return checkCommands(input.command, shell, cwd ?? process.cwd());
  }
  return null;
}
