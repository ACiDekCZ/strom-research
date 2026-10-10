// The questions about the reading of scans only a person answers (strom media calibrate --questions, --answer; the
// menu's What waits; one line of the orientation): each with what is recommended (first) and why in numbers; what
// asks an archive for more says how many requests and how long at its pace — and a person's answer only: in their
// terminal, else a window of the system, nobody to ask: exit 4. Weak negatives searched again: at most one task per
// person, at once, with the priority of the work they came from. Nothing in an archive.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { opts, program, world } from "./connectors.helpers.ts";
import { readJsonFile, World } from "../helpers.ts";
import { encodeImage } from "../../src/image/index.ts";
import { blank } from "../../src/image/image.ts";

const KEY = "claude opus";
/** A session as strom chat and strom run start one: its agent and the model they started it with recorded. */
const AGENT = { env: { CLAUDECODE: "1", STROM_MODEL: "opus" } };
const ago = (min: number) => new Date(Date.now() - min * 60_000).toISOString();

function put(file: string, lines: Record<string, unknown>[], append = false): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  (append ? fs.appendFileSync : fs.writeFileSync)(file, lines.map((l) => JSON.stringify(l)).join("\n") + "\n");
}

/** A reader's report as strom read writes it: a block per image, the first `unclear` of them unclear. */
function report(book: string, media: string[], unclear: number): string {
  return [`# Reading ${book}-test`, "Question: křty Nováků", "", ...media.map((m, i) => `## Image ${i + 1} · ${m}\nresult: ${i < unclear ? "unclear" : "nothing"}\n${i < unclear ? "illegible: jméno kmotra\n" : ""}`)].join("\n");
}

/** A reader of a book recorded as strom read records it, with its report. */
function reader(w: World, name: string, book: string, media: string[], unclear: number, min: number, key = KEY): void {
  const rel = `notes/readings/${name}.md`;
  fs.mkdirSync(path.join(w.cwd, "notes", "readings"), { recursive: true });
  fs.writeFileSync(path.join(w.cwd, rel), report(book, media, unclear));
  put(path.join(w.cwd, ".strom", "metrics", "readers.jsonl"), [{ at: ago(min), by: "agent", reader: name, kind: "read", agent: "claude", key, model: key.split(" ")[1], images: media.length, imageIds: media, views: media.length, outcome: "ok", missing: 0, ms: 60_000, report: rel }], true);
}

/**
 * A research whose book B0001 (fetched from a local archive through a connector) reads clearly worse than B0002 and
 * B0003, where a search of Jan Novák's baptism found nothing on views enlarged beyond its scans, and a sharper part of
 * one image came after it.
 */
async function weakBook() {
  const { w, a, dir } = await world();
  const manifest = path.join(dir, "connector.json");
  fs.writeFileSync(manifest, JSON.stringify({ ...readJsonFile(manifest), can: [...readJsonFile(manifest).can, "part"] }));
  program(
    dir,
    fs.readFileSync(path.join(dir, "connector.ts"), "utf8").replace(
      "} else if (BASE) {",
      `} else if (req.cmd === "part") {
  const r = req.region;
  const url = BASE + "/part/" + req.book + "/" + req.image + ".jpg?r=" + [r.x, r.y, r.w, r.h].join(",");
  const got = await get(url, { save: "p" + req.image + ".jpg" });
  if (got.status !== 200) fail("part: HTTP " + got.status);
  image(req.image, "p" + req.image + ".jpg", url);
} else if (BASE) {`,
    ),
  );
  await w.ok(["research", "new", "Předci Jana Nováka", "--new-person", "Jan /Novák/", "--sex", "M", "--born", "ABT 1905", "--born-place", "Týnec nad Labem"]);
  await w.ok(["recordset", "add", "Týnec N 1784–1820", "--kinds", "baptism"]); // B0001
  await w.ok(["recordset", "add", "Taufbuch Lidice 1820–1850", "--kinds", "baptism"]); // B0002
  await w.ok(["recordset", "add", "Метрическая книга Луга 1850–1870", "--kinds", "baptism"]); // B0003
  await w.ok(["fetch", "zkusebni", "5359", "--images", "1-2", "--recordset", "B1"]); // M0001, M0002
  const media: Record<string, string[]> = { B0001: ["M0001", "M0002"] };
  for (const [i, id] of ["B0002", "B0003"].entries()) {
    const folder = path.join(w.dir, `kniha ${i + 2} ž`);
    fs.mkdirSync(folder);
    for (let n = 1; n <= 3; n++) fs.writeFileSync(path.join(folder, `s${String(n).padStart(4, "0")}.jpg`), encodeImage(blank(300, 200, 1, 60 + i * 30 + n), "jpeg"));
    await w.ok(["media", "add", folder, "--recordset", id]);
    media[id] = (await w.ok(["media", "list", "--recordset", id, "--json"])).json.media.map((m: { id: string }) => m.id);
  }
  const task = (await w.ok(["task", "add", "Křest Jana Nováka (~1905)", "--level", "link", "--where", "B0001", "--why", "otec", "--done-when", "nalezen", "--about", "P0001", "--priority", "4", "--json"])).json.task.id;
  await w.ok(["session", "start", task], AGENT);
  await w.ok(["search", "add", "Křty Novák", "--recordset", "B0001", "--pages", "1-2", "--method", "page-by-page", "--result", "negative"]);
  // the session's views of the book: enlarged beyond the scans' detail
  put(
    path.join(w.cwd, ".strom", "views", "views.jsonl"),
    media.B0001!.map((m, i) => ({ at: new Date().toISOString(), key: m, by: "N0001", view: `${m}-v.jpg`, region: { x: 0, y: 0, w: 400, h: 300 }, scale: 2, w: 800, h: 600, W: 400, H: 300, kind: "whole", rs: "B0001", img: i + 1 })),
    true,
  );
  await w.ok(["session", "close", "--continue", "--summary", "nic", "--next", "dál"]);
  // another task of the same person, lower, its search negative on the same weak views
  const other = (await w.ok(["task", "add", "Kmotrovství Jana Nováka", "--level", "enrich", "--where", "B0001", "--why", "kmotři", "--done-when", "nalezeno", "--about", "P0001", "--priority", "2", "--json"])).json.task.id;
  await w.ok(["session", "start", other], AGENT);
  await w.ok(["search", "add", "Kmotři Novák", "--recordset", "B0001", "--pages", "1-2", "--method", "page-by-page", "--result", "negative"]);
  put(
    path.join(w.cwd, ".strom", "views", "views.jsonl"),
    media.B0001!.map((m, i) => ({ at: new Date().toISOString(), key: m, by: "N0002", view: `${m}-w.jpg`, region: { x: 0, y: 0, w: 400, h: 300 }, scale: 2, w: 800, h: 600, W: 400, H: 300, kind: "whole", rs: "B0001", img: i + 1 })),
    true,
  );
  await w.ok(["session", "close", "--continue", "--summary", "nic", "--next", "dál"]);
  // later, a sharper part of image 1: twice the detail
  await w.ok(["fetch", "zkusebni", "--recordset", "B1", "--images", "1", "--crop", "0,0,0.5,0.5"]);
  // readers: B0001 mostly unsure, the other books sure
  const twelve = (ids: string[]) => Array.from({ length: 12 }, (_, i) => ids[i % ids.length]!);
  reader(w, "read-b1-1", "B0001", twelve(media.B0001!), 10, 300);
  reader(w, "read-b1-2", "B0001", twelve(media.B0001!), 10, 200);
  reader(w, "read-b2", "B0002", twelve(media.B0002!), 0, 150);
  reader(w, "read-b3", "B0003", twelve(media.B0003!), 0, 100);
  return { w, a, task };
}

test("weak negatives and sharper parts: asked with a recommendation, the requests per host, a stable ID; a person answers, an agent cannot; at most one task per person", opts, async () => {
  const { w, a, task } = await weakBook();
  const list = (await w.ok(["media", "calibrate", "--questions", "--json"])).json;
  assert.equal(list.key, KEY);
  const weak = list.questions.find((q: { kind: string }) => q.kind === "negatives.weak");
  const sharper = list.questions.find((q: { kind: string }) => q.kind === "views.sharper");
  assert.ok(weak && sharper, JSON.stringify(list.questions.map((q: { kind: string }) => q.kind)));
  // a stable ID, never one of a search's
  assert.match(weak.id, /^Q(?=[0-9a-f]*[a-f])[0-9a-f]{6}$/);
  assert.deepEqual((await w.ok(["media", "calibrate", "--questions", "--json"])).json.questions.map((q: { id: string }) => q.id), list.questions.map((q: { id: string }) => q.id));
  assert.deepEqual(weak.key, { agent: "claude", model: "opus", reported: "opus", recordset: "B0001", host: "127.0.0.1" });
  // the weak negatives: one person on the tree's edge to search again for; the images without a sharper copy counted
  assert.deepEqual(weak.choices.map((c: { id: string }) => c.id), ["edge", "brief", "no"]);
  assert.equal(weak.recommended, "edge");
  assert.equal(weak.choices[0].tasks, 1);
  assert.deepEqual(weak.choices[0].requests, [{ host: "127.0.0.1", n: 1, minutes: 1 }]);
  assert.match(weak.text, /^Kniha B0001 \(Týnec N 1784–1820\): záporů na slabých skenech 2, teď je tu ostřejší kopie\. Hledat znovu\?$/, weak.text);
  assert.match(weak.why, /2× víc detailu/, weak.why);
  assert.equal(weak.basis.metric, "weakNegatives");
  assert.match(weak.fingerprint, /^sha1:[0-9a-f]{40}$/);
  // sharper parts: more requests than a tenth of the day's at the archive — "no" recommended, first
  assert.deepEqual(sharper.choices.map((c: { id: string }) => c.id), ["no", "yes", "later"]);
  assert.equal(sharper.recommended, "no");
  const yes = sharper.choices.find((c: { id: string }) => c.id === "yes");
  assert.deepEqual(yes.requests, [{ host: "127.0.0.1", n: 19, minutes: 1 }]);
  assert.match(yes.label, /19 požadavků navíc na 127\.0\.0\.1, asi 1 min v jeho tempu/, yes.label);
  assert.match(sharper.why, /Požadavků navíc 19 proti 3 za den na 127\.0\.0\.1 – víc než desetina: archiv se šetří\./, sharper.why);
  // as text: what, why, the choices with the recommended one marked, the command — answered by a person only
  const text = (await w.ok(["media", "calibrate", "--questions"])).out;
  assert.match(text, /^Otázky ke čtení snímků · Claude Code · opus – rozhoduje člověk; bez odpovědi se nic nemění:$/m, text);
  assert.match(text, new RegExp(`^ {4}strom media calibrate --answer ${weak.id}=edge$`, "m"), text);
  assert.match(text, /^ {4}no: Ne \(doporučeno\)$/m, text);
  assert.match(text, /^Odpovídá jen člověk/m, text);
  // the summary says they wait, its JSON has them
  const summary = await w.ok(["media", "calibrate", "--report", "--json"]);
  assert.deepEqual(summary.json.questions.map((q: { id: string }) => q.id).sort(), list.questions.map((q: { id: string }) => q.id).sort());

  // nobody to ask (no terminal, no window): exit 4, nothing kept, no task
  const tasks = () => (w.ok(["task", "list", "--state", "all", "--json"]) as Promise<{ json: { tasks: { id: string; origin: string; subject: string[]; priority: number; state: string }[] } }>).then((r) => r.json.tasks);
  const before = (await tasks()).length;
  const nobody = await w.run(["media", "calibrate", "--answer", `${weak.id}=edge`]);
  assert.equal(nobody.code, 4, nobody.out + nobody.err);
  assert.equal(fs.existsSync(path.join(w.cwd, ".strom", "tune", "answers.json")), false);
  assert.equal((await tasks()).length, before);
  // an agent: the person says no in the window — nothing
  const refused = await w.run(["media", "calibrate", "--answer", `${weak.id}=edge`], { env: { CLAUDECODE: "1" }, dialog: false });
  assert.notEqual(refused.code, 0);
  assert.equal((await tasks()).length, before);
  // a choice it does not have
  assert.equal((await w.run(["media", "calibrate", "--answer", `${weak.id}=maybe`], { tty: true })).code, 2);
  // an agent asks, the person says yes in the window: one task for Jan, at once, with the priority of his task
  const yes2 = await w.ok(["media", "calibrate", "--answer", `${weak.id}=edge`, "--json"], { env: { CLAUDECODE: "1" }, dialog: true });
  assert.equal(yes2.json.by, "window");
  const added = (await tasks()).filter((t) => readJsonFile(path.join(w.cwd, "data", "tasks", `${t.id}.json`)).origin === "tune:negatives");
  assert.equal(added.length, 1);
  assert.deepEqual([added[0]!.subject, added[0]!.priority, added[0]!.state], [["P0001"], 4, "open"]);
  assert.match(readJsonFile(path.join(w.cwd, "data", "tasks", `${added[0]!.id}.json`)).what, /^Znovu hledat: Jan Novák .* v knize Týnec N 1784–1820/);
  assert.deepEqual(yes2.json.tasks, [added[0]!.id]);
  const subject = execFileSync("git", ["log", "-1", "--format=%s"], { cwd: w.cwd, encoding: "utf8" });
  assert.match(subject, new RegExp(`\\+${added[0]!.id} task`), "committed");
  const kept = readJsonFile(path.join(w.cwd, ".strom", "tune", "answers.json"));
  assert.deepEqual([kept[KEY]["negatives.weak:B0001"].choice, kept[KEY]["negatives.weak:B0001"].by, kept[KEY]["negatives.weak:B0001"].fingerprint], ["edge", "window", weak.fingerprint]);
  // answered: not asked again until the data change — held
  const after = (await w.ok(["media", "calibrate", "--questions", "--json"])).json;
  assert.equal(after.questions.some((q: { id: string }) => q.id === weak.id), false);
  assert.equal(after.held.find((q: { id: string }) => q.id === weak.id).answered.choice, "edge");
  // Jan has his task now (one, though two searches of his were weak): nobody to add one for — edge is no longer offered
  assert.deepEqual(after.held.find((q: { id: string }) => q.id === weak.id).choices.map((c: { id: string }) => c.id), ["brief", "no"]);
  assert.equal((await w.run(["media", "calibrate", "--answer", `${weak.id}=edge`], { tty: true })).code, 2);
  assert.equal((await tasks()).length, before + 1);
  void task;
  w.cleanup();
  await a.close();
});

test("at a person's terminal each question is asked in turn: Enter takes the recommended, 0 goes back with nothing changed; the menu's What waits shows them", opts, async () => {
  const { w, a } = await weakBook();
  const list = (await w.ok(["media", "calibrate", "--questions", "--json"])).json;
  const first = list.questions[0];
  // 0: back, nothing kept
  const back = await w.ok(["media", "calibrate", "--questions"], { tty: true, answers: ["0"] });
  assert.match(back.out, /\(doporučeno\)/);
  assert.equal(fs.existsSync(path.join(w.cwd, ".strom", "tune", "answers.json")), false);
  // the orientation: one line, the command (an agent tells the person)
  const o = await w.ok([], { env: { CLAUDECODE: "1" } });
  assert.match(o.out, /otázky ke čtení čekají na rozhodnutí člověka \(2\): strom media calibrate --questions/, o.out);
  assert.equal((await w.ok(["--json"], { env: { CLAUDECODE: "1" } })).json.tune.questions, 2);
  // the menu: What waits counts them and answers one (Enter: the recommended), then back
  const menu = await w.ok(["menu"], { tty: true, answers: ["3", "1", "", "0", "0"] });
  assert.match(menu.out, /Co čeká \(2\)/, menu.out);
  assert.match(menu.out, /Otázka ke čtení snímků: /, menu.out);
  assert.match(menu.out, /✓ Odpověď uložena: /, menu.out);
  const kept = readJsonFile(path.join(w.cwd, ".strom", "tune", "answers.json"))[KEY];
  const slot = `${first.kind}:B0001`;
  assert.deepEqual([kept[slot].choice, kept[slot].by], [first.recommended, "terminal"]);
  // Enter at the command's own walk: the recommended of the one left
  const rest = (await w.ok(["media", "calibrate", "--questions", "--json"])).json.questions;
  assert.equal(rest.length, 1);
  await w.ok(["media", "calibrate", "--questions"], { tty: true, answers: [""] });
  assert.equal(readJsonFile(path.join(w.cwd, ".strom", "tune", "answers.json"))[KEY][`${rest[0].kind}:B0001`].choice, rest[0].recommended);
  assert.equal((await w.ok(["media", "calibrate", "--questions", "--json"])).json.questions.length, 0);
  assert.doesNotMatch((await w.ok([])).out, /otázky ke čtení/);
  w.cleanup();
  await a.close();
});

test("an archive asks nothing about the reading of scans and says nothing of it", opts, async () => {
  const { w, a } = await weakBook();
  assert.ok((await w.ok(["media", "calibrate", "--questions", "--json"])).json.questions.length > 0);
  await w.ok(["mode", "archive"], { tty: true });
  const r = await w.ok(["media", "calibrate", "--questions", "--json"]);
  assert.deepEqual(r.json.questions, []);
  assert.doesNotMatch((await w.ok([])).out, /otázky ke čtení/);
  assert.doesNotMatch((await w.ok(["menu"], { tty: true, answers: ["3", "0", "0"] })).out, /čtení snímků/);
  w.cleanup();
  await a.close();
});
