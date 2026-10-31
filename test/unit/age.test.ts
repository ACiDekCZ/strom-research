// Ages as records give them, fractions of a year and of a month included.

import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeAge } from "../../src/core/age.ts";
import { parseAge } from "../../src/core/actions.ts";

const check = (cases: [string, string | undefined][]) => {
  for (const [raw, want] of cases) assert.equal(normalizeAge(raw), want, raw);
};

test("a fraction of a year becomes months: characters, slashes and words", () => {
  check([
    ["½", "6m"], ["1/2", "6m"], ["½ roku", "6m"], ["1/2 roku", "6m"], ["půl roku", "6m"], ["půl léta", "6m"],
    ["¼ roku", "3m"], ["čtvrt roku", "3m"], ["¾ roku", "9m"], ["3/4 léta", "9m"], ["⅓ roku", "4m"], ["⅔ roku", "8m"],
    ["1½ roku", "1y 6m"], ["1 1/2 roku", "1y 6m"], ["1 ½ roku", "1y 6m"], ["jeden a půl roku", "1y 6m"], ["1 a půl roku", "1y 6m"],
    ["rok a půl", "1y 6m"], ["1 rok a půl", "1y 6m"], ["2½ let", "2y 6m"], ["27 let a ½ roku", "27y 6m"], ["5/12 roku", "5m"],
    ["1/2 r.", "6m"], ["<½ roku", "<6m"], ["aetatis ½ anni", "6m"],
  ]);
});

test("the same in German, English and other languages the parser knows", () => {
  check([
    ["½ Jahr", "6m"], ["halbes Jahr", "6m"], ["ein halbes Jahr", "6m"], ["¼ Jahr", "3m"], ["1½ Jahre", "1y 6m"],
    ["anderthalb Jahre", "1y 6m"], ["1 Jahr und ein halbes", "1y 6m"], ["Vierteljahr", "3m"], ["ein Vierteljahr", "3m"], ["Halbjahr", "6m"],
    ["half a year", "6m"], ["½ year", "6m"], ["1½ years", "1y 6m"], ["a quarter year", "3m"], ["a quarter of a year", "3m"],
    ["a year and a half", "1y 6m"], ["pół roku", "6m"], ["un an et demi", "1y 6m"],
  ]);
});

test("a fraction of a month or a week becomes days", () => {
  check([["½ měsíce", "15d"], ["1½ Monate", "1m 15d"], ["1 a půl měsíce", "1m 15d"], ["½ týdne", "4d"], ["1.5 měsíce", "1m 15d"]]);
});

test("fractions as Unicode writes them, decomposed letters and capitals", () => {
  check([
    ["1⁄2 roku", "6m"], ["1 ⁄ 2 roku", "6m"], ["¹⁄₂ roku", "6m"], ["1¹⁄₂ roku", "1y 6m"], ["½roku", "6m"],
    ["půl roku".normalize("NFD"), "6m"], ["čtvrt léta".normalize("NFD"), "3m"], ["½ měsíce".normalize("NFD"), "15d"],
    ["PŮL ROKU", "6m"], ["Půl Roku", "6m"], ["HALBES JAHR", "6m"],
  ]);
});

test("what is no fraction stays unread", () => {
  check([["27/3", undefined], ["3/2 roku", undefined], ["sedm", undefined], ["полгода", undefined], ["½ abc", undefined]]);
});

test("the ages read before read the same", () => {
  check([
    ["27", "27y"], ["27 let", "27y"], ["aged 27 years", "27y"], ["annorum 28", "28y"], ["aetatis 61 annorum", "61y"],
    ["27 let a 3 měsíce", "27y 3m"], ["27 a 3 měsíce", "27y 3m"], ["3 Monate", "3m"], ["2 týdny", "14d"], ["2 Wochen 3 Tage", "17d"],
    ["<1y", "<1y"], [">60y", ">60y"], ["infant", "INFANT"], ["kojenec", "INFANT"], ["mrtvě narozené", "STILLBORN"], ["Säugling", "INFANT"],
    ["27.99", "28y"], ["27.5", "27y 6m"], ["27,5", "27y 6m"], ["27y 3m", "27y 3m"], ["3m 12d", "3m 12d"], ["asi 40 let", "40y"],
    ["ca. 40", "40y"], ["40 lat", "40y"], ["40 ans", "40y"], ["1 rok 2 měsíce", "1y 2m"], ["ve věku 27 let", "27y"], ["27, 3 m", "27y 3m"],
    ["5 weeks", "35d"], ["2 roky", "2y"], ["im Alter von 50 Jahren", "50y"], ["3 mies.", "3m"], ["50 anni", "50y"], ["1000", undefined],
  ]);
});

test("the hint of an age not read shows a fraction", () => {
  assert.equal(parseAge("½ roku"), "6m");
  assert.throws(() => parseAge("sedm"), (e: Error & { hint?: string }) => /cannot read the age "sedm"/.test(e.message) && /½ roku/.test(String(e.hint)));
});

test("a number's leading zeros go, as the Strom app sends the age back: 05y is 5y; a unit of nothing stays", () => {
  check([
    ["05y", "5y"],
    ["027y 03m", "27y 3m"],
    [">05y", ">5y"],
    ["0y 02m 026d", "0y 2m 26d"],
    ["0y", "0y"],
    ["00d", "0d"],
    ["5y", "5y"],
  ]);
});
