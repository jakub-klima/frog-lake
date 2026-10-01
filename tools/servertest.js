/* Žabí jezero – test online serveru (node tools/servertest.js)
 * Spustí server na náhodném portu, založí místnost se dvěma hráči
 * a počítačem a ověří průběh, skryté karty i oprávnění akcí.
 */
const path = require('path');
const { server, rooms } = require(path.join(__dirname, '..', 'server.js'));

let failed = 0;
const check = (name, cond, extra) => {
  if (cond) console.log('  ✔ ' + name);
  else { failed++; console.log('  ✘ ' + name + (extra ? ' – ' + extra : '')); }
};
const sleep = ms => new Promise(r => setTimeout(r, ms));

server.listen(0, async () => {
  const base = 'http://127.0.0.1:' + server.address().port + '/';
  const post = (url, body) => fetch(base + url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    .then(async r => ({ status: r.status, body: await r.json() }));

  /* jednoduchý čtenář SSE – drží poslední zprávu */
  function listen(code, token) {
    const ctl = new AbortController();
    const state = { last: null, ctl };
    fetch(`${base}api/stream?code=${code}&token=${token}`, { signal: ctl.signal }).then(async r => {
      const dec = new TextDecoder();
      let buf = '';
      for await (const chunk of r.body) {
        buf += dec.decode(chunk, { stream: true });
        let i;
        while ((i = buf.indexOf('\n\n')) >= 0) {
          const ev = buf.slice(0, i); buf = buf.slice(i + 2);
          const line = ev.split('\n').find(l => l.startsWith('data: '));
          if (line) state.last = JSON.parse(line.slice(6));
        }
      }
    }).catch(() => {});
    return state;
  }

  try {
    console.log('Online server:');
    const page = await fetch(base);
    check('servíruje hru', page.ok && (await page.text()).includes('Žabí jezero'));
    check('nepustí ke skrytým souborům', (await fetch(base + '.git/config')).status === 403);

    const host = (await post('api/create', { name: 'Hostitel' })).body;
    check('založení místnosti vrací kód', /^[A-Z2-9]{5}$/.test(host.code));
    const guest = (await post('api/join', { code: host.code.toLowerCase(), name: 'Host<b>' })).body;
    check('připojení druhého hráče (kód bez ohledu na velikost písmen)', !!guest.token);

    const A = listen(host.code, host.token);
    const B = listen(host.code, guest.token);
    await sleep(150);
    check('lobby vidí oba hráče', A.last && A.last.type === 'lobby' && A.last.seats.length === 2);
    check('jména se čistí od HTML', A.last.seats[1].name === 'Hostb');

    check('host-only operace odmítnuta hostovi', (await post('api/lobby', { code: host.code, token: guest.token, op: 'start' })).status === 403);
    await post('api/lobby', { code: host.code, token: host.token, op: 'addBot' });
    await post('api/lobby', { code: host.code, token: host.token, op: 'settings', data: { leapPrice: 6, luck: true, turnSeconds: 15 } });
    await post('api/lobby', { code: host.code, token: host.token, op: 'start' });
    await sleep(150);
    check('hra začala pro oba', A.last.type === 'game' && B.last.type === 'game' && A.last.snap.players.length === 3);
    check('nastavení se přeneslo', A.last.snap.settings.leapPrice === 6 && A.last.snap.settings.turnSeconds === 15);
    check('pozdní příchozí se nepřipojí do běžící hry', (await post('api/join', { code: host.code, name: 'X' })).status === 409);

    // rozmístění: kdo je na řadě, klikne na první nabízené pole
    let checkedForeign = false;
    for (let k = 0; k < 40; k++) {
      const s = A.last.snap;
      if (s.phase !== 'setup') break;
      const actor = s.pending.actorId;
      const tok = actor === 0 ? host.token : actor === 1 ? guest.token : null;
      if (tok) {
        const [r, c] = s.pending.cells[0].split(',').map(Number);
        // nejdřív cizí sedadlo – musí být ignorováno
        const other = actor === 0 ? guest.token : host.token;
        await post('api/act', { code: host.code, token: other, action: { type: 'cell', r, c } });
        await sleep(30);
        if (!checkedForeign) {
          checkedForeign = true;
          check('cizí hráč nemůže rozhodovat za jiného', A.last.snap.pending && A.last.snap.pending.seq === s.pending.seq);
        }
        await post('api/act', { code: host.code, token: tok, action: { type: 'cell', r, c } });
      }
      await sleep(actor === 2 ? 1300 : 80);
    }
    check('všechny žáby jsou rozmístěné', A.last.snap.players.every(p => p.pos));

    const room = rooms.get(host.code);
    room.game.drawCard(room.game.players[1]);
    room.game.emit();
    await sleep(50);
    check('hráč vidí své karty', B.last.snap.players[1].hand.length === 1);
    check('cizí karty jsou skryté', A.last.snap.players[1].hand === null && A.last.snap.players[1].handCount === 1);

    // odpojení → autopilot
    B.ctl.abort();
    await sleep(200);
    check('odpojení se projeví v lobby datech', room.seats[1].connected === false);

    await post('api/leave', { code: host.code, token: host.token });
    await post('api/leave', { code: host.code, token: guest.token });
    check('místnost se po odchodu všech zavře', !rooms.has(host.code));
    A.ctl.abort();
  } catch (e) {
    failed++;
    console.error(e);
  }
  console.log(failed ? `\n${failed} test(ů) selhalo.` : '\nVše v pořádku.');
  process.exit(failed ? 1 : 0);
});
