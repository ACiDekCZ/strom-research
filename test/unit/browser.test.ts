// The browser route's small parts: the names strom gives downloads, finding them
// again in a downloads folder (whatever form the folder gives the names back in),
// the line the script returns, the downloads folder of each system.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { botCheck, downloadsDir, fileBase, findDownload, parseResult } from "../../src/core/browser.ts";

test("download names: any script and accent kept, composed; what a file name cannot carry replaced", () => {
  assert.equal(fileBase("mza", "14984", 9, false), "strom-mza-14984-0009");
  assert.equal(fileBase("mza", "14984", 9, true), "strom-mza-14984-0009-part");
  assert.equal(fileBase("archiv", "Kníže/7:a", 12, false), "strom-archiv-Kníže_7_a-0012");
  assert.equal(fileBase("archiv", "Кни́га 3", 1, false), "strom-archiv-Кни́га_3-0001");
  assert.equal(fileBase("archiv", "Kníže", 1, false), "strom-archiv-Kníže-0001", "decomposed input is composed");
});

test("a download is found again: its name, or the browser's copy of it, composed or decomposed — never one still running", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "strom stažené "));
  const base = fileBase("archiv", "Kníže", 3, false);
  assert.deepEqual(findDownload(dir, base), { others: [] });
  fs.writeFileSync(path.join(dir, `${base}.jpg.crdownload`), "x");
  assert.deepEqual(findDownload(dir, base), { others: [], unfinished: true });
  const nfd = path.join(dir, `${base}.jpg`.normalize("NFD"));
  fs.writeFileSync(nfd, "x");
  const older = Date.now() / 1000 - 60;
  fs.utimesSync(nfd, older, older);
  const found = findDownload(dir, base);
  assert.ok(found.file && path.basename(found.file).normalize("NFC") === `${base}.jpg`, "a decomposed name is the same name");
  fs.writeFileSync(path.join(dir, `${base} (1).png`), "x");
  const both = findDownload(dir, base);
  assert.equal(path.basename(both.file!), `${base} (1).png`, "the newest copy");
  assert.equal(both.others.length, 1);
  // a longer name that begins the same is another image
  fs.writeFileSync(path.join(dir, `${base}0.jpg`), "x");
  fs.writeFileSync(path.join(dir, `${base}-part.jpg`), "x");
  assert.equal(findDownload(dir, base).others.length, 1);
  fs.rmSync(dir, { recursive: true, force: true });
});

test("the script's line: each image with its status (and size), a failure, whatever quotes the agent passed on", () => {
  assert.deepEqual(parseResult("strom-result 9:200:412918 10:403"), [{ n: 9, status: 200, bytes: 412918 }, { n: 10, status: 403 }]);
  assert.deepEqual(parseResult('"strom-result 1:200:5, 2:failed"'), [{ n: 1, status: 200, bytes: 5 }, { n: 2, failed: true }]);
  assert.deepEqual(parseResult("strom: this plan is over — run strom fetch again for a new one"), []);
});

test("the downloads folder: ~/Downloads, or the one the Linux desktop names in the user's language", () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "strom home "));
  assert.equal(downloadsDir({ HOME: home }, "darwin"), path.join(home, "Downloads"));
  assert.equal(downloadsDir({ HOME: home }, "linux"), path.join(home, "Downloads"));
  fs.mkdirSync(path.join(home, ".config"));
  fs.writeFileSync(path.join(home, ".config", "user-dirs.dirs"), 'XDG_DESKTOP_DIR="$HOME/Plocha"\nXDG_DOWNLOAD_DIR="$HOME/Stažené"\n');
  assert.equal(downloadsDir({ HOME: home }, "linux"), path.join(home, "Stažené"));
  fs.rmSync(home, { recursive: true, force: true });
});

test("a check whether a person is there is a small page with little else — the same script in a real page is not one", () => {
  const challenge = '<html><head><META NAME="robots" CONTENT="noindex,nofollow"><script src="/_Incapsula_Resource?SWJIYLWA=5074a744e2e3d891"></script></head><body></body></html>';
  assert.equal(botCheck(challenge), "Imperva (Incapsula)");
  const page = `<html><head><title>Szukaj w Archiwach</title><script src="/_Incapsula_Resource?SWJIYLWA=719d34d31c8e3a6e"></script></head><body>${"<p>Akta stanu cywilnego Urzędu Stanu Cywilnego w Gorzowie, sygnatura 66/33/0, skany 1–200 …</p>".repeat(300)}</body></html>`;
  assert.equal(botCheck(page), undefined, "a real page of a guarded portal");
  assert.equal(botCheck("<html><body>Request unsuccessful. Incapsula incident ID: 1234</body></html>"), "Imperva (Incapsula)");
  assert.equal(botCheck("<html><head><title>Just a moment...</title></head><body></body></html>"), "Cloudflare");
  assert.equal(botCheck(`<html><body>${"<p>Matriky farnosti, rok 1850, oddíl Z.</p>".repeat(500)}<script src="/cdn-cgi/challenge-platform/scripts/jsd/main.js"></script></body></html>`), undefined, "Cloudflare's beacon on a real page");
  assert.equal(botCheck("<html><body><form><div class='g-recaptcha'></div></form></body></html>"), "a captcha");
});
