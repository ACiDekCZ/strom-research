// The image number in the names of the files a person saves into a folder of the inbox (core/inboxwait.ts readNumbers,
// 1123): one group of digits; of several, the one that is an image asked for; the group that changes from file to file;
// a zero-padded counter; the last number before the extension (an image asked for, or any when which ones is not
// known). A screenshot's date and time is never an image's number; a name with two images asked for is not guessed;
// a number in a name is never overruled by the order (B0408).

import { test } from "node:test";
import assert from "node:assert/strict";
import { numberBookFiles, numberFiles, numbersForTask, personNumbers, readNumbers, type InboxState } from "../../src/core/inboxwait.ts";
import { laterWords, problemWords } from "../../src/cli/menu-waiting.ts";
import { imageNumbers } from "../../src/core/media.ts";
import { entriesOf } from "../../src/core/scannames.ts";
import { translator } from "../../src/cli/menu-parts.ts";

const one = (name: string, want?: number[]) => personNumbers([`/x/${name}`], want)[0];

test("a name with the image's number: one group, an image asked for among other numbers, the last number before the extension", () => {
  const table: [string, number[] | undefined, number | undefined][] = [
    ["236.jpg", [236], 236],
    ["__0236.jpg", [236], 236],
    ["0236.jpg", [236], 236],
    ["IMG_0236.jpg", [236], 236],
    ["snímek 236.jpg", [236], 236],
    ["snímek 236.jpg".normalize("NFD"), [236], 236],
    ["236 (1).jpg", [236], 236],
    ["CZ-SOA_1784_0236.jpg", [236], 236],
    ["fond12_kniha3_236.jpg", [236], 236],
    ["0012_0236.jpg", [236], 236],
    // which images not known (a site the person looks at, a book's folder): the last number before the extension
    ["fond12_kniha3_236.jpg", undefined, 236],
    ["0012_0236.jpg", undefined, 236],
    ["Lhota 1850 33.jpg", undefined, 33],
    // a year after the image's number, which images not known: not guessed — the file lies there and says why (took
    // 1784 for the image before)
    ["33 1784.jpg", undefined, undefined],
    ["kniha_33_1784.jpg", undefined, undefined],
    ["1784 33.jpg", undefined, 33],
    ["Lhota 1784-1830 33.jpg", undefined, 33],
    // of images asked for, as before: the one asked for
    ["33 1784.jpg", [33], 33],
    ["33 1784.jpg", [1784], 1784],
    ["kniha_33_1784.jpg", [33], 33],
    // the portal pads to three digits only: from image 100 on no zero leads (Milan's pattern, 1123)
    ["Lhota_11__025.jpg", [25], 25],
    ["Lhota_11__125.jpg", [125], 125],
    ["Lhota_11__1025.jpg", [1025], 1025],
    ["Lhota_11__125.jpg", undefined, 125],
    // the last number only when it is an image asked for
    ["Lhota 1850 33.jpg", [40], undefined],
    // a screenshot's date and time: never, whatever is asked for
    ["2026-11-04 10.07.jpg", [7], undefined],
    ["2026-11-04 10.07.jpg", [11], undefined],
    ["2026-11-04 10.07.jpg", undefined, undefined],
    ["Snímek obrazovky 2026-11-04 v 10.07.23.png".normalize("NFD"), [23], undefined],
    ["Screenshot 17.11.2026 10-21.png", [21], undefined],
    ["Screenshot_20261117-102147.png", [102147], undefined],
    // digits of another script: not read as a number
    ["٢٣٦.jpg", [236], undefined],
    ["Снимок 236.jpg", [236], 236],
  ];
  for (const [name, want, n] of table) assert.equal(one(name, want), n, `${name} (want ${want ?? "—"})`);
});

test("every extension a person's save gives: the number is read the same", () => {
  for (const ext of [".jpg", ".jpeg", ".JPG", ".JPEG", ".PNG", ".png", ".tif", ".TIFF"]) {
    assert.equal(one(`__0236${ext}`, [236]), 236, ext);
    assert.equal(one(`Lhota_11__125${ext}`, [125]), 125, ext);
  }
});

test("two images asked for in one name are not guessed: said with the file", () => {
  const r = readNumbers(["/x/0012_0236.jpg"], [12, 236]);
  assert.deepEqual(r.numbers, [undefined]);
  assert.deepEqual(r.ambiguous, [{ file: "/x/0012_0236.jpg", numbers: [12, 236] }]);
  const f = readNumbers(["/x/fond12_kniha3_236.jpg"], [12, 236]);
  assert.deepEqual(f.ambiguous.map((a) => a.numbers), [[12, 236]]);
  const n = numberFiles(["/x/0012_0236.jpg"], [12, 236, 237], new Set(), "B0002");
  assert.ok("problem" in n && n.code === "inbox.count", JSON.stringify(n));
  assert.equal(n.params.ambiguous, "0012_0236.jpg");
  assert.match(n.problem, /0012_0236\.jpg: its name gives 12, 236, 2 of the images of B0002 asked for — not guessed/u);
  // beside other files it lies there, said, never holding back the rest (spec 141 K1.1; nothing was taken before)
  assert.deepEqual(numberFiles(["/x/0012_0236.jpg", "/x/__0237.jpg"], [12, 236, 237], new Set(), "B0002"), {
    numbers: [237],
    by: "names",
    files: ["/x/__0237.jpg"],
    left: [{ file: "/x/0012_0236.jpg", why: "two" }],
  });
});

test("a year after the image's number in a book's folder (K1.4): left lying — a folder of them by the number that changes", () => {
  assert.deepEqual(numberBookFiles(["/x/33 1784.jpg"], "B0001"), { files: [], numbers: [], by: "names", left: 1 });
  const both = numberBookFiles(["/x/kniha_33_1784.jpg", "/x/40.jpg"], "B0001");
  assert.deepEqual(both, { files: ["/x/40.jpg"], numbers: [40], by: "names", left: 1 });
  // a task's folder, which images not known: never guessed — in the folder's order once it settled (spec 141 K1.3)
  assert.deepEqual(numberFiles(["/x/33 1784.jpg"], undefined, new Set(), "B0001"), { later: true });
  assert.deepEqual(numberFiles(["/x/33 1784.jpg"], undefined, new Set([4]), "B0001", undefined, { quiet: true }), { numbers: [5], by: "folder" });
  // the year the same in every name, the image's number changing: that one
  assert.deepEqual(personNumbers(["/x/33 1784.jpg", "/x/34 1784.jpg"]), [33, 34]);
});

test("the person's words of a name with two images asked for name one of them, never another image (236.jpg before)", () => {
  const n = numberFiles(["/x/0005_0007.jpg"], [5, 7], new Set(), "B0002");
  assert.ok("problem" in n, JSON.stringify(n));
  assert.equal(n.params.n, "7");
  assert.match(n.problem, /\(7\.jpg\)/u);
  const st: InboxState = { dir: "/x", folder: "x", recordset: "B0002", have: 0, want: 2, missing: [5, 7], lying: 1, next: 1, problem: n.problem, problemCode: "inbox.count", ambiguous: "0005_0007.jpg", ambiguousNumber: 7 };
  for (const lang of ["en", "cs", "de", "pl"]) {
    const words = problemWords(translator(lang), st);
    assert.match(words, /0005_0007\.jpg/u, lang);
    assert.match(words, /\(7\.jpg\)/u, lang);
    assert.doesNotMatch(words, /236/u, lang);
  }
});

test("a folder whose number changes its place among the others: the group that changes from file to file", () => {
  // the portal's names padded to three digits: 025, 026, then 125, 1025 — the change is the image's number
  const files = ["/x/Lhota_11__025.jpg", "/x/Lhota_11__026.jpg", "/x/Lhota_11__125.jpg", "/x/Lhota_11__1025.jpg"];
  assert.deepEqual(personNumbers(files), [25, 26, 125, 1025]);
  assert.deepEqual(numberBookFiles(files, "B0002"), { files, numbers: [25, 26, 125, 1025], by: "names", left: 0 });
  // two numbers changing (a year and the image): the last of them
  assert.deepEqual(personNumbers(["/x/Lhota 1850 33.jpg", "/x/Lhota 1851 34.jpg"]), [33, 34]);
  // of images asked for: each one of them, else not by the place
  assert.deepEqual(personNumbers(["/x/a_7_10.jpg", "/x/a_8_11.jpg"], [40]), [undefined, undefined]);
});

test("the folder of a waiting task with the portal's names (Lhota_11__025, __125): taken by the names — failed before 1123", () => {
  const have = new Set<number>();
  assert.deepEqual(numberFiles(["/x/Lhota_11__025.jpg", "/x/Lhota_11__125.jpg"], [25, 125], have, "B0002"), { numbers: [25, 125], by: "names" });
  assert.deepEqual(numberFiles(["/x/Lhota_11__125.jpg"], [125], have, "B0002"), { numbers: [125], by: "names" });
  assert.deepEqual(numberFiles(["/x/__0236.jpg", "/x/__0237.JPEG"], [236, 237], have, "B0002"), { numbers: [236, 237], by: "names" });
  assert.deepEqual(numberFiles(["/x/fond12_kniha3_236.jpg", "/x/fond12_kniha3_237.jpg"], [236, 237], have, "B0002"), { numbers: [236, 237], by: "names" });
  // a number in a name is never overruled by the order (B0408), nor registered when it is none of the images asked for:
  // in the folder's order once it settled, the task back to tell it by its content (spec 141 K1.3; "rename" before); a
  // screenshot's date and time is no number: by order
  assert.deepEqual(numberFiles(["/x/1.jpg"], [33], have, "B0408"), { later: true });
  assert.deepEqual(numberFiles(["/x/1.jpg"], [33], have, "B0408", undefined, { quiet: true }), { numbers: [34], by: "folder" });
  assert.deepEqual(numberFiles(["/x/2026-11-04 10.07.jpg"], [7], have, "B0408"), { numbers: [7], by: "order" });
  assert.deepEqual(numberFiles(["/x/2026-11-04 10.07.jpg"], [11], have, "B0408"), { numbers: [11], by: "order" });
  // a portal's .jp2 counted back (× 10): as before
  assert.deepEqual(numberFiles(["/x/kniha-00090.jp2", "/x/kniha-00100.jp2"], [9, 10], have, "B0002", 10), { numbers: [9, 10], by: "names" });
  // no number in any name, not as many as missing: never put onto the images asked for — in the folder's order once
  // it settled, above every image registered or asked for (spec 141 K1.3; "rename them" before)
  assert.deepEqual(numberFiles(["/x/a.jpg", "/x/b.jpg", "/x/c.jpg"], [9, 10], have, "B0002"), { later: true });
  assert.deepEqual(numberFiles(["/x/a.jpg", "/x/b.jpg", "/x/c.jpg"], [9, 10], new Set([12]), "B0002", undefined, { quiet: true }), { numbers: [13, 14, 15], by: "folder" });
});

test("an image sent for a task (the Strom app): the name read as a folder's file is", () => {
  assert.deepEqual(numbersForTask(1, { name: "Lhota_11__125.jpg", want: [25, 125], missing: [25, 125] }), { numbers: [125], by: "name" });
  assert.deepEqual(numbersForTask(1, { name: "__0236.JPEG", want: [236], missing: [236] }), { numbers: [236], by: "name" });
  // two images asked for in one name: not taken by the name — the one missing image, else asked which
  assert.deepEqual(numbersForTask(1, { name: "0012_0236.jpg", want: [12, 236], missing: [12, 236] }), { code: "waiting.image-unknown", missing: [12, 236] });
  // which images not known: as before, the next free number for a name with several numbers (K044)
  assert.deepEqual(numbersForTask(1, { name: "Lhota 1850 33.jpg", missing: [], next: 7 }), { numbers: [7], by: "order" });
});

test("a name that is a range of the entries on a scan (001-004.jpg) is never one image's number (spec 141 K1.2)", () => {
  for (const name of ["001-004.jpg", "005–007.jpg", "5 - 7.JPG", "001-004 2.jpg", "001-004 (1).jpg", "001-004 copy.jpg"]) {
    assert.deepEqual(entriesOf(`/x/${name}`), name.startsWith("5") ? { from: 5, to: 7 } : name.startsWith("005") ? { from: 5, to: 7 } : { from: 1, to: 4 }, name);
    assert.equal(one(name, [4, 7]), undefined, `${name} (want 4, 7)`);
    assert.equal(one(name), undefined, name);
  }
  // part of a longer name, or not rising: no range — read as before
  assert.equal(entriesOf("/x/Lhota 1784-1830 33.jpg"), undefined);
  assert.equal(entriesOf("/x/2026-11-04 10.07.jpg"), undefined);
  assert.equal(entriesOf("/x/007-003.jpg"), undefined);
  assert.equal(one("Lhota 1784-1830 33.jpg"), 33);
  // strom media add: the group that changes is not read off a range either (4, 7 before)
  assert.deepEqual(imageNumbers(["/x/000.jpg", "/x/001-004.jpg", "/x/005-007.jpg"]), [0, undefined, undefined]);
  assert.deepEqual(imageNumbers(["/x/001-004.jpg", "/x/40.jpg", "/x/41.jpg"]), [undefined, 40, 41]);
  assert.deepEqual(imageNumbers(["/x/kniha-00090.jpg", "/x/kniha-00100.jpg"]), [90, 100]);
});

test("a folder named by the entries on its scans: in the folder's order once it settled, the entries with each (K1.2, K1.3)", () => {
  const files = ["/x/000.jpg", "/x/001-004.jpg", "/x/005–007.jpg"];
  // the images asked for are the viewer's: never put onto them blindly
  assert.deepEqual(numberFiles(files, [1, 2, 3, 4, 5, 6, 7, 8], new Set(), "B0002"), { later: true });
  // settled: every file, above the images registered or asked for
  assert.deepEqual(numberFiles(files, [1, 2, 3, 4, 5, 6, 7, 8], new Set([2]), "B0002", undefined, { quiet: true }), {
    numbers: [9, 10, 11],
    by: "folder",
    entries: [undefined, { from: 1, to: 4 }, { from: 5, to: 7 }],
  });
  // a book's own folder (no task waiting on it): a range lies there, never taken by the order
  const book = numberBookFiles(["/x/001-004.jpg", "/x/40.jpg"], "B0002");
  assert.deepEqual(book, { files: ["/x/40.jpg"], numbers: [40], by: "names", left: 1 });
});

test("a file whose name gives 0 (000.jpg) or no number lies there, never holding back the rest (spec 141 K1.1)", () => {
  const files = ["/x/000.jpg", "/x/001.jpg", "/x/002.jpg", "/x/003.jpg"];
  // nothing was taken before: "the names give 0, 1–3"
  assert.deepEqual(numberFiles(files, [1, 2, 3], new Set(), "B0002"), {
    numbers: [1, 2, 3],
    by: "names",
    files: ["/x/001.jpg", "/x/002.jpg", "/x/003.jpg"],
    left: [{ file: "/x/000.jpg", why: "zero" }],
  });
  assert.deepEqual(numberFiles(["/x/40.jpg", "/x/obálka.jpg".normalize("NFD")], [40], new Set(), "B0002"), {
    numbers: [40],
    by: "names",
    files: ["/x/40.jpg"],
    left: [{ file: "/x/obálka.jpg".normalize("NFD"), why: "none" }],
  });
  // 000.jpg alone: nothing to take, said
  assert.deepEqual(numberFiles(["/x/000.jpg"], [1], new Set(), "B0002"), { numbers: [], by: "names", files: [], left: [{ file: "/x/000.jpg", why: "zero" }] });
  // screenshots as many as the images missing beside a 000.jpg: by their order, 000.jpg lying
  assert.deepEqual(numberFiles(["/x/000.jpg", "/x/2026-11-04 10.07.jpg", "/x/2026-11-04 10.08.jpg"], [5, 6], new Set(), "B0002"), {
    numbers: [5, 6],
    by: "order",
    files: ["/x/2026-11-04 10.07.jpg", "/x/2026-11-04 10.08.jpg"],
    left: [{ file: "/x/000.jpg", why: "zero" }],
  });
});

test("what waits says when files named otherwise are taken, and which files lie there (inboxState fields)", () => {
  const st: InboxState = { dir: "/x", folder: "x", recordset: "B0002", have: 0, want: 8, missing: [1, 2, 3, 4, 5, 6, 7, 8], lying: 3, next: 1, waitsUntil: "2026-11-24T12:20:00.000Z", left: ["000.jpg"] };
  for (const lang of ["en", "cs", "de", "pl"]) {
    const words = laterWords(translator(lang), st);
    assert.match(words, /000\.jpg/u, lang);
    assert.doesNotMatch(words, /rename|přejmen|umbenenn|zmień nazw/iu, lang);
  }
});

test("the person's example of a name with the number in it is padded as a viewer's files are: __0009.jpg, never __09.jpg", () => {
  const st: InboxState = { dir: "/x", folder: "x", recordset: "B0002", have: 0, want: 2, missing: [9, 10], lying: 3, next: 1, problemCode: "inbox.count" };
  for (const lang of ["en", "cs", "de", "pl"]) {
    const words = problemWords(translator(lang), st);
    assert.match(words, /__0009\.jpg/u, lang);
    assert.doesNotMatch(words, /__09\.jpg/u, lang);
  }
});
