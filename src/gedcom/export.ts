// GEDCOM 5.5.1 export — the automated output of a research.
//
// Written to the Strom import contract (docs/GEDCOM-IMPORT.md of the Strom app) and
// generalised from an earlier research exporter:
// - every fact under its own standard tag where readers look for it; value
//   tags (OCCU, RELI, TITL, NATI) carry the fact on the tag line; family-only
//   tags stay on FAM;
// - of several facts of one kind the best-supported comes first — readers
//   take the first BIRT as the birth;
// - QUAY is the quality of each citation's evidence (5.5.1), not the
//   certainty of the conclusion; leads and possible facts say so in a note;
// - REFN carries our ID so a round trip through the Strom app is matched
//   without guessing.
//
// Two files from the same evidence, for two readers:
// - "standard": plain GEDCOM 5.5.1 for any program — no extension tags,
//   associations on the individual (ASSO), the words of a record as citation
//   DATA/TEXT, a story as a note;
// - "strom": shaped to what the Strom app reads (agreed with it; its
//   docs/GEDCOM-IMPORT.md): _WITN, _FREL/_MREL, _STORY, the transcript as the
//   source's TEXT, one source per entry with one PAGE (Strom keeps the first PAGE
//   of a source; where in the entry a fact was read is the citation's DATA TEXT), and —
//   in an export with images only — the entry cut out of its scan as the
//   source's OBJE (_STROM_KIND excerpt, a data URL in FILE). For a Strom
//   older than STROM_READS_TAGS, AGE, CAUS, ADDR and _FREL/_MREL are also said
//   in notes.

import { GedWriter } from "./lines.ts";
import { labels, RELA, type LabelKey } from "./labels.ts";
import type { ChildRelation, Citation, Conflict, Event, Family, Hypothesis, Input, Media, Name, Participant, Person, Place, RecordSet, Repository, Search, Source, Story, Task } from "../core/model.ts";
import { birthEvent, claimText, conflictTitle, displayName, formatName, gedcomName, preferredOrder, primaryName, relationTo } from "../core/people.ts";
import { foldText } from "../core/text.ts";
import { dateYears } from "../core/gdate.ts";
import { humanAge, isGedcomAge, normalizeAge } from "../core/age.ts";
import { quay } from "../core/evidence.ts";
import { VERSION, type Tree } from "../core/tree.ts";
import { dataUrl, turned, type Excerpt } from "../core/excerpt.ts";
import { mainPerson } from "../core/kin.ts";
import * as git from "../core/git.ts";
import { treeEdges, type Edge, type Island } from "../core/edge.ts";
import { readersOf } from "../core/review.ts";
import { humanTask } from "../cli/human.ts";

export const GED_PROFILES = ["standard", "strom"] as const;
export type GedProfile = (typeof GED_PROFILES)[number];

/**
 * The first Strom version that reads AGE, CAUS, ADDR, _FREL/_MREL and more source notes itself (each NOTE, REPO >
 * CALN, the transcript as TEXT): 3.0.0 — found 2026-10-02, when the notes repeating them showed every cause and age
 * twice. An app of unknown version is taken for today's: every app that opens a research reads them.
 */
export const STROM_READS_TAGS: string | undefined = "3.0.0";

/**
 * The first Strom version that reads a source's REFN, the citation's DATA DATE and the excerpts of entries.
 * An app of unknown version is taken for today's (stromapp.info serves the latest; an older one only lists
 * the tags it leaves out, nothing is lost).
 */
export const STROM_READS_EXCERPTS: string | undefined = "3.1.0";

/** Does this Strom read the standard tags, so the notes repeating them can go? `unknown`: the answer for an app of unknown version. */
export function stromReadsTags(version: string | undefined, from: string | undefined = STROM_READS_TAGS, unknown = false): boolean {
  if (!from) return false;
  if (!version) return unknown;
  const n = (v: string) => v.split(".").map((x) => Number.parseInt(x, 10) || 0);
  const [a, b] = [n(version), n(from)];
  for (let i = 0; i < 3; i++) if ((a[i] ?? 0) !== (b[i] ?? 0)) return (a[i] ?? 0) > (b[i] ?? 0);
  return true;
}

export interface ExportOptions {
  /** Who reads the file: any program (standard, the default) or the Strom app. */
  for?: GedProfile;
  /** The Strom version the file is for (the "strom" profile). */
  stromVersion?: string | undefined;
  /** Only these persons (and families among them); default everyone. */
  persons?: Set<string>;
  /** The Strom profile with images: the entry cut out of its scan, for each source that has clips. */
  excerpts?: (s: Source) => Excerpt[];
  /** The Strom profile: the commit of the research the file is of (default: the tree's HEAD) — what strom sync compares a returning tree with. */
  head?: string;
  /** In memory only (strom sync), never in a file: each fact's ID under it (2 _EID E0001). */
  ids?: boolean;
  /** The Strom profile, for an app that opens strom-research:// links (appOpensLinks): each excerpt's mark (2 _STROM_CLIP). */
  clips?: boolean;
  /** …and the links this computer takes (1 _STROM_LINKS send excerpt) — only in the GEDCOM the bridge serves, never in a file. */
  links?: string[];
  /** …and their scheme when it is not strom-research (a second installation's: 2 _SCHEME strom-research-beta). */
  linkScheme?: string;
  /**
   * The Strom profile, for an app that shows what the research knows of a person (appOpensLinks): its open and
   * decided conflicts, open hypotheses, what was searched for them (_STROM_CONFLICT, _STROM_HYPO, _STROM_SEARCHED)
   * and as of when (1 _STROM_ASOF). The app never sends them back: the research is where they live.
   */
  research?: boolean;
  /**
   * …and, for an app that shows where the tree ends (appShowsEdges), what the research knows there: per person above
   * whom the tree does not go on, why and what comes next (_STROM_EDGE), per person of a family nothing links to the
   * tree, the hypotheses that would join it (_STROM_ISLAND) — core/edge.ts. Of the research at the time of the file.
   */
  edges?: boolean;
  /**
   * …and, for an app that shows it (appShowsStoryDrafts), the new version of a story the user approved, waiting for
   * them beside it (2 _DRAFT under _STORY): the approved one stays the story until they decide.
   */
  storyDrafts?: boolean;
  /** For a Strom app that keeps a couple's events (APP_SHOWS_COUPLE_EVENTS): their residence as RESI under FAM. */
  coupleResi?: boolean;
  /** For a Strom app that shows who read a source (APP_SHOWS_SOURCE_READS): _STROM_READ, and _STROM_VERIFIED on the app's. */
  sourceReads?: boolean;
  /** For a Strom app that keeps parents who are no couple (APP_KNOWS_NO_COUPLE): _STROM_NO_COUPLE on such a family. */
  noCouple?: boolean;
  /** The Strom profile, an app that shows it (APP_SHOWS_FACT_STATUS): how sure each fact is as 2 _STROM_STATUS, not as a note. */
  factStatus?: boolean;
  /** For a Strom app that knows an archive (APP_KNOWS_ARCHIVE): 1 _STROM_MODE archive in the header. */
  archive?: boolean;
  /**
   * For a Strom app that turns an excerpt itself (APP_TURNS_EXCERPTS): one cut from a picture on its side as it lies,
   * with 2 _STROM_ORIENT. Anything else gets it turned already, without the tag (an older app would show it lying).
   */
  turnsExcerpts?: boolean;
}

export interface ExportResult {
  text: string;
  lines: string[];
  stats: { persons: number; families: number; sources: number; repositories: number; events: number; skipped: number };
}

/** Whose IDs a person's REFN carries: a tree coming back is matched by them (strom sync, the Strom app). */
export const REFN_TYPE = "strom-research";

/** Tags whose value IS the fact and rides on the tag line. */
const VALUE_TAGS = new Set(["OCCU", "RELI", "TITL", "NATI"]);

/** Tags the Strom importer reads on INDI (contract, "Events" + note tags). */
const INDI_TAGS = new Set([
  "BIRT", "DEAT", "BAPM", "CHR", "CHRA", "CONF", "FCOM", "BARM", "BASM", "ORDN", "EDUC", "GRAD", "OCCU", "RESI",
  "EMIG", "IMMI", "NATU", "RELI", "TITL", "NATI", "ADOP", "WILL", "PROB", "BURI", "CREM", "CENS", "EVEN", "RETI",
]);
/** Tags read on FAM (RESI is standard on FAM but Strom does not read it yet: see famTag). */
const FAM_TAGS = new Set(["MARR", "DIV", "MARB", "MARC", "MARL", "MARS", "ANUL", "DIVF", "ENGA", "CENS", "EVEN"]);
/** Our kinds with no standard tag of their own: exported as EVEN + TYPE. */
const AS_EVEN: Record<string, LabelKey> = { MILI: "MILI" };
/** Events that may carry "Y" when nothing else is known about them (5.5.1). */
const Y_TAGS = new Set(["BIRT", "CHR", "DEAT", "BURI", "CREM", "ADOP", "BAPM", "CHRA", "CONF", "FCOM", "ORDN", "NATU", "EMIG", "IMMI", "CENS", "PROB", "WILL", "GRAD", "RETI", "MARR", "DIV", "ANUL", "ENGA", "MARB", "MARC", "MARL", "MARS", "DIVF"]);

/** _FREL/_MREL values (Legacy, RootsMagic, FTM). */
const FREL: Record<ChildRelation, string> = { birth: "Natural", adopted: "Adopted", step: "Step", foster: "Foster", unknown: "Unknown" };

/** GEDCOM NAME TYPE for our kinds of name ("religious" is a user-defined type). */
const NAME_TYPE: Record<NonNullable<Name["kind"]>, string> = { birth: "birth", married: "married", alias: "aka", religious: "religious" };

export function exportGedcom(tree: Tree, opts: ExportOptions = {}): ExportResult {
  const lang = tree.config.lang;
  const L = labels(lang);
  const w = new GedWriter();
  const stats = { persons: 0, families: 0, sources: 0, repositories: 0, events: 0, skipped: 0 };
  const strict = (opts.for ?? "standard") === "standard";
  // Strom profile: say in notes what the Strom app does not read from the tags yet.
  const repeat = !strict && !stromReadsTags(opts.stromVersion, STROM_READS_TAGS, true);
  // The entry's own identity and date: any program; Strom from the version that reads them (unknown: today's), and
  // always when the file carries images of entries.
  const carries = !!opts.excerpts && tree.list<Source>("source").some((s) => !s.retracted && opts.excerpts!(s).length > 0);
  const entries = strict || carries || stromReadsTags(opts.stromVersion, STROM_READS_EXCERPTS, true);

  const everyone = tree.list<Person>("person");
  const personById = new Map(everyone.map((p) => [p.id, p]));
  const eventById = new Map<string, Event>([...everyone, ...tree.list<Family>("family")].flatMap((r) => r.events.map((e) => [e.id, e] as const)));
  const persons = everyone.filter((p) => !p.retracted && (!opts.persons || opts.persons.has(p.id)));
  // The main person first: programs (the Strom app too) open on the first person of a file.
  const main = mainPerson(tree);
  const at = persons.findIndex((p) => p.id === main);
  if (at > 0) persons.unshift(...persons.splice(at, 1));
  const personIds = new Set(persons.map((p) => p.id));
  const families = tree
    .list<Family>("family")
    .filter((f) => !f.retracted)
    .map((f) => ({ ...f, partners: f.partners.filter((p) => personIds.has(p)), children: f.children.filter((c) => personIds.has(c.person)) }))
    .filter((f) => f.partners.length + f.children.length > (opts.persons ? 1 : 0));
  // The Strom app gets no source of a sync ("edits in the Strom app"): its own tree cited back at it, one more each send,
  // cluttering its list of sources — the facts it alone stands for are leads (a note says so). Other programs get it.
  const syncs = strict ? new Set<string>() : new Set(tree.list<Input & { sync?: unknown }>("input").filter((i) => i.sync).map((i) => i.id));
  const sources = tree.list<Source>("source").filter((s) => !s.retracted && !(s.input && syncs.has(s.input)));
  const sourceById = new Map(sources.map((s) => [s.id, s]));
  const repos = tree.list<Repository>("repository");
  const recordsets = new Map(tree.list<RecordSet>("recordset").map((b) => [b.id, b]));

  // xrefs: our IDs are already unique and stable — use them directly.
  const x = (id: string) => `@${id}@`;
  const citedSources = new Set<string>();
  // Strom profile: one PAGE per source (Strom keeps the first) — the source's place in the book, else the first cited.
  const stromPages = new Map<string, string | undefined>();
  const stromPage = (s: Source, c: Citation): string | undefined => {
    if (!stromPages.has(s.id)) stromPages.set(s.id, s.locator ?? c.locator);
    return stromPages.get(s.id);
  };

  // Places with coordinates, looked up by folded name.
  const coords = new Map<string, { lat: number; lon: number }>();
  for (const pl of tree.list<Place>("place")) if (pl.coords && !pl.retracted) for (const n of pl.names) coords.set(foldText(n.name), pl.coords);

  // What the research knows beyond the facts (the Strom profile, opts.research): read once.
  const research = {
    conflicts: opts.research ? tree.list<Conflict>("conflict") : [],
    hypotheses: opts.research ? tree.list<Hypothesis>("hypothesis").filter((h) => h.state === "open") : [],
    // a search is of the people of the task it served
    searched: opts.research
      ? tree
          .list<Search>("search")
          .map((q) => ({ search: q, people: (q.task ? tree.get<Task>(q.task)?.subject : undefined) ?? [] }))
          .filter((x) => x.people.length)
      : [],
  };

  // Where the tree ends, and the families nothing links to it (the Strom profile, opts.edges).
  const ends = opts.edges && opts.for === "strom" ? treeEdges(tree) : undefined;

  // Who read each source (the Strom profile, opts.sourceReads).
  const readers = opts.sourceReads && opts.for === "strom" ? readersOf(tree) : undefined;

  // ── header ──
  w.line(0, "HEAD");
  w.line(1, "SOUR", "STROM_RESEARCH");
  w.line(2, "VERS", VERSION);
  w.line(2, "NAME", "Strom Research");
  w.line(1, "DATE", gedDate(new Date()));
  // Which research this is: the Strom app updates the same tree when it is opened again.
  if (opts.for === "strom") {
    w.line(1, "_STROM_TREE", tree.config.id);
    // …and of which state of it: a tree coming back is compared with what it was given (strom sync)
    const head = opts.head ?? git.head(tree.root);
    if (head) w.line(1, "_STROM_HEAD", head);
    if (opts.links?.length) {
      w.line(1, "_STROM_LINKS", opts.links.join(" "));
      if (opts.linkScheme) w.line(2, "_SCHEME", opts.linkScheme);
    }
    if (opts.research) w.line(1, "_STROM_ASOF", new Date().toISOString().slice(0, 10));
    // an archive (no agent; the app's data written as they come): for an app that knows it (APP_KNOWS_ARCHIVE)
    if (opts.archive && tree.config.mode === "archive") w.line(1, "_STROM_MODE", "archive");
  }
  w.line(1, "SUBM", "@U1@");
  w.line(1, "GEDC");
  w.line(2, "VERS", "5.5.1");
  w.line(2, "FORM", "LINEAGE-LINKED");
  w.line(1, "CHAR", "UTF-8");
  w.text(1, "NOTE", `${tree.config.name}\n${L("header")}\n${L("generated")}`);

  // ── people ──
  const famc = new Map<string, { fam: string; relation: string }[]>();
  const fams = new Map<string, string[]>();
  for (const f of families) {
    for (const p of f.partners) fams.set(p, [...(fams.get(p) ?? []), f.id]);
    for (const c of f.children) famc.set(c.person, [...(famc.get(c.person) ?? []), { fam: f.id, relation: c.relation }]);
  }

  for (const p of persons) {
    stats.persons++;
    w.record(x(p.id), "INDI");
    const primary = primaryName(p);
    const nameQuotes: string[] = [];
    for (const n of [primary, ...p.names.filter((n) => n !== primary)]) {
      w.line(1, "NAME", gedcomName(n));
      // "birth" says something only next to another name
      if (n.kind && (n.kind !== "birth" || p.names.length > 1)) w.line(2, "TYPE", NAME_TYPE[n.kind]);
      for (const c of n.citations ?? []) {
        const q = citation(2, c);
        if (q) nameQuotes.push(`${L("name")} ${formatName(n)} — ${L("quote")}: „${q}“`);
      }
    }
    w.line(1, "SEX", p.sex);
    w.line(1, "REFN", p.id);
    w.line(2, "TYPE", REFN_TYPE);
    const deferred: string[] = [];
    const assos: { person: string; rela: string }[] = [];
    for (const e of preferredOrder(p.events)) deferred.push(...event(e, "INDI", {}, assos));
    // 5.5.1 has associations on the individual only (strict); the event's note names the event.
    for (const a of assos) {
      w.line(1, "ASSO", x(a.person));
      w.line(2, "RELA", a.rela);
    }
    for (const n of p.notes) w.text(1, "NOTE", n.text);
    for (const d of [...nameQuotes, ...deferred]) w.text(1, "NOTE", d);
    story(p.story);
    if (opts.research && opts.for === "strom") known(p);
    if (ends) {
      const e = ends.edges.get(p.id);
      if (e) edge(e);
      const isle = ends.islands.get(p.id);
      if (isle) island(isle);
    }
    for (const link of famc.get(p.id) ?? []) {
      w.line(1, "FAMC", x(link.fam));
      if (link.relation === "adopted" || link.relation === "foster") w.line(2, "PEDI", link.relation);
      else if (link.relation === "step") strict ? w.text(2, "NOTE", L("step")) : w.line(2, "PEDI", "step");
    }
    for (const f of fams.get(p.id) ?? []) w.line(1, "FAMS", x(f));
  }

  // ── families ──
  for (const f of families) {
    stats.families++;
    w.record(x(f.id), "FAM");
    const [a, b] = f.partners.map((id) => persons.find((p) => p.id === id)!);
    // HUSB/WIFE by sex; an unknown sex keeps the order given.
    const husb = [a, b].find((p) => p?.sex === "M") ?? (a?.sex !== "F" ? a : undefined);
    const wife = [a, b].find((p) => p && p !== husb);
    if (husb) w.line(1, "HUSB", x(husb.id));
    if (wife) w.line(1, "WIFE", x(wife.id));
    // Children by birth, the unknown ones last, in the order they were added.
    const born = (id: string) => dateYears(birthEvent(personById.get(id)!)?.date ?? "")[0] ?? Infinity;
    // The record naming the family itself (a child's parents), where no fact of it carries one.
    const deferred: string[] = [];
    for (const c of [...f.children].sort((m, n) => born(m.person) - born(n.person))) {
      w.line(1, "CHIL", x(c.person));
      // a stepchild of both (or of the one parent): PEDI has no word for it — the Strom app and others read _FREL/_MREL
      // (found on Mac: a stepchild lost in the app after a load of the research)
      if (!c.relations && (strict || c.relation !== "step")) continue;
      // A child related differently to each parent (a stepchild of the husband, the wife's own):
      // _FREL/_MREL as Legacy, RootsMagic and FTM write it; strict GEDCOM has no place for it but a note.
      const rel = (p: Person | undefined) => (p ? relationTo(c, p.id) : undefined);
      const [fr, mr] = [rel(husb), rel(wife)];
      if (!strict) {
        if (fr) w.line(2, "_FREL", FREL[fr]);
        if (mr) w.line(2, "_MREL", FREL[mr]);
      }
      if (strict || repeat) {
        const as = (r: ChildRelation) => L(r === "unknown" ? "unknownRelation" : r);
        const who = [husb && fr ? `${displayName(husb)}: ${as(fr)}` : "", wife && mr ? `${displayName(wife)}: ${as(mr)}` : ""].filter(Boolean).join(", ");
        deferred.push(`${displayName(personById.get(c.person)!)} — ${who}`);
      }
    }
    // parents who are no couple (one parent alone, or two the app keeps so), nothing of a couple with them: said, so the
    // Strom app draws no placeholder partner beside the one
    const parents = [husb, wife].filter(Boolean).length;
    const coupled = f.events.some((e) => !e.retracted) || f.notes.length > 0 || !!f.story || (f.citations ?? []).some((c) => sourceById.has(c.source)) || !!f.union;
    if (opts.noCouple && opts.for === "strom" && (parents === 1 || (parents === 2 && f.noCouple)) && !coupled) w.line(1, "_STROM_NO_COUPLE", "Y");
    // how the couple is bound where its facts cannot say it: one partner married to somebody unknown (with no child, or
    // with their children) — a bare MARR, and DIV when divorced, as the Strom app's beta.55 and beta.56 write it (any
    // program reads a marriage); partners or separated as the app's _STAT
    const had = (kind: string) => f.events.some((e) => !e.retracted && e.kind === kind);
    if (parents === 1 && f.union) {
      if ((f.union === "married" || f.union === "divorced") && !had("MARR")) w.line(1, "MARR");
      if (f.union === "divorced" && !had("DIV")) w.line(1, "DIV");
    }
    if (!strict && (f.union === "partners" || f.union === "separated")) w.line(1, "_STAT", f.union === "partners" ? "Partners" : "Separated");
    for (const c of f.citations ?? []) {
      const q = citation(1, c);
      if (q) deferred.push(`${L("family")} — ${L("quote")}: „${q}“`);
    }
    for (const e of preferredOrder(f.events)) deferred.push(...event(e, "FAM", { husb: husb?.id, wife: wife?.id }, []));
    for (const n of f.notes) w.text(1, "NOTE", n.text);
    for (const d of deferred) w.text(1, "NOTE", d);
    story(f.story);
    // No REFN on FAM: the Strom importer reads REFN on individuals only.
  }

  // ── sources and repositories ──
  const usedRepos = new Set<string>();
  for (const s of sources) {
    if (!citedSources.has(s.id) && opts.persons) continue;
    writeSource(s);
  }
  function writeSource(s: Source): void {
    stats.sources++;
    w.record(x(s.id), "SOUR");
    w.text(1, "TITL", s.title);
    const set = s.recordset ? recordsets.get(s.recordset) : undefined;
    const repo = s.repository ?? set?.repository;
    if (repo && repos.some((r) => r.id === repo)) {
      w.line(1, "REPO", x(repo));
      if (set?.callNumber) w.line(2, "CALN", set.callNumber);
      usedRepos.add(repo);
    }
    // The words of the record are the source's TEXT (in both files: Strom reads it there).
    if (s.transcript) w.text(1, "TEXT", s.transcript);
    const url = s.url ?? set?.url;
    const head = [
      set ? `${L("recordset")}: ${set.title}${set.callNumber && (strict || repeat) ? ` (${set.callNumber})` : ""}` : "",
      s.locator ?? "",
      s.date ? `${L("recorded")}: ${s.date}` : "",
      s.language ? `${L("language")}: ${s.language}` : "",
      url ? `${L("url")}: ${url}${s.accessed ? ` (${s.accessed})` : ""}` : "",
      `${L("evidence")}: ${L(s.form)}, ${L(s.information)}`,
    ].filter(Boolean);
    const sections = [
      head.join("\n"),
      s.notes.map((n) => n.text).join("\n"),
      repeat && s.transcript ? `${L("transcript")}:\n${s.transcript}` : "",
      s.translation ? `${L("translation")}:\n${s.translation}` : "",
    ].filter(Boolean);
    // One note while Strom keeps a single note per source (a second one replaced the first).
    if (repeat) {
      if (sections.length) w.text(1, "NOTE", sections.join("\n\n"));
    } else for (const section of sections) w.text(1, "NOTE", section);
    // The research's number of the source: the Strom app knows the same entry again by it.
    if (entries) w.line(1, "REFN", s.id);
    // who read the record: the user (their transcript in the app, when it counts), the research, both; nobody: none
    if (readers && s.kind !== "family-tree" && s.kind !== "family-memory") {
      const who = readers.get(s.id) ?? new Set<string>();
      const user = who.has("user");
      const research = [...who].some((x) => x !== "user");
      if (user || research) w.line(1, "_STROM_READ", user && research ? "both" : user ? "user" : "research");
    }
    if (opts.sourceReads && s.app?.verified) w.line(1, "_STROM_VERIFIED", "Y");
    for (const cut of opts.excerpts?.(s) ?? []) {
      const e = opts.turnsExcerpts ? cut : turned(cut);
      w.line(1, "OBJE");
      w.line(2, "FORM", "jpg");
      w.line(2, "_STROM_KIND", "excerpt");
      if (opts.clips && e.clip) w.line(2, "_STROM_CLIP", e.clip);
      if (e.url) w.text(2, "_URL", e.url);
      w.wrapped(2, "FILE", dataUrl(e));
      // the original it is cut from, by its content: the app knows the research has it (and sends it not again)
      const original = tree.get<Media | Input>(e.media);
      if (original?.sha) w.line(2, "_STROM_SHA", original.sha);
      // cut as the picture lies in its file: how the app turns it for showing (a phone's photo, EXIF 2–8)
      if (e.orient) w.line(2, "_STROM_ORIENT", String(e.orient));
    }
  }
  for (const r of repos) {
    if (!usedRepos.has(r.id)) continue;
    stats.repositories++;
    w.record(x(r.id), "REPO");
    w.line(1, "NAME", r.name);
    if (r.url) w.text(1, "NOTE", `${L("url")}: ${r.url}`);
  }

  w.record("@U1@", "SUBM");
  w.line(1, "NAME", "Strom Research");
  w.line(0, "TRLR");
  return { text: w.toString(), lines: w.lines, stats };

  // ── one fact; returns notes that must go one level up (value tags) ──
  function event(e: Event, on: "INDI" | "FAM", couple: { husb?: string | undefined; wife?: string | undefined }, assos: { person: string; rela: string }[]): string[] {
    if (e.retracted || e.status === "retracted" || e.status === "disproven") {
      stats.skipped++;
      return [];
    }
    const allowed = on === "INDI" ? INDI_TAGS : FAM_TAGS;
    let tag = e.kind;
    let typeLabel = e.label;
    if (on === "FAM" && tag === "RESI" && (strict || opts.coupleResi)) {
      // standard on FAM; for a Strom app before its couple's events an EVEN named so
    } else if (AS_EVEN[tag] || !allowed.has(tag)) {
      typeLabel = e.label ?? (AS_EVEN[tag] ? L(AS_EVEN[tag]!) : L(tag as LabelKey) ?? tag);
      tag = "EVEN";
    }
    stats.events++;
    const up: string[] = [];
    const empty = !e.date && !e.place;
    if (VALUE_TAGS.has(tag)) w.line(1, tag, e.value);
    else w.line(1, tag, tag === "EVEN" && !typeLabel ? e.value : empty && Y_TAGS.has(tag) ? "Y" : undefined);
    if (tag === "EVEN" && typeLabel) w.line(2, "TYPE", typeLabel);
    if (opts.ids) w.line(2, "_EID", e.id);
    if (e.date) w.line(2, "DATE", e.date);
    if (e.place) {
      w.line(2, "PLAC", e.place);
      const c = coords.get(foldText(e.place));
      if (c) {
        w.line(3, "MAP");
        w.line(4, "LATI", `${c.lat < 0 ? "S" : "N"}${Math.abs(c.lat)}`);
        w.line(4, "LONG", `${c.lon < 0 ? "W" : "E"}${Math.abs(c.lon)}`);
      }
    }
    const noteParts: string[] = [];
    // A house is an address within the place: "2 ADDR čp. 13" (the value on the line, as Strom reads it).
    if (e.house) {
      w.line(2, "ADDR", `${L("house")} ${e.house}`);
      if (strict && e.place) w.line(3, "CITY", e.place.split(",")[0]!.trim());
      if (repeat) noteParts.push(`${L("house")} ${e.house}`);
    }
    if (e.cause) {
      w.line(2, "CAUS", e.cause);
      if (repeat) noteParts.push(`${L("cause")}: ${e.cause}`);
    }
    // Ages: a person's under the event, the partners' under HUSB/WIFE.
    // An age that is no GEDCOM AGE ("dospělý") has no tag to go into: the note says it, whatever Strom reads.
    const ageNotes: string[] = [];
    let ageUntagged = false;
    if (on === "INDI" && e.age) {
      const age = normalizeAge(e.age);
      if (age && isGedcomAge(age)) w.line(2, "AGE", age);
      else ageUntagged = true;
      ageNotes.push(humanAge(age ?? e.age, lang));
    }
    if (on === "FAM" && e.ages)
      for (const [role, id] of [["HUSB", couple.husb], ["WIFE", couple.wife]] as const) {
        const raw = id ? e.ages[id] : undefined;
        if (!raw) continue;
        const age = normalizeAge(raw);
        if (age && isGedcomAge(age)) {
          w.line(2, role);
          w.line(3, "AGE", age);
        } else ageUntagged = true;
        ageNotes.push(`${displayName(personById.get(id!)!)} ${humanAge(age ?? raw, lang)}`);
      }
    for (const c of e.citations) citation(2, c);
    for (const pt of e.participants ?? []) participant(pt, on, noteParts, assos);
    if (opts.factStatus && opts.for === "strom") w.line(2, "_STROM_STATUS", e.status);
    else if (e.status === "lead" || e.status === "possible") noteParts.unshift(L(e.status));
    if (!VALUE_TAGS.has(tag) && e.value && tag !== "EVEN") noteParts.push(e.value);
    // The ages for a Strom older than STROM_READS_TAGS (or with no AGE form), the words of the record always.
    if ((repeat || ageUntagged) && ageNotes.length) noteParts.push(`${L("age")}: ${ageNotes.join(", ")}`);
    if (!strict) for (const c of e.citations) if (c.quote) noteParts.push(`${L("quote")}: „${c.quote}“`);
    if (e.note) noteParts.push(e.note);
    if (noteParts.length) {
      // Under a value tag a NOTE would be glued onto the fact; it goes to the person instead.
      if (VALUE_TAGS.has(tag)) up.push(`${L(tag as LabelKey)} — ${e.value}${e.date ? ` (${e.date})` : ""}: ${noteParts.join(" ")}`);
      else w.text(2, "NOTE", noteParts.join("\n"));
    }
    return up;
  }

  /**
   * The story of a person or a couple: _STORY as Strom reads it (the facts it
   * rests on as DATA lines, the caveat as NOTE); a note in strict GEDCOM.
   */
  /** What the research knows of a person beyond the facts: its conflicts, open hypotheses, what was searched for them. */
  function known(p: Person): void {
    const about = (subject: string[]) => subject.includes(p.id) || subject.some((id) => families.some((f) => f.id === id && f.partners.includes(p.id)));
    for (const c of research.conflicts.filter((x) => about(x.subject))) {
      w.line(1, "_STROM_CONFLICT", c.id);
      // the fact it is about: its tag, else a conflict of the research named by its title
      w.line(2, "TYPE", c.fact ?? "EVEN");
      w.text(2, "TITL", conflictTitle(tree, c));
      w.line(2, "STAT", c.state === "resolved" ? "decided" : "open");
      for (const claim of c.claims) {
        // in the research's language (found on Mac: "14 JAN 1931, Dolní Lhota, house 12" in the app's dialog)
        w.text(2, "VAL", claimText(tree, c, claim));
        if (claim.source && sourceById.has(claim.source)) {
          citedSources.add(claim.source);
          w.line(3, "SOUR", x(claim.source));
        }
      }
      if (c.state === "resolved" && c.resolution) w.text(2, "DECI", c.resolution);
    }
    for (const h of research.hypotheses.filter((x) => about(x.subject))) {
      w.line(1, "_STROM_HYPO", h.id);
      w.text(2, "TITL", h.question);
      w.text(2, "NOTE", h.variants.map((v) => `${v.label}: ${v.claim}`).join("\n"));
    }
    for (const q of research.searched.filter((x) => x.people.includes(p.id)).map((x) => x.search)) {
      w.line(1, "_STROM_SEARCHED");
      w.text(2, "TITL", q.question);
      const years = /^(\d{3,4})(?:\s*[-–]\s*(\d{3,4}))?$/.exec(q.scope.years ?? "");
      if (years) w.line(2, "DATE", years[2] && years[2] !== years[1] ? `FROM ${years[1]} TO ${years[2]}` : years[1]!);
      w.line(2, "RESN", q.result === "found" ? "found" : "none");
      w.line(2, "_AT", q.created.slice(0, 10));
    }
  }


  /** Years as a GEDCOM date: one year, or FROM … TO …. */
  function years(r: { from: number; to: number }): string {
    return r.from === r.to ? String(r.from) : `FROM ${r.from} TO ${r.to}`;
  }

  /**
   * Where the tree ends above a person: what is missing, whether the research reaches them, what the records say
   * so far, what comes next — and what that rests on (core/edge.ts; the app's ZADANI_VYZKUM_kraj-stromu.md).
   */
  function edge(e: Edge): void {
    w.line(1, "_STROM_EDGE", e.missing);
    w.line(2, "_SCOPE", e.scope);
    if (e.research) w.line(2, "_RESEARCH", e.research);
    if (e.generation !== undefined) w.line(2, "_GEN", String(e.generation));
    w.line(2, "_END", e.end);
    w.line(2, "_NEXT", e.next);
    if (e.estimate) {
      w.line(2, "_EST", e.estimate.year ? String(e.estimate.year) : "");
      if (e.estimate.place) w.text(3, "PLAC", e.estimate.place);
      if (e.estimate.basis) w.line(3, "_BASIS", `${e.estimate.basis.kind} ${e.estimate.basis.year}`);
    }
    if (e.window) w.line(2, "DATE", years(e.window));
    if (e.recordsFrom) w.line(2, "_RECORDS", String(e.recordsFrom));
    for (const b of e.books) {
      w.line(2, "_BOOK", b.id);
      w.text(3, "TITL", b.title);
      const y = /^(\d{3,4})(?:\s*[-–]\s*(\d{3,4}))?$/.exec(b.years ?? "");
      if (y) w.line(3, "DATE", years({ from: Number(y[1]), to: Number(y[2] ?? y[1]) }));
      w.line(3, "_ACCESS", b.access);
    }
    for (const r of e.covered) w.line(2, "_COVERED", years(r));
    for (const r of e.noRecords) w.line(2, "_NORECORDS", years(r));
    for (const t of e.tasks) {
      w.line(2, "_TASK", t.id);
      w.line(3, "_LEVEL", t.level);
      w.line(3, "STAT", t.state);
      w.text(3, "TITL", humanTask(tree, t.what, lang));
      if (t.position) w.line(3, "_POS", String(t.position));
      if (t.held) w.line(3, "_HELD", t.held);
      if (t.until) w.line(3, "_UNTIL", t.until);
      if (t.on) w.text(3, "NOTE", t.on);
    }
    for (const id of e.tried) w.line(2, "_TRIED", id);
    for (const h of e.hypotheses) {
      w.line(2, "_HYPO", h.id);
      for (const j of h.joins) w.line(3, "_JOIN", j);
      if (h.island) {
        w.line(3, "_ISLAND", String(h.island.people));
        w.line(3, "_HELD", String(h.island.held));
      }
      for (const t of h.tests) w.line(3, "_TEST", t);
    }
    for (const c of e.conflicts) w.line(2, "_CONFLICT", c);
    if (e.searches) w.line(2, "_SEARCHES", String(e.searches));
    if (e.sessions) {
      w.line(2, "_SESSIONS", String(e.sessions));
      if (e.cost !== undefined) w.line(3, "_COST", e.cost.toFixed(2));
      if (e.costPartial) w.line(3, "_PARTIAL", "Y");
    }
    if (e.last) w.line(2, "_LAST", e.last);
  }

  /** A person of a family nothing links to the tree: how many people it has, the hypotheses that would join it, the tasks waiting for it. */
  function island(i: Island): void {
    w.line(1, "_STROM_ISLAND", String(i.people.length));
    for (const h of i.hypotheses) {
      w.line(2, "_HYPO", h.id);
      for (const j of h.joins) w.line(3, "_JOIN", j);
    }
    if (i.held) w.line(2, "_HELD", String(i.held));
  }

  function story(st: Story | undefined): void {
    if (!st) return;
    if (strict) {
      w.text(1, "NOTE", [st.title, st.text, st.note].filter(Boolean).join("\n\n"));
      return;
    }
    w.line(1, "_STORY");
    w.line(2, "TYPE", "vypraveni");
    if (st.title) w.text(2, "TITL", st.title);
    w.line(2, "STAT", st.status === "final" ? "hotovo" : "navrh");
    w.text(2, "TEXT", st.text);
    const data = (level: number, facts: string[]) => {
      for (const id of facts) {
        const e = eventById.get(id);
        if (!e || e.retracted) continue;
        const cites = [...new Set(e.citations.map((c) => c.source))].join(", ");
        w.line(level, "DATA", [e.kind, e.date, e.place, e.value, cites ? `[${cites}]` : ""].filter(Boolean).join(" ").slice(0, 200));
      }
    };
    data(2, st.facts);
    if (st.note) w.text(2, "NOTE", st.note);
    // the new version of a story the user approved: it waits for them, the approved one stays (an app that shows it)
    if (st.draft && opts.storyDrafts) {
      w.line(2, "_DRAFT");
      if (st.draft.title) w.text(3, "TITL", st.draft.title);
      w.text(3, "TEXT", st.draft.text);
      data(3, st.draft.facts);
      if (st.draft.note) w.text(3, "NOTE", st.draft.note);
      w.line(3, "_AT", st.draft.at.slice(0, 10));
    }
  }

  /**
   * A source citation at `level`: when the record was made as DATA DATE (5.5.1), the quote as DATA TEXT —
   * for Strom also where in the entry the fact was read, when that is not the source's PAGE; returns the
   * quote when it has to go into a note (Strom does not read DATA TEXT yet).
   */
  function citation(level: number, c: Citation): string | undefined {
    const src = sourceById.get(c.source);
    if (!src) return undefined;
    citedSources.add(c.source);
    const page = strict ? (c.locator ?? src.locator) : stromPage(src, c);
    w.line(level, "SOUR", x(c.source));
    if (page) w.text(level + 1, "PAGE", page);
    w.line(level + 1, "QUAY", quay(src, c));
    const where = !strict && c.locator && c.locator !== page ? c.locator : undefined;
    const quote = [where, c.quote].filter(Boolean).join(" — ") || undefined;
    const date = entries ? src.date : undefined;
    if (date || quote) {
      w.line(level + 1, "DATA");
      if (date) w.line(level + 2, "DATE", date);
      if (quote) w.text(level + 2, "TEXT", quote);
    }
    return strict ? undefined : c.quote;
  }

  function participant(pt: Participant, on: "INDI" | "FAM", noteParts: string[], assos: { person: string; rela: string }[]): void {
    const rela = RELA[pt.role] ?? "Participant";
    const linked = pt.person && personIds.has(pt.person) ? pt.person : undefined;
    // A person of the tree outside this export is named, never shown as a bare ID.
    const name = pt.name ?? (pt.person ? (personById.get(pt.person) ? displayName(personById.get(pt.person)!) : pt.person) : "");
    if (strict) {
      if (linked && on === "INDI") assos.push({ person: linked, rela });
      noteParts.push(`${L(pt.role as LabelKey)}: ${name}${pt.note ? ` (${pt.note})` : ""}`);
      return;
    }
    if (linked) {
      w.line(2, "ASSO", x(linked));
      w.line(3, "RELA", rela);
    } else {
      w.line(2, "_WITN", name);
      w.line(3, "RELA", rela);
    }
    if (pt.note) w.text(3, "NOTE", pt.note);
  }
}

function gedDate(d: Date): string {
  const m = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"][d.getUTCMonth()];
  return `${d.getUTCDate()} ${m} ${d.getUTCFullYear()}`;
}
