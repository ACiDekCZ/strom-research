// The tree for the Strom app (GET /tree.ged) is made once for each state of the research and variant: kept on disk
// (.strom/cache/live-ged), a bridge started again gives it at once without making it again (found 2026-11-09: a minute
// of a large research at each opening of the app, the research unchanged). Asked with ?stale=1 (feature ged.stale) the
// last one made comes at once though the research changed since — with its own head — and the new one is told by the
// event change; what the app sends back over that older tree is judged against its own head (_STROM_HEAD): what the
// research wrote meanwhile stays.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { World, hasGit } from "../helpers.ts";
import { post } from "./sync.helpers.ts";
import { gedStoreDir, storeGed, storedGed, tidyStoredGeds, type GedMade } from "../../src/core/liveged.ts";

const opts = { skip: !hasGit || process.platform === "win32", timeout: 180_000 };
const APP = "https://beta.stromapp.info";

function ask(url: string): Promise<{ status: number; headers: http.IncomingHttpHeaders; body: string; ms: number }> {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const req = http.request(url, { agent: false, headers: { Origin: APP } }, (res) => {
      let body = "";
      res.setEncoding("utf8");
      res.on("data", (d) => (body += d));
      res.on("end", () => resolve({ status: res.statusCode ?? 0, headers: res.headers, body, ms: Date.now() - started }));
    });
    req.on("error", reject);
    req.end();
  });
}

/** The events of the bridge heard until `stop`: their text so far, and the end. */
function follow(url: string): { text: () => string; end: () => void; ready: Promise<void> } {
  let text = "";
  let ready!: () => void;
  const started = new Promise<void>((r) => (ready = r));
  const req = http.get(`${url}/events`, { agent: false, headers: { Origin: APP } }, (res) => {
    res.setEncoding("utf8");
    res.on("data", (d) => {
      text += d;
      if (text.includes("event: hello")) ready();
    });
  });
  req.on("error", () => undefined);
  return { text: () => text, end: () => req.destroy(), ready: started };
}

async function until(what: string, ok: () => boolean, ms = 30_000): Promise<void> {
  const by = Date.now() + ms;
  while (!ok()) {
    if (Date.now() > by) assert.fail(`waited ${ms} ms in vain: ${what}`);
    await new Promise((r) => setTimeout(r, 50));
  }
}

/** No agent on this computer: what the app sends is written as the user's at once. */
function noAgent(w: World): void {
  w.env.PATH = [path.dirname(process.execPath), "/usr/bin", "/bin"].join(path.delimiter);
}

const headOf = (ged: string) => /^1 _STROM_HEAD (\S+)/m.exec(ged)?.[1];
const changes = (text: string) => [...text.matchAll(/event: change\ndata: (.*)/g)].map((m) => JSON.parse(m[1]!) as { head: string; entries: { what: string[] }[] });

test("the tree for the app: made once for a state, kept on disk, given at once by a bridge started again", opts, async () => {
  const w = new World();
  await w.withTree();
  w.env.STROM_LIVE_POLL_MS = "200";
  await w.ok(["person", "add", "Jan /Lhoták/", "--sex", "M", "--born", "1950"]);
  let info = (await w.ok(["live", "start", "--json"])).json;
  try {
    const first = await ask(`${info.url}/tree.ged`);
    assert.equal(first.status, 200);
    assert.equal(first.headers["x-strom-head"], headOf(first.body));
    // the same again: the same file (its time of making the same — never made again)
    assert.equal((await ask(`${info.url}/tree.ged`)).body, first.body);
    await until("kept on disk", () => fs.existsSync(gedStoreDir(w.cwd)) && fs.readdirSync(gedStoreDir(w.cwd)).some((f) => f.endsWith(".ged")));
    // a second later (the time of making written to the second), the bridge started again: the kept one, not a new one
    await new Promise((r) => setTimeout(r, 1100));
    await w.ok(["live", "stop"]);
    info = (await w.ok(["live", "start", "--json"])).json;
    const again = await ask(`${info.url}/tree.ged`);
    assert.equal(again.body, first.body, "the file kept, not made again");
    // another app's version: a variant of its own, kept beside
    const other = await ask(`${info.url}/tree.ged?app=3.0.0`);
    assert.equal(other.status, 200);
    assert.notEqual(other.body, first.body);
    await until("two variants kept", () => fs.readdirSync(gedStoreDir(w.cwd)).filter((f) => f.endsWith(".ged")).length === 2);
  } finally {
    await w.ok(["live", "stop"]);
    w.cleanup();
  }
});

test("?stale=1: the last tree made at once with its own head, the new one told by change; a send over the older tree keeps what the research wrote since", opts, async () => {
  const w = new World();
  await w.withTree();
  await w.ok(["lang", "cs"]);
  w.env.STROM_LIVE_POLL_MS = "200";
  w.env.STROM_LIVE_QUIET_MS = "300";
  await w.ok(["person", "add", "Jan /Lhoták/", "--sex", "M", "--born", "1950"]);
  noAgent(w);
  const info = (await w.ok(["live", "start", "--json"])).json;
  const events = follow(info.url);
  try {
    await events.ready;
    // nothing made yet: made now, as without it
    const made = await ask(`${info.url}/tree.ged?stale=1`);
    assert.equal(made.status, 200);
    assert.equal(made.headers["x-strom-stale"], undefined);
    const older = headOf(made.body)!;
    // the research goes on: the change is told once its tree is made (the app loads it at once)
    await w.ok(["person", "add", "Karel /Lhoták/", "--sex", "M"]);
    await until("the change heard", () => changes(events.text()).length > 0);
    const told = changes(events.text())[0]!;
    assert.notEqual(told.head, older);
    const fresh = await ask(`${info.url}/tree.ged`);
    assert.equal(fresh.headers["x-strom-head"], told.head);
    assert.match(fresh.body, /Karel/);
    // a window still on the older tree, the research moved on again: the older one at once, said so
    await w.ok(["person", "add", "Marie /Lhotáková/", "--sex", "F"]);
    const stale = await ask(`${info.url}/tree.ged?stale=1`);
    assert.equal(stale.headers["x-strom-stale"], "1");
    assert.equal(stale.headers["x-strom-head"], told.head);
    assert.equal(headOf(stale.body), told.head, "the file says the state it is of");
    assert.notEqual(stale.headers["x-strom-head-now"], told.head);
    assert.doesNotMatch(stale.body, /Marie/);
    // the newer one made meanwhile, told by change (from the head the window has)
    await until("the newer tree told", () => changes(events.text()).some((c) => c.head === stale.headers["x-strom-head-now"]));
    const newest = await ask(`${info.url}/tree.ged`);
    assert.equal(newest.headers["x-strom-head"], stale.headers["x-strom-head-now"]);
    assert.match(newest.body, /Marie/);
    // what the window sends over the older tree (Jan born 1951): judged against its own head — Marie stays
    const edited = stale.body.replace(/(1 NAME Jan \/Lhoták\/\r?\n(?:[1-9].*\r?\n)*?1 BIRT\r?\n2 DATE )1950/, "$11951");
    assert.notEqual(edited, stale.body);
    const sent = await post(`${info.url}/sync`, edited, { Origin: APP });
    assert.equal(sent.status, 200, sent.body);
    const people = (await w.ok(["person", "list", "--json"])).json.persons as { name: string }[];
    assert.ok(people.some((p) => /Marie/.test(p.name)), "what the research wrote since stays");
    const jan = (await w.ok(["person", "show", "P1", "--json"])).json.person;
    assert.ok((jan.events as { kind: string; date?: string; retracted?: unknown }[]).some((e) => e.kind === "BIRT" && e.date === "1951" && !e.retracted), sent.body);
  } finally {
    events.end();
    await w.ok(["live", "stop"]);
    w.cleanup();
  }
});

test("the trees kept on disk: the newest two variants of this strom, none of another", { skip: !hasGit }, async () => {
  const w = new World();
  await w.withTree();
  const made = (n: number): GedMade => ({ head: "a".repeat(40), version: String(n), links: "", bytes: Buffer.from(`0 HEAD\n${n}\n`), left: { head: "a".repeat(40), level: "normal", sources: [] } });
  const { VERSION } = await import("../../src/core/tree.ts");
  const v = (n: number, strom = VERSION) => JSON.stringify({ strom, app: String(n) });
  for (const n of [1, 2, 3]) {
    await storeGed(w.cwd, v(n), made(n));
    await new Promise((r) => setTimeout(r, 20));
  }
  const kept = fs.readdirSync(gedStoreDir(w.cwd)).filter((f) => f.endsWith(".ged"));
  assert.equal(kept.length, 2);
  assert.equal(await storedGed(w.cwd, w.env, v(1)), undefined, "the oldest gone");
  assert.equal((await storedGed(w.cwd, w.env, v(3)))?.bytes.toString(), "0 HEAD\n3\n");
  assert.equal(await storedGed(w.cwd, w.env, v(3), "b".repeat(40)), undefined, "of another head: none");
  // another strom's (a bridge before an update): gone at the tidying
  await storeGed(w.cwd, v(4, "0.0.1"), made(4));
  assert.ok(await storedGed(w.cwd, w.env, v(4, "0.0.1")));
  await tidyStoredGeds(w.cwd);
  assert.equal(await storedGed(w.cwd, w.env, v(4, "0.0.1")), undefined);
  // a file cut short: none
  const dir = gedStoreDir(w.cwd);
  for (const f of fs.readdirSync(dir).filter((f) => f.endsWith(".ged"))) fs.writeFileSync(path.join(dir, f), "0 HEAD\n");
  assert.equal(await storedGed(w.cwd, w.env, v(3)), undefined, "not whole: none");
  w.cleanup();
});
