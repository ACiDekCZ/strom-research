// What the tests of excerpts share: they are split over files (excerpts*.test.ts) that run side by side.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { World, hasGit, readJsonFile } from "../helpers.ts";
import { decodeImage, encodeImage, imageSize } from "../../src/image/index.ts";
import { resize } from "../../src/image/image.ts";
import { validateGedcom } from "../../src/gedcom/validate.ts";
import { Tree } from "../../src/core/tree.ts";
import { planExcerpts } from "../../src/core/excerpt.ts";

export const opts = { skip: !hasGit };
export const fixtures = path.join(import.meta.dirname, "..", "fixtures", "images");

/** A tree with a book of three small scans and a big one (image 4, 3200×2400). */
export async function world(): Promise<World> {
  const w = new World();
  await w.withTree();
  await w.ok(["recordset", "add", "Kniha N 1850-1870", "--kinds", "baptism", "--places", "Týnec", "--years", "1850-1870"]);
  const scans = path.join(w.dir, "kniha");
  fs.mkdirSync(scans);
  for (const f of ["s0001.jpg", "s0002.jpg", "s0003.jpg"]) fs.copyFileSync(path.join(fixtures, f), path.join(scans, f));
  fs.writeFileSync(path.join(scans, "s0004.jpg"), encodeImage(resize(decodeImage(fs.readFileSync(path.join(fixtures, "s0001.jpg"))), 3200, 2400), "jpeg"));
  await w.ok(["media", "add", scans, "--recordset", "B1", "--url", "https://archive.example.org/book/1"]);
  return w;
}

export const source = (w: World, id: string) => readJsonFile(path.join(w.cwd, "data", "sources", `${id}.json`));

export const stromRepo = path.resolve(import.meta.dirname, "..", "..", "..", "strom");
export const tsx = path.join(stromRepo, "node_modules", ".bin", process.platform === "win32" ? "tsx.cmd" : "tsx");
