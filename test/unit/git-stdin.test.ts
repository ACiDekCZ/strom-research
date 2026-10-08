// What git reads on its stdin (the commit message of commit-tree, the paths of cat-file --batch) comes to it from a
// file, never written through a pipe: on macOS a spawnSync writing it into git's stdin (a socket) now and then left git
// waiting for it for good, the tree's lock held (npm test hung an hour in review.test.ts in a git commit-tree -F -).
// A git of its own here says what its stdin is: a pipe or a socket is refused, so the old way fails at once.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { commitAll, gitProgram, showFiles } from "../../src/core/git.ts";
import { hasGit } from "../helpers.ts";

test("git reads the commit message and the paths it is asked for from a file, never from a pipe; a long message whole", { skip: !hasGit || process.platform === "win32" }, () => {
  const real = gitProgram();
  assert.ok(real);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "strom-git-stdin-"));
  const wrapper = path.join(dir, "git");
  // commit-tree and cat-file --batch: their stdin must be a file (test -f), never a pipe (-p) or a socket (-S)
  fs.writeFileSync(
    wrapper,
    `#!/bin/sh\ncase "$1" in commit-tree|cat-file) if [ -p /dev/stdin ] || [ -S /dev/stdin ]; then echo "stdin is a pipe" >&2; exit 99; fi;; esac\nexec ${JSON.stringify(real)} "$@"\n`,
    { mode: 0o755 },
  );
  const repo = path.join(dir, "repo");
  fs.mkdirSync(repo);
  execFileSync(real!, ["init", "-q", repo]);
  const was = process.env.STROM_GIT;
  process.env.STROM_GIT = wrapper;
  try {
    assert.equal(gitProgram(), wrapper);
    fs.writeFileSync(path.join(repo, "a.txt"), "Příliš žluťoučký kůň\n");
    // a message longer than a pipe's buffer (64 KB), in any script
    const message = `Zápis\n\n${"Пётр Иванов, Jan Novák — ".repeat(4000)}`;
    const hash = commitAll(repo, message);
    assert.ok(hash);
    assert.equal(execFileSync(real!, ["log", "-1", "--format=%B"], { cwd: repo, encoding: "utf8" }).trim(), message.trim());
    assert.deepEqual([...showFiles(repo, "HEAD", ["a.txt", "b.txt"])], [["a.txt", "Příliš žluťoučký kůň\n"], ["b.txt", undefined]]);
  } finally {
    if (was === undefined) delete process.env.STROM_GIT;
    else process.env.STROM_GIT = was;
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
