// Past web.perHost the refusal says when the site takes pages again — the computer's window (the oldest page of it
// leaving the window), or none more in this session — and what to do until then: the task left open, other work, else
// the session ended; never a page of it tried again before then, never a wait (a loop, a helper). The same refusal a
// third time in a session says to end it now (a live run tried the same page 116 times). Where the way on reaches the site
// through strom (its connector, built now), the way comes first and no word of ending the session — only none of its
// pages through the web tools before then. Fixed clock, off midnight UTC.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { World, hasGit } from "../helpers.ts";
import { answerWebEvent, webEvent } from "../../src/core/web.ts";
import { clockUp } from "../../src/core/net.ts";

const opts = { skip: !hasGit };
const T0 = Date.parse("2026-11-23T10:30:00Z");
const SITE = "matriky-lhota.org";

const fetchEvent = (cwd: string, url: string, use: string) =>
  JSON.stringify({ session_id: "agent-1", cwd, hook_event_name: "PreToolUse", tool_name: "WebFetch", tool_input: { url, prompt: "the text" }, tool_use_id: use });

async function world(perHost: number, o: { ending?: boolean } = {}) {
  const w = new World();
  await w.withTree("Lhotákovi");
  await w.ok(["config", "set", "web.perHost", String(perHost)]);
  await w.ok(["research", "new", "Předci Lhotákovi", "--new-person", "Jan /Lhoták/", "--sex", "M", "--born", "ABT 1905"]);
  const s = (await w.ok(["session", "start", "--json"], { env: { CLAUDECODE: "1", STROM_WORKER: "claude-1" } })).json;
  const env = { ...w.env, CLAUDECODE: "1", STROM_SESSION: s.session?.id ?? s.id, STROM_MODEL: "opus", STROM_NONINTERACTIVE: "1", STROM_WORKER: "run-1-a",
    // the session ending (too little time left to build a connector): its task the way on, the session to be ended
    ...(o.ending ? { STROM_DEADLINE: new Date(T0 + 5 * 60_000).toISOString() } : {}) };
  let t = T0;
  let k = 0;
  const hook = async (page: number) => {
    const ev = webEvent(fetchEvent(w.cwd, `https://${SITE}/kniha/${page}`, `u-${++k}`))!;
    const a = await answerWebEvent(ev, { env, cwd: w.cwd, now: () => t, sleep: async (ms) => void (t += ms) });
    t += 20_000; // a person's pause between pages
    return a;
  };
  const siteFile = path.join(w.home, "shared", "net", `site~${SITE}.web.json`);
  return { w, hook, siteFile, now: () => t };
}

test("the computer's window full (other sessions' pages): the refusal says when its next page goes, and to wait for nothing", opts, async () => {
  for (const ending of [true, false]) {
    const { w, hook, siteFile, now } = await world(12, { ending });
    // twelve pages of the site from another session, the oldest 50 minutes ago
    fs.mkdirSync(path.dirname(siteFile), { recursive: true });
    const ats = Array.from({ length: 12 }, (_, i) => T0 - 50 * 60_000 + i * 3 * 60_000);
    fs.writeFileSync(siteFile, JSON.stringify({ requests: ats.map((at) => ({ at, who: "N0999" })) }));
    const a = await hook(1);
    assert.equal(a.decision, "deny");
    const at = clockUp(ats[0]! + 60 * 60_000, now());
    assert.match(a.reason!, /on this computer in the last 60 min/u);
    assert.ok(a.reason!.includes(`Its next page goes at ${at} — not sooner`), a.reason);
    assert.match(a.reason!, /never leave the waiting to a helper/u);
    assert.match(a.reason!, /strom tidy and the like/u);
    // the first refusal is news: no word of a loop yet
    assert.doesNotMatch(a.reason!, /refusal \d+ of the same/u);
    if (ending) {
      // too little time for a connector: the task left open, the session ended, the pages from the time
      assert.ok(a.reason!.includes("Leave the task open"), a.reason);
      assert.ok(a.reason!.includes(`strom session close --continue`), a.reason);
      assert.ok(a.reason!.includes(`the pages of ${SITE} from ${at}`), a.reason);
      assert.ok(a.reason!.includes(`Never try a page of ${SITE} again before ${at}`), a.reason);
      assert.ok(a.reason!.indexOf("Its next page goes") < a.reason!.indexOf("add its task now"), "the time first");
    } else {
      // its connector built now is the way on: first, and no word of ending the session
      assert.match(a.reason!, /web\.perHost\)\. Build its connector now/u);
      assert.ok(a.reason!.includes(`No page of ${SITE} through the web tools before ${at} — the way above instead`), a.reason);
      assert.doesNotMatch(a.reason!, /end the session|Leave the task open/u);
      // the third the same: nothing more through the web tools — the way above, else the session ended
      await hook(1);
      const third = await hook(1);
      assert.match(third.reason!, /This is refusal 3 of the same in this session: nothing more through the web tools — the way above, else end the session now \(strom session close --continue/u);
    }
    w.cleanup();
  }
});

test("the session's own web.perHost used: none more in this session, a next session from the computer's window; the third refusal says end it now", opts, async () => {
  const { w, hook, siteFile, now } = await world(3, { ending: true });
  for (let i = 1; i <= 3; i++) assert.notEqual((await hook(i)).decision, "deny", `page ${i}`);
  const first = (JSON.parse(fs.readFileSync(siteFile, "utf8")) as { requests: { at: number }[] }).requests[0]!.at;
  const r1 = await hook(4);
  assert.equal(r1.decision, "deny");
  const at = clockUp(first + 60 * 60_000, now());
  assert.ok(r1.reason!.includes(`None more of its pages in this session — a next session from ${at}`), r1.reason);
  assert.ok(r1.reason!.includes(`Never try a page of ${SITE} again in this session`), r1.reason);
  assert.doesNotMatch(r1.reason!, /refusal \d+ of the same/u);
  const r2 = await hook(4);
  assert.doesNotMatch(r2.reason!, /refusal \d+ of the same/u);
  const r3 = await hook(4);
  assert.equal(r3.decision, "deny");
  assert.match(r3.reason!, /This is refusal 3 of the same in this session: end the session now/u);
  // the computer's window gone by (its pages older than run.minutes): a next session may have them at once
  const kept = JSON.parse(fs.readFileSync(siteFile, "utf8")) as { requests: { at: number; who: string }[] };
  fs.writeFileSync(siteFile, JSON.stringify({ requests: kept.requests.map((x) => ({ ...x, at: x.at - 61 * 60_000 })) }));
  const r4 = await hook(5);
  assert.ok(r4.reason!.includes("None more of its pages in this session — a next session may have them."), r4.reason);
  assert.match(r4.reason!, /This is refusal 4 of the same/u);
  w.cleanup();
});
