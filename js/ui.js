/* Žabí jezero – vykreslení a ovládání */
(function () {
  const FL = window.FL;
  const T = FL.TILE;
  const $ = id => document.getElementById(id);
  const el = (tag, cls, html) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  };
  const esc = s => String(s).replace(/[&<>"']/g, ch =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

  const pctX = c => ((FL.ART.X0 + FL.ART.DX * c) / FL.ART.W) * 100;
  const pctY = r => ((FL.ART.Y0 + FL.ART.DY * r) / FL.ART.H) * 100;
  const CELL_PCT = (FL.ART.DX / FL.ART.W) * 100 * 0.92;

  let game = null;
  let cellEls = {};
  let frogEls = {};          // trvalé elementy žab, aby šel animovat skok
  let lastPos = {};          // poslední vykreslená pozice žab
  let lastFlash = null;      // naposledy zvýrazněná událost

  const DEFAULT_NAMES = ['Kvákal', 'Skokan', 'Rosnička', 'Bahňák', 'Zelenka', 'Pulec', 'Ropušák', 'Blatnice'];

  // ================== NASTAVENÍ ==================
  function renderNameFields() {
    const n = +$('playerCount').value;
    const wrap = $('nameFields');
    const old = [...wrap.querySelectorAll('input')].map(i => i.value);
    wrap.innerHTML = '';
    for (let i = 0; i < n; i++) {
      const row = el('div', 'name-row');
      const dot = el('span', 'frog-dot');
      dot.style.background = FL.FROG_COLORS[i];
      const inp = el('input');
      inp.type = 'text';
      inp.value = old[i] || DEFAULT_NAMES[i];
      inp.maxLength = 16;
      row.append(dot, inp);
      wrap.append(row);
    }
  }

  function startGame() {
    const names = [...$('nameFields').querySelectorAll('input')]
      .map((i, k) => i.value.trim() || DEFAULT_NAMES[k]);
    game = new FL.Game({
      players: names,
      leapPrice: Math.max(1, +$('leapPrice').value || 10)
    });
    FL.game = game;
    game.onChange = render;
    $('setup').classList.add('hidden');
    $('game').classList.remove('hidden');
    buildCells();
    frogEls = {}; lastPos = {};
    render();
  }

  // ================== PLÁN ==================
  function buildCells() {
    const wrap = $('cells');
    wrap.innerHTML = '';
    cellEls = {};
    for (let r = 0; r < FL.SIZE; r++) {
      for (let c = 0; c < FL.SIZE; c++) {
        const d = el('div', 'cell');
        d.style.left = pctX(c) + '%';
        d.style.top = pctY(r) + '%';
        d.style.width = CELL_PCT + '%';
        d.dataset.r = r;
        d.dataset.c = c;
        d.title = tooltip(r, c);
        d.addEventListener('click', () => game && game.pickCell(r, c));
        d.addEventListener('mouseenter', () => previewArea(r, c));
        d.addEventListener('mouseleave', () => previewArea(null));
        wrap.append(d);
        cellEls[FL.key(r, c)] = d;
      }
    }
  }

  function tooltip(r, c) {
    const t = game.tile(r, c);
    let s = FL.TILE_NAME[t.type];
    if (FL.inLake(r, c)) s += ` ${r}-${c}`;
    if (t.type === T.WHIRL) s += ' – šipky: ' + t.dirs.map(d => FL.arrowGlyph(d[0], d[1])).join(' ');
    if (t.type === T.BIG) s += ' – odsud lze provést veleskok';
    return s;
  }

  function previewArea(r, c) {
    const p = game && game.pending;
    document.querySelectorAll('.cell.area-preview').forEach(e => e.classList.remove('area-preview'));
    if (!p || !p.area || r == null) return;
    game.areaCells(r, c, p.area).forEach(cell => {
      const e = cellEls[FL.key(cell.r, cell.c)];
      if (e) e.classList.add('area-preview');
    });
  }

  function renderCells() {
    const pend = game.pending;
    const pickable = pend && pend.kind === 'cell' ? new Set(pend.cells) : null;
    Object.keys(cellEls).forEach(k => {
      cellEls[k].classList.toggle('pickable', !!(pickable && pickable.has(k)));
    });
    $('cells').classList.toggle('targeting', !!(pend && pend.area));

    // krátké bliknutí pole, kam právě přiletěl hmyz
    const ev = game.lastEvent;
    const evKey = ev ? FL.key(ev.r, ev.c) : null;
    if (evKey !== lastFlash) {
      if (lastFlash && cellEls[lastFlash]) cellEls[lastFlash].classList.remove('flash');
      if (evKey && cellEls[evKey]) {
        const e = cellEls[evKey];
        e.classList.remove('flash');
        void e.offsetWidth;                   // restart animace
        e.classList.add('flash');
      }
      lastFlash = evKey;
    }
  }

  function renderBugs() {
    const box = $('bugs');
    box.innerHTML = '';
    Object.keys(game.insects).forEach(k => {
      const { r, c } = FL.parseKey(k);
      const stack = game.insects[k];
      const kinds = FL.INSECT_KEYS.filter(t => stack[t] > 0);
      if (!kinds.length) return;
      const g = el('div', 'bugs-group');
      g.style.left = pctX(c) + '%';
      g.style.top = (pctY(r) + 2.4) + '%';
      g.style.width = Math.min(CELL_PCT * 0.95, CELL_PCT * 0.5 * kinds.length) + '%';
      kinds.forEach(t => {
        const b = el('div', 'bug');
        b.innerHTML = `<img src="${FL.INSECTS[t].img}" alt="${FL.INSECTS[t].name}">`;
        if (stack[t] > 1) b.append(el('span', 'n', '×' + stack[t]));
        g.append(b);
      });
      box.append(g);
    });
  }

  /* Žáby jsou trvalé elementy – změna pozice se animuje jako skok. */
  function renderFrogs() {
    const layer = $('frogs');
    const groups = {};
    game.players.forEach(p => {
      if (!p.pos) return;
      const k = FL.key(p.pos.r, p.pos.c);
      (groups[k] = groups[k] || []).push(p);
    });

    game.players.forEach(p => {
      let f = frogEls[p.id];
      if (!f) {
        f = el('div', 'frog');
        f.style.width = CELL_PCT * 0.82 + '%';
        f.style.color = FL.FROG_COLORS[p.idx];
        f.innerHTML = `<img src="${FL.FROG_IMG(p.idx)}" alt="${esc(p.name)}">` +
          `<span class="tag">${esc(p.name)}</span>`;
        frogEls[p.id] = f;
        layer.append(f);
      }
      if (!p.pos) { f.classList.add('hidden'); return; }
      f.classList.remove('hidden');

      const k = FL.key(p.pos.r, p.pos.c);
      const group = groups[k];
      const i = group.indexOf(p);
      const off = group.length > 1 ? (i - (group.length - 1) / 2) * 2.4 : 0;
      const left = pctX(p.pos.c) + off, top = pctY(p.pos.r) - 1.4;

      if (lastPos[p.id] !== left + ':' + top) {
        if (lastPos[p.id] !== undefined) {
          f.classList.remove('hop');
          void f.offsetWidth;
          f.classList.add('hop');
        }
        lastPos[p.id] = left + ':' + top;
      }
      f.style.left = left + '%';
      f.style.top = top + '%';
      f.classList.toggle('active', p === game.actor);
      f.style.zIndex = p === game.actor ? 5 : 2;
    });
  }

  // ================== PANELY ==================
  let diceAnim = null;

  function renderSide() {
    const actor = game.winner || game.actor;
    $('turnFrog').style.background = FL.FROG_COLORS[actor.idx];
    $('turnName').textContent = actor.name;
    $('turnCredits').textContent = game.credits(actor) + ' kr.';
    $('roundNo').textContent = game.phase === 'setup' ? 'Rozmístění' : 'Kolo ' + game.round;

    const interrupted = !game.winner && game.interrupted;
    $('interrupt').classList.toggle('hidden', !interrupted);
    if (interrupted) $('interrupt').textContent =
      `Tah hráče ${game.player.name} je přerušen – rozhoduje ${actor.name}.`;

    $('hint').textContent = game.winner
      ? '🏆 ' + game.winner.name + ' vyhrál!'
      : (game.pending ? game.pending.hint : hintForPhase());

    renderDice();
    renderActions();
    renderInsectBar();
    renderHand();
    renderPlayers();
    renderLog();
    $('deckInfo').textContent = `Balíček ${game.deck.length} · odhozeno ${game.discard.length}`;

    if (game.winner) showWinModal();
  }

  function renderDice() {
    const d = $('dice');
    if (!game.dice) { d.innerHTML = ''; d.dataset.sig = ''; return; }
    const { d10, black, white } = game.dice;
    const sig = [d10, black, white, game.round, game.cur].join('|');
    const fresh = d.dataset.sig !== sig;
    d.dataset.sig = sig;

    if (fresh) {
      d.innerHTML = '';
      d.append(die('D10 – událost', '?', ''), die('černá – řádek', '?', 'black'), die('bílá – sloupec', '?', 'white'));
      const vals = d.querySelectorAll('.die b');
      d.classList.add('rolling');
      clearInterval(diceAnim);
      let ticks = 0;
      diceAnim = setInterval(() => {
        ticks++;
        if (ticks > 7) {
          clearInterval(diceAnim);
          d.classList.remove('rolling');
          vals[0].textContent = d10 === 10 ? '10/0' : d10;
          vals[1].textContent = black;
          vals[2].textContent = white;
          return;
        }
        vals[0].textContent = 1 + Math.floor(Math.random() * 10);
        vals[1].textContent = 1 + Math.floor(Math.random() * 12);
        vals[2].textContent = 1 + Math.floor(Math.random() * 12);
      }, 55);
    }
  }

  function die(label, val, cls) {
    return el('div', 'die ' + cls, `<b>${val}</b><span>${label}</span>`);
  }

  function hintForPhase() {
    switch (game.phase) {
      case 'roll': return 'Hoď kostkami: D10 určí událost, černá D12 řádek a bílá D12 sloupec.';
      case 'done': return 'Tah je u konce – předej hru dalšímu hráči.';
      default: return '';
    }
  }

  function renderActions() {
    const a = $('actions');
    a.innerHTML = '';

    if (game.winner) {
      a.append(mkBtn('Nová hra', 'primary', () => location.reload()));
      return;
    }

    if (game.phase === 'setup') {
      a.append(mkBtn('🎲 Rozmístit náhodně', null, () => game.randomStarts()));
      return;
    }

    const pend = game.pending;
    if (pend && pend.kind === 'choice') {
      pend.options.forEach((o, i) => a.append(mkBtn(o.label, 'primary', () => game.pickOption(i))));
      return;
    }

    if (game.phase === 'roll' && !pend) a.append(mkBtn('🎲 Hoď kostkami', 'primary', () => game.rollDice()));
    if (game.canLeap()) a.append(mkBtn(`🌸 VELESKOK (−${game.settings.leapPrice} kr.)`, 'primary leap', () => game.doLeap()));
    if (game.phase === 'done') a.append(mkBtn('Další hráč ▶', 'primary', () => game.nextPlayer()));
    if (pend && pend.cancel) a.append(mkBtn('Zrušit', 'ghost', () => game.cancelPending()));
  }

  function mkBtn(label, cls, fn) {
    const b = el('button', cls, esc(label));
    b.onclick = fn;
    return b;
  }

  /* Lišta s hmyzem hráče na tahu + výměny v banku (pravidlo 6). */
  function renderInsectBar() {
    const bar = $('insectBar');
    bar.innerHTML = '';
    if (game.phase === 'setup' || game.winner) return;
    const p = game.actor;   // shodně s hlavičkou panelu

    FL.INSECT_KEYS.forEach(t => {
      const item = el('div', 'ins');
      item.title = `${FL.INSECTS[t].name} – ${FL.INSECTS[t].value} kr.`;
      item.innerHTML = `<img src="${FL.INSECTS[t].img}" alt=""><b>${p.insects[t]}</b>`;
      bar.append(item);
    });

    const tools = el('div', 'ins-tools');
    if (game.canExchange('split'))
      tools.append(mkBtn('Vážka → 2 mouchy', 'mini', () => game.exchange('split')));
    if (game.canExchange('merge'))
      tools.append(mkBtn('2 mouchy → vážka', 'mini', () => game.exchange('merge')));
    if (game.canTradeFirefly())
      tools.append(mkBtn('Světluška → moucha od hráče', 'mini', () => game.tradeFirefly()));
    if (tools.children.length) bar.append(tools);
  }

  function renderHand() {
    const h = $('hand');
    h.innerHTML = '';
    const p = game.player;
    $('handOwner').textContent = p.name;
    p.hand.forEach(card => {
      const def = FL.CARD_BY_ID[card.id];
      const c = el('div', 'card' + (def.passive ? ' passive' : ''));
      c.style.setProperty('--cc', def.color);
      c.innerHTML = `<b>${esc(def.name)}</b>` +
        (def.passive ? '<small>pasivní</small>' : '<small>klikni = sešli</small>');
      c.title = def.text;
      c.onclick = () => {
        if (def.passive || !game.canPlayCard()) showCardModal(def);
        else game.playCard(card.uid);
      };
      h.append(c);
    });
  }

  function renderPlayers() {
    const wrap = $('players');
    wrap.innerHTML = '';
    const pend = game.pending;
    const pickable = pend && pend.kind === 'player' ? new Set(pend.players) : null;

    game.players.forEach(p => {
      const row = el('div', 'prow' +
        (p === game.player ? ' active' : '') +
        (p === game.actor && game.interrupted ? ' deciding' : '') +
        (pickable && pickable.has(p.id) ? ' pickable' : ''));
      const dot = el('span', 'frog-dot');
      dot.style.background = FL.FROG_COLORS[p.idx];
      const pos = p.pos ? (FL.inLake(p.pos.r, p.pos.c) ? `${p.pos.r}-${p.pos.c}` : 'břeh') : '–';
      row.append(dot);
      row.append(el('span', 'nm', esc(p.name) + (p.skipTurn ? ' 💤' : '')));
      row.append(el('span', 'pos', pos));
      row.append(el('span', 'cr', game.credits(p) + ' kr.'));
      row.append(el('span', 'cards-n', p.hand.length + '×'));
      if (pickable && pickable.has(p.id)) row.onclick = () => game.pickPlayer(p.id);
      wrap.append(row);
    });
  }

  function renderLog() {
    const l = $('log');
    l.innerHTML = '';
    game.logLines.forEach(line => l.append(el('div', line.cls, esc(line.msg))));
  }

  function render() {
    renderCells();
    renderBugs();
    renderFrogs();
    renderSide();
  }

  // ================== MODÁLY ==================
  function showModal(html) {
    $('modalBody').innerHTML = html;
    $('modal').classList.remove('hidden');
  }
  function hideModal() { $('modal').classList.add('hidden'); }

  function showCardModal(def) {
    showModal(`<h2>${esc(def.name)}</h2><p>${esc(def.text)}</p>` +
      (def.passive ? '<p class="note">Pasivní kouzlo – hra se sama zeptá, až nastane situace, na kterou reaguje.</p>' : ''));
  }

  let winShown = false;
  function showWinModal() {
    if (winShown) return;
    winShown = true;
    const w = game.winner;
    showModal(
      `<div class="win-box">
         <img src="${FL.FROG_IMG(w.idx)}" alt="" class="win-frog">
         <h2>🏆 ${esc(w.name)} vyhrává!</h2>
         <p>Veleskok za ${game.settings.leapPrice} kreditů vyšel – Kouzelný leknín 6-6 je dobyt.</p>
         <p class="note">Kolo ${game.round} · zbývající kredity ${game.credits(w)}</p>
       </div>`);
  }

  function legendHtml() {
    const rows = [
      ['Start', 'Odkud žáby vyrážejí; sem se vracíš po pádu do vody nebo po útoku. Pole si vždy vybíráš sám.'],
      ['Břeh / Leknín', 'Běžné pole bez zvláštního účinku.'],
      ['Houba', 'Líznutí svrchní karty z balíčku kouzel.'],
      ['Voda', 'Žába se okamžitě vrací na libovolný volný START.'],
      ['Vodní vír', 'Přenese žábu o 2 pole ve směru jedné z dostupných šipek. Najeď myší na vír a uvidíš je.'],
      ['Velký leknín', 'Pole 4-4, 4-6, 4-8, 6-4, 6-8, 8-4, 8-6, 8-8 – jen odsud lze provést veleskok.'],
      ['Kouzelný leknín', 'Vítězné pole 6-6. Dosáhneš ho jen zaplaceným veleskokem.']
    ];
    return '<h2>Legenda plánu</h2><div class="legend">' +
      rows.map(r => `<div><b>${r[0]}</b> – ${r[1]}</div>`).join('') +
      '</div><h2 style="margin-top:1rem">Hmyz a kredity</h2><div class="legend">' +
      '<div><b>Moucha</b> – 1 kredit</div><div><b>Světluška</b> – 1 kredit, nebo ji vrať do banku a vezmi si mouchu od jiného hráče</div>' +
      '<div><b>Vážka</b> – 2 kredity, v banku ji lze měnit za 2 mouchy</div></div>' +
      '<h2 style="margin-top:1rem">Ovládání</h2><div class="legend">' +
      '<div><b>Mezerník</b> – hlavní akce (hod kostkami / další hráč)</div>' +
      '<div><b>Esc</b> – zavřít okno nebo zrušit zaměřování kouzla</div></div>';
  }

  // ================== START ==================
  document.addEventListener('DOMContentLoaded', () => {
    renderNameFields();
    $('playerCount').addEventListener('change', renderNameFields);
    $('startBtn').addEventListener('click', startGame);
    $('restartBtn').addEventListener('click', () => location.reload());
    $('rulesBtn').addEventListener('click', () => showModal(legendHtml()));
    $('modalClose').addEventListener('click', hideModal);
    $('modal').addEventListener('click', e => { if (e.target === $('modal')) hideModal(); });

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        if (!$('modal').classList.contains('hidden')) return hideModal();
        if (game && game.pending && game.pending.cancel) game.cancelPending();
        return;
      }
      if (e.key === ' ' && game && $('modal').classList.contains('hidden')) {
        if (/^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName)) return;
        const b = $('actions').querySelector('button.primary');
        if (b) { e.preventDefault(); b.click(); }
      }
    });
  });
})();
