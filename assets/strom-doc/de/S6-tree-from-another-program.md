<a id="S6"></a>
# S6 Stammbaum aus einem anderen Programm

Ein Stammbaum aus einem anderen Programm (MyHeritage, Gramps, FamilySearch, Windows-Programme und weitere) kommt in die
App und in die Forschung als GEDCOM-Datei. Das Kapitel führt durch den ganzen Weg: was eingelesen wird und was verloren
geht, wie zu sehen ist, woher eine Angabe stammt, warum Angaben aus dem Stammbaum nur Hinweise sind, wie sich eine
Angabe aus dem Stammbaum zurückholen lässt, was die Karte **Wie weiter** anbietet, wie sich in der Zeit zurückgehen
lässt, wie der Stammbaum zurückgeschickt wird und was ein erneut eingelesener Stammbaum bewirkt. Beschrieben werden die Strom-App
3.26.0 und die Forschung 1.30.0. Einzelheiten zum Lesen der Datei stehen in [A2](A2-loading-a-family-tree.md), der
Export in [A7](A7-book-pages-and-export.md), das Zusammenführen in [A8](A8-merging-trees.md) und die Übernahme eines
Stammbaums durch die Forschung in [R11.3](R11-material-from-the-user.md#R11.3).

Eine Datei, die Strom selbst geschrieben hat (Kopf `1 SOUR STROM`), und eine JSON-Datei der App sind kein Stammbaum
aus einem anderen Programm: sie haben keine Marke der Herkunft, keine Karte **Wie weiter** und keinen Schutz der
Angaben aus dem Stammbaum. Eine Forschung, die eine solche Datei übernimmt, hält ihre Werte für den Stammbaum des
Nutzers ([S6.3](#S6.3)).

<!-- zdroj: dirigent:spec/066-import-ged-a-ai/spec.md (rozhodnutí: GED s 1 SOUR STROM není import) · app:1c9b2392 src/ui/import-next-ui.ts, src/reliability.ts · research:v1.30.0 CHANGELOG.cs.md 1.30.0 -->

<a id="S6.1"></a>
## S6.1 Was aus einem Stammbaum geladen wird und was verloren geht

Die App übernimmt Personen, Familien, Quellen, Notizen, Ereignisse und Medien, die sie kennt, und dazu die IDs, die das
Programm Personen und Familien gegeben hat. Was sie nicht übernimmt, zählt sie und zeigt es in der Zusammenfassung des
Imports; nichts geht stillschweigend verloren.

| Programm oder Datei | Was eingelesen wird | Was nicht übertragen oder nur gezählt wird |
|---|---|---|
| MyHeritage | Personen und Familien mit Programm-IDs (`_UID`, `RIN`) und der ursprünglichen Datensatzkennung (`@I12@`); Fotos aus eigenständigen Mediendatensätzen (`0 @O1@ OBJE`) über die Verweise auf sie; eigene Tags des Programms (`_XXX`) direkt bei Person, Familie und Quelle bleiben für den Export zurück erhalten | Fotoausschnitte (`_POSITION`, `_CUTOUT`) sind Verwaltungsangaben und werden nicht gezählt; tiefere eigene Tags werden gezählt; ein Foto einer Familie über einen eigenständigen Mediendatensatz wird nur gezählt |
| FamilySearch | Personen mit FamilySearch-ID (`_FSFTID` oder `EXID` mit der Adresse familysearch.org) | wie oben |
| Gramps | Personen mit der ursprünglichen Datensatzkennung (`@I0001@`) und `RIN`, wenn die Datei sie hat | eine ID, nach der sich eine Person sicher erkennen ließe, gibt Gramps nicht (`_UID` fehlt): eine erneut eingelesene Datei wird vor allem nach Namen und Daten gepaart ([S6.7](#S6.7)) |
| Windows-Programme | Text in der Kodierung Windows-1250 (Mitteleuropa) und Windows-1252 (Westeuropa) mit den richtigen Buchstaben; bei erratener oder einbytiger Kodierung und Text mit diakritischen Zeichen die Zeile **Textkodierung** mit Namensbeispielen und der Wahl einer anderen Kodierung ([A2.2](A2-loading-a-family-tree.md#A2.2)) | – |
| GEDCOM 7 | `UID`, `EXID` als ID der Person | ein GEDZIP-Paket wird nicht eingelesen |

- **Prüft der Code:**
  - IDs von Person und Familie (`_UID`, `UID`, `RIN`, `EXID`, `_FSFTID`, `AFN`) und die ursprüngliche
    Datensatzkennung bleiben erhalten und kommen im Export ([S6.6](#S6.6)) und in der Forschung zurück;
  - die Zusammenfassung des Imports hat die Zeile „Für den Export „Zurück zu {program}“ aufbewahrt: N GEDCOM-Tags
    (…)“, wenn die Datei eigene Tags des Programms hat.
- **Grenzen:** Fotos, auf die die Datei nur mit einem Pfad oder einer Adresse verweist, sind nicht in der Datei: die
  Zusammenfassung bietet **Mediendateien anhängen…** an ([A2.1.1](A2-loading-a-family-tree.md#A2.1.1)).
- **Bedienung:** **Import → GEDCOM importieren**; die Zusammenfassung des Imports (Fenster **GEDCOM-Umwandlung**).
- **Gilt seit:** App 3.26.0 (IDs, Mediendatensätze, eigene Tags, Kodierung Windows-1250), Forschung 1.30.0

<!-- zdroj: app:1c9b2392 src/ged-parser.ts (původní ID, OBJE přes odkazy, _XXX úrovně 1, výřezy MyHeritage evidenční), docs/GEDCOM-IMPORT.md (kódování) · strings.ts gedcom.keptTags, encodingLabel, encodingSample, attachMedia · dirigent:prace/1108-app-066-u8/karta.md Výsledek (f9735c6a, d2551dbc, 281e19e1; FAM se podle ID nepárují; fotka rodiny přes OBJE jen spočítaná) · prace/1108-app-066-u1u2 · research:v1.30.0 src/core/import.ts candidates, notTaken -->

<a id="S6.2"></a>
## S6.2 Zuverlässigkeitsmarken: woher eine Angabe stammt

Bei jeder Angabe einer Person steht eine Marke, wie zuverlässig sie ist: wer sie bestätigt oder belegt hat, oder dass
sie aus dem Stammbaum eines anderen Programms kam und sie noch niemand geprüft hat. Die Stufen unterscheiden sich durch
Punkte, Häkchen und Rahmen, nie nur durch die Farbe.

| Marke | Bedeutung (Beschriftung beim Darüberfahren) |
|---|---|
| **Bestätigt** (✓) | **Von einem Menschen bestätigt**: die Angabe hat ein Mensch bestätigt, eingetragen oder zurückgesetzt, oder er hat einen Vorschlag der Forschung angenommen |
| **Belegt** (volle Punkte) | die Angabe ist belegt ([R3.1](R3-verification-and-citation.md#R3.1)); zwei volle Punkte nur bei zwei übereinstimmenden Lesern des Eintrags ([S7.1](S7-reliability-and-verification.md#S7.1)) |
| **Aus dem Stammbaum** (leere Punkte) | „Aus dem Stammbaum (ungeprüft): übernommen aus {program}, Datei vom {datum}“ |

Die übrigen Angaben zeigen den Grad der Sicherheit der Forschung ([R3.1](R3-verification-and-citation.md#R3.1)). Alle
Marken, die Marke auf dem Kärtchen im Stammbaum und die Prüfung der Angaben an den Originalen beschreibt
[S7](S7-reliability-and-verification.md).

- **Prüft der Code:**
  - die Marke **Aus dem Stammbaum** gilt, solange die Angabe den Wert aus der Datei hat. Eine Änderung beendet die
    Marke; bei einer teilweise geänderten Angabe wird gesagt, welcher Teil aus dem Stammbaum stammt und welchen ein
    Mensch geändert hat;
  - bei einem an die Forschung gebundenen Stammbaum ([S1](S1-connecting-app-and-research.md)) nimmt die App die
    Herkunft der Angabe aus der Forschung, sonst aus dem Vermerk über den Import in der App;
  - ein Stammbaum ohne Vermerk über den Import (ein älterer Import, eine Datei von Strom) zeigt die Marke **Aus dem
    Stammbaum** nicht: nichts wird erraten;
  - in einem Forschungsbaum hat eine Angabe, die die Forschung aus einem Stammbaum aus der App Strom übernommen hat
    und die seitdem niemand geändert hat, die Marke ihrer Sicherheitsstufe, ohne Stufe **Aus dem Stammbaum**; ✓ nie
    ([S6.3](S6-tree-from-another-program.md#S6.3));
  - eine Zeile bei der Person sagt, woher die Angaben stammen: „Alle Angaben der Person stammen aus {program} (Datei
    vom {datum}, geladen am {datum}).“ oder „Angaben mit der Marke „aus dem Stammbaum“ stammen aus …“.
- **Grenzen:** dass eine Angabe keine Quelle hat, zeigt die App bei der Angabe noch nicht: die Marke **Ohne Quelle**
  gibt es bei der Angabe nicht ([S7.1](S7-reliability-and-verification.md#S7.1)).
- **Bedienung:** Personenkarte (bei der Angabe die Marke, **Was die Marken bedeuten**); **Einstellungen →
  Personenkarte → Verlässlichkeit bei Angaben in der Personenkarte** (standardmäßig ein) und **Auf der Karte zeigen →
  Belege und Verlässlichkeit** (standardmäßig ein; das Kärtchen zeigt die schwächste der Angaben Name, Geburt, Tod,
  [S7.2](S7-reliability-and-verification.md#S7.2)).
- **Ab App 3.26.0:** zwei volle Punkte bei **Belegt** bekommt eine Angabe, bei der sich bei der Prüfung durch die
  Forschung zwei Leser des Eintrags einig waren; das Kärtchen im Stammbaum hat eine Marke statt der früheren zwei
  Optionen.
- **Gilt seit:** App 3.26.0, Forschung 1.30.0

<!-- zdroj: app:7b0471f8 src/reliability.ts (pořadí human, proven, probable, possible, import, lead, none; tečky, ✓ a rámeček, ne barva; feature origin; bez záznamu o importu žádné Z rodokmenu; readers z _STROM_CHECKED, noSource nekrmeno) · src/ui/fact-status.ts · src/ui/person-reliability-ui.ts · src/settings.ts display.reliabilityCard (ON) · src/ui/card-signals-ui.ts (signál status, výchozí zapnuto) · index.html settings-group-card · strings.ts reliability.settingCard, cardDensity.cardStatus, settings.groupCard · app:669c08f0 src/reliability.ts userTreeOrigin (_STROM_ORIGIN tree) -->

<a id="S6.3"></a>
## S6.3 Angaben aus einem Stammbaum sind Hinweise: der Agent schlägt vor, ein Mensch entscheidet

Der Stammbaum eines anderen Programms sind die Schlüsse eines anderen. Die Forschung nimmt seine Angaben als Hinweise:
sie ändert sie nur nach einem Eintrag, den sie zitiert, sonst schlägt sie die Änderung nur vor. Was ein Mensch
eingetragen oder geändert hat, in der Strom-App oder in der Forschung, ändert der Agent nie: er schlägt nur vor.

- **Prüft der Code:**
  - jede Angabe in der Forschung hat eine Herkunft: aus dem Stammbaum, vom Menschen oder aus der Forschung;
  - ein Wert aus einem Stammbaum aus der App Strom (eine Datei oder ein Stammbaum der App, den die Forschung übernommen
    hat), den seit der Übernahme niemand geändert hat, gehört zum Stammbaum des Nutzers: der Agent ändert ihn nicht,
    er schlägt nur vor, wie bei einer Angabe des Menschen, aber er gilt nicht als vom Menschen bestätigt. Eine
    Bearbeitung, ein zurückgesetzter Wert, ein angenommener Vorschlag und eine aus der App gesendete Bearbeitung sind
    Angaben des Menschen;
  - eine Angabe aus dem Stammbaum ändert der Agent nur mit einem zitierten Eintrag; ohne ihn, und immer wenn über
    Hypothesen der Mensch entscheidet ([R10.3.2](R10-people-and-hypotheses.md#R10.3.2)), entsteht ein Vorschlag als
    Widerspruch zur Entscheidung des Menschen;
  - eine Angabe des Menschen ändert der Agent nie, auch nicht mit einer über `strom sync` eingelesenen Datei; immer nur
    ein Vorschlag;
  - ein Vorschlag, dessen vorgeschlagener Wert schon gilt, schließt sich von selbst. Ein Vorschlag, dessen Wert sich
    seit seiner Entstehung geändert hat, ist veraltet: er lässt sich nicht annehmen, nur mit dem behaltenen Wert
    schließen;
  - der Wert aus dem Stammbaum bleibt neben dem geänderten gespeichert ([S6.3.1](#S6.3.1)).
- **Ergebnis in der App:** bei der Angabe mit einem Vorschlag die Zeile **Die Forschung schlägt vor, eine Angabe aus
  dem Stammbaum zu ändern** (oder **Die Forschung schlägt vor, eine von einem Menschen eingetragene Angabe zu ändern**)
  und **Widerspruch ›**. Im Widerspruch stehen sich **Jetzt · aus dem Stammbaum** (oder **Jetzt · von einem Menschen
  eingetragen**) und **Vorschlag der Forschung** gegenüber; die Wahl **Aus dem Stammbaum behalten** und **Vorschlag
  annehmen**. Nach dem Annehmen ist die Angabe von einem Menschen bestätigt, und bei der Angabe bleibt **Ursprünglich
  aus dem Stammbaum: …** mit **Zurücksetzen**.
- **Warum:** ein Stammbaum gibt die Richtung der Suche, keinen Beleg. Was ein Mensch eingetragen hat, ist seine
  Entscheidung; der Agent kann sie nur mit einem Vorschlag untermauern.
- **Bedienung:** App: **Widerspruch ›** bei der Angabe. Terminal: `strom conflict list`, `strom conflict show X…`
  (der Vorschlag des Agenten und woher der heutige Wert stammt), `strom conflict resolve X… --take research|user`.
- **Gilt seit:** Forschung 1.30.0, App 3.26.0

<!-- zdroj: research:v1.30.0 CHANGELOG.cs.md 1.30.0 (údaje z převzatého rodokmenu jsou chráněné) · dirigent:prace/1108-vyzkum-066-u3/karta.md, u3-nalezy, u3-nalezy2 Výsledek (původ import/user/research; --cite/--locator; conflict proposal; event edit/retract, person edit, name primary, place rewrite, source edit --transcript, sync; conflict.stale) · strom help conflict resolve (--take user|research) · app:1c9b2392 strings.ts origin.proposeImport, proposeUser, conflictOpen, sideImport, sideUser, sideProposal, keepImport, accept, acceptNote · research:94d75934 src/core/model.ts ValueOrigin.tree, src/core/origin.ts (user i tree: agent jen navrhuje), src/core/import.ts importGedcom/importStromJson (soubor aplikace → user + tree) -->

<a id="S6.3.1"></a>
### S6.3.1 Ursprünglich aus dem Stammbaum und Zurücksetzen

Eine Angabe aus dem Stammbaum, die die Forschung oder ein Mensch geändert hat, behält den ursprünglichen Wert. Die App
zeigt ihn bei der Angabe als **Ursprünglich aus dem Stammbaum:** mit dem, wonach sie sich geändert hat, und mit der
Schaltfläche **Zurücksetzen**.

- **Prüft der Code:**
  - **Zurücksetzen** schreibt den Wert aus dem Stammbaum erneut (mit der Zitation des Stammbaums). Die zurückgesetzte
    Angabe ist dann eine Angabe des Menschen, und die Forschung ändert sie nicht mehr von selbst; der Eintrag, nach
    dem sie geändert wurde, bleibt bei der Quelle;
  - zurücksetzen darf nur der Mensch: in der App oder an seinem Terminal. Einem Agenten lehnt `strom` das Zurücksetzen
    ab;
  - zurücksetzen lassen sich Datum, Ort oder Wert eines Ereignisses (jeder Teil für sich) und Name oder Geschlecht
    einer Person.
- **Grenzen:**
  - **Zurücksetzen** geht nur auf dem Computer, auf dem die Forschung läuft (**Zurücksetzen geht, wenn die Forschung
    auf diesem Computer läuft.**); am Telefon nicht;
  - die Zeile **Ursprünglich aus dem Stammbaum** und **Zurücksetzen** hat nur ein an die Forschung gebundener
    Stammbaum; gemeinsame Angaben des Paares (Heirat, Scheidung) haben sie nicht.
- **Bedienung:** App: Personenkarte → bei der Angabe **Zurücksetzen** → **Angabe aus dem Stammbaum zurücksetzen?**.
  Terminal: `strom event revert E… [--part date|place|value]`,
  `strom person revert P… --name N [--part given|surname]`, `strom person revert P… --sex`.
- **Gilt seit:** Forschung 1.30.0, App 3.26.0

<!-- zdroj: research:v1.30.0 strom help event revert, person revert („Only the user: in the Strom app or at their own terminal“) · most /facts/revert · app:1c9b2392 strings.ts origin.was, by, accepted, revert, confirmTitle, confirmNote, noBridge, phone · src/ui (Původně/Vrátit jen s feature origin; vztahy páru bez řádku) -->

<a id="S6.4"></a>
## S6.4 Die Karte Wie weiter

Nach dem Einlesen eines Stammbaums aus einem anderen Programm zeigt die App die Karte **Wie weiter**: woher der
Stammbaum stammt und was sich damit weiter tun lässt. Sie erscheint einmal nach jedem Import, ob ein neuer Stammbaum
angelegt, eingefügt oder zusammengeführt wurde.

- **Inhalt:**
  - Herkunft: „Stammbaum aus {program} (Datei vom {datum}) · N Personen“ (beim Einfügen und Zusammenführen, in welchen
    Stammbaum und wie viele Personen);
  - die Zeile der Datenprüfung: „N Dinge zum Ansehen gefunden. Nichts wird von selbst korrigiert.“ und **Ansehen**
    ([A5](A5-tree-check.md)), oder „Die Datenprüfung hat nichts zu korrigieren gefunden.“;
  - wenn die Datei mehrere Familien ohne Verbindung enthält: **Nicht verbundene Teile trennen…**;
  - Forschung: ohne Forschung auf diesem Computer **Ahnenforschung mit diesem Stammbaum** und **Ahnenforschung**; mit
    Forschung **Forschung mit diesem Stammbaum starten**; ein an die Forschung gebundener Stammbaum **Forschung mit
    diesem Stammbaum** (Orte ohne Position und Personen mit Angaben aus dem Stammbaum), **Orte suchen** und, wenn die
    Forschung die Prüfung in großem Umfang beherrscht, **Angaben an Quellen prüfen** (öffnet **Angaben im Baum
    prüfen**, [S7.5](S7-reliability-and-verification.md#S7.5));
  - der Satz „Angaben aus dem Stammbaum nimmt die Forschung als Hinweise: ohne Beleg aus einer Quelle überschreibt sie
    sie nicht, und Geändertes lässt sich zurücksetzen.“;
  - die Links **Zurück zu {program}: Export mit Quellen…** ([S6.6](#S6.6)) und die Hilfe **Stammbaum aus einem
    anderen Programm**.
- **Grenzen:** die Karte gibt es nur bei einer Datei eines anderen Programms. Sie ersetzt die früheren Fragen nach dem
  Import (Prüfung, Trennen von Familien).
- **Gilt seit:** App 3.26.0

<!-- zdroj: app:7b0471f8 src/ui/import-next-ui.ts (IMPORT_NEXT_HELP_TOPIC = 'A2', nextCardClosed, :302 verify → showVerifyBulkDialog) · src/import-next.ts IMPORT_NEXT_VERIFY_FEATURES ['verify.bulk'] · strings.ts importNext.* · dirigent:prace/1108-app-066-u5 -->

<a id="S6.5"></a>
## S6.5 Sicherungen und Zurückgehen in der Zeit

Vor jedem Import in einen Stammbaum und vor dem Zusammenführen speichert die App eine Sicherung des Stammbaums. Zum
Zustand vor dem Import lässt sich so zurückkehren.

- **Prüft der Code:**
  - automatische Sicherungen des Stammbaums entstehen täglich und vor einem Import oder Zusammenführen; **In Stammbaum
    einfügen** legt ebenfalls eine Sicherung an;
  - Sicherungen leben in diesem Browser, nicht in der Datei mit dem Stammbaum: sie verschwinden, wenn die Daten des
    Browsers gelöscht werden, und auf einem anderen Computer sind sie nicht. Eine dauerhafte Kopie gibt der Export des
    Stammbaums in eine Datei;
  - bei großen Sicherungen werden die ältesten früher gelöscht; die drei neuesten bleiben immer.
- **Bedienung:** App: Angebot des Stammbaums → **Sicherungen** → Fenster **Sicherungsverlauf**: **Jetzt Sicherung
  erstellen**, **Wiederherstellen**, **Herunterladen**; der Schalter **Automatische Sicherungen dieses Stammbaums**.
- **Gilt seit:** App 3.26.0 (Sicherung vor **In Stammbaum einfügen**)

<!-- zdroj: app:1c9b2392 src/snapshots.ts SnapshotReason pre-import, pre-merge · src/ui/import-export.ts:818, :940 snapshotNow('pre-import') · src/data.ts:892 · src/ui/merge-ui.ts:769 · src/ui/tree-actions.ts:196 · strings.ts snapshots.menu, title, autoLabel, autoHint, inBrowser, budgetNote, createNow, restore, download -->

<a id="S6.6"></a>
## S6.6 Export zurück ins Programm oder zum Teilen

Der GEDCOM-Export fragt zuerst, **Wofür die Datei ist**: **Zurück zu {program}** (oder **Zurück in ein anderes
Programm**) oder **Zum Teilen mit anderen**. Danach schützt er lebende Personen und gibt die Programm-IDs zurück.

- **Zurück zu {program}:** „Der ganze Stammbaum mit Quellen und Zitaten, für das eigene Genealogieprogramm.“
  Vollständige Daten aller Personen, auch lebender; Quellen und Zitate. Personen und Familien aus dem Stammbaum dieses
  Programms bekommen ihre ursprüngliche Datensatzkennung zurück, wo das sicher ist, und die Zeilen ihrer IDs (`_UID`,
  `RIN`, `EXID` …); eine Kennung, die sich nicht verwenden lässt, geht als `REFN` mit `TYPE {program} xref`. Eigene
  Tags des Programms (`_XXX`) aus Importen desselben Programms kommen zurück.
- **Zum Teilen mit anderen:** „Schützt lebende Personen, der Inhalt lässt sich anpassen.“ (der Standardschutz von
  GEDCOM, [A7.2.1](A7-book-pages-and-export.md#A7.2.1)). Verstorbene behalten ihre Quellen; bei lebenden Personen
  entfallen die Zitate, und das Fenster sagt es („Bei N lebenden Personen entfallen K Zitate. Verstorbene behalten
  ihre Quellen.“).
- **Prüft der Code:**
  - der GEDCOM-Export behält Quellen und Zitate Verstorbener bei jeder Auswahl; der Export JSON, HTML und CSV ändert
    sich nicht ([A7.2](A7-book-pages-and-export.md#A7.2));
  - Fotos und Anhänge hat die Datei nicht: andere Programme lesen sie aus der Datei nicht;
  - bei **Zurück zu {program}** zählt die Zeile der Zusammenfassung **Quellen und Zitate (N Quellen, M Zitate)** die
    Quelleneinträge, die die Datei schreibt. Die Quellen, die der Import aus einem Quelleneintrag für jede zitierte
    Seite gemacht hat ([A2.6](A2-loading-a-family-tree.md#A2.6)), gehen als dieser eine Eintrag zurück: zwei Matriken,
    bei 81 Angaben zitiert, ergeben „2 Quellen, 81 Zitate“. Im Stammbaum bleibt eine Quelle für jede zitierte Seite;
  - **Angaben der Forschung mit einer Notiz kennzeichnen** (standardmäßig ein, nur wenn der Stammbaum Angaben aus der
    Forschung hat): eine Angabe, die die Forschung ergänzt oder korrigiert hat, erhält die Notiz „Abgeleitet von der
    Strom-Forschung (nach: …)“;
  - sonst werden die Programm-IDs unter eigene Tags von Strom (`_STROM_IMPORT`) geschrieben, damit sie beim nächsten
    Einlesen in Strom zurückkommen.
- **Bedienung:** **Export → GEDCOM exportieren → Wofür die Datei ist**; aus der Karte **Wie weiter** der Link
  **Zurück zu {program}: Export mit Quellen…** (öffnet den Export mit der Wahl zurück).
- **Gilt seit:** App 3.26.0

<!-- zdroj: app:7cf409bd src/ged-exporter.ts backSourceRecordCount (sourceGroups: jeden záznam za skupinu) · src/ui/export-gedcom-ui.ts backSources → exportGed.sumSources · e2e/export-gedcom-back.spec.ts · app:1c9b2392 src/ged-exporter.ts backToXrefs (původní xref, ID řádky úrovně 1, REFN + TYPE {prog} xref, _XXX téhož programu, jinak _STROM_IMPORT / _STROM_XID) · src/ui/import-export.ts:267 keepDeceasedSources: true (jen GEDCOM) · strings.ts exportGed.* -->

<a id="S6.7"></a>
## S6.7 Ein erneut geladener Stammbaum und Zusammenführen

Ein Stammbaum desselben Programms, erneut eingelesen und mit dem Stammbaum zusammengeführt, findet seine Personen nach
der Programm-ID. Eine Person, die dieselbe ID hat, aber sonst nicht übereinstimmt, wird nur angeboten.

- **Prüft der Code:**
  - eine Übereinstimmung nach der ID gilt nur dann als sicher, wenn der Name ähnlich ist, das Geschlecht nicht Mann
    gegen Frau ist, die Geburtsjahre (sonst Taufjahre) höchstens 3 auseinanderliegen und keine andere globale ID (zum
    Beispiel FamilySearch) abweicht. Sonst ist es nur ein Vorschlag einer Übereinstimmung mit einem Wert von höchstens
    79. Der Grund der Übereinstimmung ist **Gleiche ID in der Datei**;
  - `_UID` wird mit `UID` gepaart, `_FSFTID` mit `EXID` mit der Adresse familysearch.org;
  - Datensatzkennung und `RIN` geben einer Übereinstimmung der Namen 25 Punkte dazu, nur bei Dateien desselben
    Programms; allein begründen sie keine Übereinstimmung;
  - eine unentschiedene Übereinstimmung wird beim Zusammenführen erst ab dem Wert 80 von selbst bestätigt; eine
    Übereinstimmung von 50–79 wird nur angeboten (?) und ohne Entscheidung des Menschen nicht verbunden
    ([A8.3](A8-merging-trees.md#A8.3));
  - Notizen von Person, Beziehung und Quelle werden beim Zusammenführen nicht verdoppelt;
  - Geschwister, die nur mit dem Nachnamen bekannt sind, kommen beim wiederholten Zusammenführen derselben Datei nicht
    ein zweites Mal hinzu.
- **Ein mit einer älteren Version der App geladener Stammbaum:** das Zusammenführen derselben Datei ergibt denselben
  Stammbaum und dasselbe **Zurück zu {program}** wie ein neuer Import: Familien (auch eine Familie mit einem einzigen
  benannten Elternteil) werden nicht verdoppelt, und es kommt keine Heirat hinzu, die die Datei nicht hat. Eine Person
  nur mit Vornamen und ohne Daten wird mit der gleichnamigen Person des Stammbaums über einen gepaarten Verwandten
  gepaart (Grund zum Beispiel **Kind einer abgeglichenen Person**, **Geschwister einer abgeglichenen Person**,
  **Schwiegerverwandte einer abgeglichenen Person**); Wert 50, immer nur zur Kontrolle. Nicht gepaart wird, wenn der
  Verwandte zwei gleichnamige Personen hat, das Geschlecht abweicht oder die Daten von Geburt oder Tod abweichen.
- **Grenzen:**
  - Familien werden nicht nach der ID gepaart. Das manuelle Zusammenführen zweier Personen verbindet die Notizen nicht;
  - die Marken **Aus dem Stammbaum** ergänzt das Zusammenführen eines Stammbaums aus einer älteren Version nicht: seine
    Werte bleiben Angaben des Menschen. Die Marken gibt ein neuer Import der Datei;
  - Doppelgänger aus einem früheren Zusammenführen entfernt das Zusammenführen nicht; sie werden von Hand gelöscht.
- **Bedienung:** **Import → GEDCOM importieren → Mit Vorhandenem zusammenführen** ([A8](A8-merging-trees.md)).
- **Gilt seit:** App 3.26.0

<!-- zdroj: app:7b0471f8 CHANGELOG.cs.md 3.26.0 (Slučování) · src/merge matchSameNamedRelatives, standInsOfKnownFamilies (b3c3ce00) · strings.ts merge reasons partner_of_matched, child_of_matched, parent_of_matched, sibling_of_matched, in_law_of_matched · dirigent:prace/1109-app-slouceni-325, 1109-app-gedy-opravy (N6: značky importu se starému stromu nedoplní), 1109-app-jeden-rodic Výsledek -->

<!-- zdroj: app:1c9b2392 src/merge/matching.ts ID_MATCH_SCORE 100, ID_CANDIDATE_SCORE 60, ID_MAX_YEAR_GAP 3, WEAK_ID_BONUS 25, offerOnlyCap · src/merge/executor.ts:82 AUTO_CONFIRM_SCORE = 80 · src/merge/notes.ts · strings.ts merge reason id „Stejné ID v souboru“ · dirigent:prace/1108-app-066-u8/karta.md Výsledek (FAM se podle ID nepárují; mergePersons neslučuje poznámky) -->

<a id="S6.8"></a>
## S6.8 Ein Stammbaum in der Forschung

Die Forschung übernimmt einen Stammbaum aus einem anderen Programm mit dem Befehl `strom intake` als Hinweise
([R11.3](R11-material-from-the-user.md#R11.3)) und behält die Herkunft jeder Angabe ([S6.3](#S6.3)).

- **Prüft der Code:**
  - Programm-IDs bleiben erhalten: derselbe Stammbaum, ein zweites Mal übernommen (oder der Stammbaum eines anderen
    Programms), findet die Personen danach, fügt niemanden zweimal hinzu, und neue Angaben kommen als Hinweise dazu;
  - eine nur möglicherweise identische Person (ein anderer Name, eine andere FamilySearch-ID oder nur eine ID ohne
    `_UID` wie bei Gramps) wird nicht verbunden: das Ergebnis sagt „Vielleicht dieselbe Person wie eine der
    Forschung, nach einer ID des Programms (nicht verbunden, zu entscheiden): …“ (in `--json` `candidates`);
  - was die Datei hat und nicht übernommen wird (Mediendatensätze, Verweise auf Medien, eigene Tags des Programms),
    zählt das Ergebnis: „Aus der Datei nicht übernommen: …“ (in `--json` `notTaken`);
  - eine Datei in der Kodierung Windows-1250 oder Windows-1252 („ANSI“) wird mit den richtigen Buchstaben gelesen; ein
    Zeichen, das sich nicht lesen lässt, wird gemeldet, nie stillschweigend ersetzt;
  - die IDs kommen mit der Forschung in die Strom-App zurück;
  - eine früher angelegte Forschung wird nach der Aktualisierung einmal von selbst gekennzeichnet (welche Angaben aus
    dem Stammbaum kamen und welche vom Menschen sind); kein Wert ändert sich. Wo das nicht sicher ist, gilt die Angabe
    als Angabe des Menschen. Einen Wert aus einem Stammbaum aus der App Strom erkennt sie an der Geschichte der
    Forschung: gleich nach der Übernahme des Stammbaums war er da, vorher nicht, und er ist heute derselbe; nur ein
    solcher Wert gehört zum Stammbaum des Nutzers ([S6.3](#S6.3)). `strom fixes undo origins` nimmt die Kennzeichnung
    zurück, `strom fixes run origins` setzt
    sie dann erneut. Auch vor der Kennzeichnung findet ein erneut übernommener Stammbaum die Personen nach den IDs
    früherer Importe.
- **Bedienung:** Terminal: `strom intake rodokmen.ged`, `strom conflict list`, `strom event revert`,
  `strom person revert`, `strom fixes show origins` (was die Korrektur ist und was sie hier gefunden hat),
  `strom fixes undo origins`, `strom fixes run origins`.
- **Gilt seit:** Forschung 1.30.0

<!-- zdroj: research:v1.30.0 CHANGELOG.cs.md 1.30.0 · src/core/import.ts ImportResult.candidates, notTaken · src/commands/intake.ts:300-313 · assets/lang/cs.json ui.intake.candidates, ui.intake.notTaken* · strom help fixes run („readers, proven-originals and origins are set right by themselves once, run again only after strom fixes undo“) · dirigent:prace/1108-vyzkum-066-u3, 1108-vyzkum-066-u8 Výsledek (origins-1, nejisté → user; Gramps bez _UID kandidáti) · research:94d75934 src/core/originfix.ts ORIGINS_TREE_SETTLED origins-tree-1 (podle historie: stejná hodnota hned po převzetí, ne před ním, stejná dnes), settleOrigins · cs.json ui.fixes.origins.example.tree · strom help fixes show -->
