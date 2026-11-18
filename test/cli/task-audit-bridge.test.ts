// How a task's wait is written, checked, through the bridge (spec 109 U2, feature tasks.audit): /status waiting items
// carry `audit` {kinds, fix, stamp} while the wait is not as strom needs it and the person did not keep it as it is; GET
// /waiting/<T…>/fix says the fix strom proposes now; POST /waiting/<T…> {"do": "fix" | "unfix" | "keep" | "unkeep"} writes
// it as the person's, given in the app — refused when the task changed since, when nothing is found, when the fix's
// tasks changed since it.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { World, hasGit } from "../helpers.ts";
import { Tree } from "../../src/core/tree.ts";
import { inboxFolderFor } from "../../src/core/media.ts";
import { SETTLE_MS } from "../../src/core/inboxwait.ts";
import type { Media, Task } from "../../src/core/model.ts";
import { get, post } from "./sync.helpers.ts";

const bridged = { skip: !hasGit || process.platform === "win32", timeout: 240_000 };
const app = { Origin: "https://beta.stromapp.info", "Content-Type": "application/json" };
const fixtures = path.join(import.meta.dirname, "..", "fixtures", "images");

const LHOTA = "Lhota 3, N 1784–1820";
const TEXT = "Snímky 57–58 z knihy Lhota 3, N 1784–1820 a snímek 14 z knihy Vranov 9, O 1801–1850 (https://archive.example.org/vranov/9) k ručnímu uložení";

/**
 * A research with the book B0003 of Lhota: T0001 waits for images of two books in words (one the research does not
 * have), T0002 for images of Lhota in words, T0003 for a letter of the registry office (as strom needs it), T0004 open.
 */
async function world(): Promise<{ w: World; shared: string }> {
  const w = new World();
  await w.withTree("Lhotákovi");
  await w.ok(["research", "new", "Předci Vojtěcha", "--new-person", "Vojtěch /Lhoták/", "--sex", "M", "--born", "1790"]);
  await w.ok(["recordset", "add", "Podhradí 1, N 1700–1750", "--access", "online-free", "--url", "https://archive.example.org/podhradi/1"]);
  await w.ok(["recordset", "add", "Podhradí 2, O 1750–1800", "--access", "online-free", "--url", "https://archive.example.org/podhradi/2"]);
  await w.ok(["recordset", "add", LHOTA, "--access", "online-free", "--url", "https://archive.example.org/lhota/3"]);
  const add = (what: string) => w.ok(["task", "add", what, "--level", "link", "--where", "B0003", "--why", "rodiče Vojtěcha", "--done-when", "zápis nalezen", "--about", "P1", "--anyway"]);
  await add("Křest Vojtěcha Lhotáka (~1790)"); // T0001
  await add("Sňatek rodičů Vojtěcha"); // T0002
  await add("Opis křtu z matričního úřadu"); // T0003
  await add("Úmrtí Vojtěcha"); // T0004, open
  waitAs(w, "T0001", { waitingOn: TEXT });
  // (its where another book: never woken by the images of Lhota the fix of T0001 takes)
  waitAs(w, "T0002", { waitingOn: "Snímky 10–12 z knihy Lhota 3, N 1784–1820".normalize("NFD"), where: ["B0001"] });
  waitAs(w, "T0003", { waitingOn: "Odpověď matričního úřadu v Lhotě na dotaz", wait: { kind: "letter" } });
  return { w, shared: path.join(w.home, "shared") };
}

/** A task set waiting as an older strom (or an agent before the check) wrote it: straight into the research. */
function waitAs(w: World, id: string, fields: Partial<Task>): void {
  const tree = Tree.open(w.cwd, w.env);
  tree.withTreeLock(() => {
    const t = tree.get<Task>(id)!;
    tree.put({ ...t, state: "waiting", ...fields, updated: new Date().toISOString() }, { op: "task.wait", targets: [id], summary: `${id} wait` });
  });
  tree.commit(`${id} wait`);
}

const task = (w: World, id: string): Task => Tree.open(w.cwd, w.env).get<Task>(id)!;
const waitOf = (t: Task) => ({ state: t.state, waitingOn: t.waitingOn, wait: t.wait, awaits: t.awaits, where: t.where });
const json = (r: { body: string }) => JSON.parse(r.body);

/** /status as soon as it is made for the research as it is now (its head). */
async function status(w: World, url: string, extra = ""): Promise<Record<string, any>> {
  const head = execFileSync("git", ["-C", w.cwd, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  for (let i = 0; ; i++) {
    const s = json(await get(`${url}/status?poll=1${extra}`));
    if (s.head === head || i > 100) return s;
    await new Promise((r) => setTimeout(r, 100));
  }
}
const item = (s: Record<string, any>, id: string) => (s.waiting as { id: string; audit?: unknown }[]).find((x) => x.id === id);

/** A file saved long enough ago to have settled. */
function saved(to: string, image: string): void {
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(path.join(fixtures, image), to);
  const past = new Date(Date.now() - 2 * SETTLE_MS);
  fs.utimesSync(to, past, past);
}

test("the bridge says what the audit finds: tasks.audit, `audit` on an item whose wait is not as strom needs it (never on one kept as it is), GET /waiting/<T…>/fix; kept and taken back from the app", bridged, async () => {
  const { w } = await world();
  const info = (await w.ok(["live", "start", "--json"])).json;
  try {
    let s = await status(w, info.url);
    assert.ok(s.features.includes("tasks.audit"), JSON.stringify(s.features));
    const t1 = task(w, "T0001");
    assert.deepEqual(item(s, "T0001")?.audit, { kinds: ["images-as-text", "several-books", "book-unknown"], fix: "part", stamp: `T0001@${t1.updated}` });
    const t2 = task(w, "T0002");
    assert.deepEqual(item(s, "T0002")?.audit, { kinds: ["images-as-text"], fix: "whole", stamp: `T0002@${t2.updated}` });
    assert.ok(item(s, "T0003"), "the letter waits");
    assert.equal(item(s, "T0003")!.audit, undefined, "a letter: nothing to check");

    // the fix proposed, as strom task audit T… --json says it
    const fix = await get(`${info.url}/waiting/T1/fix`);
    assert.equal(fix.status, 200, fix.body);
    const f = json(fix);
    const cli = (await w.ok(["task", "audit", "T0001", "--json"])).json.tasks[0];
    assert.deepEqual(f, cli);
    assert.deepEqual(Object.keys(f), ["task", "at", "findings", "fix", "kept", "fixed"]);
    const folder = inboxFolderFor({ id: "B0003", title: LHOTA });
    assert.deepEqual(f.fix.changes, [
      { op: "wait-images", task: "T0001", book: "B0003", title: LHOTA, images: "57–58", folder },
      { op: "split", task: null, from: "T0001", title: "Vranov 9, O 1801–1850", images: "14", url: "https://archive.example.org/vranov/9", waits: "text" },
    ]);
    assert.deepEqual([f.fix.can, f.fix.stamp, f.fix.left], ["part", `T0001@${t1.updated}`, ["book-unknown"]]);
    const none = await get(`${info.url}/waiting/T0003/fix`);
    assert.deepEqual([none.status, json(none).code, json(none).params], [409, "audit.none", { id: "T0003" }]);
    for (const id of ["T0004", "T0099", "X1"]) {
      const r = await get(`${info.url}/waiting/${id}/fix`);
      assert.deepEqual([r.status, json(r).code], [404, "waiting.none"], id);
    }

    // kept as it is from the app: the person's, given in the app — the item says no more, the part's rev moves
    const send = (id: string, body: unknown) => post(`${info.url}/waiting/${id}`, JSON.stringify(body), app);
    const revBefore = (await status(w, info.url, "&parts=1")).parts.waiting;
    const stale = await send("T0002", { do: "keep", expect: "T0002@2020-01-01T00:00:00.000Z" });
    assert.deepEqual([stale.status, json(stale).code, json(stale).params], [409, "waiting.changed", { id: "T0002", at: t2.updated }]);
    const kept = await send("T0002", { do: "keep", expect: `T0002@${t2.updated}` });
    assert.equal(kept.status, 200, kept.body);
    const k = json(kept);
    assert.deepEqual(Object.keys(k).sort(), ["head", "kept", "parent", "task"]);
    assert.equal(k.task, "T0002");
    assert.deepEqual([k.kept.by, k.kept.givenIn, k.kept.kinds], ["app", "app", ["images-as-text"]]);
    assert.match(k.head, /^[0-9a-f]{40}$/);
    assert.notEqual(k.parent, k.head);
    assert.deepEqual(task(w, "T0002").auditKept?.givenIn, "app");
    s = await status(w, info.url);
    assert.ok(item(s, "T0002"), "it still waits");
    assert.equal(item(s, "T0002")!.audit, undefined, "kept as it is: no audit");
    assert.ok(item(s, "T0001")!.audit, "the others still say it");
    assert.notEqual((await status(w, info.url, "&parts=1")).parts.waiting, revBefore, "the part's rev moves");
    // the preview still says it, and that it is kept
    assert.equal(json(await get(`${info.url}/waiting/T0002/fix`)).kept.by, "app");

    const unkept = await send("T0002", { do: "unkeep" });
    assert.equal(unkept.status, 200, unkept.body);
    assert.deepEqual([json(unkept).task, json(unkept).kept], ["T0002", null]);
    assert.ok(json(unkept).parent);
    assert.equal(task(w, "T0002").auditKept, undefined);
    s = await status(w, info.url);
    assert.deepEqual((item(s, "T0002")!.audit as { kinds: string[] }).kinds, ["images-as-text"], "offered again");
    const again = await send("T0002", { do: "unkeep" });
    assert.deepEqual([again.status, json(again).code], [409, "audit.none"]);
    const letter = await send("T0003", { do: "keep" });
    assert.deepEqual([letter.status, json(letter).code], [409, "audit.none"]);
  } finally {
    await w.ok(["live", "stop"]);
    w.cleanup();
  }
});

test("the bridge writes the audit's fix as the person's (one book per task, what lies in its folder taken), undoes it while nothing changed; refused — the task changed since, nothing found, a bad body", bridged, async () => {
  const { w, shared } = await world();
  const info = (await w.ok(["live", "start", "--json"])).json;
  try {
    const send = (id: string, body: unknown, headers: Record<string, string> = app) => post(`${info.url}/waiting/${id}`, typeof body === "string" ? body : JSON.stringify(body), headers);
    const before = task(w, "T0001");
    const stamp = `T0001@${before.updated}`;
    // bodies refused before anything is read
    for (const body of [{ do: "mend" }, { do: "fix", expect: 5 }, { do: "fix", expect: "" }, { do: "unfix", expect: stamp }, { do: "unkeep", expect: stamp }]) {
      const r = await send("T0001", body);
      assert.deepEqual([r.status, json(r).code], [400, "waiting.bad-body"], JSON.stringify(body));
    }
    assert.match(json(await send("T0001", { do: "mend" })).error, /"fix" \| "unfix" \| "keep" \| "unkeep"/);
    const foreign = await send("T0001", { do: "fix" }, { "Content-Type": "application/json" });
    assert.deepEqual([foreign.status, json(foreign).code], [403, "app.only"]);
    const stale = await send("T0001", { do: "fix", expect: "T0001@2020-01-01T00:00:00.000Z" });
    assert.deepEqual([stale.status, json(stale).code, json(stale).params], [409, "waiting.changed", { id: "T0001", at: before.updated }]);
    const letter = await send("T0003", { do: "fix" });
    assert.deepEqual([letter.status, json(letter).code, json(letter).params], [409, "audit.none", { id: "T0003" }]);
    for (const id of ["T0004", "T0099"]) {
      const r = await send(id, { do: "fix" });
      assert.deepEqual([r.status, json(r).code], [404, "waiting.none"], id);
    }
    const nothing = await send("T0001", { do: "unfix" });
    assert.deepEqual([nothing.status, json(nothing).code], [409, "audit.none"]);
    assert.deepEqual(waitOf(task(w, "T0001")), waitOf(before), "nothing written");

    // its images saved already: the fix takes them, the task back in the queue
    const folder = inboxFolderFor({ id: "B0003", title: LHOTA });
    saved(path.join(shared, "inbox", folder, "57.jpg"), "s0001.jpg");
    saved(path.join(shared, "inbox", folder, "58.jpg"), "s0002.jpg");
    const fixed = await send("T0001", { do: "fix", expect: stamp });
    assert.equal(fixed.status, 200, fixed.body);
    const f = json(fixed);
    assert.deepEqual(Object.keys(f).sort(), ["head", "parent", "task", "tasks", "woke"]);
    assert.deepEqual([f.task, f.tasks, f.woke], ["T0001", ["T0001", "T0005"], ["T0001"]]);
    assert.match(f.head, /^[0-9a-f]{40}$/);
    assert.notEqual(f.parent, f.head);
    const t1 = task(w, "T0001");
    assert.equal(t1.state, "open", "its images were there");
    assert.deepEqual([t1.auditFix?.by, t1.auditFix?.givenIn, t1.auditFix?.made], ["app", "app", ["T0005"]]);
    const split = task(w, "T0005");
    assert.deepEqual([split.splitFrom, split.state, split.what], ["T0001", "waiting", before.what]);
    assert.ok(!split.where.includes("B0003"));
    // one operation of the audit's
    const ops = fs
      .readdirSync(path.join(w.cwd, "data", "ops"), { recursive: true, encoding: "utf8" })
      .filter((f) => f.endsWith(".jsonl"))
      .flatMap((f) => fs.readFileSync(path.join(w.cwd, "data", "ops", f), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l) as { op: string; targets?: string[] }));
    assert.ok(ops.some((o) => o.op === "task.audit-fix" && o.targets?.includes("T0005")), "op task.audit-fix");
    const images = () =>
      Tree.open(w.cwd, w.env)
        .list<Media>("media")
        .filter((m) => m.recordset === "B0003" && !m.retracted)
        .map((m) => m.image)
        .sort();
    assert.deepEqual(images(), [57, 58]);
    // the task split off still waits for a book the research does not have: its item says so, nothing left to fix
    assert.deepEqual(item(await status(w, info.url), "T0005")?.audit, { kinds: ["book-unknown"], fix: "none", stamp: `T0005@${split.updated}` });

    // undone: the task waits as it did, the task split off taken back, the images registered stay
    const undone = await send("T0001", { do: "unfix" });
    assert.equal(undone.status, 200, undone.body);
    const u = json(undone);
    assert.deepEqual(Object.keys(u).sort(), ["head", "parent", "task", "tasks"]);
    assert.deepEqual([u.task, u.tasks], ["T0001", ["T0001", "T0005"]]);
    assert.deepEqual(waitOf(task(w, "T0001")), waitOf(before));
    assert.ok(task(w, "T0005").retracted, "taken back, not deleted");
    assert.deepEqual(images(), [57, 58]);
    const twice = await send("T0001", { do: "unfix" });
    assert.deepEqual([twice.status, json(twice).code], [409, "audit.none"]);

    // fixed again, a task of it changed since: not undone, the app told which
    const third = json(await send("T0001", { do: "fix" }));
    assert.equal(third.tasks.length, 2, JSON.stringify(third));
    const made = third.tasks[1] as string;
    await w.ok(["task", "edit", made, "--priority", "2"]);
    const refused = await send("T0001", { do: "unfix" });
    assert.equal(refused.status, 409, refused.body);
    const r = json(refused);
    assert.deepEqual([r.code, r.params, r.changed], ["audit.changed", { id: "T0001", changed: made }, [made]]);
    assert.ok(task(w, "T0001").auditFix, "nothing undone");
  } finally {
    await w.ok(["live", "stop"]);
    w.cleanup();
  }
});

test("tasks.audit is a feature of an archive's bridge too (nothing of an agent in it)", bridged, async () => {
  const { w } = await world();
  await w.ok(["mode", "archive"], { tty: true, answers: ["a"] });
  const info = (await w.ok(["live", "start", "--json"])).json;
  try {
    const s = json(await get(`${info.url}/status?poll=1`));
    assert.equal(s.tree.state, "archive");
    assert.ok(s.features.includes("tasks.audit"), JSON.stringify(s.features));
  } finally {
    await w.ok(["live", "stop"]);
    w.cleanup();
  }
});
