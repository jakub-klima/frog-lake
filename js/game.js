/* Žabí jezero – herní engine (pravidla) */
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
        leapPrice: opts.leapPrice != null ? opts.leapPrice : 10
      };
      this.tiles = FL.buildBoard();
      this.insects = {};           // "r,c" -> {fly, firefly, dragonfly}
      this.deck = shuffle(FL.buildDeck());
      this.discard = [];
      this.logLines = [];
      this.winner = null;
      this.dice = null;
      this.pending = null;
      this.phase = 'roll';

      this.players = opts.players.map((name, i) => ({
        id: i,
        name: name,
        idx: i,
        pos: { r: FL.STARTS[i].r, c: FL.STARTS[i].c },
        insects: { fly: 0, firefly: 0, dragonfly: 0 },
        hand: [],
        skipTurn: false,
        floatOverWhirl: false
      }));

      this.cur = 0;
      this.jumped = new Set();
      this.zabijak = false;

      this.log('Hra začíná. Cena veleskoku: ' + this.settings.leapPrice + ' kreditů.', 'sys');
      this.beginTurn();
    }

    // ---- pomocné ----------------------------------------------------------
    emit() { if (this.onChange) this.onChange(); }

    log(msg, cls) {
      this.logLines.unshift({ msg, cls: cls || '' });
      if (this.logLines.length > 200) this.logLines.pop();
    }

    get player() { return this.players[this.cur]; }

    tile(r, c) { return this.tiles[key(r, c)]; }

    at(r, c) { return this.players.filter(p => p.pos.r === r && p.pos.c === c); }

    credits(p) {
      return p.insects.fly + p.insects.firefly + 2 * p.insects.dragonfly;
    }

    insectsAt(r, c) { return this.insects[key(r, c)] || null; }

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
        if (stack[t]) {
          p.insects[t] += stack[t];
          gained += stack[t] * FL.INSECTS[t].value;
        }
      });
      delete this.insects[k];
      if (gained) this.log(`${p.name} sbírá hmyz za ${gained} kr. na poli ${r}-${c}.`, 'gain');
      return gained;
    }

    /* Odebere hráči hmyz v hodnotě `amount` kreditů.
     * Vážku (2 kr.) lze rozměnit – přebytek se vrací jako moucha z banku. */
    spend(p, amount) {
      if (this.credits(p) < amount) return false;
      let left = amount;
      while (left > 0) {
        if (p.insects.fly > 0) { p.insects.fly--; left--; }
        else if (p.insects.firefly > 0) { p.insects.firefly--; left--; }
        else if (p.insects.dragonfly > 0) {
          p.insects.dragonfly--;
          left -= 2;
          if (left < 0) { p.insects.fly++; left = 0; } // rozměnění vážky
        } else return false;
      }
      return true;
    }

    freeStarts() {
      return FL.STARTS.filter(s => this.at(s.r, s.c).length === 0);
    }

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

    usePassive(p, id) {
      const i = p.hand.findIndex(c => c.id === id);
      if (i < 0) return false;
      const card = p.hand.splice(i, 1)[0];
      this.discard.push(card);
      this.log(`${p.name} používá kouzlo ${FL.CARD_BY_ID[id].name}.`, 'card');
      return true;
    }

    // ---- průběh tahu ------------------------------------------------------
    beginTurn() {
      this.jumped = new Set();
      this.zabijak = false;
      this.dice = null;
      this.pending = null;
      this._resumeMove = false;
      const p = this.player;
      p.floatOverWhirl = false;

      if (p.skipTurn) {
        p.skipTurn = false;
        this.log(`${p.name} uvízl v bahně – vynechává tah.`, 'bad');
        this.phase = 'done';
      } else {
        this.phase = 'roll';
      }
      this.emit();
    }

    nextPlayer() {
      if (this.winner) return;
      this.cur = (this.cur + 1) % this.players.length;
      this.beginTurn();
    }

    rollDice() {
      if (this.phase !== 'roll') return;
      const d10 = 1 + rnd(10);          // 10 = "0" na kostce = Vodník Lojzík
      const black = 1 + rnd(12);
      const white = 1 + rnd(12);
      this.dice = { d10, black, white };
      this.log(`${this.player.name} hodil D10=${d10 === 10 ? '10/0' : d10}, černá D12=${black}, bílá D12=${white}.`, 'roll');

      if (d10 === 10) {
        this.phase = 'teleport';
        this.pending = {
          kind: 'cell',
          hint: 'Vodník Lojzík: teleportuj svou žábu na libovolné pole kromě Kouzelného leknínu.',
          cells: this.allCellsExceptMagic(),
          handler: (r, c) => {
            this.pending = null;
            this.log(`${this.player.name} se teleportuje na ${r}-${c}.`, 'move');
            this.moveTo(this.player, r, c);
          }
        };
        this.emit();
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
        this.pending = {
          kind: 'cell',
          hint: `Padla 12 – vyber pole pro ${FL.INSECTS[type].name.toLowerCase()}.`,
          cells,
          handler: (r, c) => {
            this.pending = null;
            this.placeEvent(type, r, c);
          }
        };
        this.emit();
        return;
      }

      this.placeEvent(type, black, white);
    }

    placeEvent(type, r, c) {
      if (r === FL.MAGIC_POS.r && c === FL.MAGIC_POS.c) {
        this.log('Událost padla na Kouzelný leknín – hmyz se neumisťuje.', 'sys');
      } else {
        this.addInsect(r, c, type);
        this.log(`Na pole ${r}-${c} přilétá ${FL.INSECTS[type].name.toLowerCase()} (${FL.INSECTS[type].value} kr.).`, 'event');
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
      const cells = FL.neighbours(p.pos.r, p.pos.c)
        .filter(n => !(n.r === FL.MAGIC_POS.r && n.c === FL.MAGIC_POS.c))
        .map(n => key(n.r, n.c));

      this.phase = 'move';
      this.pending = {
        kind: 'cell',
        hint: 'Skoč na sousední pole (vodorovně, svisle nebo úhlopříčně).',
        cells,
        handler: (r, c) => {
          this.pending = null;
          this.log(`${p.name} skáče na ${this.coord(r, c)}.`, 'move');
          this.moveTo(p, r, c);
        }
      };
      this.emit();
    }

    coord(r, c) {
      return FL.inLake(r, c) ? `${r}-${c}` : `břeh (${r},${c})`;
    }

    canLeap() {
      const p = this.player;
      if (this.phase !== 'move') return false;
      const t = this.tile(p.pos.r, p.pos.c);
      return t.type === T.BIG && this.credits(p) >= this.settings.leapPrice;
    }

    doLeap() {
      if (!this.canLeap()) return;
      const p = this.player;
      this.spend(p, this.settings.leapPrice);
      this.pending = null;
      p.pos = { r: FL.MAGIC_POS.r, c: FL.MAGIC_POS.c };
      this.winner = p;
      this.phase = 'won';
      this.log(`${p.name} platí ${this.settings.leapPrice} kreditů a provádí VELESKOK na Kouzelný leknín!`, 'win');
      this.log(`🏆 ${p.name} vyhrává Žabí jezero!`, 'win');
      this.emit();
    }

    // ---- vyhodnocení dopadu ----------------------------------------------
    moveTo(p, r, c, opts) {
      opts = opts || {};
      p.pos = { r, c };
      this.takeInsectsAt(p, r, c);
      this.resolveLanding(p, opts);
    }

    resolveLanding(p, opts) {
      opts = opts || {};
      const { r, c } = p.pos;

      if (!opts.noHeadJump) {
        const victims = this.at(r, c).filter(o => o !== p && !this.jumped.has(o.id));
        if (victims.length) {
          victims.forEach(v => this.headJump(p, v));
          // po skoku na hlavu žába vždy sklouzne na libovolné sousední pole
          this.phase = 'slide';
          this.pending = {
            kind: 'cell',
            hint: 'Po skoku na hlavu sklouzni na libovolné sousední pole.',
            cells: FL.neighbours(r, c)
              .filter(n => !(n.r === FL.MAGIC_POS.r && n.c === FL.MAGIC_POS.c))
              .map(n => key(n.r, n.c)),
            handler: (nr, nc) => {
              this.pending = null;
              this.log(`${p.name} sklouzl na ${this.coord(nr, nc)}.`, 'move');
              this.moveTo(p, nr, nc);
            }
          };
          this.emit();
          return;
        }
      }

      this.applyTile(p);
    }

    headJump(attacker, victim) {
      this.jumped.add(victim.id);

      if (this.usePassive(victim, 'kvakrobatika')) {
        const spots = FL.neighbours(victim.pos.r, victim.pos.c)
          .filter(n => this.tile(n.r, n.c).type !== T.WATER &&
                       this.tile(n.r, n.c).type !== T.MAGIC &&
                       this.at(n.r, n.c).length === 0);
        const spot = spots.length ? spots[rnd(spots.length)] : null;
        if (spot) {
          victim.pos = { r: spot.r, c: spot.c };
          this.log(`${victim.name} uskakuje Kvákrobatikou na ${this.coord(spot.r, spot.c)} a vyhýbá se následkům.`, 'card');
          return;
        }
      }

      this.log(`${attacker.name} skáče na hlavu hráči ${victim.name}!`, 'bad');

      if (this.usePassive(victim, 'helma')) {
        this.log(`${victim.name} má Helmu – kredit neztrácí.`, 'card');
      } else if (this.credits(victim) > 0) {
        this.spend(victim, 1);
        attacker.insects.fly += 1;
        this.log(`${attacker.name} bere hráči ${victim.name} 1 kredit.`, 'gain');
      } else {
        this.log(`${victim.name} nemá žádný kredit k sebrání.`, 'sys');
      }

      if (this.zabijak) {
        this.sendToStart(victim, 'Žabiják');
      }
    }

    sendToStart(p, reason) {
      const free = this.freeStarts();
      const spot = free.length ? free[rnd(free.length)] : FL.STARTS[p.idx];
      p.pos = { r: spot.r, c: spot.c };
      this.log(`${p.name} se vrací na START (${reason}).`, 'bad');
    }

    applyTile(p) {
      const t = this.tile(p.pos.r, p.pos.c);

      switch (t.type) {
        case T.WATER: {
          const free = this.freeStarts();
          this.log(`${p.name} spadl do vody!`, 'bad');
          this.phase = 'start';
          this.pending = {
            kind: 'cell',
            hint: 'Spadl jsi do vody – vyber si volné startovní pole.',
            cells: (free.length ? free : FL.STARTS).map(s => key(s.r, s.c)),
            handler: (r, c) => {
              this.pending = null;
              p.pos = { r, c };
              this.log(`${p.name} startuje znovu z pole (${r},${c}).`, 'move');
              this.endTurn();
            }
          };
          this.emit();
          return;
        }

        case T.WHIRL: {
          if (p.hand.some(c => c.id === 'plovaky')) {
            this.phase = 'whirlChoice';
            this.pending = {
              kind: 'choice',
              hint: 'Vodní vír! Můžeš použít Plováky a zůstat na místě.',
              options: [
                { label: 'Použít Plováky (zůstat na místě)', value: 'float' },
                { label: 'Nechat se unést vírem', value: 'ride' }
              ],
              handler: v => {
                this.pending = null;
                if (v === 'float') {
                  this.usePassive(p, 'plovaky');
                  this.log(`${p.name} zůstává nad vírem.`, 'card');
                  this.endTurn();
                } else {
                  this.askWhirlDir(p, t);
                }
              }
            };
            this.emit();
            return;
          }
          this.askWhirlDir(p, t);
          return;
        }

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
        return { label: `${this.arrowGlyph(dr, dc)} na pole ${this.coord(r, c)}`, value: [r, c] };
      });

      this.log(`${p.name} se dostal do Vodního víru.`, 'event');
      this.phase = 'whirl';
      this.pending = {
        kind: 'choice',
        hint: 'Vodní vír tě přenese o 2 pole – vyber šipku.',
        options,
        handler: v => {
          this.pending = null;
          this.log(`Vír unáší hráče ${p.name} na ${this.coord(v[0], v[1])}.`, 'move');
          this.moveTo(p, v[0], v[1]);
        }
      };
      this.emit();
    }

    arrowGlyph(dr, dc) {
      const m = { '-1,-1': '↖', '-1,0': '↑', '-1,1': '↗', '0,-1': '←', '0,1': '→', '1,-1': '↙', '1,0': '↓', '1,1': '↘' };
      return m[dr + ',' + dc] || '→';
    }

    endTurn() {
      if (this.winner) return;
      this.pending = null;
      this.phase = 'done';
      this.emit();
    }

    // ---- vstupy z UI ------------------------------------------------------
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

    /* Kouzlo lze seslat i uprostřed vlastního skoku – nabídka skoku se
     * po dokončení kouzla přepočítá a obnoví. */
    maybeResumeMove() {
      if (this._resumeMove && !this.pending && !this.winner) {
        this._resumeMove = false;
        this.startMovePhase();
      }
    }

    // ---- kouzla -----------------------------------------------------------
    canPlayCard() {
      if (this.winner || this.phase === 'won') return false;
      return !this.pending || this.phase === 'move';
    }

    /* Odloží rozehranou nabídku skoku, aby šlo mezitím seslat kouzlo
     * nebo vyměnit světlušku. */
    beginInterrupt() {
      if (this.phase === 'move' && this.pending) {
        this.pending = null;
        this._resumeMove = true;
      }
    }

    /* Pravidlo 6: světlušku lze vrátit do banku a vzít si 1 mouchu od jiného hráče. */
    canTradeFirefly() {
      if (!this.canPlayCard()) return false;
      const p = this.player;
      return p.insects.firefly > 0 && this.players.some(o => o !== p && o.insects.fly > 0);
    }

    tradeFirefly() {
      if (!this.canTradeFirefly()) return;
      const p = this.player;
      this.beginInterrupt();
      const ok = this.askPlayer('Světluška: vyber hráče, kterému vezmeš 1 mouchu.',
        o => o !== p && o.insects.fly > 0,
        target => {
          this.pending = null;
          p.insects.firefly--;
          target.insects.fly--;
          p.insects.fly++;
          this.log(`${p.name} vrací světlušku do banku a bere mouchu hráči ${target.name}.`, 'gain');
        });
      if (!ok) this.maybeResumeMove();
      this.emit();
    }

    playCard(uid) {
      if (!this.canPlayCard()) return;
      this.beginInterrupt();
      const p = this.player;
      const card = p.hand.find(c => c.uid === uid);
      if (!card) return;
      const def = FL.CARD_BY_ID[card.id];
      if (def.passive) {
        this.log(`${def.name} je pasivní kouzlo – použije se automaticky, až bude potřeba.`, 'sys');
        this.maybeResumeMove();
        this.emit();
        return;
      }
      const fn = this.spells[card.id];
      if (!fn) { this.maybeResumeMove(); return; }
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
      const cells = [];
      for (let r = 0; r < FL.SIZE; r++) for (let c = 0; c < FL.SIZE; c++) cells.push(key(r, c));
      this.pending = {
        kind: 'cell',
        hint: `${def.name}: vyber střed zasažené oblasti ${size} × ${size}.`,
        cells,
        area: size,
        cancel: () => {},
        handler: (r, c) => {
          this.pending = null;
          this.discardFrom(caster, uid);
          this.log(`${caster.name} sesílá ${def.name} na oblast ${size}×${size} se středem ${this.coord(r, c)}.`, 'card');
          const area = this.areaCells(r, c, size);
          let loot = 0;
          area.forEach(cell => {
            const stack = this.insectsAt(cell.r, cell.c);
            if (stack) loot += this.takeInsectsAt(caster, cell.r, cell.c);
            this.players.forEach(pl => {
              if (pl === caster) return;
              if (pl.pos.r !== cell.r || pl.pos.c !== cell.c) return;
              if (this.usePassive(pl, 'bublina')) {
                this.log(`${pl.name} je chráněn Bublinou.`, 'card');
              } else {
                this.sendToStart(pl, def.name);
              }
            });
          });
          if (!loot) this.log('V zasažené oblasti nebyl žádný hmyz.', 'sys');
        }
      };
      this.emit();
    }

    askPlayer(hint, filter, handler) {
      const ids = this.players.filter(filter).map(p => p.id);
      if (!ids.length) { this.log('Není koho zvolit.', 'sys'); return false; }
      this.pending = { kind: 'player', hint, players: ids, cancel: () => {}, handler };
      this.emit();
      return true;
    }
  }

  Game.prototype.spells = {
    volavka(p, uid, def) { this.attackArea(p, uid, def, 5); },
    stika(p, uid, def) { this.attackArea(p, uid, def, 3); },

    hurikan(p, uid, def) {
      this.discardFrom(p, uid);
      const hands = this.players.map(pl => pl.hand);
      const rotated = hands.map((_, i) => hands[(i - 1 + hands.length) % hands.length]);
      this.players.forEach((pl, i) => (pl.hand = rotated[i]));
      this.log(`${p.name} sesílá Hurikán – karty putují po směru hodinových ručiček.`, 'card');
    },

    tajfun(p, uid, def) {
      this.discardFrom(p, uid);
      const hands = this.players.map(pl => pl.hand);
      const rotated = hands.map((_, i) => hands[(i + 1) % hands.length]);
      this.players.forEach((pl, i) => (pl.hand = rotated[i]));
      this.log(`${p.name} sesílá Tajfun – karty putují proti směru hodinových ručiček.`, 'card');
    },

    cerna_ruka(p, uid, def) {
      this.askPlayer('Černá ruka: vyber hráče, kterému sebereš 1 kus hmyzu.',
        pl => pl !== p && (pl.insects.fly + pl.insects.firefly + pl.insects.dragonfly) > 0,
        target => {
          this.pending = null;
          const opts = FL.INSECT_KEYS.filter(t => target.insects[t] > 0)
            .map(t => ({ label: FL.INSECTS[t].name, value: t }));
          this.pending = {
            kind: 'choice',
            hint: `Který hmyz sebereš hráči ${target.name}?`,
            options: opts,
            handler: t => {
              this.pending = null;
              this.discardFrom(p, uid);
              target.insects[t]--;
              p.insects[t]++;
              this.log(`${p.name} bere Černou rukou ${FL.INSECTS[t].name.toLowerCase()} hráči ${target.name}.`, 'card');
            }
          };
          this.emit();
        });
    },

    cerna_magie(p, uid, def) {
      this.askPlayer('Černá magie: vyber hráče, kterému sebereš 1 kartu kouzla.',
        pl => pl !== p && pl.hand.length > 0,
        target => {
          this.pending = null;
          this.discardFrom(p, uid);
          const i = Math.floor(Math.random() * target.hand.length);
          const stolen = target.hand.splice(i, 1)[0];
          p.hand.push(stolen);
          this.log(`${p.name} krade hráči ${target.name} kartu ${FL.CARD_BY_ID[stolen.id].name}.`, 'card');
        });
    },

    jazyk(p, uid, def) {
      const cells = FL.neighbours(p.pos.r, p.pos.c)
        .filter(n => this.insectsAt(n.r, n.c))
        .map(n => key(n.r, n.c));
      if (!cells.length) { this.log('Na sousedních polích není žádný hmyz.', 'sys'); return; }
      this.pending = {
        kind: 'cell',
        hint: 'Vystřelovací jazyk: vyber sousední pole, ze kterého sebereš kredity.',
        cells,
        cancel: () => {},
        handler: (r, c) => {
          this.pending = null;
          this.discardFrom(p, uid);
          this.log(`${p.name} vystřeluje jazyk na pole ${this.coord(r, c)}.`, 'card');
          this.takeInsectsAt(p, r, c);
        }
      };
      this.emit();
    },

    zlata_muska(p, uid) { this.discardFrom(p, uid); p.insects.fly++; this.log(`${p.name} bere z banku mouchu.`, 'card'); },
    svetluska(p, uid) { this.discardFrom(p, uid); p.insects.firefly++; this.log(`${p.name} bere z banku světlušku.`, 'card'); },
    duhova_vazka(p, uid) { this.discardFrom(p, uid); p.insects.dragonfly++; this.log(`${p.name} bere z banku vážku.`, 'card'); },

    zamena(p, uid, def) {
      this.askPlayer('Záměna: vyber hráče, se kterým si prohodíš místo.',
        pl => pl !== p,
        target => {
          this.pending = null;
          this.discardFrom(p, uid);
          const tmp = p.pos;
          p.pos = target.pos;
          target.pos = tmp;
          this.log(`${p.name} si mění místo s hráčem ${target.name}.`, 'card');
        });
    },

    kraken(p, uid) {
      this.discardFrom(p, uid);
      this.players.forEach(pl => {
        if (pl === p) return;
        if (this.credits(pl) > 0) { this.spend(pl, 1); this.log(`${pl.name} odevzdává 1 kredit do banku.`, 'bad'); }
      });
      this.log(`${p.name} probouzí Krakena!`, 'card');
    },

    eko(p, uid) {
      this.discardFrom(p, uid);
      const n = Object.keys(this.insects).length;
      this.insects = {};
      this.log(`Eko katastrofa! Z plánu mizí hmyz z ${n} polí.`, 'card');
    },

    zabijak(p, uid) {
      this.discardFrom(p, uid);
      this.zabijak = true;
      this.log(`${p.name} aktivuje Žabijáka – žáby, na které v tomto kole skočí, půjdou na START.`, 'card');
    }
  };

  FL.Game = Game;
})();
