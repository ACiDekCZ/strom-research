// A research in iCloud Drive whose files the system took off this computer ("Optimise Mac Storage"): only placeholders
// `.X.json.icloud` are left. Said as that — not downloaded yet, in the research's language — never "deleted outside
// strom", never sent to strom repair (it would write the sealed version over the one in the cloud); nothing is written
// over them, the bridge says so to the app.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { World, hasGit } from "../helpers.ts";

const opts = { skip: !hasGit };

/** A Czech research of two people, the second one's record only in iCloud. */
async function evicted(): Promise<{ w: World; placeholder: string }> {
  const w = new World();
  w.env.STROM_LANG = "cs";
  await w.withTree("Horákovi");
  await w.ok(["person", "add", "Jan /Horák/", "--sex", "M"]);
  await w.ok(["person", "add", "Josef /Horák/", "--sex", "M"]);
  const dir = path.join(w.cwd, "data", "persons");
  const placeholder = path.join(dir, ".P0002.json.icloud");
  fs.writeFileSync(placeholder, "bplist00");
  fs.rmSync(path.join(dir, "P0002.json"));
  return { w, placeholder };
}

test("files only in iCloud: check says not downloaded, never repair; repair and writes refuse, the placeholder stays", opts, async () => {
  const { w, placeholder } = await evicted();
  try {
    const j = (await w.run(["check", "--json"])).json;
    const codes = j.findings.map((f: { code: string }) => f.code);
    assert.ok(codes.includes("not-downloaded"), JSON.stringify(j.findings));
    assert.ok(!codes.includes("manual-delete") && !codes.includes("record-deleted") && !codes.includes("unsealed"), JSON.stringify(j.findings));
    const f = j.findings.find((x: { code: string }) => x.code === "not-downloaded");
    assert.equal(f.count, 1);
    assert.equal(f.file, "data/persons/P0002.json");
    for (const x of j.findings) assert.doesNotMatch(String(x.hint ?? ""), /^strom repair/);
    // a person reads it in the research's language
    const c = await w.run(["check"], { tty: true });
    assert.match(c.out, /z iCloudu ještě nestaženo: 1 soubor výzkumu \(první: data\/persons\/P0002\.json\) – jsou tu jen zástupné soubory, nic se nesmazalo/u, c.out);
    assert.match(c.out, /stáhnout ji .*ne strom repair/u, c.out);
    assert.doesNotMatch(c.out, /→ strom repair/, c.out);
    // repair would write the sealed version over the cloud's: refused, the placeholder kept
    const r = await w.run(["repair", "--json"]);
    assert.notEqual(r.code, 0);
    assert.equal(r.json.code, "tree.not-downloaded");
    assert.ok(fs.existsSync(placeholder));
    assert.ok(!fs.existsSync(path.join(w.cwd, "data", "persons", "P0002.json")));
    assert.ok(!fs.existsSync(path.join(w.cwd, ".strom", "quarantine")) || !fs.readdirSync(path.join(w.cwd, ".strom", "quarantine"), { recursive: true }).some((n) => String(n).includes("icloud")));
    // a write is refused with its own code, in the research's language
    const write = await w.run(["person", "add", "Marie /Horáková/", "--json"]);
    assert.notEqual(write.code, 0);
    assert.equal(write.json.code, "tree.not-downloaded");
    const said = await w.run(["person", "add", "Marie /Horáková/"], { tty: true });
    assert.match(said.err, /z iCloudu ještě nestaženo: 1 soubor výzkumu \(první: data\/persons\/P0002\.json\) – nic se nezapsalo/u, said.err);
    assert.doesNotMatch(said.err, /→ strom repair/, said.err);
    // downloaded again: all is well, writing goes on
    fs.rmSync(placeholder);
    await w.ok(["repair"]);
    await w.ok(["person", "add", "Marie /Horáková/", "--sex", "F"]);
    assert.ok(fs.existsSync(path.join(w.cwd, "data", "persons", "P0002.json")));
  } finally {
    w.cleanup();
  }
});

test("files only in iCloud: the bridge says how many in /status and refuses the app's writes with tree.not-downloaded (409)", opts, async () => {
  const { w, placeholder } = await evicted();
  const info = (await w.ok(["live", "start", "--json"])).json;
  try {
    const status = (await (await fetch(`${info.url}/status`)).json()) as { notDownloaded: number; features: string[] };
    assert.equal(status.notDownloaded, 1);
    assert.ok(status.features.includes("tree.notDownloaded"));
    const headers = { Origin: "https://beta.stromapp.info", "Content-Type": "text/plain; charset=utf-8" };
    const res = await fetch(`${info.url}/sync`, { method: "POST", body: "0 HEAD\n0 TRLR\n", headers });
    const got = (await res.json()) as { code: string; error: string; text: string; params: Record<string, string> };
    assert.equal(res.status, 409, JSON.stringify(got));
    assert.equal(got.code, "tree.not-downloaded");
    assert.deepEqual(got.params, { n: "1", first: "data/persons/P0002.json" });
    assert.match(got.error, /^z iCloudu ještě nestaženo: 1 soubor výzkumu/u, got.error);
    assert.match(got.text, /^1 file of the research not downloaded from iCloud yet/, got.text);
    // downloaded: /status says 0 and the seal outright (the app lifts its held refusal only on an explicit answer)
    fs.rmSync(placeholder);
    const after = (await (await fetch(`${info.url}/status`)).json()) as Record<string, unknown>;
    assert.ok("notDownloaded" in after && after.notDownloaded === 0, JSON.stringify(after.notDownloaded));
    assert.equal(after.seal, "here");
  } finally {
    await w.run(["live", "stop"]);
    w.cleanup();
  }
});
