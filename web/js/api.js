/* Tiny fetch + SSE wrappers for Needfire API. No dependencies. */
const Api = (function () {
  // thrown by getJSON/postJSON on 401 so callers can show the login screen
  function AuthError() { this.name = 'AuthError'; this.auth = true; }
  async function getJSON(url) {
    const r = await fetch(url);
    if (r.status === 401) throw new AuthError();
    if (!r.ok) throw new Error(url + ' -> ' + r.status);
    return r.json();
  }
  async function postJSON(url, body) {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {}),
    });
    if (r.status === 401) throw new AuthError();
    return r.json();
  }

  return {
    health: () => getJSON('/api/health'),
    system: () => getJSON('/api/system'),
    categories: () => getJSON('/api/categories'),
    search: (q, domain) =>
      getJSON('/api/search?q=' + encodeURIComponent(q) + (domain ? '&domain=' + domain : '')),
    source: (doc) => getJSON('/api/source?doc=' + encodeURIComponent(doc)),
    domain: (d) => getJSON('/api/domain?d=' + encodeURIComponent(d)),
    protocols: () => getJSON('/data/protocols.json'), // static, SW-precached
    corpus: () => getJSON('/api/corpus'),
    corpusStatus: () => getJSON('/api/corpus/status'),
    download: (ids, tier) => postJSON('/api/corpus/download', tier ? { tier } : { ids }),
    verify: () => postJSON('/api/corpus/verify', {}),

    /* Streaming ask via Server-Sent Events. Callbacks: onMeta, onToken, onDone, onError. */
    ask(question, power, cbs) {
      const url = '/api/ask?q=' + encodeURIComponent(question) + '&power=' + (power || 'normal');
      const es = new EventSource(url);
      es.addEventListener('meta', (e) => cbs.onMeta && cbs.onMeta(JSON.parse(e.data)));
      es.addEventListener('answer', (e) => cbs.onToken && cbs.onToken(JSON.parse(e.data).token));
      es.addEventListener('done', (e) => { cbs.onDone && cbs.onDone(JSON.parse(e.data)); es.close(); });
      es.onerror = () => { cbs.onError && cbs.onError(); es.close(); };
      return es;
    },

    // ---- auth ----
    auth: {
      status: () => getJSON('/api/auth/status'),
      setup: (pw) => postJSON('/api/auth/setup', { password: pw }),
      login: (pw) => postJSON('/api/auth/login', { password: pw }),
      logout: () => postJSON('/api/auth/logout', {}),
    },

    // ---- models ----
    models: () => getJSON('/api/models'),
    modelDelete: (name) => postJSON('/api/models/delete', { name }),
    modelRoles: (roles) => postJSON('/api/models/roles', roles),
    pullModel(name, cbs) {
      const es = new EventSource('/api/models/pull?name=' + encodeURIComponent(name));
      es.addEventListener('progress', (e) => cbs.onProgress && cbs.onProgress(JSON.parse(e.data)));
      es.addEventListener('done', (e) => { cbs.onDone && cbs.onDone(JSON.parse(e.data)); es.close(); });
      es.addEventListener('error', (e) => { try { cbs.onErr && cbs.onErr(JSON.parse(e.data)); } catch (x) {} });
      es.onerror = () => { cbs.onClose && cbs.onClose(); es.close(); };
      return es;
    },

    // ---- content ----
    content: {
      setUrl: (id, url, download, sha256) => postJSON('/api/content/url', { id, url, download, sha256 }),
      add: (source) => postJSON('/api/content/add', source),
      import: (path, title, domain) => postJSON('/api/content/import', { path, title, domain }),
      reindex: () => postJSON('/api/reindex', {}),
      reindexStatus: () => getJSON('/api/reindex/status'),
    },

    // ---- studio file system ----
    fs: {
      list: (root, path) => getJSON('/api/fs/list?root=' + root + '&path=' + encodeURIComponent(path || '')),
      read: (root, path) => getJSON('/api/fs/read?root=' + root + '&path=' + encodeURIComponent(path || '')),
      write: (root, path, content) => postJSON('/api/fs/write', { root, path, content }),
      mkdir: (root, path) => postJSON('/api/fs/mkdir', { root, path }),
      del: (root, path) => postJSON('/api/fs/delete', { root, path }),
      rename: (root, from, to) => postJSON('/api/fs/rename', { root, from, to }),
    },

    // ---- studio command / python runner (SSE) ----
    run(opts, cbs) {
      let url = '/api/run?';
      if (opts.py) url += 'py=1&code=' + encodeURIComponent(opts.code);
      else url += 'cmd=' + encodeURIComponent(opts.cmd);
      if (opts.timeout) url += '&timeout=' + opts.timeout;
      const es = new EventSource(url);
      es.addEventListener('out', (e) => cbs.onOut && cbs.onOut(JSON.parse(e.data).line));
      es.addEventListener('done', (e) => { cbs.onDone && cbs.onDone(JSON.parse(e.data)); es.close(); });
      es.addEventListener('error', (e) => { try { cbs.onErr && cbs.onErr(JSON.parse(e.data)); } catch (x) {} });
      es.onerror = () => { cbs.onClose && cbs.onClose(); es.close(); };
      return es;
    },
  };
})();
