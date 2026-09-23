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
const WAIT_SECONDS = 300;

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
    const ps =
      "Add-Type -AssemblyName PresentationFramework; " +
      `$r = [System.Windows.MessageBox]::Show(${psString(text.question)}, ${psString(text.title)}, 'YesNo', 'Warning', 'No', 'DefaultDesktopOnly'); ` +
      "Write-Output $r";
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
