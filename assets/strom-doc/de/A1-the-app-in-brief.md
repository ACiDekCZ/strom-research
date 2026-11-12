<a id="A1"></a>
# A1 Die App im Überblick

Wie die Strom-App als Ganzes arbeitet, auf einer Seite. Jeder Abschnitt führt zu einem Kapitel mit den genauen
Regeln. Beschrieben werden die Strom-App 3.21.2 und die Forschung 1.25.2. Änderungen aus einer neueren Version tragen
deren Nummer.

<a id="A1.1"></a>
## A1.1 Stammbaum im Browser, Daten auf dem Gerät

Die Strom-App ist ein Stammbaum im Browser (stromapp.info) oder in einer einzigen HTML-Datei. Die Stammbäume werden
im Speicher des Browsers auf diesem Gerät gespeichert. Es gibt weder ein Konto noch einen Server mit Daten.

- **Grenzen:**
  - der Speicher des Browsers gehört einem Browser auf einem Gerät. Auf ein anderes Gerät kommt ein Stammbaum als
    Datei (JSON-Sicherung, GEDCOM, eigenständige HTML-Datei, [A7](A7-book-pages-and-export.md));
  - die Verschlüsselung mit Passwort (**Daten verschlüsseln**, **Daten entsperren**, der Export **Mit Passwort
    verschlüsseln**, eine verschlüsselte Datei) funktioniert nur unter einer sicheren Adresse: über https, auf
    `localhost` oder `127.0.0.1` und in einer vom Datenträger geöffneten Datei. Unter einer Adresse `http://` im
    Netzwerk (z. B. die App auf einem eigenen Server im Heimnetz) erlaubt sie der Browser nicht. Der Dialog des
    Passworts sagt das gleich beim Öffnen: „Verschlüsselung funktioniert nur über https oder auf diesem Computer
    (localhost). Diese Adresse ist nicht sicher.“ Das Speichern eines Stammbaums mit Fotos braucht keine
    Verschlüsselung.
- **Gilt seit:** App 1.0.0; 3.27.0: die Meldung zur nicht sicheren Adresse (vorher meldete das Passwort dort „Falsches
  Passwort“)

<!-- zdroj: app:strings.ts about.description, embeddedMode.infoText1, embeddedMode.infoText2 · šifrování: app:src/crypto.ts isCryptoAvailable (isSecureContext, crypto.subtle), classifyCryptoError (jen OperationError = špatné heslo) · src/crypto-errors.ts cryptoFailureText, resetPasswordError (hláška při otevření dialogu), requireCrypto · src/ui/encryption-ui.ts, src/ui/import-export.ts · strings.ts encryption.enable, unlockData, encryptToggle, wrongPassword, insecureContext · commity 266d6a76, cceadca6 (SHA-256 obrázků bez crypto.subtle) · GitHub #13 · dirigent:prace/1110-app-github-11-13 (https, localhost/127.0.0.1, soubor z disku) -->

<a id="A1.2"></a>
## A1.2 Personen, Beziehungen und Stammlinien

Ein Stammbaum besteht aus Personen und den Beziehungen zwischen ihnen: Eltern und Kinder, Partner und ihre
Verbindungen. Aus dem Stammbaum bildet die App **Stammlinien**: eine Stammlinie ist die Linie in männlicher Folge
vom ältesten bekannten Träger des Namens, mit den Mitgliedern und mit denen, die in die Stammlinie eingeheiratet
haben. Nachnamen kennt sie in weiblicher und männlicher Form (Horák und Horáková, Jaworski und Jaworska).

- Ausführlich: [A4](A4-surnames-and-families.md).

<a id="A1.3"></a>
## A1.3 Ansichten: das Umfeld einer Person

Die App zeigt immer das Umfeld einer **zentralen Person**, nicht den ganzen Stammbaum auf einmal. Die Ansichten
**Familie**, **Nachkommen**, **Zeitleiste**, **Fächer** und **Karte** lesen dasselbe Umfeld unterschiedlich. Eine
Ansicht kann eine Stammlinie hervorheben. Ab App 3.27.0 zeigt die Ansicht **Tabelle** den ganzen Stammbaum in Zeilen
von Personen, Verbindungen, Ereignissen oder Quellen, mit berechneten Werten, Vollständigkeit und den Befunden der Prüfung.

- Ausführlich: [A6](A6-views.md).

<a id="A1.4"></a>
## A1.4 Einlesen und Ausgaben

Ein Stammbaum aus einem anderen Programm wird aus einer GEDCOM-Datei eingelesen. Die App sagt, was sie übernommen
und was sie übersprungen hat. Nach außen gibt sie eine Sicherung, GEDCOM, das Familienbuch, Familienseiten und
Seiten des Stammbaums, die Personenseite, ein Poster und eine eigenständige HTML-Datei. Lebende Personen schützt sie
dabei in der Grundeinstellung.

- Einlesen: [A2](A2-loading-a-family-tree.md). Zusammenführen von Stammbäumen: [A8](A8-merging-trees.md). Ausgaben
  und Schutz lebender Personen: [A7](A7-book-pages-and-export.md).

<a id="A1.5"></a>
## A1.5 Quellen, Belege und Prüfung

Zu den Angaben werden Quellen, Zitationen, Ausschnitte von Einträgen und Anhänge erfasst. Die App zeigt, wo Belege
fehlen, und die Prüfung des Stammbaums sucht Fehler und Unstimmigkeiten in den Daten.

- Belege: [A3](A3-evidence-in-the-app.md), Grade der Sicherheit [R3.8](R3-verification-and-citation.md#R3.8).
  Prüfung des Stammbaums: [A5](A5-tree-check.md).

<a id="A1.6"></a>
## A1.6 App und Forschung

Die App funktioniert auch ohne Forschung. Mit der Forschung Strom Research auf demselben Computer zeigt sie den
Stammbaum der Forschung, ihre Arbeit und das, was die Forschung über die Personen weiß, und schickt Änderungen
zurück an die Forschung ([R1.6](R1-research-in-brief.md#R1.6)).

- Verbindung: [S1](S1-connecting-app-and-research.md). Änderungen aus der App: [S2](S2-edits-from-the-app.md).
  Was die Forschung weiß: [S3](S3-what-the-research-knows.md). Forschung aus der App gesteuert:
  [S4](S4-research-from-the-app.md). Telefon: [S5](S5-phone.md).

<a id="A1.7"></a>
## A1.7 So funktioniert Strom in der App

Diese Dokumentation liegt der App bei und lässt sich auch ohne Internet lesen. Das Fenster **So funktioniert Strom**
hat den Inhalt der Teile A, R und S, das **Begriffsverzeichnis** und eine Suche nach einem Wort oder einer Nummer der
Regel.

- **Grenzen:**
  - das Öffnen des Fensters sendet nichts und lädt nichts aus dem Netz;
  - die Nummer einer Regel und Enter springen direkt zur Regel (`R4.3`); eine unbekannte Nummer zeigt den Inhalt;
  - Links zwischen Regeln haben **Zurück**; **Im Web** öffnet dieselbe Regel auf stromapp.info;
  - eine Regel, die neuer ist als die verbundene Forschung, sagt das („Die mit diesem Baum verbundene Forschung hat
    Version …, dies gilt ab …“).
- **Bedienung:** App: **Aktionen → So funktioniert Strom**, auf dem Telefon **Mehr → So funktioniert Strom**, oder
  **Über Strom → So funktioniert Strom**. Der Kreis **?** in der Kopfzeile öffnet die Hilfe direkt bei der Regel: in
  der Forschungsübersicht und im kleinen Panel bei den Abschnitten **Warteschlange**
  ([R2.4](R2-lines-and-queue.md#R2.4)), **Wartet auf Bearbeitung** ([R6.4](R6-awaiting-action.md#R6.4)) und
  **Jetzt** ([R7](R7-when-the-agent-works.md), beim Pausieren [R7.6](R7-when-the-agent-works.md#R7.6)), im Fenster
  **Orte** ([R4.5](R4-places.md#R4.5)), in der Verwaltung der Orte ([R4.4](R4-places.md#R4.4)), im Panel der
  Widersprüche ([R5.3](R5-conflicts.md#R5.3)) und in **Was die Forschung weiß → Widersprüche**
  ([R5.6](R5-conflicts.md#R5.6)). In der Forschung: `strom doc`
  ([R1.8](R1-research-in-brief.md#R1.8)).
- **Gilt seit:** App 3.24.0

<!-- zdroj: app:src/help/help-data.ts, src/help/topics.ts HELP_TOPICS · src/ui/help-mark.ts · strings.ts help.title, index, search, searchPh, web, back, unknown, verRes, topics · vendor/strom-doc/PIN · prace/1105-app-napoveda-impl (§1–§11, e2e help.spec: otevření okna bez síťového požadavku) -->
