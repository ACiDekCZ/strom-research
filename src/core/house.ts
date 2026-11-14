// A house number as written in a record ("12", "č. 12", "č. p. 12", "Nr. 12"): compared by its number, shown with
// no word of the house said twice. A leaf module (core/text.ts only): the words of a person (cli/human.ts) use it too.

import { foldText } from "./text.ts";

/** Words of a house that only say it is one ("č. p.", "čp.", "Nr.", "No.", "Haus", "dom"), folded. */
const HOUSE_WORDS = new Set(["c", "cp", "p", "cislo", "nr", "no", "num", "number", "house", "haus", "hausnr", "nro", "numer", "dom", "domu", "conscr", "consc"]);

/** A house as compared: its words folded, those that only say it is a house left out of its start ("č. 12" = "12"). */
export function houseKey(house: string): string {
  const parts = foldText(house.normalize("NFC")).split(/[^\p{L}\p{M}\p{N}/]+/u).filter(Boolean);
  while (parts.length > 1 && HOUSE_WORDS.has(parts[0]!)) parts.shift();
  return parts.join(" ");
}

/** Does a house as written say it is one ("č. 12", "Nr. 12", "č. p. 12"), so a text puts no word of its own before it? */
export function houseHasWord(house: string): boolean {
  const parts = foldText(house.normalize("NFC")).split(/[^\p{L}\p{M}\p{N}/]+/u).filter(Boolean);
  return parts.length > 1 && HOUSE_WORDS.has(parts[0]!);
}
