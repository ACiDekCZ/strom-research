<a id="A5"></a>
# A5 Prüfung des Stammbaums

Was die App im Stammbaum überwacht, mit welchen Schwellen und was sich mit einem Befund tun lässt: beheben, als **Kein
Fehler** markieren oder von der Forschung bewerten lassen. Beschrieben werden die Strom-App 3.21.2 (und die Forschung
1.25.2).
Die Forschung hat eine eigene Prüfung `strom check` ([R5](R5-conflicts.md)). Sie ist hier nicht beschrieben, außer an
den Stellen, an denen beide übereinstimmen.

<a id="A5.1"></a>
## A5.1 Die Prüfung und ihre Befunde

Die App prüft den ganzen Stammbaum jedes Mal, wenn die Prüfung geöffnet wird. Nichts wird gespeichert, und der
Stammbaum ändert sich nicht.
Jeder Befund hat einen Schweregrad:

| Schweregrad | Abschnitt im Dialog | Bedeutung |
|---|---|---|
| Fehler | **Probleme** | die Daten widersprechen sich oder sind beschädigt ([A5.2](#A5.2), [A5.3](#A5.3), [A5.4](#A5.4)) |
| Warnung | **Probleme** | unwahrscheinlich, aber möglich |
| Info | **Hinweise** | „Keine Fehler. Hinweise, die bei der Forschung helfen können.“ ([A5.5](#A5.5), [A5.6](#A5.6)) |

- **Grenzen:**
  - Befunde derselben Art bilden eine Gruppe, geordnet nach Schweregrad, Größe und Name. Offen ist nur eine Gruppe
    mit einem Fehler.
    Über 50 Befunden werden weitere in Schritten von 20 gezeigt. Auf dem Telefon (bis 640 px) sind die **Hinweise**
    zugeklappt, wenn es auch **Probleme** gibt.
  - Platzhalterpersonen werden nicht gemeldet. Ein als **Kein Fehler** markierter Befund ([A5.7](#A5.7)) wird weder
    gezählt noch gezeigt.
  - Ein schreibgeschützter Stammbaum zeigt Befunde nur an. Bei einem anderen als dem geöffneten Stammbaum öffnet eine
    Behebung oder Markierung zuerst den Stammbaum.
- **Bedienung:** Dialog **Stammbaum-Prüfung**: **Stammbaum-Überblick → Datenqualität → Schnellaktionen →
  Validierungsdetails**, die Zeile „n Hinweise ›“ in **Konsistenz** (öffnet direkt **Hinweise**), die Karte mit
  Fehlern in **Worauf achten**.
  Nach einem GEDCOM-Import fragt die App („Datenprüfung“) nur, wenn sie Fehler oder Warnungen findet
  ([A2](A2-loading-a-family-tree.md)).
  Dasselbe nach dem Zusammenführen mit einem anderen Stammbaum, für neue Befunde. Einen eigenen Menüpunkt hat die
  Prüfung nicht.
- **Gilt seit:** App 1.0.0; Abschnitte **Probleme** und **Hinweise** App 3.17.0

<!-- zdroj: app:src/validation.ts:83 validateTreeData, :1370 groupValidationIssues · src/ui/tree-stats.ts:101 LONG_GROUP, :148 showTreeValidationDialog · src/ui/import-export.ts:1341 offerPostImportValidation · src/ui/merge/ui.ts:1515 · strings.ts treeManager.validationTitle, valProblems, valLeads, leadsIntro, valReadOnly, valShowMore, postImportCheck -->

<a id="A5.1.1"></a>
### A5.1.1 Behebung mit einem Klick

Manche Befunde haben die Schaltfläche **Beheben** und die Gruppe **Alle beheben (n)**. Eine Behebung ist ein
Schritt zurück („eine Prüfungsreparatur“) und wird im Änderungsverlauf erfasst.

| Befund | Was die Behebung tut |
|---|---|
| Verweis auf nicht vorhandenen Datensatz, Beteiligter ohne Person | entfernt den Verweis |
| Elternteil fehlt Verweis auf das Kind, Kind auf die Eltern, Person auf die Partnerschaft | ergänzt den fehlenden Verweis (Eltern nur bei einem Kind mit weniger als 2 Eltern) |
| Partnerschaft mit sich selbst | entfernt sie |
| Doppelte Partnerschaft | behält die erste, überträgt die Kinder auf sie |
| Ein Ort auf mehrere Arten geschrieben | schreibt alle Schreibungen auf die häufigste um |

- **Gilt seit:** App 1.1.0; Behebung von Orten 1.10.0

<!-- zdroj: app:src/data.ts:4071 FIXABLE_TYPES, :4097 repairValidationIssue · strings.ts treeManager.valFix, valFixAll -->

<a id="A5.2"></a>
## A5.2 Verbindungen in der Familie

Die Prüfung sucht Verbindungen, die nicht gelten können. Alle sind Fehler, außer der doppelten Partnerschaft
(Warnung).

| Befund in der App | Wann |
|---|---|
| **Vorfahrenzyklus erkannt** | eine Person ist ihr eigener Vorfahr; gemeldet wird nur der erste Zyklus |
| **Partnerschaft mit sich selbst** / **Doppelte Partnerschaft** | der Partner ist dieselbe Person / zwei Partnerschaften desselben Paares |
| **Elternteil fehlt Kindverweis**, **Kind fehlt Elternverweis**, **Partnerschaft-Kind-Abweichung** | die Verbindung ist nur von einer Seite erfasst |
| **Verweis auf nicht vorhandenen Datensatz** | Elternteil, Kind, Partner oder Partnerschaft fehlt |
| **Ereignisbeteiligter verweist auf eine nicht mehr vorhandene Person** | Pate oder Zeuge (auch Trauzeuge) ist eine gelöschte Person |
| **Mehr als 2 Eltern** | |
| **Person in mehreren Generationen** | das Zählen der Generationen stößt auf einen Widerspruch; der Partner ist in derselben Generation |
| **Partner ist auch Elternteil / Kind**, **Geschwister ist auch Elternteil / Kind** | |

- **Gilt seit:** App 1.0.0; Ereignisbeteiligter 1.16.0

<!-- zdroj: app:src/validation.ts:142 checkCycles, :200, :223, :255, :293, :346-464 orphaned*, :471 tooManyParents, :554 generationConflict, :621 · strings.ts treeManager.val* -->

<a id="A5.3"></a>
## A5.3 Daten und Alter

Die Prüfung meldet nur, was sicher nicht gilt. Ein unvollständiges oder ungefähres Datum rechnet sie im ganzen
möglichen Bereich: ohne Monat Januar bis Dezember, „um“ ± 2 Jahre, „vor“ bis 20 Jahre früher, „nach“ bis 20 Jahre
später, ein Zeitraum bis zu seinem Ende. Erst wenn der Verstoß im ganzen Bereich gilt, ist es ein Befund.

| Befund in der App | Schweregrad | Wann |
|---|---|---|
| **Sterbedatum liegt vor dem Geburtsdatum** | Fehler | |
| **Unplausibel lange Lebensdauer** | Warnung | mehr als 115 Jahre |
| **Elternteil jünger als Kind** | Fehler | nach dem Geburtsdatum |
| **Elternteil bei Geburt sehr jung / sehr alt** | Warnung | unter 12 / über 80 Jahre; nur Geburtsdaten |
| **Ereignis vor der Geburt datiert** | Warnung | |
| **Ereignis nach dem Tod datiert** | Warnung | außer: Beerdigung, Einäscherung, Testament, Nachlassverfahren |
| **Kind nach dem Tod der Mutter geboren** | Fehler | mehr als 1 Monat nach dem Tod; nur leibliche Eltern |
| **Kind lange nach dem Tod des Vaters geboren** (… **eines Elternteils**, Geschlecht unbekannt) | Warnung | mehr als 10 Monate |
| **Hochzeit vor der Geburt eines Partners datiert** | Fehler | |
| **Hochzeit nach dem Tod eines Partners datiert** | Warnung | |
| **Als Kind verheiratet** | Warnung | unter 14 Jahren |
| **Extremer Altersunterschied zwischen Partnern** | Info (**Hinweise**) | 40 Jahre und mehr |
| **Geburt/Tod als Lebensereignis erfasst** | Fehler | Geburt oder Tod in der Liste der Ereignisse |
| **Eigenes Ereignis hat keine Bezeichnung** / **Ereignis hat ein ungültiges Datum** | Warnung | |

- **Grenzen:** dieselben Ausnahmen nach dem Tod hat `strom check` der Forschung. Ein Elternteil ohne Art der
  Beziehung zählt als leiblich.
- **Gilt seit:** App 1.0.0 (Alter der Eltern); 1.4.0 (Ereignisse); 1.7.0 (Daten und Tod); Kind nach dem Tod eines
  Elternteils unbekannten Geschlechts 3.10.0; vier Ausnahmen nach dem Tod 3.17.0 (vorher nur Beerdigung)

<!-- zdroj: app:src/validation.ts:493 checkAgePlausibility MIN_PARENT_AGE MAX_PARENT_AGE, :863 checkDateConsistency MAX_LIFESPAN_YEARS CHILD_MARRIAGE_YEARS PARTNER_AGE_GAP_YEARS POSTHUMOUS_FATHER_MONTHS AFTER_DEATH_EVENT_TYPES, :120 checkLifeEvents · monthRange, certainlyBefore · research:src/core/afterdeath.ts AFTER_BY_NATURE · strings.ts treeManager.val* -->

<a id="A5.4"></a>
## A5.4 Quellen, Anhänge und Verschmelzung beim Import

| Befund in der App | Schweregrad | Wann |
|---|---|---|
| **Zitat verweist auf eine fehlende Quelle** | Warnung | Zitation bei einer Person, einem Ereignis, einer Partnerschaft oder einem Anhang |
| **Anhang hat keine verwendbaren Daten** | Warnung | die Daten sind weder Bild noch PDF (ein Anhang nur mit Original wird nicht gemeldet) |
| **Foto ist kein unterstütztes Bild** | Warnung | ein anderes Format als JPEG, PNG, WebP, GIF |
| Wahrscheinlich zwei Personen, die beim Import einer GEDCOM-Datei zu einer verschmolzen sind (Strom 3.8.1 und älter) … | Fehler | siehe unten |

Ältere Versionen konnten beim Import zwei Personen dieselbe ID geben. Die Prüfung meldet das bei einem klaren
Zeichen (mehr als 2 Eltern, eine Person ist selbst ihr Elternteil, Kind oder Partner) oder wenn ein Kind früher als
12 Jahre nach dem Elternteil geboren ist und dazu Eltern oder Partner desselben Geschlechts vorliegen. Eltern
desselben Geschlechts allein ergeben keinen Befund. Die Lösung steht im Text des Befunds: die ursprüngliche Datei
erneut als neuen Stammbaum importieren.

- **Gilt seit:** App 1.7.0 (Quellen und Anhänge); 3.0.0 (Fotos); 3.9.0 (Verschmelzung beim Import)

<!-- zdroj: app:src/validation.ts:982 checkSourceIntegrity, checkPhotoData, :1199 checkImportMerges · strings.ts treeManager.valCitationMissingSource, valAttachmentNoData, valPhotoUnsafeData, valImportMerge -->

<a id="A5.5"></a>
## A5.5 Hinweise: Paten und Schreibungen von Orten

**Hinweise** sind keine Fehler. Sie zeigen, wo eine Verwandtschaft oder eine uneinheitliche Schreibung liegen kann.

- **Ein Pate, der immer wieder auftaucht — oft ein Verwandter:** derselbe Pate oder Zeuge ist bei Ereignissen von
  mindestens 2 Personen, die miteinander nicht verwandt sind, und diese Personen gehören zu mindestens 2
  Geschwistergruppen. Die Zeile zeigt, bei wie vielen Ereignissen und Personen.
  Beispiel: Marie Vlková ist Patin der Kinder der Horáks und der Kinder ihrer Nachbarn.
- **Ein Ort auf mehrere Arten geschrieben:** Schreibungen, die sich nur in Groß- und Kleinschreibung, Diakritik oder
  einem Punkt oder Komma unterscheiden, z. B. „Brno“ und „brno.“. Die Zeile zeigt jede Schreibung mit ihrer Anzahl;
  die Behebung steht in [A5.1.1](#A5.1.1).
- **Grenzen:** Verwandte sind Personen höchstens 3 Schritte über Eltern, Kinder und Partner entfernt. Gezählt werden
  Beteiligte an Ereignissen der Person, Trauzeugen und Beteiligte an gemeinsamen Ereignissen des Paares. In den
  **Hinweisen** steht auch der Altersunterschied der Partner ([A5.3](#A5.3)).
- **Gilt seit:** App 1.10.0 (Orte); 1.16.0 (Paten); Geschwistergruppen und Amtspersonen 3.17.0

<!-- zdroj: app:src/godparents.ts:42 RECURRING_THRESHOLD, :188 recurringParticipants, :270 siblingGroupCount, :300 godparentLeads · src/validation.ts:1034 checkPlaceSpellings, checkRecurringGodparents · strings.ts treeManager.valRecurringGodparent, valRecurringGodparentDetail, valPlaceSpelling, leadsSkipped -->

<a id="A5.5.1"></a>
### A5.5.1 Wie derselbe Pate erkannt wird

- Eine mit dem Stammbaum verbundene Person wird am Datensatz erkannt. Ein nur erfasster Name wird als Text verglichen,
  die Zeile hat dann „nach Namen abgeglichen“.
- Aus der Schreibung wird der Name bis zum ersten Komma, Kleinbuchstaben oder zur ersten Ziffer genommen. Titel und
  Anreden (kmotr, pan, Mgr. …) werden ausgelassen, Partikeln (von, de …) bleiben, Text in Klammern ist eine Notiz.
  Verglichen wird ohne Diakritik und ohne Groß- und Kleinschreibung.
- Der Name muss mindestens 2 Wörter haben. Ein Vorname allein stimmt nie überein.
- Nicht gemeldet wird, wer von Amts wegen beim Ereignis ist: der Trauende, die Hebamme und Geistliche (farář,
  kaplan, Pfarrer, parochus …). Ein als Pate erfasster Geistlicher wird gemeldet.

<!-- zdroj: app:src/godparents.ts:48 NAME_PARTICLES, :54 NAME_PREFIXES, :80 participantName, :117 CLERGY_WORDS, :121 MIDWIFE_WORDS, :134 attendsByOffice · strings.ts treeManager.valRecurringGodparentByName -->

<a id="A5.6"></a>
## A5.6 Mögliche doppelte Person

Zwei Personen sind möglicherweise dieselbe, wenn sie denselben Nachnamen und denselben Vornamen haben und in denselben
Jahren geboren sind. Verglichen wird ohne Groß- und Kleinschreibung und ohne Diakritik. Der Befund steht in den
**Hinweisen** in der Gruppe **Mögliche doppelte Person**.

- **Grenzen:**
  - Geburtsjahr: das Geburtsdatum; ohne es die Taufe (Jahr der Taufe oder das Jahr davor); ohne sie Tod oder
    Beerdigung mit dem Alter beim Tod. Stammen beide Jahre aus der Geburt, müssen sie sich überschneiden. Sonst
    dürfen sie 2 Jahre auseinanderliegen.
  - Fehlt der Vorname bei einer Person, genügen Nachname und Jahre.
  - Personen ohne Datum werden nur bei völlig gleichem Namen gepaart. Eine Person mit Datum wird nicht mit einer
    Person ohne Datum gepaart.
  - Nicht gemeldet werden: Platzhalter- und namenlose Personen, unvereinbares Geschlecht, Elternteil und Kind sowie
    Paare, bei denen eine Person sicher vor der Geburt (oder Taufe) der anderen gestorben ist.
- **Bedienung:** **Zwei verschiedene Personen** ([A5.7](#A5.7)); beim Urteil der Forschung **Zusammenführen…**
  ([A5.6.1](#A5.6.1)).
- **Gilt seit:** App 1.9.9; Jahre aus Taufe und Tod 3.17.0

<!-- zdroj: app:src/validation.ts:1084 birthYears, :1127 checkPossibleDuplicates STAND_IN_YEARS_SLACK · strings.ts treeManager.valGroupPossibleDuplicate, twoPeople -->

<a id="A5.6.1"></a>
### A5.6.1 Urteil der Forschung

Bei einem Stammbaum aus der Forschung fragt die App beim Öffnen des Dialogs die Forschung nach allen Paaren. Der
Dialog wartet nicht auf die Antwort. Die Forschung bewertet nur Personen, die ihre Nummer haben (P…). Es entscheidet
die erste Regel, die gilt:

| Reihenfolge | Die Forschung hat festgestellt | Urteil in der App |
|---|---|---|
| 1 | sie kennt die Person nicht | keines |
| 2 | sie hat die Personen schon zusammengeführt | **In der Forschung zusammengeführt** |
| 3–9 | vom Menschen markierte zwei Personen; anderes Geschlecht; Elternteil und Kind; Geburt oder Taufe mehr als 3 Jahre auseinander; einer starb, bevor der andere geboren wurde; Geschwister (das zweite Kind erhielt den Namen des verstorbenen); andere Eltern | **Zwei Personen** |
| 10 | die Namen unterscheiden sich in der Forschung | **Unsicher** |
| 11–12 | dieselben Eltern und bekannte Jahre; derselbe Eintrag in einer Quelle bei beiden | **Wahrscheinlich dieselbe Person** |
| 13–14 | nahe Jahre und nichts weiter; bei einer Person kein Datum | **Unsicher** |

- **Grenzen:**
  - Paare mit dem Urteil **Wahrscheinlich dieselbe Person** und **In der Forschung zusammengeführt** rücken nach
    oben, dann **Unsicher**, dann ohne Urteil.
  - Paare **Zwei Personen** kommen beiseite in die Zeile **Von der Forschung unterschieden: n** und werden nicht
    gezählt.
  - Ein Urteil, das in eine offene Gruppe kommt, fügt nur ein Etikett hinzu. Neu eingeordnet wird erst beim nächsten
    Öffnen.
  - Unter der Gruppe steht **Die Forschung bewertet…** oder **Von der Forschung bewertet**. Läuft eine Forschung
    nicht, die bei der letzten Verbindung bewertet hat: „Ohne Bewertung der Forschung – die Forschung läuft nicht.“
    Eine Forschung, die nicht bewerten kann, wird nicht erwähnt.
- **Bedienung:** beim Urteil **Zusammenführen…** (Zusammenführen von Personen) oder **Neue Version laden** ·
  Terminal: `strom person compare P… P…`, für viele Paare `--pairs-from`. Verbindung mit der Forschung:
  [S1](S1-connecting-app-and-research.md).
- **Gilt seit:** App 3.17.0 (Forschung 1.22.0)

<!-- zdroj: app:src/duplicate-verdicts.ts:18 MAX_JUDGE_PAIRS, :54 issueResearchPair, :142 verdictRank, :154 verdictsMode, :192 verdictReasonText · src/quality-bridge.ts:172 postDuplicates · strings.ts treeManager.verdict*, reason* · research:src/core/duplicates.ts judge YEARS_CLOSE · src/core/live.ts:168-192 · src/commands/quality.ts person compare -->

<a id="A5.6.2"></a>
### A5.6.2 Hinweis beim Erfassen einer Person

Beim Erfassen einer neuen Person zeigt die App höchstens 3 ähnliche Personen („Ähnliche Personen existieren
bereits:“). Sie vergleicht anders als [A5.6](#A5.6): mit einem Ähnlichkeitswert wie beim Zusammenführen, nie mit
unvereinbarem Geschlecht.
- **Bedienung:** **Zur Person**, **Vorhandene verwenden** · ausschalten mit **Einstellungen → Hinweise →
  Duplikat-Vorschläge**.
- **Gilt seit:** App 1.4.0

<!-- zdroj: app:src/ui/duplicate-suggest.ts:22 MAX_SUGGESTIONS, :75 runDuplicateCheck · findSimilarPersons SIMILAR_PERSON_THRESHOLD · strings.ts duplicateSuggest.settingLabel, useExisting -->

<a id="A5.7"></a>
## A5.7 Kein Fehler

Ein Befund, der kein Fehler ist, wird markiert. Danach wird er nicht mehr gemeldet, auch wenn der Stammbaum erneut
geprüft wird.
Die Markierung ist eine Änderung des Stammbaums: sie hat einen Schritt zurück und einen Eintrag im Änderungsverlauf.
Bei einer möglichen doppelten Person heißt die Schaltfläche **Zwei verschiedene Personen**.

- **Grenzen:**
  - Denselben Befund erkennt die App an Art, Personen und Gegenstand. Gegenstand ist das Jahr bei einem Ereignis oder
    einer Hochzeit nach dem Tod, der Name bei einem Paten und die häufigste Schreibung bei einem Ort. Ändert sich
    etwas davon, erscheint der Befund wieder.
  - Bei einem Stammbaum aus der Forschung wird die Markierung an die Forschung gesendet, wenn alle Personen des
    Befunds eine Nummer der Forschung haben (höchstens 20 Personen). Die GEDCOM-Datei aus der Forschung trägt keine
    Markierungen; beim Laden einer neuen Version werden sie aus der alten Version des Stammbaums übernommen.
  - Die Forschung respektiert Markierungen bei einem Ereignis und einer Hochzeit nach dem Tod: `strom check` meldet
    sie nicht, und der Agent untersucht sie nicht.
  - Stand der Markierung: **An die Forschung gesendet**, **Wartet auf die Forschung** (die Forschung läuft nicht,
    gesendet wird bei der nächsten Verbindung), **Nur in der App** (die Forschung hat sie nicht angenommen oder die
    Personen haben keine Nummer; sie wird nicht erneut gesendet), **In der Forschung markiert**.
  - Eine Markierung bei einem Ort hat keine Personen, darum wird sie nicht an die Forschung gesendet. Beim Abtrennen
    eines Teils des Stammbaums bleiben nur Markierungen, deren Personen alle bleiben.
  - Eine in der Forschung erfasste Markierung kennt die App nur beim geöffneten Stammbaum aus der Forschung, wenn die
    Forschung läuft.
- **Bedienung:** in der Zeile des Befunds **Kein Fehler** / **Zwei verschiedene Personen**, 6 s lang das Angebot
  **Rückgängig**. Die Liste **Als kein Fehler markiert: n** unter den Befunden, bei jeder Markierung das Datum oder
  **In der Forschung markiert**, Schaltfläche **Wiederherstellen** · Terminal: `strom quality list`,
  `strom quality dismiss possibleDuplicate P… P…`, `strom quality dismiss eventAfterDeath P… --subject 1861`,
  `strom quality undo …`. Die Markierung setzt nur der Mensch, nie der Agent.
- **Gilt seit:** App 3.17.0 (Forschung 1.22.0)

<!-- zdroj: app:src/validation.ts:1415 qualityFinding · src/quality-dismiss.ts:47 sanitizeQualityDismissed, :152 dismissalFor, :186 dismissBody, mergeResearchMarks, carryOverTreeDecisions, dismissalsWithin · src/quality-bridge.ts:74 dismissReply · src/ui/quality-ui.ts:155 flushQuality, :257 readQualityMarks · src/data.ts:1674 dismissQualityFinding · src/ui/tree-stats.ts:104 DISMISS_TOAST_MS · strings.ts treeManager.notAnError, twoPeople, dismissedRow, sentToResearch, waitingForResearch, appOnly, markedInResearch · research:src/commands/quality.ts PERSON · src/core/afterdeath.ts -->

<a id="A5.8"></a>
## A5.8 Stammbaum-Überblick → Datenqualität

Der Abschnitt fasst die Prüfung und die Vollständigkeit des Stammbaums zusammen. Er zählt wie der Dialog, ohne
markierte Befunde und ohne Paare, die die Forschung unterschieden hat.

| Block | Was er zeigt |
|---|---|
| **Konsistenz** | Zusammenfassung („2 Fehler, 1 Warnung, 3 Hinweise.“), die 5 schwersten **Probleme**, „und n weitere…“, die Zeile „n Hinweise ›“ |
| **Vollständigkeit** | Anteil der Personen mit **Geburtsdatum**, **Sterbedatum (Verstorbene)**, **Geburtsort**, **Foto**; unter 50 % hervorgehoben; „Inhalt:“ (Fotos, Ereignisse, Quellen, Anhänge) |
| **Sicherheit der Forschungsangaben**, **Wo Belege fehlen** | Belege, siehe [R3.8](R3-verification-and-citation.md#R3.8) und [A3](A3-evidence-in-the-app.md) |
| **Struktur** | Zahl der Verbindungen; unverbundene Teile oder „Alle Personen sind zu einer Familie verbunden.“ |
| **Schnellaktionen** | **Validierungsdetails**, **Verwaiste Orte bereinigen (n)**, **In Familien aufteilen** |

- **Grenzen:**
  - Über 10 MB an Fotos und Anhängen kommt eine Warnung hinzu. Ein verwaister Ort ist ein Ort, auf den nichts
    verweist.
  - Ein unverbundener Teil hat keinen Weg zur Hauptfamilie; er lässt sich abtrennen (**Nicht verbundene Teile
    trennen**).
  - Die Karte in **Worauf achten** zeigt die Zahl der Fehler und die häufigste Art. Sie hat die Schaltfläche
    **Beheben** (geöffneter Stammbaum) oder **Validierungsdetails**; beide öffnen den Dialog.
- **Bedienung:** **Stammbaum-Überblick → Datenqualität**; im Angebot des Stammbaums auch direkt **Datenqualität**.
  Aktionen, die Daten ändern, gehen nur im geöffneten Stammbaum.
- **Gilt seit:** App 3.13.0; Hinweise und Markierungen 3.17.0

<!-- zdroj: app:src/ui/tree-overview.ts:101 TOP_ISSUES, :108 LOW_SHARE, :1882 treeOverviewQualityHtml, :925 selectFocusCards · src/ui/tree-actions.ts:191 overview-quality · strings.ts treeOverview.consistencyTitle, completenessTitle, field*, contentLabel, mediaWarning, structureTitle, allConnected, quickActions, actValidation, actCleanPlaces, actSplitFamilies, cardValidation -->
