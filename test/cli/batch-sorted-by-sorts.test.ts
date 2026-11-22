// A batch closed unsorted (intake.auto off) whose files the person had sorted in the Strom app (POST /material/sort,
// "nothing written to the research") or by strom material sort: its files count as sorted in /status batches once a
// sort went through them to its end — found when read from .strom/sorts, so a research whose app sorted its batches
// before says so after the bridge's update with no change of its data. A sort queued, at work, failed or cancelled
// sorts nothing; a file sorted by strom input sort stays sorted; a restart of the bridge changes nothing.

import { test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { World, hasGit } from "../helpers.ts";
import { Tree } from "../../src/core/tree.ts";
import type { Input } from "../../src/core/model.ts";
import { batchStatus } from "../../src/core/batches.ts";
import { saveSort, type SortState } from "../../src/core/sort.ts";

const opts = { skip: !hasGit || process.platform === "win32", timeout: 240_000 };
const app = { Origin: "https://beta.stromapp.info" };
const fixtures = path.join(import.meta.dirname, "..", "fixtures", "images");
const sha = (b: Buffer) => crypto.createHash("sha256").update(b).digest("hex");

function request(method: string, url: string, body?: Buffer, headers: Record<string, string> = {}): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => {
    const req = http.request(url, { agent: false, method, headers: { ...(body ? { "Content-Length": String(body.length) } : {}), ...headers } }, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (d: Buffer) => chunks.push(d));
      res.on("end", () => {
        const text = Buffer.concat(chunks).toString("utf8");
        let parsed: any = text;
        try {
          parsed = JSON.parse(text);
        } catch {
          // not JSON
        }
        resolve({ status: res.statusCode ?? 0, body: parsed });
      });
    });
    req.on("error", reject);
    req.end(body);
  });
}

const headOf = (w: World) => execFileSync("git", ["rev-parse", "HEAD"], { cwd: w.cwd, encoding: "utf8" }).trim();

let n = 0;
/** A sort as the bridge keeps it, in the state given (its proposals are not what counts). */
function sort(w: World, state: SortState["state"], files: string[]): string {
  n++;
  const id = `sort-20261122${String(50000 + n).padStart(6, "0")}-${(0xa000 + n).toString(16)}`;
  const at = new Date(Date.UTC(2026, 10, 22, 5, 0, n)).toISOString();
  saveSort(w.cwd, { id, state, files, text: "", lang: "cs", at, since: at, from: "app:sort" });
  return id;
}

test("a batch closed unsorted: its files sorted by a sort of the app's that ended count as sorted in /status batches (no change of the data, after a restart too); queued, at work, failed or cancelled do not", opts, async () => {
  const w = new World();
  try {
    await w.withTree("Lhotákovi");
    await w.ok(["lang", "cs"]);
    await w.ok(["person", "add", "Vojtěch /Lhoták/", "--sex", "M"]); // P0001
    w.env.STROM_LIVE_POLL_MS = "100";
    let info = (await w.ok(["live", "start", "--json"])).json;
    const batch = "b092cac7-1e2f-4a3b-9c4d-5e6f7a8b9c0d";
    // fourteen distinct files of one batch (a JPEG with a few bytes after its end each), one folder name in another script
    const base = fs.readFileSync(path.join(fixtures, "s0001.jpg"));
    const inputs: string[] = [];
    for (let k = 0; k < 14; k++) {
      const b = Buffer.concat([base, Buffer.from(`Lhoták ${k}`, "utf8")]);
      const where = k % 2 ? `Půda/Фото ${k}.jpg`.normalize("NFD") : `Půda/Dopis ${k}.jpg`;
      const r = await request("PUT", `${info.url}/media/${sha(b)}`, b, { ...app, "X-Strom-Batch": batch, "X-Strom-Path": encodeURIComponent(where), "X-Strom-Name": encodeURIComponent(path.basename(where)) });
      assert.equal(r.status, 200, JSON.stringify(r.body));
      inputs.push(r.body.input);
    }
    assert.equal(new Set(inputs).size, 14);
    const done = await request("POST", `${info.url}/batch/${batch}/done`, Buffer.from(JSON.stringify({ name: "Krabice z půdy", sort: false })), { ...app, "Content-Type": "text/plain;charset=UTF-8" });
    assert.equal(done.status, 200, JSON.stringify(done.body));

    const ours = async () => (await request("GET", `${info.url}/status`)).body.batches.find((b: { id: string }) => b.id === batch);
    let b = await ours();
    assert.deepEqual([b.state, b.files, b.sorted, b.tasks], ["closed", 14, 0, []], "closed unsorted: its files wait in the material");
    // the sorts below are written as the bridge keeps them, beside it: it asked again once it was started anew
    await w.ok(["live", "stop"]);
    const now = () => batchStatus(Tree.open(w.cwd, w.env)).find((x) => x.id === batch)!;

    // the app's sorts that did not end, or ended badly, sorted nothing
    const waiting = [sort(w, "queued", inputs), sort(w, "working", inputs)];
    sort(w, "failed", inputs);
    sort(w, "cancelled", inputs);
    assert.equal(now().sorted, 0);
    // (none left waiting for the bridge to start: an unsigned sort of the app's is never sorted, nothing to look at here)
    for (const id of waiting) fs.rmSync(path.join(w.cwd, ".strom", "sorts", `${id}.json`));

    // a sort done of ten of them: ten sorted
    const head = headOf(w);
    sort(w, "done", inputs.slice(0, 10));
    assert.equal(now().sorted, 10);

    // the other four in a run of the app (one of its parts failed, sent again and done; one file without a proposal: done is done)
    sort(w, "failed", inputs.slice(10));
    sort(w, "done", inputs.slice(10));
    assert.deepEqual([now().files, now().sorted], [14, 14]);
    assert.equal(headOf(w), head, "found when read: nothing written to the research");
    for (const id of inputs) assert.equal(Tree.open(w.cwd, w.env).get<Input>(id)!.state, "new", "the files themselves unchanged");

    // the bridge (updated) says so, and again after a restart: read from .strom/sorts
    info = (await w.ok(["live", "start", "--json"])).json;
    b = await ours();
    assert.deepEqual([b.files, b.sorted], [14, 14]);
    await w.ok(["live", "stop"]);
    info = (await w.ok(["live", "start", "--json"])).json;
    assert.equal((await ours()).sorted, 14);
    // and the terminal's list says the same
    const listed = (await w.ok(["input", "batch", "--json"])).json.batches.find((x: { id: string }) => x.id === batch);
    assert.equal(listed.sorted, 14);

    // sorted a month ago: gone from the list like any batch sorted whole
    const file = path.join(w.cwd, ".strom", "batches", `${batch}.json`);
    const kept = JSON.parse(fs.readFileSync(file, "utf8"));
    fs.writeFileSync(file, JSON.stringify({ ...kept, updated: "2026-09-01T00:00:00.000Z" }, null, 2) + "\n");
    assert.equal(batchStatus(Tree.open(w.cwd, w.env)).find((x) => x.id === batch), undefined);
    fs.writeFileSync(file, JSON.stringify(kept, null, 2) + "\n");
  } finally {
    await w.run(["live", "stop"]);
    w.cleanup();
  }
});

test("strom input sort still counts with sorts of the app's beside it; the same with a hundred and fifty sorts kept", opts, async () => {
  const w = new World();
  try {
    await w.withTree("Lhotákovi");
    await w.ok(["lang", "cs"]);
    await w.ok(["person", "add", "Vojtěch /Lhoták/", "--sex", "M"]); // P0001
    const batch = "c1d2e3f4-a5b6-4c7d-8e9f-0a1b2c3d4e5f";
    const base = fs.readFileSync(path.join(fixtures, "s0001.jpg"));
    const inputs: string[] = [];
    for (let k = 0; k < 3; k++) {
      const f = path.join(w.dir, `Dopis ${k}.jpg`);
      fs.writeFileSync(f, Buffer.concat([base, Buffer.from(`Lhota ${k}`, "utf8")]));
      inputs.push((await w.ok(["media", "original", f, "--batch", batch, "--path", `Lhota/Dopis ${k}.jpg`, "--json"])).json.input);
    }
    await w.ok(["input", "batch", "done", batch, "--no-sort"]);
    // one sorted by hand (the agent or the terminal), one by a sort of the app's, one not at all
    await w.ok(["input", "sort", inputs[0]!, "--as", "photo", "--person", "P0001"]);
    sort(w, "done", [inputs[1]!]);
    // 150 more sorts of the app's, of files of no batch and failed ones of the one left: the count is the same
    for (let k = 0; k < 150; k++) sort(w, k % 3 ? "done" : "failed", k % 3 ? [`I${String(9000 + k)}`] : [inputs[2]!]);
    const b = batchStatus(Tree.open(w.cwd, w.env)).find((x) => x.id === batch)!;
    assert.deepEqual([b.files, b.sorted], [3, 2]);
    assert.ok((b.persons as string[]).includes("P0001"), "the person the hand sorting named");
  } finally {
    w.cleanup();
  }
});
