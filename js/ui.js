/* Žabí jezero – vykreslení a ovládání
 *
 * UI kreslí výhradně ze snímku stavu (game.snapshot) a posílá akce přes
 * dispatch(). Díky tomu je stejné pro hru na jednom zařízení i online:
 * lokálně akce míří přímo do enginu, online na server.
 */
(function () {
  const FL = window.FL;
  const T = FL.TILE;
  const A = FL.Audio;
  const M = FL.MSG;
  const $ = id => document.getElementById(id);
  const el = (tag, cls, html) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  };
  const esc = s => String(s).replace(/[&<>"']/g, ch =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* nic */ } }
  };

  const pctX = c => ((FL.ART.X0 + FL.ART.DX * c) / FL.ART.W) * 100;
  const pctY = r => ((FL.ART.Y0 + FL.ART.DY * r) / FL.ART.H) * 100;
  const CELL_PCT = (FL.ART.DX / FL.ART.W) * 100 * 0.92;
  const TILES = FL.buildBoard();
  const tileAt = (r, c) => TILES[FL.key(r, c)];
  const coord = (r, c) => FL.inLake(r, c) ? `${r}-${c}` : `břeh (${r},${c})`;

  const DEFAULT_NAMES = ['Kvákal', 'Skokan', 'Rosnička', 'Bahňák', 'Zelenka', 'Pulec', 'Ropušák', 'Blatnice'];
  const BOT_NAMES = ['Robo-Kvak', 'Čip-Žabka', 'Kvak 3000', 'Bit-Skokan', 'Pixel-Pulec', 'Turbo-Rosnička', 'Data-Ropucha', 'Mega-Kuňka'];

  // ================== STAV UI ==================
  const S = {
    mode: null,          // 'local' | 'online'
    game: null, pilot: null, cfg: null,
    snap: null, snapAt: 0,
    mySeat: null, host: false, room: null,
    actionUI: null,      // {step: 'who'} | {step: 'menu', who}
    lastLogId: 0, firstSnap: true,
    diceSeq: null, revealAt: 0,
    winShown: false,
    cellEls: {}, frogEls: {}, lastPos: {}, lastFlash: null
  };

  // ================== MENU ==================
  let seats = store.get('fl-seats', null) || [
    { name: DEFAULT_NAMES[0], bot: false },
    { name: BOT_NAMES[0], bot: true },
    { name: BOT_NAMES[1], bot: true }
  ];

  function showScreen(id) {
    ['menu', 'lobby', 'game'].forEach(s => $(s).classList.toggle('hidden', s !== id));
    closeAction(true);
  }

  function renderSeats() {
    const wrap = $('seats');
    wrap.innerHTML = '';
    seats.forEach((s, i) => {
      const row = el('div', 'seat');
      const dot = el('span', 'frog-dot');
      dot.style.background = FL.FROG_COLORS[i];
      const img = el('img', 'seat-frog');
      img.src = FL.FROG_IMG(i);
      img.alt = '';
      const inp = el('input');
      inp.type = 'text';
      inp.maxLength = 16;
      inp.value = s.name;
      inp.oninput = () => { s.name = inp.value; store.set('fl-seats', seats); };
      const type = el('button', 'seat-type' + (s.bot ? ' bot' : ''), s.bot ? '🤖 Počítač' : '👤 Hráč');
      type.title = 'Přepnout hráč / počítač';
      type.onclick = () => {
        s.bot = !s.bot;
        if (s.bot && DEFAULT_NAMES.includes(s.name)) s.name = BOT_NAMES[i];
        else if (!s.bot && BOT_NAMES.includes(s.name)) s.name = DEFAULT_NAMES[i];
        store.set('fl-seats', seats); renderSeats();
      };
      const rm = el('button', 'seat-rm', '×');
      rm.title = 'Odebrat';
      rm.disabled = seats.length <= 1;
      rm.onclick = () => { seats.splice(i, 1); store.set('fl-seats', seats); renderSeats(); };
      row.append(img, dot, inp, type, rm);
      wrap.append(row);
    });
    $('addHuman').disabled = $('addBot').disabled = seats.length >= FL.MAX_PLAYERS;
    const humans = seats.filter(s => !s.bot).length;
    $('startBtn').textContent = seats.length === 1
      ? 'Začít sólo hru'
      : `Začít hru (${seats.length} ${seats.length < 5 ? 'žáby' : 'žab'}${humans < seats.length ? ', ' + (seats.length - humans) + ' počítač' : ''})`;
  }

  function addSeat(bot) {
    if (seats.length >= FL.MAX_PLAYERS) return;
    const i = seats.length;
    seats.push({ name: bot ? BOT_NAMES[i] : DEFAULT_NAMES[i], bot });
    store.set('fl-seats', seats);
    renderSeats();
  }

  function readLocalCfg() {
    const cfg = {
      players: seats.map((s, i) => ({ name: (s.name || '').trim() || (s.bot ? BOT_NAMES[i] : DEFAULT_NAMES[i]), bot: s.bot })),
      leapPrice: Math.min(40, Math.max(3, +$('leapPrice').value || 10)),
      turnSeconds: +$('turnSeconds').value,
      botDelay: +$('botSpeed').value,
      luck: $('luck').checked
    };
    store.set('fl-cfg', { leapPrice: cfg.leapPrice, turnSeconds: cfg.turnSeconds, botDelay: cfg.botDelay, luck: cfg.luck });
    return cfg;
  }

  function restoreLocalCfg() {
    const c = store.get('fl-cfg', null);
    if (!c) return;
    $('leapPrice').value = c.leapPrice;
    $('turnSeconds').value = c.turnSeconds;
    $('botSpeed').value = c.botDelay;
    $('luck').checked = c.luck;
  }

  // ================== HRA NA JEDNOM ZAŘÍZENÍ ==================
  function stopLocal() {
    if (S.pilot) S.pilot.stop();
    if (S.game) S.game.destroy();
    S.game = S.pilot = null;
  }

  function resetView() {
    S.snap = null; S.firstSnap = true; S.lastLogId = 0; S.winShown = false;
    S.diceSeq = null; S.actionUI = null; shownDice = null;
    S.frogEls = {}; S.lastPos = {}; S.lastFlash = null;
    $('frogs').innerHTML = '';
    $('toasts').innerHTML = '';
    hideModal();
  }

  function startLocal(cfg) {
    stopLocal();
    S.mode = 'local';
    S.cfg = cfg;
    S.mySeat = null;
    resetView();
    const g = new FL.Game({ players: cfg.players, leapPrice: cfg.leapPrice, luck: cfg.luck, turnSeconds: cfg.turnSeconds });
    S.game = g;
    FL.game = g;                                  // pro ladění v konzoli
    S.pilot = FL.Autopilot(g, { botDelay: cfg.botDelay });
    g.subscribe(() => onSnap(g.snapshot(null)));
    showScreen('game');
    buildCells();
    onSnap(g.snapshot(null));
  }

  function dispatch(a) {
    A.unlock();
    if (S.mode === 'local' && S.game) S.game.apply(a, null);
    else if (S.mode === 'online') FL.Net.act(a);
  }

  /* Smí tohle zařízení rozhodovat za hráče `id`? */
  function controls(id) {
    if (!S.snap || id == null) return false;
    const p = S.snap.players[id];
    if (!p) return false;
    if (S.mode === 'online') return id === S.mySeat;
    return !p.bot;
  }

  // ================== SNÍMEK → OBRAZOVKA ==================
  function onSnap(snap) {
    S.snap = snap;
    S.snapAt = Date.now();
    if (snap.dice && snap.dice.seq !== S.diceSeq) {
      if (S.diceSeq !== null || !S.firstSnap) S.revealAt = Date.now() + 560;
      S.diceSeq = snap.dice.seq;
    }
    processLog(snap);
    if (S.actionUI && !snap.canAct) closeAction(true);
    render();
  }

  function processLog(s) {
    const fresh = s.log.filter(l => l.id > S.lastLogId).reverse();
    if (s.log.length) S.lastLogId = Math.max(S.lastLogId, s.log[0].id);
    if (S.firstSnap) { S.firstSnap = false; return; }
    const sounds = new Set();
    fresh.forEach(l => { if (l.sfx) sounds.add(l.sfx); });
    let delay = 0;
    sounds.forEach(name => { setTimeout(() => A.play(name), delay); delay += 90; });
    fresh.filter(l => l.big).slice(-2).forEach((l, i) => setTimeout(() => toast(l.msg, l.cls), i * 350));
  }

  function render() {
    const s = S.snap;
    if (!s) return;
    renderCells(s);
    renderArrows(s);
    renderBugs(s);
    renderFrogs(s);
    renderPrompt(s);
    renderScore(s);
    renderEvent(s);
    renderHotkeys();
    renderLog(s);
    renderAction(s);
    if (s.winnerId != null) showWin(s);
  }

  // ================== PLÁN ==================
  function buildCells() {
    const wrap = $('cells');
    wrap.innerHTML = '';
    S.cellEls = {};
    for (let r = 0; r < FL.SIZE; r++) {
      for (let c = 0; c < FL.SIZE; c++) {
        const d = el('div', 'cell');
        d.style.left = pctX(c) + '%';
        d.style.top = pctY(r) + '%';
        d.style.width = CELL_PCT + '%';
        d.title = tooltip(r, c);
        d.addEventListener('click', () => onCellClick(r, c));
        d.addEventListener('mouseenter', () => previewArea(r, c));
        d.addEventListener('mouseleave', () => previewArea(null));
        wrap.append(d);
        S.cellEls[FL.key(r, c)] = d;
      }
    }
  }

  function tooltip(r, c) {
    const t = tileAt(r, c);
    let s = FL.TILE_NAME[t.type];
    if (FL.inLake(r, c)) s += ` ${r}-${c}`;
    if (t.type === T.WHIRL) s += ' – o 2 pole, šipky: ' + t.dirs.map(d => FL.arrowGlyph(d[0], d[1])).join(' ');
    if (t.type === T.TRAMPOLINE) s += ' – o 3 pole, šipky: ' + t.dirs.map(d => FL.arrowGlyph(d[0], d[1])).join(' ');
    if (t.type === T.BIG) s += ' – odsud lze provést veleskok';
    if (t.type === T.MUD) s += ' – příští tah se vynechává';
    if (t.type === T.WATER) s += ' – návrat na START';
    return s;
  }

  function eligiblePlayers(s) {
    return s.players.filter(p => controls(p.id) &&
      (p.insects.firefly > 0 || (p.hand && p.hand.length > 0) || p.insects.dragonfly > 0 || p.insects.fly >= 2));
  }

  function pickInfo(s) {
    const set = new Set();
    if (S.actionUI && S.actionUI.step === 'who') {
      eligiblePlayers(s).forEach(p => p.pos && set.add(FL.key(p.pos.r, p.pos.c)));
      return { set, mode: 'who' };
    }
    const pend = s.pending;
    if (!pend || !controls(pend.actorId) || s.winnerId != null) return { set, mode: null };
    if (pend.kind === 'cell') pend.cells.forEach(k => set.add(k));
    if (pend.kind === 'player') pend.players.forEach(id => { const p = s.players[id]; if (p.pos) set.add(FL.key(p.pos.r, p.pos.c)); });
    return { set, mode: pend.kind };
  }

  function onCellClick(r, c) {
    A.unlock();
    const s = S.snap;
    if (!s) return;
    if (S.actionUI && S.actionUI.step === 'who') {
      const p = eligiblePlayers(s).find(o => o.pos && o.pos.r === r && o.pos.c === c);
      if (p) openActionFor(p.id);
      return;
    }
    const pend = s.pending;
    if (!pend || !controls(pend.actorId)) return;
    if (!pickInfo(s).set.has(FL.key(r, c))) return;
    A.play('click');
    dispatch({ type: 'cell', r, c });
  }

  function previewArea(r, c) {
    document.querySelectorAll('.cell.area-preview').forEach(e => e.classList.remove('area-preview'));
    const p = S.snap && S.snap.pending;
    if (!p || !p.area || r == null || !controls(p.actorId)) return;
    const rad = (p.area - 1) / 2;
    for (let rr = r - rad; rr <= r + rad; rr++) {
      for (let cc = c - rad; cc <= c + rad; cc++) {
        const e = S.cellEls[FL.key(rr, cc)];
        if (e) e.classList.add('area-preview');
      }
    }
  }

  function renderCells(s) {
    const { set, mode } = pickInfo(s);
    Object.keys(S.cellEls).forEach(k => {
      const e = S.cellEls[k];
      e.classList.toggle('pickable', set.has(k));
      e.classList.toggle('pick-player', set.has(k) && (mode === 'player' || mode === 'who'));
    });
    $('cells').classList.toggle('targeting', !!(s.pending && s.pending.area && controls(s.pending.actorId)));

    // krátké bliknutí pole, kam právě přiletěl hmyz
    const ev = s.lastEvent;
    const evKey = ev ? FL.key(ev.r, ev.c) : null;
    if (evKey !== S.lastFlash) {
      if (S.lastFlash && S.cellEls[S.lastFlash]) S.cellEls[S.lastFlash].classList.remove('flash');
      if (evKey && S.cellEls[evKey]) {
        const e = S.cellEls[evKey];
        e.classList.remove('flash');
        void e.offsetWidth;
        e.classList.add('flash');
      }
      S.lastFlash = evKey;
    }
  }

  /* Šipky víru / trampolíny od žáby k zvýrazněným cílům. */
  function renderArrows(s) {
    const svg = $('arrows');
    const p = s.pending;
    if (!p || !p.from || !(p.tag === 'whirl' || p.tag === 'tramp')) { svg.innerHTML = ''; return; }
    const f = FL.parseKey(p.from);
    const x1 = pctX(f.c), y1 = pctY(f.r);
    svg.innerHTML = '<defs><marker id="ah" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="4" markerHeight="4" orient="auto">' +
      '<path d="M0,0 L10,5 L0,10 z" fill="#f2c744"/></marker></defs>' +
      p.cells.map(k => {
        const t = FL.parseKey(k);
        const x2 = pctX(t.c), y2 = pctY(t.r);
        const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy) || 1;
        const sx = x1 + dx / len * 3, sy = y1 + dy / len * 3, ex = x2 - dx / len * 3.4, ey = y2 - dy / len * 3.4;
        return `<line x1="${sx}" y1="${sy}" x2="${ex}" y2="${ey}" class="arrow-line" marker-end="url(#ah)"/>`;
      }).join('');
  }

  function renderBugs(s) {
    const box = $('bugs');
    box.innerHTML = '';
    Object.keys(s.insects).forEach(k => {
      const { r, c } = FL.parseKey(k);
      const stack = s.insects[k];
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
  function renderFrogs(s) {
    const layer = $('frogs');
    const groups = {};
    s.players.forEach(p => {
      if (!p.pos) return;
      const k = FL.key(p.pos.r, p.pos.c);
      (groups[k] = groups[k] || []).push(p);
    });
    const { set, mode } = pickInfo(s);
    const actorId = s.pending ? s.pending.actorId : s.cur;
    let hopped = false;

    s.players.forEach(p => {
      let f = S.frogEls[p.id];
      if (!f) {
        f = el('div', 'frog');
        f.style.width = CELL_PCT * 0.82 + '%';
        f.style.color = FL.FROG_COLORS[p.idx];
        f.innerHTML = `<img src="${FL.FROG_IMG(p.idx)}" alt="${esc(p.name)}">` +
          `<span class="tag">${esc(p.name)}</span><span class="badge"></span>`;
        S.frogEls[p.id] = f;
        layer.append(f);
      }
      if (!p.pos) { f.classList.add('hidden'); return; }
      f.classList.remove('hidden');

      const k = FL.key(p.pos.r, p.pos.c);
      const group = groups[k];
      const i = group.indexOf(p);
      const off = group.length > 1 ? (i - (group.length - 1) / 2) * 2.4 : 0;
      const left = pctX(p.pos.c) + off, top = pctY(p.pos.r) - 1.4;
      const sig = left + ':' + top;
      if (S.lastPos[p.id] !== sig) {
        if (S.lastPos[p.id] !== undefined) {
          const leap = s.winnerId === p.id && FL.isMagic(p.pos.r, p.pos.c);
          f.classList.remove('hop', 'leap');
          void f.offsetWidth;
          f.classList.add(leap ? 'leap' : 'hop');
          hopped = true;
        }
        S.lastPos[p.id] = sig;
      }
      f.style.left = left + '%';
      f.style.top = top + '%';
      const active = s.winnerId == null && p.id === actorId;
      f.classList.toggle('active', active);
      f.classList.toggle('target', set.has(k) && (mode === 'player' || mode === 'who'));
      f.classList.toggle('winner', s.winnerId === p.id);
      f.querySelector('.badge').textContent = p.skipTurn ? '💤' : p.bot ? '🤖' : '';
      f.style.zIndex = active ? 5 : 2;
    });
    if (hopped) A.play('hop');
  }

  // ================== VÝZVA (komu a co) ==================
  function nameOf(id) { return S.snap.players[id] ? S.snap.players[id].name : '?'; }

  function renderPrompt(s) {
    const cur = s.players[s.cur];
    const actorId = s.pending ? s.pending.actorId : s.cur;
    const show = s.winnerId != null ? s.players[s.winnerId] : s.players[actorId];
    $('turnFrog').style.background = FL.FROG_COLORS[show.idx];
    $('turnName').textContent = s.winnerId != null ? show.name + ' vítězí!' :
      (actorId !== s.cur ? `${show.name} (v tahu hráče ${cur.name})` : show.name);
    $('roundNo').textContent = s.phase === 'setup' ? 'Rozmístění žab' : 'Kolo ' + s.round;

    const hint = $('hint');
    hint.className = 'hint';
    let text;
    if (s.winnerId != null) text = '🏆 ' + M.win(s.players[s.winnerId].name);
    else if (s.pending) {
      const who = s.players[s.pending.actorId];
      if (controls(who.id)) { text = '👉 ' + s.pending.hint; hint.classList.add('mine'); }
      else if (who.bot) text = `🤖 ${who.name} přemýšlí…`;
      else text = `⏳ Čeká se na hráče ${who.name}…`;
    } else if (s.phase === 'roll') {
      if (controls(cur.id)) { text = '👉 ' + M.hint.roll(cur.name); hint.classList.add('mine'); }
      else text = cur.bot ? `🤖 ${cur.name} hází kostkami…` : `⏳ Na tahu je ${cur.name}.`;
    } else if (s.phase === 'done') text = s.skipping ? '💤 ' + M.hint.skip(cur.name) : M.hint.done();
    else text = '…';
    hint.textContent = text;

    renderTimer(s);
    renderActions(s);
  }

  let timerRaf = null;
  function renderTimer(s) {
    const box = $('timer');
    cancelAnimationFrame(timerRaf);
    if (!s.deadline || s.winnerId != null) { box.classList.add('hidden'); return; }
    box.classList.remove('hidden');
    const end = S.snapAt + s.deadline.left;
    const total = s.deadline.total;
    const mine = controls(s.deadline.actorId);
    box.classList.toggle('mine', mine);
    let lastSec = null;
    const tick = () => {
      const left = Math.max(0, end - Date.now());
      box.querySelector('i').style.width = (left / total * 100) + '%';
      const sec = Math.ceil(left / 1000);
      box.querySelector('span').textContent = sec + ' s';
      box.classList.toggle('urgent', left < 5000);
      if (mine && sec !== lastSec && sec <= 5 && sec > 0) A.play('tick');
      lastSec = sec;
      if (left > 0) timerRaf = requestAnimationFrame(tick);
    };
    tick();
  }

  function renderActions(s) {
    const a = $('actions');
    a.innerHTML = '';
    const cur = s.players[s.cur];
    const pend = s.pending;

    if (s.winnerId != null) {
      a.append(mkBtn('🔄 Nová hra (N)', 'primary', askNewGame));
      a.append(mkBtn('🏠 Menu (Q)', 'ghost', askQuit));
      return;
    }
    if (s.phase === 'setup' && S.mode === 'local' && pend && controls(pend.actorId))
      a.append(mkBtn('🎲 Rozmístit náhodně', null, () => dispatch({ type: 'randomStarts' })));

    if (pend && pend.kind === 'choice' && controls(pend.actorId))
      pend.options.forEach((o, i) => a.append(mkBtn(o, i === 0 ? 'primary' : null, () => dispatch({ type: 'option', i }))));

    if (s.phase === 'roll' && !pend && controls(cur.id))
      a.append(mkBtn('🎲 Hoď kostkami', 'primary main', () => dispatch({ type: 'roll' })));
    if (s.canLeap && controls(cur.id))
      a.append(mkBtn(`🌸 VELESKOK (−${s.settings.leapPrice} kr.)`, 'primary leap main', () => dispatch({ type: 'leap' })));
    if (s.phase === 'done' && !pend && controls(cur.id))
      a.append(mkBtn('Další hráč ▶', 'primary main', () => dispatch({ type: 'next' })));
    if (pend && pend.cancel && controls(pend.actorId))
      a.append(mkBtn('Zrušit (Esc)', 'ghost', () => dispatch({ type: 'cancel' })));
    if (s.canAct && s.phase !== 'setup' && (S.mode === 'online' || eligiblePlayers(s).length))
      a.append(mkBtn('✨ Akce (mezerník)', 'action-btn', toggleAction));
  }

  function mkBtn(label, cls, fn) {
    const b = el('button', cls || '', esc(label));
    b.onclick = () => { A.unlock(); fn(); };
    return b;
  }

  // ================== TABULKA SKÓRE ==================
  function renderScore(s) {
    const t = $('score');
    const price = s.settings.leapPrice;
    $('leapInfo').textContent = `veleskok ${price} kr.`;
    const pend = s.pending;
    const pickable = pend && pend.kind === 'player' && controls(pend.actorId) ? new Set(pend.players) : null;
    const who = S.actionUI && S.actionUI.step === 'who' ? new Set(eligiblePlayers(s).map(p => p.id)) : null;
    const actorId = pend ? pend.actorId : s.cur;
    const img = k => `<img src="${FL.INSECTS[k].img}" alt="${FL.INSECTS[k].name}" title="${FL.INSECTS[k].name}">`;

    const rows = FL.rankPlayers(s.players).map((p, rank) => {
      const cls = ['srow'];
      if (p.id === s.cur && s.winnerId == null) cls.push('turn');
      if (p.id === actorId && actorId !== s.cur && s.winnerId == null) cls.push('deciding');
      if ((pickable && pickable.has(p.id)) || (who && who.has(p.id))) cls.push('pickable');
      if (s.winnerId === p.id) cls.push('winner');
      const pct = Math.min(100, p.credits / price * 100);
      const marks = (p.id === s.cur && s.winnerId == null ? '<span class="mk turn-mk" title="Na tahu">▶</span>' : '') +
        (p.bot ? '<span class="mk" title="Počítač">🤖</span>' : '') +
        (p.offline ? '<span class="mk" title="Odpojen – hraje autopilot">📴</span>' : '') +
        (p.skipTurn ? '<span class="mk" title="V bahně – příští tah vynechá">💤</span>' : '') +
        (S.mode === 'online' && p.id === S.mySeat ? '<span class="mk you">ty</span>' : '');
      return `<tr class="${cls.join(' ')}" data-id="${p.id}">
        <td class="nm"><div class="nmw"><span class="rk">${rank + 1}.</span><span class="frog-dot" style="background:${FL.FROG_COLORS[p.idx]}"></span><span class="n">${esc(p.name)}</span>${marks}</div></td>
        <td class="cr"><b>${p.credits}</b><span class="bar"><i style="width:${pct}%"></i></span></td>
        <td class="num">${p.insects.dragonfly}</td>
        <td class="num">${p.insects.firefly}</td>
        <td class="num">${p.insects.fly}</td>
        <td class="sp">${p.handCount > 0 ? '<span class="yes" title="Má kouzlo">✨ ano</span>' : '<span class="no">ne</span>'}</td>
      </tr>`;
    }).join('');

    t.innerHTML = `<thead><tr>
        <th>Hráč</th><th title="Kredity celkem">Kredity</th>
        <th title="Vážky">${img('dragonfly')}</th><th title="Světlušky">${img('firefly')}</th><th title="Mouchy">${img('fly')}</th>
        <th title="Má hráč kouzlo?">Kouzlo</th></tr></thead><tbody>${rows}</tbody>`;

    t.querySelectorAll('tr.srow.pickable').forEach(tr => {
      tr.onclick = () => {
        const id = +tr.dataset.id;
        if (who) openActionFor(id);
        else { A.play('click'); dispatch({ type: 'player', id }); }
      };
    });
  }

  // ================== UDÁLOST A KOSTKY ==================
  function d12Svg(cls) {
    // dvanáctistěn: obrys desetiúhelníku + čelní pětiúhelník
    const pt = (r, a) => [50 + r * Math.cos(a), 52 + r * Math.sin(a)];
    const outer = [], inner = [];
    for (let i = 0; i < 10; i++) outer.push(pt(47, -Math.PI / 2 + i * Math.PI / 5));
    for (let i = 0; i < 5; i++) inner.push(pt(27, -Math.PI / 2 + i * 2 * Math.PI / 5));
    const P = a => a.map(p => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ');
    const spokes = inner.map((p, i) => `<line x1="${p[0].toFixed(1)}" y1="${p[1].toFixed(1)}" x2="${outer[i * 2][0].toFixed(1)}" y2="${outer[i * 2][1].toFixed(1)}"/>`).join('');
    return `<svg viewBox="0 0 100 104" class="die-svg ${cls}"><polygon class="body" points="${P(outer)}"/>` +
      `<g class="edges">${spokes}</g><polygon class="face" points="${P(inner)}"/><text x="50" y="54" class="num">?</text></svg>`;
  }

  function d10Svg() {
    return '<svg viewBox="0 0 100 104" class="die-svg d10"><polygon class="body" points="50,3 96,44 50,100 4,44"/>' +
      '<g class="edges"><line x1="4" y1="44" x2="24" y2="52"/><line x1="96" y1="44" x2="76" y2="52"/><line x1="50" y1="100" x2="50" y2="74"/></g>' +
      '<polygon class="face" points="50,3 76,52 50,74 24,52"/><text x="50" y="50" class="num">?</text></svg>';
  }

  let diceAnim = null, shownDice = null;
  function renderEvent(s) {
    const box = $('dice');
    if (!box.dataset.built) {
      box.innerHTML = '';
      [['d10', 'zelená D10', 'událost', d10Svg()], ['black', 'černá D12', 'řádek', d12Svg('black')], ['white', 'bílá D12', 'sloupec', d12Svg('white')]]
        .forEach(([k, name, role, svg]) => {
          const d = el('div', 'die die-' + k, `${svg}<span class="dn">${name}</span><span class="dr">${role}</span>`);
          box.append(d);
        });
      box.dataset.built = '1';
    }
    const nums = box.querySelectorAll('.num');
    const dice = s.dice;
    box.classList.toggle('empty', !dice);
    const set = (d10, b, w) => { nums[0].textContent = d10; nums[1].textContent = b; nums[2].textContent = w; };

    if (!dice) { clearInterval(diceAnim); shownDice = null; set('?', '?', '?'); }
    else if (shownDice !== dice.seq) {
      shownDice = dice.seq;
      clearInterval(diceAnim);
      const rolling = Date.now() < S.revealAt;
      if (rolling) {
        box.classList.add('rolling');
        diceAnim = setInterval(() => {
          if (Date.now() >= S.revealAt) {
            clearInterval(diceAnim);
            box.classList.remove('rolling');
            set(dice.d10, dice.black, dice.white);
            markDice(box, dice);
            renderEventText(S.snap);
            return;
          }
          set(1 + Math.floor(Math.random() * 10), 1 + Math.floor(Math.random() * 12), 1 + Math.floor(Math.random() * 12));
        }, 60);
      } else { box.classList.remove('rolling'); set(dice.d10, dice.black, dice.white); markDice(box, dice); }
    }
    renderEventText(s);
  }

  function markDice(box, dice) {
    const ds = box.querySelectorAll('.die');
    ds[0].classList.toggle('special', dice.d10 === 10);
    ds[1].classList.toggle('special', dice.black === 12);
    ds[2].classList.toggle('special', dice.white === 12);
    ds[0].querySelector('.dr').textContent = dice.d10 === 10 ? 'Vodník!' : dice.d10 <= 3 ? 'moucha' : dice.d10 <= 6 ? 'světluška' : 'vážka';
    ds[1].querySelector('.dr').textContent = dice.black === 12 ? 'volba řádku' : 'řádek ' + dice.black;
    ds[2].querySelector('.dr').textContent = dice.white === 12 ? 'volba sloupce' : 'sloupec ' + dice.white;
  }

  function renderEventText(s) {
    const box = $('eventText');
    const ev = s.event;
    $('eventWho').textContent = ev && s.players[ev.playerId] ? 'hází ' + s.players[ev.playerId].name : '';
    if (!ev) {
      box.innerHTML = '<p class="ev-empty">Jezero je zatím klidné… První hod kostkami přivolá hmyz nebo Vodníka Lojzíka.</p>';
      return;
    }
    if (Date.now() < S.revealAt) {
      box.innerHTML = '<p class="ev-empty">Kostky se kutálejí…</p>';
      return;
    }
    const icon = ev.kind === 'vodnik' ? '<span class="ev-icon vodnik">🧜</span>'
      : `<img class="ev-icon" src="${FL.INSECTS[ev.kind].img}" alt="">`;
    let chip = '';
    if (ev.r != null) chip = FL.isMagic(ev.r, ev.c) ? 'Kouzelný leknín 6-6' : FL.inLake(ev.r, ev.c) ? `řádek ${ev.r} · sloupec ${ev.c}` : coord(ev.r, ev.c);
    if (ev.chosen) chip += ' (volba)';
    const gain = ev.gainedBy != null && s.players[ev.gainedBy]
      ? `<div class="ev-gain"><span class="frog-dot" style="background:${FL.FROG_COLORS[s.players[ev.gainedBy].idx]}"></span>+${ev.kind === 'dragonfly' ? 2 : 1} kr. pro ${esc(s.players[ev.gainedBy].name)}</div>` : '';
    box.innerHTML = `<div class="ev ev-${ev.kind}">${icon}<div class="ev-body">
        <div class="ev-title">${esc(ev.title)}</div>
        <div class="ev-sub">${esc(ev.sub || '')}</div>
        ${chip ? `<span class="chip">📍 ${esc(chip)}</span>` : ''}${gain}
      </div></div>`;
    if (S.lastEvSeq !== ev.seq) { S.lastEvSeq = ev.seq; box.firstChild.classList.add('pop'); }
  }

  // ================== KLÁVESY ==================
  const HOTKEYS = [
    { k: 's', cap: 'S', label: () => 'Zvukové efekty: ' + (A.sfx ? 'ZAP' : 'VYP'), on: () => A.sfx },
    { k: 'm', cap: 'M', label: () => 'Hudba: ' + (A.music ? 'ZAP' : 'VYP'), on: () => A.music },
    { k: ' ', cap: 'Mezerník', label: () => 'Akce – použít světlušku nebo kouzlo (kdykoli během hry)', on: () => !!S.actionUI, wide: true },
    { k: 'r', cap: 'R', label: () => 'Pravidla hry' },
    { k: 'n', cap: 'N', label: () => 'Nová hra' },
    { k: 'q', cap: 'Q', label: () => 'Ukončit hru' },
    { k: 'escape', cap: 'Esc', label: () => 'Zavřít / zrušit' },
    { k: 'enter', cap: 'Enter', label: () => 'Hodit kostkami / veleskok / další hráč', wide: true }
  ];

  function renderHotkeys() {
    const box = $('hotkeys');
    const sig = HOTKEYS.map(h => h.label() + (h.on ? h.on() : '')).join('|');
    if (box.dataset.sig === sig) return;
    box.dataset.sig = sig;
    box.innerHTML = '';
    HOTKEYS.forEach(h => {
      const b = el('button', 'hk' + (h.on && h.on() ? ' on' : '') + (h.wide ? ' wide' : ''), `<kbd>${h.cap}</kbd><span>${esc(h.label())}</span>`);
      b.onclick = () => { A.unlock(); handleKey(h.k); };
      box.append(b);
    });
    $('menuSfx').textContent = (A.sfx ? '🔊' : '🔈') + ' Zvuky ' + (A.sfx ? 'ZAP' : 'VYP') + ' (S)';
    $('menuMusic').textContent = '🎵 Hudba ' + (A.music ? 'ZAP' : 'VYP') + ' (M)';
  }

  // ================== KRONIKA ==================
  function renderLog(s) {
    const l = $('log');
    const top = s.log[0] ? s.log[0].id : 0;
    if (l.dataset.top === String(top)) return;
    l.dataset.top = top;
    l.innerHTML = '';
    s.log.slice(0, 60).forEach(line => l.append(el('div', line.cls, esc(line.msg))));
    $('deckInfo').textContent = `Balíček kouzel: ${s.deck} · odhozeno: ${s.discard}`;
  }

  // ================== HLÁŠKY PŘES PLÁN ==================
  function toast(msg, cls) {
    const box = $('toasts');
    const t = el('div', 'toast ' + (cls || ''), esc(msg));
    box.append(t);
    while (box.children.length > 3) box.firstChild.remove();
    setTimeout(() => t.classList.add('out'), 2600);
    setTimeout(() => t.remove(), 3100);
  }

  // ================== AKCE (MEZERNÍK) ==================
  function toggleAction() {
    if (S.actionUI) return closeAction();
    const s = S.snap;
    if (!s || s.winnerId != null || s.phase === 'setup') return;
    if (!s.canAct) {
      const who = s.pending ? nameOf(s.pending.actorId) : '';
      toast(`Teď to nejde – nejdřív musí rozhodnout ${who}.`, 'sys');
      return;
    }
    if (S.mode === 'online') return openActionFor(S.mySeat);
    const list = eligiblePlayers(s);
    if (!list.length) { toast('Nikdo teď nemá světlušku ani kouzlo.', 'sys'); return; }
    if (list.length === 1) return openActionFor(list[0].id);
    S.actionUI = { step: 'who' };
    A.play('click');
    render();
  }

  function openActionFor(id) {
    S.actionUI = { step: 'menu', who: id };
    A.play('click');
    render();
  }

  function closeAction(silent) {
    if (!S.actionUI) return;
    S.actionUI = null;
    $('actionMenu').classList.add('hidden');
    if (!silent) render();
  }

  function renderAction(s) {
    const box = $('actionMenu');
    const ui = S.actionUI;
    if (!ui) { box.classList.add('hidden'); return; }
    box.classList.remove('hidden');
    const close = '<button class="am-close" aria-label="Zavřít">×</button>';

    if (ui.step === 'who') {
      box.innerHTML = `${close}<h3>✨ Akce – kdo hraje?</h3>
        <p class="note">Vyber žábu tady, v tabulce, nebo klikni na ni na plánu.</p><div class="am-who"></div>`;
      const w = box.querySelector('.am-who');
      eligiblePlayers(s).forEach(p => {
        const b = el('button', 'am-player',
          `<span class="frog-dot" style="background:${FL.FROG_COLORS[p.idx]}"></span><b>${esc(p.name)}</b>` +
          `<small>🔦 ${p.insects.firefly} · ✨ ${p.hand ? p.hand.length : 0}</small>`);
        b.onclick = () => openActionFor(p.id);
        w.append(b);
      });
    } else {
      const p = s.players[ui.who];
      if (!p) return closeAction();
      const targets = s.players.filter(o => o.id !== p.id && o.credits > 0);
      const canFire = s.canAct && p.insects.firefly > 0 && targets.length > 0;
      box.innerHTML = `${close}<h3><span class="frog-dot" style="background:${FL.FROG_COLORS[p.idx]}"></span> Akce: ${esc(p.name)}</h3>
        <div class="am-sec"><h4><img src="${FL.INSECTS.firefly.img}" alt=""> Světluška <small>máš ${p.insects.firefly}</small></h4>
          <p class="note">Vrátíš světlušku do banku a vybranému hráči sebereš 1 kredit.</p>
          <div class="am-fire"></div></div>
        <div class="am-sec"><h4>🃏 Kouzla <small>${p.hand ? p.hand.length : 0}</small></h4><div class="am-cards"></div></div>
        <div class="am-sec am-bank-sec"><h4>🏦 Banka</h4><div class="am-bank"></div></div>
        <p class="note am-foot">Mezerník nebo Esc = zavřít</p>`;
      const fire = box.querySelector('.am-fire');
      const fb = mkBtn('🔦 Zaútočit světluškou', 'primary', () => { closeAction(true); dispatch({ type: 'firefly', who: p.id }); });
      fb.disabled = !canFire;
      fire.append(fb);
      if (!p.insects.firefly) fire.append(el('span', 'note', ' Nemáš žádnou světlušku.'));
      else if (!targets.length) fire.append(el('span', 'note', ' Nikdo jiný nemá kredit.'));

      const cards = box.querySelector('.am-cards');
      (p.hand || []).forEach(c => {
        const def = FL.CARD_BY_ID[c.id];
        const d = el('div', 'am-card' + (def.passive ? ' passive' : ''));
        d.style.setProperty('--cc', def.color);
        d.innerHTML = `<b>${esc(def.name)}</b><p>${esc(def.text)}</p>`;
        if (def.passive) d.append(el('span', 'tag', 'pasivní – nabídne se samo'));
        else {
          const b = mkBtn('Seslat', 'primary mini', () => { closeAction(true); dispatch({ type: 'card', uid: c.uid, who: p.id }); });
          b.disabled = !s.canAct;
          d.append(b);
        }
        cards.append(d);
      });
      if (!p.hand || !p.hand.length) cards.append(el('p', 'note', 'Žádná kouzla. Karty kouzel dávají Houby na břehu.'));

      const bank = box.querySelector('.am-bank');
      if (p.insects.dragonfly > 0) bank.append(mkBtn('Vážka → 2 mouchy', 'mini', () => dispatch({ type: 'exchange', dir: 'split', who: p.id })));
      if (p.insects.fly >= 2) bank.append(mkBtn('2 mouchy → vážka', 'mini', () => dispatch({ type: 'exchange', dir: 'merge', who: p.id })));
      if (!bank.children.length) box.querySelector('.am-bank-sec').classList.add('hidden');
      if (S.mode === 'local' && eligiblePlayers(s).length > 1) {
        const back = mkBtn('← jiný hráč', 'ghost mini', () => { S.actionUI = { step: 'who' }; render(); });
        box.querySelector('h3').append(back);
      }
    }
    box.querySelector('.am-close').onclick = () => closeAction();
  }

  // ================== MODÁLY ==================
  function showModal(html, cls) {
    $('modalBody').innerHTML = html;
    $('modal').className = 'modal' + (cls ? ' ' + cls : '');
  }
  function hideModal() { $('modal').classList.add('hidden'); S.confirm = null; }
  const modalOpen = () => !$('modal').classList.contains('hidden');

  function showRules() {
    if (modalOpen() && $('modal').classList.contains('rules-modal')) return hideModal();
    showModal(FL.rulesHtml() + legendHtml(), 'rules-modal');
  }

  function legendHtml() {
    return '<h2>Kde co na plánu najdeš</h2><div class="legend">' +
      '<div><b>Bahno</b> – tmavé bažiny na břehu hned vedle Hub a STARTů (pozice 1, 5, 7 a 11 každé strany).</div>' +
      '<div><b>Trampolína</b> – černý kruh v oranžovém rámu vedle STARTu.</div>' +
      '<div><b>Voda</b> – modrá hladina bez leknínu (rohy jezera a prstenec kolem Kouzelného leknínu).</div>' +
      '<div><b>Vodní vír</b> – zvířená voda na okrajích jezera. Najeď myší na pole a uvidíš jeho šipky.</div></div>';
  }

  function confirmBox(text, yes, onYes) {
    showModal(`<div class="confirm"><h2>${esc(text)}</h2><div class="actions">
      <button class="primary" id="cfYes">${esc(yes)} (Enter)</button><button class="ghost" id="cfNo">Zpět (Esc)</button></div></div>`);
    S.confirm = () => { hideModal(); onYes(); };
    $('cfYes').onclick = S.confirm;
    $('cfNo').onclick = hideModal;
  }

  function askQuit() {
    if (!S.mode) return;
    confirmBox(S.mode === 'online' ? 'Opravdu odejít z online hry?' : 'Opravdu ukončit hru?', 'Ukončit', quitGame);
  }

  function quitGame() {
    if (S.mode === 'online') { FL.Net.leave(); history.replaceState(null, '', location.pathname); }
    stopLocal();
    S.mode = null; S.snap = null;
    hideModal();
    showScreen('menu');
  }

  function askNewGame() {
    if (!S.mode) return;
    if (S.mode === 'online' && !S.host) { toast('Novou hru může spustit hostitel místnosti.', 'sys'); return; }
    confirmBox('Začít novou hru?', 'Nová hra', () => {
      if (S.mode === 'local') startLocal(S.cfg);
      else FL.Net.lobby('restart');
    });
  }

  function showWin(s) {
    if (S.winShown) return;
    S.winShown = true;
    const w = s.players[s.winnerId];
    const ranking = FL.rankPlayers(s.players.filter(p => p.id !== w.id));
    const confetti = Array.from({ length: 36 }, (_, i) =>
      `<i style="left:${Math.random() * 100}%;animation-delay:${(Math.random() * 1.2).toFixed(2)}s;background:${FL.FROG_COLORS[i % 8]}"></i>`).join('');
    setTimeout(() => {
      showModal(`<div class="win-box"><div class="confetti">${confetti}</div>
        <img src="${FL.FROG_IMG(w.idx)}" alt="" class="win-frog">
        <h2>🏆 ${esc(w.name)} vyhrává!</h2>
        <p>Veleskok za ${s.settings.leapPrice} kreditů vyšel – Kouzelný leknín je dobyt v ${s.round}. kole.</p>
        <ol class="final">${ranking.map(p => `<li>${esc(p.name)} – ${p.credits} kr.</li>`).join('')}</ol>
        <div class="actions"><button class="primary" id="winNew">🔄 Nová hra (N)</button><button class="ghost" id="winMenu">🏠 Menu (Q)</button></div>
      </div>`, 'win-modal');
      $('winNew').onclick = () => { hideModal(); askNewGame(); };
      $('winMenu').onclick = () => { hideModal(); askQuit(); };
    }, 1300);
  }

  // ================== ONLINE ==================
  let onlineReady = false;

  async function checkOnline() {
    onlineReady = await FL.Net.available();
    $('onlineOff').classList.toggle('hidden', onlineReady);
    $('onlineOn').classList.toggle('hidden', !onlineReady);
    const room = new URLSearchParams(location.search).get('room');
    if (room && onlineReady) {
      switchTab('online');
      $('joinCode').value = room.toUpperCase();
      const saved = store.get('fl-online', null);
      if (saved && saved.code === room.toUpperCase()) joinRoom(saved.token);
    }
  }

  function onlineName() {
    const n = $('onName').value.trim() || DEFAULT_NAMES[0];
    store.set('fl-name', n);
    return n;
  }

  async function createRoom() {
    try {
      const r = await FL.Net.create(onlineName());
      enterRoom(r.code, r.token);
    } catch (e) { $('onlineMsg').textContent = e.message; }
  }

  async function joinRoom(token) {
    const code = $('joinCode').value.trim().toUpperCase();
    if (!code) { $('onlineMsg').textContent = 'Zadej kód místnosti.'; return; }
    try {
      const r = await FL.Net.join(code, onlineName(), token);
      enterRoom(r.code, r.token);
    } catch (e) { $('onlineMsg').textContent = e.message; }
  }

  function enterRoom(code, token) {
    stopLocal();
    S.mode = 'online';
    S.room = code;
    store.set('fl-online', { code, token });
    history.replaceState(null, '', location.pathname + '?room=' + code);
    resetView();
    FL.Net.connect(code, token, {
      onMessage: onNetMessage,
      onStatus: st => {
        const n = $('netStatus');
        n.classList.toggle('hidden', st === 'ok');
        n.textContent = st === 'ok' ? '' : '📡 obnovuji spojení…';
      },
      onGone: reason => { toast(reason || 'Místnost už neexistuje.', 'bad'); quitGame(); },
      onError: e => toast(e.message, 'bad')
    });
  }

  function onNetMessage(msg) {
    S.mySeat = msg.you;
    S.host = !!msg.host;
    if (msg.type === 'lobby') {
      S.snap = null;
      S.gameId = null;
      showScreen('lobby');
      renderLobby(msg);
    } else if (msg.type === 'game') {
      if (S.gameId !== msg.gameId) {           // první snímek nebo hostitel spustil novou hru
        S.gameId = msg.gameId;
        resetView();
        showScreen('game');
        buildCells();
      }
      onSnap(msg.snap);
    }
  }

  function renderLobby(msg) {
    $('lobbyCode').textContent = msg.code;
    const link = location.origin + location.pathname + '?room=' + msg.code;
    $('lobbyLink').value = link;
    const wrap = $('lobbySeats');
    wrap.innerHTML = '';
    msg.seats.forEach((s, i) => {
      const row = el('div', 'seat');
      row.innerHTML = `<img class="seat-frog" src="${FL.FROG_IMG(i)}" alt=""><span class="frog-dot" style="background:${FL.FROG_COLORS[i]}"></span>` +
        `<span class="seat-name">${esc(s.name)}${i === msg.you ? ' <em>(ty)</em>' : ''}</span>` +
        `<span class="seat-type ${s.bot ? 'bot' : ''}">${s.bot ? '🤖 Počítač' : s.host ? '👑 Hostitel' : s.connected ? '👤 Hráč' : '📴 odpojen'}</span>`;
      if (msg.host && i !== msg.you) {
        const rm = el('button', 'seat-rm', '×');
        rm.title = 'Odebrat';
        rm.onclick = () => FL.Net.lobby('remove', { seat: i });
        row.append(rm);
      }
      wrap.append(row);
    });
    $('lobbyHost').classList.toggle('hidden', !msg.host);
    $('lobbyWait').classList.toggle('hidden', !!msg.host);
    $('lobbyAddBot').disabled = msg.seats.length >= FL.MAX_PLAYERS;
    if (msg.host) {
      const st = msg.settings;
      if (document.activeElement !== $('lLeapPrice')) $('lLeapPrice').value = st.leapPrice;
      $('lTurnSeconds').value = st.turnSeconds;
      $('lLuck').checked = st.luck;
    }
  }

  function sendLobbySettings() {
    FL.Net.lobby('settings', {
      leapPrice: Math.min(40, Math.max(3, +$('lLeapPrice').value || 10)),
      turnSeconds: +$('lTurnSeconds').value,
      luck: $('lLuck').checked
    });
  }

  // ================== OVLÁDÁNÍ KLÁVESNICÍ ==================
  function handleKey(k) {
    A.unlock();
    const inGame = !$('game').classList.contains('hidden') && S.snap;
    switch (k) {
      case 's': A.toggleSfx(); renderHotkeys(); toast('Zvukové efekty: ' + (A.sfx ? 'ZAP' : 'VYP'), 'sys'); return;
      case 'm': A.toggleMusic(); renderHotkeys(); toast('Hudba: ' + (A.music ? 'ZAP' : 'VYP'), 'sys'); return;
      case 'r': showRules(); return;
      case 'q': if (S.mode) askQuit(); return;
      case 'n': if (S.mode) askNewGame(); else if (!$('menu').classList.contains('hidden')) startLocal(readLocalCfg()); return;
      case 'escape':
        if (modalOpen()) return hideModal();
        if (S.actionUI) return closeAction();
        if (inGame && S.snap.pending && S.snap.pending.cancel && controls(S.snap.pending.actorId)) dispatch({ type: 'cancel' });
        return;
      case ' ':
        if (modalOpen()) return;
        if (inGame) toggleAction();
        return;
      case 'enter':
        if (S.confirm) return S.confirm();
        if (modalOpen() || !inGame) return;
        { const b = $('actions').querySelector('button.main'); if (b) b.click(); }
        return;
      default:
    }
  }

  function onKeyDown(e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const typing = /^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName);
    let k = e.key === ' ' || e.code === 'Space' ? ' ' : (e.key || '').toLowerCase();
    if (/^Key[A-Z]$/.test(e.code)) k = e.code.slice(3).toLowerCase();   // funguje i s jiným rozložením klávesnice
    if (typing) {
      if (k === 'escape') e.target.blur();
      if (k === 'enter' && e.target.id === 'joinCode') joinRoom();
      return;
    }
    if (!['s', 'm', 'r', 'q', 'n', ' ', 'enter', 'escape'].includes(k)) return;
    if (k === ' ' || k === 'enter') e.preventDefault();
    if (e.repeat) return;
    handleKey(k);
  }

  // ================== START ==================
  function switchTab(t) {
    document.querySelectorAll('.tab').forEach(b => b.classList.toggle('on', b.dataset.tab === t));
    $('tabLocal').classList.toggle('hidden', t !== 'local');
    $('tabOnline').classList.toggle('hidden', t !== 'online');
  }

  document.addEventListener('DOMContentLoaded', () => {
    restoreLocalCfg();
    renderSeats();
    renderHotkeys();
    $('onName').value = store.get('fl-name', '');
    $('addHuman').onclick = () => addSeat(false);
    $('addBot').onclick = () => addSeat(true);
    $('startBtn').onclick = () => { A.unlock(); startLocal(readLocalCfg()); };
    document.querySelectorAll('.tab').forEach(b => (b.onclick = () => switchTab(b.dataset.tab)));
    document.querySelectorAll('.menu-foot [data-key]').forEach(b => (b.onclick = () => handleKey(b.dataset.key)));
    $('createRoom').onclick = createRoom;
    $('joinRoom').onclick = () => joinRoom();
    $('copyLink').onclick = () => {
      $('lobbyLink').select();
      if (navigator.clipboard) navigator.clipboard.writeText($('lobbyLink').value).catch(() => {});
      else document.execCommand('copy');
      toast('Odkaz zkopírován.', 'sys');
    };
    $('lobbyAddBot').onclick = () => FL.Net.lobby('addBot');
    $('lobbyStart').onclick = () => { sendLobbySettings(); FL.Net.lobby('start'); };
    $('lobbyLeave').onclick = quitGame;
    ['lLeapPrice', 'lTurnSeconds', 'lLuck'].forEach(id => $(id).addEventListener('change', sendLobbySettings));
    $('modalClose').onclick = hideModal;
    $('modal').addEventListener('click', e => { if (e.target === $('modal')) hideModal(); });
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', () => A.unlock(), { once: true });
    checkOnline();
  });
})();
