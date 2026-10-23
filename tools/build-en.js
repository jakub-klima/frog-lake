/* Vygeneruje anglickou stránku en/index.html z index.html.
 *
 * Obě jazykové verze sdílejí všechny skripty, styly i obrázky – anglická
 * stránka jen nastaví FL.LANG = 'en', <base href="../"> (soubory se berou
 * z kořene) a rovnou přeloží statické texty označené data-i18n.
 * Použití: node tools/build-en.js   (test: node tools/build-en.js --check)
 */
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
globalThis.FL = { LANG: 'en' };
require(path.join(root, 'js', 'i18n.js'));
const t = key => {
  const v = globalThis.FL.t(key);
  if (v === key) throw new Error('Chybí anglický text pro klíč: ' + key);
  return v;
};
const escHtml = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

function build() {
  let s = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const rep = (re, fn, what) => {
    const before = s;
    s = s.replace(re, fn);
    if (s === before) throw new Error('Nenalezeno v index.html: ' + what);
  };
  rep('<html lang="cs">', '<html lang="en">', 'html lang');
  rep('<meta charset="UTF-8">', '<meta charset="UTF-8">\n<!-- VYGENEROVÁNO z index.html příkazem `node tools/build-en.js` – needitovat ručně. -->\n<base href="../">', 'meta charset');
  rep(/<title>[^<]*<\/title>/, () => `<title>${escHtml(t('title'))}</title>`, 'title');
  rep(/<meta name="description" content="[^"]*">/, () => `<meta name="description" content="${escHtml(t('description'))}">`, 'description');
  rep('<script src="js/i18n.js"></script>', '<script>var FL = { LANG: \'en\' };</script>\n<script src="js/i18n.js"></script>', 'i18n script');
  // texty prvků s data-i18n (prvek nesmí mít vnořené značky)
  s = s.replace(/(<(\w+)[^>]*\sdata-i18n="(\w+)"[^>]*>)([^<]*)(<\/\2>)/g, (m, open, tag, key, text, close) => open + escHtml(t(key)) + close);
  s = s.replace(/alt="[^"]*"(\s+data-i18n-alt="(\w+)")/g, (m, attr, key) => `alt="${escHtml(t(key))}"${attr}`);
  s = s.replace(/aria-label="[^"]*"(\s+data-i18n-aria="(\w+)")/g, (m, attr, key) => `aria-label="${escHtml(t(key))}"${attr}`);
  rep(/<a id="langLink"[^>]*>[^<]*<\/a>/, () => `<a id="langLink" class="lang-link" href="index.html" hreflang="cs">${escHtml(t('langOther'))}</a>`, 'langLink');
  return s;
}

const out = path.join(root, 'en', 'index.html');
const html = build();
if (process.argv.includes('--check')) {
  const cur = fs.existsSync(out) ? fs.readFileSync(out, 'utf8') : '';
  if (cur !== html) { console.error('en/index.html není aktuální – spusť: node tools/build-en.js'); process.exit(1); }
  console.log('en/index.html je aktuální.');
} else {
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, html);
  console.log('Zapsáno: ' + out);
}
