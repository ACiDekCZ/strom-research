// A tree of the Strom app and the browser it lives in (the app's ZADANI_VYZKUM_prenos-prohlizece.md): strom opens the
// app in the browser the tree came from, else the default one the app reaches strom from; a tree from Safari moves
// to a browser that can — always asked (the tree, how many people, the browser), no is nothing set up; with no such
// browser: the research from the tree's file. The bridge gives the moving tree to the app (GET /transfer).

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { World, hasGit, readJsonFile } from "../helpers.ts";
import { appWindow, replaceGone } from "../../src/core/appbrowser.ts";
import { browserKind, kindReaches } from "../../src/core/chromium.ts";
import { Settings } from "../../src/core/config.ts";
import { findTransfer, transferMark } from "../../src/core/transfer.ts";
import { expandFromLine, linkText, parseLink } from "../../src/core/links.ts";
import { BRIDGE_FEATURES } from "../../src/core/live.ts";

const opts = { skip: !hasGit || process.platform === "win32" };
const TOKEN = "UHJlbm9zLXN0cm9tdS16LXNhZmFyaS0wMDAwMDAwMQ";
const ORIGIN = { Origin: "https://beta.stromapp.info" };

/** Browsers as installed on a Mac, in a folder of the test's own. */
function browsers(w: World, ...apps: string[]): string {
  const dir = path.join(w.dir, "Applications");
  for (const a of apps) fs.mkdirSync(path.join(dir, a), { recursive: true });
  return dir;
}

/** The app's JSON backup of a tree, marked for a move (its first key), as Safari saves it into Downloads. */
function transferFile(w: World, name: string, token = TOKEN, tree = "Novákovi {domov}", at?: Date, from = "safari", app?: string): string {
  const dir = path.join(w.env.HOME!, "Downloads");
  fs.mkdirSync(dir, { recursive: true });
  const person = (id: string, firstName: string, lastName: string, gender: string, birthDate?: string) => ({ id, firstName, lastName, gender, parentIds: [], ...(birthDate ? { birthDate } : {}) });
  const data = {
    stromTransfer: { v: 1, token, from, tree, persons: 2, at: new Date().toISOString(), ...(app ? { app } : {}) },
    version: 11,
    persons: { a: person("a", "Karel", "Novák", "male", "1901"), b: person("b", "Marie", "Nováková", "female") },
    partnerships: { u: { id: "u", person1Id: "a", person2Id: "b", childIds: [] } },
  };
  const file = path.join(dir, name);
  fs.writeFileSync(file, JSON.stringify(data));
  if (at) fs.utimesSync(file, at, at);
  return file;
}

test("the browser the Strom app opens in: the one its tree came from (app.browser), else the default one it reaches strom from, else the first such here — never Safari", () => {
  const w = new World();
  const dirs = browsers(w, "Google Chrome.app", "Microsoft Edge.app", "Firefox.app", "Safari.app");
  const at = (env: Record<string, string>, config: Record<string, unknown> = {}) =>
    appWindow(new Settings({ ...w.env, STROM_APP_DIRS: dirs, ...env }, {}, config), { ...w.env, STROM_APP_DIRS: dirs, ...env }, "darwin").browser?.name;
  assert.equal(at({}), "Google Chrome", "nothing said: the first here");
  assert.equal(at({ STROM_DEFAULT_BROWSER: "safari" }), "Google Chrome", "the default one cannot reach strom: the first here");
  assert.equal(at({ STROM_DEFAULT_BROWSER: "firefox" }), "Firefox", "the default one when it can");
  assert.equal(at({ STROM_DEFAULT_BROWSER: "firefox" }, { appBrowser: "edge" }), "Microsoft Edge", "the one the tree came from first");
  assert.equal(at({}, { appBrowser: "brave" }), "Google Chrome", "the one kept is not here: as if none");
  const empty = path.join(w.dir, "no browsers");
  fs.mkdirSync(empty);
  assert.equal(appWindow(new Settings({ ...w.env, STROM_APP_DIRS: empty }, {}), { ...w.env, STROM_APP_DIRS: empty }, "darwin").browser, undefined, "none here");
  // what the app says of its browser: a fixed word, anything else "other"
  assert.equal(browserKind("Safari"), "safari");
  assert.equal(browserKind("netscape"), "other");
  assert.equal(browserKind(""), undefined);
  const link = parseLink(`strom-research://new?app=${TOKEN}&browser=firefox`);
  assert.deepEqual(link, { action: "new", app: TOKEN, browser: "firefox" });
  assert.equal(linkText(link as Exclude<typeof link, { action: "menu" }>), `strom-research://new?app=${TOKEN}&browser=firefox`);
  assert.deepEqual(parseLink(`strom-research://new?app=${TOKEN}&browser=%3Cscript%3E`), { action: "new", app: TOKEN, browser: "other" });
  assert.deepEqual(parseLink(`strom-research://new?app=${TOKEN}`), { action: "new", app: TOKEN }, "an older app says none");
  // the tree's file of a move named in the link (the app's 3.9.1): its one shape only, never a path
  const moving = parseLink(`strom-research://new?app=${TOKEN}&browser=safari&file=strom-prenos-UHJlbm9z.json`);
  assert.deepEqual(moving, { action: "new", app: TOKEN, browser: "safari", file: "strom-prenos-UHJlbm9z.json" });
  assert.equal(linkText(moving as Exclude<typeof moving, { action: "menu" }>), `strom-research://new?app=${TOKEN}&browser=safari&file=strom-prenos-UHJlbm9z.json`);
  assert.deepEqual(parseLink(`strom-research://new?app=${TOKEN}&file=..%2F..%2Fetc%2Fpasswd`), { action: "new", app: TOKEN });
  // the app on a phone or tablet (its 3.9.1): no browser of this computer — it moves
  assert.deepEqual(parseLink(`strom-research://new?app=${TOKEN}&browser=mobile`), { action: "new", app: TOKEN, browser: "mobile" });
  assert.equal(kindReaches("mobile"), false);
  w.cleanup();
});

test("the tree's file of a move: by the name the app gave it (a browser's second copy too), else any JSON of a day that carries its mark — never another tree's", () => {
  const w = new World();
  const downloads = path.join(w.env.HOME!, "Downloads");
  const old = new Date(Date.now() - 3 * 24 * 60 * 60_000);
  transferFile(w, "strom-prenos-UHJlbm9z.json", "SmluYS1zdHJvbS16LWppbmVoby1wcm9obGl6ZWNlMDE");
  const second = transferFile(w, "strom-prenos-UHJlbm9z (1).json", TOKEN, "Novákovi {domov}", old);
  assert.equal(findTransfer(TOKEN, [downloads], "strom-prenos-UHJlbm9z.json")?.file, second, "the copy of that name with its mark, though days old");
  const mark = transferMark(second)!;
  assert.deepEqual(mark, { token: TOKEN, tree: "Novákovi {domov}", persons: 2, from: "safari" }, "braces in the name");
  fs.rmSync(second);
  assert.equal(findTransfer(TOKEN, [downloads], "strom-prenos-UHJlbm9z.json"), undefined, "another tree's file is never taken");
  const renamed = transferFile(w, "strom-záloha.json");
  assert.equal(findTransfer(TOKEN, [downloads], "strom-prenos-UHJlbm9z.json")?.file, renamed, "any JSON of a day with its mark");
  fs.utimesSync(renamed, old, old);
  assert.equal(findTransfer(TOKEN, [downloads]), undefined, "an older one only by its name");
  // Safari took the JSON for text, or it came from a phone (AirDrop into Downloads): .json.txt
  const txt = transferFile(w, "strom-prenos-UHJlbm9z (1).json.txt", TOKEN, "Novákovi {domov}", old);
  assert.equal(findTransfer(TOKEN, [downloads], "strom-prenos-UHJlbm9z.json")?.file, txt, ".json.txt by its name");
  fs.rmSync(txt);
  fs.rmSync(renamed);
  const phone = transferFile(w, "Novákovi.json.txt");
  assert.equal(findTransfer(TOKEN, [downloads], "strom-prenos-UHJlbm9z.json")?.file, phone, "any .json.txt of a day with its mark");
  w.cleanup();
});

test("a tree from Safari moves to a browser the app reaches strom from — asked with its name, people and the browser; no: nothing set up; yes: the bridge gives the app its file (GET /transfer) and the tree comes in; that browser kept", opts, async () => {
  const w = new World();
  w.env.PATH = [path.dirname(process.execPath), "/usr/bin", "/bin"].join(path.delimiter);
  w.env.STROM_ADOPT_WAIT_MS = "60000";
  await w.ok(["setup", "--yes"]);
  await w.ok(["config", "set", "strom.app.url", "https://beta.stromapp.info/run/"]);
  w.env.STROM_APP_DIRS = browsers(w, "Google Chrome.app", "Microsoft Edge.app", "Safari.app");
  w.env.STROM_FROM_FILE = "strom-prenos-UHJlbm9z.json";
  const file = transferFile(w, "strom-prenos-UHJlbm9z 2.json");
  const link = `strom-research://new?app=${TOKEN}&browser=safari`;
  // no: the tree stays in Safari, nothing made — and the end (Enter)
  const no = await w.run(["link", "open", link], { tty: true, answers: ["0", ""] });
  assert.match(no.out, /Soubor stromu z aplikace Strom: .*strom-prenos-UHJlbm9z 2\.json/);
  assert.match(no.out, /Do kterého prohlížeče se strom „Novákovi \{domov\}“ \(osob: 2\) přenese\?\n\s+1\s+Google Chrome\n\s+2\s+Microsoft Edge\n\s+0\s+Nepřenášet/);
  assert.match(no.out, /Strom zůstává v Safari, nic se nezaložilo\.\nSoubor stromu zůstává na místě: .*strom-prenos-UHJlbm9z 2\.json/);
  assert.equal(fs.existsSync(w.treeDir("Novákovi {domov}")), false, "nothing set up");
  assert.equal(readJsonFile(path.join(w.env.STROM_CONFIG_DIR!, "config.json")).appBrowser, undefined);
  assert.ok(fs.existsSync(file), "the file stays where it is");
  // the system's default browser suggested first (Windows: Edge)
  const edgeFirst = await w.run(["link", "open", link], { tty: true, answers: ["0", ""], env: { STROM_DEFAULT_BROWSER: "edge" } });
  assert.match(edgeFirst.out, /přenese\?\n\s+1\s+Microsoft Edge\n\s+2\s+Google Chrome\n\s+0\s+Nepřenášet/);
  // yes, to Edge: the research named as the tree, the bridge waits with the tree's file
  const root = w.treeDir("Novákovi {domov}");
  const flow = w.run(["link", "open", link], { tty: true, answers: ["2", "", "", "n", ""] });
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
    const asked = (await (await fetch(`${url}/adopt`, { headers: ORIGIN })).json()) as { token: string; transfer?: boolean; until?: string };
    assert.equal(asked.token, TOKEN);
    assert.equal(asked.transfer, true);
    assert.ok(Date.parse(asked.until!) - Date.now() > 50 * 60_000, "it waits an hour");
    const given = await fetch(`${url}/transfer`, { headers: ORIGIN });
    assert.equal(given.status, 200);
    assert.equal(given.headers.get("access-control-allow-origin"), "https://beta.stromapp.info");
    assert.match(given.headers.get("content-type") ?? "", /^application\/json/);
    assert.equal(await given.text(), fs.readFileSync(file, "utf8"), "the file as it came");
    const status = (await (await fetch(`${url}/status`, { headers: ORIGIN })).json()) as { features: string[] };
    assert.ok(status.features.includes("adopt.transfer"));
    // the app in Edge hands the tree over as from any browser
    const ged = ["0 HEAD", "1 SOUR STROM", "1 GEDC", "2 VERS 5.5.1", "1 CHAR UTF-8", "0 @I1@ INDI", "1 NAME Karel /Novák/", "1 SEX M", "0 @I2@ INDI", "1 NAME Marie /Nováková/", "1 SEX F", "0 @F1@ FAM", "1 HUSB @I1@", "1 WIFE @I2@", "0 TRLR", ""].join("\n");
    assert.equal((await fetch(`${url}/adopt`, { method: "POST", body: ged, headers: { ...ORIGIN, "Content-Type": "text/plain; charset=utf-8" } })).status, 200);
    const r = await flow;
    assert.match(r.out, /osob 2, rodin 1/);
    assert.equal((await fetch(`${url}/transfer`, { headers: ORIGIN })).status, 404, "handed over: no more");
    assert.match(r.out, /Strom je teď ve výzkumu i v prohlížeči; jeho soubor šel do koše: .*strom-prenos-UHJlbm9z 2\.json/);
    assert.equal(fs.existsSync(file), false, "the file of the move in the trash");
    assert.ok(fs.existsSync(path.join(w.env.STROM_TRASH!, "strom-prenos-UHJlbm9z 2.json")));
    assert.equal(readJsonFile(path.join(w.env.STROM_CONFIG_DIR!, "config.json")).appBrowser, "edge", "the app opens in Edge from now on");
  } finally {
    await w.run(["live", "stop"], { cwd: root });
  }
  assert.ok(BRIDGE_FEATURES.includes("adopt.transfer"));
  w.cleanup();
});

test("a tree from Safari with no browser here the app reaches strom from: a download page (nothing installed), or the research made from the tree's file — what that means said first", opts, async () => {
  const w = new World();
  w.env.PATH = [path.dirname(process.execPath), "/usr/bin", "/bin"].join(path.delimiter);
  await w.ok(["setup", "--yes"]);
  w.env.STROM_APP_DIRS = browsers(w, "Safari.app");
  w.env.STROM_FROM_BROWSER = "safari";
  transferFile(w, "strom-prenos-UHJlbm9z.json");
  const r = await w.run(["link", "open", `strom-research://new?app=${TOKEN}`], { tty: true, answers: ["1", "", "3", "", "", "n", ""] });
  assert.match(r.out, /Na tomto počítači není prohlížeč, ze kterého se aplikace Strom k výzkumu připojí\./);
  assert.match(r.out, /1\s+Otevřít stránku ke stažení Google Chrome \(nic se neinstaluje samo\)\n\s+2\s+Otevřít stránku ke stažení Microsoft Edge/);
  // the page (not opened in a test: its address), then looked for again — still none
  assert.match(r.out, /https:\/\/www\.google\.com\/chrome\//);
  assert.match(r.out, /Po instalaci prohlížeče \(toto okno zatím nechat otevřené\): Enter pokračuje/);
  assert.match(r.out, /Aplikace v Safari se k výzkumu nepřipojí: nic z aplikace nepůjde živě – ani výzkum, ani archiv\..*fotky touto cestou nejdou\..*strom app/s);
  assert.match(r.out, /Plné spojení je jen přes Chrome, Edge, Brave nebo Firefox: po instalaci některého z nich strom app/);
  assert.match(r.out, /✓ Rodokmen je ve výzkumu „Novákovi \{domov\}“: osob 2, rodin 1/);
  const root = w.treeDir("Novákovi {domov}");
  const people = (await w.ok(["person", "list", "--json"], { cwd: root })).json.persons as { name: string }[];
  assert.deepEqual(people.map((p) => p.name).sort(), ["Karel Novák", "Marie Nováková"]);
  assert.equal(fs.existsSync(path.join(root, ".strom", "adopt.json")), false, "no bridge waits");
  // later, Chrome installed: strom app opens the research there — the move finished, Chrome kept for the app (D10)
  w.env.STROM_APP_DIRS = browsers(w, "Safari.app", "Google Chrome.app");
  const later = await w.run(["app"], { cwd: root });
  assert.match(later.out, /Strom výzkumu se otevírá v Google Chrome: přenos stromu je tím dokončený.*Fotky stromu ve výzkumu nejsou – zůstaly v Safari a v souboru .*strom-prenos-UHJlbm9z\.json/s);
  assert.equal(readJsonFile(path.join(w.env.STROM_CONFIG_DIR!, "config.json")).appBrowser, "chrome");
  assert.doesNotMatch((await w.run(["app"], { cwd: root })).out, /přenos stromu/, "said once");
  await w.run(["live", "stop"], { cwd: root });
  w.cleanup();
});

test("a tree from a browser the app reaches strom from: that browser kept for the app (app.browser); a move is never made without a person", opts, async () => {
  const w = new World();
  w.env.PATH = [path.dirname(process.execPath), "/usr/bin", "/bin"].join(path.delimiter);
  w.env.STROM_ADOPT_WAIT_MS = "1500";
  await w.ok(["setup", "--yes"]);
  w.env.STROM_APP_DIRS = browsers(w, "Google Chrome.app", "Microsoft Edge.app");
  const r = await w.run(["link", "open", `strom-research://new?app=${TOKEN}&browser=edge`], { tty: true, answers: ["Dvořákovi", "", ""] });
  assert.match(r.out, /Z aplikace Strom do 1 min žádný strom nepřišel/);
  assert.equal(readJsonFile(path.join(w.env.STROM_CONFIG_DIR!, "config.json")).appBrowser, "edge");
  await w.run(["live", "stop"], { cwd: w.treeDir("Dvořákovi") });
  // no terminal: nothing moves
  w.env.STROM_FROM_BROWSER = "safari";
  transferFile(w, "strom-prenos-UHJlbm9z.json");
  const quiet = await w.run(["link", "open", `strom-research://new?app=${TOKEN}`], { tty: true, answers: [], env: { STROM_NONINTERACTIVE: "1" } });
  assert.match(quiet.out, /Přenos stromu potřebuje odpověď člověka v terminálu, nic se nezaložilo\./);
  assert.equal(fs.existsSync(w.treeDir("Novákovi {domov}")), false);
  w.cleanup();
});

test("a tree from Safari into a research an older strom made for it (its handover never came): added there, nothing set up again; the app not heard from — the browser's permission for the local network said", opts, async () => {
  const w = new World();
  w.env.PATH = [path.dirname(process.execPath), "/usr/bin", "/bin"].join(path.delimiter);
  w.env.STROM_ADOPT_WAIT_MS = "1500";
  w.env.STROM_ADOPT_HINT_MS = "300";
  await w.ok(["setup", "--yes"]);
  w.env.STROM_APP_DIRS = browsers(w, "Google Chrome.app", "Safari.app");
  // installed from the app 3.9.0 in Safari: the research made, the app in Chrome never had the tree
  const first = await w.run(["link", "open", "strom-research://new?app=U3RhcnN5LXN0cm9tLXphLXNhZmFyaS0wMDAwMDAwMDE"], { tty: true, answers: ["Novákovi", "", ""] });
  assert.match(first.out, /Z aplikace Strom do 1 min žádný strom nepřišel\. Výzkum „Novákovi“ tu je, zatím prázdný\.\nAplikace Strom se k výzkumu zatím nepřipojila\. Možná příčina: Google Chrome jí zablokoval přístup k aplikacím na tomto zařízení\. Povolit to jde ikonou vlevo od adresy → Aplikace na zařízení \(anglicky Apps on device/);
  const root = w.treeDir("Novákovi");
  await w.run(["live", "stop"], { cwd: root });
  // the line of the app 3.9.1 in Safari: the tree moves — into that research
  w.env.STROM_ADOPT_WAIT_MS = "60000";
  w.env.STROM_FROM_BROWSER = "safari";
  w.env.STROM_FROM_FILE = "strom-prenos-UHJlbm9z.json";
  const file = transferFile(w, "strom-prenos-UHJlbm9z.json");
  const flow = w.run(["link", "open", `strom-research://new?app=${TOKEN}`], { tty: true, answers: ["", "", "n", ""] });
  let url = "";
  for (let i = 0; i < 100 && !url; i++) {
    await new Promise((r) => setTimeout(r, 100));
    try {
      const live = JSON.parse(fs.readFileSync(path.join(root, ".strom", "live.json"), "utf8")) as { url: string; pid: number };
      if ((await fetch(`${live.url}/adopt`, { headers: ORIGIN }).catch(() => undefined))?.status === 200) url = live.url;
    } catch {
      // not yet
    }
  }
  try {
    assert.ok(url, "the bridge of that research waits");
    assert.equal(((await (await fetch(`${url}/adopt`, { headers: ORIGIN })).json()) as { token: string }).token, TOKEN);
    const ged = ["0 HEAD", "1 SOUR STROM", "1 CHAR UTF-8", "0 @I1@ INDI", "1 NAME Karel /Novák/", "1 SEX M", "0 @I2@ INDI", "1 NAME Marie /Nováková/", "1 SEX F", "0 @F1@ FAM", "1 HUSB @I1@", "1 WIFE @I2@", "0 TRLR", ""].join("\n");
    assert.equal((await fetch(`${url}/adopt`, { method: "POST", body: ged, headers: { ...ORIGIN, "Content-Type": "text/plain; charset=utf-8" } })).status, 200);
    const r = await flow;
    assert.match(r.out, /Výzkum „Novákovi“ \(založený [^)]+\) strom z aplikace Strom zatím nedostal\. Přidat strom do něj\?\n\s+1\s+Do výzkumu „Novákovi“\n\s+2\s+Založit nový výzkum\n\s+0\s+Zrušit/);
    assert.doesNotMatch(r.out, /Název výzkumu/, "nothing set up again");
    assert.doesNotMatch(r.out, /zablokoval přístup/, "the app asked: no word of a permission");
    assert.match(r.out, /✓ Rodokmen je ve výzkumu „Novákovi“: osob 2, rodin 1/);
    assert.equal(fs.existsSync(w.treeDir("Novákovi {domov}")), false, "no second research");
    assert.equal(fs.existsSync(file), false, "the file in the trash");
  } finally {
    await w.run(["live", "stop"], { cwd: root });
  }
  w.cleanup();
});

test("the app not heard from: the permission named as the browser it opened in names it (Edge 154: Apps on device; Firefox; Brave: localhost)", opts, async () => {
  const w = new World();
  w.env.PATH = [path.dirname(process.execPath), "/usr/bin", "/bin"].join(path.delimiter);
  w.env.STROM_ADOPT_WAIT_MS = "800";
  w.env.STROM_ADOPT_HINT_MS = "200";
  await w.ok(["setup", "--yes"]);
  w.env.STROM_APP_DIRS = browsers(w, "Google Chrome.app", "Microsoft Edge.app", "Firefox.app", "Brave Browser.app");
  const edge = await w.run(["link", "open", `strom-research://new?app=${TOKEN}&browser=edge`], { tty: true, answers: ["Dvořákovi", "", ""] });
  assert.match(edge.out, /Možná příčina: Microsoft Edge jí zablokoval přístup k aplikacím na tomto zařízení\. Povolit to jde ikonou vlevo od adresy → Aplikace na zařízení \(anglicky Apps on device; ve starších verzích Přístup k místní síti\) → Povolit/);
  await w.run(["live", "stop"], { cwd: w.treeDir("Dvořákovi") });
  // another one waits for its tree: a new research here (2)
  const ff = await w.run(["link", "open", "strom-research://new?app=Rmlyb2ZveC1zdHJvbS16a3VzZWJuaTAx&browser=firefox"], { tty: true, answers: ["2", "Novákovi", "", ""] });
  assert.match(ff.out, /Možná příčina: Firefox jí zablokoval přístup k aplikacím a službám na tomto zařízení\./);
  await w.run(["live", "stop"], { cwd: w.treeDir("Novákovi") });
  const brave = await w.run(["link", "open", "strom-research://new?app=QnJhdmUtc3Ryb20temt1c2VibmkwMQ&browser=brave"], { tty: true, answers: ["2", "Svobodovi", "", ""] });
  assert.match(brave.out, /Možná příčina: Brave jí zablokoval přístup k localhostu\. Povolit to jde ikonou vlevo od adresy → Přístup k localhostu \(anglicky Localhost access\)/);
  await w.run(["live", "stop"], { cwd: w.treeDir("Svobodovi") });
  w.cleanup();
});

test("the browser kept for the app is gone (uninstalled): said, and the one it opens in now kept instead", opts, async () => {
  const w = new World();
  await w.ok(["setup", "--yes"]);
  const dirs = browsers(w, "Google Chrome.app", "Safari.app");
  const env = { ...w.env, STROM_APP_DIRS: dirs };
  assert.equal(appWindow(new Settings(env, {}), env, "darwin").gone, undefined, "nothing kept: nothing gone");
  await w.ok(["config", "set", "app.browser", "brave"]);
  const settings = new Settings(env, {});
  const win = appWindow(settings, env, "darwin");
  assert.equal(win.browser?.name, "Google Chrome");
  assert.equal(win.gone, "brave");
  assert.deepEqual(replaceGone(settings, win), { gone: "Brave", now: "Google Chrome" });
  assert.equal(readJsonFile(path.join(w.env.STROM_CONFIG_DIR!, "config.json")).appBrowser, "chrome");
  assert.equal(appWindow(new Settings(env, {}), env, "darwin").gone, undefined, "replaced");
  // said for one command (env) only: never taken for gone
  assert.equal(appWindow(new Settings({ ...env, STROM_APP_BROWSER: "edge" }, {}), { ...env, STROM_APP_BROWSER: "edge" }, "darwin").gone, undefined);
  // none here that reaches strom: said, nothing changed
  const env2 = { ...w.env, STROM_APP_DIRS: path.join(w.dir, "Applications only Safari") };
  fs.mkdirSync(path.join(env2.STROM_APP_DIRS, "Safari.app"), { recursive: true });
  const s2 = new Settings(env2, {});
  const w2 = appWindow(s2, env2, "darwin");
  assert.equal(w2.gone, "chrome");
  assert.deepEqual(replaceGone(s2, w2), { gone: "Google Chrome" });
  assert.equal(readJsonFile(path.join(w.env.STROM_CONFIG_DIR!, "config.json")).appBrowser, "chrome", "kept");
  w.cleanup();
});

test("a tree from a phone or tablet: the file alone means a move, whatever the line says of the browser (it may lose it on Windows); its mark's from: \"mobile\" said as the phone or tablet", opts, async () => {
  const w = new World();
  w.env.PATH = [path.dirname(process.execPath), "/usr/bin", "/bin"].join(path.delimiter);
  await w.ok(["setup", "--yes"]);
  w.env.STROM_APP_DIRS = browsers(w, "Google Chrome.app");
  w.env.STROM_FROM_FILE = "strom-prenos-UHJlbm9z.json";
  const file = transferFile(w, "strom-prenos-UHJlbm9z.json", TOKEN, "Novákovi {domov}", undefined, "mobile");
  // no browser in the line: the file's mark says where it comes from
  const r = await w.run(["link", "open", `strom-research://new?app=${TOKEN}`], { tty: true, answers: ["0", ""] });
  assert.match(r.out, /Strom „Novákovi \{domov\}“ \(osob: 2\) se přenese do Google Chrome a dál se bude pracovat tam\. Přenést\?/);
  assert.match(r.out, /Strom zůstává v telefonu nebo tabletu, nic se nezaložilo\./);
  assert.ok(fs.existsSync(file));
  // a browser that reaches strom in the line and the file: still a move (the file is the tree)
  w.env.STROM_FROM_BROWSER = "chrome";
  const again = await w.run(["link", "open", `strom-research://new?app=${TOKEN}`], { tty: true, answers: ["0", ""] });
  assert.match(again.out, /se přenese do Google Chrome/);
  assert.equal(fs.existsSync(w.treeDir("Novákovi {domov}")), false, "nothing set up");
  // the line had no room for the app's address (Win + R, its beta): the file's mark carries it — that copy kept
  assert.equal(transferMark(transferFile(w, "strom-prenos-QXBwT25seQ.json", TOKEN, "x", undefined, "mobile", "https://example.com/run/"))?.app, undefined, "no copy of the app: none");
  fs.rmSync(path.join(w.env.HOME!, "Downloads", "strom-prenos-QXBwT25seQ.json"));
  fs.rmSync(file);
  transferFile(w, "strom-prenos-UHJlbm9z.json", TOKEN, "Novákovi {domov}", undefined, "mobile", "https://beta.stromapp.info/run/");
  w.env.STROM_ADOPT_WAIT_MS = "600";
  const yes = await w.run(["link", "open", `strom-research://new?app=${TOKEN}`], { tty: true, answers: ["1", "", "", "n", ""] });
  assert.match(yes.out, /https:\/\/beta\.stromapp\.info\/run\/\?adopt=/);
  assert.equal(readJsonFile(path.join(w.env.STROM_CONFIG_DIR!, "config.json")).stromAppUrl, "https://beta.stromapp.info/run/");
  await w.run(["live", "stop"], { cwd: w.treeDir("Novákovi {domov}") });
  w.cleanup();
});

/** The bridge of `root` once it is up (its address), else "". */
async function bridgeOf(root: string): Promise<string> {
  for (let i = 0; i < 100; i++) {
    await new Promise((r) => setTimeout(r, 100));
    try {
      return (JSON.parse(fs.readFileSync(path.join(root, ".strom", "live.json"), "utf8")) as { url: string }).url;
    } catch {
      // not yet
    }
  }
  return "";
}

test("the app hands no tree over (Nepředávat): the research made for it goes into the trash, nothing set up halfway — one made before stays (GET /adopt existing); the shortcut and the links said no to are not asked again by the next line", opts, async () => {
  const w = new World();
  w.env.PATH = [path.dirname(process.execPath), "/usr/bin", "/bin"].join(path.delimiter);
  w.env.STROM_ADOPT_WAIT_MS = "60000";
  await w.ok(["setup", "--yes"]);
  // installed from the app: its line's mark
  const token = "TmVwcmVkYXZhdC1zdHJvbS16LWFwbGlrYWNlLTAwMDE";
  w.env.STROM_FROM_APP = token;
  const root = w.treeDir("Dvořákovi");
  const declined = async (answers: string[]) => {
    const flow = w.run(["link", "open", `strom-research://new?app=${token}`], { tty: true, answers });
    const url = await bridgeOf(root);
    assert.ok(url, "the bridge of the research waits");
    const wait = (await (await fetch(`${url}/adopt`, { headers: ORIGIN })).json()) as { token: string; existing?: boolean };
    assert.equal(wait.token, token);
    assert.equal((await fetch(`${url}/cancel`, { method: "POST", body: JSON.stringify({ reason: "cancelled" }), headers: { ...ORIGIN, "Content-Type": "text/plain" } })).status, 200);
    return { r: await flow, existing: wait.existing };
  };
  const first = await declined(["n", "n", "Dvořákovi", "", ""]);
  assert.match(first.r.out, /Vytvořit na ploše zástupce „Strom výzkum“\?/);
  assert.equal(first.existing, undefined, "a new research");
  assert.match(first.r.out, /Aplikace Strom žádný strom nepředala, výzkum „Dvořákovi“ se tedy nezaložil \(jeho prázdná složka je v koši\)\. Začít znovu jde z aplikace\./);
  assert.equal(fs.existsSync(root), false, "nothing left halfway");
  assert.ok(fs.existsSync(path.join(w.env.STROM_TRASH!, "Dvořákovi")), "in the trash, never deleted for good");
  const cfg = readJsonFile(path.join(w.env.STROM_CONFIG_DIR!, "config.json"));
  assert.equal(cfg.shortcut, "no");
  assert.equal(cfg.links, "no");
  assert.notEqual(cfg.currentTree, root);
  assert.match((await w.ok(["doctor"])).out, /nechtěný \(strom setup se zeptá znovu\)/);
  // a research made before, still empty, of the same name: the tree goes into it, and it stays when nothing comes
  await w.ok(["init", "Dvořákovi"]);
  const again = await declined(["Dvořákovi", "", ""]);
  assert.doesNotMatch(again.r.out, /zástupce|Dovolit aplikaci Strom spouštět/, "a no is not asked again");
  assert.equal(again.existing, true, "the app says: into the research made before");
  assert.match(again.r.out, /Aplikace Strom žádný strom nepředala\. Výzkum „Dvořákovi“ tu je, zatím prázdný/);
  assert.ok(fs.existsSync(path.join(root, "strom.json")), "made before: kept");
  await w.run(["live", "stop"], { cwd: root });
  w.cleanup();
});

test("installed from the app with an agent here: the research with it suggested, an archive the other choice; 0 goes one step back, never ends it all", opts, async () => {
  const w = new World();
  const bin = path.join(w.dir, "bin");
  fs.mkdirSync(bin, { recursive: true });
  fs.writeFileSync(path.join(bin, "codex"), "#!/bin/sh\necho codex-cli 0.155.0\n", { mode: 0o755 });
  w.env.PATH = [bin, path.dirname(process.execPath), "/usr/bin", "/bin"].join(path.delimiter);
  w.env.STROM_ADOPT_WAIT_MS = "1500";
  await w.ok(["setup", "--yes"]);
  assert.notEqual(readJsonFile(path.join(w.env.STROM_CONFIG_DIR!, "config.json")).mode, "archive", "an agent here: research");
  // the name, the language, then 0 at the question: back to the language — then an archive
  const r = await w.run(["link", "open", `strom-research://new?app=${TOKEN}`], { tty: true, answers: ["Dvořákovi", "", "0", "", "1", ""] });
  const asked = r.out.match(/Spuštěno z aplikace Strom\. Jak má výzkum tento rodokmen vést\?\n\s+1\s+Jako archiv: .*\n\s+2\s+Jako výzkum s agentem OpenAI Codex CLI: .*\(doporučeno\)\n\s+0\s+Zpět/g) ?? [];
  assert.equal(asked.length, 2, "asked again after the step back");
  assert.equal((r.out.match(/Jazyk \(cs, en, de, pl, …\)/g) ?? []).length, 2, "0 went back to the language");
  const root = w.treeDir("Dvořákovi");
  assert.equal(readJsonFile(path.join(root, "strom.json")).mode, "archive");
  await w.run(["live", "stop"], { cwd: root });
  // 0 at the name: nothing set up
  const none = await w.run(["link", "open", `strom-research://new?app=${TOKEN}`], { tty: true, answers: ["0"] });
  assert.equal(none.code, 0);
  assert.equal(fs.existsSync(w.treeDir("Moje rodina")), false);
  w.cleanup();
});

test("installed from the app with no agent here: an archive, nothing asked — also when the setup was run while an agent was here (N9)", opts, async () => {
  const w = new World();
  const bin = path.join(w.dir, "bin");
  fs.mkdirSync(bin, { recursive: true });
  fs.writeFileSync(path.join(bin, "codex"), "#!/bin/sh\necho codex-cli 0.155.0\n", { mode: 0o755 });
  w.env.PATH = [bin, path.dirname(process.execPath), "/usr/bin", "/bin"].join(path.delimiter);
  w.env.STROM_ADOPT_WAIT_MS = "1500";
  await w.ok(["setup", "--yes"]);
  assert.notEqual(readJsonFile(path.join(w.env.STROM_CONFIG_DIR!, "config.json")).mode, "archive", "set up with an agent: research");
  // the agent gone since
  fs.rmSync(bin, { recursive: true });
  const r = await w.run(["link", "open", `strom-research://new?app=${TOKEN}`], { tty: true, answers: ["Dvořákovi", "", ""] });
  assert.doesNotMatch(r.out, /Jak má výzkum tento rodokmen vést\?/, "nothing asked");
  const root = w.treeDir("Dvořákovi");
  assert.equal(readJsonFile(path.join(root, "strom.json")).mode, "archive");
  await w.run(["live", "stop"], { cwd: root });
  w.cleanup();
});

test("a tree from Safari, its move said no to with a browser here, the research made from the file: the move is finished later in that browser — not once one is installed", opts, async () => {
  const w = new World();
  w.env.PATH = [path.dirname(process.execPath), "/usr/bin", "/bin"].join(path.delimiter);
  await w.ok(["setup", "--yes"]);
  w.env.STROM_APP_DIRS = browsers(w, "Google Chrome.app", "Safari.app");
  w.env.STROM_FROM_BROWSER = "safari";
  transferFile(w, "strom-prenos-UHJlbm9z.json");
  const r = await w.run(["link", "open", `strom-research://new?app=${TOKEN}`], { tty: true, answers: ["0", "1", "", "", ""] });
  assert.match(r.out, /Plné spojení je jen přes Chrome, Edge, Brave nebo Firefox a Google Chrome tu je: strom app \(v menu Aplikace Strom\) v něm kdykoli otevře výzkum a přenos se tím dokončí\./);
  assert.doesNotMatch(r.out, /po instalaci některého z nich/);
  assert.match(r.out, /✓ Rodokmen je ve výzkumu „Novákovi \{domov\}“: osob 2, rodin 1/);
  w.cleanup();
});

test("the app's line in one variable (STROM_FROM, Win + R's 259 characters): read as the five of an older line — the shape, the file's 8 characters, beta, the name after the fifth |; set, it alone counts", () => {
  const read = (env: Record<string, string | undefined>) => {
    expandFromLine(env);
    return Object.fromEntries(Object.entries(env).filter(([k]) => k !== "STROM_FROM"));
  };
  assert.deepEqual(read({ STROM_FROM: `1|${TOKEN}|edge|UHJlbm9z|beta|Dvořákovi O'Neill (zkouška)` }), {
    STROM_FROM_APP: TOKEN,
    STROM_FROM_BROWSER: "edge",
    STROM_FROM_FILE: "strom-prenos-UHJlbm9z.json",
    STROM_APP_URL: "https://beta.stromapp.info/run/",
    STROM_FROM_APP_NAME: "Dvořákovi O'Neill (zkouška)",
  });
  // empty fields where they are; the older line's five never mixed in; a name with a | of its own kept whole
  assert.deepEqual(read({ STROM_FROM: `1|${TOKEN}||||Novákovi | Dvořákovi`, STROM_APP_URL: "http://localhost:8765/run/", STROM_FROM_BROWSER: "chrome", STROM_FROM_APP_NAME: "Jiní" }), { STROM_FROM_APP: TOKEN, STROM_FROM_APP_NAME: "Novákovi | Dvořákovi" });
  assert.deepEqual(read({ STROM_FROM: `1|${TOKEN}|safari||http://localhost:8765/run/|` }), { STROM_FROM_APP: TOKEN, STROM_FROM_BROWSER: "safari", STROM_APP_URL: "http://localhost:8765/run/" });
  // a later shape: its fields before the name, the places of the rest the same
  assert.deepEqual(read({ STROM_FROM: `2|${TOKEN}|mobile|UHJlbm9z||x|y|Novákovi` }), { STROM_FROM_APP: TOKEN, STROM_FROM_BROWSER: "mobile", STROM_FROM_FILE: "strom-prenos-UHJlbm9z.json", STROM_FROM_APP_NAME: "Novákovi" });
  // without the shape (as first agreed): the file "1" is the one named after the mark, the name all after the fourth |
  assert.deepEqual(read({ STROM_FROM: `${TOKEN}|chrome|1||Novákovi` }), { STROM_FROM_APP: TOKEN, STROM_FROM_BROWSER: "chrome", STROM_FROM_FILE: `strom-prenos-${TOKEN.slice(0, 8)}.json`, STROM_FROM_APP_NAME: "Novákovi" });
  // no mark: nothing from the app (and nothing of an older line either)
  assert.deepEqual(read({ STROM_FROM: "1|krátký|edge|||Novákovi", STROM_FROM_APP: TOKEN }), {});
  // not set, or empty: the five as they are
  assert.deepEqual(read({ STROM_FROM_APP: TOKEN, STROM_FROM_BROWSER: "edge" }), { STROM_FROM_APP: TOKEN, STROM_FROM_BROWSER: "edge" });
  assert.deepEqual(read({ STROM_FROM: " ", STROM_FROM_APP: TOKEN }), { STROM_FROM_APP: TOKEN });
});

test("installed by the app's line in one variable (STROM_FROM): the tree's name suggested, the browser kept, the beta kept as the app", opts, async () => {
  const w = new World();
  w.env.PATH = [path.dirname(process.execPath), "/usr/bin", "/bin"].join(path.delimiter);
  w.env.STROM_ADOPT_WAIT_MS = "1500";
  await w.ok(["setup", "--yes"]);
  w.env.STROM_APP_DIRS = browsers(w, "Google Chrome.app", "Microsoft Edge.app");
  w.env.STROM_FROM = `1|${TOKEN}|edge||beta|Dvořákovi O'Neill`;
  const r = await w.run([], { tty: true, answers: ["n", "n", "", "", ""] });
  assert.match(r.out, /Název výzkumu \(rodina, např\. Novákovi\) \[Dvořákovi O'Neill\]/);
  assert.match(r.out, /https:\/\/beta\.stromapp\.info\/run\/\?adopt=/);
  const cfg = readJsonFile(path.join(w.env.STROM_CONFIG_DIR!, "config.json"));
  assert.equal(cfg.appBrowser, "edge");
  assert.equal(cfg.stromAppUrl, "https://beta.stromapp.info/run/");
  await w.run(["live", "stop"], { cwd: w.treeDir("Dvořákovi O'Neill") });
  w.cleanup();
});

test("a tree with no people yet is handed over (C1: installed from the app's start screen): the research stays empty, linked to the app, its first people come by a send; into a research made before too", opts, async () => {
  const w = new World();
  w.env.PATH = [path.dirname(process.execPath), "/usr/bin", "/bin"].join(path.delimiter);
  w.env.STROM_ADOPT_WAIT_MS = "60000";
  await w.ok(["setup", "--yes"]);
  const app = { ...ORIGIN, "Content-Type": "text/plain; charset=utf-8", "X-Strom-App-Version": "3.9.1" };
  const empty = ["0 HEAD", "1 SOUR STROM", "1 GEDC", "2 VERS 5.5.1", "1 CHAR UTF-8", "0 TRLR", ""].join("\n");
  const root = w.treeDir("Dvořákovi");
  const handed = async (answers: string[]) => {
    const flow = w.run(["link", "open", `strom-research://new?app=${TOKEN}`], { tty: true, answers });
    const url = await bridgeOf(root);
    assert.ok(url, "the bridge waits for the tree");
    const status = (await (await fetch(`${url}/status`, { headers: ORIGIN })).json()) as { features: string[] };
    assert.ok(status.features.includes("adopt.empty"), "the app knows it may hand an empty tree over");
    const res = await fetch(`${url}/adopt`, { method: "POST", body: empty, headers: app });
    assert.equal(res.status, 200);
    const got = (await res.json()) as { tree: string; head: string; empty?: boolean; ids: { persons: object } };
    assert.equal(got.empty, true);
    assert.match(got.head, /^[0-9a-f]{40}$/);
    assert.deepEqual(got.ids.persons, {});
    assert.equal((await fetch(`${url}/adopt`)).status, 410, "handed over: its link opened again waits for nothing");
    return { r: await flow, url, got };
  };
  const first = await handed(["Dvořákovi", "", "n", ""]);
  assert.match(first.r.out, /✓ Aplikace Strom předala strom, zatím prázdný: výzkum „Dvořákovi“ je s ní propojený\. Osoby přidané v aplikaci přijdou do výzkumu, až se odešlou\./);
  assert.doesNotMatch(first.r.out, /nemá žádné osoby|se nepodařilo/);
  assert.ok(fs.existsSync(path.join(root, "strom.json")), "the research made is kept, not put into the trash");
  assert.equal(readJsonFile(path.join(root, ".strom", "adopt.json")).app, "3.9.1");
  assert.match((await w.ok(["check"], { cwd: root })).out, /ok/);
  assert.equal((await w.run(["doctor"], { cwd: root })).code, 0);
  // the app's first person comes by a send, on the research's version it loaded
  const ged = await (await fetch(`${first.url}/tree.ged?app=3.9.1`, { headers: ORIGIN })).text();
  const sent = await fetch(`${first.url}/sync`, { method: "POST", body: ged.replace(/^0 TRLR/m, "0 @I1@ INDI\n1 NAME Karel /Dvořák/\n1 SEX M\n1 BIRT\n2 DATE 1901\n0 TRLR"), headers: app });
  assert.equal(sent.status, 200, await sent.clone().text());
  const people = (await w.ok(["person", "list", "--json"], { cwd: root })).json.persons as { name: string }[];
  assert.deepEqual(people.map((p) => p.name), ["Karel Dvořák"]);
  await w.run(["live", "stop"], { cwd: root });
  // D4: an empty research made before (its tree never came), handed an empty tree: into it, kept
  const other = w.treeDir("Novákovi");
  w.env.STROM_ADOPT_WAIT_MS = "1500";
  await w.run(["link", "open", `strom-research://new?app=${TOKEN.replace(/.$/, "3")}`], { tty: true, answers: ["Novákovi", "", "n", ""] });
  await w.run(["live", "stop"], { cwd: other });
  w.env.STROM_ADOPT_WAIT_MS = "60000";
  const flow = w.run(["link", "open", `strom-research://new?app=${TOKEN.replace(/.$/, "2")}`], { tty: true, answers: ["", "n", ""] });
  const url = await bridgeOf(other);
  const wait = (await (await fetch(`${url}/adopt`, { headers: ORIGIN })).json()) as { existing?: boolean };
  assert.equal(wait.existing, true);
  assert.equal((await fetch(`${url}/adopt`, { method: "POST", body: empty, headers: app })).status, 200);
  const r = await flow;
  assert.match(r.out, /zatím prázdný: výzkum „Novákovi“ je s ní propojený/);
  assert.ok(fs.existsSync(path.join(other, "strom.json")));
  assert.match((await w.ok(["check"], { cwd: other })).out, /ok/);
  await w.run(["live", "stop"], { cwd: other });
  w.cleanup();
});
