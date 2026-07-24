/* Toolkit: offline field tools. Pure client-side math and timing — every tool
   works with the server unreachable (the shell + this file are SW-cached).
   Formulas mirror the corpus documents they cite. */
const Tools = (function () {
  const el = C.el, icon = C.icon;

  const TOOLS = [
    { id: 'assess', name: 'CASUALTY CHECK', sub: 'DR-ABC · AVPU · recovery', icon: 'pulse', cat: 'Medical' },
    { id: 'metronome', name: 'CPR METRONOME', sub: '110 BPM guide', icon: 'metronome', cat: 'Medical' },
    { id: 'ors', name: 'ORS MIXER', sub: 'rehydration recipe', icon: 'medical', cat: 'Medical' },
    { id: 'disinfect', name: 'DISINFECTANT MIX', sub: 'bleach dilution ratios', icon: 'flask', cat: 'Medical' },
    { id: 'sun', name: 'SUN & MOON', sub: 'true bearing · rise/set · phase', icon: 'sun', cat: 'Navigation & sky' },
    { id: 'starfinder', name: 'STAR CHART', sub: 'tonight’s sky, any location', icon: 'moon', cat: 'Navigation & sky' },
    { id: 'latitude', name: 'FIND POSITION', sub: 'latitude + longitude from sky', icon: 'compass', cat: 'Navigation & sky' },
    { id: 'deadreckon', name: 'DEAD RECKON LOG', sub: 'track legs · bearing home', icon: 'pin', cat: 'Navigation & sky' },
    { id: 'grid', name: 'GRID CONVERTER', sub: 'lat/lon ↔ UTM', icon: 'grid', cat: 'Navigation & sky' },
    { id: 'pace', name: 'PACE & TRAVEL', sub: 'distance + walk time', icon: 'compass', cat: 'Navigation & sky' },
    { id: 'declination', name: 'DECLINATION', sub: 'true ↔ magnetic bearing', icon: 'compass', cat: 'Navigation & sky' },
    { id: 'weather', name: 'WIND & WEATHER', sub: 'Beaufort + storm signs', icon: 'wave', cat: 'Navigation & sky' },
    { id: 'exposure', name: 'FEELS-LIKE TEMP', sub: 'wind chill · heat index', icon: 'snow', cat: 'Navigation & sky' },
    { id: 'lightning', name: 'LIGHTNING RANGE', sub: 'flash-to-bang distance', icon: 'spark', cat: 'Navigation & sky' },
    { id: 'water', name: 'WATER DISINFECT', sub: 'bleach drops per litre', icon: 'water', cat: 'Water & rations' },
    { id: 'rations', name: 'RATION PLANNER', sub: 'water + food days', icon: 'food', cat: 'Water & rations' },
    { id: 'solar', name: 'SOLAR SIZER', sub: 'panel + battery math', icon: 'energy', cat: 'Power & electrical' },
    { id: 'battery', name: 'BATTERY BANK', sub: 'capacity · runtime', icon: 'energy', cat: 'Power & electrical' },
    { id: 'ohm', name: 'OHM / WIRE', sub: "ohm's law + gauge", icon: 'chip', cat: 'Power & electrical' },
    { id: 'timers', name: 'FIELD TIMERS', sub: 'boil · burn-cool · custom', icon: 'timer', cat: 'Timers & signals' },
    { id: 'sos', name: 'SOS STROBE', sub: 'screen morse beacon', icon: 'strobe', cat: 'Timers & signals' },
    { id: 'signals', name: 'SIGNAL CARD', sub: 'morse + ground-to-air', icon: 'compass', cat: 'Timers & signals' },
    { id: 'estimate', name: 'FIELD ESTIMATOR', sub: 'distance · height · daylight', icon: 'grid', cat: 'Field reference' },
    { id: 'units', name: 'UNIT CONVERTER', sub: 'temp · length · mass · volume', icon: 'refresh', cat: 'Field reference' },
    { id: 'haul', name: 'MECHANICAL ADVANTAGE', sub: 'pulley pull + safe load', icon: 'wrench', cat: 'Field reference' },
    { id: 'fallout', name: 'FALLOUT DECAY', sub: '7-10 rule dose projection', icon: 'atom', cat: 'Field reference' },
    { id: 'priorities', name: 'SURVIVAL PRIORITIES', sub: 'rule of threes · STOP', icon: 'book', cat: 'Field reference' },
  ];
  const CATS = ['Medical', 'Navigation & sky', 'Water & rations',
    'Power & electrical', 'Timers & signals', 'Field reference'];

  function home() {
    const root = el('div', {}, [C.sectionHead('Field toolkit — works fully offline')]);
    CATS.forEach((cat) => {
      const group = TOOLS.filter((t) => t.cat === cat);
      if (!group.length) return;
      root.appendChild(el('div', { class: 'tool-group-head' }, [cat]));
      root.appendChild(el('div', { class: 'grid tools' }, group.map((t) =>
        el('a', { class: 'tool-card', href: '#/toolkit/' + t.id }, [
          icon(t.icon),
          el('span', { class: 'tool-name' }, [t.name]),
          el('span', { class: 'tool-sub' }, [t.sub]),
        ]))));
    });
    return root;
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

  // ---- feels-like temperature (per wind-chill-heat-index.md) ----
  //   wind chill (NWS/EC): WC = 13.12 + 0.6215T − 11.37V^0.16 + 0.3965T·V^0.16
  //   heat index: Rothfusz regression (computed in °F, shown in °C)
  function windChill(T, V) {
    if (T > 10 || V <= 4.8) return T; // formula only valid ≤10 °C and >4.8 km/h
    const p = Math.pow(V, 0.16);
    return 13.12 + 0.6215 * T - 11.37 * p + 0.3965 * T * p;
  }
  function heatIndex(Tc, RH) {
    const T = Tc * 9 / 5 + 32;
    if (T < 80) return ((0.5 * (T + 61 + (T - 68) * 1.2 + RH * 0.094)) - 32) * 5 / 9;
    let hi = -42.379 + 2.04901523 * T + 10.14333127 * RH - 0.22475541 * T * RH
      - 6.83783e-3 * T * T - 5.481717e-2 * RH * RH + 1.22874e-3 * T * T * RH
      + 8.5282e-4 * T * RH * RH - 1.99e-6 * T * T * RH * RH;
    if (RH < 13 && T >= 80 && T <= 112) hi -= ((13 - RH) / 4) * Math.sqrt((17 - Math.abs(T - 95)) / 17);
    else if (RH > 85 && T >= 80 && T <= 87) hi += ((RH - 85) / 10) * ((87 - T) / 5);
    return (hi - 32) * 5 / 9;
  }
  function exposure() {
    const temp = numField('Air temperature (°C)', 0, { step: '1' });
    const wind = numField('Wind speed (km/h)', 20, { min: '0', step: '1' });
    const humid = numField('Relative humidity (%)', 60, { min: '0', max: '100', step: '1' });
    const out = el('div', {}, []);
    let mode = 'cold';
    const toggle = el('div', { class: 'seg-toggle' }, [
      el('button', { class: 'on', onclick: (e) => setMode('cold', e.target) }, ['COLD (wind chill)']),
      el('button', { onclick: (e) => setMode('hot', e.target) }, ['HOT (heat index)']),
    ]);
    function setMode(v, btn) {
      mode = v;
      toggle.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b === btn));
      wind.wrap.style.display = v === 'cold' ? '' : 'none';
      humid.wrap.style.display = v === 'hot' ? '' : 'none';
      calc();
    }
    function frostbite(wc) {
      if (wc <= -48) return 'Frostbite on exposed skin in 5 minutes or less. Cover every patch of skin.';
      if (wc <= -40) return 'Frostbite on exposed skin in about 10 minutes.';
      if (wc <= -28) return 'Frostbite on exposed skin in about 30 minutes.';
      return null;
    }
    function heatBand(hi) {
      if (hi >= 54) return ['Extreme danger', 'Heat stroke imminent — stop, shade, cool now.'];
      if (hi >= 41) return ['Danger', 'Heat stroke likely with continued activity.'];
      if (hi >= 32) return ['Extreme caution', 'Heat cramps and exhaustion likely; rest and drink.'];
      if (hi >= 27) return ['Caution', 'Fatigue with exertion; pace yourself and hydrate.'];
      return ['Low', 'Little added heat stress at this humidity.'];
    }
    function calc() {
      const T = parseFloat(temp.input.value);
      out.innerHTML = '';
      if (isNaN(T)) return;
      if (mode === 'cold') {
        const V = Math.max(0, parseFloat(wind.input.value) || 0);
        const wc = windChill(T, V);
        out.appendChild(readout(Math.round(wc) + ' °C', 'feels like (wind chill)',
          V <= 4.8 || T > 10 ? 'Wind chill applies below 10 °C with wind above ~5 km/h.' : 'Plan frostbite and hypothermia risk from this, not the thermometer.'));
        const fb = frostbite(wc);
        if (fb) out.appendChild(el('div', { class: 'tool-warning' }, [icon('alert'), el('div', {}, [fb])]));
      } else {
        const RH = Math.min(100, Math.max(0, parseFloat(humid.input.value) || 0));
        const hi = heatIndex(T, RH);
        const band = heatBand(hi);
        out.appendChild(readout(Math.round(hi) + ' °C', 'feels like (heat index)',
          band[0] + ' — shade value; full sun adds up to ~8 °C.'));
        if (hi >= 32) out.appendChild(el('div', { class: 'tool-warning' }, [icon('alert'), el('div', {}, [band[1]])]));
        else out.appendChild(el('p', { class: 'tool-note' }, [band[1]]));
      }
    }
    [temp, wind, humid].forEach((f) => f.input.addEventListener('input', calc));
    humid.wrap.style.display = 'none';
    calc();
    return panel('Feels-like temperature', 'Wind and humidity, not the thermometer, decide frostbite and heat illness.', [
      temp.wrap, el('div', { class: 'field' }, [el('label', {}, ['Condition']), toggle]),
      wind.wrap, humid.wrap, out, sourceLink('wind-chill-heat-index.md'),
    ]);
  }

  // ---- lightning flash-to-bang (per lightning-storm-safety.md:
  //      sound ≈ 3 s/km, 5 s/mile; 30-30 rule) ----
  function lightning() {
    const secs = numField('Seconds from FLASH to BANG', 9, { min: '0', step: '1' });
    const out = el('div', {}, []);
    function calc() {
      const s = Math.max(0, parseFloat(secs.input.value) || 0);
      const km = s / 3, mi = s / 5;
      out.innerHTML = '';
      out.appendChild(el('div', { class: 'readout-row' }, [
        readout(km.toFixed(1) + ' km', 'distance to strike', 'seconds ÷ 3'),
        readout(mi.toFixed(1) + ' mi', 'distance to strike', 'seconds ÷ 5'),
      ]));
      if (s <= 30) {
        out.appendChild(el('div', { class: 'tool-warning' }, [icon('alert'),
          el('div', {}, ['30-30 rule: 30 s or less (≈10 km) means the storm can strike you now — get to substantial shelter. Lightning jumps well ahead of the rain.'])]));
      } else {
        out.appendChild(el('p', { class: 'tool-note' }, ['Storm still more than ~10 km off, but it can close fast — keep counting. Wait a full 30 minutes after the last thunder before going back out.']));
      }
    }
    secs.input.addEventListener('input', calc);
    calc();
    return panel('Lightning range', 'Count seconds between the flash and the thunder. Light is instant; sound crawls.', [
      secs.wrap, out, sourceLink('lightning-storm-safety.md'),
    ]);
  }

  // ---- ration planner (per rationing-supplies.md: water 3 L/person/day plan,
  //      2 L survival floor; food 2000 kcal/day, 1200 short-term floor) ----
  function rations() {
    const people = numField('People', 4, { min: '1', step: '1' });
    const waterStore = numField('Water stored (litres)', 60, { min: '0', step: '1' });
    const foodStore = numField('Food energy stored (kcal)', 24000, { min: '0', step: '100' });
    const waterRate = numField('Water per person/day (L)', 3, { min: '0.5', step: '0.5' });
    const foodRate = numField('Food per person/day (kcal)', 2000, { min: '500', step: '100' });
    const out = el('div', {}, []);
    function calc() {
      const n = Math.max(1, parseFloat(people.input.value) || 1);
      const wr = Math.max(0.1, parseFloat(waterRate.input.value) || 0.1);
      const fr = Math.max(1, parseFloat(foodRate.input.value) || 1);
      const dw = (parseFloat(waterStore.input.value) || 0) / (n * wr);
      const df = (parseFloat(foodStore.input.value) || 0) / (n * fr);
      out.innerHTML = '';
      out.appendChild(el('div', { class: 'readout-row' }, [
        readout(dw.toFixed(1), 'days of WATER', wr + ' L/person/day'),
        readout(df.toFixed(1), 'days of FOOD', fr + ' kcal/person/day'),
      ]));
      if (wr < 2) out.appendChild(el('div', { class: 'tool-warning' }, [icon('alert'),
        el('div', {}, ['Below the ~2 L/person/day survival floor for drinking water. Do not ration drinking water below need — find and purify more instead.'])]));
      if (fr < 1200) out.appendChild(el('div', { class: 'tool-warning' }, [icon('alert'),
        el('div', {}, ['Below ~1,200 kcal/person/day — sustainable only briefly and not while doing heavy work. Keep the ration highest for children and hard workers.'])]));
    }
    [people, waterStore, foodStore, waterRate, foodRate].forEach((f) => f.input.addEventListener('input', calc));
    calc();
    return panel('Ration planner', 'How long stores last, and when a plan drops below what a body needs. Double water needs in heat, altitude, hard work, or for the sick and pregnant.', [
      people.wrap,
      el('div', { class: 'field-row' }, [waterStore.wrap, foodStore.wrap]),
      el('div', { class: 'field-row' }, [waterRate.wrap, foodRate.wrap]),
      out, sourceLink('rationing-supplies.md'),
    ]);
  }

  // ---- pace count + travel time (per compass-navigation.md: ~60–70 paces/100 m;
  //      Naismith 1 h per 5 km + 1 h per 600 m climb) ----
  function pace() {
    const knownM = numField('Known distance walked (m)', 100, { min: '10', step: '10' });
    const knownPaces = numField('Paces you counted', 65, { min: '1', step: '1' });
    const perHundred = el('div', {}, []);
    const tallied = numField('Paces tallied on the move', 130, { min: '0', step: '1' });
    const estOut = el('div', {}, []);
    const distKm = numField('Route distance (km)', 5, { min: '0', step: '0.5' });
    const climbM = numField('Total climb (m)', 0, { min: '0', step: '50' });
    const timeOut = el('div', {}, []);
    let p100 = 65;
    function calibrate() {
      const m = Math.max(1, parseFloat(knownM.input.value) || 1);
      const pc = Math.max(0, parseFloat(knownPaces.input.value) || 0);
      p100 = pc > 0 ? pc / m * 100 : 0;
      perHundred.innerHTML = '';
      perHundred.appendChild(readout(p100 ? p100.toFixed(0) : '—', 'your paces per 100 m',
        'one pace = two steps (same foot twice). More uphill or over rough ground.'));
      estimate();
    }
    function estimate() {
      const t = Math.max(0, parseFloat(tallied.input.value) || 0);
      const m = p100 > 0 ? t / p100 * 100 : 0;
      estOut.innerHTML = '';
      estOut.appendChild(readout(m >= 1000 ? (m / 1000).toFixed(2) + ' km' : Math.round(m) + ' m',
        'estimated distance covered', 'from your calibrated pace count'));
    }
    function travel() {
      const km = Math.max(0, parseFloat(distKm.input.value) || 0);
      const climb = Math.max(0, parseFloat(climbM.input.value) || 0);
      const hours = km / 5 + climb / 600;
      const h = Math.floor(hours), min = Math.round((hours - h) * 60);
      timeOut.innerHTML = '';
      timeOut.appendChild(readout((h ? h + ' h ' : '') + min + ' min', 'estimated walking time',
        "Naismith: 1 h per 5 km + 1 h per 600 m climb. A floor — add for loads, snow, dark, fatigue."));
    }
    [knownM, knownPaces].forEach((f) => f.input.addEventListener('input', calibrate));
    tallied.input.addEventListener('input', estimate);
    [distKm, climbM].forEach((f) => f.input.addEventListener('input', travel));
    calibrate(); travel();
    return panel('Pace & travel time', 'Calibrate your stride once, then count paces to gauge distance — and estimate how long a route will take.', [
      C.sectionHead('Calibrate your pace'),
      el('div', { class: 'field-row' }, [knownM.wrap, knownPaces.wrap]), perHundred,
      C.sectionHead('Estimate distance walked'),
      tallied.wrap, estOut,
      C.sectionHead('Estimate travel time'),
      el('div', { class: 'field-row' }, [distKm.wrap, climbM.wrap]), timeOut,
      sourceLink('compass-navigation.md'),
    ]);
  }

  // ---- magnetic declination converter (per compass-navigation.md) ----
  function declination() {
    const bearing = numField('Bearing (°)', 90, { min: '0', max: '360', step: '1' });
    const decl = numField('Local declination (° — East +, West −)', 0, { step: '0.5' });
    const out = el('div', {}, []);
    let dir = 'field2map'; // compass reading → map bearing
    const toggle = el('div', { class: 'seg-toggle' }, [
      el('button', { class: 'on', onclick: (e) => setDir('field2map', e.target) }, ['COMPASS → MAP']),
      el('button', { onclick: (e) => setDir('map2field', e.target) }, ['MAP → COMPASS']),
    ]);
    function setDir(v, btn) {
      dir = v;
      toggle.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b === btn));
      calc();
    }
    const norm = (x) => ((x % 360) + 360) % 360;
    function calc() {
      const b = parseFloat(bearing.input.value) || 0;
      const d = parseFloat(decl.input.value) || 0;
      // East declination positive: true = magnetic + declination
      const result = dir === 'field2map' ? norm(b + d) : norm(b - d);
      out.innerHTML = '';
      out.appendChild(readout(result.toFixed(1) + '°',
        dir === 'field2map' ? 'TRUE (map) bearing' : 'MAGNETIC (compass) bearing',
        dir === 'field2map' ? 'true = magnetic + east declination' : 'magnetic = true − east declination'));
      out.appendChild(el('p', { class: 'tool-note' },
        ['Declination varies by place and drifts over years — read it from your map legend or a current chart. West declination is a negative number here.']));
    }
    [bearing, decl].forEach((f) => f.input.addEventListener('input', calc));
    calc();
    return panel('Declination converter', 'Convert between the compass needle (magnetic north) and the map grid (true north).', [
      bearing.wrap, decl.wrap,
      el('div', { class: 'field' }, [el('label', {}, ['Direction of conversion']), toggle]),
      out, sourceLink('compass-navigation.md'),
    ]);
  }

  // ---- casualty assessment card (per casualty-assessment.md) ----
  function assess() {
    function step(letter, title, body) {
      return el('div', { class: 'assess-step' }, [
        el('div', { class: 'assess-letter' }, [letter]),
        el('div', {}, [el('strong', {}, [title]), el('div', { class: 'tool-note', style: 'margin:.15rem 0 0' }, [body])]),
      ]);
    }
    const drabc = el('div', { class: 'assess-list' }, [
      step('D', 'Danger', 'Check the scene first — traffic, fire, live wires, water. Do not become a second casualty.'),
      step('R', 'Response', 'Shout and squeeze the shoulders. Grade with AVPU below.'),
      step('A', 'Airway', 'If unresponsive, tilt the head back, lift the chin, clear the mouth.'),
      step('B', 'Breathing', 'Look/listen/feel up to 10 s. Gasps are NOT normal. Not breathing normally → start CPR now.'),
      step('C', 'Circulation', 'Stop severe bleeding with firm direct pressure; watch for shock.'),
    ]);
    const avpu = el('table', { class: 'ref-table' }, [
      el('tr', {}, [el('th', {}, ['AVPU']), el('th', {}, ['Meaning'])]),
      el('tr', {}, [el('td', { class: 'mono' }, ['A']), el('td', {}, ['Alert — eyes open, talking'])]),
      el('tr', {}, [el('td', { class: 'mono' }, ['V']), el('td', {}, ['responds to Voice only'])]),
      el('tr', {}, [el('td', { class: 'mono' }, ['P']), el('td', {}, ['responds to Pain only'])]),
      el('tr', {}, [el('td', { class: 'mono' }, ['U']), el('td', {}, ['Unresponsive'])]),
    ]);
    const recovery = el('ol', { class: 'assess-ol' }, [
      'Kneel beside them; straighten the legs.',
      'Near arm out at a right angle, elbow bent, palm up.',
      'Far arm across the chest, back of hand against their near cheek.',
      'Bend the far knee up; use it to roll them toward you onto their side.',
      'Tilt the head back so the airway stays open and fluid drains. Keep checking breathing.',
    ].map((t) => el('li', {}, [t])));
    return panel('Casualty check', 'The first minute for any collapsed or injured person. Work top to bottom; do not skip a step.', [
      C.sectionHead('DR-ABC — primary survey'), drabc,
      el('a', { class: 'big-btn danger', href: '#/emergency/cpr', style: 'margin-top:.5rem' }, ['NOT BREATHING → CPR']),
      C.sectionHead('AVPU — level of response'), avpu,
      C.sectionHead('Recovery position'),
      el('p', { class: 'tool-note' }, ['For an unresponsive person who IS breathing normally:']),
      recovery,
      sourceLink('casualty-assessment.md'),
    ]);
  }

  // ---- field estimator (per measuring-without-instruments.md) ----
  function estimate() {
    // body ruler
    const units = [['Thumb', 2], ['Palm', 9], ['Span', 20], ['Cubit', 45]];
    let cm = 20;
    const count = numField('How many', 5, { min: '0', step: '0.5' });
    const rulerOut = el('div', {}, []);
    const rulerToggle = el('div', { class: 'seg-toggle' }, units.map((u, i) =>
      el('button', { class: i === 2 ? 'on' : '', onclick: (e) => setUnit(u[1], e.target) }, [u[0] + ' ' + u[1] + 'cm'])));
    function setUnit(v, btn) {
      cm = v;
      rulerToggle.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b === btn));
      ruler();
    }
    function ruler() {
      const n = Math.max(0, parseFloat(count.input.value) || 0);
      const totalCm = n * cm;
      rulerOut.innerHTML = '';
      rulerOut.appendChild(readout(totalCm >= 100 ? (totalCm / 100).toFixed(2) + ' m' : Math.round(totalCm) + ' cm',
        'estimated length', 'calibrate the body unit against a known length for your hands'));
    }
    // height by shadow
    const myH = numField('Your height (m)', 1.7, { min: '0.1', step: '0.05' });
    const myS = numField('Your shadow (any unit)', 2, { min: '0.1', step: '0.1' });
    const objS = numField('Object shadow (same unit)', 12, { min: '0.1', step: '0.1' });
    const shadowOut = el('div', {}, []);
    function shadow() {
      const h = parseFloat(myH.input.value) || 0;
      const s = parseFloat(myS.input.value) || 0;
      const o = parseFloat(objS.input.value) || 0;
      shadowOut.innerHTML = '';
      const height = s > 0 ? h * o / s : 0;
      shadowOut.appendChild(readout(height ? height.toFixed(1) + ' m' : '—', 'estimated object height',
        'height = your height × object shadow ÷ your shadow'));
    }
    // daylight remaining
    const fingers = numField('Finger widths (sun to horizon)', 4, { min: '0', step: '1' });
    const dayOut = el('div', {}, []);
    function daylight() {
      const f = Math.max(0, parseFloat(fingers.input.value) || 0);
      const mins = f * 15;
      const h = Math.floor(mins / 60), m = mins % 60;
      dayOut.innerHTML = '';
      dayOut.appendChild(readout((h ? h + ' h ' : '') + m + ' min', 'daylight remaining',
        'each finger at arm’s length ≈ 15 min; four fingers ≈ 1 hour'));
    }
    count.input.addEventListener('input', ruler);
    [myH, myS, objS].forEach((f) => f.input.addEventListener('input', shadow));
    fingers.input.addEventListener('input', daylight);
    ruler(); shadow(); daylight();
    return panel('Field estimator', 'Measure with your body, the sun, and arithmetic when you have no instruments.', [
      C.sectionHead('Body ruler'),
      el('div', { class: 'field' }, [el('label', {}, ['Body unit']), rulerToggle]),
      count.wrap, rulerOut,
      C.sectionHead('Height by shadow'),
      myH.wrap, el('div', { class: 'field-row' }, [myS.wrap, objS.wrap]), shadowOut,
      C.sectionHead('Daylight remaining'),
      fingers.wrap, dayOut,
      sourceLink('measuring-without-instruments.md'),
    ]);
  }

  // ---- unit converter (per measuring-without-instruments.md) ----
  function units_tool() {
    const CATS = {
      Temp: { a: '°C', b: '°F', toB: (x) => x * 9 / 5 + 32, toA: (x) => (x - 32) * 5 / 9 },
      Distance: { a: 'kilometres', b: 'miles', toB: (x) => x * 0.621371, toA: (x) => x / 0.621371 },
      Weight: { a: 'kilograms', b: 'pounds', toB: (x) => x * 2.20462, toA: (x) => x / 2.20462 },
      Volume: { a: 'litres', b: 'US gallons', toB: (x) => x * 0.264172, toA: (x) => x / 0.264172 },
    };
    let cat = 'Temp';
    const labelA = el('label', {}, []);
    const labelB = el('label', {}, []);
    const inA = el('input', { type: 'number', inputmode: 'decimal', step: 'any' });
    const inB = el('input', { type: 'number', inputmode: 'decimal', step: 'any' });
    let lock = false;
    const round = (x) => Math.round(x * 1000) / 1000;
    function fromA() {
      if (lock) return; lock = true;
      const v = parseFloat(inA.value);
      inB.value = isNaN(v) ? '' : String(round(CATS[cat].toB(v)));
      lock = false;
    }
    function fromB() {
      if (lock) return; lock = true;
      const v = parseFloat(inB.value);
      inA.value = isNaN(v) ? '' : String(round(CATS[cat].toA(v)));
      lock = false;
    }
    function setCat(name, btn) {
      cat = name;
      toggle.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b === btn));
      labelA.textContent = CATS[cat].a;
      labelB.textContent = CATS[cat].b;
      fromA();
    }
    const toggle = el('div', { class: 'seg-toggle' }, Object.keys(CATS).map((name, i) =>
      el('button', { class: i === 0 ? 'on' : '', onclick: (e) => setCat(name, e.target) }, [name])));
    inA.addEventListener('input', fromA);
    inB.addEventListener('input', fromB);
    labelA.textContent = CATS[cat].a; labelB.textContent = CATS[cat].b;
    inA.value = '1'; fromA();
    return panel('Unit converter', 'Two-way field conversions. Type in either box.', [
      el('div', { class: 'field' }, [el('label', {}, ['Quantity']), toggle]),
      el('div', { class: 'field-row' }, [
        el('div', { class: 'field' }, [labelA, inA]),
        el('div', { class: 'field' }, [labelB, inB]),
      ]),
      sourceLink('measuring-without-instruments.md'),
    ]);
  }

  // ---- disinfectant dilution (per making-disinfectants.md: surfaces 1:100,
  //      spills/high-risk 1:10 of 5–6% bleach) ----
  function disinfect() {
    const litres = numField('Water to mix (litres)', 1, { min: '0.25', step: '0.25' });
    let ratio = 100;
    const out = el('div', {}, []);
    const toggle = el('div', { class: 'seg-toggle' }, [
      el('button', { class: 'on', onclick: (e) => setRatio(100, e.target) }, ['SURFACES 1:100']),
      el('button', { onclick: (e) => setRatio(10, e.target) }, ['SPILLS / BLOOD 1:10']),
    ]);
    function setRatio(v, btn) {
      ratio = v;
      toggle.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b === btn));
      calc();
    }
    function calc() {
      const L = Math.max(0, parseFloat(litres.input.value) || 0);
      const ml = L * 1000 / ratio; // mL of 5–6% bleach
      const tsp = ml / 5, tbsp = ml / 15;
      out.innerHTML = '';
      out.appendChild(readout(ml >= 15 ? ml.toFixed(0) + ' mL' : ml.toFixed(1) + ' mL',
        'plain 5–6% bleach to add',
        '≈ ' + tbsp.toFixed(1) + ' tbsp (' + tsp.toFixed(1) + ' tsp). Contact time: leave wet 1–2 min (surfaces) or several minutes (spills), then air dry.'));
      out.appendChild(el('div', { class: 'tool-warning' }, [icon('alert'),
        el('div', {}, ['Mix fresh (loses strength in ~a day). Clean visible dirt off first. Never mix bleach with ammonia or acids. Ventilate. This is for surfaces — for drinking water use the Water Disinfect tool.'])]));
    }
    litres.input.addEventListener('input', calc);
    calc();
    return panel('Disinfectant mix', 'Dilutions of plain unscented household bleach (sodium hypochlorite 5–6%).', [
      el('div', { class: 'field' }, [el('label', {}, ['Use']), toggle]),
      litres.wrap, out, sourceLink('making-disinfectants.md'),
    ]);
  }

  // ---- battery bank (per batteries-and-charging.md: Wh = Ah×V;
  //      usable × depth-of-discharge; runtime = usable Wh ÷ load) ----
  function battery() {
    const ah = numField('Capacity (amp-hours, Ah)', 100, { min: '1', step: '1' });
    const volts = numField('Battery voltage (V)', 12, { min: '1', step: '1' });
    const load = numField('Load (watts)', 40, { min: '0', step: '1' });
    let dod = 0.8;
    const out = el('div', {}, []);
    const toggle = el('div', { class: 'seg-toggle' }, [
      el('button', { class: 'on', onclick: (e) => setDod(0.8, e.target) }, ['LiFePO₄ 80%']),
      el('button', { onclick: (e) => setDod(0.5, e.target) }, ['LEAD-ACID 50%']),
    ]);
    function setDod(v, btn) {
      dod = v;
      toggle.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b === btn));
      calc();
    }
    function calc() {
      const A = parseFloat(ah.input.value) || 0;
      const V = parseFloat(volts.input.value) || 0;
      const W = parseFloat(load.input.value) || 0;
      const totalWh = A * V;
      const usable = totalWh * dod;
      const hours = W > 0 ? usable / W : 0;
      const h = Math.floor(hours), m = Math.round((hours - h) * 60);
      out.innerHTML = '';
      out.appendChild(el('div', { class: 'readout-row' }, [
        readout(Math.round(usable) + ' Wh', 'usable energy', Math.round(totalWh) + ' Wh × ' + Math.round(dod * 100) + '% depth'),
        readout(W > 0 ? (h ? h + ' h ' : '') + m + ' min' : '—', 'runtime at load', 'usable Wh ÷ watts'),
      ]));
      out.appendChild(el('p', { class: 'tool-note' }, ['Series adds volts (Ah unchanged); parallel adds Ah (volts unchanged). Real runtime is lower — inverter and wiring lose ~10–20%. Fuse every battery positive.']));
    }
    [ah, volts, load].forEach((f) => f.input.addEventListener('input', calc));
    calc();
    return panel('Battery bank', 'Usable energy and runtime. Depth-of-discharge protects battery life — don’t plan on 100%.', [
      el('div', { class: 'field-row' }, [ah.wrap, volts.wrap]),
      el('div', { class: 'field' }, [el('label', {}, ['Chemistry / usable depth']), toggle]),
      load.wrap, out, sourceLink('batteries-and-charging.md'),
    ]);
  }

  // ---- mechanical advantage (per mechanical-advantage.md: MA = supporting rope
  //      parts; ~10% friction loss per pulley; SWL = breaking ÷ safety factor) ----
  function haul() {
    const parts = numField('Rope parts supporting the load', 4, { min: '1', step: '1' });
    const loadKg = numField('Load (kg)', 100, { min: '0', step: '5' });
    const breakKg = numField('Rope/hardware breaking strength (kg)', 1000, { min: '0', step: '50' });
    const out = el('div', {}, []);
    let sf = 10;
    const toggle = el('div', { class: 'seg-toggle' }, [
      el('button', { class: 'on', onclick: (e) => setSf(10, e.target) }, ['LIFE-LOADED 10:1']),
      el('button', { onclick: (e) => setSf(5, e.target) }, ['GEAR ONLY 5:1']),
    ]);
    function setSf(v, btn) {
      sf = v;
      toggle.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b === btn));
      calc();
    }
    function calc() {
      const n = Math.max(1, parseFloat(parts.input.value) || 1);
      const L = Math.max(0, parseFloat(loadKg.input.value) || 0);
      const brk = Math.max(0, parseFloat(breakKg.input.value) || 0);
      const effMA = n * Math.pow(0.9, n - 1); // ~10% loss per pulley
      const idealEffort = L / n;
      const realEffort = L / effMA;
      const swl = brk / sf;
      out.innerHTML = '';
      out.appendChild(el('div', { class: 'readout-row' }, [
        readout(idealEffort.toFixed(0) + ' kg', 'ideal pull force', n + ':1 (frictionless)'),
        readout(realEffort.toFixed(0) + ' kg', 'realistic pull', '≈' + effMA.toFixed(1) + ':1 with friction'),
      ]));
      out.appendChild(readout(swl.toFixed(0) + ' kg', 'safe working load', 'breaking ' + brk + ' kg ÷ ' + sf + ' safety factor'));
      if (L > swl && swl > 0) {
        out.appendChild(el('div', { class: 'tool-warning' }, [icon('alert'),
          el('div', {}, ['Load exceeds the safe working load for this rope — it can fail, especially under shock. The anchor sees the FULL load (up to ~' + L + ' kg), not your pull. Stay out of the line of a loaded rope.'])]));
      } else {
        out.appendChild(el('p', { class: 'tool-note' }, ['You pull ' + n + '× the distance you move the load. The anchor carries the full load, not your pull — build it for that. Keep clear of the line of pull.']));
      }
    }
    [parts, loadKg, breakKg].forEach((f) => f.input.addEventListener('input', calc));
    calc();
    return panel('Mechanical advantage', 'Block-and-tackle pull force and safe working load. You trade distance for force.', [
      el('div', { class: 'field-row' }, [parts.wrap, loadKg.wrap]),
      breakKg.wrap,
      el('div', { class: 'field' }, [el('label', {}, ['Safety factor']), toggle]),
      out, sourceLink('mechanical-advantage.md'),
    ]);
  }

  // ---- fallout decay (per radiation-detection-dosimetry.md: Way–Wigner t^-1.2;
  //      the 7-10 rule) ----
  function fallout() {
    const since = numField('Hours since detonation (now)', 1, { min: '0.1', step: '0.5' });
    const rate = numField('Dose rate measured now (any unit)', 100, { min: '0', step: '1' });
    const target = numField('Project to hours after detonation', 48, { min: '0.1', step: '1' });
    const out = el('div', {}, []);
    function calc() {
      const t1 = Math.max(0.1, parseFloat(since.input.value) || 0.1);
      const r1 = Math.max(0, parseFloat(rate.input.value) || 0);
      const t2 = Math.max(0.1, parseFloat(target.input.value) || 0.1);
      const R1 = r1 * Math.pow(t1, 1.2);          // reference rate at H+1
      const r2 = R1 * Math.pow(t2, -1.2);         // projected rate at target
      out.innerHTML = '';
      out.appendChild(el('div', { class: 'readout-row' }, [
        readout(r2 < 10 ? r2.toFixed(2) : r2.toFixed(0), 'rate at +' + t2 + ' h', 'same units as measured'),
        readout(R1 < 10 ? R1.toFixed(2) : R1.toFixed(0), 'H+1 reference rate', 'rate one hour after blast'),
      ]));
      out.appendChild(el('p', { class: 'tool-note' },
        ['7-10 rule: for every 7× increase in time, the rate falls ~10×. So H+7 h ≈ 1/10, H+2 days ≈ 1/100, H+2 weeks ≈ 1/1000 of the H+1 rate. Shelter behind mass through the first hours to days; the danger drops fast.']));
      out.appendChild(el('div', { class: 'tool-warning' }, [icon('alert'),
        el('div', {}, ['Planning estimate only (idealised decay). Trust a real instrument and official guidance. Minimise time, maximise distance and shielding; brush off fallout dust and wash on entering shelter.'])]));
    }
    [since, rate, target].forEach((f) => f.input.addEventListener('input', calc));
    calc();
    return panel('Fallout decay', 'Projects how fast fallout radiation drops with time (Way–Wigner / the 7-10 rule).', [
      el('div', { class: 'field-row' }, [since.wrap, rate.wrap]),
      target.wrap, out, sourceLink('radiation-detection-dosimetry.md'),
    ]);
  }

  // ---- wind & weather reference card (per weather-prediction.md) ----
  function weather() {
    const beaufort = [
      ['0 Calm', '< 1', 'Smoke rises vertically'],
      ['1–2 Light', '1–11', 'Leaves rustle; wind felt on face'],
      ['3–4 Moderate', '12–28', 'Flags flap; dust and loose paper lift'],
      ['5–6 Fresh/Strong', '29–49', 'Small trees sway; umbrellas hard to use'],
      ['7–8 Gale', '50–74', 'Whole trees move; twigs break off; walking hard'],
      ['9–10 Storm', '75–102', 'Branches down; slight structural damage'],
      ['11–12 Violent/Hurricane', '103+', 'Widespread damage; devastation'],
    ];
    return panel('Wind & weather', 'Estimate wind by what it does (Beaufort), and read the sky for change.', [
      C.sectionHead('Beaufort wind force'),
      el('table', { class: 'ref-table' }, [
        el('tr', {}, [el('th', {}, ['Force']), el('th', {}, ['km/h']), el('th', {}, ['Signs on land'])]),
      ].concat(beaufort.map((r) => el('tr', {}, [
        el('td', {}, [r[0]]), el('td', { class: 'mono' }, [r[1]]), el('td', {}, [r[2]])])))),
      C.sectionHead('Worsening weather — warning signs'),
      el('ul', { class: 'assess-ol' }, [
        'Pressure falling (fast fall = fast, strong storm).',
        'High wispy cirrus thickening and lowering into a milky sheet; a halo around sun or moon → front and rain within ~12–24 h.',
        'Cloud lowering and greying over; towering cauliflower cumulus by afternoon → thunderstorms.',
        'Wind picking up and shifting/backing; red sky in the morning.',
      ].map((t) => el('li', {}, [t]))),
      C.sectionHead('Improving weather'),
      el('ul', { class: 'assess-ol' }, [
        'Pressure steady or rising; cloud breaking up and flattening.',
        'Clear calm dry night (dew or frost by dawn); red sky at night.',
      ].map((t) => el('li', {}, [t]))),
      sourceLink('weather-prediction.md'),
    ]);
  }

  // ---- survival priorities reference card (per survival-priorities.md) ----
  function priorities() {
    const threes = [
      ['3 minutes', 'without AIR (or in icy water; or with severe bleeding)'],
      ['3 hours', 'without SHELTER in harsh heat or cold'],
      ['3 days', 'without WATER'],
      ['3 weeks', 'without FOOD'],
    ];
    const work = [
      'First aid — treat injuries (see Casualty check).',
      'Shelter & warmth — build before dark.',
      'Fire — warmth, water, cooking, signalling, morale.',
      'Water — find, then purify.',
      'Signalling — three of anything means distress.',
      'Food — last, and rarely urgent short-term.',
    ];
    return panel('Survival priorities', 'Fix the fastest threat first. The order matters more than the exact times.', [
      C.sectionHead('Rule of threes'),
      el('table', { class: 'ref-table' }, [
        el('tr', {}, [el('th', {}, ['Survive ~']), el('th', {}, ['Without'])]),
      ].concat(threes.map((r) => el('tr', {}, [el('td', { class: 'mono' }, [r[0]]), el('td', {}, [r[1]])])))),
      C.sectionHead('STOP — before you move'),
      el('ul', { class: 'assess-ol' }, [
        'Stop — halt; don’t react in panic.',
        'Think — what is the most-immediate threat? What do I have?',
        'Observe — weather, terrain, injuries, resources, daylight.',
        'Plan — decide, act deliberately, re-assess.',
      ].map((t) => el('li', {}, [t]))),
      C.sectionHead('Priorities of work'),
      el('ol', { class: 'assess-ol' }, work.map((t) => el('li', {}, [t]))),
      sourceLink('survival-priorities.md'),
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

  // UI helper bundle handed to the navigation tools (nav.js) so they render
  // exactly like the tools defined in this file.
  const H = { panel, numField, readout, sourceLink };
  const VIEWS = { water, ors, metronome, timers, sos, solar, ohm,
    exposure, lightning, rations, pace, declination,
    assess, estimate, units: units_tool,
    disinfect, battery, haul, fallout, weather, priorities, signals,
    sun: () => NavTools.sun(H), starfinder: () => NavTools.starfinder(H),
    latitude: () => NavTools.latitude(H), deadreckon: () => NavTools.deadreckon(H),
    grid: () => NavTools.grid(H) };
  function view(id) {
    return (VIEWS[id] ? VIEWS[id]() : C.empty('Unknown tool.'));
  }

  return { home, view };
})();
