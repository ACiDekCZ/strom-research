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

<a id="S2.2.2"></a>
### S2.2.2 Folio, Bild und Signatur aus der App

Eine App, die die Felder der Quelle hält ([A3.9](A3-evidence-in-the-app.md#A3.9)), schickt der Forschung Signatur,
Folio, Bild und weitere Fundstelle in Feldern. Die Forschung vergleicht sie Feld für Feld und schreibt eine Änderung
als Änderung der Seite der Quelle.

- **Löschen:** Folio, Bild oder Signatur, die der Mensch in der App löscht, löscht auch die Forschung. Zurück bringt
  sie das Zurücknehmen des Sendens ([S2.7](#S2.7)).
- **Grenzen:**
  - eine ältere App, die die Felder nicht kennt, löscht nichts. Eine Änderung der ganzen Seite aus einer älteren App
    ersetzt die Fundstelle und löscht eingetragenes Folio und Bild (das Zurücknehmen bringt sie zurück);
  - nicht gelöscht wird ein Wert, den die Datei der App noch nennt: Folio oder Bild in der Seite (`PAGE`), eine
    Signatur als ganze Seite oder auf einer eigenen Zeile der Notiz der Quelle („Signatur: …“, in jeder Sprache).
    Lieber bleibt er, als dass gelöscht wird, was die App nicht als Feld gesehen hat;
  - die Signatur des Buches und die Bildnummer aus registrierten Scans sind keine Felder der Quelle: ein Löschen in der
    App ändert sie nicht;
  - bei einer Quelle, die die Forschung gelesen hat, wird weder eine Änderung noch ein Löschen in die Quelle
    geschrieben; geschrieben wird eine Notiz daneben („Folio/Seite: in der Strom-App entfernt (war fol. 12v)“).
- **In der Liste Was gesendet wird** ([S2.2.1](#S2.2.1)) ist eine geänderte Signatur, ein geändertes Folio oder Bild
  eine Änderung der Seite der Quelle.
- **Gilt seit:** App 3.27.0 mit Forschung 1.31.0

<!-- zdroj: research:337787ff, 87785596 src/core/sync.ts:3534 SOURCE_EDITS, SOURCE_FIELDS, :3551 removedFields (fieldsKept, entryWords, locatorOverlap, isValue, noteCallNumbers, CALL_NUMBER_LABELS), removedLine (sync.reading.removed) · 4de28f00 (úprava celé PAGE ze starší aplikace nahradí locator a smaže folio/snímek, undo vrátí) · app:c3278633 src/research-changes.ts (změna signatury, folia, snímku jako strana), src/ged-exporter.ts sourceFields · CHANGELOG.cs.md 1.31.0 · dirigent:prace/1111-vyzkum-citace-most-n1, prace/1111-vyzkum-citace-pole · spec 075 U1c B -->

<a id="S2.2.3"></a>
### S2.2.3 Welcher Stammbaum gesendet wird

An die Forschung geht immer der Stammbaum, der mit ihr verbunden ist, mit seinen eigenen Daten. Ein Wechsel zu einem
anderen Stammbaum ändert daran nichts.

- **Wechsel des Stammbaums:** die nicht gesendeten Änderungen des verlassenen Stammbaums gehen sofort
  ([S2.2](#S2.2)). Der Stammbaum, zu dem gewechselt wird, wird erst geöffnet gesendet, bei der nächsten Antwort der
  Brücke. Eine während des Wechsels gespeicherte Änderung bleibt in dem Stammbaum, in dem sie entstand.
- **Eine Kopie ohne die Personen der Forschung:** die App sendet keine Kopie, die die Personen der Forschung kaum
  trägt: die Version der Forschung, auf der der Stammbaum beruht, hat mindestens 10 Personen mit einer Nummer der
  Forschung, die Sendung trüge weniger als 10 % davon, und weniger als 10 % der gesendeten Personen trügen eine
  solche Nummer. Sie sendet sie weder von selbst noch mit **Senden** noch beim Verlassen der Seite; die Änderungen
  bleiben ungesendet in der App. Ein Senden mit der Schaltfläche sagt das in der Meldung „Nicht gesendet: Der
  geöffnete Stammbaum enthält kaum Personen dieser Forschung und würde dort als anderer Stammbaum gelten. Die
  Änderungen bleiben hier.“, **Erneut senden** einer zurückgenommenen Sendung in der Meldung „Nicht erneut
  gesendet: Diese Sendung enthielt nicht die Personen dieses Stammbaums. Die Änderungen bleiben hier.“ Das Senden
  von selbst und das Verlassen der Seite melden nichts; wartende Änderungen zeigt die Markierung.
- **Der Beispiel-Stammbaum** wird nie an eine Forschung gesendet
  ([S1.3.1](S1-connecting-app-and-research.md#S1.3.1)).
- **Grenzen:** seit Forschung 1.34.0 lehnt auch die Forschung selbst einen kleinen anderen Stammbaum unter ihrer
  Verbindung ab ([S2.5](#S2.5)). Ein zurückgenommenes Senden, das die Personen des Stammbaums nicht trug, wird nicht
  wieder angeboten ([S2.7](#S2.7)).
- **Gilt seit:** App 3.29.0

<!-- zdroj: app:7e92c784 src/data.ts switchTree/loadStartupTree (switchSeq, id stromu spolu s daty), getDataFor(treeId), save() páruje id s daty · 92f9e978 DataManager.isSwitchingTo(treeId) (odkládá se jen poslání stromu, na který se přepíná; autoDue při odpovědi mostu) · bbcc2b17 src/research-foreign-send.ts foreignSendCheck (FOREIGN_SEND_MIN_BASE 10, FOREIGN_SEND_SHARE 0.1, čísla REFN P…), src/ui/research-sync-ui.ts (auto, ruční, odchod ze stránky) · 302a2d3d (bez navigator.locks bez zámku) · CHANGELOG.cs.md 3.29.0 „Přepnutí stromu“ · prace/1115-app-prepnuti-stromu, prace/1115-app-odeslani-pred-prepnutim · hláška ručního poslání: app:65e7cba0 strings.ts sync.foreignNotSent, sync.undoneForeignNotSent (jen ručně a Poslat znovu) -->

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
- **Ab Forschung 1.32.0:** `strom sync` eines Stammbaums aus der App (JSON und GEDCOM) behält gemeinsame Ereignisse,
  Rollen, die eigenen Ereignisse **Patenschaft** und **Trauzeuge** und die Beteiligten von Ereignissen
  ([A10](A10-shared-events.md)), wie die Übernahme eines Stammbaums ([R11.3](R11-material-from-the-user.md#R11.3)).
  Eine Forschung, die den Stammbaum aus der App früher übernommen hat, korrigiert sich nicht von selbst; das nächste
  `strom sync` aus der App ergänzt, was fehlt:
  - die Notiz einer Person oder Familie, die die frühere Übernahme auf 500 Zeichen gekürzt hat, auf die ganze Notiz
    (lässt sich zurücknehmen);
  - fehlende eigene Ereignisse von Pate und Trauzeuge als neue Angaben und fehlende Beteiligte von Ereignissen;
  - eine Person oder Familie, die die Übernahme von GEDCOM in der Forschung 1.31 wegen einer langen Notiz mit einem
    Zeichen außerhalb des Grundzeichensatzes (Emoji) ausgelassen hat, wird als neu angeboten.

  Notizen von Ereignissen und Notizen von Beteiligten vergleicht `strom sync` in der Forschung 1.32.0 und 1.33.0
  nicht und ergänzt sie daher nicht; die App hält sie ganz.
- **Ab App 3.28.0:** eine Forschung älter als 1.32.0 gibt gemeinsame Ereignisse und die eigenen Ereignisse von Pate
  und Trauzeuge nicht zurück. Die App übernimmt sie beim Einlesen einer neuen Version einer solchen Forschung aus dem
  vorigen Stand des Stammbaums: die Person erkennt sie an der Nummer in der Forschung, das Ereignis an Art, Datum,
  Ort und Wert, nur wenn die Übereinstimmung eindeutig ist. Ein Ereignis, das die Forschung geändert hat, ist ein
  gewöhnliches Ereignis seiner Person; die anderen Kopien bleiben verbunden.
- **Ab Forschung 1.34.0:** `strom sync` vergleicht auch die Notiz eines Ereignisses, aus der GEDCOM-Datei wie aus
  dem JSON der App, in drei Richtungen: eine Notiz,
  die die Forschung nicht hat, ergänzt es; eine Notiz, die der Benutzer seit der letzten Übergabe geändert hat,
  korrigiert es (die vorige bleibt im Verlauf der Notiz); eine auf beiden Seiten geänderte Notiz überlässt es der
  Wahl. Eine entfernte Notiz entfernt nichts. Zeilen, die der Export in die Notiz schreibt (Stand, Worte des
  Eintrags, Alter), eigene Zeilen der Forschung und die Notiz, die die App jeder Kopie eines gemeinsamen Ereignisses
  gibt, zählen nicht als Änderung. Die Änderung lässt sich zurücknehmen. Ein vom Agenten gestartetes Sync ändert
  weder die Notiz des Benutzers noch die einer importierten Angabe. Eine neue Angabe aus der App überträgt ihre
  Notiz noch nicht.
  - **Welches Ereignis:** ein Ereignis der Datei wird dem Ereignis der Forschung zuerst nach seiner Nummer in der
    Forschung (E…) zugeordnet, die die Datei der App trägt, dann nach den Einzelheiten und dem Namen. Die Notiz eines
    Ereignisses korrigiert nie ein anderes; bei zwei gleichen Ereignissen einer Person (gleiche Art, gleicher Tag und
    gleiche Quelle), die nichts davon unterscheidet, wird bei keinem die Notiz übernommen. Ein unbearbeiteter
    Stammbaum aus der App ändert keine Notiz.
  - **Notiz eines Beteiligten:** die Notiz eines Beteiligten eines Ereignisses (Pate, Zeuge…) übernimmt die
    Forschung 1.34.0 aus der App nicht; ab Forschung 1.35.0 übernimmt sie sie nach [S2.3.2](#S2.3.2).
  - **Notizen, die zu einem ähnlichen Ereignis geschrieben wurden:** `strom sync` einer Forschung älter als 1.34.0
    konnte zu einem Ereignis die Notiz eines anderen Ereignisses derselben Person oder Familie mit gleicher Art,
    gleichem Tag, Ort und Wert schreiben, und zu einem Beteiligten seine von der App 3.28.0 gekürzte Notiz. Die
    Forschung 1.34.0 berichtigt das selbst und einmal, beim ersten Start der neuen Version oder beim Start einer
    Brücke, während niemand am Stammbaum arbeitet; gibt es etwas zu berichtigen, wird die Forschung vorher gesichert.
    Sie stellt die Notiz so wieder her, wie sie vor dem Senden war, und die geschriebene bleibt im Verlauf der Notiz.
    Eine seit diesem Senden geänderte Notiz eines Ereignisses lässt sie, wie sie ist.
    - **Ab Forschung 1.35.0:** auf jede so belassene Notiz wartet eine Aufgabe für den Menschen, in **Was wartet** und
      in der App ([R6.2](R6-awaiting-action.md#R6.2), [S4.4](S4-research-from-the-app.md#S4.4)): „Die Notiz von
      {Ereignis} ({Person}) prüfen: eine Sendung der Strom-App schrieb dort die Notiz einer ähnlichen Angabe hinein“.
      Die Aufgabe nennt die Notiz vor dem Senden, was das Senden schrieb, und die Notiz jetzt. Früher sagte es nur
      eine Zeile im Verlauf.

<!-- zdroj: research:src/core/sync.ts (v1.25.2) :1-19 · src/core/config.ts:285 sync.review · src/core/live.ts accepts() :1455 sync.auto write|off|mirror · app:src/ui/research-sync-ui.ts :1-21 · strings.ts sync.statePendingSub, sync.flyConflict, sync.showConflicts, sync.decideInResearch, sync.writtenConflictsSub, treeSettings.effectReview · 1.32.0: research:ac489205 src/core/sync.ts readStromJson (appPersonEvent, appParticipants; fact.new, fact.part, fact.share), research:f8eb2032 note.correct (zkrácená poznámka → celá), research:01125661 (NFD zkrácená poznámka), dirigent:prace/1113-vyzkum-json-intake-drobnosti bod 5 (vynechané osoby 1.31 → nové), postřeh 2 (sync poznámek událostí a účastníků) · 3.28.0: app:80c2ffb9 src/research-link.ts keepEventShares, EVENT_SHARE_FEATURE event.share, eventMatchKey · 1.34.0: research:4cfc233c src/core/sync.ts fact.note, fact.part.note (noteEdits, pick, smazání nic), dirigent:prace/1115-vyzkum-095-cli-drobnosti B1 · párování podle čísla: src/core/sync.ts planSync (byId `2 _STROM_EID`, sure), poznámka účastníka: src/core/stromapp.ts APP_SENDS_PART_NOTES undefined (dirigent:prace/1115-release-vyzkum-1.34.0 Průběh 22:02) · poznámky k podobné události: research:7a556be2 src/core/notefix.ts settleNotes, noteFixes (alike: druh, datum, místo, hodnota; wrongPartNote cut: aplikace před 3.29.0, poznámka > 200 B), applyNoteFixes (noteEdits, marker twin-notes-1), backupBeforeNotes; src/cli/main.ts (první spuštění verze), src/core/live.ts (start mostu) · 1.35.0: research:bb79ee54 askLeftNotes (origin sync:notes-left, waiting, kind other), assets/lang/cs.json notes.left.* · CHANGELOG.cs.md 1.35.0 „Poznámka změněná po odeslání z aplikace“ · dirigent:prace/1116-vyzkum-po-134 bod 2 -->

<a id="S2.3.1"></a>
### S2.3.1 Hauptzitat und entferntes Zitat aus der App

Das Hauptzitat ([A3.2.2](A3-evidence-in-the-app.md#A3.2.2)) und eine von einer Angabe entfernte Zitation
([A3.2.3](A3-evidence-in-the-app.md#A3.2.3)) übernimmt die Forschung als Änderung des Benutzers. Jede lässt sich
zurücknehmen ([S2.7](#S2.7)), und der Verlauf der Forschung sagt, wer und wann.

- **Hauptzitat:**
  - die in der App markierte Zitation ist auch in der Forschung das Hauptzitat
    ([R3.4.5](R3-verification-and-citation.md#R3.4.5)); eine andere Zitation derselben Angabe hört auf, Hauptzitat zu
    sein;
  - das Aufheben erkennt die Forschung, wenn die Datei aus der App auf einer Version der Forschung beruht, in der das
    Hauptzitat war, und es bei der Zitation nicht mehr ist. Bei einer Datei, der die Forschung nichts gegeben hat,
    gilt das Hauptzitat nur als Setzen;
  - ein Hauptzitat bei einer Zitation, die die Forschung nicht hat, fügt die Forschung zuerst hinzu und markiert sie
    dann. Fügt sie die Zitation nicht hinzu, setzt sie das Hauptzitat nicht und sagt es ([S2.5.1](#S2.5.1));
  - ein Hauptzitat bei einer Angabe, deren Datum oder Art der Benutzer in derselben Sendung geändert hat, schreibt
    die Forschung nicht (sie ordnet die Angabe nicht zu); es genügt, es nach dem nächsten Laden erneut zu senden.
- **Entferntes Zitat:**
  - die Forschung entfernt es von der Angabe und merkt sich das Entfernen
    ([R3.4.6](R3-verification-and-citation.md#R3.4.6)). Die Quelle und ihre Bilder bleiben. Ein entferntes Hauptzitat
    hebt auch das Hauptzitat auf;
  - bei einem gemeinsamen Ereignis wird es einmal entfernt, von dem einen gemeinsamen Ereignis der Forschung;
  - entfernt wird nur eine Zitation, die die Angabe in der Version der Forschung hatte, auf der die Datei der App
    beruht. Eine Zitation derselben Quelle, die der Agent später hinzugefügt hat, bleibt.
- **Grenzen:**
  - das Entfernen nimmt die Forschung nur aus der GEDCOM-Datei, die die App über die Brücke sendet, und nur bei
    Geburt, Tod, Ereignissen einer Person, Heirat, Ereignissen eines Paares und Scheidung. Zitationen einer Person,
    eines Namens und einer Familie werden aus der App nicht entfernt;
  - fehlt in der Datei die ganze Quelle, wird nichts entfernt: die Quelle bleibt mit ihren Zitationen in der
    Forschung und wird in der Forschung gelöscht;
  - eine App, die das Entfernen noch nicht sendet, entfernt nichts; die Zitation bleibt in der Forschung;
  - aus der JSON-Datei der App liest die Forschung das Hauptzitat (ab Datenversion 21), das Entfernen nicht;
  - die App bietet das Hauptzitat nur bei einer Forschung an, die es hält, und bei einer Forschung, die das Entfernen
    nicht übernimmt, sagt sie es ([A3.2.3](A3-evidence-in-the-app.md#A3.2.3)). `_STROM_MAIN` und `1 DATA` › `2 EVEN`
    schreibt die Forschung nur einer App, die sie liest ([A2.7](A2-loading-a-family-tree.md#A2.7)).
- Was die Forschung davon nicht übernommen hat, nennt die App einzeln ([S2.5.1](#S2.5.1)).
- **Gilt seit:** App 3.29.0 mit Forschung 1.34.0

<!-- zdroj: research:355df0a5 src/core/sync.ts fact.main (op event.main, _STROM_HEAD: zrušení), fact.uncite (jen s HEAD, APP_SENDS_UNCITE, BIRT/DEAT/LifeEvent/MARR/události páru/DIV; cite.notCarried, cite.sourceRemoved, cite.olderApp, fact.noMatch, main.notCarried), :5268 · src/core/stromapp.ts:806-820 APP_READS_MAIN_CITATION, APP_SENDS_UNCITE, APP_DATA_MAIN_CITATION 21 · src/core/live.ts features citations.order, citations.main, citations.remove, sync.notWritten.codes · 4cd81f14 (vrácení) · app:src/citation-gates.ts · ZADANI_VYZKUM_hlavni-citace.md 3.2, 4.1, Upřesnění 3 a 5, V6, V7 · spec 095 K2, K3 -->

<a id="S2.3.2"></a>
### S2.3.2 Notiz eines Beteiligten aus der App

Das Detail eines Paten, Zeugen oder anderen Beteiligten eines Ereignisses (Feld **Detail (Gewerbe, „Nachbar“…)**,
[A10.5](A10-shared-events.md#A10.5)), in der App bearbeitet, übernimmt die Forschung als Änderung des Benutzers, wie
die Notiz eines Ereignisses ([S2.3](#S2.3)): eine Notiz, die die Forschung beim Beteiligten nicht hat, ergänzt sie;
eine Notiz, die der Benutzer seit der letzten Übergabe geändert hat, korrigiert sie; eine seitdem auch in der
Forschung geänderte Notiz, oder eine ohne bekannte Übergabe, überlässt sie der Wahl. Die Änderung lässt sich
zurücknehmen ([S2.7](#S2.7)).

- **Woher:** aus der GEDCOM-Datei der App 3.29.0 und neuer und aus der JSON-Datei der App mit Datenversion 21 und
  höher, aus einer Datei wie aus dem, was die App direkt über die Brücke sendet. Aus einer älteren App oder aus einer
  Datei, die ihre Version nicht nennt, wird die Notiz eines Beteiligten nicht übernommen.
- **Kürzere Notiz:** eine Notiz, die nur der Anfang der Notiz der Forschung ist, wird nie von selbst übernommen. Ein
  in der App 3.28 gespeicherter Stammbaum trägt eine längere Notiz eines Beteiligten auch in einer neueren App gekürzt,
  und die Forschung erkennt nicht, ob die App oder der Benutzer sie gekürzt hat. Als Anfang zählt auch ein Schnitt
  zwischen einem Buchstaben und seinem Akzent („sedla“ von „sedlák“) und ein zerbrochenes Zeichen am Ende.
  - kürzer als die Notiz der Forschung: `strom sync` sagt es in einer Zeile
    `nicht übernommen: kürzer als in der Forschung — ob sie übernommen wird, steht unter „Wartet“`, und das Schreiben
    legt eine Aufgabe an, die auf den Menschen wartet: „Die Notiz aus der Strom-App bei {Ereignis} ({Person}), {wer},
    ist kürzer als in der Forschung – übernehmen oder beibehalten?“, mit beiden Notizen. Die Aufgabe steht in **Was
    wartet** und in der App ([S4.4](S4-research-from-the-app.md#S4.4)). Die App 3.30.0 hat in **Was geschrieben
    wurde** ([S2.5.1](#S2.5.1)) die Zeile „kürzeres Detail eines Paten oder Zeugen nicht übernommen: die Forschung
    fragt unter „Wartet auf Bearbeitung“, ob es übernommen wird“;
  - nur kürzer als das, was die App von der Forschung bekommen hat (die Forschung hat die Notiz inzwischen geändert):
    nichts wird geschrieben und niemand gefragt.
- **Sie fragt einmal:** derselbe Stammbaum, erneut gesendet, legt keine neue Aufgabe an, auch nicht nach der
  Entscheidung. Das Zurücknehmen des Sendens ([S2.7](#S2.7)) verwirft die Aufgabe, die noch wartet.
- **Der Mensch entscheidet:** **Die kürzere Notiz aus der App übernehmen** schreibt die kürzere Notiz beim
  Beteiligten, **Die Notiz der Forschung beibehalten** lässt die Notiz der Forschung; die Aufgabe ist in beiden Fällen
  erledigt. Der Agent führt die Entscheidung nur nach der Antwort des Menschen auf die Aufgabe aus
  ([R6.6](R6-awaiting-action.md#R6.6)). Hat sich die Notiz der Forschung seit der Frage geändert, schreibt das
  Übernehmen nichts und sagt es.
- **Grenzen:** eine Notiz, die die Datei nicht mehr hat, entfernt nichts. Eine Notiz wird nur bei einem Beteiligten
  in derselben Rolle übernommen und nur bei einem Ereignis, das die Forschung sicher zuordnet ([S2.3](#S2.3),
  Welches Ereignis).
- **Bedienung:** Terminal: **Was wartet** → die Aufgabe → **Die kürzere Notiz aus der App übernehmen** oder **Die
  Notiz der Forschung beibehalten**; `strom sync note T… take|keep`.
- **Gilt seit:** Forschung 1.35.0 (App 3.29.0, Daten 21); die Zeile in **Was geschrieben wurde** ab App 3.30.0

<!-- zdroj: research:bb79ee54 src/core/stromapp.ts APP_SENDS_PART_NOTES "3.29.0", appSendsPartNotes · research:28237d57 APP_DATA_PART_NOTES 21, appDataPartNotes · src/core/sync.ts planSync partNotes, partNoteDiff (add / correct / pick; mine podle role a osoby; given; p.note povinná: odebraná nic; jen sure), cutShort (noteLine, NFD), sentNote (U+FFFD, půlka páru) · research:fb94435f src/core/shorternote.ts SHORTER_ORIGIN sync:note-shorter, shorterAsked (jednou, dropped ne), askShorterNote (waiting, kind other), decideShorterNote (personWrites nebo answers; shorter.changed) · src/commands/sync.ts sync note (person, agentMay s odpovědí) · src/cli/menu-waiting.ts shorterNote (take/keep) · assets/lang/cs.json ui.sync.do.note.shorter, note.shorter.*, ui.wait.a.shorter.* · CHANGELOG.cs.md 1.35.0 „Poznámka účastníka z aplikace Strom“ · app:2c2cec57 strings.ts sync.nw note.shorter, participantNote · dirigent:prace/1116-vyzkum-po-134, 1116-vyzkum-poznamka-kratsi, 1116-vyzkum-app-data-part-notes -->

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
- **Ab Forschung 1.34.0:** die Forschung lehnt auch einen kleinen anderen Stammbaum ab, der unter ihrer Verbindung
  gesendet wurde (etwa den Beispiel-Stammbaum) und in dem weniger als die Hälfte der Personen ihres Stammbaums
  bleibt: von den gesendeten Personen haben weniger als 10 % eine Nummer der Forschung (bei 10 und mehr gesendeten)
  oder keine (bei 5 und mehr). Nichts wird geschrieben, und die Änderungen bleiben in der App. Ist es gewollt, nimmt
  das Terminal eine solche Datei: `strom sync <Datei> --force`.

<!-- zdroj: research:src/core/sync.ts (v1.25.2) SYNC_MAX_BYTES :1325, tree.empty :1218, tree.other-research :2038, tree.foreign :2068, tree.no-ids :2345 · src/core/live.ts seal.foreign, tree.not-downloaded, disk.full · app:src/research-write-held.ts · strings.ts sync.refusedCodes, sync.refusedDetails, sync.noIdsToast, sync.held, sync.writtenCount, sync.notWrittenPick, sync.rejectedAutoSub · 1.26.0: research:src/core/git.ts commitAll po částech (commit 0e7238fc) · 1.34.0: research:4a5887dc src/core/sync.ts planSync (jiný strom: poslaných ≥ 10 a s id výzkumu < 10 %, nebo ≥ 5 a žádná; kept < given/2, strangers > 0; --force) · CHANGELOG.cs.md 1.34.0 „Jiný rodokmen pod jménem výzkumu“ · prace/1115-vyzkum-cizi-strom -->

<a id="S2.5.1"></a>
### S2.5.1 Nicht übernommene Änderungen einzeln

Eine Forschung, die zu jeder nicht übernommenen Änderung den Grund als Code sendet, bekommt in der App bei jeder
solchen Änderung eine eigene Zeile mit dem Grund in den Worten der App.

- **Meldung:** wenn die Forschung aus einer Sendung nichts übernommen, die Änderungen aber benannt hat: „Die Forschung
  hat 3 Änderungen nicht übernommen. Die Änderungen bleiben hier in der App.“ mit **Anzeigen**. Der Abschnitt der
  Sendung im Panel der Forschung hat die Überschrift „3 Änderungen nicht übernommen“. Eine solche Sendung sagt nie
  „nichts Neues“.
- **Liste:** **Was geschrieben wurde** ([S2.2.1](#S2.2.1)) hat bei jeder nicht übernommenen Änderung eine Zeile
  Person · Angabe · Quelle (Person und Quelle lassen sich öffnen, was nicht bekannt ist, entfällt; „Änderung“, wenn
  weder Person noch Quelle bekannt sind) und den Grund:

| Wann | Was die App sagt |
|---|---|
| eine ältere App, die das Entfernen von Zitaten nicht sendet | Zitat bleibt in der Forschung: diese App-Version sendet Entfernungen noch nicht |
| in der Datei fehlt die ganze Quelle | die Quelle bleibt mit ihren Zitaten in der Forschung; gelöscht wird eine Quelle in der Forschung |
| die Quelle ist von einer ganzen Person oder Familie verschwunden | Zitate einer Person, eines Namens oder einer Familie werden aus der App nicht entfernt |
| ein Hauptzitat bei einer Zitation, die die Forschung nicht hinzugefügt hat | Hauptzitat nicht gesetzt: die Forschung hat dieses Zitat nicht übernommen |
| die Angabe wurde nicht zugeordnet | die Forschung hat diese Angabe nicht gefunden (Datum oder Art geändert) |
| die Forschung hat die Angabe inzwischen zurückgenommen | die Forschung hat diese Angabe inzwischen zurückgezogen; sie kommt nicht mehr in die App zurück |
| in der Datei fehlt eine Person, Angabe, ein Name, Kind oder Partner | fehlt in der Datei; die Forschung löscht nichts, sie vermerkt es nur |
| dazu wartet schon ein Widerspruch | dazu wartet schon ein offener Widerspruch |
| eine spätere Sendung aus einem anderen Fenster | eine spätere Sendung aus einem anderen Fenster hat die Angabe geändert; diese Kopie ist älter |
| die Bestätigung einer Angabe, die die Forschung inzwischen geändert hat | Bestätigung nicht übernommen: die Forschung hat die Angabe inzwischen geändert |
| eine Beziehung des Kindes mit einem Wort, das die Forschung nicht kennt | Beziehung des Kindes: die Forschung kennt dieses Wort nicht |
| eine Namensgruppe, die die Forschung inzwischen geändert hat | die Forschung behält ihre Namensgruppe (inzwischen geändert) |
| eine Namensgruppe mit Warnung | Namensgruppe: in der Forschung nur mit Warnung |
| ein Wert aus einem Import oder vom Benutzer, den der Agent nur vorschlägt | ein Wert aus einem Import oder vom Nutzer: die Forschung schlägt ihn nur vor |
| die Person wurde nicht zugeordnet | die Forschung hat die Person nicht zugeordnet |
| ein Schreiben, das die Forschung vornehmen wollte und das fehlgeschlagen ist | das Schreiben in der Forschung ist fehlgeschlagen |
| ein Code, den die App nicht kennt | nicht übernommen |

- Änderungen, die die Forschung schreiben wollte und bei denen es fehlgeschlagen ist, stehen in derselben Liste,
  nicht in einer eigenen Meldung. Gründe, die die App schon früher angab (wartet auf eine Wahl, das Archiv behält
  sie, Person entfernt, zurückgenommen), behalten ihre bisherigen Worte.
- **Eine Angabe, die die Forschung inzwischen zurückgenommen hat** (`strom event retract`,
  [R3.1](R3-verification-and-citation.md#R3.1)), nach der Version, auf der die Datei der App beruht: ein entferntes
  Zitat, ein Hauptzitat, ein neues Zitat, eine Notiz, ein Detail oder eine Bestätigung einer solchen Angabe wird
  nicht geschrieben, und jede hat in der Liste eine Zeile mit diesem Grund. Die Zitate der zurückgenommenen Angabe
  bleiben in der Forschung. Das Terminal schreibt bei `strom sync`: „nicht geschrieben: die Forschung hat diese
  Angabe inzwischen zurückgenommen (sie kommt nicht in die App zurück)“.
- Die Zeile eines neuen Zitats, das die Forschung nicht übernommen hat, nennt alle zitierten Quellen, die der
  Stammbaum hat, auch eine in der App neue Quelle.
- Ein späterer Stand der Forschung ergänzt dieselbe Liste ohne Meldung.
- **Grenzen:** eine Forschung ohne Codes verhält sich wie bisher: eine Sendung, aus der sie nichts übernommen hat,
  meldet „Die Forschung hat aus dieser Sendung nichts Neues übernommen.“ Die Gründe bei Zitationen (die ersten drei
  Zeilen der Tabelle) sendet die Forschung nur einer App, die das Hauptzitat liest; eine ältere App bekommt sie
  nicht.
- **Gilt seit:** App 3.29.0 mit Forschung 1.34.0

<!-- zdroj: app:1e10a1dd src/ui/research-sync-ui.ts:1985-2005 (SYNC_NW_CODES_FEATURE, notTakenToast, nothingTakenToast), :2849 notTakenTitle · src/ui/research-changes-ui.ts nwReason, NW_TODAY_WHY · strings.ts sync.notTakenToast, notTakenTitle, nw.*, nwUnknown, nothingTakenToast · research:355df0a5 src/core/sync.ts notWritten codes, skipped codes, /status sends[].notWritten (nejvýš 50) · ZADANI_VYZKUM_hlavni-citace.md V4, V5 · spec 095 K3.4 · event.retracted: app:bcf456ee strings.ts sync.nw.event.retracted (notWritten i skipped), src/ui/research-changes-ui.ts nwRowParts more (cites) · research:4a5887dc src/core/sync.ts retractedDiff (code event.retracted: fact.uncite, fact.main, fact.cite s cites, fact.note, fact.detail, fact.confirm), cli/ui.ts + cs/de/pl.json ui.sync.do.event.retracted · prace/1115-vyzkum-095-retract -->

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
- **Ab App 3.29.0:** ein zurückgenommenes Senden, das die Personen dieses Stammbaums nicht trug (der Eintrag der
  Forschung zu der Sendung nennt einen anderen Stammbaum der App, oder die gesendete Version nennt seine Personen
  kaum), wird weder wieder angeboten noch gesendet. Das Forschungspanel sagt „Diese Sendung enthielt nicht die
  Personen dieses Stammbaums und wird daher nicht erneut gesendet. Mit dem Laden der Version der Forschung bleibt
  die Rücknahme.“ und seine Hauptaktion ist **Version der Forschung laden**. Wo die App es nicht erkennen kann,
  bleibt die Wahl wie bisher.

<!-- zdroj: app:src/ui/research-actions-ui.ts (v3.21.2) :448 researchActionUndoSend, UNDO_MAX_AGE_MS :152 · src/research-link.ts:73 sync-undo terminal · strings.ts research.undoSend, sync.undoneSub, sync.sendAgain, sync.loadVersion, sync.againNothing, sync.restoreBeforeLoad · research:src/core/sync.ts :19 strom sync undo · 1.26.0: src/commands/sync.ts:503 sync discard (person), sync undo (person) (commit 942c56f9) · 3.29.0: app:bbcc2b17 src/ui/research-changes-ui.ts researchUndoneForeign (záznam poslání jmenuje jiný strom aplikace, nebo uložená verze poslání skoro nejmenuje osoby druhé uložené verze), strings.ts sync.undoneForeignSub -->

<a id="S2.7.1"></a>
### S2.7.1 Version der Forschung laden?

Bevor die Version der Forschung den Stammbaum in der App ersetzt, fragt die App **Version der Forschung laden?** und
zeigt, was sich in der App ändert oder wegfällt.

- **Liste:** eine Zeile je Wert: Person · Angabe · **hier → aus der Forschung**. Die ersten 8 Zeilen, die übrigen
  unter „und N weitere“. Unter der Liste, was aus der Forschung hinzukommt („Aus der Forschung kommen hinzu:
  + 2 Personen, 3 Angaben“), und „Vor dem Laden wird gesichert; ein Zurück ist möglich.“
- **Notiz zeilenweise:** wenn beide Versionen eine Notiz haben, bleiben gemeinsame Zeilen schlicht, entfernte sind
  durchgestrichen, hinzugefügte oder geänderte hervorgehoben (eine geänderte Zeile: die alte durchgestrichen, dann
  die neue). Ein Absatz, den die Forschung nur hinzugefügt hat, streicht nichts durch. Leerzeichen am Zeilenende und
  Zeilenenden aus Windows sind keine Änderung. Eine Notiz nur auf einer Seite behält **hier → aus der Forschung**.
  Geladen werden dieselben Daten wie bisher.
- **Grenzen:** bei einem Stammbaum, der aus der Forschung nur lädt ([S2.2](#S2.2)), und wenn aus der letzten Sendung
  etwas nicht geschrieben wurde, sagt der Dialog, dass das Laden diese Änderungen überschreibt; die Schaltflächen
  sind **Laden und überschreiben** und **Als Kopie öffnen**.
- **Bedienung:** App: **Version der Forschung laden**
- **Gilt seit:** App 3.9.0; Notiz zeilenweise seit 3.29.0

<!-- zdroj: app:src/ui/research-load-ui.ts askResearchLoad (ROWS_SHOWN 8, overwrite: sendMode off nebo nezapsané z posledního poslání → loadOverwrite + research.openCopy), src/ui/research-ui.ts:2377 · 03352a9c src/line-diff.ts diffLines (LCS po řádcích, mezery na konci a CRLF nejsou změna), research-load-ui.ts notes · strings.ts sync.loadTitle, loadColChange, loadMore, loadAdded, loadBackupNote, loadOverwrite, loadOverNotWritten · CHANGELOG.cs.md 3.29.0 „Načíst verzi výzkumu?“ · v3.9.0 (loadColChange) -->
