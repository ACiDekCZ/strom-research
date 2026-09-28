// sync · sync undo — a family tree coming back from the Strom app (or another
// program), compared with the research: what the user changed, taken in on
// their yes (core/sync.ts).

import fs from "node:fs";
import path from "node:path";
import { register } from "../cli/registry.ts";
import type { Context } from "../cli/context.ts";
import { lines, truncate } from "../cli/format.ts";
import { ui, type UIKey } from "../cli/ui.ts";
import { eventName, humanDate, humanDay, humanPlace } from "../cli/human.ts";
import { EXIT, StromError, UsageError } from "../core/errors.ts";
import type { Person, Source } from "../core/model.ts";
import { fileSha256, MAX_IN_TREE, mimeOf } from "../core/media.ts";
import { create, update } from "../core/records.ts";
import { safeFolderName } from "../core/text.ts";
import { now, type Tree } from "../core/tree.ts";
import { applySync, nothingSince, planSync, readTreeFile, receivedSince, undoSync, type Change, type Plan, type SFact, type Snapshot, type SyncInput } from "../core/sync.ts";
import { startLive } from "../core/live.ts";
import { appSendsChanges, installedStromApp, sendAppUrl, stromAppUrl } from "../core/stromapp.ts";
import { chromiumBrowser, openInBrowser, openWebApp } from "../core/chromium.ts";

function factText(f: SFact | undefined, lang: string): string {
  if (!f) return "—";
  return [f.value, humanDate(f.date, lang), humanPlace(f.place, undefined, lang)].filter(Boolean).join(", ") || "—";
}

/** A position on the map as a map shows it: degrees, six decimals at most. */
const point = (p: { lat: number; lon: number }) => `${+p.lat.toFixed(6)}, ${+p.lon.toFixed(6)}`;

/** One change as the user reads it, with what strom does with it. */
function changeLine(tree: Tree, c: Change, incoming: Snapshot, lang: string): string {
  const name = (key: string | undefined) => {
    if (!key) return "?";
    if (key.startsWith("x:")) return (incoming.persons.get(key)?.names[0] ?? key).replace(/\//g, "").replace(/\s+/g, " ").trim();
    const p = tree.get<Person>(key);
    return p ? `${(p.names[0] ? `${p.names[0].given} ${p.names[0].surname}` : key).trim()} [${key}]` : key;
  };
  const who = c.partners ? c.partners.map(name).join(" & ") || c.family || "?" : name(c.person);
  const kind = (f: SFact | undefined) => (f ? eventName(f.kind, lang, f.label) : "");
  const v = {
    n: c.n,
    who,
    name: name(c.person),
    kind: kind(c.fact ?? c.was),
    fact: `${kind(c.fact ?? c.was)} ${factText(c.fact ?? c.was, lang)}`,
    was: factText(c.was, lang),
    now: factText(c.fact, lang),
    text: truncate(c.text ?? "", 120),
    child: name(c.child),
    kids: c.kind === "family.new" && c.text ? ` + ${c.text.split(" ").filter(Boolean).map(name).join(", ")}` : "",
    place: c.place?.name ?? "",
    at: c.place ? point(c.place) : "",
    from: c.place?.was ? point(c.place.was) : "",
  };
  const key = c.kind === "place.coords" && !c.place?.was ? "ui.sync.place.located" : `ui.sync.${c.kind}`;
  return `${ui(lang, key as UIKey, v)} → ${ui(lang, `ui.sync.do.${c.action}` as UIKey)}`;
}

function planText(tree: Tree, plan: Plan, incoming: Snapshot, file: string, lang: string, edits: string): string {
  const shown = file.includes(" ") ? `"${file}"` : file;
  if (!plan.changes.length) return ui(lang, "ui.sync.nothing", { file: path.basename(file) });
  return lines(
    ui(lang, "ui.sync.title", { file: path.basename(file), n: plan.changes.length }),
    plan.base ? ui(lang, "ui.sync.base", { head: plan.head!.slice(0, 8) }) : ui(lang, plan.head ? "ui.sync.headmissing" : "ui.sync.nobase", { head: plan.head?.slice(0, 8) ?? "" }),
    plan.partial ? ui(lang, "ui.sync.partial") : undefined,
    plan.identity.strangers.length ? ui(lang, "ui.sync.strangers", { ids: plan.identity.strangers.join(", ") }) : undefined,
    "",
    ...plan.changes.map((c) => `  ${changeLine(tree, c, incoming, lang)}`),
    "",
    ui(lang, "ui.sync.edits", { mode: ui(lang, edits === "user" ? "ui.sync.mode.user" : "ui.sync.mode.conflict") }),
    ui(lang, "ui.sync.next", { file: shown }),
  );
}

/** The Strom app at this address: installed from a Chromium browser first, else in such a browser's tab (never Safari: it cannot reach the bridge). */
export function openAppAt(ctx: Context, url: string): boolean {
  const installed = installedStromApp(ctx.env, process.platform, stromAppUrl(ctx.settings));
  const webApp = installed?.appId && installed.browser ? { browser: installed.browser, appId: installed.appId, ...(installed.profile ? { profile: installed.profile } : {}) } : undefined;
  const browser = chromiumBrowser(ctx.env);
  return Boolean((webApp && openWebApp(webApp, url, ctx.env)) || (browser && openInBrowser(browser, url, ctx.env)));
}

/**
 * The Strom app sends the tree itself: the bridge started, the app opened with ?send= (installed from a Chromium
 * browser first, else in such a browser's tab), and the tree waited for. The file it came as, or what to do instead.
 */
async function fromApp(ctx: Context, root: string, lang: string): Promise<{ file?: string; text: string; settled?: boolean }> {
  if (!appSendsChanges(ctx.settings)) return { text: ui(lang, "ui.sync.nosend") };
  const info = startLive(root, ctx.env, { current: true });
  if (!info) throw new StromError("the bridge did not start", { hint: "strom live serve shows why" });
  const url = sendAppUrl(info.url, ctx.settings);
  const since = Date.now();
  const opened = openAppAt(ctx, url);
  const minutes = Math.max(1, Math.round(Number(ctx.env.STROM_SYNC_WAIT_MS ?? 10 * 60_000) / 60_000));
  ctx.io.stderr(`${opened ? `${ui(lang, "ui.sync.wait", { min: minutes })}\n${ui(lang, "ui.sync.wait.open", { url })}` : ui(lang, "ui.app.url", { url })}\n`);
  const until = since + Number(ctx.env.STROM_SYNC_WAIT_MS ?? 10 * 60_000);
  while (Date.now() < until) {
    const file = receivedSince(root, since);
    if (file) return { file, text: "" };
    // the app sends nothing: said at once, not after the whole wait
    const why = nothingSince(root, since);
    if (why) return { text: ui(lang, `ui.sync.nothing.${why}` as UIKey), settled: why !== "no-tree" };
    await new Promise((r) => setTimeout(r, 500));
  }
  return { text: ui(lang, "ui.sync.waited", { min: minutes }) };
}

/** A family tree file without the images written into it (data: URLs): a GEDCOM's FILE with its CONC lines, a JSON's strings. */
export function withoutImages(text: string): string {
  const left = (bytes: number) => `[image left out, ${Math.round(bytes / 1024)} kB]`;
  // GEDCOM: n FILE data:… and the n+1 CONC/CONT lines that go on with it
  const ged = text.replace(/^(\d+) FILE data:[^\r\n]*(?:\r?\n(?:\d+) CON[CT] [^\r\n]*)*/gm, (m, level: string) => `${level} FILE ${left(m.length)}`);
  // JSON: "data:image/…;base64,…"
  return ged.replace(/"data:image\/[^"]*"/g, (m) => `"${left(m.length)}"`);
}

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
      "there, strom waits for it and shows what it brings; then strom sync <the file it names> --apply.",
    args: [{ name: "file", description: "the tree: GEDCOM (.ged) or the Strom app's JSON (none with --app)" }],
    options: [
      { name: "app", type: "boolean", description: "straight from the Strom app: it opens, the user sends the tree from it, strom waits for it" },
      { name: "apply", type: "boolean", description: "write it (without: only show)" },
      { name: "only", type: "string", value: "<numbers>", description: "with --apply: only these changes of the list (1,3,5-7) — a difference is taken only this way" },
      { name: "edits", type: "string", value: "<conflict|user>", description: "this once: a change to a fact a record proves is a conflict (default) or your edit wins (setting sync.edits)" },
      { name: "force", type: "boolean", description: "the file is the research's though few of its people match" },
      { name: "again", type: "boolean", description: "a file taken in before, once more" },
    ],
    examples: ["strom sync ~/Downloads/rodina.ged", "strom sync rodina.ged --apply", "strom sync rodina.json --apply --only 1,4"],
    async run(ctx: Context, { args, opts }) {
      const tree = ctx.tree();
      const lang = tree.lang;
      if (opts.app && args[0]) throw new UsageError("--app takes the tree from the Strom app — no file with it");
      if (!opts.app && !args[0]) throw new UsageError("which tree? a file, or --app (straight from the Strom app)", { hint: "strom sync ~/Downloads/rodina.ged · strom sync --app" });
      if (opts.app && opts.apply) throw new UsageError("--app shows what the tree brings; write it then with the file it names", { hint: "strom sync --app, then strom sync <file> --apply" });
      let got: string | undefined;
      if (opts.app) {
        const r = await fromApp(ctx, tree.root, lang);
        // nothing to show: the app said so (nothing changed, cancelled) — or never answered, or has no tree of this research
        if (!r.file) return { text: r.text, data: { received: null }, exitCode: r.settled ? EXIT.ok : EXIT.needsInput };
        got = r.file;
      }
      const shownAs = got ? ctx.display(got) : args[0]!;
      const file = got ?? ctx.resolvePath(args[0]!);
      if (!fs.existsSync(file) || !fs.statSync(file).isFile()) throw new UsageError(`no such file: ${args[0]}`);
      const edits = opts.edits === undefined ? ctx.settings.syncEdits(tree.config) : String(opts.edits);
      if (edits !== "conflict" && edits !== "user") throw new UsageError("--edits is conflict or user");
      const sha = fileSha256(file);
      const before = tree.list<SyncInput>("input").find((i) => i.sha === sha && i.sync && !i.sync.undone);
      if (before && !opts.again) return { text: ui(lang, "ui.sync.again", { input: before.id }), data: { input: before.id, changes: [] } };
      const incoming = readTreeFile(file);
      const plan = planSync(tree, incoming, edits, { force: !!opts.force });
      if (!opts.apply || !plan.changes.length || tree.dryRun) {
        if (opts.only !== undefined && !opts.apply) throw new UsageError("--only goes with --apply");
        return {
          text: lines(got ? ui(lang, "ui.sync.got") : undefined, planText(tree, plan, incoming, shownAs, lang, edits)),
          data: { ...(got ? { received: got } : {}), base: plan.base, head: plan.head ?? null, partial: plan.partial, changes: plan.changes, strangers: plan.identity.strangers },
        };
      }
      const only = numbers(opts.only, plan.changes.length);
      let input!: SyncInput;
      let applied = 0;
      tree.withTreeLock(() => {
        // what another process wrote meanwhile counts: the changes again, now that the tree is ours
        const fresh = planSync(tree, readTreeFile(file), edits as "conflict" | "user", { force: !!opts.force });
        if (fresh.changes.length !== plan.changes.length || fresh.changes.some((c, i) => c.kind !== plan.changes[i]!.kind || c.person !== plan.changes[i]!.person))
          throw new UsageError("the research changed while this was shown — look again", { hint: `strom sync ${args[0] ?? file}` });
        const id = tree.peekId("I");
        const size = fs.statSync(file).size;
        const stored = size <= MAX_IN_TREE ? `inputs/${id}-${safeFolderName(path.basename(file))}` : undefined;
        if (stored) {
          tree.remember(path.join(tree.root, stored));
          fs.mkdirSync(path.join(tree.root, "inputs"), { recursive: true });
          // kept as the document the source cites — without the images in it (the research's own excerpts, back from
          // the app: megabytes in the history for nothing)
          fs.writeFileSync(path.join(tree.root, stored), withoutImages(fs.readFileSync(file, "utf8")));
        }
        input = create<SyncInput>(
          tree,
          "input",
          { name: path.basename(file), ...(stored ? { file: stored } : {}), sha, size, mime: mimeOf(file), from: ctx.display(file), kind: "tree", state: "processed" } as never,
          (iid) => `+${iid} input tree "${truncate(path.basename(file), 50)}" (sync)`,
        );
        const day = humanDay(now(), lang);
        const source = create<Source>(
          tree,
          "source",
          {
            kind: "family-tree",
            title: ui(lang, incoming.treeId || plan.identity.matched ? "ui.sync.source.app" : "ui.sync.source.file", { file: path.basename(file), day }),
            input: input.id,
            information: "secondary",
            form: "authored",
          } as never,
          (sid) => `+${sid} source "${path.basename(file)}" (sync)`,
        );
        const { applied: done, changes } = applySync(tree, plan, incoming, source, only);
        applied = changes;
        input = update<SyncInput>(tree, input.id, "input", (i) => ({ ...i, source: source.id, sync: { ...(plan.head ? { head: plan.head } : {}), edits: edits as "conflict" | "user", applied: done } }), {
          op: "input.sync",
          summary: `${input.id} synced: ${changes} change(s)${plan.head ? ` against ${plan.head.slice(0, 8)}` : ""}`,
        });
      });
      return {
        text: lines(...tree.written.map((o) => o.summary), "", ui(lang, "ui.sync.done", { n: applied, file: path.basename(file), input: input.id })),
        data: { input: input.id, applied: input.sync?.applied ?? [], changes: plan.changes },
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
      if (!input || input.type !== "input" || !input.sync) throw new UsageError(`${args[0]} is not a sync`, { hint: "strom input list — a sync's input says so" });
      if (input.sync.undone) return { text: ui(tree.lang, "ui.sync.wasundone", { input: id }), data: { input: id, undone: 0 } };
      let n = 0;
      tree.withTreeLock(() => {
        n = undoSync(tree, input);
        update<SyncInput>(tree, id, "input", (i) => ({ ...i, sync: { ...i.sync!, undone: now() } }), { op: "input.sync.undo", summary: `${id} sync undone: ${n} step(s)` });
      });
      return { text: lines(...tree.written.map((o) => o.summary), "", ui(tree.lang, "ui.sync.undone", { input: id, n })), data: { input: id, undone: n } };
    },
  },
);

