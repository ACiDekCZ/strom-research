// The Strom app (https://stromapp.info) — a web app, often installed from the
// browser as an app of its own. strom notices it quietly and never asks: the
// app says so when it starts strom (STROM_APP), or its shortcut is found among
// the apps the browser installed (only names are looked at — never the
// browser's history). What strom does with it: say which file to import into
// the app. The user can say yes or no for good (strom config set strom.app).

import fs from "node:fs";
import path from "node:path";
import type { Env } from "./paths.ts";
import { desktopDir, userHome } from "./paths.ts";
import type { Settings } from "./config.ts";
import { foldText } from "./text.ts";

export const STROM_APP_URL = "https://stromapp.info/run/";

/** The pages of the Strom app — on the web, its beta, a copy on this computer (its development): the only ones strom opens with a research, and the only ones its bridge lets in. */
export function isStromAppOrigin(origin: string): boolean {
  return origin === "https://stromapp.info" || origin === "https://beta.stromapp.info" || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
}

/**
 * The copy of the Strom app the person installed strom from, when it is another than stromapp.info (its beta, its
 * development): the line it shows carries its address (STROM_APP_URL beside STROM_FROM_APP). Only the app's own pages.
 */
export function appUrlFromInstall(env: { STROM_FROM_APP?: string | undefined; STROM_APP_URL?: string | undefined }): string | undefined {
  const raw = env.STROM_FROM_APP?.trim() ? env.STROM_APP_URL?.trim() : undefined;
  return raw ? appCopyUrl(raw) : undefined;
}

/** An address of another copy of the Strom app (its beta, its development) as the app says it; undefined: stromapp.info itself, or no copy of it. */
export function appCopyUrl(raw: string): string | undefined {
  try {
    const u = new URL(raw);
    if (!/^https?:$/.test(u.protocol) || !isStromAppOrigin(u.origin) || u.username || u.password) return undefined;
    const url = u.href;
    return url === STROM_APP_URL ? undefined : url;
  } catch {
    return undefined;
  }
}

/**
 * Installed from the Strom app: which copy — its address (its beta, its development), null for stromapp.info itself (its
 * line carries no address), undefined when not installed from the app or the address is no copy of it.
 */
export function appCopyOfInstall(env: { STROM_FROM_APP?: string | undefined; STROM_APP_URL?: string | undefined }): string | null | undefined {
  if (!env.STROM_FROM_APP?.trim()) return undefined;
  const raw = env.STROM_APP_URL?.trim();
  if (!raw) return null;
  const copy = appUrlFromInstall(env);
  if (copy) return copy;
  try {
    return new URL(raw).href === STROM_APP_URL ? null : undefined;
  } catch {
    return undefined;
  }
}

/**
 * The name of the app's tree the line of the app carries (STROM_FROM_APP_NAME): what the research is called unless the
 * person says another — plain text only, one line, at most 80 characters.
 */
export function appTreeNameFromInstall(env: { STROM_FROM_APP?: string | undefined; STROM_FROM_APP_NAME?: string | undefined }): string | undefined {
  if (!env.STROM_FROM_APP?.trim()) return undefined;
  const name = (env.STROM_FROM_APP_NAME ?? "").normalize("NFC").replace(/[\p{Cc}\p{Cf}]/gu, " ").replace(/\s+/gu, " ").trim().slice(0, 80).trim();
  return name || undefined;
}

/** The Strom app's address: the setting strom.app.url (STROM_APP_URL) points strom at another copy of it (its beta, its development). */
export function stromAppUrl(settings: Settings): string {
  const url = settings.resolve("strom.app.url")?.value;
  return typeof url === "string" && url ? url : STROM_APP_URL;
}

/**
 * The Strom app opens a research by itself (from its version 3.0.0; its import
 * contract, docs/GEDCOM-IMPORT.md in the Strom repository): ?import-url=<the
 * tree's GEDCOM on this computer> opens that tree — created the first time,
 * updated after — and ?live=<the bridge> follows it while it goes on (see
 * core/live.ts). On since stromapp.info runs 3.0.0; another copy of the app
 * (strom.app.url: a beta, its development) is taken as current too.
 */
export const APP_OPENS_RESEARCH = true;

export function appOpensResearch(settings: Settings): boolean {
  return APP_OPENS_RESEARCH || stromAppUrl(settings) !== STROM_APP_URL;
}

/**
 * The Strom app sends the user's edits back (?send=<the bridge>, POST <bridge>/sync — the app's spec
 * docs/ZADANI_SYNC_Z_APLIKACE.md): the first version of stromapp.info that does (3.3.0, 2026-09-27).
 * Another copy of the app (its beta, its development: strom.app.url) is taken as current.
 */
export const APP_SENDS_CHANGES: string | undefined = "3.3.0";

export function appSendsChanges(settings: Settings): boolean {
  return APP_SENDS_CHANGES !== undefined || stromAppUrl(settings) !== STROM_APP_URL;
}

/**
 * The Strom app opens strom-research:// links (the app's spec docs/ZADANI_VYZKUM_ODKAZY_Z_APLIKACE.md): it reads
 * each excerpt's mark (_STROM_CLIP) and the links a research offers (_STROM_LINKS in the GEDCOM the bridge serves).
 * The first version of stromapp.info that does (3.4.0, 2026-09-27); another copy of the app (its beta, its
 * development: strom.app.url) is taken as current. An app of a known version (strom.version) goes by it.
 */
export const APP_OPENS_LINKS: string | undefined = "3.4.0";

export function appOpensLinks(settings: Settings, version?: string): boolean {
  if (stromAppUrl(settings) !== STROM_APP_URL) return true;
  if (!APP_OPENS_LINKS) return false;
  if (!version) return true;
  const n = (v: string) => v.split(".").map((x) => Number.parseInt(x, 10) || 0);
  const [a, b] = [n(version), n(APP_OPENS_LINKS)];
  for (let i = 0; i < 3; i++) if ((a[i] ?? 0) !== (b[i] ?? 0)) return (a[i] ?? 0) > (b[i] ?? 0);
  return true;
}

/**
 * The Strom app shows where the tree ends (the app's spec docs/ZADANI_VYZKUM_kraj-stromu.md): per person above whom
 * the tree does not go on, what the research knows there (_STROM_EDGE), and the families nothing links to the tree
 * (_STROM_ISLAND). The first version of stromapp.info that does (3.6.0, 2026-09-30); another copy of the app (its
 * beta, its development: strom.app.url) is taken as current. An app of a known version (strom.version) goes by it;
 * an unknown one is taken as today's (an older app only skips the tags).
 */
export const APP_SHOWS_EDGES: string | undefined = "3.6.0";

export function appShowsEdges(settings: Settings, version?: string): boolean {
  if (stromAppUrl(settings) !== STROM_APP_URL) return true;
  if (!APP_SHOWS_EDGES) return false;
  if (!version) return true;
  const n = (v: string) => v.split(".").map((x) => Number.parseInt(x, 10) || 0);
  const [a, b] = [n(version), n(APP_SHOWS_EDGES)];
  for (let i = 0; i < 3; i++) if ((a[i] ?? 0) !== (b[i] ?? 0)) return (a[i] ?? 0) > (b[i] ?? 0);
  return true;
}

/**
 * The Strom app keeps a couple's events as events (the app's spec docs/ZADANI_VYZKUM_udalosti-paru.md, its 3.8.0):
 * their residence goes to it as 1 RESI under FAM (before: an EVEN named so — an older app keeps either in the couple's
 * note). stromapp.info from 3.8.0 (2026-10-02); another copy of the app (its beta, its development) is taken as current.
 * An app of unknown version: today's.
 */
export const APP_SHOWS_COUPLE_EVENTS: string | undefined = "3.8.0";

export function appShowsCoupleEvents(settings: Settings, version?: string): boolean {
  if (stromAppUrl(settings) !== STROM_APP_URL) return true;
  if (!APP_SHOWS_COUPLE_EVENTS) return false;
  if (!version) return true;
  const n = (v: string) => v.split(".").map((x) => Number.parseInt(x, 10) || 0);
  const [a, b] = [n(version), n(APP_SHOWS_COUPLE_EVENTS)];
  for (let i = 0; i < 3; i++) if ((a[i] ?? 0) !== (b[i] ?? 0)) return (a[i] ?? 0) > (b[i] ?? 0);
  return true;
}

/**
 * The Strom app knows a research that is only an archive (the app's spec docs/ZADANI_VYZKUM_app-vstup-dat.md, step F):
 * 1 _STROM_MODE archive in the header of the Strom file (/status says it too: accepts.mode) — it hides what leads to
 * an agent. stromapp.info from 3.9.0; another copy of the app is taken as current. An app of unknown version: none
 * (3.9 always says its version, so one that says none is older — promised to the app at its 3.9).
 */
export const APP_KNOWS_ARCHIVE: string | undefined = "3.9.0";

export function appKnowsArchive(settings: Settings, version?: string): boolean {
  if (stromAppUrl(settings) !== STROM_APP_URL) return true;
  if (!APP_KNOWS_ARCHIVE || !version) return false;
  const n = (v: string) => v.split(".").map((x) => Number.parseInt(x, 10) || 0);
  const [a, b] = [n(version), n(APP_KNOWS_ARCHIVE)];
  for (let i = 0; i < 3; i++) if ((a[i] ?? 0) !== (b[i] ?? 0)) return (a[i] ?? 0) > (b[i] ?? 0);
  return true;
}

/**
 * The Strom app shows who read a source (the app's spec docs/ZADANI_VYZKUM_app-vstup-dat.md, step B): 1 _STROM_READ
 * user|research|both on each record the research has (none: nobody read it — the user's transcript a lead), and
 * 1 _STROM_VERIFIED Y on a source of the app whose transcript the user verified. stromapp.info from 3.9.0; another
 * copy of the app (its beta, its development) is taken as current. An app of unknown version: none (3.9 always says
 * its version, so one that says none is older — promised to the app at its 3.9).
 */
export const APP_SHOWS_SOURCE_READS: string | undefined = "3.9.0";

export function appShowsSourceReads(settings: Settings, version?: string): boolean {
  if (stromAppUrl(settings) !== STROM_APP_URL) return true;
  if (!APP_SHOWS_SOURCE_READS || !version) return false;
  const n = (v: string) => v.split(".").map((x) => Number.parseInt(x, 10) || 0);
  const [a, b] = [n(version), n(APP_SHOWS_SOURCE_READS)];
  for (let i = 0; i < 3; i++) if ((a[i] ?? 0) !== (b[i] ?? 0)) return (a[i] ?? 0) > (b[i] ?? 0);
  return true;
}

/**
 * The Strom app keeps parents of a child who are no couple (the app's spec docs/ZADANI_VYZKUM_app-vstup-dat.md, P1):
 * 1 _STROM_NO_COUPLE Y on a family of one parent with nothing of a couple (no marriage, events, notes, sources), and
 * on one of two parents the app sent so — without it the app draws a placeholder "?" partner beside the one parent.
 * stromapp.info from 3.9.0; another copy of the app (its beta, its development) is taken as current. An app of
 * unknown version: today's (an older one lists the tag as unsupported and draws the placeholder as before, nothing
 * lost).
 */
export const APP_KNOWS_NO_COUPLE: string | undefined = "3.9.0";

export function appKnowsNoCouple(settings: Settings, version?: string): boolean {
  if (stromAppUrl(settings) !== STROM_APP_URL) return true;
  if (!APP_KNOWS_NO_COUPLE) return false;
  if (!version) return true;
  const n = (v: string) => v.split(".").map((x) => Number.parseInt(x, 10) || 0);
  const [a, b] = [n(version), n(APP_KNOWS_NO_COUPLE)];
  for (let i = 0; i < 3; i++) if ((a[i] ?? 0) !== (b[i] ?? 0)) return (a[i] ?? 0) > (b[i] ?? 0);
  return true;
}

/**
 * The Strom app shows how sure each fact is (the app's spec docs/ZADANI_VYZKUM_app-vstup-dat.md, "stav údaje"):
 * 2 _STROM_STATUS lead|possible|probable|proven under each fact, in place of the note "Lead — not proven by a record"
 * (which landed among the user's notes). stromapp.info from 3.9.0 (its betas from 3.9.0-beta.9 read it: a pre-release
 * counts as its version); another copy of the app (its beta, its development) is taken as current. An app of unknown
 * version keeps the note: an older one would lose what the note says.
 */
export const APP_SHOWS_FACT_STATUS: string | undefined = "3.9.0";

export function appShowsFactStatus(settings: Settings, version?: string): boolean {
  if (stromAppUrl(settings) !== STROM_APP_URL) return true;
  if (!APP_SHOWS_FACT_STATUS || !version) return false;
  const n = (v: string) => v.split(".").map((x) => Number.parseInt(x, 10) || 0);
  const [a, b] = [n(version), n(APP_SHOWS_FACT_STATUS)];
  for (let i = 0; i < 3; i++) if ((a[i] ?? 0) !== (b[i] ?? 0)) return (a[i] ?? 0) > (b[i] ?? 0);
  return true;
}

/**
 * The Strom app turns an excerpt cut from a picture that lies on its side (2 _STROM_ORIENT 2–8, a phone's photo): from
 * 3.9.0 (the app's spec docs/ZADANI_VYZKUM_app-vstup-dat.md); another copy of the app is taken as current. An app of
 * unknown version (one older than 3.9 says none) gets the excerpt turned already, without the tag — it would show it
 * lying on its side.
 */
export const APP_TURNS_EXCERPTS: string | undefined = "3.9.0";

export function appTurnsExcerpts(settings: Settings, version?: string): boolean {
  if (stromAppUrl(settings) !== STROM_APP_URL) return true;
  if (!APP_TURNS_EXCERPTS || !version) return false;
  const n = (v: string) => v.split(".").map((x) => Number.parseInt(x, 10) || 0);
  const [a, b] = [n(version), n(APP_TURNS_EXCERPTS)];
  for (let i = 0; i < 3; i++) if ((a[i] ?? 0) !== (b[i] ?? 0)) return (a[i] ?? 0) > (b[i] ?? 0);
  return true;
}

/**
 * The Strom app shows the new version of a story the user approved, waiting beside it (the app's spec
 * docs/ZADANI_VYZKUM_vypraveni-zamek.md): 2 _DRAFT under _STORY, and in the bridge's waiting (kind story). stromapp.info
 * from 3.7.0 (2026-10-02); another copy of the app (its beta, its development: strom.app.url) is taken as current, so it
 * can be built. An app of unknown version: today's.
 */
export const APP_SHOWS_STORY_DRAFTS: string | undefined = "3.7.0";

export function appShowsStoryDrafts(settings: Settings, version?: string): boolean {
  if (stromAppUrl(settings) !== STROM_APP_URL) return true;
  if (!APP_SHOWS_STORY_DRAFTS) return false;
  if (!version) return true;
  const n = (v: string) => v.split(".").map((x) => Number.parseInt(x, 10) || 0);
  const [a, b] = [n(version), n(APP_SHOWS_STORY_DRAFTS)];
  for (let i = 0; i < 3; i++) if ((a[i] ?? 0) !== (b[i] ?? 0)) return (a[i] ?? 0) > (b[i] ?? 0);
  return true;
}

/** The address that opens the Strom app to send the user's edited tree to the bridge. */
export function sendAppUrl(bridge: string, settings: Settings): string {
  return `${stromAppUrl(settings)}?send=${encodeURIComponent(bridge)}`;
}

/** The address that opens the Strom app to hand one of its trees to a new research (strom-research://new). */
export function adoptAppUrl(bridge: string, settings: Settings): string {
  return `${stromAppUrl(settings)}?adopt=${encodeURIComponent(bridge)}`;
}

/** The address that opens the Strom app following a research through its bridge. */
export function liveAppUrl(bridge: string, settings: Settings): string {
  return `${stromAppUrl(settings)}?live=${encodeURIComponent(bridge)}`;
}

/** The address that opens a research's GEDCOM (served on this computer) in the Strom app. */
export function importAppUrl(file: string, settings: Settings): string {
  return `${stromAppUrl(settings)}?import-url=${encodeURIComponent(file)}`;
}

/** The page for people starting research with an AI agent: what an agent is, which one, how to install it. */
export const RESEARCH_URL = "https://stromapp.info/research/";

/** That page in the user's language (it speaks en, cs, de), at a section: "agents". */
export function researchUrl(lang: string, section?: string): string {
  return `${RESEARCH_URL}${["cs", "de"].includes(lang) ? `?lang=${lang}` : ""}${section ? `#${section}` : ""}`;
}

export interface InstalledApp {
  /** What to open to start it (an .app, a shortcut, a .desktop entry). */
  path: string;
  /** Where it was found, for the user: "Chrome app", "Safari web app", … */
  kind: string;
  /** Installed from a Chromium browser: that browser, and the app's id there (and its profile, when the shortcut says it). */
  browser?: string;
  appId?: string;
  profile?: string;
}

/** A Chromium web app's id: 32 letters a–p. */
const APP_ID = /--app-id=([a-p]{32})/;
const PROFILE = /--profile-directory=(?:"([^"]+)"|(\S+))/;
/** The browser a folder of web apps belongs to. */
const BROWSER_OF: Record<string, string> = { Chrome: "Google Chrome", Edge: "Microsoft Edge", "Brave Browser": "Brave", Chromium: "Chromium", Vivaldi: "Vivaldi" };

function read(file: string, encoding: BufferEncoding = "utf8"): string {
  try {
    return fs.readFileSync(file, encoding);
  } catch {
    return "";
  }
}

/** The id and profile a shortcut starts the app with (a .lnk keeps its arguments in UTF-16, a .desktop entry in its Exec line). */
function launchOf(text: string): { appId?: string; profile?: string } {
  // the arguments first; else the icon Chrome keeps for it on Windows (User Data\<profile>\Web Applications\_crx_<id>\…)
  const id = APP_ID.exec(text)?.[1] ?? ICON_ID.exec(text)?.[1];
  const p = PROFILE.exec(text) ?? ICON_PROFILE.exec(text);
  return { ...(id ? { appId: id } : {}), ...(p ? { profile: p[1] ?? p[2] } : {}) };
}

const ICON_ID = /Web Applications[\\/]_crx_([a-p]{32})/;
const ICON_PROFILE = /User Data[\\/]([^\\/]+)[\\/]Web Applications/;

/**
 * What a Windows shortcut (.lnk, MS-SHLLINK) says: the program it starts, its arguments and its icon — read by its
 * structure (the strings lie wherever the parts before them end, at an odd byte as often as not: a file read as
 * UTF-16 from its start garbles them then), and the text at both alignments besides, for a shortcut read wrong.
 */
export function lnkText(buf: Buffer): string {
  const said: string[] = [];
  try {
    if (buf.length >= 76 && buf.readUInt32LE(0) === 0x4c) {
      const flags = buf.readUInt32LE(20);
      const unicode = (flags & 0x80) !== 0;
      let at = 76;
      if (flags & 0x01) at += 2 + buf.readUInt16LE(at);
      if (flags & 0x02) {
        const size = buf.readUInt32LE(at);
        const header = buf.readUInt32LE(at + 4);
        const local = buf.readUInt32LE(at + 16);
        const localW = header >= 0x24 ? buf.readUInt32LE(at + 28) : 0;
        if (localW) said.push(cString(buf, at + localW, true));
        else if (local) said.push(cString(buf, at + local, false));
        at += size;
      }
      // NAME, RELATIVE_PATH, WORKING_DIR, ARGUMENTS, ICON_LOCATION — each when its flag is set
      for (const bit of [0x04, 0x08, 0x10, 0x20, 0x40]) {
        if (!(flags & bit)) continue;
        const n = buf.readUInt16LE(at);
        const len = unicode ? n * 2 : n;
        said.push(buf.subarray(at + 2, at + 2 + len).toString(unicode ? "utf16le" : "latin1"));
        at += 2 + len;
      }
    }
  } catch {
    // cut short: what the text says below
  }
  return [...said, buf.toString("utf16le"), buf.subarray(1).toString("utf16le"), buf.toString("latin1")].join("\n");
}

function cString(buf: Buffer, at: number, wide: boolean): string {
  if (!wide) {
    const end = buf.indexOf(0, at);
    return buf.subarray(at, end < 0 ? undefined : end).toString("latin1");
  }
  let end = at;
  while (end + 1 < buf.length && (buf[end] !== 0 || buf[end + 1] !== 0)) end += 2;
  return buf.subarray(at, end).toString("utf16le");
}

/** The browser a shortcut starts (its program, or its icon in the browser's folder): chrome_proxy.exe, msedge_proxy.exe… */
function browserOfLnk(text: string): string | undefined {
  const t = text.toLowerCase();
  if (/microsoft[\\/]edge|msedge/.test(t)) return "Microsoft Edge";
  if (/bravesoftware|brave(_proxy)?\.exe/.test(t)) return "Brave";
  if (/vivaldi/.test(t)) return "Vivaldi";
  if (/[\\/]chromium[\\/]/.test(t)) return "Chromium";
  if (/google[\\/]chrome|chrome(_proxy)?\.exe/.test(t)) return "Google Chrome";
  return undefined;
}

function readBuf(file: string): Buffer {
  try {
    return fs.readFileSync(file);
  } catch {
    return Buffer.alloc(0);
  }
}

/** "Strom", "Strom - Family Tree" — not this tool ("Strom Research"). */
export function isStromName(name: string): boolean {
  const n = foldText(name).trim();
  // (Windows: a shortcut of another profile's copy may carry the profile's name in brackets — "Strom (Work)")
  return /^strom(\s*[-–:|]\s*.*)?(\s*\(.*\))?$/u.test(n) && !/research|vyzkum/u.test(n);
}

function entries(dir: string): string[] {
  try {
    return fs.readdirSync(dir);
  } catch {
    return [];
  }
}

function originOf(url: string): string {
  try {
    return new URL(url).origin;
  } catch {
    return "";
  }
}

/**
 * The Strom app installed from a browser, if there is one — the copy at `url`
 * (default: stromapp.info; its beta installed beside it is another app). A
 * shortcut that says its address (macOS: the app's Info.plist; Linux: --app=)
 * is matched by it; one that does not (Windows, Safari) is taken by its name,
 * and only for stromapp.info itself. `prefer`: the browser whose app is
 * taken first when it was installed from several.
 */
export function installedStromApp(env: Env, platform: NodeJS.Platform = process.platform, url: string = STROM_APP_URL, prefer?: string): InstalledApp | undefined {
  const all = installedStromApps(env, platform, url);
  // the one installed from that browser (its own window), else the first that says the app's id, else the first
  return (prefer ? all.find((a) => a.appId && a.browser === prefer) : undefined) ?? all.find((a) => a.appId) ?? all[0];
}

/** Every copy of the Strom app at `url` installed here (installedStromApp), in the order strom looks for them. */
export function installedStromApps(env: Env, platform: NodeJS.Platform = process.platform, url: string = STROM_APP_URL): InstalledApp[] {
  const home = userHome(env);
  const found: InstalledApp[] = [];
  const want = originOf(url);
  const byName = want === originOf(STROM_APP_URL);
  /** Is it that copy: its address when the shortcut gives one, else its name. */
  const isIt = (name: string, address: string | undefined): boolean => (address ? originOf(address) === want : byName && isStromName(name));
  if (platform === "darwin") {
    const apps = path.join(home, "Applications");
    const browsers: [string, string][] = [
      ["Chrome Apps.localized", "Chrome app"],
      ["Chrome Apps", "Chrome app"],
      ["Edge Apps.localized", "Edge app"],
      ["Brave Browser Apps.localized", "Brave app"],
      ["Chromium Apps.localized", "Chromium app"],
      ["Vivaldi Apps.localized", "Vivaldi app"],
    ];
    for (const [dir, kind] of browsers)
      for (const f of entries(path.join(apps, dir))) {
        if (!f.endsWith(".app")) continue;
        const at = path.join(apps, dir, f);
        const plist = read(path.join(at, "Contents", "Info.plist"));
        const address = /<key>CrAppModeShortcutURL<\/key>\s*<string>([^<]+)<\/string>/.exec(plist)?.[1];
        if (!isIt(f.slice(0, -4), address)) continue;
        const id = /<key>CrAppModeShortcutID<\/key>\s*<string>([a-p]{32})<\/string>/.exec(plist)?.[1];
        const browser = BROWSER_OF[dir.replace(/ Apps(\.localized)?$/, "")];
        found.push({ path: at, kind, ...(id && browser ? { browser, appId: id } : {}) });
      }
    // Safari: File → Add to Dock puts the web app straight into ~/Applications.
    if (byName) for (const f of entries(apps)) if (f.endsWith(".app") && isStromName(f.slice(0, -4))) found.push({ path: path.join(apps, f), kind: "Safari web app" });
    return found;
  }
  if (platform === "win32") {
    if (!byName) return found;
    // The Start menu (Chrome: its folder Chrome Apps; Edge and others: the Programs folder itself), then the desktop
    // (a shortcut the person kept there only). The first that says the app's id wins; else the first by its name.
    const programs = path.join(env.APPDATA ?? path.join(home, "AppData", "Roaming"), "Microsoft", "Windows", "Start Menu", "Programs");
    const places: [string, string | undefined][] = [
      [path.join(programs, "Chrome Apps"), "Google Chrome"],
      [path.join(programs, "Edge Apps"), "Microsoft Edge"],
      [programs, undefined],
      ...[...new Set([desktopDir(env, "win32"), path.join(home, "Desktop")])].map((d): [string, undefined] => [d, undefined]),
    ];
    for (const [d, folderBrowser] of places)
      for (const f of entries(d)) {
        if (!f.toLowerCase().endsWith(".lnk") || !isStromName(f.slice(0, -4))) continue;
        const at = path.join(d, f);
        const text = lnkText(readBuf(at));
        const launch = launchOf(text);
        const browser = browserOfLnk(text) ?? folderBrowser ?? (d === programs ? "Google Chrome" : undefined);
        const short = Object.entries(BROWSER_OF).find(([, b]) => b === browser)?.[0]?.replace(/ Browser$/, "");
        found.push({ path: at, kind: short ? `${short} App` : "app", ...(launch.appId && browser ? { browser, ...launch } : {}) });
      }
    return found;
  }
  const dir = path.join(env.XDG_DATA_HOME ?? path.join(home, ".local", "share"), "applications");
  for (const f of entries(dir)) {
    if (!f.endsWith(".desktop")) continue;
    let text = "";
    try {
      text = fs.readFileSync(path.join(dir, f), "utf8");
    } catch {
      continue;
    }
    const name = /^Name=(.*)$/m.exec(text)?.[1];
    const exec = /^Exec=(.*)$/m.exec(text)?.[1] ?? "";
    if (name && /--app-id=|--app=/.test(text) && isIt(name, /--app=(?:"([^"]+)"|(\S+))/.exec(exec)?.slice(1).find(Boolean))) {
      const browser = /edge/.test(exec) ? "Microsoft Edge" : /brave/.test(exec) ? "Brave" : /vivaldi/.test(exec) ? "Vivaldi" : /chromium/.test(exec) ? "Chromium" : /chrome/.test(exec) ? "Google Chrome" : undefined;
      const launch = launchOf(exec);
      found.push({ path: path.join(dir, f), kind: "browser app", ...(launch.appId && browser ? { browser, ...launch } : {}) });
    }
  }
  return found;
}

export type StromAppState = "yes" | "no" | "seen" | "unknown";

/** What strom knows of the Strom app: the user's word first, then what it noticed. */
export function stromAppState(settings: Settings): StromAppState {
  const said = settings.config.stromApp;
  if (said === "yes" || said === "no") return said;
  return settings.config.stromAppSeen ? "seen" : "unknown";
}

/**
 * Notice the Strom app and remember it (quietly, in the user config). `look`
 * also checks the apps installed from browsers — a few folder listings, done
 * where it is cheap to do (setup, the menu), not on every command.
 */
export function noticeStromApp(settings: Settings, env: Env, opts: { look?: boolean } = {}): InstalledApp | undefined {
  if (settings.config.stromApp === "no") return undefined;
  const at = new Date().toISOString();
  if (env.STROM_APP) {
    const version = env.STROM_APP_VERSION;
    const seen = settings.config.stromAppSeen;
    if (!seen || seen.via !== "started strom" || seen.version !== version) {
      settings.config.stromAppSeen = { via: "started strom", at, ...(version ? { version } : {}) };
      settings.save();
    }
  }
  if (!opts.look) return undefined;
  const app = installedStromApp(env, process.platform, stromAppUrl(settings));
  if (app && !settings.config.stromAppSeen) {
    settings.config.stromAppSeen = { via: app.kind, at };
    settings.save();
  }
  return app;
}
