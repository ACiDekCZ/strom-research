// The questions about archives' terms that wait for the person (core/terms.ts keeps them in the user's settings, one
// per archive, shared by every tree of this computer) as the menu's What waits, the orientation and the Strom app's
// bridge show them: the images of an archive whose terms restrict automation (how to get them), the connectors taken
// over from an older strom (their levels confirmed once), a connector that says now an archive allows more (accepted
// or kept). Never in an archive: no agent works there, no question comes of it, none is shown.

import type { Tree } from "./tree.ts";
import type { Task } from "./model.ts";
import type { Env } from "./paths.ts";
import { actsAsArchive } from "./state.ts";
import { waitsOnHost, type Woken } from "./archivewait.ts";
import { waitsForDecision } from "./queue.ts";
export { savedInInbox } from "./archivewait.ts";
import { claimOf, pendingQuestions, termsFor, type Claim, type PendingQuestion, type Way } from "./terms.ts";
import { bareHost, listConnectors, routesOf, type Connector } from "./connector.ts";
import { ui } from "../cli/ui.ts";
import { humanDay } from "../cli/human.ts";

const ORDER: Record<PendingQuestion["kind"], number> = { permission: 0, takeover: 1, milder: 2 };

/** The questions shown with a research: the permissions first (they hold work up), then the takeover, then the rest. */
export function archiveQuestions(tree: Tree): PendingQuestion[] {
  if (actsAsArchive(tree)) return [];
  return [...pendingQuestions(tree.env)].sort((a, b) => ORDER[a.kind] - ORDER[b.kind] || a.at.localeCompare(b.at));
}

/** Only the archives whose images wait for the person's decision (the one line of the orientation). */
export function permissionsWaiting(tree: Tree): PendingQuestion[] {
  return archiveQuestions(tree).filter((q) => q.kind === "permission" && !!q.host);
}

/**
 * The lines above the menu (and in What waits for the agent's status): one per archive whose images wait for the
 * person's decision — since when, and how many tasks stand on it, once it waits long or holds up much; the others in
 * one line, as before. Empty: none.
 */
export function permissionWaitingLines(tree: Tree, lang: string, at: number = Date.now()): string[] {
  const asked = permissionsWaiting(tree);
  if (!asked.length) return [];
  const rows = asked.map((q) => {
    const n = tasksStanding(tree, q).length + tasksElsewhere(tree, q);
    return { q, n, long: waitsLong(q, n, at) };
  });
  const title = (q: PendingQuestion) => q.title ?? q.host!;
  const long = rows.filter((r) => r.long).slice(0, 3);
  const rest = rows.filter((r) => !long.includes(r));
  return [
    ...long.map((r) => `${ui(lang, "ui.archive.waiting.long", { date: humanDay(r.q.at, lang), title: title(r.q) })}${r.n ? ui(lang, "ui.archive.waiting.tasks", { n: r.n }) : ""}`),
    ...(rest.length === 1 ? [ui(lang, "ui.archive.waiting.one", { title: title(rest[0]!.q) })] : rest.length ? [ui(lang, "ui.archive.waiting.more", { n: rest.length })] : []),
  ];
}

/** The tasks of the research that wait for an archive's images: saved by hand from its site, or the person's decision. */
export function tasksWaitingOn(tree: Tree, host: string): Task[] {
  return tree.list<Task>("task").filter((t) => !!waitsOnHost(tree, t, host));
}

/**
 * Every task of the research that stands on an archive's question: those that wait for it (or for its images by hand),
 * those the queue holds back for it, and those a fetch needed it for (still to be done) — their IDs.
 */
export function tasksStanding(tree: Tree, q: PendingQuestion): string[] {
  const ids = new Set(tasksWaitingOn(tree, q.host!).map((t) => t.id));
  const held = waitsForDecision(tree, [q]);
  for (const t of tree.list<Task>("task")) if (t.state === "open" && held(t)) ids.add(t.id);
  for (const x of q.tasks ?? (q.tree && q.task ? [{ tree: q.tree, task: q.task }] : [])) {
    if (x.tree !== tree.config.id) continue;
    const t = tree.get<Task>(x.task);
    if (t?.type === "task" && !["done", "dropped"].includes(t.state)) ids.add(t.id);
  }
  return [...ids].sort();
}

/** How many tasks of other researches here a question holds up (as the fetches said; not opened to look). */
export function tasksElsewhere(tree: Tree, q: PendingQuestion): number {
  return (q.tasks ?? []).filter((x) => x.tree !== tree.config.id).length;
}

/** A question waits long (3 days and more) or holds up much (3 tasks and more): said more strongly above the menu. */
export const LONG_WAIT_DAYS = 3;
export const MANY_TASKS = 3;

export function waitsLong(q: PendingQuestion, tasks: number, at: number = Date.now()): boolean {
  const since = Date.parse(q.at);
  return tasks >= MANY_TASKS || (Number.isFinite(since) && at - since >= LONG_WAIT_DAYS * 86_400_000);
}

/**
 * What a decision did to the tasks that waited for the archive, in the person's words: back in the queue, their images
 * in their folder already (the research registers them), waiting for the images saved by hand — per research, the one
 * worked on without its name.
 */
export function wokenLines(lang: string, results: Woken[], root: string | undefined): string[] {
  const out: string[] = [];
  for (const r of results) {
    const name = r.root === root ? "" : `${r.name}: `;
    for (const x of r.inbox) out.push(`  ${name}${ui(lang, "ui.archive.inbox", { id: x.id, n: x.n })}`);
    if (r.woken.length) out.push(`  ${name}${ui(lang, "ui.archive.woken", { ids: r.woken.join(", ") })}`);
    if (r.kept.length) out.push(`  ${name}${ui(lang, "ui.archive.manual.tasks", { ids: r.kept.join(", ") })}`);
  }
  return out;
}

/** The connector a question or an archive's host is about: the one named, else any that reaches the host. */
export function connectorFor(connectors: Connector[], host: string, name?: string): Connector | undefined {
  const reaches = (c: Connector) => c.manifest.hosts.map(bareHost).includes(host);
  return connectors.find((c) => c.name === name && reaches(c)) ?? connectors.find(reaches);
}

/**
 * The ways the person may choose for an archive's images: slowly through strom (a connector that goes directly, no
 * bot check, an archive that lets tools in other than through a browser), through the browser (a connector with that
 * route, only while Claude Code does the research and is here — no other agent has browser tools), by hand. The way
 * the connector asked for first. `browserOnly`: the archive lets automated tools in only through a person's browser
 * (its robots.txt, strom's known terms) — never slowly.
 */
export function waysOffered(c: Connector | undefined, claude: boolean, asked?: "slow" | "browser", browserOnly = false): Way[] {
  const routes = c ? routesOf(c) : ["direct"];
  const ways: Way[] = [];
  if (!browserOnly && !c?.manifest.browser?.pages && routes.includes("direct")) ways.push("slow");
  if (routes.includes("browser") && claude) ways.push("browser");
  if (asked === "browser") ways.sort((a, b) => Number(b === "browser") - Number(a === "browser"));
  return [...ways, "manual"];
}

/** What the person reads of the archive's terms: strom's quote with its address, else the connector's reading (said so). */
export function termsText(lang: string, env: Env, q: { host?: string; quote?: string; terms?: string; quoteBy?: "strom" | "connector" | "robots" }): string {
  // the site's robots.txt (strom's list quotes it, or strom read it): said as robots.txt, never as its terms of use
  const robots = q.quoteBy === "robots" || (!!q.host && !q.quoteBy && termsFor(env, q.host)?.quoteFrom === "robots");
  if (robots) {
    const text = ui(lang, q.quote ? "ui.archive.terms.robots" : "ui.archive.terms.robots.none", { quote: q.quote ?? "", terms: q.terms ?? "" });
    return q.terms ? text : text.replace(/\s*\(\)/u, "");
  }
  if (!q.quote) return ui(lang, "ui.archive.terms.none");
  const by = q.quoteBy ?? (q.host && termsFor(env, q.host)?.quote === q.quote ? "strom" : "connector");
  const text = ui(lang, by === "strom" ? "ui.archive.terms.known" : "ui.archive.terms.connector", { quote: q.quote, terms: q.terms ?? "" });
  return q.terms ? text : text.replace(/\s*\(\)/u, "");
}

/** What gives a level from the archive's terms (strom's known terms, a connector's reading of them). */
const FROM_TERMS = ["terms", "connector", "kept"];

/**
 * A level in the person's words. `from` (core/terms.ts LevelSource): what gives it — a refusal of strom's client said
 * as the server's answer, never as the terms; by hand or no access a person, the tree or strom set without the terms
 * saying so: without "(its terms)".
 */
export function levelWords(lang: string, l: Claim, robots = false, from?: readonly string[]): string {
  // a level the site's robots.txt gives (automated tools only through a person's browser): said so, not as its terms
  if (robots && (l === "restricted" || l === "unknown")) return ui(lang, "ui.archive.level.robots");
  if (l === "forbidden" && from?.includes("refused")) return ui(lang, "ui.archive.level.refused");
  if ((l === "manual" || l === "forbidden") && from && !from.some((f) => FROM_TERMS.includes(f))) return ui(lang, `ui.archive.level.${l}.set`);
  return ui(lang, `ui.archive.level.${l}`);
}

/**
 * The questions as items of the bridge's `waiting` (the Strom app shows them; the person decides in the terminal a
 * link opens — the answer is never the app's): an archive's images, the connectors taken over.
 */
export function archiveWaitingItems(tree: Tree, shared: string | undefined, claude: () => boolean): Record<string, unknown>[] {
  const qs = archiveQuestions(tree).filter((q) => q.kind !== "milder");
  if (!qs.length) return [];
  const lang = tree.lang;
  const connectors = listConnectors(shared, tree.env);
  let isClaude: boolean | undefined;
  return qs.flatMap((q): Record<string, unknown>[] => {
    if (q.kind === "permission" && q.host) {
      const title = q.title ?? q.host;
      const c = connectorFor(connectors, q.host, q.connector);
      isClaude ??= claude();
      return [
        {
          kind: "permission",
          id: q.key,
          what: ui(lang, "ui.archive.item", { title, host: q.host }),
          on: termsText(lang, tree.env, q),
          at: q.at,
          since: q.at,
          tries: q.tries ?? 1,
          host: q.host,
          title,
          ...(q.terms ? { terms: q.terms } : {}),
          ...(q.quote ? { quote: q.quote } : {}),
          tasks: tasksStanding(tree, q),
          choices: waysOffered(c, isClaude, q.way, !!q.browserOnly),
        },
      ];
    }
    if (q.kind === "takeover" && q.connectors?.length) {
      const items = q.connectors.map((name) => {
        const c = connectors.find((x) => x.name === name);
        return { name, title: c?.manifest.title ?? name, level: c ? claimOf(c) : ("unknown" as Claim), hosts: c ? [...new Set(c.manifest.hosts.map(bareHost))] : [] };
      });
      return [
        {
          kind: "takeover",
          id: q.key,
          what: ui(lang, "ui.archive.takeover.item", { n: items.length, names: items.map((i) => i.title).join(", ") }),
          on: "",
          at: q.at,
          connectors: items,
        },
      ];
    }
    return [];
  });
}
