/* Žabí jezero – online server (Node.js 18+, bez závislostí)
 *
 *   node server.js            → http://localhost:8080
 *   PORT=3000 node server.js
 *
 * Servíruje samotnou hru a drží online místnosti. Herní engine běží tady
 * (stejný js/game.js jako v prohlížeči), klienti posílají jen akce a dostávají
 * snímky stavu přes Server-Sent Events. Každý hráč vidí jen své karty.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = __dirname;
['data', 'texts', 'rules', 'game', 'ai'].forEach(f => require(path.join(ROOT, 'js', f + '.js')));
const FL = globalThis.FL;

const PORT = +process.env.PORT || 8080;
const OFFLINE_GRACE_MS = 10000;        // po této době bez spojení hraje za hráče autopilot
const ROOM_IDLE_MS = 3 * 3600 * 1000;  // nečinné místnosti se mažou
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

const rooms = new Map();

// ---------------- pomocné ----------------
const token = () => crypto.randomBytes(16).toString('hex');
function newCode() {
  for (;;) {
    let c = '';
    for (let i = 0; i < 5; i++) c += CODE_CHARS[crypto.randomInt(CODE_CHARS.length)];
    if (!rooms.has(c)) return c;
  }
}
const cleanName = (n, fallback) => String(n || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 16) || fallback;
const BOT_NAMES = ['Robo-Kvak', 'Čip-Žabka', 'Kvak 3000', 'Bit-Skokan', 'Pixel-Pulec', 'Turbo-Rosnička', 'Data-Ropucha', 'Mega-Kuňka'];

function json(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(obj));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0, data = '';
    req.on('data', ch => {
      size += ch.length;
      if (size > 16 * 1024) { reject(new Error('Příliš velký požadavek.')); req.destroy(); return; }
      data += ch;
    });
    req.on('end', () => { try { resolve(data ? JSON.parse(data) : {}); } catch (e) { reject(new Error('Neplatný JSON.')); } });
    req.on('error', reject);
  });
}

// ---------------- místnosti ----------------
function createRoom(hostName) {
  const room = {
    code: newCode(),
    seats: [],                  // {token, name, bot, host, connected, lastSeen}
    settings: { leapPrice: 10, luck: true, turnSeconds: 30 },
    game: null, pilot: null, gameId: 0,
    clients: new Set(),         // {res, token}
    touched: Date.now(),
    flushQueued: false
  };
  const seat = { token: token(), name: cleanName(hostName, 'Hostitel'), bot: false, host: true, connected: false, lastSeen: Date.now() };
  room.seats.push(seat);
  rooms.set(room.code, room);
  return { room, seat };
}

const seatIndex = (room, tok) => room.seats.findIndex(s => s.token && s.token === tok);

function lobbyMessage(room, idx) {
  return {
    type: 'lobby', code: room.code, you: idx, host: idx >= 0 && room.seats[idx].host,
    settings: room.settings,
    seats: room.seats.map(s => ({ name: s.name, bot: s.bot, host: s.host, connected: s.bot || s.connected }))
  };
}

function messageFor(room, tok) {
  const idx = seatIndex(room, tok);
  if (!room.game) return lobbyMessage(room, idx);
  return {
    type: 'game', code: room.code, gameId: room.gameId, you: idx, host: idx >= 0 && room.seats[idx].host,
    snap: room.game.snapshot(idx >= 0 ? idx : -1)
  };
}

function send(client, msg) {
  try { client.res.write('data: ' + JSON.stringify(msg) + '\n\n'); } catch (e) { /* klient odešel */ }
}

/* Změny se slévají – jedna zpráva na klienta za tik událostní smyčky. */
function broadcast(room) {
  if (room.flushQueued) return;
  room.flushQueued = true;
  setImmediate(() => {
    room.flushQueued = false;
    room.clients.forEach(c => send(c, messageFor(room, c.token)));
  });
}

function startGame(room) {
  if (room.pilot) room.pilot.stop();
  if (room.game) room.game.destroy();
  const g = new FL.Game({
    players: room.seats.map(s => ({ name: s.name, bot: s.bot })),
    leapPrice: room.settings.leapPrice,
    luck: room.settings.luck,
    turnSeconds: room.settings.turnSeconds
  });
  g.players.forEach((p, i) => { p.offline = !room.seats[i].bot && !room.seats[i].connected; });
  room.game = g;
  room.gameId++;
  room.pilot = FL.Autopilot(g, { isAuto: p => p.bot || p.offline, botDelay: 800 });
  g.subscribe(() => { room.touched = Date.now(); broadcast(room); });
  broadcast(room);
}

function setOffline(room, idx, offline) {
  if (!room.game || !room.game.players[idx]) return;
  const p = room.game.players[idx];
  if (p.offline === offline) return;
  p.offline = offline;
  room.game.log(offline ? `${p.name} – spojení přerušeno, zatím hraje autopilot.` : `${p.name} je zpět ve hře.`, 'sys');
  room.pilot.refresh();
  room.game.emit();
}

function closeRoom(room, reason) {
  room.clients.forEach(c => { send(c, { type: 'gone', reason }); try { c.res.end(); } catch (e) { /* nic */ } });
  if (room.pilot) room.pilot.stop();
  if (room.game) room.game.destroy();
  rooms.delete(room.code);
}

// ---------------- API ----------------
async function api(req, res, url) {
  const route = url.pathname.replace(/^.*\/api\//, '');

  if (route === 'ping') return json(res, 200, { ok: true, rooms: rooms.size });

  if (route === 'stream' && req.method === 'GET') {
    const room = rooms.get(String(url.searchParams.get('code') || '').toUpperCase());
    const tok = String(url.searchParams.get('token') || '');
    if (!room) {
      res.writeHead(200, { 'Content-Type': 'text/event-stream' });
      res.end('data: ' + JSON.stringify({ type: 'gone', reason: 'Místnost už neexistuje.' }) + '\n\n');
      return;
    }
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-store',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no'
    });
    res.write('retry: 2000\n\n');
    const client = { res, token: tok };
    room.clients.add(client);
    const idx = seatIndex(room, tok);
    if (idx >= 0) {
      const seat = room.seats[idx];
      seat.connected = true;
      seat.lastSeen = Date.now();
      setOffline(room, idx, false);
    }
    send(client, messageFor(room, tok));
    broadcast(room);
    const ping = setInterval(() => { try { res.write(': ping\n\n'); } catch (e) { /* nic */ } }, 20000);
    req.on('close', () => {
      clearInterval(ping);
      room.clients.delete(client);
      const i = seatIndex(room, tok);
      if (i < 0) return;
      const seat = room.seats[i];
      if ([...room.clients].some(c => c.token === tok)) return;   // má otevřenou jinou kartu
      seat.connected = false;
      seat.lastSeen = Date.now();
      broadcast(room);
      setTimeout(() => {
        if (!seat.connected && rooms.has(room.code)) setOffline(room, seatIndex(room, tok), true);
      }, OFFLINE_GRACE_MS);
    });
    return;
  }

  if (req.method !== 'POST') return json(res, 405, { error: 'Použij POST.' });
  const body = await readBody(req);

  if (route === 'create') {
    const { room, seat } = createRoom(body.name);
    return json(res, 200, { code: room.code, token: seat.token });
  }

  const room = rooms.get(String(body.code || '').toUpperCase());
  if (!room) return json(res, 404, { error: 'Místnost s tímto kódem neexistuje.' });
  room.touched = Date.now();

  if (route === 'join') {
    // návrat do rozehrané hry se starým klíčem
    if (body.token && seatIndex(room, body.token) >= 0) return json(res, 200, { code: room.code, token: body.token });
    if (room.game) return json(res, 409, { error: 'Hra v této místnosti už běží. Požádej hostitele o novou hru.' });
    if (room.seats.length >= FL.MAX_PLAYERS) return json(res, 409, { error: 'Místnost je plná (8 žab).' });
    const seat = { token: token(), name: cleanName(body.name, 'Žába ' + (room.seats.length + 1)), bot: false, host: false, connected: false, lastSeen: Date.now() };
    room.seats.push(seat);
    broadcast(room);
    return json(res, 200, { code: room.code, token: seat.token });
  }

  const idx = seatIndex(room, String(body.token || ''));
  if (idx < 0) return json(res, 403, { error: 'Nejsi v této místnosti.' });
  const isHost = room.seats[idx].host;

  if (route === 'act') {
    if (!room.game) return json(res, 409, { error: 'Hra ještě nezačala.' });
    room.game.apply(body.action, idx);
    return json(res, 200, { ok: true });
  }

  if (route === 'leave') {
    if (room.game) {
      room.seats[idx].token = null;          // místo převezme autopilot
      room.seats[idx].connected = false;
      setOffline(room, idx, true);
    } else {
      room.seats.splice(idx, 1);
    }
    if (isHost) {
      const next = room.seats.find(s => s.token && !s.bot);
      if (next) { room.seats.forEach(s => (s.host = false)); next.host = true; }
    }
    if (!room.seats.some(s => s.token && !s.bot)) closeRoom(room, 'Všichni hráči odešli.');
    else broadcast(room);
    return json(res, 200, { ok: true });
  }

  if (route === 'lobby') {
    if (!isHost) return json(res, 403, { error: 'Tohle může jen hostitel.' });
    const d = body.data || {};
    switch (body.op) {
      case 'addBot':
        if (room.game) break;
        if (room.seats.length < FL.MAX_PLAYERS) {
          const used = new Set(room.seats.map(s => s.name));
          const name = BOT_NAMES.find(n => !used.has(n)) || 'Robo ' + room.seats.length;
          room.seats.push({ token: null, name, bot: true, host: false, connected: true, lastSeen: Date.now() });
        }
        break;
      case 'remove': {
        if (room.game) break;
        const i = +d.seat;
        if (room.seats[i] && i !== idx) {
          const gone = room.seats.splice(i, 1)[0];
          room.clients.forEach(c => { if (gone.token && c.token === gone.token) { send(c, { type: 'gone', reason: 'Hostitel tě z místnosti odebral.' }); c.res.end(); } });
        }
        break;
      }
      case 'settings':
        room.settings = {
          leapPrice: Math.min(40, Math.max(3, Math.round(+d.leapPrice) || 10)),
          luck: d.luck !== false,
          turnSeconds: [0, 15, 30, 60].includes(+d.turnSeconds) ? +d.turnSeconds : 30
        };
        break;
      case 'start':
        if (!room.game) startGame(room);
        break;
      case 'restart':
        startGame(room);
        break;
      default:
        return json(res, 400, { error: 'Neznámá operace.' });
    }
    broadcast(room);
    return json(res, 200, { ok: true });
  }

  return json(res, 404, { error: 'Neznámý požadavek.' });
}

// ---------------- statické soubory ----------------
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8', '.md': 'text/plain; charset=utf-8'
};

function serveStatic(req, res, url) {
  let rel = decodeURIComponent(url.pathname);
  if (rel.endsWith('/')) rel += 'index.html';
  const file = path.normalize(path.join(ROOT, rel));
  if (!file.startsWith(ROOT + path.sep) || /(^|[\\/])\.|node_modules/.test(path.relative(ROOT, file))) {
    res.writeHead(403); return res.end('Zakázáno');
  }
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('Nenalezeno'); }
    res.writeHead(200, {
      'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': /\.(png|jpe?g)$/i.test(file) ? 'public, max-age=86400' : 'no-cache'
    });
    fs.createReadStream(file).pipe(res);
  });
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (/\/api\//.test(url.pathname)) {
    api(req, res, url).catch(e => json(res, 400, { error: e.message || 'Chyba.' }));
    return;
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); return res.end(); }
  serveStatic(req, res, url);
});

setInterval(() => {
  const now = Date.now();
  rooms.forEach(room => { if (now - room.touched > ROOM_IDLE_MS && !room.clients.size) closeRoom(room, 'Místnost vypršela.'); });
}, 60000).unref();

if (require.main === module) {
  server.listen(PORT, () => {
    const nets = require('os').networkInterfaces();
    const ips = Object.values(nets).flat().filter(n => n && n.family === 'IPv4' && !n.internal).map(n => n.address);
    console.log('🐸 Žabí jezero běží na http://localhost:' + PORT);
    ips.forEach(ip => console.log('   ve stejné síti (telefon, tablet): http://' + ip + ':' + PORT));
  });
}

module.exports = { server, rooms };
