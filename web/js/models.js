/* Models: manage local AI models via Ollama — install status, pull with live
   progress, delete, and choose which model fills the tiny/reason/embed role.
   Read view is open; pull/delete/roles are password-gated (login on 401). */
const Models = (function () {
  const el = C.el, icon = C.icon;

  const INSTALL = {
    win: 'https://ollama.com/download/windows',
    mac: 'https://ollama.com/download/mac',
    linux: 'https://ollama.com/download/linux',
  };

  async function home() {
    const wrap = el('div', {}, [
      el('a', { class: 'back-link', href: '#/system' }, [icon('arrowleft'), 'System']),
      C.sectionHead('AI models'),
    ]);
    let d;
    try { d = await Api.models(); }
    catch (e) { wrap.appendChild(C.empty('Could not load models.')); return wrap; }

    if (!d.ollama_up) {
      wrap.appendChild(el('div', { class: 'panel-note' }, [
        el('h3', {}, ['Ollama is not running']),
        el('p', {}, ['Needfire uses Ollama to run local AI models. It is free and optional — without it, Needfire still answers using the source documents directly. To enable smart, cited answers, install Ollama on this computer:']),
        el('div', { class: 'install-links' }, [
          el('a', { class: 'btn', href: INSTALL.win, target: '_blank', rel: 'noopener' }, ['Windows']),
          el('a', { class: 'btn', href: INSTALL.mac, target: '_blank', rel: 'noopener' }, ['macOS']),
          el('a', { class: 'btn', href: INSTALL.linux, target: '_blank', rel: 'noopener' }, ['Linux']),
        ]),
        el('p', { class: 'muted-note' }, ['After installing, start Ollama, then ', el('a', { href: '#', onclick: (e) => { e.preventDefault(); location.reload(); } }, ['recheck']), '. Expecting it at ' + d.ollama_url + '.']),
      ]));
    }

    // installed models
    if (d.installed && d.installed.length) {
      wrap.appendChild(C.sectionHead('Installed'));
      const list = el('div', { class: 'grid cards' }, []);
      d.installed.forEach((name) => {
        list.appendChild(el('div', { class: 'card model-row' }, [
          el('div', {}, [el('strong', {}, [name])]),
          el('button', { class: 'btn ghost danger', onclick: () => del(name) }, [icon('trash'), ' Delete']),
        ]));
      });
      wrap.appendChild(list);
    }

    // recommended
    wrap.appendChild(C.sectionHead('Recommended (one-click install)'));
    const rec = el('div', { class: 'grid cards' }, []);
    const installed = new Set(d.installed || []);
    d.recommended.forEach((m) => rec.appendChild(recCard(m, installed.has(m.name), d.ollama_up)));
    wrap.appendChild(rec);

    // roles
    if (d.installed && d.installed.length) {
      wrap.appendChild(C.sectionHead('Which model does what'));
      wrap.appendChild(rolesPanel(d));
    }
    return wrap;

    function del(name) {
      Api.modelDelete(name).then(() => location.reload())
        .catch((e) => { if (e.auth) showLogin(wrap); });
    }
  }

  function recCard(m, isInstalled, up) {
    const status = el('div', { class: 'rec-status' }, []);
    const btn = el('button', { class: 'btn primary', disabled: (!up || isInstalled) ? '' : null }, [
      isInstalled ? '✓ Installed' : (up ? 'Install' : 'Ollama needed'),
    ]);
    if (isInstalled) status.textContent = 'ready';
    btn.addEventListener('click', () => {
      if (isInstalled || !up) return;
      btn.disabled = ''; btn.textContent = 'Starting…';
      const bar = el('div', { class: 'meter' }, [el('span', { style: 'width:0%' })]);
      status.innerHTML = ''; status.appendChild(bar);
      Api.pullModel(m.name, {
        onProgress: (p) => {
          if (p.total) { const pct = Math.round(100 * (p.completed || 0) / p.total); bar.firstChild.style.width = pct + '%'; btn.textContent = pct + '%'; }
          else if (p.status) btn.textContent = p.status.slice(0, 14);
        },
        onDone: () => { btn.textContent = '✓ Installed'; status.textContent = 'ready'; },
        onErr: (e) => { btn.disabled = null; btn.textContent = 'Retry'; status.textContent = e.error || 'failed'; },
        onClose: () => { if (btn.textContent !== '✓ Installed') { btn.disabled = null; if (btn.textContent === 'Starting…') { showLoginMaybe(); } } },
      });
    });
    function showLoginMaybe() {
      // a 401 closes the EventSource immediately; surface the login screen
      Api.auth.status().then((s) => { if (!s.authed) location.hash = '#/studio'; });
    }
    return el('div', { class: 'card' }, [
      el('div', { class: 'src-top' }, [el('span', { class: 'badge' }, [m.role]), el('span', { class: 'tag' }, ['~' + m.size_gb + ' GB'])]),
      el('h3', {}, [m.name]),
      el('p', { class: 'snippet' }, [m.note + ' Needs ~' + m.ram_gb + ' GB RAM.']),
      el('div', { class: 'corpus-row' }, [status, el('span', { class: 'grow' }), btn]),
    ]);
  }

  function rolesPanel(d) {
    const opts = (sel) => d.installed.map((n) => el('option', Object.assign({ value: n }, n === sel ? { selected: '' } : {}), [n]));
    const tiny = el('select', {}, opts(d.roles.tiny));
    const reason = el('select', {}, opts(d.roles.reason));
    const embed = el('select', {}, opts(d.roles.embed));
    const msg = el('span', { class: 'muted-note' }, []);
    const save = () => {
      Api.modelRoles({ tiny: tiny.value, reason: reason.value, embed: embed.value })
        .then((r) => { msg.textContent = r.error ? r.error : 'Saved.'; })
        .catch((e) => { if (e.auth) location.hash = '#/studio'; });
    };
    return el('div', { class: 'panel-note' }, [
      el('p', { class: 'muted-note' }, ['Tiny = fast always-on model. Reason = better answers. Embed = semantic search (upgrades retrieval; reindex after changing it).']),
      el('div', { class: 'role-row' }, [el('label', {}, ['Tiny']), tiny]),
      el('div', { class: 'role-row' }, [el('label', {}, ['Reason']), reason]),
      el('div', { class: 'role-row' }, [el('label', {}, ['Embed']), embed]),
      el('div', { style: 'margin-top:.6rem' }, [el('button', { class: 'btn primary', onclick: save }, ['Save roles']), ' ', msg]),
    ]);
  }

  function showLogin(wrap) {
    wrap.innerHTML = '';
    Studio.gate(wrap, () => home().then((n) => { wrap.innerHTML = ''; wrap.appendChild(n); }));
  }

  return { home };
})();
