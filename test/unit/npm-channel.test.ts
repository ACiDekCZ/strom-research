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
import { betaOfTag, npmPublishesTrusted, packForNpm, publishLine, publishRefusal, releaseKind, tarballName, tarballRefusal } from "../../scripts/npm-channel.ts";
import { AFTER_TRIES, readRegistry } from "../../scripts/npm-beta-ci.ts";

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
  assert.match(publishRefusal("1.13.0-beta.2", undefined)!, /under the tag beta only, never "latest".*npm publish \.\/release-beta\/strom-research-1\.13\.0-beta\.2\.tgz --tag beta/);
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
  assert.equal(publishLine("release-beta/" + path.basename(file)), "npm publish ./release-beta/strom-research-1.13.0-beta.3.tgz --tag beta");
});

test("the publish line names the tarball as a path, never what npm takes for a GitHub repository (release-beta/x.tgz = user/repo)", () => {
  assert.equal(publishLine("release-beta/strom-research-1.13.0-beta.3.tgz"), "npm publish ./release-beta/strom-research-1.13.0-beta.3.tgz --tag beta");
  assert.equal(publishLine("strom-research-1.13.0-beta.3.tgz"), "npm publish ./strom-research-1.13.0-beta.3.tgz --tag beta");
  assert.equal(publishLine("./out/x.tgz"), "npm publish ./out/x.tgz --tag beta");
  assert.equal(publishLine("../out/x.tgz"), "npm publish ../out/x.tgz --tag beta");
  assert.equal(publishLine("release-beta\\x.tgz"), "npm publish ./release-beta/x.tgz --tag beta");
  const abs = path.resolve("/tmp", "out", "x.tgz");
  assert.equal(publishLine(abs), `npm publish ${abs} --tag beta`);
  assert.equal(publishLine("my out/x.tgz"), 'npm publish "./my out/x.tgz" --tag beta');
});

test("the npm package carries the changelogs (what is new in the installed version, offline: the bridge's /whats-new)", { skip: !hasNpm }, () => {
  const r = spawnSync("npm", ["pack", "--dry-run", "--json", "--ignore-scripts"], { cwd: ROOT, encoding: "utf8", shell: process.platform === "win32" });
  assert.equal(r.status, 0, r.stderr);
  const files = (JSON.parse(r.stdout)[0].files as { path: string }[]).map((f) => f.path);
  for (const f of ["CHANGELOG.md", "CHANGELOG.cs.md", "CHANGELOG.de.md", "LICENSE", "README.md", "package.json"]) assert.ok(files.includes(f), f);
  assert.deepEqual(files.filter((f) => !/^(dist|assets)\//.test(f)).sort(), ["CHANGELOG.cs.md", "CHANGELOG.de.md", "CHANGELOG.md", "LICENSE", "README.md", "package.json"], "nothing else of the sources");
});

test("the workflow's beta: only a tag vX.Y.Z-beta.N newer than the sources' version; a release's tag never", () => {
  assert.equal(betaOfTag("v1.17.0-beta.1", "1.16.0"), "1.17.0-beta.1");
  assert.equal(betaOfTag("v1.17.0-beta.12", "1.17.0-rc.3"), "1.17.0-beta.12", "a candidate of the same version");
  assert.equal(betaOfTag("v2.0.0-beta.1", "1.16.0"), "2.0.0-beta.1");
  for (const tag of ["v1.17.0", "1.17.0-beta.1", "v1.17.0-rc.1", "v1.17.0-beta", "v1.17.0-beta.1-x", "vx", ""])
    assert.match((betaOfTag(tag, "1.16.0") as { refused: string }).refused, /not a beta's tag/, tag);
  assert.match((betaOfTag("v1.16.0-beta.5", "1.16.0") as { refused: string }).refused, /not newer than the sources' 1\.16\.0/);
  assert.match((betaOfTag("v1.15.9-beta.1", "1.16.0") as { refused: string }).refused, /not newer/);
  assert.match((betaOfTag("v1.17.0-beta.1", "1.18.0-rc.1") as { refused: string }).refused, /not newer/);
  assert.match((betaOfTag("v1.17.0-beta.1", "x") as { refused: string }).refused, /package\.json/);
});

test("npm 11.5.1 or newer publishes through trusted publishing", () => {
  for (const v of ["11.5.1", "11.6.0", "11.19.1\n", "12.0.0"]) assert.ok(npmPublishesTrusted(v), v);
  for (const v of ["11.5.0", "11.4.2", "10.9.3", ""]) assert.ok(!npmPublishesTrusted(v), v);
});

test("npm's answer read: versions and dist-tags; a package never published has none; another error fails", () => {
  const json = JSON.stringify({ versions: ["1.16.0-beta.4", "1.16.0"], "dist-tags": { latest: "1.16.0", beta: "1.16.0" } });
  assert.deepEqual(readRegistry(json, 0), { versions: ["1.16.0-beta.4", "1.16.0"], tags: { latest: "1.16.0", beta: "1.16.0" } });
  assert.deepEqual(readRegistry(JSON.stringify({ versions: "1.0.0", "dist-tags": { latest: "1.0.0" } }), 0).versions, ["1.0.0"], "one version: npm gives a string");
  assert.deepEqual(readRegistry(JSON.stringify({ error: { code: "E404", summary: "Not Found" } }), 1), { versions: [], tags: {} });
  assert.throws(() => readRegistry(JSON.stringify({ error: { code: "ECONNRESET", summary: "network" } }), 1), /network/);
  assert.throws(() => readRegistry("", 1), /exit 1/);
});

test("the beta's tarball checked before it goes out: its version, publishConfig.tag beta, the package's files only", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "strom-npm-tarball-"));
  // a tarball as npm pack writes one (ustar headers), of the given files
  const tgz = (files: Record<string, string>) => {
    const blocks: Buffer[] = [];
    for (const [name, text] of Object.entries(files)) {
      const data = Buffer.from(text);
      const head = Buffer.alloc(512);
      head.write(`package/${name}`, 0);
      head.write("0000644\0", 100);
      head.write(data.length.toString(8).padStart(11, "0") + "\0", 124);
      head.write("ustar\0", 257);
      blocks.push(head, data, Buffer.alloc((512 - (data.length % 512)) % 512));
    }
    const file = path.join(dir, `t${fs.readdirSync(dir).length}.tgz`);
    fs.writeFileSync(file, zlib.gzipSync(Buffer.concat([...blocks, Buffer.alloc(1024)])));
    return file;
  };
  const pkg = (over: object = {}) => JSON.stringify({ name: "strom-research", version: "1.17.0-beta.2", publishConfig: { tag: "beta" }, ...over });
  const rest = { LICENSE: "x", "README.md": "x", "CHANGELOG.md": "x", "CHANGELOG.cs.md": "x", "CHANGELOG.de.md": "x", "dist/cli.js": "x", "assets/a.json": "{}" };
  assert.equal(tarballRefusal(tgz({ "package.json": pkg(), ...rest }), "1.17.0-beta.2"), undefined);
  assert.match(tarballRefusal(tgz({ "package.json": pkg(), ...rest }), "1.17.0-beta.3")!, /version 1\.17\.0-beta\.2, not 1\.17\.0-beta\.3/);
  assert.match(tarballRefusal(tgz({ "package.json": pkg({ publishConfig: {} }), ...rest }), "1.17.0-beta.2")!, /publishConfig\.tag is missing/);
  assert.match(tarballRefusal(tgz({ "package.json": pkg({ publishConfig: { tag: "latest" } }), ...rest }), "1.17.0-beta.2")!, /not beta/);
  assert.match(tarballRefusal(tgz({ "package.json": pkg({ name: "other" }), ...rest }), "1.17.0-beta.2")!, /not strom-research/);
  assert.match(tarballRefusal(tgz({ "package.json": pkg(), ...rest, "src/cli.ts": "x", ".npmrc": "x" }), "1.17.0-beta.2")!, /beyond the package's: src\/cli\.ts, \.npmrc/);
  const { "CHANGELOG.de.md": _, ...noDe } = rest;
  assert.match(tarballRefusal(tgz({ "package.json": pkg(), ...noDe }), "1.17.0-beta.2")!, /missing CHANGELOG\.de\.md/);
  assert.match(tarballRefusal(tgz(rest), "1.17.0-beta.2")!, /no package\/package\.json/);
});

test("the workflow: a beta's tag only, trusted publishing (no token, no secret), the tag beta, the package built as the release builds it", () => {
  const yml = fs.readFileSync(path.join(ROOT, ".github", "workflows", "npm-beta.yml"), "utf8");
  const filters = [...yml.matchAll(/tags:\s*\[([^\]]*)\]/g)].flatMap((m) => m[1]!.split(",").map((t) => t.trim().replace(/^"|"$/g, "")));
  assert.deepEqual(filters, ["v*-beta.*"]);
  // GitHub's glob: * is anything but "/"
  const runs = (tag: string) => filters.some((f) => new RegExp(`^${f.replace(/\./g, "\\.").replace(/\*/g, "[^/]*")}$`).test(tag));
  for (const tag of ["v1.17.0-beta.1", "v2.0.0-beta.12"]) assert.ok(runs(tag), tag);
  for (const tag of ["v1.17.0", "v1.17.0-rc.1", "1.17.0-beta.1"]) assert.ok(!runs(tag), tag);
  assert.doesNotMatch(yml, /secrets\.|NPM_TOKEN|NODE_AUTH_TOKEN/);
  assert.equal(yml.match(/id-token: write/g)?.length, 1, "only the job that publishes");
  assert.match(yml, /publish:\n\s+needs: check\n\s+if: needs\.check\.outputs\.published == 'false'/);
  const publishes = yml.split("\n").filter((l) => /\bnpm publish\b/.test(l) && !l.trim().startsWith("#"));
  assert.equal(publishes.length, 1);
  assert.match(publishes[0]!, /npm publish "\.\/release-beta\/strom-research-\$VERSION\.tgz" --tag beta/);
  assert.match(yml, /npm run release -- --version "\$VERSION" --out release-beta/);
  assert.match(yml, /npm-beta-ci\.ts tarball/);
  assert.match(yml, /npm-beta-ci\.ts after "\$VERSION" "\$LATEST"/);
  assert.doesNotMatch(yml, /dist-tag (add|rm)/);
  // after the publish npm takes minutes to show the version (1.17.0-beta.2: more than one): asked for 5+ minutes,
  // within the publishing job's time with its build
  const waits = AFTER_TRIES * 20;
  assert.ok(waits >= 300, `${waits} s`);
  const publishMinutes = Number(/publish:[\s\S]*?timeout-minutes: (\d+)/.exec(yml)?.[1]);
  assert.ok(waits / 60 + 10 <= publishMinutes, `${waits} s of waiting within ${publishMinutes} min`);
});
