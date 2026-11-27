# Method: writing the story

A story is written from the facts, for the family.

- Every statement rests on a recorded fact; say which ones.
- What is inferred is marked as inference; what is unknown is said to be
  unknown. Never fill gaps with plausible fiction.
- The background of place and time (a war, an epidemic, a fire, what the
  village lived from) only from a source recorded in the research, named with
  `--source S…`, and told as background: "in 1866 the war passed through the
  region" — never as the cause of what the person did, unless a record says so.
- Use the research language and plain words; explain old occupations and
  terms the reader will not know.
- Format: paragraphs separated by a blank line; within them only "## "
  subheadings, "- " bullet lines, **bold** and *italic* — the Strom app shows
  anything else (links, tables, quotes, numbered lists) as plain text. The
  title goes in --title, not as a "# " line in the text.
<!-- for person-story -->
- Write it to a file in notes/, then `strom story set P… --text @notes/story-P….md
  --title "…" --fact E… --fact E… --source S… --note "what is inferred"`: every fact it leans on goes
  in --fact, every source of its background in --source. A couple's story goes on the family (F…).
- Told from a lead (an index, an older research, a page not read): the text
  names where it comes from — the source's title, never only "an older
  research says" — and that the record itself is not read yet.
- Written again: `strom story show P…` first. Each fact, source and link of
  that version stays in the new one (--fact, --source, the text); what goes,
  goes on purpose: `--drop "E… <why>"` (or S…, a link). strom refuses a
  version that loses one without it.
- A couple's story tells their life together: the wedding, the household, the
  homes, the children, the widowhood. Each one's life before and after it is
  their own story's — referred to in a sentence, never told again.
- A person whose couple has a story: the marriage in one sentence pointing to
  it. What a story told already stays; it is never shortened for a couple's.
- It stays a draft until the user approves it themselves (the Strom app, or
  strom → What waits; never you). An approved story is locked — the user liked
  it: written again (more facts, a better reading), the new version waits
  beside it and the approved one stays until the user decides. Tell them what
  is new in it; they approve it or keep the old one.
<!-- end -->
<!-- for house-story -->
- The story of a house: its holders and the families in it over the
  generations, what happened to it (a fire, a rebuilding, a division, a sale),
  its numbers in time and where it stood, its look, what the municipality
  lived from — from what the research found of the house and its
  municipality, given in the brief. Nothing looked up again.
- Every statement rests on an item of the house — n… its numbers, e… its
  events, h… its holders, r… its residents — or on a fact E… of the tree's
  people in it; all of them go in --fact. The municipality's background as a
  source with --source S… (its skeleton cites them).
- An item marked medium, guess or lead is told as uncertain ("probably",
  "according to an index not yet checked"); a number that is not the same
  house is left out. Gaps stay gaps: what was not found is said so.
- People of the last hundred years: their name and role in the house, no
  more (no illness, no court case, no divorce); the Strom app decides what of
  living people it shows or shares.
- Write it to a file in notes/, then `strom story set A… --text
  @notes/story-A….md --title "…" --fact h1 --fact e2 --fact E… --source S…
  --note "what is inferred"`. Written again: `strom story show A…` first,
  each fact and source of that version stays (or goes with `--drop "h… <why>"`).
- A person's own life is their own story's: in the house's story the
  person in a sentence, with their years in the house.
- It stays a draft until the user approves it themselves; an approved one is
  locked and the new version waits beside it — as a person's story.
<!-- end -->
