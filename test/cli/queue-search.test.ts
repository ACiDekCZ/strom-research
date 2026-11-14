// Searching the queue from the Strom app (spec 052 U2; the app's ZADANI_VYZKUM_hledani-ve-fronte.md, section 2):
// GET /queue?q= finds in the whole queue — not only in /status's window — the tasks that hold every word, with any
// accent or none, in the task's text, its people's names (a married name too), its record sets (title, call number,
// archive, places), its ID and its people's; a task number finds that task first (one out of the queue is said apart),
// a person's number the tasks about them. In the order of the queue, after the filters, paged. Without q the answer is
// as it was; what was searched is never written. Made-up names only (Lhoták, Lhota); any script, any accent.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { World, hasGit } from "../helpers.ts";
import { Tree } from "../../src/core/tree.ts";
import { Settings } from "../../src/core/config.ts";
import { masked, queueAsk, queuePage, type QueueAsk } from "../../src/core/live.ts";
import type { Task } from "../../src/core/model.ts";

const skip = !hasGit || process.platform === "win32";
const opts = { skip, timeout: 240_000 };
const APP = "https://beta.stromapp.info";

function get(url: string): Promise<{ status: number; body: any; text: string }> {
  return new Promise((resolve, reject) => {
    http
      .get(url, { agent: false, headers: { Origin: APP } }, (res) => {
        let text = "";
        res.setEncoding("utf8");
        res.on("data", (d) => (text += d));
        res.on("end", () => resolve({ status: res.statusCode ?? 0, body: JSON.parse(text), text }));
      })
      .on("error", reject);
  });
}

type Item = { id: string; text: string; state: string; pos?: number; branch?: string; research?: string; person?: string };

/**
 * Two lines: the ancestors of Jan Lhoták (G0001) and of Marie (G0002). Josef's mother Łucja (P9); his sister Anna (P4),
 * married Großlhotová, her husband Karel (P6) and their daughters Žofie (P7, written decomposed) and Жофия (P8): the
 * branch B-P0004. A record set of an archive with a call number and its places (B0001).
 */
async function world(): Promise<World> {
  const w = new World();
  await w.withTree("Lhotákovi");
  await w.ok(["lang", "cs"]);
  await w.ok(["research", "new", "Předci Jana", "--new-person", "Jan /Lhoták/", "--sex", "M"]);
  await w.ok(["person", "add", "Josef /Lhoták/", "--sex", "M"]); // P2
  await w.ok(["person", "add", "Marie /Lhotová/", "--sex", "F"]); // P3
  await w.ok(["person", "add", "Anna /Lhotáková/", "--sex", "F"]); // P4
  await w.ok(["name", "add", "P4", "Anna /Großlhotová/", "--kind", "married"]);
  await w.ok(["person", "add", "Václav /Lhoták/", "--sex", "M"]); // P5
  await w.ok(["person", "add", "Karel /Lhotský/", "--sex", "M"]); // P6
  await w.ok(["person", "add", "Žofie /Lhotská/".normalize("NFD"), "--sex", "F"]); // P7
  await w.ok(["person", "add", "Жофия /Лгота/", "--sex", "F"]); // P8
  await w.ok(["person", "add", "Łucja /Lhotecka/", "--sex", "F"]); // P9
  await w.ok(["family", "add", "--partner", "P2", "--partner", "P3", "--child", "P1"]);
  await w.ok(["family", "add", "--partner", "P5", "--partner", "P9", "--child", "P2", "--child", "P4"]);
  await w.ok(["family", "add", "--partner", "P4", "--partner", "P6", "--child", "P7", "--child", "P8"]);
  await w.ok(["research", "new", "Předci Marie", "--person", "P3"]);
  await w.ok(["repo", "add", "Oblastní archiv v Lhotě"]); // R0001
  await w.ok(["recordset", "add", "Lhota N 1784–1820", "--repo", "R0001", "--call-number", "Sig. 159-17", "--places", "Horní Lhota,Lhotka", "--kinds", "baptism"]); // B0001
  return w;
}

/**
 * The queue (written at once, as a research grows to it): T0001 about Josef in B0001; 299 of Jan's line (every tenth
 * in B0001); 30 of Marie's (the lowest priority); 6 of the branch; Łucja's death; a task naming the number 123 in its
 * text. T0002, T0004, T0006 put aside; T0005 done.
 */
async function queued(w: World): Promise<void> {
  await w.ok(["task", "add", "Křest Josefa", "--level", "locate", "--where", "B1", "--why", "rodiče", "--done-when", "kniha nalezena", "--about", "P2", "--priority", "5"]);
  const tree = Tree.open(w.cwd, w.env);
  const model = tree.get<Task>("T0001")!;
  const { research: _none, ...plain } = model;
  const made: Task[] = [];
  const add = (what: string, about: string, priority: number, where = ["katalog"]) => made.push({ ...plain, id: tree.allocate("T"), what, subject: [about], priority, where });
  tree.withTreeLock(() => {
    for (let i = 1; i < 300; i++) add(`Matrika ${i}`, i % 2 ? "P0001" : "P0002", 5, i % 10 ? ["katalog"] : ["B0001"]);
    for (let i = 1; i <= 30; i++) add(`Původ Marie ${i}`, "P0003", 1);
    for (const [i, about] of ["P0004", "P0007", "P0008", "P0004", "P0007", "P0008"].entries()) add(`${["Oddavky Anny", "Křest Žofie".normalize("NFD"), "Křest Жофии"][i % 3]} ${i + 1}`, about, 3);
    add("Úmrtí Łucji", "P0009", 4);
    add("Dům č. 123 v Lhotě", "P0002", 4);
    tree.putMany(made, [], { op: "task.add", targets: made.map((t) => t.id), summary: `${made.length} tasks` });
  });
  tree.commit("tasks");
  for (const id of ["T0002", "T0004", "T0006"]) await w.ok(["task", "park", id, "--reason", "později"]);
  const done = Tree.open(w.cwd, w.env);
  done.withTreeLock(() => {
    const t = done.get<Task>("T0005")!;
    done.putMany([{ ...t, state: "done", result: "nalezeno" }], [], { op: "task.done", targets: [t.id], summary: `${t.id} done` });
  });
  done.commit("T0005 done");
}

/** Every page of a query, joined. */
async function pages(url: string, query: string, count = 50): Promise<{ items: Item[]; total: number; sizes: number[]; last: any }> {
  const items: Item[] = [];
  const sizes: number[] = [];
  let from: number | undefined = 0;
  let total = -1;
  let last: any;
  while (from !== undefined) {
    const r = await get(`${url}/queue?${query}${query ? "&" : ""}from=${from}&count=${count}`);
    assert.equal(r.status, 200, JSON.stringify(r.body));
    if (total >= 0) assert.equal(r.body.total, total, "the same total on every page");
    total = r.body.total;
    items.push(...r.body.items);
    sizes.push(r.body.items.length);
    from = r.body.next;
    last = r.body;
  }
  return { items, total, sizes, last };
}

const q = (s: string) => `q=${encodeURIComponent(s)}`;

test("bridge: GET /queue?q= — a task number beyond 300, done (elsewhere), a person's number, names with and without accents, ł and ß, Cyrillic, several words, archive, call number, place; with the filters; paged; 400; without q as before; q never in the log", opts, async () => {
  const w = await world();
  try {
    await queued(w);
    const url = ((await w.ok(["live", "start", "--json"])).json as { url: string }).url;
    const s = (await get(`${url}/status?app=3.24.0`)).body;
    assert.ok(s.features.includes("queue.search"));

    // without q: as before, byte for byte the same before and after a search
    const plain = await get(`${url}/queue?from=0&count=50`);
    assert.deepEqual(Object.keys(plain.body), ["items", "total", "from", "next", "rev", "head"]);
    const whole = await pages(url, "", 100);
    const next = whole.items.filter((x) => x.state === "next");
    assert.equal(whole.total, 337, "338 tasks, T0005 done");

    // a task number far behind the window and the app's 300 rows: that task first, its place said, found by its number
    const far = next[305]!;
    assert.equal(far.pos, 306);
    for (const typed of [far.id, far.id.toLowerCase(), String(Number(far.id.slice(1))), `T00${far.id.slice(1)}`]) {
      const r = await get(`${url}/queue?${q(typed)}`);
      assert.equal(r.status, 200, typed);
      assert.deepEqual([r.body.items[0].id, r.body.items[0].pos, r.body.match], [far.id, 306, { [far.id]: "id" }], typed);
      assert.equal(r.body.q, typed);
      assert.equal(r.body.elsewhere, undefined);
      assert.deepEqual(r.body.items[0], far, "the same row as the queue's page");
    }
    // 123: T0123 first, then the texts holding the number in the order of the queue (never a task by its ID alone)
    const n = await pages(url, q(" 123 "));
    assert.equal(n.last.q, "123", "trimmed");
    assert.equal(n.items[0]!.id, "T0123");
    assert.ok(n.items.slice(1).length >= 2);
    assert.ok(n.items.slice(1).every((x) => x.text.includes("123")), JSON.stringify(n.items.map((x) => x.text)));
    assert.ok(n.items.some((x) => x.text === "Dům č. 123 v Lhotě"));
    const at = new Map(whole.items.map((x, i) => [x.id, i]));
    const rest = n.items.slice(1).map((x) => at.get(x.id)!);
    assert.deepEqual(rest, [...rest].sort((a, b) => a - b), "in the order of the queue");
    assert.deepEqual((await get(`${url}/queue?${q("123")}`)).body.match, { T0123: "id" }, "the text's rows: no match");
    // done: out of the queue — said apart; the texts with the number still found
    const done = await get(`${url}/queue?${q("t5")}`);
    assert.deepEqual(done.body.elsewhere, { id: "T0005", state: "done" });
    assert.ok(!done.body.items.some((x: Item) => x.id === "T0005"));
    assert.equal(done.body.match, undefined);
    // put aside: in the queue, after it
    const aside = await get(`${url}/queue?${q("T0004")}`);
    assert.deepEqual([aside.body.items[0].id, aside.body.items[0].state, aside.body.items[0].pos, aside.body.elsewhere], ["T0004", "parked", undefined, undefined]);
    // no such task: nothing said apart
    const none = await get(`${url}/queue?${q("T9999")}`);
    assert.deepEqual([none.body.items, none.body.total, none.body.elsewhere], [[], 0, undefined]);

    // a person's number: the tasks about them, by the person, never by text
    for (const typed of ["P4", "p0004", "P04"]) {
      const r = await get(`${url}/queue?${q(typed)}`);
      assert.deepEqual(r.body.items.map((x: Item) => x.text).sort(), ["Oddavky Anny 1", "Oddavky Anny 4"], typed);
      assert.deepEqual(Object.values(r.body.match), ["person", "person"]);
    }

    // a name: with accents, without, decomposed; the married name with ß written either way; ł; Cyrillic
    const anna = ["Oddavky Anny 1", "Oddavky Anny 4"];
    for (const typed of ["Lhotáková", "lhotakova", "LHOTÁKOVÁ".normalize("NFD"), "Großlhotová", "grosslhotova", "GROSSLHOTOVA"]) {
      const r = await get(`${url}/queue?${q(typed)}`);
      assert.deepEqual(r.body.items.map((x: Item) => x.text).sort(), anna, typed);
      assert.equal(r.body.match, undefined, "a text's match is not marked");
    }
    for (const typed of ["Łucja", "lucja", "LUCJI", "lhotecka"]) assert.deepEqual((await get(`${url}/queue?${q(typed)}`)).body.items.map((x: Item) => x.text), ["Úmrtí Łucji"], typed);
    assert.deepEqual((await get(`${url}/queue?${q("лгота")}`)).body.items.map((x: Item) => x.text).sort(), ["Křest Жофии 3", "Křest Жофии 6"]);
    // several words: all of them, each anywhere — the text and a name; one missing: nothing
    assert.deepEqual((await get(`${url}/queue?${q("křest ЛГОТА")}`)).body.items.map((x: Item) => x.text).sort(), ["Křest Жофии 3", "Křest Жофии 6"]);
    assert.deepEqual((await get(`${url}/queue?${q("Krest zofie lhotska")}`)).body.total, 2);
    assert.deepEqual((await get(`${url}/queue?${q("křest anny")}`)).body.total, 0);

    // the record set: archive, call number, place (none of them in a task's text)
    const inB1 = ["T0001", ...Array.from({ length: 29 }, (_, i) => `T${String((i + 1) * 10 + 1).padStart(4, "0")}`)]; // T0001, Matrika 10, 20, … 290
    for (const typed of ["oblastni archiv", "Sig. 159-17", "lhotka", "Horní Lhota", "HORNI lhota"]) {
      const ids = (await pages(url, q(typed))).items.map((x) => x.id);
      assert.deepEqual([...ids].sort(), inB1, typed);
    }
    const n159 = (await pages(url, q("159"))).items.map((x) => x.id);
    assert.deepEqual([...n159].sort(), ["T0159", ...inB1, "T0160"].sort(), "the number: T0159 first, Matrika 159 (T0160) and the call number");
    assert.equal(n159[0], "T0159");
    // the line's name is no text of a task: the chips filter by it
    assert.equal((await get(`${url}/queue?${q("Předci Marie")}`)).body.total, 0);

    // with the filters: the search among what they leave
    const branch = await get(`${url}/queue?branch=B-P0004&${q("křest")}`);
    assert.deepEqual(branch.body.items.map((x: Item) => x.text.normalize("NFC")).sort(), ["Křest Žofie 2", "Křest Žofie 5", "Křest Жофии 3", "Křest Жофии 6"]);
    assert.ok(branch.body.items.every((x: Item) => x.branch === "B-P0004"));
    const line = await pages(url, `research=G0002&${q("původ 2")}`, 4);
    assert.equal(line.total, 12, "2, 12, 20…29");
    assert.deepEqual(line.sizes, [4, 4, 4]);
    assert.ok(line.items.every((x) => x.research === "G0002"));
    const parked = await get(`${url}/queue?state=parked&${q("matrika")}`);
    assert.deepEqual(parked.body.items.map((x: Item) => x.id), ["T0002", "T0004", "T0006"]);
    assert.equal((await get(`${url}/queue?state=next&${q("T0004")}`)).body.total, 0, "filtered out: no row, and nothing said apart");
    assert.equal((await get(`${url}/queue?state=next&${q("T0004")}`)).body.elsewhere, undefined);

    // paged by 50: every match once, in the order of the queue, the total on every page
    const all = await pages(url, q("matrika"));
    assert.equal(all.total, 298, "299 of Jan's line, T0005 done");
    assert.deepEqual(all.sizes, [50, 50, 50, 50, 50, 48]);
    assert.deepEqual(all.items.map((x) => x.id), whole.items.filter((x) => x.text.startsWith("Matrika")).map((x) => x.id));

    // refused: empty, spaces, longer than 100 characters — 100 letters of any script are fine
    for (const bad of ["", "   ", "x".repeat(101), "ж".repeat(101)]) {
      const r = await get(`${url}/queue?${q(bad)}`);
      assert.deepEqual([r.status, r.body.code], [400, "queue.query"], JSON.stringify(bad));
      assert.ok(!r.text.includes(bad.trim() || "\u0000") || !bad.trim(), "what was searched not said back");
    }
    for (const fine of ["x".repeat(100), "ж".repeat(100), "👨‍👩‍👧".repeat(10)]) assert.equal((await get(`${url}/queue?${q(fine)}`)).status, 200);

    // without q: as before
    assert.equal((await get(`${url}/queue?from=0&count=50`)).text, plain.text);

    // what was searched: never in the bridge's log, nor anywhere in .strom
    const strom = path.join(w.cwd, ".strom");
    const files = fs.readdirSync(strom, { recursive: true, withFileTypes: true }).filter((d) => d.isFile());
    for (const d of files) {
      const text = fs.readFileSync(path.join(d.parentPath, d.name), "utf8");
      for (const word of ["Großlhotová", "grosslhotova", "Łucja", "lucja", "křest", "krest", "Sig. 159", "%C5%81ucja", "Gro%C3%9F"]) assert.ok(!text.includes(word), `${d.name}: ${word}`);
    }

    // an archive: nothing
    await w.ok(["live", "stop"]);
    await w.ok(["mode", "archive"], { tty: true });
    const again = ((await w.ok(["live", "start", "--json"])).json as { url: string }).url;
    const a = await get(`${again}/queue?${q("Lhoták")}`);
    assert.deepEqual([a.status, a.body.items, a.body.total], [200, [], 0]);
  } finally {
    await w.run(["live", "stop"]);
    w.cleanup();
  }
});

test("the log of a request: the bridge's secret and what the queue was searched for never in it", () => {
  const token = "0123456789abcdef0123456789abcdef";
  assert.equal(masked(`/${token}/queue?from=0&q=Lhot%C3%A1kov%C3%A1&count=50`), "/…/queue?from=0&q=…&count=50");
  assert.equal(masked(`/${token}/queue?q=${encodeURIComponent("Жофия Лгота")}`), "/…/queue?q=…");
  assert.equal(masked(`/${token}/queue?from=0`), "/…/queue?from=0");
  assert.equal(masked(`/${token}/status?app=3.24.0&quality=1`), "/…/status?app=3.24.0&quality=1", "another parameter beginning with q stays");
});

test("GET /queue?q= read: trimmed, 1…100 characters (any script), never said back in the refusal", () => {
  const ask = (s: string) => queueAsk(new URLSearchParams(s));
  assert.deepEqual(ask(`q=${encodeURIComponent("  Lhoták  ")}`), { from: 0, count: 50, q: "Lhoták" });
  assert.deepEqual(ask("from=0&count=50"), { from: 0, count: 50 }, "without q: no q");
  for (const bad of ["q=", "q=%20%20", `q=${"x".repeat(101)}`]) {
    const r = ask(bad) as { bad: string };
    assert.ok(r.bad, bad);
    assert.ok(!r.bad.includes("xxxx"));
  }
  assert.equal((ask(`q=${encodeURIComponent("ж".repeat(100))}`) as QueueAsk).q, "ж".repeat(100));
});

test("a queue of 5 000 tasks: a search answers within the bridge's time the first time, and about as fast as a page of the queue after", { skip, timeout: 240_000 }, async (t) => {
  const w = new World();
  try {
    await w.withTree("Lhotákovi");
    await w.ok(["research", "new", "Předci Jana", "--new-person", "Jan /Lhoták/", "--sex", "M"]);
    await w.ok(["person", "add", "Žofie /Lhotská/", "--sex", "F"]); // P2
    await w.ok(["family", "add", "--partner", "P2", "--child", "P1"]);
    await w.ok(["repo", "add", "Oblastní archiv v Lhotě"]);
    await w.ok(["recordset", "add", "Lhota N 1784–1820", "--repo", "R0001", "--call-number", "Sig. 159-17", "--places", "Horní Lhota", "--kinds", "baptism"]);
    await w.ok(["task", "add", "Křest Jana", "--level", "locate", "--where", "B1", "--why", "rodiče", "--done-when", "zápis", "--about", "P1"]);
    const tree = Tree.open(w.cwd, w.env);
    const { research: _none, ...plain } = tree.get<Task>("T0001")!;
    tree.withTreeLock(() => {
      const made: Task[] = [];
      for (let i = 1; i < 5000; i++) made.push({ ...plain, id: tree.allocate("T"), what: `Matrika ${i}`, subject: [i % 3 ? "P0001" : "P0002"], where: i % 4 ? ["B0001"] : ["katalog"] });
      tree.putMany(made, [], { op: "task.add", targets: made.map((x) => x.id), summary: `${made.length} tasks` });
    });
    tree.commit("tasks");
    const settings = new Settings(w.env, {});
    const page = (ask: Partial<QueueAsk>) => queuePage(Tree.open(w.cwd, w.env), settings, { from: 0, count: 50, ...ask }, "perf");
    const time = (f: () => unknown) => {
      const t0 = performance.now();
      f();
      return performance.now() - t0;
    };
    time(() => page({})); // the queue's order, worked out once
    const pageMs = Math.min(time(() => page({})), time(() => page({ from: 2500 })));
    let found = 0;
    const coldMs = time(() => (found = page({ q: "lhotska" }).total));
    assert.equal(found, 1666, "the tasks about Žofie Lhotská");
    const warmMs = Math.min(time(() => page({ q: "sig 159 lhota" })), time(() => page({ q: "zofie", from: 1000 })), time(() => page({ q: "T4321" })));
    t.diagnostic(`5 000 tasks: a page ${pageMs.toFixed(0)} ms, the first search ${coldMs.toFixed(0)} ms, a search after ${warmMs.toFixed(0)} ms`);
    assert.ok(coldMs < 15_000, `the first search within the bridge's time: ${coldMs} ms`);
    assert.ok(warmMs < pageMs * 3 + 300, `a search after it about as fast as a page: ${warmMs} ms against ${pageMs} ms`);
    assert.equal(page({ q: "T4321" }).items[0]!.id, "T4321");
  } finally {
    w.cleanup();
  }
});
