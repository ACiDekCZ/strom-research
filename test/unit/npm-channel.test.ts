// npm's tags: a beta goes out under `beta` only, a release under `latest` only, a candidate (rc) nowhere. Guarded by
// prepublishOnly (a publish from the sources' folder) and, since npm runs no script of a tarball it publishes, by the
// beta tarball's own publishConfig.tag (a release's tarball has none: latest). The release build refuses any other
// prerelease before it builds anything. The workflow npm-beta.yml publishes a beta's tag and a release's tag.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import zlib from "node:zlib";
import { spawnSync } from "node:child_process";
import { betaFollows, npmPublishesTrusted, npmTagOf, npmTagsTrusted, packForNpm, publishLine, publishOfTag, publishRefusal, releaseKind, tarballName, tarballRefusal, tarEntries } from "../../scripts/npm-channel.ts";
import { AFTER_TRIES, afterState, betaMove, prepareState, readRegistry } from "../../scripts/npm-beta-ci.ts";

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

test("a beta's npm tarball: what npm pack publishes, the version as staged, publishConfig.tag beta; a release's: no tag of its own; an rc's: none", { skip: !hasNpm }, () => {
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
  write("1.13.0-rc.1");
  assert.throws(() => packForNpm(stage, out), /only a beta's or a release's/);
  // a release: its package.json as the sources have it, never the tag beta
  write("1.13.0");
  const release = packForNpm(stage, out);
  assert.equal(path.basename(release), "strom-research-1.13.0.tgz");
  const packed = JSON.parse(tarEntries(release).find((e) => e.name === "package/package.json")!.data.toString("utf8"));
  assert.equal(packed.version, "1.13.0");
  assert.equal(packed.publishConfig, undefined, "npm's default tag, latest");
  fs.writeFileSync(path.join(stage, "package.json"), JSON.stringify({ ...pkg, version: "1.13.0", publishConfig: { tag: "beta" } }));
  assert.throws(() => packForNpm(stage, out), /publishConfig\.tag beta — a release goes out under latest/);
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

test("what a pushed tag publishes: a beta newer than the sources under beta, a release of the sources' version under latest, anything else nothing", () => {
  assert.equal(npmTagOf("1.17.0-beta.1"), "beta");
  assert.equal(npmTagOf("1.17.0"), "latest");
  assert.equal(npmTagOf("1.17.0-rc.1"), undefined);
  assert.equal(npmTagOf("1.17.0-alpha.1"), undefined);
  // a beta's tag: under beta, never latest
  assert.deepEqual(publishOfTag("v1.17.0-beta.1", "1.16.0"), { version: "1.17.0-beta.1", tag: "beta" });
  assert.deepEqual(publishOfTag("v1.17.0-beta.12", "1.17.0-rc.3"), { version: "1.17.0-beta.12", tag: "beta" }, "a candidate of the same version");
  assert.deepEqual(publishOfTag("v2.0.0-beta.1", "1.16.0"), { version: "2.0.0-beta.1", tag: "beta" });
  assert.match((publishOfTag("v1.16.0-beta.5", "1.16.0") as { refused: string }).refused, /not newer than the sources' 1\.16\.0/);
  assert.match((publishOfTag("v1.15.9-beta.1", "1.16.0") as { refused: string }).refused, /not newer/);
  assert.match((publishOfTag("v1.17.0-beta.1", "1.18.0-rc.1") as { refused: string }).refused, /not newer/);
  assert.match((publishOfTag("v1.17.0-beta.1", "x") as { refused: string }).refused, /package\.json/);
  // a release's tag: exactly the version of the package.json at the tag, under latest, never beta
  assert.deepEqual(publishOfTag("v1.17.0", "1.17.0"), { version: "1.17.0", tag: "latest" });
  for (const sources of ["1.16.0", "1.17.0-rc.4", "1.17.1", "1.17.0-beta.3"])
    assert.match((publishOfTag("v1.17.0", sources) as { refused: string }).refused, new RegExp(`the sources at the tag say ${sources.replace(/\./g, "\\.")}, not 1\\.17\\.0`), sources);
  // a candidate's tag, another suffix, no v: nothing, no failure
  for (const tag of ["v1.17.0-rc.1", "1.17.0-beta.1", "1.17.0", "v1.17.0-beta", "v1.17.0-beta.01", "v1.17.0-beta.1-x", "v1.17.0-next.1", "v1.17", "vx", ""])
    assert.match((publishOfTag(tag, "1.17.0") as { skip: string }).skip, /nothing is published/, tag);
});

test("npm 11.5.1 or newer publishes through trusted publishing; 11.21.0 or 12.2.0 and newer moves a dist-tag through it", () => {
  for (const v of ["11.5.1", "11.6.0", "11.19.1\n", "12.0.0"]) assert.ok(npmPublishesTrusted(v), v);
  for (const v of ["11.5.0", "11.4.2", "10.9.3", ""]) assert.ok(!npmPublishesTrusted(v), v);
  for (const v of ["11.21.0", "11.21.1\n", "11.30.0", "12.2.0", "12.10.1", "13.0.0"]) assert.ok(npmTagsTrusted(v), v);
  for (const v of ["11.20.9", "11.6.0", "12.0.0", "12.1.9", "10.9.3", ""]) assert.ok(!npmTagsTrusted(v), v);
});

test("prepare: npm's latest a beta refused; a release older than latest refused; a version on npm already published=true", () => {
  const npm = (latest: string, versions: string[] = [latest], beta?: string) => ({ versions, tags: { latest, ...(beta ? { beta } : {}) } });
  assert.deepEqual(prepareState("1.17.0-beta.4", npm("1.16.0")), { published: false, latest: "1.16.0" });
  assert.deepEqual(prepareState("1.17.0-beta.4", npm("1.16.0", ["1.16.0", "1.17.0-beta.4"])), { published: true, latest: "1.16.0" });
  assert.deepEqual(prepareState("1.17.0", npm("1.16.0")), { published: false, latest: "1.16.0" });
  assert.deepEqual(prepareState("1.17.0", npm("1.17.0", ["1.16.0", "1.17.0"])), { published: true, latest: "1.17.0" }, "run again: nothing");
  assert.deepEqual(prepareState("1.17.0", { versions: [], tags: {} }), { published: false, latest: "" });
  assert.match((prepareState("1.16.1", npm("1.17.0")) as { refused: string }).refused, /latest is 1\.17\.0, newer than 1\.16\.1/);
  for (const v of ["1.17.0", "1.17.0-beta.4"]) assert.match((prepareState(v, npm("1.17.0-beta.3")) as { refused: string }).refused, /latest is a beta/, v);
});

test("after the publish: a beta leaves latest as it was; a release is latest and never beta; npm not caught up yet is waited for", () => {
  const npm = (versions: string[], tags: Record<string, string>) => ({ versions, tags });
  // a beta
  assert.equal(afterState("1.17.0-beta.4", "1.16.0", npm(["1.16.0", "1.17.0-beta.4"], { latest: "1.16.0", beta: "1.17.0-beta.4" })), undefined);
  assert.equal(afterState("1.17.0-beta.4", "1.16.0", npm(["1.16.0", "1.17.0-beta.4"], { latest: "1.16.0", beta: "1.17.0-beta.3" })), undefined, "beta's tag a moment later: no failure");
  assert.equal(afterState("1.17.0-beta.4", "1.16.0", npm(["1.16.0"], { latest: "1.16.0" })), "wait");
  assert.match((afterState("1.17.0-beta.4", "1.16.0", npm(["1.16.0", "1.17.0-beta.4"], { latest: "1.17.0-beta.4" })) as { refused: string }).refused, /latest moved: 1\.16\.0 → 1\.17\.0-beta\.4.*npm dist-tag add strom-research@1\.16\.0 latest/);
  // a release
  assert.equal(afterState("1.17.0", "1.16.0", npm(["1.16.0", "1.17.0"], { latest: "1.17.0", beta: "1.17.0-beta.4" })), undefined);
  assert.equal(afterState("1.17.0", "1.16.0", npm(["1.16.0"], { latest: "1.16.0" })), "wait");
  assert.equal(afterState("1.17.0", "1.16.0", npm(["1.16.0", "1.17.0"], { latest: "1.16.0" })), "wait", "latest a moment later");
  assert.match((afterState("1.17.0", "1.16.0", npm(["1.16.0", "1.17.0"], { latest: "1.16.0", beta: "1.17.0" })) as { refused: string }).refused, /went out under npm's beta/);
});

test("npm's beta follows a release only when the release is newer than the beta it shows", () => {
  assert.ok(betaFollows("1.17.0", "1.17.0-beta.4"), "the release of the beta");
  assert.ok(betaFollows("1.17.0", "1.16.0"), "moved to the release before");
  assert.ok(betaFollows("1.17.0", "1.16.3-beta.1"));
  assert.ok(betaFollows("1.17.0", undefined), "no beta yet");
  assert.ok(!betaFollows("1.17.0", "1.18.0-beta.1"), "the next minor's beta out already");
  assert.ok(!betaFollows("1.17.0", "1.17.1-beta.1"));
  assert.ok(!betaFollows("1.17.0", "1.17.0"), "there already");
  const npm = (beta?: string) => ({ versions: [], tags: { latest: "1.17.0", ...(beta ? { beta } : {}) } });
  assert.deepEqual(betaMove("1.17.0", npm("1.17.0-beta.4")), ["dist-tag", "add", "strom-research@1.17.0", "beta"]);
  assert.equal(betaMove("1.17.0", npm("1.18.0-beta.1")), undefined);
  assert.throws(() => betaMove("1.17.0-beta.4", npm("1.17.0-beta.3")), /only a release/);
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
  // a release's: no tag of its own (or latest), never beta
  const release = (over: object = {}) => pkg({ version: "1.17.0", publishConfig: undefined, ...over });
  assert.equal(tarballRefusal(tgz({ "package.json": release(), ...rest }), "1.17.0"), undefined);
  assert.equal(tarballRefusal(tgz({ "package.json": release({ publishConfig: { tag: "latest" } }), ...rest }), "1.17.0"), undefined);
  assert.match(tarballRefusal(tgz({ "package.json": release({ publishConfig: { tag: "beta" } }), ...rest }), "1.17.0")!, /publishConfig\.tag is beta — a release goes out under latest/);
  assert.match(tarballRefusal(tgz({ "package.json": release(), ...rest }), "1.17.1")!, /version 1\.17\.0, not 1\.17\.1/);
  assert.match(tarballRefusal(tgz({ "package.json": pkg({ version: "1.17.0-rc.2" }), ...rest }), "1.17.0-rc.2")!, /neither a beta nor a release/);
});

test("the workflow npm-beta.yml: a beta's tag and a release's, trusted publishing (no token, no secret), each under its own tag, the package built as the release builds it", () => {
  // the file keeps its name: npm's trusted publisher of the package names it
  const yml = fs.readFileSync(path.join(ROOT, ".github", "workflows", "npm-beta.yml"), "utf8");
  const filters = [...yml.matchAll(/^\s*tags:\s*\[(.*)\]\s*$/gm)].flatMap((m) => m[1]!.split(",").map((t) => t.trim().replace(/^"|"$/g, "")));
  assert.deepEqual(filters, ["v*-beta.*", "v[0-9]+.[0-9]+.[0-9]+"]);
  // GitHub's filter on the whole tag name: * is anything but "/", [0-9] one of them, + one or more of what is before it
  const runs = (tag: string) => filters.some((f) => new RegExp(`^${f.replace(/\./g, "\\.").replace(/\*/g, "[^/]*")}$`).test(tag));
  for (const tag of ["v1.17.0-beta.1", "v2.0.0-beta.12", "v1.17.0", "v10.0.12"]) assert.ok(runs(tag), tag);
  for (const tag of ["v1.17.0-rc.1", "1.17.0-beta.1", "1.17.0", "v1.17", "v1.17.0-next.1", "v1.17.0.1", "release-1.17.0"]) assert.ok(!runs(tag), tag);
  // and what runs, the script decides again: a candidate's tag or another suffix publishes nothing
  for (const tag of ["v1.17.0-beta.1", "v1.17.0"]) assert.ok("version" in publishOfTag(tag, tag === "v1.17.0" ? "1.17.0" : "1.16.0"), tag);
  assert.doesNotMatch(yml, /secrets\.|NPM_TOKEN|NODE_AUTH_TOKEN/);
  assert.equal(yml.match(/id-token: write/g)?.length, 1, "only the job that publishes");
  assert.match(yml, /publish:\n\s+needs: check\n\s+if: needs\.check\.outputs\.publish == 'true'/);
  assert.match(yml, /node scripts\/npm-beta-ci\.ts prepare "\$GITHUB_REF_NAME"/);
  // two publishes, each its tag written out and only for its own kind: a beta never under latest, a release never under beta
  const lines = yml.split("\n");
  const publishes = lines.flatMap((l, i) => (/\bnpm publish\b/.test(l) && !l.trim().startsWith("#") ? [{ line: l, when: lines[i - 1]!.trim() }] : []));
  assert.equal(publishes.length, 2);
  assert.match(publishes[0]!.line, /npm publish "\.\/release-beta\/strom-research-\$VERSION\.tgz" --tag beta --access public$/);
  assert.equal(publishes[0]!.when, "if: env.NPM_TAG == 'beta'");
  assert.match(publishes[1]!.line, /npm publish "\.\/release\/strom-research-\$VERSION\.tgz" --tag latest --access public$/);
  assert.equal(publishes[1]!.when, "if: env.NPM_TAG == 'latest'");
  assert.match(yml, /NPM_TAG: \$\{\{ needs\.check\.outputs\.tag \}\}/);
  assert.match(yml, /npm run release -- --version "\$VERSION" --out "\$OUT"/);
  assert.match(yml, /npm-beta-ci\.ts npm "\$NPM_TAG"/);
  assert.match(yml, /npm-beta-ci\.ts tarball "\$OUT\/strom-research-\$VERSION\.tgz" "\$VERSION"/);
  assert.match(yml, /npm-beta-ci\.ts after "\$VERSION" "\$LATEST"/);
  // npm's beta follows a release in its own step, after latest is checked; the workflow itself moves no tag
  assert.match(yml, /npm-beta-ci\.ts after[\s\S]*if: env\.NPM_TAG == 'latest'\n\s+run: \|\n\s+node scripts\/npm-beta-ci\.ts beta "\$VERSION"/);
  assert.doesNotMatch(yml, /dist-tag (add|rm)/);
  // after the publish npm takes minutes to show the version (1.17.0-beta.2: more than one): asked for 5+ minutes,
  // within the publishing job's time with its build
  const waits = AFTER_TRIES * 20;
  assert.ok(waits >= 300, `${waits} s`);
  const publishMinutes = Number(/publish:[\s\S]*?timeout-minutes: (\d+)/.exec(yml)?.[1]);
  assert.ok(waits / 60 + 10 <= publishMinutes, `${waits} s of waiting within ${publishMinutes} min`);
});
