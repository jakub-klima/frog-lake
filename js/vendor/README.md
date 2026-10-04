# Přibalené knihovny třetích stran

| Soubor | Knihovna | Verze | Licence |
|---|---|---|---|
| `qrcode.js` | [qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator) – Kazuhiko Arase | 2.0.4 | MIT (hlavička souboru) |
| `jsQR.js` | [jsQR](https://github.com/cozmo/jsQR) – Cosmo Wolfe | 1.4.0 | Apache 2.0 (`jsQR.LICENSE`) |

Používají se jen pro hru přes Wi-Fi bez serveru: `qrcode.js` kreslí QR kódy
s pozvánkou a odpovědí, `jsQR.js` je čte z fotoaparátu v prohlížečích, které
nemají vestavěné `BarcodeDetector` (načítá se až ve chvíli, kdy je potřeba).
