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
