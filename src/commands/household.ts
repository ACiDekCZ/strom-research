// strom census add: one household of a census sheet, written as one event the Strom app shares among its members of the
// tree (spec 106 K3; core/household.ts).

import { register } from "../cli/registry.ts";
import { lines } from "../cli/format.ts";
import { UsageError } from "../core/errors.ts";
import { INFORMATION } from "../core/evidence.ts";
import { addHousehold, parseMember } from "../core/household.ts";
import { opLine } from "../core/proposals.ts";
import { listOpt, normId } from "../core/records.ts";
import { checkStreetPlace } from "../core/streets.ts";
import type { Citation } from "../core/model.ts";

register({
  path: ["census", "add"],
  summary: "Record one household of a census sheet: a census fact of each member of the tree, shared as one event",
  group: "people",
  tree: true,
  writes: true,
  description: [
    "One household (one house, one sheet) of a census: each member who is a person of the tree gets a CENS fact with",
    "the relation to the head and the age the sheet gives; date, place, house, note and the citation of the sheet are",
    "the same on every copy (two or more members: one shared event in the Strom app). The people of the sheet who are",
    "not in the tree go in --others (said in the note; no person is made of them). Nothing else is written: a birth",
    "year the sheet gives is a clue to search the register, never a birth.",
    "Relations: head, wife, husband, son, daughter, father, mother, father-in-law, mother-in-law, son-in-law,",
    "daughter-in-law, grandson, granddaughter, brother, sister, stepson, stepdaughter, foster, relative, servant,",
    "farmhand, maid, lodger, inmate, retired, apprentice, journeyman — the key or the word in the research's language",
    "(written in it); any other relation as the research would say it. The sheet's own words go in --transcript.",
    "--date: a year alone is the census day of that year when strom knows it (else the year); a full day wins.",
    "A common field corrected later on one copy (strom event edit, strom cite, strom note edit) goes to every copy.",
  ].join("\n"),
  options: [
    { name: "source", type: "string", value: "<S…>", aliases: ["cite"], description: "the census sheet (its source record)" },
    { name: "date", type: "string", value: "<year|date>", description: 'the census year ("1890") or its day ("31 DEC 1890")' },
    { name: "place", type: "string", value: "<place|L…>", description: "the municipality (or its place record) — never a street or a house number" },
    { name: "house", type: "string", value: "<no.>", description: 'the house number as the sheet gives it: "14", "Dlouhá 12"' },
    {
      name: "member",
      type: "string",
      multiple: true,
      value: "<P…:relation:age>",
      description: 'a person of the tree in the household: "P0003:head:41", "P0008:wife:36" — the head always said (repeatable)',
    },
    { name: "others", type: "string", value: "<text>", description: 'the people of the sheet not in the tree, in a few words: "farmhand (19), maid (17)"' },
    { name: "note", type: "string", value: "<text>", description: "short note on the household (the same on every copy)" },
    { name: "locator", type: "string", value: "<where>", description: "where in the source: sheet, page, line (--page is a listing's page)" },
    { name: "transcript", type: "string", value: "<text>", aliases: ["quote"], description: "the words of the sheet for this household" },
    { name: "information", type: "string", value: "<kind>", description: "primary, secondary or unknown (default: the source's)" },
    { name: "status", type: "string", value: "<status>", description: "lead, possible, probable (default with a record), proven" },
    { name: "country", type: "string", value: "<code>", description: "the country whose census it is (ISO code; default: the archive's)" },
  ],
  examples: [
    'strom census add --source S0001 --date 1910 --place "Týnec nad Labem" --house 14 --member P0002:head:40 --member P0003:wife:35 --member P0001:son:5 --others "farmhand (19)" --locator "sheet 3"',
    "strom census add --source S0001 --date 1900 --place L0001 --house 7 --member P0002:son:30",
  ],
  run(ctx, { opts }) {
    const tree = ctx.tree();
    if (!opts.source) throw new UsageError("which census sheet? --source <S…>", { code: "census.source", hint: 'strom source add "<census sheet title>" … — then strom census add --source S… --date <year> --member P…:head:<age>' });
    if (!opts.date) throw new UsageError("the census year or day: --date <year|date>", { code: "census.date", hint: '--date 1890 (the census day of the year where strom knows it) or --date "31 DEC 1890"' });
    const members = listOpt(opts.member).map(parseMember);
    if (opts.information !== undefined && !INFORMATION.includes(opts.information as (typeof INFORMATION)[number]))
      throw new UsageError(`invalid --information "${String(opts.information)}"`, { hint: INFORMATION.join(", ") });
    const place = opts.place as string | undefined;
    const house = opts.house as string | undefined;
    if (place && !/^L\d+$/iu.test(place.trim())) checkStreetPlace(tree, place, house);
    const h = addHousehold(tree, {
      source: normId(String(opts.source), "source"),
      date: String(opts.date),
      place,
      house,
      members,
      others: opts.others as string | undefined,
      note: opts.note as string | undefined,
      locator: opts.locator as string | undefined,
      quote: opts.transcript as string | undefined,
      information: opts.information as Citation["information"] | undefined,
      status: opts.status as string | undefined,
      country: opts.country as string | undefined,
    });
    const day =
      h.day === "census"
        ? `date: ${h.date}, the census day of that year`
        : /^\d{3,4}$/u.test(h.date)
          ? `date: the year ${h.date} alone — no census day known for it; the sheet's own day: --date "<day>" (strom event edit)`
          : undefined;
    const same = h.sameHouse.length ? `note: the same house in that census has other people of the tree too (${h.sameHouse.join(", ")}) — another household of the house, or the same one written twice (then strom event retract)` : undefined;
    const elsewhere = h.elsewhere.length ? `note: a census of that year elsewhere: ${h.elsewhere.join(", ")} — moved, or two people taken for one (strom show <E…>)` : undefined;
    return {
      text: lines(...tree.written.map((o) => opLine(tree, o)), h.id ? `household ${h.id}: ${h.copies.map((c) => `${c.person} ${c.role}${c.age ? ` ${c.age}` : ""}`).join(", ")}` : undefined, day, same, elsewhere),
      data: { household: h },
    };
  },
});
