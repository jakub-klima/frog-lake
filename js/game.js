/* Žabí jezero – herní engine (pravidla)
 *
 * Vyhodnocení dopadu je řetěz pokračování (continuations), aby se šlo
 * uprostřed tahu zeptat i jiného hráče než toho, kdo je právě na tahu –
 * typicky "chceš použít Helmu?" nebo "vyber si volný START".
 * Každý dotaz je objekt `pending` s `actorId`, tedy s hráčem, který rozhoduje.
 */
(function () {
  const FL = window.FL;
  const T = FL.TILE;
  const key = FL.key;

  const rnd = n => Math.floor(Math.random() * n);
  const shuffle = a => {
    for (let i = a.length - 1; i > 0; i--) {
      const j = rnd(i + 1);
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  class Game {
    constructor(opts) {
      this.onChange = null;
      this.settings = {
        leapPrice: opts.leapPrice != null ? opts.leapPrice : 10,
        autoPassMs: opts.autoPassMs != null ? opts.autoPassMs : 1200
      };
      this.tiles = FL.buildBoard();
      this.insects = {};           // "r,c" -> {fly, firefly, dragonfly}
      this.deck = shuffle(FL.buildDeck());
      this.discard = [];
      this.logLines = [];
      this.winner = null;
      this.dice = null;
      this.pending = null;
      this.phase = 'setup';
      this.lastEvent = null;       // pole, kam právě přiletěl hmyz (pro zvýraznění)
      this.round = 1;
      this.cur = 0;
      this.jumped = new Set();
      this.zabijak = null;         // id hráče, který v tomto tahu aktivoval Žabijáka
      this._resumeMove = false;
      this.moveDue = false;        // skok tahu ještě čeká (teleport se za skok nepočítá)
      this._passTimer = null;

      this.players = opts.players.map((name, i) => ({
        id: i,
        idx: i,
        name: name,
        pos: null,               // startovní pole si hráč vybere sám
        insects: { fly: 0, firefly: 0, dragonfly: 0 },
        hand: [],
        skipTurn: false
      }));

      this.log('Vítejte u Žabího jezera! Cena veleskoku: ' + this.settings.leapPrice + ' kreditů.', 'sys');
      this.beginSetup();
    }

    // ================= pomocné =================
    emit() { if (this.onChange) this.onChange(); }

    log(msg, cls) {
      this.logLines.unshift({ msg, cls: cls || '' });
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
        .filter(n => !(skipMagic !== false && n.r === FL.MAGIC_POS.r && n.c === FL.MAGIC_POS.c))
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
      if (gained) this.log(`${p.name} sbírá hmyz za ${gained} kr. na poli ${this.coord(r, c)}.`, 'gain');
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
      this.log(`${p.name} bere kouzlo: ${FL.CARD_BY_ID[card.id].name}.`, 'card');
      return card;
    }

    discardFrom(p, uid) {
      const i = p.hand.findIndex(c => c.uid === uid);
      if (i < 0) return null;
      const card = p.hand.splice(i, 1)[0];
      this.discard.push(card);
      return card;
    }

    discardById(p, id) {
      const i = p.hand.findIndex(c => c.id === id);
      if (i < 0) return false;
      this.discard.push(p.hand.splice(i, 1)[0]);
      return true;
    }

    // ================= dotazy =================
    ask(obj) { this.pending = obj; this.emit(); }

    askCell(actorId, hint, cells, handler, extra) {
      this.ask(Object.assign({ kind: 'cell', actorId, hint, cells, handler }, extra || {}));
    }

    askChoice(actorId, hint, options, handler) {
      this.ask({ kind: 'choice', actorId, hint, options, handler });
    }

    askPlayer(hint, filter, handler, actorId) {
      const ids = this.players.filter(filter).map(p => p.id);
      if (!ids.length) { this.log('Není koho zvolit.', 'sys'); return false; }
      this.ask({
        kind: 'player',
        actorId: actorId == null ? this.player.id : actorId,
        hint, players: ids, cancel: () => {}, handler
      });
      return true;
    }

    /* Nabídne majiteli pasivní karty, zda ji chce použít. */
    offerPassive(p, cardId, hint, onYes, onNo) {
      if (!p.hand.some(c => c.id === cardId)) return onNo();
      const def = FL.CARD_BY_ID[cardId];
      this.askChoice(p.id, hint, [
        { label: 'Použít', value: true },
        { label: 'Nepoužít', value: false }
      ], v => {
        this.pending = null;
        if (v) {
          this.discardById(p, cardId);
          this.log(`${p.name} používá kouzlo ${def.name}.`, 'card');
          onYes();
        } else onNo();
      });
    }

    /* Návrat na START – pole si vybírá postižený hráč. */
    askStart(p, reason, done) {
      const free = this.freeStarts().filter(s => !(p.pos && p.pos.r === s.r && p.pos.c === s.c));
      const list = free.length ? free : FL.STARTS;
      this.log(`${p.name} se vrací na START (${reason}).`, 'bad');
      this.askCell(p.id, `${p.name} – vyber si volné startovní pole.`,
        list.map(s => key(s.r, s.c)),
        (r, c) => {
          this.pending = null;
          p.pos = { r, c };
          this.log(`${p.name} nasedá na start (${r},${c}).`, 'move');
          done();
        });
    }

    // ================= rozmístění na začátku =================
    beginSetup() {
      const p = this.players.find(pl => !pl.pos);
      if (!p) { this.cur = 0; this.beginTurn(); return; }
      this.phase = 'setup';
      this.askCell(p.id, `${p.name} – vyber si startovní pole.`,
        this.freeStarts().map(s => key(s.r, s.c)),
        (r, c) => {
          this.pending = null;
          p.pos = { r, c };
          this.log(`${p.name} obsazuje start (${r},${c}).`, 'move');
          this.beginSetup();
        });
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
        this.log(`${p.name} uvízl v bahně – vynechává tah.`, 'bad');
        this.phase = 'done';
        this.emit();
        this.scheduleAutoPass(this.settings.autoPassMs + 800);
        return;
      }
      this.phase = 'roll';
      this.emit();
    }

    nextPlayer() {
      if (this.winner) return;
      this.clearAutoPass();
      this.cur = (this.cur + 1) % this.players.length;
      if (this.cur === 0) this.round++;
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

    rollDice() {
      if (this.phase !== 'roll' || this.pending) return;
      const d10 = 1 + rnd(10);          // 10 = "0" na kostce = Vodník Lojzík
      const black = 1 + rnd(12);
      const white = 1 + rnd(12);
      this.dice = { d10, black, white };
      this.lastEvent = null;
      this.log(`${this.player.name} hodil D10=${d10 === 10 ? '10/0' : d10}, černá D12=${black}, bílá D12=${white}.`, 'roll');

      if (d10 === 10) {
        this.phase = 'teleport';
        this.askCell(this.player.id,
          'Vodník Lojzík: teleportuj svou žábu na libovolné pole kromě Kouzelného leknínu. Skok tahu ti pak ještě zůstává.',
          this.allCellsExceptMagic(),
          (r, c) => {
            this.pending = null;
            // teleport je událost hodu, ne skok – ten hráč provede až po něm (pravidlo 4)
            this.moveDue = true;
            this.log(`${this.player.name} se teleportuje na ${this.coord(r, c)}.`, 'move');
            this.moveTo(this.player, r, c);
          });
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
            if (r === FL.MAGIC_POS.r && c === FL.MAGIC_POS.c) continue;
            cells.push(key(r, c));
          }
        }
        this.phase = 'event';
        this.askCell(this.player.id,
          `Padla 12 – vyber pole, kam přiletí ${FL.INSECTS[type].name.toLowerCase()}.`,
          cells,
          (r, c) => { this.pending = null; this.placeEvent(type, r, c); });
        return;
      }

      this.placeEvent(type, black, white);
    }

    placeEvent(type, r, c) {
      if (r === FL.MAGIC_POS.r && c === FL.MAGIC_POS.c) {
        this.log('Událost padla na Kouzelný leknín – hmyz se neumisťuje.', 'sys');
      } else {
        this.addInsect(r, c, type);
        this.lastEvent = { r, c };
        this.log(`Na pole ${this.coord(r, c)} přilétá ${FL.INSECTS[type].name.toLowerCase()} (${FL.INSECTS[type].value} kr.).`, 'event');
      }
      this.startMovePhase();
    }

    allCellsExceptMagic() {
      const out = [];
      for (let r = 0; r < FL.SIZE; r++) {
        for (let c = 0; c < FL.SIZE; c++) {
          if (r === FL.MAGIC_POS.r && c === FL.MAGIC_POS.c) continue;
          out.push(key(r, c));
        }
      }
      return out;
    }

    startMovePhase() {
      const p = this.player;
      this._resumeMove = false;
      this.moveDue = false;
      this.phase = 'move';
      this.askCell(p.id, 'Skoč na sousední pole – vodorovně, svisle nebo úhlopříčně.',
        this.neighbourKeys(p.pos.r, p.pos.c),
        (r, c) => {
          this.pending = null;
          this.log(`${p.name} skáče na ${this.coord(r, c)}.`, 'move');
          this.moveTo(p, r, c);
        },
        { deferrable: true });   // nabídku skoku lze odložit kvůli kouzlu či bance
    }

    canLeap() {
      const p = this.player;
      if (this.phase !== 'move' || this.interrupted) return false;
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
      this.log(`${p.name} platí ${this.settings.leapPrice} kreditů a provádí VELESKOK!`, 'win');
      this.log(`🏆 ${p.name} doskočil na Kouzelný leknín a vyhrává Žabí jezero!`, 'win');
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
      this.offerPassive(vic, 'kvakrobatika',
        `${att.name} skáče na hlavu hráči ${vic.name}. Použít Kvákrobatiku a uskočit?`,
        () => this.askDodge(vic, done),
        () => this.doSteal(att, vic, done));
    }

    askDodge(vic, done) {
      const cells = this.neighbourKeys(vic.pos.r, vic.pos.c).filter(k => {
        const { r, c } = FL.parseKey(k);
        return this.tile(r, c).type !== T.WATER && this.at(r, c).length === 0;
      });
      if (!cells.length) { this.log(`${vic.name} nemá kam uskočit.`, 'sys'); return this.doSteal(null, vic, done); }
      this.askCell(vic.id, `${vic.name} – uskoč o 1 pole v libovolném směru.`, cells, (r, c) => {
        this.pending = null;
        vic.pos = { r, c };
        this.log(`${vic.name} uskakuje na ${this.coord(r, c)} a vyhýbá se následkům skoku.`, 'card');
        done();
      });
    }

    doSteal(att, vic, done) {
      if (!att) return done();
      this.log(`${att.name} skáče na hlavu hráči ${vic.name}!`, 'bad');
      if (this.credits(vic) <= 0) {
        this.log(`${vic.name} nemá žádný kredit k sebrání.`, 'sys');
        return this.afterJump(att, vic, done);
      }
      this.offerPassive(vic, 'helma',
        `${vic.name} – použít Helmu a neztratit kredit?`,
        () => { this.log(`${vic.name} má Helmu, kredit neztrácí.`, 'card'); this.afterJump(att, vic, done); },
        () => {
          this.spend(vic, 1);
          att.insects.fly += 1;
          this.log(`${att.name} bere hráči ${vic.name} 1 kredit.`, 'gain');
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
      this.askCell(p.id, 'Po skoku na hlavu sklouzni na libovolné sousední pole.',
        this.neighbourKeys(p.pos.r, p.pos.c),
        (r, c) => {
          this.pending = null;
          this.log(`${p.name} sklouzl na ${this.coord(r, c)}.`, 'move');
          this.moveTo(p, r, c);
        });
    }

    applyTile(p) {
      const t = this.tile(p.pos.r, p.pos.c);

      switch (t.type) {
        case T.WATER:
          this.phase = 'start';
          this.log(`${p.name} spadl do vody!`, 'bad');
          this.askStart(p, 'voda', () => this.endTurn());
          return;

        case T.WHIRL:
          this.log(`${p.name} se dostal do Vodního víru.`, 'event');
          this.offerPassive(p, 'plovaky',
            `${p.name} – použít Plováky a zůstat nad vírem?`,
            () => { this.log(`${p.name} zůstává nad vírem.`, 'card'); this.endTurn(); },
            () => this.askWhirlDir(p, t));
          return;

        case T.TRAMPOLINE:
          this.log(`${p.name} dopadl na Trampolínu.`, 'event');
          this.askTrampolineDir(p, t);
          return;

        case T.MUSHROOM:
          this.log(`${p.name} přistál na Houbě.`, 'card');
          this.drawCard(p);
          this.endTurn();
          return;

        case T.MAGIC:
          this.log('Na Kouzelný leknín lze zvítězit pouze veleskokem.', 'sys');
          this.endTurn();
          return;

        case T.MUD:
          p.skipTurn = true;
          this.log(`${p.name} zapadl do bahna – příští tah vynechá.`, 'bad');
          this.endTurn();
          return;

        default:
          this.endTurn();
      }
    }

    askWhirlDir(p, t) {
      const step = FL.WHIRL_STEP;
      const options = t.dirs.map(([dr, dc]) => {
        const r = p.pos.r + dr * step, c = p.pos.c + dc * step;
        return { label: `${FL.arrowGlyph(dr, dc)} na pole ${this.coord(r, c)}`, value: [r, c] };
      });
      this.phase = 'whirl';
      this.askChoice(p.id, 'Vodní vír tě přenese o 2 pole – vyber šipku.', options, v => {
        this.pending = null;
        this.log(`Vír unáší hráče ${p.name} na ${this.coord(v[0], v[1])}.`, 'move');
        this.moveTo(p, v[0], v[1]);
      });
    }

    /* 5) Trampolína: žába se okamžitě posune o 3 pole ve směru šipky dle výběru. */
    askTrampolineDir(p, t) {
      const step = FL.TRAMPOLINE_STEP;
      const options = t.dirs
        .map(([dr, dc]) => [p.pos.r + dr * step, p.pos.c + dc * step, dr, dc])
        .filter(([r, c]) => FL.inBoard(r, c))
        .map(([r, c, dr, dc]) => ({
          label: `${FL.arrowGlyph(dr, dc)} na pole ${this.coord(r, c)}`, value: [r, c]
        }));
      if (!options.length) { this.log('Trampolína nemá kam odpálit.', 'sys'); return this.endTurn(); }
      this.phase = 'trampoline';
      this.askChoice(p.id, 'Trampolína tě odpálí o 3 pole – vyber šipku.', options, v => {
        this.pending = null;
        this.log(`Trampolína odpaluje hráče ${p.name} na ${this.coord(v[0], v[1])}.`, 'move');
        this.moveTo(p, v[0], v[1]);
      });
    }

    endTurn() {
      if (this.winner) return;
      this.pending = null;
      this._resumeMove = false;

      // po teleportu (a jeho následcích) hráči pořád zbývá vlastní skok
      if (this.moveDue) {
        this.log(`${this.player.name} má po teleportu ještě svůj skok.`, 'sys');
        this.startMovePhase();
        return;
      }

      this.phase = 'done';
      this.emit();
      this.scheduleAutoPass();
    }

    // ================= vstupy z UI =================
    pickCell(r, c) {
      const p = this.pending;
      if (!p || p.kind !== 'cell') return;
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
     * nebo vyměnit hmyz v banku. */
    beginInterrupt() {
      if (this.pending && this.pending.deferrable) {
        this.pending = null;
        this._resumeMove = true;
      }
    }

    /* Kdykoli během hry – i mimo vlastní tah – dokud se nečeká na jiné rozhodnutí.
     * Odložit jde jen nabídka skoku, rozehraný dotaz kouzla nikoli. */
    canAct() {
      if (this.winner || this.phase === 'won' || this.phase === 'setup') return false;
      return !this.pending || !!this.pending.deferrable;
    }

    /* Hráč, za kterého se akce provádí; výchozí je ten, kdo je na tahu. */
    owner(p) {
      if (p == null) return this.player;
      return typeof p === 'number' ? this.players[p] : p;
    }

    // ================= banka a hmyz =================
    /* 6) Světlušku lze vrátit do banku a vzít si 1 mouchu od jiného hráče – kdykoli. */
    canTradeFirefly(who) {
      if (!this.canAct()) return false;
      const p = this.owner(who);
      if (!p) return false;
      return p.insects.firefly > 0 && this.players.some(o => o !== p && o.insects.fly > 0);
    }

    tradeFirefly(who) {
      if (!this.canTradeFirefly(who)) return;
      const p = this.owner(who);
      this.beginInterrupt();
      const ok = this.askPlayer(`${p.name} – světluška: vyber hráče, kterému vezmeš 1 mouchu.`,
        o => o !== p && o.insects.fly > 0,
        target => {
          this.pending = null;
          p.insects.firefly--;
          target.insects.fly--;
          p.insects.fly++;
          this.log(`${p.name} vrací světlušku do banku a bere mouchu hráči ${target.name}.`, 'gain');
        }, p.id);
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
        this.log(`${p.name} mění v banku vážku za 2 mouchy.`, 'gain');
      } else {
        p.insects.fly -= 2; p.insects.dragonfly++;
        this.log(`${p.name} mění v banku 2 mouchy za vážku.`, 'gain');
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
      this.askCell(caster.id, `${def.name}: vyber střed zasažené oblasti ${size} × ${size}.`,
        this.allCellsExceptMagic().concat([key(FL.MAGIC_POS.r, FL.MAGIC_POS.c)]),
        (r, c) => {
          this.pending = null;
          this.discardFrom(caster, uid);
          this.log(`${caster.name} sesílá ${def.name} na oblast ${size}×${size} se středem ${this.coord(r, c)}.`, 'card');

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
              `${v.name} – použít Bublinu proti kouzlu ${def.name}?`,
              () => { this.log(`${v.name} je chráněn Bublinou.`, 'card'); next(); },
              () => this.askStart(v, def.name, next));
          });
        },
        { area: size, cancel: () => {} });
    }
  }

  Game.prototype.spells = {
    volavka(p, uid, def) { this.attackArea(p, uid, def, 5); },
    stika(p, uid, def) { this.attackArea(p, uid, def, 3); },

    hurikan(p, uid) {
      this.discardFrom(p, uid);
      const hands = this.players.map(pl => pl.hand);
      this.players.forEach((pl, i) => (pl.hand = hands[(i - 1 + hands.length) % hands.length]));
      this.log(`${p.name} sesílá Hurikán – karty putují po směru hodinových ručiček.`, 'card');
    },

    tajfun(p, uid) {
      this.discardFrom(p, uid);
      const hands = this.players.map(pl => pl.hand);
      this.players.forEach((pl, i) => (pl.hand = hands[(i + 1) % hands.length]));
      this.log(`${p.name} sesílá Tajfun – karty putují proti směru hodinových ručiček.`, 'card');
    },

    cerna_ruka(p, uid) {
      const ok = this.askPlayer('Černá ruka: vyber hráče, kterému sebereš 1 kus hmyzu.',
        pl => pl !== p && this.bugCount(pl) > 0,
        target => {
          this.pending = null;
          const opts = FL.INSECT_KEYS.filter(t => target.insects[t] > 0)
            .map(t => ({ label: FL.INSECTS[t].name, value: t }));
          this.askChoice(p.id, `Který hmyz sebereš hráči ${target.name}?`, opts, t => {
            this.pending = null;
            this.discardFrom(p, uid);
            target.insects[t]--;
            p.insects[t]++;
            this.log(`${p.name} bere Černou rukou ${FL.INSECTS[t].name.toLowerCase()} hráči ${target.name}.`, 'card');
          });
        }, p.id);
      if (!ok) this.maybeResumeMove();
    },

    cerna_magie(p, uid) {
      const ok = this.askPlayer('Černá magie: vyber hráče, kterému sebereš 1 kartu kouzla.',
        pl => pl !== p && pl.hand.length > 0,
        target => {
          this.pending = null;
          this.discardFrom(p, uid);
          const stolen = target.hand.splice(rnd(target.hand.length), 1)[0];
          p.hand.push(stolen);
          this.log(`${p.name} krade hráči ${target.name} kartu ${FL.CARD_BY_ID[stolen.id].name}.`, 'card');
        }, p.id);
      if (!ok) this.maybeResumeMove();
    },

    jazyk(p, uid) {
      const cells = this.neighbourKeys(p.pos.r, p.pos.c, false)
        .filter(k => { const { r, c } = FL.parseKey(k); return !!this.insectsAt(r, c); });
      if (!cells.length) { this.log('Na sousedních polích není žádný hmyz.', 'sys'); return; }
      this.askCell(p.id, 'Vystřelovací jazyk: vyber sousední pole, ze kterého sebereš kredity.',
        cells,
        (r, c) => {
          this.pending = null;
          this.discardFrom(p, uid);
          this.log(`${p.name} vystřeluje jazyk na pole ${this.coord(r, c)}.`, 'card');
          this.takeInsectsAt(p, r, c);
        },
        { cancel: () => {} });
    },

    zlata_muska(p, uid) { this.discardFrom(p, uid); p.insects.fly++; this.log(`${p.name} bere z banku mouchu.`, 'card'); },
    svetluska(p, uid) { this.discardFrom(p, uid); p.insects.firefly++; this.log(`${p.name} bere z banku světlušku.`, 'card'); },
    duhova_vazka(p, uid) { this.discardFrom(p, uid); p.insects.dragonfly++; this.log(`${p.name} bere z banku vážku.`, 'card'); },

    zamena(p, uid) {
      const ok = this.askPlayer('Záměna: vyber hráče, se kterým si prohodíš místo.',
        pl => pl !== p,
        target => {
          this.pending = null;
          this.discardFrom(p, uid);
          const tmp = p.pos; p.pos = target.pos; target.pos = tmp;
          this.log(`${p.name} si mění místo s hráčem ${target.name}.`, 'card');
        }, p.id);
      if (!ok) this.maybeResumeMove();
    },

    kraken(p, uid) {
      this.discardFrom(p, uid);
      this.log(`${p.name} probouzí Krakena!`, 'card');
      this.players.forEach(pl => {
        if (pl === p) return;
        if (this.credits(pl) > 0) { this.spend(pl, 1); this.log(`${pl.name} odevzdává 1 kredit do banku.`, 'bad'); }
      });
    },

    eko(p, uid) {
      this.discardFrom(p, uid);
      const n = Object.keys(this.insects).length;
      this.insects = {};
      this.lastEvent = null;
      this.log(`Eko katastrofa! Z plánu mizí hmyz z ${n} polí.`, 'card');
    },

    zabijak(p, uid) {
      this.discardFrom(p, uid);
      this.zabijak = p.id;
      this.log(`${p.name} aktivuje Žabijáka – žáby, na které v tomto kole skočí, půjdou na START.`, 'card');
      if (p !== this.player)
        this.log(`${p.name} ale není na tahu – Žabiják platí jen do konce tohoto tahu.`, 'sys');
    }
  };

  FL.Game = Game;
})();
