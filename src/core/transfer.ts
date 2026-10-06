// A tree of the Strom app moving from a browser the app cannot reach strom from (Safari) to one it can (the app's
// ZADANI_VYZKUM_prenos-prohlizece.md): the app saved the whole tree as a file (strom-prenos-<8 of its mark>.json, its
// JSON backup with images) whose first key marks the move — {"stromTransfer": {v, token, from, tree, persons, at}}.
// strom finds the file, reads only that mark, and the bridge gives the file to the app in the browser the person
// chose (GET /transfer) while the new research waits for the tree; the app there hands it over as from any browser.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import type { Env } from "./paths.ts";
import { userHome } from "./paths.ts";
import { appCopyUrl } from "./stromapp.ts";

export interface TransferMark {
  token: string;
  /** The tree's name in the app. */
  tree: string;
  persons: number;
  /** The browser it comes from (safari, other…), as the app said. */
  from?: string;
  /** The copy of the app it comes from (its beta, its development) — a line for Win + R has no room for it (the app's 3.9.1). */
  app?: string;
}

/** How much of a file is read for its mark: the mark is its first key. */
const HEAD_BYTES = 16 * 1024;
/** A file of a move is looked for among those saved within a day. */
const RECENT_MS = 24 * 60 * 60_000;

/** The mark of a move at the head of a file (its first key), if it carries one — the rest of the file is never read. */
export function transferMark(file: string): TransferMark | undefined {
  let head: string;
  try {
    const fd = fs.openSync(file, "r");
    try {
      const buf = Buffer.alloc(HEAD_BYTES);
      head = buf.subarray(0, fs.readSync(fd, buf, 0, HEAD_BYTES, 0)).toString("utf8");
    } finally {
      fs.closeSync(fd);
    }
  } catch {
    return undefined;
  }
  const at = head.search(/"stromTransfer"\s*:\s*\{/);
  if (at < 0) return undefined;
  // the object after the key, read to its brace (strings may hold braces)
  const start = head.indexOf("{", at);
  let depth = 0;
  let inString = false;
  for (let i = start; i < head.length; i++) {
    const c = head[i];
    if (inString) {
      if (c === "\\") i++;
      else if (c === '"') inString = false;
    } else if (c === '"') inString = true;
    else if (c === "{") depth++;
    else if (c === "}" && --depth === 0) {
      try {
        const m = JSON.parse(head.slice(start, i + 1)) as { token?: unknown; tree?: unknown; persons?: unknown; from?: unknown; app?: unknown };
        if (typeof m.token !== "string" || !m.token) return undefined;
        const tree = typeof m.tree === "string" ? m.tree.normalize("NFC").replace(/[\p{Cc}\p{Cf}]/gu, " ").replace(/\s+/gu, " ").trim().slice(0, 80).trim() : "";
        const persons = typeof m.persons === "number" && Number.isFinite(m.persons) && m.persons >= 0 ? Math.floor(m.persons) : 0;
        const app = typeof m.app === "string" ? appCopyUrl(m.app.trim()) : undefined;
        return { token: m.token, tree, persons, ...(typeof m.from === "string" ? { from: m.from.slice(0, 16) } : {}), ...(app ? { app } : {}) };
      } catch {
        return undefined;
      }
    }
  }
  return undefined;
}

/**
 * Where a browser saves what it downloads: the Downloads folder (and Safari's own on macOS, the folder the person
 * set for downloads in strom), the desktop, and the folder strom was started in.
 */
export function transferDirs(env: Env, cwd: string = process.cwd(), downloads?: string, platform: NodeJS.Platform = process.platform): string[] {
  const home = userHome(env);
  const dirs = [path.join(home, "Downloads"), ...(downloads ? [downloads] : [])];
  // Safari's downloads folder, when the person moved it (its setting only; never in tests)
  if (platform === "darwin" && env.STROM_APP_DIRS === undefined && home === os.homedir()) {
    try {
      const r = spawnSync("defaults", ["read", "com.apple.Safari", "DownloadsPath"], { encoding: "utf8", timeout: 3000, stdio: ["ignore", "pipe", "ignore"] });
      const p = r.status === 0 ? r.stdout.trim().replace(/^~(?=\/|$)/, home) : "";
      if (p) dirs.push(p);
    } catch {
      // the Downloads folder then
    }
  }
  dirs.push(path.join(home, "Desktop"), cwd);
  return [...new Set(dirs.map((d) => path.resolve(d)))].filter((d) => fs.existsSync(d));
}

/** A file a browser may have saved the app's JSON as: .json, or .json.txt (Safari, when it took it for text). */
const JSON_FILE = /\.json(?:\.txt)?$/iu;

/** The name the app gave the file, and the names a browser gives a second copy of it (-2, " 2", " (1)") — also with .txt after it. */
function nameMatches(name: string, given: string): boolean {
  name = name.replace(/\.txt$/iu, "");
  const ext = path.extname(given);
  const base = given.slice(0, given.length - ext.length).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^${base}(?:-\\d+| \\d+| \\(\\d+\\))?${ext.replace(".", "\\.")}$`, "u").test(name.normalize("NFC"));
}

/**
 * The file of the move of the app's tree with this mark: first by the name the app gave it (and a browser's copies of
 * that name), then any JSON saved within a day that carries the mark — newest first; never a file of another mark.
 * A file from a phone (AirDrop, iCloud, a mail's attachment saved) is found the same way where it was put.
 */
export function findTransfer(token: string, dirs: string[], given?: string): { file: string; mark: TransferMark } | undefined {
  const files = (dir: string): { file: string; name: string; at: number }[] => {
    try {
      return fs
        .readdirSync(dir)
        .filter((n) => JSON_FILE.test(n))
        .map((n) => {
          const file = path.join(dir, n);
          try {
            const st = fs.statSync(file);
            return st.isFile() ? { file, name: n, at: st.mtimeMs } : undefined;
          } catch {
            return undefined;
          }
        })
        .filter((f): f is { file: string; name: string; at: number } => Boolean(f));
    } catch {
      return [];
    }
  };
  const all = dirs.flatMap(files).sort((a, b) => b.at - a.at);
  const ours = (f: { file: string }) => {
    const mark = transferMark(f.file);
    return mark && mark.token === token ? { file: f.file, mark } : undefined;
  };
  // a whole path given (a file dragged into the terminal): that file
  if (given && path.isAbsolute(given) && fs.existsSync(given)) {
    const hit = ours({ file: given });
    if (hit) return hit;
  }
  const name = given ? path.basename(given) : undefined;
  for (const f of name ? all.filter((x) => nameMatches(x.name, name)) : []) {
    const hit = ours(f);
    if (hit) return hit;
  }
  for (const f of all.filter((x) => Date.now() - x.at < RECENT_MS)) {
    const hit = ours(f);
    if (hit) return hit;
  }
  return undefined;
}

/** Where a research made from the file of a move keeps it: the browser the tree stayed in, the file, since when. */
const MOVED_FILE = path.join(".strom", "moved.json");

export interface MovedByFile {
  /** The browser the app's tree stayed in (safari, other…). */
  from: string;
  file: string;
  at: string;
  /** When the research was opened in a browser that reaches strom: the move finished. */
  done?: string;
}

/** The research was made from the file of a move, no browser here reaching strom (the app goes on through files). */
export function noteMovedByFile(root: string, moved: { from: string; file: string }): void {
  fs.mkdirSync(path.join(root, ".strom"), { recursive: true });
  fs.writeFileSync(path.join(root, MOVED_FILE), JSON.stringify({ ...moved, at: new Date().toISOString() }));
}

/** A move made by file and not yet finished in a browser that reaches strom. */
export function movedByFile(root: string): MovedByFile | undefined {
  try {
    const m = JSON.parse(fs.readFileSync(path.join(root, MOVED_FILE), "utf8")) as MovedByFile;
    return m.from && !m.done ? m : undefined;
  } catch {
    return undefined;
  }
}

/** The research opened in a browser that reaches strom: the move by file finished. */
export function finishMovedByFile(root: string): void {
  const m = movedByFile(root);
  if (m) fs.writeFileSync(path.join(root, MOVED_FILE), JSON.stringify({ ...m, done: new Date().toISOString() }));
}
