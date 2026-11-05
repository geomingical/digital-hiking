/* WebAudio 合成音效：Q 版風格，只用 sine / triangle、柔和起音、指數收尾。
   預設靜音；使用者開過一次音效會記在 localStorage，下次第一次點擊或按鍵時自動開啟。
   每個音效都寫成 (ac, out, t) 的形式，可以畫進真的 AudioContext，也可以畫進 OfflineAudioContext 預覽。 */
(function () {
  const DH = (window.DH = window.DH || {});
  const PREF_KEY = 'dh.sound';
  const MASTER_VOL = 0.35;

  /* 五聲音階（C 大調 / A 小調）常用音 */
  const N = {
    A3: 220, C4: 261.63, D4: 293.66, E4: 329.63, G4: 392, A4: 440,
    C5: 523.25, D5: 587.33, E5: 659.25, G5: 783.99, A5: 880,
    C6: 1046.5, D6: 1174.66, E6: 1318.51, G6: 1567.98,
  };
  const SCALES = {
    calm: [N.G4, N.A4, N.C5, N.D5, N.E5, N.G5],
    tense: [N.E4, N.G4, N.A4, N.C5, N.D5, N.E5],
  };

  /* --- 基本積木 ---------------------------------------------------- */
  const noiseCache = new WeakMap();
  function noise(ac) {
    let buf = noiseCache.get(ac);
    if (!buf) {
      const len = Math.floor(ac.sampleRate * 2);
      buf = ac.createBuffer(1, len, ac.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      noiseCache.set(ac, buf);
    }
    return buf;
  }

  /* 包絡：從 0 線性起音（>=5ms），再指數收尾到幾乎無聲 */
  function env(ac, t, vol, atk, dur) {
    const g = ac.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + Math.max(0.005, atk));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    return g;
  }

  function osc(ac, out, { freq, t, vol, dur, type = 'sine', atk = 0.006, glideTo, glideTime }) {
    const o = ac.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (glideTo) o.frequency.exponentialRampToValueAtTime(glideTo, t + (glideTime || dur));
    const g = env(ac, t, vol, atk, dur);
    o.connect(g).connect(out);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  /* 木琴／拇指琴：正弦基音 + 很快消失的 2 倍、4 倍泛音 */
  function pluck(ac, out, freq, t, vol, dur = 0.6) {
    osc(ac, out, { freq, t, vol, dur });
    osc(ac, out, { freq: freq * 2, t, vol: vol * 0.22, dur: Math.min(dur, 0.12) });
    osc(ac, out, { freq: freq * 4, t, vol: vol * 0.07, dur: 0.04 });
  }

  function noiseBurst(ac, out, { t, vol, dur, lp, hp = 120, bp, q = 0.7, rate = 1, atk = 0.005 }) {
    const src = ac.createBufferSource();
    src.buffer = noise(ac);
    src.playbackRate.value = rate;
    let node = src;
    const add = (type, f, Q) => {
      const b = ac.createBiquadFilter();
      b.type = type;
      b.frequency.value = f;
      if (Q) b.Q.value = Q;
      node.connect(b);
      node = b;
    };
    add('highpass', hp);
    if (bp) add('bandpass', bp, q);
    if (lp) add('lowpass', lp);
    const g = env(ac, t, vol, atk, dur);
    node.connect(g).connect(out);
    const offset = Math.random() * 1.5;
    src.start(t, offset);
    src.stop(t + dur + 0.05);
  }

  /* --- 音效 -------------------------------------------------------- */
  const SFX = {
    /* 泡泡「啵」：輕輕往上滑的圓潤音 */
    pop(ac, out, t) {
      osc(ac, out, { freq: 540, glideTo: 880, glideTime: 0.06, t, vol: 0.32, dur: 0.16, atk: 0.006 });
      osc(ac, out, { freq: 1080, glideTo: 1760, glideTime: 0.06, t, vol: 0.03, dur: 0.06 });
    },
    /* 相機：兩下柔和的雜訊「喀嚓」 */
    shutter(ac, out, t) {
      noiseBurst(ac, out, { t, vol: 0.4, dur: 0.035, bp: 2600, q: 0.9, lp: 5000, hp: 600 });
      noiseBurst(ac, out, { t: t + 0.075, vol: 0.3, dur: 0.05, bp: 1700, q: 0.9, lp: 4000, hp: 400 });
      osc(ac, out, { freq: N.E6, t: t + 0.08, vol: 0.025, dur: 0.12 });
    },
    /* 答對：叮～咚 兩聲往上的拇指琴，加一點星星 */
    correct(ac, out, t) {
      pluck(ac, out, N.E5, t, 0.2, 0.45);
      pluck(ac, out, N.A5, t + 0.1, 0.2, 0.7);
      osc(ac, out, { freq: N.E6 * 2, t: t + 0.2, vol: 0.018, dur: 0.35 });
    },
    /* 答錯：低低的兩聲「噗嗚」，往下但不刺耳 */
    wrong(ac, out, t) {
      [[N.E4, 0], [N.C4, 0.17]].forEach(([f, d]) => {
        osc(ac, out, { freq: f, glideTo: f * 0.94, t: t + d, vol: 0.26, dur: 0.3, atk: 0.012 });
        osc(ac, out, { freq: f * 2, t: t + d, vol: 0.03, dur: 0.08, type: 'triangle', atk: 0.01 });
      });
    },
    /* 壞結局：慢慢往下的小調短句，像「唉～」 */
    siren(ac, out, t) {
      [N.E5, N.D5, N.C5, N.A4].forEach((f, i) => pluck(ac, out, f, t + i * 0.28, 0.15, i === 3 ? 1.6 : 0.7));
      osc(ac, out, { freq: N.A3, t: t + 0.84, vol: 0.09, dur: 1.8, type: 'triangle', atk: 0.12 });
      osc(ac, out, { freq: N.C4, t: t + 0.84, vol: 0.05, dur: 1.6, atk: 0.15 });
    },
    /* 換區：三聲輕快上行 */
    jingle(ac, out, t) {
      [N.E5, N.G5, N.C6].forEach((f, i) => pluck(ac, out, f, t + i * 0.09, 0.14, i === 2 ? 0.7 : 0.35));
    },
    /* 好結局／領獎：溫暖琶音 + 柔和底墊 + 結尾亮晶晶 */
    fanfare(ac, out, t) {
      [N.C5, N.E5, N.G5, N.C6, N.E6].forEach((f, i) => pluck(ac, out, f, t + i * 0.1, 0.13, i === 4 ? 1.4 : 0.6));
      osc(ac, out, { freq: N.C4, t, vol: 0.07, dur: 1.6, type: 'triangle', atk: 0.08 });
      osc(ac, out, { freq: N.G4, t: t + 0.05, vol: 0.05, dur: 1.5, atk: 0.1 });
      [N.G6, N.C6 * 2].forEach((f, i) => osc(ac, out, { freq: f, t: t + 0.5 + i * 0.08, vol: 0.02, dur: 0.5 }));
    },
    /* 腳步：短短的低通雜訊「沙」，每次音高、濾波、音量都不同 */
    step(ac, out, t) {
      noiseBurst(ac, out, {
        t, vol: 0.07 + Math.random() * 0.05, dur: 0.05 + Math.random() * 0.04,
        lp: 700 + Math.random() * 600, hp: 160, rate: 0.75 + Math.random() * 0.5, atk: 0.006,
      });
    },
    /* 小鳥：2～3 聲往上挑的細細啾 */
    chirp(ac, out, t) {
      const base = 2400 + Math.random() * 900;
      const n = 2 + Math.floor(Math.random() * 2);
      for (let i = 0; i < n; i++) {
        osc(ac, out, { freq: base, glideTo: base * (1.18 + Math.random() * 0.15), glideTime: 0.05, t: t + i * 0.11, vol: 0.022, dur: 0.075, atk: 0.008 });
      }
    },
    /* 背景音樂的一個音：長尾拇指琴 + 偶爾一個低音 */
    musicNote(ac, out, t, mode) {
      const scale = SCALES[mode] || SCALES.calm;
      const pick = () => scale[Math.floor(Math.random() * scale.length)];
      const n = pick();
      pluck(ac, out, n, t, 0.05, 2.2);
      if (Math.random() < 0.5) osc(ac, out, { freq: n / 2, t, vol: 0.03, dur: 2.6, type: 'triangle', atk: 0.1 });
      if (Math.random() < 0.35) pluck(ac, out, pick(), t + 0.6, 0.035, 1.8);
    },
  };

  /* 主輸出：音量 → 柔和低通 → 壓縮器 → 最後再壓一點，峰值留在 -1 dBFS 以下 */
  function buildMaster(ac) {
    const master = ac.createGain();
    master.gain.value = MASTER_VOL;
    const lp = ac.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 6500;
    lp.Q.value = 0.5;
    const comp = ac.createDynamicsCompressor();
    comp.threshold.value = -20;
    comp.knee.value = 12;
    comp.ratio.value = 6;
    comp.attack.value = 0.003;
    comp.release.value = 0.2;
    const trim = ac.createGain();
    trim.gain.value = 0.85;
    master.connect(lp).connect(comp).connect(trim).connect(ac.destination);
    return master;
  }

  /* 環境音：很小聲的風（低通雜訊 + 緩慢 LFO）與雨聲 */
  function buildAmbience(ac, out) {
    const wind = ac.createBufferSource();
    wind.buffer = noise(ac);
    wind.loop = true;
    const lp = ac.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 380;
    const windGain = ac.createGain();
    windGain.gain.value = 0;
    const lfo = ac.createOscillator();
    const lfoAmt = ac.createGain();
    lfo.frequency.value = 0.12;
    lfoAmt.gain.value = 140;
    lfo.connect(lfoAmt).connect(lp.frequency);
    wind.connect(lp).connect(windGain).connect(out);

    const rain = ac.createBufferSource();
    rain.buffer = noise(ac);
    rain.loop = true;
    const hp = ac.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 1600;
    const rlp = ac.createBiquadFilter();
    rlp.type = 'lowpass';
    rlp.frequency.value = 5000;
    const rainGain = ac.createGain();
    rainGain.gain.value = 0;
    rain.connect(hp).connect(rlp).connect(rainGain).connect(out);

    wind.start();
    rain.start();
    lfo.start();
    return { windGain, rainGain };
  }

  const WIND = { calm: 0.05, high: 0.12 };

  /* --- 即時播放狀態 ------------------------------------------------- */
  let ctx = null;
  let master = null;
  let amb = null;
  let enabled = false;
  let birdsWanted = true;
  let section = null;
  let birdTimer = null;
  let musicTimer = null;
  let musicMode = 'calm';
  let stepCount = 0;

  const readPref = () => { try { return localStorage.getItem(PREF_KEY) === '1'; } catch (e) { return false; } };
  const writePref = (on) => { try { localStorage.setItem(PREF_KEY, on ? '1' : '0'); } catch (e) { /* 隱私模式 */ } };

  function init() {
    if (ctx) return true;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    master = buildMaster(ctx);
    amb = buildAmbience(ctx, master);
    return true;
  }

  const live = () => enabled && ctx && ctx.state === 'running';
  const play = (name) => { if (live()) SFX[name](ctx, master, ctx.currentTime + 0.01); };

  function windLevel() {
    return section === 'ridge' || section === 'summit' ? WIND.high : WIND.calm;
  }

  function scheduleBirds() {
    clearTimeout(birdTimer);
    if (!enabled) return;
    birdTimer = setTimeout(() => {
      if (birdsWanted) play('chirp');
      scheduleBirds();
    }, 4000 + Math.random() * 8000);
  }

  function scheduleMusic() {
    clearTimeout(musicTimer);
    if (!enabled) return;
    musicTimer = setTimeout(() => {
      if (live()) SFX.musicNote(ctx, master, ctx.currentTime + 0.01, musicMode);
      scheduleMusic();
    }, 3200 + Math.random() * 3400);
  }

  function applyEnabled(on) {
    enabled = on;
    if (ctx) {
      amb.windGain.gain.setTargetAtTime(on ? windLevel() : 0, ctx.currentTime, 0.4);
      if (!on) amb.rainGain.gain.setTargetAtTime(0, ctx.currentTime, 0.2);
      if (on) ctx.resume();
    }
    scheduleBirds();
    scheduleMusic();
  }

  /* 上次開著音效：等第一次點擊／按鍵（瀏覽器規定）再建立 AudioContext */
  if (readPref()) {
    enabled = true;
    const wake = () => {
      window.removeEventListener('pointerdown', wake, true);
      window.removeEventListener('keydown', wake, true);
      if (enabled && init()) applyEnabled(true);
    };
    window.addEventListener('pointerdown', wake, true);
    window.addEventListener('keydown', wake, true);
  }

  DH.audio = {
    get enabled() { return enabled; },
    setEnabled(on) {
      if (on && !init()) return false;
      writePref(on);
      applyEnabled(on);
      return true;
    },
    /* 雨聲、風聲跟著畫面上的天氣走 */
    setWeather(rain, wind, risk) {
      musicMode = risk >= 50 ? 'tense' : 'calm';
      if (!ctx || !enabled) return;
      amb.rainGain.gain.setTargetAtTime(rain * 0.05, ctx.currentTime, 0.8);
      if (wind > 0.3) amb.windGain.gain.setTargetAtTime(windLevel() + wind * 0.06, ctx.currentTime, 0.8);
    },
    /* 頁籤切走時暫停，切回來時恢復。 */
    suspend() { if (ctx && ctx.state === 'running') ctx.suspend(); },
    resume() { if (ctx && enabled) ctx.resume(); },
    /* 森林、登山口有鳥叫；稜線以上風聲較大。 */
    setAmbience(sectionKey) {
      section = sectionKey;
      birdsWanted = sectionKey === 'trailhead' || sectionKey === 'forest' || sectionKey === 'descent';
      if (ctx && enabled) amb.windGain.gain.setTargetAtTime(windLevel(), ctx.currentTime, 1.2);
    },
    /* 腳步聲每兩步才響一次，不然太吵 */
    step() {
      if (stepCount++ % 2 === 0) play('step');
    },
    correct() { play('correct'); },
    wrong() { play('wrong'); },
    pop() { play('pop'); },
    shutter() { play('shutter'); },
    jingle() { play('jingle'); },
    fanfare() { play('fanfare'); },
    siren() { play('siren'); },
  };

  /* --- 離線預覽（tests/render_audio.py 使用）------------------------- */
  const PREVIEWS = {
    footsteps: { seconds: 2.8, draw(ac, out) { for (let i = 0; i < 9; i++) if (i % 2 === 0) SFX.step(ac, out, 0.05 + i * 0.31); } },
    ambience: {
      seconds: 8,
      draw(ac, out) {
        const a = buildAmbience(ac, out);
        a.windGain.gain.setValueAtTime(0, 0);
        a.windGain.gain.setTargetAtTime(WIND.calm, 0, 0.4);
        [1.2, 4.6, 6.8].forEach((t) => SFX.chirp(ac, out, t));
        a.windGain.gain.setTargetAtTime(0, 7.3, 0.2);
      },
    },
    music: {
      seconds: 12,
      draw(ac, out) { [0.1, 3.6, 7.4].forEach((t) => SFX.musicNote(ac, out, t, 'calm')); },
    },
  };
  ['pop', 'shutter', 'correct', 'wrong', 'siren', 'jingle', 'fanfare', 'chirp'].forEach((k) => {
    PREVIEWS[k] = { seconds: k === 'siren' ? 3.2 : k === 'fanfare' ? 2.4 : 1.2, draw: (ac, out) => SFX[k](ac, out, 0.02) };
  });

  /* 回傳 { sampleRate, data: base64(Float32 PCM 單聲道) } */
  window.__renderAudioPreview = async function (name) {
    if (!name) return Object.keys(PREVIEWS);
    const p = PREVIEWS[name];
    if (!p) throw new Error('unknown preview ' + name);
    const sr = 44100;
    const ac = new OfflineAudioContext(1, Math.ceil(sr * p.seconds), sr);
    p.draw(ac, buildMaster(ac));
    const buf = await ac.startRendering();
    const bytes = new Uint8Array(buf.getChannelData(0).buffer);
    let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return { sampleRate: sr, data: btoa(bin) };
  };
})();
