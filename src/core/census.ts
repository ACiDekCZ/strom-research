// Census records as a source of the research (spec 106): a household in one year shows who lived with whom and where
// each came from. The setting `census` (core/config.ts censusSwitch) is off unless a person turns it on — the menu's
// settings, the Strom app (POST <token>/census), strom config set census on in a terminal; the tree's own value wins
// both ways. Its tasks (origin census:<…>) are of kind census (core/taskkind.ts) and get the method's census page
// (assets/method/census.md) only while it is on.
//
// While it is off the census tasks open or waiting are held: out of the queue, its counts, /status, GET /queue and
// What waits — computed from the setting, nothing written, so they are back by themselves once it is on again
// (as the history's, core/pastevents.ts historyHeld). A task at work (doing) is never held: its session finishes it;
// left unfinished it is open again, and held from then. A task the person parked stays parked.
//
// The agent never turns it on: it may propose it once in a research (strom census propose — a task of origin
// census:propose waiting for the person, of kind other), never again once one exists in any state; turning it on
// closes the proposal (setTreeSetting), and while it is on a proposal left open shows nowhere.

import type { Task, TreeConfig } from "./model.ts";
import { censusSwitch, type UserConfig } from "./config.ts";
import type { Tree } from "./tree.ts";
import { assetPath } from "./assets.ts";
import { readJsonIfExists } from "./json.ts";
import { shippedTerms } from "./knownterms.ts";

/** What every census task's origin begins with: census:<year>, census:<year>:<house>… */
export const CENSUS_PREFIX = "census:";
/** The agent's proposal to turn census records on (one ever per research). */
export const CENSUS_PROPOSE_ORIGIN = "census:propose";

/** A census task (origin census:…), the proposal not. */
export function forCensus(t: Pick<Task, "origin">): boolean {
  return typeof t.origin === "string" && t.origin.startsWith(CENSUS_PREFIX) && t.origin !== CENSUS_PROPOSE_ORIGIN;
}

/** The agent's proposal to turn census records on. */
export function isCensusProposal(t: Pick<Task, "origin">): boolean {
  return t.origin === CENSUS_PROPOSE_ORIGIN;
}

/** Census records on for this research: its strom.json both ways, else the user's own config. Unset: off. */
export function censusOn(user: UserConfig | undefined, tree: TreeConfig | undefined): boolean {
  return censusSwitch(user, tree);
}

const today = () => new Date().toISOString().slice(0, 10);

/** Open as the queue takes it: open, or parked until a day gone by. */
function openNow(t: Task, day: string): boolean {
  return t.state === "open" || (t.state === "parked" && !!t.parkedUntil && t.parkedUntil <= day);
}

/**
 * Held because census records are off: a census task open (or parked until a day gone by) or waiting — never one at
 * work (doing), never the person's parked one, nothing done or dropped. `on`: the setting now.
 */
export function censusHeld(t: Task, on: boolean, day: string = today()): boolean {
  if (on || !forCensus(t)) return false;
  return t.state === "waiting" || openNow(t, day);
}

/**
 * What shows nowhere now: a held census task, or the proposal still open or waiting while census records are on
 * (turned on where no tree was written — the user's own config — it is closed at the tree's next setting).
 */
export function censusHidden(on: boolean, day: string = today()): (t: Task) => boolean {
  return (t) => censusHeld(t, on, day) || (on && isCensusProposal(t) && (t.state === "waiting" || openNow(t, day)));
}

/** How many census tasks are held now (0 while on). */
export function censusHeldCount(tasks: Task[], on: boolean): number {
  if (on) return 0;
  const day = today();
  return tasks.filter((t) => censusHeld(t, on, day)).length;
}

/** The proposal of this research, in any state (one ever). */
export function censusProposal(tree: Tree): Task | undefined {
  return tree.list<Task>("task").find(isCensusProposal);
}

let days: Record<string, Record<string, string>> | undefined;
/**
 * The reference day of a census (assets/archives.json censusDays: country by its ISO 3166 code → year → ISO day), where
 * strom knows it; else undefined (the year alone stands).
 */
export function censusDay(country: string, year: number | string): string | undefined {
  days ??= readJsonIfExists<{ censusDays?: Record<string, Record<string, string>> }>(assetPath("archives.json"))?.censusDays ?? {};
  const day = days[country.trim().toUpperCase()]?.[String(year).trim()];
  return typeof day === "string" && /^\d{4}-\d\d-\d\d$/u.test(day) ? day : undefined;
}

/**
 * The census records strom's list of archives knows of, one line each for the brief of a census task (spec 106): the
 * archive, its years and area, a name index, how a household is found, the way for strom. Their level and terms hold
 * as for any record.
 */
export function censusHoldings(): string[] {
  return shippedTerms()
    .filter((k) => k.census)
    .map((k) => {
      const c = k.census!;
      const how = { agent: "the agent itself", slow: "one record at a time", "by-hand": "by hand: the person saves the sheet", link: "a link and a task for the person only" }[c.how] ?? c.how;
      const bits = [c.years?.length ? c.years.join(", ") : "years not known", c.area, c.nameIndex ? "a name index" : undefined, c.search?.length ? `found by ${c.search.join(", ")}` : undefined, how];
      return `- ${k.name ?? k.host} (${k.host}): ${bits.filter(Boolean).join(" · ")}`;
    });
}
