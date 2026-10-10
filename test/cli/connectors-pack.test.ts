// Connectors: plugins in the plugins folder (<shared>/plugins/connectors/<name>/
// — copy a folder in and it is there), run by strom — every request paced by
// strom's limiter, a refusal stopping everything, the images checked, what was
// fetched registered with its provenance. The user's consent (on a terminal,
// never an agent's) is needed when they ask for it (connectors.consent on), and
// always for code that goes round strom. A local server plays the archive; the
// pauses are recorded, not slept.

import { readEntry, readZip, unzipTo, ZipWriter } from "../../src/core/zip.ts";
import { test, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { spawnSync } from "node:child_process";
import type { AddressInfo } from "node:net";
import { World, hasGit, fakeConnector, pluginDir, readJsonFile } from "../helpers.ts";
import { testHooks, DEFAULT_PACE } from "../../src/core/net.ts";
import { encodeJpeg } from "../../src/image/jpeg-encode.ts";
import { decodeJpeg } from "../../src/image/jpeg-decode.ts";
import { blank } from "../../src/image/image.ts";
import { opts, scans, pauses, TILE, archive, world, program, runInTab } from "./connectors.helpers.ts";
import type { Archive } from "./connectors.helpers.ts";

test("pack and unpack: the research handed over — the tree with its history, the images its records stand on, the connectors; the rest fetched again", opts, async () => {
  const { w, a } = await world();
  await w.ok(["recordset", "add", "Týnec N 1784–1820", "--kinds", "baptism", "--url", `${a.base}/book/5359`]); // B0001
  await w.ok(["person", "add", "Jan /Novák/", "--born", "1805"]);
  await w.ok(["fetch", "zkusebni", "5359", "--images", "1-3", "--recordset", "B1"]);
  await w.ok(["source", "add", "Křest Jana Nováka 1805", "--kind", "baptism", "--recordset", "B1", "--locator", "fol. 2", "--information", "primary", "--form", "original", "--clip", "B0001:2@0.05,0.40,0.45,0.18"]);
  const zip = path.join(w.dir, "balík.zip");
  const r = await w.ok(["pack", "--out", zip]);
  assert.match(r.out, /Zabaleno „Novákovi“: .*balík\.zip/);
  assert.match(r.out, /snímky: 1 \(/);
  assert.match(r.out, /vynechané snímky: 2 \(/);
  assert.match(r.out, /konektory: zkusebni/);
  const names = readZip(zip).map((e) => e.name);
  for (const n of ["JAK-NAVAZAT.txt", "strom-pack.json", "Windows.cmd", "macOS.command", "Linux.sh", "Novákovi/strom.json", "Novákovi/.git/HEAD", "Novákovi/.git/refs/heads/", "shared/plugins/connectors/zkusebni/connector.json"])
    assert.ok(names.includes(n), `${n} in ${names.slice(0, 40).join(" ")}`);
  assert.equal(names.filter((n) => n.startsWith("shared/media/")).length, 1, "only the image the record stands on");
  assert.ok(!names.some((n) => n.includes(".strom/")), "nothing of this computer's state");
  assert.match(readEntry(zip, readZip(zip).find((e) => e.name === "macOS.command")!).toString(), /STROM_INSTALL_ONLY=1 sh[\s\S]*"\$STROM" unpack "\$\(pwd\)"/);
  assert.match(readEntry(zip, readZip(zip).find((e) => e.name === "Windows.cmd")!).toString(), /\r\ncall "%STROM%" unpack "%~dp0\."\r\n/);

  // someone new: strom just installed, nothing set up — the wizard first, then the research in place
  const b = new World();
  b.env.LANG = "cs_CZ.UTF-8";
  assert.equal((await b.run(["unpack", zip])).code, 4, "an agent never unpacks: it adds connectors");
  const u = await b.ok(["unpack", zip], { answers: ["cs", "", "", "", "n", "a"] });
  assert.match(u.out, /„Novákovi“ \(ze stromu [\d.]+(?:-[0-9A-Za-z.]+)?, uloženo [\d-]+\) · snímky: 1 · zkusebni/);
  assert.match(u.out, /„Novákovi“ je tady: [\s\S]*snímky do sdílené složky: 1[\s\S]*konektory: zkusebni[\s\S]*prohledané stránky, které v něm nejsou: 2[\s\S]*převzato na tento počítač/);
  const root = b.treeDir("Novákovi");
  assert.match((await b.ok(["check"], { cwd: root })).out, /^ok/);
  assert.match((await b.ok(["person", "list"], { cwd: root })).out, /P0001  Jan Novák/);
  assert.ok(fs.existsSync(path.join(b.home, "shared", "plugins", "connectors", "zkusebni", "connector.json")));
  assert.ok(fs.readFileSync(path.join(root, ".claude", "settings.json"), "utf8").includes(b.home), "the tree's permissions name this computer's folders");
  // the image the record stands on is here; a page searched through comes from the archive again
  await b.ok(["media", "view", "B1:2"], { cwd: root });
  assert.match((await b.run(["media", "view", "B1:1"], { cwd: root })).err, /strom fetch zkusebni 5359 --recordset B0001 --images 1/);
  assert.match((await b.ok(["fetch", "zkusebni", "5359", "--recordset", "B1", "--images", "1"], { cwd: root })).out, /fetched again and put back/);
  await b.ok(["person", "add", "Marie /Nováková/"], { cwd: root });
  // the same research again: said, nothing written
  assert.match((await b.run(["unpack", zip], { answers: ["a"] })).err, /tento výzkum už tu je/);
  // the folder a system unpacked it into works too
  const c = new World();
  await c.ok(["setup", "--yes"]);
  const folder = path.join(c.dir, "Stažené", "balík");
  unzipTo(zip, folder);
  await c.ok(["unpack", path.dirname(folder)], { answers: ["a"] });
  assert.match((await c.ok(["check"], { cwd: c.treeDir("Novákovi") })).out, /^ok/);
  // a ZIP that would write outside its folder is refused before anything
  const evil = path.join(c.dir, "zlý.zip");
  const z = new ZipWriter(evil);
  z.add("strom-pack.json", Buffer.from("{}"));
  z.add("../../venku.txt", Buffer.from("x"));
  z.close();
  assert.match((await c.run(["unpack", evil], { answers: ["a"] })).err, /a file outside the package/);
  assert.ok(!fs.existsSync(path.join(c.dir, "venku.txt")));
  for (const x of [w, b, c]) x.cleanup();
  await a.close();
});

test("a session and a form: cookies kept, the portal's headers, a POST — all through strom", opts, async () => {
  const { w, a, dir } = await world();
  program(
    dir,
    `import { book, done, fail, get, post, request } from "./sdk.ts";
const BASE = ${JSON.stringify(a.base)};
const req = await request();
if (req.cmd !== "find") fail("find only");
const start = await get(BASE + "/login");
const found = await post(BASE + "/search", { place: req.place }, { headers: { "X-Requested-With": "XMLHttpRequest", Referer: start.url! } });
if (found.status !== 200) fail("search: " + found.status + " " + found.text);
for (const b of JSON.parse(found.text!)) book(b);
done();
`,
  );
  const r = await w.ok(["fetch", "zkusebni", "--find", "Dolní Lhota"]);
  assert.match(r.out, /find \(\d+ s\): 3 request\(s\) \(the connector asked 2; 1 more: redirects or retries\)/, "the redirect is a request to the host too");
  assert.match(r.out, /Dolní Lhota N 1784–1820/);
  assert.deepEqual(a.hits, ["/login", "/search-page", "/search"], "the redirect followed by strom, with its cookie");
  // the next run starts without the cookie: the server wants a new session
  program(dir, `import { done, fail, post, request } from "./sdk.ts";\nawait request();\nconst r = await post(${JSON.stringify(a.base)} + "/search", { place: "x" }, { headers: { "X-Requested-With": "XMLHttpRequest" } });\nif (r.status !== 400) fail("a cookie of another run");\ndone();\n`);
  assert.equal((await w.run(["fetch", "zkusebni", "--find", "x"])).code, 0);
  w.cleanup();
  await a.close();
});

test("an error page or a broken download is not a scan: the run stops, nothing is registered", opts, async () => {
  const { w, a } = await world();
  await w.ok(["recordset", "add", "Kniha", "--kinds", "baptism"]); // B0001
  const page = await w.run(["fetch", "zkusebni", "chyba", "--images", "1-3", "--recordset", "B1"]);
  assert.equal(page.code, 1);
  assert.match(page.out, /stopped: image 1 \(s0001\.jpg\): not an image \(it begins "<!DOCTYPE html><"\) — an error page\?/);
  assert.equal(a.hits.filter((h) => h.startsWith("/img/chyba/")).length, 1, "not another request after it");
  const cut = await w.run(["fetch", "zkusebni", "useknuta", "--images", "1-3", "--recordset", "B1"]);
  assert.equal(cut.code, 1);
  assert.match(cut.out, /stopped: image 1 \(s0001\.jpg\): a JPEG cut short \(no end marker\) — the download broke off/);
  assert.equal((await w.ok(["media", "list", "--json"])).json.total, 0);
  w.cleanup();
  await a.close();
});

test("a stand-in is not a scan (a thumbnail, the same picture again); an image in tiles only is put together by strom", opts, async () => {
  const { w, a, dir } = await world();
  program(
    dir,
    `import { done, fail, get, image, imageFromTiles, log, request } from "./sdk.ts";
const BASE = ${JSON.stringify(a.base)};
const req = await request();
if (req.cmd !== "fetch") fail("fetch only");
for (const n of req.images) {
  const file = "s" + String(n).padStart(4, "0") + ".jpg";
  if (req.book === "tiles" || req.book === "gap") {
    const tiles = [];
    for (const [c, r] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
      if (req.book === "gap" && c === 1 && r === 1) continue;
      const got = await get(BASE + "/tile/5359/" + n + "/" + c + "-" + r + ".jpg", { save: "t" + n + "-" + c + "-" + r + ".jpg" });
      log("tile " + c + "-" + r + " " + got.width + "x" + got.height);
      tiles.push({ file: "t" + n + "-" + c + "-" + r + ".jpg", x: c * 400, y: r * 300 });
    }
    imageFromTiles(n, file, tiles, { width: 800, height: 600 }, BASE + "/view/" + n);
  } else {
    const got = await get(BASE + "/" + req.book + "/" + n + ".jpg", { save: file });
    log("image " + n + " " + got.width + "x" + got.height);
    image(n, file, BASE + "/view/" + n);
  }
}
done();
`,
  );
  await w.ok(["recordset", "add", "Kniha", "--kinds", "baptism"]); // B0001
  // a thumbnail in place of the image: stopped, nothing registered — and the connector saw its size first
  const thumb = await w.run(["fetch", "zkusebni", "thumb", "--images", "1-2", "--recordset", "B1"]);

  assert.equal(thumb.code, 1);
  assert.match(thumb.err, /image 1 120x97/);
  assert.match(thumb.out, /stopped: image 1 \(s0001\.jpg\): 120×97 px — a placeholder or a thumbnail, not a scan/);
  // the same picture for another image
  const same = await w.run(["fetch", "zkusebni", "same", "--images", "1-2", "--recordset", "B1"]);

  assert.equal(same.code, 1);
  assert.match(same.out, /stopped: image 2 \(s0002\.jpg\): the same file as image 1 — a placeholder in place of both, neither is kept/);
  assert.equal((await w.ok(["media", "list", "--json"])).json.total, 0);
  // tiles: put together into one image, the tiles gone
  const t = await w.ok(["connector", "test", "zkusebni", "--fetch", "tiles", "--images", "1", "--max", "10"]);
  assert.match(t.err, /tile 1-1 400x300/);
  assert.match(t.out, /images \(1\): 1=s0001\.jpg \d+ B 800×600 px/);
  const test = path.join(dir, ".test");
  assert.deepEqual(fs.readdirSync(test).filter((f) => f !== "probe"), ["s0001.jpg"]);
  const whole = decodeJpeg(fs.readFileSync(path.join(test, "s0001.jpg")));
  const px = (img: { width: number; channels: number; data: Uint8Array }, x: number, y: number) => img.data[(y * img.width + x) * img.channels]!;
  for (const [x, y, c, r] of [[100, 100, 0, 0], [500, 100, 1, 0], [100, 400, 0, 1], [700, 550, 1, 1]] as const) {
    const src = decodeJpeg(fs.readFileSync(path.join(scans, `s000${TILE[`${c}-${r}`]}.jpg`)));
    assert.ok(Math.abs(px(whole, x, y) - px(src, x - c * 400, y - r * 300)) <= 12, `tile ${c}-${r} in its place`);
  }
  const reg = await w.ok(["fetch", "zkusebni", "tiles", "--images", "1-2", "--recordset", "B1"]);
  assert.match(reg.out, /2 image\(s\)/);
  assert.match((await w.ok(["media", "list"])).out, /M0001\s+B0001:1\s+800×600/);
  // another book of the portal gives the same scans: not registered as its images, and said so
  await w.ok(["recordset", "add", "Jiná kniha", "--kinds", "burial"]); // B0002
  const clash = await w.ok(["fetch", "zkusebni", "tiles", "--images", "1", "--recordset", "B2"]);
  assert.match(clash.out, /1 already registered\n⚠ B0002:1 is the same file as M0001 \(B0001:1\) — not registered again: the portal may have given another book's image/);
  assert.equal((await w.ok(["media", "list", "--json"])).json.total, 2);
  // a tile left out: a gap, not an image
  const gap = await w.run(["connector", "test", "zkusebni", "--fetch", "gap", "--images", "1"]);
  assert.match(gap.out, /stopped: image 1: the tiles leave a gap near 404,300 px of 800×600 — a tile is missing, or its x, y is wrong/);
  w.cleanup();
  await a.close();
});

test("the pace of a host: strom's pause and no cap made up — the user's own, set in their terminal, back with auto", opts, async () => {
  const { w, a } = await world();
  assert.match((await w.ok(["connector", "show", "zkusebni"])).out, /pace\s+at least 2 s apart, no hourly cap/);
  assert.equal((await w.run(["allow", "host", "127.0.0.1", "--pace", "1"])).code, 4, "the user's decision");
  assert.equal((await w.run(["allow", "host", "127.0.0.1", "--pace", "0.1"], { tty: true })).code, 2, "not below the shortest pause");
  const set = await w.ok(["allow", "host", "127.0.0.1", "--pace", "0.5", "--per-hour", "3000"], { tty: true });
  assert.match(set.out, /127\.0\.0\.1: at least 0\.5 s apart, at most 3000 an hour — yours/);
  assert.match((await w.ok(["consents"])).out, /127\.0\.0\.1 · at least 0\.5 s apart, at most 3000 an hour \(yours\)/);
  assert.match((await w.ok(["connector", "show", "zkusebni"])).out, /pace\s+at least 0\.5 s apart, at most 3000 an hour — yours for the host/);
  const back = await w.ok(["allow", "host", "127.0.0.1", "--pace", "auto", "--per-hour", "auto"], { tty: true });
  assert.match(back.out, /127\.0\.0\.1: at least 2 s apart, no hourly cap — the service's again/);
  w.cleanup();
  await a.close();
});

test("a refusal (403) stops the run and leaves the archive alone — until the user lifts it", opts, async () => {
  const { w, a } = await world();
  const r = await w.run(["fetch", "zkusebni", "zakazana", "--images", "1-5"]);
  assert.equal(r.code, 1);
  assert.match(r.out, /stopped: .*403/);
  assert.equal(a.hits.filter((h) => h.startsWith("/img/")).length, 1, "nothing after the refusal");
  assert.match((await w.ok(["consents"])).out, /127\.0\.0\.1 · ⛔ refused us — left alone until/);
  const again = await w.run(["fetch", "zkusebni", "5359", "--images", "1"]);
  assert.equal(again.code, 1);
  assert.match(again.out, /left alone until/);
  assert.equal(a.hits.length, 1, "not even another book");
  assert.equal((await w.run(["allow", "host", "127.0.0.1", "--unblock"])).code, 4, "only the user");
  assert.match((await w.ok(["allow", "host", "127.0.0.1", "--unblock"], { tty: true, answers: ["y"] })).out, /the refusal is lifted/);
  assert.equal((await w.run(["fetch", "zkusebni", "5359", "--images", "1"])).code, 0);
  w.cleanup();
  await a.close();
});

test("what the portal and the tree allow: manual stays manual, a forbidden archive is not fetched", opts, async () => {
  const { w, a } = await world();
  await fakeConnector(w, "rucni", a.base, { automation: "manual", terms: "https://archive.example.org/terms" });
  const m = await w.run(["fetch", "rucni", "5359", "--images", "1"]);
  assert.equal(m.code, 2);
  assert.match(m.err, /does not allow automated download[\s\S]*the user saves them by hand: strom task wait T… --images B…:1 --on/);
  assert.match((await w.ok(["fetch", "rucni", "--find", "Týnec"])).out, /Týnec N 1784–1820/, "finding books is fine");
  await w.ok(["repo", "add", "Archiv Čížkov", "--url", `${a.base}/`, "--automation", "forbidden"]);
  const f = await w.run(["fetch", "zkusebni", "5359", "--images", "1"]);
  assert.equal(f.code, 2);
  assert.match(f.err, /R0001 Archiv Čížkov is marked automation forbidden in this tree/);
  assert.equal(a.hits.filter((h) => h.startsWith("/img/")).length, 0);
  w.cleanup();
  await a.close();
});

test("the agent may improve an allowed connector — unless its code goes round strom: then every change needs a yes", opts, async () => {
  const { w, a, dir } = await world();
  await w.ok(["config", "set", "connectors.consent", "on"]);
  assert.equal((await w.run(["allow", "connector", "zkusebni"], { tty: true, answers: ["y", "y"] })).code, 0);
  // the agent works on it: still allowed, and the user can see it changed
  fs.appendFileSync(path.join(dir, "connector.ts"), "\n// handles the portal's second catalogue too\n");
  assert.equal((await w.run(["connector", "test", "zkusebni", "--find", "Týnec"])).code, 0);
  assert.match((await w.ok(["connector", "list"])).out, /zkusebni\s.*allowed \(changed since\)/);
  // code that reaches the network itself
  fs.appendFileSync(path.join(dir, "connector.ts"), "\nconst sneak = await fetch('https://elsewhere.example/');\n");
  const changed = await w.run(["connector", "test", "zkusebni", "--find", "Týnec"]);
  assert.equal(changed.code, 4);
  // a person (no terminal) reads it in the research's language
  assert.match(changed.err, /Jeho kód se od povolení změnil/);
  assert.match((await w.ok(["connector", "show", "zkusebni"])).out, /⚠ reaches the network directly[\s\S]*connector\.ts:\d+ fetch\(\)/);
  const no = await w.run(["allow", "connector", "zkusebni"], { tty: true, answers: ["n"] });
  assert.match(no.out, /⚠ its code reaches the network or other programs directly[\s\S]*asked again after every change/);
  assert.match(no.out, /not allowed — nothing changed/);
  assert.equal((await w.run(["allow", "connector", "zkusebni"], { tty: true, answers: ["y"] })).code, 0, "the user decides");
  fs.appendFileSync(path.join(dir, "connector.ts"), "\n// one more line\n");
  assert.equal((await w.run(["connector", "test", "zkusebni", "--find", "Týnec"])).code, 4, "exactly as it was allowed");
  // other ways round strom are seen too
  for (const [file, code] of [
    ["helper.mjs", 'import https from "node:https";\n'],
    ["pomoc.py", "import subprocess\n"],
    ["spust.py", "exec(kód)\n"],
    ["stahni.sh", "curl -o s0001.jpg https://elsewhere.example/1.jpg\n"],
    ["load.ts", "const m = await import(name);\n"],
  ]) {
    fs.writeFileSync(path.join(dir, file!), code!);
    assert.match((await w.ok(["connector", "show", "zkusebni"])).out, new RegExp(`${file!.replace(".", "\\.")}:1 `), file);
    fs.rmSync(path.join(dir, file!));
  }
  // what a word means in one language is not read into another: a regex's exec() in TypeScript, a fetch() of its own in Python
  fs.writeFileSync(path.join(dir, "rozbor.ts"), "export const nadpis = (html: string) => /<h1>(.*?)<\\/h1>/u.exec(html)?.[1];\n");
  fs.writeFileSync(path.join(dir, "pomoc.py"), "def fetch(kniha):\n    return re.compile('Žďár').search(kniha)\n");
  assert.doesNotMatch((await w.ok(["connector", "show", "zkusebni"])).out, /rozbor\.ts|pomoc\.py/);
  fs.rmSync(path.join(dir, "rozbor.ts"));
  fs.rmSync(path.join(dir, "pomoc.py"));
  fs.mkdirSync(path.join(dir, "node_modules"));
  assert.match((await w.ok(["connector", "show", "zkusebni"])).out, /node_modules\/ — libraries strom cannot check/);
  w.cleanup();
  await a.close();
});

test("a Node connector runs sandboxed: its own folder and the work folder, nothing else", opts, async () => {
  const { w, a, dir } = await world();
  program(
    dir,
    `import fs from "node:fs";
import path from "node:path";
import { done, log, request } from "./sdk.ts";
await request();
const tryIt = (what: string, f: () => void) => { try { f(); log(what + ": done"); } catch (e) { log(what + ": " + (e as { code?: string }).code); } };
tryIt("write outside", () => fs.writeFileSync(path.join(process.env.HOME!, "unikl.txt"), "x"));
tryIt("read outside", () => fs.readdirSync(process.env.HOME!));
tryIt("write inside", () => fs.writeFileSync(path.join(process.env.STROM_CONNECTOR_WORKDIR!, "tiles.txt"), "x"));
log("env: " + Object.keys(process.env).filter((k) => k.startsWith("STROM")).join(","));
done();
`,
  );
  const r = await w.ok(["connector", "test", "zkusebni", "--find", "x"]);
  assert.match(r.out, /write outside: ERR_ACCESS_DENIED/);
  assert.match(r.out, /read outside: ERR_ACCESS_DENIED/);
  assert.match(r.out, /write inside: done/);
  assert.match(r.out, /env: STROM_CONNECTOR_WORKDIR\n/, "nothing else of strom's environment");
  assert.equal(fs.existsSync(path.join(w.env.HOME!, "unikl.txt")), false);
  w.cleanup();
  await a.close();
});

test("connector add: from a folder, copied into the plugins folder under its name; remove deletes it", opts, async () => {
  const { w, a, dir } = await world();
  const outside = path.join(w.dir, "stažený konektor");
  fs.cpSync(dir, outside, { recursive: true });
  assert.equal((await w.run(["connector", "add", outside])).code, 4, "the user's");
  const named = await w.run(["connector", "add", outside], { tty: true, answers: ["y", "y"] });
  assert.equal(named.code, 0, named.err);
  assert.match(named.out, /connector stazeny-konektor allowed, installed in .*plugins\/connectors\/stazeny-konektor\nhosts allowed: 127\.0\.0\.1/, "a name made of the folder's");
  const r = await w.run(["connector", "add", outside, "--name", "stazeny"], { tty: true, answers: ["y"] });
  assert.equal(r.code, 0, r.err);
  assert.ok(fs.existsSync(path.join(pluginDir(w, "stazeny"), "connector.json")));
  assert.match((await w.ok(["connector", "test", "stazeny", "--find", "Týnec"])).out, /Týnec N 1784–1820/);
  assert.equal((await w.run(["connector", "add", outside, "--name", "Špatně"], { tty: true, answers: ["y"] })).code, 2);
  assert.equal((await w.run(["connector", "remove", "stazeny"])).code, 4, "the user's");
  assert.match((await w.ok(["connector", "remove", "stazeny"], { tty: true, answers: ["y"] })).out, /connector stazeny removed/);
  assert.equal(fs.existsSync(pluginDir(w, "stazeny")), false);
  assert.equal(readJsonFile(path.join(w.env.STROM_CONFIG_DIR!, "consents.json")).connectors.stazeny, undefined);
  w.cleanup();
  await a.close();
});

// A live run's --regex with a backtick (a script's template string) made its shell command be refused under dontAsk.
test("connector grep --regex: a backtick is written as . — the help and the discovery brief say so", async () => {
  const w = new World();
  await w.ok(["setup", "--yes"]);
  assert.match((await w.ok(["help", "connector", "grep"])).out, /--regex\s+the pattern is a regular expression \(JavaScript, in any case\) — a backtick in it written as \. \(any character\): a command with one is refused/);
  await w.ok(["connector", "new", "zkouska", "--url", "https://archive.example.org"]);
  assert.match(fs.readFileSync(path.join(pluginDir(w, "zkouska"), "DISCOVERY.md"), "utf8"), /\(`--regex` for a pattern; a backtick in it written as `\.`, any character —\s+a command with a backtick is refused\)/);
  w.cleanup();
});

test("connector grep: the saved answers searched, each hit with the text round it — any case, any script, composed or not", opts, async () => {
  const { w, a, dir } = await world();
  const probe = path.join(dir, ".test", "probe");
  assert.match((await w.ok(["connector", "grep", "zkusebni", "anything"])).out, /nothing saved yet — strom connector probe zkusebni <url>/);
  fs.mkdirSync(probe, { recursive: true });
  const places = Array.from({ length: 30 }, (_, i) => `"Místo ${i}"`).join(", ");
  fs.writeFileSync(path.join(probe, "SearchPage"), `<html>\n<script>var tags = [${places}, "Žďár - obec Žďár", "Москва"];</script>\n<a href="../img/Kniha_03__005.jpg;jsessionid=X1">▼</a>\n</html>\n`);
  fs.writeFileSync(path.join(probe, "5"), `<a href="../img/Kniha_03__006.jpg">▼</a>\n<td>Kniha&nbsp;03</td><td>Kniha\n  03</td>\n`);
  fs.writeFileSync(path.join(probe, "s0001.jpg"), Buffer.from([0xff, 0xd8, 0xff, 0x00, 0x4a, 0x70, 0x67, 0xff, 0xd9])); // "Jpg" inside, but an image
  const hit = await w.ok(["connector", "grep", "zkusebni", "ŽĎÁR", "--around", "12"]);
  assert.match(hit.out, /^2 hit\(s\) in 1 file\(s\) of .*\.test:$/m);
  assert.match(hit.out, /^probe\/SearchPage:2:372  \(2 hits\) …Místo 29", "Žďár - obec Žďár", "Москва"\]…$/m, "where it is, with the text round it");
  assert.equal((await w.ok(["connector", "grep", "zkusebni", "Žďár".normalize("NFD"), "--json"])).json.total, 2, "typed decomposed");
  assert.equal((await w.ok(["connector", "grep", "zkusebni", "москва", "--json"])).json.total, 1, "any script, any case");
  assert.equal((await w.ok(["connector", "grep", "zkusebni", " kniha 03 ", "--json"])).json.total, 2, "a space: any white space, &nbsp; too");
  const re = await w.ok(["connector", "grep", "zkusebni", "[^/\"]+\\.jpg", "--regex", "--json"]);
  assert.deepEqual(re.json.hits.map((h: { file: string; line: number; column: number }) => `${h.file}:${h.line}:${h.column}`), ["probe/5:1:17", "probe/SearchPage:3:17"], "images are not searched");
  assert.equal((await w.ok(["connector", "grep", "zkusebni", ".jpg", "--in", "5", "--json"])).json.total, 1);
  assert.equal((await w.ok(["connector", "grep", "zkusebni", ".jpg", "--in", "probe/5", "--json"])).json.total, 1);
  assert.equal((await w.run(["connector", "grep", "zkusebni", ".jpg", "--in", "6"])).code, 2);
  assert.equal((await w.run(["connector", "grep", "zkusebni", "[", "--regex"])).code, 2);
  const list = await w.ok(["connector", "grep", "zkusebni", "Místo", "--around", "8"]);
  assert.match(list.out, /^30 hit\(s\) in 1 file\(s\)/, "every hit counted");
  assert.match(list.out, /^probe\/SearchPage:2:22  \(30 hits\) …ags = \["Místo 0", "Místo 1"/m, "hits close together: one stretch of text");
  assert.ok(list.out.trim().split("\n").length < 10, list.out);
  assert.match((await w.ok(["connector", "grep", "zkusebni", "Místo", "--around", "0", "--limit", "10"])).out, /^… 20 more: strom connector grep zkusebni Místo --page 2$/m);
  // a page's characters as references, a script's as escapes: found as they read, shown as the file has them
  fs.writeFileSync(
    path.join(probe, "napoveda"),
    String.raw`<h2>Lze st&aacute;hnout sn&iacute;mek?</h2><p>jen prohl&iacute;že&#269;em - tla&#x10D;&iacute;tko</p><td>&#1050;&#1080;&#1111;&#1074;</td>` +
      "\n" + String.raw`<script>var v = Viewer(["https:\/\/img.example\/iip?f=Knížka_01.jp2"]);</script>` + "\n",
  );
  const read = await w.ok(["connector", "grep", "zkusebni", "stáhnout snímek", "--around", "4"]);
  assert.match(read.out, /^probe\/napoveda:1:9  …Lze st&aacute;hnout sn&iacute;mek\?<\/h…$/m, "found as it reads, shown as it is written");
  assert.equal((await w.ok(["connector", "grep", "zkusebni", "PROHLÍŽEČEM".normalize("NFD"), "--json"])).json.total, 1, "decomposed, any case");
  assert.equal((await w.ok(["connector", "grep", "zkusebni", "tlačítko", "--json"])).json.total, 1, "a reference by number");
  assert.equal((await w.ok(["connector", "grep", "zkusebni", "київ", "--json"])).json.total, 1, "any script");
  assert.equal((await w.ok(["connector", "grep", "zkusebni", "https://img.example/iip?f=Knížka", "--json"])).json.total, 1, "a script's escapes");
  assert.equal((await w.ok(["connector", "grep", "zkusebni", String.raw`https:\/\/img`, "--json"])).json.total, 1, "as the file has it: once, not twice");
  const jp2 = await w.ok(["connector", "grep", "zkusebni", String.raw`f=[^"]+\.jp2`, "--regex", "--json"]);
  assert.deepEqual(jp2.json.hits.map((h: { line: number; column: number }) => `${h.line}:${h.column}`), ["2:53"], "a pattern too, where the file has it");
  assert.match((await w.ok(["connector", "grep", "zkusebni", "Brno"])).out, /^not found in 3 saved file\(s\) of /);
  assert.deepEqual(a.hits, [], "nothing is requested");
  w.cleanup();
  await a.close();
});

// A live run read a minified script a probe saved whole and went past its read limit.
test("connector probe: a big answer, or a minified one of one long line, is to be searched, never read whole", opts, async () => {
  const minified = `var a={${Array.from({ length: 800 }, (_, i) => `k${i}:"/api/v1/item/${i}"`).join(",")}};`; // one line, ~20 000 characters
  const page = Array.from({ length: 3000 }, (_, i) => `<li><a href="/kniha/${i}">Žďár — kniha ${i}</a></li>`).join("\n"); // ~150 KB of short lines
  const server = http.createServer((req, res) => {
    if (req.url === "/app.min.js") res.writeHead(200, { "content-type": "application/javascript" }).end(minified);
    else if (req.url === "/seznam.html") res.writeHead(200, { "content-type": "text/html; charset=utf-8" }).end(page);
    else res.writeHead(200, { "content-type": "text/html" }).end("<p>malá stránka</p>\n");
  });
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const w = new World();
  await w.withTree();
  await fakeConnector(w, "velky", base);
  const js = await w.ok(["connector", "probe", "velky", `${base}/app.min.js`]);
  assert.match(js.out, /saved: .*app\.min\.js — too big to read whole \(\d+ KB, a line of \d+ characters\): never read the file, search it: strom connector grep velky <text> --in app\.min\.js/);
  const html = await w.ok(["connector", "probe", "velky", `${base}/seznam.html`, "--json"]);
  assert.equal(html.json.big, true);
  const htmlText = await w.ok(["connector", "probe", "velky", `${base}/seznam.html`]);
  assert.match(htmlText.out, /too big to read whole \(\d+ KB\): never read the file, search it: strom connector grep velky <text> --in seznam\.html/);
  assert.doesNotMatch(htmlText.out, /a line of/);
  // a small one is read as before
  const small = await w.ok(["connector", "probe", "velky", `${base}/mala`]);
  assert.match(small.out, /saved: .*mala — search it: strom connector grep velky <text> \(an address/);
  assert.doesNotMatch(small.out, /too big/);
  // and the search finds what it holds
  assert.equal((await w.ok(["connector", "grep", "velky", "/api/v1/item/799", "--in", "app.min.js", "--json"])).json.total, 1);
  w.cleanup();
  await new Promise((done) => server.close(done));
});

test("connector probe: one request through strom while mapping a portal, the answer saved to read", opts, async () => {
  const { w, a, dir } = await world();
  const r = await w.ok(["connector", "probe", "zkusebni", `${a.base}/login`]);
  assert.match(r.out, new RegExp(`GET ${a.base}/login → 200 · no type · 6 B · after redirects ${a.base}/search-page`));
  assert.match(r.out, /saved: .*\.test\/probe\/search-page$/m);
  assert.equal(fs.readFileSync(path.join(dir, ".test", "probe", "search-page"), "utf8"), "<form>");
  const post = await w.ok(["connector", "probe", "zkusebni", `${a.base}/search`, "--method", "POST", "--body", "place=Lhota", "--header", "X-Requested-With: XMLHttpRequest", "--header", "Content-Type: application/x-www-form-urlencoded", "--save", "hledani.txt"]);
  assert.match(r.out, /^cookies kept for the next probe: SESSION \(--fresh starts without them\)$/m);
  assert.match(post.out, /POST .*\/search → 200/, "the session of the earlier probe, like one visit in a browser");
  assert.match(fs.readFileSync(path.join(dir, ".test", "probe", "hledani.txt"), "utf8"), /Lhota N 1784/);
  const fresh = await w.ok(["connector", "probe", "zkusebni", `${a.base}/search`, "--method", "POST", "--body", "place=Lhota", "--header", "X-Requested-With: XMLHttpRequest", "--header", "Content-Type: application/x-www-form-urlencoded", "--save", "bez-session.txt", "--fresh"]);
  assert.match(fresh.out, /POST .*\/search → 400/);
  assert.match(fs.readFileSync(path.join(dir, ".test", "probe", "bez-session.txt"), "utf8"), /no session: POST undefined/, "--fresh: a new session");
  const off = await w.run(["connector", "probe", "zkusebni", "https://elsewhere.example/app.js"]);
  assert.notEqual(off.code, 0);
  assert.match(off.err, /elsewhere\.example is not one of the hosts this connector may contact/);
  assert.equal((await w.run(["connector", "probe", "zkusebni", `${a.base}/x`, "--header", "bez dvojtečky"])).code, 2);
  assert.deepEqual(a.hits, ["/login", "/search-page", "/search", "/search"]);
  await w.ok(["connector", "test", "zkusebni", "--find", "Lhota"]);
  assert.ok(fs.existsSync(path.join(dir, ".test", "probe", "hledani.txt")), "a test starts afresh, but what probes saved stays");
  w.cleanup();
  await a.close();
});

test("a part of an image, sharper: one request, registered with its image — a view of that place uses it by itself", opts, async () => {
  const { w, a, dir } = await world();
  const manifest = path.join(dir, "connector.json");
  const m = readJsonFile(manifest);
  // it cannot yet: the user hears how to save the part by hand
  await w.ok(["recordset", "add", "Týnec N 1784–1820", "--kinds", "baptism"]); // B0001
  const cannot = await w.run(["fetch", "zkusebni", "5359", "--recordset", "B1", "--images", "1", "--crop", "0.5,0,0.5,0.5"]);
  assert.equal(cannot.code, 2);
  assert.match(cannot.err, /connector zkusebni fetches whole images only \(it cannot: part\)[\s\S]*zoomed in on it in the portal's viewer/);
  fs.writeFileSync(manifest, JSON.stringify({ ...m, can: [...m.can, "part"] }));
  const code = fs.readFileSync(path.join(dir, "connector.ts"), "utf8").replace(
    "} else if (BASE) {",
    `} else if (req.cmd === "part") {
  const r = req.region;
  const url = BASE + "/part/" + req.book + "/" + req.image + ".jpg?r=" + [r.x, r.y, r.w, r.h].join(",");
  const got = await get(url, { save: "p" + req.image + ".jpg" });
  if (got.status !== 200) fail("part: HTTP " + got.status);
  image(req.image, "p" + req.image + ".jpg", url);
} else if (BASE) {`,
  );
  program(dir, code);
  // which book? none of its images came through the connector yet
  const which = await w.run(["fetch", "zkusebni", "--recordset", "B1", "--images", "1", "--crop", "0.5,0,0.5,0.5"]);
  assert.equal(which.code, 2);
  assert.match(which.err, /which book of zkusebni\? none of the images of B0001 came through it/);
  await w.ok(["fetch", "zkusebni", "5359", "--images", "1-2", "--recordset", "B1"]); // M0001, M0002 — 400×300
  assert.deepEqual((await w.ok(["media", "show", "B1:1", "--json"])).json.media.fetched, { connector: "zkusebni", book: "5359" });
  // too small to read: the view says how to fetch that place sharper
  const small = await w.ok(["media", "view", "B1:1", "--crop", "0.6,0.1,0.3,0.3"]);
  assert.match(small.out, /enlarged from 120×90 px of the scan[\s\S]*this part sharper from the archive \(one request\): strom fetch zkusebni --recordset B0001 --images 1 --crop 0\.6,0\.1,0\.3,0\.3/);
  assert.equal((await w.run(["fetch", "zkusebni", "--recordset", "B1", "--images", "1-2", "--crop", "0.5,0,0.5,0.5"])).code, 2, "a part is of one image");
  assert.equal((await w.run(["fetch", "zkusebni", "--recordset", "B1", "--images", "1", "--crop", "0,0,1,1"])).code, 2, "that is the whole image");
  assert.equal((await w.run(["fetch", "zkusebni", "--recordset", "B1", "--images", "1", "--half", "middle"])).code, 2);
  const dry = await w.ok(["fetch", "zkusebni", "--recordset", "B1", "--images", "1", "--half", "right", "--crop", "0,0,1,0.5", "--dry-run"]);
  assert.match(dry.out, /would fetch part 0\.5,0,0\.5,0\.5 of image 1 of book 5359 as a part of B0001:1 through zkusebni/);
  a.hits.length = 0;
  // the upper right quarter: --half right, and its upper half
  const r = await w.ok(["fetch", "zkusebni", "--recordset", "B1", "--images", "1", "--half", "right", "--crop", "0,0,1,0.5"]);
  assert.deepEqual(a.hits, ["/part/5359/1.jpg?r=0.5,0,0.5,0.5"], "one request, for the part asked");
  assert.match(r.out, /part: 1 request\(s\)/);
  assert.match(r.out, /part 0\.5,0,0\.5,0\.5 of image 1 of B0001 fetched and registered: M0003 · 400×300 px · 2\.0× the detail of the whole image/);
  assert.match(r.out, /look at it: strom media view B0001:1 --crop 0\.5,0,0\.5,0\.5/);
  // the image is still the whole image; the part is with it
  const show = (await w.ok(["media", "show", "B1:1", "--json"])).json;
  assert.equal(show.media.id, "M0001");
  assert.deepEqual(show.parts, ["M0003"]);
  assert.match((await w.ok(["media", "show", "M3"])).out, /M0003 part 0\.5,0,0\.5,0\.5 of image 1 of B0001/);
  assert.match((await w.ok(["media", "list"])).out, /M0001\s+B0001:1\s+400×300[\s\S]*M0003\s+B0001:1\s+part 0\.5,0,0\.5,0\.5\s+400×300[\s\S]*M0002\s+B0001:2/);
  // the same place, looked at again: from the part, with twice the pixels
  const sharp = await w.ok(["media", "view", "B1:1", "--crop", "0.6,0.1,0.3,0.3", "--json"]);
  assert.equal(sharp.json.from, "M0003");
  assert.deepEqual(sharp.json.region, { x: 80, y: 60, w: 240, h: 180 }, "the place, in the part's pixels");
  assert.match((await w.ok(["media", "view", "B1:1", "--crop", "0.6,0.1,0.3,0.3"])).out, /from M0003, a part of the image fetched sharper \(2\.0× the detail of the whole image\)/);
  // a place outside the part: the whole image
  assert.equal((await w.ok(["media", "view", "B1:1", "--crop", "0.1,0.5,0.3,0.3", "--json"])).json.from, undefined);
  // again: here already, nothing asked for; the whole image is not "registered" by its part
  const commits = spawnSync("git", ["rev-list", "--count", "HEAD"], { cwd: w.cwd, encoding: "utf8" }).stdout.trim();
  const again = await w.ok(["fetch", "zkusebni", "--recordset", "B1", "--images", "1", "--crop", "0.5,0,0.5,0.5"]);
  assert.match(again.out, /^part 0\.5,0,0\.5,0\.5 of image 1 of B0001: already here — M0003, the same part · no request\nlook at it: strom media view M0003\n/);
  const json = (await w.ok(["fetch", "zkusebni", "--recordset", "B1", "--images", "1", "--crop", "0.5,0,0.5,0.5", "--json"])).json;
  assert.deepEqual([json.held.id, json.held.how, json.added], ["M0003", "same", []]);
  // a part inside it, a little smaller (as an agent asks for one entry again): a new one would bring at most 800 ×
  // 0.5/0.45 = 889 px across the image, not 1.2× the 800 of M0003 — answered from M0003, its place in it, no request
  const inner = await w.ok(["fetch", "zkusebni", "--recordset", "B1", "--images", "1", "--crop", "0.52,0.02,0.45,0.45"]);
  assert.match(inner.out, /part 0\.52,0\.02,0\.45,0\.45 of image 1 of B0001: already here — M0003 \(part 0\.5,0,0\.5,0\.5, 800 px across the image · 2\.0× the detail of the whole image\) · no request\n {2}a part this size comes from zkusebni at most 889 px across the image \(1\.1× — no sharper\)\nlook at it: strom media view M0003 --crop 0\.04,0\.04,0\.9,0\.9 · a smaller part \(one entry\) may come sharper/);
  assert.equal(a.hits.length, 1, "no request");
  const fetches = fs.readFileSync(path.join(w.cwd, ".strom", "metrics", "fetch.jsonl"), "utf8").trim().split("\n").map((l) => JSON.parse(l));
  const held = fetches.at(-1)!;
  assert.deepEqual([held.cmd, held.img, held.requests, held.held, held.result, held.noSharper, held.hosts], ["part", 1, 0, "M0003", "held", undefined, undefined]);
  // nothing written: no new image, no commit
  assert.equal((await w.ok(["media", "list", "--json"])).json.total, 3);
  assert.equal(spawnSync("git", ["rev-list", "--count", "HEAD"], { cwd: w.cwd, encoding: "utf8" }).stdout.trim(), commits);
  // the view it names is that place of M0003
  assert.deepEqual((await w.ok(["media", "view", "M0003", "--crop", "0.04,0.04,0.9,0.9", "--json"])).json.region, { x: 16, y: 12, w: 360, h: 270 });
  // a much smaller part inside it may come sharper (at most 800 × 0.5/0.2 across the image): it would be asked for
  assert.match((await w.ok(["fetch", "zkusebni", "--recordset", "B1", "--images", "1", "--crop", "0.6,0.1,0.2,0.2", "--dry-run"])).out, /would fetch part 0\.6,0\.1,0\.2,0\.2 of image 1/);
  assert.match((await w.ok(["fetch", "zkusebni", "5359", "--images", "1", "--recordset", "B1"])).out, /images 1 of B0001 are registered already/);
  // tried while building it
  const t = await w.ok(["connector", "test", "zkusebni", "--fetch", "5359", "--images", "2", "--crop", "0,0.5,0.5,0.5"]);
  assert.match(t.out, /images \(1\): 2 part 0,0\.5,0\.5,0\.5=p2\.jpg \d+ B/);
  // a portal whose sharpest is the whole scan: its "part" is the image registered already — no clash, nothing new
  program(dir, code.replace('const url = BASE + "/part/"', 'const url = BASE + "/img/"').replace('url);\n} else if (BASE)', 'url, undefined, { x: 0, y: 0, w: 1, h: 1 });\n} else if (BASE)'));
  const whole = await w.ok(["fetch", "zkusebni", "--recordset", "B1", "--images", "2", "--crop", "0,0,0.5,0.5"]);
  assert.match(whole.out, /the portal's sharpest of image 2 is the whole scan, registered already: M0002 · 400×300 px — no part needed\nlook at it: strom media view B0001:2 --crop 0,0,0\.5,0\.5/);
  assert.doesNotMatch(whole.out, /⚠/);
  // a connector that gives another image than the one asked for is stopped
  program(dir, code.replace('image(req.image, "p"', 'image(req.image + 1, "p"'));
  const wrong = await w.run(["fetch", "zkusebni", "--recordset", "B1", "--images", "2", "--crop", "0,0,0.5,0.5"]);
  assert.match(wrong.out, /stopped: asked for a part of image 2, it gave image 3/);
  assert.equal((await w.ok(["media", "list", "--json"])).json.total, 3, "nothing registered");
  // a part no sharper than the image here is not asked for (N0233: halves of a book, some of whose scans held as much):
  // the parts of the book show the most a part of that size gets — image 3 here has as much already
  program(dir, code);
  const big = path.join(w.dir, "velký");
  fs.mkdirSync(big);
  fs.writeFileSync(path.join(big, "s0003.jpg"), encodeJpeg(blank(800, 600, 1, 180), 85));
  await w.ok(["media", "add", big, "--recordset", "B1"]); // M0004, image 3, 800×600
  a.hits.length = 0;
  const same = await w.ok(["fetch", "zkusebni", "--recordset", "B1", "--images", "3", "--half", "right"]);
  assert.match(same.out, /part 0\.5,0,0\.5,1 of image 3 of B0001: already here — M0004 \(the whole image, 800 px across\) · no request\n {2}a part this size comes from zkusebni at most 800 px across the image \(1\.0× — no sharper\)\nlook at it: strom media view B0001:3 --crop 0\.5,0,0\.5,1 · a smaller part \(one entry\) may come sharper/);
  assert.deepEqual(a.hits, [], "no request");
  // a smaller part may come sharper (the portal's size limit): asked for; so is a half of an image whose scan here is small
  await w.ok(["fetch", "zkusebni", "--recordset", "B1", "--images", "3", "--crop", "0.1,0.1,0.2,0.2"]);
  await w.ok(["fetch", "zkusebni", "--recordset", "B1", "--images", "2", "--half", "right"]);
  assert.equal(a.hits.length, 2);
  w.cleanup();
  await a.close();
});
