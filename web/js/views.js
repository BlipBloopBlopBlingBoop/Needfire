/* View render functions. Each returns a DOM node for the main #view container. */
const Views = (function () {
  const el = C.el, icon = C.icon;

  const SUGGESTIONS = [
    'How do I purify cloudy water?',
    'How do I control severe bleeding?',
    'How do I do CPR?',
    'What do I do for a snakebite?',
    'What stops gamma radiation?',
    'How do I start a fire?',
  ];

  function searchBar(initial, onSubmit) {
    const input = el('input', { type: 'text', 'aria-label': 'Search the corpus or ask a question', placeholder: 'Search the corpus or ask a question…', value: initial || '' });
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') onSubmit(input.value); });
    const bar = el('div', { class: 'searchbar' }, [
      icon('search'),
      input,
      el('button', { onclick: () => onSubmit(input.value) }, ['Ask']),
    ]);
    setTimeout(() => input.focus(), 30);
    return bar;
  }

  async function home() {
    const sos = el('a', { class: 'sos-card', href: '#/emergency' }, [
      icon('emergency'),
      el('div', {}, [
        'EMERGENCY — GUIDED PROTOCOLS',
        el('span', { class: 'sub' }, ['CPR · bleeding · choking · burns · poisoning · 12 scenarios, step by step']),
      ]),
    ]);
    const kit = el('div', {}, []);
    const wrap = el('div', {}, [
      sos,
      kit,
      el('div', { class: 'hero' }, [
        el('h1', {}, ['Everything you need to know, offline.']),
        el('p', {}, ['Search the library or ask a question in plain language. Answers are grounded in cited sources you can open and read.']),
        searchBar('', (q) => { if (q.trim()) location.hash = '#/ask/' + encodeURIComponent(q.trim()); }),
        el('div', { class: 'suggest', style: 'justify-content:center' },
          SUGGESTIONS.map((s) => el('button', { class: 'chip', onclick: () => (location.hash = '#/ask/' + encodeURIComponent(s)) }, [s]))),
      ]),
      C.sectionHead('Browse by category'),
      el('div', { class: 'grid cats', id: 'cat-grid' }, [el('div', { class: 'empty' }, [el('span', { class: 'spinner' })])]),
    ]);
    // "your kit": pinned documents, one glance from boot
    const pins = Prefs.pins();
    if (pins.length) {
      kit.appendChild(C.sectionHead('Your kit'));
      const row = el('div', { class: 'pin-row' }, []);
      kit.appendChild(row);
      pins.forEach(async (docId) => {
        try {
          const d = await Api.source(docId);
          row.appendChild(C.docCard({ doc_id: docId, title: d.doc_title, domain: d.domain, tier: d.tier, license: d.license }));
        } catch (e) { /* doc gone after reindex — ignore */ }
      });
    }
    Api.categories().then((d) => {
      const grid = wrap.querySelector('#cat-grid');
      grid.innerHTML = '';
      d.categories.forEach((c) => grid.appendChild(C.categoryCard(c)));
    }).catch(() => {
      const grid = wrap.querySelector('#cat-grid');
      grid.innerHTML = '';
      grid.appendChild(C.empty('Could not load categories — is the server running?'));
    });
    return wrap;
  }

  function askView(question) {
    const answerEl = el('div', { class: 'answer-text cursor-blink', 'aria-live': 'polite' }, ['']);
    const modeEl = el('div', { class: 'mode' }, [el('span', { class: 'dot' }), 'thinking…']);
    const answerCard = el('div', { class: 'answer-card' }, [modeEl, answerEl]);
    const safetyHost = el('div', {});
    const sourcesHost = el('div', { class: 'grid cards' }, []);

    const wrap = el('div', { class: 'ask-wrap' }, [
      searchBar(question, (q) => { if (q.trim()) location.hash = '#/ask/' + encodeURIComponent(q.trim()); }),
      el('div', { style: 'height:18px' }),
      safetyHost,
      answerCard,
      C.sectionHead('Sources'),
      sourcesHost,
    ]);

    let answer = '';
    Api.ask(question, 'normal', {
      onMeta(meta) {
        if (meta.critical) {
          safetyHost.appendChild(el('div', { class: 'safety' }, [
            icon('alert'),
            el('div', {}, ['This is a safety-critical topic. Read the cited source document before acting — the model can be wrong, and errors here can be dangerous.']),
          ]));
        }
        sourcesHost.innerHTML = '';
        if (!meta.sources.length) sourcesHost.appendChild(C.empty('No matching sources found.'));
        meta.sources.forEach((s) => sourcesHost.appendChild(C.sourceCard(s)));
        window.__nfSources = meta.sources.map((s) => s.doc_id); // keys 1-9 open sources
      },
      onToken(tok) { answer += tok; answerEl.textContent = answer; },
      onDone(d) {
        answerEl.classList.remove('cursor-blink');
        if (answer && d.mode === 'model') {
          // re-render the finished answer as markdown (plain text while streaming)
          answerEl.textContent = '';
          answerEl.classList.add('md');
          answerEl.appendChild(MD.render(answer));
        }
        modeEl.innerHTML = '';
        const label = d.mode === 'model' ? 'Answered by ' + (d.model || 'local model')
          : d.mode === 'sources-only' ? 'Sources only — no model loaded'
          : d.mode === 'error' ? 'Something went wrong on the server'
          : 'No answer';
        modeEl.className = 'mode ' + (d.mode === 'model' ? 'model' : 'sources');
        modeEl.appendChild(el('span', { class: 'dot' }));
        modeEl.appendChild(document.createTextNode(label));
      },
      onError() {
        answerEl.classList.remove('cursor-blink');
        if (!answer) {
          answerEl.textContent = '(Could not reach the server.)';
        } else {
          answerCard.appendChild(el('div', { class: 'mode sources' }, [
            el('span', { class: 'dot' }),
            'Connection lost — the answer above is incomplete.',
          ]));
        }
      },
    });
    return wrap;
  }

  async function search(query) {
    const wrap = el('div', {}, [
      searchBar(query, (q) => { if (q.trim()) location.hash = '#/search/' + encodeURIComponent(q.trim()); }),
      el('div', { style: 'height:18px' }),
      C.sectionHead('Results for "' + query + '"'),
      el('div', { class: 'grid cards', id: 'res' }, [el('div', { class: 'empty' }, [el('span', { class: 'spinner' })])]),
    ]);
    const d = await Api.search(query);
    const res = wrap.querySelector('#res');
    res.innerHTML = '';
    if (!d.results.length) res.appendChild(C.empty('Nothing found. Try different words.'));
    d.results.forEach((s) => res.appendChild(C.sourceCard(s)));
    window.__nfSources = d.results.map((s) => s.doc_id); // keys 1-9 open sources
    wrap.addEventListener('view:teardown', () => { window.__nfSources = null; });
    return wrap;
  }

  async function category(domain) {
    const d = await Api.domain(domain);
    const grid = el('div', { class: 'grid cards' }, []);
    if (!d.documents.length) grid.appendChild(C.empty('No documents in this category yet. Download the corpus to fill it.'));
    d.documents.forEach((doc) => grid.appendChild(C.docCard(doc)));
    return el('div', {}, [
      el('a', { class: 'back-link', href: '#/' }, [icon('arrowleft'), 'All categories']),
      C.sectionHead(d.label || domain),
      grid,
    ]);
  }

  async function reader(docId) {
    const d = await Api.source(docId);
    if (d.error) return el('div', {}, [el('a', { class: 'back-link', href: '#/' }, [icon('arrowleft'), 'Back']), C.empty('Document not found.')]);
    const body = el('div', { class: 'doc' }, []);
    body.appendChild(el('h1', {}, [d.doc_title]));
    body.appendChild(el('div', { class: 'src-foot', style: 'margin-bottom:16px' }, [
      el('span', { class: 'badge' }, [d.domain]), d.tier ? el('span', { class: 'tag' }, [d.tier]) : null,
      el('span', { style: 'color:var(--ink-mute)' }, [d.license || '']),
    ]));
    body.appendChild(MD.render(d.text, { skipTitle: d.doc_title }));
    const goBack = (e) => {
      e.preventDefault();
      // deep links have no in-app history — don't navigate away from Needfire
      if (history.length > 1) history.back(); else location.hash = '#/';
    };
    // pin to kit + guided-protocol cross-link
    const pinBtn = el('button', { class: 'btn' + (Prefs.isPinned(docId) ? ' pinned' : '') },
      [Prefs.isPinned(docId) ? '★ In your kit' : '☆ Pin to kit']);
    pinBtn.addEventListener('click', () => {
      const on = Prefs.togglePin(docId);
      pinBtn.textContent = on ? '★ In your kit' : '☆ Pin to kit';
      pinBtn.classList.toggle('pinned', on);
    });
    const actions = el('div', { class: 'reader-actions' }, [pinBtn]);
    Emergency.forDoc(docId).then((proto) => {
      if (proto) {
        actions.appendChild(el('a', { class: 'btn primary', href: '#/emergency/' + proto.id, style: 'text-decoration:none' },
          ['▶ Open guided protocol']));
      }
    });
    return el('div', { class: 'reader' }, [
      el('a', { class: 'back-link', href: '#/', onclick: goBack }, [icon('arrowleft'), 'Back']),
      actions,
      body,
    ]);
  }

  async function corpus() {
    const wrap = el('div', {}, [
      C.sectionHead('Knowledge corpus'),
      el('p', { style: 'color:var(--ink-dim);margin:0 0 18px;max-width:680px' },
        ['The bundled seed library works offline now. Download additional openly-licensed sources below (requires a connection). Files verify by SHA-256 after download.']),
      el('div', { class: 'grid cards', id: 'corpus-grid' }, [el('div', { class: 'empty' }, [el('span', { class: 'spinner' })])]),
    ]);
    async function refresh() {
      const d = await Api.corpus();
      const grid = wrap.querySelector('#corpus-grid');
      grid.innerHTML = '';
      d.sources.forEach((s) => {
        const job = (d.job.items || {})[s.id];
        const gb = (s.approx_bytes / 1e9).toFixed(s.approx_bytes < 1e9 ? 2 : 1);
        let statusNode;
        if (s.installed) statusNode = el('span', { class: 'tag ok' }, ['Installed']);
        else if (job && job.state === 'downloading') {
          const pct = job.total ? Math.round((100 * job.bytes) / job.total) : 0;
          statusNode = el('div', { style: 'min-width:120px' }, [
            el('div', { class: 'meter' }, [el('span', { style: 'width:' + pct + '%' })]),
            el('div', { class: 'stat-sub', style: 'margin-top:4px' }, [pct + '%']),
          ]);
        } else if (job && job.state === 'error') statusNode = el('span', { class: 'tag' }, ['Error']);
        else if (job && job.state === 'skipped') statusNode = el('span', { class: 'tag' }, ['Set URL']);
        else statusNode = el('button', { class: 'btn primary', onclick: async () => { await Api.download([s.id]); poll(); } }, ['Download']);

        grid.appendChild(el('div', { class: 'card' }, [
          el('div', { class: 'src-top' }, [el('span', { class: 'badge' }, [s.domain]), el('span', { class: 'tag' }, [s.tier])]),
          el('h3', { style: 'margin:0 0 6px;font-size:16px' }, [s.title]),
          el('div', { class: 'src-foot', style: 'margin-bottom:14px' }, [el('span', {}, [s.license]), el('span', {}, ['~' + gb + ' GB'])]),
          el('div', { class: 'corpus-row' }, [el('span', { class: 'grow' }), statusNode]),
        ]));
      });
    }
    let timer = null;
    function poll() { clearInterval(timer); timer = setInterval(async () => { const j = await Api.corpusStatus(); if (!j.active) { clearInterval(timer); } await refresh(); }, 800); }
    wrap.addEventListener('view:teardown', () => clearInterval(timer));
    await refresh();
    // a download started earlier (or from another client) should animate too
    Api.corpusStatus().then((j) => { if (j.active) poll(); }).catch(() => {});
    return wrap;
  }

  async function status() {
    const d = await Api.system();
    const cards = [];
    const b = d.battery;
    if (b && b.present) cards.push(C.stat('Battery', b.percent + '%', (b.status || '') + (b.power_now_w ? ' · ' + b.power_now_w + ' W' : ''), b.percent, b.percent < 20 ? 'red' : 'green'));
    if (d.cpu_percent != null) cards.push(C.stat('CPU', d.cpu_percent + '%', 'utilisation', d.cpu_percent));
    if (d.memory) cards.push(C.stat('Memory', d.memory.percent + '%', d.memory.used_mb + ' / ' + d.memory.total_mb + ' MB', d.memory.percent));
    if (d.disk) cards.push(C.stat('Storage', d.disk.free_gb + ' GB', 'free of ' + d.disk.total_gb + ' GB', d.disk.percent));
    if (d.temp_c != null) cards.push(C.stat('Temperature', d.temp_c + '°C', 'system thermal', Math.min(100, d.temp_c), d.temp_c > 75 ? 'red' : 'green'));
    cards.push(C.stat('Corpus', String(d.corpus.documents), d.corpus.chunks + ' chunks indexed'));
    const m = d.models;
    cards.push(C.stat('AI Models', m.available ? String(m.installed.length || '✓') : 'None',
      m.available ? 'runtime online' : 'sources-only mode'));
    cards.push(C.stat('Embeddings',
      m.embed_backend === 'ollama' ? (m.embed_ready === false ? 'Degraded' : 'Semantic') : 'Hash',
      m.embed_ready === false
        ? 'index needs Ollama — using keyword search'
        : m.embed_backend + ' backend',
      null, m.embed_ready === false ? 'red' : null));

    return el('div', {}, [
      C.sectionHead('System & power'),
      el('div', { class: 'grid stat-grid' }, cards),
      C.sectionHead('Knowledge by domain'),
      el('div', { class: 'grid cats' }, Object.entries(d.corpus.by_domain || {}).map(([dom, n]) =>
        el('a', { class: 'card cat', href: '#/category/' + dom }, [el('h3', {}, [dom]), el('div', { class: 'count' }, [n + ' docs'])]))),
    ]);
  }

  return { home, askView, search, category, reader, corpus, status };
})();
