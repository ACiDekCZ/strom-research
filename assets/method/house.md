<!-- for house-town house-research house-look -->
# Method: the history of a house

The brief gives what the research knows already, for free: the people of the
tree in each house with their facts and years (never looked up again), the
municipality's skeleton, what was gone through (never again), what is only by
hand, and **the list of sources to go through** for its country. Write each
finding as it comes, with its source (`--source`, `--locator`, or `--url`) and
its certainty: `high` (the record says it), `medium` (a careful reading or a
good secondary source), `guess` (a supposition — said so). Never raised past
what the source gives. Reading an image: `strom guide reading`.

**No noise.** The list is yours, never the house's. Into the house goes only
what said something (a finding of its own, with its source), **one line** of
what was gone through, and a step by hand only where it belongs to the house
(its link and what to do). A source that cannot say anything of this house is
skipped without a word. No new tasks or questions from the list.

    house add passed A0001 --checklist --what "<gone through: the address register, the field names, the orthophoto 1950s, the topography (nothing of no. 9)>"

The task closes only once the list was gone through (strom counts the
searches and the pages of the session): never close it early, and never chase
the time — what is left goes into the same line.
<!-- end -->
<!-- for house-town -->
## A municipality's skeleton (once for all its houses)

What the houses of the municipality stand on: its lordship and estate, its
parish (and the parishes its houses belonged to), its cadastral area, its old
names, where its land registers and urbaria are (archive, fonds, what is
online), the map sheets of it, its chronicle and topography — and, from the
list, **the topographies and the field names once** for every house of it.
Nothing the identification of the place has already (`strom place show L0001`:
names, jurisdictions) — only what it lacks. Then:

    house add summary --town L0001 --text "<lordship, parish, cadastral area, land registers; what the topography says>"
    house add field-name --town L0001 --name "<the mill below the village>" --kind mill --lat 49.61 --lon 15.12 --house 14 --url https://example.org/names
    house add picture --town L0001 --url https://example.org/green.jpg --license "CC BY-SA 4.0" --credit "<author>" --shows "<the green from the south, no. 9 readable>"
    house add map --town L0001 --kind cadastre --url https://example.org/sheet --manual --sheet "<sheets 2, 3: the village, the fields to the north>"
    house add manual --town L0001 --what "<the listed monuments of the municipality, with their numbers>" --url https://example.org/monuments
    house add archive-only --town L0001 --archive "<regional archive>" --fond "<estate>" --signature "<book 3>" --what "<land register>"

Pictures only under a free licence, each with its licence and what it shows
(a number that can be read). Its houses are another task each: none of them here.
<!-- end -->
<!-- for house-research -->
## A house (with its neighbouring houses of the brief, if any)

1. **Which house, and where — first.** Today's number gives its point (the
   address register of the list, `--how today-number`). A historical number
   need not be today's: villages mostly kept theirs, towns renumbered (around
   1805–1815 and 1884). Say how sure the number's line is
   (`--how cadastre|old-map|description`); a renumbering is only proposed, with
   what shows it — the person confirms it:

    house add location A0001 --lat 49.61 --lon 15.12 --how today-number --certainty high --url https://example.org/point
    house add number A0001 --number 9 --until 1850 --proposed --text "<the same family under no. 9 and no. 16>" --source S0001

   **The house cannot be identified** (gone, a renumbering not sure): ask the
   person at once — `strom task wait T0001 --on "…"` and
   `strom house add unknown A0001 --text "…"` — no further search.
2. **The list of the brief**, each source that can speak of this house: the
   address register, the field names at its point, the water courses, the
   orthophoto of today and old aerial photos, what the skeleton's topography
   says of its number, local websites. **A special house** (a mill, an inn, a
   smithy, a parish, a school): the other buildings of the same kind in the
   municipality, its water course, where its holder came from.
3. **Its timeline, its holders and its residents** — from the censuses by
   number where an allowed archive has them, the registers by number, the land
   registers. Holders (from – until, how: purchase, inheritance, marriage,
   auction, allotment) apart from residents (farmer, retired, lodger, servant,
   tenant). A census names the holder only in 1910 and 1921. People off the
   tree are residents of the house, never new people of the tree:

    house add holder A0001 --name "<holder>" --since 1858 --until 1890 --how inheritance --source S0001 --locator "fol. 12" --certainty high
    house add resident A0001 --name "<resident>" --role retired --since 1890 --until 1895 --source S0001
    house add event A0001 --kind fire --date 1868 --text "<what the chronicle says>" --certainty medium --url https://example.org/chronicle

4. **Its look, always, in short**: the kind and material of the building by
   what was found (`--image` only under a free licence) — or what is not known
   of it, and why:

    house add look A0001 --text "<a ground-floor house, its gable to the green>" --certainty guess --image https://example.org/photo --license "CC BY 4.0"
    house add unknown A0001 --look --text "<no picture of it; the indication sketch only by hand>"
    house add map A0001 --layer <id>

   A map layer strom ships for the house's region (`strom help house add map`)
   is drawn by the Strom app itself: name it, never its address.
5. **End**: what is not known, what is only in a reading room, the one line of
   the list — and **the look check**: is there more of its look to find?
   `material` (given to the house, nobody has read it), `picture` (a picture
   of the municipality seems to show the house), `source` (a source in hand
   describes the building more than its look says) — a task of its look
   follows; else `none`, with why (strom writes what is not known of it):

    house add unknown A0001 --text "<who held the house from 1856 to 1858?>"
    house add archive-only A0001 --archive "<regional archive>" --fond "<district court>" --signature "<book 12>" --what "<land register>"
    house add manual A0001 --what "<the indication sketch: cadastral area, sheet 2, parcel 34>" --url https://example.org/sketch
    house add look-check A0001 --next none --text "<no picture of it; the sketch only by hand>"

   What was gone through before (the brief) is not gone through again; a house
   asked for again only adds what is missing. What is left by hand or in a
   reading room is a list for the person, never a new task.
<!-- end -->
<!-- for house-look -->
## The look of a house (after its research)

The research of the house found more of its look to read (the brief: why).
Read only that — the material at the house or its municipality, the picture
that seems to show it, the source that describes it, the old aerial photo at
its point — and write what it says:

    house add look A0001 --text "<a brick farmhouse with a barn, its gable to the green>" --certainty medium --image https://example.org/photo --license "CC BY 4.0"

What more of it can only be found by hand: `house add unknown A0001 --look
--text "…"` and `house add manual A0001 …` (the indication sketch: the
cadastral area, the sheet, the parcel, its link). Nothing else of the house.
<!-- end -->
<!-- for house-town house-research house-look -->
## Sources, and what never goes out

- **Only public sources and the archives allowed in archives.json**, their
  robots.txt and terms as strom enforces them (`strom net web --check <url>`).
  A site whose terms forbid AI by name: only a link by hand
  (`strom house add manual A0001`), never read. Nothing logged into, bought,
  ordered or sent. Downloads only under a free licence, else the link.
- **Out only the municipality, the house number, its coordinates and the names
  of people who died more than a hundred years ago.** Today's holders and
  residents are never looked for nor written; an event of the 20th century
  that is sensitive (a confiscation, an expulsion) with `--sensitive`.
- Then look at it whole (`strom house show A0001`, the skeleton:
  `strom house show --town L0001`) and close the task.
<!-- end -->
<!-- for house-takeover -->
# Method: taking over the research of a house

The person researched a house themselves; `strom house import` made its
record (A…), kept their text unchanged as material (I…) and gave you this
task. **Search nothing new**: write what the text says into the house, each
item with `--from` the material and the certainty the text gives it (never
raised), a source it names with `--source` or `--url`:

    house add holder A0001 --name "<holder>" --since 1858 --until 1890 --certainty high --from I0003
    house add event A0001 --kind fire --date 1868 --text "<what the text says>" --certainty medium --from I0003

The same for its residents, numbers, point, open questions, what is only in an
archive's reading room, its look and maps (`strom help house add`). A
renumbering the text only supposes, the person confirms:
`strom house add number A0001 --number 9 --proposed --from I0003`.

Its links are taken in already — those it went through and those left to open
by hand or in a reading room: do not open them again. Files beside the text
(images, map data) are only listed in the task; one joins the house
(`strom house add material A0001 --input I…`) only where its licence is free.
Nothing of a house in it: `strom input skip I0003 --reason "…"`. Then look at
the house whole (`strom house show A0001`) and close the task.
<!-- end -->
