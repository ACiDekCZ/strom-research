// A reader's own room, for an agent that fences a reader by folders, never by files: Codex's sandbox writes whole
// folders (writable_roots), agy's workspace opens whole folders (--add-dir). The reports of every reading are in one
// folder (notes/readings), the views of every document in another (.strom/views) — given as they are, a reader could
// write the other readings' reports and results, or open the views of every other document. In its room it gets only
// its own: its report in a folder of its own (mirrored to the real report as it goes, moved there when it ends), its
// views as copies in a folder of their own (a few images; copies, never links — Windows). Its prompt names the
// room's paths in place of the real ones. Claude Code, OpenCode and Grok fence a reader by file and need no room.

import fs from "node:fs";
import path from "node:path";
import type { RunOptions, RunResult } from "./runner.ts";

/** How often the report in the room is mirrored to the real one while the reader works (--until-found looks at it). */
export const ROOM_MIRROR_MS = 1000;

export type ReaderRoom = {
  /** The run's options as the reader is given them: its files and prompt in the room. */
  opts: RunOptions;
  /** Once the reader ended: its report back where strom keeps it, the room taken away. */
  done(): void;
};

/** The folder of a reader's room: the one its caller gave it (beside its settings), else beside the run's log. */
export function roomDir(opts: Pick<RunOptions, "readerFiles" | "logFile">): string {
  return opts.readerFiles?.room ?? `${opts.logFile}.room`;
}

/** Each of `from` replaced in `text` by its new path (the longest first: a path never matched inside a longer one). */
function swap(text: string, paths: Map<string, string>): string {
  let out = text;
  for (const [from, to] of [...paths].sort((a, b) => b[0].length - a[0].length)) if (from !== to) out = out.split(from).join(to);
  return out;
}

/**
 * A reader's room (exported for tests): `report` — its report written in a folder that holds it alone; `views` — its
 * views copied into a folder that holds them alone (a view that cannot be copied stays where it is).
 */
export function readerRoom(opts: RunOptions, what: { report?: boolean; views?: boolean }): ReaderRoom {
  const files = opts.readerFiles;
  if (!files) return { opts, done: () => {} };
  const room = roomDir(opts);
  const paths = new Map<string, string>();
  const made: string[] = [];
  let views = files.views;
  if (what.views) {
    const dir = path.join(room, "views");
    fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(dir, { recursive: true });
    made.push(dir);
    const names = new Set<string>();
    views = files.views.map((v, i) => {
      let name = path.basename(v);
      if (names.has(name)) name = `${i + 1}-${name}`;
      names.add(name);
      const copy = path.join(dir, name);
      try {
        fs.copyFileSync(v, copy);
      } catch {
        return v;
      }
      paths.set(v, copy);
      return copy;
    });
  }
  let report = files.report;
  let mirror: ReturnType<typeof setInterval> | undefined;
  let back = (_last = false) => {};
  if (what.report) {
    const dir = path.join(room, "report");
    fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(dir, { recursive: true });
    made.push(dir);
    const staged = path.join(dir, path.basename(files.report));
    // what strom wrote into the report before the reader begins (its head) is the reader's to go on with
    if (fs.existsSync(files.report)) fs.copyFileSync(files.report, staged);
    let seen = "";
    back = (last = false) => {
      try {
        const st = fs.statSync(staged);
        const now = `${st.size} ${st.mtimeMs}`;
        if (now === seen && !last) return;
        seen = now;
        fs.copyFileSync(staged, files.report);
      } catch {
        // not there (yet), or being written: mirrored the next time
      }
    };
    mirror = setInterval(() => back(), ROOM_MIRROR_MS);
    mirror.unref?.();
    paths.set(files.report, staged);
    report = staged;
  }
  const said = { ...opts, prompt: swap(opts.prompt, paths), kickoff: swap(opts.kickoff, paths), readerFiles: { ...files, views, report } };
  return {
    opts: said,
    done() {
      if (mirror) clearInterval(mirror);
      back(true);
      for (const dir of made) fs.rmSync(dir, { recursive: true, force: true });
    },
  };
}

/** A run in a reader's room: the room taken away whatever its end. */
export function inRoom(room: ReaderRoom, run: (opts: RunOptions) => Promise<RunResult>): Promise<RunResult> {
  let p: Promise<RunResult>;
  try {
    p = run(room.opts);
  } catch (e) {
    room.done();
    throw e;
  }
  return p.finally(() => room.done());
}
