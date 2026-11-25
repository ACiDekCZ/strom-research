/**
 * What a device of the home network may ask a tree's bridge through the gateway (POST /device/x): denied unless named
 * here. Reads, and what the person writes in the app on the computer (sends, materials, sources, what waits, facts,
 * history and places, lines and the queue, stopping runs) pass; what starts an agent, spends its sessions, changes the
 * research's settings or what only the computer decides is answered 403 device.computer-only {action} — and so is any
 * path this table does not know. The bridge checks every write again as it does for the app on the computer.
 *
 * A path is the bridge's own without its secret (`status`, `waiting/T0001`): nothing that climbs (`..`, `%2e`), no
 * doubled or leading slash, no address of its own (`http://…`), no backslash, query or fragment in it, no control
 * character, no encoded slash — and never the bridge's secret.
 */

export type Allowed = { ok: true; path: string } | { ok: false; action: string };

/** A word of a path as the bridge takes it (an id, a hash, a key): letters, digits and a few marks, percent-encoded allowed. */
const SEG = /^[\p{L}\p{M}\p{N}_.~:+@!$&'()*,;=%-]+$/u;
const SHA = /^[0-9a-f]{64}$/;

const deny = (action: string): Allowed => ({ ok: false, action });

/** The path checked as a path (before any route): its words, or the action refused. */
function words(p: string, secret: string | undefined): string[] | undefined {
  if (typeof p !== "string" || !p || p.length > 2048) return undefined;
  // nothing of an address, a query or a fragment, nothing a server reads as a way up or another place
  if (/[\u0000-\u001f\u007f\\?#\s]/u.test(p) || /^[a-z][a-z0-9+.-]*:/iu.test(p) || p.startsWith("/") || p.includes("//")) return undefined;
  if (/%(?:2e|2f|5c|00)/iu.test(p)) return undefined;
  const ws = p.split("/");
  if (ws.some((w) => !w || w === "." || w === ".." || !SEG.test(w))) return undefined;
  // the secret anywhere in it, as it is or percent-encoded (a bridge decodes what it reads)
  if (secret && (p.includes(secret) || decoded(p).includes(secret))) return undefined;
  return ws;
}

/** A path percent-decoded (a broken escape: as it is). */
function decoded(p: string): string {
  try {
    return decodeURIComponent(p);
  } catch {
    return p;
  }
}

type Body = Record<string, unknown> | undefined;

const asBody = (b: unknown): Body => (b && typeof b === "object" && !Array.isArray(b) ? (b as Record<string, unknown>) : undefined);

/**
 * May a device ask this? `m`: the method; `p`: the bridge's path without its secret; `b`: the JSON body (what some
 * routes are judged by: a batch closed to be sorted, what a wait is answered with); `secret`: the bridge's (never in a
 * path). The path passed on is the one checked.
 */
export function deviceAllows(m: string, p: string, b?: unknown, secret?: string): Allowed {
  const ws = words(p, secret);
  if (!ws) return deny("path");
  const [what, sub, act, rest] = ws as [string, string | undefined, string | undefined, string | undefined];
  const n = ws.length;
  const ok: Allowed = { ok: true, path: ws.join("/") };
  const body = asBody(b);
  if (m === "GET") return readAllowed(what, sub, act, rest, n) ? ok : deny(computerOnlyRead(what, sub) ?? what);
  if (m === "POST") return writeAllowed(what, sub, act, rest, n, body) ?? ok;
  if (m === "PUT") {
    // a list of the person's (Add materials: its order); files come by PUT /device/media of their own
    if (what === "lists" && sub && n === 2) return ok;
    return deny(what === "media" ? "media.put" : what);
  }
  return deny(`${m.toLowerCase()}.${what}`);
}

/** What a device may read (GET). */
function readAllowed(what: string, sub: string | undefined, act: string | undefined, rest: string | undefined, n: number): boolean {
  switch (what) {
    case "status":
      return n <= 2;
    case "tree.ged":
    case "images.ged":
    case "log":
    case "recent":
    case "whats-new":
    case "excerpts":
    case "reads":
    case "fixes":
    case "queue":
    case "places":
    case "quality":
    case "surnames":
      return n === 1;
    case "image":
    case "excerpt":
      return n === 2;
    case "media":
      return n === 2 && SHA.test(sub ?? "");
    case "material":
      // its list, what a material is used for; never the sorting (an agent's)
      return n === 1 || (n === 3 && sub !== "sort" && act === "uses");
    case "directions":
      return n === 2 && sub === "people";
    case "history":
      return n === 1 || (n === 2 && sub === "align");
    case "sources":
      return n === 2 && sub === "split";
    case "read":
      // a reading and the pages of its scan
      return n === 2 || (n === 4 && act === "page" && /^\d{1,5}\.jpg$/.test(rest ?? ""));
    case "waiting":
      return n === 3 && act === "fix";
    case "group":
      return n === 3 && act === "note";
    case "offline":
      return n === 2;
    default:
      return false;
  }
}

/** The action of a read only the computer has (its name in the refusal). */
function computerOnlyRead(what: string, sub: string | undefined): string | undefined {
  if (what === "material" && sub === "sort") return "material.sort";
  if (what === "sources" && sub === "read") return "sources.read";
  return undefined;
}

const WAIT_DO = new Set(["sent", "unsent", "answer", "retry"]);
const BRANCH_DO = new Set(["line", "keep", "never"]);

/** A POST a device may send: undefined when it passes, else the refusal. */
function writeAllowed(what: string, sub: string | undefined, act: string | undefined, rest: string | undefined, n: number, body: Body): Allowed | undefined {
  const only = (cond: boolean, action: string): Allowed | undefined => (cond ? undefined : deny(action));
  switch (what) {
    // what only reads, though asked by POST
    case "duplicates":
    case "images":
      return only(n === 1, what);
    case "media":
      return only(n === 2 && sub === "known", "media");
    // a send from the app, sent again, a send taken back before it is written
    case "sync":
      if (n === 1) return undefined;
      if (n === 3 && act === "again") return undefined;
      return deny(n === 3 && act === "undo" ? "sync.undo" : "sync");
    case "cancel":
      return only(n === 1, "cancel");
    case "batch":
      if (n !== 3 || act !== "done") return deny("batch");
      // closed to be sorted by the agent: the computer's
      return only(body?.sort !== true, "batch.sort");
    case "material":
      if (sub === "sort") return deny("material.sort");
      return only(n === 2 && (sub === "assign" || sub === "hide" || sub === "edit" || sub === "delete"), "material");
    case "source":
      return only(n === 2 && (sub === "retract" || sub === "restore"), "source");
    case "sources":
      if (sub === "read" || act === "read") return deny("sources.read");
      if (n === 2 && (sub === "confirm" || sub === "proposal" || sub === "split")) return undefined;
      return only(n === 3 && sub === "split" && act === "undo", "sources");
    case "waiting":
      if (n !== 2 || !sub) return deny("waiting");
      // a branch that grows (W-B-…) answered; a task's request marked sent, answered, returned to the agent
      if (/^W-B-/iu.test(sub)) return only(typeof body?.do === "string" && BRANCH_DO.has(body.do), "waiting.branch");
      return only(typeof body?.do === "string" && WAIT_DO.has(body.do), `waiting.${typeof body?.do === "string" && /^[a-z]{1,12}$/.test(body.do) ? body.do : "do"}`);
    case "group":
      return only(n === 2, "group");
    case "facts":
      return only(n === 2 && (sub === "confirm" || sub === "revert"), "facts");
    case "conflict":
      // kept as it is; deciding it (which value holds) is the computer's in this version
      return only(n === 2 && sub === "keep", "conflict.decide");
    case "history":
      if (n === 2 && (sub === "hide" || sub === "skip" || sub === "delete" || sub === "map" || sub === "first" || sub === "align")) return undefined;
      if (n === 3 && sub === "align" && act === "undo") return undefined;
      return deny(sub === "place" || sub === "kinds" ? `history.${sub}` : "history");
    case "quality":
      return only(n === 2 && sub === "dismiss", "quality");
    case "places":
      if (n === 2 && (sub === "answer" || sub === "undo")) return undefined;
      return deny(sub === "identify" || sub === "run" ? `places.${sub}` : "places");
    case "directions":
      // a new line, its preview: the computer's
      if (n === 1) return deny("directions.new");
      if (n === 2 && sub === "order") return undefined;
      if (sub && /^G\d{1,9}$/iu.test(sub)) {
        if (n === 2) return undefined;
        if (n === 3 && act === "state") return undefined;
        if (n === 4 && act === "gather" && rest === "undo") return undefined;
      }
      return deny(sub === "preview" ? "directions.preview" : "directions");
    case "queue":
      return only(n === 2, "queue");
    case "runs":
      return only(n === 2 && sub === "stop", "runs");
    case "verify":
      return only(n === 2 && sub === "stop", sub === "bulk" ? "verify.bulk" : "verify");
    case "settings":
      // only fewer runs at once: the bridge itself refuses more from any app (403 runs.raise, the person's terminal)
      if (n === 2 && sub === "runs") return undefined;
      return deny(sub === "sort" ? "settings.sort" : "settings");
    default:
      // read (again, cancel), hypotheses, stories, experiments, intake, sourceTask, live, offline, books, census,
      // adopt, transfer, phone, and anything not known
      return deny(what === "books" && sub === "aside" ? "books.aside" : what === "read" ? "read" : what);
  }
}
