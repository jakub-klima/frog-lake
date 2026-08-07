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

  const pctX = c => ((FL.ART.X0 + FL.ART.DX * c) / FL.ART.W) * 100;
  const pctY = r => ((FL.ART.Y0 + FL.ART.DY * r) / FL.ART.H) * 100;
  const CELL_PCT = (FL.ART.DX / FL.ART.W) * 100 * 0.92;

  let game = null;
  let cellEls = {};

  // ================== SETUP ==================
  const DEFAULT_NAMES = ['Kvákal', 'Skokan', 'Rosnička', 'Bahňák', 'Zelenka', 'Pulec', 'Ropušák', 'Blatnice'];

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
    game.onChange = render;
    FL.game = game; // pro ladění v konzoli
    $('setup').classList.add('hidden');
    $('game').classList.remove('hidden');
    buildCells();
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
        d.style.aspectRatio = '1 / 1';
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
    if (t.type === T.WHIRL) s += ' – šipky: ' + t.dirs.map(d => game.arrowGlyph(d[0], d[1])).join(' ');
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

  function renderBoard() {
    const pend = game.pending;
    const pickable = pend && pend.kind === 'cell' ? new Set(pend.cells) : null;

    Object.keys(cellEls).forEach(k => {
      cellEls[k].classList.toggle('pickable', !!(pickable && pickable.has(k)));
    });
    $('cells').classList.toggle('targeting', !!(pend && pend.area));

    // hmyz
    const tokens = $('tokens');
    tokens.innerHTML = '';
    Object.keys(game.insects).forEach(k => {
      const { r, c } = FL.parseKey(k);
      const stack = game.insects[k];
      const kinds = FL.INSECT_KEYS.filter(t => stack[t] > 0);
      if (!kinds.length) return;
      const box = el('div', 'bugs');
      box.style.left = pctX(c) + '%';
      box.style.top = (pctY(r) + 2.4) + '%';
      // šířka je v % vůči plánu, uvnitř se ikony dělí rovným dílem
      box.style.width = Math.min(CELL_PCT * 0.95, CELL_PCT * 0.5 * kinds.length) + '%';
      kinds.forEach(t => {
        const b = el('div', 'bug');
        b.innerHTML = `<img src="${FL.INSECTS[t].img}" alt="${FL.INSECTS[t].name}">`;
        if (stack[t] > 1) b.append(el('span', 'n', '×' + stack[t]));
        box.append(b);
      });
      tokens.append(box);
    });

    // žáby (rozprostřeme je, pokud jich na poli stojí víc)
    const byCell = {};
    game.players.forEach(p => {
      const k = FL.key(p.pos.r, p.pos.c);
      (byCell[k] = byCell[k] || []).push(p);
    });
    Object.keys(byCell).forEach(k => {
      const { r, c } = FL.parseKey(k);
      const group = byCell[k];
      group.forEach((p, i) => {
        const off = group.length > 1 ? (i - (group.length - 1) / 2) * 2.2 : 0;
        const f = el('div', 'frog' + (p === game.player ? ' active' : ''));
        f.style.left = (pctX(c) + off) + '%';
        f.style.top = (pctY(r) - 1.4) + '%';
        f.style.width = CELL_PCT * 0.82 + '%';
        f.style.color = FL.FROG_COLORS[p.idx];
        f.innerHTML = `<img src="${FL.FROG_IMG(p.idx)}" alt="${p.name}">` +
          `<span class="tag">${escapeHtml(p.name)}</span>`;
        $('tokens').append(f);
      });
    });
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, ch =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  }

  // ================== PANELY ==================
  function renderSide() {
    const p = game.winner || game.player;
    $('turnFrog').style.background = FL.FROG_COLORS[p.idx];
    $('turnName').textContent = p.name;
    $('turnCredits').textContent = game.credits(p) + ' kr.';

    $('hint').textContent = game.winner
      ? '🏆 ' + game.winner.name + ' vyhrál!'
      : (game.pending ? game.pending.hint : hintForPhase());

    // kostky
    const d = $('dice');
    d.innerHTML = '';
    if (game.dice) {
      const { d10, black, white } = game.dice;
      d.append(die('D10 – událost', d10 === 10 ? '10/0' : d10, ''));
      d.append(die('černá – řádek', black, 'black'));
      d.append(die('bílá – sloupec', white, 'white'));
    }

    renderActions();
    renderHand();
    renderPlayers();
    renderLog();
  }

  function die(label, val, cls) {
    return el('div', 'die ' + cls, `<b>${val}</b><span>${label}</span>`);
  }

  function hintForPhase() {
    switch (game.phase) {
      case 'roll': return 'Hoď kostkami (D10 + černá D12 + bílá D12).';
      case 'done': return 'Tah je u konce – předej hru dalšímu hráči.';
      default: return '';
    }
  }

  function renderActions() {
    const a = $('actions');
    a.innerHTML = '';

    if (game.winner) {
      const b = el('button', 'primary', 'Nová hra');
      b.onclick = () => location.reload();
      a.append(b);
      return;
    }

    const pend = game.pending;
    if (pend && pend.kind === 'choice') {
      pend.options.forEach((o, i) => {
        const b = el('button', 'primary', escapeHtml(o.label));
        b.onclick = () => game.pickOption(i);
        a.append(b);
      });
      return;
    }

    if (game.phase === 'roll') {
      const b = el('button', 'primary', '🎲 Hoď kostkami');
      b.onclick = () => game.rollDice();
      a.append(b);
    }

    if (game.canLeap()) {
      const b = el('button', 'primary',
        `🌸 VELESKOK (−${game.settings.leapPrice} kr.)`);
      b.onclick = () => game.doLeap();
      a.append(b);
    }

    if (game.canTradeFirefly()) {
      const b = el('button', null, '🪲 Světluška → moucha od hráče');
      b.title = 'Vrať světlušku do banku a vezmi si 1 mouchu od jiného hráče.';
      b.onclick = () => game.tradeFirefly();
      a.append(b);
    }

    if (game.phase === 'done') {
      const b = el('button', 'primary', 'Další hráč ▶');
      b.onclick = () => game.nextPlayer();
      a.append(b);
    }

    if (pend && pend.cancel) {
      const b = el('button', 'ghost', 'Zrušit');
      b.onclick = () => game.cancelPending();
      a.append(b);
    }
  }

  function renderHand() {
    const h = $('hand');
    h.innerHTML = '';
    const p = game.player;
    p.hand.forEach(card => {
      const def = FL.CARD_BY_ID[card.id];
      const c = el('div', 'card' + (def.passive ? ' passive' : ''));
      c.style.setProperty('--cc', def.color);
      c.innerHTML = `<b>${escapeHtml(def.name)}</b>` +
        (def.passive ? '<small>pasivní</small>' : '<small>klikni = sešli</small>');
      c.title = def.text;
      c.onclick = () => {
        if (def.passive) showModal(`<h2>${escapeHtml(def.name)}</h2><p>${escapeHtml(def.text)}</p>
          <p class="note">Pasivní kouzlo se použije automaticky, jakmile nastane situace, na kterou reaguje.</p>`);
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
      const row = el('div', 'prow' + (p === game.player ? ' active' : '') +
        (pickable && pickable.has(p.id) ? ' pickable' : ''));
      const dot = el('span', 'frog-dot');
      dot.style.background = FL.FROG_COLORS[p.idx];
      const pos = FL.inLake(p.pos.r, p.pos.c) ? `${p.pos.r}-${p.pos.c}` : 'břeh';
      row.append(dot);
      row.append(el('span', 'nm', escapeHtml(p.name) + (p.skipTurn ? ' 💤' : '')));
      row.append(el('span', 'pos', pos));
      row.append(el('span', 'cr', game.credits(p) + ' kr.'));
      row.append(el('span', 'cards-n', p.hand.length + ' kouzel'));
      if (pickable && pickable.has(p.id)) row.onclick = () => game.pickPlayer(p.id);
      wrap.append(row);
    });
  }

  function renderLog() {
    const l = $('log');
    l.innerHTML = '';
    game.logLines.forEach(line => l.append(el('div', line.cls, escapeHtml(line.msg))));
  }

  function render() {
    renderBoard();
    renderSide();
  }

  // ================== MODÁL ==================
  function showModal(html) {
    $('modalBody').innerHTML = html;
    $('modal').classList.remove('hidden');
  }

  function legendHtml() {
    const rows = [
      ['Start', 'Odkud žáby vyrážejí; sem se vracíš po pádu do vody nebo po útoku.'],
      ['Břeh / Leknín', 'Běžné pole bez zvláštního účinku.'],
      ['Houba', 'Líznutí svrchní karty z balíčku kouzel.'],
      ['Voda', 'Žába se okamžitě vrací na libovolný volný START.'],
      ['Vodní vír', 'Přenese žábu o 2 pole ve směru jedné z dostupných šipek.'],
      ['Velký leknín', 'Pole 4-4, 4-6, 4-8, 6-4, 6-8, 8-4, 8-6, 8-8 – jen odsud lze provést veleskok.'],
      ['Kouzelný leknín', 'Vítězné pole 6-6. Dosáhneš ho jen zaplaceným veleskokem.']
    ];
    return '<h2>Legenda plánu</h2><div class="legend">' +
      rows.map(r => `<div><b>${r[0]}</b> – ${r[1]}</div>`).join('') +
      '</div><h2 style="margin-top:1rem">Hmyz</h2><div class="legend">' +
      '<div><b>Moucha</b> – 1 kredit</div><div><b>Světluška</b> – 1 kredit</div>' +
      '<div><b>Vážka</b> – 2 kredity</div></div>';
  }

  // ================== START ==================
  document.addEventListener('DOMContentLoaded', () => {
    renderNameFields();
    $('playerCount').addEventListener('change', renderNameFields);
    $('startBtn').addEventListener('click', startGame);
    $('restartBtn').addEventListener('click', () => location.reload());
    $('rulesBtn').addEventListener('click', () => showModal(legendHtml()));
    $('modalClose').addEventListener('click', () => $('modal').classList.add('hidden'));
    $('modal').addEventListener('click', e => {
      if (e.target === $('modal')) $('modal').classList.add('hidden');
    });
  });
})();
