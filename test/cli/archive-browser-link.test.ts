// The Strom app's "Permission…" at an item that waits for images of an archive only a person's browser goes to, which
// no downloader here reaches (strom's list of archives knows it): the link opens the person's question about the
// archive — "through the browser" or by hand — and the person's answer brings the task back, as strom allow does.

import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { World, hasGit, readJsonFile } from "../helpers.ts";
import { Tree } from "../../src/core/tree.ts";

const opts = { skip: !hasGit };
const store = (w: World) => readJsonFile(path.join(w.env.STROM_CONFIG_DIR!, "archives.json"));
// a book of an archive strom's list keeps for a person's browser only (made up)
const BOOK = "https://genbaza.pl/skan/4711";

test("the app's Permission… for a browser-only archive with no downloader: the person's question, decided here", opts, async () => {
  const w = new World();
  await w.withTree("Lhotákovi");
  try {
    await w.ok(["research", "new", "X", "--new-person", "Jan /Lhoták/"]);
    await w.ok(["recordset", "add", "Lhota N 1850–1870", "--url", BOOK]); // B1
    await w.ok(["task", "add", "Křest Jana", "--level", "link", "--where", "B1", "--why", "a", "--done-when", "b"]); // T1
    await w.ok(["task", "wait", "T1", "--images", "B1:9-10", "--on", "snímky 9–10 knihy Lhota"]);
    const id = Tree.open(w.cwd, w.env).config.id;
    // 0: nothing changes
    const back = await w.run(["link", "open", `strom-research://archive?tree=${id}&host=genbaza.pl`], { tty: true, answers: ["0", ""] });
    assert.doesNotMatch(back.out, /není co rozhodnout/, back.out);
    assert.match(back.out, /jak získávat snímky\?/);
    assert.equal(store(w).archives?.["genbaza.pl"]?.way, undefined);
    assert.equal((await w.ok(["task", "show", "T1", "--json"])).json.task.state, "waiting");
    // the app's host as the book's address names it (www. too): through the browser — the person's permission, the task back
    const yes = await w.run(["link", "open", `strom-research://archive?tree=${id}&host=www.genbaza.pl`], { tty: true, answers: ["1", "", ""] });
    assert.match(yes.out, /přes prohlížeč/, yes.out);
    assert.equal(store(w).archives?.["www.genbaza.pl"]?.way, "browser", JSON.stringify(store(w)));
    assert.notEqual((await w.ok(["task", "show", "T1", "--json"])).json.task.state, "waiting");
  } finally {
    w.cleanup();
  }
});
