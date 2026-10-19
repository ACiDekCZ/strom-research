// The steps of `.github/workflows/npm-beta.yml` (the file keeps its name: npm's trusted publisher names it): a tag
// pushed, its npm package goes out through npm's trusted publishing, no token. A beta's tag (vX.Y.Z-beta.N) under the
// tag beta, latest untouched; a release's tag (vX.Y.Z, the version of the package.json at the tag) under latest, then
// npm's beta follows it when the release is newer. Any other tag (a candidate's -rc.N): nothing, a green run.
//
//   node scripts/npm-beta-ci.ts npm [beta|latest]   npm publishes through trusted publishing (11.5.1 or newer)? a
//                                                   release: moves a dist-tag through it too (11.21.0 / 12.2.0 or newer)?
//   node scripts/npm-beta-ci.ts prepare <tag>       what the tag publishes; is it on npm already; npm's latest now
//   node scripts/npm-beta-ci.ts tarball <file> <v>  the tarball is the package: version, its tag (a beta's publishConfig.tag
//                                                   beta, a release's never beta), files
//   node scripts/npm-beta-ci.ts after <v> <latest>  the version on npm; a beta: latest untouched; a release: latest is it,
//                                                   beta not
//   node scripts/npm-beta-ci.ts beta <v>            a release: npm's beta follows it, when the release is newer
//
// prepare and after write what they found to $GITHUB_OUTPUT (when set) as key=value lines. Each fails (exit 1) with
// one sentence; a version on npm already is no failure: publish=false, and the workflow publishes nothing.

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { betaFollows, npmPublishesTrusted, npmTagOf, npmTagsTrusted, publishOfTag, releaseKind, tarballRefusal } from "./npm-channel.ts";

const NAME = "strom-research";
/** How many times `after` asks npm again for the new version, 20 s apart: up to 10 minutes. */
export const AFTER_TRIES = 30;

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

/** The numbers of X.Y.Z, compared: < 0 older, 0 the same numbers, > 0 newer. */
const byNumbers = (a: string, b: string) => {
  const [x, y] = [a, b].map((v) => v.split("-")[0]!.split(".").map(Number));
  return x![0]! - y![0]! || x![1]! - y![1]! || x![2]! - y![2]!;
};

/**
 * What `prepare` finds for a version about to go out: refused when npm's latest is a beta (a person puts it right), or
 * for a release when npm's latest is newer (latest never goes back); else whether it is published already.
 */
export function prepareState(version: string, npm: Registry): { refused: string } | { published: boolean; latest: string } {
  const latest = npm.tags.latest ?? "";
  if (latest && releaseKind(latest) !== "release") return { refused: `npm's latest is a beta (${latest}): nothing is published until a person puts it right` };
  const published = npm.versions.includes(version);
  if (!published && npmTagOf(version) === "latest" && latest && byNumbers(latest, version) > 0)
    return { refused: `npm's latest is ${latest}, newer than ${version}: a release older than latest is not published here` };
  return { published, latest };
}

/**
 * What npm shows after the publish: "wait" while it has not caught up yet (the version, and for a release its latest),
 * else why it is wrong, else undefined. A beta: latest exactly as before. A release: latest is it, and the publish
 * gave it no tag beta (npm's beta follows a release only in its own step, `beta`).
 */
export function afterState(version: string, latestBefore: string, npm: Registry): "wait" | { refused: string } | undefined {
  const latest = npm.tags.latest ?? "";
  if (npmTagOf(version) === "beta") {
    if (latest !== latestBefore) return { refused: `npm's latest moved: ${latestBefore || "none"} → ${latest || "none"} — a person puts it back (npm dist-tag add ${NAME}@${latestBefore} latest)` };
    return npm.versions.includes(version) ? undefined : "wait";
  }
  if (npm.tags.beta === version) return { refused: `${version} went out under npm's beta: a release goes out under latest only` };
  return npm.versions.includes(version) && latest === version ? undefined : "wait";
}

/** The arguments that move npm's beta to a release just published, or none when the beta it shows is newer. */
export function betaMove(release: string, npm: Registry): string[] | undefined {
  if (npmTagOf(release) !== "latest") throw new Error(`${release}: only a release moves npm's beta`);
  return betaFollows(release, npm.tags.beta) ? ["dist-tag", "add", `${NAME}@${release}`, "beta"] : undefined;
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

const pause = (ms: number) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

function main(args: string[]): void {
  const [step, a, b] = args;
  if (step === "npm") {
    const r = spawnSync("npm", ["--version"], { encoding: "utf8", shell: process.platform === "win32" });
    const npm = r.stdout.trim();
    if (r.status !== 0 || !npmPublishesTrusted(npm)) fail(`npm ${npm || "?"}: trusted publishing needs npm 11.5.1 or newer`);
    if (a === "latest" && !npmTagsTrusted(npm)) fail(`npm ${npm}: a dist-tag through trusted publishing needs npm 11.21.0 (npm 11) or 12.2.0 or newer`);
    console.log(`npm ${npm}: publishes through trusted publishing${a === "latest" ? ", moves a dist-tag through it" : ""}`);
    return;
  }
  if (step === "prepare" && a) {
    const sources = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, "..", "package.json"), "utf8")).version as string;
    const of = publishOfTag(a, sources);
    if ("refused" in of) fail(of.refused);
    if ("skip" in of) {
      console.log(of.skip);
      output({ publish: "false" });
      return;
    }
    const state = prepareState(of.version, registry());
    if ("refused" in state) fail(state.refused);
    if (state.published) console.log(`${of.version} is on npm already: nothing is published`);
    // the folder scripts/build-release.ts builds it into, as the release's own steps do
    output({ version: of.version, tag: of.tag, out: of.tag === "beta" ? "release-beta" : "release", publish: String(!state.published), latest: state.latest });
    return;
  }
  if (step === "tarball" && a && b) {
    const why = tarballRefusal(a, b);
    if (why) fail(why);
    console.log(`${path.basename(a)}: ${b}, ${npmTagOf(b) === "beta" ? "publishConfig.tag beta" : "no tag of its own (latest)"}, the package's files only`);
    return;
  }
  if (step === "after" && a && b !== undefined) {
    // the registry shows a new version only once it is processed ("may take a few minutes", npm says; 1.17.0-beta.2
    // took more than a minute): asked again every 20 s for up to 10 minutes
    let npm = registry();
    let state = afterState(a, b, npm);
    for (let i = 0; i < AFTER_TRIES && state === "wait"; i++) {
      pause(20_000);
      npm = registry();
      state = afterState(a, b, npm);
    }
    if (state === "wait") fail(npmTagOf(a) === "beta" || !npm.versions.includes(a) ? `${a} is not on npm` : `npm's latest is ${npm.tags.latest ?? "none"}, not ${a}`);
    if (state) fail(state.refused);
    // a beta: npm's dist-tags may follow a moment later — said, not failed
    if (npmTagOf(a) === "beta" && npm.tags.beta !== a) console.log(`npm's beta is ${npm.tags.beta ?? "none"} for now (not yet ${a})`);
    output({ latest: npm.tags.latest ?? "", beta: npm.tags.beta ?? "" });
    return;
  }
  if (step === "beta" && a) {
    const move = betaMove(a, registry());
    if (!move) {
      console.log(`npm's beta is newer than ${a}: it stays`);
      return;
    }
    const r = spawnSync("npm", move, { encoding: "utf8", shell: process.platform === "win32" });
    process.stdout.write(r.stdout ?? "");
    process.stderr.write(r.stderr ?? "");
    if (r.status !== 0)
      fail(
        `npm's beta stays behind ${a}: the trusted publisher of ${NAME} on npmjs.com (npm-beta.yml) needs "Allow npm dist-tag" — or by hand: npm dist-tag add ${NAME}@${a} beta`,
      );
    let npm = registry();
    for (let i = 0; i < 6 && npm.tags.beta !== a; i++) {
      pause(10_000);
      npm = registry();
    }
    if (npm.tags.beta !== a) fail(`npm's beta is ${npm.tags.beta ?? "none"}, not ${a}`);
    output({ beta: a });
    return;
  }
  fail("usage: node scripts/npm-beta-ci.ts npm [beta|latest] | prepare <tag> | tarball <file> <version> | after <version> <latest before> | beta <release>");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main(process.argv.slice(2));
  } catch (e) {
    fail((e as Error).message);
  }
}
