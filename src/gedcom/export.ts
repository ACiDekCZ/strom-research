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
//   source's TEXT, a source per PAGE (Strom keeps one PAGE per source). Until
//   Strom reads AGE, CAUS, ADDR and _FREL/_MREL (STROM_READS_TAGS) they are
//   also said in notes.

import { GedWriter } from "./lines.ts";
import { labels, RELA, type LabelKey } from "./labels.ts";
import type { ChildRelation, Citation, Event, Family, Name, Participant, Person, Place, RecordSet, Repository, Source, Story } from "../core/model.ts";
import { birthEvent, displayName, formatName, gedcomName, preferredOrder, primaryName, relationTo } from "../core/people.ts";
import { foldText } from "../core/text.ts";
import { dateYears } from "../core/gdate.ts";
import { humanAge, isGedcomAge, normalizeAge } from "../core/age.ts";
import { quay } from "../core/evidence.ts";
import { VERSION, type Tree } from "../core/tree.ts";

export const GED_PROFILES = ["standard", "strom"] as const;
export type GedProfile = (typeof GED_PROFILES)[number];

/** The first Strom version that reads AGE, CAUS, ADDR, _FREL/_MREL and more source notes itself (not released yet). */
export const STROM_READS_TAGS: string | undefined = undefined;

/** Does this Strom read the standard tags, so the notes repeating them can go? */
export function stromReadsTags(version: string | undefined, from: string | undefined = STROM_READS_TAGS): boolean {
  if (!from || !version) return false;
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
}

export interface ExportResult {
  text: string;
  lines: string[];
  stats: { persons: number; families: number; sources: number; repositories: number; events: number; skipped: number };
}

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
  const repeat = !strict && !stromReadsTags(opts.stromVersion);

  const everyone = tree.list<Person>("person");
  const personById = new Map(everyone.map((p) => [p.id, p]));
  const eventById = new Map<string, Event>([...everyone, ...tree.list<Family>("family")].flatMap((r) => r.events.map((e) => [e.id, e] as const)));
  const persons = everyone.filter((p) => !p.retracted && (!opts.persons || opts.persons.has(p.id)));
  const personIds = new Set(persons.map((p) => p.id));
  const families = tree
    .list<Family>("family")
    .filter((f) => !f.retracted)
    .map((f) => ({ ...f, partners: f.partners.filter((p) => personIds.has(p)), children: f.children.filter((c) => personIds.has(c.person)) }))
    .filter((f) => f.partners.length + f.children.length > (opts.persons ? 1 : 0));
  const sources = tree.list<Source>("source").filter((s) => !s.retracted);
  const sourceById = new Map(sources.map((s) => [s.id, s]));
  const repos = tree.list<Repository>("repository");
  const recordsets = new Map(tree.list<RecordSet>("recordset").map((b) => [b.id, b]));

  // xrefs: our IDs are already unique and stable — use them directly.
  const x = (id: string) => `@${id}@`;
  const citedSources = new Set<string>();
  // Strom profile: each page of a source cited at several pages gets a source of its own (S0002, S0002_2, …).
  const pageXrefs = new Map<string, { xref: string; page: string }[]>();
  const pageXref = (id: string, page: string): string => {
    const list = pageXrefs.get(id) ?? [];
    let hit = list.find((p) => p.page === page);
    if (!hit) {
      hit = { xref: list.length ? `@${id}_${list.length + 1}@` : x(id), page };
      pageXrefs.set(id, [...list, hit]);
    }
    return hit.xref;
  };

  // Places with coordinates, looked up by folded name.
  const coords = new Map<string, { lat: number; lon: number }>();
  for (const pl of tree.list<Place>("place")) if (pl.coords) for (const n of pl.names) coords.set(foldText(n.name), pl.coords);

  // ── header ──
  w.line(0, "HEAD");
  w.line(1, "SOUR", "STROM_RESEARCH");
  w.line(2, "VERS", VERSION);
  w.line(2, "NAME", "Strom Research");
  w.line(1, "DATE", gedDate(new Date()));
  // Which research this is: the Strom app updates the same tree when it is opened again.
  if (opts.for === "strom") w.line(1, "_STROM_TREE", tree.config.id);
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
      if (!c.relations) continue;
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
    // Strom keeps one PAGE per source: another page of it is a source of its own there.
    const pages = strict ? [undefined] : [undefined, ...(pageXrefs.get(s.id) ?? []).slice(1)];
    for (const page of pages) writeSource(s, page);
  }
  function writeSource(s: Source, page: { xref: string; page: string } | undefined): void {
    stats.sources++;
    w.record(page ? page.xref : x(s.id), "SOUR");
    w.text(1, "TITL", page ? `${s.title} (${page.page})` : s.title);
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
    // The research's number of the source: standard GEDCOM keeps it; Strom reads REFN on people only.
    if (strict) w.line(1, "REFN", s.id);
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
    if (on === "FAM" && tag === "RESI" && strict) {
      // standard on FAM; Strom does not read it yet, so only in strict
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
    const ageNotes: string[] = [];
    if (on === "INDI" && e.age) {
      const age = normalizeAge(e.age);
      if (age && isGedcomAge(age)) w.line(2, "AGE", age);
      ageNotes.push(humanAge(age ?? e.age, lang));
    }
    if (on === "FAM" && e.ages)
      for (const [role, id] of [["HUSB", couple.husb], ["WIFE", couple.wife]] as const) {
        const raw = id ? e.ages[id] : undefined;
        if (!raw) continue;
        const age = normalizeAge(raw);
        if (!age) continue;
        w.line(2, role);
        w.line(3, "AGE", age);
        ageNotes.push(`${displayName(personById.get(id!)!)} ${humanAge(age, lang)}`);
      }
    for (const c of e.citations) citation(2, c);
    for (const pt of e.participants ?? []) participant(pt, on, noteParts, assos);
    if (e.status === "lead" || e.status === "possible") noteParts.unshift(L(e.status));
    if (!VALUE_TAGS.has(tag) && e.value && tag !== "EVEN") noteParts.push(e.value);
    // Strom does not read AGE and citation DATA yet: say it in the note too.
    if (repeat && ageNotes.length) noteParts.push(`${L("age")}: ${ageNotes.join(", ")}`);
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
    for (const id of st.facts) {
      const e = eventById.get(id);
      if (!e || e.retracted) continue;
      const cites = [...new Set(e.citations.map((c) => c.source))].join(", ");
      w.line(2, "DATA", [e.kind, e.date, e.place, e.value, cites ? `[${cites}]` : ""].filter(Boolean).join(" ").slice(0, 200));
    }
    if (st.note) w.text(2, "NOTE", st.note);
  }

  /** A source citation at `level`; returns the quote when it has to go into a note (Strom does not read DATA). */
  function citation(level: number, c: Citation): string | undefined {
    const src = sourceById.get(c.source);
    if (!src) return undefined;
    citedSources.add(c.source);
    const page = c.locator ?? src.locator;
    w.line(level, "SOUR", strict ? x(c.source) : pageXref(c.source, page ?? ""));
    if (page) w.text(level + 1, "PAGE", page);
    w.line(level + 1, "QUAY", quay(src, c));
    if (!c.quote) return undefined;
    if (!strict) return c.quote;
    w.line(level + 1, "DATA");
    w.text(level + 2, "TEXT", c.quote);
    return undefined;
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
