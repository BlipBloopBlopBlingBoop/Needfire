/* Field instruments: metronome, countdown, wake lock, morse strobe.
   Pure engines + a small mount() renderer each — no view opinions.
   Audio: ONE shared AudioContext, unlocked inside a user gesture (iOS). */
const Instruments = (function () {
  const el = C.el;

  // ---- shared audio context (gesture-unlocked) ----
  const AudioEngine = (() => {
    let ctx = null;
    function unlock() {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = ctx || new AC();
      if (ctx.state === 'suspended') ctx.resume();
      return ctx;
    }
    return { unlock, get: () => ctx };
  })();

  // ---- screen wake lock (honest fallback) ----
  const WakeLock = {
    _sentinel: null,
    _wanted: false,
    async on() {
      this._wanted = true;
      if (!('wakeLock' in navigator)) return false;
      try { this._sentinel = await navigator.wakeLock.request('screen'); }
      catch (e) { this._sentinel = null; }
      if (!this._revis) {
        this._revis = () => { if (!document.hidden && this._wanted) this.on(); };
        document.addEventListener('visibilitychange', this._revis);
      }
      return !!this._sentinel;
    },
    off() {
      this._wanted = false;
      if (this._sentinel) { this._sentinel.release().catch(() => {}); this._sentinel = null; }
    },
  };

  /* Metronome: setInterval only SCHEDULES; oscillator start times ride the
     sample-accurate audio clock, so tempo stays exact under timer jitter.
     count > 0 gives an accented beat every rollover (30 for 30:2 CPR). */
  function Metronome(opts) {
    const bpm = (opts && opts.bpm) || 110;
    const count = (opts && opts.count) || 0;
    const onBeat = (opts && opts.onBeat) || null;
    let running = false, nextT = 0, beat = 0, iv = null, visIv = null;
    const LOOKAHEAD_MS = 25, HORIZON = 0.1;

    function blip(ctx, t, accent) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'square';
      o.frequency.value = accent ? 1500 : 1000;
      g.gain.setValueAtTime(0.5, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.03);
      o.connect(g).connect(ctx.destination);
      o.start(t); o.stop(t + 0.04);
    }
    function scheduler() {
      const ctx = AudioEngine.get();
      while (nextT < ctx.currentTime + HORIZON) {
        beat = count ? (beat % count) + 1 : beat + 1;
        const accent = count > 0 && beat === 1;
        blip(ctx, nextT, accent);
        const b = beat, delay = Math.max(0, (nextT - ctx.currentTime) * 1000);
        if (onBeat) setTimeout(() => onBeat(b, accent), delay);
        nextT += 60 / bpm;
      }
    }
    return {
      start() {
        if (running) return;
        running = true;
        const ctx = AudioEngine.unlock(); // MUST run inside the tap handler
        if (ctx) {
          nextT = ctx.currentTime + 0.05; beat = 0;
          iv = setInterval(scheduler, LOOKAHEAD_MS);
        } else {
          // no WebAudio at all: visual/vibration fallback on wall clock
          beat = 0;
          visIv = setInterval(() => {
            beat = count ? (beat % count) + 1 : beat + 1;
            if (navigator.vibrate) navigator.vibrate(40);
            if (onBeat) onBeat(beat, count > 0 && beat === 1);
          }, 60000 / bpm);
        }
        WakeLock.on();
      },
      stop() {
        running = false;
        clearInterval(iv); clearInterval(visIv);
        iv = visIv = null;
        WakeLock.off();
      },
      get running() { return running; },
    };
  }

  /* Countdown: seconds -> 0, wall-clock based (survives tab throttling). */
  function Countdown(opts) {
    const total = opts.seconds;
    const onTick = opts.onTick || null;
    const onDone = opts.onDone || null;
    let endAt = null, iv = null, running = false, doneFired = false;

    function tick() {
      const left = Math.max(0, Math.ceil((endAt - Date.now()) / 1000));
      if (onTick) onTick(left);
      if (left <= 0 && !doneFired) {
        doneFired = true;
        if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
        const ctx = AudioEngine.get();
        if (ctx) { // three rising beeps
          for (let i = 0; i < 3; i++) {
            const o = ctx.createOscillator(), g = ctx.createGain();
            o.frequency.value = 900 + i * 200;
            const t = ctx.currentTime + i * 0.22;
            g.gain.setValueAtTime(0.4, t);
            g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
            o.connect(g).connect(ctx.destination); o.start(t); o.stop(t + 0.2);
          }
        }
        if (onDone) onDone();
        stopTimer();
      }
    }
    function stopTimer() { clearInterval(iv); iv = null; running = false; WakeLock.off(); }
    return {
      start() {
        if (running) return;
        running = true; doneFired = false;
        AudioEngine.unlock();
        endAt = Date.now() + total * 1000;
        tick();
        iv = setInterval(tick, 250);
        WakeLock.on();
      },
      stop: stopTimer,
      reset() { stopTimer(); if (onTick) onTick(total); },
      get running() { return running; },
    };
  }

  function fmtClock(s) {
    const m = Math.floor(s / 60), r = s % 60;
    return m + ':' + String(r).padStart(2, '0');
  }
  function fmtSince(t) {
    const mins = Math.floor((Date.now() - t) / 60000);
    if (mins < 60) return mins + ' min';
    return Math.floor(mins / 60) + ' h ' + (mins % 60) + ' min';
  }

  /* ---- mounted widgets (return DOM, own their engine lifecycle) ---- */

  // metronome widget with pulse ring + counter
  function metronomeWidget(spec) {
    const ring = el('div', { class: 'pulse-ring' }, ['—']);
    const btn = el('button', {}, ['START']);
    const box = el('div', { class: 'timer-box' }, [
      el('div', { class: 't-label' }, [spec.label || 'Metronome']),
      ring,
      el('div', { class: 't-sub' }, [spec.bpm + ' BPM' + (spec.count ? ' · accent every ' + spec.count : '')]),
      el('div', { class: 't-controls' }, [btn]),
    ]);
    const m = Metronome({
      bpm: spec.bpm, count: spec.count,
      onBeat(beat, accent) {
        ring.textContent = spec.count ? String(beat) : '●';
        ring.classList.remove('beat', 'beat-accent');
        void ring.offsetWidth; // restart the CSS transition
        ring.classList.add(accent ? 'beat-accent' : 'beat');
      },
    });
    btn.addEventListener('click', () => {
      if (m.running) { m.stop(); btn.textContent = 'START'; btn.classList.remove('running'); }
      else { m.start(); btn.textContent = 'STOP'; btn.classList.add('running'); }
    });
    box.addEventListener('nf:teardown', () => m.stop());
    return box;
  }

  // countdown widget
  function countdownWidget(spec) {
    const value = el('div', { class: 't-value' }, [fmtClock(spec.seconds)]);
    const btn = el('button', {}, ['START']);
    const resetBtn = el('button', {}, ['RESET']);
    const box = el('div', { class: 'timer-box' }, [
      el('div', { class: 't-label' }, [spec.label || 'Timer']),
      value,
      el('div', { class: 't-controls' }, [btn, resetBtn]),
    ]);
    const cd = Countdown({
      seconds: spec.seconds,
      onTick(left) {
        value.textContent = fmtClock(left);
        value.classList.toggle('t-done', left <= 0);
      },
      onDone() { btn.textContent = 'START'; btn.classList.remove('running'); },
    });
    btn.addEventListener('click', () => {
      if (cd.running) { cd.stop(); btn.textContent = 'START'; btn.classList.remove('running'); }
      else { cd.start(); btn.textContent = 'PAUSE'; btn.classList.add('running'); }
    });
    resetBtn.addEventListener('click', () => { cd.reset(); btn.textContent = 'START'; btn.classList.remove('running'); });
    if (spec.auto) setTimeout(() => { if (!cd.running) { cd.start(); btn.textContent = 'PAUSE'; btn.classList.add('running'); } }, 400);
    box.addEventListener('nf:teardown', () => cd.stop());
    return box;
  }

  // persistent time stamp (tourniquet time, bite time…)
  function stampWidget(spec, protoId, stepId) {
    const existing = Prefs.getStamp(protoId, stepId);
    const value = el('div', { class: 't-value' }, [existing ? new Date(existing.t).toTimeString().slice(0, 5) : '--:--']);
    const sub = el('div', { class: 't-sub' }, [existing ? fmtSince(existing.t) + ' ago' : 'not recorded']);
    const btn = el('button', {}, [existing ? 'RE-STAMP' : 'STAMP TIME NOW']);
    const box = el('div', { class: 'timer-box' }, [
      el('div', { class: 't-label' }, [spec.label || 'Time stamp']),
      value, sub,
      el('div', { class: 't-controls' }, [btn]),
    ]);
    let iv = setInterval(() => {
      const s = Prefs.getStamp(protoId, stepId);
      if (s) sub.textContent = fmtSince(s.t) + ' ago';
    }, 30000);
    btn.addEventListener('click', () => {
      const s = Prefs.addStamp(protoId, stepId, spec.label || 'Stamp');
      value.textContent = new Date(s.t).toTimeString().slice(0, 5);
      sub.textContent = 'just now';
      btn.textContent = 'RE-STAMP';
    });
    box.addEventListener('nf:teardown', () => clearInterval(iv));
    return box;
  }

  function mountTimer(spec, protoId, stepId) {
    if (spec.kind === 'metronome') return metronomeWidget(spec);
    if (spec.kind === 'countdown') return countdownWidget(spec);
    if (spec.kind === 'stamp') return stampWidget(spec, protoId, stepId);
    return el('div', {});
  }

  /* Morse strobe: rAF against performance.now(), toggling body.strobe-on. */
  function MorseStrobe(onState) {
    // SOS: ... --- ...  (unit 220ms; dot=1, dash=3, gap=1, letter gap=3, word gap=7)
    const U = 220;
    const pattern = [];
    const push = (on, units) => pattern.push({ on, ms: units * U });
    for (const letter of [[1, 1, 1], [3, 3, 3], [1, 1, 1]]) {
      for (let i = 0; i < letter.length; i++) {
        push(true, letter[i]);
        push(false, i === letter.length - 1 ? 3 : 1);
      }
    }
    pattern[pattern.length - 1].ms = 7 * U; // word gap before repeat
    const total = pattern.reduce((a, p) => a + p.ms, 0);

    let running = false, raf = null;
    function frame() {
      if (!running) return;
      let t = performance.now() % total;
      let on = false;
      for (const p of pattern) { if (t < p.ms) { on = p.on; break; } t -= p.ms; }
      onState(on);
      raf = requestAnimationFrame(frame);
    }
    return {
      start() { if (running) return; running = true; WakeLock.on(); raf = requestAnimationFrame(frame); },
      stop() { running = false; cancelAnimationFrame(raf); onState(false); WakeLock.off(); },
      get running() { return running; },
    };
  }

  return { AudioEngine, WakeLock, Metronome, Countdown, MorseStrobe,
           mountTimer, metronomeWidget, countdownWidget, fmtClock, fmtSince };
})();
