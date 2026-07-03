/* Inline SVG sprite injected at load so icons work fully offline (no icon CDN).
   All stroke-based + currentColor, so themes (incl. night mode) restyle them
   for free. `needfire` is the brand flame; `bothy` is the pika mascot. */
(function () {
  var S = {
    // brand: the needfire — a flame with rising sparks
    needfire: '<path d="M12 22c-3.9 0-7-2.7-7-6.4 0-4.3 4.1-5.5 5.2-9.8 2.5 1.7 3.2 4.4 2.4 6.5 1.5-.8 2.6-2.3 2.7-4.2 2.3 2 3.7 4.4 3.7 7.5 0 3.7-3.1 6.4-7 6.4z"/><path d="M12 2.2v.01M7.2 4.4v.01M16.8 4.4v.01"/>',
    // mascot: the Bothy pika (round ears, whiskers, haymaker of the talus)
    bothy: '<path d="M7.2 8.4C6 7.6 5.2 6 5.6 4.4 7.2 4.4 8.6 5.2 9.2 6.6M16.8 8.4c1.2-.8 2-2.4 1.6-4-1.6 0-3 .8-3.6 2.2"/><path d="M5 15a7 7 0 0 1 14 0v2.6A3.4 3.4 0 0 1 15.6 21H8.4A3.4 3.4 0 0 1 5 17.6z"/><path d="M9.6 13.4v.01M14.4 13.4v.01M12 16v.8M12 16.8l-1 .7M12 16.8l1 .7M7.4 15.6l-2.2-.5M7.4 16.8l-2.2.5M16.6 15.6l2.2-.5M16.6 16.8l2.2.5"/>',
    grid: '<path d="M3 3h8v8H3zM13 3h8v8h-8zM3 13h8v8H3zM13 13h8v8h-8z"/>',
    spark: '<path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z"/>',
    book: '<path d="M4 4h11a3 3 0 0 1 3 3v13a3 3 0 0 0-3-3H4zM20 4v13"/>',
    pulse: '<path d="M3 12h4l3 8 4-16 3 8h4"/>',
    search: '<path d="M11 4a7 7 0 1 0 4.95 11.95l4.55 4.55 1.4-1.4-4.55-4.55A7 7 0 0 0 11 4zm0 2a5 5 0 1 1 0 10 5 5 0 0 1 0-10z"/>',
    arrowleft: '<path d="M15 5l-7 7 7 7"/>',
    alert: '<path d="M12 2L1 21h22L12 2zm0 6v7m0 3v.5"/>',
    empty: '<path d="M4 7h16v13H4zM4 7l2-3h12l2 3M9 12h6"/>',
    medical: '<path d="M10 3h4v5h5v4h-5v9h-4v-9H5V8h5z"/>',
    water: '<path d="M12 2s7 8 7 13a7 7 0 1 1-14 0c0-5 7-13 7-13z"/>',
    food: '<path d="M7 2v8a3 3 0 0 0 6 0V2M10 2v20M17 2c-2 0-3 3-3 6s1 5 3 5v9"/>',
    fire: '<path d="M12 2c1 4-3 5-3 9a3 3 0 0 0 6 0c0-1-1-2-1-3 2 1 3 3 3 5a5 5 0 0 1-10 0C4 9 12 8 12 2z"/>',
    energy: '<path d="M11 2L4 14h6l-1 8 8-12h-6l1-8z"/>',
    flask: '<path d="M9 2h6M10 2v6l-5 9a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3l-5-9V2M7 15h10"/>',
    pill: '<path d="M5 13l8-8a4 4 0 0 1 6 6l-8 8a4 4 0 0 1-6-6zM9 9l6 6"/>',
    atom: '<circle cx="12" cy="12" r="2"/><path d="M12 4c6 0 9 3 9 8s-3 8-9 8M12 4C6 4 3 7 3 12M20 7C16 17 8 17 4 7M4 17C8 7 16 7 20 17"/>',
    chip: '<path d="M7 7h10v10H7zM9 2v3M15 2v3M9 19v3M15 19v3M2 9h3M2 15h3M19 9h3M19 15h3"/>',
    plant: '<path d="M12 21v-9M12 12C12 7 8 5 4 5c0 5 4 7 8 7zM12 12c0-4 4-6 8-6 0 4-4 6-8 6z"/>',
    wrench: '<path d="M21 4a5 5 0 0 1-6 6L7 18a2 2 0 0 1-3-3l8-8a5 5 0 0 1 6-6l-3 3 1 3 3 1z"/>',
    compass: '<circle cx="12" cy="12" r="9"/><path d="M16 8l-2 6-6 2 2-6z"/>',
    // modes + emergency scenarios
    emergency: '<circle cx="12" cy="12" r="9"/><path d="M12 7v10M7 12h10"/>',
    tools: '<path d="M3 9h18v11H3zM9 9V6.5A2.5 2.5 0 0 1 11.5 4h1A2.5 2.5 0 0 1 15 6.5V9M3 14h18M12 12.5v3"/>',
    heart: '<path d="M12 21C7 16.5 3 13 3 8.8A4.6 4.6 0 0 1 12 6.4a4.6 4.6 0 0 1 9 2.4c0 4.2-4 7.7-9 12.2z"/>',
    lungs: '<path d="M12 3v7M12 10c0 4-1.8 8-4.8 8-1.8 0-2.7-1.4-2.7-3.4 0-2.6 1.5-6.1 4.5-6.1M12 10c0 4 1.8 8 4.8 8 1.8 0 2.7-1.4 2.7-3.4 0-2.6-1.5-6.1-4.5-6.1"/>',
    blood: '<path d="M12 3s6 7 6 11.5a6 6 0 1 1-12 0C6 10 12 3 12 3z"/><path d="M12 12v5M9.5 14.5h5"/>',
    burn: '<path d="M12 2c1 4-3 5-3 9a3 3 0 0 0 6 0c0-1-1-2-1-3 2 1 3 3 3 5a5 5 0 0 1-10 0C4 9 12 8 12 2z"/><path d="M4 22h16"/>',
    bee: '<path d="M18 3l3 3M16 5l3 3M6 13l7.5-7.5 3 3L9 16H6v-3zM6 16l-3 3M4 21l1.5-1.5"/>',
    poison: '<path d="M9 3h6M10 3v4l-3 3v9a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2v-9l-3-3V3"/><path d="M9.5 13.5l5 4.5M14.5 13.5l-5 4.5"/>',
    snake: '<path d="M5 20c7 0 9-2.5 5-4.5S6.5 10 12 9.5c4-.4 5.5-2 4-4.5M15.5 5h.01"/><path d="M18.5 3.5c-.8 0-1.6.5-2.5 1.5"/>',
    brain: '<circle cx="12" cy="11" r="8"/><path d="M7 11h2.4l1-2 1.6 4 1-2H17"/>',
    wave: '<path d="M21 7c-2-2-6-2-8 0s-6 2-8 0M21 13c-2-2-6-2-8 0s-6 2-8 0M21 19c-2-2-6-2-8 0s-6 2-8 0"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.6 4.6l2.1 2.1M17.3 17.3l2.1 2.1M19.4 4.6l-2.1 2.1M6.7 17.3l-2.1 2.1"/>',
    snow: '<path d="M12 2v20M3.5 7l17 10M20.5 7l-17 10M12 2l-2 2.5M12 2l2 2.5M12 22l-2-2.5M12 22l2-2.5"/>',
    baby: '<circle cx="12" cy="7" r="3.4"/><path d="M6.5 21v-3.5a5.5 5.5 0 0 1 11 0V21M9 21h6"/>',
    timer: '<circle cx="12" cy="13" r="8"/><path d="M12 9.5V13l2.5 2M9.5 2h5"/>',
    metronome: '<path d="M9 3h6l3.2 18H5.8L9 3z"/><path d="M12 15.5L16.5 7"/>',
    strobe: '<circle cx="12" cy="12" r="2.4"/><path d="M12 2.5v3.5M12 18v3.5M2.5 12H6M18 12h3.5M5.3 5.3l2.5 2.5M16.2 16.2l2.5 2.5M18.7 5.3l-2.5 2.5M7.8 16.2l-2.5 2.5"/>',
    pin: '<path d="M9 3h6l-1 6 3.5 3.5V14h-11v-1.5L10 9 9 3zM12 14v7"/>',
    moon: '<path d="M20 13.5A8.5 8.5 0 1 1 10.5 4a7 7 0 0 0 9.5 9.5z"/>',
    contrast: '<circle cx="12" cy="12" r="9"/><path d="M12 3v18M15 4.3v15.4M18 7.4v9.2"/>',
    // system / studio
    system: '<path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z"/>',
    code: '<path d="M8 8l-4 4 4 4M16 8l4 4-4 4M14 5l-4 14"/>',
    terminal: '<path d="M3 4h18v16H3zM6 9l3 3-3 3M12 15h5"/>',
    folder: '<path d="M3 6h6l2 2h10v10H3z"/>',
    file: '<path d="M6 3h8l4 4v14H6zM14 3v4h4"/>',
    play: '<path d="M7 4l12 8-12 8z"/>',
    trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
    download: '<path d="M12 3v11M8 11l4 4 4-4M5 20h14"/>',
    lock: '<path d="M6 10h12v10H6zM8 10V7a4 4 0 0 1 8 0v3"/>',
    key: '<circle cx="8" cy="8" r="4"/><path d="M11 11l8 8M16 16l2-2M18 18l2-2"/>',
    refresh: '<path d="M20 8a8 8 0 1 0 .5 6M20 4v4h-4"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    cog: '<circle cx="12" cy="12" r="3.2"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M16.9 16.9l2.1 2.1M19.1 4.9l-2.1 2.1M7 16.9l-2.1 2.1"/>',
  };
  var ns = 'http://www.w3.org/2000/svg';
  var svg = '<svg xmlns="' + ns + '" style="display:none">';
  for (var k in S) {
    svg += '<symbol id="icon-' + k + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
           'stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' + S[k] + '</symbol>';
  }
  svg += '</svg>';
  document.addEventListener('DOMContentLoaded', function () {
    var host = document.getElementById('sprite-host');
    if (host) host.innerHTML = svg;
  });
})();
