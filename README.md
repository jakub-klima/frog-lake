# Žabí jezero® – verze 2

Digitální verze rodinné deskové hry **Žabí jezero** pro **1–8 hráčů**: na jednom
zařízení (s počítačovými žábami i bez nich) i **online** – každý na svém telefonu,
tabletu nebo počítači. Pravidla jsou v `game rules.txt` (pro deskovou hru) a ve hře
pod klávesou **R**; obojí vzniká z jednoho zdroje `js/rules.js`.

## Spuštění

**Hra na jednom zařízení** – stačí otevřít `index.html` v prohlížeči (funguje i přes
`file://`, bez instalace a bez internetu).

**Online hra** – potřebuje jen [Node.js 18+](https://nodejs.org), žádné další balíčky:

```
node server.js          # nebo: npm start
# 🐸 Žabí jezero běží na http://localhost:8080
#    ve stejné síti (telefon, tablet): http://192.168.x.x:8080
```

Na adrese z výpisu klikni na **Online s přáteli → Založit novou místnost** a pošli
ostatním odkaz nebo pětimístný kód. Hostitel může volná místa doplnit počítači,
nastavit cenu veleskoku, časový limit a Žabí štěstí a spustí hru.

Pro hraní přes internet stačí `server.js` nasadit na libovolný hosting s Node.js
(Render, Railway, Fly.io, VPS…); port se bere z proměnné `PORT`. Statický hosting
(např. GitHub Pages) zvládne jen hru na jednom zařízení.

## Ovládání

Skoky, cíle **vírů a trampolín**, cíle kouzel i útoků se vybírají kliknutím
(ťuknutím) na zvýrazněná pole. Klávesy jsou ve hře vypsané v panelu *Klávesy*
a dají se i proklikat (na telefonu):

| Klávesa | Funkce |
|---|---|
| **Mezerník** | Akce – kdokoli kdykoli použije světlušku nebo kouzlo (zap/vyp nabídky) |
| **Enter** | Hodit kostkami / veleskok / další hráč |
| **S** | Zvukové efekty zap/vyp |
| **M** | Podkladová hudba zap/vyp |
| **R** | Kompletní pravidla |
| **N** | Nová hra |
| **Q** | Ukončit hru |
| **Esc** | Zavřít okno / zrušit rozehranou akci |

Po stisku mezerníku se v nabídce vybere hráč (v nabídce, v tabulce nebo kliknutím
na jeho žábu), pak *Zaútočit světluškou* (cíl se opět vybere v tabulce nebo na
plánu – vezme mu 1 kredit) nebo kouzlo ze seznamu jeho karet. Online hraje každý
jen za sebe a cizí karty nevidí.

## Obrazovka hry

1. **Herní plán** – zvýrazněná pole ke kliknutí, šipky vírů a trampolín, hlášky
   o důležitých událostech přímo nad jezerem.
2. **Tabulka skóre** – jméno, kredity (s ukazatelem k ceně veleskoku), vážky,
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
* **Bahno** je konečně na plánu – tmavé bažiny na břehu vedle Hub a STARTů
  (pozice 1, 5, 7, 11 každé strany). Kdo do něj skočí, příští tah nehází ani neskáče.
* Víry a trampolíny – cíl se vybírá kliknutím na zvýrazněné pole.
* Světluška – útok na libovolného hráče s kreditem (vezme mu 1 kredit), kdykoli.

**Fér a napínavá hra**
* Kdo začíná, určí kostka; starty se vybírají v opačném pořadí (začínající poslední).
* **Žabí štěstí** (lze vypnout): kdo zaostává o 5+ kreditů za vedoucím, dostane na
  začátku tahu mouchu z banku.
* Akce kdykoli kýmkoli – vedoucí žába se nikdy necítí v bezpečí.
* Volitelný **časový limit** – kdo se nerozhodne včas, za toho rozhodne „žabí
  intuice“ (stejná logika jako počítač). Online hraje autopilot i za odpojené hráče,
  takže hra nikdy nezamrzne.
* Počítačové žáby pro hru jednoho hráče nebo doplnění stolu (3 rychlosti).
* Ověřeno simulací: v 600 hrách počítačů jsou výhry rozložené rovnoměrně mezi
  všechna místa u stolu (`npm test`).

**Zvuky** – syntetizované přímo v prohlížeči (hod, skok, hmyz, kouzla, voda, bahno,
vír, trampolína, Vodník, vítězství) a tichá podkladová hudba. Žádné zvukové soubory;
skutečné nahrávky lze doplnit v dalším kroku v `js/audio.js`.

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
js/net.js           – online klient (Server-Sent Events + POST)
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
2. **Bahno**: kdo do něj zapadne ještě před svým skokem (po Vodníkovi), přijde
   i o zbytek tahu – a vynechá i tah příští.
3. **Útok světluškou** bere 1 kredit (napadený odevzdá hmyz za 1 kredit, vážku si
   rozmění); útočník dostane mouchu z banku. Helma proti světlušce nechrání.
4. **Skok na hlavu** – každého hráče lze skočit nejvýše jednou za tah.
5. **Vážka ↔ mouchy** se mění 1 : 2. Volavka a Štika nezasahují sesílajícího.
6. **Žabí štěstí** – hranice 5 kreditů, odměna 1 moucha (v `js/game.js`, `luckGap`).
7. Dvanáctka na D12 dovoluje vybrat i Kouzelný leknín nebo vlastní pole – hmyz pak
   získá sám házející. Je to šťastný hod; kdyby to bylo moc silné, stačí ve
   `rollDice` z volby vyřadit 6-6.

## Co dál

* Skutečné nahrané zvuky a hudba místo syntetizovaných.
* Nasazení serveru na veřejnou adresu a instalace jako aplikace (PWA).
* Týmová hra, statistiky hráčů, chat/emoji reakce v online místnosti.
