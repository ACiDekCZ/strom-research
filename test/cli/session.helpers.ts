// What the tests of session share: they are split over files (session*.test.ts) that run side by side.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { World, hasGit, readJsonFile } from "../helpers.ts";

export const opts = { skip: !hasGit };
export const agent = path.join(import.meta.dirname, "..", "fixtures", "agent.ts");

export async function world(): Promise<World> {
  const w = new World();
  await w.withTree();
  await w.ok(["research", "new", "Předci Jana Nováka", "--new-person", "Jan /Novák/", "--sex", "M", "--born", "ABT 1905", "--born-place", "Týnec nad Labem"]);
  await w.ok(["repo", "add", "SOA Praha", "--automation", "manual"]);
  await w.ok(["recordset", "add", "Týnec 17, N 1903-1920", "--repo", "R1", "--kinds", "baptism", "--places", "Týnec nad Labem", "--years", "1903-1920", "--access", "online-free"]);
  return w;
}
