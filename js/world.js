/* 山徑世界：配色、視差背景、地面、物件擺放與整體渲染。 */
(function () {
  const DH = (window.DH = window.DH || {});
  const { SECTIONS, FINISH_X, makeRng } = DH.core;
  const A = DH.art;
  const TAU = Math.PI * 2;
  const PATH_H = 118;
  const PATH_MARGIN = 16;

  const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const css = (c) => `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`;
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const smooth = (a, b, v) => {
    const t = clamp((v - a) / (b - a), 0, 1);
    return t * t * (3 - 2 * t);
  };
  const hash = (n) => {
    const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return s - Math.floor(s);
  };

  const PALETTES = [
    { sky1: '#a9ddf5', sky2: '#eef9f2', far: '#c4dcea', mid: '#a9d6c6', near: '#93cfa2', bank: '#a9de92', bank2: '#93d184', path: '#ecd7ad', pathEdge: '#cfb384', front: '#92d484', front2: '#6fbd6f', cloud: '#ffffff' },
    { sky1: '#bce8dc', sky2: '#f1f9e2', far: '#afd4c4', mid: '#88c3a4', near: '#61ab84', bank: '#7fc47e', bank2: '#68b373', path: '#dfc595', pathEdge: '#b99c6c', front: '#62b273', front2: '#489a63', cloud: '#fbfff4' },
    { sky1: '#6cb8ec', sky2: '#fbeed2', far: '#86aed8', mid: '#6d9fa6', near: '#a9c98a', bank: '#d3df92', bank2: '#8fbd62', path: '#e6d3a6', pathEdge: '#b89f6e', front: '#97c267', front2: '#5c9652', cloud: '#fffaf0' },
    { sky1: '#83a8e2', sky2: '#ffdcba', far: '#bcb9df', mid: '#d0c3dc', near: '#ecdcd6', bank: '#cfd0b4', bank2: '#bcbf9f', path: '#dcd3c1', pathEdge: '#b6ab98', front: '#bcc0a0', front2: '#a3a88a', cloud: '#fff4ea' },
    { sky1: '#8f82c2', sky2: '#ffc78f', far: '#aa8cb2', mid: '#ba8394', near: '#94707c', bank: '#cda872', bank2: '#b99263', path: '#ecca98', pathEdge: '#bd9663', front: '#ad8a63', front2: '#8e7054', cloud: '#ffe2cc' },
  ].map((p) => {
    const out = {};
    Object.keys(p).forEach((k) => { out[k] = hex(p[k]); });
    return out;
  });
  const STORM = [88, 100, 122];
  /* 風險越高，這個色層越往暴風雨的灰藍偏 */
  const STORM_MIX = { sky1: 0.8, sky2: 0.72, far: 0.6, mid: 0.52, near: 0.42, cloud: 0.42, bank: 0.28, bank2: 0.28, path: 0.2, pathEdge: 0.2, front: 0.3, front2: 0.3 };

  function blendAt(x) {
    const w = [0, 0, 0, 0, 0];
    const FADE = 280;
    let idx = SECTIONS.findIndex((s) => x < s.to);
    if (idx < 0) idx = SECTIONS.length - 1;
    const sec = SECTIONS[idx];
    if (idx < SECTIONS.length - 1 && x > sec.to - FADE) {
      const t = smooth(sec.to - FADE, sec.to + FADE, x);
      w[idx] = 1 - t;
      w[idx + 1] = t;
    } else if (idx > 0 && x < sec.from + FADE) {
      const t = smooth(sec.from - FADE, sec.from + FADE, x);
      w[idx - 1] = 1 - t;
      w[idx] = t;
    } else {
      w[idx] = 1;
    }
    return w;
  }

  function paletteFor(w, risk) {
    const rf = smooth(25, 100, risk);
    const out = {};
    Object.keys(STORM_MIX).forEach((k) => {
      const c = [0, 0, 0];
      for (let i = 0; i < 5; i++) {
        if (w[i]) for (let j = 0; j < 3; j++) c[j] += PALETTES[i][k][j] * w[i];
      }
      const m = rf * STORM_MIX[k];
      for (let j = 0; j < 3; j++) c[j] += (STORM[j] - c[j]) * m;
      out[k] = c;
    });
    return out;
  }

  /* 地形 ------------------------------------------------------- */
  const wave = (x) => 14 * Math.sin(x * 0.0041) + 8 * Math.sin(x * 0.0113 + 1);
  /* 稜線段的草坡壓低，遠方的雲海與山才露得出來 */
  const ridgeZone = (x) => smooth(3050, 3450, x) * (1 - smooth(4550, 4950, x));
  const hillRise = (x) => (92 + 26 * Math.sin(x * 0.0029 + 2) + 12 * Math.sin(x * 0.009)) * (1 - ridgeZone(x) * 0.36);

  /* opts 讓首頁可指定自己的鏡頭：z 縮放、basePx 步道上緣的螢幕高度 */
  function makeLayout(w, h, opts) {
    const o = opts || {};
    const z = o.z || clamp(Math.min(h / 620, w / 500), 0.6, 1.5);
    const vw = w / z;
    const vh = h / z;
    const base = o.basePx !== undefined ? o.basePx / z : vh * (vh > vw ? (h <= 700 ? 0.52 : 0.56) : 0.62);
    return { w, h, z, vw, vh, base, pathH: PATH_H, camX: o.camX };
  }
  const pathTop = (L, x) => L.base + wave(x);
  const playerY = (L, x, d) => pathTop(L, x) + PATH_MARGIN + d * (PATH_H - PATH_MARGIN * 2);

  /* 預先做好的柔光貼圖，省去每幀建漸層 */
  function softSprite(rgb) {
    const cv = document.createElement('canvas');
    cv.width = cv.height = 128;
    const c = cv.getContext('2d');
    const g = c.createRadialGradient(64, 64, 2, 64, 64, 64);
    g.addColorStop(0, `rgba(${rgb},1)`);
    g.addColorStop(0.55, `rgba(${rgb},.5)`);
    g.addColorStop(1, `rgba(${rgb},0)`);
    c.fillStyle = g;
    c.fillRect(0, 0, 128, 128);
    return cv;
  }
  const NO_FX = { fog: 0, rain: 0, wind: 0, cold: 0 };
  let fogSprite = null;
  let glowSprite = null;

  /* 背景植被去飽和 15%，只有前景保留較深的綠 */
  function desaturate(h, amount) {
    const [r, g, b] = hex(h);
    const grey = 0.3 * r + 0.59 * g + 0.11 * b;
    const mix = (v) => Math.round(v + (grey - v) * amount);
    return css([mix(r), mix(g), mix(b)]);
  }
  const VEGETATION = {
    cedar: { dark: '#4f9a78', light: '#66b18c' },
    broadleaf: { dark: '#8cc97c', light: '#a8d98f' },
    fir: { dark: '#6f9c8a', light: '#83b09c' },
    fern: { dark: '#57a56c' },
    shrub: { dark: '#86c97f', light: '#a5da92' },
    cane: { dark: '#8fb85c', light: '#a9c76c' },
  };
  const CLEARABLE = new Set(['cedar', 'broadleaf', 'fir', 'fern', 'shrub', 'rock', 'mossrock', 'mushroom', 'cane', 'windgrass', 'flower']);
  const MARKER_CLEARANCE = 56;

  /* 事件位置每趟不同，開局時才把標記周圍的植被藏起來；前景近處的花草不會擋到標記 */
  function clearAroundEvents(decor, npcs, events) {
    const crowded = (x, range) => events.some((ev) => Math.abs(ev.x - x) < range);
    decor.forEach((it) => {
      it.hide = CLEARABLE.has(it.type) && it.oy < PATH_H + 40 && crowded(it.x, MARKER_CLEARANCE);
    });
    /* NPC 比植被寬，往後挪到離標記夠遠的地方 */
    npcs.forEach((n) => {
      if (n.homeX === undefined) n.homeX = n.x;
      n.x = n.homeX;
      for (let step = 1; step < 12 && crowded(n.x, MARKER_CLEARANCE + 34); step++) n.x = n.homeX + step * 50;
    });
  }

  /* 場景物件擺放 --------------------------------------------------- */
  function buildDecor() {
    const r = makeRng(20240601);
    const items = [];
    const add = (type, x, oy, s, extra) => items.push(Object.assign({ type, x, oy, s: s || 1, h: r.next() }, extra));
    const back = (lo, hi) => -r.range(lo, hi);
    const front = (lo, hi) => PATH_H + r.range(lo, hi);
    const bandFlowers = ['#ffb1c4', '#ffd965', '#fff', '#c9b6f2', '#ffc78f'];

    /* 登山口 */
    add('hut', 150, -30, 1);
    add('car', 330, -8, 1);
    add('parking', 248, -12, 0.95);
    add('gate', 590, -6, 1, { label: '登山口' });
    add('notice', 800, -8, 1);
    add('stagesign', 1040, -6, 0.95, { label: '往森林步道', sub: '海拔 1,900m' });
    for (let x = -100; x < 1400; x += r.range(60, 120)) {
      if (x > 50 && x < 400) continue;
      if (x > 480 && x < 700) continue;
      const kind = r.pick(['broadleaf', 'broadleaf', 'shrub', 'shrub', 'cedar']);
      add(kind, x, back(38, 86), r.range(0.55, 0.85));
    }
    for (let x = -60; x < 1400; x += r.range(30, 62)) {
      add('flower', x, front(8, 70), r.range(0.8, 1.2), { color: r.pick(bandFlowers) });
    }
    /* 登山口的近景花草，首頁手機版的下半部才不會空空的 */
    for (let x = 380; x < 1100; x += r.range(34, 72)) {
      const near = r.pick(['flower', 'flower', 'flower', 'fern']);
      add(near, x, front(72, 215), r.range(1.25, 1.9), { color: r.pick(bandFlowers) });
    }

    /* 森林 */
    const green = { dark: '#4c9a78', light: '#67b28e' };
    add('stagesign', 1420, -6, 1, { label: '森林步道', sub: '海拔 2,000m' });
    for (let x = 1320; x < 3280; x += r.range(58, 108)) {
      if (Math.abs(x - 1420) < 80) continue;
      add('cedar', x, back(12, 88), r.range(0.72, 1.28), green);
    }
    for (let x = 1400; x < 3200; x += r.range(32, 76)) {
      add(r.pick(['fern', 'fern', 'fern', 'mossrock', 'mushroom']), x, front(6, 62), r.range(0.8, 1.35));
    }
    for (let x = 1400; x < 3200; x += r.range(110, 230)) {
      add('fern', x, back(2, 10), r.range(0.7, 1), { dark: '#4f9e68' });
    }

    /* 稜線 */
    add('stagesign', 3220, -6, 1, { label: '稜線步道', sub: '海拔 2,800m' });
    /* 草叢 3–5 叢成組、組間留白，總量比原本少約三分之一 */
    const grassGroups = (gapLo, gapHi, placeY, types) => {
      let x = 3200 + r.range(0, 60);
      while (x < 4860) {
        const n = r.int(3, 5);
        const y = placeY();
        for (let i = 0; i < n; i++) {
          add(r.pick(types), x, y + r.range(-11, 11), r.range(0.78, 1.22));
          x += r.range(13, 25);
        }
        x += r.range(gapLo, gapHi);
      }
    };
    grassGroups(70, 130, () => back(16, 50), ['cane']);
    grassGroups(100, 170, () => front(16, 62), ['cane', 'windgrass', 'windgrass']);
    for (let x = 3300; x < 4800; x += r.range(140, 300)) {
      add('rock', x, r.next() < 0.5 ? back(10, 50) : front(10, 55), r.range(0.55, 1.05));
    }
    for (let x = 3500; x < 4700; x += r.range(280, 480)) {
      add('fir', x, back(50, 86), r.range(0.8, 1.1));
    }

    /* 山頂 */
    add('stagesign', 4830, -6, 1, { label: '山頂將至', sub: '海拔 3,300m' });
    add('trig', 5230, -6, 1.15);
    add('stele', 5370, -10, 1, { label: '山頂', sub: '3,420m' });
    for (let x = 4780; x < 5880; x += r.range(42, 92)) {
      if (Math.abs(x - 5300) < 130) continue;
      add(r.pick(['rock', 'rock', 'shrub', 'windgrass']), x, back(6, 62), r.range(0.45, 0.9), { dark: '#b8b5a6', light: '#d3cfc2' });
    }
    for (let x = 4780; x < 5880; x += r.range(42, 92)) {
      add(r.pick(['rock', 'windgrass', 'flower']), x, front(8, 70), r.range(0.55, 1), { color: '#fff', dark: '#b8b5a6', light: '#d3cfc2' });
    }

    /* 下山 */
    const dusk = { dark: '#8a7a6a', light: '#a08c73' };
    add('stagesign', 5850, -6, 1, { label: '下山路', sub: '腳步放慢' });
    add('cabin', 6640, -28, 1);
    add('bench', 6800, -6, 1.2);
    add('gate', FINISH_X + 60, -6, 1, { label: '平安下山' });
    for (let x = 5950; x < 7700; x += 250) {
      add('lantern', x, -6, 1);
      add('lantern', x + 125, PATH_H + 6, 0.92);
    }
    for (let x = 5900; x < 7900; x += r.range(58, 112)) {
      if (Math.abs(x - 6640) < 120 || Math.abs(x - FINISH_X - 60) < 130) continue;
      add(r.pick(['cedar', 'cedar', 'broadleaf']), x, back(34, 88), r.range(0.62, 1.05), dusk);
    }
    for (let x = 5900; x < 7900; x += r.range(32, 70)) {
      add(r.pick(['fern', 'shrub', 'rock']), x, front(14, 72), r.range(0.55, 1), { dark: '#94795c', light: '#a88c6c' });
    }
    items.forEach((it) => {
      const base = VEGETATION[it.type];
      if (!base || it.oy >= 0) return;
      it.dark = desaturate(it.dark || base.dark, 0.15);
      if (base.light) it.light = desaturate(it.light || base.light, 0.15);
    });
    return items;
  }

  function buildNpcs() {
    const hikerB = { jacket: '#7ec1dd', jacketDark: '#5fa6c4', pack: '#e8785c', packDark: '#c9624a', hat: '#c9b6f2', hatBand: '#8f7ac9' };
    const hikerC = { jacket: '#a9d98a', jacketDark: '#89c06c', pack: '#f4c76b', packDark: '#d8a94c', hat: '#ffb1c4', hatBand: '#e8785c', hair: '#2c2a2e' };
    return [
      { kind: 'hiker', x: 945, oy: 10, s: 0.9, dir: -1, colors: hikerB, say: '山友你好！記得留行程喔' },
      { kind: 'macaque', x: 1260, oy: -44, s: 0.82, dir: 1, say: '不要餵我喔！' },
      { kind: 'pheasant', x: 1960, oy: -14, s: 0.88, dir: 1, say: '我是藍腹鷴，別靠太近' },
      { kind: 'muntjac', x: 2710, oy: -18, s: 0.9, dir: -1, say: '（山羌好奇地看著你）' },
      { kind: 'hiker', x: 3560, oy: 8, s: 0.9, dir: 1, colors: hikerC, say: '稜線風大，把外套穿上吧' },
      { kind: 'muntjac', x: 4340, oy: -50, s: 0.76, dir: 1, say: '（遠遠看就好）' },
      { kind: 'hiker', x: 5460, oy: 2, s: 0.9, dir: -1, colors: hikerB, say: '雲海好美！別忘了下山時間' },
      { kind: 'pheasant', x: 5720, oy: -20, s: 0.78, dir: -1, say: '咕咕～' },
      { kind: 'bear', x: 6330, oy: -72, s: 0.62, dir: 1, say: '遠方有黑熊，保持距離、慢慢走' },
      { kind: 'macaque', x: 6980, oy: -40, s: 0.8, dir: -1, say: '垃圾要帶下山喔！' },
    ];
  }

  /* 依所選山岳換路牌文字與海拔；傳 null 回到原版路線 */
  const ORIGINAL_SIGN = new WeakMap();
  function applyRoute(decor, route) {
    decor.forEach((it) => {
      if (it.type !== 'stagesign' && it.type !== 'stele') return;
      if (!ORIGINAL_SIGN.has(it)) ORIGINAL_SIGN.set(it, { label: it.label, sub: it.sub });
      const orig = ORIGINAL_SIGN.get(it);
      if (!route) {
        Object.assign(it, orig);
        return;
      }
      const label = orig.label.replace('森林步道', route.forestLabel);
      it.label = label;
      if (it.type === 'stele') it.sub = `${route.summit.toLocaleString('en-US')}m`;
      else if (orig.sub.startsWith('海拔')) it.sub = `海拔 ${(Math.round(route.altitudeAt(it.x) / 10) * 10).toLocaleString('en-US')}m`;
    });
  }

  /* 背景層 --------------------------------------------------------- */
  function ridgeHeight(x, seed, sharp) {
    const a = 1 - Math.abs(Math.sin(x * 0.0023 + seed));
    const b = 1 - Math.abs(Math.sin(x * 0.0061 + seed * 2.3));
    const s = (Math.sin(x * 0.019 + seed * 4) + 1) / 2;
    return sharp ? 0.62 * a + 0.28 * b + 0.1 * s : 0.5 * (Math.sin(x * 0.0037 + seed) + 1) / 2 + 0.34 * (Math.sin(x * 0.0091 + seed) + 1) / 2 + 0.16 * s;
  }

  function mountains(c, L, camX, par, seed, baseY, amp, col, haze, sharp) {
    const off = camX * par;
    c.beginPath();
    c.moveTo(-20, L.vh + 300);
    for (let sx = -20; sx <= L.vw + 22; sx += 14) {
      c.lineTo(sx, baseY - amp * ridgeHeight(sx + off, seed, sharp));
    }
    c.lineTo(L.vw + 22, L.vh + 300);
    c.closePath();
    const g = c.createLinearGradient(0, baseY - amp, 0, baseY + 30);
    g.addColorStop(0, css(col));
    g.addColorStop(1, css(haze));
    c.fillStyle = g;
    c.fill();
  }

  function cloud(c, x, y, s, col, alpha) {
    c.globalAlpha = alpha;
    A.ell(c, x, y, 58 * s, 19 * s, col);
    A.ell(c, x - 34 * s, y + 3 * s, 30 * s, 13 * s, col);
    A.ell(c, x + 37 * s, y + 3 * s, 34 * s, 14 * s, col);
    A.ell(c, x + 3 * s, y - 13 * s, 30 * s, 19 * s, col);
    c.globalAlpha = 1;
  }

  function clouds(c, L, g, pal, horizon) {
    const col = css(pal.cloud);
    const wrap = L.vw + 400;
    for (let i = 0; i < 7; i++) {
      const speed = 3 + hash(i) * 5;
      const raw = hash(i + 10) * 4000 + g.t * speed - g.cam.x * (0.1 + hash(i + 20) * 0.08);
      const x = ((raw % wrap) + wrap) % wrap - 200;
      const y = horizon * (0.18 + hash(i + 30) * 0.5);
      cloud(c, x, y, 0.6 + hash(i + 40) * 0.75, col, 0.8);
    }
  }

  function sun(c, L, w, horizon, risk, fx) {
    const px = w[0] * 0.8 + w[1] * 0.74 + w[2] * 0.66 + w[3] * 0.32 + w[4] * 0.76;
    const py = w[0] * 0.24 + w[1] * 0.2 + w[2] * 0.26 + w[3] * 0.78 + w[4] * 0.74;
    const big = 36 + (w[3] + w[4]) * 20;
    const x = L.vw * px;
    const y = horizon * py;
    /* 下雨起霧時雲層遮住太陽，不只看風險 */
    const covered = fx ? Math.max(fx.rain, fx.fog * 0.7) : 0;
    const dim = (1 - smooth(30, 90, risk) * 0.82) * (1 - covered * 0.92);
    const core = [255, 236 - w[4] * 62 - w[3] * 22, 170 - w[4] * 60 - w[3] * 30];
    c.globalAlpha = 0.62 * dim;
    const size = big * 6;
    c.drawImage(glowSprite, x - size / 2, y - size / 2, size, size);
    c.globalAlpha = dim;
    A.ell(c, x, y, big, big, css(core));
    c.globalAlpha = 1;
  }

  function cloudSea(c, L, camX, baseY, col, alpha, t) {
    if (alpha < 0.02) return;
    c.globalAlpha = alpha;
    c.fillStyle = css(col);
    const off = camX * 0.22 + t * 3;
    const step = 56;
    const start = Math.floor(off / step) - 2;
    for (let i = start; i < start + L.vw / step + 5; i++) {
      const r = 30 + hash(i) * 34;
      c.beginPath();
      c.arc(i * step - off, baseY + Math.sin(i * 0.8 + t * 0.2) * 6, r, 0, TAU);
      c.fill();
    }
    c.fillRect(-20, baseY, L.vw + 40, L.vh + 300);
    c.globalAlpha = 1;
  }

  /* 中景的樹影，森林與下山路才看得到 */
  function treeline(c, L, camX, baseY, col, alpha) {
    if (alpha < 0.02) return;
    c.globalAlpha = alpha;
    c.fillStyle = css(col);
    const par = 0.62;
    const off = camX * par;
    const step = 46;
    const start = Math.floor(off / step) - 3;
    for (let i = start; i < start + L.vw / step + 7; i++) {
      const x = i * step - off + hash(i) * 20;
      const h = 80 + hash(i + 7) * 100;
      const y = baseY + 10;
      c.beginPath();
      c.moveTo(x - 25, y);
      c.quadraticCurveTo(x - 13, y - h * 0.5, x - 4, y - h + 4);
      c.quadraticCurveTo(x, y - h - 3, x + 4, y - h + 4);
      c.quadraticCurveTo(x + 13, y - h * 0.5, x + 25, y);
      c.closePath();
      c.fill();
    }
    c.globalAlpha = 1;
  }

  /* 稜線的色彩層次：草坡深淺帶、坡頂暖光 ------------------------------------ */
  function ridgeSlope(c, L, g) {
    const k = ridgeZone(g.cam.x);
    if (k < 0.02) return;
    const left = g.cam.x - L.vw / 2;
    const step = 18;
    [[0.72, 'rgba(120,170,88,.26)', 1.3], [0.46, 'rgba(92,150,80,.3)', 2.9], [0.22, 'rgba(70,128,72,.32)', 4.7]].forEach(([f, col, ph]) => {
      c.globalAlpha = k;
      c.beginPath();
      c.moveTo(-20, pathTop(L, left - 20) + 6);
      for (let sx = -20; sx <= L.vw + 22; sx += step) {
        const x = left + sx;
        c.lineTo(sx, pathTop(L, x) - hillRise(x) * f + Math.sin(x * 0.0071 + ph) * 7);
      }
      c.lineTo(L.vw + 22, pathTop(L, left + L.vw + 22) + 6);
      c.closePath();
      c.fillStyle = col;
      c.fill();
    });
    /* 坡頂被斜陽鑲上一道暖邊 */
    c.beginPath();
    for (let sx = -20; sx <= L.vw + 22; sx += step) {
      const x = left + sx;
      const y = pathTop(L, x) - hillRise(x);
      if (sx === -20) c.moveTo(sx, y);
      else c.lineTo(sx, y);
    }
    c.globalAlpha = k * 0.85;
    c.strokeStyle = '#ffe9b0';
    c.lineWidth = 3.5;
    c.lineJoin = 'round';
    c.stroke();
    c.globalAlpha = 1;
  }

  /* 地面 ----------------------------------------------------------- */
  function ground(c, L, g, pal) {
    const camX = g.cam.x;
    const left = camX - L.vw / 2;
    const step = 14;
    const bottom = L.vh + 300;

    c.beginPath();
    c.moveTo(-20, bottom);
    for (let sx = -20; sx <= L.vw + 22; sx += step) {
      const x = left + sx;
      c.lineTo(sx, pathTop(L, x) - hillRise(x));
    }
    c.lineTo(L.vw + 22, bottom);
    c.closePath();
    const gb = c.createLinearGradient(0, L.base - 120, 0, L.base + 10);
    gb.addColorStop(0, css(pal.bank));
    gb.addColorStop(1, css(pal.bank2));
    c.fillStyle = gb;
    c.fill();
    ridgeSlope(c, L, g);

    c.beginPath();
    c.moveTo(-20, bottom);
    for (let sx = -20; sx <= L.vw + 22; sx += step) c.lineTo(sx, pathTop(L, left + sx) + PATH_H);
    c.lineTo(L.vw + 22, bottom);
    c.closePath();
    const gf = c.createLinearGradient(0, L.base + PATH_H, 0, L.vh + 40);
    gf.addColorStop(0, css(pal.front));
    gf.addColorStop(1, css(pal.front2));
    c.fillStyle = gf;
    c.fill();

    /* 小溪：只在森林段，從上坡穿過步道下方流到前景 */
    const sx0 = 2360 - left;
    if (sx0 > -200 && sx0 < L.vw + 200) streamAndBridge(c, L, sx0, g.t);

    /* 步道 */
    c.beginPath();
    for (let sx = -20; sx <= L.vw + 22; sx += step) {
      const y = pathTop(L, left + sx);
      if (sx === -20) c.moveTo(sx, y);
      else c.lineTo(sx, y);
    }
    for (let sx = L.vw + 22; sx >= -20; sx -= step) c.lineTo(sx, pathTop(L, left + sx) + PATH_H);
    c.closePath();
    c.fillStyle = css(pal.path);
    c.fill();

    if (sx0 > -200 && sx0 < L.vw + 200) bridgeDeck(c, L, sx0);

    [0, PATH_H].forEach((dy) => {
      c.beginPath();
      for (let sx = -20; sx <= L.vw + 22; sx += step) {
        const y = pathTop(L, left + sx) + dy;
        if (sx === -20) c.moveTo(sx, y);
        else c.lineTo(sx, y);
      }
      c.strokeStyle = css(pal.pathEdge);
      c.lineWidth = 4;
      c.stroke();
    });

    /* 路面小石頭與踏痕（鎖在世界座標） */
    c.fillStyle = css(pal.pathEdge);
    const pStep = 38;
    const first = Math.floor(left / pStep) - 1;
    for (let i = first; i < first + L.vw / pStep + 3; i++) {
      const x = i * pStep + hash(i) * 26;
      if (Math.abs(x - 2360) < 62) continue;
      const y = pathTop(L, x) + 14 + hash(i + 3) * (PATH_H - 28);
      const r = 2 + hash(i + 5) * 3.4;
      c.globalAlpha = 0.34;
      c.beginPath();
      c.ellipse(x - left, y, r * 1.5, r, 0, 0, TAU);
      c.fill();
    }
    c.globalAlpha = 1;
  }

  function streamAndBridge(c, L, sx, t) {
    const x = sx;
    const top = L.base - 90;
    const bottom = L.vh + 300;
    c.beginPath();
    c.moveTo(x - 34, top);
    for (let y = top; y <= bottom; y += 26) c.lineTo(x - 42 + Math.sin(y * 0.03) * 14 + (y - top) * 0.03, y);
    for (let y = bottom; y >= top; y -= 26) c.lineTo(x + 44 + Math.sin(y * 0.03) * 14 + (y - top) * 0.06, y);
    c.closePath();
    c.fillStyle = '#9edbef';
    c.fill();
    c.strokeStyle = 'rgba(255,255,255,.72)';
    c.lineWidth = 2.5;
    c.lineCap = 'round';
    for (let i = 0; i < 9; i++) {
      const y = top + ((i * 56 + t * 34) % (bottom - top > 500 ? 500 : bottom - top));
      const ox = Math.sin(i * 2.3) * 20;
      c.beginPath();
      c.moveTo(x + ox - 9, y);
      c.quadraticCurveTo(x + ox, y + 4, x + ox + 9, y);
      c.stroke();
    }
  }

  function bridgeDeck(c, L, sx) {
    const left = sx - 66;
    const worldLeft = 2360 - 66;
    const yT = pathTop(L, worldLeft + 66) - 2;
    A.box(c, left, yT, 132, PATH_H + 4, 4, '#b98a60');
    for (let i = 0; i < 8; i++) {
      A.box(c, left + 3 + i * 16.2, yT + 3, 14, PATH_H - 2, 3, i % 2 ? '#c99a6e' : '#d2a579');
    }
  }

  function grassEdge(c, L, g, pal) {
    const left = g.cam.x - L.vw / 2;
    const step = 24;
    const first = Math.floor(left / step) - 1;
    c.strokeStyle = css(pal.front2);
    c.lineWidth = 2.6;
    c.lineCap = 'round';
    c.beginPath();
    for (let i = first; i < first + L.vw / step + 3; i++) {
      const wx = i * step + hash(i) * 10;
      if (Math.abs(wx - 2360) < 70) continue;
      /* 一段有草、一段留白，邊緣才不會像梳子 */
      if (Math.sin(i * 0.53) + hash(i + 11) * 0.7 < 0.1) continue;
      const sx = wx - left;
      const y = pathTop(L, wx) + PATH_H + 2;
      const h = 7 + hash(i + 2) * 8;
      c.moveTo(sx, y);
      c.lineTo(sx - 3, y - h);
      c.moveTo(sx, y);
      c.lineTo(sx + 3, y - h * 0.85);
    }
    c.stroke();
  }

  /* 純裝飾前景葉片：視差 1.08–1.15，只長在左右下角。
     越靠畫面中央越小直到消失，不會擋到角色、事件或按鈕。 */
  function leaf(c, len, wid, col) {
    c.beginPath();
    c.moveTo(0, 0);
    c.quadraticCurveTo(-wid, -len * 0.55, 0, -len);
    c.quadraticCurveTo(wid, -len * 0.55, 0, 0);
    c.closePath();
    c.fillStyle = col;
    c.fill();
  }
  function foreground(c, L, g, pal) {
    const y = L.vh - (g.bottomSafe || 0) + 8;
    const reach = Math.min(L.vw * 0.2, 190);
    [[1.08, 118, 0], [1.15, 156, 40]].forEach(([par, step, seed]) => {
      const off = g.cam.x * par;
      const first = Math.floor(off / step) - 1;
      const col = css(par > 1.1 ? pal.front2 : pal.front);
      for (let i = first; i < first + L.vw / step + 3; i++) {
        const x = i * step - off + hash(i + seed) * step * 0.6;
        const edge = Math.min(x, L.vw - x);
        const size = 1 - smooth(reach * 0.25, reach, edge);
        if (size < 0.04) continue;
        const n = 3 + Math.floor(hash(i + seed + 4) * 2.5);
        const tall = (par > 1.1 ? 74 : 56) * (0.8 + hash(i + seed + 8) * 0.4) * size;
        for (let k = 0; k < n; k++) {
          c.save();
          c.translate(x + (k - (n - 1) / 2) * 6, y);
          c.rotate((k - (n - 1) / 2) * 0.36 + Math.sin(g.t * 0.9 + i) * 0.025);
          leaf(c, tall, Math.max(5, tall * 0.2), col);
          c.restore();
        }
      }
    });
  }

  /* 飄動的小生物與天氣 -------------------------------------------------- */
  function ambient(c, L, g, w) {
    const left = g.cam.x - L.vw / 2;
    const t = g.t;

    const flyWeight = w[0] * 0.7 + w[1];
    if (flyWeight > 0.05) {
      const colors = ['#ffb1c4', '#ffd965', '#c9b6f2', '#fff', '#8fd3f4'];
      c.globalAlpha = Math.min(1, flyWeight);
      for (let i = 0; i < 9; i++) {
        const wx = 400 + i * 310 + Math.sin(t * 0.33 + i * 2) * 95;
        const sx = wx - left;
        if (sx < -30 || sx > L.vw + 30) continue;
        const y = L.base - 54 + Math.sin(t * 1.1 + i) * 24 + hash(i) * 110;
        A.drawButterfly(c, sx, y, 1.15, t + i, colors[i % colors.length]);
      }
      c.globalAlpha = 1;
    }

    if (w[0] > 0.2 || w[2] > 0.2) {
      c.strokeStyle = 'rgba(70,70,90,.5)';
      c.lineWidth = 2;
      c.lineCap = 'round';
      for (let i = 0; i < 4; i++) {
        const x = (((t * 24 + i * 300 - g.cam.x * 0.15) % (L.vw + 80)) + L.vw + 80) % (L.vw + 80) - 40;
        const y = L.base * (0.26 + hash(i) * 0.26);
        const f = Math.sin(t * 7 + i) * 4;
        c.beginPath();
        c.moveTo(x - 8, y - f);
        c.quadraticCurveTo(x - 4, y - 3, x, y);
        c.quadraticCurveTo(x + 4, y - 3, x + 8, y - f);
        c.stroke();
      }
    }

    if (w[2] + w[3] > 0.1) {
      c.strokeStyle = `rgba(255,255,255,${0.44 * Math.min(1, w[2] + w[3] * 0.7)})`;
      c.lineWidth = 2;
      c.lineCap = 'round';
      for (let i = 0; i < 14; i++) {
        const span = L.vw + 240;
        const x = span - ((t * (200 + hash(i) * 200) + hash(i + 3) * 2000) % span) - 120;
        const y = L.base * 0.5 + hash(i + 8) * L.base * 0.75;
        const len = 30 + hash(i + 9) * 46;
        c.beginPath();
        c.moveTo(x, y);
        c.quadraticCurveTo(x + len / 2, y - 4, x + len, y + 1);
        c.stroke();
      }
    }

    if (w[4] > 0.15) {
      for (let i = 0; i < 18; i++) {
        const wx = 5900 + i * 95 + Math.sin(t * 0.5 + i) * 34;
        const sx = wx - left;
        if (sx < -20 || sx > L.vw + 20) continue;
        const y = L.base - 40 + hash(i) * 180 + Math.sin(t * 0.9 + i * 2) * 15;
        const a = (Math.sin(t * 2.2 + i * 1.7) + 1) / 2;
        c.globalAlpha = w[4] * a * 0.85;
        c.drawImage(glowSprite, sx - 11, y - 11, 22, 22);
        A.ell(c, sx, y, 1.9, 1.9, '#fff3b5');
      }
      c.globalAlpha = 1;
    }
  }

  function weather(c, L, g, risk) {
    const t = g.t;
    const fx = g.fx || NO_FX;
    const fog = Math.max(smooth(28, 95, risk), fx.fog * 0.48);
    if (fog > 0.01) {
      for (let i = 0; i < 9; i++) {
        const span = L.vw + 700;
        const raw = i * 380 + t * (8 + i * 2.2) - g.cam.x * 0.45;
        const x = ((raw % span) + span) % span - 350;
        const y = L.base - 170 + (i % 4) * 92 + Math.sin(t * 0.3 + i) * 14;
        const size = 430 + (i % 3) * 130;
        c.globalAlpha = 0.62 * fog;
        c.drawImage(fogSprite, x - size / 2, y - size * 0.3, size, size * 0.6);
      }
      c.globalAlpha = 1;
    }
    const rain = Math.max(smooth(62, 92, risk), fx.rain * 0.72);
    if (rain > 0.01) {
      c.strokeStyle = `rgba(214,230,244,${0.55 * rain})`;
      c.lineWidth = 1.5;
      c.lineCap = 'round';
      c.beginPath();
      for (let i = 0; i < 70; i++) {
        const sx = (hash(i) * L.vw * 1.2 + t * 90) % (L.vw * 1.2) - L.vw * 0.1;
        const sy = (hash(i + 90) * L.vh + t * (560 + hash(i + 40) * 240)) % L.vh;
        c.moveTo(sx, sy);
        c.lineTo(sx - 4, sy + 15);
      }
      c.stroke();
    }
    if (fx.wind > 0.01) {
      c.strokeStyle = `rgba(255,255,255,${0.5 * fx.wind})`;
      c.lineWidth = 2;
      c.lineCap = 'round';
      c.beginPath();
      for (let i = 0; i < 12; i++) {
        const span = L.vw + 300;
        const sx = (hash(i + 7) * span + t * (240 + hash(i) * 120)) % span - 150;
        const sy = hash(i + 31) * L.base * 0.95 + Math.sin(t * 2 + i) * 6;
        const len = 40 + hash(i + 3) * 60;
        c.moveTo(sx, sy);
        c.quadraticCurveTo(sx + len * 0.5, sy - 5, sx + len, sy);
      }
      c.stroke();
    }
    if (fx.cold > 0.01) {
      c.fillStyle = `rgba(158,196,236,${0.16 * fx.cold})`;
      c.fillRect(-40, -40, L.vw + 80, L.vh + 400);
    }
  }

  function vignette(c, L, risk) {
    const v = smooth(35, 100, risk);
    if (v < 0.01) return;
    const r = Math.max(L.vw, L.vh) * 0.82;
    const g = c.createRadialGradient(L.vw / 2, L.vh * 0.55, r * 0.34, L.vw / 2, L.vh * 0.55, r);
    g.addColorStop(0, 'rgba(32,36,58,0)');
    g.addColorStop(1, `rgba(32,36,58,${0.64 * v})`);
    c.fillStyle = g;
    c.fillRect(-20, -20, L.vw + 40, L.vh + 40);
  }

  /* 事件點 --------------------------------------------------------- */
  /* 保命題換紅框、暖色底與救生圈，走路時一眼就能分辨 */
  function markerStyle(scenario, isNext) {
    if (scenario.key) {
      return { frame: isNext ? '#e5484d' : '#efa79c', fill: '#fff3e6', icon: 'lifebuoy', pill: '#c9362f', iconAlpha: isNext ? 1 : 0.8 };
    }
    return { frame: isNext ? '#ee8549' : '#d9cbb2', fill: '#fffdf6', icon: A.markerIcon(scenario.category, scenario.title), pill: '#bd542b', iconAlpha: isNext ? 1 : 0.62 };
  }

  function eventMarker(c, ev, x, y, t, isNext, near) {
    if (ev.done) {
      if (ev.correct) A.drawFlower(c, x, y - 6, 8, '#ffb1c4', ev.x);
      else A.ell(c, x, y - 2, 7, 4.5, 'rgba(120,110,100,.5)');
      return;
    }
    A.ell(c, x, y + 1, 22, 6, 'rgba(60,50,40,.17)');
    let topY = y - 62;
    if (ev.marker === 'stele') {
      c.save();
      c.translate(x, y);
      A.decor.rock(c, 0.72, t, { dark: '#c1bdb0', light: '#d9d6ca' });
      c.restore();
      c.save();
      c.translate(x, y);
      A.box(c, -11, -38, 22, 38, 8, '#d9d6ca');
      c.restore();
      topY = y - 54;
    } else if (ev.marker === 'animal') {
      A.drawAnimal(c, ev.animal, x, y, 0.82, t, -1);
      topY = y - (ev.animal === 'muntjac' ? 82 : 66);
    } else {
      A.box(c, x - 3.5, y - 44, 7, 44, 2, '#a4714c');
    }

    /* 只有下一個事件上下浮動；之後的事件安靜地待著 */
    const bob = isNext ? Math.sin(t * 2.2 + ev.x) * 3 : 0;
    const style = markerStyle(ev.scenario, isNext);
    const frame = style.frame;
    const bx = x;
    const by = topY - 21 + bob;
    if (near) {
      /* 靠近時：腳下一圈光，再加「查看」 */
      c.globalAlpha = 0.6;
      c.drawImage(glowSprite, x - 58, y - 26, 116, 52);
      c.globalAlpha = 1;
      c.beginPath();
      c.ellipse(x, y + 1, 31, 10, 0, 0, TAU);
      c.strokeStyle = '#ffd27a';
      c.lineWidth = 3.5;
      c.stroke();
    }
    c.save();
    c.translate(bx, by);
    A.poly(c, [-8, 18, 8, 18, 0, 29], frame);
    A.ell(c, 0, 0, 24, 24, frame);
    A.ell(c, 0, 0, 19.5, 19.5, style.fill);
    c.globalAlpha = style.iconAlpha;
    A.icons[style.icon](c);
    c.globalAlpha = 1;
    c.restore();
    if (near) {
      /* 觸控只留右下主鈕一個入口；鍵盤與滑鼠仍用這個標籤提示 */
      if (!document.body.classList.contains('touch')) {
        A.box(c, bx - 26, by - 53, 52, 23, 11.5, style.pill);
        A.text(c, '查看', bx, by - 41, 14, '#fff', 700);
      }
    }
  }

  /* 主要繪製 --------------------------------------------------------- */
  function render(c, L, g) {
    if (!fogSprite) {
      fogSprite = softSprite('226,232,240');
      glowSprite = softSprite('255,232,170');
    }
    A.viewZ = L.z;
    const w = blendAt(g.cam.x);
    const fx = g.fx || NO_FX;
    /* 雨霧讓天色偏灰；風險高時既有的暴風雨天色照舊 */
    const pal = paletteFor(w, Math.max(g.riskView, fx.rain * 58, fx.fog * 44));
    const t = g.t;
    const camX = g.cam.x;

    c.save();
    c.translate(g.shake.x, g.shake.y - g.lift);

    /* 天空要蓋住上抬與搖晃露出的邊 */
    const sky = c.createLinearGradient(0, 0, 0, L.base);
    sky.addColorStop(0, css(pal.sky1));
    sky.addColorStop(1, css(pal.sky2));
    c.fillStyle = sky;
    c.fillRect(-40, -40, L.vw + 80, L.vh + 400);

    const horizon = L.base - 34;
    sun(c, L, w, horizon, g.riskView, g.fx);
    clouds(c, L, g, pal, horizon);
    const tallness = Math.max(1, L.vh / 640);
    mountains(c, L, camX, 0.08, 1.3, horizon, 210 * tallness, pal.far, pal.sky2, true);
    cloudSea(c, L, camX * 0.5, horizon - 18, pal.cloud, w[3] * 0.92, t);
    /* 稜線：雲海夾在遠山之間，再從太陽那側灑一層暖光 */
    cloudSea(c, L, camX * 0.5, horizon - 30, pal.cloud, w[2] * 0.78, t);
    mountains(c, L, camX, 0.18, 3.1, horizon + 18, 128 * tallness, pal.mid, pal.far, true);
    cloudSea(c, L, camX, horizon + 8, pal.cloud, w[2] * 0.9, t + 60);
    if (w[2] > 0.02) {
      const dim = 1 - smooth(30, 90, g.riskView) * 0.85;
      const size = Math.max(L.vw, L.vh) * 1.5;
      c.globalAlpha = w[2] * 0.34 * dim;
      c.drawImage(glowSprite, L.vw * 0.66 - size / 2, horizon * 0.5 - size / 2, size, size);
      c.globalAlpha = 1;
    }
    cloudSea(c, L, camX, horizon + 34, pal.cloud, w[3] * 0.96, t + 30);
    treeline(c, L, camX, horizon - 8, pal.near, w[1] * 0.9 + w[4] * 0.8 + w[0] * 0.25);
    mountains(c, L, camX, 0.4, 5.7, horizon + 44, 52, pal.near, pal.mid, false);

    ground(c, L, g, pal);
    grassEdge(c, L, g, pal);

    /* 物件依前後排序，登山客才會正確地被遮或遮別人 */
    const left = camX - L.vw / 2;
    const margin = 240;
    const list = [];
    for (const it of g.decor) {
      const sx = it.x - left;
      if (it.hide || sx < -margin || sx > L.vw + margin) continue;
      list.push({ y: pathTop(L, it.x) + it.oy, it, sx });
    }
    for (const n of g.npcs) {
      const sx = n.x - left;
      if (sx < -80 || sx > L.vw + 80) continue;
      list.push({ y: pathTop(L, n.x) + n.oy, npc: n, sx });
    }
    g.events.forEach((ev, i) => {
      const sx = ev.x - left;
      if (sx < -80 || sx > L.vw + 80) return;
      list.push({ y: playerY(L, ev.x, ev.d), ev, sx, isNext: i === g.eventIndex });
    });
    const p = g.player;
    list.push({ y: playerY(L, p.x, p.d), player: true, sx: p.x - left });
    list.sort((a, b) => a.y - b.y);

    if (g.walkTarget) {
      const sx = g.walkTarget.x - left;
      const y = playerY(L, g.walkTarget.x, g.walkTarget.d);
      const pulse = (t * 2) % 1;
      c.strokeStyle = `rgba(255,253,246,${0.9 * (1 - pulse)})`;
      c.lineWidth = 3;
      c.beginPath();
      c.ellipse(sx, y, 7 + pulse * 22, 3 + pulse * 9, 0, 0, TAU);
      c.stroke();
    }

    for (const e of list) {
      if (e.it) {
        const fn = A.decor[e.it.type];
        c.save();
        c.translate(e.sx, e.y);
        fn(c, e.it.s, t, e.it);
        c.restore();
      } else if (e.npc) {
        const n = e.npc;
        if (n.kind === 'hiker') {
          A.drawHiker(c, e.sx, e.y, { t, scale: n.s, dir: n.dir, colors: n.colors, pose: n.pose, blinkSeed: n.x * 0.37 });
        } else {
          A.drawAnimal(c, n.kind, e.sx, e.y, n.s, t + n.x, n.dir);
        }
      } else if (e.ev) {
        eventMarker(c, e.ev, e.sx, e.y, t, e.isNext, e.isNext && g.nearEvent);
      } else {
        const depth = 0.92 + p.d * 0.12;
        A.drawHiker(c, e.sx, e.y, {
          t, scale: depth * (g.heroScale || 1), dir: p.dir, risk: g.riskView, phase: p.phase, moving: p.moving, pose: p.pose, jump: p.jump, outfit: g.outfit,
          body: g.body,
        });
      }
    }

    ambient(c, L, g, w);

    /* NPC 對話與玩家的小泡泡 */
    if (g.npcSpeech) {
      const n = g.npcSpeech;
      const headH = n.kind === 'hiker' ? 112 : 84;
      A.speech(c, clamp(n.x - left, 110, L.vw - 110), pathTop(L, n.x) + n.oy - headH * n.s, n.say);
    }
    if (p.say) {
      A.speech(c, clamp(p.x - left, 90, L.vw - 90), playerY(L, p.x, p.d) - 122 - p.jump, p.say);
    }

    /* 粒子 */
    for (const q of g.particles) {
      const sx = q.x - left;
      const fade = Math.min(1, q.life / 0.4);
      c.globalAlpha = fade;
      if (q.kind === 'flower') A.drawFlower(c, sx, q.y, q.r, q.color, q.rot);
      else if (q.kind === 'text') {
        c.save();
        c.font = `700 ${q.size}px ${A.FONT}`;
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        c.lineJoin = 'round';
        c.lineWidth = 5;
        c.strokeStyle = 'rgba(255,253,246,.95)';
        const ty = Math.max(q.y, g.lift + (g.topSafe || 0));
        const tx = clamp(sx, 90, L.vw - 90);
        c.strokeText(q.text, tx, ty);
        c.fillStyle = q.color;
        c.fillText(q.text, tx, ty);
        c.restore();
      }
      c.globalAlpha = 1;
    }

    weather(c, L, g, g.riskView);
    c.restore();

    /* 前景貼著螢幕下緣，不跟著鏡頭上抬 */
    foreground(c, L, g, pal);
    vignette(c, L, g.riskView);
    if (g.flash > 0) {
      c.fillStyle = `rgba(255,255,255,${g.flash})`;
      c.fillRect(0, 0, L.vw, L.vh);
    }
  }

  DH.world = {
    PATH_H, makeLayout, pathTop, playerY, buildDecor, buildNpcs, clearAroundEvents, applyRoute, render, FINISH_X, markerStyle,
  };
})();
