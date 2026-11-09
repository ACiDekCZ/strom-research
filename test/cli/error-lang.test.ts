// strom error in every language strom is shown in (spec 070 K1.3): the README is strom's own text in the person's
// language and stays readable — only the values put into it (the note, an error) are masked — while every name,
// place, path with the user's name, e-mail and token stays a code, whatever the language, the form (NFD) or the script.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { World, hasGit } from "../helpers.ts";
import { nowhere, zipTexts } from "./error.helpers.ts";
import { ui, type UIKey } from "../../src/cli/ui.ts";

const opts = { skip: !hasGit };

const CODE = /‹[0-9a-f]{5}›/g;

/** The README's own sentences: what a person reads, word for word in their language. */
const OWN: UIKey[] = ["ui.report.readme.title", "ui.report.readme.intro", "ui.report.readme.areas", "ui.report.readme.notrim", "ui.report.readme.note", "ui.report.readme.files", "ui.report.where.unknown"];

/** The made-up research's words none of which may go out (common Czech surnames that are ordinary words among them). */
const DATA = ["Kroutil", "Kroutilová", "Kroutilovi", "Čáslav", "Čáslavi", "Lhoták", "Кроутил", "Пётр", "jiří.kroutil", "kroutil@example.org", "TOKEN7Q2W9E4R5T6Y", "Nový", "Černá", "Veselý", "Kovář", "Krejčí"];

for (const lang of ["cs", "de", "pl"]) {
  test(`a report in ${lang}: the README's own sentences readable, every name, place, path, e-mail and token a code; the count of codes the report's own`, opts, async () => {
    const w = new World();
    w.env.LANG = { cs: "cs_CZ.UTF-8", de: "de_DE.UTF-8", pl: "pl_PL.UTF-8" }[lang]!;
    const home = path.join(w.dir, "jkroutil");
    fs.mkdirSync(path.join(home, "Downloads"), { recursive: true });
    Object.assign(w.env, { HOME: home, USERPROFILE: home });
    const root = await w.withTree("Kroutilovi");
    await w.ok(["person", "add", "Jiří /Kroutil/", "--sex", "M", "--born", "1850", "--born-place", "Čáslav"]);
    await w.ok(["person", "add", "Anežka /Kroutilová/".normalize("NFD"), "--sex", "F", "--born-place", "Lhota"]);
    await w.ok(["person", "add", "Пётр /Кроутил/", "--sex", "M"]);
    for (const n of ["Josef /Nový/", "Marie /Černá/", "Karel /Veselý/", "Pavel /Kovář/", "Petr /Krejčí/", "Václav /Lhoták/"]) await w.ok(["person", "add", n, "--sex", "U"]);
    // the titles of the research's sources are written in the person's language: every word strom's README says too
    const words = OWN.flatMap((k) => ui(lang, k).replace(/[‹›]/g, "").split(/\s+/));
    for (let i = 0; i < words.length; i += 25) await w.ok(["source", "add", words.slice(i, i + 25).join(" "), "--kind", "other"]);
    const now = new Date().toISOString();
    fs.appendFileSync(
      path.join(root, ".strom", "live.log"),
      [
        `${now} [123] cannot read /Users/jiří.kroutil/Documents/Strom/Kroutilovi/notes/Kroutil.md: EACCES`,
        `${now} [123] sync from Jiří Kroutil of Čáslav failed at http://127.0.0.1:4711/TOKEN7Q2W9E4R5T6Y/tree.ged`,
        `${now} [123] mail to kroutil@example.org refused for ${"Kroutilová".normalize("NFD")}, Пётр Кроутил, Josef Nový, Marie Černá, Karel Veselý, Pavel Kovář, Petr Krejčí`,
      ].join("\n") + "\n",
    );
    const r = await w.ok(["error", "--yes", "--json", "--note", `Jiří Kroutil z Čáslavi, Пётр Кроутил a ${"Kroutilová".normalize("NFD")}, viz /Users/jiří.kroutil/Desktop a kroutil@example.org`]);
    const texts = zipTexts(r.json.file as string);
    const readme = texts["README.txt"]!;
    const json = texts["report.json"]!;

    // nothing of the research's people goes out, in any language
    assert.deepEqual(nowhere(texts, DATA), []);
    // strom's own sentences as the person reads them
    for (const k of OWN) assert.ok(readme.includes(ui(lang, k)), `${lang}: README says "${ui(lang, k)}"\n${readme}`);
    // a code only where a value of the person's stands: their note (the intro's ‹a1b2c› is its example of one)
    for (const line of readme.split(/\r?\n/)) if (line.match(CODE) && !OWN.some((k) => ui(lang, k) === line)) assert.match(line, /^ {2}> /, `${lang}: a code in strom's own words: ${line}`);
    assert.match(readme, /^ {2}> ‹[0-9a-f]{5}› ‹[0-9a-f]{5}› /m, "the note's names masked");
    // the count the README says: the codes report.json carries, no more
    const [before, after] = ui(lang, "ui.report.readme.masked", { n: 987654 }).split("987654") as [string, string];
    const line = readme.split(/\r?\n/).find((l) => l.startsWith(before) && l.endsWith(after));
    assert.ok(line, `${lang}: the README says how many codes`);
    const said = Number(line.slice(before.length, line.length - after.length));
    assert.equal(said, (json.match(CODE) ?? []).length, `${lang}: the count is report.json's codes`);
    w.cleanup();
  });
}
