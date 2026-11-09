// strom error (spec 070): one ZIP file with what strom can say of a problem — this computer, the installation, strom
// doctor, the agents, the connectors, the bridge, a research in numbers, the technical logs and the commands that went
// wrong — nothing of a person (core/redact.ts masks what could be one), nothing sent, nothing written into a research.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { register } from "../cli/registry.ts";
import { Context } from "../cli/context.ts";
import { lines } from "../cli/format.ts";
import { ui, type UIKey } from "../cli/ui.ts";
import { stromVocabulary } from "../cli/vocab.ts";
import { NeedsConsentError, UsageError } from "../core/errors.ts";
import { gitVersion } from "../core/git.ts";
import { downloadsDir, userHome } from "../core/paths.ts";
import { MASK_CODE, Masker, maskKey } from "../core/redact.ts";
import { agentSessionOf } from "../core/cmdlog.ts";
import {
  agentsArea,
  bridgeArea,
  checkArea,
  commandsArea,
  configArea,
  connectorsArea,
  envArea,
  fetchesArea,
  fingerprintArea,
  freeBytes,
  gitArea,
  installArea,
  launchedFrom,
  LOG_LIMITS,
  logsArea,
  readArea,
  REPORT_ABOUT,
  REPORT_ADDRESS,
  REPORT_TABLE,
  REPORT_WHERE,
  reportFileName,
  researchTerms,
  sessionsArea,
  sinceOf,
  syncArea,
  systemArea,
  treeNameTerms,
  treeSettingsArea,
  windowsArea,
  writeReport,
  type Area,
  type LogLimits,
  type ReportAbout,
  type ReportWhere,
} from "../core/report.ts";
import { mb } from "../core/tidy.ts";
import { findTreeUpwards, VERSION } from "../core/tree.ts";
import { updateChannel } from "../core/update.ts";
import { isAgent } from "../core/which.ts";
import { readAskedData, type DataAdded, type DataAsked } from "../core/reportdata.ts";
import { doctorChecks } from "./setup.ts";

/** The size a report keeps within (spec 070 K1.6): past it its logs are trimmed further. */
export const REPORT_MAX_BYTES = 2 * 1024 * 1024;
/** How many commands of an agent's own session go into the report (K3.3). */
const SESSION_COMMANDS = 30;

/** Where the report goes: the downloads folder, else the current folder — never a research's (it stays as it was). */
export function reportDir(env: Record<string, string | undefined>, cwd: string, platform: NodeJS.Platform = process.platform, exists?: (dir: string) => boolean): string {
  const downloads = downloadsDir(env, platform, exists);
  if (downloads) return downloads;
  if (!findTreeUpwards(cwd)) return cwd;
  const home = userHome(env);
  return fs.existsSync(home) ? home : cwd;
}

/** A file of that name not there yet (strom-error-….zip, then -2, -3 …). */
function freeFile(dir: string, name: string): string {
  let file = path.join(dir, name);
  for (let i = 2; fs.existsSync(file); i++) file = path.join(dir, name.replace(/\.zip$/, `-${i}.zip`));
  return file;
}

const str = (v: unknown): string | undefined => (typeof v === "string" ? v : undefined);
const list = (v: unknown): string[] => (Array.isArray(v) ? v.map(String) : typeof v === "string" ? [v] : []);

/** The parts of an area, each read on its own: one that cannot be read is said, the others stay. */
function parts(masker: Masker, read: Record<string, () => unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const failed: string[] = [];
  for (const [name, fn] of Object.entries(read)) {
    const a = readArea(name, masker, fn);
    if (a.ok) out[name] = a.data;
    else {
      out[name] = { error: a.error };
      failed.push(`${name}: ${a.error}`);
    }
  }
  if (failed.length) throw Object.assign(new Error(failed.join("; ")), { partial: out });
  return out;
}

/** An area of parts: what of it could be read stays even when a part could not. */
function partsArea(name: string, masker: Masker, read: Record<string, () => unknown>): Area {
  try {
    return { name, ok: true, data: parts(masker, read) };
  } catch (e) {
    const partial = (e as { partial?: unknown }).partial;
    return { name, ok: false, error: String((e as Error).message).slice(0, 600), ...(partial ? { data: partial } : {}) };
  }
}

register({
  path: ["error"],
  summary: "Pack a report of a problem into one ZIP file to send (nothing of the family tree's people; strom sends nothing)",
  group: "setup",
  description:
    "The report: this computer and the installation, strom doctor, the agents and their versions, the connectors, the\n" +
    "bridge to the Strom app, the research in numbers only (counts, strom check, git, downloads, sessions) and strom's\n" +
    "technical logs of the last days, with the commands that ended with an error. Names, places, notes, paths with the\n" +
    "user's name and e-mails are replaced by codes; logins, keys and tokens never go. The ZIP goes to the downloads\n" +
    "folder (else the current one); strom sends nothing — the user sends it. Nothing in the research is written.\n" +
    "\n" +
    REPORT_TABLE,
  options: [
    { name: "about", type: "string", multiple: true, value: "<area>", description: "details of an area too: fetch, sync, agent, install, windows" },
    { name: "since", type: "string", value: "<2d|1w|YYYY-MM-DD>", description: "how far back the logs go (default 7 days)" },
    { name: "where", type: "string", value: "<chat|terminal|app|unknown>", description: "where the problem happened, as the user says: chat (a conversation with an agent), terminal (strom without an agent), app (the Strom app), unknown" },
    { name: "note", type: "string", value: "<text>", max: 2000, description: "the problem in the user's own words (names of the research masked)" },
    { name: "with-data", type: "boolean", description: "add the data of the persons, families and books named (names, facts, citations, how sure each is — no images, notes or transcripts) as data.json; the person is asked" },
    { name: "person", type: "string", multiple: true, value: "<P…>", description: "with --with-data: a person the problem is about" },
    { name: "family", type: "string", multiple: true, value: "<F…>", description: "with --with-data: a family the problem is about" },
    { name: "book", type: "string", multiple: true, value: "<B…>", description: "with --with-data: a book the problem is about, with its sources" },
    { name: "yes-data", type: "boolean", description: "the user's own explicit yes to --with-data, given in the conversation (an agent never assumes it)" },
  ],
  examples: ["strom error", "strom error --about sync --where app", 'strom error --since 2d --note "the download stopped halfway"', "strom error --about fetch --with-data --book B0001"],
  async run(ctx, { opts }) {
    // git asked only, never its index refreshed: nothing of a research written (spec 070 K1.5)
    const locks = process.env.GIT_OPTIONAL_LOCKS;
    process.env.GIT_OPTIONAL_LOCKS = "0";
    try {
      return await makeReport(ctx, opts);
    } finally {
      if (locks === undefined) delete process.env.GIT_OPTIONAL_LOCKS;
      else process.env.GIT_OPTIONAL_LOCKS = locks;
    }
  },
});

/** The report made: its areas read, the ZIP written, what to say. */
async function makeReport(ctx: Context, opts: Record<string, unknown>): Promise<{ text: string; data: Record<string, unknown> }> {
  {
    // only reading: a research of an older schema opened as it is, nothing of it written (spec 070 K1.5)
    ctx.readOnly = true;
    const env = ctx.env;
    const lang = ctx.uiLang();
    const t = (k: UIKey, v: Record<string, string | number> = {}) => ui(lang, k, v);
    const agent = isAgent(env);
    const archive = ctx.archiveHere();

    const asked = [...new Set(list(opts.about).flatMap((a) => a.split(",")).map((a) => a.trim().toLowerCase()).filter(Boolean))];
    const unknown = asked.filter((a) => !(REPORT_ABOUT as readonly string[]).includes(a));
    if (unknown.length)
      throw new UsageError(`--about takes ${REPORT_ABOUT.join(", ")}, not ${unknown.join(", ")}`, { hint: "strom error --about fetch", code: "error.about", params: { value: unknown.join(", "), values: REPORT_ABOUT.join(", ") } });
    // an archive's report has no agent's details: asked for, nothing of them
    const about = asked.filter((a) => !(archive && a === "agent"));
    const sinceMs = sinceOf(str(opts.since));
    if (sinceMs === undefined)
      throw new UsageError(`--since takes 2d, 1w, 12h or a date (YYYY-MM-DD), not ${str(opts.since)}`, { hint: "strom error --since 2d", code: "error.since", params: { value: str(opts.since) ?? "" } });
    const whereGiven = str(opts.where)?.trim().toLowerCase();
    if (whereGiven !== undefined && !(REPORT_WHERE as readonly string[]).includes(whereGiven))
      throw new UsageError(`--where takes ${REPORT_WHERE.join(", ")}, not ${whereGiven}`, { hint: "strom error --where chat", code: "error.where", params: { value: whereGiven, values: REPORT_WHERE.join(", ") } });

    // the research: the one worked on, else (outside one) every one known — in numbers only
    let root: string | undefined;
    let rootError: string | undefined;
    try {
      root = ctx.locateTree();
    } catch (e) {
      rootError = String((e as { code?: string }).code ?? "tree");
    }
    let others: { name: string; root: string }[] = [];
    if (!root) {
      try {
        others = ctx.knownTrees();
      } catch {
        others = [];
      }
    }

    // where the problem happened: the person at a terminal is asked; an agent passes --where (unknown without it)
    let where: ReportWhere = (whereGiven as ReportWhere | undefined) ?? "unknown";
    const whereKeys = REPORT_WHERE.filter((w) => !(archive && w === "chat"));
    if (whereGiven === undefined && ctx.interactive && !agent) {
      const i = await ctx.choose(
        t("ui.report.where.q"),
        whereKeys.map((w) => ({ label: whereLabel(lang, w, archive) })),
        whereKeys.length - 1,
      );
      if (i !== undefined) where = whereKeys[i]!;
    }
    const askWhere = whereGiven === undefined && agent;

    // the data of the people the problem is about: only those named, only on the person's yes (K1.7)
    const dataAsked: DataAsked = { person: list(opts.person), family: list(opts.family), book: list(opts.book) };
    const named = [...dataAsked.person, ...dataAsked.family, ...dataAsked.book];
    let withData: { data: Record<string, unknown>; added: DataAdded[] } | undefined;
    if (!opts["with-data"] && (named.length || opts["yes-data"]))
      throw new UsageError("--person, --family, --book and --yes-data go with --with-data", { hint: `strom error --with-data ${named.length ? named.map((n) => `--${dataAsked.person.includes(n) ? "person" : dataAsked.family.includes(n) ? "family" : "book"} ${n}`).join(" ") : "--person P0001"}`, code: "error.data.alone" });
    if (opts["with-data"]) {
      if (!named.length) throw new UsageError("--with-data adds only what is named: --person P…, --family F…, --book B…", { hint: "strom error --with-data --person P0001", code: "error.data.none" });
      if (!root) throw new UsageError("--with-data reads a research: run it in the research's folder or pass --tree <name>", { hint: "strom error --with-data --tree <name> --person P0001", code: "error.data.tree" });
      const read = readAskedData(ctx.tree(), dataAsked);
      const again = `strom error --with-data ${read.added.map((a) => `--${a.kind} ${a.id}`).join(" ")}${about.map((a) => ` --about ${a}`).join("")}`;
      // a person at a terminal is asked (no: the report without them); an agent or a script only with --yes-data
      const canAsk = !agent && (ctx.io.tty || ctx.io.answers !== undefined) && !ctx.json && env.STROM_NONINTERACTIVE !== "1";
      if (opts["yes-data"]) withData = read;
      else if (canAsk) {
        ctx.io.stdout(`${lines(t("ui.report.data.q"), ...read.added.map((a) => `  · ${a.id} ${a.label}`))}\n`);
        if (await ctx.confirm(t("ui.report.data.add"), false)) withData = read;
      } else
        throw new NeedsConsentError(
          [{ key: "error.data", kind: "consent", question: `add the data of ${read.added.map((a) => a.id).join(", ")} (names, facts, citations) to the report`, set: again }],
          t("ui.report.data.consent", { list: read.added.map((a) => a.id).join(", ") }),
          `or, only when the user said yes to sending the data of exactly these records in this conversation, run it again with --yes-data`,
        );
    }

    const shown: string[] =["system", "config", "doctor", ...(archive ? [] : ["agents"]), "connectors", ...(root ? ["bridge", "research", "logs"] : others.length ? ["research"] : []), "commands", ...about.filter((a) => !(archive && a === "agent"))];
    const label = (name: string) => t(`ui.report.area.${archive && (name === "commands" || name === "research") ? `${name}.archive` : name}` as UIKey, { since: new Date(sinceMs).toISOString().slice(0, 10) });

    // the person at a terminal sees what goes in and says yes (K1.4); --yes, an agent, a script: made at once
    if (ctx.interactive && !agent) {
      ctx.io.stdout(`${lines(t(withData ? "ui.report.summary.data" : "ui.report.summary"), ...shown.map((n) => `  · ${label(n)}`), ...(withData ? [`  · ${t("ui.report.data.line", { list: withData.added.map((a) => a.id).join(", ") })}`] : []))}\n`);
      if (!(await ctx.confirm(t("ui.report.create"), true))) return { text: t("ui.report.cancelled"), data: { created: false } };
    }

    // the masking: the research's words (its people, places, books), its name, the user's name and home
    const masker = new Masker({ key: maskKey(env), home: userHome(env), vocabulary: stromVocabulary });
    let user = "";
    try {
      user = os.userInfo().username;
    } catch {
      user = "";
    }
    masker.addTerms([user, path.basename(userHome(env))], { weak: true });
    for (const r of [...(root ? [root] : []), ...others.map((k) => k.root)]) {
      try {
        masker.addTerms(treeNameTerms(r), { weak: true });
        researchTerms(r, masker);
      } catch {
        // its words not known: masked as any word is
      }
    }
    for (const k of others) masker.addTerms([k.name], { weak: true });

    const config = ctx.settings.config as unknown as Record<string, unknown>;
    const shared = ctx.settings.shared()?.value;
    const fixed: Area[] = [];
    fixed.push(
      readArea("system", masker, () => {
        const home = ctx.settings.home()?.value;
        return {
          ...systemArea(env),
          strom: VERSION,
          channel: updateChannel(env),
          git: gitVersion(env),
          // an archive's report says nothing of an agent (its settings, its gate, who started strom)
          launched: archive ? { by: ctx.io.tty ? "terminal" : "script" } : launchedFrom(env, ctx.io.tty),
          env: envArea(env),
          ...(home ? { freeHome: freeBytes(home) } : {}),
        };
      }),
    );
    fixed.push(
      readArea("config", masker, () => {
        const c = configArea(config, { archive });
        if (archive) delete c.runGate;
        return c;
      }),
    );
    fixed.push(
      readArea("doctor", masker, () => {
        // its own context: only reading, its texts in English (the report's), nothing asked or shown
        const quiet = new Context({ env, cwd: ctx.cwd, io: { stdout: () => undefined, stderr: () => undefined, tty: false }, flags: {}, json: true, yes: true, tree: ctx.treeFlag });
        quiet.readOnly = true;
        quiet.langShown = "en";
        const d = doctorChecks(quiet);
        return {
          ok: d.ok,
          checks: d.checks.map((c) => ({ ...c, detail: masker.text(c.detail), ...(c.fix ? { fix: masker.text(c.fix) } : {}) })),
          text: d.text.split("\n").map((l) => masker.text(l)),
        };
      }),
    );
    if (!archive) fixed.push(readArea("agents", masker, () => agentsArea(env, config, root, masker)));
    fixed.push(readArea("connectors", masker, () => connectorsArea(env, shared, root, masker)));
    if (root) {
      const r = root;
      fixed.push(readArea("bridge", masker, () => ({ ...bridgeArea(r, masker), ...(config.stromAppSeen ? { appSeen: configArea({ stromAppSeen: config.stromAppSeen }, { archive }).stromAppSeen } : {}) })));
      fixed.push(
        partsArea("research", masker, {
          settings: () => treeSettingsArea(r),
          fingerprint: () => fingerprintArea(r),
          git: () => gitArea(r),
          check: () => checkArea(ctx.tree()),
          fetches: () => fetchesArea(r, sinceMs, masker),
          ...(archive ? {} : { sessions: () => sessionsArea(r, sinceMs) }),
        }),
      );
    } else if (others.length) {
      fixed.push(
        readArea("research", masker, () => ({
          ...(rootError ? { which: rootError } : {}),
          trees: others.map((k) =>
            partsArea(masker.args([k.name])[0]!, masker, { settings: () => treeSettingsArea(k.root), fingerprint: () => fingerprintArea(k.root), git: () => gitArea(k.root) }),
          ),
        })),
      );
    }
    for (const a of about) {
      if (a === "agent" && archive) continue;
      if (a === "install") fixed.push(readArea("install", masker, () => installArea(env, masker)));
      else if (a === "windows") fixed.push(readArea("windows", masker, () => windowsArea(env, masker)));
      else if (a === "sync") fixed.push(readArea("sync", masker, () => (root ? syncArea(root) : { research: false })));
      else if (a === "fetch") fixed.push(readArea("fetch", masker, () => (root ? { fetches: fetchesArea(root, 0, masker) } : { research: false })));
      else if (a === "agent") fixed.push(readArea("agent", masker, () => (root ? sessionsArea(root, 0) : { research: false })));
    }

    // the logs and commands, within their sizes: --about gives its own more room; past the report's size, less for all
    const base: LogLimits = {
      ...LOG_LIMITS,
      ...(about.includes("fetch") ? { fetch: LOG_LIMITS.fetch * 3 } : {}),
      ...(about.includes("sync") ? { live: LOG_LIMITS.live * 3 } : {}),
      ...(about.includes("agent") ? { gate: LOG_LIMITS.gate * 3, commands: LOG_LIMITS.commands * 2 } : {}),
    };
    const session = agentSessionOf(env);
    const logAreas = (limits: LogLimits): { areas: Area[]; trimmed: Record<string, number> } => {
      const trimmed: Record<string, number> = {};
      const areas: Area[] = [];
      if (root) {
        const r = root;
        areas.push(
          readArea("logs", masker, () => {
            const l = logsArea(r, sinceMs, masker, limits);
            if (archive) {
              delete l.logs["gate.log"];
              delete l.trimmed["gate.log"];
            }
            Object.assign(trimmed, l.trimmed);
            return l.logs;
          }),
        );
      }
      areas.push(
        readArea("commands", masker, () => {
          const c = commandsArea(env, root, sinceMs, masker, limits.commands);
          if (c.trimmed) trimmed["commands.jsonl"] = c.trimmed;
          // an archive's report says nothing of an agent
          const shown = archive ? c.commands.map(({ agent: _a, worker: _w, session: _s, ...rest }) => rest) : c.commands;
          const mine = !archive && session ? c.commands.filter((x) => x.session === session).slice(-SESSION_COMMANDS) : [];
          return { commands: shown, ...(mine.length || (session && !archive) ? { thisSession: mine } : {}) };
        }),
      );
      return { areas, trimmed };
    };

    const dir = reportDir(env, ctx.cwd);
    const file = freeFile(dir, reportFileName());
    const made = new Date();
    let limits = base;
    let bytes = 0;
    let areas: Area[] = [];
    let trimmed: Record<string, number> = {};
    for (let round = 0; round < 5; round++) {
      const logs = logAreas(limits);
      areas = [...fixed, ...logs.areas];
      // the order the summary said
      areas.sort((a, b) => (shown.indexOf(a.name) < 0 ? 99 : shown.indexOf(a.name)) - (shown.indexOf(b.name) < 0 ? 99 : shown.indexOf(b.name)));
      trimmed = logs.trimmed;
      const report = masker.sweepValue({
        report: 1,
        made: made.toISOString(),
        strom: VERSION,
        where,
        ...(about.length ? { about } : {}),
        since: new Date(sinceMs).toISOString(),
        ...(str(opts.note) ? { note: masker.note(str(opts.note)!) } : {}),
        areas: Object.fromEntries(areas.map((a) => [a.name, a.ok ? a.data : { error: a.error, ...(a.data ? { partial: a.data } : {}) }])),
        ...(Object.keys(trimmed).length ? { trimmed } : {}),
        ...(withData ? { withData: withData.added.map((a) => a.id) } : {}),
      });
      // the README is strom's own text in the person's language: only the values put into it (the note, an area's error)
      // masked and looked over, never its own words — a source's title or a name may be a word of its sentences
      // (Zpráva, Nový, Kovář); the count: the codes report.json carries (README's values are some of them again)
      const look = (v: string) => masker.sweep(v);
      const readme =
        readmeText(lang, {
          made,
          where,
          about,
          sinceMs,
          note: str(opts.note) ? look(masker.note(str(opts.note)!)) : undefined,
          areas: areas.map((a) => (a.error ? { ...a, error: look(a.error) } : a)),
          trimmed,
          label,
          masked: codesIn(report),
          archive,
          data: !!withData,
        }) +
        (withData ? `\n\n${dataText(lang, withData.added)}` : "") +
        `\n\n${t("ui.report.send", { address: REPORT_ADDRESS })}\n`;
      // the data the person agreed to: as it is, never masked (data.json)
      bytes = writeReport(file, readme, report, withData?.data);
      if (bytes <= REPORT_MAX_BYTES) break;
      limits = { live: limits.live / 2, gate: limits.gate / 2, tidy: limits.tidy / 2, fetch: limits.fetch / 2, commands: limits.commands / 2 };
    }

    const shownFile = ctx.display(file);
    const size = mb(bytes, lang);
    const agentNext = agent
      ? askWhere
        ? `Ask the user where the problem happened — in this conversation, in a terminal without an agent, or in the Strom app — and run strom error again with --where chat|terminal|app (and --note with their words). Then tell them the path of the file and the address to send it to; never send, open or copy its content into the chat.`
        : `Tell the user the path of the file and the address to send it to (${REPORT_ADDRESS}); never send, open or copy its content into the chat.`
      : undefined;
    const text = lines(
      t("ui.report.done", { file: shownFile, size }),
      ...areas.map((a) => (a.ok ? `  ✓ ${label(a.name)}` : `  ✗ ${label(a.name)}: ${t("ui.report.area.failed", { error: a.error ?? "" })}`)),
      ...(withData ? [`  ✓ ${t("ui.report.data.line", { list: withData.added.map((a) => a.id).join(", ") })}`] : []),
      ...(Object.keys(trimmed).length ? [t("ui.report.trimmed", { list: Object.keys(trimmed).join(", ") })] : []),
      "",
      t("ui.report.send", { address: REPORT_ADDRESS }),
      ...(agentNext ? ["", agentNext] : []),
    );
    return {
      text,
      data: {
        created: true,
        file,
        bytes,
        where,
        ...(about.length ? { about } : {}),
        address: REPORT_ADDRESS,
        areas: areas.map((a) => ({ name: a.name, ok: a.ok, ...(a.error ? { error: a.error } : {}) })),
        ...(Object.keys(trimmed).length ? { trimmed } : {}),
        ...(withData ? { withData: withData.added.map((a) => ({ id: a.id, kind: a.kind })) } : {}),
        ...(agentNext ? { next: agentNext } : {}),
      },
    };
  }
}

/** How many codes a value carries (‹3fa9c›): the words of a person, a place or a path the report replaced. */
export function codesIn(v: unknown): number {
  return (JSON.stringify(v) ?? "").match(MASK_CODE)?.length ?? 0;
}

/** README.txt: what the report is and holds, in the language strom is shown in. */
function readmeText(
  lang: string,
  o: { made: Date; where: ReportWhere; about: string[]; sinceMs: number; note: string | undefined; areas: Area[]; trimmed: Record<string, number>; label: (name: string) => string; masked: number; archive: boolean; data: boolean },
): string {
  const t = (k: UIKey, v: Record<string, string | number> = {}) => ui(lang, k, v);
  return lines(
    t("ui.report.readme.title"),
    t("ui.report.readme.made", { at: o.made.toISOString().replace("T", " ").slice(0, 16), version: VERSION }),
    t("ui.report.readme.where", { where: whereLabel(lang, o.where, o.archive) }),
    "",
    t(o.data ? "ui.report.readme.intro.data" : "ui.report.readme.intro"),
    "",
    t("ui.report.readme.areas"),
    ...o.areas.map((a) => (a.ok ? `  · ${o.label(a.name)}` : `  ✗ ${o.label(a.name)}: ${t("ui.report.area.failed", { error: a.error ?? "" })}`)),
    "",
    Object.keys(o.trimmed).length ? t("ui.report.trimmed", { list: Object.entries(o.trimmed).map(([k, n]) => `${k} (${n})`).join(", ") }) : t("ui.report.readme.notrim"),
    t("ui.report.readme.masked", { n: o.masked }),
    ...(o.note ? ["", t("ui.report.readme.note"), ...o.note.split(/\r?\n/).map((l) => `  > ${l}`)] : []),
    "",
    t(o.data ? "ui.report.readme.files.data" : "ui.report.readme.files"),
  );
}

/** The README's list of the records whose data the person agreed to send (data.json). */
function dataText(lang: string, added: DataAdded[]): string {
  return lines(ui(lang, "ui.report.readme.data"), ...added.map((a) => `  · ${a.id} ${a.label}`));
}

/** Where the problem happened, as a person says it (an archive's terminal: no word of an agent). */
function whereLabel(lang: string, where: ReportWhere, archive: boolean): string {
  return ui(lang, archive && where === "terminal" ? "ui.report.where.terminal.archive" : (`ui.report.where.${where}` as UIKey));
}
