/* Žabí jezero – klient online hry
 *
 * Server (server.js) drží herní engine; klient jen posílá akce (POST)
 * a přijímá snímky stavu proudem Server-Sent Events. SSE funguje
 * v každém prohlížeči i přes mobilní data a samo se po výpadku znovu připojí.
 */
(function () {
  const FL = (globalThis.FL = globalThis.FL || {});
  let es = null, code = null, token = null, handlers = {};

  async function post(url, body) {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    let j = {};
    try { j = await r.json(); } catch (e) { /* prázdná odpověď */ }
    if (!r.ok) throw new Error(j.error || 'Server odpověděl chybou ' + r.status);
    return j;
  }

  function open() {
    close();
    es = new EventSource(`api/stream?code=${encodeURIComponent(code)}&token=${encodeURIComponent(token)}`);
    es.onopen = () => handlers.onStatus && handlers.onStatus('ok');
    es.onerror = () => handlers.onStatus && handlers.onStatus('reconnecting');
    es.onmessage = e => {
      let msg;
      try { msg = JSON.parse(e.data); } catch (err) { return; }
      if (msg.type === 'gone') { close(); handlers.onGone && handlers.onGone(msg.reason); return; }
      handlers.onMessage && handlers.onMessage(msg);
    };
  }

  function close() { if (es) { es.close(); es = null; } }

  FL.Net = {
    async available() {
      if (location.protocol === 'file:') return false;
      try {
        const r = await fetch('api/ping', { cache: 'no-store' });
        return r.ok && !!(await r.json()).ok;
      } catch (e) { return false; }
    },
    create: name => post('api/create', { name }),
    join: (c, name, tok) => post('api/join', { code: c, name, token: tok }),
    connect(c, t, h) { code = c; token = t; handlers = h || {}; open(); },
    act: a => post('api/act', { code, token, action: a }).catch(e => handlers.onError && handlers.onError(e)),
    lobby: (op, data) => post('api/lobby', { code, token, op, data }).catch(e => handlers.onError && handlers.onError(e)),
    leave() { if (code) post('api/leave', { code, token }).catch(() => {}); close(); code = token = null; },
    get code() { return code; }
  };
})();
