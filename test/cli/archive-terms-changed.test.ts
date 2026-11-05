// A level of strom's list of archives' terms (assets/archives.json) changed by a newer strom: a research's books there
// read with the new level at once — derived from the list each time, nothing of the research rewritten. An archive
// allowed before and restricted now (Landesarchiv Berlin), and one the list did not know and keeps for a person's hand
// now (the DFG-Viewer). No request leaves this computer.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { World, hasGit } from "../helpers.ts";

const opts = { skip: !hasGit };

/** Every file of the research's data, by its hash. */
function dataHashes(tree: string): Record<string, string> {
  const out: Record<string, string> = {};
  const walk = (dir: string) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else out[path.relative(tree, p)] = crypto.createHash("sha256").update(fs.readFileSync(p)).digest("hex");
    }
  };
  walk(path.join(tree, "data"));
  return out;
}

test("books of an archive whose level changed read with the new one — the research untouched", opts, async () => {
  const w = new World();
  const tree = await w.withTree("Lhotákovi");
  try {
    await w.ok(["research", "new", "X", "--new-person", "Jan /Lhoták/"]);
    // as an older strom wrote them: online, free to view
    await w.ok(["recordset", "add", "Lhota Namensverzeichnis 1874–1900", "--kinds", "birth", "--places", "Lhota", "--years", "1874-1900", "--access", "online-free", "--url", "https://content.landesarchiv-berlin.de/labsa/show/lhota"]); // B1
    await w.ok(["recordset", "add", "Lhota Kirchenbuch 1780–1820", "--kinds", "baptism", "--places", "Lhota", "--years", "1780-1820", "--access", "online-free", "--url", "https://dfg-viewer.de/show?id=lhota-1780"]); // B2
    await w.ok(["task", "add", "Geburt Jan", "--level", "link", "--where", "B1", "--why", "a", "--done-when", "b"]); // T1
    await w.ok(["task", "add", "Taufe Jan", "--level", "link", "--where", "B2", "--why", "a", "--done-when", "b"]); // T2
    const before = dataHashes(tree);

    // allowed before, restricted now: the person decides about its images, asked once
    const berlin = (await w.ok(["brief", "T1"])).out;
    assert.match(berlin, /archive content\.landesarchiv-berlin\.de: restricted · no decision of the person's yet/);
    // not known before, by hand only now (its robots.txt keeps AI agents off by name)
    const dfg = (await w.ok(["brief", "T2"])).out;
    assert.match(dfg, /archive dfg-viewer\.de: manual — only through a person's browser/);
    assert.match(dfg, /access by hand \(online, free to view — only through a person's browser\)/);
    assert.match((await w.ok(["recordset", "show", "B2"])).out, /access {6}online, free to view — only through a person's browser/);

    // nothing of the research rewritten
    for (const b of ["B1", "B2"]) assert.equal((await w.ok(["recordset", "show", b, "--json"])).json.recordset.access, "online-free", b);
    assert.deepEqual(dataHashes(tree), before);
  } finally {
    w.cleanup();
  }
});
