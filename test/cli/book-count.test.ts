// A book downloaded whole stays offered for ever while its count is not known (1126): the count the archive's catalogue
// gives (a connector's list) is written on the record set that has none — never over one there, never the highest
// number saved; a book whose images on disk run 1…N with no count says how its count is written (strom fetch, strom
// media add, strom task books). Synthetic data only; the archive is a local stand-in.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { opts, scans, world } from "./connectors.helpers.ts";

const AGENT = { CLAUDECODE: "1" };

type Row = { id: string; images?: number; onDisk: number; missing?: number; offer: boolean; countUnknown?: { from1to: number } };

test("a book fetched whole: offered while its count is not known (said how to write it), the connector's list writes the count — never over one there; a sealed tree takes it", opts, async () => {
  const { w, a } = await world();
  try {
    const list = path.join(w.dir, "archives-test.json");
    fs.writeFileSync(list, JSON.stringify({ archives: [{ host: "127.0.0.1", name: "Archiv v Lhotě", level: "restricted", checked: "2026-11-01", wholeBook: { how: "allowed", says: "Celé knihy lze stáhnout.", from: "reply" } }] }));
    const whole = { STROM_ARCHIVES_FILE: list };
    await w.ok(["recordset", "add", "Lhota N 1784–1820", "--kinds", "baptism", "--access", "online-free", "--url", `${a.base}/d/5359/1`]); // B0001
    await w.ok(["recordset", "add", "Lhota O 1784–1820", "--kinds", "marriage", "--access", "online-free", "--images", "50"]); // B0002
    for (const who of ["Jana", "Marie"]) await w.ok(["task", "add", `Křest ${who} Lhotákové`, "--level", "locate", "--where", "B1", "--why", "a", "--done-when", "b"]);
    const row = async (id: string) => ((await w.ok(["task", "books", "--min", "1", "--all", "--json"], { env: whole })).json.books as Row[]).find((r) => r.id === id)!;

    // every image of it fetched, its count not known: offered, said how its count is written
    const got = await w.ok(["fetch", "zkusebni", "5359", "--images", "1-3", "--recordset", "B1"]);
    assert.match(got.out, /B0001: images 1–3 on disk, how many the book has is not known — strom fetch zkusebni 5359 --list --recordset B0001 writes it from the archive's catalogue \(one request of the catalogue\), or strom recordset edit B0001 --images <n> when the archive's page says it; never the highest number saved/);
    const before = await row("B0001");
    assert.equal(before.images, undefined, "never the highest number saved");
    assert.equal(before.offer, true);
    assert.deepEqual(before.countUnknown, { from1to: 3 });
    assert.match((await w.ok(["task", "books", "--min", "1"], { env: whole })).out, /count not known \(images 1–3 on disk\) — offered until it is: strom recordset edit B0001 --images <n>/);

    // the connector's list of it: the count of the catalogue written (one request), the book whole on disk
    const hits = a.hits.length;
    const listed = await w.ok(["fetch", "zkusebni", "--list", "--recordset", "B1"]);
    assert.match(listed.out, /B0001: 3 images — the count the archive's catalogue gives, written/);
    assert.deepEqual(a.hits.slice(hits).filter((h) => h !== "/robots.txt"), ["/book/5359"], "nothing more asked of the archive");
    const after = await row("B0001");
    assert.equal(after.images, 3);
    assert.equal(after.missing, 0);
    assert.equal(after.offer, false);
    assert.equal(after.countUnknown, undefined);
    const ops = (fs.readdirSync(path.join(w.cwd, "data", "ops"), { recursive: true }) as string[]).filter((f) => f.endsWith(".jsonl")).map((f) => fs.readFileSync(path.join(w.cwd, "data", "ops", f), "utf8")).join("");
    assert.match(ops, /"op":"recordset\.edit"[^\n]*"summary":"B0001 images 3 \(the archive's catalogue: zkusebni\)"/);

    // a count there already is never changed
    const other = await w.ok(["fetch", "zkusebni", "5359", "--list", "--recordset", "B2"]);
    assert.doesNotMatch(other.out, /B0002: .* written/);
    assert.equal((await w.ok(["recordset", "show", "B2", "--json"])).json.recordset.images, 50);

    // the sealed tree: the count written by an agent is an ordinary write, the seal holds
    await w.ok(["recordset", "edit", "B2", "--images", "52"], { env: AGENT });
    assert.equal((await w.ok(["recordset", "show", "B2", "--json"])).json.recordset.images, 52);
    assert.equal((await w.run(["check"])).code, 0);
  } finally {
    w.cleanup();
    await a.close();
  }
});

test("images of a book saved whole by hand (strom media add): how its count is written, for a book its tasks need of an archive that lets it be downloaded whole", opts, async () => {
  const { w, a } = await world();
  try {
    const list = path.join(w.dir, "archives-test.json");
    fs.writeFileSync(list, JSON.stringify({ archives: [{ host: "archiv-lhota.example", name: "Archiv v Lhotě", level: "restricted", checked: "2026-11-01", wholeBook: { how: "allowed", says: "Celé knihy lze stáhnout.", from: "reply" } }] }));
    w.env.STROM_ARCHIVES_FILE = list;
    await w.ok(["recordset", "add", "Lhota Z 1790–1830", "--kinds", "burial", "--access", "online-free", "--url", "https://archiv-lhota.example/kniha/7"]); // B0001
    await w.ok(["recordset", "add", "Prouzalov Z 1790–1830", "--kinds", "burial", "--access", "online-free", "--url", "https://archiv-lhota.example/kniha/8"]); // B0002
    await w.ok(["task", "add", "Úmrtí Prouzala", "--level", "locate", "--where", "B1", "--why", "a", "--done-when", "b"]);
    const inbox = (folder: string, files: Record<number, string>) => {
      const dir = path.join(w.home, "shared", "inbox", folder);
      fs.mkdirSync(dir, { recursive: true });
      for (const [n, f] of Object.entries(files)) fs.copyFileSync(path.join(scans, f), path.join(dir, `${n}.jpg`));
    };
    inbox("lhota-z", { 1: "s0001.jpg", 2: "s0002.jpg", 3: "s0003.jpg" });
    const added = await w.ok(["media", "add", "--inbox", "lhota-z", "--recordset", "B1"]);
    assert.match(added.out, /B0001: images 1–3 on disk, how many the book has is not known — strom recordset edit B0001 --images <n> when the archive's page says it; never the highest number saved/);
    assert.doesNotMatch(added.out, /strom fetch/, "no connector of it named");
    // a book no task needs: not said
    inbox("prouzalov-z", { 1: "cmyk.jpg", 2: "restart.jpg" });
    assert.doesNotMatch((await w.ok(["media", "add", "--inbox", "prouzalov-z", "--recordset", "B2"])).out, /how many the book has is not known/);
    // its count written: not said again
    await w.ok(["recordset", "edit", "B1", "--images", "3"], { env: AGENT });
    inbox("lhota-z-2", { 4: "grey.jpg" });
    assert.doesNotMatch((await w.ok(["media", "add", "--inbox", "lhota-z-2", "--recordset", "B1"])).out, /how many the book has is not known/);
  } finally {
    w.cleanup();
    await a.close();
  }
});
