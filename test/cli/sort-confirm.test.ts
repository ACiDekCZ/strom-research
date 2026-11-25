// A sort of the material without the question about its paid readings (spec 102 U8): sort.confirm ask by default (the
// person's yes before every sort, as before); no — set by the person alone (an agent or a command without their
// terminal: exit 4, nothing changed; their own yes in the terminal) — sorts at once on the person's ask, said so
// (confirm "no"); a run nobody watches still asks. Back to ask is anyone's. The bridge: /status sort {confirm}, feature
// sort.confirm, POST /settings/sort {confirm: ask} written from anywhere; {confirm: no} (spec 123 P2, feature
// sort.confirm.app) only from the Strom app in a browser on this computer — a device of the home network or no browser's
// fetch: 403 sort.raise {reason}, nothing written; said in live.log. The same for run.confirm: POST /settings/run.

import { afterEach, test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { World, hasGit } from "../helpers.ts";

const made: World[] = [];
afterEach(() => {
  for (const w of made.splice(0)) w.cleanup();
});

const opts = { skip: !hasGit || process.platform === "win32", timeout: 240_000 };
const app = { Origin: "https://beta.stromapp.info" };

// the reader (the script runner): its report from a file, each start marked
const READER = `import fs from "node:fs";
const p = process.env.STROM_PROMPT ?? "";
const report = /Write your report to (.+) AS YOU GO/.exec(p)[1];
fs.appendFileSync(process.env.SORT_MARK, "start\\n");
const body = fs.readFileSync(process.env.SORT_BODY, "utf8");
fs.writeFileSync(report, fs.readFileSync(report, "utf8").replace("<!-- next file block -->", body.trim() + "\\n<!-- next file block -->"));
console.log("cost: 0.25");
`;

/** A page's fetch in a browser says so (Sec-Fetch-Mode: cors): the Strom app on this computer. */
const browser = { "Sec-Fetch-Mode": "cors", "Sec-Fetch-Site": "cross-site" };

function request(method: string, url: string, body?: unknown, headers: Record<string, string> = {}): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => {
    const data = body === undefined ? undefined : Buffer.from(JSON.stringify(body));
    const req = http.request(url, { agent: false, method, headers: { ...app, ...headers, ...(data ? { "Content-Type": "application/json", "Content-Length": String(data.length) } : {}) } }, (res) => {
      let text = "";
      res.setEncoding("utf8");
      res.on("data", (d) => (text += d));
      res.on("end", () => resolve({ status: res.statusCode ?? 0, body: JSON.parse(text) }));
    });
    req.on("error", reject);
    req.end(data);
  });
}

const treeJson = (w: World) => JSON.parse(fs.readFileSync(path.join(w.cwd, "strom.json"), "utf8"));
const userJson = (w: World) => JSON.parse(fs.readFileSync(path.join(w.env.STROM_CONFIG_DIR!, "config.json"), "utf8"));
const git = (w: World, ...args: string[]) => spawnSync("git", ["-C", w.cwd, ...args], { encoding: "utf8" }).stdout.trim();

/** Lhotákovi with the script's reader as the research's agent, one letter of the material (I…) and the reader's report for it. */
async function setUp(o: { archive?: boolean } = {}) {
  const w = new World();
  made.push(w);
  await w.withTree("Lhotákovi");
  await w.ok(["lang", "cs"]);
  await w.ok(["person", "add", "Václav /Lhoták/", "--sex", "M", "--born", "1890"]);
  const dir = path.join(w.dir, "třídění");
  fs.mkdirSync(dir);
  fs.writeFileSync(path.join(dir, "reader.mjs"), READER);
  Object.assign(w.env, {
    STROM_AGENT: "script",
    STROM_RUNNER_SCRIPT: path.join(dir, "reader.mjs"),
    SORT_BODY: path.join(dir, "body.md"),
    SORT_MARK: path.join(dir, "readers.log"),
    STROM_NO_CONVERT: "1",
    STROM_LIVE_POLL_MS: "150",
  });
  const box = path.join(w.dir, "krabice");
  fs.mkdirSync(box);
  // the name decomposed (NFD) and another script, as a person's files come
  const name = path.join(box, "dopis Лгота – Žofie.txt".normalize("NFD"));
  fs.writeFileSync(name, "Milá Evo, posílám fotky ze svatby.\n");
  const file = ((await w.ok(["intake", name, "--json"])).json as { inputs: { id: string }[] }).inputs[0]!.id;
  fs.writeFileSync(path.join(dir, "body.md"), `## File ${file}\ntitle: Dopis Evě\nlink: person P1\nwhy: Oslovení.\nsure: low\n`);
  if (o.archive) await w.ok(["mode", "archive"], { tty: true, answers: ["a"] });
  const starts = () => (fs.existsSync(path.join(dir, "readers.log")) ? fs.readFileSync(path.join(dir, "readers.log"), "utf8").trim().split("\n").filter(Boolean).length : 0);
  return { w, file, starts };
}

test("sort.confirm: ask by default; no only by the person in their terminal or the app's bridge (an agent, also in the app's environment: exit 4, nothing changed); ask and unset anyone's", opts, async () => {
  const { w } = await setUp();
  const get = async () => (await w.ok(["config", "get", "sort.confirm", "--json"])).json.value;
  assert.equal(await get(), "ask");
  assert.equal(treeJson(w)["sort.confirm"], undefined, "nothing written for it: a research of an older strom reads the same");

  // never an agent's, nor a command without the person's terminal
  for (const scope of [[], ["--for-tree"]]) {
    const agent = await w.run(["config", "set", "sort.confirm", "no", ...scope], { env: { CLAUDECODE: "1" } });
    assert.equal(agent.code, 4, agent.out + agent.err);
    assert.match(agent.err + agent.out, /an agent cannot answer this/u);
    assert.match(agent.err + agent.out, new RegExp(`strom config set sort\\.confirm no${scope.length ? " --for-tree" : ""}`, "u"));
    // an agent in the app's environment is still an agent
    assert.equal((await w.run(["config", "set", "sort.confirm", "no", ...scope], { env: { STROM_FOR_APP: "1", CLAUDECODE: "1" } })).code, 4);
    // an agent's terminal is no person's yes
    assert.equal((await w.run(["config", "set", "sort.confirm", "no", ...scope], { tty: true, answers: ["a"], env: { CLAUDECODE: "1" } })).code, 4);
  }
  assert.equal(treeJson(w)["sort.confirm"], undefined);
  assert.equal(userJson(w)["sort.confirm"], undefined);
  assert.equal(await get(), "ask");

  // the person: their own yes in the terminal — Enter is no
  const enter = await w.run(["config", "set", "sort.confirm", "no", "--for-tree"], { tty: true, answers: [""] });
  assert.match(enter.out, /Třídit soubory materiálu čtenáři výzkumu hned, jak se o to požádá, bez dotazu na placená čtení\?[\s\S]*Povolit\? \(a\/n\) \[n\][\s\S]*Nic se nezměnilo/u);
  assert.equal(treeJson(w)["sort.confirm"], undefined);
  await w.ok(["config", "set", "sort.confirm", "no", "--for-tree"], { tty: true, answers: ["a"] });
  assert.equal(treeJson(w)["sort.confirm"], "no");
  assert.equal(await get(), "no");
  // anything but ask|no refused
  assert.notEqual((await w.run(["config", "set", "sort.confirm", "yes", "--for-tree"], { tty: true, answers: ["a"] })).code, 0);
  // back to ask: anyone's, at once
  await w.ok(["config", "set", "sort.confirm", "ask", "--for-tree"], { env: { CLAUDECODE: "1" } });
  assert.equal(treeJson(w)["sort.confirm"], "ask");

  // every research on this computer: the user's config, the tree's own value wins
  await w.ok(["config", "set", "sort.confirm", "no"], { tty: true, answers: ["a"] });
  assert.equal(userJson(w)["sort.confirm"], "no");
  assert.equal(await get(), "ask", "the tree's own ask holds");
  // the tree's ask taken away where the user's config says no: no again here — the person's alone
  assert.equal((await w.run(["config", "unset", "sort.confirm", "--for-tree"], { env: { CLAUDECODE: "1" } })).code, 4);
  assert.equal(treeJson(w)["sort.confirm"], "ask");
  await w.ok(["config", "unset", "sort.confirm"], { env: { CLAUDECODE: "1" } });
  assert.equal(userJson(w)["sort.confirm"], undefined);
  await w.ok(["config", "unset", "sort.confirm", "--for-tree"], { env: { CLAUDECODE: "1" } });
  assert.equal(treeJson(w)["sort.confirm"], undefined);
  assert.equal(await get(), "ask");

  // the app's bridge writes the person's switch in the app (spec 123 P2): no window, no question
  await w.ok(["config", "set", "sort.confirm", "no", "--for-tree"], { env: { STROM_FOR_APP: "1", STROM_NONINTERACTIVE: "1" } });
  assert.equal(treeJson(w)["sort.confirm"], "no");
});

test("strom material sort with sort.confirm no: sorted at once on the ask, said so (confirm no); ask still needs the person's yes; a run nobody watches still asks", opts, async () => {
  const { w, file, starts } = await setUp();
  // ask (the default): nobody to ask — exit 4, no reader
  const none = await w.run(["material", "sort", file, "--json"]);
  assert.equal(none.code, 4, none.out + none.err);
  assert.equal(starts(), 0);

  await w.ok(["config", "set", "sort.confirm", "no", "--for-tree"], { tty: true, answers: ["a"] });
  // no terminal, no window: sorted at once, said so
  const got = (await w.ok(["material", "sort", file, "--json"])).json;
  assert.equal(got.state, "done");
  assert.equal(got.confirm, "no");
  assert.deepEqual(got.proposals?.[0]?.links, [{ type: "person", ref: "P0001" }]);
  assert.equal(starts(), 1);
  // an agent in a conversation the person asked: the same, one line says why nothing was asked
  const text = await w.ok(["material", "sort", file], { env: { CLAUDECODE: "1" } });
  assert.match(text.out, /not asked: the person's sort\.confirm no/u);
  assert.equal(starts(), 2);
  // queued only: nothing asked, nothing said of it
  const queued = (await w.ok(["material", "sort", file, "--queue", "--json"])).json;
  assert.deepEqual([queued.state, queued.confirm], ["queued", undefined]);
  // a queued sort sorted later: the same
  assert.equal((await w.ok(["material", "sort", queued.id, "--json"])).json.confirm, "no");
  assert.equal(starts(), 3);

  // a run nobody watches (strom run): asked as before — exit 4, no reader
  const unwatched = await w.run(["material", "sort", file, "--json"], { env: { AI_AGENT: "1", STROM_NONINTERACTIVE: "1", STROM_SESSION: "S0001" } });
  assert.equal(unwatched.code, 4, unwatched.out + unwatched.err);
  assert.equal(starts(), 3);

  // ask again: the person's yes again
  await w.ok(["config", "set", "sort.confirm", "ask", "--for-tree"]);
  const again = await w.run(["material", "sort", file, "--json"]);
  assert.equal(again.code, 4, again.out + again.err);
  assert.equal(starts(), 3);
});

test("the bridge: /status sort {confirm}, features sort.confirm and sort.confirm.app; POST /settings/sort ask written from anywhere, no only from the app in a browser (a device, no browser's fetch: 403 sort.raise), said in live.log; a wrong body 400; none in an archive (409 sort.archive)", opts, async () => {
  const { w } = await setUp();
  await w.ok(["live", "start", "--json"]);
  const url = (JSON.parse(fs.readFileSync(path.join(w.cwd, ".strom", "live.json"), "utf8")) as { url: string }).url;
  try {
    let status = (await request("GET", `${url}/status`)).body;
    assert.ok(status.features.includes("sort.confirm"), JSON.stringify(status.features));
    assert.ok(status.features.includes("sort.confirm.app"), JSON.stringify(status.features));
    assert.deepEqual(status.sort, { confirm: "ask" });

    // taking the question away: never what is no browser's fetch (a program, an agent's curl) nor a device of the home
    // network — nothing written
    const head = git(w, "rev-parse", "HEAD");
    for (const [headers, reason] of [[{}, "browser"], [{ "Sec-Fetch-Mode": "no-cors" }, "browser"], [{ ...browser, "X-Strom-Device": "dv_0123456789abcdef" }, "device"]] as const) {
      const raise = await request("POST", `${url}/settings/sort`, { confirm: "no" }, headers);
      assert.equal(raise.status, 403, JSON.stringify(raise.body));
      assert.equal(raise.body.code, "sort.raise");
      assert.equal(raise.body.reason, reason);
      assert.equal(raise.body.command, "strom config set sort.confirm no --for-tree");
    }
    // not from the app's pages (no Origin of the app): as every write (another page's Origin with the secret: the secret
    // replaced, 404 — the bridge's own guard)
    const foreign = await new Promise<number>((resolve, reject) => {
      const data = Buffer.from(JSON.stringify({ confirm: "no" }));
      const r = http.request(`${url}/settings/sort`, { agent: false, method: "POST", headers: { ...browser, "Content-Type": "application/json", "Content-Length": String(data.length) } }, (res) => {
        res.resume();
        resolve(res.statusCode ?? 0);
      });
      r.on("error", reject);
      r.end(data);
    });
    assert.equal(foreign, 403);
    assert.equal(treeJson(w)["sort.confirm"], undefined);
    assert.equal(git(w, "rev-parse", "HEAD"), head);

    for (const body of [{}, { confirm: "yes" }, { confirm: true }, { confirm: "ask", more: 1 }]) {
      const r = await request("POST", `${url}/settings/sort`, body);
      assert.deepEqual([r.status, r.body.code], [400, "sort.body"], JSON.stringify(body));
    }
    // as it is already: nothing written
    const same = await request("POST", `${url}/settings/sort`, { confirm: "ask" });
    assert.equal(same.status, 200, JSON.stringify(same.body));
    assert.deepEqual(same.body.sort, { confirm: "ask" });
    assert.equal(same.body.head, same.body.parent);

    // the person turns it off in the Strom app on this computer: written, said in live.log in the research's language
    const lowered = await request("POST", `${url}/settings/sort`, { confirm: "no" }, browser);
    assert.equal(lowered.status, 200, JSON.stringify(lowered.body));
    assert.deepEqual(lowered.body.sort, { confirm: "no" });
    assert.notEqual(lowered.body.head, lowered.body.parent);
    assert.equal(treeJson(w)["sort.confirm"], "no");
    assert.equal(userJson(w)["sort.confirm"], undefined, "this research's alone");
    const log = fs.readFileSync(path.join(w.cwd, ".strom", "live.log"), "utf8");
    assert.match(log, /Dotaz před tříděním materiálu tohoto výzkumu vypnut v aplikaci Strom na tomto počítači/u);
    status = (await request("GET", `${url}/status`)).body;
    assert.deepEqual(status.sort, { confirm: "no" });
    // the app asks again
    const held = await request("POST", `${url}/settings/sort`, { confirm: "no" });
    assert.deepEqual([held.status, held.body.sort, held.body.head === held.body.parent], [200, { confirm: "no" }, true]);
    const asked = await request("POST", `${url}/settings/sort`, { confirm: "ask" });
    assert.equal(asked.status, 200, JSON.stringify(asked.body));
    assert.deepEqual(asked.body.sort, { confirm: "ask" });
    assert.notEqual(asked.body.head, asked.body.parent);
    assert.equal(treeJson(w)["sort.confirm"], "ask");
    assert.deepEqual((await request("GET", `${url}/status`)).body.sort, { confirm: "ask" });
  } finally {
    await w.run(["live", "stop"]);
  }

  // an archive: nothing is sorted there — no sort in /status, the setting refused
  const { w: a } = await setUp({ archive: true });
  await a.ok(["live", "start", "--json"]);
  const arch = (JSON.parse(fs.readFileSync(path.join(a.cwd, ".strom", "live.json"), "utf8")) as { url: string }).url;
  try {
    const status = (await request("GET", `${arch}/status`)).body;
    assert.equal(status.sort, undefined);
    assert.ok(!status.features.includes("sort.confirm"));
    const r = await request("POST", `${arch}/settings/sort`, { confirm: "ask" });
    assert.deepEqual([r.status, r.body.code], [409, "sort.archive"]);
    assert.ok(!status.features.includes("run.confirm"));
    const run = await request("POST", `${arch}/settings/run`, { confirm: "no" }, browser);
    assert.deepEqual([run.status, run.body.code], [409, "run.archive"]);
  } finally {
    await a.run(["live", "stop"]);
  }
  assert.equal(userJson(a).runConfirm, undefined);
});

test("the bridge: POST /settings/run (feature run.confirm, this computer's) — ask from anywhere, no only from the app in a browser (a device, no browser's fetch: 403 run.raise), said in live.log; the terminal's way and a run nobody watches as before", opts, async () => {
  const { w } = await setUp();
  await w.ok(["live", "start", "--json"]);
  const url = (JSON.parse(fs.readFileSync(path.join(w.cwd, ".strom", "live.json"), "utf8")) as { url: string }).url;
  try {
    let status = (await request("GET", `${url}/status`)).body;
    assert.ok(status.features.includes("run.confirm"), JSON.stringify(status.features));
    assert.equal(status.work.confirm, "ask");
    const head = git(w, "rev-parse", "HEAD");

    for (const body of [{}, { confirm: "yes" }, { confirm: false }, { confirm: "no", more: 1 }]) {
      const r = await request("POST", `${url}/settings/run`, body, browser);
      assert.deepEqual([r.status, r.body.code], [400, "run.body"], JSON.stringify(body));
    }
    for (const [headers, reason] of [[{}, "browser"], [{ ...browser, "X-Strom-Device": "dv_0123456789abcdef" }, "device"]] as const) {
      const raise = await request("POST", `${url}/settings/run`, { confirm: "no" }, headers);
      assert.deepEqual([raise.status, raise.body.code, raise.body.reason, raise.body.command], [403, "run.raise", reason, "strom config set run.confirm no"]);
    }
    assert.equal(userJson(w).runConfirm, undefined);
    // as it is already: nothing written
    const same = await request("POST", `${url}/settings/run`, { confirm: "ask" });
    assert.deepEqual([same.status, same.body], [200, { run: { confirm: "ask" } }]);

    // the Strom app on this computer: written for every research here, nothing of the research committed
    const lowered = await request("POST", `${url}/settings/run`, { confirm: "no" }, browser);
    assert.deepEqual([lowered.status, lowered.body], [200, { run: { confirm: "no" } }], JSON.stringify(lowered.body));
    assert.equal(userJson(w).runConfirm, "no");
    assert.equal(git(w, "rev-parse", "HEAD"), head);
    assert.match(fs.readFileSync(path.join(w.cwd, ".strom", "live.log"), "utf8"), /Dotaz před spuštěním agenta z aplikace Strom vypnut v aplikaci Strom na tomto počítači, pro všechny výzkumy zde/u);
    status = (await request("GET", `${url}/status`)).body;
    assert.equal(status.work.confirm, "no");

    // asked again from anywhere — a program without a browser's headers too
    const asked = await request("POST", `${url}/settings/run`, { confirm: "ask" });
    assert.deepEqual([asked.status, asked.body], [200, { run: { confirm: "ask" } }], JSON.stringify(asked.body));
    assert.equal(userJson(w).runConfirm, undefined);
  } finally {
    await w.run(["live", "stop"]);
  }

  // the terminal's way as before: an agent, also in the app's environment, never; a command without the person's
  // terminal outside the bridge needs their yes
  assert.equal((await w.run(["config", "set", "run.confirm", "no"], { env: { CLAUDECODE: "1" } })).code, 4);
  assert.equal((await w.run(["config", "set", "run.confirm", "no"], { env: { STROM_FOR_APP: "1", CLAUDECODE: "1" } })).code, 4);
  assert.equal((await w.run(["config", "set", "run.confirm", "no"])).code, 4);
  assert.equal(userJson(w).runConfirm, undefined);
});
