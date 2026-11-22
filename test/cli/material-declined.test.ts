// A person taken off a file of the material that is only in the research (not in the Strom app's tree): kept on the
// file (Input.declined), so nothing puts them back — the sorting's prompt lists them as taken off and drops a reader's
// link or portrait of them, strom input sort and strom intake --person (the agent's) leave them off; added back by the
// person (the Strom app's Assign, strom input assign --add), the mark goes. Made-up names only (Lhoták, Lhota).

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { World, hasGit } from "../helpers.ts";
import { Tree } from "../../src/core/tree.ts";
import { keptProposals, sortPrompt } from "../../src/core/sort.ts";
import type { Input } from "../../src/core/model.ts";

const opts = { skip: !hasGit };
const fixtures = path.join(import.meta.dirname, "..", "fixtures", "images");

test("taken off a file of the research only: kept, never proposed again by sorting, input sort or intake --person; added back, the mark goes", opts, async () => {
  const w = new World();
  try {
    await w.withTree();
    await w.ok(["person", "add", "Jan /Lhoták/".normalize("NFD"), "--sex", "M"]); // P1
    await w.ok(["person", "add", "Marie /Lhotáková/", "--sex", "F"]); // P2
    const dir = path.join(w.dir, "Krabice z Lhoty");
    fs.mkdirSync(dir, { recursive: true });
    fs.copyFileSync(path.join(fixtures, "s0001.jpg"), path.join(dir, "svatba.jpg"));
    const a: string = (await w.ok(["intake", dir, "--person", "P0001", "--person", "P0002", "--json"])).json.inputs[0].id;
    const input = () => Tree.open(w.cwd, w.env).get<Input>(a)!;
    assert.deepEqual(input().persons, ["P0001", "P0002"]);

    // the Strom app's Assign: P1 taken off — kept on the file
    const off = (await w.ok(["input", "assign", a, "--remove", "P1", "--json"])).json;
    assert.deepEqual(off.changed, [a]);
    assert.deepEqual(input().persons, ["P0002"]);
    assert.deepEqual(input().declined!.map((d) => d.person), ["P0001"]);

    // the sorting: the prompt says it, a reader's link and portrait of P1 dropped, P2's kept
    const tree = Tree.open(w.cwd, w.env);
    const prompt = sortPrompt(tree, { files: [{ input: input(), views: [] }], text: "", lang: "cs", report: "r.md", context: { people: [], families: [], sources: [], more: 0 }, langName: "Czech" });
    assert.match(prompt, new RegExp(`links the person took off \\(never propose them\\): person P0001`, "u"));
    const kept = keptProposals(tree, [a], [{ id: a, links: [{ type: "person", ref: "P0001" }, { type: "portrait", ref: "P0001" }, { type: "portrait", ref: "P0002" }] }]);
    assert.deepEqual(kept.dropped.map((d) => `${d.what}: ${d.why}`), ["link person P0001: taken off by the person", "link portrait P0001: taken off by the person"]);
    assert.deepEqual(kept.proposals[0]!.links, [{ type: "portrait", ref: "P0002" }]);

    // strom input sort --person P1: left off, said
    const sorted = await w.ok(["input", "sort", a, "--as", "photo", "--person", "P0001", "--person", "P0002", "--json"]);
    assert.deepEqual(sorted.json.declined, [{ id: a, person: "P0001" }]);
    assert.deepEqual(input().persons, ["P0002"]);
    assert.deepEqual(input().sorted!.persons, ["P0002"]);
    assert.match((await w.ok(["input", "sort", a, "--as", "photo", "--person", "P0001"])).out, new RegExp(`^P0001 not put on ${a}: the person took them off it`, "mu"));
    assert.deepEqual(input().persons, ["P0002"]);

    // added back by the person: the mark goes, and sorting may put them on again
    const back = (await w.ok(["input", "assign", a, "--add", "P1", "--json"])).json;
    assert.deepEqual(back.changed, [a]);
    assert.deepEqual(input().persons, ["P0002", "P0001"]);
    assert.equal(input().declined, undefined);
    const again = keptProposals(Tree.open(w.cwd, w.env), [a], [{ id: a, links: [{ type: "portrait", ref: "P0001" }] }]);
    assert.deepEqual(again.dropped, []);
    assert.equal(execFileSync("git", ["-C", w.cwd, "status", "--porcelain"], { encoding: "utf8" }).trim(), "", "every write committed");
  } finally {
    w.cleanup();
  }
});
