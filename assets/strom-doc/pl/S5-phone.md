<a id="S5"></a>
# S5 Telefon

Jak telefon łączy się z badaniem na komputerze, co można na nim zobaczyć i zrobić i kiedy połączenie nie działa.
Opisuje aplikację Strom 3.21.2 i badanie 1.25.2; zmiany z nowszej wersji mają przy sobie jej numer.
Telefon nie otwiera aplikacji Strom: otwiera stronę **Badania Strom**, którą wysyła badanie z komputera w sieci
domowej.

<a id="S5.1"></a>
## S5.1 Połączenie z telefonem należy do komputera i włącza je tylko człowiek

Połączenie z telefonem jest jedno dla całego komputera, nie dla jednego drzewa. Włączyć je może tylko człowiek,
potwierdzeniem w oknie na komputerze. Wyłączyć je można w każdej chwili; sparowane telefony po wyłączeniu zostają
sparowane, a po włączeniu znów się łączą.

- **Granice:** stronę dla telefonu wysyła badanie, nie aplikacja. Bez działającego badania
  ([S1](S1-connecting-app-and-research.md)) telefon nic nie widzi. Okno „Włączyć połączenie z telefonem?” pokazuje się
  na komputerze samo; bez odpowiedzi w ciągu 5 minut lub po **Anuluj** połączenie zostaje wyłączone. Agent połączenia
  nie włączy, może je tylko wyłączyć. Gdzie badanie nie może pokazać okna (komputer bez środowiska graficznego),
  włącza się je w terminalu.
- **Obsługa:** aplikacja: **Badanie → Więcej → Połącz telefon…** → **Włącz połączenie** → na komputerze okno
  „Włączyć połączenie z telefonem?” → **Włącz**; **Wyłącz połączenie** w tym samym oknie · terminal:
  `strom phone on` (Enter oznacza nie), `strom phone off`, `strom phone` (stan); menu **Ustawienia → Połączenie
  z telefonem**.
  Gdy połączenie jest włączone, przycisk **Badanie** ma kropkę, a pozycja w menu nazywa się **Telefon** z etykietą
  **włączone · 2** (liczba sparowanych telefonów).
- **Obowiązuje od:** badanie 1.18.0, aplikacja 3.14.0

<!-- zdroj: research:src/core/phone.ts askPhoneOn, phoneOff, phoneState · src/core/dialog.ts WAIT_SECONDS · src/commands/phone.ts · src/cli/menu-settings.ts:79 · app:src/ui/phone-ui.ts:150 phoneAvailable, :731, :918 phoneMenuItem · src/ui/research-actions-ui.ts:365, :460 · strings.ts phone.menuConnect, phone.menuOn, phone.statusKeep -->

<a id="S5.2"></a>
## S5.2 Telefon paruje się kodem QR z komputera

Telefon łączy się przez zeskanowanie kodu QR, który pokazuje okno **Połącz telefon** (albo terminal). Kod jest ważny
10 minut i dla jednego telefonu. Sparowany telefon badanie potem pamięta, a strona otwiera się bez nowego kodu.

- **Granice:** telefon musi być w tej samej sieci lokalnej co komputer ([S5.5](#S5.5)). Kod w adresie strony nie jest
  wysyłany do komputera i po sparowaniu przestaje być ważny; w oknie jest wtedy **Nowy kod**. Sparowanie jest ważne
  400 dni. Nazwa telefonu na liście wynika z przeglądarki, np. „iPhone (Safari)”. Po sparowaniu na telefonie otwiera
  się drzewo, do którego kod był pokazany ostatnio. Strona mówi językiem, który miała aplikacja przy pokazaniu kodu.
  Komputer z kilkoma sieciami (Wi-Fi i kabel) proponuje kod dla każdej z nich (**Inna sieć: …**).
- **Obsługa:** aplikacja: w oknie **Połącz telefon** kod QR z tekstem **Kod jest ważny jeszcze przez … i dla jednego
  telefonu.**; po zeskanowaniu **Sparowano: iPhone (Safari)** i **Połącz kolejny telefon** · telefon: aparat (iPhone)
  albo aparat lub Google Lens (Android) · terminal: `strom phone qr` (tylko w terminalu człowieka, nie agentowi).
  Na stronie **Ikona na ekranie początkowym** dodaje ikonę, która otwiera stronę bez parowania; dodać ją można do 10
  minut od sparowania.
- **Obowiązuje od:** badanie 1.18.0, aplikacja 3.14.0

<!-- zdroj: research:src/core/phone.ts PAIR_MS, PHONE_KEY_DAYS, HOME_MS, pairCode, pairPhone, pageLang, phoneName · src/commands/phone.ts qr · app:src/ui/phone-ui.ts · strings.ts phone.qrValid, phone.qrOther, phone.paired, phone.qrExpiredHint -->

<a id="S5.3"></a>
## S5.3 Strona telefonu pokazuje badanie tylko do odczytu

Strona **Badania Strom** pokazuje stan badania jednego drzewa, ale nic w nim nie rozstrzyga ani nie uruchamia.
Kolejność części: **Teraz** (czy i od kiedy trwa praca), **Ustalenia**, **Ostatnie 24 h** (osoby, źródła, zapisy),
**Przebieg** (ostatnie zmiany) i na końcu **Co czeka**.

- **Granice:** odpowiadać na pozycje w **Co czeka** można tylko na komputerze („Decyzje podejmuje się na komputerze
  w Przeglądzie badania.”, [R6](R6-awaiting-action.md), [S4](S4-research-from-the-app.md)). Strona nie pokazuje
  ścieżek do plików, numerów rekordów, wydatków ani modelu agenta. **Ustalenia** to tylko to, co o rodzinie zapisał
  agent (nowa osoba, rodzina, imię i nazwisko, dziecko, znaleziona, poprawiona lub nowo udokumentowana dana, nowe
  źródło, rozwiązana sprzeczność, rozstrzygnięte pytanie), nie zmiany człowieka ([S2](S2-edits-from-the-app.md));
  standardowo za ostatnie 24 h, starsze do 31 dni wstecz. **Przebieg** pokazuje najwyżej 20 zmian, **Co czeka** 20
  pozycji z propozycją kolejnych; reszta jest w **Przeglądzie badania** na komputerze.
  Przy Archiwum Strom (drzewo bez agenta) strona nie pokazuje pracy agenta.
- **Obsługa:** telefon: przełącznik **Drzewa badań na tym komputerze** (wszystkie drzewa z badaniem na tym
  komputerze, archiwum z oznaczeniem **archiwum**); strona odświeża się sama co 10 s, dopóki jest widoczna.
- **Obowiązuje od:** badanie 1.18.0; Archiwum Strom 1.20.0; strona po polsku 1.25.0

<!-- zdroj: research:src/core/phone-send.ts state, log LOG_PHONE, waiting WAITING_SHOWN · src/core/phone-finds.ts FINDS_BACK_DAYS · src/core/phone-watch.ts · assets/phone/phone.js (v1.25.2) · assets/lang/cs.json ui.phone.page.* -->

<a id="S5.3.1"></a>
### S5.3.1 Linie z telefonu

W badaniu 1.26.0 strona ma kartę **Linie · w kolejności pracy**. Z niej można linię przesunąć wyżej lub niżej
i wstrzymać lub wznowić, tak samo jak na komputerze ([R2](R2-lines-and-queue.md)).

- **Granice:** linia rozwija się po stuknięciu. Przy Archiwum Strom badanie odrzuca zmianę linii. Odpowiadać na **Co
  czeka** nadal można tylko na komputerze.
- **Obsługa:** telefon: **Przesunąć wyżej**, **Przesunąć niżej**, **Wstrzymać**, **Wznowić**.
- **Obowiązuje od:** badanie 1.26.0

<!-- zdroj: research:HEAD src/core/phone-send.ts POST /phone/line/<key> · assets/lang/cs.json ui.phone.page.lines.* · CHANGELOG 1.26.0 -->

<a id="S5.4"></a>
## S5.4 Zdjęcia z telefonu idą do badania partiami

Zdjęcia dokumentów z telefonu (zrobione na stronie lub wybrane z galerii) wysyła się do badania wybranego drzewa
jako jedną partię. Do partii można dopisać notatkę i osobę. **Przekaż do badania** zamyka partię, a badanie robi
z niej zadania do posortowania, tak samo jak przy **Dodaj materiały…** ([S4](S4-research-from-the-app.md)).

- **Granice:** zdjęcia zapisują się bez zmian, w pełnej rozdzielczości i poza historią drzewa. Pliku, który badanie
  już ma, nie wysyła się ponownie („już jest w badaniu, nie jest wysyłane”). Jedno zdjęcie może mieć najwyżej
  500 MB. Gdzie komputer nie potrafi przekształcić formatu HEIC, strona przyjmuje tylko JPEG. Partia, której nikt nie
  przekaże, przekazuje się sama godzinę po ostatnim zdjęciu.
  Zdjęcia zrobione na stronie nie zapisują się w galerii telefonu. Niewysłane zdjęcia czekają w telefonie i wysyłają
  się same po przywróceniu połączenia; po tygodniu bez otwarcia strony przeglądarka może je usunąć.
  Przy Archiwum Strom zdjęcia zapisują się w archiwum na komputerze.
- **Obsługa:** telefon: **Zrób zdjęcie**, **Z galerii** → **Zdjęcia do wysłania** → notatka i osoba (od 2 liter,
  najwyżej 8 propozycji) → **Gotowe** → **Przekaż do badania** (przy archiwum **Zapisz w Archiwum Strom**);
  **Anuluj przekazanie**, **Następna partia**;
  przy niewysłanych zdjęciach **Zachowaj w telefonie**, **Odrzuć**.
- **Obowiązuje od:** badanie 1.18.0; **Zapisz w Archiwum Strom** 1.20.0

<!-- zdroj: research:src/core/phone-send.ts media, batch/<id>/done, originalMax · src/core/batches.ts PHONE_BATCH_IDLE_MS, batch.why.phone · assets/phone/phone.js · assets/lang/cs.json ui.phone.page.commit*, keep.*, st.already, offline.queue -->

<a id="S5.5"></a>
## S5.5 Kiedy telefon się nie połączy

Telefon dociera do komputera tylko w tej samej sieci lokalnej, przez prywatny adres komputera w Wi-Fi lub kablu,
i tylko gdy badanie na komputerze działa. Inne urządzenia ani sam komputer strony nie dostaną.

- **Granice:**
  - inna sieć: Wi-Fi dla gości, dane komórkowe, VPN lub sieć wirtualna nie wystarczą; komputer bez sieci lokalnej
    zgłasza „Komputer nie jest teraz w żadnej sieci lokalnej.”, a połączenie uruchamia się samo po podłączeniu do
    Wi-Fi;
  - zapora: Windows w oknie dla `node.exe` wymaga zaznaczenia **Sieci prywatne** i **Zezwalaj na dostęp**, sieć musi
    mieć typ Prywatna, nie Publiczna; Mac może wymagać **Pozwól**; w Linuksie zapora musi zezwalać na port
    połączenia;
  - port: badanie próbuje portów 47800–47819; gdy są zajęte, zgłasza „Port … jest używany przez inny program.”;
  - zmiana adresu komputera: wcześniej sparowane telefony i zakładki przestają być ważne, telefon trzeba sparować
    ponownie (żółty pasek **Adres komputera zmienił się na …** z przyciskiem **Nowy QR**); pomaga zarezerwowanie
    adresu w routerze;
  - badanie nie działa: okno pokazuje „Telefon łączy się przez działające badanie.”, a połączenie przywraca się samo
    z badaniem;
  - badanie starsze niż 1.18.0: „Ta wersja badania nie łączy telefonu.”;
  - komputer śpi lub jest wyłączony: po dwóch nieudanych odświeżeniach strona pokazuje „Komputer teraz nie
    odpowiada” z ostatnimi danymi i ich czasem; połączenie próbuje się przywrócić samo.
- **Obsługa:** aplikacja: gdy telefon nie odezwie się w ciągu minuty od pokazania kodu, okno proponuje listę
  **Telefon jeszcze się nie odezwał. Do sprawdzenia:** z linkiem **Jak to zrobić**; przy błędzie pozycja
  **Telefon** z etykietą **błąd połączenia** pokazuje się bezpośrednio w menu **Badanie**. Okno proponuje telefon
  tylko na komputerze z myszą, nie w Safari i tylko przy drzewie z badaniem. Śledzenie badania
  ([S4](S4-research-from-the-app.md)) otwarte linkiem na telefonie pokazuje „Badanie działa na komputerze”.
- **Obowiązuje od:** badanie 1.18.0, aplikacja 3.14.0; przywracanie z badaniem po restarcie badanie 1.19.0

<!-- zdroj: research:src/core/phone.ts lanAddresses, remoteAllowed, PHONE_PORT, PORT_TRIES, revivePhone · assets/phone/phone.js S.fails · app:src/phone.ts:235 PHONE_SILENT_MS, :286 phoneAddressChanged · src/ui/phone-ui.ts:150 · src/ui/research-ui.ts:1514 · strings.ts phone.err*, phone.check*, phone.down*, phone.older, phone.addr* -->

<a id="S5.6"></a>
## S5.6 Odłączony telefon już nic nie zobaczy

Odłączenie odbiera dostęp jednemu telefonowi. Wyłączenie połączenia zatrzymuje stronę dla wszystkich telefonów, ale
sparowanie zostawia.

- **Granice:** **Odłącz** można cofnąć tylko przez 15 s (**Cofnij**); potem telefon trzeba sparować ponownie.
  Odłączony telefon zobaczy na stronie „Telefon nie jest sparowany z tym komputerem”; niewysłane zdjęcia zostają
  w nim i wyślą się po nowym sparowaniu. Po zmianie adresu komputera okno przy nowym sparowaniu proponuje **Odłącz
  stary** wpis tego samego telefonu.
- **Obsługa:** aplikacja: **Połącz telefon** → **Sparowane telefony · 2** → **Odłącz** / **Cofnij** · terminal:
  `strom phone list`, `strom phone remove …`; menu **Ustawienia → Połączenie z telefonem**.
- **Obowiązuje od:** badanie 1.18.0, aplikacja 3.14.0

<!-- zdroj: research:src/core/phone.ts phoneEntries stale, maybeReplaces · src/core/live.ts (v1.25.2):3755-3857 phone/remove, phone/restore PHONE_RESTORE_MS · src/commands/phone.ts · app:src/ui/phone-ui.ts UNDO_MS · strings.ts phone.rowUnpair, phone.rowUndo, phone.replacesBtn -->

<a id="S5.7"></a>
## S5.7 Aplikacja Strom w telefonie nie steruje badaniem

Aplikacja Strom otwarta w telefonie lub tablecie nie łączy się z badaniem na komputerze. Wysyłanie zmian do badania
i jego pozostałe działania są możliwe tylko na komputerze, na którym działa badanie; do telefonu należy strona
**Badania Strom** ([S5.3](#S5.3)).

- **Granice:** przy drzewie, które ma już swoje badanie, **Badanie przodków** w telefonie pokazuje tylko wyjaśnienie:
  zmiany zrobione w telefonie zostają w tej przeglądarce, a do badania trafiają przez otwarcie drzewa na komputerze
  badania (po eksporcie do pliku). Link do śledzenia badania otwarty w telefonie pokazuje „Badanie działa na
  komputerze” ([S4](S4-research-from-the-app.md)).
  **Połącz telefon…** w telefonie nie jest proponowane.
- **Obsługa:** aplikacja w telefonie: **Więcej → Drzewo → Badanie przodków**.
- **Obowiązuje od:** aplikacja 3.9.0; link do śledzenia w telefonie 3.12.0
- **Od aplikacji 3.22.0:** linie ([R2](R2-lines-and-queue.md)) aplikacja w telefonie pokazuje tylko do odczytu ze
  zdaniem „Linie można zmieniać w Stromie na komputerze, na którym działa badanie.”; stuknięcie pokazuje linię
  w drzewie.

<!-- zdroj: app:src/ui/tree-actions.ts:257 treeResearchRow · src/ui/research-promo-ui.ts:272 showResearchInfoDialog · src/ui/research-ui.ts:1514 onPhone · src/ui/phone-ui.ts:150 phoneAvailable · strings.ts:9864 research.phoneHasResearch, :9423 connect.reasonPhoneLive · HEAD src/ui/research-directions-ui.ts dirPhoneOnly (fa73007) -->
