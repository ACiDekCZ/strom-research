// The steps of `.github/workflows/npm-beta.yml`: a beta's tag pushed, its npm package goes out under the tag beta —
// through npm's trusted publishing, no token. A release (vX.Y.Z) is never published here: it stays the person's.
//
//   node scripts/npm-beta-ci.ts npm                 npm publishes through trusted publishing (11.5.1 or newer)?
//   node scripts/npm-beta-ci.ts prepare <tag>       the beta of the tag; is it on npm already; npm's latest now
//   node scripts/npm-beta-ci.ts tarball <file> <v>  the tarball is the beta's package: version, publishConfig.tag beta, files
//   node scripts/npm-beta-ci.ts after <v> <latest>  the beta on npm, latest untouched
//
// prepare and after write what they found to $GITHUB_OUTPUT (when set) as key=value lines. Each fails (exit 1) with
// one sentence; a beta on npm already is no failure: published=true, and the workflow publishes nothing.

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { betaOfTag, npmPublishesTrusted, releaseKind, tarballRefusal } from "./npm-channel.ts";

const NAME = "strom-research";

/** What npm knows of the package: its versions and dist-tags (asked anew, never from a cache). */
export interface Registry {
  versions: string[];
  tags: Record<string, string>;
}

/** npm's answer to `npm view <name> versions dist-tags --json` read; a package never published: none. */
export function readRegistry(stdout: string, status: number | null): Registry {
  const json = stdout.trim() ? JSON.parse(stdout) : {};
  if (status !== 0) {
    if (json?.error?.code === "E404") return { versions: [], tags: {} };
    throw new Error(`npm view ${NAME}: ${json?.error?.summary ?? `exit ${status}`}`);
  }
  const versions = json.versions === undefined ? [] : [json.versions].flat();
  return { versions, tags: json["dist-tags"] ?? {} };
}

function registry(): Registry {
  const r = spawnSync("npm", ["view", NAME, "versions", "dist-tags", "--json", "--prefer-online"], { encoding: "utf8", shell: process.platform === "win32" });
  return readRegistry(r.stdout, r.status);
}

function output(values: Record<string, string>): void {
  const lines = Object.entries(values).map(([k, v]) => `${k}=${v}`);
  for (const line of lines) console.log(line);
  if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, lines.join("\n") + "\n");
}

function fail(why: string): never {
  console.error(why);
  process.exit(1);
}

function main(args: string[]): void {
  const [step, a, b] = args;
  if (step === "npm") {
    const r = spawnSync("npm", ["--version"], { encoding: "utf8", shell: process.platform === "win32" });
    const npm = r.stdout.trim();
    if (r.status !== 0 || !npmPublishesTrusted(npm)) fail(`npm ${npm || "?"}: trusted publishing needs npm 11.5.1 or newer`);
    console.log(`npm ${npm}: publishes through trusted publishing`);
    return;
  }
  if (step === "prepare" && a) {
    const sources = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, "..", "package.json"), "utf8")).version as string;
    const version = betaOfTag(a, sources);
    if (typeof version === "object") fail(version.refused);
    const npm = registry();
    const latest = npm.tags.latest ?? "";
    if (latest && releaseKind(latest) !== "release") fail(`npm's latest is a beta (${latest}): nothing is published until a person puts it right`);
    output({ version, published: String(npm.versions.includes(version)), latest });
    return;
  }
  if (step === "tarball" && a && b) {
    const why = tarballRefusal(a, b);
    if (why) fail(why);
    console.log(`${path.basename(a)}: ${b}, publishConfig.tag beta, the package's files only`);
    return;
  }
  if (step === "after" && a && b !== undefined) {
    // the registry may show a new version a moment later: asked again a few times
    let npm = registry();
    for (let i = 0; i < 6 && !npm.versions.includes(a); i++) {
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 10_000);
      npm = registry();
    }
    if ((npm.tags.latest ?? "") !== b) fail(`npm's latest moved: ${b || "none"} → ${npm.tags.latest ?? "none"} — a person puts it back (npm dist-tag add ${NAME}@${b} latest)`);
    if (!npm.versions.includes(a)) fail(`${a} is not on npm`);
    // npm's dist-tags may follow a moment later: said, not failed
    if (npm.tags.beta !== a) console.log(`npm's beta is ${npm.tags.beta ?? "none"} for now (not yet ${a})`);
    output({ latest: npm.tags.latest ?? "", beta: npm.tags.beta ?? "" });
    return;
  }
  fail("usage: node scripts/npm-beta-ci.ts npm | prepare <tag> | tarball <file> <version> | after <version> <latest before>");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main(process.argv.slice(2));
  } catch (e) {
    fail((e as Error).message);
  }
}
