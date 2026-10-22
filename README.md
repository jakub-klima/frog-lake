# Žabí jezero® – verze 2.2

Digitální verze rodinné deskové hry **Žabí jezero** pro **1–8 hráčů na jednom
zařízení** – jeden hráč proti počítačovým žábám, nebo více hráčů, kteří se u telefonu,
tabletu či počítače střídají. Pravidla jsou v `game rules.txt` (pro deskovou hru) a ve
hře pod klávesou **R**; obojí vzniká z jednoho zdroje `js/rules.js`.

**Hrát:** https://jakub-klima.github.io/frog-lake/ (GitHub Pages, verze z větve `main`)

## Spuštění

Stačí otevřít odkaz výše, nebo `index.html` v prohlížeči (funguje i přes `file://`,
bez instalace a bez internetu).

Hra na více zařízeních (přes Wi-Fi bez serveru a online přes `server.js`) je zatím
**vypnutá** – v menu se nenabízí. Kód zůstává v repozitáři (`js/room.js`, `js/net.js`,
`js/p2p.js`, `server.js`); znovu ji zapne `FL.NETWORK = true` (např. řádek
`<script>FL = { NETWORK: true }</script>` před ostatními skripty v `index.html`).

## Ovládání

Na začátku si každý hráč klikem na obrázek vybere **svou žábu** (avatara); ta pak
skáče po plánu a je i v tabulce skóre vedle jména. Skoky, cíle **vírů a trampolín**,
cíle kouzel i útoků se vybírají kliknutím (ťuknutím) na zvýrazněná pole.
**Veleskok** = klik na **zářící Kouzelný leknín** – rozzáří se, jakmile žába stojí
na velkém leknínu a má dost kreditů. Klávesy jsou ve hře vypsané v panelu *Klávesy*
a dají se i proklikat (na telefonu):

| Klávesa | Funkce |
|---|---|
| **Mezerník** | Akce – zastaví hru až na 10 s a otevře nabídku světlušek a kouzel (znovu = pokračovat) |
| **Enter** | Hodit kostkami / další hráč |
| **C** | Po doskoku na Kouzelný leknín: ostatní hrají dál o pořadí |
| **S** | Zvukové efekty zap/vyp |
| **M** | Podkladová hudba zap/vyp |
| **R** | Kompletní pravidla |
| **N** | Nová hra |
| **Q** | Opustit hru |
| **Esc** | Zavřít okno / zrušit rozehranou akci |

Po stisku mezerníku se v nabídce vybere hráč (v nabídce, v tabulce nebo kliknutím
na jeho žábu), pak *Zaútočit světluškou* (cíl se opět vybere v tabulce nebo na
plánu – vezme mu 1 kredit) nebo kouzlo ze seznamu jeho karet. Po dobu Akce hra
stojí (počítačové žáby nehrají, nikdo nehází ani neskáče) – nejdéle 10 sekund, nebo
dokud někdo akci neprovede či nabídku nezavře.

## Obrazovka hry

1. **Herní plán** – zvýrazněná pole ke kliknutí, šipky vírů a trampolín, zářící
   Kouzelný leknín. Pod plánem je informační panel: kdo je na tahu, co má udělat
   a hlášky o důležitých událostech („Kvákal získává kouzlo Štika!“).
2. **Tabulka skóre** – žába a jméno, kredity (s ukazatelem k ceně veleskoku), vážky,
   světlušky, mouchy a zda má hráč kouzlo. Pořadí: kredity → při shodě výš ten, kdo
   skóre dosáhl později → abecedně.
3. **Na jezeře** – zelená D10, černá a bílá D12 jako obrázky kostek s animací hodu
   a hláška, co se stalo („Na jezero přiletěla nová vážka!“, „Vodník Lojzík se
   vynořil z hlubin!“…), kam to dopadlo a kdo co získal.
4. **Klávesy** a **Kronika jezera** (zápis celé hry).

## Co je ve verzi 2 nového

**Opravy pravidel**
* Hmyz, který dopadne na pole se žábou, žába **okamžitě získá**.
* Hmyz, který dopadne na **Kouzelný leknín**, získá hráč, který hodil kostkami
  (při dvanáctce si ho tak hráč může „poslat“ sám sobě).
* **Bažina** je konečně na plánu – tmavé bažiny na břehu vedle Hub a STARTů
  (pozice 1, 5, 7, 11 každé strany). Kdo do něj skočí, příští tah nehází ani neskáče.
* Víry a trampolíny – cíl se vybírá kliknutím na zvýrazněné pole.
* Světluška – útok na libovolného hráče s kreditem (vezme mu 1 kredit), kdykoli.

**Fér a napínavá hra**
* Kdo začíná, určí kostka; starty se vybírají v opačném pořadí (začínající poslední).
* **Dohrávání na pořadí**: po každém doskoku na Kouzelný leknín se volí C (hrát dál
  o další místa), N (nová hra) nebo Q (opustit hru).
* Akce kdykoli kýmkoli – vedoucí žába se nikdy necítí v bezpečí.
* Volitelný **časový limit** – kdo se nerozhodne včas, za toho rozhodne „žabí
  intuice“ (stejná logika jako počítač). Online hraje autopilot i za odpojené hráče,
  takže hra nikdy nezamrzne.
* Počítačové žáby pro hru jednoho hráče nebo doplnění stolu (3 rychlosti).
* Ověřeno simulací (`npm test`): výhry jsou rozložené zhruba rovnoměrně mezi všechna
  místa u stolu a v žádné z 60 her po 8 žabách nestojí na konci tahu dvě žáby na
  jednom poli.

**Verze 2.1**
* Kvákrobatika: útočník po uskočení napadeného zůstane na uvolněném poli; na
  stejnou žábu nejde v jednom tahu skočit dvakrát a na konci tahu nikdy nestojí
  dvě žáby na jednom poli.
* Veleskok kliknutím na zářící Kouzelný leknín místo tlačítka.
* Dohrávání na pořadí (C / N / Q), medaile v tabulce i na plánu.
* Hlášky v panelu pod plánem (nezakrývají jezero); na Houbě hláška, jaké kouzlo
  hráč získal.
* Výběr vlastní žáby (avatara), její ikonka v tabulce skóre.
* Hra přes Wi-Fi bez serveru (WebRTC + QR kódy).
* Žabí štěstí je z nabídky odebrané (v enginu zůstává vypnuté, `luck: true` ho zapne).

**Zvuky** – syntetizované přímo v prohlížeči (hod, skok, hmyz, kouzla, voda, bažina,
vír, trampolína, Vodník, vítězství) a tichá podkladová hudba. Žádné zvukové soubory;
skutečné nahrávky lze doplnit v dalším kroku v `js/audio.js`.

**Verze 2.2**
* Menu jen pro hru na jednom zařízení (Wi-Fi a online dočasně vypnuté).
* Pole „Bahno“ přejmenované na **Bažina**.
* **Akce zastaví hru** až na 10 s (nebo do provedení akce / zavření nabídky),
  aby šlo v klidu použít světlušky a kouzla; na plánu je ⏸ a odpočet.
* Ve výsledcích se u žab v cíli ukazují **kredity těsně před veleskokem**.
* **Statistiky hry** pod výsledky po každém doskoku: počet kol, kolik přiletělo much,
  světlušek a vážek, kolikrát zasáhl Vodník; u každého hráče sebraná kouzla a hmyz,
  použitá kouzla a světlušky a uskákaná vzdálenost v polích (Vodníkův přenos ani
  návraty na START se nepočítají).
* **Kvákrobatika**: úskok i do vody (pak volba STARTu); pole, kam žába uskočí, platí
  jako po každém skoku – sebere hmyz, vír i trampolína ji přenesou, houba dá kouzlo,
  bažina zdrží.
* **Štika a Volavka** pošlou na START i sesílajícího, pokud stojí v oblasti.
* **Žabiják**: napadená žába nejdřív odevzdá 1 kredit, pak jde na START (pravidla
  i hláška to nově říkají výslovně).

## Struktura

```
index.html          – menu, online místnost, herní obrazovka
css/style.css       – vzhled (desktop, tablet, telefon)
js/data.js          – herní plán (typy polí, šipky) a 32 karet kouzel
js/texts.js         – všechny hlášky a nápovědy (snadno se ladí)
js/rules.js         – kompletní pravidla (zdroj pro hru i game rules.txt)
js/game.js          – herní engine; běží v prohlížeči i na serveru
js/ai.js            – počítačové žáby a autopilot (časový limit, odpojení)
js/audio.js         – zvukové efekty a hudba (Web Audio)
js/room.js          – herní místnost (lobby, avatary, hra) – sdílí ji server i Wi-Fi hostitel
js/net.js           – online klient (Server-Sent Events + POST)
js/p2p.js           – hra přes Wi-Fi bez serveru (WebRTC, pozvánky, QR kódy)
js/vendor/          – přibalené knihovny: qrcode-generator (MIT), jsQR (Apache 2.0)
js/ui.js            – vykreslení a ovládání
server.js           – online server bez závislostí (Node.js)
tools/selftest.js   – testy pravidel + simulace stovek her
tools/servertest.js – test online serveru
tools/export-rules.js – vygeneruje game rules.txt z js/rules.js
```

Engine má jediný vstup `apply(akce, hráč)` a jediný výstup `snapshot(hráč)` (čistý
JSON, cizí karty skryté). UI kreslí jen ze snímku, takže je stejné lokálně i online.

## Rozhodnutí, která je dobré potvrdit

1. **Vodník Lojzík** je událost hodu – hráč se po teleportu ještě normálně pohne.
2. **Bažina**: kdo do ní zapadne ještě před svým skokem (po Vodníkovi), přijde
   i o zbytek tahu – a vynechá i tah příští.
3. **Útok světluškou** bere 1 kredit (napadený odevzdá hmyz za 1 kredit, vážku si
   rozmění); útočník dostane mouchu z banku. Helma proti světlušce nechrání.
4. **Skok na hlavu** – každého hráče lze skočit nejvýše jednou za tah. Pole s žábou,
   na kterou se už v tahu skákalo, není nabídnuté ke skoku, sklouznutí, víru ani
   trampolíně. Když napadený uskočí Kvákrobatikou nebo ho Žabiják pošle na START,
   útočník na uvolněném poli zůstane a vyhodnotí se jeho účinek.
5. **Žába v cíli** už do hry nezasahuje (nehraje, nelze na ni útočit, nekouzlí).
   Při hře na více zařízeních (zatím vypnuté) rozhoduje o pokračování jen hostitel.
6. **Vážka ↔ mouchy** se mění 1 : 2. Volavka a Štika zasáhnou i sesílajícího, pokud
   stojí v zasažené oblasti (může se chránit Bublinou).
7. **Dvanáctka** na D12 dovoluje vybrat i Kouzelný leknín nebo vlastní pole – hmyz pak
   získá sám házející. Je to šťastný hod; kdyby to bylo moc silné, stačí ve
   `rollDice` z volby vyřadit 6-6.
8. **Houba** – název získaného kouzla vidí všichni (i v deskové hře se oznamuje nahlas).
   Karta v ruce zůstává skrytá; ukradenou kartu (Černá magie) hra neprozrazuje.

## Co dál

* Skutečné nahrané zvuky a hudba místo syntetizovaných.
* Nasazení serveru na veřejnou adresu a instalace jako aplikace (PWA).
* Týmová hra, statistiky hráčů, chat/emoji reakce v online místnosti.
