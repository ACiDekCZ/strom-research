<a id="S7"></a>
# S7 Zuverlässigkeit von Angaben und Prüfung an den Originalen

Bei jeder Angabe zeigt die App, wie zuverlässig sie ist, und das Kärtchen im Baum hat eine Marke für die ganze Person.
Die Forschung kann eine Angabe am Original des Eintrags prüfen: im Hintergrund, bei einer Angabe, bei einer Person oder
in einem großen Teil des Stammbaums. Gewissheit entsteht aber erst dadurch, dass **ein Mensch** die Angabe selbst mit
dem Scan des Eintrags vergleicht und sie bestätigt (**Anhand des Scans bestätigen**, [S7.8](#S7.8)). Die Prüfung durch
einen Agenten gibt höchstens **Belegt**; die Bestätigung durch einen Menschen ist stärker, und der Agent ändert sie nie.
Beschrieben werden die Strom-App 3.26.0 und die Forschung 1.30.0. Was nur mit der Brücke der Forschung geht und was
auch ohne sie, fasst [S7.9](#S7.9) zusammen.

<!-- zdroj: dirigent:spec/065-spolehlivost-a-znovu-overeni/spec.md · app:7b0471f8 CHANGELOG.cs.md 3.26.0 (Ověřit údaje, Jedna značka na kartičce) · research:6c6e7c3b CHANGELOG.cs.md 1.30.0 (ověření podle originálů) -->

<a id="S7.1"></a>
## S7.1 Die Marke an einer Angabe in der Personenkarte

In der Personenkarte hat jede Angabe eine Marke: wer sie bestätigt oder belegt hat, wie sicher die Forschung ist, oder
dass sie aus dem Stammbaum eines anderen Programms kam und niemand sie geprüft hat. Die Stufen unterscheiden sich durch
Häkchen, Punkte und Rahmen, nie nur durch die Farbe.

| Marke | Bedeutung (Beschriftung beim Darüberfahren) |
|---|---|
| **Bestätigt** (✓) | **Von einem Menschen bestätigt**: die Angabe hat ein Mensch anhand des Scans bestätigt, eingetragen oder zurückgesetzt, oder er hat einen Vorschlag der Forschung angenommen |
| **Belegt** (●●) | **Von KI belegt: zwei Leser des Eintrags übereinstimmend** |
| **Belegt** (●○) | **Von KI belegt: ein Leser des Eintrags** |
| Wahrscheinlich, Möglich, Hinweis | Grad der Sicherheit der Forschung ([R3.1](R3-verification-and-citation.md#R3.1)) |
| **Aus dem Stammbaum** (○○) | übernommen aus dem Stammbaum eines anderen Programms oder aus einem Stammbaum aus der App Strom, den die Forschung übernommen hat; ungeprüft ([S6.2](S6-tree-from-another-program.md#S6.2)) |

- **Popup der Marke** (nach einem Klick): die Quellen der Angabe; bei zwei Lesern **zwei Leser übereinstimmend**; bei
  einer Angabe, die nach der Prüfung wahrscheinlich oder möglich geblieben ist, die Zeile „Bleibt {stufe} · von der
  Recherche geprüft am {datum}“ und der Grund, warum sie sich nicht belegen ließ; bei einer bestätigten „✓ Am {datum}
  anhand des Scans bestätigt“; bei einer Angabe aus dem Stammbaum, die der Stammbaum zitiert, **im
  Stammbaum zitiert, in Strom nicht geprüft**. Im Popup sind auch die Aktionen **Prüfen** ([S7.3](#S7.3)), **Anhand des
  Scans bestätigen** und **Zurücknehmen** ([S7.8](#S7.8)), wo sie gelten.
- **Prüft der Code:**
  - zwei Punkte bekommt nur eine Angabe, bei der sich bei der Prüfung durch die Forschung zwei Leser des Eintrags
    einig waren ([R8.8.1](R8-reading-scans.md#R8.8.1)); eine anders belegte hat einen;
  - ✓ gibt nur ein Mensch: durch die Bestätigung anhand des Scans, oder indem er den Wert selbst geschrieben,
    geändert oder zurückgesetzt oder einen Vorschlag der Forschung angenommen hat. Eine Angabe, die die Forschung aus
    einem Stammbaum aus der App Strom übernommen hat und die seitdem niemand geändert hat, hat die Marke ihrer
    Sicherheitsstufe, ohne Stufe **Aus dem Stammbaum** (○○); ✓ nie ([S6.3](S6-tree-from-another-program.md#S6.3));
  - die Marken eines Forschungsbaums sind mit der Brücke und ohne sie gleich, auch gleich nach dem Laden der Seite:
    die App nimmt sie aus dem gespeicherten Stammbaum, nicht aus der laufenden Brücke;
  - die Bestätigung durch einen Menschen gilt nur, solange die Angabe den bestätigten Wert hat ([S7.8](#S7.8)).
- **Grenzen:** die Marke **Ohne Quelle** zeigt die App bei einer Angabe noch nicht: eine Angabe ohne Quelle hat keine
  Marke. Eine Person ohne Quelle zeigt die Marke auf dem Kärtchen ([S7.2](#S7.2)).
- **Bedienung:** Personenkarte → Marke bei der Angabe; Hilfe **Was die Marken bedeuten**. **Einstellungen →
  Personenkarte → Verlässlichkeit bei Angaben in der Personenkarte** (standardmäßig ein).
- **Gilt seit:** App 3.26.0, Forschung 1.30.0

<!-- zdroj: app:7b0471f8 src/reliability.ts (RELIABILITY_ORDER, reliabilityStep: readers ≥ 2 → dvě tečky; noSource se z aplikace nekrmí, verifyLocalEvidence dává jen confirmedByHuman) · src/verify.ts factVerifyReaders (_STROM_CHECKED proven, readers) · src/ui/fact-status.ts titleProven2/titleProven1 · src/ui/status-tip.ts readersAgree · src/settings.ts display.reliabilityCard (ON) · index.html settings-group-card · strings.ts reliability.*, verify.reasonHead, verify.confirmedAt · app:669c08f0 src/reliability.ts userTreeOrigin (_STROM_ORIGIN tree → import, nikdy human), treeOriginWords, reliabilityOptionsOf (původ z dat stromu, ne z mostu) · research:94d75934 src/core/model.ts ValueOrigin.tree, src/core/import.ts (soubor aplikace Strom → user + tree) -->

<a id="S7.2"></a>
## S7.2 Eine Marke auf der Karte im Baum

Das Kärtchen einer Person im Baum hat unten rechts eine Marke: wie gut die Person belegt ist und wer hinter ihren
Angaben steht. Sie nimmt die schwächste der drei Angaben des Kärtchens: Name, Geburt und Tod.

| Marke | Wann |
|---|---|
| ✓ | ein Mensch hat die Angabe bestätigt |
| ●● | belegt, unabhängig von der Zahl der Leser |
| ●○ | wahrscheinlich oder möglich mit einer Zitation des Originals oder einer Abschrift mit Primärinformation (Qualität 2 oder 3) |
| ○ | nur eine Spur: ein Hinweis, oder wahrscheinlich oder möglich ohne eine solche Zitation |
| ○○ (gestrichelt) | aus einem Stammbaum (eines anderen Programms oder aus der App Strom, von der Forschung übernommen), ungeprüft |
| gepunkteter Rahmen | ohne Quelle |

- **Prüft der Code:**
  - es zählen nur Angaben, die eine Stufe haben; hat weder der Name noch die Geburt noch der Tod eine, entscheiden die
    übrigen Angaben der Person und ihrer Familien (Wohnort, Beruf, Heirat): eine bestätigte oder belegte Angabe oder
    eine Zitation der Qualität 2 oder 3 genügt, und die Marke ist ●○ (die Person ist aus einem Eintrag bekannt, etwa
    als Vater in der Taufe eines Kindes);
  - ein Forschungsbaum, dessen gespeicherte Daten die Herkunft der Angaben von der Forschung tragen, hat die Marke
    nach Stufen gleich nach dem Laden der Seite, mit der Brücke und ohne sie gleich; das gilt auch für früher
    gespeicherte Stammbäume;
  - ein Stammbaum, der die Herkunft der Angaben nicht kennt (ohne Forschung und ohne Import aus einem anderen
    Programm), zeigt die Marke nach den Zitationen der Person: ●● belegt, ●○ teilweise belegt, gepunkteter Rahmen ohne
    Quelle. Ein Stammbaum ohne Quellen und ohne Herkunft hat keine Marke;
  - eine Platzhalterperson („?“) hat keine Marke.
- **Popup der Marke:** „Schwächste Angabe des Kärtchens: …“ und in Worten, was die Marke bedeutet.
- **Bedienung:** **Einstellungen → Personenkarte → Auf der Karte zeigen → Belege und Verlässlichkeit** (standardmäßig
  ein).
- **Gilt seit:** App 3.26.0

<!-- zdroj: app:7b0471f8 src/reliability.ts CARD_STATUS_FACTS, CardStatusClass, cardStatusClassOfFact, otherFactsClass, card status bez původu (full/partial/none) · src/ui/card-signals-ui.ts (signál status, CARD_SIGNAL_DEFAULTS vše zapnuto) · strings.ts cardDensity.cardShow, cardStatus, cardStatusSub, cardShowHint, reliability.cardFacts, cardMark.* · CHANGELOG.cs.md 3.26.0 (Jedna značka na kartičce) · app:669c08f0 src/reliability.ts reliabilityOptionsOf, treeOriginWords (strom výzkumu s původem v datech: stejně s mostem i bez) -->

<a id="S7.3"></a>
## S7.3 Prüfen an einer Angabe

Bei Geburt, Taufe, Heirat, Tod und Begräbnis, die weder belegt noch bestätigt sind, bietet das Popup der Marke
**Prüfen** an. Die Forschung prüft die Angabe dann am Original des Eintrags: im Hintergrund, außerhalb der Arbeit an
den Linien.

- **Vorschau vor dem Start** (**{angabe} prüfen**):
  - **Was** geprüft wird;
  - **Wie**: „KI liest den Eintrag {eintrag}“ (der Eintrag ist bekannt, günstig · ein bekannter Eintrag), oder „KI
    sucht den Eintrag nach dem Zitat im Stammbaum ({zitat}) und liest ihn“, oder auch „KI sucht den Eintrag in den
    Matriken und liest ihn“ (teurer · der Eintrag wird erst gesucht);
  - **Schätzung**: etwa wie viele Sitzungen des Agenten es braucht;
  - „Läuft im Hintergrund der Recherche. Das Ergebnis erscheint bei der Angabe.“ Bei der Suche zusätzlich „Wird der
    Eintrag nicht gefunden, bleibt die Angabe aus dem Stammbaum, und der Hinweis sagt warum.“
- **Nach dem Start** (**Prüfung starten**) hat die Angabe eine Marke mit einer Uhr „Wartet auf Prüfung · in der
  Warteschlange der Recherche, {position}. an der Reihe“, und **Prüfen** wird bei ihr nicht erneut angeboten.
- **Vorrangig prüfen:** eine Angabe, die die Forschung von selbst zur Prüfung eingereiht hat ([S7.6](#S7.6)) und die
  nicht als nächste an der Reihe ist, hat im Popup **Vorrangig prüfen**. Es folgt dieselbe Vorschau mit der Schätzung
  wie bei **Prüfen**; nach **Prüfung starten** stellt die Forschung die Aufgabe mit dieser Angabe an den Anfang der
  Warteschlange, und das Popup zeigt die Position, die die Forschung antwortet („1. an der Reihe“).
- **Prüft der Code:**
  - eine von einem Menschen erbetene Prüfung steht in der Warteschlange der Forschung an erster Stelle
    ([R2](R2-lines-and-queue.md));
  - **Prüfen** wird nur bei einem an die Forschung gebundenen Stammbaum angeboten, wenn die Brücke läuft und die
    Forschung das Prüfen beherrscht ([S7.9](#S7.9));
  - Name, Geschlecht, Scheidung und die übrigen Ereignisse werden nicht geprüft;
  - **Vorrangig prüfen** wird nicht angeboten bei einer Angabe, deren Prüfung ein Mensch schon erbeten hat (sie steht
    in der Warteschlange vorn), bei einer Angabe, die auf Scans oder auf die Erlaubnis eines Archivs wartet, bei der
    nächsten an der Reihe und wenn die Forschung die Position der Angabe nicht nennt. Eine Aufgabe, an der der Agent
    gerade arbeitet, stellt die Forschung nicht um.
- **Grenzen:** ein Stammbaum ohne Forschung hat im Popup statt der Aktion die Zeile „Mit der Ahnenforschung prüft ein
  KI-Agent die Angabe selbst in den Matriken.“ Antwortet die Forschung nicht: „Prüfung konnte nicht starten; die
  Recherche antwortet nicht.“; gibt es nichts zu prüfen: „Die Recherche hat hier gerade nichts zu prüfen.“ Lehnt die
  Forschung die Prüfung ab, sagt das Popup warum, zum Beispiel dass die Forschung ein Archiv ist, dass sie die Angabe
  nicht mehr hat oder dass sie gerade beschäftigt ist.
- **Bedienung:** App: Personenkarte → Marke der Angabe → **Prüfen** (oder **Vorrangig prüfen**) → **Prüfung
  starten**. Terminal: `strom verify facts P…|F…|E… [--fact …] [--dry-run]`.
- **Gilt seit:** Forschung 1.30.0, App 3.26.0

<!-- zdroj: app:7cf409bd src/verify-offer.ts verifyOffer (prioritize: pending wait, position > 1, step, researchVerifies) · src/verify-ui-model.ts factOffer (čekání spuštěné tady: position null) · src/ui/verify-ui.ts (tlačítko prioritize → verifyOpenPreview; verifyStart: pozice z odpovědi) · strings.ts verify.prioritize, verify.pending · research:a4a2f6c0 src/core/verify.ts verifyAsk (držený úkol → queueAt next; doing nebo už next beze změny), verifyWait (wait / asked / images / permission, position) · app:7b0471f8 src/verify-offer.ts verifyOffer (Verify jen u nedoložených, s feature verify, ne archiv, ne čekající; cost low/high) · src/verify-ui-model.ts verifyFactKind (BIRT, BAPM, MARR, DEAT, BURI) · strings.ts verify.btn, previewHead, what, how, estimate1, howRead, howSearch, costLow, costHigh, sessions, previewNote, previewNoteSearch, start, pending, failed, nothing, noResearch · app:669c08f0 strings.ts verify.busy, locked, whyArchive, whyRetracted, whyGone, whyMerged, whyOld, whyRefused (odmítnutí podle kódu) · research:6c6e7c3b strom help verify facts (první ve frontě; bez přečteného originálu se záznam hledá) -->

<a id="S7.4"></a>
## S7.4 Angaben prüfen bei einer Person

Alle ungeprüften Angaben einer Person lassen sich auf einmal zur Prüfung schicken: mit der Schaltfläche **Angaben
prüfen (N)** in der Personenkarte und im Popup der Marke auf dem Kärtchen, oder mit dem Eintrag **Angaben prüfen · N**
im Menü der Person.

- **Wo:**
  - Personenkarte: die Schaltfläche **Angaben prüfen (N)** über dem Abschnitt **Ereignisse**. Hat die Person nichts
    zur Prüfung anzubieten, warten aber ihre Angaben auf Prüfung, steht dort statt der Schaltfläche „N Angaben warten
    auf Prüfung“; sonst steht dort nichts;
  - Popup der Marke auf dem Kärtchen im Baum ([S7.2](#S7.2)): **Angaben prüfen (N)**, wie in der Personenkarte;
  - Menü der Person: **Angaben prüfen · N**, während der Prüfung **Wird geprüft · N**.
- **Fenster Angaben der Person prüfen:** „{name} · N ungeprüfte Angaben“, eine Liste der Angaben zum Ankreuzen, bei
  jeder **günstig** oder **teurer**, „Schätzung: {n} günstig, {n} teurer“ („Günstig = einen bekannten Eintrag lesen.
  Teurer = der Eintrag wird erst gesucht.“) und die Schaltfläche **Prüfen (N)** nach den angekreuzten. Nach dem Start
  „N Angaben sind zur Prüfung eingereiht.“, und der Eintrag im Menü zeigt **Wird geprüft · N**.
- **Vorrangig prüfen für die ganze Person:** hat die Person nichts zur Prüfung anzubieten und wartet eine ihrer Angaben
  weiter hinten in der Warteschlange, so wie die Forschung sie von selbst eingereiht hat, steht im Menü der Person unter
  **Wird geprüft · N** der Eintrag **Vorrangig prüfen** und im Popup der Marke auf dem Kärtchen unter „N Angaben warten
  auf Prüfung“ die Schaltfläche **Vorrangig prüfen**. Sie öffnet die Vorschau der Person mit diesem Titel; nach dem
  Start stellt die Forschung die Aufgaben mit den wartenden Angaben der Person an den Anfang der Warteschlange
  ([S7.3](#S7.3)). Die Personenkarte hat weiter nur die Zeile „N Angaben warten auf Prüfung“.
- **Prüft der Code:** N ist genau das, was die Forschung nimmt: Angaben der Person und ihrer Familien, die die
  Forschung kennt (auch Wohnorte und Angaben, die schon ein anderer Leser belegt hat), außer den von einem Menschen
  bestätigten, den auf Prüfung wartenden, Name und Geschlecht. Die Zahl im Menü, im Fenster und in der Meldung nach dem
  Start ist dieselbe.
- **Grenzen:** Schaltfläche und Eintrag erscheinen nur mit laufender Brücke der Forschung ([S7.9](#S7.9)) und nur,
  wenn mindestens eine Angabe der Person **Prüfen** anbietet.
- **Bedienung:** App: Personenkarte → **Angaben prüfen (N)** über **Ereignisse**; Popup der Marke auf dem Kärtchen →
  **Angaben prüfen (N)** oder **Vorrangig prüfen**; Menü der Person → **Angaben prüfen · N**, oder **Vorrangig
  prüfen** unter **Wird geprüft · N**; dann im Fenster **Prüfen (N)**. Terminal: `strom verify facts P…`.
- **Gilt seit:** Forschung 1.30.0, App 3.26.0

<!-- zdroj: app:7cf409bd src/ui/verify-person-ui.ts personVerifyMenu (pending + prioritize), verifyCardTipActions (st-verify-first), renderPersonVerifyRow (jen pending řádek), showVerifyPersonDialog prioritize (titulek verify.prioritize) · src/ui/card-signals-ui.ts signal-verify-first · src/ui/context-menu.ts · research:a4a2f6c0 src/core/verify.ts verifyAsk (osoba: držené úkoly na začátek) · app:7b0471f8 src/verify-ui-model.ts personVerifyAskCount · strings.ts verify.menu, menuPending, personTitle, estimate, startN, bulkStarted · app:7eb903a3 src/ui/verify-person-ui.ts renderPersonVerifyRow, personVerifyMenu (karta osoby nad #events-section; jinak personPending), verifyCardTipActions · strings.ts verify.personBtn, personPending, events.title · dirigent:prace/1109-app-jeden-rodic/karta.md Výsledek (6f58068a: menu = náhled = toast; i bydliště, i doložené) -->

<a id="S7.5"></a>
## S7.5 Angaben im Baum prüfen

Die Prüfung an den Originalen lässt sich für eine ganze Linie, eine Stammlinie oder den ganzen Stammbaum starten. Das
Fenster **Angaben im Baum prüfen** zeigt Umfang, Reihenfolge und eine Schätzung der Kosten vorab und prüft nur
ungeprüfte Angaben (wahrscheinlich, möglich, Hinweis, aus dem Stammbaum).

- **Wo:** **Angaben im Baum prüfen…** im Abschnitt **Prüfung** in Was die Forschung weiß
  ([S3](S3-what-the-research-knows.md)), im Menü der Forschung und auf der Karte **Wie weiter** nach dem Import als
  **Angaben an Quellen prüfen** ([S6.4](S6-tree-from-another-program.md#S6.4)).
- **Optionen:**
  - **Umfang**: **Linie: {name}**, **Stammlinie {nachname}**, **Ganzer Baum**;
  - **Reihenfolge**: **Nächste Vorfahren zuerst**, **Schwächste Belege zuerst**, **Am längsten ungeprüfte zuerst**;
  - **Zuerst an 5 Personen ausprobieren**: „Nach 5 Personen hält die Prüfung an und zeigt das Ergebnis.“ Die
    Schaltfläche ist dann **An 5 ausprobieren**, sonst **Prüfen (N)**.
- **Prüft der Code:**
  - genommen werden Geburt, Taufe, Heirat, Tod und Begräbnis mit einer Zitation des Originals, die kein Mensch
    bestätigt hat; auch belegte (ein weiterer Leser liest sie), außer denen, die das aktuelle Modell schon geprüft hat;
    und Hinweise aus dem Stammbaum eines anderen Programms und aus einem Stammbaum aus der App Strom, die niemand
    geändert hat (der Eintrag wird gesucht);
  - nie lebende Personen (vor weniger als 100 Jahren geboren, ohne eingetragenen Tod);
  - eine Aufgabe je Person (eine Heirat je Familie), mit niedriger Priorität, nach der Arbeit an den Linien;
  - starten darf nur ein Mensch: in der App oder an seinem Terminal. Der Agent darf nur `--dry-run` (wie viel und zu
    welchen Kosten).
- **Anhalten:** der Abschnitt **Prüfung** zeigt „Warten auf Prüfung: N Angaben · werden nacheinander geprüft, nächste
  Vorfahren zuerst“ und **Anhalten** („Prüfung angehalten.“). Das Anhalten verwirft Aufgaben, die noch niemand begonnen
  hat; begonnene laufen zu Ende. Verworfene Angaben werden nicht von selbst erneut eingereiht, nur mit einer neuen
  Zitation des Originals oder auf eine neue Bitte.
- **Bedienung:** App: siehe oben. Terminal: `strom verify bulk --scope line|lineage|tree [--of G…|P…]
  [--order ancestors|weakest|oldest] [--try N] [--budget …] [--dry-run]`, `strom verify status`,
  `strom verify stop [--bulk]`.
- **Gilt seit:** Forschung 1.30.0, App 3.26.0

<!-- zdroj: app:7b0471f8 src/ui/verify-person-ui.ts verifyRowsHtml, treeVerifyBlock, showVerifyBulkDialog · src/ui/research-actions-ui.ts:371 (nabídka výzkumu) · src/import-next.ts IMPORT_NEXT_VERIFY_FEATURES ['verify.bulk'] · src/verify-ui-model.ts VERIFY_TRY_PEOPLE 5 · strings.ts verify.bulkRow, bulkRowSub, bulkTitle, bulkSub, scope, order, scopeLine, scopeSurname, scopeTree, orderAncestors, orderWeakest, orderOldest, tryFirst, tryFirstSub, tryN, startN, bulkNote, section, pendingRow, pendingRowSub, stop, stopped · research:6c6e7c3b strom help verify bulk, verify stop, verify status · src/core/verify.ts (žijící) · research:94d75934 src/core/verify.ts verifyBulk (origin import nebo tree → search) -->

<a id="S7.6"></a>
## S7.6 Prüfung von selbst in der Warteschlange der Forschung

Eine Angabe, die das Original eines Eintrags zitiert und wahrscheinlich oder möglich geblieben ist, wird von selbst
daran geprüft: die Forschung reiht sie in die Warteschlange ein, ohne dass jemand darum bittet.

- **Prüft der Code:**
  - die Warteschlange wird nach der Planung jeder Sitzung und nach `strom sync` ergänzt;
  - genommen werden Geburt, Taufe, Heirat, Tod und Begräbnis von Personen, die mit dem Stammbaum verbunden sind,
    außerhalb von Nebenzweigen, keine Lebenden; im Strom-Archiv nie;
  - eine Aufgabe je Person (eine Heirat je Familie), nach der Arbeit an den Linien; nach je 5 Sitzungen kommt eine
    Prüfaufgabe nach vorn (der nächste Vorfahr zuerst);
  - eine geprüfte, mit Begründung belassene, bestätigte oder herabgestufte Angabe wird nicht erneut eingereiht, nur mit
    einer neuen Zitation des Originals oder auf Bitte eines Menschen;
  - eine Aufgabe, die auf Bilder oder auf die Erlaubnis eines Archivs wartet, wartet wie jede andere
    ([R6.2.1](R6-awaiting-action.md#R6.2.1), [R6.3.1](R6-awaiting-action.md#R6.3.1)).
- **Wo die Zahl zu sehen ist:** `strom check` („Hinweis: N Angaben mit zitiertem Original warten auf die Prüfung daran
  → strom verify status“), die Zeile von `strom doctor` **Prüfung an den Originalen** („N Angaben mit zitiertem
  Original warten auf die Prüfung, nach und nach“), `strom stats`, `strom verify status` (**Prüfung an den
  Originalen**: wartet, davon erbeten, davon warten auf das Herunterladen der Scans, davon warten auf die Erlaubnis
  eines Archivs; geprüft und mit Begründung belassen; am Scan bestätigt; und warum welche Angabe aus der Auswahl fiel)
  und in der App der Abschnitt **Prüfung** ([S7.5](#S7.5)).
- **Gilt seit:** Forschung 1.30.0

<!-- zdroj: research:6c6e7c3b src/core/verify.ts (záhlaví: sweep po plánování, po strom sync, VERIFY_EVERY 5, jen napojené, mimo vedlejší větve, ne žijící, ne archiv, bez znovuzařazení) · cs.json ui.check.verify, ui.doc.verify, ui.stats.verify, ui.verify.status.* -->

<a id="S7.6.1"></a>
### S7.6.1 Einmalige Korrektur älterer Forschungen

Eine vor der Version 1.30.0 angelegte Forschung hat Angaben mit einer Zitation des Originals, die niemand daran
geprüft hat. Die Korrektur **Angaben zum Prüfen an den Originalen** reiht sie einmal zur Prüfung ein.

- **Prüft der Code:**
  - die Korrektur läuft einmal von selbst, beim ersten Start der neuen Version nach der Sicherung der Forschung;
    danach werden ähnliche Angaben laufend eingereiht ([S7.6](#S7.6));
  - nur Aufgaben: an den Angaben ändert sich nichts. „Nichts wird ohne Blick auf das Original belegt; kein Wert wird
    überschrieben.“;
  - `strom fixes undo verify-originals` verwirft Aufgaben, die niemand begonnen hat; begonnene oder erledigte bleiben;
  - im Strom-Archiv wird nur vermerkt, dass sie gelaufen ist.
- **In der App:** nach der Aktualisierung der Forschung einmal die Meldung „N Angaben mit Original warten auf Prüfung
  und werden nacheinander geprüft.“
- **Bedienung:** Terminal: `strom fixes` (Liste der Korrekturen und was sie getan haben),
  `strom fixes undo verify-originals`.
- **Gilt seit:** Forschung 1.30.0, App 3.26.0

<!-- zdroj: research:6c6e7c3b src/commands/fixchecks.ts VERIFY_ORIGINALS (Applied by itself once, at the first start of this strom after its backup; agentWork) · src/commands/fixes.ts "verify-originals" (undo: nobody started) · cs.json ui.fixes.verify-originals.name, .does, .not · app:7b0471f8 strings.ts verify.queuedToast -->

<a id="S7.7"></a>
## S7.7 Das Ergebnis der Prüfung

Die Sitzung, die eine Angabe prüft, öffnet das Bild des Eintrags und liest es. Das Ergebnis ist eines von zweien: die
Angabe ist nach dem Bild belegt, oder sie ist geblieben, wie sie war, mit einer Begründung.

- **Prüft der Code:**
  - belegen lässt sich nur mit einem gelesenen Bild; ohne Blick auf das Original wird nichts belegt;
  - eine belassene Angabe hat eine Begründung, die die App im Popup zeigt („Bleibt {stufe} · von der Recherche geprüft
    am {datum}“);
  - die Prüfung überschreibt keinen Wert. Sagt der Eintrag etwas anderes, entsteht ein Vorschlag oder ein Widerspruch
    zur Entscheidung des Menschen ([S6.3](S6-tree-from-another-program.md#S6.3), [R5](R5-conflicts.md)); eine von
    einem Menschen eingetragene oder bestätigte Angabe ändert der Agent nie;
  - das Ergebnis schreibt nur die Sitzung, die die Prüfaufgabe bearbeitet (`strom verify done`).
- **Warum:** der Agent belegt, der Mensch bestätigt. Auch die Übereinstimmung zweier Leser ist eine Lesung durch KI;
  Gewissheit gibt erst ein Mensch mit dem Scan ([S7.8](#S7.8)).
- **Gilt seit:** Forschung 1.30.0, App 3.26.0

<!-- zdroj: research:6c6e7c3b strom help verify done (--proven --image | --kept --reason, jen uvnitř sezení) · cs.json ui.fixes.verify-originals.not · app:7b0471f8 strings.ts verify.reasonHead -->

<a id="S7.8"></a>
## S7.8 Anhand des Scans bestätigen: Bestätigung durch einen Menschen

Die stärkste Marke gibt ein Mensch: er sieht sich den Scan des Eintrags an, vergleicht ihn mit der Angabe und klickt
im Popup der Marke auf **Anhand des Scans bestätigen**. Die Angabe ist dann **Bestätigt** (✓), und das Popup zeigt
statt der Aktion den Stand „✓ Am {datum} anhand des Scans bestätigt“ und **Zurücknehmen**.

- **Prüft der Code:**
  - **Anhand des Scans bestätigen** wird nur bei einer Angabe mit Quelle angeboten: mit einer Zitation oder mit dem
    Eintrag, aus dem die Forschung den Wert gelesen hat. Eine Angabe ohne Quelle hat es nicht: es gibt nichts, wogegen
    bestätigt würde;
  - bestätigt wird der Wert, den der Mensch sieht. Hat die Forschung ihn inzwischen geändert, wird nichts bestätigt:
    das Popup schließt sich, die App sagt „Die Angabe hat sich inzwischen geändert; nichts wurde bestätigt. Bestätigen
    lässt sich nur der aktuelle Wert der Recherche.“ und lädt die aktuelle Version der Forschung (ein Stammbaum mit
    Änderungen, die die Forschung noch nicht hat, fragt vorher: **Version der Forschung laden?**). Ein in der App
    geänderter und noch nicht gesendeter Wert wird nicht zur Bestätigung gesendet; das Popup sagt dasselbe;
  - **Zurücknehmen** hebt die Bestätigung auf („Bestätigung zurückgenommen“); die Angabe hat dann wieder die Stufe,
    die sie hatte;
  - die Bestätigung gilt nur für den bestätigten Wert: eine Änderung der Angabe beendet sie, und kehrt der Wert zurück,
    gilt sie wieder;
  - eine bestätigte Angabe ändert der Agent nie, er schlägt nur vor ([S6.3](S6-tree-from-another-program.md#S6.3));
  - Stammbaum ohne Forschung: die Bestätigung hält die App selbst, bei einer Angabe, die eine Quelle zitiert, wenn
    sich der Stammbaum bearbeiten lässt. Die Bestätigung und ihre Rücknahme gehen mit dem Stammbaum in die Forschung
    über, auch über eine GEDCOM-Datei;
  - eine Bestätigung, die die App hält, ist eine Änderung des Stammbaums: sie hat einen Schritt zurück („Angabe von
    {name} anhand des Scans bestätigen“, „Bestätigung von {name} zurücknehmen“) und einen Eintrag im
    Änderungsverlauf („Angabe von {name} anhand des Scans bestätigt“, „Bestätigung anhand des Scans zurückgenommen:
    {name}“);
  - an die Forschung gebundener Stammbaum: die Bestätigung schreibt die Forschung über die Brücke, nur wenn die Brücke
    läuft und die Forschung es beherrscht; Name und Geschlecht werden hier nicht bestätigt;
  - im Terminal bestätigt nur ein Mensch an seinem Terminal: `strom verify confirm E… [--undo]`. Einem Agenten lehnt
    `strom` die Bestätigung ab.
- **Grenzen:** ein an die Forschung gebundener Stammbaum, dessen Brücke nicht läuft, bietet weder **Anhand des Scans
  bestätigen** noch **Zurücknehmen** an; bestätigen lässt sich erst mit laufender Brücke oder im Terminal. Lehnt die
  Forschung die Bestätigung ab, sagt das Popup warum, zum Beispiel dass die Forschung ein Archiv ist oder dass eine
  andere Sitzung sie hält; „Nicht geändert; die Recherche antwortet nicht.“ nur, wenn sie nicht antwortet.
- **Warum:** Gewissheit über eine Angabe entsteht dadurch, dass ein Mensch den Eintrag selbst sieht. Die Prüfung durch
  einen Agenten ist eine Lesung durch KI; ✓ sagt, dass ein Mensch den Eintrag gesehen hat. Die bestätigte Abschrift
  ([A3.1.1](A3-evidence-in-the-app.md#A3.1.1), [R3.4.1](R3-verification-and-citation.md#R3.4.1)) bestätigt den Text
  des Eintrags, **Anhand des Scans bestätigen** die Angabe einer Person.
- **Bedienung:** App: Personenkarte → Marke der Angabe → **Anhand des Scans bestätigen** / **Zurücknehmen**. Terminal:
  `strom verify confirm E…`, `strom verify confirm E… --undo`.
- **Gilt seit:** Forschung 1.30.0, App 3.26.0

<!-- zdroj: app:7b0471f8 src/verify-offer.ts (human → Vzít zpět; bez výzkumu scan u citovaného; ve stromu výzkumu scan jen s researchConfirms) · src/verify.ts factConfirmation/researchConfirmation (platí jen s nezměněnou hodnotou) · src/verify-ui-model.ts (jméno, pohlaví bez scan ve stromu výzkumu) · strings.ts verify.scan, undo, undone, confirmedAt · app:7eb903a3 src/ui/verify-ui.ts (✓ jen u stavu, akce bez ✓; verifyConfirm: bez mostu DataManager.confirmFact) · src/data.ts confirmFact/unconfirmFact (undo.confirmFact, unconfirmFact, auditLog.confirmedFact, unconfirmedFact) · strings.ts verify.scan, confirmedAt · CHANGELOG.cs.md 3.26.0 · dirigent:test/vysledek-1109-zaver-c-potvrzeni.md (N2: bez mostu ✓ ani Vzít zpět ve stromu výzkumu) · prace/1109-app-potvrzeni-zmena · research:6c6e7c3b strom help verify confirm (jen uživatel, most; mimo něj requireHuman) · app:669c08f0 src/verify-offer.ts verifyOffer (scan jen se source: citace nebo záznam, ze kterého výzkum četl), src/verify.ts factConfirmMark (3 _TXT; changed), src/ui/verify-ui.ts verifyConfirm (409 confirm.changed → zavřít bublinu, toast, researchLoadNewer; změněno tady → jen důvod), strings.ts verify.confirmChanged, confirmLocked, confirmBusy, confirmFailed, sync.loadTitle · research:94d75934 POST /facts/confirm {txt} → 409 confirm.changed, feature facts.confirm.value -->

<a id="S7.9"></a>
## S7.9 Was mit der Brücke geht und was ohne sie

| | An die Forschung gebundener Stammbaum, Brücke läuft | An die Forschung gebundener Stammbaum, Brücke läuft nicht | Stammbaum ohne Forschung |
|---|---|---|---|
| Marken an Angaben und auf dem Kärtchen | ja | ja, gleich wie mit der Brücke (nach dem letzten Stand aus der Datei) | ja, aus dem Import und aus den Zitationen |
| **Prüfen**, **Vorrangig prüfen**, **Angaben prüfen · N**, **Angaben im Baum prüfen…** | ja | nein | nein (Zeile zur Ahnenforschung) |
| **Anhand des Scans bestätigen**, **Zurücknehmen** | ja, schreibt die Forschung | nein | ja, hält die App |
| **Anhalten** der Prüfung | ja | nein; `strom verify stop` im Terminal | – |
| Prüfung in der Warteschlange der Forschung | läuft | läuft (die Forschung wartet nicht auf die App) | – |

- **Prüft der Code:** die Forschung prüft auch ohne die App: im Terminal gehen `strom verify facts`,
  `strom verify bulk`, `strom verify status`, `strom verify stop` und (nur ein Mensch) `strom verify confirm`. Brücke
  der Forschung: [S1.1](S1-connecting-app-and-research.md#S1.1).
- **Gilt seit:** Forschung 1.30.0, App 3.26.0

<!-- zdroj: app:7b0471f8 src/verify-offer.ts (feature verify a facts.confirm jen ze stavu výzkumu přes most) · dirigent:test/vysledek-1109-zaver-c-potvrzeni.md (N2) · research:6c6e7c3b strom help verify -->
