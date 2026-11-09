// What the tests of strom error share: the ZIP read back, a research of made-up people planted in every log.

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { World } from "../helpers.ts";
import { readEntry, readZip } from "../../src/core/zip.ts";
import { foldText } from "../../src/core/text.ts";

/** Every file of the ZIP, as text. */
export function zipTexts(file: string): Record<string, string> {
  return Object.fromEntries(readZip(file).map((e) => [e.name, readEntry(file, e).toString("utf8")]));
}

/** A word nowhere in the texts: as it is, NFC, NFD, any case, without its accents. */
export function nowhere(texts: Record<string, string>, words: string[]): string[] {
  const found: string[] = [];
  for (const [name, text] of Object.entries(texts)) {
    const forms = [text, text.normalize("NFC"), text.normalize("NFD")].map((t) => t.toLowerCase());
    const folded = foldText(text);
    for (const w of words) {
      const lower = w.toLowerCase();
      if (forms.some((f) => f.includes(lower) || f.includes(lower.normalize("NFC")) || f.includes(lower.normalize("NFD"))) || folded.includes(foldText(w))) found.push(`${w} in ${name}`);
    }
  }
  return found;
}

/** A research of made-up people whose names stand in every log strom keeps, with a user named in its home folder. */
export async function plantedWorld(): Promise<{ w: World; root: string }> {
  const w = new World();
  const home = path.join(w.dir, "vlhotak");
  fs.mkdirSync(path.join(home, "Downloads"), { recursive: true });
  Object.assign(w.env, { HOME: home, USERPROFILE: home });
  const root = await w.withTree("Lhotákovi");
  await w.ok(["person", "add", "Vojtěch /Lhoták/", "--sex", "M", "--born", "1850", "--born-place", "Lhota"]);
  await w.ok(["person", "add", "Anežka /Lhotáková/".normalize("NFD"), "--sex", "F", "--born-place", "Lhoty"]);
  await w.ok(["person", "add", "Анна /Лотакова/", "--sex", "F"]);
  await w.ok(["source", "add", "Matrika Lhota 1850", "--kind", "baptism"]);
  await w.ok(["note", "add", "P1", "Babička Lhotáková vyprávěla o mlýně, psát na lhotak@example.org."]);
  // the command journal: a failed command with a name in its arguments and its message
  const failed = await w.run(["person", "add", "Vojtěch /Lhoták/", "--born", "u Lhoty Vojtěchovy"]);
  assert.notEqual(failed.code, 0, failed.out);
  assert.notEqual((await w.run(["person", "show", "P9999"])).code, 0);
  const s = path.join(root, ".strom");
  const now = new Date().toISOString();
  fs.appendFileSync(
    path.join(s, "live.log"),
    [
      `${now} [123] sync from Vojtěch Lhoták failed at http://127.0.0.1:4711/tok-SECRET1234567890/tree.ged`,
      `${now} [123] cannot read ${path.join(home, "Documents", "Strom", "Lhotákovi", "notes", "Lhotáková.md")}: EACCES`,
      `${now} [123] mail to lhotak@example.org refused; C:\\Users\\vlhotak\\Documents\\Лотакова.txt`,
    ].join("\n") + "\n",
  );
  fs.appendFileSync(path.join(s, "gate.log"), JSON.stringify({ at: now, gate: "claude-usage", status: "wait", reason: "Lhoták's session waits for Lhota" }) + "\n");
  fs.mkdirSync(path.join(s, "metrics"), { recursive: true });
  fs.appendFileSync(path.join(s, "metrics", "fetch.jsonl"), JSON.stringify({ at: now, cmd: "fetch", connector: "lhota-archiv", book: "B0001", requests: 197, stopped: "timeout at the page of Vojtěch Lhoták (Lhota)", host: "archive.example.org" }) + "\n");
  // the bridge: its secret address
  fs.writeFileSync(path.join(s, "live-last.json"), JSON.stringify({ url: "http://127.0.0.1:4711/tok-SECRET1234567890/", token: "SECRET1234567890", ended: { kind: "stopped", at: now } }));
  // a connector's login
  fs.writeFileSync(
    path.join(w.env.STROM_CONFIG_DIR!, "logins.json"),
    JSON.stringify({ "lhota-archiv": { dir: path.join(home, "Documents", "Strom", "shared", "plugins", "connectors", "lhota-archiv"), hosts: ["archive.example.org"], values: { user: "vlhotak.login", password: "Heslo-Tajne-77" }, at: now } }),
  );
  return { w, root };
}

/** The words of the planted research none of which may go out. */
export const PLANTED = ["Lhoták", "Lhotáková", "Lhotákovi", "Lhota", "Lhoty", "Vojtěch", "Anežka", "Анна", "Лотакова", "Babička", "mlýně", "Matrika", "lhotak@example.org", "SECRET1234567890", "Heslo-Tajne-77", "vlhotak"];

