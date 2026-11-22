// An archive's floor stricter than strom's list: the strictest level strom ever saw for a host is kept (core/terms.ts
// archiveLevel) and only the person makes it milder — where strom's own list of archives' terms says the archive allows
// more (a connector, or a research's record of the archive, read it stricter once), that floor is said: by strom doctor,
// strom run, strom allow archive, and as a question in What waits (the person keeps it, or takes what the archive's
// terms say). Computed each time from what is kept — nothing new is written, an older strom reads the file as before.
// Never milder than the archive's terms: the answer is strom's list's level, the person's word alone (exit 4 for an
// agent), and only where nothing else here still holds the stricter level (else lowering the floor would change nothing,
// and strom run and the Chrome hook would disagree).

import path from "node:path";
import type { Tree } from "./tree.ts";
import type { RecordSet, Repository, Source } from "./model.ts";
import type { Env } from "./paths.ts";
import { archiveLevel, loadArchives, rank, type ArchiveLevel, type Level } from "./terms.ts";
import { shippedTerms, strictestEntry, within, bare } from "./knownterms.ts";
import { listConnectors, type Connector } from "./connector.ts";
import { settingsTrust } from "./trust.ts";
import { levelWords } from "./archiveasks.ts";
import { ui } from "../cli/ui.ts";
import { humanDay } from "../cli/human.ts";

/** What else holds an archive at its floor's level now: a connector's reading, the research's record of the archive, the host itself, another settings folder. */
export type FloorHold = { by: "connector"; name: string } | { by: "tree"; repository?: string } | { by: "host" } | { by: "other" };

export interface FloorNote {
  host: string;
  /** The archive as strom's list names it. */
  title: string;
  /** What strom keeps (its floor), whose it is and since when. */
  floor: Level;
  by: "strom" | "agent" | "person";
  at?: string;
  /** The connector whose reading raised it (none: the research's record of the archive, or the terms then). */
  connector?: string;
  /** What strom's list says of the archive: its level, only through a person's browser, the day it was checked. */
  list: Level;
  browserOnly: boolean;
  checked?: string;
  /** What still holds the floor's level besides the floor itself (empty: the floor alone). */
  holds: FloorHold[];
  /** A question for the person in What waits: strom's floor, settings verified as the person's, the floor alone holds it. */
  ask: boolean;
}

/** strom's own list of the host (never a test's or a person's extra file: only the list shipped is the archive's word here). */
function listed(host: string) {
  return strictestEntry(shippedTerms().filter((k) => within(host, k.host)));
}

/** Who holds a level, from a computed level's sources: the connector itself, the tree's record, the host. */
function holdsOf(a: ArchiveLevel, c: Connector | undefined): FloorHold[] {
  const out: FloorHold[] = [];
  for (const f of a.from) {
    if (c && (f === "connector" || f === "new connector" || f === "kept" || f === "pages")) out.push({ by: "connector", name: c.name });
    else if (f === "tree") out.push({ by: "tree", ...(a.repository ? { repository: a.repository } : {}) });
    else if (f === "robots" || f === "refused") out.push({ by: "host" });
  }
  return out;
}

/**
 * Every host whose floor is stricter than strom's list says (the list's level known, not "unknown"): what strom keeps,
 * whose, since when, what the list says and what still holds it — `tree` the research looked at (its records of the
 * archives count). `all`: the person's and the agent's floors too (the listing of strom allow archive); else only
 * strom's own (doctor, run, the question).
 */
export function floorNotes(env: Env, o: { tree?: Tree; shared?: string; all?: boolean } = {}): FloorNote[] {
  const store = loadArchives(env);
  const trust = settingsTrust(env);
  const other = trust.restrictionsFrom ? loadArchives({ STROM_CONFIG_DIR: trust.restrictionsFrom }).archives : {};
  const net = o.shared ? path.join(o.shared, "net") : undefined;
  let connectors: Connector[] | undefined;
  const out: FloorNote[] = [];
  for (const [host, r] of Object.entries(store.archives).sort(([a], [b]) => a.localeCompare(b))) {
    if (!r?.floor || (!o.all && r.floorBy !== "strom")) continue;
    const k = listed(host);
    if (!k || k.level === "unknown" || rank(r.floor) <= rank(k.level)) continue;
    connectors ??= listConnectors(o.shared, env);
    const holds: FloorHold[] = [];
    // another settings folder keeps it too (the person's default folder): lowering it here would not lower it there
    const theirs = other[host]?.floor;
    if (theirs && rank(theirs) >= rank(r.floor)) holds.push({ by: "other" });
    const input = { ...(o.tree ? { tree: o.tree } : {}), ...(net ? { net } : {}), readOnly: true };
    const levels: { a: ArchiveLevel; c?: Connector }[] = [];
    try {
      levels.push({ a: archiveLevel(env, { url: `https://${host}/`, ...input }) });
      for (const c of connectors.filter((x) => x.manifest.hosts.map(bare).includes(host))) levels.push({ a: archiveLevel(env, { ...input, connector: c, url: host }), c });
    } catch {
      continue;
    }
    for (const { a, c } of levels) if (rank(a.level) >= rank(r.floor)) for (const h of holdsOf(a, c)) if (!holds.some((x) => JSON.stringify(x) === JSON.stringify(h))) holds.push(h);
    out.push({
      host,
      title: k.name ?? host,
      floor: r.floor,
      by: r.floorBy ?? "strom",
      ...(r.floorAt ? { at: r.floorAt } : {}),
      ...(r.floorConnector ? { connector: r.floorConnector } : {}),
      list: k.level,
      browserOnly: !!k.browserOnly,
      ...(k.checked ? { checked: k.checked } : {}),
      holds,
      ask: r.floorBy === "strom" && trust.verified && !store.broken && !holds.length,
    });
  }
  return out;
}

/** The question of one host, if it waits (What waits, a link of the Strom app). */
export function floorQuestion(env: Env, host: string, o: { tree?: Tree; shared?: string } = {}): FloorNote | undefined {
  return floorNotes(env, o).find((n) => n.ask && n.host === host);
}

/** What holds a floor, for the agent and in strom's own outputs (English): "connector example-archive", "the research's archive R0001". */
export function holdText(h: FloorHold): string {
  return h.by === "connector" ? `connector ${h.name}` : h.by === "tree" ? `the research's archive${h.repository ? ` ${h.repository}` : ""} (strom repo show${h.repository ? ` ${h.repository}` : ""})` : h.by === "host" ? "the host's own refusal or robots.txt" : "the person's default settings folder";
}

/** Whose reading raised a floor, for the agent and strom's outputs (English). */
export function floorSource(n: Pick<FloorNote, "by" | "connector">): string {
  return n.by === "person" ? "the person" : n.by === "agent" ? "an agent" : n.connector ? `connector ${n.connector}'s reading` : "a research's record of the archive (strom repo) or the terms then";
}

/** strom's list's level of the archive in the person's words (only through a person's browser said so). */
export function listWords(lang: string, n: Pick<FloorNote, "list" | "browserOnly">): string {
  return n.browserOnly && n.list === "restricted" ? ui(lang, "ui.archive.level.browserOnly") : levelWords(lang, n.list);
}

/** One floor in the person's words: what strom keeps since when and why, what strom's list says. */
export function floorLine(lang: string, n: FloorNote): string {
  const source =
    n.by === "person" ? ui(lang, "ui.archive.floor.by.person") : n.by === "agent" ? ui(lang, "ui.archive.floor.by.agent") : n.connector ? ui(lang, "ui.archive.floor.by.connector", { name: n.connector }) : ui(lang, "ui.archive.floor.by.record");
  return ui(lang, "ui.archive.floor", { title: n.title, host: n.host, level: levelWords(lang, n.floor, false, ["floor"]), date: n.at ? humanDay(n.at, lang) : "–", source, checked: n.checked ? humanDay(n.checked, lang) : "–", list: listWords(lang, n) });
}

/** What to do about it, in the person's words: what still holds it (to be changed there first), else who decides and how. */
export function floorWhat(lang: string, n: FloorNote): string {
  if (!n.holds.length) return ui(lang, "ui.archive.floor.decide", { host: n.host, code: n.list });
  const what = n.holds.map((h) =>
    h.by === "connector" ? ui(lang, "ui.archive.floor.hold.connector", { name: h.name }) : h.by === "tree" ? ui(lang, "ui.archive.floor.hold.tree", { id: h.repository ?? "R…" }) : h.by === "host" ? ui(lang, "ui.archive.floor.hold.host") : ui(lang, "ui.archive.floor.hold.other"),
  );
  return ui(lang, "ui.archive.floor.holds", { what: what.join(", ") });
}

/**
 * A level written stricter than strom's list says of the archive (a downloader's policy.automation, a research's record
 * of the archive): said to the agent (English) — stricter stays allowed, but strom keeps it (and remembers it: only the
 * person makes it milder again), and by hand shuts the agent's browser there. Nothing for an archive the list does not
 * know, nor for a level the list's own or milder.
 */
export function stricterThanList(hosts: string[], level: string, what: "connector" | "repo"): string | undefined {
  if (!["allowed", "restricted", "manual", "forbidden", "unknown"].includes(level)) return undefined;
  for (const h of hosts) {
    const k = listed(bare(h));
    if (!k || k.level === "unknown" || rank(level as Level) <= rank(k.level)) continue;
    const name = k.name ?? k.host;
    const as = what === "connector" ? `"automation": "${k.level}"` : `--automation ${k.level === "restricted" ? "unknown (strom's list gives it: restricted)" : k.level}`;
    return (
      `⚠ ${what === "connector" ? "policy.automation" : "automation"} "${level}" is stricter than strom's list of the archive's terms: ${name} ${k.level}${k.browserOnly ? ", only through a person's browser" : ""}${k.checked ? ` (checked ${k.checked}${k.terms ? `, ${k.terms}` : ""})` : ""}. ` +
      `strom keeps the stricter one and remembers it (only the person makes it milder again)${rank(level as Level) >= rank("manual") ? " — by hand only: no agent's browser there, the person saves every image" : ""}. ` +
      `Keep it only with a quote from the archive's terms that says so (DISCOVERY.md, step 1); else ${as}.`
    );
  }
  return undefined;
}

/** Whether the research's records (record sets, archives, sources with an address) name the host or a host of its site. */
export function treeNames(tree: Tree, host: string): boolean {
  for (const r of [...tree.list<RecordSet>("recordset"), ...tree.list<Repository>("repository"), ...tree.list<Source>("source")]) {
    if (!r.url || r.retracted || !URL.canParse(r.url)) continue;
    const h = bare(new URL(r.url).hostname.toLowerCase());
    if (within(h, host) || within(host, h)) return true;
  }
  return false;
}
