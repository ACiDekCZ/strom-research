// The research of app-compat.helpers.ts as the Strom app of one version sends it back: given by the bridge (to the
// app as it asks: from 3.9 with its version, ?app=; an older one says none), read by the app's own parser and written again by its own
// exporter, linked to the research (_STROM_TREE, _STROM_HEAD) — then kept as test/fixtures/app/<version>.ged, the
// research's ID and head as @TREE@ and @HEAD@ (the test's tree has its own). Needs the app's repository beside this
// one, checked out at that version, with its node_modules:
//
//   git -C ../strom checkout v3.8.1 && node test/fixtures/app/make.ts
//
// (or STROM_APP_REPO=<a checkout of that version>).

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { World } from "../../helpers.ts";
import { appCompatTree } from "../../cli/app-compat.helpers.ts";

const repo = path.resolve(process.env.STROM_APP_REPO ?? path.join(import.meta.dirname, "..", "..", "..", "..", "strom"));
const version = JSON.parse(fs.readFileSync(path.join(repo, "package.json"), "utf8")).version as string;
const tsx = path.join(repo, "node_modules", ".bin", "tsx");

const w = new World();
try {
  await appCompatTree(w);
  const info = (await w.ok(["live", "start", "--json"])).json;
  let given: string;
  try {
    const [major, minor] = version.split(".").map(Number);
    const says = major! > 3 || (major === 3 && minor! >= 9);
    given = await (await fetch(`${info.url}/tree.ged${says ? `?app=${version}` : ""}`, { headers: { Origin: "https://stromapp.info" } })).text();
  } finally {
    await w.ok(["live", "stop"]);
  }
  const tree = given.match(/^1 _STROM_TREE (.+)$/m)![1]!;
  const head = given.match(/^1 _STROM_HEAD (.+)$/m)![1]!;
  const input = path.join(w.dir, "given.ged");
  const output = path.join(w.dir, "back.ged");
  fs.writeFileSync(input, given);
  // the app: its import of the research's file, then the GEDCOM it sends back (research-ui.ts researchGedcom)
  const script = path.join(w.dir, "app.ts");
  fs.writeFileSync(
    script,
    `import fs from "node:fs";
import { parseGedcom, convertToStrom } from ${JSON.stringify(path.join(repo, "src", "ged-parser.ts"))};
import { exportToGedcom } from ${JSON.stringify(path.join(repo, "src", "ged-exporter.ts"))};
const data = convertToStrom(parseGedcom(fs.readFileSync(process.argv[2]!, "utf8"))).data;
fs.writeFileSync(process.argv[3]!, exportToGedcom(data, "Novákovi", { research: { id: ${JSON.stringify(tree)}, head: ${JSON.stringify(head)} } }).content);
`,
  );
  const r = spawnSync(tsx, [script, input, output], { encoding: "utf8" });
  if (r.status !== 0) throw new Error(r.stderr || r.stdout);
  const back = fs
    .readFileSync(output, "utf8")
    .replaceAll(tree, "@TREE@")
    .replaceAll(head, "@HEAD@")
    // the day it was made: not part of what is compared
    .replace(/^1 DATE .*$/m, "1 DATE 3 OCT 2026");
  const out = path.join(import.meta.dirname, `${version}.ged`);
  fs.writeFileSync(out, back);
  console.log(`${path.relative(process.cwd(), out)}: the research as the Strom app ${version} sends it back`);
} finally {
  w.cleanup();
}
