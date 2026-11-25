// The device of the home network on every write of the bridge a request of its gateway asks for (spec 094 U9c): the
// gateway names the device to the bridge (X-Strom-Device); while devices.mode is on and the device is paired here, each
// operation the write makes names it (via: the row's id and name, an icon's its device's) — a Čeká answer, a fact
// confirmed, a line paused, a file of a batch and its close, at once or queued (the job keeps it past the bridge's end).
// Nothing new without the header, with an id not paired, a header not an id, or devices.mode off; never on what an
// agent writes, a job's device whatever it says.

import { test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { World, hasGit } from "../helpers.ts";
import { listJobs } from "../../src/core/mediaqueue.ts";

const skip = !hasGit || process.platform === "win32";
const APP = { Origin: "https://beta.stromapp.info" };
const DEV = "dv_abcdefghijklmnop";
const ICON = "dv_qrstuvwxyz234567";
const OTHER = "dv_zzzzzzzzzzzzzzzz";
/** The device's name as the phone gave it: decomposed (NFD), in Latin and Cyrillic. */
const NAME = "Telefon Lhotáků · Лгота";
const ME = { id: DEV, name: NAME };
const jpg = fs.readFileSync(path.join(import.meta.dirname, "..", "fixtures", "images", "base420.jpg"));
const jpgNo = (n: number) => Buffer.concat([jpg, Buffer.from(`#${n}`)]);
const sha = (b: Buffer) => crypto.createHash("sha256").update(b).digest("hex");

type Answer = { status: number; text: string };
function request(method: string, url: string, body?: Buffer | string, headers: Record<string, string> = {}): Promise<Answer> {
  const data = typeof body === "string" ? Buffer.from(body, "utf8") : body;
  return new Promise((resolve, reject) => {
    const req = http.request(url, { method, agent: false, headers: { ...APP, ...(data ? { "Content-Length": String(data.length) } : {}), ...headers } }, (res) => {
      const parts: Buffer[] = [];
      res.on("data", (c: Buffer) => parts.push(c));
      res.on("end", () => resolve({ status: res.statusCode ?? 0, text: Buffer.concat(parts).toString("utf8") }));
    });
    req.on("error", reject);
    req.end(data);
  });
}

/** Jan Lhoták born in Lhota, a letter to the registry waiting, a line of his ancestors; devices.mode on, a phone paired and its icon. */
async function world(): Promise<{ w: World; birth: string }> {
  const w = new World();
  await w.withTree("Lhotákovi");
  await w.ok(["lang", "cs"]);
  await w.ok(["person", "add", "Jan /Lhoták/", "--sex", "M"]); // P1
  const birth = (await w.ok(["event", "add", "P1", "BIRT", "--date", "1885", "--place", "Lhota", "--json"])).json.event.id as string;
  for (const n of [1, 2, 3, 4]) {
    await w.ok(["task", "add", `Opis křtu ${n}`, "--level", "request", "--where", "matrika Lhota", "--why", "rodiče", "--done-when", "odpověď", "--about", "P1", "--anyway"]);
    await w.ok(["task", "wait", `T${n}`, "--on", "Odpověď matriky.", "--kind", "letter", "--to", "Matriční úřad Lhota"]);
  }
  await w.ok(["research", "new", "Předci Jana", "--person", "P1"]); // G0001
  await w.ok(["config", "set", "devices.mode", "on"], { tty: true });
  const at = "2026-11-20T10:00:00.000Z";
  const key = () => crypto.randomBytes(32).toString("base64url");
  const row = (id: string, name: string, more: Record<string, string> = {}) => ({ id, name, kind: "phone", via: "app", pairedAt: at, lastSeenAt: null, address: "", key: key(), ...more });
  fs.writeFileSync(path.join(w.env.STROM_CONFIG_DIR!, "devices.json"), JSON.stringify({ devices: [row(DEV, NAME.normalize("NFD")), row(ICON, "Ikona na ploše", { of: DEV })] }), { mode: 0o600 });
  return { w, birth };
}

/** Every operation written, in order. */
function ops(w: World): { op: string; via?: { id: string; name?: string } }[] {
  const out: { op: string; via?: { id: string; name?: string } }[] = [];
  const walk = (d: string) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const f = path.join(d, e.name);
      if (e.isDirectory()) walk(f);
      else if (e.name.endsWith(".jsonl")) out.push(...fs.readFileSync(f, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)));
    }
  };
  walk(path.join(w.treeDir("Lhotákovi"), "data", "ops"));
  return out;
}

/** The operations a write made: all of them name the device it expects (or none, none). */
async function wrote(w: World, what: string, via: { id: string; name?: string } | undefined, write: () => Promise<Answer>): Promise<void> {
  const before = ops(w).length;
  const r = await write();
  assert.ok(r.status >= 200 && r.status < 300, `${what}: ${r.status} ${r.text}`);
  const made = ops(w).slice(before);
  assert.ok(made.length > 0, `${what}: nothing written`);
  for (const o of made) assert.deepEqual(o.via, via, `${what}: ${o.op}`);
  assert.ok(!r.text.includes(DEV) && !r.text.includes("via"), `${what}: nothing new in the answer — ${r.text.slice(0, 200)}`);
}

test("a device's writes through the bridge name the device on each operation (an icon its device); nothing without the header, for another id, a header not an id, or devices.mode off; strom history --json says it", { skip, timeout: 240_000 }, async () => {
  const { w, birth } = await world();
  try {
    const info = (await w.ok(["live", "start", "--json"])).json as { url: string };
    const as = (id: string): Record<string, string> => ({ "X-Strom-Device": id });
    const json = { "Content-Type": "text/plain;charset=UTF-8" };

    // a Čeká answer, a fact confirmed, a line paused and resumed — named by the device, by its icon as by itself
    await wrote(w, "waiting sent", ME, () => request("POST", `${info.url}/waiting/T0001`, JSON.stringify({ do: "sent" }), { ...json, ...as(DEV) }));
    await wrote(w, "fact confirmed", ME, () => request("POST", `${info.url}/facts/confirm`, JSON.stringify({ fact: birth, confirm: true }), { ...json, ...as(DEV) }));
    await wrote(w, "line paused (the icon)", ME, () => request("POST", `${info.url}/directions/G0001/state`, JSON.stringify({ do: "pause", reason: "Matriky Лготы nejsou online".normalize("NFD") }), { ...json, ...as(ICON) }));

    // a file of a batch at once and its close
    const batch = "1c2d3e4f-5a6b-4c7d-8e9f-a0b1c2d3e4f5";
    const put = (b: Buffer, p: string, more: Record<string, string>) => request("PUT", `${info.url}/media/${sha(b)}`, b, { "X-Strom-Batch": batch, "X-Strom-Path": encodeURIComponent(p), "X-Strom-Name": encodeURIComponent(path.basename(p)), ...more });
    await wrote(w, "a file of a batch", ME, () => put(jpgNo(1), "Krabice/Лгота.jpg".normalize("NFD"), as(DEV)));
    // queued (Prefer: respond-async): the job keeps the device (its row's, whatever comes), written with the close
    const q = await put(jpgNo(2), "Krabice/02.jpg", { Prefer: "respond-async", ...as(ICON) });
    assert.equal(q.status, 202, q.text);
    const jobs = listJobs(w.treeDir("Lhotákovi")).filter((j) => j.job.batch === batch);
    assert.deepEqual(jobs.map((j) => j.job.via), [ME]);
    await wrote(w, "the batch closed", ME, () => request("POST", `${info.url}/batch/${batch}/done`, JSON.stringify({ name: "Krabice", files: 2 }), as(DEV)));

    // nothing new: no header, an id not paired, a header not an id, the name of a device for its id
    await wrote(w, "no header", undefined, () => request("POST", `${info.url}/waiting/T0002`, JSON.stringify({ do: "sent" }), json));
    await wrote(w, "an id not paired", undefined, () => request("POST", `${info.url}/waiting/T0003`, JSON.stringify({ do: "sent" }), { ...json, ...as(OTHER) }));
    await wrote(w, "a name for an id", undefined, () => request("POST", `${info.url}/waiting/T0003`, JSON.stringify({ do: "unsent" }), { ...json, ...as(encodeURIComponent(NAME)) }));
    await wrote(w, "a file of no batch, another id", undefined, () => request("PUT", `${info.url}/media/${sha(jpgNo(3))}`, jpgNo(3), { "X-Strom-Name": "03.jpg", ...as(OTHER) }));

    // devices.mode off: the device's header changes nothing
    await w.ok(["config", "set", "devices.mode", "off"]);
    await wrote(w, "off: waiting", undefined, () => request("POST", `${info.url}/waiting/T0004`, JSON.stringify({ do: "sent" }), { ...json, ...as(DEV) }));
    await wrote(w, "off: line resumed", undefined, () => request("POST", `${info.url}/directions/G0001/state`, JSON.stringify({ do: "resume" }), { ...json, ...as(DEV) }));

    // strom history --json: the device's commits, each by its row's name (NFC)
    const hist = (await w.ok(["history", "--json"])).json.commits as { via?: { id: string; name?: string } }[];
    assert.deepEqual(hist.filter((c) => c.via).map((c) => c.via), [ME, ME, ME, ME, ME]);
    await w.ok(["live", "stop"]);
  } finally {
    w.cleanup();
  }
});

test("a queued job's device outlives the bridge and names only the person's write for the app: never an agent's strom media queued, never a job's own words", { skip, timeout: 240_000 }, async () => {
  const { w } = await world();
  try {
    const root = w.treeDir("Lhotákovi");
    const info = (await w.ok(["live", "start", "--json"])).json as { url: string };
    const batch = "2c2d3e4f-5a6b-4c7d-8e9f-a0b1c2d3e4f5";
    for (const n of [11, 12, 13]) {
      const b = jpgNo(n);
      const r = await request("PUT", `${info.url}/media/${sha(b)}`, b, { Prefer: "respond-async", "X-Strom-Batch": batch, "X-Strom-Path": encodeURIComponent(`Lhota/${n}.jpg`), "X-Strom-Device": DEV });
      assert.equal(r.status, 202, r.text);
    }
    await w.ok(["live", "stop"]);
    assert.deepEqual(listJobs(root).filter((j) => j.job.batch === batch).map((j) => j.job.via), [ME, ME, ME], "kept past the bridge's end");
    const take = async (env: Record<string, string>) => {
      const before = ops(w).length;
      await w.ok(["media", "queued", "--batch", batch, "--max-files", "1"], { env });
      const made = ops(w).slice(before);
      assert.ok(made.length > 0);
      return made.map((o) => o.via);
    };

    // an agent taking the queue: no device on what it writes
    assert.deepEqual(await take({ STROM_FOR_APP: "1", CLAUDECODE: "1" }), [undefined]);
    // a job's device as its file says it: an id not a device's is none
    const next = listJobs(root)[0]!;
    fs.writeFileSync(next.at, JSON.stringify({ ...next.job, via: { id: "P0001", name: "Jan" } }));
    const forged = await take({ STROM_FOR_APP: "1" });
    assert.ok(forged.every((v) => v === undefined), JSON.stringify(forged));
    // the person's strom for the app (as the bridge runs it): the job's device
    const named = await take({ STROM_FOR_APP: "1" });
    assert.ok(named.every((v) => JSON.stringify(v) === JSON.stringify(ME)), JSON.stringify(named));
    assert.equal(listJobs(root).length, 0);
  } finally {
    w.cleanup();
  }
});
