// Can strom write into a research — its .strom (the locks) and .git (the history) — and how a refusal is said. Found
// on Windows: an agent ran strom in its sandbox, which forbade writing the lock into .strom (or anything into .git);
// strom said "no permission" with "a folder with the right to write in it", and the agent told the person it had no
// access to the family tree. Under an agent the refusal is most likely its sandbox: the agent is told to have the
// command run outside it, or to work in the research's folder — never to move the research or change a setting.

import fs from "node:fs";
import path from "node:path";
import { StromError, UsageError } from "./errors.ts";
import { hardLinksHere } from "./lock.ts";
import type { Env } from "./paths.ts";
import { AGENTS, detectAgent } from "./which.ts";

/** What the system says when it refuses writing (no right, a sandbox, a read-only disk). */
const REFUSED = new Set(["EACCES", "EPERM", "EROFS"]);

export function refusedCode(code: string | undefined): boolean {
  return REFUSED.has(code ?? "");
}

/** What an agent does when its sandbox refused strom (the error's hint, the agent's instructions). */
export const SANDBOX_HINT =
  "run this strom command outside the agent's sandbox (the user approves it), or work with the research's folder — its " +
  ".git and .strom too — as the writable working folder; never another folder, never strom's settings changed. With no " +
  "sandbox at work: tell the user strom has no right to write there";

/**
 * The agent's sandbox as it is here — which agent, started by strom or by hand — and what makes writing go (measured
 * 2026-10-22, codex-cli 0.163 on macOS and Windows; agents/files.ts codexRules):
 * - Codex: the tree's rules (.codex/rules/strom.rules, read in a folder Codex trusts) let strom run on its own outside
 *   the sandbox — never in a pipe, after a redirection or `cd`, which run in it; inside it .git is closed on Windows
 *   even named writable (no writable root helps there). Started by strom (strom chat, strom run, the menu: STROM_WORKER,
 *   STROM_SESSION) it is in the research's folder; started by hand, maybe elsewhere;
 * - Claude Code's sandbox (the person turns it on; none on Windows) writes in the folder it was started in;
 * - any other agent: the general words.
 * The level of an agent is the person's choice alone: named, never changed.
 */
export function sandboxHint(env: Env, where?: string): string {
  const here = sandboxHere(env);
  const root = where ? researchOf(where) : undefined;
  const never = "never another folder, never strom's settings changed";
  const alone = "strom run on its own (no pipe, no redirection like 2>&1, no cd before it): the research's .codex/rules/strom.rules lets that run outside Codex's sandbox";
  if (here === "codex-strom")
    return (
      `${alone}. Run so and refused all the same (Codex does not trust the research's folder, or its rules are older than ` +
      "this strom: strom agents sync): ask the user to approve this command outside the sandbox — Codex asks for it; a " +
      `level without the sandbox (full) is the user's choice alone, in strom's settings; ${never}`
    );
  // (a refusal outside any research — strom's own folders — has the general words)
  if (here === "codex" && root)
    return (
      `Codex was started without strom: ${alone} when Codex runs in the research's folder and trusts it. Else, the ` +
      "user's choice: the conversation started through strom (strom chat in the research's folder, or strom's menu), " +
      `or this command approved outside the sandbox; a level without the sandbox is the user's choice alone; ${never}`
    );
  if (here === "claude")
    return (
      "Claude Code's sandbox writes in the folder Claude Code was started in: the user starts it in the research's folder " +
      `(strom chat does), or approves this command outside the sandbox; ${never}`
    );
  return SANDBOX_HINT;
}

/** Which sandbox strom most likely runs in: Codex strom started, Codex started by hand, Claude Code's — or another. */
export function sandboxHere(env: Env): "codex-strom" | "codex" | "claude" | undefined {
  const agent = detectAgent(env);
  if (agent === "codex") return env.STROM_WORKER || env.STROM_SESSION ? "codex-strom" : "codex";
  return agent === "claude" ? "claude" : undefined;
}

/** The research a refused file or folder is of: the folder above its .strom or .git (undefined: not inside one). */
export function researchOf(where: string): string | undefined {
  const parts = path.resolve(where).split(path.sep);
  const at = parts.findIndex((p) => p === ".strom" || p === ".git");
  return at > 0 ? parts.slice(0, at).join(path.sep) || path.sep : undefined;
}

const FOLDER_HINT = "a folder with the right to write in it";
const WINDOWS_HINT = `${FOLDER_HINT} — on Windows, OneDrive or the controlled folder access of Windows Security may also keep strom out of it`;

/** An agent's name as a person knows it (strom's list; one strom does not drive by its own name). */
export function agentName(id: string): string {
  return AGENTS.find((a) => a.id === id)?.name ?? ({ cursor: "Cursor", gemini: "Gemini CLI" } as Record<string, string>)[id] ?? id;
}

/**
 * A refusal to use a file or folder: under an agent most likely its sandbox (fs.sandboxed) — else no right to write
 * there (fs.no-permission; on Windows OneDrive and the controlled folder access named as what may also do it). `above`:
 * an agent found among strom's parent processes though none of its marks is here — its sandbox named first, as the
 * likely cause only, in the person's words (whoever reads it); "?": the parent processes could not be read (as in a
 * sandbox) — an agent's sandbox named as what may do it.
 */
export function noPermission(where: string | undefined, agent: Env | false, platform: NodeJS.Platform = process.platform, above?: string): UsageError {
  const at = where ? `: ${where}` : "";
  const params = where ? { where } : undefined;
  if (agent)
    return new UsageError(`no permission to use${at} — strom runs under an agent, and most likely its sandbox forbids it`, { hint: sandboxHint(agent, where), code: "fs.sandboxed", ...(params ? { params } : {}) });
  if (above === "?")
    return new UsageError(`no permission to use${at}`, {
      hint: `strom could not see the programs that started it, as in an agent's sandbox: if an agent started strom, most likely its sandbox forbids it — the command approved outside the sandbox; else ${platform === "win32" ? WINDOWS_HINT : FOLDER_HINT}`,
      code: "fs.no-permission",
      hintCode: platform === "win32" ? "fs.no-permission.unseen.windows" : "fs.no-permission.unseen",
      ...(params ? { params } : {}),
    });
  if (above) {
    const name = agentName(above);
    return new UsageError(`no permission to use${at}`, {
      hint: `strom was started by ${name}, and most likely its sandbox forbids it: the command approved outside the sandbox, or ${name} given a level without the sandbox; else ${platform === "win32" ? WINDOWS_HINT : FOLDER_HINT}`,
      code: "fs.no-permission",
      hintCode: platform === "win32" ? "fs.no-permission.agent.windows" : "fs.no-permission.agent",
      params: { ...params, agent: name },
    });
  }
  return new UsageError(`no permission to use${at}`, {
    hint: platform === "win32" ? WINDOWS_HINT : FOLDER_HINT,
    code: "fs.no-permission",
    ...(platform === "win32" ? { hintCode: "fs.no-permission.windows" } : {}),
    ...(params ? { params } : {}),
  });
}

/** git refused to write into the research (its .git, an index.lock): never said as no right to run git itself. */
export function gitUnwritable(where: string, detail: string, platform: NodeJS.Platform = process.platform): StromError {
  return new UsageError(`git cannot write into the research: ${where}${detail ? ` (${detail})` : ""}`, {
    hint: platform === "win32" ? WINDOWS_HINT : FOLDER_HINT,
    code: "git.unwritable",
    ...(platform === "win32" ? { hintCode: "fs.no-permission.windows" } : {}),
    params: { where },
  });
}

/** git's words of a refused write ("Permission denied", Windows' "Access is denied", a read-only disk). */
export function gitRefusedWords(text: string): boolean {
  return /permission denied|access is denied|operation not permitted|read-only file system/i.test(text);
}

/** The file git names in its refusal ('…/.git/index.lock'), else the research's .git. */
export function gitRefusedWhere(cwd: string, text: string): string {
  const quoted = /['"]([^'"\n]+)['"]/u.exec(text)?.[1];
  return quoted ? path.normalize(quoted) : path.join(cwd, ".git");
}

/** Does writing into this folder go? A file created and taken away; the system's refusal when it does not. */
export function writeRefusal(dir: string): NodeJS.ErrnoException | undefined {
  const file = path.join(dir, `.write-test.${process.pid}.${Math.random().toString(36).slice(2)}`);
  try {
    fs.writeFileSync(file, "");
    fs.rmSync(file, { force: true });
    return undefined;
  } catch (err) {
    const e = err as NodeJS.ErrnoException;
    return refusedCode(e.code) ? e : undefined;
  }
}

export interface WriteProblem {
  /** The folder that refused (.strom, or the research's folder where .strom is still to be made; .git). */
  where: string;
  place: ".strom" | ".git";
  /** sandbox: under an agent; refused: no right to write; nolink: no hard links here (the lock goes another way). */
  cause: "sandbox" | "refused" | "nolink";
}

/**
 * What of a research cannot be written: its .strom and .git each tried (a file made and taken away), and whether the
 * disk takes hard links (without them the lock is made another way — a note, no failure).
 */
export function writeProblems(root: string, agent: boolean): WriteProblem[] {
  const out: WriteProblem[] = [];
  const strom = path.join(root, ".strom");
  const lockDir = fs.existsSync(strom) ? strom : root;
  const cause = agent ? "sandbox" : "refused";
  const stromRefused = writeRefusal(lockDir);
  if (stromRefused) out.push({ where: lockDir, place: ".strom", cause });
  const gitDir = path.join(root, ".git");
  if (fs.existsSync(gitDir) && writeRefusal(gitDir)) out.push({ where: gitDir, place: ".git", cause });
  if (!stromRefused && !hardLinksHere(lockDir)) out.push({ where: lockDir, place: ".strom", cause: "nolink" });
  return out;
}
