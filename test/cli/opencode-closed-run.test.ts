import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { World, hasGit } from "../helpers.ts";

test("OpenCode: a closed session followed by exit 1 does not stop the next task", { skip: !hasGit, timeout: 120000 }, async (t) => {
  const w = new World(); t.after(() => w.cleanup());
  await w.withTree();
  await w.ok(["research", "new", "Synthetic loop regression", "--new-person", "Test /Person/", "--direction", "question", "--question", "Protocol only, no web or real research"]);
  for (const name of ["First synthetic task", "Second synthetic task"]) await w.ok(["task", "add", name, "--level", "enrich", "--where", "Synthetic data", "--why", "Loop regression", "--done-when", "Diary saved and session closed", "--priority", "5", "--research", "G0001"]);
  const bin = path.join(w.dir, "fake-opencode"); fs.mkdirSync(bin);
  const cli = path.resolve(import.meta.dirname, "../../src/cli.ts");
  const callsFile = path.join(w.dir, "calls.json"); fs.writeFileSync(callsFile, "[]");
  fs.writeFileSync(path.join(bin, "agent.mjs"), `import fs from "node:fs";import {spawnSync} from "node:child_process";
process.stdin.resume();process.stdin.on("end",()=>{
 const calls=JSON.parse(fs.readFileSync(process.env.TEST_CALLS,"utf8"));calls.push(process.env.STROM_SESSION);fs.writeFileSync(process.env.TEST_CALLS,JSON.stringify(calls));
 const emit=(type,part)=>console.log(JSON.stringify({type,sessionID:"ses_"+process.env.STROM_SESSION,part}));
 const strom=args=>{const r=spawnSync(process.execPath,[process.env.TEST_CLI,...args],{cwd:process.cwd(),env:process.env,encoding:"utf8",windowsHide:true});if(r.status!==0)throw new Error(r.stdout+r.stderr);};
 emit("step_start",{});strom(["session","note","Synthetic checkpoint saved"]);strom(["session","close","--done","Synthetic task completed","--next","Next synthetic task"]);
 emit("text",{text:"Task closed"});emit("step_finish",{reason:"stop",tokens:{input:1,output:1}});process.exitCode=calls.length===1?1:0;
});`);
  fs.writeFileSync(path.join(bin, "opencode.cmd"), '@echo off\r\n"%FAKE_NODE%" "%~dp0agent.mjs" %*\r\n');
  fs.writeFileSync(path.join(bin, "opencode"), '#!/bin/sh\nexec "$FAKE_NODE" "$(dirname "$0")/agent.mjs" "$@"\n', { mode: 0o755 });
  Object.assign(w.env, { PATH: bin + path.delimiter + w.env.PATH, FAKE_NODE: process.execPath, TEST_CLI: cli, TEST_CALLS: callsFile });
  const result = await w.ok(["run", "--agent", "opencode", "--loop", "--max", "2", "--minutes", "5", "--json"]);
  assert.deepEqual(JSON.parse(fs.readFileSync(callsFile, "utf8")), ["N0001", "N0002"]);
  assert.deepEqual(result.json.sessions.map((s: { outcome: string }) => s.outcome), ["ok", "ok"]);
  for (const [id, task] of [["N0001", "T0001"], ["N0002", "T0002"]]) {
    const session = (await w.ok(["session", "show", id!, "--json"])).json.session;
    assert.equal(session.state, "closed"); assert.equal(session.summary, "Synthetic task completed"); assert.equal(session.notes[0].text, "Synthetic checkpoint saved");
    assert.equal((await w.ok(["task", "show", task!, "--json"])).json.task.state, "done");
  }
  const exit = JSON.parse(fs.readFileSync(path.join(w.cwd, ".strom/runs/N0001.log.exit.jsonl"), "utf8"));
  assert.equal(exit.code, 1);
  await w.ok(["check"]); await w.ok(["verify"]);
});
