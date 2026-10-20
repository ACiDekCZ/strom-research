// The images the Strom file leaves out, though the research has them: the file says so under each source and why
// (1 _STROM_IMG_OMITTED with 2 _STROM_CLIP for each excerpt left out — for an app that knows it), and the bridge gives
// them on request — one source's excerpts (/excerpt/<S>), and what the app would load to have them all (/excerpts?missing=1).

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { Tree } from "../../src/core/tree.ts";
import { clipMark, excerptSizes, INPUT_MARK, LEVELS, planExcerpts } from "../../src/core/excerpt.ts";
import { convertedDir } from "../../src/core/readable.ts";
import { inputPath } from "../../src/core/media.ts";
import { update } from "../../src/core/records.ts";
import { imageSize } from "../../src/image/index.ts";
import { validateGedcom } from "../../src/gedcom/validate.ts";
import type { Input, Media, Source } from "../../src/core/model.ts";
import { world } from "./excerpts.helpers.ts";
import { hasGit, type World } from "../helpers.ts";

const opts = { skip: !hasGit || process.platform === "win32" };
const APP = "https://beta.stromapp.info";

function ask(url: string, headers: Record<string, string> = { Origin: APP }): Promise<{ status: number; headers: http.IncomingHttpHeaders; body: string }> {
  return new Promise((resolve, reject) => {
    const req = http.request(url, { agent: false, headers }, (res) => {
      let text = "";
      res.setEncoding("utf8");
      res.on("data", (d) => (text += d));
      res.on("end", () => resolve({ status: res.statusCode ?? 0, headers: res.headers, body: text }));
    });
    req.on("error", reject);
    req.end();
  });
}

/**
 * A research of a father (cited S0001), an entry nobody cites (S0002), a stranger's (S0003, out of scope), and one on two
 * images, one of them no longer on this computer (S0004, cited) — the app's beta, which gets what is not out yet.
 */
async function research(): Promise<{ w: World; mark: (id: string, n?: number) => string }> {
  const w = await world();
  w.env.STROM_APP_URL = `${APP}/run/`;
  await w.ok(["research", "new", "Předci Jana", "--new-person", "Jan /Novák/", "--sex", "M"]); // P0001
  await w.ok(["person", "add", "Josef /Novák/", "--sex", "M"]); // P0002 father
  await w.ok(["person", "add", "Cizí /Člověk/", "--sex", "M"]); // P0003 linked to nobody
  await w.ok(["family", "add", "--partner", "P0002", "--child", "P0001"]);
  await w.ok(["source", "add", "Křest Josefa", "--clip", "B1:1@0.1,0.1,0.5,0.1"]);
  await w.ok(["event", "add", "P0002", "CHR", "--cite", "S0001"]);
  await w.ok(["source", "add", "Zápis převzatý", "--clip", "B1:2@0.1,0.1,0.8,0.3"]);
  await w.ok(["source", "add", "Zápis cizího", "--clip", "B1:3@0.1,0.1,0.5,0.1"]);
  await w.ok(["event", "add", "P0003", "BIRT", "--cite", "S0003"]);
  await w.ok(["source", "add", "Sňatek přes dvě strany", "--clip", "B1:1@0.1,0.5,0.5,0.1", "--clip", "B1:4@0.1,0.1,0.5,0.1"]);
  await w.ok(["event", "add", "P0001", "BIRT", "--cite", "S0004"]);
  const tree = Tree.open(w.cwd, w.env);
  // the fourth scan gone from this computer
  const m4 = tree.list<Media>("media").find((m) => m.image === 4)!;
  fs.rmSync(path.join(w.home, "shared", m4.file));
  const mark = (id: string, n = 0) => clipMark(tree.get<Source>(id)!.clips![n]!);
  return { w, mark };
}

const block = (ged: string, id: string) => ged.split(`0 @${id}@ SOUR`)[1]!.split("\n0 ")[0]!;

test("the Strom file says which images it leaves out and why — only for an app that knows it (its beta at once; the release once it is out)", opts, async () => {
  const { w, mark } = await research();
  const file = path.join(w.cwd, "output", "tree-strom.ged");
  await w.ok(["export", "gedcom"]);
  let ged = fs.readFileSync(file, "utf8");
  assert.equal(block(ged, "S0001").includes("_STROM_IMG_OMITTED"), false, "in the file: nothing to say");
  assert.match(block(ged, "S0001"), /1 OBJE/);
  assert.match(block(ged, "S0002"), new RegExp(`1 _STROM_IMG_OMITTED scope\\n2 _STROM_CLIP ${mark("S0002")}(\\n|$)`), "nobody cites it: out of the file's scope");
  assert.match(block(ged, "S0003"), new RegExp(`1 _STROM_IMG_OMITTED scope\\n2 _STROM_CLIP ${mark("S0003")}(\\n|$)`), "a stranger's: out of scope");
  // in the file but not whole: the excerpt whose scan is not here, alone
  const s4 = block(ged, "S0004");
  assert.match(s4, /1 OBJE/);
  assert.match(s4, new RegExp(`1 _STROM_IMG_OMITTED missing\\n2 _STROM_CLIP ${mark("S0004", 1)}(\\n|$)`));
  assert.doesNotMatch(s4, new RegExp(`_STROM_CLIP ${mark("S0004", 0)}\\n(?!2 _URL|2 FILE)`), "the one in the file is not named as left out");
  assert.deepEqual(validateGedcom(ged).filter((f) => f.level === "error"), []);
  // all of them in the file: nothing left out but what is not here
  await w.ok(["export", "gedcom", "--images-for", "all"]);
  ged = fs.readFileSync(file, "utf8");
  for (const id of ["S0001", "S0002", "S0003"]) assert.equal(block(ged, id).includes("_STROM_IMG_OMITTED"), false, id);
  assert.match(block(ged, "S0004"), /1 _STROM_IMG_OMITTED missing/);
  // the released app: nothing until it is out (an older one would list the tag as unknown)
  w.env.STROM_APP_URL = "https://stromapp.info/run/";
  await w.ok(["export", "gedcom"]);
  assert.doesNotMatch(fs.readFileSync(file, "utf8"), /_STROM_IMG_OMITTED/);
  // the standard file: never
  w.env.STROM_APP_URL = `${APP}/run/`;
  await w.ok(["export", "gedcom", "--for", "standard"]);
  assert.doesNotMatch(fs.readFileSync(path.join(w.cwd, "output", "tree.ged"), "utf8"), /_STROM_IMG_OMITTED/);
  w.cleanup();
});

test("over the limit: the source left out says limit; one whose images are none of them here says missing, out of scope or not", opts, async () => {
  const { w } = await research();
  const tree = Tree.open(w.cwd, w.env);
  const shared = path.join(w.home, "shared");
  const src = (id: string) => tree.get<Source>(id)!;
  const roomy = planExcerpts(tree, shared, { quality: "small", for: "family", maxBytes: 1e9 });
  const one = roomy.of(src("S0001")).reduce((n, e) => n + Math.ceil(e.jpeg.length / 3) * 4, 0);
  // room for the nearer one alone at the smallest level: the other goes, and says why
  const plan = planExcerpts(tree, shared, { quality: "small", for: "family", maxBytes: one });
  const left = ["S0001", "S0004"].map((id) => plan.omitted(src(id))?.why);
  assert.ok(left.includes("limit"), JSON.stringify(left));
  assert.deepEqual(plan.omitted(src("S0002")), { why: "scope", clips: [clipMark(src("S0002").clips![0]!)] });
  // the stranger's scan gone too: nothing the app could ask for
  const m3 = tree.list<Media>("media").find((m) => m.image === 3)!;
  fs.rmSync(path.join(shared, m3.file));
  assert.equal(planExcerpts(tree, shared, { quality: "normal", for: "family", maxBytes: 1e9 }).omitted(src("S0003"))?.why, "missing");
  w.cleanup();
});

test("the bridge gives the images the file left out: one source's (/excerpt/<S>), and what to load for all of them (/excerpts?missing=1)", opts, async () => {
  const { w, mark } = await research();
  // one excerpt made per ask at once (the rest later), to see the app ask again
  w.env.STROM_LIVE_EXCERPT_MS = "-1";
  try {
    const info = (await w.ok(["live", "start", "--json"])).json as { url: string };
    const status = JSON.parse((await ask(`${info.url}/status?app=3.12.0`)).body) as { features: string[] };
    assert.ok(status.features.includes("excerpt.get") && status.features.includes("log.sources"));
    const ged = (await ask(`${info.url}/tree.ged?app=3.12.0`)).body;
    assert.match(block(ged, "S0002"), /1 _STROM_IMG_OMITTED scope/);

    // what the app would load: the sources left out whose images are here, how many, about how large — nothing made
    type Left = { head: string; level: string; count: number; clips: number; bytes: number; estimated: boolean; sources: { source: string; why: string; clips: string[]; bytes: number; ready: boolean; estimated?: boolean }[] };
    let r = await ask(`${info.url}/excerpts?missing=1&app=3.12.0`);
    assert.equal(r.status, 200);
    assert.equal(r.headers["access-control-allow-origin"], APP);
    let list = JSON.parse(r.body) as Left;
    assert.deepEqual(list.sources.map((x) => [x.source, x.why, x.clips, x.ready]), [
      ["S0002", "scope", [mark("S0002")], false],
      ["S0003", "scope", [mark("S0003")], false],
    ]);
    assert.deepEqual([list.count, list.clips, list.level, list.estimated], [2, 2, "normal", true]);
    assert.ok(list.bytes > 10_000 && list.bytes === list.sources[0]!.bytes + list.sources[1]!.bytes, String(list.bytes));
    assert.equal(fs.existsSync(path.join(w.cwd, ".strom", "excerpts")) && fs.readdirSync(path.join(w.cwd, ".strom", "excerpts")).length, 2, "the two in the file only: the list made none");
    assert.equal((await ask(`${info.url}/excerpts?app=3.12.0`)).status, 400);

    // one source's excerpt, as the file would carry it, with where the entry is
    r = await ask(`${info.url}/excerpt/S0002?app=3.12.0`);
    assert.equal(r.status, 200, r.body);
    assert.equal(r.headers["access-control-allow-origin"], APP);
    const got = JSON.parse(r.body) as { source: string; level: string; missing: string[]; excerpts: { clip: string; sha: string; region: unknown; width: number; height: number; mime: string; bytes: number; url?: string; dataUrl: string }[] };
    assert.deepEqual([got.source, got.level, got.missing, got.excerpts.length], ["S0002", "normal", [], 1]);
    const e = got.excerpts[0]!;
    const tree = Tree.open(w.cwd, w.env);
    const clip = tree.get<Source>("S0002")!.clips![0]!;
    assert.equal(e.clip, mark("S0002"));
    assert.equal(e.sha, tree.get<Media>(clip.media)!.sha);
    assert.deepEqual(e.region, clip.region);
    assert.equal(e.url, "https://archive.example.org/book/1");
    const jpeg = Buffer.from(e.dataUrl.replace(/^data:image\/jpeg;base64,/, ""), "base64");
    assert.deepEqual(imageSize(jpeg), { width: e.width, height: e.height });
    assert.equal(e.bytes, jpeg.length);
    // made now, so the list says it exactly
    list = JSON.parse((await ask(`${info.url}/excerpts?missing=1&app=3.12.0`)).body) as Left;
    const s2 = list.sources.find((x) => x.source === "S0002")!;
    assert.deepEqual([s2.ready, s2.estimated, s2.bytes], [true, undefined, Math.ceil(jpeg.length / 3) * 4]);
    // a quality asked for
    const small = JSON.parse((await ask(`${info.url}/excerpt/S0002?level=small&app=3.12.0`)).body) as typeof got;
    assert.equal(small.level, "small");
    assert.ok(small.excerpts[0]!.bytes < e.bytes);
    // a level this strom does not know (a newer app's): the research's, said in the answer — no refusal
    r = await ask(`${info.url}/excerpt/S0002?level=huge&app=3.12.0`);
    assert.deepEqual([r.status, (JSON.parse(r.body) as typeof got).level, (JSON.parse(r.body) as typeof got).excerpts[0]!.bytes], [200, "normal", e.bytes]);

    // a source of two excerpts, one made per ask here: later (202), then all — and the one whose scan is gone, missing
    r = await ask(`${info.url}/excerpt/S0004?level=sharp&app=3.12.0`);
    assert.equal(r.status, 200, "one made, the other's scan not here: nothing later");
    const four = JSON.parse(r.body) as typeof got;
    assert.deepEqual([four.excerpts.map((x) => x.clip), four.missing], [[mark("S0004")], [mark("S0004", 1)]]);
    await w.ok(["source", "add", "Dvě strany", "--clip", "B1:2@0.1,0.5,0.5,0.1", "--clip", "B1:3@0.1,0.5,0.5,0.1"]); // S0005
    r = await ask(`${info.url}/excerpt/S0005?app=3.12.0`);
    assert.deepEqual([r.status, JSON.parse(r.body)], [202, { later: true, source: "S0005", made: 1, left: 1 }]);
    r = await ask(`${info.url}/excerpt/S0005?app=3.12.0`);
    assert.equal(r.status, 200);
    assert.equal((JSON.parse(r.body) as typeof got).excerpts.length, 2);
    // one of them alone
    const second = clipMark(Tree.open(w.cwd, w.env).get<Source>("S0005")!.clips![1]!);
    const alone = JSON.parse((await ask(`${info.url}/excerpt/S0005?clip=${second}&app=3.12.0`)).body) as typeof got;
    assert.deepEqual(alone.excerpts.map((x) => x.clip), [second]);

    // what the app cannot have: said with a code
    const code = async (url: string) => {
      const x = await ask(url);
      return [x.status, (JSON.parse(x.body) as { code: string }).code];
    };
    assert.deepEqual(await code(`${info.url}/excerpt/S9999?app=3.12.0`), [404, "source.unknown"]);
    assert.deepEqual(await code(`${info.url}/excerpt/P0001?app=3.12.0`), [400, "source.id"]);
    assert.deepEqual(await code(`${info.url}/excerpt/S0002?clip=c0000000000&app=3.12.0`), [404, "excerpt.unknown"]);
    assert.deepEqual(await code(`${info.url}/excerpt/S0002?clip=..%2F..&app=3.12.0`), [400, "excerpt.mark"]);
    update<Source>(Tree.open(w.cwd, w.env), "S0003", "source", (s) => ({ ...s, retracted: { at: new Date().toISOString(), reason: "test" } }), { op: "source.retract", summary: "S0003 retracted: test" });
    assert.deepEqual(await code(`${info.url}/excerpt/S0003?app=3.12.0`), [410, "source.retracted"]);
    // without the secret, or from a page that is no Strom app: nothing
    assert.equal((await ask(info.url.replace(/\/[0-9a-f]+$/, "/nope") + "/excerpt/S0002")).status, 404);
    assert.equal((await ask(`${info.url}/excerpt/S0002`, { Origin: "https://example.org" })).status, 404);
  } finally {
    await w.run(["live", "stop"]);
    w.cleanup();
  }
});

test("how large a HEIC photo's excerpt comes is estimated, the photo not converted to say it", opts, async () => {
  const w = await world();
  try {
    const photo = path.join(w.dir, "Fotka zápisu.heic".normalize("NFD"));
    // an ISO-BMFF header of a HEIC photo: enough to be known, nothing a converter makes a picture of
    fs.writeFileSync(photo, Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from("ftypheic\0\0\0\0mif1heic", "latin1"), Buffer.alloc(64)]));
    await w.ok(["intake", photo]);
    await w.ok(["source", "add", "Fotka zápisu", "--kind", "certificate", "--input", "I0001"]);
    const tree = Tree.open(w.cwd, w.env);
    const file = inputPath(tree, tree.get<Input>("I0001")!)!;
    assert.ok(fs.existsSync(file));
    const size = excerptSizes(tree, path.join(w.home, "shared"), tree.get<Source>("S0001")!, LEVELS[1]!);
    assert.deepEqual([size.clips, size.ready, size.estimated], [[INPUT_MARK], false, true]);
    assert.ok(size.bytes > 0);
    assert.equal(fs.existsSync(path.dirname(convertedDir(w.cwd, file))), false, "nothing converted");
  } finally {
    w.cleanup();
  }
});
