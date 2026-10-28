// strom --timing (STROM_TIMING=1): what each step of the start, the menu and strom doctor took, and how much of the
// disk it went through, in one line on stderr to send when strom is slow; strom doctor says what it checks while it
// checks, and a research in a cloud's folder with what to do — nothing downloaded or changed for it.

import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { World, hasGit } from "../helpers.ts";

const opts = { skip: !hasGit };

test("strom doctor --timing: the line to send on stderr, in the person's language; the output as it was; off: nothing", opts, async () => {
  const w = new World();
  try {
    await w.withTree("Lhotákovi");
    const r = await w.run(["doctor", "--json", "--timing"]);
    assert.ok(r.json, "the JSON stays whole");
    assert.match(r.err, /^Jak dlouho trvaly jednotlivé kroky/m);
    assert.match(r.err, /^strom \d+\.\d+\.\d+\S* · \w+ · Node v\d+\S* · total \d+(\.\d+)? s/m);
    // the same by the environment; an agent reads it in English
    const env = await w.run(["doctor"], { env: { STROM_TIMING: "1", CLAUDECODE: "1" } });
    assert.match(env.err, /^How long each step took/m);
    assert.match(env.err, / · total /);
    const off = await w.run(["doctor"]);
    assert.doesNotMatch(off.err, /total \d/);
    // the menu: said once, before its question
    const menu = await w.ok(["--timing"], { tty: true, answers: ["0"] });
    assert.equal((menu.err + menu.out).match(/Jak dlouho trvaly/g)?.length, 1);
    assert.match(menu.err + menu.out, /menu\.\w+|total/);
  } finally {
    w.cleanup();
  }
});

test("strom doctor: a research in a cloud's folder said with what to do; what it checks shown on the terminal while it checks", opts, async () => {
  const w = new World();
  try {
    const home = path.join(w.dir, "OneDrive", "Dokumenty", "Strom Lhoták");
    await w.ok(["setup", "--home", home, "--yes"]);
    await w.ok(["init", "Lhotákovi"]);
    const r = await w.run(["doctor", "--json"]);
    const place = r.json.checks.find((c: { name: string }) => c.name === "place");
    assert.equal(place.status, "warn");
    assert.match(place.detail, /v OneDrive – každý soubor/);
    assert.match(place.fix, /Vždy zachovat na tomto zařízení/);
    assert.match(place.fix, /strom sám nic nestahuje/);
    // a person at the terminal sees what is being checked, the line cleared at the end; JSON and agents see none
    const tty = await w.run(["doctor"], { tty: true });
    assert.match(tty.err, /kontroluje se: git \(historie\)…/);
    assert.match(tty.err, /kontroluje se: kde výzkum leží…/);
    assert.match(tty.err, /\r\x1b\[K$/);
    assert.doesNotMatch(r.err, /kontroluje se/);
    assert.doesNotMatch((await w.run(["doctor"], { tty: true, env: { CLAUDECODE: "1" } })).err, /checking|kontroluje/);
    // a folder of this computer: nothing said
    const local = new World();
    try {
      await local.withTree("Lhotákovi");
      assert.equal((await local.run(["doctor", "--json"])).json.checks.some((c: { name: string }) => c.name === "place"), false);
    } finally {
      local.cleanup();
    }
  } finally {
    w.cleanup();
  }
});
