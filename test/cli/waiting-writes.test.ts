// What the person writes about what waits, from the terminal and from the Strom app (the app's
// ZADANI_VYZKUM_menu-ceka.md, "Zápis z aplikace přes most"): a file that came for a waiting task (strom intake --answers,
// the link task&do=file, PUT /media with X-Strom-Task) — an input of the task's people handed to it, the task back in the
// queue, no intake task, only that the file came written; a request marked sent through the bridge, for one task
// (POST /waiting/<T…>) or one place (POST /group/<key>: sent, and unsent only of the tasks the app names); the request
// texts of a place for one e-mail (GET /group/<key>/note).

import { test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { World, hasGit, readJsonFile } from "../helpers.ts";
import { Tree } from "../../src/core/tree.ts";
import { history } from "../../src/core/live.ts";
import type { Input, Task } from "../../src/core/model.ts";
import { get, post } from "./sync.helpers.ts";

const opts = { skip: !hasGit };
const bridged = { skip: !hasGit || process.platform === "win32" };
const app = { Origin: "https://beta.stromapp.info", "Content-Type": "application/json" };
const fixtures = path.join(import.meta.dirname, "..", "fixtures", "images");
const sha = (b: Buffer) => crypto.createHash("sha256").update(b).digest("hex");

function put(url: string, body: Buffer, headers: Record<string, string>): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = http.request(url, { method: "PUT", headers: { "Content-Length": String(body.length), "Content-Type": "application/octet-stream", ...headers } }, (res) => {
      let b = "";
      res.on("data", (d) => (b += d));
      res.on("end", () => resolve({ status: res.statusCode ?? 0, body: b }));
    });
    req.on("error", reject);
    req.end(body);
  });
}

/**
 * Letters A (T1), B (T2) and C (T3) to one registry office, A sent a week ago (here: before); a letter to another
 * office (T4) with its request's text; the family (T5); a check of a site (T6); open work (T7). Two request texts of
 * the office's place, one of them named by two tasks.
 */
async function world(): Promise<World> {
  const w = new World();
  await w.withTree("Dvořákovi");
  await w.ok(["research", "new", "Předci Kryštofa", "--new-person", "Kryštof /Žďárský/", "--sex", "M", "--born", "1902"]); // P1
  await w.ok(["person", "add", "Мария /Иванова/", "--sex", "F"]); // P2
  const add = (what: string, about = "P1") => w.ok(["task", "add", what, "--level", "request", "--where", "matrika Lhota", "--why", "rodiče", "--done-when", "odpověď", "--about", about, "--anyway"]);
  await add("Opis křtu Kryštofa"); // T1
  await add("Opis oddacího zápisu rodičů"); // T2
  await add("Opis úmrtí dědy", "P2"); // T3
  await add("Opis z jiné matriky"); // T4
  await add("Vzpomínky na Kryštofa"); // T5
  await add("Ověřit knihu oddaných"); // T6
  await add("Křest Kryštofa"); // T7, open
  fs.mkdirSync(path.join(w.cwd, "notes"), { recursive: true });
  fs.writeFileSync(path.join(w.cwd, "notes", "žádost-lhota.md"), "Žádost o opisy křtu a sňatku.\n");
  fs.writeFileSync(path.join(w.cwd, "notes", "žádost-úmrtí.md"), "﻿Žádost o opis úmrtního zápisu.\n");
  const office = "Matriční úřad Lhota";
  await w.ok(["task", "wait", "T1", "--on", "Odpověď matriky na žádost o opis křtu.", "--kind", "letter", "--to", office, "--request", "notes/žádost-lhota.md"]);
  await w.ok(["task", "wait", "T2", "--on", "Odpověď matriky na žádost o opis sňatku.", "--kind", "letter", "--to", office.normalize("NFD"), "--request", "notes/žádost-lhota.md"]);
  await w.ok(["task", "wait", "T3", "--on", "Odpověď matriky na žádost o opis úmrtí.", "--kind", "letter", "--to", office, "--request", "notes/žádost-úmrtí.md"]);
  await w.ok(["task", "wait", "T4", "--on", "Odpověď jiné matriky.", "--kind", "letter", "--to", "Matriční úřad Týnec"]);
  await w.ok(["task", "wait", "T5", "--on", "Vzpomínky rodiny na Kryštofa.", "--kind", "family"]);
  await w.ok(["search", "add", "Kniha oddaných", "--method", "web", "--result", "inconclusive", "--task", "T6", "--note", "closed.example.com refused automated access"]);
  await w.ok(["task", "wait", "T6", "--check", "https://closed.example.com/book/1", "--on", "Je kniha oddaných vidět i se snímky?"]);
  await w.ok(["task", "sent", "T1"]); // A, sent before
  return w;
}

const task = async (w: World, id: string): Promise<Task> => (await w.ok(["task", "show", id, "--json"])).json.task;
const state = (w: World) => JSON.stringify(Tree.open(w.cwd, w.env).list<Task>("task").map((t) => [t.id, t.state, t.sent?.at ?? null, (t.files ?? []).length]));

test("strom intake --answers: the file an input of the task's people, handed to it, the task back in the queue — no intake task; only that it came, in the research language; refused where it takes no file", opts, async () => {
  const w = await world();
  const dl = path.join(w.dir, "Stažené");
  fs.mkdirSync(dl, { recursive: true });
  const reply = path.join(dl, "odpověď matriky.pdf".normalize("NFD"));
  fs.writeFileSync(reply, "%PDF-1.4\nOpis křtu\n%%EOF\n");
  const tasksBefore = Tree.open(w.cwd, w.env).list<Task>("task").length;
  const r = await w.ok(["intake", reply, "--answers", "t1", "--note", "Opis přišel poštou.", "--json"]);
  assert.deepEqual([r.json.task, r.json.state, r.json.handed], ["T0001", "open", ["I0001"]]);
  assert.equal(Tree.open(w.cwd, w.env).list<Task>("task").length, tasksBefore, "no intake task");
  const t1 = await task(w, "T1");
  assert.equal(t1.state, "open");
  // what it waited for, and that it was sent, go with the wait
  assert.deepEqual([t1.waitingOn, t1.wait, t1.sent], [undefined, undefined, undefined]);
  assert.equal(t1.files!.length, 1);
  assert.deepEqual([t1.files![0]!.input, t1.files![0]!.by, t1.files![0]!.asked], ["I0001", "user", "Odpověď matriky na žádost o opis křtu."]);
  assert.ok(t1.where.includes("I0001"));
  // never words as the person's: no answer written
  assert.equal(t1.answers, undefined);
  const input = (await w.ok(["input", "show", "I1", "--json"])).json.input as Input;
  assert.deepEqual([input.persons, input.notes.map((n) => n.text), input.state], [["P0001"], ["Opis přišel poštou."], "new"]);
  // the history: a machine sentence in the research language
  const said = history(w.cwd, Tree.open(w.cwd, w.env))[0]!.text;
  assert.equal(said.at(-1), "Přišel soubor I0001 k úkolu, zpět agentovi: Opis křtu Kryštofa");
  assert.ok(!said.some((l) => /odpověděl|answered/u.test(l)), said.join("\n"));
  // the agent's view: the file came, read it as the next step
  assert.match((await w.ok(["task", "show", "T1"])).out, /file {3}\d{4}-\d\d-\d\d I0001 came \(user; asked: Odpověď matriky na žádost o opis křtu\.\)/);
  // the same content again for another task: the input the research has, named for that task's people
  const again = await w.ok(["intake", reply, "--answers", "T3", "--json"]);
  assert.deepEqual([again.json.handed, again.json.skipped], [["I0001"], 1]);
  assert.deepEqual(((await w.ok(["input", "show", "I1", "--json"])).json.input as Input).persons, ["P0001", "P0002"]);
  assert.equal((await task(w, "T3")).state, "open");
  // refused, nothing written: a task that does not wait, a check of a site, words as the person's answer, no file
  const before = state(w);
  const open = await w.run(["intake", reply, "--answers", "T7"]);
  assert.notEqual(open.code, 0);
  assert.match(open.err, /T0007 does not wait \(it is open\)/);
  const check = await w.run(["intake", reply, "--answers", "T6"]);
  assert.match(check.err, /T0006 waits for the person's check of https:\/\/closed\.example\.com\/book\/1/);
  const words = await w.run(["intake", "--text", "Opis přišel", "--answers", "T4"]);
  assert.match(words.err, /--answers takes files — the user's answer in words is theirs alone/);
  assert.match(words.err, /strom task wake T4 --answer/);
  assert.notEqual((await w.run(["intake", "--answers", "T4"])).code, 0);
  assert.equal(state(w), before);
  assert.match((await w.ok(["check"])).out, /^ok/);
  w.cleanup();
});

test("the link task&do=file: the file dragged in and a short note — handed to the task; Enter or 0 writes nothing; a task that takes no file only said", opts, async () => {
  const w = await world();
  const id = Tree.open(w.cwd, w.env).config.id;
  const open = (query: string, answers: string[] = []) => w.run(["link", "open", `strom-research://task?tree=${id}${query}`], { tty: true, answers });
  const before = state(w);
  const file = path.join(w.dir, "Moje dopisy", "dopis od tety.txt");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, "Milá Marie …\n");
  // Enter at the file, 0 at the note: nothing written
  const enter = await open("&task=T0005&do=file", [""]);
  assert.match(enter.out, /Aplikace Strom žádá: soubor k úkolu – úkol se vrátí do fronty agenta: Vzpomínky na Kryštofa/u);
  assert.equal(state(w), before);
  const back = await open("&task=T0005&do=file", [`'${file}'`, "0"]);
  assert.equal(state(w), before, back.out);
  // a check of a site: only said
  assert.match((await open("&task=T0006&do=file", [""])).out, /Úkol T0006 teď soubor nebere/);
  // dragged in (quoted, with spaces), a note: handed to the task
  const done = await open("&task=T0005&do=file", [`'${file}'`, "Dopis od tety z roku 1950"]);
  assert.match(done.out, /✓ Soubor je u úkolu – úkol je zpět ve frontě agenta\./, done.out + done.err);
  const t5 = await task(w, "T5");
  assert.deepEqual([t5.state, t5.files?.[0]?.input, t5.files?.[0]?.by], ["open", "I0001", "user"]);
  assert.deepEqual(((await w.ok(["input", "show", "I1", "--json"])).json.input as Input).notes.map((n) => n.text), ["Dopis od tety z roku 1950"]);
  w.cleanup();
});

test("the bridge: a request marked sent for one task and taken back; refused — no task that waits, one with nothing to send, not the app's pages, a bad body; /status says waiting.sent, waiting.note and accepts.media.task", bridged, async () => {
  const w = await world();
  const info = (await w.ok(["live", "start", "--json"])).json;
  try {
    const status = JSON.parse((await get(`${info.url}/status?poll=1`)).body);
    for (const f of ["waiting.groups", "waiting.sent", "waiting.note"]) assert.ok(status.features.includes(f), f);
    assert.equal(status.accepts.media.task, true);
    const send = (id: string, body: unknown, headers: Record<string, string> = app) => post(`${info.url}/waiting/${id}`, typeof body === "string" ? body : JSON.stringify(body), headers);
    const s = await send("T0004", { do: "sent" });
    assert.equal(s.status, 200, s.body);
    const sb = JSON.parse(s.body);
    assert.deepEqual([sb.sent, sb.task, sb.phase], [["T0004"], "T0004", "sent"]);
    assert.match(sb.head, /^[0-9a-f]{40}$/);
    const t4 = await task(w, "T4");
    assert.deepEqual([t4.state, t4.sent?.by], ["waiting", "user"], "the user's, never an agent's");
    // said again: nothing marked
    assert.deepEqual(JSON.parse((await send("T4", { do: "sent" })).body).sent, []);
    const u = JSON.parse((await send("T4", { do: "unsent" })).body);
    assert.deepEqual([u.unsent, u.phase], [["T0004"], "todo"]);
    assert.equal((await task(w, "T4")).sent, undefined);
    // refused, nothing written
    const before = state(w);
    const none = await send("T0007", { do: "sent" });
    assert.deepEqual([none.status, JSON.parse(none.body).code, JSON.parse(none.body).params], [404, "waiting.none", { id: "T0007" }]);
    assert.equal((await send("T0099", { do: "sent" })).status, 404);
    const check = await send("T0006", { do: "sent" });
    assert.deepEqual([check.status, JSON.parse(check.body).code], [409, "waiting.not-sendable"]);
    const bad = await send("T0004", "hello");
    assert.deepEqual([bad.status, JSON.parse(bad.body).code], [400, "waiting.bad-body"]);
    assert.equal(JSON.parse((await send("T0004", { do: "answer" })).body).code, "waiting.bad-body");
    const foreign = await send("T0004", { do: "sent" }, { "Content-Type": "application/json" });
    assert.deepEqual([foreign.status, JSON.parse(foreign.body).code], [403, "app.only"]);
    assert.equal(state(w), before);
  } finally {
    await w.ok(["live", "stop"]);
    w.cleanup();
  }
});

test("the bridge: one place's requests sent at once — A sent before, B and C marked and answered; unsent only the tasks named (A stays sent), none named refused; the request texts for one e-mail; an unknown place", bridged, async () => {
  const w = await world();
  const info = (await w.ok(["live", "start", "--json"])).json;
  try {
    const status = JSON.parse((await get(`${info.url}/status?poll=1`)).body);
    const key = (status.waiting as { id: string; group: { key: string } }[]).find((i) => i.id === "T0001")!.group.key;
    assert.equal(key, "to:matricni urad lhota");
    const group = (body: unknown) => post(`${info.url}/group/${encodeURIComponent(key)}`, JSON.stringify(body), app);
    const a = (await task(w, "T1")).sent!.at;
    // the request texts of the place: each file once (two tasks name one), a line between them, the tasks
    const note = await get(`${info.url}/group/${encodeURIComponent(key)}/note`);
    assert.equal(note.status, 200, note.body);
    const nb = JSON.parse(note.body);
    assert.deepEqual([...nb.tasks].sort(), ["T0001", "T0002", "T0003"]);
    assert.deepEqual([...nb.notes].sort(), ["notes/žádost-lhota.md", "notes/žádost-úmrtí.md"]);
    assert.match(nb.text, /^Žádost o (opisy křtu a sňatku|opis úmrtního zápisu)\.\n\n-----\n\nŽádost o (opisy křtu a sňatku|opis úmrtního zápisu)\.$/u);
    assert.doesNotMatch(nb.text, /﻿/);
    // a place with no request texts: empty; an unknown place
    const family = JSON.parse((await get(`${info.url}/group/family/note`)).body);
    assert.deepEqual(family, { text: "", notes: [], tasks: ["T0005"] });
    const nowhere = await get(`${info.url}/group/${encodeURIComponent("to:nowhere")}/note`);
    assert.deepEqual([nowhere.status, JSON.parse(nowhere.body).code], [404, "group.none"]);

    // sent: B and C — A was sent before
    const s = await group({ do: "sent" });
    assert.equal(s.status, 200, s.body);
    const sb = JSON.parse(s.body);
    assert.deepEqual([...sb.sent].sort(), ["T0002", "T0003"]);
    assert.match(sb.head, /^[0-9a-f]{40}$/);
    for (const id of ["T1", "T2", "T3"]) assert.ok((await task(w, id)).sent, id);
    assert.equal((await task(w, "T1")).sent!.at, a, "A as it was");
    // again: nothing left to send there
    assert.deepEqual(JSON.parse((await group({ do: "sent" })).body).sent, []);
    // unsent without the tasks: refused, nothing changed
    const before = state(w);
    const bare = await group({ do: "unsent" });
    assert.deepEqual([bare.status, JSON.parse(bare.body).code], [400, "waiting.bad-body"]);
    assert.equal((await group({ do: "unsent", tasks: [] })).status, 400);
    assert.equal(state(w), before);
    // unsent of the tasks the sent answered: B and C back, A still sent; a task of another place named is left alone
    await post(`${info.url}/waiting/T0004`, JSON.stringify({ do: "sent" }), app);
    const u = await group({ do: "unsent", tasks: [...sb.sent, "T0004"] });
    assert.equal(u.status, 200, u.body);
    assert.deepEqual([...JSON.parse(u.body).unsent].sort(), ["T0002", "T0003"]);
    assert.deepEqual([(await task(w, "T2")).sent, (await task(w, "T3")).sent], [undefined, undefined]);
    assert.equal((await task(w, "T1")).sent!.at, a);
    assert.ok((await task(w, "T4")).sent);
    const items = JSON.parse((await get(`${info.url}/status?poll=1`)).body).waiting as { id: string; phase: string }[];
    assert.deepEqual(["T0001", "T0002", "T0003"].map((id) => items.find((i) => i.id === id)!.phase), ["sent", "todo", "todo"]);
    // an unknown place; not the app's pages
    const unknown = await post(`${info.url}/group/${encodeURIComponent("to:nowhere")}`, JSON.stringify({ do: "sent" }), app);
    assert.deepEqual([unknown.status, JSON.parse(unknown.body).code], [404, "group.none"]);
    const foreign = await post(`${info.url}/group/${encodeURIComponent(key)}`, JSON.stringify({ do: "sent" }), { "Content-Type": "application/json" });
    assert.deepEqual([foreign.status, JSON.parse(foreign.body).code], [403, "app.only"]);
    assert.match((await w.ok(["check"])).out, /^ok/);
  } finally {
    await w.ok(["live", "stop"]);
    w.cleanup();
  }
});

test("the bridge: a file for a task (X-Strom-Task) — an input of the task's people handed to it, the task back in the queue, no intake task; a task that waits no more refused before anything is kept", bridged, async () => {
  const w = await world();
  const info = (await w.ok(["live", "start", "--json"])).json;
  try {
    const png = fs.readFileSync(path.join(fixtures, "png-bw.png"));
    const send = (b: Buffer, h: Record<string, string>) => put(`${info.url}/media/${sha(b)}`, b, { ...app, ...h });
    const tasksBefore = Tree.open(w.cwd, w.env).list<Task>("task").length;
    const r = await send(png, { "X-Strom-Task": "T0003", "X-Strom-Name": encodeURIComponent("odpověď.png"), "X-Strom-Note": encodeURIComponent("Opis úmrtí") });
    assert.equal(r.status, 200, r.body);
    const rb = JSON.parse(r.body);
    assert.deepEqual([rb.input, rb.task, rb.handed, rb.state], ["I0001", "T0003", "I0001", "open"]);
    assert.equal(Tree.open(w.cwd, w.env).list<Task>("task").length, tasksBefore, "no intake task");
    const t3 = await task(w, "T3");
    assert.deepEqual([t3.state, t3.files?.[0]?.input, t3.files?.[0]?.by, t3.answers], ["open", "I0001", "app", undefined]);
    const input = (await w.ok(["input", "show", "I1", "--json"])).json.input as Input & { note?: string };
    assert.deepEqual([input.persons, input.from], [["P0002"], "the Strom app"]);
    assert.equal(history(w.cwd, Tree.open(w.cwd, w.env))[0]!.text.at(-1), "Přišel soubor I0001 k úkolu, zpět agentovi: Opis úmrtí dědy");
    // the same content for another task: handed as the input the research has
    const again = await send(png, { "X-Strom-Task": "T0002" });
    assert.equal(again.status, 200, again.body);
    assert.deepEqual([JSON.parse(again.body).handed, (await task(w, "T2")).state], ["I0001", "open"]);
    // refused before anything is kept: a task that waits no more, a check of a site, a bad header
    const before = state(w);
    const jpg = fs.readFileSync(path.join(fixtures, "s0001.jpg"));
    const gone = await send(jpg, { "X-Strom-Task": "T0003" });
    assert.deepEqual([gone.status, JSON.parse(gone.body).code, JSON.parse(gone.body).params], [409, "waiting.none", { id: "T0003" }]);
    const check = await send(jpg, { "X-Strom-Task": "T0006" });
    assert.deepEqual([check.status, JSON.parse(check.body).code], [409, "waiting.no-file"]);
    const bad = await send(jpg, { "X-Strom-Task": "P0001" });
    assert.deepEqual([bad.status, JSON.parse(bad.body).code, JSON.parse(bad.body).params], [400, "media.bad-header", { header: "X-Strom-Task" }]);
    assert.equal(state(w), before);
    assert.equal(fs.readdirSync(path.join(w.home, "shared", "media"), { recursive: true }).filter((f) => String(f).endsWith(".jpg")).length, 0, "nothing kept");
    assert.match((await w.ok(["check"])).out, /^ok/);
  } finally {
    await w.ok(["live", "stop"]);
    w.cleanup();
  }
});

test("the bridge: busy while a send is being written or another strom holds the research (503, Retry-After); a newer strom's research locked (423) — nothing marked", bridged, async () => {
  const w = await world();
  Object.assign(w.env, { STROM_SYNC_ANSWER_MS: "300", STROM_LOCK_WAIT_MS: "3000", STROM_SYNC_RETRY_MS: "300" });
  const info = (await w.ok(["live", "start", "--json"])).json;
  const lock = path.join(w.cwd, ".strom", "tree.lock");
  try {
    const send = () => post(`${info.url}/waiting/T0004`, JSON.stringify({ do: "sent" }), app);
    fs.writeFileSync(lock, JSON.stringify({ pid: process.pid, host: os.hostname(), at: new Date().toISOString(), owner: "a test" }));
    // the research held by another strom: the write waits as a writer does, then busy — nothing marked
    const held = await send();
    assert.equal(held.status, 503, held.body);
    assert.deepEqual([JSON.parse(held.body).code, JSON.parse(held.body).retry], ["research.busy", 5]);
    assert.equal((await task(w, "T4")).sent, undefined);
    // a send the bridge writes (waiting for the research): a request marked sent meanwhile is busy at once
    const given = path.join(w.dir, "given.ged");
    await w.ok(["export", "gedcom", "--for", "strom", "--images-for", "none", "--out", given]);
    const sync = await post(`${info.url}/sync`, fs.readFileSync(given, "utf8").replace(/(1 NAME Kryštof \/[^\n]*\n(?:[2-9].*\n)*)/u, "$11 OCCU mlynář\n"), app);
    assert.equal(sync.status, 202, sync.body);
    const busy = await send();
    assert.deepEqual([busy.status, JSON.parse(busy.body).code], [503, "research.busy"]);
    // free again: the send written in its turn, then the request marked
    fs.rmSync(lock);
    let free = await send();
    for (let i = 0; i < 100 && free.status === 503; i++) {
      await new Promise((r) => setTimeout(r, 200));
      free = await send();
    }
    assert.equal(free.status, 200, free.body);
    assert.ok((await task(w, "T4")).sent);
    // a research a newer strom wrote: locked, nothing written
    const cfg = readJsonFile(path.join(w.cwd, "strom.json"));
    fs.writeFileSync(path.join(w.cwd, "strom.json"), JSON.stringify({ ...cfg, schema: cfg.schema + 1, migratedWith: "9.0.0" }, null, 2));
    const key = encodeURIComponent("to:matricni urad lhota");
    for (const r of [await post(`${info.url}/waiting/T0005`, JSON.stringify({ do: "sent" }), app), await post(`${info.url}/group/${key}`, JSON.stringify({ do: "sent" }), app)]) {
      assert.equal(r.status, 423, r.body);
      assert.equal(JSON.parse(r.body).code, "locked");
    }
    fs.writeFileSync(path.join(w.cwd, "strom.json"), JSON.stringify(cfg, null, 2));
    assert.equal((await task(w, "T5")).sent, undefined);
  } finally {
    fs.rmSync(lock, { force: true });
    await w.ok(["live", "stop"]);
    w.cleanup();
  }
});
