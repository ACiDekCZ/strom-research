// What a paired phone's page asks of the phone's server (strom phone), each under /phone/ — the server checked the
// phone's key and the address first:
//
//   GET  /phone/state?tree=        the trees it may send to ({id, name, archive, working, waiting}: never a path), heic
//                                  (this computer converts HEIC: else the page asks the phone for JPEG), max (the largest
//                                  file, MB); of the tree asked, what it shows (phone-watch.ts): now, lastWorked, waiting,
//                                  day, latest (a tree asked that is gone: 404 phone.tree-gone, as /phone/log)
//   GET  /phone/log?tree=&limit=   the last changes the research saved, newest first ({changes: [{id, at, lines, more?}],
//                                  more}), at most 20
//   GET  /phone/people?tree=&q=    up to 8 people of the tree matching q (2 letters at least; case, accents and NFD
//                                  aside): {id, name, birth, death, place}
//   GET  /phone/media/<sha256>?tree=   is that content in the research already ({known: false} or {known, kind})
//   PUT  /phone/media/<sha256>?tree=&batch=   a photo (X-Strom-Name: its file name, URI-encoded), received as the
//                                  bridge receives one (receive.ts) into the batch — or the one that took over from it
//                                  (`batch` in the answer when it is another)
//   POST /phone/batch/<id>/done?tree=  {note, person}: the batch handed over to the research, with the one(s) that took
//                                  over from it ({empty: true} when no photo of it was new)
//
// A phone's batch nobody handed over is closed an hour after its last photo by this server too (a bridge may not run),
// and the parts of uploads cut short are cleared from the shared store.

import http from "node:http";
import crypto from "node:crypto";
import type { ChildProcess } from "node:child_process";
import type { Env } from "./paths.ts";
import { Settings } from "./config.ts";
import { knownTreesIn, Tree, type KnownTree } from "./tree.ts";
import { actsAsArchive } from "./state.ts";
import { BATCH_ID, idleBatches, phoneBatch, readBatch } from "./batches.ts";
import { cleanIncoming, knownOriginal, originalMax } from "./originals.ts";
import { closeBatchBy, receiveOriginal, refusal, replyJson, type Receiver } from "./receive.ts";
import { waysHere } from "./readable.ts";
import { birthEvent, deathEvent, displayName, findPersons } from "./people.ts";
import { yearLabel } from "./gdate.ts";
import { foldText } from "./text.ts";
import { LOG_PHONE, treeLog, treeMarks, treeOverview } from "./phone-watch.ts";
import type { Person } from "./model.ts";

/** How often the batches of a phone are looked at, and the parts of uploads cut short. */
const INCOMING_EVERY_MS = 60 * 60_000;

export interface PhoneSend {
  /** Answer a request under /phone/ (the phone's key checked); false: not one of these. */
  handle(req: http.IncomingMessage, res: http.ServerResponse, url: URL, host: string): boolean;
  /** Called every second or so: closes idle batches, clears cut uploads. */
  tick(): void;
  /** A strom it started still writes (the server is not started again under it). */
  busy(): boolean;
}

export function phoneSend(env: Env, note: (text: string) => void): PhoneSend {
  const kids = new Set<ChildProcess>();
  const track = (child: ChildProcess) => {
    kids.add(child);
    child.once("exit", () => kids.delete(child));
  };
  const receivers = new Map<string, Receiver>();
  const receiver = (t: KnownTree): Receiver => {
    let r = receivers.get(t.root);
    if (!r) {
      r = {
        root: t.root,
        env,
        note: (text) => note(`${t.name}: ${text}`),
        track,
        safely: (_req, res, fn) => {
          try {
            fn();
          } catch (e) {
            note(`${t.name}: ${e instanceof Error ? e.message : String(e)}`);
            replyJson(res, 500, refusal("the photo was not taken", "media.failed"));
          }
        },
      };
      receivers.set(t.root, r);
    }
    return r;
  };
  const trees = (): KnownTree[] => {
    const settings = new Settings(env, {});
    return knownTreesIn(settings.trees()?.value, settings.config.extraTrees ?? []);
  };
  let heic: boolean | undefined;

  /** The answer of one request under /phone/, or undefined when it is none of them. */
  const routeOf = (req: http.IncomingMessage, res: http.ServerResponse, url: URL, host: string): (() => void) | undefined => {
    const p = url.pathname;
    const reply = (code: number, body: Record<string, unknown>) => replyJson(res, code, body);
    const refuse = (code: number, body: Record<string, unknown>) => {
      reply(code, body);
      req.resume();
    };
    // a tree by the id the page has (a tree gone: the page says so and keeps its photos)
    const treeOf = (): KnownTree | undefined => {
      const id = url.searchParams.get("tree") ?? "";
      return id ? trees().find((t) => t.id === id) : undefined;
    };
    const gone = () => refuse(404, refusal("no such research on this computer", "phone.tree-gone"));
    // its own page alone asks and sends (another page of the network neither reads nor sends to the research)
    const foreign = () => req.headers.origin !== undefined && req.headers.origin !== `http://${host}`;

    if (req.method === "GET" && p === "/phone/state")
      return () => {
        if (foreign()) return refuse(403, refusal("only the phone's page asks", "phone.origin"));
        req.resume();
        heic ??= !!waysHere(env).heic;
        const shown = url.searchParams.get("tree") ?? "";
        const known = trees();
        // a tree asked that is gone: as /phone/log answers it (the page asks again for the list alone)
        if (shown && !known.some((t) => t.id === shown)) return gone();
        let overview: Record<string, unknown> | undefined;
        const list = known.flatMap((t) => {
          try {
            const tree = Tree.open(t.root, env);
            const archive = actsAsArchive(tree);
            let marks = { working: false, waiting: 0 };
            // what it shows: a failure of it leaves the tree in the list (the page shows no more of it)
            try {
              if (t.id === shown) overview = { ...treeOverview(t.root, env) };
              marks = treeMarks(t.root, env, tree);
            } catch (e) {
              note(`${t.name}: ${e instanceof Error ? e.message : String(e)}`);
            }
            return [{ id: t.id, name: t.name, archive, ...marks }];
          } catch {
            return [];
          }
        });
        reply(200, { trees: list, heic, max: Math.floor(originalMax(env) / 1024 / 1024), ...(overview ? { shown: overview } : {}) });
      };

    if (req.method === "GET" && p === "/phone/log")
      return () => {
        if (foreign()) return refuse(403, refusal("only the phone's page asks", "phone.origin"));
        req.resume();
        const t = treeOf();
        if (!t) return gone();
        const limit = Math.min(LOG_PHONE, Math.max(1, Number.parseInt(url.searchParams.get("limit") ?? "", 10) || LOG_PHONE));
        reply(200, treeLog(t.root, env, limit));
      };

    if (req.method === "GET" && p === "/phone/people")
      return () => {
        if (foreign()) return refuse(403, refusal("only the phone's page asks", "phone.origin"));
        req.resume();
        const t = treeOf();
        if (!t) return gone();
        const q = (url.searchParams.get("q") ?? "").slice(0, 100);
        if (foldText(q).replace(/[^\p{L}\p{M}\p{N}]/gu, "").length < 2) return reply(200, { people: [] });
        const place = (p: Person) => (birthEvent(p)?.place ?? deathEvent(p)?.place)?.split(",")[0]?.trim();
        const people = findPersons(Tree.open(t.root, env), q)
          .filter((p) => !p.mergedInto)
          .slice(0, 8)
          .map((p) => {
            const b = birthEvent(p)?.date;
            const d = deathEvent(p)?.date;
            const at = place(p);
            return { id: p.id, name: displayName(p), ...(b ? { birth: yearLabel(b) } : {}), ...(d ? { death: yearLabel(d) } : {}), ...(at ? { place: at } : {}) };
          });
        reply(200, { people });
      };

    const media = /^\/phone\/media\/([^/]+)$/.exec(p);
    if (media && (req.method === "GET" || req.method === "PUT"))
      return () => {
        const sha = media[1]!.toLowerCase();
        if (!/^[0-9a-f]{64}$/.test(sha)) return refuse(400, refusal("the address names no SHA-256", "media.bad-sha"));
        const t = treeOf();
        if (!t) return gone();
        if (foreign()) return refuse(403, refusal(req.method === "GET" ? "only the phone's page asks" : "only the phone's page sends", "phone.origin"));
        if (req.method === "GET") {
          req.resume();
          const known = knownOriginal(Tree.open(t.root, env), new Settings(env, {}).shared()?.value, sha);
          return reply(200, known ? { known: true, kind: known.kind, id: known.id } : { known: false });
        }
        const asked = url.searchParams.get("batch") ?? "";
        if (!BATCH_ID.test(asked)) return refuse(400, refusal("the batch's mark (letters, digits, -)", "media.bad-header", { header: "batch" }));
        let name: string;
        try {
          const raw = req.headers["x-strom-name"];
          // no control characters (a NUL would never reach a program's argument): as the note
          name = decodeURIComponent(typeof raw === "string" ? raw : "").replace(/\p{Cc}/gu, "").normalize("NFC").slice(0, 200) || sha.slice(0, 12);
        } catch {
          return refuse(400, refusal("X-Strom-Name: the file's name, URI-encoded", "media.bad-header", { header: "X-Strom-Name" }));
        }
        // the batch closed meanwhile (an hour without a photo, handed over): the one that took over from it
        const batch = phoneBatch(t.root, asked, () => crypto.randomUUID());
        receiveOriginal(receiver(t), req, res, { sha, name, persons: [], batch, phone: true });
      };

    const done = /^\/phone\/batch\/([^/]+)\/done$/.exec(p);
    if (done && req.method === "POST")
      return () => {
        if (foreign()) return refuse(403, refusal("only the phone's page hands a batch over", "phone.origin"));
        const id = done[1]!;
        if (!BATCH_ID.test(id)) return refuse(404, refusal("no such batch", "batch.none", { batch: id.slice(0, 64) }));
        const t = treeOf();
        if (!t) return gone();
        let body = "";
        req.setEncoding("utf8");
        req.on("data", (d: string) => {
          if (body.length < 8192) body += d;
        });
        req.on("error", () => {});
        req.on("end", () => {
          let said: { note?: unknown; person?: unknown } = {};
          try {
            said = body.trim() ? ((JSON.parse(body) as typeof said) ?? {}) : {};
          } catch {
            return reply(400, refusal("the body: JSON {note, person}", "batch.bad-body"));
          }
          const person = typeof said.person === "string" ? said.person.trim().toUpperCase() : "";
          const text = typeof said.note === "string" ? said.note.normalize("NFC").replace(/[\p{Cc}]/gu, " ").trim().slice(0, 500) : "";
          const extra = [...(/^P\d{1,9}$/.test(person) ? ["--person", person] : []), ...(text ? [`--note=${text}`] : [])];
          // the batch and those that took over from it, in their order
          const chain: string[] = [];
          for (let at: string | undefined = id; at && chain.length < 100 && !chain.includes(at); ) {
            const b = readBatch(t.root, at);
            if (!b) break;
            chain.push(at);
            at = b.next;
          }
          // no photo of it was new (each in the research already): nothing to hand over
          if (!chain.length) return reply(200, { empty: true, batch: id });
          const tasks: string[] = [];
          const next = (k: number): void => {
            if (k >= chain.length) return reply(200, { batch: id, batches: chain, tasks });
            closeBatchBy(receiver(t), chain[k]!, extra, (code, answer) => {
              if (code !== 200) return reply(code, answer);
              if (Array.isArray(answer.tasks)) tasks.push(...answer.tasks.map(String));
              next(k + 1);
            });
          };
          next(0);
        });
      };
    return undefined;
  };

  const handle = (req: http.IncomingMessage, res: http.ServerResponse, url: URL, host: string): boolean => {
    const route = routeOf(req, res, url, host);
    if (!route) return false;
    try {
      route();
    } catch (e) {
      note(`${url.pathname}: ${e instanceof Error ? e.message : String(e)}`);
      replyJson(res, 500, refusal("not answered now", "phone.failed"));
      req.resume();
    }
    return true;
  };

  let batchesChecked = 0;
  let incomingCleaned = 0;
  const tick = () => {
    const now = Date.now();
    if (now - batchesChecked > Number(env.STROM_BATCH_CHECK_MS ?? 60_000)) {
      batchesChecked = now;
      for (const t of trees()) {
        let idle: string[] = [];
        try {
          idle = idleBatches(t.root, now, env).filter((id) => readBatch(t.root, id)?.from === "phone");
        } catch (e) {
          note(`${t.name}: the batches could not be looked at: ${e instanceof Error ? e.message : String(e)}`);
        }
        for (const id of idle) closeBatchBy(receiver(t), id, ["--idle"], (code) => note(`${t.name}: the batch ${id} ${code === 200 ? "closed: no photo came for an hour" : `not closed now (${code})`}`));
      }
    }
    if (now - incomingCleaned > INCOMING_EVERY_MS) {
      incomingCleaned = now;
      const shared = new Settings(env, {}).shared()?.value;
      try {
        const gone = shared ? cleanIncoming(shared, now) : 0;
        if (gone) note(`${gone} part(s) of uploads cut short cleared`);
      } catch (e) {
        note(`the parts of uploads cut short not cleared: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  };

  return { handle, tick, busy: () => kids.size > 0 };
}
