// A task woken by images the person gave it — saved into its folder of the shared inbox, sent for it from the Strom app,
// strom media add --inbox — goes ahead in the queue as strom task order next does (Milan, 2026-11-17: "ano jen od
// cloveka"): after the work at hand, the last woken first, all woken at once ahead with the queue's own order among
// them, once (a session on it ends: the queue's order again). Woken otherwise (an answer, a letter, an image another
// way, the agent's own download): nothing changes. The person's own turn (last) wins. The bridge's queue (runOrder)
// shows it on top. Made-up names only (Lhoták, Lhota).

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { World, hasGit } from "../helpers.ts";
import { Tree } from "../../src/core/tree.ts";
import { inboxFolderFor } from "../../src/core/media.ts";
import { SETTLE_MS } from "../../src/core/inboxwait.ts";
import { runOrder } from "../../src/core/queue.ts";
import type { Task } from "../../src/core/model.ts";

const opts = { skip: !hasGit, timeout: 240_000 };
const fixtures = path.join(import.meta.dirname, "..", "fixtures", "images");
const APP = { STROM_FOR_APP: "1" };
const AGENT = { CLAUDECODE: "1" };

/** A file saved long enough ago to have settled. */
function saved(from: string, to: string): void {
  fs.copyFileSync(path.join(fixtures, from), to);
  const past = new Date(Date.now() - 2 * SETTLE_MS);
  fs.utimesSync(to, past, past);
}

/** Jan Lhoták (P1); B0001 a book of Lhota; T1–T3 work of his line (priority 5, 4, 3), T4–T5 in the book (2, 1). */
async function world(): Promise<{ w: World; shared: string; folder: string }> {
  const w = new World();
  await w.withTree("Lhotákovi");
  await w.ok(["research", "new", "Předci Jana", "--new-person", "Jan /Lhoták/", "--sex", "M"]);
  await w.ok(["recordset", "add", "Lhota N 1784–1820", "--url", "https://archive.example.org/book/77"]); // B1
  for (const [what, priority] of [["Křest Jana", "5"], ["Oddavky rodičů", "4"], ["Úmrtí děda", "3"]] as const)
    await w.ok(["task", "add", what, "--level", "locate", "--where", "katalog archivu Lhota", "--why", "rodiče", "--done-when", "zápis", "--about", "P1", "--priority", priority]);
  for (const [what, priority] of [["Křest otce v knize Lhota", "2"], ["Křest matky v knize Lhota", "1"]] as const)
    await w.ok(["task", "add", what, "--level", "link", "--where", "B1", "--why", "rodiče", "--done-when", "zápis", "--about", "P1", "--priority", priority, "--anyway"]);
  const shared = path.join(w.home, "shared");
  return { w, shared, folder: path.join(shared, "inbox", inboxFolderFor({ id: "B0001", title: "Lhota N 1784–1820" })) };
}

/** The queue as strom run takes it and the bridge shows it to the Strom app (/status, its queue). */
const queue = (w: World) => runOrder(Tree.open(w.cwd, w.env)).map((r) => r.task.id);
const turn = (w: World, id: string) => Tree.open(w.cwd, w.env).get<Task>(id)!.queueAt;

test("images the person saved into the inbox: the task woken goes next, once; all woken at once ahead, among them the queue's order", opts, async () => {
  const { w, folder } = await world();
  try {
    assert.deepEqual(queue(w), ["T0001", "T0002", "T0003", "T0004", "T0005"]);
    await w.ok(["task", "wait", "T5", "--images", "B1:9", "--on", "snímek 9 knihy Lhota"]);
    saved("grey.jpg", path.join(folder, "9.jpg"));
    const r = await w.ok(["media", "add", "--inbox", "--waiting"]);
    assert.match(r.out, /back in the queue: T0005/);
    assert.equal(turn(w, "T0005")?.do, "next", "written as strom task order next");
    assert.deepEqual(queue(w), ["T0005", "T0001", "T0002", "T0003", "T0004"]);
    const bridge = runOrder(Tree.open(w.cwd, w.env))[0]!;
    assert.deepEqual(bridge.reason, { kind: "own", do: "next" }, "the app's queue: on top, next");

    // the work at hand stays first
    await w.ok(["session", "start", "T2"]);
    assert.deepEqual(queue(w).slice(0, 2), ["T0002", "T0005"]);
    await w.ok(["session", "close", "--continue", "--summary", "nic", "--next", "dál"]);
    // once: a session on it ends — the queue's own order again (one that goes wrong sinks as any other)
    await w.ok(["session", "start", "T5"]);
    await w.ok(["session", "close", "--continue", "--summary", "nic", "--next", "dál"]);
    assert.equal(turn(w, "T0005"), undefined);
    assert.notEqual(queue(w)[0], "T0005");

    // two woken by one look: both ahead with one time, among them the queue's order (T4 p2 before T5 p1)
    await w.ok(["task", "wait", "T4", "--images", "B1:10", "--on", "snímek 10 knihy Lhota"]);
    await w.ok(["task", "wait", "T5", "--images", "B1:10", "--on", "snímek 10 knihy Lhota"]);
    saved("cmyk.jpg", path.join(folder, "10.jpg"));
    assert.match((await w.ok(["media", "add", "--inbox", "--waiting"])).out, /back in the queue: T0004, T0005|back in the queue: T0004 T0005/);
    assert.equal(turn(w, "T0004")?.at, turn(w, "T0005")?.at);
    assert.deepEqual(queue(w).slice(0, 2), ["T0004", "T0005"]);
  } finally {
    w.cleanup();
  }
});

test("woken otherwise — an answer, a letter, an image registered another way — keeps the queue's order; the person's own turn wins", opts, async () => {
  const { w, shared, folder } = await world();
  try {
    // a letter's reply: woken by hand, nothing ahead
    await w.ok(["task", "wait", "T4", "--kind", "letter", "--to", "farní úřad Lhota", "--on", "odpověď farního úřadu Lhota"]);
    await w.ok(["task", "wake", "T4"]);
    assert.equal(turn(w, "T0004"), undefined);
    // images registered from files (a connector's, the agent's): woken, nothing ahead
    await w.ok(["task", "wait", "T5", "--images", "B1:9", "--on", "snímek 9 knihy Lhota"]);
    const file = path.join(w.dir, "s0009.jpg");
    fs.copyFileSync(path.join(fixtures, "grey.jpg"), file);
    assert.match((await w.ok(["media", "add", file, "--recordset", "B1", "--image", "9"])).out, /T0005/);
    assert.equal(Tree.open(w.cwd, w.env).get<Task>("T0005")!.state, "open");
    assert.equal(turn(w, "T0005"), undefined);
    assert.deepEqual(queue(w), ["T0001", "T0002", "T0003", "T0004", "T0005"]);

    // the person put it last: the images saved bring it back, last it stays
    await w.ok(["task", "order", "T4", "--last"]);
    const last = turn(w, "T0004");
    await w.ok(["task", "wait", "T4", "--images", "B1:10", "--on", "snímek 10 knihy Lhota"]);
    saved("cmyk.jpg", path.join(folder, "10.jpg"));
    assert.match((await w.ok(["media", "add", "--inbox", "--waiting"])).out, /back in the queue: T0004/);
    assert.deepEqual(turn(w, "T0004"), last);
    assert.equal(queue(w).at(-1), "T0004");
    assert.ok(fs.existsSync(shared));
  } finally {
    w.cleanup();
  }
});

test("sent from the Strom app: images by their numbers wake the task ahead; a task that does not know which comes ahead with the person's answer, never an agent's wake", opts, async () => {
  const { w } = await world();
  try {
    await w.ok(["task", "wait", "T4", "--images", "B1:9", "--on", "snímek 9 knihy Lhota"]);
    const one = path.join(w.dir, "poslany.jpg");
    fs.copyFileSync(path.join(fixtures, "grey.jpg"), one);
    const got = (await w.ok(["media", "original", one, "--task", "T4", "--image", "9", "--json"], { env: APP })).json;
    assert.equal(got.woken, true);
    assert.equal(turn(w, "T0004")?.do, "next");
    assert.equal(queue(w)[0], "T0004");

    // a site the person looks at with the one book (which images not known): the images sent, the task waits on for the
    // person's answer — the person's wake brings it ahead, an agent's does not
    await w.ok(["task", "wait", "T5", "--kind", "web", "--url", "https://archive.example.org/book/77", "--on", "projít knihu Lhota v badatelně"]);
    const two = path.join(w.dir, "Snímek obrazovky.jpg".normalize("NFD"));
    fs.copyFileSync(path.join(fixtures, "cmyk.jpg"), two);
    const sent = (await w.ok(["media", "original", two, "--task", "T5", "--json"], { env: APP })).json;
    assert.equal(sent.woken, false);
    assert.equal(Tree.open(w.cwd, w.env).get<Task>("T0005")!.state, "waiting");
    await w.ok(["task", "wake", "T5"], { env: AGENT });
    assert.equal(turn(w, "T0005"), undefined, "an agent's wake: the queue's order");
    await w.ok(["task", "wait", "T5", "--kind", "web", "--url", "https://archive.example.org/book/77", "--on", "projít knihu Lhota v badatelně znovu"]);
    const three = path.join(w.dir, "Снимок.jpg");
    fs.copyFileSync(path.join(fixtures, "base420.jpg"), three);
    await w.ok(["media", "original", three, "--task", "T5", "--json"], { env: APP });
    await w.ok(["task", "wake", "T5", "--answer", "snímky poslány"], { env: APP });
    assert.equal(turn(w, "T0005")?.do, "next");
    assert.equal(queue(w)[0], "T0005", "the last woken first");
  } finally {
    w.cleanup();
  }
});
