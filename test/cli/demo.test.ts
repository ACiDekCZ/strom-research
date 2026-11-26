// strom demo (spec 143 R1): the sample research downloaded from the web's folder, checked against its SHA-256 and put
// in place apart from the person's own trees and settings — marked demo, nothing of an agent offered in what the app
// reads; the download not as its SHA-256 says: nothing set up; --remove deletes the sample alone.

import { test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { World, hasGit } from "../helpers.ts";
import { status } from "../../src/core/live.ts";
import { demoEnv } from "../../src/core/demo.ts";

const opts = { skip: !hasGit || process.platform === "win32" };
const sha = (b: Buffer) => crypto.createHash("sha256").update(b).digest("hex");

/** A sample made by strom pack in a world of its own, laid out as the web serves it: <base>/cs/VERSION, the package, its SHA-256. */
async function sampleWeb(dir: string, opts: { damaged?: boolean } = {}): Promise<{ base: string; id: string }> {
  const maker = new World();
  await maker.ok(["setup", "--yes"]);
  await maker.ok(["init", "Lhotákovi z Lhoty", "--lang", "cs"]);
  const root = maker.treeDir("Lhotákovi z Lhoty");
  await maker.ok(["person", "add", "Vojtěch /Lhoták/", "--sex", "M"], { cwd: root });
  await maker.ok(["person", "add", "Анна /Лгота/", "--sex", "F"], { cwd: root });
  const id = (JSON.parse(fs.readFileSync(path.join(root, "strom.json"), "utf8")) as { id: string }).id;
  const web = path.join(dir, "web");
  fs.mkdirSync(path.join(web, "cs"), { recursive: true });
  const name = "strom-ukazka-cs-9.9.0.strom";
  // strom pack writes a ZIP; the web serves it renamed (findPack reads the content, not the name)
  await maker.ok(["pack", "--out", path.join(web, "cs", `${name}.zip`)], { cwd: root });
  fs.renameSync(path.join(web, "cs", `${name}.zip`), path.join(web, "cs", name));
  const pkg = fs.readFileSync(path.join(web, "cs", name));
  fs.writeFileSync(path.join(web, "cs", "VERSION"), "9.9.0\n");
  fs.writeFileSync(path.join(web, "cs", `${name}.sha256`), `${opts.damaged ? sha(Buffer.from("something else")) : sha(pkg)}  ${name}\n`);
  return { base: pathToFileURL(web).href, id };
}

/** What of the person's own is on disk: every file of their settings and trees with its content's hash (the sample's folder left out). */
function own(w: World, trees: string): Record<string, string> {
  const out: Record<string, string> = {};
  const config = w.env.STROM_CONFIG_DIR!;
  const walk = (dir: string) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (p === path.join(config, "demo")) continue;
      if (e.isDirectory()) walk(p);
      else if (e.isFile()) out[p] = sha(fs.readFileSync(p));
    }
  };
  walk(config);
  walk(trees);
  return out;
}

test("strom demo: the sample apart from the person's own trees and settings, marked demo, no agent offered to the app; again it opens; --remove deletes it alone", opts, async () => {
  const w = new World();
  await w.ok(["setup", "--yes"]);
  await w.ok(["init", "Lhotovi", "--lang", "cs"]);
  const mine = w.treeDir("Lhotovi");
  await w.ok(["person", "add", "Božena /Lhotová/", "--sex", "F"], { cwd: mine });
  const trees = path.dirname(mine);
  const web = await sampleWeb(w.dir);
  const env = { STROM_DEMO_BASE: web.base };
  // the trees the person's strom has seen, noted before (strom trees notes them: none of the sample's doing)
  await w.ok(["trees"], { cwd: mine });
  const before = own(w, trees);


  const r = await w.ok(["demo", "cs", "--json"], { cwd: mine, env });
  const said = JSON.parse(r.out);
  const config = w.env.STROM_CONFIG_DIR!;
  const sample = said.data?.root ?? said.root;
  assert.ok(sample.startsWith(path.join(config, "demo") + path.sep), `the sample inside strom's settings, apart: ${sample}`);
  const tree = JSON.parse(fs.readFileSync(path.join(sample, "strom.json"), "utf8"));
  assert.equal(tree.demo, true);
  assert.equal(tree.id, web.id, "the package's own id");
  // nothing of the person's own changed: their settings, their trees (the sample is none of them)
  assert.deepEqual(own(w, trees), before);
  const listed = JSON.parse((await w.ok(["trees", "--json"], { cwd: mine })).out);
  assert.ok(!JSON.stringify(listed).includes("Lhotákovi z Lhoty"), "the sample is not among the person's trees");

  // what the app reads of it: a research to look through, marked demo — no agent named, nothing that starts one
  const shown = status(sample, demoEnv({ ...process.env, ...w.env } as Record<string, string>)) as { features: string[]; tree: { demo?: boolean; state: string }; work?: unknown; agent?: unknown };
  assert.equal(shown.tree.demo, true);
  assert.equal(shown.tree.state, "research");
  for (const f of ["work.link", "run.tasks", "work.tasks", "run.lines", "material.sort", "house.request"]) assert.ok(!shown.features.includes(f), `${f} not said for the sample`);
  assert.equal(shown.work, undefined);
  assert.equal(shown.agent, undefined);
  // the person's own research: the agent's features said as ever
  const mineShown = status(mine, { ...process.env, ...w.env } as Record<string, string>) as { features: string[]; tree: { demo?: boolean } };
  assert.ok(mineShown.features.includes("work.link"));
  assert.equal(mineShown.tree.demo, undefined);

  // an agent on the sample is kept from the person's own settings too (its seal keys, logins)
  const claude = fs.readFileSync(path.join(sample, ".claude", "settings.json"), "utf8");
  assert.ok(claude.includes(path.join(config, "keys")), "the person's seal keys denied to the sample's agent");

  // again: the sample here opens, nothing downloaded
  const again = JSON.parse((await w.ok(["demo", "cs", "--json"], { cwd: mine, env })).out);
  assert.equal(again.data?.downloaded ?? again.downloaded, false);

  // --remove: the sample alone gone
  const removed = await w.ok(["demo", "--remove"], { cwd: mine });
  assert.match(removed.out, /Ukázkový výzkum je z tohoto počítače smazaný/u);
  assert.match(removed.out, /Správě stromů/u);
  assert.ok(!fs.existsSync(path.join(config, "demo")));
  assert.deepEqual(own(w, trees), before);
  assert.match((await w.ok(["demo", "--remove"], { cwd: mine })).out, /Ukázkový výzkum na tomto počítači není/u);
});

test("strom demo: a download not as its SHA-256 says, or a language with no sample — nothing set up", opts, async () => {
  const w = new World();
  await w.ok(["setup", "--yes"]);
  const web = await sampleWeb(w.dir, { damaged: true });
  const config = w.env.STROM_CONFIG_DIR!;
  const r = await w.run(["demo", "cs"], { env: { STROM_DEMO_BASE: web.base } });
  assert.notEqual(r.code, 0);
  assert.match(r.err, /stažený ukázkový výzkum je poškozený \(nesedí jeho SHA-256\) – nic se nezaložilo/u);
  assert.ok(!fs.existsSync(path.join(config, "demo")), "nothing set up");
  const json = await w.run(["demo", "cs", "--json"], { env: { STROM_DEMO_BASE: web.base } });
  assert.match(json.out + json.err, /demo\.damaged/u);
  const unknown = await w.run(["demo", "xx"], { env: { STROM_DEMO_BASE: web.base } });
  assert.equal(unknown.code, 2);
  assert.match(unknown.err, /ukázkový výzkum v jazyce „xx“ není – je jen v jazycích cs, en, de, pl/u);
  const gone = await w.run(["demo", "cs"], { env: { STROM_DEMO_BASE: pathToFileURL(path.join(w.dir, "nowhere")).href } });
  assert.notEqual(gone.code, 0);
  assert.match(gone.err, /ukázkový výzkum se nepodařilo stáhnout/u);
  assert.ok(!fs.existsSync(path.join(config, "demo")), "nothing set up");
});
