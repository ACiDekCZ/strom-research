<!-- for house-town house-research -->
# Method: the history of a house

The brief gives what the research knows already, for free: the people of the
tree in each house with their facts and years (never looked up again), the
municipality's skeleton, what was gone through (never again) and what is only
by hand. Write each finding as it comes, with its source (`--source`,
`--locator`, or `--url`) and its certainty: `high` (the record says it),
`medium` (a careful reading or a good secondary source), `guess` (a
supposition — said so). Never raised past what the source gives.
<!-- end -->
<!-- for house-town -->
## A municipality's skeleton (once for all its houses)

What the houses of the municipality stand on: its lordship and estate, its
parish (and the parishes its houses belonged to), its cadastral area, its old
names, where its land registers and urbaria are (archive, fonds, what is
online), the map sheets of it (the stable cadastre, the military surveys, the
orthophoto of today and of the 1950s), its chronicle and topography. Nothing the
identification of the place has already (`strom place show L0001`: names,
jurisdictions) — only what it lacks. Then:

    house add summary --town L0001 --text "<lordship, parish, cadastral area, land registers>"
    house add archive-only --town L0001 --archive "<regional archive>" --fond "<estate>" --signature "<book 3>" --what "<land register>"
    house add map --town L0001 --kind cadastre --url https://example.org/sheet --manual --sheet "<sheet 2>"
    house add passed --town L0001 --what "<topography of the district, volume and pages>" --found yes

Its houses are another task each: none of them here.
<!-- end -->
<!-- for house-research -->
## A house (with its neighbouring houses of the brief, if any)

1. **Which house, and where — first.** Today's number gives its point: the
   address points of the land registry's map service allowed in archives.json
   (`--how today-number`). A historical number need not be today's: villages
   mostly kept theirs, towns renumbered (around 1805–1815 and 1884). Say how
   sure the number's line is (`--how cadastre|old-map|description`); a
   renumbering is only proposed, with what shows it (the same family under
   two numbers in near years) — the person confirms it:

    house add location A0001 --lat 49.61 --lon 15.12 --how today-number --certainty high --url https://example.org/point
    house add number A0001 --number 9 --until 1850 --proposed --text "<the same family under no. 9 and no. 16>" --source S0001

   **The house cannot be identified** (gone, a renumbering not sure): ask the
   person at once — `strom task wait T0001 --on "…"` and
   `strom house add unknown A0001 --text "…"` — no further search, no task "to
   be sure".
2. **From today back**: the censuses by number where an allowed archive
   has them (else a link by hand), the registers of every parish of the
   municipality by number (the names of the census lead into the indexes),
   the cadastre as a link, the land registers.
3. **Its timeline, its holders and its residents.** Holders (from – until, how:
   purchase, inheritance, marriage, auction, allotment) apart from residents
   (farmer, retired, lodger, servant, tenant). A census names the holder only in
   1910 and 1921 (1890 and 1900: the head of the household). People off the tree
   are residents of the house, never new people of the tree:

    house add holder A0001 --name "<holder>" --since 1858 --until 1890 --how inheritance --source S0001 --locator "fol. 12" --certainty high
    house add resident A0001 --name "<resident>" --role retired --since 1890 --until 1895 --source S0001
    house add event A0001 --kind fire --date 1868 --text "<what the chronicle says>" --certainty medium --url https://example.org/chronicle

4. **Its look**: the kind and material of the building by the cadastre and
   descriptions, pictures only under a free licence (else their address):

    house add look A0001 --text "<a ground-floor house, its gable to the green>" --certainty guess --image https://example.org/photo --license "CC BY 4.0"
    house add map A0001 --kind ortho-1950 --url https://example.org/ortho

   A map layer strom ships for the house's region (`strom help house add`,
   `--layer`) is drawn by the Strom app itself: name it, never its address:

    house add map A0001 --layer <id>

5. **End with three lists** — what was gone through (with or without a
   find: books and years), what is not known (open questions, disputed
   readings), what is only in a reading room (archive, fonds, call number):

    house add passed A0001 --what "<register and its years, entries with no. 9>" --source S0001 --found no
    house add unknown A0001 --text "<who held the house from 1856 to 1858?>"
    house add archive-only A0001 --archive "<regional archive>" --fond "<district court>" --signature "<book 12>" --what "<land register>"

   What was gone through before (the brief) is not gone through again; a house
   asked for again only adds what is missing. What is left by hand or in a
   reading room is a list for the person, never a new task.
<!-- end -->
<!-- for house-town house-research -->
## Sources, and what never goes out

- **Only public sources and the archives allowed in archives.json**, their
  robots.txt and terms as strom enforces them (`strom net web --check <url>`).
  A site whose terms forbid AI by name: only a link by hand (`strom house add manual A0001`), never read. Nothing logged into, bought, ordered or sent (forms,
  questions to archives). Downloads only under a free licence, else the link.
- **Out only the municipality, the house number, its coordinates and the names
  of people who died more than a hundred years ago.** Today's holders and
  residents are never looked for nor written (strom refuses an open holder or
  resident of the last hundred years without a person of the tree); an event of
  the 20th century that is sensitive (a confiscation, an expulsion) with
  `--sensitive`.
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
