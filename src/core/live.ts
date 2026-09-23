// The live bridge: the Strom app follows a research while it goes on. strom
// runs a small web server on this computer only (127.0.0.1, a random port, a
// secret token in every address) that only reads: the app, opened with
// ?live=<address>, takes the tree's GEDCOM from it and hears what changes —
// who is at work on what, what was recorded, what waits for the user. Nothing
// leaves the computer. The bridge ends by itself when nobody has asked it
// anything for a while (LIVE_IDLE_MS), or with strom live stop.
//
//   GET <token>/status     the tree, its researches, who is at work, what waits
//   GET <token>/tree.ged   the tree for the Strom app, as it is now
//   GET <token>/events     server-sent events: hello, change, working
//
// Only pages of the Strom app may read it (CORS: https://stromapp.info, and a
// local copy on localhost for its development), and a browser asks first
// whether a public page may talk to this computer (Private Network Access).

import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import crypto from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import type { Env } from "./paths.ts";
import { Tree, VERSION } from "./tree.ts";
import { exportGedcom } from "../gedcom/export.ts";
import { liveWorkers } from "./workers.ts";
import { openSessions } from "./session.ts";
import { gitProgram } from "./git.ts";
import { stromLauncher } from "./self.ts";
import type { Research, Task } from "./model.ts";

export interface LiveInfo {
  port: number;
  token: string;
  pid: number;
  /** The address the app is given (?live=…). */
  url: string;
  started: string;
}

/** Where a running bridge of a tree is noted. */
export function liveFile(root: string): string {
  return path.join(root, ".strom", "live.json");
}

function alive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return (e as NodeJS.ErrnoException).code === "EPERM";
  }
}

/** The bridge of this tree when it runs. */
export function liveRunning(root: string): LiveInfo | undefined {
  try {
    const info = JSON.parse(fs.readFileSync(liveFile(root), "utf8")) as LiveInfo;
    if (info.pid && alive(info.pid)) return info;
  } catch {
    // none
  }
  return undefined;
}

function sleep(ms: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

/** Start the bridge of a tree in the background (or find it running); undefined when it did not come up. */
export function startLive(root: string, env: Env): LiveInfo | undefined {
  const running = liveRunning(root);
  if (running) return running;
  fs.rmSync(liveFile(root), { force: true });
  const { command, args } = stromLauncher();
  const child = spawn(command, [...args, "live", "serve"], {
    cwd: root,
    env: { ...(env as NodeJS.ProcessEnv), STROM_TREE: root },
    detached: true,
    stdio: "ignore",
    windowsHide: true,
  });
  child.unref();
  for (let i = 0; i < 100; i++) {
    const info = liveRunning(root);
    if (info) return info;
    sleep(50);
  }
  return undefined;
}

/** Stop the bridge of a tree; false when none ran. */
export function stopLive(root: string): boolean {
  const info = liveRunning(root);
  if (!info) return false;
  try {
    process.kill(info.pid);
  } catch {
    // already gone
  }
  fs.rmSync(liveFile(root), { force: true });
  return true;
}

/** The pages that may read the bridge: the Strom app, and a local copy of it for its development. */
function allowedOrigin(origin: string | undefined): string | undefined {
  if (!origin) return undefined;
  if (origin === "https://stromapp.info") return origin;
  return /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin) ? origin : undefined;
}

function head(root: string): string {
  const r = spawnSync(gitProgram() ?? "git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8", windowsHide: true });
  return r.status === 0 ? r.stdout.trim() : "";
}

function subjects(root: string, from: string, to: string): string[] {
  const r = spawnSync(gitProgram() ?? "git", ["log", "--format=%s", from ? `${from}..${to}` : "-1", to], { cwd: root, encoding: "utf8", windowsHide: true });
  return r.status === 0 ? r.stdout.trim().split("\n").filter(Boolean).reverse() : [];
}

/** Who is at work now, on which task (an agent strom started, and its open session). */
function working(root: string, tree: Tree): { who: string; since: string; session?: string; task?: string }[] {
  const open = openSessions(tree);
  return liveWorkers(root).map((w) => {
    const s = open.find((x) => x.worker === w.id);
    const task = s?.task ? tree.get<Task>(s.task) : undefined;
    return { who: w.label, since: w.since, ...(s ? { session: s.id, ...(s.task ? { task: task ? `${task.id} ${task.what}` : s.task } : {}) } : {}) };
  });
}

/** What the app shows beside the tree. */
function status(root: string, env: Env): Record<string, unknown> {
  const tree = Tree.open(root, env);
  const waiting = tree.list<Task>("task").filter((t) => t.state === "waiting");
  return {
    strom: VERSION,
    tree: { id: tree.config.id, name: tree.config.name, lang: tree.lang },
    head: head(root),
    persons: tree.count("person"),
    families: tree.count("family"),
    researches: tree.list<Research>("research").map((r) => ({ id: r.id, name: r.name, state: r.state })),
    working: working(root, tree),
    open: openSessions(tree).map((s) => ({ id: s.id, task: s.task, started: s.started })),
    waiting: waiting.map((t) => ({ id: t.id, what: t.what, on: t.waitingOn ?? "" })),
  };
}

/** Run the bridge of the tree here, until idle or stopped. */
export function serveLive(root: string, env: Env): Promise<void> {
  const token = crypto.randomBytes(16).toString("hex");
  const idleMs = Number(env.STROM_LIVE_IDLE_MS ?? 2 * 60 * 60_000);
  const pollMs = Number(env.STROM_LIVE_POLL_MS ?? 2000);
  const streams = new Set<http.ServerResponse>();
  let last = Date.now();
  let ged: { head: string; text: string } | undefined;

  const server = http.createServer((req, res) => {
    last = Date.now();
    const origin = allowedOrigin(req.headers.origin);
    if (origin) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Vary", "Origin");
    }
    if (req.method === "OPTIONS") {
      if (origin) {
        res.setHeader("Access-Control-Allow-Methods", "GET");
        res.setHeader("Access-Control-Allow-Headers", String(req.headers["access-control-request-headers"] ?? ""));
        if (req.headers["access-control-request-private-network"]) res.setHeader("Access-Control-Allow-Private-Network", "true");
      }
      res.writeHead(origin ? 204 : 403).end();
      return;
    }
    const [, t, what] = (req.url ?? "").split("?")[0]!.split("/");
    if (req.method !== "GET" || t !== token) {
      res.writeHead(404).end();
      return;
    }
    try {
      if (what === "status") {
        res.writeHead(200, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }).end(JSON.stringify(status(root, env)));
      } else if (what === "tree.ged") {
        const h = head(root);
        if (!ged || ged.head !== h) {
          const tree = Tree.open(root, env);
          ged = { head: h, text: exportGedcom(tree, { for: "strom" }).text };
        }
        res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", "X-Strom-Head": h }).end(ged.text);
      } else if (what === "events") {
        res.writeHead(200, { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-store", Connection: "keep-alive" });
        res.write(`event: hello\ndata: ${JSON.stringify(status(root, env))}\n\n`);
        streams.add(res);
        req.on("close", () => streams.delete(res));
      } else res.writeHead(404).end();
    } catch (e) {
      res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" }).end((e as Error).message);
    }
  });

  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const port = (server.address() as { port: number }).port;
      const info: LiveInfo = { port, token, pid: process.pid, url: `http://127.0.0.1:${port}/${token}`, started: new Date().toISOString() };
      fs.mkdirSync(path.dirname(liveFile(root)), { recursive: true });
      fs.writeFileSync(liveFile(root), JSON.stringify(info, null, 2));

      // What changed: strom commits every change, so a new commit is news.
      let seen = head(root);
      let workers = JSON.stringify(working(root, Tree.open(root, env)));
      const send = (event: string, data: unknown) => {
        for (const s of streams) s.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      };
      const timer = setInterval(() => {
        if (streams.size) last = Date.now();
        if (Date.now() - last > idleMs) return stop();
        if (!streams.size) return;
        const h = head(root);
        if (h && h !== seen) {
          send("change", { head: h, what: subjects(root, seen, h), at: new Date().toISOString() });
          seen = h;
        }
        const now = working(root, Tree.open(root, env));
        const w = JSON.stringify(now);
        if (w !== workers) {
          workers = w;
          send("working", now);
        }
      }, pollMs);
      const keepAlive = setInterval(() => {
        for (const s of streams) s.write(": still here\n\n");
      }, 20_000);
      const stop = () => {
        clearInterval(timer);
        clearInterval(keepAlive);
        for (const s of streams) s.end();
        server.close();
        try {
          const now = JSON.parse(fs.readFileSync(liveFile(root), "utf8")) as LiveInfo;
          if (now.pid === process.pid) fs.rmSync(liveFile(root), { force: true });
        } catch {
          // gone already
        }
        resolve();
      };
      process.once("SIGTERM", stop);
      process.once("SIGINT", stop);
    });
  });
}
