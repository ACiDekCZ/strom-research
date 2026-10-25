// A family tree's folder brought from another computer (or strom's settings gone with their keys): its seal is
// another computer's. Read, never written, until the person takes it over here — every way says so in the research's
// language with the one step (a write, check, the orientation, the setup, the list, the bridge), the menu and a link
// offer it, and nothing is taken over by itself.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { World, hasGit, readJsonFile } from "../helpers.ts";
import { parseLink } from "../../src/core/links.ts";

const opts = { skip: !hasGit };

/** A Czech research with one person, its seal key then taken away: as a folder copied to another computer. */
async function foreign(): Promise<{ w: World; id: string; key: string }> {
  const w = new World();
  await w.withTree("Novákovi");
  await w.ok(["person", "add", "Jan /Novák/", "--sex", "M"]);
  const id = readJsonFile(path.join(w.cwd, "strom.json")).id as string;
  const key = path.join(w.env.STROM_CONFIG_DIR!, "keys", `${id}.key`);
  assert.ok(fs.existsSync(key), key);
  fs.rmSync(key);
  return { w, id, key };
}

test("sealed elsewhere: a write, check, the orientation, the list and the setup say so in the research's language with the step", opts, async () => {
  const { w, key } = await foreign();
  // a person writing: one sentence of their language and the way on, never "consent required" in English
  const write = await w.run(["person", "add", "Marie /Nováková/", "--sex", "F"], { tty: true });
  assert.equal(write.code, 4, write.err);
  assert.match(write.err, /^chyba: výzkum „Novákovi“ je zapečetěný na jiném počítači \(nebo tu chybí nastavení stromu\): číst jde, zapisovat až po převzetí na tomto počítači$/m, write.err);
  assert.match(write.err, /^→ převzít ve vlastním terminálu: strom seal adopt – nebo v nabídce \(strom\)$/m, write.err);
  assert.doesNotMatch(write.err, /consent required|sealed on another/, write.err);
  // a program: the code and what to ask for
  const json = await w.run(["person", "add", "Marie /Nováková/", "--json"]);
  assert.equal(json.code, 4);
  assert.equal(json.json.code, "seal.foreign");
  assert.equal(json.json.status, "needs-consent");
  assert.match(JSON.stringify(json.json), /strom seal adopt/);
  // check reads it to a person in their language, the same step
  const check = await w.run(["check"], { tty: true });
  assert.match(check.out, /foreign-seal +zapečetěno na jiném počítači \(nebo tu chybí nastavení stromu\): číst jde, zapisovat až po převzetí tady +→ převzít ve vlastním terminálu: strom seal adopt – nebo v nabídce \(strom\)/, check.out);
  // the orientation: the way on is taking it over
  const o = await w.ok(["--json"], { tty: true });
  assert.equal(o.json.next.command, "strom seal adopt");
  // an agent is never told to run it
  const agent = await w.ok(["--json"], { env: { CLAUDECODE: "1" } });
  assert.notEqual(agent.json.next.command, "strom seal adopt");
  assert.match(agent.json.next.why, /strom seal adopt/);
  // the list: which tree, where it is sealed
  const trees = await w.ok(["trees", "--json"]);
  assert.equal(trees.json.trees[0].seal, "elsewhere");
  assert.match((await w.ok(["trees"])).out, /zapečetěno na jiném počítači/);
  // the setup run again finds it: said, how it is taken over — never "dál strom init"
  const setup = await w.ok(["setup", "--yes"]);
  assert.match(setup.out, /^rodokmeny tady:$/m, setup.out);
  assert.match(setup.out, /^ {2}Novákovi {2}\(.+\) {2}– zapečetěno na jiném počítači – převzít: strom seal adopt --tree "Novákovi"$/m, setup.out);
  assert.match(setup.out, /^dál +strom$/m, setup.out);
  assert.doesNotMatch(setup.out, /strom init/, setup.out);
  assert.ok(!fs.existsSync(key), "nothing taken over by itself");
  w.cleanup();
});

test("sealed elsewhere: a person in an English research reads the person's sentence, an agent its own English", opts, async () => {
  const w = new World();
  await w.withTree("Novaks");
  await w.ok(["lang", "en"]);
  await w.ok(["person", "add", "Jan /Novák/", "--sex", "M"]);
  const id = readJsonFile(path.join(w.cwd, "strom.json")).id as string;
  fs.rmSync(path.join(w.env.STROM_CONFIG_DIR!, "keys", `${id}.key`));
  // a person at a terminal: the sentence of the person and the way on with the menu, never what an agent is told
  const write = await w.run(["person", "add", "Eva /Nováková/", "--sex", "F"], { tty: true });
  assert.equal(write.code, 4, write.err);
  assert.match(write.err, /^error: "Novaks" was sealed on another computer \(or strom's settings are not on this one\): it can be read, written only once taken over on this computer$/m, write.err);
  assert.match(write.err, /^→ taken over in a terminal of its own: strom seal adopt — or in strom's menu \(strom\)$/m, write.err);
  assert.doesNotMatch(write.err, /consent required|ask the user/, write.err);
  // an agent: its own English, as ever
  const agent = await w.run(["person", "add", "Eva /Nováková/", "--sex", "F"], { env: { CLAUDECODE: "1" } });
  assert.equal(agent.code, 4, agent.err);
  assert.match(agent.err, /consent required/, agent.err);
  assert.doesNotMatch(agent.err, /or in strom's menu/, agent.err);
  // a program: the code
  const json = await w.run(["person", "add", "Eva /Nováková/", "--json"]);
  assert.equal(json.json.code, "seal.foreign");
  w.cleanup();
});

test("sealed elsewhere: the bridge refuses the app's writes with seal.foreign (409), says it in /status and the log", opts, async () => {
  const { w } = await foreign();
  const info = (await w.ok(["live", "start", "--json"])).json;
  try {
    const status = (await (await fetch(`${info.url}/status`)).json()) as { seal: string; features: string[]; tree: { state: string } };
    assert.equal(status.seal, "elsewhere");
    assert.ok(status.features.includes("seal.foreign"));
    const headers = { Origin: "https://beta.stromapp.info", "Content-Type": "text/plain; charset=utf-8" };
    const res = await fetch(`${info.url}/sync`, { method: "POST", body: "0 HEAD\n0 TRLR\n", headers });
    const got = (await res.json()) as { code: string; error: string; text: string; params: Record<string, string> };
    assert.equal(res.status, 409, JSON.stringify(got));
    assert.equal(got.code, "seal.foreign");
    assert.equal(got.params.set, "strom seal adopt");
    assert.match(got.error, /^výzkum „Novákovi“ je zapečetěný na jiném počítači: nic se nezapsalo – po převzetí na tomto počítači \(terminál: strom seal adopt, nebo nabídka strom\) poslat znovu$/, got.error);
    assert.match(got.text, /sealed on another computer/);
    // an original the same
    const media = await fetch(`${info.url}/media/${"a".repeat(64)}`, { method: "PUT", body: "x", headers });
    assert.equal(media.status, 409);
    assert.equal(((await media.json()) as { code: string }).code, "seal.foreign");
    let log = "";
    for (let i = 0; i < 50 && !/media\/\S+ → 409/.test(log); i++) {
      if (i) await new Promise((ok) => setTimeout(ok, 100));
      log = fs.readFileSync(path.join(w.cwd, ".strom", "live.log"), "utf8");
    }
    assert.match(log, /POST \/…\/sync → 409 · code seal\.foreign · .*sealed on another computer/, log);
  } finally {
    await w.ok(["live", "stop"]);
  }
  w.cleanup();
});

test("sealed elsewhere: the menu offers taking it over (the person's yes), a link opens the same in a terminal", opts, async () => {
  const { w, id, key } = await foreign();
  // the menu at a terminal: said, asked — Enter takes it over
  const menu = await w.run(["menu"], { tty: true, answers: ["", "0"] });
  assert.match(menu.out, /^Zapečetěno na jiném počítači: zapisovat tu jde až po převzetí \(strom seal adopt\)\.$/m, menu.out);
  assert.match(menu.out, /Převzít „Novákovi“ na tomto počítači\? Záznamy jsou zkontrolované a beze změn\./, menu.out);
  assert.match(menu.out, /„Novákovi“ je teď zapečetěný na tomto počítači – zapisovat jde tady/, menu.out);
  assert.ok(fs.existsSync(key), "taken over on the person's yes");
  await w.ok(["person", "add", "Marie /Nováková/", "--sex", "F"]);
  // its operation kept in the history
  assert.match(execFileSync("git", ["log", "--format=%s"], { cwd: w.cwd, encoding: "utf8" }), /^Seal: tree adopted on this computer$/m);

  // the link of the Strom app: strom-research://seal?tree=<id> — the same in the terminal it opens
  fs.rmSync(key);
  assert.deepEqual(parseLink(`strom-research://seal?tree=${id}`), { action: "seal", tree: id });
  const link = await w.run(["link", "open", `strom-research://seal?tree=${id}`], { tty: true, answers: ["", ""] });
  assert.match(link.out, /Převzít „Novákovi“ na tomto počítači\?/, link.out + link.err);
  assert.ok(fs.existsSync(key), "taken over through the link on the person's yes");
  // an agent never: refused before anything
  fs.rmSync(key);
  const agent = await w.run(["seal", "adopt"], { env: { CLAUDECODE: "1" } });
  assert.notEqual(agent.code, 0);
  assert.ok(!fs.existsSync(key));
  w.cleanup();
});

test("sealed elsewhere: a no in the menu takes nothing over, asked once while the menu is open", opts, async () => {
  const { w, key } = await foreign();
  const no = await w.run(["menu"], { tty: true, answers: ["n", "5", "0", "0"] });
  assert.equal((no.out.match(/Převzít „Novákovi“/g) ?? []).length, 1, no.out);
  assert.equal((no.out.match(/^Zapečetěno na jiném počítači/gm) ?? []).length, 2, "said each time the menu is shown");
  assert.ok(!fs.existsSync(key));
  w.cleanup();
});
