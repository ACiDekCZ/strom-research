# Method: independent verification

A conclusion that stands on one hard-to-read cell (a house number, an age, a
first name) needs a second, independent reading.

- The second reader must be **blind**: do not tell them the expected value, the
  name, the place or why it matters. Ask only what is written in that cell.
- One cell, one second reader — not the whole page again.
- Before asking, check whether two readings already exist (`strom find`).
- Certainty above "probable" only when two independent readings agree. When
  they disagree, record a conflict with both readings.
- An independent reading of an entry you cited: `strom read M… --blind --crop
  x,y,w,h --question "Transcribe this entry completely; mark what is uncertain
  with [?]"` — a reader who knows nothing of your conclusion reads it at full
  resolution. Where it differs from your reading (a digit, a name), look again
  at that spot; what stays uncertain goes into the note, and a real
  disagreement between two readings is a conflict, not a choice.
