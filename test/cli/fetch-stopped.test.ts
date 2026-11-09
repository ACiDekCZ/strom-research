// A fetch whose connector stops on an error after some images: what came is registered, the output says exactly
// which images it did not fetch and the command that fetches them (text and --json), it ends with exit 1, and
// strom fetch --status and the brief say what is left; the same command again asks the archive only for the rest.

import { test } from "node:test";
import assert from "node:assert/strict";
import { opts, program, world } from "./connectors.helpers.ts";

// the connector of the test archive stops on image 3 when it is asked for image 1 too (the first run): the second
// run, asked only for what is not here, goes through
const failing = `import { done, fail, get, image, request } from "./sdk.ts";
const req = await request();
for (const n of req.images) {
  if (n === 3 && req.images.includes(1)) fail("image 3: HTTP 500");
  const name = "s" + String(n).padStart(4, "0") + ".jpg";
  const got = await get(BASE + "/img/" + req.book + "/" + n + ".jpg", { save: name });
  if (got.status !== 200) fail("image " + n + ": HTTP " + got.status);
  image(n, name, got.url!);
}
done();
`;

test("the connector stops on an error: the images not fetched and the command said, exit 1, --status and the brief tell it; the same command fetches only the rest", opts, async () => {
  const { w, a, dir } = await world();
  try {
    program(dir, `const BASE = ${JSON.stringify(a.base)};\n` + failing);
    await w.ok(["recordset", "add", "Lhota N 1800–1850", "--kinds", "baptism"]); // B0001
    await w.ok(["task", "add", "Křest Jana Lhotáka", "--level", "locate", "--where", "B1", "--why", "zkouška", "--done-when", "hotovo"]); // T0001
    const first = await w.run(["fetch", "zkusebni", "5359", "--images", "1-3", "--recordset", "B1"]);
    assert.equal(first.code, 1, first.out + first.err);
    assert.match(first.out, /stopped: the connector: image 3: HTTP 500/, first.out);
    assert.match(first.out, /2 images of B0001 \(images 1–2\) fetched and registered/, first.out);
    assert.match(first.out, /not fetched: images 3 — the same command fetches them \(what is here is not asked for again\): strom fetch zkusebni 5359 --images 1-3 --recordset B0001/, first.out);
    // fetch --status and the brief say what it left, and how to fetch it
    const status = await w.ok(["fetch", "--status"]);
    assert.match(status.out, /ended lately:\n {2}B0001 \(zkusebni 5359\): 2\/3 images registered \(images 1–2\) · ended \d\d:\d\d — stopped: the connector: image 3: HTTP 500 · not fetched: images 3 \(strom fetch zkusebni 5359 --images 3 --recordset B0001\)/, status.out);
    assert.match((await w.ok(["brief", "T1"])).out, /- B0001: a fetch in the foreground ended with images 3 not fetched \(stopped: the connector: image 3: HTTP 500\) — strom fetch zkusebni 5359 --images 3 --recordset B0001 if they are needed/);
    assert.deepEqual(
      a.hits.filter((h) => h.startsWith("/img/")),
      ["/img/5359/1.jpg", "/img/5359/2.jpg"],
    );
    // the same command: only image 3 asked for
    const again = await w.run(["fetch", "zkusebni", "5359", "--images", "1-3", "--recordset", "B1", "--json"]);
    assert.equal(again.code, 0, again.out + again.err);
    const data = JSON.parse(again.out) as { added: { image: number }[]; missed?: number[] };
    assert.deepEqual(data.added.map((m) => m.image), [3]);
    assert.equal(data.missed, undefined);
    assert.deepEqual(
      a.hits.filter((h) => h.startsWith("/img/")),
      ["/img/5359/1.jpg", "/img/5359/2.jpg", "/img/5359/3.jpg"],
    );
    // all here: nothing left to tell
    assert.match((await w.ok(["fetch", "--status"])).out, /^nothing is being fetched now\s*$/);
    assert.doesNotMatch((await w.ok(["brief", "T1"])).out, /not fetched/);
  } finally {
    w.cleanup();
    await a.close();
  }
});

test("--json of a fetch its connector stopped: missed and the command to fetch them, exit 1", opts, async () => {
  const { w, a, dir } = await world();
  try {
    program(dir, `const BASE = ${JSON.stringify(a.base)};\n` + failing);
    await w.ok(["recordset", "add", "Lhota Z 1800–1850", "--kinds", "burial"]); // B0001
    const r = await w.run(["fetch", "zkusebni", "5359", "--images", "1-3", "--recordset", "B1", "--json"]);
    assert.equal(r.code, 1, r.out + r.err);
    const data = JSON.parse(r.out) as { stopped?: string; missed?: number[]; interrupted?: boolean; resume?: string; added: { image: number }[] };
    assert.deepEqual(data.added.map((m) => m.image), [1, 2]);
    assert.deepEqual(data.missed, [3]);
    assert.equal(data.interrupted, false);
    assert.equal(data.resume, "strom fetch zkusebni 5359 --images 1-3 --recordset B0001");
  } finally {
    w.cleanup();
    await a.close();
  }
});
