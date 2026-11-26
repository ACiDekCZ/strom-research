// A repository's history without some files: every commit as it was (its message, author, dates, parents), the files
// named gone from each of them — written into a new repository, nothing of the old one's objects in it. strom pack
// leaves out the agents' files this way: they name this computer's folders (a tree's own permissions), and unpacking
// writes them again for the computer it goes to.
//
// git fast-export → a filter of the stream here → git fast-import: both builtin in every git (MinGit of Windows too),
// no shell, no filter-branch. The stream goes through files, never all of it in memory (a research's history may be
// hundreds of MB): read line by line, a `data <n>` section copied by its length in bytes (a blob is any bytes).

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import * as git from "./git.ts";
import { StromError } from "./errors.ts";

const CHUNK = 1 << 20;
const LF = 0x0a;

/** A path of a fast-export stream: as it is, or C-quoted ("…" with \" \\ \n \t and \ooo octal bytes). */
export function unquotePath(raw: Buffer): string {
  if (raw.length < 2 || raw[0] !== 0x22 || raw[raw.length - 1] !== 0x22) return raw.toString("utf8");
  const out: number[] = [];
  const named: Record<string, number> = { a: 7, b: 8, f: 12, n: 10, r: 13, t: 9, v: 11, '"': 0x22, "\\": 0x5c };
  for (let i = 1; i < raw.length - 1; i++) {
    const c = raw[i]!;
    if (c !== 0x5c) {
      out.push(c);
      continue;
    }
    const next = String.fromCharCode(raw[i + 1] ?? 0);
    if (/^[0-3]$/u.test(next) && i + 3 < raw.length - 1) {
      out.push(parseInt(raw.subarray(i + 1, i + 4).toString("latin1"), 8));
      i += 3;
    } else if (named[next] !== undefined) {
      out.push(named[next]!);
      i++;
    } else out.push(c);
  }
  return Buffer.from(out).toString("utf8");
}

/**
 * Copy a fast-export stream from `inFile` to `outFile` without the changes of the paths in `drop` (forward slashes):
 * their `M <mode> <ref> <path>` (an inline one with its data) and `D <path>` lines left out, everything else byte for
 * byte. The blobs only they used stay in the stream unnamed: fast-import stores them, git gc --prune=now takes them away.
 */
export function filterExport(inFile: string, outFile: string, drop: Set<string>): void {
  const inFd = fs.openSync(inFile, "r");
  const outFd = fs.openSync(outFile, "w");
  try {
    let buf: Buffer = Buffer.alloc(0);
    let eof = false;
    const fill = (): boolean => {
      if (eof) return false;
      const b = Buffer.allocUnsafe(CHUNK);
      const n = fs.readSync(inFd, b, 0, CHUNK, null);
      if (n === 0) {
        eof = true;
        return false;
      }
      buf = buf.length ? Buffer.concat([buf, b.subarray(0, n)]) : b.subarray(0, n);
      return true;
    };
    let pending: Buffer[] = [];
    let pendingBytes = 0;
    const flush = () => {
      if (!pendingBytes) return;
      const all = Buffer.concat(pending, pendingBytes);
      let off = 0;
      while (off < all.length) off += fs.writeSync(outFd, all, off, all.length - off);
      pending = [];
      pendingBytes = 0;
    };
    const write = (b: Buffer) => {
      pending.push(b);
      pendingBytes += b.length;
      if (pendingBytes >= CHUNK) flush();
    };
    const nl = Buffer.from([LF]);
    // the bytes of a data section: copied, or passed by (an inline file left out)
    const data = (n: number, keep: boolean) => {
      let left = n;
      while (left > 0) {
        if (!buf.length && !fill()) throw new StromError("the history's export ended inside a file");
        const take = Math.min(left, buf.length);
        if (keep) write(Buffer.from(buf.subarray(0, take)));
        buf = buf.subarray(take);
        left -= take;
      }
    };
    let skipInline = false;
    const line = (l: Buffer) => {
      const head = l.subarray(0, 2).toString("latin1");
      if (l.subarray(0, 5).toString("latin1") === "data ") {
        const size = l.subarray(5).toString("latin1");
        if (!/^\d+$/u.test(size)) throw new StromError(`the history's export has data git did not count (${size.slice(0, 20)})`);
        const keep = !skipInline;
        skipInline = false;
        if (keep) write(Buffer.concat([l, nl]));
        data(Number(size), keep);
        // the line feed git may put after a file's data goes with a file left out
        if (!keep && (buf.length || fill()) && buf[0] === LF) buf = buf.subarray(1);
        return;
      }
      if (head === "M ") {
        const sp2 = l.indexOf(0x20, 2);
        const sp3 = sp2 < 0 ? -1 : l.indexOf(0x20, sp2 + 1);
        if (sp3 > 0 && drop.has(unquotePath(l.subarray(sp3 + 1)))) {
          if (l.subarray(sp2 + 1, sp3).toString("latin1") === "inline") skipInline = true;
          return;
        }
      } else if (head === "D " && drop.has(unquotePath(l.subarray(2)))) return;
      write(Buffer.concat([l, nl]));
    };
    for (;;) {
      const at = buf.indexOf(LF);
      if (at < 0) {
        if (fill()) continue;
        if (buf.length) line(buf);
        break;
      }
      const l = Buffer.from(buf.subarray(0, at));
      buf = buf.subarray(at + 1);
      line(l);
    }
    flush();
  } finally {
    fs.closeSync(inFd);
    fs.closeSync(outFd);
  }
}

/** git with its stdin and stdout given as files (a stream of any size), its errors as text. */
function gitFiles(cwd: string, args: string[], stdin: string | undefined, stdout: string | undefined): { status: number; stderr: string } {
  const inFd = stdin ? fs.openSync(stdin, "r") : undefined;
  const outFd = stdout ? fs.openSync(stdout, "w") : undefined;
  try {
    const r = spawnSync(git.gitProgram() ?? "git", args, {
      cwd,
      stdio: [inFd ?? "ignore", outFd ?? "ignore", "pipe"],
      encoding: "utf8",
      env: { ...process.env, GIT_TERMINAL_PROMPT: "0", LC_ALL: "C" },
      maxBuffer: 64 * 1024 * 1024,
      windowsHide: true,
    });
    return { status: r.error ? 1 : (r.status ?? 1), stderr: r.error ? r.error.message : (r.stderr ?? "") };
  } finally {
    if (inFd !== undefined) fs.closeSync(inFd);
    if (outFd !== undefined) fs.closeSync(outFd);
  }
}

/** Does the history of a repository (any branch) have one of these paths (forward slashes) in some commit? */
export function historyHas(dir: string, paths: string[]): boolean {
  const r = git.runGit(dir, ["log", "--all", "--format=%H", "-1", "--", ...paths]);
  return r.status === 0 && r.stdout.trim() !== "";
}

/**
 * The history of `from` (its branch checked out, never on none) without the paths in `drop`, as a new repository at
 * `to` with that branch checked out: the same commits (messages, authors, dates), each without those files. No reflog,
 * no object of the old history. `from` is a copy strom made (a clone): its HEAD may be put on a branch.
 */
export function rewriteWithout(from: string, to: string, drop: string[]): void {
  const failed = (what: string, said: string) => new StromError(`could not copy the tree (${what}): ${said.trim()}`);
  let branch = git.runGit(from, ["symbolic-ref", "-q", "HEAD"]).stdout.trim();
  if (!branch) {
    // a history on no branch: given one in the copy, so that it is exported whole
    const r = git.runGit(from, ["checkout", "-q", "-B", "main"]);
    if (r.status !== 0) throw failed("its history on no branch", r.stderr);
    branch = "refs/heads/main";
  }
  const work = fs.mkdtempSync(path.join(os.tmpdir(), "strom-history-"));
  try {
    const exported = path.join(work, "export");
    const filtered = path.join(work, "filtered");
    const base = ["fast-export", "--all", "--use-done-feature", "--reencode=no", "--signed-tags=strip", "--tag-of-filtered-object=drop"];
    // signed commits as plain ones (their signature would not fit the commit changed); an older git knows no such switch and leaves them so
    let r = gitFiles(from, [...base, "--signed-commits=strip"], undefined, exported);
    if (r.status !== 0 && /signed-commits/u.test(r.stderr)) r = gitFiles(from, base, undefined, exported);
    if (r.status !== 0) throw failed("git fast-export", r.stderr);
    filterExport(exported, filtered, new Set(drop));
    fs.rmSync(exported, { force: true });
    fs.mkdirSync(to, { recursive: true });
    const init = git.runGit(to, ["init", "--quiet"]);
    if (init.status !== 0) throw failed("git init", init.stderr);
    r = gitFiles(to, ["fast-import", "--quiet"], filtered, undefined);
    if (r.status !== 0) throw failed("git fast-import", r.stderr);
    for (const args of [
      ["symbolic-ref", "HEAD", branch],
      ["reset", "--hard", "-q"],
    ]) {
      const x = git.runGit(to, args);
      if (x.status !== 0) throw failed(`git ${args[0]}`, x.stderr);
    }
  } finally {
    fs.rmSync(work, { recursive: true, force: true });
  }
}

/** A repository's reflogs gone (git clone writes where it cloned from into them) and ORIG_HEAD: nothing names an older state. */
export function dropReflogs(dir: string): void {
  fs.rmSync(path.join(dir, ".git", "logs"), { recursive: true, force: true });
  fs.rmSync(path.join(dir, ".git", "ORIG_HEAD"), { force: true });
}
