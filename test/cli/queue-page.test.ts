// The whole queue for the Strom app (spec 038 U2b, K7.5; the app's ZADANI_VYZKUM_sprava-linii.md, "celá fronta"):
// GET /queue pages through the queue in its order — of a branch, a line or a state — each task with its place in the
// whole queue (pos); /status says the place of each task of its window and how many each line and branch has
// (queueCounts), GET /offline/<B-…> the place of each of the branch's tasks. A queue of hundreds: the tasks of a branch
// and of a line far behind /status's window of 14. Any script, any accent.

import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { World, hasGit } from "../helpers.ts";
import { Tree } from "../../src/core/tree.ts";
import type { Task } from "../../src/core/model.ts";

const skip = !hasGit || process.platform === "win32";
const opts = { skip, timeout: 240_000 };
const APP = "https://beta.stromapp.info";

function get(url: string): Promise<{ status: number; body: any; headers: http.IncomingHttpHeaders }> {
  return new Promise((resolve, reject) => {
    http
      .get(url, { agent: false, headers: { Origin: APP } }, (res) => {
        let text = "";
        res.setEncoding("utf8");
        res.on("data", (d) => (text += d));
        res.on("end", () => resolve({ status: res.statusCode ?? 0, body: JSON.parse(text), headers: res.headers }));
      })
      .on("error", reject);
  });
}

type Item = { id: string; text: string; state: string; pos?: number; branch?: string; research?: string };

/**
 * Two lines: the ancestors of Jan Lhoták (G0001) and of Marie (G0002). Josef's sister Anna (P4), her husband Karel (P6)
 * and their daughters Žofie (P7) and Жофия (P8): the branch B-P0004, off the lines.
 */
async function world(): Promise<World> {
  const w = new World();
  await w.withTree("Lhotákovi");
  await w.ok(["lang", "cs"]);
  await w.ok(["research", "new", "Předci Jana", "--new-person", "Jan /Lhoták/", "--sex", "M"]);
  await w.ok(["person", "add", "Josef /Lhoták/", "--sex", "M"]); // P2
  await w.ok(["person", "add", "Marie /Lhotová/", "--sex", "F"]); // P3
  await w.ok(["person", "add", "Anna /Lhotáková/", "--sex", "F"]); // P4
  await w.ok(["person", "add", "Václav /Lhoták/", "--sex", "M"]); // P5
  await w.ok(["person", "add", "Karel /Lhotský/", "--sex", "M"]); // P6
  await w.ok(["person", "add", "Žofie /Lhotská/".normalize("NFD"), "--sex", "F"]); // P7
  await w.ok(["person", "add", "Жофия /Лгота/", "--sex", "F"]); // P8
  await w.ok(["family", "add", "--partner", "P2", "--partner", "P3", "--child", "P1"]);
  await w.ok(["family", "add", "--partner", "P5", "--child", "P2", "--child", "P4"]);
  await w.ok(["family", "add", "--partner", "P4", "--partner", "P6", "--child", "P7", "--child", "P8"]);
  await w.ok(["research", "new", "Předci Marie", "--person", "P3"]);
  return w;
}

/**
 * The queue: 200 tasks of Jan's line (P1, P2, the highest priority), 30 of Marie's (P3, the lowest), 6 of the branch
 * (P4, P7, P8: off the lines, after the lines' work); 3 of them put aside — written at once, as many as a research grows to.
 */
async function queued(w: World): Promise<void> {
  await w.ok(["task", "add", "Křest Josefa", "--level", "locate", "--where", "katalog archivu Lhota", "--why", "rodiče", "--done-when", "kniha nalezena", "--about", "P2", "--priority", "5"]);
  const tree = Tree.open(w.cwd, w.env);
  const model = tree.get<Task>("T0001")!;
  const { research: _none, ...plain } = model;
  const made: Task[] = [];
  const add = (what: string, about: string, priority: number) => made.push({ ...plain, id: tree.allocate("T"), what, subject: [about], priority });
  tree.withTreeLock(() => {
    for (let i = 1; i < 200; i++) add(`Matrika Lhota ${i}`, i % 2 ? "P0001" : "P0002", 5);
    for (let i = 1; i <= 30; i++) add(`Původ Marie ${i}`, "P0003", 1);
    for (const [i, about] of ["P0004", "P0007", "P0008", "P0004", "P0007", "P0008"].entries()) add(`${["Oddavky Anny", "Křest Žofie".normalize("NFD"), "Křest Жофии"][i % 3]} ${i + 1}`, about, 3);
    tree.putMany(made, [], { op: "task.add", targets: made.map((t) => t.id), summary: `${made.length} tasks` });
  });
  tree.commit("tasks");
  for (const id of ["T0002", "T0004", "T0006"]) await w.ok(["task", "park", id, "--reason", "později"]);
}

/** Every page of a filter, joined. */
async function pages(url: string, query: string, count: number): Promise<{ items: Item[]; total: number; sizes: number[] }> {
  const items: Item[] = [];
  const sizes: number[] = [];
  let from: number | undefined = 0;
  let total = -1;
  while (from !== undefined) {
    const r = await get(`${url}/queue?${query}${query ? "&" : ""}from=${from}&count=${count}`);
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.equal(r.body.from, from);
    assert.match(r.body.head, /^[0-9a-f]{40}$/);
    if (total >= 0) assert.equal(r.body.total, total, "the same total on every page");
    total = r.body.total;
    items.push(...r.body.items);
    sizes.push(r.body.items.length);
    from = r.body.next;
    if (from !== undefined) assert.equal(from, items.length, "the next page starts where this one ends");
  }
  return { items, total, sizes };
}

test("bridge: GET /queue pages through the whole queue — of a branch, a line, a state — with each task's place; /status pos and queueCounts; GET /offline/<B-…> pos; 400; an archive's empty", opts, async () => {
  const w = await world();
  try {
    await queued(w);
    const url = ((await w.ok(["live", "start", "--json"])).json as { url: string }).url;
    const s = (await get(`${url}/status?app=3.22.0`)).body;
    assert.ok(s.features.includes("queue.page"));

    // the whole queue, page by page: every open task once, in the order of the queue (pos 1…), those put aside after
    const whole = await pages(url, "", 100);
    assert.deepEqual(whole.sizes, [100, 100, 36]);
    const next = whole.items.filter((x) => x.state === "next");
    const parked = whole.items.filter((x) => x.state === "parked");
    assert.equal(whole.total, 236);
    assert.deepEqual([next.length, parked.length], [233, 3]);
    assert.deepEqual(next.map((x) => x.pos), next.map((_, i) => i + 1));
    assert.deepEqual(parked.map((x) => [x.id, x.pos]), [["T0002", undefined], ["T0004", undefined], ["T0006", undefined]]);
    assert.equal(new Set(whole.items.map((x) => x.id)).size, 236);

    // /status: its window the first of the queue, with the same places; what is not shown counted
    const window = (s.queue as Item[]).filter((x) => x.state === "next");
    assert.equal(window.length, 14);
    assert.deepEqual(window.map((x) => [x.id, x.pos]), next.slice(0, 14).map((x) => [x.id, x.pos]));
    assert.equal(s.queueMore, 236 - (s.queue as Item[]).length);
    // a page as /status says each task: the same fields
    assert.deepEqual(next[0], window[0]);

    // the counts: the same as the filters leave, each line and branch
    const counts = s.queueCounts;
    assert.deepEqual([counts.next, counts.parked], [233, 3]);
    assert.match(counts.rev, /^[0-9a-f]{16}$/);
    assert.deepEqual(Object.keys(counts.branch), ["B-P0004"]);
    assert.equal(counts.branch["B-P0004"], 6);
    assert.equal(counts.research.G0002, 30);
    for (const [k, n] of Object.entries(counts.research)) {
      const f = await pages(url, `research=${k}&state=next`, 7);
      assert.equal(f.total, n, k);
      assert.deepEqual(f.items.map((x) => x.id), next.filter((x) => x.research === k).map((x) => x.id), k);
    }

    // the branch: all its tasks far behind the window, in the order of the queue, with their places in the whole queue
    const branch = await pages(url, "branch=b-p4", 4);
    assert.deepEqual(branch.sizes, [4, 2]);
    assert.equal(branch.total, 6);
    assert.ok(branch.items.every((x) => x.branch === "B-P0004" && x.pos! > 14), JSON.stringify(branch.items.map((x) => x.pos)));
    const at = new Map(next.map((x) => [x.id, x.pos]));
    assert.deepEqual(branch.items.map((x) => x.pos), branch.items.map((x) => at.get(x.id)));
    assert.deepEqual(branch.items.map((x) => x.pos), [...branch.items.map((x) => x.pos!)].sort((a, b) => a - b));
    const texts = branch.items.map((x) => x.text);
    assert.ok(texts.some((t) => t.startsWith("Křest Žofie")), "composed");
    assert.ok(texts.some((t) => t.startsWith("Křest Жофии")));

    // Marie's line: behind the window too
    const marie = await pages(url, "research=g2", 50);
    assert.equal(marie.total, 30);
    assert.ok(marie.items.every((x) => x.research === "G0002" && x.pos! > 14 && x.pos === at.get(x.id)));

    // a filter beyond its end: nothing, the total still said; state parked alone; both filters at once
    const beyond = await get(`${url}/queue?branch=B-P0004&from=40`);
    assert.deepEqual([beyond.body.items, beyond.body.total, beyond.body.next], [[], 6, undefined]);
    const aside = await get(`${url}/queue?state=parked`);
    assert.deepEqual(aside.body.items.map((x: Item) => x.id), ["T0002", "T0004", "T0006"]);
    assert.equal(aside.body.total, 3);
    assert.equal(aside.body.rev, counts.rev, "one order for /status and the pages");
    const none = await get(`${url}/queue?branch=B-P0004&research=G0002`);
    assert.deepEqual([none.status, none.body.total], [200, 0]);

    // one branch: the place of each of its tasks
    const b = await get(`${url}/offline/B-P0004`);
    assert.deepEqual(b.body.tasks.map((x: Item) => [x.id, x.pos]), branch.items.map((x) => [x.id, x.pos]));

    // the query as the app may get it wrong: said, nothing else
    for (const q of ["count=0", "count=101", "from=-1", "from=x", "state=done", "branch=P4", "research=Žofie", "page=2"]) {
      const r = await get(`${url}/queue?${q}`);
      assert.deepEqual([r.status, r.body.code], [400, "queue.query"], q);
    }

    // an archive: no queue
    await w.ok(["live", "stop"]);
    await w.ok(["mode", "archive"], { tty: true });
    const again = ((await w.ok(["live", "start", "--json"])).json as { url: string }).url;
    const a = await get(`${again}/queue`);
    assert.deepEqual([a.status, a.body.items, a.body.total], [200, [], 0]);
    const sa = (await get(`${again}/status?app=3.22.0`)).body;
    assert.deepEqual([sa.queue, sa.queueCounts], [[], { research: {}, branch: {}, next: 0, parked: 0 }]);
  } finally {
    await w.run(["live", "stop"]);
    w.cleanup();
  }
});
