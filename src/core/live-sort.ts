// The bridge's sorts of the family's material for the Strom app (V13, feature material.sort): POST /material/sort
// {ids, text} queues one as the person's (202 {id, state: "queued"}), GET /material/sort/<id> says how it is and, done,
// its proposals as the research is now, POST /material/sort/<id>/cancel stops it. The queue is sorted one at a time by
// a strom of its own (strom material sort <id>), detached from the bridge: a sort goes on through the bridge's restart.
// A sort counts against the app's readings (read.app): one reading for each ten files it begins.
// The bridge signs each sort it queues with the tree's seal key (sort.ts signSort) and knows only those as the app's: a
// record that says it is the app's without that signature (written outside the bridge, or queued by an older strom) is
// never started — failed (unsigned), said in live.log. Its leave to start it (signStart) is spent with its first step out of
// the queue: a sort that began, put back into the queue by hand, is never started again.

import fs from "node:fs";
import http from "node:http";
import { spawn } from "node:child_process";
import { newerTree, SEAL_FOREIGN, Tree } from "./tree.ts";
import { actsAsArchive } from "./state.ts";
import { forApp, refusal } from "./receive.ts";
import { stromLauncher } from "./self.ts";
import { StromError } from "./errors.ts";
import { alive } from "./document.ts";
import { appReadLimits, limitReached, noteAsked, readAccepts, type ReadBridge } from "./live-read.ts";
import { APP_SORT_FROM, appSort, cancelSort, checkSortAsk, listSorts, loadSort, queueSort, refuseUnsigned, saveSort, SORT_FINAL, SORT_QUEUE_MAX, sortCancelPath, sortCost, sortForApp, unstartableAppSort, unstartableSaid, type SortState } from "./sort.ts";

const BODY_MAX = 16 * 1024;
/** A sort the bridge started: when its strom has not said it at work by then, started again (at most START_TRIES). */
const START_WAIT_MS = 30_000;
const START_TRIES = 3;
/** A sort the bridge cannot start now: ask again in a minute. */
const RETRY = 60;

/** The readers' agents a sort cannot start without: none here, its CLI missing (as POST /read: nothing of an agent here). */
const NO_AGENT = new Set(["agent.none", "CLI_MISSING"]);

export class AppSorts {
  private readonly starting = new Map<string, { at: number; tries: number }>();
  private readonly b: ReadBridge;
  constructor(b: ReadBridge) {
    this.b = b;
  }

  /** The tree's seal key on this computer (none: the research is sealed on another, nothing of the app's is signed). */
  private key(): Buffer | undefined {
    try {
      return Tree.open(this.b.root, this.b.env).key;
    } catch {
      return undefined;
    }
  }

  /** The sorts said to be the app's (signed or not), and the key to tell them by (read only when there are some). */
  private saidApp(): { said: SortState[]; key: Buffer | undefined } {
    const said = listSorts(this.b.root).filter((s) => s.from === APP_SORT_FROM);
    return { said, key: said.length ? this.key() : undefined };
  }

  /** The app's sorts kept here: those its bridge signed. */
  private appSorts(): SortState[] {
    const { said, key } = this.saidApp();
    return said.filter((s) => appSort(key, s));
  }

  /** A sort of the app at work or queued (the bridge does not end idle meanwhile). */
  active(): boolean {
    return this.appSorts().some((s) => !SORT_FINAL.includes(s.state) && (s.state === "queued" || alive(s.pid)));
  }

  answer(req: http.IncomingMessage, res: http.ServerResponse, origin: string | undefined, what: string, sub: string | undefined, act: string | undefined, rest: string | undefined): boolean {
    if (what !== "material" || sub !== "sort") return false;
    if (req.method === "POST" && !act) this.post(req, res, origin);
    else if (req.method === "GET" && act && !rest) this.show(res, act);
    else if (req.method === "POST" && act && rest === "cancel") this.cancel(req, res, origin, act);
    else return false;
    return true;
  }

  private json(res: http.ServerResponse, code: number, body: unknown): void {
    if (res.headersSent) return;
    const retry = code === 429 || code === 503 ? (body as { retry?: number }).retry : undefined;
    res.writeHead(code, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...(retry ? { "Retry-After": String(retry) } : {}) }).end(JSON.stringify(body));
  }

  private none(id: string) {
    return refusal(`no sort ${id.slice(0, 40)} of the Strom app here`, "sort.none", { id: id.slice(0, 40) });
  }

  private show(res: http.ServerResponse, id: string): void {
    const s = loadSort(this.b.root, id);
    if (!s || !appSort(this.key(), s)) return this.json(res, 404, this.none(id));
    this.json(res, 200, sortForApp(Tree.open(this.b.root, this.b.env), s));
  }

  /** The body of a POST: a JSON object of at most BODY_MAX, else undefined (refused). */
  private body(req: http.IncomingMessage, then: (body: Record<string, unknown> | undefined) => void): void {
    let text = "";
    let over = false;
    req.on("data", (c: Buffer) => {
      if (text.length + c.length > BODY_MAX) over = true;
      else text += c.toString("utf8");
    });
    req.on("end", () => {
      if (over) return then(undefined);
      try {
        const parsed: unknown = text.trim() ? JSON.parse(text) : {};
        then(parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : undefined);
      } catch {
        then(undefined);
      }
    });
  }

  /** POST /material/sort {ids, text}: checked, refused or queued as the person's. */
  private post(req: http.IncomingMessage, res: http.ServerResponse, origin: string | undefined): void {
    if (!origin) {
      req.resume();
      return this.json(res, 403, refusal("only the Strom app may ask for a sort", "app.only"));
    }
    this.body(req, (body) =>
      this.b.safely(req, res, () => {
        const newer = newerTree(this.b.root, this.b.env);
        if (newer) return this.json(res, 423, { ...refusal(newer.message, "locked"), reasonCode: newer.code, ...(newer.params ? { reasonParams: newer.params } : {}) });
        const tree = Tree.open(this.b.root, this.b.env);
        // an archive, a research waiting for its agent, no agent here: nothing sorts it
        const accepts = actsAsArchive(tree) ? undefined : readAccepts(tree, this.b.settings(), this.b.env);
        if (!accepts || (!accepts.ready && NO_AGENT.has(String(accepts.why)))) return this.json(res, 404, refusal("this research sorts no material", "sort.none", accepts ? { why: String(accepts.why) } : {}));
        if (!accepts.ready) return this.json(res, 503, { ...refusal(`no reader can start now (${accepts.why})`, "sort.not-ready", { why: String(accepts.why) }), ...(accepts.resets ? { resets: accepts.resets } : {}), retry: RETRY });
        if (!body) return this.json(res, 400, refusal(`the body: a JSON object of at most ${BODY_MAX / 1024} KB`, "material.body"));
        let ask: { files: string[]; text: string };
        try {
          ask = checkSortAsk(tree, { ids: body.ids, text: body.text });
        } catch (e) {
          if (!(e instanceof StromError)) throw e;
          return this.json(res, e.code === "material.file" ? 404 : 400, refusal(e.message, e.code ?? "material.body", e.params ?? {}));
        }
        const waiting = this.appSorts().filter((s) => !SORT_FINAL.includes(s.state) && (s.state === "queued" || alive(s.pid))).length;
        if (waiting >= 1 + SORT_QUEUE_MAX) return this.json(res, 429, { ...refusal(`${SORT_QUEUE_MAX} sorts wait already beside the one at work`, "sort.queue", { most: String(SORT_QUEUE_MAX) }), retry: RETRY });
        const cost = sortCost(ask.files.length);
        const limits = appReadLimits(this.b.settings().readApp());
        const reached = limitReached(this.b.root, limits, cost - 1);
        if (reached) {
          const most = reached.per === "hour" ? limits.hour : limits.day;
          return this.json(res, 429, { ...refusal(`the Strom app asked ${most} readings ${reached.per === "hour" ? "this hour" : "today"} (read.app); a sort of ${ask.files.length} files counts as ${cost}`, "sort.limit", { per: reached.per, most: String(most), cost: String(cost) }), retry: reached.retry });
        }
        // signed with the tree's key, which no agent has: only a sort the bridge took is ever started as the app's
        const key = tree.key;
        if (!key) return this.json(res, 409, refusal("the research is sealed on another computer: nothing of the Strom app's is sorted until it is taken over here", SEAL_FOREIGN, { set: "strom seal adopt" }));
        const s = queueSort(tree, ask, { lang: tree.lang, from: APP_SORT_FROM, key });
        noteAsked(this.b.root, s.id, "sort", Date.now(), cost);
        this.b.note(`${s.id}: a sort of ${ask.files.length} files queued`);
        this.json(res, 202, { id: s.id, state: s.state });
        this.dispatch();
      }),
    );
  }

  /** POST /material/sort/<id>/cancel: a queued one cancelled at once, one at work stopped by its strom. */
  private cancel(req: http.IncomingMessage, res: http.ServerResponse, origin: string | undefined, id: string): void {
    req.resume();
    if (!origin) return this.json(res, 403, refusal("only the Strom app may cancel a sort", "app.only"));
    this.b.safely(req, res, () => {
      const s = loadSort(this.b.root, id);
      if (!s || !appSort(this.key(), s)) return this.json(res, 404, this.none(id));
      const out = cancelSort(this.b.root, s);
      if (out.state === "cancelled") this.starting.delete(id);
      this.json(res, 200, { id, state: out.state, cancelled: out.state === "cancelled" || out.state === "working" });
    });
  }

  /** Each tick of the bridge: no sort of the app at work, the oldest queued one started. */
  tick(): void {
    this.dispatch();
  }

  private dispatch(): void {
    const { said, key } = this.saidApp();
    // said to be the app's without this bridge's signature (written outside it, or queued by an older strom): never
    // started, nothing read — failed, and said. No key read now (sealed on another computer, the tree not read): none
    // is told apart, none started
    if (!said.length) this.starting.clear();
    if (!key) return;
    for (const s of said)
      if (unstartableAppSort(key, s)) {
        const said = unstartableSaid(key, s);
        refuseUnsigned(this.b.root, s, said);
        this.starting.delete(s.id);
        this.b.note(
          appSort(key, s)
            ? `${s.id}: the Strom app's sort begun once already, put back into the queue outside its bridge: not sorted again, failed — asked again in the Strom app`
            : `${s.id}: said to be the Strom app's but not signed by its bridge (written outside it, or queued by an older strom): not sorted, failed — asked again in the Strom app`,
        );
      }
    const app = said.filter((s) => appSort(key, s));
    const now = Date.now();
    for (const id of this.starting.keys()) if (!app.some((s) => s.id === id && s.state === "queued")) this.starting.delete(id);
    // what a cancel left of a sort that ended before its strom began
    for (const s of app) if (SORT_FINAL.includes(s.state) && !alive(s.pid) && fs.existsSync(sortCancelPath(this.b.root, s.id))) fs.rmSync(sortCancelPath(this.b.root, s.id), { force: true });
    const atWork = app.some((s) => (s.state === "working" && alive(s.pid)) || (s.state === "queued" && this.startedLately(s.id, now)));
    if (atWork) return;
    const next = app.filter((s) => s.state === "queued").sort((a, b) => a.at.localeCompare(b.at) || a.id.localeCompare(b.id))[0];
    if (next) this.start(next, now);
  }

  private startedLately(id: string, now: number): boolean {
    const st = this.starting.get(id);
    return !!st && now - st.at < START_WAIT_MS;
  }

  private start(s: SortState, now: number): void {
    const tries = (this.starting.get(s.id)?.tries ?? 0) + 1;
    if (tries > START_TRIES) {
      saveSort(this.b.root, { ...s, state: "failed", since: new Date().toISOString(), reason: "start", error: "its readers could not start" });
      this.starting.delete(s.id);
      this.b.note(`${s.id}: its readers did not start (${START_TRIES} tries): failed`);
      return;
    }
    this.starting.set(s.id, { at: now, tries });
    const { command, args } = stromLauncher();
    const child = spawn(command, [...args, "material", "sort", s.id, "--json"], { cwd: this.b.root, env: forApp(this.b.env, this.b.root), stdio: "ignore", detached: true, windowsHide: true });
    child.on("error", (e) => this.b.note(`${s.id}: its readers not started: ${e.message}`));
    child.unref();
    this.b.note(`${s.id}: sorted now${tries > 1 ? ` (try ${tries})` : ""}`);
  }
}
