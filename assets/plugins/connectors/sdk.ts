// The strom connector SDK (interface 1) — the conversation with strom over
// stdin/stdout, in JSON lines. A connector never touches the network itself:
// get() and post() ask strom, which paces the request, checks the host against
// connector.json, keeps the cookies of the run and — with `save` — writes the
// file into the work folder. The user's login goes in as login("password"):
// strom puts in the value, the connector never sees it. The contract is
// ../README.md. Needs nothing but Node.

import readline from "node:readline";

/** Where a part is in the whole image, in fractions of it (0–1) from its top left corner. */
export interface Region {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** `login`: the user saved a login for this connector (strom login <name>). */
export type Request = { interface: 1; login?: boolean } & (
  | { cmd: "find"; place: string; years?: string }
  | { cmd: "list"; book: string }
  | { cmd: "fetch"; book: string; images: number[] }
  | { cmd: "part"; book: string; image: number; region: Region }
  | { cmd: "locate"; book: string; images: number[]; region?: Region }
);

/** A field of the user's login ("user", "password" … of connector.json → login.fields): strom puts in its value. */
export interface LoginValue {
  login: string;
}

/** The user's login in a form field or a header: post(url, { pass: login("password") }). */
export function login(field: string): LoginValue {
  return { login: field };
}

export interface Got {
  status: number;
  /** The body, when not saved (text, HTML, JSON). */
  text?: string;
  /** Where strom saved it, with `save`. */
  file?: string;
  type?: string;
  bytes?: number;
  /** An image saved: its size from its header (JPEG, PNG) — a thumbnail or a placeholder shows here before you give it as the image. */
  width?: number;
  height?: number;
  /** The answer's headers, in lowercase. */
  headers?: Record<string, string>;
  /** The final URL, after redirects. */
  url?: string;
}

export interface HttpOptions {
  /** Request headers: Referer, Accept, X-Requested-With … (strom sets User-Agent); a value may be login("key"). */
  headers?: Record<string, string | LoginValue>;
  /** A file name in the work folder: strom writes the body there (images, big files). */
  save?: string;
}

/** strom would not ask, or got no answer: a refusal, the hourly cap, a host not in connector.json … The run is over. */
export class Refused extends Error {
  readonly reason: string;
  constructor(reason: string, message: string) {
    super(message);
    this.reason = reason;
  }
}

const lines = readline.createInterface({ input: process.stdin });
const waiting = new Map<number, (answer: Record<string, unknown>) => void>();
let first: ((r: Request) => void) | undefined;
const firstLine = new Promise<Request>((resolve) => (first = resolve));
let nextId = 1;

lines.on("line", (line) => {
  if (!line.trim()) return;
  const msg = JSON.parse(line) as Record<string, unknown>;
  if (first) {
    const f = first;
    first = undefined;
    return f(msg as unknown as Request);
  }
  const done = waiting.get(msg.id as number);
  if (done) {
    waiting.delete(msg.id as number);
    done(msg);
  }
});

function send(o: unknown): void {
  process.stdout.write(JSON.stringify(o) + "\n");
}

/** What strom asks for: find books, list a book, fetch its images or a part of one, or say where they are. */
export function request(): Promise<Request> {
  return firstLine;
}

/** Any request through strom: GET (default), POST or HEAD; a form is sent with POST. */
export function http(url: string, opts: HttpOptions & { method?: "GET" | "POST" | "HEAD"; body?: string; form?: Record<string, string | LoginValue> } = {}): Promise<Got> {
  const id = nextId++;
  send({ id, http: { url, ...opts } });
  return new Promise((resolve, reject) =>
    waiting.set(id, (a) => (a.error ? reject(new Refused(String(a.error), String(a.message ?? a.error))) : resolve(a as unknown as Got))),
  );
}

/** GET a URL through strom. */
export function get(url: string, opts: HttpOptions = {}): Promise<Got> {
  return http(url, opts);
}

/** POST through strom: a form (an object, sent URL-encoded; a value may be login("password")) or a body of your own (set its Content-Type). */
export function post(url: string, body: Record<string, string | LoginValue> | string, opts: HttpOptions = {}): Promise<Got> {
  return typeof body === "string" ? http(url, { ...opts, method: "POST", body }) : http(url, { ...opts, method: "POST", form: body });
}

/** One image fetched — or a part of it (cmd part): its number in the book, the file saved with `save`, where it is on the portal. */
export function image(n: number, file: string, url: string, page?: string, region?: Region): void {
  send({ image: { n, file, url, ...(page ? { page } : {}), ...(region ? { region } : {}) } });
}

/** One tile of an image the portal gives in tiles only, saved with `save`: where its top left corner is, in pixels of the whole image. */
export interface Tile {
  file: string;
  x: number;
  y: number;
}

/**
 * An image the portal gives in tiles only (Zoomify, DeepZoom …): strom puts the
 * tiles together into `file` (a JPEG), width × height pixels, and checks it as
 * any image. For a part (cmd part), width × height is the part and `region`
 * where it is in the whole image. One request for the whole image is better
 * where the portal has one: tiles are many requests.
 */
export function imageFromTiles(n: number, file: string, tiles: Tile[], size: { width: number; height: number }, url: string, page?: string, region?: Region): void {
  send({ image: { n, file, tiles, width: size.width, height: size.height, url, ...(page ? { page } : {}), ...(region ? { region } : {}) } });
}

/** Where an image is (cmd locate), for the user's browser to fetch: its own address — one request gives it — and the page a person opens. */
export function located(n: number, src: string, url?: string, page?: string, region?: Region): void {
  send({ located: { n, src, ...(url ? { url } : {}), ...(page ? { page } : {}), ...(region ? { region } : {}) } });
}

/** One book found (find), or the book described (list). */
export function book(b: { id?: string; title: string; callNumber?: string; years?: string; kinds?: string[]; places?: string[]; url?: string; images?: number }): void {
  send({ book: b });
}

export function log(message: string): void {
  send({ log: message });
}

/** The end: strom closes the connector when it has answered everything. */
export function done(): void {
  send({ done: true });
  lines.close();
}

/** Something the connector cannot do (a book it does not know, a page it cannot read). */
export function fail(message: string): never {
  send({ error: message });
  lines.close();
  process.exit(1);
}
