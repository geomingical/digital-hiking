/* WebAudio 合成音效。預設靜音，使用者開啟後才建立 AudioContext。 */
(function () {
  const DH = (window.DH = window.DH || {});
  let ctx = null;
  let master = null;
  let windGain = null;
  let birdTimer = null;
  let enabled = false;
  let birdsWanted = true;
  let rainGain = null;
  let musicTimer = null;
  let musicMode = 'calm';
  /* 背景音樂：幾個五聲音階的音慢慢飄過，風險高時換成比較不安的音 */
  const SCALES = {
    calm: [392, 440, 523.25, 587.33, 659.25, 783.99],
    tense: [329.63, 392, 440, 493.88, 587.33, 659.25],
  };

  function noiseBuffer(seconds) {
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  function init() {
    if (ctx) return true;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.7;
    master.connect(ctx.destination);

    const wind = ctx.createBufferSource();
    wind.buffer = noiseBuffer(3);
    wind.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 420;
    windGain = ctx.createGain();
    windGain.gain.value = 0;
    const lfo = ctx.createOscillator();
    const lfoAmt = ctx.createGain();
    lfo.frequency.value = 0.13;
    lfoAmt.gain.value = 170;
    lfo.connect(lfoAmt).connect(lp.frequency);
    wind.connect(lp).connect(windGain).connect(master);
    wind.start();
    lfo.start();

    const rain = ctx.createBufferSource();
    rain.buffer = noiseBuffer(2);
    rain.loop = true;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 1800;
    rainGain = ctx.createGain();
    rainGain.gain.value = 0;
    rain.connect(hp).connect(rainGain).connect(master);
    rain.start();
    return true;
  }

  function tone(freq, start, dur, vol, type, slideTo) {
    const t = ctx.currentTime + start;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  function chirp() {
    if (!enabled || ctx.state !== 'running') return;
    const base = 2100 + Math.random() * 1400;
    const notes = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < notes; i++) {
      tone(base, i * 0.13, 0.09, 0.022, 'sine', base * (1.12 + Math.random() * 0.25));
    }
  }

  function scheduleMusic() {
    clearTimeout(musicTimer);
    if (!enabled) return;
    musicTimer = setTimeout(() => {
      if (ctx.state === 'running') {
        const scale = SCALES[musicMode];
        const n = scale[Math.floor(Math.random() * scale.length)];
        tone(n, 0, 3.2, 0.028, 'sine');
        tone(n / 2, 0, 4.2, 0.02, 'triangle');
        if (Math.random() < 0.4) tone(scale[Math.floor(Math.random() * scale.length)], 0.9, 2.6, 0.018, 'sine');
      }
      scheduleMusic();
    }, 2400 + Math.random() * 2600);
  }

  function scheduleBirds() {
    clearTimeout(birdTimer);
    if (!enabled) return;
    birdTimer = setTimeout(() => {
      if (birdsWanted) chirp();
      scheduleBirds();
    }, 3500 + Math.random() * 7000);
  }

  const play = (fn) => {
    if (enabled && ctx && ctx.state === 'running') fn();
  };

  DH.audio = {
    get enabled() { return enabled; },
    setEnabled(on) {
      if (on && !init()) return false;
      enabled = on;
      if (ctx) {
        windGain.gain.setTargetAtTime(on ? 0.05 : 0, ctx.currentTime, 0.4);
        if (on) ctx.resume();
      }
      scheduleBirds();
      scheduleMusic();
      return true;
    },
    /* 雨聲、風聲跟著畫面上的天氣走 */
    setWeather(rain, wind, risk) {
      musicMode = risk >= 50 ? 'tense' : 'calm';
      if (!ctx || !enabled) return;
      rainGain.gain.setTargetAtTime(rain * 0.09, ctx.currentTime, 0.8);
      if (wind > 0.3) windGain.gain.setTargetAtTime(0.05 + wind * 0.14, ctx.currentTime, 0.8);
    },
    /* 頁籤切走時暫停，切回來時恢復。 */
    suspend() { if (ctx && ctx.state === 'running') ctx.suspend(); },
    resume() { if (ctx && enabled) ctx.resume(); },
    /* 森林、登山口有鳥叫；稜線以上風聲較大。 */
    setAmbience(sectionKey) {
      birdsWanted = sectionKey === 'trailhead' || sectionKey === 'forest' || sectionKey === 'descent';
      if (ctx && enabled) {
        const v = sectionKey === 'ridge' || sectionKey === 'summit' ? 0.13 : 0.045;
        windGain.gain.setTargetAtTime(v, ctx.currentTime, 1.2);
      }
    },
    step() {
      play(() => {
        const src = ctx.createBufferSource();
        src.buffer = noiseBuffer(0.07);
        const f = ctx.createBiquadFilter();
        f.type = 'bandpass';
        f.frequency.value = 500 + Math.random() * 400;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.05, ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.07);
        src.connect(f).connect(g).connect(master);
        src.start();
      });
    },
    correct() {
      play(() => {
        tone(880, 0, 0.22, 0.14, 'triangle');
        tone(1318, 0.11, 0.34, 0.13, 'triangle');
      });
    },
    wrong() {
      play(() => {
        tone(170, 0, 0.32, 0.26, 'sine', 80);
        tone(110, 0.05, 0.3, 0.14, 'triangle', 70);
      });
    },
    pop() { play(() => tone(620, 0, 0.1, 0.09, 'sine', 900)); },
    shutter() { play(() => { tone(1800, 0, 0.04, 0.07, 'square'); tone(1200, 0.06, 0.04, 0.06, 'square'); }); },
    jingle() {
      play(() => [523, 659, 784].forEach((n, i) => tone(n, i * 0.12, 0.28, 0.09, 'triangle')));
    },
    fanfare() {
      play(() => [523, 659, 784, 1046].forEach((n, i) => tone(n, i * 0.15, 0.42, 0.11, 'triangle')));
    },
    siren() {
      play(() => [0, 0.5].forEach((s) => tone(520, s, 0.45, 0.07, 'sine', 700)));
    },
  };
})();
