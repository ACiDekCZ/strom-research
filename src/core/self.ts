// This very installation of strom: how it was installed and how to start it
// again — for the agent's `strom` on PATH, the shortcut on the desktop, a
// process strom starts itself.
//
// strom is JavaScript on Node, installed one of three ways:
//   installed  by strom's installer: a folder with the official Node from
//              nodejs.org (node/) and strom's code (app/), install.json beside
//              them naming the command(s) on PATH that start it
//   npm        npm install -g strom-research, on the Node of the computer
//   source     run from the repository (node src/cli.ts)

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export interface Installation {
  kind: "installed" | "npm" | "source";
  /** installed: the folder holding node/ and app/. */
  root?: string;
  /** installed: the commands on PATH that start strom (strom; on Windows strom.cmd too). */
  launchers?: string[];
  /** installed: the Node version the installer put there. */
  node?: string;
}

const here = fileURLToPath(import.meta.url);

/** How this strom was installed (read once). */
let cached: Installation | undefined;
export function installation(): Installation {
  if (cached) return cached;
  if (here.endsWith(".ts")) return (cached = { kind: "source" });
  // …/app/dist/core/self.js
  const app = path.resolve(path.dirname(here), "..", "..");
  const root = path.dirname(app);
  try {
    if (path.basename(app) === "app") {
      const info = JSON.parse(fs.readFileSync(path.join(root, "install.json"), "utf8")) as { launchers?: string[]; node?: string };
      return (cached = { kind: "installed", root, launchers: info.launchers ?? [], ...(info.node ? { node: info.node } : {}) });
    }
  } catch {
    // not the installer's folder
  }
  return (cached = { kind: "npm" });
}

/** The program and arguments that run strom: this Node and its entry script (cli.ts from sources, cli.js built). */
export function stromLauncher(): { command: string; args: string[] } {
  const cli = path.resolve(path.dirname(here), "..", here.endsWith(".ts") ? "cli.ts" : "cli.js");
  return { command: process.execPath, args: [cli] };
}
