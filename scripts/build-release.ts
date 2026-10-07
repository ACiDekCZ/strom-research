// Build strom's release: `node scripts/build-release.ts`.
//
// strom is plain JavaScript on Node. A release carries strom's own code — one
// small archive for every system (strom-app.tar.gz: dist/, assets/,
// package.json) — and says which Node runs it (NODE_VERSION: an LTS line; the
// installers and strom update take its newest release, security fixes
// included). That Node comes from nodejs.org, the official build signed by its
// makers, checked against nodejs.org's SHASUMS256.txt: nothing of ours is an
// executable, the user and their agent can read everything strom runs, a
// connector in TypeScript runs on the same Node, and an update is a few MB.
//
// Results in release/: strom-app.tar.gz, SHASUMS256.txt (for it), VERSION,
// NODE_VERSION, install.sh, install.ps1. `--node-mirror` also puts the newest
// Node of the line for this computer, with its SHASUMS256.txt, into
// release/node/ in nodejs.org's layout — for installing without the network (live tests: STROM_NODE_BASE).
//
// A candidate to try before a release (another computer, Windows): `--version 1.12.0-rc.1` names it so in what
// is built (VERSION, the code's own version, its package.json) without touching the sources, `--out <folder>`
// builds it there instead of release/ — the installers take it with STROM_DOWNLOAD_BASE=file://<folder>.
//
// A beta (`--version X.Y.Z-beta.N`) also gets its npm tarball, <out>/strom-research-X.Y.Z-beta.N.tgz (what npm pack
// would publish, the version stamped, `publishConfig.tag` beta), and the line that publishes it under the tag beta.
// A candidate (`-rc.N`) gets none: it stays local. Any other prerelease is refused.

import fs from "node:fs";
import zlib from "node:zlib";
import path from "node:path";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import { releaseKind, packForNpm, publishLine } from "./npm-channel.ts";

/** The Node line strom runs on (an LTS line, tested): installers and strom update take its newest release from nodejs.org. */
export const NODE_LINE = "24";

const ROOT = path.resolve(import.meta.dirname, "..");
const opt = (name: string) => {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1] : undefined;
};
const OUT = path.resolve(opt("--out") ?? path.join(ROOT, "release"));
/** A path as said: within the sources from them, else whole. */
const shown = (p: string) => (path.relative(ROOT, p).startsWith("..") ? p : path.relative(ROOT, p) || ".");

function run(cmd: string, args: string[], opts: { cwd?: string } = {}): void {
  // macOS's tar would add its AppleDouble files (._dist, ._cli.js…) for the extended attributes: none
  const r = spawnSync(cmd, args, { stdio: "inherit", cwd: opts.cwd ?? ROOT, shell: process.platform === "win32", env: { ...process.env, COPYFILE_DISABLE: "1" } });
  if (r.status !== 0) throw new Error(`${cmd} ${args.join(" ")} failed (${r.status ?? r.error?.message})`);
}

/** The names in a .tar.gz, read from its headers (ustar: the prefix, then the name). */
function tarNames(file: string): string[] {
  const tar = zlib.gunzipSync(fs.readFileSync(file));
  const names: string[] = [];
  const text = (at: number, len: number) => tar.subarray(at, at + len).toString("utf8").replace(/\0.*$/s, "");
  for (let at = 0; at + 512 <= tar.length; ) {
    const name = text(at, 100);
    if (!name) break;
    const prefix = text(at + 345, 155);
    names.push(prefix ? `${prefix}/${name}` : name);
    const size = parseInt(text(at + 124, 12).trim() || "0", 8);
    at += 512 + Math.ceil(size / 512) * 512;
  }
  return names;
}

const sha256 = (file: string) => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");

/** The newest Node of the line for this computer, with nodejs.org's SHASUMS256.txt, in nodejs.org's layout. */
async function nodeMirror(): Promise<void> {
  const folder = `latest-v${NODE_LINE}.x`;
  const dist = `https://nodejs.org/dist/${folder}`;
  const sums = await (await fetch(`${dist}/SHASUMS256.txt`)).text();
  const os_ = process.platform === "win32" ? "win" : process.platform;
  const ext = process.platform === "win32" ? "zip" : "tar.gz";
  const m = sums.match(new RegExp(`^([0-9a-f]{64})  (node-v[0-9.]+-${os_}-${process.arch}\\.${ext.replace(".", "\\.")})$`, "m"));
  if (!m) throw new Error(`no Node ${NODE_LINE} for ${os_}-${process.arch} on nodejs.org`);
  const [, want, name] = m;
  const cache = path.join(ROOT, ".cache", "node-dist", folder);
  fs.mkdirSync(cache, { recursive: true });
  const archive = path.join(cache, name!);
  if (!fs.existsSync(archive) || sha256(archive) !== want) {
    console.log(`· downloading ${name}`);
    const res = await fetch(`${dist}/${name}`);
    if (!res.ok) throw new Error(`${name}: HTTP ${res.status}`);
    fs.writeFileSync(archive, Buffer.from(await res.arrayBuffer()));
    if (sha256(archive) !== want) throw new Error(`${name}: checksum does not match nodejs.org's SHASUMS256.txt`);
  }
  const dir = path.join(OUT, "node", folder);
  fs.mkdirSync(dir, { recursive: true });
  fs.copyFileSync(archive, path.join(dir, name!));
  fs.writeFileSync(path.join(dir, "SHASUMS256.txt"), sums);
  console.log(`  ${path.relative(ROOT, path.join(dir, name!))}`);
}

async function main(): Promise<void> {
  const released = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8")).version as string;
  const version = opt("--version") ?? released;
  const kind = releaseKind(version);
  if (typeof kind === "object") throw new Error(`--version ${kind.refused}`);
  console.log("· building dist/");
  fs.rmSync(path.join(ROOT, "dist"), { recursive: true, force: true });
  run("npx", ["tsc", "-p", "tsconfig.build.json"]);

  // strom's own code: the same for every system.
  // the folder is made anew: never the sources or a folder above them
  if (path.relative(OUT, ROOT) === "" || !path.relative(OUT, ROOT).startsWith("..")) throw new Error(`--out ${OUT}: the sources are in it`);
  fs.rmSync(OUT, { recursive: true, force: true });
  const stage = path.join(OUT, "app");
  fs.mkdirSync(stage, { recursive: true });
  for (const top of ["dist", "assets"]) fs.cpSync(path.join(ROOT, top), path.join(stage, top), { recursive: true, filter: (f) => path.basename(f) !== ".DS_Store" });
  for (const f of ["package.json", "LICENSE", "README.md"]) fs.copyFileSync(path.join(ROOT, f), path.join(stage, f));
  // a candidate: its own version in what is built (the code says it, strom update compares it), the sources as they are
  if (version !== released) {
    const pkg = path.join(stage, "package.json");
    fs.writeFileSync(pkg, JSON.stringify({ ...JSON.parse(fs.readFileSync(pkg, "utf8")), version }, null, 2) + "\n");
    const tree = path.join(stage, "dist", "core", "tree.js");
    const code = fs.readFileSync(tree, "utf8");
    // the sources say the candidate being made (their own version between releases), the release its own
    const named = code.replace(/export const VERSION = "[^"]+";/, `export const VERSION = "${version}";`);
    if (!named.includes(`export const VERSION = "${version}";`)) throw new Error(`dist/core/tree.js: no VERSION to name ${version}`);
    fs.writeFileSync(tree, named);
  }
  const packed = path.join(OUT, "strom-app.tar.gz");
  run("tar", ["-czf", packed, "app"], { cwd: OUT });
  // …and none came in (macOS's own tar hides them when it lists the archive: its headers read here)
  if (tarNames(packed).some((n) => /(^|\/)\._/.test(n))) throw new Error(`${packed}: AppleDouble files (._*) in it`);
  console.log(`  ${shown(packed)} (${(fs.statSync(packed).size / 1e6).toFixed(1)} MB)`);
  // a beta: npm's tarball of the same code (published by hand, under the tag beta)
  const npmTarball = kind === "beta" ? packForNpm(stage, OUT) : undefined;
  if (npmTarball) console.log(`  ${shown(npmTarball)} (${(fs.statSync(npmTarball).size / 1e6).toFixed(1)} MB)`);
  fs.rmSync(stage, { recursive: true, force: true });

  // The installers check what they download against this list.
  fs.writeFileSync(path.join(OUT, "SHASUMS256.txt"), `${sha256(packed)}  strom-app.tar.gz\n`);
  for (const f of ["install.sh", "install.ps1"]) fs.copyFileSync(path.join(ROOT, "install", f), path.join(OUT, f));
  // What strom update and the daily look for a new version read; the Node the installers take.
  fs.writeFileSync(path.join(OUT, "VERSION"), `${version}\n`);
  fs.writeFileSync(path.join(OUT, "NODE_VERSION"), `${NODE_LINE}\n`);
  if (process.argv.includes("--node-mirror")) await nodeMirror();
  console.log(`done — ${shown(OUT)}/ (${version})`);
  if (npmTarball) console.log(`npm (by hand, in a terminal of your own): ${publishLine(shown(npmTarball))}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
