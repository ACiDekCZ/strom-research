// What a link of the Strom app was taken (feature handoffs): the app adds &handoff=<uuid> to a strom-research:// link
// and waits for the research to say it came — a terminal opened for it, or what needs none done — else, after its
// patience, it asks "the terminal did not open?". strom link open writes the id into the research's .strom/handoffs/
// (one empty file per id, its time in it: two links at once never lose each other's); the bridge, when one runs, says
// the ids of the last HANDOFF_MS in GET /status (handoffs), outside what it keeps of /status for a state. No bridge:
// nothing is said, the file goes with the next look. Only an id of one shape is ever written — the link's own words never.

import fs from "node:fs";
import path from "node:path";

/** How long a link's id is said after it was taken. */
export const HANDOFF_MS = 60_000;

/** The shape of a link's id: a UUID, as the app makes it (crypto.randomUUID). */
export const HANDOFF = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** At most so many ids kept: a page opening links over and over fills nothing. */
const HANDOFF_MAX = 64;

function folderOf(root: string): string {
  return path.join(root, ".strom", "handoffs");
}

/** The ids taken in the last HANDOFF_MS, the newest first, at most HANDOFF_MAX; older ones, the oldest beyond
 * HANDOFF_MAX and anything not of the shape (a folder too) removed. Never throws. */
export function handoffsNow(root: string, now: number = Date.now()): string[] {
  const dir = folderOf(root);
  let names: string[];
  try {
    names = fs.readdirSync(dir);
  } catch {
    return [];
  }
  const fresh: { id: string; at: number }[] = [];
  for (const name of names) {
    const file = path.join(dir, name);
    // one being written by a link at this moment: left alone while it is young
    if (name.endsWith(".tmp")) {
      try {
        if (now - fs.statSync(file).mtimeMs < HANDOFF_MS) continue;
      } catch {
        continue;
      }
    }
    let at = Number.NaN;
    if (HANDOFF.test(name)) {
      try {
        at = Number(fs.readFileSync(file, "utf8").trim());
      } catch {
        // a folder of an id's name (nothing strom writes): removed like anything else of no time; a file being
        // renamed at this moment is read with the next look
        try {
          if (!fs.statSync(file).isDirectory()) continue;
        } catch {
          continue;
        }
      }
    }
    // its time, or one a moment ahead (another computer's clock): within the window; else gone
    if (Number.isFinite(at) && at <= now + HANDOFF_MS && now - at < HANDOFF_MS) fresh.push({ id: name, at });
    else
      try {
        fs.rmSync(file, { force: true, recursive: true });
      } catch {
        // gone with the next look
      }
  }
  fresh.sort((a, b) => b.at - a.at);
  // the folder keeps at most HANDOFF_MAX: the oldest beyond go, not only from what is said
  for (const old of fresh.slice(HANDOFF_MAX))
    try {
      fs.rmSync(path.join(dir, old.id), { force: true });
    } catch {
      // gone with the next look
    }
  return fresh.slice(0, HANDOFF_MAX).map((h) => h.id);
}

/** A link's id taken in this research: written for the bridge to say. Only an id of the shape; never throws. */
export function noteHandoff(root: string, id: string, now: number = Date.now()): boolean {
  if (!HANDOFF.test(id)) return false;
  const dir = folderOf(root);
  try {
    fs.mkdirSync(dir, { recursive: true });
    const tmp = path.join(dir, `.${id}.${process.pid}.tmp`);
    fs.writeFileSync(tmp, String(now));
    fs.renameSync(tmp, path.join(dir, id));
  } catch {
    return false;
  }
  // the old ones go now, so the folder stays small with no bridge to look
  try {
    if (fs.readdirSync(dir).length > HANDOFF_MAX) handoffsNow(root, now);
  } catch {
    // said by the next look
  }
  return true;
}
