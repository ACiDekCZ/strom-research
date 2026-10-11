// What a fetch asks of an archive, counted one way: the requests that go to its host — a page asked first, a redirect
// followed, a retry — as the host's hourly counter takes them. The run says that number, and the estimate before the
// next run goes by it (found live: a part reported 2 requests, the estimate said 1, the counter took 3).

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { opts, program, world } from "./connectors.helpers.ts";
import { readJsonFile } from "../helpers.ts";
import { hostState } from "../../src/core/net.ts";

test("a part fetched with a page asked first and a redirect: the run says the requests the host's counter took, and the next estimate says them too", opts, async () => {
  const { w, a, dir } = await world();
  const manifest = path.join(dir, "connector.json");
  fs.writeFileSync(manifest, JSON.stringify({ ...readJsonFile(manifest), can: [...readJsonFile(manifest).can, "part"] }));
  // the portal's viewer page first (it redirects), then the part itself: the connector asks 2, the host gets 3
  const code = fs.readFileSync(path.join(dir, "connector.ts"), "utf8").replace(
    "} else if (BASE) {",
    `} else if (req.cmd === "part") {
  await get(BASE + "/login");
  const r = req.region;
  const url = BASE + "/part/" + req.book + "/" + req.image + ".jpg?r=" + [r.x, r.y, r.w, r.h].join(",");
  const got = await get(url, { save: "p" + req.image + ".jpg" });
  if (got.status !== 200) fail("part: HTTP " + got.status);
  image(req.image, "p" + req.image + ".jpg", url);
} else if (BASE) {`,
  );
  program(dir, code);
  await w.ok(["recordset", "add", "Týnec N 1784–1820", "--kinds", "baptism"]); // B0001
  await w.ok(["fetch", "zkusebni", "5359", "--images", "1-2", "--recordset", "B1"]);
  const net = path.join(w.home, "shared", "net");
  const counted = () => hostState(net, "127.0.0.1").recent.length;
  const before = counted();
  a.hits.length = 0;
  const first = await w.ok(["fetch", "zkusebni", "--recordset", "B1", "--images", "1", "--crop", "0.5,0,0.5,0.5"]);
  assert.deepEqual(a.hits, ["/login", "/search-page", "/part/5359/1.jpg?r=0.5,0,0.5,0.5"]);
  assert.equal(counted() - before, 3, "the hourly counter takes each request to the host");
  assert.match(first.out, /^part: 3 request\(s\) \(the connector asked 2; 1 more: redirects or retries\)$/m);
  // nothing measured of parts before: at least one
  assert.match(first.err, /a part of image 1 through zkusebni: at least 1 request\(s\) to 127\.0\.0\.1/);
  // the next part: as the last one went
  const second = await w.ok(["fetch", "zkusebni", "--recordset", "B1", "--images", "2", "--crop", "0,0.5,0.5,0.5"]);
  assert.match(second.err, /a part of image 2 through zkusebni: about 3 request\(s\) to 127\.0\.0\.1 \(3 a part, as its last runs here went\), about \d+ s at its pace/);
  assert.match(second.out, /^part: 3 request\(s\)/m);
  assert.equal(counted() - before, 6);
  // whole images: one request each, as before — the estimate says at least that many
  a.hits.length = 0;
  const whole = await w.ok(["fetch", "zkusebni", "5359", "--images", "3", "--recordset", "B1"]);
  assert.match(whole.err, /1 image\(s\) through zkusebni: at least 1 request\(s\) to 127\.0\.0\.1/);
  assert.match(whole.out, /^fetch: 1 request\(s\)$/m);
  assert.equal(counted() - before, 7);
  w.cleanup();
  await a.close();
});
