// The kind of a task as the person sees the work (spec 065 K7.4): one kind each, the first that fits.

import { test } from "node:test";
import assert from "node:assert/strict";
import { kindCounts, parseTaskKind, TASK_KINDS, taskKind } from "../../src/core/taskkind.ts";
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
});

test("parseTaskKind: the kinds alone, any case; kindCounts: only the kinds that have one", () => {
  assert.equal(parseTaskKind(" Verify "), "verify");
  for (const k of TASK_KINDS) assert.equal(parseTaskKind(k), k);
  for (const bad of ["", "download", "ověřit", "verifý", "VERIFY;", "records,verify"]) assert.equal(parseTaskKind(bad), undefined, bad);
  assert.deepEqual(kindCounts([{ level: "verify", origin: "verify:auto" }, { level: "locate" }, { level: "link" }] as Pick<Task, "level" | "origin">[]), { verify: 1, records: 2 });
  assert.deepEqual(kindCounts([]), {});
});
