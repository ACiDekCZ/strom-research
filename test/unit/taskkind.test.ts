// The kind of a task as the person sees the work (spec 065 K7.4): one kind each, the first that fits.

import { test } from "node:test";
import assert from "node:assert/strict";
import { KINDS_065, kindCounts, kindMatches, parseTaskKind, TASK_KINDS, taskKind } from "../../src/core/taskkind.ts";
import type { Task } from "../../src/core/model.ts";

const kind = (level: Task["level"], origin?: string) => taskKind({ level, origin } as Pick<Task, "level" | "origin">);

test("taskKind: every verification one kind; the history and the stories before the level; else by the level", () => {
  for (const origin of ["verify:auto", "verify:bulk", "verify:asked", "verify:search"]) assert.equal(kind("verify", origin), "verify", origin);
  assert.equal(kind("link", "verify:bulk"), "verify", "a bulk one's search for the record");
  assert.equal(kind("locate", "history:places"), "history");
  assert.equal(kind("enrich", "history:region:cz-bo"), "history");
  assert.equal(kind("narrate"), "story");
  assert.equal(kind("enrich", "story:sources"), "story");
  assert.equal(kind("locate", "places:identify"), "places");
  assert.equal(kind("intake"), "material");
  assert.equal(kind("request"), "request");
  assert.equal(kind("enrich"), "enrich");
  for (const level of ["locate", "link", "verify"] as const) assert.equal(kind(level), "records", level);
  assert.equal(kind("analyze" as Task["level"]), "other");
  // a house's research (spec 030): its takeover, the house, a municipality's houses — whatever the level
  for (const origin of ["house:import:A0001", "house:A0001", "house:lhota|9", "house:town:L0001"]) assert.equal(kind("enrich", origin), "house", origin);
  assert.ok(!KINDS_065.includes("house"), "counted apart: an older app finds it under other");
  assert.ok(kindMatches("house", "other") && !kindMatches("house", "other", ["house"]) && kindMatches("house", "house"));
});

test("parseTaskKind: the kinds alone, any case; kindCounts: only the kinds that have one", () => {
  assert.equal(parseTaskKind(" Verify "), "verify");
  for (const k of TASK_KINDS) assert.equal(parseTaskKind(k), k);
  for (const bad of ["", "download", "ověřit", "verifý", "VERIFY;", "records,verify"]) assert.equal(parseTaskKind(bad), undefined, bad);
  assert.deepEqual(kindCounts([{ level: "verify", origin: "verify:auto" }, { level: "locate" }, { level: "link" }] as Pick<Task, "level" | "origin">[]), { verify: 1, records: 2 });
  assert.deepEqual(kindCounts([]), {});
});
