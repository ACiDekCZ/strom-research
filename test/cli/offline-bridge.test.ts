// Work off the lines from the Strom app (spec 038 K7; the app's ZADANI_VYZKUM_sprava-linii.md, "Práce mimo linie"):
// /status offLine (the tree's choice, the branches, which grow), queue[] with branch, own and why, a branch that grows
// in What waits; the writes — a branch's choice (POST /offline/<B-…>), the tree's (POST /offline), a task's own turn
// (POST /queue/<T…>), the answer to a branch that grows (POST /waiting/W-B-…), a new line for a branch (POST
// /directions with branch) — each a strom command; GET /offline/<B-…>. Nothing of it in an archive. Any script, any
// accent.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import { World, hasGit } from "../helpers.ts";

const skip = !hasGit || process.platform === "win32";
const opts = { skip, timeout: 240_000 };
const APP = "https://beta.stromapp.info";

type Answer = { status: number; body: any; headers: http.IncomingHttpHeaders };
function request(url: string, method = "GET", body?: unknown, headers: Record<string, string> = { Origin: APP }): Promise<Answer> {
  return new Promise((resolve, reject) => {
    const data = body === undefined ? undefined : Buffer.from(typeof body === "string" ? body : JSON.stringify(body), "utf8");
    const req = http.request(url, { agent: false, method, headers: { ...headers, ...(data ? { "Content-Type": "text/plain;charset=UTF-8", "Content-Length": String(data.length) } : {}) } }, (res) => {
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
        resolve({ status: res.statusCode ?? 0, body: parsed, headers: res.headers });
      });
    });
    req.on("error", reject);
    req.end(data);
  });
}

/**
 * Two lines: the ancestors of Jan Lhoták (G0001) and of Marie (G0002). Josef's sister Anna (P4), her husband Karel (P6),
 * their daughters Žofie (P7, written decomposed) and Жофия (P8): the branch B-P0004. Josef's second wife Ludmila (P9): the
 * line's work; her other husband Lhotomír (P10): a branch of his own.
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
  await w.ok(["person", "add", "Ludmila /Lhotová/", "--sex", "F"]); // P9
  await w.ok(["person", "add", "Lhotomír /Lhota/", "--sex", "M"]); // P10
  await w.ok(["family", "add", "--partner", "P2", "--partner", "P3", "--child", "P1"]);
  await w.ok(["family", "add", "--partner", "P5", "--child", "P2", "--child", "P4"]);
  await w.ok(["family", "add", "--partner", "P4", "--partner", "P6", "--child", "P7", "--child", "P8"]);
  await w.ok(["family", "add", "--partner", "P2", "--partner", "P9"]);
  await w.ok(["family", "add", "--partner", "P9", "--partner", "P10"]);
  await w.ok(["research", "new", "Předci Marie", "--person", "P3"]);
  return w;
}

const task = (w: World, what: string, about: string) =>
  w.ok(["task", "add", what, "--level", "locate", "--where", "katalog archivu Lhota", "--why", "rodiče", "--done-when", "kniha nalezena", "--about", about]);

type Item = { id: string; text: string; state?: string; branch?: string; own?: string; why?: Record<string, unknown>; offLine?: string; helps?: string; research?: string };

test("bridge: work off the lines — /status offLine, queue[] why, branch and own, a branch that grows in What waits; a branch's choice, the tree's, a task's turn, the answer, a line for a branch; 400, 404, 409, 503 busy; nothing in an archive", opts, async () => {
  const w = await world();
  Object.assign(w.env, { STROM_LOCK_WAIT_MS: "1500" });
  try {
    await task(w, "Křest Josefa", "P2"); // T1: the line's
    await task(w, "Oddavky Anny", "P4"); // T2: B-P0004
    await task(w, "Křest Žofie".normalize("NFD"), "P7"); // T3: B-P0004
    await task(w, "Křest Жофии", "P8"); // T4: B-P0004
    await task(w, "Původ Ludmily", "P9"); // T5: the partner of the line's person
    await task(w, "Původ Lhotomíra", "P10"); // T6: B-P0010
    await w.ok(["config", "set", "queue.suggestTasks", "3", "--for-tree"]);

    const url = ((await w.ok(["live", "start", "--json"])).json as { url: string }).url;
    const status = async () => (await request(`${url}/status?app=3.22.0`)).body;
    let s = await status();
    for (const f of ["offLine.branches", "queue.own", "story.sources"]) assert.ok(s.features.includes(f), f);
    assert.equal(s.caps.offLineBranches, true);

    // the tree's choice, the branches nearest to a line first, their tasks in the order of the queue
    const { branches, ...tree } = s.offLine;
    assert.deepEqual(tree, { mode: "occasional", own: false, share: 10, suggest: true, tasks: 4, queued: 4, ownTasks: 0 });
    assert.deepEqual(branches.map((b: { id: string }) => b.id), ["B-P0004", "B-P0010"]);
    const anna = branches[0];
    assert.deepEqual(
      { ...anna, samples: undefined },
      { id: "B-P0004", person: "P0004", via: { person: "P0002", rel: "sibling" }, nearest: "G0001", tasks: 3, persons: 4, samples: undefined, mode: "occasional", own: false, grows: true },
    );
    assert.deepEqual(anna.samples.map((x: { id: string }) => x.id).sort(), ["T0002", "T0003", "T0004"]);
    const texts = anna.samples.map((x: { text: string }) => x.text);
    assert.ok(texts.includes("Křest Žofie"), "composed");
    assert.ok(texts.includes("Křest Жофии"));
    assert.deepEqual(branches[1].via, { person: "P0009", rel: "partner" });
    assert.equal(branches[1].grows, undefined, "one task: below the threshold");

    // queue[]: why, the branch; the partner of a line's person is the line's work
    const item = (id: string) => (s.queue as Item[]).find((x) => x.id === id)!;
    assert.deepEqual(item("T0001").why, { kind: "line", research: "G0001" });
    assert.deepEqual([item("T0005").why, item("T0005").helps, item("T0005").offLine], [{ kind: "helps", research: "G0001", by: "partner" }, "partner", undefined]);
    assert.deepEqual([item("T0002").why, item("T0002").branch, item("T0002").offLine], [{ kind: "off", mode: "occasional", branch: "B-P0004" }, "B-P0004", "occasional"]);

    // the branch that grows waits for the person: a line proposed
    const waits = (st: any) => (st.waiting as { kind: string }[]).filter((x) => x.kind === "branch");
    const grown = waits(s);
    assert.equal(grown.length, 1);
    const g = grown[0] as Record<string, unknown>;
    assert.deepEqual([g.id, g.branch, g.person, g.research, g.tasks, g.persons], ["W-B-P0004", "B-P0004", "P0004", "G0001", 3, 4]);
    assert.match(String(g.what), /^Větev – Anna Lhotáková – roste mimo linie: 3 úkoly, 4 osoby/);

    // one branch and all its tasks; its key as typed
    const got = await request(`${url}/offline/b-p4`);
    assert.equal(got.status, 200, JSON.stringify(got.body));
    assert.equal(got.body.branch.id, "B-P0004");
    assert.deepEqual(got.body.tasks.map((x: { id: string; person: string }) => [x.id, x.person]).sort(), [["T0002", "P0004"], ["T0003", "P0007"], ["T0004", "P0008"]]);
    for (const k of ["B-P0002", "B-P0999", "Žofie"]) assert.deepEqual([(await request(`${url}/offline/${encodeURIComponent(k)}`)).status, (await request(`${url}/offline/${encodeURIComponent(k)}`)).body.code], [404, "offline.none"], k);

    // a branch's choice: never — out of the queue, nothing deleted, still listed by GET
    const never = await request(`${url}/offline/B-P0004`, "POST", { mode: "never" });
    assert.equal(never.status, 200, JSON.stringify(never.body));
    assert.deepEqual([never.body.branch.mode, never.body.branch.own], ["never", true]);
    assert.match(never.body.head, /^[0-9a-f]{40}$/);
    assert.notEqual(never.body.head, never.body.parent);
    s = await status();
    assert.deepEqual([s.offLine.tasks, s.offLine.queued], [4, 1]);
    assert.ok(!(s.queue as Item[]).some((x) => x.branch === "B-P0004"));
    assert.equal(waits(s).length, 0, "a branch with its own choice is proposed nothing");
    assert.equal((await request(`${url}/offline/B-P0004`)).body.tasks.length, 3);
    const same = await request(`${url}/offline/B-P0004`, "POST", { mode: "never" });
    assert.deepEqual([same.status, same.body.head], [200, same.body.parent], "as it is already: nothing written");
    // added to a line: its tasks help it
    const line = await request(`${url}/offline/B-P0004`, "POST", { mode: "line", line: "g2" });
    assert.equal(line.status, 200, JSON.stringify(line.body));
    assert.deepEqual([line.body.branch.mode, line.body.branch.line], ["line", "G0002"]);
    s = await status();
    assert.deepEqual([item("T0002").why, item("T0002").helps, item("T0002").research, item("T0002").branch], [{ kind: "helps", research: "G0002", by: "branch" }, "branch", "G0002", "B-P0004"]);
    const back = await request(`${url}/offline/B-P0004`, "POST", { mode: "default" });
    assert.deepEqual([back.status, back.body.branch.mode, back.body.branch.own], [200, "occasional", false]);
    for (const body of ["no json", {}, { mode: "sometimes" }, { mode: "line" }, { mode: "never", line: "G0001" }, { mode: "never", what: 1 }]) {
      const r = await request(`${url}/offline/B-P0004`, "POST", body);
      assert.deepEqual([r.status, r.body.code], [400, "offline.body"], JSON.stringify(body));
    }
    assert.deepEqual((await request(`${url}/offline/B-P0004`, "POST", { mode: "line", line: "G0099" })).body.code, "directions.none");
    assert.deepEqual([(await request(`${url}/offline/B-P0002`, "POST", { mode: "never" })).status, (await request(`${url}/offline/B-P0002`, "POST", { mode: "never" })).body.code], [404, "offline.none"]);

    // the tree's choice: strom.json of the research
    const before = (await status()).head;
    const last = await request(`${url}/offline`, "POST", { mode: "last" });
    assert.equal(last.status, 200, JSON.stringify(last.body));
    assert.deepEqual([last.body.offLine.mode, last.body.offLine.own, last.body.offLine.branches], ["last", true, undefined]);
    assert.equal((await w.ok(["config", "get", "queue.offLine", "--json"])).json.value, "last");
    const lastAgain = await request(`${url}/offline`, "POST", { mode: "last" });
    assert.equal(lastAgain.body.head, lastAgain.body.parent);
    const both = await request(`${url}/offline`, "POST", { mode: "default", suggest: false });
    assert.equal(both.status, 200, JSON.stringify(both.body));
    assert.deepEqual([both.body.offLine.mode, both.body.offLine.own, both.body.offLine.suggest], ["occasional", false, false]);
    assert.notEqual(both.body.parent, before);
    assert.equal(both.body.parent, last.body.head, "two commands: the head before both");
    assert.equal((await status()).waiting.filter((x: { kind: string }) => x.kind === "branch").length, 0, "no line proposed with suggest off");
    assert.equal((await request(`${url}/offline`, "POST", { suggest: true })).body.offLine.suggest, true);
    for (const body of [{}, { mode: "sometimes" }, { suggest: "no" }, { mode: "never", what: 1 }]) {
      const r = await request(`${url}/offline`, "POST", body);
      assert.deepEqual([r.status, r.body.code], [400, "offline.body"], JSON.stringify(body));
    }

    // a task's own turn: next before everything, last, back
    const next = await request(`${url}/queue/t6`, "POST", { do: "next" });
    assert.equal(next.status, 200, JSON.stringify(next.body));
    assert.deepEqual([next.body.task.id, next.body.task.own, next.body.task.why], ["T0006", "next", { kind: "own", do: "next" }]);
    s = await status();
    assert.deepEqual([s.queue[0].id, s.queue[0].own, s.offLine.ownTasks], ["T0006", "next", 1]);
    assert.equal((await request(`${url}/queue/T0001`, "POST", { do: "last" })).body.task.own, "last");
    s = await status();
    assert.equal(s.queue.filter((x: Item) => x.state === "next").pop().id, "T0001");
    const dflt = await request(`${url}/queue/T0006`, "POST", { do: "default" });
    assert.deepEqual([dflt.status, dflt.body.task.own], [200, undefined]);
    for (const body of [{}, { do: "first" }, { do: "next", what: 1 }]) assert.deepEqual((await request(`${url}/queue/T0006`, "POST", body)).body.code, "queue.body", JSON.stringify(body));
    for (const id of ["T0999", "X1"]) assert.deepEqual([(await request(`${url}/queue/${id}`, "POST", { do: "next" })).status, (await request(`${url}/queue/${id}`, "POST", { do: "next" })).body.code], [404, "queue.none"], id);
    await w.ok(["session", "start", "T5"]);
    const doing = await request(`${url}/queue/T0005`, "POST", { do: "last" });
    assert.deepEqual([doing.status, doing.body.code], [409, "queue.doing"]);
    await w.ok(["session", "close", "--continue", "--summary", "nic", "--next", "dál"]);

    // the answer to a branch that grows: keep — asked again only at twice the size
    s = await status();
    assert.equal(waits(s).length, 1, JSON.stringify(s.waiting));
    // held by another strom: busy, the branch still waits
    const lock = path.join(w.cwd, ".strom", "tree.lock");
    const hold = () => fs.writeFileSync(lock, JSON.stringify({ pid: process.pid, host: os.hostname(), at: new Date().toISOString(), owner: "a test" }));
    hold();
    try {
      const busy = await request(`${url}/waiting/W-B-P0004`, "POST", { do: "never" });
      assert.deepEqual([busy.status, busy.body.code, busy.headers["retry-after"] !== undefined], [503, "research.busy", true]);
    } finally {
      fs.rmSync(lock);
    }
    assert.equal(waits(await status()).length, 1);
    const keep = await request(`${url}/waiting/W-B-P0004`, "POST", { do: "keep" });
    assert.equal(keep.status, 200, JSON.stringify(keep.body));
    assert.deepEqual([keep.body.answer, keep.body.branch.mode, keep.body.branch.grows], ["keep", "occasional", undefined]);
    assert.equal(waits(await status()).length, 0);
    const gone = await request(`${url}/waiting/W-B-P0004`, "POST", { do: "keep" });
    assert.deepEqual([gone.status, gone.body.code], [404, "waiting.none"]);
    // line: to the nearest line
    await w.ok(["config", "set", "queue.suggestTasks", "1", "--for-tree"]);
    for (const body of [{ do: "create" }, { do: "keep", line: "G0001" }, {}]) assert.deepEqual((await request(`${url}/waiting/W-B-P0010`, "POST", body)).body.code, "offline.body", JSON.stringify(body));
    assert.deepEqual((await request(`${url}/waiting/W-B-P0010`, "POST", { do: "line", line: "G0099" })).body.code, "directions.none");
    assert.deepEqual((await request(`${url}/waiting/W-B-P0002`, "POST", { do: "keep" })).body.code, "offline.none");
    const added = await request(`${url}/waiting/w-b-p10`, "POST", { do: "line" });
    assert.equal(added.status, 200, JSON.stringify(added.body));
    assert.deepEqual([added.body.answer, added.body.branch.mode, added.body.branch.line], ["line", "line", "G0001"]);
    // a task's request still marked sent by the same route
    assert.deepEqual((await request(`${url}/waiting/T0999`, "POST", { do: "sent" })).body.code, "waiting.none");

    // a new line for a branch: the branch goes with it, its proposal answered
    assert.deepEqual((await request(`${url}/directions`, "POST", { person: "P0006", direction: "ancestors", branch: "Лгота" })).body.code, "directions.body");
    const nobranch = await request(`${url}/directions`, "POST", { person: "P0006", direction: "ancestors", branch: "B-P0002" });
    assert.deepEqual([nobranch.status, nobranch.body.code], [404, "offline.none"]);
    assert.equal((await w.ok(["research", "list", "--json"])).json.researches.length, 2, "nothing made");

    // the research held by another strom: busy, nothing written
    hold();
    try {
      for (const [where, body] of [["offline/B-P0004", { mode: "never" }], ["offline", { mode: "never" }], ["queue/T0006", { do: "next" }]] as const) {
        const busy = await request(`${url}/${where}`, "POST", body);
        assert.deepEqual([busy.status, busy.body.code, busy.headers["retry-after"] !== undefined], [503, "research.busy", true], where);
      }
      const read = await request(`${url}/offline/B-P0004`);
      assert.deepEqual([read.status, read.body.code], [503, "research.busy"]);
    } finally {
      fs.rmSync(lock);
    }
    assert.equal((await w.ok(["task", "show", "T6", "--json"])).json.task.queueAt, undefined);

    const made = await request(`${url}/directions`, "POST", { person: "P0006", direction: "ancestors", branch: "b-p4" });
    assert.equal(made.status, 200, JSON.stringify(made.body));
    const file = JSON.parse(fs.readFileSync(path.join(w.cwd, "quality", "offline.json"), "utf8"));
    assert.deepEqual([file.branches.P0004.mode, file.branches.P0004.line, file.answers.P0004.do], ["line", made.body.direction.id, "create"]);
    assert.match((await w.ok(["check"])).out, /^ok/);

    // an archive: nobody researches — no work off the lines, nothing written
    await w.ok(["live", "stop"]);
    await w.ok(["mode", "archive"], { tty: true });
    const again = ((await w.ok(["live", "start", "--json"])).json as { url: string }).url;
    const a = (await request(`${again}/status?app=3.22.0`)).body;
    assert.deepEqual([a.offLine, a.caps, a.queue], [undefined, undefined, []]);
    assert.equal((a.waiting as { kind: string }[]).filter((x) => x.kind === "branch").length, 0);
    for (const [where, body] of [["offline/B-P0010", { mode: "never" }], ["offline", { mode: "never" }], ["queue/T0006", { do: "next" }], ["waiting/W-B-P0010", { do: "keep" }]] as const) {
      const r = await request(`${again}/${where}`, "POST", body);
      assert.deepEqual([r.status, r.body.code], [409, "directions.archive"], where);
    }
    assert.deepEqual((await request(`${again}/offline/B-P0010`)).body.code, "directions.archive");
  } finally {
    await w.run(["live", "stop"]);
    w.cleanup();
  }
});

test("bridge: a research of one line has nothing off the lines — no offLine in /status, the tree's choice still written", opts, async () => {
  const w = new World();
  await w.withTree("Lhotákovi");
  await w.ok(["lang", "cs"]);
  await w.ok(["research", "new", "Předci Žofie", "--new-person", "Žofie /Lhotáková/".normalize("NFD"), "--sex", "F"]);
  try {
    const url = ((await w.ok(["live", "start", "--json"])).json as { url: string }).url;
    const s = (await request(`${url}/status?app=3.22.0`)).body;
    assert.equal(s.offLine, undefined);
    assert.equal(s.caps.offLineBranches, true);
    const set = await request(`${url}/offline`, "POST", { mode: "never" });
    assert.equal(set.status, 200, JSON.stringify(set.body));
    assert.deepEqual(set.body.offLine, { mode: "never", own: true, share: 10, suggest: true, tasks: 0, queued: 0, ownTasks: 0 });
    assert.deepEqual((await request(`${url}/offline/B-P0001`)).body.code, "offline.none");
  } finally {
    await w.run(["live", "stop"]);
    w.cleanup();
  }
});
