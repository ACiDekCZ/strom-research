// Which npm dist-tag a version of strom goes out with: a release under `latest`, a beta (X.Y.Z-beta.N) under `beta`
// only — npm's `latest` never gets a beta, a beta never moves `latest`. A candidate (X.Y.Z-rc.N) stays local.
//
// Run by `prepublishOnly` (`npm publish` from the sources' folder): it refuses a version that does not match its tag.
// npm runs no script of a package published from a tarball (`npm publish <file>.tgz`), so the beta's tarball made by
// scripts/build-release.ts carries `publishConfig.tag: "beta"` too: without --tag it goes under `beta` (npm 11 itself
// refuses a prerelease without a tag when nothing names one). A release's tarball carries no tag of its own (npm's
// default, latest), never beta.

import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

/** What a version is: a release, a beta (published under the tag beta) or a local candidate (rc); anything else: why not. */
export function releaseKind(version: string): "release" | "beta" | "rc" | { refused: string } {
  const m = /^\d+\.\d+\.\d+(?:-(.+))?$/.exec(version);
  if (!m) return { refused: `${version}: not a version (X.Y.Z, X.Y.Z-beta.N or X.Y.Z-rc.N)` };
  const pre = m[1];
  if (pre === undefined) return "release";
  if (/^beta\.(0|[1-9]\d*)$/.test(pre)) return "beta";
  if (/^rc\.(0|[1-9]\d*)$/.test(pre)) return "rc";
  return { refused: `${version}: a prerelease is beta.N (published under the tag beta) or rc.N (a local candidate)` };
}

/** Why `npm publish` of this version under this tag is refused (npm's tag: `npm_config_tag`, unset = latest), else undefined. */
export function publishRefusal(version: string, tag: string | undefined): string | undefined {
  const kind = releaseKind(version);
  const as = tag?.trim() || "latest";
  if (typeof kind === "object") return `${kind.refused}. Nothing is published.`;
  if (kind === "rc") return `${version} is a local candidate: it is not published to npm. A beta: npm run release -- --version X.Y.Z-beta.N --out release-beta`;
  if (kind === "beta" && as !== "beta")
    return `${version} is a beta: it goes out under the tag beta only, never "${as}". Run: ${publishLine(`release-beta/${tarballName(version)}`)}`;
  if (kind === "release" && as === "beta") return `${version} is a release: it goes out under latest. Run: npm publish (without --tag beta)`;
  return undefined;
}

/** The file npm pack names for this version. */
export const tarballName = (version: string) => `strom-research-${version}.tgz`;

/** npm's dist-tag a version goes out under: a beta under beta, a release under latest; a candidate or anything else none. */
export function npmTagOf(version: string): "beta" | "latest" | undefined {
  const kind = releaseKind(version);
  return kind === "beta" ? "beta" : kind === "release" ? "latest" : undefined;
}

/**
 * The line that publishes a tarball by hand (Milan's, in his own terminal): its path always a path to npm — "./" before
 * a relative one (npm took "release-beta/strom-research-….tgz" for a GitHub repository, user/repo), quoted with a space.
 */
export const publishLine = (file: string, tag: "beta" | "latest" = "beta") => {
  const local = path.isAbsolute(file) || /^\.\.?[\\/]/.test(file) ? file : `./${file.replace(/\\/g, "/")}`;
  return `npm publish ${/\s/.test(local) ? `"${local}"` : local} --tag ${tag}`;
};

/**
 * The npm tarball of a staged package (its package.json, dist/, assets/, LICENSE, README.md), as `npm publish` would
 * send it, into `out`. A beta's gets `publishConfig.tag` beta written into it first — a tarball's publish runs no
 * prepublishOnly; a release's package.json stays as the sources have it (no tag of its own: npm's latest), never beta.
 */
export function packForNpm(stage: string, out: string): string {
  const pkgFile = path.join(stage, "package.json");
  const pkg = JSON.parse(fs.readFileSync(pkgFile, "utf8"));
  const tag = npmTagOf(pkg.version);
  if (!tag) throw new Error(`${pkg.version}: only a beta's or a release's npm tarball is built (a candidate stays local)`);
  const own = pkg.publishConfig?.tag;
  if (tag === "beta") fs.writeFileSync(pkgFile, JSON.stringify({ ...pkg, publishConfig: { ...pkg.publishConfig, tag: "beta" } }, null, 2) + "\n");
  else if (own !== undefined && own !== "latest") throw new Error(`package.json: publishConfig.tag ${own} — a release goes out under latest`);
  const r = spawnSync("npm", ["pack", "--ignore-scripts", "--json", "--pack-destination", out], {
    cwd: stage,
    encoding: "utf8",
    shell: process.platform === "win32",
    env: { ...process.env, COPYFILE_DISABLE: "1" },
  });
  if (r.status !== 0) throw new Error(`npm pack failed (${r.status ?? r.error?.message}): ${r.stderr}`);
  const file = path.join(out, JSON.parse(r.stdout)[0].filename as string);
  if (path.basename(file) !== tarballName(pkg.version) || !fs.existsSync(file)) throw new Error(`npm pack: ${file} not made`);
  return file;
}

/** The numbers of X.Y.Z, for comparing. */
const triple = (version: string) => version.split("-")[0]!.split(".").map(Number) as [number, number, number];
const newer = (a: number[], b: number[]) => a[0]! - b[0]! || a[1]! - b[1]! || a[2]! - b[2]!;

/** What a pushed tag publishes: its version under npm's tag; nothing (a candidate's or another tag: a green run); or refused. */
export type TagPublish = { version: string; tag: "beta" | "latest" } | { skip: string } | { refused: string };

/**
 * What a pushed tag publishes (`.github/workflows/npm-beta.yml`). A beta's tag vX.Y.Z-beta.N: the beta under beta — the
 * sources at the tag keep their own version (the release before, or the candidate X.Y.Z-rc.N being made), the beta is
 * newer than a release there, of the same X.Y.Z or newer than a candidate. A release's tag vX.Y.Z: the release under
 * latest — exactly the sources' version at the tag (the release's commit says it). Any other tag (a candidate's -rc.N,
 * another suffix, no v): nothing, no failure.
 */
export function publishOfTag(tag: string, sources: string): TagPublish {
  const version = tag.startsWith("v") ? tag.slice(1) : "";
  const tagged = npmTagOf(version);
  if (!tagged) return { skip: `${tag}: neither a release's tag (vX.Y.Z) nor a beta's (vX.Y.Z-beta.N): nothing is published` };
  if (tagged === "latest")
    return version === sources ? { version, tag: "latest" } : { refused: `${tag}: the sources at the tag say ${sources}, not ${version} — a release's tag is v and the version of its package.json` };
  const own = releaseKind(sources);
  if (typeof own === "object") return { refused: `package.json: ${own.refused}` };
  const by = newer(triple(version), triple(sources));
  if (by < 0 || (by === 0 && own === "release")) return { refused: `${version} is not newer than the sources' ${sources}` };
  return { version, tag: "beta" };
}

/**
 * Whether npm's beta follows a release just published: when the release is newer than the beta it shows, or there is
 * none. strom installed with `npm install -g strom-research@beta` is told of the release by strom update (the beta
 * channel takes the newest of every release on GitHub, the release too) and is told to install it through the tag beta;
 * a newer beta keeps the tag.
 */
export function betaFollows(release: string, beta: string | undefined): boolean {
  if (!beta) return true;
  const by = newer(triple(release), triple(beta));
  return by > 0 || (by === 0 && releaseKind(beta) !== "release");
}

/** The files of a beta's npm tarball beside dist/ and assets/ (npm adds package.json; `files` and README.md, LICENSE). */
const PACKAGE_FILES = ["package.json", "LICENSE", "README.md", "CHANGELOG.md", "CHANGELOG.cs.md", "CHANGELOG.de.md"];

/** The entries of a .tar.gz, read from its headers (ustar: the prefix, then the name), with their contents. */
export function tarEntries(file: string): { name: string; data: Buffer }[] {
  const tar = zlib.gunzipSync(fs.readFileSync(file));
  const entries: { name: string; data: Buffer }[] = [];
  const text = (at: number, len: number) => tar.subarray(at, at + len).toString("utf8").replace(/\0.*$/s, "");
  for (let at = 0; at + 512 <= tar.length; ) {
    const name = text(at, 100);
    if (!name) break;
    const prefix = text(at + 345, 155);
    const size = parseInt(text(at + 124, 12).trim() || "0", 8);
    entries.push({ name: prefix ? `${prefix}/${name}` : name, data: tar.subarray(at + 512, at + 512 + size) });
    at += 512 + Math.ceil(size / 512) * 512;
  }
  return entries;
}

/**
 * Why an npm tarball is not what goes out — its version, its tag (a beta's `publishConfig.tag` beta; a release's none
 * or latest, never beta), the package's files only — else undefined.
 */
export function tarballRefusal(file: string, version: string): string | undefined {
  const entries = tarEntries(file);
  const pkg = entries.find((e) => e.name === "package/package.json");
  if (!pkg) return `${path.basename(file)}: no package/package.json`;
  const json = JSON.parse(pkg.data.toString("utf8"));
  if (json.name !== "strom-research") return `${path.basename(file)}: the package is ${json.name}, not strom-research`;
  if (json.version !== version) return `${path.basename(file)}: version ${json.version}, not ${version}`;
  const tagged = npmTagOf(version);
  const own = json.publishConfig?.tag;
  if (!tagged) return `${version}: neither a beta nor a release — not published`;
  if (tagged === "beta" && own !== "beta") return `${path.basename(file)}: publishConfig.tag is ${own ?? "missing"}, not beta`;
  if (tagged === "latest" && own !== undefined && own !== "latest") return `${path.basename(file)}: publishConfig.tag is ${own} — a release goes out under latest`;
  const names = entries.map((e) => e.name.replace(/^package\//, ""));
  const odd = names.filter((n) => !/^(dist|assets)\//.test(n) && !PACKAGE_FILES.includes(n));
  if (odd.length) return `${path.basename(file)}: files beyond the package's: ${odd.join(", ")}`;
  const missing = PACKAGE_FILES.filter((f) => !names.includes(f));
  if (missing.length || !names.includes("dist/cli.js")) return `${path.basename(file)}: missing ${[...missing, ...(names.includes("dist/cli.js") ? [] : ["dist/cli.js"])].join(", ")}`;
  return undefined;
}

/** npm 11.5.1 or newer: the first that publishes through trusted publishing (OIDC). */
export const npmPublishesTrusted = (npm: string) => newer(triple(npm.trim()), [11, 5, 1]) >= 0;

/**
 * npm that moves a dist-tag through trusted publishing: 11.21.0 or newer of npm 11, 12.2.0 or newer (npm's docs,
 * "Managing dist-tags with trusted publishing"; the package's trusted publisher must allow npm dist-tag too).
 */
export const npmTagsTrusted = (npm: string) => {
  const v = triple(npm.trim());
  return v[0] === 11 ? newer(v, [11, 21, 0]) >= 0 : newer(v, [12, 2, 0]) >= 0;
};

// prepublishOnly: `node scripts/npm-channel.ts`
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const version = process.env.npm_package_version ?? JSON.parse(fs.readFileSync(path.join(import.meta.dirname, "..", "package.json"), "utf8")).version;
  const why = publishRefusal(version, process.env.npm_config_tag);
  if (why) {
    console.error(why);
    process.exit(1);
  }
}
