// Makes the state of the gateway of the devices of the home network (spec 094) as a strom writes it, that every newer
// strom must go on with: a user's home and config with devices.mode on, a device paired (its key in devices.json), the
// icon of its home screen in its row (of), the phone's server's settings (phone.json), and a tree with an operation the
// device wrote (via) — packed as <version>.tar.gz beside this file. Run it with the code of the strom that writes it:
//
//   node test/fixtures/devices/make-devices.ts src/cli.ts
//
// The commands run as strom's own (that release's src/cli.ts); what only the person turns on in their terminal, or a
// device does over the network (devices.mode on, a pairing, an icon), by that release's own functions, in-process.
// test/cli/devices-compat.test.ts opens each of them with the strom of today. No family data: Lhoták, Lhota.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const cli = path.resolve(process.argv[2] ?? "");
if (!fs.existsSync(cli) || !cli.endsWith(".ts")) throw new Error("give the release's src/cli.ts");
const src = path.dirname(cli);
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "strom-devices-"));
const home = path.join(dir, "home");
fs.mkdirSync(home);
const gitconfig = path.join(dir, "gitconfig");
fs.writeFileSync(gitconfig, "");
const env: Record<string, string> = {
  HOME: home,
  USERPROFILE: home,
  STROM_CONFIG_DIR: path.join(dir, "config"),
  LANG: "cs_CZ.UTF-8",
  PATH: process.env.PATH ?? "",
  GIT_CONFIG_GLOBAL: gitconfig,
  GIT_CONFIG_NOSYSTEM: "1",
  STROM_NO_DIALOG: "1",
  STROM_NO_OPEN: "1",
  STROM_NO_INSTALL: "1",
  STROM_UPDATES: "off",
  STROM_APP_DIRS: "",
};
let cwd = dir;
const strom = (args: string[], more: Record<string, string> = {}): string => {
  const r = spawnSync(process.execPath, [cli, ...args], { cwd, env: { ...env, ...more }, encoding: "utf8" });
  if (r.status !== 0) throw new Error(`strom ${args.join(" ")} → ${r.status}\n${r.stdout}\n${r.stderr}`);
  return r.stdout;
};
const version = strom(["--version"]).trim().split("\n")[0]!.replace(/^strom /, "");

strom(["setup", "--yes", "--lang", "cs"]);
strom(["init", "Lhotákovi"]);
cwd = path.join(home, "Documents", "Strom", "Lhotákovi");
strom(["person", "add", "Jan /Lhoták/", "--sex", "M"]);
strom(["event", "add", "P1", "BIRT", "--date", "1885", "--place", "Lhota"]);
for (const n of ["1", "2"]) {
  strom(["task", "add", `Opis křtu ${n}`, "--level", "request", "--where", "matrika Lhota", "--why", "rodiče", "--done-when", "odpověď", "--about", "P1", "--anyway"]);
  strom(["task", "wait", `T${n}`, "--on", "Odpověď matriky.", "--kind", "letter", "--to", "Matriční úřad Lhota"]);
}

// devices.mode on (the person's, in their terminal); a device paired with the QR code, the icon of its home screen
type Devices = typeof import("../../../src/core/devices.ts");
type Config = typeof import("../../../src/core/config.ts");
const devices = (await import(path.join(src, "core", "devices.ts"))) as Devices;
const config = (await import(path.join(src, "core", "config.ts"))) as Config;
config.saveUserConfig(env, { ...config.loadUserConfig(env), devicesMode: "on" });
const address = "http://127.0.0.1:47851";
const pairWith = (pairId: string, secret: string, name: string) => {
  const key = devices.deviceKey(Buffer.from(secret, "base64url"), pairId);
  const paired = devices.pairDevice(env, { pairId, proof: devices.pairProof(key, pairId), name, kind: "phone", address });
  if (!paired.ok) throw new Error(`not paired: ${paired.error}`);
  return paired.device;
};
const qr = devices.devicePairCode(env, { mode: "app" });
const phone = pairWith(qr.pairId, qr.secret, "Telefon Lhotáků");
const code = devices.deviceCode(env, phone, "home");
const icon = pairWith(code.id, code.secret, "");
if (icon.of !== phone.id) throw new Error("the icon is not in the device's row");
// the phone's server off, at its port (as the bridge's phone settings keep it)
fs.writeFileSync(path.join(env.STROM_CONFIG_DIR!, "phone.json"), JSON.stringify({ on: false, port: 47851 }, null, 2) + "\n");

// what the device wrote: a request marked sent through the gateway's strom for the app, the device named
strom(["task", "sent", "T1"], { STROM_FOR_APP: "1", STROM_VIA_DEVICE: phone.id, STROM_VIA_DEVICE_NAME: phone.name });
strom(["check"]);

// Packed without the machine's extras (macOS resource forks) and without strom's commands for this computer
// (.strom/bin: its Node and its code by their paths here), the paths relative to the folder.
fs.rmSync(path.join(cwd, ".strom", "bin"), { recursive: true, force: true });
// nor the folder of this computer's strom it was made with (a path of the maker's computer)
const cfg = config.loadUserConfig(env) as Record<string, unknown>;
delete cfg.lastProgram;
config.saveUserConfig(env, cfg);
const out = path.join(import.meta.dirname, `${version}.tar.gz`);
const tar = spawnSync("tar", ["-czf", out, "home", "config"], { cwd: dir, env: { ...process.env, COPYFILE_DISABLE: "1" } });
if (tar.status !== 0) throw new Error(`tar: ${tar.stderr}`);
fs.rmSync(dir, { recursive: true, force: true });
console.log(`${out} (${fs.statSync(out).size} B)`);
