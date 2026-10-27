// The images in an agent's log left out (core/logimages.ts): both copies Claude Code writes of each image (the
// result's source.data, tool_use_result.file.base64), the line still valid JSON, everything else in it as it was; the
// same cut whether the text comes whole or in pieces split anywhere, and on inputs far too big for a regular
// expression (found 2026-10-27: "Maximum call stack size exceeded" on a 39 MB log).

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { IMAGE_MIN, ImageCut, RunLog, withoutImages } from "../../src/core/logimages.ts";

const b64 = (chars: number) => "QUJD".repeat(Math.ceil(chars / 4)).slice(0, chars);

/** A line of Claude Code's stream with an image a Read call showed: twice, as it writes it. */
function imageLine(callId: string, data: string, filePath?: string): string {
  return JSON.stringify({
    type: "user",
    message: { role: "user", content: [{ tool_use_id: callId, type: "tool_result", content: [{ type: "image", source: { type: "base64", data, media_type: "image/jpeg" } }] }] },
    parent_tool_use_id: null,
    session_id: "00000000-0000-4000-8000-0000000000c1",
    tool_use_result: { type: "image", file: { base64: data, type: "image/jpeg", ...(filePath ? { filePath } : {}), originalSize: 611312 } },
  });
}

test("both copies of an image go, its size said; the line stays JSON with everything else as it was", () => {
  const data = b64(663_996);
  const line = imageLine("toolu_01", data);
  const out = withoutImages(line);
  assert.ok(out.length < 1000, String(out.length));
  const msg = JSON.parse(out);
  const mark = "[image 486 kB left out]";
  assert.equal(msg.message.content[0].content[0].source.data, mark);
  assert.equal(msg.tool_use_result.file.base64, mark);
  // the rest untouched
  const back = JSON.parse(line);
  back.message.content[0].content[0].source.data = mark;
  back.tool_use_result.file.base64 = mark;
  assert.deepEqual(msg, back);
});

test("short base64, text in any script and a line without images stay as they are; a data: URL and escaped JSON are cut", () => {
  const short = JSON.stringify({ data: b64(IMAGE_MIN - 1), signature: b64(5000), text: "Křest — Příliš žluťoučký kůň · Крещение · e\u0301" });
  assert.equal(withoutImages(short), short);
  const url = JSON.stringify({ image_url: `data:image/png;base64,${b64(10_000)}` });
  assert.deepEqual(JSON.parse(withoutImages(url)), { image_url: "data:image/png;base64,[image 7 kB left out]" });
  const nested = JSON.stringify({ output: JSON.stringify({ base64: b64(4096) }) });
  assert.deepEqual(JSON.parse(JSON.parse(withoutImages(nested)).output), { base64: "[image 3 kB left out]" });
  // a view's path in the mark: safe in any JSON string (a Windows path's backslashes, a quote)
  const p = JSON.parse(withoutImages(JSON.stringify({ data: b64(4096) }), 'C:\\Users\\Lhoták\\.strom\\views\\a"b.jpg'));
  assert.equal(p.data, "[image 3 kB left out: C:/Users/Lhoták/.strom/views/a'b.jpg]");
});

test("the same cut whether the text comes whole or in pieces split anywhere", () => {
  const text = [
    imageLine("toolu_01", b64(9000)),
    JSON.stringify({ type: "assistant", text: "Hledám křest Lhotáka v Lhotě" }),
    JSON.stringify({ data: b64(IMAGE_MIN) }),
    JSON.stringify({ data: b64(IMAGE_MIN - 1) }),
    `"data":"${b64(3000)}`, // a run cut by the end of the text
  ].join("\n");
  const whole = withoutImages(text);
  assert.deepEqual(whole.split("\n").slice(2), ['{"data":"[image 2 kB left out]"}', `{"data":"${b64(IMAGE_MIN - 1)}"}`, '"data":"[image 2 kB left out]']);
  for (const size of [1, 2, 3, 7, 13, 64, 1000, 4096]) {
    const cut = new ImageCut();
    let out = "";
    for (let i = 0; i < text.length; i += size) out += cut.push(text.slice(i, i + size));
    out += cut.end();
    assert.equal(out, whole, `pieces of ${size}`);
  }
});

test("a 40 MB log with an image of 20 MB, long lines and long text: no stack overflow, the text whole", () => {
  const huge = b64(20_000_000);
  const longText = "Lhoták z Lhoty, ".repeat(400_000); // 6.4 M characters of words
  const text = [JSON.stringify({ data: huge }), JSON.stringify({ text: longText }), imageLine("toolu_02", b64(8_000_000)), `{"x":"${"=".repeat(2_000_000)}"}`].join("\n");
  assert.ok(text.length > 40_000_000);
  const out = withoutImages(text);
  const lines = out.split("\n").map((l) => JSON.parse(l));
  assert.equal(lines[0].data, "[image 14648 kB left out]");
  assert.equal(lines[1].text, longText);
  assert.equal(lines[2].tool_use_result.file.base64, "[image 5859 kB left out]");
  assert.equal(lines[3].x, "=".repeat(2_000_000), "a long run under no image's key stays");
});

test("the run's log names the view an image showed: the result's own path, else the Read call's by its id", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "strom-logimages-"));
  try {
    const file = path.join(dir, "runs", "N0001.log");
    const log = new RunLog(file);
    const call = JSON.stringify({ type: "assistant", message: { content: [{ type: "tool_use", id: "toolu_07", name: "Read", input: { file_path: "/tmp/Lhoták/.strom/views/B0001-3-ab.jpg" } }] } });
    log.line(call);
    log.line(imageLine("toolu_07", b64(5000)));
    log.line(imageLine("toolu_08", b64(5000), "/tmp/Lhoták/.strom/views/B0001-4-cd.jpg"));
    log.line(imageLine("toolu_09", b64(5000)));
    log.note("\n[strom] a note\n");
    log.rest('{"type":"result"');
    log.flush();
    const lines = fs.readFileSync(file, "utf8").split("\n");
    assert.equal(lines[0], call);
    assert.equal(JSON.parse(lines[1]!).tool_use_result.file.base64, "[image 4 kB left out: /tmp/Lhoták/.strom/views/B0001-3-ab.jpg]");
    assert.equal(JSON.parse(lines[1]!).message.content[0].content[0].source.data, "[image 4 kB left out: /tmp/Lhoták/.strom/views/B0001-3-ab.jpg]");
    assert.equal(JSON.parse(lines[2]!).tool_use_result.file.base64, "[image 4 kB left out: /tmp/Lhoták/.strom/views/B0001-4-cd.jpg]");
    assert.equal(JSON.parse(lines[3]!).tool_use_result.file.base64, "[image 4 kB left out]", "a call not known: no path made up");
    assert.deepEqual(lines.slice(4), ["", "[strom] a note", '{"type":"result"']);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("strom tidy shrinks a log of any size a piece at a time: several gzip members, read back whole as one", async () => {
  const { shrinkLog } = await import("../../src/core/tidy.ts");
  const { eachGzipLine } = await import("../../src/core/lines.ts");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "strom-shrink-"));
  try {
    const src = path.join(dir, "N0001.log");
    const fd = fs.openSync(src, "w");
    const want: string[] = [];
    for (let i = 0; i < 200; i++) {
      const text = JSON.stringify({ type: "assistant", text: `Lhoták z Lhoty č. ${i} — Ελληνικά, Кириллица, é` });
      const line = imageLine(`toolu_${i}`, b64(100_000 + i));
      fs.writeSync(fd, `${text}\n${line}\n`);
      want.push(text, withoutImages(line));
    }
    fs.closeSync(fd);
    assert.ok(fs.statSync(src).size > 40_000_000);
    const gz = path.join(dir, "N0001.log.gz");
    shrinkLog(src, gz, { chunk: 65_537, block: 64 * 1024 });
    assert.ok(fs.statSync(gz).size < 200_000, String(fs.statSync(gz).size));
    const got: string[] = [];
    eachGzipLine(gz, (l) => got.push(l));
    assert.deepEqual(got, want);
    assert.ok(!fs.readdirSync(dir).some((f) => f.includes(".gz.")), "nothing left beside it");
    // an empty log: a gzip file still
    fs.writeFileSync(src, "");
    shrinkLog(src, gz);
    let n = 0;
    eachGzipLine(gz, () => n++);
    assert.equal(n, 0);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
