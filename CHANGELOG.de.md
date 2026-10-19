# Was ist neu in Strom Ahnenforschung

[English](CHANGELOG.md) · [Čeština](CHANGELOG.cs.md) · Deutsch

Die Änderungen jeder Version in Kürze. Die vollständigen Hinweise und die Installationszeilen stehen bei
[GitHub Releases](https://github.com/ACiDekCZ/strom-research/releases) (auf Englisch).

## 1.18.0

*In Vorbereitung: die Betas bis 1.18.0-beta.4. Der Abschnitt ist mit dem Release vollständig.*

- **Handyfotos aufrecht.** Ein Foto, das nach seiner EXIF-Ausrichtung gedreht ist, wird gelesen, wie es gesehen
  werden soll, aufrecht; die darauf markierten Stellen (Ausschnitte, die Hälften einer Doppelseite, ein gespeicherter
  Teil) sind die des Bildes, wie es gezeigt wird. Das Foto selbst bleibt, wie es war.
- **HEIC-Fotos und PDF-Dokumente lesbar.** HEIC-Fotos vom Handy und die Seiten einer PDF werden zum Lesen in JPEG
  umgewandelt — unter macOS, Windows und Linux —, das Original bleibt, wie es kam. Ein HEIC-Foto geht als
  JPEG-Ausschnitt in die Strom-App. Wo nichts auf dem Computer ein Bild umwandelt, sagt es ein Satz, auch was helfen
  würde; `strom tidy` räumt umgewandelte Bilder nach 30 Tagen oder über 500 MB weg.
- **Ein Dokument auf einmal gelesen.** `strom document read` liest ein Foto, einen Scan oder eine PDF eines
  Dokuments — einen Matrikeleintrag, einen Brief, eine Urkunde, einen Grabstein, die Rückseite eines Fotos: die
  Abschrift Wort für Wort, ihre Übersetzung, was alte Wörter und Abkürzungen bedeuten, und die genannten Personen,
  samt wem im Stammbaum sie entsprechen können. Nichts wird ergänzt: ein Name, der nicht im Dokument steht, fällt
  weg — auch ein Nachname, nie vom Vater oder aus einer anderen Familie genommen —, Unleserliches wird markiert; ein
  zweiter Leser kann blind lesen. In den Stammbaum gelangt nichts von selbst. Ein schon gelesenes Dokument sagt es,
  so wird es nicht versehentlich ein zweites Mal gelesen.
- **Fotos vom Handy.** `strom phone on`, das nur ein Mensch einschaltet, lässt ein Handy im Heimnetz (WLAN oder
  Kabel — nie ein Mobilfunknetz oder ein VPN) zu diesem Computer. Das Handy wird einmal per QR-Code gekoppelt; seine
  Seite fotografiert dann oder wählt aus der Galerie und schickt die Fotos ganz in einen Stammbaum der Forschung, mit
  einer Notiz und der Person, die sie zeigen — wie „Materialien hinzufügen“ in der Strom-App. Ein Foto bleibt auf dem
  Handy, bis der Computer es hat, so geht bei einer unterbrochenen Verbindung nichts verloren.
- **Die Forschung vom Handy aus verfolgt.** Die Seite des Handys zeigt, was die Forschung tut — woran gerade
  gearbeitet wird, was auf eine Entscheidung wartet, die letzten 24 Stunden und die letzten Änderungen, alle 10
  Sekunden aufgefrischt, solange die Seite angesehen wird — nur zum Ansehen: auf dem Handy wird nichts beantwortet,
  gestartet oder entschieden. Ein unerreichbarer Computer wird gesagt, mit den letzten Daten und ihrer Zeit. Die Seite
  öffnet den Stammbaum, dessen QR-Code sie gekoppelt hat, und lässt sich als Symbol auf den Home-Bildschirm legen,
  das sie ohne neues Koppeln öffnet.
- **Eine Zustimmung in einer Sprache.** Eine Zustimmung, die nur ein Mensch gibt (eine Forschung entpacken, einen
  Stammbaum entfernen, ein abgelehntes Fenster), steht ganz in der Sprache der Forschung, nichts davon bleibt
  Englisch.
- **Ein abgelehntes Update.** Wird `strom update` abgelehnt, sagt es, dass nichts installiert wurde und welche
  Version bleibt, und endet mit einem Fehlercode; eine misslungene Installation wird auch in der Sprache der
  Forschung gesagt.
- **Auch im Terminal gefragt.** Was den Computer nach außen öffnet, Geld kostet oder ein fremdes Programm startet –
  Remote Control, Downloader ohne Rückfrage, die Bedingung für den Agenten allein, ein Hook, ein eigenes Tempo eines
  Archivs, die Verbindung mit dem Telefon, das Abstimmen des Lesens – fragt auch im Terminal Ja oder Nein; Enter
  heißt Nein, `--yes` antwortet nie dafür.

## 1.17.0

*19.10.2026 · gehört zur Strom-App 3.13.1.*

- **Zuerst, was Hypothesen verbinden würden.** Die Aufgaben, zu ergänzen, was die Varianten einer offenen Hypothese
  verbinden würden, kommen in der Warteschlange zuerst — auch in einer bestehenden Forschung nach dem Update —, so
  zeigt die Strom-App diese Verbindungen bald.
- **Die Brücke der Strom-App läuft, solange ein Agent arbeitet.** Die Brücke endet nicht mehr nach zwei ruhigen
  Stunden, solange ein Agent im Stammbaum arbeitet (auch ein pausierter Lauf), so sieht die Strom-App die Forschung
  bei der Arbeit auch in einem Stammbaum, dem sie gerade nicht folgt. Eine wegen Ruhe beendete Brücke kommt an ihrer
  Adresse zurück, sobald die Arbeit wieder beginnt; eine mit `strom live stop` angehaltene bleibt angehalten.
- **Ein unterbrochener Download wird gemeldet und aufgeräumt.** Ein Download, dessen Prozess mittendrin endete, wird
  als unterbrochen gemeldet, mit dem, was gespeichert ist und was fehlt; sein Arbeitsordner wird entfernt.
- **Neues Material in der Sprache der Forschung.** Was hereinkam (registriertes Material, was hinzukam, wahrscheinliche
  Duplikate, Namen nach der Heirat, Aufgaben), wird in der Sprache der Forschung gesagt.
- **Zahlen so, wie die Sprache sie sagt.** Texte zählen in den Formen ihrer Sprache: 1 Änderung, 2 Änderungen —
  englisch 1 task, 2 tasks, tschechisch 1 úkol, 2 úkoly, 5 úkolů — statt „Änderung(en)“.
- **Mehr in der Sprache der Forschung.** Die Personen ohne eigenen Eintrag (`strom person list --unproven`, worauf
  `strom check` verweist), was `strom export gedcom` geschrieben hat, und eine Zählerwarnung von `strom check` stehen
  in der Sprache der Forschung, samt ihren Zahlen – Größe und Qualität der Bilder so, wie die
  Sprache sie schreibt (0,4 MB · Qualität normal).
- **Speichern unter Windows wartet auf den Virenschutz.** Eine Datei, die ein Virenschutz oder die Suchindizierung
  kurz festhält, wird nach kurzem Warten gespeichert – oder gelesen –, statt dass das Schreiben scheitert. Eine länger
  festgehaltene Datei hält den Befehl als Ganzes an, nichts davon bleibt halb gespeichert, und die Meldung sagt, dass
  ein anderes Programm die Datei hält und der Befehl einfach noch einmal laufen kann.
- **Fehler für einen Agenten auf Englisch.** Was ein Agent liest, ist Englisch, in welcher Sprache die Forschung auch
  ist; ein Mensch am Terminal oder im Menü liest es wie bisher in der Sprache der Forschung.

## 1.16.0

*17.10.2026 · gehört zur Strom-App 3.13.0.*

- **Das Terminal für die Fenster der Forschung (macOS).** Was die Strom-App in einem Terminal öffnet, und ein an ein
  neues Fenster übergebenes Gespräch, kann sich in iTerm2 statt im Terminal des Systems öffnen: der erste Punkt der
  Einstellungen, die Einrichtung, wenn beide da sind, oder `strom config set terminal iterm2`. Ein nicht installiertes
  Terminal fällt auf das des Systems zurück und sagt es im Fenster; `strom doctor` nennt das gewählte. Unter Windows
  bestimmt es das System.
- **Jede Person am Rand des Stammbaums mit eigenen Varianten.** Wenn eine offene Hypothese den Stammbaum bei mehreren
  Personen anschließt, trägt jede die Varianten, die sie nennen, und die Familie außerhalb des Stammbaums, zu der sie
  gehört; so kann die Strom-App alle zeigen, nicht nur die erste.
- **Der Rand des Stammbaums, Person für Person.** `strom edge --json` nennt jede Person, an die eine Hypothese
  anschließt, mit den Varianten und der Familie jeder einzelnen.
- **Der Familienname nach der Heirat, in beide Richtungen mit der Strom-App.** Ein Name nach der Heirat, den die
  Strom-App zurückschickt, kommt als Name nach der Heirat an, nie als Umbenennung oder als weitere Form des
  Geburtsnamens; derselbe Familienname ist derselbe Name, mit welchem Vornamen auch immer. In der App geändert oder
  entfernt, geht der alte dort, wo ihn nur Änderungen in der App gaben; einer, den ein Eintrag belegt, bleibt.
  `strom intake` liest `_MARNM` anderer Programme als Namen nach der Heirat. Eine Forschung, die früher aus so einem
  Stammbaum begonnen wurde (MyHeritage, Legacy, PAF), bekommt sie aus der Datei, die sie aufbewahrt:
  `strom input names I…` zeigt sie, `--apply` fügt nur diese Namen hinzu, mit dem Import als Quelle, `--undo` nimmt
  sie zurück.
- **Ein Archiv, eine Frage.** Kommen die Bilder eines Archivs von mehreren Adressen (seine Seite, ein Album, ein
  Bildserver), wird die Erlaubnis des Archivs einmal erfragt und gilt für alle, nicht Adresse für Adresse.
- **Forschungslinien auf Tschechisch.** Die tschechischen Texte sagen jetzt überall „linie výzkumu“ (Forschungslinien).

## 1.15.0

*16.10.2026 · gehört zur Strom-App 3.12.0.*

- **Ein Strom-Archiv nach Wahl, auch mit einem KI-Agenten.** Die Einrichtung fragt, ob neue Stammbäume Forschungen mit
  dem Agenten sind oder nur ein Strom-Archiv; in den Einstellungen lässt sich das für einen Stammbaum oder für die
  neuen ändern.
- **Eine Forschung wartet auf ihren Agenten.** Ein Stammbaum, dessen KI-Agent nicht auf diesem Computer ist, speichert,
  was die Strom-App sendet, wie ein Strom-Archiv. Sobald der Agent installiert ist, geht die Forschung von selbst weiter.
- **Ein Buch eines Archivs, einmal geladen.** Ein Buch, das schon in der Forschung ist, wird genannt, statt neu
  eingetragen und wieder geladen zu werden – ein Archiv wird nie zweimal um dieselben Bilder gebeten.
- **Schneller lesen.** Fünf Leser lesen die Scans gleichzeitig (die Einstellung `read.parallel`, 1 bis 10), und ein
  langer Download zeigt, wie weit er ist („40/109 Bilder“). Die Leser beginnen schon, während ein Buch lädt: seine
  Bilder werden zu zehnt registriert, und was nicht kam, wird genau gesagt; Strg+C behält, was schon kam. Ein Archiv
  bekommt dieselben Anfragen im selben Tempo wie bisher. Ein Buch kann auch im Hintergrund laden, während der Agent
  weiterarbeitet (`strom fetch --background`), nie aus einem Archiv, das nur das Tempo eines Menschen erlaubt. Die
  Suche nach einem Eintrag kann beim Fund enden (`strom read --until-found`): die gelesenen Bilder werden genau gesagt,
  und nur sie gelten als durchsucht.
- **Stammbäume aus anderen Programmen.** Eine GEDCOM-Datei mit Byte-Order-Mark oder in UTF-16 (so speichern sie manche
  Windows-Programme) wird als Stammbaum gelesen; der Stammbaum einer anderen Forschung wird als fremder übernommen.
- **Sauber auf einem Computer.** Die Live-Ansicht endet sauber auf jedem System, auch unter Windows, und die Strom-App
  erfährt, dass sie endete. Ein anderer strom auf demselben Computer (aus npm oder aus den Quellen gebaut) übernimmt nie
  die Links der Strom-App oder den Update-Kanal.
- **Korrekturen aus echten Forschungen.** Die tägliche Ration des Alleinarbeitens lässt eine neue Woche sofort
  beginnen, nutzt in den letzten zwei Stunden der Woche, was übrig ist, statt über die Erneuerung hinaus zu warten,
  und sagt, wann sich die Woche erneuert. Ein Alter als Bruch (½ Jahr, 1 1/2 Jahre, ein halbes Jahr) wird gelesen, und
  eine Liste von Bildern (`strom read --images 5-19,21-39`) wird so gelesen, wie sie angegeben ist. Ein Buch lädt die
  Sitzung, die es liest, nie im Voraus für eine spätere; `strom fetch --recordset` findet das Buch selbst; Zahlen und
  Befehle werden so genannt, wie sie geschrieben werden.
- **Was ist neu.** Nach `strom update` und bei `strom --version` ein Link zu dieser Übersicht in der Sprache der
  Forschung. Die Strom-App zeigt die Punkte einer neuen Forschungsversion in ihrem Fenster „Was ist neu“.

## 1.14.0

*11.10.2026 · gehört zur Strom-App 3.11.0.*

- **Die Bedingungen jedes Archivs.** strom hält sich daran, wie weit jedes Archiv automatischen Zugriff erlaubt:
  erlaubt, eingeschränkt, nur von Hand oder gar nicht. Wo die Bedingungen unklar sind, entscheidet einmal der Mensch.
  Eine Ablehnung pausiert ein Archiv für einen Tag.
- **Was wartet, nach Orten.** Die Dinge für den Menschen sind nach Art sortiert und danach gruppiert, wo sie erledigt
  werden: ein Archiv, ein Amt, die Familie, eine Website. Ein Brief oder eine Frage lässt sich als verschickt markieren.
- **Alte Handschrift lesen.** Scans in der Größe, die jede Ansicht braucht, ein Leser der Scans auf dem Modell, das der
  Mensch gewählt hat, und das Lesen abgestimmt auf die eigenen belegten Einträge der Forschung.
- **Mit der Strom-App 3.11.0.** Ein Widerspruch zwischen einer Änderung in der App und einem Eintrag wird in der App
  entschieden; Hypothesen zeigen, was jede Variante verbinden würde.
- **Kleinere Unterlagen für den Agenten, die mehr wissen**, und der Denkaufwand ist die Wahl des Menschen
  (`model.effort`).
- **`strom grep`** durchsucht die Unterlagen, Notizen und Ausgaben der Forschung, auch über Akzente hinweg.
