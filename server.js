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
['data', 'texts', 'rules', 'game', 'ai', 'room'].forEach(f => require(path.join(ROOT, 'js', f + '.js')));
const FL = globalThis.FL;

const PORT = +process.env.PORT || 8080;
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

function createRoom(hostName) {
  const room = new FL.Room({ code: newCode(), hostName, makeToken: token, onClose: r => rooms.delete(r.code) });
  rooms.set(room.code, room);
  return room;
}

// ---------------- API ----------------
async function api(req, res, url) {
  const route = url.pathname.replace(/^.*\/api\//, '');

  if (route === 'ping') return json(res, 200, { ok: true, rooms: rooms.size });

  if (route === 'stream' && req.method === 'GET') {
    const room = rooms.get(String(url.searchParams.get('code') || '').toUpperCase());
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
    const client = {
      token: String(url.searchParams.get('token') || ''),
      send: msg => res.write('data: ' + JSON.stringify(msg) + '\n\n'),
      close: () => res.end()
    };
    room.attach(client);
    const ping = setInterval(() => { try { res.write(': ping\n\n'); } catch (e) { /* nic */ } }, 20000);
    req.on('close', () => { clearInterval(ping); room.detach(client); });
    return;
  }

  if (req.method !== 'POST') return json(res, 405, { error: 'Použij POST.' });
  const body = await readBody(req);

  if (route === 'create') {
    const room = createRoom(body.name);
    return json(res, 200, { code: room.code, token: room.hostToken });
  }

  const room = rooms.get(String(body.code || '').toUpperCase());
  if (!room) return json(res, 404, { error: 'Místnost s tímto kódem neexistuje.' });
  const tok = String(body.token || '');

  try {
    switch (route) {
      case 'join': return json(res, 200, { code: room.code, token: room.join(body.name, tok) });
      case 'act': room.act(tok, body.action); break;
      case 'lobby': room.lobby(tok, body.op, body.data); break;
      case 'leave': room.leave(tok); break;
      default: return json(res, 404, { error: 'Neznámý požadavek.' });
    }
  } catch (e) {
    return json(res, e.status || 400, { error: e.message });
  }
  return json(res, 200, { ok: true });
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
  rooms.forEach(room => { if (now - room.touched > ROOM_IDLE_MS && !room.clients.size) room.close('Místnost vypršela.'); });
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
