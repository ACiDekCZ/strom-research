<a id="A6"></a>
# A6 Ansichten und Auswahl der Personen

Wie die Strom-App auswählt, welche Personen sie zeigt, und wie die einzelnen Ansichten sie zeigen. Beschrieben wird
die App 3.21.2. Änderungen aus einer neueren Version tragen deren Nummer.

Eine Ansicht ist eine andere Lesart **desselben Umfelds der zentralen Person**. Das Umfeld bestimmen die zentrale
Person (die angeklickte) und die Tiefe **Vorfahren** und **Nachkommen**. Familie, Nachkommen, Zeitleiste und Karte zeigen
dasselbe Umfeld der zentralen Person. Der Fächer berechnet Vorfahren und Nachkommen selbst nach der Zahl der
Generationen ([A6.4](#A6.4)). Die Tabelle zeigt den ganzen Stammbaum ([A6.7](#A6.7)),
ab App 3.30.0 auch nur eine Personenliste ([A6.7.19](#A6.7.19)).
Ab App 3.31.0 hat das Fenster außerdem eine **Auswahl**: eine benannte Gruppe von Personen (Stammlinie, Vorfahren oder
Nachkommen einer Person, Forschungslinie, Personenliste), die Familie, Nachkommen und Fächer hervorheben und die Karte
allein zeigt ([A6.6](#A6.6)).
Am Computer lässt sich jede Ansicht auch in einem eigenen Fenster öffnen ([A6.8](#A6.8)).

Ansichten: **Familie**, **Nachkommen**, **Zeitleiste**, **Fächer**, **Karte**, **Tabelle**.

<!-- zdroj: app:src/types.ts:1237 ViewMode · strings.ts viewModeSwitch.* · Tabulka od aplikace 3.27.0 (viewModeSwitch.table) -->

<a id="A6.1"></a>
## A6.1 Umfeld der zentralen Person in der Ansicht Familie

Die Ansicht Familie zeigt die zentrale Person in ihrer Familie, nicht den ganzen Stammbaum.

- Zum Umfeld gehören:
  1. die zentrale Person und alle ihre Partner;
  2. ihre Nachkommen bis zur Tiefe **Nachkommen**, mit Partnern;
  3. die direkten Vorfahren über beide Eltern bis zur Tiefe **Vorfahren**;
  4. Geschwister, auch Halbgeschwister (ihr anderer Elternteil kommt nicht hinzu), mit Partnern und Nachkommen bis
     zur Tiefe Nachkommen;
  5. Tanten und Onkel (Geschwister der Eltern) mit Partnern;
  6. Cousins und Cousinen, also Kinder der Tanten und Onkel, die in deren Partnerschaft erfasst sind, mit
     Nachkommen bis zur Tiefe Nachkommen.
- **Grenzen:** Vorfahren eines Partners der zentralen Person kommen nie ins Umfeld. Wer nicht zum Umfeld gehört,
  bleibt im Stammbaum, die Ansicht zeigt ihn nur nicht; eine neue zentrale Person zeigt ihn.
- **Tiefe:** nach der Wahl einer neuen zentralen Person stehen Vorfahren und Nachkommen auf der größten Tiefe, die der
  Stammbaum bei dieser Person hat. Das Angebot reicht von 1 bis zu dieser größten Tiefe. Kinder eines Partners aus
  einer anderen Partnerschaft fügen eine Generation nach unten hinzu.
- **Bedienung:** Klick auf die Personenkarte; Auswahl **Vorfahren** und **Nachkommen** in der Leiste der Ansicht.
- **Gilt seit:** App 1.0.0

<!-- zdroj: app:src/layout/pipeline/1-select-subgraph.ts selectSubgraph · src/layout/pipeline/index.ts:962 includeSpouseAncestors: false · src/renderer.ts:719 computeTreeLayout, setFocus (maxGenerations) · src/focus-depth.ts maxAncestorDepth, maxDescendantDepth · strings.ts focus.ancestorsLabel, focus.descendantsLabel -->

<a id="A6.1.1"></a>
### A6.1.1 Standardperson und -ansicht

Womit sich der Stammbaum öffnet, bestimmt die Stammbaum-Einstellung **Standardperson und -ansicht**.

| Auswahl | Möglichkeiten |
|---|---|
| Person | **Zuletzt fokussiert** · **Bestimmte Person:** (ausgewählt) |
| Ansicht | **Familie** · **Zuletzt verwendet** (auf diesem Gerät) |

- **Grenzen:** ohne Einstellung öffnet sich der Stammbaum bei der ersten Person des Stammbaums. Ein Neuladen der Seite
  behält Stammbaum, Ansicht und zentrale Person.
- **Bedienung:** Verwaltung der Stammbäume, beim Stammbaum **Standardperson und -ansicht**.
- **Gilt seit:** Standardperson App 1.0.0; Wahl der Ansicht und Neuladen der Seite App 3.21.0

<!-- zdroj: app:src/renderer.ts:1178 findDefaultFocusPerson, getStartupFocus · strings.ts treeManager.defaultPersonViewTitle, focus.defaultPersonLastFocused, focus.defaultPersonSpecific, focus.defaultViewFamily, focus.defaultViewLast · CHANGELOG.cs.md 3.21.0 -->

<a id="A6.1.2"></a>
### A6.1.2 Abstände: Normal und Dicht

Die Einstellung **Abstände** bestimmt die Lücken zwischen den Karten und zwischen den Generationen in den Ansichten
Familie und Nachkommen. **Dicht** macht sie kleiner, damit mehr Personen auf den Bildschirm passen. **Normal** ist der
Standard, auch auf dem Telefon.

| Lücke | Normal | Dicht |
|---|---|---|
| zwischen Karten nebeneinander | 31 px | 20 px |
| zwischen Generationen | 80 px | 48 px |
| zwischen Partnern | 18 px | 14 px |

- Nach dem Umschalten wird der Stammbaum sofort neu gezeichnet und bleibt bei derselben Person: bei der Karte der
  zentralen Person, wenn sie ganz im Bild ist, sonst bei der Karte, die der Mitte am nächsten ist. Ebenso verhält sich
  der Stammbaum nach einer Änderung von **Kartendetail**.
- **Ehefolge:** bei Dicht steht statt der Marke „1. ∞ 1866“ nur ein kurzes „∞ 1“ am Rand der Karte, also die
  Stelle dieser Ehe in der Folge. Die ganze Reihenfolge zeigt eine Blase (mit der Maus, der Tastatur und durch Tippen).
  Eine Marke, die an der Karte keinen Platz hat, wird nicht gezeichnet.
- **Export:** der Posterexport hat eine eigene Einstellung **Abstände** (nach dem Papierformat und der Ausrichtung).
  Weicht sie vom Bildschirm ab, werden Bild, Poster und PDF in Blättern mit den gewählten Abständen neu angeordnet,
  mit derselben Auswahl der Personen und denselben Karten; der Bildschirm ändert sich nicht. Unter jeder Möglichkeit
  steht die Zahl der Blätter („26 Blätter A4“), wenn sich die Zahlen unterscheiden. Der Druck (Strg+P) nimmt die
  Abstände des Bildschirms.
- **Grenzen:** die Einstellung gehört zum Gerät und wird nicht mit dem Stammbaum gespeichert. Zeitleiste, Fächer, Karte
  und Tabelle haben eine eigene Anordnung, die Einstellung betrifft sie nicht; der Posterexport aus dem Fächer und der
  Zeitleiste hat keine Zeile **Abstände**.
- **Bedienung:** **Einstellungen** → **Personenkarte** → **Abstände** (nach **Kartendetail**): **Normal** ·
  **Dicht**. Auf einem kleinen Bildschirm ohne Kompakt-Karte steht unter der Einstellung „Auf einem kleinen Bildschirm
  hilft auch die Kompakt-Karte.“ Export: **Poster exportieren** → **Abstände**.
- **Gilt seit:** App 3.27.0

<!-- zdroj: app:src/types.ts TreeSpacing, DEFAULT_LAYOUT_CONFIG (31/80/18), DENSE_LAYOUT_CONFIG (20/48/14), layoutConfigFor · src/settings.ts getTreeSpacing/setTreeSpacing (treeSpacing), getPosterSpacing/setPosterSpacing (posterSpacing), výchozí normal · src/renderer.ts:804 STANDALONE_VIEWS (timeline, fan, map, table), getPosterLayout({spacing}), kotva překreslení (ústřední karta celá v obraze, jinak nejbližší středu; i při změně typu karty) · src/marriage-order.ts (husté: „∞ N“ na okraji karty, bez místa se nekreslí) · src/ui/export-image-ui.ts (řádek za formátem a orientací, skrytý u vějíře a časové osy, sheetsCount) · strings.ts spacing.label, normal, dense, desc, scope, scopeExport, smallHint, marriageOrder.short, poster.menu, poster.sheetsCount, settings.groupCard, cardDensity.settingLabel · commity 68b9dde4, 03918007, 928db183, e2891a8a · spec 069 K1.1, K3.1 -->

<a id="A6.1.3"></a>
### A6.1.3 Kinder und Geschwister auf einmal

In der Ansicht Familie lassen sich mit einem Schritt an Ort und Stelle die Kinder der Person und die Geschwister der
Person und ihrer Vorfahren zeigen. Fokus, Tiefe und Zoom bleiben, die Karte der Person steht an derselben Stelle des
Bildschirms.

- **Wer hinzukommt:**
  - die Kinder der Person (nicht die Enkel);
  - die Geschwister der Person und jedes ihrer Vorfahren, der in der Ansicht ist und dessen Eltern in der Ansicht sind.
    Die oberste Reihe der Tiefe **Vorfahren** wird nicht aufgeklappt (ihre Geschwister brächten eine neue Generation,
    das ist Aufgabe der Tiefe); bei ihr bleibt „▸ Eltern“;
  - Geschwister sind die Kinder der Eltern in der Ansicht aus allen Ehen, wie beim einzelnen „Geschwister hier
    zeigen“. Mit den Kindern kommen ihr anderer Elternteil, die Partner, die die Ansicht mit ihnen zeichnet, und das,
    was die Tiefe **Nachkommen** unter ihnen hält.
- **Anzahl +n:** wie viele Karten der Schritt hinzufügt; sie berechnet dieselbe Anordnung wie die Ansicht, sodass
  nach dem Schritt genau n Karten hinzukommen. Sie wird nach jedem Zeichnen neu gezählt.
- **Grenzen:**
  - der Schritt ist eine Anordnung, ein Schritt im Verlauf und ein Schritt von **Gezeigte ausblenden · n** (n + 1).
    Rückgängig machen ihn **Zurück** im Verlauf, **Gezeigte ausblenden** (nimmt alles Gezeigte zurück) oder dieselbe
    Wahl noch einmal („Kinder und Geschwister zuklappen“);
  - an den betroffenen Karten stehen die Reiter „▾ Kinder“ und „▾ Geschwister“, und einzelne Familien lassen sich
    weiter einzeln zuklappen;
  - eine neue Person im Fokus, eine andere Ansicht oder ein anderer Stammbaum heben den Schritt auf. Eine Änderung
    der Tiefe **Vorfahren** oder **Nachkommen** beendet alle Schritte „auf einmal“: ihre Karten verschwinden,
    einzeln gezeigte Familien bleiben, und die Wahl bietet das „+n“ der neuen Tiefe an;
  - über 150 Personen fragt die App zuerst in einer Blase: „n Personen kommen hinzu“, „Der Baum wird etwa
    k Bildschirmbreiten breit. Der Zoom bleibt.“ (k aus der tatsächlichen Anordnung beim jetzigen Zoom, aufgerundet)
    und die Schaltflächen **Aufklappen +n**, **Nur 2 Vorfahrengenerationen +m** (nur die Geschwister der Person, der
    Eltern und der Großeltern; fehlt, wenn m gleich n oder 0 ist) und **Abbrechen**. Esc, ein Klick daneben oder eine
    Änderung der Fenstergröße = Abbrechen. Bis 150 Personen ohne Frage.
- **Bedienung:** App, Ansicht Familie:
  - die Leiste der Ansicht, gleich nach der Auswahl **Vorfahren** und **Nachkommen**: **Kinder & Geschwister +n** für
    die Person im Fokus. Ein eingeschalteter Schritt zeigt ✓, und ein Klick nimmt ihn zurück; gibt es nichts
    hinzuzufügen, ist die Wahl gedämpft („Alle Kinder und Geschwister sind schon sichtbar“). Auf dem Tablet Symbol
    und „+n“; passt sie nicht in die Leiste, weicht sie (das Menü der Person hat sie weiter). Das Telefon hat die Wahl
    in der Leiste nicht;
  - das Menü der Person (bei Berührung das untere Feld der Person) unter den Zeilen, die Eltern, Geschwister und
    Kinder an Ort und Stelle zeigen: **Kinder und Geschwister aufklappen · +n** mit der Unterzeile „Kinder der Person,
    Geschwister der Person und ihrer Vorfahren“, nur wenn es etwas hinzuzufügen gibt; solange der Schritt der Person
    steht, **Kinder und Geschwister zuklappen**. Bei der Person im Fokus ist es derselbe Schritt wie in der Leiste.
- **Gilt seit:** App 3.28.0

<!-- zdroj: app:f5d56ed3 src/bulk-family.ts collectBulkFamily (childrenOf osoba; siblingsOf osoba a předci v pohledu s rodiči v pohledu; maxGeneration), bulkParents, bulkNewIds (drawnPersonIds, kroky 1–5 pipeline), BULK_CONFIRM_ABOVE 150, BULK_TWO_GENERATIONS 2 · src/renderer.ts bulkFamilyPlan (jen family), bulkFamilyState (offer/on/none), bulkFamilyScreens (ceil šířka × zoom / plátno), showBulkFamily → showChildrenOf (jeden krok historie, zoom beze změny, kotva), undoBulkFamily, bulkStepOf (jen při stejné hloubce), forgetBulkSteps při změně hloubky, resetChildrenShown při změně fokusu, pohledu, stromu, hiddenShownCount (+1 za krok) · src/ui/bulk-family-ui.ts confirmBulkFamily (Esc, klik vedle, resize = zrušit; two jen m > 0 a m ≠ n), runBulkFamily, updateBulkFamilySwitches (title treeTip/menuOff/treeNone, aria-disabled) · src/ui/context-menu.ts bulkFamilyRows (offer: menu, +n, menuSub; on: menuOff) · src/ui/toolbar-fit.ts (tablet: přepínač ustoupí před hledáním, f5d56ed3) · index.html button.bulk-family (telefon skrytý) · strings.ts bulk.*, menu.showChildrenHere, showSiblingsHere, focusBar hideAllShown, history back · app 2eb013ba, cecea43f, 8dc34565, f5d56ed3 · dirigent:prace/1113-app-drobnosti-1112 · ZADANI_DEV_drobnosti-1112 §3 -->

<a id="A6.1.4"></a>
### A6.1.4 Foto auf der Karte

Die Einstellung **Foto auf der Karte** bestimmt Größe und Form des Fotos der Person auf der Karte im Stammbaum. Die
Standardwerte **Klein** und **Kreis** lassen die Karte wie bisher.

| | **Klein** | **Mittel** | **Groß** |
|---|---|---|---|
| Karte **Normal** | 188 × 64 px | 200 × 64 px | 236 × 96 px |
| Foto auf der Karte **Normal** | 34 px | 48 px | 80 px |
| Foto im Kopf der Karte **Detailliert**, **Matrikel**, **Eigene** | 30 px | 44 px | 72 px |

- Eine größere Karte gibt es nur in einer Ansicht, in der mindestens eine gezeigte Person ein Foto hat. Karten ohne
  Foto sind in dieser Ansicht gleich breit, mit kleinen Initialen, und die Namen einer Reihe stehen auf derselben
  Höhe. Eine Ansicht ohne Fotos hat Karten von 188 × 64 px.
- Die Karte **Normal** hat das Foto neben dem Namen. **Detailliert**, **Matrikel** und **Eigene** haben es im Kopf
  neben Namen und Jahren, die Zeilen der Angaben darunter in voller Breite; die Karte ist um das Foto höher
  (**Eigene** 70 oder 98 px und 17 px pro Zeile statt 56 px).
- **Ab App 3.30.0:** die gewählte Größe gilt für jede Karte mit Avatar, mit Foto und ohne. Die Initialen einer
  Karte ohne Foto haben Größe und Form des Fotos (**Normal** 48 oder 80 px, im Kopf der Karte 44 oder 72 px) und eine
  entsprechende Schrift (17 und 29 px, im Kopf 16 und 26 px). Eine Ansicht hat größere Karten, sobald in ihr
  mindestens eine Karte mit Avatar ist (vorher nur mit Foto); eine Platzhalterperson hat keinen Avatar. Bildexport,
  Plakat und sein PDF zeichnen die Initialen ebenso. **Klein** sieht aus wie bisher. Der Satz unter der Einstellung:
  „Personen ohne Foto erhalten Initialen in derselben Größe. Gilt für den Baum, Bildexport und Plakat auf diesem
  Gerät.“
- **Form:** **Kreis** oder **Abgerundetes Quadrat** (Rundung 12 px beim großen Foto, 5 px beim kleinen; ebenso die
  Initialen). Die Marken der Karte stehen in beiden Formen am Rand des Fotos.
- **Export:** Bildexport, Plakat und sein PDF auf mehreren Blättern ([A7](A7-book-pages-and-export.md)) zeichnen die
  Karten mit der gewählten Größe und Form des Fotos wie der Bildschirm: die Karte **Normal** hat ihre Größe vom
  Bildschirm, **Detailliert** und **Matrikel** haben das Foto links im Kopf. Ein für eine lebende Person
  verborgenes Foto lässt die Initialen auf der Karte. Eine Ausgabe, in der niemand ein Foto hat, und die Vorgabe
  **Klein** mit **Kreis** sehen aus wie bisher. Der Satz unter der Einstellung: „Gilt für den Baum, Bildexport und
  Plakat auf diesem Gerät.“
- **Grenzen:** die Karte **Kompakt** hat kein Foto: die Zeile bleibt, die Optionen sind ausgeschaltet, und darunter
  steht „Die kompakte Karte hat kein Foto.“; die gewählte Größe bleibt erhalten. Die Einstellung gehört zum Gerät und
  wird nicht mit dem Stammbaum gespeichert. Die Vorschau in den Einstellungen zeigt die Größe der Karte („Karte
  236 × 96 px“).
- **Bedienung:** **Einstellungen** → **Personenkarte** → **Foto auf der Karte** (zwischen **Kartendetail** und der
  Vorschau): **Größe** **Klein** · **Mittel** · **Groß**; **Form** **Kreis** · **Abgerundetes Quadrat**.
- **Gilt seit:** App 3.29.0; 3.30.0: Initialen in der Größe des Fotos

<!-- zdroj: app:28480ea1 src/types.ts NORMAL_PHOTO_BOX (188×64/34, 200×64/48, 236×96/80), src/settings.ts (zařízení, výchozí small + circle), src/ui/card-fields-ui.ts, src/renderer.ts · b71d561a src/card-width.ts cardAvatarSize (30/44/72), výška Vlastní 70/98 + 17 na řádek · strings.ts cardDensity.photoTitle, photoSize, photoSmall, photoMedium, photoLarge, photoShape, photoCircle, photoRounded, photoCompact, size · CHANGELOG.cs.md 3.29.0 „Fotka na kartě“ · dirigent:test/vysledek-1115-app-096-fotka.md · spec 096 P1 · export: app:64ae50ca src/export-image.ts, src/renderer.ts (poster, PDF po listech; výchozí small + circle bajt po bajtu jako dřív), strings.ts cardDensity.photoScope · spec 096 P2 · 3.30.0: app:0bed2a88 src/types.ts NORMAL_PHOTO_BOX (avatar = fotka i iniciály), src/renderer.ts viewHasAvatar (dřív viewHasPhoto), src/card-width.ts normalCardTextWidth (126 px u každého avataru), avatarInitialsSize (avatar × 0,36: 17/29, 16/26), src/export-image.ts getPosterCardPhoto (každá karta s avatarem), strings.ts cardDensity.photoScope · e2e/card-photo.spec.ts, poster-card-photo.spec.ts · CHANGELOG.cs.md 3.30.0 „Fotka na kartě“ · spec 103 K2.1–K2.3 · dirigent:test/vysledek-1116-app-103-tabulka.md -->

<a id="A6.1.5"></a>
### A6.1.5 Linienmarkierung

Die Linienmarkierung kennzeichnet die Karten im Stammbaum danach, zu welcher Linie die Person relativ zur zentralen
Person gehört (in den Einstellungen „fokussierte Person“): **väterlich**, **mütterlich**, **Nachkommen**. Standard
ist **Bogen** am linken Rand der Karte.

| Wahl | Wie die Markierung aussieht | Zweites Zeichen außer der Farbe |
|---|---|---|
| **Bogen** (Standard) | Streifen entlang des linken Kartenrands | keines |
| **Buchstabenetikett** | Etikett über dem linken Kartenrand | Buchstabe: V väterlich, M mütterlich, N Nachkommen |
| **Streifen** | senkrechter Streifen am linken Rand | väterlich durchgezogen, mütterlich gestrichelt, Nachkommen gepunktet |
| **Ecke** | Dreieck in der linken oberen Ecke | väterlich gefüllt, mütterlich schraffiert, Nachkommen als Umriss |
| **Ohne Form** | ohne Markierung; mit eingeschalteter Tönung kennzeichnet nur der Hintergrund der Karte die Linie | – |

- **Farben:** väterlich blau, mütterlich rosa, Nachkommen ocker. Eine feste Palette, ohne Wahl. Die Farben
  unterscheiden sich auch in der Helligkeit (väterlich dunkel, Nachkommen mittel, mütterlich hell), sodass sie sich
  auch bei schwächerem Farbsehen und in Graustufen unterscheiden lassen. Das dunkle Erscheinungsbild hat eigene Töne;
  seine Tönungen haben die Helligkeit der Karte und unterscheiden sich im Farbton, sodass sich die drei Linien und
  eine getönte von einer ungetönten Karte auch ohne Form unterscheiden lassen. Der Text der Karte hat auf jeder
  Tönung einen Kontrast von mindestens 4,5:1.
- **Karten in Linienfarbe tönen** (Standard aus) hinterlegt die Karte leicht in der Linienfarbe. Es ist ein eigener
  Schalter und gilt mit jeder Form und mit **Ohne Form**:
  - eine Form mit Tönung: Markierung und Hintergrund;
  - **Ohne Form** mit Tönung: die Karte kennzeichnet nur der Hintergrund;
  - **Ohne Form** ohne Tönung: die Karten kennzeichnen die Linie gar nicht.
- **Wer eine Markierung hat:**
  - väterliche und mütterliche Linie: der Elternteil, alle seine Vorfahren und die Geschwister jedes von ihnen
    (Tanten, Onkel, Großonkel…);
  - Nachkommen: alle Nachkommen der zentralen Person;
  - ohne Markierung sind die zentrale Person, Partner (auch Partner der Nachkommen und Stiefeltern), Geschwister der
    zentralen Person, Cousins und Cousinen und Platzhalterpersonen (leerer Platz für einen unbekannten Elternteil).
- **Eine Person in beiden Linien** (zum Beispiel ein Vorfahr aus einer Ehe unter Verwandten) hat beide Markierungen:
  **Bogen**, **Streifen** und **Ecke** geteilt in eine väterliche und eine mütterliche Hälfte, **Buchstabenetikett**
  zwei Etiketten übereinander. Bis 3.29.0 bekam sie nur die väterliche.
- **Eltern gleichen Geschlechts** (beide Eltern der zentralen Person bekannt, beide Männer oder beide Frauen): die
  Linien heißen **Linie des 1. Elternteils** und **Linie des 2. Elternteils**, das Etikett trägt 1 und 2, die Farben
  bleiben.
- **Stammbaum-Legende** (Ansichten Familie und Nachkommen, Einstellung **Stammbaum-Legende**): Geschlechtsringe, ein
  Muster jeder Linie in der gewählten Form mit Namen und die Zeile „Ohne Markierung: fokussierte Person, Partner,
  Geschwister, Cousins“. Bei **Ohne Form** mit Tönung sind die Muster Quadrate der Tönung, in der Linienfarbe
  gerahmt (ebenso in den Einstellungen); ohne Tönung fehlt der Teil über die Linien. Einklappen der Legende:
  [A9.6](A9-using-the-app.md#A9.6).
- **Ein Bildschirmleser** liest bei der Karte die Linie in Worten („väterliche Linie“, „väterliche und mütterliche
  Linie“, „Nachkomme“, „Linie des 1. Elternteils“).
- **Dieselbe Markierung anderswo:** die Zeitleiste hat ein Linienzeichen vor dem Namen ([A6.3](#A6.3)), die Tabelle
  die Spalte **Linie** ([A6.7.2](#A6.7.2)); der Fächer in den Farben **Linien** ([A6.4](#A6.4)) und der Weg der
  Vorfahren auf der Karte ([A6.5.5](#A6.5.5)) haben dieselben Töne. Bei **Ohne Form** haben weder die Zeitleiste noch
  die Tabelle ein Zeichen.
- **Export und Druck:** Bildexport und Plakat zeichnen die gewählte Form und die Tönung, immer in den hellen Farben.
  Im Druck aus dem Browser haben alle Karten denselben grauen Rahmen; das Geschlecht zeigt der Ring am Foto oder an
  den Initialen, die Linie die Markierung. Die Markierung wird auch ohne Druck der Hintergründe gedruckt, die Tönung
  nicht (**Ohne Form** mit Tönung kennzeichnet im Druck nichts).
- **Grenzen:** die Markierung ist nur eine Schicht am Rand der Karte und ändert weder Größe noch Inhalt der Karte.
  Die Linie wird bei jeder Änderung der zentralen Person neu berechnet. Die Einstellung gehört zum Gerät und wird
  nicht mit dem Stammbaum gespeichert.
- **Bedienung:** **Einstellungen** → **Stammbaumansicht** → **Linienmarkierung**: **Bogen** · **Buchstabenetikett** ·
  **Streifen** · **Ecke** · **Ohne Form**; darunter **Karten in Linienfarbe tönen**. Jede Wahl hat eine Kartenvorschau.
- **Gilt seit:** Zweigfarben App 1.8.0 (orange, blau und grün); 3.30.0: **Linienmarkierung** statt des Schalters
  **Zweigfarben**, neue Farben, Formen, Tönung, beide Markierungen, Linien des 1. und 2. Elternteils. Eingeschaltete
  **Zweigfarben** werden als **Bogen** übernommen, ausgeschaltete als **Ohne Form** ohne Tönung.

<!-- zdroj: app:0e403ec6 src/branch-colors.ts classifyBranches (collectAncestorSide: předci + sourozenci každého předka; collectDescendants přes childIds; obě strany se sčítají R4; descendant jen mimo strany; focus smazán; numbered = oba rodiče známí a stejného pohlaví R5), src/settings.ts getBranchMarker (výchozí arc; branchColors false → off), isBranchTintOn (jen se značkou), isBranchTintChosen, save (migrace při prvním zápisu), src/renderer.ts renderCards (!isPlaceholder, viewMode ≠ timeline), src/branch-marker-attrs.ts (čtečka ariaPaternal/ariaBoth/ariaSlot1), index.html tokeny --branch-paternal #234e8c / --branch-maternal #d0679a / --branch-descendant #8a6400, tmavé #9cc2f2 / #f6a9cb / #e3b552, --branch-*-tint, CSS tvarů (arc, tag, stripe, corner; R4 .branch-paternal.branch-maternal) · app:c8afe382 index.html #branch-marker-setting (skupina settings.groupTree), #branch-tint-toggle, src/ui/branch-marker-ui.ts syncBranchLegend, src/ui/misc.ts (legenda jen family/descendants, isBranchLegendEnabled) · app:b94f3816 src/branch-marker-svg.ts, src/ui/export-image-ui.ts treeCardDrawing (branchMarker, branchTint, numbered; světlé hex), index.html @media print (R6: border 2px #999, white background, tiskové --branch-*, print-color-adjust) · strings.ts branchColors.* (settingLabel, markerArc…markerOff, defaultTag, tintLabel, legendPaternal…legendSlot2, legendNone, letterPaternal O, letterMaternal M, letterDescendant P) · barvy větví: app:6f86ad39 (v1.8.0) · CHANGELOG.cs.md 3.30.0 „Značení linií“ · dirigent:spec/112-znaceni-linii K1–K4, app:docs/ZADANI_DEV_linie-na-kartach.md R1–R6 · prace/1119-app-112-linie · Bez tvaru: app:999c373f src/types.ts BRANCH_MARKERS (none), src/settings.ts getBranchMarker (uložené off → none; branchColors false → none), isBranchTintOn (samostatně), isBranchMarkingOn, src/ui/branch-marker-ui.ts syncBranchLegend (none jen s podbarvením), src/branch-marker-attrs.ts, src/export-image.ts buildTreeSvg (none + tint = výplň karty), strings.ts branchColors.markerNone, tintHint · app:34aca82c index.html tmavé --branch-*-tint #172a41 / #3b1e2c / #372600 (světlost karty), světlé --text-faint #6a6254, .branch-swatch[data-shape="none"] rámeček var(--sw), src/__tests__/branch-tint-contrast.test.ts (4,5:1) · test/vysledek-1119-app-112-podbarveni -->

<a id="A6.1.6"></a>
### A6.1.6 Zurück zur Standardperson: ⌂

Die Schaltfläche ⌂ am Anfang von **Fokussiert auf** fokussiert die Standardperson des Stammbaums ([A6.1.1](#A6.1.1)),
wo auch immer die Mitte ist. Sie tut dasselbe wie Fokussieren an einer Karte: ein neuer Schritt des Verlaufs und die
Meldung „Fokus auf {Name} · ↩ Zurück“; **↩ Zurück**, der Pfeil ↩ unten links oder Alt+← bringt die vorige Mitte
zurück.

| Stammbaum-Einstellung (**Standardperson und -ansicht**) | Wen ⌂ fokussiert |
|---|---|
| **Bestimmte Person:** | diese Person; ist sie nicht mehr im Stammbaum, die erste Person des Stammbaums |
| **Zuletzt fokussiert** | die Person, auf die der Stammbaum beim Öffnen fokussiert hat (oder beim Wechsel zu diesem Stammbaum) |
| ohne Einstellung | die erste Person des Stammbaums |

- **Wo ⌂ ist:**
  - Familie: in **Fokussiert auf** am Computer, in der Leiste auf dem Tablet und auf dem Telefon quer, im Personenpanel
    auf dem Telefon;
  - Nachkommen: am Anfang der Plakette der Ansicht;
  - Fächer: oben links; bei einer fixierten Mitte ([S4.1.3](S4-research-from-the-app.md#S4.1.3)) vor **Mitte: {Name} ·
    Lösen**, und die Fixierung wird zuerst gelöst.
- **Die Standardperson ist schon die Mitte:** ⌂ bleibt an seinem Platz, gefüllt und gedämpft, mit dem Tooltip
  „Standardperson ist im Fokus: {Name}“. Weder ein Klick noch die Taste tun etwas.
- **Tooltip:** „Standardperson fokussieren: {Name}“, bei der ersten Person des Stammbaums mit dem Zusatz „ – erste
  Person im Stammbaum“, bei **Zuletzt fokussiert** „ – beim Öffnen fokussiert“, und „(H)“.
- **Tasten:** H (außerhalb eines Textfelds und eines offenen Menüs); dazu ⌘1 auf dem Mac und Strg+1 unter Windows und
  Linux, wenn der Browser sie an die App weitergibt. In einem Browser-Tab nimmt der Browser sie meist selbst zum
  Wechsel auf den ersten Tab. Übersicht der Tasten: [A9.8](A9-using-the-app.md#A9.8).
- **Beim Verfolgen der Forschung** wirken ⌂ und H wie eine andere Wahl einer Person: sie unterbrechen das Folgen des
  Agenten im Hauptfenster (**Zurück zum Agenten**, [S4.1.1](S4-research-from-the-app.md#S4.1.1)). Ist die
  Standardperson schon die Mitte, nicht.
- **Grenzen:** ein leerer Stammbaum hat kein ⌂. Karte, Zeitleiste, Tabelle und weitere Fenster ([A6.8](#A6.8)) haben
  kein ⌂, und H tut dort nichts.
- **Bedienung:** ⌂ bei **Fokussiert auf** (Nachkommen: in der Plakette, Fächer: oben links); die Taste H.
- **Gilt seit:** App 3.30.0

<!-- zdroj: app:e52adde6 src/default-person.ts defaultTarget (specific, first, opened, fallbackFirst; prázdný strom null), startupPerson · src/ui/default-focus.ts FALLBACK_TO_FIRST = true, rememberOpenedFocus, isAtDefault (Vějíř: liveFollowPinned ?? focus), isDefaultFocusContext (hlavní okno, HOME_VIEWS family/descendants/fan), focusDefaultPerson (unpinFanCenter, TreeRenderer.focusFromTab → showFocusToast) · app:b6df0770 §3 telefon (panel osoby), §6 defaultFocusKey (H/h bez Ctrl/⌘/Alt mimo pole; ⌘1 / Ctrl+1 podle code Digit1 i z pole), src/ui/misc.ts defaultFocusKeyHeld, §7 Potomci (#descendants-badge), Vějíř (pilulka vlevo nahoře, pin), §9 pauza sledování · strings.ts focus.focusedOn, focusHome, focusHomeFirst, focusHomeOpened, focusHomeAt, focusToast, focusToastBack · CHANGELOG.cs.md 3.30.0 „Zpět na výchozí osobu“ · dirigent:spec/111 K1.1–K1.6 · app:docs/ZADANI_DEV_vychozi-osoba.md §1–§9 · ⌘1 / Ctrl+1 v kartě prohlížeče neměřeno (spec 111 Otevřené) -->

<a id="A6.2"></a>
## A6.2 Ansicht Nachkommen

Die Ansicht Nachkommen zeigt nur die zentrale Person und ihre Nachkommen bis zur Tiefe Nachkommen: ohne Vorfahren,
Tanten, Onkel und Cousins.

- **Nur Blutsverwandte** (Standard): die leiblichen Nachkommen der zentralen Person.
- **Ganze Familien**: dazu weitere Partnerschaften der Partner und ihre Stiefkinder, abgeschwächt.
- **Bedienung:** Schalter in der Leiste der Ansicht; die Standardwahl hält die Einstellung **Nachkommenansicht**.
- **Gilt seit:** Ansicht App 1.4.0; Ganze Familien App 1.9.2

<!-- zdroj: app:src/layout/pipeline/index.ts includeAuntsUncles: !descendantsOnly, expandLineageOnly: descendantsOnly && !isDescendantsFullFamilies() · strings.ts viewModeSwitch.bloodOnly, viewModeSwitch.fullFamilies, viewModeSwitch.settingLabel · settings descendantsFullFamilies (výchozí false) -->

<a id="A6.3"></a>
## A6.3 Zeitleiste

Die Zeitleiste zeigt die Personen der Ansicht als Lebensbalken auf einer Jahresachse.

- Eine Zeile bekommt nur eine Person mit Geburtsjahr. Die übrigen zählt die Ansicht und schreibt „N Personen ohne
  Geburtsjahr nicht angezeigt“. Platzhalterpersonen (leerer Platz für einen unbekannten Elternteil) werden
  ausgelassen.
- Reihenfolge der Zeilen: Geburtsjahr, dann Name ohne Titel.
- Der Balken einer lebenden Person reicht bis heute. Eine verstorbene Person ohne Sterbedatum hat einen Balken bis
  zum letzten bekannten Ereignis und ein offenes Ende.
- Das Jahr der Hochzeit stammt aus dem Anfangsdatum der Partnerschaft. Die Achse ist auf Jahrzehnte gerundet.
- Unter der Jahresachse läuft die Zeile der Geschichte ([A6.3.1](#A6.3.1)). Ohne Forschung oder ohne Ereignisse der
  Geschichte gibt es die Zeile nicht.
- Ein gemeinsames Ereignis von zwei oder mehr Zeilen ([A10.2](A10-shared-events.md#A10.2)) ist eine Markierung über
  die Zeilen seiner Personen, mit Beschriftung; Überfahren der Beschriftung nennt die Personen. Liegt über der ersten
  Zeile die Zeile der Geschichte, steht die Beschriftung einer Markierung aus der ersten Zeile nicht in ihr, sondern
  tiefer neben der Markierung.
- **Gilt seit:** Zeitleiste App 1.5.0; Zeile der Geschichte App 3.19.0, über die ganze Zeitleiste App 3.31.0;
  Markierung eines gemeinsamen Ereignisses App 3.28.0
- **Ab App 3.30.0:** mit eingeschalteter **Linienmarkierung** ([A6.1.5](#A6.1.5)) steht vor dem Namen der Person ein
  Linienzeichen in der gewählten Form (eine Person in beiden Linien zwei Zeichen, bei Eltern gleichen Geschlechts 1
  und 2); Überfahren des Zeichens nennt die Linie in Worten. Der Lebensbalken behält die Farbe des Geschlechts und
  wird nicht getönt. Das Plakat der Zeitleiste zeichnet das Zeichen ebenso. Bei **Ohne Form** gibt es kein Zeichen.

<!-- zdroj: app:src/timeline.ts computeTimelineModel, :59 TimelineHistory · strings.ts timeline.omitted · CHANGELOG.cs.md 3.19.0 -->
<!-- zdroj: app:cecd72a4 src/renderer.ts timelineBranchSigns (znak legendy před jménem, title linie slovy, dvě značky R4, číslice R5; plakát SVG) · CHANGELOG.cs.md 3.30.0 „Značení linií“ · dirigent:spec/112-znaceni-linii -->
<!-- zdroj: app:55ac8a08 src/timeline-chart.ts sharedMarkSvg (jedna značka přes řádky, popisek jednou, jména v title) · app:f8531340 placeSharedLabels · app:cc6f3104 placeSharedLabels topTaken (s řádkem dějin popisek značky z prvního řádku níž, ne v řádku dějin) · dirigent:spec/085 §2e -->

<a id="A6.3.1"></a>
### A6.3.1 Die Zeile der Geschichte über die ganze Zeitleiste

Die Zeile der Geschichte zeigt die Geschichte der ganzen Zeit und aller Personen auf der Zeitleiste: jedes Ereignis
eines Landes oder einer Region, in dem oder der in seinem Jahr mindestens eine Person mit Zeile lebte.

- **Welche Ereignisse:** Ereignisse des Umfangs Land oder Region (**Regionalgeschichte**). Ein Ereignis wird
  genommen, wenn die Person im Jahr des Ereignisses an einem Ort lebte, dem die Forschung das Ereignis zugeordnet
  hat. Bei einem Zeitraum genügt eines seiner Jahre, und nur in den Lebensjahren der Person. Wo eine Person in
  welchem Jahr lebte, wird wie bei der Geschichte in der Personenkarte bestimmt.
- Jedes Ereignis steht einmal in der Zeile, auch wenn es mehrere Personen betrifft. Eine Person ohne Zeile (ohne
  Geburtsjahr, Platzhalter) zählt nicht.
- **Ausblenden:** Ein im ganzen Stammbaum oder für die ganze Region ausgeblendetes Ereignis ist nirgends. Ein an
  einem Ort ausgeblendetes Ereignis zeigt ein anderer Ort der Person, der es nicht ausblendet.
- **Aussehen:** Der Hintergrund der Zeile reicht über die ganze Achse. Das Leben der zentralen Person ist eine dünne
  Linie unten in der Zeile. Zeiträume haben Streifen auf zwei Spuren.
- **Gruppen:** Nahe Ereignisse bilden eine Gruppe (am Computer 16 px, am Telefon 22 px). Eine Gruppe hat das Symbol
  der Art, die in ihr am häufigsten ist (bei Gleichstand die frühere), in der Farbe ihrer Herkunft. Mehr Ereignisse
  zeigen ein Abzeichen mit der Anzahl. Zwei Gruppen, deren Zeichen sich berühren würden, werden eins.
- **Das Land oder die Region** wird in der Beschriftung und im Detail nur genannt, wenn die Ereignisse der Zeile aus
  mindestens zwei Ländern oder Regionen stammen.
- **Detail einer Gruppe:** Überfahren zeigt eine Zeile je Ereignis (Jahr, Art, Land oder Region, Text).
  - Computer: Ein Klick öffnet ein Fenster an der Gruppe. Darin jedes Ereignis mit Jahren, Symbol, Text, „Art · Land
    oder Region“ und „Betrifft:“ mit höchstens zwei Namen und „und N weitere“; die zentrale Person steht vorn. Ein
    Name öffnet die Personenkarte in der Zeile des Ereignisses. Esc, ein Klick daneben oder Scrollen schließt das
    Fenster.
  - Telefon und Touchscreen: ein unteres Blatt „Geschichte 1880–1891“ mit den Ereignissen und unter **In der
    Personenkarte öffnen** eine Zeile für jede Person, die die Gruppe betrifft (höchstens vier und „und N weitere ›“).
    Eine Person öffnet die Karte beim ersten Ereignis der Gruppe, das sie betrifft.
- **Wann es die Zeile gibt:** Der Stammbaum hat eine Forschung mit Geschichte, in den Einstellungen ist
  **Zeitgeschehen im Lebenslauf** eingeschaltet und in der Zeitleiste der Personenkarte der Chip **Zeitgeschehen**.
  In den Einstellungen ausgeschaltete Herkünfte (**Regionalgeschichte**, **Ortsgeschichte**, **Aus
  Forschungsquellen**) werden nicht gezeichnet.
- **Grenzen:** Die Zeile der Geschichte gibt es nur auf dem Bildschirm. Druck und Plakat der Zeitleiste zeichnen sie
  nicht.
- **Bedienung:** App: Ansicht **Zeitleiste**, Zeile **Geschichte ▾** ([A6.3.2](#A6.3.2))
- **Gilt seit:** App 3.31.0 (bis dahin die Zeile der Geschichte nur der zentralen Person)

<!-- zdroj: app:e843ab70 src/history.ts computeTimelineHistory (místa života personResidence, livedYear v letech života, období jeden rok, jednou na osobu, skrytí treeHidden/regionHidden/hidingFor, scope region → řádek, place/local → čáry; kinds z Nastavení) · src/timeline.ts timelineHistoryRow (jen řádky, které se kreslí; region jen při ≥ 2), timelineClusterKind, timelinePeriodTracks · app:a7391d4f src/timeline-chart.ts historyRowSvg (podklad přes celou osu, tl-hist-life, jen obrazovka) · app:79312e31 clusterTimelineHistory clearance, historyClusterClearance · app:1d2f8b55 src/ui/timeline-history-ui.ts showTimelineHistoryPopover, timelineConcernPersons (max 2, ústřední první), showTimelineHistorySheet, timelineClusterPersons (4 a „a N další ›“) · src/ui/history-ui.ts historyTimelineSource (vrstva, výzkum, čip Dějiny karty) · strings.ts history.timelineRowLabel, timelineClusterAria, timelineEventLine, timelineYearsTitle, timelineConcerns, timelinePeopleMore, openInCard, settingLabel, kindRegion, kindPlace, kindLocal · dirigent:spec/121 K1.1–K1.4, Rozhodnutí 20. 11. · prace/1120-app-121-casova-osa -->

<a id="A6.3.2"></a>
### A6.3.2 Optionen der Geschichte: Arten und Land

Die Beschriftung der Zeile **Geschichte ▾** öffnet die Optionen der Geschichte der Zeitleiste. Die Optionen gelten
für den Stammbaum, und das Gerät merkt sie sich.

- **Arten von Ereignissen:** **Alle** und neun Arten (Krieg, Epidemie, Volkszählung, Staat und Grenzen,
  Auswanderung, Recht, Wirtschaft, Katastrophe, Sonstiges), jede mit Symbol und der Anzahl der Ereignisse auf der
  Zeitleiste. Die Anzahl zählt die Zeile der Geschichte und die Ortsgeschichte auf den Lebenslinien zusammen; ein
  Ereignis auf mehreren Linien ist eines. Eine Art ohne Ereignis lässt sich wählen; der Filter bleibt für andere
  Zeitleisten.
- **Land oder Region:** nur, wenn die Ereignisse der Zeile aus mindestens zwei Ländern
  oder Regionen stammen. **Alle** und jedes Land
  oder jede Region nach der Anzahl der Ereignisse, eine Wahl. Gilt nur für die Zeile der Geschichte.
- **Auf den Lebenslinien:** die Option **Ortsgeschichte auf den Lebenslinien** ([A6.3.3](#A6.3.3)).
- **Der Filter in der Beschriftung:** „Geschichte · 3 Arten“ (die gewählten Arten, die die Zeitleiste hat),
  „Geschichte · Land oder Region“, bei beiden „Geschichte · 2 Filter“. Eine Beschriftung mit Filter ist getönt.
- **Nichts bleibt:** Die Zeile schreibt „Keine Ereignisse für die gewählten Arten“ (am Telefon „Keine Ereignisse“)
  und **Filter aufheben**. **Filter aufheben** hebt Arten und Land auf einmal auf; die Ortsgeschichte auf den
  Lebenslinien bleibt.
- **Grenzen:** Die Optionen sind keine Daten des Stammbaums: Sie gehen in keinen Export, kein GEDCOM und keine
  Sicherung. Ein Land, das die Forschung nicht mehr kennt, wird nicht verwendet. Ein weiteres Fenster ([A6.8](#A6.8))
  übernimmt die Änderung.
- **Bedienung:** App: **Geschichte ▾** → **Arten von Ereignissen**, **Land oder Region**, **Auf den Lebenslinien**,
  **Filter aufheben**. Am Computer ein Fenster unter der Beschriftung, am Telefon und Touchscreen ein unteres Blatt.
- **Gilt seit:** App 3.31.0

<!-- zdroj: app:3e3e4949 src/ui/timeline-history-ui.ts showTimelineHistoryOptions, drawTimelineHistoryOptions (oblast jen hist.regions ≥ 2 nebo uložená; místní off/none), clearTimelineHistoryFilter · src/timeline.ts filterTimelineHistory (oblast jen řádek), timelineHistoryRowState, toggleTimelineKind, clearTimelineFilter (local zůstane), timelineFilterKindCount · app:601f52d4 timelineHistoryFacets (počty jednou podle id, řádek + místní), .tl-hist-btn.is-filtered · src/timeline-chart.ts historyFilterText · src/settings.ts getTimelineHistory/setTimelineHistory (lifelineByTree.timeline, jen zařízení), TimelineHistoryOptions · src/history.ts timelineHistoryRegion (neznámá oblast → všechny) · strings.ts history.timelineOptKinds, timelineOptRegion, timelineOptAllRegions, timelineOptLines, timelineFilterKinds, timelineFilterBoth, timelineClearFilter, timelineEmptyFilter, timelineEmptyFilterShort, kinds.* · dirigent:spec/121 K3.1 -->

<a id="A6.3.3"></a>
### A6.3.3 Ortsgeschichte auf den Lebenslinien

Die Option **Ortsgeschichte auf den Lebenslinien** zeichnet die Ortsgeschichte und die Funde der Forschung aus
Quellen direkt auf den Lebensbalken der Person, im Jahr des Ereignisses.

- **Welche Ereignisse:** **Ortsgeschichte** und **Aus Forschungsquellen** ([R4.7](R4-places.md#R4.7)) im Ort, in
  dem die Person im Jahr des Ereignisses lebte. Bei einem Zeitraum ab dem ersten Jahr, in dem sie dort lebte; unter
  dem Balken läuft dann ein Streifen bis zum Ende des Zeitraums (höchstens bis zum Ende des Balkens).
- **Aussehen:** das Symbol der Art in einem Rahmen in der Farbe der Herkunft. Ein Symbol näher als 10 px am Punkt
  eines Ereignisses oder an der Markierung eines gemeinsamen Ereignisses rückt 11 px zur Seite. Nahe Symbole
  gruppieren sich wie in der Zeile der Geschichte, mit Abzeichen der Anzahl. Unter 1,5 px pro Jahr (lange Achse am
  Telefon) hat eine Linie ein Symbol mit allen Ereignissen.
- **Detail:** Überfahren zeigt eine Zeile je Ereignis mit dem Ort und bei einem Fund die Quelle. Ein Klick am
  Computer öffnet die Personenkarte in der Zeile des Ereignisses. Am Telefon und Touchscreen ein unteres Blatt mit den
  Ereignissen und **In der Personenkarte öffnen ›**.
- **Standard:** aus. Die Option gilt für den Stammbaum und wird gemerkt ([A6.3.2](#A6.3.2)). Der Filter der Arten
  gilt auch für sie.
- **Grenzen:** Sind in den Einstellungen **Ortsgeschichte** und **Aus Forschungsquellen** beide aus, lässt sich die
  Option nicht einschalten. Ohne Ortsgeschichte auf der Zeitleiste schreibt die Option „Auf der Zeitleiste gibt es
  keine Ortsgeschichte.“ Die Symbole gibt es nur auf dem Bildschirm; Druck und Plakat zeichnen sie nicht. Die
  Tastatur erreicht sie nicht (Tab).
- **Bedienung:** App: **Geschichte ▾** → **Ortsgeschichte auf den Lebenslinien**
- **Gilt seit:** App 3.31.0

<!-- zdroj: app:967b6b97 src/history.ts computeTimelineHistory (place/local → čáry, rok příchodu moved, year2, source) · src/timeline.ts layoutTimelineLocal, timelineLocalX (LOCAL_CLEAR_PX 10, LOCAL_STEP_PX 11), LOCAL_DENSE_PX_PER_YEAR 1.5, timelineLocalOptionState (off/none), timelineHistoryRow (filtr druhů i na čáry) · src/timeline-chart.ts localSvg (jen screen, tl-loc-box, tl-loc-period, title se zdrojem LOCAL_SOURCE_MAX 60, role img mimo Tab) · src/ui/timeline-history-ui.ts openTimelineHistory, showTimelineLocalSheet · src/settings.ts TimelineHistoryOptions.local (výchozí false) · strings.ts history.timelineOptLocal, timelineOptLocalHint, timelineOptLocalOff, timelineOptLocalNone, timelineLocalAria, timelineLocalSource, openInCard · dirigent:spec/121 K2.1–K2.3 -->

<a id="A6.4"></a>
## A6.4 Fächer

Der Fächer zeigt die Vorfahren der zentralen Person in Kreissegmenten, Generation für Generation.

- **Form:** **Halbkreis** · **Vollkreis** · **Beidseitig** (Vorfahren und Nachkommen).
- **Generationen** der Vorfahren 3–10, Standard 5. In der Form Beidseitig **Nachkommen** 1–5, Standard 3.
- Nummerierung der Vorfahren: 1 ist die zentrale Person, der Vater der Person n hat die Nummer 2n, die Mutter 2n+1.
  Die Linie des Vaters ist links. Nummern an den Segmenten schaltet die Einstellung **Fächerdiagramm**
  „Kekulé-(Ahnen-)Nummern anzeigen“ ein (Standard aus).
- Eltern sind die ersten zwei erfassten Eltern der Person. Eine nicht biologische Beziehung (Adoption, Stief-,
  Pflegeverhältnis) ist am Segment gekennzeichnet.
- Ein Vorfahr, der im Fächer ein zweites Mal vorkommt, wird erneut gezeichnet, aber nicht weiter entfaltet; Legende
  **↻ wiederholt (Ahnenschwund)**. Die Auswahl **Erstes Vorkommen zeigen** springt an seine erste Stelle.
- Nachkommen (Form Beidseitig): Partnerschaften in der Reihenfolge der Hochzeiten (Datum der Hochzeit, dann
  Reihenfolge in den Daten), Kinder nach Geburt. Ein unbekannter Partner sammelt die Kinder ohne zweiten Elternteil.
  Eine Partnerschaft ohne Kinder ist nur bei der zentralen Person zu sehen.
- **Farben:** **Geschlecht** · **Linien** (vier Linien der Großeltern: Vater des Vaters, Mutter des Vaters, Vater
  der Mutter, Mutter der Mutter) · **Stammlinien** ([A4](A4-surnames-and-families.md)).
  - **Ab App 3.30.0:** **Linien** in den Farben der **Linienmarkierung** ([A6.1.5](#A6.1.5)): die Seite des Vaters
    blau (Vater des Vaters blau, Mutter des Vaters blaugrün), die Seite der Mutter rosa (Vater der Mutter rosa,
    Mutter der Mutter himbeerrot), die Eltern in einem zarten Ton ihrer Seite, die Nachkommen in der Form Beidseitig
    ocker. Bis 3.29.0 andere Töne.
  - **Ab App 3.30.0:** **Stammlinien** färben nach der Seite des Fächers, mit einer Legende nach Seiten und dem
    Hervorheben einer Stammlinie ([A6.4.1](#A6.4.1)).
- **Ursprüngliche Person** bringt den Fächer zurück zu der Person, von der aus begonnen wurde.
- **Gilt seit:** Fächer App 1.8.0; neuer Fächer mit Formen, Farben und Ahnenschwund App 3.20.0
- **Ab App 3.27.0:** eine Partnerschaft ohne Datum der Hochzeit wird nach dem spätesten möglichen Datum der
  Hochzeit geordnet: dem früheren aus dem Ende der Partnerschaft (Scheidung) und der Geburt des ersten Kindes der
  Partnerschaft. Eine Hochzeit „vor 1982“ steht vor einer Hochzeit im Jahr 1982. Eine Partnerschaft ohne diese Daten
  kommt nach den anderen. Dieselbe Reihenfolge haben die Partner neben der Person und die Marken der Ehefolge („1. ∞“)
  auf den Karten.

<!-- zdroj: app:src/fan-chart.ts FAN_MIN_GENERATIONS, FAN_MAX_GENERATIONS, FAN_DEFAULT_GENERATIONS, parentSlots, repeatOf · strings.ts fan.shapeHalf, fan.shapeFull, fan.shapeTwo, fan.colorGender, fan.colorLine, fan.colorRod, fan.legendRepeats, fan.originPerson, fan.showFirst, fanChart.kekuleHint · settings fanKekule (výchozí false) · spec 029 · CHANGELOG.cs.md 3.20.0 · 3.30.0: app:cecd72a4 src/fan-colors.ts LINE_HUE [258, 232, 352, 5], PARENT_LINE_HUE, DESCENDANT_LINE_HUE 82, parentLineColor, descLineColor (dřív 50/95/215/320, rodiče 70/250, potomci 150) · 3.27.0: app:ad1ca16c src/marriage-order.ts marriageKey (BOUND 0.5, qualifier „<“; bez sňatku min(endDate, narození dětí)), marriageDates, compareMarriages, marriagesInOrder (partneři vedle osoby, značka „1. ∞“) · src/fan-chart.ts familiesOf · CHANGELOG.cs.md 3.27.0 · dirigent:prace/1109-app-tester-vlna1 (T50, T13) -->

<a id="A6.4.1"></a>
### A6.4.1 Stammlinienfarben und Hervorheben einer Stammlinie

In den Farben **Stammlinien** hat jede Stammlinie im Fächer ihre eigene Farbe, und die Farbe sagt, auf welcher Seite
des Fächers die Stammlinie liegt: die väterliche Seite kalte Töne von Blau und Grün, die mütterliche warme Rosa- und
Orangetöne, die Nachkommen (Form Beidseitig) Ocker.

- **Seite einer Stammlinie:** die Stammlinie der zentralen Person gehört zur väterlichen Seite. Eine Stammlinie, die
  im Fächer nur unter den Nachkommen ist, gehört zu den Nachkommen. Jede andere gehört zu der Seite, auf der sie der
  Mitte am nächsten ist (im niedrigsten Ring); bei Gleichstand zur väterlichen.
- **Reihenfolge der Stammlinien:** nach der Zahl der Sektoren im Fächer (eine wiederholte Person zählt jedes Mal),
  dann nach der Größe im Stammbaum. Die ersten zehn Stammlinien mit mindestens zwei Sektoren und die Stammlinie der
  zentralen Person haben einen kräftigen Ton, die übrigen einen gedämpften.
- **Grau** sind nur Personen ohne Stammlinie, unbekannte Personen (?) und leere Plätze (+). Jede Stammlinie im Fächer
  hat eine Farbe.
- **Nachbarn:** wenn die Töne einer Seite ausgehen, wiederholen sie sich, aber nie auf benachbarten Sektoren
  (nebeneinander, über eine Generation, auch nicht über die Naht des vollen Kreises), und ein neu vergebener Ton auch
  nicht einen Sektor weiter. Den Ton einer anderen Seite nimmt eine Stammlinie nur, wenn keiner der eigenen genug
  verschieden ist.
- **Gedächtnis der Farben:** das Fenster merkt sich den Ton jeder Stammlinie, auch einer, die gerade nicht zu sehen
  ist. Nach dem Neuzentrieren und nach der Rückkehr zu einer früheren Mitte haben die Stammlinien dieselben Farben.
  Ein gemerkter Ton weicht nur einem Nachbarn mit demselben Ton, sodass nach einer Rückkehr derselbe Ton einen Sektor
  weiter erscheinen kann. Eine neue Stammlinie bekommt zuerst einen Ton, den sich keine Stammlinie merkt. Das
  Gedächtnis verschwindet nach dem Verlassen der Ansicht oder des Stammbaums; ein weiteres Fenster ([A6.8](#A6.8))
  übernimmt es vom Hauptfenster.
- **Legende:** die Gruppen **Väterliche Seite**, **Mütterliche Seite** und **Nachkommen**; in jeder zuerst die
  Stammlinie der zentralen Person („· Mitte“), dann die Stammlinien nach der Zahl der Personen im Fächer („7×“). Im
  Hauptteil stehen höchstens zwanzig Stammlinien mit mindestens zwei Sektoren und die Stammlinie der zentralen Person.
  - **Weitere · N Stammlinien** fasst die kleineren Stammlinien in eine Zeile mit zweifarbigem Muster und der Zahl
    der Personen zusammen (Personen ohne Stammlinie zählen hierher). Aufgeklappt zeigt sie die kleineren Stammlinien
    in ihren Farben, nach Zahl und Name. Das Aufklappen wird auf dem Gerät gespeichert.
  - **ohne Stammlinie** steht innerhalb von **Weitere**, und wenn **Weitere** fehlt, als eigene Zeile.
  - Die Zeilen sind Schaltflächen in einem Halt der Tab-Taste (Pfeile, Pos1, Ende). Das Überfahren einer Zeile mit
    der Maus hebt die Stammlinie als Vorschau hervor.
- **Hervorheben einer Stammlinie:** ein Klick auf eine Zeile der Legende oder **Stammlinie {Stammlinie} hervorheben**
  im Menü des Sektors hebt die Stammlinie des Stammbaums hervor ([A6.6](#A6.6)), wie in der Ansicht Familie. Die
  Sektoren der Stammlinie haben einen gestrichelten Umriss, die übrigen sind gedämpft. Die Hervorhebung bleibt beim
  Neuzentrieren. Ein zweiter Klick, **Hervorhebung der Stammlinie aufheben**, × am Etikett oder Esc heben sie auf.
  Beim Einpassen hält der Fächer den Streifen mit dem Etikett der Hervorhebung frei; eine vergrößerte Ansicht bleibt,
  wie sie ist. Ab App 3.31.0 ist die hervorgehobene Stammlinie die Auswahl des Fensters ([A6.6](#A6.6)): Sie gilt auch
  in Familie und Nachkommen, und das Aufheben der Hervorhebung hebt die Auswahl des Fensters auf.
- **Telefon:** ein Tippen auf eine Zeile im Blatt der Legende hebt die Stammlinie hervor (oder hebt das auf) und
  schließt das Blatt. Der Farben-Chip zeigt dann statt der Punkte Muster und Namen der Stammlinie. **Tablet:** die
  Zeilen der Legende haben die Größe eines Bedienelements.
- **Bild, Plakat und Druck:** die Hervorhebung wird übernommen (gestrichelter Umriss, die übrigen Füllungen heller),
  der Untertitel nennt „Stammlinie {Stammlinie} hervorgehoben“, wenn eine Person der Stammlinie gezeichnet ist. Die
  Legende des Plakats ist nach Seiten, die hervorgehobene Stammlinie fett und unterstrichen. Die Etiketten der
  Hervorhebung werden nicht gedruckt.
- **Grenzen:** der Fächer auf der Seite der Person hat nur die Geschlechtsfarben.
- **Bedienung:** **Farben** › **Stammlinien**; die Zeilen der Legende; im Menü des Sektors **Stammlinie {Stammlinie}
  hervorheben** / **Hervorhebung der Stammlinie aufheben**; × am Etikett; Esc.
- **Gilt seit:** App 3.30.0 (Farben **Stammlinien** seit App 3.20.0; bis 3.29.0 nur die zehn größten Stammlinien
  farbig, die übrigen grau)

<!-- zdroj: app:src/fan-rod-assign.ts (strany P/M/D: rod středu P, jen potomci D, jinak nejnižší prstenec, shoda P; pořadí počet výsečí › velikost › id; FAN_ROD_MAX_STRONG 10, FAN_ROD_LEGEND_MAIN 20, tier S/T; opakování odstínů ne na sousedních výsečích ani o jednu dál, výpůjčka jiné strany) · src/fan-colors.ts paleta P/M/D světlá, tmavá, tisk, fanRodLegend, fanRodOtherSwatch (K1.7), legendOther, legendNoRod · src/ui/fan-view.ts legenda (FAN_STORAGE_KEYS.legendOtherOpen, náhled jen při (hover: hover)), setRodSelection(…, 'legend'), forgetRodColors · strings.ts fan.legendFatherSide, legendMotherSide, legendDescendants, legendOther, legendNoRod, legendCentre, colorsChipRod, menuHighlightRod, menuUnhighlightRod, posterHighlighted · app:1d9dad0f, 7231dd13 (legenda po stranách), 77282e4e (telefon, tablet), b31c74a9 (štítky se netisknou), defe20a6, 7821ea72 (vějíř mimo štítek), 1ad91795 (paleta P/M/D), a265a3cc (paměť barev při návratu, další okna) · dirigent:spec/114-vejir-barvy-rodu · test/vysledek-1119-app-vejir-rody, vysledek-1119-app-vejir-barvy-vse · CHANGELOG.cs.md 3.30.0 · 3.31.0: src/ui/rod-view.ts selectRodFromFan → setRodSelection / clearRodSelection = clearSelection (app:51ad8fd6) -->

<a id="A6.4.2"></a>
### A6.4.2 Darstellung des Fächers

Die Schaltfläche **Darstellung** in der Leiste des Fächers (in einer schmalen Leiste nur ein Symbol) öffnet den
Bereich **Darstellung des Fächers**. Er ändert, wie der Fächer aussieht, nicht den Stammbaum: er wirkt auch in einem
schreibgeschützten Stammbaum, beim Verfolgen einer Forschung und in der gespeicherten Seite.

- **Stil:**
  - **Farbig** (für den Bildschirm): Standard, die Zeichnung wie bisher;
  - **Pastell** (weniger Tinte);
  - **Antik** (als Geschenk): Sepia und Pergament, die Schrift Strom Serif;
  - **Schwarzweiß** (Schwarzweißdrucker): Graustufen und Muster (Linien, Gitter, Punkte, Ringe, Kreuze, Striche),
    keines schräg. Die schräge Schraffur bleibt nur einer wiederholten Person (Ahnenschwund).

  Jeder Stil hat eine Form für das helle und das dunkle Erscheinungsbild und für den Druck.
- **Farben der Stammlinien** (nur bei den Farben **Stammlinien**, sonst „Nur bei Farben nach Stammlinien.“):
  - **Alle Stammlinien**: Farben wie in [A6.4.1](#A6.4.1);
  - **Hauptstammlinien**: „die 10 größten im Fächer farbig, die übrigen grau.“ Die Stammlinie der zentralen Person
    ist immer unter den Hauptstammlinien (sie ersetzt die zehnte). Die Legende hat eine graue Zeile **Weitere
    Stammlinien (N)**, der Untertitel des Plakats „Farben der Hauptstammlinien“. Die Farben der Hauptstammlinien und
    das Gedächtnis der Farben ändern sich nicht.
- **Text in den Segmenten:** **Name und Jahre** (Standard) · **Name, Daten und Orte** (Geburt und Tod mit Datum und
  Ort, vom Ort nur der Teil vor dem ersten Komma, zum Beispiel „* 22.11.1888 Kessenau“; nur wo es passt) · **Nur
  Namen** (in etwas größerer Schrift). „Wo der Text nicht passt, wird er gekürzt.“
- **Porträts** (standardmäßig aus): ein rundes Porträt; in App 3.31.0 („In der Mitte, bei Eltern und Großeltern“) in
  der Mitte und in den ersten zwei Ringen, ab 3.32.0 in jedem Ring (**Ab App 3.32.0** unten). Eine geschützte
  lebende Person hat kein Porträt. Der Text hat Vorrang: ein Porträt, für das
  kein Platz bliebe, wird nicht gezeichnet. Während des Ladens sagt der Bereich „Porträts werden geladen (k / n)“;
  „Im Fächer hat noch niemand ein Porträt.“
- **Drei Ebenen der Darstellung:**
  - die **Standarddarstellung** ist in **Einstellungen → Fächer** (Stil, Farben der Stammlinien, Text, Porträts),
    und das Gerät hält sie: „Jeder Start beginnt mit dieser Darstellung; im Bereich „Darstellung“ lässt sie sich nur
    für die aktuelle Arbeit ändern.“ Ein Fächer, der die Standarddarstellung zeigt, übernimmt eine Änderung in den
    Einstellungen sofort;
  - die **aktuelle** Darstellung aus dem Bereich gilt bis zum Schließen der App; das Neuladen der Seite behält sie;
  - die **Darstellung der Ausgabe** (Plakat, Bild, Druck) wird nicht gespeichert ([A6.4.3](#A6.4.3)).

  Eine niedrigere Ebene überschreibt nie eine höhere, nur **Als Standard speichern**.
<!-- zdroj 3.32.0: app:a938802d, bcdcab9e, f229be62 src/fan-chart.ts FAN_PORTRAIT_MIN_PX 32, portraitOf (každý prstenec předků i potomků, dPx < portraitMin → nic, fotka se pak ani nežádá; text výseče jako bez portrétu), opts.portrait jen pro výseče v pohledu, ne chráněná osoba · strings.ts fanLook.portraits, portraitsSub · CHANGELOG.cs.md 3.32.0 · dirigent:spec/118 K2.7, K2.8 -->
- **Fuß des Bereichs:** weicht die Darstellung vom Standard ab, „Weicht von der Standarddarstellung ab.“ mit **Als
  Standard speichern** („Als Standarddarstellung des Fächers gespeichert.“) und **Auf Standard zurücksetzen**; die
  Schaltfläche **Darstellung** trägt dann einen Punkt. Sonst „Standarddarstellung · änderbar in den Einstellungen“;
  der Link öffnet die Einstellungen bei der Gruppe **Fächer**.
- Ein weiteres Fenster ([A6.8](#A6.8)) beginnt mit der aktuellen Darstellung des Hauptfensters und behält seine
  Änderungen nur für sich.
- **Telefon:** **Farben** und **Darstellung** sind Reiter eines Blatts von unten; das Blatt öffnet sich auf dem
  zuletzt benutzten.
- **Grenzen:** der Fächer auf der Seite der Person ändert sich nicht (nur die Geschlechtsfarben).
- **Bedienung:** Leiste des Fächers → **Darstellung**; **Einstellungen → Fächer**.
- **Gilt seit:** App 3.31.0; 3.32.0: Porträts in jedem Ring
- **Ab App 3.32.0:** **Porträts** „Vorfahren und Nachkommen, wo Platz ist; Vergrößern zeigt weitere“: ein rundes
  Porträt in der Mitte und in jedem Segment jedes Rings, bei Vorfahren und (in der Form Beidseitig) auch bei
  Nachkommen und Partnern.
  - Ein Porträt wird nur gezeichnet, wo es beim aktuellen Zoom einen Durchmesser von mindestens 32 px hat und der
    Text des Segments daneben dasselbe sagt wie ohne es; sonst hat das Segment kein Porträt. Der Text hat weiter
    Vorrang.
  - Vergrößern zeigt die Porträts der äußeren Ringe; Fotos werden nur für Segmente geladen, die zu sehen sind und ein
    Porträt zeigen würden.
  - Auf dem Plakat und im Druck hat ein Porträt auf dem Papier einen Durchmesser von mindestens 7 mm
    ([A6.4.3](#A6.4.3)).

<!-- zdroj: app:53ad42f1 src/fan-look.ts (hlavička: tři úrovně, ne úprava stromu, další okno; FAN_LOOK_DEFAULT color/all/years/portraits false), storage-keys.ts FAN_STORAGE_KEYS, FAN_LOOK_SESSION_KEY · 2236bbd4 src/fan-rod-assign.ts (rodScope main: 10 největších, rod středu vždy), src/fan-colors.ts FAN_STYLES, FAN_PATTERNS (vl, hl, grid, dot, dot2, ring, plus, dash), palety světlá/tmavá/tisk · c2dc2520 src/fan-labels.ts (content years/places/names, místo před čárkou), src/fan-chart.ts portréty prstence 1–2, chránění žijící, text má přednost · 2e9d8ad0 Nastavení → Vějíř (index.html settings-group-fan, setFanDefaultLook; vějíř s výchozím vzhledem změnu převezme) · e07ed419 (stránka osoby) · strings.ts fan.look*, style*, scope*, content*, portraits*, lookDiffers, lookIsDefault, lookSaveDefault, lookResetDefault, lookSavedToast, defaultsDesc, textNote, legendOtherGrey, posterColorsMain · SPEC.md 1120-app-vejir-vzhled · spec 118 K1.1–K2.6 · CHANGELOG.cs.md 3.31.0 -->

<a id="A6.4.3"></a>
### A6.4.3 Darstellung des Posters

Der Dialog **Als Poster exportieren** (Menü **Poster exportieren**: SVG, PNG, Druck / PDF) hat beim Fächer die Gruppe
**Darstellung des Posters** mit denselben Optionen wie der Bereich **Darstellung** ([A6.4.2](#A6.4.2)) und mit
**Vorschau**.

- Die Optionen sind mit der Darstellung vom Bildschirm vorausgefüllt. „Gilt nur für diese Ausgabe; Bildschirm und
  Standard bleiben unverändert.“ Eine geänderte Option trägt „nur für diese Ausgabe geändert“; **Wie auf dem
  Bildschirm** bringt die Darstellung des Bildschirms zurück.
- Die Stammlinien behalten in einem anderen Stil oder einer anderen Farbgebung die Farben vom Bildschirm.
- Auf dem Telefon ist die Gruppe in eine Zeile zugeklappt.
- **Grenzen:** die Darstellung der Ausgabe wird nicht gespeichert; der nächste Export beginnt wieder mit der
  Darstellung des Bildschirms.
- **Bedienung:** **Poster exportieren** → **Darstellung des Posters**.
- **Gilt seit:** App 3.31.0
- **Ab App 3.32.0:** mit eingeschalteten **Porträts** zeichnen Plakat und Druck des Fächers (auch Strg+P aus der
  Ansicht auf ein A4-Blatt quer) ein Porträt dort, wo es auf dem Papier einen Durchmesser von mindestens 7 mm hat;
  sonst gilt dasselbe wie auf dem Bildschirm ([A6.4.2](#A6.4.2)).

<!-- zdroj 3.32.0: app:a938802d, bcdcab9e, f229be62 src/fan-chart.ts FAN_PORTRAIT_MIN_MM 7, renderFanPoster portraitMinPx = 7 mm / mmPerPx (0,26), fanPrintPortraitMinPx (A4 na šířku 277 × 0,85·190 mm, ne pod 32 px) · src/ui/fan-view.ts printing → fanPrintPortraitMinPx · dirigent:spec/118 K2.8 -->

<!-- zdroj: app:2e9d8ad0 src/ui/export-image-ui.ts (PosterLook předvyplněný z obrazovky, náhled toutéž funkcí plakátu, Jako na obrazovce, sloty rodů z obrazovky, telefon jeden řádek), src/fan-look.ts (vzhled výstupu se nepamatuje) · e2e/fan-look-output.spec.ts · strings.ts poster.menu, title, lookTitle, lookPreview, lookOnlyHere, lookAsScreen, lookChanged · SPEC.md 1120-app-vejir-vzhled · spec 118 -->

<a id="A6.5"></a>
## A6.5 Karte

Die Karte zeigt die Orte der Ereignisse der Personen.

- **Umfang:** **Diese Ansicht** (Standard, Personen der Ansicht) · **Ganzer Stammbaum**. Ab App 3.31.0 steht
  dazwischen **Auswahl**, die Personen der Auswahl des Fensters ([A6.5.7](#A6.5.7)), und das Hauptfenster merkt sich
  den gewählten Bereich für jeden Stammbaum.
- **Arten:** **Geburten** · **Sterbefälle** · **Eheschließungen** · **Weitere Ereignisse**. Standardmäßig sind alle
  eingeschaltet; die Auswahl wird auf dem Gerät gespeichert.
  - Die Taufe zählt zur Geburt, Beerdigung und Einäscherung zum Tod.
  - Verlobung, Aufgebot, Heiratserlaubnis und Ehevertrag zählen zur Eheschließung. Andere Ereignisse des Paares sind
    Weitere Ereignisse.
- Der Ort der Hochzeit wird gezeigt, wenn mindestens einer der Partner in der Ansicht ist.
- Ein Ort wird in der häufigsten Schreibung geschrieben. Eine Gemeinde ist ein Punkt, auch mit Hausnummern; ein Ort
  mit eigenen genauen Koordinaten bleibt ein eigener Punkt.
- **Migration im Zeitverlauf** zeigt die Orte nach Jahren und den Weg der Vorfahren zu einer Person
  ([A6.5.3](#A6.5.3)).
- **Gilt seit:** Karte App 1.10.0; Arten der Ereignisse und Punkte der Gemeinden App 3.21.0

<!-- zdroj: app:src/places.ts collectPlaces, groupTownPoints · src/ui/map-ui.ts (localStorage strom.map.kinds) · strings.ts map.scopeView, map.scopeTree, map.kinds · CHANGELOG.cs.md 3.21.0 · 3.31.0: app:src/settings.ts mapScopeByTree, getMapScopeForTree, setMapScopeForTree · src/ui/map-scope-ui.ts (jen hlavní okno) · spec 098 -->

<a id="A6.5.1"></a>
### A6.5.1 Woher die Karte die Lage eines Ortes nimmt

Im eigenen Stammbaum (ohne Forschung) schlägt die App die Lage der Orte selbst nach, im Dienst OpenStreetMap
(Nominatim). Sie sendet nur den Namen des Ortes, wie er im Stammbaum steht, und nur mit Zustimmung. In einem
Stammbaum aus der Forschung bestimmt die Forschung die Orte ([R4](R4-places.md)).

- **Grenzen:**
  - vor dem ersten Nachschlagen fragt die App (**Koordinaten online nachschlagen?**). Hinaus gehen nur Ortsnamen,
    keine Namen von Personen, keine Daten und Beziehungen. Höchstens etwa eine Anfrage pro Sekunde;
  - die Koordinaten werden im Stammbaum gespeichert: jeder Ort wird einmal nachgeschlagen, und die Karte funktioniert
    dann auch ohne Verbindung;
  - das automatische Nachschlagen nimmt das **erste Ergebnis** des Dienstes für den geschriebenen Namen. Bis App
    3.23.0 unterschied es dabei gleichnamige Gemeinden nicht: ein Ort konnte so in eine gleichnamige Gemeinde
    anderswo fallen. Eine Lage, die nicht in den Stammbaum passt, markiert **Prüfen** ([R4.4.1](R4-places.md#R4.4.1));
  - nur ein Ort mit Hausnummer, den der Dienst nicht gefunden hat, wird nach der Gemeinde nachgeschlagen. Von den
    Gemeinden dieses Namens wird die gewählt, die den übrigen Orten des Stammbaums am nächsten liegt („Mehrere Orte
    tragen diesen Namen; gewählt wurde der, der den übrigen Orten des Stammbaums am nächsten liegt.“); beim Ort steht
    **Lage nach dem Ort …**;
  - **ab App 3.24.0** wird die nächste Gemeinde bei jedem Ort gewählt: heißen zwei oder mehr Gemeinden genau wie der
    geschriebene Ort (ohne Rücksicht auf Groß- und Kleinschreibung und diakritische Zeichen), wird die genommen, die
    der Mitte des Stammbaums am nächsten liegt, nicht das erste Ergebnis. Die Mitte ist der Median der Lagen, die von
    Hand eingetragen oder mit **Beibehalten** bestätigt sind, wenn es mindestens 3 sind; sonst der Median aller Lagen
    des Stammbaums und der Orte, die das Nachschlagen ohne Zweifel gefunden hat. Ein Ort mit weiterer Angabe („Lhota u
    Kolína“, „Lhota 16“), eine einzige Gemeinde oder ein Stammbaum ohne Lagen bekommt das erste Ergebnis wie früher.
    Es bleibt bei einer Anfrage je Ort;
  - die Prüfung des Ortes sagt, wie viele Gemeinden dieses Namens die Karte gefunden hat („Die Karte fand 3 Orte
    dieses Namens und nahm den, der den übrigen Orten des Stammbaums am nächsten liegt.“); ab App 3.24.0, früher
    immer „zwei“;
  - eine Lage, die schon im Stammbaum ist, wird nicht verschoben: das Nachschlagen sucht nur Orte ohne Lage. Auch das
    Zusammenführen mit einem anderen Stammbaum oder einer GEDCOM-Datei überschreibt eine von Hand eingetragene oder
    mit **Beibehalten** bestätigte Lage nicht, es ergänzt nur fehlende. Eine falsche ältere Lage lässt sich nur von
    Hand verschieben;
  - was nicht gefunden wird, bleibt ohne Lage. Die App rät nichts: „Schreibweise prüfen oder das Land hinzufügen“.
- **Bedienung:** App: **Einstellungen → Orte online nachschlagen**; im Fenster der Orte **Falsche Stelle? Diesen Ort
  korrigieren**, **Diesen Ort unter einem anderen Namen suchen** (nur die Lage wird ergänzt, der Eintrag im Stammbaum
  ändert sich nicht), **Auch für die übrigen Hausnummern in … verwenden**, **Verwaiste Orte bereinigen (n)**.
- **Warum:** das Nachschlagen von Orten ist der einzige Teil der App, der etwas nach außen sendet; darum nur mit
  Zustimmung, nur Namen und jeden Ort einmal (Kommentar im Code). Das Limit von einer Anfrage pro Sekunde ist eine
  Bedingung des Dienstes.
- **Gilt seit:** App 1.10.0; **Falsche Stelle? Diesen Ort korrigieren** 1.10.1; **Verwaiste Orte bereinigen** 2.1.0;
  Lage nach dem Ort 3.21.0; die nächste gleichnamige Gemeinde bei jedem Ort und die Zahl der Gemeinden in der Prüfung
  3.24.0

<!-- zdroj: app:src/geocode.ts hlavička, REQUEST_INTERVAL_MS=1100, geocodePlace (limit 1, parseGeocodeResponse první výsledek), geocodeTown/pickTownHit nearestTo (od v3.21.0), geocodePlaces townFallback · app:src/strings.ts map.consentTitle, consentBody, settingLabel, wrongSpot (v1.10.1), searchLabel, attachOnly, useForOthers, cleanOrphans (v2.1.0), nearestTown, byTown, doneWithMisses · FB podnět 2026-11-04 (stejnojmenná obec) · od 3.24.0: geocode.ts treeCenter (medián, PERSONS_CENTER_MIN=3), sameNamedTowns, pickPlaceHit (townChoices), buildGeocodeUrl limit · place-check.ts multi count · strings.ts checkMulti(n) · merge-executor test (ruční poloha zůstane) · commit 046967d -->

<a id="A6.5.2"></a>
### A6.5.2 Orte ohne Karte in der Forschung suchen

Bei einem Stammbaum mit Forschung bietet die Statusleiste der Karte die Orte ohne Lage zum Suchen in der Forschung an
([R4.4](R4-places.md#R4.4)). Die Schaltfläche öffnet das Fenster **Orte** mit einer Vorschau; in die Warteschlange der
Forschung kommen die Orte erst nach **Vormerken**.

- **Grenzen:**
  - vor der Suche der Karte steht in der Leiste neben der Kartensuche **In der Forschung**. Nach der Suche, wenn die
    Karte manche Orte nicht gefunden hat, zeigt die Leiste „N Orte auf der Karte · K nicht gefunden“ und **In der
    Forschung suchen (K)**, gegebenenfalls „N zu bestätigen ›“ (öffnet **Offen** im Forschungsbereich);
  - die Schaltfläche gibt es nur bei einem Stammbaum mit Forschung und nur, wenn es etwas zu suchen gibt: einen Ort
    ohne Lage oder nicht bestimmt, der noch nicht in der Warteschlange ist, nicht bearbeitet wird und nicht auf eine
    Antwort wartet;
  - das Fenster **Orte** zeigt die Vorschau „N Orte ohne Karte in der Forschung suchen“. Vor **N Orte vormerken** wird
    nichts vorgemerkt, und kein Ort wird doppelt vorgemerkt;
  - läuft die Forschung auf einem anderen Computer, oder auf dem Telefon, sagt die App statt des Fensters, wo die
    Suche geht: „Suchen und prüfen geht in der Forschung auf dem Computer, wo sie läuft. Der Stand der Orte kommt mit
    dem Stammbaum hierher.“, auf dem Telefon „Suchen und prüfen geht am Computer mit der Forschung. Fragen zu Orten
    lassen sich auch hier beantworten, in Offen.“ Ältere Forschung: „Diese Version der Forschung sucht noch keine
    Orte.“;
  - beim Verfolgen der Forschung auf der Karte ([S4.1.3](S4-research-from-the-app.md#S4.1.3)) bietet die Zeile „… –
    ohne Position auf der Karte“ **In der Forschung suchen**: sie merkt diesen einen Ort sofort vor, ohne Vorschau;
    das Vormerken lässt sich in der Meldung zurücknehmen.
- **Bedienung:** App: Karte → Statusleiste → **In der Forschung**, nach der Kartensuche **In der Forschung suchen
  (K)** → Fenster **Orte** → **N Orte vormerken**.
- **Gilt seit:** App 3.25.0

<!-- zdroj: app:src/ui/map-ui.ts (stavový pruh, lookResearch, lookable), src/ui/place-actions.ts, src/ui/places-research-ui.ts (bulkLook, bulkLookHead, bulkLookGo, nic dvakrát), src/ui/map-follow-ui.ts (noCoords + places.research.look, Undo) · strings.ts map.onMap.notFound, lookResearch, lookResearchShort, lookResearchTitle, confirm; places.dialog.elsewhere, phoneLine, oldResearch · CHANGELOG.cs.md 3.25.0 · commit 2246ca28 · spec 058 -->

<a id="A6.5.3"></a>
### A6.5.3 Migration im Zeitverlauf

**Migration im Zeitverlauf** zeigt die Orte nach Jahren. Der Schieberegler in der Leiste unter der Karte bestimmt das
Jahr, und die Karte zeigt die Orte, die bis zu diesem Jahr hinzugekommen sind, und die Linien der Umzüge der Familie.

- **Grenzen:**
  - auf der Leiste sind nur Orte mit Jahr und Lage. Orte mit Lage, aber ohne Datum zählt die Statusleiste („N Orte
    ohne Datum werden auf der Zeitleiste nicht angezeigt.“);
  - die Leiste reicht vom ältesten bis zum jüngsten Jahr der Orte im Umfang (**Diese Ansicht** / **Ganzer
    Stammbaum**) und in den eingeschalteten Arten ([A6.5](#A6.5)). Ohne datierte Orte lässt sich der Modus nicht
    einschalten;
  - ein Punkt, an dem in den letzten zehn Jahren vor dem gewählten Jahr etwas geschah, ist hervorgehoben;
  - eine Linie führt vom Geburtsort eines Elternteils zum Geburtsort des Kindes, wenn beide Jahr und Lage haben und
    verschieden sind. Geschwister mit demselben Weg haben eine Linie. Die Linie verblasst mit dem Alter des Kindes,
    nach 60 Jahren auf 15 %. Gezeichnet werden nur Linien mit einem Ende am Kartenausschnitt, höchstens 400. Ohne die
    Art **Geburten** werden keine Linien gezeichnet („Der Familienweg erscheint nur mit Geburten.“);
  - **Abspielen** verschiebt das Jahr etwa alle 120 ms bis zum letzten Jahr. Im letzten Jahr beginnt **Abspielen**
    wieder von vorn.
- **Ab App 3.28.0:**
  - die Schaltfläche **◷ Zeitverlauf** hat neben dem Symbol auch Text;
  - die Karte bietet den Modus einmal an: solange er nicht eingeschaltet war und der Stammbaum mindestens zwei
    datierte Orte mit Lage hat, steht bei der Schaltfläche der Hinweis **Migration im Zeitverlauf** („Spielt ab, wie
    die Linien umzogen, und zeigt den Weg der Vorfahren zu einer Person.“). **Ausprobieren** schaltet den Modus ein,
    **Nicht jetzt** schließt den Hinweis. Nach einer der beiden erscheint der Hinweis auf diesem Gerät nicht mehr;
  - Tasten am Schieberegler: Pfeile um ein Jahr, PageUp und PageDown um 10 Jahre, Home und End an Anfang und Ende.
    Die Leertaste irgendwo auf der Karte (außer in Feldern und auf Schaltflächen) spielt ab oder pausiert. Ein
    Verschieben von Hand pausiert das Abspielen;
  - im Modus lässt sich eine Person wählen, zu der der Weg ihrer Vorfahren führt ([A6.5.4](#A6.5.4));
  - **Abspielen** und **Pause** sind gleich breit (so breit wie das längere der beiden Wörter in der jeweiligen
    Sprache), sodass sich Schieberegler, seine Marken und das Jahr beim Starten und Anhalten nicht verschieben. Das
    Telefon hat nur das Symbol.
- **Bedienung:** App: Karte → **◷ Zeitverlauf** (**Migration im Zeitverlauf**) → Schieberegler, **Abspielen** /
  **Pause**.
- **Gilt seit:** App 2.4.0; Arten der Orte 3.21.0; Text der Schaltfläche, einmaliges Angebot, Tasten und feste
  Breite von **Abspielen** 3.28.0

<!-- zdroj: app:src/map-time.ts collectDatedPlacePoints (undatedPlaceCount, minYear/maxYear) · src/ui/map-ui.ts drawMapTimeLayer (fresh = posledních 10 let, slice(0, 400) s koncem u výřezu), mapMigrationSegments (místa narození rodič → dítě, opacity max(0.15, 1 − věk/60·0.85), bez Narození nic), toggleMapTimePlay (setInterval 120, na konci od začátku), renderMapTimeTip / dismissMapTimeTip (strom.map.timeTipSeen, ≥ 2 datovaná místa s polohou, podklad mapy potvrzený), klávesy na posuvníku a mezerník (setMapTimeYear pozastaví) · strings.ts map.timeMode, timeModeShort, timeModeEmpty, timePlay, timePause, timeUndated, noFamilyPath, timeTipTitle, timeTipText, timeTipTry, timeTipLater · Migrace v čase od v2.4.0 (app 44a903bc) · 3.28.0: app 34e82d43, cce82a89 (app:81f2adf0) · CHANGELOG.cs.md 3.21.0, 3.28.0 · spec 054 P2 · stálá šířka Přehrát/Pozastavit: app 35ed67f9 src/ui/map-ui.ts (obě slova v jedné buňce, map-time-play-word), index.html .map-time-play-text -->

<a id="A6.5.4"></a>
### A6.5.4 Der Weg der Vorfahren zu einer Person

In der Migration im Zeitverlauf lässt sich eine Person wählen. Die Karte zeigt dann nur ihre direkten Vorfahren und
die Linien von jedem Vorfahren zu seinem Kind bis zur gewählten Person, und die Leiste endet bei ihr.

- **Grenzen:**
  - Vorfahren sind die Eltern, deren Eltern und so weiter, höchstens 30 Generationen. Die Eltern werden wie im Fächer
    genommen ([A6.4](#A6.4)). Ein Platzhalter als zweiter Elternteil einer Familie mit einem Elternteil ist kein
    Vorfahr: sein Zweig ist unbekannt;
  - ein Vorfahr, zu dem mehrere Wege führen (Ahnenschwund), ist auf der Karte ein Punkt, zählt aber in jedem Zweig,
    zu dem er gehört. Im selben Zweig werden seine Vorfahren nicht ein zweites Mal entfaltet;
  - ein Vorfahr steht am Geburtsort, ohne ihn am Taufort, ohne ihn am ersten datierten Wohnort; immer nur an einem
    Ort mit Lage. Sein Jahr ist das Geburtsjahr, ohne es das Jahr der Taufe, ohne es das Jahr dieses Ortes. Ein
    Vorfahr ohne Jahr oder ohne Ort mit Lage ist nicht auf der Leiste: die Legende zählt ihn, und **Liste ›** nennt
    ihn mit dem, was fehlt (**ohne Geburtsdatum**, **ohne Ort**, **ohne Datum und Ort**), und **Personenseite ›**
    ([A6.5.5](#A6.5.5));
  - die gewählte Person steht genauso. Sie ist das Ziel: Kreis „◎ Ziel: Name“, am Ende der Leiste ein voller Kreis
    „◎ Name · Jahr“ (beim Taufort „· Taufe Jahr“, beim Wohnort „· Wohnort Jahr“). Ein Ziel ohne Ort auf der Karte
    wird nicht gezeichnet, und am Ende der Leiste steht „… hat keinen Ort auf der Karte.“;
  - die Leiste reicht vom Jahr des ältesten Vorfahren auf der Karte bis zum späteren der Jahre des letzten Vorfahren
    und des Ziels;
  - der Weg nimmt die Vorfahren aus dem ganzen Stammbaum: statt des Umfangs steht ein Chip mit der Person, nach dem
    Aufheben des Weges kehrt der Umfang zurück. Die Arten der Orte gelten für den Weg nicht. Der Punkt einer Gemeinde
    sammelt auch ihre Häuser wie ohne Weg;
  - die Blase eines Ortes zeigt nur die Personen des Weges an diesem Ort, die Vorfahren bis zum gewählten Jahr und
    das Ziel, mit den Etiketten ihrer Stammlinien;
  - nach der Wahl der Person verschiebt und vergrößert sich die Karte einmal auf den ganzen Weg, danach bewegt sie
    sich nicht von selbst (Ausnahme am Ende des Abspielens, [A6.5.6](#A6.5.6));
  - es gibt höchstens 400 Linien wie ohne Weg. Sind es mehr, haben Vorrang: der Stamm (Eltern und Großeltern),
    Linien aus den letzten 10 Jahren, nähere Generationen, ein Ende im Kartenausschnitt, die längere Linie. Die
    Legende sagt es („N von M Linien gezeigt“, „Vorrang haben nähere Generationen und neu hinzugekommene Linien.“);
  - das Ausschalten von **Zeitverlauf** blendet den Weg nur aus. Nach dem Einschalten kehrt er zurück und läuft ab
    dem ersten Jahr. Aufgehoben wird er mit **×** am Chip;
  - ein neues Fenster mit der Karte ([A6.8](#A6.8)) übernimmt die Person des Weges, Viertel oder Achtel und die
    Farben der Stammlinien.
- **Wahl der Person:** **Weg zu einer Person** sucht im ganzen Stammbaum („Name, Nachname oder Jahr“), höchstens 30
  Personen. Ein leeres Feld zeigt die zentrale Person (**Zuletzt fokussiert**). Bei jeder Person steht, wie viele
  ihrer Vorfahren auf der Karte sind; eine Person ohne sie ist ausgegraut („Vorfahren noch ohne Orte auf der Karte“)
  und lässt sich nicht wählen. Auf dem Telefon und einem Touch-Gerät öffnet sich die Wahl als Blatt von unten. Wenn
  kein Vorfahr auf der Karte ist, sagt die Leiste „Noch kein Vorfahre hat einen Ort auf der Karte.“ und bietet
  **Andere Person wählen** an.
- **Bedienung:** App:
  - Karte → **◷ Zeitverlauf** → in der Leiste **◎ Weg zu einer Person…** → Person. Der Chip **◎ Weg zu:** Name
    öffnet die Wahl erneut (**Person ändern**), **×** hebt den Weg auf (**Weg aufheben**);
  - in der Blase eines Ortes Klick auf eine Person → **◎ Weg zu dieser Person** (neben **Personenseite ›**), auch
    ohne gewählte Person;
  - auf der Personenseite **◎ Weg der Vorfahren auf der Karte ›** ([A7.6](A7-book-pages-and-export.md#A7.6)): die
    Seite schließt sich, die Karte zeigt den Weg ab dem ersten Jahr, und die Meldung bietet **‹ Zurück zur
    Personenseite** an. Der Link steht im Abschnitt **Lebensorte**. Eine Person mit höchstens einem eigenen Ort hat
    diesen Abschnitt nicht; hat sie Vorfahren auf der Karte, steht der Link in einer eigenen Zeile dort, wo der
    Abschnitt wäre. Hat die Person Vorfahren, aber keiner ist auf der Karte, ist der Link ausgegraut („Noch kein
    Vorfahre hat einen Ort auf der Karte.“) und nur im Abschnitt **Lebensorte**. Ohne Vorfahren im Stammbaum gibt es
    den Link nicht.
- **Gilt seit:** App 3.28.0

<!-- zdroj: app:src/map-lines.ts buildPathModel (maxGen 30, fatherMother přes parentSlots jako vějíř, isPlaceholder není předek, implex záznam na cestu, expanded podle osoby a větve), placeOf (narození → křest → první datované bydliště, jen s polohou; rok narození → křest → místa), missing (date/place/both), yearFrom/yearTo, links, pathSegments (PATH_LINE_CAP 400, pořadí kmen, fresh < 10 let, generace, výřez, délka) · src/ui/map-path-ui.ts (mapEffectiveScope celý strom, čip místo rozsahu, clearMapPath vrátí rozsah, jednorázový výřez framed, cíl čárkovaný → plný, pathTargetNoPlace, pathNoAncestors + pathOtherPerson) · src/person-picker.ts PathPersonPicker (limit 30, recentId = ústřední osoba, onMapCount 0 = aria-disabled, celý strom) · src/ui/map-lines-legend-ui.ts mapPathBubbleParts · src/ui/map-ui.ts showMapPathPlace, toggleMapTime (vypnutí skryje, zapnutí od začátku) · src/ui/person-page-ui.ts personPageMapPath (on/off/null), openPersonPageMapPath (toast map-path-back) · src/person-page-map.ts (pp-map-path, aria-disabled, jen v okně aplikace; mapPathRowHtml vlastní řádek bez oddílu Místa života jen pro mapPath on, app caea192a) · src/person-page.ts mapPathRow · src/windows/view-window-state.ts MapTimeState path, mode, colors · strings.ts map.pathPick, pathPickTitle, pathPickPlaceholder, pathPickRecent, pathPickOnMap, pathPickNone, pathChip, pathChange, pathClear, pathFromPage, pathThisPerson, pathBackToPage, pathGoal, pathGoalEnd, pathTargetNoPlace, pathNoAncestors, pathOtherPerson, linesCut, linesCutWhy, missingDate, missingPlace, missingBoth · app 388e5a87, b01693bc, 5853882e, 34e82d43 (app:81f2adf0) · dirigent:prace/1113-app-mapa-rody-v-case · ZADANI_UIX_mapa-rody-v-case D3, D4 (ponechat) · spec 054 K2.1, P2 · CHANGELOG.cs.md 3.28.0 -->

<a id="A6.5.5"></a>
### A6.5.5 Linienfarben und die Legende Stammlinien

Der Weg der Vorfahren ist nach Stammlinien gefärbt. Eine Stammlinie ist hier der Zweig eines Großelternteils
(Viertel) oder eines Urgroßelternteils (Achtel) der gewählten Person, benannt nach seinem Geburtsnamen. Es ist nicht
die Stammlinie nach dem Nachnamen ([A4](A4-surnames-and-families.md)).

- **Grenzen:**
  - die Viertel sind Vater des Vaters, Mutter des Vaters, Vater der Mutter und Mutter der Mutter, in denselben Tönen
    wie die Farben **Linien** im Fächer ([A6.4](#A6.4)). Jedes Viertel hat auch ein eigenes Linienmuster (das erste
    durchgezogen), sodass sich die Stammlinien auch bei schwächerem Farbsehen unterscheiden. Die zwei Viertel
    derselben Seite (Blau und Blaugrün des Vaters, Rosa und Himbeerrot der Mutter) unterscheiden sich in Helligkeit
    und Muster. Helles und dunkles Erscheinungsbild haben eigene Töne;
  - ein Achtel hat die Farbe seines Viertels, das zweite Achtel desselben Viertels einen dunkleren Ton. Die Nummer
    des Achtels (1–8) steht auf der längsten sichtbaren Linie jedes Achtels;
  - die Linien von Eltern und Großeltern sind der Stamm: in der Textfarbe und breiter. Die Punkte der Eltern haben
    die Farbe des Stamms, die Punkte der Großeltern die Farbe ihres Viertels. Ein Punkt, an dem sich mehrere
    Stammlinien treffen, hat die Farben aller;
  - eine Linie aus den letzten 10 Jahren ist breiter. Ältere Linien verblassen, höchstens auf 55 %, damit am Ende der
    ganze Weg zu sehen ist;
  - der Nachname der Stammlinie ist der Geburtsname des Großelternteils oder Urgroßelternteils; ohne Nachnamen sein
    Vorname.
- **Legende Stammlinien** (rechts unter den Steuerelementen der Karte, wenn mindestens ein Vorfahr auf der Karte
  ist):
  - **Viertel** · **Achtel**. **Achtel** lassen sich wählen, wenn der Stammbaum mindestens zwei Achtel kennt;
  - Zeile einer Stammlinie: Linienmuster, Nachname, Beziehung und Zahl der Vorfahren auf der Karte („Vater des
    Vaters · 12 Vorfahren“). Bei den Achteln stehen die Zeilen unter der Überschrift ihres Viertels („1 ·
    Nachname“). Ein unbekannter Großelternteil hat eine Zeile ohne Farbe („Mutter des Vaters – unbekannt“). Eine
    Stammlinie, von der kein Vorfahre auf der Zeitleiste ist (alle ohne Datum oder Ort), hat eine gedämpfte Zeile wie
    eine unbekannte, mit leerem gestricheltem Muster und „außerhalb der Zeitleiste“ statt der Zahl („Mutter des
    Vaters · außerhalb der Zeitleiste“); hervorheben oder anheften lässt sie sich nicht. Die letzte Zeile ist
    **Stamm: Eltern und Großeltern**;
  - das Überfahren einer Zeile hebt die Stammlinie kurz hervor, ein Klick heftet sie an und dämpft die übrigen
    Stammlinien. Esc oder ein zweiter Klick hebt das Anheften auf, ebenso das Umschalten von Vierteln und Achteln;
  - unter den Zeilen stehen: die erste Person in zwei Zweigen („↻ Name (Jahr) gehört zu zwei Linien: … und ….“),
    die Kürzung eines großen Stammbaums ([A6.5.4](#A6.5.4)), Vorfahren außerhalb der Leiste („N Vorfahren ohne Datum
    oder Ort sind nicht auf der Zeitleiste.“ und **Liste ›**, die Liste **Vorfahren außerhalb der Zeitleiste**) und
    **Ohne Linienfarben**;
  - **Ohne Linienfarben** zeichnet den ganzen Weg in einer Farbe und blendet die Zeilen der Stammlinien aus. Der
    Stamm bleibt breiter, und die Person bleibt gewählt;
  - **▴** (**Einklappen**) klappt die Legende zu einem Chip „Stammlinien (N)“ mit den Farben der Stammlinien
    zusammen. Die Karte verschiebt sich dadurch nicht.
- **Telefon:** die Legende öffnet sich als Blatt von unten aus dem Chip **Stammlinien (N)** über der Leiste,
  **Liste ›** ebenso. Offen ist immer nur ein Blatt (Legende, Liste, Blase oder Wahl der Person). Ein Telefon im
  Querformat hat den Chip in der oberen Reihe.
- **Bedienung:** App: Karte → **◷ Zeitverlauf** → Weg zu einer Person ([A6.5.4](#A6.5.4)) → Legende
  **Stammlinien**.
- **Gilt seit:** App 3.28.0
- **Ab App 3.30.0:** die Viertel in den Tönen der **Linienmarkierung** ([A6.1.5](#A6.1.5)): die Seite des Vaters
  blau und blaugrün, die der Mutter rosa und himbeerrot. Bis 3.29.0 andere Töne.

<!-- zdroj: app:src/map-line-colors.ts (LINE_HUE z fan-colors.ts jako vějíř Linie, tabulka OKLCH světlý/tmavý, QUARTER_DASH, lineCap, LINE_WIDTH base 3 / fresh 4 / trunk 4.5, pathLineOpacity max(0.55, 1 − věk/60·0.45), LINE_FOCUS_DIM, pointFill, lineSwatch; hlavička: dvojice 50↔95 a 215↔320 se liší světlostí i vzorem; app:cecd72a4 LINE_HUE 258/232/352/5, tabulka OKLCH q0–q3, e1–e7 (dvojice téže strany se liší světlostí)) · src/map-lines.ts lineClassOf (gen ≤ 2 kmen), pointClassOf (rodiče kmen), branchSurname (rodné příjmení, jinak křestní), quarters/eighths · src/ui/map-path-ui.ts drawMapPathLayer (čísla osmin na nejdelší viditelné čáře, LEGEND_WIDTH) · src/ui/map-lines-legend-ui.ts mapLinesLegendHtml (eighthsOff < 2 známé osminy, řádky, neznámý, kmen, pata), mapLinesImplexText, toggleMapLineFocus, setMapLineHover, setMapLineMode (připnutí pryč), setMapLineColors, setMapLegendCollapsed, openMapLinesSheet / closeMapLinesSheets, mapLinesUndatedHtml, offTimeline (count 0: is-unknown, is-off-timeline, swatch is-empty, app caea192a) · strings.ts map.linesOffTimeline, map.linesTitle, linesChip, linesQuarters, linesEighths, linesCollapse, linesRow, linesUnknown, linesTrunk, linesOff, linesImplex, pathUndated, pathUndatedList, pathUndatedTitle, lineE8–lineE15; fan.lineFatherFather… · app 388e5a87, b01693bc, 5853882e, 8e27df4a, 34e82d43 (app:81f2adf0) · spec 054 K1.1, K1.2 · CHANGELOG.cs.md 3.28.0 -->

<a id="A6.5.6"></a>
### A6.5.6 Den Weg zu einer Person abspielen

Mit gewählter Person geht **Abspielen** die ganze Leiste in 24 Sekunden durch, vom ältesten Vorfahren bis zur
gewählten Person.

- **Grenzen:**
  - Jahr für Jahr, keines wird übersprungen. Ein Jahr, in dem ein Vorfahr oder das Ziel hinzukam, dauert fünfmal so
    lange wie ein Jahr ohne sie;
  - das Abspielen endet beim Ziel. Ein weiteres **Abspielen** beginnt von vorn;
  - angehalten wird es durch **Pause**, den Schieberegler, die Tasten ([A6.5.3](#A6.5.3)) und eine Marke über dem
    Schieberegler;
  - Marken über dem Schieberegler: jedes bekannte Viertel im Jahr seines ältesten Vorfahren auf der Karte, in der
    Farbe der Stammlinie („Nachname: ältester Vorfahr Jahr“), und das Ziel am Ende. Ein Klick auf eine Marke springt
    zu ihrem Jahr;
  - die Zeile unter dem Schieberegler sagt, was zuletzt hinzukam: „Jahr · Name · Ort des Elternteils → Ort“ mit einem
    Farbfeld der Stammlinie, das Ziel fett. Kamen in einem Jahr mehrere Personen hinzu, zeigt sie das Ziel, sonst die
    Person aus der nächsten Generation. Ein Bildschirmleser liest die Zeile bei einer Änderung vor. Ohne gewählte
    Person gibt es die Zeile nicht, und der Satz über Orte ohne Datum bleibt in der Statusleiste;
  - die Karte bewegt sich beim Abspielen nicht. Nur wenn sie seit der Wahl der Person niemand verschoben oder
    vergrößert hat und das Ziel am Ende außer Sicht ist, verschiebt sie sich einmal zu ihm;
  - auf dem Telefon ist **▶** ohne Text und die Leiste in einer Reihe.
- **Bedienung:** App: Karte → **◷ Zeitverlauf** → Weg zu einer Person ([A6.5.4](#A6.5.4)) → **Abspielen**.
- **Gilt seit:** App 3.28.0

<!-- zdroj: app:src/map-lines.ts pathPlaySchedule (PATH_PLAY_MS 24000, PATH_EVENT_WEIGHT 5, krok rok, součet 24 000), pathAddedIn (nejbližší generace, pak rel, cíl poslední), pathLastAdded · src/ui/map-path-ui.ts playMapPath (konec u cíle), panMapToPathEnd (framed, jednou), renderMapTimeMarks (čtvrtiny podle firstYear, cíl), renderMapTimeCaption (cíl, jinak items[0]; aria-live, aria-valuetext; bez cesty skryto) · src/ui/map-ui.ts toggleMapTimePlay (na konci od začátku), setMapTimeYear (pozastaví), značky → setMapTimeYear · strings.ts map.timeMarkTitle, pathGoalEnd · app cce82a89, 34e82d43 (app:81f2adf0) · ZADANI_UIX_mapa-rody-v-case D5 (ponechat) · spec 054 K2.2 · CHANGELOG.cs.md 3.28.0 -->

<a id="A6.5.7"></a>
### A6.5.7 Die Karte mit dem Bereich Auswahl

Mit dem Bereich **Auswahl** arbeitet die Karte nur mit den Personen der Auswahl des Fensters ([A6.6](#A6.6)).

- **Was aus der Auswahl berechnet wird:** die Punkte der Orte, die Anzahlen in der Leiste, die Orte zum Suchen in der
  Forschung ([A6.5.2](#A6.5.2)), **Migration im Zeitverlauf** samt dem Bereich der Jahre ([A6.5.3](#A6.5.3)) und der
  Weg der Vorfahren ([A6.5.4](#A6.5.4)).
- **Teil Auswahl** im Umschalter des Bereichs trägt den Namen der Auswahl und die Zahl der Personen („Stammlinie Horák
  · 14“); ein Fenster ohne Auswahl hat nur **Auswahl ▾**. Ein Klick auf einen Teil, der nicht gewählt ist, schaltet den
  Bereich sofort um. Ein Klick auf den gewählten Teil oder auf den Teil ohne Auswahl öffnet das Menü der Auswahl
  ([A6.6](#A6.6)). Eine auf der Karte gewählte Auswahl ist die Auswahl des Fensters: Familie hebt sie dann hervor.
- **Ort mit Personen außerhalb der Auswahl:** die Blase des Ortes zeigt nur die Personen der Auswahl und darunter „und
  {n} Personen außerhalb der Auswahl ·“ mit **Ganzer Stammbaum** (schaltet den Bereich um). Eine Heirat, von der nur
  ein Partner in der Auswahl ist, wird auf der Karte gezeigt; in der Blase steht nur dieser Partner.
- **Suche einer Person auf der Karte:** eine Person außerhalb der Auswahl hat im Ergebnis das Etikett „außerhalb der
  Auswahl“ und den Link **Im ganzen Stammbaum zeigen** (schaltet den Bereich auf **Ganzer Stammbaum** um).
- **Weg zu einer Person:** die Wahl der Person des Weges bietet nur Personen der Auswahl an. Ist das Ziel des Weges
  außerhalb der Auswahl, ist der Chip des Weges gedämpft mit „· außerhalb der Auswahl“, der Weg wird nicht gezeichnet,
  und die Leiste sagt „Die Person des Weges ist außerhalb der Auswahl – der Weg wird nicht gezeigt.“
- **Leere Auswahl:** in der Mitte der Karte „Die Auswahl ist leer.“; eine Auswahl, in der niemand einen Ort hat: „Noch
  niemand aus der Auswahl hat einen Ort.“ mit einem Link auf die Personen ohne Ort ([A6.5.8](#A6.5.8)). Die
  Statusleiste wird dann nicht gezeigt.
- **Aufheben oder Wegfall der Auswahl** setzt den Bereich auf **Diese Ansicht** zurück. Der für den Stammbaum
  gespeicherte Bereich **Auswahl** gilt nur, wenn das Fenster nach dem Öffnen des Stammbaums eine Auswahl hat.
- **Fenster Orte**, von der Karte geöffnet, hat denselben Umschalter des Bereichs (Teil **Auswahl** nur, wenn das
  Fenster eine Auswahl hat) und ändert den Bereich der Karte und die Liste der Orte. Von anderswo geöffnet zeigt es
  die Orte des ganzen Stammbaums.
- **Telefon:** statt des Umschalters steht die Schaltfläche **Bereich: {Name} ▾** neben den Arten der Ereignisse. Sie
  öffnet das Blatt **Bereich**: Abschnitt **Kartenbereich** (drei Bereiche mit der Zahl der Personen), **Auswahl
  ändern** (höchstens 5 Auswahlen: Stammlinien, Vorfahren der zentralen Person, Listen) und **Alle Auswahlen…** (das
  ganze Menü der Auswahl). Ein Telefon im Querformat hat den Umschalter wie der Computer.
- **Bedienung:** App: Karte → Umschalter des Bereichs **Diese Ansicht** · **Auswahl** · **Ganzer Stammbaum**
  (Telefon **Bereich: … ▾**); **Auf der Karte** bei einer Personenliste ([A11.3](A11-lists-of-people.md#A11.3)) und
  im **⋯** der Tabelle ([A6.7.19](#A6.7.19)).
- **Gilt seit:** App 3.31.0

<!-- zdroj: app:src/map-scope.ts mapScopePersonIds · src/ui/map-ui.ts mapScopePersons (body, počty, mapMissingPlaces, mapTimeHarvest, map-lines) · src/ui/map-scope-ui.ts (díl Výběr: nezvolený → rozsah hned, zvolený nebo bez výběru → nabídka; vyprázdnění selEmpty / selNoPlaces; mimo výběr popupOutside, popupWhole, outside, showInTree; zrušený / zaniklý výběr → 'view'; zapamatovaný 'sel' jen s výběrem; list Rozsah s selectionQuickRows(5)) · src/ui/selection-picker-ui.ts selectionQuickRows (2 rody, předci, seznamy, další rody) · src/places.ts collectPlaces (fact.persons.filter(kept): sňatek jen s osobou výběru) · src/ui/map-path-ui.ts (osoby cesty z výběru, pathOutside) · src/ui/places-manager-ui.ts (rozsah okna Místa jen z mapy) · strings.ts map.scopeSel, scopeSelNamed, scopeAria, scopeGroup, scopeBtn, scopeSheet, scopeSheetSec, scopeViewHint, scopeChange, scopeAll, selEmpty, selNoPlaces, selUnplacedLink, outside, showInTree, popupOutside, popupWhole, popupSelCount, pathOutside · app:90c09692, 95752f6d, 74d3a34e · ZADANI_DEV_vyber-osob §3, §4, §10 · spec 098 (spec 120 K1.1–K1.3) · dirigent:test/vysledek-1121-app-098-vyber-p1.md -->

<a id="A6.5.8"></a>
### A6.5.8 Personen der Auswahl ohne Ort

Im Bereich **Auswahl** hat die Statusleiste der Karte eine zweite Zeile „{n} Personen der Auswahl haben keinen Ort ›“,
wenn mindestens eine Person der Auswahl in keiner Art der Karte einen Ort hat (Geburt, Tod, Heirat oder Scheidung,
weitere Ereignisse der Person und des Paares). Ein Ort ohne Koordinaten zählt als Ort.

- Ein Klick öffnet die **Tabelle** mit den Personen der Auswahl und dem eingeschalteten Chip **Ohne Ort**
  ([A6.7.6](#A6.7.6)): bei einer Liste im Umfang dieser Liste, bei einer anderen Auswahl im Umfang „Auswahl: {Name}“
  ([A6.7.19](#A6.7.19)). Der Chip lässt sich wie andere Filter ausschalten.
- **Grenzen:** die Zeile erscheint nicht, wenn alle einen Ort haben, während die Koordinaten nachgeschlagen werden und
  bei einem Fehler oder ohne Internet.
- **Bedienung:** App: Karte → Statusleiste → „… haben keinen Ort ›“; bei leerer Karte der Link „{n} Personen ohne
  Ort ›“.
- **Gilt seit:** App 3.31.0

<!-- zdroj: app:src/places.ts personHasMapPlace (narození, úmrtí, události osoby, svazek start/end/události; místo bez souřadnic se počítá) · src/ui/map-ui.ts renderMapStatus (map-status-unplaced, ne při geocodingu, chybě, offline) · src/ui/map-scope-ui.ts (Tabulka v rozsahu výběru s filter noPlace) · src/ui/table-view/table-ui.ts openTableForSelection · src/ui/table-view/table-filter.ts CHIP_ORDER noPlace · strings.ts map.selUnplaced, selUnplacedLink, table.chip.noPlace, chipNoPlaceTitle · app:2a578474, 39020cf1 · ZADANI_DEV_vyber-osob §5 · spec 120 K1.4 -->

<a id="A6.6"></a>
## A6.6 Personenauswahl

Die Auswahl ist eine benannte Gruppe von Personen, die ein Fenster hat. Sie gilt in allen Ansichten des Fensters:
Familie, Nachkommen und Fächer heben sie hervor, die Karte kann sie allein zeigen ([A6.5.7](#A6.5.7)), und die
Tabelle kann sie als Umfang haben ([A6.7.19](#A6.7.19)). In die Daten des Stammbaums wird die Auswahl nicht
gespeichert; die Personenlisten ([A11](A11-lists-of-people.md)) bleiben, wie sie sind.

| Auswahl | Wen sie enthält | Name im Etikett und im Menü |
|---|---|---|
| Stammlinie | die tatsächlichen Mitglieder der Stammlinie ([A4](A4-surnames-and-families.md)) | Stammlinie {Stammlinie} |
| Vorfahren einer Person | die Vorfahren der Person wie die Regel **Vorfahren einer Person** ([A11.2](A11-lists-of-people.md#A11.2)): alle Generationen oder 1 bis 10 | Vorfahren: {Person} |
| Nachkommen einer Person | die Nachkommen der Person wie die Regel **Nachkommen einer Person**, alle Generationen oder 1 bis 10 | Nachkommen: {Person} |
| Forschungslinie | die Personen der Forschungslinie wie die Regel **Forschungslinie** | Linie: {Linie} |
| Personenliste | die Personen der Liste | Liste: {Liste} |

- Ein Fenster hat höchstens eine Auswahl. Die Personen der Auswahl werden nach jeder Änderung des Stammbaums neu
  berechnet (automatische Liste und die Regeln für Vorfahren, Nachkommen und Linie). Platzhalterpersonen und Personen,
  die nicht mehr im Stammbaum sind, gehören nicht zur Auswahl.
- **Hervorhebung** in Familie, Nachkommen und Fächer: die Personen der Auswahl voll, die übrigen gedämpft. Bei einer
  Stammlinie werden Ehefrauen und Ehemänner, die durch Heirat in die Stammlinie kamen, schwächer gezeigt; zur Auswahl
  gehören sie nicht.
- **Etikett der Auswahl** über dem Stammbaum: „{Name} · {n} Personen ▾“ (öffnet das Menü der Auswahl,
  [A6.6.1](#A6.6.1)), **Andere ausblenden** ([A6.6.2](#A6.6.2)), **Nächste Person ›** (fokussiert die nächste Person
  der Auswahl) und × **Auswahl aufheben** (auch Esc). Eine leere Auswahl hat ein Etikett mit der Zahl 0, und **Nächste
  Person ›** lässt sich nicht verwenden. Auf der Zeitleiste und auf der Karte wird das Etikett nicht gezeigt.
- **Eine andere Hervorhebung** (Belege, Prüfung, Live-Änderungen) überdeckt die Auswahl vorübergehend, und das Etikett
  gehört ihr. Nach ihrem Ende kehrt die Auswahl zurück; **Andere ausblenden** gilt während der Überdeckung nicht. Die
  Wahl einer Auswahl beendet eine andere Hervorhebung.
- **Aus der Auswahl ist nichts gezeichnet** (nach der Wahl einer Auswahl, nicht nach dem Wiederherstellen aus dem
  Speicher):
  - Familie und Fächer verschieben die zentrale Person auf die Person der Auswahl mit den wenigsten Schritten zu ihr
    (über Eltern, Kinder und Partner; bei Gleichstand auf die früher geborene). Ist die Auswahl mit ihr nicht
    verbunden, geht die zentrale Person auf den Stammvater der Stammlinie oder auf die Person, deren Vorfahren oder
    Nachkommen es sind; bei Linie und Liste auf die am frühesten geborene Person der Auswahl;
  - Nachkommen verschiebt die zentrale Person immer auf den Stammvater der Stammlinie, die Person der Vorfahren oder
    Nachkommen, sonst auf die am frühesten geborene;
  - die Meldung „Fokus: {Person}, Auswahl {Name}“ hat **↩ Zurück**.
  - Auf der Zeitleiste, auf der Karte und in der Tabelle wird die zentrale Person nicht verschoben.
- **Bedienung:** App: **Auswahl ▾** in der Leiste von Familie, Nachkommen und Fächer; im Menü der Person **Auswählen
  ›**; Etikett der Auswahl; auf dem Telefon **Mehr → Auswahl** ([A6.6.1](#A6.6.1)).
- **Gilt seit:** App 3.21.0 (nur Stammlinie: **Stammlinien** in der Leiste, im Menü der Person **Nur Stammlinie …**);
  3.31.0: Personenauswahl (Stammlinie, Vorfahren, Nachkommen, Forschungslinie, Liste), Menü **Auswahl ▾**, **Andere
  ausblenden**

<!-- zdroj: app:src/view-selection.ts (SelectionRef rod / ancestors / descendants / line / list; selectionPersonIds: realRodMembers, rulePersonIds, listPersonIds; cache na lineage index = změnu dat; selectionLabel předpony) · src/ui/view-selection-ui.ts (jeden výběr okna, selectionGroup: rod faint realRodSpouses, zakrytí jinou skupinou a návrat selectionUncovered, setSelection ukončí jinou skupinu, ne přesun při 'restore') · src/ui/evidence-ui.ts (kind 'selection': štítek ▾ otevře nabídku, Skrýt ostatní, Další osoba, × a Esc = clearSelection; prázdný výběr 0 a Další nedostupné) · src/ui/rod-view.ts moveFocusToSelection (ne timeline, map, table) · src/rod-focus.ts selectionFocusTarget (nejméně kroků, shoda dříve narozený; root = zakladatel / osoba předků a potomků; jinak nejdříve narozený; Potomci vždy root) · strings.ts selection.pill, hideOthers, clear, moved, prefix · app:51ad8fd6, cb97070c, 61873988, 39e84ca0, e5da4a61 · ZADANI_DEV_vyber-osob §0, §1, §8, §9, §12 · spec 098 Rozhodnutí 1–5 (Milan 21. 11. „jak doporucujes“) · dřív: src/ui/rod-view.ts, spec 039, CHANGELOG.cs.md 3.21.0 -->

<a id="A6.6.1"></a>
### A6.6.1 Das Menü Auswahl ▾

Ein Menü wählt die Auswahl des Fensters überall: in der Leiste des Stammbaums, im Etikett der Auswahl, im Teil
**Auswahl** des Umschalters des Kartenbereichs und auf dem Telefon im Blatt **Mehr**.

- **Inhalt** von oben nach unten:
  1. Feld **Stammlinie, Person, Liste suchen…**;
  2. bei einer Auswahl von Vorfahren oder Nachkommen der Block **Auswahl des Fensters**: Name und Zahl, „Person:
     {Person}“ mit **Ändern…** und **Generationen** (− und +: alle oder 1 bis 10);
  3. **Keine Auswahl** (ganzer Stammbaum, Zahl der Personen des Stammbaums);
  4. Abschnitt **Stammlinien** wie die frühere Liste **Stammlinien** ([A4.4](A4-surnames-and-families.md#A4.4)):
     Stammlinien mit dem Balken des Zeitraums und der Zahl und **Weitere Familien**; nur wenn der Stammbaum eine
     Stammlinie hat, die nicht klein ist;
  5. Abschnitt **Vorfahren und Nachkommen**: „Vorfahren: {zentrale Person}“ und „Nachkommen: {zentrale Person}“ mit
     Zahlen, im Kopf **Andere Person…**;
  6. Abschnitt **Forschungslinien**, nur in einem Stammbaum mit Linien;
  7. Abschnitt **Personenlisten**: Listen nach Namen mit dem Symbol der Art, der Art (bei einer automatischen mit der
     Regel, bei einer Arbeitsliste „a von b offen“) und der Zahl; ohne Listen „Der Stammbaum hat noch keine Listen.“;
  8. **Auswahl als Liste speichern…** (eine Auswahl, die keine Liste ist; nicht in einem schreibgeschützten
     Stammbaum) öffnet eine neue Liste mit der Regel der Auswahl ([A11.6](A11-lists-of-people.md#A11.6));
     **Personenlisten…** öffnet die Verwaltung der Listen.
- **Suche** geht durch Stammlinien (auch Namensformen), Linien, Listen und Personen, ohne Rücksicht auf diakritische
  Zeichen. Gefundene Personen (höchstens 5, mit Jahren und Ort) stehen im Abschnitt **Personen** mit den Zeilen
  „Vorfahren: …“ und „Nachkommen: …“.
- **Menü der Person:** **Auswählen ›** bietet die Stammlinien der Person an (die Herkunftslinie zuerst, dann
  Stammlinien, in die sie eingeheiratet hat, mit mindestens zwei tatsächlichen Mitgliedern), **Vorfahren** und
  **Nachkommen** mit Zahlen (ohne sie, wenn die Person keine Vorfahren oder Nachkommen hat). Gehört die Person zur
  Auswahl des Fensters, steht darunter **Auswahl aufheben**.
- **Telefon:** die Leiste des Stammbaums hat die Schaltfläche nicht; in Familie, Nachkommen und Fächer steht im Blatt
  **Mehr** die Zeile **Auswahl** mit dem Namen der Auswahl (ohne Auswahl **Keine Auswahl**), auf der Zeitleiste, der
  Karte und in der Tabelle nicht. Das Menü ist ein Blatt mit dem Suchfeld oben. Ein Telefon im Querformat hat die
  Zeile **Auswahl** am Ende der Zeile **Ansicht**. Das Tablet hat **Auswahl ▾** rechts in der oberen Leiste.
- **Bedienung:** App: **Auswahl ▾** in der Leiste von Familie, Nachkommen und Fächer; Name ▾ im Etikett der Auswahl;
  Menü der Person **Auswählen ›**; Telefon **Mehr → Auswahl**.
- **Gilt seit:** App 3.31.0

<!-- zdroj: app:src/ui/selection-picker-ui.ts (lišta Rodiny, Potomků, Vějíře, ne timeline/map/table; tablet vpravo; každý strom s osobami; MAX_GENERATIONS 10 pak všechny; FOUND_LIMIT 5; rody jen když rodPickerOffered – ne jen malé rody; pole hledání vždy (rod-picker.ts:382); canSave ref ≠ list && !listsReadOnly; saveListOptions; Seznamy osob…) · src/rod-picker.ts selectionPickerHtml (pořadí oddílů, patička) · src/ui/rod-picker-ui.ts wireRodPicker (hledání přes oddíly, bez diakritiky) · src/ui/context-menu.ts (Vybrat ›: rodný rod první, rody sňatkem s ≥ 2 skutečnými členy, Předky / Potomky s počty, Zrušit výběr když osoba patří do výběru) · src/ui/bottom-sheet.ts (řádek Výběr v Rodině, Potomcích, Vějíři; na šířku valueInPair na konci řádku Pohled) · strings.ts selection.* · app:61873988, 07fd4946, a273ef05, 1eb97c1f, 8cfb01da · ZADANI_DEV_vyber-osob §2, §10 -->

<a id="A6.6.2"></a>
### A6.6.2 Andere ausblenden

**Andere ausblenden** im Etikett der Auswahl lässt in Familie und Nachkommen nur die Personen der Auswahl: die übrigen
Karten verschwinden, und der Stammbaum wird nur aus ihnen neu angeordnet, in den Grenzen der zentralen Person und der
Tiefe **Vorfahren** und **Nachkommen** ([A6.1](#A6.1)). Die Auswahl **Vorfahren: {Person}** zeigt so die reine Ahnentafel
der Person.

- Die zentrale Person wird immer gezeichnet ([A6.6.3](#A6.6.3)). Die Ansicht zeichnet nie mehr Karten als ohne Filter.
- Bei einer Stammlinie bleiben Ehefrauen und Ehemänner, die durch Heirat in die Stammlinie kamen, bei ihrem Mitglied.
- Linien gibt es nur zwischen Personen, die beide gezeichnet sind. Eine Familie, von der nur ein Elternteil gezeichnet
  ist, hängt unter ihm. Personen der Auswahl ohne Verbindung zu den übrigen stehen in der Reihe ihrer Generation als
  eigene Gruppen, in der Reihenfolge, die sie in der vollen Ansicht hätten.
- Die Reiter verborgener Verwandter an den Karten und **Kinder und Geschwister** ([A6.1.3](#A6.1.3)) zählen nur
  Personen der Auswahl.
- Die Karte, die der Mitte des Bildschirms am nächsten ist, bleibt nach dem Neuanordnen an ihrem Platz (sonst die
  zentrale Person); der Zoom ändert sich nicht.
- Die Option wird mit der Auswahl gespeichert ([A6.6.4](#A6.6.4)) und mit dem Aufheben der Auswahl ausgeschaltet.
- Der **Fächer** bietet die Option nur bei der Auswahl **Vorfahren: {Person}**. Die Sektoren der übrigen Personen
  bleiben an ihrem Platz als leere gestrichelte Umrisse (ohne Namen, Jahre, Füllung und **+**) und lassen sich weder
  öffnen noch mit der Tastatur erreichen; die Sektoren der Auswahl und die Mitte bleiben, wo sie waren.
- **Grenzen:** bei jeder anderen Auswahl hat der Fächer die Option nicht (die Auswahl wird nur hervorgehoben);
  **Andere ausblenden**, in Familie eingeschaltet, ändert dort nichts und bleibt eingeschaltet. Ausgaben (Bild,
  Druck, Export) zeichnen die ganze Ansicht.
- **Bedienung:** App: Etikett der Auswahl → **Andere ausblenden** (Kontrollkästchen); auf dem Telefon steht das
  Etikett in einer Zeile, und **Andere ausblenden** ist nur ein Kontrollkästchen ohne Text.
- **Gilt seit:** App 3.31.0

<!-- zdroj: app:src/layout/pipeline/person-filter.ts (filtr při sběru osob: jen osoby celého pohledu a jejich generace a pořadí, ústřední vždy; restrictSelection: čáry jen mezi nakreslenými, rodina s jedním rodičem pod ním; nespojené osoby ve vlastních skupinách vedle sebe v pořadí celého pohledu) · src/layout/pipeline/index.ts drawnOrder · src/renderer.ts setPersonFilter (Rodina a Potomci; záložky a bulk-family jen osoby výběru tabInView; karta nejblíž středu zůstane, jinak ústřední; přiblížení beze změny; výstupy kreslí celý pohled) · src/ui/evidence-ui.ts (rod: faint partneři do filtru; ve vějíři jen předci: setPersonFilter fan = ref.kind ancestors, syncEvidencePillHide evidence-pill--no-hide) · src/fan-chart.ts buildFanSvg keepOnly (offSector: prázdný čárkovaný obrys, bez +, pointer-events none, aria-hidden; střed vždy) · src/ui/fan-view.ts svgExtras keepOnly (jen obrazovka; výstup fan-chart.ts:1249 bez keepOnly), klávesnice přeskočí · app:493f330c · src/ui/view-selection-ui.ts setHideOthers (pamatuje s výběrem, bez výběru vypnuto) · strings.ts selection.hideOthers, hideOthersTitle · app:39e84ca0, e5da4a61 · ZADANI_DEV_vyber-osob §8 · dirigent:prace/1121-app-098-vyber-p1 (telefon: štítek v jednom řádku, Skrýt ostatní čtvereček 44 px), test/vysledek-1121-app-098-vyber-p1.md -->

<a id="A6.6.3"></a>
### A6.6.3 Die zentrale Person außerhalb der Auswahl

Eine zentrale Person, die nicht zur Auswahl gehört, bleibt in Familie und Nachkommen voll sichtbar, auch mit **Andere
ausblenden**. Am oberen Rand der Karte hat sie das Etikett „außerhalb der Auswahl“; ein Bildschirmleser liest „{Name} –
außerhalb der Auswahl“.

- Im Fächer ist die Mitte nicht gedämpft; ein Etikett hat sie nicht.
- Das Folgen des Agenten der Forschung ([S4.1.7](S4-research-from-the-app.md#S4.1.7)) ändert nur die zentrale Person,
  die Auswahl bleibt und hält die Sprünge zum Agenten nicht auf. Ein Sprung auf eine Person außerhalb der Auswahl
  erscheint mit dem Etikett „außerhalb der Auswahl“.
- **Bedienung:** Klick auf die Karte einer Person außerhalb der Auswahl.
- **Gilt seit:** App 3.31.0

<!-- zdroj: app:src/renderer.ts setEvidenceHighlight (ústřední osoba nikdy dim; mimo výběr card-tag „mimo výběr“, aria; ve vějíři jen střed bez dim) · src/layout/pipeline/person-filter.ts (ústřední vždy) · src/ui/live-follow-ui.ts (skok agenta mění zaměření, výběr nechá a skoky nezdržuje) · strings.ts selection.outside, outsideAria · app:39e84ca0, e5da4a61 · ZADANI_DEV_vyber-osob §7 (sledování), §9 -->

<a id="A6.6.4"></a>
### A6.6.4 Die Auswahl in Fenstern und im Speicher

Die Auswahl gehört dem Fenster und gilt darin über alle Ansichten. Für den Stammbaum wird die Auswahl des
Hauptfensters gespeichert.

| Was | Hauptfenster | Weiteres Fenster ([A6.8](#A6.8)) |
|---|---|---|
| Auswahl und **Andere ausblenden** | wird für jeden Stammbaum auf dem Gerät gespeichert; nach dem Öffnen des Stammbaums kehrt sie zurück, und die zentrale Person bewegt sich nicht | übernimmt beim Öffnen die Auswahl des Fensters, aus dem es entstand; danach hat es eine eigene und hält sie bis zum Schließen (auch nach F5) |
| Kartenbereich ([A6.5](#A6.5)) | wird für jeden Stammbaum gespeichert | übernimmt ihn beim Öffnen, danach einen eigenen |

- Eine Änderung der Auswahl in einem Fenster ändert die anderen Fenster nicht. Ausnahme ist **Auf der Karte** aus der
  Tabelle eines weiteren Fensters: das führt das Hauptfenster aus ([A6.7.19](#A6.7.19)).
- **Weggefallene Auswahl** (gelöschte Liste, weggefallene Stammlinie, entfernte Forschungslinie, gelöschte Person der
  Vorfahren oder Nachkommen): die Auswahl wird aufgehoben, **Andere ausblenden** ausgeschaltet, und der Kartenbereich
  **Auswahl** kehrt auf **Diese Ansicht** zurück. War die Auswahl zu sehen (Hervorhebung in Familie, Nachkommen oder
  Fächer, Karte mit dem Bereich **Auswahl**), sagt die Meldung warum: „Auswahl aufgehoben: Die Liste „{Liste}“ wurde
  gelöscht.“, „Auswahl aufgehoben: Die Stammlinie {Stammlinie} existiert nicht mehr.“, „Auswahl aufgehoben: Die
  Forschungslinie wurde entfernt.“, „Auswahl aufgehoben: {Person} wurde gelöscht.“
- Ein gesperrter Stammbaum oder einer, der noch lädt, verwirft die gespeicherte Auswahl nicht; sie wird nach dem
  Entsperren oder Laden angewandt.
- Die frühere Wahl einer Stammlinie (bis App 3.30.0) wird als Auswahl der Stammlinie übernommen.
- **Gilt seit:** App 3.31.0

<!-- zdroj: app:src/settings.ts selectionByTree (migrace rodByTree → { ref rod, hideOthers false }), mapScopeByTree · src/ui/view-selection-ui.ts (hlavní okno zapisuje, další okno jen stav okna; adoptWindowSelection; obnova bez přesunu; selectionDataChanged: zaniklý výběr zrušen, hideOthers vypnuto, toast jen když byl vidět; zapomenout jen u skutečně načtených dat; pending u zamčeného stromu) · src/windows/view-window-state.ts (selection, mapScope v přenášeném stavu; F5) · src/windows/window-show-on-map.ts · src/ui/map-scope-ui.ts (zrušený / zaniklý → 'view') · strings.ts selection.goneList, goneRod, goneLine, gonePerson · app:9f1fe7c4, 27e6a511, 287d10d5, f5e531e9 · ZADANI_DEV_vyber-osob §7, §12 -->

<a id="A6.7"></a>
## A6.7 Tabelle

Die Tabelle zeigt den ganzen Stammbaum in Zeilen: jede Person, jede Verbindung, jedes Ereignis oder jede Quelle, mit
den Angaben in Spalten. Sie dient dazu, Lücken, Widersprüche und Befunde der Prüfung quer durch den Stammbaum zu
finden. Sie hängt nicht von der Tiefe **Vorfahren** und **Nachkommen** ab. Die Ansicht Tabelle beruht auf einer
Tabelle von Ondřej Chrpa.

- **Zeilen:** Umschalter **Zeilen**: **Personen** · **Verbindungen** · **Ereignisse** · **Quellen**. Jede Zeilenart
  hat eigene Spalten, Filter und Sortierung.
  - **Personen:** eine Zeile je Person des Stammbaums; Platzhalterpersonen (leerer Platz für einen unbekannten
    Elternteil) werden ausgelassen.
  - **Verbindungen:** eine Zeile je Verbindung, die mindestens einen echten Partner hat. **Partner 1** ist der aus
    dem Paar, der mit der Hauptperson blutsverwandt ist; sonst der erste Partner der Verbindung.
  - **Ereignisse:** eine Zeile je Ereignis des Stammbaums ([A6.7.10](#A6.7.10)).
  - **Quellen:** eine Zeile je Quelle des Stammbaums ([A6.7.11](#A6.7.11)).
- Die **Hauptperson** ist die zentrale Person des Stammbaums ([A6.1](#A6.1)). Nach ihr werden die Spalte **Beziehung
  zur Hauptperson** und der Chip **Blutsverwandte** berechnet: die Vorfahren der Hauptperson (auch sie selbst) und
  alle ihre Nachkommen. Partner, die durch Heirat in die Familie kamen, gehören nicht dazu.
- **Generation** 1 ist die älteste Generation des Stammbaums; ein Partner hat die Generation seines Partners.
- **Lebend** (Spalte, Wert „lebend“) wird wie beim Schutz lebender Personen berechnet
  ([A7.1](A7-book-pages-and-export.md#A7.1)).
- Über der Tabelle stehen die Anzahl („42 von 120 Personen“) und die Sortierung („Sortierung: …“). Das Feld **Person
  suchen...** in der Leiste wählt in der Tabelle die Zeile der Person aus und rollt zu ihr; die zentrale Person ändert
  sich nicht.
- **Die zentrale Person zwischen den Ansichten:** nach dem Wechsel in die Tabelle ist die Zeile der zentralen Person
  die aktive Zeile, und die Tabelle rollt zu ihr (eine ausgewählte Zeile, die sie betrifft, bleibt; lassen Filter oder
  Suche die Person aus, gibt es keine aktive Zeile). Nach dem Wechsel aus der Tabelle ist die zentrale Person die
  Person der aktiven Zeile: bei einer Verbindung der Partner, der schon zentrale Person ist, sonst **Partner 1**; bei
  einem Ereignis die zentrale Person, wenn sie unter seinen Personen ist, sonst die erste Person; eine Zeile einer
  Quelle ändert die zentrale Person nicht.
- **Grenzen:**
  - die Hervorhebung einer Stammlinie ([A6.6](#A6.6)) wird in der Tabelle nicht verwendet; einen Stamm wählt der
    Chip **Stamm** ([A6.7.6](#A6.7.6)), ab App 3.31.0 auch die Auswahl des Fensters als Umfang
    ([A6.7.19](#A6.7.19));
  - Spalten, Chips und Ansichten der Forschung gibt es nur in einem Stammbaum aus der Forschung
    ([A6.7.14](#A6.7.14));
  - einen schreibgeschützten Stammbaum (verfolgter Stammbaum, von einer neueren Version der App gespeicherter
    Stammbaum, gesperrter Stammbaum) zeigt die Tabelle nur an: „Nur lesen: Bearbeiten und „Kein Fehler“ gibt es hier
    nicht.“ Ansehen, Filter, Sortierung und CSV- und XLSX-Export funktionieren; eine Ansicht lässt sich weder
    speichern noch umbenennen noch löschen;
  - die Pfeile **↩ ↪** unten links (die vorige und die nächste zentrale Person) und Alt+← / Alt+→ gibt es in der
    Tabelle nicht: die Tabelle zeigt die zentrale Person nicht und ändert sie bei der Arbeit nicht;
  - **ab App 3.30.0** führen Alt+← / Alt+→ in der Tabelle zurück und vor durch die Sprünge über Namen von Personen
    ([A6.7.16](#A6.7.16)); die zentrale Person ändern sie auch so nicht.
- **Ab App 3.30.0:** **Umfang ▾** schränkt die Tabelle auf eine Personenliste ein ([A6.7.19](#A6.7.19)), und **⋯**
  der Tabelle (bei jeder Breite; auf dem Computer verborgen, solange die Tabelle keine Zeilen hat) bietet
  **Gruppieren nach ›** ([A6.7.20](#A6.7.20)) und **Als Personenliste speichern…**
  ([A11.6](A11-lists-of-people.md#A11.6)).
- **Bedienung:** in der Leiste der Ansichten **Tabelle** (nach **Karte**); auf Telefon, Tablet und im Fenster bis
  1024 px **Tabelle** in der unteren Leiste ([A9.5](A9-using-the-app.md#A9.5); bis App 3.27.0 **Mehr → Ansicht → Tabelle**). Die Ansicht wird wie die anderen gespeichert ([A6.1.1](#A6.1.1)).
- **Gilt seit:** App 3.27.0

<!-- zdroj: app:src/ui/table-view/table-model.ts ROW_TYPES, buildTableModel (isPlaceholder ven, svazek aspoň s jedním skutečným partnerem), bloodOf (předci hlavní osoby a všichni jejich potomci), makeContext (homeId, isLivingPerson) · table-columns.ts unionPartners (pokrevní partner jako Partner 1), gen (assignGenerations + 1), kin (findRelationship, kinSelf) · src/ui/table-view/table-ui.ts tableReadOnly (isReadOnly: viewMode, isLocked, isNewerData) · src/data.ts:655 isReadOnly · src/ui/bottom-sheet.ts:443 (do 3.27.0 Více → Pohled: Vějíř, Mapa, Tabulka; od 3.28.0 app:4b1373a7 index.html bb-view-table, commit bb5e4d12) · table-bar.ts countText, sortText · perf-budget test 5 000 osob · strings.ts viewModeSwitch.table, table.rows, rowType, rowTypeNote, countOf, sortedBy, readOnly, readOnlyShort · commity c34c47ff, 1b72e6d8 · spec 073 U2 · Události a Prameny (spec 073 U3 P2, K5.1–K5.4): commity 8de751c2, 63ed9def, 1a3a49f1, 3cf69ffa, strings.ts table.rows.events, rows.sources, perf-budget 5 000 osob (Události) a 2 000 pramenů · poděkování: Milan 10. 11. (dirigent:prace/1110-doc-tabulka, bod 4) · CHANGELOG.cs.md 3.27.0 · dirigent:prace/1110-app-tabulka-p1 · Žijící: strings.ts table.col.living, table.living (commit 7e648e24) · ústřední osoba mezi pohledy: commit 75de3a9b (T54 F1) · ↩ ↪ a Alt+šipky v Tabulce skryté: commity 79764eba, b1cbe546 (T54 G14) -->

<a id="A6.7.1"></a>
### A6.7.1 Verbindungen in der Personentabelle

Eine Person mit zwei und mehr Verbindungen hat in der Personentabelle eine eigene Zeile und darunter eine Unterzeile
für jede Verbindung („Verbindung 2 von 3“). Die Zeile der Person hat in der Spalte **Partner** die Anzahl
(„3 Verbindungen“) und die übrigen Spalten der Verbindung leer.

- Die Verbindungen folgen in der Reihenfolge der Hochzeiten wie im Stammbaum ([A6.4](#A6.4)): **Verbindung 1** ist
  die, die auf der Karte die Marke „1. ∞“ hat. Eine Verbindung ohne Datum der Hochzeit wird nach dem spätesten
  möglichen Datum der Hochzeit geordnet (dem früheren aus der Scheidung und der Geburt des ersten Kindes); eine
  Verbindung ohne diese Daten kommt nach den anderen. Bei Gleichstand entscheidet die Reihenfolge der Verbindungen der
  Person in den Daten. Eine leere Platzhalterfamilie („?“) kommt ans Ende in der Reihenfolge der Erfassung.
- **Zugeklappt:** die Zeile der Person zeigt die erste Verbindung und die Zahl der übrigen. Standard ist
  aufgeklappt; die vorgegebene Ansicht **Lücken** hat die Verbindungen zugeklappt.
- **Ein Filter in einer Spalte der Verbindung** wird bei jeder Verbindung einzeln beurteilt. Die Person bleibt, wenn
  mindestens eine Verbindung passt; die übrigen verschwinden unter der Zeile „2 Verbindungen außerhalb des Filters · zeigen“.
  Gezeigte sind bis zur nächsten Änderung des Filters abgeschwächt.
- **Die Sortierung nach einer Spalte der Verbindung** nimmt die erste Verbindung, die dem Filter entspricht.
- Eine Person mit einer Verbindung hat deren Angaben direkt in ihrer Zeile.
- Eine Unterzeile einer Verbindung trägt nur die Befunde ihrer Verbindung. Die Befunde der Person (etwa das Alter der
  Mutter bei der Geburt) und die Streifen eingeklappter Gruppen bleiben in der Zeile der Person.
- **Bedienung:** **Verbindungen aufklappen** / **Verbindungen zuklappen** (auf dem Telefon im Menü **⋯**); die
  Tasten → und ← in der Spalte **Vollständiger Name**, * für alle Personen; das Zeilenmenü. Der Zustand wird mit der Ansicht
  gespeichert ([A6.7.7](#A6.7.7)).

<!-- zdroj: app:src/ui/table-view/table-subrows.ts defaultUnionCollapse (collapsed: false), isExpanded, setAllExpanded, passingUnions, personPassesUnions, sortUnionOf, buildLines · table-model.ts unionsInMarriageOrder (marriagesInOrder z src/marriage-order.ts: Svazek 1 = „1. ∞“; bez data sňatku podle rozvodu nebo prvního dítěte; shoda podle seznamu partnerships osoby; zástupné rodiny „?“ za nimi v pořadí dat; commit 2e0346f9, T13) · table-views.ts BUILTIN_VIEWS gaps (unions collapsed) · strings.ts table.unionsN, unionKofN, hiddenUnions, expandAll, collapseAll · commity 8833da14, 8192621d · nálezy podřádku: commit 75de3a9b (T54 F6) -->

<a id="A6.7.2"></a>
### A6.7.2 Spalten

Die Spalten stehen in Gruppen. Welche sichtbar sind und in welcher Reihenfolge, ist Teil der Ansicht
([A6.7.7](#A6.7.7)).

| Zeilen | Gruppen der Spalten |
|---|---|
| **Personen** | **Person** · **Geburt und Taufe** · **Eltern** · **Verbindungen** · **Scheidung** · **Tod und Begräbnis** · **Ereignisse** · **Quellen** · **Verlässlichkeit und Forschung** · **Prüfungen** |
| **Verbindungen** | **Paar** · **Heirat** · **Scheidung** · **Kinder und Quellen** |

- **Vollständiger Name** (bei Verbindungen **Partner 1**) ist immer links fixiert; lösen oder ausblenden lässt er
  sich nicht. Er wird nach dem Nachnamen, dann nach dem Vornamen sortiert. Er setzt sich aus den Teilen des Namens zusammen, deshalb gibt es eine eigene Spalte
  **Vorname** (standardmäßig ausgeblendet), die sich in der Zelle bearbeiten lässt ([A6.7.15](#A6.7.15)). **Nachname** ist der Ehename, sonst der Geburtsname; **Geburtsname** ist der erfasste Nachname.
- **Forschungs-ID** zeigt nur die Nummer der Person aus der Forschung (P…). **Ref.-Nummer** ist die
  Referenznummer der Person (REFN), wie sie die GEDCOM-Datei gebracht hat (und wie sie in eine zurückgeht); sie wird als Text
  sortiert und gefiltert.
- **Offene Frage**, **⇄ In anderem Baum** (die Stammbäume auf diesem Gerät, in denen die Person ist) und **Status der
  Person** (das Zeichen der Belegung und Verlässlichkeit von der Karte, in Worten; von der stärksten an sortiert; ab App 3.27.0 nach der Zuverlässigkeit
  der Zitationen, [S7.2](S7-reliability-and-verification.md#S7.2)) gibt
  es in jedem Stammbaum. Die Gruppe **Forschung** gibt es nur in einem Stammbaum aus der Forschung
  ([A6.7.14](#A6.7.14)).
- **Ereignisse** (**Beruf**, **Wohnort**, **Konfession**, **Militärdienst**, **Auswanderung**, **Bildung**) zeigen
  jeden Wert einmal, den neuesten zuerst.
- Die Spalten **Verlässlichkeit …** und **Sicherheit aus der Forschung** haben nur in einem Stammbaum aus der
  Forschung einen Wert ([S7](S7-reliability-and-verification.md)).
- Die Spalten **Vorname**, **Ref.-Nummer**, **Offene Frage**, **⇄ In anderem Baum** und **Status der Person** sind
  standardmäßig ausgeblendet.
- **Ab App 3.30.0:** bei Verbindungen in der Gruppe **Kinder und Quellen** die Spalte **Foto** mit einer Vorschau
  des Paarfotos, standardmäßig ausgeblendet; der Filter **mit Foto** / **ohne Foto**
  ([A12.6](A12-portrait-and-couple-photo.md#A12.6)).
- **Ab App 3.30.0:** bei Personen in der Gruppe **Person** die Spalte **Hinzugefügt**, standardmäßig ausgeblendet:
  der Tag, an dem die Person in den Stammbaum kam ([A11.7](A11-lists-of-people.md#A11.7)), in der Sprache der App.
  Eine Person ohne Angabe hat „früher“ grau kursiv; die Zelle ist leer, daher steht sie in beiden Richtungen der
  Sortierung am Ende, und **Nur leere** findet sie. Sortiert wird nach dem Zeitpunkt des Hinzufügens (innerhalb eines
  Tages nach der Uhrzeit), der Datumsfilter nach Jahr.
- **Ab App 3.30.0:** bei Personen in der Gruppe **Person** die Spalte **Linie**, standardmäßig ausgeblendet: die
  Linie der Person relativ zur zentralen Person des Stammbaums ([A6.1.5](#A6.1.5)) in Worten, **Väterlich**,
  **Väterlich und mütterlich**, **Mütterlich**, **Nachkomme** (bei Eltern gleichen Geschlechts **Linie des 1.
  Elternteils**, **Linie des 1. und 2. Elternteils**, **Linie des 2. Elternteils**), vor dem Text ein Zeichen in der
  gewählten Form (bei **Ohne Form** nur der Text). Eine Person ohne Linie hat eine leere Zelle. Sortiert wird in dieser
  Reihenfolge, leere am Ende; Filter nach Werten. Mit der Spalte **Forschungslinie** der Gruppe **Forschung**
  ([A6.7.14](#A6.7.14)) hat sie nichts zu tun.
- **Grenzen:** eine eingeklappte Gruppe ist ein schmaler Streifen; er zeigt die höchste Stufe eines Befunds in seinen
  Zellen. Auf dem Telefon ist der fixierte Name schmaler, und die Kopfzeile lässt sich nur lesen, nicht ändern.
- **Bedienung:**
  - Panel **Spalten** („12 von 58“): **Spalte suchen**, Gruppen mit dem Kästchen **alle**, Ziehen der Reihenfolge,
    **Abdeckungszeile**, **Standard wiederherstellen**, **Fertig**;
  - Menü im Spaltenkopf: **Aufsteigend sortieren**, **Absteigend sortieren**, **Zur Sortierung hinzufügen**
    (Umschalt + Klick), **Filter…**, **Links fixieren** / **Lösen**, **Nach links** / **Nach rechts**, **Spalte
    ausblenden**, **Gruppe … einklappen** / **Gruppe … ausklappen**; bei einer berechneten Spalte „Berechnet aus: …“;
  - Breite der Spalte durch Ziehen am Rand des Spaltenkopfs.
- **Reihenfolge der Spalten:**
  - im fixierten Teil lässt sich jede fixierte Spalte an jede Stelle unter den fixierten verschieben, auch
    **Vollständiger Name** (er muss nicht der erste sein);
  - außerhalb des fixierten Teils verschiebt sich eine Spalte nur innerhalb ihrer Gruppe;
  - eine Verschiebung, die nicht geht, wird nicht angeboten: Im Menü des Spaltenkopfs fehlt **Nach links** oder
    **Nach rechts**, im Panel **Spalten** der Pfeil ↑ oder ↓.
- **Ab App 3.28.0:** fixierte Spalten in beliebiger Reihenfolge. Bis 3.27.0 war **Vollständiger Name** immer der
  erste und ließ sich nicht verschieben, fixierte Spalten verschoben sich nur innerhalb ihrer Gruppe, und eine
  Verschiebung, die nicht ging, war ausgegraut.

<!-- zdroj: app:4b1373a7 src/ui/table-view/table-state.ts normalizeColumns (zamčený sloupec ukotvený, kdekoli v ukotvené části), columnRun (ukotvená část: [0, pinned − 1]; mimo ni skupina), canMoveColumn, moveColumnBy · table-headmenu.ts headMenuItems (moveLeft/moveRight jen canMove; Skrýt ne u zamčeného; Uvolnit ne u zamčeného) · table-colpanel.ts (šipka jen pro možný posun) · commit 19dbb595 (dřív columnRun locked = 1, disabled/aria-disabled) · dirigent:spec/082-tester-3.28 K2.1 -->
<!-- zdroj: app:src/ui/table-view/table-columns.ts PERSON_GROUPS, UNION_GROUPS, katalog sloupců (surname marriedSurname || lastName, birthSurname lastName, researchId /^P\d{1,7}$/, eventValues nejnovější první, sortKey jména), pinnedWidth 156 na telefonu · table-state.ts MIN_COLUMN_WIDTH, BAND_WIDTH, lockedColumn · table-checks.ts bandSeverity · table-colpanel.ts panelGroups · table-headmenu.ts headMenuItems · strings.ts table.group.*, col.*, columns, columnsCount, searchColumn, all, pinnedLabel, resetColumns, done, coverageRow, sortAsc, sortDesc, sortAdd, sortAddHint, filterColumn, pin, unpin, moveLeft, moveRight, hide, collapseGroup, expandGroup, computedFrom · commity 89602f35, 49b96d92, e4a35406 · refn (skupina person, textCell p.refn; commit 7e648e24, T54 F3), question, crossTree (crossTreeCell), personStatus (personStatusCell, cardStatus, CARD_STATUS_CLASSES), strings.ts table.col.refn, question, crossTree, personStatus · „Celé jméno“ (id `name`) a sloupec firstName, záhlaví „Ref. číslo“ bez „(REFN)“: commity 79764eba, 8fdf52ca (T54 G10, G3) · 3.30.0: app:45f7ca2a table-columns.ts:732 uPhoto (group uextra, skrytý) · app:0971647c table-columns.ts addedCell (dateCell, sortKey + zlomek dne, bez údaje emptyCell s textem earlier), sloupec added (group person, nenabízí se ve výchozím stavu), strings.ts table.col.added, table.earlier · e2e/person-list-table.spec.ts, src/__tests__/table-view-added.test.ts · app:cecd72a4 table-columns.ts lineage (group person, skrytý, getFocusPersonId, řazení paternal → both → maternal → descendant, prázdné poslední, filtr hodnot), table-grid.ts lineageHtml (znak ve zvoleném tvaru), strings.ts branchColors.tableColumn, tableBoth, tableDescendant, tableSlotBoth · app:675e1c5e strings.ts table.col.rLine „Linie výzkumu“ (do 3.29.0 „Linie“), src/__tests__/table-column-labels-unique.test.ts -->

<a id="A6.7.3"></a>
### A6.7.3 Berechnete und Ersatzwerte

Was im Stammbaum nicht erfasst ist, sich aber aus den Daten berechnen lässt, berechnet die Tabelle. Dabei schreibt
sie nichts in den Stammbaum.

| Wert | Wie er berechnet wird |
|---|---|
| Alter (bei der Geburt eines Kindes, bei der Heirat, beim Tod) | aus Daten mit Tag genau („67“); aus Jahr, Monat oder Zeitraum als Bereich („28–29“); aus einem Datum mit um, vor oder nach als Schätzung („≈ 67“) |
| Ersatzdatum und -ort | ohne Geburt die Taufe („get. 3.5.1850“), ohne Tod das Begräbnis („begr. …“); ein Alter daraus ist eine Schätzung (≈) |
| **Abweichung angegebenes Alter** | um wie viele Jahre das angegebene Alter außerhalb des Bereichs des Alters aus den Daten liegt („+3“, „−2“); ein Alter in Worten und ein Alter mit um, vor, nach wird nicht verglichen |
| **Dauer der Verbindung** | von der Heirat bis zur Scheidung, sonst bis zum ersten Tod aus dem Paar |
| **Geburtsrang**, **Zahl der Geschwister**, **Zahl der Kinder**, **Zahl der Verbindungen**, **Zahl der Quellen** | aus den Beziehungen und Quellen des Stammbaums |

- Daten haben das Wort der Genauigkeit vor sich (**um**, **vor**, **nach**). Ein unsicheres Datum ist gepunktet
  unterstrichen; ein Befund ist es nicht. Ein Datum wird nach seinem Anfang sortiert.
- **Grenzen:** ein Alter wird nicht berechnet, wenn das Ende vor dem Anfang liegt. Die Spalten des Todes haben bei
  einer lebenden Person **Trifft nicht zu** (bei **Vollständigkeit Sterbefall** „lebt“). **Alter des Vaters/der
  Mutter bei der Geburt** ohne erfassten Elternteil ist **Trifft nicht zu**.
- **Bedienung:** Hinweis an der Zelle („Taufe, Geburt unbekannt“, „Begräbnis, Tod unbekannt“); bei einer berechneten
  Spalte im Menü des Spaltenkopfs „Berechnet aus: …“; die Legende **Zeichen** ([A6.7.13](#A6.7.13)).

<!-- zdroj: app:src/ui/table-view/table-columns.ts ageCell (přesně / rozsah ageRangeBetween / ≈ approxAgeBetween; nic, když konec před začátkem), dateCell, qualifierWord, birthOrBaptism, deathOrBurial (náhrada, ≈), gapCell (recordedAgeGap), unionLength, naCell, parentsOf · src/dates.ts:448 ageRangeBetween, recordedAgeGap · table-model.ts dateNumber (začátek rozsahu) · strings.ts table.na, living, subst.*, qual.*, computedFrom, from.* · commit 8833da14 -->

<a id="A6.7.4"></a>
### A6.7.4 Vollständigkeit und Abdeckungszeile

Die Spalten **Vollständigkeit …** sagen, wie viele der beobachteten Felder ausgefüllt sind, in Prozent.

| Spalte | Gezählt aus |
|---|---|
| **Vollständigkeit Geburt** | Datum, Ort, Vater, Mutter, Quelle |
| **Vollständigkeit Verbindung** | Datum, Ort, Partner, Quelle zur Heirat; bei einer Verbindung ohne Heirat (**Partner**, **Getrennt**) nur der Partner |
| **Vollständigkeit Sterbefall** | Datum, Ort, Quelle (nicht bei einer lebenden Person) |
| **Vollständigkeit gesamt** | Geburt, jede Verbindung und Tod, gewichtet nach der Zahl der Felder |

- Ein Ersatzwert (Taufe, Begräbnis) füllt kein Feld aus. Der Hinweis an der Zelle nennt, was fehlt („fehlt:
  Geburtsort, Quelle zur Geburt“).
- Die **Abdeckungszeile** unter dem Spaltenkopf zeigt bei jeder Spalte, wie viel Prozent der Zeilen einen Wert haben
  („ausgefüllt 64 %“, Hinweis „77 von 120“). Das Wort „ausgefüllt“ steht in der ersten Spalte, welche es auch ist (ab App 3.28.0;
  vorher in der Spalte des Namens), auch im XLSX-Export. Bei den Spalten **Vollständigkeit …** zeigt sie die durchschnittliche
  Vollständigkeit der Zeilen (Hinweis „Durchschnitt von 120“). Sie zählt nur die Zeilen, die gerade zu sehen sind (nach Filter und
  Suche). Zellen **Trifft nicht zu** werden nicht gezählt; bei Spalten der Verbindung werden die Verbindungen
  gezählt, die dem Filter entsprechen. Unter 50 % ist die Zahl fett; ohne eine Zelle, die sie betreffen würde, steht
  „–“.
- **Verbindung ohne Heirat** (Art **Partner** oder **Getrennt**): die leeren Zellen der Heirat (Datum, Ort, Alter und
  eingetragenes Alter beider, Abweichung des eingetragenen Alters, Trauzeugen, **Verlässlichkeit Heirat**) haben „–“
  mit dem Hinweis „Trifft nicht zu: Verbindung ohne Heirat“ und zählen weder in der Abdeckungszeile noch in der
  Vollständigkeit. Ein Wert, der dort trotzdem steht (der Beginn der Beziehung aus dem Formular der Verbindung), wird
  wie bisher gezeigt.
- **Bedienung:** **Abdeckungszeile** im Panel **Spalten** (auf dem Telefon in **⋯**); sie wird mit der Ansicht
  gespeichert.

<!-- zdroj: app:src/ui/table-view/table-columns.ts compCell, unionComp (pole a váhy, náhrada nevyplní) · table-coverage.ts cellFilled, columnCoverage, coverageCell, coverageLabel (LOW pod 50 %) · table-subrows.ts coverageUnionsOf · strings.ts table.compList.*, compField.*, missing, missingNone, compCounts, coverage, coverageOf · rozhodnutí Milan 10. 11. (spec 073, bod 5) · commit 8833da14 · průměr u sloupců úplnosti (kind percent): table-coverage.ts columnCoverage average, strings.ts table.coverageAverage, i XLSX, commit 56f3418c (T54 G12) · „vyplněno“ v prvním sloupci: app:4b1373a7 table-ui.ts coverageOf (firstId), table-xlsx.ts labelAt, commit 19dbb595 · svazek bez sňatku: table-columns.ts unionWithoutWedding (partners, separated), weddingCell, oneUnionFields (jen partner), strings.ts table.naNoWedding, compList.unionNoWedding, commit 8fdf52ca (T54 G5, MILAN.md rozhodnutí 21) -->

<a id="A6.7.5"></a>
### A6.7.5 Befunde der Prüfung in den Zellen

Die Tabelle zeigt die Befunde der Datenqualität ([A5](A5-tree-check.md)) direkt bei der Angabe, die sie betreffen:
die Zelle ist hinterlegt und hat ein Zeichen der Stufe. Die Prüfung läuft über den ganzen Stammbaum im Hintergrund,
wenn die App frei ist.

| Stufe | Zeichen in der Legende |
|---|---|
| **Fehler** | „Die Angaben widersprechen sich.“ |
| **zu prüfen** | „Ein ungewöhnlicher Wert, der geprüft werden sollte.“ |
| **Spur** | „Eine Spur für die Forschung, kein Fehler.“ |
| **ungewöhnlich** (☆) | „Ein als „Kein Fehler“ markierter Befund.“ |

- Ein Befund kommt in die Zelle seiner Angabe: das Alter eines Elternteils bei der Geburt in **Alter des Vaters/der
  Mutter bei der Geburt** beim Kind, ein Befund zur Heirat in das Alter und das Datum der Heirat, ein angegebenes
  Alter in das angegebene Alter und seine Abweichung, ein Tod vor der Geburt in beide Daten und das Alter, ein
  Ereignis in die Spalte des Ereignisses, der Altersunterschied der Partner in den Partner, eine mögliche doppelte
  Person in den Namen, die Schreibung eines Ortes in die Zellen mit diesem Ort. Ein Befund ohne eigene Zelle steht
  nur in den Spalten der Prüfungen.
- Spalten der Gruppe **Prüfungen**: **Befunde** (Anzahl; „…“, solange die Prüfung läuft), **Höchste Stufe**,
  **Ungewöhnlich, geprüft** (Zahl der als **Kein Fehler** markierten Befunde).
- Ein als **Kein Fehler** markierter Befund ([A5.7](A5-tree-check.md#A5.7)) bleibt in der Zelle als **ungewöhnlich**
  („Ungewöhnlich, aber geprüft“) und zählt nicht zu den Befunden.
- **Grenzen:** ein schreibgeschützter Stammbaum lässt keinen Befund markieren („Der Baum ist schreibgeschützt:
  Befunde lassen sich nicht markieren.“).
- **Bedienung:** ein Klick auf das Zeichen öffnet eine Blase (auf dem Telefon ein Panel von unten): Stufe, Text des
  Befunds, „Befund 1 von 2“ und
  - **Kein Fehler** (Meldung „Markiert: kein Fehler“ mit **Rückgängig**); bei einem ungewöhnlichen **Wieder
    melden**;
  - **Datenqualität ›** öffnet den Dialog der Datenqualität bei der Gruppe dieses Befunds; bei einem ungewöhnlichen
    bei der Liste der markierten.

  Die Zellen **Befunde** und **Höchste Stufe** öffnen die Liste aller Befunde der Person (Klick, Enter, Tippen; auf
  dem Telefon ein Panel von unten): bei jedem die Stufe, der Text und wen oder was er betrifft; gemeldete nach der
  Stufe, die als **Kein Fehler** markierten am Ende.

  Die Legende **Zeichen** („Zeichen in den Zellen“) erklärt auch das unsichere Datum, die Verlässlichkeit, den
  Ersatzwert, den berechneten Wert und **Trifft nicht zu**. Wie welches Zeichen aussieht: [A6.7.13](#A6.7.13).

<!-- zdroj: app:src/ui/table-view/table-checks.ts severityRank, parentAgeColumn, issueTargets (mapování nálezů na buňky), buildCheckIndex, CHECK_COLUMNS, applyChecks · table-ui.ts whenIdle (validateTreeData jednou), cellFindings · table-bubble.ts bubbleHeading, bubbleHtml, legendHtml, openBubblePanel, sheetElement · src/ui/tree-stats.ts showTreeValidationDialog (focus: skupina otevřená a posunutá; označené → seznam) · strings.ts table.sev.*, unusualChecked, notError, reReport, toQuality, dismissedToast, roNote, checksRunning, findingOf, legend, legendTitle, legendKind.*, legendText.* · commity 19cf28ea, e530019b, 59a8eed0 · seznam nálezů osoby z buněk Nálezy a Nejvyšší úroveň: commit 75de3a9b (T54 F5) -->

<a id="A6.7.6"></a>
### A6.7.6 Filter, Suche und Sortierung

Der Filter wählt die Zeilen aus, die Suche engt sie weiter ein, die Sortierung bestimmt die Reihenfolge.

- **Chips** der Personentabelle (Verbindungen haben keine Chips, Ereignisse und Quellen eigene, [A6.7.10](#A6.7.10),
  [A6.7.11](#A6.7.11)): **Lebend**, **Verstorben** (schließen sich aus), **Blutsverwandte**, **Stamm**
  (Wahl der Stämme), **Generation** (Bereich), **Mehrere Verbindungen**, **Ohne Geburtsdatum**, **Unsicheres Datum**
  (Geburt oder Tod), **Ohne Quelle**, **Mit Befund** (Fehler oder zu prüfen; Spur nicht), **Ungewöhnlich**,
  **Unbestätigt (Forschung)** (nur Stammbaum aus der Forschung). Die Chips der Befunde warten auf die Prüfung
  („Sobald die Prüfungen fertig sind“). Was nicht hineinpasst, steht unter **Weitere (n)**.
  - **Ab App 3.31.0:** nach **Ohne Geburtsdatum** steht der Chip **Ohne Ort**: Personen ohne Ort für Geburt, Heirat,
    Tod und anderes Ereignis, also ohne einen Ort, den die Karte zeigen würde ([A6.5.8](#A6.5.8)).
- **Filter in der Spalte** (**Filter…** im Spaltenkopf) nach der Art der Spalte:
  - Werte aus einer Liste (Geschlecht, Stand der Verbindung, Stufe des Befunds, Stamm …);
  - Bereich **von**–**bis** (beim Datum **Jahr**, bei Alter, Anzahl und Prozent eine Zahl);
  - Text: **enthält** · **beginnt mit** · **ist** · **ist nicht** (ohne Rücksicht auf Groß- und Kleinschreibung und
    diakritische Zeichen; Chip „Spalte = Wert ×“ oder „Spalte ≠ Wert ×“; schnell aus dem Zellenmenü,
    [A6.7.15](#A6.7.15));
  - bei jeder **Nur leere** · **Nur ausgefüllte**.
- Es gelten alle Filter zugleich. Die Zahl der Filter steht auf **Filter (n)**, alles hebt **Filter aufheben** auf.
  Ohne Zeile: „Nichts entspricht dem Filter“.
- **In Tabelle suchen:** ab 2 Zeichen, ohne Rücksicht auf Groß- und Kleinschreibung und diakritische Zeichen, in den
  sichtbaren Spalten und auch in den Unterzeilen der Verbindungen; Treffer sind hervorgehoben, über der Tabelle
  steht ihre Zahl.
- **Sortierung:** ein Klick auf den Spaltenkopf sortiert aufsteigend, ein weiterer absteigend, der dritte hebt die
  Sortierung auf; sortiert wird nur nach dieser Spalte. Umschalt + Klick fügt die Spalte als weiteren Schlüssel hinzu
  (ein weiterer Klick dreht ihn um, der dritte entfernt ihn). Der Pfeil ↑ ↓ am Spaltenkopf trägt die Nummer der
  Reihenfolge des Schlüssels. Leere Werte stehen immer am Ende, in beiden Richtungen. Zahlen im Text werden als Zahlen
  sortiert.
- **Grenzen:** die Suche wird nicht in der Ansicht gespeichert ([A6.7.7](#A6.7.7)).
- **Ab App 3.30.0:**
  - Ausschlüsse summieren sich: jedes **Ohne „{Wert}“** aus dem Zellenmenü ([A6.7.15](#A6.7.15)) ist ein eigener
    Chip „{Spalte} ≠ {Wert} ×“ neben dem Hauptfilter der Spalte, in derselben und in einer anderen Spalte. × hebt nur
    seinen Chip auf, **Filter aufheben** alle. Das Formular eines Chips bearbeitet nur diesen Chip, das Formular im
    Spaltenkopf den Hauptfilter der Spalte;
  - ein zweites **Nur „{Wert}“** in einer Spalte fügt den Wert hinzu: „Vater = A oder B“ (ab vier Werten „A, B +2“),
    eine Zeile passt mit jedem davon. **Ohne** zu einem solchen Wert nimmt ihn wieder weg (beim letzten wird daraus
    ein Ausschluss), **Nur** zu einem ausgeschlossenen Wert hebt den Ausschluss auf. In einer Spalte mit Werten aus
    einer Liste werden die gewählten Werte ebenso hinzugefügt und weggenommen;
  - der Chip „= …“ (und der Spaltenkopf, solange sein Filter **ist** lautet) hat statt eines Textfelds die Werte der
    Spalte zum Ankreuzen: oben die angekreuzten, darunter die übrigen in der Reihenfolge der Spalte, jeder einmal
    (dieselbe Person, sonst derselbe Text ohne Rücksicht auf Groß- und Kleinschreibung und diakritische Zeichen). Ein
    angekreuzter Wert kommt hinzu, ein abgewählter verschwindet, und mit dem letzten verschwindet der Chip.
    **enthält**, **beginnt mit** oder **ist nicht** bringt das Textfeld mit dem ersten angekreuzten Wert zurück. Auf
    dem Telefon haben die Zeilen der Liste 48 px;
  - eine Person, deren Namen im Stammbaum auch eine andere Person zeigt, hat im Chip, in der Werteliste und in der
    Übersicht der Filter das Geburtsjahr: „Jan Horák (* 1850)“. Die übrigen Werte bleiben unverändert;
  - die Ansicht speichert die Chips ([A6.7.7](#A6.7.7)), eine früher gespeicherte Ansicht öffnet sich unverändert,
    und die Datenversion bleibt. Eine ältere App wendet alle Ausschlüsse an und von „A oder B“ nur den ersten Wert;
  - viele Chips werden mit „…“ gekürzt, **Filter aufheben** bleibt in der Zeile.

<!-- zdroj: app:src/ui/table-view/table-filter.ts CHIP_ORDER, setChip (Žijící × Zemřelí), personPassesChip (finding: chyba nebo k ověření; unusual; unconfirmed jen researchTree, relN/relB/relD), CHECK_CHIPS, rodChoices, generationSpan, filterKindOf, cellPasses, foldText · table-filterbar.ts SEARCH_DELAY_MS, columnFilterForm, chipChoiceForm · table-state.ts řazení (vzestupně → sestupně → vypnuto; Shift přidá, otočí, odebere; prázdné na konci; Intl.Collator numeric) · strings.ts table.chip.*, chipRod, chipGen, moreN, filters, clearFilters, search, matches, noMatch, checksWait, matchContains, matchStarts, rangeFrom, rangeTo, rangeYears, onlyEmpty, onlyFilled · commity dd1d74bc, e64b8b06, fc746037 · je / není: strings.ts table.matchEquals, matchNotEquals (commit 05d9a9ab, T54 F4) · 3.30.0: app:ec39d469 table-filter.ts isExclusionItem, addWithoutFilter, addOnlyFilter (or, picked), removeColumnItemAt, mainItemIndex, setColumnFilter(at), equalValues · strings.ts joinOr (od 4 hodnot „A, B +2“), table.filterOr · app:8891a860 table-filter.ts columnEqualValues, equalChoices, equalsOf, equalValueLabel, namesakes, table.nameBorn (nar.), table-filterbar.ts (.tv-ff-values, 48 px na telefonu) · CHANGELOG.cs.md 3.30.0 „Filtry Tabulky“ · spec 103 K1.1–K1.5 · dirigent:test/vysledek-1116-app-103-tabulka.md, vysledek-1116-app-103-odkazy-083-razeni.md -->

<a id="A6.7.7"></a>
### A6.7.7 Tabellenansichten

Eine Ansicht ist eine unter einem Namen gespeicherte Einstellung der Tabelle. Die vorgegebenen Ansichten sind fertige
Lesarten des Stammbaums; eine eigene Ansicht speichert der Mensch.

| Vorgegebene Ansicht | Zeilen | Was sie zeigt |
|---|---|---|
| **Übersicht** (Standard für Personen) | Personen | Name, Datum und Ort der Geburt, Sterbedatum, Sterbealter, Partner, Heiratsdatum und Alter dabei, Befunde, Vollständigkeit gesamt; sortiert nach dem Geburtsdatum |
| **Geburten und Eltern** | Personen | Geburt und Taufe, Eltern, ihr Alter bei der Geburt, Vollständigkeit Geburt; sortiert nach dem Geburtsdatum |
| **Heiraten** (Standard für Verbindungen) | Verbindungen | Paar, Datum und Ort der Heirat, Alter und angegebenes Alter beider, Stand, Trauzeugen, Scheidung, Kinder, Dauer, Quellen, Vollständigkeit; sortiert nach dem Heiratsdatum |
| **Sterbefälle** | Personen | Tod, Ursache, Begräbnis, Alter und angegebenes Alter beim Tod, Vollständigkeit Sterbefall; Chip **Verstorben**; sortiert nach dem Sterbedatum |
| **Quellen und Zitate** | Personen | Zahl der Quellen, Belegung, Verlässlichkeit von Geburt und Tod; von den wenigsten Quellen an |
| **Lücken** | Personen | Vollständigkeit gesamt und nach Teilen, Geburt, Eltern, Quellen; von den am wenigsten vollständigen an; Verbindungen zugeklappt |
| **Prüfungen** | Personen | Stufe und Zahl der Befunde, Daten, Alter der Eltern, Heirat; Chip **Mit Befund**; von der höchsten Stufe an, dann nach der Zahl der Befunde |
| **Alle Ereignisse** (Standard für Ereignisse) | Ereignisse | Art, Person oder Paar, Datum, Ort, Alter beim Ereignis, Paten, Trauzeugen, Amtsperson, Quelle; sortiert nach dem Datum |
| **Alle Quellen** (Standard für Quellen) | Quellen | Titel, Archiv, Buch und Signatur, online, Personen, Angaben, von der Forschung gelesen, Abschrift; sortiert nach dem Titel |

- **Die Ansicht speichert:** Zeilenart, Spalten (Reihenfolge, Breiten, Fixierung, eingeklappte Gruppen),
  Abdeckungszeile, Filter, Sortierung und das Aufklappen der Verbindungen; ab App 3.30.0 auch den Umfang
  ([A6.7.19](#A6.7.19)) und die Gruppierung der Zeilen mit den eingeklappten Gruppen von Zeilen
  ([A6.7.20](#A6.7.20)), bei Quellen nicht. Sie speichert nicht die Suche, die ausgewählte Zeile und die
  Bildlaufposition.
- Eine geänderte Ansicht hat das Etikett **geändert** und die Möglichkeiten **Speichern**, **Als neue speichern**,
  **Änderungen verwerfen**. Eine vorgegebene Ansicht ändert sich nicht und lässt sich weder umbenennen noch löschen;
  ihre Änderungen gehen nur über **Als neue speichern**. Eigene Ansicht: **Umbenennen…**, **Löschen** (mit
  Bestätigung). Eigene Ansichten sind nach dem Namen geordnet.
- Den Arbeitsstand der Tabelle merkt sich die App für jeden Stammbaum auf diesem Gerät; nach dem Neuladen der Seite
  oder einer Aktualisierung der App ist die Tabelle so, wie sie geblieben ist. Dazu gehören die ungespeicherten
  Änderungen jeder Ansicht, auch einer, aus der weggeschaltet wurde: zurück in ihr hat die Ansicht weiter das Etikett
  **geändert**. **Speichern**, **Als neue speichern** und **Änderungen verwerfen** erledigen sie. Ein beschädigter Teil
  des Arbeitsstands wird ausgelassen.
- **Gespeicherte Ansichten sind Teil des Stammbaums** (Datenversion 17): Speichern, Umbenennen und Löschen haben
  einen Schritt zurück und einen Eintrag im Änderungsverlauf. Sie gehen mit dem Stammbaum in die Sicherung (JSON) und
  beim Abtrennen eines Teils des Stammbaums auch in den neuen Stammbaum. GEDCOM trägt sie nicht; ein Stammbaum aus der
  Forschung behält sie beim Laden einer neuen Version. Eine beschädigte Ansicht wird beim Laden ausgelassen.
- **Grenzen:** eine ältere App (ab 3.19.0) öffnet einen von App 3.27.0 gespeicherten Stammbaum schreibgeschützt und
  speichert ihn nie; nach der Aktualisierung der App lässt sich der Stammbaum wieder ändern.
- **Bedienung:** Menü **Ansicht** in der Leiste der Tabelle (**Vorgegeben**, **Eigene**, **Als neue speichern…**,
  **Umbenennen…**, **Löschen**).

<!-- zdroj: app:src/ui/table-view/table-views.ts BUILTIN_VIEWS (9: overview, births, marriages, deaths, sources, gaps, checks, events, allSources), defaultViewId (události → Všechny události, prameny → Všechny prameny), defaultViewId, viewFromState, viewChanged, uniqueViewName, customViews (podle jména), workStorageKey strom.table.{treeId}, readTableWork, writeTableWork · table-columns.ts výchozí sloupce pohledů (:683 Sňatky, DEFAULT_VIEWS.events, .sources) · src/table-views-data.ts sanitizeTableView, keepTableViews (verze z výzkumu ponechá pohledy) · src/data.ts:298 sanitizeTableViews při načtení, :1720 saveTableView, deleteTableView (krok zpět, historie změn) · src/subtree.ts:148 · src/types.ts STROM_DATA_VERSION 17, StromData.tableViews · src/tree-manager.ts:630 isTreeNewer, src/data.ts:649 isNewerData (jen ke čtení, od aplikace 3.19.0) · src/ui/research-ui.ts, conflict-decide-ui.ts keepTableViews · strings.ts table.view, views.*, viewName.* (events, allSources), changed, save, saveAs, discard, builtinNote, saveAsMenu, renameMenu, deleteMenu, builtinLocked, viewWhat, deleteConfirm · commity d19a5942, c2d48747, 8ca649ff · neuložené změny všech pohledů v pracovním stavu (localStorage) se sanitizací: commit b1cbe546 (T54 G9, varianta c) -->

<a id="A6.7.8"></a>
### A6.7.8 Zeilenaktionen und Bearbeitung

Ein Klick wählt eine Zeile aus (auch eine Unterzeile einer Verbindung); die Pfeiltasten, Bild auf/ab und
Strg+Pos1/Ende verschieben die Auswahl, Esc hebt sie auf.

| Aktion | Was sie tut |
|---|---|
| **Im Baum zeigen** | wechselt in die Ansicht Familie mit der Person als zentraler Person, zentriert und hervorgehoben |
| **Person öffnen** (Enter) | öffnet die Seite der Person |
| **Bearbeiten…** (Doppelklick) | öffnet die Bearbeitung der Person; bei einer Unterzeile einer Verbindung und in der Verbindungstabelle die Beziehungen der Person in dieser Verbindung |

- In der Verbindungstabelle betreffen die Aktionen die Person **Partner 1**.
- In der Ereignistabelle betreffen sie die erste Person der Zeile, und **Bearbeiten…** öffnet die Bearbeitung dieses
  Ereignisses ([A6.7.10](#A6.7.10)); in der Quellentabelle gibt es **Quelle öffnen** ([A6.7.11](#A6.7.11)).
- Nach einer Bearbeitung die Meldung „Gespeichert: …“, die Zeile blinkt kurz, und die Zeilen bleiben in ihrer
  Reihenfolge. Eine Zeile, die dem Filter nicht mehr entspricht, bleibt mit dem Etikett „passt nicht mehr“ bis zur
  nächsten Änderung der Sortierung, des Filters oder der Ansicht. Eine Änderung aus der Forschung meldet „Die
  Forschung hat 3 Angaben geändert: …“.
- Eine Angabe lässt sich auch direkt in der Zelle bearbeiten ([A6.7.15](#A6.7.15)).
- **Ab App 3.30.0:** das Zeilenmenü (und das Panel der Zeile auf dem Telefon) hat **Zur Personenliste hinzufügen ›**
  für die Personen der Zeile, eine Auswahl über mehrere Zeilen **N Personen zur Liste hinzufügen ›**; im Umfang
  einer festen Liste auch **Aus der Liste entfernen** ([A11.5](A11-lists-of-people.md#A11.5),
  [A6.7.19](#A6.7.19)).
- **Grenzen:** in einem schreibgeschützten Stammbaum gibt es kein **Bearbeiten…** und auch kein **Zur Personenliste
  hinzufügen ›**.
- **Bedienung:** die Schaltflächen ⌖ ▤ ✎ am Ende der Zeile, über keinem Text einer Zelle: mit der Maus erscheinen
  sie, sobald der Zeiger auf der Zeile außerhalb von ihnen war, an der ausgewählten Zeile auch mit dem Zeiger
  anderswo; Zeilenmenü (rechte Maustaste; auch Aufklappen der Verbindungen). Ein Tippen mit dem Finger auf die Zeile
  (Telefon, schmales Fenster, ein vor allem per Touch bedientes Gerät) öffnet ein Panel mit den Aktionen und den
  Verbindungen („Verbindung 1: … · Bearbeiten ›“).
- **Ab App 3.28.0:** ein Klick mit Maus oder Stift wählt auf jedem Gerät nur Zeile und Zelle aus, auch auf einem
  Notebook mit Touchscreen, einem Tablet mit Maus und in einem schmalen Fenster; es entscheidet der Zeiger des
  Klicks, nicht das Gerät. Bis 3.27.0 öffnete auf einem Touch-Gerät und in einem schmalen Fenster jeder Klick das
  Panel der Zeile. Die Aktionen der Zeile stehen an ihrem Ende, sodass die Spalte der Personen auf der ausgewählten
  Zeile ihre ganze Breite behält.

<!-- zdroj: app:src/ui/table-view/table-ui.ts tableMethods (tableRowAction: tree → Rodina, focus, highlight; open; edit → dialog osoby / panel vztahů na svazku), personOfRow (Partner 1), keepWork · table-refresh.ts keepOrder, watchEdit, changedKeys, bridgeChanges, namesList · table-grid.ts FLASH_MS · strings.ts table.act.*, dblClickHint, actionsOf, unionWith, editMore, staleRow, savedToast, bridgeToast · commity da6b9786, de46ae30, e4a35406 · od 3.28.0: table-grid.ts clickPointerType, isMouseLikePointer, table-ui.ts onRowClick (panel jen klepnutí a isPhoneBar | isCoarsePointer), commit ee38c7a6; rowActions ⌖ ▤ ✎ v .tv-acts-dock, armRowActions (myš a pero), commit 80c2ffb9 -->

<a id="A6.7.9"></a>
### A6.7.9 CSV- und XLSX-Export

Der Export speichert die Tabelle, wie sie zu sehen ist, in eine Datei für Tabellenkalkulationen: **CSV** oder
**XLSX** (Excel-Arbeitsmappe).

- **Was hinausgeht:** die sichtbaren Spalten in der Reihenfolge der Tabelle (die Spalten einer eingeklappten Gruppe
  ganz) und die Zeilen nach Filter, Suche und Sortierung. Die Werte sind so, wie die Tabelle sie schreibt: Daten in
  der Schreibweise der App, „um …“, „≈ 67“, „get. …“, „–“.
- **Zeilen:** ohne Filter und Suche gehen alle Zeilen hinaus („Alles Angezeigte · 120 Personen“). Mit Filter oder
  Suche gibt es die Wahl:
  - **Angezeigte** (Standard): nur die Zeilen, die die Tabelle zeigt, mit der Anzahl und einem Hinweis auf den Filter
    („Angezeigte · 28 von 866 Personen (Filter: …)“);
  - **Alle … ohne Filter** („Alle Personen ohne Filter · 866“): alle Zeilen dieser Art in der Reihenfolge der
    Sortierung, ohne Filter und ohne Suche.

  Eine Zeile mit dem Etikett „passt nicht mehr“ ([A6.7.8](#A6.7.8)) gehört nicht zu den angezeigten.
- Eine Person mit zwei und mehr Verbindungen: die erste Verbindung, die dem Filter entspricht, steht in ihrer Zeile,
  jede weitere in einer Folgezeile mit leeren Angaben der Person. Hinter dem Namen steht die Spalte **Verbindung**
  („1 von 3“).
- **CSV:** Text, UTF-8 mit BOM-Kennung, Trennzeichen Semikolon, Zeilenenden CRLF; eine Zelle, die eine
  Tabellenkalkulation als Formel ausführen würde, wird entschärft. Zeichen der Befunde und Farben werden nicht
  exportiert.
- **XLSX:** ein Tabellenblatt, benannt nach der Ansicht.
  - Zeile 1 sind die Gruppen der Spalten (verbundene Zellen), Zeile 2 der Spaltenkopf, Zeile 3 die Abdeckungszeile
    ([A6.7.4](#A6.7.4)). Die fixierten Spalten der Tabelle und diese drei Zeilen sind im Blatt fixiert.
  - Jede Gruppe von Spalten ist eine Gliederung: sie lässt sich zuklappen, ihre erste Spalte bleibt. Die Folgezeilen
    der Verbindungen liegen eine Ebene tiefer unter der Zeile der Person (Ebene 2 der Zeilengliederung).
  - Eine Zelle mit einem Befund **Fehler** oder **zu prüfen** ist hinterlegt und hat die Befunde in einem Kommentar.
    Spur und ungewöhnlich haben weder Farbe noch Kommentar.
  - Anzahlen, Alter in ganzen Jahren und Vollständigkeit sind Zahlen (Vollständigkeit und Abdeckung als Prozent);
    das Übrige ist Text, wie ihn die Tabelle schreibt (auch „≈ 67“, „28–29“, Daten). Text wird nie zu einer Formel.
    Der Link einer Quelle ist in der Zelle ein Link.
- **Ab App 3.30.0:** im Umfang einer Personenliste sind die ersten Spalten **#** und bei einer Arbeitsliste
  **Erledigt** (✓) ([A6.7.19](#A6.7.19)); eine gruppierte Tabelle hat vor ihnen die Spalte **Gruppe**
  ([A6.7.20](#A6.7.20)).
- **Datei:** `{Stammbaum}_{Ansicht}_{JJJJ-MM-TT}.csv` oder `.xlsx`, ohne diakritische Zeichen.
- **Bedienung:** **Export ▾** in der Leiste der Tabelle (auf dem Telefon in **⋯**): **Format** „CSV · für Excel und
  Google Tabellen“ oder „XLSX · Gruppen, fixierte Spalten, Prüffarben“, **Zeilen**, **CSV herunterladen** / **XLSX
  herunterladen**; Meldung „Heruntergeladen: …“ mit der Zahl der Personen, Zeilen und Spalten.
- **Grenzen:** der Export aus dem Menü des Stammbaums (**Personentabelle (CSV)**, [A7](A7-book-pages-and-export.md))
  ist eine andere Datei mit festen Spalten.
- **Gilt seit:** App 3.27.0

<!-- zdroj: app:src/ui/table-view/table-export.ts tableCsvField (neutralizace vzorců), buildExportTable, buildTableCsv (BOM, ;, CRLF, pokračovací řádky, sloupec Svazek), fileNamePart, tableCsvFileName (csv | xlsx) · table-xlsx.ts buildTableXlsx (řádky 1–3, merges, outline sloupců za ukotvenou částí, pokračovací řádky outline 1, freeze, errorFill/warningFill + findingsComment jen chyba a k ověření, href), xlsxNumber (COUNT_COLUMNS, věk ^\d+$, procento) · src/xlsx.ts (ignoredErrors numberStoredAsText, styl @ pro text) · table-viewbar.ts exportForm (Formát, Řádky: Zobrazené / Všechny bez filtru jen s filtrem nebo hledáním) · table-ui.ts tableExportNow (unfiltered: všechny řádky typu v řazení, stale ven) · strings.ts table.export, exportFormat, exportRows, exportCsv, exportXlsx, exportAll, exportShown, exportFilterNote, exportUnfiltered.*, exportWhat.*, exportWhatAll.*, exportFile, exportDownload, exportDownloadXlsx, csvUnionCol, csvUnionOf, exportedToast · commity 2368683b, 5a67797b, 4308633b, e0ce4ec2, ebc1542f, e5b97725 · dirigent:prace/1110-app-tabulka-p2, 1110-app-tabulka-opravy -->

<a id="A6.7.10"></a>
### A6.7.10 Ereignisse in Zeilen

Die Ereignistabelle hat eine Zeile für jedes Ereignis des Stammbaums: wer, wann, wo, in welchem Alter und wer dabei
war.

- **Was eine Zeile ist:**
  - jedes Ereignis einer Person (Taufe, Beruf, Wohnort, Militärdienst …) und jedes Ereignis eines Paares;
  - Geburt und Tod aus den Angaben der Person, wenn dazu etwas erfasst ist (Datum, Ort, Adresse, Quelle; beim Tod
    auch die Ursache oder das Alter);
  - die Heirat einer Verbindung: bei einer Ehe immer, bei einer anderen Beziehung („Beginn der Beziehung“) nur mit
    einer erfassten Angabe; die Scheidung („Ende der Beziehung“), wenn die Verbindung geschieden ist oder ihr Ende
    erfasst ist.
- **Ein gemeinsames Ereignis** (Wohnort, Volkszählung, Militärdienst, Auswanderung, Einwanderung, Einbürgerung, eigenes Ereignis),
  das bei mehreren Personen gleich erfasst ist, ist eine Zeile mit allen diesen Personen. Gleich heißt gleiche Art,
  gleiches Datum, gleicher Ort, gleiche Adresse, Notiz und Quellen; das Datum muss erfasst sein und dazu ein Ort oder
  eine Quelle. Taufe, Beruf oder Titel gehören immer nur einer Person.
- **Ab App 3.28.0:**
  - ein gemeinsames Ereignis ([A10.1](A10-shared-events.md#A10.1)) ist eine Zeile mit allen seinen Personen, auch
    wenn seine Kopien abweichen. Gleiche Kopien ohne gemeinsames Ereignis (ältere Daten) werden weiter nach ihren
    Angaben zu einer Zeile verbunden; das ist nur eine Ansicht, eine Bearbeitung geht in eine Kopie;
  - die Zelle der Personen hat eine Anzahl („N Personen“). Das Alter zeigt das Alter jeder Person („42 · 38“) mit
    dem Tooltip „Alter laut Eintrag · je Person“; weichen die Kopien ab, hat die Zelle „weicht bei N ab“
    ([A10.3](A10-shared-events.md#A10.3));
  - eine Bearbeitung von **Datum** oder **Ort** direkt in der Zelle ändert alle Kopien des gemeinsamen Ereignisses
    („{Feld}: bei N Personen geändert ({Ereignis}).“), ein Schritt **Rückgängig**.
- **Spalten** in den Gruppen **Ereignis** · **Beteiligte** · **Quelle**:
  - **Art**, **Person oder Paar** (beim Paar zuerst der Blutsverwandte der Hauptperson), **Datum**, **Ort**;
  - **Alter beim Ereignis** wie anderswo ([A6.7.3](#A6.7.3)); bis zu einem Jahr aus genauen Daten in Tagen
    („12 T.“); bei mehreren Personen das Alter jeder in der Reihenfolge der Namen („–“ unbekannt); bei der Geburt
    **Trifft nicht zu**;
  - **Angabe**: der Wert des Ereignisses (Beruf, Titel), sonst die Ursache; beim Tod die Todesursache;
  - **Paten**, **Trauzeugen**, **Amtsperson**, **Weitere Anwesende**: die Beteiligten nach Rolle; eine Person des
    Stammbaums ist ein Link;
  - **Quelle**: die zitierten Quellen „Titel, Signatur“, mehrere durch Semikolon getrennt; **Verlässlichkeit** der
    Angabe.
- **Chips:** **Geburten und Taufen** (auch Geburten aus den Angaben der Person), **Heiraten** (auch Verlobung,
  Aufgebot, Erlaubnis, Vertrag), **Sterbefälle und Begräbnisse** (auch Einäscherung), **Andere Ereignisse**, **Ohne
  Quelle**.
- **Filter nach Beteiligten:** ein Klick auf den Namen eines Beteiligten bietet „Filter: Pate …“ an (bei einer Person
  des Stammbaums auch **Person öffnen**). Der Filter ist der Chip „Pate: … ×“ (Zeuge, Amtsperson, Anwesend) und
  ersetzt den vorigen Filter nach Beteiligten. Eine Person des Stammbaums wird nach der Person gesucht, ein
  geschriebener Name nach den Buchstaben ohne Rücksicht auf Groß- und Kleinschreibung, diakritische Zeichen und
  Leerzeichen.
  **Ab App 3.30.0** beginnt das Menü (auch das Panel von unten auf dem Telefon und einem Touch-Gerät) eines
  Beteiligten, der eine Person des Stammbaums ist, mit dem Eintrag **Zu {Name} wechseln**: ein Sprung zu seiner Zeile
  in der Personentabelle ([A6.7.16](#A6.7.16)). Die Namen in der Spalte **Person oder Paar** bleiben, wie sie waren.
- **Ein Pate, der immer wieder auftaucht** ([A5.5](A5-tree-check.md#A5.5)), steht in der Zelle des Beteiligten als
  **Spur**.
- **Bedienung:** die vorgegebene Ansicht **Alle Ereignisse**; die Zeilenaktionen ([A6.7.8](#A6.7.8)) betreffen die
  erste Person der Zeile. **Bearbeiten…** öffnet beim Ereignis einer Person die Bearbeitung der Person bei diesem
  Ereignis (beim gemeinsamen bei der ersten Kopie), bei Geburt und Tod die Bearbeitung der Person, beim Ereignis
  eines Paares dessen Dialog, bei Heirat und Scheidung die Beziehungen der Person in dieser Verbindung.
- **Grenzen:** Platzhalterpersonen haben keine Zeilen; Geburt und Tod ohne erfasste Angabe haben keine Zeile.
- **Gilt seit:** App 3.27.0; 3.28.0: eine Volkszählung bei einer Person ist ein gemeinsames Ereignis, ein
  gemeinsames Ereignis ist eine Zeile; 3.30.0: **Zu … wechseln** im Menü eines Beteiligten

<!-- zdroj: app:src/ui/table-view/table-events.ts buildEventRows (narození/úmrtí jen se zapsaným údajem, weddingRow: manželství vždy kromě marriageUnrecorded, partnersStart jen se zápisem; divorceRow), SHARED_TYPES (od 3.28.0 i census, app:34b2174c), shareKey (typ, vlastní název, datum, místo, adresa, poznámka, prameny; datum a místo nebo pramen), mergeParticipants, eventEditTarget, MARRIAGE_COUPLE_TYPES · table-columns.ts EVENT_COLUMNS, eventPersons (pokrevní první), eventAgeCell, eventAge (dny < 366), eventValueCell, eventSourceCell, eventPill, DEFAULT_VIEWS.events · table-filter.ts EVENT_CHIP_ORDER, EVENT_KIND_CHIPS, lifeCategory, participantChip, eventHasParticipant (foldName), setParticipantFilter · table-ui.ts tableNameAction, tableRowAction (event → editTableEvent) · table-checks.ts PARTICIPANT_ROLE, recurring (recurringGodparent v buňkách účastníků) · 3.28.0: app:80c2ffb9 table-events.ts (shareId → jeden řádek, bez shareId odhad podle shareKey), strings.ts table agePerPerson, sharedDiffers, events.sharedCellChanged · strings.ts table.rows.events, group.event, participants, source, col.ev*, godparents, witnesses, officiants, others, chip.ev*, chipParticipant.*, filterParticipant.*, evKind.*, ageDays, viewName.events · commity 8de751c2, 63ed9def · spec 073 §14.1 · dirigent:prace/1110-app-tabulka-p2 · 3.30.0: app:0b833e3d table-ui.ts tableNameAction (goTo první, i v listu isPhoneBar | isCoarsePointer; jména Osoba nebo pár beze změny), strings.ts table.link.goTo · spec 103 rozhodnutí D6 c -->

<a id="A6.7.11"></a>
### A6.7.11 Quellen in Zeilen

Die Quellentabelle hat eine Zeile für jede Quelle des Stammbaums (**Aktionen → Quellen**,
[A3.1](A3-evidence-in-the-app.md#A3.1)) und sagt, wie viel die Quelle im Stammbaum belegt.

- **Spalten** in den Gruppen **Quelle** · **Verwendung**:
  - **Titel**, **Archiv**, **Signatur**, **Folio/Seite**, **Bild**, **Weitere Fundstelle**
    ([A3.9](A3-evidence-in-the-app.md#A3.9)), **Online** (die Adresse der Quelle, sonst die Seite ihres ersten
    Auszugs, ohne `https://`; eine Webadresse ist ein Link ↗ in ein neues Fenster, nur http und https; eine ohne
    Schema geschriebene („www.…“) öffnet sich über https; ein Klick auf den Link ändert die Auswahl der Zeile nicht);
  - **Personen**: wie viele Personen eine Angabe haben, die die Quelle zitiert; eine Angabe der Verbindung belegt
    beide Partner;
  - **Angaben**: wie viele Angaben die Quelle zitieren. Eine Angabe ist eine Liste von Zitaten: das Zitat der Person,
    Geburt, Tod, jedes Ereignis der Person, Heirat, Scheidung und jedes Ereignis des Paares;
  - **Von der Forschung gelesen**: wie viele Leser die Abschrift gelesen haben („1 Leser“, „2 Leser“: ein Mensch in
    der App und die Forschung), sonst „nein“;
  - **Abschrift**: ja / nein; im Katalog der Spalten gibt es auch **Datum des Eintrags**.
- Vorgegebene Spalten: **Titel**, **Archiv**, **Signatur**, **Folio/Seite**, **Bild**, **Weitere Fundstelle**,
  **Online**, **Personen**, **Angaben**. **Von der Forschung gelesen** und **Abschrift** gibt es nur im Panel
  **Spalten**.
- Eine ältere Quelle hat die ganze Fundstelle in **Weitere Fundstelle** und die neuen Zellen leer. **Signatur**,
  **Folio/Seite** und **Bild** werden natürlich sortiert (9 vor 10, 57–58 nach 34), leere in beiden Richtungen am
  Ende; gefiltert werden sie als Text.
- Über der Tabelle kann das Angebot **Nach Vorschlag aufteilen…** stehen ([A3.9.1](A3-evidence-in-the-app.md#A3.9.1)).
- Zitate von Platzhalterpersonen und Quellen einer Geschichte werden nicht gezählt.
- **Chips:** **Ohne Person** (keine Person zitiert sie), **Ungelesen**, **Mit Abschrift**, **Online** (wie die Spalte
  **Online**, auch mit einer Adresse ohne `https://`).
- **Bedienung:** die vorgegebene Ansicht **Alle Quellen**. An der Zeile **Quelle öffnen** und **Bearbeiten…**; **Im
  Baum zeigen** gibt es hier nicht.
  - **Quelle öffnen** öffnet den Quellenbetrachter (Ausschnitte, Zitate; darin **Bearbeiten**, wenn sich der Stammbaum
    ändern lässt).
  - **Bearbeiten…** (auch Doppelklick, auf dem Telefon **Bearbeiten…** im Panel der Zeile) öffnet direkt die
    Bearbeitung der Quelle, dieselbe wie in der Quellenverwaltung.
  - Nach dem Schließen ist die Tabelle, wie sie war: Auswahl, Bildlaufposition und aktive Zelle. Die
    Quellenverwaltung (**Aktionen → Quellen**) öffnet sich weiter aus dem Menü.
  - Bis App 3.29.0 öffneten **Quelle öffnen** und **Bearbeiten…** die Quellenverwaltung bei dieser Quelle.
- **Grenzen:** in einem schreibgeschützten (auch gesperrten) Stammbaum wird die Quelle nur angezeigt, ohne
  Bearbeitung.
- **Gilt seit:** App 3.27.0; **Signatur**, **Folio/Seite**, **Bild** und **Weitere Fundstelle** (früher **Buch,
  Signatur, Folio**) ebenfalls 3.27.0; Quellenbetrachter und direkte Bearbeitung 3.30.0

<!-- zdroj: app:a97de984 table-columns.ts:898-901 srcSig/srcFolio/srcImageNo, :1026 DEFAULT_VIEWS.sources, přirozené řazení · 8dd21adf table-bar.ts nabídka rozdělení · app:src/ui/table-view/table-sources.ts sourceUsage (PERSON_CITATION_FIELDS, události, PARTNERSHIP_CITATION_FIELDS pro oba partnery, bez zástupných, ne příběh), buildSourceRows (katalog data.sources), sourceReaders (readBy user/research/both) · table-columns.ts SOURCE_COLUMNS, urlCell, shortUrl, readersCell, DEFAULT_VIEWS.sources · table-filter.ts SOURCE_CHIP_ORDER (srcNoPerson persons 0, srcUnread, srcTranscript, srcOnline safeHttpUrl) · table-grid.ts rowTail (source: open + edit) · table-ui.ts tableRowAction (source → openTableSource), openTableSourceId (zamčený strom → showSourceViewer readOnly; od 3.30.0 app:05e24806: bez edit → showSourceViewer, s edit → showEditSourceModal, jen ke čtení → prohlížeč, focusTableAfterSource) · strings.ts table.rows.sources, group.source, group.use, col.src*, chip.src*, readers, act.openSource, viewName.allSources, sources.readBy.* · commity 1a3a49f1, 3cf69ffa · spec 073 §14.2 · dirigent:prace/1110-app-tabulka-p2 · odkaz a čip Online: safeWebUrl (http/https, www. → https, rel noopener noreferrer), commit 7e648e24 (T54 F10, F11) -->

<a id="A6.7.12"></a>
### A6.7.12 Quellenangaben und Paten in der Personentabelle

Die Personentabelle hat Spalten, die zeigen, aus welcher Quelle Geburt, Heirat und Tod stammen und wer Pate war.

- **Quellenangaben** (Gruppe **Quellen**): **Geburt: Archiv**, **Geburt: Signatur**, **Geburt: Folio/Seite**,
  **Geburt: Bild**, **Geburt: weitere Fundstelle**, **Geburt: URL** und dasselbe für **Heirat** und **Tod**, in dieser
  Reihenfolge; vorgegeben sind sie nicht. Die Zelle zeigt den Wert der ersten zitierten Quelle; weitere Quellen stehen
  in der Schaltfläche „+N“. Eine ältere Quelle hat die ganze Fundstelle in **… weitere Fundstelle**. Die Blase
  **Weitere Quellenangaben**, das Panel einer Quellenzeile auf dem Telefon und die Spalte der Quelle in der
  Ereignistabelle nennen auch Signatur, Folio und Bild. Eine Webadresse in der Spalte **… URL** ist ein Link in ein neues Fenster,
  wie in der Spalte **Online** ([A6.7.11](#A6.7.11)).
  - Geburt nimmt die Zitate der Geburt, dann der Ereignisse Geburt und Taufe; Tod die Zitate des Todes, dann der
    Ereignisse Tod, Begräbnis und Einäscherung; Heirat die Zitate der Verbindung (bei einer Unterzeile der
    Verbindung die dieser Verbindung). Jede Quelle einmal.
  - Quellen aus der Herkunft einer Angabe in der Forschung werden nicht gezählt, nur Zitate in den Daten.
  - Bei einer lebenden Person haben die Spalten des Todes **Trifft nicht zu**.
  - Sortiert und gefiltert wird nach der ersten Quelle.
- **Ab App 3.27.0:** Spalten für Signatur, Folio/Seite, Bild und weitere Fundstelle (**… Signatur** zeigte früher die
  ganze Fundstelle).
- **Paten** (Gruppe **Geburt und Taufe**): die Paten der Ereignisse Geburt und Taufe, jeder einmal; eine Person des
  Stammbaums ist ein Link. Ein Pate, der immer wieder auftaucht ([A5.5](A5-tree-check.md#A5.5)), hat in der Zelle
  das Zeichen **Spur**.
- **Bedienung:** die Spalten werden einzeln im Panel **Spalten** eingeschaltet ([A6.7.2](#A6.7.2)). Ein Klick auf
  „+N“ öffnet die Blase **Weitere Quellenangaben** (auf dem Telefon ein Panel von unten); ein Klick auf eine Quelle
  darin öffnet den Quellenbetrachter (darin **Bearbeiten**), bis App 3.29.0 die Quellenverwaltung. Nach dem
  Schließen ist die Tabelle, wie sie war.
- **Gilt seit:** App 3.27.0; Quellenbetrachter 3.30.0

<!-- zdroj: app:src/ui/table-view/table-sources.ts factCitations (narození: birthSourceIds + birth/baptism; úmrtí: deathSourceIds + death/burial/cremation; sňatek: sourceIds svazku; neznámé id ven, každý jednou) · table-columns.ts citeCell (první pramen, moreSources), bArch…dUrl (group sources, unionScoped, deathOnly → naCell), godparentsCell (group birth), personGodparents · table-checks.ts personRecurring (sloupec godparents) · table-grid.ts moreCitesHtml · table-ui.ts showTableCites, openTableSourceId (od 3.30.0 prohlížeč pramene, app:05e24806) · strings.ts table.col.bArch…dUrl (bUrl „Narození: URL“, commit 7e648e24, T54 F10); 3.27.0: a97de984 bSig/bFolio/bImage/bRef…dRef, table-bubble.ts, table-events source text, godparents, moreCites, citesTitle · commity 208d8b92, 21a132c1 · spec 073 §14.3, §14.5 · dirigent:prace/1110-app-tabulka-p2 (citace: jen citace v datech, ne FactReliability.sourceIds) -->

<a id="A6.7.13"></a>
### A6.7.13 Zeichen in den Zellen

Übersicht über alles, womit die Tabelle eine Zelle oder eine Zeile kennzeichnet. Die Legende **Zeichen ⓘ** rechts
über der Tabelle (Blase „Zeichen in den Zellen“, auf dem Telefon ein Panel von unten) zeigt die ersten zwei Tabellen:
vier Stufen eines Befunds und fünf Arten eines Werts; in einem Stammbaum aus der Forschung auch die dritte, die
Zeichen der Forschung.

**Befunde der Prüfung** ([A6.7.5](#A6.7.5)). Das Zeichen steht am Ende der Zelle hinter dem Wert; ein Klick auf eine
Zelle mit Befund öffnet die Blase des Befunds.

| Zeichen | Wie es aussieht | Was es bedeutet (Legende) | Wo es erscheint |
|---|---|---|---|
| **Fehler** | ein voller roter Kreis mit weißem „!“; die Zelle rötlich hinterlegt | „Die Angaben widersprechen sich.“ | die Zelle der Angabe, die der Befund betrifft; **Befunde**, **Höchste Stufe**; eine eingeklappte Gruppe |
| **zu prüfen** | ein volles bernsteinfarbenes Quadrat mit abgerundeten Ecken und „?“; die Zelle bernsteinfarben hinterlegt | „Ein ungewöhnlicher Wert, der geprüft werden sollte.“ | wie Fehler |
| **Spur** | ein kleiner leerer grauer Ring; die Zelle nicht hinterlegt | „Eine Spur für die Forschung, kein Fehler.“ | wie Fehler; ein Pate, der immer wieder auftaucht ([A6.7.10](#A6.7.10), [A6.7.12](#A6.7.12)) |
| **ungewöhnlich** | ein grauer leerer Stern „☆“; die Zelle nicht hinterlegt | „Ein als „Kein Fehler“ markierter Befund.“ | die Zelle der Angabe; **Ungewöhnlich, geprüft**; **Höchste Stufe**, wenn alle Befunde der Person markiert sind |

- Kreis und Quadrat unterscheiden sich in Form und Zeichen, nicht nur in der Farbe. Ein Bildschirmleser liest das
  Zeichen als Stufe und Text des Befunds vor.
- **Befunde** hat das Zeichen der höchsten Stufe hinter der Anzahl; **Höchste Stufe** hat es vor dem Wort. Eine Person
  ohne Befund hat in der Spalte **Befunde** eine blasse „0“.
- Eine eingeklappte Gruppe von Spalten (schmaler Streifen) zeigt das höchste Zeichen aus ihren Zellen.

**Arten eines Werts.** Keine davon ist ein Befund.

| Zeichen | Wie es aussieht | Was es bedeutet (Legende) | Wo es erscheint |
|---|---|---|---|
| **unsicheres Datum** | das Datum gepunktet unterstrichen; das Wort **um**, **vor** oder **nach** in kleinerer grauer Schrift vor dem Datum | „Etwa, vor, nach oder ein Zeitraum; kein Befund.“ | Spalten der Daten ([A6.7.3](#A6.7.3)) |
| **Verlässlichkeit** | der Name der Stufe in Grau (in der Legende **Bestätigt**): **Bestätigt**, **Belegt**, **Wahrscheinlich**, **Möglich**, **Aus dem Stammbaum**, **Hinweis**, **Ohne Quelle** | „In den Spalten Verlässlichkeit und Forschung; bei Verbindungen in der Gruppe Heirat, bei Ereignissen in der Gruppe Quelle.“ | **Verlässlichkeit Name**, **Verlässlichkeit Geburt**, **Verlässlichkeit Tod**, **Verlässlichkeit Heirat** (Personen, Verbindungen), **Verlässlichkeit** (Ereignisse); Stufen: [S7.1](S7-reliability-and-verification.md#S7.1) |
| **Ersatzwert** | die Abkürzung **get.** oder **begr.** in einem kleinen Rahmen vor dem Wert, der Wert kursiv; Hinweis „Taufe, Geburt unbekannt“, „Begräbnis, Tod unbekannt“ | „Taufe statt Geburt, Begräbnis statt Tod.“ | Datum und Ort von Geburt und Tod ([A6.7.3](#A6.7.3)) |
| **berechnet** | graue Schrift; „≈ 67“ eine Schätzung, „28–29“ ein Bereich | „Ein Bereich aus ungenauem Datum, ≈ aus einer Schätzung.“ | Alter, Abweichung des angegebenen Alters, Dauer der Verbindung, Anzahlen, Generation, Vollständigkeit; am Spaltenkopf „Berechnet aus: …“ |
| **trifft nicht zu** | „–“ in grauer Kursivschrift, in der Legende ebenso; Hinweis „Trifft nicht zu“ | „Betrifft die Person nicht.“ | der Tod bei einer lebenden Person (bei **Vollständigkeit Sterbefall** „lebt“), das Alter des Vaters oder der Mutter ohne erfassten Elternteil, die Spalten der Verbindung bei einer Person ohne Verbindung, die Zellen der Heirat bei einer Verbindung ohne Heirat (Hinweis „Trifft nicht zu: Verbindung ohne Heirat“, [A6.7.4](#A6.7.4)), **Alter beim Ereignis** bei der Geburt |

- In den Spalten **Verlässlichkeit …** wird von **Bestätigt** bis **Ohne Quelle** in der Reihenfolge aus der Tabelle
  sortiert.

**Zeichen der Forschung** ([A6.7.14](#A6.7.14)), nur in einem Stammbaum aus der Forschung. Der Kreis der Forschung hat
einen Rand, so dass er sich auch ohne Farbe vom Kreis des Fehlers (ohne Rand) und vom Quadrat „zu prüfen“
unterscheidet. Die Legende ergänzt: „Ein Kreis mit Rand steht für die Forschung. ! und ? der Forschung stehen nur in
den Spalten Forschung, an einer Angabe nur ≠.“

| Zeichen | Wie es aussieht | Was es bedeutet (Legende) | Wo es erscheint |
|---|---|---|---|
| **wartet** | ein voller bernsteinfarbener Kreis mit Rand und „!“ | „Die Forschung wartet auf eine Entscheidung.“ | **Forschung**, **Wartet auf Entscheidung** |
| **wartet auf andere** | ein leerer bernsteinfarbener Ring mit „!“ | „Eine Antwort von außen steht aus (Brief, Archiv); zu entscheiden gibt es nichts.“ | **Forschung**, **Wartet auf Entscheidung** |
| **Widerspruch** | ein voller bernsteinfarbener Kreis mit Rand und „≠“ | „Die Quellen stimmen nicht überein. Das ist kein Fehler in den Daten: Es geht darum, welcher Quelle man folgt.“ | vor dem Wert in der Zelle der Angabe (ohne Hinterlegung, ein Klick öffnet die Widersprüche); **Forschung**, **Widersprüche** |
| **Frage** | ein voller bernsteinfarbener Kreis mit Rand und „?“ | „Eine offene Frage oder eine Hypothese.“ | **Forschung**, **Hypothesen** |
| **Agent** | ein sich drehender Bogen (bei reduzierter Bewegung steht er still) | „Der Agent arbeitet gerade an der Person (nur beim Verfolgen).“ | **Forschung**, **Agent**; am Namen der Person ein senkrechter Balken von 3 px |
| **fertig** | „✓“ | „Der Agent hat die Arbeit beendet (4 s lang).“ | hinter dem Namen, **Agent** |

- In der Spalte **Forschung** hat eine Person in der Warteschlange des Agenten einen grauen Punkt „·“ mit „in der
  Warteschlange“; „+2“ hinter dem Zeichen sind weitere Arten von Signalen. Neu aus der Forschung hat in seiner Spalte
  den Punkt „•“.
- Eine Spalte, die nur beim Verfolgen der Forschung einen Wert hat, hat ohne Verfolgen „–“ mit dem Etikett „live“
  (Hinweis „Nur beim Verfolgen der Forschung“). Ab App 3.27.0 nur dann, wenn auch die Brücke der Forschung nicht
  antwortet ([A6.7.14](#A6.7.14)).

**Weitere Zeichen** (die Legende zeigt sie nicht):

| Zeichen | Wie es aussieht | Was es bedeutet | Wo es erscheint |
|---|---|---|---|
| „…“ | drei blasse Punkte; Hinweis „Prüfungen laufen…“ | die Prüfung des Stammbaums läuft noch | **Befunde**, **Höchste Stufe**, **Ungewöhnlich, geprüft** |
| „◌ Prüfungen laufen…“ | ein leerer Ring und Text rechts über der Tabelle | dasselbe für die ganze Tabelle; die Chips der Befunde warten noch | über der Tabelle, neben **Zeichen ⓘ** |
| Prozent mit Balken | eine Zahl und ein kurzer Balken, dessen gefüllter Teil der Wert ist | Vollständigkeit ([A6.7.4](#A6.7.4)) | Spalten **Vollständigkeit …** |
| fette Zahl, „–“ | in der Abdeckungszeile | Abdeckung unter 50 % (bei den Spalten der Vollständigkeit ein Durchschnitt unter 50 %); „–“ eine Spalte ohne eine Zelle, die sie betreffen würde | **Abdeckungszeile** ([A6.7.4](#A6.7.4)) |
| „+2“ | eine Zahl in einem ovalen Rahmen hinter dem ersten Zitat | weitere zitierte Quellen; ein Klick öffnet **Weitere Quellenangaben** | Quellenangaben zu Geburt, Heirat, Tod ([A6.7.12](#A6.7.12)) |
| „↗“ | hinter einer unterstrichenen Webadresse | ein Link in ein neues Fenster | **Online**, Quellenangaben „… URL“ ([A6.7.11](#A6.7.11), [A6.7.12](#A6.7.12)) |
| Umriss der Zelle | ein dünner Umriss von 1 px | die aktive Zelle ([A6.7.15](#A6.7.15)) | eine Zelle der ausgewählten Zeile |
| Textcursor | beim Überfahren mit der Maus | die Zelle lässt sich an Ort und Stelle bearbeiten ([A6.7.15](#A6.7.15)) | bearbeitbare Zellen |
| ●○, ●● | ein oder zwei volle Punkte vor „1 Leser“, „2 Leser“; Hinweis, wer die Abschrift gelesen hat | wie viele Leser die Abschrift gelesen haben | **Von der Forschung gelesen** ([A6.7.11](#A6.7.11)) |
| „12 T.“ | eine Zahl mit „T.“ | ein Alter bis zu einem Jahr in Tagen | **Alter beim Ereignis** ([A6.7.10](#A6.7.10)) |
| ▾, ▸ | ein Dreieck vor dem Namen | die Verbindungen der Person aufgeklappt, zugeklappt ([A6.7.1](#A6.7.1)) | **Vollständiger Name** einer Person mit zwei und mehr Verbindungen |
| „3 Verbindungen“ | bei einer zugeklappten Person in einem ovalen Rahmen hinter dem Namen; bei einer aufgeklappten in der Spalte **Partner** in grauer Kursivschrift | die Zahl der Verbindungen der Person | Zeile der Person |
| „└ Verbindung 2 von 3“ | eine eingerückte Unterzeile | eine Verbindung der Person | Unterzeile der Verbindung |
| „2 Verbindungen außerhalb des Filters · zeigen“ | eine Schaltfläche in einer eingerückten Zeile | Verbindungen, die dem Filter nicht entsprechen; gezeigte sind abgeschwächt | unter den Unterzeilen der Verbindungen |
| „passt nicht mehr“ | die ganze Zeile blass, Text kursiv am Ende | die Zeile entspricht nach einer Bearbeitung dem Filter nicht mehr ([A6.7.8](#A6.7.8)) | bis zur nächsten Änderung der Sortierung, des Filters oder der Ansicht |
| Hervorhebung | hinterlegte Schrift des Treffers | ein Treffer der Suche ([A6.7.6](#A6.7.6)) | sichtbare Spalten |
| ↑, ↓ (↑1, ↓2) | ein Pfeil im Spaltenkopf, mit Nummer bei mehreren Schlüsseln | Richtung und Reihenfolge des Schlüssels der Sortierung ([A6.7.6](#A6.7.6)) | Spaltenkopf |
| −, + | ein Zeichen beim Namen der Gruppe | eine Gruppe von Spalten einklappen, ausklappen ([A6.7.2](#A6.7.2)) | Zeile der Gruppen über dem Spaltenkopf |

- **Grenzen:** der CSV-Export trägt weder Zeichen noch Farben; XLSX trägt nur die Hinterlegung und den Kommentar bei
  Fehler und zu prüfen ([A6.7.9](#A6.7.9)).
- **Bedienung:** **Zeichen ⓘ** rechts über der Tabelle.
- **Gilt seit:** App 3.27.0

<!-- zdroj: app:src/ui/table-view/table-grid.ts MARK_GLYPH (error „!“, warning „?“, info prázdný, unusual „☆“), markHtml (role img, aria-label úroveň: text), cellClasses (aggregate, na, computed, uncertain, subst, ghost, issue), cellText („–“), cellInner (značka za hodnotou; u čísla vpravo za, jinak před slovem), moreCitesHtml „+N“, cellValueCore (tv-comp proužek 30 px, tv-subst, tv-qual), linkHtml „ ↗“, readersHtml (fs-dots), nameCell (▾/▸, tv-unions-pill unionsN, └ unionKofN, hiddenUnions), sort mark ↑/↓ s číslem, tv-group-toggle −/+ · table-bubble.ts legendHtml (4 značky + uncertain „1890–1892“, reliability ✓, subst křt., computed „≈ 67“, na „–“) · table-bar.ts createStatus (◌ checksRunning, legenda „Značky ⓘ“) · table-columns.ts checksPendingCell („…“ ghost), findingsCell („0“ ghost), topSeverityCell, unusualCell (☆), pillCell + reliabilityText + RELIABILITY_RANK (human, proven, probable, possible, import, lead, none), readersCell (dots [true, n > 1]), naCell (relD, fAge, mAge, unionScoped bez svazku, evAge narození), eventAge (ageDays) · table-subrows.ts aggregate „n svazků“ · table-checks.ts bandSeverity · table-coverage.ts LOW pod 50 % · index.html CSS .tv-mark--error (kolečko 16 px, --danger), --warning (čtverec radius 3px, --warning), --info (kroužek 10 px, okraj --text-faint), --unusual, .tv-cell--error/--warning (danger-soft, warning-soft), --uncertain (dotted), --na (kurzíva), --computed, .tv-subst, .tv-cites-more, .tv-row.is-stale, .tv-stale-note, mark.tv-hit · strings.ts table.legend, legendTitle, legendKind.*, legendText.*, sev.*, subst.*, qual.*, na, living, checksRunning, moreCites, citesTitle, readers, ageDays, unionsN, unionKofN, hiddenUnions, staleRow, col.relN/relB/relD/relW/evRel, reliability.human/proven/import/none, factStatus.probable/possible/lead · app f34d41e1 · Milan 10. 11. (dirigent:prace/1110-doc-tabulka-znacky bod 1) · pořadí stupňů podle RELIABILITY_RANK (Z rodokmenu před Vodítko), dirigent:prace/_drobnosti/doc.md · značky výzkumu: table-grid.ts RESEARCH_GLYPH (wait „!“, ext „!“, conf „≠“, q „?“, agent oblouk, done „✓“, queue „·“, new „•“), researchMarkHtml, conflictMarkHtml (≠ před hodnotou) · index.html .tv-rmark--wait/conf/q (kolečko 16 px, --signal-warn, lem box-shadow), --ext (prázdný kroužek), --agent (agSpin, prefers-reduced-motion), --done, .tv-agent-bar (3 px) · strings.ts table.res.legendName, legendText, legendNote, liveTag, liveOnly · aktivní buňka a kurzor: commity 05d9a9ab, be9ca8cd · spec 073 §16.3, U7 -->

<a id="A6.7.14"></a>
### A6.7.14 Die Forschung in der Tabelle

In einem Stammbaum aus der Forschung ([S1](S1-connecting-app-and-research.md)) zeigt die Tabelle auch, was die
Forschung über die Personen weiß: was auf Entscheidung wartet, Widersprüche der Quellen, Hypothesen, die Arbeit des
Agenten, die Linien und den Austausch mit dem Stammbaum. In den Stammbaum schreibt sie nichts.

- **Spalten der Personen** (Gruppe **Forschung**, standardmäßig ausgeblendet; das Kästchen **alle** schaltet
  **Forschung**, **Wartet auf Entscheidung**, **Widersprüche**, **Hypothesen** und **Agent** ein):

  | Spalte | Was sie zeigt |
  |---|---|
  | **Forschung** | das dringendste Signal der Person in der Reihenfolge wartet › Widerspruch › Frage oder Hypothese › Agent › in der Warteschlange; „+n“ weitere Arten |
  | **Wartet auf Entscheidung** | die Anzahl und der erste Eintrag; beim Warten auf andere „von außen: …“ (Brief gesendet, Anfrage in der Familie …) |
  | **Widersprüche** | die Zahl der offenen Widersprüche und die Angaben („· Geburt, …“); „· in der App entscheidbar“, wo das geht ([S2](S2-edits-from-the-app.md)) |
  | **Hypothesen** | die Zahl der offenen Hypothesen; „vom Agenten entschieden“ |
  | **Forschungsaufgaben** | die Aufgaben der Person in der Warteschlange („2 · nächste Nr. 3 in der Warteschlange“, „1 · läuft gerade“) |
  | **Agent** | „arbeitet: {Aufgabe}“, „in der Warteschlange“, „fertig“ |
  | **Forschungslinie** (bis App 3.29.0 **Linie**) | der Platz der Person zwischen den Linien (unten) |
  | **Materialien**, **Baum endet hier**, **Gesucht, nichts gefunden**, **Austausch mit der Forschung**, **Ursprünglich im Stammbaum**, **Geschichte**, **Wo es bearbeitet wird**, **Neu aus der Forschung**, **Verfügbarkeit der Quellen**, **Pfarrei (Forschung)**, **Geschätzte Geburt** | was die Forschung über die Materialien der Person weiß, über den Rand des Stammbaums, über den Austausch mit dem Stammbaum, über Quellen und Orte |

- **Verbindungen:** **Forschungs-ID** (F…), **Forschungslinie** (nach dem Partner aus der Linie), **Agent** („arbeitet
  am Paar: …“) und **Widersprüche** (Widersprüche zu Heirat und Scheidung bei beiden Partnern). **Quellen:**
  **Forschungs-ID** (S…) und **Scan**: „auf dem Rechner der Forschung“, „Scan fehlt auf dem Rechner der Forschung“
  (hervorgehoben), „online (Archiv)“.
- **Forschungslinie:** in einer Linie (der Partner einer Person aus der Linie „· Partner“; ein zur Linie hinzugefügter
  Seitenzweig gehört zu dieser Linie), „Seitenzweig: {Name}“, „Insel“, „außerhalb der Linien“. **Außerhalb der
  Linien** sind nicht zu einer Linie hinzugefügte Seitenzweige, Inseln und die übrigen
  ([R2.3](R2-lines-and-queue.md#R2.3)). Die Linien nimmt die Tabelle live aus der Forschung, sonst aus der Datei der
  Forschung; sortiert wird in der Reihenfolge der Linien der Forschung, dann Zweige, Inseln und außerhalb der Linien,
  darin nach der Generation. Die Spalte und die Chips der Linien gibt es nur bei einer Forschung mit Linien.
- **Widerspruch an einer Angabe:** die Zelle einer Angabe mit offenem Widerspruch der Quellen hat vor dem Wert „≠“,
  ohne Hinterlegung. Ein Klick auf „≠“ öffnet die Blase mit den Widersprüchen; ein Bildschirmleser liest „{Wert},
  Widerspruch der Quellen: {Angabe}“. Die Zeichen „!“ und „?“ der Forschung stehen nur in den Spalten der Forschung
  ([A6.7.13](#A6.7.13)).
- **Chip Forschung ▾:** ein Chip mit einem Menü in den Abschnitten **Signale**, **Linien**, **Austausch, Quellen und
  Orte**, **Weitere Filter der Forschung** und **Neu aus der Forschung**; „Eine Auswahl öffnet den Block Forschung in
  der Leiste.“ Chips: **Wartet auf Entscheidung**, **Mit Widerspruch**, **Mit offener Frage**, **Agent arbeitet /
  wartet**, einer für jede Linie und **Außerhalb der Linien** (mit Anzahlen), **Nicht gesendet**, **Von der Forschung
  geändert**, **Hier zu entscheiden**, **Wartet auf andere**, **Neu aus der Forschung** (letzte 24 Std., letzte
  7 Tage, seit dem letzten Öffnen), **Nur im Lesesaal**, **Ort unbestimmt**, **Vom Agenten entschieden**, **Pausiert /
  zurückgestellt**, **Baum endet hier**. Auf dem Telefon ist der Abschnitt **Forschung** im Panel **Filter**, seltenere
  Chips unter **Weitere Forschung (n)**.
- **Vorgegebene Ansichten** (Abschnitt **Forschung** im Menü **Ansicht**; wie die anderen vorgegebenen ändern sie sich
  nicht, [A6.7.7](#A6.7.7)):

  | Ansicht | Was sie zeigt |
  |---|---|
  | **Forschung** | Personen mit einem Signal: Name, Forschung, Wartet auf Entscheidung, Widersprüche, Hypothesen, Agent, Forschungsaufgaben, Geburt, Tod; vom dringendsten an sortiert, dann nach dem Namen |
  | **Linie: {Linie}** (für jede Linie) und **Außerhalb der Linien** | Name, Forschungslinie, Generation, Forschung, Geburt, Tod, Widersprüche, Agent; Chip der Linie; nach der Linie sortiert |
  | **Austausch mit der Forschung** | Personen mit einem Austausch: Name, Austausch mit der Forschung, Ursprünglich im Stammbaum, Neu aus der Forschung, Widersprüche, Geburt |

  Die Verbindungen sind darin zugeklappt und die Abdeckungszeile eingeschaltet. Eine leere Ansicht sagt „Die
  Forschung braucht gerade nichts“ oder „Baum und Forschung sind abgeglichen“.
- **Blase der Forschung:** ein Klick auf eine Zelle der Forschung öffnet eine Blase (auf dem Telefon ein Panel von
  unten) mit Abschnitten danach, was die Person hat: **Wartet auf Entscheidung · n** (**Versionen vergleichen ›**,
  **Wartet auf Bearbeitung ›**), **Wartet auf andere**, **Widersprüche der Quellen · n** (**Entscheiden ›**),
  **Hypothesen** oder **Offene Frage** (**Was die Forschung weiß ›**, [S3.5](S3-what-the-research-knows.md#S3.5)),
  **Agent arbeitet** (**Forschung verfolgen ›**), **Forschungsaufgaben in der Warteschlange** (**Aufgabe in der
  Forschung öffnen**), **Materialien ›**, **Linie** oder **Außerhalb der Linien** (**Linie im Baum zeigen**, **In der
  Forschung ändern**), **Ursprünglich im Stammbaum** (**Wert aus dem Stammbaum wiederherstellen**, nur mit der
  Forschung auf diesem Rechner) und **Verfügbarkeit der Quellen**. Eine Aktion, die in der Forschung bestätigt wird,
  hat ein Zeichen wie anderswo ([S4.5.1](S4-research-from-the-app.md#S4.5.1)).
- **Live:** beim Verfolgen der Forschung ändern sich nur die Zellen, die die Änderung betrifft; die Reihenfolge der
  Zeilen bleibt. Am Namen der Person, an der der Agent arbeitet, läuft ein senkrechter Balken. Über der Tabelle steht
  „● Forschung live verfolgt“, sonst „Forschung: Stand vom {wann}“.
- **Export:** CSV und XLSX tragen Texte und Anzahlen („wartet; Widerspruch (1)“, „1: Geburt“, ohne Widerspruch „0“),
  ohne Zeichen. Ohne Verfolgen (ab App 3.27.0 nur ohne Antwort der Brücke) sind **Agent** und **Forschungsaufgaben**
  leer, und die Meldung sagt „Agent und Forschungsaufgaben sind leer: Die Forschung wird nicht verfolgt.“ Die
  Abdeckungszeile hat bei den Spalten der Forschung „–“.
- **Grenzen:**
  - ohne Agenten (Strom-Archiv) und in einem schreibgeschützten Stammbaum gibt es weder **Wartet auf Entscheidung**,
    **Forschungsaufgaben** und **Agent** noch die Chips **Nicht gesendet** und **Hier zu entscheiden**; die Ansicht
    **Austausch mit der Forschung** gibt es nur in einer Forschung mit Agenten, die sich ändern lässt;
  - **Agent** und **Forschungsaufgaben** haben nur beim Verfolgen der Forschung einen Wert, sonst „–“ mit dem Etikett
    „live“; der Chip **Agent arbeitet / wartet** filtert ohne Verfolgen nicht. Ab App 3.27.0 gilt beides nur ohne
    Antwort der Brücke (unten);
  - in einem schreibgeschützten Stammbaum hat die Blase keine Aktionen: „Schreibgeschützt: Widersprüche lassen sich
    hier nicht entscheiden.“
- **Ohne Verfolgen mit Brücke:** antwortet die Brücke der Forschung auf diesem Computer, nehmen **Agent** und
  **Forschungsaufgaben** (auch der Balken am Namen, der Chip **Agent arbeitet / wartet** und der Export) die Arbeit
  des Agenten und die Warteschlange aus der regelmäßigen Abfrage der Brücke und sehen aus wie beim Verfolgen. Eine
  leere Warteschlange der Brücke lässt die Zellen leer. Die Tabelle wird neu gezeichnet, wenn sich die Antwort der
  Brücke ändert. Das Telefon fragt die Brücke nicht. Genauso funktioniert die Forschungsübersicht ohne Verfolgen
  ([S4.1.5](S4-research-from-the-app.md#S4.1.5)).
- **Bedienung:** Panel **Spalten** → Gruppe **Forschung**; Chip **Forschung ▾**; **Ansicht** → Abschnitt
  **Forschung**; **Zeichen ⓘ**.
- **Gilt seit:** App 3.27.0 mit Forschung 1.31.0
- **Ab App 3.30.0:** Forschung in der Tabelle eines weiteren Fensters, die Zeile des Agenten und das Scrollen zu ihr,
  der Hinweis „Der Forschungsfilter wird gerade nicht angewendet“: [A6.7.18](#A6.7.18).

<!-- zdroj: app:src/ui/table-view/table-research.ts RESEARCH_COLUMNS, RESEARCH_DEFAULT_COLUMNS (rSum, rWait, rConf, rHyp, rAgent), LIVE_ONLY (rTasks, rAgent), NEEDS_AGENT (rWait, rTasks, rAgent), rSum pořadí (čeká 5 › rozpor 4 › otázka 3 › agent 2 › fronta 1), researchLinesOf (živě /directions/people, jinak soubor _STROM_DIRECTION), personLineRole, isOffLine, researchChips, RESEARCH_SIGNAL_CHIPS, RESEARCH_MORE_CHIPS, researchChipOffer (xUnsent, xDecideHere jen research a ne jen ke čtení), researchChipActive (live), unionLineRole, unionResearchCell (UNION_FACTS), sourceImageCell, unionResearchIdCell, sourceResearchIdCell · table-views.ts pohledy Výzkum, Linie, Mimo linie, Výměna s výzkumem · table-research-bubble.ts, table-research-ui.ts · table-grid.ts conflictMarkHtml · table-export.ts (exportNotLive) · strings.ts table.res.*, table.col.r*, uResearchId, srcResearchId, srcImage · commity 53137620, 99b60acb, a2e1dc73, 02e88e9a, 32958eb4, fd9c220f, cf9e63d8, 4635c16e, 5857be6b, 970e6b88, 6b66e037, 9e51ff66 · research: GET /directions/people, funkce directions.places, brána APP_SHOWS_RESEARCH_TABLE (src/core/stromapp.ts), CHANGELOG.cs.md 1.31.0 „Výzkum v tabulce aplikace Strom“ · spec 073 §16, K7.1–K7.8 · bez sledování s mostem: app 8d564b35 src/ui/research-ui.ts unfollowedAgentNow (onComputer, researchStatusNow, status.working a queue), src/ui/table-view/table-ui.ts tableResearchAgentChanged · spec 057 K1.12 -->

<a id="A6.7.15"></a>
### A6.7.15 Aktive Zelle, Zellenmenü und Bearbeiten an Ort und Stelle

Ein Klick auf eine Zelle wählt die Zeile aus und macht die Zelle zur aktiven Zelle (dünner Umriss); die Pfeiltasten
verschieben sie. Die aktive Zelle lässt sich kopieren, nach ihrem Wert filtern und die Angabe in ihr direkt in der
Tabelle bearbeiten.

- **Kopieren:** Strg/Cmd+C ohne ausgewählten Text kopiert den Text, den die aktive Zelle zeigt, ohne Zeichen, Symbole
  und Marken. Von Hand ausgewählter Text wird wie gewohnt kopiert.
- **Zellenmenü:** das Zeilenmenü (rechte Maustaste, Umschalt+F10) und das Panel der Zeile (Tippen mit dem Finger auf
  die Zelle) beginnen mit den Möglichkeiten der Zelle **Kopieren**, **Nur „{Wert}“** und **Ohne „{Wert}“** (der Wert
  auf etwa 24 Zeichen gekürzt, mit „…“); darunter stehen die Zeilenaktionen ([A6.7.8](#A6.7.8)). Das Menü öffnet sich
  an der Zelle, auch wenn eine andere Zeile ausgewählt war.
  - **Nur** und **Ohne** setzen den Filter der Spalte **ist** / **ist nicht** ([A6.7.6](#A6.7.6)), Chip „{Spalte} =
    {Wert} ×“ oder „{Spalte} ≠ {Wert} ×“; verglichen wird ohne Rücksicht auf Groß- und Kleinschreibung und
    diakritische Zeichen. Eine Zelle mit dem Namen einer Person vergleicht die Person: **Nur „{Vater}“** in der Spalte
    **Vater** zeigt die Geschwister, nicht die Kinder eines Namensvetters.
  - Eine leere Zelle bietet **Nur leere** und **Nur ausgefüllte**, eine Zelle mit einer Werteliste setzt den Filter
    der Werte. Eine Zelle ohne einen einzelnen Wert zum Vergleichen (Zeichen der Forschung, mehrere Namen,
    Vollständigkeit, Zahl der Verbindungen) bietet nur **Kopieren**; der eigene Name oder Titel der Zeile hat nur die
    Zeilenaktionen.
  - Der Filter wird mit der Ansicht gespeichert ([A6.7.7](#A6.7.7)).
  - **Ab App 3.30.0:** **Ohne** fügt einen weiteren Ausschluss neben den früheren hinzu, und ein zweites **Nur** in
    einer Spalte fügt seinen Wert hinzu („= A oder B“), statt den Filter der Spalte zu ersetzen ([A6.7.6](#A6.7.6)).
    Eine Zelle mit dem Namen einer Person ist ein Link zu ihrer Zeile ([A6.7.16](#A6.7.16)); das Zeilenmenü hat
    zusätzlich **Zeile anheften** ([A6.7.17](#A6.7.17)).
- **Bearbeiten an Ort und Stelle:** bearbeiten lässt sich eine Zelle, die für eine Angabe des Stammbaums steht:
  - **Vorname**, **Nachname** (zeigt er den Ehenamen, wird dieser bearbeitet), **Geburtsname**, **Ehename**;
  - **Geschlecht** durch Auswahl (**Männlich**, **Weiblich**, **Unbekannt**) und **Ref.-Nummer**;
  - Datum und Ort von Geburt, Taufe, Tod und Begräbnis, **Todesursache** und **Eingetragenes Sterbealter**;
  - **Beruf**, solange die Person höchstens einen hat;
  - die Angaben der Verbindung (Verbindungstabelle, Unterzeile der Verbindung, Zeile einer Person mit einer
    Verbindung): **Stand der Verbindung** durch Auswahl (**Verheiratet**, **Partner**, **Geschieden**, **Getrennt**, wie
    im Formular der Verbindung), Datum und Ort der Heirat, das eingetragene Alter jedes Partners bei der Heirat
    (**Eingetragenes Heiratsalter**, **Eingetragenes Alter des Partners**, **Eingetragen 1** und **2**),
    **Scheidungsdatum** und **Scheidungsort**. Eine leere Zelle legt die Angabe der Verbindung an, wie sie das Formular
    der Verbindung anlegt. Bei einer Verbindung ohne Heirat ([A6.7.4](#A6.7.4)) werden die Zellen der Heirat nicht
    bearbeitet.

  **Vollständiger Name** wird in der Zelle nicht bearbeitet (er besteht aus mehreren Teilen), ebenso wenig berechnete Zellen,
  Prüfungen, Forschung, Quellenangaben, Anzahlen und Beziehungen; ein Doppelklick darauf öffnet **Bearbeiten…**.
- **Das Feld** steht in der Zelle. Nur in einer Spalte, die schmaler ist als die kleinste Breite des Felds (Text und
  Datum 100 px, Ort 140 px, Auswahl 90 px), ist das Feld breiter und liegt mit einem Schatten über der Zeile (ab App
  3.28.0; vorher lag es über der nächsten Zelle). **Enter** speichert, **Esc** bricht ab, **Tab** und **Umschalt+Tab** speichern und
  gehen zur nächsten oder vorigen bearbeitbaren Zelle der Zeile, ein Klick anderswohin speichert. In einer Auswahl speichert ein
  Mausklick den Wert sofort; nach der Wahl mit den Pfeilen speichern ihn Enter, Tab oder ein Klick anderswohin. Das
  Datum wird wie im
  Formular der Person gelesen; ein unlesbares bleibt im Feld mit dem Fehler „Das Datum ist nicht lesbar (z. B.
  15.5.1880, 1880, um 1880)“. Der Ort bietet die Orte des Stammbaums an. Ohne Vor- und Nachname wird nichts
  gespeichert: „Vor- oder Nachname muss bleiben“.
- **Das Speichern** geht denselben Weg wie das Formular der Person (die Angaben der Verbindung wie das Formular der
  Verbindung) und ist ein Schritt zurück (Strg/Cmd+Z), auch wenn eine leere Zelle die Angabe angelegt hat. Taufe und
  Begräbnis bearbeiten das erste solche Ereignis (seine übrigen Angaben und Zitate bleiben) oder fügen eines hinzu;
  ein leeres Feld löscht nur diese Angabe. Dann blinkt die Zeile, bleibt an ihrem Platz, und die Meldung sagt
  „Gespeichert: {Name}“.
- **Grenzen:** an Ort und Stelle lässt sich nicht bearbeiten in einem schreibgeschützten oder gesperrten Stammbaum,
  im Strom-Archiv, auf dem Telefon und bei einer gesperrten Person. Auf dem Telefon wird eine Angabe über das Panel
  der Zeile → **Bearbeiten…** bearbeitet.
- **Bedienung:** Doppelklick, **F2**, **Enter** auf der aktiven Zelle (bei einer Zelle mit Befund öffnet Enter zuerst
  die Blase des Befunds), im Zeilenmenü **Zelle bearbeiten** (F2). Eine bearbeitbare Zelle hat beim Überfahren mit der
  Maus einen Textcursor.
- **Gilt seit:** App 3.27.0

<!-- zdroj: app:src/ui/table-view/table-grid.ts copyKey (Ctrl/Cmd+C, copyPlainText), F2, Enter (has-issue → onIssue, has-finds → onFindings, jinak startEditAt, jinak open), Escape, Tab · table-ui.ts showTableRowMenu (cellPart, cell-edit „Upravit buňku“ s F2), tableCellChoices, tableCellSheetBlocks, :1663 úprava na místě ne v jen ke čtení, archivu, na telefonu (isPhoneBar) · table-edit.ts editTargetOf, PERSON_FIELDS (surname: marriedSurname || lastName, birthSurname, marriedSurname, bDate…burPlace, occ), UNION_FIELDS (wDate, wPlace), editChangeOf (normalizeDateInput, první křest a pohřeb, prázdné pole smaže jen údaj, beze jména neuloží) · strings.ts table.cell.copy, only, without, edit, badDate, nameNeeded, editLabel, onlyEmpty, onlyFilled, matchEquals, matchNotEquals, savedToast · commity 05d9a9ab, be9ca8cd, 28aabdc8 · spec 073 U9 (T54 F4, F8, F9) · T54 2. kolo: table-edit.ts PERSON_FIELDS (firstName, gender, refn, dCause, dAgeRec), UNION_FIELDS (wAgeRec, pAgeRec, rec1, rec2, divDate, divPlace, uStatus), WEDDING_FIELDS (ne u unionWithoutWedding), editOptionsOf (GENDERS, UNION_STATUSES v pořadí formuláře svazku), table-grid.ts select (klik myší uloží hned), commity 8fdf52ca, 79764eba (T54 G3, G10) · nabídka u buňky jiného řádku: commit 400ccda8 (T54 G7) · pole v buňce: table-grid.ts EDITOR_MIN_WIDTH (text 100, date 100, place 140, select 90), placeEditor, commit 80c2ffb9 · panel klepnutím: commit ee38c7a6 · 3.30.0: app:ec39d469 table-ui.ts tableCellChoices (addOnlyFilter, addWithoutFilter) -->

<a id="A6.7.16"></a>
### A6.7.16 Links zu Personen und Sprünge ‹ ›

In der Personen- und der Verbindungstabelle ist der Name einer Person des Stammbaums in einer Zelle ein Link zu ihrer
Zeile. So führt der Weg von Vater, Mutter, Partner, Pate oder Zeuge ohne Suchen zu deren Zeile und zurück.

- **Wo:** Zellen der Personen- und der Verbindungstabelle, die eine Person des Stammbaums nennen: **Vater**,
  **Mutter**, **Partner**, Paten, Zeugen, Partner der Verbindung. Der eigene Name der Zeile (**Vollständiger Name**)
  ist kein Link. Der Name sieht aus wie der Text der Zelle und wird nur unter dem Mauszeiger unterstrichen; der
  Tooltip zeigt den vollständigen Namen. Mehrere Namen in einer Zelle haben jeder einen eigenen Link.
- **Sprung:** führt immer in die Personentabelle (auch aus der Verbindungstabelle). Die Zeile der Person steht in der
  Mitte, die Spalte rollt ins Blickfeld, die Zelle ist aktiv, und die Zeile blinkt kurz. Die Zielzelle:
  - über einen Partner die Zelle **Partner** in der Zeile dieser Verbindung (die Verbindung klappt auf); in ihr ist
    der Name markiert, von dem der Sprung kam, solange die Zelle aktiv ist;
  - sonst die Zelle **Vollständiger Name**; auch wenn die Spalte **Partner** nicht sichtbar ist.
- **‹ ›:** am Anfang der Leiste der Tabelle ab dem ersten Sprung. ‹ bringt Zeilenart, Bildlaufposition und Zelle
  zurück, von denen der Sprung ausging, und klappt die Verbindung zu, die der Sprung aufgeklappt hat; › wiederholt den
  Sprung. Der Tooltip sagt, wohin („Zurück zu Jan Horák“, „Weiter zu Marie Vlková“); ohne Schritt in diese Richtung
  ist die Schaltfläche ausgeschaltet. Schritte sind nur Sprünge über Namen, keine Änderung von Zeilenart, Ansicht oder
  Filter von Hand. Der Speicher fasst 50 Schritte, und jedes Fenster ([A6.8](#A6.8)) hat seinen eigenen; ein anderer
  Stammbaum beginnt ihn neu.
- **Eine von Filter oder Suche ausgeblendete Person:** der Sprung wird nicht ausgeführt, und unter der Leiste
  erscheint der Streifen „Vom Filter ausgeblendet: {Name}.“:
  - **Vorübergehend zeigen** zeigt die Zeile an ihrem Platz in der Sortierung, gedämpft mit „außerhalb des
    Filters“, außerhalb der Zeilenzahl. Sie verschwindet mit einer Änderung von Filter, Sortierung, Ansicht oder
    Zeilenart und mit ‹;
  - **Filter aufheben** schaltet Filter und Suche aus und führt den Sprung aus;
  - × oder Esc schließt den Streifen, nichts ändert sich.
  - eine Person, deren Zeile angeheftet ist ([A6.7.17](#A6.7.17)): der Sprung führt direkt zu ihrer angehefteten
    Zeile unter dem Tabellenkopf, ohne Streifen.
- **Ereignisse:** in der Ereignistabelle sind Namen keine Links; das Menü eines Beteiligten beginnt mit **Zu {Name}
  wechseln** ([A6.7.10](#A6.7.10)).
- **Grenzen:**
  - einen Sprung löst nur ein einfacher Klick mit Maus oder Stift aus (ohne Strg, Umschalt, Alt und ohne Ziehen).
    Textauswahl, Bearbeiten der Zelle per Doppelklick anderswo in der Zelle und F2 funktionieren wie bisher; ein
    Doppelklick direkt nach einem Sprung bewirkt nichts;
  - Tippen mit dem Finger öffnet wie bisher das Panel der Zeile; es beginnt mit dem Abschnitt **Personen in der
    Zelle** mit einer Zeile **Zu {Name} wechseln** für jede Person der Zelle;
  - die zentrale Person des Stammbaums ändert sich durch einen Sprung nicht.
- **Bedienung:** Klick auf den Namen; **Enter** auf der aktiven Zelle springt bei einem Namen, bei mehreren Namen
  bietet es **Wechseln zu…** an; ‹ › in der Leiste und Alt+← / Alt+→ in der Tabelle.
- **Gilt seit:** App 3.30.0

<!-- zdroj: app:0b833e3d src/ui/table-view/table-grid.ts personLinks (osoba bez role účastníka, ne agregát), namesHtml (tv-nm--jump, title celé jméno), linksIn (ne sloupec name), klik jen isMouseLikePointer bez modifikátorů a e.detail 1, jumpedAt + JUMP_DOUBLE_MS (dvojklik po skoku nic), Enter (tableLinkPick), Alt+←/→ onHistory · table-ui.ts tableNameAction (persons, unions), tableJumpStep (přes p1/p2 nebo partner → via partner), tableJumpBy, tablePersonShown, tableRunJump (rowType persons, setExpanded, flash, jumpTo), tableHistory (rowType, scroll, buňka, zavře rozbalený svazek, ruší dočasné zobrazení), tableLinkPick, showTableRowSheet (link.inCell) · table-jump.ts JUMP_HISTORY_MAX 50, JumpHistory, jumpTargetCell (partner jen je-li sloupec vidět, jinak name) · table-notice.ts (role status, Zobrazit dočasně, Zrušit filtry, ×, Esc) · table-bar.ts updateNav (vidět od prvního skoku, aria-disabled) · strings.ts table.link.goTo, pick, inCell, enterHint, hidden, showTemp; table.nav.back, backTo, forward, forwardTo; table.outsideFilter · e2e/table-view-links.spec.ts · CHANGELOG.cs.md 3.30.0 „Odkazy v Tabulce“ · spec 103 K3.1–K3.3, ZADANI_DEV_tabulka-odkazy-ukotveni D1–D4, D6 · dirigent:test/vysledek-1116-app-103-odkazy-083-razeni.md · ukotvená osoba skrytá filtrem: app:9b2b6dca table-ui.ts tablePersonPinned, grid.jumpToPin (bez pruhu) · spec 103 Rozhodnutí 16. 11. (díl C) -->

<a id="A6.7.17"></a>
### A6.7.17 Angeheftete Zeilen

Eine angeheftete Zeile bleibt unter dem Tabellenkopf, während die Tabelle rollt. Sie dient zum Vergleich von Zeilen,
die in der Tabelle weit voneinander entfernt sind.

- **Wie eine Zeile angeheftet wird:** Zeilenmenü → **Zeile anheften** (nach **Bearbeiten…**). Über mehrere Zeilen
  ausgewählter Text (durch Ziehen oder Umschalt+Klick) und ein Rechtsklick hinein bieten **Zeilen anheften (n)** für
  die Personen dieser Zeilen an; eine Unterzeile einer Verbindung zählt als ihre Person. Auf einer angehefteten Zeile
  steht dort stattdessen **Zeile lösen**.
- **Wie sie aussehen:** unter dem Tabellenkopf in der Reihenfolge der Tabelle, eine Person samt den Unterzeilen ihrer
  Verbindungen wie im Körper der Tabelle. Der Name einer angehefteten Zeile hat eine gefüllte Stecknadel, ihre eigene
  Zeile im Körper der Tabelle eine umrissene. Sie nehmen höchstens ein Drittel der Höhe der Tabelle ein, mehr Zeilen
  rollen in einer eigenen Bildlaufleiste. Aktive Zelle, Bearbeiten in der Zelle, Tastatur und Zeilenaktionen
  funktionieren in ihnen.
- **Der Filter blendet eine angeheftete Zeile nicht aus:** eine Zeile, die Filter oder Suche ausblenden, bleibt
  angeheftet, gedämpft mit „außerhalb des Filters“.
- **Der Chip** „Angeheftete Zeilen (n) ×“ am Anfang der Reihe der Filter: × löst alle. **Filter aufheben** lässt die
  Anheftung.
- **Grenzen:**
  - höchstens 10 Zeilen; ein Eintrag, der die Grenze überschreiten würde, ist ausgeschaltet mit „Höchstens 10 Zeilen
    lassen sich anheften.“;
  - die Anheftung gilt für einen Stammbaum und eine Zeilenart in diesem Fenster: ein anderer Stammbaum oder eine
    andere Zeilenart löst sie, Ansicht, Filter und Suche nicht. Sie wird nicht in der Ansicht gespeichert, und die
    Ansicht hat ihretwegen nicht **geändert**. Nach dem Schließen des Stammbaums oder dem Neuladen der Seite ist sie
    weg;
  - die Reihenfolge der angehefteten Zeilen ändert sich nach einer Bearbeitung nicht, bis sich Sortierung, Filter,
    Suche oder Ansicht ändern;
  - eine Zeile, die aus dem Stammbaum verschwindet, wird von selbst gelöst;
  - nur Computer und Tablet (auf dem Tablet im Panel der Zeile). Das Telefon hat keine Anheftung, auch nicht im
    Querformat.
- **Bedienung:** Zeilenmenü (rechte Maustaste, Umschalt+F10) **Zeile anheften** / **Zeilen anheften (n)** / **Zeile
  lösen**; Chip **Angeheftete Zeilen (n)** mit ×.
- **Gilt seit:** App 3.30.0

<!-- zdroj: app:354e3675 src/ui/table-view/table-pins.ts PIN_MAX 10, TablePins (jeden strom a typ řádků; pohled, filtr, hledání je nechají; jen paměť okna, ne v pohledu), prune, ordered (pořadí do změny řazení, filtru, hledání, pohledu; D7 a), pinRanks · table-ui.ts tableRowPinEntry (ne isPhoneBar; many z tableAreaRowKeys, unpin, disabled + limit), tablePinnedLines (podřádky svazků jako v těle, D5 a; outside), showTableRowSheet (tablet), changeTablePins · table-grid.ts .tv-pinrows (role rowgroup, nejvýš třetina těla s vlastním posuvem), tv-outside · table-filterbar.ts štítek pinRow.chip s × (unpinAll; Zrušit filtry ukotvení nechá) · strings.ts table.pinRow.one, many, unpin, chip, unpinAll, zone, rowSr, limit; table.outsideFilter · e2e/table-view-pins.spec.ts · CHANGELOG.cs.md 3.30.0 „Odkazy v Tabulce“ · spec 103 K4.1–K4.4, D5, D7 · dirigent:test/vysledek-1116-app-103-odkazy-083-razeni.md -->

<a id="A6.7.18"></a>
### A6.7.18 Die Forschung in der Tabelle eines weiteren Fensters

Die Tabelle in einem weiteren Fenster ([A6.8](#A6.8)) zeigt die Forschung so, wie das Hauptfenster sie hat: die
Spalten, Chips und Ansichten der Forschung, die Marke des Agenten bei der Person, an der er arbeitet, und seine
Warteschlange ([A6.7.14](#A6.7.14)). Mit der Forschung spricht nur das Hauptfenster; ein weiteres Fenster bekommt
dessen Zustand. Beim Verfolgen der Forschung folgt die Tabelle eines weiteren Fensters dem Agenten
([S4.1.7](S4-research-from-the-app.md#S4.1.7)).

- **Chips und Ansichten:** die Gruppe **Forschung** gibt es in der Tabelle jedes Fensters mit einem Stammbaum der
  Forschung. Chips, die nur beim Folgen gelten, sind live, wenn das Hauptfenster die Forschung verfolgt, sonst sind
  sie wie im Hauptfenster ([A6.7.14](#A6.7.14)). Eine gespeicherte Ansicht mit Forschungsfiltern öffnet sich in beiden
  Fenstern gleich.
- **Forschungsfilter ohne Forschung** (in jedem Fenster, auch im Hauptfenster): eine Ansicht, die nach der Forschung
  filtert (ein Chip der Forschung oder ein Filter einer Forschungsspalte), zeigt alle Zeilen, wenn die Tabelle keine
  Daten der Forschung hat, und sagt neben dem Namen der Ansicht „Der Forschungsfilter wird gerade nicht angewendet“.
  Auf dem Telefon steht dort nur ein bernsteinfarbener Punkt mit diesem Text im Tooltip.
- **Die Zeile des Agenten:** die Zeile der Person, an der der Agent arbeitet, hat in einem weiteren Fenster einen
  Hintergrund in der Farbe des Folgens, eine Linie in der Namenszelle und den Namen fett, auch in einem abgekoppelten
  Fenster. Das Hauptfenster behält den senkrechten Balken am Namen ([A6.7.14](#A6.7.14)).
- **Scrollen zum Agenten:** ein Fenster, das dem Agenten folgt und nicht pausiert ist, scrollt die Zeile des Agenten
  in die Mitte, wenn der Agent zu einer anderen Person wechselt und deren Zeile nicht ganz sichtbar ist. Das Scrollen
  ist weich (300 ms, bei reduzierter Bewegung sofort); aktive Zelle, Auswahl und Fokus ändern sich nicht, und
  waagerecht scrollt nichts. Eine sichtbare Zeile und eine angeheftete Zeile des Agenten ([A6.7.17](#A6.7.17)) scrollen
  die Tabelle nicht. Ein pausiertes oder abgekoppeltes Fenster scrollt nicht.
- **Pause:** das Mausrad über dem Raster, das Ziehen der Bildlaufleiste, ein Druck in die Zeilen (Zelle, Name) und die
  Tasten zum Bewegen und Scrollen im Raster pausieren das Folgen im Fenster
  ([S4.1.7](S4-research-from-the-app.md#S4.1.7)). Leiste, Tabellenkopf und Statuszeile der Tabelle starten keine
  Pause, sie verlängern nur eine laufende.
- **Die Zeile des Agenten ausgefiltert:** in einem Fenster, das dem Agenten folgt (auch einem pausierten), scrollt die
  Tabelle nicht, und die Statuszeile sagt „Die Zeile des Agenten ist ausgefiltert“ mit **Vorübergehend zeigen**. Das
  zeigt eine vorübergehende Zeile wie beim Sprung zu einer Person ([A6.7.16](#A6.7.16)) und scrollt zu ihr. Der
  Hinweis verschwindet, sobald die Zeile des Agenten sichtbar ist. Solange der Hinweis zu sehen ist, weichen der
  Zustand der Forschung und „Nur lesen“ in der Statuszeile (beides sagt der Streifen des Fensters); in einem Fenster
  bis 400 px weichen auch die Zeilenzahl und **Zeichen ⓘ**. Eine angeheftete Zeile des Agenten hat keinen Hinweis.
- **Blasen der Forschung:** eine Aktion aus der Blase einer Forschungszelle ([A6.7.14](#A6.7.14)) führt das
  Hauptfenster aus: es startet sie nur, wenn seine Blase sie bei dieser Person gerade anbietet, und kommt in den
  Vordergrund (nicht bei einer Aktion, die das Terminal der Forschung öffnet). Eine Quelle in der Quellentabelle und
  die Website eines Archivs öffnen sich im weiteren Fenster. Eine eigene Antwort auf einen wartenden Eintrag wird im
  weiteren Fenster nicht angeboten; **Wartet auf Bearbeitung ›** öffnet das Panel im Hauptfenster. Ist das
  Hauptfenster geschlossen, fehlen in der Blase die Aktionen, die es ausführen würde.
- **Bedienung:** App: **Vorübergehend zeigen** in der Statuszeile der Tabelle; der Zustand des Folgens im Streifen
  des Fensters ([S4.1.7](S4-research-from-the-app.md#S4.1.7)).
- **Gilt seit:** App 3.30.0

<!-- zdroj: app:34513c94 src/windows/agent-state.ts, agent-mirror.ts, src/ui/agent-window-ui.ts (zrcadlo stavu agenta, Tabulka čte vstup výzkumu z hlavního okna) · src/ui/table-view/table-filter.ts researchFilterIdle (čip výzkumu nebo sloupec fromResearch, bez ctx.research) · table-viewbar.ts .tv-view-note (role status) · index.html .tv-view-note na telefonu jen tečka · d24ff2ec src/ui/table-view/table-ui.ts tableAgentRow (jen windowAgentFollow, tj. další okno; attached posune, attached/paused poznámka, ukotvený ne), tableShowAgentRow, tableAgentFollowChanged · table-grid.ts revealKey(center, smooth, keepSelection), REVEAL_GLIDE_MS 300, prefers-reduced-motion · index.html .tv-row.is-agent (--follow-c1-soft, linka, font-weight 600, bez tv-agent-bar) · src/ui/live-follow-ui.ts (pauza Tabulky: kolečko, posuvník, stisk v řádcích, klávesy; lišta, hlava, stavový řádek ne) · table-bar.ts updateAgentNote (tv-status-agent, aria-live polite, showTemp) · 18dbb544 (poznámka: stav výzkumu a jen ke čtení ustoupí; do 400 px počet, Značky, ◎) · b8d21457 src/windows/window-table-research.ts (TABLE_BUBBLE_ACTION, bubbleRunsHere source / web, hlavní okno ověří nabídku, do popředí ne u terminálu, bez odpovědi čekající položky, při zavřeném hlavním okně vynechané) · strings.ts table.agentRowHidden, table.researchFilterOff, table.link.showTemp · CHANGELOG.cs.md 3.30.0 „Výzkum v Tabulce dalšího okna“, „Sledování agenta ve všech oknech“ · spec 097 K1.2, K3.1, K3.2, O4, dotaz 6 · app:docs/ZADANI_DEV_sledovani-ve-vsech-oknech.md §5; ZADANI_UIX dotazy 11, 14, 15 · prace/1116-app-097-sledovani-okna -->

<a id="A6.7.19"></a>
### A6.7.19 Umfang: eine Personenliste

Die Tabelle zeigt den ganzen Stammbaum oder eine Personenliste ([A11](A11-lists-of-people.md)). Der Umfang schränkt
die Zeilen auf die Personen der Liste ein; Filter, Suche und Chips gelten dann innerhalb davon.

| Zeilen | Im Umfang einer Liste |
|---|---|
| **Personen** | die Personen der Liste in der Reihenfolge der Liste; die erste Spalte **#** ist die Reihenfolge, Sortierung „Sortierung: # (Reihenfolge der Liste)“ |
| **Verbindungen** | Verbindungen, bei denen mindestens ein Partner in der Liste ist; ein Partner außerhalb der Liste ist grau |
| **Ereignisse** | Ereignisse, an denen mindestens eine Person der Liste teilnimmt |
| **Quellen** | immer der ganze Stammbaum: „Quellen haben keinen Umfang nach Liste.“ |

- Der Umfang gilt für Personen, Verbindungen und Ereignisse zugleich. Die Anzahlen im Umschalter **Zeilen** und über
  der Tabelle zählen nur den Umfang. Sortieren nach einer anderen Spalte geht; nach der Rückkehr zum ganzen Stammbaum
  verschwindet die Reihenfolge der Liste.
- Der Umfang ist kein Chip des Filters: **Filter aufheben** hebt ihn nicht auf.
- **Arbeitsliste** ([A11.8](A11-lists-of-people.md#A11.8)): nach **#** steht die Spalte **Erledigt** (Kästchen, Klick
  oder Leertaste) und unter den Chips **Offen** und **Erledigt** (sie schließen sich aus).
- **Aus der Liste entfernen:** im Umfang einer festen Liste im Zeilenmenü einer Person (auch für eine Auswahl über
  mehrere Zeilen); die Person verschwindet sofort aus der Tabelle, die Meldung hat **Rückgängig**.
- **Person außerhalb der Liste:** ein Sprung per Link ([A6.7.16](#A6.7.16)) zu einer Person, die nicht in der Liste
  ist, sagt „Nicht in der Liste: {Name}.“ mit **Vorübergehend zeigen** · **Ganzer Stammbaum** · ×. Eine vorübergehend
  gezeigte oder angeheftete Zeile ([A6.7.17](#A6.7.17)) außerhalb der Liste ist abgeschwächt, hat bei **#** „–“ und
  das Etikett „außerhalb der Liste“.
- **Gelöschte Liste:** die Tabelle kehrt zum ganzen Stammbaum zurück und sagt „Die Liste der Ansicht gibt es nicht
  mehr; der ganze Stammbaum wird gezeigt.“
- Der Umfang wird mit der Ansicht gespeichert ([A6.7.7](#A6.7.7)), mit dem laufenden Zustand der Tabelle und in einem
  neuen Fenster (⧉, [A6.8](#A6.8)).
- **Export CSV und XLSX** ([A6.7.9](#A6.7.9)) trägt im Umfang die Spalten **#** und **Erledigt** zuerst; **Alle …
  ohne Filter** bedeutet alle Zeilen des Umfangs.
- **Grenzen:** ein Stammbaum ohne Listen hat unter **Umfang** nur **Ganzer Stammbaum** und **Listen verwalten…**; in
  einem schreibgeschützten Stammbaum gibt es weder **Listen verwalten…** noch **Erledigt** und **Aus der Liste
  entfernen** als Bearbeitung.
- **Bedienung:** **Umfang ▾** in der Leiste der Tabelle: **Ganzer Stammbaum**, **Personenlisten** (Symbol der Art,
  Zahl der Personen, ✓ bei der gewählten), **Listen verwalten…**. Auf dem Computer bleibt die erste Zeile der Leiste
  eine einzige: wo wenig Platz ist, wird die Aufschrift **Umfang** verborgen und der ganze Stammbaum ist nur ein
  Zeichen. Auf dem Telefon **⋯ → Umfang ›**. Aus einer Liste: **In Tabelle öffnen**
  ([A11.3](A11-lists-of-people.md#A11.3)).
- **Gilt seit:** App 3.30.0
- **Ab App 3.31.0:**
  - die **Auswahl des Fensters** ([A6.6](#A6.6)), die keine Liste ist (Stammlinie, Vorfahren, Nachkommen,
    Forschungslinie), steht unter **Umfang ▾** als Abschnitt **Auswahl des Fensters** mit der Zeile „Auswahl: {Name} ·
    {Zahl}“; die Leiste der Tabelle zeigt dann „Auswahl: {Name}“. Die Zeilen sind wie im Umfang einer Liste, nur ohne
    eigene Reihenfolge: ohne die Spalten **#** und **Erledigt**. Person außerhalb der Auswahl: „Nicht in der Auswahl:
    {Name}.“;
  - der Umfang einer Auswahl folgt der Auswahl des Fensters: eine andere Auswahl ersetzt ihn, die Auswahl einer Liste
    schaltet auf den Umfang dieser Liste um, eine aufgehobene oder weggefallene Auswahl stellt **Ganzer Stammbaum**
    wieder her. Der Umfang einer Auswahl gehört dem Fenster und wird nicht mit der Ansicht der Tabelle gespeichert;
  - im Umfang einer Liste oder Auswahl ist im **⋯** der Tabelle die letzte Zeile **Auf der Karte**: die Auswahl des
    Fensters wird auf diese Liste oder Auswahl gesetzt, und die Karte öffnet sich mit dem Bereich **Auswahl**
    ([A6.5.7](#A6.5.7)). In einem weiteren Fenster ([A6.8](#A6.8)) führt das das Hauptfenster aus; ohne Hauptfenster
    ist die Zeile nicht verfügbar („Das Hauptfenster ist nicht geöffnet.“).

<!-- zdroj 3.31.0: app:src/ui/table-view/table-scope.ts (kind 'selection', klíč sel:…, jen pos, bez # a Hotovo) · table-ui.ts (oddíl scopeSelGroup jen pro výběr, který není seznam; rozsah sleduje výběr okna; openTableForSelection; ⋯ Na mapě jen v rozsahu seznamu nebo výběru, poslední řádek) · table-views.ts (rozsah výběru se s pohledem neukládá) · table-bar.ts (název výběru a ikona druhu) · table-notice.ts notInSelection · src/windows/window-show-on-map.ts (další okno → hlavní okno) · strings.ts table.scopeSelGroup, scopeSel, notInSelection, onMap, onMapNoMain · app:2a578474, 39020cf1 · ZADANI_DEV_vyber-osob §5, §6 · spec 098 -->
<!-- zdroj: app:src/ui/table-view/table-scope.ts tableScopeOf, scopeRows (Osoby v pořadí, svazek s partnerem, událost s osobou, prameny nikdy), scopeCounts, outsideScope, applyScopeCells · table-ui.ts setTableScope (Osoby, Svazky, Události najednou; LIST_SORT # ↑; zpět bez num), dropGoneScopes + scopeGone, tableScopeRows (Spravovat seznamy… ne v isReadOnly), showTableScopeMenu, tableScopeSheetRows, toggleTableDone, tableRowRemoveIds, hiddenJump.outsideList (:2204), leadColumnsOf (# a Hotovo), export :3125 scopeRows · table-notice.ts:60 (scopeGone, notInList, Celý strom) · table-views.ts:258, :272 view.scope · table-bar.ts tv-scope-btn · strings.ts table.scope, scopeWhole, scopeManage, scopeSources, scopeGone, notInList, outsideList, sortList, col.num, col.done, chip.left, chip.done, lists.toast.removed · app:211323e8, 33fa6cd4 (# a Hotovo v exportu), 9681a1f4 (N1 jeden řádek lišty) · ZADANI_DEV §9, §13d · spec 084 K3.* -->

<a id="A6.7.20"></a>
### A6.7.20 Gruppieren nach

Die Zeilen der Tabelle lassen sich nach einem Wert gruppieren. Jede Gruppe hat einen Kopf mit dem Wert und der Zahl
der Zeilen und lässt sich einklappen.

| Zeilen | Gruppieren nach |
|---|---|
| **Personen** | **Forschungslinie** (nur Stammbaum mit Linien), **Stamm**, **Nachname**, **Geburtsort**, **Geburtsjahrhundert**, **Geburtsjahrzehnt**, **Generation**, **Geschlecht**, **Beruf**, **Hinzugefügt – Tag** / **Monat** / **Jahr** ([A11.7](A11-lists-of-people.md#A11.7)), **Erledigt / offen** (nur im Umfang einer Arbeitsliste) |
| **Verbindungen** | **Heiratsjahrzehnt**, **Heiratsort**, **Stamm der Partner**, **Anzahl Kinder** |
| **Ereignisse** | **Ereignisart**, **Jahrzehnt**, **Ort** |
| **Quellen** | werden nicht gruppiert |

- Gruppiert wird nur in einer Ebene. Die Gruppen gehen aufsteigend nach dem Wert (Zeit, Zahl, Alphabet); Zeilen ohne
  Wert sind die letzte Gruppe „ohne Wert“ (bei Hinzugefügt „früher“). Innerhalb der Gruppe gilt die Sortierung der
  Tabelle. Eine leere Gruppe wird nicht gezeigt.
- Eine Zeile mit mehreren Werten (mehrere Linien, mehrere Berufe, eine Verbindung zweier Stammlinien) ist in jeder
  ihrer Gruppen. Die Statuszeile sagt dann „N verschiedene Personen · K Gruppen“.
- Die Gruppierung ist als Chip „Gruppiert: …“ mit × zu sehen; Filter und Suche gelten weiter. Ein Sprung zu einer
  Zeile in einer eingeklappten Gruppe öffnet sie.
- Die Gruppierung wird mit der Ansicht gespeichert ([A6.7.7](#A6.7.7)). Ein Wert, den die Zeilenart oder der
  Stammbaum nicht anbietet, wird nicht verwendet.
- **Export CSV und XLSX** einer gruppierten Tabelle hat als erste Spalte **Gruppe**; eine Zeile in mehreren Gruppen
  ist dort in jeder.
- **Bedienung:** **⋯** der Tabelle → **Gruppieren nach ›** (**Ohne Gruppierung** hebt sie auf), **Alle Gruppen
  einklappen** / **Alle Gruppen ausklappen**. Kopf der Gruppe: Klick, Enter oder Leertaste klappt ein und aus,
  ← klappt ein, → klappt aus. Auf dem Telefon **⋯ → Gruppieren nach**; der Kopf der Gruppe bleibt beim Bildlauf
  oben.
- **Gilt seit:** App 3.30.0

<!-- zdroj: app:src/ui/table-view/table-group.ts PERSON_KEYS, UNION_KEYS, EVENT_KEYS, offeredGroupKeys (lines jen s liniemi, done jen pracovní seznam), multiValued, groupRows (vzestupně, NO_VALUE_KEY poslední, řazení uvnitř, prázdné ne), noValueLabel (lists.earlier), groupKeysOfRow (skok otevře), groupedExportRows · table-export.ts:131 groupCol · table-views.ts:259, :273 view.group, groupingFits · table-ui.ts tableGroupOffer, tableExportGroups, setTableGroupBy, ⋯ Tabulky :3377, telefon :3423 · strings.ts table.groupBy, groupNone, grouped, groupsCollapse, groupsExpand, groupKey.*, groupNoValue, distinct, groupsN, groupCol · app:84331c31 · ZADANI_DEV §10, §11 · spec 084 K4.* -->

<a id="A6.8"></a>
## A6.8 Ansicht in einem eigenen Fenster

Am Computer lässt sich jede Ansicht in einem eigenen Fenster öffnen, etwa auf einem zweiten Monitor, und zwar in
beliebiger Zahl. Das Hauptfenster bleibt bei seiner Ansicht. Nur das Hauptfenster speichert; die anderen Fenster
schicken ihm ihre Änderungen und bekommen von ihm den Stammbaum.

- **Wo es geht:** am Computer (Windows, macOS, Linux, ChromeOS), auch mit Touchscreen, in einem Fenster breiter als
  640 px. Auf Telefon und Tablet (Android, iOS, iPadOS) und in der exportierten App (HTML-Datei) erscheint ⧉ nicht,
  und die Kurzbefehle öffnen nichts.
- **Was das Fenster übernimmt:** den Stammbaum, die Person in der Mitte und das, was die Ansicht zeigt: bei der
  Tabelle Zeilentyp, Filter, Suche, gespeicherte Ansicht, Sortierung und die gewählte Zeile; bei Familie den Zoom,
  beim Fächer die Kreise, bei der Karte Orte und Zoom. Danach hat das Fenster einen eigenen Zustand. Neu laden des
  Fensters (F5) behält Ansicht und Person.
- **Was das Fenster hat:** statt der Leiste der App einen Kopf: Name des Stammbaums, Ansichtsumschalter (unter
  960 px als „{Ansicht} ▾“), **Auswahl folgen** ([A6.8.1](#A6.8.1)), **Rückgängig**, **Wiederholen** und ⧉ **Weiteres Fenster
  öffnen**. Stammbaum-Umschalter, Menü **Forschung**, Einstellungen und das kleine Forschungspanel hat das Fenster
  nicht. Ab App 3.30.0 steht statt **Auswahl folgen** der Schalter **Auswahl** ([A6.8.4](#A6.8.4)), ab App 3.31.0
  heißt er **Gewählte Person** ([A6.8.1](#A6.8.1)). Eine Personenauswahl ([A6.6](#A6.6)) hat das Fenster für sich.
- **Änderungen:** im Fenster lässt sich eine Person bearbeiten (Menü der Person, **Bearbeiten**) und eine Zelle der
  Tabelle. Das Hauptfenster speichert sie, sie lassen sich als seine Schritte rückgängig machen und erscheinen sofort in allen Fenstern.
  **Rückgängig** und **Wiederholen** im Kopf des Fensters nehmen Schritte des Hauptfensters zurück oder wiederholen sie. Wurde
  der Stammbaum inzwischen in einem anderen Fenster geändert, wird die Änderung nicht übernommen: „Der Stammbaum wurde
  inzwischen in einem anderen Fenster geändert. Die Änderung wurde nicht übernommen, die Daten sind aktualisiert.“ Eine
  angefangene Zelle der Tabelle bleibt dabei erhalten („Entwurf bleibt · Enter übernimmt, Esc verwirft“).
- **Forschung:** die Verbindung zur Forschung (Brücke, Verfolgen, Senden von Änderungen) bedient nur das
  Hauptfenster. Die Forschungseinträge im Menü der Person stehen im Fenster unter der Überschrift **Forschung · läuft
  im Hauptfenster**, und das Hauptfenster führt sie aus. Beim Live-Verfolgen der Forschung
  ([S1.4](S1-connecting-app-and-research.md#S1.4)) sind die Fenster wie das Hauptfenster nur lesbar: „Nur lesen · das
  Hauptfenster verfolgt die Forschung“ mit **Zum Hauptfenster**.
- **Grenzen:**
  - ⧉ im Hauptfenster zeigt die Zahl weiterer Fenster („2 weitere Fenster“, unter 1280 px nur die Zahl). Sein Menü
    hat oben **Geöffnete Fenster** (jedes mit **In den Vordergrund** und ×) und **Alle schließen**;
  - ab 5 offenen Fenstern weist die App darauf hin, dass jedes weitere Fenster Speicher braucht; sie verbietet nichts;
  - ein vom Browser blockiertes Fenster wird gemeldet („Der Browser hat das neue Fenster blockiert…“), mit **Erneut
    versuchen**;
  - der Titel des Fensters nennt Ansicht und Stammbaum („Tabelle – Horák – Strom“), der des Hauptfensters den
    Stammbaum („Horák – Strom“).
- **Bedienung:** App: ⧉ **In neuem Fenster öffnen** neben dem Ansichtsumschalter (Menü mit den sechs Ansichten, bei
  einem Stammbaum aus der Forschung auch **Forschungsübersicht**, [S4.1.6](S4-research-from-the-app.md#S4.1.6)); ⧉ in
  der Leiste der Tabelle nach **Export ▾**; am Reiter einer Ansicht Strg+Klick (macOS ⌘+Klick), mittlere Maustaste
  oder Rechtsklick (Umschalt+F10) → **{Ansicht} in neuem Fenster**.
- **Gilt seit:** App 3.28.0
- **Ab App 3.30.0:** beim Live-Verfolgen der Forschung folgt jedes Fenster dem Agenten in seiner eigenen Ansicht, und
  der Streifen des Fensters sagt, wie das Fenster folgt, statt „Nur lesen · das Hauptfenster verfolgt die Forschung“
  ([S4.1.7](S4-research-from-the-app.md#S4.1.7)). Die Tabelle in einem Fenster zeigt die Forschung wie im
  Hauptfenster ([A6.7.18](#A6.7.18)).

<!-- zdroj: app:4b1373a7 src/windows/window-open.ts isDesktopSystem, windowsOffered (role main, ne isViewMode, > MOBILE_MAX 640, ne isPhoneBar), openInNewWindow · src/windows/window-controls.ts openWindow (BLOCKED_TOAST_MS 10 s, win.retry; MANY_WINDOWS 5, manyWindows), INDICATOR_TEXT_MIN_WIDTH 1280, renderMenu (6 pohledů, thisView, overview jen UI.canOpenResearchOverview), wireTabs (ctrl/meta click, auxclick button 1, contextmenu, Shift+F10 / ContextMenu) · src/windows/view-window-state.ts (přenos stavu, F5 satelitu) · src/windows/sat-header.ts · src/windows/satellite.ts readOnly (live, locked) · src/windows/sat-states.ts (live strip readOnlyLive, goToMain; CONFLICT_TOAST_MS) · src/windows/window-drafts.ts (draftKept) · src/windows/window-research-menu.ts (researchInMain) · src/windows/window-title.ts · index.html html.window-satellite .toolbar skryto · strings.ts win.* · CHANGELOG.cs.md 3.28.0 · spec 079 K1.1–K1.4, K1.7 · prace/1112-app-okna-zaklad, 1112-app-okna-pohledy -->

<a id="A6.8.1"></a>
### A6.8.1 Gewählte Person

Die gewählte Person ist zwischen den Fenstern geteilt. Was eine Wahl in einem anderen Fenster in diesem Fenster
bewirkt, bestimmt der Schalter **Auswahl folgen** im Kopf des Fensters.

| Modus | Was eine in einem anderen Fenster gewählte Person bewirkt | Standard in den Ansichten |
|---|---|---|
| **wechseln** | sie wird zur Mitte des Fensters wie nach Fokussieren: Nachkommen zeigt ihre Nachkommen, der Fächer ihre Vorfahren, Familie ihre Familie | Familie, Nachkommen, Fächer |
| **nur markieren** | sie wird nur markiert: die Karte mit einem Ring, im Fächer ein Sektor, in der Zeitleiste eine Zeile, auf der Karte ihre Orte, in der Tabelle eine Zeile; die Mitte bleibt | Zeitleiste, Karte, Tabelle |
| **aus** | nichts; das Fenster hat eine eigene Auswahl und schickt sie nicht | – |

- **Grenzen:**
  - **wechseln** gibt es nur in Familie, Nachkommen und Fächer; sonst nur **nur markieren** und **aus**;
  - ein eigener Klick im Fenster ändert die Mitte nur in diesem Fenster; ein Fenster, das nach einem anderen
    gewechselt hat, gibt die Wahl nicht weiter;
  - das Hauptfenster folgt der Auswahl immer und hat keinen Schalter;
  - die Wahl gilt für ein Fenster und übersteht sein Neuladen (F5). Ein gewählter Modus, der nicht der Standard ist,
    gilt auch nach einem Wechsel der Ansicht im Fenster (**wechseln**, wo es fehlt, wie **nur markieren**); sonst gilt
    der Standard der neuen Ansicht.
- **Bedienung:** App: im Kopf des Fensters **Auswahl folgen: {Modus} ▾**.
- **Gilt seit:** App 3.28.0
- **Ab App 3.30.0:** ein Fenster, das beim Verfolgen der Forschung dem Agenten folgt und nicht pausiert ist, markiert
  eine in einem anderen Fenster gewählte Person nur, auch im Modus **wechseln**; der Sprung zum Agenten wird nicht als
  Wahl einer Person geschickt ([S4.1.7](S4-research-from-the-app.md#S4.1.7)).
- **Ab App 3.30.0:** der Schalter heißt **Auswahl ▾**, und diese Modi stehen in seiner Gruppe **Dieses Fenster** ·
  Auswahl aus anderen Fenstern. Die zweite Gruppe **Hauptfenster** sagt, was eine Wahl in diesem Fenster im
  Hauptfenster bewirkt ([A6.8.4](#A6.8.4)).
- **Ab App 3.31.0:** der Schalter heißt **Gewählte Person ▾**, seine Gruppen heißen **Dieses Fenster** · in einem
  anderen Fenster gewählte Person und **Hauptfenster** · in diesem Fenster gewählte Person. Bei **aus** steht „Das Fenster
  behält seine gewählte Person und sendet keine.“ Das Wort **Auswahl** bedeutet in der App nur die Personenauswahl
  ([A6.6](#A6.6)).

<!-- zdroj: app:4b1373a7 src/windows/follow-mode.ts RECENTERING (family, descendants, fan), defaultFollowMode, followModesFor, effectiveFollowMode, followChoiceToStore (sessionStorage pro okno) · src/windows/window-selection.ts (origin, bez smyčky) · src/windows/sat-header.ts · strings.ts win.followSelectionState, followModeSwitch, followModeMark, followModeOff, followModeSwitchNote, followModeMarkNote, followSelectionOff · spec 079 K1.3, K2.1 · prace/1112-app-okna-sledovat (7bb1b8b2) · 3.31.0: strings.ts satFollow.menu, label, groupThisSub, groupMainSub, recvOffNote, sendDisabled, agentNote (app:51ad8fd6, ZADANI_DEV_vyber-osob §1.1) -->

<a id="A6.8.2"></a>
### A6.8.2 Wenn das Hauptfenster fehlt

Ein Fenster ohne Hauptfenster verliert nichts, und nichts schließt sich von selbst. Es bleibt mit den letzten Daten
nur lesbar.

| Zustand | Was das Fenster zeigt | Auswahl |
|---|---|---|
| das Hauptfenster ist geschlossen (3 s ohne Nachricht von ihm) | Streifen „Das Hauptfenster ist geschlossen · Stand {Zeit}, nur lesen“; die Forschungseinträge im Menü der Person unter **Forschung · nur mit Hauptfenster** sind nicht nutzbar | **Strom öffnen**, **Zum Hauptfenster machen** |
| der Stammbaum wurde im Hauptfenster gelöscht | „Der Stammbaum existiert nicht mehr“ statt des Inhalts | **Fenster schließen** |
| der Stammbaum ist gesperrt | „Der Stammbaum ist gesperrt · Das Passwort wird im Hauptfenster eingegeben.“ | **Zum Hauptfenster** |
| das Hauptfenster hat den Stammbaum gewechselt | das Fenster wechselt mit, die Ansicht bleibt, die Auswahl wird aufgehoben („{Stammbaum} → {Stammbaum}“) | – |

- **Grenzen:**
  - **Strom öffnen** öffnet ein neues Hauptfenster; die Fenster verbinden sich damit, und der Streifen verschwindet;
  - **Zum Hauptfenster machen** macht dieses Fenster zum Hauptfenster: es lädt den Stammbaum aus dem Speicher (die
    Daten im Fenster können älter sein als die gespeicherten), bekommt die Leiste der App, und die Ansicht bleibt.
    Ist inzwischen ein anderes Hauptfenster entstanden, geschieht nichts;
  - Neuladen des Hauptfensters (F5) zeigt den Streifen nicht.
- **Bedienung:** App: die Schaltflächen im Streifen und anstelle des Fensterinhalts.
- **Gilt seit:** App 3.28.0
- **Ab App 3.30.0:** schließt sich das Hauptfenster während des Verfolgens der Forschung, wird eines der weiteren
  Fenster von selbst zum Hauptfenster, und das Folgen geht darin weiter ([S4.1.7](S4-research-from-the-app.md#S4.1.7)).
  Geht das nicht, zeigen die Fenster „Das Folgen lässt sich nicht fortsetzen · das Hauptfenster wurde geschlossen“
  mit **Zum Hauptfenster machen** und **Strom öffnen**.

<!-- zdroj: app:4b1373a7 src/windows/satellite.ts MAIN_SILENCE_MS 3000, lastHeardAt, treeGone · src/windows/sat-states.ts (closed strip mainClosed, treeGone, treeLocked, SWITCHED_TOAST_MS) · src/windows/become-main.ts (zámek ifAvailable, znovunačtení jako hlavní z IndexedDB) · src/windows/window-research-menu.ts researchMainOnly · strings.ts win.mainClosed, openStrom, makeMain, treeGone, treeGoneNote, treeLocked, treeLockedNote, closeWindow, goToMain, treeSwitched · spec 079 K1.5 · prace/1112-app-okna-zaklad (stavy 1–6) -->

<a id="A6.8.3"></a>
### A6.8.3 Ein zweiter Tab der App

Die App, ein zweites Mal in einem gewöhnlichen Tab oder Fenster des Browsers geöffnet, lädt keine zweite Kopie des
Stammbaums. Sie zeigt „Strom ist bereits in einem anderen Fenster geöffnet“ mit der Erklärung „Nur ein Fenster
speichert, damit sich Änderungen nicht gegenseitig überschreiben. Weitere Fenster verbinden sich damit.“

- **Grenzen:**
  - **Dorthin wechseln** holt das Hauptfenster nach vorne. Lässt der Browser das nicht zu, sagt es der Tab und fügt
    „Dieser Tab kann geschlossen werden.“ hinzu;
  - **Als weiteres Fenster öffnen** macht aus dem Tab ein Fenster wie in [A6.8](#A6.8), mit der Tabelle;
  - ein im zweiten Tab geöffneter Link (Person, Suche, Links der Forschung, eine von der installierten App geöffnete
    Datei) geht genau einmal an das Hauptfenster: „Der Link wurde im Hauptfenster geöffnet.“;
  - der zweite Tab schreibt nichts in die Liste der Stammbäume und nichts in die Einstellungen.
- **Bedienung:** App: **Dorthin wechseln**, **Als weiteres Fenster öffnen**.
- **Gilt seit:** App 3.28.0

<!-- zdroj: app:4b1373a7 src/windows/window-role.ts (Web Lock strom-main ifAvailable → main, jinak second-tab) · src/windows/second-tab.ts (secondTabSatelliteKind table) · src/windows/window-link.ts (předání odkazu hlavnímu jednou) · src/windows/window-start.ts openLinkFromWindow · strings.ts win.alreadyOpen, alreadyOpenNote, switchThere, openAsWindow, switchFailed, tabCanClose, linkForwarded · CHANGELOG.cs.md 3.28.0 · spec 079 K1.6 · prace/1112-app-okna-zaklad (7d22e396) -->

<a id="A6.8.4"></a>
### A6.8.4 Was eine Wahl in einem weiteren Fenster im Hauptfenster bewirkt

Eine in der Tabelle, in der Zeitleiste oder auf der Karte eines weiteren Fensters gewählte Person wird im Hauptfenster
markiert oder wird zu seiner Mitte. Das bestimmt die Gruppe **Hauptfenster** im Schalter **Auswahl** (ab App 3.31.0
**Gewählte Person**) im Kopf des weiteren Fensters.

| Wahl | Was im Hauptfenster geschieht |
|---|---|
| **nur markieren** (Standard auf der Zeitleiste und der Karte) | die Person wird markiert wie im Modus **nur markieren** ([A6.8.1](#A6.8.1)); die Mitte bleibt |
| **fokussieren** (Standard in der Tabelle) | die Person wird zur Mitte des Hauptfensters wie nach Fokussieren an einer Karte, und der Baum wird um sie neu gezeichnet, auch wenn er sie vorher nicht zeichnete |

- **Wo:** die Wahl haben Tabelle, Zeitleiste und Karte eines weiteren Fensters (auf der Karte die Wahl einer Person an
  einem Ort; ein Klick auf den Ort allein schickt nichts). Familie, Nachkommen und Fächer eines weiteren Fensters
  ändern mit einem Klick ihre eigene Mitte und markieren die Person im Hauptfenster nur.
- **Durch die Zeilen gehen:** Pfeiltasten und Klick tun dasselbe. Das Hauptfenster markiert die Person sofort und
  ändert die Mitte erst 200 ms nach der letzten Wahl, und nur auf die zuletzt gewählte Person. Ein Durchgehen der
  Zeilen mit den Pfeiltasten ändert die Mitte so einmal.
- **Meldung und Rückkehr:** unten in der Mitte des Stammbaums im Hauptfenster steht „Mitte in anderem Fenster gewählt“
  mit der Schaltfläche **↶ {Name}** (die Mitte vor der ersten Wahl) und ×. Eine Reihe von Wahlen aus einem Fenster ist
  im Verlauf des Hauptfensters ein Schritt: ein Schritt zurück (↩ unten links, Alt+←) oder ↶ bringt die Mitte von
  davor zurück. Die Reihe endet mit einem eigenen Schritt im Hauptfenster (Fokussieren, Gehe zu, ↩, ↪, eine andere
  Ansicht), mit dem Schließen der Meldung, mit dem Umstellen der Wahl auf **nur markieren** und mit dem Schließen des
  weiteren Fensters. Das Umstellen der Wahl bringt die Mitte nicht zurück.
- **Eine Person, die das Hauptfenster nicht zeichnet** (bei **nur markieren**): die Ansicht Familie, Nachkommen oder
  Fächer des Hauptfensters sagt „{Name} ist in dieser Ansicht nicht enthalten.“ mit **Gehe zu** (die Person wird zur
  Mitte) und ×.
- **Grenzen:**
  - ein Hauptfenster, das dem Agenten der Forschung folgt, markiert die Person nur; die Mitte bleibt beim Agenten
    ([S4.1.7](S4-research-from-the-app.md#S4.1.7)). Einmal je Reihe sagt es „Agent wird verfolgt – eine in einem
    anderen Fenster gewählte Person wird nur markiert.“; das weitere Fenster hat bei der Wahl „(Agent)“ und im Menü
    „Das Hauptfenster folgt dem Agenten – die gewählte Person wird dort nur markiert.“ Nach einer Pause oder dem Ende des Folgens
    wird nichts nachträglich umgestellt: **fokussieren** gilt ab der nächsten Wahl;
  - eine Person, die inzwischen nicht mehr im Stammbaum ist: die Mitte bleibt, „Die gewählte Person ist nicht mehr im
    Baum.“ Eine Meldung ohne × verschwindet nach 6 s;
  - eine Person, die die Tabelle des Hauptfensters auslässt (Filter, Suche oder Liste; keine angeheftete Zeile und
    keine nur vorübergehend gezeigte Zeile): die Mitte bleibt, die Person wird nicht markiert und die Meldung ohne
    Namen „Die gewählte Person ist in diesem Fenster ausgeblendet.“ verschwindet nach 6 s. Familie, Nachkommen und
    Fächer blenden niemanden aus;
  - eine Person, die schon die Mitte ist: nichts geschieht;
  - bei **aus** in der Gruppe **Dieses Fenster** und wenn das Hauptfenster nicht geöffnet ist, ist die Gruppe
    **Hauptfenster** ausgegraut mit dem Hinweis „Nicht verfügbar – das Teilen der gewählten Person ist in diesem Fenster aus.“
    oder „Das Hauptfenster ist nicht geöffnet.“; die Wahl bleibt gespeichert;
  - die Wahl gilt für ein Fenster und seine Tabelle, Zeitleiste und Karte und übersteht das Neuladen des Fensters
    (F5); jedes weitere Fenster hat seine eigene. Solange keine gewählt ist, entscheidet die Ansicht: die Tabelle
    fokussiert, Zeitleiste und Karte markieren. Ein gewähltes **nur markieren** gilt auch in der Tabelle und
    übersteht das Neuladen des Fensters.
- **Bedienung:** App: im Kopf eines weiteren Fensters **Gewählte Person ▾** → **Hauptfenster** · in diesem Fenster
  gewählte Person: **nur markieren**, **fokussieren**. Der geschlossene Schalter zeigt, was gewählt ist (in einem
  schmalen Fenster verkürzt mit Symbolen); den ganzen Wortlaut hat sein Tooltip.
- **Gilt seit:** App 3.30.0

<!-- zdroj: app:e7d3bb11 src/windows/follow-mode.ts SendMode mark|focus, SENDING table/timeline/map, sendModeKey (sessionStorage okna), getSendModeChoice · src/windows/sat-header.ts followControlParts (FOLLOW_LABEL_MIN_WIDTH 1280, FOLLOW_BOTH_MIN_WIDTH 1100), followSendGroupState (off, no-main, agent), sendModeName = contextMenu.focus malým písmenem, followControlAria · src/windows/satellite.ts sendMode (followSelection && sendModeAvailable), post select intent, seq · app:edaec740 src/windows/window-focus.ts WINDOW_FOCUS_DELAY_MS 200, take (seq), fire (deleted, hidden, followingAgent, focusId), run push/replace, endRun · src/windows/window-selection.ts wireMainSelection (markNotice not-in-view, VIEW_STEP_EVENT, onSendEnded), src/windows/window-start.ts mainFocusDeps (hidden: () => false, drawn family/descendants/fan) · src/ui/window-notice.ts PLAIN_NOTICE_MS 6000 · strings.ts satFollow.*, mainNotice.* · CHANGELOG.cs.md 3.30.0 · dirigent:spec/110 (rozhodnutí 18. 11. 17:35 a 17:45: „Zaměřit“ = nový střed) · app:docs/ZADANI_DEV_vyber-z-okna.md §1–§7 · app:6be873dc src/windows/follow-mode.ts defaultSendMode (table → focus, jinak mark), parseSendMode, setSendMode (ukládá focus i mark) · app:4927ccab src/ui/table-view/table-ui.ts tableHidesPerson (filtr, hledání, seznam; ne pinOutside, tempShown, sources), src/windows/window-start.ts mainFocusDeps hidden, src/windows/window-focus.ts { kind: 'hidden' }, strings.ts mainNotice (skrytá osoba), e2e/windows-send-focus.spec.ts -->
