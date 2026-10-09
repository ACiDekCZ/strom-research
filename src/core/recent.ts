// What the research added in the last hours, for the Strom app's "last 24 h" (the bridge's /status recent and
// GET <token>/recent?hours=N). Worked out from git, never from the history /log gives: an agent at work makes a
// thousand commits a day, /log gives the last 500 (found live: 17 people added in 24 h, the app said 5).
//
// The people and sources added are the record files that came into data/ between the last commit before the window
// and the commit now — one tree diff, whatever the number of commits between. What was added and merged into
// another or taken back within the window is not counted (its record says so); what was added before is not either.

import type { Env } from "./paths.ts";
import { runGitLater } from "./git.ts";
import { Tree } from "./tree.ts";

/** At most so many IDs of each kind are said (the count is all of them). */
export const RECENT_IDS = 50;
/** The window /status says. */
export const RECENT_HOURS = 24;
/** How long a summary is taken as it is while the research does not change (the window moves on). */
const RECENT_FRESH_MS = 10 * 60_000;

export interface RecentAdded {
  added: number;
  /** The first RECENT_IDS of them, in the order of their IDs. */
  ids: string[];
}

export interface Recent {
  hours: number;
  /** The start of the window: when the summary was worked out, less the hours. */
  since: string;
  /** The last commit before the window; null when the research is younger than the window (all of it counts). */
  from: string | null;
  /** The commit the summary was worked out at (a moment behind /status head while the research changes). */
  head: string;
  /** When it was worked out. */
  at: string;
  /** The commits in the window. */
  commits: number;
  persons: RecentAdded;
  sources: RecentAdded;
}

const RECORD = /^data\/(persons|sources)\/((?:P|S)\d{1,9})\.json$/;

/** What the research added in the last `hours` up to its last commit; undefined when git cannot say (no commit yet). */
export async function recentChanges(root: string, env: Env, hours = RECENT_HOURS, now = Date.now()): Promise<Recent | undefined> {
  const tip = await runGitLater(root, ["rev-parse", "--verify", "-q", "HEAD"]);
  const head = tip.status === 0 ? tip.stdout.trim() : "";
  if (!head) return undefined;
  const since = new Date(now - hours * 3_600_000).toISOString();
  // the history of one research is a line; --first-parent keeps it one should it ever hold a merge
  const base = await runGitLater(root, ["rev-list", "-1", "--first-parent", `--before=${since}`, head]);
  if (base.status !== 0) return undefined;
  const from = base.stdout.trim() || null;
  const [files, count] = await Promise.all([
    from
      ? runGitLater(root, ["diff", "--no-renames", "--name-only", "--diff-filter=A", from, head, "--", "data/persons", "data/sources"])
      : runGitLater(root, ["ls-tree", "-r", "--name-only", head, "--", "data/persons", "data/sources"]),
    runGitLater(root, ["rev-list", "--count", "--first-parent", from ? `${from}..${head}` : head]),
  ]);
  if (files.status !== 0 || count.status !== 0) return undefined;
  const added = { persons: [] as string[], sources: [] as string[] };
  for (const line of files.stdout.split("\n")) {
    const m = RECORD.exec(line.trim());
    if (m) added[m[1] as "persons" | "sources"].push(m[2]!);
  }
  // merged into another or taken back since: not added (as the research counts its people: countLive)
  const tree = Tree.open(root, env);
  const live = (id: string) => {
    let r: { retracted?: unknown; mergedInto?: string } | undefined;
    try {
      r = tree.get(id) as typeof r;
    } catch {
      return false; // a record being written this moment: counted the next time
    }
    return !!r && !r.retracted && !r.mergedInto;
  };
  const said = (ids: string[]): RecentAdded => {
    const kept = ids.filter(live).sort((a, b) => a.length - b.length || a.localeCompare(b));
    return { added: kept.length, ids: kept.slice(0, RECENT_IDS) };
  };
  return {
    hours,
    since,
    from,
    head,
    at: new Date(now).toISOString(),
    commits: Number(count.stdout.trim()) || 0,
    persons: said(added.persons),
    sources: said(added.sources),
  };
}

const kept = new Map<string, { value?: Recent; asking?: boolean }>();

/**
 * The summary of the last 24 hours for /status, never waited for: what was worked out last (its head says at which
 * commit), and worked out again in the background when the research changed or a while went by. None yet: undefined.
 */
export function recentNow(root: string, env: Env, head: string, now = Date.now()): Recent | undefined {
  let k = kept.get(root);
  if (!k) kept.set(root, (k = {}));
  const fresh = k.value && k.value.head === head && now - Date.parse(k.value.at) < RECENT_FRESH_MS;
  if (!fresh && !k.asking && head) {
    k.asking = true;
    const entry = k;
    recentChanges(root, env, RECENT_HOURS)
      .then(
        (v) => {
          if (v) entry.value = v;
        },
        () => {
          // git failed this time: asked again at the next /status
        },
      )
      .finally(() => {
        entry.asking = false;
      });
  }
  return k.value;
}
