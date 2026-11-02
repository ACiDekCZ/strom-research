// strom updated while a run works: an agent's call in the session ran the new strom, which brought the research to
// its data schema, and the old run then cannot open it. Said as what it is — the run ended, the next start runs on the
// new version, the run to start again — never the way back of a beta nor the backup of another switch. Without a
// newer strom on disk, a research a newer strom wrote is refused as before.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { World, hasGit } from "../helpers.ts";
import { SCHEMA_VERSION } from "../../src/core/model.ts";
import { spawnSync } from "node:child_process";

const opts = { skip: !hasGit };

/**
 * A research with one task and an "agent" that, in its session, does what the newer strom did: the data brought to
 * a newer schema by 99.0.0 — and, when `onDisk`, that strom put on disk (`disk`: the file standing for its package).
 */
async function research(onDisk: boolean): Promise<{ w: World; disk: string }> {
  const w = new World();
  await w.withTree("Lhotákovi");
  await w.ok(["research", "new", "Předci Jana Lhotáka", "--new-person", "Jan /Lhoták/", "--sex", "M", "--born", "ABT 1790", "--born-place", "Lhota"]);
  await w.ok(["task", "add", "Křest Jana Lhotáka", "--level", "locate", "--where", "Lhota", "--why", "rodiče", "--done-when", "zápis", "--about", "P1"]);
  const disk = path.join(w.dir, "disk-package.json");
  const agent = path.join(w.dir, "newer-agent.mjs");
  fs.writeFileSync(
    agent,
    `import fs from "node:fs";
const config = JSON.parse(fs.readFileSync("strom.json", "utf8"));
fs.writeFileSync("strom.json", JSON.stringify({ ...config, schema: ${SCHEMA_VERSION + 1}, migratedWith: "99.0.0" }, null, 2) + "\\n");
${onDisk ? `fs.writeFileSync(${JSON.stringify(disk)}, JSON.stringify({ version: "99.0.0" }));` : ""}
`,
  );
  Object.assign(w.env, { STROM_RUNNER_SCRIPT: agent, STROM_LIVE_DISK_VERSION: disk });
  return { w, disk };
}

test("strom run: updated during its session to a strom that brought the research to its schema — the run ended, start it again; no beta, no backup", opts, async () => {
  const { w, disk } = await research(true);
  try {
    // the person's terminal: in the research's language
    const r = await w.run(["run", "--agent", "script", "--max", "1"]);
    assert.equal(r.code, 1, r.out + r.err);
    assert.match(r.out, /▶ N0001/, "the session ran");
    assert.match(r.err, /strom byl během běhu aktualizovaný na 99\.0\.0 a výzkum je už v jeho formátu\. Běh skončil; další spuštění poběží na nové verzi/);
    // the export the new strom could not write here (the sources stand for it): the next start writes it, said so
    assert.match(r.err, /a udělá i export\./);
    assert.match(r.err, /→ Spustit běh znovu: strom run --max 1 --agent script\n/);
    assert.doesNotMatch(r.err, /betě|Záloha|strom update/);
    // an agent, a program: the English and the code, the run to start again
    spawnSync("git", ["checkout", "-q", "--", "strom.json"], { cwd: w.cwd });
    fs.rmSync(disk);
    const j = await w.run(["run", "--agent", "script", "--json"]);
    assert.equal(j.code, 1);
    assert.equal(j.json.code, "tree.updated.run.later");
    assert.match(j.json.message, /^strom was updated to 99\.0\.0 during this run and the research is already in its format: the run ended; the next start runs on the new version/);
    assert.equal(j.json.hint, "start the run again: strom run --agent script");
    assert.equal(j.json.details.exported, false);
    assert.doesNotMatch(JSON.stringify(j.json), /channel beta|backup/);
    // any other command of an older process: the same, without the run
    const s = await w.run(["status", "--json"]);
    assert.equal(s.json.code, "tree.updated");
    assert.match(s.json.hint, /^run the same strom command again: it runs on strom 99\.0\.0$/);
  } finally {
    w.cleanup();
  }
});

test("strom run: a research a newer strom wrote, with no newer strom on disk — refused as before (strom update)", opts, async () => {
  const { w, disk } = await research(false);
  try {
    const r = await w.run(["run", "--agent", "script", "--max", "1"]);
    assert.equal(r.code, 1, r.out + r.err);
    assert.match(r.err, /Tento rodokmen zapsal strom 99\.0\.0, novější než tento strom .*nechává beze změny/);
    assert.match(r.err, /→ Aktualizovat strom: strom update/);
    assert.doesNotMatch(r.err, /během běhu/);
    const j = await w.run(["status", "--json"]);
    assert.equal(j.json.code, "tree.newer");
    // an older strom on disk than the one that wrote it: no help in it — refused as before too
    fs.writeFileSync(disk, JSON.stringify({ version: "98.0.0" }));
    assert.equal((await w.run(["status", "--json"])).json.code, "tree.newer");
  } finally {
    w.cleanup();
  }
});
