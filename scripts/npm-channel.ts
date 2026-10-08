// Which npm dist-tag a version of strom goes out with: a release under `latest`, a beta (X.Y.Z-beta.N) under `beta`
// only — npm's `latest` never gets a beta, a beta never moves `latest`. A candidate (X.Y.Z-rc.N) stays local.
//
// Run by `prepublishOnly` (`npm publish` from the sources' folder): it refuses a version that does not match its tag.
// npm runs no script of a package published from a tarball (`npm publish <file>.tgz`), so the beta's tarball made by
// scripts/build-release.ts carries `publishConfig.tag: "beta"` too: without --tag it goes under `beta` (npm 11 itself
// refuses a prerelease without a tag when nothing names one).

import fs from "node:fs";
import path from "node:path";
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

/**
 * The line that publishes a beta's tarball (Milan's, in his own terminal): its path always a path to npm — "./" before
 * a relative one (npm took "release-beta/strom-research-….tgz" for a GitHub repository, user/repo), quoted with a space.
 */
export const publishLine = (file: string) => {
  const local = path.isAbsolute(file) || /^\.\.?[\\/]/.test(file) ? file : `./${file.replace(/\\/g, "/")}`;
  return `npm publish ${/\s/.test(local) ? `"${local}"` : local} --tag beta`;
};

/**
 * The npm tarball of a staged package (its package.json, dist/, assets/, LICENSE, README.md), as `npm publish` would
 * send it, into `out`: `publishConfig.tag` beta written into it first — a tarball's publish runs no prepublishOnly.
 */
export function packForNpm(stage: string, out: string): string {
  const pkgFile = path.join(stage, "package.json");
  const pkg = JSON.parse(fs.readFileSync(pkgFile, "utf8"));
  const kind = releaseKind(pkg.version);
  if (kind !== "beta") throw new Error(`${pkg.version}: only a beta's npm tarball is built here (a release is published from the sources)`);
  fs.writeFileSync(pkgFile, JSON.stringify({ ...pkg, publishConfig: { ...pkg.publishConfig, tag: "beta" } }, null, 2) + "\n");
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

// prepublishOnly: `node scripts/npm-channel.ts`
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const version = process.env.npm_package_version ?? JSON.parse(fs.readFileSync(path.join(import.meta.dirname, "..", "package.json"), "utf8")).version;
  const why = publishRefusal(version, process.env.npm_config_tag);
  if (why) {
    console.error(why);
    process.exit(1);
  }
}
