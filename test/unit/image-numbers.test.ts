// The image number in the names of the files a person saves into a folder of the inbox (core/inboxwait.ts readNumbers,
// 1123): one group of digits; of several, the one that is an image asked for; the group that changes from file to file;
// a zero-padded counter; the last number before the extension (an image asked for, or any when which ones is not
// known). A screenshot's date and time is never an image's number; a name with two images asked for is not guessed;
// a number in a name is never overruled by the order (B0408).

import { test } from "node:test";
import assert from "node:assert/strict";
import { numberBookFiles, numberFiles, numbersForTask, personNumbers, readNumbers, type InboxState } from "../../src/core/inboxwait.ts";
import { problemWords } from "../../src/cli/menu-waiting.ts";
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
  const n = numberFiles(["/x/0012_0236.jpg", "/x/__0237.jpg"], [12, 236, 237], new Set(), "B0002");
  assert.ok("problem" in n && n.code === "inbox.count", JSON.stringify(n));
  assert.equal(n.params.ambiguous, "0012_0236.jpg");
  assert.match(n.problem, /0012_0236\.jpg: its name gives 12, 236, 2 of the images of B0002 asked for — not guessed/u);
});

test("a year after the image's number in a book's folder (K1.4): left lying, said what it needs — a folder of them by the number that changes", () => {
  const lone = numberBookFiles(["/x/33 1784.jpg"], "B0001");
  assert.ok("problem" in lone && lone.code === "inbox.unnamed", JSON.stringify(lone));
  const both = numberBookFiles(["/x/kniha_33_1784.jpg", "/x/40.jpg"], "B0001");
  assert.deepEqual(both, { files: ["/x/40.jpg"], numbers: [40], by: "names", left: 1 });
  assert.equal((numberFiles(["/x/33 1784.jpg"], undefined, new Set(), "B0001") as { code: string }).code, "inbox.unnamed");
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
  // a number in a name is never overruled by the order (B0408); a screenshot's date and time is no number: by order
  assert.equal((numberFiles(["/x/1.jpg"], [33], have, "B0408") as { code: string }).code, "inbox.count");
  assert.deepEqual(numberFiles(["/x/2026-11-04 10.07.jpg"], [7], have, "B0408"), { numbers: [7], by: "order" });
  assert.deepEqual(numberFiles(["/x/2026-11-04 10.07.jpg"], [11], have, "B0408"), { numbers: [11], by: "order" });
  // a portal's .jp2 counted back (× 10): as before
  assert.deepEqual(numberFiles(["/x/kniha-00090.jp2", "/x/kniha-00100.jp2"], [9, 10], have, "B0002", 10), { numbers: [9, 10], by: "names" });
  // what the person is told to do: the number in the name is enough
  const none = numberFiles(["/x/a.jpg", "/x/b.jpg", "/x/c.jpg"], [9, 10], have, "B0002");
  assert.ok("problem" in none);
  assert.match(none.problem, /name each by the number its viewer counts \(9\.jpg\) — a name with the number in it does too \(__09\.jpg\)/u);
});

test("an image sent for a task (the Strom app): the name read as a folder's file is", () => {
  assert.deepEqual(numbersForTask(1, { name: "Lhota_11__125.jpg", want: [25, 125], missing: [25, 125] }), { numbers: [125], by: "name" });
  assert.deepEqual(numbersForTask(1, { name: "__0236.JPEG", want: [236], missing: [236] }), { numbers: [236], by: "name" });
  // two images asked for in one name: not taken by the name — the one missing image, else asked which
  assert.deepEqual(numbersForTask(1, { name: "0012_0236.jpg", want: [12, 236], missing: [12, 236] }), { code: "waiting.image-unknown", missing: [12, 236] });
  // which images not known: as before, the next free number for a name with several numbers (K044)
  assert.deepEqual(numbersForTask(1, { name: "Lhota 1850 33.jpg", missing: [], next: 7 }), { numbers: [7], by: "order" });
});
