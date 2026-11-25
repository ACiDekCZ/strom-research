// The device of the home network a write of the person's came from (spec 094): its gateway names it to the bridge
// (X-Strom-Device), the bridge — only while devices.mode is on and only for a device paired here (devices.ts
// clientOfDevice: the row's id and name, never what a request says of itself) — hands it to the strom it runs for that
// write as STROM_VIA_DEVICE / STROM_VIA_DEVICE_NAME, and that strom names the device on each operation it writes (`via`,
// beside `by`). Only for the person's write the Strom app asked for (STROM_FOR_APP), never an agent's.

import type { Env } from "./paths.ts";
import type { AppClient } from "./model.ts";
import { oneLineName } from "./text.ts";
import { isAgent } from "./which.ts";

/** A device's id as the gateway of the devices gives it (dv_ and 16 letters of base32). */
export const DEVICE_VIA_ID = /^dv_[a-z2-7]{16}$/;

/** The header the gateway names the device by in a request it carries to the bridge. */
export const DEVICE_HEADER = "x-strom-device";

/** A device named in a file strom wrote itself (a job of the queue of originals): its id and its name as one line. */
export function viaChecked(v: unknown): AppClient | undefined {
  if (!v || typeof v !== "object") return undefined;
  const { id, name } = v as { id?: unknown; name?: unknown };
  if (typeof id !== "string" || !DEVICE_VIA_ID.test(id)) return undefined;
  const n = typeof name === "string" ? oneLineName(name, 60) : "";
  return { id, ...(n ? { name: n } : {}) };
}

/**
 * The device of the home network the gateway runs this strom for (STROM_VIA_DEVICE, its name STROM_VIA_DEVICE_NAME):
 * its id and its name as one line (NFC, at most 60 characters) — none where the id is not a device's.
 */
export function viaDevice(env: Env): AppClient | undefined {
  return viaChecked({ id: env.STROM_VIA_DEVICE, name: env.STROM_VIA_DEVICE_NAME });
}

/** Whether this strom may name a device on what it writes: the person's write for the Strom app, never an agent's. */
export function viaTaken(env: Env): boolean {
  return env.STROM_FOR_APP === "1" && !isAgent(env);
}

/** The environment that names a device to a strom of the bridge's (nothing for none). */
export function viaEnv(via: AppClient | undefined): Record<string, string> {
  return via ? { STROM_VIA_DEVICE: via.id, ...(via.name ? { STROM_VIA_DEVICE_NAME: via.name } : {}) } : {};
}

/** The keys of viaEnv: the only ones a job of the warm writer may set beside the environment it was started with. */
export const VIA_KEYS = ["STROM_VIA_DEVICE", "STROM_VIA_DEVICE_NAME"] as const;
