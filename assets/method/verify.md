# Method: independent verification

A conclusion that stands on one hard-to-read cell (a house number, an age, a
first name) needs a second, independent reading.

- The second reader must be **blind**: do not tell them the expected value, the
  name, the place or why it matters. Ask only what is written in that cell.
- One cell, one second reader — not the whole page again.
- Before asking, check whether two readings already exist (`strom find`; what
  readers wrote of an image: `strom readings B0001 --image 57`).
- Certainty above "probable" only when two independent readings agree. When
  they disagree, record a conflict with both readings.
- An independent reading of an entry you cited: `strom read M… --blind --crop
  x,y,w,h --question "Transcribe this entry completely; mark what is uncertain
  with [?]"` — a reader who knows nothing of your conclusion reads it at full
  resolution. Where it differs from your reading (a digit, a name), look again
  at that spot; what stays uncertain goes into the note, and a real
  disagreement between two readings is a conflict, not a choice.
- What the user transcribed in the Strom app (a task "Read for the research what
  the user wrote…"): find each record the source names (its book, page, archive),
  register its image, and read it blind yourself. Agreeing → a note on the
  source that the research read it too (`strom source edit S… --note`), the
  facts stay; differing → a conflict with both readings. Never overwrite the
  user's transcript, never take it for proven.
- A task verifying facts against their originals may hold the name of a
  person's identity (`P0001.N`) beside their birth or baptism: the entry that
  gives the date gives the name too. Compare the name in the entry with the
  person's: the same name in Latin or another language's form ("Wenceslaus"
  for "Václav", "Joannes" for "Jan") agrees → `strom verify done P0001.N
  --proven --image M…`; another name, or a doubt that stays → `strom verify
  done P0001.N --kept --reason "…"` with a conflict or the entry's form as a
  name of its own (`strom name add … --cite S…`). The name itself is never
  changed there; a name the user confirmed against the scan is theirs.
