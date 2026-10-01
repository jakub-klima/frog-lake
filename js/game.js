/* Žabí jezero – herní engine (pravidla)
 *
 * Vyhodnocení dopadu je řetěz pokračování (continuations), aby se šlo
 * uprostřed tahu zeptat i jiného hráče než toho, kdo je právě na tahu –
 * typicky "chceš použít Helmu?" nebo "vyber si volný START".
 * Každý dotaz je objekt `pending` s `actorId`, tedy s hráčem, který rozhoduje.
 *
 * Engine běží beze změny v prohlížeči (hra na jednom zařízení) i v Node.js
 * (online server). Ven komunikuje jen dvěma cestami:
 *   apply(action, seat) – jediný vstup (klik na pole, hod, kouzlo…),
 *   snapshot(seat)      – čistý JSON stav pro vykreslení (cizí karty skryté).
 */
(function () {
  const FL = (globalThis.FL = globalThis.FL || {});
  const T = FL.TILE;
  const key = FL.key;
  const M = FL.MSG;

  const rnd = n => Math.floor(Math.random() * n);
  const shuffle = a => {
    for (let i = a.length - 1; i > 0; i--) {
      const j = rnd(i + 1);
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  class Game {
    /* opts.players: [{name, bot}] nebo [name] */
    constructor(opts) {
      this.listeners = [];
      this.settings = {
        leapPrice: opts.leapPrice != null ? opts.leapPrice : 10,
        autoPassMs: opts.autoPassMs != null ? opts.autoPassMs : 1400,
        luck: opts.luck !== false,          // Žabí štěstí – pomoc zaostávajícím
        luckGap: opts.luckGap || 5,
        turnSeconds: opts.turnSeconds || 0   // časový limit na rozhodnutí (0 = bez limitu)
      };
      this.tiles = FL.buildBoard();
      this.insects = {};           // "r,c" -> {fly, firefly, dragonfly}
      this.deck = shuffle(FL.buildDeck());
      this.discard = [];
      this.logLines = [];
      this.logSeq = 0;
      this.winner = null;
      this.dice = null;
      this.diceSeq = 0;
      this.event = null;           // co se právě odehrálo na jezeře po hodu kostkami
      this.eventSeq = 0;
      this.pending = null;
      this.askSeq = 0;
      this.phase = 'setup';
      this.lastEvent = null;       // pole, kam právě přiletěl hmyz (pro zvýraznění)
      this.round = 1;
      this.jumped = new Set();
      this.zabijak = null;         // id hráče, který v tomto tahu aktivoval Žabijáka
      this._resumeMove = false;
      this.moveDue = false;        // skok tahu ještě čeká (teleport se za skok nepočítá)
      this._passTimer = null;
      this.version = 0;
      this.stampSeq = 0;
      this.deadline = null;        // časový limit rozhodnutí (nastavuje Autopilot)

      this.players = opts.players.map((pl, i) => {
        const o = typeof pl === 'string' ? { name: pl } : pl;
        return {
          id: i,
          idx: o.color != null ? o.color : i,
          name: o.name,
          bot: !!o.bot,
          offline: false,
          pos: null,               // startovní pole si hráč vybere sám
          insects: { fly: 0, firefly: 0, dragonfly: 0 },
          hand: [],
          skipTurn: false,
          scoreStamp: 0,           // kdy hráč naposledy změnil skóre (pro pořadí v tabulce)
          lastCredits: 0
        };
      });

      // Začínajícího určí kostka. Starty si hráči vybírají v opačném pořadí,
      // takže kdo začíná, vybírá si pole jako poslední – je to fér.
      const n = this.players.length;
      this.first = opts.firstPlayer != null ? opts.firstPlayer : rnd(n);
      this.cur = this.first;
      this.setupOrder = [];
      for (let k = 1; k <= n; k++) this.setupOrder.push(this.players[(this.first - k + n * 2) % n].id);

      this.log('Vítejte u Žabího jezera! Cena veleskoku: ' + this.settings.leapPrice + ' kreditů.', 'sys');
      if (n > 1) this.log(M.firstPlayer(this.player.name), 'turn', { big: true, sfx: 'dice' });
      this.beginSetup();
    }

    // ================= pomocné =================
    subscribe(fn) { this.listeners.push(fn); return () => (this.listeners = this.listeners.filter(f => f !== fn)); }

    emit() {
      this.stampScores();
      this.version++;
      this.listeners.forEach(fn => fn(this));
    }

    /* Tabulka: při shodě kreditů je výš ten, kdo skóre dosáhl později. */
    stampScores() {
      let bumped = false;
      this.players.forEach(p => {
        const c = this.credits(p);
        if (c !== p.lastCredits) {
          if (!bumped) { this.stampSeq++; bumped = true; }
          p.lastCredits = c;
          p.scoreStamp = this.stampSeq;
        }
      });
    }

    /* opts: { sfx: zvuk, big: velká hláška přes plán } */
    log(msg, cls, opts) {
      const line = Object.assign({ id: ++this.logSeq, msg, cls: cls || '' }, opts || {});
      this.logLines.unshift(line);
      if (this.logLines.length > 250) this.logLines.pop();
    }

    get player() { return this.players[this.cur]; }

    /* Hráč, který právě rozhoduje – nemusí to být ten, kdo je na tahu. */
    get actor() {
      if (this.pending && this.pending.actorId != null) return this.players[this.pending.actorId];
      return this.player;
    }

    get interrupted() { return this.actor !== this.player; }

    tile(r, c) { return this.tiles[key(r, c)]; }

    at(r, c) { return this.players.filter(p => p.pos && p.pos.r === r && p.pos.c === c); }

    credits(p) { return p.insects.fly + p.insects.firefly + 2 * p.insects.dragonfly; }

    bugCount(p) { return p.insects.fly + p.insects.firefly + p.insects.dragonfly; }

    insectsAt(r, c) { return this.insects[key(r, c)] || null; }

    coord(r, c) { return FL.inLake(r, c) ? `${r}-${c}` : `břeh (${r},${c})`; }

    neighbourKeys(r, c, skipMagic) {
      return FL.neighbours(r, c)
        .filter(n => !(skipMagic !== false && FL.isMagic(n.r, n.c)))
        .map(n => key(n.r, n.c));
    }

    /* Postupné zpracování seznamu, kde každý krok může čekat na vstup hráče. */
    seq(list, step, done) {
      const next = i => {
        if (i >= list.length) return done ? done() : undefined;
        step(list[i], () => next(i + 1));
      };
      next(0);
    }

    addInsect(r, c, type, n) {
      const k = key(r, c);
      if (!this.insects[k]) this.insects[k] = { fly: 0, firefly: 0, dragonfly: 0 };
      this.insects[k][type] += (n == null ? 1 : n);
    }

    takeInsectsAt(p, r, c) {
      const k = key(r, c);
      const stack = this.insects[k];
      if (!stack) return 0;
      let gained = 0;
      FL.INSECT_KEYS.forEach(t => {
        if (stack[t]) { p.insects[t] += stack[t]; gained += stack[t] * FL.INSECTS[t].value; }
      });
      delete this.insects[k];
      if (this.lastEvent && this.lastEvent.r === r && this.lastEvent.c === c) this.lastEvent = null;
      if (gained) this.log(M.gain(p.name, gained, this.coord(r, c)), 'gain', { sfx: 'gain' });
      return gained;
    }

    /* Odebere hráči hmyz v hodnotě `amount` kreditů;
     * vážku (2 kr.) lze rozměnit, přebytek se vrací jako moucha z banku. */
    spend(p, amount) {
      if (this.credits(p) < amount) return false;
      let left = amount;
      while (left > 0) {
        if (p.insects.fly > 0) { p.insects.fly--; left--; }
        else if (p.insects.firefly > 0) { p.insects.firefly--; left--; }
        else if (p.insects.dragonfly > 0) {
          p.insects.dragonfly--;
          left -= 2;
          if (left < 0) { p.insects.fly++; left = 0; }
        } else return false;
      }
      return true;
    }

    freeStarts() { return FL.STARTS.filter(s => this.at(s.r, s.c).length === 0); }

    drawCard(p) {
      if (!this.deck.length) {
        if (!this.discard.length) { this.log('Balíček kouzel je prázdný.', 'sys'); return null; }
        this.deck = shuffle(this.discard);
        this.discard = [];
        this.log('Odhazovací balíček byl zamíchán a vrácen do hry.', 'sys');
      }
      const card = this.deck.pop();
      p.hand.push(card);
      return card;
    }

    /* Seslání kouzla: karta jde na odhazovací balíček a všichni se to dozví. */
    cast(p, uid) {
      const i = p.hand.findIndex(c => c.uid === uid);
      if (i < 0) return null;
      const card = p.hand.splice(i, 1)[0];
      this.discard.push(card);
      this.log(M.spell(p.name, FL.CARD_BY_ID[card.id].name), 'card', { sfx: 'spell', big: true });
      return card;
    }

    castById(p, id) {
      const c = p.hand.find(h => h.id === id);
      return c ? this.cast(p, c.uid) : null;
    }

    // ================= dotazy =================
    ask(obj) {
      obj.seq = ++this.askSeq;
      this.pending = obj;
      this.emit();
    }

    askCell(actorId, hint, cells, handler, extra) {
      this.ask(Object.assign({ kind: 'cell', actorId, hint, cells, handler }, extra || {}));
    }

    askChoice(actorId, hint, options, handler, extra) {
      this.ask(Object.assign({ kind: 'choice', actorId, hint, options, handler }, extra || {}));
    }

    askPlayer(hint, filter, handler, actorId, tag) {
      const ids = this.players.filter(filter).map(p => p.id);
      if (!ids.length) { this.log('Není koho zvolit.', 'sys'); return false; }
      this.ask({
        kind: 'player', tag,
        actorId: actorId == null ? this.player.id : actorId,
        hint, players: ids, cancel: () => {}, handler
      });
      return true;
    }

    /* Nabídne majiteli pasivní karty, zda ji chce použít. */
    offerPassive(p, cardId, hint, onYes, onNo) {
      if (!p.hand.some(c => c.id === cardId)) return onNo();
      this.askChoice(p.id, hint, [
        { label: 'Použít ' + FL.CARD_BY_ID[cardId].name, value: true },
        { label: 'Nepoužít', value: false }
      ], v => {
        this.pending = null;
        if (v) {
          this.castById(p, cardId);
          onYes();
        } else onNo();
      }, { tag: 'passive', card: cardId });
    }

    /* Návrat na START – pole si vybírá postižený hráč. */
    askStart(p, reason, done) {
      const free = this.freeStarts().filter(s => !(p.pos && p.pos.r === s.r && p.pos.c === s.c));
      const list = free.length ? free : FL.STARTS;
      this.log(M.toStart(p.name, reason), 'bad');
      this.askCell(p.id, M.hint.start(p.name),
        list.map(s => key(s.r, s.c)),
        (r, c) => {
          this.pending = null;
          p.pos = { r, c };
          this.log(M.startPick(p.name, this.coord(r, c)), 'move');
          done();
        }, { tag: 'start' });
    }

    // ================= rozmístění na začátku =================
    beginSetup() {
      const id = this.setupOrder.find(i => !this.players[i].pos);
      if (id == null) { this.cur = this.first; this.beginTurn(); return; }
      const p = this.players[id];
      this.phase = 'setup';
      this.askCell(p.id, M.hint.setup(p.name),
        this.freeStarts().map(s => key(s.r, s.c)),
        (r, c) => {
          this.pending = null;
          p.pos = { r, c };
          this.log(`${p.name} obsazuje startovní pole.`, 'move');
          this.beginSetup();
        }, { tag: 'setup' });
    }

    randomStarts() {
      if (this.phase !== 'setup') return;
      this.players.forEach(p => {
        if (p.pos) return;
        const free = this.freeStarts();
        const s = free[rnd(free.length)];
        p.pos = { r: s.r, c: s.c };
      });
      this.log('Žáby byly rozmístěny náhodně.', 'sys');
      this.pending = null;
      this.beginSetup();
    }

    // ================= průběh tahu =================
    beginTurn() {
      this.clearAutoPass();
      this.jumped = new Set();
      this.zabijak = null;
      this.dice = null;
      this.pending = null;
      this._resumeMove = false;
      this.moveDue = false;
      const p = this.player;

      if (p.skipTurn) {
        p.skipTurn = false;
        this.log(M.mudSkip(p.name), 'bad', { big: true, sfx: 'mud' });
        this.phase = 'done';
        this.skipping = true;
        this.emit();
        this.scheduleAutoPass(this.settings.autoPassMs + 900);
        return;
      }
      this.skipping = false;

      this.log(M.turn(p.name), 'turn');
      this.giveLuck(p);
      this.phase = 'roll';
      this.emit();
    }

    /* Žabí štěstí: kdo výrazně zaostává za vedoucím, dostane na začátku tahu mouchu. */
    giveLuck(p) {
      if (!this.settings.luck || this.players.length < 2) return;
      const best = Math.max(...this.players.map(o => this.credits(o)));
      if (best - this.credits(p) >= this.settings.luckGap) {
        p.insects.fly++;
        this.log(M.luck(p.name), 'gain', { sfx: 'gain' });
      }
    }

    nextPlayer() {
      if (this.winner) return;
      this.clearAutoPass();
      this.cur = (this.cur + 1) % this.players.length;
      if (this.cur === this.first) this.round++;
      this.beginTurn();
    }

    /* Tah se předává sám; tlačítko „Další hráč“ zůstává jen pro netrpělivé. */
    scheduleAutoPass(delay) {
      this.clearAutoPass();
      if (this.winner || this.phase !== 'done') return;
      this._passTimer = setTimeout(() => {
        this._passTimer = null;
        if (this.winner || this.phase !== 'done') return;
        // někdo si mezitím sesílá kouzlo nebo mění hmyz – počká se, až dorozhodne
        if (this.pending) return this.scheduleAutoPass(Math.max(200, this.settings.autoPassMs / 2));
        this.nextPlayer();
      }, delay == null ? this.settings.autoPassMs : delay);
    }

    clearAutoPass() {
      if (this._passTimer) { clearTimeout(this._passTimer); this._passTimer = null; }
    }

    setEvent(ev) {
      this.event = Object.assign({ seq: ++this.eventSeq, playerId: this.player.id, dice: this.dice }, ev);
    }

    rollDice() {
      if (this.phase !== 'roll' || this.pending) return;
      const p = this.player;
      const d10 = 1 + rnd(10);          // 10 = "0" na kostce = Vodník Lojzík
      const black = 1 + rnd(12);
      const white = 1 + rnd(12);
      this.dice = { d10, black, white, seq: ++this.diceSeq };
      this.lastEvent = null;
      this.log(M.rollLog(p.name, d10, black, white), 'roll', { sfx: 'dice' });

      if (d10 === 10) {
        this.phase = 'teleport';
        this.setEvent({ kind: 'vodnik', title: M.vodnikTitle(), sub: M.vodnikSub(p.name) });
        this.log(this.event.title, 'event', { big: true, sfx: 'vodnik' });
        this.askCell(p.id, M.hint.teleport(p.name),
          this.allCellsExceptMagic(),
          (r, c) => {
            this.pending = null;
            // teleport je událost hodu, ne skok – ten hráč provede až po něm (pravidlo 4)
            this.moveDue = true;
            const msg = M.vodnikDone(p.name, this.coord(r, c));
            this.event.sub = msg;
            this.event.r = r; this.event.c = c;
            this.log(msg, 'move', { sfx: 'whoosh' });
            this.moveTo(p, r, c);
          }, { tag: 'teleport' });
        return;
      }

      const type = d10 <= 3 ? 'fly' : d10 <= 6 ? 'firefly' : 'dragonfly';
      const rowFree = black === 12;
      const colFree = white === 12;

      if (rowFree || colFree) {
        const cells = [];
        for (let r = FL.LAKE_MIN; r <= FL.LAKE_MAX; r++) {
          for (let c = FL.LAKE_MIN; c <= FL.LAKE_MAX; c++) {
            if (!rowFree && r !== black) continue;
            if (!colFree && c !== white) continue;
            cells.push(key(r, c));
          }
        }
        const what = rowFree && colFree ? 'pole' : rowFree ? 'řádek' : 'sloupec';
        this.phase = 'event';
        this.setEvent({ kind: type, title: M.twelveTitle(rowFree && colFree ? 2 : 1), sub: M.twelve(p.name, what, type), choosing: true });
        const hint = rowFree && colFree ? M.hint.twelveAny(p.name, type)
          : rowFree ? M.hint.twelveRow(p.name, type) : M.hint.twelveCol(p.name, type);
        this.askCell(p.id, hint, cells,
          (r, c) => { this.pending = null; this.placeEvent(type, r, c, true); },
          { tag: 'event' });
        return;
      }

      this.placeEvent(type, black, white, false);
    }

    /* Hmyz přilétá na jezero.
     * - Dopadne-li na žábu, žába ho okamžitě získá, jako by na pole skočila.
     * - Dopadne-li na Kouzelný leknín, získává ho hráč, který hodil kostkami. */
    placeEvent(type, r, c, chosen) {
      const p = this.player;
      const pos = this.coord(r, c);
      const ev = { kind: type, r, c, chosen: !!chosen, title: M.arrive(type), gainedBy: null };

      if (FL.isMagic(r, c)) {
        p.insects[type]++;
        ev.gainedBy = p.id;
        ev.magic = true;
        ev.sub = M.landsOnMagic(p.name, type);
        this.setEvent(ev);
        this.log(`${ev.title} ${ev.sub}`, 'event', { sfx: 'magic', big: true });
      } else {
        this.addInsect(r, c, type);
        this.lastEvent = { r, c };
        ev.sub = M.landsOn(type, pos);
        const frogs = this.at(r, c);
        if (frogs.length) {
          const lucky = frogs.indexOf(p) >= 0 ? p : frogs[0];
          ev.gainedBy = lucky.id;
          ev.sub = `Pole ${pos}: ` + M.landsOnFrog(lucky.name, type);
          this.setEvent(ev);
          this.log(`${ev.title} ${ev.sub}`, 'event', { sfx: 'bug', big: true });
          this.takeInsectsAt(lucky, r, c);
        } else {
          this.setEvent(ev);
          this.log(`${ev.title} ${ev.sub}`, 'event', { sfx: 'bug' });
        }
      }
      this.startMovePhase();
    }

    allCellsExceptMagic() {
      const out = [];
      for (let r = 0; r < FL.SIZE; r++) {
        for (let c = 0; c < FL.SIZE; c++) {
          if (FL.isMagic(r, c)) continue;
          out.push(key(r, c));
        }
      }
      return out;
    }

    startMovePhase() {
      const p = this.player;
      const afterVodnik = this.moveDue;
      this._resumeMove = false;
      this.moveDue = false;
      this.phase = 'move';
      this.askCell(p.id, afterVodnik ? M.hint.moveAfterVodnik(p.name) : M.hint.move(p.name),
        this.neighbourKeys(p.pos.r, p.pos.c),
        (r, c) => {
          this.pending = null;
          this.log(M.move(p.name, this.coord(r, c)), 'move');
          this.moveTo(p, r, c);
        },
        { deferrable: true, tag: 'move' });   // nabídku skoku lze odložit kvůli kouzlu či světlušce
    }

    canLeap() {
      const p = this.player;
      if (this.phase !== 'move' || this.interrupted || this.winner) return false;
      const t = this.tile(p.pos.r, p.pos.c);
      return t.type === T.BIG && this.credits(p) >= this.settings.leapPrice;
    }

    doLeap() {
      if (!this.canLeap()) return;
      const p = this.player;
      this.spend(p, this.settings.leapPrice);
      this.pending = null;
      this._resumeMove = false;
      this.moveDue = false;
      this.clearAutoPass();
      p.pos = { r: FL.MAGIC_POS.r, c: FL.MAGIC_POS.c };
      this.winner = p;
      this.phase = 'won';
      this.log(M.leap(p.name, this.settings.leapPrice), 'win', { sfx: 'leap' });
      this.log(M.win(p.name), 'win', { big: true, sfx: 'win' });
      this.emit();
    }

    // ================= vyhodnocení dopadu =================
    moveTo(p, r, c) {
      this._resumeMove = false;
      p.pos = { r, c };
      this.takeInsectsAt(p, r, c);
      this.resolveLanding(p);
    }

    resolveLanding(p) {
      const { r, c } = p.pos;
      const victims = this.at(r, c).filter(o => o !== p && !this.jumped.has(o.id));
      if (!victims.length) return this.applyTile(p);

      this.phase = 'jump';
      this.seq(victims,
        (v, next) => this.headJump(p, v, next),
        () => this.askSlide(p));
    }

    /* 8) Skok na hlavu: seber 1 kredit, pak sklouzni na sousední pole. */
    headJump(att, vic, done) {
      this.jumped.add(vic.id);
      this.log(M.headJump(att.name, vic.name), 'bad', { big: true, sfx: 'bonk' });
      this.offerPassive(vic, 'kvakrobatika',
        `${vic.name}, ${att.name} Ti skáče na hlavu! Použiješ Kvákrobatiku a uskočíš?`,
        () => this.askDodge(vic, done),
        () => this.doSteal(att, vic, done));
    }

    askDodge(vic, done) {
      const cells = this.neighbourKeys(vic.pos.r, vic.pos.c).filter(k => {
        const { r, c } = FL.parseKey(k);
        return this.tile(r, c).type !== T.WATER && this.at(r, c).length === 0;
      });
      if (!cells.length) { this.log(`${vic.name} nemá kam uskočit.`, 'sys'); return this.doSteal(null, vic, done); }
      this.askCell(vic.id, M.hint.dodge(vic.name), cells, (r, c) => {
        this.pending = null;
        vic.pos = { r, c };
        this.log(M.dodge(vic.name, this.coord(r, c)), 'card', { sfx: 'hop' });
        done();
      }, { tag: 'dodge' });
    }

    doSteal(att, vic, done) {
      if (!att) return done();
      if (this.credits(vic) <= 0) {
        this.log(M.headEmpty(vic.name), 'sys');
        return this.afterJump(att, vic, done);
      }
      this.offerPassive(vic, 'helma',
        `${vic.name}, použiješ Helmu a neztratíš kredit?`,
        () => { this.log(M.helmet(vic.name), 'card'); this.afterJump(att, vic, done); },
        () => {
          this.spend(vic, 1);
          att.insects.fly += 1;
          this.log(M.headSteal(att.name, vic.name), 'gain', { sfx: 'gain' });
          this.afterJump(att, vic, done);
        });
    }

    /* Žabiják platí jen skokům toho, kdo kartu aktivoval. */
    afterJump(att, vic, done) {
      if (this.zabijak != null && att && this.zabijak === att.id) this.askStart(vic, 'Žabiják', done);
      else done();
    }

    askSlide(p) {
      this.phase = 'slide';
      this.askCell(p.id, M.hint.slide(p.name),
        this.neighbourKeys(p.pos.r, p.pos.c),
        (r, c) => {
          this.pending = null;
          this.log(M.slide(p.name, this.coord(r, c)), 'move');
          this.moveTo(p, r, c);
        }, { tag: 'slide' });
    }

    applyTile(p) {
      const t = this.tile(p.pos.r, p.pos.c);

      switch (t.type) {
        case T.WATER:
          this.phase = 'start';
          this.log(M.water(p.name), 'bad', { big: true, sfx: 'splash' });
          this.askStart(p, M.reasonWater, () => this.endTurn());
          return;

        case T.WHIRL:
          this.log(M.whirl(p.name), 'event', { sfx: 'whirl' });
          this.offerPassive(p, 'plovaky',
            `${p.name}, nasadíš Plováky a zůstaneš nad vírem?`,
            () => { this.log(M.floats(p.name), 'card'); this.endTurn(); },
            () => this.askWhirlDir(p, t));
          return;

        case T.TRAMPOLINE:
          this.log(M.tramp(p.name), 'event', { sfx: 'boing' });
          this.askTrampolineDir(p, t);
          return;

        case T.MUSHROOM: {
          const card = this.drawCard(p);
          if (card) this.log(M.mushroom(p.name), 'card', { sfx: 'card' });
          this.endTurn();
          return;
        }

        case T.MAGIC:
          this.log(M.magicNoWin(), 'sys');
          this.endTurn();
          return;

        /* Bahno: hráč vynechá svůj následující tah – nehází kostkami ani neskáče.
         * Kdo do bahna zapadne ještě před svým skokem (např. po Vodníkovi),
         * přichází i o zbytek tohoto tahu. */
        case T.MUD:
          p.skipTurn = true;
          if (p === this.player) this.moveDue = false;
          this.log(M.mud(p.name), 'bad', { big: true, sfx: 'mud' });
          this.endTurn();
          return;

        default:
          this.endTurn();
      }
    }

    /* Vodní vír: cíl se vybírá kliknutím na zvýrazněné pole (konec šipky). */
    askWhirlDir(p, t) {
      const step = FL.WHIRL_STEP;
      const cells = t.dirs
        .map(([dr, dc]) => [p.pos.r + dr * step, p.pos.c + dc * step])
        .filter(([r, c]) => FL.inBoard(r, c))
        .map(([r, c]) => key(r, c));
      this.phase = 'whirl';
      this.askCell(p.id, M.hint.whirl(p.name), cells, (r, c) => {
        this.pending = null;
        this.log(M.whirlMove(p.name, this.coord(r, c)), 'move', { sfx: 'whoosh' });
        this.moveTo(p, r, c);
      }, { tag: 'whirl', from: key(p.pos.r, p.pos.c) });
    }

    /* 5) Trampolína: o 3 pole ve směru šipky – cíl se vybírá kliknutím. */
    askTrampolineDir(p, t) {
      const step = FL.TRAMPOLINE_STEP;
      const cells = t.dirs
        .map(([dr, dc]) => [p.pos.r + dr * step, p.pos.c + dc * step])
        .filter(([r, c]) => FL.inBoard(r, c))
        .map(([r, c]) => key(r, c));
      if (!cells.length) { this.log('Trampolína nemá kam odpálit.', 'sys'); return this.endTurn(); }
      this.phase = 'trampoline';
      this.askCell(p.id, M.hint.tramp(p.name), cells, (r, c) => {
        this.pending = null;
        this.log(M.trampMove(p.name, this.coord(r, c)), 'move', { sfx: 'whoosh' });
        this.moveTo(p, r, c);
      }, { tag: 'tramp', from: key(p.pos.r, p.pos.c) });
    }

    endTurn() {
      if (this.winner) return;
      this.pending = null;
      this._resumeMove = false;

      // po teleportu (a jeho následcích) hráči pořád zbývá vlastní skok
      if (this.moveDue) {
        this.startMovePhase();
        return;
      }

      this.phase = 'done';
      this.emit();
      this.scheduleAutoPass();
    }

    // ================= vstupy =================
    pickCell(r, c) {
      const p = this.pending;
      if (!p) return;
      // u výběru hráče jde kliknout i na pole, kde jeho žába stojí
      if (p.kind === 'player') {
        const hit = this.at(r, c).find(o => p.players.indexOf(o.id) >= 0);
        if (hit) this.pickPlayer(hit.id);
        return;
      }
      if (p.kind !== 'cell') return;
      if (p.cells.indexOf(key(r, c)) < 0) return;
      p.handler(r, c);
      this.maybeResumeMove();
      this.emit();
    }

    pickOption(i) {
      const p = this.pending;
      if (!p || p.kind !== 'choice') return;
      const opt = p.options[i];
      if (!opt) return;
      p.handler(opt.value);
      this.maybeResumeMove();
      this.emit();
    }

    pickPlayer(id) {
      const p = this.pending;
      if (!p || p.kind !== 'player') return;
      if (p.players.indexOf(id) < 0) return;
      p.handler(this.players[id]);
      this.maybeResumeMove();
      this.emit();
    }

    cancelPending() {
      if (this.pending && this.pending.cancel) {
        this.pending.cancel();
        this.pending = null;
        this.maybeResumeMove();
        this.emit();
      }
    }

    maybeResumeMove() {
      if (this._resumeMove && !this.pending && !this.winner && this.phase === 'move') {
        this._resumeMove = false;
        this.startMovePhase();
      }
    }

    /* Odloží rozehranou nabídku skoku, aby šlo mezitím seslat kouzlo
     * nebo použít světlušku. */
    beginInterrupt() {
      if (this.pending && this.pending.deferrable) {
        this.pending = null;
        this._resumeMove = true;
      }
    }

    /* Akce (kouzlo, světluška) jde kdykoli během hry – i mimo vlastní tah –
     * dokud se nečeká na jiné rozhodnutí. Odložit jde jen nabídka skoku. */
    canAct() {
      if (this.winner || this.phase === 'won' || this.phase === 'setup') return false;
      return !this.pending || !!this.pending.deferrable;
    }

    /* Hráč, za kterého se akce provádí; výchozí je ten, kdo je na tahu. */
    owner(p) {
      if (p == null) return this.player;
      return typeof p === 'number' ? this.players[p] : p;
    }

    /* Jediný vstup do enginu. `seat` = kdo akci posílá (online);
     * null = hra na jednom zařízení, kde smí kdokoli cokoli. */
    apply(a, seat) {
      if (!a || typeof a !== 'object') return;
      const free = seat == null;
      const pend = this.pending;
      const isActor = free || (pend && pend.actorId === seat);
      const onTurn = free || seat === this.cur;
      const self = free || a.who === seat;
      try {
        switch (a.type) {
          case 'cell': if (isActor) this.pickCell(+a.r, +a.c); break;
          case 'option': if (isActor) this.pickOption(+a.i); break;
          case 'player': if (isActor) this.pickPlayer(+a.id); break;
          case 'cancel': if (isActor) this.cancelPending(); break;
          case 'roll': if (onTurn) this.rollDice(); break;
          case 'leap': if (onTurn) this.doLeap(); break;
          case 'next': if (onTurn && this.phase === 'done' && !this.pending) this.nextPlayer(); break;
          case 'randomStarts': if (free) this.randomStarts(); break;
          case 'card': if (self) this.playCard(String(a.uid), +a.who); break;
          case 'firefly': if (self) this.fireflyAttack(+a.who); break;
          case 'exchange': if (self) this.exchange(a.dir === 'merge' ? 'merge' : 'split', +a.who); break;
          default: return;
        }
      } catch (e) {
        console.error('Žabí jezero – chyba akce', a, e);
      }
      this.emit();
    }

    // ================= světluška a banka =================
    /* 6) Útok světluškou: vrátíš ji do banku a vezmeš jinému hráči 1 kredit – kdykoli. */
    canFirefly(who) {
      if (!this.canAct()) return false;
      const p = this.owner(who);
      if (!p) return false;
      return p.insects.firefly > 0 && this.players.some(o => o !== p && this.credits(o) > 0);
    }

    fireflyAttack(who) {
      if (!this.canFirefly(who)) return;
      const p = this.owner(who);
      this.beginInterrupt();
      const ok = this.askPlayer(M.hint.firefly(p.name),
        o => o !== p && this.credits(o) > 0,
        target => {
          this.pending = null;
          p.insects.firefly--;
          this.spend(target, 1);
          p.insects.fly++;
          this.log(M.fireflyHit(p.name, target.name), 'gain', { sfx: 'zap', big: true });
        }, p.id, 'firefly');
      if (!ok) this.maybeResumeMove();
      this.emit();
    }

    /* 6) Vážky a mouchy lze měnit ve stanoveném poměru – zde 1 vážka = 2 mouchy. */
    canExchange(dir, who) {
      if (!this.canAct()) return false;
      const p = this.owner(who);
      if (!p) return false;
      return dir === 'split' ? p.insects.dragonfly > 0 : p.insects.fly >= 2;
    }

    exchange(dir, who) {
      if (!this.canExchange(dir, who)) return;
      const p = this.owner(who);
      if (dir === 'split') {
        p.insects.dragonfly--; p.insects.fly += 2;
        this.log(M.exchangeSplit(p.name), 'gain');
      } else {
        p.insects.fly -= 2; p.insects.dragonfly++;
        this.log(M.exchangeMerge(p.name), 'gain');
      }
      this.emit();
    }

    // ================= kouzla =================
    /* 9) Kouzla lze používat kdykoli během hry – i mimo svůj tah. */
    canPlayCard(who) {
      if (!this.canAct()) return false;
      return !!this.owner(who);
    }

    playCard(uid, who) {
      if (!this.canPlayCard(who)) return;
      const p = this.owner(who);
      const card = p.hand.find(c => c.uid === uid);
      if (!card) return;
      const def = FL.CARD_BY_ID[card.id];
      if (def.passive) {
        this.log(`${def.name} je pasivní kouzlo – nabídne se samo, až nastane situace, na kterou reaguje.`, 'sys');
        this.emit();
        return;
      }
      const fn = this.spells[card.id];
      if (!fn) return;
      this.beginInterrupt();
      fn.call(this, p, uid, def);
      this.maybeResumeMove();
      this.emit();
    }

    areaCells(cr, cc, size) {
      const rad = (size - 1) / 2;
      const out = [];
      for (let r = cr - rad; r <= cr + rad; r++) {
        for (let c = cc - rad; c <= cc + rad; c++) {
          if (FL.inBoard(r, c)) out.push({ r, c });
        }
      }
      return out;
    }

    attackArea(caster, uid, def, size) {
      this.askCell(caster.id, `${caster.name}, ${def.name}: vyber střed zasažené oblasti ${size} × ${size}.`,
        this.allCellsExceptMagic().concat([key(FL.MAGIC_POS.r, FL.MAGIC_POS.c)]),
        (r, c) => {
          this.pending = null;
          this.cast(caster, uid);
          this.log(`${def.name} útočí na oblast ${size}×${size} se středem ${this.coord(r, c)}.`, 'card', { sfx: 'attack' });

          const area = this.areaCells(r, c, size);
          let loot = 0;
          const hit = [];
          area.forEach(cell => {
            if (this.insectsAt(cell.r, cell.c)) loot += this.takeInsectsAt(caster, cell.r, cell.c);
            this.at(cell.r, cell.c).forEach(pl => { if (pl !== caster) hit.push(pl); });
          });
          this.log(loot ? `${caster.name} získává z oblasti hmyz za ${loot} kr.`
                        : 'V zasažené oblasti nebyl žádný hmyz.', loot ? 'gain' : 'sys');

          this.seq(hit, (v, next) => {
            this.offerPassive(v, 'bublina',
              `${v.name}, schováš se do Bubliny před kouzlem ${def.name}?`,
              () => { this.log(M.bubble(v.name), 'card'); next(); },
              () => this.askStart(v, def.name, next));
          });
        },
        { area: size, cancel: () => {}, tag: 'area' });
    }

    // ================= snímek stavu pro vykreslení =================
    /* `seat` = pro koho (cizí karty v ruce se skryjí); null = vše viditelné. */
    snapshot(seat) {
      const pend = this.pending;
      const now = Date.now();
      return {
        v: this.version,
        phase: this.phase,
        skipping: !!this.skipping,
        round: this.round,
        cur: this.cur,
        first: this.first,
        winnerId: this.winner ? this.winner.id : null,
        settings: Object.assign({}, this.settings),
        players: this.players.map(p => ({
          id: p.id, idx: p.idx, name: p.name, bot: p.bot, offline: p.offline,
          pos: p.pos ? { r: p.pos.r, c: p.pos.c } : null,
          insects: Object.assign({}, p.insects),
          credits: this.credits(p),
          handCount: p.hand.length,
          hand: seat == null || seat === p.id ? p.hand.map(c => ({ uid: c.uid, id: c.id })) : null,
          skipTurn: p.skipTurn,
          scoreStamp: p.scoreStamp,
          jumped: this.jumped.has(p.id)
        })),
        insects: JSON.parse(JSON.stringify(this.insects)),
        pending: pend ? {
          kind: pend.kind, tag: pend.tag || null, seq: pend.seq,
          actorId: pend.actorId, hint: pend.hint,
          cells: pend.cells || null,
          options: pend.options ? pend.options.map(o => o.label) : null,
          players: pend.players || null,
          area: pend.area || null,
          from: pend.from || null,
          cancel: !!pend.cancel,
          deferrable: !!pend.deferrable
        } : null,
        dice: this.dice ? Object.assign({}, this.dice) : null,
        event: this.event ? JSON.parse(JSON.stringify(this.event)) : null,
        lastEvent: this.lastEvent,
        log: this.logLines.slice(0, 80),
        deck: this.deck.length,
        discard: this.discard.length,
        canAct: this.canAct(),
        canLeap: this.canLeap(),
        zabijak: this.zabijak,
        deadline: this.deadline ? {
          actorId: this.deadline.actorId,
          left: Math.max(0, this.deadline.at - now),
          total: this.deadline.total
        } : null
      };
    }

    /* Ukončení hry – zastaví časovače (při odchodu z místnosti / nové hře). */
    destroy() {
      this.clearAutoPass();
      this.listeners = [];
      this.winner = this.winner || { id: -1 };
    }
  }

  Game.prototype.spells = {
    volavka(p, uid, def) { this.attackArea(p, uid, def, 5); },
    stika(p, uid, def) { this.attackArea(p, uid, def, 3); },

    hurikan(p, uid) {
      this.cast(p, uid);
      const hands = this.players.map(pl => pl.hand);
      this.players.forEach((pl, i) => (pl.hand = hands[(i - 1 + hands.length) % hands.length]));
      this.log('Hurikán! Karty putují po směru hodinových ručiček.', 'card', { sfx: 'whoosh' });
    },

    tajfun(p, uid) {
      this.cast(p, uid);
      const hands = this.players.map(pl => pl.hand);
      this.players.forEach((pl, i) => (pl.hand = hands[(i + 1) % hands.length]));
      this.log('Tajfun! Karty putují proti směru hodinových ručiček.', 'card', { sfx: 'whoosh' });
    },

    cerna_ruka(p, uid) {
      const ok = this.askPlayer(`${p.name}, Černá ruka: vyber hráče, kterému sebereš 1 kus hmyzu.`,
        pl => pl !== p && this.bugCount(pl) > 0,
        target => {
          this.pending = null;
          const opts = FL.INSECT_KEYS.filter(t => target.insects[t] > 0)
            .map(t => ({ label: FL.INSECTS[t].name, value: t }));
          this.askChoice(p.id, `${p.name}, který hmyz sebereš hráči ${target.name}?`, opts, t => {
            this.pending = null;
            this.cast(p, uid);
            target.insects[t]--;
            p.insects[t]++;
            this.log(`Černá ruka bere hráči ${target.name} ${FL.INSECT_FORMS[t].acc} pro hráče ${p.name}.`, 'card');
          }, { tag: 'cerna_ruka_type' });
        }, p.id, 'cerna_ruka');
      if (!ok) this.maybeResumeMove();
    },

    cerna_magie(p, uid) {
      const ok = this.askPlayer(`${p.name}, Černá magie: vyber hráče, kterému sebereš 1 kartu kouzla.`,
        pl => pl !== p && pl.hand.length > 0,
        target => {
          this.pending = null;
          this.cast(p, uid);
          const stolen = target.hand.splice(rnd(target.hand.length), 1)[0];
          p.hand.push(stolen);
          this.log(`Černá magie: ${p.name} bere hráči ${target.name} jednu kartu kouzla.`, 'card');
        }, p.id, 'cerna_magie');
      if (!ok) this.maybeResumeMove();
    },

    jazyk(p, uid) {
      const cells = this.neighbourKeys(p.pos.r, p.pos.c, false)
        .filter(k => { const { r, c } = FL.parseKey(k); return !!this.insectsAt(r, c); });
      if (!cells.length) { this.log('Na sousedních polích není žádný hmyz.', 'sys'); return; }
      this.askCell(p.id, `${p.name}, Vystřelovací jazyk: vyber sousední pole, ze kterého sebereš kredity.`,
        cells,
        (r, c) => {
          this.pending = null;
          this.cast(p, uid);
          this.takeInsectsAt(p, r, c);
        },
        { cancel: () => {}, tag: 'jazyk' });
    },

    zlata_muska(p, uid) { this.cast(p, uid); p.insects.fly++; this.log(`${p.name} bere z banku mouchu.`, 'gain'); },
    svetluska(p, uid) { this.cast(p, uid); p.insects.firefly++; this.log(`${p.name} bere z banku světlušku.`, 'gain'); },
    duhova_vazka(p, uid) { this.cast(p, uid); p.insects.dragonfly++; this.log(`${p.name} bere z banku vážku.`, 'gain'); },

    zamena(p, uid) {
      const ok = this.askPlayer(`${p.name}, Záměna: vyber hráče, se kterým si prohodíš místo.`,
        pl => pl !== p && !!pl.pos,
        target => {
          this.pending = null;
          this.cast(p, uid);
          const tmp = p.pos; p.pos = target.pos; target.pos = tmp;
          this.log(`${p.name} a ${target.name} si vyměňují místa.`, 'card', { sfx: 'whoosh' });
        }, p.id, 'zamena');
      if (!ok) this.maybeResumeMove();
    },

    kraken(p, uid) {
      this.cast(p, uid);
      this.log('Kraken se vynořil! Všichni ostatní odevzdávají 1 kredit.', 'card', { sfx: 'attack' });
      this.players.forEach(pl => {
        if (pl === p) return;
        if (this.credits(pl) > 0) { this.spend(pl, 1); this.log(`${pl.name} odevzdává 1 kredit do banku.`, 'bad'); }
      });
    },

    eko(p, uid) {
      this.cast(p, uid);
      const n = Object.keys(this.insects).length;
      this.insects = {};
      this.lastEvent = null;
      this.log(`Eko katastrofa! Z plánu mizí hmyz z ${n} polí.`, 'card');
    },

    zabijak(p, uid) {
      this.cast(p, uid);
      this.zabijak = p.id;
      this.log('Žabiják: žáby, na které teď hráč skočí, se vrátí na START.', 'card');
      if (p !== this.player)
        this.log(`${p.name} ale není na tahu – Žabiják platí jen do konce tohoto tahu.`, 'sys');
    }
  };

  /* Pořadí v tabulce: 1) kredity, 2) kdo skóre dosáhl později, 3) abecedně. */
  FL.rankPlayers = function (players, creditsOf) {
    const cr = creditsOf || (p => p.credits);
    return players.slice().sort((a, b) =>
      (cr(b) - cr(a)) ||
      (b.scoreStamp - a.scoreStamp) ||
      a.name.localeCompare(b.name, 'cs'));
  };

  FL.Game = Game;
})();
