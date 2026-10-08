// sync · sync undo · sync discard — a family tree coming back from the Strom app (or another
// program), compared with the research: what the user changed, taken in on
// their yes (core/sync.ts).

import { compactSoon } from "../core/history.ts";
import { changeLines } from "../core/changelog.ts";
import fs from "node:fs";
import path from "node:path";
import { register } from "../cli/registry.ts";
import type { Context } from "../cli/context.ts";
import { lines, truncate } from "../cli/format.ts";
import { UI, ui, type UIKey } from "../cli/ui.ts";
import { eventName, humanDate, humanDay, humanPlace } from "../cli/human.ts";
import { EXIT, StromError, UsageError } from "../core/errors.ts";
import type { Family, Person, Source } from "../core/model.ts";
import { fileSha256, MAX_IN_TREE, mimeOf } from "../core/media.ts";
import { create, update } from "../core/records.ts";
import { safeFolderName } from "../core/text.ts";
import { humanAge } from "../core/age.ts";
import { now, Tree } from "../core/tree.ts";
import { isArchive } from "../core/mode.ts";
import { applySync, discardReceived, nothingSince, withoutImages, planSync, readTreeFile, receivedAll, receivedPending, receivedSince, receivedOf, settleReceived, SYNC_INBOX, syncConflicts, undoReceived, undoSync, type Change, type Plan, type Received, type SFact, type SPart, type Skipped, type Snapshot, type SyncInput } from "../core/sync.ts";
import { labels, type LabelKey } from "../gedcom/labels.ts";
import { startLive } from "../core/live.ts";
import { appSendsChanges, sendAppUrl, stromAppUrl } from "../core/stromapp.ts";
import { appWindow, openAppIn, replaceGone } from "../core/appbrowser.ts";
import { isAgent } from "../core/which.ts";

/**
 * What was written, line by line (the operations' summaries, in English — for an agent or a script); a person at the
 * terminal reads the sentence in the research's language alone (found on Windows: English lines in a Czech research).
 */
/**
 * What a sync wrote, line by line, for an agent's session or a script — in the research's language, records by their
 * names (the person follows it in the agent's session; found on Windows: an undo told in English). A person at the
 * terminal reads the sentence alone.
 */
function opsFor(ctx: Context, tree: Tree): string[] {
  // an archive's tasks wait put aside for research to come: not said
  const ops = isArchive(tree) ? tree.written.filter((o) => !o.op.startsWith("task.")) : tree.written;
  return ctx.interactive && !isAgent(ctx.env) ? [] : changeLines(tree, ops, "", tree.lang).map((l) => l.text);
}

/** A child's tie to each parent as a change says it: "stepchild", or "own child (Marie Nováková), stepchild (Jan Novák)"; a word the research has none for, as the file gave it. */
function tiesText(by: Record<string, string> | undefined, said: string | undefined, lang: string, name: (k: string | undefined) => string): string {
  if (!by) return `„${said ?? ""}“`;
  const word = (r: string) => labels(lang)((r === "unknown" ? "unknownRelation" : r) as LabelKey);
  const words = Object.entries(by).map(([p, r]) => [name(p), word(r)] as const);
  return new Set(words.map((w) => w[1])).size === 1 ? (words[0]?.[1] ?? "") : words.map(([p, r]) => `${r} (${p})`).join(", ");
}

/** Why a change was left out, in the research's language where its code is known (the people by name), else as said. */
function skippedWhy(x: Skipped, lang: string): string {
  const name = (id: string | undefined) => (id ? (x.names?.[id] ? `${x.names[id]} [${id}]` : id) : "?");
  if (x.code === "child.parents-exist") return ui(lang, "ui.sync.skip.parents", { person: name(x.params?.person), family: name(x.params?.family) });
  if (x.code === "child.in-family") return ui(lang, "ui.sync.skip.infamily", { person: name(x.params?.person), family: name(x.params?.family) });
  return x.why;
}

/** A name as the file writes it (Given /Surname/), as a person reads it. */
function shownName(n: string | undefined): string {
  return truncate((n ?? "").replace(/\//g, " ").replace(/\s+/g, " ").trim(), 80);
}

function factText(f: SFact | undefined, lang: string, name: (key: string) => string = (k) => k): string {
  if (!f) return "—";
  return [f.value, humanDate(f.date, lang), humanPlace(f.place, undefined, lang), detailText(f, lang, name)].filter(Boolean).join(", ") || "—";
}

/** What a fact says besides: its house, age (a couple's: each partner's) and cause. */
function detailText(f: SFact | undefined, lang: string, name: (key: string) => string = (k) => k): string {
  if (!f) return "";
  const ages = Object.entries(f.ages ?? {}).map(([who, a]) => `${name(who)} ${humanAge(a, lang)}`);
  return [f.house && ui(lang, "ui.sync.house", { x: f.house }), f.age && humanAge(f.age, lang), ...ages, f.cause && ui(lang, "ui.sync.cause", { x: f.cause })].filter(Boolean).join(", ");
}

/** A position on the map as a map shows it: degrees, six decimals at most. */
const point = (p: { lat: number; lon: number }) => `${+p.lat.toFixed(6)}, ${+p.lon.toFixed(6)}`;

/** A new source of the app whose transcript counts as the user's reading (the send says evidence, or it is verified). */
function newReads(c: Change, incoming: Snapshot): boolean {
  const s = c.source ? incoming.sources?.get(c.source) : undefined;
  return !!s && s.quay !== 0 && (incoming.transcripts === "evidence" || !!s.verified);
}

/** One change as the user reads it, with what strom does with it. */
function changeLine(tree: Tree, c: Change, incoming: Snapshot, lang: string): string {
  const name = (key: string | undefined) => {
    if (!key) return "?";
    if (key.startsWith("x:")) return (incoming.persons.get(key)?.names[0] ?? key).replace(/\//g, "").replace(/\s+/g, " ").trim();
    const p = tree.get<Person>(key);
    return p ? `${(p.names[0] ? `${p.names[0].given} ${p.names[0].surname}` : key).trim()} [${key}]` : key;
  };
  const who = c.partners ? c.partners.map(name).join(" & ") || c.family || "?" : name(c.person);
  // a partner in their age: the given name
  const short = (key: string) => (key.startsWith("x:") ? name(key) : (tree.get<Person>(key)?.names[0]?.given ?? key));
  const kind = (f: SFact | undefined) => (f ? eventName(f.kind, lang, f.label) : "");
  const role = (r: string) => labels(lang)(r as LabelKey);
  const partWho = (p: SPart | undefined) => (!p ? "" : p.person && (p.person.startsWith("x:") || !p.name) ? name(p.person) : (p.name ?? name(p.person)));
  const v = {
    n: c.n,
    who,
    name: name(c.person),
    kind: kind(c.fact ?? c.was),
    fact: `${kind(c.fact ?? c.was)} ${factText(c.fact ?? c.was, lang, short)}`,
    was: c.kind === "fact.detail" ? detailText(c.was, lang, short) || "—" : factText(c.was, lang, short),
    now: c.kind === "fact.detail" ? detailText(c.fact, lang, short) : factText(c.fact, lang, short),
    when: [humanDate(c.fact?.date, lang), humanPlace(c.fact?.place, undefined, lang)].filter(Boolean).join(", "),
    text: truncate(c.text ?? "", 120),
    old: c.title ? truncate(c.title.was, 80) || "—" : shownName(c.wasName),
    new: c.title ? truncate(c.text ?? "", 80) || "—" : shownName(c.text),
    title: c.title ? ui(lang, c.title.part === "before" ? "ui.conflict.titleBefore" : "ui.conflict.titleAfter") : "",
    child: name(c.child),
    // a child's tie to each parent: one word for both, else each parent's
    ties: c.kind !== "child.relation" ? "" : tiesText(c.child ? c.ties?.[c.child] : undefined, c.text, lang, name),
    kids:
      (c.kind === "family.new" && c.text ? ` + ${c.text.split(" ").filter(Boolean).map((k) => name(k.replace(/:(adopted|foster|step)$/, ""))).join(", ")}` : "") +
      // one partner married to somebody unknown (the app's "?" with no child)
      (c.kind === "family.new" && c.union ? ` (${ui(lang, (c.partners?.length ?? 0) < 2 && !c.text ? "ui.sync.union.alone" : "ui.sync.union.of", { union: ui(lang, `ui.sync.union.${c.union}` as UIKey) })})` : ""),
    union: ui(lang, `ui.sync.union.${c.union ?? "none"}` as UIKey),
    place: c.place?.name ?? "",
    at: c.place ? point(c.place) : "",
    from: c.place?.was ? point(c.place.was) : "",
    role: c.part ? role(c.part.role) : "",
    wasRole: c.wasPart ? role(c.wasPart.role) : "",
    part: partWho(c.part ?? c.wasPart),
    sources: (c.cites ?? []).map((x) => `„${truncate(incoming.sources?.get(x.source)?.title || tree.get<Source>(x.source)?.title || x.source, 60)}“`).join(", "),
  };
  const key =
    c.kind === "place.coords" && !c.place?.was
      ? "ui.sync.place.located"
      : c.kind === "fact.part"
        ? `ui.sync.fact.part${!c.part ? ".gone" : c.wasPart && c.wasPart.role !== c.part.role ? ".role" : c.wasPart ? ".link" : ""}`
        : `ui.sync.${c.kind}`;
  // the app's sources and what a fact takes from them: said what becomes of them (a reading of a record, or a lead)
  const does =
    c.kept
      ? "ui.sync.do.kept"
      : c.asked
      ? `ui.sync.do.${c.asked === "setBack" ? "setback" : "cited"}`
      : c.takenBack
      ? "ui.sync.do.taken"
      : c.kind === "child.parents"
      ? "ui.sync.do.parents"
      : c.kind === "name.changed" && c.action === "user"
      ? "ui.sync.do.name.user"
      : c.kind === "name.title" && (c.action === "add" || c.action === "user")
      ? `ui.sync.do.title${c.action === "user" ? ".user" : ""}`
      : c.kind === "family.union" && c.action !== "report"
      ? "ui.sync.do.family.union"
      : c.kind === "fact.detail" && c.action === "add"
      ? "ui.sync.do.detail"
      : c.kind === "fact.part" && (c.action === "add" || c.action === "user")
        ? `ui.sync.do.part${c.action === "user" ? ".user" : ""}`
      : c.kind.startsWith("source.") || c.kind === "fact.cite" || c.kind === "person.cite" || c.kind === "family.cite"
        ? `ui.sync.do.${c.kind}${c.reads || (c.kind === "source.new" && newReads(c, incoming)) ? ".read" : ""}`
        : c.kind === "fact.new" && c.reads
          ? "ui.sync.do.reading"
          : `ui.sync.do.${c.action}`;
  // an archive: nobody reads a record there, nor is an agent told — said without it
  const said = isArchive(tree) && `${does}.archive` in UI ? `${does}.archive` : does;
  return `${ui(lang, key as UIKey, v)} → ${ui(lang, said as UIKey)}`;
}

function planText(tree: Tree, plan: Plan, incoming: Snapshot, file: string, lang: string, edits: string): string {
  const shown = file.includes(" ") ? `"${file}"` : file;
  if (!plan.changes.length) return ui(lang, "ui.sync.nothing", { file: path.basename(file) });
  return lines(
    ui(lang, "ui.sync.title", { file: path.basename(file), n: plan.changes.length }),
    plan.base ? ui(lang, "ui.sync.base", { head: plan.head?.slice(0, 8) ?? incoming.since ?? "" }) : ui(lang, plan.head ? "ui.sync.headmissing" : "ui.sync.nobase", { head: plan.head?.slice(0, 8) ?? "" }),
    plan.partial ? ui(lang, "ui.sync.partial") : undefined,
    plan.identity.strangers.length ? ui(lang, "ui.sync.strangers", { ids: plan.identity.strangers.join(", ") }) : undefined,
    "",
    ...plan.changes.map((c) => `  ${changeLine(tree, c, incoming, lang)}`),
    "",
    // an archive mirrors the app whatever the setting says (planSync)
    isArchive(tree) ? ui(lang, "ui.sync.edits.archive") : ui(lang, "ui.sync.edits", { mode: ui(lang, edits === "user" ? "ui.sync.mode.user" : "ui.sync.mode.conflict") }),
    ui(lang, "ui.sync.next", { file: shown }),
  );
}

/**
 * The Strom app at this address, where it opens (core/appbrowser.ts: the installed app first; never Safari: it cannot
 * reach the bridge). `holdsTree`: a tree handed over, in the browser it came from only.
 */
export function openAppAt(ctx: Context, url: string, opts: { holdsTree?: boolean } = {}): boolean {
  const win = appWindow(ctx.settings, ctx.env, process.platform, opts);
  // the browser kept for the app is no longer here: said, the one it opens in now kept instead
  const replaced = replaceGone(ctx.settings, win);
  if (replaced) ctx.io.stdout(ui(ctx.uiLang(), replaced.now ? "ui.app.browser.gone" : "ui.app.browser.gone.none", { gone: replaced.gone, now: replaced.now ?? "" }) + "\n");
  return openAppIn(win, url, ctx.env).opened;
}

/**
 * The Strom app sends the tree itself: the bridge started, the app opened with ?send= (installed from a Chromium
 * browser first, else in such a browser's tab), and the tree waited for. The file it came as, or what to do instead.
 */
async function fromApp(ctx: Context, tree: Tree, lang: string): Promise<{ file?: string; text: string; settled?: boolean; written?: Record<string, unknown> }> {
  const root = tree.root;
  if (!appSendsChanges(ctx.settings)) return { text: ui(lang, "ui.sync.nosend") };
  // a strom.app.url that is no address of the app: refused before the bridge starts — no address built on it (B1-c)
  stromAppUrl(ctx.settings);
  // what the app sends the bridge writes at once (unless the user reviews each send): what came of it is said, not shown to write
  const atOnce = isArchive(tree) || !ctx.settings.syncReview(tree.config);
  const info = startLive(root, ctx.env, { current: true });
  if (!info) throw new StromError("the bridge did not start", { hint: "strom live serve shows why" });
  const url = sendAppUrl(info.url, ctx.settings);
  const since = Date.now();
  const opened = openAppAt(ctx, url);
  const minutes = Math.max(1, Math.round(Number(ctx.env.STROM_SYNC_WAIT_MS ?? 10 * 60_000) / 60_000));
  ctx.io.stderr(`${opened ? `${ui(lang, "ui.sync.wait", { min: minutes })}\n${ui(lang, "ui.sync.wait.open", { url })}` : ui(lang, "ui.app.url", { url })}\n`);
  const until = since + Number(ctx.env.STROM_SYNC_WAIT_MS ?? 10 * 60_000);
  while (Date.now() < until) {
    if (atOnce) {
      // the newest send since: once written (or nothing new in it), said
      const sent = receivedAll(root).find((r) => Date.parse(r.at) >= since);
      if (sent && sent.state !== "pending" && sent.state !== "replaced") return sentText(tree, sent, lang);
    } else {
      const file = receivedSince(root, since);
      if (file) return { file, text: "" };
    }
    // the app sends nothing: said at once, not after the whole wait
    const why = nothingSince(root, since);
    if (why) return { text: ui(lang, `ui.sync.nothing.${why}` as UIKey), settled: why !== "no-tree" };
    await new Promise((r) => setTimeout(r, 500));
  }
  return { text: ui(lang, "ui.sync.waited", { min: minutes }) };
}

/** What became of a send the bridge wrote at once: written (and what waits for the user's decision), or nothing new in it. */
function sentText(tree: Tree, sent: Received, lang: string): { text: string; settled: true; written: Record<string, unknown> } {
  const conflicts = sent.state === "written" && sent.input ? syncConflicts(Tree.open(tree.root, tree.env), sent.input) : [];
  const written = { intake: sent.intake, state: sent.state, changes: sent.changes, ...(sent.input ? { input: sent.input } : {}), conflicts };
  const text =
    sent.state === "written" && sent.input
      ? lines(ui(lang, "ui.sync.app.written", { n: sent.changes, input: sent.input }), conflicts.length ? ui(lang, "ui.sync.app.conflicts", { n: conflicts.length }) : undefined)
      : ui(lang, "ui.sync.app.nothing");
  return { text, settled: true, written };
}

/** A family tree file without the images written into it (core/sync.ts). */
export { withoutImages };

function numbers(v: unknown, max: number): Set<number> | undefined {
  if (v === undefined) return undefined;
  const out = new Set<number>();
  for (const part of String(v).split(/[\s,;]+/).filter(Boolean)) {
    const m = /^(\d+)(?:-(\d+))?$/.exec(part);
    if (!m) throw new UsageError(`--only takes numbers of the list, e.g. 1,3,5-7 — not "${part}"`);
    for (let i = Number(m[1]); i <= Number(m[2] ?? m[1]); i++) {
      if (i < 1 || i > max) throw new UsageError(`--only: there is no change ${i} (1–${max})`);
      out.add(i);
    }
  }
  return out;
}

register(
  {
    path: ["sync"],
    summary: "A family tree coming back (the Strom app, another program): what you changed, into the research — shown first",
    group: "research",
    tree: true,
    writes: true,
    // the Strom app may take minutes to send the tree: the tree is locked only while a sync is written
    lock: "sections",
    description:
      "Compares the file with the research and shows what it would take: people, facts, names, notes, families and\n" +
      "children the file has and the research not; facts changed in it; what is no longer in it. A file of the Strom app\n" +
      "names the state of the research it was given (_STROM_HEAD): only what was changed since then counts as your edit;\n" +
      "without it (another program, an older export) only additions are taken, differences wait to be picked (--only).\n" +
      "Nothing is deleted or overwritten: additions are leads citing one source (this sync), a lead is corrected with the\n" +
      "reason, a change to a fact a record proves is a conflict for you to decide — or, with sync.edits user, your edit\n" +
      "wins and the record's fact is withdrawn with the reason. A file of another research, or one where few people are\n" +
      "the research's, is refused. Writes only with --apply; one sync is one commit: strom sync undo I… takes it back.\n" +
      "--app: the Strom app sends the tree itself — strom opens it (the bridge), the user picks the tree and confirms\n" +
      "there, strom waits for it and shows what it brings; then strom sync <the file it names> --apply.\n" +
      "The app may also send on its own (its bridge's address kept): such a tree waits in the inbox — --inbox lists\n" +
      "them, strom sync <the file> --apply writes one, strom sync discard throws it away.",
    args: [{ name: "file", description: "the tree: GEDCOM (.ged) or the Strom app's JSON (none with --app or --inbox)" }],
    options: [
      { name: "app", type: "boolean", description: "straight from the Strom app: it opens, the user sends the tree from it, strom waits for it" },
      { name: "inbox", type: "boolean", description: "the trees the Strom app sent that wait for the user's word" },
      { name: "apply", type: "boolean", description: "write it (without: only show)" },
      { name: "only", type: "string", value: "<numbers>", description: "with --apply: only these changes of the list (1,3,5-7) — a difference is taken only this way" },
      { name: "edits", type: "string", value: "<conflict|user>", description: "this once: a change to a fact a record proves is a conflict (default) or your edit wins (setting sync.edits)" },
      { name: "force", type: "boolean", description: "the file is the research's though few of its people match" },
      { name: "again", type: "boolean", description: "a file taken in before, once more" },
    ],
    examples: ["strom sync ~/Downloads/family.ged", "strom sync family.ged --apply", "strom sync family.json --apply --only 1,4"],
    async run(ctx: Context, { args, opts }) {
      const tree = ctx.tree();
      const lang = tree.lang;
      if (opts.inbox) {
        const waiting = receivedPending(tree.root);
        const at = (r: { file: string }) => ctx.display(path.join(tree.root, SYNC_INBOX, r.file));
        return {
          text: waiting.length
            ? lines(
                ui(lang, "ui.sync.inbox.title", { n: waiting.length }),
                ...waiting.map((r) => `  ${r.intake}  ${humanDay(r.at, lang)} ${r.at.slice(11, 16)}  ${ui(lang, "ui.sync.inbox.changes", { n: r.changes })}  ${at(r)}`),
                "",
                ui(lang, "ui.sync.inbox.next", { file: at(waiting[0]!) }),
              )
            : ui(lang, "ui.sync.inbox.none"),
          data: { inbox: waiting.map((r) => ({ intake: r.intake, at: r.at, changes: r.changes, file: path.join(tree.root, SYNC_INBOX, r.file), ...(r.tree ? { tree: r.tree } : {}), ...(r.sent ? { sent: r.sent } : {}), transcripts: r.transcripts })) },
        };
      }
      if (opts.app && args[0]) throw new UsageError("--app takes the tree from the Strom app — no file with it");
      if (!opts.app && !args[0]) throw new UsageError("which tree? a file, or --app (straight from the Strom app)", { hint: "strom sync ~/Downloads/family.ged · strom sync --app · what waits: strom sync --inbox", code: "sync.which", params: {} });
      if (opts.app && opts.apply) throw new UsageError("--app shows what the tree brings; write it then with the file it names", { hint: "strom sync --app, then strom sync <file> --apply" });
      let got: string | undefined;
      if (opts.app) {
        const r = await fromApp(ctx, tree, lang);
        // nothing to show: written at once by the bridge, the app said so (nothing changed, cancelled) — or never
        // answered, or has no tree of this research
        if (!r.file) return { text: r.text, data: { received: null, ...(r.written ? { written: r.written } : {}) }, exitCode: r.settled ? EXIT.ok : EXIT.needsInput };
        got = r.file;
      }
      const shownAs = got ? ctx.display(got) : args[0]!;
      const file = got ?? ctx.resolvePath(args[0]!);
      if (!fs.existsSync(file) || !fs.statSync(file).isFile()) throw new UsageError(`no such file: ${args[0]}`);
      const edits = opts.edits === undefined ? ctx.settings.syncEdits(tree.config) : String(opts.edits);
      if (edits !== "conflict" && edits !== "user") throw new UsageError("--edits is conflict or user");
      const sha = fileSha256(file);
      // the very same file as the last sync written: nothing new — the same as an earlier one, with another written
      // since, is compared (it may set back what that one changed; found on Mac: a value set back, "nothing new", lost)
      const syncs = tree.list<SyncInput>("input").filter((i) => i.sync && !i.sync.undone);
      const last = syncs.reduce<SyncInput | undefined>((a, i) => (!a || i.id > a.id ? i : a), undefined);
      const before = last?.sha === sha ? last : undefined;
      if (before && !opts.again) {
        // the app sent the very same tree again: nothing waits of it
        if (opts.apply && !tree.dryRun) settleReceived(tree.root, file, { state: "nothing" });
        return { text: ui(lang, "ui.sync.again", { input: before.id }), data: { input: before.id, changes: [] } };
      }
      const incoming = readTreeFile(file);
      // a send of the Strom app (through the bridge): nobody picks from it
      const sent = !!receivedOf(tree.root, file);
      const plan = planSync(tree, incoming, edits, { force: !!opts.force, sent });
      // a send of the app that brings nothing the research has not: nothing waits of it any more
      if (opts.apply && !plan.changes.length && !tree.dryRun) settleReceived(tree.root, file, { state: "nothing" });
      if (!opts.apply || !plan.changes.length || tree.dryRun) {
        if (opts.only !== undefined && !opts.apply) throw new UsageError("--only goes with --apply");
        return {
          text: lines(got ? ui(lang, "ui.sync.got") : undefined, planText(tree, plan, incoming, shownAs, lang, edits)),
          data: { ...(got ? { received: got } : {}), base: plan.base, head: plan.head ?? null, partial: plan.partial, changes: plan.changes, strangers: plan.identity.strangers },
        };
      }
      const only = numbers(opts.only, plan.changes.length);
      let input: SyncInput | undefined;
      let applied = 0;
      let skipped: Skipped[] = [];
      let written: Plan = plan;
      tree.withTreeLock(() => {
        // what another process wrote meanwhile counts: the changes again, now that the tree is ours — the ones picked by
        // number must be the ones shown; all of them are what the file brings now
        const now1 = readTreeFile(file);
        const fresh = planSync(tree, now1, edits as "conflict" | "user", { force: !!opts.force, sent });
        if (only && (fresh.changes.length !== plan.changes.length || fresh.changes.some((c, i) => c.kind !== plan.changes[i]!.kind || c.person !== plan.changes[i]!.person)))
          throw new UsageError("the research changed while this was shown — look again", { hint: `strom sync ${args[0] ?? file}` });
        written = fresh;
        // nothing to write (only what is said): no input, no commit — a send of the app brought nothing new
        if (!fresh.changes.some((c) => (only ? only.has(c.n) : c.action !== "pick") && c.action !== "report")) return;
        const id = tree.peekId("I");
        const size = fs.statSync(file).size;
        // what the app sent through the bridge is not kept as a file: the app sends the whole tree, maybe every few
        // minutes — a copy each time would swell the history; the commit says what it changed
        const fromApp = !!receivedOf(tree.root, file);
        const stored = !fromApp && size <= MAX_IN_TREE ? `inputs/${id}-${safeFolderName(path.basename(file))}` : undefined;
        if (stored) {
          tree.remember(path.join(tree.root, stored));
          fs.mkdirSync(path.join(tree.root, "inputs"), { recursive: true });
          // kept as the document the source cites — without the images in it (the research's own excerpts, back from
          // the app: megabytes in the history for nothing)
          fs.writeFileSync(path.join(tree.root, stored), withoutImages(fs.readFileSync(file, "utf8")));
        }
        const made = create<SyncInput>(
          tree,
          "input",
          { name: path.basename(file), ...(stored ? { file: stored } : {}), sha, size, mime: mimeOf(file), from: ctx.display(file), kind: "tree", state: "processed" } as never,
          (iid) => `+${iid} input tree "${truncate(path.basename(file), 50)}" (sync)`,
        );
        const day = humanDay(now(), lang);
        // the app's sends of one day: one source (each sync its own input and commit)
        const title = fromApp ? ui(lang, "ui.sync.source.app.day", { day }) : ui(lang, incoming.treeId || plan.identity.matched ? "ui.sync.source.app" : "ui.sync.source.file", { file: path.basename(file), day });
        const days = fromApp ? tree.list<Source>("source").filter((s) => s.kind === "family-tree" && s.title === title) : [];
        // the day's one withdrawn by an undo (nothing cited it any more): the same again, never one more (found on
        // Windows: S0004 after an undo)
        const back = days.find((s) => !s.retracted) ? undefined : days.find((s) => /^sync I\d+ undone$/.test(s.retracted?.reason ?? ""));
        if (back)
          update<Source>(tree, back.id, "source", ({ retracted: _r, ...s }) => s as Source, { op: "source.edit", summary: `${back.id} back: the app's edits of the day again` });
        const same = days.find((s) => !s.retracted) ?? (back ? tree.get<Source>(back.id) : undefined);
        const source =
          same ??
          create<Source>(
            tree,
            "source",
            {
              kind: "family-tree",
              title,
              input: made.id,
              information: "secondary",
              form: "authored",
            } as never,
            (sid) => `+${sid} source "${path.basename(file)}" (sync)`,
          );
        const { applied: done, changes, skipped: left } = applySync(tree, fresh, now1, source, only);
        applied = changes;
        skipped = left;
        input = update<SyncInput>(tree, made.id, "input", (i) => ({ ...i, source: source.id, sync: { ...(fresh.head ? { head: fresh.head } : {}), edits: edits as "conflict" | "user", applied: done } }), {
          op: "input.sync",
          summary: `${made.id} synced: ${changes} change(s)${fresh.head ? ` against ${fresh.head.slice(0, 8)}` : ""}`,
        });
      });
      if (!input) {
        settleReceived(tree.root, file, { state: "nothing", kept: written.changes.filter((c) => c.kept).length });
        return { text: lines(planText(tree, written, incoming, shownAs, lang, edits), "", ui(lang, "ui.sync.nothing.taken", { file: path.basename(file) })), data: { input: null, applied: [], changes: written.changes } };
      }
      // a send of the app waited in the inbox: written now (the app hears it through the bridge)
      settleReceived(tree.root, file, { state: "written", input: input.id, kept: written.changes.filter((c) => c.kept).length }, input.sync?.applied ?? []);
      // each send of the app a little more history: packed in the background once it has grown
      compactSoon(tree.root, ctx.env);
      return {
        text: lines(
          ...opsFor(ctx, tree),
          "",
          ui(lang, "ui.sync.done", { n: applied, file: path.basename(file), input: input.id }),
          ...skipped.map((x) => ui(lang, "ui.sync.skipped", { n: x.n, why: skippedWhy(x, lang) })),
        ),
        data: { input: input.id, applied: input.sync?.applied ?? [], changes: written.changes, conflicts: syncConflicts(tree, input.id), ...(skipped.length ? { skipped } : {}) },
      };
    },
  },
  {
    path: ["sync", "undo"],
    summary: "Take a sync back: what it added withdrawn, what it corrected put back, its conflicts closed",
    group: "research",
    tree: true,
    writes: true,
    args: [{ name: "input", description: "the sync's input (I…), as strom sync said", required: true }],
    examples: ["strom sync undo I0002"],
    run(ctx: Context, { args }) {
      const tree = ctx.tree();
      const id = args[0]!.toUpperCase().replace(/^I?(\d+)$/, (_, n: string) => `I${n.padStart(4, "0")}`);
      const input = tree.get<SyncInput>(id);
      if (!input || input.type !== "input" || !input.sync) throw new UsageError(`${args[0]} is not a sync`, { hint: "strom input list — a sync's input says so", code: "sync.not-sync", params: { input: args[0]! } });
      if (input.sync.undone) return { text: ui(tree.lang, "ui.sync.wasundone", { input: id }), data: { input: id, undone: 0 } };
      let n = 0;
      tree.withTreeLock(() => {
        n = undoSync(tree, input);
        update<SyncInput>(tree, id, "input", (i) => ({ ...i, sync: { ...i.sync!, undone: now() } }), { op: "input.sync.undo", summary: `${id} sync undone: ${n} step(s)` });
        // its source cites nothing any more: withdrawn too (the input stays — that it was sent and taken back)
        const src = input.source ? tree.get<Source>(input.source) : undefined;
        const cited = (x: { citations?: { source: string }[] }) => x.citations?.some((c) => c.source === src?.id);
        const used = (o: Person | Family) => !o.retracted && (o.events.some((e) => !e.retracted && cited(e)) || (o.type === "person" && o.names.some(cited)));
        if (src && !src.retracted && ![...tree.list<Person>("person"), ...tree.list<Family>("family")].some(used))
          update<Source>(tree, src.id, "source", (s) => ({ ...s, retracted: { at: now(), reason: `sync ${id} undone` } }), { op: "source.retract", summary: `${src.id} retracted: sync ${id} undone` });
      });
      // a send of the app it wrote: taken back (the app hears it through the bridge) — a dry run tells it nothing (found on
      // Windows: the app told "taken back" of a send nothing was taken back of)
      if (!tree.dryRun) undoReceived(tree.root, id);
      return { text: lines(...opsFor(ctx, tree), "", ui(tree.lang, "ui.sync.undone", { input: id, n })), data: { input: id, undone: n } };
    },
  },
  {
    path: ["sync", "discard"],
    summary: "Throw away a tree the Strom app sent that waits: nothing of it is written (the edits stay in the app)",
    group: "research",
    tree: true,
    description:
      "A tree the Strom app sends waits in the research's inbox until the user writes it (strom sync <file> --apply) or\n" +
      "throws it away here. The app hears that it was thrown away, the edits stay in the app — it may send them again.\n" +
      "The user's decision: an agent never throws away what the user sent.",
    args: [{ name: "intake", description: "the send (R…, as strom sync --inbox lists it); none: every one that waits" }],
    options: [{ name: "reason", type: "string", value: "<text>", description: "why, in the user's words (the app shows it)" }],
    examples: ["strom sync --inbox", 'strom sync discard --reason "sent by mistake"'],
    run(ctx: Context, { args, opts }) {
      const tree = ctx.tree();
      const lang = tree.lang;
      const pending = receivedPending(tree.root);
      if (args[0] && !pending.some((r) => r.intake === args[0])) throw new UsageError(`no tree of the app waits as ${args[0]}`, { hint: "strom sync --inbox lists what waits" });
      const gone = tree.dryRun ? [] : discardReceived(tree.root, args[0] ? [args[0]] : [], typeof opts.reason === "string" ? opts.reason : undefined);
      return { text: ui(lang, gone.length ? "ui.sync.discarded" : "ui.sync.inbox.none", { n: gone.length }), data: { discarded: gone.map((r) => r.intake) } };
    },
  },
);

