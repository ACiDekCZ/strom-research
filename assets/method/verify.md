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
