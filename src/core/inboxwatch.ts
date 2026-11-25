// The bridge watching the folders of the shared inbox that tasks wait on (core/inboxwait.ts), and those of the books
// tasks still need (spec 105 K1.4: images saved there by hand serve all the book's tasks) — only those, never the
// whole inbox: images the person saves there by hand are taken as they come (strom media add --inbox --waiting, a strom
// of the bridge's own writing as the person), and a task they complete comes back to the queue without a command.
//
// A folder is taken once it has settled (no file written for SETTLE_MS, no browser's download running in it, B0408): a
// large scan being copied, a batch half downloaded, is never taken half. What
// cannot be taken (named so its numbers are not known) is tried again only once the folder changes — never again and
// again. The folders are looked at again every STROM_INBOX_POLL_MS (30 s): a task set waiting meanwhile, a watch a
// system lost (a network drive, a folder made again), a change the system did not report.

import fs from "node:fs";
import path from "node:path";
import type { Env } from "./paths.ts";
import { Tree } from "./tree.ts";
import { bookFolders, folderBusy, folderFiles, inboxWaits, SETTLE_MS } from "./inboxwait.ts";
import { dueAfterQuiet } from "./inboxsettle.ts";

export interface InboxWatch {
  /** The folders watched now (for the log and tests). */
  folders(): string[];
  /** Looked at now (tests; a poll does the same). */
  look(): void;
  end(): void;
}

export interface InboxWatchOptions {
  root: string;
  env: Env;
  shared: () => string | undefined;
  /** The bridge writes something now: taken a moment later. */
  busy: () => boolean;
  /** Take the folders' files (a strom of the bridge's), `done` with whether it ran. */
  take: (done: (ok: boolean) => void) => void;
  note: (line: string) => void;
}

/** What lies in a folder: its files with their size and time, so a folder unchanged is not tried twice. */
function signature(files: string[]): string {
  return files
    .map((f) => {
      try {
        const st = fs.statSync(f);
        return `${f}\u0000${st.size}\u0000${st.mtimeMs}`;
      } catch {
        return f;
      }
    })
    .join("\n");
}

export function watchInbox(o: InboxWatchOptions): InboxWatch {
  const pollMs = Number(o.env.STROM_INBOX_POLL_MS ?? 30_000);
  const settleMs = Number(o.env.STROM_INBOX_SETTLE_MS ?? SETTLE_MS);
  const watchers = new Map<string, fs.FSWatcher>();
  // the folder's content last tried: not tried again until it changes
  const tried = new Map<string, string>();
  let timer: NodeJS.Timeout | undefined;
  let taking = false;
  let ended = false;

  const schedule = (ms: number) => {
    if (ended) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(check, ms);
    timer.unref?.();
  };

  /** The folders tasks wait on now, and those of the books tasks need (only those already made: rewatch). */
  const wanted = (): string[] => {
    const shared = o.shared();
    if (!shared) return [];
    try {
      const tree = Tree.open(o.root, o.env);
      return [...new Set([...inboxWaits(tree), ...bookFolders(tree)].map((w) => path.join(shared, "inbox", w.folder)))];
    } catch {
      return [...watchers.keys()];
    }
  };

  const settledNow = (): Set<string> => {
    const shared = o.shared();
    if (!shared || !watchers.size) return new Set();
    try {
      return dueAfterQuiet(Tree.open(o.root, o.env), shared, Date.now(), o.env);
    } catch {
      return new Set();
    }
  };

  const rewatch = () => {
    const want = new Set(wanted());
    for (const [dir, w] of watchers)
      if (!want.has(dir)) {
        w.close();
        watchers.delete(dir);
        tried.delete(dir);
      }
    for (const dir of want) {
      if (watchers.has(dir) || !fs.existsSync(dir)) continue;
      try {
        const w = fs.watch(dir, { persistent: false }, () => schedule(settleMs + 250));
        w.on("error", () => {
          w.close();
          watchers.delete(dir);
        });
        watchers.set(dir, w);
      } catch {
        // a folder the system will not watch: the poll looks at it
      }
    }
  };

  function check() {
    timer = undefined;
    if (ended || taking) return;
    let due = false;
    let wait = 0;
    // a folder that settled with something to do (spec 141: files named not by the images' numbers, a task a part of
    // whose images came): taken once more, though nothing in it changed — once done, never due again
    const settled = settledNow();
    for (const dir of watchers.keys()) {
      if (settled.has(dir)) {
        due = true;
        continue;
      }
      const files = folderFiles(dir);
      if (!files.length) {
        tried.delete(dir);
        continue;
      }
      // still being written (a file, a browser's download of the batch): looked at once it has all settled
      if (folderBusy(dir, files, Date.now())) {
        wait = settleMs;
        continue;
      }
      if (tried.get(dir) === signature(files)) continue;
      due = true;
    }
    if (!due) {
      if (wait) schedule(wait + 250);
      return;
    }
    if (o.busy()) return schedule(5_000);
    // what lies there now, tried once (what stays — named so its numbers are not known — waits for a change)
    const before = new Map([...watchers.keys()].map((dir) => [dir, signature(folderFiles(dir))]));
    taking = true;
    o.take((ok) => {
      taking = false;
      if (ok) for (const [dir, sig] of before) tried.set(dir, sig);
      else tried.clear();
      rewatch();
      if (wait) schedule(wait + 250);
    });
  }

  const look = () => {
    rewatch();
    check();
  };
  const poll = setInterval(look, pollMs);
  poll.unref?.();
  look();
  if (watchers.size) o.note(`watching ${watchers.size} inbox folder${watchers.size > 1 ? "s" : ""} tasks wait on`);

  return {
    folders: () => [...watchers.keys()],
    look,
    end() {
      ended = true;
      clearInterval(poll);
      if (timer) clearTimeout(timer);
      for (const w of watchers.values()) w.close();
      watchers.clear();
    },
  };
}
