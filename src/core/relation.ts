// How one person is related to another, in words: the Strom app's kinship calculator (its src/kinship.ts,
// findRelationship) over the research's families, with its terms in Czech, English, German and Polish word for word —
// a relation the research says is the one the app's relationship finder says. Beyond the app: the side of the family
// (father's or mother's) and the generation (as `strom stats` counts them: the person 1, the parents 2, …).
//
// Blood relations come from the closest common ancestor: `from` is m generations below it, `to` n generations. Ties
// through one marriage on either end, or one on each end (the husband of the husband's sister), are in-law relations;
// any other tie through marriages is "related by marriage", never no relation. Retracted persons and families are not
// there at all; a family of two parents who are no couple (noCouple) gives no partners, as in the app.
//
// The research keeps no end date of a union: a couple counts as ended (an ex-husband) when the family's union is
// divorced or separated, or when a divorce or annulment of it stands — unless a marriage of the two is dated after the
// last of them (they married again), as the app reads such a family from its file.

import { dateYears } from "./gdate.ts";
import type { Event, Family, Person } from "./model.ts";
import { familiesAsChild, familiesAsPartner, relationTo } from "./people.ts";
import type { Tree } from "./tree.ts";

export type Side = "father" | "mother";

/** A relation's name in the four languages of the Strom app. */
export interface RelationTerm {
  cs: string;
  en: string;
  de: string;
  pl: string;
}

export interface Relation {
  /** What `to` is to `from` ("prapraděd"), the app's words. */
  term: RelationTerm;
  /**
   * The side of `from`'s family the relation goes through: relatives through `from`'s ancestors (grandparents and
   * up, uncles, cousins, a half-sibling through one parent, the partners of those). None for the parents themselves
   * (the term says it), descendants, partners, full siblings and their line, the partner's family, a parent of
   * unknown sex, or an ancestor reached through both parents.
   */
  side?: Side;
  /**
   * The generation as strom counts ancestors (`from` 1, parents 2, grandparents 3, children 0, grandchildren −1):
   * 1 + m − n for a blood relation; for an in-law one by its blood part (a partner is `from`'s generation, a partner
   * of a relative the relative's).
   */
  generation?: number;
  /** The persons from `from` to `to`, both included. */
  path: string[];
  /** A blood relation: no marriage on the way and no adoptive, step or foster link. */
  blood: boolean;
  /** The relation goes through a partnership (in-law, a partner, related by marriage). */
  affinity: boolean;
  /** A link of the path is adoptive, step or foster: the term says "(adoptive line)". */
  adoptive: boolean;
}

const MAX_DEPTH = 20;

interface AncestorEntry {
  depth: number;
  /** From the person up to (and including) the ancestor. */
  path: string[];
}

interface Parent {
  id: string;
  /** Born to them (or not said otherwise): not adoptive, step or foster. */
  natural: boolean;
}

/** The research's families as the app's persons see them: parents, partners, sex. Read once per person. */
class Graph {
  private parentsOf = new Map<string, Parent[]>();
  private partnersOf = new Map<string, string[]>();
  private tree: Tree;

  constructor(tree: Tree) {
    this.tree = tree;
  }

  person(id: string): Person | undefined {
    const p = this.tree.get<Person>(id);
    return p && p.type === "person" && !p.retracted ? p : undefined;
  }

  parents(id: string): Parent[] {
    let out = this.parentsOf.get(id);
    if (out) return out;
    out = [];
    for (const f of familiesAsChild(this.tree, id)) {
      const link = f.children.find((c) => c.person === id);
      if (!link) continue;
      for (const pid of f.partners) {
        if (pid === id || !this.person(pid)) continue;
        const rel = relationTo(link, pid);
        const natural = rel === "birth" || rel === "unknown";
        const had = out.find((p) => p.id === pid);
        if (had) had.natural ||= natural;
        else out.push({ id: pid, natural });
      }
    }
    this.parentsOf.set(id, out);
    return out;
  }

  partners(id: string): string[] {
    let out = this.partnersOf.get(id);
    if (out) return out;
    out = [];
    for (const f of familiesAsPartner(this.tree, id)) {
      if (f.noCouple) continue;
      for (const other of f.partners) if (other !== id && !out.includes(other) && this.person(other)) out.push(other);
    }
    this.partnersOf.set(id, out);
    return out;
  }

  sex(id: string): "M" | "F" | "U" {
    return this.person(id)?.sex ?? "U";
  }

  /** Every union of the two ended (divorced, separated, a divorce standing): an ex-partner. */
  unionsEnded(a: string, b: string): boolean {
    const unions = familiesAsPartner(this.tree, a).filter((f) => !f.noCouple && f.partners.includes(b));
    return unions.length > 0 && unions.every(ended);
  }

  /** Is a link of the path between a child and a parent adoptive, step or foster? */
  pathHasNonBiologicalLink(path: string[]): boolean {
    for (let i = 0; i + 1 < path.length; i++) {
      const a = path[i]!;
      const b = path[i + 1]!;
      const up = this.parents(a).find((p) => p.id === b);
      if (up && !up.natural) return true;
      const down = this.parents(b).find((p) => p.id === a);
      if (down && !down.natural) return true;
    }
    return false;
  }

  /** BFS upward: all ancestors of a person with depth and path (the person itself at depth 0). */
  ancestors(start: string): Map<string, AncestorEntry> {
    const result = new Map<string, AncestorEntry>([[start, { depth: 0, path: [start] }]]);
    let frontier = [start];
    for (let depth = 1; depth <= MAX_DEPTH && frontier.length > 0; depth++) {
      const next: string[] = [];
      for (const pid of frontier) {
        const entry = result.get(pid)!;
        for (const parent of this.parents(pid)) {
          if (result.has(parent.id)) continue;
          result.set(parent.id, { depth, path: [...entry.path, parent.id] });
          next.push(parent.id);
        }
      }
      frontier = next;
    }
    return result;
  }
}

function live(e: Event): boolean {
  return !e.retracted && e.status !== "disproven" && e.status !== "retracted";
}

function ended(f: Family): boolean {
  if (f.union === "divorced" || f.union === "separated") return true;
  const ends = f.events.filter((e) => live(e) && (e.kind === "DIV" || e.kind === "ANUL"));
  if (ends.length === 0) return false;
  const lastEnd = Math.max(...ends.flatMap((e) => dateYears(e.date ?? "")), -Infinity);
  const marriedAgain = f.events.some((e) => live(e) && e.kind === "MARR" && dateYears(e.date ?? "").some((y) => y > lastEnd));
  return !marriedAgain;
}

// ── terms (the app's, word for word) ────────────────────────────────────────

type Sex = "M" | "F" | "U";

function bySex(sex: Sex, male: RelationTerm, female: RelationTerm, unknown: RelationTerm): RelationTerm {
  return sex === "M" ? male : sex === "F" ? female : unknown;
}

function pra(n: number): string {
  return "pra".repeat(n);
}
function great(n: number): string {
  return "great-".repeat(n);
}
/** German "Ur" k times on a lowercase base: ur(0, "großvater") = "Großvater", ur(2, …) = "Ururgroßvater". */
function ur(k: number, base: string): string {
  if (k <= 0) return base.charAt(0).toUpperCase() + base.slice(1);
  return "Ur" + "ur".repeat(k - 1) + base;
}

function either(male: RelationTerm, female: RelationTerm): RelationTerm {
  return { cs: `${male.cs} / ${female.cs}`, en: `${male.en} / ${female.en}`, de: `${male.de} / ${female.de}`, pl: `${male.pl} / ${female.pl}` };
}

function ordinalEn(n: number): string {
  if (n === 1) return "first";
  if (n === 2) return "second";
  if (n === 3) return "third";
  return `${n}th`;
}

/** The blood term for `to` m steps below the common ancestor from `from`'s side and n from `to`'s. */
function bloodTerm(m: number, n: number, sex: Sex): RelationTerm {
  const t = (male: RelationTerm, female: RelationTerm, unknown: RelationTerm) => bySex(sex, male, female, unknown);
  if (n === 0) {
    if (m === 1) return t({ cs: "otec", en: "father", de: "Vater", pl: "ojciec" }, { cs: "matka", en: "mother", de: "Mutter", pl: "matka" }, { cs: "rodič", en: "parent", de: "Elternteil", pl: "rodzic" });
    if (m === 2)
      return t(
        { cs: "děd", en: "grandfather", de: "Großvater", pl: "dziadek" },
        { cs: "babička", en: "grandmother", de: "Großmutter", pl: "babcia" },
        { cs: "prarodič", en: "grandparent", de: "Großelternteil", pl: "dziadek / babcia" },
      );
    return t(
      { cs: `${pra(m - 2)}děd`, en: `${great(m - 2)}grandfather`, de: ur(m - 2, "großvater"), pl: `${pra(m - 2)}dziadek` },
      { cs: `${pra(m - 2)}babička`, en: `${great(m - 2)}grandmother`, de: ur(m - 2, "großmutter"), pl: `${pra(m - 2)}babcia` },
      { cs: `${pra(m - 2)}prarodič`, en: `${great(m - 2)}grandparent`, de: ur(m - 2, "großelternteil"), pl: `${pra(m - 2)}dziadek / ${pra(m - 2)}babcia` },
    );
  }
  if (m === 0) {
    if (n === 1) return t({ cs: "syn", en: "son", de: "Sohn", pl: "syn" }, { cs: "dcera", en: "daughter", de: "Tochter", pl: "córka" }, { cs: "dítě", en: "child", de: "Kind", pl: "dziecko" });
    if (n === 2)
      return t(
        { cs: "vnuk", en: "grandson", de: "Enkel", pl: "wnuk" },
        { cs: "vnučka", en: "granddaughter", de: "Enkelin", pl: "wnuczka" },
        { cs: "vnouče", en: "grandchild", de: "Enkelkind", pl: "wnuk / wnuczka" },
      );
    return t(
      { cs: `${pra(n - 2)}vnuk`, en: `${great(n - 2)}grandson`, de: ur(n - 2, "enkel"), pl: `${pra(n - 2)}wnuk` },
      { cs: `${pra(n - 2)}vnučka`, en: `${great(n - 2)}granddaughter`, de: ur(n - 2, "enkelin"), pl: `${pra(n - 2)}wnuczka` },
      { cs: `${pra(n - 2)}vnouče`, en: `${great(n - 2)}grandchild`, de: ur(n - 2, "enkelkind"), pl: `${pra(n - 2)}wnuk / ${pra(n - 2)}wnuczka` },
    );
  }
  if (m === 1 && n === 1)
    return t({ cs: "bratr", en: "brother", de: "Bruder", pl: "brat" }, { cs: "sestra", en: "sister", de: "Schwester", pl: "siostra" }, { cs: "sourozenec", en: "sibling", de: "Geschwister", pl: "brat / siostra" });
  if (n === 1) {
    if (m === 2)
      return t(
        { cs: "strýc", en: "uncle", de: "Onkel", pl: "wujek" },
        { cs: "teta", en: "aunt", de: "Tante", pl: "ciotka" },
        { cs: "strýc / teta", en: "uncle / aunt", de: "Onkel / Tante", pl: "wujek / ciotka" },
      );
    // "granduncle" holds one grand- already: the great- count is m − 3 (so is the German Großonkel's Ur-)
    const male = { cs: `${pra(m - 2)}strýc`, en: `${great(m - 3)}granduncle`, de: ur(m - 3, "großonkel"), pl: `brat ${pra(m - 3)}dziadka / ${pra(m - 3)}babci` };
    const female = { cs: `${pra(m - 2)}teta`, en: `${great(m - 3)}grandaunt`, de: ur(m - 3, "großtante"), pl: `siostra ${pra(m - 3)}dziadka / ${pra(m - 3)}babci` };
    return t(male, female, either(male, female));
  }
  if (m === 1) {
    if (n === 2)
      return t(
        { cs: "synovec", en: "nephew", de: "Neffe", pl: "bratanek / siostrzeniec" },
        { cs: "neteř", en: "niece", de: "Nichte", pl: "bratanica / siostrzenica" },
        { cs: "synovec / neteř", en: "nephew / niece", de: "Neffe / Nichte", pl: "dziecko rodzeństwa" },
      );
    const male = { cs: `${pra(n - 2)}synovec`, en: `${great(n - 3)}grandnephew`, de: ur(n - 3, "großneffe"), pl: `${pra(n - 3)}wnuk rodzeństwa` };
    const female = { cs: `${pra(n - 2)}neteř`, en: `${great(n - 3)}grandniece`, de: ur(n - 3, "großnichte"), pl: `${pra(n - 3)}wnuczka rodzeństwa` };
    return t(male, female, either(male, female));
  }
  // cousins: m, n ≥ 2
  const degree = Math.min(m, n) - 1;
  const removal = Math.abs(m - n);
  const csBase = sex === "M" ? "bratranec" : sex === "F" ? "sestřenice" : "bratranec / sestřenice";
  const deBase = sex === "M" ? "Cousin" : sex === "F" ? "Cousine" : "Cousin / Cousine";
  const plBase = sex === "M" ? "kuzyn" : sex === "F" ? "kuzynka" : "kuzyn / kuzynka";
  const csDegree = degree === 1 ? csBase : `${csBase} ${degree}. stupně`;
  const plDegree = degree === 1 ? plBase : `${plBase} ${degree}. stopnia`;
  const enDegree = `${ordinalEn(degree)} cousin`;
  const deDegree = degree === 1 ? deBase : `${deBase} ${degree}. Grades`;
  if (removal === 0) return { cs: csDegree, en: enDegree, de: deDegree, pl: plDegree };
  const plFew = removal % 10 >= 2 && removal % 10 <= 4 && !(removal % 100 >= 12 && removal % 100 <= 14);
  return {
    cs: `${csDegree} (posunutí o ${removal} ${removal === 1 ? "generaci" : removal <= 4 ? "generace" : "generací"})`,
    en: `${enDegree} ${removal === 1 ? "once" : removal === 2 ? "twice" : `${removal} times`} removed`,
    de: `${deDegree} (um ${removal} ${removal === 1 ? "Generation" : "Generationen"} versetzt)`,
    pl: `${plDegree} (przesunięcie o ${removal} ${removal === 1 ? "pokolenie" : plFew ? "pokolenia" : "pokoleń"})`,
  };
}

/** Close in-law terms through one marriage; null where the app has none (the blood term with the partner then). */
function affinityTerm(viaPartnerOfFrom: boolean, m: number, n: number, sex: Sex): RelationTerm | null {
  const t = (male: RelationTerm, female: RelationTerm, unknown: RelationTerm) => bySex(sex, male, female, unknown);
  if (viaPartnerOfFrom) {
    if (n === 0 && m === 1)
      return t(
        { cs: "tchán", en: "father-in-law", de: "Schwiegervater", pl: "teść" },
        { cs: "tchyně", en: "mother-in-law", de: "Schwiegermutter", pl: "teściowa" },
        { cs: "tchán / tchyně", en: "parent-in-law", de: "Schwiegerelternteil", pl: "teść / teściowa" },
      );
    if (m === 1 && n === 1) return siblingInLaw(sex);
    if (m === 0 && n === 1)
      return t(
        { cs: "nevlastní syn", en: "stepson", de: "Stiefsohn", pl: "pasierb" },
        { cs: "nevlastní dcera", en: "stepdaughter", de: "Stieftochter", pl: "pasierbica" },
        { cs: "nevlastní dítě", en: "stepchild", de: "Stiefkind", pl: "pasierb / pasierbica" },
      );
  } else {
    if (m === 0 && n === 1)
      return t(
        { cs: "zeť", en: "son-in-law", de: "Schwiegersohn", pl: "zięć" },
        { cs: "snacha", en: "daughter-in-law", de: "Schwiegertochter", pl: "synowa" },
        { cs: "zeť / snacha", en: "child-in-law", de: "Schwiegerkind", pl: "zięć / synowa" },
      );
    if (m === 1 && n === 1) return siblingInLaw(sex);
    if (m === 2 && n === 1)
      return t(
        { cs: "strýc (přiženěný)", en: "uncle (by marriage)", de: "Onkel (angeheiratet)", pl: "wujek (przez małżeństwo)" },
        { cs: "teta (přivdaná)", en: "aunt (by marriage)", de: "Tante (angeheiratet)", pl: "ciotka (przez małżeństwo)" },
        { cs: "strýc / teta (sňatkem)", en: "uncle / aunt (by marriage)", de: "Onkel / Tante (angeheiratet)", pl: "wujek / ciotka (przez małżeństwo)" },
      );
    if (m === 1 && n === 0)
      return t(
        { cs: "nevlastní otec", en: "stepfather", de: "Stiefvater", pl: "ojczym" },
        { cs: "nevlastní matka", en: "stepmother", de: "Stiefmutter", pl: "macocha" },
        { cs: "nevlastní rodič", en: "stepparent", de: "Stiefelternteil", pl: "ojczym / macocha" },
      );
  }
  return null;
}

function siblingInLaw(sex: Sex): RelationTerm {
  return bySex(
    sex,
    { cs: "švagr", en: "brother-in-law", de: "Schwager", pl: "szwagier" },
    { cs: "švagrová", en: "sister-in-law", de: "Schwägerin", pl: "szwagierka" },
    { cs: "švagr / švagrová", en: "sibling-in-law", de: "Schwager / Schwägerin", pl: "szwagier / szwagierka" },
  );
}

function relatedByMarriage(sex: Sex): RelationTerm {
  return bySex(
    sex,
    { cs: "příbuzný sňatkem", en: "related by marriage", de: "verschwägert", pl: "spowinowacony" },
    { cs: "příbuzná sňatkem", en: "related by marriage", de: "verschwägert", pl: "spowinowacona" },
    { cs: "příbuzný / příbuzná sňatkem", en: "related by marriage", de: "verschwägert", pl: "spowinowacony / spowinowacona" },
  );
}

const halfSibling = (sex: Sex) =>
  bySex(
    sex,
    { cs: "polorodý bratr", en: "half-brother", de: "Halbbruder", pl: "brat przyrodni" },
    { cs: "polorodá sestra", en: "half-sister", de: "Halbschwester", pl: "siostra przyrodnia" },
    { cs: "polorodý sourozenec", en: "half-sibling", de: "Halbgeschwister", pl: "rodzeństwo przyrodnie" },
  );

/** An English noun phrase with its indefinite article ("a niece", "an uncle"). */
function indefiniteEn(phrase: string): string {
  return `${/^[aeiou]/i.test(phrase) ? "an" : "a"} ${phrase}`;
}

// ── the search ──────────────────────────────────────────────────────────────

interface BloodRelation {
  m: number;
  n: number;
  path: string[];
  commonAncestors: string[];
}

/** The closest blood relation (smallest m + n, then the smaller of the two farthest), as the app picks it. */
function bloodBetween(aAnc: Map<string, AncestorEntry>, bAnc: Map<string, AncestorEntry>): BloodRelation | undefined {
  let best: BloodRelation | undefined;
  for (const [ancestor, aEntry] of aAnc) {
    const bEntry = bAnc.get(ancestor);
    if (!bEntry) continue;
    const m = aEntry.depth;
    const n = bEntry.depth;
    if (!best || m + n < best.m + best.n || (m + n === best.m + best.n && Math.max(m, n) < Math.max(best.m, best.n))) {
      best = { m, n, path: [...aEntry.path, ...bEntry.path.slice(0, -1).reverse()], commonAncestors: [ancestor] };
    } else if (m + n === best.m + best.n && m === best.m && n === best.n && !best.commonAncestors.includes(ancestor)) {
      best.commonAncestors.push(ancestor); // the other one of the ancestor couple: a full relation, not a half one
    }
  }
  return best;
}

/** Where a relation's geometry comes from: a blood part seen from `from` (sides count) or from a partner (none). */
interface Found {
  term: RelationTerm;
  path: string[];
  affinity: boolean;
  generation: number;
  /** The blood part starts at `from` itself: its side can be told. */
  fromSide?: BloodRelation;
}

/** One person's view of the tree: their ancestors, partners and the sides of their family read once. */
class From {
  readonly id: string;
  private g: Graph;
  private anc: Map<string, AncestorEntry>;
  private partnerAnc = new Map<string, Map<string, AncestorEntry>>();
  private sides: Map<string, Set<Side | "?">>;

  constructor(g: Graph, id: string) {
    this.g = g;
    this.id = id;
    this.anc = g.ancestors(id);
    for (const p of g.partners(id)) this.partnerAnc.set(p, g.ancestors(p));
    this.sides = new Map();
    for (const parent of g.parents(id)) {
      const sex = g.sex(parent.id);
      const side: Side | "?" = sex === "M" ? "father" : sex === "F" ? "mother" : "?";
      for (const a of g.ancestors(parent.id).keys()) {
        const s = this.sides.get(a) ?? new Set<Side | "?">();
        s.add(side);
        this.sides.set(a, s);
      }
    }
  }

  relation(to: string): Relation | undefined {
    if (to === this.id || !this.g.person(this.id) || !this.g.person(to)) return undefined;
    const found = this.find(to);
    if (!found) return undefined;
    const adoptive = this.g.pathHasNonBiologicalLink(found.path);
    const term = adoptive
      ? { cs: `${found.term.cs} (adoptivní linie)`, en: `${found.term.en} (adoptive line)`, de: `${found.term.de} (Adoptivlinie)`, pl: `${found.term.pl} (linia adopcyjna)` }
      : found.term;
    const side = found.fromSide ? this.sideOf(found.fromSide) : undefined;
    return {
      term,
      ...(side ? { side } : {}),
      generation: found.generation,
      path: found.path,
      blood: !found.affinity && !adoptive,
      affinity: found.affinity,
      adoptive,
    };
  }

  /** The side of a blood part from `from`: through one parent's ancestors, or a half-sibling's one parent. */
  private sideOf(rel: BloodRelation): Side | undefined {
    if (rel.m === 0 || (rel.m === 1 && rel.n === 0)) return undefined;
    if (rel.m === 1) {
      // through a sibling: a side only when the sibling is a half one (both with two parents, not the same two)
      if (rel.commonAncestors.length !== 1) return undefined;
      const mine = this.g.parents(this.id).map((p) => p.id);
      const theirs = this.g.parents(rel.path[2]!).map((p) => p.id);
      if (mine.length !== 2 || theirs.length !== 2 || mine.every((p) => theirs.includes(p))) return undefined;
      const sex = this.g.sex(rel.commonAncestors[0]!);
      return sex === "M" ? "father" : sex === "F" ? "mother" : undefined;
    }
    const all = new Set<Side | "?">();
    for (const a of rel.commonAncestors) for (const s of this.sides.get(a) ?? []) all.add(s);
    if (all.size !== 1) return undefined;
    const [only] = all;
    return only === "?" ? undefined : only;
  }

  private find(to: string): Found | undefined {
    const g = this.g;
    const b = to;
    const bSex = g.sex(b);

    // 1. partners: every union of theirs ended → an ex-partner
    if (g.partners(this.id).includes(b)) {
      const term = g.unionsEnded(this.id, b)
        ? bySex(
            bSex,
            { cs: "bývalý manžel / partner", en: "ex-husband / ex-partner", de: "Ex-Ehemann / Ex-Partner", pl: "były mąż / partner" },
            { cs: "bývalá manželka / partnerka", en: "ex-wife / ex-partner", de: "Ex-Ehefrau / Ex-Partnerin", pl: "była żona / partnerka" },
            { cs: "bývalý choť / partner", en: "ex-spouse / ex-partner", de: "Ex-Ehepartner / Ex-Partner", pl: "były małżonek / partner" },
          )
        : bySex(
            bSex,
            { cs: "manžel / partner", en: "husband / partner", de: "Ehemann / Partner", pl: "mąż / partner" },
            { cs: "manželka / partnerka", en: "wife / partner", de: "Ehefrau / Partnerin", pl: "żona / partnerka" },
            { cs: "choť / partner", en: "spouse / partner", de: "Ehepartner / Partner", pl: "małżonek / partner" },
          );
      return { term, path: [this.id, b], affinity: true, generation: 1 };
    }

    // 2. blood
    const bAnc = g.ancestors(b);
    const blood = bloodBetween(this.anc, bAnc);
    if (blood) {
      let term = bloodTerm(blood.m, blood.n, bSex);
      // half siblings: one shared parent, and both with two known parents that differ (a parent missing: siblings)
      if (blood.m === 1 && blood.n === 1 && blood.commonAncestors.length === 1) {
        const aParents = g.parents(this.id).map((p) => p.id);
        const bParents = g.parents(b).map((p) => p.id);
        if (aParents.length === 2 && bParents.length === 2 && !aParents.every((p) => bParents.includes(p))) term = halfSibling(bSex);
      }
      return { term, path: blood.path, affinity: false, generation: 1 + blood.m - blood.n, fromSide: blood };
    }

    // ties through marriage too far for a word of their own: the closest one is "related by marriage"
    let fallback: { score: number; found: Found } | undefined;
    const offer = (rel: BloodRelation, hops: number, found: Found) => {
      const score = rel.m + rel.n + hops;
      if (!fallback || score < fallback.score) fallback = { score, found };
    };
    const married = relatedByMarriage(bSex);

    // 3. `to` is a blood relative of a partner of `from`
    for (const [partner, pAnc] of this.partnerAnc) {
      const rel = bloodBetween(pAnc, bAnc);
      if (!rel) continue;
      const generation = 1 + rel.m - rel.n;
      if (rel.m + rel.n > 6) {
        offer(rel, 1, { term: married, path: [this.id, ...rel.path], affinity: true, generation });
        continue;
      }
      const special = affinityTerm(true, rel.m, rel.n, bSex);
      const partnerLabel = bySex(
        g.sex(partner),
        { cs: "manžela", en: "husband's", de: "des Ehemanns", pl: "męża" },
        { cs: "manželky", en: "wife's", de: "der Ehefrau", pl: "żony" },
        { cs: "chotě", en: "spouse's", de: "des Ehepartners", pl: "małżonka" },
      );
      const desc = bloodTerm(rel.m, rel.n, bSex);
      const term = special ?? { cs: `${desc.cs} ${partnerLabel.cs}`, en: `${partnerLabel.en} ${desc.en}`, de: `${desc.de} ${partnerLabel.de}`, pl: `${desc.pl} ${partnerLabel.pl}` };
      return { term, path: [this.id, ...rel.path], affinity: true, generation };
    }

    // 4. `to` is the partner of a blood relative of `from`
    const bPartners = g.partners(b);
    const bPartnerAnc = new Map(bPartners.map((p) => [p, g.ancestors(p)] as const));
    for (const [partner, pAnc] of bPartnerAnc) {
      const rel = bloodBetween(this.anc, pAnc);
      if (!rel) continue;
      const generation = 1 + rel.m - rel.n;
      if (rel.m + rel.n > 6) {
        offer(rel, 1, { term: married, path: [...rel.path, b], affinity: true, generation, fromSide: rel });
        continue;
      }
      const special = affinityTerm(false, rel.m, rel.n, bSex);
      const desc = bloodTerm(rel.m, rel.n, g.sex(partner));
      const ofRel = `of ${indefiniteEn(desc.en)}`;
      const term =
        special ??
        bySex(
          bSex,
          { cs: `manžel — ${desc.cs}`, en: `husband ${ofRel}`, de: `Ehemann — ${desc.de}`, pl: `mąż – ${desc.pl}` },
          { cs: `manželka — ${desc.cs}`, en: `wife ${ofRel}`, de: `Ehefrau — ${desc.de}`, pl: `żona – ${desc.pl}` },
          { cs: `choť — ${desc.cs}`, en: `spouse ${ofRel}`, de: `Ehepartner — ${desc.de}`, pl: `małżonek – ${desc.pl}` },
        );
      return { term, path: [...rel.path, b], affinity: true, generation, fromSide: rel };
    }

    // 5. through two marriages: `to` is the partner of a blood relative of a partner of `from` (not of the same one)
    for (const [aPartner, aAnc] of this.partnerAnc) {
      for (const [bPartner, pAnc] of bPartnerAnc) {
        if (aPartner === bPartner) continue;
        const rel = bloodBetween(aAnc, pAnc);
        if (!rel) continue;
        const path = [this.id, ...rel.path, b];
        const generation = 1 + rel.m - rel.n;
        if (rel.m === 1 && rel.n === 1) return { term: siblingInLaw(bSex), path, affinity: true, generation };
        offer(rel, 2, { term: married, path, affinity: true, generation });
      }
    }

    return (fallback as { score: number; found: Found } | undefined)?.found;
  }
}

/** How `to` is related to `from` ("`to` is `from`'s …"); undefined for the same person or persons not connected. */
export function relationBetween(tree: Tree, from: string, to: string): Relation | undefined {
  return relationsFrom(tree, from)(to);
}

/**
 * Relations of many persons to one: `from`'s ancestors, partners and the sides of the family read once, each
 * person then only up their own ancestors (no walk over the whole tree per person).
 */
export function relationsFrom(tree: Tree, from: string): (to: string) => Relation | undefined {
  const g = new Graph(tree);
  if (!g.person(from)) return () => undefined;
  const view = new From(g, from);
  return (to) => view.relation(to);
}

const SIDE_WORDS: Record<keyof RelationTerm, Record<Side, string>> = {
  cs: { father: "z otcovy strany", mother: "z matčiny strany" },
  en: { father: "father's side", mother: "mother's side" },
  de: { father: "väterlicherseits", mother: "mütterlicherseits" },
  pl: { father: "ze strony ojca", mother: "ze strony matki" },
};

function termLang(lang: string): keyof RelationTerm {
  const l = lang.toLowerCase().slice(0, 2);
  return l === "cs" || l === "de" || l === "pl" ? l : "en";
}

/** A relation in words of a language (cs, en, de, pl; any other English): "prapraděd, z otcovy strany". */
export function relationText(r: Relation, lang: string): string {
  const l = termLang(lang);
  return r.side ? `${r.term[l]}, ${SIDE_WORDS[l][r.side]}` : r.term[l];
}

/** The word of a side in a language (cs, en, de, pl; any other English). */
export function sideText(side: Side, lang: string): string {
  return SIDE_WORDS[termLang(lang)][side];
}
