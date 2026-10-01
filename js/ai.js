/* Žabí jezero – počítačové žáby a autopilot
 *
 * FL.AI.decide(game, id) vrátí akci pro engine (stejnou, jakou by poslal člověk).
 * FL.Autopilot(game, opts) hlídá, na koho hra čeká:
 *   - počítačová (nebo odpojená) žába zahraje po krátké pauze sama,
 *   - člověku běží časový limit (je-li zapnutý); po jeho vypršení
 *     za něj rozhodne „žabí intuice“ (stejná logika jako u počítače).
 * Běží v prohlížeči i na online serveru.
 */
(function () {
  const FL = (globalThis.FL = globalThis.FL || {});
  const T = FL.TILE;

  const noise = () => Math.random() * 0.6;
  const valueOf = s => (s ? s.fly + s.firefly + 2 * s.dragonfly : 0);

  /* Jak lákavé je pole pro žábu `me` (vyšší = lepší). */
  function cellScore(g, me, r, c, opts) {
    const o = opts || {};
    const t = g.tile(r, c);
    const credits = g.credits(me);
    const price = g.settings.leapPrice;
    let s = 3 * valueOf(g.insectsAt(r, c));

    if (!o.ignoreTile) {
      switch (t.type) {
        case T.WATER: s -= 14; break;
        case T.MUD: s -= 8; break;
        case T.MUSHROOM: s += 3; break;
        case T.TRAMPOLINE: s += 2; break;
        case T.WHIRL: s += 0.3; break;
        case T.MAGIC: s -= 6; break;
        case T.BIG:
          s += credits >= price ? 25 : credits >= price - 3 ? 1.5 : 0.3;
          break;
        default: break;
      }
    }

    // skok na hlavu
    if (!o.noJump) {
      g.at(r, c).forEach(v => {
        if (v === me || g.jumped.has(v.id)) return;
        s += g.credits(v) > 0 ? 2.5 : 0.4;
        if (g.zabijak === me.id) s += 2;
      });
    }

    // směr: s dost kredity k velkému leknínu, jinak za hmyzem
    const here = { r, c };
    if (credits >= price - 1) {
      const d = Math.min(...FL.BIG_LILIES.map(([br, bc]) => FL.dist(here, { r: br, c: bc })));
      s -= 1.6 * d;
    } else {
      let best = 0;
      Object.keys(g.insects).forEach(k => {
        const at = FL.parseKey(k);
        if (g.tile(at.r, at.c).type === T.WATER) return;
        const d = FL.dist(here, at);
        if (d === 0) return;
        best = Math.max(best, valueOf(g.insects[k]) * 1.4 / (d + 0.5));
      });
      s += best;
    }
    return s + noise();
  }

  function bestBy(list, score) {
    let best = null, bs = -Infinity;
    list.forEach(x => { const s = score(x); if (s > bs) { bs = s; best = x; } });
    return best;
  }

  function areaValue(g, me, r, c, size) {
    let v = 0;
    g.areaCells(r, c, size).forEach(cell => {
      v += 2 * valueOf(g.insectsAt(cell.r, cell.c));
      g.at(cell.r, cell.c).forEach(o => {
        if (o === me) return;
        v += 2 + g.credits(o) * 0.4 + (o.hand.some(h => h.id === 'bublina') ? -2 : 0);
      });
    });
    return v;
  }

  function bestArea(g, me, size) {
    let best = null, bv = -Infinity;
    for (let r = 0; r < FL.SIZE; r++) {
      for (let c = 0; c < FL.SIZE; c++) {
        const v = areaValue(g, me, r, c, size) + noise() * 0.2;
        if (v > bv) { bv = v; best = { r, c }; }
      }
    }
    return { cell: best, value: bv };
  }

  function chooseCell(g, me, pend) {
    const cells = pend.cells.map(FL.parseKey);
    const tag = pend.tag;
    const pick = x => ({ type: 'cell', r: x.r, c: x.c });

    if (tag === 'event') {
      // dvanáctka: hmyz si pošli pod nos (na sebe nebo na Kouzelný leknín)
      return pick(bestBy(cells, x => {
        if (me.pos && x.r === me.pos.r && x.c === me.pos.c) return 100;
        if (FL.isMagic(x.r, x.c)) return 90;
        const mine = me.pos ? FL.dist(x, me.pos) : 9;
        const theirs = Math.min(9, ...g.players.filter(o => o !== me && o.pos).map(o => FL.dist(x, o.pos)));
        return theirs - mine * 1.5 + noise();
      }));
    }
    if (tag === 'area') {
      const size = pend.area;
      return pick(bestBy(cells, x => areaValue(g, me, x.r, x.c, size) + noise() * 0.2));
    }
    if (tag === 'jazyk') return pick(bestBy(cells, x => valueOf(g.insectsAt(x.r, x.c))));
    if (tag === 'setup' || tag === 'start') {
      return pick(bestBy(cells, x => cellScore(g, me, x.r, x.c, { ignoreTile: true, noJump: true })));
    }
    if (tag === 'dodge') {
      return pick(bestBy(cells, x => cellScore(g, me, x.r, x.c, { noJump: true }) + (g.tile(x.r, x.c).type === T.MUD ? -5 : 0)));
    }
    if (tag === 'teleport') {
      return pick(bestBy(cells, x => {
        let s = cellScore(g, me, x.r, x.c);
        // teleport na velký leknín s dost kredity = veleskok hned v tomto tahu
        if (g.tile(x.r, x.c).type === T.BIG && g.credits(me) >= g.settings.leapPrice) s += 40;
        return s;
      }));
    }
    return pick(bestBy(cells, x => cellScore(g, me, x.r, x.c)));
  }

  function choosePlayer(g, me, pend) {
    const ids = pend.players.map(id => g.players[id]);
    const tag = pend.tag;
    if (tag === 'cerna_magie') return bestBy(ids, o => o.hand.length + noise()).id;
    if (tag === 'zamena') {
      const price = g.settings.leapPrice;
      return bestBy(ids, o => {
        let s = cellScore(g, me, o.pos.r, o.pos.c, { noJump: true });
        if (g.tile(o.pos.r, o.pos.c).type === T.BIG && g.credits(me) >= price) s += 30;
        return s;
      }).id;
    }
    // světluška, Černá ruka: na vedoucího / nejbohatšího
    return bestBy(ids, o => g.credits(o) + noise()).id;
  }

  function chooseOption(g, me, pend) {
    const opts = g.pending.options;
    if (pend.tag === 'cerna_ruka_type') {
      const order = ['dragonfly', 'firefly', 'fly'];
      let bi = 0, br = 9;
      opts.forEach((o, i) => { const rk = order.indexOf(o.value); if (rk < br) { br = rk; bi = i; } });
      return bi;
    }
    if (pend.tag === 'passive') {
      if (g.pending.card === 'plovaky') return Math.random() < 0.4 ? 0 : 1;
      return 0; // Helma, Bublina, Kvákrobatika – vždy se hodí
    }
    return 0;
  }

  /* Kouzla a světluška, které počítač zahraje z vlastní iniciativy. */
  function proactive(g, me) {
    if (!g.canAct()) return null;
    const card = id => me.hand.find(c => c.id === id);
    const play = c => ({ type: 'card', uid: c.uid, who: me.id });
    const others = g.players.filter(o => o !== me);
    const price = g.settings.leapPrice;
    const myCr = g.credits(me);

    for (const id of ['duhova_vazka', 'svetluska', 'zlata_muska']) if (card(id)) return play(card(id));

    if (card('kraken') && others.filter(o => g.credits(o) > 0).length >= Math.max(1, others.length / 2)) return play(card('kraken'));

    if (card('zamena') && myCr >= price && me.pos && g.tile(me.pos.r, me.pos.c).type !== T.BIG &&
        others.some(o => o.pos && g.tile(o.pos.r, o.pos.c).type === T.BIG)) return play(card('zamena'));

    for (const [id, size, need] of [['volavka', 5, 6], ['stika', 3, 4]]) {
      if (card(id) && bestArea(g, me, size).value >= need) return play(card(id));
    }

    if (card('jazyk') && me.pos) {
      const best = Math.max(0, ...FL.neighbours(me.pos.r, me.pos.c).map(n => valueOf(g.insectsAt(n.r, n.c))));
      if (best >= 2) return play(card('jazyk'));
    }

    const leader = others.slice().sort((a, b) => g.credits(b) - g.credits(a))[0];
    if (leader && g.credits(leader) > 0) {
      if (me.insects.firefly > 0 && (g.credits(leader) >= price - 4 || g.credits(leader) > myCr) && Math.random() < 0.7)
        return { type: 'firefly', who: me.id };
      if (card('cerna_ruka') && g.bugCount(leader) > 0 && Math.random() < 0.6) return play(card('cerna_ruka'));
    }
    if (card('cerna_magie') && others.some(o => o.hand.length > 0) && Math.random() < 0.4) return play(card('cerna_magie'));

    if (card('zabijak') && g.phase === 'move' && g.cur === me.id && me.pos &&
        FL.neighbours(me.pos.r, me.pos.c).some(n => g.at(n.r, n.c).some(o => o !== me && !g.jumped.has(o.id))))
      return play(card('zabijak'));

    if (card('eko') && me.pos) {
      // zahraj, když je hmyz blíž soupeřům než tobě
      let mine = 0, theirs = 0;
      Object.keys(g.insects).forEach(k => {
        const at = FL.parseKey(k);
        const dm = FL.dist(at, me.pos);
        const dt = Math.min(99, ...others.filter(o => o.pos).map(o => FL.dist(at, o.pos)));
        if (dm <= dt) mine += valueOf(g.insects[k]); else theirs += valueOf(g.insects[k]);
      });
      if (theirs >= 4 && theirs > mine * 2) return play(card('eko'));
    }

    for (const id of ['hurikan', 'tajfun']) {
      if (!card(id)) continue;
      const i = me.id, n = g.players.length;
      const from = g.players[id === 'hurikan' ? (i - 1 + n) % n : (i + 1) % n];
      if (from !== me && from.hand.length > me.hand.length && Math.random() < 0.5) return play(card(id));
    }
    return null;
  }

  /* Hlavní rozhodnutí. opts.calm = nehrát kouzla z vlastní iniciativy. */
  function decide(g, id, opts) {
    const o = opts || {};
    const me = g.players[id];
    if (!me || g.winner) return null;
    const pend = g.pending;

    const mayCast = () => {
      if (o.calm) return null;
      const k = g.round + ':' + g.cur;
      if (!g._aiActs || g._aiActs.k !== k) g._aiActs = { k, n: {} };
      if ((g._aiActs.n[id] || 0) >= 2) return null;
      const a = proactive(g, me);
      if (a) g._aiActs.n[id] = (g._aiActs.n[id] || 0) + 1;
      return a;
    };

    if (!pend) {
      if (g.phase === 'roll' && g.cur === id) return mayCast() || { type: 'roll' };
      return null;
    }
    if (pend.actorId !== id) return null;

    if (o.timeout && pend.cancel) return { type: 'cancel' };   // rozehrané kouzlo po vypršení času padá

    switch (pend.kind) {
      case 'cell':
        if (pend.tag === 'move') {
          if (g.canLeap()) return { type: 'leap' };
          const a = mayCast();
          if (a) return a;
        }
        return chooseCell(g, me, pend);
      case 'choice': return { type: 'option', i: chooseOption(g, me, pend) };
      case 'player': return { type: 'player', id: choosePlayer(g, me, pend) };
      default: return null;
    }
  }

  FL.AI = { decide, cellScore };

  /* Autopilot: počítačové tahy, časový limit a odpojení hráči.
   * opts: { isAuto(p) → bool, botDelay ms } */
  FL.Autopilot = function (g, opts) {
    const o = Object.assign({ isAuto: p => p.bot, botDelay: 750 }, opts || {});
    let timer = null, sig = null, tries = 0, stopped = false;

    const waitingFor = () => {
      if (g.winner) return null;
      if (g.pending) return g.pending.actorId;
      if (g.phase === 'roll') return g.cur;
      return null;
    };
    const signature = () => g.pending
      ? 'p' + g.pending.seq
      : [g.phase, g.cur, g.round, g.dice ? g.dice.seq : 0].join(':');

    function clear() { if (timer) { clearTimeout(timer); timer = null; } }

    function update(force) {
      if (stopped) return;
      const s = signature();
      if (!force && s === sig) return;
      if (s !== sig) tries = 0;
      sig = s;
      clear();
      g.deadline = null;
      const id = waitingFor();
      if (id == null) return;
      const p = g.players[id];
      if (o.isAuto(p)) {
        timer = setTimeout(() => step(s, id, false), o.botDelay * (0.7 + Math.random() * 0.6));
      } else if (g.settings.turnSeconds > 0) {
        const ms = g.settings.turnSeconds * 1000;
        g.deadline = { actorId: id, at: Date.now() + ms, total: ms };
        timer = setTimeout(() => step(s, id, true), ms);
      }
    }

    function step(s, id, timeout) {
      timer = null;
      if (stopped || signature() !== s) return update();
      const a = decide(g, id, { calm: timeout || tries > 0, timeout });
      tries++;
      if (!a) return;
      if (timeout) g.log(FL.MSG.timeout(g.players[id].name), 'sys');
      g.deadline = null;
      g.apply(a, null);
      // stav se nezměnil (např. instantní kouzlo ve fázi hodu) → zkus znovu, ale už bez kouzel
      if (signature() === s) update(true);
    }

    g.subscribe(() => update());
    update();
    return {
      refresh() { update(true); },
      stop() { stopped = true; clear(); }
    };
  };
})();
