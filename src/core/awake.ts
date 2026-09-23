// Keep the computer awake while agents work (the old workflow lost hours when
// a Mac fell asleep mid-session). Built-in OS tools only; ends with strom.

import { spawn, type ChildProcess } from "node:child_process";
import { which } from "./which.ts";
import type { Env } from "./paths.ts";

export function keepAwake(env: Env): () => void {
  let child: ChildProcess | undefined;
  try {
    if (process.platform === "darwin") child = spawn("caffeinate", ["-i", "-w", String(process.pid)], { stdio: "ignore" });
    else if (process.platform === "win32")
      child = spawn(
        "powershell",
        [
          "-NoProfile",
          "-Command",
          "$s='[DllImport(\"kernel32.dll\")] public static extern uint SetThreadExecutionState(uint f);';" +
            "$t=Add-Type -MemberDefinition $s -Name Awake -Namespace Strom -PassThru;" +
            "while($true){$t::SetThreadExecutionState(0x80000001)|Out-Null;Start-Sleep 50}",
        ],
        { stdio: "ignore", windowsHide: true },
      );
    else if (which("systemd-inhibit", env))
      child = spawn("systemd-inhibit", ["--what=idle:sleep", "--who=strom", "--why=research session", "sleep", "infinity"], { stdio: "ignore" });
  } catch {
    child = undefined;
  }
  child?.on("error", () => undefined);
  return () => {
    try {
      child?.kill();
    } catch {
      // already gone
    }
  };
}
