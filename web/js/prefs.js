/* User preferences + persistent field state, localStorage-backed.
   Keys: nf.theme (dark|night|day), nf.scale (1..4), nf.pins (doc_id[]),
   nf.stamps ([{proto, step, label, t}]). The boot snippet in index.html reads
   nf.theme/nf.scale before CSS loads so there is no theme flash. */
const Prefs = (function () {
  const THEMES = ['dark', 'night', 'day'];

  function get(key, fallback) {
    try {
      const v = localStorage.getItem(key);
      return v == null ? fallback : JSON.parse(v);
    } catch (e) { return fallback; }
  }
  function set(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* private mode */ }
  }

  // ---- theme ----
  function theme() { return get('nf.theme', 'dark'); }
  function applyTheme(t) {
    document.documentElement.setAttribute('data-theme', t);
    // keep the browser chrome (iOS status bar, Android task switcher) in sync
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      meta.setAttribute('content',
        t === 'night' ? '#000000' : t === 'day' ? '#f5f3ee' : '#0d1117');
    }
  }
  function cycleTheme() {
    const next = THEMES[(THEMES.indexOf(theme()) + 1) % THEMES.length];
    set('nf.theme', next);
    applyTheme(next);
    return next;
  }

  // ---- text scale ----
  function scale() { return get('nf.scale', 1); }
  function setScale(n) {
    n = Math.min(4, Math.max(1, n));
    set('nf.scale', n);
    document.documentElement.setAttribute('data-scale', String(n));
    return n;
  }
  function cycleScale() { return setScale(scale() >= 4 ? 1 : scale() + 1); }

  // ---- pinned documents ("your kit") ----
  function pins() { return get('nf.pins', []); }
  function isPinned(docId) { return pins().indexOf(docId) !== -1; }
  function togglePin(docId) {
    const p = pins();
    const i = p.indexOf(docId);
    if (i === -1) p.push(docId); else p.splice(i, 1);
    set('nf.pins', p);
    return i === -1;
  }

  // ---- persistent time stamps (tourniquet time, bite time, birth time) ----
  function stamps() { return get('nf.stamps', []); }
  function addStamp(proto, step, label) {
    const s = stamps().filter((x) => !(x.proto === proto && x.step === step));
    const entry = { proto, step, label, t: Date.now() };
    s.push(entry);
    set('nf.stamps', s);
    document.dispatchEvent(new CustomEvent('nf:stamps'));
    return entry;
  }
  function getStamp(proto, step) {
    return stamps().find((x) => x.proto === proto && x.step === step) || null;
  }
  function clearStamp(proto, step) {
    set('nf.stamps', stamps().filter((x) => !(x.proto === proto && x.step === step)));
    document.dispatchEvent(new CustomEvent('nf:stamps'));
  }

  return { theme, applyTheme, cycleTheme, scale, setScale, cycleScale,
           pins, isPinned, togglePin,
           stamps, addStamp, getStamp, clearStamp };
})();
