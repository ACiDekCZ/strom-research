// The sample research (strom demo, spec 143): a made-up family researched by strom, downloaded from the Strom app's web
// (the files the web offers beside its button, <base>/<lang>/) and put in place apart from everything of the person's —
// a folder of its own inside strom's settings folder, with settings of its own (its trees, its shared folder, its seal
// key): never among the person's family trees, their backups, the trees the menu or the app's links know. Marked
// `demo: true` in its strom.json: looked through, an agent may work on it, but strom offers none and recommends none.
// The download checked against its SHA-256 as strom update checks its own; anything not as it should be: nothing set up.

import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { configDir, type Env } from "./paths.ts";
import { StromError, UsageError } from "./errors.ts";
import { findPack, unpack, type Unpacked } from "./pack.ts";
import type { TreeConfig } from "./model.ts";

/** The languages a sample research is made in (the Strom app's web: cs, en, de, pl). */
export const DEMO_LANGS = ["cs", "en", "de", "pl"] as const;
export type DemoLang = (typeof DEMO_LANGS)[number];

/** The most a sample's package may be (it is a few MB): anything larger is no sample of ours. */
export const DEMO_MAX_BYTES = 200 * 1024 * 1024;

/** The folder of the sample research inside strom's settings folder: its settings, and its trees with their shared folder. */
export const DEMO_FOLDER = "demo";

export { isDemo } from "./mode.ts";

/** The language a sample is asked in: one of DEMO_LANGS, else undefined. */
export function demoLang(lang: string | undefined): DemoLang | undefined {
  const l = (lang ?? "").trim().toLowerCase();
  return (DEMO_LANGS as readonly string[]).includes(l) ? (l as DemoLang) : undefined;
}

export interface DemoPaths {
  /** Everything of the sample: removed whole by strom demo --remove. */
  root: string;
  /** The sample's own settings folder (STROM_CONFIG_DIR of its strom). */
  config: string;
  /** Its home: the trees, and the shared folder in it. */
  home: string;
  shared: string;
}

/** Where the sample research lies on this computer: inside the person's settings folder of strom, apart. */
export function demoPaths(env: Env): DemoPaths {
  const root = path.join(configDir(env), DEMO_FOLDER);
  const home = path.join(root, "research");
  return { root, config: path.join(root, "config"), home, shared: path.join(home, "shared") };
}

/**
 * The environment the sample's strom runs in: its own settings, home, trees and shared folder (whatever the person's
 * variables say of theirs), no tree of the person's named; STROM_DEMO_OF the person's own settings folder, kept from an
 * agent working on the sample as from one on their own research (agents/files.ts keptSettings).
 */
export function demoEnv(env: Env): Env {
  const p = demoPaths(env);
  const out: Env = { ...env, STROM_CONFIG_DIR: p.config, STROM_HOME: p.home, STROM_TREES: p.home, STROM_SHARED: p.shared, STROM_DEMO_OF: configDir(env) };
  delete out.STROM_TREE;
  return out;
}

/** The person's own settings folder an agent on the sample is kept from as well (set by demoEnv), else undefined. */
export function demoOf(env: Env): string | undefined {
  const d = (env.STROM_DEMO_OF ?? "").trim();
  return d ? path.resolve(d) : undefined;
}

/** The sample research of a language already on this computer: its folder, or undefined. */
export function demoTrees(env: Env): { root: string; config: TreeConfig }[] {
  const { home } = demoPaths(env);
  let names: string[] = [];
  try {
    names = fs.readdirSync(home);
  } catch {
    return [];
  }
  const out: { root: string; config: TreeConfig }[] = [];
  for (const n of names) {
    const root = path.join(home, n);
    try {
      const config = JSON.parse(fs.readFileSync(path.join(root, "strom.json"), "utf8")) as TreeConfig;
      if (config?.id) out.push({ root, config });
    } catch {
      // not a tree (the shared folder)
    }
  }
  return out;
}

/** The files of a sample on the web: <base>/<lang>/VERSION, the package of that version and its SHA-256 beside it. */
export function demoFiles(base: string, lang: DemoLang, version: string): { package: string; sha: string } {
  const dir = `${base.replace(/\/+$/u, "")}/${lang}`;
  const name = `strom-ukazka-${lang}-${version}.strom`;
  return { package: `${dir}/${name}`, sha: `${dir}/${name}.sha256` };
}

/** A version as the web's VERSION file says it: only what a version is (no path, nothing else). */
const VERSION_SAID = /^[0-9A-Za-z][0-9A-Za-z.+-]{0,39}$/u;

/** How a sample is fetched: an address of the web (https:, http: of this computer in a test) or a folder (file:). */
export type Fetch = (url: string, maxBytes: number) => Promise<Buffer>;

/** Fetch a file of the web (or file://): at most maxBytes, within a minute. */
export async function fetchFile(url: string, maxBytes: number): Promise<Buffer> {
  if (url.startsWith("file://")) {
    const file = new URL(url);
    if (fs.statSync(file).size > maxBytes) throw new Error(`${url} is larger than a sample`);
    return fs.readFileSync(file);
  }
  const res = await fetch(url, { signal: AbortSignal.timeout(60_000), redirect: "follow" });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  const length = Number(res.headers.get("content-length") ?? 0);
  if (length > maxBytes) throw new Error(`${url} is larger than a sample`);
  const body = Buffer.from(await res.arrayBuffer());
  if (body.length > maxBytes) throw new Error(`${url} is larger than a sample`);
  return body;
}

export interface Downloaded {
  version: string;
  /** The package, checked, in a temporary folder of its own (the caller removes `dir`). */
  file: string;
  dir: string;
  bytes: number;
}

/**
 * The sample of a language downloaded and checked: its version (VERSION), its package and the SHA-256 the web gives
 * beside it — the package not as its SHA-256 says: refused (nothing kept). Errors: StromError with code demo.download
 * (the web not reached, a file missing) or demo.damaged.
 */
export async function downloadDemo(base: string, lang: DemoLang, get: Fetch = fetchFile): Promise<Downloaded> {
  const dir = `${base.replace(/\/+$/u, "")}/${lang}`;
  let version: string;
  let pkg: Buffer;
  let said: string;
  try {
    version = (await get(`${dir}/VERSION`, 1024)).toString("utf8").split(/\r?\n/u)[0]!.trim();
    if (!VERSION_SAID.test(version)) throw new Error(`${dir}/VERSION says no version`);
    const files = demoFiles(base, lang, version);
    said = (await get(files.sha, 4096)).toString("utf8");
    pkg = await get(files.package, DEMO_MAX_BYTES);
  } catch (e) {
    const why = e instanceof Error ? e.message : String(e);
    throw new StromError(`the sample research could not be downloaded: ${why}`, { code: "demo.download", params: { why }, hint: "strom demo again once the computer is online" });
  }
  const want = /\b([0-9a-f]{64})\b/iu.exec(said)?.[1]?.toLowerCase();
  const sha = crypto.createHash("sha256").update(pkg).digest("hex");
  if (!want || want !== sha) throw new StromError("the downloaded sample research is damaged (its SHA-256 does not match) — nothing was set up", { code: "demo.damaged", hint: "strom demo again" });
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "strom-demo-"));
  const file = path.join(tmp, path.basename(demoFiles(base, lang, version).package));
  fs.writeFileSync(file, pkg);
  return { version, file, dir: tmp, bytes: pkg.length };
}

/**
 * The checked package put in place among the sample's trees (core/pack.ts unpack: each image against its SHA-256, the
 * tree checked whole, taken over with a seal key of the sample's own settings). The language asked and the package's
 * must agree; a package with connectors (code) is refused.
 */
export function unpackDemo(file: string, lang: DemoLang, env: Env): Unpacked {
  const p = demoPaths(env);
  const pack = findPack(file);
  try {
    if (pack.manifest.tree.lang !== lang) throw new UsageError(`the sample of ${lang} holds a research in ${pack.manifest.tree.lang}`, { code: "demo.lang", hint: "strom demo again" });
    // a sample carries no code: a package with connectors is none of ours
    if (pack.manifest.connectors.length) throw new StromError("the downloaded sample research carries connectors — a sample has none: nothing was set up", { code: "demo.code" });
    return unpack(pack, p.home, p.shared, demoEnv(env));
  } finally {
    if (pack.tmp) fs.rmSync(pack.tmp, { recursive: true, force: true });
  }
}
