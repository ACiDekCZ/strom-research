// The ways an archive's images may come, offered alike wherever the person is asked (core/archiveasks.ts waysOffered):
// the terminal's question of a fetch, the hint after "later", the menu's What waits and Settings → Archives — through
// the browser only where the downloader can take that route (and Claude Code does the research here). A way other than
// the one the fetch needed takes the connector's route with it, and the fetch goes that way. A person's answer is
// simulated only in each test's own settings (R8).

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { World, hasGit, fakeConnector, readJsonFile } from "../helpers.ts";

const opts = { skip: !hasGit || process.platform === "win32" };

const store = (w: World) => readJsonFile(path.join(w.env.STROM_CONFIG_DIR!, "archives.json"));
const config = (w: World) => readJsonFile(path.join(w.env.STROM_CONFIG_DIR!, "config.json"));
const BROWSER = /Přes prohlížeč na tomto počítači/;

/** A research whose agent is Claude Code (here: a stand-in on PATH), a downloader of an archive that restricts automation. */
async function world(routes?: string[]): Promise<{ w: World; env: Record<string, string> }> {
  const w = new World();
  await w.withTree();
  const bin = path.join(w.dir, "bin");
  fs.mkdirSync(bin);
  fs.writeFileSync(path.join(bin, "claude"), "#!/bin/sh\nexit 0\n", { mode: 0o755 });
  const env = { PATH: `${bin}${path.delimiter}${w.env.PATH}`, STROM_AGENT: "claude" };
  const dir = await fakeConnector(w, "zkusebni", "", { automation: "restricted", terms: "https://archive.example.org/terms" });
  const file = path.join(dir, "connector.json");
  if (routes) fs.writeFileSync(file, JSON.stringify({ ...readJsonFile(file), can: ["find", "list", "locate", "fetch"], routes }));
  await w.ok(["recordset", "add", "Kniha N", "--url", "https://archive.example.org/book/5359"]); // B0001
  return { w, env };
}

/** The question of the fetch (later), the hint after it, strom allow archive's list, What waits, Settings → Archives: what each offers. */
async function offered(w: World, env: Record<string, string>): Promise<{ fetch: string; hint: string; list: string; waits: string; settings: string }> {
  const r = await w.run(["fetch", "zkusebni", "5359", "--images", "1-2", "--recordset", "B1"], { tty: true, answers: ["0"], env });
  assert.equal(r.code, 4, r.out + r.err);
  const list = (await w.ok(["allow", "archive"], { env })).out;
  const waits = await w.run([], { tty: true, answers: ["3", "1", "0", "0", "0"], env });
  const look = await w.run([], { tty: true, answers: ["8", "4", "0", "0", "0"], env });
  const key = /(\d) {2}Svolení ke stahování z archivů/.exec(look.out)?.[1];
  assert.ok(key, look.out);
  const settings = await w.run([], { tty: true, answers: ["8", "4", key!, "1", "0", "0", "0", "0", "0"], env });
  const question = (out: string) => /jak získávat snímky\?\n((?: {3}\d {2}[^\n]*\n)+)/.exec(out)?.[1] ?? "";
  return { fetch: question(r.out), hint: /--way \S+/.exec(r.err)?.[0] ?? "", list: /--way \S+/.exec(list)?.[0] ?? "", waits: question(waits.out), settings: question(settings.out) };
}

test("a downloader without the browser's route: the fetch's question, the hint after later, What waits and the settings offer no browser", opts, async () => {
  const { w, env } = await world();
  try {
    const o = await offered(w, env);
    for (const [where, text] of Object.entries({ fetch: o.fetch, waits: o.waits, settings: o.settings })) {
      assert.match(text, /Pomalu, lidským tempem/, where);
      assert.match(text, /Jen ručně/, where);
      assert.doesNotMatch(text, BROWSER, where);
    }
    assert.equal(o.hint, "--way slow|manual");
    assert.equal(o.list, o.hint, "strom allow archive's list offers what the fetch offers");
    assert.deepEqual(store(w).pending.find((p: { kind: string }) => p.kind === "permission").choices, ["slow", "manual"]);
  } finally {
    w.cleanup();
  }
});

test("a downloader that can go through the browser: the browser offered everywhere alike; chosen at the fetch's question, the route follows and the fetch goes through the browser", opts, async () => {
  const { w, env } = await world(["direct", "browser"]);
  try {
    const o = await offered(w, env);
    for (const [where, text] of Object.entries({ fetch: o.fetch, waits: o.waits, settings: o.settings })) {
      assert.match(text, / 1 {2}Pomalu, lidským tempem[^\n]*\n {3}2 {2}Přes prohlížeč na tomto počítači[^\n]*\n {3}3 {2}Jen ručně/, where);
    }
    assert.equal(o.hint, "--way slow|browser|manual");
    assert.equal(o.list, o.hint, "strom allow archive's list offers what the fetch offers");
    // the browser chosen in the terminal: kept, the connector's route with it, the fetch planned through the browser
    const r = await w.run(["fetch", "zkusebni", "5359", "--images", "1-2", "--recordset", "B1"], { tty: true, answers: ["2"], env });
    assert.equal(r.code, 0, r.out + r.err);
    assert.equal(store(w).archives["archive.example.org"].way, "browser");
    assert.equal(config(w).connectorRoutes?.zkusebni?.via, "browser");
    assert.match(r.out, /browser plan/);
    assert.equal(store(w).pending.filter((p: { kind: string }) => p.kind === "permission").length, 0);
  } finally {
    w.cleanup();
  }
});
