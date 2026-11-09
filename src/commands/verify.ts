// strom verify facts|bulk|stop|done|confirm|status (strom verify alone is the seal check, commands/checks.ts): the facts against their originals (spec 065) — the person's "verify" of a person, a family or a fact
// (first in the queue), the person's bulk verification of a line, a lineage or the tree (after the lines' work), the
// agent's result of each fact (strom verify done), the person's confirmation against the scan (the bridge, hidden) and
// what waits (strom verify status). The work is core/verify.ts; here the words, who may run what, and the archive.

import { register } from "../cli/registry.ts";
import type { Context } from "../cli/context.ts";
import { lines } from "../cli/format.ts";
import { ui } from "../cli/ui.ts";
import { UsageError, StromError } from "../core/errors.ts";
import { BULK_ORDERS, BULK_SCOPES, emptyFunnel, taskPlaces, verifyAsk, verifyStop, verifyCandidates, verifyBulk, verifyConfirmAll, verifyCounts, verifyFactDone, type AskResult, type Estimate, type VerifyTarget } from "../core/verify.ts";
import { displayName, resolvePerson } from "../core/people.ts";
import { actsAsArchive, refuseInArchive } from "../core/state.ts";
import { detectAgent, isAgent } from "../core/which.ts";
import { currentSession } from "../core/session.ts";
import { DEATH_AFTER_YEARS } from "../core/review.ts";
import type { Family, Person } from "../core/model.ts";
import type { Tree } from "../core/tree.ts";

/** Its tasks are the agent's work: refused where nobody researches, before anything is asked or written. */
function refuse(ctx: Context, tree: Tree, what: string): void {
  refuseInArchive(tree, what, detectAgent(ctx.env) ?? ctx.settings.agent(tree.config).value);
}

/** What a word names: a fact (E…), a family (F…), else a person (ID or name). */
function targetOf(tree: Tree, ref: string): { target: VerifyTarget; name: string } {
  const r = ref.trim();
  if (/^[Ee]\p{N}{4,}$/u.test(r)) return { target: { fact: r.toUpperCase() }, name: r.toUpperCase() };
  if (/^[Ff]\p{N}{4,}$/u.test(r)) {
    const f = tree.get<Family>(r.toUpperCase());
    const names = f && f.type === "family" ? f.partners.map((p) => tree.get<Person>(p)).filter((p): p is Person => !!p).map((p) => displayName(p)) : [];
    return { target: { family: r.toUpperCase() }, name: names.length ? `${r.toUpperCase()} ${names.join(" + ")}` : r.toUpperCase() };
  }
  const p = resolvePerson(tree, r);
  return { target: { person: p.id }, name: `${p.id} ${displayName(p)}` };
}

const estimateLine = (lang: string, e: Estimate): string =>
  e.usd !== undefined ? ui(lang, "ui.verify.estimate.usd", { sessions: e.sessions, usd: e.usd.toFixed(2) }) : ui(lang, "ui.verify.estimate", { sessions: e.sessions });

const num = (v: unknown, what: string): number | undefined => {
  if (v === undefined) return undefined;
  const n = Number(String(v).replace(",", "."));
  if (!Number.isFinite(n)) throw new UsageError(`--${what} must be a number`, { code: "verify.invalid" });
  return n;
};

register({
  path: ["verify", "facts"],
  summary: "Verify a person's facts, a family's or one fact against their originals: first in the queue",
  group: "research",
  tree: true,
  writes: true,
  description:
    "The user's \"verify\": every fact of the person (and of their marriages), of the family or the one fact named —\n" +
    "not confirmed by the user against the scan, not disproven — becomes a task of verification before all else in\n" +
    "the queue. A fact citing its original record (primary information) is read against the image of it; one that\n" +
    "cites none is looked for first by what its citation names (dearer: two sessions). A fact a task of verification\n" +
    "holds already: that task comes first, nothing doubled. Nothing is raised without a look at the original, no\n" +
    "value is overwritten: the agent ends each fact with strom verify done. --dry-run: what it would queue and the\n" +
    "estimate, nothing written. Someone most likely alive only with --living (the user asked for it). --json: each\n" +
    "task (tasks: task, state wait|asked|images|permission, position in the queue only while it waits there, facts),\n" +
    "nearest to its turn first.",
  args: [{ name: "whom", description: "whom: a person (ID or name), a family (F…), a fact (E…); several at once", variadic: true, unless: ["fact"] }],
  options: [
    { name: "fact", type: "string", value: "<E…>", multiple: true, description: "one fact (again for more)" },
    { name: "living", type: "boolean", description: "verify someone most likely alive (born less than 100 years ago) all the same — the user asked for it" },
  ],
  examples: ["strom verify facts P0001", "strom verify facts P0001 --dry-run", "strom verify facts --fact E0001", "strom verify facts F0001", "strom verify facts P0001 --living"],
  async run(ctx: Context, { args, opts }) {
    const tree = ctx.tree();
    refuse(ctx, tree, "strom verify facts");
    const facts = ([] as string[]).concat((opts.fact as string[] | string | undefined) ?? []);
    const refs = [...args, ...facts];
    if (!refs.length) throw new UsageError("whom? a person, a family (F…) or a fact (--fact E…)", { code: "verify.invalid", hint: "strom verify facts P0001 · strom verify facts --fact E0012 · strom verify bulk --scope tree --dry-run" });
    const lang = tree.lang;
    const dry = tree.dryRun;
    const out: string[] = [];
    const done: (AskResult & { target: VerifyTarget })[] = [];
    let living = !!opts.living;
    for (const ref of refs) {
      const { target, name } = targetOf(tree, ref);
      let r: AskResult;
      try {
        r = verifyAsk(tree, target, { dry, living });
      } catch (e) {
        // the living are the family's to tell: a person at the terminal is asked; an agent asks the user
        if (!(e instanceof StromError) || e.code !== "verify.living" || living || !ctx.interactive || isAgent(ctx.env) || ctx.yes) throw e;
        if (!(await ctx.confirm(ui(lang, "ui.review.living", { who: name, years: DEATH_AFTER_YEARS }), false))) return { text: ui(lang, "ui.review.living.no"), data: { tasks: [], facts: [], living: true } };
        living = true;
        r = verifyAsk(tree, target, { dry, living });
      }
      done.push({ ...r, target });
      out.push(ui(lang, dry ? "ui.verify.would" : "ui.verify.queued", { name, n: r.facts.length }));
      for (const f of r.facts) out.push(ui(lang, f.how === "read" ? "ui.verify.how.read" : "ui.verify.how.search", { fact: f.fact, kind: f.kind }));
    }
    const sessions = done.reduce((n, r) => n + r.estimate.sessions, 0);
    const usd = done.every((r) => r.estimate.usd !== undefined) ? Math.round(done.reduce((n, r) => n + r.estimate.usd!, 0) * 100) / 100 : undefined;
    const estimate: Estimate = { sessions, ...(usd !== undefined ? { usd } : {}) };
    out.push(estimateLine(lang, estimate));
    // every task asked for (a person's and their marriages'), nearest to its turn first: how each waits, its place in
    // the queue (wait, asked — as 3 _POS), its facts; the first one's on top (Dotazy 2 of the app)
    const places = dry ? [] : taskPlaces(tree, done.flatMap((r) => r.tasks));
    const first = places[0];
    return {
      text: lines(...out),
      data: {
        dryRun: dry,
        task: first?.task ?? null,
        ...(first ? { state: first.state } : {}),
        ...(first?.position !== undefined ? { position: first.position } : {}),
        tasks: places,
        facts: done.flatMap((r) => r.facts),
        estimate,
        targets: done.map((r) => ({ ...r.target, tasks: r.tasks, facts: r.facts.map((f) => f.fact) })),
      },
    };
  },
});

register({
  path: ["verify", "bulk"],
  summary: "Verify the facts of a line, a lineage or the whole tree against their originals, after the lines' work",
  group: "research",
  tree: true,
  writes: true,
  person: "Verifying a line, a lineage or the tree in bulk is the user's own (it costs sessions of the agent): tell the user what --dry-run says, they start it themselves (strom's menu or the app)",
  agentMay: { when: "--dry-run: what it would queue and the estimate, nothing written", check: (_ctx, { opts }) => !!opts["dry-run"] },
  description:
    "Every fact of a birth, a baptism, a marriage, a death or a burial with its original record cited (primary\n" +
    "information), not confirmed by the user — proven ones too, verified by another reader — but those the model\n" +
    "reading now verified already; nobody living, nothing a task holds. One task per person (a marriage per family),\n" +
    "low priority: after the lines' work, now and then one first. A line (--of G…), a lineage (--of P…: its founder\n" +
    "and who carries it on through the sons) or the tree. A family tree's leads too (facts of an imported family\n" +
    "tree, no original read): the record their citation names looked for first, a task of its own (dearer: two\n" +
    "sessions). --try n: the first n people; --budget: as many as the estimate fits (once sessions were measured\n" +
    "here). --dry-run: the counts (--json how: read, search) and the estimate, nothing written.",
  options: [
    { name: "scope", type: "string", value: "<line|lineage|tree>", description: "what: a line (G…), a lineage (its founder P…), the whole tree" },
    { name: "of", type: "string", value: "<G…|P…>", description: "the line (G…) or the lineage's founder (P…)" },
    { name: "order", type: "string", value: "<ancestors|weakest|oldest>", description: "who first: the nearest ancestors (default), the weakest facts, the longest unverified" },
    { name: "try", type: "string", value: "<n>", description: "only the first n people: a try before the rest" },
    { name: "budget", type: "string", value: "<usd>", description: "only as many people as the estimate fits in this amount (USD)" },
  ],
  examples: ["strom verify bulk --scope tree --dry-run", "strom verify bulk --scope line --of G0001 --try 3", "strom verify bulk --scope lineage --of P0001 --order weakest --budget 20"],
  run(ctx: Context, { opts }) {
    const tree = ctx.tree();
    refuse(ctx, tree, "strom verify bulk");
    const scope = opts.scope as string | undefined;
    if (!scope) throw new UsageError(`which scope? --scope ${BULK_SCOPES.join("|")}`, { code: "verify.invalid", hint: "strom verify bulk --scope tree --dry-run" });
    const tryN = num(opts.try, "try");
    const budget = num(opts.budget, "budget");
    const agent = ctx.settings.agent(tree.config).value;
    const model = ctx.settings.models(agent, tree.config).vision;
    const dry = tree.dryRun;
    const r = verifyBulk(tree, {
      scope: scope as (typeof BULK_SCOPES)[number],
      ...(opts.of !== undefined ? { of: String(opts.of) } : {}),
      ...(opts.order !== undefined ? { order: opts.order as (typeof BULK_ORDERS)[number] } : {}),
      ...(tryN !== undefined ? { try: tryN } : {}),
      ...(budget !== undefined ? { budget } : {}),
      ...(model ? { model } : {}),
      dry,
    });
    const lang = tree.lang;
    return {
      text: lines(
        ui(lang, dry ? "ui.verify.bulk.would" : "ui.verify.bulk.queued", { people: r.people, facts: r.facts }),
        r.how.search ? ui(lang, "ui.verify.bulk.search", { n: r.how.search }) : undefined,
        estimateLine(lang, r.estimate),
        r.left ? ui(lang, "ui.verify.bulk.left", { n: r.left }) : undefined,
      ),
      data: { dryRun: dry, ...r },
    };
  },
});

register({
  path: ["verify", "stop"],
  summary: "Stop the verification against the originals: the tasks nobody started are dropped",
  group: "research",
  tree: true,
  writes: true,
  person: "Stopping the verification is the user's own: tell the user, they stop it themselves (the app or strom verify stop in their terminal)",
  description:
    "Every task of verification nobody has started — the fix's, the sweep's, the bulk verification's and those the\n" +
    "user asked for — is dropped; --bulk: only the bulk verification's. A task at work in a session goes on. The facts\n" +
    "are not queued again by themselves until one cites a new original or the user asks again (strom verify facts,\n" +
    "strom verify bulk). Nothing waiting: nothing written.",
  options: [{ name: "bulk", type: "boolean", description: "only the bulk verification's tasks" }],
  examples: ["strom verify stop", "strom verify stop --bulk"],
  run(ctx: Context, { opts }) {
    const tree = ctx.tree();
    refuse(ctx, tree, "strom verify stop");
    const r = verifyStop(tree, { bulk: !!opts.bulk });
    const lang = tree.lang;
    return {
      text: r.dropped.length ? ui(lang, "ui.verify.stopped", { tasks: r.dropped.length, facts: r.facts }) : ui(lang, "ui.verify.stopped.none"),
      data: { dropped: r.dropped.length, tasks: r.dropped, facts: r.facts },
    };
  },
});

register({
  path: ["verify", "done"],
  summary: "The result of a fact's verification against its original: proven (the image looked at) or kept with the reason",
  group: "research",
  tree: true,
  writes: true,
  description:
    "Inside a session alone, for a fact of a task of verification (or any fact checked against its original):\n" +
    "--proven --image M… (or B…:n) — the image of the original the fact cites, looked at; the status is raised as\n" +
    "its citations allow. --kept --reason \"…\" — it stays as it is, the reason in the research language (the app\n" +
    "shows it). The value is never changed here: a different value goes through strom event edit with its source.\n" +
    "A fact the user confirmed against the scan is theirs. The task is done once each of its facts is.",
  args: [{ name: "fact", description: "the fact (E…); several with the same result", required: true, variadic: true }],
  options: [
    { name: "proven", type: "boolean", description: "the original looked at says it: proven" },
    { name: "image", type: "string", value: "<M…|B…:n>", description: "with --proven: the image of the original looked at" },
    { name: "kept", type: "boolean", description: "it stays as it is, with --reason" },
    { name: "reason", type: "string", value: "<text>", description: "with --kept: why it stays (research language)" },
  ],
  examples: ["strom verify done E0001 --proven --image M0003", 'strom verify done E0001 --kept --reason "…"'],
  sheet: "one of --proven --image M… / --kept --reason",
  run(ctx: Context, { args, opts }) {
    const tree = ctx.tree();
    refuse(ctx, tree, "strom verify done");
    if (!!opts.proven === !!opts.kept) throw new UsageError("one of --proven (with --image M…) or --kept (with --reason \"…\")", { code: "verify.invalid" });
    if (opts.kept && opts.image) throw new UsageError("--image goes with --proven", { code: "verify.invalid" });
    if (opts.proven && opts.reason) throw new UsageError("--reason goes with --kept", { code: "verify.invalid" });
    const session = currentSession(tree, ctx.env);
    if (!session)
      throw new UsageError("the result of a verification is written inside an agent's session", {
        code: "verify.session",
        hint: "strom session start (or the task's session); the user confirms a fact against the scan in the app",
      });
    const results = args.map((ref) =>
      verifyFactDone(tree, ref, {
        result: opts.proven ? "proven" : "kept",
        ...(opts.image !== undefined ? { image: String(opts.image) } : {}),
        ...(opts.reason !== undefined ? { reason: String(opts.reason) } : {}),
        session,
      }),
    );
    return {
      text: lines(
        ...results.map(
          (r) => `${r.fact} (${r.owner}): ${r.result === "proven" ? `proven${r.readers ? " — two readers agree" : ""}` : `stays ${r.status}`}${r.ended ? ` · ${r.ended} done` : r.task ? ` · ${r.task} goes on` : ""}`,
        ),
      ),
      data: { results },
    };
  },
});

register({
  path: ["verify", "confirm"],
  summary: "The user's confirmation of a fact against the scan (or its taking back)",
  group: "research",
  tree: true,
  writes: true,
  hidden: true,
  description: "The user's own (the app, through the bridge): the fact is marked confirmed against the scan, its status as it is; tasks of verification leave it. --undo takes it back.",
  args: [{ name: "fact", description: "the fact (E…)", required: true, variadic: true }],
  options: [
    { name: "undo", type: "boolean", description: "take the confirmation back" },
    { name: "txt", type: "string", value: "<mark>[,<mark>…]", description: "the mark of the value seen, as the Strom file gives it (3 _TXT under 2 _STROM_EID), one for each fact: a fact changed since and nothing is written (confirm.changed)" },
  ],
  examples: ["strom verify confirm E0001", "strom verify confirm E0001 --undo"],
  run(ctx: Context, { args, opts }) {
    const tree = ctx.tree();
    const undo = !!opts.undo;
    const txts = opts.txt === undefined ? undefined : String(opts.txt).split(",").map((t) => t.trim());
    if (txts?.some((t) => !/^[0-9a-f]{16}$/iu.test(t))) throw new UsageError(`not a fact's mark: ${String(opts.txt)}`, { code: "factconfirm.invalid", hint: "the mark the Strom file gives under 2 _STROM_EID (3 _TXT): 16 hex characters" });
    const set = ["strom verify confirm", ...args, ...(undo ? ["--undo"] : []), ...(txts ? [`--txt ${txts.join(",")}`] : [])].join(" ");
    // the person's own: the app through the bridge, or the person's terminal
    if (!tree.personWrites) ctx.requireHuman(undo ? "Take back the confirmation against the scan?" : "Confirm the fact against the scan?", set, "verify", undefined, { window: false });
    const lang = tree.lang;
    const results = verifyConfirmAll(tree, args, !undo, txts);
    return {
      text: lines(...results.map((r) => (r.same ? ui(lang, "ui.verify.same", { fact: r.fact }) : ui(lang, undo ? "ui.verify.unconfirmed" : "ui.verify.confirmed", { fact: r.fact })))),
      data: { results },
    };
  },
});

register({
  path: ["verify", "status"],
  summary: "What waits to be verified against the originals, and what was",
  group: "research",
  tree: true,
  description:
    "The facts waiting in tasks of verification (asked for by the user, waiting for the scans or an archive's\n" +
    "permission apart), those kept with a reason, those the user confirmed against the scan, the one queueing of an\n" +
    "older research — and the sweep's selection now in one line: the facts probable or possible, those citing their\n" +
    "original, of the kinds verified, left out (off the tree, side branches, living) and new (--json: funnel).",
  examples: ["strom verify status", "strom verify status --json"],
  run(ctx: Context) {
    const tree = ctx.tree();
    const lang = tree.lang;
    const c = verifyCounts(tree);
    // an archive says nothing of an agent: what the person confirmed, what stays with its reason
    if (actsAsArchive(tree)) {
      const data = { confirmed: c.confirmed, kept: c.kept };
      const any = c.confirmed || c.kept;
      return {
        text: any
          ? lines(ui(lang, "ui.verify.status.title"), c.kept ? ui(lang, "ui.verify.status.kept", { n: c.kept }) : undefined, c.confirmed ? ui(lang, "ui.verify.status.confirmed", { n: c.confirmed }) : undefined)
          : ui(lang, "ui.verify.status.none"),
        data,
      };
    }
    // the sweep's selection now (verifyCandidates): how many each filter left, and of how many people and families
    const counted = emptyFunnel();
    const items = verifyCandidates(tree, counted);
    const funnel = { ...counted, owners: new Set(items.map((i) => i.owner)).size };
    const any = c.waiting || c.kept || c.confirmed || c.fix;
    return {
      text: any
        ? lines(
            ui(lang, "ui.verify.status.title"),
            ui(lang, "ui.verify.status.waiting", { n: c.waiting }),
            c.asked ? ui(lang, "ui.verify.status.asked", { n: c.asked }) : undefined,
            c.images ? ui(lang, "ui.verify.status.images", { n: c.images }) : undefined,
            c.permission ? ui(lang, "ui.verify.status.permission", { n: c.permission }) : undefined,
            c.kept ? ui(lang, "ui.verify.status.kept", { n: c.kept }) : undefined,
            c.confirmed ? ui(lang, "ui.verify.status.confirmed", { n: c.confirmed }) : undefined,
            c.fix ? ui(lang, "ui.verify.status.fix", { facts: c.fix.facts, people: c.fix.people, date: c.fix.at.slice(0, 10) }) : undefined,
            funnel.weak ? ui(lang, "ui.verify.status.funnel", funnel) : undefined,
          )
        : lines(ui(lang, "ui.verify.status.none"), funnel.weak ? ui(lang, "ui.verify.status.funnel", funnel) : undefined),
      data: { ...c, funnel },
    };
  },
});
