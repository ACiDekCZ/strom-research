// The houses through the bridge (spec 030 part 1, §4.2): the features, /status houses {on, rev, counts}, GET /houses and
// GET /houses/<key|A…> (the key URL-encoded, | as %7C), POST /houses/confirm and /houses/material (the person's in the
// app: no window), the field house of POST /batch/<id>/done, the task kind house (queueCounts.kind, GET /queue?kind=house,
// known=house, the queue's row with its house's key), an archive (reads, its writes 409, nothing of a research), and the
// link house?do=import (the path asked in the terminal, then strom house import). Synthetic data only (made-up names).

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import { fileURLToPath } from "node:url";
import { World, hasGit } from "../helpers.ts";
import { Tree, now } from "../../src/core/tree.ts";
import { forHouse } from "../../src/core/houses.ts";
import { taskKind } from "../../src/core/taskkind.ts";
import { LinkError, parseLink } from "../../src/core/links.ts";
import type { House, Input, Task } from "../../src/core/model.ts";

const opts = { skip: !hasGit || process.platform === "win32", timeout: 240_000 };
const APP = "https://beta.stromapp.info";
const AGENT = { env: { CLAUDECODE: "1" } };
const HERE = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = path.join(HERE, "..", "fixtures", "houses", "research");
const IMAGES = path.join(HERE, "..", "fixtures", "images");
const AI = /agent|\bAI\b|umělá inteligence|Claude|Codex|OpenCode|Grok|Antigravity|\bmodel/i;

type Answer = { status: number; body: any };
function request(url: string, method = "GET", body?: unknown): Promise<Answer> {
  return new Promise((resolve, reject) => {
    const data = body === undefined ? undefined : Buffer.from(typeof body === "string" ? body : JSON.stringify(body), "utf8");
    const req = http.request(url, { agent: false, method, headers: { Origin: APP, ...(data ? { "Content-Type": "text/plain;charset=UTF-8", "Content-Length": String(data.length) } : {}) } }, (res) => {
      let text = "";
      res.setEncoding("utf8");
      res.on("data", (d) => (text += d));
      res.on("end", () => {
        let parsed: any = text;
        try {
          parsed = JSON.parse(text);
        } catch {
          // not JSON
        }
        resolve({ status: res.statusCode ?? 0, body: parsed });
      });
    });
    req.on("error", reject);
    if (data) req.write(data);
    req.end();
  });
}

const open = (w: World) => Tree.open(w.cwd, w.env);

/**
 * The Lhotáks and the Prouzals: Lhota (L0001) with houses no. 9, 12 and 30, Bělokamen (L0002) with no. 16; the research
 * of the person's own (test/fixtures/houses) taken in — a record and a takeover task for 9, 12 and 16; 30 only of the
 * tree's facts.
 */
async function village(w: World): Promise<void> {
  await w.withTree("Lhotákovi");
  await w.ok(["place", "add", "Lhota", "--kind", "village"]); // L0001
  await w.ok(["place", "add", "Bělokamen", "--kind", "village"]); // L0002
  const person = async (name: string) => (await w.ok(["person", "add", name, "--json"])).json.person.id as string;
  const kapradin = await person("Kapradin /Lhoták/");
  const mlhoslav = await person("Mlhoslav /Lhoták/");
  const hromoslav = await person("Hromoslav /Prouzal/");
  const fact = async (who: string, kind: string, date: string, place: string, house: string) => w.ok(["event", "add", who, kind, "--date", date, "--place", place, "--house", house]);
  await fact(kapradin, "RESI", "1850", "Lhota", "9");
  await fact(mlhoslav, "BIRT", "1872", "Lhota", "12");
  await fact(hromoslav, "BIRT", "1781", "Bělokamen", "16");
  await fact(mlhoslav, "RESI", "1900", "Lhota", "30");
}

async function taken(w: World): Promise<void> {
  const dir = path.join(w.dir, "Rešerše domů");
  fs.cpSync(FIXTURES, dir, { recursive: true });
  await w.ok(["house", "import", dir, "--json"], AGENT);
}

test("the bridge's houses: status, the list and one house, the kind house in the queue, the person's confirm and material, a batch for a house", opts, async () => {
  const w = new World();
  await village(w);
  await taken(w);
  const info = (await w.ok(["live", "start", "--json"])).json as { url: string };
  const url = info.url;
  try {
    // /status: the features, houses always there — on false, counted by state, the fingerprint
    let status = (await request(`${url}/status?app=3.28.0`)).body;
    for (const f of ["house", "house.material", "house.confirm", "house.import"]) assert.ok(status.features.includes(f), f);
    assert.equal(status.houses.on, false);
    assert.deepEqual(status.houses.counts, { done: 0, running: 0, queued: 3, waiting: 0, held: 0 });
    assert.match(status.houses.rev, /^[0-9a-f]{16}$/u);
    // the kind house: counted apart, each row of a house's task with its key
    assert.equal(status.queueCounts.kind.house, 3, JSON.stringify(status.queueCounts));
    const rows = (status.queue as { taskKind: string; house?: string }[]).filter((q) => q.taskKind === "house");
    assert.deepEqual(rows.map((q) => q.house).sort(), ["belokamen|16", "lhota|12", "lhota|9"]);
    const kind = (await request(`${url}/queue?kind=house`)).body;
    assert.equal(kind.total, 3);
    assert.ok((kind.items as { house?: string }[]).every((q) => typeof q.house === "string"));
    // an older app: under other; one that knows the kind: not there
    const other = (await request(`${url}/queue?kind=other`)).body;
    assert.equal((other.items as { taskKind: string }[]).filter((q) => q.taskKind === "house").length, 3);
    const known = (await request(`${url}/queue?kind=other&known=house`)).body;
    assert.equal((known.items as { taskKind: string }[]).filter((q) => q.taskKind === "house").length, 0);
    for (const t of open(w).list<Task>("task").filter(forHouse)) assert.equal(taskKind(t), "house");

    // GET /houses: the research's houses (30, only of the facts, not), the same rev
    const list = (await request(`${url}/houses`)).body;
    assert.equal(list.rev, status.houses.rev);
    assert.deepEqual((list.houses as { key: string }[]).map((h) => h.key), ["belokamen|16", "lhota|9", "lhota|12"]);
    const b16 = (list.houses as Record<string, any>[])[0]!;
    assert.match(b16.id, /^A\d+$/u);
    assert.deepEqual(b16.place, { key: "belokamen", id: "L0002", name: "Bělokamen" });
    assert.deepEqual([b16.state, b16.work, typeof b16.task], ["queued", "takeover", "string"]);
    assert.equal(b16.summary.materials, 1);
    // one house whole: by its key (| as %7C) and by its A…; no recent, manual there, items with ids
    const one = await request(`${url}/houses/belokamen%7C16`);
    assert.equal(one.status, 200, JSON.stringify(one.body));
    assert.equal(one.body.id, b16.id);
    assert.equal(one.body.rev, list.rev);
    assert.ok(Array.isArray(one.body.manual) && Array.isArray(one.body.passed));
    assert.ok(!("recent" in one.body));
    assert.equal(one.body.materials[0].kind, "own-research");
    for (const p of one.body.passed as { id: string }[]) assert.match(p.id, /^p\d+$/u);
    assert.equal((await request(`${url}/houses/${b16.id}`)).body.key, "belokamen|16");
    // a house only of the tree's facts: whole too, nothing of it yet
    const only = (await request(`${url}/houses/lhota%7C30`)).body;
    assert.deepEqual([only.state, only.id, only.materials], ["none", undefined, []]);
    const none = await request(`${url}/houses/nowhere%7C1`);
    assert.deepEqual([none.status, none.body.code], [404, "house.unknown"]);

    // material: a memory (its witness named only with consent) and the name after a family — the person's
    const memory = await request(`${url}/houses/material`, "POST", { house: "lhota|9", memory: { text: "Děda vyprávěl, že stavení vyhořelo.", witness: "Teta Ozubka", witnessConsent: false }, name: "U Lhotáků" });
    assert.equal(memory.status, 200, JSON.stringify(memory.body));
    assert.equal(memory.body.house.name, "U Lhotáků");
    assert.equal(memory.body.house.nameBy, "user");
    const kept = (memory.body.house.materials as { id: string; kind: string }[]).find((m) => m.kind === "memory")!;
    assert.ok(kept, JSON.stringify(memory.body.house.materials));
    const input = open(w).get<Input>(kept.id)!;
    assert.deepEqual([input.text, input.from, input.witness], ["Děda vyprávěl, že stavení vyhořelo.", "user", undefined]);
    assert.notEqual(memory.body.house.rev, list.rev, "the fingerprint changed");
    assert.equal(open(w).list<Task>("task").filter(forHouse).length, 3, "no task of the material");
    const named = await request(`${url}/houses/material`, "POST", { house: "lhota|9", memory: { text: "Vzpomínka druhá.", witness: "Teta Ozubka", witnessConsent: true } });
    const second = (named.body.house.materials as { id: string; kind: string }[]).filter((m) => m.kind === "memory").at(-1)!;
    assert.equal(open(w).get<Input>(second.id)!.witness, "Teta Ozubka");
    // a house of the facts alone: its record made, then named (two commands, one answer)
    const made = await request(`${url}/houses/material`, "POST", { house: "lhota|30", memory: { text: "Na kopci." }, name: "Na Kopci" });
    assert.equal(made.status, 200, JSON.stringify(made.body));
    assert.match(made.body.house.id, /^A\d+$/u);
    assert.equal(made.body.house.name, "Na Kopci");
    // files of the research made the house's
    const files = await request(`${url}/houses/material`, "POST", { house: b16.id, files: [kept.id] });
    assert.ok((files.body.house.materials as { id: string }[]).some((m) => m.id === kept.id));
    for (const [body, code, why] of [
      [{ house: "lhota|9" }, 400, "house.body"],
      [{ house: 9, name: "X" }, 400, "house.body"],
      [{ house: "lhota|9", memory: { text: "" } }, 400, "house.body"],
      [{ house: "nowhere|1", name: "X" }, 404, "house.unknown"],
      [{ house: "lhota|9", files: ["I9999"] }, 404, "house.unknown"],
    ] as const) {
      const r = await request(`${url}/houses/material`, "POST", body);
      assert.deepEqual([r.status, r.body.code], [code, why], JSON.stringify([body, r.body]));
    }

    // confirm: the point of the house, the person's (no window); a house the research has no record of: nothing to confirm
    const point = await request(`${url}/houses/confirm`, "POST", { house: "belokamen|16", what: "location", lat: 49.61, lon: 15.12 });
    assert.equal(point.status, 200, JSON.stringify(point.body));
    assert.equal(point.body.house.location.lat, 49.61);
    assert.ok(point.body.house.location.confirmed);
    for (const [body, code, why] of [
      [{ house: "belokamen|16", what: "maybe" }, 400, "house.body"],
      [{ house: "belokamen|16", what: "location", lat: 49.6 }, 400, "house.body"],
      [{ house: "belokamen|16", what: "renumber", id: "n99" }, 400, "house.body"],
      [{ house: "nowhere|1", what: "location", lat: 1, lon: 1 }, 404, "house.unknown"],
    ] as const) {
      const r = await request(`${url}/houses/confirm`, "POST", body);
      assert.deepEqual([r.status, r.body.code], [code, why], JSON.stringify([body, r.body]));
    }
    await w.ok(["event", "add", "P0001", "RESI", "--date", "1910", "--place", "Lhota", "--house", "31"]);
    const bare = await request(`${url}/houses/confirm`, "POST", { house: "lhota|31", what: "location", lat: 1, lon: 1 });
    assert.deepEqual([bare.status, bare.body.code], [404, "house.unknown"]);
    // the confirm is the person's: an agent is refused at the command
    assert.notEqual((await w.run(["house", "confirm", "A0001", "location"], { env: { CLAUDECODE: "1", STROM_FOR_APP: "1" } })).code, 0);

    // a batch for a house: its files the house's material, no sorting task; an unknown house: the batch stays open
    const photo = path.join(w.dir, "stavení.jpg");
    fs.copyFileSync(path.join(IMAGES, "s0001.jpg"), photo);
    const B = "4a1b2c3d-5e6f-4a7b";
    const sent = (await w.ok(["media", "original", photo, "--batch", B, "--path", "Dům/stavení.jpg", "--json"])).json.input as string;
    const unknown = await request(`${url}/batch/${B}/done`, "POST", { house: "nowhere|1" });
    assert.deepEqual([unknown.status, unknown.body.code, unknown.body.batch], [404, "house.unknown", B]);
    const done = await request(`${url}/batch/${B}/done`, "POST", { house: "belokamen|16" });
    assert.equal(done.status, 200, JSON.stringify(done.body));
    assert.equal(done.body.house, b16.id);
    assert.deepEqual(done.body.tasks, []);
    assert.deepEqual(open(w).get<Input>(sent)!.houses, [b16.id]);
    const after = (await request(`${url}/houses/belokamen%7C16`)).body;
    assert.ok((after.materials as { id: string; kind: string }[]).some((m) => m.id === sent && m.kind === "file"));

    // the research held by another strom: never read half written (a write waits for it as the terminal's does)
    const lock = path.join(w.cwd, ".strom", "tree.lock");
    fs.writeFileSync(lock, JSON.stringify({ pid: process.pid, host: os.hostname(), at: now(), owner: "a test" }));
    try {
      const busy = await request(`${url}/houses`);
      assert.deepEqual([busy.status, busy.body.code], [503, "research.busy"]);
      assert.equal((await request(`${url}/houses/lhota%7C9`)).status, 503);
    } finally {
      fs.rmSync(lock, { force: true });
    }
    status = (await request(`${url}/status?app=3.28.0`)).body;
    assert.equal(status.houses.rev, (await request(`${url}/houses`)).body.rev);
  } finally {
    await w.run(["live", "stop"]);
  }
  w.cleanup();
});

test("an archive's houses: read, nothing of a research or an agent, every write 409 house.archive, the import link refused", opts, async () => {
  const w = new World();
  await village(w);
  await taken(w);
  await w.ok(["mode", "archive"], { tty: true });
  const url = ((await w.ok(["live", "start", "--json"])).json as { url: string }).url;
  try {
    const status = (await request(`${url}/status?app=3.28.0`)).body;
    assert.ok(status.features.includes("house") && status.features.includes("house.material"));
    assert.ok(!status.features.includes("house.import"), "the takeover is the agent's");
    assert.equal(status.houses.on, false);
    assert.deepEqual(status.houses.counts, { done: 0, running: 0, queued: 0, waiting: 0, held: 0 });
    const list = await request(`${url}/houses`);
    assert.equal(list.status, 200);
    assert.equal(list.body.houses.length, 3, "the houses with their material");
    for (const h of list.body.houses as Record<string, unknown>[]) assert.deepEqual([h.state, h.task, h.work, h.question], ["none", undefined, undefined, undefined]);
    const one = await request(`${url}/houses/lhota%7C9`);
    assert.equal(one.status, 200);
    assert.equal(one.body.state, "none");
    assert.doesNotMatch(JSON.stringify([list.body, one.body, status.houses]), AI);
    for (const [route, body] of [
      ["houses/confirm", { house: "lhota|9", what: "location", lat: 1, lon: 1 }],
      ["houses/material", { house: "lhota|9", name: "U Lhotáků" }],
    ] as const) {
      const r = await request(`${url}/${route}`, "POST", body);
      assert.deepEqual([r.status, r.body.code, r.body.reasonCode], [409, "house.archive", "archive"], JSON.stringify(r.body));
      assert.doesNotMatch(JSON.stringify(r.body), AI);
    }
    const photo = path.join(w.dir, "stavení.jpg");
    fs.copyFileSync(path.join(IMAGES, "s0001.jpg"), photo);
    const B = "5b1b2c3d-5e6f-4a7b";
    await w.ok(["media", "original", photo, "--batch", B, "--path", "stavení.jpg"]);
    const batch = await request(`${url}/batch/${B}/done`, "POST", { house: "lhota|9" });
    assert.deepEqual([batch.status, batch.body.code], [409, "house.archive"]);
    assert.equal(open(w).list<House>("house").find((h) => h.house === "9")!.name, undefined, "nothing written");
  } finally {
    await w.run(["live", "stop"]);
  }
  const id = open(w).config.id;
  const link = await w.run(["link", "open", `strom-research://house?tree=${id}&do=import`], { tty: true, answers: [""] });
  assert.doesNotMatch(link.out, AI, link.out);
  assert.equal(open(w).list<Input>("input").length, 3, "nothing taken in");
  w.cleanup();
});

test("the link house?do=import: only do=import; the path asked in the terminal, then strom house import; Enter takes nothing", opts, async () => {
  const T = "0f6e1c2a-3b4d-4e5f-8a9b-0c1d2e3f4a5b";
  assert.deepEqual(parseLink(`strom-research://house?tree=${T}&do=import`), { action: "house", tree: T, do: "import" });
  assert.throws(() => parseLink(`strom-research://house?tree=${T}&do=delete`), LinkError);
  assert.throws(() => parseLink(`strom-research://house?tree=${T}`), LinkError);
  const w = new World();
  await village(w);
  await w.ok(["lang", "cs"]);
  const id = open(w).config.id;
  const link = `strom-research://house?tree=${id}&do=import`;
  // Enter at the path: nothing taken in
  const back = await w.run(["link", "open", link], { tty: true, answers: ["", ""] });
  assert.equal(back.code, 0, back.err);
  assert.match(back.out, /převzít vlastní rešerši domu/u, back.out);
  assert.equal(open(w).list<Input>("input").length, 0);
  // a file dragged in (quoted, a name with diacritics and spaces): taken in, its house's takeover task
  const file = path.join(w.dir, "Bělokamen čp. 16.md");
  fs.copyFileSync(path.join(FIXTURES, "Bělokamen čp. 16.md"), file);
  const r = await w.run(["link", "open", link], { tty: true, answers: [`'${file}'`, ""] });
  assert.equal(r.code, 0, r.out + r.err);
  const tree = open(w);
  const house = tree.list<House>("house").find((h) => h.house === "16")!;
  assert.ok(house, r.out);
  assert.deepEqual(tree.list<Input>("input").map((i) => [i.ownResearch, i.houses]), [[true, [house.id]]]);
  assert.equal(tree.list<Task>("task").filter((t) => forHouse(t)).length, 1);
  w.cleanup();
});
