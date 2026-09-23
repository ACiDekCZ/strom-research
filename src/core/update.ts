// A new version of strom: noticed (at most once a day, quietly, never in the
// way) and installed with the user's yes (strom update). strom's code comes
// from the project's releases (strom-app.tar.gz, checked against the release's
// SHASUMS256.txt like the installer does) and replaces app/ of the
// installation; the Node beside it is the official build from nodejs.org,
// checked against nodejs.org's SHASUMS256.txt, of the line the release names
// (NODE_VERSION: "24" — the newest release of that LTS line, security fixes
// included; or an exact version) and replaced when that is a newer one. A release carries a VERSION file, so the
// newest version is one small file — the same way from GitHub, a mirror or a
// folder (STROM_DOWNLOAD_BASE, STROM_NODE_BASE).

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import type { Env } from "./paths.ts";
import { VERSION } from "./tree.ts";
import type { Settings } from "./config.ts";

export const RELEASES = "https://github.com/ACiDekCZ/strom-research/releases/latest/download";

/** How often strom asks whether there is a new version. */
export const CHECK_EVERY_MS = 24 * 3600_000;

export function releaseBase(env: Env): string {
  return (env.STROM_DOWNLOAD_BASE ?? "").trim() || RELEASES;
}

/** Is version a newer than b? (1.10.0 > 1.9.2) */
export function isNewer(a: string, b: string): boolean {
  const n = (v: string) => v.replace(/^v/, "").split(/[.-]/).map((x) => Number.parseInt(x, 10) || 0);
  const [x, y] = [n(a), n(b)];
  for (let i = 0; i < 3; i++) if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) > (y[i] ?? 0);
  return false;
}

/** Where the official Node comes from (nodejs.org's layout: <base>/v<version>/<archive>, SHASUMS256.txt beside). */
export function nodeBase(env: Env): string {
  return (env.STROM_NODE_BASE ?? "").trim() || "https://nodejs.org/dist";
}

/** The official Node archive for this computer. */
export function nodeArchive(version: string, platform: NodeJS.Platform = process.platform, arch: string = process.arch): string {
  const cpu = arch === "arm64" ? "arm64" : "x64";
  if (platform === "win32") return `node-v${version}-win-${cpu}.zip`;
  return `node-v${version}-${platform === "darwin" ? "darwin" : "linux"}-${cpu}.tar.gz`;
}

async function get(url: string, timeoutMs: number): Promise<Buffer> {
  if (url.startsWith("file://")) return fs.readFileSync(new URL(url));
  const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs), redirect: "follow" });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return Buffer.from(await res.arrayBuffer());
}

/** The newest version released, or undefined when it cannot be learned now. */
export async function latestVersion(env: Env, timeoutMs = 4000): Promise<string | undefined> {
  try {
    const v = (await get(`${releaseBase(env)}/VERSION`, timeoutMs)).toString("utf8").trim();
    return /^\d+\.\d+\.\d+/.test(v) ? v : undefined;
  } catch {
    return undefined;
  }
}

/** Does strom look for new versions? (the setting updates: check, the default, or off) */
export function checksUpdates(settings: Settings, env: Env): boolean {
  return (env.STROM_UPDATES ?? settings.config.updates ?? "check") !== "off";
}

/**
 * A newer version than this one, if there is one — asked at most once a day
 * (the answer is kept in the user config), with a short wait, silent when
 * there is no network. `fresh` asks now (strom update, strom doctor).
 */
export async function newerVersion(settings: Settings, env: Env, opts: { fresh?: boolean; timeoutMs?: number } = {}): Promise<string | undefined> {
  if (!checksUpdates(settings, env)) return undefined;
  const seen = settings.config.updateCheck;
  const due = opts.fresh || !seen || Date.now() - Date.parse(seen.at) > CHECK_EVERY_MS;
  let latest = seen?.latest;
  if (due) {
    const found = await latestVersion(env, opts.timeoutMs ?? 1500);
    if (found) {
      latest = found;
      settings.config.updateCheck = { at: new Date().toISOString(), latest: found };
      try {
        settings.save();
      } catch {
        // a read-only config: ask again next time
      }
    }
  }
  return latest && isNewer(latest, VERSION) ? latest : undefined;
}

/** A newer version known already (no network): for places that must not wait. */
export function knownNewerVersion(settings: Settings, env: Env): string | undefined {
  if (!checksUpdates(settings, env)) return undefined;
  const latest = settings.config.updateCheck?.latest;
  return latest && isNewer(latest, VERSION) ? latest : undefined;
}

export interface NodeRelease {
  version: string;
  /** The folder on nodejs.org (or a mirror) holding it. */
  dir: string;
  name: string;
  sums: Buffer;
}

/**
 * The Node a release asks for: an exact version ("24.21.0"), or a line ("24"):
 * the newest release of it, read from nodejs.org's latest-v24.x/SHASUMS256.txt.
 */
export async function resolveNode(env: Env, wanted: string, platform: NodeJS.Platform = process.platform, arch: string = process.arch): Promise<NodeRelease> {
  if (/^\d+\.\d+\.\d+$/.test(wanted)) {
    const dir = `${nodeBase(env)}/v${wanted}`;
    return { version: wanted, dir, name: nodeArchive(wanted, platform, arch), sums: await get(`${dir}/SHASUMS256.txt`, 20_000) };
  }
  if (!/^\d+$/.test(wanted)) throw new Error(`the release names no Node ("${wanted}")`);
  const dir = `${nodeBase(env)}/latest-v${wanted}.x`;
  const sums = await get(`${dir}/SHASUMS256.txt`, 20_000);
  const suffix = nodeArchive("X", platform, arch).replace(/^node-vX/, "");
  const m = sums.toString("utf8").match(new RegExp(`node-v(\\d+\\.\\d+\\.\\d+)${suffix.replace(/\./g, "\\.")}`));
  if (!m) throw new Error(`nodejs.org has no Node ${wanted} for this computer`);
  return { version: m[1]!, dir, name: m[0], sums };
}

/** The Node the release asks for, when it is another than the one installed (a security fix of the line, a new line). */
export async function newerNode(env: Env, installed: string | undefined): Promise<NodeRelease | undefined> {
  const wanted = (await get(`${releaseBase(env)}/NODE_VERSION`, 20_000)).toString("utf8").trim();
  if (wanted === installed) return undefined; // an exact version, there already
  const node = await resolveNode(env, wanted);
  return node.version !== installed ? node : undefined;
}

const sha256 = (data: Buffer) => crypto.createHash("sha256").update(data).digest("hex");

/** The line of a SHASUMS256.txt for one file, or undefined. */
function wanted(sums: Buffer, name: string): string | undefined {
  return sums
    .toString("utf8")
    .split("\n")
    .find((l) => l.trim().endsWith(`  ${name}`))
    ?.split(/\s+/)[0]
    ?.toLowerCase();
}

function untar(archive: string, into: string): void {
  // tar unpacks both: .tar.gz, and .zip on Windows 10 and later.
  fs.mkdirSync(into, { recursive: true });
  const r = spawnSync("tar", ["-xf", archive, "-C", into], { stdio: "ignore", windowsHide: true });
  if (r.status !== 0) throw new Error("the download could not be unpacked");
}

/** Put this official Node into the installation (node/node.exe, node/bin/node). */
async function installNode(env: Env, root: string, node: NodeRelease, work: string, platform: NodeJS.Platform): Promise<void> {
  const { name } = node;
  const archive = await get(`${node.dir}/${name}`, 300_000);
  if (wanted(node.sums, name) !== sha256(archive)) throw new Error("the Node download is damaged (checksum mismatch) — try again");
  const file = path.join(work, name);
  fs.writeFileSync(file, archive);
  untar(file, path.join(work, "node"));
  const top = path.join(work, "node", name.replace(/\.(zip|tar\.gz)$/, ""));
  const rel = platform === "win32" ? "node.exe" : path.join("bin", "node");
  const fresh = path.join(top, rel);
  if (!fs.existsSync(fresh)) throw new Error("the Node download has no node program");
  const target = path.join(root, "node", rel);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  if (platform === "win32") {
    // The running node.exe cannot be overwritten on Windows, but it can be renamed; deleted after strom ends.
    const old = path.join(root, "node", "node.old.exe");
    fs.rmSync(old, { force: true });
    if (fs.existsSync(target)) fs.renameSync(target, old);
    fs.copyFileSync(fresh, target);
    const child = spawn(env.ComSpec ?? "cmd.exe", ["/d", "/c", `ping 127.0.0.1 -n 3 >nul & del /f /q "${old}"`], { detached: true, stdio: "ignore", windowsHide: true });
    child.unref();
  } else {
    fs.copyFileSync(fresh, `${target}.new`);
    fs.chmodSync(`${target}.new`, 0o755);
    fs.renameSync(`${target}.new`, target);
  }
  const license = path.join(top, "LICENSE");
  if (fs.existsSync(license)) fs.copyFileSync(license, path.join(root, "node", "LICENSE"));
}

export interface Updated {
  version: string;
  /** Node, when it was replaced too. */
  node?: { from: string; to: string };
}

/**
 * Download, check and put the newest strom into the installation at `root`
 * (the installer's folder: node/, app/, install.json), and the Node the
 * release asks for when it is another one. Throws with a plain reason when it
 * cannot — then strom stays as it was.
 */
export async function installUpdate(env: Env, root: string, platform: NodeJS.Platform = process.platform): Promise<Updated> {
  const base = releaseBase(env);
  const version = await latestVersion(env, 10_000);
  if (!version) throw new Error("the newest version could not be learned (no network?)");
  const infoFile = path.join(root, "install.json");
  const info = JSON.parse(fs.readFileSync(infoFile, "utf8")) as { node?: string; version?: string };
  const [archive, sums, node] = await Promise.all([get(`${base}/strom-app.tar.gz`, 120_000), get(`${base}/SHASUMS256.txt`, 20_000), newerNode(env, info.node)]);
  if (wanted(sums, "strom-app.tar.gz") !== sha256(archive)) throw new Error("the download is damaged (checksum mismatch) — try again");
  // Unpacked beside the installation (the same disk: a rename moves it into place).
  const work = fs.mkdtempSync(path.join(root, ".update-"));
  const out: Updated = { version };
  try {
    const file = path.join(work, "strom-app.tar.gz");
    fs.writeFileSync(file, archive);
    untar(file, work);
    if (!fs.existsSync(path.join(work, "app", "dist", "cli.js"))) throw new Error("the download has no strom in it");
    if (node) {
      await installNode(env, root, node, work, platform);
      out.node = { from: info.node ?? "?", to: node.version };
      info.node = node.version;
    }
    const app = path.join(root, "app");
    const old = path.join(root, "app.old");
    fs.rmSync(old, { recursive: true, force: true });
    fs.renameSync(app, old);
    fs.renameSync(path.join(work, "app"), app);
    fs.rmSync(old, { recursive: true, force: true });
    info.version = version;
    fs.writeFileSync(infoFile, `${JSON.stringify(info, null, 2)}\n`);
  } finally {
    fs.rmSync(work, { recursive: true, force: true });
  }
  return out;
}
