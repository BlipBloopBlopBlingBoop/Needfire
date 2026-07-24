/* Content: discover + download more of the knowledge library. Supersedes the
   old orphaned corpus view. Reading is open; setting URLs, adding sources,
   importing local files, and reindexing are password-gated. */
const Content = (function () {
  const el = C.el, icon = C.icon;

  async function home() {
    const wrap = el('div', {}, [
      el('a', { class: 'back-link', href: '#/system' }, [icon('arrowleft'), 'System']),
      C.sectionHead('Knowledge library'),
      el('p', { class: 'muted-note' }, ['The bundled 84-document seed library works offline right now. The catalog below adds big reference archives (Wikipedia, medical manuals, how-to guides) — just press Download, no links to paste. Every download is checked by SHA-256.']),
    ]);

    // one-click bulk download of the survival-critical tier
    wrap.appendChild(el('div', { class: 'content-card' }, [
      el('h3', {}, [icon('download'), ' One-click: survival-critical set (C1)']),
      el('p', { class: 'muted-note' }, ['Downloads the core C1 archives — WikiMed, the medicine/water/post-disaster collections, and iFixit repair guides. These are large files: you need internet and free disk space. Needfire finds the current build for each and verifies it by SHA-256.']),
      el('button', { class: 'btn primary', onclick: async () => { try { await Api.download(null, 'C1'); poll(); } catch (e) { gate(); } } }, [icon('download'), ' Download all C1']),
    ]));

    // add-content tools
    wrap.appendChild(el('div', { class: 'content-tools' }, [
      addByUrlForm(),
      importForm(),
      reindexBar(),
    ]));

    wrap.appendChild(C.sectionHead('Catalog sources'));
    const grid = el('div', { class: 'grid cards', id: 'content-grid' }, [C.empty('Loading…')]);
    wrap.appendChild(grid);

    let timer = null;
    async function refresh() {
      let d;
      try { d = await Api.corpus(); } catch (e) { grid.innerHTML = ''; grid.appendChild(C.empty('Could not load.')); return; }
      grid.innerHTML = '';
      d.sources.forEach((s) => grid.appendChild(sourceCard(s, d.job, poll)));
    }
    function poll() { clearInterval(timer); timer = setInterval(async () => { const j = await Api.corpusStatus(); if (!j.active) clearInterval(timer); await refresh(); }, 800); }
    wrap.addEventListener('view:teardown', () => clearInterval(timer));
    await refresh();
    Api.corpusStatus().then((j) => { if (j.active) poll(); }).catch(() => {});
    return wrap;
  }

  // The manual URL/hash fields — the fallback when a source has no resolvable
  // build (a region-specific map) or a one-click lookup fails (a mirror, offline).
  function manualFields(s, poll) {
    const inp = el('input', { class: 'mini-input', placeholder: 'paste download URL', 'aria-label': 'Download URL for ' + s.title });
    const hash = el('input', { class: 'mini-input', placeholder: 'sha256 (optional)', 'aria-label': 'Expected SHA-256 for ' + s.title });
    const msg = el('div', { class: 'muted-note' }, []);
    const savedl = async () => {
      if (!inp.value.trim()) return;
      msg.textContent = '';
      try {
        const r = await Api.content.setUrl(s.id, inp.value.trim(), true, hash.value.trim() || undefined);
        if (r && r.error) { msg.textContent = r.error; return; }
        poll();
      } catch (e) { if (e.auth) return gate(); msg.textContent = (e.message || 'failed'); }
    };
    return el('div', { class: 'url-set' }, [inp, hash, el('button', { class: 'btn primary', onclick: savedl }, ['Save & download']), msg]);
  }

  function sourceCard(s, job, poll) {
    const j = (job.items || {})[s.id];
    const gb = ((s.approx_bytes || 0) / 1e9).toFixed((s.approx_bytes || 0) < 1e9 ? 2 : 1);
    const state = j && j.state;
    let action;
    if (s.installed) {
      action = el('span', { class: 'tag ok' }, ['Installed']);
    } else if (state === 'downloading') {
      const pct = j.total ? Math.round(100 * j.bytes / j.total) : 0;
      action = el('div', { style: 'min-width:120px' }, [el('div', { class: 'meter' }, [el('span', { style: 'width:' + pct + '%' })]), el('div', { class: 'stat-sub', style: 'margin-top:4px' }, [pct + '%'])]);
    } else if (state === 'resolving') {
      action = el('div', { class: 'stat-sub' }, ['Finding current build…']);
    } else if (s.resolvable) {
      // one-click: no URL to paste. Offer manual override as a fallback.
      const slot = el('div', {}, []);
      const dl = el('button', { class: 'btn primary', onclick: async () => { try { await Api.download([s.id]); poll(); } catch (e) { gate(); } } }, [icon('download'), ' Download']);
      const toggle = el('button', { class: 'link-btn', onclick: () => { slot.innerHTML = ''; slot.appendChild(manualFields(s, poll)); } }, ['set link manually']);
      const err = (state === 'error' || state === 'skipped') && j.error
        ? el('div', { class: 'muted-note', style: 'color:var(--danger)' }, [j.error]) : null;
      action = el('div', {}, [el('div', { class: 'corpus-row' }, [dl, toggle]), err, slot]);
    } else {
      // needs a real URL (e.g. the region-specific map extract)
      action = manualFields(s, poll);
    }
    return el('div', { class: 'card' }, [
      el('div', { class: 'src-top' }, [el('span', { class: 'badge' }, [s.domain || 'reference']), s.tier ? el('span', { class: 'tag' }, [s.tier]) : null]),
      el('h3', { style: 'margin:0 0 6px;font-size:16px' }, [s.title]),
      el('div', { class: 'src-foot', style: 'margin-bottom:12px' }, [el('span', {}, [s.license || '']), (s.approx_bytes ? el('span', {}, ['~' + gb + ' GB']) : null)]),
      el('div', { class: 'corpus-row' }, [el('span', { class: 'grow' }), action]),
    ]);
  }

  function addByUrlForm() {
    const title = el('input', { class: 'mini-input', placeholder: 'Title', 'aria-label': 'Title' });
    const url = el('input', { class: 'mini-input', placeholder: 'https://…', 'aria-label': 'URL' });
    const msg = el('span', { class: 'muted-note' }, []);
    const add = async () => {
      if (!url.value.trim() || !title.value.trim()) { msg.textContent = 'Title and URL needed.'; return; }
      const id = title.value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40) || ('src-' + Date.now());
      try {
        const r = await Api.content.add({ id, title: title.value.trim(), url: url.value.trim() });
        if (r && r.error) { msg.textContent = r.error; return; }
        msg.textContent = 'Added — downloading.'; title.value = url.value = '';
      } catch (e) { if (e.auth) return gate(); msg.textContent = (e.message || 'failed'); }
    };
    return el('div', { class: 'content-card' }, [
      el('h3', {}, [icon('plus'), ' Add any download URL']),
      el('p', { class: 'muted-note' }, ['Point Needfire at any file on the web (a ZIM archive, a PDF, a text file).']),
      title, url, el('button', { class: 'btn primary', onclick: add }, ['Add & download']), msg,
    ]);
  }

  function importForm() {
    const path = el('input', { class: 'mini-input', placeholder: '/full/path/to/file.md', 'aria-label': 'File path on this computer' });
    const msg = el('span', { class: 'muted-note' }, []);
    const imp = async () => {
      if (!path.value.trim()) return;
      try { const r = await Api.content.import(path.value.trim()); msg.textContent = 'Imported ' + r.imported + ' — press Reindex.'; path.value = ''; }
      catch (e) { if (e.auth) return gate(); msg.textContent = (e.message || 'failed'); }
    };
    return el('div', { class: 'content-card' }, [
      el('h3', {}, [icon('file'), ' Import a file already on this computer']),
      el('p', { class: 'muted-note' }, ['Give the full path to a .md, .txt, or .zim file on the machine running Needfire. It is copied into the library.']),
      path, el('button', { class: 'btn primary', onclick: imp }, ['Import']), msg,
    ]);
  }

  function reindexBar() {
    const msg = el('span', { class: 'muted-note' }, []);
    let timer = null;
    const go = async () => {
      try { await Api.content.reindex(); }
      catch (e) { if (e.auth) return gate(); msg.textContent = 'failed'; return; }
      msg.textContent = 'Rebuilding index…';
      clearInterval(timer);
      timer = setInterval(async () => {
        const st = await Api.content.reindexStatus();
        if (!st.active) { clearInterval(timer); msg.textContent = st.error ? ('Error: ' + st.error) : ('Done — ' + (st.stats ? st.stats.documents + ' documents indexed.' : 'rebuilt.')); }
      }, 1000);
    };
    return el('div', { class: 'content-card' }, [
      el('h3', {}, [icon('refresh'), ' Reindex the library']),
      el('p', { class: 'muted-note' }, ['After adding or importing content, rebuild the search index so it becomes searchable.']),
      el('button', { class: 'btn primary', onclick: go }, ['Reindex now']), msg,
    ]);
  }

  function gate() { location.hash = '#/studio'; }  // reuse the Studio login screen

  return { home };
})();
