// What the tests of sync share: they are split over files (sync*.test.ts) that run side by side.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { World, hasGit } from "../helpers.ts";
import { Tree } from "../../src/core/tree.ts";
import type { Family, Person } from "../../src/core/model.ts";

export const opts = { skip: !hasGit };

export async function world(): Promise<{ w: World; ged: string }> {
  const w = new World();
  await w.withTree();
  await w.ok(["lang", "cs"]);
  await w.ok(["source", "add", "Křest Josefa Nováka 1885", "--kind", "baptism", "--transcript", "Josef, syn Jana Nováka."]); // S1
  await w.ok(["person", "add", "Josef /Novák/", "--sex", "M"]); // P1
  await w.ok(["event", "add", "P1", "CHR", "--date", "3 MAR 1885", "--place", "Kamenice", "--cite", "S1"]); // E1, probable
  await w.ok(["person", "add", "Anna /Dvořáková/", "--sex", "F", "--born", "1888"]); // P2, a lead
  await w.ok(["person", "add", "Karel /Novák/", "--sex", "M"]); // P3
  await w.ok(["family", "add", "--partner", "P1", "--partner", "P2"]); // F1
  const ged = path.join(w.dir, "strom.ged");
  await w.ok(["export", "gedcom", "--for", "strom", "--images-for", "none", "--out", ged]);
  return { w, ged };
}

/** What the user does in the app: the file as the app gives it back. */
export function edited(ged: string, out: string): string {
  let t = fs.readFileSync(ged, "utf8");
  t = t.replace("2 DATE 3 MAR 1885", "2 DATE 4 MAR 1885"); // a baptism a record proves
  t = t.replace(/(1 REFN P0002\r?\n2 TYPE strom-research\r?\n1 BIRT\r?\n2 DATE )1888/, "$11889"); // a lead
  t = t.replace(/(1 REFN P0002\r?\n2 TYPE strom-research\r?\n)/, "$11 DEAT\n2 DATE 1960\n2 PLAC Týnec\n1 NOTE Babička pekla buchty.\n");
  t = t.replace(/0 @[^@]+@ INDI\r?\n1 NAME Karel \/Novák\/\r?\n(?:[1-9].*\r?\n)*/, ""); // removed
  t = t.replace(/(0 @([^@]+)@ FAM\r?\n)/, "0 @X1@ INDI\n1 NAME Marie /Nováková/\n1 SEX F\n1 BIRT\n2 DATE 1910\n2 PLAC Týnec\n$1");
  t = t.replace(/(0 @[^@]+@ FAM\r?\n(?:[1-9].*\r?\n)*)/, "$11 CHIL @X1@\n");
  fs.writeFileSync(out, t);
  return out;
}

export function post(url: string, body: string, headers: Record<string, string> = {}): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = http.request(url, { method: "POST", headers: { "Content-Type": "text/plain; charset=utf-8", ...headers } }, (res) => {
      let b = "";
      res.on("data", (d) => (b += d));
      res.on("end", () => resolve({ status: res.statusCode ?? 0, body: b }));
    });
    req.on("error", reject);
    req.end(body);
  });
}

export function get(url: string): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    http
      .get(url, (res) => {
        let b = "";
        res.on("data", (d) => (b += d));
        res.on("end", () => resolve({ status: res.statusCode ?? 0, body: b }));
      })
      .on("error", reject);
  });
}

/** The app's words on a send in the HEAD of its GEDCOM: its own tree, its mark of the state, how its transcripts count. */
export function marked(text: string, tree: string, sent: string, transcripts?: string): string {
  return text.replace(/^(1 _STROM_HEAD .*\r?\n)/m, `$11 _STROM_APP_TREE ${tree}\n1 _STROM_SENT ${sent}\n${transcripts ? `1 _STROM_TRANSCRIPTS ${transcripts}\n` : ""}`);
}

/** The app's sources in its GEDCOM: an entry of the register cited by a new person's birth, another by a lead of the research's, and the research's own source read otherwise. */
export function withSources(ged: string, out: string, head = ""): string {
  let t = fs.readFileSync(ged, "utf8");
  if (head) t = t.replace(/^(1 _STROM_HEAD .*\r?\n)/m, `$1${head}`);
  // a new person, born on an entry the user transcribed
  t = t.replace(
    /^0 @U1@ SUBM/m,
    [
      "0 @X1@ INDI",
      "1 NAME Marie /Nováková/",
      "1 SEX F",
      "1 BIRT",
      "2 DATE 5 MAY 1910",
      "2 PLAC Týnec",
      "2 SOUR @X9@",
      "3 PAGE fol. 12",
      "3 DATA",
      "4 DATE 7 MAY 1910",
      "3 QUAY 3",
      "0 @X9@ SOUR",
      "1 TITL Křestní matrika Týnec 1905–1915",
      "1 REPO @XR1@",
      "1 PAGE fol. 12",
      "1 TEXT Marie, dcera Josefa Nováka, rolníka v Týnci č. 5.",
      "0 @X8@ SOUR",
      "1 TITL Křestní matrika Kamenice 1880–1890",
      "1 PAGE fol. 40",
      "1 TEXT Anna, dcera Václava Dvořáka.",
      "0 @XR1@ REPO",
      "1 NAME Státní oblastní archiv",
      "0 @U1@ SUBM",
    ].join("\n"),
  );
  // the research's lead of a birth: the user gives it a source
  t = t.replace(/(1 REFN P0002\r?\n2 TYPE strom-research\r?\n1 BIRT\r?\n2 DATE 1888\r?\n)/, "$12 SOUR @X8@\n3 PAGE fol. 40\n3 QUAY 3\n");
  // the record the research read: the user reads it otherwise
  t = t.replace("1 TEXT Josef, syn Jana Nováka.", "1 TEXT Josef, syn Jana Nováka a Anny.");
  fs.writeFileSync(out, t);
  return out;
}
