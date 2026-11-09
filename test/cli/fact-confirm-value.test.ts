// The person's confirmation of a fact against the scan holds for the value the person saw (1109, spec 065): the Strom
// file gives each fact the mark of what it says (3 _TXT under 2 _STROM_EID, core/readers.ts factMark), the app gives it
// back with POST /facts/confirm (strom verify confirm --txt) — a fact changed since (the app showing an older tree,
// ?stale=1) is refused, confirm.changed with the mark and the value now, nothing written; several facts all or none;
// without the mark as before (an older app). Made-up people (Lhoták, Kroutil, Čáslav), diacritics typed in NFD.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { World, hasGit } from "../helpers.ts";
import { Tree } from "../../src/core/tree.ts";
import { BRIDGE_FEATURES } from "../../src/core/live.ts";
import { factMark } from "../../src/core/readers.ts";
import { validateGedcom } from "../../src/gedcom/validate.ts";
import * as git from "../../src/core/git.ts";
import type { Event, Family, Person } from "../../src/core/model.ts";

const opts = { skip: !hasGit };
const bridgeOpts = { skip: !hasGit || process.platform === "win32", timeout: 240_000 };
const ORIGIN = "https://beta.stromapp.info";
const BETA = "3.26.0-beta.2";
/** The person in the app (through the bridge): their own write. */
const APP = { STROM_FOR_APP: "1" };
const BETA_APP = { STROM_APP_URL: "https://beta.stromapp.info/run/", STROM_APP_VERSION: BETA };

const open = (w: World) => Tree.open(w.cwd, w.env);
const fact = (w: World, id: string): Event => {
  const tree = open(w);
  for (const o of [...tree.list<Person>("person"), ...tree.list<Family>("family")]) {
    const e = o.events.find((x) => x.id === id);
    if (e) return e;
  }
  throw new Error(`no fact ${id}`);
};

/** The mark a Strom file gives a fact: the line under its `2 _STROM_EID`. */
function markIn(text: string, id: string): string {
  const m = new RegExp(`\\n2 _STROM_EID ${id}\\n3 _TXT ([0-9a-f]{16})\\n`, "u").exec(text);
  assert.ok(m, `no mark of ${id}`);
  return m[1]!;
}

async function add(w: World, owner: string, kind: string, ...more: string[]): Promise<string> {
  return (await w.ok(["event", "add", owner, kind, ...more, "--json"])).json.event.id as string;
}

/** Josef Lhoták (P1) born in Čáslav (typed in NFD), died in Лхота; married Marie Kroutilová (P2) in F1. */
async function lhotaci() {
  const w = new World();
  await w.withTree("Lhotákovi");
  await w.ok(["lang", "cs"]);
  await w.ok(["person", "add", "Josef /Lhoták/".normalize("NFD"), "--sex", "M"]); // P1
  await w.ok(["person", "add", "Marie /Kroutilová/", "--sex", "F"]); // P2
  await w.ok(["family", "add", "--partner", "P1", "--partner", "P2"]); // F1
  const f = {
    birth: await add(w, "P1", "BIRT", "--date", "1850", "--place", "Čáslav".normalize("NFD")),
    death: await add(w, "P1", "DEAT", "--date", "1910", "--place", "Лхота"),
    marriage: await add(w, "F1", "MARR", "--date", "1875", "--place", "Čáslav"),
  };
  return { w, f };
}

test("factMark: what a fact says (NFC and NFD alike, the partners' ages in any order), never its sources, notes or status", () => {
  const base: Event = { id: "E0001", kind: "BIRT", date: "1850", place: "Čáslav", status: "probable", citations: [] };
  const full = (e: Event) => factMark(e);
  const mark = factMark(base);
  assert.match(mark, /^[0-9a-f]{16}$/u);
  assert.equal(factMark({ ...base, place: "Čáslav".normalize("NFD") }), mark, "the same text in NFD: the same mark");
  assert.equal(full({ ...base, status: "proven", note: "poznámka", citations: [{ source: "S0001" }] as Event["citations"] }), mark, "sources, notes, the status: not what it says");
  for (const other of [{ date: "1851" }, { place: "Лхота" }, { place: "Čáslav, Čechy" }, { value: "sedlák" }, { house: "13" }, { kind: "CHR" }, { age: "27y" }, { cause: "tuberkulóza" }])
    assert.notEqual(factMark({ ...base, ...other } as Event), mark, JSON.stringify(other));
  const fam: Event = { id: "E0002", kind: "MARR", status: "probable", citations: [], ages: { P0001: "27y", P0002: "22y" } };
  assert.equal(factMark({ ...fam, ages: { P0002: "22y", P0001: "27y" } }), factMark(fam));
  assert.notEqual(factMark({ ...fam, ages: { P0001: "28y", P0002: "22y" } }), factMark(fam));
});

test("the Strom file gives each fact its mark under its ID; strom verify confirm --txt: changed since refused and nothing written, several all or none, the mark now confirms; without it as before", opts, async () => {
  const { w, f } = await lhotaci();
  try {
    const file = path.join(w.cwd, "output", "tree-strom.ged");
    await w.ok(["export", "gedcom", "--for", "strom"], { env: BETA_APP });
    const text = fs.readFileSync(file, "utf8");
    for (const id of [f.birth, f.death, f.marriage]) assert.equal(markIn(text, id), factMark(fact(w, id)), id);
    assert.match(text, new RegExp(`\\n1 BIRT\\n2 _STROM_EID ${f.birth}\\n3 _TXT [0-9a-f]{16}\\n2 DATE 1850\\n2 PLAC Čáslav\\n`, "u"), "the file in NFC");
    assert.deepEqual(validateGedcom(text).filter((x) => x.level === "error" || /_TXT|_STROM_EID/u.test(x.message)), []);
    const seen = markIn(text, f.birth);
    const deathSeen = markIn(text, f.death);

    // the birth changed since the file was made
    await w.ok(["event", "edit", f.birth, "--date", "1851", "--reason", "matrika uvádí 1851"]);
    const before = git.head(w.cwd);
    const changed = await w.run(["verify", "confirm", f.birth, "--txt", seen, "--json"], { env: APP });
    assert.notEqual(changed.code, 0);
    const said = JSON.parse(changed.out || changed.err);
    assert.equal(said.code, "confirm.changed");
    assert.deepEqual(said.params, { fact: f.birth, txt: factMark(fact(w, f.birth)), date: "1851", place: "Čáslav" });
    assert.equal(fact(w, f.birth).confirmed, undefined, "nothing written");
    assert.equal(git.head(w.cwd), before);

    // two facts, one changed: neither confirmed
    const both = await w.run(["verify", "confirm", f.death, f.birth, "--txt", `${deathSeen},${seen}`, "--json"], { env: APP });
    assert.equal(JSON.parse(both.out || both.err).code, "confirm.changed");
    assert.equal(fact(w, f.death).confirmed, undefined, "all or none");
    assert.equal(git.head(w.cwd), before);
    // a mark for each fact, never fewer; a mark is 16 hex characters
    for (const txt of [deathSeen, "xyz", `${deathSeen},`]) {
      const bad = await w.run(["verify", "confirm", f.death, f.birth, "--txt", txt, "--json"], { env: APP });
      assert.equal(JSON.parse(bad.out || bad.err).code, "factconfirm.invalid", txt);
    }

    // the marks now (the birth's from the file made again): both confirmed; the mark in capitals too
    const now = markIn((await w.ok(["export", "gedcom", "--for", "strom"], { env: BETA_APP }), fs.readFileSync(file, "utf8")), f.birth);
    assert.notEqual(now, seen);
    await w.ok(["verify", "confirm", f.death, f.birth, "--txt", `${deathSeen.toUpperCase()},${now}`], { env: APP });
    assert.ok(fact(w, f.death).confirmed && fact(w, f.birth).confirmed);
    // without a mark: as before
    await w.ok(["verify", "confirm", f.marriage], { env: APP });
    assert.equal(fact(w, f.marriage).confirmed?.by, "user");
    assert.match((await w.ok(["check"])).out, /^ok/);
  } finally {
    w.cleanup();
  }
});

interface Answer {
  status: number;
  body: any;
}

function request(url: string, method = "GET", body?: unknown): Promise<Answer> {
  return new Promise((resolve, reject) => {
    const data = body === undefined ? undefined : Buffer.from(JSON.stringify(body), "utf8");
    const headers = { Origin: ORIGIN, "X-Strom-App-Version": BETA, ...(data ? { "Content-Type": "text/plain;charset=UTF-8", "Content-Length": String(data.length) } : {}) };
    const req = http.request(url, { agent: false, method, headers }, (res) => {
      let text = "";
      res.setEncoding("utf8");
      res.on("data", (d) => (text += d));
      res.on("end", () => {
        let parsed: any = text;
        try {
          parsed = JSON.parse(text);
        } catch {
          // the tree, not JSON
        }
        resolve({ status: res.statusCode ?? 0, body: parsed });
      });
    });
    req.on("error", reject);
    req.end(data);
  });
}

test("the bridge: POST /facts/confirm with the mark the app showed — a fact changed since refused 409 confirm.changed with the mark and the value now, nothing written; the mark now confirms; without it as before; feature facts.confirm.value", bridgeOpts, async () => {
  const { w, f } = await lhotaci();
  Object.assign(w.env, { STROM_LOCK_WAIT_MS: "1500", STROM_APP_URL: BETA_APP.STROM_APP_URL });
  let started = false;
  try {
    const info = (await w.ok(["live", "start", "--json"])).json as { url: string };
    started = true;
    const post = (body: unknown) => request(`${info.url}/facts/confirm`, "POST", body);
    const st = (await request(`${info.url}/status`)).body;
    assert.ok(st.features.includes("facts.confirm.value"));
    assert.ok(BRIDGE_FEATURES.indexOf("facts.confirm.value") > BRIDGE_FEATURES.indexOf("ged.stale"), "appended");

    const tree = await request(`${info.url}/tree.ged`);
    assert.equal(tree.status, 200);
    const seen = markIn(tree.body, f.birth);
    assert.equal(seen, factMark(fact(w, f.birth)));

    for (const bad of [{ fact: f.birth, txt: "Čáslav", confirm: true }, { fact: f.birth, txt: 12, confirm: true }, { fact: f.birth, txt: seen, confirm: true, at: 1 }]) {
      const r = await post(bad);
      assert.deepEqual([r.status, r.body.code], [400, "factconfirm.invalid"], JSON.stringify(bad));
    }

    // the place written again as the person typed it on a Mac (NFD): stored NFC, what it says unchanged
    await w.ok(["event", "edit", f.birth, "--place", "Čáslav".normalize("NFD"), "--reason", "stejné místo"]);
    assert.equal(factMark(fact(w, f.birth)), seen, "the same text in NFD: the same value");
    const same = await post({ fact: f.birth, txt: seen, confirm: true });
    assert.equal(same.status, 200, JSON.stringify(same.body));
    assert.ok(fact(w, f.birth).confirmed);
    assert.equal((await post({ fact: f.birth, txt: seen, confirm: false })).status, 200);
    assert.equal(fact(w, f.birth).confirmed, undefined);

    // the value changed since the app's tree was made: refused, nothing written
    await w.ok(["event", "edit", f.birth, "--date", "1851", "--place", "Лхота", "--reason", "matrika uvádí 1851"]);
    const before = git.head(w.cwd);
    const refused = await post({ fact: f.birth, txt: seen, confirm: true });
    assert.equal(refused.status, 409, JSON.stringify(refused.body));
    assert.equal(refused.body.code, "confirm.changed");
    assert.equal(refused.body.txt, factMark(fact(w, f.birth)), "the mark now");
    assert.deepEqual(refused.body.now, { date: "1851", place: "Лхота" }, "what it says now");
    assert.equal(typeof refused.body.error, "string");
    assert.equal(fact(w, f.birth).confirmed, undefined);
    assert.equal(git.head(w.cwd), before, "nothing written");

    // the mark now confirms
    const ok = await post({ fact: f.birth, txt: refused.body.txt, confirm: true });
    assert.equal(ok.status, 200, JSON.stringify(ok.body));
    assert.deepEqual([ok.body.ok, ok.body.fact, ok.body.owner], [true, f.birth, "P0001"]);
    assert.notEqual(ok.body.head, ok.body.parent);
    assert.ok(fact(w, f.birth).confirmed);

    // without a mark (an older app): as before
    const old = await post({ fact: f.marriage, confirm: true });
    assert.equal(old.status, 200, JSON.stringify(old.body));
    assert.equal(fact(w, f.marriage).confirmed?.by, "user");
  } finally {
    if (started) await w.run(["live", "stop"]);
    w.cleanup();
  }
});
