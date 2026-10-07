// npm's tags: a beta goes out under `beta` only, a release under `latest` only, a candidate (rc) nowhere. Guarded by
// prepublishOnly (a publish from the sources' folder) and, since npm runs no script of a tarball it publishes, by the
// beta tarball's own publishConfig.tag. The release build refuses any other prerelease before it builds anything.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import zlib from "node:zlib";
import { spawnSync } from "node:child_process";
import { packForNpm, publishLine, publishRefusal, releaseKind, tarballName } from "../../scripts/npm-channel.ts";

const ROOT = path.resolve(import.meta.dirname, "..", "..");
const hasNpm = spawnSync("npm", ["--version"], { shell: process.platform === "win32" }).status === 0;

test("what a version is: a release, a beta.N, an rc.N; any other prerelease refused", () => {
  assert.equal(releaseKind("1.13.0"), "release");
  assert.equal(releaseKind("1.13.0-beta.1"), "beta");
  assert.equal(releaseKind("1.13.0-beta.10"), "beta");
  assert.equal(releaseKind("1.13.0-rc.3"), "rc");
  for (const v of ["1.13.0-alpha.1", "1.13.0-beta", "1.13.0-beta.01", "1.13.0-beta.1.2", "1.13.0-RC.1", "1.13", "v1.13.0", "1.13.0-beta.x"])
    assert.equal(typeof releaseKind(v), "object", v);
});

test("prepublishOnly: a beta only under the tag beta, a release never under it, a candidate never", () => {
  assert.equal(publishRefusal("1.13.0-beta.2", "beta"), undefined);
  assert.match(publishRefusal("1.13.0-beta.2", undefined)!, /under the tag beta only, never "latest".*npm publish release-beta\/strom-research-1\.13\.0-beta\.2\.tgz --tag beta/);
  assert.match(publishRefusal("1.13.0-beta.2", "latest")!, /never "latest"/);
  assert.match(publishRefusal("1.13.0-beta.2", "next")!, /never "next"/);
  assert.equal(publishRefusal("1.13.0", undefined), undefined, "a release: npm's default tag, latest");
  assert.equal(publishRefusal("1.13.0", "latest"), undefined);
  assert.match(publishRefusal("1.13.0", "beta")!, /a release: it goes out under latest/);
  assert.match(publishRefusal("1.13.0-rc.1", "beta")!, /local candidate/);
  assert.match(publishRefusal("1.13.0-rc.1", undefined)!, /local candidate/);
  assert.match(publishRefusal("1.13.0-alpha.1", "beta")!, /Nothing is published/);
});

test("the guard as npm runs it: npm_package_version and npm_config_tag (unset = latest), exit 1 with the line to run", () => {
  const guard = (version: string, tag?: string) => {
    const env: Record<string, string | undefined> = { ...process.env, npm_package_version: version };
    delete env.npm_config_tag;
    if (tag !== undefined) env.npm_config_tag = tag;
    return spawnSync(process.execPath, [path.join(ROOT, "scripts", "npm-channel.ts")], { env, encoding: "utf8" });
  };
  assert.equal(guard("2.0.0-beta.1", "beta").status, 0);
  const latest = guard("2.0.0-beta.1");
  assert.equal(latest.status, 1);
  assert.match(latest.stderr, /--tag beta/);
  assert.equal(guard("2.0.0").status, 0);
  assert.equal(guard("2.0.0", "beta").status, 1);
  assert.equal(guard("2.0.0-rc.4", "beta").status, 1);
});

test("the release build refuses a prerelease other than beta.N or rc.N before it builds or removes anything", () => {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), "strom-release-"));
  fs.writeFileSync(path.join(out, "keep.txt"), "x");
  for (const version of ["1.13.0-alpha.1", "1.13.0-beta", "1.13.0-next.2"]) {
    const r = spawnSync(process.execPath, [path.join(ROOT, "scripts", "build-release.ts"), "--version", version, "--out", out], { encoding: "utf8" });
    assert.equal(r.status, 1, version);
    assert.match(r.stderr, /beta\.N .* or rc\.N/, version);
    assert.doesNotMatch(r.stdout, /building/, version);
  }
  assert.ok(fs.existsSync(path.join(out, "keep.txt")), "the folder untouched");
});

test("a beta's npm tarball: what npm pack publishes, the version as staged, publishConfig.tag beta; a release's or rc's: none", { skip: !hasNpm }, () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "strom-npm-pack-"));
  const stage = path.join(dir, "app");
  const out = path.join(dir, "out");
  fs.mkdirSync(path.join(stage, "dist"), { recursive: true });
  fs.mkdirSync(path.join(stage, "assets"), { recursive: true });
  fs.mkdirSync(out);
  fs.writeFileSync(path.join(stage, "dist", "cli.js"), "// strom\n");
  fs.writeFileSync(path.join(stage, "assets", "a.json"), "{}\n");
  for (const f of ["LICENSE", "README.md"]) fs.writeFileSync(path.join(stage, f), f);
  fs.writeFileSync(path.join(stage, "notes.txt"), "not in the package");
  const pkg = { name: "strom-research", version: "1.0.0", files: ["dist", "assets", "LICENSE"], scripts: { prepack: "exit 1" } };
  const write = (version: string) => fs.writeFileSync(path.join(stage, "package.json"), JSON.stringify({ ...pkg, version }));
  for (const version of ["1.13.0", "1.13.0-rc.1"]) {
    write(version);
    assert.throws(() => packForNpm(stage, out), /only a beta/, version);
  }
  write("1.13.0-beta.3");
  const file = packForNpm(stage, out);
  assert.equal(path.basename(file), tarballName("1.13.0-beta.3"));
  assert.equal(path.basename(file), "strom-research-1.13.0-beta.3.tgz");
  const tar = zlib.gunzipSync(fs.readFileSync(file));
  const names: string[] = [];
  for (let at = 0; at + 512 <= tar.length; ) {
    const name = tar.subarray(at, at + 100).toString("utf8").replace(/\0.*$/s, "");
    if (!name) break;
    names.push(name);
    if (name === "package/package.json") {
      const size = parseInt(tar.subarray(at + 124, at + 136).toString().replace(/\0.*$/s, "").trim(), 8);
      const json = JSON.parse(tar.subarray(at + 512, at + 512 + size).toString("utf8"));
      assert.equal(json.version, "1.13.0-beta.3");
      assert.deepEqual(json.publishConfig, { tag: "beta" });
    }
    at += 512 + Math.ceil(parseInt(tar.subarray(at + 124, at + 136).toString().replace(/\0.*$/s, "").trim() || "0", 8) / 512) * 512;
  }
  assert.deepEqual(names.sort(), ["package/LICENSE", "package/README.md", "package/assets/a.json", "package/dist/cli.js", "package/package.json"]);
  assert.equal(publishLine("release-beta/" + path.basename(file)), "npm publish release-beta/strom-research-1.13.0-beta.3.tgz --tag beta");
});
