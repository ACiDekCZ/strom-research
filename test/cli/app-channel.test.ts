// The copy of the Strom app strom opens by itself goes with strom's channel: the beta of the research with the app's
// beta (https://beta.stromapp.info/run/), the releases with stromapp.info. strom.app.url (STROM_APP_URL) always wins.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { World, hasGit, readJsonFile } from "../helpers.ts";
import { Settings } from "../../src/core/config.ts";
import { adoptAppUrl, appOpensLinks, appUrlSetting, defaultAppUrl, importAppUrl, liveAppUrl, sendAppUrl, STROM_APP_BETA_URL, STROM_APP_URL, stromAppUrl } from "../../src/core/stromapp.ts";

test("the default copy of the app: the beta channel's its beta, the releases' stromapp.info; the setting wins both ways", () => {
  assert.equal(defaultAppUrl({}), STROM_APP_URL);
  assert.equal(defaultAppUrl({ STROM_CHANNEL: "stable" }), STROM_APP_URL);
  assert.equal(defaultAppUrl({ STROM_CHANNEL: "beta" }), STROM_APP_BETA_URL);
  assert.equal(STROM_APP_BETA_URL, "https://beta.stromapp.info/run/");
  assert.equal(stromAppUrl(new Settings({ STROM_CHANNEL: "beta" }, {}, {})), STROM_APP_BETA_URL);
  assert.equal(stromAppUrl(new Settings({}, {}, {})), STROM_APP_URL);
  assert.equal(stromAppUrl(new Settings({ STROM_CHANNEL: "beta" }, {}, { stromAppUrl: STROM_APP_URL })), STROM_APP_URL, "the setting wins on the beta");
  assert.equal(stromAppUrl(new Settings({}, {}, { stromAppUrl: STROM_APP_BETA_URL })), STROM_APP_BETA_URL, "the setting wins on the releases");
  assert.equal(stromAppUrl(new Settings({ STROM_CHANNEL: "beta", STROM_APP_URL: "http://127.0.0.1:8080/" }, {}, {})), "http://127.0.0.1:8080/", "STROM_APP_URL wins");
  // the app's beta is a beta copy: what the gates give such copies at once, the beta channel gets at once
  assert.equal(appOpensLinks(new Settings({ STROM_CHANNEL: "beta" }, {}, {})), true);
});

test("strom app and config get: the beta channel opens the app's beta, the releases stromapp.info, an explicit setting either way", async () => {
  const w = new World();
  await w.ok(["setup", "--yes"]);
  const cfg = () => readJsonFile(path.join(w.env.STROM_CONFIG_DIR!, "config.json"));
  const beta = { STROM_CHANNEL: "beta" };
  assert.equal((await w.ok(["app", "--json"], { env: beta })).json.url, "https://beta.stromapp.info/run/");
  assert.equal((await w.ok(["app", "--json"])).json.url, "https://stromapp.info/run/");
  assert.deepEqual((await w.ok(["config", "get", "strom.app.url", "--json"], { env: beta })).json, { key: "strom.app.url", value: "https://beta.stromapp.info/run/", source: "default" });
  assert.equal((await w.ok(["config", "get", "strom.app.url"])).out.trim(), "https://stromapp.info/run/");
  // set explicitly: kept on either channel
  await w.ok(["config", "set", "strom.app.url", "https://stromapp.info/run/"]);
  assert.equal(cfg().stromAppUrl, "https://stromapp.info/run/");
  assert.equal((await w.ok(["app", "--json"], { env: beta })).json.url, "https://stromapp.info/run/");
  await w.ok(["config", "set", "strom.app.url", "https://beta.stromapp.info/run/"]);
  assert.equal((await w.ok(["app", "--json"])).json.url, "https://beta.stromapp.info/run/");
  // back to the default: the channel's again
  await w.ok(["config", "unset", "strom.app.url"]);
  assert.equal((await w.ok(["app", "--json"])).json.url, "https://stromapp.info/run/");
  assert.equal((await w.ok(["app", "--json"], { env: beta })).json.url, "https://beta.stromapp.info/run/");
  w.cleanup();
});

test("strom help app names the copy strom app opens: the beta channel's its beta, the releases stromapp.info and nothing of a beta, an explicit setting either way (B1-a)", async () => {
  const w = new World();
  await w.ok(["setup", "--yes"]);
  const beta = { STROM_CHANNEL: "beta" };
  const web = (out: string) => out.match(/Web: (\S+)/)?.[1];
  for (const asked of [["help", "app"], ["app", "--help"]]) {
    assert.equal(web((await w.ok(asked, { env: beta })).out), "https://beta.stromapp.info/run/", asked.join(" "));
    const stable = (await w.ok(asked)).out;
    assert.equal(web(stable), "https://stromapp.info/run/", asked.join(" "));
    assert.doesNotMatch(stable, /beta/i, `${asked.join(" ")}: the releases say nothing of a beta`);
  }
  const described = async (env?: Record<string, string>) => ((await w.ok(["commands", "app", "--json"], env ? { env } : {})).json.commands as { command: string; description?: string }[]).find((c) => c.command === "app")!.description!;
  assert.match(await described(beta), /Web: https:\/\/beta\.stromapp\.info\/run\/$/);
  assert.match(await described(), /Web: https:\/\/stromapp\.info\/run\/$/);
  await w.ok(["config", "set", "strom.app.url", "https://stromapp.info/run/"]);
  assert.equal(web((await w.ok(["help", "app"], { env: beta })).out), "https://stromapp.info/run/", "the setting wins on the beta");
  w.cleanup();
});

test("an invalid strom.app.url never stops the help: help, app --help and commands --json name the channel's copy of the app and say the setting is invalid; strom app refuses it (B1-b)", async () => {
  const w = new World();
  await w.ok(["setup", "--yes"]);
  const web = (out: string) => out.match(/Web: (\S+)/)?.[1];
  const said = /strom\.app\.url .*no address of the Strom app/;
  for (const bad of ["not a url", "https://example.org/strom/"])
    for (const [env, url] of [[{ STROM_APP_URL: bad }, "https://stromapp.info/run/"], [{ STROM_APP_URL: bad, STROM_CHANNEL: "beta" }, "https://beta.stromapp.info/run/"]] as const) {
      for (const asked of [["help"], ["help", "person"], ["help", "app"], ["app", "--help"]]) {
        const r = await w.run(asked, { env });
        assert.equal(r.code, 0, `${asked.join(" ")} (${bad}): ${r.err}`);
      }
      for (const asked of [["help", "app"], ["app", "--help"]]) {
        const out = (await w.ok(asked, { env })).out;
        assert.equal(web(out), url, asked.join(" "));
        assert.match(out, said, asked.join(" "));
        if (!env.STROM_CHANNEL) assert.doesNotMatch(out, /beta/i, `${asked.join(" ")}: the releases say nothing of a beta`);
      }
      const json = (await w.ok(["commands", "--json"], { env })).json;
      const app = (json.commands as { command: string; description?: string }[]).find((c) => c.command === "app")!;
      assert.match(app.description!, new RegExp(`Web: ${url.replace(/[./]/g, "\\$&")}`));
      assert.match(app.description!, said);
      assert.deepEqual(json.invalid, ["strom.app.url"]);
      // strom app itself refuses it, as before
      const opened = await w.run(["app", "--json"], { env });
      assert.equal(opened.code, 2);
      assert.match(opened.out + opened.err, /invalid strom\.app\.url/);
    }
  // a valid one: nothing said of it
  const json = (await w.ok(["commands", "--json"])).json;
  assert.equal(json.invalid, undefined);
  assert.doesNotMatch((await w.ok(["help", "app"])).out, said);
  w.cleanup();
});

test("doctor never fails on strom.app.url: an invalid one (STROM_APP_URL, or written by hand into the settings) is one problem among its checks, with the way to put it right", async () => {
  const w = new World();
  await w.ok(["setup", "--yes"]);
  const file = path.join(w.env.STROM_CONFIG_DIR!, "config.json");
  const before = await w.run(["doctor", "--json"]);
  assert.equal(before.code, 0, JSON.stringify(before.json.checks.filter((c: { status: string }) => c.status === "fail")));
  const names = (r: { json: { checks: { name: string }[] } }) => r.json.checks.map((c) => c.name);
  assert.equal(before.json.checks.find((c: { name: string }) => c.name === "appurl"), undefined, "a valid setting: nothing said");
  for (const bad of ["https://evil.example/run/", "not a url"]) {
    for (const how of ["env", "config"] as const) {
      const env: Record<string, string> = how === "env" ? { STROM_APP_URL: bad } : {};
      if (how === "config") fs.writeFileSync(file, JSON.stringify({ ...readJsonFile(file), stromAppUrl: bad }, null, 2));
      const r = await w.run(["doctor", "--json"], { env });
      assert.equal(r.code, 1, `${how} ${bad}: ${r.err}`);
      // every other check made as without it
      assert.deepEqual(names(r).filter((n) => n !== "appurl"), names(before), `${how} ${bad}`);
      const said = r.json.checks.find((c: { name: string }) => c.name === "appurl");
      assert.equal(said.status, "fail");
      assert.ok(said.detail.includes(bad), said.detail);
      if (how === "config") assert.match(said.fix, /strom config set strom\.app\.url <\S+> · strom config unset strom\.app\.url/);
      else {
        assert.match(said.detail, /STROM_APP_URL/);
        // what to do, as for the settings: the variable named, set right or removed — the releases' pages only (B1-f)
        assert.match(said.fix, /STROM_APP_URL .*https:\/\/stromapp\.info\/run\/.*127\.0\.0\.1/);
        assert.doesNotMatch(said.fix, /beta/i);
        assert.match((await w.run(["doctor", "--lang", "en"], { env })).out, /→ the variable STROM_APP_URL set to an address of the Strom app \(https:\/\/stromapp\.info\/run\/, or a copy on this computer http:\/\/127\.0\.0\.1:<port>\/\), or removed/);
      }
      const text = await w.run(["doctor"], { env });
      assert.equal(text.code, 1, text.err);
      assert.ok(text.out.includes(bad), text.out);
      assert.doesNotMatch(text.err, /invalid strom\.app\.url/);
      // --fix says it, puts nothing of it right itself
      assert.equal((await w.run(["doctor", "--fix", "--json"], { env })).code, 1);
      if (how === "config") {
        await w.ok(["config", "unset", "strom.app.url"]);
        assert.equal((await w.run(["doctor", "--json"])).json.checks.find((c: { name: string }) => c.name === "appurl"), undefined);
      }
    }
  }
  // the beta channel names its beta among the pages (last: a switch of the channel is said by the next run)
  const beta = (await w.run(["doctor", "--json"], { env: { STROM_APP_URL: "not a url", STROM_CHANNEL: "beta" } })).json.checks.find((c: { name: string }) => c.name === "appurl");
  assert.match(beta.fix, /https:\/\/beta\.stromapp\.info\/run\//);
  w.cleanup();
});

test("strom.app.url is checked when read, as strom config set checks it: one written by hand into the settings (or in STROM_APP_URL) that is no address of the Strom app is refused — nothing opened, no address built on it with the bridge's secret; a copy of the app still works (B1-c)", { skip: !hasGit || process.platform === "win32" }, async () => {
  const unit = (cfg: Record<string, string>, env: Record<string, string> = {}) => new Settings(env, {}, cfg);
  for (const bad of ["https://evil.example/run/", "not a url", "javascript:alert(1)"]) {
    for (const s of [unit({ stromAppUrl: bad }), unit({}, { STROM_APP_URL: bad })]) {
      assert.throws(() => stromAppUrl(s), /invalid strom\.app\.url/);
      assert.throws(() => liveAppUrl("http://127.0.0.1:1/" + "a".repeat(32), s), /invalid strom\.app\.url/);
      assert.throws(() => importAppUrl("http://127.0.0.1:1/x/tree.ged", s), /invalid strom\.app\.url/);
      assert.throws(() => sendAppUrl("http://127.0.0.1:1/x", s), /invalid strom\.app\.url/);
      assert.throws(() => adoptAppUrl("http://127.0.0.1:1/x", s), /invalid strom\.app\.url/);
      // what only names or looks: the channel's default, the setting said invalid — never failing
      assert.deepEqual(appUrlSetting(s).url, STROM_APP_URL);
      assert.ok(appUrlSetting(s).invalid);
      assert.equal(appOpensLinks(s), true);
    }
  }
  assert.equal(appUrlSetting(unit({ stromAppUrl: "https://evil.example/run/" })).invalid?.source, "config");

  const w = new World();
  await w.withTree();
  // Chrome here: the research would go to the app through the bridge (?import-url=, ?live= with its secret)
  const apps = path.join(w.dir, "Applications");
  fs.mkdirSync(path.join(apps, "Google Chrome.app"), { recursive: true });
  fs.writeFileSync(path.join(apps, "google-chrome"), "#!/bin/sh\n", { mode: 0o755 });
  w.env.STROM_APP_DIRS = apps;
  const file = path.join(w.env.STROM_CONFIG_DIR!, "config.json");
  const live = path.join(w.treeDir("Novákovi"), ".strom", "live.json");
  const secret = /[0-9a-f]{32}|\?(live|import-url|send|adopt)=|127\.0\.0\.1:\d/;
  try {
    for (const bad of ["https://evil.example/run/", "not a url"]) {
      for (const how of ["config", "env"] as const) {
        const env: Record<string, string> = how === "env" ? { STROM_APP_URL: bad } : {};
        if (how === "config") fs.writeFileSync(file, JSON.stringify({ ...readJsonFile(file), stromAppUrl: bad }, null, 2));
        for (const asked of [["app"], ["app", "--json"], ["app", "--live", "--json"], ["app", "install"], ["sync", "--app"]]) {
          const r = await w.run(asked, { env });
          assert.equal(r.code, 2, `${how} ${bad} ${asked.join(" ")}: ${r.out}${r.err}`);
          assert.match(r.out + r.err, asked.includes("--json") ? /invalid strom\.app\.url/ : /strom\.app\.url/);
          assert.doesNotMatch(r.out + r.err, secret, `${asked.join(" ")}: no address with the bridge's secret`);
          assert.ok(!fs.existsSync(live), `${asked.join(" ")}: no bridge started`);
        }
        // written by hand: how to put it right
        if (how === "config") assert.match((await w.run(["app"], { env })).err, /strom config unset strom\.app\.url/);
        // the bridge itself runs; the app's address with its secret is not said
        const started = await w.run(["live", "start", "--json"], { env });
        assert.equal(started.code, 0, started.err);
        assert.equal(started.json.app, undefined);
        const said = await w.run(["live"], { env });
        assert.equal(said.code, 0, said.err);
        assert.ok(said.out.includes(bad), said.out);
        assert.doesNotMatch(said.out, /\?live=/);
        await w.ok(["live", "stop"]);
        fs.rmSync(live, { force: true });
        if (how === "config") await w.ok(["config", "unset", "strom.app.url"]);
      }
    }
    // a copy of the app — its beta, its development — still opens with the research
    for (const good of ["https://beta.stromapp.info/run/", "http://127.0.0.1:8080/", "http://localhost:5173/"]) {
      fs.writeFileSync(file, JSON.stringify({ ...readJsonFile(file), stromAppUrl: good }, null, 2));
      const r = (await w.ok(["app", "--json"])).json;
      assert.equal(r.url, `${good}?import-url=${encodeURIComponent(`${r.bridge}/tree.ged`)}`);
      const e = (await w.ok(["app", "--json"], { env: { STROM_APP_URL: good } })).json;
      assert.ok(e.url.startsWith(`${good}?import-url=`), e.url);
    }
  } finally {
    await w.run(["live", "stop"]);
  }
  w.cleanup();
});

test("strom config where and config get never fail on strom.app.url: an invalid one (STROM_APP_URL, or written by hand into the settings) is shown as found, marked invalid and said how to put right — --json carries invalid as strom commands --json does; the releases say nothing of a beta (B1-e)", async () => {
  const w = new World();
  await w.ok(["setup", "--yes"]);
  const file = path.join(w.env.STROM_CONFIG_DIR!, "config.json");
  const note = /strom\.app\.url \(or STROM_APP_URL\) is no address of the Strom app[\s\S]*strom config unset strom\.app\.url/;
  // the releases first (a beta run before leaves its backup said on the way back)
  for (const channel of [{}, { STROM_CHANNEL: "beta" }] as Record<string, string>[])
    for (const bad of ["https://evil.example/run/", "not a url"])
      for (const how of ["env", "config"] as const) {
        const env: Record<string, string> = { ...channel, ...(how === "env" ? { STROM_APP_URL: bad } : {}) };
        if (how === "config") fs.writeFileSync(file, JSON.stringify({ ...readJsonFile(file), stromAppUrl: bad }, null, 2));
        const label = `${channel.STROM_CHANNEL ?? "stable"} ${how} ${bad}`;
        const get = await w.run(["config", "get", "strom.app.url"], { env });
        assert.equal(get.code, 0, `${label}: ${get.err}`);
        assert.ok(get.out.startsWith(`${bad}  (invalid)\n`), get.out);
        assert.match(get.out, note);
        const getJson = await w.run(["config", "get", "strom.app.url", "--json"], { env });
        assert.equal(getJson.code, 0, getJson.err);
        assert.deepEqual(getJson.json, { key: "strom.app.url", value: bad, source: how, invalid: ["strom.app.url"] });
        const where = await w.run(["config", "where"], { env });
        assert.equal(where.code, 0, `${label}: ${where.err}`);
        assert.match(where.out, new RegExp(`^strom\\.app\\.url\\s+${bad.replace(/[./]/g, "\\$&")}  \\(invalid\\)\\s+${how}`, "m"));
        assert.match(where.out, note);
        const whereJson = await w.run(["config", "where", "--json"], { env });
        assert.equal(whereJson.code, 0, whereJson.err);
        assert.deepEqual(whereJson.json.invalid, ["strom.app.url"]);
        const row = whereJson.json.settings.find((s: { key: string }) => s.key === "strom.app.url");
        assert.equal(row.value, bad);
        assert.equal(row.source, how);
        assert.equal(row.invalid, true);
        if (!channel.STROM_CHANNEL)
          for (const r of [get, getJson, where, whereJson]) assert.doesNotMatch(r.out + r.err, /(?<!\p{L})bet[aěyu]/iu, `${label}: the releases say nothing of a beta`);
        if (how === "config") await w.ok(["config", "unset", "strom.app.url"], { env: channel });
      }
  // a valid one: nothing said of it
  const where = await w.ok(["config", "where", "--json"]);
  assert.equal(where.json.invalid, undefined);
  assert.equal(where.json.settings.find((s: { key: string }) => s.key === "strom.app.url").invalid, undefined);
  assert.deepEqual((await w.ok(["config", "get", "strom.app.url", "--json"])).json, { key: "strom.app.url", value: "https://stromapp.info/run/", source: "default" });
  assert.equal((await w.ok(["config", "get", "strom.app.url"], { env: { STROM_CHANNEL: "beta" } })).out.trim().split("\n").pop(), "https://beta.stromapp.info/run/");
  w.cleanup();
});

test("the description of strom.app.url names the channel's default copy of the app: the beta its beta, the releases stromapp.info and nothing of a beta (B1-g)", async () => {
  const w = new World();
  await w.ok(["setup", "--yes"]);
  const described = async (env?: Record<string, string>) => ((await w.ok(["config", "where", "--json"], env ? { env } : {})).json.settings as { key: string; description: string }[]).find((s) => s.key === "strom.app.url")!.description;
  const stable = await described();
  assert.match(stable, /instead of https:\/\/stromapp\.info\/run\//);
  assert.doesNotMatch(stable, /beta|\{appUrl\}/i);
  const beta = await described({ STROM_CHANNEL: "beta" });
  assert.match(beta, /instead of https:\/\/beta\.stromapp\.info\/run\//);
  assert.doesNotMatch(beta, /\{appUrl\}/);
  w.cleanup();
});

test("where strom.app.url is said invalid, the note goes with the language of what is around it: doctor (a person's) in the research language, both its lines; config where and config get (the agent's English) in English (B1-h)", async () => {
  const w = new World();
  await w.ok(["setup", "--yes"]);
  const file = path.join(w.env.STROM_CONFIG_DIR!, "config.json");
  const english = /\b(the|is no|address of|set to|or removed|remove it)\b/;
  for (const how of ["env", "config"] as const) {
    const env: Record<string, string> = how === "env" ? { STROM_APP_URL: "not a url" } : {};
    if (how === "config") fs.writeFileSync(file, JSON.stringify({ ...readJsonFile(file), stromAppUrl: "not a url" }, null, 2));
    for (const lang of ["cs", "de"]) {
      const said = (await w.run(["doctor", "--json", "--lang", lang], { env })).json.checks.find((c: { name: string }) => c.name === "appurl");
      assert.doesNotMatch(`${said.label} ${said.detail} ${said.fix}`, english, `${how} ${lang}: ${JSON.stringify(said)}`);
      for (const asked of [["config", "get", "strom.app.url"], ["config", "where"]]) {
        const out = (await w.ok([...asked, "--lang", lang], { env })).out;
        assert.match(out, /Note: the setting strom\.app\.url \(or STROM_APP_URL\) is no address of the Strom app/, `${asked.join(" ")} ${lang}`);
      }
    }
    if (how === "config") await w.ok(["config", "unset", "strom.app.url"]);
  }
  // what is around them: English in config where (the agent's), the research language in doctor
  assert.match((await w.ok(["config", "where", "--lang", "cs"])).out, /^order: flag > env/m);
  w.cleanup();
});

test("the texts for an agent name the Strom app strom app opens: the guide, a tree's AGENTS.md and what the agents are taught — the beta channel its beta, a valid strom.app.url its copy, the releases stromapp.info and nothing of a beta (B1-i)", { skip: !hasGit }, async () => {
  const w = new World();
  await w.withTree();
  const home = w.env.HOME!;
  const taught = [
    path.join(home, ".claude", "skills", "strom", "SKILL.md"),
    path.join(home, ".codex", "AGENTS.md"),
    path.join(home, ".gemini", "GEMINI.md"),
    path.join(home, ".config", "opencode", "strom.md"),
    path.join(home, ".grok", "skills", "strom", "SKILL.md"),
  ];
  const texts = async (env: Record<string, string>): Promise<[string, string][]> => {
    const guide = (await w.ok(["guide"], { env })).out;
    await w.ok(["agents", "sync"], { env });
    await w.ok(["agents", "install", "--all"], { env });
    return [["guide", guide], ["AGENTS.md", fs.readFileSync(path.join(w.cwd, "AGENTS.md"), "utf8")], ...taught.map((f): [string, string] => [f, fs.readFileSync(f, "utf8")])];
  };
  // the releases: stromapp.info, nothing of a beta
  for (const [label, text] of await texts({})) {
    assert.match(text, /the Strom app \(https:\/\/stromapp\.info\)/i, label);
    assert.ok(text.includes("https://stromapp.info/run/"), label);
    assert.doesNotMatch(text, /beta/i, `${label}: the releases say nothing of a beta`);
  }
  // the beta channel: its beta, never the releases' address
  for (const [label, text] of await texts({ STROM_CHANNEL: "beta" })) {
    assert.match(text, /the Strom app \(https:\/\/beta\.stromapp\.info\)/i, label);
    assert.ok(text.includes("https://beta.stromapp.info/run/"), label);
    assert.doesNotMatch(text, /https:\/\/stromapp\.info/, label);
  }
  // a valid strom.app.url: its copy, on either channel
  await w.ok(["config", "set", "strom.app.url", "http://127.0.0.1:5173/"]);
  for (const env of [{}, { STROM_CHANNEL: "beta" }] as Record<string, string>[])
    for (const [label, text] of await texts(env)) {
      assert.match(text, /the Strom app \(http:\/\/127\.0\.0\.1:5173\)/i, label);
      assert.ok(text.includes("http://127.0.0.1:5173/"), label);
      assert.doesNotMatch(text, /stromapp\.info/, label);
    }
  // back on the releases with the setting gone: written again, nothing of a beta or the copy left
  await w.ok(["config", "unset", "strom.app.url"]);
  for (const [label, text] of await texts({})) assert.doesNotMatch(text, /beta|127\.0\.0\.1/i, label);
  w.cleanup();
});
