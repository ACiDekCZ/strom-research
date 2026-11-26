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
