// The one commit of a beta on the branch beta: `node scripts/beta-commit.ts X.Y.Z-beta.N <base>` prints its hash.
//
// It is the sources' tree as it is (HEAD) with one file of its own: install/AGENTS.md, the text an agent reads to
// install strom (beta.stromapp.info/research/AGENTS.md leads to the branch beta), says the beta channel — the
// installers from the branch beta, run with STROM_CHANNEL=beta (a redirect cannot pass it on), the source's link to the
// branch beta. The branch main keeps the stable lines. Every rewrite must find its text: a changed AGENTS.md stops
// the beta instead of quietly giving an agent the stable channel on the beta web.
//
// The commit is made with a temporary index: nothing in the working tree, the index or a branch changes; pushing it
// (`git push origin <hash>:refs/heads/beta`) and its tag stay the person's steps.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { releaseKind } from "./npm-channel.ts";

const RAW = "https://raw.githubusercontent.com/ACiDekCZ/strom-research/";
/** The file of the agents' text in the sources. */
export const AGENTS_FILE = "install/AGENTS.md";

/** [find, replace]: plain text, every occurrence; each must be there. */
const REWRITES: [string, string][] = [
  ["# Strom Research — for AI agents\n", "# Strom Research — for AI agents (beta channel)\n"],
  [
    "Talk to the user in\ntheir language.\n",
    "Talk to the user in\ntheir language.\n\nThis is the beta channel of strom: its newest versions to try before they are\nreleased. The installers below are run with STROM_CHANNEL=beta, and\n`strom update` then stays on the beta (`strom update --channel stable` goes back).\n",
  ],
  ['`Get-Content -Raw -Encoding UTF8 "$env:TEMP\\strom-install.ps1" | iex`', '`$env:STROM_CHANNEL=\'beta\'; Get-Content -Raw -Encoding UTF8 "$env:TEMP\\strom-install.ps1" | iex`'],
  ["`sh /tmp/strom-install.sh`", "`STROM_CHANNEL=beta sh /tmp/strom-install.sh`"],
  [
    '`powershell -ExecutionPolicy Bypass -c "irm https://stromapp.info/research/install.ps1 | iex"` on Windows',
    `\`$env:STROM_CHANNEL='beta'; irm ${RAW}beta/install/install.ps1 | iex\` in PowerShell on Windows`,
  ],
  [`${RAW}main/install/install.sh | sh\``, `${RAW}beta/install/install.sh | STROM_CHANNEL=beta sh\``],
  [`${RAW}main/install/`, `${RAW}beta/install/`],
  ["strom-research/tree/main/install", "strom-research/tree/beta/install"],
];

/** The agents' text of the branch main as the branch beta gives it; a line not found, or a stable one left: an error. */
export function betaAgents(text: string): string {
  let out = text;
  for (const [find, replace] of REWRITES) {
    if (!out.includes(find)) throw new Error(`${AGENTS_FILE}: not found: ${find.trim()}`);
    out = out.split(find).join(replace);
  }
  if (/stromapp\.info\/research\/install\./.test(out)) throw new Error(`${AGENTS_FILE}: a production install address is left`);
  if (/strom-research\/(?:(?:tree|blob)\/)?main\/install/.test(out)) throw new Error(`${AGENTS_FILE}: an installer from the branch main is left`);
  const stable = /(?<!STROM_CHANNEL=beta )\bsh \/tmp\/|\| sh`/.test(out) || (out.match(/`[^`]*\| iex`/g) ?? []).some((run) => !run.includes("$env:STROM_CHANNEL='beta'"));
  if (stable) throw new Error(`${AGENTS_FILE}: an installer run without STROM_CHANNEL=beta is left`);
  return out;
}

function git(cwd: string, args: string[], opts: { input?: string; env?: NodeJS.ProcessEnv; raw?: boolean } = {}): string {
  const r = spawnSync("git", args, { cwd, encoding: "utf8", input: opts.input, env: { ...process.env, ...opts.env } });
  if (r.status !== 0) throw new Error(`git ${args.join(" ")} failed (${r.status ?? r.error?.message}): ${r.stderr}`);
  return opts.raw ? r.stdout : r.stdout.trim();
}

/**
 * The beta's commit in the repository at `cwd`: HEAD's tree with the beta's AGENTS.md, its parent `base`, the message
 * "Strom Research <version>". Checked: it differs from HEAD in that one file only.
 */
export function betaCommit(cwd: string, version: string, base: string): string {
  if (releaseKind(version) !== "beta") throw new Error(`${version}: not a beta (X.Y.Z-beta.N)`);
  const text = git(cwd, ["show", `HEAD:${AGENTS_FILE}`], { raw: true });
  const blob = git(cwd, ["hash-object", "-w", "--stdin"], { input: betaAgents(text) });
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "strom-beta-index-"));
  try {
    const env = { GIT_INDEX_FILE: path.join(dir, "index") };
    git(cwd, ["read-tree", "HEAD"], { env });
    git(cwd, ["update-index", "--cacheinfo", `100644,${blob},${AGENTS_FILE}`], { env });
    const tree = git(cwd, ["write-tree"], { env });
    const commit = git(cwd, ["commit-tree", tree, "-p", git(cwd, ["rev-parse", "--verify", `${base}^{commit}`]), "-m", `Strom Research ${version}`]);
    const changed = git(cwd, ["diff", "--name-only", commit, "HEAD"]);
    if (changed !== AGENTS_FILE) throw new Error(`the beta's commit differs from HEAD in: ${changed || "nothing"} (only ${AGENTS_FILE} may)`);
    return commit;
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [version, base] = process.argv.slice(2);
  if (!version || !base) {
    console.error("usage: node scripts/beta-commit.ts X.Y.Z-beta.N <base: origin/beta when it contains origin/main, else origin/main>");
    process.exit(2);
  }
  try {
    console.log(betaCommit(process.cwd(), version, base));
  } catch (e) {
    console.error((e as Error).message);
    process.exit(1);
  }
}
