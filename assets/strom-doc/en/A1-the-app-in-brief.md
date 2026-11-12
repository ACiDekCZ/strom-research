<a id="A1"></a>
# A1 The app in brief

How the Strom app works as a whole, on one page. Each section leads to a chapter with the exact rules. Describes the
Strom app 3.21.2 and the research 1.25.2; changes from a later version carry its number.

<a id="A1.1"></a>
## A1.1 A family tree in the browser, data on the device

The Strom app is a family tree in the browser (stromapp.info) or in one HTML file. Trees are stored in the browser's
storage on this device. There is no account and no server with the data.

- **Limits:**
  - the browser's storage belongs to one browser on one device. A tree moves to another device as a file
    (JSON backup, GEDCOM, standalone HTML, [A7](A7-book-pages-and-export.md));
  - encryption with a password (**Encrypt data**, **Unlock data**, the export **Encrypt with a password**, an
    encrypted file) works only at a secure address: over https, on `localhost` or `127.0.0.1` and in a file opened
    from the disk. At an `http://` address in a network (e.g. the app on one's own server in a home network) the
    browser does not allow it. The password dialog says so right after it opens: “Encryption works only over https
    or on this computer (localhost). This address is not secure.” Saving a tree with photos does not need encryption.
- **Since:** app 1.0.0; 3.27.0: the message about an address that is not secure (before, the password reported
  “Incorrect password” there)

<!-- zdroj: app:strings.ts about.description, embeddedMode.infoText1, embeddedMode.infoText2 · šifrování: app:src/crypto.ts isCryptoAvailable (isSecureContext, crypto.subtle), classifyCryptoError (jen OperationError = špatné heslo) · src/crypto-errors.ts cryptoFailureText, resetPasswordError (hláška při otevření dialogu), requireCrypto · src/ui/encryption-ui.ts, src/ui/import-export.ts · strings.ts encryption.enable, unlockData, encryptToggle, wrongPassword, insecureContext · commity 266d6a76, cceadca6 (SHA-256 obrázků bez crypto.subtle) · GitHub #13 · dirigent:prace/1110-app-github-11-13 (https, localhost/127.0.0.1, soubor z disku) -->

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
one family line. From app 3.27.0 the **Table** view shows the whole tree in rows of people, unions, events or
sources, with computed values, completeness and the findings of the check.

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

<a id="A1.7"></a>
## A1.7 How Strom works in the app

This documentation is carried in the app and can be read offline too. The window **How Strom works** has the contents
of parts A, R and S, the **Glossary** and a search by a word or by the number of a rule.

- **Limits:**
  - opening the window sends nothing and loads nothing from the network;
  - the number of a rule and Enter jump straight to the rule (`R4.3`); an unknown number shows the contents;
  - links between rules have **Back**; **On the web** opens the same rule on stromapp.info;
  - a rule newer than the connected research says so (“The research connected to this tree is version …; this
    applies from …”).
- **Controls:** app: **Actions → How Strom works**, on the phone **More → How Strom works**, or **About Strom → How
  Strom works**. The circle **?** in a header opens the help right at the rule: in the Research overview and the small
  panel at the sections **Queue** ([R2.4](R2-lines-and-queue.md#R2.4)), **Awaiting action**
  ([R6.4](R6-awaiting-action.md#R6.4)) and **Now** ([R7](R7-when-the-agent-works.md), when paused
  [R7.6](R7-when-the-agent-works.md#R7.6)), in the window **Places** ([R4.5](R4-places.md#R4.5)), in the places
  manager ([R4.4](R4-places.md#R4.4)), in the conflicts panel ([R5.3](R5-conflicts.md#R5.3)) and in **What the
  research knows → Conflicts** ([R5.6](R5-conflicts.md#R5.6)). In the research:
  `strom doc` ([R1.8](R1-research-in-brief.md#R1.8)).
- **Since:** app 3.24.0

<!-- zdroj: app:src/help/help-data.ts, src/help/topics.ts HELP_TOPICS · src/ui/help-mark.ts · strings.ts help.title, index, search, searchPh, web, back, unknown, verRes, topics · vendor/strom-doc/PIN · prace/1105-app-napoveda-impl (§1–§11, e2e help.spec: otevření okna bez síťového požadavku) -->
