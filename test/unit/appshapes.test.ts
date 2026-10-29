// What the Strom app before 3.17.0-beta.9 makes of a period and an age (core/appshapes.ts), and from which app on it
// keeps them (APP_KEEPS_PERIODS).

import { test } from "node:test";
import assert from "node:assert/strict";
import { appAge, appDate, onlyAppShape } from "../../src/core/appshapes.ts";
import { APP_KEEPS_PERIODS, appKeepsPeriods } from "../../src/core/stromapp.ts";

test("a period as the app sends it back: a range, one end a qualifier; any other date as it is", () => {
  assert.equal(appDate("FROM 22 MAR 1871 TO 22 MAR 1882"), "BET 22 MAR 1871 AND 22 MAR 1882");
  assert.equal(appDate("FROM 1895"), "AFT 1895");
  assert.equal(appDate("TO 8 AUG 1893"), "BEF 8 AUG 1893");
  for (const d of ["BET 1871 AND 1882", "ABT 1850", "9 SEP 1866", "AFT 1895"]) assert.equal(appDate(d), d);
});

test("an age as the app sends it back: its units of nothing left out, one of nothing at all as it is", () => {
  assert.equal(appAge("0y 2m 26d"), "2m 26d");
  assert.equal(appAge("54y 0m 3d"), "54y 3d");
  assert.equal(appAge("27y 0m"), "27y");
  assert.equal(appAge("<1y"), "<1y");
  assert.equal(appAge("0y"), "0y");
  assert.equal(appAge("INFANT"), "INFANT");
});

test("an age of nothing at all in any of its units is the app's 0y", () => {
  for (const a of ["0y 0m 0d", "0m", "0d", "0y 0d", "0m 0d", "0y 0m", "00y 0d"]) assert.equal(appAge(a), "0y", a);
  assert.equal(appAge("<0m"), "<0y");
  assert.ok(onlyAppShape({ age: "0y 0m 0d" }, { age: "0y" }));
  assert.ok(onlyAppShape({ age: "0d" }, { age: "0y" }));
  assert.ok(!onlyAppShape({ age: "0y 0m 0d" }, { age: "1d" }));
});

test("the app keeps a period and an age as the research wrote them from 3.17.0-beta.9 on; no version said: it does not", () => {
  assert.equal(APP_KEEPS_PERIODS, "3.17.0-beta.9");
  for (const v of ["3.17.0-beta.9", "3.17.0-beta.10", "3.17.0-rc.1", "3.17.0", "3.17.1", "3.18.0-beta.1", "4.0.0", " 3.17.0 ", "3.17.0+a1b2"]) assert.ok(appKeepsPeriods(v), v);
  for (const v of [undefined, "", "1.0", "3.17", "3.16.2", "3.17.0-beta.8", "3.17.0-beta.1", "3.10.0", "neznámá"]) assert.ok(!appKeepsPeriods(v), String(v));
});

test("differs only as the app shapes it: the same period or age, not another value", () => {
  assert.ok(onlyAppShape({ date: "FROM 1871 TO 1882" }, { date: "BET 1871 AND 1882" }));
  assert.ok(onlyAppShape({ date: "9 SEP 1866", age: "0y 2m 26d" }, { date: "9 SEP 1866", age: "2m 26d" }));
  assert.ok(onlyAppShape({ ages: { P1: "25y 0m" } }, { ages: { P1: "25y" } }));
  assert.ok(!onlyAppShape({ date: "FROM 1871 TO 1882" }, { date: "FROM 1871 TO 1882" }), "the same is no shape");
  assert.ok(!onlyAppShape({ date: "FROM 1871 TO 1882" }, { date: "BET 1871 AND 1883" }));
  assert.ok(!onlyAppShape({ age: "0y 2m 26d" }, { age: "3m 26d" }));
});
