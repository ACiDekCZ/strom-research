// Thin git wrapper. Git is the storage backbone but invisible to the user:
// `strom` initialises repositories, sets a local identity when none exists
// and commits on its own.

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { StromError } from "./errors.ts";
import type { Env } from "./paths.ts";
import { userHome } from "./paths.ts";
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

export function runGit(cwd: string, args: string[], input?: string): GitResult {
  const t0 = PROFILE ? performance.now() : 0;
  const r = spawnSync(gitProgram() ?? "git", args, {
    cwd,
    input,
    encoding: "utf8",
    env: { ...process.env, ...GIT_ENV },
    maxBuffer: 256 * 1024 * 1024,
    windowsHide: true,
  });
  if (r.error) {
    const code = (r.error as NodeJS.ErrnoException).code;
    if (code === "ENOENT") throw gitMissingError();
    throw r.error;
  }
  if (PROFILE) process.stderr.write(`[git ${(performance.now() - t0).toFixed(0)}ms] ${args.slice(0, 3).join(" ")}\n`);
  return { status: r.status ?? 1, stdout: r.stdout, stderr: r.stderr };
}

function git(cwd: string, args: string[], input?: string): string {
  const r = runGit(cwd, args, input);
  if (r.status !== 0) throw new StromError(`git ${args[0]} failed: ${r.stderr.trim() || r.stdout.trim()}`);
  return r.stdout;
}

export function gitInstallHint(platform: NodeJS.Platform = process.platform): string {
  if (platform === "linux") return "install git with your package manager, e.g. sudo apt install git  /  sudo dnf install git";
  return "strom doctor --fix installs it";
}

export function gitMissingError(): StromError {
  return new StromError("git is not installed — Strom keeps the research history in git", {
    hint: gitInstallHint(),
  });
}

/** strom's own git on Windows (MinGit, installed by strom doctor --fix — for strom only, no admin, not on PATH). */
export function ownGitDir(env: Env): string {
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
    if (found === "/usr/bin/git" && platform === "darwin" && spawnSync("xcode-select", ["-p"], { stdio: "ignore" }).status !== 0) found = undefined;
  }
  programs.set(key, found);
  return found;
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
  // Stable behaviour on every platform and with non-ASCII file names.
  git(dir, ["config", "core.autocrlf", "false"]);
  git(dir, ["config", "core.quotepath", "off"]);
  git(dir, ["config", "commit.gpgsign", "false"]);
  ensureIdentity(dir);
}

/** Non-technical users have no git identity; set a local one if needed. */
export function ensureIdentity(dir: string): void {
  const name = runGit(dir, ["config", "user.name"]).stdout.trim();
  const email = runGit(dir, ["config", "user.email"]).stdout.trim();
  if (!name) git(dir, ["config", "user.name", "Strom"]);
  if (!email) git(dir, ["config", "user.email", "strom@localhost"]);
}

export interface HeadInfo {
  hash: string;
  tree: string;
  message: string;
}

// HEAD only changes when strom commits, so it is read once per command.
const headCache = new Map<string, HeadInfo | null>();

/** Forget cached git state (at the start of every command, and when a tree is reopened). */
export function resetCache(dir?: string): void {
  if (dir) headCache.delete(dir);
  else {
    headCache.clear();
    programs.clear();
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

function tracked(dir: string, p: string): boolean {
  return runGit(dir, ["ls-files", "--error-unmatch", "--", p]).status === 0;
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
  const retry = spawnSync(gitProgram() ?? "git", args, {
    cwd: dir,
    input: message,
    encoding: "utf8",
    env: { ...process.env, ...GIT_ENV, ...FALLBACK_IDENTITY },
    windowsHide: true,
  });
  return { status: retry.status ?? 1, stdout: retry.stdout, stderr: retry.stderr };
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
  const specs = pathspec.filter((p) => p === "." || fs.existsSync(path.join(dir, p)) || tracked(dir, p));
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
  const r = spawnSync(gitProgram() ?? "git", ["cat-file", "--batch"], {
    cwd: dir,
    input: files.map((f) => `${rev}:${f.replace(/\\/g, "/")}`).join("\n") + "\n",
    env: { ...process.env, ...GIT_ENV },
    maxBuffer: 1024 * 1024 * 1024,
    windowsHide: true,
  });
  if (r.error) throw r.error;
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
