// strom media view B…:n of an image a task waits for through the agent's browser (strom media save): never a bare "not
// registered" — it says the task waits for it and the exact next step (strom media add --inbox --waiting once the
// browser saved it; strom media save … again when its script was not run or is over). Two synthetic archives of the
// same property (only a person's browser goes to them). No request leaves this computer.

import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import https from "node:https";
import http from "node:http";
import { World, hasGit } from "../helpers.ts";
import { grantWay } from "../../src/core/terms.ts";

const opts = { skip: !hasGit };
const fixtures = path.join(import.meta.dirname, "..", "fixtures", "images");
const CLAUDE = { CLAUDECODE: "1" };

const out: string[] = [];
const keep = { request: https.request, get: https.get, hrequest: http.request, hget: http.get, fetch: globalThis.fetch };
const refuse = (u: unknown) => {
  out.push(String(u));
  throw new Error("no network in this test");
};
before(() => {
  (https as { request: unknown }).request = refuse;
  (https as { get: unknown }).get = refuse;
  (http as { request: unknown }).request = refuse;
  (http as { get: unknown }).get = refuse;
  globalThis.fetch = (u) => Promise.reject(refuse(u));
});
after(() => {
  Object.assign(https, { request: keep.request, get: keep.get });
  Object.assign(http, { request: keep.hrequest, get: keep.hget });
  globalThis.fetch = keep.fetch;
});

const LHOTA = { host: "www.archiv-lhota.example", page: (book: number, n: number) => `https://www.archiv-lhota.example/kniha/${book}?snimek=${n}` };
const PODHRADI = { host: "matriky.podhradi.example", page: (book: number, n: number) => `https://matriky.podhradi.example/detail/${book}#${n}` };

async function setup(w: World): Promise<void> {
  await w.withTree("Lhotákovi");
  const file = path.join(w.dir, "archives-test.json");
  fs.writeFileSync(file, JSON.stringify({ archives: [LHOTA, PODHRADI].map((a) => ({ host: a.host, name: `Archiv ${a.host}`, level: "restricted", browserOnly: true, checked: "2026-11-01" })) }));
  w.env.STROM_ARCHIVES_FILE = file;
  assert.ok(grantWay(w.env, [LHOTA.host, PODHRADI.host], "browser", { by: "terminal" }));
  await w.ok(["research", "new", "X", "--new-person", "Jan /Lhoták/"]);
  const downloads = path.join(w.dir, "Stažené soubory");
  fs.mkdirSync(downloads);
  await w.ok(["config", "set", "browser.downloads", downloads]);
  await w.ok(["recordset", "add", "Lhota N 1784–1820", "--url", LHOTA.page(11, 1)]); // B1
  await w.ok(["recordset", "add", "Podhradí N 1790–1830", "--url", PODHRADI.page(22, 1)]); // B2
  await w.ok(["task", "add", "Křest Jana", "--level", "link", "--where", "B1", "--why", "a", "--done-when", "b"]); // T1
  await w.ok(["task", "add", "Sňatek Jana", "--level", "link", "--where", "B2", "--why", "a", "--done-when", "b"]); // T2
  // this session's task is T1
  await w.ok(["session", "start", "T1"]);
  await w.ok(["media", "save", "T1", "--image", "5", "--at", LHOTA.page(11, 5)], { env: CLAUDE });
  await w.ok(["media", "save", "T2", "--image", "6", "--at", PODHRADI.page(22, 6)], { env: CLAUDE });
}

test("media view of an image a task waits for through the agent's browser: who waits, and the exact next step — never a bare \"not registered\" (two archives)", opts, async () => {
  const w = new World();
  try {
    await setup(w);
    for (const [task, book, n, at] of [["T0001", "B0001", 5, LHOTA.page(11, 5)], ["T0002", "B0002", 6, PODHRADI.page(22, 6)]] as const) {
      const r = await w.run(["media", "view", `${book}:${n}`]);
      assert.equal(r.code, 2, r.out + r.err);
      const said = r.out + r.err;
      assert.doesNotMatch(said, new RegExp(`image ${n} of ${book} is not registered(?! yet)`), said);
      assert.match(said, new RegExp(String.raw`image ${n} of ${book} is not registered yet: ${task} waits for it through your browser \(strom media save gave its script at \d\d:\d\d:\d\d\)`), said);
      assert.ok(said.includes(`once the browser saved it: strom media add --inbox --waiting takes it`), said);
      assert.ok(said.includes(`the script not run yet, or over: strom media save ${task} --image ${n} --recordset ${book} --at ${at}, its script in that tab, then strom media add --inbox --waiting`), said);
      // the same in --json: the message and its next step
      const j = await w.run(["media", "view", `${book}:${n}`, "--json"]);
      assert.match(String(j.json.message), new RegExp(`${task} waits for it through your browser`));
    }
    // among several images: the one registered is shown, the one waited for said with its step
    await w.ok(["media", "add", path.join(fixtures, "grey.jpg"), "--recordset", "B1", "--image", "4"]);
    const some = await w.ok(["media", "view", "B1:4", "B1:5"]);
    assert.match(some.out, /not registered: B0001:5/);
    assert.match(some.out, /image 5 of B0001 is not registered yet: T0001 waits for it through your browser .* — once the browser saved it: strom media add --inbox --waiting/);
    // an image nobody waits for stays "not registered"
    const none = await w.run(["media", "view", "B2:9"]);
    assert.match(none.out + none.err, /image 9 of B0002 is not registered\b(?! yet)/);
    assert.deepEqual(out, [], "nothing left this computer");
  } finally {
    w.cleanup();
  }
});
