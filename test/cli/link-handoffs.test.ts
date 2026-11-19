// The app's id of a link (strom-research://…&handoff=<uuid>, feature handoffs): kept beside the link when it is a UUID,
// written when the link was taken (the terminal came up, or what needs none was done), said by the bridge in /status
// for a minute and gone after; any other value is left out, never refused; a link without one is as it was.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { hasGit } from "../helpers.ts";
import { linkText, parseLink } from "../../src/core/links.ts";
import { HANDOFF_MS, handoffsNow, noteHandoff } from "../../src/core/handoffs.ts";
import { withHandoffs } from "../../src/core/live.ts";
import { ID, world } from "./links.helpers.ts";

const H1 = "6f1c2a3b-4d5e-4f60-8a9b-0c1d2e3f4a5b";
const H2 = "0a1b2c3d-4e5f-4a6b-9c8d-7e6f5a4b3c2d";
const H3 = "11111111-2222-4333-8444-555555555555";

test("a link keeps the app's id of it only when it is a UUID; any other value is left out, never refused", () => {
  assert.deepEqual(parseLink(`strom-research://open?tree=${ID}&handoff=${H1.toUpperCase()}`), { action: "open", tree: ID, handoff: H1 });
  // without it, and with a value of another shape: the link as it was
  assert.deepEqual(parseLink(`strom-research://open?tree=${ID}`), { action: "open", tree: ID });
  for (const bad of ["x;rm -rf ~", "", "1", `${H1}x`, "{6f1c2a3b-4d5e-4f60-8a9b-0c1d2e3f4a5b}", "6f1c2a3b4d5e4f608a9b0c1d2e3f4a5b"])
    assert.deepEqual(parseLink(`strom-research://open?tree=${ID}&handoff=${encodeURIComponent(bad)}`), { action: "open", tree: ID }, bad);
  // the menu (no link) has none to keep; a link of a new research keeps it as any other
  assert.deepEqual(parseLink(""), { action: "menu" });
  assert.equal(parseLink(`strom-research://new?app=${"a".repeat(22)}&handoff=${H1}`).handoff, H1);
  // handed to the terminal opened for it: written again with the link
  const link = parseLink(`strom-research://task?tree=${ID}&task=T0007&do=park&handoff=${H1}`);
  assert.ok(link.action !== "menu");
  const again = linkText(link);
  assert.match(again, new RegExp(`handoff=${H1}`));
  assert.deepEqual(parseLink(again), link);
});

test("a link's id is said for a minute after it was taken, then gone with its file; only an id of the shape is written", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "strom-handoffs-"));
  try {
    const t = 1_800_000_000_000;
    assert.deepEqual(handoffsNow(root, t), [], "none taken: none said, nothing made");
    assert.ok(!fs.existsSync(path.join(root, ".strom", "handoffs")));
    assert.equal(noteHandoff(root, "../../escape", t), false);
    assert.equal(noteHandoff(root, H1.toUpperCase(), t), false, "only as parseLink gives it: lower case");
    assert.equal(noteHandoff(root, H1, t), true);
    assert.equal(noteHandoff(root, H2, t + 10_000), true);
    assert.deepEqual(handoffsNow(root, t + 10_000), [H2, H1], "newest first");
    assert.deepEqual(handoffsNow(root, t + HANDOFF_MS - 1), [H2, H1]);
    assert.deepEqual(handoffsNow(root, t + HANDOFF_MS), [H2]);
    assert.ok(!fs.existsSync(path.join(root, ".strom", "handoffs", H1)), "the old one's file removed");
    assert.deepEqual(handoffsNow(root, t + 10_000 + HANDOFF_MS), []);
    // something else in the folder: never said, removed
    fs.writeFileSync(path.join(root, ".strom", "handoffs", "foreign"), "x");
    fs.writeFileSync(path.join(root, ".strom", "handoffs", H3), "not a time");
    assert.deepEqual(handoffsNow(root, t), []);
    assert.deepEqual(fs.readdirSync(path.join(root, ".strom", "handoffs")), []);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("the folder of ids keeps at most 64: the oldest beyond go; a folder of an id's name is removed, never said", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "strom-handoffs-"));
  try {
    const t = 1_800_000_000_000;
    const dir = path.join(root, ".strom", "handoffs");
    const ids = Array.from({ length: 70 }, (_, i) => `${String(i).padStart(8, "0")}-2222-4333-8444-555555555555`);
    ids.forEach((id, i) => assert.equal(noteHandoff(root, id, t + i), true));
    const kept = fs.readdirSync(dir).sort();
    assert.equal(kept.length, 64, "the folder itself stays within the limit, not only what is said");
    assert.deepEqual(kept, ids.slice(6).sort(), "the oldest went");
    assert.deepEqual(handoffsNow(root, t + 70), ids.slice(6).reverse());
    // a folder named as an id (nothing strom writes): not said, removed with what is in it; /status goes on
    fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(path.join(dir, H3, "inside"), { recursive: true });
    fs.writeFileSync(path.join(dir, H3, "inside", "x"), "x");
    assert.equal(noteHandoff(root, H1, t), true);
    assert.deepEqual(handoffsNow(root, t), [H1]);
    assert.deepEqual(fs.readdirSync(dir), [H1]);
    assert.match(withHandoffs('{"ok":true}', handoffsNow(root, t)), new RegExp(`"handoffs":\\["${H1}"\\]`));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("/status carries the ids as they are at each ask, the answer made for the state otherwise as it was", () => {
  assert.deepEqual(JSON.parse(withHandoffs(JSON.stringify({ strom: "1", tree: { id: "x" } }), [H1])), { strom: "1", tree: { id: "x" }, handoffs: [H1] });
  assert.deepEqual(JSON.parse(withHandoffs(JSON.stringify({ a: [1, { b: "}" }] }), [])), { a: [1, { b: "}" }], handoffs: [] });
});

test("the bridge says a link taken (feature handoffs): in a terminal at once, without one when done; none when no terminal opened", { skip: !hasGit || process.platform === "win32" }, async () => {
  const { w, mark } = await world();
  const id = JSON.parse(fs.readFileSync(path.join(w.cwd, "strom.json"), "utf8")).id as string;
  const info = (await w.ok(["live", "start", "--json"])).json;
  const status = async (q = "") => (await (await fetch(`${info.url}/status${q}`)).json()) as { features: string[]; handoffs: string[] };
  try {
    const first = await status();
    assert.ok(first.features.includes("handoffs"));
    assert.deepEqual(first.handoffs, []);
    // what needs no terminal (the excerpt in full), done: said
    const excerpt = `strom-research://excerpt?tree=${id}&source=S0001&clip=${mark}`;
    const r = await w.ok(["link", "open", `${excerpt}&handoff=${H1}`, "--json"]);
    assert.equal(r.json.done, true);
    assert.deepEqual((await status()).handoffs, [H1]);
    // the light /status (parts=1) too
    assert.deepEqual((await status("?parts=1")).handoffs, [H1]);
    // in a terminal (the one the system opened for it): said at once, before anything is asked
    await w.ok(["link", "open", `strom-research://sessions?tree=${id}&handoff=${H2}`], { tty: true, answers: [""] });
    assert.deepEqual((await status()).handoffs, [H2, H1]);
    // a value of another shape: the link done as without it, nothing said or written
    const odd = await w.ok(["link", "open", `${excerpt}&handoff=..%2F..%2Fx`, "--json"]);
    assert.equal(odd.json.done, true);
    assert.deepEqual(fs.readdirSync(path.join(w.cwd, ".strom", "handoffs")).sort(), [H1, H2].sort());
    // the terminal for it did not open (none here, STROM_NO_OPEN): not said — the app says "the terminal did not open?"
    await w.run(["link", "open", `strom-research://open?tree=${id}&handoff=${H3}`, "--json"]);
    assert.ok(!(await status()).handoffs.includes(H3));
    // a minute later: gone, its file too
    fs.writeFileSync(path.join(w.cwd, ".strom", "handoffs", H1), String(Date.now() - HANDOFF_MS - 1));
    assert.deepEqual((await status()).handoffs, [H2]);
    assert.ok(!fs.existsSync(path.join(w.cwd, ".strom", "handoffs", H1)));
  } finally {
    await w.ok(["live", "stop"]);
  }
});
