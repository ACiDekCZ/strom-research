// A task saving images once more (strom media save --again) never looks done while their new copies have not come
// (1126): the old copies registered are not what it waits for — its wait says them (awaits.again), the bridge's /status
// (core/waiting.ts waitingFor), What waits (inboxState) and the wake all count them missing until each new copy is
// taken. A paged save once more whose page was not opened yet is not said held back by the browser. Synthetic data
// only; no request leaves this computer.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { World, hasGit, readJsonFile } from "../helpers.ts";
import { SETTLE_MS, inboxState } from "../../src/core/inboxwait.ts";
import { waitFileBase } from "../../src/core/browser.ts";
import { waitingFor } from "../../src/core/waiting.ts";
import { Tree } from "../../src/core/tree.ts";
import type { Task } from "../../src/core/model.ts";

const opts = { skip: !hasGit };
const fixtures = path.join(import.meta.dirname, "..", "fixtures", "images");
// an archive strom's list keeps as only a person's browser's (as test/cli/media-save-pages.test.ts)
const PAGE = (n: number | string) => `https://genbaza.pl/skan/4711?n=${n}`;
const CLAUDE = { CLAUDECODE: "1" };
const NOW = { STROM_DOWNLOAD_WAIT_MS: "0" };
const SCANS: Record<number, string> = { 23: "s0001.jpg", 24: "s0002.jpg", 25: "s0003.jpg" };

test("media save --again: the task waits for the new copies (awaits.again) — /status, What waits and the wake count them missing until each is taken; a page not opened is not held back", opts, async () => {
  const w = new World();
  try {
    await w.withTree("Lhotákovi");
    await w.ok(["research", "new", "X", "--new-person", "Jan /Lhoták/"]);
    const downloads = path.join(w.dir, "Stažené soubory");
    fs.mkdirSync(downloads);
    await w.ok(["config", "set", "browser.downloads", downloads]);
    await w.ok(["recordset", "add", "Lhota N 1850–1870", "--url", PAGE(1)]); // B1
    await w.ok(["task", "add", "Křest Jana Prouzala", "--level", "link", "--where", "B1", "--why", "a", "--done-when", "b"]); // T1
    await w.ok(["allow", "archive", "genbaza.pl", "--way", "browser"], { tty: true });
    // images 23–25 registered already (weak scans)
    const shared = path.join(w.home, "shared");
    const first = path.join(shared, "inbox", "lhota-n");
    fs.mkdirSync(first, { recursive: true });
    for (const [n, f] of Object.entries(SCANS)) fs.copyFileSync(path.join(fixtures, f), path.join(first, `${n}.jpg`));
    await w.ok(["media", "add", "--inbox", "lhota-n", "--recordset", "B1"]);

    const task = async () => (await w.ok(["task", "show", "T1", "--json"])).json.task as Task;
    const states = () => {
      const tree = Tree.open(w.cwd, w.env);
      const t = tree.get<Task>("T0001")!;
      const st = inboxState(tree, shared, t);
      const item = waitingFor(tree, { shared, stories: false }).find((x) => x.task?.id === "T0001");
      const status = item?.item.inbox as { have: number; missing: number[] } | undefined;
      return { inbox: st && { have: st.have, missing: st.missing }, status: status && { have: status.have, missing: status.missing } };
    };

    // one image once more: the old copy registered is not what it waits for
    await w.ok(["media", "save", "T1", "--image", "23", "--at", PAGE(23), "--again"], { env: CLAUDE });
    let t = await task();
    assert.equal(t.state, "waiting");
    assert.equal(t.awaits?.images, "23");
    assert.equal(t.awaits?.again, "23");
    assert.deepEqual(states(), { inbox: { have: 0, missing: [23] }, status: { have: 0, missing: [23] } });

    // every image it needs in one call, once more: its wait holds them all
    await w.ok(["media", "save", "T1", "--image", "23-25", "--at", PAGE("{n}"), "--again"], { env: CLAUDE });
    t = await task();
    assert.equal(t.awaits?.images, "23–25");
    assert.equal(t.awaits?.again, "23–25");
    assert.deepEqual(states(), { inbox: { have: 0, missing: [23, 24, 25] }, status: { have: 0, missing: [23, 24, 25] } });

    // a minute on, no page opened yet: nothing held back by the browser (the old copies registered are no sign)
    const records = path.join(w.cwd, ".strom", "browser-saves.json");
    fs.writeFileSync(records, JSON.stringify((readJsonFile(records) as unknown as { at: number }[]).map((r) => ({ ...r, at: r.at - 60_000 }))));
    const look = await w.ok(["media", "add", "--inbox", "--waiting", "--json"], { env: NOW });
    assert.deepEqual(look.json.held, []);
    assert.deepEqual((look.json.waits as { task: string; missing: number[] }[]).find((x) => x.task === "T0001")?.missing, [23, 24, 25]);
    assert.equal((await task()).state, "waiting");

    // the new copy of 23 came (the same scan: nothing sharper to have — what it waited for all the same)
    const id = (readJsonFile(path.join(w.cwd, "strom.json")) as { id: string }).id;
    const came = (n: number) => {
      const f = path.join(downloads, `${waitFileBase(id, "T0001", n)}.jpg`);
      fs.copyFileSync(path.join(fixtures, SCANS[n]!), f);
      const at = new Date(Date.now() - 2 * SETTLE_MS);
      fs.utimesSync(f, at, at);
    };
    came(23);
    await w.ok(["media", "add", "--inbox", "--waiting"], { env: NOW });
    t = await task();
    assert.equal(t.state, "waiting", "never woken while a new copy is still to come");
    assert.equal(t.awaits?.again, "24–25");
    assert.deepEqual(states(), { inbox: { have: 1, missing: [24, 25] }, status: { have: 1, missing: [24, 25] } });

    // the rest came: back in the queue
    came(24);
    came(25);
    const all = await w.ok(["media", "add", "--inbox", "--waiting"], { env: NOW });
    assert.match(all.out, /back in the queue: T0001/, all.out);
    t = await task();
    assert.equal(t.state, "open");
    assert.equal(t.awaits, undefined);
  } finally {
    w.cleanup();
  }
});

test("strom task wait --images writes its wait afresh: nothing saved once more is carried over", opts, async () => {
  const w = new World();
  try {
    await w.withTree("Lhotákovi");
    await w.ok(["research", "new", "X", "--new-person", "Jan /Lhoták/"]);
    const downloads = path.join(w.dir, "Stažené soubory");
    fs.mkdirSync(downloads);
    await w.ok(["config", "set", "browser.downloads", downloads]);
    await w.ok(["recordset", "add", "Lhota N 1850–1870", "--url", PAGE(1)]); // B1
    await w.ok(["task", "add", "Křest Jana Prouzala", "--level", "link", "--where", "B1", "--why", "a", "--done-when", "b"]); // T1
    await w.ok(["allow", "archive", "genbaza.pl", "--way", "browser"], { tty: true });
    const dir = path.join(w.home, "shared", "inbox", "lhota-n");
    fs.mkdirSync(dir, { recursive: true });
    fs.copyFileSync(path.join(fixtures, "s0001.jpg"), path.join(dir, "23.jpg"));
    await w.ok(["media", "add", "--inbox", "lhota-n", "--recordset", "B1"]);
    await w.ok(["media", "save", "T1", "--image", "23", "--at", PAGE(23), "--again"], { env: CLAUDE });
    assert.equal((await w.ok(["task", "show", "T1", "--json"])).json.task.awaits.again, "23");
    await w.ok(["task", "wait", "T1", "--images", "B1:30-31", "--on", "snímky 30–31 knihy B0001"]);
    const t = (await w.ok(["task", "show", "T1", "--json"])).json.task as Task;
    assert.equal(t.awaits?.images, "30–31");
    assert.equal(t.awaits?.again, undefined);
  } finally {
    w.cleanup();
  }
});
