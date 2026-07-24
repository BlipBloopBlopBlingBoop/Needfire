/* Offline navigation package: celestial + grid math and the nav toolkit views.
   Pure client-side — works with the server unreachable, anywhere on Earth.

   NavAstro is dependency-free math (loadable in node for validation):
   - Solar position: low-precision Meeus/NOAA formulas (~0.01° class).
   - Sidereal time: GMST = 280.46061837 + 360.98564736629·(JD − 2451545).
     Anchor: 2000-01-01 00:00 UT → 99.968° ≈ 6h39m52s.
   - Sun rise/set: transit iteration + hour angle at h = −0.833°.
     Anchor: London (51.5N, 0.1W) Jun 21 → rise ≈ 03:43, set ≈ 20:21 UT.
   - Moon phase: synodic cycle from the 2000-01-06 new moon epoch (approx).
   - UTM: standard WGS-84 transverse-Mercator series (Snyder), k0 = 0.9996.
     Anchors: (0°, zone central meridian) → E 500000, N 0; round-trips < 1e-7°.
   Formulas mirror celestial-navigation.md / reading-topographic-maps.md. */

const NavAstro = (function () {
  const D2R = Math.PI / 180, R2D = 180 / Math.PI;
  const norm = (x) => ((x % 360) + 360) % 360;
  const norm180 = (x) => norm(x + 180) - 180;

  function jd(ms) { return 2440587.5 + ms / 86400000; }
  function gmst(j) { return norm(280.46061837 + 360.98564736629 * (j - 2451545.0)); }

  // Sun geocentric RA/Dec + mean longitude (for the equation of time)
  function sun(j) {
    const n = j - 2451545.0;
    const L = norm(280.460 + 0.9856474 * n);
    const g = norm(357.528 + 0.9856003 * n) * D2R;
    const lam = (L + 1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g)) * D2R;
    const eps = (23.439 - 0.0000004 * n) * D2R;
    const ra = norm(Math.atan2(Math.cos(eps) * Math.sin(lam), Math.cos(lam)) * R2D);
    const dec = Math.asin(Math.sin(eps) * Math.sin(lam)) * R2D;
    return { ra, dec, L };
  }
  // True solar noon vs. clock noon, in minutes (±~16 min through the year)
  function eqOfTime(j) { const s = sun(j); return 4 * norm180(s.L - s.ra); }

  // RA/Dec (deg) -> altitude/azimuth (deg, azimuth from TRUE north, clockwise)
  function altaz(ra, dec, lat, lon, j) {
    const H = (norm(gmst(j) + lon - ra)) * D2R;
    const phi = lat * D2R, d = dec * D2R;
    const alt = Math.asin(Math.sin(phi) * Math.sin(d) + Math.cos(phi) * Math.cos(d) * Math.cos(H));
    const az = Math.atan2(Math.sin(H), Math.cos(H) * Math.sin(phi) - Math.tan(d) * Math.cos(phi));
    return { alt: alt * R2D, az: norm(az * R2D + 180) };
  }

  // Solar transit (local solar noon) nearest to ms, by iteration
  function solarTransit(ms, lon) {
    let t = ms;
    for (let i = 0; i < 3; i++) {
      const j = jd(t), s = sun(j);
      const H = norm180(gmst(j) + lon - s.ra);   // hour angle of the sun, deg
      t -= (H / 360) * 86400000;                  // sun's hour angle moves 360°/day
    }
    return t;
  }

  // Sunrise / solar noon / sunset around the given time. Returns ms or polar flag.
  function sunTimes(ms, lat, lon) {
    const noon = solarTransit(ms, lon);
    const dec = sun(jd(noon)).dec * D2R, phi = lat * D2R;
    const cosH0 = (Math.sin(-0.833 * D2R) - Math.sin(phi) * Math.sin(dec)) /
                  (Math.cos(phi) * Math.cos(dec));
    if (cosH0 > 1) return { noon, polar: 'night' };   // sun never rises
    if (cosH0 < -1) return { noon, polar: 'day' };    // sun never sets
    const H0 = Math.acos(cosH0) * R2D;                // degrees; 15°/hour
    const half = (H0 / 15) * 3600000;
    return { noon, rise: noon - half, set: noon + half, dayLenH: 2 * H0 / 15 };
  }

  // Moon phase (approximate): age in days since new moon, fraction illuminated
  function moonPhase(j) {
    const syn = 29.530588853;
    const age = ((j - 2451550.1) % syn + syn) % syn;
    const illum = (1 - Math.cos(2 * Math.PI * age / syn)) / 2;
    const names = ['New moon', 'Waxing crescent', 'First quarter', 'Waxing gibbous',
                   'Full moon', 'Waning gibbous', 'Last quarter', 'Waning crescent'];
    const name = names[Math.floor(((age + syn / 16) / syn) * 8) % 8];
    return { age, illum, name, waxing: age < syn / 2 };
  }

  // Longitude from the observed UTC time of local solar noon (celestial-navigation.md)
  function lonFromNoon(utcHours, j) {
    return norm180(15 * (12 - eqOfTime(j) / 60 - utcHours));
  }

  // ---- UTM (WGS-84) — Snyder's transverse-Mercator series --------------------
  const A = 6378137, F = 1 / 298.257223563, K0 = 0.9996;
  const E2 = F * (2 - F), EP2 = E2 / (1 - E2);
  const E4 = E2 * E2, E6 = E4 * E2;

  function utmZone(lon) { return Math.min(60, Math.max(1, Math.floor((lon + 180) / 6) + 1)); }

  function llToUtm(lat, lon) {
    const zone = utmZone(lon), lon0 = ((zone - 1) * 6 - 180 + 3) * D2R;
    const phi = lat * D2R, lam = lon * D2R;
    const sp = Math.sin(phi), cp = Math.cos(phi), tp = Math.tan(phi);
    const N = A / Math.sqrt(1 - E2 * sp * sp);
    const T = tp * tp, C = EP2 * cp * cp, Aa = cp * (lam - lon0);
    const M = A * ((1 - E2 / 4 - 3 * E4 / 64 - 5 * E6 / 256) * phi
      - (3 * E2 / 8 + 3 * E4 / 32 + 45 * E6 / 1024) * Math.sin(2 * phi)
      + (15 * E4 / 256 + 45 * E6 / 1024) * Math.sin(4 * phi)
      - (35 * E6 / 3072) * Math.sin(6 * phi));
    const e = K0 * N * (Aa + (1 - T + C) * Aa ** 3 / 6
      + (5 - 18 * T + T * T + 72 * C - 58 * EP2) * Aa ** 5 / 120) + 500000;
    let n = K0 * (M + N * tp * (Aa * Aa / 2 + (5 - T + 9 * C + 4 * C * C) * Aa ** 4 / 24
      + (61 - 58 * T + T * T + 600 * C - 330 * EP2) * Aa ** 6 / 720));
    const south = lat < 0;
    if (south) n += 10000000;
    return { zone, south, e, n };
  }

  function utmToLl(zone, south, e, n) {
    const x = e - 500000, y = south ? n - 10000000 : n;
    const lon0 = ((zone - 1) * 6 - 180 + 3) * D2R;
    const M = y / K0;
    const mu = M / (A * (1 - E2 / 4 - 3 * E4 / 64 - 5 * E6 / 256));
    const e1 = (1 - Math.sqrt(1 - E2)) / (1 + Math.sqrt(1 - E2));
    const phi1 = mu
      + (3 * e1 / 2 - 27 * e1 ** 3 / 32) * Math.sin(2 * mu)
      + (21 * e1 * e1 / 16 - 55 * e1 ** 4 / 32) * Math.sin(4 * mu)
      + (151 * e1 ** 3 / 96) * Math.sin(6 * mu)
      + (1097 * e1 ** 4 / 512) * Math.sin(8 * mu);
    const sp1 = Math.sin(phi1), cp1 = Math.cos(phi1), tp1 = Math.tan(phi1);
    const C1 = EP2 * cp1 * cp1, T1 = tp1 * tp1;
    const N1 = A / Math.sqrt(1 - E2 * sp1 * sp1);
    const R1 = A * (1 - E2) / Math.pow(1 - E2 * sp1 * sp1, 1.5);
    const D = x / (N1 * K0);
    const lat = (phi1 - (N1 * tp1 / R1) * (D * D / 2
      - (5 + 3 * T1 + 10 * C1 - 4 * C1 * C1 - 9 * EP2) * D ** 4 / 24
      + (61 + 90 * T1 + 298 * C1 + 45 * T1 * T1 - 252 * EP2 - 3 * C1 * C1) * D ** 6 / 720)) * R2D;
    const lon = (lon0 + (D - (1 + 2 * T1 + C1) * D ** 3 / 6
      + (5 - 2 * C1 + 28 * T1 - 3 * C1 * C1 + 8 * EP2 + 24 * T1 * T1) * D ** 5 / 120) / cp1) * R2D;
    return { lat, lon };
  }

  return { jd, gmst, sun, eqOfTime, altaz, sunTimes, moonPhase, lonFromNoon,
           llToUtm, utmToLl, norm, norm180 };
})();

/* Bright-star catalog for the field chart: [name, RA hours, Dec deg, magnitude]
   (J2000, ~0.1° — far finer than a fist at arm's length). ~2 KB total. */
const NAV_STARS = [
  ['Polaris', 2.530, 89.264, 1.98],
  ['Sirius', 6.752, -16.716, -1.46], ['Canopus', 6.399, -52.696, -0.74],
  ['Alpha Centauri', 14.660, -60.834, -0.27], ['Arcturus', 14.261, 19.182, -0.05],
  ['Vega', 18.616, 38.784, 0.03], ['Capella', 5.278, 45.998, 0.08],
  ['Rigel', 5.242, -8.202, 0.13], ['Procyon', 7.655, 5.225, 0.34],
  ['Betelgeuse', 5.919, 7.407, 0.42], ['Achernar', 1.629, -57.237, 0.46],
  ['Hadar', 14.064, -60.373, 0.61], ['Altair', 19.846, 8.868, 0.77],
  ['Acrux', 12.443, -63.099, 0.76], ['Aldebaran', 4.599, 16.509, 0.85],
  ['Antares', 16.490, -26.432, 0.96], ['Spica', 13.420, -11.161, 0.97],
  ['Pollux', 7.755, 28.026, 1.14], ['Fomalhaut', 22.961, -29.622, 1.16],
  ['Deneb', 20.690, 45.280, 1.25], ['Mimosa', 12.795, -59.689, 1.25],
  ['Regulus', 10.139, 11.967, 1.35], ['Castor', 7.577, 31.888, 1.58],
  ['Gacrux', 12.519, -57.113, 1.64], ['Shaula', 17.560, -37.104, 1.62],
  ['Bellatrix', 5.419, 6.350, 1.64],
  ['Alnitak', 5.679, -1.943, 1.77], ['Alnilam', 5.604, -1.202, 1.69],
  ['Mintaka', 5.533, -0.299, 2.23],
  ['Dubhe', 11.062, 61.751, 1.79], ['Merak', 11.031, 56.383, 2.37],
  ['Phecda', 11.897, 53.695, 2.44], ['Megrez', 12.257, 57.033, 3.31],
  ['Alioth', 12.900, 55.960, 1.77], ['Mizar', 13.399, 54.925, 2.04],
  ['Alkaid', 13.792, 49.313, 1.86],
  ['Caph', 0.153, 59.150, 2.27], ['Schedar', 0.675, 56.537, 2.24],
  ['Gamma Cas', 0.945, 60.717, 2.47], ['Ruchbah', 1.430, 60.235, 2.68],
  ['Segin', 1.907, 63.670, 3.38],
];
/* Asterism lines used for navigation (by star name). */
const NAV_LINES = [
  // Big Dipper bowl + handle, then the pointers on to Polaris
  ['Merak', 'Dubhe'], ['Dubhe', 'Megrez'], ['Megrez', 'Phecda'], ['Phecda', 'Merak'],
  ['Megrez', 'Alioth'], ['Alioth', 'Mizar'], ['Mizar', 'Alkaid'],
  ['Dubhe', 'Polaris'],
  // Cassiopeia W
  ['Caph', 'Schedar'], ['Schedar', 'Gamma Cas'], ['Gamma Cas', 'Ruchbah'], ['Ruchbah', 'Segin'],
  // Orion: belt + shoulders/feet
  ['Alnitak', 'Alnilam'], ['Alnilam', 'Mintaka'],
  ['Betelgeuse', 'Bellatrix'], ['Betelgeuse', 'Alnitak'], ['Bellatrix', 'Mintaka'],
  ['Rigel', 'Alnitak'],
  // Southern Cross + the Pointers
  ['Acrux', 'Gacrux'], ['Mimosa', 'Gacrux'], ['Mimosa', 'Acrux'],
  ['Alpha Centauri', 'Hadar'],
  // Summer Triangle
  ['Vega', 'Deneb'], ['Deneb', 'Altair'], ['Altair', 'Vega'],
];

/* The toolkit views. tools.js passes its UI helpers in (panel, numField,
   readout, sourceLink) so the look stays identical to every other tool. */
const NavTools = (function () {
  if (typeof C === 'undefined') return {};   // node (math validation) — views need the DOM
  const el = C.el;
  const AS = NavAstro;

  // shared last-known position, so every nav tool remembers it
  function getPos() {
    try { return JSON.parse(localStorage.getItem('nf.navpos')) || { lat: 45, lon: 0 }; }
    catch (e) { return { lat: 45, lon: 0 }; }
  }
  function setPos(lat, lon) {
    try { localStorage.setItem('nf.navpos', JSON.stringify({ lat, lon })); } catch (e) { /* private mode */ }
  }
  function posFields(H, onchange) {
    const p = getPos();
    const lat = H.numField('Latitude (° north +)', p.lat, { min: '-89.9', max: '89.9', step: '0.1' });
    const lon = H.numField('Longitude (° east +)', p.lon, { min: '-180', max: '180', step: '0.1' });
    [lat, lon].forEach((f) => f.input.addEventListener('input', () => {
      const la = parseFloat(lat.input.value), lo = parseFloat(lon.input.value);
      if (!isNaN(la) && !isNaN(lo)) setPos(la, lo);
      onchange();
    }));
    return { row: el('div', { class: 'field-row' }, [lat.wrap, lon.wrap]), lat, lon };
  }
  function whenField(onchange) {
    const input = el('input', { type: 'datetime-local' });
    const setNow = () => {
      const d = new Date(Date.now() - new Date().getTimezoneOffset() * 60000);
      input.value = d.toISOString().slice(0, 16);
      onchange();
    };
    input.addEventListener('input', onchange);
    const wrap = el('div', { class: 'field' }, [el('label', {}, ['Date & time (local)']),
      el('div', { class: 'when-row' }, [input, el('button', { class: 'btn ghost', onclick: setNow }, ['NOW'])])]);
    setNow();
    return { wrap, ms: () => (input.value ? new Date(input.value).getTime() : Date.now()) };
  }
  const hm = (ms) => new Date(ms).toTimeString().slice(0, 5);

  // ---- SUN & MOON (per celestial-navigation.md) ----
  function sunTool(H) {
    const out = el('div', {}, []);
    let pos, when;
    function calc() {
      const lat = parseFloat(pos.lat.input.value), lon = parseFloat(pos.lon.input.value);
      const ms = when.ms();
      out.innerHTML = '';
      if (isNaN(lat) || isNaN(lon)) return;
      const j = AS.jd(ms), s = AS.sun(j), aa = AS.altaz(s.ra, s.dec, lat, lon, j);
      out.appendChild(el('div', { class: 'readout-row' }, [
        H.readout(aa.alt > -0.833 ? aa.az.toFixed(0) + '°' : '—', 'sun TRUE bearing',
          aa.alt > -0.833 ? 'compass bearing to the sun right now (true north)' : 'sun is below the horizon'),
        H.readout(aa.alt.toFixed(1) + '°', 'sun altitude', 'solar declination today: ' + s.dec.toFixed(1) + '°'),
      ]));
      const t = AS.sunTimes(ms, lat, lon);
      if (t.polar) {
        out.appendChild(H.readout(t.polar === 'day' ? 'MIDNIGHT SUN' : 'POLAR NIGHT',
          'sun today', t.polar === 'day' ? 'the sun does not set today' : 'the sun does not rise today'));
      } else {
        const dl = Math.floor(t.dayLenH) + ' h ' + Math.round((t.dayLenH % 1) * 60) + ' min';
        out.appendChild(el('div', { class: 'readout-row' }, [
          H.readout(hm(t.rise), 'sunrise', 'local device time'),
          H.readout(hm(t.set), 'sunset', 'daylight: ' + dl),
        ]));
        out.appendChild(H.readout(hm(t.noon), 'local solar noon',
          'shortest shadow; sun due ' + (lat >= AS.sun(AS.jd(t.noon)).dec ? 'south' : 'north') +
          '. Equation of time today: ' + AS.eqOfTime(j).toFixed(0) + ' min'));
      }
      const m = AS.moonPhase(j);
      out.appendChild(H.readout(m.name, 'moon tonight',
        Math.round(m.illum * 100) + '% lit, ' + (m.waxing ? 'waxing' : 'waning') +
        ' — day ' + m.age.toFixed(0) + ' of 29.5. Full moon = usable travel light.'));
      out.appendChild(el('p', { class: 'tool-note' },
        ['Bearings are TRUE. Point your compass at the sun and compare: the difference is your local magnetic declination (see the Declination tool).']));
    }
    when = whenField(calc);
    pos = posFields(H, calc);
    calc();
    return H.panel('Sun & moon', 'The sun as a compass and clock, from your position and time. No signal needed.', [
      pos.row, when.wrap, out, H.sourceLink('celestial-navigation.md'),
    ]);
  }

  // ---- STAR CHART (per natural-navigation-stars.md) ----
  function starTool(H) {
    const canvas = el('canvas', { class: 'sky-canvas', 'aria-label': 'Star chart for your sky' });
    const note = el('p', { class: 'tool-note' }, []);
    let pos, when;
    function css(name, fallback) {
      const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
      return v || fallback;
    }
    function draw() {
      const lat = parseFloat(pos.lat.input.value), lon = parseFloat(pos.lon.input.value);
      if (isNaN(lat) || isNaN(lon)) return;
      const j = AS.jd(when.ms());
      const dpr = window.devicePixelRatio || 1;
      const w = Math.min(canvas.parentElement ? canvas.parentElement.clientWidth : 420, 480) || 420;
      canvas.style.width = w + 'px'; canvas.style.height = w + 'px';
      canvas.width = w * dpr; canvas.height = w * dpr;
      const ctx = canvas.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const cx = w / 2, cy = w / 2, R = w / 2 - 18;
      const ink = css('--ink', '#dfe6ee'), dim = css('--ink-dim', '#8a94a3'),
            ring = css('--border-2', '#39404d'), hi = css('--accent-hi', '#ffb277');
      ctx.clearRect(0, 0, w, w);
      // horizon + altitude rings
      ctx.strokeStyle = ring; ctx.lineWidth = 1;
      [1, 2 / 3, 1 / 3].forEach((f) => { ctx.beginPath(); ctx.arc(cx, cy, R * f, 0, 7); ctx.stroke(); });
      // cardinal labels: chart is the sky OVERHEAD — with north up, EAST is left
      ctx.fillStyle = hi; ctx.font = '700 13px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('N', cx, cy - R - 6); ctx.fillText('S', cx, cy + R + 14);
      ctx.fillText('E', cx - R - 8, cy + 4); ctx.fillText('W', cx + R + 8, cy + 4);
      const plot = {};
      NAV_STARS.forEach((s) => {
        const aa = AS.altaz(s[1] * 15, s[2], lat, lon, j);
        if (aa.alt <= 0) return;
        const r = (90 - aa.alt) / 90 * R, a = aa.az * Math.PI / 180;
        plot[s[0]] = { x: cx - r * Math.sin(a), y: cy - r * Math.cos(a), mag: s[3] };
      });
      ctx.strokeStyle = dim; ctx.globalAlpha = 0.6; ctx.lineWidth = 1;
      NAV_LINES.forEach((ln) => {
        const a = plot[ln[0]], b = plot[ln[1]];
        if (!a || !b) return;
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      });
      ctx.globalAlpha = 1;
      Object.keys(plot).forEach((name) => {
        const p = plot[name];
        ctx.fillStyle = name === 'Polaris' ? hi : ink;
        const size = Math.max(1.2, (5.2 - p.mag) * 0.85);
        ctx.beginPath(); ctx.arc(p.x, p.y, size, 0, 7); ctx.fill();
        if (p.mag < 1.4 || name === 'Polaris') {
          ctx.fillStyle = dim; ctx.font = '10px sans-serif'; ctx.textAlign = 'left';
          ctx.fillText(name, p.x + 5, p.y + 3);
        }
      });
      const up = Object.keys(plot).length;
      note.textContent = up + ' navigation stars above your horizon. Hold the chart overhead facing north — '
        + 'east sits on the LEFT because you are looking up. Polaris is highlighted; '
        + 'in the south, the Crux long axis ×4.5 points to south.';
    }
    when = whenField(draw);
    pos = posFields(H, draw);
    const root = H.panel('Star chart', 'Tonight’s navigation stars for any place and time — a pocket planisphere.', [
      pos.row, when.wrap, el('div', { class: 'sky-wrap' }, [canvas]), note,
      H.sourceLink('natural-navigation-stars.md'),
    ]);
    requestAnimationFrame(draw);
    return root;
  }

  // ---- FIND POSITION (per celestial-navigation.md) ----
  function latTool(H) {
    const out = el('div', {}, []);
    let mode = 'polaris';
    const alt = H.numField('Measured altitude (°)', 45, { min: '0', max: '90', step: '0.5' });
    const date = el('input', { type: 'date' });
    date.value = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
    const dateWrap = el('div', { class: 'field' }, [el('label', {}, ['Date']), date]);
    let sunSide = 'equator';
    const sideToggle = el('div', { class: 'seg-toggle' }, [
      el('button', { class: 'on', onclick: (e) => { sunSide = 'equator'; flip(sideToggle, e.target); } }, ['SUN TOWARD EQUATOR']),
      el('button', { onclick: (e) => { sunSide = 'pole'; flip(sideToggle, e.target); } }, ['SUN ON POLE SIDE']),
    ]);
    const sideWrap = el('div', { class: 'field' }, [el('label', {}, ['Where was the sun?']), sideToggle]);
    const utc = el('input', { type: 'time', value: '12:00' });
    const utcWrap = el('div', { class: 'field' }, [el('label', {}, ['UTC time of YOUR local solar noon']), utc]);
    function flip(t, btn) { t.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b === btn)); calc(); }
    function noonJd() { return AS.jd(new Date(date.value + 'T12:00:00Z').getTime()); }
    function calc() {
      const a = parseFloat(alt.input.value) || 0;
      out.innerHTML = '';
      alt.wrap.style.display = mode === 'longitude' ? 'none' : '';
      dateWrap.style.display = mode === 'polaris' ? 'none' : '';
      sideWrap.style.display = mode === 'noonsun' ? '' : 'none';
      utcWrap.style.display = mode === 'longitude' ? '' : 'none';
      if (mode === 'polaris') {
        out.appendChild(H.readout(a.toFixed(1) + '° N', 'your latitude',
          'latitude ≈ Polaris altitude (±1° — Polaris sits 0.7° off the true pole). Northern Hemisphere only.'));
      } else if (mode === 'noonsun') {
        const dec = AS.sun(noonJd()).dec;
        const lat = sunSide === 'equator' ? 90 - a + dec : dec - (90 - a);
        out.appendChild(H.readout(Math.abs(lat).toFixed(1) + '° ' + (lat >= 0 ? 'N' : 'S'), 'your latitude',
          'solar declination today: ' + dec.toFixed(1) + '°. Measure by shadow-stick — never look at the sun.'));
      } else {
        const parts = (utc.value || '12:00').split(':');
        const hours = (+parts[0] || 0) + (+parts[1] || 0) / 60;
        const lonv = AS.lonFromNoon(hours, noonJd());
        out.appendChild(H.readout(Math.abs(lonv).toFixed(1) + '° ' + (lonv >= 0 ? 'E' : 'W'), 'your longitude',
          'from the 15°-per-hour rule with today’s equation-of-time correction. Needs a watch on known UTC/home time.'));
      }
    }
    const modeToggle = el('div', { class: 'seg-toggle' }, [
      el('button', { class: 'on', onclick: (e) => { mode = 'polaris'; flip(modeToggle, e.target); } }, ['POLARIS']),
      el('button', { onclick: (e) => { mode = 'noonsun'; flip(modeToggle, e.target); } }, ['NOON SUN']),
      el('button', { onclick: (e) => { mode = 'longitude'; flip(modeToggle, e.target); } }, ['LONGITUDE']),
    ]);
    [alt].forEach((f) => f.input.addEventListener('input', calc));
    date.addEventListener('input', calc); utc.addEventListener('input', calc);
    calc();
    return H.panel('Find position', 'Latitude from Polaris or the noon sun; longitude from noon time. A fix without GPS.', [
      el('div', { class: 'field' }, [el('label', {}, ['Method']), modeToggle]),
      alt.wrap, dateWrap, sideWrap, utcWrap, out,
      el('p', { class: 'tool-note' }, ['Measure angles with a weighted-string quadrant, or calibrate your fist (~10°) and fingers (~2°) against the 90° horizon-to-zenith span.']),
      H.sourceLink('celestial-navigation.md'),
    ]);
  }

  // ---- DEAD-RECKONING LOG (per route-planning-dead-reckoning.md) ----
  function drTool(H) {
    const bearing = H.numField('Bearing walked (° true)', 0, { min: '0', max: '360', step: '1' });
    const dist = H.numField('Distance (m)', 500, { min: '0', step: '10' });
    const list = el('div', { class: 'dr-list' }, []);
    const out = el('div', {}, []);
    function legs() {
      try { return JSON.parse(localStorage.getItem('nf.drlog')) || []; } catch (e) { return []; }
    }
    function save(l) { try { localStorage.setItem('nf.drlog', JSON.stringify(l)); } catch (e) { /* private mode */ } }
    function render() {
      const l = legs();
      list.innerHTML = ''; out.innerHTML = '';
      l.forEach((leg, i) => list.appendChild(el('div', { class: 'dr-leg' }, [
        el('span', { class: 'mono' }, [(i + 1) + '.']),
        el('span', {}, [leg.b + '° for ' + leg.d + ' m']),
      ])));
      let x = 0, y = 0;
      l.forEach((leg) => { const r = leg.b * Math.PI / 180; x += leg.d * Math.sin(r); y += leg.d * Math.cos(r); });
      const d = Math.hypot(x, y);
      const brg = AS.norm(Math.atan2(x, y) * 180 / Math.PI);
      const home = AS.norm(brg + 180);
      out.appendChild(el('div', { class: 'readout-row' }, [
        H.readout(d >= 1000 ? (d / 1000).toFixed(2) + ' km' : Math.round(d) + ' m', 'from your start point',
          l.length + ' leg' + (l.length === 1 ? '' : 's') + ' logged' + (l.length ? '' : ' — add your first below')),
        H.readout(l.length ? home.toFixed(0) + '°' : '—', 'TRUE bearing back to start',
          l.length ? 'you are on bearing ' + brg.toFixed(0) + '° from the start' : ''),
      ]));
      out.appendChild(el('p', { class: 'tool-note' },
        ['Offsets: ' + Math.round(y) + ' m north, ' + Math.round(x) + ' m east of the start. Log every leg — including detours. Bearings here are TRUE: convert compass bearings with the Declination tool first.']));
    }
    const add = el('button', { class: 'big-btn primary' }, ['ADD LEG']);
    add.addEventListener('click', () => {
      const b = AS.norm(parseFloat(bearing.input.value) || 0);
      const d = Math.max(0, parseFloat(dist.input.value) || 0);
      if (!d) return;
      save(legs().concat([{ b: Math.round(b), d: Math.round(d) }]));
      render();
    });
    const undo = el('button', { class: 'btn ghost', onclick: () => { save(legs().slice(0, -1)); render(); } }, ['Undo last leg']);
    let armed = false;
    const clear = el('button', { class: 'btn ghost' }, ['Clear log']);
    clear.addEventListener('click', () => {
      if (!armed) { armed = true; clear.textContent = 'Tap again to clear ALL legs'; setTimeout(() => { armed = false; clear.textContent = 'Clear log'; }, 4000); return; }
      save([]); armed = false; clear.textContent = 'Clear log'; render();
    });
    render();
    return H.panel('Dead-reckoning log', 'Log each leg you walk; it tracks your offset from the start and the bearing home. Survives closing the app.', [
      el('div', { class: 'field-row' }, [bearing.wrap, dist.wrap]), add, out,
      C.sectionHead('Legs'), list,
      el('div', { class: 'corpus-row' }, [undo, clear]),
      H.sourceLink('route-planning-dead-reckoning.md'),
    ]);
  }

  // ---- GRID CONVERTER (per reading-topographic-maps.md) ----
  function gridTool(H) {
    const out = el('div', {}, []);
    let mode = 'toutm';
    const lat = H.numField('Latitude (° north +)', getPos().lat, { min: '-80', max: '84', step: '0.0001' });
    const lon = H.numField('Longitude (° east +)', getPos().lon, { min: '-180', max: '180', step: '0.0001' });
    const zone = H.numField('UTM zone (1–60)', 31, { min: '1', max: '60', step: '1' });
    const east = H.numField('Easting (m)', 500000, { min: '100000', max: '900000', step: '1' });
    const north = H.numField('Northing (m)', 5000000, { min: '0', max: '10000000', step: '1' });
    let south = false;
    const hemi = el('div', { class: 'seg-toggle' }, [
      el('button', { class: 'on', onclick: (e) => { south = false; flip(e.target); } }, ['NORTH']),
      el('button', { onclick: (e) => { south = true; flip(e.target); } }, ['SOUTH']),
    ]);
    const hemiWrap = el('div', { class: 'field' }, [el('label', {}, ['Hemisphere']), hemi]);
    function flip(btn) { hemi.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b === btn)); calc(); }
    function calc() {
      out.innerHTML = '';
      const fwd = mode === 'toutm';
      [lat, lon].forEach((f) => { f.wrap.style.display = fwd ? '' : 'none'; });
      [zone, east, north].forEach((f) => { f.wrap.style.display = fwd ? 'none' : ''; });
      hemiWrap.style.display = fwd ? 'none' : '';
      if (fwd) {
        const la = parseFloat(lat.input.value), lo = parseFloat(lon.input.value);
        if (isNaN(la) || isNaN(lo) || Math.abs(la) > 84) {
          out.appendChild(el('p', { class: 'tool-note' }, ['UTM covers 80°S–84°N. Enter a valid position.']));
          return;
        }
        const u = AS.llToUtm(la, lo);
        out.appendChild(el('div', { class: 'readout-row' }, [
          H.readout('zone ' + u.zone + (u.south ? ' S' : ' N'), 'UTM zone', 'WGS-84 datum'),
          H.readout(Math.round(u.e).toLocaleString() + ' E', 'easting (m)', 'read RIGHT on the map grid'),
        ]));
        out.appendChild(H.readout(Math.round(u.n).toLocaleString() + ' N', 'northing (m)', 'then UP. Quote zone + easting + northing.'));
      } else {
        const z = Math.round(parseFloat(zone.input.value) || 31);
        const ll = AS.utmToLl(z, south, parseFloat(east.input.value) || 500000, parseFloat(north.input.value) || 0);
        out.appendChild(el('div', { class: 'readout-row' }, [
          H.readout(Math.abs(ll.lat).toFixed(4) + '° ' + (ll.lat >= 0 ? 'N' : 'S'), 'latitude'),
          H.readout(Math.abs(ll.lon).toFixed(4) + '° ' + (ll.lon >= 0 ? 'E' : 'W'), 'longitude'),
        ]));
      }
    }
    const modeToggle = el('div', { class: 'seg-toggle' }, [
      el('button', { class: 'on', onclick: (e) => { mode = 'toutm'; modeToggle.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b === e.target)); calc(); } }, ['LAT/LON → UTM']),
      el('button', { onclick: (e) => { mode = 'toll'; modeToggle.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b === e.target)); calc(); } }, ['UTM → LAT/LON']),
    ]);
    [lat, lon, zone, east, north].forEach((f) => f.input.addEventListener('input', calc));
    calc();
    return H.panel('Grid converter', 'Latitude/longitude ↔ UTM grid (WGS-84) for working with paper-map grids.', [
      el('div', { class: 'field' }, [el('label', {}, ['Direction']), modeToggle]),
      lat.wrap, lon.wrap, zone.wrap, hemiWrap,
      el('div', { class: 'field-row' }, [east.wrap, north.wrap]), out,
      H.sourceLink('reading-topographic-maps.md'),
    ]);
  }

  return { sun: sunTool, starfinder: starTool, latitude: latTool,
           deadreckon: drTool, grid: gridTool };
})();
