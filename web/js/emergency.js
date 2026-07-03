/* Emergency mode: scenario tile grid + full-screen guided protocol player.
   Data: /data/protocols.json (service-worker precached, so this view works
   even if the index/server hiccups). Every protocol links its source doc. */
const Emergency = (function () {
  const el = C.el, icon = C.icon;
  let cache = null;

  async function load() {
    if (cache) return cache;
    cache = await Api.protocols();
    return cache;
  }
  function byId(data, id) {
    return data.protocols.find((p) => p.id === id) || null;
  }

  // ---- tile grid ----
  async function grid() {
    let data;
    try { data = await load(); }
    catch (e) { return C.empty('Could not load emergency protocols. Reload to retry.'); }
    const tiles = data.protocols.map((p) =>
      el('a', { class: 'tile sev-' + p.severity, href: '#/emergency/' + p.id }, [
        icon(p.icon),
        el('span', { class: 'tile-label' }, [p.short]),
      ]));
    return el('div', {}, [
      el('div', { class: 'emergency-head' }, [
        el('h1', {}, ['EMERGENCY']),
        el('p', {}, ['Pick the situation. Steps are guided — read each one fully before acting.']),
      ]),
      el('div', { class: 'grid tiles' }, tiles),
      el('p', { style: 'color:var(--ink-mute);font-size:0.78rem;text-align:center;margin-top:1.2rem' },
        ['Guided summaries of the library documents — each protocol links its full source.']),
    ]);
  }

  // ---- protocol player ----
  async function player(id) {
    let data;
    try { data = await load(); }
    catch (e) { return C.empty('Could not load protocols.'); }
    const proto = byId(data, id);
    if (!proto) return C.empty('Unknown protocol.');

    const steps = {};
    proto.steps.forEach((s) => { steps[s.id] = s; });

    const state = { stepId: null, trail: [], entered: false };
    const body = el('div', { class: 'player-body' }, []);
    const pos = el('span', { class: 'p-pos' }, ['']);

    // body.player-mode is applied by the router when this node renders
    Instruments.WakeLock.on();

    function teardownTimers() {
      body.querySelectorAll('.timer-box').forEach((t) =>
        t.dispatchEvent(new CustomEvent('nf:teardown')));
    }
    function exit() { location.hash = '#/emergency'; }

    function nextOf(step) {
      if (step.next) return step.next;
      const i = proto.steps.indexOf(step);
      return i >= 0 && i + 1 < proto.steps.length ? proto.steps[i + 1].id : 'END';
    }

    function show(stepId, isBack) {
      teardownTimers();
      if (!isBack && state.stepId) state.trail.push(state.stepId);
      state.stepId = stepId;
      body.innerHTML = '';
      window.scrollTo(0, 0);

      if (stepId === 'END') return showEnd();
      const step = steps[stepId];
      if (!step) return showEnd();
      pos.textContent = 'STEP ' + (state.trail.length + 1);

      // entry warning only on the very first screen
      if (!state.entered && proto.entry_warning) {
        body.appendChild(el('div', { class: 'entry-warning' }, [proto.entry_warning]));
      }
      state.entered = true;

      const text = el('div', { class: 'step-text' }, []);
      text.appendChild(MD.render(step.text));
      body.appendChild(text);

      if (step.warning) {
        body.appendChild(el('div', { class: 'step-warning' }, [
          icon('alert'), el('div', {}, [step.warning]),
        ]));
      }
      if (step.timer) body.appendChild(Instruments.mountTimer(step.timer, proto.id, step.id));
      if (step.detail) {
        const d = el('div', {}, []);
        d.appendChild(MD.render(step.detail));
        body.appendChild(el('details', { class: 'step-detail' }, [
          el('summary', {}, ['More detail']), d,
        ]));
      }
      if (step.type === 'loop' && step.loop) {
        const u = el('div', { class: 'loop-until' }, []);
        u.appendChild(el('b', {}, ['Keep going until: ']));
        u.appendChild(document.createTextNode(step.loop.until));
        body.appendChild(u);
      }

      // controls
      const controls = el('div', { class: 'player-controls' }, []);
      if (step.type === 'decision') {
        (step.options || []).forEach((opt) => {
          controls.appendChild(el('button', {
            class: 'big-btn ' + (opt.tone === 'danger' ? 'danger' : opt.tone === 'ok' ? 'ok' : ''),
            onclick: () => show(opt.goto),
          }, [opt.label]));
        });
      } else if (step.type === 'loop') {
        controls.appendChild(el('button', { class: 'big-btn danger', onclick: () => show(step.loop.back_to) },
          ['RESTART CYCLE']));
        controls.appendChild(el('button', { class: 'big-btn primary', onclick: () => show(nextOf(step)) },
          ['CONDITION MET — MOVE ON']));
      } else {
        controls.appendChild(el('button', { class: 'big-btn primary', onclick: () => show(nextOf(step)) },
          ['DONE — NEXT']));
      }
      if (state.trail.length) {
        controls.appendChild(el('button', {
          class: 'big-btn ghost',
          onclick: () => { const prev = state.trail.pop(); show(prev, true); },
        }, ['← Back a step']));
      }
      body.appendChild(controls);
    }

    function showEnd() {
      pos.textContent = 'COMPLETE';
      const wrap = el('div', { style: 'text-align:center;padding-top:2rem' }, [
        el('div', { class: 'step-text' }, [el('p', {}, [el('strong', {}, ['Protocol complete.']),
          ' Keep monitoring the person and re-run any step you need.'])]),
      ]);
      // live stamps recorded during this protocol
      Prefs.stamps().filter((s) => s.proto === proto.id).forEach((s) => {
        const line = el('p', { class: 'stamp-live' }, [
          s.label + ': ' + new Date(s.t).toTimeString().slice(0, 5) +
          ' — ' + Instruments.fmtSince(s.t) + ' ago  ',
        ]);
        line.appendChild(el('button', { class: 'btn ghost', onclick: () => { Prefs.clearStamp(s.proto, s.step); line.remove(); } }, ['clear']));
        wrap.appendChild(line);
      });
      const controls = el('div', { class: 'player-controls' }, [
        el('a', { class: 'big-btn primary', href: '#/read/' + encodeURIComponent(proto.source_doc) }, ['READ THE FULL DOCUMENT']),
        el('a', { class: 'big-btn ghost', href: '#/emergency' }, ['Back to emergency grid']),
      ]);
      wrap.appendChild(controls);
      body.appendChild(wrap);
    }

    const head = el('div', { class: 'player-head' }, [
      el('span', { class: 'p-title' }, [proto.title]),
      pos,
      el('button', { class: 'p-exit', onclick: exit }, ['EXIT']),
    ]);
    const foot = el('div', { class: 'player-foot' }, [
      el('span', {}, [proto.disclaimer]),
      el('a', { href: '#/read/' + encodeURIComponent(proto.source_doc) }, ['Full document →']),
    ]);
    const root = el('div', { class: 'player' }, [head, body, foot]);

    root.addEventListener('view:teardown', () => {
      teardownTimers();
      Instruments.WakeLock.off();
    });

    // player keyboard: space/→ next, ← back, esc exit
    const keys = (e) => {
      if (e.target.matches('input, textarea, select')) return;
      if (e.key === 'Escape') { exit(); }
      else if ((e.key === ' ' || e.key === 'ArrowRight') && state.stepId !== 'END') {
        const step = steps[state.stepId];
        if (step && step.type !== 'decision') { e.preventDefault(); show(nextOf(step)); }
      } else if (e.key === 'ArrowLeft' && state.trail.length) {
        show(state.trail.pop(), true);
      }
    };
    document.addEventListener('keydown', keys);
    root.addEventListener('view:teardown', () => document.removeEventListener('keydown', keys));

    show(proto.start);
    return root;
  }

  // exposes protocol list for cross-links (reader "open guided protocol")
  async function forDoc(docId) {
    try {
      const data = await load();
      return data.protocols.find((p) => p.source_doc === docId) || null;
    } catch (e) { return null; }
  }

  return { grid, player, forDoc };
})();
