// A religion as a record writes it (the column of a register, "katol.", "evang. a. v.", "israel.", "kath.", "cath."):
// found in a text only in its clear forms, each one a faith (`key`) — so that two writings of one faith are one fact
// (strom event add P… RELI cites the fact already there), and the brief can say that a record of the person's own
// names a religion the research has no fact of. Nothing is guessed: a word that only begins like a faith ("Katharina",
// "Evangelista", "Israel" without its full stop) is no religion, nor is a faith that names a parish, a church, a
// rite, a street or a register ("římskokatolická farnost", "katolický křest", "Židovská ulice") — what a record says
// of the place or of the book is never the person's religion.
//
// Words are compared folded (foldText: no accents, lower case), word by word (any script: \p{L}\p{M}\p{N}), so that
// the form found is given back as the record writes it. The forms are Czech, German, Latin and Polish, with a few
// Cyrillic ones; a form not in the list finds nothing — the agent still records what the record says.

import { foldText } from "./text.ts";
import { dateYears } from "./gdate.ts";
import type { Citation, Event, Person, Source } from "./model.ts";
import { familiesAsPartner } from "./people.ts";
import type { Tree } from "./tree.ts";

/** One faith, whatever the language or the abbreviation of the record. */
export type ReligionKey =
  | "catholic"
  | "greek-catholic"
  | "old-catholic"
  | "evangelical-ac"
  | "evangelical-hc"
  | "evangelical"
  | "protestant"
  | "non-catholic"
  | "jewish"
  | "orthodox"
  | "czechoslovak"
  | "none";

/** A religion found in a text: its faith and the words as the text writes them. */
export interface ReligionFound {
  key: ReligionKey;
  /** The words as written (NFC), with the full stop of an abbreviation. */
  text: string;
  /**
   * Whose it is where the text says so: a groom's or a bride's (a marriage's column of either), another person's (the
   * father's, the mother's, a godparent's — "Otec: … katol.", "náboženství otce: katol.", a column "Otec"); none: the
   * text names nobody else for it.
   */
  of?: "groom" | "bride" | "other";
}

interface Token {
  /** folded */
  w: string;
  /** as written, in lower case */
  r: string;
  start: number;
  end: number;
  /** a full stop right after it */
  dot: boolean;
  /** written with a capital letter */
  cap: boolean;
  /** The part of the text it is in: parts are parted by a line, a column ("|", a tab) or a semicolon. */
  seg: number;
  /** Its line and its column there ("|" or a tab before it), for the header of a table. */
  line: number;
  col: number;
}

/** A test of one word. */
type Test = (t: Token) => boolean;

const is = (...words: string[]): Test => (t) => words.includes(t.w);
/** The word as an abbreviation: only with its full stop ("israel." — "Israel" is a given name too). */
const abbr = (...words: string[]): Test => (t) => t.dot && words.includes(t.w);
const starts = (...stems: string[]): Test => (t) => stems.some((s) => t.w.startsWith(s));
const any = (...tests: Test[]): Test => (t) => tests.some((x) => x(t));

/** A word that says catholic in a pair ("řím. kat.", "gr.-kath.") — never one that only begins so ("Katharina"). */
const CATH = any(is("kat", "kath", "cath", "katol"), starts("katolick", "kathol", "catholic", "katolic", "католич", "католиц"));
/** A word that says evangelical before its confession ("ev. a. v.", "evang. H. B."). */
const EV = any(is("ev", "evang", "ewang"), starts("evangelick", "evangelisch", "evangelic", "ewangelick", "евангелич"));

/**
 * The forms of each faith; a longer one first (it is taken whole: "gr.-kath." is no "kath."). `name`: the form is a
 * name too, or a name's abbreviation — "Kath." a Katharina, "Israel." a given name, "Mos." a Moses, "Jud." a Judith,
 * "Žid" a surname, "Orth." a surname — so it is a religion only under a label of one ("Náboženství: žid.", "Religion:
 * kath.", a column headed so), never by itself.
 */
const RULES: { key: ReligionKey; seq: Test[]; name?: boolean }[] = [
  // the confession of an evangelical
  { key: "evangelical-ac", seq: [EV, is("a"), is("v", "b", "c")] },
  { key: "evangelical-hc", seq: [EV, is("h"), is("v", "b", "c")] },
  { key: "evangelical-ac", seq: [EV, starts("augsb", "aug")] },
  { key: "evangelical-hc", seq: [EV, starts("helv")] },
  { key: "czechoslovak", seq: [starts("cirk"), starts("ceskoslovensk")] },
  { key: "czechoslovak", seq: [any(is("cs", "csl"), starts("ceskoslovensk")), starts("husit")] },
  { key: "none", seq: [is("bez"), starts("vyznan", "nabozenstv", "wyznani")] },
  { key: "greek-catholic", seq: [any(is("gr", "rec", "recko", "greko", "graeco", "греко"), starts("griechisch")), CATH] },
  { key: "old-catholic", seq: [is("alt", "staro"), CATH] },
  { key: "catholic", seq: [any(is("rim", "rimsko", "rom", "rz", "rzym", "r"), starts("romisch", "romano", "rzymsko")), CATH] },
  { key: "greek-catholic", seq: [starts("reckokat", "griechischkath", "grekokat", "greckokat")] },
  { key: "old-catholic", seq: [starts("starokat", "altkath")] },
  { key: "catholic", seq: [starts("rimskokat", "romischkath", "rzymskokat")] },
  { key: "non-catholic", seq: [starts("akatol", "akathol", "acathol")] },
  { key: "catholic", seq: [is("kath", "cath")], name: true },
  { key: "catholic", seq: [any(is("katol"), starts("katolick", "katolik", "kathol", "catholic", "katolic", "католич", "католик"))] },
  { key: "evangelical-ac", seq: [starts("lutherisch", "lutheran", "luteransk", "luteran", "лютеран")] },
  { key: "evangelical-hc", seq: [starts("helvetsk", "helvetisch", "reformovan", "reformiert", "reformowan")] },
  { key: "evangelical", seq: [any(is("evang", "ewang"), starts("evangelick", "evangelisch", "evangelic", "ewangelick", "евангелич"))] },
  { key: "protestant", seq: [starts("protestant")] },
  // "jüd." with its umlaut is no Judith ("Jud.")
  { key: "jewish", seq: [(t) => t.dot && t.r === "jüd"] },
  // a name too: "Israel.", "Isr.", "Jud.", "Mos.", "Žid", "Żyd", "Hebr." (the language as well)
  { key: "jewish", seq: [any(abbr("israel", "isr", "izr", "jud", "mos", "zid", "zyd", "hebr"), is("zid", "zide", "zidovka", "zyd"))], name: true },
  {
    key: "jewish",
    seq: [starts("israelit", "izraelit", "izraelsk", "zidovsk", "judisch", "judae", "judaic", "mosaisch", "mojzissk", "mojzeszow", "zydowsk", "hebrae", "иуде", "еврейск")],
  },
  { key: "orthodox", seq: [abbr("orth")], name: true },
  { key: "orthodox", seq: [any(abbr("pravosl"), starts("pravoslav", "orthodox", "prawoslaw", "православ"))] },
  { key: "none", seq: [starts("konfessionslos", "konfesslos", "bezkonfes", "religionslos", "bezwyznan")] },
];

/**
 * The words near a faith (up to three on either side, within its part of the text) that make it the faith of something
 * else than the person: a parish, a church, a congregation, a register, a rite, a sacrament, a clergyman, a street, a
 * town, a school, a cemetery. A German compound counts with them inside ("Pfarrkirche").
 */
const NOT_THE_PERSON = [
  "far", "pfarr", "kirch", "church", "parish", "paroch", "eccles", "kostel", "chram", "cirk", "gemeind", "obec", "sbor",
  "kongreg", "congreg", "kultus", "kultusgem", "obcin", "synagog", "matrik", "matrik", "regist", "buch", "kniha", "liber", "obrad", "ritu", "rit", "zpusob",
  "krest", "krt", "tauf", "baptis", "oddav", "snatk", "snatek", "trau", "pohreb", "begrab", "sepult", "kaplan", "knez",
  "duchovn", "sacerdo", "pastor", "rabin", "rabbi", "ulic", "gass", "strass", "mest", "stadt", "skol", "schul", "hrbitov",
  "friedhof", "coemet", "cemet", "parafi", "kosciol", "obrzad", "приход", "церк", "храм",
];
const NOT_THE_PERSON_INSIDE = ["pfarr", "kirch", "schul", "gemeind", "friedhof", "kapell"];
const aside = (t: Token) => NOT_THE_PERSON.some((s) => t.w.startsWith(s)) || NOT_THE_PERSON_INSIDE.some((s) => t.w.includes(s));
/** How far from a faith a parish or a place still makes it theirs (a word or two between: "Pfarre Lhota, kath."). */
const ASIDE_REACH = 3;

/** The words that head a religion (a column, a label): a capital there is no name. */
const LABEL = ["religion", "religio", "nabozenstvi", "nabozenstvo", "vyznani", "konfession", "confessio", "wyznanie", "вероисповед"];
const LABEL_ABBR = ["nab", "rel", "relig", "vyzn", "konf", "conf", "wyzn"];
const isLabel = (t: Token) => LABEL.some((l) => t.w.startsWith(l)) || (t.dot && LABEL_ABBR.includes(t.w));

/**
 * The words that name another person than the one a record is of — whose a religion after them is: a father, a
 * mother, a godparent, a witness, a midwife, a son or daughter "of", a spouse, a widow "of", the parents; a groom's and
 * a bride's apart (a marriage is both partners' record). Folded, whole words.
 */
const GROOM = new Set(["zenich", "zenicha", "zenichovo", "brautigam", "brautigams", "sponsus", "sponsi", "nowozeniec", "жених", "жениха"]);
const BRIDE = new Set(["nevesta", "nevesty", "nevestino", "braut", "sponsa", "sponsae", "nowozencza", "невеста", "невесты"]);
const OTHER = new Set([
  "otec", "otce", "otci", "otcem", "otcova", "otcovo", "matka", "matky", "matce", "matkou", "matcino", "syn", "syna", "synem",
  "dcera", "dcery", "dceri", "dcerou", "kmotr", "kmotra", "kmotry", "kmotri", "kmotrem", "baba", "porodni", "svedek", "svedci",
  "svedka", "svedkove", "manzel", "manzela", "manzelka", "manzelky", "manzelem", "chot", "vdova", "vdovy", "vdovec", "vdovce",
  "rodice", "rodicu", "deda", "dedecek", "babicka", "vater", "vaters", "mutter", "sohn", "tochter", "pate", "paten", "patin",
  "taufpate", "taufpatin", "zeuge", "zeugen", "hebamme", "gattin", "gatte", "ehefrau", "ehemann", "witwe", "witwer", "eltern",
  "pater", "patris", "mater", "matris", "patrinus", "patrina", "matrina", "testis", "testes", "obstetrix", "filius", "filia",
  "filii", "filiae", "uxor", "uxoris", "maritus", "mariti", "vidua", "viduus", "parentes", "parentum", "ojciec", "ojca",
  "matki", "chrzestny", "chrzestna", "corka", "syn", "zona", "zony", "maz", "meza", "wdowa", "wdowiec", "rodzice",
  "swiadek", "swiadkowie", "akuszerka", "отец", "отца", "мать", "матери", "сын", "дочь", "вдова", "крестный", "крестная",
]);
function roleOf(t: Token): ReligionFound["of"] {
  if (GROOM.has(t.w)) return "groom";
  if (BRIDE.has(t.w)) return "bride";
  return OTHER.has(t.w) ? "other" : undefined;
}

/**
 * Words that say a reading is not sure, before or after a faith ("katol. (?)", "katol? nečitelné", "snad katol.",
 * "wohl kath.", "unsicher"): the faith is then no religion — what is not read for sure is never written.
 */
const UNSURE = [
  "nejist", "necitel", "nejasn", "nezretel", "nezrozumitel", "snad", "nejspis", "pravdepodob", "mozna", "patrne",
  "unsicher", "unleserl", "fraglich", "zweifel", "undeutl", "wohl", "vielleicht", "vermutl", "wahrscheinl",
  "incert", "illegib", "dubi", "fortasse", "forsan", "probabil", "uncertain", "unclear", "unread", "maybe", "perhaps",
  "possibl", "probabl", "niepewn", "nieczyteln", "niewyrazn", "prawdopodob", "chyba", "неразбор", "неясн", "возможно", "вероятно",
];
const unsure = (t: Token) => t.w === "asi" || UNSURE.some((u) => t.w.startsWith(u));
/** What parts the text: a line, a column of a table, a tab, a semicolon. */
const PART = /[\n\r|\t;]/u;

/**
 * A word that is also a name ("Kath. Lhoták", "Kohn Israel."): written with a capital beside another capital word
 * that is no label of a religion.
 */
function nameLike(ts: Token[], i: number): boolean {
  if (!ts[i]!.cap) return false;
  const beside = [ts[i - 1], ts[i + 1]].filter((t): t is Token => !!t && t.seg === ts[i]!.seg && t.cap && !/^\p{N}/u.test(t.w));
  return beside.some((t) => !isLabel(t));
}

/**
 * A faith written as part of a proper name — a place's, a church's ("Katholisch Lhotendorf", "Evangelisch-Lutherische
 * Kirche", "Jan Židovský"): a capital word right beside it, nothing but spaces or a hyphen between, that is no label.
 */
function inProperName(s: string, ts: Token[], i: number, j: number): boolean {
  const close = (a: Token, b: Token) => a.seg === b.seg && /^[\s\-‐‑]+$/u.test(s.slice(a.end, b.start)) && !a.dot;
  const before = ts[i - 1];
  const after = ts[j + 1];
  if (before && ts[i]!.cap && before.cap && close(before, ts[i]!) && !isLabel(before) && !/^\p{N}/u.test(before.w)) return true;
  return !!after && after.cap && close(ts[j]!, after) && !isLabel(after) && !/^\p{N}/u.test(after.w);
}

function tokens(text: string): Token[] {
  const out: Token[] = [];
  let seg = 0;
  let line = 0;
  let col = 0;
  let from = 0;
  for (const m of text.matchAll(/[\p{L}\p{M}\p{N}]+/gu)) {
    const start = m.index;
    const end = start + m[0].length;
    const gap = text.slice(from, start);
    if (PART.test(gap)) seg++;
    for (const ch of gap) {
      if (ch === "\n") {
        line++;
        col = 0;
      } else if (ch === "|" || ch === "\t") col++;
    }
    out.push({ w: foldText(m[0]), r: m[0].toLowerCase(), start, end, dot: text[end] === ".", cap: /^\p{Lu}/u.test(m[0]), seg, line, col });
    from = end;
  }
  return out;
}

/**
 * Whose the faith at ts[i] is, and whether a label of a religion heads it — read back in its part of the text: the
 * nearest word that names another person ("Otec: Josef, katol.", "náboženství otce: katol."), else a label ("Náboženství:
 * katol."); a label in the middle of a sentence after a person named ("syn Josefa, náboženství katol.") is that
 * person's. Where its part says neither, a table's header above its column does ("| Náboženství |", "| Otec |").
 */
function whose(s: string, ts: Token[], i: number): { labeled: boolean; of?: ReligionFound["of"] } {
  // a label up to three words before, with whose between ("Religion des Vaters: kath.")
  let labeled = false;
  for (let k = i - 1; k >= i - 3 && k >= 0 && ts[k]!.seg === ts[i]!.seg; k--) if (isLabel(ts[k]!)) labeled = true;
  for (let k = i - 1; k >= 0 && ts[k]!.seg === ts[i]!.seg; k--) {
    const t = ts[k]!;
    const role = roleOf(t);
    if (role) return { labeled, of: role };
    if (isLabel(t)) {
      // a label heading a field — first in its part, or with a capital after a full stop, comma or colon — is the record's own
      const prev = ts[k - 1];
      if (!prev || prev.seg !== t.seg || (t.cap && /[.,:]/u.test(s.slice(prev.end, t.start)))) return { labeled };
    }
  }
  if (labeled) return { labeled };
  const head = headerCell(s, ts, i);
  if (!head.length) return { labeled: false };
  const role = head.map(roleOf).find(Boolean);
  if (role) return { labeled: head.some(isLabel), of: role };
  return { labeled: head.some(isLabel) };
}

/** The words of a table's header above the column of ts[i] (the first of the lines of "|" or tabs it is in). */
function headerCell(s: string, ts: Token[], i: number): Token[] {
  const lines = s.split("\n");
  const at = ts[i]!.line;
  if (!/[|\t]/u.test(lines[at] ?? "")) return [];
  let top = at;
  while (top > 0 && /[|\t]/u.test(lines[top - 1] ?? "")) top--;
  if (top === at) return [];
  return ts.filter((t) => t.line === top && t.col === ts[i]!.col);
}

/** A reading not sure: a "?" right beside the faith, or a word saying so up to two words off, within its part. */
function notSure(s: string, ts: Token[], i: number, j: number): boolean {
  const gapBefore = s.slice(ts[i - 1] && ts[i - 1]!.seg === ts[i]!.seg ? ts[i - 1]!.end : 0, ts[i]!.start).split(PART).pop()!;
  const gapAfter = s.slice(ts[j]!.end, ts[j + 1] && ts[j + 1]!.seg === ts[j]!.seg ? ts[j + 1]!.start : s.length).split(PART)[0]!;
  if (gapBefore.includes("?") || gapAfter.includes("?")) return true;
  for (let k = i - 1; k >= i - 2 && k >= 0 && ts[k]!.seg === ts[i]!.seg && !isLabel(ts[k]!); k--) if (unsure(ts[k]!)) return true;
  for (let k = j + 1; k <= j + 2 && k < ts.length && ts[k]!.seg === ts[j]!.seg; k++) if (unsure(ts[k]!)) return true;
  return false;
}

/** A parish, a church, a rite, a register or a place near the faith, within its part — up to a label of a religion. */
function nearAside(ts: Token[], i: number, j: number): boolean {
  for (let k = i - 1; k >= i - ASIDE_REACH && k >= 0 && ts[k]!.seg === ts[i]!.seg && !isLabel(ts[k]!); k--) if (aside(ts[k]!)) return true;
  for (let k = j + 1; k <= j + ASIDE_REACH && k < ts.length && ts[k]!.seg === ts[j]!.seg && !isLabel(ts[k]!); k++) if (aside(ts[k]!)) return true;
  return false;
}

/**
 * The religions a text names in their clear forms, in the order written, each as the text writes it, with whose it is
 * where the text says so. None of a faith that names a parish, a church, a rite, a register or a place (also a word
 * or two off), none written as a proper name, none not read for sure ("?", "nejisté", "unsicher"), and a form that is
 * a name too ("Žid", "Mos.", "Kath.") only under a label of a religion. `value`: the text is a religion's value itself
 * (a RELI fact's) — its own label.
 */
export function religionsIn(text: string | undefined, opts: { value?: boolean } = {}): ReligionFound[] {
  if (!text) return [];
  const s = text.normalize("NFC");
  const ts = tokens(s);
  const out: ReligionFound[] = [];
  for (let i = 0; i < ts.length; ) {
    const hit = RULES.find((r) => r.seq.every((test, j) => !!ts[i + j] && test(ts[i + j]!) && (j === 0 || joined(s, ts[i + j - 1]!, ts[i + j]!))));
    if (!hit) {
      i++;
      continue;
    }
    const j = i + hit.seq.length - 1;
    const last = ts[j]!;
    const who = opts.value ? { labeled: true } : whose(s, ts, i);
    const ok =
      !nearAside(ts, i, j) &&
      !notSure(s, ts, i, j) &&
      (opts.value || !inProperName(s, ts, i, j)) &&
      !(hit.name && (!who.labeled || nameLike(ts, i)));
    if (ok) out.push({ key: hit.key, text: s.slice(ts[i]!.start, last.end + (last.dot ? 1 : 0)), ...(who.of ? { of: who.of } : {}) });
    i += hit.seq.length;
  }
  return out;
}

/** Two words of one form: nothing between them but a full stop, a hyphen and spaces ("řím.-kat.", "a. v."). */
function joined(s: string, a: Token, b: Token): boolean {
  return /^[.\-‐‑–\s]{0,4}$/u.test(s.slice(a.end, b.start)) && !/\n/u.test(s.slice(a.end, b.start));
}

/** The faith a value says (a RELI fact's value), when it says one clearly: "katolické", "řím.-kat." — catholic. */
export function religionKey(value: string | undefined): ReligionKey | undefined {
  const found = religionsIn(value, { value: true });
  const keys = new Set(found.map((f) => f.key));
  return keys.size === 1 ? found[0]!.key : undefined;
}

/** Do two values of a RELI say one faith — the same clear faith, or, when neither says one clearly, the same words? */
export function sameReligion(a: string | undefined, b: string | undefined): boolean {
  const ka = religionKey(a);
  const kb = religionKey(b);
  if (ka || kb) return ka === kb;
  return !!a?.trim() && foldText(a.trim()) === foldText((b ?? "").trim());
}

/**
 * The RELI fact of a person that a new one of this value and date only cites again: one of the same faith, taken back
 * by nobody and not disproven, with no fact of another faith dated between the two (a religion can change: a
 * Catholic who became an evangelical and a Catholic again is three facts). Undefined: the new one is a fact of its own.
 */
export function religionFactFor(events: readonly Event[], value: string | undefined, date: string | undefined): Event | undefined {
  const live = events.filter((e) => e.kind === "RELI" && !e.retracted && e.status !== "disproven");
  const year = (d: string | undefined) => (d ? dateYears(d)[0] : undefined);
  const at = year(date);
  const between = (e: Event) => {
    const from = year(e.date);
    if (at === undefined || from === undefined) return false;
    return live.some((o) => {
      const y = year(o.date);
      return !sameReligion(o.value, value) && y !== undefined && y > Math.min(from, at) && y < Math.max(from, at);
    });
  };
  return live.find((e) => sameReligion(e.value, value) && !between(e));
}

/**
 * The facts a record of the person's own is of, by the kind of the record: a baptism or birth record is of the birth
 * and the baptism, a death or burial record of the death and the burial, a marriage record of the marriage. A record of
 * another kind (a civil record, a certificate) is of any of them.
 */
const OWN_RECORD = new Set(["BIRT", "CHR", "BAPM", "DEAT", "BURI", "CREM"]);
const MARRIAGE_RECORD = new Set(["MARR", "MARB", "MARC", "MARL", "ENGA"]);
const RECORD_OF: Partial<Record<string, Set<string>>> = {
  baptism: new Set(["BIRT", "CHR", "BAPM"]),
  birth: new Set(["BIRT", "CHR", "BAPM"]),
  death: new Set(["DEAT", "BURI", "CREM"]),
  burial: new Set(["DEAT", "BURI", "CREM"]),
  marriage: MARRIAGE_RECORD,
};

/** A record of the person's own naming one faith in its transcript. */
export interface ReligionNamed {
  source: string;
  key: ReligionKey;
  /** As the transcript writes it. */
  text: string;
}

/**
 * Is this citation of a fact the record of the fact itself — the person's own record? The fact is of the kind the
 * record is of, dated to the day (a parent's birth reckoned from a child's baptism is "ABT 1850", never a day), within a
 * year of the record's own date where it has one, and cited as primary information — or with none said (a citation
 * says no more than its record): never secondary.
 */
function recordOf(e: Event, c: Citation, s: Source): boolean {
  if (c.information === "secondary" || s.information === "secondary") return false;
  const kinds = RECORD_OF[s.kind];
  if (kinds && !kinds.has(e.kind)) return false;
  if (!e.date || !/^\d{1,2} [A-Z]{3} \d{3,4}$/u.test(e.date.trim())) return false;
  if (!s.date) return true;
  const [fact] = dateYears(e.date);
  const [record] = dateYears(s.date);
  return fact !== undefined && record !== undefined && Math.abs(fact - record) <= 1;
}

/**
 * The records of the person's own — the record of their birth, baptism, death, burial or marriage itself (recordOf),
 * never one that only names them — whose transcript names one faith of that person and one only, while the person has
 * no RELI fact at all (one taken back or disproven too: decided). A faith the record gives another person (the father's
 * in a child's baptism, a godparent's) is not theirs; in a marriage, the groom's is the man's and the bride's the
 * woman's. Nothing from a parent's, a child's or a sibling's record, the parish, the book, a note or a word not read for
 * sure: only the words of the person's own record, said as it writes them. Empty when there is nothing to say.
 */
export function religionNamed(tree: Tree, p: Person): ReligionNamed[] {
  if (p.events.some((e) => e.kind === "RELI")) return [];
  const live = (e: Event) => !e.retracted && e.status !== "disproven";
  const facts: { e: Event; marriage: boolean }[] = [
    ...p.events.filter((e) => OWN_RECORD.has(e.kind) && live(e)).map((e) => ({ e, marriage: false })),
    ...familiesAsPartner(tree, p.id).flatMap((f) => f.events.filter((e) => MARRIAGE_RECORD.has(e.kind) && live(e)).map((e) => ({ e, marriage: true }))),
  ];
  const sources = new Map<string, boolean>();
  for (const { e, marriage } of facts)
    for (const c of e.citations) {
      const s = tree.get<Source>(c.source);
      if (!s || s.type !== "source" || s.retracted || sources.has(s.id) || !recordOf(e, c, s)) continue;
      sources.set(s.id, marriage);
    }
  const own = p.sex === "M" ? "groom" : p.sex === "F" ? "bride" : undefined;
  const out: ReligionNamed[] = [];
  for (const [id, marriage] of sources) {
    const s = tree.get<Source>(id)!;
    const found = religionsIn(s.transcript).filter((f) => !f.of || (marriage && own !== undefined && f.of === own));
    if (!found.length || new Set(found.map((f) => f.key)).size > 1) continue;
    out.push({ source: s.id, key: found[0]!.key, text: found[0]!.text });
  }
  return out;
}
