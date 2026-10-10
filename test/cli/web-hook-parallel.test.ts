// Many web fetches of an agent at once (core/web.ts, agentRequest in core/net.ts), with real processes: each hook
// reserves its slot of the host's pace in a moment under the host's lock and waits for it with the lock let go — so
// every call is recorded once, no more than web.perHost are let through, those spaced by the pace, and the rest refused
// in a run and asked in a conversation. Before, a hook held the lock through its pause and one that waited for it over
// 10 s went through uncounted and unpaced.
// Past the soft threshold of a site many at once are each paced one site pace apart across its mirrors, none refused for
// their number nor asked; those whose slot the hook's wait cannot reach refused as one request at a time.

import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { World, hasGit, readJsonFile } from "../helpers.ts";
import { politeGet, setOwnPace } from "../../src/core/net.ts";
import { WEB_CALL_MAX_MS, WEB_HOOK_TIMEOUT_S, WEB_PER_HOST, WEB_SOFT, WEB_SOFT_GAP_MS, WEB_WAIT_MAX_MS } from "../../src/core/web.ts";
import { recordAgentWeb } from "../../src/core/metrics.ts";

const CLI = path.join(import.meta.dirname, "..", "..", "src", "cli.ts");
/** The threshold of the test of the hard one at once: the soft one, the hard one set to it (web.perHost). */
const HARD = WEB_SOFT;

/** One hook as the agent runs it: its own process, the event on stdin; when it ended. */
function hook(w: World, event: object, env: Record<string, string>): Promise<{ code: number; out: string; err: string; ended: number }> {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [CLI, "net", "web", "--hook"], { cwd: w.cwd, env: { ...w.env, CLAUDECODE: "1", ...env }, stdio: ["pipe", "pipe", "pipe"] });
    let out = "";
    let err = "";
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (err += d));
    child.on("close", (code) => resolve({ code: code ?? 1, out, err, ended: Date.now() }));
    child.stdin.end(JSON.stringify(event));
  });
}

const fetchEvent = (w: World, url: string, use: string, phase = "PreToolUse") => ({
  session_id: "agent-1", cwd: w.cwd, hook_event_name: phase, tool_name: "WebFetch", tool_input: { url, prompt: "the text" }, tool_use_id: use,
  ...(phase === "PostToolUse" ? { tool_response: { code: 200, result: "the text" } } : {}),
});

const journal = (w: World) =>
  fs.readFileSync(path.join(w.cwd, ".strom", "metrics", "fetch.jsonl"), "utf8").trim().split("\n").filter(Boolean).flatMap((l) => {
    try {
      return [JSON.parse(l) as Record<string, any>];
    } catch {
      return []; // (a line a test broke on purpose)
    }
  });

test("sixteen web fetches at once: each recorded once, at most the threshold let through and spaced by the pace, the rest refused in a run, and in a conversation the person asked once", { skip: !hasGit || process.platform === "win32", timeout: 180_000 }, async () => {
  const w = new World();
  await w.withTree();
  // the hard threshold at the soft one (the person's lower number): no zone between
  await w.ok(["config", "set", "web.perHost", String(HARD)]);
  await w.ok(["research", "new", "Předci Jana Nováka", "--new-person", "Jan /Novák/", "--sex", "M", "--born", "ABT 1905"]);
  const s = (await w.ok(["session", "start", "--json"], { env: { CLAUDECODE: "1", STROM_WORKER: "claude-1" } })).json;
  const sid: string = s.session?.id ?? s.id;
  const net = path.join(w.home, "shared", "net");
  // a pause of a second between two requests (the person's own pace for these hosts): long enough that the hooks of
  // before, each holding the lock through its pause, ran past their 10 s wait for it
  const PACE = 1000;
  for (const host of ["run-example.org", "talk-example.org"]) setOwnPace(net, host, { minIntervalMs: PACE });
  const inSession = { STROM_SESSION: sid, STROM_MODEL: "opus" };
  const N = 16;
  const started = Date.now();
  const [run, talk] = await Promise.all([
    // working alone (nobody watches) and in a conversation at the same time, each on a host of its own
    Promise.all(Array.from({ length: N }, (_, i) => hook(w, fetchEvent(w, `https://run-example.org/p/${i}`, `r${i}`), { ...inSession, STROM_NONINTERACTIVE: "1", STROM_WORKER: "run-1-x" }))),
    Promise.all(Array.from({ length: N }, (_, i) => hook(w, fetchEvent(w, `https://talk-example.org/p/${i}`, `t${i}`), inSession))),
  ]);
  const lines = journal(w);
  for (const [batch, host, prefix, refusal] of [[run, "run-example.org", "r", "deny"], [talk, "talk-example.org", "t", "ask"]] as const) {
    for (const r of batch) assert.equal(r.code, 0, `the hook never fails: ${r.err}`);
    const answers = batch.map((r) => (r.out.trim() ? (JSON.parse(r.out) as { hookSpecificOutput: { permissionDecision: string; permissionDecisionReason: string } }).hookSpecificOutput : undefined));
    const allowed = batch.filter((_, i) => !answers[i]);
    assert.equal(allowed.length, HARD, `${host}: the threshold let through, no more`);
    const rest = answers.filter(Boolean).map((a) => a!.permissionDecision).sort();
    // working alone all refused; in a conversation the person asked once, the others refused while it waits
    assert.deepEqual(rest, refusal === "deny" ? Array(N - HARD).fill("deny") : ["ask", ...Array(N - HARD - 1).fill("deny")], `${host}: the rest`);
    // every call recorded exactly once, by its own tool call
    const mine = lines.filter((l) => l.host === host);
    assert.deepEqual(mine.map((l) => l.toolUse).sort(), Array.from({ length: N }, (_, i) => `${prefix}${i}`).sort(), `${host}: each of the ${N} recorded once`);
    assert.equal(mine.filter((l) => l.decision === "allow").length, HARD);
    assert.deepEqual(mine.filter((l) => l.decision === "allow").map((l) => l.n).sort((a, b) => a - b), Array.from({ length: HARD }, (_, i) => i + 1), `${host}: counted one by one`);
    assert.deepEqual(mine.filter((l) => l.decision !== "allow").map((l) => l.why).sort(), refusal === "deny" ? Array(N - HARD).fill("many") : ["many", ...Array(N - HARD - 1).fill("pending")], `${host}: past the threshold`);
    // the host's hour holds the allowed ones, their slots one pace apart
    const recent = (readJsonFile(path.join(net, `${host}.json`)) as { recent: number[] }).recent.sort((a, b) => a - b);
    assert.equal(recent.length, HARD, `${host}: in the host's hour, each once`);
    for (let i = 1; i < recent.length; i++) assert.ok(recent[i]! - recent[i - 1]! >= PACE, `${host}: slot ${i} one pace after the one before (${recent[i]! - recent[i - 1]!} ms)`);
    // and the calls went out so: the last let through no sooner than the pace allows
    const ends = allowed.map((r) => r.ended).sort((a, b) => a - b);
    assert.ok(ends.at(-1)! - started >= (HARD - 1) * PACE - 200, `${host}: the twelfth went out after eleven pauses (${ends.at(-1)! - started} ms)`);
  }
  // the one the person said yes to went out: counted once after it ran; from then on the server goes without a question,
  // several at once each counted once and paced
  const asked = lines.filter((l) => l.host === "talk-example.org" && l.decision === "ask").map((l) => l.toolUse as string);
  assert.equal(asked.length, 1, "one question for the server");
  const post = await Promise.all([...asked, ...asked].map((use) => hook(w, fetchEvent(w, `https://talk-example.org/p/${use.slice(1)}`, use, "PostToolUse"), inSession)));
  for (const r of post) assert.deepEqual([r.code, JSON.parse(r.out).hookSpecificOutput.hookEventName], [0, "PostToolUse"], "after it: a note only");
  assert.deepEqual(journal(w).filter((l) => l.host === "talk-example.org" && l.why === "asked").map((l) => l.toolUse), asked, "counted once, told twice");
  const more = await Promise.all(Array.from({ length: 3 }, (_, i) => hook(w, fetchEvent(w, `https://talk-example.org/q/${i}`, `q${i}`), inSession)));
  for (const r of more) assert.deepEqual([r.code, r.out.trim()], [0, ""], "no question again");
  const answered = journal(w).filter((l) => l.host === "talk-example.org" && l.why === "answered");
  assert.deepEqual(answered.map((l) => l.n).sort(), [HARD + 2, HARD + 3, HARD + 4]);
  assert.deepEqual((await w.ok(["net", "web", "--json"], { env: inSession })).json.hosts, { "run-example.org": HARD, "talk-example.org": HARD + 4 });
  const recent = (readJsonFile(path.join(net, "talk-example.org.json")) as { recent: number[] }).recent.sort((a, b) => a - b);
  assert.equal(recent.length, HARD + 4, "and in the host's hour");
  for (let i = HARD + 2; i < recent.length; i++) assert.ok(recent[i]! - recent[i - 1]! >= PACE, "paced");
  w.cleanup();
});

test("past the soft threshold, eighteen at once to two mirrors of one site: none refused for their number nor asked, the site's slower pace across its hosts — as many as fit the hook's wait, the rest refused as one request at a time", { skip: !hasGit || process.platform === "win32", timeout: 180_000 }, async () => {
  const w = new World();
  await w.withTree();
  await w.ok(["research", "new", "Předci Jana Nováka", "--new-person", "Jan /Novák/", "--sex", "M", "--born", "ABT 1905"]);
  const s = (await w.ok(["session", "start", "--json"], { env: { CLAUDECODE: "1", STROM_WORKER: "claude-1" } })).json;
  const sid: string = s.session?.id ?? s.id;
  const net = path.join(w.home, "shared", "net");
  // the soft threshold's pages of the site in the session already (another mirror of it)
  for (let i = 1; i <= WEB_SOFT; i++) recordAgentWeb(w.cwd, { via: "web", url: `https://www.zrcadla-example.org/${i}`, session: sid, agent: "claude", key: "claude opus", tool: "WebFetch", toolUse: `x${i}`, from: "hook", decision: "allow" });
  const hosts = ["ia801.us.zrcadla-example.org", "dn7.ca.zrcadla-example.org"];
  const N = 18;
  // in a conversation: nothing asked below the hard threshold
  const batch = await Promise.all(Array.from({ length: N }, (_, i) => hook(w, fetchEvent(w, `https://${hosts[i % 2]}/p/${i}`, `z${i}`), { STROM_SESSION: sid, STROM_MODEL: "opus" })));
  for (const r of batch) assert.equal(r.code, 0, `the hook never fails: ${r.err}`);
  const answers = batch.map((r) => (r.out.trim() ? (JSON.parse(r.out) as { hookSpecificOutput: { permissionDecision: string; permissionDecisionReason: string } }).hookSpecificOutput : undefined));
  const allowed = answers.filter((a) => !a).length;
  // one per WEB_SOFT_GAP_MS within the hook's wait: the slots at 0, 6 … 30 s (the last one's start a moment later: 5 or 6)
  const fit = Math.floor(WEB_WAIT_MAX_MS / WEB_SOFT_GAP_MS);
  assert.ok(allowed >= fit && allowed <= fit + 1, `as many as fit the wait: ${allowed}`);
  assert.deepEqual([...new Set(answers.filter(Boolean).map((a) => a!.permissionDecision))], ["deny"], "never asked");
  for (const a of answers.filter(Boolean)) assert.match(a!.permissionDecisionReason, /^strom: one request at a time to (ia801\.us|dn7\.ca)\.zrcadla-example\.org, past 12 pages of zrcadla-example\.org \(.* counted together\) in this session, one request per 6 s to it — .*this one again in a moment/);
  const mine = journal(w).filter((l) => /^z\d+$/.test(String(l.toolUse)));
  assert.deepEqual(mine.map((l) => l.toolUse).sort(), Array.from({ length: N }, (_, i) => `z${i}`).sort(), "each recorded once");
  assert.deepEqual([...new Set(mine.filter((l) => l.decision === "deny").map((l) => l.why))].filter((x) => x !== "pace" && x !== "busy"), [], "refused for the pace alone, never for the number");
  const took = mine.filter((l) => l.decision === "allow");
  assert.ok(took.every((l) => l.why === "soft" && l.domain === "zrcadla-example.org" && hosts.includes(l.host)), "the exact host and the site it is counted under");
  assert.deepEqual(took.map((l) => l.n).sort((a, b) => a - b), Array.from({ length: allowed }, (_, i) => WEB_SOFT + 1 + i), "counted one by one, by site");
  assert.equal(took.filter((l) => l.advice).length, 1, "the advice once");
  // the slots of both mirrors together: one site pace apart
  const slots = hosts.flatMap((h) => (fs.existsSync(path.join(net, `${h}.json`)) ? (readJsonFile(path.join(net, `${h}.json`)) as { recent: number[] }).recent : [])).sort((a, b) => a - b);
  assert.equal(slots.length, allowed);
  for (let i = 1; i < slots.length; i++) assert.ok(slots[i]! - slots[i - 1]! >= WEB_SOFT_GAP_MS, `the site's pace across its mirrors (${slots[i]! - slots[i - 1]!} ms)`);
  assert.ok(fs.existsSync(path.join(net, "site~zrcadla-example.org.json")), "the site's own state beside the hosts'");
  w.cleanup();
});

const quiet = (r: { code: number; out: string; err: string }, what: string) => assert.deepEqual([r.code, r.out.trim()], [0, ""], `${what}: let go without a word (${r.err})`);

test("a real failure never refuses: a lock left by a process killed (kill -9) mid-reservation is taken over at once, a broken journal line lets the call go, a broken host state is written again whole from what the journal tells — never a host uncounted for good", { skip: !hasGit || process.platform === "win32", timeout: 120_000 }, async () => {
  const w = new World();
  await w.withTree();
  const net = path.join(w.home, "shared", "net");
  fs.mkdirSync(net, { recursive: true });
  const env = { STROM_NONINTERACTIVE: "1" };
  // a process holds the host's reservation lock (as a hook does for a moment), and is killed with it
  const holder = spawn(process.execPath, ["--input-type=module", "-e", `
    const { acquireLock } = await import(${JSON.stringify(path.join(import.meta.dirname, "..", "..", "src", "core", "lock.ts"))});
    acquireLock(${JSON.stringify(path.join(net, "mrtvy-example.org.json.lock"))}, { owner: "strom net", waitMs: 0 });
    process.stdout.write("held");
    setInterval(() => {}, 1000);
  `], { stdio: ["ignore", "pipe", "inherit"] });
  const held = await new Promise<boolean>((resolve) => {
    holder.stdout.on("data", (d) => String(d).includes("held") && resolve(true));
    holder.on("close", () => resolve(false));
  });
  assert.ok(held, "the holder took the lock");
  holder.kill("SIGKILL");
  await new Promise((r) => holder.on("close", r));
  assert.ok(fs.existsSync(path.join(net, "mrtvy-example.org.json.lock")), "its lock left behind");
  const t0 = Date.now();
  const r = await hook(w, fetchEvent(w, "https://mrtvy-example.org/1", "k1"), env);
  quiet(r, "after a holder killed");
  assert.ok(Date.now() - t0 < 5000, `answered promptly (${Date.now() - t0} ms)`);
  assert.deepEqual(journal(w).map((l) => [l.toolUse, l.decision, l.n]), [["k1", "allow", 1]], "and counted");
  // a lock older than any holder holds one (its pid given again to a live process): taken over too
  fs.writeFileSync(path.join(net, "stary-example.org.json.lock"), JSON.stringify({ pid: process.pid, host: os.hostname(), at: new Date(Date.now() - 3600_000).toISOString(), owner: "strom net" }));
  quiet(await hook(w, fetchEvent(w, "https://stary-example.org/1", "k2"), env), "a lock an hour old");
  // a line of the journal cut short (a crash while writing), and one that is no JSON: read past
  fs.appendFileSync(path.join(w.cwd, ".strom", "metrics", "fetch.jsonl"), '{"via":"web","host":"mrtvy-example.org","decis\nnot json at all\n');
  quiet(await hook(w, fetchEvent(w, "https://mrtvy-example.org/2", "k3"), env), "after a broken line");
  assert.equal(journal(w).filter((l) => l.toolUse === "k3")[0]?.n, 2, "the count goes on");
  // the host's state broken (two requests to it counted before): the call goes, counted, and the state is written
  // again whole — the journal's two with this one in its hour, and the next call counted in it too
  const state = path.join(net, "rozbity-example.org.json");
  const hourOf = () => (JSON.parse(fs.readFileSync(state, "utf8")) as { recent: number[] }).recent.length;
  quiet(await hook(w, fetchEvent(w, "https://rozbity-example.org/1", "k4a"), env), "the first");
  quiet(await hook(w, fetchEvent(w, "https://rozbity-example.org/2", "k4b"), env), "the second");
  assert.equal(hourOf(), 2);
  fs.writeFileSync(state, "{ not json");
  quiet(await hook(w, fetchEvent(w, "https://rozbity-example.org/3", "k4"), env), "a broken host state");
  assert.equal(hourOf(), 3, "written again: the journal's two and this one");
  assert.equal(journal(w).filter((l) => l.toolUse === "k4")[0]?.n, 3, "and counted in the session");
  quiet(await hook(w, fetchEvent(w, "https://rozbity-example.org/4", "k4c"), env), "the next");
  assert.equal(hourOf(), 4, "the next counted in it as before");
  assert.ok(!fs.readdirSync(net).some((f) => f.endsWith(".tmp")), "nothing left aside");
  // the site's state broken too: written again, the call counted
  fs.writeFileSync(path.join(net, "site~rozbity-example.org.json"), "[1,");
  quiet(await hook(w, fetchEvent(w, "https://rozbity-example.org/5", "k4d"), env), "a broken site state");
  assert.equal(typeof (JSON.parse(fs.readFileSync(path.join(net, "site~rozbity-example.org.json"), "utf8")) as { last?: number }).last, "number");
  // the journal gone (tidied, or never there): the count starts again, nothing refused
  fs.rmSync(path.join(w.cwd, ".strom", "metrics", "fetch.jsonl"));
  quiet(await hook(w, fetchEvent(w, "https://mrtvy-example.org/3", "k5"), env), "no journal");
  w.cleanup();
});

/** Lines of the journal without the newest fields. */
const journalLines = (w: World) => fs.readFileSync(path.join(w.cwd, ".strom", "metrics", "fetch.jsonl"), "utf8");

test("nothing else slowed: the hook's wait holds no host's lock (strom's own requests keep their pace after its slot), hosts apart, a search only counted, an older strom's journal read on; one call stays well inside the hook's time limit, and takes this long", { skip: !hasGit || process.platform === "win32", timeout: 180_000 }, async (t) => {
  const w = new World();
  await w.withTree();
  const net = path.join(w.home, "shared", "net");
  // the longest one call takes (its whole wait and its overhead), inside the time limit both agents' files give it
  assert.ok(WEB_CALL_MAX_MS <= WEB_HOOK_TIMEOUT_S * 1000 - 20_000, `${WEB_CALL_MAX_MS} ms in ${WEB_HOOK_TIMEOUT_S} s`);
  for (const file of [path.join(w.cwd, ".claude", "settings.json"), path.join(w.cwd, ".grok", "hooks", "strom.json")]) {
    // the web hook's entries (the delegate hook beside them has a short limit of its own)
    const j = JSON.parse(fs.readFileSync(file, "utf8")) as { hooks: Record<string, unknown> };
    const all = (j.hooks.hooks ?? j.hooks) as Record<string, { matcher: string; hooks: { timeout?: number }[] }[]>;
    const timeouts = Object.values(all).flat().filter((g) => /web/i.test(g.matcher)).flatMap((g) => g.hooks.map((h) => h.timeout));
    assert.ok(timeouts.length >= 3 && timeouts.every((x) => x === WEB_HOOK_TIMEOUT_S), `${file}: an explicit time limit on each hook`);
  }

  // a slot 3 s ahead: the hook waits for it with the host's lock let go
  setOwnPace(net, "sdileny-example.org", { minIntervalMs: 3000 });
  quiet(await hook(w, fetchEvent(w, "https://sdileny-example.org/1", "s1"), {}), "first");
  const second = hook(w, fetchEvent(w, "https://sdileny-example.org/2", "s2"), {});
  await new Promise((r) => setTimeout(r, 1200));
  assert.ok(!fs.existsSync(path.join(net, "sdileny-example.org.json.lock")), "no lock held while it waits");
  // strom's own request (a connector's) to the same host meanwhile: after the reserved slot, one pace later
  const waits: number[] = [];
  const got = await politeGet("https://sdileny-example.org/scan", {
    stateDir: net, hosts: ["sdileny-example.org"], sleep: async (ms) => void waits.push(ms),
    fetchImpl: (async () => new Response("ok", { status: 200 })) as typeof fetch,
  });
  assert.equal(got.status, 200);
  assert.ok(waits.length === 1 && waits[0]! > 3000 && waits[0]! <= 6000, `its pace kept after the agent's slot (${waits.join(", ")} ms)`);
  quiet(await second, "second");

  // another host's lock held (a connector at work on it): this host answers at once — no lock across hosts
  fs.writeFileSync(path.join(net, "jiny-example.org.json.lock"), JSON.stringify({ pid: process.pid, host: os.hostname(), at: new Date().toISOString(), owner: "strom net" }));
  const t0 = Date.now();
  quiet(await hook(w, fetchEvent(w, "https://volny-example.org/1", "f1"), {}), "another host");
  assert.ok(Date.now() - t0 < 5000);
  fs.rmSync(path.join(net, "jiny-example.org.json.lock"));

  // a search: counted only, no host, no lock, no wait
  quiet(await hook(w, { session_id: "agent-1", cwd: w.cwd, hook_event_name: "PreToolUse", tool_name: "WebSearch", tool_input: { query: "Novák" }, tool_use_id: "q1" }, {}), "search");
  assert.deepEqual(journal(w).filter((l) => l.via === "search").map((l) => [l.decision, l.host]), [["allow", undefined]]);

  // an older strom's lines (no answer of the person, no pace; beta.7): counted as before
  const old = Array.from({ length: WEB_PER_HOST - 1 }, (_, i) => JSON.stringify({ at: new Date().toISOString(), by: "agent", via: "web", host: "stare-example.org", key: "claude opus", agent: "claude", tool: "WebFetch", from: "hook", toolUse: `o${i}`, agentSession: "agent-2", decision: "allow", n: i + 1 }));
  fs.appendFileSync(path.join(w.cwd, ".strom", "metrics", "fetch.jsonl"), old.join("\n") + "\n");
  const ev = (n: number) => ({ ...fetchEvent(w, `https://stare-example.org/${n}`, `o${n}`), session_id: "agent-2" });
  quiet(await hook(w, ev(100), {}), "the twelfth");
  const ask = await hook(w, ev(101), {});
  assert.equal(JSON.parse(ask.out).hookSpecificOutput.permissionDecision, "ask", "the thirteenth asked");
  assert.ok(journalLines(w).includes('"toolUse":"o100"'));

  // how long one call takes, nothing to wait for: each on a host of its own
  const ms: number[] = [];
  for (let i = 0; i < 50; i++) {
    const s0 = Date.now();
    quiet(await hook(w, fetchEvent(w, `https://h${i}-example.net/`, `t${i}`), {}), `timing ${i}`);
    ms.push(Date.now() - s0);
  }
  ms.sort((a, b) => a - b);
  t.diagnostic(`one hook call: median ${ms[ms.length >> 1]} ms, max ${ms.at(-1)} ms (the wait at most ${WEB_WAIT_MAX_MS} ms, the call at most ${WEB_CALL_MAX_MS} ms)`);
  assert.ok(ms[ms.length >> 1]! < 3000, "a light start");
  w.cleanup();
});
