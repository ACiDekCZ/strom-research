<a id="S5"></a>
# S5 Telefon

Jak se telefon spojí s výzkumem na počítači, co na něm jde vidět a dělat a kdy spojení nejde. Popisuje aplikaci
Strom 3.21.2 a výzkum 1.25.2; změny z novější verze mají u sebe její číslo.
Telefon neotevírá aplikaci Strom: otevře stránku **Výzkum Strom**, kterou posílá výzkum z počítače v domácí síti.

<a id="S5.1"></a>
## S5.1 Propojení s telefonem patří počítači a zapíná ho jen člověk

Propojení s telefonem je jedno pro celý počítač, ne pro jeden strom. Zapnout ho smí jen člověk, a to potvrzením
v okně na počítači. Vypnout ho jde kdykoli; spárované telefony po vypnutí zůstanou spárované a po zapnutí se zase
připojí.

- **Hranice:** stránku pro telefon posílá výzkum, ne aplikace. Bez běžícího výzkumu
  ([S1](S1-connecting-app-and-research.md))
  telefon nic nevidí. Okno „Zapnout propojení s telefonem?“ se na počítači ukáže samo; bez odpovědi do 5 minut nebo
  po **Zrušit** zůstane propojení vypnuté. Agent propojení nezapne, smí ho jen vypnout. Kde výzkum okno ukázat nemůže
  (počítač bez grafického prostředí), zapíná se v terminálu.
- **Ovládání:** aplikace: **Výzkum → Další → Připojit telefon…** → **Zapnout propojení** → na počítači okno
  „Zapnout propojení s telefonem?“ → **Zapnout**; **Vypnout propojení** ve stejném dialogu · terminál: `strom phone
  on`
  (Enter znamená ne), `strom phone off`, `strom phone` (stav); menu **Nastavení → Propojení s telefonem**.
  Když je propojení zapnuté, má tlačítko **Výzkum** tečku a položka v menu se jmenuje **Telefon** se štítkem
  **zapnuto · 2** (počet spárovaných telefonů).
- **Platí od:** výzkum 1.18.0, aplikace 3.14.0

<!-- zdroj: research:src/core/phone.ts askPhoneOn, phoneOff, phoneState · src/core/dialog.ts WAIT_SECONDS · src/commands/phone.ts · src/cli/menu-settings.ts:79 · app:src/ui/phone-ui.ts:150 phoneAvailable, :731, :918 phoneMenuItem · src/ui/research-actions-ui.ts:365, :460 · strings.ts phone.menuConnect, phone.menuOn, phone.statusKeep -->

<a id="S5.2"></a>
## S5.2 Telefon se spáruje QR kódem z počítače

Telefon se připojí načtením QR kódu, který ukáže dialog **Připojit telefon** (nebo terminál). Kód platí 10 minut
a pro jeden telefon. Spárovaný telefon si pak výzkum pamatuje a stránka se otevírá bez nového kódu.

- **Hranice:** telefon musí být ve stejné místní síti jako počítač ([S5.5](#S5.5)). Kód se v adrese stránky na počítač
  neposílá a po spárování přestane platit; v dialogu je pak **Nový kód**. Spárování platí 400 dní. Jméno telefonu
  v seznamu se odvodí z prohlížeče, např. „iPhone (Safari)“. Po spárování se na telefonu otevře strom, ke kterému byl
  kód ukázaný naposledy. Stránka mluví jazykem, který měla aplikace při ukázání kódu.
  Počítač s více sítěmi (Wi-Fi i kabel) nabídne kód pro každou z nich (**Jiná síť: …**).
- **Ovládání:** aplikace: v dialogu **Připojit telefon** QR kód s textem **Kód platí ještě … a pro jeden telefon.**;
  po načtení **Spárováno: iPhone (Safari)** a **Připojit další telefon** · telefon: fotoaparát (iPhone) nebo
  fotoaparát či Google Lens (Android) · terminál: `strom phone qr` (jen v terminálu člověka, ne agentovi).
  Na stránce **Ikona na ploše** přidá ikonu, která stránku otevře bez párování; přidat ji jde do 10 minut od
  spárování.
- **Platí od:** výzkum 1.18.0, aplikace 3.14.0

<!-- zdroj: research:src/core/phone.ts PAIR_MS, PHONE_KEY_DAYS, HOME_MS, pairCode, pairPhone, pageLang, phoneName · src/commands/phone.ts qr · app:src/ui/phone-ui.ts · strings.ts phone.qrValid, phone.qrOther, phone.paired, phone.qrExpiredHint -->

<a id="S5.3"></a>
## S5.3 Stránka telefonu ukazuje výzkum jen ke čtení

Stránka **Výzkum Strom** ukazuje stav výzkumu jednoho stromu, ale nic v něm nerozhoduje ani nespouští.
Pořadí částí: **Teď** (zda a od kdy se pracuje), **Nálezy**, **Posledních 24 h** (osoby, prameny, uložení),
**Průběh** (poslední změny) a nakonec **Co čeká**.

- **Hranice:** odpovídat na položky v **Co čeká** jde jen na počítači („Rozhodnout jde na počítači v Přehledu
  výzkumu.“,
  [R6](R6-awaiting-action.md), [S4](S4-research-from-the-app.md)). Stránka neukazuje cesty k souborům,
  čísla záznamů, útratu ani model agenta. **Nálezy** jsou jen to, co o rodině zapsal agent (nová osoba, rodina, jméno,
  dítě, nalezený, opravený nebo nově doložený údaj, nový pramen, vyřešený rozpor, rozhodnutá otázka), ne úpravy
  člověka
  ([S2](S2-edits-from-the-app.md)); standardně za posledních 24 h, starší až 31 dní zpět. **Průběh** ukazuje nejvýš
  20 změn, **Co čeká** 20 položek s nabídkou dalších; zbytek je v **Přehledu výzkumu** na počítači.
  U Archivu Stromu (strom bez agenta) stránka práci agenta neukazuje.
- **Ovládání:** telefon: přepínač **Stromy výzkumu na tomto počítači** (všechny stromy s výzkumem na tomto počítači,
  archiv se značkou **archiv**); stránka se sama obnovuje každých 10 s, dokud je vidět.
- **Platí od:** výzkum 1.18.0; Archiv Stromu 1.20.0; stránka v polštině 1.25.0

<!-- zdroj: research:src/core/phone-send.ts state, log LOG_PHONE, waiting WAITING_SHOWN · src/core/phone-finds.ts FINDS_BACK_DAYS · src/core/phone-watch.ts · assets/phone/phone.js (v1.25.2) · assets/lang/cs.json ui.phone.page.* -->

<a id="S5.3.1"></a>
### S5.3.1 Linie z telefonu

Ve výzkumu 1.26.0 má stránka kartu **Linie · v pořadí práce**. Z ní jde linii posunout výš nebo níž a pozastavit
či znovu spustit, stejně jako na počítači ([R2](R2-lines-and-queue.md)).

- **Hranice:** linie se po klepnutí rozbalí. U Archivu Stromu výzkum změnu linie odmítne. Odpovídat na **Co čeká**
  pořád jde jen na počítači.
- **Ovládání:** telefon: **Posunout výš**, **Posunout níž**, **Pozastavit**, **Znovu spustit**.
- **Platí od:** výzkum 1.26.0

<!-- zdroj: research:HEAD src/core/phone-send.ts POST /phone/line/<key> · assets/lang/cs.json ui.phone.page.lines.* · CHANGELOG 1.26.0 -->

<a id="S5.4"></a>
## S5.4 Fotky z telefonu jdou do výzkumu po dávkách

Fotky dokumentů z telefonu (vyfocené na stránce nebo vybrané z galerie) se posílají do výzkumu zvoleného stromu
jako jedna dávka. K dávce jde připsat poznámku a osobu. **Předat výzkumu** dávku uzavře a výzkum z ní udělá
úkoly k roztřídění, stejně jako u **Přidat materiály** ([S4](S4-research-from-the-app.md)).

- **Hranice:** fotky se ukládají beze změny, v plném rozlišení a mimo historii stromu. Soubor, který výzkum už má,
  se znovu neposílá („už ve výzkumu je, neposílá se“). Jedna fotka smí mít nejvýš 500 MB. Kde počítač neumí převést
  formát HEIC, přijme stránka jen JPEG. Dávka, kterou nikdo nepředá, se předá sama hodinu po poslední fotce.
  Fotky vyfocené na stránce se do galerie telefonu neukládají. Neodeslané fotky čekají v telefonu a odešlou se samy
  po obnovení spojení; po týdnu bez otevření stránky je prohlížeč může smazat.
  U Archivu Stromu se fotky ukládají do archivu na počítači.
- **Ovládání:** telefon: **Vyfotit**, **Z galerie** → **Fotky k odeslání** → poznámka a osoba (od 2 písmen, nejvýš
  8 návrhů) → **Hotovo** → **Předat výzkumu** (u archivu **Uložit do Archivu Stromu**); **Zrušit předání**, **Další
  dávka**;
  u neodeslaných fotek **Uložit do telefonu**, **Zahodit**.
- **Platí od:** výzkum 1.18.0; **Uložit do Archivu Stromu** 1.20.0

<!-- zdroj: research:src/core/phone-send.ts media, batch/<id>/done, originalMax · src/core/batches.ts PHONE_BATCH_IDLE_MS, batch.why.phone · assets/phone/phone.js · assets/lang/cs.json ui.phone.page.commit*, keep.*, st.already, offline.queue -->

<a id="S5.5"></a>
## S5.5 Kdy se telefon nespojí

Telefon dosáhne na počítač jen ve stejné místní síti, přes soukromou adresu počítače na Wi-Fi nebo kabelu,
a jen když výzkum na počítači běží. Jiná zařízení ani sám počítač stránku nedostanou.

- **Hranice:**
  - jiná síť: hostovská Wi-Fi, mobilní data, VPN nebo virtuální síť nestačí; počítač bez místní sítě hlásí
    „Počítač teď není v žádné místní síti.“ a propojení naběhne samo po připojení k Wi-Fi;
  - firewall: Windows chce v okně pro `node.exe` zaškrtnout **Soukromé sítě** a **Povolit přístup**, síť musí mít typ
    Soukromá, ne Veřejná; Mac může chtít **Povolit**; v Linuxu musí firewall povolit port propojení;
  - port: výzkum zkouší porty 47800–47819; když jsou obsazené, hlásí „Port … používá jiný program.“;
  - změna adresy počítače: dřív spárované telefony a záložky přestanou platit, telefon se musí spárovat znovu
    (žlutý pruh **Adresa počítače se změnila na …** s tlačítkem **Nový QR**); pomůže adresu rezervovat v routeru;
  - výzkum neběží: dialog ukáže „Telefon se připojuje přes běžící výzkum.“ a propojení se obnoví samo s výzkumem;
  - výzkum starší než 1.18.0: „Tato verze výzkumu telefon nepřipojuje.“;
  - počítač spí nebo je vypnutý: po dvou neúspěšných obnoveních ukáže stránka „Počítač teď neodpovídá“ s posledními
    údaji a jejich časem; spojení se zkouší obnovit samo.
- **Ovládání:** aplikace: když se telefon do minuty po ukázání kódu neozve, dialog nabídne seznam
  **Telefon se zatím neozval. Zkontrolovat:** s odkazem **Jak na to**; při chybě se položka **Telefon** se štítkem
  **chyba propojení** ukáže přímo v menu **Výzkum**. Dialog nabízí telefon jen na počítači s myší, ne v Safari
  a jen u stromu s výzkumem. Sledování výzkumu ([S4](S4-research-from-the-app.md)) otevřené odkazem na telefonu
  ukáže „Výzkum běží na počítači“.
- **Platí od:** výzkum 1.18.0, aplikace 3.14.0; obnovení s výzkumem po restartu výzkum 1.19.0

<!-- zdroj: research:src/core/phone.ts lanAddresses, remoteAllowed, PHONE_PORT, PORT_TRIES, revivePhone · assets/phone/phone.js S.fails · app:src/phone.ts:235 PHONE_SILENT_MS, :286 phoneAddressChanged · src/ui/phone-ui.ts:150 · src/ui/research-ui.ts:1514 · strings.ts phone.err*, phone.check*, phone.down*, phone.older, phone.addr* -->

<a id="S5.6"></a>
## S5.6 Odpojený telefon už nic neuvidí

Odpojení vezme jednomu telefonu přístup. Vypnutí propojení zastaví stránku pro všechny telefony, ale spárování nechá.

- **Hranice:** **Odpojit** jde vrátit jen 15 s (**Vrátit**); pak se telefon musí spárovat znovu. Odpojený telefon
  na stránce uvidí „Telefon není spárovaný s tímto počítačem“; neodeslané fotky v něm zůstanou a odešlou se po novém
  spárování. Po změně adresy počítače nabídne dialog u nového spárování **Odpojit starý** záznam téhož telefonu.
- **Ovládání:** aplikace: **Připojit telefon** → **Spárované telefony · 2** → **Odpojit** / **Vrátit** · terminál:
  `strom phone list`, `strom phone remove …`; menu **Nastavení → Propojení s telefonem**.
- **Platí od:** výzkum 1.18.0, aplikace 3.14.0

<!-- zdroj: research:src/core/phone.ts phoneEntries stale, maybeReplaces · src/core/live.ts (v1.25.2):3755-3857 phone/remove, phone/restore PHONE_RESTORE_MS · src/commands/phone.ts · app:src/ui/phone-ui.ts UNDO_MS · strings.ts phone.rowUnpair, phone.rowUndo, phone.replacesBtn -->

<a id="S5.7"></a>
## S5.7 Aplikace Strom v telefonu výzkum neřídí

Aplikace Strom otevřená v telefonu nebo tabletu se k výzkumu na počítači nepřipojí. Posílat do výzkumu úpravy
a jeho další akce jdou jen na počítači, kde výzkum běží; na telefon patří stránka **Výzkum Strom** ([S5.3](#S5.3)).

- **Hranice:** u stromu, který už svůj výzkum má, ukáže **Výzkum předků** v telefonu jen vysvětlení: úpravy udělané
  v telefonu zůstávají v tomto prohlížeči a do výzkumu se dostanou otevřením stromu na počítači výzkumu (po exportu
  do souboru). Odkaz na sledování výzkumu otevřený v telefonu ukáže „Výzkum běží na počítači“
  ([S4](S4-research-from-the-app.md)).
  **Připojit telefon…** se v telefonu nenabízí.
- **Ovládání:** aplikace v telefonu: **Více → Strom → Výzkum předků**.
- **Platí od:** aplikace 3.9.0; odkaz na sledování v telefonu 3.12.0
- **Od aplikace 3.22.0:** linie ([R2](R2-lines-and-queue.md)) ukáže aplikace v telefonu jen ke čtení s větou
  „Linie jde měnit
  ve Stromu na počítači, kde běží výzkum.“; klepnutí ukáže linii ve stromu.

<!-- zdroj: app:src/ui/tree-actions.ts:257 treeResearchRow · src/ui/research-promo-ui.ts:272 showResearchInfoDialog · src/ui/research-ui.ts:1514 onPhone · src/ui/phone-ui.ts:150 phoneAvailable · strings.ts:9864 research.phoneHasResearch, :9423 connect.reasonPhoneLive · HEAD src/ui/research-directions-ui.ts dirPhoneOnly (fa73007) -->
