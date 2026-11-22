# Method: census records

A census lists one household in one year: who lived together in a house, how
each is related to its head, their ages or years of birth, often the
birthplace, the place they belong to and an occupation. It shows where a
family moved and where someone came from — clues the registers lack. This page
holds only while the person has census records on for the research.

## When

- Where a person came from is unknown (the baptism not found where they
  lived), or there is a gap between events of the registers (a move, children
  dying elsewhere, a second marriage).
- A house is known from a baptism, marriage or burial in a year close to a
  census year.
- Only people the tree reaches (the tree first: nothing off it), never anyone
  living.
- One task per household, year and house — never one per person
  (`strom task add … --census <year>:<house>`).

## Where

The brief names the census records strom knows of (years, area, a name index,
how a household is found, the way for strom). Their archive's level and
terms hold as for any record; you never read its terms anew. Neither
browse house numbers nor search for people the tree does not need.

1. Find the census of the place and year in the archive's catalogue — one
   search, never stepping through numbers.
2. In it, the house by its number. Where there is a name index, search by the
   name and check the house number.
3. Most archives only show their census sheets: then the task waits for the
   person — `strom task wait T… --kind web --url <the census of the place>
   --on "<place, year, house number: the whole sheet, both sides>"`, or
   `--images B…:<numbers>` where the census is a record set. A sheet too large
   for one screenshot comes in parts.
4. Not found (the census of the place lost, the house missing, the family
   elsewhere): `strom search add … --result negative`, exactly what was
   covered, and do not come back to it.

## Reading and recording

- Read the sheet like a register entry (the reading method), the whole
  household and the head of the house.
- Record the household once: `strom census add --source S… --date <day or
  year> --place L… --house <n> --member P…:"<role>":<age> … --others "<people
  off the tree>"` — one shared census event for the members of the tree, the
  role their relation to the head as the sheet says it, the age as written;
  people off the tree only in `--others`. Each year its own household, never
  merged.
- **Clues, not proof.** A birth year or birthplace, the place one belongs to
  or an occupation from a census never stands for a birth or a baptism: they
  lead to the register — a `locate` task for the parish of that birthplace.
  Where a census disagrees with a register, a note or a hypothesis — the
  register's fact is never changed for it.
- **Renumbered houses.** House numbers changed (renumbering, parts of a
  place, two series): know a house also by its neighbours and the names, not
  the number alone; say what is uncertain in a note.
