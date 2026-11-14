// K031: an agent's sandbox (Codex on Windows) ran strom with another home, or kept it from the user's settings and the
// research's .git — strom took the history's switch the user had on for off, and told the agent "the history is off,
// the user alone turns it on". Under an agent that cannot read the user's settings or write the research the sandbox
// is said (fs.sandboxed, with the session's mark a run counts); with no agent, or the tree's own off, the switch as before.

import { test, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { World, hasGit } from "../helpers.ts";
import { testHooks } from "../../src/core/net.ts";
import { SANDBOX_REFUSAL } from "../../src/core/writable.ts";

const opts = { skip: !hasGit, timeout: 120_000 };
const chmodDenies = process.platform !== "win32" && process.getuid?.() !== 0;

testHooks.sleep = async () => {};
after(() => {
  delete testHooks.sleep;
});

const PAGE = `<!doctype html><html lang="cs"><head><meta charset="utf-8"><title>Dějiny Lhoty</title></head><body>
<p>V roce 1866 zasáhla Lhotu epidemie cholery&nbsp;– zemřelo 42 obyvatel.</p>
</body></html>`;

const TEXTS = ["--text-cs", "Událost", "--text-en", "An event", "--text-de", "Ein Ereignis"];
const NAMES = (cs: string, en: string, de: string) => ["--name-cs", cs, "--name-en", en, "--name-de", de];

test("history add under an agent that cannot read the user's settings or write the research: the sandbox said, never the switch off (K031)", opts, async () => {
  const s = http.createServer((req, res) => {
    if (req.url === "/robots.txt") return res.writeHead(200, { "content-type": "text/plain" }).end("User-agent: *\n");
    if (req.url === "/lhota") return res.writeHead(200, { "content-type": "text/html; charset=utf-8" }).end(PAGE);
    return res.writeHead(404).end();
  });
  await new Promise<void>((r) => s.listen(0, "127.0.0.1", r));
  s.unref();
  const base = `http://127.0.0.1:${(s.address() as AddressInfo).port}`;
  const w = new World();
  const git = () => path.join(w.treeDir("Lhotákovi"), ".git");
  try {
    await w.withTree("Lhotákovi");
    const root = w.treeDir("Lhotákovi");
    await w.ok(["person", "add", "Jan /Lhoták/", "--sex", "M"]);
    await w.ok(["event", "add", "P0001", "BIRT", "--date", "1850", "--place", "Lhota"]);
    await w.ok(["config", "set", "experiments.history", "on"], { tty: true, answers: ["a"] });
    await w.ok(["history", "region", "cz-bohemia", ...NAMES("Čechy", "Bohemia", "Böhmen")]);
    await w.ok(["history", "map", "Lhota", "--region", "cz-bohemia"]);
    const add = (env: Record<string, string>, quote = "V roce 1866 zasáhla Lhotu epidemie cholery – zemřelo 42 obyvatel.") =>
      w.run(["history", "add", "--region", "cz-bohemia", "--from", "1866", "--kind", "epidemic", ...TEXTS, "--url", `${base}/lhota`, "--quote", quote, "--json"], { env, cwd: root });
    const AGENT = { STROM_IN_AGENT: "codex", STROM_SESSION: "N0007" };
    // the sandbox's view: another home, strom's settings not where the user keeps them
    const elsewhere = path.join(w.dir, "sandbox home");
    fs.mkdirSync(elsewhere, { recursive: true });
    const OTHER = { HOME: elsewhere, USERPROFILE: elsewhere, STROM_CONFIG_DIR: path.join(elsewhere, "config") };
    const events = () => fs.readFileSync(path.join(w.home, "shared", "history", "regions", "cz-bohemia.json"), "utf8");
    const before = events();

    // under the agent: the sandbox, with the session's mark and the sandbox's hint — never the switch
    if (chmodDenies) fs.chmodSync(git(), 0o555);
    let sandboxed;
    try {
      sandboxed = await add({ ...AGENT, ...OTHER });
    } finally {
      if (chmodDenies) fs.chmodSync(git(), 0o755);
    }
    assert.notEqual(sandboxed.code, 0);
    assert.equal(sandboxed.json?.code, "fs.sandboxed", sandboxed.out + sandboxed.err);
    const said: string = sandboxed.json.message;
    assert.ok(said.includes(SANDBOX_REFUSAL), said);
    assert.ok(said.includes("(strom session N0007)"), said);
    assert.ok(said.includes(path.join(elsewhere, "config", "config.json")), "the settings not found named");
    if (chmodDenies) assert.ok(said.includes(git()), "the .git refused named");
    assert.match(sandboxed.json.hint, /sandbox/u);
    assert.doesNotMatch(sandboxed.out + sandboxed.err, /history.off|is off for this research|the user alone turns it on/u);
    assert.equal(events(), before, "nothing written");

    // the same view with no agent: the switch off, as before
    const person = await add(OTHER);
    assert.equal(person.json?.code, "history.off", person.out + person.err);

    // the tree's own off is the tree's: said as the switch under the agent too
    await w.ok(["config", "set", "experiments.history", "off", "--for-tree"], { cwd: root });
    const own = await add({ ...AGENT, ...OTHER });
    assert.equal(own.json?.code, "history.off", own.out + own.err);
    await w.ok(["config", "unset", "experiments.history", "--for-tree"], { cwd: root, tty: true, answers: ["a"] });

    // the user's settings not let to be read: the sandbox said, no crash of the system's refusal
    if (chmodDenies) {
      const file = path.join(w.env.STROM_CONFIG_DIR!, "config.json");
      fs.chmodSync(file, 0o000);
      try {
        // (Codex's elevated sandbox on Windows runs strom as another account, which may not read the user's profile)
        const unread = await add(AGENT);
        assert.equal(unread.json?.code, "fs.sandboxed", unread.out + unread.err);
        assert.ok(unread.json.message.includes(file) && unread.json.message.includes(SANDBOX_REFUSAL), unread.json.message);
        assert.match(unread.json.hint, /\.codex\/rules\/strom\.rules/u, "Codex's sandbox hint");
        assert.doesNotMatch(unread.out + unread.err, /history.off|is off for this research/u);
      } finally {
        fs.chmodSync(file, 0o644);
      }
    }

    // under the agent, everything readable and writable: as today
    const ok = await add(AGENT);
    assert.equal(ok.code, 0, ok.out + ok.err);
    assert.match(ok.out, /cz-bohemia-0001/u);
  } finally {
    s.close();
    w.cleanup();
  }
});
