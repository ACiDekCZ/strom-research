// How many things wait for the person, kept beside the research (.strom/cache/waiting.json) with a stamp of all they
// are counted from: the research's commit and strom.json, the readings' summary, the questions asked and answered,
// the sends of the Strom app, the settings and the archives' questions, the connectors, the agent and model, the day.
// The menu takes it while the stamp is the same — counted, What waits reads tens of thousands of records of a long
// research (found on a Mac, 781 people and 29 000 scans: six seconds before the menu showed, two at each return to
// it). What waits itself always counts, and keeps what it counted.

import path from "node:path";
import { readJsonIfExists, writeFileAtomic } from "./json.ts";
import { dirStamp, fileStamp, researchStamp } from "./stamp.ts";
import { configDir } from "./paths.ts";
import { connectorsDir } from "./connector.ts";
import { metricsDir } from "./metrics.ts";
import { tuneDir } from "./tuneask.ts";
import { SYNC_INBOX } from "./sync.ts";
import { actsAsArchive } from "./state.ts";
import { VERSION, type Tree } from "./tree.ts";
import type { Env } from "./paths.ts";

/** How many wait: all, those only here in the terminal, those that wait for a reply (core/waiting.ts waitingSplit). */
export interface WaitCount {
  all: number;
  here: number;
  sent: number;
  app: number;
}

const FILE = path.join(".strom", "cache", "waiting.json");

/**
 * All the count stands on, as it is now: small files and folders only, no record read. `shared` the shared folder,
 * `who` the agent and model the research reads with (their questions about the reading of scans).
 */
export function waitingStamp(tree: Tree, env: Env, shared: string | undefined, who: string): string {
  const root = tree.root;
  const metrics = metricsDir(root);
  const connectors = shared ? connectorsDir(shared) : undefined;
  let plugins = "-";
  if (connectors) {
    const top = dirStamp(connectors);
    plugins = `${top}|${top === "-" ? "" : top.split(",").map((e) => dirStamp(path.join(connectors, e.slice(0, e.indexOf("="))))).join(";")}`;
  }
  return [
    VERSION,
    new Date().toISOString().slice(0, 10),
    researchStamp(root),
    actsAsArchive(tree) ? "archive" : "research",
    who,
    shared ?? "-",
    ...["rollup.json", "fetch.jsonl", "models.json"].map((f) => fileStamp(path.join(metrics, f))),
    dirStamp(tuneDir(root)),
    dirStamp(path.join(root, SYNC_INBOX)),
    dirStamp(configDir(env)),
    plugins,
  ].join("\n");
}

/** The count kept with this stamp, if it is. */
export function keptWaiting(tree: Tree, stamp: string): WaitCount | undefined {
  try {
    const kept = readJsonIfExists<{ stamp?: string; count?: WaitCount }>(path.join(tree.root, FILE));
    return kept?.stamp === stamp && kept.count ? kept.count : undefined;
  } catch {
    return undefined;
  }
}

/** Keep a count with its stamp (a folder strom cannot write: only not kept). */
export function keepWaiting(tree: Tree, stamp: string, count: WaitCount): void {
  try {
    writeFileAtomic(path.join(tree.root, FILE), JSON.stringify({ stamp, count }) + "\n");
  } catch {
    // counted again next time
  }
}
