// A research with everything the Strom app is given from it — facts a record proves and leads, an excerpt of a
// scan, godparents and an officiant, a couple's residence and note, ages, a cause and a house, a place on the map,
// an approved story with a new version waiting, a conflict and a hypothesis — built the same way each time (the
// same IDs), for the app of an older version (test/fixtures/app/) to read and send back.

import fs from "node:fs";
import path from "node:path";
import type { World } from "../helpers.ts";

export const fixtures = path.join(import.meta.dirname, "..", "fixtures");

export async function appCompatTree(w: World): Promise<void> {
  await w.withTree();
  await w.ok(["lang", "cs"]);
  await w.ok(["research", "new", "Předci Karla", "--new-person", "Karel /Novák/", "--sex", "M"]); // P1, G1
  await w.ok(["person", "add", "Josef /Novák/", "--sex", "M"]); // P2
  await w.ok(["person", "add", "Anna /Dvořáková/", "--sex", "F"]); // P3
  await w.ok(["family", "add", "--partner", "P2", "--partner", "P3", "--child", "P1", "--married", "12 FEB 1885", "--married-place", "Kamenice", "--age", "P2:25", "--age", "wife:22"]); // F1
  await w.ok(["place", "add", "Kamenice", "--kind", "village", "--lat", "49.366571", "--lon", "15.041234"]); // L1
  await w.ok(["recordset", "add", "Matrika Kamenice N 1880–1900"]); // B1
  const scan = path.join(w.dir, "0012.jpg");
  fs.copyFileSync(path.join(fixtures, "images", "s0001.jpg"), scan);
  await w.ok(["media", "add", scan, "--recordset", "B0001", "--image", "12"]); // M1
  await w.ok([
    "source", "add", "Křest Karla Nováka", "--kind", "baptism", "--recordset", "B0001", "--locator", "fol. 12", "--date", "15 MAR 1890",
    "--transcript", "Carolus, filius legitimus Josephi Novák et Annae Dvořák", "--language", "la", "--information", "primary", "--media", "M0001", "--clip", "M0001@0.1,0.2,0.5,0.3",
  ]); // S1
  await w.ok(["event", "add", "P1", "BIRT", "--date", "12 MAR 1890", "--place", "Kamenice", "--house", "13", "--cite", "S0001", "--status", "proven"]);
  await w.ok(["event", "add", "P1", "BAPM", "--date", "15 MAR 1890", "--place", "Kamenice", "--cite", "S0001", "--with", "godparent:Marie Dvořáková", "--with", "officiant:Jan Král"]);
  await w.ok(["event", "add", "P2", "BIRT", "--date", "ABT 1860"]);
  await w.ok(["event", "add", "P2", "DEAT", "--date", "3 JAN 1920", "--place", "Kamenice", "--cause", "souchotiny", "--age", "59"]);
  await w.ok(["event", "add", "P2", "OCCU", "--value", "mlynář"]);
  await w.ok(["event", "add", "F1", "RESI", "--date", "1890", "--place", "Kamenice"]);
  await w.ok(["note", "add", "F1", "Sňatek po trojích ohláškách."]);
  await w.ok(["note", "add", "P1", "Babička vyprávěla o mlýně."]);
  await w.ok(["story", "set", "P1", "--text", "Karel se narodil v Kamenici.", "--final"]);
  await w.ok(["story", "set", "P1", "--text", "Karel se narodil 12. března 1890 v Kamenici, v domě číslo 13."]);
  await w.ok(["conflict", "add", "Rok narození Josefa", "--about", "P2", "--claim", "S0001: 1860", "--claim", "S0001: 1861", "--fact", "BIRT"]);
  await w.ok(["hypothesis", "add", "Odkud byl Josef?", "--about", "P2", "--variant", "A: z Kamenice", "--variant", "B: z Týnce"]);
}
