// Import of existing family trees (GEDCOM, Strom app JSON) as LEADS.
//
// A family tree is somebody's conclusions, not a record: everything becomes
// status "lead", citing one source "family tree <file>", and every person
// keeps a reference to where it came from. Persons whose REFN is one of our
// IDs in a tree of this research coming back from the Strom app are matched,
// not duplicated — another research's IDs never (oursByRefn).

import { eventKind, FAMILY_EVENT_KINDS, treeNoteText, type ChildLink, type ChildRelation, type Event, type ExternalRef, type Family, type Input, type Name, type Note, type OriginalIds, type Participant, type ParticipantRole, type Person, type Source, type ValueOrigin } from "./model.ts";
import { normalizeAge } from "./age.ts";
import { foldText } from "./text.ts";
import { eventMarksOf, gedcomRole, participantRole, roleAtMark, roleWord, shareMark, type EventMarks } from "./roles.ts";
import { labels } from "../gedcom/labels.ts";
import { phrase, type PhraseKey } from "./phrases.ts";
import { validateRecord } from "./validate.ts";
import { dateYears, normalizeDate } from "./gdate.ts";
import { isRetractedName } from "./retractions.ts";
import { appNoSurname, cleanTitle, gedcomName, noName, notAName, parseName, sameName, surnameAfterGiven, withoutMark, withoutTitles } from "./people.ts";
import { update } from "./records.ts";
import { now, type Tree } from "./tree.ts";
import { importSourceFor, importsOfHead, markUnder, nextImportKey, originOfMark } from "./origin.ts";
import { appIdBlocks, entryOf, foreignIds, joinIds, matchByIds, namesAlike, personIndex, type IdBlock } from "./originalids.ts";
import { appUnknownIsNoSurname, appWritesSexUnknown } from "./stromapp.ts";
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
  /**
   * People of the file who may be the same as a person of the research by an ID of the program it came from (spec 066
   * K3.2) — never taken as them (a name, sex or birth year differs in another program's file, another ID differs, an ID only of a program): a
   * person of the file (`person`, made new), the research's (`like`), why only maybe.
   */
  candidates: { person: string; like: string; why: string }[];
  /** Of `matched`: found by an ID of the program (another program's file), not as the research's own tree coming back. */
  matchedByIds?: number;
  /**
   * Of `matchedByIds`: people a newer file of the same program's tree says otherwise of (a name, sex, birth year) — the
   * research's person (`person`), the file's xref, what differs. Nothing of the research replaced: the file's values
   * came in as leads beside it (a sex the research has stays).
   */
  differs?: { person: string; xref: string; why: string }[];
  /**
   * A person of the file made new though maybe one of the research (a candidate), not put into a family where that one
   * is already (as a child, or as the partner of the same partner): the new person, the family, who they may be.
   */
  notJoined?: { person: string; family: string; like: string }[];
  /** What another program's file holds that the research does not take: media records, links to them, its own tags by tag. */
  notTaken?: { objects: number; links: number; tags: Record<string, number> };
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
  return normalizeDate(cleaned) ?? localDate(raw);
}

// Words other programs write in place of GEDCOM's ("Po 1919", "kolem 1850", "zwischen 1811 und 1812",
// "около 1870"), folded: Czech, Slovak, German, Polish, Russian, Ukrainian, English.
const DATE_QUALIFIER: Record<string, "AFT" | "BEF" | "ABT"> = {
  ...Object.fromEntries(["after", "po", "nach", "после", "після"].map((w) => [w, "AFT"])),
  ...Object.fromEntries(["before", "pred", "vor", "przed", "do", "bis", "до"].map((w) => [w, "BEF"])),
  ...Object.fromEntries(
    ["about", "circa", "ca", "c", "cca", "kolem", "okolo", "asi", "zhruba", "priblizne", "um", "etwa", "ungefahr", "ok", "около", "близько", "приблизно"].map((w) => [w, "ABT"]),
  ),
};
const DATE_RANGE: Record<string, "BET" | "FROM"> = {
  ...Object.fromEntries(["between", "mezi", "medzi", "miedzy", "pomiedzy", "zwischen", "между", "між"].map((w) => [w, "BET"])),
  ...Object.fromEntries(["from", "od", "von", "ab", "с", "з", "від"].map((w) => [w, "FROM"])),
};
const DATE_JOIN = new Set(["and", "a", "i", "und", "и", "і", "та", "to", "do", "bis", "по", "до"]);
/** "po roce 1919", "im Jahr 1850", "1870 г.": words around the year that say nothing. */
const DATE_FILLER = new Set(["r", "roku", "roce", "rokem", "rok", "im", "jahr", "jahre", "year", "the", "г", "года", "году", "року", "рік"]);

/** A date written in words of a language ("Po 1919" → "AFT 1919"); undefined when it is not one. */
function localDate(raw: string): string | undefined {
  const words = foldText(raw)
    .split(" ")
    .map((w) => w.replace(/[.,]+$/u, ""))
    .filter((w) => w && !DATE_FILLER.has(w));
  const plain = (part: string[]): string | undefined => {
    const d = part.length ? normalizeDate(part.join(" ")) : undefined;
    return d && !/^(ABT|CAL|EST|BEF|AFT|BET|FROM|TO) /.test(d) ? d : undefined;
  };
  const first = words[0] ?? "";
  const range = DATE_RANGE[first];
  if (range) {
    const j = words.findIndex((w, i) => i > 1 && DATE_JOIN.has(w));
    const a = plain(j > 0 ? words.slice(1, j) : words.slice(1));
    const b = j > 0 ? plain(words.slice(j + 1)) : undefined;
    if (!a) return undefined;
    if (range === "BET") return b ? `BET ${a} AND ${b}` : undefined;
    return j > 0 ? (b ? `FROM ${a} TO ${b}` : undefined) : `FROM ${a}`;
  }
  const q = DATE_QUALIFIER[first];
  const d = q ? plain(words.slice(1)) : undefined;
  return q && d ? `${q} ${d}` : undefined;
}

function makeSource(tree: Tree, title: string, input: string, imported?: Source["imported"]): Source {
  const t = now();
  const s: Source = {
    id: tree.allocate("S"),
    type: "source",
    kind: "family-tree",
    title,
    input,
    information: "secondary",
    form: "authored",
    ...(imported ? { imported } : {}),
    notes: [],
    created: t,
    updated: t,
  };
  tree.put(s, { op: "source.add", targets: [s.id, input], summary: `+${s.id} source "${title}"${imported ? ` (import ${imported.key})` : ""}` });
  return s;
}

/** A note of the person's or the family's in the file: the user's own tree's, whole however long (its beginning `text`, the whole `whole`). */
function note(tree: Tree, text: string): Note {
  return { ...treeNoteText(text), at: now(), by: tree.actor };
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

/** How a file means what it writes (stromAppFile): read the same way by strom intake and strom sync. */
export interface GedFile {
  /** a file of the Strom app (its HEAD: 1 SOUR STROM) */
  app: boolean;
  /** its "? /Unknown/" is a person of no surname (T08b) */
  unknownIsNoSurname: boolean;
  /** its SEX U is the sex the user left unknown, never an app's guess (U01) */
  sexUnknown: boolean;
}

/**
 * A file of the Strom app (its HEAD: 1 SOUR STROM), and whether its "? /Unknown/" is a person of no surname — an app
 * before 3.10.0-beta.7 or one whose version the HEAD's 2 VERS does not say (T08b); from it on the surname Unknown.
 * Its SEX U is a sex left unknown (U01) where the header says so (1 _STROM_SEX_U Y: the app's tree linked to a
 * research) or the app is 3.10.0-beta.11 or newer (its HEAD's 2 VERS; the bridge stamps the version the app said);
 * else the app guessed there (a husband male, anyone else female).
 */
export function stromAppFile(head: GedNode | undefined): GedFile {
  const sour = head ? children(head, "SOUR")[0] : undefined;
  const app = sour?.value.trim() === "STROM";
  const marked = val(head, "_STROM_SEX_U")?.trim().toUpperCase() === "Y";
  return { app, unknownIsNoSurname: app && appUnknownIsNoSurname(val(sour, "VERS")), sexUnknown: marked || (app && appWritesSexUnknown(val(sour, "VERS"))) };
}

/**
 * The sex of a person of a file, read the same way by strom intake and strom sync: M and F as it says; SEX U the sex
 * left unknown — "U", a value like the others — where the file means it so (stromAppFile: sexUnknown, U01), else
 * nothing the file says (an app's guess). No SEX line, or another value, says nothing of it in any file (B5-d: the app
 * writes SEX for everyone; found: a file of its 3.10.0-beta.11 without SEX lines read as every sex set unknown).
 */
export function readGedSex(r: GedNode, file: GedFile): "M" | "F" | "U" | undefined {
  const sex = val(r, "SEX")?.trim().toUpperCase();
  return sex === "M" || sex === "F" ? sex : sex === "U" && file.sexUnknown ? "U" : undefined;
}

/** A NAME of a GEDCOM file as the research reads it (readGedName). */
export interface GedName {
  /** given, surname — "?" for what stands for no name —, the titles (prefix, suffix) and the kind of name */
  name: Name;
  /** a person of no name and no surname as the Strom app writes them ("? //"; "? /Unknown/" before its 3.10.0-beta.7) */
  nameless: boolean;
}

/**
 * One NAME of a file, read the same way by strom intake and strom sync: the titles (NPFX, NSFX) apart from it — the
 * line says them too ("Ing. Jan /Novák/ ml."), taken off it —; the name's own parts (GIVN, SURN) first, the line only
 * how a program wrote them (a list of surnames — GEDCOM's commas — or a prefix of the surname, SPFX: the line's); a
 * line without slashes with a GIVN and no SURN ("Petr Novotný" + GIVN Petr): the rest of it is the surname (N11); what
 * stands for no name (N/A, N.N.) is "?"; the Strom app's "? /Unknown/" before its 3.10.0-beta.7 (or a file of it that
 * says no version): no surname (T08b). A slash inside a part stays for the caller.
 */
export function readGedName(n: GedNode, file: { app: boolean; unknownIsNoSurname: boolean }): GedName {
  const prefix = cleanTitle(val(n, "NPFX"));
  const suffix = cleanTitle(val(n, "NSFX"));
  const line = withoutTitles(n.value.replace(/\s+/g, " "), prefix, suffix);
  const parsed = parseName(line);
  const givn = val(n, "GIVN")?.replace(/\s*,\s*/g, " ").trim();
  const surn = val(n, "SURN")?.trim();
  const lineHasSurname = /\/.*\//.test(n.value);
  const name: Name = {
    given: noName(givn || parsed.given) ? "?" : givn || parsed.given,
    surname: surn ? (lineHasSurname && (surn.includes(",") || val(n, "SPFX")) ? parsed.surname : surn) : lineHasSurname || !givn ? parsed.surname : surnameAfterGiven(line, givn),
  };
  if (file.unknownIsNoSurname && appNoSurname(givn || parsed.given, name.surname, surn)) name.surname = "";
  if (prefix) name.prefix = prefix;
  if (suffix) name.suffix = suffix;
  const kind = nameKind(val(n, "TYPE"));
  if (kind) name.kind = kind;
  const nameless = file.app && !surn && (file.unknownIsNoSurname ? /^\?\s*\/\s*(?:Unknown\s*)?\/$/u : /^\?\s*\/\s*\/$/u).test(n.value.trim());
  return { name, nameless };
}

/**
 * The married names a file gives as _MARNM (Legacy, PAF and other programs): under a NAME (2 _MARNM) of that name's
 * given name, under the person (1 _MARNM) of their first name's. A value with slashes is a whole name, else a surname.
 * Read the same way by strom intake and strom sync.
 */
export function marnmNames(r: GedNode, givenOf: (n: GedNode) => string): Name[] {
  const out: Name[] = [];
  const add = (value: string, given: string) => {
    const v = value.replace(/\s+/g, " ").trim();
    if (!v) return;
    const n = v.includes("/") ? parseName(v) : { given: "", surname: v };
    const name: Name = { given: n.given || given, surname: n.surname, kind: "married" };
    if ((name.given || name.surname) && !out.some((x) => sameName(x, name))) out.push(name);
  };
  const names = children(r, "NAME");
  for (const n of names) for (const m of children(n, "_MARNM")) add(m.value, givenOf(n));
  for (const m of children(r, "_MARNM")) add(m.value, names[0] ? givenOf(names[0]) : "");
  return out;
}

/** The married names (_MARNM) of a person of a file as strom intake takes them: with the given name of their NAME (none for what stands in place of a name). */
function importedMarnm(r: GedNode, file: GedFile): Name[] {
  const given = (n: GedNode) => (notAName(readGedName(n, file).name.given) ? "" : readGedName(n, file).name.given.replace(/\//g, "|"));
  return marnmNames(r, given);
}

export function importGedcom(tree: Tree, text: string, opts: { input: string; name: string; sha: string; pendingIds?: ReadonlyMap<string, readonly OriginalIds[]> }): ImportResult {
  const { records, problems } = parseGedcomText(text);
  /** A file of the Strom app (its HEAD: 1 SOUR STROM): its own ways of writing are read as it means them. */
  const fromApp = stromAppFile(records.find((r) => r.tag === "HEAD"));
  const system = `gedcom:${opts.sha.slice(0, 12)}`;
  const result: ImportResult = { source: "", persons: 0, families: 0, matched: 0, events: 0, extended: [], problems, candidates: [] };
  if (!fromApp.app) result.notTaken = notTakenOf(records);
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
    // a family tree of another program: an import of this research (its key R1, R2…, the program, the file's date) —
    // its values leads an agent changes only on a record (core/origin.ts); the Strom app's file is the user's own tree
    const head = records.find((r) => r.tag === "HEAD");
    const sourNode = head?.children.find((c) => c.tag === "SOUR");
    const imported: Source["imported"] | undefined = fromApp.app
      ? undefined
      : {
          key: nextImportKey(tree),
          ...(val(sourNode, "NAME")?.trim() || sourNode?.value.trim() ? { program: (val(sourNode, "NAME")?.trim() || sourNode!.value.trim()).slice(0, 200) } : {}),
          ...(val(sourNode, "VERS")?.trim() ? { version: val(sourNode, "VERS")!.trim().slice(0, 100) } : {}),
          ...(val(head, "DATE")?.trim() ? { date: val(head, "DATE")!.trim().slice(0, 100) } : {}),
          at: now().slice(0, 10),
          file: opts.name,
          sha: opts.sha,
        };
    const source = makeSource(tree, `${importLabel(tree.config.lang)} ${opts.name}`, opts.input, imported);
    result.source = source.id;
    const stamp: ValueOrigin<never> = fromApp.app ? { by: "user", tree: true } : { by: "import", source: source.id };
    /**
     * Where a value of the file comes from: every value of another program's file is the import's (whatever marks it
     * carries — never read from a foreign file), every one of the Strom app's the user's family tree's (the user's to
     * guard, not their own change: origin user with `tree`). The hook for the app's own
     * marks (`_STROM_IMPORT Ix [DATE PLAC…]` under a fact, a NAME, a person: spec 066, read by the sync) — only where
     * `fromApp`, never in another program's file.
     */
    // the imports the app's file names (HEAD 1 _STROM_IMPORT Ix): each its own source, made once, cited by its values
    const appImports = fromApp.app ? importsOfHead(head) : undefined;
    const importSources = new Map<string, string>();
    const importSource = (key: string): string => {
      let id = importSources.get(key);
      if (!id) importSources.set(key, (id = importSourceFor(tree, appImports!.get(key)!, opts.input).source.id));
      return id;
    };
    const originOf = <P extends string>(node: GedNode | undefined, of: "fact" | "name" | "sex" = "fact"): ValueOrigin<P> => {
      const mark = markUnder(node, appImports);
      return mark ? originOfMark<P>(mark, importSource(mark.key), of) : { ...stamp };
    };
    /** What a fact of the file cites: the import's source the app marks it with (and the file's for parts the user changed), else the file's. */
    const citesOf = (o: ValueOrigin<string>, locator: string): Event["citations"] =>
      o.source && o.source !== source.id ? [{ source: o.source, locator }, ...(o.parts?.length ? [{ source: source.id, locator }] : [])] : [{ source: source.id, locator }];
    const xrefToId = new Map<string, string>();
    const pedi = new Map<string, Map<string, string>>(); // person xref → family xref → PEDI
    const individuals = records.filter((x) => x.tag === "INDI" && x.xref);

    // IDs first, so that associations (a godparent's ASSO) point at the right person.
    const fresh = new Set<string>();
    const treeId = val(records.find((x) => x.tag === "HEAD"), "_STROM_TREE")?.trim();
    const ourPeople = oursByRefn(tree, treeId, individuals.map((r) => ({ refn: val(r, "REFN"), names: r.children.filter((c) => c.tag === "NAME").map((c) => c.value) })));
    // The IDs a record had in the file (spec 066 K3.2): another program's its xref and ID lines, of this import; the
    // Strom app's its blocks of the imports its HEAD names (never its own level-1 _UID, never its xref).
    const idsRead = new Map<string, { blocks: IdBlock[]; entries: ReturnType<typeof entryOf>[] }>();
    const idEntries = (r: GedNode) => {
      const had = idsRead.get(r.xref!);
      if (had) return had;
      const got = readIds(r);
      idsRead.set(r.xref!, got);
      return got;
    };
    const readIds = (r: GedNode): { blocks: IdBlock[]; entries: ReturnType<typeof entryOf>[] } => {
      const label = bare(r.xref!);
      if (!fromApp.app) {
        const b = foreignIds(r, result.problems, label);
        return { blocks: b ? [b] : [], entries: b ? [entryOf(b, source.id)] : [] };
      }
      const blocks = appIdBlocks(r, (key) => !!appImports?.has(key), result.problems, label);
      return { blocks, entries: blocks.map((b) => entryOf(b, importSource(b.key!))) };
    };
    // A person the research has by an ID of the program (strong: the same person when everything else agrees, or when a
    // newer file of the same program's tree says a name, sex or birth year otherwise — said, the rest leads; weak or in
    // doubt: a candidate for a person to decide) — each of the research's people one person of the file at most.
    // (a research of 1.29: the IDs its earlier imports' files give, not written on the people yet, count as well)
    const index = personIndex(tree, opts.pendingIds);
    const taken = new Set(ourPeople.filter((p): p is Person => !!p).map((p) => p.id));
    const maybe = new Map<string, { like: string; why: string }[]>();
    for (const [i, r] of individuals.entries()) {
      let ours = ourPeople[i];
      if (!ours) {
        const blocks: IdBlock[] = idEntries(r).blocks;
        const ids = blocks.flatMap((b) => (b.xid ? [] : b.ids));
        const hit = ids.length || (!fromApp.app && blocks.length)
          ? matchByIds(tree, index, {
              names: children(r, "NAME").map((c) => c.value),
              sex: readGedSex(r, fromApp),
              year: fileBirthYear(r),
              ids,
              xref: fromApp.app ? undefined : bare(r.xref!),
              program: fromApp.app ? undefined : imported?.program,
            }, taken)
          : { candidates: [] };
        if (hit.same) {
          ours = tree.get<Person>(hit.same);
          taken.add(hit.same);
          result.matchedByIds = (result.matchedByIds ?? 0) + 1;
          if (hit.differs?.length) (result.differs ??= []).push({ person: hit.same, xref: bare(r.xref!), why: hit.differs.join(", ") });
        } else if (hit.candidates.length) maybe.set(r.xref!, hit.candidates);
      }
      if (ours) {
        xrefToId.set(r.xref!, ours.id);
        result.matched++;
      } else {
        const id = tree.allocate("P");
        xrefToId.set(r.xref!, id);
        fresh.add(r.xref!);
      }
    }

    // a role at a family's event (_STROM_AT @F…@): the family's xref → our family, once the families are made
    const families = new Set(records.filter((x) => x.tag === "FAM" && x.xref).map((x) => x.xref!));
    const familyOf = new Map<string, string>();
    const atLater: { event: string; at: string; owner: string; family: boolean }[] = [];
    const events = (node: GedNode, xref: string, forFamily: boolean, couple: { HUSB?: string; WIFE?: string } = {}): Event[] => {
      const out: Event[] = [];
      for (const c of node.children) {
        const kind = eventKind(c.tag);
        if (!kind || ["NAME", "SEX"].includes(c.tag)) continue;
        if (forFamily !== FAMILY_EVENT_KINDS.has(kind) && kind !== "EVEN" && kind !== "RESI" && kind !== "CENS") continue;
        const origin = originOf<"date" | "place" | "value">(c);
        const ev: Event = {
          id: tree.allocate("E"),
          kind,
          status: "lead",
          citations: citesOf(origin, `${bare(xref)} ${c.tag}`),
          origin,
        };
        const extra: string[] = [];
        const rawDate = val(c, "DATE");
        const date = importDate(rawDate);
        if (date) ev.date = date;
        else if (rawDate) extra.push(`date as written: ${rawDate}`);
        const place = val(c, "PLAC");
        if (place) ev.place = place.replace(/\s+/g, " ");
        // an address in the place (ADDR / ADR1) is the house; the age a person's fact's (a couple's: the partners')
        const addr = c.children.find((x) => x.tag === "ADDR");
        const rawAge = val(c, "AGE");
        const { ageAsWritten, ...said } = factDetails(val(c, "CAUS"), forFamily ? undefined : rawAge, addr ? (val(addr, "ADR1") ?? addr.value) : undefined);
        Object.assign(ev, said);
        if (ageAsWritten) extra.push(`age as written: ${rawAge}`);
        const value = c.value.trim();
        if (value && value !== "Y") ev.value = value.replace(/\s+/g, " ");
        const type = val(c, "TYPE");
        // A bare "1 EVEN" with neither TYPE nor value still is an event: name it after its tag.
        if (kind === "EVEN") ev.label = type || value || "EVEN";
        if (["OCCU", "RELI", "TITL", "NATI"].includes(kind) && !ev.value) ev.value = type || "?";
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
        // "RELA Present" + a note with the role in words (the Strom app for a midwife, an informant …): the role from
        // the note, the note kept as the user wrote it ("porodní bába")
        const roleIn = (n: GedNode, fallback: ParticipantRole): { role: ParticipantRole; note?: string } =>
          participantRole(val(n, "RELA"), children(n, "NOTE").map(noteText).join(" "), fallback);
        for (const w of children(c, "_WITN").concat(children(c, "WITN"))) {
          const name = w.value.trim();
          if (name) participants.push({ ...roleIn(w, "witness"), name });
        }
        // GEDCOM 7: a ROLE (with its PHRASE) before a RELA; a person of no record (@VOID@) named by the ASSO's PHRASE
        const assoRole = (a: GedNode, fallback: ParticipantRole): { role: ParticipantRole; note?: string } => {
          const roleNode = children(a, "ROLE")[0];
          const g7 = gedcomRole(roleNode?.value, val(roleNode, "PHRASE"), tree.config.lang);
          if (!g7) return roleIn(a, fallback);
          const note = [g7.note, children(a, "NOTE").map(noteText).join(" ").trim()].filter(Boolean).join("; ");
          return { role: g7.role, ...(note ? { note } : {}) };
        };
        for (const a of children(c, "ASSO")) {
          const id = xrefToId.get(a.value.trim());
          if (id) participants.push({ ...assoRole(a, "other"), person: id });
          else if (a.value.trim() === "@VOID@" && val(a, "PHRASE")) participants.push({ ...assoRole(a, "other"), name: val(a, "PHRASE")!.normalize("NFC").replace(/\s+/gu, " ") });
        }
        // the people of another program's shared event (_SHAR of RootsMagic, Legacy, Family Historian): its ROLE or RELA
        // read as GEDCOM 7's, a role the research has none of (Principal, Household) other with its word; nobody of the
        // file, nobody
        for (const sh of children(c, "_SHAR")) {
          const id = xrefToId.get(sh.value.trim());
          if (!id) continue;
          const word = val(sh, "ROLE") ?? val(sh, "RELA");
          const got = gedcomRole(word, val(children(sh, "ROLE")[0], "PHRASE"), tree.config.lang) ?? { role: "other" as ParticipantRole };
          const note = [got.note, children(sh, "NOTE").map(noteText).join(" ").trim()].filter(Boolean).join("; ");
          participants.push({ role: got.role, person: id, ...(note ? { note } : {}) });
        }
        if (participants.length) ev.participants = participants;
        // the Strom app's shared event (a person's fact only) and a role at another's event; a family's xref is our
        // family's only once the families are made: put in after them (atLater)
        const marks = eventMarksOf(c, !forFamily, (ref) => xrefToId.get(ref));
        if (marks.share) ev.share = marks.share;
        if (marks.unreadable) result.problems.push(`${bare(xref)} ${c.tag}: the mark of a shared event "${marks.unreadable}" is no ID of one (1–64 letters and digits) — the fact taken without it`);
        if (marks.roleAt) {
          ev.roleAt = marks.roleAt;
          if (!marks.roleAt.at && marks.atXref && families.has(marks.atXref)) atLater.push({ event: ev.id, at: marks.atXref, owner: xref, family: forFamily });
        }
        // What the author of that tree cited for this fact.
        for (const sc of children(c, "SOUR")) {
          const title = foreignSources.get(sc.value.trim()) ?? (/^@/.test(sc.value) ? "" : sc.value.trim());
          const cited = [title, val(sc, "PAGE")].filter(Boolean).join(", ");
          if (cited) extra.push(`source there: ${cited}`);
        }
        // The Strom app returns age, cause and address as labelled lines of the note ("Věk: 61 let").
        const noteLines: string[] = [];
        for (const line of children(c, "NOTE").map(noteText).join("\n").split("\n")) if (!detailInto(ev, line, forFamily, couple)) noteLines.push(line);
        // the note of the user's own tree whole, however long (a note of one's own is no limit of theirs: the app
        // gets it back as it was)
        const parts = [...extra, noteLines.join("\n").trim()].filter(Boolean);
        if (parts.length) ev.note = parts.join("\n").replace(/\s+\n/g, "\n").trim();
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

    const namesOf = (r: GedNode): Name[] => {
      const names = children(r, "NAME")
        .map((n) => {
          const found = readGedName(n, fromApp).name;
          // a word that describes the person in place of a name (stillborn, son): the name is "?", the word goes to a note
          if (notAName(found.given)) found.given = "?";
          // a slash inside a name ("/⟨K/Č⟩emenská/") is kept as "|": the name stays one GEDCOM can write
          const name: Name = { ...found, given: found.given.replace(/\//g, "|"), surname: found.surname.replace(/\//g, "|") };
          // the name the person is shown by now (the Strom file's mark, the user's choice): the first one marked
          if (/^y(es)?$/i.test(val(n, "_STROM_PRIMARY")?.trim() ?? "")) name.primary = true;
          name.origin = originOf(n, "name");
          return name;
        })
        .map((n) => (n.given || n.surname ? n : { ...n, given: "?", surname: "" }))
        .map((n, i, all) => (n.primary && all.findIndex((m) => m.primary) !== i ? withoutMark(n) : n));
      // a married name other programs give apart (_MARNM): a name of the married kind, unless the person has it already
      return [...names, ...importedMarnm(r, fromApp).filter((m) => !names.some((n) => sameName(n, m))).map((m) => ({ ...m, origin: { ...stamp } as ValueOrigin<"given" | "surname"> }))];
    };

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
        // a name the research took back is not taken again from a file that still has it
        // the names another file adds: never the one the person is shown by (theirs stands)
        const names = namesOf(r).filter((n) => n.given !== "?" && !cur.names.some((x) => sameName(x, n)) && !isRetractedName(cur, n)).map(withoutMark);
        // the IDs it has in this file: added (the same import and xref once), nothing taken off
        const ids = joinIds(cur.originalIds, idEntries(r).entries);
        if (!facts.length && !names.length && !ids.changed) continue;
        const refs = (cur.refs ?? []).some((x) => x.system === system && x.id === r.xref!) ? cur.refs : [...(cur.refs ?? []), { system, id: r.xref! }];
        const next: Person = { ...cur, names: [...cur.names, ...names], events: [...cur.events, ...facts], ...(refs ? { refs } : {}), ...(ids.changed ? { originalIds: ids.list } : {}), updated: now() };
        const what = [...facts.map((e) => [e.kind, e.date].filter(Boolean).join(" ")), ...names.map((n) => `name ${[n.given, n.surname].filter(Boolean).join(" ")}`)].join(", ");
        const saved = save(next, { op: "person.import", targets: [cur.id], summary: `${cur.id} + ${what || "IDs of the file"}${what ? " (lead)" : ""}` }, bare(r.xref!));
        if (saved && what) result.extended.push(`${cur.id}: ${what}`);
        continue;
      }
      const refn = val(r, "REFN");
      const names = namesOf(r);
      // The birth name leads: a married name is a variant.
      names.sort((a, b) => (a.kind === "married" || a.kind === "alias" ? 1 : 0) - (b.kind === "married" || b.kind === "alias" ? 1 : 0));
      const read = readGedSex(r, fromApp);
      const sex = read ?? "U";
      const refs: ExternalRef[] = [{ system, id: r.xref! }];
      if (refn) refs.push({ system: "refn", id: refn });
      const t = now();
      // The Strom app keeps what a birth or death entry adds in the person's note:
      // "Úmrtí: Věk: 61 let", "Narození: Adresa: čp. 13" — back to the fact.
      const personEvents = events(r, r.xref!, false);
      const personNotes = factNotes(r, personEvents);
      // what a file wrote in place of a name, kept as it said it ("Mrtvě narozený")
      for (const n of children(r, "NAME")) {
        const g = val(n, "GIVN") ?? parseName(withoutTitles(n.value.replace(/\s+/g, " "), cleanTitle(val(n, "NPFX")), cleanTitle(val(n, "NSFX")))).given;
        if (notAName(g) && !personNotes.includes(g.trim())) personNotes.push(g.trim());
      }
      const originalIds = joinIds(undefined, idEntries(r).entries).list;
      const p: Person = {
        id: xrefToId.get(r.xref!)!,
        type: "person",
        names: names.length ? names : [{ given: "?", surname: "" }],
        sex,
        // a sex the file gives (an unknown one is no value to keep)
        ...(read && read !== "U" ? { sexOrigin: originOf<never>(markUnder(children(r, "SEX")[0], appImports) ? children(r, "SEX")[0] : r, "sex") } : {}),
        events: personEvents,
        notes: personNotes.filter((x) => x.trim()).map((x) => note(tree, x)),
        refs,
        ...(originalIds.length ? { originalIds } : {}),
        created: t,
        updated: t,
      };
      if (!save(p, { op: "person.import", targets: [p.id], summary: `+${p.id} ${names[0]?.given ?? ""} /${names[0]?.surname ?? ""}/ (lead)` }, bare(r.xref!))) {
        xrefToId.delete(r.xref!);
        continue;
      }
      result.persons++;
      for (const c of maybe.get(r.xref!) ?? []) result.candidates.push({ person: p.id, ...c });
      for (const fc of children(r, "FAMC")) {
        const pd = val(fc, "PEDI")?.toLowerCase();
        if (pd && pd !== "birth") pedi.set(r.xref!, (pedi.get(r.xref!) ?? new Map()).set(fc.value.trim(), pd));
      }
    }

    // Families. A person made new though maybe one of the research (a candidate) is never put where that one is: a
    // child of the family it is a child of, the partner of its partner — the family would hold one person twice.
    const mayBe = new Map<string, Set<string>>();
    for (const c of result.candidates) mayBe.set(c.person, (mayBe.get(c.person) ?? new Set()).add(c.like));
    const notJoined = (person: string, family: string, like: string) => (result.notJoined ??= []).push({ person, family, like });
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
        // the relation to each parent (Legacy, RootsMagic, FTM, the Strom app), over the PEDI that speaks for both
        const by: Record<string, ChildRelation> = {};
        for (const [tag, who] of [["_FREL", couple.HUSB], ["_MREL", couple.WIFE]] as const) {
          if (!who) continue;
          const v = (val(c, tag) ?? "").toLowerCase();
          const rel: ChildRelation | undefined = /natural|birth|biolog/.test(v) ? "birth" : /adopt/.test(v) ? "adopted" : /step/.test(v) ? "step" : /foster/.test(v) ? "foster" : v ? "unknown" : undefined;
          by[who] = rel ?? relation;
        }
        kids.push(childLink(id, by, relation));
      }
      // a partner who may be the partner of the other one already: no second family of the two
      const twice = partners.flatMap((p) =>
        [...(mayBe.get(p) ?? [])].flatMap((like) =>
          tree.list<Family>("family").filter((f) => !f.retracted && !f.mergedInto && f.partners.includes(like) && partners.filter((x) => x !== p).every((x) => f.partners.includes(x)) && partners.length > 1).map((f) => ({ p, f, like })),
        ),
      )[0];
      if (twice) {
        notJoined(twice.p, twice.f.id, twice.like);
        continue;
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
        familyOf.set(r.xref!, exists.id);
        const kidsNew = kids.filter((k) => {
          if (exists.children.some((c) => c.person === k.person)) return false;
          const like = [...(mayBe.get(k.person) ?? [])].find((l) => exists.children.some((c) => c.person === l));
          if (like) notJoined(k.person, exists.id, like);
          return !like;
        });
        const facts = famEvents.filter((e) => !knownFact(exists.events, e));
        result.events -= famEvents.length - facts.length;
        const ids = joinIds(exists.originalIds, idEntries(r).entries);
        if (!kidsNew.length && !facts.length && !ids.changed) continue;
        const next: Family = { ...exists, children: [...exists.children, ...kidsNew], events: [...exists.events, ...facts], ...(ids.changed ? { originalIds: ids.list } : {}), updated: now() };
        const what = [...kidsNew.map((k) => `child ${k.person}`), ...facts.map((e) => [e.kind, e.date].filter(Boolean).join(" "))].join(", ");
        const saved = save(next, { op: "family.import", targets: [exists.id, ...kidsNew.map((k) => k.person)], summary: `${exists.id} + ${what || "IDs of the file"}${what ? " (lead)" : ""}` }, bare(r.xref!));
        if (saved && what) result.extended.push(`${exists.id}: ${what}`);
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
        ...((ids) => (ids.length ? { originalIds: ids } : {}))(joinIds(undefined, idEntries(r).entries).list),
        created: t,
        updated: t,
      };
      if (save(f, { op: "family.import", targets: [f.id, ...partners, ...kids.map((k) => k.person)], summary: `+${f.id} family (lead)` }, bare(r.xref!))) {
        result.families++;
        familyOf.set(r.xref!, f.id);
      }
    }
    // a role at a family's event: whose, now that the families are made (a family the import made none of: the role alone)
    for (const later of atLater) {
      const at = familyOf.get(later.at);
      const owner = later.family ? familyOf.get(later.owner) : xrefToId.get(later.owner);
      const rec = at && owner ? tree.get<Person | Family>(owner) : undefined;
      const ev = rec?.events.find((e) => e.id === later.event);
      if (!rec || !ev?.roleAt) continue;
      const next = { ...rec, events: rec.events.map((e) => (e === ev ? { ...e, roleAt: { ...ev.roleAt!, at: at! } } : e)) } as Person | Family;
      tree.put(next, { op: `${rec.type}.import`, targets: [rec.id, at!], summary: `${rec.id} ${ev.kind}: a role at ${at}` });
    }
  });
  return result;
}

/**
 * Our people by the REFNs a family tree carries (a tree of this research coming back from the Strom app), in the order
 * of its people. A file of this research (its _STROM_TREE) is ours by the IDs alone, whatever the names; another
 * research's never — its P0001 is somebody else (found: the app's file of another tree matched by its IDs, "this
 * research's tree coming back"); a file that names no research (the standard file, another program) only where most
 * of the people its IDs name are alike by name — and then each by its name too. Merged since: the one it went into.
 */
// ── the married names an earlier import left out ─────────────────────────────
//
// strom before 1.16 read no _MARNM (MyHeritage, Legacy, PAF): a research started from such a file lacks the names
// after a marriage. Taken in again from the very file it was started from (its input), by the IDs the import kept
// (refs gedcom:<sha> + the file's xref) — nobody else, nothing but these names.

/** Where a married name taken in later cites the import: the person's xref in the file and the tag. */
const MARNM_LOCATOR = " _MARNM";

export interface MarriedNamesPlan {
  input: string;
  /** The file is the Strom app's: its names the user's (spec 066), else the import's. */
  app?: boolean;
  /** The import's source: what the names cite. */
  source: string;
  /** Names to add: of the married kind, beside the name the person is shown by. */
  add: { person: string; xref: string; name: Name }[];
  /** The person has the name already (of any kind): nothing changes. */
  have: { person: string; xref: string; name: Name }[];
  /** People of the file with a married name nobody of the research came from (not imported, withdrawn). */
  unpaired: { xref: string; name: string; married: Name[] }[];
}

/** The input a family tree was imported from (a GEDCOM file kept by the research), else why not. */
export function importedTree(input: Input): string | undefined {
  if (input.kind !== "tree" || !input.sha || !/\.ged$/i.test(input.name)) return `${input.id} is not a GEDCOM family tree`;
  if (!input.source || !input.imported) return `${input.id} was not imported (strom intake --no-import)`;
  return undefined;
}

/** What the input's file gives as married names (_MARNM) that the people imported from it lack. */
export function marriedNamesPlan(tree: Tree, input: Input, text: string): MarriedNamesPlan {
  const { records } = parseGedcomText(text);
  const file = stromAppFile(records.find((r) => r.tag === "HEAD"));
  const system = `gedcom:${input.sha!.slice(0, 12)}`;
  // the people the import made of the file (or added to): by the xref it kept; one merged since is the one it went into
  const byXref = new Map<string, Person>();
  for (const p of tree.list<Person>("person")) for (const r of p.refs ?? []) if (r.system === system) byXref.set(r.id, p);
  const live = (p: Person | undefined): Person | undefined => {
    for (let i = 0; p && i < 20; i++) {
      if (!p.mergedInto) return p.retracted ? undefined : p;
      p = tree.get<Person>(p.mergedInto);
    }
    return undefined;
  };
  const plan: MarriedNamesPlan = { input: input.id, source: input.source!, ...(file.app ? { app: true } : {}), add: [], have: [], unpaired: [] };
  for (const r of records.filter((x) => x.tag === "INDI" && x.xref)) {
    // NFC as every record (a file may write a name decomposed)
    const married = importedMarnm(r, file).map((n) => ({ ...n, given: n.given.normalize("NFC"), surname: n.surname.normalize("NFC") }));
    if (!married.length) continue;
    const p = live(byXref.get(r.xref!));
    if (!p) {
      plan.unpaired.push({ xref: r.xref!, name: (children(r, "NAME")[0]?.value ?? "?").replace(/\s+/g, " ").trim(), married });
      continue;
    }
    for (const name of married) {
      const had = p.names.some((n) => sameName(n, name)) || isRetractedName(p, name) || plan.add.some((a) => a.person === p.id && sameName(a.name, name));
      (had ? plan.have : plan.add).push({ person: p.id, xref: r.xref!, name });
    }
  }
  return plan;
}

/** Add the names of a plan: each of the married kind, last, citing the import (the person's xref and _MARNM). */
export function addMarriedNames(tree: Tree, plan: MarriedNamesPlan): void {
  tree.withTreeLock(() => {
    for (const a of plan.add) {
      const name: Name = { ...a.name, citations: [{ source: plan.source, locator: `${a.xref.replace(/@/g, "")}${MARNM_LOCATOR}` }], origin: plan.app ? { by: "user", tree: true } : { by: "import", source: plan.source } };
      update<Person>(tree, a.person, "person", (p) => (p.names.some((n) => sameName(n, name)) ? p : { ...p, names: [...p.names, name] }), {
        op: "person.name",
        summary: `${a.person} name ${gedcomName(name)} (married) ← ${plan.source}`,
        reason: `the married name ${plan.input} gives (_MARNM), left out when it was imported`,
      });
    }
  });
}

/** Take back what addMarriedNames added from this input: the names citing its import there (another citation kept: only this one goes). */
export function undoMarriedNames(tree: Tree, inputRec: Input): { person: string; name: Name }[] {
  const source = inputRec.source;
  const ours = (c: { source: string; locator?: string }) => c.source === source && !!c.locator?.endsWith(MARNM_LOCATOR);
  const gone: { person: string; name: Name }[] = [];
  if (!source) return gone;
  tree.withTreeLock(() => {
    for (const p of tree.list<Person>("person")) {
      const at = p.names.flatMap((n, i) => (i > 0 && n.kind === "married" && n.citations?.some(ours) ? [i] : []));
      if (!at.length) continue;
      const hit = at.map((i) => p.names[i]!);
      update<Person>(
        tree,
        p.id,
        "person",
        (x) => ({
          ...x,
          names: x.names.flatMap((n, i) => {
            if (!at.includes(i)) return [n];
            // cited by something else too: only this citation goes
            const rest = (n.citations ?? []).filter((c) => !ours(c));
            return rest.length ? [{ ...n, citations: rest }] : [];
          }),
        }),
        { op: "name.remove", summary: `${p.id} name ${hit.map(gedcomName).join(", ")} taken back`, reason: `the married names taken in from ${inputRec.id} taken back` },
      );
      for (const n of hit) gone.push({ person: p.id, name: n });
    }
  });
  return gone;
}

function oursByRefn(tree: Tree, treeId: string | undefined, people: { refn?: string; names: string[] }[]): (Person | undefined)[] {
  if (treeId && treeId !== tree.config.id) return people.map(() => undefined);
  const found = people.map(({ refn }) => {
    if (!refn || !/^P\d{4,}$/.test(refn.trim())) return undefined;
    let ours = tree.get<Person>(refn.trim());
    for (let hops = 0; ours?.mergedInto && hops < 10; hops++) ours = tree.get<Person>(ours.mergedInto);
    return ours && ours.type === "person" && !ours.retracted ? ours : undefined;
  });
  if (treeId) return found;
  // a word of the name in common, or the same name of a single letter or digit ("1", "J.")
  const named = found.map((ours, i) => (ours && namesAlike(ours, people[i]!.names) ? ours : undefined));
  const resolved = found.filter(Boolean).length;
  return named.filter(Boolean).length * 2 > resolved ? named : people.map(() => undefined);
}

/** The first year of a person's birth or baptism in a file. */
function fileBirthYear(r: GedNode): number | undefined {
  for (const tag of ["BIRT", "CHR", "BAPM"]) {
    const c = children(r, tag)[0];
    if (!c) continue;
    const ys = dateYears(importDate(val(c, "DATE")) ?? "");
    if (ys.length) return Math.min(...ys);
  }
  return undefined;
}

/** The level-1 tags of its own another program writes under a person or a family that intake reads. */
const OWN_TAGS_READ = new Set(["_MARNM", "_UID", "_FSFTID"]);

/**
 * What another program's file holds that intake does not take: its media records (0 @…@ OBJE), the links to media
 * under people and families, and its own level-1 tags there (by tag) — said, so that nobody thinks them in the research.
 */
function notTakenOf(records: GedNode[]): NonNullable<ImportResult["notTaken"]> {
  const out = { objects: 0, links: 0, tags: {} as Record<string, number> };
  for (const r of records) {
    if (r.tag === "OBJE" && r.xref) out.objects++;
    if (r.tag !== "INDI" && r.tag !== "FAM") continue;
    for (const c of r.children) {
      if (c.tag === "OBJE") out.links++;
      else if (c.tag.startsWith("_") && !OWN_TAGS_READ.has(c.tag) && !eventKind(c.tag)) out.tags[c.tag] = (out.tags[c.tag] ?? 0) + 1;
    }
  }
  return out;
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
  /** The titles of the name (the app's 3.10): "Ing.", "ml.". */
  titleBefore?: string;
  titleAfter?: string;
  /** What the app keeps of the birth and the death besides (its 3.7): the house, the cause, the age as written. */
  birthAddress?: string;
  deathCause?: string;
  deathAge?: string;
  deathAddress?: string;
  /** The child's tie to a parent who is not their own: the parent's id → adoptive, step, foster. */
  parentRelTypes?: Record<string, string>;
  /** The person's other events (a census, a residence, a move, a godparent's own event of a role at another's). */
  events?: StromEvent[];
  /** The app's "?" stand-in (an unknown parent drawn in the tree): nobody (appNobody). */
  isPlaceholder?: boolean;
  /** The person's parents: a child of parents no partnership holds is theirs alone (appLooseFamilies). */
  parentIds?: string[];
  /** The surname after the (last) marriage (spec 010) and its given names when they are not the person's (its 3.26). */
  marriedSurname?: string;
  marriedFirstName?: string;
  /** The name the person is shown by (spec 024): the birth one, the one after the marriage; none: no choice. */
  primaryName?: string;
}
/** An event of a person (or a couple) in the Strom app's JSON, with the marks of an event it shares (spec 085). */
export interface StromEvent {
  type: string;
  customLabel?: string;
  date?: string;
  place?: string;
  note?: string;
  cause?: string;
  age?: string;
  address?: string;
  /** A couple's event: the partners' ages, the app's person id → age (3.7). */
  ages?: Record<string, string>;
  /** The app's ID of the event it shares among people (a census of a household, a move): `_STROM_SHARE` of its GEDCOM. */
  shareId?: string;
  /** The person's role in it as the user wrote it ("maid"); none: a member of the household. */
  shareRole?: string;
  /** A role at another's event (a godparent's own event): whose by the app's ID, of what type (`_STROM_ROLE`, `_STROM_AT`). */
  roleAt?: { role?: string; personId?: string; partnershipId?: string; eventType?: string };
  /** Who else was there (godparents, witnesses, a midwife): a person of the app's tree or a name. */
  participants?: StromParticipant[];
}
/** Who else was at an event in the Strom app's JSON: its role, a person of its tree (`personId`) or a name, a note. */
export interface StromParticipant {
  role?: string;
  personId?: string;
  name?: string;
  note?: string;
}
interface StromPartnership {
  id: string;
  person1Id?: string;
  person2Id?: string;
  childIds?: string[];
  status?: string;
  startDate?: string;
  startPlace?: string;
  /** The divorce's date and place (status divorced). */
  endDate?: string;
  endPlace?: string;
  /** The house of the wedding (3.7). */
  address?: string;
  /** The partners' ages at the wedding: the app's person id → age (3.7). */
  ages?: Record<string, string>;
  /** The couple's one note (its GEDCOM: 1 NOTE under FAM). */
  note?: string;
  /** The witnesses at the wedding. */
  participants?: StromParticipant[];
  /** The couple's other events (the app's 3.8). */
  events?: StromEvent[];
  /** The file the couple came from wrote no wedding (spec 066 K3.1): none written back unless its witnesses or status say one. */
  marriageUnrecorded?: boolean;
  /** How sure the wedding is (the app's status of the fact). */
  startStatus?: string;
}

/** The Strom app's life events of a person (its JSON's events[].type) → our kinds. */
export const APP_EVENTS: Record<string, string> = {
  birth: "BIRT", death: "DEAT", baptism: "BAPM", burial: "BURI", occupation: "OCCU", residence: "RESI", military: "MILI",
  emigration: "EMIG", immigration: "IMMI", education: "EDUC", religion: "RELI", custom: "EVEN", confirmation: "CONF",
  firstCommunion: "FCOM", barMitzvah: "BARM", batMitzvah: "BASM", ordination: "ORDN", adoption: "ADOP", naturalization: "NATU",
  will: "WILL", probate: "PROB", title: "TITL", nationality: "NATI", cremation: "CREM", census: "CENS",
};

/** The Strom app's events of a couple (its 3.8) → GEDCOM tags. */
export const APP_COUPLE_EVENTS: Record<string, string> = {
  engagement: "ENGA", banns: "MARB", marriageLicence: "MARL", marriageContract: "MARC", marriageSettlement: "MARS",
  residence: "RESI", census: "CENS", divorceFiled: "DIVF", annulment: "ANUL", custom: "EVEN",
};

/** The GEDCOM tag of a type of event of the Strom app (a person's, a couple's, its marriage); none it has a tag for: undefined. */
export function appEventTag(type: unknown): string | undefined {
  if (typeof type !== "string") return undefined;
  if (type === "marriage") return "MARR";
  return Object.hasOwn(APP_EVENTS, type) ? APP_EVENTS[type] : Object.hasOwn(APP_COUPLE_EVENTS, type) ? APP_COUPLE_EVENTS[type] : undefined;
}

/** The app's types of a person's own event of a role at another's (spec 085 K2.2): our EVEN named in the research's language. */
const APP_ROLE_EVENTS: Record<string, PhraseKey> = { godparent: "event.godparent", weddingWitness: "event.weddingWitness" };

/**
 * A person's event of the Strom app's JSON as our kind (MILI an EVEN of its own) and, for an EVEN, its name: the
 * user's own, else the word of the type (a soldier's service; a godparent's own event in the research's language);
 * a type we have no kind of: undefined.
 */
export function appPersonEvent(e: { type: string; customLabel?: string }, lang: string): { kind: string; label?: string } | undefined {
  const own = e.customLabel?.replace(/\s+/gu, " ").trim();
  if (Object.hasOwn(APP_ROLE_EVENTS, e.type)) return { kind: "EVEN", label: own || phrase(lang, APP_ROLE_EVENTS[e.type]!) };
  const tag = Object.hasOwn(APP_EVENTS, e.type) ? APP_EVENTS[e.type]! : undefined;
  if (!tag) return undefined;
  if (tag === "MILI") return { kind: "EVEN", label: own || labels(lang)("MILI") };
  return tag === "EVEN" ? { kind: "EVEN", ...(own ? { label: own } : {}) } : { kind: tag };
}

/**
 * Who else was at an event of the Strom app's JSON: the role (the app's own; "other" with a note naming a role it has
 * none of — "porodní bába" — that role, the note kept), a person of its tree by the app's ID or a name, the note.
 */
export function appParticipants(list: unknown): { role: ParticipantRole; appPerson?: string; name?: string; note?: string }[] {
  const out: { role: ParticipantRole; appPerson?: string; name?: string; note?: string }[] = [];
  for (const x of Array.isArray(list) ? (list as StromParticipant[]) : []) {
    if (!x || typeof x !== "object") continue;
    const name = typeof x.name === "string" ? x.name.normalize("NFC").replace(/\s+/gu, " ").trim() : "";
    const id = typeof x.personId === "string" ? x.personId.trim() : "";
    if (!id && !name) continue;
    const { role, note } = participantRole(typeof x.role === "string" ? x.role : undefined, typeof x.note === "string" ? x.note : undefined, "other");
    out.push({ role, ...(id ? { appPerson: id } : {}), ...(name ? { name } : {}), ...(note ? { note } : {}) });
  }
  return out;
}

/**
 * The marks of an event of the Strom app's JSON (spec 085): its `shareId` (+ `shareRole`; a person's event only) and
 * its `roleAt` {role, personId | partnershipId, eventType} — whose by the app's own ID (`atPerson`, `atPartnership`),
 * resolved by the reader; the type a GEDCOM tag (one of the research's kinds, else none).
 */
export function appEventMarks(e: { shareId?: unknown; shareRole?: unknown; roleAt?: unknown }, person: boolean): EventMarks & { atPerson?: string; atPartnership?: string } {
  const out: EventMarks & { atPerson?: string; atPartnership?: string } = {};
  if (person && typeof e.shareId === "string") Object.assign(out, shareMark(e.shareId, typeof e.shareRole === "string" ? e.shareRole : undefined));
  const r = e.roleAt && typeof e.roleAt === "object" ? (e.roleAt as { role?: unknown; personId?: unknown; partnershipId?: unknown; eventType?: unknown }) : undefined;
  const mark = r ? roleAtMark(typeof r.role === "string" ? r.role : undefined, undefined, appEventTag(r.eventType)) : undefined;
  if (mark) {
    out.roleAt = mark;
    if (typeof r!.personId === "string" && r!.personId.trim()) out.atPerson = r!.personId.trim();
    else if (typeof r!.partnershipId === "string" && r!.partnershipId.trim()) out.atPartnership = r!.partnershipId.trim();
  }
  return out;
}

/** Is this parsed JSON a Strom app tree? */
export function isStromJson(data: unknown): data is { persons: Record<string, StromPerson>; partnerships: Record<string, StromPartnership> } {
  return !!data && typeof data === "object" && "persons" in data && "partnerships" in data;
}

/** Strom flexible date ("~1900", "<1900-05", "1900-05-03", a range "1785..1804", a period "1871/1882") → GEDCOM. */
export function fromFlexDate(flex: string | undefined): string | undefined {
  if (!flex) return undefined;
  // a period ("1871/1882", "1871/", "/1882"): from the one to the other, each side a plain date
  const period = /^([^/]*)\/([^/]*)$/.exec(flex.trim());
  if (period) {
    const plain = (s: string) => (/^\d{3,4}(?:-\d{1,2}(?:-\d{1,2})?)?$/.test(s) ? fromFlexDate(s) : undefined);
    const [a, b] = [period[1] ? plain(period[1]) : "", period[2] ? plain(period[2]) : ""];
    if (a === undefined || b === undefined || (!a && !b)) return undefined;
    return normalizeDate(a && b ? `FROM ${a} TO ${b}` : a ? `FROM ${a}` : `TO ${b}`);
  }
  // a range ("1785..1804"): between the two
  const range = /^(.+?)\.\.(.+)$/.exec(flex.trim());
  if (range) {
    const [a, b] = [fromFlexDate(range[1]), fromFlexDate(range[2])];
    return a && b && !/^(ABT|BEF|AFT|BET|FROM|TO) /.test(a) && !/^(ABT|BEF|AFT|BET|FROM|TO) /.test(b) ? normalizeDate(`BET ${a} AND ${b}`) : undefined;
  }
  const m = /^([~<>])?(\d{3,4})(?:-(\d{1,2}))?(?:-(\d{1,2}))?$/.exec(flex.trim());
  if (!m) return importDate(flex);
  const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
  const core = [m[4] ? String(Number(m[4])) : "", m[3] ? months[Number(m[3]) - 1] ?? "" : "", m[2]].filter(Boolean).join(" ");
  const q = m[1] === "~" ? "ABT " : m[1] === "<" ? "BEF " : m[1] === ">" ? "AFT " : "";
  return normalizeDate(q + core);
}

export function importStromJson(
  tree: Tree,
  data: { persons: Record<string, StromPerson>; partnerships: Record<string, StromPartnership>; research?: { id?: string } },
  opts: { input: string; name: string },
): ImportResult {
  const result: ImportResult = { source: "", persons: 0, families: 0, matched: 0, events: 0, extended: [], problems: [], candidates: [] };
  tree.withTreeLock(() => {
    const lang = tree.config.lang;
    const source = makeSource(tree, `${importLabel(lang)} ${opts.name} (Strom)`, opts.input);
    result.source = source.id;
    const idMap = new Map<string, string>();
    // a role at another's event: whose by the app's ID — a person or a partnership — once all are made
    const atLater: { event: string; owner: string; person?: string; partnership?: string }[] = [];
    // who else was at an event: a person of the app's tree by its ID, ours once all people are made
    const partsLater = new Map<Event, { role: ParticipantRole; appPerson?: string; name?: string; note?: string }[]>();
    const familyOf = new Map<string, string>();
    // the app's "?" stand-in is nobody (its GEDCOM leaves it out; strom sync reads no one of it)
    const all = Object.values(data.persons).filter((sp) => !appNobody(sp));
    const ourPeople = oursByRefn(tree, data.research?.id, all.map((sp) => ({ refn: sp.refn, names: [[sp.firstName, sp.lastName].filter(Boolean).join(" "), ...(sp.nameVariants ?? [])] })));
    /** A fact of the app's: the user's own family tree's values (spec 066), theirs to guard, nothing they confirmed. */
    const factOf = (owner: string, kind: string, e: StromEvent | undefined, date: string | undefined, place: string | undefined, family = false): Event => {
      const ev: Event = { id: tree.allocate("E"), kind, status: "lead", citations: [{ source: source.id, locator: `${owner} ${kind}` }], origin: { by: "user", tree: true } };
      const d = fromFlexDate(date);
      if (d) ev.date = d;
      const at = place?.replace(/\s+/gu, " ").trim();
      if (at) ev.place = at;
      const said: string[] = [];
      if (date && !d) said.push(`date as written: ${date}`);
      if (e) {
        // its cause, age and house as strom sync reads them (factDetails) — a person's age at any fact of theirs (a census
        // the app shares among a household too); a couple's: the partners' ages by the app's ids
        const { ageAsWritten, ...details } = factDetails(e.cause, family ? undefined : e.age, e.address);
        Object.assign(ev, details);
        if (ageAsWritten) said.push(`age as written: ${ageAsWritten}`);
        const ages = partnersAges(e.ages, (id) => idMap.get(id));
        if (ages) ev.ages = ages;
        // the event's note as the user wrote it, whole (an occupation's first line is what it is: its value)
        const text = (VALUE_TAGS.has(kind) ? (e.note ?? "").split("\n").slice(1).join("\n") : (e.note ?? "")).normalize("NFC").trim();
        if (text) said.push(text);
        const parts = appParticipants(e.participants);
        if (parts.length) partsLater.set(ev, parts);
      }
      if (said.length) ev.note = said.join("\n");
      result.events++;
      return ev;
    };
    const made: Person[] = [];
    for (const [i, sp] of all.entries()) {
      const ours = ourPeople[i];
      if (ours) {
        idMap.set(sp.id, ours.id);
        result.matched++;
        continue;
      }
      const events: Event[] = [];
      // the birth and the death with what the app keeps of them besides (its 3.7: the house, the cause, the age)
      const birth: StromEvent = { type: "birth", ...(sp.birthAddress ? { address: sp.birthAddress } : {}) };
      const death: StromEvent = { type: "death", ...(sp.deathCause ? { cause: sp.deathCause } : {}), ...(sp.deathAge ? { age: sp.deathAge } : {}), ...(sp.deathAddress ? { address: sp.deathAddress } : {}) };
      for (const [kind, date, place, e] of [["BIRT", sp.birthDate, sp.birthPlace, birth], ["DEAT", sp.deathDate, sp.deathPlace, death]] as const)
        if (fromFlexDate(date) || place?.trim() || e.cause?.trim() || e.age?.trim() || e.address?.trim()) events.push(factOf(sp.id, kind, e, date, place));
      // the person's other events (a census of the household, a move, a godparent's own event), with who else was
      // there and the marks of an event the app shares among people (spec 085); whose a role at another's was: once
      // all are made (atLater)
      for (const e of Array.isArray(sp.events) ? sp.events : []) {
        if (!e || typeof e !== "object" || typeof e.type !== "string") continue;
        const what = appPersonEvent(e, lang);
        if (!what || ((what.kind === "BIRT" || what.kind === "DEAT") && events.some((x) => x.kind === what.kind))) continue;
        // an occupation, a religion, a title: the app keeps what it is as the event's note (its first line)
        const value = VALUE_TAGS.has(what.kind) ? (e.note?.split("\n")[0] ?? "").replace(/\s+/gu, " ").trim() : "";
        if ((what.kind === "EVEN" && !what.label) || (VALUE_TAGS.has(what.kind) && !value)) continue;
        const ev = factOf(sp.id, what.kind, e, e.date, e.place);
        if (what.label) ev.label = what.label;
        if (value) ev.value = value;
        const marks = appEventMarks(e, true);
        if (marks.share) ev.share = marks.share;
        if (marks.unreadable) result.problems.push(`${sp.id} ${e.type}: the mark of a shared event "${marks.unreadable}" is no ID of one (1–64 letters and digits) — the fact taken without it`);
        if (marks.roleAt) {
          ev.roleAt = marks.roleAt;
          if (marks.atPerson || marks.atPartnership) atLater.push({ event: ev.id, owner: sp.id, ...(marks.atPerson ? { person: marks.atPerson } : { partnership: marks.atPartnership! }) });
        }
        events.push(ev);
      }
      const t = now();
      // the name after the marriage (spec 010) as its GEDCOM gives it: a name of the married kind after the birth one,
      // the one the user chose to show the person by marked (spec 024)
      const marriedAs = appMarriedName(sp);
      const married: Name | undefined = marriedAs ? { ...parseName(marriedAs), kind: "married", ...(sp.primaryName === "married" ? { primary: true as const } : {}), origin: { by: "user", tree: true } } : undefined;
      const p: Person = {
        id: tree.allocate("P"),
        type: "person",
        names: [
          {
            given: sp.firstName?.trim() || (sp.lastName ? "" : "?"),
            surname: sp.lastName?.trim() ?? "",
            ...(cleanTitle(sp.titleBefore) ? { prefix: cleanTitle(sp.titleBefore)! } : {}),
            ...(cleanTitle(sp.titleAfter) ? { suffix: cleanTitle(sp.titleAfter)! } : {}),
            ...(married && sp.primaryName === "birth" ? { primary: true as const } : {}),
            origin: { by: "user", tree: true },
          },
          ...(married ? [married] : []),
          ...(sp.nameVariants ?? []).map((v): Name => ({ ...parseName(v), origin: { by: "user", tree: true } })),
        ],
        sex: sp.gender === "male" ? "M" : sp.gender === "female" ? "F" : "U",
        ...(sp.gender === "male" || sp.gender === "female" ? { sexOrigin: { by: "user" as const, tree: true as const } } : {}),
        events,
        notes: sp.notes?.trim() ? [note(tree, sp.notes)] : [],
        refs: [{ system: "strom-app", id: sp.id }, ...(sp.refn ? [{ system: "refn", id: sp.refn }] : [])],
        created: t,
        updated: t,
      };
      made.push(p);
      idMap.set(sp.id, p.id);
      result.persons++;
    }
    /** Who else was at the event: a person of the app's tree ours (one the file does not have: by their name, else nobody). */
    const participants = (ev: Event): void => {
      const list = partsLater.get(ev);
      if (!list) return;
      const out: Participant[] = [];
      for (const x of list) {
        const person = x.appPerson ? idMap.get(x.appPerson) : undefined;
        if (!person && !x.name) continue;
        out.push({ role: x.role, ...(person ? { person } : { name: x.name! }), ...(x.note ? { note: x.note } : {}) });
      }
      if (out.length) ev.participants = out;
    };
    for (const p of made) {
      for (const ev of p.events) participants(ev);
      tree.put(p, { op: "person.import", targets: [p.id], summary: `+${p.id} ${p.names[0]!.given} /${p.names[0]!.surname}/ (lead)` });
    }
    const known = (id: string) => idMap.has(id);
    // each child's tie to each parent (the app keeps it on the child: parentRelTypes), as its GEDCOM gives it (PEDI for
    // both, _FREL/_MREL each) — a word the research has none for said, the child a child by birth to that parent
    const ties = (appChild: string, child: string, parents: (string | undefined)[]): ChildLink => {
      const by: Record<string, ChildRelation> = {};
      const rels = data.persons[appChild]?.parentRelTypes;
      for (const parent of parents) {
        const ours = parent ? idMap.get(parent) : undefined;
        if (!parent || !ours) continue;
        const word = rels && typeof rels === "object" && typeof rels[parent] === "string" ? rels[parent] : undefined;
        const rel = childRelation(word);
        if (word?.trim() && !rel) result.problems.push(`${appChild}: the tie to the parent ${parent} "${word}" is no relation the research knows (birth, adopted, step, foster) — taken as birth`);
        by[ours] = rel ?? "birth";
      }
      return childLink(child, by, appBothTie(Object.values(by)));
    };
    /**
     * A family of these partners the research has (one of this intake's too: the "?" stand-in's family and the one
     * parent's other children are one family, as its GEDCOM's two read): gets the children it lacks; else undefined.
     */
    const joined = (partners: string[], kids: ChildLink[]): Family | undefined => {
      const exists = tree.list<Family>("family").find((f) => !f.retracted && !f.mergedInto && partners.length > 0 && partners.every((p) => f.partners.includes(p)) && f.partners.length === partners.length);
      if (!exists) return undefined;
      const fresh = kids.filter((k) => !exists.children.some((c) => c.person === k.person));
      if (fresh.length) tree.put({ ...exists, children: [...exists.children, ...fresh], updated: now() }, { op: "family.import", targets: [exists.id, ...fresh.map((k) => k.person)], summary: `${exists.id} + ${fresh.map((k) => `child ${k.person}`).join(", ")} (lead)` });
      return exists;
    };
    for (const sp of Object.values(data.partnerships)) {
      const partners = [sp.person1Id, sp.person2Id].map((x) => (x ? idMap.get(x) : undefined)).filter((x): x is string => !!x);
      const appKids = (sp.childIds ?? []).filter((c) => idMap.has(c));
      if (partners.length + appKids.length === 0) continue;
      const kids = appKids.map((c) => ties(c, idMap.get(c)!, [sp.person1Id, sp.person2Id]));
      const exists = joined(partners, kids);
      if (exists) {
        familyOf.set(sp.id, exists.id);
        continue;
      }
      const t = now();
      const events: Event[] = [];
      // the wedding and the divorce as the app's GEDCOM writes them (appUnionFacts: a couple married with nothing more
      // known of it a bare one), the wedding with its witnesses, its house and the partners' ages
      const union = appUnionFacts(sp, known);
      const wedding: StromEvent = {
        type: "marriage",
        ...(Array.isArray(sp.participants) ? { participants: sp.participants } : {}),
        ...(sp.address ? { address: sp.address } : {}),
        ...(sp.ages && typeof sp.ages === "object" ? { ages: sp.ages } : {}),
      };
      if (union.marriage) events.push(factOf(sp.id, "MARR", wedding, sp.startDate, sp.startPlace, true));
      // the couple's other events (an engagement, banns, a census of the two …)
      for (const e of Array.isArray(sp.events) ? sp.events : []) {
        if (!e || typeof e !== "object" || typeof e.type !== "string" || !Object.hasOwn(APP_COUPLE_EVENTS, e.type)) continue;
        const kind = APP_COUPLE_EVENTS[e.type]!;
        const label = kind === "EVEN" ? e.customLabel?.replace(/\s+/gu, " ").trim() : undefined;
        if (kind === "EVEN" && !label) continue;
        const ev = factOf(sp.id, kind, e, e.date, e.place, true);
        if (label) ev.label = label;
        events.push(ev);
      }
      // the divorce (the app's 3.7 keeps its place too; a couple separated: when they parted), as strom sync reads it
      if (union.divorce) events.push(factOf(sp.id, "DIV", undefined, sp.endDate, sp.endPlace, true));
      for (const ev of events) participants(ev);
      const f: Family = {
        id: tree.allocate("F"),
        type: "family",
        partners,
        children: kids,
        events,
        // the couple's one note (its GEDCOM: 1 NOTE under FAM), whole
        notes: typeof sp.note === "string" && sp.note.trim() ? [note(tree, sp.note)] : [],
        refs: [{ system: "strom-app", id: sp.id }],
        created: t,
        updated: t,
      };
      tree.put(f, { op: "family.import", targets: [f.id, ...partners, ...kids.map((k) => k.person)], summary: `+${f.id} family (lead)` });
      familyOf.set(sp.id, f.id);
      result.families++;
    }
    // a child of parents no partnership holds (the app's parentIds; its GEDCOM: a family of their own): a family of
    // those parents, as strom sync reads it
    for (const loose of appLooseFamilies(data, known)) {
      const partners = loose.parents.map((x) => idMap.get(x)!);
      const kids = loose.children.map((c) => ties(c, idMap.get(c)!, loose.parents));
      if (joined(partners, kids)) continue;
      const t = now();
      const f: Family = { id: tree.allocate("F"), type: "family", partners, children: kids, events: [], notes: [], created: t, updated: t };
      tree.put(f, { op: "family.import", targets: [f.id, ...partners, ...kids.map((k) => k.person)], summary: `+${f.id} family (lead)` });
      result.families++;
    }
    // a role at another's event: whose, now that all are made (one the import made nothing of: the role alone)
    for (const later of atLater) {
      const at = later.person ? idMap.get(later.person) : familyOf.get(later.partnership!);
      const owner = idMap.get(later.owner);
      const rec = at && owner ? tree.get<Person>(owner) : undefined;
      const ev = rec?.events.find((e) => e.id === later.event);
      if (!rec || !ev?.roleAt) continue;
      tree.put({ ...rec, events: rec.events.map((e) => (e === ev ? { ...e, roleAt: { ...ev.roleAt!, at: at! } } : e)) }, { op: "person.import", targets: [rec.id, at!], summary: `${rec.id} ${ev.kind}: a role at ${at}` });
    }
  });
  return result;
}

/** The kinds of facts that are their value (an occupation, a religion): the Strom app keeps it as the event's note. */
const VALUE_TAGS = new Set(["OCCU", "RELI", "TITL", "NATI"]);

/** "čp. 13", "č. p. 13", "Nr. 13", "House No. 13" → "13": the house, without the word for it. */
export function houseOf(address: string): string {
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

// ── what a fact says besides, a child's ties: one reading for strom intake (GEDCOM, JSON) and strom sync ──────────────

/** What a fact says besides its date and place, in the research's form (`ageAsWritten`: an age it cannot read). */
export interface FactDetails {
  cause?: string;
  age?: string;
  house?: string;
  ageAsWritten?: string;
}

/**
 * A fact's cause, age and address as a file gives them (a GEDCOM's CAUS, AGE, ADDR; the Strom app's JSON's cause, age,
 * address, deathCause …): the cause on one line, the age read, the house without the word for it.
 */
export function factDetails(cause: string | undefined, age: string | undefined, address: string | undefined): FactDetails {
  const out: FactDetails = {};
  const c = cause?.replace(/\s+/gu, " ").trim();
  if (c) out.cause = c;
  const raw = age?.trim();
  const a = raw ? normalizeAge(raw) : undefined;
  if (a) out.age = a;
  else if (raw) out.ageAsWritten = raw;
  const h = address?.trim() ? houseOf(address) : "";
  if (h) out.house = h;
  return out;
}

/** The partners' ages at a couple's fact (the Strom app's `ages`: its person id → age) by whose they are to the reader (`whose`: the app's id → its key); none read: undefined. */
export function partnersAges(ages: unknown, whose: (appId: string) => string | undefined): Record<string, string> | undefined {
  const out: Record<string, string> = {};
  for (const [id, raw] of Object.entries(ages && typeof ages === "object" ? (ages as Record<string, unknown>) : {})) {
    const key = whose(id);
    const a = key && typeof raw === "string" && raw.trim() ? normalizeAge(raw) : undefined;
    if (key && a) out[key] = a;
  }
  return Object.keys(out).length ? out : undefined;
}

/** A child's tie to a parent in the research's words (_FREL/_MREL, PEDI, the app's parentRelTypes); a word it has none for: undefined. */
export function childRelation(said: string | undefined): ChildRelation | undefined {
  switch ((said ?? "").trim().toLowerCase()) {
    case "natural": case "birth": case "biological":
      return "birth";
    case "adopted": case "adoptive":
      return "adopted";
    case "step":
      return "step";
    case "foster":
      return "foster";
    case "unknown":
      return "unknown";
    default:
      return undefined;
  }
}

/** The tie the Strom app writes for both parents (its PEDI) of a child's ties to each: adopted by one, foster by one, else birth. */
export function appBothTie(ties: ChildRelation[]): ChildRelation {
  return ties.includes("adopted") ? "adopted" : ties.includes("foster") ? "foster" : "birth";
}

/**
 * A child of a family from its tie to each parent (`by`: every parent of the family, the tie for both where the file
 * says nothing of one) and the tie for both (PEDI; none: birth): one tie to all its parents is the relation, else the
 * relation for both and each parent's other tie (relations) — a GEDCOM (PEDI, _FREL/_MREL) and the Strom app's JSON
 * (parentRelTypes) of the same tree alike.
 */
export function childLink(person: string, by: Record<string, ChildRelation>, both: ChildRelation): ChildLink {
  const all = [...new Set(Object.values(by))];
  if (all.length === 1) return { person, relation: all[0]! };
  const relations = Object.fromEntries(Object.entries(by).filter(([, r]) => r !== both));
  return { person, relation: both, ...(Object.keys(relations).length ? { relations } : {}) };
}

// ── the Strom app's JSON as its GEDCOM gives it: one reading for strom intake and strom sync ────────────────────────────

/** A person of the Strom app's JSON who is nobody: no ID, or its "?" stand-in (an unknown parent drawn in the tree) — its GEDCOM leaves the stand-in out. */
export function appNobody(p: { id?: unknown; isPlaceholder?: unknown } | undefined): boolean {
  return !p || typeof p.id !== "string" || !p.id || !!p.isPlaceholder;
}

/**
 * The name after the marriage of a person of the Strom app's JSON (spec 010: `marriedSurname`) as GEDCOM writes a name
 * ("Marie /Lhotová/"): with its own given names (`marriedFirstName`, the app's 3.26) or the person's first name — as
 * its GEDCOM gives it (1 NAME … 2 TYPE married); none: undefined.
 */
export function appMarriedName(p: { firstName?: unknown; marriedSurname?: unknown; marriedFirstName?: unknown }): string | undefined {
  const surname = typeof p.marriedSurname === "string" ? p.marriedSurname.replace(/[/\s]+/gu, " ").trim() : "";
  if (!surname) return undefined;
  const own = typeof p.marriedFirstName === "string" ? p.marriedFirstName.replace(/[/\s]+/gu, " ").trim() : "";
  const first = own || (typeof p.firstName === "string" ? p.firstName : "");
  return `${first} /${surname}/`.trim();
}

/** A partnership of the Strom app's JSON as its exporter weighs it for MARR and DIV (appUnionFacts). */
export interface AppUnion {
  person1Id?: string;
  person2Id?: string;
  childIds?: string[];
  status?: string;
  startDate?: string;
  startPlace?: string;
  endDate?: string;
  endPlace?: string;
  address?: string;
  ages?: Record<string, string>;
  participants?: unknown[];
  marriageUnrecorded?: boolean;
  startStatus?: string;
}

/**
 * What the Strom app's GEDCOM writes of a partnership of its JSON (its exporter): a wedding (MARR, bare when nothing
 * more is known of it) for a couple married or divorced — not the one of a "?" stand-in and one child (that child's one
 * known parent), nor one whose file wrote none (marriageUnrecorded) unless its witnesses or its status say one — and for
 * any couple with the wedding's date, place, house or a partner's age; a divorce (DIV, bare likewise) for a couple
 * divorced and for any with an end's date or place (separated: when they parted). `known`: a partner the reader has
 * (the stand-in is nobody, appNobody).
 */
export function appUnionFacts(u: AppUnion, known: (appId: string) => boolean): { marriage: boolean; divorce: boolean } {
  const has = (v: unknown) => typeof v === "string" && v.trim() !== "";
  const standIn = (!u.person1Id || !known(u.person1Id) || !u.person2Id || !known(u.person2Id)) && (u.childIds ?? []).length === 1;
  const witnesses = Array.isArray(u.participants) && u.participants.length > 0;
  const unrecorded = u.marriageUnrecorded === true && !witnesses && !has(u.startStatus);
  const ages = [u.person1Id, u.person2Id].some((id) => !!id && !!u.ages && typeof u.ages === "object" && has(u.ages[id]));
  const marriage = ((u.status === "married" || u.status === "divorced") && !standIn && !unrecorded) || has(u.startDate) || has(u.startPlace) || has(u.address) || ages;
  const divorce = u.status === "divorced" || has(u.endDate) || has(u.endPlace);
  return { marriage, divorce };
}

/**
 * The Strom app's children of parents no partnership of theirs holds (a child's `parentIds` beyond its couples — its
 * GEDCOM: a family of their own, _STROM_NO_COUPLE): one family per set of those parents, of the people `known`.
 */
export function appLooseFamilies(
  data: { persons?: Record<string, { id?: string; parentIds?: unknown } | undefined>; partnerships?: Record<string, { person1Id?: string; person2Id?: string; childIds?: string[] } | undefined> },
  known: (appId: string) => boolean,
): { parents: string[]; children: string[] }[] {
  const held = new Set(Object.values(data.partnerships ?? {}).flatMap((u) => (u?.childIds ?? []).flatMap((c) => [u!.person1Id, u!.person2Id].filter(Boolean).map((p) => `${p}|${c}`))));
  const out = new Map<string, { parents: string[]; children: string[] }>();
  for (const p of Object.values(data.persons ?? {})) {
    if (!p?.id || !known(p.id) || !Array.isArray(p.parentIds)) continue;
    const parents = [...new Set((p.parentIds as unknown[]).filter((x): x is string => typeof x === "string" && !held.has(`${x}|${p.id}`) && known(x)))];
    if (!parents.length) continue;
    const key = [...parents].sort().join("|");
    const f = out.get(key) ?? out.set(key, { parents, children: [] }).get(key)!;
    f.children.push(p.id);
  }
  return [...out.values()];
}
