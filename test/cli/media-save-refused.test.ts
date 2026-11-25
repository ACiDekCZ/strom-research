// An image the agent's own browser was to save (strom media save) whose page the hook refused — the site's pages used
// up — never comes: found in a live run, the task stayed waiting for ever after its session (no file wakes it), and the
// next look said it was held back by the browser, asking the person to allow downloads of a page that never opened.
// So a session closing — its agent's close or an interruption — puts such a task back in the queue with the image left,
// and such a save is never said held back. A save on its way (its file being written) or held back by the browser
// (the person's) keeps its wait. No request leaves this computer.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { World, hasGit, readJsonFile } from "../helpers.ts";
import { grantWay } from "../../src/core/terms.ts";
import { Tree } from "../../src/core/tree.ts";
import { closeSession } from "../../src/core/session.ts";
import { waitFileBase } from "../../src/core/browser.ts";
import type { Session, Task } from "../../src/core/model.ts";

const opts = { skip: !hasGit };
const CLAUDE = { CLAUDECODE: "1" };
const LHOTA = { host: "www.archiv-lhota.example", page: (book: number, n: number) => `https://www.archiv-lhota.example/kniha/${book}?snimek=${n}` };

async function setup(w: World) {
  await w.withTree("Lhotákovi");
  const file = path.join(w.dir, "archives-test.json");
  fs.writeFileSync(file, JSON.stringify({ archives: [{ host: LHOTA.host, name: "Archiv Lhota", level: "restricted", browserOnly: true, checked: "2026-11-01" }] }));
  w.env.STROM_ARCHIVES_FILE = file;
  assert.ok(grantWay(w.env, [LHOTA.host], "browser", { by: "terminal" }));
  await w.ok(["research", "new", "X", "--new-person", "Jan /Lhoták/"]);
  const downloads = path.join(w.dir, "Stažené soubory");
  fs.mkdirSync(downloads);
  await w.ok(["config", "set", "browser.downloads", downloads]);
  await w.ok(["recordset", "add", "Lhota N 1784–1820", "--url", LHOTA.page(11, 1)]); // B1
  await w.ok(["task", "add", "Křest Jana", "--level", "link", "--where", "B1", "--why", "a", "--done-when", "b"]); // T1
  const s = (await w.ok(["session", "start", "T1", "--json"])).json;
  const sid: string = s.session?.id ?? s.id;
  await w.ok(["media", "save", "T1", "--image", "3", "--at", LHOTA.page(11, 3)], { env: CLAUDE });
  // the script given a minute ago; the browser's navigate to its page refused by the hook since (the site's pages used up)
  const records = path.join(w.cwd, ".strom", "browser-saves.json");
  const saves = readJsonFile(records) as unknown as { at: number }[];
  fs.writeFileSync(records, JSON.stringify(saves.map((r) => ({ ...r, at: r.at - 60_000 }))));
  const journal = path.join(w.cwd, ".strom", "metrics", "fetch.jsonl");
  fs.mkdirSync(path.dirname(journal), { recursive: true });
  const refused = { at: new Date(Date.now() - 30_000).toISOString(), by: sid, via: "web", host: LHOTA.host, domain: "archiv-lhota.example", session: sid, tool: "mcp__claude-in-chrome__navigate", from: "hook", toolUse: "u1", decision: "deny", why: "many", n: 30 };
  fs.appendFileSync(journal, JSON.stringify(refused) + "\n");
  return { sid, downloads, records };
}

const task = async (w: World) => (await w.ok(["task", "show", "T1", "--json"])).json.task as Task;

test("a save whose page was refused: never said held back; the session closed by its agent puts the task back in the queue with the image left", opts, async () => {
  const w = new World();
  try {
    const { records } = await setup(w);
    assert.equal((await task(w)).state, "waiting");
    const look = await w.ok(["media", "add", "--inbox", "--waiting"]);
    assert.doesNotMatch(look.out, /held back|zadržel|download several files/u, look.out);
    assert.ok(!(readJsonFile(records) as unknown as { held?: boolean }[]).some((r) => r.held), "no save marked held");
    assert.doesNotMatch((await task(w)).waitingOn ?? "", /zadržel|allow|povolit/u);
    await w.ok(["session", "close", "--summary", "nic", "--next", "snímek 3 B0001"]);
    const t = await task(w);
    assert.equal(t.state, "open");
    assert.equal(t.awaits, undefined);
    assert.equal(t.waitingOn, undefined);
    assert.match(t.notes.at(-1)!.text, /image 3 of B0001 still to be saved through the browser \(strom media save\) — nothing came/u);
    assert.equal((await w.ok(["task", "next", "--json"])).json.task.id, "T0001", "back in the queue");
  } finally {
    w.cleanup();
  }
});

test("the same, the session interrupted (the user stopped the run): back in the queue; a file on its way keeps the wait", opts, async () => {
  const w = new World();
  try {
    const { sid, downloads } = await setup(w);
    // its file being written in the downloads folder: the wait stays
    const tree = Tree.open(w.cwd, w.env);
    const id = (JSON.parse(fs.readFileSync(path.join(w.cwd, "strom.json"), "utf8")) as { id: string }).id;
    const part = path.join(downloads, `${waitFileBase(id, "T0001", 3)}.jpg.crdownload`);
    fs.writeFileSync(part, "x");
    closeSession(tree, tree.get<Session>(sid)!, { summary: "", next: "", interrupted: true });
    assert.equal(tree.get<Task>("T0001")!.state, "waiting", "on its way: still waits");
    // nothing on its way: the next session interrupted puts it back
    fs.rmSync(part);
    await w.ok(["task", "wake", "T1"]);
    const s2 = (await w.ok(["session", "start", "T1", "--json"])).json;
    await w.ok(["media", "save", "T1", "--image", "3", "--at", LHOTA.page(11, 3)], { env: CLAUDE });
    const tree2 = Tree.open(w.cwd, w.env);
    closeSession(tree2, tree2.get<Session>(s2.session?.id ?? s2.id)!, { summary: "", next: "", interrupted: true });
    const t = tree2.get<Task>("T0001")!;
    assert.equal(t.state, "open");
    assert.match(t.notes.at(-1)!.text, /^interrupted in N0002: image 3 of B0001 still to be saved through the browser/u);
  } finally {
    w.cleanup();
  }
});
