// Thin git wrapper. Git is the storage backbone but invisible to the user:
// `strom` initialises repositories, sets a local identity when none exists
// and commits on its own.

import { execFile, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { StromError } from "./errors.ts";
import type { Env } from "./paths.ts";
import { configDir, isolated, userHome } from "./paths.ts";
import { installation } from "./self.ts";
import { which } from "./which.ts";

export interface GitResult {
  status: number;
  stdout: string;
  stderr: string;
}

const GIT_ENV = {
  GIT_TERMINAL_PROMPT: "0",
  GIT_OPTIONAL_LOCKS: "0",
  LC_ALL: "C",
};

const PROFILE = process.env.STROM_PROFILE === "1";

/** How long a git that reads what strom gives it (commit-tree, cat-file --batch) may take: it never holds the tree's lock for good. */
export const GIT_INPUT_TIMEOUT_MS = 5 * 60_000;

/**
 * What git reads on its stdin, given to it as a file — never written through a pipe: on macOS a spawnSync writing its
 * input into git's stdin (a socket) now and then left git waiting for it for good, the tree's lock held (npm test hung
 * an hour in a git commit-tree; reproduced: about 1 in 800 long messages). Without input git's stdin is nothing.
 */
function withStdin<T>(input: string | undefined, run: (stdin: number | "ignore") => T): T {
  if (input === undefined) return run("ignore");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "strom-git-"));
  try {
    const file = path.join(dir, "stdin");
    fs.writeFileSync(file, input, { mode: 0o600 });
    const fd = fs.openSync(file, "r");
    try {
      return run(fd);
    } finally {
      fs.closeSync(fd);
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

/** A git that did not finish in time: stopped (SIGKILL by spawnSync), said. */
function gitTimedOut(args: string[], error: Error | undefined): StromError | undefined {
  if ((error as NodeJS.ErrnoException | undefined)?.code !== "ETIMEDOUT") return undefined;
  return new StromError(`git ${args[0]} did not finish within ${GIT_INPUT_TIMEOUT_MS / 60_000} minutes and was stopped`, {
    hint: "strom doctor checks git; run the command again",
  });
}

export function runGit(cwd: string, args: string[], input?: string, extraEnv: Record<string, string> = {}): GitResult {
  const t0 = PROFILE ? performance.now() : 0;
  const r = withStdin(input, (stdin) =>
    spawnSync(gitProgram() ?? "git", args, {
      cwd,
      stdio: [stdin, "pipe", "pipe"],
      encoding: "utf8",
      env: { ...process.env, ...GIT_ENV, ...extraEnv },
      maxBuffer: 256 * 1024 * 1024,
      windowsHide: true,
      ...(input !== undefined ? { timeout: GIT_INPUT_TIMEOUT_MS, killSignal: "SIGKILL" as const } : {}),
    }),
  );
  if (r.error) {
    const code = (r.error as NodeJS.ErrnoException).code;
    if (code === "ENOENT") throw gitMissingError();
    throw gitTimedOut(args, r.error) ?? r.error;
  }
  if (PROFILE) process.stderr.write(`[git ${(performance.now() - t0).toFixed(0)}ms] ${args.slice(0, 3).join(" ")}\n`);
  return { status: r.status ?? 1, stdout: r.stdout, stderr: r.stderr };
}

/**
 * runGit without waiting: for what a server works out in the background (the bridge answers meanwhile). A git that is
 * missing or fails to start: status 1, its reason as stderr.
 */
export function runGitLater(cwd: string, args: string[], timeoutMs = 60_000): Promise<GitResult> {
  return new Promise((resolve) => {
    execFile(
      gitProgram() ?? "git",
      args,
      { cwd, encoding: "utf8", env: { ...process.env, ...GIT_ENV }, maxBuffer: 64 * 1024 * 1024, timeout: timeoutMs, killSignal: "SIGKILL", windowsHide: true },
      (err, stdout, stderr) => resolve({ status: err ? (typeof err.code === "number" ? err.code : 1) : 0, stdout: stdout ?? "", stderr: stderr || (err ? err.message : "") }),
    );
  });
}

function git(cwd: string, args: string[], input?: string): string {
  const r = runGit(cwd, args, input);
  if (r.status !== 0) throw new StromError(`git ${args[0]} failed: ${r.stderr.trim() || r.stdout.trim()}`);
  return r.stdout;
}

export function gitInstallHint(platform: NodeJS.Platform = process.platform): string {
  if (platform === "linux") return "git from the system's package manager, e.g. sudo apt install git  /  sudo dnf install git";
  return "strom doctor --fix installs it";
}

export function gitMissingError(platform: NodeJS.Platform = process.platform): StromError {
  return new StromError("git is not installed — Strom keeps the research history in git", {
    hint: gitInstallHint(platform),
    code: platform === "linux" ? "git.missing-linux" : "git.missing",
  });
}

/** strom's own git on Windows (MinGit, installed by strom doctor --fix — for strom only, no admin, not on PATH). */
export function ownGitDir(env: Env): string {
  // an isolated installation: in its own folder (the person's strom keeps its own)
  if (isolated(env)) return path.join(installation().root ?? configDir(env), "git");
  return path.join(env.LOCALAPPDATA ?? path.join(userHome(env), "AppData", "Local"), "Programs", "Strom", "git");
}

const programs = new Map<string, string | undefined>();

/**
 * Where git is: STROM_GIT; strom's own (Windows); on PATH; where Git for
 * Windows installs itself (right after its installer this process's PATH does
 * not have it yet). On macOS /usr/bin/git is only a stand-in until Apple's
 * command line tools are installed — running it would open Apple's installer
 * window unasked — so it counts only with the tools there.
 */
export function gitProgram(env: Env = process.env, platform: NodeJS.Platform = process.platform): string | undefined {
  const key = [platform, env.STROM_GIT, env.PATH ?? env.Path, env.LOCALAPPDATA].join("|");
  if (programs.has(key)) return programs.get(key);
  let found: string | undefined;
  if (env.STROM_GIT) found = fs.existsSync(env.STROM_GIT) ? env.STROM_GIT : undefined;
  else {
    const own = path.join(ownGitDir(env), "cmd", "git.exe");
    if (platform === "win32" && fs.existsSync(own)) found = own;
    found ??= which("git", env, platform);
    if (!found && platform === "win32")
      found = [env.ProgramFiles, env.ProgramW6432, env.LOCALAPPDATA && path.join(env.LOCALAPPDATA, "Programs")]
        .filter((d): d is string => Boolean(d))
        .map((d) => path.join(d, "Git", "cmd", "git.exe"))
        .find((f) => fs.existsSync(f));
    if (found === "/usr/bin/git" && platform === "darwin") found = appleGit();
  }
  programs.set(key, found);
  return found;
}

/**
 * macOS: /usr/bin/git is a stand-in that asks xcrun where the command line tools are on every run — four times
 * slower than their git itself (73 vs 18 ms; strom runs git several times a write). Without the tools: none.
 */
export function appleGit(toolsDir: () => string | undefined = xcodeSelect): string | undefined {
  const dir = toolsDir();
  if (dir === undefined) return undefined;
  const own = dir && path.join(dir, "usr", "bin", "git");
  return own && fs.existsSync(own) ? own : "/usr/bin/git";
}

/** Where Apple's developer tools are (`xcode-select -p`); undefined: none installed. */
function xcodeSelect(): string | undefined {
  const r = spawnSync("xcode-select", ["-p"], { encoding: "utf8" });
  return r.status === 0 ? r.stdout.trim() : undefined;
}

/** Git version string, or undefined when git is not available. */
export function gitVersion(env: Env = process.env): string | undefined {
  const git = gitProgram(env);
  if (!git) return undefined;
  const r = spawnSync(git, ["--version"], { encoding: "utf8", windowsHide: true });
  if (r.error || r.status !== 0) return undefined;
  return r.stdout.trim().replace(/^git version /, "");
}

export function isRepo(dir: string): boolean {
  const r = runGit(dir, ["rev-parse", "--is-inside-work-tree"]);
  return r.status === 0 && r.stdout.trim() === "true";
}

export function initRepo(dir: string): void {
  git(dir, ["init", "-q"]);
  // Stable behaviour on every platform and with non-ASCII file names — written at once, not a git each.
  const settings = ["[core]", "\tautocrlf = false", "\tquotepath = off", "[commit]", "\tgpgsign = false", ...identityLines(dir)];
  fs.appendFileSync(path.join(dir, ".git", "config"), `${settings.join("\n")}\n`);
}

/** Non-technical users have no git identity; set a local one if needed. */
export function ensureIdentity(dir: string): void {
  const lines = identityLines(dir);
  if (lines.length) fs.appendFileSync(path.join(dir, ".git", "config"), `${lines.join("\n")}\n`);
}

/** The identity git lacks here (none set globally or in the repository), as lines of its config. */
function identityLines(dir: string): string[] {
  const set = runGit(dir, ["config", "--get-regexp", "^user\\.(name|email)$"]).stdout;
  const has = (key: string) => set.split("\n").some((l) => l.toLowerCase().startsWith(`${key} `) && l.slice(key.length + 1).trim());
  const lines = [...(has("user.name") ? [] : ["\tname = Strom"]), ...(has("user.email") ? [] : ["\temail = strom@localhost"])];
  return lines.length ? ["[user]", ...lines] : [];
}

export interface HeadInfo {
  hash: string;
  tree: string;
  message: string;
}

// HEAD only changes when strom commits, so it is read once per command.
const headCache = new Map<string, HeadInfo | null>();

/**
 * Forget cached git state (when a tree is reopened; everything after git was installed). At the start of a command
 * (`command`) a git found stays found — looking costs processes, and only installing one changes it.
 */
export function resetCache(dir?: string, at: "command" | "all" = "all"): void {
  if (dir) headCache.delete(dir);
  else {
    headCache.clear();
    for (const [key, found] of programs) if (at === "all" || !found) programs.delete(key);
  }
}

/** HEAD commit, its tree hash and message (cached until the next commit). */
export function headInfo(dir: string): HeadInfo | undefined {
  const cached = headCache.get(dir);
  if (cached !== undefined) return cached ?? undefined;
  const r = runGit(dir, ["log", "-1", "--format=%H%x00%T%x00%B"]);
  let info: HeadInfo | null = null;
  if (r.status === 0 && r.stdout) {
    const [hash = "", tree = "", ...rest] = r.stdout.split("\0");
    info = { hash: hash.trim(), tree: tree.trim(), message: rest.join("\0") };
  }
  headCache.set(dir, info);
  return info ?? undefined;
}

export function hasHead(dir: string): boolean {
  return headInfo(dir) !== undefined;
}

export function head(dir: string): string | undefined {
  return headInfo(dir)?.hash;
}

export function tracked(dir: string, p: string): boolean {
  return runGit(dir, ["ls-files", "--error-unmatch", "--", p]).status === 0;
}

/** Which of these paths (files or folders) git knows — one process for all of them. */
function trackedOf(dir: string, paths: string[]): Set<string> {
  const files = runGit(dir, ["ls-files", "-z", "--", ...paths]).stdout.split("\0").filter(Boolean);
  return new Set(paths.filter((p) => {
    const rel = p.replace(/\\/g, "/").replace(/^\.\//, "").replace(/\/$/, "");
    return files.some((f) => f === rel || f.startsWith(`${rel}/`));
  }));
}

const FALLBACK_IDENTITY = {
  GIT_AUTHOR_NAME: "Strom",
  GIT_AUTHOR_EMAIL: "strom@localhost",
  GIT_COMMITTER_NAME: "Strom",
  GIT_COMMITTER_EMAIL: "strom@localhost",
};

function commitTree(dir: string, tree: string, parent: string | undefined, message: string): GitResult {
  const args = ["commit-tree", tree, ...(parent ? ["-p", parent] : []), "-F", "-"];
  const r = runGit(dir, args, message);
  if (r.status === 0 || !/identity|tell me who you are|user\.email/i.test(r.stderr)) return r;
  // No git identity at all (non-technical users): commit as "Strom".
  return runGit(dir, args, message, FALLBACK_IDENTITY);
}

/**
 * Commit everything under the given paths. `seal` receives the git tree hash
 * of the commit-to-be and returns trailer lines (the commit seal).
 * Plumbing (write-tree, commit-tree, update-ref) instead of `git commit`:
 * fewer processes, no hooks, no editor. Returns the hash, or undefined if
 * nothing changed.
 */
export function commitAll(
  dir: string,
  message: string,
  pathspec: string[] = ["."],
  seal?: (treeHash: string) => string,
): string | undefined {
  // Paths that no longer exist are fine for `add -A` only if git knows them;
  // filter missing, untracked-never-seen paths out to keep `add` from failing.
  const missing = pathspec.filter((p) => p !== "." && !fs.existsSync(path.join(dir, p)));
  const known = missing.length ? trackedOf(dir, missing) : new Set<string>();
  const specs = pathspec.filter((p) => !missing.includes(p) || known.has(p));
  if (specs.length) git(dir, ["add", "-A", "--", ...specs]);
  const tree = git(dir, ["write-tree"]).trim();
  const parent = headInfo(dir);
  if (parent && parent.tree === tree) return undefined;
  const full = seal ? `${message}\n\n${seal(tree)}\n` : `${message}\n`;
  const r = commitTree(dir, tree, parent?.hash, full);
  if (r.status !== 0) throw new StromError(`git commit failed: ${r.stderr.trim()}`);
  const hash = r.stdout.trim();
  git(dir, ["update-ref", "HEAD", hash, ...(parent ? [parent.hash] : [])]);
  headCache.set(dir, { hash, tree, message: full });
  tidy(dir);
  return hash;
}

/**
 * Pack loose objects now and then. Plumbing never runs git's own `gc --auto`,
 * so every change of every record would stay a loose file for good (a migrated
 * tree: 30 000 of them, 900 MB). Git's own estimate first — the objects in one
 * of its 256 folders (gc.auto 6700 / 256) — so a commit costs no extra process;
 * `gc --auto` then packs in the background, as `git commit` would.
 */
function tidy(dir: string): void {
  let n: number;
  try {
    n = fs.readdirSync(path.join(dir, ".git", "objects", "17")).length;
  } catch {
    return;
  }
  if (n > 27) runGit(dir, ["gc", "--auto", "--quiet"]);
}

/**
 * Read many files at one revision with a single git process.
 * Returns path -> content (undefined when the file did not exist there).
 */
export function showFiles(dir: string, rev: string, files: string[]): Map<string, string | undefined> {
  const out = new Map<string, string | undefined>();
  if (files.length === 0) return out;
  const args = ["cat-file", "--batch"];
  const r = withStdin(files.map((f) => `${rev}:${f.replace(/\\/g, "/")}`).join("\n") + "\n", (stdin) =>
    spawnSync(gitProgram() ?? "git", args, {
      cwd: dir,
      stdio: [stdin, "pipe", "pipe"],
      env: { ...process.env, ...GIT_ENV },
      maxBuffer: 1024 * 1024 * 1024,
      windowsHide: true,
      timeout: GIT_INPUT_TIMEOUT_MS,
      killSignal: "SIGKILL",
    }),
  );
  if (r.error) throw gitTimedOut(args, r.error) ?? r.error;
  const buf = r.stdout as Buffer;
  let pos = 0;
  for (const file of files) {
    const nl = buf.indexOf(10, pos);
    const header = buf.subarray(pos, nl).toString("utf8");
    pos = nl + 1;
    if (header.endsWith(" missing") || header.endsWith(" ambiguous")) {
      out.set(file, undefined);
      continue;
    }
    const size = Number(header.split(" ")[2]);
    out.set(file, buf.subarray(pos, pos + size).toString("utf8"));
    pos += size + 1; // content is followed by a newline
  }
  return out;
}

export interface Change {
  path: string;
  /** Porcelain status code, e.g. " M", "??", " D". */
  code: string;
}

/** Uncommitted changes with their status codes. */
export function changes(dir: string, pathspec: string[] = []): Change[] {
  const out = git(dir, ["status", "--porcelain=v1", "-z", "--untracked-files=all", "--", ...pathspec]);
  const items = out.split("\0").filter(Boolean);
  const list: Change[] = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i]!;
    const code = item.slice(0, 2);
    list.push({ path: item.slice(3), code });
    if (code.startsWith("R") || code.startsWith("C")) i++;
  }
  return list;
}

/** File content at a revision, or undefined if it did not exist there. */
export function showFile(dir: string, rev: string, file: string): string | undefined {
  const r = runGit(dir, ["show", `${rev}:${file.replace(/\\/g, "/")}`]);
  return r.status === 0 ? r.stdout : undefined;
}

/** Files under a directory at a revision. */
export function listFiles(dir: string, rev: string, subdir: string): string[] {
  const r = runGit(dir, ["ls-tree", "-r", "--name-only", "-z", rev, "--", subdir]);
  if (r.status !== 0) return [];
  return r.stdout.split("\0").filter(Boolean);
}

export interface Commit {
  hash: string;
  at: string;
  subject: string;
}

/** Newest commit (within `limit`) whose tree hash and message satisfy `ok`. */
export function findCommit(dir: string, ok: (tree: string, message: string) => boolean, limit = 1000): string | undefined {
  const r = runGit(dir, ["log", `-n${limit}`, "--format=%H%x00%T%x00%B%x1e"]);
  if (r.status !== 0) return undefined;
  for (const entry of r.stdout.split("\x1e")) {
    const [hash, tree, message] = entry.replace(/^\n/, "").split("\0");
    if (hash && tree && message !== undefined && ok(tree, message)) return hash;
  }
  return undefined;
}

export function log(dir: string, limit: number, pathspec: string[] = []): Commit[] {
  if (!hasHead(dir)) return [];
  const out = git(dir, ["log", `-n${limit}`, "--format=%H%x1f%aI%x1f%s", "--", ...pathspec]);
  return out
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const [hash = "", at = "", subject = ""] = line.split("\x1f");
      return { hash, at, subject };
    });
}
