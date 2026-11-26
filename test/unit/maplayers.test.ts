// The map layers strom ships (assets/maplayers.json, spec 030 part 2): every one whole, its host in strom's list of
// archives' terms (assets/archives.json) as allowed for automated use, its path outside the host's disallowed ones; a
// layer is offered only where its box holds a point. No request leaves this computer.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { assetPath } from "../../src/core/assets.ts";
import { inBox, layerOk, layerView, mapLayers } from "../../src/core/maplayers.ts";

const raw = JSON.parse(fs.readFileSync(assetPath("maplayers.json"), "utf8")) as { layers: Record<string, unknown>[] };
const archives = (JSON.parse(fs.readFileSync(assetPath("archives.json"), "utf8")) as { archives: Record<string, unknown>[] }).archives;

test("every layer shipped is whole: none left out by the loader, the ids unique, a label in each catalog's language", () => {
  assert.ok(Array.isArray(raw.layers) && raw.layers.length > 0);
  for (const l of raw.layers) assert.ok(layerOk(l), JSON.stringify(l));
  assert.equal(mapLayers().length, raw.layers.length);
  const ids = mapLayers().map((l) => l.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const l of mapLayers()) for (const lang of ["cs", "en", "de", "pl"]) assert.ok(l.label[lang]?.trim(), `${l.id} ${lang}`);
});

test("every layer's host is in archives.json as allowed for automated use, its path none of the host's disallowed", () => {
  for (const l of mapLayers()) {
    const u = new URL(l.url);
    assert.equal(u.protocol, "https:", l.id);
    const entry = archives.find((a) => a.host === u.hostname);
    assert.ok(entry, `${l.id}: ${u.hostname} not in archives.json`);
    assert.equal(entry!.level, "allowed", l.id);
    assert.equal(entry!.automatedUse, true, l.id);
    assert.ok(entry!.license, `${l.id}: the host's licence`);
    const disallow = Array.isArray(entry!.disallow) ? (entry!.disallow as string[]) : [];
    for (const d of disallow) assert.ok(!u.pathname.toLowerCase().startsWith(d.toLowerCase()), `${l.id}: ${u.pathname} under ${d}`);
  }
});

test("a layer's box: a point inside, one outside; its view in the research language, else English", () => {
  const l = { ...mapLayers()[0]!, bbox: [12, 48, 19, 51] as [number, number, number, number], label: { en: "Today", cs: "Dnes" } };
  assert.ok(inBox(l, { lat: 49.5, lon: 15.2 }));
  assert.ok(!inBox(l, { lat: 52.5, lon: 15.2 }));
  assert.ok(!inBox(l, { lat: 49.5, lon: 11.2 }));
  assert.equal(layerView(l, "cs").label, "Dnes");
  assert.equal(layerView(l, "pl").label, "Today");
  assert.ok(!layerOk({ ...l, bbox: [19, 48, 12, 51] }), "west past east");
  assert.ok(!layerOk({ ...l, url: "http://example.org/wms" }), "only https");
  assert.ok(!layerOk({ ...l, label: { cs: "Dnes" } }), "English at least");
});
