// The research without an agent has the name the Strom app gives it: "Archiv Stromu" (cs), "Strom archive" (en),
// "Strom-Archiv" (de) — in the setup's choice, in strom mode and in the menu of an archive, in each language.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { World, hasGit } from "../helpers.ts";

const opts = { skip: !hasGit || process.platform === "win32" };

/** An agent installed (a fake Claude Code), nothing else of the person's on PATH. */
function installAgent(w: World): void {
  const bin = path.join(w.dir, "bin");
  fs.mkdirSync(bin, { recursive: true });
  fs.writeFileSync(path.join(bin, "claude"), "#!/bin/sh\nexit 0\n", { mode: 0o755 });
  w.env.PATH = [bin, path.dirname(process.execPath), "/usr/bin", "/bin"].join(path.delimiter);
}

const NAMES = [
  {
    lang: "cs",
    choice: /^\s+2\s+Jen Archiv Stromu – ukládat data z aplikace Strom$/m,
    now: /^Výzkum je teď Archiv Stromu\. /m,
    is: /^Tento výzkum je Archiv Stromu: data přicházejí z aplikace Strom\./m,
    research: /Jen Archiv Stromu s daty z aplikace Strom: strom mode archive$/m,
    menu: /^Archiv Stromu: data přicházejí z aplikace Strom\.$/m,
  },
  {
    lang: "en",
    choice: /^\s+2\s+Only a Strom archive — keeping the data from the Strom app$/m,
    now: /^The research is a Strom archive now\. /m,
    is: /^This research is a Strom archive: the data come from the Strom app\./m,
    research: /Only a Strom archive of the data from the Strom app: strom mode archive$/m,
    menu: /^The Strom archive: the data come from the Strom app\.$/m,
  },
  {
    lang: "de",
    choice: /^\s+2\s+Nur ein Strom-Archiv – die Daten aus der Strom-App speichern$/m,
    now: /^Die Forschung ist jetzt ein Strom-Archiv\. /m,
    is: /^Diese Forschung ist ein Strom-Archiv: die Daten kommen aus der Strom-App\./m,
    research: /Nur ein Strom-Archiv der Daten aus der Strom-App: strom mode archive$/m,
    menu: /^Strom-Archiv: die Daten kommen aus der Strom-App\.$/m,
  },
] as const;

test("the research without an agent is named as in the Strom app: the setup's choice, strom mode and the archive's menu (cs, en, de)", opts, async () => {
  for (const n of NAMES) {
    const w = new World();
    w.env.STROM_LANG = n.lang;
    installAgent(w);
    // the setup with an agent here: research with it, or only the Strom archive (Enter keeps research)
    const setup = await w.ok(["setup"], { tty: true, answers: Array(30).fill("") });
    assert.match(setup.out, n.choice, `${n.lang}\n${setup.out}`);
    await w.withTree();
    assert.match((await w.ok(["mode"])).out, n.research, n.lang);
    const now = await w.ok(["mode", "archive"], { tty: true });
    assert.match(now.out, n.now, `${n.lang}\n${now.out}`);
    assert.match((await w.ok(["mode"])).out, n.is, n.lang);
    const menu = await w.ok([], { tty: true, answers: ["0"] });
    assert.match(menu.out, n.menu, `${n.lang}\n${menu.out}`);
    w.cleanup();
  }
});
