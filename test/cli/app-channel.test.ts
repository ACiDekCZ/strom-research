// The copy of the Strom app strom opens by itself goes with strom's channel: the beta of the research with the app's
// beta (https://beta.stromapp.info/run/), the releases with stromapp.info. strom.app.url (STROM_APP_URL) always wins.

import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { World, readJsonFile } from "../helpers.ts";
import { Settings } from "../../src/core/config.ts";
import { appOpensLinks, defaultAppUrl, STROM_APP_BETA_URL, STROM_APP_URL, stromAppUrl } from "../../src/core/stromapp.ts";

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
