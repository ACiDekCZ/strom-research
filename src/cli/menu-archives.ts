// What a person decides about archives' terms, in the menu (What waits, Settings → Archives) and from a link of the
// Strom app: how an archive whose terms restrict automation gives its images — slowly, through the browser, by hand —
// the levels of the connectors taken over from an older strom, a connector that says now an archive allows more. The
// menu is the person's own terminal: each choice runs the ordinary command (strom allow archive …), 0 goes back with
// nothing changed, and the current state is the suggested answer. Tasks that waited for the archive's images go back
// to the queue once they may come — unless the images are in their folder already (saved by hand meanwhile).

import type { Context } from "./context.ts";
import type { UIKey } from "./ui.ts";
import { claudeHere, pause, subMenu, translator, type Item, type Run } from "./menu-parts.ts";
import { humanDay } from "./human.ts";
import { Tree } from "../core/tree.ts";
import { isArchive } from "../core/mode.ts";
import { bareHost, listConnectors, routeOf, routesOf, type Connector } from "../core/connector.ts";
import { claimOf, loadArchives, rank, type ArchiveLevel, type Claim, type PendingQuestion, type Way } from "../core/terms.ts";
import { archiveQuestions, connectorFor, levelWords, tasksStanding, tasksWaitingOn, termsText, waysOffered, wokenLines } from "../core/archiveasks.ts";
import { wakeForArchive } from "../core/archivewait.ts";
import { archivesOverview, levelsOf, paceFor } from "../commands/archives.ts";
import type { Pace } from "../core/net.ts";

type T = ReturnType<typeof translator>;

/** A pace in the person's words: "one image at most every 10 s, at most 120 an hour". */
export function paceWords(t: T, p: Pace | { minIntervalMs: number; perHour: number | null }): string {
  const n = p.perHour === null || !Number.isFinite(p.perHour) ? "∞" : p.perHour;
  return t("ui.archive.pace", { seconds: p.minIntervalMs / 1000, n });
}

function connectorsHere(ctx: Context): Connector[] {
  return listConnectors(ctx.settings.shared()?.value, ctx.env);
}

/** The question's lines in What waits: the archive, its terms (strom's quote, or the connector's reading), the tasks. */
function permissionLines(ctx: Context, t: T, lang: string, tree: Tree | undefined, q: PendingQuestion): string[] {
  const tasks = tree ? tasksStanding(tree, q) : [];
  return [
    `    ${termsText(lang, ctx.env, q)}`,
    ...(tasks.length ? [`    ${t("ui.archive.item.tasks", { ids: tasks.join(", ") })}`] : []),
    // since when it waits (the first time asked) and how many times a command needed it
    `    ${t("ui.archive.item.since", { date: humanDay(q.at, lang), tries: q.tries ?? 1 })}`,
  ];
}

/** A question the menu can put: its archive named (a permission, a milder reading), the connectors taken over. */
const answerable = (q: PendingQuestion) => (q.kind === "takeover" ? !!q.connectors?.length : !!q.host && (q.kind === "permission" || !!q.connector));

/** One question in What waits: its text, the label of its item, what choosing it does. */
export function archiveItems(ctx: Context, run: Run, lang: string, root: string, start: number, max: number): { text: string[]; items: Item[]; count: number } {
  const t = translator(lang);
  const tree = Tree.open(root, ctx.env);
  const qs = archiveQuestions(tree).filter(answerable);
  const text: string[] = [];
  const items: Item[] = [];
  const connectors = qs.length ? connectorsHere(ctx) : [];
  for (const q of qs) {
    if (items.length >= max) break;
    const k = start + items.length + 1;
    if (q.kind === "permission" && q.host) {
      const title = q.title ?? q.host;
      text.push("", ` ${k}. ${t("ui.archive.item", { title, host: q.host })}`, ...permissionLines(ctx, t, lang, tree, q));
      items.push({ key: String(k), label: t("ui.archive.item.read", { k, title }), act: async () => void (await decideArchive(ctx, run, lang, root, q.host!, q)) });
    } else if (q.kind === "takeover" && q.connectors?.length) {
      const names = q.connectors.map((n) => connectors.find((c) => c.name === n)?.manifest.title ?? n);
      text.push("", ` ${k}. ${t("ui.archive.takeover.item", { n: names.length, names: names.join(", ") })}`);
      items.push({ key: String(k), label: t("ui.archive.takeover.read", { k }), act: () => decideTakeover(ctx, run, lang, q) });
    } else if (q.kind === "milder" && q.host && q.connector) {
      const c = connectors.find((x) => x.name === q.connector);
      const title = c?.manifest.title ?? q.title ?? q.connector;
      text.push("", ` ${k}. ${t("ui.archive.milder.item", { title, host: q.host, to: levelWords(lang, q.to ?? "allowed"), from: levelWords(lang, q.from ?? "restricted") })}`);
      items.push({ key: String(k), label: t("ui.archive.milder.read", { k, title }), act: () => decideMilder(ctx, run, lang, q, title) });
    }
  }
  return { text, items, count: qs.length };
}

/** How many questions about archives wait with this research (none in an archive). */
export function archiveQuestionCount(tree: Tree): number {
  return archiveQuestions(tree).filter(answerable).length;
}

/** Every research on this computer, the one worked on first: a decision about an archive is the person's for all. */
export function rootsHere(ctx: Context, root: string | undefined): string[] {
  return [...new Set([...(root ? [root] : []), ...ctx.knownTrees().map((k) => k.root)])];
}

/** The level of an archive's host as it holds now, for the connector that reaches it. */
function levelHere(ctx: Context, c: Connector, host: string): ArchiveLevel | undefined {
  return levelsOf(ctx, c, true).find((a) => a.host === host);
}

/**
 * One archive: what its terms say and the ways to get its images — a question that waited (What waits, a link), or
 * the person's look at it in the settings (the current way suggested, its permission to be forgotten). True: decided.
 */
export async function decideArchive(ctx: Context, run: Run, lang: string, root: string | undefined, host: string, q?: PendingQuestion): Promise<boolean> {
  const t = translator(lang);
  const out = (line = "") => ctx.io.stdout(line + "\n");
  const c = connectorFor(connectorsHere(ctx), host, q?.connector);
  if (!c) {
    out(t("ui.archive.gone"));
    return false;
  }
  const a = levelHere(ctx, c, host);
  const title = a?.title ?? q?.title ?? c.manifest.title ?? host;
  const tree = root ? Tree.open(root, ctx.env) : undefined;
  out("");
  out(` ${t("ui.archive.item", { title, host })}`);
  out(`    ${termsText(lang, ctx.env, { host, ...(a?.quote ? { quote: a.quote } : q?.quote ? { quote: q.quote } : {}), ...(a?.terms ?? q?.terms ? { terms: (a?.terms ?? q?.terms)! } : {}), ...(a?.quoteBy ? { quoteBy: a.quoteBy } : q?.quoteBy ? { quoteBy: q.quoteBy } : {}) })}`);
  const tasks = tree && !isArchive(tree) ? (q?.kind === "permission" ? tasksStanding(tree, q) : tasksWaitingOn(tree, host).map((x) => x.id)) : [];
  if (tasks.length) out(`    ${t("ui.archive.item.tasks", { ids: tasks.join(", ") })}`);
  // a server that refused strom's client: its answer, not the archive's terms — only the person lifts it (--unblock)
  if (a?.level === "forbidden" && a.refused && !a.refused.unreadable) {
    const h = a.refused.host;
    out(`    ${a.refused.at ? t("ui.archive.refused", { title, host: h, date: humanDay(a.refused.at, lang) }) : t("ui.archive.refused.undated", { title, host: h })}`);
    await pause(ctx, lang);
    return false;
  }
  // a level no permission opens (by hand only, nothing at all): said, and who lifts it
  if (a && (a.level === "manual" || a.level === "forbidden")) {
    out(`    ${t("ui.archive.closed", { title, level: levelWords(lang, a.level, false, a.from), host })}`);
    await pause(ctx, lang);
    return false;
  }
  const slow = paceFor(ctx, host, c);
  // an archive that allows strom its images (strom's known terms, the connector confirmed): only stricter — by hand
  const allowed = a?.level === "allowed";
  if (allowed) {
    out(`    ${t("ui.archive.allowed.line", { level: levelWords(lang, "allowed") })}`);
    out(`    ${t("ui.archive.pace.service", { pace: paceWords(t, archivesOverview(ctx).find((r) => r.host === host && r.connector === c.name)?.pace ?? slow), host })}`);
  } else out(`    ${t("ui.archive.pace.line", { pace: paceWords(t, slow), host })}`);
  const ways: Way[] = allowed ? ["manual"] : waysOffered(c, claudeHere(ctx, tree?.config), q?.way, !!(a?.browserOnly ?? q?.browserOnly));
  const now = a?.permission;
  const choices: { label: string; way?: Way }[] = ways.map((w) => ({
    way: w,
    label: t(w === "slow" ? "ui.archive.way.slow" : w === "browser" ? "ui.archive.way.browser" : "ui.archive.way.manual", { seconds: slow.minIntervalMs / 1000, n: Number.isFinite(slow.perHour) ? slow.perHour : "∞" }),
  }));
  if (now) choices.push({ label: t("ui.archive.way.revoke") });
  // what holds now is suggested (Enter keeps it); a question nobody answered yet: 0, nothing changes
  const kept = now ? choices.findIndex((x) => x.way === now) : -1;
  const i = await ctx.choose(t("ui.archive.choose", { title }), choices, kept >= 0 ? kept : choices.length, { back: t("ui.archive.way.back") });
  if (i === undefined || (now && choices[i]!.way === now)) return false;
  const chosen = choices[i]!.way;
  if (!chosen) {
    if ((await run(["allow", "archive", host, "--revoke"], true)) !== 0) return false;
    out(t("ui.archive.revoked", { title }));
    return true;
  }
  // what the decision does to the tasks that waited (the command wakes them, in every research here): said after it
  const plan = wakeForArchive(ctx.env, rootsHere(ctx, root), host, { ...(ctx.settings.shared()?.value ? { shared: ctx.settings.shared()!.value } : {}), way: chosen, dry: true });
  if ((await run(["allow", "archive", host, "--way", chosen], true)) !== 0) return false;
  // the connector's route follows the way chosen: through the browser, or straight through strom
  const via = routeOf(ctx.env, c).via;
  if (chosen === "browser" && via !== "browser") await run(["connector", "use", c.name, "--via", "browser"], true);
  if (chosen === "slow" && via === "browser") await run(["connector", "use", c.name, "--via", "direct"], true);
  out(t("ui.archive.chosen", { title, way: t(chosen === "slow" ? "ui.archive.is.slow" : chosen === "browser" ? "ui.archive.is.browser" : "ui.archive.is.manual") }));
  for (const line of wokenLines(lang, plan, root)) out(line);
  return true;
}

/** The connectors taken over from an older strom: confirmed all at once, or gone through one by one. */
async function decideTakeover(ctx: Context, run: Run, lang: string, q: PendingQuestion): Promise<void> {
  const t = translator(lang);
  const out = (line = "") => ctx.io.stdout(line + "\n");
  const all = connectorsHere(ctx).filter((c) => q.connectors?.includes(c.name));
  if (!all.length) {
    // nothing of them here any more: the question goes with the person's word
    out(t("ui.archive.gone"));
    return;
  }
  const line = (c: Connector) => `  • ${t("ui.archive.takeover.line", { title: c.manifest.title ?? c.name, hosts: [...new Set(c.manifest.hosts.map(bareHost))].join(", "), level: levelWords(lang, claimOf(c)) })}`;
  out("");
  out(t("ui.archive.takeover.about"));
  for (const c of all) out(line(c));
  const i = await ctx.choose("", [{ label: t("ui.archive.takeover.all") }, { label: t("ui.archive.takeover.each") }], 2, { back: t("ui.archive.way.back") });
  if (i === undefined) return;
  if (i === 0) {
    if ((await run(["allow", "archive", "--accept"], true)) === 0) out(t("ui.archive.takeover.done", { names: all.map((c) => c.manifest.title ?? c.name).join(", ") }));
    return;
  }
  for (const c of all) {
    const claim: Claim = claimOf(c);
    out("");
    out(line(c));
    if (c.manifest.policy.termsSummary) out(`    ${termsText(lang, ctx.env, { quote: c.manifest.policy.termsSummary, quoteBy: "connector", ...(c.manifest.policy.terms ? { terms: c.manifest.policy.terms } : {}) })}`);
    const choices: { label: string; level?: "restricted" | "manual" }[] = [{ label: t("ui.archive.takeover.confirm", { level: levelWords(lang, claim) }) }];
    if (rank(claim) < rank("restricted")) choices.push({ label: t("ui.archive.takeover.restricted"), level: "restricted" });
    if (rank(claim) < rank("manual")) choices.push({ label: t("ui.archive.takeover.manual"), level: "manual" });
    const k = await ctx.choose(t("ui.archive.takeover.one", { title: c.manifest.title ?? c.name }), choices, choices.length, { back: t("ui.archive.takeover.stop") });
    if (k === undefined) return;
    if ((await run(["allow", "archive", c.name, "--accept"], true)) !== 0) return;
    const level = choices[k]!.level;
    if (level && (await run(["allow", "archive", c.name, "--level", level], true)) !== 0) return;
    out(t("ui.archive.takeover.done", { names: `${c.manifest.title ?? c.name} (${levelWords(lang, level ?? claim)})` }));
  }
}

/** A connector that says now an archive allows more than strom keeps: accepted, or kept as it is. */
async function decideMilder(ctx: Context, run: Run, lang: string, q: PendingQuestion, title: string): Promise<void> {
  const t = translator(lang);
  const out = (line = "") => ctx.io.stdout(line + "\n");
  const c = connectorsHere(ctx).find((x) => x.name === q.connector);
  if (!c) return void out(t("ui.archive.gone"));
  out("");
  out(` ${t("ui.archive.milder.item", { title, host: q.host!, to: levelWords(lang, q.to ?? "allowed"), from: levelWords(lang, q.from ?? "restricted") })}`);
  if (c.manifest.policy.termsSummary) out(`    ${termsText(lang, ctx.env, { quote: c.manifest.policy.termsSummary, quoteBy: "connector", ...(c.manifest.policy.terms ? { terms: c.manifest.policy.terms } : {}) })}`);
  const i = await ctx.choose("", [{ label: t("ui.archive.milder.accept") }, { label: t("ui.archive.milder.keep") }], 2, { back: t("ui.archive.way.back") });
  if (i === undefined) return;
  if ((await run(["allow", "archive", c.name, i === 0 ? "--accept" : "--keep"], true)) === 0) out(t(i === 0 ? "ui.archive.milder.accepted" : "ui.archive.milder.kept", { title }));
}

/** An archive only a person's browser goes to, in the person's words: through the browser, or by hand where the downloader cannot. */
function onlyBrowser(t: T, c: Connector, robots: boolean): string {
  const browser = routesOf(c).includes("browser");
  return t(robots ? (browser ? "ui.archive.level.robots" : "ui.archive.level.robots.manual") : browser ? "ui.archive.level.browserOnly" : "ui.archive.level.browserOnly.manual");
}

/** Does only a person's browser go to an archive of this downloader (its robots.txt, strom's known terms)? Its line says how. */
export function browserOnlyHere(ctx: Context, c: Connector): boolean {
  return archivesOverview(ctx).some((r) => r.connector === c.name && r.browserOnly && r.level !== "manual" && r.level !== "forbidden");
}

/** What holds for a downloader's archive, on its line in the settings: its level, the person's way and since when, the pace. */
export function archiveState(ctx: Context, lang: string, c: Connector): string {
  const t = translator(lang);
  const rows = archivesOverview(ctx).filter((r) => r.connector === c.name);
  const store = loadArchives(ctx.env).archives;
  return rows
    .map((r) => {
      const rec = store[r.host];
      const level = r.level as Claim;
      const closed = level === "manual" || level === "forbidden";
      // only a person's browser goes to the archive (its robots.txt, strom's known terms): said so — through the browser
      // where the downloader can go that way, else by hand only; never "directly" (that is not the way here)
      const only = !closed && !r.way && r.browserOnly ? onlyBrowser(t, c, !!r.robots) : undefined;
      const way = only ?? (!closed && r.way ? t("ui.archives.state.way", { way: t(`ui.archive.is.${r.way}` as UIKey), date: rec?.at ? humanDay(rec.at, lang) : "–" }) : levelWords(lang, level, !!r.robots, r.from));
      const pace = !closed && r.way !== "manual" && (level === "allowed" || r.way) ? `; ${paceWords(t, r.pace)}` : "";
      return `${rows.length > 1 ? `${r.host}: ` : ""}${way}${pace}`;
    })
    .join(" · ");
}

/** Settings → Archives → permissions: each archive of a downloader here, then the same choices as in What waits. */
export async function archivePermissions(ctx: Context, run: Run, lang: string, root: string | undefined): Promise<void> {
  const t = translator(lang);
  await subMenu(ctx, lang, () => {
    const rows = archivesOverview(ctx);
    const hosts = [...new Map(rows.map((r) => [r.host, r])).values()];
    const connectors = connectorsHere(ctx);
    const items: Item[] = hosts.slice(0, 9).map((r, k) => {
      const c = connectors.find((x) => x.name === r.connector);
      return {
        key: String(k + 1),
        label: `${c?.manifest.title ?? r.connector} (${r.host}) – ${c ? archiveState(ctx, lang, c) : levelWords(lang, r.level as Claim, !!r.robots, r.from)}`,
        act: async () => void (await decideArchive(ctx, run, lang, root, r.host, loadArchives(ctx.env).pending.find((p) => p.kind === "permission" && p.host === r.host))),
      };
    });
    return { title: t(items.length ? "ui.archives.permissions.title" : "ui.archives.empty"), items };
  });
}
