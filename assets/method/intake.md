# Method: processing an input

An input is material the user gave you: scans, photos, documents, notes, a
family tree. Your job is to turn it into evidence without inventing anything.

1. `strom input show I…` — read the file (images and PDFs directly, text is
   shown). Identify who it is about and what kind of document it is.
2. **What is it?** An original civil or church document (birth, marriage or
   death certificate, extract from a register, military papers) is a **source**
   and can prove facts: `strom source add … --input I… --form original
   --information primary` (primary if written at the time of the event).
   A photo, letter, family tree or someone's memory is authored or derivative:
   everything taken from it stays a **lead**. What the user tells you is
   `strom source add "<what it is>" --kind family-memory --form authored
   --information secondary --input I…`; a family tree is `--kind family-tree`.
   Many facts from one input: one `strom batch --file notes/<input>.txt`
   (try it with `--dry-run` first).
3. Record every person and every fact it states, with a citation to the source
   (`--cite S… --locator "…"`). Use the words of the record in `--quote`.
4. Put names and places as they are written; normalise only dates.
5. For imported family trees: check for duplicates and impossible dates, but do
   not "correct" them from memory — they are leads. A person of the tree who is
   already researched here (the brief lists the likely ones) is merged INTO the
   researched person, which keeps its evidence: `strom person merge <ours>
   <imported> --reason "…"` — their parents first (`strom family merge`). What
   the tree says differently stays a lead or becomes a conflict, never a fact.
6. Create the next tasks: where would the records that prove these leads be?
   (`locate` if the archive or book is unknown, `link` if it is known.)
7. Close the task with what came out of it (`strom task done T… --result "…"`;
   its input is marked processed with it).

## A batch from the Strom app (many files at once)

The user sent a folder, a ZIP or a box of papers from the Strom app; the task
lists about 25 of its files, with the path each had there
(`Babička/Dopisy/1946.jpg` — the folders say much). They are kept unchanged
outside the tree's history: what you do not record of them stays private.

1. **Look over all of them first, cheaply**: `strom input show I…` for each —
   the name, the path, the type; images in a small view (`strom media view
   I… --grid`), not read whole. Sort each at once: `strom input sort I… [I…]
   --as source|document|photo|unrelated --person P…`. Read in depth only what
   belongs to the people of the research.
2. **Not of the family** (a tax form, a holiday photo of strangers, the same
   picture again in another size): `--as unrelated --reason "…"` and nothing
   of it is written anywhere. Someone living: sort it, record nothing of them.
3. **Scans of a book** (many numbered images of one register): not read file
   by file — `strom recordset add "<the book>" …`, then `strom media add
   --from-input I… --recordset B…` (the numbers come from their names); then
   read the entries you need as from any book.
4. **A record or document**: as above (steps 2–4), `--input I…` on the source,
   then `strom input sort I… --as source --source S…`.
5. Close the task when every file of it is sorted; the next part of the batch
   is its own task.
