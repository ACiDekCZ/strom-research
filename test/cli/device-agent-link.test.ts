// The agent started from a device (spec 094 K3.15), by the hidden command the gateway runs (strom link device) and in
// the terminal it opens (strom link open with STROM_DEVICE_YES): a terminal that cannot be opened is 503
// agent.noterminal, nothing started and the yes kept until it ends; a research waiting for its agent only said; the
// device's yes taken once by the terminal instead of its question — one line naming the device (NFD in, NFC out), the
// session carrying the device; a yes not valid: asked as ever. Made-up names only (Lhoták, Lhota).

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { World, hasGit } from "../helpers.ts";
import { Tree } from "../../src/core/tree.ts";
import type { Session } from "../../src/core/model.ts";

const opts = { skip: !hasGit, timeout: 240_000 };
const posix = { ...opts, skip: !hasGit || process.platform === "win32" };
const ID = "dv_abcdefghijklmnop";
const DEVICE = { STROM_FROM_DEVICE: ID, STROM_FROM_DEVICE_NAME: "Telefon Lhotáků".normalize("NFD") };
// the terminal's script written as it would be, nothing opened (an isolated strom alone)
const SCRIPT = { STROM_ISOLATED: "1", STROM_TERMINAL_TEST: "script" };

async function world() {
  const w = new World();
  await w.withTree("Lhotákovi");
  await w.ok(["lang", "cs"]);
  const id = Tree.open(w.cwd, w.env).config.id;
  await w.ok(["person", "add", "Vojtěch /Lhoták/", "--sex", "M", "--born", "1822"]);
  await w.ok(["task", "add", "Porovnat čtení křtu".normalize("NFD"), "--level", "verify", "--where", "matrika Lhota", "--why", "dvě čtení", "--done-when", "rozdíly rozhodnuté", "--about", "P1"]); // T1
  const root = w.cwd;
  const scripts = () => {
    const dir = path.join(root, ".strom", "open");
    return fs.existsSync(dir) ? fs.readdirSync(dir).map((f) => fs.readFileSync(path.join(dir, f), "utf8")) : [];
  };
  const clear = () => fs.rmSync(path.join(root, ".strom", "open"), { recursive: true, force: true });
  const device = async (link: string, yes?: string, env: Record<string, string> = {}) => {
    const r = await w.run(["link", "device", `--link=${link}`, ...(yes ? [`--yes=${yes}`] : []), "--json"], { env: { ...DEVICE, ...env } });
    assert.equal(r.code, 0, r.out + r.err);
    return r.json as { status: number; answer: Record<string, any> };
  };
  return { w, id, root, scripts, clear, device };
}

test("link device: the terminal not opened — 503 agent.noterminal, nothing started, the yes kept; a research waiting for its agent only said", posix, async () => {
  const { w, id, scripts, device } = await world();
  try {
    const link = `strom-research://chat?tree=${id}&person=P0001`;
    // a research waiting for its agent (no agent on this computer: only git and the system's own programs — strom runs
    // in this process; before any command of the person's terminal, whose PATH strom remembers), said, refused, nothing opened
    const waiting = await device(link, undefined, { ...SCRIPT, PATH: ["/usr/bin", "/bin"].join(path.delimiter) });
    assert.deepEqual([waiting.status, waiting.answer.state, waiting.answer.refused], [200, "said", "waiting"], JSON.stringify(waiting));
    assert.ok(waiting.answer.text.length > 0);
    assert.deepEqual(scripts(), []);
    const asked = await device(link);
    assert.equal(asked.status, 200);
    assert.equal(asked.answer.state, "ask", JSON.stringify(asked));
    assert.match(asked.answer.ask.what, /rozhovor s agentem \(Claude Code\) o osobě Vojtěch Lhoták/u);
    assert.equal(asked.answer.ask.tree, "Lhotákovi");
    // the yes sent, no terminal here (STROM_NO_OPEN): refused with a sentence, nothing opened — sent again, the same
    for (let i = 0; i < 2; i++) {
      const none = await device(link, asked.answer.yes);
      assert.deepEqual([none.status, none.answer.code], [503, "agent.noterminal"], JSON.stringify(none));
      assert.equal(none.answer.text, "Na počítači nejde otevřít terminál. Spustit na počítači.");
    }
    assert.deepEqual(scripts(), []);
    // run.confirm no: started at once — no terminal, 503 too
    await w.ok(["config", "set", "run.confirm", "no"], { tty: true, answers: ["a"] });
    const unasked = await device(link);
    assert.deepEqual([unasked.status, unasked.answer.code], [503, "agent.noterminal"], JSON.stringify(unasked));
    await w.ok(["config", "unset", "run.confirm"]);
  } finally {
    w.cleanup();
  }
});

test("link open with the device's yes: taken once instead of the question, one line naming the device, the session carries it; a yes not valid asks", opts, async () => {
  const { w, id, root, scripts, clear, device } = await world();
  try {
    const link = `strom-research://task?tree=${id}&task=T0001&do=chat`;
    // T1 waits for the person: its conversation is the agent's
    await w.ok(["task", "wait", "T0001", "--on", "Odpověď farního úřadu Lhota.", "--kind", "letter", "--to", "Farní úřad Lhota"]);
    const asked = await device(link, undefined, SCRIPT);
    assert.equal(asked.answer.state, "ask", JSON.stringify(asked));
    assert.match(asked.answer.ask.what.normalize("NFC"), /Porovnat čtení křtu/u);
    const yes = asked.answer.yes as string;
    const started = await device(link, yes, SCRIPT);
    assert.deepEqual(started, { status: 200, answer: { state: "started" } });
    const [script] = scripts();
    assert.ok(script, "the terminal's script");
    assert.match(script!, new RegExp(`STROM_DEVICE_YES='${yes}'`, "u"));
    assert.match(script!, new RegExp(`STROM_FROM_DEVICE='${ID}'`, "u"));
    assert.match(script!, /'link' 'open' 'strom-research:\/\/task\?/u);
    assert.doesNotMatch(script!, /STROM_FOR_APP|STROM_VIA_DEVICE/u);
    clear();

    // the terminal: the yes taken — no question, the line naming the device (its name as one line, NFC)
    const env = { ...DEVICE, STROM_DEVICE_YES: yes };
    const open = await w.run(["link", "open", link], { tty: true, answers: [], env });
    assert.match(open.out, /▶ Spuštěno ze zařízení Telefon Lhotáků \(výzkum Lhotákovi\): rozhovor s agentem \(Claude Code\)/u, open.out);
    assert.doesNotMatch(open.out, /Pokračovat\?/u);
    assert.ok(!fs.existsSync(path.join(root, ".strom", "device-yes", `${yes}.json`)), "taken");
    // the same yes again: taken already — asked as ever (Enter: no)
    const again = await w.run(["link", "open", link], { tty: true, answers: [""], env });
    assert.match(again.out, /Pokračovat\? \(a\/n, Enter = a\)|Pokračovat\? \(a\/n, Enter = n\)/u, again.out);
    assert.doesNotMatch(again.out, /Spuštěno ze zařízení/u);
    // a token of no yes: asked too
    const bad = await w.run(["link", "open", link], { tty: true, answers: [""], env: { ...DEVICE, STROM_DEVICE_YES: "AAAAAAAAAAAAAAAAAAAAAA" } });
    assert.match(bad.out, /Pokračovat\?/u);

    // the session a terminal of the device starts: who started it
    await w.ok(["task", "add", "Zápis v Lhotě", "--level", "locate", "--where", "matrika Lhota", "--why", "a", "--done-when", "b", "--about", "P1"]); // T2
    await w.ok(["session", "start", "T2"], { env: DEVICE });
    const s = Tree.open(root, w.env).list<Session>("session").find((x) => x.state === "open");
    assert.deepEqual(s?.device, { id: ID, name: "Telefon Lhotáků" });
    await w.ok(["session", "close", "--continue", "--summary", "nic", "--next", "dál"]);
    // …never by an id of no device
    await w.ok(["session", "start", "T2"], { env: { STROM_FROM_DEVICE: "dev-A" } });
    assert.equal(Tree.open(root, w.env).list<Session>("session").find((x) => x.state === "open")?.device, undefined);
    await w.ok(["session", "close", "--continue", "--summary", "nic", "--next", "dál"]);
  } finally {
    w.cleanup();
  }
});
