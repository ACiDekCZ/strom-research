// A "Strom research" shortcut on the desktop: a double-click opens a terminal
// window with strom's menu — for users who never type a command. Its icon is
// Strom Research's own (assets/icon: the Strom app's tree with a magnifying
// glass), so it is not taken for the Strom app itself.

import fs from "node:fs";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import type { Env } from "./paths.ts";
import { configDir, desktopDir, userHome } from "./paths.ts";
import { stromLauncher } from "./self.ts";
import { assetPath } from "./assets.ts";

/** Strom Research's icon, as each system takes it. */
export const ICON = { png: assetPath("icon", "icon-512.png"), ico: assetPath("icon", "icon.ico") };

/** Where the Windows shortcut's command file lives (the desktop has the .lnk with the icon). */
export function shortcutCmdDir(env: Env, platform: NodeJS.Platform = process.platform): string {
  return path.join(configDir(env, platform), "shortcut");
}

/** macOS: a file's own icon in Finder (best effort — without it the file keeps the icon of its kind). */
function setMacIcon(file: string): void {
  if (process.platform !== "darwin" || !fs.existsSync(ICON.png)) return;
  const js = 'function run(a){ObjC.import("AppKit");var i=$.NSImage.alloc.initWithContentsOfFile(a[0]);return i.isNil()?"":String($.NSWorkspace.sharedWorkspace.setIconForFileOptions(i,a[1],0))}';
  spawnSync("osascript", ["-l", "JavaScript", "-e", js, ICON.png, file], { stdio: "ignore", timeout: 15_000 });
}

/** Windows: a .lnk on the desktop with the icon, starting the command file; false when PowerShell could not make it. */
function windowsLink(lnk: string, target: string, env: Env): boolean {
  const ps = "$s=(New-Object -ComObject WScript.Shell).CreateShortcut($env:STROM_LNK);$s.TargetPath=$env:STROM_CMD;$s.WorkingDirectory=$env:USERPROFILE;$s.IconLocation=$env:STROM_ICO+',0';$s.Save()";
  const r = spawnSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", ps], {
    stdio: "ignore",
    windowsHide: true,
    timeout: 30_000,
    env: { ...(env as NodeJS.ProcessEnv), STROM_LNK: lnk, STROM_CMD: target, STROM_ICO: ICON.ico },
  });
  return r.status === 0 && fs.existsSync(lnk);
}

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
    setMacIcon(file);
    return [file];
  }
  if (platform === "win32") {
    // chcp 65001: the console shows diacritics; the window stays when strom ends with an error.
    const body = `@echo off\r\nchcp 65001 >nul\r\ncd /d "%USERPROFILE%"\r\n${run}\r\nif errorlevel 1 pause\r\n`;
    // a .lnk carries the icon; it starts the command file kept in strom's folder
    const cmdDir = shortcutCmdDir(env, platform);
    fs.mkdirSync(cmdDir, { recursive: true });
    const cmd = path.join(cmdDir, `${name}.cmd`);
    fs.writeFileSync(cmd, body);
    const lnk = path.join(desktop, `${name}.lnk`);
    const onDesktop = path.join(desktop, `${name}.cmd`);
    if (windowsLink(lnk, cmd, env)) {
      fs.rmSync(onDesktop, { force: true }); // the shortcut of an earlier strom
      return [lnk];
    }
    // no PowerShell: the command file on the desktop, as it always was
    fs.writeFileSync(onDesktop, body);
    return [onDesktop];
  }
  // Linux: an entry in the applications menu, and the same on the desktop.
  const entry = [
    "[Desktop Entry]",
    "Type=Application",
    `Name=${name}`,
    `Exec=${run}`,
    `Icon=${ICON.png}`,
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
 * along (another config folder, language, …), an agent's marks do not: the
 * window clears them (a terminal may pass on the environment it was opened
 * from) and carries STROM_HANDOVER instead — strom there never hands over
 * again. At most one window in HANDOVER_GAP_MS: "recent" — the one opened a
 * moment ago is where to go on. The script deletes itself when it runs; older
 * ones left behind are cleared. False when this computer cannot open a window
 * (or a test asks not to).
 */
/** One handover window at a time: another asked within this long is not opened. */
export const HANDOVER_GAP_MS = 15_000;

/** What says an agent runs strom (core/which.ts detectAgent) — not the user's own settings of an agent (…_HOME). */
function isAgentMark(k: string): boolean {
  return ["CLAUDECODE", "CLAUDE_CODE_ENTRYPOINT", "AI_AGENT", "OPENCODE", "OPENCODE_PID"].includes(k) || (/^(CODEX|ANTIGRAVITY)_/.test(k) && !/_HOME$/.test(k));
}

export function openInNewTerminal(argv: string[], cwd: string, env: Env, platform: NodeJS.Platform = process.platform): boolean | "recent" {
  if (env.STROM_NO_OPEN === "1") return false;
  const { command, args } = stromLauncher();
  const skip = new Set(["STROM_WORKER", "STROM_SESSION", "STROM_NONINTERACTIVE", "STROM_HANDOVER"]);
  const own = Object.entries(env).filter(([k, v]) => k.startsWith("STROM_") && !skip.has(k) && v !== undefined) as [string, string][];
  const marks = Object.keys(env).filter(isAgentMark);
  const dir = path.join(cwd, ".strom", "open");
  fs.mkdirSync(dir, { recursive: true });
  const now = Date.now();
  const scripts = fs.readdirSync(dir).map((f) => ({ file: path.join(dir, f), at: fs.statSync(path.join(dir, f)).mtimeMs }));
  if (scripts.some((x) => now - x.at < HANDOVER_GAP_MS)) return "recent";
  for (const x of scripts) if (now - x.at > 24 * 3600_000) fs.rmSync(x.file, { force: true });
  const stamp = now.toString(36);
  if (platform === "win32") {
    const q = (a: string) => `"${a.replace(/"/g, '""')}"`;
    const file = path.join(dir, `strom-${stamp}.cmd`);
    const lines = ["@echo off", "chcp 65001 >nul", ...marks.map((k) => `set "${k}="`), ...own.map(([k, v]) => `set "${k}=${v}"`), 'set "STROM_HANDOVER=1"', `cd /d ${q(cwd)}`, [command, ...args, ...argv].map(q).join(" "), "if errorlevel 1 pause", ""];
    fs.writeFileSync(file, lines.join("\r\n"));
    const r = spawn(env.ComSpec ?? "cmd.exe", ["/d", "/c", "start", '""', file], { detached: true, stdio: "ignore", windowsHide: true });
    r.on("error", () => undefined);
    r.unref();
    return true;
  }
  const q = (a: string) => `'${a.replace(/'/g, `'\\''`)}'`;
  const file = path.join(dir, `strom-${stamp}.command`);
  const body = ["#!/bin/sh", 'rm -f -- "$0"', ...(marks.length ? [`unset ${marks.join(" ")}`] : []), ...own.map(([k, v]) => `export ${k}=${q(v)}`), "export STROM_HANDOVER=1", `cd ${q(cwd)}`, `exec ${[command, ...args, ...argv].map(q).join(" ")}`, ""];
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
