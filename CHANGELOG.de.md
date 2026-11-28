# Was ist neu in Strom Ahnenforschung

[English](CHANGELOG.md) · [Čeština](CHANGELOG.cs.md) · Deutsch · [Polski](CHANGELOG.pl.md)

Die Änderungen jeder Version in Kürze. Die vollständigen Hinweise und die Installationszeilen stehen bei
[GitHub Releases](https://github.com/ACiDekCZ/strom-research/releases) (auf Englisch).

## 1.38.0

- **Ein übersichtlicheres Menü im Terminal:** jeder Bildschirm sagt, wo er ist (Strom › Einstellungen › Wartung), die
  Auswahlen als `[1]  Bezeichnung   Stand`, ein Schalter mit seinem jetzigen Stand und wohin er umschaltet, zurück
  immer zuletzt als `[0]` (auch der Weg eines Herunterladers in Einstellungen → Archive), die Eingabezeile sagt, was
  Enter tut, und ein Befehl zum Abschreiben steht in einer eigenen Zeile; in einem Terminal, das es kann, sind Tasten
  und Befehle hervorgehoben. Wo ein Agent arbeiten soll, steht die Aufgabenliste zuerst mit dem, was darin als
  Nächstes kommt; nur eine Linie der Forschung liegt einen Schritt weiter. `strom demo` probiert strom an einer
  Beispielforschung einer erfundenen Familie aus (cs, en, de, pl), getrennt von den eigenen Stammbäumen und
  Einstellungen und in der Strom-App geöffnet; alles darin lässt sich durchsehen, nichts bietet einen Agenten an;
  `strom demo --remove` löscht sie.
- **Material einmal sortiert, Einstellungen der Forschung in Worten:** eine Datei, der die letzte Sortierung einen
  Titel, eine Art, ein Datum oder Personen vorschlug und die sie schon wie vorgeschlagen hat, gilt als erledigt und
  wird nicht neu sortiert; was der Mensch in der Strom-App über einen Vorschlag entschied (übernommen, abgelehnt und
  warum), bleibt bei der Sortierung. Titel, Art, Datum und Notiz einer Datei, im Material angegeben, bleiben, auch
  wenn die Strom-App daraus ein Porträt oder einen Anhang ohne sie macht und den Stammbaum zweimal sendet (sie galten
  als in der App entfernt). Eine in der App oder im Menü geänderte Einstellung erscheint in den letzten Änderungen mit Namen und Wert in der Sprache der Forschung („In der Forschung ausgeschaltet:
  Rückfrage vor dem Sortieren des Materials“), nicht mehr als Schlüssel (`sort.confirm`).
- **Der Agent findet sich mit weniger Versuchen zurecht:** `strom place find <Name>` und `strom place <Name>` führen
  zu `strom place list <Name>`; `strom source list --note <Text>` listet mit einem Aufruf die Quellen, deren Notiz
  etwas sagt (etwa dass ein Register die Adresse gab); `strom media view` erklärt, wie ein nur in Teilen registriertes
  Bild und ein Ausschnitt davon anzusehen sind; bei der eBadatelna (SOA Praha) hält sich der Agent an die Grenzen des
  Archivs, die für Menschen und automatisierte Systeme gleich gelten (höchstens 2 Bilder pro Sekunde, ein ZIP auf
  einmal, 10 ZIPs in 24 Stunden), und schlägt nie einen Weg an ihnen vorbei vor. Die Prüfung, die strom vor jedem
  Shell-Befehl eines Agenten macht, wartet bis zu 60 Sekunden statt 10 (auf einem langsamen Windows-Computer wurde sie
  nicht rechtzeitig fertig, während neben einem Gespräch ein Agent allein arbeitete), übernimmt nie den ersten Start
  einer neuen Version, und eine, die lange dauerte, wird für `strom error` vermerkt; eine Forschung erhält das neue
  Limit beim ersten Start dieser Version.
- **Aus einem Stammbaum, nicht von Hand eines Menschen:** Personen eines in der Strom-App importierten oder
  zusammengeführten Stammbaums, die eine ältere App ohne Importmarke schickte, galten als Eintrag eines Menschen (✓
  von einem Menschen bestätigt); eine Sendung, die sie markiert, berichtigt sie jetzt von selbst, und eine ältere
  Sendung bestimmt der Mensch einmal – in der App unter Was wartet („Kam es aus einem Stammbaum?“) oder mit `strom
  sync as-import I…`: zuerst eine Vorschau, die Forschung gesichert, nur seither unveränderte und unbestätigte
  Angaben, `--undo` nimmt es zurück. Ein Vorname mit Klammern zwischen seinen Wörtern („(Vincent) François (Paul)“)
  ist ein Name, wie geschrieben; Einträge eines Menschen im Terminal gehen sofort durch, auch wo ein anderer Lauf die
  Sitzung eines Agenten übernahm. Die von Hand gesetzte Reihenfolge der Ehen einer Person in der Strom-App behält die
  Forschung und gibt sie so zurück; in der App wieder nach den Daten geordnet, so auch in der Forschung.
- **Ein Telefon, ein Tablet oder ein weiterer Computer zu Hause:** mit eingeschalteter Verbindung (`strom phone on`
  oder Forschung → Geräte → Gerät verbinden… in der Strom-App) öffnet ein Telefon, Tablet oder weiterer Computer im
  selben Heimnetz per QR-Code die Forschung in der Strom-App von diesem Computer, sieht und bearbeitet sie wie am
  Computer und schickt Fotos hinein; Zustimmungen bleiben am Computer. Jedes Gerät wird mit einem eigenen Schlüssel
  gekoppelt, alles dazwischen ist verschlüsselt und nichts verlässt das Heimnetz; Geräte lassen sich umbenennen und
  entkoppeln, und die Einstellung `devices.mode off` lässt nur die Seite des Telefons, wieder eingeschaltet von der
  Person in ihrem Terminal.
- **Geschichte der Häuser:** `strom house` führt einen Eintrag zu jedem Haus, in dem die Familie lebte – seine Nummern
  im Lauf der Zeit, Besitzer, Bewohner, was mit ihm geschah, seinen Ort auf der Karte und was dafür durchgesehen
  wurde; die Häuser der direkten Vorfahren erforscht die Forschung nur mit eingeschalteter Einstellung „Geschichte der
  Häuser“, ein einzelnes Haus lässt sich immer anfordern, auch aus der Strom-App. Über dem Ort eines Hauses darf die
  App die Luftbilder der 1950er-Jahre zeigen (Tschechien). Ein erforschtes Haus, das genug erzählt (zwei Generationen
  des Stammbaums oder drei Besitzer und Bewohner mit Quellen), bekommt bei eingeschalteten Erzählungen seine
  Erzählung, jede Angabe mit Quelle, Unsicheres als unsicher gesagt; ein Entwurf bis zur Freigabe, danach nie
  umgeschrieben; `strom house story` und die App fordern sie jederzeit an. Die Forschung eines Hauses geht eine Liste
  der Quellen seines Landes durch (in Tschechien das Adressregister, die Flurnamen, die Gewässer, die Orthofotos, die
  Topographien) und schreibt ins Haus nur, was etwas sagte; eine Gemeinde behält ihre Bilder (nur unter freier Lizenz,
  mit dem, was sie zeigen) und ihre Flurnamen, jedes Haus ein kurzes Aussehen und eine Prüfung, ob es mehr darüber zu
  lesen gibt; sein Aussehen folgt als eigene Aufgabe nur dort (Einstellung „Aussehen der Häuser“, standardmäßig an);
  ein Haus lässt sich aus der Strom-App mit dem Agenten besprechen. Eine aus einer älteren Forschung übernommene
  Angabe, deren Quelle im Web steht (die Geschichte einer Gemeinde als PDF), liest die Forschung des Hauses und
  bestätigt oder berichtigt sie mit der Stelle in der Quelle; eine Adresse, die sich nicht öffnet, bleibt eine Zeile
  dessen, was durchgegangen wurde. Das Material der Forschung nennt bei jeder Datei die Häuser, zu denen sie gehört,
  damit die Strom-App sie dort zeigt, wo die Datei verwendet wird. Die Liste der Häuser sagt, welches auf der Karte
  steht und von welchem das Aussehen bekannt ist (für die Statistik der Strom-App).
- **Die Baumprüfung:** `strom health` sagt kostenlos und ohne etwas zu schreiben, worauf die Forschung steht und was
  als Nächstes zu tun ist: die eigene Prüfung von strom, um wie viel der Baum in 30 Tagen gewachsen ist, Linien, die
  stillstehen, längst verschickte Anfragen ohne Antwort, was auf eine Entscheidung wartet, Korrekturen, Fakten zum
  Überprüfen nach Linien, nie durchsuchte Astenden, nicht sortiertes Material – mit den Schritten der Reihe nach, jeder als Befehl zum Eintippen, in der Sprache der Forschung; die
  Strom-App zeigt es bei der Datenqualität. Die Prüfungen des Agenten (Geschichten und Notizen gegen die Fakten, wo
  weiter suchen, Orte, Quellen, Namen in der Familie, unvollendete Importe und mehr) werden als Aufgabe am Anfang der
  Warteschlange erbeten, im Terminal (`strom health --ai`, `--dry` sagt, was es kostet) oder aus der Strom-App mit
  einer Schätzung; der Agent liest nur und schlägt vor, höchstens 30 Befunde je Lauf, jeder mit seinem Beleg, und
  `--changed` prüft nur, was sich seit der letzten Prüfung geändert hat. Ein angenommener Befund wird eine Aufgabe der
  Warteschlange, ein abgelehnter wird nie wieder gemeldet (`strom audit accept|dismiss|undo`, auch in der Strom-App).
  **Lebende geschützt in einer GEDCOM-Datei zum Weitergeben:** `strom export gedcom --living` schreibt eine Kopie, in
  der Lebende nur Initialen und Geburtsjahr behalten (`surname`: nur den Nachnamen, `hidden`: keinen Namen), ihr Platz
  in der Familie bleibt und die Verstorbenen sind unverändert; lebend ist, wer kein Sterbedatum, kein Begräbnis und
  keine Einäscherung hat und vor weniger als 110 Jahren geboren wurde, auch nach Ehen und Kindern beurteilt – dieselbe
  Regel wie bei den Ausgaben der Strom-App. Die Kopie kommt nach `output/tree-initials.ged` außerhalb der Historie
  oder mit `--out` überallhin außerhalb des Ordners der Forschung; die Einstellung „Schutz der Lebenden in
  GEDCOM-Dateien nach außen“ (`gedcom.living`) macht sie zur Vorgabe. `output/tree.ged` bleibt, wie sie war, und der
  Export und `strom pack` sagen jetzt, dass sie alle Angaben zu lebenden Personen enthalten. Eine geschützte Datei
  sagt es in ihrem Kopf und wird von `strom sync` nie übernommen (`strom intake` legt sie nur als Material ab); die
  Hilfe zu `--research` sagt, dass Geschwister und Seitenlinien wegfallen.
- **Erneutes Lesen, Bücher und Bilder berichtigt, auch nachträglich:** eine frühere Lesung, die keine Frage behielt (eines älteren
  Werkzeugs), wird ganz neu gelesen statt abgelehnt, ihr Ergebnis wird ganz geschrieben, bevor die Quelle fertig sagt,
  eine Runde mit meist ungelesenen Stellen sagt warum und bietet nichts weiter zum Bezahlen an, und eine Lesung, die
  eine Korrektur machte, wird nicht wieder angeboten; ein Buch erhält die Zahl der Bilder, die der Katalog des Archivs
  angibt, ein ganz heruntergeladenes Buch seine Zahl auf das Wort des Menschen (`strom fixes`), auf erneut
  gespeicherte Bilder wird gewartet, bis jede neue Kopie da ist, und der Hinweis zu einem Bild in Teilen nennt die
  Hälften, in denen es liegt.
  Ein früher verschickter Brief oder eine E-Mail wird an dem Tag als versandt vermerkt,
  an dem sie wirklich hinausging (`strom task sent T… --date YYYY-MM-DD`, im Menü „Was wartet“ wird nach dem Tag
  gefragt, Enter = heute), und ein falsch vermerkter Tag lässt sich bei einer versandten Anfrage nachträglich
  berichtigen (der Tag davor wird genannt, derselbe Befehl mit ihm nimmt es zurück); wie lange sie wartet und die 30
  Tage ohne Antwort zählen ab diesem Tag, nach dem Kalender des Rechners, um Mitternacht nie einen Tag daneben. Auch
  die Strom-App kann den Tag senden, für eine Anfrage oder einen ganzen Ort. `strom media renumber M…=n --reason`
  ändert nur die Nummer eines registrierten Bildes (Datei, Zitate und Ausschnitte bleiben; zwei vertauschte mit einem
  Befehl; ein anderer Scan auf der neuen Nummer wird abgelehnt, Teile und Kopien auf der alten genannt, die Geschichte
  der Nummern in `strom media show`, derselbe Befehl umgekehrt nimmt es zurück); ein irrtümlich einer Quelle
  zugeordnetes Bild kommt samt Ausschnitten von ihr ab (`strom source edit S… --media-remove M… --reason`), und `strom
  media retract` eines zitierten Bildes verweist auf beides.

## 1.37.0

*25.11.2026 · gehört zur Strom-App 3.32.0.*

- **Ein Archiveintrag der Forschung hält kein Portal der Liste von strom mehr:** ein Buch mit einer Adresse auf einem
  Portal, das die Liste von strom kennt (Porta fontium, Acta Publica…), macht das Portal nicht mehr so streng wie das
  Archiv, unter dem es eingetragen ist – das Portal folgt seinen eigenen Bedingungen. Das eigene Portal des Archivs unter einer anderen Adresse (die Liste
  nennt dort die Bedingungen auf der Website des Archivs, etwa die eBadatelna des Prager Staatlichen Gebietsarchivs)
  hält er weiter. Eine Stufe, die strom von früher
  hält, bleibt, bis der Mensch unter „Was wartet“ entscheidet. Wo der Archiveintrag eine Website weiter hält, nennen
  `strom doctor` und `strom allow archive` das Archiv, sein Buch und die Website. Kapitel R12.2 der Anleitung nennt kein
  nicht vorhandenes `strom run --chrome` mehr.
- **Die Bildnummer irgendwo im Namen:** von Hand in den Ordner einer wartenden Aufgabe gespeicherte Bilder werden auch
  unter den Namen eines Portals übernommen – `__0236.jpg`, `Lhota_11__125.jpg` (ein Portal, das nur auf drei Stellen
  auffüllt, ab Bild 100 nicht mehr), `fond12_kniha3_236.jpg`: von mehreren Zahlen im Namen die eines gewünschten Bildes,
  die von Datei zu Datei des Ordners wechselnde, sonst die letzte vor der Endung. Datum und Uhrzeit eines
  Bildschirmfotos sind nie eine Bildnummer, ebenso wenig ein Jahr dahinter (`33 1784.jpg`), wenn nicht bekannt ist,
  welche Bilder; ein Name mit zwei gewünschten Nummern wird nicht geraten, sondern mit der Datei genannt. Ein Name, der
  keine Bildnummer ergibt, hält den Rest nicht mehr auf (`000.jpg` bleibt liegen und wird einmal genannt, ohne Rat zum Umbenennen). Dateien, die nach den
  Einträgen darauf (`001-004.jpg`) oder sonst nicht nach Bildnummern benannt sind, werden in der Reihenfolge des Ordners
  übernommen, sobald 20 Minuten lang nichts mehr gespeichert wird; die Einträge bleiben bei jedem Bild vermerkt, und die
  Aufgabe kommt mit der Liste zurück, welche Datei welches Bild wurde. Ein weiteres Blatt unter derselben Nummer
  (`7a.jpg`) wird am Inhalt erkannt: eine Kopie, ein vergrößerter Ausschnitt oder ein eigener Scan, unter seinem Namen
  behalten, nie versteckt – im selben oder einem späteren Stapel, auch nach der Rückkehr der Aufgabe und mit `strom
  media add --inbox <Ordner>`. Eine Aufgabe, für die nur ein Teil der Bilder kam, geht nach derselben Ruhezeit mit dem
  zurück, was kam und was fehlt – ein Scan an der Grenze zweier Jahrgänge zählt einmal.
- **Eine erschöpfte Seitengrenze wird nicht mehr ins Leere abgewartet:** nach `web.perHost` erfährt der Agent, wann die
  Website wieder Seiten gibt – die Grenze dieses Computers, oder in seiner Sitzung keine mehr – und was bis dahin zu tun
  ist: die Aufgabe bleibt offen, andere Arbeit, sonst Ende der Sitzung; keine Seite vorher erneut und kein Warten.
  `strom run` lässt eine Aufgabe auf einer solchen Website vorerst aus und nimmt eine andere; gibt es keine, wartet er,
  bis genug Seiten frei sind (ohne Agent, nichts wird gesendet), oder endet und sagt, wann. Eine Aufgabe, die auf ein
  Bild wartet, das der Browser des Agenten nie gespeichert hat (Seite abgewiesen), kehrt mit dem Ende der Sitzung in
  die Warteschlange zurück und gilt nie als vom Browser zurückgehalten. Ein so beendeter Lauf ist für die
  Strom-App ein fertiger Lauf, kein Fehler.
  Bilder, die der Browser des Agenten speichert, sind seine Arbeit: solange die Sitzung des Agenten Bilder über seinen
  Browser speichert (`strom media save`), steht die Aufgabe nicht mehr unter „Was wartet“ – auch nicht in deren
  Zahlen, Markierungen oder Hinweisen – und die Strom-App erfährt sie als laufende Arbeit (`working[].saving`: wie
  viele der gegebenen Bilder gespeichert sind). Auf den Menschen wartet nur ein Bild, das der Browser zurückgehalten
  hat – das Herunterladen mehrerer Dateien von der Website erlauben, gleich zuerst gesagt – und eine mittendrin
  beendete Sitzung: Speichern bei ihrem Bild angehalten, die nächste Sitzung setzt es fort. Früher geschriebene
  Wartezustände zeigen sich so ohne Eingriff. Ist die Ursache behoben, geht eine solche Aufgabe – und eine mit Aufnahmen,
  zu denen nur ein Browser führt, sobald der Browser des Agenten dorthin reicht, oder nur vom Bildschirm eines Betrachters
  gelesen – aus „Was wartet“ an den Agenten zurück, einzeln oder ein ganzes Archiv auf einmal (auch aus der Strom-App:
  `waiting[].retry` sagt, worauf sie jetzt wartet und wie viele Aufnahmen): sofort an der Reihe, höchstens dreimal am
  Tag, und wird sie wieder zurückgehalten, wartet sie erneut und sagt es. Ein mit `--again` erneut gespeichertes Bild wird sofort als das Bild
  übernommen, das bisherige zurückgezogen und aufbewahrt – kein `strom media aside --take` für jedes Bild. Mehrere
  Bilder auf einmal kosten weit weniger: `strom media save --image 40,41,45` (höchstens zehn, je eine Seite oder eine
  Adresse mit `{n}`) gibt ein kürzeres Skript für alle – jedes Bild weiter auf seiner eigenen Seite im Tempo eines
  Menschen – und ein `strom media add --inbox --waiting` übernimmt sie; ein Agent mit Subagenten gibt mehr als drei an den
  Subagenten des Baums `strom-image-saver` (kleiner Kontext, `model.cheap` der Person, dieselben Hooks). Eine ordentlich
  gespeicherte Kopie geht einem Bildschirmfoto vor, auch einem mit mehr Pixeln, und `strom media cites M… --move-to M…`
  verlegt die Quellen, die das Bildschirmfoto zitieren, auf sie – das Bildschirmfoto bleibt erhalten.
- **Sendungen aus der App leichter und schneller:** eine Sendung aus der Strom-App wird einmal statt zweimal geplant,
  und Dateien, die die Forschung schon hat, reisen per Verweis (ihrem Hash) statt mit allen Daten; eine Sendung, die
  eine Datei nennt, die die Forschung nicht findet, wird ganz abgewiesen, bevor etwas gespeichert wird, und die App
  sendet sie mit den Daten erneut. „Was wartet“ zeigt eine Sendung, die noch gezählt wird, nie als 0 Änderungen.
  Mehrere Geräte an einer Forschung: eine Sendung nennt den Browser oder Computer, von dem sie kam (in
  `strom input list`, im Verlauf und im Commit); ein Konflikt zweier Sendungen nennt beide Geräte; das Zurücknehmen
  einer Sendung lässt einen Teil einer Angabe, den seitdem ein anderes Gerät oder die Forschung geändert hat, wie er ist,
  und sagt es.
- **E-Mails einer Person sind ein Kontakt, kein Wohnort:** E-Mails aus einem GEDCOM (ein Wohnort von MyHeritage nur mit
  E-Mail, die ältere Notiz „E-mail: …“ der Strom-App) werden zum Kontakt der Person, getrennt von den Fakten in `strom
  person show` und auf der Personenkarte gezeigt – nie ein Ereignis oder ein Ort, an dem die Person lebte, nie dem
  Agenten gegeben. Der Abgleich mit der App fügt E-Mails hinzu und nimmt sie weg wie andere Änderungen. Die neue
  Prüfung `strom fixes contact-residences` macht aus Wohnorten, die ein älterer strom aus E-Mails gemacht hat, den
  Kontakt (zurückgezogen, nie gelöscht, rückgängig mit `strom fixes undo`).
  **Volkszählungen als eigenes Ereignis:** die Volkszählung einer Person, als Ereignis namens „Volkszählung“
  („Census“, „Sčítání lidu“…) geschrieben, geht als Volkszählung in die Strom-App, so dass das Laden der Version der
  Forschung solche Volkszählungen nicht mehr jedes Mal durchgestrichen zeigt; der Datensatz der Forschung bleibt, wie er
  geschrieben wurde. `strom check` warnt vor zwei Volkszählungen einer Person mit demselben Datum, und ein zweimal
  zitierter Eintrag steht in der Notiz des Fakts nur einmal.
  **Religion als Angabe:** die Religion, die ein Eintrag bei einer Person nennt – als Wort in ihrer Spalte oder als
  Zeichen darin –, wird als Angabe Religion (RELI) mit dem Eintrag als Quelle und seinem Datum erfasst, nie aus den
  Eltern, der Pfarrei, dem Buch oder dem Ritus abgeleitet und nie aus einem nicht sicher gelesenen Wort. Ein weiterer
  Eintrag derselben Konfession fügt der Angabe nur seine Quelle hinzu; eine gewechselte Konfession ist eine eigene
  Angabe. Nennt die Abschrift eines eigenen Eintrags der Person eine Religion, die die Forschung noch nicht als Angabe
  hat, erinnert das Briefing den Agenten daran, wenn er an dieser Person arbeitet.
- **Material zu einer Personenliste:** die Strom-App kann einen Scan statt an eine Person an eine ganze Personenliste
  schicken (einen Zählbogen, eine Matrikenseite). Das Material behält die Liste so, wie sie geschickt wurde – Name,
  Art, Regel und die IDs ihrer Personen; bis zu 50 davon sind die Personen des Materials, eine längere Liste wird mit
  einer Datei aller ihrer Personen genannt. Die Aufgabe des Agenten trägt den Namen der Liste und sagt, jeden Namen vom
  Scan zuerst mit diesen Personen zu vergleichen, erst dann mit dem ganzen Baum.
  Auch der Scan einer Quelle lässt sich so schicken: er bleibt ein Bild der Quelle, behält die Liste ebenso, und die
  Aufgabe, ihn zu lesen, hat die Personen der Liste (bis zu 50) unter den betroffenen.
  **Material ohne Rückfrage sortieren:** eine Einstellung `sort.confirm` (pro Forschung mit `--for-tree`, sonst für
  diesen Computer): `ask` – der Standard, wie bisher: die Zustimmung der Person zu den bezahlten Lesungen vor jeder
  Sortierung – oder `no`: `strom material sort` sortiert sofort, wenn die Person darum bittet, und sagt, dass nicht
  gefragt wurde; nie von selbst, und ein Lauf, den niemand beobachtet, fragt weiterhin. `no` setzt nur die Person im
  eigenen Terminal oder in der Strom-App auf diesem Computer (eine Zeile im Log der Brücke sagt es), nie ein Agent;
  zurück zur Rückfrage kann jeder.
  **Material aus der App in den Stammbaum einsortiert:** eine Datei aus einem Stapel, den die Strom-App geschickt hat
  (oder anderes Material von ihr), die die Forschung als Eintrag, Dokument oder Foto von Personen einsortiert, kommt jetzt
  bei ihnen in den Stammbaum der App — bei zwei Partnern eines Paares zu ihrem Paar —, sodass die App sie bei der Person
  zeigt, nicht nur im Fenster Materialien. Lebende sind keine Ausnahme: was von ihnen geschickt wurde, wird wie bei allen
  anderen einsortiert und erfasst (der Schutz Lebender gehört zum Export). Eine Datei mit einem Platz im Stammbaum oder
  eine, deren Platz in der App entfernt wurde, bleibt, wie sie ist; eine von einer Datei entfernte Person bekommt dort
  keinen Platz.
- **Eine Forschung für die Kopie eines Stammbaums:** der Link der Strom-App, der eine neue Forschung beginnt, kann ihren
  Namen vorschlagen (Kopie eines Baums: „… (Kopie)“); das Terminal bietet ihn zum Behalten oder Überschreiben an, und
  die Brücke nennt der App den Ordner, in dem neue Forschungen entstehen. Ein Baum, der mit den Nummern einer anderen
  Forschung übergeben wird (Kopie eines Baums mit Forschung, aus einer älteren App), bekommt für seine Personen und
  Quellen die Nummern der neuen Forschung nach den eigenen Marken der Datei – nie die Nummern der anderen Forschung,
  die Zitate der Quellen bleiben.
- **Was am meisten hilft:** alles, was auf die Person wartet und hinter dem Aufgaben stehen, sagt, wie sehr seine
  Erledigung den Stammbaum erweitert – eine neue Generation über einer Person, die die Forschung erreicht, die direkte
  Linie, die Aufgaben, die es freigibt – und warum, in wenigen Worten in der Sprache der Forschung; die Strom-App kann
  so zuerst zeigen, was am meisten hilft. Im Terminal dasselbe: `strom task list --state waiting --order gain`.

## 1.36.0

*22.11.2026 · gehört zur Strom-App 3.31.0.*

- **Ein Versuch der Sammelprüfung sofort:** Die Aufgaben eines Versuchs der Sammelprüfung (`strom verify bulk --try`)
  stehen am Anfang der Warteschlange – die nächste Sitzung nimmt sie –, und die Strom-App lässt sie sofort bearbeiten,
  eine Sitzung je Aufgabe, über einen Link, der die Aufgaben nennt. Jede Aufgabe der Warteschlange hat ihre Art der
  Arbeit (Prüfen, Einträge, Material, Orte, Geschichten …): `strom task list --kind`, und die Strom-App filtert danach.
- **Von Hand gespeicherte Bilder, sicherer:** Die Nummer eines Bildes wird dem Dateinamen nur entnommen, wenn der Name
  sie eindeutig sagt (die Kopie eines Dateimanagers „33 2.jpg“ ist Bild 33; ein Name mit zwei Zahlen und ohne Zähler
  bekommt keine); die Dateien eines Stapels werden nur dann nach ihrer Reihenfolge nummeriert, wenn keine eine Zahl im
  Namen hat; ein Ordner wird erst übernommen, wenn sein Stapel fertig heruntergeladen ist (ein .crdownload oder .part
  daneben hält ihn zurück). Eine Datei, die derselbe Scan wie ein anderes Bild ist, wird nie gelöscht: Sie wird daneben
  beiseitegelegt, und das wird gesagt. Eine Datei, unter der Nummer eines schon erfassten Bildes
  gespeichert, die eine andere Seite zeigt (andere Form oder andere Handschrift), ersetzt das Bild nicht mehr: Sie wird
  daneben beiseitegelegt und unter „Was wartet“ und in der Strom-App erfragt – das Bild behalten, die neue Datei als
  dieses Bild nehmen oder ihr eine eigene Nummer geben (`strom media aside`). Eine schärfere Kopie wird nur übernommen,
  wenn sie sicher derselbe Scan ist – verglichen wird die Handschrift, nicht das vorgedruckte Formular; lässt sich das
  nicht entscheiden, wird die Datei ebenfalls beiseitegelegt und erfragt.
- **Der Agent aus der Strom-App ohne Rückfrage:** eine Einstellung dieses Computers, `run.confirm` (Einstellungen → 1 →
  „Agent aus der Strom-App starten“): `ask` – der Standard, wie bisher – oder `no`, und worum die Strom-App bittet und
  was nur den Agenten auf das Abonnement oder KI-Guthaben startet (ein Gespräch, eine Aufgabe, die Arbeit an der
  Warteschlange, ein dem Agenten überlassener Widerspruch, die Bestimmung der Orte – bei mehreren Stapeln von Orten wird
  nur nach der Anzahl gefragt, und Enter startet mindestens einen), startet sofort; eine Zeile im Terminal sagt es und
  wo die Rückfrage wieder eingeschaltet wird. Weiter gefragt wird: eine Frage mit einem Preis in Geld, Zustimmungen,
  Löschen, das Absenden einer Anfrage, die Bedingung der Alleinarbeit und jeder Befehl eines Agenten. Die Rückfrage
  schaltet nur der Mensch ab – im Terminal oder in der Strom-App auf diesem Computer (eine Zeile im Log der Brücke sagt
  es), nie ein Agent.
- **Eine Quelle löschen:** Eine Quelle lässt sich in der Forschung löschen – `strom source retract` im Terminal oder
  durch Löschen der Quelle in der Strom-App, nur durch die Person, nie durch einen Agenten (er darf es nur vorschlagen,
  mit dem, was es laut `--dry-run` mitnähme). Die Werte bleiben; ihre Zitate werden von den Angaben genommen und in der
  Quelle aufbewahrt, eine Angabe kann weniger sicher werden, eine Aufgabe, die nur auf ihr beruht, wird aufgegeben,
  und ein entschiedener Widerspruch, der auf ihr beruhte, wird zur Prüfung markiert (`strom conflict keep` behält die
  Entscheidung bei). Was es mitnimmt, wird vorher gesagt und von der Person bestätigt; die Quelle lässt sich mit ihren
  Zitaten wiederherstellen (`strom source restore` oder „Rückgängig“ in der Strom-App). Eine in der Strom-App beim
  Bearbeiten des Stammbaums gelöschte Quelle wird in der Forschung mit dem nächsten Senden gelöscht – nur beim Senden
  des ganzen Stammbaums durch die Person; sonst sagen die Änderungen, warum nicht. Eine gelöschte Quelle kommt mit
  keiner späteren Datei und keinem Import zurück. Im Terminal sagt `strom source show`, dass eine Quelle gelöscht ist,
  wann und was sie zurückholt, und `strom source list --retracted` listet die gelöschten auf.
- **Volkszählungen:** Eine Forschung darf Volkszählungen als Quelle nutzen – ein Haushalt in einem Jahr zeigt, wer
  zusammen wohnte und woher jemand kam. Aus, bis die Person sie einschaltet, in den Einstellungen der Forschung
  („Volkszählungen in dieser Forschung“) oder in der Strom-App; der Agent darf es nur einmal vorschlagen. Ein Haushalt
  wird für alle seine Mitglieder im Stammbaum auf einmal erfasst (`strom census add`): die Beziehung zum
  Haushaltungsvorstand, das Alter, Datum, Ort und Haus und das Zitat des Bogens bei jedem gleich; Personen außerhalb des
  Stammbaums nur in der Notiz. Die Beziehung wird so übernommen, wie die Zählbögen sie schreiben
  („Haushaltungsvorstand“, „Ehefrau des Haushaltungsvorstandes“ und ihre Wörter auf Englisch, Tschechisch und Polnisch).
- **Namen – wie sicher und nach einer Heirat:** Der Name einer Person wird wie eine Angabe zitiert, auch damit, wie
  sicher er ist: Der Agent zitiert den Namen so, wie ihn der gelesene Eintrag gibt (`strom cite P… S… --status`,
  `name add --status`, `person add --name-status`; belegt nur nach dem Originaleintrag), und die Namen, die eine ältere
  Forschung aus ihren Einträgen zitierte, werden einmal von selbst wahrscheinlich (nie belegt; ein Name, den die Person
  schrieb oder bestätigte, bleibt; `strom fixes undo name-status` nimmt es zurück). Die Strom-App, die es zeigt, lässt
  den Namen zusammen mit dem Geburtseintrag prüfen und bestätigt ihn nach dem Scan wie eine Angabe. Bei einer mehrmals verheirateten Frau ist der jetzige Name der nach der letzten Heirat –
  der Nachname des Ehemanns der spätesten Hochzeit, auch in der weiblichen Form; ein in der Strom-App als jetziger
  gewählter Name wird übernommen und bleibt es, bis neu gewählt wird. Die Datei für die Strom-App gibt die Namen nach
  einer Heirat zuletzt, den jetzigen ganz zuletzt, sodass auch eine ältere Strom-App den richtigen zeigt.
- **Mehrere Agenten und Forschungen zugleich, ohne sich in die Quere zu kommen, und weniger verlorene Schritte in langen Läufen:**
  Jede Sitzung hält ihre Aufgabe,
  solange ihr Agent Lebenszeichen gibt – eine Aufgabe, die ein anderer Agent hält, bleibt ihm, und die eines verstummten
  Agenten wird nach `task.hold` übernommen (was er geschrieben hat, bleibt, die Aufgabe kehrt in die Warteschlange
  zurück). Ein Archiv, das den automatischen Zugriff einschränkt (das Tempo eines Menschen, nur der Browser, das
  Stundenlimit eines Downloaders), nutzt jeweils nur eine Sitzung aller Forschungen mit gemeinsamem Ordner: Eine Aufgabe
  darauf wartet, solange eine andere Sitzung es nutzt, und inzwischen geht andere Arbeit weiter; die selbstständige
  Arbeit, der nur solche Aufgaben bleiben, wartet höchstens `archive.wait` auf das Archiv, und auf einem Computer läuft
  jeweils nur ein Massendownload von Bildern aus einem solchen Archiv, der nächste wartet dahinter. Während des Wartens
  wird beim Archiv nichts angefragt. Das Menü nennt auch die Agenten, die direkt arbeiten, und die Strom-App erfährt,
  wer eine Aufgabe oder ein Archiv hält, seit wann und spätestens bis wann. Die Zeiten sind Einstellungen dieses
  Computers: `task.hold`, `archive.hold` (ein Archiv gehalten ohne Anfrage daran) und `archive.wait`, jeweils
  standardmäßig 30 Minuten, von 5 Minuten bis 24 Stunden. Jede Linie kann einen eigenen Lauf des Agenten haben: `strom
  run --research G…` (im Menü durch Wahl der Linie, der Lauf dann in einem eigenen Fenster mit dem Namen der Linie)
  nimmt die Aufgaben dieser Linie, ein zweiter Lauf derselben Linie wird abgelehnt, und die Arbeit an der ganzen
  Warteschlange lässt Linien mit eigenem Lauf aus; in einer Forschung arbeiten höchstens `run.parallel` Läufe zugleich
  (standardmäßig 3, erhöhen darf nur der Mensch) – der Verbrauch des Abos addiert sich. Eine neue Linie innerhalb einer
  anderen bietet an, die offenen Aufgaben zu ihren Personen zu übernehmen (`strom research gather`). Die Strom-App
  zeigt jeden Lauf und startet und stoppt sie nach Linien (`strom run stop`); Läufe auf einem Rechner teilen sich das
  Limit des Abos, die Pläne des Browsers, die Seiten einer Website und die Leser der Scans.
  Die Regeln des Agenten sagen, in einem eigenen Browser-Tab zu arbeiten; nach einem Tab außerhalb seiner Gruppe oder
  einer Seite, die nicht antwortet, folgt sofort, was zu tun ist (ein neuer Tab; die Arbeit im Browser wird erst nach
  einer zweiten Zeitüberschreitung zurückgestellt). Ein langer Text von `strom readings` oder `strom searched` endet bei
  etwa 20 kB mit einer Zeile, wie er sich eingrenzen lässt, und `--full` für alles (`--json` bleibt vollständig; `strom
  searched` hat Seiten wie die anderen Listen). Ein Stapel mit fehlerhaften Zeilen sagt auch, welche Zeilen nicht
  geprüft wurden, weil sie von einer fehlerhaften abhängen. Optionen, die Agenten raten und die genau eine andere
  bedeuten, werden übernommen und in einer Zeile genannt (`strom recordset list --parish` als `--place`, `strom media list
  --image 5` als `--images 5-5`, `strom readings --recordset`, `strom search add --query`); `strom person list
  --surname` findet einen Nachnamen mit seinen Formen wie `strom query --surname`. Das Protokoll der Schranke markiert
  ein Warten, über das ein von der Person gestarteter Lauf hinwegging (`pace`). Jeder Lauf hält fest, warum er endete
  (`.strom/runs/<Lauf>.end.json`: dieselben Gründe, die die Strom-App zeigt, Sitzungen, Kosten, letzte und nächste
  Aufgabe).
- **Kleinere Korrekturen:** Ein Bereich von Aufnahmen über den Browser des Agenten: ein Archiv in Stroms Liste kann einen Bereich von Aufnahmen auf einmal bekommen (höchstens 20, Aufnahme für Aufnahme im Tempo eines Menschen, angehalten bei der ersten Prüfung oder Ablehnung des Archivs; ein weiterer Bereich dieses Archivs erst, wenn die übrigen Aufnahmen von Hand gespeichert sind), jedes Archiv nur mit der eigenen Zustimmung des Menschen (`strom allow archive <Archiv> --range` oder im Menü); noch hat ihn kein Archiv. Fotos aus der Strom-App kommen viel schneller an: Beim Senden von Fotos oder eines Stapels
  von Dateien aus der Strom-App an eine große Forschung werden nicht mehr für jede Datei alle Bildeinträge der Forschung
  gelesen: Was die Forschung schon hat, wird in einem Verzeichnis der Prüfsummen der Dateien nachgeschlagen (in
  `.strom/cache`, das sich selbst neu aufbaut, wenn es fehlt oder veraltet ist), und die Brücke schreibt, was die App
  sendet, über einen weiterlaufenden Strom-Prozess, statt für jede Datei einen neuen zu starten. Eine neuere Strom-App
  übergibt einen ganzen Stapel auf einmal: Jede Datei wird geprüft und bestätigt, sobald sie ankommt, und der Stapel
  wird beim Abschließen geschrieben – ein Speichern, ein Neuaufbau der Stammbaumdatei und eine Mitteilung an die App –,
  während ein arbeitender Agent zwischen den Teilen an die Forschung kommt. Eine ältere Strom-App sendet wie bisher, nur
  schneller. Eine Datei eines Stapels, die beim Abschließen ein anderes Programm hält (Virenschutz, Synchronisierung
  oder Sicherung), ist kein Fehler mehr: nichts geht verloren, die Strom-App wartet kurz und erfährt warum, und die
  Forschung schreibt die Dateien des Stapels kurz darauf von selbst. Ein ohne Sortieren abgeschlossener Stapel, dessen
  Dateien in der Strom-App sortiert wurden („Mit dem Agenten sortieren…“), bleibt im Menü der App nicht mehr
  „unsortiert“: eine Datei, die eine Sortierung bis zum Ende durchlaufen hat, zählt als sortiert – auch in einer so
  früher sortierten Forschung, ohne dass sich darin etwas ändert.
  Die Strom-App zeigt die importierten Stammbaumdateien (GEDCOM, JSON der
  App) im Material und löscht sie endgültig wie jede Datei des Materials; eine, aus der eine Quelle entstand, nur
  zusammen mit dieser Quelle, in einem Schritt mit einer Bestätigung (`strom input delete … --retract-sources`).
  Eine von einer Datei des Materials entfernte Person (Zuordnen in der Strom-App, `strom input assign --remove`) wird
  beim Sortieren durch den Agenten nicht wieder zugeordnet; wieder hinzugefügt, gehört die Datei wieder zu ihr.
  Ein Archiv, das strom strenger hält, als seine eigene Liste der Archivbedingungen sagt (ein
  Downloader oder ein Eintrag der Recherche hat sie einmal so gelesen), schaltet den Browser des Agenten dort nicht mehr
  stillschweigend ab: `strom doctor`, `strom run` und `strom allow archive` sagen, seit wann, warum und was die Liste
  sagt, Was wartet und die Strom-App fragen die Person einmal, ob die Stufe bleibt oder die Bedingungen des Archivs
  gelten (`strom allow archive <host> --keep` oder `--level <Stufe>`), danach kehren nur die Aufgaben zurück, die die
  neue Stufe öffnet; wo die Person ein Archiv „über den Browser“ erlaubt hat, verweist die Prüfung einer Seite dort den
  Agenten auf seinen Browser statt auf die bereits erteilte Erlaubnis; vor einem Downloader oder Archiv, das strenger
  als die Liste eingetragen ist, wird gewarnt; eine mit `strom task audit --fix` abgetrennte Aufgabe nennt die Bilder
  des Buchs mit dessen Titel, ohne ID und Verb; `strom task wait --images` erneut für dasselbe Buch angegeben, fügt
  dessen Bilder zusammen (ein anderes Buch wird abgelehnt: ein Buch je Aufgabe); zwei Versuche der Sammelprüfung
  nacheinander kommen in der Reihenfolge, in der sie angefordert wurden, der ältere zuerst; die Bedingung der Abo-Limits
  liest sie in ein, zwei Sekunden, ohne die auf dem Computer gespeicherten Unterhaltungen zu durchsuchen; in der
  Strom-App zeigt jede Quellenangabe eines Stammbaums wieder ihre eigene Zeile des Stammbaums (ein Verweis, den ein
  Import angelegt hat, bleibt außen vor), und eine nur aus den erfassten Scans bekannte Bildnummer ist als solche
  gekennzeichnet, sodass die App sie zur Fundstelle hinzufügt, ohne die Nummer eines anderen Bildes daraus zu entfernen.
  `strom pack` und `strom trees remove` nennen die Scans der Archive als Scans (welche mitgehen, welche weggelassen
  werden), und die Sicherung vor dem Entfernen sagt, dass sie die Fotos und Originale der Familie enthält.
  Im Terminal nennen die Frage und die Varianten einer Hypothese die Personen und Familien, die sie mit ihrer ID angeben,
  mit Namen und ID (unter „Was wartet“ und wenn die Strom-App um eine Entscheidung bittet), und der Agent schreibt sie
  auch so; ein vor der ID geschriebener Name – einer Person oder der Partner einer Familie – wird nie doppelt genannt.
  Läufe nebeneinander in einem Stammbaum („einen weiteren daneben starten“, eine Unterhaltung neben einem Lauf): ein
  Lauf, dessen nächste Aufgabe kurz vor dem Beginn ein anderer übernommen hat, macht mit der nächsten freien Aufgabe
  weiter, statt den ganzen Lauf zu beenden; keine Aufgabe wird zweimal übernommen.
  Eine Linie, die innerhalb einer weiteren, noch laufenden beendet wurde, lässt ihre Aufgaben nicht mehr für immer
  warten: Sie zählen zur engsten laufenden Linie, zu der ihre Personen gehören (an den Aufgaben ändert sich nichts,
  eine wieder gestartete Linie hat sie also zurück); die Aufgaben einer pausierten Linie warten wie bisher.
  Eine an die Forschung gesendete Datei setzt den Agenten nicht mehr von selbst in Gang, auch nicht in einer früher
  begonnenen Forschung: weder ein Stapel aus der Strom-App oder vom Telefon noch eine einzelne Datei oder der Scan
  einer Quelle aus der App noch im Menü hinzugefügtes Material (dort wird gefragt, ob der Agent es durchsieht). Die
  Dateien warten im Material, bis sie von Hand oder mit „Mit dem Agenten sortieren…“ sortiert werden; das
  selbstständige Durchsehen schaltet nur die Person für eine Forschung ein (`strom config set intake.auto on
  --for-tree`, Einstellungen → 1 oder die Einstellungen der Forschung in der Strom-App). Bereits angelegte Aufgaben
  bleiben.
  Decken die durchsuchten Bilder eines Buches die Jahre um ein nur aus dem Alter bekanntes Datum nicht ab (geboren um
  1761 nach dem Alter beim Tod), erfährt der Agent, welche Jahre fehlen und wo das Buch weitergeht, bevor man sich auf
  „nicht gefunden“ verlässt – wie viele Jahre zu jeder Seite, bestimmt die Einstellung der Forschung `search.ageMargin`
  (Standard 5).
  Ein Gespräch über eine Linie aus der Strom-App wird bei einer beendeten Linie mit einem Satz abgelehnt – nichts wird
  gefragt oder gestartet. Ein Bild eines anderen Buches wird nicht mehr versehentlich in ein Buch geholt: `strom
  fetch` lehnt ein Buch ab, dessen Bilder aus einem anderen Buch des Konnektors kamen, oder ein Buch vom Portal eines
  anderen Konnektors, und sagt, welches Buch es ist; ein zurückgenommenes Bild bindet das Buch an nichts.
  Eine Sendung der Strom-App nimmt die Notiz einer Datei des Materials, die die App nie in ihrem Stammbaum hatte,
  nicht mehr weg: eine solche Sendung hielt jedes weitere Schreiben der Forschung an (das Übernehmen der Sortierung in
  der App meldete nur „exit 1“); das Öffnen der Strom-App oder das nächste Schreiben gibt die Notiz zurück und
  schreibt, was wartete. Ein Schreiben
  der Strom-App, das die Prüfung der Forschung ablehnt, hinterlässt nichts, und die App erfährt den Grund.

## 1.35.0

*19.11.2026 · gehört zur Strom-App 3.30.0.*

- **Die Bücher mit den meisten Aufgaben:** strom sagt, welche Bücher der Archive die meisten Aufgaben der Forschung
  brauchen – offene, zurückgestellte und wartende –, damit ein Herunterladen von Hand vielen davon auf einmal dient: im
  Menü von strom (Was wartet › die Bücher mit den meisten Aufgaben) und mit `strom task books`, jedes mit seinem
  Archiv, seinen Jahren, wie viele Aufgaben warten, seinen Bildern auf der Festplatte und den fehlenden, den benötigten
  Bildern, die noch nicht auf der Festplatte sind, und dem Ordner für seine Bilder. Angeboten werden nur Bücher, die
  sich herunterladen lassen und noch nicht ganz auf der Festplatte sind: das ganze Buch, wo die Bedingungen des Archivs
  es erlauben (mit den eigenen Worten des Archivs), sonst die Bilder, auf die Aufgaben warten. Das Herunterladen ist
  freiwillig: ohne es liest der Agent das Buch online weiter. Der Agent erfährt zu Beginn einer Aufgabe, welche anderen
  Aufgaben dasselbe Buch brauchen, um sie zusammen zu erledigen, und `strom task list --book` listet sie auf.
- **Die Bücher in der Strom-App und ihre Einstellungen:** Die Brücke gibt der Strom-App die Bücher mit den meisten
  Aufgaben und zu jedem, was davon heruntergeladen werden darf, und nennt bei jeder Aufgabe ihr Buch in dem, was wartet,
  und in der Warteschlange. Ab wie vielen Aufgaben ein Buch angeboten wird (`books.minTasks`, Standard 5) und ob die
  nächste Sitzung im selben Buch weitergeht (`queue.sameBook`, Standard aus: nach einer Sitzung in einem Buch, dessen
  Bilder auf der Festplatte sind, kommt zuerst eine weitere Aufgabe desselben Buchs, höchstens 5 Sitzungen nacheinander),
  hat jede Forschung für sich – eingestellt in der Strom-App, im Menü von strom (Einstellungen › Archive › Bücher mit den meisten Aufgaben) oder
  mit `strom config set … --for-tree`. Ein Link aus der App öffnet den Ordner eines Buchs, ohne Terminal.
- **Eine wartende Aufgabe unter dem zu durchsuchenden Buch:** Eine Aufgabe, die darauf wartet, dass ein Buch auf der
  Seite eines Archivs durchsucht wird, steht in der Strom-App unter diesem Buch, nicht unter dem Buch, in dem die Spur
  gefunden wurde: unter dem Buch, das ihr der Agent gibt (`strom task wait|edit --book`), sonst unter dem einen Buch,
  das ihr Text nennt. Solange das Buch erst noch zu finden ist, wartet die Aufgabe unter keinem Buch, und für ihre
  Bilder wird kein Ordner eines anderen Buchs angeboten. „Was wartet“ im Menü von strom ordnet die Aufgaben weiter
  danach, auf wen sie warten (Archiv, Amt, Familie).
  Eine Aufgabe, die auf von Hand gespeicherte Bilder wartet, kommt nur dann von selbst zurück, wenn ihr Warten das Buch
  der Forschung und die Nummern der Bilder nennt (`strom task wait T… --images B…:57-58`), ein Buch je Aufgabe. strom
  lehnt jetzt ein Warten ab, das die Bilder nur in Worten nennt, Bilder mehrerer Bücher auf einmal will oder ein Buch,
  das die Forschung noch nicht hat, und nennt stattdessen die genauen Befehle. `strom task audit` findet so (von einer
  älteren Version) geschriebene Wartezustände und korrigiert jeden in einem Schritt – die Aufgabe wartet auf die Bilder
  ihres Buches, jedes weitere Buch bekommt eine eigene Aufgabe, schon gespeicherte Bilder werden gleich übernommen – mit
  einem Weg zurück, solange sich seitdem nichts geändert hat; ein Warten lässt sich auch so lassen, wie es ist. Ein
  Gespräch über eine solche Aufgabe (`strom chat --task`) beginnt damit, und der Agent schreibt die Korrektur erst nach
  dem Ja der Person.
  Die Strom-App bekommt dieselben Befunde zu jeder wartenden Aufgabe; dort lässt sich das Warten korrigieren, die
  Korrektur zurücknehmen oder das Warten so lassen, wie es ist.
- **Bilder eines Buchs von Hand:** Bilder, die von Hand in den Ordner eines Buchs gespeichert werden, auf das keine
  Aufgabe wartet, nimmt strom (die Brücke oder die nächste Sitzung) nach der Bildnummer im Namen, und alle Aufgaben
  des Buchs lesen sie von der Festplatte; JPEG-2000-Dateien eines Portals, dessen Namen das Bild × 10 zählen (MZA
  Brünn), werden zurückgerechnet. Bei einer Aufgabe, die nicht weiß, welche Bilder eines Buchs sie braucht, wird ein
  aus der Strom-App gesendeter Scan nicht mehr abgelehnt, wenn sein Name keine Bildnummer nennt oder mehrere (ein Jahr
  und die Nummer eines Akts, Datum und Uhrzeit der Kamera): Er erhält die nächste freie Nummer des Buchs (nach der
  höchsten vorhandenen), mehrere auf einmal nacheinander; eine in der App angegebene Nummer oder die eine Nummer im
  Namen hat weiter Vorrang. Die Brücke nennt der Strom-App die nächste freie Nummer, damit die App sie anbieten kann. Eine Kopie eines gespeicherten Bilds, die ein Dateimanager angelegt hat (`33 2.jpg`, `33 - Copy (2).jpg`, `33a kopie.jpg`), ist das Bild, das ihre Nummer nennt; eine Datei, die nur nach ihrer Nummer benannt ist, wird nie nach der Reihenfolge auf ein anderes Bild nummeriert, und eine Datei, die derselbe Scan wie ein anderes Bild ist, wird daneben beiseitegelegt und gemeldet – nie stillschweigend gelöscht.
  Eine von gelieferten Bildern geweckte Aufgabe kommt als Nächstes: Eine Aufgabe, die auf Bilder eines Buchs wartete,
  kommt als nächste in die Warteschlange zurück, als wäre sie von Hand nach vorn gestellt (nach der laufenden Arbeit),
  wenn die Bilder von der Person kommen – aus der Strom-App für sie gesendet, in ihren Ordner des gemeinsamen Eingangs
  gespeichert oder mit `strom media add --inbox` übernommen. Mehrere auf einmal geweckte kommen alle nach vorn,
  untereinander in der üblichen Reihenfolge. Das gilt einmal: nach einer Sitzung an der Aufgabe wieder die übliche
  Reihenfolge. Eine anders geweckte Aufgabe (Antwort eines Archivs, Entscheidung, Brief, von einem Agenten oder
  Downloader geladene Bilder) behält ihren Platz, und eine von Hand gesetzte Reihenfolge (ans Ende, ein nicht
  erforschter Zweig) bleibt.
  Das Brandenburgische Landeshauptarchiv (BLHA) nach seiner Antwort vom 18. November 2026: Einzelne Bilder seiner
  Kirchenbuchduplikate (Rep. 5KB, CC-0) lassen sich im Browser der Person in menschlichem Tempo speichern und vom
  Agenten lesen – nie eine Suche durch seine Datenbank, nie ein ganzes Buch; zitiert wird „BLHA, Rep. 5KB Nr. <n>“ mit
  der Nummer des Bildes.
- **Notizen aus der Strom-App:** Die Notiz eines Paten oder Zeugen, in der Strom-App 3.29.0 oder neuer bearbeitet, kommt
  in die Forschung zurück, aus ihrer Datei wie aus dem, was sie direkt über die Brücke sendet. Eine Notiz, die nur der
  Anfang der Notiz der Forschung ist (wie eine ältere App sie hielt, oder in der App gekürzt – auch zwischen einem
  Buchstaben und seinem Akzent), wird nie von selbst übernommen: strom sync sagt es in einer Zeile, und eine Frage
  wartet auf den Menschen (in dem, was wartet, und in der Strom-App), ob die kürzere Notiz übernommen oder die der
  Forschung beibehalten wird. Gefragt wird einmal: derselbe Baum, erneut gesendet, fragt nichts mehr und sagt, dass die Frage weiter wartet. Wenn strom die
  Notizen zurücksetzt, die eine Sendung der Strom-App bei einer ähnlichen Angabe geschrieben hat, bleibt eine seitdem
  geänderte Notiz, wie sie ist, und eine Aufgabe, sie zu prüfen, wartet auf den Menschen (in dem, was wartet, und in der
  Strom-App), nie nur eine Zeile in der Geschichte.
- **Windows: nach der Anmeldeprüfung läuft nichts weiter, das Fenster eines Links mit Titel:** Die Prüfung, ob der Agent im Terminal angemeldet ist,
  beendet alles, was sie gestartet hat, wenn sie zu lange dauert, und die Leser geben die Node-Warnung DEP0190 nicht
  mehr aus.
  Das Terminal, das ein Link der Strom-App unter Windows öffnet, trägt den Titel Strom Research (eine zweite
  Installation mit ihrem Namen), nicht den Pfad von node.exe. `strom doctor` und der Bericht von `strom error`
  nennen, wie viele Brücken zur Strom-App auf dem Computer laufen, zu welcher Forschung jede gehört, ihren Speicher
  und die Summe, und kennzeichnen eine, deren Forschung es nicht mehr gibt; nichts wird beendet.
- **Keine Änderungen, die in der Strom-App nicht gemacht wurden:** Nach dem Schreiben aus der Strom-App nennt „nicht
  geschrieben“ weder ein Zitat einer Familie mit einem Elternteil (eine ältere Strom-App sendet es mit einer leeren
  Heirat) noch eine Quelle der Änderungen in der Strom-App (diese Quellen bekommt die App nie) als entfernt.
  Einen Link der Strom-App, der ein Terminal öffnet oder auf dem Computer etwas tut, bestätigt die Forschung der App,
  sobald das Terminal da ist oder es erledigt ist – die App wartet nicht länger und meldet sich nur, wenn sich nichts
  geöffnet hat.
- **Das Material der Familie: im Paket für sich, mit den Stapeln, zurückgestellt, solange der Agent fehlt, Fotos und Dateien der Strom-App mit ihren Stellen im Stammbaum bewahrt:** `strom
  pack` und das Entfernen eines Stammbaums von diesem Computer unterscheiden die Scans aus Archiven von den
  Familienfotos und Originalen: Das Paket sagt, wie viele es von beiden enthält, und beim Entfernen wird nach den
  Familienfotos und Originalen eigens gefragt (ohne ausdrückliches Ja bleiben sie) – niemand kann sie wieder laden. Ein
  Paket nimmt auch die Stapel mit, in denen die Strom-App das Material der Familie geschickt hat (Name, Personen,
  Notiz), und das Entpacken legt sie zurück. Ein Paket, das über 4 GB hätte, wird abgelehnt, bevor etwas geschrieben
  wird, in einem Satz: Eine solche Forschung nimmt der ganze Ordner mit, kopiert. Eine Forschung, die auf ihren Agenten
  wartet, stellt die Aufgaben zum Material, das inzwischen kommt, zurück wie ein Archiv; sie kehren in die Warteschlange
  zurück, sobald wieder ein Agent an ihr arbeitet.
  Porträts, Fotos eines Paares und Dateien, die in der
  Strom-App einer Person, einem Paar, einem Ereignis oder einer Quelle angehängt sind, werden beim Senden des Stammbaums
  aus der App in der Forschung gespeichert: jede Datei einmal (nach ihrem Inhalt), als Eintrag des Familienmaterials mit
  Titel, Art, Datum, Notiz und ihren Stellen im Stammbaum. Ein neues Porträt behält das vorige als ältere Version. Eine
  von einer Stelle in der App genommene Datei wird nur genommen, wenn die App alle ihre Dateien sendet, und nur, was die
  App schon bekommen hatte (nie eine in einem anderen Fenster hinzugefügte Datei oder was die Forschung hinzufügte);
  `strom sync undo` stellt sie zurück, die Datei selbst wird nie gelöscht. Die Forschung gibt die Dateien der Strom-App
  mit dem Stammbaum zurück, ein Paket (`strom pack`) nimmt sie mit, ein aus der App gesendetes Original eines Paares ist
  Material beider Partner, und ein aus der App übernommener Stammbaum bringt seine Dateien mit. Ältere Daten einer
  Forschung brauchen nichts: Das Schema geht von selbst auf 3, nichts wird neu geschrieben.
  Was die Strom-App vom Material zeigt, sagt, wo jede Datei
  verwendet wird (Personen, Paare, Ereignisse, Quellen), wo aus ihr Auszüge oder Zitate wurden und welche Aufgaben sie
  brauchen; eine von allen Stellen im Stammbaum genommene Datei erscheint als entfernt und lässt sich zurückgeben. Titel,
  Art und Datum werden für eine oder viele Dateien auf einmal bearbeitet (`strom input edit`, auch aus der App, mit
  einem Weg zurück), und eine einer Datei des Stammbaums hinzugefügte Person wird zu ihrer Stelle. In einer Forschung
  mit Agent lassen sich ausgewählte Dateien von einem Leser ordnen (`strom material sort` oder aus der App): Er schlägt
  Titel, Datum, Art und Stellen mit Grund und Sicherheit vor, schreibt nichts, überschreibt nie, was die Person
  festlegte, und zählt zu den Lesegrenzen der App. Die Lesungen sind bezahlt: Ein Sortieren beginnt erst nach dem Ja
  der Person (im Terminal, in einem Fenster des Systems oder im Dialog der App), nie von selbst oder durch einen Agenten.
  Bei einer Datei, die offensichtlich nichts mit der Familie zu tun hat (ein Bildschirmfoto, ein Kassenbon, eine aus
  Versehen hochgeladene Datei), sagt der Leser das mit seinem Grund, damit sie sich in der Strom-App ausblenden lässt;
  von selbst wird nichts ausgeblendet oder gelöscht.
  Eine Sortierung liest eine Textdatei (.txt, .md) als Text und beurteilt sie nach dem, was darin steht, sagt während der Arbeit, mit wie vielen Dateien sie fertig ist (die Strom-App zeigt es), und sagt bei jeder Datei ohne Vorschlag, warum (nichts gesagt, nichts Neues, ausgelassen, das Lesen schlug fehl). Ein Leser kann auch sagen, welche Datei die Rückseite eines anderen ihm gegebenen Fotos oder einer Seite ist und welches Bild das Porträt einer Person ist, damit die Strom-App es anbietet.
  Eine Sortierung des Materials startet ohne Rückfrage nur, wenn die Brücke der Strom-App sie angenommen und signiert
  hat; ein anders geschriebener (oder von einer älteren Version eingereihter) Eintrag startet nicht und wird in der App
  erneut angefordert.
  Was die Strom-App zu jeder Datei zeigt, nennt die Quellen, die aus ihr angelegt, aus ihr ausgeschnitten oder mit einem
  Bild desselben Inhalts versehen wurden, mit den Personen, die sie zitieren, und ob ihr Stammbaum sie hat; eine Datei,
  zu der eine Sortierung nichts vorschlug, und eine Datei mit demselben Inhalt wie eine andere werden genannt, damit sie
  nicht erneut gesendet werden, und in einer Forschung mit vielen Bildern kommt die Liste um ein Mehrfaches schneller.
  Bis zu 1.500 Dateien lassen sich aus der App auf einmal sortieren: in Stapeln zu 50, einer nach dem anderen, solange
  die Brücke läuft, jeder innerhalb der Lesegrenzen der App und gezeigt, sobald er fertig ist; der ganze Lauf lässt sich
  auf einmal anhalten. Eine Datei des Familienmaterials lässt sich endgültig löschen – nur durch die Person
  (`strom input delete` oder in der Strom-App nach einer Liste von allem, was sie betrifft), nie durch einen Agenten:
  Ihre Quellen behalten Text und Zitate, ihre Bilder und Ausschnitte verschwinden nur, wenn keine andere Datei und
  keine andere Forschung denselben Inhalt hält, und sie bleibt nur in früheren Sicherungen der Forschung.

## 1.34.0

*15.11.2026 · gehört zur Strom-App 3.29.0.*

- **Das Hauptzitat und eine Reihenfolge der Zitate:** Die Zitate jeder Angabe stehen in jeder Datei in einer
  Reihenfolge – zuerst das Hauptzitat, dann der Eintrag des Ereignisses selbst, die weiteren Originale und der Rest
  danach, wie sicher sie sind. Das Hauptzitat wählt nur der Mensch, in der Strom-App oder im Terminal mit
  `strom event main`; ein Agent ändert es nie. `strom person|family|event show` zeigen die Reihenfolge und welches das
  Hauptzitat ist.
- **In der Strom-App entfernte Zitate:** Ein Zitat, das der Benutzer in der App entfernt, bleibt entfernt, auch nachdem
  die Version der Forschung neu geladen wurde, und die Forschung zitiert es nicht wieder; das Rücknehmen dieser Sendung
  bringt es zurück. Eine Änderung in der App an einer Angabe, die die Forschung inzwischen zurückgenommen hat, wird nie
  stillschweigend geschrieben: Die App erfährt, warum.
- **Selbstständige Arbeit mit Bedingung:** Unterbricht das Limit des Agenten-Plans eine Sitzung, wartet die Arbeit bis
  zur Erneuerung des Limits (im Terminal und in der Strom-App als Pause), fragt dann die Bedingung erneut und geht
  weiter; die unterbrochene Aufgabe kommt zurück in die Warteschlange. Die Meldung eines Agenten, dass sein Limit erreicht
  ist, gilt als Limit des Plans samt seiner Zeit.
- **Notizen aus der Strom-App:** Die Änderungen des Benutzers an der Notiz einer Angabe kommen in die Forschung
  zurück, jede zu ihrer eigenen Angabe, der frühere Text bleibt in der Geschichte der Notiz; eine entfernte Notiz
  entfernt nichts. Das eigene Ereignis eines Paten oder Zeugen im GEDCOM der App wird in der Sprache der Forschung
  benannt. Die eigene zweite Geburt oder der zweite Tod der App und ihr Eintrag einer Geburt oder eines Todes werden
  auch auf Polnisch erkannt und nie als nicht übernommen gemeldet.
- **Ein Zuhause, in dem schon eine Forschung liegt:** `strom setup --home <Ordner> --use-existing` (und die Einrichtung
  nach einem Ja) nimmt diesen Ordner so, wie er ist, als Zuhause – nichts wird verschoben, der alte Ordner bleibt, wie
  er war.
- **Abgelehnte Befehle:** Ein Befehl, den die Berechtigungen des Agenten abgelehnt haben, wird ganz behalten, auch
  einer aus mehreren Zeilen, sodass `strom error` ihn ganz sieht; gekürzt wird er erst in seinem Bericht.
- **Ein anderer Stammbaum unter dem Namen der Forschung:** Eine Sendung aus der Strom-App, die kaum Personen der
  Forschung trägt, nur andere (etwa den Beispielstammbaum der App), wird abgelehnt und nichts wird geschrieben; ist es so
  gemeint, nimmt sie `strom sync <Datei> --force`.
- **Der Agent im Terminal nicht angemeldet:** die Leser von `strom read` und das selbstständige Arbeiten starten das
  Programm des Agenten im Terminal, das eine eigene Anmeldung hat, nicht die der Desktop-App. Sagt es, dass es nicht
  angemeldet ist, wird nichts gestartet und die Meldung sagt, wie man sich anmeldet; ein Leser, der so endet, wird
  ebenso gemeldet, nie nur „auth“. `strom doctor` sagt in einer eigenen Zeile, ob der Agent im Terminal angemeldet ist.

## 1.33.0

*15.11.2026 · gehört zur Strom-App 3.28.0.*

- **Archive, die nur der Browser eines Menschen betreten darf:** Der Agent versucht dort weder den Downloader von strom
  noch die Katalogsuche. Ihre Bilder kommen einzeln über den Browser des Agenten (`strom media save`), sobald der
  Mensch „über den Browser“ erlaubt, sonst speichert der Mensch sie von Hand; Brief und Ablehnungen nennen diesen
  nächsten Schritt sofort.
- **Über den Browser gespeicherte Bilder:** Das Buch wird aus dem genommen, worauf die Aufgabe wartet, oder aus der
  Seite des Archivs; die gespeicherte Datei trägt das Zeichen der Forschung, sodass nie eine Datei einer anderen
  Forschung aus dem gemeinsamen Download-Ordner genommen wird. Auch Bildbetrachter im eigenen Code einer Seite (OpenSeadragon in React) werden gefunden; ein Betrachter,
  den strom nicht erreicht, wird mit dem genannt, was der Mensch stattdessen tut.
- **Suchen und Verlauf:** Eine Suche, die etwas gefunden hat, wird nach ihrer Quelle eingetragen und nennt ohne Quelle
  die Reihenfolge; eine versehentlich gefundene Quelle wird mit `strom search edit --drop-found` entfernt. `strom history
  hide|show` prüfen, was sie bekommen, bevor jemand gefragt wird; ein einzelnes Ereignis liest `strom history list
  --event <id>`.
- **Schreiben nach eben gekommenen Bildern:** Eine Sitzung, die bei einer Aufgabe begann, deren gespeicherte Bilder
  eben gekommen waren, wird festgeschrieben; eine Forschung, deren jedes Schreiben danach abgelehnt wurde, schreibt von
  selbst wieder.
- **Aus der Strom-App:** Eine Angabe, die in einer anderen Form derselben Art zurückkommt (ein Ereignis vom Typ Census
  für eine Volkszählung), wird als dieselbe Angabe erkannt – keine Änderung, wenn sich nichts geändert hat, eine
  Bearbeitung dieser Angabe, wenn sich ihr Datum geändert hat.
- **Schwache und erwartete Bilder:** Ein schwacher Scan wird mit `strom media save --again` noch einmal als neue Kopie
  neben der ersten gespeichert, nichts wird entfernt, und die schärfste Kopie ist das Bild; ein Bild, auf das eine Aufgabe
  wartet, nennt, wer wartet, und den nächsten Schritt; auf einen Download, der noch geschrieben wird, wird gewartet, und
  `strom fetch --take` nimmt eine Liste von Bildern auch neben einem Seitenplan.
- **Indizes:** Ein Index einer anderen Pfarrei wird nie über eine Zuständigkeit angeboten, die nicht sagt, welche
  Pfarrei; die Jahre einer Zuständigkeit zählen.
- **Befehle, wie Agenten sie tippen:** Ein anderer Name für eine Option oder einen Befehl wird angenommen oder mit dem
  richtigen beantwortet; `strom grep --in` mit dem Anfang von Dateinamen liest diese Dateien.

## 1.32.0

*14.11.2026 · gehört zur Strom-App 3.28.0.*

- **Fragen an den Stammbaum mit einem Aufruf: `strom query`.** Wie viele Müller es in der Familie gibt, wer im Haus 12
  wohnte, wer im 18. Jahrhundert in Lhota geboren wurde: eine Zeile je Angabe einer Person mit Wert, Ort, Hausnummer,
  Datum, Sicherheit und Quellen und damit, wie die Person mit der Hauptperson verwandt ist, in Worten — in der Sprache
  der Forschung, mit der Seite (väterlich, mütterlich) und der Generation, wie es der Verwandtschaftsrechner der
  Strom-App sagt. Filter nach Art, Beruf, Wert, Ort, Hausnummer, Jahren, Nachname (auch seinen anderen Formen), Quelle
  und Status; wessen Angaben: die direkte Linie, die Blutsverwandten (Standard, auch Seitenlinien), mit ihren Partnern,
  oder der ganze Baum. `--count` und `--by generation|kin|place|decade|surname` zählen sie. Widerrufene Personen und
  Angaben nie, widerlegte nur auf Wunsch. **Auch die Erzählungen: `strom query --story <Wort>`** nennt die Personen und
  Paare, in deren Erzählung das Wort steht, jede mit dem Satz und den Quellen, auf die er sich stützt. Eine Hausnummer
  mit eigenem Wort (č. 7, Nr. 7) zeigt das Wort nicht mehr doppelt, auch auf der Karte einer Person.
- **Berufe auch in ihren tschechischen, deutschen, lateinischen und polnischen Formen:** mlynar findet auch Müller und
  molitor; Personen mit dem Wort nur im Namen oder in einer Notiz werden getrennt gezählt, mit dem `strom find`, das sie
  findet.
  **Eigene Formen der Forschung: `strom occupation add|list|remove`.** Eine Form, die die Liste nicht hat (eine
  andere Sprache, eine alte Schreibung, ein Beruf, den sie nicht kennt), wird von Hand hinzugefügt, ohne Agent —
  `strom occupation add olejník de:Ölschläger` — und bleibt bei der Forschung; der Agent fügt ebenso hinzu, was die
  Quellen nennen, und sagt es, von Hand Hinzugefügtes ändert er nie. `strom query` sagt, wenn ein Wort in keiner Liste
  steht (nur diese Form gesucht), und wie seine Formen hinzukommen. Die eingebaute Liste kennt 40 weitere Handwerke und
  Stände der Matriken (Messner, Totengräber, Gerber, Bader, Glockengießer …).
- **Der Agent beantwortet Fragen an den Stammbaum mit `strom query`,** mit dem Namen und der ID jeder Person in Klammern
  (zum Öffnen in der Strom-App: `strom app --person P…`; eine App vor 3.21 öffnet den Baum), der ganzen Verwandtschaft und der Quelle mit ihrem Titel, und sagt, wie sicher jede
  Angabe ist: ein Hinweis oder eine wahrscheinliche Angabe nie als Tatsache. Eine Erzählung zeigt nur, wo zu suchen ist;
  wem ein Eintrag gehört, wer wer ist und das Prüfen der Angaben geht weiter wie bisher, aus den Quellen.
- **In der Strom-App geteilte Ereignisse** (eine Volkszählung eines Haushalts, ein Umzug) und das eigene Ereignis eines
  Paten oder Trauzeugen mit einer Rolle beim Ereignis einer anderen Person werden aus ihrem GEDCOM und JSON gelesen,
  bei jeder Angabe gehalten und so zurückgegeben, wie sie kamen; ab der App 3.28 wird in der App entschieden, wer ein
  Ereignis teilt, und ein Abgleich nimmt ihre Änderung als die des Benutzers. `ROLE` eines Beteiligten aus GEDCOM 7
  wird auch in der Datei eines anderen Programms gelesen. Eine Volkszählung einer Person im JSON der App fällt nicht
  mehr weg. Eine Forschung, die aus dem Baum der Strom-App angelegt wird, übernimmt aus ihrem JSON alles, was ihr GEDCOM gibt:
  geteilte Ereignisse und Rollen, Paten, Zeugen und alle Beteiligten eines Ereignisses, die Todesursache, Alter und
  Hausnummern, eine Scheidung mit Datum, die Beziehung jedes Kindes zu jedem Elternteil, den Namen nach der Heirat. Die
  eigenen langen Notizen des Benutzers bleiben ganz und werden nicht mehr auf 500 Zeichen gekürzt. Eine aus dem Baum der
  App angelegte Forschung mit einer langen Notiz mit Emoji konnte eine Person oder Familie auslassen; der nächste Abgleich
  ergänzt sie.
- **Die Warteschlange aus der Strom-App:** Suche in der ganzen Warteschlange (Nummer einer Aufgabe oder Person, Name,
  Wörter der Aufgabe, ihr Buch, Archiv oder Ort, ohne Rücksicht auf diakritische Zeichen; der gesuchte Text wird nirgends
  gespeichert); „Als Nächstes“ setzt die zuletzt gewählte Aufgabe an die Spitze und lässt sich genau zurücksetzen; Arbeit
  an der Warteschlange öffnet ein Terminal, das zeigt, was startet, und es erst nach einem Ja startet – eine Anzahl
  Aufgaben (`strom run --tasks N`, endet nach N erledigten) oder selbstständige Arbeit nur unter einer Bedingung. Die Brücke zur App arbeitet in einer großen Forschung viel weniger, solange sich nichts ändert.
- **Eine Einstellung für Archiv-Viewer, die ein Browser langsam zeichnet.** Wo der Browser einen Tab nur etwa einmal
  pro Sekunde zeichnet (Zeichnen ohne Grafikkarte, ein Remote-Desktop), braucht der Viewer des Archivs (ACTA PUBLICA)
  für ein Bild Minuten, und das Speichern gab nach 30 s mit „die Kacheln des Viewers kamen nicht alle“ auf. Diese
  Meldung nennt jetzt, was hilft: `strom config set browser.tileWait 180` (60–600 s) — das Skript wartet dann, solange
  die Kacheln noch kommen, und antwortet dem Agenten „strom-wait“, bis es fertig ist. Ohne die Einstellung ändert sich
  nichts.
- **Eine auf einem anderen Computer versiegelte Forschung lässt sich ohne Übernahme lesen:** die Vorschauen von
  `strom source split`, `strom sync <Datei>` und `strom input names` (was die Aufteilung täte, was ein Stammbaum
  brächte, welche Namen nach der Heirat hinzukämen) werden wie jedes Lesen gezeigt; das Schreiben (`--apply`, `strom
  sync --app`, `--undo`) wartet weiter auf die Übernahme der Forschung (`strom seal adopt`). `strom repair undo
  <Stempel> --json` ohne Terminal antwortet jetzt wie `strom repair`: `status: "needs-consent"` mit dem Befehl, der in
  einem Terminal auszuführen ist, nicht nur mit dem Exit-Code 4.
- **Codex unter Windows und seine Sandbox:** ein Agent, dessen Sandbox strom von den Einstellungen oder der Forschung
  fernhält, erfährt genau das, mit dem Befehl, der außerhalb der Sandbox auszuführen ist, statt nach einer Einstellung
  zu suchen, die eingeschaltet war. Codex lässt strom nur als einfachen Befehl aus seiner Sandbox — ohne `&`, Pipe oder
  `cd` davor, ohne Gedankenstrich (–) und ohne Anführungszeichen innerhalb eines Textes in Anführungszeichen in den
  Argumenten; der Agent erfährt das (AGENTS.md, `strom guide`, der Hinweis der Sandbox), mit dem Weg für einen längeren
  Text: sein Befehl in einer Datei in `notes/`, ausgeführt mit `strom batch --file`. Eine Aufgabe, bei der die Sandbox
  oder die Berechtigungen strom dreimal hintereinander nicht an die Forschung ließen (nichts wurde erfasst), wird mit
  ihrem Grund und dem, was hilft (`strom task show`), zurückgestellt, und der Lauf geht mit der nächsten Aufgabe weiter;
  höchstens eine auf einmal — lehnt die Sandbox alles ab, endet der Lauf wie bisher. `strom error` zeigt, welche Befehle
  abgelehnt wurden, gekürzt und maskiert.

## 1.31.0

*12.11.2026 · gehört zur Strom-App 3.27.0.*

- **`strom repair` entfernt keine Arbeit mehr, die eine beschädigte Historie verbirgt.** Ist die Git-Historie einer
  Forschung lesbar, aber älter als ihre Datensätze (ein Cloud-Laufwerk hat ein älteres `.git` zurückgelegt, daneben
  iCloud-Kopien wie `index 2`), melden `strom verify`, `strom check` und ein abgelehnter Schreibvorgang
  `history-reverted` mit der Zahl der Datensätze, die eine Reparatur entfernen würde, und zeigen den Weg, der nichts
  verliert: den ganzen Ordner sichern, `.git` aus einer Sicherung oder Time Machine zurückholen, oder `strom seal
  accept` durch die Nutzerin oder den Nutzer. `strom repair`, das mehr als drei Datensätze oder einen solchen entfernen
  würde, nennt sie und fragt im eigenen Terminal nach; ein Agent startet es nie. Was eine Reparatur beiseitegelegt hat,
  holt `strom repair undo <Stempel>` zurück (im eigenen Terminal, ein versiegelter Vorgang), auch nach einer Reparatur
  mit 1.30.

- **Eine Brücke pro Forschung, auch nach einem Update.** Eine Brücke eines älteren strom, die neben der Brücke der
  Forschung weiterlief, beendet sich selbst: wenn ihre Nachfolgerin die Forschung von einer anderen Brücke gehalten
  findet, bei der nächsten Prüfung, oder wenn das Update den strom entfernt hat, aus dem sie läuft (vorher alle 16
  Sekunden ein Fehler). Die Übergabe an die Brücke eines neueren strom ist auch schneller: die alte Brücke antwortet
  weiter, während der neue strom geprüft wird.

- **Ein Bild aus dem Betrachter eines Archivs wartet, solange der Browser seinen Tab nicht zeichnet.** Ein Browser
  zeichnet nichts in einem Tab hinter einem anderen Tab oder in einem verdeckten oder minimierten Fenster, und der
  Bildbetrachter des Archivs meldete seine Kacheln dann nie als vollständig: Das Speichern gab nach 30 s mit „the
  viewer's tiles did not all come“ auf (ACTA PUBLICA). Das Warten zählt jetzt nur die Zeit, in der der Browser den Tab
  zeichnet, und geht weiter, sobald er ihn wieder zeichnet; ein Tab, der 30 s nicht gezeichnet wird, wird als solcher
  gemeldet. Wird der Betrachter inzwischen umgeblättert, wird nichts unter dem Namen eines anderen Bildes gespeichert.

  **`strom fetch` meldet ein Bild, das viele Anfragen kostet, wie `strom connector test`.** Ein Konnektor aus der Zeit
  vor 1.30, der jedes Bild aus Kacheln zusammensetzt (hundert Anfragen pro Bild, Stunden für ein Buch), lud ohne ein
  Wort. Jetzt sagen die ersten Bilder eines Downloads dem Agenten einmal, was ein Bild kostet und wie lange ein Buch im
  Tempo des Archivs dauert, dazu, wie ein Download im Hintergrund angehalten wird und wonach zuerst zu suchen ist (eine
  Anfrage pro Bild). Gezählt wird nur, was der Download selbst sendet: Das Archiv wird dafür nichts weiter gefragt.
  `strom fetch --status` und das Briefing sagen es auch.

- **Eine Familie an einen Nebenzweig anzuschließen ist Arbeit abseits der Linien.** Eine Aufgabe, die Menschen ohne
  Verbindung zum Stammbaum anschließen würde, half einer Linie, sobald sie sie an irgendwen aus dem Stammbaum anschloss
  – auch an ein Geschwister eines Vorfahren, und ging so mit der Linie, obwohl die Arbeit abseits der Linien am Ende
  warten sollte. Jetzt hilft sie einer Linie nur, wenn sie sie an einen Menschen der Linie oder dessen Partner
  anschließt; an einen Nebenzweig angeschlossen gehört sie zu diesem Zweig und kommt, wie seine Wahl es sagt. Eine
  Hypothese der Linie und ein Grund, den der Agent angibt, behalten ihren Platz. `/status` der Brücke sagt, wie die
  Aufgabe in Arbeit einer Linie hilft (Funktion `working.helps`), damit die App zeigen kann, warum sie mit der Linie geht.

- **Die Forschung in der Tabelle der Strom-App.** Für eine Strom-App, die es zeigt, nennt die Datei für die App bei
  jeder Person ihren Platz unter den Linien der Forschung nach der Regel, nach der auch die Warteschlange geht: in einer
  Linie (in jeder, zu der sie gehört), Partner einer Person einer Linie, ein Seitenzweig außerhalb der Linien (mit der
  Linie, der er zugeordnet wurde) oder eine Insel, die nichts mit dem Baum verbindet; der Kopf nennt die Linien und
  Zweige. Bei jeder Person stehen auch die Aufgaben, die auf etwas von außen warten (ein Brief, gesendet oder noch zu
  senden, eine Frage an die Familie, eine Website zum Ansehen), mit dem Ort, wo sie bearbeitet werden, und wann die
  Forschung die Person hinzugefügt hat. `GET /directions/people` der Brücke nennt dieselben Plätze live, mit einem
  Fingerabdruck, den `/status` wiederholt (Funktion `directions.places`).

- **Eine Hypothese in der Strom-App entschieden.** Bei einer Hypothese, deren Varianten sagen, wessen Kind jemand ist
  oder welches Paar, wird in der App eine Variante gewählt (oder „keine trifft zu“, offen lassen, die Entscheidung
  zurücknehmen). Das Terminal der Forschung zeigt die Frage mit ihren Varianten und was geschrieben würde, fragt
  einmal – Enter ist ja – und nach dem Grund (Enter lässt die Worte der App) und schreibt es als Entscheidung der
  Person in der Strom-App. Mehrere Vorschläge des Agenten werden ebenso auf einmal übernommen. Auch eine Hypothese, deren Varianten niemanden verbinden, wird dort gewählt: Nur die Entscheidung wird geschrieben, der Baum bleibt, wie er ist, und das Terminal sagt das vor der Bestätigung. Ob zwei Einträge
  dieselbe Person oder Geschwister sind, wird weiter im Terminal entschieden, auf dem ganzen Bildschirm der Hypothese.
  Die Entscheidung steht sofort im Baum: Kind oder Paar der gewählten Variante in derselben Speicherung geschrieben,
  mit der Quelle der Variante zitiert, auch in einem Archiv – der Agent schreibt es nicht noch einmal; was der Baum
  ablehnt (ein Kind hat schon leibliche Eltern), wird mit dem Grund gesagt und bleibt dem Agenten. Bei einer Änderung
  wird entfernt, was die Entscheidung davor geschrieben hat; beim Zurücknehmen, was sie geschrieben hat, sofern
  inzwischen keine weitere Arbeit darauf aufbaut – ein weiteres Kind, eine Angabe oder Quelle der Familie, eine
  Zusammenführung, nie die eigenen Angaben der Personen (die App weiß es vorher); eine Änderung, nach der die bisherige
  Verbindung bliebe und die neue nicht eingetragen werden könnte, sagt das Terminal vor der Bestätigung, und Enter bricht dann ab, auch bei mehreren Vorschlägen auf einmal; im Terminal auch mit `strom hypothesis decide --reopen` (nur
  die Person selbst). Für die App sagt die Strom-Datei, wer wo entschieden hat, die Entscheidung davor, den Vorschlag
  des Agenten, was gegen jede Variante spricht und wie viele Personen sie zum Baum bringt; `/status` der Brücke nennt
  die wartenden Hypothesen (Features `hypothesis.decide.link`, `hypotheses.accept.link`).

- **Ein Eintrag wird wiedergefunden, auch wenn das Archiv seine Links ändert.** Wo ein Eintrag im Buch steht, wird
  Feld für Feld gespeichert: `strom source add|edit --folio` (Seite oder Folio, wie das Buch zählt, „fol. 12v“),
  `--image` (die Bildnummer im Portal des Archivs) und `--call-number` (die Signatur des Buchs bei einem Eintrag
  außerhalb der erfassten Bücher), neben `--locator` für den Rest (die Nummer des Eintrags). `strom source show` nennt
  Archiv, Signatur, Folio und Bild zusammen (ein Bild auch aus den erfassten Scans) und schlägt Folio und Bild vor,
  die eine ältere Fundstelle nennt – geschrieben werden sie nie von selbst; bestehende Quellen bleiben, wie sie sind.
  Die Datei für die Strom-App und andere Programme hat eine lesbare PAGE aus den Feldern („pag. 112, Nr. 3, Bild 57“)
  und die Signatur als CALN; die Felder selbst bekommt die Strom-App ab der Version, die sie liest (Funktion der
  Brücke `sources.fields`), und ihre Änderungen kommen per Abgleich zurück wie die einer Seite. Der Agent füllt sie
  beim Erfassen aus und findet einen Link, der sich nicht mehr öffnet, über sie wieder. Eine PAGE nennt nie zwei Bild-
  oder Folionummern: nennt eine ältere Fundstelle eine andere als das Feld, gilt darin das Feld (die Fundstelle selbst
  bleibt), und `strom source edit` und `show` schlagen den Rest der Fundstelle vor. Ältere Quellen werden mit `strom
  source split` auf einmal in die Felder aufgeteilt: eine Vorschau, was aus jeder würde (eine Fundstelle, in der
  nichts erkannt wird, bleibt, wie sie ist, bis zu drei solche zeigt sie, wie sie stehen), die Aufteilung schreibt der Benutzer mit `--apply` als einen Schritt und
  macht sie als einen rückgängig (`--undo`); ein Agent bietet sie nur an. Die Aufteilung geht auch aus einer
  Strom-App, die sie anbietet (Brückenfunktion `sources.split`): ihre Vorschau sagt, wie viele Quellen, die Aufteilung
  wird auf den Klick des Benutzers als ein Schritt nach dieser Vorschau geschrieben und ganz zurückgenommen. Ein
  Folio, ein Bild oder eine Signatur, die der Benutzer in einer Strom-App löscht, die diese Felder behält, wird auch
  in der Forschung gelöscht (mit der Synchronisierung rückgängig); eine ältere App löscht nichts. Sagt eine Fundstelle
  nichts als das Folio und das Bild, die ihre Felder schon geben, schlägt `strom source show` vor, sie zu leeren, und
  `strom source edit --locator ""` tut es.

- **Kleinigkeiten.** Eine Angabe, deren Prüfung nach vorne gerückt wurde, ist in der Datei für die Strom-App als
  angefragt markiert, sodass die App nicht noch einmal anbietet, sie vorzuziehen. `strom error --note` verbirgt auch die
  gebeugten Formen der Namen und Orte, die die Forschung kennt (tschechisch *z Brna*, *v Praze*). `strom task wait
  --request` findet die Datei auch, wenn ihr Name in der anderen Unicode-Form angegeben ist (ein Pfad vom Mac, unter
  Windows verwendet). Was als Nächstes kommt – im Menü vor `strom run` und in der Warteschlange der Strom-App –, ist
  die Reihenfolge, in der `strom run` die Aufgaben nimmt: Ist eine Erzählung an der Reihe, steht eine Erzählung vorn,
  nicht alle.

## 1.30.1

*9.11.2026 · gehört zur Strom-App 3.26.0.*

- **Eine Forschung, deren Verlauf ein Cloud-Laufwerk beschädigt hat, lässt sich übernehmen, wie sie ist.** Fehlen die
  ältesten Protokolle einer Forschung und lässt sich ihr Verlauf (git) nicht lesen (etwa bei einer Forschung, die in
  iCloud Drive lag), sagt `strom verify` das und zeigt bei jedem Eintrag, den es nicht mehr versiegelt findet, einen
  einzigen Weg: der Benutzer sieht die Einträge durch und startet in seinem eigenen Terminal `strom seal accept`. Ohne
  Bestätigung zählt es nur, was es täte; mit ihr versiegelt es die Einträge, wie sie sind, in einem Vorgang, legt den
  beschädigten Verlauf beiseite (`.git-damaged-<wann>`, nie gelöscht), beginnt einen neuen und legt die Kopien von
  iCloud (`… 2.lock`) beiseite. Kein Eintrag ändert sich, nichts wird gelöscht; ein Agent startet es nie, und andere
  Befunde der Prüfung übernimmt es nicht. Bisher blieb jeder Schreibvorgang und `strom check` am beschädigten Verlauf
  stehen, und `strom repair` konnte nur einen älteren Stand zurückholen.

## 1.30.0

*9.11.2026 · gehört zur Strom-App 3.26.0.*

- **Angaben am Original geprüft.** Angaben zu Geburt, Taufe, Heirat, Tod oder Begräbnis, die ihren ursprünglichen
  Eintrag zitieren, aber wahrscheinlich oder möglich bleiben, prüft der Agent an diesem Original: er sieht sich den Scan
  an und hebt die Angabe entweder auf belegt oder schreibt auf, warum sie bleibt, wie sie ist. Eine ältere Forschung
  wird nach dem Update einmal durchgegangen (nur mit dem Stammbaum verbundene Personen, niemand Lebendes; `strom fixes
  undo verify-originals` nimmt es zurück), neue Angaben laufend. Von Hand für eine Person, eine Familie oder eine Angabe,
  als Erstes in der Warteschlange (`strom verify facts <wen>` oder aus der App Strom); gesammelt für eine Linie, ein
  Geschlecht oder den ganzen Stammbaum mit einer Schätzung der Kosten – starten kann das nur der Benutzer (`strom verify
  bulk`); anhalten lässt es sich mit `strom verify stop`. Eine Angabe, die der Benutzer in der App Strom anhand des Scans
  bestätigt, ändert der Agent nie – er schlägt nur vor. Ein Wert, den der Benutzer eingegeben hat oder der aus einem
  Stammbaum kam, wird nie überschrieben: was abweicht, ist ein Vorschlag zur Entscheidung des Benutzers. Wie viele
  Angaben warten, sagen `strom check`, `strom doctor`, `strom stats` und `strom verify status`.
  Eine Bestätigung in der App Strom gilt für den Wert, den der Benutzer gesehen hat: eine seitdem geänderte Angabe wird nicht bestätigt.

- **Angaben aus einem übernommenen Stammbaum sind geschützt.** Ein Stammbaum aus einem anderen Programm (GEDCOM) gibt
  Hinweise: der Agent ändert eine solche Angabe nur nach einem Eintrag, den er zitiert, und der Wert aus dem Stammbaum
  bleibt daneben erhalten („ursprünglich aus dem Stammbaum: …“) und lässt sich zurücksetzen (`strom event revert`, `strom
  person revert`). Ohne zitierten Eintrag – und immer, wenn der Benutzer über die Hypothesen entscheidet – schlägt der
  Agent nur vor, als Widerspruch zur Entscheidung des Benutzers. Was der Benutzer eingegeben oder geändert hat, in der
  App Strom oder in strom, ändert der Agent nie: er schlägt nur vor – auch nicht über eine Datei, die er mit `strom sync`
  einliest. Die Vorschläge des Agenten sind in `strom conflict list` und `show` erkennbar und schließen sich selbst,
  sobald der vorgeschlagene Wert gilt. Eine früher angelegte Forschung wird nach dem Update einmal markiert (welche
  Angaben aus einem übernommenen Stammbaum kamen, welche vom Benutzer sind): kein Wert ändert sich, und `strom fixes undo
  origins` nimmt die Markierungen zurück; wie viele Werte in wie vielen Datensätzen markiert wurden, sagt `strom fixes show origins`. Ein Vorschlag, dessen Wert sich seit seiner Entstehung geändert hat (vom
  Benutzer bearbeitet), ist veraltet: Er lässt sich nicht annehmen – über den neueren Wert wird nichts geschrieben –, nur
  mit dem behaltenen Wert schließen. Was ein Vorschlag nicht tragen kann (eine zusammen mit dem Datum geänderte Ursache),
  nennt das Ergebnis der Synchronisation, es geht nie verloren.
  Ein Wert, der mit dem Stammbaum aus der App Strom kam und seitdem von niemandem geändert wurde, ist wie ein eigener des Benutzers geschützt.

- **Ein erneut übernommener Stammbaum findet seine Personen.** Die IDs, die ein Programm Personen und Familien gab
  (`_UID`, `EXID`, `_FSFTID`… von MyHeritage, Gramps, FamilySearch und anderen), bleiben erhalten: ein Stammbaum desselben
  Programms, erneut übernommen (oder aus einem anderen Programm in die Forschung), findet die Personen über sie – nie
  doppelt, neue Angaben kommen als Hinweise dazu; eine neuere Datei des
  Stammbaums desselben Programms, in der sich Name, Geschlecht oder Geburtsdatum geändert haben, findet dieselbe Person,
  und was abweicht, kommt als Hinweis neben die Angabe der Forschung und wird genannt; eine nur vielleicht gleiche Person
  (Datei eines anderen Programms, andere FamilySearch-ID) wird genannt, nie verbunden und nie in eine Familie gesetzt, in
  der die Person, die sie vielleicht ist, schon ist, und `strom check` nennt zwei Personen mit derselben ID eines
  Stammbaums zum Vergleichen und Zusammenführen. Die IDs gehen mit der Forschung zurück in die Strom-App. Was die Datei
  enthält und nicht übernommen wird (Medien, eigene Tags des Programms), wird im Ergebnis gezählt. In einer früher angelegten Forschung werden die IDs früherer Übernahmen aus deren Dateien gelesen,
  sodass auch ein vor der Markierung erneut übernommener Stammbaum niemanden doppelt anlegt.

- **Ein Problem in einer Datei gemeldet.** `strom error` packt, was nötig ist, um zu erkennen, was geschah, in eine
  ZIP-Datei im Ordner Downloads (sonst im aktuellen Ordner): die Version, das System, `strom doctor`, die Agenten, die
  Konnektoren, die Brücke zur App Strom, die Forschung nur in Zahlen, die technischen Protokolle der letzten 7 Tage
  (`--since`) und die Befehle, die mit einem Fehler endeten. Nichts aus dem Stammbaum kommt hinein – Namen, Orte,
  Notizen, Transkriptionen, Bilder, Pfade mit dem Namen des Benutzers, Anmeldungen und Tokens werden weggelassen oder
  durch feste Codes ersetzt – und nichts wird gesendet: die Datei sendet der Benutzer selbst, an die Adresse, die der
  Befehl nennt. `--about fetch|sync|agent|install|windows` fügt die Einzelheiten eines Bereichs hinzu (die Tabelle steht
  in `strom error --help`), `--where` sagt, wo das Problem auftrat, `--note` beschreibt es mit den Worten des Benutzers (sie geht so, wie sie geschrieben ist – ersetzt werden nur Namen, die die Forschung kennt);
  die Daten genannter Personen, Familien oder eines Buches nur mit `--with-data` und der Zustimmung des Benutzers. Um
  eine Meldung gebeten, fragt der Agent, wo das Problem auftrat, führt den Befehl aus und nennt den Pfad – die Datei
  sendet, öffnet und kopiert er nie in den Chat. Im Menü: Wartung → Ein Problem melden. Die Forschung wird nur gelesen,
  auch eine beschädigte.

- **Die Datei für die App Strom wird auch bei einer Forschung mit einer begründet entschiedenen Hypothese wieder
  geschrieben:** für die App ab 3.25.0 (oder unbekannter Version) lehnte `strom export gedcom` sie ab, und
  `output/tree-strom.ged` blieb nach einer Sitzung alt (eine über `strom app` in der App geöffnete Forschung war nicht
  betroffen). **Eine große Forschung live in der App Strom zu verfolgen öffnet sich viel schneller:** der Baum für
  die App wird für jeden Stand der Forschung einmal erstellt und bleibt gespeichert, auch nach einem Neustart der
  Brücke, und beim Verfolgen wird eine Änderung gemeldet, sobald ihr Baum bereit ist. Die Brücke endet nicht mehr,
  wenn das Laufwerk der Forschung kurz nicht erreichbar ist, und eine zusätzlich gestartete zweite Brücke derselben
  Forschung endet sofort, statt unbemerkt weiterzulaufen.
  Ein Update, während strom die Brücke startet, lässt keine zwei Brücken mehr laufen: Eine bleibt, unter der Adresse, der die App folgt.
  Einer App, die den neuesten Stammbaum schon hat, wird nichts erneut gesendet.
  Eine App, die darum bittet, bekommt den Stammbaum mit jedem Bild nach seinem Inhalt benannt und lädt nur die Bilder, die sie noch nicht hat.

- **Eine im Terminal gezeigte oder bearbeitete Angabe** (`strom event show`, `strom event edit`) erscheint in der
  Sprache der Forschung. In der App Strom hat ein in die Forschung übernommener Stammbaum nicht mehr die erste Zeile
  daraus als Fundstelle des ganzen Stammbaums: jede Angabe nennt ihre eigene.
  **Stammbäume aus Windows-Programmen in der Codepage 1250 oder 1252 („ANSI“)** werden mit den richtigen Buchstaben
  gelesen – tschechisch, polnisch, deutsch, wie in der App Strom. Ein Zeichen, das sich nicht lesen lässt, wird gemeldet,
  nie still ersetzt.

- **Codex in der App ChatGPT, wie es wirklich ist.** Die Einrichtung spricht dort nicht mehr von den Hooks von Codex
  (dieser Satz gilt Codex im Terminal), und `strom doctor` rät, sie nur im Terminal zu bestätigen. Der Browser der App
  ChatGPT läuft über die Cloud von ChatGPT und ruft keine Regel von strom auf: strom sagt nicht mehr, dass es ihn
  überwacht, und der Agent dort geht zu einem Archiv mit Einschränkungen nur über einen Menschen (`strom task wait
  --images`). `strom doctor` und die Einrichtung sagen es als Warnung, mit dem Rat zum Dialog „Cloud-Browser“ von ChatGPT
  bei einem solchen Archiv: *ablehnen*, Zugriff auf alle relevanten Websites nie. Codex im Terminal bleibt überwacht –
  neu auch sein Browser, geöffnet über `createBrowserTab`.

- **Ein Herunterladen der Bilder eines Buches, das sein Konnektor mit einem Fehler abbricht,** nennt die nicht
  geholten Bilder und den Befehl, der sie holt (nur sie – was kam, wird nicht noch einmal angefragt), endet mit einem
  Fehler (bisher meldete es Erfolg), und was fehlt, sagen auch `strom fetch --status` und das Briefing; ein
  Herunterladen, das ein Archiv unterwegs ablehnt, endet wie bisher, mit dessen eigenem Rat. **Eine kurz nach
  Mitternacht in der App Strom bestätigte Abschrift** trägt den neuen Tag nach dem Kalender dieses Computers (bisher den
  Tag davor).
  **Einen Konnektor bauen:** `strom connector test` warnt, wenn ein Bild viele Anfragen kostet (Kacheln), und sagt, was
  zuerst zu suchen ist – den Link des Portals auf das ganze Bild oder das Herunterladen eines ganzen Buches – mit der
  Zeit, die ein Buch im Tempo des Archivs bräuchte; `strom connector new` zitiert, was strom von den Bedingungen des
  Archivs weiß.
  **macOS: Die App Strom, aus der Forschung geöffnet** (live verfolgen, eine Datei für die App), lässt im Dock unter
  den zuletzt verwendeten Apps kein Symbol von Google Chrome mehr zurück: Die Adresse geht direkt an den bereits
  laufenden Browser, das Fenster der App öffnet sich wie bisher.
  **Eine Aufnahme, die der Browser des Agenten speichern sollte und der Browser zurückhielt** (Chrome speichert eine
  Datei einer Website von selbst, die nächste erst, wenn sie mehrere Dateien herunterladen darf), wird gemeldet: „Was
  wartet“ nennt die Website, der das einmal in der Adressleiste des Browsers zu erlauben ist.

## 1.29.0

*8.11.2026 · gehört zur Strom-App 3.25.0.*

- **Wer Hypothesen entscheidet: der Mensch oder die KI.** Eine neue Einstellung der Forschung
  (`strom config set hypotheses.decide`, die Frage der Ersteinrichtung neben den anderen Wahlen, Einstellungen im Menü
  von strom, die Forschungseinstellungen der Strom-App): *die KI entscheidet* oder *der Mensch entscheidet*.
  Entscheidet die KI, entscheidet der Agent eine Hypothese selbst, sobald ein zitierter Eintrag eine
  Variante stützt, stets mit Variante und Begründung; die Entscheidung des Menschen ändert er nie, und einen Zweig von
  zehn oder mehr Personen außerhalb des Stammbaums verbindet er nur auf zwei Quellen ohne Einwand – sonst schlägt er
  vor. Jede seiner Entscheidungen ist als die des Agenten markiert, steht in der Übersicht der Änderungen und lässt
  sich jederzeit ändern; ein Wechsel der Einstellung ändert nichts bereits Entschiedenes. Wo nichts gewählt ist,
  entscheidet die KI – auch in einer früher angelegten Forschung; zurück zum Entscheiden des Menschen:
  `strom config set hypotheses.decide person`. Die Ersteinrichtung von strom empfiehlt das Entscheiden der KI und bietet
  es zuerst an, *der Mensch entscheidet* wird dort gespeichert; entscheidet der Mensch, schaltet nur ein Mensch das
  Entscheiden der KI wieder ein, mit einem zweiten Ja.

- **Jede Hypothese lässt sich im Menü entscheiden.** Entscheidet der Mensch, bietet „Was wartet“ auch offene
  Hypothesen ohne Vorschlag des Agenten an – mit Variante und Begründung entscheiden oder offen lassen; entscheidet die
  KI (die Voreinstellung), nur die Vorschläge des Agenten. Aus der Prüfung einer Person und über einen Link der
  Strom-App lässt sich jede Hypothese entscheiden, gleich wer entscheidet, und eine entschiedene oder zurückgestellte
  Hypothese lässt sich mit Begründung neu entscheiden, die frühere Entscheidung bleibt lesbar. Entscheidet der Mensch,
  schlägt der Agent überall dort eine Entscheidung vor, wo die Einträge auf eine Variante zeigen.

- **Die Forschung in der Strom-App bleibt eingeschaltet.** Die Verbindung zur Strom-App (die Brücke) endet nicht mehr
  von selbst nach zwei Stunden ohne Anfrage: Sie läuft, bis sie ausgeschaltet wird oder der Computer ausgeht
  (`live.idleMinutes` ist neu 0; ein früher gesetzter Wert bleibt). Die Strom-App erhält einen Schalter für jede
  Forschung und eine Auswahl in ihren Einstellungen – bis der Computer ausgeht, oder nach zwei Stunden ohne Anfrage –,
  beides über die Brücke geschrieben. In der App ausgeschaltet, bleibt die Brücke aus (neue Arbeit in der Forschung
  holt sie nicht zurück) und behält ihre Adresse, sodass das erneute Einschalten – aus der App über einen Link von
  strom oder mit `strom live start` – keine neue Verbindung braucht.

- **Die Apps der Agenten werden wie der Agent im Terminal überwacht.** Der eingebaute Browser der App des Agenten hält die Bedingungen der
  Archive ein wie der Browser des Agenten in Chrome: Ein Archiv, das nur den Browser eines Menschen zulässt, wird ohne
  dessen Zustimmung mit demselben Hinweis abgelehnt, ein erlaubtes wird verzeichnet und hält sein Tempo; lokale Seiten
  bleiben unberührt. Befehle von strom im eigenen Terminal der App gelten wie in der Shell (was nur ein Mensch tut, die
  Brücke der Strom-App); der Agent wird angewiesen, strom über seine Shell auszuführen. Nichts an der App wird
  abgeschaltet. Das Terminal der App erkennt strom unter jedem seiner Namen – den eines anderen Kanals, einer zweiten
  Installation, das Paket über einen Paketstarter, einen Pfad dorthin. Der Browser von Codex (in der App ChatGPT) hält
  dieselben Regeln anhand der Adressen in seinem Code ein, sobald die Hooks von strom in Codex bestätigt sind –
  `strom doctor` und `strom chat` sagen, wann sie warten; Code ohne Adresse wird nie abgelehnt, nur verzeichnet. Mit
  bestätigten Hooks lässt ein Archiv, das nur den Browser eines Menschen zulässt, mit der Erlaubnis „über den Browser“
  auch den Browser von Codex zu, wie den Browser des Agenten in Chrome (`strom net web --check --browser`, `strom doctor`, die Unterlagen
  des Agenten, die Strom-App); unbestätigt wie bisher. Computer Use bleibt unüberwacht. Was strom bei welchem Agenten und welcher App überwacht: `strom doc R12`; ein Agent mit Computer
  Use wird angewiesen, die Strom-App über die Seitenwerkzeuge eines Browsers zu bedienen und die Forschung über strom.

- **Die App des Agenten ohne den Agenten im Terminal.** strom sagt jetzt, was geht und was nicht: Das Gespräch in der App geht weiter,
  selbstständige Arbeit, das Lesen von Scans und die Arbeit aus der Strom-App brauchen den Agenten im Terminal – gesagt,
  bevor eine Frage oder eine Kostenschätzung kommt. Die Einstellungen und `strom doctor --fix` bieten seine Installation
  an (ablehnbar); `strom doctor` unterscheidet den Browser im Gespräch und im selbstständigen Lauf. Ein Gespräch ohne es liest Scans mit dem eigenen Scan-Leser von strom.

- **Eine Quelle gilt nur als vom Benutzer gelesen, wenn er sie gelesen hat, und eine Angabe ist nur aus dem
  Originaleintrag belegt.** Leser ist der Benutzer bei einer von Hand im Terminal geschriebenen oder in der Strom-App
  bestätigten Abschrift; was Importe, Umwandlungen und Stapel unter seinem Konto schrieben, nicht mehr. Eine Angabe ist
  nur mit einem zitierten Originaleintrag mit Primärinformation belegt; ohne ihn wird sie wahrscheinlich, der Grund
  bleibt in ihrer Geschichte, und eine, die der Benutzer belegt hat, bleibt und wartet unter Was wartet darauf, belassen
  oder auf wahrscheinlich gesetzt zu werden (`strom fixes review proven-originals keep|lower`). Bestehende Forschungen
  werden einmal von selbst richtiggestellt, die Änderungen stehen in der Übersicht (`strom fixes undo
  readers|proven-originals` setzt sie zurück). Ein GEDCOM aus einem anderen Programm macht den Benutzer nie zum Leser
  und keine Angabe belegt. Eine Bestätigung in der App gilt für den Wortlaut, zu dem sie gegeben wurde, und lässt sich
  dort zurücknehmen; mit einem Originaleintrag mit Primärinformation darf eine Angabe dann belegt sein, sonst höchstens
  wahrscheinlich.
  **Eine Abschrift, die der Nutzer gelesen oder bestätigt hat, gehört dem Nutzer.** Nur das eigene Terminal des
  Nutzers oder die Strom-App ändert sie – welcher Befehl auch immer (Bearbeitung, Stapel, Synchronisation, Korrektur,
  Rücknahme, Import). Eine andere Fassung des Agenten wird stattdessen vorgeschlagen: eine Notiz bei der Quelle und eine
  Aufgabe für den Nutzer je Quelle, die kein Agent übernimmt oder schließt; entschieden in Was wartet, über einen Link
  der Strom-App oder in der App – die vorgeschlagene Fassung als die des Nutzers übernommen, oder die Abschrift
  behalten und dieselbe Fassung nie wieder vorgeschlagen; beides lässt sich zurücknehmen (die frühere Abschrift samt
  Bestätigung zurück, der Vorschlag wartet wieder).

- **Jeder Leser eines Dokuments mit eigenem Agenten, Modell und eigener Denktiefe, und eine Quelle erneut aus dem
  Original gelesen.** `strom document read|again --agent/--model/--effort` (und `--blind-…` für den blinden Leser) oder
  die Wahl in der Strom-App; ohne Wahl liest er nach den Einstellungen der Forschung, nie mit einem günstigeren Modell.
  Das Ergebnis sagt, wer gelesen hat – im Terminal, in der Datei der Lesung und in der Strom-App. Eine Quelle wird
  erneut aus dem Original auf diesem Computer gelesen (`strom document read --source S… [--clip …]` oder aus der
  Strom-App), ohne dass die Leser die Abschrift sehen; die neue Lesung bleibt neben der Quelle, und wo sie abweicht,
  stellt eine Aufgabe beide gegenüber – die Abschrift, wer sie las, und die Bestätigung des Benutzers bleiben, wie sie
  waren. Ausschnitte eines Bildes, die sich überlappen oder berühren, werden als eine Ansicht gelesen, und Wörter der
  Abschrift außerhalb des gelesenen Ausschnitts (eine Kopfzeile der Seite darüber) zählen nicht als Abweichung. `strom
  fixes` nimmt eine Lesung zweier Leser als die des ersten: ein blinder Leser mit einem anderen Modell ist nie ein
  früheres Modell, mit dem erneut zu lesen wäre, und eine Lesung, von deren Lesern einer mit dem heutigen Modell las,
  gilt als damit gelesen. Erneut aus dem Original lesen liest so gut wie möglich. Die Leser erfahren, was die Forschung
  über den Eintrag weiß – Art, Sprache, Datum und wo er steht, nie die Abschrift oder einen Namen –, ein Leser mit
  einem GPT-Modell zudem die Anweisung, den Eintrag in der Mitte des Ausschnitts abzuschreiben, die Nachbareinträge am
  Rand wegzulassen und die ursprüngliche Schreibweise Buchstabe für Buchstabe zu bewahren. Mit der Abschrift verglichen
  wird nur der Eintrag der Quelle (den der Leser markiert, sonst der, der am meisten im Ausschnitt liegt);
  Spaltenbeschriftungen ohne Gegenstück („Dies:“, „Vater:“), die eigene Überschrift der Forschung zum Eintrag,
  Anmerkungen der Forschung oder eines Lesers in Klammern, ein langes ſ gegen s, eine unleserliche Stelle gegen nichts
  und Wörter außerhalb dessen, was beide gelesen haben, zählen nicht als Unterschied. Die Strom-App erhält im Ergebnis
  des Lesens, welcher Eintrag der der Quelle ist, den ganzen Text des blinden Lesers, einen Hinweis, wenn die Leser
  eine andere Art des Eintrags bestimmt haben (Trauung × Taufe), und wenn sich der Vergleich nicht in die Forschung
  schreiben lässt – etwa bei einer auf einem anderen Computer versiegelten Forschung –, wird das gesagt statt still
  weggelassen. Leser mit einem GPT-Modell (Codex, OpenCode) sehen einen kleinen Ausschnitt auf etwa 2000 px vergrößert
  (höchstens dreifach), auch wenn das Lesen der Scans auf eine kleinere Größe abgestimmt ist (die Abstimmung misst
  ganze Seiten und Hälften, nie einen kleinen Ausschnitt), die übrigen wie bisher; ein registrierter schärferer Teil
  des Bildes, der die ganze Stelle zeigt – oder den ganzen Ausschnitt, nur ohne seinen Rand –, wird verwendet, und bei einer auf dem Scan kleinen Stelle wird ein schärferer
  Ausschnitt aus dem Archiv angeboten – nie von selbst geladen. Der Codex-Leser läuft ohne das
  Benachrichtigungsprogramm, die Plugins, Apps, Hooks und Erinnerungen aus den Einstellungen von Codex und ohne Browser
  und Computer Use seiner App; die Einstellungen von Codex bleiben unverändert.
  Ein Modell, das die installierte Codex-CLI nicht hat, beendet das Lesen als gescheiterten Leser mit diesem Grund, und
  ein Lauf von strom hält damit an: Codex aktualisieren (`npm install -g @openai/codex@latest`) oder ein anderes Modell
  wählen; Modelle aus dem Katalog eines neueren Codex als des installierten werden mit einem Hinweis angeboten.
  Ein in der App Strom angefordertes Lesen wird sofort angenommen, auch wenn sein Einreihen länger dauert (ein anderer
  Prozess hält die Forschung): es erscheint vom ersten Moment an unter seiner ID als eingereiht und wird unter ihr
  gelesen, und eines, das sich dann nicht einreihen lässt, erscheint als gescheitert, mit dem Grund; dieselbe
  Quelle, inzwischen erneut angefordert, wird als gerade gelesen abgelehnt.
  Die Wahl des Modells der Forschung (die Einrichtung, die
  Einstellungen im Menü von strom) nennt bei Opus, Sonnet und dem eigenen Standardmodell des Agenten das Modell, auf
  dem es zuletzt lief, wenn eine Forschung auf diesem Computer es laufen sah – „Opus (jetzt Opus 5.5)“; `strom doctor`
  und die Einstellungen sagen es beim gespeicherten Modell, und die App Strom erhält es mit der Auswahl der Leser.
  Unbekannt bleibt es wie bisher. Gespeichert bleibt Opus oder Sonnet, so wird ein neueres Modell seiner Reihe von
  selbst genommen; eine von Hand gesetzte feste Version (`strom config set model.lead <model>`) wird als jetzt
  gewählt angeboten und bleibt fest.
  Eine Lesung, deren blinder Leser nichts gelesen hat (er ist gescheitert oder ohne Eintrag zu Ende gekommen), ist
  die des ersten Lesers allein, wie eine Lesung eines Lesers – nie heißt es von jedem Eintrag, er weiche ab. Die App
  Strom erhält bei jeder Stelle, an der zwei Lesungen abweichen, welcher Art die Abweichung ist – sachlich (ein Name,
  eine Zahl, ein Datum, eine Person, eine unleserliche Stelle) oder eine Kleinigkeit (Schreibweise, Abkürzung,
  Zeichensetzung, Beschriftung, Groß- und Kleinschreibung) –, und wo jeder Leser steht: wartet, liest, fertig in so
  vielen Sekunden oder gescheitert, auch welchem Leser das Modell abgelehnt wurde.
  **Eine Quelle neu gelesen: was folgt, wählt der Nutzer.** Eine Aufgabe entsteht nur aus einer Sachangabe, die beide
  Leser gegen die Abschrift gleich lesen (ein Name, eine Zahl, ein Datum, eine Person, ein Wort, das die Abschrift nicht
  lesen konnte) – nie aus Kleinigkeiten (Schreibweise, Abkürzung, Zeichensetzung), aus einer Stelle, an der die Leser
  abweichen oder die sie als unleserlich markieren, noch aus einer Stelle, die eine frühere Aufgabe schon beurteilt hat.
  Die Aufgabe sagt, wer las (Agent · Modell · Denktiefe), dass zwei Leser desselben Modells ein schwächerer Beleg sind,
  und dass die Lesung nur ein Hinweis ist: Die Abschrift ändert sich nur dort, wo es der Scan selbst zeigt. Die neue
  Einstellung `read.sourceTask` sagt, was folgt: *fragen* (Standard) – die Lesung bleibt bei der Quelle als nicht
  geprüft, bis der Nutzer wählt: jetzt mit dem Agenten durchgehen, in die Warteschlange, oder nur speichern (im Terminal
  gleich nach der Lesung, später mit `strom source reading S…` oder in der Strom-App); *immer* – sofort eine Aufgabe;
  *nie* – keine Aufgabe. Eine Quelle hat zugleich eine Aufgabe ihrer Lesungen. Eine Lesung ohne Sachangabe zum
  Entscheiden, nur mit Stellen, deren sich die Leser nicht sicher sind, legt von selbst keine Aufgabe an – auch nicht
  bei *immer*; nur auf das Wort des Nutzers (`strom source reading S… --take queue --unsure` oder in der Strom-App)
  bekommt der Agent eine Aufgabe, jede solche Stelle auf dem Scan anzusehen: wo der Scan es sicher zeigt, die
  Abschrift mit Begründung berichtigt, sonst eine Notiz an der Quelle. Eine vom Nutzer bestätigte Abschrift ändert der
  Agent nie: die Stellen, die die neue Lesung gelesen hat, werden stattdessen dem Nutzer zur Prüfung vorgeschlagen
  (`--take review --unsure`).

- **Außerdem:** die Hilfe nennt die Werte jeder Einstellung mit Auswahl und erklärt beide Möglichkeiten, wer die
  Hypothesen entscheidet; `strom help --human` nennt jeden Befehl, den nur ein Mensch ausführt. Die Erlaubnis für ein
  Archiv, in einer Forschung außerhalb des Forschungsordners gegeben, passt auch die Anweisungen des Agenten dieser
  Forschung an, und eine angegebene Website (example.org) umfasst auch die Adressen, die die Bücher der Forschung
  verwenden. Die Bedingungen des Hauptarchivs alter Akten in Warschau nach der Antwort des Archivs: die Scans frei
  nutzbar, jeder mit dem Ort des Originals zitiert – Archiv, Bestand, Signatur, Seite oder Blatt. Ein Widerspruch, der
  in einem Stapel mit der Marke einer Quelle verzeichnet wird (`--claim "@s: …"`), zitiert jetzt diese Quelle; einer,
  den eine frühere Version so verzeichnet hat, zeigt seinen Wert ohne die rohe Marke und zitiert, wo es sich erkennen
  lässt, seine Quelle in der Strom-App und im GEDCOM. Ein beendetes Gespräch bleibt in der Strom-App nicht mehr „bei
  der Arbeit“, auch auf einem ausgelasteten Computer oder nach einer Änderung des Computernamens. Ein in einem Satz
  geschriebener Ort („in Lhotau Nr. 3“) behält seine Präpositionen nicht mehr: Die Prüfung bietet die Gemeinde so an,
  wie die Forschung sie sonst schreibt, und ein Ortseintrag erhält keinen Namen wie „in Lhotau“ mehr – solche bereits
  geschriebenen Namen werden einmal richtiggestellt (rückgängig: strom place undo).
  **Überlappende Ausschnitte eines Bildes sind einer.** Zwei Ausschnitte desselben Bildes, die die Forschung markiert
  hat und die sich um mindestens 30 % des kleineren überlappen, werden zu einem, der beide abdeckt
  (einer fast ganz in einem größeren – ein Detail, ein Eintrag neben der ganzen Seite – bleibt); vom Nutzer markierte
  Ausschnitte bleiben. In einer früheren Forschung werden überlappende Ausschnitte einmal vereint, jede Vereinigung im
  Verlauf vermerkt; die Abschrift und die Bestätigung des Nutzers bleiben.
  **Eine Aufgabe der Warteschlange aus der Strom-App.** Ein Link der App zu einer Aufgabe in der Warteschlange zeigt sie
  (was, warum, wann erledigt) und bietet an, sie jetzt mit dem Agenten durchzugehen (mit der Dauer ähnlicher Aufgaben
  hier), sie in der Warteschlange vorzuziehen oder sie zu lassen. `strom doctor` sagt, warum eine teurere Änderung der
  Abstimmung zugunsten der Genauigkeit bleibt, und eine nur fehlende oder veraltete Hook-Datei von Codex ist keine
  Warnung mehr – sie wird neu geschrieben, wenn strom den Agenten das nächste Mal startet.

## 1.28.0

*6.11.2026 · gehört zur Strom-App 3.24.0.*

- **Wie Strom funktioniert gehört zu strom: `strom doc`.** Die Dokumentation der App und der Forschung auf Tschechisch,
  Englisch, Deutsch und Polnisch ist Teil von strom und liest sich auch ohne Internet: `strom doc` listet die Kapitel,
  `strom doc R10.1` zeigt eine Regel samt dem Warum, `strom doc <Wörter>` sucht in Überschriften, im Begriffsregister
  und im Text (Akzente und Groß-/Kleinschreibung egal). Jede Regel trägt den Link zur selben Seite auf stromapp.info.
  Auf die Frage, wie oder warum Strom etwas tut, antwortet der Agent danach mit der Nummer der Regel. Die Hilfe für
  Menschen (`strom help --human`) verweist darauf.

- **Über eine Hypothese entscheidet nur der Nutzer.** Der Agent entscheidet nicht mehr selbst zwischen konkurrierenden
  Erklärungen: Er schlägt eine Variante mit Gründen vor, und die Hypothese wartet im Menü von strom unter „Was wartet“ –
  entschieden wie vorgeschlagen, anders oder offen gelassen. Was die Entscheidung verbindet, trägt der Agent in seiner
  nächsten Sitzung in den Stammbaum ein. Früher entschiedene Hypothesen bleiben, wie sie waren. Eine Hypothese, deren
  Varianten sagen, was sie verbinden würden, wird nur mit genannter Variante entschieden.

- **Ein Register ist ein Hinweis, nie ein Beleg.** Eine Angabe, die nur ein Register zitiert, bleibt ein Hinweis, bis
  der Eintrag selbst gelesen und zitiert ist – wie bei einem Stammbaum oder einer Erinnerung.

- **Eine Übersetzung neben der Abschrift.** Ein Eintrag in einer anderen Sprache oder Schrift als der der Forschung –
  Latein, Kurrent, Polnisch, Kyrillisch – bekommt neben der wörtlichen Abschrift eine Übersetzung in die Sprache der
  Forschung.

- **Wo der Agent arbeitet, für die Karte der Strom-App.** Während ein Agent arbeitet, sagt strom der App, zu welchem
  Ort das Buch gehört, das er untersucht – die Pfarrei oder das Dorf seiner Einträge, nie das Archiv –, damit die App
  ihn beim Verfolgen der Arbeit auf der Karte zeigen kann. Weiß die Forschung es nicht, sagt sie nichts, und die App
  bleibt bei den Orten der Person. Arbeit an einer Familie nennt das Paar – den Ehemann, sonst die Ehefrau – und die
  Familie selbst, damit die App sich dem Paar zuwenden kann.

- **DigiArchiv des Staatlichen Gebietsarchivs Třeboň:** seine Bedingungen, wie das Archiv sie bestätigt hat – von Hand
  nur ausgewählte Bilder, nie ein ganzes Buch, keine Download-Werkzeuge – und wie der dauerhafte Link eines Bildes
  zitiert wird.

- **Die Liste vor einem Lauf zeigt, was der Lauf nimmt.** Unter „Den Agenten allein arbeiten lassen“ stehen unter den
  Aufgaben in der Reihenfolge, in der der Agent sie nimmt, nun auch die Aufgaben der Geschichte der Orte, wenn sie an der
  Reihe sind – die Orte der Angaben zuerst –, als Geschichte gekennzeichnet.

- **Die Bedingung eines Laufs in einer Zeile.** Was die Bedingung (`run.gate`) geantwortet hat, wie sie gefragt wird
  – vor jeder Sitzung oder bei von Hand gestarteten Aufgaben einmal – und ihre Obergrenze stehen vor der ersten Sitzung
  in einer Zeile, nicht in dreien. Ein Agent, der Webseiten über seinen eigenen Helfer liest, wird nicht mehr
  als ohne Werkzeug zum Lesen des Webs gemeldet; ein Werkzeug, das wirklich fehlt, wird in der Sprache der Forschung gesagt.

## 1.27.0

*5.11.2026 · gehört zur Strom-App 3.23.0.*

- **Von Hand gespeicherte Bilder bringen ihre Aufgabe von selbst zurück.** Wo die Bilder eines Archivs von Hand
  gespeichert werden – ein Archiv, das nur der Browser eines Menschen erreicht, oder eines, dessen Bedingungen nichts
  anderes erlauben –, nennt die Forschung das Buch und die Nummern seiner Bilder und legt dafür einen Ordner im Eingang
  (inbox) an. Was dort gespeichert wird, wird von selbst übernommen: sofort, solange die Brücke zur Strom-App läuft,
  sonst beim Start der nächsten Sitzung; anders benannte Dateien nach ihrer Reihenfolge, wenn es so viele sind, wie
  Bilder fehlen. Die Aufgabe kehrt in die Warteschlange zurück, sobald alle Bilder da sind; bei einem Teil zeigt „Was
  wartet“, wie viele von wie vielen gespeichert sind und welche fehlen. Ein Buch eines solchen Archivs gilt nicht mehr
  als frei abrufbar, und die Forschung bietet dafür keinen Downloader mehr an – auch Bücher und Wartende aus früheren
  Versionen, ohne dass etwas umgeschrieben wird.

- **Was wartet, lässt sich in der Strom-App beantworten, und die Bilder, auf die eine Aufgabe wartet, lassen sich aus
  ihr senden.** Eine in der App geschriebene Antwort bringt die Aufgabe zurück in die Warteschlange wie eine im
  Terminal; sie wird vollständig gespeichert und als in der App gegeben vermerkt. Eine Aufgabe, die inzwischen auf etwas
  anderes wartet, bleibt unverändert. Scans, auf die eine Aufgabe wartet, gehen aus der App direkt zu ihr: nummeriert
  nach dem Bild, das die App nennt, sonst nach dem Dateinamen, sonst nach der Reihenfolge der fehlenden; ein PDF Seite
  für Seite. Ein Scan mit einer Nummer, die die Forschung schon hat, wird abgelehnt, außer er soll ihn ersetzen – der
  vorherige wird zurückgezogen und bleibt erhalten, nie gelöscht. Ein Scan, der einem schon übernommenen anderen Bild
  gleicht, wird mit dem Hinweis abgelehnt, welchem er gleicht; nichts wird übernommen. Sie werden genauso übernommen wie
  von Hand gespeicherte Bilder, und die Aufgabe kommt zurück, sobald alle da sind. Eine Website mit einem Buch der
  Aufgabe zeigt auch ihren Ordner und wie viele Bilder er hat. Die Websites eines Archivs – etwa das digitale Archiv und
  der Lesesaal eines Landesarchivs – warten an einem Ort unter dem Namen des Archivs, mit seiner Adresse.

- **Der Agent bleibt der Brücke fern.** Was die Strom-App über die Brücke sendet, gehört dem Menschen. Die Hooks des
  Agenten lehnen einen Befehl oder Webabruf ab, der die Adresse der Brücke liest oder sie aufruft, und der Agent
  erfährt die geheime Adresse nie.

- **Der Browser des Agenten folgt denselben Regeln wie sein Abruf von Webseiten.** Jede Seite, die der Agent in Chrome
  öffnet, wird zusammen mit seinen anderen Anfragen an dieselbe Website gezählt und im Tempo gehalten; eine Website,
  deren Bedingungen Automatisierung verbieten, eine, die abgelehnt hat, ein Pfad, den ihre robots.txt sperrt, und die
  Brücke bleiben ihm verschlossen. Ein Archiv, das nur der Browser eines Menschen erreicht, öffnet sich ihm nur mit der
  Erlaubnis des Menschen „über den Browser“, eine Seite nach der anderen im Tempo eines Menschen. Erlaubnis… in der
  Strom-App bei dem, was auf Bilder eines solchen Archivs wartet, öffnet diese Frage, auch wo kein Downloader das Archiv
  erreicht. Der Browser oder die Computersteuerung eines anderen Agenten – Codex, Antigravity – hat keine solche
  Prüfung: Der Agent geht damit nicht von sich aus in ein solches Archiv, und die Bilder speichert der Mensch von Hand.
  `strom doctor`, das Briefing des Agenten und Was wartet sagen einmal, mit welchem Agenten und welcher
  Browser-Erweiterung der Agent sie selbst speichern würde, oder dass die Erweiterung fehlt. Nichts wird ausgeschaltet:
  Den Browser und die Computersteuerung der Desktop-Apps der Agenten überwacht die Forschung nicht und empfiehlt sie
  nicht – überwacht wird der Browser des Agenten in Chrome, und einen anderen nutzt der Agent nur, wenn der Mensch
  ausdrücklich darum bittet. `strom doctor` und das Briefing des Agenten sagen es ausdrücklich, und der Agent arbeitet
  nie in einer Kopie der Forschung, die die Desktop-App eines Agenten in einem eigenen Worktree öffnet. Die Strom-App
  erfährt von der Brücke, ob der Browser des Agenten bereit ist, die Erweiterung fehlt oder der Agent keinen hat, den
  die Forschung überwacht.

- **Der Browser des Agenten speichert die Bilder selbst, eines nach dem anderen.** Wo der Mensch einem Archiv, das nur
  der Browser eines Menschen erreicht, den Zugang „über den Browser“ erlaubt, öffnet der Agent ein Bild in Chrome und
  speichert, was der Bildbetrachter des Archivs zeigt – nie mehr, als der Betrachter gibt, nie größer als das Original,
  im Tempo eines Menschen. Er speichert nur das Bild, das der Tab unter dessen eigener Adresse zeigt – ein auf ein
  anderes Bild weitergeblätterter Betrachter wird abgelehnt, nichts gespeichert. Die Forschung übernimmt die
  gespeicherte Datei aus dem Download-Ordner unter ihrer Nummer in den Ordner der Aufgabe, und die Aufgabe kommt zurück,
  sobald alle ihre Bilder da sind. Die Erlaubnis lässt sich jetzt auch einem solchen Archiv aus der Liste der Forschung
  geben, das kein Downloader erreicht. Ein Downloader für ein Archiv, dessen Betrachter die Bilder in Kacheln zeigt,
  speichert ebenfalls über diesen Betrachter, auch einen Teil eines Bildes; die Seite des Buches wird einmal geöffnet
  und nie neu geladen. Eine Prüfung, ob ein Mensch da ist, besteht der Agent nie. Ein Archiv, dessen robots.txt jeden
  Roboter von der ganzen Website fernhält, gilt als eines, das nur der Browser eines Menschen erreicht. Was die
  Archivliste der Recherche der Hand eines Menschen vorbehält, wird weiter von Hand gespeichert – ein Pfad der
  Aufzeichnungen, den die robots.txt jedem Roboter sperrt, KI-Agenten namentlich ausgeschlossen (wie bei der eBadatelna
  des SOA Praha), Bedingungen, die nichts anderes erlauben, oder ein Bildbetrachter, der die Bilder von einem für jeden
  Roboter gesperrten Bildserver zeigt.

- Eine Bedingung der selbstständigen Arbeit des Agenten, die von Hand gestartete Aufgaben nicht starten würde, wird
  einmal genannt, danach nur noch „Trotzdem starten?“. Die Bedingung der Abo-Woche nennt die Nutzung der Woche gegenüber
  dem bisher Erlaubten und wie sie gezählt wird. `strom help --human` führt die Reihenfolge der Aufgaben, die Arbeit
  abseits der Linien, Korrekturen und das Belassen eines Widerspruchs unter den eigenen Befehlen des Menschen. Die
  Forschung mit OpenCode geht weiter nach einer Sitzung, die es ordnungsgemäß abgeschlossen, aber als fehlgeschlagen
  gemeldet hat, und nach einem vorübergehenden Netzwerkfehler – dieselbe Sitzung wird nach kurzem Warten fortgesetzt,
  innerhalb der Zeit der Sitzung. Hält die Sandbox von Codex strom von der Forschung fern – auch in einer Pipe und
  unter Windows auch bei einem über PowerShell gegebenen Befehl – oder lehnen die Regeln von Codex einen strom-Befehl
  ab, bevor er läuft (unter Windows strom in einer Pipe oder nach `;`), hält die Forschung sofort an und nennt, was die Wahl
  des Menschen bleibt; eine
  solche Sitzung legt ihre Aufgabe nie beiseite. Danke für die Meldung auf GitHub. Eine Änderung beim Lesen der Scans,
  die die Forschung selbst vorgenommen hat und nach der die Lesungen deutlich unsicherer wurden, wird sofort
  zurückgenommen – nicht mehr erst nach 60 Tagen –, und `strom recent` sagt es.

- Weitere Archive Tschechiens, Deutschlands und Polens sind mit ihren Bedingungen bekannt – was jedes automatischen
  Werkzeugen erlaubt, sein Tempo und was nur der Browser eines Menschen erreicht. Neu darunter die Stadtarchive Brno und
  Ostrava, das Militärische Zentralarchiv Prag, Arcinsys Hessen, Niedersachsen und Bremen sowie Schleswig-Holstein,
  invenio und das Gedenkbuch des Bundesarchivs (nur der Browser eines Menschen), die Bildgalerien der Kirchenbücher der
  ehemaligen Ostgebiete im AGAD, LubGens (nur der Browser eines Menschen) und die Indizes polnischer genealogischer
  Vereine. Fünf weitere tschechische, die nur der Browser eines Menschen erreicht: die Acta Publica des Mährischen
  Landesarchivs (ihre Bilder nicht mehr über einen Downloader, auch nicht mit einer früher gegebenen Erlaubnis – sie
  bleibt, wie gegeben; über den Browser mindestens 4 Sekunden auseinander), die eBadatelna des SOA Praha und die
  Bildserver des SOA Litoměřice, des ZA Opava und der Polizeimeldungen des Nationalarchivs (nur von Hand). Die digitalen
  Lesesäle des SOA Litoměřice und des ZA Opava zeigen ihre Bilder von diesen Servern, daher werden auch ihre Bilder von
  Hand gespeichert – eine Erlaubnis „über den Browser“ wird dort nicht angeboten. Bei einer Aufgabe, die schon auf
  solche Bilder wartet, heißt es nur, dass sie auf von Hand gespeicherte Bilder wartet, ohne neuen Rat zum Warten. Ein
  früher für ein solches Archiv gebauter Downloader wird vor jeder Anfrage abgewiesen, auch seine Probe, und sagt, was
  bleibt: die Erlaubnis der Person „über den Browser“ oder das Speichern von Hand.

- Mit allem aus 1.26.1: ein unterbrochenes Schreiben sperrt die Forschung nicht mehr auf Dauer.

## 1.26.1

*4.11.2026 · gehört zur Strom-App 3.22.0.*

- **Ein unterbrochenes Schreiben sperrt die Forschung nicht mehr auf Dauer.** Ein Befehl, der zwischen `git add` und dem
  Commit endete (vom Agenten beendet oder unter Windows mit einem Index von git, den ein anderes Programm hielt), konnte
  seine Dateien im Index von git lassen: jedes weitere Schreiben endete mit „die Daten der Forschung wurden außerhalb
  von strom geändert“, obwohl `strom verify` und `strom repair` nichts fanden. Die neuen Dateien, die ein solches
  Schreiben im Index lässt (nicht mehr im Ordner, nie in der Geschichte), sind niemandes Änderung – das nächste
  Schreiben nimmt sie von selbst heraus und macht weiter. `strom repair` setzt immer den ganzen Index auf den
  versiegelten Stand zurück, auch mit einer dort gebliebenen Änderung eines Eintrags. Eine Sperre, die ein mitten in der
  Arbeit beendetes git hinterließ (`.git/index.lock`, älter als 10 Minuten), entfernt `strom repair`, und ein Schreiben,
  das daran scheitert, sagt es. Ein wirklich außerhalb von strom gelöschter oder geänderter Eintrag wird wie bisher
  gemeldet.

## 1.26.0

*4.11.2026 · gehört zur Strom-App 3.22.0.*

- **Die Linien der Forschung aus der Strom-App: anlegen, ändern, pausieren, ordnen.** Eine Linie lässt sich in der App
  anlegen oder ändern (Person, Richtung, Frage, Grenzen), pausieren, beenden oder wieder aufnehmen; die Reihenfolge der
  Linien ist die Reihenfolge der Arbeit, und die Seite fürs Telefon schiebt eine Linie nach oben oder unten und pausiert
  sie. Arbeit außerhalb der Linien – ein Nebenzweig, den keine Linie erreicht, etwa die Schwester eines Vorfahren und
  ihre Familie – kommt jetzt gelegentlich, eine Aufgabe in zehn Sitzungen, statt nur am Ende. Jeder solche Zweig kann
  eine eigene Wahl haben (gelegentlich, am Ende, wie die Arbeit der Linien, nie oder einer Linie hinzugefügt), und für
  einen wachsenden Zweig wird unter „Was wartet“ eine Linie vorgeschlagen: einer Linie hinzufügen, eine Linie für ihn
  anlegen, so lassen oder nicht erforschen. Ehemann oder Ehefrau eines Vorfahren gehören zur Linie des Vorfahren, und
  eine Linie mit einer Frage enthält ihre Person. Jede Aufgabe lässt sich sofort nehmen oder ans Ende stellen, und jede
  Aufgabe in der Warteschlange sagt, warum sie dort steht. Im Terminal: Einstellungen → Der Agent allein → Arbeit
  außerhalb der Linien, `strom offline`, `strom task order`.

- **Eine neu geschriebene Erzählung verliert nichts.** Schreibt die Forschung eine Erzählung neu – mehr Angaben, eine
  bessere Lesung, eine aus älterer Forschung übernommene Erzählung –, bleibt jede Angabe, Quelle und jeder Link der
  vorigen Fassung, oder geht nur absichtlich mit dem Grund, der bei der Erzählung gespeichert wird. Die Quellen, auf die
  sich eine Erzählung stützt, stehen bei ihr, Titel und Adresse unter jeder Angabe, auch wenn der Text sie nicht nennt,
  auch eine Quelle, die der Text nur mit ihrem Kürzel nennt; die Strom-App erhält sie mit der Erzählung. Eine Angabe aus
  einem Hinweis nennt im Text ihre Herkunft.

- Ein großer Stammbaum, unter Windows übernommen (etwa 1 500 Personen und mehr), scheitert nicht mehr in git an einer zu
  langen Befehlszeile (ENAMETOOLONG), ohne dass etwas davon bleibt: alles Übernommene wird geschrieben.

- Bei einer großen Forschung (Hunderte Aufgaben in der Warteschlange, vieles wartet) meldet die Strom-App nicht mehr,
  dass die Forschung nicht antwortet, während ihr Agent arbeitet: die Verbindung berechnet den Stand der Forschung einmal
  je Änderung, nebenher, und antwortet der App inzwischen sofort – auch während des täglichen Aufräumens, der Suche nach
  den Korrekturen von strom, dem Lesen der Historie nach jeder Änderung und der Übersicht für das Widget auf dem
  Schreibtisch.

- Eine Erzählung und eine Notiz kommen mit ihren Leerzeichen in die Strom-App, wie sie geschrieben sind: zwei
  Leerzeichen zwischen Wörtern, ein geschütztes oder schmales Leerzeichen werden nicht mehr zu einem einfachen.

- **Was der Nutzer entscheidet, bleibt seine Sache.** Einen Widerspruch zwischen der Forschung und einer Änderung in der
  Strom-App, die Freigabe einer Erzählung oder ihrer neuen Fassung und die Antwort zu einem wachsenden Zweig entscheidet
  allein der Nutzer – in der App oder unter Was wartet; der Agent wird abgewiesen und sagt nur, dass es wartet. Auch was
  die App gesendet hat oder was synchronisiert wurde zurückzunehmen (`strom sync undo`) und einen wartenden Stammbaum zu
  verwerfen, bleibt allein dem Nutzer. „Dem Agenten überlassen“ in der App übergibt einen solchen Widerspruch; eine in
  der App gewählte Seite wird im Terminal nur bestätigt, eine Begründung ist freiwillig. Orte bestimmen: „Weiß nicht“
  beantwortet auch einen Widerspruch der Lage und einen Vorschlag für die Schreibweise, und „Immer der erste Kandidat
  (A)“ übernimmt den Kandidaten auch bei einem Widerspruch – nie über von Hand gesetzte Koordinaten. Das Terminal
  spricht mit den Worten der App: Hinweis, belegt, widerlegt, Weiß nicht, Keiner davon, dieselben Wahlen einer Seite.
  Einen solchen Widerspruch, den früher ein Agent entschieden hat, findet `strom fixes show edit-decisions` und öffnet
  ihn wieder für den Nutzer; die Entscheidung des Agenten bleibt in einer Notiz (`strom fixes undo edit-decisions`
  stellt sie wieder her).

- **Die Bedingung der Abo-Woche nimmt ganze Zahlen von 0 bis 99 und hält ihre Obergrenze.** Menü und `strom config set`
  lehnen Bruchzahlen und 100 ab (früher wurde das gespeichert und jeder Lauf endete dann) und das Menü behält eine
  gesetzte Obergrenze; mit Obergrenze wird eine laufende Sitzung gebeten abzuschließen, sobald die Woche die
  Obergrenze erreicht, nicht erst bei 99 %. Eine bis zu einem Datum zurückgestellte Aufgabe kommt an diesem Tag zurück,
  wie es nun auch die Hilfe sagt. Ankommende Bilder wecken nur die Aufgaben, die auf dieses Buch warten – nie eine
  Prüfung einer Website durch den Menschen, einen Brief nur, wenn er auf dieses Buch wartet.
  So früher geweckte Aufgaben findet `strom fixes show woken-waits`, und sie warten wieder, wie sie gewartet haben.

## 1.25.2

*3.11.2026 · gehört zur Strom-App 3.21.2.*

- **Das Tor der Abo-Woche beendet einen Lauf nicht mehr wegen einer unlesbaren Antwort.** Es fragt erneut, wartet dann
  eine Viertelstunde und nennt, was es erhielt. Ein nicht angemeldeter Agent wird schon vor der ersten Sitzung gemeldet,
  mit dem Weg zur Anmeldung; der in der Umgebung genannte Standardordner des Agenten wird weggelassen, so bleibt der
  Agent bei seiner üblichen Anmeldung.
- **Orte zuordnen: eine Prüfung schreibt, was sie findet, in den Datensatz des Ortes.** Alte Namen und Schreibweisen,
  andere Formen des Ortes in den Angaben und eine falsche Pfarrei (mit Grund entfernt) kommen in den Datensatz, auch
  wo die Koordinaten von der Person stammen, nie nur in die Geschichte. Eine Form nahe einem Ort, der schon einen
  Datensatz hat, wird abgelehnt, mit dem Weg, sie diesem Datensatz hinzuzufügen; zwei Datensätze eines Ortes lassen sich
  zusammenführen. Der heutige Name steht vorn (ein Ort heute in Polen polnisch, der deutsche Name als historischer).
  Eine Frage zu einem Ort nimmt der Person nie ihre Koordinaten. Schon zugeordnete Orte werden einmal von selbst
  berichtigt (Namen mit Sprache und Jahren als Text, der heutige Name vorn, die Koordinaten der Person, alte Namen nur
  in der Geschichte), und der Schritt lässt sich zurücknehmen. Die Zusammenfassung einer Sitzung zu Orten beginnt mit
  dem, was getan wurde – zugeordnet, bestätigt, mit Frage, nicht gefunden –, und eine Sitzung nimmt mehr Orte
  benachbarter Gebiete. Aus „in Lhota in Nr. 12“ bleibt kein Ort „in Lhota in“ mehr:
  Ort ist die Gemeinde, wie die Forschung sie sonst schreibt, auch wenn der Satz sie beugt. Jeder Name steht nur einmal
  im Eintrag eines Ortes.
- **Die Warteschlange der Orte leert sich, wenn die Orte erledigt sind.** Ein Ort, der bestimmt, geprüft, erfragt oder
  nicht gefunden wurde, verlässt die Warteschlange mit allen seinen Formen, auch mit einer, die die Fakten inzwischen
  anders schreiben; Orte, die eine Sitzung schon erledigt hat, werden nicht erneut genommen, und die Zahl des Wartenden
  stimmt. Was eine frühere Version in der Warteschlange ließ, wird von selbst entfernt (nur erledigte Orte, der Schritt
  lässt sich rückgängig machen); eine Prüfung, die für einen Ort verlangt wird, der auf die Bestimmung wartet, bleibt
  als Prüfung, und eine Prüfung, die bei einer Form wartet, die die Fakten jetzt als anderen Ort schreiben, geht mit
  ihnen zu diesem Ort. Jeder Schritt bei den Orten lässt sich mit seiner eigenen Nummer rückgängig machen, auch wenn ein anderer
  wartet (auch die Antworten der Person). Ein falscher Name im Datensatz eines Ortes — ein Versehen eines Eintrags, das
  kein Faktum mehr schreibt, der Name eines anderen Ortes — lässt sich mit Begründung entfernen (`strom place names L…
  --drop`); die Sitzung über die Orte sieht die weiteren Namen des Datensatzes mit Sprache und Jahren; eine Prüfung kann
  die Quelle nennen, auf die sie sich stützt; eine Zugehörigkeit lässt sich auch für ein einzelnes Jahr angeben.
- In den Widersprüchen einer Änderung aus der App bekommt eine Hausnummer, die ihre Bezeichnung schon trägt, sie nicht
  ein zweites Mal (polnisch „nr domu nr domu 12“), und der Gedankenstrich im Titel richtet sich nach der Sprache der
  Forschung.
- Der Plan dessen, was der Agent als Nächstes tut, bricht bei einer wartenden Geschichte eines Paares nicht mehr ab:
  er nennt beide Partner.

## 1.25.1

*3.11.2026 · gehört zur Strom-App 3.21.1.*

- **Die Bedingungen der Archive erneut geprüft, polnische Quellen dazu.** Bedingungen und robots.txt jedes Archivs,
  das strom kennt, wurden am 3. November 2026 neu gelesen. Die eBadatelna des SOA Praha lässt jetzt keinen Roboter
  mehr an ihre Digitalisate (ihre robots.txt vom 2. November): ihre Bilder nur über den Browser der Person, wie beim
  Archiv Třeboň, das die Anfragen von strom jetzt abweist. Die Bedingungen von Porta fontium sind zitiert (eine Seite
  nach der anderen, für die eigene Forschung, mit Quelle und Adresse). Neu: die
  Skanoteka der PTG (eine Minute zwischen Anfragen), GenBaza, BaSIA, Genealogia w Archiwach, die litauischen Metrikai
  und die Archive in Lwiw, Schytomyr und Riwne (hinter einer Bot-Prüfung oder für KI-Agenten gesperrt: nur der
  Browser der Person), Polona und die Schlesische Digitale Bibliothek (gemeinfrei), die Kleinpolnische Digitale Bibliothek (nur für den eigenen Gebrauch, nie massenhaft) und für Orte in Polen die Namen
  aus dem PRNG des Geoportals und der Słownik geograficzny, mit eigener Suche.
- **Polnische Texte berichtigt; ein kopierter Befehl funktioniert.** Das polnische Menü, die Meldungen, der
  Installer und diese Notizen wurden durchgesehen: überall dieselben Begriffe wie in der Strom-App 3.21.1 (Księga
  rodu, Halbgeviertstriche), Grammatik und Pluralformen berichtigt; Daten stehen wie in der App ohne führende Nullen
  (3.11.2026), ein Monat im Fall, den sein Wort verlangt (przed majem 1880).
  Der Befehl `strom unpack "…"` nach dem Packen einer Forschung oder vor dem Entfernen hat jetzt in jeder Sprache
  gerade Anführungszeichen und funktioniert so auch kopiert.

## 1.25.0

*3.11.2026 · gehört zur Strom-App 3.21.0.*

- **Auf Polnisch.** Die Forschung spricht Polnisch: das Menü, seine Meldungen, was sie in die Forschung schreibt, der
  Installer und die Seite des Telefons; die Notizen und Rollen der Strom-Datei sind polnisch. Ein polnisches System wird von
  selbst erkannt, sonst `strom config set lang pl`. Die Hilfe für den Agenten bleibt englisch.
- **Das Strom-Widget auch unter Windows, und es öffnet die Person.** Eine Forschung schreibt jetzt, was das Strom-Widget von ihr zeigt
  (woran gearbeitet wird, die Funde der letzten 24 Stunden, was wartet), auch unter Windows, nach
  `%USERPROFILE%\.config\strom\widget`, mit einer Marke des strom, der es geschrieben hat. Ein Widget, das gerade seine
  Datei liest, hält die Brücke nie auf. `strom uninstall` entfernt auch die Dateien des Widgets, auch auf dem Mac; die
  Forschung und die Einstellungen bleiben.
  Eine Zeile oder ein Fund des Strom-Widgets zu einer Person öffnet in der Strom-App
  genau diese Person (ihre Seite, den Stammbaum um sie), was wartet, den Abschnitt „Wartet“ der Forschung (eine App,
  die sie noch nicht öffnen kann, öffnet den Stammbaum wie bisher).
- **Eine Nummer allein nach dem Namen einer Gemeinde.** Orte, geschrieben als Name mit einer Nummer allein (`Lhota 16`),
  lassen sich jetzt auch richtigstellen (`strom fixes run street-places`): der Ort wird die Gemeinde, die Nummer ihr
  Haus – erst wenn eine Person für jede Gemeinde einzeln sagt, dass ihre Nummern Häuser sind, nachdem die betroffenen
  Angaben gezeigt wurden. Teile einer Stadt mit Nummer (`Praha 5`) werden nie angeboten. Die Antwort bleibt in der
  Forschung, und `strom fixes undo street-places` stellt alles wieder her.
- **Zurück in der Zeit.** `strom history back <Änderung>` bringt die Forschung auf ihren Stand nach einer früheren
  Änderung zurück: zuerst, was zurückkommt und was beiseitegelegt wird, dann nur auf das Ja einer Person im Terminal.
  Nichts wird gelöscht: seither hinzugefügte Einträge werden beiseitegelegt, und die Rückkehr selbst lässt sich ebenso
  zurücknehmen. Der Link `strom-research://back` öffnet sie zu einer Änderung; das
  Protokoll der Brücke weist eine Rückkehr eigens aus.
- **Orte bestimmen.** Die Forschung bestimmt die Orte ihrer Einträge (`strom place identify`, `propose`,
  `unlocated`): ein aus den Einträgen sicherer Ort erhält Koordinaten, Namen und Pfarrei im Lauf der Zeit; wo es nicht
  sicher ist, fragt sie eine Person mit höchstens drei Kandidaten oder sagt, was entscheiden würde. Die Fragen warten
  unter „Wartet“, die Brücke bietet sie der Strom-App an, und `strom place undo` nimmt die letzte Antwort zurück. Eine
  Warteschlange von Orten, die die Strom-App jetzt bestimmen lässt, läuft in so vielen Sitzungen nacheinander, wie die
  Person wählt, jede Zahl mit Zeit und Preis. Bei jedem Namen eines Ortes ist erkennbar, ob er eine Schreibweise der
  Einträge oder ein anderer Name des Ortes ist (eine andere Sprache, ein alter Name), und ein auf beide Arten
  angegebener Name steht nur einmal da. Die Strom-Datei gibt der Strom-App 3.21.0 die bestimmten Orte mit ihren Namen,
  ihrer Lage und Pfarrei.
- **Arten der Geschichte.** `history.kinds` legt fest, welche Arten von Ereignissen die Geschichte der Orte sucht
  (Kriege, Epidemien …). `strom history align` sagt zuerst, was es verbergen, wieder zeigen und suchen würde, und tut
  es nur auf das Ja einer Person; nichts Gefundenes wird gelöscht.
- **Nebenzweige zuletzt.** In einer Forschung mit mehreren Linien wartet Arbeit, die keiner Linie hilft, bis die
  Linien nichts mehr zu tun haben (`queue.offLine`: zuletzt, nach Priorität oder nie).
- **Aktualisieren, ohne die Arbeit anzuhalten.** `strom update` installiert jede Version in einen eigenen Ordner, so
  geht eine laufende Arbeit oder ein Gespräch mit ihrer Version weiter; ältere Versionen gehen beim nächsten Update
  oder mit `strom tidy`, und `strom doctor` nennt sie. Die Brücke antwortet der Strom-App auch, während sie sich
  erneuert und während sie die Datei des Stammbaums erstellt.

## 1.24.0

*31.10.2026 · gehört zur Strom-App 3.19.0.*

- **Orte einmal zugeordnet für jede Forschung auf diesem Computer.** Ein Ort, den eine andere Forschung hier schon den
  Regionen der Geschichte zugeordnet hat, wird übernommen, wenn es sicher derselbe Ort ist (derselbe Name und dieselben
  Koordinaten, Pfarrei oder derselbe Bezirk) und jede Forschung ihn gleich zuordnet; nur die Zuordnung des Orts geht
  über, nichts von der Familie. Ein Ort gleichen Namens, der nicht sicher derselbe ist, geht als Vorschlag an den
  Agenten; er ordnet nur den Rest zu. `strom history adopt --dry-run` sagt, was übernommen würde. Die Frage, die Ereignisse der Geschichte ein- oder
  auszuschalten, sagt, dass es für jede Forschung auf diesem Computer gilt, und wie es sich für eine allein ändern lässt.
- **Die Korrekturen einer Forschung für die Strom-App.** Die Brücke listet, was `strom fixes` in der Forschung anbietet
  (Titel, was sie tut, wie viele Einträge, ihr Stand, ob sie sich zurücknehmen lässt), kostenlos und ohne etwas zu
  schreiben; der Link `strom-research://fixes` öffnet eine Korrektur im Terminal der Forschung, wo sie und ihre
  Rücknahme immer zuerst bestätigt werden.
- **Die Seite jedes Scans in der Strom-App.** Die Strom-Datei gibt jetzt jeder Quelle die Seite ihres Scans im
  Online-Archiv: die Seite ihres ersten Bildes, sonst die eigene Adresse der Quelle. Die Strom-App verlinkt sie bei den
  Ausschnitten, die die Datei auslässt, und bei Quellen ohne Ausschnitt. Nur eine öffentliche Webseite, nie die Adresse
  eines Bestands; die Standard-GEDCOM-Datei behält die Adresse in der Notiz. Das Datum der Version der
  Forschung in der Strom-Datei trägt auch die Uhrzeit, so zeigt die App den Tag ihrer Entstehung auch um Mitternacht.
- **Die eigene Linie einer Person aus der Strom-App.** Markiert die Strom-App, dass eine Person eine eigene Linie
  gründet oder die der Familie nicht trägt, behält `strom sync` das in der Forschung, und die Strom-Datei gibt es
  zurück, so zeigen die nächste Sendung und ein anderes Gerät dieselben Linien; das Zusammenführen zweier Personen
  behält die Markierung. Die Standard-GEDCOM-Datei sagt nichts davon. Es braucht die Strom-App 3.19.0.
- **Hausnummer, Alter und Zeitraum, wie sie geschrieben wurden.** Das Wort für eine Hausnummer („No.“, „čp.“) steht nur vor
  einer Zahl allein; eine Straße mit Nummer geht so in die Datei, wie sie ist. Ein Alter „05y“ gilt als 5 Jahre.
  Beides kommt aus der Strom-App gleich zurück, keine Änderung des Benutzers. Ein Zeitraum der Strom-App
  („1871/1882“ oder an einem Ende offen) kommt als von … bis … in die Forschung, nie als ein Datum irgendwo dazwischen.
- **Ein schwaches oder abgelehntes Modell des Agenten meldet der Doctor.** Ist für die Forschung kein Modell gewählt und
  das eigene Standardmodell des Agenten eines, das die Forschung für ihre Arbeit schwach oder abgelehnt fand, warnt
  `strom doctor` und nennt den Befehl zur Wahl; selbst wählt er nie.
- **strom aus npm behält seinen Kanal.** Mit npm installiertes strom bleibt auf dem Kanal, aus dem es installiert
  wurde, auch nach einer Veröffentlichung; ein mit `strom update --channel` gewählter Kanal bleibt dafür ebenfalls
  gemerkt.
- **Ein gescheiterter Befehl nimmt nur das Seine zurück.** Ein Befehl, der unterwegs gespeichert hat und dann scheitert,
  nimmt nur zurück, was nach dieser Speicherung kam, so wirkt die Forschung nie außerhalb von strom geändert. Wird das
  Schreiben abgelehnt, weil die Forschung außerhalb von strom geändert wurde, liest die Person das in der Sprache der
  Forschung, mit dem passenden Weg; ein Agent liest es weiter auf Englisch.

## 1.23.0

*30.10.2026 · gehört zur Strom-App 3.18.0.*

- **Eine Person unter dem gewählten Namen.** Eine Frau, unter einem Namen geboren, unter einem anderen verheiratet und
  nach einer Scheidung wieder beim ersten, lässt sich wieder unter diesem Namen zeigen, ohne dass er ein zweites Mal
  hinzukommt: `strom name primary <Person> "<Name>"` (und `--clear`) oder `strom name add --primary`. Die Wahl trifft
  allein der Nutzer, nie wird sie aus einem Eintrag gelesen; Korrekturen, Zitate und der Abgleich mit der Strom-App
  richten sich weiter nach dem Geburtsnamen. Die Strom-Datei markiert den gewählten Namen, die Standard-GEDCOM-Datei
  setzt ihn an die erste Stelle. Die Strom-App 3.18.0 zeigt die Person unter diesem Namen, und ein dort gewählter Name
  kommt mit dem Abgleich zurück.
- **Die Datei für die Strom-App ohne Warnungen.** Der Export für die Strom-App warnte bei jeder Person mit gewähltem
  Namen und bei mehreren Kennzeichen von Quellen vor einem nicht standardisierten Tag; die Prüfung kennt jetzt alle
  eigenen Tags von Strom.
- **Ein Commit mit git über einer mit zwei Schlüsseln versiegelten Forschung (Windows).** `strom check` riet zugleich
  zu `strom repair` und zu „nie `strom repair`“, und `strom repair` machte die mit dem Schlüssel des Terminals
  geschriebene Arbeit rückgängig. `strom repair` macht jetzt nur rückgängig, was außerhalb von strom geschah, die
  Arbeit beider Schlüssel bleibt; danach vereint `strom seal adopt` in einem eigenen Terminal die Schlüssel – `strom
  check` nennt beide Schritte in dieser Reihenfolge. Aus der für Windows paketierten Desktop-App eines Agenten
  gestartet, lässt `strom repair` eine solche Forschung unverändert und verweist auf das Terminal. Nach einem Commit
  mit git, der keinen Eintrag änderte, sagt `strom repair`, dass es die Forschung neu versiegelt hat, nicht mehr
  „nothing to repair“. Ein dort abgelehnter Schreibvorgang verweist ebenfalls auf das Terminal, nicht mehr zuerst auf
  `strom repair`.
- **Der Siegelschlüssel auch dort, wo ein älteres strom sucht (Windows).** Ein aus der Kopie einer für Windows
  paketierten App übernommener Schlüssel liegt jetzt auch in `%APPDATA%\strom\keys`, wo ihn strom 1.22.1 oder älter
  im Terminal sucht: zurück bei einer älteren Version bleibt die Forschung auf diesem Computer versiegelt. Ein Schlüssel,
  der dort schon liegt, wird nie ersetzt.
- **Die Erzählung eines Paares, aus der Strom-App freigegeben.** Die Frage im Terminal nennt jetzt die Erzählung des
  Paares, nicht mehr die einer Person.
- **Die Erzählung eines Paares, von der Forschung vorgeschlagen.** Sobald Einträge das gemeinsame Leben eines Paares
  erzählen (die Hochzeit oder ein Kind und zwei weitere Angaben) und einer der beiden schon eine eigene Erzählung hat,
  schlägt die Forschung die Erzählung des Paares vor wie die einer Person – nur das gemeinsame Leben (Hochzeit,
  Haushalt, Wohnorte, Kinder, Witwenschaft); auf die Erzählungen der Partner wird verwiesen, sie werden nicht
  wiederholt. Eine danach geschriebene Erzählung einer Person fasst die Ehe in einem Satz zusammen; keine schon
  geschriebene wird dafür gekürzt. `strom config set stories no` schaltet auch diese aus.
- **`strom repair` in einer Sprache.** Jede Zeile („wiederhergestellt“, „nichts zu reparieren“ …) steht für eine
  Person in der Sprache der Forschung; ein Agent liest sie wie bisher auf Englisch.

## 1.22.2

*30.10.2026 · gehört zur Strom-App 3.17.1.*

- **strom aus der Desktop-App eines Agenten und aus einem Terminal schreiben wieder in eine Forschung (Windows).** Die
  Desktop-App eines Agenten kann für Windows verpackt sein (MSIX), und jede Datei, die ein von ihr gestartetes strom in den Einstellungen
  von strom anlegte, landete in der privaten Kopie der App: das strom der App und das des Terminals hatten je einen
  eigenen Siegelschlüssel, und jedes hielt die Schreibvorgänge des anderen für Änderungen außerhalb von strom. Die
  Einstellungen liegen jetzt außerhalb von AppData (`%USERPROFILE%\.config\strom`) und werden aus dem alten Ordner
  und aus der Kopie der App von selbst übernommen (beide bleiben, wie sie waren). Eine so geteilte Forschung heilt sich
  selbst, wo es geht; sonst vereint `strom seal adopt` in einem Terminal die Schlüssel (das Menü bietet es einmal an) –
  jeder Datensatz geprüft, nichts geht verloren, nie `strom repair`. Ein aus einer solchen App gestartetes
  `strom update` installiert nichts (nur die App sähe es) und sagt, es im Terminal auszuführen; `strom doctor` findet
  eine Kopie des Programms, die eine App für sich behält.
- **`strom repair` nach einem mit git gemachten Commit, der keinen Datensatz änderte** (leer, nur Notizen), versiegelt
  die Forschung wieder; vorher blieb der Commit unversiegelt, jeder Schreibvorgang wurde abgelehnt, und es gab nichts zu reparieren.

## 1.22.1

*29.10.2026 · gehört zur Strom-App 3.17.0.*

- **Ein Ereignis eines Ortes wird bei seiner Region nicht noch einmal geschrieben.** Wurde die Geschichte eines Ortes
  vor den Regionen gesucht, zu denen er gehört, konnte die Geschichte der Region dasselbe Ereignis noch einmal
  hinzufügen (dieselbe Art, dieselben Jahre). Die Region lässt jetzt aus, was einer ihrer Orte schon hat; ein
  Ereignis, das die ganze Region betraf, wird weiter geschrieben. Was der Agent zu einem Ort liest, sagt auch, welche
  seiner Regionen noch nicht durchgesehen sind.

## 1.22.0

*29.10.2026 · gehört zur Strom-App 3.17.0.*

- **Jeder Name einmal in dem, was wartet.** Eine Aufgabe zu Material, das aus der Strom-App gesendet wurde, nannte im
  Widget und auf der Seite des Telefons jede Person zweimal (das zweite Mal in eckigen Klammern), und ihr Text ohne
  Namen ließ leere Klammern stehen; Menü, `strom plan`, die Strom-App und die GEDCOM-Datei zeigten den Namen mit
  seiner ID wiederholt. Jedes nennt den Namen jetzt einmal.
- **Das Widget öffnet die richtige Forschung.** Bei mehreren Stammbäumen gleichen Namens in der Strom-App konnte das
  Widget auf dem Mac-Schreibtisch einen der anderen öffnen; jetzt öffnet es den Stammbaum seiner eigenen Forschung.
- **Viel kleinere Sitzungsprotokolle.** Die Protokolle der Sitzungen und Leser behalten die Bilder, die der Agent
  angesehen hat, nicht mehr (nur ihre Größe und den Pfad der Ansicht) und sind dadurch 95–99 % kleiner.
- **Aufräumen, das mithält, und ein Start, der nicht wartet.** `strom tidy` bewältigt Protokolle jeder Größe.
  Ansichten von Scans, abgebrochene Downloads und anderes, was strom neu erstellen kann, werden auch ohne Zustimmung
  aufgeräumt; Protokolle werden dann nur verkleinert, nie gelöscht. Nach einem Nein kommt die Frage noch einmal, wenn
  `.strom` weit über die Forschung hinauswächst.
  Langsamer Start auf OneDrive oder einem Netzlaufwerk: Menü und `strom doctor` öffnen nicht mehr jeden Scan, die
  Rückkehr ins Menü ist sofort da, doctor zeigt den Fortschritt und meldet, wenn die Forschung in einem Cloud-Ordner
  oder auf einem Netzlaufwerk liegt; `strom doctor --timing` zeigt, was lange dauerte. Bei einer langen Forschung
  (viele hundert Personen, Zehntausende Scans) zeigt das Menü sofort, was wartet: Die Zahl wird neben der Forschung
  gehalten, bis sich etwas ändert, worauf sie beruht, und dann in einem Bruchteil einer Sekunde neu gezählt.
- **Ein Archiv, das nicht antwortet, beendet die Schleife des Agenten; Leser warten nicht mehr auf einen verstummten
  Dienst.** `strom fetch` sagt, wann es wieder zu versuchen ist und was bis dahin zu tun ist; dieselbe Anfrage in
  derselben Sitzung endet sofort (Exit 8) und sendet nichts. Eine Aufgabe, deren Archiv pausiert, wartet bis dahin
  außerhalb der Warteschlange (der Plan zeigt sie bis zu dieser Zeit zurückgestellt), und `strom run --loop` wartet
  bis dahin, statt Sitzungen ohne Arbeit zu starten. Ein Leser, dessen Agent nach einem erneuten Versuch seines
  Dienstes verstummt, wird einmal dort fortgesetzt, wo er aufhörte; bleibt er still, endet er sofort. Ein solcher
  Ausfall verkleinert die Lesestapel nicht mehr.
- **Das Tor der Abo-Woche lässt mehrere Sitzungen hintereinander laufen.** Wartet es einmal auf Vorsprung, lässt es
  erst mit zwei Punkten mehr wieder los (bei 15: 17), statt einer Sitzung nach jedem Warten.
- **Was die Vorfahren erlebten.** Die Ereignisse an den Orten des Stammbaums – die Geschichte einer Region aus Seiten,
  die strom selbst geladen und geprüft hat, örtliche Ereignisse aus gelesenen Einträgen – zeigt die Strom-App. Die
  Ersteinrichtung schlägt es eingeschaltet vor; eine früher eingerichtete Installation fragt einmal, im ersten Menü
  nach dem Update (Enter: jetzt nicht), und nichts schaltet sich von selbst ein. Einschalten kann es nur ein Mensch –
  dann oder später im Menü Einstellungen → Der Agent allein → Geschichte, aus der Strom-App oder mit
  `strom config set experiments.history on`; solange es aus ist, wird nichts gesucht. Die Geschichte der Regionen
  und die der Orte sind zwei Schalter, jeder auch nur für eine Forschung (Einstellungen → Der Agent allein, `strom
  config set experiments.history|experiments.placeHistory on|off --for-tree`, oder aus der Strom-App ausgeschaltet) –
  die Wahl einer Forschung gilt in beide Richtungen; mit ausgeschalteten Orten wird auch ein erfragter Ort nicht
  gesucht. Was eingeschaltet war, bleibt es für beide, was aus war, für beide aus. Eingeschaltet, werden die Orte in der nächsten Sitzung zugeordnet und die Regionen ab und zu zwischen den
  Sitzungen der Familienforschung durchsucht: etwa jede 5. Sitzung (Standard), jede 10. oder nur, wenn nichts anderes
  ansteht (`strom config set experiments.historyPace`, die Ersteinrichtung, die Einstellungen); wann, sagt `strom plan`,
  und auf das Wort eines Menschen können alle zuerst laufen (`strom run --history`, im Menü „Geschichte jetzt suchen“).
  Zuerst die Regionen mit den meisten Personen, ein Land vor dem Staat darüber.
  Sind die Ereignisse einer Region gesammelt, werden die Jahre, in denen die Personen des Stammbaums dort mehr als
  15 Jahre in Folge ohne ein Ereignis lebten, noch einmal durchsucht; durchsuchte Jahre werden in keiner Forschung
  erneut aufgegriffen, bis die Region wieder angefragt wird.
  Eine Region wird nur in den Jahren durchsucht, in denen Personen des Stammbaums an ihren Orten lebten (ihre Angaben
  dort und fünf Jahre darum; bis heute nur, wenn die Angaben in die letzten 30 Jahre reichen) – ein paar Jahre im
  Krieg im Ausland sind nur diese Jahre. Lebte ein später gefundener Vorfahre früher oder später dort, oder teilt eine
  andere Forschung die Region, werden einmal nur die neuen Jahre durchsucht. Eine Region, in deren Jahren niemand
  aus dem Stammbaum lebte (die Angaben an ihren Orten liegen alle davor oder danach), wird gar nicht durchsucht; die
  Übersicht und die Strom-App sagen, dass dort in jenen Jahren niemand aus dem Stammbaum lebte. `strom history status`
  und `strom plan` zeigen die Jahre jeder Region und was wartet.
  Was gezeigt wird, verwaltet der Mensch in der Strom-App oder mit `strom history`: ein Ereignis ausgeblendet, oder
  gelöscht – aus jeder Forschung auf diesem Computer, nie wieder eingetragen – und wiederhergestellt; eine Region oder
  ein Ort übersprungen; die Regionen eines Orts von Hand zugeordnet. `strom history list [--place L…] [--region <id>]`
  listet die Ereignisse im Terminal: die Jahre, die Art, den Text in der Sprache der Forschung, die Quelle, was
  verborgen oder gelöscht ist.
  Die Geschichte eines einzelnen Ortes und seiner Umgebung – Brände, Hochwasser, Schlachten in der Nähe, die
  Herrschaft, die Pfarrei, die Schule – wird auf das Wort eines Menschen gesucht (aus der Personenkarte der
  Strom-App), zuerst in der nächsten Sitzung, und bleibt für jede Forschung auf diesem Computer mit diesem Ort. Jeder
  Ort mit Koordinaten kann von selbst gesucht werden, die Orte mit den meisten Personen zuerst: Einstellungen → Der
  Agent allein → Geschichte der einzelnen Orte automatisch (aus, bis es eingeschaltet wird). Ein Ereignis, um das im
  Gespräch gebeten wird, trägt der Agent von einer Seite ein, die strom gelesen hat, mit seiner Quelle.
  Die Erzählungen nehmen sie als Hintergrund ihrer Zeit: die Ereignisse der Jahre, in denen ein Mensch an den Orten
  seiner Angaben lebte, jedes mit seiner Quelle, nie als das, was er tat (bei einem Paar nur die Jahre, in denen
  beide lebten); nichts Ausgeblendetes oder Gelöschtes. Eine
  freigegebene Erzählung bleibt, wie sie ist – die Geschichte kommt erst mit ihrer nächsten Fassung, die auf Freigabe
  wartet. Abschaltbar in den Einstellungen oder in der Strom-App (`strom config set stories.history no`).
- **Die Formen eines Familiennamens.** `strom surname suggest` schlägt vor, welche geschriebenen Formen eines
  Familiennamens zu einer Familie gehören: dieselbe Person in den Einträgen verschieden geschrieben (mit den Belegen),
  oder derselbe Laut anders geschrieben am selben Ort in denselben Jahren – nie die Familien von Ehemann und Vater
  einer Frau; eine Lesemarke nach einem Namen (`[?]`, `[!]`, `[…]`) ist keine eigene Form. Entscheiden kann nur ein
  Mensch, im Terminal (`strom surname accept|reject|group`); ein Agent schlägt
  nur vor. Die Formen einer Familie erweitern die Suche nach Einträgen und nach Personen, die eine sein können.
  `strom person compare` sagt von zwei Personen, ob sie eine sind, zwei oder unsicher, und warum (schon
  zusammengeführt, ein anderes Geschlecht, Jahre weit auseinander, ein Leben, das endete, bevor das andere begann,
  andere Eltern, ein Eintrag für beide…). Ein als kein Fehler markierter Befund bleibt es:
  `strom quality dismiss|undo|list`, allein die Entscheidung eines Menschen – zwei so markierte Personen werden nie
  wieder als eine vorgeschlagen. `strom check` warnt vor einem Ereignis oder einer Heirat, die sicher nach dem Tod
  einer Person datiert ist (ein ungefähres Datum nie), und der Plan einer Forschung legt eine Aufgabe an, das zu
  prüfen – von selbst erledigt, sobald das Datum berichtigt oder der Befund als kein Fehler markiert ist. Ein
  Beteiligter eines Ereignisses (ein Pate, ein Zeuge) ist ein Name, und was der Eintrag über ihn sagt, steht als
  Notiz in Klammern am Ende: `--with "godparent:Jan Lhoták (sedlák, Lhota č. 12)"`; ein Name aus mehr als vier
  Wörtern oder mit einer Zahl wird abgelehnt, mit dem, was in die Klammern gehört, ein als Zeuge genannter Geistlicher
  wird als Amtsträger (`officiant`) erfasst, und ein Beteiligter, der jemand aus der Familie um den Eintrag sein kann,
  wird mit seiner Nummer vorgeschlagen, nie von selbst verknüpft. So früher geschriebene Namen findet `strom check`,
  und `strom fixes show|run participant-names` trennt sie – kostenlos, nach Regeln, auch in einem Archiv, alles in
  einem Schritt, zurück mit `strom fixes undo participant-names`; entscheiden kann nur ein Mensch.
  Eine Strom-App vor 3.17 gibt einen Zeitraum als Spanne zurück (von–bis als zwischen–und) und ein Alter ohne
  Einheiten von null (0y 2m 26d als 2m 26d); eine Synchronisation nahm das als Änderung – ein Widerspruch oder ein
  Wohnort als Hinweis neben demselben. Nun kommt ein unveränderter Baum ohne Änderung zurück; von einer App, die sie
  behält (3.17), ist eine Spanne statt eines Zeitraums wieder eine Änderung, und ein Alter aus lauter Nullen
  (0y 0m 0d) ist dasselbe wie 0y. Was frühere
  Synchronisationen so schrieben, findet `strom fixes show app-shapes` und korrigiert `strom fixes run app-shapes` –
  kostenlos, nach Regeln, auch in einem Archiv, alles in einem Schritt, zurück mit `strom fixes undo app-shapes`;
  entscheiden kann nur ein Mensch.
  Eine Straße ist kein Ort: ein Ort mit Straße oder Nummer („Lhota, Lhotákweg 12“) wird beim Schreiben
  abgelehnt, mit der Gemeinde zum Schreiben und Straße und Nummer für `--house`, in jeder Sprache und jedem Alphabet; die
  Geschichte der Orte richtet sich nach der Gemeinde, Orte, die sich nur in der Straße unterscheiden, sind einer. Was
  früher so geschrieben wurde, findet `strom check` und korrigiert `strom fixes show|run street-places` (die Straße
  zum Haus, wo es leer ist oder dieselbe nennt) – kostenlos, auch in einem Archiv, alles in einem Schritt, zurück mit
  `strom fixes undo street-places`; entscheiden kann nur ein Mensch.

## 1.21.0

*26.10.2026 · gehört zur Strom-App 3.16.0.*

- **„Wartet“ sagt, was die Strom-App nicht zeigt.** Die Zeile im Menü und `strom plan` sagt, wie viel des Wartenden
  nur hier im Terminal ist und wie viel auf Antwort wartet; der Rest ist die Zahl, die die Strom-App zeigt, sodass
  beide übereinstimmen.
- **„Was wartet“ stellt das Eigene des Terminals voran.** Was nur das Terminal zeigt (ein Widerspruch einer eigenen
  Änderung, eine Sendung der App, eine Frage zum Lesen von Scans), steht unter „Nur hier im Terminal“, der Rest unter
  „Auch in der Strom-App“.
- **`strom input assign`, `hide` und `unskip` sagen, was sich geändert hat**, in der Sprache der Forschung: jede
  Datei, jede freigegebene oder neue Aufgabe, Personen mit Namen und wie es rückgängig geht. Ihr JSON bleibt gleich.
- **Eine Übersicht der Forschung für ein Widget auf dem macOS-Schreibtisch.** Solange die Brücke läuft
  (`strom live`), wird die Übersicht jedes Stammbaums in einer Datei für ein Widget auf dem Mac-Schreibtisch
  gehalten: was gerade läuft, die Funde des letzten Tages und was wartet, jeder Text auch ohne die Namen von
  Personen. Außerhalb von macOS wird nichts geschrieben.

## 1.20.0

*25.10.2026 · gehört zur Strom-App 3.16.0.*

- **Das Menü ohne jemanden am Terminal sagt es sofort.** Dort gestartet, wo niemand antworten kann (geschlossene
  Eingabe, ein Fenster ohne Terminal), endet es mit einem Satz in der Sprache der Forschung und dem, was
  stattdessen zu tun ist, nicht mehr mit einem Fehler des Programms; eine Frage, deren Eingabe vor der Antwort endet,
  beendet das Menü genauso.
- **`strom check` spricht eine Sprache.** Für einen Menschen stehen alle Befunde, die Summe und die Hinweise in der
  Sprache der Forschung, für einen Agenten alles auf Englisch, nie beides gemischt. Er sagt auch, was diesem Computer
  fehlt: Dateien des gemeinsamen Ordners, die nicht mitkamen (wie viele, die erste und den ganzen Strom-Ordner
  zurückholen), und Dateien einer Forschung in iCloud Drive, die noch nicht geladen sind – genau so gesagt, nie mit
  `strom repair`, und nichts wird über sie geschrieben. Eine volle Platte wird überall gleich gesagt, in der Sprache
  der Forschung mit dem Ordner, auf dessen Platte der Platz fehlt; die Brücke antwortet der App mit `disk.full` (507)
  und `tree.not-downloaded` (409), und `strom live start` sagt, warum eine Brücke nicht startete.
- **Verweigert die Sandbox des Agenten git, wird der richtige Ort genannt.** Die Meldung nennt die Geschichte der
  Forschung (ihren Ordner `.git`) als verweigerten Ort, nicht das Programm git.
- **Ein Strom-Archiv startet kein bezahltes Lesen.** `strom read`, `strom clips` und `strom transcripts` werden in
  einem Archiv (und in einer Forschung, die auf ihren Agenten wartet) mit demselben Satz abgelehnt wie die anderen
  Ablehnungen; nichts wird gelesen, nichts geschrieben.
  Seine Texte versprechen nichts: Material wird „im Strom-Archiv gespeichert“ und nur die Anzahl
  genannt; ein Ordner mit mehr als 20 Bildern bietet das Speichern als Familiendokumente an; die Seite des Telefons
  sagt in einem Archiv „Im Strom-Archiv speichern“; das Telefon steht in der Hilfe eines Archivs. Die Hilfe eines
  Archivs und einer Forschung, die auf ihren Agenten wartet, bietet nur, was darin geht, ohne Aufgaben und
  Warteschlange; die Anleitung in einem gepackten Archiv (`strom pack`) führt in die Strom-App. Es kündigt auch
  keine neue Aufgabe an, die es nie zeigt. **Seine Widersprüche werden in ihm entschieden:** ein offener (dieselbe
  Angabe in der Strom-App und hier anders bearbeitet) steht in der Übersicht und unter „Was wartet“ und wird dort
  entschieden – der Wert der App oder der des Archivs, und warum –, wie es der Link der App tut; `strom conflict`
  steht in der Hilfe eines Archivs. `strom person show` einer in der Strom-App entfernten Person beginnt damit, mit
  dem Tag und `strom sync undo I…`, das sie zurückholt; die Listen ihrer Verwandten markieren sie „(entfernt)“.
  **Zwei Browser an einem Archiv:** eine in einem entfernte Person schreibt die ältere Kopie des anderen nie als neue
  Person — dort unberührt, bleibt die Entfernung und die App erfährt, welches Senden sie entfernt hat; dort
  bearbeitet, bleiben die Änderungen bei ihr und ein Widerspruch fragt, ob sie zurückkommt — eine zweite Kopie, die
  sie anders bearbeitet hat, ist ein eigener Widerspruch gegen die erste und überschreibt sie nie, und nach
  „entfernt lassen“ fragt dieselbe Kopie nicht mehr. Eine ältere Kopie ohne eine Person, die ein anderes Fenster
  oder die Forschung inzwischen bearbeitet hat, entfernt sie nicht mehr still: ein Widerspruch fragt, ob sie geht,
  und sagt, wer sie bearbeitet hat (eine andere Kopie der App, die Forschung, beide); eine inzwischen zurückgenommene
  Änderung (`strom sync undo`) zählt nicht, und nach „behalten“ erfährt dieselbe Kopie nur das. Das Zurücknehmen des
  Sendens der älteren Kopie nach „entfernen“ sagt, dass die Person entfernt bleibt und wie sie zurückkommt
  (`strom conflict resolve X… --take research`). Ein zurückgenommenes
  Senden (`strom sync undo`), aus der App erneut gesendet, entfernt wieder, was es entfernt hat. Ob eine Person im
  Stammbaum bleibt, lässt sich erneut entscheiden: `strom history` nennt jede Entscheidung mit ihrer eigenen Begründung
  und ob die Person den Stammbaum verließ oder zurückkam, und `strom conflict show` zeigt die früheren Entscheidungen in
  der Sprache der Forschung.
- **Die Sicherung vor einer anderen Version enthält auch den gemeinsamen Ordner.** Die gemeinsamen Bilder (Scans,
  Originale der Strom-App, Fotos vom Telefon) werden verknüpft, wo die Platte es kann, und belegen keinen Platz
  doppelt, sonst kopiert; nur wenn für die Kopie kein Platz ist, bleiben sie weg, und die Sicherung sagt es;
  unvollständige Uploads der App und Vorschauen, die strom neu erstellt, bleiben draußen.
  **Was sichern:** `strom backup` und Einstellungen → Wartung → „Was sichern“ nennen den einen Ordner mit allen
  Forschungen und den gemeinsamen Bildern samt Größe, oder `strom pack` für einen Stammbaum.
- **`strom doctor` erkennt ein Netz- oder umgeleitetes Laufwerk.** Wo git den Ordner, in dem er arbeitet, nicht
  bestimmen kann, können die Stammbäume dort ihren Verlauf nicht führen; doctor sagt es jetzt wie `strom init`.
- **Das Familienmaterial wird in der Strom-App geordnet.** Die Personen, zu denen ein Foto oder Dokument gehört,
  werden für viele Dateien auf einmal oder für einen ganzen Stapel hinzugefügt und entfernt; eine Datei ohne Bezug zur
  Familie oder gleich wie eine andere wird ausgeblendet und jederzeit wieder gezeigt — nichts wird gelöscht. Die App
  zeigt Titel, Art und Datum jeder Datei (`strom input sort --title --date`) und kleine Vorschauen von Fotos, HEIC
  und PDFs, einmal erstellt und beiseite gelegt. Im Terminal: `strom input assign`, `strom input hide` und
  `strom input unskip`, das auch ein Überspringen zurücknimmt. Material, im Terminal oder im Menü zu einem Stammbaum
  hinzugefügt, den die Strom-App hat, sagt, wo es dort ist: bei der Person → Materialien.
- **Ein Stammbaum von einem anderen Computer oder von Hand verschoben wird genannt – nie durch einen anderen
  ersetzt.** Einer, der auf einem anderen Computer versiegelt ist (oder dessen Einstellungen von strom fehlen), lässt
  sich lesen, und ein Schreiben sagt es in der Sprache der Forschung mit dem einen Schritt, `strom seal adopt`,
  angeboten vom Menü, von der Einrichtung (die die gefundenen Stammbäume nennt) und von einem Link der Strom-App,
  immer erst auf das Ja des Menschen; die Brücke lehnt Schreibvorgänge der App mit `seal.foreign` (409) ab. Einer,
  der nicht mehr dort ist, wo er war, wird mit seinem alten Ordner genannt und mit dem Weg, den neuen hinzuzufügen
  (`strom trees use <Ordner>`, danach gemerkt); `strom app`, `strom live start` und kein Befehl öffnen an seiner
  Stelle einen anderen, und `strom trees forget` nimmt einen nicht mehr gewollten von der Liste. `strom trees` und
  `/status` der Brücke sagen, was jeder Stammbaum ist: eine Forschung, eine, die auf ihren Agenten wartet, oder ein
  Strom-Archiv – für die App (`kind`) ist eine Forschung, die auf ihren Agenten wartet, ein Archiv, bis ein Agent an
  ihr beginnt. Eine leere Strom-App (Browserdaten gelöscht), die eine neue Forschung anlegen will, bekommt zuerst
  die Stammbäume angeboten, die es hier schon gibt, um einen davon in der App zu öffnen.

## 1.19.0

*22.10.2026 · gehört zur Strom-App 3.15.0.*

- **Auf ein verstummtes Archiv wird gewartet, statt es immer wieder zu fragen.** Antwortet ein Archiv nicht mehr,
  lässt strom es eine Stunde in Ruhe — zwei, dann vier, wenn es am selben Tag still bleibt — und der Agent erfährt, bis
  wann: Er macht inzwischen andere Arbeit, lässt einen Download im Hintergrund auf das Archiv warten (bis zu 30 Minuten)
  und von selbst weiterlaufen, oder beendet die Sitzung, um später weiterzumachen. Das Archiv wird inzwischen nicht mehr
  immer wieder angefragt.
- **Das erste Aufräumen einer älteren Forschung wird einmal angeboten.** Eine Forschung, neben der sich viel
  angesammelt hat, bevor strom dort selbst Ordnung hielt (Protokolle der Arbeitssitzungen, Ansichten von Scans und
  Ähnliches), bekommt im Menü ein Angebot: was ginge, wie viel und warum — ohne Ja geht nichts. Nach einem Ja wird
  dort von selbst Ordnung gehalten; nach einem Nein sagen Menü und Einstellungen weiter, was sich freigeben lässt.
  `strom pack`, das Entfernen eines Stammbaums und das Menü nennen die Größe eines Pakets, einer Sicherung oder der
  Bilder wie überall sonst (1,5 MB, bei kleinen 24 kB), nie „0.0 MB“.
- **Digitale Bibliotheken beim ersten Versuch richtig durchsucht.** Für Kramerius der Tschechischen
  Nationalbibliothek und der Mährischen Landesbibliothek und für ANNO der Österreichischen Nationalbibliothek bekommt
  der Agent die eigenen Suchadressen der Bibliotheken — weniger fehlgeschlagene Anfragen und weniger Raten.
- **Ein schärfer geholter Teil eines Scans wird gelesen.** Kam ein Teil eines Scans in mehr Detail aus dem Archiv,
  sehen der Agent und seine Leser diese Stelle darin an — auch wenn die markierte Stelle etwas darüber hinausreicht,
  der Rest wird genannt — statt des ganzen, verkleinerten Scans; ein schärferer Teil, der die Stelle nur zum Teil
  zeigt, wird mit dem Weg genannt, ihn anzusehen.
- **Ein Dokument wird verlässlicher gelesen.** Ein Leser schreibt seine Lesung laufend in seinen Bericht, und eine
  Lesung zweier Leser, bei der nur einer las, sagt das so — nie, dass sie übereinstimmen.
- **Die Verbindung mit dem Telefon wartet auf die Forschung, nicht als Fehler genannt.** Bevor die Forschung nach dem
  Neustart des Computers startet, sagen `strom phone` und die Einstellungen, dass die Verbindung an ist und ihr Server
  mit der Forschung wieder startet. Auf einem iPhone bleibt das Blatt der Fotos beim Tippen einer Person oder Notiz über
  der Tastatur, die angebotenen Personen im Blick; der Server des Telefons startet einmal, auch wenn ihn mehrere
  zugleich starten.
- **Korrekturen eigener Fehler von strom zur Entscheidung.** Findet strom, dass eine frühere Version von ihm in einer
  Forschung etwas falsch gemacht hat, sagen `strom fixes` und Einstellungen → Wartung → Korrekturen, worum es geht,
  was gefunden wurde und was eine Behebung täte, auch wie aufwendig sie ist; ohne Ja geschieht nichts, ein Nein
  bleibt. Die erste: blinde Lesungen aus dem verkleinerten Scan, wo es einen schärferen Teil gab — neben den alten
  noch einmal gelesen, zuerst an einigen, nichts überschrieben, ein Unterschied wird zur Aufgabe. Verglichen wird, was
  gelesen wurde — die Namen, Daten und Zahlen der Abschrift, nicht die Worte des Kommentars (auch auf Deutsch, wo
  jedes Substantiv groß geschrieben wird) —, und die Aufgabe sagt in einem Satz, welche Angabe abweicht; wo ein Name
  nur einen Satz beginnen kann, gelten die Lesungen nicht als gleich. Gibt es nichts neu zu lesen, sagt `strom fixes
  run` das. Die zweite: nach einem Wechsel des Lesemodells oder Agenten die früheren
  Lesungen, die ein neues Lesen lohnen — mit offenen Stellen, uneinigen Lesern, einem offenen Widerspruch, an der
  Quelle nicht bestätigt; gesagt als „gelesen von Modell X, jetzt liest Modell Y“, einmal je Agent und Modell gefragt,
  jede so neu gelesen, wie sie gelesen wurde (die Bilder einer Lesung zusammen, ein Versuch oder ein Teil immer aus
  ganzen Lesungen). Gezählt in Lesungen mit ihren Stellen, der Aufwand in Leseaufrufen; angeboten nach Stufen — nur
  die strittigen (uneinige Leser, ein offener Widerspruch, an der Quelle nicht bestätigt), mit der direkten Linie oder
  alle —, jede mit dem, was sie kostet, die engste zuerst; Daten und Zeugen ordnen nur. Beheben kann auch ein anderer
  bereiter Agent oder ein anderes Modell (`strom fixes run <id> --agent <a> --model <m>`), mit dem, der vorher las;
  einer, der hier nicht lesen kann, wird sofort abgelehnt, mit denen, die es können. Die Zeit einer Behebung wird
  aufgerundet und nach dem Versuch nach den nebeneinander gelaufenen Lesungen neu gemessen.
- **Ein Stammbaum, in den strom nicht schreiben darf, sagt warum.** strom schreibt Regeln für Codex in den Ordner der
  Forschung: ein allein ausgeführter strom-Befehl läuft außerhalb der Sandbox von Codex — auch unter Windows, wo die
  Sandbox den Verlauf der Forschung verschlossen hielt und nichts anderes zuließ —, während das, was der Mensch
  entscheidet, und git selbst verboten bleiben. Hindert die Sandbox eines Agenten strom trotzdem am Schreiben in den
  Ordner des Stammbaums, sagt strom das und sagt dem Agenten, was zu tun ist, je nachdem, wie er läuft — strom allein
  ausführen, Codex im Ordner der Forschung starten, dem er vertraut, oder den Befehl außerhalb der Sandbox genehmigen
  lassen — statt eines bloßen „keine Berechtigung“, das der Agent als fehlenden Zugriff auf den Stammbaum wiedergab.
  Wo ein Agent kein eigenes Merkmal hinterlässt, erkennt strom ihn an seinem eigenen Merkmal bei den Agenten, die es
  startet, oder an den Programmen, die es gestartet haben, und nennt seine Sandbox als wahrscheinliche Ursache, danach
  OneDrive oder den überwachten Ordnerzugriff von Windows. Ein vom Verlauf verweigertes Schreiben gilt nicht mehr als
  fehlende Berechtigung für git selbst, und eine Sicherung oder ein Update, die nicht geschrieben werden konnten,
  verlangen einen Ordner, in den geschrieben werden darf, statt Platz auf dem Datenträger freizumachen. `strom doctor`
  und `strom check` versuchen, in die Forschung zu schreiben, und sagen, wenn es nicht geht, auch dort, wo sich der
  Ordner nicht einmal auflisten lässt. Auf einem Laufwerk ohne feste Verknüpfungen (eine Netzwerkfreigabe, ein über
  Remotedesktop umgeleitetes Laufwerk) schreibt strom wieder, seine Sperre geht einen anderen Weg, und eine Sperre, die
  ein langsames Laufwerk noch nicht zeigt, wird nicht mehr nach einem Augenblick übernommen; ein Stammbaum, der sich
  dort nicht anlegen lässt, hinterlässt nichts und sagt es in der Sprache der Forschung. Mit npm unter Windows
  installiert, startet `strom.cmd` strom auch dort, wo PowerShell Skripte verweigert.

## 1.18.0

*21.10.2026 · gehört zur Strom-App 3.14.0.*

- **Handyfotos aufrecht.** Ein Foto, das nach seiner EXIF-Ausrichtung gedreht ist, wird gelesen, wie es gesehen
  werden soll, aufrecht; die darauf markierten Stellen (Ausschnitte, die Hälften einer Doppelseite, ein gespeicherter
  Teil) sind die des Bildes, wie es gezeigt wird. Das Foto selbst bleibt, wie es war.
- **HEIC-Fotos und PDF-Dokumente lesbar.** HEIC-Fotos vom Handy und die Seiten einer PDF werden zum Lesen in JPEG
  umgewandelt — unter macOS, Windows und Linux —, das Original bleibt, wie es kam. Ein HEIC-Foto geht als
  JPEG-Ausschnitt in die Strom-App. Wo nichts auf dem Computer ein Bild umwandelt, sagt es ein Satz, auch was helfen
  würde; `strom tidy` räumt umgewandelte Bilder nach 30 Tagen oder über 500 MB weg.
- **Ein Dokument auf einmal gelesen.** `strom document read` liest ein Foto, einen Scan oder eine PDF eines Dokuments —
  einen Matrikeleintrag, einen Brief, eine Urkunde, einen Grabstein, die Rückseite eines Fotos: die Abschrift Wort für
  Wort, ihre Übersetzung, was alte Wörter und Abkürzungen bedeuten, und die genannten Personen, samt wem im Stammbaum
  sie entsprechen können. Nichts wird ergänzt: ein Name, der nicht im Dokument steht, fällt weg — auch ein Nachname, nie
  vom Vater oder aus einer anderen Familie genommen —, Unleserliches wird markiert; ein zweiter Leser kann blind lesen.
  Ein Dokument auf einem amtlichen Formular, etwa eine Geburtsurkunde, behält seine Personen — das Kind und beide Eltern
  mit ihrem Anteil, auch ein gesperrt getippter Name und ein Geburtsname nach „geb.“ —, und ein früher gelesenes
  Dokument zeigt sie nach dem Update, ohne erneut gelesen zu werden. Jede Person und jedes Ereignis kommt mit der Stelle
  auf der Seite, an der es steht, so zeigt die Strom-App von jedem
  einen eigenen Ausschnitt.
  In den Stammbaum gelangt nichts von selbst. Ein schon gelesenes Dokument sagt es, so wird es nicht versehentlich ein
  zweites Mal gelesen. Ein erneut gelesenes Dokument wird unter dem Namen seiner Datei gezeigt, nie unter einem Code.
  Ein aus der Strom-App gesendetes Dokument findet den Agenten wie das Terminal — auch einen in einem eigenen Ordner,
  über npm oder Homebrew installierten —, statt zu melden, es sei kein Agent eingerichtet. Jeder Agent, mit dem die
  Forschung arbeitet, liest es, mit dem Modell und dem Aufwand, die für die Forschung eingestellt sind.
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
  das sie ohne neues Koppeln öffnet. Was wartet und die Änderungen lassen sich auf dem Handy ganz lesen: kein Text
  dessen, was wartet, wird gekürzt, mehr als die ersten 20 kommen auf Antippen, eine Änderung mit vielen Zeilen klappt
  ganz auf; Was wartet ist der letzte Teil der Seite. Eine Änderung vor heute hat bei der Uhrzeit auch ihr Datum (das
  Jahr nur, wenn es nicht das laufende ist). Funde unter Jetzt zeigen, was die Forschung seit dem letzten Blick vom
  Handy gefunden hat (mindestens die letzten 24 Stunden, ältere auf Antippen) — neue Personen, Quellen, gefundene,
  korrigierte oder neu belegte Angaben, geklärte Widersprüche —, die neuen hervorgehoben; was bei offener Seite
  hinzukommt, zeigt nur eine Zahl im Titel des Tabs und ein kleines Etikett.
- **Eine Zustimmung in einer Sprache, auch im Terminal gefragt.** Eine Zustimmung, die nur ein Mensch gibt (eine
  Forschung entpacken, einen Stammbaum entfernen, ein abgelehntes Fenster), steht ganz in der Sprache der Forschung.
  Was den Computer nach außen öffnet, Geld kostet oder ein fremdes Programm startet – Remote Control, Downloader ohne
  Rückfrage, die Bedingung für den Agenten allein, ein Hook, ein eigenes Tempo eines Archivs, die Verbindung mit dem
  Telefon, das Abstimmen des Lesens – fragt auch im Terminal Ja oder Nein; Enter heißt Nein, `--yes` antwortet nie
  dafür. Wird `strom update` abgelehnt, sagt es, dass nichts installiert wurde und welche Version bleibt, und endet
  mit einem Fehlercode; eine misslungene Installation wird auch in der Sprache der Forschung gesagt.
- **Ein falscher Name oder eine falsche Notiz zurückgezogen.** `strom name retract` zieht einen falsch gelesenen oder
  der falschen Person gegebenen Namen zurück, `strom note retract` eine Notiz, und `strom note edit` berichtigt eine –
  bei einer Person, einem Fakt oder einer Aufgabe, jeweils mit Grund; nichts wird gelöscht. Was zurückgezogen ist,
  zeigt sich nirgends mehr – nicht dem Agenten, nicht im GEDCOM oder in `strom find`, so dass die Strom-App es nach
  dem Laden des Stammbaums nicht mehr zeigt und ein Abgleich es nie zurückbringt; `strom person show --history` sagt,
  was es war, wann und warum, und `strom name restore` oder `strom note restore` holt es zurück.
- **Korrekturen aus Meldungen.** Der Abschied des Menüs sagt, wie strom wieder startet, wo das Terminalfenster den
  Befehl noch nicht kennt (nach der Installation mit einer Zeile: `strom` in einem neuen Fenster, in diesem der volle
  Pfad; der volle Pfad auch, wo zuerst ein anderes `strom` auf den Namen antwortet), und sagt, wenn die Brücke für die
  Strom-App weiterläuft, auch, wie sie zu beenden ist; die Wahl des Stammbaums im Menü geht mit 0 zurück. Die Brücke
  hält den Ordner des Stammbaums nicht mehr fest, so dass Windows ihn löschen kann, und endet von selbst, sobald der
  Stammbaum weg ist (einen Stammbaum löscht `strom trees remove`). Ein Ende des Baums, wo die Taufe keinen Vater
  nennt, ist ein geschlossenes Ende, sobald nichts mehr daran läuft – es wartet nicht mehr für immer auf eine
  Entscheidung. Eine in der Strom-App umbenannte Quelle heißt auch in der Forschung neu, und Signatur oder Seite einer
  Quelle kommen in der App bei der Quelle selbst an, auch bevor etwas sie zitiert. Ein Emoji oder ein anderes seltenes
  Zeichen, das die Datei der Strom-App unterwegs beschädigt hat (als �� zu sehen), ist keine Umbenennung und keine
  geänderte Notiz: Die Forschung behält ihren Text. Ein Ort oder ein anderer Wert, länger als eine Zeile der
  GEDCOM-Datei (255 Bytes), hält das Schreiben der Datei nicht mehr auf, und kein Emoji wird dort geteilt, wo eine
  lange Zeile weitergeht. Mit `excerpts.for all` bekommt auch eine Quelle, die noch niemand zitiert, in der Strom-App
  ihren Ausschnitt, soweit er neben den zitierten unter die Grenze passt – die zitierten werden dafür nie kleiner; was
  nicht passte, wird gesagt. Die Strom-App erfährt, welche Bilder einer Quelle die Forschung hat, ihre Datei aber
  wegließ, und lädt sie bei Bedarf aus der Forschung — Quelle für Quelle oder alle auf einmal, mit Anzahl und etwa
  ihrer Größe.

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
