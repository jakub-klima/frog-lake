/* Vygeneruje `game rules.txt` (pravidla pro deskovou hru) z js/rules.js.
 * Použití: node tools/export-rules.js
 */
const fs = require('fs');
const path = require('path');
require(path.join(__dirname, '..', 'js', 'rules.js'));
const out = path.join(__dirname, '..', 'game rules.txt');
fs.writeFileSync(out, globalThis.FL.rulesText());
console.log('Zapsáno: ' + out);
