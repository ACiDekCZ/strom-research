// What the tests of links share: they are split over files (links*.test.ts) that run side by side.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { World, hasGit, readJsonFile } from "../helpers.ts";
import { decodeImage, encodeImage, imageSize } from "../../src/image/index.ts";
import { resize } from "../../src/image/image.ts";
import { validateGedcom } from "../../src/gedcom/validate.ts";
import { LinkError, linkActions, linkHandlerState, linkText, LINUX_ENTRY, linuxDesktopEntry, macScript, parseLink, registerLinks, unregisterLinks, windowsCommand } from "../../src/core/links.ts";
import { clipMark } from "../../src/core/excerpt.ts";
import { Tree } from "../../src/core/tree.ts";
import type { Media } from "../../src/core/model.ts";

export const opts = { skip: !hasGit };
export const fixtures = path.join(import.meta.dirname, "..", "fixtures", "images");
export const ID = "0f8c2d4e-1b2a-4c3d-9e8f-7a6b5c4d3e2f";

/** A tree with one baptism clipped on a big scan (3200×2400) of a book with a page online. */
export async function world(): Promise<{ w: World; id: string; mark: string }> {
  const w = new World();
  await w.withTree();
  await w.ok(["recordset", "add", "Kniha N 1850-1870", "--kinds", "baptism", "--places", "Týnec", "--years", "1850-1870"]);
  const scans = path.join(w.dir, "kniha");
  fs.mkdirSync(scans);
  fs.writeFileSync(path.join(scans, "s0001.jpg"), encodeImage(resize(decodeImage(fs.readFileSync(path.join(fixtures, "s0001.jpg"))), 3200, 2400), "jpeg"));
  await w.ok(["media", "add", scans, "--recordset", "B1", "--url", "https://archive.example.org/book/1"]);
  await w.ok(["person", "add", "Jan /Novák/", "--sex", "M"]);
  await w.ok(["source", "add", "Křest Jana", "--kind", "baptism", "--recordset", "B1", "--clip", "B1:1@0.1,0.4,0.8,0.08"]);
  await w.ok(["event", "add", "P0001", "CHR", "--date", "12 MAR 1865", "--cite", "S0001"]);
  const id = readJsonFile(path.join(w.cwd, "strom.json")).id;
  const s = readJsonFile(path.join(w.cwd, "data", "sources", "S0001.json"));
  return { w, id, mark: clipMark(s.clips[0]) };
}
