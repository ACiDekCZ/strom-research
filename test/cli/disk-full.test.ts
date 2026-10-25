// No room left on the disk (ENOSPC, EDQUOT): said in one place, in the research's language, with the folder whose
// disk is full and never strom's inner paths — a command, the bridge's answers to the app (507 disk.full) and why a
// bridge did not start. No disk is filled: the system's error is made where strom writes.

import { test, mock } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { World, hasGit } from "../helpers.ts";
import { diskFull, DISK_FULL, folderOf, isDiskFull } from "../../src/core/errors.ts";
import { diskFullSaid } from "../../src/core/receive.ts";
import { notStartedWhy, noteLive } from "../../src/core/live.ts";

const opts = { skip: !hasGit };

/** The system's own error of a full disk, as Node gives it. */
function enospc(syscall: string, p: string): NodeJS.ErrnoException {
  return Object.assign(new Error(`ENOSPC: no space left on device, ${syscall} '${p}'`), { code: "ENOSPC", errno: -28, syscall, path: p });
}

test("a full disk is known by its code or its words; said with the folder, never an inner path", () => {
  assert.ok(isDiskFull(enospc("write", "/x/y")));
  assert.ok(isDiskFull(Object.assign(new Error("quota"), { code: "EDQUOT" })));
  assert.ok(isDiskFull(new Error("git: fatal: unable to write new index file: No space left on device")));
  assert.ok(isDiskFull({ code: DISK_FULL }));
  assert.ok(!isDiskFull(Object.assign(new Error("denied"), { code: "EACCES" })));
  assert.ok(!isDiskFull(undefined));
  const root = path.resolve("Strom", "Rodina Šťastných");
  assert.equal(folderOf(path.join(root, ".strom", "sync", "x.ged")), root);
  assert.equal(folderOf(path.join(root, ".git", "objects", "ab")), root);
  assert.equal(folderOf(path.resolve("shared", "media", ".incoming", "a.part")), path.resolve("shared", "media"));
  const e = diskFull(root);
  assert.equal(e.code, DISK_FULL);
  assert.deepEqual(e.params, { where: root });
  const cs = diskFullSaid("cs", root);
  assert.equal(cs.code, "disk.full");
  assert.equal(cs.error, `na disku se složkou ${root} není místo – uvolnit tam místo a zkusit znovu; nic se neztratilo`);
  assert.match(diskFullSaid("de", root).error, /^auf dem Datenträger mit .+ ist kein Platz mehr/u);
  assert.match(cs.text, /^there is no room left on the disk of /);
});

test("a write meeting a full disk says so in the research's language, with the research's folder, never ENOSPC and a temp file", opts, async () => {
  const w = new World();
  w.env.STROM_LANG = "cs";
  await w.withTree("Zkušební");
  const write = fs.writeFileSync;
  const m = mock.method(fs, "writeFileSync", function (this: unknown, file: fs.PathOrFileDescriptor, ...rest: unknown[]) {
    if (typeof file === "string" && file.includes(`${path.sep}persons${path.sep}`)) throw enospc("open", file);
    return (write as (...a: unknown[]) => void).call(this, file, ...rest);
  });
  try {
    const r = await w.run(["person", "add", "Jan /Šťastný/", "--sex", "M"], { tty: true });
    assert.notEqual(r.code, 0);
    assert.match(r.err, /na disku se složkou .*Zkušební není místo – uvolnit tam místo a zkusit znovu; nic se neztratilo/u, r.err);
    assert.doesNotMatch(r.err, /ENOSPC|\.tmp|persons/u, r.err);
    const j = await w.run(["person", "add", "Jan /Šťastný/", "--json"]);
    assert.equal(j.json.code, "disk.full");
    assert.equal(fs.realpathSync(j.json.params.where), fs.realpathSync(w.cwd));
  } finally {
    m.mock.restore();
    w.cleanup();
  }
});

test("why a bridge did not start: no room on the research's disk, else the line its log got", opts, async () => {
  const w = new World();
  await w.withTree("Zkušební");
  try {
    const since = Date.now();
    assert.deepEqual(notStartedWhy(w.cwd, since), { full: false });
    fs.mkdirSync(path.join(w.cwd, ".strom"), { recursive: true });
    fs.writeFileSync(path.join(w.cwd, ".strom", "live.log"), "");
    noteLive(w.cwd, "listen EADDRINUSE: address already in use 127.0.0.1:47000");
    assert.deepEqual(notStartedWhy(w.cwd, since), { full: false, line: "listen EADDRINUSE: address already in use 127.0.0.1:47000" });
    // the disk full: said before the log (the system may say room it does not give: a small file tried)
    const m = mock.method(fs, "statfsSync", () => ({ bavail: 10, bsize: 4096 }));
    try {
      assert.deepEqual(notStartedWhy(w.cwd, since), { full: true });
    } finally {
      m.mock.restore();
    }
  } finally {
    w.cleanup();
  }
});

test("the bridge answers a write that met a full disk with 507 disk.full in the research's language, and goes on", opts, async () => {
  const w = new World();
  w.env.STROM_LANG = "cs";
  await w.withTree("Zkušební");
  await w.ok(["person", "add", "Jan /Šťastný/", "--sex", "M"]);
  // every strom the bridge is meets a full disk where a tree from the app is put down (.strom/sync)
  const preload = path.join(w.dir, "plny-disk.mjs");
  fs.writeFileSync(
    preload,
    `import fs from "node:fs";
const full = (p) => String(p).includes(${JSON.stringify(`${path.sep}.strom${path.sep}sync`)});
const err = (s, p) => Object.assign(new Error("ENOSPC: no space left on device, " + s + " '" + p + "'"), { code: "ENOSPC", syscall: s, path: String(p) });
for (const name of ["mkdirSync", "writeFileSync", "openSync", "appendFileSync"]) {
  const orig = fs[name];
  fs[name] = function (p, ...rest) { if (full(p)) throw err(name.replace(/Sync$/, ""), p); return orig.call(this, p, ...rest); };
}
`,
  );
  fs.rmSync(path.join(w.cwd, ".strom", "sync"), { recursive: true, force: true });
  const env = { ...w.env, NODE_OPTIONS: `--import=${pathToFileURL(preload).href}` };
  const info = (await w.ok(["live", "start", "--json"], { env })).json;
  try {
    const status = (await (await fetch(`${info.url}/status`)).json()) as { features: string[] };
    assert.ok(status.features.includes("disk.full"));
    const headers = { Origin: "https://beta.stromapp.info", "Content-Type": "text/plain; charset=utf-8" };
    const res = await fetch(`${info.url}/sync`, { method: "POST", body: "0 HEAD\n1 SOUR Strom\n0 @I1@ INDI\n1 NAME Jan /Šťastný/\n0 TRLR\n", headers });
    const got = (await res.json()) as { code: string; error: string; text: string; params: Record<string, string> };
    assert.equal(res.status, 507, JSON.stringify(got));
    assert.equal(got.code, "disk.full");
    assert.match(got.error, /^na disku se složkou .*Zkušební není místo – uvolnit tam místo a zkusit znovu; nic se neztratilo$/u, got.error);
    assert.doesNotMatch(got.error + got.text, /ENOSPC|\.strom/u);
    // the bridge goes on
    assert.equal((await fetch(`${info.url}/status`)).status, 200);
  } finally {
    await w.run(["live", "stop"]);
    w.cleanup();
  }
});
