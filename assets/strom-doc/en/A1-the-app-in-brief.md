<a id="A1"></a>
# A1 The app in brief

How the Strom app works as a whole, on one page. Each section leads to a chapter with the exact rules. Describes the
Strom app 3.21.2 and the research 1.25.2.

<a id="A1.1"></a>
## A1.1 A family tree in the browser, data on the device

The Strom app is a family tree in the browser (stromapp.info) or in one HTML file. Trees are stored in the browser's
storage on this device. There is no account and no server with the data.

- **Limits:** the browser's storage belongs to one browser on one device. A tree moves to another device as a file
  (JSON backup, GEDCOM, standalone HTML, [A7](A7-book-pages-and-export.md)).
- **Since:** app 1.0.0

<!-- zdroj: app:strings.ts about.description, embeddedMode.infoText1, embeddedMode.infoText2 -->

<a id="A1.2"></a>
## A1.2 People, relationships and family lines

A tree is made of people and the relationships between them: parents and children, partners and their unions. From
the tree the app builds **family lines**: a family line is the male line from the oldest known bearer of the name,
with its members and with those who married into it. The app knows a surname in its female and male form (Horák and
Horáková, Jaworski and Jaworska).

- In detail: [A4](A4-surnames-and-families.md).

<a id="A1.3"></a>
## A1.3 Views: the surroundings of one person

The app always shows the surroundings of one **central person**, not the whole tree at once. The views **Family**,
**Descendants**, **Timeline**, **Fan** and **Map** read the same surroundings in different ways. A view can highlight
one family line.

- In detail: [A6](A6-views.md).

<a id="A1.4"></a>
## A1.4 Loading and outputs

A family tree from another program is loaded from a GEDCOM file. The app says what it took over and what it skipped.
It puts out a backup, GEDCOM, a family book, family pages and tree pages, a person page, a poster and a standalone
HTML file. By default it protects living people in them.

- Loading: [A2](A2-loading-a-family-tree.md). Merging trees: [A8](A8-merging-trees.md). Outputs and the privacy of
  living people: [A7](A7-book-pages-and-export.md).

<a id="A1.5"></a>
## A1.5 Sources, evidence and checks

Sources, citations, record clippings and attachments are recorded for the facts. The app shows where evidence is
missing, and the tree check looks for errors and inconsistencies in the data.

- Evidence: [A3](A3-evidence-in-the-app.md), levels of certainty [R3.8](R3-verification-and-citation.md#R3.8).
  The tree check: [A5](A5-tree-check.md).

<a id="A1.6"></a>
## A1.6 The app and the research

The app works without the research too. With Strom Research on the same computer it shows the research's tree, its
work and what the research knows about people, and it sends edits back to the research
([R1.6](R1-research-in-brief.md#R1.6)).

- Connection: [S1](S1-connecting-app-and-research.md). Edits from the app: [S2](S2-edits-from-the-app.md).
  What the research knows: [S3](S3-what-the-research-knows.md). The research run from the app:
  [S4](S4-research-from-the-app.md). Phone: [S5](S5-phone.md).
