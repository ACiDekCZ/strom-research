// The sources a note of which says something (a live run, 2026-11-25: 150× strom source show to find the sources whose
// address an index gave): strom source list --note <text> — each with that note, diacritics and script as typed.

import { test } from "node:test";
import assert from "node:assert/strict";
import { World, hasGit } from "../helpers.ts";

test("source list --note: only the sources a note of which says it, each with the note; NFD, Cyrillic", { skip: !hasGit }, async () => {
  const w = new World();
  try {
    await w.withTree();
    await w.ok(["source", "add", "Oddaní Lhota 1712", "--kind", "marriage"]);
    await w.ok(["source", "add", "Křty Lhota 1714", "--kind", "baptism"]);
    await w.ok(["source", "add", "Крещение 1720", "--kind", "baptism"]);
    await w.ok(["note", "add", "S0001", "Přečteno ze snímku."]);
    await w.ok(["note", "add", "S0001", "Adresu zápisu dal rejstřík Lhota 50, řádek 4."]);
    await w.ok(["note", "add", "S0003", "Адрес дал указатель (rejstřík)."]);
    await w.ok(["note", "add", "S0002", "Čteno naslepo."]);

    const r = await w.ok(["source", "list", "--note", "dal rejstrik", "--json"]);
    assert.deepEqual(r.json.sources.map((s: { id: string; note: string }) => [s.id, s.note]), [["S0001", "Adresu zápisu dal rejstřík Lhota 50, řádek 4."]]);
    // decomposed input, another script: the same
    const nfd = await w.ok(["source", "list", "--note", "rejstřík".normalize("NFD"), "--json"]);
    assert.deepEqual(nfd.json.sources.map((s: { id: string }) => s.id), ["S0001", "S0003"]);
    assert.deepEqual((await w.ok(["source", "list", "--note", "указатель", "--json"])).json.sources.map((s: { id: string }) => s.id), ["S0003"]);
    // with the other filters, and the note in the text
    assert.deepEqual((await w.ok(["source", "list", "--note", "rejstřík", "--kind", "baptism", "--json"])).json.sources.map((s: { id: string }) => s.id), ["S0003"]);
    const text = await w.ok(["source", "list", "--note", "rejstřík"]);
    assert.match(text.out, /S0001.*Adresu zápisu dal rejstřík Lhota 50/u);
    assert.doesNotMatch(text.out, /S0002/u);
    // without --note: no note said
    assert.equal("note" in (await w.ok(["source", "list", "--json"])).json.sources[0], false);
  } finally {
    w.cleanup();
  }
});
