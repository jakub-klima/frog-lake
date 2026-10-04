/* Žabí jezero – automatický test enginu (node tools/selftest.js)
 *
 * 1) Cílené testy pravidel, která byla v minulé verzi chybně.
 * 2) Stovky her počítačových žab: žádná se nesmí zaseknout a výhry
 *    by měly být rozložené mezi všechna místa u stolu (férovost).
 */
const path = require('path');
const root = path.join(__dirname, '..');
['data', 'texts', 'game', 'ai'].forEach(f => require(path.join(root, 'js', f + '.js')));
const FL = globalThis.FL;
const T = FL.TILE;

let failed = 0;
function check(name, cond, extra) {
  if (cond) console.log('  ✔ ' + name);
  else { failed++; console.log('  ✘ ' + name + (extra ? ' – ' + extra : '')); }
}

function newGame(n, opts) {
  const g = new FL.Game(Object.assign({
    players: Array.from({ length: n }, (_, i) => ({ name: 'Žába' + (i + 1) })),
    firstPlayer: 0, autoPassMs: 1e9, luck: false
  }, opts || {}));
  g.randomStarts();
  g.clearAutoPass();
  return g;
}

console.log('Pravidla:');

// --- bahno je na plánu ---
{
  const g = newGame(2);
  const muds = Object.values(g.tiles).filter(t => t.type === T.MUD).map(t => t.r + '-' + t.c);
  check('16 polí bahna na břehu vedle hub', muds.length === 16 && muds.includes('0-1') && muds.includes('6-12') === false && muds.includes('5-12'), muds.join(' '));
}

// --- hmyz dopadne na žábu → žába ho hned má ---
{
  const g = newGame(2);
  const p1 = g.players[1];
  p1.pos = { r: 4, c: 7 };
  g.phase = 'roll'; g.pending = null; g.cur = 0;
  g.placeEvent('dragonfly', 4, 7, false);
  check('hmyz dopadl na žábu jiného hráče → získává ho', p1.insects.dragonfly === 1 && !g.insectsAt(4, 7));
  check('událost hlásí, kdo hmyz získal', g.event.gainedBy === 1);
}

// --- hmyz na Kouzelný leknín → získává ho házející ---
{
  const g = newGame(2);
  g.phase = 'roll'; g.pending = null; g.cur = 0;
  g.placeEvent('firefly', 6, 6, false);
  check('hmyz na Kouzelném leknínu získává házející', g.players[0].insects.firefly === 1 && !g.insectsAt(6, 6));
}

// --- bahno: příští tah se vynechá (hod i skok) ---
{
  const g = newGame(2);
  const p0 = g.players[0];
  g.cur = 0; g.phase = 'roll'; g.pending = null;
  p0.pos = { r: 0, c: 4 };                 // START, vedle je bahno 0-5
  g.placeEvent('fly', 11, 11, false);
  check('fáze skoku po hodu', g.pending && g.pending.tag === 'move');
  g.apply({ type: 'cell', r: 0, c: 5 }, 0);
  check('skok do bahna nastaví vynechání tahu', p0.skipTurn === true && g.phase === 'done');
  g.nextPlayer();                          // hraje hráč 1
  g.phase = 'done'; g.pending = null;
  g.nextPlayer();                          // znovu hráč 0 – má stát
  check('hráč v bahně nehází ani neskáče', g.cur === 0 && g.phase === 'done' && !g.dice && !g.pending && p0.skipTurn === false);
  g.clearAutoPass();
}

// --- vír: cíl se vybírá kliknutím na pole ---
{
  const g = newGame(2);
  const p0 = g.players[0];
  g.cur = 0; g.phase = 'move';
  p0.pos = { r: 2, c: 6 };
  g.startMovePhase();
  g.apply({ type: 'cell', r: 1, c: 6 }, 0);       // vír uprostřed horní hrany → šipka dolů
  check('vír nabízí cílová pole ke kliknutí', g.pending && g.pending.kind === 'cell' && g.pending.tag === 'whirl' && g.pending.cells.join() === '3,6');
  g.apply({ type: 'cell', r: 3, c: 6 }, 0);
  check('kliknutí přenese žábu', p0.pos.r === 3 && p0.pos.c === 6);
  g.clearAutoPass();
}

// --- trampolína: cíl kliknutím ---
{
  const g = newGame(2);
  const p0 = g.players[0];
  g.cur = 0; g.phase = 'move';
  p0.pos = { r: 1, c: 3 };
  g.startMovePhase();
  g.apply({ type: 'cell', r: 0, c: 3 }, 0);
  check('trampolína nabízí 2 cílová pole', g.pending && g.pending.tag === 'tramp' && g.pending.cells.sort().join(' ') === '0,0 0,6');
  g.apply({ type: 'cell', r: 0, c: 6 }, 0);
  check('trampolína odpálí na houbu a ta dá kartu', p0.pos.c === 6 && p0.hand.length === 1);
  g.clearAutoPass();
}

// --- světluška: útok kdykoli, sebere 1 kredit ---
{
  const g = newGame(3);
  const [a, b] = g.players;
  a.insects.firefly = 1; b.insects.dragonfly = 1;
  g.cur = 2; g.phase = 'roll'; g.pending = null;      // mimo tah hráče a
  g.apply({ type: 'firefly', who: 0 }, 0);
  check('výběr cíle světlušky', g.pending && g.pending.kind === 'player' && g.pending.actorId === 0 && g.pending.players.join() === '1');
  g.apply({ type: 'cell', r: b.pos.r, c: b.pos.c }, 0);   // klik na žábu na plánu
  check('útok sebral cíli 1 kredit', g.credits(b) === 1 && a.insects.firefly === 0 && a.insects.fly === 1);
  check('online: cizí sedadlo nesmí hrát za jiného', (() => { a.insects.firefly = 1; g.apply({ type: 'firefly', who: 0 }, 1); return !g.pending; })());
}

// --- tabulka: kredity, pak kdo dosáhl později, pak abecedně ---
{
  const g = newGame(3, { players: [{ name: 'Cyril' }, { name: 'Adam' }, { name: 'Bára' }] });
  const [c, a, b] = g.players;
  g.emit();
  check('při 0 kreditech abecedně', FL.rankPlayers(g.snapshot().players).map(p => p.name).join() === 'Adam,Bára,Cyril');
  c.insects.fly = 2; g.emit();
  a.insects.fly = 2; g.emit();
  b.insects.fly = 1; g.emit();
  check('shoda kreditů → výš ten, kdo skóre dosáhl později', FL.rankPlayers(g.snapshot().players).map(p => p.name).join() === 'Adam,Cyril,Bára');
  g.clearAutoPass();
}

// --- Kvákrobatika: útočník zůstane na volném poli, nikdy dvě žáby na jednom poli ---
{
  const g = newGame(2);
  const [a, b] = g.players;
  g.cur = 0; g.phase = 'move'; g.pending = null;
  a.pos = { r: 4, c: 2 }; b.pos = { r: 4, c: 3 };
  b.hand.push({ uid: 'kx', id: 'kvakrobatika' });
  b.insects.fly = 2;
  g.startMovePhase();
  g.apply({ type: 'cell', r: 4, c: 3 }, 0);          // skok na hlavu
  check('napadený dostane nabídku Kvákrobatiky', g.pending && g.pending.tag === 'passive' && g.pending.actorId === 1);
  g.apply({ type: 'option', i: 0 }, 1);              // použít
  check('uskočení – výběr pole', g.pending && g.pending.tag === 'dodge');
  const k = g.pending.cells[0].split(',').map(Number);
  g.apply({ type: 'cell', r: k[0], c: k[1] }, 1);
  check('útočník po uskočení nesklouzává a zůstává na poli', a.pos.r === 4 && a.pos.c === 3 && g.phase === 'done');
  check('žáby nestojí na stejném poli a kredit zůstal', !(a.pos.r === b.pos.r && a.pos.c === b.pos.c) && g.credits(b) === 2);
  g.clearAutoPass();
}

// --- na žábu, na kterou se už skákalo, nejde skočit znovu ---
{
  const g = newGame(3);
  const [a, b, c] = g.players;
  g.cur = 0; g.phase = 'move'; g.pending = null;
  a.pos = { r: 2, c: 2 }; b.pos = { r: 2, c: 3 }; c.pos = { r: 9, c: 9 };
  g.startMovePhase();
  g.apply({ type: 'cell', r: 2, c: 3 }, 0);          // skok na B, B nemá kouzla → sklouznutí
  check('po skoku na hlavu se klouže', g.pending && g.pending.tag === 'slide');
  check('sklouznout nejde zpět na stejnou žábu', !g.pending.cells.includes('2,3'));
  b.pos = { r: 3, c: 3 };                             // B "přesunutá" vedle – její pole je blokované
  check('pole žáby, na kterou se už skákalo, je zablokované', g.blockedFor(a, '3,3') && !g.blockedFor(a, '3,4'));
  g.clearAutoPass();
}

// --- veleskok kliknutím na Kouzelný leknín a dohrávání na pořadí ---
{
  const g = newGame(3);
  const [a, b, c] = g.players;
  g.cur = 0; g.phase = 'move'; g.pending = null;
  a.pos = { r: 4, c: 6 }; a.insects.dragonfly = 5;
  g.startMovePhase();
  check('na velkém leknínu s kredity jde kliknout na Kouzelný leknín', g.pending.leap && g.pending.cells.includes('6,6'));
  g.apply({ type: 'leap' }, 1);
  check('cizí hráč veleskok neprovede', !g.winner);
  g.apply({ type: 'cell', r: 6, c: 6 }, 0);
  check('kliknutí = veleskok, 1. místo a čeká se na volbu', g.winner === a && a.place === 1 && g.phase === 'won' && !g.over);
  check('dohraná žába nezasahuje do hry', g.at(6, 6).length === 0 && !g.canAct());
  g.apply({ type: 'continue' }, null);
  check('C – hra pokračuje dalším hráčem', g.phase === 'roll' && g.cur === 1);
  g.phase = 'move'; g.pending = null; g.cur = 2;
  c.pos = { r: 8, c: 8 }; c.insects.fly = 10;
  g.startMovePhase();
  g.apply({ type: 'cell', r: 6, c: 6 }, 2);
  check('druhý doskok = 2. místo, poslední žába bere 3. místo, konec', c.place === 2 && b.place === 3 && g.over);
  check('tabulka řadí podle umístění', FL.rankPlayers(g.snapshot().players).map(p => p.place).join() === '1,2,3');
  g.clearAutoPass();
}

// --- houba hlásí, jaké kouzlo hráč získal ---
{
  const g = newGame(2);
  const a = g.players[0];
  g.cur = 0; g.phase = 'move'; g.pending = null;
  a.pos = { r: 1, c: 0 };
  g.startMovePhase();
  g.apply({ type: 'cell', r: 0, c: 0 }, 0);
  const name = FL.CARD_BY_ID[a.hand[0].id].name;
  check('hláška na houbě obsahuje jméno hráče i kouzla', g.logLines.some(l => l.big && l.msg.includes(a.name) && l.msg.includes(name)), name);
  check('Žabí štěstí je ve výchozím stavu vypnuté', g.settings.luck === false);
  g.clearAutoPass();
}

// --- snímek skrývá cizí karty ---
{
  const g = newGame(2);
  g.drawCard(g.players[1]);
  const s = g.snapshot(0);
  check('online snímek skrývá cizí ruku', s.players[1].hand === null && s.players[1].handCount === 1 && s.players[1].credits === 0);
  check('snímek je čistý JSON', JSON.parse(JSON.stringify(s)).players.length === 2);
}

// --- simulace celých her ---
console.log('Simulace:');
function playOut(n, luck, opts) {
  const g = new FL.Game({
    players: Array.from({ length: n }, (_, i) => ({ name: 'Bot' + i, bot: true })),
    autoPassMs: 1e9, luck, leapPrice: 10
  });
  let steps = 0;
  while (!g.over && steps < 90000) {
    steps++;
    g.clearAutoPass();
    if (g.phase === 'won') { if (opts && opts.stopAtWin) break; g.continueGame(); continue; }
    if (g.phase === 'done' && !g.pending) { g.nextPlayer(); continue; }
    const id = g.pending ? g.pending.actorId : g.cur;
    let a = FL.AI.decide(g, id);
    const before = g.version;
    if (!a) throw new Error('AI bez akce: ' + g.phase + ' ' + JSON.stringify(g.snapshot().pending));
    g.apply(a, null);
    if (g.version === before + 1 && a.type === 'card') {
      a = FL.AI.decide(g, id, { calm: true });
      if (a) g.apply(a, null);
    }
  }
  g.clearAutoPass();
  return { g, steps };
}

for (const luck of [false, true]) {
  const wins = [0, 0, 0, 0];
  let rounds = 0, stuck = 0;
  const N = 300;
  const t0 = Date.now();
  for (let i = 0; i < N; i++) {
    const { g } = playOut(4, luck, { stopAtWin: true });
    if (!g.winner) { stuck++; continue; }
    // pořadí místa vzhledem k začínajícímu (0 = začínal)
    wins[(g.winner.id - g.first + 4) % 4]++;
    rounds += g.round;
  }
  console.log(`  Žabí štěstí ${luck ? 'ZAP' : 'VYP'}: ${N} her za ${Date.now() - t0} ms, ` +
    `průměrně ${(rounds / (N - stuck)).toFixed(1)} kol, výhry podle pořadí v tahu: ${wins.join(' / ')}`);
  check(`žádná hra se nezasekla (štěstí ${luck ? 'zap' : 'vyp'})`, stuck === 0, stuck + ' zaseknutých');
}

for (const n of [1, 2, 8]) {
  const { g } = playOut(n, false);
  const places = g.players.map(p => p.place).sort((x, y) => x - y).join();
  check(`hra pro ${n} ${n === 1 ? 'hráče' : 'hráčů'} se dohraje na pořadí`, g.over && places === Array.from({ length: n }, (_, i) => i + 1).join(), 'místa ' + places);
}

// v žádné simulované hře nesmí na konci tahu stát dvě žáby na jednom poli
{
  let clashes = 0;
  for (let i = 0; i < 60; i++) {
    const g = new FL.Game({ players: Array.from({ length: 8 }, (_, k) => ({ name: 'B' + k, bot: true })), autoPassMs: 1e9 });
    let steps = 0;
    while (!g.over && steps++ < 90000) {
      g.clearAutoPass();
      if (g.phase === 'won') { g.continueGame(); continue; }
      if (g.phase === 'done' && !g.pending) {
        const seen = new Set();
        g.active.forEach(p => { const k = p.pos.r + ',' + p.pos.c; if (seen.has(k)) clashes++; seen.add(k); });
        g.nextPlayer(); continue;
      }
      const a = FL.AI.decide(g, g.pending ? g.pending.actorId : g.cur) || FL.AI.decide(g, g.pending ? g.pending.actorId : g.cur, { calm: true });
      g.apply(a, null);
    }
    g.clearAutoPass();
  }
  check('60 her po 8 žabách: nikdy dvě žáby na jednom poli na konci tahu', clashes === 0, clashes + '×');
}

console.log(failed ? `\n${failed} test(ů) selhalo.` : '\nVše v pořádku.');
process.exit(failed ? 1 : 0);
