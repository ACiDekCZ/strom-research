// A yes/no question in a window of the operating system. Consents are the
// user's: from inside an agent's session strom cannot tell whether the user or
// the agent typed a command, but a window on the screen is answered by the
// person in front of it — the agent neither sees it nor clicks it. So the user
// never has to leave the conversation for a terminal of their own.

import { spawnSync } from "node:child_process";
import type { Env } from "./paths.ts";
import { which } from "./which.ts";

export interface DialogText {
  title: string;
  question: string;
  yes: string;
  no: string;
}

/** How long the window waits for an answer before it counts as a no. */
export const WAIT_SECONDS = 300;

/**
 * Windows: the window's owner — an invisible form in the middle of the main screen, on top of all and active — so the
 * question comes up in front and in sight (found on Windows: with no owner it came up off the screen, answered blind).
 */
const WIN_OWNER =
  "Add-Type -AssemblyName System.Windows.Forms, System.Drawing; " +
  "$f = New-Object System.Windows.Forms.Form; $f.TopMost = $true; $f.ShowInTaskbar = $false; $f.StartPosition = 'Manual'; " +
  "$a = [System.Windows.Forms.Screen]::PrimaryScreen.WorkingArea; $f.Size = New-Object System.Drawing.Size(1, 1); " +
  "$f.Location = New-Object System.Drawing.Point([int]($a.X + $a.Width / 2), [int]($a.Y + $a.Height / 2)); $f.Opacity = 0; " +
  "$f.Show(); $f.Activate(); ";

/** AppleScript string literal. */
function appleString(s: string): string {
  return `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

/** PowerShell single-quoted string literal. */
function psString(s: string): string {
  return `'${s.replace(/'/g, "''")}'`;
}

/**
 * Ask in a window: true (yes), false (no, closed or no answer in time), or
 * undefined when this computer cannot show one (no desktop, no dialog tool).
 */
/**
 * Can this computer show a window of the system to ask in? Not with dialogs off (STROM_NO_DIALOG: a test run, a user who
 * wants their consents in a terminal only), nor on Linux without a desktop or a dialog tool — then nothing is said to
 * wait in one (found: strom update --json said a question waited in a window with none shown).
 */
export function canShowDialog(env: Env, platform: NodeJS.Platform = process.platform): boolean {
  if (env.STROM_NO_DIALOG === "1") return false;
  if (platform === "darwin" || platform === "win32") return true;
  return Boolean((env.DISPLAY || env.WAYLAND_DISPLAY) && (which("zenity", env) || which("kdialog", env)));
}

export function systemDialog(text: DialogText, env: Env, platform: NodeJS.Platform = process.platform): boolean | undefined {
  // A test run, or a user who wants their consents in a terminal only.
  if (env.STROM_NO_DIALOG === "1") return undefined;
  const run = (cmd: string, args: string[]) =>
    spawnSync(cmd, args, { encoding: "utf8", timeout: (WAIT_SECONDS + 10) * 1000, windowsHide: false, env: env as NodeJS.ProcessEnv });
  if (platform === "darwin") {
    const script =
      `display dialog ${appleString(text.question)} with title ${appleString(text.title)} ` +
      `buttons {${appleString(text.no)}, ${appleString(text.yes)}} default button ${appleString(text.no)} ` +
      `cancel button ${appleString(text.no)} with icon caution giving up after ${WAIT_SECONDS}`;
    const r = run("osascript", ["-e", script]);
    if (r.error) return undefined;
    return r.status === 0 && r.stdout.includes(`button returned:${text.yes}`) && !r.stdout.includes("gave up:true");
  }
  if (platform === "win32") {
    const ps = `${WIN_OWNER}$r = [System.Windows.Forms.MessageBox]::Show($f, ${psString(text.question)}, ${psString(text.title)}, 'YesNo', 'Warning', 'Button2'); $f.Dispose(); Write-Output $r`;
    const r = run("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", ps]);
    if (r.error || r.status !== 0) return undefined;
    return r.stdout.trim() === "Yes";
  }
  // Linux and others: only with a desktop and a dialog tool.
  if (!env.DISPLAY && !env.WAYLAND_DISPLAY) return undefined;
  if (which("zenity", env)) {
    const r = run("zenity", ["--question", "--title", text.title, "--text", text.question, "--ok-label", text.yes, "--cancel-label", text.no, "--timeout", String(WAIT_SECONDS)]);
    if (r.error) return undefined;
    return r.status === 0;
  }
  if (which("kdialog", env)) {
    const r = run("kdialog", ["--title", text.title, "--yesno", text.question, "--yes-label", text.yes, "--no-label", text.no]);
    if (r.error) return undefined;
    return r.status === 0;
  }
  return undefined;
}

/**
 * Say something in a window (one button): what a link from the Strom app could not do, with no terminal to say it
 * in. False when this computer cannot show one.
 */
export function systemNotice(title: string, message: string, ok: string, env: Env, platform: NodeJS.Platform = process.platform): boolean {
  if (env.STROM_NO_DIALOG === "1") return false;
  const run = (cmd: string, args: string[]) =>
    spawnSync(cmd, args, { encoding: "utf8", timeout: (WAIT_SECONDS + 10) * 1000, windowsHide: false, env: env as NodeJS.ProcessEnv });
  if (platform === "darwin") {
    const script = `display dialog ${appleString(message)} with title ${appleString(title)} buttons {${appleString(ok)}} default button ${appleString(ok)} with icon note giving up after ${WAIT_SECONDS}`;
    return !run("osascript", ["-e", script]).error;
  }
  if (platform === "win32") {
    const ps = `${WIN_OWNER}[void][System.Windows.Forms.MessageBox]::Show($f, ${psString(message)}, ${psString(title)}, 'OK', 'Information'); $f.Dispose()`;
    const r = run("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", ps]);
    return !r.error && r.status === 0;
  }
  if (!env.DISPLAY && !env.WAYLAND_DISPLAY) return false;
  if (which("zenity", env)) return !run("zenity", ["--info", "--title", title, "--text", message, "--timeout", String(WAIT_SECONDS)]).error;
  if (which("kdialog", env)) return !run("kdialog", ["--title", title, "--msgbox", message]).error;
  return false;
}
