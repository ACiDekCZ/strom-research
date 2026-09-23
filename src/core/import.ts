// Import of existing family trees (GEDCOM, Strom app JSON) as LEADS.
//
// A family tree is somebody's conclusions, not a record: everything becomes
// status "lead", citing one source "family tree <file>", and every person
// keeps a reference to where it came from. Persons whose REFN is one of our
// IDs (a tree coming back from the Strom app) are matched, not duplicated.

import { eventKind, FAMILY_EVENT_KINDS, NOTE_MAX, type ChildLink, type ChildRelation, type Event, type ExternalRef, type Family, type Name, type Note, type Participant, type ParticipantRole, type Person, type Source } from "./model.ts";
import { normalizeAge } from "./age.ts";
import { foldText } from "./text.ts";
import { roleWord } from "./roles.ts";
import { validateRecord } from "./validate.ts";
import { normalizeDate } from "./gdate.ts";
import { parseName, sameName } from "./people.ts";
import { now, type Tree } from "./tree.ts";
import { children, parseGedcomText, val, type GedNode } from "../gedcom/parse.ts";

export interface ImportResult {
  source: string;
  persons: number;
  families: number;
  matched: number;
  events: number;
  /** What a returning tree added to people and families we already have ("P0001: DEAT 12 MAR 1950"). */
  extended: string[];
  problems: string[];
}

/** Christenings and baptisms are one fact for a comparison. */
const SAME_KIND: Record<string, string> = { CHR: "BAPM", BAPM: "BAPM" };

/** Does the record already have this fact? The same kind and date (a fact without a date: any of that kind), the same value and place when given. */
function knownFact(have: Event[], e: Event): boolean {
  const kind = (k: string) => SAME_KIND[k] ?? k;
  const same = (a: string | undefined, b: string | undefined) => !b || !a || foldText(a) === foldText(b);
  return have.some(
    (x) => !x.retracted && kind(x.kind) === kind(e.kind) && (!e.date || x.date === e.date) && same(x.value, e.value) && same(x.place, e.place) && (e.kind !== "EVEN" || same(x.label, e.label)),
  );
}

function clip(text: string): string {
  const t = text.replace(/\s+\n/g, "\n").trim();
  return [...t].length <= NOTE_MAX ? t : [...t].slice(0, NOTE_MAX - 1).join("") + "…";
}

/** Normalize a date written by any program; undefined when it cannot be read. */
export function importDate(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const direct = normalizeDate(raw);
  if (direct) return direct;
  const cleaned = raw
    .toUpperCase()
    .replace(/\b(ABT|CAL|EST|BEF|AFT)\./g, "$1")
    .replace(/^(C\.|CA\.?|CIRCA|ABOUT|~)\s*/, "ABT ")
    .replace(/^(BEFORE|<)\s*/, "BEF ")
    .replace(/^(AFTER|>)\s*/, "AFT ")
    .replace(/\?$/, "")
    .trim();
  return normalizeDate(cleaned);
}

function makeSource(tree: Tree, title: string, input: string): Source {
  const t = now();
  const s: Source = {
    id: tree.allocate("S"),
    type: "source",
    kind: "family-tree",
    title,
    input,
    information: "secondary",
    form: "authored",
    notes: [],
    created: t,
    updated: t,
  };
  tree.put(s, { op: "source.add", targets: [s.id, input], summary: `+${s.id} source "${title}"` });
  return s;
}

function note(tree: Tree, text: string): Note {
  return { text: clip(text), at: now(), by: tree.actor };
}

// ── GEDCOM ─────────────────────────────────────────────────────────────────


/** NAME TYPE → our kind of name. */
function nameKind(type: string | undefined): Name["kind"] | undefined {
  const t = (type ?? "").toLowerCase();
  if (t === "married") return "married";
  if (["aka", "nickname", "alias", "immigrant"].includes(t)) return "alias";
  if (["birth", "maiden"].includes(t)) return "birth";
  if (t === "religious") return "religious";
  return undefined;
}

export function importGedcom(tree: Tree, text: string, opts: { input: string; name: string; sha: string }): ImportResult {
  const { records, problems } = parseGedcomText(text);
  const system = `gedcom:${opts.sha.slice(0, 12)}`;
  const result: ImportResult = { source: "", persons: 0, families: 0, matched: 0, events: 0, extended: [], problems };
  const notes = new Map(records.filter((r) => r.tag === "NOTE" && r.xref).map((r) => [r.xref!, r.value]));
  const noteText = (n: GedNode) => (/^@[^@]+@$/.test(n.value.trim()) ? (notes.get(n.value.trim()) ?? "") : n.value);
  // The sources of that tree: what its author cited is what the leads can be checked against.
  const foreignSources = new Map(
    records
      .filter((r) => r.tag === "SOUR" && r.xref)
      .map((r) => {
        const repo = val(r, "REPO");
        const repoName = repo ? records.find((x) => x.xref === repo)?.children.find((c) => c.tag === "NAME")?.value : undefined;
        const caln = r.children.find((c) => c.tag === "REPO")?.children.find((c) => c.tag === "CALN")?.value;
        return [r.xref!, [val(r, "TITL"), val(r, "AUTH"), [repoName, caln].filter(Boolean).join(", ")].filter(Boolean).join(" · ")];
      }),
  );
  const bare = (xref: string) => xref.replace(/@/g, "");

  tree.withTreeLock(() => {
    const source = makeSource(tree, `${importLabel(tree.config.lang)} ${opts.name}`, opts.input);
    result.source = source.id;
    const xrefToId = new Map<string, string>();
    const pedi = new Map<string, Map<string, string>>(); // person xref → family xref → PEDI
    const individuals = records.filter((x) => x.tag === "INDI" && x.xref);

    // IDs first, so that associations (a godparent's ASSO) point at the right person.
    const fresh = new Set<string>();
    for (const r of individuals) {
      const refn = val(r, "REFN");
      // one of ours — merged into another since the export: that one
      let ours = refn && /^P\d{4,}$/.test(refn) ? tree.get<Person>(refn) : undefined;
      for (let hops = 0; ours?.mergedInto && hops < 10; hops++) ours = tree.get<Person>(ours.mergedInto);
      if (ours && !ours.retracted) {
        xrefToId.set(r.xref!, ours.id);
        result.matched++;
      } else {
        const id = tree.allocate("P");
        xrefToId.set(r.xref!, id);
        fresh.add(r.xref!);
      }
    }

    const events = (node: GedNode, xref: string, forFamily: boolean, couple: { HUSB?: string; WIFE?: string } = {}): Event[] => {
      const out: Event[] = [];
      for (const c of node.children) {
        const kind = eventKind(c.tag);
        if (!kind || ["NAME", "SEX"].includes(c.tag)) continue;
        if (forFamily !== FAMILY_EVENT_KINDS.has(kind) && kind !== "EVEN" && kind !== "RESI" && kind !== "CENS") continue;
        const ev: Event = {
          id: tree.allocate("E"),
          kind,
          status: "lead",
          citations: [{ source: source.id, locator: `${bare(xref)} ${c.tag}` }],
        };
        const extra: string[] = [];
        const rawDate = val(c, "DATE");
        const date = importDate(rawDate);
        if (date) ev.date = date;
        else if (rawDate) extra.push(`date as written: ${rawDate}`);
        const place = val(c, "PLAC");
        if (place) ev.place = place.replace(/\s+/g, " ");
        // an address in the place (ADDR / ADR1) is the house
        const addr = c.children.find((x) => x.tag === "ADDR");
        const house = addr ? houseOf(val(addr, "ADR1") ?? addr.value) : "";
        if (house) ev.house = house;
        const cause = val(c, "CAUS")?.replace(/\s+/g, " ").trim();
        if (cause) ev.cause = cause;
        const value = c.value.trim();
        if (value && value !== "Y") ev.value = value.replace(/\s+/g, " ");
        const type = val(c, "TYPE");
        // A bare "1 EVEN" with neither TYPE nor value still is an event: name it after its tag.
        if (kind === "EVEN") ev.label = type || value || "EVEN";
        if (["OCCU", "RELI", "TITL", "NATI"].includes(kind) && !ev.value) ev.value = type || "?";
        const rawAge = val(c, "AGE");
        if (rawAge && !forFamily) {
          const age = normalizeAge(rawAge);
          if (age) ev.age = age;
          else extra.push(`age as written: ${rawAge}`);
        }
        if (forFamily) {
          const ages: Record<string, string> = {};
          for (const role of ["HUSB", "WIFE"] as const) {
            const raw = val(c.children.find((x) => x.tag === role), "AGE");
            const who = couple[role];
            const age = raw ? normalizeAge(raw) : undefined;
            if (raw && who && age) ages[who] = age;
            else if (raw) extra.push(`${role === "HUSB" ? "husband" : "wife"} aged ${raw}`);
          }
          if (Object.keys(ages).length) ev.ages = ages;
          if (rawAge) extra.push(`age as written: ${rawAge}`);
        }
        const participants: Participant[] = [];
        // "RELA Present" + a note with the role in words (the Strom app for a midwife, an informant …)
        const roleIn = (n: GedNode, fallback: ParticipantRole): { role: ParticipantRole; note?: string } => {
          const note = children(n, "NOTE").map(noteText).join(" ").trim();
          const role = roleWord(val(n, "RELA")) ?? roleWord(note) ?? fallback;
          return { role, ...(note && !roleWord(note) ? { note } : {}) };
        };
        for (const w of children(c, "_WITN").concat(children(c, "WITN"))) {
          const name = w.value.trim();
          if (name) participants.push({ ...roleIn(w, "witness"), name });
        }
        for (const a of children(c, "ASSO")) {
          const id = xrefToId.get(a.value.trim());
          if (id) participants.push({ ...roleIn(a, "other"), person: id });
        }
        if (participants.length) ev.participants = participants;
        // What the author of that tree cited for this fact.
        for (const sc of children(c, "SOUR")) {
          const title = foreignSources.get(sc.value.trim()) ?? (/^@/.test(sc.value) ? "" : sc.value.trim());
          const cited = [title, val(sc, "PAGE")].filter(Boolean).join(", ");
          if (cited) extra.push(`source there: ${cited}`);
        }
        // The Strom app returns age, cause and address as labelled lines of the note ("Věk: 61 let").
        const noteLines: string[] = [];
        for (const line of children(c, "NOTE").map(noteText).join("\n").split("\n")) if (!detailInto(ev, line, forFamily, couple)) noteLines.push(line);
        const parts = [...extra, noteLines.join("\n").trim()].filter(Boolean);
        if (parts.length) ev.note = clip(parts.join("\n"));
        out.push(ev);
        result.events++;
      }
      return out;
    };

    /** Write a record; an event that is not valid is left out (and reported), never the whole import. */
    const save = (rec: Person | Family, op: { op: string; targets: string[]; summary: string }, label: string): boolean => {
      let problemsNow = validateRecord(rec);
      const bad = new Set(problemsNow.map((p) => /^events\[(\d+)\]/.exec(p.path)?.[1]).filter((x): x is string => x !== undefined).map(Number));
      if (bad.size) {
        for (const i of bad) result.problems.push(`${label}: left out ${rec.events[i]?.kind ?? "a fact"} — ${problemsNow.find((p) => p.path.startsWith(`events[${i}]`))?.message}`);
        rec.events = rec.events.filter((_, i) => !bad.has(i));
        problemsNow = validateRecord(rec);
      }
      if (problemsNow.length) {
        result.problems.push(`${label}: skipped — ${problemsNow.map((p) => `${p.path} ${p.message}`).join("; ")}`);
        return false;
      }
      tree.put(rec, op);
      return true;
    };

    const namesOf = (r: GedNode): Name[] =>
      children(r, "NAME")
        .map((n) => {
          const parsed = parseName(n.value.replace(/\s+/g, " "));
          const found: Name = !/\//.test(n.value) && (val(n, "SURN") || val(n, "GIVN")) ? { given: val(n, "GIVN") ?? "", surname: val(n, "SURN") ?? "" } : parsed;
          // a slash inside a name ("/⟨K/Č⟩emenská/") is kept as "|": the name stays one GEDCOM can write
          const name: Name = { ...found, given: found.given.replace(/\//g, "|"), surname: found.surname.replace(/\//g, "|") };
          const kind = nameKind(val(n, "TYPE"));
          return kind ? { ...name, kind } : name;
        })
        .map((n) => (n.given || n.surname ? n : { ...n, given: "?", surname: "" }));

    /** The Strom app keeps what a birth or death entry adds in the person's note ("Úmrtí: Věk: 61 let"): back to the fact; the other lines are returned. */
    const factNotes = (r: GedNode, personEvents: Event[]): string[] => {
      const personNotes: string[] = [];
      for (const text of children(r, "NOTE").map(noteText)) {
        const keep: string[] = [];
        for (const line of text.split("\n")) {
          const m = /^\s*(narozeni|birth|geburt|umrti|death|tod)\s*:\s*(.+)$/iu.exec(foldText(line)) ? /^\s*[^:]+:\s*(.+)$/u.exec(line) : null;
          const kind = m ? (/^\s*(narozeni|birth|geburt)/iu.test(foldText(line)) ? "BIRT" : "DEAT") : undefined;
          const ev = kind ? personEvents.find((e) => e.kind === kind) : undefined;
          if (!m || !ev || !detailInto(ev, m[1]!, false)) keep.push(line);
        }
        if (keep.join("").trim()) personNotes.push(keep.join("\n"));
      }
      return personNotes;
    };

    // Individuals
    for (const r of individuals) {
      if (!fresh.has(r.xref!)) {
        // One of ours coming back (the Strom app): what it did not know yet is added as a lead; nothing is replaced.
        // Its notes are ours coming back too — they are not taken again.
        const cur = tree.get<Person>(xrefToId.get(r.xref!)!)!;
        const incoming = events(r, r.xref!, false);
        factNotes(r, incoming);
        const facts = incoming.filter((e) => !knownFact(cur.events, e));
        result.events -= incoming.length - facts.length;
        const names = namesOf(r).filter((n) => n.given !== "?" && !cur.names.some((x) => sameName(x, n)));
        if (!facts.length && !names.length) continue;
        const next: Person = { ...cur, names: [...cur.names, ...names], events: [...cur.events, ...facts], refs: [...(cur.refs ?? []), { system, id: r.xref! }], updated: now() };
        const what = [...facts.map((e) => [e.kind, e.date].filter(Boolean).join(" ")), ...names.map((n) => `name ${[n.given, n.surname].filter(Boolean).join(" ")}`)].join(", ");
        if (save(next, { op: "person.import", targets: [cur.id], summary: `${cur.id} + ${what} (lead)` }, bare(r.xref!))) result.extended.push(`${cur.id}: ${what}`);
        continue;
      }
      const refn = val(r, "REFN");
      const names = namesOf(r);
      // The birth name leads: a married name is a variant.
      names.sort((a, b) => (a.kind === "married" || a.kind === "alias" ? 1 : 0) - (b.kind === "married" || b.kind === "alias" ? 1 : 0));
      const sex = val(r, "SEX")?.toUpperCase();
      const refs: ExternalRef[] = [{ system, id: r.xref! }];
      if (refn) refs.push({ system: "refn", id: refn });
      const t = now();
      // The Strom app keeps what a birth or death entry adds in the person's note:
      // "Úmrtí: Věk: 61 let", "Narození: Adresa: čp. 13" — back to the fact.
      const personEvents = events(r, r.xref!, false);
      const personNotes = factNotes(r, personEvents);
      const p: Person = {
        id: xrefToId.get(r.xref!)!,
        type: "person",
        names: names.length ? names : [{ given: "?", surname: "" }],
        sex: sex === "M" || sex === "F" ? sex : "U",
        events: personEvents,
        notes: personNotes.filter((x) => x.trim()).map((x) => note(tree, x)),
        refs,
        created: t,
        updated: t,
      };
      if (!save(p, { op: "person.import", targets: [p.id], summary: `+${p.id} ${names[0]?.given ?? ""} /${names[0]?.surname ?? ""}/ (lead)` }, bare(r.xref!))) {
        xrefToId.delete(r.xref!);
        continue;
      }
      result.persons++;
      for (const fc of children(r, "FAMC")) {
        const pd = val(fc, "PEDI")?.toLowerCase();
        if (pd && pd !== "birth") pedi.set(r.xref!, (pedi.get(r.xref!) ?? new Map()).set(fc.value.trim(), pd));
      }
    }

    // Families
    for (const r of records.filter((x) => x.tag === "FAM" && x.xref)) {
      const couple: { HUSB?: string; WIFE?: string } = {};
      for (const role of ["HUSB", "WIFE"] as const) {
        const id = xrefToId.get(val(r, role) ?? "");
        if (id) couple[role] = id;
      }
      const partners = [couple.HUSB, couple.WIFE].filter((x): x is string => !!x);
      const kids: ChildLink[] = [];
      for (const c of children(r, "CHIL")) {
        const id = xrefToId.get(c.value.trim());
        if (!id) continue;
        const pd = pedi.get(c.value.trim())?.get(r.xref!);
        const relation: ChildRelation = pd === "adopted" ? "adopted" : pd === "foster" ? "foster" : pd === "step" ? "step" : "birth";
        const link: ChildLink = { person: id, relation };
        // the relation to each parent (Legacy, RootsMagic, FTM)
        const relations: Record<string, ChildRelation> = {};
        for (const [tag, who] of [["_FREL", couple.HUSB], ["_MREL", couple.WIFE]] as const) {
          const v = (val(c, tag) ?? "").toLowerCase();
          const rel: ChildRelation | undefined = /natural|birth|biolog/.test(v) ? "birth" : /adopt/.test(v) ? "adopted" : /step/.test(v) ? "step" : /foster/.test(v) ? "foster" : v ? "unknown" : undefined;
          if (who && rel && rel !== relation) relations[who] = rel;
        }
        if (Object.keys(relations).length) link.relations = relations;
        kids.push(link);
      }
      if (partners.length + kids.length === 0) continue;
      // Strom keeps the partners' ages at the wedding in the family's note: "Věk ženicha: 27 let".
      const famEvents = events(r, r.xref!, true, couple);
      const marr = famEvents.find((e) => e.kind === "MARR");
      const famNotes: string[] = [];
      for (const text of children(r, "NOTE").map(noteText)) {
        const keep = text.split("\n").filter((line) => !(marr && detailInto(marr, line, true, couple)));
        if (keep.join("").trim()) famNotes.push(keep.join("\n"));
      }
      // A family between matched persons that already exists is not created twice — it gets
      // what it did not know: children added in the other program, facts as leads.
      const exists = tree
        .list<Family>("family")
        .find((f) => !f.retracted && !f.mergedInto && partners.length > 0 && partners.every((p) => f.partners.includes(p)) && f.partners.length === partners.length);
      if (exists) {
        const kidsNew = kids.filter((k) => !exists.children.some((c) => c.person === k.person));
        const facts = famEvents.filter((e) => !knownFact(exists.events, e));
        result.events -= famEvents.length - facts.length;
        if (!kidsNew.length && !facts.length) continue;
        const next: Family = { ...exists, children: [...exists.children, ...kidsNew], events: [...exists.events, ...facts], updated: now() };
        const what = [...kidsNew.map((k) => `child ${k.person}`), ...facts.map((e) => [e.kind, e.date].filter(Boolean).join(" "))].join(", ");
        if (save(next, { op: "family.import", targets: [exists.id, ...kidsNew.map((k) => k.person)], summary: `${exists.id} + ${what} (lead)` }, bare(r.xref!))) result.extended.push(`${exists.id}: ${what}`);
        continue;
      }
      const t = now();
      const f: Family = {
        id: tree.allocate("F"),
        type: "family",
        partners,
        children: kids,
        events: famEvents,
        notes: famNotes.map((x) => note(tree, x)),
        refs: [{ system, id: r.xref! }],
        created: t,
        updated: t,
      };
      if (save(f, { op: "family.import", targets: [f.id, ...partners, ...kids.map((k) => k.person)], summary: `+${f.id} family (lead)` }, bare(r.xref!))) result.families++;
    }
  });
  return result;
}

/** The title of the source an imported tree becomes, in the research language. */
function importLabel(lang: string): string {
  return ({ cs: "Rodokmen", de: "Stammbaum", pl: "Drzewo genealogiczne", sk: "Rodokmeň" } as Record<string, string>)[lang] ?? "Family tree";
}

// ── Strom app JSON ─────────────────────────────────────────────────────────

interface StromPerson {
  id: string;
  firstName?: string;
  lastName?: string;
  gender?: string;
  birthDate?: string;
  birthPlace?: string;
  deathDate?: string;
  deathPlace?: string;
  notes?: string;
  refn?: string;
  nameVariants?: string[];
}
interface StromPartnership {
  id: string;
  person1Id?: string;
  person2Id?: string;
  childIds?: string[];
  startDate?: string;
  startPlace?: string;
}

/** Is this parsed JSON a Strom app tree? */
export function isStromJson(data: unknown): data is { persons: Record<string, StromPerson>; partnerships: Record<string, StromPartnership> } {
  return !!data && typeof data === "object" && "persons" in data && "partnerships" in data;
}

/** Strom flexible date ("~1900", "<1900-05", "1900-05-03") → GEDCOM. */
export function fromFlexDate(flex: string | undefined): string | undefined {
  if (!flex) return undefined;
  const m = /^([~<>])?(\d{3,4})(?:-(\d{2}))?(?:-(\d{2}))?$/.exec(flex.trim());
  if (!m) return importDate(flex);
  const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
  const core = [m[4] ? String(Number(m[4])) : "", m[3] ? months[Number(m[3]) - 1] ?? "" : "", m[2]].filter(Boolean).join(" ");
  const q = m[1] === "~" ? "ABT " : m[1] === "<" ? "BEF " : m[1] === ">" ? "AFT " : "";
  return normalizeDate(q + core);
}

export function importStromJson(
  tree: Tree,
  data: { persons: Record<string, StromPerson>; partnerships: Record<string, StromPartnership> },
  opts: { input: string; name: string },
): ImportResult {
  const result: ImportResult = { source: "", persons: 0, families: 0, matched: 0, events: 0, extended: [], problems: [] };
  tree.withTreeLock(() => {
    const source = makeSource(tree, `${importLabel(tree.config.lang)} ${opts.name} (Strom)`, opts.input);
    result.source = source.id;
    const idMap = new Map<string, string>();
    const cite = (sp: StromPerson, what: string) => [{ source: source.id, locator: `${sp.id} ${what}` }];
    for (const sp of Object.values(data.persons)) {
      if (sp.refn && /^P\d{4,}$/.test(sp.refn) && tree.get<Person>(sp.refn)) {
        idMap.set(sp.id, sp.refn);
        result.matched++;
        continue;
      }
      const events: Event[] = [];
      const add = (kind: string, date?: string, place?: string) => {
        const d = fromFlexDate(date);
        if (!d && !place) return;
        const ev: Event = { id: tree.allocate("E"), kind, status: "lead", citations: cite(sp, kind) };
        if (d) ev.date = d;
        if (place) ev.place = place;
        if (date && !d) ev.note = `date as written: ${date}`;
        events.push(ev);
        result.events++;
      };
      add("BIRT", sp.birthDate, sp.birthPlace);
      add("DEAT", sp.deathDate, sp.deathPlace);
      const t = now();
      const p: Person = {
        id: tree.allocate("P"),
        type: "person",
        names: [{ given: sp.firstName?.trim() || (sp.lastName ? "" : "?"), surname: sp.lastName?.trim() ?? "" }, ...(sp.nameVariants ?? []).map((v) => parseName(v))],
        sex: sp.gender === "male" ? "M" : sp.gender === "female" ? "F" : "U",
        events,
        notes: sp.notes?.trim() ? [note(tree, sp.notes)] : [],
        refs: [{ system: "strom-app", id: sp.id }, ...(sp.refn ? [{ system: "refn", id: sp.refn }] : [])],
        created: t,
        updated: t,
      };
      tree.put(p, { op: "person.import", targets: [p.id], summary: `+${p.id} ${p.names[0]!.given} /${p.names[0]!.surname}/ (lead)` });
      idMap.set(sp.id, p.id);
      result.persons++;
    }
    for (const sp of Object.values(data.partnerships)) {
      const partners = [sp.person1Id, sp.person2Id].map((x) => (x ? idMap.get(x) : undefined)).filter((x): x is string => !!x);
      const kids = (sp.childIds ?? []).map((c) => idMap.get(c)).filter((x): x is string => !!x);
      if (partners.length + kids.length === 0) continue;
      if (tree.list<Family>("family").some((f) => partners.length > 0 && partners.every((p) => f.partners.includes(p)) && f.partners.length === partners.length)) continue;
      const t = now();
      const events: Event[] = [];
      const d = fromFlexDate(sp.startDate);
      if (d || sp.startPlace) {
        const ev: Event = { id: tree.allocate("E"), kind: "MARR", status: "lead", citations: [{ source: source.id, locator: `${sp.id} MARR` }] };
        if (d) ev.date = d;
        if (sp.startPlace) ev.place = sp.startPlace;
        events.push(ev);
        result.events++;
      }
      const f: Family = {
        id: tree.allocate("F"),
        type: "family",
        partners,
        children: kids.map((person) => ({ person, relation: "birth" as const })),
        events,
        notes: [],
        refs: [{ system: "strom-app", id: sp.id }],
        created: t,
        updated: t,
      };
      tree.put(f, { op: "family.import", targets: [f.id, ...partners, ...kids], summary: `+${f.id} family (lead)` });
      result.families++;
    }
  });
  return result;
}

/** "čp. 13", "č. p. 13", "Nr. 13", "House No. 13" → "13": the house, without the word for it. */
function houseOf(address: string): string {
  return address
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^(?:č\.\s?p\.?|čp\.?|c\.\s?p\.|cp\.|house\s+no\.?|no\.|nr\.|haus-?\s?n(?:r|ro)\.?)\s*/iu, "");
}

/**
 * A labelled detail line of a fact, as the Strom app writes it back (in
 * Czech, English or German): "Věk: 61 let", "Příčina: …", "Adresa: čp. 13",
 * "Věk ženicha: 27 let". Put into the fact; false when the line is no such
 * detail (it stays in the note).
 */
function detailInto(ev: Event, line: string, family: boolean, couple: { HUSB?: string; WIFE?: string } = {}): boolean {
  const m = /^\s*([^:]{2,30}):\s*(.+)$/u.exec(line);
  if (!m) return false;
  const label = foldText(m[1]!);
  const value = m[2]!.trim();
  if (/^(vek zenicha|age of the husband|alter des brautigams)$/.test(label) || /^(vek nevesty|age of the wife|alter der braut)$/.test(label)) {
    const who = /zenicha|husband|brautigams/.test(label) ? couple.HUSB : couple.WIFE;
    const age = normalizeAge(value);
    if (!family || !who || !age || ev.ages?.[who]) return false;
    ev.ages = { ...ev.ages, [who]: age };
    return true;
  }
  if (/^(vek|age|alter)$/.test(label)) {
    const age = normalizeAge(value);
    if (family || ev.age || !age) return false;
    ev.age = age;
    return true;
  }
  if (/^(pricina|cause|ursache)$/.test(label) && !ev.cause) {
    ev.cause = value;
    return true;
  }
  if (/^(adresa|address|adresse)$/.test(label) && !ev.house) {
    ev.house = houseOf(value);
    return true;
  }
  return false;
}
