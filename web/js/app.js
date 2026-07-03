/* Hash router + boot + instrument strip. Maps #/route to a view function. */
(function () {
  const view = document.getElementById('view');
  let current = null;

  function setActiveNav(name) {
    document.querySelectorAll('.topnav a, .tabbar a').forEach((a) =>
      a.classList.toggle('active', a.getAttribute('data-nav') === name));
  }

  async function render(node, navName) {
    if (current) current.dispatchEvent(new CustomEvent('view:teardown'));
    document.body.classList.remove('strobe-on');
    // full-screen protocol player hides the chrome (set here, not in the view,
    // so player→player navigation can't lose it to teardown ordering)
    document.body.classList.toggle('player-mode',
      !!(node.classList && node.classList.contains('player')));
    view.innerHTML = '';
    view.appendChild(node);
    current = node;
    setActiveNav(navName);
    window.scrollTo(0, 0);
  }

  function loading() {
    const d = C.el('div', { class: 'empty' }, [C.el('span', { class: 'spinner' })]);
    view.innerHTML = ''; view.appendChild(d);
  }

  const routes = [
    [/^\/?$/, () => Views.home(), 'home'],
    [/^\/ask\/(.+)$/, (m) => Views.askView(decodeURIComponent(m[1])), 'home'],
    [/^\/ask\/?$/, () => Views.home(), 'home'],
    [/^\/search\/(.+)$/, (m) => Views.search(decodeURIComponent(m[1])), 'home'],
    [/^\/category\/(.+)$/, (m) => Views.category(decodeURIComponent(m[1])), 'home'],
    [/^\/read\/(.+)$/, (m) => Views.reader(decodeURIComponent(m[1])), 'home'],
    [/^\/corpus\/?$/, () => Content.home(), 'system'],  // old bookmark → Content
    [/^\/content\/?$/, () => Content.home(), 'system'],
    [/^\/status\/?$/, () => Views.status(), 'system'],
    [/^\/system\/?$/, () => System.home(), 'system'],
    [/^\/models\/?$/, () => Models.home(), 'system'],
    [/^\/emergency\/?$/, () => Emergency.grid(), 'emergency'],
    [/^\/emergency\/([\w-]+)$/, (m) => Emergency.player(m[1]), 'emergency'],
    [/^\/toolkit\/?$/, () => Tools.home(), 'toolkit'],
    [/^\/toolkit\/([\w-]+)$/, (m) => Tools.view(m[1]), 'toolkit'],
    [/^\/studio\/?$/, () => Studio.home(), 'studio'],
    [/^\/studio\/([\w-]+)$/, (m) => Studio.view(m[1]), 'studio'],
  ];

  async function route() {
    const hash = location.hash.replace(/^#/, '') || '/';
    for (const [re, fn, nav] of routes) {
      const m = hash.match(re);
      if (m) {
        loading();
        try {
          const node = await fn(m);
          await render(node, nav);
        } catch (e) {
          view.innerHTML = '';
          view.appendChild(C.empty('Something went wrong: ' + e.message));
        }
        return;
      }
    }
    view.innerHTML = '';
    view.appendChild(C.empty('Page not found.'));
  }

  /* ---- instrument strip ---- */
  const segClock = document.getElementById('seg-clock');
  const segBatt = document.getElementById('seg-batt');
  const segLink = document.getElementById('seg-link');
  const segDocs = document.getElementById('seg-docs');
  const segStamp = document.getElementById('seg-stamp');
  const netLabel = document.getElementById('net-label');

  function tickClock() {
    const d = new Date();
    segClock.textContent = String(d.getHours()).padStart(2, '0') + ':' +
                           String(d.getMinutes()).padStart(2, '0');
  }
  setInterval(tickClock, 5000); tickClock();

  function setNet(ok) {
    netLabel.textContent = ok ? 'LINK OK' : 'NO LINK';
    segLink.classList.toggle('down', !ok);
    segLink.title = ok
      ? 'Connected to Needfire. It serves locally and needs no internet.'
      : 'Cannot reach the Needfire server. Check power and your Wi-Fi link to the Bothy.';
  }
  async function checkNet() {
    try { await Api.health(); setNet(true); } catch (e) { setNet(false); }
  }
  async function refreshSystem() {
    try {
      const s = await Api.system();
      if (s.battery && s.battery.present) {
        segBatt.hidden = false;
        segBatt.textContent = '▮ ' + s.battery.percent + '%';
        segBatt.title = 'Bothy battery — ' + (s.battery.status || '');
      } else { segBatt.hidden = true; }
      if (s.corpus) {
        segDocs.hidden = false;
        segDocs.textContent = s.corpus.documents + ' DOCS';
        segDocs.title = s.corpus.chunks + ' chunks indexed';
      }
      segBatt.classList.remove('stale'); segDocs.classList.remove('stale');
    } catch (e) {
      segBatt.classList.add('stale'); segDocs.classList.add('stale');
    }
  }
  setInterval(checkNet, 20000);
  setInterval(refreshSystem, 30000);
  window.addEventListener('online', checkNet);
  window.addEventListener('offline', checkNet);

  // persistent stamp badge (tourniquet time etc.) — never more than a glance away
  function refreshStamp() {
    const stamps = Prefs.stamps();
    if (!stamps.length) { segStamp.hidden = true; return; }
    const s = stamps[stamps.length - 1];
    segStamp.hidden = false;
    segStamp.textContent = s.label.split(' ')[0].toUpperCase() + ' ' + Instruments.fmtSince(s.t);
    segStamp.title = s.label + ' — tap to open the protocol';
    segStamp.onclick = () => { location.hash = '#/emergency/' + s.proto; };
  }
  document.addEventListener('nf:stamps', refreshStamp);
  setInterval(refreshStamp, 30000);
  refreshStamp();

  /* ---- theme + text size controls ---- */
  const themeBtn = document.getElementById('btn-theme');
  const themeIcons = { dark: 'moon', night: 'contrast', day: 'sun' };
  function themeIcon() {
    themeBtn.innerHTML = '';
    themeBtn.appendChild(C.icon(themeIcons[Prefs.theme()] || 'moon'));
  }
  themeBtn.addEventListener('click', () => { Prefs.cycleTheme(); themeIcon(); });
  document.getElementById('btn-text').addEventListener('click', () => Prefs.cycleScale());
  themeIcon();

  /* ---- keyboard map ---- */
  document.addEventListener('keydown', (e) => {
    if (e.target.matches('input, textarea, select') || e.metaKey || e.ctrlKey || e.altKey) return;
    if (document.body.classList.contains('player-mode')) return; // player has its own keys
    if (e.key === '/') {
      e.preventDefault();
      const input = document.querySelector('.searchbar input');
      if (input) input.focus(); else location.hash = '#/';
    } else if (e.key === 'e' || e.key === 'E') location.hash = '#/emergency';
    else if (e.key === 't' || e.key === 'T') location.hash = '#/toolkit';
    else if (e.key === 's' || e.key === 'S') location.hash = '#/system';
    else if (e.key === 'd' || e.key === 'D') location.hash = '#/studio';
    else if (/^[1-9]$/.test(e.key) && window.__nfSources) {
      const s = window.__nfSources[parseInt(e.key, 10) - 1];
      if (s) location.hash = '#/read/' + encodeURIComponent(s);
    }
  });

  window.addEventListener('hashchange', route);
  window.addEventListener('load', () => { checkNet(); refreshSystem(); route(); });
  Api.health().then((h) => {
    document.getElementById('foot-status').textContent = 'Needfire v' + h.version + ' · ready';
  }).catch(() => {});
})();
