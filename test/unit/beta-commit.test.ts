// The beta's commit on the branch beta: the sources' tree with the agents' text of the beta channel — the installers
// from the branch beta, run with STROM_CHANNEL=beta — and nothing else changed; the branch main keeps the stable text.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { AGENTS_FILE, betaAgents, betaCommit } from "../../scripts/beta-commit.ts";
import { hasGit } from "../helpers.ts";

const ROOT = path.resolve(import.meta.dirname, "..", "..");
const main = fs.readFileSync(path.join(ROOT, AGENTS_FILE), "utf8");

test("the agents' text of the beta: every installer from the branch beta and run with STROM_CHANNEL=beta; main's stays stable", () => {
  const beta = betaAgents(main);
  assert.doesNotMatch(beta, /strom-research\/(?:tree\/)?main\/install|stromapp\.info\/research\/install\./);
  assert.match(beta, /raw\.githubusercontent\.com\/ACiDekCZ\/strom-research\/beta\/install\/install\.ps1 -OutFile/);
  assert.match(beta, /`\$env:STROM_CHANNEL='beta'; Get-Content -Raw -Encoding UTF8 "\$env:TEMP\\strom-install\.ps1" \| iex`/);
  assert.match(beta, /raw\.githubusercontent\.com\/ACiDekCZ\/strom-research\/beta\/install\/install\.sh -o \/tmp\/strom-install\.sh/);
  assert.match(beta, /`STROM_CHANNEL=beta sh \/tmp\/strom-install\.sh`/);
  assert.match(beta, /`\$env:STROM_CHANNEL='beta'; irm https:\/\/raw\.githubusercontent\.com\/ACiDekCZ\/strom-research\/beta\/install\/install\.ps1 \| iex`/);
  assert.match(beta, /`curl -fsSL https:\/\/raw\.githubusercontent\.com\/ACiDekCZ\/strom-research\/beta\/install\/install\.sh \| STROM_CHANNEL=beta sh`/);
  assert.match(beta, /tree\/beta\/install/);
  assert.match(beta, /^This is the beta channel of strom/m);
  // the rest of the text as it is
  assert.match(beta, /^3\. Run `strom`\./m);
  // main's own text: stable, nothing of a beta
  assert.doesNotMatch(main, /beta/i);
  assert.match(main, /strom-research\/main\/install\/install\.sh -o \/tmp\/strom-install\.sh/);
});

test("the agents' text changed so that a line is not found, or a stable run is left: the beta stops", () => {
  assert.throws(() => betaAgents(main.replace("`sh /tmp/strom-install.sh`", "`bash /tmp/strom-install.sh`")), /not found: `sh \/tmp\/strom-install\.sh`/);
  assert.throws(() => betaAgents(main + "\nOr: `curl -fsSL https://stromapp.info/research/install.sh | sh`\n"), /production install address/);
  assert.throws(() => betaAgents(main + "\nOr: `irm https://example.org/install.ps1 | iex`\n"), /without STROM_CHANNEL=beta/);
});

test("the beta's commit: HEAD's tree with the beta's agents' text, its parent the base, nothing else changed — the working tree, index and branches untouched", { skip: !hasGit }, () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), "strom-beta-commit-"));
  const git = (...args: string[]) => execFileSync("git", args, { cwd: repo, encoding: "utf8", env: { ...process.env, GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@example.org", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@example.org" } }).trim();
  try {
    git("init", "-q", "-b", "main");
    // betaCommit takes the repository's identity, as in a release; the test's HOME has no ~/.gitconfig
    git("config", "user.name", "t");
    git("config", "user.email", "t@example.org");
    fs.mkdirSync(path.join(repo, "install"));
    fs.writeFileSync(path.join(repo, AGENTS_FILE), main);
    fs.writeFileSync(path.join(repo, "README.md"), "Ahoj — Grüße — Привет\n");
    git("add", ".");
    git("commit", "-q", "-m", "one");
    const base = git("rev-parse", "HEAD");
    fs.writeFileSync(path.join(repo, "README.md"), "two\n");
    git("commit", "-q", "-am", "two");
    fs.writeFileSync(path.join(repo, "README.md"), "not committed\n");
    const head = git("rev-parse", "HEAD");
    const c = betaCommit(repo, "1.15.0-beta.2", base);
    assert.equal(git("log", "-1", "--format=%P|%s", c), `${base}|Strom Research 1.15.0-beta.2`);
    assert.equal(git("diff", "--name-only", c, "HEAD"), AGENTS_FILE);
    assert.equal(git("show", `${c}:${AGENTS_FILE}`) + "\n", betaAgents(main));
    assert.equal(git("show", `${c}:README.md`), "two");
    // nothing of the repository moved
    assert.equal(git("rev-parse", "HEAD"), head);
    assert.equal(git("branch", "--list"), "* main");
    assert.equal(git("status", "--porcelain"), "M README.md");
    assert.equal(fs.readFileSync(path.join(repo, AGENTS_FILE), "utf8"), main);
    assert.throws(() => betaCommit(repo, "1.15.0", base), /not a beta/);
    assert.throws(() => betaCommit(repo, "1.15.0-rc.1", base), /not a beta/);
  } finally {
    fs.rmSync(repo, { recursive: true, force: true });
  }
});
