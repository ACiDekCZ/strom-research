// connector list · show · new · add · remove · test — fetch — allow connector · allow host · consents · login
//
// Archive downloads through plugins (connectors) in the plugins folder,
// <shared>/plugins/connectors/<name>/: copied in by the user, or built there
// with their agent. strom paces every request, keeps to the hosts a connector
// names, writes the files itself, checks the images and registers them with
// their provenance. When the user asks to be asked (connectors.consent on), a
// connector runs only with their consent, given on a terminal after a plain
// warning — never by an agent; code that goes round strom needs it either way.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { ui } from "../cli/ui.ts";
import { register, type Result } from "../cli/registry.ts";
import type { Context } from "../cli/context.ts";
import { lines, moreLine, paginate, runs, shellArg, table } from "../cli/format.ts";
import { StromError, UsageError } from "../core/errors.ts";
import { isAgent } from "../core/which.ts";
import type { Media, RecordSet, Region, Repository } from "../core/model.ts";
import { requireRecord } from "../core/records.ts";
import { readable } from "../core/text.ts";
import { findImage, isWhole, regionText, sameRegion } from "../core/media.ts";
import { partRegion } from "../core/views.ts";
import { loadLogins, loginOf, loginsFile, removeLogin, saveLogin, VISIBLE_FIELDS } from "../core/logins.ts";
import { readAsset } from "../core/assets.ts";
import { runGit } from "../core/git.ts";
import { imageSizeOfFile } from "../image/index.ts";
import { Tree } from "../core/tree.ts";
import { syncAgentFiles } from "../agents/files.ts";
import { clearBlock, CookieJar, DEFAULT_PACE, hostAllowed, hostPace, hostState, knownHosts, MIN_INTERVAL_MS, NetError, paceText, politeRequest, refusedBy, reserveSlots, setOwnPace, type Pace } from "../core/net.ts";
import {
  botCheck,
  fileBase,
  findDownload,
  loadPage,
  loadPlans,
  pageKey,
  pageScript,
  parseResult,
  PLAN_TTL_MS,
  planScript,
  readSavedPage,
  removePlan,
  savePage,
  savePlan,
  SCRIPT_MS,
  type BrowserPlan,
  type PageAnswer,
  type PageRequest,
  type PlanItem,
  type PlanPage,
  type Resume,
} from "../core/browser.ts";
import {
  bareHost,
  changedSinceConsent,
  codeWarning,
  consentRequired,
  connectorHash,
  connectorsDir,
  directNetwork,
  ensurePluginsDir,
  findConnector,
  hostWarning,
  imageProblem,
  INTERFACE,
  listConnectors,
  loadConsents,
  MANIFEST,
  missingConsents,
  NAME_RE,
  readManifest,
  routeOf,
  treeBrowserConnectors,
  routesOf,
  ROUTES,
  runConnector,
  saveConsents,
  scanConnectors,
  suggestName,
  type Connector,
  type ConnectorRequest,
  type FoundBook,
  type Route,
  type RunReport,
} from "../core/connector.ts";
import { registerImages } from "./media.ts";

function shared(ctx: Context): string {
  const s = ctx.settings.shared();
  if (!s) throw new StromError("Strom is not set up yet", { hint: "strom setup" });
  return s.value;
}

const netDir = (ctx: Context) => path.join(shared(ctx), "net");
const when = (ms: number) => new Date(ms).toISOString().slice(0, 16).replace("T", " ");

/** The pace for a host now: the user's own for it, else its connector's service's, else strom's. */
function paceAt(ctx: Context, host: string, c?: Connector): Pace {
  const by = c ?? listConnectors(ctx.settings.shared()?.value).find((x) => x.manifest.hosts.some((h) => hostAllowed(host, [h])));
  return hostPace(hostState(netDir(ctx), host), by?.manifest.policy.pace);
}

/** A connector's pace: that of its first host. */
function connectorPace(ctx: Context, c: Connector): Pace {
  return paceAt(ctx, bareHost(c.manifest.hosts[0] ?? ""), c);
}

function hostLine(ctx: Context, host: string): string {
  const s = hostState(netDir(ctx), host);
  const hour = s.recent.filter((t) => t > Date.now() - 3600_000).length;
  return [
    host,
    s.blockedUntil && s.blockedUntil > Date.now() ? `⛔ refused us — left alone until ${when(s.blockedUntil)} (${s.reason ?? ""})` : "",
    hour ? `${hour} request(s) in the last hour` : "",
    (s.slowdown ?? 1) > 1 ? `slowed ×${(s.slowdown ?? 1).toFixed(1)}` : "",
    s.waitUntil && s.waitUntil > Date.now() ? `its limit used up until ${when(s.waitUntil)}` : "",
    `${paceText(paceAt(ctx, host))}${s.own ? " (yours)" : ""}`,
  ]
    .filter(Boolean)
    .join(" · ");
}

/** Ask the user, on a terminal, to allow automated access to a host. */
async function askHost(ctx: Context, host: string, c?: Connector, byWindow = false): Promise<boolean> {
  if (!byWindow) {
    ctx.io.stdout("\n" + hostWarning(host, c, paceAt(ctx, host, c)) + "\n");
    if (!(await ctx.confirm(`Allow automated access to ${host}?`, false))) return false;
  }
  const all = loadConsents(ctx.env);
  all.hosts[bareHost(host)] = { at: new Date().toISOString(), ...(c ? { connector: c.name } : {}), ...(c?.manifest.policy.terms ? { terms: c.manifest.policy.terms } : {}) };
  saveConsents(ctx.env, all);
  return true;
}

/** Everything a window asks the person about a connector at once: what it does, where it goes, any warning. */
function consentWindow(ctx: Context, c: Connector): string {
  const lang = ctx.uiLang();
  const miss = missingConsents(ctx.env, c);
  return [
    ui(lang, "ui.consent.connector", { name: c.manifest.title }),
    ui(lang, "ui.consent.connector.hosts", { hosts: c.manifest.hosts.map(bareHost).join(", ") }),
    ...(miss.code === "changed" ? [ui(lang, "ui.consent.connector.changed")] : []),
    ...(directNetwork(c).length ? [ui(lang, "ui.consent.connector.direct")] : []),
    ...(c.manifest.policy.terms ? [ui(lang, "ui.consent.connector.terms", { terms: c.manifest.policy.terms })] : []),
  ].join("\n\n");
}

/** The user's yes to a connector's folder (and its code as it is now). */
function grant(ctx: Context, c: Connector, source: string): void {
  const all = loadConsents(ctx.env);
  all.connectors[c.name] = { dir: c.dir, hash: connectorHash(c.dir), hosts: c.manifest.hosts, at: new Date().toISOString(), source };
  saveConsents(ctx.env, all);
}

/**
 * What is left to allow: on the terminal the connector (after its warning), then each host.
 * By a window the person said yes to all of it at once (the window showed it all: consentWindow).
 */
async function askConnector(ctx: Context, c: Connector, source: string, byWindow = false): Promise<{ allowed: boolean; hosts: string[]; missing: string[] }> {
  const miss = missingConsents(ctx.env, c);
  if (miss.code) {
    if (!byWindow) {
      ctx.io.stdout("\n" + codeWarning(c, source, directNetwork(c)) + "\n");
      if (!(await ctx.confirm(`${miss.code === "changed" ? "Its code changed — allow" : "Allow"} connector ${c.name}?`, false))) return { allowed: false, hosts: [], missing: c.manifest.hosts.map(bareHost) };
    }
    grant(ctx, c, source);
  }
  const hosts: string[] = [];
  const ask = consentRequired(ctx.env);
  for (const h of c.manifest.hosts.map(bareHost)) if (!ask || loadConsents(ctx.env).hosts[h] || (await askHost(ctx, h, c, byWindow))) hosts.push(h);
  return { allowed: true, hosts, missing: c.manifest.hosts.map(bareHost).filter((h) => !hosts.includes(h)) };
}

/**
 * Before a connector runs: everything allowed? The user, on a terminal, is asked
 * right here; anyone else (an agent, a script) gets exit 4 and the command for the user.
 */
async function ensureAllowed(ctx: Context, c: Connector): Promise<boolean> {
  const miss = missingConsents(ctx.env, c);
  if (!miss.code && !miss.hosts.length) return true;
  const changed = miss.code === "changed";
  const how = ctx.requireHuman(
    consentRequired(ctx.env)
      ? `${changed ? "The code of" : "Run"} connector ${c.name} (${c.manifest.title})${changed ? " changed since you allowed it — allow it again" : ""}${miss.hosts.length ? `, with automated access to ${miss.hosts.join(", ")}` : ""}?`
      : `Connector ${c.name} (${c.manifest.title}) reaches the network itself, past strom's limiter${changed ? ", and its code changed since you allowed it" : ""} — run it?`,
    `strom allow connector ${c.name}`,
    `connector:${c.name}`,
    consentWindow(ctx, c),
  );
  const r = await askConnector(ctx, c, ctx.display(c.dir), how === "window");
  return r.allowed && !r.missing.length;
}

function consentState(ctx: Context, c: Connector): string {
  const miss = missingConsents(ctx.env, c);
  if (!miss.code && !miss.hosts.length) return !consentRequired(ctx.env) ? "ready" : changedSinceConsent(ctx.env, c) ? "allowed (changed since)" : "allowed";
  return [miss.code === "new" ? "needs your consent" : miss.code === "changed" ? "code changed — needs your consent again" : "", miss.hosts.length ? `hosts not allowed: ${miss.hosts.join(", ")}` : ""].filter(Boolean).join("; ");
}

/** " · 4317×3233 px" of an image file, when strom can read its size. */
function pixels(file: string): string {
  const s = imageSizeOfFile(file);
  return s ? ` ${s.width}×${s.height} px` : "";
}

function describeRun(r: RunReport, what: string): string {
  return lines(
    `${what}: ${r.requests} request(s)${r.pages ? ` + ${r.pages} page(s) your browser got` : ""}${r.stopped ? ` · stopped: ${r.stopped}` : ""}`,
    ...r.logs.slice(-10).map((l) => `  · ${l}`),
  );
}

/** Up to this many books, each comes with the command to register it; more, one line each. */
const BOOKS_IN_FULL = 3;
const BOOKS_SHOWN = 30;

function bookLines(r: RunReport, c: Connector, listOne: string): string[] {
  // a connector that fetches nothing (the terms forbid it, or it only finds): the images come by hand
  const fetches = c.manifest.policy.automation !== "manual" && c.manifest.can.some((x) => x === "fetch" || x === "locate");
  const line = (b: FoundBook) => `${b.title}${b.callNumber ? ` (${b.callNumber})` : ""}${b.years ? ` · ${b.years}` : ""}${b.kinds?.length ? ` · ${b.kinds.join(",")}` : ""}${b.images ? ` · ${b.images} images` : ""}`;
  if (r.books.length > BOOKS_IN_FULL)
    return [
      ...r.books.slice(0, BOOKS_SHOWN).map((b) => `  ${b.id ? `${b.id}  ` : ""}${line(b)}`),
      r.books.length > BOOKS_SHOWN ? `  … ${r.books.length - BOOKS_SHOWN} more — narrow it with --years, or read them all with --json` : undefined,
      `  one of them, with the command to register it: ${listOne}`,
    ].filter((l): l is string => l !== undefined);
  return r.books.map((b) =>
    [
      `  ${line(b)}`,
      b.url ? `    ${b.url}` : undefined,
      `    strom recordset add ${shellArg(b.title)}${b.callNumber ? ` --call-number ${shellArg(b.callNumber)}` : ""}${b.kinds?.length ? ` --kinds ${b.kinds.join(",")}` : ""}${b.places?.length ? ` --places ${shellArg(b.places.join(","))}` : ""}${b.years ? ` --years ${b.years}` : ""}${b.url ? ` --url ${shellArg(b.url)}` : ""} --access online-free`,
      !fetches
        ? `    then: the user saves the images by hand — strom task wait T… --images B…:<from-to> --on "<the book, its link, which images>"`
        : b.id
          ? `    then: strom fetch ${c.name} ${shellArg(b.id)} --images <from-to> --recordset B…`
          : undefined,
    ]
      .filter(Boolean)
      .join("\n"),
  );
}

function parseImages(v: unknown, max = 1000): number[] | undefined {
  if (v === undefined) return undefined;
  const m = /^(\d+)(?:-(\d+))?$/.exec(String(v).trim());
  if (!m) throw new UsageError(`--images must be n or from-to, not "${v}"`);
  const a = Number(m[1]);
  const z = Number(m[2] ?? m[1]);
  if (a < 1) throw new UsageError("--images: images are counted from 1");
  if (z < a) throw new UsageError("--images: from before to");
  if (z - a >= max) throw new UsageError(`--images: at most ${max} at a time`, { hint: "the rest in the next run (an archive's hourly cap: in the next hour)" });
  return Array.from({ length: z - a + 1 }, (_, i) => a + i);
}

/** An archive the tree says must not be automated (forbidden, or browser only). */
function forbiddenBy(ctx: Context, c: Connector): Repository | undefined {
  const root = ctx.locateTree();
  if (!root) return undefined;
  return ctx
    .tree()
    .list<Repository>("repository")
    .find((r) => {
      if ((r.automation !== "forbidden" && r.automation !== "manual") || !r.url) return false;
      try {
        return hostAllowed(new URL(r.url).hostname, c.manifest.hosts);
      } catch {
        return false;
      }
    });
}

/** How long a fetch takes at least, at the connector's pace (one request per image). */
function estimate(ctx: Context, c: Connector, images: number): string {
  const pace = connectorPace(ctx, c);
  const secs = Math.round(((images - 1) * pace.minIntervalMs) / 1000);
  const took = secs < 90 ? `${secs} s` : `${Math.round(secs / 60)} min`;
  return `${images} image(s) through ${c.name}: at least ${took} at its pace (one request per image, ≥${pace.minIntervalMs / 1000} s apart)`;
}

/** How a connector's images come here, and what else it can do. */
function routeText(ctx: Context, c: Connector): string {
  const r = routeOf(ctx.env, c);
  const other = routesOf(c).filter((x) => x !== r.via);
  return [
    r.via === "browser" ? "through your browser" : "directly, through strom",
    r.chosen ? `(chosen ${r.chosen.at.slice(0, 10)} ${r.chosen.by})` : undefined,
    other.length ? `· can also: ${other.join(", ")} (strom connector use ${c.name} --via ${other[0]})` : undefined,
  ]
    .filter(Boolean)
    .join(" ");
}

register(
  {
    path: ["connector", "list"],
    summary: "Connectors: plugins that download from an archive portal — which there are, whether they can run",
    group: "sources",
    run(ctx) {
      const s = ctx.settings.shared()?.value;
      const { connectors, broken } = scanConnectors(s);
      const folder = s ? `folder: ${ctx.display(connectorsDir(s))} — copy a connector's folder in to install it (the contract: README.md there)` : "not set up yet: strom setup";
      const data = {
        folder: s ? connectorsDir(s) : undefined,
        connectors: connectors.map((c) => ({ name: c.name, dir: c.dir, title: c.manifest.title, can: c.manifest.can, hosts: c.manifest.hosts, policy: c.manifest.policy, consent: consentState(ctx, c), routes: routesOf(c), via: routeOf(ctx.env, c).via })),
        broken,
      };
      if (!connectors.length && !broken.length)
        return {
          text: lines("no connectors yet", `  ${folder}`, "  an archive the research needs has none: build its connector — strom connector new <name> --url <portal>"),
          data,
        };
      return {
        text: lines(
          connectors.length ? table(connectors.map((c) => [c.name, c.manifest.title, c.manifest.can.join(","), `automation ${c.manifest.policy.automation}`, consentState(ctx, c), routeOf(ctx.env, c).via === "browser" ? "via your browser" : ""])) : undefined,
          ...broken.map((b) => `${b.name}  ⚠ cannot run: ${b.problem}`),
          folder,
        ),
        data,
      };
    },
  },
  {
    path: ["connector", "show"],
    summary: "One connector: what it can do, what the portal allows, your consent, how its hosts are doing",
    group: "sources",
    args: [{ name: "connector", description: "its name (its folder's name)", required: true }],
    examples: ["strom connector show example-archive"],
    run(ctx, { args }) {
      const c = findConnector(ctx.settings.shared()?.value, args[0]!);
      const m = c.manifest;
      const direct = directNetwork(c);
      const pace = connectorPace(ctx, c);
      const own = hostState(netDir(ctx), bareHost(m.hosts[0] ?? "")).own;
      return {
        text: lines(
          `${c.name}${m.version ? ` ${m.version}` : ""} — ${m.title}  (${ctx.display(c.dir)})`,
          `can        ${m.can.join(", ")}`,
          m.newer ? `newer      ${m.newer.join(", ")} — from a newer contract, left out here (strom update runs them)` : undefined,
          `runs       ${m.run.join(" ")}`,
          `automation ${m.policy.automation}${m.policy.terms ? ` · terms ${m.policy.terms}` : " · terms not recorded"}`,
          m.policy.termsSummary ? `           ${m.policy.termsSummary}` : undefined,
          m.policy.officialExport ? `official   ${m.policy.officialExport}` : undefined,
          `pace       ${paceText(pace)}${own ? " — yours for the host (strom allow host … --pace auto: the service's again)" : m.policy.pace?.source ? ` — the service's: ${m.policy.pace.source}` : ""}`,
          m.can.includes("fetch") || m.can.includes("locate") ? `images     ${routeText(ctx, c)}` : undefined,
          `consent    ${consentState(ctx, c)}`,
          m.login ? `login      ${loginState(ctx, c)} — ${m.login.about}${m.login.url ? ` (${m.login.url})` : ""}` : undefined,
          direct.length ? `⚠ reaches the network directly (strom cannot pace that):\n${direct.map((d) => `  ${d}`).join("\n")}` : "network    only through strom (checked)",
          "hosts",
          ...m.hosts.map((h) => `  ${hostLine(ctx, bareHost(h))}`),
        ),
        data: { name: c.name, connector: m, dir: c.dir, consent: consentState(ctx, c), ...(m.login ? { login: !!loginOf(ctx.env, c) } : {}), direct, pace, routes: routesOf(c), via: routeOf(ctx.env, c).via },
      };
    },
  },
  {
    path: ["connector", "use"],
    summary: "Choose how a connector's images come: directly through strom, or through your own browser — switch any time",
    group: "sources",
    description:
      "Through the browser, the agent fetches them in your own browser (Claude in Chrome), where your login to the\n" +
      "portal lives: strom still plans every request, paces it, and takes the files over from your downloads\n" +
      "folder, checked and registered. The agent gets browser tools for the connector's sites only, in the trees that\n" +
      "work with the archive (images fetched through it, or an archive, book or record on its site), from its next\n" +
      "session on. Your agent may switch it when you ask it to.",
    args: [{ name: "connector", description: "its name", required: true }],
    options: [{ name: "via", type: "string", value: "<direct|browser>", description: "direct: strom fetches them · browser: your browser does" }],
    examples: ["strom connector use example-archive --via browser", "strom connector use example-archive --via direct"],
    run(ctx, { args, opts }) {
      const c = findConnector(ctx.settings.shared()?.value, args[0]!);
      const via = String(opts.via ?? "").toLowerCase() as Route;
      if (!ROUTES.includes(via)) throw new UsageError("--via direct or --via browser", { hint: `connector ${c.name} can: ${routesOf(c).join(", ")}` });
      if (!routesOf(c).includes(via))
        throw new UsageError(`connector ${c.name} cannot fetch ${via === "browser" ? "through the browser" : "directly — only through the browser"}`, {
          hint: via === "browser" ? `its connector.json has no route "browser" (with "locate" in can) — whoever keeps it can add them: the contract, ${path.join(path.dirname(c.dir), "README.md")}` : `it needs the browser (a login the browser holds): strom connector use ${c.name} --via browser`,
        });
      if (via === "browser" && c.manifest.policy.automation === "manual")
        throw new UsageError(`${c.manifest.title} does not allow automated download (its terms, as the connector read them) — through the browser neither`, { hint: 'the user saves the images by hand: strom task wait T… --images B…:<from-to> --on "<the book, its link, which images>"' });
      const s = ctx.settings;
      s.config.connectorRoutes = { ...(s.config.connectorRoutes ?? {}), [c.name]: { via, at: new Date().toISOString(), by: ctx.io.tty ? "in a terminal" : "by a command without a terminal (an agent or the app)" } };
      s.save();
      // the agents' permissions of every tree follow at once: browser tools for these sites, or none
      const synced: string[] = [];
      for (const known of ctx.knownTrees()) {
        try {
          const tree = Tree.open(known.root, ctx.env);
          const files = syncAgentFiles(tree);
          if (files.length) {
            tree.withTreeLock(() => tree.commit(`Agent instructions: ${files.join(", ")}`, files));
            synced.push(known.name);
          }
        } catch {
          // a tree strom cannot open now gets them at its next strom run
        }
      }
      const hosts = c.manifest.hosts.map(bareHost);
      return {
        text:
          via === "browser"
            ? lines(
                `${c.name}: images through your browser from now on (${hosts.join(", ")})`,
                `  · the agent gets browser tools (Claude in Chrome) for these sites only, in the family trees that work with this`,
                `    archive (images fetched through it, or an archive, book or record of theirs on its site), from its next session${synced.length ? ` (permissions of ${synced.join(", ")} updated)` : ""}. Chrome with the`,
                "    Claude extension must be running then, signed in to the account Claude Code uses; browser tools need a model",
                "    that can review its actions (Sonnet or Opus, not Haiku)",
                `  · strom plans and paces every request, and takes the files over from ${ctx.display(s.downloads())}`,
                "    (another folder: strom config set browser.downloads <folder>)",
                `  · the first time, Chrome asks whether ${hosts[0]} may download several files: allow it once`,
                `  · back: strom connector use ${c.name} --via direct`,
              )
            : lines(`${c.name}: images directly through strom from now on, paced (${hosts.join(", ")})`, routesOf(c).includes("browser") ? `  · through your browser again: strom connector use ${c.name} --via browser` : undefined),
        data: { connector: c.name, via, hosts, synced },
      };
    },
  },
  {
    path: ["connector", "new"],
    summary: "Start a connector for an archive portal in the plugins folder: the manifest, the SDK and the brief for your agent",
    group: "sources",
    description:
      "The brief (DISCOVERY.md) has the agent find out first what the portal allows — its terms of use,\n" +
      "robots.txt, official exports — and only then write the connector against the contract (README.md\n" +
      "of the plugins folder).",
    args: [{ name: "name", description: "short name, lowercase — also its folder's name: state-archive", required: true }],
    options: [
      { name: "url", type: "string", value: "<url>", description: "the portal (its start page) — required" },
      { name: "title", type: "string", value: "<text>", description: "the archive or portal, as people call it" },
    ],
    examples: ['strom connector new state-archive --url https://archive.example.org --title "Example State Archive"'],
    run(ctx, { args, opts }) {
      const name = args[0]!;
      if (!NAME_RE.test(name)) throw new UsageError("a connector's name is lowercase letters, digits and dashes", { hint: `e.g. ${suggestName(name) ?? "example-archive"}` });
      if (!opts.url) throw new UsageError("give the portal: --url https://…");
      let url: URL;
      try {
        url = new URL(String(opts.url));
      } catch {
        throw new UsageError(`not a URL: ${opts.url}`);
      }
      const dir = path.join(ensurePluginsDir(shared(ctx)), name);
      if (fs.existsSync(dir)) throw new UsageError(`${ctx.display(dir)} exists already`, { hint: `strom connector show ${name}` });
      const title = String(opts.title ?? url.hostname);
      const fill = (s: string) => s.replaceAll("__TITLE__", title).replaceAll("__URL__", url.origin).replaceAll("__NAME__", name);
      fs.mkdirSync(dir, { recursive: true });
      const manifest = {
        interface: INTERFACE,
        title,
        version: "0.1.0",
        run: ["node", "connector.ts"],
        hosts: [url.hostname],
        can: ["find", "list", "fetch"],
        policy: { automation: "unknown", terms: "", termsSummary: "", robots: "", officialExport: "" },
      };
      fs.writeFileSync(path.join(dir, MANIFEST), JSON.stringify(manifest, null, 2) + "\n");
      fs.writeFileSync(path.join(dir, "package.json"), JSON.stringify({ type: "module", private: true }, null, 2) + "\n");
      fs.writeFileSync(path.join(dir, "sdk.ts"), readAsset("plugins", "connectors", "sdk.ts")!);
      fs.writeFileSync(path.join(dir, "connector.ts"), fill(readAsset("plugins", "connectors", "template.ts")!));
      fs.writeFileSync(path.join(dir, "DISCOVERY.md"), fill(readAsset("plugins", "connectors", "DISCOVERY.md")!));
      fs.writeFileSync(path.join(dir, "README.md"), `# ${title} — strom connector\n\nPortal: ${url.origin}\n\nHow the portal is mapped (catalogue search, book IDs, image URLs, requests per image) — written by whoever builds it.\n`);
      const rel = ctx.display(dir);
      return {
        text: lines(
          `connector ${name} started in ${rel}`,
          "",
          "next:",
          `  1. your agent reads ${path.join(rel, "DISCOVERY.md")} and the contract (README.md one folder up),`,
          "     and finds out what the portal allows — before any code",
          "  2. it writes connector.json (policy) and connector.ts, and tests with a few requests:",
          `     strom connector test ${name} --find "<place>"`,
          consentRequired(ctx.env) ? `  3. the first test needs your consent, in your terminal: strom allow connector ${name}` : undefined,
        ),
        data: { name, dir },
      };
    },
  },
  {
    path: ["connector", "add"],
    summary: "Install a connector from a folder or a git URL (you, in a terminal): copied into the plugins folder, then allowed",
    group: "sources",
    description:
      "The same as copying its folder into the plugins folder and allowing it: you read what it is and\n" +
      "what it may contact first. Its name is the folder's name (or --name). An agent cannot run this.",
    args: [{ name: "source", description: "folder or git URL", required: true }],
    options: [{ name: "name", type: "string", value: "<name>", description: "its name here, when the folder's is not one (lowercase, digits, dashes)" }],
    examples: ["strom connector add ~/Downloads/example-archive", "strom connector add https://github.com/someone/strom-connector-example.git --name example-archive"],
    run: async (ctx, { args, opts }) => {
      const source = args[0]!;
      ctx.requireHuman(`Install and allow the connector from ${source}?`, `strom connector add ${shellArg(source)}`, "connector", undefined, { window: false });
      let dir = path.resolve(ctx.cwd, source);
      let tmp: string | undefined;
      try {
        if (!fs.existsSync(dir)) {
          if (!/^(https?:\/\/|git@|ssh:\/\/)/.test(source)) throw new UsageError(`no folder ${source}`, { hint: "a folder with connector.json, or a git URL" });
          tmp = fs.mkdtempSync(path.join(os.tmpdir(), "strom-connector-"));
          const r = runGit(tmp, ["clone", "--depth", "1", source, "c"]);
          if (r.status !== 0) throw new StromError(`git clone failed: ${r.stderr.trim().split("\n").at(-1)}`);
          dir = path.join(tmp, "c");
        }
        const m = readManifest(dir);
        const base = path.basename(tmp ? source.replace(/\/+$/, "").replace(/\.git$/, "") : dir).replace(/^strom-connector-/, "");
        const name = String(opts.name ?? (NAME_RE.test(base) ? base : (suggestName(base) ?? "")));
        if (!NAME_RE.test(name)) throw new UsageError(`"${opts.name ?? base}" is not a connector's name: lowercase letters, digits and dashes`, { hint: `strom connector add ${shellArg(source)} --name <name>` });
        const target = path.join(ensurePluginsDir(shared(ctx)), name);
        const same = path.resolve(dir) === path.resolve(target);
        ctx.io.stdout(codeWarning({ name, dir: target, manifest: m }, source, directNetwork({ dir, manifest: m })) + "\n");
        if (!same && fs.existsSync(target)) ctx.io.stdout(`  ⚠ it replaces the connector ${name} that is there now\n`);
        if (!(await ctx.confirm(`Install and allow connector ${name}?`, false))) return { text: "not allowed — nothing changed", data: { allowed: false } };
        if (!same) {
          fs.rmSync(target, { recursive: true, force: true });
          fs.cpSync(dir, target, { recursive: true, filter: (f) => ![".git", ".test"].includes(path.basename(f)) });
        }
        const c: Connector = { name, dir: target, manifest: m };
        grant(ctx, c, source);
        const r = await askConnector(ctx, c, source);
        return {
          text: lines(
            `connector ${name} allowed${same ? "" : `, installed in ${ctx.display(target)}`}`,
            r.missing.length ? `hosts not allowed: ${r.missing.join(", ")} — it cannot reach them (strom allow connector ${name})` : `hosts allowed: ${r.hosts.join(", ")}`,
            m.can.includes("find") ? `find books: strom fetch ${name} --find "<place>" --years <from-to>` : undefined,
          ),
          data: { allowed: true, name, dir: target, hosts: r.hosts, missing: r.missing },
        };
      } finally {
        if (tmp) fs.rmSync(tmp, { recursive: true, force: true });
      }
    },
  },
  {
    path: ["connector", "remove"],
    summary: "Remove a connector (you, in a terminal): its folder is deleted and its consent goes",
    group: "sources",
    args: [{ name: "connector", description: "its name", required: true }],
    examples: ["strom connector remove example-archive"],
    run: async (ctx, { args }) => {
      const name = args[0]!;
      ctx.requireHuman(`Remove connector ${name}?`, `strom connector remove ${name}`, "connector", undefined, { window: false });
      const dir = path.join(connectorsDir(shared(ctx)), name);
      if (!NAME_RE.test(name) || !fs.existsSync(dir)) throw new UsageError(`no connector "${name}"`, { hint: "strom connector list" });
      if (!(await ctx.confirm(`Remove connector ${name} (deletes ${ctx.display(dir)})?`, false))) return { text: "nothing changed" };
      const all = loadConsents(ctx.env);
      delete all.connectors[name];
      saveConsents(ctx.env, all);
      const forgot = removeLogin(ctx.env, name);
      fs.rmSync(dir, { recursive: true, force: true });
      return { text: `connector ${name} removed${forgot ? ", and your login for it forgotten" : ""} — hosts you allowed stay allowed (strom consents)`, data: { removed: name } };
    },
  },
  {
    path: ["connector", "test"],
    summary: "Try a connector with a few requests (at most 10): what it finds, lists or fetches — files into its .test folder",
    group: "sources",
    args: [{ name: "connector", description: "its name", required: true }],
    options: [
      { name: "find", type: "string", value: "<place>", description: "find the books of a place" },
      { name: "years", type: "string", value: "<from-to>", description: "with --find" },
      { name: "list", type: "string", value: "<book>", description: "describe one book" },
      { name: "fetch", type: "string", value: "<book>", description: "fetch images of a book (with --images)" },
      { name: "locate", type: "string", value: "<book>", description: "where images of a book are, for the browser (with --images)" },
      { name: "images", type: "string", value: "<from-to>", description: "which images (default 1)" },
      { name: "crop", type: "string", value: "<x,y,w,h>", description: "with --fetch: a part of one image, in fractions of it" },
      { name: "half", type: "string", value: "<side>", description: "with --fetch: a half of one image (left, right, top, bottom)" },
      { name: "max", type: "string", value: "<n>", description: "requests at most (default 10)" },
    ],
    examples: [
      'strom connector test example-archive --find "Týnec" --years 1780-1850',
      "strom connector test example-archive --fetch 5359 --images 1-2",
      "strom connector test example-archive --fetch 5359 --images 2 --crop 0.5,0,0.5,0.5",
    ],
    run: async (ctx, { args, opts }) => {
      const c = findConnector(ctx.settings.shared()?.value, args[0]!);
      const request = requestOf(opts, true);
      const max = opts.max === undefined ? 10 : Number(opts.max);
      if (!Number.isInteger(max) || max < 1 || max > 50) throw new UsageError("--max: 1 to 50");
      return testWith(ctx, c, request, max);
    },
  },
  {
    path: ["connector", "probe"],
    summary: "One request through strom while you build a connector: the answer saved in its .test/probe folder, to read",
    group: "sources",
    description:
      "For mapping a portal whose pages are built by JavaScript: fetch its page, then the script it loads, and\n" +
      "look in them for the addresses its search and viewer use. Paced by strom and only to the connector's hosts,\n" +
      "like the connector itself. Each probe is one request: keep them few. Probes keep the cookies servers set,\n" +
      "like one visit in a browser (a session, the result of a form); --fresh starts without them.",
    args: [
      { name: "connector", description: "its name", required: true },
      { name: "url", description: "on one of its hosts", required: true },
    ],
    options: [
      { name: "save", type: "string", value: "<file>", description: "file name in .test/probe (default: from the URL)" },
      { name: "method", type: "string", value: "<GET|POST|HEAD>", description: "default GET" },
      { name: "body", type: "string", value: "<text>", description: "the body of a POST" },
      { name: "header", type: "string", multiple: true, value: "<Name: value>", description: "a request header (repeatable)" },
      { name: "fresh", type: "boolean", description: "start without the cookies of earlier probes (a new session)" },
    ],
    examples: [
      "strom connector probe example-archive https://archive.example.org/",
      'strom connector probe example-archive https://archive.example.org/api/search --method POST --body "{\\"q\\":\\"Týnec\\"}" --header "Content-Type: application/json"',
    ],
    run: async (ctx, { args, opts }) => {
      const c = findConnector(ctx.settings.shared()?.value, args[0]!);
      const url = args[1]!;
      const method = String(opts.method ?? "GET").toUpperCase();
      if (!["GET", "POST", "HEAD"].includes(method)) throw new UsageError("--method: GET, POST or HEAD");
      const headers: Record<string, string> = {};
      for (const h of (opts.header as string[] | undefined) ?? []) {
        const i = h.indexOf(":");
        if (i <= 0) throw new UsageError(`--header "Name: value", not "${h}"`);
        headers[h.slice(0, i).trim()] = h.slice(i + 1).trim();
      }
      if (!(await ensureAllowed(ctx, c))) return { text: "not allowed — nothing was sent", exitCode: 1 };
      const dir = path.join(c.dir, ".test", "probe");
      if (c.manifest.browser?.pages) {
        // the portal answers a real browser only: the probe is a page of the user's browser too
        const want: PageRequest = { method: method as PageRequest["method"], url, headers, ...(opts.body !== undefined ? { body: String(opts.body) } : {}) };
        const u = URL.canParse(url) ? new URL(url) : undefined;
        if (!u || !hostAllowed(u.hostname, c.manifest.hosts)) throw new UsageError(`${u?.hostname ?? url} is not one of its hosts (${c.manifest.hosts.join(", ")})`);
        const save = opts.save === undefined ? undefined : String(opts.save);
        const got = loadPage(ctx.tree().root, c.name, pageKey(want));
        if (got) return probeResult(ctx, c, method, url, got, save);
        return planPages(ctx, c, want, { cmd: "probe", ...(save ? { save } : {}) }, `probe ${url}`);
      }
      const jarFile = path.join(dir, ".cookies.json");
      let kept: unknown = [];
      try {
        if (!opts.fresh) kept = JSON.parse(fs.readFileSync(jarFile, "utf8"));
      } catch {}
      const cookies = CookieJar.from(kept);
      const res = await politeRequest(url, {
        stateDir: netDir(ctx),
        hosts: c.manifest.hosts,
        pace: c.manifest.policy.pace ?? {},
        method: method as "GET" | "POST" | "HEAD",
        headers,
        ...(opts.body !== undefined ? { body: String(opts.body) } : {}),
        cookies,
      });
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(jarFile, JSON.stringify(cookies.entries(), null, 2) + "\n");
      return probeResult(ctx, c, method, url, res, opts.save === undefined ? undefined : String(opts.save), [...new Set(cookies.entries().map((k) => k.name))]);
    },
  },
  {
    path: ["connector", "grep"],
    summary: "Search what its probes and tests saved (addresses, form fields, scripts): each hit with the text round it",
    group: "sources",
    description:
      "The pages and scripts of a portal are often too big to read whole, and many are one long line. This finds\n" +
      "a text (in any case), or a regular expression with --regex, in the files of the connector's .test folder\n" +
      "and shows each hit with a little text round it and where it is (file:line:column). Nothing is requested.\n" +
      "It finds a text as it reads: &aacute; or &#225; of a page and \\u00e1 of a script are á, &nbsp; is a space.\n" +
      "The text round a hit is shown as the file has it, which is what a connector reads.",
    args: [
      { name: "connector", description: "its name", required: true },
      { name: "pattern", description: "the text to find: in any case, as it reads (&aacute; is á), a space for any white space", required: true },
    ],
    options: [
      { name: "regex", type: "boolean", description: "the pattern is a regular expression (JavaScript, in any case)" },
      { name: "in", type: "string", value: "<file>", description: "only this file (its name in .test/probe, or its path in .test)" },
      { name: "around", type: "string", value: "<n>", description: "characters shown before and after a hit (default 80)" },
    ],
    examples: [
      'strom connector grep example-archive "/api/"',
      'strom connector grep example-archive "\\.jpe?g" --regex --in viewer.html',
    ],
    run: (ctx, { args, opts }) => {
      const c = findConnector(ctx.settings.shared()?.value, args[0]!);
      const pattern = args[1]!;
      const around = opts.around === undefined ? 80 : Number(opts.around);
      if (!Number.isInteger(around) || around < 0 || around > 2000) throw new UsageError("--around: a number of characters, 0–2000");
      const re = grepPattern(pattern, !!opts.regex);
      const base = path.join(c.dir, ".test");
      let files = textFiles(base);
      if (opts.in !== undefined) {
        const want = String(opts.in);
        files = files.filter((f) => [path.relative(base, f), path.relative(path.join(base, "probe"), f)].some((r) => r.split(path.sep).join("/") === want.split(path.sep).join("/")));
        if (!files.length) throw new UsageError(`no saved file ${want} in ${ctx.display(base)}`, { hint: `strom connector grep ${c.name} ${shellArg(pattern)}${opts.regex ? " --regex" : ""} — to search them all` });
      }
      if (!files.length) return { text: `nothing saved yet — strom connector probe ${c.name} <url> saves an answer to search`, data: { total: 0, hits: [] } };
      // hits close together (a long list of names) are shown once, in one stretch of text
      const hits: { file: string; line: number; column: number; hits: number; text: string }[] = [];
      let total = 0;
      for (const f of files) {
        const text = fs.readFileSync(f, "utf8");
        // found as the file has it, and as it reads (&aacute; or \u00e1 written out): each hit once
        const found = new Map<number, number>();
        for (const m of text.matchAll(re)) {
          if (found.size >= 5000) break;
          if (m[0]) found.set(m.index, m.index + m[0].length);
        }
        const read = readable(text);
        for (const m of read ? read.text.matchAll(re) : []) {
          if (found.size >= 5000) break;
          const at = read!.at[m.index]!;
          if (m[0] && !found.has(at)) found.set(at, read!.at[m.index + m[0].length]!);
        }
        let open: { from: number; to: number; at: number; n: number } | undefined;
        const close = () => {
          if (!open) return;
          const lineStart = text.lastIndexOf("\n", open.at - 1) + 1;
          hits.push({
            file: path.relative(base, f).split(path.sep).join("/"),
            line: text.slice(0, open.at).split("\n").length,
            column: open.at - lineStart + 1,
            hits: open.n,
            text: (open.from > 0 ? "…" : "") + text.slice(open.from, open.to).replace(/\s+/g, " ") + (open.to < text.length ? "…" : ""),
          });
          open = undefined;
        };
        for (const [at, end] of [...found].sort((x, y) => x[0] - y[0])) {
          total++;
          const from = Math.max(0, at - around);
          const to = Math.min(text.length, end + around);
          if (open && from <= open.to && to - open.from <= Math.max(600, 4 * around)) {
            open.to = to;
            open.n++;
          } else {
            close();
            open = { from, to, at, n: 1 };
          }
          if (total >= 5000) break;
        }
        close();
        if (total >= 5000) break;
      }
      const page = paginate(hits, ctx.limit, ctx.page);
      const inFiles = new Set(hits.map((h) => h.file)).size;
      return {
        text: hits.length
          ? lines(
              `${total}${total >= 5000 ? "+" : ""} hit(s) in ${inFiles} file(s) of ${ctx.display(base)}:`,
              ...page.items.map((h) => `${h.file}:${h.line}:${h.column}  ${h.hits > 1 ? `(${h.hits} hits) ` : ""}${h.text}`),
              moreLine(page, `strom connector grep ${c.name} ${shellArg(pattern)}${opts.regex ? " --regex" : ""}${opts.in !== undefined ? ` --in ${shellArg(String(opts.in))}` : ""}`) || undefined,
            )
          : `not found in ${files.length} saved file(s) of ${ctx.display(base)}`,
        data: { total, hits: page.items },
      };
    },
  },
  {
    path: ["fetch"],
    summary: "Download through a connector: images of a book (registered with their provenance), or find books of a place",
    group: "sources",
    tree: true,
    writes: true,
    lock: "sections",
    description:
      "Every request goes through strom's limiter: one at a time, paced, capped per hour; a refusal (401/403)\n" +
      "stops the run and leaves the archive alone for a day. With --recordset the images are registered at once;\n" +
      "without it they go into the inbox, a folder for the book.\n" +
      "--crop or --half fetches a part of one image, as sharp as the portal gives it (a connector that can: part),\n" +
      "registered with the image; a view of the image then shows that place from it by itself. The book is\n" +
      "known from images the connector fetched for the record set before.\n" +
      "A connector set to fetch through your browser (strom connector use <c> --via browser) gives a plan instead:\n" +
      "the page to open, a script to run there that fetches the images at the archive's pace into the browser's\n" +
      "downloads folder, and --take, which takes them over from there, checked and registered.\n" +
      "A connector whose portal answers a real browser only (browser.pages: a bot check) has every page read\n" +
      "there too: each run plans the page it needs next, --take gives it to the connector and goes on.",
    args: [
      { name: "connector", description: "its name", required: true },
      { name: "book", description: "the book, as the connector knows it (its ID on the portal)" },
    ],
    options: [
      { name: "images", type: "string", value: "<from-to>", description: "which images of the book" },
      { name: "recordset", type: "string", value: "<B…>", description: "register them as images of this record set" },
      { name: "crop", type: "string", value: "<x,y,w,h>", description: "a part of one image: fractions of it (0.5,0.2,0.5,0.3), or pixels of the registered image" },
      { name: "half", type: "string", value: "<side>", description: "a half of one image: left, right, top or bottom (with --crop: within it)" },
      { name: "find", type: "string", value: "<place>", description: "find the books that cover a place" },
      { name: "years", type: "string", value: "<from-to>", description: "with --find" },
      { name: "list", type: "boolean", description: "describe the book (title, images)" },
      { name: "take", type: "boolean", description: "through the browser: take over what it downloaded (checked, registered)" },
      { name: "result", type: "string", value: "<line>", description: "with --take: the line the browser script returned (strom-result …)" },
    ],
    examples: [
      'strom fetch example-archive --find "Týnec" --years 1780-1850',
      "strom fetch example-archive 5359 --images 40-69 --recordset B0001",
      "strom fetch example-archive 5359 --recordset B0001 --images 2 --crop 0.5,0.4,0.5,0.3",
      'strom fetch example-archive --take --result "strom-result 40:200:1843221 41:200:1790234"',
    ],
    run: async (ctx, { args, opts }) => {
      const tree = ctx.tree();
      const c = findConnector(ctx.settings.shared()?.value, args[0]!);
      if (opts.take) return takeOver(ctx, c, opts.result === undefined ? undefined : String(opts.result));
      // Through the browser, an agent needs browser tools — only a tree that works with this archive gives them.
      if (isAgent(ctx.env) && routeOf(ctx.env, c).via === "browser" && !treeBrowserConnectors(tree, ctx.settings.shared()?.value).some((x) => x.name === c.name)) {
        const site = c.manifest.hosts[0]!;
        throw new StromError(`this family tree does not work with ${c.manifest.title} yet, so you have no browser tools for ${site}`, {
          hint: `record the archive: strom repo add "${c.manifest.title}" --url https://${site} — the browser tools come with the next conversation or run (tell the user)`,
        });
      }
      const perHour = Math.min(1000, connectorPace(ctx, c).perHour);
      const wantsPart = opts.crop !== undefined || opts.half !== undefined;
      if (wantsPart && !c.manifest.can.includes("part"))
        throw new UsageError(`connector ${c.name} fetches whole images only (it cannot: part)`, {
          hint: 'the user saves the part by hand: zoomed in on it in the portal\'s viewer — strom task wait T… --images B…:<n> --on "<the book, its link, the image, the entry to zoom in on; saved as 40a.jpg>"',
        });
      const request: ConnectorRequest = opts.find
        ? requestOf(opts, false)
        : opts.list
          ? { cmd: "list", book: need(args[1], "the book") }
          : wantsPart
            ? partRequest(tree, c, args[1], opts)
            : { cmd: "fetch", book: need(args[1], "the book"), images: parseImages(opts.images, perHour) ?? needImages() };
      const recordset = opts.recordset ? requireRecord<RecordSet>(tree, String(opts.recordset), "recordset").id : undefined;
      return fetchWith(ctx, c, request, recordset);
    },
  },
  {
    path: ["allow", "connector"],
    summary: "Allow a connector to run (you, in a terminal, after reading what it is and what it contacts) — or take it back",
    group: "setup",
    description:
      "Allows its folder and automated access to each of its hosts. While its code reaches the network only\n" +
      "through strom, your agent may go on improving it; code that goes round strom needs a yes after every change.",
    args: [{ name: "connector", description: "its name", required: true }],
    options: [{ name: "revoke", type: "boolean", description: "take the consent back (its hosts stay allowed: strom allow host <host> --revoke)" }],
    examples: ["strom allow connector example-archive", "strom allow connector example-archive --revoke"],
    run: async (ctx, { args, opts }) => {
      const name = args[0]!;
      if (!opts.revoke && !consentRequired(ctx.env)) {
        const c = findConnector(shared(ctx), name);
        if (!directNetwork(c).length)
          return {
            text: `consents are off: connector ${name} runs without asking — paced by strom, only to ${c.manifest.hosts.join(", ")}\nto be asked first: strom config set connectors.consent on`,
            data: { name, allowed: true, consents: "off" },
          };
      }
      const how = ctx.requireHuman(
        `${opts.revoke ? "Take back" : "Allow"} connector ${name}?`,
        `strom allow connector ${name}${opts.revoke ? " --revoke" : ""}`,
        `connector:${name}`,
        opts.revoke ? ui(ctx.uiLang(), "ui.consent.connector.revoke", { name }) : consentWindow(ctx, findConnector(shared(ctx), name)),
      );
      if (opts.revoke) {
        const all = loadConsents(ctx.env);
        const had = !!all.connectors[name];
        delete all.connectors[name];
        saveConsents(ctx.env, all);
        return { text: had ? `connector ${name}: consent taken back — it does not run now` : `connector ${name} was not allowed — nothing changed`, data: { name, allowed: false } };
      }
      const c = findConnector(shared(ctx), name);
      const before = missingConsents(ctx.env, c);
      if (!before.code && !before.hosts.length) return { text: `connector ${name} is allowed already, with its hosts ${c.manifest.hosts.map(bareHost).join(", ")}`, data: { name, allowed: true } };
      const r = await askConnector(ctx, c, ctx.display(c.dir), how === "window");
      if (!r.allowed) return { text: "not allowed — nothing changed", data: { name, allowed: false } };
      return {
        text: lines(`connector ${name} allowed`, r.missing.length ? `hosts not allowed: ${r.missing.join(", ")} — it cannot reach them` : `hosts allowed: ${r.hosts.join(", ")}`),
        data: { name, allowed: true, hosts: r.hosts, missing: r.missing },
      };
    },
  },
  {
    path: ["allow", "host"],
    summary: "Allow automated access to an archive's host (you, in a terminal, after the warning) — or take it back",
    group: "setup",
    args: [{ name: "host", description: "e.g. digi.example.org", required: true }],
    options: [
      { name: "revoke", type: "boolean", description: "take the consent back" },
      { name: "unblock", type: "boolean", description: "lift a refusal (401/403) early — only after the archive said it is fine" },
      { name: "pace", type: "string", value: "<seconds|auto>", description: `your own pause between two requests to the host (at least ${MIN_INTERVAL_MS / 1000} s); auto: the service's again` },
      { name: "per-hour", type: "string", value: "<n|none|auto>", description: "your own hourly cap for the host; none: no cap; auto: the service's again (strom sets none by itself)" },
    ],
    examples: ["strom allow host archive.example.org", "strom allow host archive.example.org --pace 1 --per-hour none", "strom allow host archive.example.org --pace auto --per-hour auto", "strom allow host archive.example.org --revoke"],
    run: async (ctx, { args, opts }) => {
      const host = args[0]!.toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
      const lang = ctx.uiLang();
      // The user's own pace for the host: theirs to set — asked in a window when an agent runs it.
      if (opts.pace !== undefined || opts["per-hour"] !== undefined) {
        const was = hostState(netDir(ctx), host).own;
        const own = { ...(was?.minIntervalMs !== undefined ? { minIntervalMs: was.minIntervalMs } : {}), ...(was?.perHour !== undefined ? { perHour: was.perHour } : {}) } as { minIntervalMs?: number; perHour?: number };
        if (opts.pace !== undefined) {
          const v = String(opts.pace).trim();
          if (v === "auto") delete own.minIntervalMs;
          else if (Number(v) * 1000 >= MIN_INTERVAL_MS) own.minIntervalMs = Math.round(Number(v) * 1000);
          else throw new UsageError(`--pace must be seconds, at least ${MIN_INTERVAL_MS / 1000}, or auto — not "${v}"`);
        }
        if (opts["per-hour"] !== undefined) {
          const v = String(opts["per-hour"]).trim();
          if (v === "auto") delete own.perHour;
          else if (v === "none") own.perHour = 0;
          else if (Number.isInteger(Number(v)) && Number(v) > 0) own.perHour = Number(v);
          else throw new UsageError(`--per-hour must be a number, none or auto — not "${v}"`);
        }
        const c = listConnectors(ctx.settings.shared()?.value).find((x) => x.manifest.hosts.some((h) => hostAllowed(host, [h])));
        const next = hostPace({ recent: [], own: { ...own, at: "" } }, c?.manifest.policy.pace);
        ctx.requireHuman(`Set the pace of ${host}: ${paceText(next)}?`, `strom allow host ${host}${opts.pace !== undefined ? ` --pace ${opts.pace}` : ""}${opts["per-hour"] !== undefined ? ` --per-hour ${opts["per-hour"]}` : ""}`, `pace:${host}`, ui(lang, "ui.consent.host.pace", { host, seconds: next.minIntervalMs / 1000, cap: Number.isFinite(next.perHour) ? ui(lang, "ui.pace.cap", { n: next.perHour }) : ui(lang, "ui.pace.nocap") }));
        const s = setOwnPace(netDir(ctx), host, own);
        const now = paceAt(ctx, host, c);
        return { text: `${host}: ${paceText(now)}${s.own ? " — yours" : " — the service's again"}`, data: { host, pace: { minIntervalMs: now.minIntervalMs, perHour: Number.isFinite(now.perHour) ? now.perHour : null }, own: s.own ?? null } };
      }
      const how = ctx.requireHuman(
        `${opts.revoke ? "Take back" : opts.unblock ? "Lift the refusal of" : "Allow"} automated access to ${host}?`,
        `strom allow host ${host}${opts.revoke ? " --revoke" : opts.unblock ? " --unblock" : ""}`,
        `host:${host}`,
        ui(lang, opts.revoke ? "ui.consent.host.revoke" : opts.unblock ? "ui.consent.host.unblock" : "ui.consent.host", { host }),
      );
      const all = loadConsents(ctx.env);
      if (opts.revoke) {
        delete all.hosts[host];
        saveConsents(ctx.env, all);
        return { text: `${host}: consent taken back — no connector reaches it now`, data: { host, allowed: false } };
      }
      if (opts.unblock) {
        if (how === "terminal" && !(await ctx.confirm(`${host} refused us. Lift it now (only if the archive said it is fine)?`, false))) return { text: "nothing changed" };
        clearBlock(netDir(ctx), host);
        return { text: `${host}: the refusal is lifted — strom will ask it again, slowly`, data: { host, unblocked: true } };
      }
      const c = listConnectors(ctx.settings.shared()?.value).find((x) => x.manifest.hosts.some((h) => hostAllowed(host, [h])));
      const ok = await askHost(ctx, host, c, how === "window");
      return { text: ok ? `${host}: automated access allowed (strom consents)` : "not allowed — nothing changed", data: { host, allowed: ok } };
    },
  },
  {
    path: ["consents"],
    summary: "Consents (on or off, what you allowed) and archive hosts: how each is doing (paced, capped, refused)",
    group: "setup",
    run(ctx) {
      const all = loadConsents(ctx.env);
      const hosts = [...new Set([...Object.keys(all.hosts), ...knownHosts(netDir(ctx))])].sort();
      const names = Object.keys(all.connectors).sort();
      return {
        text: lines(
          consentRequired(ctx.env)
            ? "consents: on — a connector runs only once you allow it, and each archive host it contacts"
            : "consents: off — connectors run without asking (paced by strom, only to their hosts); code that goes round strom needs your yes · to be asked first: strom config set connectors.consent on",
          "connectors",
          ...names.map((n) => `  ${n}  ${ctx.display(all.connectors[n]!.dir)}  since ${all.connectors[n]!.at.slice(0, 10)}  hosts ${all.connectors[n]!.hosts.join(", ")}`),
          names.length ? undefined : "  (none)",
          "hosts (automated access)",
          ...hosts.map((h) => `  ${hostLine(ctx, h)}${all.hosts[h] ? `  · allowed since ${all.hosts[h].at.slice(0, 10)}` : ""}`),
          hosts.length ? undefined : "  (none)",
          `pace: one request at a time per host — the service's pace (its connector says it), else ≥${DEFAULT_PACE.minIntervalMs / 1000} s apart; an hourly cap only where the service or you set one; slower while a host answers slowly, a wait when it says its limit is used up; a refusal stops for a day · yours for a host: strom allow host <host> --pace <seconds> --per-hour <n>`,
          Object.keys(loadLogins(ctx.env)).length ? `logins saved (strom login): ${Object.keys(loadLogins(ctx.env)).sort().join(", ")}` : undefined,
          "take back: strom allow connector <name> --revoke · strom allow host <host> --revoke",
        ),
        data: { consents: consentRequired(ctx.env) ? "on" : "off", ...all, logins: Object.keys(loadLogins(ctx.env)).sort(), hostState: Object.fromEntries(hosts.map((h) => [h, hostState(netDir(ctx), h)])) },
      };
    },
  },
  {
    path: ["login"],
    summary: "Your login to an archive portal, for a connector that can use one (you, in a terminal) — kept on this computer only",
    group: "setup",
    description:
      "An account you have on a portal — perhaps one you paid for — lets its connector fetch what the account\n" +
      "gives. You type it in here; an agent cannot. It is kept in your config folder, readable by you alone,\n" +
      "never in a tree, the shared folder or git. strom puts it into the connector's requests itself, only to\n" +
      "the connector's hosts and only over https, and takes it out of every answer: the connector's code never\n" +
      "sees it, nor does your agent. Without a connector: the logins saved.",
    args: [{ name: "connector", description: "its name" }],
    options: [{ name: "remove", type: "boolean", description: "forget the login" }],
    examples: ["strom login example-archive", "strom login example-archive --remove", "strom login"],
    run: async (ctx, { args, opts }) => {
      const saved = loadLogins(ctx.env);
      if (!args[0]) {
        const usable = listConnectors(ctx.settings.shared()?.value).filter((c) => c.manifest.login);
        const names = [...new Set([...Object.keys(saved), ...usable.map((c) => c.name)])].sort();
        return {
          text: names.length
            ? lines(
                ...names.map((n) => {
                  const c = usable.find((x) => x.name === n);
                  return `${n}  ${saved[n] ? `saved ${saved[n]!.at.slice(0, 10)} (${fieldsOf(saved[n]!.values, c).join(", ")})` : "none"}${c ? ` — ${c.manifest.login!.about}` : " — no such connector now"}`;
                }),
                "save one: strom login <connector> · forget it: strom login <connector> --remove",
              )
            : "no connector here uses a login",
          data: { logins: names.map((n) => ({ connector: n, saved: !!saved[n], at: saved[n]?.at, fields: saved[n] ? fieldsOf(saved[n]!.values, usable.find((x) => x.name === n)) : [] })) },
        };
      }
      const name = args[0];
      if (opts.remove) {
        ctx.requireHuman(`Forget your login for connector ${name}?`, `strom login ${name} --remove`, `login:${name}`, undefined, { window: false });
        return removeLogin(ctx.env, name)
          ? { text: `the login for ${name} is forgotten — deleted from this computer`, data: { connector: name, saved: false } }
          : { text: `no login saved for ${name} — nothing changed`, data: { connector: name, saved: false } };
      }
      const c = findConnector(shared(ctx), name);
      if (!c.manifest.login)
        throw new UsageError(`connector ${name} uses no login`, { hint: `a connector that can use one says so in its connector.json ("login"): ${path.join(connectorsDir(shared(ctx)), "README.md")}` });
      ctx.requireHuman(`Save your login to ${c.manifest.title} for connector ${name}?`, `strom login ${name}`, `login:${name}`, undefined, { window: false });
      if (loginOf(ctx.env, c) && !(await ctx.confirm(`A login for ${name} is saved already. Replace it?`, false))) return { text: "nothing changed", data: { connector: name, saved: true } };
      if (!(await askLogin(ctx, c))) return { text: "no login saved", data: { connector: name, saved: false }, exitCode: 1 };
      return {
        text: lines(`login for ${name} saved — strom puts it into its requests to ${c.manifest.hosts.map(bareHost).join(", ")}`, `forget it: strom login ${name} --remove`),
        data: { connector: name, saved: true },
      };
    },
  },
);

function need(v: string | undefined, what: string): string {
  if (!v) throw new UsageError(`give ${what}`, { hint: "strom fetch <connector> <book> --images 40-69 --recordset B… · or --find <place>" });
  return v;
}

function needImages(): never {
  throw new UsageError("which images? --images 40-69", { hint: "strom fetch <connector> <book> --list tells how many there are" });
}

/** The part of an image --crop and --half name, in fractions of it (pixels: of the registered image). */
/** A part of one image, of the book the connector fetched this record set from before (or the one named). */
function partRequest(tree: ReturnType<Context["tree"]>, c: Connector, book: string | undefined, opts: Record<string, unknown>): ConnectorRequest {
  if (!opts.recordset) throw new UsageError("a part is registered with its image: give --recordset B…", { hint: `strom fetch ${c.name} --recordset B… --images <n> --crop x,y,w,h` });
  const recordset = requireRecord<RecordSet>(tree, String(opts.recordset), "recordset").id;
  const images = parseImages(opts.images, 1);
  if (!images) throw new UsageError("which image? --images <n> (one)", { hint: `strom fetch ${c.name} --recordset ${recordset} --images <n> --crop x,y,w,h` });
  const all = tree.list<Media>("media");
  const whole = findImage(all, recordset, images[0]!);
  const known = all.find((m) => m.recordset === recordset && m.fetched?.connector === c.name)?.fetched?.book;
  const b = book ?? known;
  if (!b) throw new UsageError(`which book of ${c.name}? none of the images of ${recordset} came through it`, { hint: `strom fetch ${c.name} <book> --recordset ${recordset} --images ${images[0]} --crop x,y,w,h` });
  return { cmd: "part", book: b, image: images[0]!, region: partRegion(opts, whole?.part ? undefined : whole) };
}

/**
 * Images through the user's browser. The connector says where they are (locate,
 * its pages through strom as usual); the limiter reserves a time for each
 * request of the browser — opening the page, then one per image — in the state
 * every strom process shares; the agent runs a script in a tab of the images'
 * site that keeps to those times and saves each image into the downloads folder.
 */
/** strom connector test, once the request is known (again after a page from the browser). */
async function testWith(ctx: Context, c: Connector, request: ConnectorRequest, max: number): Promise<Result> {
  if (!(await ensureAllowed(ctx, c))) return { text: "not allowed — nothing was sent", exitCode: 1 };
  if (!(await ensureLogin(ctx, c))) return { text: "no login — nothing was sent", exitCode: 1 };
  const workDir = path.join(c.dir, ".test");
  fs.mkdirSync(workDir, { recursive: true });
  for (const e of fs.readdirSync(workDir)) if (e !== "probe") fs.rmSync(path.join(workDir, e), { recursive: true, force: true }); // what probes saved stays
  const pages = pagesOf(ctx, c);
  const r = await runConnector(c, request, { env: ctx.env, workDir, netDir: netDir(ctx), maxRequests: max, onLog: (l) => ctx.io.stderr(`  · ${l}\n`), ...(pages ? { pages } : {}) });
  if (r.needs) return planPages(ctx, c, r.needs, { cmd: "test", request: { ...request }, max }, `strom connector test ${c.name} (${request.cmd})`, describeRun(r, `test ${request.cmd}`));
  const direct = directNetwork(c);
  return {
    text: lines(
      describeRun(r, `test ${request.cmd}`),
      r.books.length ? `books (${r.books.length}):\n${bookLines(r, c, `strom connector test ${c.name} --list <id>`).join("\n")}` : undefined,
      r.images.length ? `images (${r.images.length}): ${r.images.map((i) => `${i.n ?? "?"}${i.region ? ` part ${regionText(i.region)}` : ""}=${path.basename(i.file)} ${fs.statSync(i.file).size} B${pixels(i.file)}`).join(", ")} in ${ctx.display(workDir)}` : undefined,
      r.located.length ? `located (${r.located.length}):\n${r.located.map((l) => `  ${l.n}${l.region ? ` part ${regionText(l.region)}` : ""}  ${l.src}${l.url && l.url !== l.src ? `\n       page ${l.url}` : ""}`).join("\n")}` : undefined,
      c.manifest.login ? (loginOf(ctx.env, c) ? "with the user's login" : `without a login${c.manifest.login.required ? "" : " (the user may save one: strom login " + c.name + ")"}`) : undefined,
      direct.length ? `⚠ the code reaches the network directly — strom cannot pace that:\n${direct.map((d) => `  ${d}`).join("\n")}` : undefined,
      c.manifest.policy.automation === "unknown" ? "⚠ policy.automation is unknown — find out what the portal's terms say (DISCOVERY.md, step 1)" : undefined,
    ),
    data: { ...r, direct },
    ...(r.stopped && !r.books.length && !r.images.length && !r.located.length ? { exitCode: 1 } : {}),
  };
}

/** What a probe got, saved in .test/probe to read — from strom's request or from the user's browser. */
function probeResult(ctx: Context, c: Connector, method: string, url: string, res: { status: number; contentType: string; headers: Record<string, string>; url: string; body: Buffer }, save: string | undefined, cookies?: string[]): Result {
  const dir = path.join(c.dir, ".test", "probe");
  fs.mkdirSync(dir, { recursive: true });
  const fromUrl = decodeURIComponent((URL.canParse(res.url) ? new URL(res.url) : new URL(url)).pathname.split("/").filter(Boolean).at(-1) ?? "") || "index.html";
  const name = String(save ?? fromUrl).replace(/[^\p{L}\p{M}\p{N}._-]+/gu, "_").replace(/^\.+/, "_");
  const file = path.join(dir, name);
  fs.writeFileSync(file, res.body);
  const textual = /^(text\/|application\/(json|xml|javascript)|image\/svg)/.test(res.contentType);
  const check = botCheck(res.body, res.headers);
  return {
    text: lines(
      `${method} ${url} → ${res.status} · ${res.contentType || "no type"} · ${res.body.length} B${res.url && res.url !== url ? ` · after redirects ${res.url}` : ""}${cookies ? "" : " · from your browser"}`,
      ...Object.entries(res.headers)
        .filter(([k]) => !["date", "connection", "keep-alive", "transfer-encoding", "vary"].includes(k))
        .map(([k, v]) => `  ${k}: ${v}`),
      `saved: ${ctx.display(file)}${textual ? ` — search it: strom connector grep ${c.name} <text> (an address such as /api/, .json, .jpg; a form field)` : ""}`,
      check
        ? c.manifest.browser?.pages
          ? `⚠ this is ${check}'s check whether a person is there, not the page: the user passes it in that tab of their browser (never you), then probe again`
          : `⚠ this is ${check}'s check whether a person is there, not the page: the portal gives its pages to a real browser only. Build the connector through the user's browser: in connector.json "routes": ["browser"] and "browser": {"pages": true} (the contract, section 5), then strom connector use ${c.name} --via browser — browser tools come with your next session, and the user passes the check in their own browser, never you`
        : undefined,
      cookies?.length ? `cookies kept for the next probe: ${cookies.join(", ")} (--fresh starts without them)` : undefined,
      textual && res.body.length <= 1500 ? res.body.toString("utf8") : undefined,
    ),
    data: { status: res.status, type: res.contentType, headers: res.headers, url: res.url, bytes: res.body.length, file, ...(cookies ? { cookies } : { via: "browser" }), ...(check ? { botCheck: check } : {}) },
  };
}

/** browser.pages: what the browser got, for the connector's run (undefined: the connector reaches the portal through strom). */
function pagesOf(ctx: Context, c: Connector): ((r: PageRequest) => PageAnswer | undefined) | undefined {
  if (!c.manifest.browser?.pages) return undefined;
  const root = ctx.tree().root;
  return (r) => loadPage(root, c.name, pageKey(r));
}

/**
 * A page for a connector whose portal answers a real browser only: planned in
 * strom's limiter, asked by a script in the user's tab, saved into the
 * downloads folder — then --take gives it to the connector and goes on.
 */
function planPages(ctx: Context, c: Connector, want: PageRequest, resume: Resume, what: string, before?: string): Result {
  const tree = ctx.tree();
  const u = new URL(want.url);
  const pace = paceAt(ctx, u.hostname, c);
  let times: number[];
  try {
    // one pause ahead: time to open the tab
    times = reserveSlots(netDir(ctx), u.hostname, c.manifest.policy.pace, 1, { leadMs: pace.minIntervalMs });
  } catch (err) {
    if (!(err instanceof NetError)) throw err;
    return { text: lines(before, `nothing planned: ${err.message}`), exitCode: 1 };
  }
  const key = pageKey(want);
  const open = c.manifest.browser?.open && new URL(c.manifest.browser.open).origin === u.origin ? c.manifest.browser.open : `${u.origin}/robots.txt`;
  const page: PlanPage = { key, method: want.method, url: want.url, headers: want.headers, ...(want.body !== undefined ? { body: want.body } : {}), file: `strom-${c.name}-page-${key}`, at: times[0]! };
  // a page planned again replaces its older plan
  for (const old of loadPlans(tree.root, c.name)) if (old.pages?.some((p) => p.key === key)) removePlan(tree.root, old.id);
  const now = Date.now();
  const book = "request" in resume && typeof resume.request.book === "string" ? resume.request.book : "";
  const plan: BrowserPlan = { id: `${c.name}-${now}-p`, connector: c.name, book, pages: [page], resume, open, origin: u.origin, host: u.hostname, gap: pace.minIntervalMs, created: now, until: now + PLAN_TTL_MS, items: [] };
  savePlan(tree.root, plan);
  const script = pageScript(plan);
  const take = `strom fetch ${c.name} --take --result "<the line it returned>"`;
  return {
    text: lines(
      before,
      `browser plan: 1 page of ${u.hostname} for ${what} — the portal answers a real browser only; about ${Math.max(1, Math.round((page.at - now) / 1000))} s at its pace`,
      `1. A tab of your own on ${u.origin} — open ${open} if you have none there.`,
      "   The site shows its check whether a person is there (a box to tick, a puzzle), a login, or the browser is not connected: stop and ask the user — that is theirs to do, never yours (strom task wait T… --on \"…\"). Then go on.",
      "2. Run this in that tab with the JavaScript tool, exactly as it is:",
      "",
      script,
      "",
      `3. Then: ${take} — strom gives the page to the connector and goes on with ${what}; it may plan the next page: do the same again.`,
      `The browser saves it into ${ctx.display(ctx.settings.downloads())} as ${page.file}.json — strom takes it over; do not open, move or read it yourself.`,
    ),
    data: { plan: { id: plan.id, open, host: plan.host, pages: [{ key, method: page.method, url: page.url, file: page.file, at: new Date(page.at).toISOString() }] }, script, take, resume },
  };
}

/** A page the browser got, also as a file of the connector's .test/probe: strom connector grep reads it while the connector is built. */
function keepForGrep(c: Connector, pg: PlanPage, page: PageAnswer): void {
  const ext = /json/.test(page.contentType) ? ".json" : /javascript/.test(page.contentType) ? ".js" : /^image\/(\w+)/.exec(page.contentType)?.[1] ? `.${/^image\/(\w+)/.exec(page.contentType)![1]!.replace("jpeg", "jpg")}` : /text\/plain/.test(page.contentType) ? ".txt" : ".html";
  const tail = (URL.canParse(pg.url) ? new URL(pg.url).pathname.split("/").filter(Boolean).at(-1) : undefined)?.replace(/[^\p{L}\p{N}._-]+/gu, "_").slice(0, 60) ?? "page";
  try {
    const dir = path.join(c.dir, ".test", "probe", "browser");
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, `${tail}-${pg.key}${ext}`), page.body);
  } catch {
    // a copy to read: the page itself is kept in the tree
  }
}

/** Pages the browser saved: kept for the connector, and the command they were planned for goes on. */
async function takePages(ctx: Context, c: Connector, plans: BrowserPlan[], result: string | undefined): Promise<Result> {
  const tree = ctx.tree();
  const dir = ctx.settings.downloads();
  const got = result === undefined ? [] : parseResult(result);
  const notes: string[] = [];
  const taken: string[] = [];
  let next: Resume | undefined;
  for (const plan of plans) {
    const left: PlanPage[] = [];
    let stop = false;
    for (const pg of plan.pages ?? []) {
      const f = findDownload(dir, pg.file);
      const said = got.find((g) => g.page === pg.key);
      if (!f.file) {
        left.push(pg);
        if (said?.failed) notes.push(`${pg.url}: the browser could not ask for it (no network, or the site closed the connection) — run the script again`);
        else if (said?.status === 200) notes.push(`${pg.url}: the browser got it but saved nothing into ${ctx.display(dir)} — Chrome lets a site download one file until the user allows automatic downloads for it (at the right end of the address bar)`);
        else if (said?.status && [401, 403, 429].includes(said.status)) {
          const why = refusedBy(netDir(ctx), plan.host, said.status);
          if (why) notes.push(why);
          stop = true;
        }
        continue;
      }
      const page = readSavedPage(f.file);
      for (const x of [f.file, ...f.others]) fs.rmSync(x, { force: true });
      if (typeof page === "string") {
        notes.push(`${pg.url}: ${page} — removed; run the script again`);
        left.push(pg);
        continue;
      }
      const check = botCheck(page.body, page.headers);
      if (check) {
        notes.push(`${plan.host} gave its check whether a person is there (${check}) instead of the page: the user passes it in that tab — never you — then run the same script again`);
        left.push(pg);
        continue;
      }
      if ([401, 403, 429].includes(page.status)) {
        const why = refusedBy(netDir(ctx), plan.host, page.status);
        notes.push(why ?? `${plan.host} answered ${page.status}`);
        stop = true;
        continue;
      }
      savePage(tree.root, c.name, pg, page);
      keepForGrep(c, pg, page);
      taken.push(`${pg.method} ${pg.url} → ${page.status} · ${page.body.length} B`);
    }
    if (stop || !left.length) removePlan(tree.root, plan.id);
    else savePlan(tree.root, { ...plan, pages: left });
    if (!stop && !left.length && plan.resume) next ??= plan.resume;
  }
  const head = lines(taken.length ? `page(s) taken over from your browser: ${taken.join("; ")}` : `no page taken over from ${ctx.display(dir)}`, ...notes.map((n) => `  ⚠ ${n}`));
  if (!next) return { text: head, data: { taken, notes }, ...(taken.length ? {} : { exitCode: 1 }) };
  // go on with what the pages were planned for: the connector asks again, the pages it has come from what the browser got
  let then: Result;
  if (next.cmd === "probe") {
    const pg = plans.flatMap((p) => p.pages ?? []).find((p) => loadPage(tree.root, c.name, p.key));
    const page = pg ? loadPage(tree.root, c.name, pg.key)! : undefined;
    then = page && pg ? probeResult(ctx, c, pg.method, pg.url, page, next.save) : { text: "the probe's page is not there" };
  } else if (next.cmd === "test") then = await testWith(ctx, c, next.request as ConnectorRequest, next.max);
  else then = await fetchWith(ctx, c, next.request as ConnectorRequest, next.recordset);
  return { text: lines(head, then.text), data: { taken, notes, then: then.data }, ...(then.exitCode ? { exitCode: then.exitCode } : {}) };
}

/** strom fetch, once the request is known: checked against the policy, then through strom or the user's browser. */
async function fetchWith(ctx: Context, c: Connector, request: ConnectorRequest, recordset: string | undefined): Promise<Result> {
  const tree = ctx.tree();
  const via = routeOf(ctx.env, c).via;
  if ((request.cmd === "fetch" || request.cmd === "part") && c.manifest.policy.automation === "manual")
    throw new UsageError(`${c.manifest.title} does not allow automated download (its terms, as the connector read them)`, {
      hint: `the user saves them by hand: strom task wait T… --images B…:${request.cmd === "part" ? request.image : runs(request.images)} --on "<the book, its link, which images>" (the link: strom fetch ${c.name} ${request.book} --list)`,
    });
  const repo = forbiddenBy(ctx, c);
  if (repo)
    throw new UsageError(`${repo.id} ${repo.name} is marked automation ${repo.automation} in this tree — no downloads through a connector`, {
      hint: `strom repo show ${repo.id} — change it only if the archive allows it: strom repo edit ${repo.id} --automation allowed`,
    });
  if (recordset && request.cmd === "fetch") {
    // what is registered already is not asked for again (a part of an image is not the image)
    const have = new Set(tree.list<Media>("media").filter((m) => m.recordset === recordset && !m.part && m.image !== undefined).map((m) => m.image));
    const asked = request.images;
    request.images = asked.filter((n) => !have.has(n));
    if (!request.images.length) return { text: `images ${runs(asked)} of ${recordset} are registered already — nothing fetched`, data: { added: [], again: asked } };
  }
  if (recordset && request.cmd === "part") {
    const had = tree.list<Media>("media").find((m) => m.recordset === recordset && m.image === request.image && m.part && sameRegion(m.part, request.region));
    if (had) return { text: `part ${regionText(request.region)} of image ${request.image} of ${recordset} is registered already: ${had.id} — nothing fetched`, data: { added: [], again: [had.id] } };
  }
  if (tree.dryRun) {
    // a dry run never contacts the archive, nor asks for consent
    const what =
      request.cmd === "find"
        ? `find the books of ${request.place}${request.years ? ` ${request.years}` : ""}`
        : request.cmd === "list"
          ? `describe book ${request.book}`
          : request.cmd === "part"
            ? `fetch part ${regionText(request.region)} of image ${request.image} of book ${request.book} as a part of ${recordset}:${request.image}`
            : `fetch images ${runs(request.images)} of book ${request.book}${recordset ? ` as images of ${recordset}` : " into the inbox"}`;
    const browser = via === "browser" && (request.cmd === "fetch" || request.cmd === "part");
    return { text: `dry run: would ${what} through ${c.name}${browser ? ", in your browser" : ""} — nothing was fetched`, data: { dryRun: true, request, recordset, via } };
  }
  if (via === "browser" && (request.cmd === "fetch" || request.cmd === "part")) return planBrowser(ctx, c, request, recordset);
  if (!(await ensureAllowed(ctx, c))) return { text: "not allowed — nothing was fetched", exitCode: 1 };
  if (!(await ensureLogin(ctx, c))) return { text: "no login — nothing was fetched", exitCode: 1 };
  if (request.cmd === "fetch") ctx.io.stderr(estimate(ctx, c, request.images.length) + "\n");
  if (request.cmd === "fetch" && c.manifest.policy.automation === "unknown")
    ctx.io.stderr(`note: what the terms of ${c.manifest.title} say about automated download is not known yet — strom connector show ${c.name}\n`);
  const workDir = path.join(tree.root, ".strom", "fetch", `${c.name}-${Date.now()}`);
  const t0 = Date.now();
  const pages = pagesOf(ctx, c);
  const r = await runConnector(c, request, { env: ctx.env, workDir, netDir: netDir(ctx), onLog: (l) => ctx.io.stderr(`  · ${l}\n`), ...(pages ? { pages } : {}) });
  if (r.needs) {
    fs.rmSync(workDir, { recursive: true, force: true });
    return planPages(ctx, c, r.needs, { cmd: "fetch", request: { ...request }, ...(recordset ? { recordset } : {}) }, `strom fetch ${c.name} (${request.cmd})`, describeRun(r, request.cmd));
  }
  const took = `${Math.round((Date.now() - t0) / 1000)} s`;
  if (request.cmd === "find" || request.cmd === "list") {
    fs.rmSync(workDir, { recursive: true, force: true });
    return {
      text: lines(describeRun(r, `${request.cmd} (${took})`), r.books.length ? [`books (${r.books.length}):`, ...bookLines(r, c, `strom fetch ${c.name} <id> --list`)].join("\n") : "no books found"),
      data: r,
      ...(r.stopped && !r.books.length ? { exitCode: 1 } : {}),
    };
  }
  const from = (f: string) => `connector ${c.name} · ${path.basename(f)}`;
  const fetched = { connector: c.name, book: request.book };
  let text: string;
  let data: Record<string, unknown> = { ...r };
  if (request.cmd === "part") {
    const res = registerImages(tree, shared(ctx), r.images.map((i) => ({ file: i.file, image: i.n, url: i.url, from: from(i.file), part: i.region, fetched })), recordset);
    fs.rmSync(workDir, { recursive: true, force: true });
    const m = res.added[0];
    const whole = recordset ? findImage(tree.list<Media>("media").filter((x) => !x.part), recordset, request.image) : undefined;
    const gain = m?.width && m.part && whole?.width ? m.width / m.part.w / whole.width : undefined;
    text = m
      ? lines(
          `part ${regionText(m.part!)} of image ${request.image} of ${recordset} fetched and registered: ${m.id}${m.width ? ` · ${m.width}×${m.height} px` : ""}${gain ? ` · ${gain.toFixed(1)}× the detail of the whole image` : ""} · ${took}`,
          gain !== undefined && gain < 1.2 ? "  no sharper than the whole image: the portal gives no more detail than that" : undefined,
          `look at it: strom media view ${recordset}:${request.image} --crop ${regionText(m.part!)} (a view of the image uses the part by itself)`,
        )
      : res.again.length && whole && res.again.includes(whole.id) && r.images.every((i) => isWhole(i.region))
        ? lines(
            `the portal's sharpest of image ${request.image} is the whole scan, registered already: ${whole.id}${whole.width ? ` · ${whole.width}×${whole.height} px` : ""} — no part needed`,
            `look at it: strom media view ${recordset}:${request.image} --crop ${regionText(request.region)}`,
          )
        : res.again.length
        ? lines(`that part is registered already: ${res.again.join(" ")}`, ...res.clashes.map((x) => `⚠ ${x}`))
        : "no part fetched";
    data = { ...data, added: res.added.map((x) => ({ id: x.id, image: x.image, part: x.part })), again: res.again };
  } else if (recordset && r.images.length) {
    const res = registerImages(tree, shared(ctx), r.images.map((i) => ({ file: i.file, image: i.n, url: i.url, from: from(i.file), fetched })), recordset);
    const nums = res.added.map((m) => m.image).filter((n): n is number => n !== undefined);
    text = lines(
      `${res.added.length} image(s) of ${recordset}${nums.length ? ` (images ${Math.min(...nums)}–${Math.max(...nums)})` : ""} fetched and registered · ${took}`,
      res.again.length ? `${res.again.length} already registered` : undefined,
      ...res.clashes.slice(0, 10).map((x) => `⚠ ${x}`),
      res.woken.length ? `back in the queue (they waited for these images): ${res.woken.join(" ")}` : undefined,
    );
    data = { ...data, added: res.added.map((m) => ({ id: m.id, image: m.image })), again: res.again, woken: res.woken, clashes: res.clashes };
    fs.rmSync(workDir, { recursive: true, force: true });
  } else if (r.images.length) {
    // into the inbox, one folder for the book: the usual way from there
    const folder = `${c.name} ${String(request.book).replace(/[^\p{L}\p{M}\p{N}._-]+/gu, "_")}`;
    const inbox = path.join(shared(ctx), "inbox", folder);
    fs.mkdirSync(inbox, { recursive: true });
    for (const i of r.images) fs.renameSync(i.file, path.join(inbox, path.basename(i.file)));
    fs.rmSync(workDir, { recursive: true, force: true });
    text = lines(`${r.images.length} image(s) fetched into the inbox: ${folder}/ · ${took}`, `register them: strom media add --inbox ${shellArg(folder)} --recordset B…`);
    data = { ...data, inbox: folder };
  } else {
    fs.rmSync(workDir, { recursive: true, force: true });
    text = "no images fetched";
  }
  return { text: lines(describeRun(r, request.cmd), text), data, ...(r.stopped && !r.images.length ? { exitCode: 1 } : {}) };
}

async function planBrowser(ctx: Context, c: Connector, request: Extract<ConnectorRequest, { cmd: "fetch" | "part" }>, recordset: string | undefined): Promise<Result> {
  const tree = ctx.tree();
  if (!c.manifest.can.includes("locate")) throw new UsageError(`connector ${c.name} cannot say where its images are (can: locate) — the browser has no addresses to fetch`, { hint: `strom connector use ${c.name} --via direct` });
  if (!(await ensureAllowed(ctx, c))) return { text: "not allowed — nothing was planned", exitCode: 1 };
  const pace = connectorPace(ctx, c);
  const part = request.cmd === "part";
  const asked = part ? [request.image] : request.images;
  // one script waits at most SCRIPT_MS: as many images as fit in it, the rest next time
  const batch = asked.slice(0, Math.max(1, Math.floor(SCRIPT_MS / pace.minIntervalMs)));
  const workDir = path.join(tree.root, ".strom", "fetch", `${c.name}-${Date.now()}`);
  const pages = pagesOf(ctx, c);
  const r = await runConnector(c, { cmd: "locate", book: request.book, images: batch, ...(part ? { region: request.region } : {}) }, { env: ctx.env, workDir, netDir: netDir(ctx), onLog: (l) => ctx.io.stderr(`  · ${l}\n`), ...(pages ? { pages } : {}) });
  fs.rmSync(workDir, { recursive: true, force: true });
  if (r.needs) return planPages(ctx, c, r.needs, { cmd: "fetch", request: { ...request }, ...(recordset ? { recordset } : {}) }, `strom fetch ${c.name} (${request.cmd} of book ${request.book})`, describeRun(r, "locate"));
  if (!r.located.length) return { text: lines(describeRun(r, "locate"), "no image located — nothing planned"), data: r, exitCode: 1 };
  // one site at a time: the script fetches from the page it runs on
  const first = new URL(r.located[0]!.src);
  const here = batch.map((n) => r.located.find((l) => l.n === n && new URL(l.src).origin === first.origin)).filter((l) => l !== undefined);
  const open = c.manifest.browser?.open && new URL(c.manifest.browser.open).origin === first.origin ? c.manifest.browser.open : `${first.origin}/robots.txt`;
  let times: number[];
  try {
    times = reserveSlots(netDir(ctx), first.hostname, c.manifest.policy.pace, here.length + 1);
  } catch (err) {
    if (!(err instanceof NetError)) throw err;
    return { text: lines(describeRun(r, "locate"), `nothing planned: ${err.message}`), data: r, exitCode: 1 };
  }
  const items: PlanItem[] = here
    .slice(0, times.length - 1)
    .map((l, i) => ({ n: l.n, src: l.src, url: l.url ?? l.src, ...(l.page ? { page: l.page } : {}), ...(l.region ? { region: l.region } : {}), file: fileBase(c.name, request.book, l.n, part), at: times[i + 1]! }))
    .filter((it, i) => i === 0 || it.at - times[1]! <= SCRIPT_MS);
  const now = Date.now();
  const plan: BrowserPlan = { id: `${c.name}-${now}`, connector: c.name, book: request.book, ...(recordset ? { recordset } : {}), open, origin: first.origin, host: first.hostname, gap: times.length > 1 ? times[1]! - times[0]! : pace.minIntervalMs, created: now, until: now + PLAN_TTL_MS, items };
  // an image planned again replaces its older plan
  for (const old of loadPlans(tree.root, c.name)) {
    const left = old.items.filter((i) => !(old.book === plan.book && items.some((x) => x.file === i.file)));
    if (left.length === old.items.length) continue;
    if (left.length) savePlan(tree.root, { ...old, items: left });
    else removePlan(tree.root, old.id);
  }
  savePlan(tree.root, plan);
  const script = planScript(plan);
  const rest = asked.filter((n) => !items.some((i) => i.n === n));
  const secs = Math.max(1, Math.round((items.at(-1)!.at - now) / 1000));
  const take = `strom fetch ${c.name} --take --result "<the line it returned>"`;
  const shown = `${items[0]!.file}.jpg${items.length > 1 ? " …" : ""}`;
  return {
    text: lines(
      describeRun(r, "locate"),
      `browser plan: ${part ? `part ${regionText(request.region)} of image ${request.image}` : `${items.length} image(s) (${runs(items.map((i) => i.n))})`} of book ${request.book} through your browser — about ${secs} s at the pace of ${first.hostname}`,
      `1. Open a new tab of your own at ${open}${open.endsWith("/robots.txt") ? " — a light page of the site: the script fetches the images from there" : ""}.`,
      '   The browser not connected, a login or a captcha on the way: stop and ask the user (strom task wait T… --on "…") — that is theirs to do.',
      "   (Not connected: Chrome must be running with the Claude extension; after a change of network the extension may need a click on its icon, or Chrome a restart.)",
      "2. Run this in that tab with the JavaScript tool, exactly as it is — it waits between the images by itself:",
      "",
      script,
      "",
      `3. Then: ${take}`,
      `The browser saves them into ${ctx.display(ctx.settings.downloads())} as ${shown} — strom takes them over; do not open, move or read them yourself.`,
      `The first time, Chrome asks whether ${first.hostname} may download several files: the user allows it once (at the right end of the address bar).`,
      rest.length ? `The rest (images ${runs(rest)}): the same strom fetch again, after the take.` : undefined,
    ),
    data: { ...r, plan: { id: plan.id, open, host: plan.host, items: items.map((i) => ({ n: i.n, src: i.src, file: i.file, at: new Date(i.at).toISOString() })) }, script, take, rest },
  };
}

/** What the browser downloaded: taken over from the downloads folder, checked, registered (or put into the inbox). */
async function takeOver(ctx: Context, c: Connector, result: string | undefined): Promise<Result> {
  const tree = ctx.tree();
  const all = loadPlans(tree.root, c.name);
  const dir = ctx.settings.downloads();
  const got = parseResult(result ?? "");
  // pages for the connector first: what they were planned for goes on — unless the browser saved images
  // and none of those pages (a page planned in a run given up must not hold back what did arrive)
  const pagePlans = all.filter((p) => p.pages?.length);
  const pagesHere = got.some((g) => g.page) || pagePlans.some((p) => p.pages!.some((pg) => findDownload(dir, pg.file).file));
  const imagesHere = all.some((p) => p.items.some((i) => findDownload(dir, i.file).file));
  if (pagePlans.length && !tree.dryRun && (pagesHere || !imagesHere)) return takePages(ctx, c, pagePlans, result);
  const plans = all.filter((p) => p.items.length);
  if (!plans.length) return { text: `nothing of ${c.name} waits to be taken over — plan it first: strom fetch ${c.name} <book> --images <from-to> --recordset B…`, data: { taken: [] } };
  if (tree.dryRun) {
    const found = plans.flatMap((p) => p.items.filter((i) => findDownload(dir, i.file).file));
    return { text: `dry run: would take over ${found.length} of ${plans.reduce((n, p) => n + p.items.length, 0)} planned image(s) from ${ctx.display(dir)} — nothing was changed`, data: { dryRun: true, found: found.map((i) => i.n) } };
  }
  const notes: string[] = [];
  // what the archive said to the browser counts as if it had said it to strom
  for (const g of got) {
    const plan = plans.find((p) => p.items.some((i) => i.n === g.n)) ?? plans.at(-1)!;
    if (g.failed) notes.push(`image ${g.n}: the browser could not fetch it — no answer, or the site does not let this page fetch it`);
    else if (g.status && g.status >= 400) notes.push(refusedBy(netDir(ctx), plan.host, g.status) ?? `image ${g.n}: HTTP ${g.status}`);
  }
  const taken: { plan: BrowserPlan; item: PlanItem; file: string; others: string[] }[] = [];
  const missing: { plan: BrowserPlan; item: PlanItem; unfinished: boolean }[] = [];
  for (const plan of plans)
    for (const item of plan.items) {
      const f = findDownload(dir, item.file);
      if (!f.file) {
        missing.push({ plan, item, unfinished: !!f.unfinished });
        continue;
      }
      const problem = imageProblem(f.file, item.region ? "part" : "whole");
      if (problem) {
        // a broken download of strom's own name: gone, so that the next one gets the name
        for (const x of [f.file, ...f.others]) fs.rmSync(x, { force: true });
        notes.push(`image ${item.n} (${path.basename(f.file)}): ${problem} — removed; plan it again`);
        missing.push({ plan, item, unfinished: false });
        continue;
      }
      taken.push({ plan, item, file: f.file, others: f.others });
    }
  const added: { id: string; image?: number }[] = [];
  const again: string[] = [];
  const woken: string[] = [];
  const inboxed: string[] = [];
  for (const plan of plans) {
    const mine = taken.filter((t) => t.plan === plan);
    if (!mine.length) continue;
    const fetched = { connector: c.name, book: plan.book, via: "browser" as const };
    if (plan.recordset) {
      const res = registerImages(tree, shared(ctx), mine.map((t) => ({ file: t.file, image: t.item.n, url: t.item.url, from: `connector ${c.name} · your browser · ${path.basename(t.file)}`, part: t.item.region, fetched })), plan.recordset);
      added.push(...res.added.map((m) => ({ id: m.id, ...(m.image !== undefined ? { image: m.image } : {}) })));
      again.push(...res.again);
      notes.push(...res.clashes);
      woken.push(...res.woken);
      for (const t of mine) for (const x of [t.file, ...t.others]) fs.rmSync(x, { force: true });
    } else {
      // into the inbox, one folder for the book, as a direct fetch does
      const folder = `${c.name} ${String(plan.book).replace(/[^\p{L}\p{M}\p{N}._-]+/gu, "_")}`;
      const inbox = path.join(shared(ctx), "inbox", folder);
      fs.mkdirSync(inbox, { recursive: true });
      for (const t of mine) {
        const to = path.join(inbox, `s${String(t.item.n).padStart(4, "0")}${path.extname(t.file).toLowerCase()}`);
        fs.copyFileSync(t.file, to);
        for (const x of [t.file, ...t.others]) fs.rmSync(x, { force: true });
      }
      inboxed.push(folder);
    }
    const left = plan.items.filter((i) => !mine.some((t) => t.item === i));
    if (left.length) savePlan(tree.root, { ...plan, items: left });
    else removePlan(tree.root, plan.id);
  }
  const fetchedOk = new Set(got.filter((g) => g.status === 200).map((g) => g.n));
  const lost = missing.filter((m) => fetchedOk.has(m.item.n) && !m.unfinished);
  const notYet = missing.filter((m) => !fetchedOk.has(m.item.n) || m.unfinished);
  const nums = (xs: { item: PlanItem }[]) => runs(xs.map((x) => x.item.n));
  return {
    text: lines(
      taken.length
        ? `${taken.length} image(s) taken over from ${ctx.display(dir)}${added.length ? `: registered ${added.map((a) => a.id).join(" ")}` : ""}${inboxed.length ? ` into the inbox: ${[...new Set(inboxed)].join(", ")}/ — register them: strom media add --inbox ${shellArg(inboxed[0]!)} --recordset B…` : ""}`
        : `nothing taken over from ${ctx.display(dir)}`,
      again.length ? `  already registered: ${again.join(" ")}` : undefined,
      woken.length ? `  back in the queue (they waited for these images): ${woken.join(" ")}` : undefined,
      ...notes.map((n) => `  ⚠ ${n}`),
      lost.length
        ? `  images ${nums(lost)}: the browser fetched them but saved nothing here — Chrome lets a site download one file until the user allows automatic downloads for it (at the right end of the address bar), or it asks where to save each file (Settings → Downloads). Then plan them again: strom fetch ${c.name} ${lost[0]!.plan.book} --images ${nums(lost)}${lost[0]!.plan.recordset ? ` --recordset ${lost[0]!.plan.recordset}` : ""}`
        : undefined,
      notYet.length ? `  still waiting for images ${nums(notYet)}${notYet.some((m) => m.unfinished) ? " (a download is still running)" : ""} — run the script of their plan, or they went elsewhere: strom config set browser.downloads <folder>` : undefined,
    ),
    data: { taken: taken.map((t) => ({ n: t.item.n, file: t.file })), added, again, woken, inbox: [...new Set(inboxed)], missing: missing.map((m) => m.item.n), notes },
    ...(!taken.length && missing.length ? { exitCode: 1 } : {}),
  };
}

/** The fields of a saved login, in the order the connector asks for them. */
function fieldsOf(values: Record<string, string>, c?: Connector): string[] {
  const order = Object.keys(c?.manifest.login?.fields ?? {});
  return Object.keys(values).sort((a, b) => (order.indexOf(a) + 1 || 99) - (order.indexOf(b) + 1 || 99));
}

function loginState(ctx: Context, c: Connector): string {
  const l = loginOf(ctx.env, c);
  if (l) return `saved ${l.at.slice(0, 10)} (${fieldsOf(l.values, c).join(", ")})`;
  return c.manifest.login?.required ? `needed, none saved — the user saves it: strom login ${c.name}` : `none — the user may save one: strom login ${c.name}`;
}

/** A connector that cannot work without the user's login: the user, on a terminal, types it in right here. */
async function ensureLogin(ctx: Context, c: Connector): Promise<boolean> {
  if (!c.manifest.login?.required || loginOf(ctx.env, c)) return true;
  ctx.requireHuman(`Connector ${c.name} needs your login to ${c.manifest.title} (${c.manifest.login.about}) — save it?`, `strom login ${c.name}`, `login:${c.name}`, undefined, { window: false });
  return askLogin(ctx, c);
}

/** The user types in their login: shown what it is for and where it goes first; hidden fields are not shown as typed. */
async function askLogin(ctx: Context, c: Connector): Promise<boolean> {
  const l = c.manifest.login!;
  ctx.io.stdout(
    lines(
      "",
      `Your login to ${c.manifest.title}, for connector ${c.name}`,
      `  · what it gives: ${l.about}${l.url ? `\n  · an account: ${l.url}` : ""}`,
      `  · kept on this computer only, readable by you alone (${ctx.display(loginsFile(ctx.env))}) — never in a tree, the shared folder or git`,
      `  · strom puts it into the connector's requests itself, only to ${c.manifest.hosts.map(bareHost).join(", ")} and only over https;`,
      "    the connector's code never sees it, nor does your agent",
      "",
    ) + "\n",
  );
  const values: Record<string, string> = {};
  for (const [field, label] of Object.entries(l.fields)) {
    const v = VISIBLE_FIELDS.has(field) ? await ctx.ask(`${label}:`) : await ctx.askSecret(`${label} (not shown):`);
    if (!v) {
      ctx.io.stdout("nothing typed — nothing saved\n");
      return false;
    }
    values[field] = v; // as typed: a password is compared byte for byte
  }
  saveLogin(ctx.env, c.name, { dir: c.dir, hosts: c.manifest.hosts.map(bareHost), values, at: new Date().toISOString() });
  return true;
}

function requestOf(opts: Record<string, unknown>, test: boolean): ConnectorRequest {
  if (opts.find) return { cmd: "find", place: String(opts.find).normalize("NFC"), ...(opts.years ? { years: String(opts.years) } : {}) };
  if (test && opts.list) return { cmd: "list", book: String(opts.list) };
  if (test && opts.fetch && (opts.crop !== undefined || opts.half !== undefined)) {
    const images = parseImages(opts.images, 1) ?? [1];
    return { cmd: "part", book: String(opts.fetch), image: images[0]!, region: partRegion(opts) };
  }
  if (test && opts.fetch) return { cmd: "fetch", book: String(opts.fetch), images: parseImages(opts.images, 10) ?? [1] };
  if (test && opts.locate) {
    const part = opts.crop !== undefined || opts.half !== undefined;
    return { cmd: "locate", book: String(opts.locate), images: parseImages(opts.images, part ? 1 : 10) ?? [1], ...(part ? { region: partRegion(opts) } : {}) };
  }
  throw new UsageError(test ? "what to try: --find <place>, --list <book>, --fetch <book> --images 1-2 or --locate <book> --images 1-2" : "give a book, or --find <place>");
}

/** A search pattern, found in any case: the text as it is, or a regular expression. */
function grepPattern(p: string, regex: boolean): RegExp {
  // as typed, composed or not; a space is any white space (a page's "Kniha&nbsp;26" reads with one)
  const text = (t: string) =>
    t.trim().split(/\s+/u).map((w) => w.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")).join("\\s+");
  if (!regex) return new RegExp([...new Set([p.normalize("NFC"), p.normalize("NFD")])].map(text).join("|"), "giu");
  try {
    return new RegExp(p, "gi");
  } catch (e) {
    throw new UsageError(`not a regular expression: ${p} — ${(e as Error).message}`);
  }
}

/** The saved files of a connector's .test folder that hold text (not images, not strom's own dotfiles). */
function textFiles(dir: string): string[] {
  const out: string[] = [];
  const walk = (d: string) => {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(d, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      if (e.name.startsWith(".")) continue;
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.isFile() && fs.statSync(p).size <= 50 * 1024 * 1024) {
        const fd = fs.openSync(p, "r");
        const head = Buffer.alloc(4096);
        const n = fs.readSync(fd, head, 0, head.length, 0);
        fs.closeSync(fd);
        if (!head.subarray(0, n).includes(0)) out.push(p);
      }
    }
  };
  walk(dir);
  return out;
}
