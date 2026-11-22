// Plans of the browser by session (spec 126 U8): `strom fetch <connector> --take` takes over only the plans of its own
// session — a plan of another session still at work is left to it, said in one sentence; a plan of a session that ended
// is anyone's, and so is one with no session (planned by a strom before). A local server plays the archive.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { readJsonFile } from "../helpers.ts";
import { opts, world } from "./connectors.helpers.ts";

test("--take takes its own session's plans, leaves another live session's alone (one sentence), takes an ended session's and one of no session", opts, async () => {
  const { w, a, dir } = await world();
  try {
    const downloads = path.join(w.dir, "Stažené soubory");
    fs.mkdirSync(downloads);
    await w.ok(["config", "set", "browser.downloads", downloads]);
    await w.ok(["recordset", "add", "Lhota N 1784–1820", "--kinds", "baptism", "--url", `${a.base}/book/5359`]); // B0001
    const manifest = path.join(dir, "connector.json");
    const m = readJsonFile(manifest);
    fs.writeFileSync(manifest, JSON.stringify({ ...m, can: [...m.can, "locate"], routes: ["direct", "browser"], policy: { automation: "allowed", pace: { minIntervalMs: 2000 } } }));
    await w.ok(["connector", "use", "zkusebni", "--via", "browser"]);
    for (const what of ["Křest Lhotáka", "Křest Lhotové"]) await w.ok(["task", "add", what, "--level", "locate", "--where", "Lhota", "--why", "rodiče", "--done-when", "zápis"]);
    // two sessions at work in the tree, each its own agent
    const one = { STROM_WORKER: "claude-Lhoták", CLAUDECODE: "1" };
    const two = { STROM_WORKER: "codex-Lhota", CODEX_SANDBOX: "seatbelt" };
    await w.ok(["session", "start", "T0001"], { env: one });
    await w.ok(["session", "start", "T0002"], { env: two });
    const plans = path.join(w.cwd, ".strom", "browser");
    const saved = (n: number) => fs.copyFileSync(path.join(import.meta.dirname, "..", "fixtures", "images", `s000${n}.jpg`), path.join(downloads, `strom-zkusebni-5359-000${n}.jpg`));

    // N0001 plans images 1–2: its plan carries its session
    const planned = (await w.ok(["fetch", "zkusebni", "5359", "--images", "1-2", "--recordset", "B1", "--json"], { env: one })).json;
    assert.equal(planned.plan.items.length, 2);
    const file = path.join(plans, fs.readdirSync(plans).find((f) => f.endsWith(".json"))!);
    assert.equal(readJsonFile(file).session, "N0001");
    saved(1);
    saved(2);
    // N0002 takes nothing of it: left to N0001, said in one sentence; the downloads stay where they are
    const left = await w.run(["fetch", "zkusebni", "--take", "--result", "strom-result 1:200:1843 2:200:1790"], { env: two });
    assert.match(left.out, /left alone: a plan of the browser made by session N0001, still at work — that session takes it over itself/u);
    assert.doesNotMatch(left.out, /taken over from/u);
    assert.ok(fs.existsSync(file), "the plan stays N0001's");
    assert.ok(fs.existsSync(path.join(downloads, "strom-zkusebni-5359-0001.jpg")) && fs.existsSync(path.join(downloads, "strom-zkusebni-5359-0002.jpg")), "its downloads stay");

    // a plan of no session (a strom before): anyone's — N0002 takes it over
    const p = readJsonFile(file);
    delete p.session;
    fs.writeFileSync(file, JSON.stringify(p));
    const old = await w.ok(["fetch", "zkusebni", "--take", "--result", "strom-result 1:200:1843 2:200:1790"], { env: two });
    assert.match(old.out, /2 images taken over from .*Stažené soubory/u);
    assert.doesNotMatch(old.out, /left alone/u);

    // N0001 plans image 3, then ends: its plan is anyone's — N0002 takes it
    await w.ok(["fetch", "zkusebni", "5359", "--images", "3-3", "--recordset", "B1"], { env: one });
    saved(3);
    const before = await w.run(["fetch", "zkusebni", "--take", "--result", "strom-result 3:200:1801"], { env: two });
    assert.match(before.out, /left alone/u, "still at work: left alone");
    await w.ok(["session", "close", "--continue", "--summary", "obraz 3 naplánován", "--next", "převzít obraz 3"], { env: one });
    const after = await w.ok(["fetch", "zkusebni", "--take", "--result", "strom-result 3:200:1801"], { env: two });
    assert.match(after.out, /1 image taken over from .*: registered M\d{4}/u);
    assert.deepEqual(fs.readdirSync(plans).filter((f) => f.endsWith(".json")), [], "nothing planned left");
  } finally {
    w.cleanup();
    await a.close();
  }
});
