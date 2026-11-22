// A family tree's file in the material (spec 117 K2.1–K2.3, R7, R8): listed only to an app that asks (GET
// /material?trees=1, kind "tree"; never the file a sync sent, nor an old import without its bytes); deleted for good as
// any file of the material — one a source standing was made of only together with that source (409
// material.source-live, impacts[].blockedBy; retractSources: one confirmation over both, sourceImpacts), a failure in
// the middle writing nothing and keeping the bytes; a file without a source deleted as the material is, its record kept
// taken back; a deleted source whose file is deleted later loses its link to it (restored, it is without the file).

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { World, hasGit } from "../helpers.ts";
import { Tree } from "../../src/core/tree.ts";
import { Settings } from "../../src/core/config.ts";
import { create } from "../../src/core/records.ts";
import { material } from "../../src/core/material.ts";
import type { Input, Person, Source } from "../../src/core/model.ts";

const opts = { skip: !hasGit || process.platform === "win32" };
const app = { Origin: "https://beta.stromapp.info" };
const gitHead = (dir: string) => execFileSync("git", ["-C", dir, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const gitStatus = (dir: string) => execFileSync("git", ["-C", dir, "status", "--porcelain"], { encoding: "utf8" }).trim();

function request(method: string, url: string, body?: Buffer, headers: Record<string, string> = {}): Promise<{ status: number; body: Buffer }> {
  return new Promise((resolve, reject) => {
    const req = http.request(url, { method, headers: { ...(body ? { "Content-Length": String(body.length) } : {}), ...headers } }, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (d: Buffer) => chunks.push(d));
      res.on("end", () => resolve({ status: res.statusCode ?? 0, body: Buffer.concat(chunks) }));
    });
    req.on("error", reject);
    req.end(body);
  });
}
const json = (r: { body: Buffer }) => JSON.parse(r.body.toString("utf8"));
const post = (url: string, body: unknown) => request("POST", url, Buffer.from(JSON.stringify(body)), { ...app, "Content-Type": "application/json" });

const ged = (...people: string[]) =>
  ["0 HEAD", "1 GEDC", "2 VERS 5.5.1", "1 CHAR UTF-8", ...people.flatMap((p, n) => [`0 @I${n + 1}@ INDI`, `1 NAME ${p}`, "1 BIRT", `2 DATE ${1850 + n}`, "2 PLAC Lhota"]), "0 TRLR", ""].join("\n");

interface Files {
  w: World;
  /** The family tree's file a source was made of (imported), that source, and one taken in without an import. */
  imported: string;
  source: string;
  bare: string;
  /** The file a sync sent, an old import without its bytes: never listed. */
  synced: string;
  old: string;
}

/** A research with a family tree imported (I…, its source S…), one kept without an import, one a sync sent, one old import without its file. */
async function world(state: "research" | "archive" = "research"): Promise<Files> {
  const w = new World();
  await w.withTree("Lhotákovi");
  await w.ok(["lang", "cs"]);
  const a = path.join(w.dir, "Lhotákovi rodokmen.ged".normalize("NFD"));
  fs.writeFileSync(a, ged("Matěj /Lhoták/", "Žofie /Lhotáková/"));
  await w.ok(["intake", a]);
  const b = path.join(w.dir, "Talvanen.ged");
  fs.writeFileSync(b, ged("Aino /Talvanen/"));
  await w.ok(["intake", b, "--no-import"]);
  const tree = Tree.open(w.cwd, w.env);
  const inputs = tree.list<Input>("input");
  const imported = inputs.find((i) => i.name.normalize("NFC") === "Lhotákovi rodokmen.ged")!;
  const bare = inputs.find((i) => i.name === "Talvanen.ged")!;
  const { synced, old } = tree.withTreeLock(() => {
    const synced = create<Input>(tree, "input", { name: "app.ged", file: "inputs/app.ged", sha: "a".repeat(64), size: 1, mime: "text/plain", from: "app.ged", kind: "tree", state: "processed", sync: { edits: "conflict", applied: [] } } as never, (i) => `+${i} input tree "app.ged" (sync)`);
    const old = create<Input>(tree, "input", { name: "staré.ged", sha: "b".repeat(64), size: 1, mime: "text/plain", from: "staré.ged", kind: "tree", state: "processed" } as never, (i) => `+${i} input tree "staré.ged"`);
    tree.commit("the records of the test");
    return { synced: synced.id, old: old.id };
  });
  if (state === "archive") await w.ok(["mode", "archive"], { tty: true, answers: ["a"] });
  assert.ok(imported.source && fs.existsSync(path.join(w.cwd, imported.file!)));
  return { w, imported: imported.id, source: imported.source!, bare: bare.id, synced, old };
}

const shared = (w: World) => new Settings(w.env, {}).shared()?.value;
const sourceNow = (w: World, id: string) => Tree.open(w.cwd, w.env).get<Source>(id)!;
/** The citations of a source in the people's records (an imported value keeps its origin: not a citation). */
const citing = (w: World, id: string) => {
  let n = 0;
  JSON.stringify(Tree.open(w.cwd, w.env).list<Person>("person"), (k, v) => {
    if (k === "citations" && Array.isArray(v)) n += v.filter((c: { source?: string }) => c?.source === id).length;
    return v;
  });
  return n;
};

test("K2.1: a family tree's file listed only when asked (?trees=1, kind tree, its source in uses.of), never the file a sync sent nor an old import without bytes", opts, async () => {
  const f = await world();
  const { w } = f;
  const tree = Tree.open(w.cwd, w.env);
  const ids = (m: { files: { id: string }[] }) => m.files.map((x) => x.id);
  assert.deepEqual(ids(material(tree, shared(w))), []);
  const all = material(tree, shared(w), { trees: true });
  assert.deepEqual(ids(all).sort(), [f.imported, f.bare].sort());
  const file = all.files.find((x) => x.id === f.imported)!;
  assert.equal(file.kind, "tree");
  assert.equal(file.name.normalize("NFC"), "Lhotákovi rodokmen.ged");
  assert.deepEqual(
    file.uses.of.map((o) => [o.source, o.via]),
    [[f.source, "input"]],
  );
  assert.equal(all.files.find((x) => x.id === f.bare)!.kind, "tree");

  w.env.STROM_LIVE_POLL_MS = "100";
  const info = (await w.ok(["live", "start", "--json"])).json;
  try {
    assert.deepEqual(json(await request("GET", `${info.url}/material`)).files, []);
    assert.deepEqual(json(await request("GET", `${info.url}/material?trees=0`)).files, []);
    const listed = json(await request("GET", `${info.url}/material?trees=1`)).files as { id: string; kind: string }[];
    assert.deepEqual(listed.map((x) => [x.id, x.kind]).sort(), [[f.imported, "tree"], [f.bare, "tree"]].sort());
    const bad = await request("GET", `${info.url}/material?trees=yes`);
    assert.deepEqual([bad.status, json(bad).code], [400, "material.query"]);
    const status = json(await request("GET", `${info.url}/status`, undefined, app));
    for (const g of ["source.retract", "material.trees", "material.delete"]) assert.ok(status.features.includes(g), g);
  } finally {
    await w.ok(["live", "stop"]);
  }
  w.cleanup();
});

test("K2.2, R7: a file a source standing was made of goes only with it — refused alone (material.source-live, blockedBy), a failure in the middle writes nothing and keeps the bytes, then both in one step", opts, async () => {
  const f = await world();
  const { w } = f;
  const bytes = path.join(w.cwd, Tree.open(w.cwd, w.env).get<Input>(f.imported)!.file!);
  const cited = citing(w, f.source);
  assert.ok(cited > 0);

  // the dry run says what holds it
  const dry = (await w.ok(["input", "delete", f.imported, "--dry-run", "--json"])).json;
  assert.deepEqual(dry.impacts[0].blockedBy, [f.source]);
  assert.equal(dry.sourceImpacts, undefined);

  // alone: refused, nothing written
  const head = gitHead(w.cwd);
  const alone = await w.run(["input", "delete", f.imported, "--json"], { dialog: true });
  assert.notEqual(alone.code, 0);
  assert.deepEqual([alone.json.code, alone.json.params?.sources], ["material.source-live", f.source]);
  // a source not made of the file, one unknown: refused before anything
  await w.ok(["source", "add", "Matrika Lhota", "--kind", "baptism"]);
  const other = Tree.open(w.cwd, w.env).list<Source>("source").find((s) => s.title === "Matrika Lhota")!.id;
  const headOther = gitHead(w.cwd);
  assert.equal((await w.run(["input", "delete", f.imported, "--retract-sources", other, "--json"], { dialog: true })).json.code, "material.body");
  assert.equal((await w.run(["input", "delete", f.imported, "--retract-sources", "S0999", "--json"], { dialog: true })).json.code, "material.body");
  assert.equal(gitHead(w.cwd), headOther);
  assert.notEqual(head, headOther);

  // with the source: the dry run has both
  const both = (await w.ok(["input", "delete", f.imported, "--retract-sources", f.source, "--dry-run", "--json"])).json;
  assert.deepEqual([both.retractSources, both.sourceImpacts[0].id], [[f.source], f.source]);
  assert.ok(both.sourceImpacts[0].files.includes(f.imported), JSON.stringify(both.sourceImpacts[0].files));

  // a failure in the middle (the records of the files cannot be written): nothing written, the bytes kept (R7)
  const inputsDir = path.join(w.cwd, "data", "inputs");
  fs.chmodSync(inputsDir, 0o555);
  try {
    const failed = await w.run(["input", "delete", f.imported, "--retract-sources", f.source, "--json"], { dialog: true });
    assert.notEqual(failed.code, 0, failed.out);
  } finally {
    fs.chmodSync(inputsDir, 0o755);
  }
  assert.equal(gitHead(w.cwd), headOther);
  assert.equal(gitStatus(w.cwd), "");
  assert.ok(fs.existsSync(bytes));
  assert.equal(sourceNow(w, f.source).retracted, undefined);
  assert.equal(citing(w, f.source), cited);
  assert.equal(Tree.open(w.cwd, w.env).get<Input>(f.imported)!.retracted, undefined);

  // both, one yes: the source deleted first, the file after, one commit, then the bytes
  const done = (await w.ok(["input", "delete", f.imported, "--retract-sources", f.source, "--json"], { dialog: true })).json;
  assert.deepEqual([done.deleted, done.retracted], [[f.imported], [f.source]]);
  assert.ok(done.sourceImpacts[0].files.includes(f.imported));
  assert.equal(execFileSync("git", ["-C", w.cwd, "rev-list", "--count", `${headOther}..HEAD`], { encoding: "utf8" }).trim(), "1");
  assert.equal(gitStatus(w.cwd), "");
  assert.ok(!fs.existsSync(bytes));
  const s = sourceNow(w, f.source);
  assert.ok(s.retracted && s.deleted, JSON.stringify(s));
  // R8: the deleted source has no file any more — restored, it is without it
  assert.equal(s.input, undefined);
  assert.equal(citing(w, f.source), 0);
  assert.ok(Tree.open(w.cwd, w.env).get<Input>(f.imported)!.retracted);
  const back = (await w.ok(["source", "restore", f.source, "--json"])).json;
  assert.deepEqual(back.restored, [f.source]);
  assert.equal(sourceNow(w, f.source).input, undefined);
  assert.equal(citing(w, f.source), cited);

  // K2.3: a file without a source deleted as the material is; its record stays, taken back
  const bareBytes = path.join(w.cwd, Tree.open(w.cwd, w.env).get<Input>(f.bare)!.file!);
  const gone = (await w.ok(["input", "delete", f.bare, "--json"], { dialog: true })).json;
  assert.deepEqual([gone.deleted, gone.retracted], [[f.bare], undefined]);
  assert.ok(!fs.existsSync(bareBytes));
  assert.ok(Tree.open(w.cwd, w.env).get<Input>(f.bare)!.retracted);
  w.cleanup();
});

test("R8: a source deleted first, its file deleted later — no longer held, the source loses its link to it; restored, it is without the file", opts, async () => {
  const f = await world();
  const { w } = f;
  await w.ok(["source", "retract", f.source, "--json"], { dialog: true });
  assert.equal(sourceNow(w, f.source).input, f.imported);
  const dry = (await w.ok(["input", "delete", f.imported, "--dry-run", "--json"])).json;
  assert.equal(dry.impacts[0].blockedBy, undefined);
  await w.ok(["input", "delete", f.imported, "--json"], { dialog: true });
  assert.equal(sourceNow(w, f.source).input, undefined);
  await w.ok(["source", "restore", f.source, "--json"]);
  const s = sourceNow(w, f.source);
  assert.deepEqual([s.retracted, s.input], [undefined, undefined]);
  w.cleanup();
});

for (const state of ["research", "archive"] as const)
  test(`K2.2 (${state}): the app's two steps over the file and its source — 409 material.source-live alone, one confirm over both, a change in between 409 with both lists`, opts, async () => {
    const f = await world(state);
    const { w } = f;
    w.env.STROM_LIVE_POLL_MS = "100";
    const info = (await w.ok(["live", "start", "--json"])).json;
    try {
      const status = json(await request("GET", `${info.url}/status`, undefined, app));
      for (const g of ["source.retract", "material.trees"]) assert.ok(status.features.includes(g), `${state}: ${g}`);
      const url = `${info.url}/material/delete`;
      const bytes = path.join(w.cwd, Tree.open(w.cwd, w.env).get<Input>(f.imported)!.file!);
      const head = gitHead(w.cwd);

      // the file alone: its dry run says what holds it, its confirmation refused
      const alone = json(await post(url, { files: [f.imported], dryRun: true }));
      assert.deepEqual([alone.impacts[0].blockedBy, alone.sourceImpacts, alone.retractSources], [[f.source], undefined, undefined]);
      const refused = await post(url, { files: [f.imported], confirm: alone.confirm });
      assert.deepEqual([refused.status, json(refused).code, json(refused).sources, json(refused).params.sources], [409, "material.source-live", [f.source], f.source]);

      // bodies refused before anything: not a list, a source not of the file, one unknown
      for (const bad of [{ retractSources: "S0001" }, { retractSources: Array(51).fill(f.source) }, { retractSources: [f.source, 7] }]) {
        const r = await post(url, { files: [f.imported], dryRun: true, ...bad });
        assert.deepEqual([r.status, json(r).code], [400, "material.body"], JSON.stringify(bad).slice(0, 60));
      }
      const notOf = await post(url, { files: [f.bare], retractSources: [f.source], dryRun: true });
      assert.deepEqual([notOf.status, json(notOf).code], [400, "material.body"]);

      // with the source: impacts and sourceImpacts, one confirm; the file-alone confirm does not hold for both
      const dry = json(await post(url, { files: [f.imported], retractSources: [f.source], dryRun: true }));
      assert.deepEqual([dry.files, dry.retractSources, dry.dryRun, dry.sourceImpacts[0].id], [[f.imported], [f.source], true, f.source]);
      assert.ok(dry.sourceImpacts[0].files.includes(f.imported));
      assert.ok(dry.sourceImpacts[0].counts.names + dry.sourceImpacts[0].counts.events > 0, JSON.stringify(dry.sourceImpacts[0].counts));
      const mixed = await post(url, { files: [f.imported], retractSources: [f.source], confirm: alone.confirm });
      assert.deepEqual([mixed.status, json(mixed).code], [400, "material.body"]);
      assert.equal(gitHead(w.cwd), head);

      // the research changed since (the source cited once more): 409 with both lists now
      const p = Tree.open(w.cwd, w.env).list<Person>("person")[0]!.id;
      await w.ok(["event", "add", p, "DEAT", "--date", "1920", "--place", "Lhota", "--cite", f.source]);
      const changed = await post(url, { files: [f.imported], retractSources: [f.source], confirm: dry.confirm });
      assert.deepEqual([changed.status, json(changed).code], [409, "material.delete-changed"]);
      assert.equal(json(changed).sourceImpacts[0].id, f.source);
      assert.ok(json(changed).sourceImpacts[0].counts.events > dry.sourceImpacts[0].counts.events);
      assert.ok(fs.existsSync(bytes));

      // seen again and confirmed: both, one commit
      const again = json(await post(url, { files: [f.imported], retractSources: [f.source], dryRun: true }));
      const before = gitHead(w.cwd);
      const del = await post(url, { files: [f.imported], retractSources: [f.source], confirm: again.confirm });
      assert.equal(del.status, 200, del.body.toString());
      const got = json(del);
      assert.deepEqual([got.files, got.deleted, got.retracted, got.impacts, got.sourceImpacts], [[f.imported], [f.imported], [f.source], again.impacts, again.sourceImpacts]);
      assert.match(got.head, /^[0-9a-f]{7,}$/u);
      assert.equal(execFileSync("git", ["-C", w.cwd, "rev-list", "--count", `${before}..HEAD`], { encoding: "utf8" }).trim(), "1");
      assert.ok(!fs.existsSync(bytes));
      assert.ok(sourceNow(w, f.source).deleted);
      assert.deepEqual(
        (json(await request("GET", `${info.url}/material?trees=1`)).files as { id: string }[]).map((x) => x.id),
        [f.bare],
      );
      // the same again: the file is none any more; the source deleted already
      const twice = await post(url, { files: [f.imported], retractSources: [f.source], dryRun: true });
      assert.equal(twice.status, 404);
      const deleted = await post(url, { files: [f.bare], retractSources: [f.source], dryRun: true });
      assert.equal(deleted.status, 400);

      // a file without a source: as the material (K2.3)
      const bare = json(await post(url, { files: [f.bare], dryRun: true }));
      assert.equal(bare.impacts[0].blockedBy, undefined);
      const bareDel = json(await post(url, { files: [f.bare], confirm: bare.confirm }));
      assert.deepEqual([bareDel.deleted, bareDel.retracted, bareDel.sourceImpacts], [[f.bare], undefined, undefined]);
    } finally {
      await w.ok(["live", "stop"]);
    }
    w.cleanup();
  });
