// web.perHost counted for the computer too (spec 126 U8): the pages of a site the agents' web tools had in every session
// here — of another research with the same shared folder too — within the time of one session (run.minutes) count
// against it, so runs side by side never let more of a site go than one session would; older pages count no more.
// Never more than before for one session: the session's own count holds as it did.

import { after, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { World, hasGit } from "../helpers.ts";
import { testHooks } from "../../src/core/net.ts";

const opts = { skip: !hasGit };
// a pause is not waited out: the clock the limiter reads moves on by it
let ahead = 0;
testHooks.now = () => Date.now() + ahead;
testHooks.sleep = async (ms) => void (ahead += ms);
after(() => {
  testHooks.sleep = undefined;
  testHooks.now = undefined;
});

const fetchEvent = (cwd: string, url: string, use: string, sid: string) =>
  JSON.stringify({ session_id: sid, cwd, hook_event_name: "PreToolUse", tool_name: "WebFetch", tool_input: { url, prompt: "the text" }, tool_use_id: use });

test("two sessions of two researches: the second's pages of a site counted with the first's within run.minutes; older ones no more", opts, async () => {
  const w = new World();
  await w.ok(["setup", "--yes"]);
  w.historyAsked();
  await w.ok(["config", "set", "web.perHost", "12"]);
  const sessions: { cwd: string; env: Record<string, string> }[] = [];
  for (const [name, who] of [["Lhotákovi", "Jan /Lhoták/"], ["Lhotovi", "Мария /Лхотова/"]] as const) {
    await w.ok(["init", name]);
    w.cwd = w.treeDir(name);
    await w.ok(["research", "new", `Předci ${name}`, "--new-person", who, "--sex", "M", "--born", "ABT 1905"]);
    const s = (await w.ok(["session", "start", "--json"], { env: { CLAUDECODE: "1", STROM_WORKER: `claude-${name}` } })).json;
    // working alone: past the threshold refused, nothing asked
    sessions.push({ cwd: w.cwd, env: { CLAUDECODE: "1", STROM_SESSION: s.session?.id ?? s.id, STROM_MODEL: "opus", STROM_NONINTERACTIVE: "1", STROM_WORKER: `run-1-${name}` } });
  }
  const hook = async (k: number, i: number) => {
    const s = sessions[k]!;
    const r = await w.run(["net", "web", "--hook"], { stdin: fetchEvent(s.cwd, `https://matriky-lhota.org/kniha/${i}`, `u${k}-${i}`, `agent-${k}`), cwd: s.cwd, env: s.env });
    assert.equal(r.code, 0, r.err);
    return r.out.trim() ? (JSON.parse(r.out) as { hookSpecificOutput: { permissionDecision: string; permissionDecisionReason: string } }).hookSpecificOutput : undefined;
  };
  // the first research's session: ten pages of the site
  for (let i = 1; i <= 10; i++) assert.equal((await hook(0, i))?.permissionDecision ?? "allow", "allow", `page ${i}`);
  // the second's: two more go, the third is past web.perHost for the computer — refused, said where it was counted
  assert.equal((await hook(1, 1))?.permissionDecision ?? "allow", "allow");
  assert.equal((await hook(1, 2))?.permissionDecision ?? "allow", "allow");
  const third = await hook(1, 3);
  assert.equal(third?.permissionDecision, "deny");
  assert.match(third!.permissionDecisionReason, /12 requests to matriky-lhota\.org through the web fetch tool on this computer in the last 60 min \(every session here\) — the limit for one site \(web\.perHost\)/u);
  // the first session too: the site has had its pages on this computer
  assert.equal((await hook(0, 11))?.permissionDecision, "deny");
  // the session's own record keeps its own count
  const journal = fs.readFileSync(path.join(sessions[1]!.cwd, ".strom", "metrics", "fetch.jsonl"), "utf8").trim().split("\n").map((l) => JSON.parse(l));
  assert.deepEqual(journal.map((r) => [r.decision, r.n]), [["allow", 1], ["allow", 2], ["deny", 2]]);
  // pages older than run.minutes count no more: the second session goes on (its own two, as before)
  const file = path.join(w.home, "shared", "net", "site~matriky-lhota.org.web.json");
  assert.ok(fs.existsSync(file), fs.readdirSync(path.dirname(file)).join(" "));
  const kept = JSON.parse(fs.readFileSync(file, "utf8")) as { requests: { at: number; who: string }[] };
  fs.writeFileSync(file, JSON.stringify({ requests: kept.requests.map((r) => ({ ...r, at: r.at - 61 * 60_000 })) }));
  assert.equal((await hook(1, 4))?.permissionDecision ?? "allow", "allow");
  w.cleanup();
});
