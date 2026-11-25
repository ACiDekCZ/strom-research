// A file the Strom app sent (a batch, material of a person) and sorted with strom input sort as a document, a photo or a
// record of people goes into the app's tree at them: one person's at the person (OBJE under the INDI), two partners of
// one couple at their family (OBJE under the FAM), the living as anyone. A file with a place already — one the person
// took off in the app too — keeps what it has; a person taken off the file, a file not of the family or the research's
// own material gets no place. Made-up names only (Lhoták, Lhota).

import { test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { World, hasGit } from "../helpers.ts";
import { Tree } from "../../src/core/tree.ts";
import { takeOriginal } from "../../src/core/originals.ts";
import { buildGed } from "../../src/core/liveged.ts";
import { head as headOf } from "../../src/core/git.ts";
import { Settings } from "../../src/core/config.ts";
import { update } from "../../src/core/records.ts";
import type { Input } from "../../src/core/model.ts";

const opts = { skip: !hasGit };
const fixtures = path.join(import.meta.dirname, "..", "fixtures", "images");
const BATCH = "c0ffee00-1e2f-4a3b-9c4d-5e6f7a8b9c0d";

/** The app's tree file as the bridge makes it (GET /tree.ged?media=app&images=ref). */
const appGed = (w: World) => buildGed({ root: w.cwd, env: w.env, head: headOf(w.cwd) ?? "", version: undefined, links: [], budgetMs: 0, images: "ref", media: true }).bytes.toString("utf8");

/** The level-0 record of an ID in a GEDCOM, its lines up to the next record. */
function recordOf(ged: string, id: string): string {
  const rows = ged.split(/\r?\n/u);
  const at = rows.findIndex((r) => r.startsWith(`0 @${id}@ `));
  assert.ok(at >= 0, `${id} in the file`);
  const end = rows.findIndex((r, k) => k > at && r.startsWith("0 "));
  return rows.slice(at, end < 0 ? undefined : end).join("\n");
}

/** The SHA-256s of the files (OBJE … _STROM_SHA) in a record. */
const shasIn = (record: string) => [...record.matchAll(/^2 _STROM_SHA ([0-9a-f]{64})$/gmu)].map((m) => m[1]);

test("input sort of the app's files: one person's under the INDI, a couple's under the FAM, the living as anyone; a place taken off stays off; nothing of a file declined, unrelated or the research's own", opts, async () => {
  const w = new World();
  try {
    await w.withTree("Lhotákovi");
    await w.ok(["lang", "cs"]);
    // living, both of them: born recently, no death
    await w.ok(["person", "add", "Vojtěch /Lhoták/".normalize("NFD"), "--sex", "M", "--born", "1990"]); // P0001
    await w.ok(["person", "add", "Žofie /Lhotová/", "--sex", "F", "--born", "1992"]); // P0002
    await w.ok(["person", "add", "Šimon /Lhoták/", "--sex", "M"]); // P0003
    await w.ok(["family", "add", "--partner", "P0001", "--partner", "P0002"]); // F0001
    const shared = new Settings(w.env, {}).shared()!.value;
    const incoming = path.join(shared, "media", ".incoming");
    fs.mkdirSync(incoming, { recursive: true });
    const base = fs.readFileSync(path.join(fixtures, "s0001.jpg"));
    // files of a batch of the app (each a JPEG with a few bytes after its end), and one of the research's own
    const take = (k: number, name: string, batch = true) => {
      const b = Buffer.concat([base, Buffer.from(`Lhota ${k}`, "utf8")]);
      const sha = crypto.createHash("sha256").update(b).digest("hex");
      const f = path.join(incoming, `${sha}-${k}.part`);
      fs.writeFileSync(f, b);
      return { sha, f, name, batch };
    };
    const files = [take(1, "Oddací list Lhota.jpg".normalize("NFD")), take(2, "Vojtěch.jpg"), take(3, "Šimon.jpg"), take(4, "Žofie.jpg"), take(5, "Cizí.jpg")];
    const tree = Tree.open(w.cwd, w.env);
    const ids = tree.withTreeLock(() => files.map((x) => takeOriginal(tree, shared, x.f, x.sha, { name: x.name, persons: [], batch: BATCH, path: `Krabice z Lhoty/${x.name}` }).input!));
    tree.commit("a batch of the app");
    const [marriage, vojtech, simon, zofie, stranger] = ids as [string, string, string, string, string];
    const shaOf = (id: string) => Tree.open(w.cwd, w.env).get<Input>(id)!.sha!;
    const own = path.join(w.dir, "vlastní");
    fs.mkdirSync(own);
    fs.writeFileSync(path.join(own, "lhota.jpg"), Buffer.concat([base, Buffer.from("vlastní", "utf8")]));
    const mine: string = (await w.ok(["intake", own, "--json"])).json.inputs[0].id;

    // the couple's marriage: at their family; one person's photo: at them (the living as anyone)
    const sorted = (await w.ok(["input", "sort", marriage, "--as", "document", "--person", "P0001", "--person", "P0002", "--json"])).json;
    assert.deepEqual(sorted.placed, [{ id: marriage, at: ["F0001"] }]);
    await w.ok(["input", "sort", vojtech, "--as", "photo", "--person", "P0001"]);
    await w.ok(["input", "sort", simon, "--as", "source", "--person", "P0003"]);
    // nothing of the family, and the research's own file: no place
    await w.ok(["input", "sort", stranger, "--as", "unrelated", "--reason", "cizí lidé u Lhoty"]);
    await w.ok(["input", "sort", mine, "--as", "photo", "--person", "P0003"]);
    // a person taken off the file is not put on it: neither is a place at them
    await w.ok(["input", "assign", zofie, "--add", "P0002"]);
    await w.ok(["input", "assign", zofie, "--remove", "P0002"]);
    const declined = (await w.ok(["input", "sort", zofie, "--as", "photo", "--person", "P0002", "--json"])).json;
    assert.equal(declined.placed, undefined);

    const links = (id: string) => Tree.open(w.cwd, w.env).get<Input>(id)!.links;
    assert.deepEqual(links(marriage)!.map((l) => `${l.type} ${l.ref} ${l.order}`), ["family F0001 0"]);
    assert.deepEqual(links(vojtech)!.map((l) => `${l.type} ${l.ref} ${l.order}`), ["person P0001 0"]);
    assert.deepEqual(links(simon)!.map((l) => `${l.type} ${l.ref} ${l.order}`), ["person P0003 0"]);
    assert.equal(links(stranger), undefined);
    assert.equal(links(mine), undefined);
    assert.equal(links(zofie), undefined);

    const ged = appGed(w);
    assert.deepEqual(shasIn(recordOf(ged, "F0001")), [shaOf(marriage)]);
    assert.match(recordOf(ged, "F0001"), /^1 OBJE$/mu);
    assert.deepEqual(shasIn(recordOf(ged, "P0001")), [shaOf(vojtech)]);
    assert.deepEqual(shasIn(recordOf(ged, "P0003")), [shaOf(simon)]);
    assert.deepEqual(shasIn(recordOf(ged, "P0002")), []);
    assert.match(recordOf(ged, "F0001"), new RegExp(`^2 TITL Oddací list Lhota\\.jpg$`.normalize("NFC"), "mu"), "its name in NFC");

    // the person takes the photo off in the app (the place retracted): sorted again, it stays off
    const t2 = Tree.open(w.cwd, w.env);
    t2.withTreeLock(() => {
      update<Input>(t2, vojtech, "input", (i) => ({ ...i, links: i.links!.map((l) => ({ ...l, retracted: { at: new Date().toISOString(), reason: "app" as const } })) }), { op: "input.media", summary: `${vojtech} taken off in the app` });
    });
    t2.commit("the app took the photo off");
    const again = (await w.ok(["input", "sort", vojtech, "--as", "photo", "--person", "P0001", "--json"])).json;
    assert.equal(again.placed, undefined);
    assert.deepEqual(links(vojtech)!.map((l) => `${l.type} ${l.ref} ${l.retracted ? "off" : "on"}`), ["person P0001 off"]);
    assert.deepEqual(shasIn(recordOf(appGed(w), "P0001")), []);
    // a file placed once is left as it is when sorted again
    await w.ok(["input", "sort", marriage, "--as", "document", "--person", "P0001"]);
    assert.deepEqual(links(marriage)!.map((l) => `${l.type} ${l.ref}`), ["family F0001"]);
    assert.equal(execFileSync("git", ["-C", w.cwd, "status", "--porcelain"], { encoding: "utf8" }).trim(), "", "every write committed");
  } finally {
    w.cleanup();
  }
});
