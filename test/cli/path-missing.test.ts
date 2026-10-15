// A path that is not there is said in the research's language, the same words wherever it was given (intake, media
// add, an @file, grep --in) — found on Mac: "error: no such file or folder: …" in a Czech research. A program (--json)
// reads the English and the code.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { World, hasGit } from "../helpers.ts";

const opts = { skip: !hasGit };

const SAID = {
  en: {
    message: /^error: no such file or folder: /,
    hint: /^→ check the path \(relative paths start in the current folder\)$/m,
    grep: /^error: --in notes\/Šárka: no such file or folder in the research$/m,
    outside: /^error: --in .*výpis\.txt: a file outside the research — a saved listing of strom: run it again with its own filter$/mu,
    only: /^error: --in data: only inputs\/, notes\/, output\/ are searched \(data\/ through strom find, the records' commands\)$/m,
  },
  cs: {
    message: /^chyba: nenalezeno: /,
    hint: /^→ zkontrolovat cestu \(relativní cesta začíná v aktuální složce\)$/m,
    grep: /^chyba: --in notes\/Šárka: ve výzkumu nenalezeno$/m,
    outside: /^chyba: --in .*výpis\.txt: soubor mimo výzkum – uložený výpis příkazu strom: spustit znovu s vlastním filtrem$/mu,
    only: /^chyba: --in data: prohledávají se jen inputs\/, notes\/, output\/ \(data\/ přes strom find a příkazy záznamů\)$/m,
  },
  de: {
    message: /^Fehler: nicht gefunden: /,
    hint: /^→ den Pfad prüfen \(ein relativer Pfad beginnt im aktuellen Ordner\)$/m,
    grep: /^Fehler: --in notes\/Šárka: in der Forschung nicht gefunden$/m,
    outside: /^Fehler: --in .*výpis\.txt: eine Datei außerhalb der Forschung – eine gespeicherte Ausgabe von strom: mit dem eigenen Filter erneut ausführen$/mu,
    only: /^Fehler: --in data: durchsucht werden nur inputs\/, notes\/, output\/ \(data\/ über strom find und die Befehle der Einträge\)$/m,
  },
};

for (const lang of ["en", "cs", "de"] as const) {
  test(`a path not found is said in ${lang}: intake, media add, an @file, grep --in; English and its code for --json`, opts, async () => {
    const w = new World();
    w.env.LANG = { en: "en_US.UTF-8", cs: "cs_CZ.UTF-8", de: "de_DE.UTF-8" }[lang];
    await w.ok(["setup", "--yes"]);
    await w.ok(["init", "Dvořákovi"]);
    w.cwd = w.treeDir("Dvořákovi");
    // a name with accents, decomposed as a Mac's file dialog gives it: said as it was given
    const missing = path.join(w.dir, "Šárka-chybí".normalize("NFD"));
    for (const args of [["intake", missing], ["media", "add", missing, "--recordset", "B0001"], ["source", "add", "Křest", "--transcript", `@${missing}`]]) {
      const r = await w.run(args);
      assert.equal(r.code, 2, `${args.join(" ")}: ${r.err}`);
      const first = r.err.split("\n")[0]!;
      assert.match(first, SAID[lang].message, args.join(" "));
      assert.ok(first.includes(path.basename(missing)) || first.includes(path.basename(missing).normalize("NFC")), first);
      assert.match(r.err, SAID[lang].hint, args.join(" "));
      const json = await w.run([...args, "--json"]);
      const e = JSON.parse(json.out);
      assert.equal(e.code, "fs.missing", args.join(" "));
      assert.match(e.message, /^no such file or folder: /);
      assert.equal(e.hint, "check the path (relative paths start in the current folder)");
      assert.ok(e.params.path.endsWith(path.basename(missing)), e.params.path);
    }
    const grep = await w.run(["grep", "Karel", "--in", "notes/Šárka"]);
    assert.equal(grep.code, 2, grep.err);
    assert.match(grep.err, SAID[lang].grep);
    const grepJson = JSON.parse((await w.run(["grep", "Karel", "--in", "notes/Šárka", "--json"])).out);
    assert.equal(grepJson.code, "grep.in.missing");
    assert.equal(grepJson.message, "--in notes/Šárka: no such file or folder in the research");
    // grep --in a path that is not there at all — absolute or relative — is a path not found, never "a saved listing"
    for (const where of [path.join(w.dir, "neexistuje", "výpis.txt"), "neexistuje-Šárka"]) {
      const r = await w.run(["grep", "Karel", "--in", where]);
      assert.equal(r.code, 2, `${where}: ${r.err}`);
      assert.match(r.err, SAID[lang].message, where);
      assert.match(r.err, SAID[lang].hint, where);
      assert.doesNotMatch(r.err, /saved listing|recordset list/u, where);
      const e = JSON.parse((await w.run(["grep", "Karel", "--in", where, "--json"])).out);
      assert.equal(e.code, "fs.missing", where);
      assert.equal(e.params.path, where);
    }
    // a file outside the research that is there (a listing an agent's tool saved): said in the person's language, the
    // commands of its hint as they are
    const saved = path.join(w.dir, "tool-results", "výpis.txt");
    fs.mkdirSync(path.dirname(saved), { recursive: true });
    fs.writeFileSync(saved, "Karel\n");
    const outside = await w.run(["grep", "Karel", "--in", saved]);
    assert.equal(outside.code, 2, outside.err);
    assert.match(outside.err, SAID[lang].outside);
    assert.match(outside.err, /^→ strom recordset list Karel \| --place </m);
    const outsideJson = JSON.parse((await w.run(["grep", "Karel", "--in", saved, "--json"])).out);
    assert.equal(outsideJson.code, "grep.outside");
    assert.match(outsideJson.message, /: a file outside the research — a saved listing of strom: run it again with its own filter$/u);
    // a folder of the research that is not searched
    const only = await w.run(["grep", "Karel", "--in", "data"]);
    assert.equal(only.code, 2, only.err);
    assert.match(only.err, SAID[lang].only);
    assert.equal(JSON.parse((await w.run(["grep", "Karel", "--in", "data", "--json"])).out).code, "grep.in.only");
    w.cleanup();
  });
}
