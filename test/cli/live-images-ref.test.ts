// The tree's file for the Strom app with its images by reference (spec 071, feature ged.imagesByHash): GET
// /tree.ged?images=ref names each excerpt by the SHA-256 of its JPEG (2 FILE strom-image:<sha256> with 3 _MIME, _WIDTH,
// _HEIGHT, _BYTES) — the same images the whole file carries, byte for byte — and the app loads only those it does not
// have: one (GET /image/<sha256>, unchanging, kept by the browser) or several (POST /images, an answer of a bounded
// size, the rest asked again). An image the bridge does not have is 404: it never makes one because it is asked. The
// file by reference is a variant of its own (its own ETag, ?stale=1 too); the app that does not ask gets the file as
// always, an older app's parser skips a reference safely.

import { test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import zlib from "node:zlib";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { hasGit, type World } from "../helpers.ts";
import { world, stromRepo, tsx } from "./excerpts.helpers.ts";
import { imageSize } from "../../src/image/index.ts";
import { validateGedcom } from "../../src/gedcom/validate.ts";
import { BRIDGE_FEATURES, IMAGES_AT_ONCE } from "../../src/core/live.ts";
import { imageFile, imageStoreDir, putImage, readImage, sweepImages } from "../../src/core/liveimages.ts";

const opts = { skip: !hasGit || process.platform === "win32", timeout: 240_000 };
const APP = "https://beta.stromapp.info";

type Got = { status: number; headers: http.IncomingHttpHeaders; body: Buffer; text: string };
function ask(url: string, headers: Record<string, string> = {}, method = "GET", body?: string): Promise<Got> {
  return new Promise((resolve, reject) => {
    const req = http.request(url, { agent: false, method, headers: { Origin: APP, ...headers } }, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (d: Buffer) => chunks.push(d));
      res.on("end", () => {
        const all = Buffer.concat(chunks);
        resolve({ status: res.statusCode ?? 0, headers: res.headers, body: all, text: all.toString("utf8") });
      });
    });
    req.on("error", reject);
    req.end(body);
  });
}
const post = (url: string, body: unknown) => ask(url, { "Content-Type": "application/json" }, "POST", typeof body === "string" ? body : JSON.stringify(body));
const sha = (b: Uint8Array) => crypto.createHash("sha256").update(b).digest("hex");

/** Each excerpt of the whole file: its JPEG (the data URL joined from its CONC lines). */
function imagesIn(ged: string): Buffer[] {
  const out: Buffer[] = [];
  const lines = ged.split(/\r?\n/u);
  for (let i = 0; i < lines.length; i++) {
    const m = /^2 FILE data:image\/jpeg;base64,(.*)$/u.exec(lines[i]!);
    if (!m) continue;
    let b64 = m[1]!;
    while (lines[i + 1]?.startsWith("3 CONC ")) b64 += lines[++i]!.slice(7);
    out.push(Buffer.from(b64, "base64"));
  }
  return out;
}
/** Each reference of the file by reference: its hash and what it says of the image. */
function refsIn(ged: string): { sha: string; mime: string; width: number; height: number; bytes: number }[] {
  return [...ged.matchAll(/^2 FILE strom-image:([0-9a-f]{64})\n3 _MIME (\S+)\n3 _WIDTH (\d+)\n3 _HEIGHT (\d+)\n3 _BYTES (\d+)$/gmu)].map((m) => ({ sha: m[1]!, mime: m[2]!, width: Number(m[3]), height: Number(m[4]), bytes: Number(m[5]) }));
}
/** The whole file with each image put as its reference: what the file by reference must be, line for line. */
function asRefs(ged: string): string {
  const lines = ged.split("\n");
  const out: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const m = /^2 FILE data:image\/jpeg;base64,(.*)$/u.exec(lines[i]!);
    if (!m) {
      out.push(lines[i]!);
      continue;
    }
    let b64 = m[1]!;
    while (lines[i + 1]?.startsWith("3 CONC ")) b64 += lines[++i]!.slice(7);
    const jpeg = Buffer.from(b64, "base64");
    const size = imageSize(jpeg)!;
    out.push(`2 FILE strom-image:${sha(jpeg)}`, "3 _MIME image/jpeg", `3 _WIDTH ${size.width}`, `3 _HEIGHT ${size.height}`, `3 _BYTES ${jpeg.length}`);
  }
  return out.join("\n");
}

/** A father and a son, each baptism cited with its excerpt; the app's beta. */
async function research(): Promise<World> {
  const w = await world();
  Object.assign(w.env, { STROM_LIVE_POLL_MS: "200", STROM_LIVE_QUIET_MS: "300", STROM_APP_URL: `${APP}/run/` });
  await w.ok(["person", "add", "Jan /Lhoták/".normalize("NFD"), "--sex", "M"]);
  await w.ok(["person", "add", "Václav /Lhoták/", "--sex", "M"]);
  await w.ok(["family", "add", "--partner", "P0002", "--child", "P0001"]);
  await w.ok(["source", "add", "Křest Jana", "--clip", "B1:1@0.1,0.1,0.5,0.1"]);
  await w.ok(["event", "add", "P0001", "CHR", "--cite", "S0001"]);
  await w.ok(["source", "add", "Křest Václava", "--clip", "B1:2@0.1,0.1,0.8,0.3", "--clip", "B1:3@0.2,0.2,0.4,0.2"]);
  await w.ok(["event", "add", "P0002", "CHR", "--cite", "S0002"]);
  return w;
}

test("the file by reference names the same images as the whole file, byte for byte; the bridge gives them by hash, one or several, never one it does not have; its own ETag, ?stale=1 too; the app that does not ask gets the file as always", opts, async () => {
  const w = await research();
  // an answer of several images holds one at a time here: the rest come as `more`
  w.env.STROM_LIVE_IMAGES_BYTES = "1";
  const info = (await w.ok(["live", "start", "--json"])).json as { url: string };
  try {
    const st = JSON.parse((await ask(`${info.url}/status`)).text) as { features: string[] };
    assert.ok(st.features.includes("ged.imagesByHash"));
    assert.ok(BRIDGE_FEATURES.indexOf("ged.imagesByHash") > BRIDGE_FEATURES.indexOf("ged.etag"), "appended");

    const whole = await ask(`${info.url}/tree.ged`);
    const slim = await ask(`${info.url}/tree.ged?images=ref`);
    assert.deepEqual([whole.status, slim.status], [200, 200]);
    assert.deepEqual([whole.headers["x-strom-images"], slim.headers["x-strom-images"]], ["data", "ref"]);
    assert.match(String(slim.headers["access-control-expose-headers"]), /X-Strom-Images/u);
    assert.equal(Number(slim.headers["content-length"]), slim.body.length);
    assert.doesNotMatch(slim.text, /data:image/u);
    assert.ok(slim.body.length < whole.body.length);
    // the same images: three, in the same places, their hashes those of the whole file's bytes, and nothing else differs
    const images = imagesIn(whole.text);
    const refs = refsIn(slim.text);
    assert.equal(images.length, 3);
    assert.deepEqual(refs.map((r) => r.sha), images.map(sha));
    assert.deepEqual(refs.map((r) => r.bytes), images.map((b) => b.length));
    // (when each was made aside: the two made a moment apart)
    const asof = (ged: string) => ged.replace(/^1 _STROM_ASOF .*$/mu, "1 _STROM_ASOF");
    assert.equal(asof(slim.text), asof(asRefs(whole.text)), "the file by reference is the whole file with each image's reference in its place");
    // valid, and no word of the validator the whole file has not
    assert.deepEqual(validateGedcom(slim.text).filter((f) => f.level === "error"), []);
    assert.deepEqual(validateGedcom(slim.text).map((f) => f.message), validateGedcom(whole.text).map((f) => f.message));
    // its own ETag; the whole file's is the one it had before (the reference changed nothing for it)
    assert.notEqual(slim.headers.etag, whole.headers.etag);
    // packed for an app that takes it (a browser always does): the same file, its ETag the same; the whole file never
    const gz = await ask(`${info.url}/tree.ged?images=ref`, { "Accept-Encoding": "gzip, deflate, br" });
    assert.deepEqual([gz.status, gz.headers["content-encoding"], gz.headers.etag, Number(gz.headers["content-length"])], [200, "gzip", slim.headers.etag, gz.body.length]);
    assert.match(String(gz.headers.vary), /Origin/u);
    assert.match(String(gz.headers.vary), /Accept-Encoding/u);
    assert.deepEqual(zlib.gunzipSync(gz.body), slim.body);
    assert.equal((await ask(`${info.url}/tree.ged?images=ref`, { "Accept-Encoding": "gzip;q=0, identity" })).headers["content-encoding"], undefined, "refused: as it is");
    const wholeAsked = await ask(`${info.url}/tree.ged`, { "Accept-Encoding": "gzip" });
    assert.deepEqual([wholeAsked.headers["content-encoding"], wholeAsked.body.length], [undefined, whole.body.length], "the older app's file as always");
    const again = await ask(`${info.url}/tree.ged?images=ref`, { "If-None-Match": String(slim.headers.etag) });
    assert.deepEqual([again.status, again.body.length, again.headers["x-strom-images"]], [304, 0, "ref"]);
    assert.equal((await ask(`${info.url}/tree.ged`, { "If-None-Match": String(slim.headers.etag) })).status, 200, "the whole file is not the one by reference");
    // a value it does not know: the whole file, as always (it says so)
    const other = await ask(`${info.url}/tree.ged?images=thumbs`);
    assert.deepEqual([other.headers["x-strom-images"], other.headers.etag], ["data", whole.headers.etag]);

    // one image by its hash: its bytes, kept by the browser, its ETag the hash
    const first = refs[0]!;
    const one = await ask(`${info.url}/image/${first.sha}`);
    assert.equal(one.status, 200);
    assert.equal(sha(one.body), first.sha);
    assert.deepEqual([one.headers["content-type"], one.headers["cache-control"], one.headers.etag, one.headers["access-control-allow-origin"]], ["image/jpeg", "private, max-age=31536000, immutable", `"${first.sha}"`, APP]);
    assert.deepEqual(imageSize(one.body), { width: first.width, height: first.height });
    assert.equal((await ask(`${info.url}/image/${first.sha.toUpperCase()}`)).status, 200, "the hash in capitals too");
    const kept = await ask(`${info.url}/image/${first.sha}`, { "If-None-Match": `"${first.sha}"` });
    assert.deepEqual([kept.status, kept.body.length], [304, 0]);
    // never one it does not have, never made for asking
    const unknown = "0".repeat(64);
    const none = await ask(`${info.url}/image/${unknown}`);
    assert.deepEqual([none.status, JSON.parse(none.text).code, none.headers["cache-control"]], [404, "image.unknown", "no-store"]);
    assert.deepEqual([(await ask(`${info.url}/image/xyz`)).status, JSON.parse((await ask(`${info.url}/image/xyz`)).text).code], [400, "image.sha"]);
    assert.equal(fs.existsSync(imageFile(w.cwd, unknown)), false);

    // several, never packed though the app takes it (base64 of JPEGs packs little and slowly); one image neither
    const plainBatch = await ask(`${info.url}/images`, { "Content-Type": "application/json", "Accept-Encoding": "gzip, deflate, br" }, "POST", JSON.stringify({ images: [refs[0]!.sha] }));
    assert.deepEqual([plainBatch.status, plainBatch.headers["content-encoding"], Number(plainBatch.headers["content-length"])], [200, undefined, plainBatch.body.length]);
    assert.deepEqual((JSON.parse(plainBatch.text) as { images: { sha: string }[] }).images.map((x) => x.sha), [refs[0]!.sha]);
    assert.equal((await ask(`${info.url}/image/${refs[0]!.sha}`, { "Accept-Encoding": "gzip" })).headers["content-encoding"], undefined);

    // several: in the order asked, the one not here missing, the rest beyond the answer's size in `more`
    type Batch = { images: { sha: string; mime: string; bytes: number; data: string }[]; missing: string[]; more: string[] };
    const all = refs.map((r) => r.sha);
    let b = await post(`${info.url}/images`, { images: [all[1], unknown, all[0], all[2], all[1]] });
    assert.equal(b.status, 200);
    assert.equal(Number(b.headers["content-length"]), b.body.length, "an answer cut short is no answer");
    let batch = JSON.parse(b.text) as Batch;
    assert.deepEqual(batch.images.map((x) => x.sha), [all[1]]);
    assert.deepEqual([batch.missing, batch.more], [[unknown], [all[0], all[2]]]);
    for (const x of batch.images) assert.equal(sha(Buffer.from(x.data, "base64")), x.sha);
    const got = new Map(batch.images.map((x) => [x.sha, x]));
    for (let left = batch.more; left.length; left = batch.more) {
      batch = JSON.parse((await post(`${info.url}/images`, { images: left })).text) as Batch;
      assert.ok(batch.images.length >= 1, "each answer brings one at least");
      for (const x of batch.images) got.set(x.sha, x);
    }
    assert.deepEqual([...got.keys()].sort(), [...all].sort());
    for (const r of refs) assert.deepEqual([got.get(r.sha)!.mime, got.get(r.sha)!.bytes, sha(Buffer.from(got.get(r.sha)!.data, "base64"))], ["image/jpeg", r.bytes, r.sha]);
    // refused: not the body asked for, none, too many
    for (const body of ["nic", {}, { images: [] }, { images: ["abc"] }, { images: Array.from({ length: IMAGES_AT_ONCE + 1 }, () => unknown) }]) {
      const r = await post(`${info.url}/images`, body);
      assert.deepEqual([r.status, JSON.parse(r.text).code], [400, "images.body"], JSON.stringify(body).slice(0, 40));
    }
    // its preflight lets the app's page send it
    assert.equal((await ask(`${info.url}/images`, { "Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "content-type" }, "OPTIONS")).status, 204);

    // asked at once by several windows: one file made, the same for all
    const many = await Promise.all([1, 2, 3, 4].map(() => ask(`${info.url}/tree.ged?images=ref`)));
    assert.deepEqual(new Set(many.map((r) => `${r.status} ${r.headers.etag} ${r.text === slim.text}`)), new Set([`200 ${slim.headers.etag} true`]));

    // a commit: ?stale=1 the older file by reference at once (its images still here), then the new one with the same images
    await w.ok(["person", "add", "Marie /Lhotáková/", "--sex", "F"]);
    const older = await ask(`${info.url}/tree.ged?images=ref&stale=1`);
    assert.deepEqual([older.status, older.headers["x-strom-stale"], older.headers["x-strom-images"], older.headers.etag], [200, "1", "ref", slim.headers.etag]);
    for (const r of refsIn(older.text)) assert.equal((await ask(`${info.url}/image/${r.sha}`)).status, 200);
    const newer = await ask(`${info.url}/tree.ged?images=ref`);
    assert.match(newer.text, /Lhotáková/u);
    assert.notEqual(newer.headers.etag, slim.headers.etag);
    assert.deepEqual(refsIn(newer.text).map((r) => r.sha), all, "a fact changed: no new image to load");

    // an excerpt added: one new image, the others the same
    await w.ok(["source", "add", "Sňatek Václava", "--clip", "B1:1@0.1,0.5,0.6,0.2"]);
    await w.ok(["event", "add", "P0002", "OCCU", "--value", "Rolník", "--cite", "S0003"]);
    const added = refsIn((await ask(`${info.url}/tree.ged?images=ref`)).text).map((r) => r.sha);
    assert.deepEqual(added.filter((s) => !all.includes(s)).length, 1);
    assert.ok(all.every((s) => added.includes(s)));
  } finally {
    await w.run(["live", "stop"]);
    w.cleanup();
  }
});

test("an image kept by its hash: read back only while its bytes give it; what no kept file names goes after its hour, the rest stays", { skip: process.platform === "win32" }, async () => {
  const root = fs.mkdtempSync(path.join((await import("node:os")).tmpdir(), "strom-images-"));
  try {
    const a = Buffer.from("obrázek A – ěščřžýáíé".normalize("NFD"));
    const b = Buffer.from("obrázek B");
    const c = Buffer.from("obrázek C");
    const [sa, sb, sc] = [putImage(root, a), putImage(root, b), putImage(root, c)];
    assert.equal(sa, sha(a));
    assert.deepEqual(await readImage(root, sa), a);
    // written again: the same file, nothing doubled
    assert.equal(putImage(root, a), sa);
    // changed on disk: not given as its hash's, removed
    fs.writeFileSync(imageFile(root, sb), "jiný obsah");
    assert.equal(await readImage(root, sb), undefined);
    assert.equal(fs.existsSync(imageFile(root, sb)), false);
    assert.equal(await readImage(root, "../" + sa), undefined, "only a hash");
    // a part left by a thread that ended under it
    const part = `${imageFile(root, sa)}.123.part`;
    fs.writeFileSync(part, "x");
    // within the hour: nothing goes
    assert.equal(await sweepImages(root, new Set([sa])), 0);
    // after it: what no kept file names goes (the part too), the one named stays
    const later = Date.now() + 2 * 3600_000;
    assert.equal(await sweepImages(root, new Set([sa]), 3600_000, later), 1);
    assert.equal(fs.existsSync(imageFile(root, sc)), false);
    assert.equal(fs.existsSync(part), false);
    assert.deepEqual(await readImage(root, sa), a);
    assert.equal(await sweepImages(root, new Set(), 3600_000, later), 1);
    assert.deepEqual(fs.readdirSync(imageStoreDir(root)), [], "its folders gone with them");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("the Strom app's parser takes the file by reference safely: everything but the images, each skipped as an image it cannot read", { skip: !hasGit || process.platform === "win32" || !fs.existsSync(tsx), timeout: 180_000 }, async () => {
  const w = await research();
  const info = (await w.ok(["live", "start", "--json"])).json as { url: string };
  let slim: string;
  let whole: string;
  try {
    whole = (await ask(`${info.url}/tree.ged`)).text;
    slim = (await ask(`${info.url}/tree.ged?images=ref`)).text;
  } finally {
    await w.run(["live", "stop"]);
  }
  try {
    const script = path.join(w.dir, "rt.ts");
    fs.writeFileSync(
      script,
      `import fs from "node:fs";
import { parseGedcom, convertToStrom } from ${JSON.stringify(path.join(stromRepo, "src", "ged-parser.ts"))};
const out = process.argv.slice(2).map((f) => {
  const conv = convertToStrom(parseGedcom(fs.readFileSync(f, "utf8")));
  const sources = Object.values(conv.data.sources ?? {}) as any[];
  return { persons: Object.keys(conv.data.persons).length, sources: sources.map((s) => [s.title, s.excerpts?.length ?? 0]) };
});
console.log(JSON.stringify(out));
`,
    );
    fs.writeFileSync(path.join(w.dir, "whole.ged"), whole);
    fs.writeFileSync(path.join(w.dir, "slim.ged"), slim);
    const r = spawnSync(tsx, [script, path.join(w.dir, "whole.ged"), path.join(w.dir, "slim.ged")], { cwd: stromRepo, encoding: "utf8" });
    assert.equal(r.status, 0, r.stderr);
    const [a, b] = JSON.parse(r.stdout.trim().split("\n").pop()!) as { persons: number; sources: [string, number][] }[];
    assert.equal(b!.persons, a!.persons);
    assert.deepEqual(b!.sources.map((s) => s[0]), a!.sources.map((s) => s[0]));
    assert.deepEqual(a!.sources.map((s) => s[1]), [1, 2]);
    assert.deepEqual(b!.sources.map((s) => s[1]), [0, 0], "an image by reference is no image to an app that does not ask for it");
  } finally {
    w.cleanup();
  }
});
