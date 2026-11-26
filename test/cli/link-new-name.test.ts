// strom-research://new&name=: the name the app suggests for a research of a copy of its tree (spec 139 K5.4) — one
// line, at most 120 characters, offered in the terminal for the person to keep or write over; without it nothing changes.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { World, hasGit } from "../helpers.ts";
import { linkText, parseLink } from "../../src/core/links.ts";
import { oneLineName } from "../../src/core/text.ts";
import { openInNewTerminal } from "../../src/core/shortcut.ts";

const token = "TGhvdGEtY29weS1vZi1hLXRyZWUtbmFtZS0wMDAx";

test("the link's name: decoded, NFC, one line without control characters, at most 120 whole characters; a link written again keeps it", () => {
  const link = parseLink(`strom-research://new?app=${token}&browser=chrome&name=Rodina%20Lhot%C3%A1k%C5%AF%20(kopie)`);
  assert.deepEqual(link, { action: "new", app: token, browser: "chrome", name: "Rodina Lhotáků (kopie)" });
  assert.deepEqual(parseLink(linkText(link as Exclude<typeof link, { action: "menu" }>)), link, "a new terminal gets the same name");
  // decomposed (NFD), a control character, a line break, a bidi mark, spaces: one line in NFC
  const nfd = encodeURIComponent("Rodina Lhota\u0301ku\u030a\u0007\n  (kopie)\u202e");
  assert.equal((parseLink(`strom-research://new?app=${token}&name=${nfd}`) as { name?: string }).name, "Rodina Lhotáků (kopie)");
  // another script, the joiners of a script and an emoji kept
  const other = "\u0421\u0435\u043c\u044c\u044f \u041b\u0433\u043e\u0442\u0430 \u{1f468}\u200d\u{1f469}\u200d\u{1f467} \u0645\u06cc\u200c\u062e\u0648\u0627\u0647\u0645";
  assert.equal((parseLink(`strom-research://new?app=${token}&name=${encodeURIComponent(other)}`) as { name?: string }).name, other);
  // nothing left, or none given: no name (the usual one is suggested)
  assert.deepEqual(parseLink(`strom-research://new?app=${token}&name=%20%07%0A`), { action: "new", app: token });
  assert.deepEqual(parseLink(`strom-research://new?app=${token}`), { action: "new", app: token });
  // too long: 120 characters as people see them, never half of one
  const long = `${"\u017d".repeat(118)}\u{1f468}\u200d\u{1f469}\u200d\u{1f467}e\u0301xyz`;
  const cut = (parseLink(`strom-research://new?app=${token}&name=${encodeURIComponent(long)}`) as { name?: string }).name!;
  assert.equal(cut, `${"\u017d".repeat(118)}\u{1f468}\u200d\u{1f469}\u200d\u{1f467}\u00e9`);
  assert.equal(oneLineName("Lhota\u0301", 120), "Lhot\u00e1");
  assert.doesNotMatch(cut, /[\ud800-\udbff](?![\udc00-\udfff])/u, "no half of a pair");
});

test("Windows: a link's name in the terminal's .cmd keeps its % (cmd reads %…% as a variable)", () => {
  const w = new World();
  const cwd = path.join(w.dir, "home");
  fs.mkdirSync(cwd, { recursive: true });
  const link = `strom-research://new?app=${token}&name=Rodina+Lhot%C3%A1k%C5%AF`;
  // no cmd.exe here: the file is written, its start fails quietly
  openInNewTerminal(["link", "open", link], cwd, { ...w.env, STROM_NO_OPEN: "", ComSpec: path.join(w.dir, "no-cmd.exe") }, "win32");
  const dir = path.join(cwd, ".strom", "open");
  const file = fs.readdirSync(dir).find((f) => f.endsWith(".cmd"))!;
  const text = fs.readFileSync(path.join(dir, file), "utf8");
  assert.ok(text.includes(`"strom-research://new?app=${token}&name=Rodina+Lhot%%C3%%A1k%%C5%%AF"`), text);
  w.cleanup();
});

test("strom-research://new&name= in the terminal: the app's name suggested (Enter keeps it); without it the usual one", { skip: !hasGit || process.platform === "win32" }, async () => {
  const w = new World();
  await w.ok(["setup", "--yes"]);
  // the name: Enter (suggested), the language: 0 back, the name: 0 — nothing made
  const named = await w.run(["link", "open", `strom-research://new?app=${token}&name=Rodina%20Lhot%C3%A1k%C5%AF%20(kopie)`], { tty: true, answers: ["", "0", "0", ""] });
  assert.match(named.out, /Název výzkumu \(rodina, např\. Novákovi\) \(Enter = Rodina Lhotáků \(kopie\)\)/u);
  assert.equal(fs.existsSync(w.treeDir("Rodina Lhotáků (kopie)")), false, "nothing made before the person goes on");
  const plain = await w.run(["link", "open", `strom-research://new?app=${token}`], { tty: true, answers: ["0", ""] });
  assert.doesNotMatch(plain.out, /Lhotáků/u);
  assert.match(plain.out, /Název výzkumu \(rodina, např\. Novákovi\) \(Enter = /u);
  w.cleanup();
});
