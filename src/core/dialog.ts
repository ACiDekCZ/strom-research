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
 * Can this computer show a window of the system to ask in? Not with dialogs off (STROM_NO_DIALOG: a test run, a user who
 * wants their consents in a terminal only), nor on Linux without a desktop or a dialog tool — then nothing is said to
 * wait in one (found: strom update --json said a question waited in a window with none shown).
 */
export function canShowDialog(env: Env, platform: NodeJS.Platform = process.platform): boolean {
  if (env.STROM_NO_DIALOG === "1") return false;
  if (platform === "darwin" || platform === "win32") return true;
  return Boolean((env.DISPLAY || env.WAYLAND_DISPLAY) && (which("zenity", env) || which("kdialog", env)));
}

/**
 * The program and arguments of a yes/no window, and how its answer is read: true (yes), false (no, closed, no answer in
 * time). Undefined when this computer has none (Linux without a desktop or a dialog tool). No (Cancel) is the default
 * button and Esc's on every system.
 */
export function yesNoCommand(text: DialogText, platform: NodeJS.Platform, env: Env = {}): { cmd: string; args: string[]; answer: (status: number | null, stdout: string) => boolean | undefined } | undefined {
  if (platform === "darwin") {
    const script =
      `display dialog ${appleString(text.question)} with title ${appleString(text.title)} ` +
      `buttons {${appleString(text.no)}, ${appleString(text.yes)}} default button ${appleString(text.no)} ` +
      `cancel button ${appleString(text.no)} with icon caution giving up after ${WAIT_SECONDS}`;
    return { cmd: "osascript", args: ["-e", script], answer: (status, stdout) => status === 0 && stdout.includes(`button returned:${text.yes}`) && !stdout.includes("gave up:true") };
  }
  if (platform === "win32") {
    const ps = `${WIN_OWNER}$r = [System.Windows.Forms.MessageBox]::Show($f, ${psString(text.question)}, ${psString(text.title)}, 'YesNo', 'Warning', 'Button2'); $f.Dispose(); Write-Output $r`;
    return { cmd: "powershell.exe", args: ["-NoProfile", "-NonInteractive", "-Command", ps], answer: (status, stdout) => (status !== 0 ? undefined : stdout.trim() === "Yes") };
  }
  // Linux and others: only with a desktop and a dialog tool.
  if (!env.DISPLAY && !env.WAYLAND_DISPLAY) return undefined;
  if (which("zenity", env))
    return { cmd: "zenity", args: ["--question", "--title", text.title, "--text", text.question, "--ok-label", text.yes, "--cancel-label", text.no, "--timeout", String(WAIT_SECONDS)], answer: (status) => status === 0 };
  if (which("kdialog", env)) return { cmd: "kdialog", args: ["--title", text.title, "--yesno", text.question, "--yes-label", text.yes, "--no-label", text.no], answer: (status) => status === 0 };
  return undefined;
}

/**
 * Ask in a window: true (yes), false (no, closed or no answer in time), or
 * undefined when this computer cannot show one (no desktop, no dialog tool).
 */
export function systemDialog(text: DialogText, env: Env, platform: NodeJS.Platform = process.platform): boolean | undefined {
  // A test run, or a user who wants their consents in a terminal only.
  if (env.STROM_NO_DIALOG === "1") return undefined;
  const command = yesNoCommand(text, platform, env);
  if (!command) return undefined;
  const r = spawnSync(command.cmd, command.args, { encoding: "utf8", timeout: (WAIT_SECONDS + 10) * 1000, windowsHide: false, env: env as NodeJS.ProcessEnv });
  if (r.error) return undefined;
  return command.answer(r.status, r.stdout);
}

/** A question with choices: the main one first, at most two, besides `later` (nothing decided). */
export interface ChoiceText {
  title: string;
  question: string;
  choices: { key: string; label: string }[];
  /** The button that decides nothing (Esc, closing the window and no answer in time do the same). */
  later: string;
  /** Windows (its buttons are Yes, No, Cancel): the line that says which is which. */
  keys?: string;
}

/**
 * The program and arguments of a window with choices: the first choice — the recommended one — is the button Enter
 * presses; Esc (and closing the window) presses `later`. macOS: three buttons, the recommended one the default, `later`
 * the cancel button; Windows: Yes / No / Cancel (Yes the default, Cancel Esc's), said in the text which is which;
 * Linux: zenity's OK (the default) with the second choice an extra button and `later` its cancel, kdialog's Yes / No /
 * Cancel with their labels (Yes the default).
 */
export function choiceCommand(text: ChoiceText, platform: NodeJS.Platform, env: Env = {}): { cmd: string; args: string[] } | undefined {
  const [first, second] = text.choices;
  if (!first) return undefined;
  if (platform === "darwin") {
    const buttons = [text.later, ...(second ? [second.label] : []), first.label].map(appleString).join(", ");
    const script =
      `display dialog ${appleString(text.question)} with title ${appleString(text.title)} buttons {${buttons}} ` +
      `default button ${appleString(first.label)} cancel button ${appleString(text.later)} with icon caution giving up after ${WAIT_SECONDS}`;
    return { cmd: "osascript", args: ["-e", script] };
  }
  if (platform === "win32") {
    const q = text.keys ? `${text.question}\n\n${text.keys}` : text.question;
    const ps = `${WIN_OWNER}$r = [System.Windows.Forms.MessageBox]::Show($f, ${psString(q)}, ${psString(text.title)}, '${second ? "YesNoCancel" : "OKCancel"}', 'Warning', 'Button1'); $f.Dispose(); Write-Output $r`;
    return { cmd: "powershell.exe", args: ["-NoProfile", "-NonInteractive", "-Command", ps] };
  }
  if (which("zenity", env)) return { cmd: "zenity", args: ["--question", "--title", text.title, "--text", text.question, "--ok-label", first.label, "--cancel-label", text.later, ...(second ? ["--extra-button", second.label] : []), "--timeout", String(WAIT_SECONDS)] };
  if (which("kdialog", env))
    return second
      ? { cmd: "kdialog", args: ["--title", text.title, "--yesnocancel", text.question, "--yes-label", first.label, "--no-label", second.label, "--cancel-label", text.later] }
      : { cmd: "kdialog", args: ["--title", text.title, "--yesno", text.question, "--yes-label", first.label, "--no-label", text.later] };
  return undefined;
}

/**
 * Ask in a window with choices: the key of the choice made; null when none was — later, Esc, the window closed, no
 * answer in time (none of them is an answer: nothing is decided); undefined when this computer cannot show one.
 * Enter takes the first choice, the recommended one (choiceCommand).
 */
export function systemChoice(text: ChoiceText, env: Env, platform: NodeJS.Platform = process.platform): string | null | undefined {
  if (env.STROM_NO_DIALOG === "1") return undefined;
  const [first, second] = text.choices;
  if (!first) return undefined;
  const run = (cmd: string, args: string[]) =>
    spawnSync(cmd, args, { encoding: "utf8", timeout: (WAIT_SECONDS + 10) * 1000, windowsHide: false, env: env as NodeJS.ProcessEnv });
  const timedOut = (e: Error | undefined) => (e as NodeJS.ErrnoException | undefined)?.code === "ETIMEDOUT";
  const byLabel = (label: string) => text.choices.find((c) => c.label === label)?.key ?? null;
  if (platform !== "darwin" && platform !== "win32" && !env.DISPLAY && !env.WAYLAND_DISPLAY) return undefined;
  const command = choiceCommand(text, platform, env);
  if (!command) return undefined;
  if (platform === "darwin") {
    const r = run(command.cmd, command.args);
    if (r.error) return timedOut(r.error) ? null : undefined;
    // the cancel button (Esc) ends with an error (-128): nothing chosen
    if (r.status !== 0 || r.stdout.includes("gave up:true")) return null;
    const m = /button returned:(.*?)(?:, gave up:\w+)?\s*$/su.exec(r.stdout);
    return m ? byLabel(m[1]!) : null;
  }
  const r = run(command.cmd, command.args);
  if (r.error) return timedOut(r.error) ? null : undefined;
  if (platform === "win32") {
    if (r.status !== 0) return undefined;
    const a = r.stdout.trim();
    return a === "Yes" || a === "OK" ? first.key : a === "No" && second ? second.key : null;
  }
  if (command.cmd === "zenity") {
    if (r.status === 0) return first.key;
    // the extra button: its label on stdout; later, Esc or no answer in time (5): nothing
    return second && r.stdout.trim() === second.label ? second.key : null;
  }
  return r.status === 0 ? first.key : r.status === 1 && second ? second.key : null;
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
