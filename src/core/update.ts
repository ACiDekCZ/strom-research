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
import { tarProgram, type Env } from "./paths.ts";
import { VERSION } from "./tree.ts";
import type { Settings } from "./config.ts";
import { installation, replacedHolding, type Installation } from "./self.ts";
import type { Transition } from "./backup.ts";

export const RELEASES = "https://github.com/ACiDekCZ/strom-research/releases/latest/download";
/** Every release of the project, prereleases too (the beta channel picks the newest by semver). */
export const RELEASES_API = "https://api.github.com/repos/ACiDekCZ/strom-research/releases?per_page=30";
/** One release's files: <this>/<tag>/VERSION, strom-app.tar.gz… */
export const RELEASE_DOWNLOAD = "https://github.com/ACiDekCZ/strom-research/releases/download";

/**
 * Which versions this strom takes: "stable" (the releases) or "beta" (the newest of every release, prereleases too).
 * STROM_CHANNEL, else what the installation was installed with (install.json channel), else a prerelease version not
 * run from the sources (npm install -g strom-research@beta), else stable.
 */
export type Channel = "beta" | "stable";
export function updateChannel(env: Env, inst: Installation = installation(), version: string = VERSION): Channel {
  const said = (env.STROM_CHANNEL ?? "").trim().toLowerCase();
  if (said === "beta" || said === "stable") return said;
  if (inst.kind === "installed" && inst.channel) return inst.channel;
  if (inst.kind !== "source" && /^\d+\.\d+\.\d+-/.test(version)) return "beta";
  return "stable";
}

/**
 * The channel of the strom that ran here last: recorded, else stable when a version was (a strom from before the
 * channels was always a release), else none (a first run ever).
 */
export function lastChannelOf(last: { lastVersion?: string; lastChannel?: Channel }): Channel | undefined {
  return last.lastChannel ?? (last.lastVersion ? "stable" : undefined);
}

/**
 * The change from the strom that ran here last to this one that needs a backup first (core/backup.ts): an older
 * version than the last one (back from a beta), or another channel than last time (when it was recorded).
 */
export function pendingTransition(last: { lastVersion?: string; lastChannel?: Channel }, version: string, channel: Channel): Transition | undefined {
  if (!last.lastVersion) return undefined;
  const older = isNewer(last.lastVersion, version);
  const was = lastChannelOf(last);
  const other = !!was && was !== channel;
  if (!older && !other) return undefined;
  return { from: last.lastVersion, to: version, ...(was ? { fromChannel: was } : {}), toChannel: channel };
}

/** How often strom asks whether there is a new version. */
export const CHECK_EVERY_MS = 24 * 3600_000;

export function releaseBase(env: Env): string {
  return (env.STROM_DOWNLOAD_BASE ?? "").trim() || RELEASES;
}

/** One version's parts by semver: its numbers and its prerelease identifiers (none for a release). */
function semver(v: string): { main: number[]; pre: string[] } {
  const [main = "", pre] = v.trim().replace(/^v/, "").split("+")[0]!.split(/-(.*)/s);
  return { main: main.split(".").map((x) => Number.parseInt(x, 10) || 0), pre: pre ? pre.split(".") : [] };
}

/**
 * Semver precedence: < 0 when a is older than b, 0 the same, > 0 newer. The numbers first; a release is newer than
 * any prerelease of it (1.12.0 > 1.12.0-rc.7); prereleases by their identifiers — numbers as numbers, words by their
 * letters, a number before a word, the shorter set first when the rest is equal (beta.2 < beta.10 < rc.1).
 */
export function compareVersions(a: string, b: string): number {
  const [x, y] = [semver(a), semver(b)];
  for (let i = 0; i < 3; i++) if ((x.main[i] ?? 0) !== (y.main[i] ?? 0)) return (x.main[i] ?? 0) - (y.main[i] ?? 0);
  if (!x.pre.length || !y.pre.length) return (x.pre.length ? 0 : 1) - (y.pre.length ? 0 : 1);
  const numeric = /^\d+$/;
  for (let i = 0; i < Math.min(x.pre.length, y.pre.length); i++) {
    const [p, q] = [x.pre[i]!, y.pre[i]!];
    if (p === q) continue;
    const [pn, qn] = [numeric.test(p), numeric.test(q)];
    if (pn && qn) return Number(p) - Number(q);
    if (pn !== qn) return pn ? -1 : 1;
    return p < q ? -1 : 1;
  }
  return x.pre.length - y.pre.length;
}

/** Is version a newer than b? (1.10.0 > 1.9.2, 1.13.0-beta.10 > 1.13.0-beta.2, 1.13.0 > 1.13.0-rc.1) */
export function isNewer(a: string, b: string): boolean {
  return compareVersions(a, b) > 0;
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

async function get(url: string, timeoutMs: number, headers?: Record<string, string>): Promise<Buffer> {
  if (url.startsWith("file://")) return fs.readFileSync(new URL(url));
  const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs), redirect: "follow", ...(headers ? { headers } : {}) });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return Buffer.from(await res.arrayBuffer());
}

/** The newest release of a channel: its version and where its files are. */
export interface Release {
  version: string;
  base: string;
}

const TAG = /^v\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/;

/** The newest tag among GitHub's releases (drafts left out), by semver. */
export function newestTag(releases: unknown): string | undefined {
  if (!Array.isArray(releases)) return undefined;
  let best: string | undefined;
  for (const r of releases as { tag_name?: unknown; draft?: unknown }[]) {
    if (!r || r.draft === true || typeof r.tag_name !== "string" || !TAG.test(r.tag_name)) continue;
    if (!best || isNewer(r.tag_name, best)) best = r.tag_name;
  }
  return best;
}

/**
 * The newest release of the channel, or undefined when it cannot be learned now. STROM_DOWNLOAD_BASE always wins
 * (its VERSION); stable: the latest release's VERSION; beta: GitHub's list of releases (STROM_RELEASES_API: another
 * address, a file:// or a file), its newest tag by semver, downloaded from that release (STROM_RELEASE_DOWNLOAD/<tag>).
 */
export async function latestRelease(env: Env, opts: { channel?: Channel; timeoutMs?: number } = {}): Promise<Release | undefined> {
  const timeoutMs = opts.timeoutMs ?? 4000;
  const channel = opts.channel ?? updateChannel(env);
  try {
    if (channel === "beta" && !(env.STROM_DOWNLOAD_BASE ?? "").trim()) {
      const api = (env.STROM_RELEASES_API ?? "").trim() || RELEASES_API;
      const body = /^[a-z][a-z0-9+.-]*:\/\//i.test(api) ? await get(api, timeoutMs, { "User-Agent": `strom-research/${VERSION}`, Accept: "application/vnd.github+json" }) : fs.readFileSync(api);
      const tag = newestTag(JSON.parse(body.toString("utf8")));
      // (STROM_RELEASE_DOWNLOAD: where the releases' folders are — a mirror, a test's folder)
      return tag ? { version: tag.slice(1), base: `${(env.STROM_RELEASE_DOWNLOAD ?? "").trim() || RELEASE_DOWNLOAD}/${tag}` } : undefined;
    }
    const base = releaseBase(env);
    const v = (await get(`${base}/VERSION`, timeoutMs)).toString("utf8").trim();
    return /^\d+\.\d+\.\d+/.test(v) ? { version: v, base } : undefined;
  } catch {
    return undefined;
  }
}

/** The newest version released on this strom's channel, or undefined when it cannot be learned now. */
export async function latestVersion(env: Env, timeoutMs = 4000): Promise<string | undefined> {
  return (await latestRelease(env, { timeoutMs }))?.version;
}

/** The newest version the daily look found, when it looked for this channel. */
function seenLatest(settings: Settings, channel: Channel): string | undefined {
  const seen = settings.config.updateCheck;
  return seen && (seen.channel ?? "stable") === channel ? seen.latest : undefined;
}

/** What the daily look keeps: when, the newest version, and the channel when it is beta. */
export function checked(latest: string, channel: Channel): NonNullable<Settings["config"]["updateCheck"]> {
  return { at: new Date().toISOString(), latest, ...(channel === "beta" ? { channel } : {}) };
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
  const channel = updateChannel(env);
  const seen = settings.config.updateCheck;
  let latest = seenLatest(settings, channel);
  // a look for the other channel is no look for this one
  const due = opts.fresh || !seen || latest === undefined || Date.now() - Date.parse(seen.at) > CHECK_EVERY_MS;
  if (due) {
    const found = (await latestRelease(env, { channel, timeoutMs: opts.timeoutMs ?? 1500 }))?.version;
    if (found) {
      latest = found;
      settings.config.updateCheck = checked(found, channel);
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
  const latest = seenLatest(settings, updateChannel(env));
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
export async function newerNode(env: Env, installed: string | undefined, base: string = releaseBase(env)): Promise<NodeRelease | undefined> {
  const wanted = (await get(`${base}/NODE_VERSION`, 20_000)).toString("utf8").trim();
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

function untar(env: Env, archive: string, into: string, platform: NodeJS.Platform): void {
  // tar unpacks both: .tar.gz, and .zip on Windows 10 and later.
  fs.mkdirSync(into, { recursive: true });
  const r = spawnSync(tarProgram(env, platform), ["-xf", archive, "-C", into], { stdio: "ignore", windowsHide: true });
  if (r.status !== 0) throw new Error("the download could not be unpacked");
}

/** Put this official Node into the installation (node/node.exe, node/bin/node). */
async function installNode(env: Env, root: string, node: NodeRelease, work: string, platform: NodeJS.Platform): Promise<void> {
  const { name } = node;
  const archive = await get(`${node.dir}/${name}`, 300_000);
  if (wanted(node.sums, name) !== sha256(archive)) throw new Error("the Node download is damaged (checksum mismatch) — try again");
  const file = path.join(work, name);
  fs.writeFileSync(file, archive);
  untar(env, file, path.join(work, "node"), platform);
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
 * cannot — then strom stays as it was. `release`: the one to install (else the
 * newest of the channel); `channel`: the installation takes that channel from
 * now on (install.json; stable: none written); `keep`: what may never lie in what
 * is replaced (the research, its backups, the settings) — else nothing is done. Whatever else install.json
 * holds (env, a channel) stays.
 */
export async function installUpdate(env: Env, root: string, platform: NodeJS.Platform = process.platform, opts: { release?: Release; channel?: Channel; keep?: string[] } = {}): Promise<Updated> {
  // never what lies inside app/, app.old/ or node/: a research, its backups, the settings (`keep`)
  const inside = replacedHolding(root, opts.keep ?? [], platform)[0];
  if (inside) throw new Error(`${inside.folder} lies inside ${inside.entry}, which the update replaces — nothing was installed`);
  const release = opts.release ?? (await latestRelease(env, { timeoutMs: 10_000, ...(opts.channel ? { channel: opts.channel } : {}) }));
  if (!release) throw new Error("the newest version could not be learned (no network?)");
  const { version, base } = release;
  const infoFile = path.join(root, "install.json");
  const info = JSON.parse(fs.readFileSync(infoFile, "utf8")) as { node?: string; version?: string; channel?: string };
  const [archive, sums, node] = await Promise.all([get(`${base}/strom-app.tar.gz`, 120_000), get(`${base}/SHASUMS256.txt`, 20_000), newerNode(env, info.node, base)]);
  if (wanted(sums, "strom-app.tar.gz") !== sha256(archive)) throw new Error("the download is damaged (checksum mismatch) — try again");
  // Unpacked beside the installation (the same disk: a rename moves it into place).
  const work = fs.mkdtempSync(path.join(root, ".update-"));
  const out: Updated = { version };
  try {
    const file = path.join(work, "strom-app.tar.gz");
    fs.writeFileSync(file, archive);
    untar(env, file, work, platform);
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
    if (opts.channel === "beta") info.channel = "beta";
    else if (opts.channel === "stable") delete info.channel;
    fs.writeFileSync(infoFile, `${JSON.stringify(info, null, 2)}\n`);
  } finally {
    fs.rmSync(work, { recursive: true, force: true });
  }
  return out;
}

/** The installation at `root` takes this channel from now on (install.json: beta written, stable none). */
export function setInstallChannel(root: string, channel: Channel): void {
  const file = path.join(root, "install.json");
  const info = JSON.parse(fs.readFileSync(file, "utf8")) as { channel?: string };
  if (channel === "beta") info.channel = "beta";
  else delete info.channel;
  fs.writeFileSync(file, `${JSON.stringify(info, null, 2)}\n`);
}
