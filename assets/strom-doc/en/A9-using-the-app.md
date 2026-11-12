<a id="A9"></a>
# A9 Using the app

Where things are in the Strom app, what the controls are called and what stays with a person. It applies the same
to a person, to a screen reader and to an agent that reads the page with a browser's tools. It describes the Strom
app 3.25.0 and the research 1.29.0.

<!-- zdroj: dirigent:spec/063-computer-use-usnadnit K1.1, K1.3, K1.4, K1.5 · test/vysledek-063-pruzkum.md kolo 2 (A1–A7) · app:CHANGELOG.cs.md 3.25.0 -->

<a id="A9.1"></a>
## A9.1 Where things are

The app shows the surroundings of one person ([A1.3](A1-the-app-in-brief.md#A1.3)). What concerns a person is in the
person menu; what concerns the whole tree is in the bar and in the **Actions** menu.

| Task | Where in the app | Rule |
|---|---|---|
| find a person | the field **Search person...** in the bar | [A4.8](A4-surnames-and-families.md#A4.8) |
| the person menu | a click on a person's card, or Enter on the card; on a touch device a long press on the card opens a bottom sheet with the same actions | [A6.1](A6-views.md#A6.1) |
| what the research knows about a person | person menu → **Research → What the research knows** | [S3.2](S3-what-the-research-knows.md#S3.2) |
| a person's sources | person menu → **Sources** | [A3.6](A3-evidence-in-the-app.md#A3.6) |
| the tree's sources | **Actions → Sources** | [A3.1](A3-evidence-in-the-app.md#A3.1) |
| edit a person | person menu → **Edit** | [S2](S2-edits-from-the-app.md), while following [A9.3](#A9.3) |
| the Map view and other views | the view switch in the bar; in a narrow window and on a phone **More → View** | [A6](A6-views.md) |
| the whole tree in rows, CSV and XLSX export | **Table** in the view switch; in a narrow window and on a phone **More → View → Table** | [A6.7](A6-views.md#A6.7) |
| the map's base layer | **Show the map** at the notice that the base layer loads from openstreetmap.org | [A9.4](#A9.4) |
| places off the map | the map's status bar → **In the research**; in the research the section **Awaiting action** | [A6.5.2](A6-views.md#A6.5.2), [R4.5](R4-places.md#R4.5) |
| the research's work | the research panel, **⤢ Open overview**; menu **Research → Research overview** | [S4.1](S4-research-from-the-app.md#S4.1) |
| what waits for a person | the panel, section **Awaiting action**; menu **Research → Awaiting action** | [S4.4](S4-research-from-the-app.md#S4.4) |
| following the research | **Follow live**; the end **Stop following** | [S1.4](S1-connecting-app-and-research.md#S1.4), [A9.3](#A9.3) |
| sending edits to the research | **Research → Other actions → Research for this tree… → Sending changes** | [S2.2](S2-edits-from-the-app.md#S2.2) |
| rules and terms | **Actions → How Strom works** | [A1.7](A1-the-app-in-brief.md#A1.7) |

- **Limits:**
  - the research's items are only at a tree from the research; the buttons that open the research only on the
    computer where the research runs ([S3.2](S3-what-the-research-knows.md#S3.2));
  - the app connects to the research by a link from the terminal, `strom app` ([S1.2](S1-connecting-app-and-research.md#S1.2)).
- **Controls:** as in the table.
- **Since:** app 3.25.0 (summary; each place applies since the version in its rule)

<!-- zdroj: app:index.html search input (search.placeholder) · src/renderer.ts card.onclick → UI.showContextMenu, klávesy Enter/Space · src/ui/bottom-sheet.ts (dlouhý stisk, menu.sectionView) · SPEC.md Long-press → bottom sheet · strings.ts search.placeholder, mobileMenu.more, menu.sectionView, map.tilesNotice, map.tilesNoticeOk, research.stop · cesty z pravidel A3.1, A3.6, A6, A6.5.2, S1.4, S2.2, S3.2, S4.1, S4.4, A1.7 -->

<a id="A9.2"></a>
## A9.2 Controls have a readable name

Every control has a name that a screen reader reads, and so does a browser's tool that reads the page. The look does
not change by it.

- **Limits:**
  - buttons with only an icon have a name: zoom, filters, back and forward, rotating a photo, the preview, the list at
    the person search (**Show list**), a linked file, the link to a place's source (**Open the source**) and others;
  - closed dialogs and menus are not read: they are neither in the accessibility tree nor in what a browser's tool
    finds on the page;
  - the bottom sheet takes no click or tap while it slides in, so that no other item is hit;
  - with reduced motion (a system setting) menus, notices and the bottom sheet appear without animation;
  - a greyed-out item is read with its reason too, but starts nothing ([A9.3](#A9.3)).
- **Controls:** nothing: it applies by itself. Reduced motion: the system settings.
- **Since:** app 3.25.0

<!-- zdroj: app:commity c641f7b8 (aria-label ikonových prvků, e2e a11y-names), 76f08f6a + 322b08c3 (zavřené dialogy a menu mimo strom přístupnosti, spodní panel inert při vysouvání, prefers-reduced-motion), 4a8b4fed · strings.ts personPicker.showList, places…dSourceOpen · CHANGELOG.cs.md 3.25.0 „Čtečky obrazovky“ · dirigent:test/vysledek-063-pruzkum.md A1–A3 -->

<a id="A9.3"></a>
## A9.3 Editing while following the research

A tree that is followed live is read-only ([S1.4](S1-connecting-app-and-research.md#S1.4)). The app shows why an
edit does not go and how to stop following.

- **Limits:**
  - while following, the person menu shows a greyed-out **Edit** with the reason **Read-only while following the
    research.** and right under it **Stop following**. It applies on a computer and on a phone;
  - **Stop following** in the person menu stops following the same way as the button in the research panel;
  - after following stops, the app right away asks once **How should changes go to the research?**, when it has not
    asked at the tree yet and the research runs and takes edits ([S2.2](S2-edits-from-the-app.md#S2.2)).
- **Controls:** app: person menu → **Stop following**; the research panel → **Stop following**.
- **Since:** app 3.25.0

<!-- zdroj: app:src/ui/context-menu.ts (edit-following disabled + note, live-stop link), src/ui/bottom-sheet.ts (aria-disabled), src/ui/research-sync-ui.ts researchAskSendModeAfterFollow · strings.ts contextMenu.editFollowing, research.stop, treeSettings.askTitle · commity ffed0d42, cc26c35a, cf0352cd · CHANGELOG.cs.md 3.25.0 „Úpravy během sledování výzkumu“ · dirigent:spec/063-computer-use-usnadnit K1.4 -->

<a id="A9.4"></a>
## A9.4 The agent in the app

An agent that controls the Strom app controls it by the page tools in the browser, the same way a screen reader reads
it. The research's actions go more reliably by the command `strom`. strom nowhere recommends turning computer use on
([R12.10](R12-where-the-agent-works.md#R12.10)).

- **Limits:**
  - the page tools are in the Claude app's built-in browser and in Claude in Chrome. Computer use in the Claude app
    only reads a browser (a screenshot): clicking and typing in it does not go
    ([R12.10](R12-where-the-agent-works.md#R12.10));
  - the bridge to the Strom app stays closed to the agent: the agent works with the page, not with the bridge
    ([R12.2](R12-where-the-agent-works.md#R12.2));
  - the consent to the map's base layer (**Show the map**), the question **How should changes go to the research?**
    and a person's other choices and settings stay with the person.
- **Method only:** the agent clicks a control by the reference that the page's find tool gave it, not by coordinates,
  and waits until the bottom sheet has stopped before it clicks again. It does the research's actions by the command
  `strom` in its command line; in the app only what the command does not have. It does not click a person's choice:
  it says what waits for the person.
- **Controls:** nothing: the instructions in the research folder apply (`AGENTS.md`).
- **Since:** research 1.29.0; app 3.25.0

<!-- zdroj: research:src/agents/files.ts AGENTS.md „## When you have computer use“ (page tools, click by the reference find gives, never by coordinates, wait until a sliding panel has stopped; Claude's computer use only looks at browsers; research through strom; consent or setting left to the person: map's OpenStreetMap, how edits are sent) · CHANGELOG.cs.md 1.29.0 · src/core/browser.ts + src/core/bridgeguard.ts (most odmítnut) · dirigent:test/vysledek-063-pruzkum.md kolo 1 (úrovně), kolo 2 (klik přes ref z find spolehlivý, klik podle souřadnic během vysouvání trefil jinou položku; souhlas Zobrazit mapu nekliknut; místo mimo mapu v Čeká na vyřízení) · spec/063-computer-use-usnadnit K1.2, K1.3, K1.5 -->
