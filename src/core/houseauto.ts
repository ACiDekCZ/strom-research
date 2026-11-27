// The history of the tree's houses by itself (spec 030 part 2): with the research's setting `houses` on, the houses where
// the family lived long enough over a hundred years ago get their tasks — a municipality's skeleton once (its lordship,
// parish, cadastral area, where its land registers are: house:town:<L…>), then its houses, neighbouring houses of one
// family together (house:<A…>, the others in the task's `houses`) — a few open at once, behind the family research.
// A house the person asks for (strom house request, the Strom app's link house&do=search) comes on top whatever the
// setting says. Off: the tasks raised by themselves are held (core/houses.ts houseHeld), nothing written.

import { UsageError } from "./errors.ts";
import type { House, Input, Person, Place, Search, Session, Task } from "./model.ts";
import {
  dropNoMoreLook,
  findHouse,
  forHouse,
  houseIndex,
  houseLookOrigin,
  houseOrigin,
  houseRows,
  housesOfTask,
  housesStatus,
  houseWork,
  recordOf,
  setHouse,
  townOfTask,
  townOrigin,
  townRecord,
  townRecordOf,
  type HouseRow,
  type HouseState,
} from "./houses.ts";
import { kinship } from "./kin.ts";
import { webRequestsOf } from "./metrics.ts";
import { sourceChecklist } from "./housesources.ts";
import { layersFor } from "./maplayers.ts";
import { familiesAsChild } from "./people.ts";
import { create, update } from "./records.ts";
import { Settings } from "./config.ts";
import { actsAsArchive } from "./state.ts";
import { phrase } from "./phrases.ts";
import { foldText } from "./text.ts";
import { now, type Tree } from "./tree.ts";
import { unreadClaimLine, unreadWebClaims } from "./houseunread.ts";

/** How many groups of houses raised by themselves are open at once (their municipalities' tasks besides). */
export const HOUSE_AUTO_OPEN = 3;
/** How many houses one task takes at most: its own and neighbouring ones of the same family in the same municipality. */
export const HOUSE_GROUP_MAX = 3;
/** A house's oldest fact older than this many years (K6.2: a place lived in more than a hundred years ago). */
export const HOUSE_AGE = 100;
/** The family there this many years at least (the span of its facts), or two generations. */
export const HOUSE_SPAN = 30;
/** What a house and a municipality's skeleton take before this research measured them (minutes). */
export const HOUSE_MINUTES = 30;
export const TOWN_MINUTES = 20;
/** Sessions measured before a price is said: never guessed. */
export const HOUSE_MEASURED_MIN = 3;
/** The level of the tasks of houses: adding to what the tree knows. */
export const HOUSE_LEVEL = "enrich" as const;

const LIVE = new Set<Task["state"]>(["open", "doing", "parked", "waiting"]);

/** A house the research of houses takes by itself. */
export interface AutoHouse {
  key: string;
  /** Its record, where it has one. */
  id?: string;
  /** Its municipality (L…). */
  town: string;
  persons: string[];
  /** The direct ancestors of the tree among them. */
  ancestors: string[];
  from: number;
  to: number;
  state: HouseState;
  row: HouseRow;
}

const thisYear = () => new Date().getFullYear();

/**
 * Whether a house is one the research takes by itself (spec 030 part 2): (a) a direct ancestor of the tree has a fact
 * in it, (b) the family lived there two generations (a parent and a child of the tree both have facts in it) or
 * HOUSE_SPAN years (its facts' span), (c) its oldest fact is older than HOUSE_AGE years, (d) its municipality is a place
 * record.
 */
function qualifies(tree: Tree, row: HouseRow, kin: Map<string, number>, year: number): AutoHouse | undefined {
  const th = row.tree;
  if (!th || !row.place.id) return undefined;
  const persons = [...th.persons].sort();
  const ancestors = persons.filter((p) => kin.get(p) === 0);
  if (!ancestors.length || !th.years.length) return undefined;
  const from = Math.min(...th.years);
  const to = Math.max(...th.years);
  if (!(from < year - HOUSE_AGE)) return undefined;
  const twoGenerations = persons.some((p) => familiesAsChild(tree, p).some((f) => f.partners.some((q) => th.persons.has(q))));
  if (!twoGenerations && to - from < HOUSE_SPAN) return undefined;
  return { key: row.key, ...(row.id ? { id: row.id } : {}), town: row.place.id, persons, ancestors, from, to, state: row.state, row };
}

/**
 * The houses the research of houses takes by itself and their municipalities (D: /status.houses.auto), every one of
 * them whatever is open now (no HOUSE_AUTO_OPEN): the most ancestors first, then the oldest.
 */
export function houseAuto(tree: Tree, rows: HouseRow[] = houseRows(tree)): { houses: AutoHouse[]; towns: string[] } {
  const kin = kinship(tree);
  const year = thisYear();
  const houses = rows
    .map((r) => qualifies(tree, r, kin, year))
    .filter((x): x is AutoHouse => !!x)
    .sort((a, b) => b.ancestors.length - a.ancestors.length || a.from - b.from || a.key.localeCompare(b.key));
  return { houses, towns: [...new Set(houses.map((h) => h.town))] };
}

/** What one session of a kind took here, measured (minutes and its price), the middle of them. */
function measured(tree: Tree, pick: (t: Task) => boolean): { minutes: number; usd: number } | undefined {
  const tasks = new Map(tree.list<Task>("task").map((t) => [t.id, t]));
  const done = tree
    .list<Session>("session")
    .filter((s) => s.state !== "open" && s.ended && !s.metrics?.costPartial && (s.metrics?.costUsd ?? 0) > 0 && !!s.task && tasks.has(s.task) && pick(tasks.get(s.task)!));
  if (done.length < HOUSE_MEASURED_MIN) return undefined;
  const mid = (xs: number[]) => xs.sort((a, b) => a - b)[Math.floor((xs.length - 1) / 2)]!;
  const minutes = mid(done.map((s) => Math.max(1, Math.round((Date.parse(s.ended!) - Date.parse(s.started)) / 60_000))));
  const usd = mid(done.map((s) => s.metrics!.costUsd! + (s.metrics!.readersUsd ?? 0)));
  return { minutes, usd: Math.round(usd * 100) / 100 };
}

/**
 * What the research of houses would take (before the person turns it on, asks for one): the houses not done and the
 * municipalities whose skeleton is not, each by what such sessions took here — fewer than HOUSE_MEASURED_MIN measured:
 * HOUSE_MINUTES and TOWN_MINUTES, no price (never guessed).
 */
export function houseEstimate(
  tree: Tree,
  auto: { houses: AutoHouse[]; towns: string[] } = houseAuto(tree),
): { houses: number; towns: number; minutes: number; usd?: number; measured: boolean; perHouse: { minutes: number; usd?: number }; perTown: { minutes: number; usd?: number } } {
  const houses = auto.houses.filter((h) => h.state !== "done").length;
  const towns = auto.towns.filter((id) => !townRecord(tree, id)?.done).length;
  const house = measured(tree, (t) => houseWork(t) === "house");
  const town = measured(tree, (t) => houseWork(t) === "town");
  const perHouse = house ? { minutes: house.minutes, usd: house.usd } : { minutes: HOUSE_MINUTES };
  const perTown = town ? { minutes: town.minutes, usd: town.usd } : { minutes: TOWN_MINUTES };
  const minutes = towns * perTown.minutes + houses * perHouse.minutes;
  const usd = (houses === 0 || house) && (towns === 0 || town) && (houses || towns) ? Math.round(((house?.usd ?? 0) * houses + (town?.usd ?? 0) * towns) * 100) / 100 : undefined;
  return { houses, towns, minutes, ...(usd !== undefined ? { usd } : {}), measured: !!house, perHouse, perTown };
}

/**
 * /status houses (spec 030 §2.2, feature house; part 2: house.auto): on — the setting as it holds for this research (the
 * tree's own value both ways); counts by state, held the tasks the setting off keeps aside; auto — the houses and
 * municipalities the research would take by itself (before the person turns it on) and estimate — what they and one
 * house take, both only once the tree's facts give a house; layers — the map layers whose box holds a municipality of
 * a house (none: left out). An archive (a research waiting for its agent too): on false, zeros, nothing more.
 */
export function housesBridgeStatus(tree: Tree, settings: Settings, archive: boolean = actsAsArchive(tree)): Record<string, unknown> {
  const on = !archive && settings.houses(tree.config);
  const rows = houseRows(tree, { on });
  const base = housesStatus(tree, archive, on, rows);
  if (archive) return base;
  // the look of the houses (spec 145 T1): a task of its look after a house's research, the person's switch (houses.look)
  const out: Record<string, unknown> = { ...base, look: settings.housesLook(tree.config) };
  if (rows.some((r) => r.tree?.persons.size)) {
    const auto = houseAuto(tree, rows);
    out.auto = { houses: auto.houses.length, towns: auto.towns.length };
    out.estimate = houseEstimate(tree, auto);
  }
  const layers = layersFor(tree, rows);
  if (layers) out.layers = layers;
  return out;
}

/** A municipality's skeleton done or begun (its record done, or a task of it alive). */
export function townBegun(tree: Tree, place: string): boolean {
  if (tree.list<House>("house").some((h) => !h.retracted && h.town && h.place === place && !!h.done)) return true;
  return tree.list<Task>("task").some((t) => t.origin === townOrigin(place) && LIVE.has(t.state));
}

/**
 * What houses asked for take (strom house request, the link house&do=search): each house by what such sessions took
 * here, its municipality's skeleton besides when it is neither done nor begun; the price of a house only once measured.
 */
export function houseAskEstimate(tree: Tree, place: string, houses: number): { minutes: number; usd?: number; measured: boolean } {
  const est = houseEstimate(tree);
  const minutes = est.perHouse.minutes * houses + (townBegun(tree, place) ? 0 : est.perTown.minutes);
  return { minutes, ...(est.perHouse.usd !== undefined ? { usd: est.perHouse.usd } : {}), measured: est.measured };
}

/** The surnames of people, folded (the neighbouring houses of one family share one). */
function surnames(tree: Tree, persons: string[]): Set<string> {
  const out = new Set<string>();
  for (const id of persons) for (const n of tree.get<Person>(id)?.names ?? []) if (n.surname?.trim()) out.add(foldText(n.surname));
  return out;
}

/** The last time the person asked for any of these houses (or this municipality) — "" never. */
function lastAsked(tasks: Task[], of: (t: Task) => boolean): string {
  return tasks.filter(of).reduce((m, t) => (t.asked && t.asked > m ? t.asked : m), "");
}

/** A task of these dropped since the person last asked: the answer, never raised again by itself. */
function answered(tasks: Task[], of: (t: Task) => boolean): boolean {
  const since = lastAsked(tasks, of);
  return tasks.some((t) => of(t) && t.state === "dropped" && t.updated >= since);
}

const ofHouse = (row: { id?: string; key: string }) => (t: Task) => housesOfTask(t).some((h) => h === row.id || h === row.key);
const ofTown = (place: string) => (t: Task) => townOfTask(t) === place;

const placeName = (p: Place) => p.names[0]?.name ?? p.id;

/** A municipality's skeleton task, made. */
function createTownTask(tree: Tree, place: Place, asked?: string): Task {
  const lang = tree.lang;
  const town = placeName(place);
  return create<Task>(
    tree,
    "task",
    {
      level: HOUSE_LEVEL,
      priority: 1,
      subject: [place.id],
      state: "open",
      what: phrase(lang, "house.town.what", { town }).slice(0, 200),
      where: [phrase(lang, "house.town.where", { town })],
      why: phrase(lang, "house.town.why").slice(0, 1000),
      doneWhen: phrase(lang, "house.town.done", { place: place.id }).slice(0, 500),
      origin: townOrigin(place.id),
      ...(asked ? { asked } : {}),
    },
    (id) => `+${id} task "skeleton of the municipality ${place.id}" (houses)`,
  );
}

/** A house's task (with its neighbouring houses), made. */
function createHouseTask(tree: Tree, records: House[], place: Place, asked?: string): Task {
  const lang = tree.lang;
  const town = placeName(place);
  const [first, ...more] = records;
  const label = (h: House) => `${town} ${h.house}${h.name ? ` (${h.name})` : ""}`;
  const what = more.length ? phrase(lang, "house.research.what.more", { house: label(first!), more: more.map((h) => h.house).join(", ") }) : phrase(lang, "house.research.what", { house: label(first!) });
  return create<Task>(
    tree,
    "task",
    {
      level: HOUSE_LEVEL,
      priority: 1,
      subject: records.map((h) => h.id),
      state: "open",
      what: what.slice(0, 200),
      where: [phrase(lang, "house.research.where", { town })],
      why: phrase(lang, "house.research.why").slice(0, 1000),
      doneWhen: phrase(lang, "house.research.done", { id: records.map((h) => h.id).join(", ") }).slice(0, 500),
      origin: houseOrigin(first!.id),
      ...(more.length ? { houses: more.map((h) => h.id) } : {}),
      ...(asked ? { asked } : {}),
    },
    (id) => `+${id} task "history of the house ${first!.id}${more.length ? ` with ${more.map((h) => h.id).join(", ")}` : ""}" (houses)`,
  );
}

/** A house's look after its research (spec 145 T1), with its neighbouring houses: why it follows said in its task. */
function createLookTask(tree: Tree, records: House[], place: Place, why: string, asked?: string): Task {
  const lang = tree.lang;
  const town = placeName(place);
  const [first, ...more] = records;
  const label = `${town} ${first!.house}${first!.name ? ` (${first!.name})` : ""}${more.length ? `, ${more.map((h) => h.house).join(", ")}` : ""}`;
  return create<Task>(
    tree,
    "task",
    {
      level: HOUSE_LEVEL,
      priority: 1,
      subject: records.map((h) => h.id),
      state: "open",
      what: phrase(lang, "house.look.what", { house: label }).slice(0, 200),
      where: [phrase(lang, "house.look.where", { house: label })],
      why: phrase(lang, "house.look.why", { why }).slice(0, 1000),
      doneWhen: phrase(lang, "house.look.done", { id: records.map((h) => h.id).join(", ") }).slice(0, 500),
      origin: houseLookOrigin(first!.id),
      ...(more.length ? { houses: more.map((h) => h.id) } : {}),
      ...(asked ? { asked } : {}),
    },
    (id) => `+${id} task "look of the house ${first!.id}${more.length ? ` with ${more.map((h) => h.id).join(", ")}` : ""}" (houses)`,
  );
}

/** The searches and pages a session needs at least for its list of sources to count as gone through (spec 145 T5). */
export const HOUSE_CHECK_MIN = 3;
/** The agents whose searches and pages strom sees (their hooks): where the list is measured. */
const MEASURED_AGENTS = new Set(["claude", "grok"]);

/**
 * What a house's research or a municipality's skeleton still lacks before an agent closes it done (spec 145 T5, T1):
 * the one line of its list of sources gone through, written in its sessions; a house's short look (or what is not known
 * of it) and, with the look of the houses on, its look check; and — where strom sees them (an agent with hooks) — at
 * least HOUSE_CHECK_MIN searches and pages in its sessions. The time is never chased: only what was gone through.
 * Nothing for any other task.
 */
export function houseDoneLacks(tree: Tree, t: Task, settings: Settings = new Settings(tree.env, {})): string[] {
  const work = houseWork(t);
  if (work !== "house" && work !== "town") return [];
  const sessions = tree.list<Session>("session").filter((s) => s.task === t.id);
  const since = sessions.map((s) => s.started.slice(0, 10)).sort()[0] ?? "";
  const town = work === "town" ? townOfTask(t) : undefined;
  const recs = work === "town" ? [town ? townRecord(tree, town) : undefined] : housesOfTask(t).map((id) => tree.get<House>(id));
  const lacks: string[] = [];
  const look = settings.housesLook(tree.config);
  for (const [i, h] of recs.entries()) {
    const id = h?.id ?? (work === "town" ? town ?? "?" : housesOfTask(t)[i] ?? "?");
    const ref = work === "town" ? `--town ${town}` : id;
    if (!h?.passed.some((x) => x.checklist && (x.at ?? "") >= since)) lacks.push(`${id}: the one line of the list of sources gone through — strom house add passed ${ref} --checklist --what "<gone through: …>"`);
    if (work !== "house") continue;
    if (!h?.look && !h?.unknown.some((u) => u.about === "look")) lacks.push(`${id}: its short look — strom house add look ${id} --text "…" --certainty …, or nothing of it known: ${look ? `strom house add look-check ${id} --next none --text "<why>" (strom writes what is not known of it)` : `strom house add unknown ${id} --look --text "<why not known>"`}`);
    if (look && !(h?.lookCheck && h.lookCheck.at.slice(0, 10) >= since)) lacks.push(`${id}: the look check — strom house add look-check ${id} --next material|picture|source|none --text "…"`);
  }
  // a claim on a source with a web address nobody of the research read, not gone through (spec 145 T7)
  for (const c of unreadWebClaims(tree, recs)) lacks.push(`${c.house}: taken over unread — ${unreadClaimLine(c, work === "town" ? `--town ${town}` : c.house)}`);
  const measured = sessions.filter((s) => MEASURED_AGENTS.has(s.agent ?? ""));
  if (measured.length) {
    let n = 0;
    for (const s of measured) {
      const w = webRequestsOf(tree.root, { session: s.id });
      n += w.search + [...w.hosts.values()].reduce((a, b) => a + b, 0);
    }
    n += tree.list<Search>("search").filter((x) => x.task === t.id).length;
    if (n < HOUSE_CHECK_MIN) lacks.push(`the sources of the list themselves: ${n} searches and pages in this task's sessions — go through the brief's list, then close`);
  }
  return lacks;
}

/**
 * A task of houses closed done: a municipality's skeleton keeps its day; a house's research whose look check found more
 * to read (material, picture, source) is followed by a task of its look — with the look of the houses on, one for its
 * houses that have none alive (spec 145 T1). Its ID, if one was made.
 */
export function houseTaskDone(tree: Tree, t: Task, settings: Settings = new Settings(tree.env, {})): string | undefined {
  markTownDone(tree, t);
  if (houseWork(t) !== "house" || tree.dryRun || actsAsArchive(tree) || !settings.housesLook(tree.config)) return undefined;
  return tree.withTreeLock(() => {
    const tasks = tree.list<Task>("task").filter(forHouse);
    const more = housesOfTask(t)
      .map((id) => tree.get<House>(id))
      .filter((h): h is House => !!h && !!h.lookCheck && h.lookCheck.next !== "none" && (!h.lookCheck.task || h.lookCheck.task === t.id))
      .filter((h) => !tasks.some((x) => houseWork(x) === "look" && housesOfTask(x).includes(h.id) && LIVE.has(x.state)));
    const place = more[0] ? tree.get<Place>(more[0].place) : undefined;
    if (!place) return undefined;
    return createLookTask(tree, more, place, more.map((h) => `${h.id} (${h.lookCheck!.next}): ${h.lookCheck!.text}`).join("; "), t.asked ? new Date().toISOString() : undefined).id;
  });
}

/**
 * A municipality's skeleton task, where it needs one: none when its skeleton is done or it has a task alive (that one
 * returned), none raised by itself when its last one was dropped since the person last asked.
 */
function townTask(tree: Tree, place: Place, tasks: Task[], asked?: string): { task?: Task; made: boolean } {
  if (townRecord(tree, place.id)?.done) return { made: false };
  const live = tasks.find((t) => ofTown(place.id)(t) && LIVE.has(t.state));
  if (live) return { task: live, made: false };
  if (!asked && answered(tasks, ofTown(place.id))) return { made: false };
  return { task: createTownTask(tree, place, asked), made: true };
}

/**
 * The tasks of houses raised by themselves (with the setting houses on; never in an archive): the houses houseAuto
 * takes that have no task alive, none done and no answer (a task dropped since the last ask), the most ancestors first
 * — HOUSE_AUTO_OPEN groups open at once, each with its neighbouring houses of the same family in the same municipality
 * (HOUSE_GROUP_MAX) and its municipality's skeleton before it. Inside the tree's lock. What it made: T… and A….
 */
export function raiseHouseTasks(tree: Tree, settings: Settings = new Settings(tree.env, {})): string[] {
  if (tree.dryRun || !settings.houses(tree.config) || actsAsArchive(tree)) return [];
  return tree.withTreeLock(() => {
    const tasks = tree.list<Task>("task").filter(forHouse);
    let open = tasks.filter((t) => LIVE.has(t.state) && houseWork(t) === "house" && !t.asked).length;
    if (open >= HOUSE_AUTO_OPEN) return [];
    const index = houseIndex(tree);
    const auto = houseAuto(tree, houseRows(tree, { index, on: true }));
    const free = auto.houses.filter((a) => a.state === "none" && !answered(tasks, ofHouse(a.row)));
    const made: string[] = [];
    const taken = new Set<string>();
    for (const a of free) {
      if (open >= HOUSE_AUTO_OPEN) break;
      if (taken.has(a.key)) continue;
      const names = surnames(tree, a.persons);
      const group = [a, ...free.filter((b) => b !== a && !taken.has(b.key) && b.town === a.town && [...surnames(tree, b.persons)].some((n) => names.has(n))).slice(0, HOUSE_GROUP_MAX - 1)];
      for (const g of group) taken.add(g.key);
      const place = tree.get<Place>(a.town)!;
      const town = townTask(tree, place, tree.list<Task>("task").filter(forHouse));
      if (town.made) made.push(town.task!.id);
      const records = group.map((g) => {
        const had = !!g.row.record;
        const h = recordOf(tree, g.row);
        if (!had) made.push(h.id);
        return h;
      });
      made.push(createHouseTask(tree, records, place).id);
      open++;
    }
    return made;
  });
}

/**
 * The person asks for the history of a house (strom house request, the Strom app's link house&do=search after the
 * person's yes): only a house where somebody of the tree lived, its municipality a place record, in a research with
 * its agent. Its task (with at most HOUSE_GROUP_MAX − 1 more houses of the same municipality) on top of the queue —
 * one alive moved there, a done house asked again (what was gone through is not gone through again: the brief says
 * it) — and its municipality's skeleton when it has none, before it. Whatever the setting houses says. Inside the lock.
 */
export function askHouse(
  tree: Tree,
  ref: string,
  withRefs: string[] = [],
  _settings?: Settings,
  opts: { top?: boolean } = {},
): { task: string; house: string; houses: string[]; town?: string; state: HouseState; made: boolean; again: boolean } {
  if (actsAsArchive(tree)) throw new UsageError("an archive looks for nothing", { code: "house.archive" });
  if (withRefs.length > HOUSE_GROUP_MAX - 1) throw new UsageError(`at most ${HOUSE_GROUP_MAX - 1} more houses with it (--with)`, { code: "house.body" });
  return tree.withTreeLock(() => {
    const rows = houseRows(tree, { on: true });
    const row = findHouse(tree, ref, rows);
    const lived = (r: HouseRow) => {
      if (!r.tree?.persons.size) throw new UsageError(`nobody of the tree lived in the house ${r.id ?? r.key} — only such a house is researched`, { code: "house.unknown", hint: "strom house list" });
    };
    lived(row);
    const more = withRefs.map((w) => findHouse(tree, w, rows)).filter((r) => r.key !== row.key);
    for (const r of more) {
      lived(r);
      if (r.place.id !== row.place.id) throw new UsageError(`${r.id ?? r.key} is in another municipality than ${row.id ?? row.key} — only houses of one municipality go together`, { code: "house.body" });
    }
    const group = [row, ...more.filter((r, i) => more.findIndex((x) => x.key === r.key) === i)];
    const records = group.map((r) => recordOf(tree, r));
    const place = tree.get<Place>(records[0]!.place)!;
    const at = new Date().toISOString();
    const top = opts.top !== false;
    const tasks = tree.list<Task>("task").filter(forHouse);
    const town = townTask(tree, place, tasks, at);
    const live = tasks.find((t) => ofHouse(row)(t) && LIVE.has(t.state) && houseWork(t) === "house");
    const again = !live && row.state === "done";
    let task: Task;
    if (live) {
      const add = records.slice(1).map((h) => h.id).filter((id) => !housesOfTask(live).includes(id));
      task = toTop(tree, live, at, add, top);
    } else {
      task = createHouseTask(tree, records, place, at);
      if (top) task = toTop(tree, task, at);
    }
    // the municipality's skeleton before its house: "next" a moment later (the latest next goes first)
    if (town.task && top) toTop(tree, town.task, new Date(Date.parse(at) + 1).toISOString());
    return { task: task.id, house: records[0]!.id, houses: records.map((h) => h.id), ...(town.task ? { town: town.task.id } : {}), state: row.state, made: !live, again };
  });
}

/** A task asked by the person (never held), on top of the queue unless `top` is false, its neighbouring houses added. */
function toTop(tree: Tree, t: Task, at: string, add: string[] = [], top = true): Task {
  return update<Task>(
    tree,
    t.id,
    "task",
    (x) => ({
      ...x,
      ...(x.state === "parked" ? { state: "open" as const } : {}),
      ...(top ? { queueAt: { do: "next" as const, at } } : {}),
      asked: at,
      ...(add.length ? { houses: [...(x.houses ?? []), ...add], subject: [...new Set([...x.subject, ...add])] } : {}),
    }),
    { op: "task.order", summary: `${t.id} asked by the person${top ? ": next" : ""}${add.length ? ` (+${add.join(", ")})` : ""}` },
  );
}

/** A municipality's skeleton done (its task closed done): the day kept in its record, made if it had none. */
export function markTownDone(tree: Tree, t: Task, day: string = new Date().toISOString().slice(0, 10)): void {
  const id = townOfTask(t);
  const place = id ? tree.get<Place>(id) : undefined;
  if (!place) return;
  tree.withTreeLock(() => {
    const rec = townRecordOf(tree, place);
    update<House>(tree, rec.id, "house", (h) => ({ ...h, done: day }), { op: "house.set", summary: `${rec.id} skeleton done (${t.id})` });
  });
}

/**
 * Material given to a house while the houses are on (strom house add material, the bridge's POST /houses/material, a
 * batch's house): the house gets its task when it has none alive — one asked, on top (the person gave it). Off: the
 * material is only kept. Inside the lock; the task's ID, if one was made or moved.
 */
export function houseTaskForMaterial(tree: Tree, houseId: string, settings: Settings = new Settings(tree.env, {})): string | undefined {
  if (tree.dryRun || !settings.houses(tree.config) || actsAsArchive(tree)) return undefined;
  return tree.withTreeLock(() => {
    const rows = houseRows(tree, { on: true });
    const row = rows.find((r) => r.id === houseId);
    if (!row?.tree?.persons.size || !row.place.id) return undefined;
    const tasks = tree.list<Task>("task").filter(forHouse);
    if (tasks.some((t) => ofHouse(row)(t) && LIVE.has(t.state))) return undefined;
    // its research done: the material is for its look (spec 145 T1), with the look of the houses on
    const rec = row.state === "done" && settings.housesLook(tree.config) ? tree.get<House>(houseId) : undefined;
    const place = rec ? tree.get<Place>(rec.place) : undefined;
    if (rec && place) {
      const id = createLookTask(tree, [rec], place, phrase(tree.lang, "house.look.material"), new Date().toISOString()).id;
      // its check said no more automatically: the material says otherwise now (N5) — the research's own word of it gone
      if (rec.lookCheck?.next === "none")
        setHouse(tree, rec.id, (x) => {
          dropNoMoreLook(x, tree.lang);
          x.lookCheck = { next: "material", text: phrase(tree.lang, "house.look.material"), at: now(), origin: "research" };
        }, "look check: material given after its research");
      return id;
    }
    return askHouse(tree, houseId, [], settings, { top: false }).task;
  });
}

/**
 * What a session on a house or a municipality is given for free (the brief): the people of the tree in each house with
 * their years and facts there, the municipality's skeleton, what was gone through and what is only by hand, its
 * material, the neighbouring houses of the task.
 */
export function houseBrief(tree: Tree, t: Task): string | undefined {
  const work = houseWork(t);
  if (work === "town") {
    const place = tree.get<Place>(townOfTask(t) ?? "");
    if (!place) return undefined;
    const rec = townRecord(tree, place.id);
    const rows = houseRows(tree, { town: place.id, on: true });
    const out = [`## The municipality ${place.id} ${placeName(place)}: the skeleton of its houses`];
    out.push(...townLines(rec));
    out.push(...unreadLines(tree, [rec], `--town ${place.id}`));
    const auto = new Set(houseAuto(tree, rows).houses.map((a) => a.key));
    const ours = rows.filter((r) => r.tree?.persons.size);
    if (ours.length) out.push(`houses of the tree here: ${ours.map((r) => `${r.house}${auto.has(r.key) ? "*" : ""}`).join(", ")} (* researched by itself)`);
    out.push(...sourceChecklist(tree, place.id, "town"));
    return out.join("\n");
  }
  if (work !== "house" && work !== "look") return undefined;
  const ids = housesOfTask(t);
  const rows = houseRows(tree, { on: true });
  const out: string[] = [];
  const first = rows.find((r) => r.id === ids[0] || r.key === ids[0]);
  const town = first?.place.id ? townRecord(tree, first.place.id) : undefined;
  for (const id of ids) {
    const row = rows.find((r) => r.id === id || r.key === id);
    if (!row) continue;
    out.push(`## The house ${row.id ?? row.key}: ${row.place.name} ${row.house}${row.name ? ` (${row.name})` : ""}${row.years ? `, facts ${row.years.from}–${row.years.to}` : ""}`);
    const byPerson = new Map<string, string[]>();
    for (const { owner, event } of row.tree?.events ?? []) {
      const who = owner.type === "person" ? [owner.id] : owner.partners;
      for (const p of who) byPerson.set(p, [...(byPerson.get(p) ?? []), `${event.id} ${event.kind}${event.date ? ` ${event.date}` : ""}`]);
    }
    for (const [p, facts] of [...byPerson].sort((a, b) => a[0].localeCompare(b[0]))) {
      const person = tree.get<Person>(p);
      const n = person?.names[0];
      out.push(`  ${p} ${n ? `${n.given} ${n.surname}`.trim() : ""}: ${facts.join("; ")}`);
    }
    const h = row.record ? tree.get<House>(row.record.id) : undefined;
    if (h?.passed.length) out.push(`  gone through already (never again): ${h.passed.map((x) => `${x.what}${x.url ? ` <${x.url}>` : ""}`).join("; ")}`);
    if (h?.manual.length) out.push(`  by hand only (the person's, never opened): ${h.manual.map((x) => `${x.what}${x.url ? ` <${x.url}>` : ""}`).join("; ")}`);
    if (h?.unknown.length) out.push(`  not known: ${h.unknown.map((x) => x.text).join("; ")}`);
    if (work === "house") out.push(...unreadLines(tree, [h]));
    // its look so far, and why a task of its look follows the research (spec 145 T1)
    if (work === "look") {
      if (h?.look) out.push(`  its look so far: ${h.look.text} [${h.look.certainty}]${h.look.images?.length ? ` (${h.look.images.length} picture(s))` : ""}`);
      if (h?.lookCheck) out.push(`  why its look is researched further (${h.lookCheck.next}): ${h.lookCheck.text}`);
    }
    for (const i of row.materials.map((m) => tree.get<Input>(m)).filter((x): x is Input => !!x))
      out.push(`  material ${i.id}: ${i.title ?? i.name}${i.ownResearch ? " (the person's own research)" : i.file ? "" : " (a memory)"}`);
  }
  if (ids.length > 1) out.push(`neighbouring houses of one family, together in this session: ${ids.join(", ")}`);
  if (first?.place.id) {
    const place = tree.get<Place>(first.place.id);
    out.push(`### The municipality ${first.place.id} ${place ? placeName(place) : ""}${town?.done ? ` (skeleton done ${town.done})` : town ? "" : " (no skeleton yet)"}`);
    out.push(...townLines(town));
  }
  out.push(...sourceChecklist(tree, first?.place.id, work));
  return out.join("\n");
}

/**
 * The claims of a house (or a municipality's record) on a source with a web address nobody of the research read (spec
 * 145 T7): to read in this task — what it says in their place, or one line that the address does not open. Never a task.
 */
function unreadLines(tree: Tree, recs: (House | undefined)[], ref?: string): string[] {
  const claims = unreadWebClaims(tree, recs);
  if (!claims.length) return [];
  return [
    "  taken over unread (its source on the web, nobody of the research read it) — read each now; the certainty by the kind of source (a municipality's history, a chronicle: medium at most); the document is not kept, its address stays:",
    ...claims.map((c) => `    ${unreadClaimLine(c, ref)}`),
  ];
}

function townLines(rec: House | undefined): string[] {
  if (!rec) return ["  nothing of it written yet"];
  return [
    ...(rec.text ? [`  ${rec.text}`] : []),
    ...(rec.passed.length ? [`  gone through already (never again): ${rec.passed.map((x) => `${x.what}${x.url ? ` <${x.url}>` : ""}`).join("; ")}`] : []),
    ...(rec.manual.length ? [`  by hand only: ${rec.manual.map((x) => `${x.what}${x.url ? ` <${x.url}>` : ""}`).join("; ")}`] : []),
    ...(rec.archiveOnly.length ? [`  only in a reading room: ${rec.archiveOnly.map((x) => [x.archive, x.fond, x.signature].filter(Boolean).join(", ")).join("; ")}`] : []),
    ...(rec.maps.length ? [`  maps: ${rec.maps.map((m) => `${m.kind}${m.url ? ` <${m.url}>` : ""}`).join("; ")}`] : []),
    ...(rec.fieldNames?.length ? [`  field names: ${rec.fieldNames.map((f) => `${f.name}${f.kind ? ` (${f.kind})` : ""}${f.house ? ` at no. ${f.house}` : ""}`).join("; ")}`] : []),
    ...(rec.pictures?.length ? [`  pictures: ${rec.pictures.map((x) => `${x.shows} <${x.url}> (${x.license})`).join("; ")}`] : []),
  ];
}
