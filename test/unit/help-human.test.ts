// strom help --human: every command only a person runs is listed with its sentence, in every language, said
// impersonally (the Polish infinitive, never the imperative).

import { test } from "node:test";
import assert from "node:assert/strict";
import "../../src/commands/index.ts";
import { commands } from "../../src/cli/registry.ts";
import { HUMAN_COMMANDS } from "../../src/cli/help.ts";
import { UI } from "../../src/cli/ui.ts";
import { catalog } from "../../src/core/phrases.ts";

test("strom help --human lists every command only a person runs, each with its sentence in English, Czech, German and Polish", () => {
  const personOnly = commands().filter((c) => c.person).map((c) => c.path.join(" "));
  assert.ok(personOnly.length > 10, personOnly.join(", "));
  assert.deepEqual(personOnly.filter((n) => !HUMAN_COMMANDS.includes(n)), [], "a person's command missing from strom help --human");
  for (const n of HUMAN_COMMANDS) {
    const key = `ui.help.cmd.${n.replace(/ /g, ".")}`;
    assert.ok(key in UI, `${key} (en)`);
    for (const lang of ["cs", "de", "pl"]) assert.ok(catalog(lang)[key], `${key} (${lang})`);
  }
});

test("the Polish help speaks in the infinitive, never to the person in the imperative", () => {
  const imperative = /^(Pozwól|Zakończ|Zainstaluj|Wyłącz|Włącz|Usuń|Sprawdź|Spakuj|Dodaj|Zwolnij|Znajdź|Zmień|Zatwierdź|Zapisz|Załóż|Zachowaj|Wznów|Wstrzymaj|Wczytaj|Umieść|Rozstrzygnij|Rozpakuj|Pracuj|Poproś|Pokaż|Otwórz|Odrzuć|Odpowiedz|Odczytaj)(?![\p{L}\p{M}])/u;
  const pl = catalog("pl");
  const said = Object.keys(pl).filter((k) => k.startsWith("ui.help.") && imperative.test(pl[k]!));
  assert.deepEqual(said, []);
});
