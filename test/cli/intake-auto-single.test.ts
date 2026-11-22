// A file sent to the research starts nothing of an agent by itself (spec 130 K1.3): with intake.auto off — the default —
// a single original of the Strom app (no batch, at once or queued with Prefer: respond-async), the scan of a source, the
// same file sent again with more said of it, a file shown again, strom input amend and the person's strom intake of
// files make no task — the file waits in the material (new); on, each makes its task as before. What the person asks
// for goes on whatever the setting: strom intake --sort, strom task add --level intake, a file for a waiting task, the
// person's own words (strom intake --text).

import { test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { World, hasGit, until } from "../helpers.ts";
import { Tree } from "../../src/core/tree.ts";
import type { Input, Task } from "../../src/core/model.ts";

const opts = { skip: !hasGit || process.platform === "win32", timeout: 240_000 };
const app = { Origin: "https://beta.stromapp.info" };
const fixtures = path.join(import.meta.dirname, "..", "fixtures", "images");
const sha = (b: Buffer) => crypto.createHash("sha256").update(b).digest("hex");
const jpg = fs.readFileSync(path.join(fixtures, "base420.jpg"));
/** A JPEG of its own content: bytes after its end the decoders leave alone. */
const jpgNo = (n: number) => Buffer.concat([jpg, Buffer.from(`#${n}`)]);

function request(method: string, url: string, body?: Buffer, headers: Record<string, string> = {}): Promise<{ status: number; body: Buffer }> {
  return new Promise((resolve, reject) => {
    const req = http.request(url, { method, headers: { ...(body ? { "Content-Length": String(body.length) } : {}), ...headers } }, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (d: Buffer) => chunks.push(d));
      res.on("end", () => resolve({ status: res.statusCode ?? 0, body: Buffer.concat(chunks) }));
    });
    req.on("error", reject);
    req.end(body);
  });
}
const json = (r: { body: Buffer }) => JSON.parse(r.body.toString("utf8"));
const tasks = (w: World) => Tree.open(w.cwd, w.env).list<Task>("task");
const input = (w: World, id: string) => Tree.open(w.cwd, w.env).get<Input>(id)!;

/** A file of the app as the bridge takes it (strom media original), its own content by n. */
async function original(w: World, n: number, name: string, more: string[] = []) {
  const f = path.join(w.dir, `orig-${n}.jpg`);
  fs.writeFileSync(f, jpgNo(n));
  return (await w.ok(["media", "original", f, "--name", name, ...more, "--json"])).json;
}

test("intake.auto off: a single original, the scan of a source, the same file again, input amend, unskip and the person's strom intake make no task — they wait; --sort, task add, --text go on; on: each its task as before", opts, async () => {
  const w = new World();
  try {
    await w.withTree("Lhotákovi");
    await w.ok(["lang", "cs"]);
    await w.ok(["person", "add", "Vojtěch /Lhoták/", "--sex", "M"]); // P0001
    await w.ok(["person", "add", "Анна /Лготак/", "--sex", "F"]); // P0002
    await w.ok(["source", "add", "Křest Vojtěcha Lhotáka", "--kind", "baptism"]); // S0001
    assert.equal((await w.ok(["config", "get", "intake.auto", "--json"])).json.value, "off");
    const before = tasks(w).length;

    // a single original of the app, no batch: an input, no task
    const one = await original(w, 1, "Dopis z Lhoty.jpg".normalize("NFD"), ["--person", "P0001"]);
    assert.match(one.input, /^I\d{4}$/);
    assert.equal(one.task, undefined);
    assert.equal(input(w, one.input).state, "new");
    // the scan of a source (a task to read it, with intake.auto on, only for a source of the app: originals.test.ts)
    const scan = await original(w, 2, "sken.jpg", ["--source", "S0001"]);
    assert.match(scan.media, /^M\d{4}$/);
    assert.equal(scan.task, undefined);
    // the same file again with more said of it: added, still no task
    const again = await original(w, 1, "Dopis z Lhoty.jpg", ["--person", "P0002", "--note", "Babiččin dopis"]);
    assert.deepEqual([again.known, again.added.persons, again.task], [one.input, ["P0002"], undefined]);
    // strom input amend (the app's later word of a file): added, no task
    const amended = (await w.ok(["input", "amend", one.input, "--note", "Psáno v Lhotě", "--json"])).json;
    assert.equal(amended.added.note, true);
    assert.equal(amended.task, undefined);
    // hidden and shown again: waits, no task
    await w.ok(["input", "hide", one.input]);
    const shown = (await w.ok(["input", "unskip", one.input, "--json"])).json;
    assert.deepEqual([shown.changed, shown.tasks], [[one.input], []]);
    assert.equal(input(w, one.input).state, "new");
    // the person's strom intake of files (the menu runs it): registered, waiting — said in the research's language
    const folder = path.join(w.dir, "Půda");
    fs.mkdirSync(folder);
    fs.writeFileSync(path.join(folder, "a.jpg"), jpgNo(3));
    fs.writeFileSync(path.join(folder, "Фото.jpg".normalize("NFD")), jpgNo(4));
    const kept = await w.ok(["intake", folder, "--person", "P0001"]);
    assert.match(kept.out, /Čeká neroztříděno v Materiálech: 2/u);
    fs.writeFileSync(path.join(w.dir, "d.jpg"), jpgNo(9));
    const keptJson = (await w.ok(["intake", path.join(w.dir, "d.jpg"), "--json"])).json;
    assert.deepEqual([keptJson.sort, keptJson.auto, keptJson.waiting], [false, false, [keptJson.inputs[0].id]]);
    assert.equal(tasks(w).length, before, "nothing for an agent of all that");

    // asked for: --sort makes the tasks although off; the person's words always; a task the person gives
    fs.writeFileSync(path.join(w.dir, "b.jpg"), jpgNo(5));
    const sorted = (await w.ok(["intake", path.join(w.dir, "b.jpg"), "--sort", "--json"])).json;
    assert.deepEqual([sorted.sort, sorted.waiting], [true, []]);
    assert.equal(tasks(w).length, before + 1);
    // said as such whatever the task is (one that waits for nothing, none at all): checked before the task is looked up
    for (const t of ["T0001", "T0999"]) {
      const both = await w.run(["intake", path.join(w.dir, "b.jpg"), "--sort", "--answers", t, "--json"], { env: { AI_AGENT: "1" } });
      assert.equal(both.code, 2, t);
      assert.match(both.json.message, /--answers hands the files to that task: no tasks of their own to sort them/u, t);
    }
    await w.ok(["intake", "--text", "Děda Vojtěch byl mlynář v Lhotě"]);
    assert.equal(tasks(w).length, before + 2);
    const added = (await w.ok(["task", "add", "Rozebrat dopis z Lhoty", "--level", "intake", "--where", one.input, "--about", "P0001", "--why", "dopis poslala rodina", "--done-when", "rozebráno", "--json"])).json;
    assert.equal(tasks(w).find((t) => t.id === (added.task?.id ?? added.id))?.where[0], one.input);

    // on (the person's switch): each makes its task as before
    await w.ok(["config", "set", "intake.auto", "on", "--for-tree"], { tty: true });
    const on = await original(w, 6, "Fotka.jpg", ["--person", "P0002"]);
    const gather = tasks(w).find((t) => t.id === on.task)!;
    assert.deepEqual([gather.level, gather.origin, gather.where], ["intake", "app:media", [on.input]]);
    // a file worked through, said of again: back in a task
    await w.ok(["task", "drop", on.task, "--reason", "rozebráno"]);
    const onAgain = (await w.ok(["input", "amend", on.input, "--person", "P0001", "--json"])).json;
    assert.match(onAgain.task, /^T\d{4}$/);
    await w.ok(["task", "drop", onAgain.task, "--reason", "rozebráno"]);
    await w.ok(["input", "hide", on.input]);
    assert.equal((await w.ok(["input", "unskip", on.input, "--json"])).json.tasks.length, 1);
    fs.writeFileSync(path.join(w.dir, "c.jpg"), jpgNo(8));
    const onIntake = (await w.ok(["intake", path.join(w.dir, "c.jpg"), "--json"])).json;
    assert.deepEqual([onIntake.sort, onIntake.auto, onIntake.waiting], [true, true, []]);
    assert.equal((await w.ok(["check"])).code, 0);
  } finally {
    w.cleanup();
  }
});

test("the bridge: a single original (at once and queued with Prefer: respond-async) answered without a task while intake.auto is off, with one once the person turned it on in the app", opts, async () => {
  const w = new World();
  await w.withTree("Lhotákovi");
  await w.ok(["person", "add", "Vojtěch /Lhoták/", "--sex", "M"]); // P0001
  w.env.STROM_LIVE_POLL_MS = "100";
  w.env.STROM_MEDIA_QUEUE_MS = "200";
  const info = (await w.ok(["live", "start", "--json"])).json;
  const put = (b: Buffer, name: string, more: Record<string, string> = {}) =>
    request("PUT", `${info.url}/media/${sha(b)}`, b, { ...app, "X-Strom-Person": "P0001", "X-Strom-Name": encodeURIComponent(name), ...more });
  const byInput = (id: string) => tasks(w).filter((t) => t.where.includes(id));
  try {
    // off: an input, no task
    const now = await put(jpgNo(11), "Dopis.jpg");
    assert.equal(now.status, 200, now.body.toString());
    assert.equal(json(now).task, undefined);
    assert.deepEqual(byInput(json(now).input), []);
    // the same file again with a note: added, no task
    const again = await put(jpgNo(11), "Dopis.jpg", { "X-Strom-Note": encodeURIComponent("Psáno v Lhotě") });
    assert.equal(again.status, 200, again.body.toString());
    assert.deepEqual([json(again).known, json(again).added?.note, json(again).task], [json(now).input, true, undefined]);
    // queued: written a moment later, no task
    const q = await put(jpgNo(12), "Žádost.jpg", { Prefer: "respond-async" });
    assert.equal(q.status, 202, q.body.toString());
    let queued = "";
    await until("the queued file written", async () => {
      const k = await request("GET", `${info.url}/media/${sha(jpgNo(12))}`);
      if (k.status === 200) queued = Tree.open(w.cwd, w.env).list<Input>("input").find((i) => i.sha === sha(jpgNo(12)))?.id ?? "";
      return !!queued;
    }, { ms: 60_000 });
    assert.deepEqual(byInput(queued), []);
    assert.equal(tasks(w).length, 0);

    // the person turns it on in the app: the next file makes its task, queued too
    assert.equal((await request("POST", `${info.url}/intake`, Buffer.from(JSON.stringify({ auto: true })), app)).status, 200);
    const on = json(await put(jpgNo(13), "Fotka.jpg"));
    assert.match(on.task, /^T\d{4}$/);
    const q2 = await put(jpgNo(14), "Fotka 2.jpg", { Prefer: "respond-async" });
    assert.equal(q2.status, 202);
    let queuedOn = "";
    await until("the second queued file written", async () => {
      queuedOn = Tree.open(w.cwd, w.env).list<Input>("input").find((i) => i.sha === sha(jpgNo(14)))?.id ?? "";
      return !!queuedOn && byInput(queuedOn).length > 0;
    }, { ms: 60_000 });
    assert.equal(byInput(queuedOn)[0]!.origin, "app:media");
  } finally {
    await w.ok(["live", "stop"]);
    w.cleanup();
  }
});
