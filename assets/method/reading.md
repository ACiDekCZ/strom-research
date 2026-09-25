# Method: reading scans

An image you open stays in your context and is paid for again on every turn.
Look at as few pixels as the question needs, and write down what you saw at once.

- **Look only through views**: `strom media view B0001:57` (record set and
  image number) makes a file in `.strom/views/` — open that file. Whole images
  come reduced: good for "is our surname on this page?", not for reading.
- **Find, then crop.** `--grid` overlays tenths with labels; read off where the
  entry is and ask for exactly that part: `--crop 0.05,0.40,0.45,0.18` (x, y,
  width, height as fractions) or `--half left|right` for one page of a spread.
  A crop comes at full resolution (small ones enlarged). `--contrast` for faded
  ink, `--rotate 90` for sideways pages.
- **Too small to read?** When a crop says it is enlarged, the scan has no more
  detail there. A connector that can fetch a part of an image sharper says so
  in that line: `strom fetch <connector> --recordset B0001 --images 57 --crop
  …` (one request). Then view the same crop again: it comes from the sharper
  part by itself.
- **Browsing a book is a reader's job**: `strom read B0001 --images 40-69
  --question "…"` — readers in batches of ten, each with the full question;
  their reports stay in notes/readings/ for the next session, you get the finds.
  It waits for its readers (often ten minutes or more): run it in the
  foreground and let it finish — your session ends with your turn, and
  whatever is left running in the background ends with it.
  (Your own subagents can read too, in batches of at most twelve — but what they
  report is lost with your session unless you write it down.) Only the entries
  that will be cited need your own eyes, at full resolution.
- Old handwriting is decoded, not copied: never a weaker model for handwriting,
  never a guess. "Illegible" is a valid and valuable answer.
- **Extract everything the first time**: names, ages, house numbers,
  occupations, godparents, witnesses, midwife, remarks in the margin.
- **Report image by image, as you go**: the image and page, what was found (or
  nothing), what was illegible and where, the hand, how sure each name is.
- **Cite the image, and where the entry is on it**: `strom source add …
  --clip B0001:57@0.05,0.40,0.45,0.18 --locator "pag. 112, 2nd entry"` — the
  crop you read it in, as its view prints it; a searched range goes in
  `strom search add … --pages 40-69`.
- Page ↔ image: `strom recordset calibrate B0001 --point 57=112` (measured on
  the image, never guessed); then `strom media view B0001 --page 112` works.
- **No images here yet:** a connector for that archive
  (`strom connector list`) fetches them through strom:
  `strom fetch <connector> <book> --images 40-69 --recordset B0001` — only the
  images you need, never a whole book "just in case".
- **The archive has no connector yet: build one — now, you.** The user does
  not know connectors exist and will not ask for one. Tell them in a sentence
  ("for this archive I am preparing a downloader; it will fetch only the images
  we need, slowly"), run `strom connector new <name> --url <portal>` and
  follow its DISCOVERY.md (the portal's terms and robots.txt first, official
  exports preferred), test it with `strom connector test`, then fetch. It is
  built once per archive and serves every later task.
- You never download from an archive yourself (curl, a script, your browser
  tools) — only through a connector, paced by strom. The user saves images by
  hand only where the archive does not allow automation (the connector then
  finds books and gives links only) or where a check stops it. Ask with
  `strom task wait T… --images B0001:40-69 --on "…"`: strom makes the folder
  of the inbox they go into, shows it to the user with the book's link, and
  checks the numbers of what arrives. Write `--on` for the user, in their
  language, so that they need nothing else: the book (title, call number),
  its link, which images as the portal's viewer counts them (or the pages and
  years, where you know only those), and that each is saved named by its
  number (40.jpg). Where the portal gives only a small image, add: zoom in on
  the entry and save that view too (40a.jpg); a full-resolution scan can be
  ordered from the archive. Then take the next task; when the images are
  registered the task comes back by itself.
