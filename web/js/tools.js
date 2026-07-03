/* Toolkit: offline field tools. Pure client-side math and timing — every tool
   works with the server unreachable (the shell + this file are SW-cached).
   Formulas mirror the corpus documents they cite. */
const Tools = (function () {
  const el = C.el, icon = C.icon;

  const TOOLS = [
    { id: 'water', name: 'WATER DISINFECT', sub: 'bleach drops per litre', icon: 'water' },
    { id: 'ors', name: 'ORS MIXER', sub: 'rehydration recipe', icon: 'medical' },
    { id: 'metronome', name: 'CPR METRONOME', sub: '110 BPM guide', icon: 'metronome' },
    { id: 'timers', name: 'FIELD TIMERS', sub: 'boil · burn-cool · custom', icon: 'timer' },
    { id: 'sos', name: 'SOS STROBE', sub: 'screen morse beacon', icon: 'strobe' },
    { id: 'solar', name: 'SOLAR SIZER', sub: 'panel + battery math', icon: 'energy' },
    { id: 'ohm', name: 'OHM / WIRE', sub: "ohm's law + gauge", icon: 'chip' },
    { id: 'signals', name: 'SIGNAL CARD', sub: 'morse + ground-to-air', icon: 'compass' },
  ];

  function home() {
    return el('div', {}, [
      C.sectionHead('Field toolkit — works fully offline'),
      el('div', { class: 'grid tools' }, TOOLS.map((t) =>
        el('a', { class: 'tool-card', href: '#/toolkit/' + t.id }, [
          icon(t.icon),
          el('span', { class: 'tool-name' }, [t.name]),
          el('span', { class: 'tool-sub' }, [t.sub]),
        ]))),
    ]);
  }

  function panel(title, note, children) {
    return el('div', { class: 'tool-wrap' }, [
      el('a', { class: 'back-link', href: '#/toolkit' }, [icon('arrowleft'), 'Toolkit']),
      el('div', { class: 'tool-panel' }, [
        el('h1', {}, [title]),
        note ? el('p', { class: 'tool-note' }, [note]) : null,
      ].concat(children)),
    ]);
  }
  function numField(label, value, attrs) {
    const input = el('input', Object.assign({ type: 'number', value: String(value), inputmode: 'decimal' }, attrs || {}));
    const wrap = el('div', { class: 'field' }, [el('label', {}, [label]), input]);
    return { wrap, input };
  }
  function readout(valueText, label, sub) {
    return el('div', { class: 'readout' }, [
      el('div', { class: 'r-value' }, [valueText]),
      el('div', { class: 'r-label' }, [label]),
      sub ? el('div', { class: 'r-sub' }, [sub]) : null,
    ]);
  }
  function sourceLink(docId) {
    return el('p', { style: 'margin-top:1rem;font-size:0.78rem' }, [
      el('a', { href: '#/read/' + docId, style: 'color:var(--accent-hi);font-weight:700;text-decoration:none' },
        ['Source document →']),
    ]);
  }

  // ---- water disinfection (per water-purification.md: 5–6% bleach,
  //      2 drops/L clear, 4 drops/L cloudy, wait 30 min) ----
  function water() {
    const litres = numField('Water amount (litres)', 1, { min: '0.25', step: '0.25' });
    let cloudy = false;
    const out = el('div', {}, []);
    const toggle = el('div', { class: 'seg-toggle' }, [
      el('button', { class: 'on', onclick: (e) => setCloudy(false, e.target) }, ['CLEAR water']),
      el('button', { onclick: (e) => setCloudy(true, e.target) }, ['CLOUDY water']),
    ]);
    function setCloudy(v, btn) {
      cloudy = v;
      toggle.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b === btn));
      calc();
    }
    function calc() {
      const L = Math.max(0, parseFloat(litres.input.value) || 0);
      const drops = Math.ceil(L * (cloudy ? 4 : 2));
      out.innerHTML = '';
      out.appendChild(readout(String(drops), 'drops of plain 5–6% bleach',
        'Stir, then wait 30 minutes. Water should smell faintly of chlorine — if not, repeat and wait again. Cloudy water: filter through cloth first.'));
      out.appendChild(el('div', { class: 'tool-warning' }, [icon('alert'),
        el('div', {}, ['Plain, unscented household bleach only (sodium hypochlorite 5–6%). Never use scented, color-safe, or added-cleaner bleach.'])]));
    }
    litres.input.addEventListener('input', calc);
    calc();
    return panel('Water disinfection', 'Boiling is more reliable when fuel allows: rolling boil 1 minute (3 min above ~2,000 m).', [
      litres.wrap, el('div', { class: 'field' }, [el('label', {}, ['Water clarity']), toggle]), out, sourceLink('water-purification.md'),
    ]);
  }

  // ---- ORS (per oral-rehydration-salts.md: 6 level tsp sugar + 1/2 level tsp
  //      salt per 1 litre clean water) ----
  function ors() {
    const litres = numField('Clean water (litres)', 1, { min: '0.5', step: '0.5' });
    const out = el('div', {}, []);
    function calc() {
      const L = Math.max(0, parseFloat(litres.input.value) || 0);
      const sugar = Math.round(L * 6 * 100) / 100;
      const salt = Math.round(L * 0.5 * 100) / 100;
      out.innerHTML = '';
      const row = el('div', { class: 'readout-row' }, [
        readout(String(sugar), 'level tsp SUGAR'),
        readout(String(salt), 'level tsp SALT'),
      ]);
      out.appendChild(row);
      out.appendChild(el('div', { class: 'tool-warning' }, [icon('alert'),
        el('div', {}, ['Taste it: no saltier than tears. Too salty is dangerous, especially for children — discard and remix. Sip small amounts often.'])]));
    }
    litres.input.addEventListener('input', calc);
    calc();
    return panel('Oral rehydration solution', 'WHO home recipe. Use the cleanest water available (boiled and cooled is best).', [
      litres.wrap, out, sourceLink('oral-rehydration-salts.md'),
    ]);
  }

  // ---- standalone CPR metronome ----
  function metronome() {
    return panel('CPR metronome', 'Compression rate 100–120/min; the counter accents every 30th for 30:2 cycles. Start also unlocks audio for other timers.', [
      Instruments.metronomeWidget({ label: 'Compression tempo', bpm: 110, count: 30 }),
      el('p', { class: 'tool-note', style: 'margin-top:1rem' },
        ['Push hard and fast in the centre of the chest, full recoil between compressions. ',
         'For the full guided flow use the ']),
      el('a', { class: 'big-btn danger', href: '#/emergency/cpr' }, ['CPR PROTOCOL']),
      sourceLink('cpr-adult-child.md'),
    ]);
  }

  // ---- field timers ----
  function timers() {
    return panel('Field timers', 'Presets from the corpus. They keep running while you browse other tabs of this device.', [
      Instruments.countdownWidget({ label: 'Boil water (pathogen kill)', seconds: 60 }),
      Instruments.countdownWidget({ label: 'Boil water — high altitude (>2,000 m)', seconds: 180 }),
      Instruments.countdownWidget({ label: 'Cool a burn (running water)', seconds: 1200 }),
      Instruments.countdownWidget({ label: 'Bleach contact time', seconds: 1800 }),
    ]);
  }

  // ---- SOS strobe ----
  function sos() {
    const stage = el('div', { class: 'strobe-stage' }, []);
    const status = el('div', { class: 'r-value' }, ['··· ––– ···']);
    const btn = el('button', { class: 'big-btn danger' }, ['START SOS STROBE']);
    const strobe = Instruments.MorseStrobe((on) => document.body.classList.toggle('strobe-on', on));
    let confirmed = false;
    btn.addEventListener('click', () => {
      if (strobe.running) {
        strobe.stop(); btn.textContent = 'START SOS STROBE'; btn.classList.add('danger');
        return;
      }
      if (!confirmed) {
        confirmed = true;
        btn.textContent = 'TAP AGAIN TO CONFIRM — kills night vision, drains battery';
        setTimeout(() => { if (!strobe.running) { confirmed = false; btn.textContent = 'START SOS STROBE'; } }, 5000);
        return;
      }
      strobe.start(); btn.textContent = 'STOP';
    });
    stage.appendChild(status);
    stage.appendChild(btn);
    const root = panel('SOS strobe', 'Flashes the whole screen in Morse SOS. Point it at the search direction; screens are visible for kilometres at night. Three of anything means distress.', [
      stage, sourceLink('signaling-for-rescue.md'),
    ]);
    root.addEventListener('view:teardown', () => strobe.stop());
    return root;
  }

  // ---- solar sizing (per solar-power-basics.md: battery Wh = daily Wh × days
  //      ÷ 0.85 usable; panel W = daily Wh ÷ (sun hours × 0.7)) ----
  function solar() {
    const daily = numField('Daily load (watt-hours)', 600, { min: '1' });
    const days = numField('Days of reserve', 2, { min: '1', step: '1' });
    const sun = numField('Peak sun hours (worst season)', 3.5, { min: '0.5', step: '0.5' });
    const out = el('div', {}, []);
    function calc() {
      const d = parseFloat(daily.input.value) || 0;
      const n = parseFloat(days.input.value) || 1;
      const s = Math.max(0.5, parseFloat(sun.input.value) || 3.5);
      const battery = Math.round((d * n) / 0.85);
      const panel_w = Math.round(d / (s * 0.7));
      out.innerHTML = '';
      out.appendChild(el('div', { class: 'readout-row' }, [
        readout(battery + ' Wh', 'LiFePO₄ battery bank', '÷0.85 usable depth'),
        readout(panel_w + ' W', 'solar panel', '×0.7 real-world derate'),
      ]));
    }
    [daily, days, sun].forEach((f) => f.input.addEventListener('input', calc));
    calc();
    return panel('Solar + battery sizing', 'Size for your WORST month of sun, not your best. Fuse every source.', [
      daily.wrap, el('div', { class: 'field-row' }, [days.wrap, sun.wrap]), out, sourceLink('solar-power-basics.md'),
    ]);
  }

  // ---- Ohm's law + wire gauge (per simple-circuits.md / electrical-safety.md) ----
  const GAUGE = [
    ['18 AWG (0.8 mm²)', 7], ['16 AWG (1.3 mm²)', 10], ['14 AWG (2.1 mm²)', 15],
    ['12 AWG (3.3 mm²)', 20], ['10 AWG (5.3 mm²)', 30], ['8 AWG (8.4 mm²)', 40],
    ['6 AWG (13 mm²)', 55],
  ];
  function ohm() {
    const volts = numField('Volts (V)', 12, { min: '0' });
    const watts = numField('Load (watts)', 60, { min: '0' });
    const out = el('div', {}, []);
    function calc() {
      const V = parseFloat(volts.input.value) || 0;
      const P = parseFloat(watts.input.value) || 0;
      const I = V > 0 ? P / V : 0;
      const R = I > 0 ? V / I : 0;
      const g = GAUGE.find((x) => x[1] >= I * 1.25); // 25% headroom
      out.innerHTML = '';
      out.appendChild(el('div', { class: 'readout-row' }, [
        readout(I.toFixed(1) + ' A', 'current draw', 'I = P ÷ V'),
        readout(R ? R.toFixed(1) + ' Ω' : '—', 'load resistance', 'R = V ÷ I'),
      ]));
      out.appendChild(readout(g ? g[0] : 'thicker than 6 AWG — split the circuit',
        'minimum wire gauge (short runs)', 'sized at 125% of load; long runs need thicker wire. Fuse every battery positive.'));
      if (I > 0 && V <= 24) {
        out.appendChild(el('div', { class: 'tool-warning' }, [icon('alert'),
          el('div', {}, ['Low-voltage systems still burn and start fires: undersized wire overheats long before anything trips. Mains and inverter output can kill.'])]));
      }
    }
    [volts, watts].forEach((f) => f.input.addEventListener('input', calc));
    calc();
    return panel("Ohm's law + wire gauge", 'V = I×R, P = V×I. Ampacities are conservative chassis-wiring values.', [
      el('div', { class: 'field-row' }, [volts.wrap, watts.wrap]), out, sourceLink('simple-circuits.md'),
    ]);
  }

  // ---- signal reference card ----
  function signals() {
    const morse = [['S O S', '··· ––– ···'], ['OK / understood', '–·–'], ['Repeat / say again', '··––··']];
    const ground = [['V', 'Need assistance'], ['X', 'Need MEDICAL help'], ['→ (arrow)', 'Traveling this way'], ['Y', 'Yes'], ['N', 'No']];
    return panel('Signal reference', 'Rule of threes: three fires, three blasts, three flashes = distress. Make ground symbols 3+ metres, high-contrast.', [
      el('table', { class: 'ref-table' }, [
        el('tr', {}, [el('th', {}, ['Morse']), el('th', {}, ['Pattern'])]),
      ].concat(morse.map((r) => el('tr', {}, [el('td', {}, [r[0]]), el('td', { class: 'mono' }, [r[1]])])))),
      el('table', { class: 'ref-table', style: 'margin-top:1rem' }, [
        el('tr', {}, [el('th', {}, ['Ground-to-air']), el('th', {}, ['Meaning'])]),
      ].concat(ground.map((r) => el('tr', {}, [el('td', { class: 'mono' }, [r[0]]), el('td', {}, [r[1]])])))),
      el('p', { class: 'tool-note', style: 'margin-top:1rem' },
        ['A signal mirror sweep beats everything in sunlight — aim through a V made with two fingers. Whistles carry farther than voice and cost no energy.']),
      sourceLink('signaling-for-rescue.md'),
    ]);
  }

  const VIEWS = { water, ors, metronome, timers, sos, solar, ohm, signals };
  function view(id) {
    return (VIEWS[id] ? VIEWS[id]() : C.empty('Unknown tool.'));
  }

  return { home, view };
})();
