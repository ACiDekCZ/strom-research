// What a variant of a hypothesis would connect (strom hypothesis link): the
// checks of a link and its writing, one way for the command and for strom
// itself. Hypotheses written before the command existed name their people only
// in the words of their variants ("the son of P0012 and P0013"); the Strom app
// shows what a variant would connect only from its links. Once per research
// strom fills them in where the words say it beyond doubt (settleHypothesisLinks:
// the first run of a newer strom, the bridge's start) — a wrong link is worse
// than none — and leaves the rest to the agent as tasks.

import path from "node:path";
import type { Family, Hypothesis, HypothesisVariant, Person, Task, VariantLink } from "./model.ts";
import { UsageError } from "./errors.ts";
import { create, normId, update } from "./records.ts";
import { birthEvent, familiesAsChild, familiesAsPartner } from "./people.ts";
import { foldText } from "./text.ts";
import { phrase } from "./phrases.ts";
import { liveHolder } from "./lock.ts";
import { liveWorkers, runsAtWork } from "./workers.ts";
import { readJson } from "./json.ts";
import { writableUnasked } from "./integrity.ts";
import { TREE_FILE, typeOfId, VERSION, type Tree } from "./tree.ts";

/**
 * A variant whose link the tree records already: it gets none (nothing uncertain to show — strom hypothesis show marks
 * it, the Strom app shows it as the tree's own), and the hypothesis stays open until the records decide it.
 */
const RECORDED_HINT = "the tree records this already: the variant gets no link (strom hypothesis show marks it); the hypothesis stays open until the records decide it";

export const LINK_HOW = "--child P… --of F… | --child P… --parents P… [P…] | --same P… P… | --partners P… P… | --siblings P… P… [P…]";

/** A person a link may name: there, not retracted, not merged. */
export function linkPerson(tree: Tree, ref: string): string {
  const id = normId(ref, "person");
  if (typeOfId(id) !== "person") throw new UsageError(`"${ref}" is not a person ID: a link names people by ID (P0001)`, { hint: "strom person list" });
  const p = tree.get<Person>(id);
  if (!p) throw new UsageError(`no person ${id}`, { hint: "strom person list", code: "record.none", params: { kind: "person", id } });
  if (p.mergedInto) throw new UsageError(`${id} was merged into ${p.mergedInto}`, { hint: `use ${p.mergedInto}`, code: "record.merged", params: { id, into: p.mergedInto } });
  if (p.retracted) throw new UsageError(`${id} is retracted`, { hint: `strom person show ${id}` });
  return id;
}

function distinct(ids: string[], what: string): string[] {
  const set = [...new Set(ids)];
  if (set.length !== ids.length) throw new UsageError(`${what}: the same person twice (${ids.join(" ")})`);
  return set;
}

/** The family whose partners are exactly these people. */
export function familyOf(tree: Tree, partners: string[]): Family | undefined {
  return tree.list<Family>("family").find((f) => !f.retracted && f.partners.length === partners.length && partners.every((p) => f.partners.includes(p)));
}

/** "child P… of F…" or "child P… of P… [P…]", checked against the tree. */
export function childLink(tree: Tree, childRef: string, of: string | undefined, parents: string[]): VariantLink {
  const child = linkPerson(tree, childRef);
  if (of !== undefined && parents.length) throw new UsageError("a family (--of) or parents (--parents), not both", { hint: LINK_HOW });
  if (of !== undefined) {
    const famId = normId(of, "family");
    if (typeOfId(famId) !== "family") throw new UsageError(`"${of}" is not a family ID (F0001)`, { hint: "strom family list" });
    const f = tree.get<Family>(famId);
    if (!f) throw new UsageError(`no family ${famId}`, { hint: "strom family list", code: "record.none", params: { kind: "family", id: famId } });
    if (f.mergedInto) throw new UsageError(`${famId} was merged into ${f.mergedInto}`, { hint: `use ${f.mergedInto}`, code: "record.merged", params: { id: famId, into: f.mergedInto } });
    if (f.retracted) throw new UsageError(`${famId} is retracted`);
    if (f.children.some((c) => c.person === child)) throw new UsageError(`${child} is a child of ${famId} already: nothing uncertain to show`, { hint: RECORDED_HINT });
    if (f.partners.includes(child)) throw new UsageError(`${child} is a partner of ${famId}`);
    return { kind: "child", person: child, family: famId };
  }
  if (!parents.length) throw new UsageError("whose child: --of F… (a family of the tree) or --parents P… [P…]", { hint: LINK_HOW });
  if (parents.length > 2) throw new UsageError("one or two parents", { hint: LINK_HOW });
  const ps = distinct(parents.map((p) => linkPerson(tree, p)), "--parents");
  if (ps.includes(child)) throw new UsageError(`${child} cannot be their own parent`);
  const fam = familyOf(tree, ps);
  if (fam?.children.some((c) => c.person === child)) throw new UsageError(`${child} is a child of ${fam.id} already: nothing uncertain to show`, { hint: RECORDED_HINT });
  if (fam) throw new UsageError(`${ps.join(" and ")} are a family of the tree: ${fam.id}`, { hint: `strom hypothesis link H… <variant> --child ${child} --of ${fam.id}` });
  return { kind: "child", person: child, parents: ps };
}

/** "same", "partners" or "siblings" of these people, checked against the tree. */
export function personsLink(tree: Tree, kind: "same" | "partners" | "siblings", refs: string[]): VariantLink {
  const persons = distinct(refs.map((p) => linkPerson(tree, p)), `--${kind}`);
  if (kind === "siblings" ? persons.length < 2 : persons.length !== 2)
    throw new UsageError(kind === "siblings" ? "--siblings takes two or more people" : `--${kind} takes two people`, { hint: `--${kind} P… P…${kind === "siblings" ? " [P…]" : ""}` });
  const together = kind === "partners" ? familyOf(tree, persons) : undefined;
  if (together) throw new UsageError(`${persons.join(" and ")} are partners of ${together.id} already: nothing uncertain to show`, { hint: RECORDED_HINT });
  return { kind, persons };
}

/** One link as a key: the same link given again is the same, whatever the order of its people. */
export function linkKey(l: VariantLink): string {
  return l.kind === "child" ? `child ${l.person} ${l.family ?? [...(l.parents ?? [])].sort().join("+")}` : `${l.kind} ${[...l.persons].sort().join("+")}`;
}

/** One link in a few words: "child P0006 of F0001", "same P0005 = P0003". */
export function linkText(l: VariantLink): string {
  if (l.kind === "child") return `child ${l.person} of ${l.family ?? (l.parents ?? []).join(" + ")}`;
  return `${l.kind} ${l.persons.join(l.kind === "same" ? " = " : l.kind === "partners" ? " + " : ", ")}`;
}

/** The options of strom hypothesis link that say this link: "--child P0006 --of F0001". */
export function linkOptions(l: VariantLink): string {
  if (l.kind === "child") return `--child ${l.person} ${l.family ? `--of ${l.family}` : `--parents ${(l.parents ?? []).join(" ")}`}`;
  return `--${l.kind} ${l.persons.join(" ")}`;
}

export function linkIds(l: VariantLink): string[] {
  return l.kind === "child" ? [l.person, ...(l.family ? [l.family] : []), ...(l.parents ?? [])] : l.persons;
}

/**
 * What a new link would say that the variant did not (its letter is one claim's: the Strom app remembers "H0022,
 * variant B"): links again after all were taken off, naming anyone they did not; a child it named, given other
 * parents. Adding to what it says is fine.
 */
function otherPeople(v: HypothesisVariant, l: VariantLink): string[] {
  const before = new Set(v.linked ?? []);
  if (!before.size) return [];
  const ids = linkIds(l);
  if (!v.links?.length) return ids.filter((x) => !before.has(x));
  if (l.kind === "child" && before.has(l.person)) return ids.filter((x) => x !== l.person && !before.has(x));
  return [];
}

/**
 * A variant's link written (or taken off: `remove`, with no link every one of the variant) — the one way strom
 * hypothesis link and strom itself write it. Under the tree's lock; the caller commits.
 */
export function writeVariantLink(tree: Tree, id: string, label: string, link: VariantLink | undefined, opts: { remove?: boolean; reason?: string } = {}): Hypothesis {
  const said = link ? linkText(link) : "every link";
  return update<Hypothesis>(
    tree,
    id,
    "hypothesis",
    (h) => {
      if (h.state !== "open") throw new UsageError(`${id} is ${h.state}: what a variant would connect is for an open hypothesis`, { hint: `strom hypothesis show ${id}` });
      const v = h.variants.find((x) => foldText(x.label) === foldText(label));
      if (!v) throw new UsageError(`no variant ${label} in ${id}`, { hint: h.variants.map((x) => x.label).join(", ") });
      const had = v.links ?? [];
      const at = link ? had.findIndex((l) => linkKey(l) === linkKey(link)) : -1;
      if (opts.remove) {
        if (!had.length) throw new UsageError(`${id} ${v.label} has no links`, { hint: `strom hypothesis show ${id}` });
        if (link && at < 0) throw new UsageError(`${id} ${v.label} has no link ${linkText(link)}`, { hint: had.map(linkText).join(" · ") });
        const rest = link ? had.filter((_, i) => i !== at) : [];
        if (rest.length) v.links = rest;
        else delete v.links;
      } else {
        if (!link) throw new UsageError("say what the variant would connect", { hint: LINK_HOW });
        if (at >= 0) throw new UsageError(`${id} ${v.label} has that link already: ${linkText(link)}`, { hint: `strom hypothesis show ${id}` });
        const other = otherPeople(v, link);
        if (other.length)
          throw new UsageError(`${id} ${v.label} said other people before (${(v.linked ?? []).join(" ")}): a variant's letter stays one claim's — ${other.join(" ")} is a new variant`, {
            hint: `strom hypothesis variant ${id} "<the claim>", then strom hypothesis link ${id} <its letter> …`,
          });
        v.links = [...had, link];
        v.linked = [...new Set([...(v.linked ?? []), ...linkIds(link)])];
      }
      return h;
    },
    {
      op: "hypothesis.link",
      summary: `${id} ${label}: ${opts.remove ? `${said} taken off` : said}`,
      targets: link ? linkIds(link) : [],
      ...(opts.reason ? { reason: opts.reason } : {}),
    },
  );
}

// ── reading a claim ─────────────────────────────────────────────────────────
// Only what says the subject's parents beyond doubt: "the son of P0012 and P0013", "syn Josefa P0012 a Marie P0013",
// "Tochter von P0012 und P0013", "parents: P0012 and P0013". Words compared folded (no accents, no capitals, any
// script), never with \b or [a-z]. Anything that may say another thing — a spouse, a witness, a godparent, a sibling,
// the same person, "or", a question, a negation, more people, another family — and nothing is read.

/** Words that make the subject a child of the two named after them (one of them, once in the claim). */
const CHILD_WORDS = new Set([
  // Czech, Slovak
  "syn", "synem", "synom", "dcera", "dcerou", "dite", "ditetem", "dieta", "dietatom", "potomek", "potomkem",
  // English
  "son", "daughter", "child",
  // German ("Kind" only before von/des/der: "a kind of" is no child)
  "sohn", "tochter", "kind",
]);
/** Words that name the two after them as the parents. Never "parents of …" / "Eltern von …" (their parents). */
const PARENT_WORDS = new Set(["rodice", "rodicia", "parents", "eltern"]);
/** Between a parent word and the first of them: what may stand there. */
const PARENTS_BETWEEN = new Set([":", "-", "–", "—", "(", ",", "jsou", "byli", "byla", "su", "boli", "sind", "waren", "are", "were", "his", "her", "jeho", "jeji", "sein", "seine", "ihre", "ihr"]);
/** "and" of the two parents. */
const AND = new Set(["a", "and", "und", "&", "+", ","]);
/** Whole words that make a claim doubtful anywhere in it. */
const DOUBT_WORDS = new Set([
  // or
  "or", "nebo", "ci", "oder", "alebo", "albo", "lub", "either", "entweder", "bzw", "beziehungsweise", "respektive", "resp", "pripadne", "versus", "vs",
  // not
  "not", "nor", "neither", "nicht", "weder", "ne", "neni", "nebyl", "nebyla", "nebylo", "nejsou", "nebyli", "nikoli", "nikoliv", "ani", "nie", "nebol", "nebola",
  // the same person
  "same", "derselbe", "dieselbe", "dasselbe", "tentyz", "tataz", "tytez", "totez", "tyz", "taz", "titez",
  // a wife, a husband
  "zena", "zeny", "zene", "zenou", "chot", "choti", "mann", "mannes", "manne", "frau", "wife", "husband",
  // a father or mother named alone ("son of P1, whose mother P2")
  "otec", "otce", "otci", "otcem", "matka", "matky", "matce", "matku", "matkou", "vater", "mutter", "father", "mother",
  // a godparent (Pate)
  "pate", "paten", "patin",
  // in-law
  "law", "zet", "snacha",
  "teta", "deda", "ded", "otcim", "macecha", "step", "kin",
]);
/** Beginnings of words that make a claim doubtful anywhere in it. */
const DOUBT_STEMS = [
  // a spouse, a marriage
  "manzel", "nemanzel", "spous", "wife", "husband", "widow", "vdov", "witw", "ehe", "gatt", "frau", "married", "marriage", "zenat", "vdan", "heirat", "verheirat", "snoub", "brautig",
  // a witness, a godparent
  "witness", "svedk", "svedek", "svedok", "zeug", "trauzeug", "godf", "godm", "godp", "godch", "sponsor", "kmotr", "krstn", "taufpat",
  // a sibling, a relative
  "brat", "sestr", "sourozen", "surodenc", "bruder", "brud", "schwest", "geschwist", "sibling", "brother", "sister", "cousin", "vetter", "neffe", "nicht", "nephew", "niece", "synovec", "neter", "uncle", "aunt", "onkel", "tante", "stryc", "grand", "vnuk", "vnuc", "enkel", "gross", "praded", "prababi", "babick", "dedeck", "relativ", "related", "verwandt", "pribuz", "kinship",
  // not a child of both: step, adopted, foster, in-law
  "stepso", "stepda", "stepch", "stepfa", "stepmo", "steppa", "stief", "nevlastn", "adopt", "foster", "pflege", "pestoun", "tchan", "tchyn", "schwieger",
  // the same person
  "identi", "totozn", "stejn",
];
/** Words that make a parent uncertain between the parent word and the second of them. */
const HEDGES = ["maybe", "perhaps", "possibl", "probabl", "likely", "asi", "snad", "mozna", "pravdepodob", "vielleicht", "eventuell", "wohl", "moglicherweise", "wahrscheinlich", "unlikely", "unwahrschein", "unknown", "neznam", "unbekannt", "nezn"];

const doubtful = (w: string) => DOUBT_WORDS.has(w) || DOUBT_STEMS.some((s) => w.startsWith(s));
/**
 * A question about another relation than the subject's parents ("Was P0012 the brother of …?", "the same man as …?"):
 * its "yes, the son of P1 and P2" may be somebody else's. Its "or", "?" and "father" are a question's own.
 */
const otherRelation = (w: string) => DOUBT_STEMS.some((s) => w.startsWith(s)) || ["same", "derselbe", "dieselbe", "tentyz", "tataz", "tyz", "taz", "zena", "zeny", "zenou", "chot", "wife", "husband", "pate", "patin", "step", "kin"].includes(w);
const hedged = (w: string) => HEDGES.some((s) => w.startsWith(s));

const ID_TOKEN = /^\p{L}\d{4,}$/u;
/** IDs that may stand anywhere (a citation: a source, a book, an image, an archive, a place, an input, a search, a lesson). */
const CITED = new Set(["S", "B", "M", "R", "L", "I", "Q", "K", "T", "N", "G"]);

/** The words of a text folded (no accents, no capitals), with its marks one by one. */
function tokens(text: string): string[] {
  return foldText(text.normalize("NFC")).match(/[\p{L}\p{M}\p{N}]+|[^\s\p{L}\p{M}\p{N}]/gu) ?? [];
}

function yearOf(date: string | undefined): number | undefined {
  const m = date ? /(?<!\p{N})(\d{4})(?!\p{N})/u.exec(date) : null;
  return m ? Number(m[1]) : undefined;
}

/** The people below a person (children, their children …): never a parent of theirs. */
function descendants(tree: Tree, id: string): Set<string> {
  const out = new Set<string>();
  const queue = [id];
  while (queue.length) {
    const p = queue.shift()!;
    for (const f of familiesAsPartner(tree, p))
      for (const c of f.children)
        if (!out.has(c.person) && c.person !== id) {
          out.add(c.person);
          queue.push(c.person);
        }
  }
  return out;
}

/** A person a link may name: there, neither retracted nor merged. */
function usable(tree: Tree, id: string): Person | undefined {
  const p = tree.get<Person>(id);
  return p && p.type === "person" && !p.retracted && !p.mergedInto ? p : undefined;
}

/**
 * The link the claim of a variant says beyond doubt: the subject of the hypothesis (its one subject, a person with no
 * birth family) the child of the two people it names as the parents — of their one family, or of the two when they
 * have none. Undefined: the words leave any doubt, or the tree does.
 */
export function claimLink(tree: Tree, h: Hypothesis, v: HypothesisVariant): VariantLink | undefined {
  if (h.subject.length !== 1) return undefined;
  const child = h.subject[0]!;
  const subject = typeOfId(child) === "person" ? usable(tree, child) : undefined;
  if (!subject || familiesAsChild(tree, child).length) return undefined;
  const words = tokens(v.claim);
  if (words.includes("?")) return undefined;
  if (tokens(h.question).some(otherRelation)) return undefined;
  // the IDs it names: two people besides the subject, each once; a family only theirs; no other hypothesis or conflict
  const ids = words.map((w, i) => ({ w, i })).filter(({ w }) => ID_TOKEN.test(w));
  const people: { id: string; at: number }[] = [];
  const families: string[] = [];
  for (const { w, i } of ids) {
    const id = w.toUpperCase();
    const prefix = id[0]!;
    // a mark right after an ID: "P0013's", a possessive — whose, then?
    if (["'", "’"].includes(words[i + 1] ?? "")) return undefined;
    if (prefix === "P") {
      if (id !== child) people.push({ id, at: i });
    } else if (prefix === "F") families.push(id);
    else if (!CITED.has(prefix)) return undefined;
  }
  if (people.length !== 2 || people[0]!.id === people[1]!.id) return undefined;
  const [first, second] = people as [{ id: string; at: number }, { id: string; at: number }];
  if (words.some(doubtful)) return undefined;
  // the one word that says parents, shortly before the first of them
  const said = words.map((w, i) => ({ w, i })).filter(({ w }) => CHILD_WORDS.has(w) || PARENT_WORDS.has(w));
  if (said.length !== 1 || said[0]!.i >= first.at) return undefined;
  const { w: word, i: k } = said[0]!;
  const before = words.slice(k + 1, first.at);
  if (PARENT_WORDS.has(word)) {
    // "parents: P1 and P2", "rodiče P0123 jsou P1 a P2" — never "parents of" anyone
    if (!before.every((w) => PARENTS_BETWEEN.has(w) || w === child.toLowerCase())) return undefined;
  } else {
    if (word === "kind" && !["von", "des", "der"].includes(words[k + 1] ?? "")) return undefined;
    // names, "of", an article between — no ID of anyone (the subject named there: whose son, then?)
    if (before.length > 6 || before.some((w) => ID_TOKEN.test(w) && !CITED.has(w[0]!.toUpperCase()))) return undefined;
    if (before.some((w) => [";", "/", "|", "=", ":"].includes(w))) return undefined;
  }
  // between the two: "and" — with names, parentheses, a citation; nothing else
  const between = words.slice(first.at + 1, second.at);
  if (between.length > 8 || !between.some((w) => AND.has(w))) return undefined;
  if (between.some((w) => [";", "/", "|", "=", ":"].includes(w) || (ID_TOKEN.test(w) && !CITED.has(w[0]!.toUpperCase())))) return undefined;
  if (words.slice(k, second.at + 1).some(hedged)) return undefined;
  // the people: there, not the subject's own descendants, not of one sex, older than the child
  const ps = [usable(tree, first.id), usable(tree, second.id)];
  if (!ps[0] || !ps[1]) return undefined;
  if (ps[0].sex !== "U" && ps[0].sex === ps[1].sex) return undefined;
  const below = descendants(tree, child);
  if (below.has(first.id) || below.has(second.id)) return undefined;
  const born = yearOf(birthEvent(subject)?.date);
  for (const p of ps as Person[]) {
    const y = yearOf(birthEvent(p)?.date);
    if (born !== undefined && y !== undefined && y > born - 12) return undefined;
  }
  // their family: one, or none — more, and which?
  const theirs = familiesAsPartner(tree, first.id).filter((f) => !f.mergedInto && f.partners.includes(second.id));
  if (theirs.length > 1) return undefined;
  const fam = theirs[0];
  if (families.some((f) => f !== fam?.id)) return undefined;
  try {
    return fam ? childLink(tree, child, fam.id, []) : childLink(tree, child, undefined, [first.id, second.id]);
  } catch (e) {
    if (e instanceof UsageError) return undefined;
    throw e;
  }
}

// ── what the tree records already ─────────────────────────────────────────
// A variant may say what the tree holds now ("the parents as the tree has them: P0012 and P0013, F0005"): its link
// would show nothing uncertain, and strom hypothesis link refuses it. Such a variant is no link to make — it is said
// as the tree's own (strom hypothesis show, the brief, the Strom app's _INTREE) and the hypothesis stays open until the
// records decide it. Read from the words only where they name that family (or both its partners) and nothing else.

/** Whole words after which a claim is no plain statement of the tree's link: or, not, another, unknown. */
const NOT_THE_TREE = new Set([
  "or", "nebo", "ci", "oder", "alebo", "albo", "lub", "either", "entweder", "bzw", "beziehungsweise", "respektive", "resp", "pripadne", "versus", "vs",
  "not", "nor", "neither", "nicht", "kein", "keine", "keiner", "keinem", "keinen", "weder", "ne", "neni", "nebyl", "nebyla", "nebylo", "nejsou", "nebyli", "nikoli", "nikoliv", "ani", "nie", "nebol", "nebola",
  "other", "another", "instead", "andere", "anderer", "anderen", "anderem", "anderes", "statt", "anstatt", "jiny", "jina", "jine", "jineho", "jinem", "jinou", "jinych", "jinym", "misto", "cizi", "fremd", "fremde", "fremder", "fremden",
]);
/** Beginnings of words that say another link than the tree's: step, adopted, foster, unknown, unidentified. */
const NOT_THE_TREE_STEMS = ["stepso", "stepda", "stepch", "stepfa", "stepmo", "steppa", "stief", "nevlastn", "adopt", "foster", "pflege", "pestoun", "neznam", "nezjist", "unknown", "unbekannt", "unident"];

const usableFamily = (f: Family | undefined): f is Family => !!f && f.type === "family" && !f.retracted && !f.mergedInto;

/** Whether the tree records this link now: the child in that family (or of those parents), the couple, the siblings. */
export function linkInTree(tree: Tree, l: VariantLink): Family | undefined {
  if (l.kind === "child") {
    const f = l.family ? tree.get<Family>(l.family) : l.parents?.length ? familyOf(tree, [...new Set(l.parents)]) : undefined;
    return usableFamily(f) && f.children.some((c) => c.person === l.person) ? f : undefined;
  }
  if (l.kind === "partners") {
    const f = familyOf(tree, [...new Set(l.persons)]);
    return usableFamily(f) ? f : undefined;
  }
  if (l.kind === "siblings") {
    const [first, ...rest] = [...new Set(l.persons)];
    if (!first || !rest.length) return undefined;
    return familiesAsChild(tree, first).find((f) => usableFamily(f) && rest.every((p) => f.children.some((c) => c.person === p)));
  }
  // two records of one person are never both in the tree as one
  return undefined;
}

/**
 * The tree's own link a claim says, read from its words: the subjects already children of the family it names — by its
 * ID, or both its partners with a word that says parents ("son of P0012 and P0013") — naming nobody else, with no
 * word of doubt, of another relation (a wife, a brother, the same person) or of another link. Of a question about
 * another relation (a brother, the same person) none: whose child, then? Children of two families: which, then?
 */
function claimInTree(tree: Tree, h: Hypothesis, v: HypothesisVariant): VariantLink[] {
  const words = tokens(v.claim);
  if (words.includes("?")) return [];
  if (words.some((w) => doubtful(w) || NOT_THE_TREE.has(w) || NOT_THE_TREE_STEMS.some((s) => w.startsWith(s)))) return [];
  // "stejnojmenný" (a namesake) asks whose child; "stejný" (the same person) another relation
  if (tokens(h.question).some((w) => otherRelation(w) && !w.startsWith("stejnojmen"))) return [];
  const persons = new Set<string>();
  const families = new Set<string>();
  for (const [i, w] of words.entries()) {
    if (!ID_TOKEN.test(w)) continue;
    // a mark right after an ID: "P0013's", a possessive — whose, then?
    if (["'", "’"].includes(words[i + 1] ?? "")) return [];
    const id = w.toUpperCase();
    if (id[0] === "P") persons.add(id);
    else if (id[0] === "F") families.add(id);
    else if (!CITED.has(id[0]!)) return [];
  }
  if (families.size > 1 || (!families.size && persons.size !== 2)) return [];
  const parentWord = words.some((w) => CHILD_WORDS.has(w) || PARENT_WORDS.has(w));
  const found: { child: string; family: string }[] = [];
  for (const child of h.subject.filter((s) => typeOfId(s) === "person" && usable(tree, s)))
    for (const f of familiesAsChild(tree, child).filter(usableFamily)) {
      const named = families.size ? families.has(f.id) : parentWord && f.partners.length === 2 && f.partners.every((p) => persons.has(p));
      if (named && [...persons].every((p) => p === child || f.partners.includes(p))) found.push({ child, family: f.id });
    }
  if (new Set(found.map((x) => x.family)).size !== 1) return [];
  return found.map((x) => ({ kind: "child", person: x.child, family: x.family }));
}

/**
 * The links of a variant the tree records already: those it was given that the tree has since, or — a variant nobody
 * gave any — the one its words say of the tree as it is. None to make: the hypothesis stays open until the records
 * decide it (never decided by strom).
 */
export function recordedLinks(tree: Tree, h: Hypothesis, v: HypothesisVariant): VariantLink[] {
  if (h.state !== "open") return [];
  if (v.links?.length) return v.links.filter((l) => linkInTree(tree, l));
  // links taken off: somebody said what it connects — never read again from its words
  if (v.linked?.length) return [];
  return claimInTree(tree, h, v);
}

/** What strom says of a variant the tree records already: "the tree records this already: child P0006 of F0001". */
export function recordedText(links: VariantLink[]): string {
  return `the tree records this already: ${links.map(linkText).join(" · ")} — no link to make; open until the records decide it`;
}

// ── once per research ──────────────────────────────────────────────────────

/** The marker in strom.json: the variants' links filled in once (an optional field: an older strom keeps it). */
export const HYPOTHESIS_LINKS_SETTLED = "hypothesis-links";
/** Where a task to fill in what the variants would connect comes from. */
export const HYPOTHESIS_LINKS_ORIGIN = "hypothesis:links";
/** Hypotheses in one task: the work is short — reading the variants and a command each. */
export const HYPOTHESIS_LINKS_BATCH = 10;

const PERSON_ID = /(?<![\p{L}\p{M}\p{N}])P\d{4,}(?![\p{L}\p{M}\p{N}])/gu;

/** A variant nobody said anything of yet: no links, none ever (taken off: somebody decided). */
const untouched = (v: HypothesisVariant) => !v.links?.length && !v.linked?.length;

/** Whether a variant's words name people of the tree a link could join: someone besides the subject, or two. */
function namesPeople(tree: Tree, h: Hypothesis, v: HypothesisVariant): boolean {
  const named = [...new Set(v.claim.normalize("NFC").match(PERSON_ID) ?? [])].filter((id) => {
    const p = tree.get<Person>(id);
    return p?.type === "person" && !p.retracted;
  });
  if (!named.length) return false;
  const subject = h.subject.filter((s) => typeOfId(s) === "person");
  return new Set([...named, ...subject]).size >= 2;
}

/**
 * A variant to say links of: nobody did yet, its words name people of the tree a link could join, and what they say is
 * not what the tree records already (that one has no link to make).
 */
export function toLink(tree: Tree, h: Hypothesis, v: HypothesisVariant): boolean {
  return untouched(v) && namesPeople(tree, h, v) && !recordedLinks(tree, h, v).length;
}

/** The open hypotheses nobody has said any links of yet (written before strom hypothesis link). */
function olderHypotheses(tree: Tree): Hypothesis[] {
  return tree.list<Hypothesis>("hypothesis").filter((h) => h.state === "open" && !h.retracted && !h.mergedInto && h.variants.every(untouched));
}

export interface SettledLinks {
  linked: { hypothesis: string; variant: string; link: VariantLink; claim: string }[];
  tasks: { id: string; hypotheses: string[] }[];
}

const shortText = (t: string, n: number) => ([...t].length > n ? `${[...t].slice(0, n - 1).join("")}…` : t);

/**
 * Once per research: the links of the variants of older open hypotheses filled in where their claims say them beyond
 * doubt (each written as strom hypothesis link writes it, with the reason), the rest a task for the agent (one for up
 * to HYPOTHESIS_LINKS_BATCH hypotheses, never twice for one), the marker in strom.json — in one commit. Nothing to do:
 * nothing written (looked at again next time, cheaply). Skipped while somebody is at work on the tree or holds its
 * lock, and while strom may not write it unasked — another computer's seal waiting for the person's adoption, data
 * changed outside strom (next time); never in a dry run. A failure on the way leaves nothing written.
 */
export function settleHypothesisLinks(tree: Tree): SettledLinks | undefined {
  if (tree.dryRun) return undefined;
  if (tree.config.settled?.includes(HYPOTHESIS_LINKS_SETTLED)) return undefined;
  if (!olderHypotheses(tree).some((h) => h.variants.some((v) => toLink(tree, h, v)))) return undefined;
  // somebody at work on it (an agent present, a run) or holding its lock: next time
  if (liveWorkers(tree.root).length || runsAtWork(tree.root).length || liveHolder(path.join(tree.root, ".strom", "tree.lock"))) return undefined;
  // another computer's seal (a copy, a research brought here): the person adopts it first — nothing written till then
  if (!tree.key) return undefined;
  let out: SettledLinks | undefined;
  tree.atomically(() => {
    // read afresh under the lock: another strom may have written it meanwhile
    if (!freshConfig(tree)) return;
    if (tree.config.settled?.includes(HYPOTHESIS_LINKS_SETTLED)) return;
    if (!writableUnasked(tree)) return;
    const result: SettledLinks = { linked: [], tasks: [] };
    const older = olderHypotheses(tree);
    for (const h of older) {
      const found = h.variants.filter(untouched).map((v) => ({ v, link: claimLink(tree, h, v) }));
      // two variants saying the same link: what tells them apart is not a link — neither
      const keys = found.filter((f) => f.link).map((f) => linkKey(f.link!));
      for (const { v, link } of found) {
        if (!link || keys.filter((k) => k === linkKey(link)).length > 1) continue;
        const reason = `read from the claim of ${h.id} ${v.label} by strom ${VERSION} ("${shortText(v.claim, 80)}"); not what it would connect: strom hypothesis link ${h.id} ${v.label} --remove`;
        try {
          writeVariantLink(tree, h.id, v.label, link, { reason });
          result.linked.push({ hypothesis: h.id, variant: v.label, link, claim: v.claim });
        } catch (e) {
          if (!(e instanceof UsageError)) throw e;
        }
      }
    }
    // the rest: a variant whose words name people, still without links — for the agent; one that says what the tree
    // records already is no link to make (strom hypothesis link refuses it)
    const tasks = tree.list<Task>("task").filter((t) => t.origin === HYPOTHESIS_LINKS_ORIGIN);
    const rest = older
      .map((h) => tree.get<Hypothesis>(h.id)!)
      .filter((h) => h.variants.some((v) => toLink(tree, h, v)))
      .filter((h) => !tasks.some((t) => t.subject.includes(h.id)))
      .map((h) => h.id);
    for (let i = 0; i < rest.length; i += HYPOTHESIS_LINKS_BATCH) {
      const batch = rest.slice(i, i + HYPOTHESIS_LINKS_BATCH);
      const list = batch.join(", ");
      const t = create<Task>(
        tree,
        "task",
        {
          level: "enrich",
          priority: 2,
          what: phrase(tree.lang, "hypothesis.links.what", { list }),
          where: batch,
          why: phrase(tree.lang, "hypothesis.links.why"),
          doneWhen: phrase(tree.lang, "hypothesis.links.done", { first: batch[0]! }),
          subject: batch,
          state: "open",
          origin: HYPOTHESIS_LINKS_ORIGIN,
        } as never,
        (id) => `+${id} task "say what the variants of ${list} would connect"`,
      );
      result.tasks.push({ id: t.id, hypotheses: batch });
    }
    if (!result.linked.length && !result.tasks.length) return;
    tree.updateConfig(
      (c) => {
        c.settled = [...new Set([...(c.settled ?? []), HYPOTHESIS_LINKS_SETTLED])];
      },
      { op: "tree.settle", summary: "the links of the hypotheses' variants filled in once" },
    );
    const linked = result.linked.map((l) => `${l.hypothesis} ${l.variant}: ${linkText(l.link)}`).join(", ");
    const left = result.tasks.map((t) => `${t.id} (${t.hypotheses.join(", ")})`).join(", ");
    tree.commit(
      result.linked.length
        ? `Links of hypothesis variants filled in from their claims (${linked})${left ? `; the rest for the agent: ${left}` : ""}`
        : `Links of hypothesis variants left to the agent: ${left}`,
    );
    out = result;
  });
  return out;
}

/**
 * strom.json as it is on disk now (another strom may have written it since this one opened the tree): what is written
 * next is written on top of that, never of what this one read before. False: unreadable — nothing written.
 */
function freshConfig(tree: Tree): boolean {
  let now: Record<string, unknown>;
  try {
    now = readJson<Record<string, unknown>>(path.join(tree.root, TREE_FILE));
  } catch {
    return false;
  }
  if (!now || typeof now !== "object" || now.id !== tree.config.id) return false;
  const cfg = tree.config as unknown as Record<string, unknown>;
  for (const k of Object.keys(cfg)) delete cfg[k];
  Object.assign(cfg, now);
  return true;
}

/** The hint after a variant is recorded: what to run so the Strom app shows what it would connect. */
export function linkHints(tree: Tree, h: Hypothesis, labels: string[]): string[] {
  const out: string[] = [];
  for (const label of labels) {
    const v = h.variants.find((x) => x.label === label);
    if (!v || v.links?.length || !namesPeople(tree, h, v)) continue;
    const recorded = recordedLinks(tree, h, v);
    if (recorded.length) {
      out.push(`${label}: ${recordedText(recorded)}`);
      continue;
    }
    const link = claimLink(tree, h, v);
    out.push(
      link
        ? `${label} names its people only in words — if it says ${linkText(link)}: strom hypothesis link ${h.id} ${label} ${linkOptions(link)}`
        : `${label} names its people only in words — say what it would connect: strom hypothesis link ${h.id} ${label} ${LINK_HOW} (none when it connects nothing clear)`,
    );
  }
  return out;
}
