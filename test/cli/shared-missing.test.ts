// The shared folder's files of a research missing on this computer (the research's folder brought along without the
// shared folder, or the shared folder lost): check and verify say so with how many and the first, never "nothing lost".

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { World, hasGit } from "../helpers.ts";
import { encodeJpeg } from "../../src/image/jpeg-encode.ts";
import { blank } from "../../src/image/image.ts";
import { MAX_IN_TREE } from "../../src/core/media.ts";

const opts = { skip: !hasGit };

/** A research with an image and a big file of the family's material, both kept in the shared folder. */
async function world(lang: string): Promise<{ w: World; material: string }> {
  const w = new World();
  w.env.STROM_LANG = lang;
  await w.withTree("Dvořákovi");
  const jpg = path.join(w.dir, "sken č. 1.jpg");
  fs.writeFileSync(jpg, encodeJpeg(blank(60, 40, 1, 90), 85));
  await w.ok(["media", "add", jpg]);
  // bigger than what a research keeps in its own folder: into the shared one (a sparse file, written in no time)
  const big = path.join(w.dir, "Kronika rodu.pdf");
  fs.writeFileSync(big, "%PDF-1.4\n");
  fs.truncateSync(big, MAX_IN_TREE + 1);
  await w.ok(["intake", big]);
  const showI = (await w.ok(["input", "show", "I0001", "--json"])).json;
  assert.match(showI.input.file, /^media:/);
  return { w, material: showI.path };
}

test("check says the shared folder's files missing here — how many, the first, what to bring back — and verify too", opts, async () => {
  const { w, material } = await world("cs");
  try {
    assert.ok(fs.existsSync(material));
    assert.match((await w.ok(["check"])).out, /nic se neztratilo/);
    // the shared folder not brought along
    const media = path.join(w.home, "shared", "media");
    fs.rmSync(media, { recursive: true, force: true });
    const c = await w.run(["check"]);
    assert.equal(c.code, 0, c.out + c.err);
    assert.doesNotMatch(c.out, /nic se neztratilo/);
    assert.match(c.out, /chybí ve sdílené složce: 2 soubory \(první: I0001\)/u);
    assert.match(c.out, /vrátit ze zálohy celou složku Strom \(podsložku shared\)/u);
    const j = (await w.run(["check", "--json"])).json;
    const f = j.findings.find((x: { code: string }) => x.code === "shared-missing");
    assert.equal(f.level, "warn");
    assert.equal(f.count, 2);
    assert.equal(f.id, "I0001");
    const v = (await w.run(["verify", "--json"])).json;
    assert.ok(v.findings.some((x: { code: string }) => x.code === "shared-missing"), JSON.stringify(v));
    // before a write only what changed is asked: no finding, writing goes on
    await w.ok(["person", "add", "Anna /Dvořáková/", "--sex", "F"]);
    // where the file belongs says it is not here
    const show = await w.ok(["input", "show", "I0001"]);
    assert.match(show.out, /missing on this computer: bring back the shared folder/);
    assert.equal((await w.ok(["input", "show", "I0001", "--json"])).json.missing, true);
  } finally {
    w.cleanup();
  }
});

test("the shared folder's files missing: said in English and German too", opts, async () => {
  for (const [lang, said] of [
    ["en", /2 files of the shared folder not on this computer \(the first: I0001\)/u],
    ["de", /im gemeinsamen Ordner fehlen auf diesem Computer: 2 Dateien \(die erste: I0001\)/u],
  ] as const) {
    const { w } = await world(lang);
    try {
      fs.rmSync(path.join(w.home, "shared", "media"), { recursive: true, force: true });
      const c = await w.run(["check"]);
      assert.match(c.out, said, c.out);
    } finally {
      w.cleanup();
    }
  }
});
