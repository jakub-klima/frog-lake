/* Žabí jezero / Frog Lake – test překladu (node tools/i18ntest.js)
 *
 * 1) Čeština i angličtina mají stejné klíče hlášek, textů rozhraní a stejnou
 *    stavbu pravidel; každá karta kouzla má oba názvy.
 * 2) Stovka anglických her počítačových žab: žádná hláška, nápověda ani
 *    volba nesmí obsahovat češtinu, „undefined“ ani nevyplněné {proměnné}.
 * 3) en/index.html odpovídá index.html (tools/build-en.js).
 */
const path = require('path');
const { execFileSync } = require('child_process');
const root = path.join(__dirname, '..');
globalThis.FL = { LANG: 'en' };
['i18n', 'data', 'texts', 'rules', 'game', 'ai'].forEach(f => require(path.join(root, 'js', f + '.js')));
const FL = globalThis.FL;

let failed = 0;
const check = (name, cond, extra) => {
  if (cond) console.log('  ✔ ' + name);
  else { failed++; console.log('  ✘ ' + name + (extra ? ' – ' + extra : '')); }
};
const keys = o => Object.keys(o).sort().join(',');
const diff = (a, b) => Object.keys(a).filter(k => !(k in b)).concat(Object.keys(b).filter(k => !(k in a)));

console.log('Překlad:');
check('hlášky: stejné klíče cs/en', keys(FL.MSG_ALL.cs) === keys(FL.MSG_ALL.en), diff(FL.MSG_ALL.cs, FL.MSG_ALL.en).join(' '));
check('nápovědy: stejné klíče cs/en', keys(FL.MSG_ALL.cs.hint) === keys(FL.MSG_ALL.en.hint), diff(FL.MSG_ALL.cs.hint, FL.MSG_ALL.en.hint).join(' '));
check('texty rozhraní: stejné klíče cs/en', keys(FL.UI_TEXT.cs) === keys(FL.UI_TEXT.en), diff(FL.UI_TEXT.cs, FL.UI_TEXT.en).join(' '));
const shape = R => R.sections.map(s => s.blocks.map(b => typeof b === 'string' ? 's' : b.list ? 'l' + b.list.length : 't' + b.table.length).join('')).join('|');
check('pravidla: stejná stavba cs/en', shape(FL.RULES_ALL.cs) === shape(FL.RULES_ALL.en));
check('karty kouzel: anglické názvy', FL.CARDS.every(c => c.names.en && c.names.cs && c.name === c.names.en));
check('8 anglických jmen hráčů i počítačů', FL.t('defaultNames').length === 8 && FL.t('botNames').length === 8);

// ---- anglické hry ----
const CZ = /[áčďéěíňóřšťúůýžÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ]/;
const bad = new Set();
const scan = txt => {
  if (txt == null) return;
  const s = String(txt).replace(/Lojzík/g, 'Lojzik');
  if (CZ.test(s) || /undefined|NaN|\{\w+\}/.test(s)) bad.add(s);
};
let games = 0;
for (let i = 0; i < 100; i++) {
  const n = 2 + (i % 7);
  const g = new FL.Game({ players: FL.t('botNames').slice(0, n).map(name => ({ name, bot: true })), autoPassMs: 1e9 });
  // každý hráč dostane do začátku pár kouzel, ať se vyzkouší všechna
  g.players.forEach(p => { for (let k = 0; k < 3; k++) g.drawCard(p); p.insects.firefly = 1; });
  let steps = 0;
  while (!g.over && steps++ < 90000) {
    g.clearAutoPass();
    if (g.pending) { scan(g.pending.hint); (g.pending.options || []).forEach(o => scan(o.label)); }
    if (g.event) { scan(g.event.title); scan(g.event.sub); }
    if (g.phase === 'won') { g.continueGame(); continue; }
    if (g.phase === 'done' && !g.pending) { g.nextPlayer(); continue; }
    const id = g.pending ? g.pending.actorId : g.cur;
    const a = FL.AI.decide(g, id) || FL.AI.decide(g, id, { calm: true });
    g.apply(a, null);
  }
  g.clearAutoPass();
  g.logLines.forEach(l => scan(l.msg));
  if (g.over) games++;
}
check('100 anglických her doběhlo do konce', games === 100, games);
check('žádná čeština ani chybějící text v anglických hláškách', bad.size === 0, [...bad].slice(0, 5).join(' | '));
// všechny varianty textových funkcí – s různými sadami argumentů (kontroluje se jen čeština)
const cz = txt => { if (typeof txt === 'string' && CZ.test(txt.replace(/Lojzík/g, ''))) bad.add(txt); };
const argSets = [['fly', '5-5'], ['Croaky', 'fly'], ['Croaky', 'Hopper', 'fly'], ['Croaky', 3], [2, 3], ['Croaky', 'the row', 'fly']];
const tryAll = fn => argSets.forEach(args => { for (let j = 0; j < 4; j++) { try { cz(fn(...args)); } catch (e) { /* jiné parametry */ } } });
Object.entries(FL.MSG_ALL.en).forEach(([k, v]) => { if (typeof v === 'function' && !['pick', 'fill'].includes(k)) tryAll(v); });
Object.values(FL.MSG_ALL.en.hint).forEach(tryAll);
Object.values(FL.UI_TEXT.en).forEach(v => {
  if (typeof v === 'function') tryAll(v);
  else if (Array.isArray(v)) v.forEach(cz);
  else if (!/Čeština|češtiny/.test(v)) cz(v);
});
scan(FL.rulesText('en'));
FL.CARDS.forEach(c => { scan(c.name); scan(c.text); });
Object.values(FL.TILE_NAME).forEach(scan);
check('žádná čeština v anglických textech rozhraní, pravidlech a kartách', bad.size === 0, [...bad].slice(0, 5).join(' | '));

try {
  execFileSync(process.execPath, [path.join(__dirname, 'build-en.js'), '--check'], { stdio: 'pipe' });
  check('en/index.html je aktuální', true);
} catch (e) {
  check('en/index.html je aktuální', false, 'spusť node tools/build-en.js');
}

console.log(failed ? `\n${failed} test(ů) selhalo.` : '\nVše v pořádku.');
process.exit(failed ? 1 : 0);
