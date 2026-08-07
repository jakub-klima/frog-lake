# Žabí jezero – prototyp (HTML + JS)

První nástřel digitální verze deskové hry **Žabí jezero®** podle `game rules.txt`
a obrázku plánu `images/board.jpeg`.

## Spuštění

Stačí otevřít `index.html` v prohlížeči (funguje i přes `file://`, žádný build
ani server není potřeba). Případně:

```
python3 -m http.server 8000
# → http://localhost:8000
```

Hraje se **hot-seat** – 2 až 8 hráčů na jednom zařízení.

## Struktura

```
index.html      – kostra stránky (obrazovka nastavení + hra)
css/style.css   – vzhled
js/data.js      – herní plán (typy polí, šipky vírů) + definice 32 karet kouzel
js/game.js      – herní engine, pravidla, fáze tahu
js/ui.js        – vykreslení plánu nad obrázkem a ovládání
```

Plán je mřížka **13 × 13**. Vnitřní jezero má souřadnice **1–11** přesně tak,
jak je očíslované na plánu a jak ho adresují kostky D12. Vnější prstenec
(index 0 a 12) je břeh se **8 STARTy** a **8 HOUBAMI**. Herní pole jsou
absolutně napozicovaná nad `images/board.jpeg`, takže sedí na skutečnou grafiku.

Typy polí byly odečteny přímo z obrázku plánu:

| Pole | Souřadnice |
|---|---|
| Kouzelný leknín | 6-6 |
| Velké lekníny (veleskok) | 4-4, 4-6, 4-8, 6-4, 6-8, 8-4, 8-6, 8-8 |
| Vodní víry | rohy 1-1, 1-11, 11-1, 11-11 + 1-5/6/7, 11-5/6/7, 5-1/6-1/7-1, 5-11/6-11/7-11 |
| Voda | 2-3, 3-2, 2-9, 3-10, 9-2, 10-3, 9-10, 10-9 + prstenec kolem Kouzelného leknínu |
| Start | 0-3, 0-9, 12-3, 12-9, 3-0, 9-0, 3-12, 9-12 |
| Houba | rohy a středy břehu |

Šipky vírů: rohový vír má jednu úhlopříčnou šipku dovnitř, víry na pozicích
5 a 7 každé hrany mají tři šipky (rovně + obě úhlopříčky) a vír uprostřed hrany
(pozice 6) jednu šipku rovně. Vír vždy přenáší o 2 pole.

## Co je hotové

* Tah: hod D10 + černá D12 + bílá D12, vyhodnocení události, skok, konec tahu.
* Události: moucha (1-3), světluška (4-6), vážka (7-9), Vodník Lojzík (10/0).
* Kostky D12 – hodnoty 1–11 adresují pole; při **12** si hráč vybírá řádek /
  sloupec, při dvou dvanáctkách libovolné pole.
* Pohyb o 1 pole do všech 8 směrů, sbírání hmyzu z pole, kredity
  (moucha 1, světluška 1, vážka 2) včetně rozměňování vážky.
* Pole: Voda (návrat na volný START), Vodní vír (výběr šipky, přesun o 2),
  Houba (líznutí kouzla), Start, Břeh/Leknín, Velký leknín, Kouzelný leknín.
* Skok na hlavu: sebrání 1 kreditu, následné sklouznutí na sousední pole
  (může řetězit další interakce), každý hráč nejvýše jednou za kolo.
* Veleskok: jen z velkého leknínu, za nastavenou cenu (výchozí 10 kreditů) →
  vítězství.
* Všech **32 karet kouzel** včetně balíčku, odhazovacího balíčku a jeho
  zamíchání po dobrání. Kouzlo lze seslat i uprostřed vlastního tahu –
  nabídka skoku se poté přepočítá.
* Pasivní kouzla (Bublina, Helma, Plováky, Kvákrobatika) se spouštějí sama,
  když nastane situace, na kterou reagují.
* Světluška: vrácení do banku výměnou za 1 mouchu od jiného hráče.
* Zápis hry, přehled hráčů, legenda plánu.

## Vědomá zjednodušení prototypu

Pravidla některé situace nechávají otevřené; tady jsou rozhodnutí, která
prototyp udělal a která je dobré potvrdit nebo změnit:

1. **Vodník Lojzík (D10 = 10/0)** – teleport se počítá jako pohyb daného tahu,
   hráč už navíc neskáče.
2. **Hmyz se umisťuje i na pole s vodou** (kostky adresují celé jezero 1–11);
   jen na Kouzelný leknín 6-6 se neumisťuje. Hmyz z vody sebereš, ale pak tě
   voda pošle na START.
3. **Volavka a Štika** nezasahují sesílajícího hráče.
4. **Kvákrobatika** se u napadeného hráče použije automaticky (nikdo se neptá,
   zda si ji chce nechat) a uskočí na náhodné volné sousední pole.
5. **Černá magie** bere náhodnou kartu z ruky soupeře (ruce jsou v hot-seatu
   stejně skryté).
6. **Bahno a Trampolína** jsou v enginu implementované, ale na tomto plánu se
   žádné takové pole nevyskytuje.
7. Veleskok je po zaplacení **vždy úspěšný** (pravidla mluví o „úspěšném
   doskočení“, ale test úspěchu nespecifikují).
8. Startovní pole se přidělují na začátku hry automaticky po pořadí.

## Co ještě chybí

* Volba startovního pole na začátku hry a volná výměna vážek za mouchy
  „ve stanoveném poměru“ (poměr pravidla neurčují).
* Ruce hráčů jsou v hot-seatu vidět všem – chybí režim se skrýváním karet.
* Žádný počítačový protihráč, žádná hra po síti, žádné ukládání rozehrané hry.
* Zvuk a animace skoků.
