// What a waiting task waits for, where it is dealt with and how far it got — derived, nothing written. The guided menu
// ("What waits for you") and the Strom app (through the bridge) read the same values from here.
//
//   kind   — letter (a request by post or e-mail: a registry office, an archive), family (a question to the family),
//            web (a site the person looks at), images (saved by hand), check (a site only the person checks),
//            permission (the person's decision about an archive), other. Written by the agent (strom task wait
//            --kind); for a task an older strom set waiting, read from its words — only where they say one kind
//            clearly, else "other" (never a wrong kind).
//   group  — the one place where it is dealt with: an archive of the research (its repository), an office (the
//            addressee), the family, a web site (its host), other.
//   phase  — todo, or sent (strom task sent: the letter mailed, the family asked).
//
// Any script, any accent: words through foldText, bounded by letters and digits (never \b); office names read as NFC.

import { WAIT_KINDS, type RecordSet, type Repository, type Task } from "./model.ts";
import { foldText } from "./text.ts";
import { phrase } from "./phrases.ts";
import type { Tree } from "./tree.ts";

export { WAIT_KINDS };
export type WaitKind = (typeof WAIT_KINDS)[number] | "images" | "check" | "permission";
/** The kinds of wait a request was sent for (strom task sent). */
export const SENDABLE: readonly WaitKind[] = ["letter", "family", "other"];

export type WaitPhase = "todo" | "sent";

export interface WaitGroup {
  /** repo:R…, to:<the addressee folded>, family, host:<host>, other. */
  key: string;
  /** As a person reads it: the archive's name, the addressee, the host, or a word in the research language. */
  name: string;
  kind: "archive" | "office" | "family" | "web" | "other";
}

/** A word of a folded text starting so (its prefix), not inside another word. */
const starts = (prefix: string) => new RegExp(`(?<![\\p{L}\\p{M}\\p{N}])${prefix}`, "u");
/** A whole word (or words) of a folded text. */
const whole = (w: string) => new RegExp(`(?<![\\p{L}\\p{M}\\p{N}])(?:${w})(?![\\p{L}\\p{M}\\p{N}])`, "u");

const URL_RE = /https?:\/\/[^\s<>"'“”‚‘’)\]]+/iu;

/** The endings a host written without its scheme must have to be taken for one (a file's "scan.jpg" is none). */
const TLDS = "cz|sk|de|at|ch|li|pl|hu|si|hr|ba|rs|ro|bg|ua|by|ru|lt|lv|ee|fi|se|no|dk|nl|be|lu|fr|it|es|pt|ie|uk|eu|us|ca|au|nz|com|org|net|info|gov|edu|int";
/**
 * A host written without its scheme, clearly a host: two or more labels of letters, digits and hyphens joined by dots,
 * the last a known ending — never an e-mail's (after "@"), never a part of a longer word or address; a path after it.
 */
const BARE_HOST_RE = new RegExp(
  `(?<![\\p{L}\\p{M}\\p{N}@._/\\-])((?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\\.)+(?:${TLDS}))(?![\\p{L}\\p{M}\\p{N}@_\\-])(\\/[^\\s<>"'“”‚‘’)\\]]*)?`,
  "iu",
);

/**
 * The first web address a text names (a task's words), with the full stop or comma after it left out — one with its
 * scheme first, else a host written without it ("digi.example.cz/kniha/2": https:// before it).
 */
export function firstUrlIn(text: string): string | undefined {
  const withScheme = URL_RE.exec(text)?.[0];
  const m = withScheme ? undefined : BARE_HOST_RE.exec(text);
  const u = (withScheme ?? (m ? `https://${m[1]}${m[2] ?? ""}` : undefined))?.replace(/[.,;:!?]+$/u, "");
  return u && URL.canParse(u) ? u : undefined;
}

/**
 * Asking the person who ordered the research (the agent's own words for it: "zeptat se uživatele", "den Nutzer fragen",
 * "ask the user") — the family, whatever else the text names. Only these phrases: the bare word "uživatel" is also a
 * site's user ("Uživatel v Digitální badatelně…").
 */
const ASK_USER: RegExp[] = [
  /(?<![\p{L}\p{M}\p{N}])zeptat se (?:u )?uzivatel/u,
  /(?<![\p{L}\p{M}\p{N}])uzivatel\p{L}{0,3} se zeptat(?![\p{L}\p{M}\p{N}])/u,
  /(?<![\p{L}\p{M}\p{N}])(?:den|die) (?:be)?nutzer(?:in)? (?:zu )?fragen(?![\p{L}\p{M}\p{N}])/u,
  /(?<![\p{L}\p{M}\p{N}])ask the user(?![\p{L}\p{M}\p{N}])/u,
];

/** Words of a folded text: none of them inside another word. */
const B = "(?<![\\p{L}\\p{M}\\p{N}])";
const E = "(?![\\p{L}\\p{M}\\p{N}])";

/**
 * The signs of each kind, on the folded text (cs · de · en) — by what the person is to do, never by a bare noun: a
 * register book ("matriční kniha", "matriky") or an archive's name says no letter, nor where a site is.
 */
const FAMILY: RegExp[] = [
  starts("rodin"), starts("zadavatel"), starts("pribuzn"), starts("pametnik"),
  starts("familie"), starts("angehorig"), starts("verwandt"),
  whole("family|families|relative|relatives"),
];
/**
 * Searching a site: a digital reading room, a catalogue, online; looking something up in it. A reading room is the
 * archive's site unless the person is to go there ("jet do badatelny", "navštívit badatelnu").
 */
const WEB: RegExp[] = [
  new RegExp(`${B}(?<!(?:jet|zajet|zajit|jit|cesta|cestu|navstivit|navsteva|navstevu|osobne) (?:do |v |ve )?)badateln`, "u"), starts("digiarchiv"),
  starts("katalog"), starts("catalog"), whole("online|web|webu|webseite|webseiten|website|websites"),
  new RegExp(`${B}(?:overi|overit|overte|vyhleda|vyhledat|vyhledani|vyhledejte) (?:v|ve|na)${E}`, "u"), starts("hledejte"),
  new RegExp(`${B}search (?:the|in the|on the) (?:catalog|catalogue|site|website|database)`, "u"),
];
/** A letter is writing to an institution: a word of a request… */
const REQUEST: RegExp[] = [
  starts("dotaz"), starts("zadost"), starts("dopis"), starts("e-?mail"), starts("odpoved"), starts("napsat"), whole("napise|napiseme|psat"),
  starts("anfrage"), whole("brief|briefe|briefes|briefs"), starts("antwort"), starts("schreiben"),
  starts("request"), whole("letter|letters|reply|replies|answer|answers"), new RegExp(`${B}write to${E}`, "u"),
];
/** …together with an office or an archive it goes to. */
const OFFICE: RegExp[] = [
  whole("meu|ou|mu|soka|soa"), starts("urad"), starts("matrik"), starts("magistrat"),
  new RegExp(`${B}\\p{L}*(?<!digi)archiv`, "u"), starts("standesamt"), starts("pfarramt"), whole("amt|amtes|amts"),
  whole("office|offices|registry|registrar"),
];

type Said = "family" | "letter" | "web";

/** The kinds a text names: each kind once. */
function kindsIn(text: string): Set<Said> {
  const f = foldText(text);
  const found = new Set<Said>();
  if (FAMILY.some((re) => re.test(f))) found.add("family");
  if (REQUEST.some((re) => re.test(f)) && OFFICE.some((re) => re.test(f))) found.add("letter");
  if (WEB.some((re) => re.test(f)) || URL_RE.test(text)) found.add("web");
  return found;
}

/**
 * The first clause of a text: up to its first ";", a dash between spaces, or the end of a sentence (". " not after a
 * digit — a date's "3. 10." goes on —, "? ", "! ") — none of them inside parentheses or brackets.
 */
export function firstClause(text: string): string {
  let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!;
    if (c === "(" || c === "[") depth++;
    else if ((c === ")" || c === "]") && depth > 0) depth--;
    if (depth > 0) continue;
    if (c === ";") return text.slice(0, i);
    const next = text[i + 1];
    if ((c === "–" || c === "—" || c === "-") && /\s/u.test(text[i - 1] ?? "") && (next === undefined || /\s/u.test(next))) return text.slice(0, i);
    if ((c === "?" || c === "!") && next !== undefined && /\s/u.test(next)) return text.slice(0, i + 1);
    if (c === "." && next !== undefined && /\s/u.test(next) && !/\p{N}/u.test(text[i - 1] ?? "")) return text.slice(0, i + 1);
  }
  return text;
}

/**
 * What a waiting task waits for: the agent's kind, what strom knows of it (images, a check, a decision), else what its
 * words say — what it waits on first, then what it is about. In each, its first clause decides when it names one kind
 * (a fallback later in the text does not change it: "…; else a letter to the office"); when it names none or several,
 * the whole text, only when that names one; else "other".
 */
export function waitKindOf(task: Task): WaitKind {
  if (task.wait?.kind) return task.wait.kind;
  if (task.awaits) return "images";
  if (task.awaitsCheck) return "check";
  if (task.awaitsPermission) return "permission";
  for (const text of [task.waitingOn ?? "", task.what]) {
    if (ASK_USER.some((re) => re.test(foldText(text)))) return "family";
    const first = kindsIn(firstClause(text));
    if (first.size === 1) return [...first][0]!;
    if (first.size > 1) return "other";
    const kinds = kindsIn(text);
    if (kinds.size === 1) return [...kinds][0]!;
    if (kinds.size > 1) return "other";
  }
  return "other";
}

/** Whether its request went out (strom task sent). */
export function waitPhaseOf(task: Task): WaitPhase {
  return task.sent ? "sent" : "todo";
}

/**
 * An office named in a text, as found: "MěÚ Tábor", "Standesamt Wien" — the office's word and 1–3 capitalized words on
 * its line; a state archive written out may have "v" before its place ("Státní oblastní archiv v Třeboni"), a city's
 * magistrate any case of it and "města" ("matriky Magistrátu Kolín", "Magistrát města Kolína").
 */
const OFFICE_RE =
  /(?<![\p{L}\p{M}\p{N}])(?:(?:Státní oblastní archiv|Státní okresní archiv)(?:[^\S\r\n]+(?:v|ve))?|[Mm]agistrát\p{Ll}*(?:[^\S\r\n]+(?:hlavního[^\S\r\n]+|statutárního[^\S\r\n]+)?města)?|MěÚ|OÚ|SOkA|SOA|Zvláštní matrika|Matrika|Matriční úřad|Městský úřad|Obecní úřad|Standesamt|Stadtarchiv)(?:[^\S\r\n]+\p{Lu}[\p{Ll}\p{M}]*){1,3}(?![\p{L}\p{M}\p{N}])/u;

export function officeIn(text: string): string | undefined {
  return OFFICE_RE.exec(text.normalize("NFC"))?.[0].replace(/\s+/g, " ");
}

/** The abbreviations of state archives, written out (folded). */
const ABBREVIATIONS: [RegExp, string][] = [
  [/(?<![\p{L}\p{M}\p{N}])soka(?![\p{L}\p{M}\p{N}])/gu, "statni okresni archiv"],
  [/(?<![\p{L}\p{M}\p{N}])soa(?![\p{L}\p{M}\p{N}])/gu, "statni oblastni archiv"],
];
/** The institutions an office's name begins its own words with (folded), the longest first. */
const INSTITUTIONS = [
  "statni oblastni archiv", "statni okresni archiv", "moravsky zemsky archiv", "zemsky archiv", "narodni archiv",
  "zvlastni matrika", "matricni urad", "mestsky urad", "obecni urad", "matrika", "standesamt", "stadtarchiv",
];
/** The little words between an institution and its place. */
const LINKS = new Set(["v", "ve", "in", "im", "na", "u"]);

/**
 * An office's or an archive's name as its institution and its place (folded): "SOA Třeboň" and "Státní oblastní archiv v
 * Třeboni (DigiArchiv)" both the state regional archive at "trebon…" — only what stands before a parenthesis.
 */
function institutionOf(name: string): { inst: string; place: string } | undefined {
  let f = foldText(name.normalize("NFC").split("(")[0]!).trim();
  for (const [re, full] of ABBREVIATIONS) f = f.replace(re, full);
  const words = f.split(/[^\p{L}\p{M}\p{N}]+/u).filter(Boolean);
  const joined = ` ${words.join(" ")} `;
  const inst = INSTITUTIONS.find((i) => joined.includes(` ${i} `));
  if (!inst) return undefined;
  const after = joined.slice(joined.indexOf(` ${inst} `) + inst.length + 2).split(" ").filter(Boolean);
  const place = after.find((w) => !LINKS.has(w));
  return place ? { inst, place } : undefined;
}

/** Two places by their stem (the first five letters): Třeboň and Třeboni, Kolín and Kolíně. */
function samePlace(a: string, b: string): boolean {
  const k = Math.min(5, a.length, b.length);
  return k >= 2 && a.slice(0, k) === b.slice(0, k);
}

/** The one archive of the research an office's name stands for (its institution and its place), else none. */
function repoOfOffice(repos: Repository[], name: string): Repository | undefined {
  const o = institutionOf(name);
  if (!o) return undefined;
  const found = repos.filter((r) => {
    const x = institutionOf(r.name);
    return !!x && x.inst === o.inst && samePlace(x.place, o.place);
  });
  return found.length === 1 ? found[0] : undefined;
}

/** A host as two addresses of one site compare: lowercase, without www. */
function hostOf(url: string | undefined): string | undefined {
  if (!url || !URL.canParse(url)) return undefined;
  const h = new URL(url).hostname.toLowerCase();
  return h ? h.replace(/^www\./, "") : undefined;
}

/** The one place where a waiting task is dealt with (see the top of this file). */
export function waitGroupOf(tree: Tree, task: Task, lang: string = tree.lang): WaitGroup {
  const kind = waitKindOf(task);
  const repos = tree.list<Repository>("repository").filter((r) => !r.retracted && !r.mergedInto);
  const sets = tree.list<RecordSet>("recordset").filter((b) => !b.retracted && !b.mergedInto);
  const archive = (r: Repository | undefined): WaitGroup | undefined => (r ? { key: `repo:${r.id}`, name: r.name, kind: "archive" } : undefined);
  const repoNamed = (name: string) => repos.find((r) => foldText(r.name) === foldText(name));
  // an office that is an archive of the research (its name, or its institution and place: SOA Třeboň) is that archive
  const office = (name: string): WaitGroup => archive(repoNamed(name) ?? repoOfOffice(repos, name)) ?? { key: `to:${foldText(name)}`, name: name.trim(), kind: "office" };
  const text = [task.waitingOn ?? "", task.what].join("\n");
  // the archive of a site: a repository's address, else a book's of an archive of the research
  const repoOfHost = (host: string): Repository | undefined =>
    repos.find((x) => hostOf(x.url) === host) ?? (() => {
      const s = sets.find((x) => x.repository && hostOf(x.url) === host);
      return s ? repos.find((x) => x.id === s.repository) : undefined;
    })();

  // whom the agent said it waits on
  if (task.wait?.to?.trim()) return office(task.wait.to);
  if (kind === "family") return { key: "family", name: phrase(lang, "wait.group.family"), kind: "family" };
  // the office it waits on first (the first one its waitingOn names), then one its what names
  const named = officeIn(task.waitingOn ?? "") ?? officeIn(task.what);
  // a letter names its office before the books the task searched
  if (kind === "letter" && named) return office(named);
  // a site to look at is the site it names, before the archive of the task's books (another institution's site is its own)
  if (kind === "web") {
    const host = hostOf(task.wait?.url) ?? hostOf(firstUrlIn(text));
    if (host) return archive(repoOfHost(host)) ?? { key: `host:${host}`, name: host, kind: "web" };
  }
  // the archive of the task's books
  const book = task.awaits?.recordset ?? task.where.find((w) => /^B\d{4,}$/.test(w));
  const b = book ? tree.get<RecordSet>(book) : undefined;
  const own = archive(b?.repository ? repos.find((r) => r.id === b.repository) : undefined);
  if (own) return own;
  // the archive of the site it names — images saved by hand: their book's site too (a book of no archive of the research)
  const hosts = [hostOf(task.wait?.url), hostOf(task.awaitsCheck?.url), ...(task.awaitsPermission?.hosts ?? []).map((h) => h.toLowerCase().replace(/^www\./, "")), hostOf(firstUrlIn(text)), task.awaits ? hostOf(b?.url) : undefined].filter((h): h is string => !!h);
  for (const host of hosts) {
    const r = repoOfHost(host);
    if (r) return archive(r)!;
  }
  if (named) return office(named);
  if (hosts[0]) return { key: `host:${hosts[0]}`, name: kind === "permission" && task.awaitsPermission?.title ? task.awaitsPermission.title : hosts[0], kind: "web" };
  return { key: "other", name: phrase(lang, "wait.group.other"), kind: "other" };
}

/** What a waiting task says of its wait (task show, task list --json; the menu and the app read the same). */
export function waitState(tree: Tree, task: Task): { waitKind: WaitKind; group: WaitGroup; phase: WaitPhase; sentAt?: string } | undefined {
  if (task.state !== "waiting") return undefined;
  return { waitKind: waitKindOf(task), group: waitGroupOf(tree, task), phase: waitPhaseOf(task), ...(task.sent ? { sentAt: task.sent.at } : {}) };
}
