// strom-research:// links from the Strom app: each part checked, an excerpt opened in full by its mark
// (_STROM_CLIP), the tree sent back through a terminal — and the scheme registered for this user alone.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { World, hasGit, readJsonFile } from "../helpers.ts";
import { decodeImage, encodeImage, imageSize } from "../../src/image/index.ts";
import { resize } from "../../src/image/image.ts";
import { validateGedcom } from "../../src/gedcom/validate.ts";
import { LinkError, linkActions, linkHandlerState, linkText, LINUX_ENTRY, linuxDesktopEntry, linkOwner, macApp, macScript, parseLink, refreshLinks, registerLinks, unregisterLinks, windowsCommand, type Sys } from "../../src/core/links.ts";
import { Settings } from "../../src/core/config.ts";
import { offerLinks } from "../../src/cli/wizard.ts";
import { uninstallPlan } from "../../src/core/uninstall.ts";
import type { Context } from "../../src/cli/context.ts";
import { clipMark } from "../../src/core/excerpt.ts";
import { Tree } from "../../src/core/tree.ts";
import type { Media } from "../../src/core/model.ts";
import { opts, fixtures, ID, world } from "./links.helpers.ts";

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
  assert.deepEqual(parseLink(`strom-research://live?tree=${ID}&person=P0001`), { action: "live", tree: ID }, "only the tree");
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
  assert.deepEqual(parseLink(`strom-research://story?tree=${ID}&person=P0012&do=keep`), { action: "story", tree: ID, person: "P0012", do: "keep" });
  assert.deepEqual(parseLink(`strom-research://sync-undo?tree=${ID}&intake=I0042`), { action: "sync-undo", tree: ID, intake: "I0042" });
  bad(`strom-research://sync-undo?tree=${ID}&intake=S0042`, /no intake named/);
  for (const a of ["update", "sessions", "setup"]) assert.deepEqual(parseLink(`strom-research://${a}?tree=${ID}`), { action: a, tree: ID });
  // the directions of the research, a conversation about one, a session asked to finish
  assert.deepEqual(parseLink(`strom-research://direction?tree=${ID}&id=g0002&do=pause`), { action: "direction", tree: ID, id: "G0002", do: "pause" });
  bad(`strom-research://direction?tree=${ID}&id=G0002`, /unknown do/);
  bad(`strom-research://direction?tree=${ID}&id=P0002&do=done`, /no id named/);
  assert.deepEqual(parseLink(`strom-research://chat?tree=${ID}&research=G0002`), { action: "chat", tree: ID, research: "G0002" });
  bad(`strom-research://chat?tree=${ID}&research=T1`, /no research named/);
  assert.deepEqual(parseLink(`strom-research://finish?tree=${ID}&session=n0012`), { action: "finish", tree: ID, session: "N0012" });
  bad(`strom-research://finish?tree=${ID}`, /no session named/);
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
  assert.deepEqual(linkActions("ours"), ["send", "excerpt", "app", "open", "chat", "task", "review", "research", "new", "update", "sessions", "conflict", "story", "sync-undo", "setup", "live", "direction", "finish", "sync", "media"]);
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

test("a no to the links registers nothing — on Windows, macOS and Linux (here faked); another installation's stays as it is, also after an update", async () => {
  const w = new World();
  const env = { ...w.env, XDG_DATA_HOME: path.join(w.dir, "data"), XDG_CONFIG_HOME: path.join(w.dir, "cfg") };
  const appDir = macApp(env);
  for (const platform of ["win32", "darwin", "linux"] as const) {
    // the system: what is registered, and each change asked of it
    const reg = new Map<string, string>();
    let macHandler = "";
    let xdg = "";
    const writes: string[] = [];
    const run: Sys = (cmd, args) => {
      if (cmd === "reg.exe" && args[0] === "query") {
        const v = reg.get(args[1]!);
        return v === undefined ? { status: 1, stdout: "" } : { status: 0, stdout: `\r\n${args[1]}\r\n    (Default)    REG_SZ    ${v}\r\n` };
      }
      if (cmd === "osascript") return { status: 0, stdout: `${macHandler}\n` };
      if (cmd === "xdg-mime" && args[0] === "query") return { status: 0, stdout: `${xdg}\n` };
      writes.push(`${cmd} ${args.join(" ")}`);
      if (cmd === "reg.exe" && args[0] === "add" && args.includes("/ve")) reg.set(args[1]!, args[args.indexOf("/d") + 1]!);
      if (cmd === "osacompile") fs.mkdirSync(path.join(appDir, "Contents", "Resources"), { recursive: true }), (macHandler = appDir);
      if (cmd === "xdg-mime" && args[0] === "default") xdg = args[1]!;
      return { status: 0, stdout: "" };
    };
    const entry = path.join(env.XDG_DATA_HOME, "applications", LINUX_ENTRY);
    const what = () => ({ reg: [...reg.entries()], mac: fs.existsSync(appDir) ? fs.readdirSync(path.join(appDir, "Contents", "Resources")) : [], linux: fs.existsSync(entry) ? fs.readFileSync(entry, "utf8") : "" });
    const person = (answer: boolean) => {
      const out: string[] = [];
      const ctx = { env, settings: new Settings(env, {}), io: { stdout: (t: string) => out.push(t) }, confirm: async () => answer, archiveHere: () => false } as unknown as Context;
      return { ctx, out };
    };
    const offer = (answer: boolean) => {
      const p = person(answer);
      return offerLinks(p.ctx, "cs", { platform, run }).then(() => p);
    };
    const said = () => readJsonFile(path.join(w.env.STROM_CONFIG_DIR!, "config.json")).links;

    // 1. nothing set up: a no writes nothing
    await offer(false);
    assert.deepEqual(writes, [], `${platform}: ${writes.join("; ")}`);
    assert.deepEqual(what(), { reg: [], mac: [], linux: "" }, platform);
    assert.equal(said(), "no");
    // …nor the first run of a newer strom
    assert.equal(refreshLinks(said(), env, platform, run), false);
    assert.deepEqual(writes, [], platform);

    // 2. set up by another installation (its own settings): asked again, a no leaves it as it is
    const key = "HKCU\\Software\\Classes\\strom-research\\shell\\open\\command";
    if (platform === "win32") reg.set(key, `"C:\\Jinde\\node.exe" "C:\\Jinde\\cli.js" link open "%1"`);
    if (platform === "darwin") {
      fs.mkdirSync(path.join(appDir, "Contents", "Resources"), { recursive: true });
      fs.writeFileSync(path.join(appDir, "Contents", "Resources", "strom-link.json"), JSON.stringify({ argv: ["/jinde/node", "/jinde/cli.js"] }));
      macHandler = appDir;
    }
    if (platform === "linux") {
      fs.mkdirSync(path.dirname(entry), { recursive: true });
      fs.writeFileSync(entry, "[Desktop Entry]\nExec=/jinde/node /jinde/cli.js link open %u\n");
      xdg = LINUX_ENTRY;
    }
    const before = what();
    for (const config of [undefined, "no"]) {
      const s = new Settings(env, {});
      s.config.links = config as "no" | undefined;
      s.save();
      assert.equal(refreshLinks(config, env, platform, run), false, `${platform}: after an update, ${config}`);
      const p = await offer(false);
      assert.ok(p.out.length === 0, `${platform}: nothing said done`);
      assert.deepEqual(writes, [], `${platform} (${config}): ${writes.join("; ")}`);
      assert.deepEqual(what(), before, platform);
      assert.equal(said(), "no");
    }

    // 3. a yes: registered for this strom (the fake is no fake of nothing)
    await offer(true);
    assert.ok(writes.length > 0, platform);
    assert.equal(said(), "yes");
    // the person's own yes: after an update set up again
    writes.length = 0;
    if (platform === "win32") reg.set(key, `"C:\\stary\\node.exe" "C:\\stary\\cli.js" link open "%1"`);
    if (platform === "linux") fs.writeFileSync(entry, "[Desktop Entry]\nExec=/stary/node link open %u\n");
    if (platform === "darwin") fs.writeFileSync(path.join(appDir, "Contents", "Resources", "strom-link.json"), "{}");
    refreshLinks("yes", env, platform, run);
    assert.ok(writes.length > 0, `${platform}: set up again after an update`);

    fs.rmSync(appDir, { recursive: true, force: true });
    fs.rmSync(entry, { force: true });
    fs.rmSync(path.join(w.env.STROM_CONFIG_DIR!, "config.json"), { force: true });
  }
  w.cleanup();
});

test("another installation's links stay its own: said in the question (no suggested), kept by link off and uninstall; a strom no longer there leaves its links to be taken", async () => {
  const w = new World();
  const env = { ...w.env, XDG_DATA_HOME: path.join(w.dir, "data"), XDG_CONFIG_HOME: path.join(w.dir, "cfg") };
  const appDir = macApp(env);
  const entry = path.join(env.XDG_DATA_HOME, "applications", LINUX_ENTRY);
  // another installation: its Node and its code are there
  const jinde = path.join(w.dir, "jinde");
  fs.mkdirSync(jinde, { recursive: true });
  const [node, cli] = [path.join(jinde, "node"), path.join(jinde, "cli.js")];
  fs.writeFileSync(node, "");
  fs.writeFileSync(cli, "");
  for (const platform of ["win32", "darwin", "linux"] as const) {
    const reg = new Map<string, string>();
    const writes: string[] = [];
    const run: Sys = (cmd, args) => {
      if (cmd === "reg.exe" && args[0] === "query") {
        const v = reg.get(args[1]!);
        return v === undefined ? { status: 1, stdout: "" } : { status: 0, stdout: `\r\n${args[1]}\r\n    (Default)    REG_SZ    ${v}\r\n` };
      }
      if (cmd === "osascript") return { status: 0, stdout: `${appDir}\n` };
      if (cmd === "xdg-mime" && args[0] === "query") return { status: 0, stdout: `${LINUX_ENTRY}\n` };
      writes.push(`${cmd} ${args.join(" ")}`);
      if (cmd === "reg.exe" && args[0] === "delete") reg.clear();
      return { status: 0, stdout: "" };
    };
    const key = "HKCU\\Software\\Classes\\strom-research\\shell\\open\\command";
    const setUp = () => {
      if (platform === "win32") reg.set(key, `"${node}" "${cli}" link open "%1"`);
      if (platform === "darwin") {
        fs.mkdirSync(path.join(appDir, "Contents", "Resources"), { recursive: true });
        fs.writeFileSync(path.join(appDir, "Contents", "Resources", "strom-link.json"), JSON.stringify({ argv: [node, cli, "link", "open"] }));
      }
      if (platform === "linux") {
        fs.mkdirSync(path.dirname(entry), { recursive: true });
        fs.writeFileSync(entry, linuxDesktopEntry([node, cli, "link", "open"]));
      }
    };
    const there = () => (platform === "win32" ? reg.size > 0 : fs.existsSync(platform === "darwin" ? appDir : entry));
    setUp();
    assert.deepEqual(linkOwner(env, platform, run), { owner: "other", program: cli }, platform);

    // the question says whose they are, and suggests no
    let suggested: boolean | undefined;
    const out: string[] = [];
    const ctx = { env, settings: new Settings(env, {}), io: { stdout: (t: string) => out.push(t) }, display: (p: string) => p, confirm: async (_q: string, s: boolean) => ((suggested = s), false), archiveHere: () => false } as unknown as Context;
    await offerLinks(ctx, "cs", { platform, run });
    assert.equal(suggested, false, platform);
    assert.match(out.join(""), /vedou na jinou instalaci stromu na tomto počítači \(.*cli\.js\)/, platform);

    // link off and uninstall of this strom keep them
    assert.equal(unregisterLinks(env, platform, run), true);
    assert.ok(there(), `${platform}: another installation's links stay`);
    assert.deepEqual(writes, [], platform);
    if (platform !== "win32") assert.deepEqual(uninstallPlan(env, [], { platform }).remove.filter((r) => r.kind === "links"), [], platform);

    // its program gone: a strom no longer there — taken off
    fs.renameSync(jinde, `${jinde}-pryc`);
    assert.equal(linkOwner(env, platform, run).owner, "stale", platform);
    if (platform !== "win32") assert.equal(uninstallPlan(env, [], { platform }).remove.filter((r) => r.kind === "links").length, 1, platform);
    assert.equal(unregisterLinks(env, platform, run), true);
    assert.ok(!there(), `${platform}: taken off`);
    fs.renameSync(`${jinde}-pryc`, jinde);
    fs.rmSync(path.join(w.env.STROM_CONFIG_DIR!, "config.json"), { force: true });
  }
  w.cleanup();
});

test("an isolated installation registers no links: link on says so, the setup's question is not asked", async () => {
  const w = new World();
  w.env.STROM_ISOLATED = "1";
  const r = await w.run(["link", "on", "--json"], { tty: true });
  assert.equal(r.code, 1);
  assert.deepEqual(r.json, { on: false, isolated: true });
  const ctx = { env: w.env, settings: new Settings(w.env, {}), io: { stdout: () => undefined }, confirm: async () => assert.fail("not asked") } as unknown as Context;
  await offerLinks(ctx, "cs", { platform: "win32", run: () => assert.fail("the system not asked") });
  w.cleanup();
});

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
  assert.match((await w.ok(["link", "open", `strom-research://send?tree=${id}`])).out, /strom nemohl otevřít okno terminálu\. Spustit strom a zvolit: Rozšířit výzkum → Načíst úpravy z aplikace Strom/);
  assert.match((await w.ok(["link", "open", "strom-research://send?tree=11111111-2222-3333-4444-555555555555"])).out, /na tomto počítači není/);
  // the status: nowhere (a test never registers)
  assert.equal((await w.ok(["link", "status", "--json"])).json.state, "none");
  w.cleanup();
});
