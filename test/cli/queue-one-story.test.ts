// One order of what comes next, wherever it is shown or taken: the menu before strom run, the bridge's queue for the
// Strom app (/status queue[], GET /queue) and what strom run takes. At a story's turn (five sessions without one) one
// story goes first — the one strom run takes — and the other stories keep their place after the research; once a
// story is written, every story after the research again. Any script, any accent.

import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import path from "node:path";
import { World, hasGit } from "../helpers.ts";

const opts = { skip: !hasGit || process.platform === "win32", timeout: 240_000 };
const agent = path.join(import.meta.dirname, "..", "fixtures", "agent.ts");
const APP = "https://beta.stromapp.info";

function get(url: string): Promise<any> {
  return new Promise((resolve, reject) => {
    http
      .get(url, { agent: false, headers: { Origin: APP } }, (res) => {
        let text = "";
        res.setEncoding("utf8");
        res.on("data", (d) => (text += d));
        res.on("end", () => resolve(JSON.parse(text)));
      })
      .on("error", reject);
  });
}

/** Jan Lhoták (P1), his parents Josef (P2) and Marie (P3); three tasks of research and three stories. */
async function world(): Promise<{ w: World; ids: Map<string, string> }> {
  const w = new World();
  await w.withTree("Lhotákovi");
  await w.ok(["lang", "cs"]);
  await w.ok(["research", "new", "Předci Jana", "--new-person", "Jan /Lhoták/", "--sex", "M"]);
  await w.ok(["person", "add", "Josef /Lhoták/", "--sex", "M"]);
  await w.ok(["person", "add", "Marie /Lhotová/", "--sex", "F"]);
  await w.ok(["family", "add", "--partner", "P2", "--partner", "P3", "--child", "P1"]);
  const what = new Map<string, string>();
  const research = (text: string, about: string, priority: string) =>
    w.ok(["task", "add", text, "--level", "locate", "--where", "katalog archivu Lhota", "--why", "rodiče", "--done-when", "kniha nalezena", "--about", about, "--priority", priority]);
  const story = (text: string, about: string) =>
    w.ok(["task", "add", text, "--level", "narrate", "--priority", "1", "--where", "zapsané údaje", "--why", "rodinná kniha", "--done-when", "strom story set", "--about", about]);
  for (const [i, [text, about, p]] of [["Křest Josefa", "P2", "5"], ["Oddavky rodičů".normalize("NFD"), "P2", "3"], ["Původ Марии", "P3", "2"]].entries()) {
    await research(text!, about!, p!);
    what.set(text!.normalize("NFC"), `T000${i + 1}`);
  }
  for (const [i, [text, about]] of [["Vyprávění: Josef Lhoták", "P2"], ["Vyprávění: Marie Lhotová", "P3"], ["Vyprávění: Jan Lhoták", "P1"]].entries()) {
    await story(text!, about!);
    what.set(text!, `T000${i + 4}`);
  }
  // five sessions on the research, none on a story: a story's turn
  for (const id of ["T1", "T2", "T3", "T1", "T2"]) {
    await w.ok(["session", "start", id]);
    await w.ok(["session", "close", "--continue", "--summary", "zatím nic", "--next", "dál"]);
  }
  Object.assign(w.env, { STROM_AGENT: "script", STROM_RUNNER_SCRIPT: agent, AGENT_MODE: "echo" });
  return { w, ids: what };
}

/** The menu's list before strom run (2 working alone, 0 back, 0 quit): the tasks by their IDs, the stories marked. */
async function preview(w: World, ids: Map<string, string>): Promise<{ order: string[]; marked: string[] }> {
  const r = await w.ok([], { tty: true, answers: ["2", "0", "0"] });
  const list = r.out.split("Na řadě jsou tyto úkoly, v pořadí, v jakém je agent vezme:\n")[1]!.split("\n");
  const rows = list.filter((l) => /^ +\d+\. /.test(l)).map((l) => l.replace(/^ +\d+\. /, ""));
  const idOf = (row: string) => ids.get(row.replace(/ \(vyprávění\)$/, "").normalize("NFC")) ?? `? ${row}`;
  return { order: rows.map(idOf), marked: rows.filter((r) => r.endsWith(" (vyprávění)")).map(idOf) };
}

/** The bridge's queue: /status queue[] (its window) and GET /queue (the whole), the same order; the stories by kind. */
async function bridge(w: World): Promise<{ status: string[]; whole: string[]; stories: string[] }> {
  const url = ((await w.ok(["live", "start", "--json"])).json as { url: string }).url;
  try {
    const s = await get(`${url}/status?app=3.27.0`);
    const q = await get(`${url}/queue?state=next&from=0&count=100`);
    type Item = { id: string; kind?: string };
    return { status: (s.queue as Item[]).map((x) => x.id), whole: (q.items as Item[]).map((x) => x.id), stories: (q.items as Item[]).filter((x) => x.kind === "story").map((x) => x.id) };
  } finally {
    await w.ok(["live", "stop"]);
  }
}

test("the queue: at a story's turn one story first — the menu, the bridge for the app and strom run alike; after it the stories after the research everywhere", opts, async () => {
  const { w, ids } = await world();
  try {
    const before = await preview(w, ids);
    assert.equal(before.order.length, 6, JSON.stringify(before));
    // Jan's story first: the nearest generation, as the stories go among themselves
    assert.equal(before.order[0], "T0006", "one story first");
    assert.deepEqual(before.order.slice(1, 4).sort(), ["T0001", "T0002", "T0003"], "then the research — not every story");
    assert.deepEqual(before.order.slice(4).sort(), ["T0004", "T0005"], "the other stories after the research");
    assert.deepEqual(before.marked.sort(), ["T0004", "T0005", "T0006"], "each story said so");

    const app = await bridge(w);
    assert.deepEqual(app.whole, before.order, "GET /queue: the menu's order");
    assert.deepEqual(app.status, before.order, "/status queue[]: the same");
    assert.deepEqual(app.stories.sort(), ["T0004", "T0005", "T0006"], "kind: story");

    // the conversation's order (the user leads): no story's turn
    const conversation = (await w.ok(["task", "list", "--json"])).json.tasks.map((t: { id: string }) => t.id);
    assert.deepEqual(conversation.slice(-3).sort(), ["T0004", "T0005", "T0006"]);

    // strom run takes what the menu and the app showed first
    const run = await w.ok(["run", "--agent", "script", "--json"]);
    assert.equal(run.json.sessions.length, 1, run.out);
    assert.equal(run.json.sessions[0].task, before.order[0]);

    // a story written: back to the research everywhere, the stories after it, in one order
    const after = await preview(w, ids);
    assert.deepEqual(after.order.slice(0, 3).sort(), ["T0001", "T0002", "T0003"], JSON.stringify(after));
    assert.deepEqual(after.order.slice(3).sort(), ["T0004", "T0005", "T0006"]);
    const app2 = await bridge(w);
    assert.deepEqual(app2.whole, after.order);
    assert.deepEqual(app2.status, after.order);
    const next = await w.ok(["run", "--agent", "script", "--json"]);
    assert.equal(next.json.sessions[0].task, after.order[0]);
  } finally {
    w.cleanup();
  }
});
