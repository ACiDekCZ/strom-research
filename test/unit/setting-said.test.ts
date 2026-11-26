// A setting of the research changed (strom config set … --for-tree, also from the Strom app) as the history says it to a
// person (/log, the app's Recent changes): in words in every language — never its key nor the English summary.

import { test } from "node:test";
import assert from "node:assert/strict";
import { settingSaid } from "../../src/core/changelog.ts";
import { catalog, PHRASES } from "../../src/core/phrases.ts";
import { SETTINGS } from "../../src/core/config.ts";

const TREE_SETTING_KEYS = SETTINGS.filter((s) => s.tree).map((s) => s.key);

test("a setting of the research in words: turned on or off, a number, a choice; back to its default", () => {
  // the question before a sort turned off in the Strom app (spec 102 U8): "sort.confirm" never said
  assert.equal(settingSaid("tree setting sort.confirm = no", "cs"), "Vypnuto ve výzkumu: Dotaz před tříděním materiálu");
  assert.equal(settingSaid("tree setting sort.confirm = ask", "cs"), "Zapnuto ve výzkumu: Dotaz před tříděním materiálu");
  assert.equal(settingSaid("tree setting sort.confirm = no", "en"), "Turned off in the research: Question before the material is sorted");
  assert.equal(settingSaid("tree setting sort.confirm = no", "de"), "In der Forschung ausgeschaltet: Rückfrage vor dem Sortieren des Materials");
  assert.equal(settingSaid("tree setting sort.confirm = no", "pl"), "Wyłączono w badaniu: Pytanie przed sortowaniem materiałów");
  assert.equal(settingSaid("tree setting intake.auto = on", "cs"), "Zapnuto ve výzkumu: Soubory poslané do výzkumu projde agent sám");
  assert.equal(settingSaid("tree setting stories = yes", "pl"), "Włączono w badaniu: Opowieści");
  assert.equal(settingSaid("tree setting books.minTasks = 4", "cs"), "Změněno nastavení výzkumu: Úkoly, po kterých se kniha nabídne ke stažení – 4");
  assert.equal(settingSaid("tree setting read.sourceTask = always", "de"), "Einstellung der Forschung geändert: Neue Lesung, die von der Abschrift abweicht – sofort eine Aufgabe");
  assert.equal(settingSaid("tree setting hypotheses.decide = agent", "cs"), "Změněno nastavení výzkumu: Kdo rozhoduje hypotézy – agent");
  assert.equal(settingSaid("tree setting census removed", "cs"), "Nastavení výzkumu vráceno na výchozí: Sčítání lidu");
  // a value not said in words (a model, a pace): the name alone
  assert.equal(settingSaid("tree setting queue.strategy = depth", "cs"), "Změněno nastavení výzkumu: Pořadí úkolů");
  assert.equal(settingSaid("tree setting run.minutes = abc", "cs"), "Změněno nastavení výzkumu: Minuty práce agenta na úkol");
  // a key strom does not name (a newer strom's): the key, as before; not a setting's summary: nothing
  assert.equal(settingSaid("tree setting some.future = 3", "cs"), "Změněno nastavení výzkumu: some.future");
  assert.equal(settingSaid("the research is an archive", "cs"), "");
});

test("every setting of a research has its name in every language; no line of a setting says its key", () => {
  const missing: string[] = [];
  for (const key of TREE_SETTING_KEYS) {
    const name = `log.setting.name.${key}`;
    if (!(name in PHRASES)) missing.push(`en ${key}`);
    for (const lang of ["cs", "de", "pl"]) if (!catalog(lang)[name as keyof ReturnType<typeof catalog>]) missing.push(`${lang} ${key}`);
  }
  assert.deepEqual(missing, []);
  for (const key of TREE_SETTING_KEYS) for (const lang of ["en", "cs", "de", "pl"]) assert.ok(!settingSaid(`tree setting ${key} = 1`, lang).includes(key), `${lang} ${key}`);
});
