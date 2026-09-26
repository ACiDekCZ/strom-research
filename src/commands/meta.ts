// Orientation and self-description: `strom` (no arguments), `strom guide`,
// `strom commands`, `strom help`. An agent with no prior knowledge learns
// from these what strom is and what to do next.

import fs from "node:fs";
import path from "node:path";
import { newerVersion } from "../core/update.ts";
import { appOpensResearch, installedStromApp, stromAppUrl } from "../core/stromapp.ts";
import { register, commands, describe, GROUPS } from "../cli/registry.ts";
import { UsageError } from "../core/errors.ts";
import type { Context } from "../cli/context.ts";
import { helpFor } from "../cli/help.ts";
import { lines, table } from "../cli/format.ts";
import { guideText } from "./guide.ts";
import { langName } from "../core/lang.ts";
import { ui, type UIKey } from "../cli/ui.ts";
import { VERSION } from "../core/tree.ts";
import { gitVersion } from "../core/git.ts";
import { linuxGitCommand } from "../core/deps.ts";
import { verifyFast } from "../core/integrity.ts";
import { currentSession, openSessions } from "../core/session.ts";
import { readByOtherModels } from "../core/review.ts";
import { liveHolder } from "../core/lock.ts";
import { isAgent } from "../core/which.ts";
import { agentsHere } from "../core/apps.ts";
import { taskQueue, waitingForUser, waitingLines } from "./tasks.ts";
import type { Person, Research, Session } from "../core/model.ts";
import { liveWorkers, runAlive } from "../core/workers.ts";
import { label } from "../core/people.ts";

interface Orientation {
  version: string;
  home?: string;
  trees: { name: string; root: string; lang: string }[];
  tree?: { name: string; root: string; lang: string; persons: number; families: number; errors: number; warnings: number };
  /** Other agents at work in this tree right now, and their tasks. */
  working?: { who: string; since: string; session?: string; task?: string }[];
  researches?: { id: string; name: string; state: string; focus: string }[];
  /** The GEDCOM for the user, and the Strom app: installed here, to be offered, or not wanted. */
  results?: { file: string; app: "installed" | "offer" | "not-wanted"; told?: boolean };
  /** A newer version of strom, when one is out. */
  update?: string;
  /** Stories of the ancestors: on, off, or on by default and the user is to be told (they may say no). */
  stories?: "on" | "off" | "tell";
  /** Tell the user once that they can ask about anyone in the tree right in the conversation. */
  ask?: boolean;
  /** Facts that only another model read than the one the user reads with now: offered, never started. */
  reread?: { facts: number; models: string[]; model: string };
  next: { why: string; command: string };
}

function orientation(ctx: Context): Orientation {
  const lang = ctx.uiLang();
  const t = (key: UIKey, values: Record<string, string | number> = {}) => ui(lang, key, values);
  const home = ctx.settings.home()?.value;
  const known = home ? ctx.knownTrees() : [];
  const base: Orientation = { version: VERSION, trees: known, next: { why: "", command: "" } };
  // A person at a terminal lets an agent do the work; an agent does it itself.
  const human = ctx.io.tty && !isAgent(ctx.env);
  if (home) base.home = home;
  if (!home) {
    base.next = human
      ? { why: t("ui.why.setup.human"), command: "strom setup" }
      : { why: t("ui.why.setup.agent", { home: ctx.display(ctx.settings.suggestedHome()) }), command: "strom setup --yes --lang <code of the language the user speaks with you>" };
    return base;
  }
  // Without git no family tree can be kept: that first (the user says yes to installing it).
  if (!gitVersion(ctx.env)) {
    base.next = { why: t(human ? "ui.why.git.human" : "ui.why.git.agent"), command: process.platform === "linux" ? linuxGitCommand() : "strom doctor --fix" };
    return base;
  }
  if (!ctx.hasTree()) {
    base.next =
      known.length === 0
        ? { why: t("ui.why.init"), command: 'strom init "<tree name, e.g. the family surname>"' }
        : { why: t("ui.why.pick"), command: `strom trees use "${known[0]!.name}"` };
    return base;
  }
  const tree = ctx.tree();
  const findings = verifyFast(tree).findings;
  base.tree = {
    name: tree.config.name,
    root: tree.root,
    lang: tree.lang,
    persons: tree.count("person"),
    families: tree.count("family"),
    errors: findings.filter((f) => f.level === "error").length,
    warnings: findings.filter((f) => f.level === "warn").length,
  };
  const researches = tree.list<Research>("research");
  base.researches = researches.map((r) => ({
    id: r.id,
    name: r.name,
    state: r.state,
    focus: tree.get<Person>(r.focus) ? label(tree.get<Person>(r.focus)!) : r.focus,
  }));
  // Other agents at work here now (conversations, a run): shown, and their sessions are theirs.
  const workers = liveWorkers(tree.root).filter((w) => w.id !== ctx.env.STROM_WORKER);
  const sessions = openSessions(tree);
  base.working = workers.map((w) => {
    const s = sessions.find((x) => x.worker === w.id || (w.id === "run" && x.runner));
    return { who: w.label, since: w.since, ...(s ? { session: s.id } : {}), ...(s?.task ? { task: s.task } : {}) };
  });
  if (!base.working.length) delete base.working;
  // The results, and where the user sees them: the Strom app — installed here, or to be offered.
  const out = path.join(tree.root, "output");
  const wanted = ctx.settings.config.stromApp !== "no";
  const file = path.join(out, wanted ? "tree-strom.ged" : "tree.ged");
  // What a conversation tells the user once, not again after it starts afresh (a new conversation, /clear): the Strom app, the stories, asking here.
  const told = ctx.settings.config.told ?? {};
  if (fs.existsSync(file)) base.results = { file, app: !wanted ? "not-wanted" : installedStromApp(ctx.env, process.platform, stromAppUrl(ctx.settings)) ? "installed" : "offer", ...(told.app ? { told: true } : {}) };
  const vision = ctx.settings.models(ctx.settings.agent(tree.config).value, tree.config).vision;
  if (vision) {
    const other = readByOtherModels(tree, vision);
    if (other.facts) base.reread = { ...other, model: vision };
  }
  const stories = ctx.settings.stories(tree.config);
  base.stories = !stories.on ? "off" : stories.said || told.stories ? "on" : "tell";
  if (!told.ask && base.tree.persons > 0) base.ask = true;
  // Given to an agent in a conversation (not a run nobody watches, not a person): told now.
  if (isAgent(ctx.env) && !ctx.env.STROM_SESSION) {
    const now = new Date().toISOString();
    const fresh = {
      ...(base.stories === "tell" ? { stories: now } : {}),
      ...(base.results && base.results.app !== "not-wanted" && !base.results.told ? { app: now } : {}),
      ...(base.ask ? { ask: now } : {}),
    };
    if (Object.keys(fresh).length) {
      ctx.settings.config.told = { ...told, ...fresh };
      ctx.settings.save();
    }
  }
  // The session this agent works in; else one nobody is working in any more.
  const busy = (s: Session) => (s.worker && workers.some((w) => w.id === s.worker)) || (s.runner && workers.some((w) => w.id === "run"));
  const open = currentSession(tree, ctx.env) ?? sessions.find((s) => !busy(s) && !(s.worker && s.worker !== ctx.env.STROM_WORKER && !human));
  const queued = taskQueue(tree).length;
  // An agent outside the tree that strom did not start (it set strom up from the web page, or was
  // opened in some folder): the research goes on in its own conversation, where the tree lives — when
  // strom can start one here (the research's agent is on this computer; not so for a bot on its own
  // server, e.g. Grok Bot: it goes on where it is).
  const rel = path.relative(tree.root, ctx.cwd);
  const inTree = rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
  const chosen = ctx.settings.agent(tree.config).value;
  const elsewhere = isAgent(ctx.env) && !ctx.env.STROM_WORKER && !ctx.env.STROM_SESSION && !inTree && agentsHere(ctx.env).some((a) => a.id === chosen);
  if (base.tree.errors > 0) base.next = { why: t("ui.why.check"), command: "strom check" };
  else if (elsewhere) base.next = { why: t("ui.why.handover"), command: "strom chat" };
  else if (open && human && open.runner && !runAlive(tree.root, open)) base.next = { why: t("ui.why.runleft", { id: open.id }), command: "strom run" };
  else if (open && human && open.runner) base.next = { why: t("ui.why.running", { id: open.id }), command: "strom status" };
  else if (open)
    base.next = human
      ? { why: t("ui.why.open.human", { id: open.id }), command: `strom session close ${open.id} --interrupted` }
      : { why: t("ui.why.open.agent", { id: open.id, on: open.task ? ` ${t("ui.o.on", { task: open.task })}` : "" }), command: "strom brief" };
  else if (researches.length === 0 && queued === 0)
    base.next = { why: t("ui.why.research"), command: 'strom research new "<name>" --new-person "<Given /Surname/>" --born "<date>" --born-place "<place>"' };
  else if (queued === 0 && waitingForUser(tree).length) base.next = { why: t("ui.why.waiting"), command: "strom task list --state waiting" };
  else if (queued === 0 && tree.count("input") === 0) base.next = { why: t("ui.why.intake"), command: 'strom intake --text "<what the user told you>"' };
  else if (queued > 0) base.next = human ? { why: t("ui.why.run", { n: queued }), command: "strom run" } : { why: t("ui.why.session", { n: queued }), command: "strom session start" };
  else {
    const active = researches.find((r) => r.state === "active") ?? researches[0]!;
    base.next = { why: t("ui.why.frontier"), command: `strom frontier --research ${active.id}` };
  }
  return base;
}

register(
  {
    path: [],
    summary: "Orientation: what strom is, where you are, what to do next",
    group: "start",
    async run(ctx) {
      const o = orientation(ctx);
      const newer = await newerVersion(ctx.settings, ctx.env);
      if (newer) o.update = newer;
      const lang = ctx.uiLang();
      const t = (key: UIKey, values: Record<string, string | number> = {}) => ui(lang, key, values);
      // Labels in one column, whatever their length in the user's language.
      const labels = [t("ui.o.home"), t("ui.o.tree"), t("ui.o.lang"), t("ui.o.data"), t("ui.o.results"), t("ui.o.stories"), t("ui.o.ask"), t("ui.o.reread"), t("ui.o.update"), t("ui.o.next")];
      const width = Math.max(...labels.map((l) => l.length)) + 2;
      const row = (label: string, value: string) => `${label.padEnd(width)}${value}`;
      const check = o.tree ? `${o.tree.errors ? t("ui.o.errors", { n: o.tree.errors }) : t("ui.o.ok")}${o.tree.warnings ? `, ${t("ui.o.warnings", { n: o.tree.warnings })}` : ""}` : "";
      const text = lines(
        t("ui.o.title", { version: o.version }),
        t("ui.o.rule"),
        "",
        row(t("ui.o.home"), o.home ? ctx.display(o.home) : t("ui.o.notsetup")),
        o.update ? row(t("ui.o.update"), t("ui.o.update.new", { version: o.update, current: o.version })) : undefined,
        o.tree
          ? lines(
              row(t("ui.o.tree"), `${o.tree.name}  (${ctx.display(o.tree.root)})`),
              row(t("ui.o.lang"), `${langName(o.tree.lang, lang)} (${o.tree.lang}) — ${t("ui.o.langnote")}`),
              row(t("ui.o.data"), t("ui.o.counts", { persons: o.tree.persons, families: o.tree.families, check })),
              o.results
                ? row(
                    t("ui.o.results"),
                    t(
                      o.results.app === "installed"
                        ? appOpensResearch(ctx.settings) && !o.results.told ? "ui.o.results.installed.live" : "ui.o.results.installed"
                        : o.results.app === "offer"
                          ? o.results.told ? "ui.o.results.offered" : appOpensResearch(ctx.settings) ? "ui.o.results.offer.live" : "ui.o.results.offer"
                          : "ui.o.results.plain",
                      { file: ctx.display(o.results.file), url: stromAppUrl(ctx.settings) },
                    ),
                  )
                : undefined,
              o.stories ? row(t("ui.o.stories"), t(`ui.o.stories.${o.stories}`)) : undefined,
              o.ask ? row(t("ui.o.ask"), t("ui.o.ask.tell")) : undefined,
              o.reread ? row(t("ui.o.reread"), t("ui.o.reread.offer", { n: o.reread.facts, models: o.reread.models.join(", "), model: o.reread.model })) : undefined,
              o.researches?.length
                ? t("ui.o.research") + "\n" + table(o.researches.map((r) => [`  ${r.id}`, r.name, `[${r.state}]`, r.focus]))
                : t("ui.o.research.none"),
              o.working?.length
                ? t("ui.o.working") + "\n" + table(o.working.map((w) => [`  ${w.who}`, t("ui.o.since", { time: w.since.slice(11, 16) }), w.task ? t("ui.o.on", { task: w.task }) : ""]))
                : undefined,
              ctx.hasTree() ? waitingLines(ctx.tree(), { shared: ctx.settings.shared()?.value, display: (p) => ctx.display(p) }) : undefined,
            )
          : o.trees.length > 1
            ? t("ui.o.trees") + "\n" + table(o.trees.map((x) => [`  ${x.name}`, ctx.display(x.root)]))
            : undefined,
        "",
        row(t("ui.o.next"), o.next.command),
        `${" ".repeat(width)}(${o.next.why})`,
      );
      return { text, data: o };
    },
  },
  {
    path: ["guide"],
    summary: "How to do research with strom — read this first (for agents)",
    group: "start",
    run(ctx) {
      const lang = ctx.hasTree() ? ctx.tree().lang : ctx.settings.home() ? ctx.settings.lang().value : undefined;
      const text = guideText(lang);
      return { text, data: { guide: text, lang } };
    },
  },
  {
    path: ["commands"],
    summary: "Catalog of commands by group; --json gives options and examples (filter: strom commands person --json)",
    group: "start",
    args: [{ name: "filter", description: "only commands starting with these words, or of this group", variadic: true }],
    examples: ["strom commands", "strom commands source --json", "strom commands analysis"],
    run(_ctx, { args }) {
      const words = args.flatMap((a) => a.split(/\s+/)).filter(Boolean);
      const prefix = words.join(" ");
      const defs = commands().filter(
        (c) => c.path.length > 0 && (!prefix || c.group === prefix || c.path.join(" ") === prefix || c.path.join(" ").startsWith(`${prefix} `)),
      );
      if (defs.length === 0) throw new UsageError(`no commands match "${prefix}"`, { hint: `groups: ${Object.keys(GROUPS).join(", ")}` });
      const text = Object.entries(GROUPS)
        .map(([g, title]) => {
          const inGroup = defs.filter((c) => c.group === g);
          return inGroup.length ? `${title}:\n${table(inGroup.map((c) => [`  ${c.path.join(" ")}`, c.summary]))}` : "";
        })
        .filter(Boolean)
        .join("\n\n");
      return { text, data: { version: VERSION, commands: defs.map(describe) } };
    },
  },
  {
    path: ["help"],
    summary: "Help for a command: strom help <command>",
    group: "start",
    args: [{ name: "command", description: "command words, e.g. person add", variadic: true }],
    run(_ctx, input) {
      const text = helpFor(input.args);
      return { text, data: { help: text } };
    },
  },
);
