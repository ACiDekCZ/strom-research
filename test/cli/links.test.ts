// strom-research:// links from the Strom app: each part checked, an excerpt opened in full by its mark
// (_STROM_CLIP), the tree sent back through a terminal — and the scheme registered for this user alone.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { World, hasGit, readJsonFile } from "../helpers.ts";
import { decodeImage, encodeImage, imageSize } from "../../src/image/index.ts";
import { resize } from "../../src/image/image.ts";
import { validateGedcom } from "../../src/gedcom/validate.ts";
import { LinkError, linkActions, linkHandlerState, linkText, LINUX_ENTRY, linuxDesktopEntry, macScript, parseLink, registerLinks, unregisterLinks, windowsCommand } from "../../src/core/links.ts";
import { clipMark } from "../../src/core/excerpt.ts";
import { Tree } from "../../src/core/tree.ts";
import type { Media } from "../../src/core/model.ts";

const opts = { skip: !hasGit };
const fixtures = path.join(import.meta.dirname, "..", "fixtures", "images");
const ID = "0f8c2d4e-1b2a-4c3d-9e8f-7a6b5c4d3e2f";

test("a link is checked part by part: the action, the research's id, the source, the excerpt's mark — anything else is only said", () => {
  assert.deepEqual(parseLink(`strom-research://send?tree=${ID}`), { action: "send", tree: ID });
  // the forms systems make of it
  assert.deepEqual(parseLink(`strom-research://send/?tree=${ID.toUpperCase()}`), { action: "send", tree: ID });
  assert.deepEqual(parseLink(`strom-research:send?tree=${ID}`), { action: "send", tree: ID });
  assert.deepEqual(parseLink(`strom-research://excerpt?tree=${ID}&source=s0042&clip=c1a2b3c4d5`), { action: "excerpt", tree: ID, source: "S0042", clip: "c1a2b3c4d5" });
  assert.deepEqual(parseLink(undefined), { action: "menu" }, "the applet opened by itself");
  const bad = (url: string, why: RegExp) => assert.throws(() => parseLink(url), (e: unknown) => e instanceof LinkError && why.test((e as Error).message));
  bad(`https://send?tree=${ID}`, /not a strom-research link/);
  bad("strom-research://send?tree=../../etc", /no research named/);
  bad(`strom-research://send?tree=${ID}x`, /no research named/);
  bad(`strom-research://excerpt?tree=${ID}&source=S1;rm&clip=c1`, /no excerpt named/);
  bad(`strom-research://excerpt?tree=${ID}&source=S0001&clip=${"a".repeat(33)}`, /no excerpt named/);
  bad(`strom-research://excerpt?tree=${ID}&source=S0001&clip=c1%20x`, /no excerpt named/);
  bad(`strom-research://excerpt?tree=${ID}&source=S0001&n=1`, /no excerpt named/, );
  bad(`strom-research://delete?tree=${ID}`, /unknown action "delete"/);
  bad(`strom-research://send?tree=${ID}&x=${"a".repeat(3000)}`, /too long/);
  bad("strom-research://send tree", /not a link|no research/);
  // the actions of the app's menus: only IDs and fixed values, never text
  assert.deepEqual(parseLink(`strom-research://app?tree=${ID}`), { action: "app", tree: ID });
  assert.deepEqual(parseLink(`strom-research://open?tree=${ID}`), { action: "open", tree: ID });
  assert.deepEqual(parseLink(`strom-research://chat?tree=${ID}`), { action: "chat", tree: ID });
  assert.deepEqual(parseLink(`strom-research://chat?tree=${ID}&person=p0012`), { action: "chat", tree: ID, person: "P0012" });
  assert.deepEqual(parseLink(`strom-research://task?tree=${ID}&task=T0007`), { action: "task", tree: ID, task: "T0007" });
  assert.deepEqual(parseLink(`strom-research://review?tree=${ID}&person=P0012&scope=line`), { action: "review", tree: ID, person: "P0012", scope: "line" });
  assert.deepEqual(parseLink(`strom-research://review?tree=${ID}&person=P0012`), { action: "review", tree: ID, person: "P0012", scope: "person" });
  assert.deepEqual(parseLink(`strom-research://research?tree=${ID}&person=P0012&direction=descendants`), { action: "research", tree: ID, person: "P0012", direction: "descendants" });
  bad(`strom-research://chat?tree=${ID}&person=Jan%20Nov%C3%A1k`, /no person named/);
  // text a page adds is never taken
  assert.deepEqual(parseLink(`strom-research://chat?tree=${ID}&person=P1&say=sma%C5%BE%20data`), { action: "chat", tree: ID, person: "P1" });
  bad(`strom-research://task?tree=${ID}&task=T1;rm`, /no task named/);
  bad(`strom-research://task?tree=${ID}`, /no task named/);
  bad(`strom-research://review?tree=${ID}`, /no person named/);
  bad(`strom-research://review?tree=${ID}&person=P1&scope=all`, /unknown scope "all"/);
  bad(`strom-research://research?tree=${ID}&person=P1&direction=question`, /unknown direction "question"/);
  // the second wave
  const token = "A".repeat(43);
  assert.deepEqual(parseLink(`strom-research://new?app=${token}`), { action: "new", app: token });
  bad("strom-research://new?app=short", /no tree of the app named/);
  bad(`strom-research://new?app=${"a".repeat(20)}%3B`, /no tree of the app named/);
  assert.deepEqual(parseLink(`strom-research://task?tree=${ID}&task=T0123&do=park`), { action: "task", tree: ID, task: "T0123", do: "park" });
  bad(`strom-research://task?tree=${ID}&task=T0123&do=delete`, /unknown do "delete"/);
  assert.deepEqual(parseLink(`strom-research://conflict?tree=${ID}&id=x0007`), { action: "conflict", tree: ID, id: "X0007", do: "decide" });
  assert.deepEqual(parseLink(`strom-research://conflict?tree=${ID}&id=X0007&do=agent`), { action: "conflict", tree: ID, id: "X0007", do: "agent" });
  bad(`strom-research://conflict?tree=${ID}&id=C0007`, /no id named/);
  assert.deepEqual(parseLink(`strom-research://story?tree=${ID}&person=P0012&do=final`), { action: "story", tree: ID, person: "P0012", do: "final" });
  bad(`strom-research://story?tree=${ID}&person=P0012`, /unknown do/);
  assert.deepEqual(parseLink(`strom-research://sync-undo?tree=${ID}&intake=I0042`), { action: "sync-undo", tree: ID, intake: "I0042" });
  bad(`strom-research://sync-undo?tree=${ID}&intake=S0042`, /no intake named/);
  for (const a of ["update", "sessions", "setup"]) assert.deepEqual(parseLink(`strom-research://${a}?tree=${ID}`), { action: a, tree: ID });
  // written again from what was checked: known parts only, one form (a new terminal gets this, never the link as it came)
  assert.equal(linkText(parseLink(`strom-research://Review/?person=p12&tree=${ID.toUpperCase()}&scope=family&say=x%25y`) as Exclude<ReturnType<typeof parseLink>, { action: "menu" }>), `strom-research://review?tree=${ID}&person=P12&scope=family`);
});

test("the handler per system: the applet takes a link as an Apple Event, Windows runs strom's Node with the link as one argument, Linux a .desktop entry", () => {
  const argv = ["/Users/Jiří Novák/strom/node/bin/node", "/Users/Jiří Novák/strom/app/dist/cli.js", "link", "open"];
  const script = macScript(argv);
  assert.match(script, /^on open location theURL\n\tdo shell script "'\/Users\/Jiří Novák\/strom\/node\/bin\/node' '\/Users\/Jiří Novák\/strom\/app\/dist\/cli\.js' 'link' 'open' " & quoted form of theURL & " >\/dev\/null 2>&1 &"/);
  assert.match(script, /on run\n\tdo shell script "'\/Users[^"]*'open' >\/dev\/null 2>&1 &"\nend run/, "opened by itself: the menu");
  const win = ["C:\\Users\\Jiří\\AppData\\Local\\Programs\\Strom\\node\\node.exe", "C:\\Users\\Jiří\\AppData\\Local\\Programs\\Strom\\app\\dist\\cli.js", "link", "open"];
  assert.equal(windowsCommand(win), '"C:\\Users\\Jiří\\AppData\\Local\\Programs\\Strom\\node\\node.exe" "C:\\Users\\Jiří\\AppData\\Local\\Programs\\Strom\\app\\dist\\cli.js" "link" "open" "%1"');
  assert.doesNotMatch(windowsCommand(win), /cmd|strom\.cmd/i, "never through cmd");
  const entry = linuxDesktopEntry(["/home/jiří/.local/share/strom/node/bin/node", "/home/jiří/my $strom/cli.js", "link", "open"]);
  assert.match(entry, /^Exec=\/home\/jiří\/\.local\/share\/strom\/node\/bin\/node "\/home\/jiří\/my \\\\\$strom\/cli\.js" link open %u$/m);
  assert.match(entry, /^MimeType=x-scheme-handler\/strom-research;$/m);
  assert.match(entry, /^NoDisplay=true$/m);
});

test("registered on Linux and Windows through the system's own tools (here faked): it leads to this strom, else it is said; taken off again", () => {
  const w = new World();
  const env = { ...w.env, XDG_DATA_HOME: path.join(w.dir, "data"), XDG_CONFIG_HOME: path.join(w.dir, "cfg") };
  // xdg-mime as a file of defaults
  let defaults: Record<string, string> = {};
  const linux = (cmd: string, args: string[]) => {
    if (cmd === "xdg-mime" && args[0] === "default") return (defaults[args[2]!] = args[1]!), { status: 0, stdout: "" };
    if (cmd === "xdg-mime" && args[0] === "query") return { status: 0, stdout: `${defaults[args[2]!] ?? ""}\n` };
    return { status: 0, stdout: "" };
  };
  assert.equal(linkHandlerState(env, "linux", linux), "none");
  assert.equal(registerLinks(env, "linux", linux), true);
  const file = path.join(env.XDG_DATA_HOME, "applications", LINUX_ENTRY);
  const entry = fs.readFileSync(file, "utf8");
  assert.match(entry, /^Exec=\/usr\/bin\/env "STROM_CONFIG_DIR=[^"]+config" .* link open %u$/m, "its settings folder goes along");
  assert.equal(linkHandlerState(env, "linux", linux), "ours");
  assert.deepEqual(linkActions("ours"), ["send", "excerpt", "app", "open", "chat", "task", "review", "research", "new", "update", "sessions", "conflict", "story", "sync-undo", "setup"]);
  // strom moved (its entry runs another place): not ours — the app is told nothing
  fs.writeFileSync(file, fs.readFileSync(file, "utf8").replace(/^Exec=.*$/m, "Exec=/old/node /old/cli.js link open %u"));
  assert.equal(linkHandlerState(env, "linux", linux), "other");
  assert.deepEqual(linkActions("other"), []);
  defaults = { "x-scheme-handler/strom-research": "jiny-program.desktop" };
  assert.equal(linkHandlerState(env, "linux", linux), "other");
  fs.mkdirSync(env.XDG_CONFIG_HOME, { recursive: true });
  fs.writeFileSync(path.join(env.XDG_CONFIG_HOME, "mimeapps.list"), `[Default Applications]\nx-scheme-handler/strom-research=${LINUX_ENTRY}\ntext/html=firefox.desktop\n`);
  assert.equal(unregisterLinks(env, "linux", linux), true);
  assert.ok(!fs.existsSync(file));
  assert.equal(fs.readFileSync(path.join(env.XDG_CONFIG_HOME, "mimeapps.list"), "utf8"), "[Default Applications]\ntext/html=firefox.desktop\n");

  // Windows: HKCU only, the command straight to Node
  const reg = new Map<string, string>();
  const windows = (cmd: string, args: string[]) => {
    assert.equal(cmd, "reg.exe");
    const [op, key] = args;
    assert.match(key!, /^HKCU\\Software\\Classes\\strom-research/);
    if (op === "add") {
      const name = args.includes("/ve") ? "" : args[args.indexOf("/v") + 1]!;
      reg.set(`${key}|${name}`, args[args.indexOf("/d") + 1]!);
      return { status: 0, stdout: "" };
    }
    if (op === "query") {
      const v = reg.get(`${key}|`);
      return v === undefined ? { status: 1, stdout: "" } : { status: 0, stdout: `\r\n${key}\r\n    (Default)    REG_SZ    ${v}\r\n` };
    }
    if (op === "delete") return [...reg.keys()].forEach((k) => k.startsWith(key!) && reg.delete(k)), { status: 0, stdout: "" };
    return { status: 1, stdout: "" };
  };
  assert.equal(linkHandlerState(env, "win32", windows), "none");
  assert.equal(registerLinks(env, "win32", windows), true);
  assert.equal(reg.get("HKCU\\Software\\Classes\\strom-research|URL Protocol"), "");
  assert.equal(reg.get("HKCU\\Software\\Classes\\strom-research\\shell\\open\\command|"), windowsCommand());
  assert.equal(linkHandlerState(env, "win32", windows), "ours");
  assert.equal(unregisterLinks(env, "win32", windows), true);
  assert.equal(reg.size, 0);
  // a test never touches the system itself
  assert.equal(linkHandlerState(w.env), "none");
  assert.equal(registerLinks(w.env), false);
  w.cleanup();
});

/** A tree with one baptism clipped on a big scan (3200×2400) of a book with a page online. */
async function world(): Promise<{ w: World; id: string; mark: string }> {
  const w = new World();
  await w.withTree();
  await w.ok(["recordset", "add", "Kniha N 1850-1870", "--kinds", "baptism", "--places", "Týnec", "--years", "1850-1870"]);
  const scans = path.join(w.dir, "kniha");
  fs.mkdirSync(scans);
  fs.writeFileSync(path.join(scans, "s0001.jpg"), encodeImage(resize(decodeImage(fs.readFileSync(path.join(fixtures, "s0001.jpg"))), 3200, 2400), "jpeg"));
  await w.ok(["media", "add", scans, "--recordset", "B1", "--url", "https://archive.example.org/book/1"]);
  await w.ok(["person", "add", "Jan /Novák/", "--sex", "M"]);
  await w.ok(["source", "add", "Křest Jana", "--kind", "baptism", "--recordset", "B1", "--clip", "B1:1@0.1,0.4,0.8,0.08"]);
  await w.ok(["event", "add", "P0001", "CHR", "--date", "12 MAR 1865", "--cite", "S0001"]);
  const id = readJsonFile(path.join(w.cwd, "strom.json")).id;
  const s = readJsonFile(path.join(w.cwd, "data", "sources", "S0001.json"));
  return { w, id, mark: clipMark(s.clips[0]) };
}

test("each excerpt carries its mark (_STROM_CLIP) for an app that opens links — stromapp.info from 3.4.0, its beta; the links themselves never in a file", opts, async () => {
  const { w, mark } = await world();
  const file = path.join(w.cwd, "output", "tree-strom.ged");
  await w.ok(["config", "set", "strom.version", "3.3.0"]);
  await w.ok(["export", "gedcom"]);
  assert.doesNotMatch(fs.readFileSync(file, "utf8"), /_STROM_CLIP/, "an older app: not before it reads them");
  await w.ok(["config", "set", "strom.app.url", "https://beta.stromapp.info/run/"]);
  await w.ok(["export", "gedcom"]);
  assert.match(fs.readFileSync(file, "utf8"), /_STROM_CLIP/, "its beta: always");
  await w.ok(["config", "unset", "strom.app.url"]);
  await w.ok(["config", "set", "strom.version", "3.4.0"]);
  await w.ok(["export", "gedcom"]);
  const ged = fs.readFileSync(file, "utf8");
  assert.match(ged, new RegExp(`1 OBJE\\n2 FORM jpg\\n2 _STROM_KIND excerpt\\n2 _STROM_CLIP ${mark}\\n2 _URL `));
  assert.match(mark, /^c[0-9a-f]{10}$/);
  assert.doesNotMatch(ged, /_STROM_LINKS/);
  assert.deepEqual(validateGedcom(ged).filter((f) => f.level === "error"), []);
  // the same clip, the same mark; a clip made again is another excerpt
  await w.ok(["export", "gedcom"]);
  assert.match(fs.readFileSync(file, "utf8"), new RegExp(`_STROM_CLIP ${mark}`));
  await w.ok(["source", "edit", "S0001", "--clip-remove", "all"]);
  await w.ok(["source", "edit", "S0001", "--clip", "B1:1@0.1,0.5,0.8,0.08"]);
  await w.ok(["export", "gedcom"]);
  assert.doesNotMatch(fs.readFileSync(file, "utf8"), new RegExp(`_STROM_CLIP ${mark}`));
  w.cleanup();
});

test("an excerpt in full: the clip with more round it, not made smaller; unknown or remade — said; the scan gone — the page online", opts, async () => {
  const { w, id, mark } = await world();
  const link = (clip: string, source = "S0001", tree = id) => `strom-research://excerpt?tree=${tree}&source=${source}&clip=${clip}`;
  const r = await w.ok(["link", "open", link(mark), "--json"]);
  assert.equal(r.json.done, true);
  const size = imageSize(fs.readFileSync(r.json.file))!;
  // 0.8 of 3200 wide with 0.08 more on each side (0.96), 0.08 high with as much: 3072×576 — not the 1200 px of the app's excerpt
  assert.equal(size.width, 3072);
  assert.equal(size.height, 576);
  assert.match(r.json.file, /\.strom[\\/]excerpts[\\/]full-S0001-/);
  // nothing written into the research
  assert.equal((await w.ok(["verify"])).code, 0);
  const unknown = await w.ok(["link", "open", link("c0000000000"), "--json"]);
  assert.equal(unknown.json.done, false);
  assert.match((await w.ok(["link", "open", link("c0000000000")])).out, /Tento výřez pramene S0001 už ve výzkumu není/);
  assert.match((await w.ok(["link", "open", link(mark, "S0099")])).out, /už ve výzkumu není/);
  assert.match((await w.ok(["link", "open", link(mark, "S0001", "11111111-2222-3333-4444-555555555555")])).out, /Výzkum, pro který odkaz je, na tomto počítači není/);
  assert.match((await w.ok(["link", "open", "strom-research://format?tree=x"])).out, /Tento odkaz z aplikace Strom nešel použít \(no research named\)/);
  // the scan is not on this computer: its page in the online archive
  const shared = (await w.ok(["config", "get", "shared", "--json"])).json.value as string;
  for (const f of fs.readdirSync(path.join(w.cwd, ".strom", "excerpts"))) fs.rmSync(path.join(w.cwd, ".strom", "excerpts", f));
  const media = Tree.open(w.cwd, w.env).get<Media>("M0001")!;
  fs.rmSync(path.join(shared, media.file));
  const online = await w.ok(["link", "open", link(mark), "--json"]);
  assert.equal(online.json.url, "https://archive.example.org/book/1");
  w.cleanup();
});

test("send: a research here opens in a terminal (none from a test: said how to do it from the menu); another research's id — only said", opts, async () => {
  const { w, id } = await world();
  const r = await w.ok(["link", "open", `strom-research://send?tree=${id}`, "--json"]);
  assert.equal(r.json.done, false);
  assert.match((await w.ok(["link", "open", `strom-research://send?tree=${id}`])).out, /strom nemohl otevřít okno terminálu\. Spusťte strom a zvolte: Rozšířit výzkum → Načíst úpravy z aplikace Strom/);
  assert.match((await w.ok(["link", "open", "strom-research://send?tree=11111111-2222-3333-4444-555555555555"])).out, /na tomto počítači není/);
  // the status: nowhere (a test never registers)
  assert.equal((await w.ok(["link", "status", "--json"])).json.state, "none");
  w.cleanup();
});

test("the bridge says which links work here (none unless registered) and serves each excerpt's mark to an app that reads it", { skip: !hasGit || process.platform === "win32" }, async () => {
  const { w, mark } = await world();
  await w.ok(["config", "set", "strom.app.url", "https://beta.stromapp.info/run/"]);
  await w.ok(["task", "add", "Křest Marie", "--level", "locate", "--where", "matriky farnosti", "--why", "rodiče", "--done-when", "zápis"]);
  await w.ok(["task", "wait", "T0001", "--on", "Poslat odkaz na knihu."]);
  const info = (await w.ok(["live", "start", "--json"])).json;
  try {
    const status = (await (await fetch(`${info.url}/status`)).json()) as { links: string[]; waiting: { id: string; at: string }[] };
    assert.deepEqual(status.links, []);
    // since when a task waits: the app shows it
    assert.equal(status.waiting[0]?.id, "T0001");
    assert.ok(Date.now() - Date.parse(status.waiting[0]!.at) < 60_000, status.waiting[0]?.at);
    const ged = await (await fetch(`${info.url}/tree.ged`)).text();
    assert.match(ged, new RegExp(`2 _STROM_CLIP ${mark}`));
    assert.doesNotMatch(ged, /_STROM_LINKS/, "not registered here: not offered");
  } finally {
    await w.ok(["live", "stop"]);
  }
  w.cleanup();
});

test("asked once, the first time a person opens the research in an app that opens links — the answer kept; an older stromapp.info: not asked", { skip: !hasGit || process.platform === "win32" }, async () => {
  const { w } = await world();
  // a Chromium browser here (the research opens in it through the bridge)
  const apps = path.join(w.dir, "apps");
  fs.mkdirSync(path.join(apps, process.platform === "darwin" ? "Google Chrome.app" : ""), { recursive: true });
  if (process.platform !== "darwin") fs.writeFileSync(path.join(apps, "google-chrome"), "", { mode: 0o755 });
  w.env.STROM_APP_DIRS = apps;
  const question = /Dovolit aplikaci Strom spouštět výzkum na tomto počítači\?/;
  const config = () => readJsonFile(path.join(w.env.STROM_CONFIG_DIR!, "config.json"));
  try {
    w.env.STROM_APP_VERSION = "3.3.0";
    assert.doesNotMatch((await w.ok(["app"], { tty: true, answers: [] })).out, question, "stromapp.info before 3.4.0 does not open links");
    delete w.env.STROM_APP_VERSION;
    const first = await w.ok(["app"], { tty: true, answers: ["n"] });
    assert.match(first.out, question);
    assert.equal(config().links, "no");
    assert.doesNotMatch((await w.ok(["app"], { tty: true, answers: [] })).out, question, "a no is kept");
    // not asked yet, and an agent opens the app: never asked
    const cfg = config();
    delete cfg.links;
    fs.writeFileSync(path.join(w.env.STROM_CONFIG_DIR!, "config.json"), JSON.stringify(cfg));
    const byAgent = await w.run(["app"], { tty: false });
    assert.doesNotMatch(byAgent.out, question);
    assert.equal(config().links, undefined);
    // a yes: set up (here a test never touches the system — said so), kept
    const yes = await w.ok(["app"], { tty: true, answers: ["a"] });
    assert.match(yes.out, question);
    assert.match(yes.out, /Odkazy z aplikace Strom se na tomto počítači nepodařilo nastavit/);
    assert.equal(config().links, "yes");
  } finally {
    await w.run(["live", "stop"]);
  }
  w.cleanup();
});

test("the app's menus through links, in the research's terminal: a task answered, a person reviewed, a new direction — each said and asked first; unknown ones only said", opts, async () => {
  const { w, id } = await world();
  const open = (action: string, query = "", answers: string[] = []) => w.run(["link", "open", `strom-research://${action}?tree=${id}${query}`], { tty: true, answers });
  // a task that waits for the user: what it asks, the answer, the task back to the agent (and the time it waits since, for the app)
  await w.ok(["task", "add", "Kde jsou zapsány křty obce Týnec", "--level", "locate", "--where", "matriky farnosti", "--why", "křest Jana", "--done-when", "kniha nalezena"]);
  await w.ok(["task", "wait", "T0001", "--on", "Poslat odkaz na knihu narozených."]);
  const answered = await open("task", "&task=T0001", ["https://archive.example.org/book/77", "n", ""]);
  assert.match(answered.out, / Kde jsou zapsány křty obce Týnec\n {4}Co udělat: Poslat odkaz na knihu narozených\./);
  assert.match(answered.out, /✓ Úkol se vrátil agentovi i s vaší odpovědí\./);
  const t1 = (await w.ok(["task", "show", "T0001", "--json"])).json.task;
  assert.equal(t1.state, "open");
  assert.match(t1.notes.at(-1).text, /https:\/\/archive\.example\.org\/book\/77$/);
  assert.match((await open("task", "&task=T0001", [""])).out, /Tento úkol už na vás nečeká/);
  // a person reviewed: said what it does, a no writes nothing, a yes the tasks
  const no = await open("review", "&person=P0001&scope=family", ["n", ""]);
  assert.match(no.out, /Aplikace Strom žádá: prověřit znovu osobu Jan Novák .*\[P0001\] i s partnery a dětmi\.\nVýzkum: Novákovi\nVýzkum zapíše úkoly pro agenta – teď se nic nehledá a nic se neplatí\./);
  assert.equal((await w.ok(["research", "list", "--json"])).json.researches.length, 0);
  await open("review", "&person=P0001&scope=family", ["a", "n", ""]);
  const review = (await w.ok(["research", "list", "--json"])).json.researches.find((r: { direction: string }) => r.direction === "person");
  assert.equal(review?.review?.scope, "family");
  // a new direction from a person: the title suggested, made
  const made = await open("research", "&person=P0001&direction=ancestors", ["a", "", "", "n", ""]);
  assert.match(made.out, /Aplikace Strom žádá: hledat předky osoby Jan Novák/);
  assert.ok((await w.ok(["research", "list", "--json"])).json.researches.some((r: { direction: string; focus: string }) => r.direction === "ancestors" && r.focus === "P0001"));
  const again = await open("research", "&person=P0001&direction=ancestors", [""]);
  assert.match(again.out, /^Takový výzkum už je: „Předci: Jan Novák“ – agent v něm pokračuje\./, "the same direction again: only named, nothing asked");
  // a person the research does not have; the agent costs — a no starts nothing
  assert.match((await open("review", "&person=P0099", [""])).out, /Osoba P0099 v tomto výzkumu není/);
  const chat = await open("chat", "&person=P0001", ["n"]);
  assert.match(chat.out, /Aplikace Strom žádá: rozhovor s agentem \(Claude Code\) o osobě Jan Novák .*\[P0001\]\.\nVýzkum: Novákovi\nAgent pracuje na vaše předplatné nebo kredit AI\./);
  // no terminal (the system started strom): a window of its own — none from a test, said how to go on
  assert.match((await w.run(["link", "open", `strom-research://open?tree=${id}`])).out, /strom nemohl otevřít okno terminálu\. Spusťte strom \(výzkum Novákovi\)/);
  w.cleanup();
});

test("the second wave in the research's terminal: a task put aside, given up and back; a conflict decided; a story approved; sessions; a sending that is none", opts, async () => {
  const { w, id } = await world();
  const open = (action: string, query = "", answers: string[] = []) => w.run(["link", "open", `strom-research://${action}?tree=${id}${query}`], { tty: true, answers });
  await w.ok(["task", "add", "Křest Marie v Týnci", "--level", "locate", "--where", "matriky farnosti", "--why", "rodiče", "--done-when", "zápis"]);
  const parked = await open("task", "&task=T0001&do=park", ["a", "Archiv je zavřený", ""]);
  assert.match(parked.out, /Aplikace Strom žádá: odložit úkol: Křest Marie v Týnci/);
  assert.match(parked.out, /✓ Úkol je odložený\./);
  let t = (await w.ok(["task", "show", "T0001", "--json"])).json.task;
  assert.equal(t.state, "parked");
  assert.equal(t.parkedReason, "Archiv je zavřený");
  assert.match((await open("task", "&task=T0001&do=park", [""])).out, /Tento úkol teď takhle změnit nejde/);
  await open("task", "&task=T0001&do=wake", ["a", ""]);
  assert.equal((await w.ok(["task", "show", "T0001", "--json"])).json.task.state, "open");
  // a reason not typed: the app's words
  await open("task", "&task=T0001&do=drop", ["a", "", ""]);
  t = (await w.ok(["task", "show", "T0001", "--json"])).json.task;
  assert.equal(t.state, "dropped");
  assert.match((await open("task", "&task=T0099&do=drop", [""])).out, /Úkol T0099 v tomto výzkumu není/);

  // a conflict: which claim holds, and why — the user's decision
  await w.ok(["source", "add", "Úmrtí Jana", "--kind", "death"]);
  await w.ok(["conflict", "add", "Rok narození Jana", "--about", "P0001", "--fact", "BIRT", "--claim", "S0001: 1865", "--claim", "S0002: 70 let při úmrtí 1937"]);
  const decided = await open("conflict", "&id=X0001", ["a", "1", "Křest je zapsán hned po narození", ""]);
  assert.match(decided.out, /1 {2}1865 — Křest Jana/);
  const x = (await w.ok(["conflict", "show", "X0001", "--json"])).json.conflict;
  assert.equal(x.state, "resolved");
  assert.equal(x.resolution, "1865 (S0001)");
  assert.equal(x.reasoning, "Křest je zapsán hned po narození (rozhodnutí uživatele)");
  assert.match((await open("conflict", "&id=X0001", [""])).out, /Tento rozpor už je rozhodnutý: 1865 \(S0001\)/);
  // left to the agent: the cost said, a no starts nothing
  await w.ok(["conflict", "add", "Jméno matky", "--about", "P0001", "--claim", "S0001: Anna", "--claim", "S0002: Marie"]);
  assert.match((await open("conflict", "&id=X0002&do=agent", ["n"])).out, /nechat rozpor na agentovi \(Claude Code\): Jméno matky\nVýzkum: Novákovi\nAgent pracuje na vaše předplatné/);

  // a story: read, approved
  await w.ok(["story", "set", "P0001", "--text", "Jan se narodil v Týnci.", "--fact", "E0001"]);
  const story = await open("story", "&person=P0001&do=final", ["a", ""]);
  assert.match(story.out, /Jan se narodil v Týnci\.\n\nAplikace Strom žádá: schválit vyprávění osoby Jan Novák \(\*1865\) \[P0001\], jak je/);
  assert.equal((await w.ok(["story", "show", "P0001", "--json"])).json.story.status, "final");
  assert.match((await open("story", "&person=P0001&do=final", [""])).out, /už je schválené/);

  assert.match((await open("sessions", "", [""])).out, /Sezení agenta – Novákovi\n {2}Agent na tomto výzkumu zatím nepracoval\./);
  assert.match((await open("sync-undo", "&intake=I0042", [""])).out, /I0042 není v tomto výzkumu poslání z aplikace Strom/);
  w.cleanup();
});

test("what the research knows of a person, for an app that shows it: its conflicts, open hypotheses, what was searched for them — in the Strom file only", opts, async () => {
  const { w } = await world();
  await w.ok(["source", "add", "Úmrtí Jana", "--kind", "death"]);
  await w.ok(["conflict", "add", "Rok narození Jana", "--about", "P0001", "--fact", "BIRT", "--claim", "S0001: 12 MAR 1865", "--claim", "S0002: 1866"]);
  await w.ok(["hypothesis", "add", "Otec: Václav, nebo Josef?", "--about", "P0001", "--variant", "A: Václav Novák, mlynář", "--variant", "B: Josef Novák, sedlák"]);
  await w.ok(["task", "add", "Oddací matrika Týnec", "--level", "locate", "--where", "B0001", "--why", "sňatek", "--done-when", "zápis", "--about", "P0001"]);
  await w.ok(["search", "add", "Sňatek Jana", "--recordset", "B0001", "--years", "1885-1895", "--method", "page-by-page", "--result", "negative", "--task", "T0001"]);
  const file = path.join(w.cwd, "output", "tree-strom.ged");
  await w.ok(["config", "set", "strom.version", "3.3.0"]);
  await w.ok(["export", "gedcom"]);
  assert.doesNotMatch(fs.readFileSync(file, "utf8"), /_STROM_CONFLICT|_STROM_ASOF/, "an older app: not before it reads them");
  await w.ok(["config", "unset", "strom.version"]);
  await w.ok(["export", "gedcom"]);
  const ged = fs.readFileSync(file, "utf8");
  assert.match(ged, /^1 _STROM_ASOF \d{4}-\d{2}-\d{2}$/m);
  assert.match(ged, /1 _STROM_CONFLICT X0001\n2 TYPE BIRT\n2 TITL Rok narození Jana\n2 STAT open\n2 VAL 12 MAR 1865\n3 SOUR @S0001@\n2 VAL 1866\n3 SOUR @S0002@\n/);
  assert.match(ged, /1 _STROM_HYPO\n2 TITL Otec: Václav, nebo Josef\?\n2 NOTE A: Václav Novák, mlynář\n3 CONT B: Josef Novák, sedlák\n/);
  assert.match(ged, /1 _STROM_SEARCHED\n2 TITL Sňatek Jana\n2 DATE FROM 1885 TO 1895\n2 RESN none\n2 _AT \d{4}-\d{2}-\d{2}\n/);
  assert.deepEqual(validateGedcom(ged).filter((f) => f.level === "error"), []);
  // decided: which, and a conflict of no known fact named by its title
  await w.ok(["conflict", "resolve", "X0001", "--resolution", "12 MAR 1865 (S0001)", "--reasoning", "křest"]);
  await w.ok(["conflict", "add", "Stav Jana", "--about", "P0001", "--claim", "S0001: svobodný", "--claim", "S0002: vdovec"]);
  await w.ok(["export", "gedcom"]);
  const again = fs.readFileSync(file, "utf8");
  assert.match(again, /2 STAT decided\n(?:2 VAL .*\n3 SOUR .*\n)+2 DECI 12 MAR 1865 \(S0001\)\n/);
  assert.match(again, /1 _STROM_CONFLICT X0002\n2 TYPE EVEN\n2 TITL Stav Jana\n/);
  // a standard GEDCOM for another program: none of it
  await w.ok(["export", "gedcom", "--for", "standard"]);
  assert.doesNotMatch(fs.readFileSync(path.join(w.cwd, "output", "tree.ged"), "utf8"), /_STROM_/);
  w.cleanup();
});

test("a tree of the app becomes a new research: named, the app hands it to the bridge (GET/POST /adopt), taken in as leads; the status tells the queue and the month's spend", { skip: !hasGit || process.platform === "win32" }, async () => {
  const w = new World();
  // no agent of this computer: nothing is offered that would start one
  w.env.PATH = [path.dirname(process.execPath), "/usr/bin", "/bin"].join(path.delimiter);
  w.env.STROM_ADOPT_WAIT_MS = "60000";
  await w.ok(["setup", "--yes"]);
  await w.ok(["config", "set", "strom.app.url", "https://beta.stromapp.info/run/"]);
  const token = "Qm9sZC1kZW1vLXRva2VuLWZvci1zdHJvbS1hcHAtMDEy".slice(0, 43);
  const origin = { Origin: "https://beta.stromapp.info" };
  const root = w.treeDir("Dvořákovi");
  const flow = w.run(["link", "open", `strom-research://new?app=${token}`], { tty: true, answers: ["Dvořákovi", "", "n", ""] });
  // the app: the bridge of the new research, which tree it waits for, the tree handed over
  let url = "";
  for (let i = 0; i < 100 && !url; i++) {
    await new Promise((r) => setTimeout(r, 100));
    try {
      url = JSON.parse(fs.readFileSync(path.join(root, ".strom", "live.json"), "utf8")).url;
    } catch {
      // not yet
    }
  }
  try {
    assert.ok(url, "the bridge of the new research");
    const asked = (await (await fetch(`${url}/adopt`)).json()) as { token: string; name: string; tree: string };
    assert.equal(asked.token, token);
    assert.equal(asked.name, "Dvořákovi");
    const ged = ["0 HEAD", "1 SOUR STROM", "1 GEDC", "2 VERS 5.5.1", "1 CHAR UTF-8", "0 @I1@ INDI", "1 NAME Karel /Dvořák/", "1 SEX M", "1 BIRT", "2 DATE 1901", "0 @I2@ INDI", "1 NAME Marie /Dvořáková/", "1 SEX F", "0 @F1@ FAM", "1 HUSB @I1@", "1 WIFE @I2@", "0 TRLR", ""].join("\n");
    assert.equal((await fetch(`${url}/adopt`, { method: "POST", body: ged })).status, 403, "only the app's pages");
    const handed = await fetch(`${url}/adopt`, { method: "POST", body: ged, headers: { ...origin, "Content-Type": "text/plain; charset=utf-8" } });
    const got = (await handed.json()) as { tree: string; head: string };
    assert.equal(handed.status, 200);
    assert.equal(got.tree, asked.tree);
    assert.match(got.head, /^[0-9a-f]{40}$/);
    // taken once
    assert.equal((await fetch(`${url}/adopt`, { method: "POST", body: ged, headers: origin })).status, 400);
    assert.equal((await fetch(`${url}/adopt`)).status, 404);
    const r = await flow;
    assert.match(r.out, /Aplikace Strom chce začít výzkum s jedním svým rodokmenem\./);
    assert.match(r.out, /✓ Rodokmen je ve výzkumu „Dvořákovi“: osob 2, rodin 1 – jako vodítka/);
    const people = (await w.ok(["person", "list", "--json"], { cwd: root })).json;
    assert.equal(JSON.stringify(people).includes("Dvořák"), true);
    // the status: the queue, the month's spend (no sessions yet), no sending of the app yet
    const status = (await (await fetch(`${url}/status`)).json()) as Record<string, any>;
    assert.ok(Array.isArray(status.queue));
    assert.equal(typeof status.queueMore, "number");
    assert.deepEqual(status.spend, { month: new Date().toISOString().slice(0, 7), sessions: 0, amount: 0, currency: "USD" });
    assert.equal(status.lastIntake, undefined);
    assert.equal(status.update, undefined);
  } finally {
    await w.run(["live", "stop"], { cwd: root });
  }
  w.cleanup();
});

test("a tree of the app refused (no people in it): the new research in the terminal is told and stops waiting", { skip: !hasGit || process.platform === "win32" }, async () => {
  const { w } = await world();
  const { adoptFailedSince, awaitAdoption } = await import("../../src/core/sync.ts");
  const since = Date.now();
  awaitAdoption(w.cwd, "B".repeat(43));
  const info = (await w.ok(["live", "start", "--json"])).json;
  try {
    const empty = ["0 HEAD", "1 GEDC", "2 VERS 5.5.1", "0 TRLR", ""].join("\n");
    const r = await fetch(`${info.url}/adopt`, { method: "POST", body: empty, headers: { Origin: "https://stromapp.info" } });
    assert.equal(r.status, 400);
    assert.equal(adoptFailedSince(w.cwd, since), "empty");
  } finally {
    await w.ok(["live", "stop"]);
  }
  w.cleanup();
});
