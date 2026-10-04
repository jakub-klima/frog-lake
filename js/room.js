/* Žabí jezero – herní místnost (lobby + rozehraná hra)
 *
 * Společná logika pro obě varianty hry na více zařízeních:
 *   - online server (server.js, klienti přes HTTP + Server-Sent Events),
 *   - hra přes Wi-Fi bez serveru (js/p2p.js, hostitel drží místnost
 *     přímo ve svém prohlížeči, ostatní jsou připojení přes WebRTC).
 * Místnost nezná přenos – klient je jen objekt { token, send(msg) }.
 */
(function () {
  const FL = (globalThis.FL = globalThis.FL || {});

  const BOT_NAMES = ['Robo-Kvak', 'Čip-Žabka', 'Kvak 3000', 'Bit-Skokan', 'Pixel-Pulec', 'Turbo-Rosnička', 'Data-Ropucha', 'Mega-Kuňka'];
  const OFFLINE_GRACE_MS = 10000;        // po této době bez spojení hraje za hráče autopilot
  const later = globalThis.setImmediate || (fn => setTimeout(fn, 0));

  function randomToken() {
    const c = globalThis.crypto;
    if (c && c.getRandomValues) {
      const a = new Uint8Array(16);
      c.getRandomValues(a);
      return Array.from(a, b => b.toString(16).padStart(2, '0')).join('');
    }
    return Math.random().toString(16).slice(2) + Math.random().toString(16).slice(2);
  }

  /* Chyba s HTTP kódem pro server (403 = nesmíš, 409 = teď to nejde). */
  const fail = (msg, status) => Object.assign(new Error(msg), { status: status || 409 });

  const cleanName = (n, fallback) =>
    String(n || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 16) || fallback;

  class Room {
    /* opts: { code, hostName, makeToken, botDelay, onClose } */
    constructor(opts) {
      this.code = opts.code;
      this.makeToken = opts.makeToken || randomToken;
      this.botDelay = opts.botDelay || 800;
      this.onClose = opts.onClose || (() => {});
      this.seats = [];            // {token, name, bot, host, connected, avatar}
      this.settings = { leapPrice: 10, turnSeconds: 30 };
      this.game = null;
      this.pilot = null;
      this.gameId = 0;
      this.clients = new Set();   // {token, send}
      this.touched = Date.now();
      this.flushQueued = false;
      this.closed = false;
      const host = this.addSeat({ name: cleanName(opts.hostName, 'Hostitel'), host: true });
      this.hostToken = host.token;
    }

    // ---------------- místa u stolu ----------------
    freeAvatar() {
      const used = new Set(this.seats.map(s => s.avatar));
      for (let i = 0; i < FL.MAX_PLAYERS; i++) if (!used.has(i)) return i;
      return 0;
    }

    addSeat(o) {
      const seat = Object.assign({ token: null, name: '', bot: false, host: false, connected: false, avatar: this.freeAvatar() }, o);
      if (!seat.bot && !seat.token) seat.token = this.makeToken();
      this.seats.push(seat);
      return seat;
    }

    seatIndex(tok) { return tok ? this.seats.findIndex(s => s.token && s.token === tok) : -1; }

    /* Nový hráč (nebo návrat se starým klíčem). Vrací token, chybu hází. */
    join(name, tok) {
      if (tok && this.seatIndex(tok) >= 0) return tok;
      if (this.game) throw fail('Hra v této místnosti už běží. Požádej hostitele o novou hru.');
      if (this.seats.length >= FL.MAX_PLAYERS) throw fail('Místnost je plná (8 žab).');
      const seat = this.addSeat({ name: cleanName(name, 'Žába ' + (this.seats.length + 1)) });
      this.broadcast();
      return seat.token;
    }

    // ---------------- spojení ----------------
    attach(client) {
      this.clients.add(client);
      const idx = this.seatIndex(client.token);
      if (idx >= 0) {
        this.seats[idx].connected = true;
        this.setOffline(idx, false);
      }
      client.send(this.messageFor(client.token));
      this.broadcast();
    }

    detach(client) {
      this.clients.delete(client);
      const tok = client.token;
      const seat = this.seats[this.seatIndex(tok)];
      if (!seat || [...this.clients].some(c => c.token === tok)) return;   // má otevřenou jinou kartu
      seat.connected = false;
      this.broadcast();
      setTimeout(() => {
        const i = this.seatIndex(tok);
        if (!this.closed && i >= 0 && !this.seats[i].connected) this.setOffline(i, true);
      }, OFFLINE_GRACE_MS);
    }

    setOffline(idx, offline) {
      if (!this.game || !this.game.players[idx]) return;
      const p = this.game.players[idx];
      if (p.offline === offline) return;
      p.offline = offline;
      this.game.log(offline ? `${p.name} – spojení přerušeno, zatím hraje autopilot.` : `${p.name} je zpět ve hře.`, 'sys');
      this.pilot.refresh();
      this.game.emit();
    }

    // ---------------- zprávy ----------------
    lobbyMessage(idx) {
      return {
        type: 'lobby', code: this.code, you: idx, host: idx >= 0 && this.seats[idx].host,
        settings: this.settings,
        seats: this.seats.map(s => ({ name: s.name, bot: s.bot, host: s.host, connected: s.bot || s.connected, avatar: s.avatar }))
      };
    }

    messageFor(tok) {
      const idx = this.seatIndex(tok);
      if (!this.game) return this.lobbyMessage(idx);
      return {
        type: 'game', code: this.code, gameId: this.gameId, you: idx, host: idx >= 0 && this.seats[idx].host,
        snap: this.game.snapshot(idx >= 0 ? idx : -1)
      };
    }

    /* Změny se slévají – jedna zpráva na klienta za tik událostní smyčky. */
    broadcast() {
      if (this.flushQueued || this.closed) return;
      this.flushQueued = true;
      later(() => {
        this.flushQueued = false;
        this.clients.forEach(c => { try { c.send(this.messageFor(c.token)); } catch (e) { /* klient odešel */ } });
      });
    }

    // ---------------- hra ----------------
    startGame() {
      if (this.pilot) this.pilot.stop();
      if (this.game) this.game.destroy();
      const g = new FL.Game({
        players: this.seats.map(s => ({ name: s.name, bot: s.bot, color: s.avatar })),
        leapPrice: this.settings.leapPrice,
        turnSeconds: this.settings.turnSeconds
      });
      g.players.forEach((p, i) => { p.offline = !this.seats[i].bot && !this.seats[i].connected; });
      this.game = g;
      this.gameId++;
      this.pilot = FL.Autopilot(g, { isAuto: p => p.bot || p.offline, botDelay: this.botDelay });
      g.subscribe(() => { this.touched = Date.now(); this.broadcast(); });
      this.broadcast();
    }

    /* Herní akce od hráče. Pokračování po doskoku (C) smí jen hostitel. */
    act(tok, action) {
      const idx = this.seatIndex(tok);
      if (idx < 0) throw fail('Nejsi v této místnosti.', 403);
      if (!this.game) throw fail('Hra ještě nezačala.');
      if (action && action.type === 'continue' && !this.seats[idx].host) throw fail('Pokračovat může jen hostitel.', 403);
      this.touched = Date.now();
      this.game.apply(action, idx);
    }

    /* Nastavení místnosti. Avatara si volí každý sám, ostatní jen hostitel. */
    lobby(tok, op, data) {
      const idx = this.seatIndex(tok);
      if (idx < 0) throw fail('Nejsi v této místnosti.', 403);
      const d = data || {};
      this.touched = Date.now();
      if (op === 'avatar') {
        const a = Math.round(+d.avatar);
        const target = d.seat != null && this.seats[idx].host && this.seats[+d.seat] && this.seats[+d.seat].bot ? +d.seat : idx;
        if (!this.game && a >= 0 && a < FL.MAX_PLAYERS && !this.seats.some((s, i) => i !== target && s.avatar === a))
          this.seats[target].avatar = a;
        return this.broadcast();
      }
      if (!this.seats[idx].host) throw fail('Tohle může jen hostitel.', 403);
      switch (op) {
        case 'addBot':
          if (!this.game && this.seats.length < FL.MAX_PLAYERS) {
            const used = new Set(this.seats.map(s => s.name));
            const name = BOT_NAMES.find(n => !used.has(n)) || 'Robo ' + this.seats.length;
            this.addSeat({ name, bot: true, connected: true });
          }
          break;
        case 'remove': {
          const i = +d.seat;
          if (!this.game && this.seats[i] && i !== idx) {
            const gone = this.seats.splice(i, 1)[0];
            this.clients.forEach(c => {
              if (gone.token && c.token === gone.token) {
                c.send({ type: 'gone', reason: 'Hostitel tě z místnosti odebral.' });
                if (c.close) c.close();
              }
            });
          }
          break;
        }
        case 'settings':
          this.settings = {
            leapPrice: Math.min(40, Math.max(3, Math.round(+d.leapPrice) || 10)),
            turnSeconds: [0, 15, 30, 60].includes(+d.turnSeconds) ? +d.turnSeconds : 30
          };
          break;
        case 'start':
          if (!this.game) this.startGame();
          break;
        case 'restart':
          this.startGame();
          break;
        default:
          throw fail('Neznámá operace.', 400);
      }
      this.broadcast();
    }

    /* Odchod hráče. V rozehrané hře jeho žábu převezme autopilot. */
    leave(tok) {
      const idx = this.seatIndex(tok);
      if (idx < 0) return;
      const wasHost = this.seats[idx].host;
      if (this.game) {
        this.seats[idx].token = null;
        this.seats[idx].connected = false;
        this.setOffline(idx, true);
      } else {
        this.seats.splice(idx, 1);
      }
      if (wasHost) {
        const next = this.seats.find(s => s.token && !s.bot);
        this.seats.forEach(s => (s.host = false));
        if (next) next.host = true;
      }
      if (!this.seats.some(s => s.token && !s.bot)) this.close('Všichni hráči odešli.');
      else this.broadcast();
    }

    close(reason) {
      if (this.closed) return;
      this.closed = true;
      this.clients.forEach(c => { try { c.send({ type: 'gone', reason }); if (c.close) c.close(); } catch (e) { /* nic */ } });
      this.clients.clear();
      if (this.pilot) this.pilot.stop();
      if (this.game) this.game.destroy();
      this.onClose(this);
    }
  }

  FL.Room = Room;
  FL.cleanName = cleanName;
})();
