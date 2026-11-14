// The older sources' locators split from the Strom app through the bridge (spec 075 P4, the app's
// ZADANI_VYZKUM_citace-pole.md 6 and D): GET /sources/split previews (count apart from the first ten, ?all=1 every
// one, its plan), POST /sources/split does it on the person's click as one step on that plan (another plan by now: 409
// with the preview as it is), POST /sources/split/undo takes it back whole (a source changed since: 409 with how many
// and the first five); never in an archive; the CLI's --apply and --undo stay the person's (an agent: exit 4).

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { World, hasGit } from "../helpers.ts";
import { Tree } from "../../src/core/tree.ts";
import { BRIDGE_FEATURES } from "../../src/core/live.ts";
import type { Source } from "../../src/core/model.ts";

const opts = { skip: !hasGit, timeout: 240_000 };
const APP = "https://beta.stromapp.info";
type Info = { pid: number; port: number; token: string; url: string };

function ask(url: string, opt: { method?: string; body?: string; origin?: boolean } = {}): Promise<{ status: number; body: any; headers: http.IncomingHttpHeaders }> {
  return new Promise((resolve, reject) => {
    const headers: Record<string, string> = opt.origin === false ? {} : { Origin: APP };
    if (opt.body !== undefined) headers["Content-Type"] = "text/plain; charset=utf-8";
    const req = http.request(url, { agent: false, method: opt.method ?? "GET", headers }, (res) => {
      let text = "";
      res.setEncoding("utf8");
      res.on("data", (d) => (text += d));
      res.on("end", () => {
        let body: any = text;
        try {
          body = JSON.parse(text);
        } catch {
          // not JSON
        }
        resolve({ status: res.statusCode ?? 0, body, headers: res.headers });
      });
    });
    req.on("error", reject);
    req.end(opt.body);
  });
}
const post = (url: string, body: unknown) => ask(url, { method: "POST", body: JSON.stringify(body) });
const place = (w: World, id: string) => {
  const s = Tree.open(w.cwd, w.env).get<Source>(id)!;
  return [s.locator, s.folio, s.image];
};

test("bridge: GET /sources/split previews (count, the first ten, ?all=1, its plan; nothing written); POST on its plan splits as one step, another plan 409 with the preview; undo whole, a source changed since 409 with its count and first five; an archive 409; the CLI the person's", opts, async () => {
  const w = new World();
  try {
    await w.withTree("Lhotákovi");
    // a write held by another strom gives up soon (a writer's two minutes were all but the test's time limit)
    Object.assign(w.env, { STROM_LOCK_WAIT_MS: "1500" });
    await w.ok(["lang", "cs"]);
    // twelve sources to split (S1–S12), one with nothing to take (S13)
    for (let i = 1; i <= 12; i++) await w.ok(["source", "add", `Křest Lhotáka ${1880 + i}`, "--kind", "baptism", "--locator", `fol. ${i}, č. ${i + 1}, snímek ${i + 2}`]);
    await w.ok(["source", "add", "Křest Lhotákové 1899", "--kind", "baptism", "--locator", "č. 8"]); // S13
    assert.ok(BRIDGE_FEATURES.includes("sources.split"));
    const info = (await w.ok(["live", "start", "--json"])).json as Info;
    const url = `${info.url}/sources/split`;
    assert.ok((await ask(`${info.url}/status`)).body.features.includes("sources.split"));
    const ops = Tree.open(w.cwd, w.env).readOps().length;

    const preview = await ask(url);
    assert.equal(preview.status, 200, JSON.stringify(preview.body));
    assert.equal(preview.body.count, 12);
    assert.equal(preview.body.split.length, 10, "the first ten");
    assert.deepEqual(preview.body.split[0], { source: "S0001", title: "Křest Lhotáka 1881", before: { locator: "fol. 1, č. 2, snímek 3" }, after: { locator: "č. 2", folio: "fol. 1", image: "3" } });
    assert.equal(preview.body.unrecognized, 1);
    assert.deepEqual(preview.body.unrecognizedExamples, ["č. 8"]);
    assert.deepEqual(preview.body.undos, []);
    assert.match(preview.body.plan, /^[0-9a-f]{16}$/u);
    const all = (await ask(`${url}?all=1`)).body;
    assert.equal(all.split.length, 12);
    assert.equal(all.plan, preview.body.plan);
    assert.equal(Tree.open(w.cwd, w.env).readOps().length, ops, "the preview writes nothing");

    // the body; only the app writes
    for (const bad of [{}, { plan: "x" }, { plan: preview.body.plan, all: true }]) {
      const r = await post(url, bad);
      assert.equal(r.status, 400, JSON.stringify(bad));
      assert.equal(r.body.code, "source.split.body");
    }
    assert.equal((await ask(url, { method: "POST", body: JSON.stringify({ plan: preview.body.plan }), origin: false })).status, 403);
    // the sources changed since the preview: 409 with the preview as it is now
    await w.ok(["source", "add", "Křest Lhotáka 1900", "--kind", "baptism", "--locator", "fol. 40, snímek 41"]); // S14
    const old = await post(url, { plan: preview.body.plan });
    assert.equal(old.status, 409);
    assert.equal(old.body.code, "source.split.plan");
    assert.equal(old.body.preview.count, 13);
    assert.notEqual(old.body.preview.plan, preview.body.plan);
    assert.deepEqual(place(w, "S0001"), ["fol. 1, č. 2, snímek 3", undefined, undefined], "nothing written");

    // done on the person's click: one step, nothing else of the tree
    const before = Tree.open(w.cwd, w.env).readOps().length;
    const done = await post(url, { plan: old.body.preview.plan });
    assert.equal(done.status, 200, JSON.stringify(done.body));
    assert.deepEqual(done.body.done, { split: 13 });
    assert.match(done.body.undo, /^\d{14}-[0-9a-f]{6}$/u);
    assert.notEqual(done.body.head, done.body.parent);
    const written = Tree.open(w.cwd, w.env).readOps().slice(before);
    assert.deepEqual(written.map((o) => o.op), ["source.split"], "one operation, nothing else");
    assert.deepEqual(place(w, "S0001"), ["č. 2", "fol. 1", "3"]);
    assert.deepEqual(place(w, "S0013"), ["č. 8", undefined, undefined]);
    const after = (await ask(url)).body;
    assert.equal(after.count, 0);
    assert.deepEqual([after.unrecognized, after.unrecognizedExamples], [1, ["č. 8"]], "the split ones' rest is no unrecognised locator");
    assert.deepEqual(after.undos.map((u: { id: string; sources: number }) => [u.id, u.sources]), [[done.body.undo, 13]]);
    // nothing to split: 200, nothing written
    const nothing = await post(url, { plan: after.plan });
    assert.deepEqual(nothing.body.done, { split: 0 });

    // undo: a source changed since — refused whole, said how many and which
    for (const id of ["S0001", "S0002", "S0003", "S0004", "S0005", "S0006"]) await w.ok(["source", "edit", id, "--locator", "zápis 1", "--reason", "re-read"]);
    const changed = await post(`${url}/undo`, { undo: done.body.undo });
    assert.equal(changed.status, 409, JSON.stringify(changed.body));
    assert.equal(changed.body.code, "source.split.changed");
    assert.equal(changed.body.count, 6);
    assert.deepEqual(changed.body.sources, ["S0001", "S0002", "S0003", "S0004", "S0005"].map((id, i) => ({ id, title: `Křest Lhotáka ${1881 + i}` })));
    assert.deepEqual(place(w, "S0007"), ["č. 8", "fol. 7", "9"], "nothing put back");
    // a split undone whole
    const again = await post(url, { plan: (await ask(url)).body.plan });
    assert.equal(again.status, 200, JSON.stringify(again.body));
    assert.equal(again.body.done.split, 0, "the re-read locators name nothing");
    await w.ok(["source", "add", "Křest Lhotáka 1901", "--kind", "baptism", "--locator", "pag. 3, Bild 4"]); // S15
    const one = await post(url, { plan: (await ask(url)).body.plan });
    assert.deepEqual(one.body.done, { split: 1 });
    const undo = await post(`${url}/undo`, { undo: one.body.undo });
    assert.equal(undo.status, 200, JSON.stringify(undo.body));
    assert.deepEqual(undo.body.undone, { restored: 1 });
    assert.notEqual(undo.body.head, undo.body.parent);
    assert.deepEqual(place(w, "S0015"), ["pag. 3, Bild 4", undefined, undefined]);
    const none = await post(`${url}/undo`, { undo: one.body.undo });
    assert.equal(none.status, 404);
    assert.equal(none.body.code, "source.split.undo");
    assert.equal((await post(`${url}/undo`, { undo: "../x" })).status, 400);

    // the research held by another strom: neither previewed nor done, busy (+ Retry-After), nothing written
    const lock = path.join(w.cwd, ".strom", "tree.lock");
    const heldPlan = (await ask(url)).body.plan;
    fs.writeFileSync(lock, JSON.stringify({ pid: process.pid, host: os.hostname(), at: new Date().toISOString(), owner: "a test" }));
    const held = await ask(url);
    const heldPost = await post(url, { plan: heldPlan });
    fs.rmSync(lock);
    for (const r of [held, heldPost]) assert.deepEqual([r.status, r.body.code, r.headers["retry-after"] !== undefined], [503, "research.busy", true]);
    assert.deepEqual(place(w, "S0015"), ["pag. 3, Bild 4", undefined, undefined]);

    // the CLI stays the person's: an agent's --apply, --plan or --undo exit 4
    const agent = { env: { CLAUDECODE: "1" } };
    const plan = (await w.ok(["source", "split", "--json"], agent)).json.plan;
    assert.equal((await w.run(["source", "split", "--apply", "--plan", plan], agent)).code, 4);
    assert.equal((await w.run(["source", "split", "--undo", done.body.undo], agent)).code, 4);
    assert.notEqual((await w.run(["source", "split", "--plan", plan])).code, 0, "--plan without --apply");

    // an archive: neither previewed nor done
    await w.run(["live", "stop"]);
    await w.ok(["mode", "archive"], { tty: true });
    const archive = (await w.ok(["live", "start", "--json"])).json as Info;
    const shut = await ask(`${archive.url}/sources/split`);
    assert.equal(shut.status, 409);
    assert.equal(shut.body.code, "source.split.archive");
    const refused = await post(`${archive.url}/sources/split`, { plan });
    assert.equal(refused.status, 409);
    assert.equal(refused.body.code, "source.split.archive");
  } finally {
    await w.run(["live", "stop"]);
    w.cleanup();
  }
});
