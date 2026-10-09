// Who a tree is about: its main person (first in the GEDCOM files — the Strom
// app opens on them), and how near anyone is to the people the research is
// for (which entries get their image in the Strom app first).

import type { Hypothesis, Person, Research, Task } from "./model.ts";
import type { Tree } from "./tree.ts";
import { Settings } from "./config.ts";
import { aboutPeople, hypothesisPeople } from "./directions.ts";
import { ancestorGenerations, familiesAsChild, familiesAsPartner } from "./people.ts";

/** How near a person is: 0 an ancestor (or the person the research is for), 1 their family, 2 linked further. Unlinked: none. */
export type Kin = 0 | 1 | 2;

function researches(tree: Tree): Research[] {
  return tree
    .list<Research>("research")
    .filter((r) => !r.retracted && tree.get<Person>(r.focus))
    .sort((a, b) => a.priority - b.priority || a.id.localeCompare(b.id));
}

/** Everyone descended from a person, with the generations between (the person: 0). */
function descendants(tree: Tree, id: string): Map<string, number> {
  const out = new Map<string, number>([[id, 0]]);
  const queue = [id];
  while (queue.length) {
    const p = queue.shift()!;
    for (const f of familiesAsPartner(tree, p))
      for (const c of f.children)
        if (!out.has(c.person)) {
          out.set(c.person, out.get(p)! + 1);
          queue.push(c.person);
        }
  }
  return out;
}

/**
 * The main person of a tree: the one set (main.person), else the nearest person descended from the focus
 * of every research (the lines of one person's parents and grandparents lead to that person), else the
 * focus of the first research. Undefined in a tree with no research.
 */
export function mainPerson(tree: Tree): string | undefined {
  const set = new Settings(tree.env, {}).mainPerson(tree.config);
  if (set && tree.get<Person>(set) && !tree.get<Person>(set)!.retracted) return set;
  const all = researches(tree);
  if (all.length === 0) return undefined;
  const focuses = [...new Set(all.map((r) => r.focus))];
  if (focuses.length > 1) {
    const trees = focuses.map((f) => descendants(tree, f));
    let best: { id: string; far: number } | undefined;
    for (const [id] of trees[0]!) {
      if (!trees.every((d) => d.has(id))) continue;
      const far = trees.reduce((n, d) => n + d.get(id)!, 0);
      if (!best || far < best.far || (far === best.far && id < best.id)) best = { id, far };
    }
    if (best) return best.id;
  }
  return all[0]!.focus;
}

/**
 * How near everyone is to the people the research is for (the focus of each research and the main person):
 * their ancestors 0, the partners, children and children's partners of those 1, anyone linked by family further 2.
 */
export function kinship(tree: Tree): Map<string, Kin> {
  const roots = [...new Set([...researches(tree).flatMap((r) => [r.focus, ...(r.review?.people ?? [])]), mainPerson(tree)].filter((x): x is string => !!x))];
  const out = new Map<string, Kin>();
  for (const r of roots) for (const id of ancestorGenerations(tree, r).keys()) out.set(id, 0);
  for (const a of [...out.keys()])
    for (const f of familiesAsPartner(tree, a)) {
      for (const p of f.partners) if (!out.has(p)) out.set(p, 1);
      for (const c of f.children) {
        if (!out.has(c.person)) out.set(c.person, 1);
        for (const g of familiesAsPartner(tree, c.person)) for (const p of g.partners) if (!out.has(p)) out.set(p, 1);
      }
    }
  const queue = [...out.keys()];
  while (queue.length) {
    const p = queue.shift()!;
    const next = [...familiesAsPartner(tree, p).flatMap((f) => [...f.partners, ...f.children.map((c) => c.person)]), ...familiesAsChild(tree, p).flatMap((f) => f.partners)];
    for (const n of next)
      if (!out.has(n)) {
        out.set(n, 2);
        queue.push(n);
      }
  }
  return out;
}

/**
 * Work about people nothing links to the tree yet: none of the people a task is about (with those of the conflicts
 * and hypotheses it names) is kin of the people the research is for. It waits out of the queue until the user asks
 * for it (a direction or a review of one of them makes them the research's) or a hypothesis that joins them to the
 * tree is decided and recorded. A task that tests that hypothesis names it (--about H…) or the person of the tree
 * it would join, and so is in the queue. The user's material (intake) and work at hand never wait; a tree with
 * nobody to be for holds nothing.
 */
export function offTree(tree: Tree): (t: Task) => boolean {
  const kin = kinship(tree);
  if (!kin.size) return () => false;
  return (t) => {
    if (t.level === "intake" || t.state === "doing") return false;
    const about = aboutPeople(tree, t.subject);
    return about.length > 0 && !about.some((p) => kin.has(p));
  };
}

/**
 * The open hypotheses that would join people off the tree to it: each names someone of the tree and someone of
 * their family (the people family links join to them) — the work to do before any work on them.
 */
export function joiningHypotheses(tree: Tree, people: string[]): Hypothesis[] {
  const kin = kinship(tree);
  const family = new Set<string>();
  const queue = people.filter((p) => !kin.has(p));
  while (queue.length) {
    const p = queue.shift()!;
    if (family.has(p)) continue;
    family.add(p);
    queue.push(...familiesAsPartner(tree, p).flatMap((f) => [...f.partners, ...f.children.map((c) => c.person)]), ...familiesAsChild(tree, p).flatMap((f) => f.partners));
  }
  return tree
    .list<Hypothesis>("hypothesis")
    .filter((h) => {
      if (h.state !== "open") return false;
      const about = hypothesisPeople(tree, h);
      return about.some((s) => family.has(s)) && about.some((s) => kin.has(s));
    });
}
