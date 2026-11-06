// Pins "How Strom works" (the strom-doc repository) to one commit for this research:
//
//   node scripts/pin-strom-doc.ts [sha]        (npm run doc:pin -- [sha])
//
// Source: $STROM_DOC_DIR, else ../strom-doc next to this repository. Without a sha it takes that clone's origin/main
// (fetch it first). A commit that is not on origin/main is refused: strom only carries published text.
//
// It replaces assets/strom-doc/ with cs/ en/ de/ pl/ REJSTRIK.md CISLA.md LICENSE of that commit (git archive: the
// commit, never the working tree), writes assets/strom-doc/PIN and "stromDoc" in package.json. `strom doc` reads only
// assets/strom-doc (from the sources and from the package alike), so moving the pin is one commit here and nothing is
// downloaded at a build or a release.

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE = path.resolve(process.env.STROM_DOC_DIR || path.join(ROOT, "..", "strom-doc"));
const TARGET = path.join(ROOT, "assets", "strom-doc");
const PATHS = ["cs", "en", "de", "pl", "REJSTRIK.md", "CISLA.md", "LICENSE"];

function fail(message: string): never {
  console.error(`doc:pin: ${message}`);
  process.exit(1);
}

const git = (...args: string[]) => execFileSync("git", ["-C", SOURCE, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();

if (!fs.existsSync(path.join(SOURCE, ".git"))) fail(`${SOURCE} is not a strom-doc clone (set STROM_DOC_DIR)`);

const wanted = process.argv[2] || "origin/main";
let sha = "";
try {
  sha = git("rev-parse", "--verify", `${wanted}^{commit}`);
} catch {
  fail(`${wanted} is not a commit of ${SOURCE}`);
}
try {
  execFileSync("git", ["-C", SOURCE, "merge-base", "--is-ancestor", sha, "origin/main"], { stdio: "ignore" });
} catch {
  fail(`${sha} is not on origin/main of ${SOURCE}; only published text is pinned`);
}

const archive = execFileSync("git", ["-C", SOURCE, "archive", "--format=tar", sha, ...PATHS], { maxBuffer: 256 * 1024 * 1024 });
fs.rmSync(TARGET, { recursive: true, force: true });
fs.mkdirSync(TARGET, { recursive: true });
execFileSync("tar", ["-x", "-C", TARGET], { input: archive });
fs.writeFileSync(path.join(TARGET, "PIN"), `${sha}\n`);

const pkgPath = path.join(ROOT, "package.json");
const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8")) as Record<string, unknown>;
// a new key goes right after "version": the research's version and its documentation side by side
const next = "stromDoc" in pkg ? { ...pkg, stromDoc: sha } : Object.fromEntries(Object.entries(pkg).flatMap(([k, v]) => (k === "version" ? [[k, v], ["stromDoc", sha]] : [[k, v]])));
fs.writeFileSync(pkgPath, `${JSON.stringify(next, null, 2)}\n`);

console.log(`doc:pin: assets/strom-doc = strom-doc ${sha}`);
