// A model the Codex CLI installed here does not have (an older Codex: HTTP 400 "model_not_found", "Model metadata for
// … not found"): a reader of it ends as a reader that failed with that reason, said for the person in the reading's
// language (else the research's) — update Codex or choose another model —, and strom run stops with the same advice; never only "error".
// Codex's kept catalog (models_cache.json) fetched by a newer Codex than the one installed here: its models offered
// with a note. ~/.codex only read.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { agentStandIn, hasGit } from "../helpers.ts";
import { encodeImage } from "../../src/image/index.ts";
import { looksLikeModelRejected } from "../../src/runners/runner.ts";
import { codexCatalogNewer, installedCodexVersion, newerVersion } from "../../src/agents/models.ts";
import { readChoices } from "../../src/core/readchoice.ts";
import { Tree } from "../../src/core/tree.ts";
import { Settings } from "../../src/core/config.ts";
import { world } from "./session.helpers.ts";

const opts = { skip: !hasGit || process.platform === "win32" };

const SAID = "unexpected status 400 Bad Request: {\"detail\":\"The 'gpt-lhota-2' model is not supported when using Codex with a ChatGPT account.\"}";
const EVENTS = [
  { type: "thread.started", thread_id: "t" },
  { type: "error", message: SAID },
  { type: "turn.failed", error: { message: SAID } },
];

/** A stand-in Codex that refuses its model, first on PATH (never the real one of this computer). */
function refusingCodex(dir: string): Record<string, string> {
  const stream = path.join(dir, "codex.jsonl");
  fs.writeFileSync(stream, EVENTS.map((e) => JSON.stringify(e)).join("\n") + "\n");
  const env = agentStandIn(dir, "codex");
  return { PATH: env.PATH!, FAKE_STREAM: stream, FAKE_NODE: process.execPath, CODEX_HOME: path.join(dir, "codex home") };
}

test("what Codex says of a model its CLI does not have is a model refused", () => {
  for (const said of [SAID, "Model metadata for gpt-lhota-2 not found", 'Error: {"error":{"code":"model_not_found"}}']) assert.ok(looksLikeModelRejected(said), said);
});

test("a reader of Codex whose model its CLI does not have: the reading fails with that reason, said in the research's language", opts, async () => {
  const w = await world();
  try {
    Object.assign(w.env, refusingCodex(w.dir));
    const scan = path.join(w.dir, "sken ř.jpg");
    fs.writeFileSync(scan, encodeImage({ width: 1708, height: 1331, channels: 3, data: new Uint8Array(1708 * 1331 * 3).fill(190) }, "jpeg"));
    const r = await w.run(["document", "read", scan, "--agent", "codex", "--model", "gpt-lhota-2", "--json"]);
    assert.equal(r.json.state, "failed", r.out);
    assert.match(r.json.error, /the model gpt-lhota-2 is not available in the Codex CLI installed here — update Codex \(npm install -g @openai\/codex@latest\) or choose another model/);
    assert.equal(r.json.failure.code, "model");
    assert.deepEqual(r.json.failure.params, { agent: "codex", model: "gpt-lhota-2" });
    assert.equal(r.json.failure.text, "Model gpt-lhota-2 není v nainstalované verzi Codex CLI dostupný – aktualizovat Codex (npm install -g @openai/codex@latest), nebo zvolit jiný model.");
    // the reader that failed, said why where the readers' failures are said
    const state = JSON.parse(fs.readFileSync(path.join(w.cwd, ".strom", "reads", `${r.json.id}.json`), "utf8"));
    assert.equal(state.reports[0].rejected, "model");
    // which reader it was (read.readerState): the one; two readers both refused — none named
    assert.equal(r.json.failure.reader, 1);
    const two = await w.run(["document", "read", scan, "--agent", "codex", "--model", "gpt-lhota-2", "--readers", "2", "--json"]);
    assert.equal(two.json.state, "failed", two.out);
    assert.equal(two.json.failure.code, "model");
    assert.equal(two.json.failure.reader, undefined);
    assert.deepEqual(two.json.readers.who.map((x: { state?: string }) => x.state), ["failed", "failed"]);
    // read again by another reader that ends with nothing: failed for its own reason, nothing of the model kept
    const quiet = path.join(w.dir, "quiet.mjs");
    fs.writeFileSync(quiet, "process.exit(1);\n");
    w.env.STROM_RUNNER_SCRIPT = quiet;
    await w.run(["document", "again", r.json.id, "--agent", "script", "--json"]);
    const after = JSON.parse(fs.readFileSync(path.join(w.cwd, ".strom", "reads", `${r.json.id}.json`), "utf8"));
    assert.equal(after.state, "failed", JSON.stringify(after));
    assert.equal(after.failure, undefined);
    assert.doesNotMatch(after.error ?? "", /Codex/);
  } finally {
    w.cleanup();
  }
});

test("a reading asked in another language (the Strom app's, --into): its failure said in that language; one strom has no texts in: the research's", opts, async () => {
  const w = await world();
  try {
    Object.assign(w.env, refusingCodex(w.dir));
    const scan = path.join(w.dir, "sken ř.jpg");
    fs.writeFileSync(scan, encodeImage({ width: 1708, height: 1331, channels: 3, data: new Uint8Array(1708 * 1331 * 3).fill(190) }, "jpeg"));
    const de = await w.run(["document", "read", scan, "--agent", "codex", "--model", "gpt-lhota-2", "--into", "de", "--json"]);
    assert.equal(de.json.state, "failed", de.out);
    assert.equal(de.json.failure.code, "model");
    assert.equal(de.json.failure.text, "Das Modell gpt-lhota-2 ist in der installierten Codex-CLI nicht verfügbar – Codex aktualisieren (npm install -g @openai/codex@latest) oder ein anderes Modell wählen.");
    // as kept for the bridge's /status and GET /read/<id>
    const kept = JSON.parse(fs.readFileSync(path.join(w.cwd, ".strom", "reads", `${de.json.id}.json`), "utf8"));
    assert.equal(kept.failure.text, de.json.failure.text);
    const la = await w.run(["document", "read", scan, "--agent", "codex", "--model", "gpt-lhota-2", "--into", "la", "--json"]);
    assert.equal(la.json.failure.text, "Model gpt-lhota-2 není v nainstalované verzi Codex CLI dostupný – aktualizovat Codex (npm install -g @openai/codex@latest), nebo zvolit jiný model.");
  } finally {
    w.cleanup();
  }
});

test("strom run with Codex whose model its CLI does not have: stopped with the advice to update Codex or choose another model", opts, async () => {
  const w = await world();
  try {
    await w.ok(["task", "add", "Křest Jana", "--level", "link", "--where", "B1", "--why", "rodiče", "--done-when", "zápis", "--about", "P1"]);
    Object.assign(w.env, refusingCodex(w.dir));
    const r = await w.run(["run", "--agent", "codex", "--model", "gpt-lhota-2", "--json"]);
    assert.equal(r.code, 1, r.out);
    assert.equal(r.json.stop, "model");
    assert.match(r.json.stopped, /model gpt-lhota-2 není v nainstalované verzi Codex CLI dostupný – aktualizovat Codex \(npm install -g @openai\/codex@latest\), nebo zvolit jiný model: strom config set model\.lead <model>/);
    assert.equal(JSON.parse(fs.readFileSync(path.join(w.cwd, "data", "tasks", "T0001.json"), "utf8")).state, "open");
  } finally {
    w.cleanup();
  }
});

test("Codex's kept catalog from a newer Codex than the one installed here: its models offered with a note; ~/.codex only read", opts, async () => {
  const w = await world();
  try {
    // Codex installed by npm: its command a link to bin/codex.js of the package
    const pkg = path.join(w.dir, "npm ř", "lib", "node_modules", "@openai", "codex");
    fs.mkdirSync(path.join(pkg, "bin"), { recursive: true });
    fs.writeFileSync(path.join(pkg, "bin", "codex.js"), "#!/bin/sh\nexit 0\n", { mode: 0o755 });
    const bin = path.join(w.dir, "npm ř", "bin");
    fs.mkdirSync(bin);
    fs.symlinkSync(path.join(pkg, "bin", "codex.js"), path.join(bin, "codex"));
    const home = path.join(w.dir, "codex home");
    fs.mkdirSync(home);
    const env = { ...w.env, PATH: `${bin}${path.delimiter}/usr/bin${path.delimiter}/bin`, CODEX_HOME: home };
    const catalog = (version: string) =>
      fs.writeFileSync(path.join(home, "models_cache.json"), JSON.stringify({ client_version: version, models: [{ slug: "gpt-lhota-2", display_name: "GPT Lhota 2", visibility: "list", priority: 1 }] }));
    const codexOf = () => {
      const tree = Tree.open(w.cwd, env);
      return readChoices(tree, new Settings(env, {}), env, "claude").agents.find((a) => a.id === "codex")!;
    };
    // not from npm (no package.json): unknown — no note, never a guess
    catalog("0.170.0");
    assert.equal(installedCodexVersion(env), undefined);
    assert.equal(codexCatalogNewer(env), undefined);
    fs.writeFileSync(path.join(pkg, "package.json"), JSON.stringify({ name: "@openai/codex", version: "0.164.0" }));
    assert.equal(installedCodexVersion(env), "0.164.0");
    // the catalog of a newer Codex: noted, the model still offered
    const said = fs.readFileSync(path.join(home, "models_cache.json"));
    const newer = codexOf();
    assert.deepEqual(newer.catalogNewer, { catalog: "0.170.0", installed: "0.164.0" });
    assert.deepEqual(newer.models.find((m) => m.id === "gpt-lhota-2"), { id: "gpt-lhota-2", name: "GPT Lhota 2", unsure: true });
    assert.deepEqual(fs.readFileSync(path.join(home, "models_cache.json")), said, "nothing written to Codex's folder");
    assert.deepEqual(fs.readdirSync(home), ["models_cache.json"]);
    // of this Codex, or an older one (it fetched what it has): no note
    for (const v of ["0.164.0", "0.155.1", "0.164.0-alpha.3"]) {
      catalog(v);
      const c = codexOf();
      assert.equal(c.catalogNewer, undefined, v);
      assert.ok(c.models.every((m) => !m.unsure), v);
    }
  } finally {
    w.cleanup();
  }
});

test("versions compared by their numbers", () => {
  assert.ok(newerVersion("0.167.0", "0.164.0"));
  assert.ok(newerVersion("1.0.0", "0.999.9"));
  assert.ok(!newerVersion("0.164.0-alpha", "0.164.0"));
  assert.ok(!newerVersion("0.155.1", "0.164.0"));
  assert.ok(!newerVersion("nic", "0.164.0"));
});
