# Method: enriching a person

The person is placed in the tree; now give them a life: occupations, every
house they lived in, siblings, godparents, military service, land, events in
the village. Each detail is a fact with a citation.

- Work outward from records already found: the same book usually holds the
  siblings and the next generation.
- Keep the certainty honest: a house number from a baptism of a sibling is
  evidence about the family at that date, not about the person's whole life.

## Beyond the registers

Before a story (the task says so), look where the registers do not:
newspapers, directories, school and society reports, military, land, court
and notarial records, graves, the history of the place — first which exist
for that country and time, and where they are digitised. Every search is
recorded, also in vain (`strom search add … --method web|catalog|full-text`).

- **Within the brief's budget of pages** fetched or read; then record what
  was searched and close. Printed pages go to the user's model for print
  where you can hand work to one (the brief names it) — never handwriting.
  The budget is the task's whole: pages through a connector count in it.
  More pages of one site than the web rule allows go through its connector,
  built right away when the task needs that site (`strom connector new
  <site>`, then `strom fetch`).
- **The history of a place once in a research**: what is written of it (the
  brief says) is reused, never searched again.
- **Read the source itself** — the page, the scan. A snippet, an OCR line,
  an index, an online tree or a summary is a lead, never a fact.
- **Your person, not a namesake**: name, place and time agree and one more
  detail does (house, occupation, spouse, age, a relative). Otherwise a
  hypothesis (`strom hypothesis add`) with what would decide it.
- **Cite it exactly**: the source with its kind, `--url`, its words in
  `--transcript`, `--locator "<page, column>"`; the fact with `--cite S…
  --quote "…"`. A newspaper of the time is a good witness, a later book or
  website a weaker one: say so in the fact's certainty.
- **The history of the place is not a fact of the person**: the work that
  says it is a source (`--kind book|web|newspaper`); the story tells it as
  background, citing it.
- Images of an archive or a library come through a connector or the user, as
  everywhere (never your own download).
