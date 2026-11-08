// The GEDCOM files of test/gedcom/encoding.test.ts, each in the encoding a Windows program writes (made-up people,
// the same cases as the Strom app's test/gedcom-encoding/). Run once: node test/fixtures/gedcom-encoding/make.ts

import fs from "node:fs";
import path from "node:path";

const here = import.meta.dirname;

/** Text in a single-byte Windows code page (TextEncoder only does UTF-8). */
export function encode(text: string, encoding: string): Buffer {
  const decoder = new TextDecoder(encoding);
  const map = new Map<string, number>();
  for (let b = 0; b < 256; b++) map.set(decoder.decode(new Uint8Array([b])), b);
  return Buffer.from(
    [...text].map((c) => {
      const b = map.get(c);
      if (b === undefined) throw new Error(`${encoding} cannot encode ${c}`);
      return b;
    }),
  );
}

export const CZECH: [string, string, string][] = [
  ["Vojtěch", "Lhoták", "Horní Lhota"],
  ["Zdeňka", "Lhotáková", "Lhota pod Řípem"],
  ["Řehoř", "Lhoták", "Lhota u Žďáru"],
  ["Ludmila", "Lhotáková", "Šťastná Lhota"],
  ["Matěj", "Lhoták", "Dolní Lhota"],
];
export const POLISH: [string, string, string][] = [
  ["Łucja", "Lhotowska", "Lhota Łąkowa"],
  ["Żaneta", "Lhocka", "Lhota Śląska"],
];
export const WESTERN: [string, string, string][] = [
  ["Thérèse", "Lhotière", "Besançon"],
  ["Niccolò", "Lhotini", "Forlì"],
  ["Jürgen", "Lhoteiß", "Köln"],
  ["François", "Lhotier", "Genève"],
];

export function ged(char: string | undefined, people: [string, string, string][]): string {
  const head = ["0 HEAD", "1 SOUR FICTIONAL", "1 GEDC", "2 VERS 5.5.1", ...(char ? [`1 CHAR ${char}`] : [])];
  const body = people.flatMap(([given, surname, place], i) => [`0 @I${i + 1}@ INDI`, `1 NAME ${given} /${surname}/`, `1 SEX ${/[aá]$/u.test(given) ? "F" : "M"}`, "1 BIRT", `2 PLAC ${place}`]);
  return [...head, ...body, "0 TRLR", ""].join("\r\n");
}

/** ANSEL: the mark before its letter ("ř" = caron + r); only what these names need. */
function ansel(text: string): Buffer {
  const marks: Record<string, number> = { "̌": 0xe9, "́": 0xe2, "̊": 0xea };
  const out: number[] = [];
  for (const ch of text.normalize("NFD")) {
    const cp = ch.codePointAt(0)!;
    if (cp < 0x80) out.push(cp);
    else if (marks[ch] !== undefined) out.splice(out.length - 1, 0, marks[ch]!);
    else throw new Error(`ANSEL here has no ${ch}`);
  }
  return Buffer.from(out);
}

if (process.argv[1] && path.resolve(process.argv[1]) === import.meta.filename) {
  const write = (name: string, bytes: Buffer) => fs.writeFileSync(path.join(here, name), bytes);
  write("ansi-czech.ged", encode(ged("ANSI", CZECH), "windows-1250"));
  write("cp1250-czech.ged", encode(ged("CP1250", CZECH.slice(0, 2)), "windows-1250"));
  // any case: as some programs write it
  write("windows-1250-czech.ged", encode(ged("windows-1250", CZECH.slice(2)), "windows-1250"));
  write("ansi-polish.ged", encode(ged("ANSI", POLISH), "windows-1250"));
  write("ansi-western.ged", encode(ged("ANSI", WESTERN), "windows-1252"));
  write("no-char-czech.ged", encode(ged(undefined, CZECH), "windows-1250"));
  write("utf8-label-cp1250-czech.ged", encode(ged("UTF-8", CZECH), "windows-1250"));
  write("ansi-utf8-czech.ged", Buffer.from(ged("ANSI", CZECH), "utf8"));
  // saved again as UTF-8 by a program that left the header as it was
  write("cp1250-label-utf8-czech.ged", Buffer.from(ged("CP1250", CZECH), "utf8"));
  write("ansel-czech.ged", ansel(ged("ANSEL", CZECH.slice(0, 3))));
  // a UTF-8 file with one stray byte (a Windows-1250 "ř" pasted in): the rest stays UTF-8, the byte is unreadable
  const utf8 = Buffer.from(ged("UTF-8", CZECH), "utf8");
  const at = utf8.indexOf(Buffer.from("Řehoř", "utf8"));
  write("utf8-stray-byte.ged", Buffer.concat([utf8.subarray(0, at), Buffer.from([0xd8]), utf8.subarray(at + Buffer.from("Ř", "utf8").length)]));
  // ANSEL with a byte it has no character for
  const one = ansel(ged("ANSEL", CZECH.slice(0, 1)));
  const name = one.indexOf("1 NAME ") + "1 NAME ".length;
  write("ansel-unknown-byte.ged", Buffer.concat([one.subarray(0, name), Buffer.from([0xbb]), one.subarray(name)]));
}
