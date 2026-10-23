/* Vygeneruje pravidla pro deskovou hru z js/rules.js:
 *   `game rules.txt` (česky) a `game rules EN.txt` (anglicky).
 * Použití: node tools/export-rules.js
 */
const fs = require('fs');
const path = require('path');
require(path.join(__dirname, '..', 'js', 'rules.js'));
for (const [lang, file] of [['cs', 'game rules.txt'], ['en', 'game rules EN.txt']]) {
  const out = path.join(__dirname, '..', file);
  fs.writeFileSync(out, globalThis.FL.rulesText(lang));
  console.log('Zapsáno: ' + out);
}
