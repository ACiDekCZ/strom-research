// What a send of the Strom app adds to the research's history is what it changed: no file is stored again whole for
// lines added to it (found on Mac: a month's operation log of 3.4 MB stored again at every send, ~1 MB of .git each).

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { World, hasGit } from "../helpers.ts";

const opts = { skip: !hasGit };

test("a send of one or two edits to a tree of hundreds adds only small files to git — never a log stored again whole", opts, async () => {
  const w = new World();
  await w.withTree("Velký");
  const N = 300;
  const head0 = ["0 HEAD", "1 SOUR STROM", "1 GEDC", "2 VERS 5.5.1", "1 CHAR UTF-8"];
  const body = (occ: Record<number, string>, refn: boolean) => {
    const out: string[] = [];
    for (let i = 1; i <= N; i++)
      out.push(`0 @I${i}@ INDI`, ...(refn ? [`1 REFN P${String(i).padStart(4, "0")}`, "2 TYPE strom-research"] : []), `1 NAME Osoba${i} /Novák${i % 30}/`, `1 SEX ${i % 2 ? "M" : "F"}`, "1 BIRT", `2 DATE ${1800 + (i % 120)}`, `2 PLAC Obec${i % 40}`, `1 OCCU ${occ[i] ?? "rolník"}`);
    for (let i = 1; i + 2 <= N; i += 3) out.push(`0 @F${i}@ FAM`, `1 HUSB @I${i}@`, `1 WIFE @I${i + 1}@`, `1 CHIL @I${i + 2}@`);
    return out;
  };
  const adopt = path.join(w.dir, "adopt.ged");
  fs.writeFileSync(adopt, [...head0, ...body({}, false), "0 TRLR", ""].join("\n"));
  await w.ok(["sync", adopt, "--apply", "--force"]);
  const id = JSON.parse(fs.readFileSync(path.join(w.cwd, "strom.json"), "utf8")).id as string;
  const git = (args: string[]) => execFileSync("git", args, { cwd: w.cwd, encoding: "utf8", maxBuffer: 1 << 26 });
  const info = (await w.ok(["live", "start", "--json"])).json;
  const occ: Record<number, string> = {};
  try {
    for (let s = 1; s <= 3; s++) {
      occ[s * 7] = `kovář${s}`;
      const text = [...head0, `1 _STROM_TREE ${id}`, "1 _STROM_APP_TREE t1", `1 _STROM_HEAD ${git(["rev-parse", "HEAD"]).trim()}`, ...body(occ, true), "0 TRLR", ""].join("\n");
      const r = (await fetch(`${info.url}/sync`, { method: "POST", body: text, headers: { Origin: "https://beta.stromapp.info", "Content-Type": "text/plain; charset=utf-8" } }).then((x) => x.json())) as { applied: number };
      assert.equal(r.applied, 1, JSON.stringify(r));
      // the files the send's commit wrote, each by its size
      const blobs = git(["diff-tree", "-r", "--no-commit-id", "HEAD"]).trim().split("\n").map((l) => {
        const [, , , sha, , file] = l.split(/\s+/);
        return { file: file!, size: /^0+$/.test(sha!) ? 0 : Number(git(["cat-file", "-s", sha!]).trim()) };
      });
      const big = blobs.filter((b) => b.size > 20_000);
      assert.deepEqual(big, [], `send ${s}: only what changed — ${JSON.stringify(blobs)}`);
      // no operation log of an earlier commit written again
      assert.ok(blobs.filter((b) => b.file.startsWith("data/ops/")).every((b) => /^data\/ops\/\d{4}-\d{2}\/\d{2}\//.test(b.file) && git(["log", "--format=%H", "--", b.file]).trim().split("\n").length === 1), JSON.stringify(blobs));
    }
  } finally {
    await w.ok(["live", "stop"]);
  }
  // every operation read back, the old and the new logs alike: the research is whole
  assert.match((await w.ok(["check"])).out, /^ok/);
  w.cleanup();
});
