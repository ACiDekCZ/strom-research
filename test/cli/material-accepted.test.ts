// A proposal of a sort taken over is a file done (spec 147 K1): a file whose last sort done proposed a title, kind,
// date or people, and that has them now as proposed — a proposal of no person too — is left (why accepted), counted as
// the material is read, nothing written; one whose proposed person it lacks is not. What the person decided of a
// proposal in the Strom app (K2, POST /material/sort/<id>/decided: accepted as changed, refused, open again) is kept in
// the sort's record and leaves the file too. A later sort proposing something of it takes it off. On a real reader's
// report (test/fixtures/sort). Made-up names only (Lhoták, Lhota).

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { World, hasGit } from "../helpers.ts";
import { Tree } from "../../src/core/tree.ts";
import { material } from "../../src/core/material.ts";
import type { Input } from "../../src/core/model.ts";
import { APP_SORT_FROM, keptProposals, loadSort, parseSortReport, saveSort, signSort, unproposedOf, type SortState } from "../../src/core/sort.ts";

const opts = { skip: !hasGit };
const report = fs.readFileSync(path.join(import.meta.dirname, "..", "fixtures", "sort", "lhotakovi-four-files.md"), "utf8");
const FILES = ["I0001", "I0002", "I0003", "I0004"];

/** Václav Lhoták (P1), Eva (P2), their daughter Anna (P3), her husband Josef (P4), Anna and Josef (F2); the four files of the report. */
async function setUp(): Promise<World> {
  const w = new World();
  await w.withTree("Lhotákovi");
  await w.ok(["lang", "cs"]);
  await w.ok(["person", "add", "Václav /Lhoták/", "--sex", "M", "--born", "1890"]);
  await w.ok(["person", "add", "Eva /Lhotáková/".normalize("NFD"), "--sex", "F", "--born", "1893"]);
  await w.ok(["family", "add", "--partner", "P1", "--partner", "P2"]);
  await w.ok(["person", "add", "Anna /Lhotová/", "--sex", "F", "--born", "1920"]);
  await w.ok(["person", "add", "Josef /Lhota/", "--sex", "M", "--born", "1915"]);
  await w.ok(["family", "add", "--partner", "P4", "--partner", "P3"]);
  const box = path.join(w.dir, "krabice z Лготы");
  fs.mkdirSync(box);
  const names = ["parte.txt", "svatba.txt", "rub.txt", "dopis.txt"];
  names.forEach((n, k) => fs.writeFileSync(path.join(box, n), `Soubor ${k + 1} z Lhoty.\n`));
  const got = (await w.ok(["intake", ...names.map((n) => path.join(box, n)), "--json"])).json as { inputs: { id: string }[] };
  assert.deepEqual(got.inputs.map((i) => i.id), FILES);
  return w;
}

/** A sort done of the files, its proposals the reader's report as strom keeps them. */
function sortDone(w: World, id: string, at: string, o: { app?: boolean; raw?: string } = {}): SortState {
  const tree = Tree.open(w.cwd, w.env);
  const raw = parseSortReport(o.raw ?? report);
  const kept = keptProposals(tree, FILES, raw);
  const unproposed = unproposedOf(FILES, raw, kept, []);
  const s: SortState = { id, state: "done", files: FILES, text: "Krabice z Lhoty", lang: "cs", at, since: at, proposals: kept.proposals, ...(kept.dropped.length ? { dropped: kept.dropped } : {}), ...(unproposed.length ? { unproposed } : {}), filesDone: 4, ...(o.app ? { from: APP_SORT_FROM } : {}) };
  if (o.app) s.sign = signSort(tree.key!, s);
  saveSort(w.cwd, s);
  return s;
}

const leftNow = (w: World) => Object.fromEntries(material(Tree.open(w.cwd, w.env), undefined).files.filter((f) => f.left).map((f) => [f.id, f.left!.why]));

test("a proposal taken over is a file done: left accepted as the material is read — one of no person too; a person proposed and not on the file, not; a later proposal takes it off", opts, async () => {
  const w = await setUp();
  try {
    const s = sortDone(w, "sort-20261127100000-aaaa", "2026-11-27T10:00:00.000Z");
    const p = (id: string) => s.proposals!.find((x) => x.id === id)!;
    assert.deepEqual(leftNow(w), {}, "nothing taken yet: all four offered again");

    // the back of the wedding photo: its title, date and kind, no person proposed (a couple only)
    assert.ok(!(p("I0003").links ?? []).some((l) => l.type === "person"));
    await w.ok(["input", "edit", "I0003", `--title=${p("I0003").title}`, `--kind=${p("I0003").kind}`, `--date=${p("I0003").date}`]);
    assert.deepEqual(leftNow(w), { I0003: "accepted" });

    // the undertaker's notice: its title, date and kind taken, Václav (proposed) not yet on it — offered again
    await w.ok(["input", "edit", "I0001", `--title=${p("I0001").title}`, `--kind=${p("I0001").kind}`, `--date=${p("I0001").date}`]);
    assert.deepEqual(leftNow(w), { I0003: "accepted" }, "a person proposed and not on the file: not taken over");
    await w.ok(["input", "assign", "I0001", "--add", "P1"]);
    assert.deepEqual(leftNow(w), { I0001: "accepted", I0003: "accepted" });

    // the letter: its title changed as it was taken — not the same as proposed (the person says it in the app, K2)
    await w.ok(["input", "edit", "I0004", "--title=Dopis Evy sestře Marii z Лготы", `--kind=${p("I0004").kind}`, `--date=${p("I0004").date}`]);
    await w.ok(["input", "assign", "I0004", "--add", "P2"]);
    assert.deepEqual(leftNow(w), { I0001: "accepted", I0003: "accepted" });
    // nothing written to the research by it
    assert.equal(Tree.open(w.cwd, w.env).get<Input>("I0003")!.sorted, undefined);

    // a later sort proposing something new of the back: no more left until that is taken; the notice it proposes
    // nothing new of (all there, its event unknown and left out): left as dropped
    sortDone(w, "sort-20261127110000-bbbb", "2026-11-27T11:00:00.000Z", { raw: report.replace("title: Rub svatební fotky Anny a Josefa Lhotových, 1942", "title: Rub fotky ze svatby v Lhotě") });
    assert.deepEqual(leftNow(w), { I0001: "dropped" });
  } finally {
    w.cleanup();
  }
});

function request(method: string, url: string, body?: unknown): Promise<{ status: number; json: any }> {
  return new Promise((resolve, reject) => {
    const data = body === undefined ? undefined : Buffer.from(JSON.stringify(body));
    const req = http.request(url, { method, headers: { Origin: "https://beta.stromapp.info", ...(data ? { "Content-Type": "application/json", "Content-Length": String(data.length) } : {}) } }, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (d: Buffer) => chunks.push(d));
      res.on("end", () => resolve({ status: res.statusCode ?? 0, json: JSON.parse(Buffer.concat(chunks).toString("utf8") || "null") }));
    });
    req.on("error", reject);
    req.end(data);
  });
}

test("what the person decided of a proposal in the Strom app (K2): refused or accepted as changed kept in the sort's record, the file left so; open again, offered again", { skip: !hasGit || process.platform === "win32" }, async () => {
  const w = await setUp();
  try {
    const s = sortDone(w, "sort-20261127100000-cccc", "2026-11-27T10:00:00.000Z", { app: true });
    await w.ok(["live", "start", "--json"]);
    const url = (JSON.parse(fs.readFileSync(path.join(w.cwd, ".strom", "live.json"), "utf8")) as { url: string }).url;
    try {
      const status = (await request("GET", `${url}/status`)).json as { features: string[] };
      assert.ok(status.features.includes("material.accepted"), "material.accepted said");

      const refused = await request("POST", `${url}/material/sort/${s.id}/decided`, { ids: ["I0002"], how: "refused" });
      assert.equal(refused.status, 200, JSON.stringify(refused.json));
      assert.deepEqual(refused.json.decided.map((d: { id: string; how: string }) => [d.id, d.how]), [["I0002", "refused"]]);
      const accepted = await request("POST", `${url}/material/sort/${s.id}/decided`, { ids: ["I0004", "I0004"], how: "accepted" });
      assert.equal(accepted.status, 200);
      const listed = (await request("GET", `${url}/material`)).json as { files: { id: string; left?: { why: string; sort: string } }[] };
      assert.deepEqual(listed.files.filter((f) => f.left).map((f) => [f.id, f.left!.why, f.left!.sort]), [["I0002", "refused", s.id], ["I0004", "accepted", s.id]]);
      assert.deepEqual((await request("GET", `${url}/material/sort/${s.id}`)).json.decided.map((d: { id: string }) => d.id), ["I0002", "I0004"]);

      // open again: offered again; the sort's own record keeps its signature good
      assert.equal((await request("POST", `${url}/material/sort/${s.id}/decided`, { ids: ["I0002"], how: "open" })).status, 200);
      assert.deepEqual(leftNow(w), { I0004: "accepted" });
      assert.equal((await request("GET", `${url}/material/sort/${s.id}`)).status, 200);
      assert.deepEqual(loadSort(w.cwd, s.id)!.decided!.map((d) => d.id), ["I0004"]);

      // refused: a file not of the sort, another how, no ids, an unknown sort, no app
      assert.equal((await request("POST", `${url}/material/sort/${s.id}/decided`, { ids: ["I0099"], how: "refused" })).json.code, "material.body");
      assert.equal((await request("POST", `${url}/material/sort/${s.id}/decided`, { ids: ["I0001"], how: "maybe" })).status, 400);
      assert.equal((await request("POST", `${url}/material/sort/${s.id}/decided`, { how: "refused" })).status, 400);
      assert.equal((await request("POST", `${url}/material/sort/sort-20261127100000-dddd/decided`, { ids: ["I0001"], how: "refused" })).status, 404);
      const queued = { ...s, id: "sort-20261127120000-eeee", state: "queued" as const, at: "2026-11-27T12:00:00.000Z", since: "2026-11-27T12:00:00.000Z", proposals: undefined };
      saveSort(w.cwd, { ...queued, sign: signSort(Tree.open(w.cwd, w.env).key!, queued) });
      const early = await request("POST", `${url}/material/sort/${queued.id}/decided`, { ids: ["I0001"], how: "refused" });
      assert.deepEqual([early.status, early.json.code], [409, "sort.state"]);
    } finally {
      await w.run(["live", "stop"]);
    }
  } finally {
    w.cleanup();
  }
});
