// A write of the Strom app's whose commit the check of the research refuses (a note of the material gone with no
// reason) leaves nothing behind and says why — never a bare "exit 1", never a research where every write after it is
// refused as well; a note a send of the app took off with no reason (1.35.0) is given back by the next write or a bridge's start,
// which commits what waited with it; the app's writes wait for another strom holding the research.

import { test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { World, hasGit } from "../helpers.ts";
import { Tree } from "../../src/core/tree.ts";
import { create, update } from "../../src/core/records.ts";
import type { Input } from "../../src/core/model.ts";
import { writableUnasked } from "../../src/core/integrity.ts";

const opts = { skip: !hasGit || process.platform === "win32" };
const app = { Origin: "https://beta.stromapp.info", "Content-Type": "application/json" };
const NOTE = { text: "od babičky Lhotákové, fotky z Lhoty".normalize("NFD"), at: "2026-11-21T16:33:01.860Z", by: "user" as const };

function post(url: string, body: unknown): Promise<{ status: number; body: Record<string, unknown> }> {
  return new Promise((resolve, reject) => {
    const req = http.request(url, { method: "POST", agent: false, headers: app }, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (d: Buffer) => chunks.push(d));
      res.on("end", () => resolve({ status: res.statusCode ?? 0, body: JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}") }));
    });
    req.on("error", reject);
    req.end(JSON.stringify(body));
  });
}
const dirty = (dir: string) => execFileSync("git", ["-C", dir, "status", "--porcelain", "--", "data"], { encoding: "utf8" }).trim();
const head = (dir: string) => execFileSync("git", ["-C", dir, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();

/** A research with two files of the material, the first with the user's note; P1, P2. All committed. */
async function research(): Promise<{ w: World; a: string; b: string }> {
  const w = new World();
  await w.withTree("Lhotákovi");
  await w.ok(["person", "add", "Václav /Lhoták/", "--sex", "M", "--born", "1890"]);
  await w.ok(["person", "add", "Евa /Лхотакова/", "--sex", "F"]);
  const tree = Tree.open(w.cwd, w.env);
  let a = "";
  let b = "";
  tree.withTreeLock(() => {
    const file = (n: string) => ({ name: `${n}.jpg`, file: `inputs/${n}.jpg`, sha: crypto.createHash("sha256").update(n).digest("hex"), kind: "photo" as const, state: "new" as const, from: "the Strom app" });
    a = create<Input>(tree, "input", file("herbert") as never, (id) => `+${id}`).id;
    update<Input>(tree, a, "input", (r) => ({ ...r, notes: [NOTE] }), { op: "input.note", summary: `${a} the user's note` });
    b = create<Input>(tree, "input", file("svatba") as never, (id) => `+${id}`).id;
    tree.commit("two files");
  });
  return { w, a, b };
}

/** The note taken off as a write of strom's that never got committed (its process ended): `op` without a reason. */
function noteTakenOff(w: World, id: string, op: string): void {
  const src = path.join(import.meta.dirname, "..", "..", "src", "core");
  const script = [
    `import { Tree } from ${JSON.stringify(path.join(src, "tree.ts"))};`,
    `import { update } from ${JSON.stringify(path.join(src, "records.ts"))};`,
    `const tree = Tree.open(${JSON.stringify(w.cwd)}, process.env);`,
    `tree.withTreeLock(() => update(tree, ${JSON.stringify(id)}, "input", (r) => ({ ...r, notes: [], links: [{ type: "person", ref: "P0001", order: 0, at: "2026-11-22T05:01:27.377Z" }] }), { op: ${JSON.stringify(op)}, summary: "${id} as the app gave it" }));`,
  ].join("\n");
  execFileSync(process.execPath, ["--input-type=module", "-e", script], { env: w.env as NodeJS.ProcessEnv, cwd: w.cwd });
  const left = dirty(w.cwd);
  assert.ok(left.includes(`data/inputs/${id}.json`), "left behind, not committed");
  // its log untouched since, as the send's was when the person went on in the app minutes later
  const log = /\?\? (data\/ops\/\S+\.jsonl)/u.exec(left)![1]!;
  const then = new Date(Date.now() - 15 * 60_000);
  fs.utimesSync(path.join(w.cwd, log), then, then);
}

test("a note a send of the app took off with no reason (1.35.0) blocks no write: the app's edit and assign written, the note given back, what waited committed with them", opts, async () => {
  const { w, a, b } = await research();
  noteTakenOff(w, a, "input.media");
  const info = (await w.ok(["live", "start", "--json"])).json as { url: string };
  try {
    const edit = await post(`${info.url}/material/edit`, { ids: [b], title: "Svatba v Lhotě", kind: "photo" });
    assert.equal(edit.status, 200, JSON.stringify(edit.body));
    const assign = await post(`${info.url}/material/assign`, { files: [b], add: ["P0002"] });
    assert.equal(assign.status, 200, JSON.stringify(assign.body));
    assert.equal(dirty(w.cwd), "", "everything committed");
    const t = Tree.open(w.cwd, w.env);
    const rec = t.get<Input>(a)!;
    assert.deepEqual(rec.notes.map((n) => n.text), [NOTE.text.normalize("NFC")], "the note back, as it was");
    assert.deepEqual(rec.links?.map((l) => `${l.type}:${l.ref}`), ["person:P0001"], "the app's place stays");
    assert.deepEqual(t.get<Input>(b)!.persons, ["P0002"]);
    assert.equal((await w.run(["check"])).out.includes("item-removed"), false);
  } finally {
    await w.ok(["live", "stop"]);
  }
  w.cleanup();
});

test("a write of the app the check refuses: nothing of it left, the app and live.log told why (no bare exit 1), the research writable after it is set right", opts, async () => {
  const { w, a, b } = await research();
  // a loss no write of the app's explains (an input.edit with no reason): refused — and said
  noteTakenOff(w, a, "input.edit");
  const info = (await w.ok(["live", "start", "--json"])).json as { url: string };
  try {
    const before = head(w.cwd);
    const got = await post(`${info.url}/material/assign`, { files: [b], add: ["P0002"] });
    assert.equal(got.status, 500, JSON.stringify(got.body));
    assert.equal(got.body.code, "material.failed");
    assert.equal(got.body.reasonCode, "commit.blocked");
    assert.match(String(got.body.error), new RegExp(`${a} notes item removed`, "u"), "why, not exit 1");
    assert.doesNotMatch(String(got.body.error), /^exit \d+$/u);
    const log = fs.readFileSync(path.join(w.cwd, ".strom", "live.log"), "utf8");
    assert.match(log, new RegExp(`the material: assign was not written \\(exit 1\\): nothing written — .*${a} notes item removed`, "u"));
    assert.equal(head(w.cwd), before);
    assert.deepEqual(Tree.open(w.cwd, w.env).get<Input>(b)!.persons ?? [], [], "the assign taken back: nothing of it in data/");
    assert.ok(!dirty(w.cwd).includes(`data/inputs/${b}.json`));
    // an agent's write meets the same: written but not committed, said in --json too
    const agent = await w.run(["input", "edit", b, "--title", "Svatba", "--json"]);
    assert.equal(agent.code, 1);
    const said = JSON.parse(agent.out) as { status: string; code: string; message: string };
    assert.deepEqual([said.status, said.code], ["not-committed", "commit.blocked"]);
    assert.match(said.message, /^written but NOT committed — the check of the research found 1 problem: /u);
  } finally {
    await w.ok(["live", "stop"]);
  }
  w.cleanup();
});

test("the app's edit and assign while another strom holds the research: they wait for it and are written", opts, async () => {
  const { w, b } = await research();
  const info = (await w.ok(["live", "start", "--json"])).json as { url: string };
  try {
    const tree = Tree.open(w.cwd, w.env);
    const held = tree.holdTreeLock(() => new Promise<void>((r) => setTimeout(r, 1500)));
    const [edit, assign] = await Promise.all([post(`${info.url}/material/edit`, { ids: [b], title: "Svatba" }), new Promise((r) => setTimeout(r, 200)).then(() => post(`${info.url}/material/assign`, { files: [b], add: ["P0001"] }))]);
    await held;
    assert.equal(edit.status, 200, JSON.stringify(edit.body));
    // the second while the first waits: the bridge's own one at a time (409 + Retry-After), never a failure
    assert.ok(assign.status === 200 || (assign.status === 409 && assign.body.code === "material.busy"), JSON.stringify(assign.body));
    if (assign.status === 409) assert.equal((await post(`${info.url}/material/assign`, { files: [b], add: ["P0001"] })).status, 200);
    assert.equal(dirty(w.cwd), "");
    assert.deepEqual(Tree.open(w.cwd, w.env).get<Input>(b)!.persons, ["P0001"]);
  } finally {
    await w.ok(["live", "stop"]);
  }
  w.cleanup();
});

test("a send of the app the check refuses: nothing of it left, the app told why (500, commit.blocked), the send said failed, never written", opts, async () => {
  const { w, a } = await research();
  noteTakenOff(w, a, "input.edit");
  const given = path.join(w.dir, "given.ged");
  await w.ok(["export", "gedcom", "--for", "strom", "--images-for", "none", "--out", given]);
  const ged = fs.readFileSync(given, "utf8").replace(/\r\n/g, "\n").replace(/0 TRLR\s*$/u, "0 @I99@ INDI\n1 NAME Ян /Лхотак/\n1 SEX M\n0 TRLR\n");
  const info = (await w.ok(["live", "start", "--json"])).json as { url: string };
  try {
    const before = head(w.cwd);
    const got = await new Promise<{ status: number; body: Record<string, unknown> }>((resolve, reject) => {
      const req = http.request(`${info.url}/sync`, { method: "POST", agent: false, headers: { Origin: app.Origin, "Content-Type": "text/plain; charset=utf-8" } }, (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (d: Buffer) => chunks.push(d));
        res.on("end", () => resolve({ status: res.statusCode ?? 0, body: JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}") }));
      });
      req.on("error", reject);
      req.end(ged);
    });
    assert.equal(got.status, 500, JSON.stringify(got.body));
    assert.equal(got.body.reasonCode, "commit.blocked");
    assert.match(String(got.body.reason), new RegExp(`${a} notes item removed`, "u"));
    assert.equal(head(w.cwd), before);
    assert.ok(!fs.readdirSync(path.join(w.cwd, "data", "persons")).some((f) => JSON.parse(fs.readFileSync(path.join(w.cwd, "data", "persons", f), "utf8")).names?.[0]?.given === "Ян"), "nothing of the send in data/");
    const sends = fs.readdirSync(path.join(w.cwd, ".strom", "sync")).filter((f) => f.startsWith("received-")).map((f) => JSON.parse(fs.readFileSync(path.join(w.cwd, ".strom", "sync", f), "utf8")) as { state: string; reasonCode?: string });
    assert.deepEqual(sends.map((s) => [s.state, s.reasonCode]), [["failed", "commit.blocked"]]);
  } finally {
    await w.ok(["live", "stop"]);
  }
  w.cleanup();
});

test("a research a send of the app left so (1.35.0): nothing written unasked takes the loss in; opening the app (the bridge's start) gives the note back and commits what waited, with no write", opts, async () => {
  const { w, a } = await research();
  noteTakenOff(w, a, "input.media");
  const tree = Tree.open(w.cwd, w.env);
  assert.equal(tree.withTreeLock(() => writableUnasked(tree)), false, "a fix of a newer strom commits nothing over it");
  const before = head(w.cwd);
  const info = (await w.ok(["live", "start", "--json"])).json as { url: string };
  try {
    assert.equal(dirty(w.cwd), "", "committed at the bridge's start");
    const rec = Tree.open(w.cwd, w.env).get<Input>(a)!;
    assert.deepEqual(rec.notes.map((n) => n.text), [NOTE.text.normalize("NFC")]);
    assert.deepEqual(rec.links?.map((l) => l.ref), ["P0001"], "the app's place stays");
    const log = execFileSync("git", ["-C", w.cwd, "log", "--format=%s", `${before}..HEAD`], { encoding: "utf8" });
    assert.match(log, /^Notes of the material given back: a send of the Strom app had taken 1 note off$/mu);
    assert.match(fs.readFileSync(path.join(w.cwd, ".strom", "live.log"), "utf8"), /notes of the material given back: 1 file/u);
    assert.equal((await w.run(["check"])).out.includes("item-removed"), false);
    void info;
  } finally {
    await w.ok(["live", "stop"]);
  }
  w.cleanup();
});
