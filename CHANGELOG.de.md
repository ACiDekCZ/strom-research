# Was ist neu in Strom Ahnenforschung

[English](CHANGELOG.md) · [Čeština](CHANGELOG.cs.md) · Deutsch

Die Änderungen jeder Version in Kürze. Die vollständigen Hinweise und die Installationszeilen stehen bei
[GitHub Releases](https://github.com/ACiDekCZ/strom-research/releases) (auf Englisch).

## 1.17.0

*In Vorbereitung: die Betas bis 1.17.0-beta.2. Der Abschnitt ist mit dem Release vollständig.*

- **Noch nichts Neues in der Nutzung.** Bisher hat sich nur geändert, wie strom gebaut und veröffentlicht wird.

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
