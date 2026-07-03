/* System hub: the operator's home for managing the box — status, models,
   content, Studio, and build tools. Keeps the mobile tab bar at four items
   while giving the new features a discoverable home. */
const System = (function () {
  const el = C.el, icon = C.icon;

  const TILES = [
    { href: '#/status', name: 'STATUS', sub: 'power · storage · corpus', icon: 'pulse' },
    { href: '#/models', name: 'AI MODELS', sub: 'install & choose models', icon: 'brain' },
    { href: '#/content', name: 'CONTENT', sub: 'download more knowledge', icon: 'download' },
    { href: '#/studio', name: 'STUDIO', sub: 'code · files · terminal', icon: 'code' },
  ];

  async function home() {
    const wrap = el('div', {}, [
      C.sectionHead('System'),
      el('p', { class: 'muted-note' }, ['Manage this computer: check its health, install AI models, download more of the library, or open the Studio workspace.']),
      el('div', { class: 'grid tools' }, TILES.map((t) =>
        el('a', { class: 'tool-card', href: t.href }, [
          icon(t.icon), el('span', { class: 'tool-name' }, [t.name]), el('span', { class: 'tool-sub' }, [t.sub]),
        ]))),
      C.sectionHead('Build a dedicated appliance'),
      el('div', { class: 'panel-note' }, [
        el('p', {}, ['Turn a spare computer or Raspberry Pi into an always-on Needfire box (“the Bothy”). From any computer with ', el('strong', {}, ['Docker Desktop']), ':']),
        el('pre', {}, [el('code', {}, ['python scripts/build-image.py pi     # Raspberry Pi\npython scripts/build-image.py x86    # PC / mini-PC'])]),
        el('p', { class: 'muted-note' }, ['See QUICKSTART.md and 06-BUILD-RUNBOOK.md for the full walkthrough, including flashing the image and the Wi-Fi access point.']),
      ]),
    ]);
    // a quick live status strip echo
    try {
      const s = await Api.system();
      const bits = [];
      if (s.corpus) bits.push(s.corpus.documents + ' documents');
      if (s.models) bits.push(s.models.available ? 'AI online' : 'no AI model');
      if (s.disk) bits.push(s.disk.free_gb + ' GB free');
      if (bits.length) wrap.querySelector('.muted-note').textContent += '  (' + bits.join(' · ') + ')';
    } catch (e) { /* fine */ }
    return wrap;
  }

  return { home };
})();
