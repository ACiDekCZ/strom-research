// strom fetch <connector> --take --result "strom-result 1:200:… 2:200:…": a script of images said what it saved, so it is
// taken as images — a plan of the connector's pages lying there (a run given up, days old, or one still in time) never
// turns it into "no page taken over". Images the browser fetched and never saved are said as such: Chrome holds a site's
// second download back until the person allows it, in the profile the agent's browser tool works in. Two connectors of
// the same property (images through the browser), a local server plays the archive.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fakeConnector, readJsonFile } from "../helpers.ts";
import { opts, world } from "./connectors.helpers.ts";

test("a script of images taken as images: a page plan of the connector lying there holds nothing back; images never saved said as held back by the browser (two connectors)", opts, async () => {
  const { w, a, dir } = await world();
  try {
    const second = await fakeConnector(w, "lhotsky", a.base);
    const downloads = path.join(w.dir, "Stažené soubory");
    fs.mkdirSync(downloads);
    await w.ok(["config", "set", "browser.downloads", downloads]);
    await w.ok(["recordset", "add", "Lhota N 1784–1820", "--kinds", "baptism", "--url", `${a.base}/book/5359`]); // B0001
    const plans = path.join(w.cwd, ".strom", "browser");
    for (const [name, folder, stale, n] of [["zkusebni", dir, true, 1], ["lhotsky", second, false, 2]] as const) {
      const manifest = path.join(folder, "connector.json");
      const m = readJsonFile(manifest);
      fs.writeFileSync(manifest, JSON.stringify({ ...m, can: [...m.can, "locate"], routes: ["direct", "browser"], policy: { automation: "allowed", pace: { minIntervalMs: 2000 } } }));
      await w.ok(["connector", "use", name, "--via", "browser"]);
      const plan = (await w.ok(["fetch", name, "5359", "--images", `${n}-${n + 1}`, "--recordset", "B1", "--json"])).json;
      assert.equal(plan.plan.items.length, 2);
      // a plan of the connector's pages lying beside it: two days old (its script long over), or one still in time
      const created = stale ? Date.now() - 2 * 24 * 3600_000 : Date.now();
      const page = { key: "0123456789abcdef", method: "GET", url: `${a.base}/catalog?place=Lhota`, file: `strom-${name}-page-0123456789abcdef`, at: created };
      fs.writeFileSync(path.join(plans, `${name}-${created}-p.json`), JSON.stringify({ id: `${name}-${created}-p`, connector: name, book: "", pages: [page], resume: { cmd: "fetch", request: { cmd: "find", place: "Lhota" } }, open: `${a.base}/robots.txt`, origin: a.base, host: "127.0.0.1", gap: 2000, created, until: created + 15 * 60_000, items: [] }));
      // the script fetched both images, the browser saved none (its second download held back, the first went elsewhere)
      const took = await w.run(["fetch", name, "--take", "--result", `strom-result ${n}:200:1843 ${n + 1}:200:1790`]);
      assert.equal(took.code, 1, took.out + took.err);
      assert.doesNotMatch(took.out, /no page taken over/, `${name}: ${took.out}`);
      assert.match(took.out, /nothing taken over from .*Stažené soubory/);
      assert.match(took.out, new RegExp(String.raw`images ${n}–${n + 1}: the browser fetched them but saved nothing here — Chrome lets a site download one file until the user allows automatic downloads for it[\s\S]*in the browser profile your browser tool works in \(a permission given in another profile does not count\)\. Tell the user exactly that`));
      assert.match(took.out, new RegExp(`strom fetch ${name} 5359 --images ${n}–${n + 1} --recordset B0001`));
      // the images came after all: taken as images, the page plan still left for its own take
      fs.copyFileSync(path.join(import.meta.dirname, "..", "fixtures", "images", `s000${n}.jpg`), path.join(downloads, `strom-${name}-5359-000${n}.jpg`));
      const one = await w.ok(["fetch", name, "--take", "--result", `strom-result ${n}:200:1843`]);
      assert.match(one.out, /1 image taken over from .*: registered M\d{4}/);
      assert.ok(fs.readdirSync(plans).some((f) => f === `${name}-${created}-p.json`), "the page plan is not taken by a script of images");
    }
  } finally {
    w.cleanup();
    await a.close();
  }
});
