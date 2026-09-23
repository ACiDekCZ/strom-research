# Method: recording an entry

Record a found entry in one batch: write the lines to a file in notes/, run
`strom batch --file notes/<file> --dry-run`, fix what it reports, then run it
without --dry-run. `#name` labels what a line creates, `@name` uses it later.

    source add "Baptism of Jan Novák 1885" --kind baptism --recordset B0001 --media B0001:57 --locator "pag. 112, entry 2" --language la --information primary --transcript @notes/entry.txt #s
    event add P0001 CHR --date "25 JUN 1885" --place "Týnec" --house 13 --cite @s --quote "baptizatus est" --with "godparent:Marie Dvořáková" --with "midwife:Anna Nová" --with "officiant:P. Josef Kříž" --status proven
    cite E0001 @s --quote "natus 24. Junii" --status proven
    name add P0002 "Marie /Svobodová/" --kind birth --cite @s --quote "Maria filia Josephi Svoboda"
    person add "Josef /Svoboda/" --sex M --cite @s --information secondary #josef
    family add --partner @josef --child P0002 --cite @s --information secondary
    search add "Baptism of Jan Novák" --recordset B0001 --years 1884-1886 --pages 55-60 --method page-by-page --result found --found @s

- A fact already in the tree gets the citation (`cite E…`), not a second fact —
  and what the record adds to it: `event edit E… --age husband:27 --age wife:17
  --house 21 --with "witness:…" --with "officiant:…"` (filling in needs no reason).
- The names a record gives go on the person: `name add` (a maiden name completes
  "Marie" to "Marie /Svobodová/"; a married name is `--kind married`).
- A record that names someone's parents (a grandchild's baptism naming the
  grandparents) cites the family itself (`family add … --cite`, `cite F…`) and
  the new people's names (`person add … --cite`) — with `--information
  secondary`: the priest wrote down what he was told.
- What the entry says about each person it names becomes that person's fact,
  dated by the entry: an occupation `event add P… OCCU --value "cottager"`, where
  they live `event add P… RESI --place "Týnec" --house 7` — for the
  grandparents too ("daughter of Jan Novák, cottager in Týnec No. 7"), cited
  `--information secondary`. The next search identifies them by exactly these.
- Everyone the entry names in a role goes in `--with`: godparent, witness,
  midwife, officiant, informant, other.
- A child the record does not name (stillborn, died unbaptised) has no given
  name — never a description in its place: `person add "/Novák/" --sex M`, then
  `event add P… DEAT --date … --age stillborn` (or a `--note`).
- Only what you read for sure goes into a field (`--date`, `--house`, `--age`,
  `--cause`, a name). An uncertain word or digit is marked `[?]` in the
  transcript and said in the fact's note ("house 21 or 27"); what a reader
  reported as illegible stays illegible until you read it yourself. An empty
  column is empty — nothing is filled in from what would be usual. A name
  read only in part keeps its sure letters, `[?]` for the rest (`"Anna
  /Kr[?]ková/"`), so the person can still be found; a date whose day is
  unsure keeps the month (`--date "MAY 1850"`, note "12 or 17"). A
  conclusion that stands on one hard cell (a house number, an age, a maiden
  name) gets a blind second reading before it is `proven`: `strom read M…
  --blind --crop x,y,w,h --question "Transcribe this entry"`.
- A place is the settlement only ("Týnec", not "Týnec No. 13"): the house
  number goes in `--house 13`.
- What a finding means for other tasks: `strom task edit T… --note "…"`.
- Records about one person disagree (a name, a date, an age): record both
  claims and your reasoning — `strom conflict add "<question>" --about P…
  --claim "S…:<what it says>" --claim "S…:<what the other says>"`. Records
  that give different parents are first two people (see core); they are one
  person with a conflict only once something else proves it. What would decide
  it, if not at hand, is a task about it: `strom task add … --about X…` (or H…).
  `strom conflict resolve X… --resolution "…" --reasoning "…"` when the
  evidence decides it. A decided
  hypothesis that a new record overturns is decided again (the earlier
  decision is kept): `strom hypothesis decide H… --decision "…" --reason "…"`.
  People named wrongly by the weaker record keep that name as a variant
  (`name add … --primary` for the right one); they are not deleted.
