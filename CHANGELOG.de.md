# Was ist neu in Strom Ahnenforschung

[English](CHANGELOG.md) · [Čeština](CHANGELOG.cs.md) · Deutsch

Die Änderungen jeder Version in Kürze. Die vollständigen Hinweise und die Installationszeilen stehen bei
[GitHub Releases](https://github.com/ACiDekCZ/strom-research/releases) (auf Englisch).

## 1.23.0

*In Vorbereitung: die Betas bis 1.23.0-beta.2. Der Abschnitt ist mit dem Release vollständig.*

- **Eine Person unter dem gewählten Namen.** Eine Frau, unter einem Namen geboren, unter einem anderen verheiratet und
  nach einer Scheidung wieder beim ersten, lässt sich wieder unter diesem Namen zeigen, ohne dass er ein zweites Mal
  hinzukommt: `strom name primary <Person> "<Name>"` (und `--clear`) oder `strom name add --primary`. Die Wahl trifft
  allein der Nutzer, nie wird sie aus einem Eintrag gelesen; Korrekturen, Zitate und der Abgleich mit der Strom-App
  richten sich weiter nach dem Geburtsnamen. Die Strom-Datei markiert den gewählten Namen, die Standard-GEDCOM-Datei
  setzt ihn an die erste Stelle.
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
  „nothing to repair“.

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
