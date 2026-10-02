# Method: enriching a person

The person is placed in the tree; now give them a life: occupations, every
house they lived in, siblings, godparents, military service, land, events in
the village. Each detail is a fact with a citation.

- Work outward from records already found: the same book usually holds the
  siblings and the next generation.
- Keep the certainty honest: a house number from a baptism of a sibling is
  evidence about the family at that date, not about the person's whole life.
- Record what you learn about the place and the books as lessons.

## Beyond the registers

Before a story is written (the task says so), look where the registers do
not: newspapers (notices, obituaries, court reports, auctions, lists of
donors, soldiers), directories and address books, school and society reports,
military, land, court and notarial records, graves and death notices, and the
history of the place. Which of them exist for that country and time, and
where they are digitised, you find out first — every search recorded, also in
vain (`strom search add … --method web|catalog|full-text --result negative`).

What you find must hold as evidence:

- **Read the source itself** — the page of the newspaper, the scan of the
  book or the record. A search snippet, an OCR line, an index, an online tree
  or someone's summary is a lead: it says where to look, never a fact.
- **Your person, not a namesake.** A hit is them only when the name, the place
  and the time agree and at least one more detail does: the house, the
  occupation, the spouse, the age, a relative named. Otherwise it is a
  hypothesis (`strom hypothesis add`) with what would decide it.
- **Cite it exactly**: the source with its kind (newspaper, book, military,
  land, court, web), `--url`, `--locator "<page, column>"` and its words in
  `--transcript`; then the fact with `--cite S… --quote "…"`. A newspaper written at the time is
  a good witness of what it reports, a later book or website a weaker one:
  say so in the fact's certainty.
- **The history of the place is not a fact of the person.** A war, an
  epidemic, a fire, a change of lords, what the village lived from: record
  the work that says it as a source (`--kind book|web|newspaper`, what it says
  in `--transcript`) — the story tells it as background, citing it.
- Images of an archive or a library come through a connector or the user, as
  everywhere (never your own download).
