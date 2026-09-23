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

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";

/** The Node line strom runs on (an LTS line, tested): installers and strom update take its newest release from nodejs.org. */
export const NODE_LINE = "24";

const ROOT = path.resolve(import.meta.dirname, "..");
const OUT = path.join(ROOT, "release");

function run(cmd: string, args: string[], opts: { cwd?: string } = {}): void {
  const r = spawnSync(cmd, args, { stdio: "inherit", cwd: opts.cwd ?? ROOT, shell: process.platform === "win32" });
  if (r.status !== 0) throw new Error(`${cmd} ${args.join(" ")} failed (${r.status ?? r.error?.message})`);
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
  const version = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8")).version as string;
  console.log("· building dist/");
  fs.rmSync(path.join(ROOT, "dist"), { recursive: true, force: true });
  run("npx", ["tsc", "-p", "tsconfig.build.json"]);

  // strom's own code: the same for every system.
  fs.rmSync(OUT, { recursive: true, force: true });
  const stage = path.join(OUT, "app");
  fs.mkdirSync(stage, { recursive: true });
  for (const top of ["dist", "assets"]) fs.cpSync(path.join(ROOT, top), path.join(stage, top), { recursive: true, filter: (f) => path.basename(f) !== ".DS_Store" });
  for (const f of ["package.json", "LICENSE", "README.md"]) fs.copyFileSync(path.join(ROOT, f), path.join(stage, f));
  const packed = path.join(OUT, "strom-app.tar.gz");
  run("tar", ["-czf", packed, "app"], { cwd: OUT });
  fs.rmSync(stage, { recursive: true, force: true });
  console.log(`  release/strom-app.tar.gz (${(fs.statSync(packed).size / 1e6).toFixed(1)} MB)`);

  // The installers check what they download against this list.
  fs.writeFileSync(path.join(OUT, "SHASUMS256.txt"), `${sha256(packed)}  strom-app.tar.gz\n`);
  for (const f of ["install.sh", "install.ps1"]) fs.copyFileSync(path.join(ROOT, "install", f), path.join(OUT, f));
  // What strom update and the daily look for a new version read; the Node the installers take.
  fs.writeFileSync(path.join(OUT, "VERSION"), `${version}\n`);
  fs.writeFileSync(path.join(OUT, "NODE_VERSION"), `${NODE_LINE}\n`);
  if (process.argv.includes("--node-mirror")) await nodeMirror();
  console.log("done — release/");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
