// A "Strom research" shortcut on the desktop: a double-click opens a terminal
// window with strom's menu — for users who never type a command.

import fs from "node:fs";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import type { Env } from "./paths.ts";
import { desktopDir, userHome } from "./paths.ts";
import { stromLauncher } from "./self.ts";

/** Make (or refresh) the shortcut; returns the files written. */
export function createShortcut(name: string, env: Env, platform: NodeJS.Platform = process.platform): string[] {
  const { command, args } = stromLauncher();
  const run = [command, ...args].map((a) => `"${a}"`).join(" ");
  const desktop = desktopDir(env, platform);
  fs.mkdirSync(desktop, { recursive: true });
  if (platform === "darwin") {
    // A .command file opens in Terminal on a double-click.
    const file = path.join(desktop, `${name}.command`);
    fs.writeFileSync(file, `#!/bin/sh\ncd "$HOME"\nexec ${run}\n`, { mode: 0o755 });
    fs.chmodSync(file, 0o755);
    return [file];
  }
  if (platform === "win32") {
    // chcp 65001: the console shows diacritics; the window stays when strom ends with an error.
    const file = path.join(desktop, `${name}.cmd`);
    fs.writeFileSync(file, `@echo off\r\nchcp 65001 >nul\r\ncd /d "%USERPROFILE%"\r\n${run}\r\nif errorlevel 1 pause\r\n`);
    return [file];
  }
  // Linux: an entry in the applications menu, and the same on the desktop.
  const entry = [
    "[Desktop Entry]",
    "Type=Application",
    `Name=${name}`,
    `Exec=${run}`,
    "Terminal=true",
    "Categories=Office;",
    "",
  ].join("\n");
  const apps = path.join(env.XDG_DATA_HOME ?? path.join(userHome(env), ".local", "share"), "applications");
  fs.mkdirSync(apps, { recursive: true });
  const files = [path.join(apps, "strom-research.desktop"), path.join(desktop, "strom-research.desktop")];
  for (const f of files) fs.writeFileSync(f, entry, { mode: 0o755 });
  return files;
}

/**
 * Run strom with these arguments in a new terminal window, in this folder — an
 * agent hands the research over to its own conversation (strom chat) without
 * starting one inside itself. strom's own settings from the environment go
 * along (another config folder, language, …), an agent's marks do not.
 * False when this computer cannot open a window (or a test asks not to).
 */
export function openInNewTerminal(argv: string[], cwd: string, env: Env, platform: NodeJS.Platform = process.platform): boolean {
  if (env.STROM_NO_OPEN === "1") return false;
  const { command, args } = stromLauncher();
  const skip = new Set(["STROM_WORKER", "STROM_SESSION", "STROM_NONINTERACTIVE"]);
  const own = Object.entries(env).filter(([k, v]) => k.startsWith("STROM_") && !skip.has(k) && v !== undefined) as [string, string][];
  const dir = path.join(cwd, ".strom", "open");
  fs.mkdirSync(dir, { recursive: true });
  const stamp = Date.now().toString(36);
  if (platform === "win32") {
    const q = (a: string) => `"${a.replace(/"/g, '""')}"`;
    const file = path.join(dir, `strom-${stamp}.cmd`);
    const lines = ["@echo off", "chcp 65001 >nul", ...own.map(([k, v]) => `set "${k}=${v}"`), `cd /d ${q(cwd)}`, [command, ...args, ...argv].map(q).join(" "), "if errorlevel 1 pause", ""];
    fs.writeFileSync(file, lines.join("\r\n"));
    const r = spawn(env.ComSpec ?? "cmd.exe", ["/d", "/c", "start", '""', file], { detached: true, stdio: "ignore", windowsHide: true });
    r.on("error", () => undefined);
    r.unref();
    return true;
  }
  const q = (a: string) => `'${a.replace(/'/g, `'\\''`)}'`;
  const file = path.join(dir, `strom-${stamp}.command`);
  const body = ["#!/bin/sh", ...own.map(([k, v]) => `export ${k}=${q(v)}`), `cd ${q(cwd)}`, `exec ${[command, ...args, ...argv].map(q).join(" ")}`, ""];
  fs.writeFileSync(file, body.join("\n"), { mode: 0o755 });
  fs.chmodSync(file, 0o755);
  // macOS: a .command file opens in Terminal. Linux: the desktop's terminal, when there is one.
  const how: [string, string[]][] =
    platform === "darwin"
      ? [["open", [file]]]
      : env.DISPLAY || env.WAYLAND_DISPLAY
        ? [["x-terminal-emulator", ["-e", file]], ["gnome-terminal", ["--", file]], ["konsole", ["-e", file]], ["xterm", ["-e", file]]]
        : [];
  for (const [cmd, a] of how) {
    if (platform !== "darwin" && spawnSync("sh", ["-c", `command -v ${cmd}`], { stdio: "ignore" }).status !== 0) continue;
    const r = spawn(cmd, a, { detached: true, stdio: "ignore", env: env as NodeJS.ProcessEnv });
    r.on("error", () => undefined);
    r.unref();
    return true;
  }
  return false;
}
