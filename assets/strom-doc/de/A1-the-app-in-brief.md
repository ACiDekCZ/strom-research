<a id="A1"></a>
# A1 Die App im Überblick

Wie die Strom-App als Ganzes arbeitet, auf einer Seite. Jeder Abschnitt führt zu einem Kapitel mit den genauen
Regeln. Beschrieben werden die Strom-App 3.21.2 und die Forschung 1.25.2.

<a id="A1.1"></a>
## A1.1 Stammbaum im Browser, Daten auf dem Gerät

Die Strom-App ist ein Stammbaum im Browser (stromapp.info) oder in einer einzigen HTML-Datei. Die Stammbäume werden
im Speicher des Browsers auf diesem Gerät gespeichert. Es gibt weder ein Konto noch einen Server mit Daten.

- **Grenzen:** der Speicher des Browsers gehört einem Browser auf einem Gerät. Auf ein anderes Gerät kommt ein
  Stammbaum als Datei (JSON-Sicherung, GEDCOM, eigenständige HTML-Datei, [A7](A7-book-pages-and-export.md)).
- **Gilt seit:** App 1.0.0

<!-- zdroj: app:strings.ts about.description, embeddedMode.infoText1, embeddedMode.infoText2 -->

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
Ansicht kann eine Stammlinie hervorheben.

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
