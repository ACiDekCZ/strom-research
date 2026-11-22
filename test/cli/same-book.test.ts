// One book of an archive registered twice is fetched twice (found live: B0389 was B0169, the same link — every one of
// its 148 images asked of the archive again, found by its hash to be the other book's only after). The same link, or
// images fetched from the same book of a connector, name the book the research has: --list says it and how to read
// it, recordset add refuses the link, and a fetch into the copy asks the archive nothing.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { opts, program, world } from "./connectors.helpers.ts";
import { fakeConnector } from "../helpers.ts";
import { bookUrlKey } from "../../src/core/samebook.ts";

const LINK = "https://archiv.example/d/5359/1";

test("a link is compared without its fragment, trailing slash or the case of its host", () => {
  assert.equal(bookUrlKey("HTTPS://Archiv.Example/d/5359/1/#img=3"), bookUrlKey(LINK));
  assert.notEqual(bookUrlKey("https://archiv.example/d/5359/2"), bookUrlKey(LINK));
  assert.notEqual(bookUrlKey("https://archiv.example/D/5359/1"), bookUrlKey(LINK), "the path keeps its case");
});

test("two books of the same link: refused, said where the book is, and nothing fetched", opts, async () => {
  const { w, a, dir } = await world();
  // the connector says the book's link, as a portal's catalogue does
  const code = fs.readFileSync(path.join(dir, "connector.ts"), "utf8");
  const listed = code.replace('else book(JSON.parse((await get(BASE + "/book/" + req.book)).text!));', `else book({ ...JSON.parse((await get(BASE + "/book/" + req.book)).text!), url: ${JSON.stringify(LINK)} });`);
  assert.notEqual(listed, code, "the test connector lists its book");
  program(dir, listed);

  await w.ok(["recordset", "add", "Týnec N 1784–1820", "--kinds", "baptism", "--url", LINK]); // B0001
  // the same link again (another spelling of it): refused, pointing to B0001, nothing written
  const again = await w.run(["recordset", "add", "Týnec, narození 1784–1820", "--url", "https://ARCHIV.example/d/5359/1/"]);
  assert.equal(again.code, 2, again.out + again.err);
  assert.match(again.err, /the book B0001 \(no images here yet\) of the research already/);
  assert.match(again.err, /strom read B0001 --images <from-to>/);
  assert.match(again.err, /--again "<why>"/);
  assert.equal((await w.ok(["recordset", "list", "--json"])).json.total, 1);

  // the book's images come into B0001
  await w.ok(["fetch", "zkusebni", "5359", "--images", "1-2", "--recordset", "B1"]);

  // --list: the book is the research's — read it there, never a recordset add
  a.hits.length = 0;
  const list = await w.ok(["fetch", "zkusebni", "5359", "--list"]);
  assert.match(list.out, /already in the research as B0001 \(2 images here\)/);
  assert.match(list.out, /read it: strom read B0001 --images <from-to>/);
  assert.match(list.out, /its images not here yet: strom fetch zkusebni 5359 --images <from-to> --recordset B0001/);
  assert.doesNotMatch(list.out, /strom recordset add/);

  // a book registered without a link, its images asked of the same book of the connector: the archive is asked nothing
  await w.ok(["recordset", "add", "Týnec N 1784–1820 (copy)", "--kinds", "baptism"]); // B0002
  a.hits.length = 0;
  const copy = await w.run(["fetch", "zkusebni", "5359", "--images", "1-3", "--recordset", "B2"]);
  assert.equal(copy.code, 2, copy.out + copy.err);
  assert.match(copy.err, /B0002 is the same book as B0001 \(2 images here\) \(its images came from book 5359 of zkusebni\) — nothing fetched/);
  assert.match(copy.err, /strom fetch zkusebni 5359 --images 1-3 --recordset B0001/);
  assert.deepEqual(a.hits, [], "no request to the archive");
  // into the inbox: the same
  const inbox = await w.run(["fetch", "zkusebni", "5359", "--images", "3"]);
  assert.equal(inbox.code, 2, inbox.out + inbox.err);
  assert.match(inbox.err, /book 5359 of zkusebni is B0001 \(2 images here\) in the research — nothing fetched/);
  assert.deepEqual(a.hits, []);

  // the book itself goes on: what it lacks is fetched into it
  await w.ok(["fetch", "zkusebni", "5359", "--images", "3", "--recordset", "B1"]);
  assert.ok(a.hits.some((h: string) => h.startsWith("/img/5359/3")));

  // another book at the same link, said why: registered and fetched into, the reason kept on it
  const second = await w.ok(["recordset", "add", "Týnec N 1784–1820, second film", "--url", LINK, "--again", "another film of the same volume", "--json"]);
  assert.deepEqual(second.json.recordset.duplicates, { of: ["B0001"], reason: "another film of the same volume" });
  await w.ok(["fetch", "zkusebni", "5359", "--images", "1", "--recordset", "B3"]);
  w.cleanup();
  await a.close();
});

test("a fetch into a copy goes on with --again and its reason, kept on the book", opts, async () => {
  const { w, a } = await world();
  await w.ok(["recordset", "add", "Týnec N 1784–1820", "--kinds", "baptism"]); // B0001
  await w.ok(["fetch", "zkusebni", "5359", "--images", "1", "--recordset", "B1"]);
  await w.ok(["recordset", "add", "Týnec Z 1784–1820", "--kinds", "burial"]); // B0002
  await w.ok(["fetch", "zkusebni", "5359", "--images", "2", "--recordset", "B2", "--again", "the burials are bound in the same volume"]);
  const b2 = (await w.ok(["recordset", "show", "B2", "--json"])).json.recordset;
  assert.deepEqual(b2.duplicates, { of: ["B0001"], reason: "the burials are bound in the same volume" });
  // asked once: the next fetch into it goes on by itself
  await w.ok(["fetch", "zkusebni", "5359", "--images", "3", "--recordset", "B2"]);
  w.cleanup();
  await a.close();
});

// Found live: a slip of the agent's (B… of another archive given with a book of this connector) fetched an image of one
// archive's book into a book of another archive, which was then "the same book" as the right one. Refused before any
// request, said where the images go; images taken back bind the book to nothing, so the slip is put right.
test("a fetch into a book of another archive, or into a book of another book of the connector: refused before any request; a slip taken back binds nothing", opts, async () => {
  const { w, a } = await world();
  await w.ok(["recordset", "add", "Lhota N 1784–1820", "--kinds", "baptism"]); // B0001
  await w.ok(["fetch", "zkusebni", "5359", "--images", "1", "--recordset", "B1"]);
  // a book of another archive (its link on another connector's portal): refused, the book of the research named, nothing asked
  await fakeConnector(w, "jiny-archiv");
  await w.ok(["recordset", "add", "Лгота, matrika Z 1784–1820", "--kinds", "burial", "--url", "https://archive.example.org/kniha/77"]); // B0002
  a.hits.length = 0;
  const elsewhere = await w.run(["fetch", "zkusebni", "5359", "--images", "2", "--recordset", "B2"]);
  assert.equal(elsewhere.code, 2, elsewhere.out + elsewhere.err);
  assert.match(elsewhere.err, /B0002 is not book 5359 of zkusebni: it is a book of archive\.example\.org, connector jiny-archiv's portal, not of zkusebni's \(127\.0\.0\.1\) — nothing fetched/u);
  assert.match(elsewhere.err, /book 5359 of zkusebni is B0001 \(1 image here\): strom fetch zkusebni 5359 --images 2 --recordset B0001/u);
  assert.match(elsewhere.err, /B0002's own images: strom fetch jiny-archiv <book> --images 2 --recordset B0002/u);
  assert.match(elsewhere.err, /--again "<why>"/u);
  assert.deepEqual(a.hits, [], "no request to the archive");
  assert.equal((await w.ok(["media", "list", "--json"])).json.media.filter((m: { recordset?: string }) => m.recordset === "B0002").length, 0);

  // a book whose images came from another book of the connector: refused alike
  a.hits.length = 0;
  const other = await w.run(["fetch", "zkusebni", "6000", "--images", "3", "--recordset", "B1"]);
  assert.equal(other.code, 2, other.out + other.err);
  assert.match(other.err, /B0001 is not book 6000 of zkusebni: its images came from book 5359 of zkusebni — nothing fetched/u);
  assert.match(other.err, /book 6000 of zkusebni is no book of the research yet: a book of its own — strom recordset add/u);
  assert.deepEqual(a.hits, []);

  // the slip as it happened live: another book's image fetched into a book with no images yet, then taken back
  await w.ok(["recordset", "add", "Lhota O 1790–1830", "--kinds", "marriage"]); // B0003
  await w.ok(["recordset", "add", "Lhota N 1821–1850", "--kinds", "baptism"]); // B0004
  await w.ok(["fetch", "zkusebni", "7000", "--images", "2", "--recordset", "B4"]);
  const slipped = (await w.ok(["media", "list", "--json"])).json.media.find((m: { recordset?: string }) => m.recordset === "B0004");
  await w.ok(["media", "retract", slipped.id, "--reason", "an image of another book, fetched here by a slip"]);
  // the image taken back binds B0004 to nothing: its own book is fetched into it, and book 7000 is no book of the research
  const own = await w.run(["fetch", "zkusebni", "--images", "3", "--recordset", "B4"]);
  assert.equal(own.code, 2, own.out + own.err);
  assert.match(own.err, /give the book: which book of zkusebni B0004 is, strom does not know/u);
  await w.ok(["fetch", "zkusebni", "8000", "--images", "3", "--recordset", "B4"]);
  const list = await w.ok(["fetch", "zkusebni", "7000", "--images", "2", "--recordset", "B3"]);
  assert.doesNotMatch(list.out + list.err, /B0004/u);
  w.cleanup();
  await a.close();
});
