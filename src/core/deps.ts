// What strom needs on the computer besides itself, and how it gets it with the
// user's yes (strom doctor --fix, the setup wizard): git above all.
//
//   Windows  strom's own git — MinGit, the official portable Git for Windows,
//            downloaded, checked against its SHA-256 and unpacked into strom's
//            folder; for strom only: no admin, no installer, nothing on PATH
//   macOS    Apple's command line tools (git comes with them): a window of the
//            system installs them
//   Linux    the package manager — sudo is the user's; strom says the command

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import type { Env } from "./paths.ts";
import { gitProgram, ownGitDir, resetCache } from "./git.ts";

/** The MinGit strom installs (from git-for-windows' releases on GitHub). */
export const MINGIT = {
  version: "2.55.0.5",
  url: "https://github.com/git-for-windows/git/releases/download/v2.55.0.windows.5/MinGit-2.55.0.5-64-bit.zip",
  sha256: "56d7b226b7693196cfc71fef26568f536c4a021ab6c37ff2db4287bed908e96e",
  mb: 39,
};

/** How git comes to this computer. */
export type GitWay = "download" | "window" | "command";

export function gitWay(platform: NodeJS.Platform = process.platform): GitWay {
  return platform === "win32" ? "download" : platform === "darwin" ? "window" : "command";
}

/** The command a Linux user runs (their package manager). */
export function linuxGitCommand(): string {
  for (const [pm, cmd] of [
    ["apt-get", "sudo apt install git"],
    ["dnf", "sudo dnf install git"],
    ["pacman", "sudo pacman -S git"],
    ["zypper", "sudo zypper install git"],
  ] as const)
    if (spawnSync("sh", ["-c", `command -v ${pm}`], { stdio: "ignore" }).status === 0) return cmd;
  return "sudo apt install git";
}

/** Windows: download MinGit into strom's folder. True when git works after it. */
export async function installOwnGit(env: Env, say: (line: string) => void): Promise<boolean> {
  if (env.STROM_NO_INSTALL === "1") return false;
  const dir = ownGitDir(env);
  const part = `${dir}.part`;
  const zip = `${dir}.zip`;
  try {
    const res = await fetch(MINGIT.url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = Buffer.from(await res.arrayBuffer());
    const got = crypto.createHash("sha256").update(data).digest("hex");
    if (got !== MINGIT.sha256) throw new Error("the download is damaged (checksum mismatch)");
    fs.mkdirSync(path.dirname(dir), { recursive: true });
    fs.writeFileSync(zip, data);
    fs.rmSync(part, { recursive: true, force: true });
    fs.mkdirSync(part, { recursive: true });
    // Windows 10 and later have tar, which unpacks a zip.
    const r = spawnSync("tar", ["-xf", zip, "-C", part], { stdio: "ignore", windowsHide: true });
    if (r.status !== 0) throw new Error("could not unpack it");
    fs.rmSync(dir, { recursive: true, force: true });
    fs.renameSync(part, dir);
  } catch (e) {
    say((e as Error).message);
    return false;
  } finally {
    fs.rmSync(zip, { force: true });
    fs.rmSync(part, { recursive: true, force: true });
  }
  resetCache();
  return Boolean(gitProgram(env));
}
