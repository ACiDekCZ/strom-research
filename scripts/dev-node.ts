// Which Node the development of strom needs: the tests run with `node --test --test-global-setup`, which Node 24 has
// first. strom itself (package.json "engines") still runs on an older Node. Run by `pretest` and `pretest:quick`:
// an older Node is said in one sentence and the tests do not start. The minimum is package.json's
// devEngines.runtime.version (npm only warns of it, onFail "warn": `npm install`, a typecheck and a build run on the
// Node strom itself runs on — the tests alone refused here).
//
//   node scripts/dev-node.ts            this Node
//   node scripts/dev-node.ts 22.18.0    a Node of that version (how it is tested)

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

interface Pkg {
  engines?: { node?: string };
  devEngines?: { runtime?: { name?: string; version?: string } };
}

/** The lowest major version of a range written as ">=N…", else undefined. */
const lowestMajor = (range: string | undefined) => {
  const m = /^\s*>=\s*v?(\d+)/.exec(range ?? "");
  return m ? Number(m[1]) : undefined;
};

/** Why the tests cannot run on Node `version` (as process.versions.node writes it), else undefined. */
export function devNodeRefusal(version: string, pkg: Pkg): string | undefined {
  const needed = lowestMajor(pkg.devEngines?.runtime?.version);
  if (needed === undefined) return undefined;
  const major = Number(/^v?(\d+)/.exec(version)?.[1]);
  if (Number.isFinite(major) && major >= needed) return undefined;
  const users = pkg.engines?.node ? ` (strom itself still runs on Node ${pkg.engines.node})` : "";
  return `The tests need Node ${needed} or newer (node --test --test-global-setup); this is Node ${version}${users}.`;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const pkg = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, "..", "package.json"), "utf8")) as Pkg;
  const refusal = devNodeRefusal(process.argv[2] ?? process.versions.node, pkg);
  if (refusal) {
    console.error(refusal);
    process.exit(1);
  }
}
