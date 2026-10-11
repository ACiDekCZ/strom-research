// The agents' side of archives' terms: an agent's own web fetch goes by the same level as strom's requests (the tree's
// hook, core/webgate.ts) — nothing to a host that refused strom's client or an archive whose terms forbid automation
// but its terms page (at most three a day) and robots.txt, no web fetch where only a person's browser goes, a path its
// robots.txt keeps the tool off refused with the line (the tool's own group — Claude Code's WebFetch is Claude-User —
// else the one for every robot), no image of an archive that restricts automation; strom net web --check says the same
// read only; the Chrome tools drop a host that refused strom; and a site only the person can see is the person's to
// check — strom task wait --check only after another way was tried and recorded, answered in What waits (or a window
// that shows the answer), kept apart from the notes, shown in the brief and on the bridge. A person's answer is
// simulated only in each test's own settings (R8).

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { World, hasGit, fakeConnector, readJsonFile } from "../helpers.ts";
import { parseRobots, parseToolRobots, REFUSED_FOREVER, toolRobotsVerdict } from "../../src/core/net.ts";
import { imageUrl, TERMS_PER_DAY } from "../../src/core/webgate.ts";
import { wayText } from "../../src/core/web.ts";
import { agentBrowser } from "../../src/core/connector.ts";
import { codexArgs } from "../../src/runners/codex.ts";
import { assetPath } from "../../src/core/assets.ts";
import { Tree } from "../../src/core/tree.ts";

const opts = { skip: !hasGit };

/** A test's own list of terms (STROM_ARCHIVES_FILE, with settings of its own): stricter levels for any host. */
function terms(w: World, archives: Record<string, unknown>[]): void {
  const file = path.join(w.dir, "archives-test.json");
  fs.writeFileSync(file, JSON.stringify({ archives }));
  w.env.STROM_ARCHIVES_FILE = file;
}

const netDir = (w: World) => path.join(w.home, "shared", "net");
/** What strom read or decided of a host, as its limiter keeps it (the hook reads it, never fetches). */
function hostState(w: World, host: string, s: Record<string, unknown>): void {
  fs.mkdirSync(netDir(w), { recursive: true });
  fs.writeFileSync(path.join(netDir(w), `${host}.json`), JSON.stringify({ recent: [], ...s }));
}

/** Claude Code's (or Grok's) PreToolUse event of a web fetch. */
const fetchEvent = (w: World, url: string, agent: "claude" | "grok" = "claude", use?: string) =>
  JSON.stringify(
    agent === "claude"
      ? { session_id: "agent-1", cwd: w.cwd, hook_event_name: "PreToolUse", tool_name: "WebFetch", tool_input: { url, prompt: "the text" }, ...(use ? { tool_use_id: use } : {}) }
      : { sessionId: "agent-2", workspaceRoot: w.cwd, hookEventName: "pre_tool_use", toolName: "web_fetch", toolInput: { url }, ...(use ? { toolUseId: use } : {}) },
  );

async function hook(w: World, url: string, agent: "claude" | "grok" = "claude", use?: string) {
  const r = await w.run(["net", "web", "--hook"], { stdin: fetchEvent(w, url, agent, use), env: agent === "claude" ? { CLAUDECODE: "1" } : { GROK_AGENT: "1" } });
  assert.equal(r.code, 0, r.err);
  const out = r.out.trim();
  const j = out ? (JSON.parse(out) as { hookSpecificOutput: { permissionDecision?: string; permissionDecisionReason?: string } }).hookSpecificOutput : undefined;
  return { decision: j?.permissionDecision ?? "allow", reason: j?.permissionDecisionReason ?? "" };
}

test("an archive whose terms forbid automation: no web fetch — only its terms page, three times a day, HTML, and robots.txt; the way on is another way first, the person last", opts, async () => {
  const w = new World();
  await w.withTree();
  terms(w, [{ host: "closed.example.org", level: "forbidden", name: "Zavřený archiv", terms: "https://closed.example.org/terms" }]);
  const page = await hook(w, "https://closed.example.org/catalog?place=T%C3%BDnec");
  assert.equal(page.decision, "deny");
  assert.match(page.reason, /the terms of Zavřený archiv \(closed\.example\.org\) allow no automated access \(https:\/\/closed\.example\.org\/terms\) — nothing goes to it through your web tools or a browser either/);
  assert.match(page.reason, /First another way to the same records: another archive or fonds of the jurisdiction, the parish, an index, secondary sources/);
  assert.match(page.reason, /record the search: strom search add .* --result inconclusive --note "closed\.example\.org: <why it gave nothing>"/);
  assert.match(page.reason, /only if this source stays necessary for the task: strom task wait T… --check https:\/\/closed\.example\.org\/catalog\?place=T%C3%BDnec --on/);
  assert.doesNotMatch(page.reason, /Build its connector|go on through it/);
  assert.equal((await hook(w, "https://closed.example.org/robots.txt")).decision, "allow", "robots.txt itself");
  assert.equal((await hook(w, "https://closed.example.org/robots.txt?x=1")).decision, "deny", "only /robots.txt");
  // its terms page, as strom's list gives it (an address a connector names now never counts): three times a day
  for (let i = 0; i < TERMS_PER_DAY; i++) assert.equal((await hook(w, "https://closed.example.org/terms/", "claude", `t${i}`)).decision, "allow", `terms ${i + 1}`);
  const fourth = await hook(w, "https://closed.example.org/terms", "claude", "t9");
  assert.equal(fourth.decision, "deny");
  assert.match(fourth.reason, /Its terms page was read 3 times today already \(at most 3\)/);
  // a connector of the host that names another terms page: no exception for it (an agent writes connector.json)
  await fakeConnector(w, "zavreny", "https://closed.example.org", { automation: "forbidden", terms: "https://closed.example.org/catalog" });
  assert.equal((await hook(w, "https://closed.example.org/catalog", "claude", "c1")).decision, "deny");
  // each refusal written in the journal as the hook's deny, never counted
  const journal = fs.readFileSync(path.join(w.cwd, ".strom", "metrics", "fetch.jsonl"), "utf8").trim().split("\n").map((l) => JSON.parse(l));
  assert.ok(journal.some((r) => r.decision === "deny" && r.why === "forbidden"));
  assert.equal(journal.filter((r) => r.decision === "allow" && r.why === "terms").length, 3);
  w.cleanup();
});

test("a host that refused strom's client: nothing through the web tools, its robots.txt neither — kept in the person's settings too (net/ wiped); state unreadable: denied", opts, async () => {
  const w = new World();
  await w.withTree();
  hostState(w, "refusing.example.org", { refusedKind: "client", blockedUntil: REFUSED_FOREVER, reason: "it refused strom's client (HTTP 403)" });
  const r = await hook(w, "https://refusing.example.org/book/1");
  assert.equal(r.decision, "deny");
  assert.match(r.reason, /refusing\.example\.org refused strom's client — the site does not let automated tools in \(until the person lifts it: strom allow host refusing\.example\.org --unblock — the person's, never yours\); nothing goes to it through your web tools or a browser either/);
  // nothing at all after a refusal of strom's client: its robots.txt neither (the limiter leaves the host alone)
  assert.equal((await hook(w, "https://refusing.example.org/robots.txt")).decision, "deny");
  // net/ wiped (an agent may write the shared folder): the refusal kept in the person's settings still holds
  fs.rmSync(netDir(w), { recursive: true, force: true });
  fs.writeFileSync(path.join(w.env.STROM_CONFIG_DIR!, "archives.json"), JSON.stringify({ archives: { "refusing.example.org": { refused: { host: "refusing.example.org", at: new Date().toISOString(), status: 403 } } }, pending: [], takeover: { at: new Date().toISOString(), connectors: [] } }));
  assert.equal((await hook(w, "https://refusing.example.org/book/2", "claude", "x2")).decision, "deny");
  // D8: neither the person's settings nor the host's state readable — a refusal may be lost there: denied
  fs.writeFileSync(path.join(w.env.STROM_CONFIG_DIR!, "archives.json"), "{");
  fs.mkdirSync(netDir(w), { recursive: true });
  fs.writeFileSync(path.join(netDir(w), "lost.example.org.json"), "{");
  assert.equal((await hook(w, "https://lost.example.org/book/1", "claude", "x3")).decision, "deny");
  w.cleanup();
});

test("only a person's browser goes there (strom's list, or robots.txt Disallow: /): no web fetch, the person's browser with permission or by hand", opts, async () => {
  const w = new World();
  await w.withTree();
  terms(w, [{ host: "browser.example.org", level: "restricted", browserOnly: true, quoteFrom: "robots", terms: "https://browser.example.org/robots.txt", quote: "User-agent: * / Disallow: /" }]);
  const r = await hook(w, "https://browser.example.org/");
  assert.equal(r.decision, "deny");
  assert.match(r.reason, /lets automated tools in only through a person's browser — its robots\.txt keeps automated tools off the whole site \("User-agent: \* \/ Disallow: \/"\): no web fetch\. Its images through the person's browser only with their permission "through the browser" \(strom allow archive browser\.example\.org --way browser — the person's, never yours\), else the person saves what is needed by hand/);
  assert.equal((await hook(w, "https://browser.example.org/robots.txt")).decision, "allow");
  // robots.txt as strom read it: the whole site kept off
  hostState(w, "robots.example.org", { robots: { at: Date.now(), status: 200, groups: [{ agents: ["*"], allow: [], disallow: ["/"] }] } });
  const all = await hook(w, "https://robots.example.org/page", "claude", "r1");
  assert.equal(all.decision, "deny");
  assert.match(all.reason, /its robots\.txt keeps automated tools off the whole site \("Disallow: \/"\): no web fetch/);
  w.cleanup();
});

test("robots.txt for an agent's own tool (Matricula's case): the tool's own group — Claude-User — else the one for every robot; a group for ClaudeBot is not the tool's; nothing read by the hook itself", opts, async () => {
  // as data.matricula-online.eu says it: paths kept off every robot, the whole site off AI crawlers (ClaudeBot, GPTBot…)
  const text = ["User-agent: *", "Disallow: /*?pg=", "Disallow: /*/suchen", "", "User-agent: GPTBot", "User-agent: ClaudeBot", "User-agent: CCBot", "Disallow: /"].join("\n");
  assert.deepEqual(parseToolRobots(text), [], "no group names Claude-User: none kept for the tool");
  const state = { at: Date.now(), status: 200, groups: parseRobots(text) };
  assert.equal(toolRobotsVerdict(state, "/de/", ["claude-user"]).allowed, true, "the fonds and parishes browsed");
  assert.equal(toolRobotsVerdict(state, "/de/suchen", ["claude-user"]).line, "Disallow: /*/suchen", "never its search");
  // a site with a group of the tool's own: it holds for the tool (and strom's own), the one for every robot not
  const tool = ["User-agent: *", "Allow: /", "", "User-agent: Claude-User", "Disallow: /"].join("\n");
  const kept = { at: Date.now(), status: 200, groups: parseRobots(tool), tools: parseToolRobots(tool) };
  assert.deepEqual(kept.tools, [{ agents: ["claude-user"], allow: [], disallow: ["/"] }]);
  assert.equal(toolRobotsVerdict(kept, "/book", ["claude-user"]).allowed, false);
  assert.equal(toolRobotsVerdict(kept, "/book", []).allowed, true, "a tool of no known token: the group for every robot");

  const w = new World();
  await w.withTree();
  hostState(w, "parish.example.org", { robots: kept });
  hostState(w, "matricula.example.org", { robots: state });
  const claude = await hook(w, "https://parish.example.org/book", "claude", "m1");
  assert.equal(claude.decision, "deny");
  assert.match(claude.reason, /parish\.example\.org\/robots\.txt keeps automated tools off \/book \("Disallow: \/"\) — not through your web tools either/);
  assert.equal((await hook(w, "https://parish.example.org/book", "grok", "m2")).decision, "allow", "Grok's web_fetch names no token strom knows: the group for every robot");
  assert.equal((await hook(w, "https://matricula.example.org/de/bistum/pfarre/", "claude", "m3")).decision, "allow");
  const search = await hook(w, "https://matricula.example.org/de/suchen?q=Nov%C3%A1k", "claude", "m4");
  assert.equal(search.decision, "deny");
  assert.match(search.reason, /"Disallow: \/\*\/suchen"/);
  // strom's own list keeps Matricula's search off as checked, without any robots.txt read here
  assert.equal((await hook(w, "https://data.matricula-online.eu/de/suchen", "claude", "m5")).decision, "deny");
  assert.equal((await hook(w, "https://data.matricula-online.eu/de/oesterreich/wien/", "claude", "m6")).decision, "allow");
  w.cleanup();
});

test("an archive that restricts automation: its pages through the web tools, never its images; an allowed one as before; the way on never a connector to build for a closed archive", opts, async () => {
  const w = new World();
  await w.withTree();
  terms(w, [{ host: "slow.example.org", level: "restricted", name: "Omezený archiv", terms: "https://slow.example.org/help" }]);
  assert.equal((await hook(w, "https://slow.example.org/book/5359", "claude", "s1")).decision, "allow");
  const img = await hook(w, "https://slow.example.org/img/5359/40.jpg", "claude", "s2");
  assert.equal(img.decision, "deny");
  assert.match(img.reason, /Omezený archiv \(slow\.example\.org\) — its terms restrict automated downloading: no image of it through your web tools; its images through strom fetch with its connector, at a person's pace once the person allowed it/);
  assert.equal((await hook(w, "https://slow.example.org/iiif/5359/full/max/0/default.jpg", "claude", "s3")).decision, "deny", "an IIIF image");
  assert.equal((await hook(w, "https://open.example.org/img/1.jpg", "claude", "s4")).decision, "allow", "nothing known against it");
  assert.ok(imageUrl("https://x.example.org/a/40.JPG") && imageUrl("https://x.example.org/iiif/b/0,0,100,100/full/0/default.png") && !imageUrl("https://x.example.org/book/40"));
  // D4: the way on past the threshold for a closed archive — never "build its connector" nor "go on through it"
  const base = { name: "closed", url: "https://closed.example.org/", later: false, task: "strom task add …", of: "T0001" };
  for (const closed of ["refused", "forbidden", "browser"] as const) {
    const t = wayText("closed.example.org", { ...base, closed, have: "zavreny" });
    assert.doesNotMatch(t, /Build its connector|go on through it|strom connector new/, closed);
    assert.match(t, /no connector, no browser\. First another way/, closed);
  }
  const manual = wayText("closed.example.org", { ...base, closed: "manual", have: "zavreny" });
  assert.match(manual, /Its connector zavreny reads its catalogue \(strom fetch zavreny --find "<place>", --list <book>\); its images by hand only: strom task wait T0001 --images/);
  assert.doesNotMatch(manual, /go on through it|Build its connector/);
  assert.doesNotMatch(wayText("closed.example.org", { ...base, closed: "manual" }), /Build its connector|strom connector new/);
  w.cleanup();
});

test("strom net web --check: what the hook would answer now and why — level, robots line, refusal, the host left alone — read only, nothing sent", opts, async () => {
  const w = new World();
  await w.withTree();
  terms(w, [{ host: "closed.example.org", level: "forbidden", terms: "https://closed.example.org/terms" }]);
  hostState(w, "robots.example.org", { robots: { at: Date.now(), status: 200, groups: [{ agents: ["*"], allow: [], disallow: ["/private"] }] } });
  hostState(w, "paused.example.org", { blockedUntil: Date.now() + 3600_000, reason: "it refused us (HTTP 403)", refusedKind: "load" });
  const closed = (await w.ok(["net", "web", "--check", "https://closed.example.org/book/1", "--json"])).json;
  assert.equal(closed.allow, false);
  assert.equal(closed.answer, "refused");
  assert.equal(closed.why, "forbidden");
  assert.equal(closed.level, "forbidden");
  assert.match(closed.reason, /allow no automated access/);
  const text = (await w.ok(["net", "web", "--check", "https://closed.example.org/book/1"])).out;
  assert.match(text, /^https:\/\/closed\.example\.org\/book\/1: refused\n {2}archive closed\.example\.org: forbidden \(terms\)/);
  const robots = (await w.ok(["net", "web", "--check", "https://robots.example.org/private/x", "--json"])).json;
  assert.deepEqual([robots.allow, robots.why, robots.robots], [false, "robots", { line: "Disallow: /private", path: "/private/x" }]);
  const paused = (await w.ok(["net", "web", "--check", "https://paused.example.org/", "--json"])).json;
  assert.deepEqual([paused.allow, paused.answer], [false, "wait"]);
  assert.match(paused.reason, /left alone until/);
  const open = (await w.ok(["net", "web", "--check", "https://open.example.org/book", "--json"])).json;
  assert.deepEqual([open.allow, open.answer, open.level], [true, "ok", "allowed"]);
  assert.equal((await w.run(["net", "web", "--check", "not an address"])).code, 2);
  // nothing written, nothing sent: no journal of the agent's web requests
  assert.ok(!fs.existsSync(path.join(w.cwd, ".strom", "metrics", "fetch.jsonl")));
  // the agents without a hook are told it: AGENTS.md, the guide
  assert.match(fs.readFileSync(path.join(w.cwd, "AGENTS.md"), "utf8"), /10\. A site strom refused, or whose archive forbids or restricts automation\s+without the user's permission: not through your web tools or a browser\s+either — check with `strom net web --check <url>`/);
  assert.match((await w.ok(["guide"])).out, /A site strom refused, or whose archive forbids or restricts automation\s+without the person's permission: not through your web tools or a browser\s+either \(strom net web --check <url> says it\)/);
  w.cleanup();
});

test("the browser tools: a host that refused strom's client or is left alone now is not the agent's in Chrome, agent.browser always too", opts, async () => {
  const w = new World();
  await w.withTree();
  // the test's own list confirms this computer's archive (allowed: only for this computer itself)
  terms(w, [{ host: "127.0.0.1", level: "allowed" }]);
  await fakeConnector(w, "mistni", "http://127.0.0.1:9");
  await w.ok(["config", "set", "agent.browser", "always"], { tty: true, answers: ["a"] });
  const tree = () => Tree.open(w.cwd, w.env);
  const shared = path.join(w.home, "shared");
  assert.ok(agentBrowser(tree(), shared).hosts.includes("127.0.0.1"), "an allowed archive: the browser's");
  hostState(w, "127.0.0.1", { blockedUntil: Date.now() + 3600_000, refusedKind: "load" });
  assert.ok(!agentBrowser(tree(), shared).hosts.includes("127.0.0.1"), "left alone now: not through the browser either");
  hostState(w, "127.0.0.1", { refusedKind: "client", blockedUntil: REFUSED_FOREVER });
  assert.ok(!agentBrowser(tree(), shared).hosts.includes("127.0.0.1"), "refused strom's client: never");
  w.cleanup();
});

test("Codex: no command rules strom writes in a tree — what its sandbox lets through (curl, a script) is held by the rule, said in the connectors' README", () => {
  const args = codexArgs({ cwd: "/tmp/t", shared: "/tmp/s", permissions: "auto" });
  assert.ok(!args.some((a) => /rules|execpolicy/.test(a)), "no rules passed");
  const readme = fs.readFileSync(assetPath("plugins/connectors/README.md"), "utf8");
  assert.match(readme, /Codex reads command rules from a project's `\.codex\/rules\/` only when that\s+folder is trusted, and its documentation describes them for commands\s+outside its sandbox — strom writes none\./);
  assert.match(readme, /the request's own connection\s+resolves the name once more a moment later/);
});

/** A research with a task whose site refused strom, and a session at work on it. */
async function blocked(): Promise<World> {
  const w = new World();
  await w.withTree();
  await w.ok(["recordset", "add", "Týnec N 1784–1820", "--url", "https://refusing.example.org/book/5359"]); // B0001
  await w.ok(["task", "add", "Křest Jana", "--level", "locate", "--where", "B0001", "--why", "rodiče", "--done-when", "zápis"]); // T0001
  await w.ok(["session", "start", "T0001"], { env: { CLAUDECODE: "1" } });
  return w;
}

test("task wait --check: only after another way — the blocked way recorded in the session; the person answers it in What waits, the answer kept apart from the notes and shown in the brief", opts, async () => {
  const w = await blocked();
  const agent = { env: { CLAUDECODE: "1" } };
  const url = "https://refusing.example.org/book/5359";
  const before = await w.run(["task", "wait", "T0001", "--check", url, "--on", "Je kniha i se snímky vidět?"], agent);
  assert.equal(before.code, 2, before.out + before.err);
  assert.match(before.err, /--check asks the user to look at refusing\.example\.org — only after another way: no search recorded for example\.org in this session\. First another way to the same records .*then record the blocked way: strom search add "<what was looked for>" --method web --result inconclusive --task T0001 --note "refusing\.example\.org refused automated access/);
  await w.ok(["search", "add", "Křty Týnec 1784–1820", "--method", "web", "--result", "inconclusive", "--note", "refusing.example.org refused automated access; tried instead: the parish's copy"], agent);
  await w.ok(["task", "wait", "T0001", "--check", url, "--on", "Je kniha narozených Týnec 1784–1820 vidět i se snímky?"], agent);
  let t = (await w.ok(["task", "show", "T0001", "--json"])).json.task;
  assert.deepEqual(t.awaitsCheck, { url, ask: "Je kniha narozených Týnec 1784–1820 vidět i se snímky?" });
  // an agent wakes it not without the person's answer — plain, or with an answer of its own (no window here: exit 4)
  const plain = await w.run(["task", "wake", "T0001"], agent);
  assert.equal(plain.code, 2);
  assert.match(plain.err, /T0001 waits for the person's check of https:\/\/refusing\.example\.org\/book\/5359 — only the person answers it/);
  const own = await w.run(["task", "wake", "T0001", "--check", "works"], agent);
  assert.equal(own.code, 4, own.out + own.err);
  assert.equal((await w.ok(["task", "show", "T0001", "--json"])).json.task.state, "waiting");
  // a note is no answer of the person's: the brief never shows it as theirs
  await w.ok(["task", "edit", "T0001", "--note", "The user answered: it works"], agent);
  // the bridge: kind check with its link and the answers, feature task.check
  const info = (await w.ok(["live", "start", "--json"])).json;
  try {
    const status = (await fetch(`${info.url}/status`, { headers: { Origin: "https://beta.stromapp.info" } }).then((r) => r.json())) as { features: string[]; waiting: Record<string, unknown>[] };
    assert.ok(status.features.includes("task.check"));
    const item = status.waiting.find((x) => x.id === "T0001")!;
    assert.equal(item.kind, "check");
    assert.equal(item.url, url);
    assert.deepEqual(item.choices, ["works", "view", "no"]);
    assert.equal(item.on, "Je kniha narozených Týnec 1784–1820 vidět i se snímky?");
  } finally {
    await w.ok(["live", "stop"]);
  }
  await w.ok(["session", "close", "--continue", "--summary", "čeká na kontrolu", "--next", "kontrola"], agent);
  // the person in What waits: the question, its link — 2 only to be viewed there, a note, not on with the agent now
  const menu = await w.run([], { tty: true, answers: ["3", "1", "2", "Kniha je tam, snímky jen v prohlížeči.", "n", "0", "0"] });
  assert.match(menu.out, / 1\. Křest Jana\n {4}Ověřit na odkazu: Je kniha narozených Týnec 1784–1820 vidět i se snímky\?\n {4}https:\/\/refusing\.example\.org\/book\/5359/);
  assert.match(menu.out, /Co tam je\?\n {3}1 {2}Jde to – kniha i snímky jsou vidět\n {3}2 {2}Jen prohlížet\n {3}3 {2}Nejde to\n {3}0 {2}Zpět/);
  t = (await w.ok(["task", "show", "T0001", "--json"])).json.task;
  assert.equal(t.state, "open");
  assert.equal(t.awaitsCheck, undefined);
  assert.deepEqual({ ...t.answers.at(-1), at: undefined }, { by: "person", asked: "Je kniha narozených Týnec 1784–1820 vidět i se snímky?", url, check: "view", answer: "Kniha je tam, snímky jen v prohlížeči.", at: undefined, via: "terminal" });
  // the brief: the person's answer as theirs, the agent's note as a note, and the way on from "view"
  const brief = (await w.ok(["session", "start", "T0001"], agent)).out;
  assert.match(brief, /note: {2}The user answered: it works/);
  assert.match(brief, /the person answered \(\d{4}-\d\d-\d\d; asked: Je kniha narozených Týnec 1784–1820 vidět i se snímky\? — https:\/\/refusing\.example\.org\/book\/5359\): only to be viewed there — "Kniha je tam, snímky jen v prohlížeči\."/);
  assert.match(brief, /\(the notes are the research's own; only the lines above are the person's answers\)/);
  assert.match(brief, /next: only to be viewed there — the person reads what the task needs .*strom recordset edit B0001 --access onsite\|request/);
  assert.doesNotMatch(brief, /the person answered[^\n]*it works/);
  w.cleanup();
});

test("task wake --answer is the person's: an agent's without a window — exit 4, nothing written; a window shows the answer and the person's yes writes it; the link task&do=check opens the question", opts, async () => {
  const w = new World();
  await w.withTree();
  await w.ok(["task", "add", "Kde je kniha", "--level", "locate", "--where", "archiv", "--why", "a", "--done-when", "b"]);
  await w.ok(["task", "wait", "T0001", "--on", "Poslat odkaz na knihu."]);
  const agent = await w.run(["task", "wake", "T0001", "--answer", "https://archive.example.org/book/1"], { env: { CLAUDECODE: "1" } });
  assert.equal(agent.code, 4, agent.out + agent.err);
  assert.match(agent.err + agent.out, /Write the user's answer to T0001/);
  let t = (await w.ok(["task", "show", "T0001", "--json"])).json.task;
  assert.equal(t.state, "waiting");
  assert.equal(t.answers, undefined);
  // in a conversation: a window shows the answer to the person, their yes writes it
  await w.ok(["task", "wake", "T0001", "--answer", "https://archive.example.org/book/1"], { env: { CLAUDECODE: "1" }, dialog: true });
  t = (await w.ok(["task", "show", "T0001", "--json"])).json.task;
  assert.deepEqual([t.state, t.answers[0].answer, t.answers[0].via, t.notes.length], ["open", "https://archive.example.org/book/1", "window", 0]);
  // the link of the Strom app opens the check's question (fixed values only)
  await w.ok(["search", "add", "Kniha", "--method", "web", "--result", "inconclusive", "--task", "T0001", "--note", "closed.example.org refused automated access"]);
  await w.ok(["task", "wait", "T0001", "--check", "https://closed.example.org/book/1", "--on", "Je kniha vidět?"]);
  const id = Tree.open(w.cwd, w.env).config.id;
  const link = await w.run(["link", "open", `strom-research://task?tree=${id}&task=T0001&do=check`], { tty: true, answers: ["3", "", "n", ""] });
  assert.match(link.out, /Ověřit na odkazu: Je kniha vidět\?/);
  t = (await w.ok(["task", "show", "T0001", "--json"])).json.task;
  assert.deepEqual([t.state, t.answers.at(-1).check], ["open", "no"]);
  // the archive's file shows nothing of it: strom's list has robots-sourced quotes marked as robots
  const list = readJsonFile(assetPath("archives.json")) as { archives: { host: string; quoteFrom?: string }[] };
  for (const h of ["katalog.ahmp.cz", "digi.soalitomerice.cz", "vademecum.soalitomerice.cz", "digi.archives.cz", "digi2.archives.cz"]) assert.equal(list.archives.find((a) => a.host === h)?.quoteFrom, "robots", h);
  w.cleanup();
});

test("an archive strom's list knows by its robots.txt (Praga Publica, Litoměřice, Opava): the person reads robots.txt with its address, never its terms — the window, What waits, the settings, the bridge", async () => {
  const { termsText, levelWords } = await import("../../src/core/archiveasks.ts");
  const { windowText } = await import("../../src/commands/archives.ts");
  const { archiveLevel } = await import("../../src/core/terms.ts");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "strom robots "));
  const env = { STROM_CONFIG_DIR: path.join(dir, "config"), HOME: dir };
  const a = archiveLevel(env, { url: "https://katalog.ahmp.cz/pragapublica/", readOnly: true });
  assert.deepEqual([a.level, a.quoteBy, a.terms, a.quote], ["restricted", "robots", "https://katalog.ahmp.cz/robots.txt", "User-agent: * / Disallow: /"]);
  // What waits and the bridge's `on` (termsText), the settings' line (levelWords)
  assert.equal(termsText("cs", env, a), "Jeho robots.txt: „User-agent: * / Disallow: /“ (https://katalog.ahmp.cz/robots.txt) – žádný automatický přístup jinak než přes prohlížeč člověka.");
  assert.equal(termsText("de", env, a), "Seine robots.txt: „User-agent: * / Disallow: /“ (https://katalog.ahmp.cz/robots.txt) – kein automatischer Zugriff außer über den Browser eines Menschen.");
  assert.doesNotMatch(termsText("en", env, a), /Terms/);
  assert.equal(levelWords("cs", "restricted", true), "robots.txt nedovoluje automatický přístup – snímky jen přes prohlížeč, se svolením");
  // a question kept before (no quoteBy of its own): strom's list says it is robots.txt
  assert.match(termsText("cs", env, { host: "vademecum.soalitomerice.cz" }), /^Jeho robots\.txt nedovoluje automatický přístup/);
  // the window: robots.txt with its address, then the browser's question
  const ctx = { uiLang: () => "cs", env, settings: { shared: () => undefined } } as unknown as Parameters<typeof windowText>[0];
  const text = windowText(ctx, a, "browser");
  assert.match(text, /^Archiv hlavního města Prahy \(Praga Publica\) v robots\.txt nedovoluje automatický přístup \(https:\/\/katalog\.ahmp\.cz\/robots\.txt\)\.\n\nStahovat přes prohlížeč/);
  assert.doesNotMatch(text, /podmínk/i);
  fs.rmSync(dir, { recursive: true, force: true });
});

test("a test's own allowed host is asked only while it still leads to this computer: resolved again before each request (DNS rebinding)", async () => {
  const { politeRequest, NetError } = await import("../../src/core/net.ts");
  const { loopbackGuard } = await import("../../src/core/knownterms.ts");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "strom rebind "));
  loopbackGuard.hosts.add("rebind.test");
  const answers: Record<string, string[]> = { "rebind.test": ["93.184.215.14"] };
  loopbackGuard.lookup = (h) => answers[h] ?? [];
  let sent = 0;
  try {
    await assert.rejects(
      politeRequest("http://rebind.test/book", { stateDir: dir, hosts: ["rebind.test"], fetchImpl: (async () => (sent++, new Response("x"))) as typeof fetch }),
      (e: unknown) => e instanceof NetError && /no longer leads to this computer \(93\.184\.215\.14\)/.test(e.message),
    );
    assert.equal(sent, 0, "nothing sent");
    answers["rebind.test"] = ["127.0.0.1"];
    const r = await politeRequest("http://rebind.test/book", { stateDir: dir, hosts: ["rebind.test"], fetchImpl: (async () => (sent++, new Response("x"))) as typeof fetch });
    assert.equal(r.status, 200);
    assert.equal(sent, 1);
  } finally {
    loopbackGuard.hosts.delete("rebind.test");
    loopbackGuard.lookup = undefined;
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
