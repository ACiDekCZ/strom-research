// The bridge answers while it makes what takes long: the tree's file with new images (GET /tree.ged — each new excerpt
// decodes a whole scan) and one source's excerpts (GET /excerpt/<S>) are made on a thread of their own, so /status, which
// the Strom app asks with a short wait, answers meanwhile — never "the research does not answer" while the bridge works.
// Two asks for the same file wait for one making of it.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { World, hasGit } from "../helpers.ts";
import { decodeImage, encodeImage } from "../../src/image/index.ts";
import { resize } from "../../src/image/image.ts";

const opts = { skip: !hasGit, timeout: 240_000 };
const APP = "https://beta.stromapp.info";
const fixtures = path.join(import.meta.dirname, "..", "fixtures", "images");

function ask(url: string, ms?: number): Promise<{ status: number; headers: http.IncomingHttpHeaders; body: string }> {
  return new Promise((resolve, reject) => {
    const req = http.request(url, { agent: false, headers: { Origin: APP }, ...(ms ? { timeout: ms } : {}) }, (res) => {
      let text = "";
      res.setEncoding("utf8");
      res.on("data", (d) => (text += d));
      res.on("end", () => resolve({ status: res.statusCode ?? 0, headers: res.headers, body: text }));
    });
    req.on("timeout", () => req.destroy(new Error(`no answer in ${ms} ms`)));
    req.on("error", reject);
    req.end();
  });
}

/** /status asked over and over while `work` goes on, as the app asks it: the longest wait for an answer, and how many came. */
async function statusDuring<T>(url: string, work: Promise<T>): Promise<{ got: T; longest: number; answers: number }> {
  let done = false;
  let longest = 0;
  let answers = 0;
  const watch = (async () => {
    while (!done) {
      const asked = Date.now();
      // the app's own wait is 3 s: a longer one is no answer at all
      const r = await ask(`${url}/status?poll=1&app=3.19.0`, 5000).catch(() => undefined);
      longest = Math.max(longest, Date.now() - asked);
      if (r?.status === 200) answers++;
      await new Promise((ok) => setTimeout(ok, 100));
    }
  })();
  try {
    return { got: await work, longest, answers };
  } finally {
    done = true;
    await watch;
  }
}

test("the bridge answers /status while it makes the tree's file with new images and a source's excerpts", opts, async () => {
  const w = new World();
  try {
    await w.withTree("Lhotákovi");
    await w.ok(["recordset", "add", "Kniha N 1850-1870 Lhota", "--kinds", "baptism", "--places", "Lhota", "--years", "1850-1870"]);
    const scans = path.join(w.dir, "kniha");
    fs.mkdirSync(scans);
    // a big scan: every new excerpt decodes it whole
    fs.writeFileSync(path.join(scans, "s0001.jpg"), encodeImage(resize(decodeImage(fs.readFileSync(path.join(fixtures, "s0001.jpg"))), 4400, 3300), "jpeg"));
    await w.ok(["media", "add", scans, "--recordset", "B1", "--url", "https://archive.example.org/book/1"]);
    await w.ok(["research", "new", "Předci Lhotáka", "--new-person", "Jan /Lhoták/", "--sex", "M"]);
    for (let i = 0; i < 8; i++) {
      await w.ok(["source", "add", `Zápis Lhoták ${i + 1}`, "--clip", `B1:1@0.1,${(0.05 + i * 0.1).toFixed(2)},0.6,0.08`]);
      await w.ok(["event", "add", "P0001", "EVEN", "--label", `Zápis ${i + 1}`, "--cite", `S000${i + 1}`]);
    }
    // a source of three excerpts the app asks for at another quality: three new ones made on that ask
    await w.ok(["source", "add", "Zápis Lhoták přes stránky", ...[0, 1, 2].flatMap((i) => ["--clip", `B1:1@0.05,${(0.04 + i * 0.3).toFixed(2)},0.5,0.1`])]);
    await w.ok(["event", "add", "P0001", "EVEN", "--label", "Zápis 9", "--cite", "S0009"]);
    // the file made at once after the last commit
    Object.assign(w.env, { STROM_LIVE_QUIET_MS: "0", STROM_LIVE_QUIET_MAX_MS: "0" });
    const info = (await w.ok(["live", "start", "--json"])).json as { url: string };
    try {
      assert.equal((await ask(`${info.url}/status?app=3.19.0`)).status, 200);
      const excerpts = path.join(w.cwd, ".strom", "excerpts");
      const made = () => (fs.existsSync(excerpts) ? fs.readdirSync(excerpts) : []);
      assert.equal(made().length, 0, "no excerpt made yet");

      // the tree's file: eleven new excerpts (seconds each); asked twice at once — one making for both
      const started = Date.now();
      const ged = await statusDuring(info.url, Promise.all([ask(`${info.url}/tree.ged?app=3.19.0`), ask(`${info.url}/tree.ged?app=3.19.0`)]));
      const took = Date.now() - started;
      const [a, b] = ged.got;
      assert.ok(ged.answers >= 2, `/status answered while the file was made (${ged.answers} answers in ${took} ms)`);
      assert.ok(ged.longest < 1500, `/status answered within 1.5 s while the file was made (longest ${ged.longest} ms of ${took} ms)`);
      assert.deepEqual([a.status, b.status], [200, 200]);
      assert.equal(a.headers["x-strom-head"], b.headers["x-strom-head"]);
      assert.equal(a.body, b.body, "one file for both");
      // all of them when the computer makes them within the bridge's time for new images (a busy one: the rest next time)
      const objects = a.body.match(/^1 OBJE/gm)?.length ?? 0;
      assert.ok(objects >= 1 && objects <= 11, `the excerpts made in the file (${objects})`);
      assert.equal(made().filter((f) => /\.part\.jpg$/.test(f)).length, 0, "each kept whole");
      assert.ok(made().length >= objects, "each in the file kept");
      // made: given at once
      const again = await ask(`${info.url}/tree.ged?app=3.19.0`);
      assert.equal(again.body, a.body);

      // one source's excerpts at a quality not made yet: three new ones
      // (a busy computer: the rest at the next ask — 202, asked again)
      const one = await statusDuring(
        info.url,
        (async () => {
          for (let n = 0; ; n++) {
            const r = await ask(`${info.url}/excerpt/S0009?level=sharp&app=3.19.0`);
            if (r.status !== 202 || n >= 5) return r;
          }
        })(),
      );
      assert.equal(one.got.status, 200);
      const body = JSON.parse(one.got.body) as { source: string; level: string; excerpts: { dataUrl: string }[]; missing: string[] };
      assert.deepEqual([body.source, body.level, body.excerpts.length, body.missing], ["S0009", "sharp", 3, []]);
      assert.ok(body.excerpts.every((e) => e.dataUrl.startsWith("data:image/jpeg;base64,")));
      assert.ok(one.longest < 1500, `/status answered within 1.5 s while the excerpts were made (longest ${one.longest} ms)`);
      // what is refused by its address answers at once, as before
      assert.equal((await ask(`${info.url}/excerpt/P0001?app=3.19.0`)).status, 400);
      assert.equal((await ask(`${info.url}/excerpt/S9999?app=3.19.0`)).status, 404);
    } finally {
      await w.run(["live", "stop"]);
    }
  } finally {
    w.cleanup();
  }
});
