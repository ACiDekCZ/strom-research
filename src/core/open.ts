// Open a folder, a web address or an installed app the way a double-click
// would: Finder / Explorer / the file manager, the default browser.

import { spawn } from "node:child_process";
import type { Env } from "./paths.ts";

/** Open it for the user; false when this computer cannot (no desktop) or tests ask not to. */
export function openForUser(target: string, env: Env, platform: NodeJS.Platform = process.platform): boolean {
  if (env.STROM_NO_OPEN === "1") return false;
  let cmd: string;
  let args: string[];
  if (platform === "darwin") [cmd, args] = ["open", [target]];
  // A link through cmd's start would be cut at its first "&": links go to the handler of their scheme directly.
  else if (platform === "win32") [cmd, args] = /^[a-z][a-z0-9+.-]*:\/\//i.test(target) ? ["rundll32.exe", ["url.dll,FileProtocolHandler", target]] : [env.ComSpec ?? "cmd.exe", ["/d", "/c", "start", '""', target]];
  else {
    if (!env.DISPLAY && !env.WAYLAND_DISPLAY) return false;
    [cmd, args] = ["xdg-open", [target]];
  }
  try {
    const child = spawn(cmd, args, { detached: true, stdio: "ignore", windowsHide: true, env: env as NodeJS.ProcessEnv });
    child.on("error", () => undefined);
    child.unref();
    return true;
  } catch {
    return false;
  }
}
