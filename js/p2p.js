/* Žabí jezero – hra přes Wi-Fi bez serveru (WebRTC)
 *
 * Hostitel drží herní místnost (FL.Room) přímo ve svém prohlížeči. Ostatní
 * zařízení se k němu připojí přímým spojením WebRTC – data jdou po Wi-Fi
 * mezi zařízeními, žádný herní server není potřeba.
 *
 * Prohlížeče si jen jednou musí vyměnit „pozvánku“ (hostitel → hráč) a
 * „odpověď“ (hráč → hostitel). Obojí je krátký text, který se předá QR kódem
 * (naskenuje se fotoaparátem) nebo zkopíruje (např. přes chat).
 *
 * Kódy: "ZJ1z…" = komprimovaný JSON {t:'o'|'a', id, sdp} v base64url.
 */
(function () {
  const FL = (globalThis.FL = globalThis.FL || {});

  // STUN pomáhá jen tehdy, když je k dispozici internet; ve stejné Wi-Fi
  // se zařízení najdou i bez něj (lokální adresy v pozvánce).
  const ICE = [{ urls: 'stun:stun.l.google.com:19302' }];
  const GATHER_MS = 2500;
  const CODE_RE = /ZJ1[zr][A-Za-z0-9_-]{20,}/;

  // ---------------- kódy pozvánek ----------------
  const b64u = bytes => {
    let s = '';
    bytes.forEach(b => (s += String.fromCharCode(b)));
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  };
  const unb64u = str => {
    const s = atob(str.replace(/-/g, '+').replace(/_/g, '/'));
    return Uint8Array.from(s, ch => ch.charCodeAt(0));
  };
  const pipe = (bytes, stream) => new Response(new Blob([bytes]).stream().pipeThrough(stream)).arrayBuffer();

  /* Zkrátí SDP o řádky, které datový kanál nepotřebuje. */
  const slimSdp = sdp => sdp.split('\r\n').filter(l =>
    l && !/^a=(extmap-allow-mixed|msid-semantic)/.test(l)).join('\r\n') + '\r\n';

  async function pack(obj) {
    const bytes = new TextEncoder().encode(JSON.stringify(obj));
    if (globalThis.CompressionStream) {
      return 'ZJ1z' + b64u(new Uint8Array(await pipe(bytes, new CompressionStream('deflate-raw'))));
    }
    return 'ZJ1r' + b64u(bytes);
  }

  async function unpack(text) {
    const m = String(text || '').replace(/\s+/g, '').match(CODE_RE);
    if (!m) throw new Error('Tohle nevypadá jako kód Žabího jezera.');
    let bytes = unb64u(m[0].slice(4));
    if (m[0][3] === 'z') {
      if (!globalThis.DecompressionStream) throw new Error('Tento prohlížeč neumí rozbalit kód – aktualizuj ho prosím.');
      bytes = new Uint8Array(await pipe(bytes, new DecompressionStream('deflate-raw')));
    }
    return JSON.parse(new TextDecoder().decode(bytes));
  }

  /* Počká, až prohlížeč posbírá síťové adresy (nebo na časový limit). */
  function gathered(pc) {
    return new Promise(resolve => {
      if (pc.iceGatheringState === 'complete') return resolve();
      const t = setTimeout(resolve, GATHER_MS);
      pc.addEventListener('icegatheringstatechange', () => {
        if (pc.iceGatheringState === 'complete') { clearTimeout(t); resolve(); }
      });
    });
  }

  const shortId = () => Math.random().toString(36).slice(2, 8);
  const sendJson = (ch, obj) => { if (ch && ch.readyState === 'open') ch.send(JSON.stringify(obj)); };

  // ---------------- hostitel ----------------
  class WifiHost {
    /* handlers: { onMessage(msg), onError(err), onPeers() } */
    constructor(name, handlers) {
      this.handlers = handlers || {};
      this.invites = new Map();     // id → { pc, ch }
      this.peers = new Set();       // otevřená spojení
      this.room = new FL.Room({ code: 'WI-FI', hostName: name, botDelay: 800 });
      this.token = this.room.hostToken;
      this.local = { token: this.token, send: msg => setTimeout(() => this.handlers.onMessage(msg), 0) };
      this.room.attach(this.local);
    }

    get isHost() { return true; }

    act(a) { this.safe(() => this.room.act(this.token, a)); }
    lobby(op, data) { this.safe(() => this.room.lobby(this.token, op, data)); }
    safe(fn) { try { fn(); } catch (e) { if (this.handlers.onError) this.handlers.onError(e); } }

    leave() {
      this.room.close('Hostitel ukončil hru.');
      this.invites.forEach(i => i.pc.close());
      this.peers.forEach(pc => pc.close());
    }

    /* Nová pozvánka – vrací { id, code }. */
    async invite() {
      const id = shortId();
      const pc = new RTCPeerConnection({ iceServers: ICE });
      const ch = pc.createDataChannel('zabi-jezero', { ordered: true });
      this.wire(id, pc, ch);
      await pc.setLocalDescription(await pc.createOffer());
      await gathered(pc);
      this.invites.set(id, { pc, ch });
      return { id, code: await pack({ t: 'o', id, sdp: slimSdp(pc.localDescription.sdp) }) };
    }

    /* Odpověď hráče na pozvánku – po ní se spojení samo otevře. */
    async accept(text) {
      const o = await unpack(text);
      if (o.t !== 'a') throw new Error('Tohle je pozvánka, ne odpověď. Naskenuj kód z obrazovky hráče.');
      const inv = this.invites.get(o.id);
      if (!inv) throw new Error('Odpověď nepatří k žádné otevřené pozvánce. Vytvoř novou pozvánku.');
      if (inv.pc.signalingState !== 'have-local-offer') throw new Error('Tahle odpověď už byla použita.');
      await inv.pc.setRemoteDescription({ type: 'answer', sdp: o.sdp });
      return o.id;
    }

    cancelInvite(id) {
      const inv = this.invites.get(id);
      if (inv && !this.peers.has(inv.pc)) inv.pc.close();
      this.invites.delete(id);
    }

    wire(id, pc, ch) {
      let client = null;
      ch.onopen = () => { this.peers.add(pc); this.invites.delete(id); };
      ch.onmessage = e => {
        let m;
        try { m = JSON.parse(e.data); } catch (err) { return; }
        try {
          if (m.t === 'hello') {
            const tok = this.room.join(m.name, m.token);
            client = { token: tok, send: msg => sendJson(ch, msg), close: () => setTimeout(() => pc.close(), 300) };
            sendJson(ch, { type: 'welcome', token: tok });
            this.room.attach(client);
            if (this.handlers.onPeers) this.handlers.onPeers();
          } else if (!client) {
            return;
          } else if (m.t === 'act') this.room.act(client.token, m.action);
          else if (m.t === 'lobby') this.room.lobby(client.token, m.op, m.data);
          else if (m.t === 'leave') { this.room.leave(client.token); pc.close(); }
        } catch (err) {
          sendJson(ch, { type: 'error', msg: err.message });
        }
      };
      const drop = () => {
        this.peers.delete(pc);
        if (client) { this.room.detach(client); client = null; }
        if (this.handlers.onPeers) this.handlers.onPeers();
      };
      ch.onclose = drop;
      pc.addEventListener('connectionstatechange', () => {
        if (pc.connectionState === 'failed' || pc.connectionState === 'closed') drop();
      });
    }
  }

  // ---------------- hráč ----------------
  class WifiGuest {
    /* Z pozvánky vytvoří odpověď. handlers: { onMessage, onError, onGone, onOpen } */
    static async answer(inviteText, name, handlers) {
      const o = await unpack(inviteText);
      if (o.t !== 'o') throw new Error('Tohle je odpověď, ne pozvánka. Naskenuj kód z obrazovky hostitele.');
      const g = new WifiGuest(name, handlers);
      g.pc.ondatachannel = e => g.wire(e.channel);
      await g.pc.setRemoteDescription({ type: 'offer', sdp: o.sdp });
      await g.pc.setLocalDescription(await g.pc.createAnswer());
      await gathered(g.pc);
      g.code = await pack({ t: 'a', id: o.id, sdp: slimSdp(g.pc.localDescription.sdp) });
      return g;
    }

    constructor(name, handlers) {
      this.name = name;
      this.handlers = handlers || {};
      this.pc = new RTCPeerConnection({ iceServers: ICE });
      this.ch = null;
      this.left = false;
    }

    get isHost() { return false; }

    wire(ch) {
      this.ch = ch;
      ch.onopen = () => {
        let token = null;
        try { token = localStorage.getItem('fl-wifi-token'); } catch (e) { /* nic */ }
        sendJson(ch, { t: 'hello', name: this.name, token });
        if (this.handlers.onOpen) this.handlers.onOpen();
      };
      ch.onmessage = e => {
        let m;
        try { m = JSON.parse(e.data); } catch (err) { return; }
        if (m.type === 'welcome') {
          try { localStorage.setItem('fl-wifi-token', m.token); } catch (err) { /* nic */ }
        } else if (m.type === 'error') {
          if (this.handlers.onError) this.handlers.onError(new Error(m.msg));
        } else if (m.type === 'gone') {
          this.left = true;
          if (this.handlers.onGone) this.handlers.onGone(m.reason);
        } else if (this.handlers.onMessage) this.handlers.onMessage(m);
      };
      ch.onclose = () => {
        if (!this.left && this.handlers.onGone) this.handlers.onGone('Spojení s hostitelem se přerušilo. Požádej o novou pozvánku – vrátíš se ke své žábě.');
        this.left = true;
      };
    }

    act(a) { sendJson(this.ch, { t: 'act', action: a }); }
    lobby(op, data) { sendJson(this.ch, { t: 'lobby', op, data }); }
    leave() { this.left = true; sendJson(this.ch, { t: 'leave' }); setTimeout(() => this.pc.close(), 200); }
  }

  // ---------------- QR kódy ----------------
  /* SVG s QR kódem (knihovna qrcode-generator, js/vendor/qrcode.js). */
  function qrSvg(text) {
    if (!globalThis.qrcode) return '';
    const qr = globalThis.qrcode(0, 'L');
    qr.addData(text);
    qr.make();
    return qr.createSvgTag({ cellSize: 4, margin: 8, scalable: true });
  }

  /* Adresa, na které si hráč hru otevře (QR kód pozvánky ji obsahuje).
   * Je-li hra otevřená ze souboru, použije se veřejná verze na GitHub Pages. */
  function inviteUrl(code) {
    const here = /^https?:$/.test(location.protocol) ? location.origin + location.pathname : FL.PUBLIC_URL;
    return here + '#wifi=' + code;
  }

  // ---------------- čtečka QR kódů ----------------
  let jsQrLoading = null;
  function loadJsQr() {
    if (globalThis.jsQR) return Promise.resolve();
    if (!jsQrLoading) {
      jsQrLoading = new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = 'js/vendor/jsQR.js';
        s.onload = resolve;
        s.onerror = () => reject(new Error('Čtečku QR kódů se nepodařilo načíst.'));
        document.head.append(s);
      });
    }
    return jsQrLoading;
  }

  /* Spustí fotoaparát ve <video> a čte QR kódy, dokud nenajde kód hry.
   * Vrací funkci pro zastavení. */
  async function scan(video, onCode, onError) {
    let stream, stopped = false, timer = null;
    const stop = () => {
      stopped = true;
      clearTimeout(timer);
      if (stream) stream.getTracks().forEach(t => t.stop());
      video.srcObject = null;
    };
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia)
        throw new Error('Fotoaparát tu není dostupný (je potřeba adresa https). Vlož kód ručně.');
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
      video.srcObject = stream;
      video.setAttribute('playsinline', '');
      await video.play();
      let detector = null;
      if (globalThis.BarcodeDetector) {
        try { detector = new globalThis.BarcodeDetector({ formats: ['qr_code'] }); } catch (e) { detector = null; }
      }
      if (!detector) await loadJsQr();
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      const tick = async () => {
        if (stopped) return;
        try {
          let text = null;
          if (video.readyState >= 2) {
            if (detector) {
              const found = await detector.detect(video);
              const hit = found.find(f => CODE_RE.test(f.rawValue));
              if (hit) text = hit.rawValue;
            } else {
              const w = video.videoWidth, h = video.videoHeight;
              const scale = Math.min(1, 640 / Math.max(w, h));
              canvas.width = Math.round(w * scale);
              canvas.height = Math.round(h * scale);
              ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
              const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
              const res = globalThis.jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' });
              if (res && CODE_RE.test(res.data)) text = res.data;
            }
          }
          if (text) { stop(); onCode(text); return; }
        } catch (e) { /* další snímek */ }
        timer = setTimeout(tick, 180);
      };
      tick();
    } catch (e) {
      stop();
      onError(e.name === 'NotAllowedError' ? new Error('Přístup k fotoaparátu nebyl povolen. Vlož kód ručně.') : e);
    }
    return stop;
  }

  FL.PUBLIC_URL = 'https://jakub-klima.github.io/frog-lake/';
  FL.P2P = {
    supported: () => !!globalThis.RTCPeerConnection,
    WifiHost, WifiGuest, pack, unpack, qrSvg, inviteUrl, scan,
    isCode: t => CODE_RE.test(String(t || '').replace(/\s+/g, ''))
  };
})();
