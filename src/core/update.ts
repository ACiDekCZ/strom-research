// A new version of strom: noticed (at most once a day, quietly, never in the
// way) and installed with the user's yes (strom update). strom's code comes
// from the project's releases (strom-app.tar.gz, checked against the release's
// SHASUMS256.txt like the installer does) and lies in a folder of its own,
// app-<version>/, beside the one at work: nothing in use is moved or replaced,
// only the small entry app/dist/cli.js is written again, whole, to name the new
// version (a run keeps the version it started with — its research's shim names
// that folder — and the folders nobody uses go at the next update or strom
// tidy). The Node beside it is the official build from nodejs.org,
// checked against nodejs.org's SHASUMS256.txt, of the line the release names
// (NODE_VERSION: "24" — the newest release of that LTS line, security fixes
// included; or an exact version) and replaced when that is a newer one. A release carries a VERSION file, so the
// newest version is one small file — the same way from GitHub, a mirror or a
// folder (STROM_DOWNLOAD_BASE, STROM_NODE_BASE).

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { configDir, tarProgram, type Env } from "./paths.ts";
import { readJsonIfExists } from "./json.ts";
import { VERSION } from "./tree.ts";
import { compareVersions } from "./semver.ts";
export { compareVersions };
import type { Settings } from "./config.ts";
import { entryOf, holdsPath, installation, isVersionDir, replacedHolding, shimScript, type Installation } from "./self.ts";
import { anyoneAtWork, liveWorkers } from "./workers.ts";
import type { Transition } from "./backup.ts";

export const RELEASES = "https://github.com/ACiDekCZ/strom-research/releases/latest/download";
/** Every release of the project, prereleases too (the beta channel picks the newest by semver). */
export const RELEASES_API = "https://api.github.com/repos/ACiDekCZ/strom-research/releases?per_page=30";
/** One release's files: <this>/<tag>/VERSION, strom-app.tar.gz… */
export const RELEASE_DOWNLOAD = "https://github.com/ACiDekCZ/strom-research/releases/download";

/**
 * Which versions this strom takes: "stable" (the releases) or "beta" (the newest of every release, prereleases too).
 * STROM_CHANNEL, else what the installation was installed with (install.json channel), else a prerelease version not
 * run from the sources (npm install -g strom-research@beta), else — installed with npm — the channel npm's strom was on
 * (npmChannel), else stable.
 */
export type Channel = "beta" | "stable";
export function updateChannel(env: Env, inst: Installation = installation(), version: string = VERSION, last?: ChannelMemory): Channel {
  const said = (env.STROM_CHANNEL ?? "").trim().toLowerCase();
  if (said === "beta" || said === "stable") return said;
  if (inst.kind === "installed" && inst.channel) return inst.channel;
  if (inst.kind !== "source" && /^\d+\.\d+\.\d+-/.test(version)) return "beta";
  if (inst.kind === "npm") return npmChannel(last ?? (readJsonIfExists<ChannelMemory>(path.join(configDir(env), "config.json")) ?? {}), version);
  return "stable";
}

/** What the user config keeps of the channel (core/config.ts UserConfig). */
export interface ChannelMemory {
  lastVersion?: string;
  lastChannel?: Channel;
  npmChannel?: Channel;
}

/**
 * The channel of a release installed with npm. npm keeps no word of the tag it was installed from, and its beta moves
 * to each release too (the release's CI): a release after a beta is on the beta still — strom update --channel says
 * otherwise (npmChannel), and a release older than the strom that ran here last is a way back to npm's latest.
 */
export function npmChannel(m: ChannelMemory, version: string): Channel {
  if (m.npmChannel === "beta" || m.npmChannel === "stable") return m.npmChannel;
  return m.lastChannel === "beta" && !(m.lastVersion && isNewer(m.lastVersion, version)) ? "beta" : "stable";
}

/**
 * The channel said for npm's strom (strom update --channel) as a new version first runs: a beta installed after
 * "stable", or an older release after "beta", is a choice made with npm since — the word said before gives way.
 */
export function npmChannelKept(m: ChannelMemory, version: string): Channel | undefined {
  if (m.npmChannel === "stable" && /^\d+\.\d+\.\d+-/.test(version)) return undefined;
  if (m.npmChannel === "beta" && m.lastVersion && isNewer(m.lastVersion, version)) return undefined;
  return m.npmChannel;
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


/** Is version a newer than b? (1.10.0 > 1.9.2, 1.13.0-beta.10 > 1.13.0-beta.2, 1.13.0 > 1.13.0-rc.1) */
export function isNewer(a: string, b: string): boolean {
  return compareVersions(a, b) > 0;
}

/** The changelog of the project on GitHub: CHANGELOG.md (en), CHANGELOG.cs.md, CHANGELOG.de.md in the repository's root. */
export const CHANGELOG_BASE = "https://github.com/ACiDekCZ/strom-research/blob";
const CHANGELOG_LANGS = new Set(["cs", "de"]);

/**
 * What's new in a version: its section of the changelog in the person's language (another language: English), on the
 * branch of the channel — main has the released versions only, beta the version being prepared. The section's anchor
 * is the version without its prerelease part (`## 1.15.0` → #1150), the same from the first beta to the release.
 */
export function whatsNewUrl(version: string, channel: Channel, lang: string): string {
  const code = lang.trim().toLowerCase().split(/[-_]/)[0] ?? "";
  const file = CHANGELOG_LANGS.has(code) ? `CHANGELOG.${code}.md` : "CHANGELOG.md";
  const anchor = (version.split(/[-+]/)[0] ?? version).replace(/\D/g, "");
  return `${CHANGELOG_BASE}/${channel === "beta" ? "beta" : "main"}/${file}#${anchor}`;
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

/**
 * What the replacement of strom's folders does with the disk: renames, removals and the waits between tries
 * (tests put in their own — a rename another program holds a few times, or for good).
 */
export interface SwapOps {
  rename(from: string, to: string): void;
  rm(target: string): void;
  wait(ms: number): void;
}

const DISK: SwapOps = {
  rename: (from, to) => fs.renameSync(from, to),
  rm: (target) => fs.rmSync(target, { recursive: true, force: true }),
  wait: (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms),
};

/** How often a rename or a removal of strom's folders is tried, and how long it waits in all (ms), the waits growing. */
export const SWAP_TRIES = 10;
export const SWAP_PATIENCE = 5000;
/** What another program holding a file (an antivirus, the search indexer, a process with a file open) fails a rename or a removal with. */
const HELD_CODES = new Set(["EPERM", "EBUSY", "EACCES"]);

/**
 * fn, tried again while another program holds what it renames or removes (Windows: Defender scanning the files just
 * unpacked, a process with a file of app\ open) — on every system the same, up to SWAP_TRIES times and SWAP_PATIENCE
 * in all, the waits growing (50, 100, 200 … ms; synchronous: the thread sleeps). Another error, or the last one: thrown.
 */
function patiently(ops: SwapOps, fn: () => void): void {
  let wait = 50;
  let left = SWAP_PATIENCE;
  for (let tried = 1; ; tried++) {
    try {
      return fn();
    } catch (err) {
      if (!HELD_CODES.has((err as NodeJS.ErrnoException).code ?? "") || tried >= SWAP_TRIES || left <= 0) throw err;
      const ms = Math.min(wait, left);
      ops.wait(ms);
      left -= ms;
      wait *= 2;
    }
  }
}

/** A line in the installation's update.log: what an update could not tidy and left (never a reason to fail it). */
function updateLog(root: string, line: string): void {
  try {
    fs.appendFileSync(path.join(root, "update.log"), `${new Date().toISOString()} ${line}\n`);
  } catch {
    // a log is no reason to fail an update
  }
}

/** The Node just put in place: `undo` puts the one before back (the code could not be replaced), `done` tidies after it. */
interface NodeSwap {
  undo(): void;
  done(): void;
}

/** Put this official Node into the installation (node/node.exe, node/bin/node), the one before kept until `done`. */
async function installNode(env: Env, root: string, node: NodeRelease, work: string, platform: NodeJS.Platform, ops: SwapOps): Promise<NodeSwap> {
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
  // its licence beside it once it is the one in place
  const license = path.join(top, "LICENSE");
  const licensed = () => {
    if (fs.existsSync(license)) fs.copyFileSync(license, path.join(root, "node", "LICENSE"));
  };
  if (platform === "win32") {
    // The running node.exe cannot be overwritten on Windows, but it can be renamed; deleted after strom ends.
    const old = path.join(root, "node", "node.old.exe");
    patiently(ops, () => ops.rm(old));
    const had = fs.existsSync(target);
    if (had) patiently(ops, () => ops.rename(target, old));
    fs.copyFileSync(fresh, target);
    return {
      undo: () => {
        if (!had) return;
        patiently(ops, () => ops.rm(target));
        patiently(ops, () => ops.rename(old, target));
      },
      done: () => {
        licensed();
        const child = spawn(env.ComSpec ?? "cmd.exe", ["/d", "/c", `ping 127.0.0.1 -n 3 >nul & del /f /q "${old}"`], { detached: true, stdio: "ignore", windowsHide: true });
        child.unref();
      },
    };
  }
  // the one before kept beside it (a link where the disk can: no copy), the new one moved over it in one step
  const old = `${target}.old`;
  ops.rm(old);
  let kept = false;
  if (fs.existsSync(target)) {
    try {
      fs.linkSync(target, old);
    } catch {
      fs.copyFileSync(target, old);
    }
    kept = true;
  }
  fs.copyFileSync(fresh, `${target}.new`);
  fs.chmodSync(`${target}.new`, 0o755);
  patiently(ops, () => ops.rename(`${target}.new`, target));
  return {
    undo: () => {
      if (kept) patiently(ops, () => ops.rename(old, target));
    },
    done: () => {
      licensed();
      try {
        patiently(ops, () => ops.rm(old));
      } catch (e) {
        updateLog(root, `${old} left: ${(e as Error).message}`);
      }
    },
  };
}

/** The entry every launcher, shortcut, link and research's shim runs: app/dist/cli.js under the installer's folder. */
const ENTRY_IMPORT = /import\("\.\.\/\.\.\/([^"\/\\]+)\/dist\/cli\.js"\)/;

/**
 * The installer's folder of the version in use: the app-<version>/ the entry names. Undefined: app/ holds the whole
 * program (installed by a strom before 1.25 — its first update by this one puts the version beside it).
 */
export function currentAppDir(root: string): string | undefined {
  try {
    const dir = ENTRY_IMPORT.exec(fs.readFileSync(entryOf(root), "utf8"))?.[1];
    return dir && isVersionDir(dir) && fs.existsSync(path.join(root, dir, "dist", "cli.js")) ? dir : undefined;
  } catch {
    return undefined;
  }
}

/** The entry naming the version in `dir` (app-<version>): it loads that version's own cli.js, which runs as itself. */
export function entryScript(dir: string): string {
  return (
    "// Strom research: the entry every launcher, shortcut, link and research's shim runs. strom update and the\n" +
    "// installer write it again, whole, to name the version in use; each version lies in a folder of its own.\n" +
    `await import("../../${dir}/dist/cli.js");\n`
  );
}

/** app/package.json beside the entry: the version in use (what a strom started before reads as the one on disk). */
export function entryPackage(version: string): string {
  return `${JSON.stringify({ name: "strom-research", version, type: "module", private: true }, null, 2)}\n`;
}

/** A file written whole: aside, then renamed over the one there (an agent's call that moment reads the old or the new one). */
function writeWhole(file: string, body: string, ops: SwapOps): void {
  const aside = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(aside, body);
  try {
    patiently(ops, () => ops.rename(aside, file));
  } catch (e) {
    fs.rmSync(aside, { force: true });
    throw e;
  }
}

/**
 * The entry names the version in `dir` from now on: app/package.json, then app/dist/cli.js, each whole. The entry not
 * written: the package.json before is put back (the entry and the version on disk never disagree).
 */
export function writeEntry(root: string, dir: string, version: string, ops: SwapOps = DISK): void {
  const app = path.join(root, "app");
  fs.mkdirSync(path.join(app, "dist"), { recursive: true });
  const pkg = path.join(app, "package.json");
  let before: string | undefined;
  try {
    before = fs.readFileSync(pkg, "utf8");
  } catch {
    // none yet
  }
  writeWhole(pkg, entryPackage(version), ops);
  try {
    writeWhole(entryOf(root), entryScript(dir), ops);
  } catch (e) {
    try {
      if (before === undefined) fs.rmSync(pkg, { force: true });
      else writeWhole(pkg, before, ops);
    } catch (back) {
      updateLog(root, `app/package.json could not be put back: ${(back as Error).message}`);
    }
    throw e;
  }
}

/**
 * app/ made only the entry again (package.json, dist/cli.js, the marks of the research's shims beside it) — the whole
 * program an installation before 1.25 kept there, once a version of its own has been in use since the update before.
 * What cannot be removed: written to update.log.
 */
export function pruneEntry(root: string, ops: SwapOps = DISK): void {
  const app = path.join(root, "app");
  const keep = (rel: string) => rel === "package.json" || rel === "dist" || rel === path.join("dist", "cli.js") || /^\.strom-shim-/.test(path.basename(rel)) && path.dirname(rel) === "dist";
  for (const [dir, rel] of [
    [app, ""],
    [path.join(app, "dist"), "dist"],
  ] as const) {
    let names: string[] = [];
    try {
      names = fs.readdirSync(dir);
    } catch {
      continue;
    }
    for (const n of names) {
      const r = rel ? path.join(rel, n) : n;
      if (keep(r)) continue;
      try {
        ops.rm(path.join(dir, n));
      } catch (e) {
        updateLog(root, `${path.join(dir, n)} left: ${(e as Error).message}`);
      }
    }
  }
}

/** The folders of versions in the installer's folder (app-<version>), each with the version its package.json says. */
export function versionDirs(root: string): { dir: string; version?: string }[] {
  let names: string[] = [];
  try {
    names = fs.readdirSync(root);
  } catch {
    return [];
  }
  return names.filter(isVersionDir).map((dir) => {
    // a file another program holds (found on Windows: an antivirus, an editor over an old version's package.json — EBUSY)
    // stops neither strom update nor strom doctor: the version is then the one the folder is named by
    let v: unknown;
    try {
      v = readJsonIfExists<{ version?: unknown }>(path.join(root, dir, "package.json"))?.version;
    } catch {
      v = /^app-(.+?)(?:_\d+)?$/.exec(dir)?.[1];
    }
    return { dir, ...(typeof v === "string" ? { version: v } : {}) };
  });
}

/**
 * The folders of versions somebody works with now in one of the researches `trees`: a research's shim pinned to one
 * (a run, a conversation), a worker saying its version. Never removed by an update or strom tidy.
 */
export function appDirsInUse(root: string, trees: string[]): string[] {
  const out = new Set<string>();
  const dirs = versionDirs(root);
  for (const tree of trees) {
    const versions = new Set(liveWorkers(tree).map((w) => w.version).filter((v): v is string => !!v));
    if (!versions.size && !anyoneAtWork(tree)) continue;
    const script = shimScript(tree);
    const pinned = script ? path.basename(path.dirname(path.dirname(script))) : undefined;
    if (pinned && isVersionDir(pinned) && holdsPath(root, script!)) out.add(pinned);
    for (const d of dirs) if (d.version && versions.has(d.version)) out.add(d.dir);
  }
  return [...out];
}

/**
 * The folders an update or strom tidy may remove now: the versions' folders but the one in use, the one before it
 * (install.json `previous`: a strom started before the last update may still read from it) and those in use
 * (`inUse`); app.old/ an update of a strom before 1.25 left; whether app/ is to be made the entry alone (a version
 * of its own in use since the update before). Never one holding a folder of `keep` (a research, the shared folder).
 */
export function oldVersions(root: string, inUse: string[] = [], keep: string[] = []): { dirs: string[]; prune: boolean } {
  const current = currentAppDir(root);
  const info = readJsonIfExists<{ previous?: unknown }>(path.join(root, "install.json"));
  const previous = typeof info?.previous === "string" ? info.previous : undefined;
  const kept = new Set([current, previous, ...inUse].filter((d): d is string => !!d));
  const dirs = current ? versionDirs(root).map((d) => d.dir).filter((d) => !kept.has(d)) : [];
  if (fs.existsSync(path.join(root, "app.old"))) dirs.push("app.old");
  // never a folder holding what the person keeps (a research, its backups, the settings, the shared folder set there)
  const holds = (d: string) => keep.some((k) => holdsPath(path.join(root, d), k));
  // the whole program in app/ (an installation before 1.25) only once the version before is a folder of its own
  const whole = fs.existsSync(path.join(root, "app", "dist", "core"));
  return { dirs: dirs.filter((d) => !holds(d)), prune: !!current && whole && previous !== undefined && previous !== "app" && !holds("app") };
}

/** Remove what `oldVersions` names; what another program holds stays, written to update.log. The folders removed. */
export function removeOldVersions(root: string, inUse: string[] = [], ops: SwapOps = DISK, keep: string[] = []): string[] {
  const { dirs, prune } = oldVersions(root, inUse, keep);
  const gone: string[] = [];
  for (const d of dirs) {
    try {
      patiently(ops, () => ops.rm(path.join(root, d)));
      gone.push(d);
    } catch (e) {
      updateLog(root, `${path.join(root, d)} left: ${(e as Error).message}`);
    }
  }
  if (prune) pruneEntry(root, ops);
  return gone;
}

/**
 * The layout of the installer's folder a version of strom knows (its package.json `stromLayout`): 1 — the whole
 * program in app/ (every strom before 1.25, whose package.json says nothing); 2 — each version in app-<version>/ with
 * the entry in app/. A version knowing only 1 reads an installation as the installer's only from app/: run from
 * app-<version>/ it takes itself for npm's and never updates again (found 2026-11-02: back from the beta to 1.24.0).
 */
export const VERSION_FOLDERS = 2;

/** The layout the code in `app` (an unpacked release, app/ of an installation) knows: its package.json says; nothing said, 1. */
export function layoutOf(app: string): number {
  try {
    const n = readJsonIfExists<{ stromLayout?: unknown }>(path.join(app, "package.json"))?.stromLayout;
    return typeof n === "number" && Number.isInteger(n) && n > 0 ? n : 1;
  } catch {
    return 1;
  }
}

/** The name the new version's folder takes: app-<version>, a leftover of it removed when nobody uses it, else app-<version>_<n>. */
function freeAppDir(root: string, version: string, inUse: Set<string>, ops: SwapOps): string {
  const base = `app-${version.replace(/[^0-9A-Za-z.+_-]/g, "_")}`;
  for (let n = 1; ; n++) {
    const dir = n === 1 ? base : `${base}_${n}`;
    const at = path.join(root, dir);
    if (!fs.existsSync(at)) return dir;
    if (inUse.has(dir)) continue;
    try {
      ops.rm(at);
      if (!fs.existsSync(at)) return dir;
    } catch {
      // held: another name
    }
  }
}

export interface Updated {
  version: string;
  /** Node, when it was replaced too. */
  node?: { from: string; to: string };
  /** The folder of the version now in use (app-<version>). */
  dir?: string;
}

/**
 * The download checked and unpacked, before anything is put in place: `ready` decides — false, and nothing is
 * installed (UpdateHeld thrown).
 */
export class UpdateHeld extends Error {
  constructor() {
    super("not updated: nothing was put in place");
    this.name = "UpdateHeld";
  }
}

/**
 * Download, check and put the newest strom into the installation at `root` (the installer's folder: node/, app/,
 * app-<version>/, install.json), and the Node the release asks for when it is another one. Throws with a plain reason
 * when it cannot — then strom stays as it was. `release`: the one to install (else the newest of the channel);
 * `channel`: the installation takes that channel from now on (install.json; stable: none written); `keep`: what may
 * never lie in what is replaced (the research, its backups, the settings) — else nothing is done; `ready`: asked once
 * the download is checked and unpacked, before anything is put in place (false: UpdateHeld). Whatever else
 * install.json holds (env, a channel) stays.
 *
 * Each version lies in a folder of its own (app-<version>/); nothing in use is renamed (spec 037). The new one unpacked
 * beside the installation is moved into its folder, then the entry every launcher runs (app/dist/cli.js, with
 * app/package.json) is written again, whole, to name it: what starts from now on is the new version, a strom started
 * before goes on reading its own folder. The version before stays until the next update (or strom tidy); the folders
 * before it go, except those in use (`inUse`: a run's, a conversation's — appDirsInUse), a folder held only written to
 * update.log. An installation before 1.25 (the whole program in app/) keeps it as the version before: its entry
 * written over its cli.js, the rest made the entry alone by the update after. `ops`: tests' own disk.
 */
export async function installUpdate(
  env: Env,
  root: string,
  platform: NodeJS.Platform = process.platform,
  opts: { release?: Release; channel?: Channel; keep?: string[]; ops?: Partial<SwapOps>; inUse?: string[]; ready?: (version: string) => Promise<boolean> } = {},
): Promise<Updated> {
  const ops: SwapOps = { ...DISK, ...opts.ops };
  // never what lies inside app/, app-<version>/, app.old/ or node/: a research, its backups, the settings (`keep`)
  const inside = replacedHolding(root, opts.keep ?? [], platform)[0];
  if (inside) throw new Error(`${inside.folder} lies inside ${inside.entry}, which the update replaces — nothing was installed`);
  const release = opts.release ?? (await latestRelease(env, { timeoutMs: 10_000, ...(opts.channel ? { channel: opts.channel } : {}) }));
  if (!release) throw new Error("the newest version could not be learned (no network?)");
  const { version, base } = release;
  const infoFile = path.join(root, "install.json");
  const info = JSON.parse(fs.readFileSync(infoFile, "utf8")) as { node?: string; version?: string; channel?: string; app?: string; previous?: string };
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
    if (opts.ready && !(await opts.ready(version))) throw new UpdateHeld();
    // a version that knows only the whole program in app/ (back to a release before 1.25): installed the way it knows
    if (layoutOf(path.join(work, "app")) < VERSION_FOLDERS) return await installWhole(env, root, work, platform, ops, { info, infoFile, node, out, ...opts });
    const before = currentAppDir(root);
    // never the folder in use, the one before it (a strom started before the last update may read it) nor one at work
    const inUse = new Set([before, info.previous, ...(opts.inUse ?? [])].filter((d): d is string => !!d));
    const dir = freeAppDir(root, version, inUse, ops);
    const swapped = node ? await installNode(env, root, node, work, platform, ops) : undefined;
    const nodeBack = () => {
      try {
        swapped?.undo();
      } catch (e) {
        updateLog(root, `the Node before could not be put back: ${(e as Error).message}`);
      }
    };
    try {
      patiently(ops, () => ops.rename(path.join(work, "app"), path.join(root, dir)));
    } catch (e) {
      nodeBack();
      throw new Error(`the new version could not be put in place (${(e as NodeJS.ErrnoException).code ?? (e as Error).message}: another program held its files — an antivirus?) — nothing was replaced`);
    }
    try {
      writeEntry(root, dir, version, ops);
    } catch (e) {
      // the entry still names the version before: strom stays at it
      try {
        ops.rm(path.join(root, dir));
      } catch {
        // removed by the next update
      }
      nodeBack();
      throw new Error(`the new version could not be put in place (${(e as NodeJS.ErrnoException).code ?? (e as Error).message}: another program held strom's entry — an antivirus?) — strom stays at its version`);
    }
    swapped?.done();
    out.dir = dir;
    if (node) {
      out.node = { from: info.node ?? "?", to: node.version };
      info.node = node.version;
    }
    info.version = version;
    info.app = dir;
    info.previous = before ?? "app";
    if (opts.channel === "beta") info.channel = "beta";
    else if (opts.channel === "stable") delete info.channel;
    writeWhole(infoFile, `${JSON.stringify(info, null, 2)}\n`, ops);
    // the folders before the one before, unless in use — held by a process still reading it (Windows): left, said in update.log
    removeOldVersions(root, opts.inUse ?? [], ops, opts.keep ?? []);
  } finally {
    fs.rmSync(work, { recursive: true, force: true });
  }
  return out;
}

/**
 * A version knowing only the whole program in app/ (layout 1: a release before 1.25 — the way back from a beta or a
 * newer release) put in place the way it knows: app/ (the entry, or the whole program before) renamed to app.old/, the
 * unpacked app/ moved in its place, the marks of the researches' shims beside its cli.js kept, app.old/ removed (held:
 * update.log). install.json as that version reads it: its version, no `app`; `previous` the folder of the version that
 * ran until now (a strom started before reads it on; a newer strom installed again removes it once nobody uses it).
 * The folders of versions nobody uses go now — the older strom knows nothing of them. Nothing put in place: the Node
 * before back, app/ as it was, an error.
 */
async function installWhole(
  env: Env,
  root: string,
  work: string,
  platform: NodeJS.Platform,
  ops: SwapOps,
  o: { info: { node?: string; version?: string; channel?: string; app?: string; previous?: string }; infoFile: string; node?: NodeRelease; out: Updated; channel?: Channel; keep?: string[]; inUse?: string[] },
): Promise<Updated> {
  const { info, infoFile, node, out } = o;
  const before = currentAppDir(root);
  const app = path.join(root, "app");
  const aside = path.join(root, "app.old");
  const failed = (e: unknown) =>
    new Error(`the version could not be put in place (${(e as NodeJS.ErrnoException).code ?? (e as Error).message}: another program held strom's files — an antivirus?) — strom stays at its version`);
  try {
    if (fs.existsSync(aside)) patiently(ops, () => ops.rm(aside));
  } catch (e) {
    throw failed(e);
  }
  const swapped = node ? await installNode(env, root, node, work, platform, ops) : undefined;
  const nodeBack = () => {
    try {
      swapped?.undo();
    } catch (e) {
      updateLog(root, `the Node before could not be put back: ${(e as Error).message}`);
    }
  };
  const had = fs.existsSync(app);
  try {
    if (had) patiently(ops, () => ops.rename(app, aside));
  } catch (e) {
    nodeBack();
    throw failed(e);
  }
  try {
    patiently(ops, () => ops.rename(path.join(work, "app"), app));
  } catch (e) {
    try {
      if (had) patiently(ops, () => ops.rename(aside, app));
    } catch (back) {
      updateLog(root, `app/ could not be put back from app.old/: ${(back as Error).message}`);
    }
    nodeBack();
    throw failed(e);
  }
  swapped?.done();
  // the marks that tell this installation's shims from another's (core/self.ts shimMarker): the same path, the same mark
  try {
    for (const n of fs.readdirSync(path.join(aside, "dist"))) {
      if (!/^\.strom-shim-/.test(n)) continue;
      const to = path.join(app, "dist", n);
      if (!fs.existsSync(to)) fs.copyFileSync(path.join(aside, "dist", n), to);
    }
  } catch {
    // none: made again by the first run
  }
  try {
    if (had) patiently(ops, () => ops.rm(aside));
  } catch (e) {
    updateLog(root, `${aside} left: ${(e as Error).message}`);
  }
  if (node) {
    out.node = { from: info.node ?? "?", to: node.version };
    info.node = node.version;
  }
  const oldPrevious = info.previous;
  info.version = out.version;
  delete info.app;
  if (before) info.previous = before;
  else delete info.previous;
  if (o.channel === "beta") info.channel = "beta";
  else if (o.channel === "stable") delete info.channel;
  writeWhole(infoFile, `${JSON.stringify(info, null, 2)}\n`, ops);
  // the versions' folders nobody uses (never the one that ran until now, the one before it, one at work or one holding a research)
  const kept = new Set([before, oldPrevious, ...(o.inUse ?? [])].filter((d): d is string => !!d));
  for (const { dir } of versionDirs(root)) {
    if (kept.has(dir) || (o.keep ?? []).some((k) => holdsPath(path.join(root, dir), k))) continue;
    try {
      patiently(ops, () => ops.rm(path.join(root, dir)));
    } catch (e) {
      updateLog(root, `${path.join(root, dir)} left: ${(e as Error).message}`);
    }
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
