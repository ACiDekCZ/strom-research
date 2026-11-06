<a id="S2"></a>
# S2 Änderungen aus der App in der Forschung

Was aus der App an die Forschung gesendet wird, wann, was die Forschung damit tut und was sie nicht annimmt.
Beschrieben werden die Strom-App 3.21.2 (und die Forschung 1.25.2). Wie sich die App mit der Forschung verbindet, beschreibt [S1](S1-connecting-app-and-research.md). Was aus
der Änderung einer belegten Angabe wird, beschreibt [R5.2](R5-conflicts.md#R5.2).

<a id="S2.1"></a>
## S2.1 Maßgeblich ist der Stammbaum in der App

Der Stammbaum in der App und der Stammbaum in der Forschung sind zwei Kopien. Änderungen aus der App gehen in die
Forschung, indem der ganze Stammbaum gesendet wird. Die Forschung vergleicht, was sie der App gegeben hat, was
gekommen ist und was sie jetzt hat, und schreibt nur, was sich in der App geändert hat. Was die Forschung nicht
schreibt, bleibt in der App und ist zu sehen.

- **Grenzen:**
  - Was die Forschung inzwischen selbst getan hat, nimmt sie nie als Änderung aus der App, die das zurücknehmen
    würde.
  - Ein Stammbaum aus einem anderen Programm oder ein älterer Export ohne Angabe, aus welcher Version der Forschung
    er entstand: die Forschung nimmt nur neue Angaben und zeigt Unterschiede nur an.
  - Ein Senden ist in der Geschichte der Forschung ein Eintrag mit einer Quelle und lässt sich zurücknehmen
    ([S2.7](#S2.7)).
- **Gilt seit:** Forschung 1.0.0

<!-- zdroj: research:src/core/sync.ts (v1.25.2) :1-19 · app:strings.ts treeSettings.principles -->

<a id="S2.2"></a>
## S2.2 Wann Änderungen gesendet werden

Jeder Stammbaum aus der Forschung hat seine Art des Sendens. Gewählt wird sie im Fenster **Forschung für diesen
Stammbaum**, Abschnitt **Änderungen senden**.

| Auswahl | Was geschieht |
|---|---|
| **Manuell** | gesendet wird erst mit der Schaltfläche **Senden**; vorher ist **Was gesendet wird** zu sehen |
| **Automatisch** | Änderungen werden nach einer Weile Ruhe von selbst gesendet |
| **Nur aus der Forschung laden (nichts senden)** | nichts wird gesendet, aus der Forschung wird nur geladen |

- **Grenzen:**
  - Standardauswahl: **Manuell** bei einer Forschung mit Agent, **Automatisch** beim Strom-Archiv und bei einer
    Forschung, die auf einen Agenten wartet. Ein Stammbaum, der vor App 3.9.0 mit der Forschung verbunden wurde,
    sendet automatisch. Bei einem solchen Stammbaum und bei einem aus der Forschung geöffneten Stammbaum fragt die
    App einmal **Wie sollen Änderungen an die Forschung gehen?**; die bisherige Art ist mit **(bisher)** markiert.
  - **Automatisch** sendet Änderungen nach 2 Minuten ohne weitere Änderung, beim Wechsel zu einem anderen
    Stammbaum und beim Verlassen der Seite. Es sendet nur an eine laufende Forschung und immer nur für einen
    Stammbaum auf einmal.
  - Ein live verfolgter Stammbaum ist schreibgeschützt und sendet nichts ([S1](S1-connecting-app-and-research.md)).
  - Die Forschung läuft nicht: Änderungen warten und werden nach ihrem Start gesendet. **Senden** kann sie mit
    einem Link im Terminal starten.
  - Auf die Antwort der Forschung wartet die App höchstens 2 Minuten. Dann zeigt sie **Die Forschung hat nicht
    rechtzeitig geantwortet**; die Änderungen bleiben in der App.
  - Nach dem Umschalten von **Nur aus der Forschung laden** geht das erste Senden immer von Hand über **Was
    gesendet wird**.
  - Gesendet wird nur vom Computer, auf dem die Forschung läuft. Das Telefon sendet keine Änderungen
    ([S5](S5-phone.md)).
- **Bedienung:** App: **Forschung → Weitere Aktionen → Forschung für diesen Stammbaum… → Änderungen senden**;
  Schaltfläche **Senden** (**An Forschung senden**); **Jetzt senden**; **Nächstes Mal ohne Vorschau senden**
- **Gilt seit:** App 3.9.0 (Forschung 1.12.0); Senden beim Verlassen der Seite seit App 3.16.0

<!-- zdroj: app:src/research-sync.ts:43 newTieSendMode · src/types.ts:1735 ResearchLink.sendMode · src/ui/research-sync-ui.ts (v3.21.2) AUTO_QUIET_MS :136, SEND_TIMEOUT_MS :130, pagehide :428, researchAutoSend :1438, researchSendNow · src/ui/research-tree-settings-ui.ts researchSendModeCardsHtml, maybeAskResearchSendMode · strings.ts treeSettings.sending, auto, manual, off, askTitle, askWas, deviceNote · changes.skipPreview · sync.sendNoAnswer, sync.sendWhenRunning · CHANGELOG.cs.md 3.16.0 -->

<a id="S2.2.1"></a>
### S2.2.1 Was gesendet wird

Vor einem manuellen Senden zeigt die App die Liste **Was gesendet wird**: geänderte Personen (neue Person, gelöscht,
Name, Geburt, Tod, Heirat, Ereignis, Paten, Zeugen), geänderte Quellen mit den Stellen, an denen sie zitiert sind,
Paare, Orte mit neuen Koordinaten und Varianten von Nachnamen. Jede Gruppe hat einen eigenen Abschnitt. Nach dem
Schreiben zeigt sie auf dieselbe Weise **Was geschrieben wurde** mit den Abschnitten **Übernommen** und **Nicht
übernommen**.

- **Grenzen:** lässt sich die genaue Liste nicht berechnen, wird der Stammbaum gesendet, wie er ist, und die
  Forschung schreibt nur die Unterschiede.
- **Gilt seit:** App 3.14.0

<!-- zdroj: app:strings.ts changes.willSendTitle, changes.kind*, changes.inexact, changes.writtenSection, changes.notWrittenSection · CHANGELOG.cs.md 3.14.0 -->

<a id="S2.3"></a>
## S2.3 Was die Forschung mit gesendeten Änderungen tut

Eine Forschung mit Agent schreibt ein Senden sofort. Eine neue Angabe oder Person aus der App ist immer **Hinweis**
mit der Quelle „Änderungen in der Strom-App“, nie Belegt. Die Änderung einer durch einen Eintrag belegten Angabe wird
zum Widerspruch. Die genauen Regeln stehen in [R5.2](R5-conflicts.md#R5.2); Abschriften von Quellen aus der App in
[R3.5.1](R3-verification-and-citation.md#R3.5.1).

- **Grenzen:**
  - Mit der Option der Forschung `sync.review on` schreibt die Forschung ein Senden nicht sofort. Sie wartet auf das
    Wort des Menschen im Terminal ([R6](R6-awaiting-action.md)); die App zeigt inzwischen **Wartet auf Bestätigung
    in der Forschung.**
  - Nach dem Schreiben lädt die App selbst die neue Version der Forschung, wenn dabei in der App nichts verloren
    ginge.
  - Durch ein Senden entstandene Widersprüche zeigt die App mit der Meldung **Geschrieben, N Widersprüche zu
    entscheiden** mit **Anzeigen**. Entschieden wird in der Forschung (**In der Forschung entscheiden**); der Wert
    aus der App bleibt bis dahin in der App.
- **Bedienung:** Terminal: `strom config set sync.review on|off`, `strom config set sync.edits conflict|user`
  ([R5.2.1](R5-conflicts.md#R5.2.1)). App: das Fenster **Forschung für diesen Stammbaum** zeigt, was die Option
  bedeutet („Änderungen werden in der Forschung erst nach Bestätigung geschrieben.“).
- **Gilt seit:** Forschung 1.5.0; `sync.review` seit 1.12.0

<!-- zdroj: research:src/core/sync.ts (v1.25.2) :1-19 · src/core/config.ts:285 sync.review · src/core/live.ts accepts() :1455 sync.auto write|off|mirror · app:src/ui/research-sync-ui.ts :1-21 · strings.ts sync.statePendingSub, sync.flyConflict, sync.showConflicts, sync.decideInResearch, sync.writtenConflictsSub, treeSettings.effectReview -->

<a id="S2.4"></a>
## S2.4 Strom-Archiv und Forschung ohne Agent

Das Strom-Archiv und eine Forschung, die auf ihren Agenten wartet, spiegeln den Stammbaum aus der App: es gilt das
Wort aus der App. Sie schreiben jedes Senden sofort, auch wenn `sync.review` eingeschaltet ist.

- **Grenzen:**
  - Die Änderung einer durch einen Eintrag belegten Angabe legt keinen Widerspruch an; die Angabe aus dem Eintrag
    wird mit Begründung zurückgezogen. Der Widerspruch der Eltern und der Widerspruch einer entfernten Person
    entstehen auch hier ([R5.2.1](R5-conflicts.md#R5.2.1)).
  - Was in der App gelöscht wird, legt die Forschung mit Begründung beiseite, und es lässt sich zurückholen.
  - Was das Strom-Archiv hat und dieses Fenster der App nie hatte, löscht das Archiv nicht. Die App nennt das bei
    nicht übernommenen Änderungen: **das Strom-Archiv behält sie weiterhin: dieses Fenster hatte diese Angaben nie**.
  - Aufgaben, eine Abschrift aus der App zu prüfen, entstehen hier nicht, weil niemand liest
    ([R3.5.1](R3-verification-and-citation.md#R3.5.1)).
- **Gilt seit:** Forschung 1.12.0

<!-- zdroj: research:src/core/sync.ts (v1.25.2) :2283-2287 mirror = actsAsArchive, gone :2355 · app:strings.ts treeSettings.effectArchive, sync.notWrittenKept, sync.archiveBridgeDownSub · spec 002 -->

<a id="S2.5"></a>
## S2.5 Was die Forschung nicht annimmt

Die Forschung kann ein Senden ganz ablehnen oder nur einen Teil schreiben. Änderungen, die sie nicht geschrieben hat,
bleiben in der App, und nichts geht verloren.

| Wann | Was die App sagt |
|---|---|
| der Stammbaum ist größer als 200 MB | der Stammbaum ist zu groß, um ihn so zu senden; er lässt sich als GEDCOM exportieren und in der Forschung laden |
| der Stammbaum gehört zu einer anderen Forschung | dieser Stammbaum gehört zu einer anderen Forschung |
| der Stammbaum sieht nicht nach dem Stammbaum dieser Forschung aus | er lässt sich exportieren und in der Forschung als weiterer Stammbaum laden |
| der Stammbaum kam leer oder unlesbar an | der Stammbaum kam leer oder unlesbar an |
| die Forschung übernimmt den Stammbaum gerade | die Forschung übernimmt diesen Stammbaum gerade |
| die Kopie des Stammbaums hat noch keine Nummern der Personen der Forschung | **Nicht gesendet.** Zuerst **Version der Forschung laden** |

- **Grenzen:**
  - Das Schreiben stellt die Forschung zurück, wenn der Stammbaum auf einem anderen Computer versiegelt ist (**Auf
    diesem Computer übernehmen**), wenn die Dateien im Cloud-Ordner noch nicht heruntergeladen sind oder wenn der
    Datenträger voll ist. Die Änderungen warten bis dahin ungesendet.
  - Schreibt die Forschung nur einen Teil, zeigt die App **Übernommen N, nicht übernommen M** und bei jeder
    nicht übernommenen Änderung den Grund (zum Beispiel „keine gemeinsame Grundlage: in der Forschung wählen“).
  - Nach einer Ablehnung hält das automatische Senden an. Von selbst wird erst nach einer weiteren Änderung wieder
    gesendet.
- **Bedienung:** App: **Die Forschung hat die Änderungen nicht angenommen** im Panel der Forschung, **Erneut
  versuchen**, **Details (zum Weitergeben)**
- **Gilt seit:** App 3.11.0 (Forschung 1.12.0); zurückgestelltes Schreiben seit Forschung 1.20.0
- **Ab Forschung 1.26.0:** ein großer Stammbaum (etwa 1.500 Personen und mehr), der unter Windows übernommen wird,
  wird ganz geschrieben. Früher endete das mit einem Git-Fehler über einen zu langen Befehl (ENAMETOOLONG), und
  nichts wurde geschrieben.

<!-- zdroj: research:src/core/sync.ts (v1.25.2) SYNC_MAX_BYTES :1325, tree.empty :1218, tree.other-research :2038, tree.foreign :2068, tree.no-ids :2345 · src/core/live.ts seal.foreign, tree.not-downloaded, disk.full · app:src/research-write-held.ts · strings.ts sync.refusedCodes, sync.refusedDetails, sync.noIdsToast, sync.held, sync.writtenCount, sync.notWrittenPick, sync.rejectedAutoSub · 1.26.0: research:src/core/git.ts commitAll po částech (commit 0e7238fc) -->

<a id="S2.6"></a>
## S2.6 In der App entfernte Person

Eine Forschung mit Agent löscht eine Person oder Angabe, die in der App verschwunden ist, nicht selbst. Sie vermerkt
das Entfernen nur, und die App nennt bei nicht übernommenen Änderungen: „nur hier entfernt: die Forschung hat das
Entfernen vermerkt, löscht aber nichts von selbst; löschen lässt es sich in der Forschung“. Das Strom-Archiv
spiegelt das Entfernen ([S2.4](#S2.4)).

- **Grenzen:** entfernt ein Fenster der App eine Person und wird sie anderswo inzwischen bearbeitet, fragt die
  Forschung, ob die Person im Stammbaum bleibt ([R5.2](R5-conflicts.md#R5.2), Punkt 6). Die App zeigt eine Frage je
  Person:
  - **In einem anderen Fenster entfernt:** **In den Stammbaum zurückholen** oder **Entfernt lassen**;
  - **Anderswo bearbeitet:** **Aus dem Stammbaum entfernen** oder **Im Stammbaum lassen**.
  Die Entscheidung bestätigt die Forschung. Dann lädt die App ihre Version.
- **Gilt seit:** Forschung 1.0.0; Frage zur entfernten Person seit App 3.16.0 (Forschung 1.20.0)

<!-- zdroj: research:src/core/sync.ts (v1.25.2) :1-19 „What the app no longer has is only reported“, gone :2355 · app:src/ui/research-removed-ui.ts :1-14 · strings.ts sync.notWrittenReport, conflict.person.* · CHANGELOG.cs.md 3.16.0 -->

<a id="S2.7"></a>
## S2.7 Senden zurücknehmen

Ein Senden lässt sich in der Forschung zurücknehmen. Die Änderungen in der App bleiben dabei; aus der Forschung gehen
nur die Änderungen dieses Sendens.

- **Grenzen:**
  - Aus der App lässt sich das letzte Senden innerhalb von 7 Tagen zurücknehmen. Bestätigt wird im Terminal der
    Forschung.
  - Nach dem Zurücknehmen sendet die App nichts weiter, bis gewählt wird: **Erneut senden** oder das Zurücknehmen
    behalten mit **Version der Forschung laden** (ersetzt die Änderungen aus der App, eine Sicherung bleibt).
  - Das Laden der Version der Forschung lässt sich mit **Laden rückgängig machen** zurücknehmen.
- **Bedienung:** App: **Forschung → Weitere Aktionen → Letztes Senden zurücknehmen** · Terminal: `strom sync undo`
- **Gilt seit:** App 3.4.0, Forschung 1.0.0
- **Ab Forschung 1.26.0:** ein Senden zurücknehmen (`strom sync undo`) und einen gesendeten Stammbaum verwerfen, der
  wartet (`strom sync discard`), darf nur der Mensch; dem Agenten lehnt die Forschung das ab. Die Änderungen in der
  App bleiben nach dem Verwerfen und lassen sich erneut senden.

<!-- zdroj: app:src/ui/research-actions-ui.ts (v3.21.2) :448 researchActionUndoSend, UNDO_MAX_AGE_MS :152 · src/research-link.ts:73 sync-undo terminal · strings.ts research.undoSend, sync.undoneSub, sync.sendAgain, sync.loadVersion, sync.againNothing, sync.restoreBeforeLoad · research:src/core/sync.ts :19 strom sync undo · 1.26.0: src/commands/sync.ts:503 sync discard (person), sync undo (person) (commit 942c56f9) -->
