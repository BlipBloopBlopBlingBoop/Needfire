/* Studio: the standalone-computer workspace — playground, files/editor,
   terminal, Python. Everything except the client-only playground is behind the
   password gate (server enforces it; the UI shows a login screen on 401).
   Also exposes Studio.gate() — the shared login/setup screen reused by the
   Models and Content pages. */
const Studio = (function () {
  const el = C.el, icon = C.icon;

  /* ---- shared auth gate ----
     Renders into `host`; calls onReady() once a session exists. */
  async function gate(host, onReady) {
    let status;
    try { status = await Api.auth.status(); }
    catch (e) { host.appendChild(C.empty('Cannot reach the server.')); return; }
    if (status.authed) { onReady(); return; }

    const setup = status.needs_setup;
    const input = el('input', { type: 'password', 'aria-label': 'Password',
      placeholder: setup ? 'Choose a password (8+ characters)' : 'Password' });
    const msg = el('div', { class: 'gate-msg' }, []);
    const submit = async () => {
      const pw = input.value;
      if (!pw) return;
      if (setup && pw.length < 8) { msg.textContent = 'Use at least 8 characters.'; return; }
      msg.textContent = '';
      try {
        const r = setup ? await Api.auth.setup(pw) : await Api.auth.login(pw);
        if (r.ok) { host.innerHTML = ''; onReady(); }
        else { msg.textContent = r.error || 'Try again.'; }
      } catch (e) { msg.textContent = 'Network error.'; }
    };
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
    host.appendChild(el('div', { class: 'gate' }, [
      icon('lock'),
      el('h2', {}, [setup ? 'Set an owner password' : 'Owner password']),
      el('p', {}, [setup
        ? 'The powerful tools (running code, editing files, the terminal, downloading models and content) are locked with a password. Set one now — anyone with it gets full control of this computer.'
        : 'These tools are password-protected. Enter the owner password to continue.']),
      input,
      el('button', { class: 'btn primary', onclick: submit }, [setup ? 'Set password & unlock' : 'Unlock']),
      msg,
    ]));
  }

  // wrap an authed view fn: render login first, then the real content
  function authed(render) {
    const host = el('div', {}, []);
    gate(host, () => { render(host); });
    return host;
  }

  const APPS = [
    { id: 'playground', name: 'WEB PLAYGROUND', sub: 'HTML · CSS · JS, live', icon: 'code' },
    { id: 'files', name: 'FILES & EDITOR', sub: 'browse and edit', icon: 'folder' },
    { id: 'terminal', name: 'TERMINAL', sub: 'run commands', icon: 'terminal' },
    { id: 'python', name: 'PYTHON', sub: 'run a script', icon: 'play' },
  ];

  function home() {
    return authed((host) => {
      host.appendChild(el('div', {}, [
        C.sectionHead('Studio — this computer is yours'),
        el('p', { class: 'muted-note' }, ['Build, edit, and run things directly on the machine. Changes are saved on the machine, not in your browser.']),
        el('div', { class: 'grid tools' }, APPS.map((a) =>
          el('a', { class: 'tool-card', href: '#/studio/' + a.id }, [
            icon(a.icon), el('span', { class: 'tool-name' }, [a.name]),
            el('span', { class: 'tool-sub' }, [a.sub]),
          ]))),
        el('div', { class: 'studio-foot' }, [
          el('button', { class: 'btn ghost', onclick: reloadApp }, [icon('refresh'), ' Reload app (after editing the UI)']),
          el('button', { class: 'btn ghost', onclick: async () => { await Api.auth.logout(); location.hash = '#/system'; } }, ['Lock Studio']),
        ]),
      ]));
    });
  }

  async function reloadApp() {
    try {
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.unregister()));
      }
      if (window.caches) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
    } catch (e) { /* best effort */ }
    location.reload();
  }

  function back() { return el('a', { class: 'back-link', href: '#/studio' }, [icon('arrowleft'), 'Studio']); }

  // ---------- playground (client-only) ----------
  function playground() {
    const html = el('textarea', { class: 'code', spellcheck: 'false' }, ['<h1>Hello from Needfire</h1>\n<p>Edit me — the preview updates live.</p>']);
    const css = el('textarea', { class: 'code', spellcheck: 'false' }, ['body{font-family:system-ui;padding:1rem}\nh1{color:#f5a623}']);
    const js = el('textarea', { class: 'code', spellcheck: 'false' }, ["document.querySelector('p').addEventListener('click',()=>alert('hi'))"]);
    const frame = el('iframe', { class: 'pg-preview', sandbox: 'allow-scripts allow-modals' });
    let t = null;
    function refresh() {
      const doc = '<!doctype html><html><head><style>' + css.value +
        '</style></head><body>' + html.value + '<' + 'script>' + js.value + '<' + '/script></body></html>';
      frame.srcdoc = doc;
    }
    [html, css, js].forEach((t2) => t2.addEventListener('input', () => { clearTimeout(t); t = setTimeout(refresh, 300); }));
    setTimeout(refresh, 50);
    return el('div', {}, [
      back(),
      el('div', { class: 'pg' }, [
        el('div', { class: 'pg-editors' }, [
          el('label', {}, ['HTML']), html,
          el('label', {}, ['CSS']), css,
          el('label', {}, ['JavaScript']), js,
        ]),
        el('div', { class: 'pg-out' }, [el('label', {}, ['Live preview']), frame]),
      ]),
    ]);
  }

  // ---------- files & editor ----------
  function files() {
    const wrap = el('div', {}, [back()]);
    return authed_view(wrap, () => filesInner(wrap));
  }
  // (files/terminal/python are already behind Studio.home's gate when reached
  //  via a link, but a direct deep link needs its own gate)
  function authed_view(wrap, render) {
    Api.auth.status().then((s) => {
      if (s.authed) render();
      else { const g = el('div', {}, []); wrap.appendChild(g); gate(g, () => { g.remove(); render(); }); }
    });
    return wrap;
  }

  function filesInner(wrap) {
    let root = 'workspace', cur = '';
    const tree = el('div', { class: 'fs-tree' }, []);
    const pathLabel = el('div', { class: 'fs-path' }, []);
    const editor = el('textarea', { class: 'code editor', spellcheck: 'false' }, ['']);
    const gutter = el('div', { class: 'gutter' }, []);
    const nameLabel = el('div', { class: 'fs-file' }, ['(no file open)']);
    const warn = el('div', { class: 'fs-warn', style: 'display:none' }, []);
    let openPath = null;

    function syncGutter() {
      const n = editor.value.split('\n').length;
      gutter.textContent = Array.from({ length: n }, (_, i) => i + 1).join('\n');
    }
    editor.addEventListener('input', syncGutter);
    editor.addEventListener('scroll', () => { gutter.scrollTop = editor.scrollTop; });
    editor.addEventListener('keydown', (e) => {
      if (e.key === 'Tab') { e.preventDefault(); const s = editor.selectionStart; editor.value = editor.value.slice(0, s) + '  ' + editor.value.slice(editor.selectionEnd); editor.selectionStart = editor.selectionEnd = s + 2; syncGutter(); }
      if ((e.metaKey || e.ctrlKey) && e.key === 's') { e.preventDefault(); save(); }
    });

    async function load() {
      tree.innerHTML = '';
      let d;
      try { d = await Api.fs.list(root, cur); }
      catch (e) { tree.appendChild(C.empty('Could not list files.')); return; }
      pathLabel.textContent = '/' + (cur || '');
      if (cur) tree.appendChild(el('div', { class: 'fs-item dir', onclick: () => { cur = cur.split('/').slice(0, -1).join('/'); load(); } }, [icon('arrowleft'), '..']));
      d.entries.forEach((en) => {
        tree.appendChild(el('div', { class: 'fs-item ' + en.type, onclick: () => {
          if (en.type === 'dir') { cur = (cur ? cur + '/' : '') + en.name; load(); }
          else openFile((cur ? cur + '/' : '') + en.name);
        } }, [icon(en.type === 'dir' ? 'folder' : 'file'), en.name]));
      });
    }
    async function openFile(p) {
      try {
        const d = await Api.fs.read(root, p);
        openPath = p; nameLabel.textContent = p; editor.value = d.content; syncGutter();
        warn.style.display = root === 'web' ? '' : 'none';
        if (root === 'web') warn.textContent = "You are editing the app's own interface. Use “Reload app” in Studio to see changes.";
      } catch (e) { editor.value = '(could not open: ' + (e.message || e) + ')'; }
    }
    async function save() {
      if (!openPath) return;
      nameLabel.textContent = openPath + ' — saving…';
      try { await Api.fs.write(root, openPath, editor.value); nameLabel.textContent = openPath + ' — saved'; }
      catch (e) { nameLabel.textContent = openPath + ' — save failed'; }
    }
    async function newFile() {
      const name = prompt('New file name (in ' + (cur || 'root') + '):');
      if (!name) return;
      const p = (cur ? cur + '/' : '') + name;
      await Api.fs.write(root, p, ''); load(); openFile(p);
    }

    const rootSel = el('select', { onchange: (e) => { root = e.target.value; cur = ''; load(); } }, [
      el('option', { value: 'workspace' }, ['workspace (your files)']),
      el('option', { value: 'web' }, ['web (the app UI)']),
    ]);

    wrap.appendChild(el('div', { class: 'fs' }, [
      el('div', { class: 'fs-side' }, [
        el('div', { class: 'fs-bar' }, [rootSel, el('button', { class: 'btn ghost', title: 'New file', onclick: newFile }, [icon('plus')])]),
        pathLabel, tree,
      ]),
      el('div', { class: 'fs-main' }, [
        el('div', { class: 'fs-bar' }, [nameLabel, el('button', { class: 'btn', onclick: save }, ['Save']), el('span', { class: 'kbd' }, ['Ctrl/Cmd-S'])]),
        warn,
        el('div', { class: 'editor-wrap' }, [gutter, editor]),
      ]),
    ]));
    load(); syncGutter();
  }

  // ---------- terminal ----------
  function terminal() {
    const wrap = el('div', {}, [back()]);
    return authed_view(wrap, () => {
      const logEl = el('div', { class: 'term-log' }, []);
      const cwd = el('span', { class: 'term-cwd' }, ['workspace']);
      const inp = el('input', { class: 'term-in', 'aria-label': 'Command', placeholder: 'type a command, press Enter', spellcheck: 'false', autocapitalize: 'off', autocomplete: 'off' });
      const hist = []; let hi = -1;
      function append(text, cls) { logEl.appendChild(el('div', { class: 'term-line ' + (cls || '') }, [text])); logEl.scrollTop = logEl.scrollHeight; }
      function submit() {
        const cmd = inp.value.trim(); if (!cmd) return;
        hist.push(cmd); hi = hist.length; inp.value = ''; inp.disabled = true;
        append('$ ' + cmd, 'cmd');
        Api.run({ cmd }, {
          onOut: (line) => append(line),
          onDone: (d) => { if (d.cwd) cwd.textContent = d.cwd.split(/[\\/]/).pop(); inp.disabled = false; inp.focus(); },
          onErr: (e) => append('[' + (e.error || 'error') + ']', 'err'),
          onClose: () => { inp.disabled = false; },
        });
      }
      inp.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') submit();
        else if (e.key === 'ArrowUp' && hi > 0) { hi--; inp.value = hist[hi]; }
        else if (e.key === 'ArrowDown' && hi < hist.length - 1) { hi++; inp.value = hist[hi]; }
      });
      wrap.appendChild(el('div', { class: 'term' }, [
        el('div', { class: 'term-note' }, ['Runs commands on this computer, in a workspace folder. A command runner, not a full terminal (no vim/htop). ~60s limit per command.']),
        logEl,
        el('div', { class: 'term-input' }, [cwd, el('span', {}, [' $']), inp]),
      ]));
      setTimeout(() => inp.focus(), 50);
    });
  }

  // ---------- python ----------
  function python() {
    const wrap = el('div', {}, [back()]);
    return authed_view(wrap, () => {
      const code = el('textarea', { class: 'code editor', spellcheck: 'false' }, ['print("Hello from Python on the Bothy")\nimport sys\nprint(sys.version)']);
      const out = el('div', { class: 'term-log' }, []);
      const run = () => {
        out.innerHTML = '';
        Api.run({ py: true, code: code.value }, {
          onOut: (line) => { out.appendChild(el('div', { class: 'term-line' }, [line])); out.scrollTop = out.scrollHeight; },
          onErr: (e) => out.appendChild(el('div', { class: 'term-line err' }, ['[' + (e.error || 'error') + ']'])),
        });
      };
      wrap.appendChild(el('div', { class: 'py' }, [
        el('div', { class: 'fs-bar' }, [el('span', {}, ['Python scratchpad']), el('button', { class: 'btn primary', onclick: run }, [icon('play'), ' Run'])]),
        el('div', { class: 'editor-wrap' }, [code]),
        el('label', {}, ['Output']), out,
      ]));
    });
  }

  const VIEWS = { playground, files, terminal, python };
  function view(id) { return VIEWS[id] ? VIEWS[id]() : C.empty('Unknown Studio tool.'); }

  return { home, view, gate, authed, reloadApp };
})();
