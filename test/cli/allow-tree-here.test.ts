// strom allow archive in the folder of a tree outside the folder of the trees (N-U4-1 of 062): the permission is this
// computer's, the agents' permissions of the tree here follow it as those of every tree listed — never only the others.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { World, hasGit, readJsonFile } from "../helpers.ts";
import { archivesFile } from "../../src/core/terms.ts";

const opts = { skip: !hasGit };

test("strom allow archive --way browser in a tree outside the trees' folder: that tree's agent permissions follow, the listed ones too, and the output says the permission is this computer's", opts, async () => {
  const w = new World();
  try {
    // Claude in Chrome in a browser profile of this computer: the agents' permissions name the browser's tools
    const home = w.env.HOME!;
    const browserDir =
      process.platform === "darwin"
        ? path.join(home, "Library", "Application Support", "Google", "Chrome")
        : process.platform === "win32"
          ? path.join(w.env.LOCALAPPDATA ?? path.join(home, "AppData", "Local"), "Google", "Chrome", "User Data")
          : path.join(w.env.XDG_CONFIG_HOME ?? path.join(home, ".config"), "google-chrome");
    fs.mkdirSync(path.join(browserDir, "Default", "Extensions", "fcoeoabgfenejglbffodgkkbkcdhcgfn"), { recursive: true });
    await w.withTree("Lhotákovi");
    const listed = w.cwd;
    const outside = path.join(w.env.HOME!, "Jinde", "Лготовi");
    await w.ok(["init", "Lhotovi", "--dir", outside]);
    // the tree here is not among those strom lists (a folder of its own, never remembered)
    const config = path.join(w.env.STROM_CONFIG_DIR!, "config.json");
    const c = readJsonFile(config) as { extraTrees?: string[]; currentTree?: string };
    c.extraTrees = (c.extraTrees ?? []).filter((t) => path.resolve(t) !== path.resolve(outside));
    c.currentTree = listed;
    fs.writeFileSync(config, JSON.stringify(c, null, 2));
    const names = ((await w.ok(["trees", "--json"])).json.trees as { name: string }[]).map((t) => t.name);
    assert.ok(!names.includes("Lhotovi"), `not listed: ${names.join(", ")}`);

    // each names a book of an archive only a person's browser goes to
    for (const cwd of [listed, outside]) await w.ok(["recordset", "add", "Kniha N 1847–1868", "--url", "https://www.mza.cz/actapublica/matrika/detail/5359"], { cwd });
    const settings = (root: string) => fs.readFileSync(path.join(root, ".claude", "settings.json"), "utf8");
    const before = { here: settings(outside), listed: settings(listed) };
    const granted = await w.ok(["allow", "archive", "mza.cz", "--way", "browser"], { tty: true, cwd: outside });
    assert.match(granted.out, /the agents' permissions updated in Lhotovi, Lhotákovi — the permission is this computer's, for every research here/);
    assert.notEqual(settings(outside), before.here, "the tree here follows the permission");
    assert.notEqual(settings(listed), before.listed, "the tree listed too");
    // the site given (mza.cz): the books' own host (www.mza.cz) with it, one archive, one decision
    const kept = readJsonFile(archivesFile(w.env)) as { archives: Record<string, { way?: string }> };
    assert.equal(kept.archives["mza.cz"]?.way, "browser");
    assert.equal(kept.archives["www.mza.cz"]?.way, "browser");
    assert.match(settings(outside), /ClaudeInChromeDomain\(www\.mza\.cz\)/);
  } finally {
    w.cleanup();
  }
});
