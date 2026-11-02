/* 所有角色、動物、場景物件與結局插圖，全部用 Canvas 程式繪製。座標原點在腳底。 */
(function () {
  const DH = (window.DH = window.DH || {});
  const TAU = Math.PI * 2;
  /* Canvas 與 DOM 共用 style.css 的 --font，兩邊不會各自漂移 */
  const FONT = getComputedStyle(document.documentElement).getPropertyValue('--font').trim() || 'sans-serif';
  const motionQuery = matchMedia('(prefers-reduced-motion: reduce)');
  const reducedMotion = () => motionQuery.matches;
  const frac = (v) => v - Math.floor(v);

  function rr(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }
  function ell(c, x, y, rx, ry, color, rot) {
    c.beginPath();
    c.ellipse(x, y, rx, ry, rot || 0, 0, TAU);
    if (color) { c.fillStyle = color; c.fill(); }
  }
  function box(c, x, y, w, h, r, color) {
    rr(c, x, y, w, h, r);
    c.fillStyle = color;
    c.fill();
  }
  function line(c, x1, y1, x2, y2, color, width) {
    c.beginPath();
    c.moveTo(x1, y1);
    c.lineTo(x2, y2);
    c.strokeStyle = color;
    c.lineWidth = width;
    c.lineCap = 'round';
    c.stroke();
  }
  function poly(c, pts, color) {
    c.beginPath();
    c.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]);
    c.closePath();
    c.fillStyle = color;
    c.fill();
  }
  function text(c, str, x, y, size, color, weight) {
    c.font = `${weight || 700} ${size}px ${FONT}`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillStyle = color;
    c.fillText(str, x, y);
  }
  function shadow(c, rx, ry) {
    ell(c, 0, 1, rx, ry, 'rgba(60,50,40,.17)');
  }
  function drop(c, x, y, s) {
    c.beginPath();
    c.moveTo(x, y - 5 * s);
    c.quadraticCurveTo(x + 4.4 * s, y + 1 * s, x, y + 3.6 * s);
    c.quadraticCurveTo(x - 4.4 * s, y + 1 * s, x, y - 5 * s);
    c.fillStyle = '#8fd3f4';
    c.fill();
  }

  const HIKER_COLORS = {
    jacket: '#f59e6c', jacketDark: '#dd8353', pants: '#55637a', boots: '#8a5a3b',
    pack: '#4fb3a5', packDark: '#3c978b', roll: '#fbeed2', hat: '#f4c76b', hatBand: '#e8785c',
    skin: '#ffe0c2', hair: '#5a3d2b',
  };

  function hikerFace(c, risk, pose, t, o) {
    const seed = o.blinkSeed || 0;
    const period = 3.1 + frac(seed * 0.73) * 1.8;
    const blink = !reducedMotion() && (t + seed) % period < 0.12;
    const worried = risk >= 60;
    [1, 19].forEach((ex) => {
      if (blink || pose === 'cheer') {
        c.beginPath();
        if (pose === 'cheer') c.arc(ex, 3, 5, Math.PI * 1.15, Math.PI * 1.85);
        else { c.moveTo(ex - 5, 2); c.lineTo(ex + 5, 2); }
        c.strokeStyle = '#3a3028';
        c.lineWidth = 2.4;
        c.lineCap = 'round';
        c.stroke();
        return;
      }
      ell(c, ex, 2, 5.4, 7, '#3a3028');
      ell(c, ex + 1.6, -0.8, 2.1, 2.5, '#fff');
      if (o.detail) ell(c, ex - 1.5, 4.8, 1, 1.2, 'rgba(255,255,255,.75)');
    });
    if (worried) {
      line(c, -5, -8, 2, -10.5, '#5a3d2b', 2);
      line(c, 25, -8, 18, -10.5, '#5a3d2b', 2);
    }
    ell(c, -8, 11, 6, 3.7, 'rgba(255,135,135,.55)');
    ell(c, 25, 11, 5, 3.7, 'rgba(255,135,135,.55)');

    c.beginPath();
    c.strokeStyle = '#7a3e32';
    c.lineWidth = 2;
    c.lineCap = 'round';
    if (pose === 'cheer') {
      c.moveTo(4, 10);
      c.quadraticCurveTo(10, 21, 16, 10);
      c.closePath();
      c.fillStyle = '#e8605c';
      c.fill();
    } else if (pose === 'stumble') {
      ell(c, 10, 13, 3.2, 4, '#7a3e32');
    } else if (worried) {
      c.moveTo(5, 15);
      c.quadraticCurveTo(7.5, 11, 10, 14);
      c.quadraticCurveTo(12.5, 17, 15, 13);
      c.stroke();
    } else if (risk >= 35) {
      c.moveTo(6, 13.5);
      c.lineTo(14, 13.5);
      c.stroke();
    } else {
      c.moveTo(5, 11);
      c.quadraticCurveTo(10, 17, 15, 11);
      c.stroke();
    }
  }

  /* 主角帽子上的小山形徽章 */
  function hatBadge(c, x, y) {
    ell(c, x, y, 7.4, 7.4, '#fffdf6');
    poly(c, [x - 5.4, y + 3.8, x - 0.6, y - 4.6, x + 1.4, y - 1.2, x + 2.4, y - 2.6, x + 5.6, y + 3.8], '#4f9a78');
    poly(c, [x - 2.1, y - 2, x - 0.6, y - 4.6, x + 0.9, y - 2], '#fffdf6');
  }

  function drawHiker(c, x, y, o) {
    if (DH.hero3d && DH.hero3d.active) {
      DH.hero3d.drawSprite(c, x, y, o);
      return;
    }
    const t = o.t || 0;
    const s = o.scale || 1;
    const risk = o.risk || 0;
    const phase = o.phase || 0;
    const mv = o.moving ? 1 : 0;
    const pose = o.pose || 'idle';
    const jump = o.jump || 0;
    /* 有 outfit 時由 gear-art.js 依玩家配裝畫衣物；沒有就是原本的造型 */
    const out = o.outfit ? DH.gearArt.resolve(o.outfit) : null;
    const col = o.colors ? Object.assign({}, HIKER_COLORS, o.colors) : HIKER_COLORS;
    const hand = (hx, hy, r) => {
      if (out) DH.gearArt.drawHand(c, out, hx, hy, r);
      else ell(c, hx, hy, r, r, col.skin);
    };
    /* 螢幕上太小時，細線只會糊成一團，直接省略 */
    const detail = s * (DH.art.viewZ || 1) >= 0.82;
    /* 換裝預覽的全身站姿：上身抬高、兩腳分開，褲與鞋才看得清楚 */
    const standLift = out && o.standLift ? o.standLift : 0;
    const armW = out ? out.armW : 7.5;

    /* 走到一半淋濕或受寒：身體發抖 */
    const body = o.body || {};
    const shiver = body.chilled && !reducedMotion() ? Math.sin(t * 34) * 0.9 : 0;
    c.save();
    c.translate(x + shiver, y);
    c.scale(s, s);
    shadow(c, 30 * (1 - Math.min(jump, 60) / 150), 7);
    c.translate(0, -jump);
    c.scale(o.dir || 1, 1);
    if (pose === 'stumble') c.rotate(reducedMotion() ? -0.05 : Math.sin(t * 22) * 0.07 - 0.05);
    /* 走路時身體往行進方向傾，一眼看得出朝向 */
    if (mv) c.rotate(0.075);

    const swing = Math.sin(phase) * mv;
    const lift = Math.cos(phase) * mv;
    const bob = mv ? Math.abs(Math.cos(phase)) * 3 : Math.sin(t * 2.1) * 0.9;

    /* 背包：往身體後方挪，和背帶之間留出間隙 */
    if (out) {
      c.save();
      c.translate(-Math.max(out.puff, 0), -standLift);
      DH.gearArt.drawPack(c, out, bob);
      c.restore();
    } else {
      box(c, -36, -54 - bob, 21, 33, 8, col.pack);
      box(c, -34, -38 - bob, 13, 13, 4, col.packDark);
      box(c, -36, -62 - bob, 20, 10, 5, col.roll);
      if (detail) line(c, -32, -57 - bob, -20, -57 - bob, 'rgba(180,140,90,.6)', 1.2);
    }

    /* 腿與靴：側身大步，後腳較暗 */
    const legs = standLift ? [
      { fx: -10, ly: 0, shade: 1 },
      { fx: 8, ly: 0, shade: 1 },
    ] : [
      { fx: -3 - swing * 16, ly: Math.max(0, -lift) * 8, shade: 0.8 },
      { fx: 4 + swing * 16, ly: Math.max(0, lift) * 8, shade: 1 },
    ];
    legs.forEach((l) => {
      c.globalAlpha = l.shade;
      if (out) {
        DH.gearArt.drawLeg(c, out, l.fx, l.ly, bob, standLift);
      } else {
        line(c, l.fx * 0.3, -22 - bob, l.fx, -5 - l.ly, col.pants, 9.5);
        box(c, l.fx - 6.5, -8 - l.ly, 17, 8, 4, col.boots);
      }
      c.globalAlpha = 1;
    });

    /* 身體 */
    if (standLift) c.translate(0, -standLift);
    if (out) {
      DH.gearArt.drawTorso(c, out, bob);
    } else {
      box(c, -17, -48 - bob, 34, 30, 12, col.jacket);
      box(c, -17, -28 - bob, 34, 7, 3, col.jacketDark);
      line(c, -8, -46 - bob, -6, -25 - bob, col.packDark, 3);
    }

    /* 手與登山杖 */
    const shoulderY = -42 - bob;
    const armColor = out ? out.arm : col.jacketDark;
    const shoulderX = 13 + (out ? Math.max(out.puff, 0) * 0.8 : 0);
    if (pose === 'cheer') {
      line(c, -shoulderX, shoulderY, -23, shoulderY - 25, armColor, armW);
      line(c, shoulderX, shoulderY, 24, shoulderY - 25, armColor, armW);
      hand(-23, shoulderY - 27, 4.6);
      hand(24, shoulderY - 27, 4.6);
    } else if (pose === 'wave') {
      const wv = Math.sin(t * 14) * 5;
      line(c, shoulderX, shoulderY, 26 + wv, shoulderY - 25, armColor, armW);
      hand(26 + wv, shoulderY - 28, 4.8);
    } else if (pose === 'drink') {
      line(c, shoulderX, shoulderY, 22, shoulderY - 14, armColor, armW);
      c.save();
      c.translate(23, shoulderY - 19);
      c.rotate(-0.8);
      box(c, -4.5, -11, 9, 21, 3, '#6cc1e6');
      box(c, -3, -14, 6, 4, 1.5, '#e8785c');
      c.restore();
      hand(23, shoulderY - 15, 4.6);
    } else if (pose === 'photo') {
      line(c, shoulderX, shoulderY, 24, shoulderY - 12, armColor, armW);
      box(c, 21, shoulderY - 25, 18, 13, 3, '#4a5468');
      ell(c, 32, shoulderY - 18.5, 4, 4, '#a9ddf5');
      hand(24, shoulderY - 11, 4.4);
    } else {
      /* 手離身體一點、杖再離手一點，小尺寸也分得開 */
      const hx = 25 + (out ? Math.max(out.puff, 0) * 0.9 : 0) + swing * 7;
      const hy = -31 - bob;
      if (!out || out.poles) {
        line(c, hx + 2, hy - 9, hx + 11 + swing * 15, -1 + standLift, '#8a8f98', 2.6);
        line(c, hx + 2, hy - 9, hx + 2, hy + 2, '#4a5468', 3.4);
      }
      line(c, shoulderX, shoulderY, hx - 1, hy, armColor, armW);
      hand(hx - 1, hy, 4.2);
    }
    if (out) DH.gearArt.drawFront(c, out, bob);

    /* 頭 */
    c.save();
    c.translate(2 + mv * 3, -67 - bob);
    if (o.headTilt) c.rotate(o.headTilt);
    ell(c, -21, 0, 13, 16, col.hair);
    /* 女生多一束馬尾；男生維持短髮 */
    if (!o.colors && !o.helmet && DH.player.gender === 'female') {
      c.beginPath();
      c.moveTo(-26, -8);
      c.quadraticCurveTo(-48, -4, -44, 24);
      c.quadraticCurveTo(-34, 16, -25, 10);
      c.closePath();
      c.fillStyle = col.hair;
      c.fill();
      ell(c, -27, -6, 4, 4, '#4fb3a5');
    }
    ell(c, 2, 0, 30, 27, col.skin);
    ell(c, -22, 4, 5, 6, '#ffd2ad');
    c.beginPath();
    c.moveTo(-27, -7);
    c.quadraticCurveTo(-4, -22, 28, -9);
    c.quadraticCurveTo(16, -3, 8, -9);
    c.quadraticCurveTo(-8, -4, -27, -7);
    c.fillStyle = col.hair;
    c.fill();
    c.save();
    c.translate(mv * 2.5, 0);
    hikerFace(c, risk, pose, t, { detail, blinkSeed: o.blinkSeed });
    c.restore();
    if (out) {
      DH.gearArt.drawHeadwear(c, out);
    } else if (o.helmet) {
      /* 救難隊安全帽 */
      c.beginPath();
      c.moveTo(-28, -11);
      c.quadraticCurveTo(-26, -36, 2, -36);
      c.quadraticCurveTo(30, -36, 32, -11);
      c.closePath();
      c.fillStyle = col.hat;
      c.fill();
      box(c, -30, -15, 64, 6, 3, col.hatBand);
      box(c, 7, -31, 12, 4, 1.5, col.hatBand);
      box(c, 11, -35, 4, 12, 1.5, col.hatBand);
    } else {
      /* 帽子 */
      c.beginPath();
      c.moveTo(-23, -14);
      c.quadraticCurveTo(-22, -39, 2, -39);
      c.quadraticCurveTo(26, -39, 27, -14);
      c.closePath();
      c.fillStyle = col.hat;
      c.fill();
      ell(c, 2, -14, 39, 8.5, col.hat, -0.03);
      ell(c, 2, -16, 25, 5, 'rgba(180,120,50,.17)');
      box(c, -23, -24, 50, 7, 3, col.hatBand);
      if (!o.colors) hatBadge(c, 15, -23);
    }
    /* 淋濕：髮梢與下巴滴水；受寒：呼出白氣 */
    if (body.soaked) {
      for (let i = 0; i < 3; i++) {
        const p = (t * 0.9 + i / 3) % 1;
        drop(c, -18 + i * 19, 24 + p * 30, 0.5);
      }
    }
    if (body.chilled) {
      const p = (t * 0.55) % 1;
      c.globalAlpha = (1 - p) * 0.75;
      ell(c, 38 + p * 16, 9 - p * 12, 4 + p * 7, 3 + p * 5, '#fff');
      c.globalAlpha = 1;
    }
    if (risk >= 80) {
      [-2, 6, 14].forEach((lx) => line(c, lx, -8, lx, -3, 'rgba(90,120,190,.55)', 1.6));
    }
    c.restore();

    /* 汗 */
    if (risk >= 50) {
      const n = risk >= 80 ? 3 : 2;
      for (let i = 0; i < n; i++) {
        const p = (t * 0.9 + i / n) % 1;
        c.globalAlpha = 1 - p;
        drop(c, -30 + i * 7 + (i === 2 ? 66 : 0), -96 - bob + p * 26, 1.05);
        c.globalAlpha = 1;
      }
    }
    c.restore();
  }

  const animals = {
    bear(c, t) {
      const b = Math.sin(t * 1.6) * 1;
      shadow(c, 32, 7);
      ell(c, 0, -22 - b / 2, 29, 24, '#2c2a2e');
      ell(c, -19, -3, 10, 6, '#232126');
      ell(c, 19, -3, 10, 6, '#232126');
      ell(c, -21, -68 - b, 9.5, 9.5, '#2c2a2e');
      ell(c, 21, -68 - b, 9.5, 9.5, '#2c2a2e');
      ell(c, -21, -68 - b, 4.5, 4.5, '#5c5560');
      ell(c, 21, -68 - b, 4.5, 4.5, '#5c5560');
      ell(c, 0, -53 - b, 27, 23, '#2c2a2e');
      ell(c, 0, -45 - b, 12, 9, '#c9a57c');
      ell(c, 0, -49 - b, 4.2, 3, '#1c1a1e');
      ell(c, -11, -57 - b, 3.3, 4, '#fff');
      ell(c, 11, -57 - b, 3.3, 4, '#fff');
      ell(c, -10.6, -56.5 - b, 2.1, 2.7, '#111');
      ell(c, 11.4, -56.5 - b, 2.1, 2.7, '#111');
      c.beginPath();
      c.moveTo(-15, -30);
      c.lineTo(0, -16);
      c.lineTo(15, -30);
      c.lineTo(9, -31);
      c.lineTo(0, -23);
      c.lineTo(-9, -31);
      c.closePath();
      c.fillStyle = '#fbeed2';
      c.fill();
    },
    muntjac(c, t) {
      const nod = Math.sin(t * 1.2) * 1.4;
      shadow(c, 26, 5);
      [-15, -8, 8, 15].forEach((lx, i) => line(c, lx, -24, lx, -1, i % 2 ? '#a06b3f' : '#8c5a34', 3.8));
      ell(c, 0, -32, 24, 14, '#c58a52');
      ell(c, 0, -26, 16, 6, '#e6c096');
      ell(c, -23, -38, 4, 6, '#fbeed2', 0.5);
      line(c, 17, -38, 25, -50, '#c58a52', 9);
      c.save();
      c.translate(28, -56 + nod);
      ell(c, -6, -10, 4, 6.5, '#b67c47', -0.5);
      line(c, -2, -12, -5, -22, '#6d4a2d', 2);
      line(c, 4, -12, 6, -22, '#6d4a2d', 2);
      ell(c, 0, 0, 14, 12, '#c58a52');
      ell(c, 9, 4, 6, 5, '#e6c096');
      ell(c, 13, 3, 2.1, 1.8, '#3a3028');
      ell(c, 3, -2, 3.2, 3.8, '#2c2a2e');
      ell(c, 4, -3, 1.1, 1.3, '#fff');
      line(c, -2, -9, 2, -5, '#6d4a2d', 1.6);
      c.restore();
    },
    pheasant(c, t) {
      const peck = Math.max(0, Math.sin(t * 0.9) - 0.75) * 12;
      shadow(c, 26, 5);
      line(c, -4, -15, -5, -1, '#d3555b', 3);
      line(c, 7, -15, 8, -1, '#d3555b', 3);
      c.beginPath();
      c.moveTo(-18, -30);
      c.quadraticCurveTo(-52, -40, -56, -19);
      c.quadraticCurveTo(-38, -14, -14, -19);
      c.closePath();
      c.fillStyle = '#f7f6f2';
      c.fill();
      ell(c, 0, -28, 22, 16, '#2c4f93');
      ell(c, -5, -28, 13, 9.5, '#3e6cbc', -0.2);
      ell(c, -8, -35, 8, 4, '#a84f4a', -0.2);
      c.save();
      c.translate(20, -46 + peck);
      ell(c, 0, 0, 11.5, 11, '#2c4f93');
      ell(c, 4, 0, 6, 7, '#df4f52');
      ell(c, -3, -11, 7, 4, '#f7f6f2', -0.4);
      ell(c, -10, -9, 5, 3, '#f7f6f2', -0.1);
      ell(c, 4, -1.5, 2.2, 2.6, '#1c1a1e');
      ell(c, 4.6, -2.3, 0.8, 0.9, '#fff');
      poly(c, [10, -3, 16, 0, 10, 3], '#e7d39a');
      c.restore();
    },
    macaque(c, t) {
      const b = Math.sin(t * 2.2) * 1;
      shadow(c, 24, 6);
      c.beginPath();
      c.moveTo(-18, -7);
      c.quadraticCurveTo(-40, -8, -33, -28);
      c.strokeStyle = '#8c7a68';
      c.lineWidth = 5;
      c.lineCap = 'round';
      c.stroke();
      ell(c, 0, -19, 21, 19, '#9c8974');
      ell(c, 0, -14, 12, 11, '#b8a690');
      ell(c, -13, -3, 8, 5, '#8c7a68');
      ell(c, 13, -3, 8, 5, '#8c7a68');
      ell(c, -21, -47 - b, 5.5, 5.5, '#e7a79a');
      ell(c, 21, -47 - b, 5.5, 5.5, '#e7a79a');
      ell(c, 0, -47 - b, 21, 18, '#9c8974');
      ell(c, 0, -44 - b, 14.5, 12, '#f0b5a4');
      ell(c, -5, -47 - b, 2.7, 3.3, '#2c2a2e');
      ell(c, 5, -47 - b, 2.7, 3.3, '#2c2a2e');
      ell(c, -4.4, -48 - b, 0.9, 1, '#fff');
      ell(c, 5.6, -48 - b, 0.9, 1, '#fff');
      c.beginPath();
      c.arc(0, -41 - b, 3.5, 0.2, Math.PI - 0.2);
      c.strokeStyle = '#8a4a40';
      c.lineWidth = 1.5;
      c.stroke();
    },
  };

  function drawAnimal(c, kind, x, y, s, t, dir) {
    c.save();
    c.translate(x, y);
    c.scale(s * (dir || 1), s);
    animals[kind](c, t);
    c.restore();
  }

  function drawButterfly(c, x, y, s, t, color) {
    const flap = Math.abs(Math.sin(t * 13)) * 0.8 + 0.2;
    c.save();
    c.translate(x, y);
    c.scale(s, s);
    [-1, 1].forEach((side) => {
      c.save();
      c.scale(side * flap, 1);
      ell(c, 5, -3, 5.5, 4.2, color, -0.5);
      ell(c, 4, 3, 3.6, 3, color, 0.5);
      ell(c, 5.4, -3, 2, 1.5, 'rgba(255,255,255,.75)', -0.5);
      c.restore();
    });
    line(c, 0, -4, 0, 4, '#4a3b34', 1.6);
    c.restore();
  }

  function drawFlower(c, x, y, r, color, rot) {
    c.save();
    c.translate(x, y);
    c.rotate(rot || 0);
    for (let i = 0; i < 5; i++) {
      c.rotate(TAU / 5);
      ell(c, r * 0.72, 0, r * 0.62, r * 0.42, color);
    }
    ell(c, 0, 0, r * 0.36, r * 0.36, '#ffd965');
    c.restore();
  }

  function speech(c, x, y, str) {
    c.font = `700 15px ${FONT}`;
    const w = c.measureText(str).width + 22;
    box(c, x - w / 2, y - 32, w, 28, 12, 'rgba(255,253,246,.96)');
    poly(c, [x - 7, y - 5, x + 7, y - 5, x, y + 3], 'rgba(255,253,246,.96)');
    text(c, str, x, y - 18, 15, '#5a4a3e');
  }

  /* 事件標記圖示：在半徑約 14 的圓內繪製 ---------------------------------- */
  const icons = {
    /* 保命題的救生圈：紅白相間，圓形中空 */
    lifebuoy(c) {
      ell(c, 0, 0, 14, 14, '#e5484d');
      for (let i = 0; i < 4; i++) {
        c.save();
        c.rotate(Math.PI / 4 + (i * Math.PI) / 2);
        box(c, -3.6, -14.2, 7.2, 9.4, 1.5, '#fffdf6');
        c.restore();
      }
      ell(c, 0, 0, 6, 6, '#fff3e6');
      c.lineWidth = 1.4;
      c.strokeStyle = '#b5322a';
      c.beginPath();
      c.arc(0, 0, 6, 0, Math.PI * 2);
      c.stroke();
    },
    pack(c) {
      box(c, -8.5, -8, 17, 19, 6, '#4fb3a5');
      box(c, -5.5, 2, 11, 6.5, 2.5, '#3c978b');
      box(c, -7.5, -12, 15, 6, 3, '#f4c76b');
      line(c, -3.5, -1.5, 3.5, -1.5, '#fffdf6', 2);
    },
    paw(c) {
      const col = '#7a5238';
      ell(c, 0, 4.5, 8, 6.8, col);
      ell(c, -8.6, -2, 3, 3.9, col, -0.4);
      ell(c, -3.1, -6.8, 3, 4, col, -0.12);
      ell(c, 3.1, -6.8, 3, 4, col, 0.12);
      ell(c, 8.6, -2, 3, 3.9, col, 0.4);
    },
    drop(c) {
      c.beginPath();
      c.moveTo(0, -12.5);
      c.quadraticCurveTo(11.5, 1, 8, 7);
      c.quadraticCurveTo(0, 15, -8, 7);
      c.quadraticCurveTo(-11.5, 1, 0, -12.5);
      c.fillStyle = '#58b4e4';
      c.fill();
      ell(c, -3, 4, 2, 3.2, 'rgba(255,255,255,.8)', 0.3);
    },
    sign(c) {
      box(c, -1.8, -12, 3.6, 25, 1.6, '#94694a');
      poly(c, [-10, -10.5, 7, -10.5, 12, -6.2, 7, -2, -10, -2], '#c9884f');
      poly(c, [10, 0.5, -6, 0.5, -11, 4.6, -6, 8.6, 10, 8.6], '#e0a86c');
    },
    bolt(c) {
      c.beginPath();
      c.moveTo(3, -13);
      c.lineTo(-8, 2.5);
      c.lineTo(-0.5, 2.5);
      c.lineTo(-3.5, 13);
      c.lineTo(8.5, -3.5);
      c.lineTo(1, -3.5);
      c.closePath();
      c.lineJoin = 'round';
      c.lineWidth = 2;
      c.strokeStyle = '#efae27';
      c.fillStyle = '#efae27';
      c.fill();
      c.stroke();
    },
    bee(c) {
      ell(c, -3.5, -7, 5, 6.5, 'rgba(150,205,235,.9)', -0.5);
      ell(c, 4, -7, 5, 6.5, 'rgba(150,205,235,.9)', 0.5);
      ell(c, 0, 3, 11, 7.8, '#f4c23f');
      box(c, -4.5, -4.4, 3.4, 14.8, 1.5, '#4a3b34');
      box(c, 2, -4.4, 3.4, 14.8, 1.5, '#4a3b34');
    },
    medkit(c) {
      box(c, -4.5, -11, 9, 6, 2, '#a83f3a');
      box(c, -12, -7, 24, 18, 5, '#e2564f');
      box(c, -2.2, -3.5, 4.4, 11, 1.2, '#fffdf6');
      box(c, -5.5, -0.2, 11, 4.4, 1.2, '#fffdf6');
    },
    thermo(c) {
      box(c, -3.6, -13, 7.2, 19, 3.6, '#c9d6de');
      ell(c, 0, 7, 6.2, 6.2, '#c9d6de');
      box(c, -1.5, -5, 3, 12, 1.4, '#e2564f');
      ell(c, 0, 7, 4, 4, '#e2564f');
      line(c, 6, -9, 10, -9, '#a9b6be', 1.8);
      line(c, 6, -4, 10, -4, '#a9b6be', 1.8);
    },
    map(c) {
      poly(c, [-12, -8, -4, -11, 4, -8, 12, -11, 12, 8, 4, 11, -4, 8, -12, 11], '#a6d6ab');
      poly(c, [-4, -11, 4, -8, 4, 11, -4, 8], '#8cc596');
      line(c, -8, 5, -2, -1, '#d9604a', 1.8);
      line(c, -2, -1, 7, -3, '#d9604a', 1.8);
    },
    team(c) {
      ell(c, -6, -5.5, 4.8, 4.8, '#6d94c6');
      box(c, -12.5, 0, 13, 10, 5, '#6d94c6');
      ell(c, 6, -4, 5.4, 5.4, '#e8905c');
      box(c, -1, 2, 14, 10, 5, '#e8905c');
    },
  };
  const ICON_BY_CATEGORY = {
    裝備穿搭: 'pack', 野生動物: 'paw', 體能補給: 'drop', 迷路與求救: 'sign', 天氣與地形: 'bolt',
    傷病處置: 'medkit', 高山症與體溫: 'thermo', 行前規劃: 'map', 團隊與禮儀: 'team',
  };
  const ICON_FALLBACK = [
    [/裝備|穿搭|背包/, 'pack'], [/動物|熊|獼猴/, 'paw'], [/補給|飲水|水/, 'drop'], [/迷路|求救|路/, 'sign'],
    [/天氣|地形|雷|雨/, 'bolt'], [/傷|病|急救/, 'medkit'], [/高山症|體溫|失溫/, 'thermo'], [/規劃|行前|申請/, 'map'], [/團隊|禮儀|隊/, 'team'],
  ];
  function markerIcon(category, title) {
    if (/蜂/.test(title || '')) return 'bee';
    const cat = category || '';
    if (ICON_BY_CATEGORY[cat]) return ICON_BY_CATEGORY[cat];
    const hit = ICON_FALLBACK.find(([re]) => re.test(`${cat}${title || ''}`));
    return hit ? hit[1] : 'sign';
  }

  /* 圓潤樹冠：二次貝茲側緣＋圓鈍樹尖，再描一圈同色圓角收掉尖角 */
  function softTier(c, hw, yBase, yTop, tipX, color) {
    const tip = Math.max(4.5, hw * 0.19);
    const midY = (yBase + yTop) / 2;
    c.beginPath();
    c.moveTo(-hw, yBase - 4);
    c.quadraticCurveTo(0, yBase + 8, hw, yBase - 4);
    c.quadraticCurveTo(hw * 0.62 + tipX * 0.5, midY + (yBase - yTop) * 0.08, tipX + tip, yTop + tip * 1.1);
    c.quadraticCurveTo(tipX, yTop - tip * 0.75, tipX - tip, yTop + tip * 1.1);
    c.quadraticCurveTo(-hw * 0.62 + tipX * 0.5, midY + (yBase - yTop) * 0.08, -hw, yBase - 4);
    c.closePath();
    c.fillStyle = color;
    c.strokeStyle = color;
    c.lineWidth = 6;
    c.lineJoin = 'round';
    c.fill();
    c.stroke();
  }
  /* 由物件的 h 固定推出輪廓與 ±12% 寬、±15% 高，每棵樹每幀都一樣 */
  function shapeOf(it) {
    const h = it && it.h !== undefined ? it.h : 0.5;
    return {
      variant: Math.floor(frac(h * 3.19) * 3),
      w: 1 + (frac(h * 7.31) * 2 - 1) * 0.12,
      h: 1 + (frac(h * 13.77) * 2 - 1) * 0.15,
    };
  }
  const CEDAR_SHAPES = [
    [[44, -36, -130], [36, -84, -176], [27, -130, -214]],
    [[51, -38, -118], [40, -88, -166], [26, -132, -198]],
    [[38, -34, -134], [30, -92, -188], [21, -142, -230]],
  ];
  const FIR_SHAPES = [
    [[22, -24, -82], [16, -56, -108]],
    [[26, -24, -76], [18, -52, -98]],
    [[19, -24, -88], [13, -62, -118]],
  ];
  const ROCK_SHAPES = [
    [-27, 0, -31, -20, -12, -26, 3, -33, 15, -24, 29, -15, 27, 0],
    [-33, 0, -31, -13, -17, -18, -3, -28, 12, -20, 31, -14, 31, 0],
    [-22, 0, -27, -25, -7, -32, 15, -35, 20, -17, 25, -9, 24, 0],
  ];

  /* 地上的場景物件：c 已平移到物件腳底，s 為縮放 */
  const decor = {
    cedar(c, s, t, it) {
      const sw = Math.sin(t * 0.8 + it.h * 9) * 1.5;
      const col = it.dark || '#4f9a78';
      const col2 = it.light || '#66b18c';
      const shape = shapeOf(it);
      c.scale(s * shape.w, s * shape.h);
      box(c, -7, -48, 14, 48, 5, '#94694a');
      CEDAR_SHAPES[shape.variant].forEach(([hw, base, top], i) => {
        softTier(c, hw, base, top, sw * (0.4 + i * 0.3), i === 1 ? col2 : col);
      });
    },
    broadleaf(c, s, t, it) {
      c.scale(s, s);
      box(c, -6, -44, 12, 44, 4, '#94694a');
      ell(c, 0, -74, 38, 34, it.dark || '#8cc97c');
      ell(c, -18, -60, 22, 20, it.dark || '#8cc97c');
      ell(c, 20, -62, 22, 20, it.dark || '#8cc97c');
      ell(c, -7, -84, 20, 16, it.light || '#a8d98f');
    },
    fir(c, s, t, it) {
      const shape = shapeOf(it);
      c.scale(s * shape.w, s * shape.h);
      box(c, -4, -34, 8, 34, 3, '#8a6a57');
      const tiers = FIR_SHAPES[shape.variant];
      softTier(c, tiers[0][0], tiers[0][1], tiers[0][2], 0, it.dark || '#6f9c8a');
      softTier(c, tiers[1][0], tiers[1][1], tiers[1][2], 0, it.light || '#83b09c');
    },
    fern(c, s, t, it) {
      c.scale(s, s);
      const col = it.dark || '#57a56c';
      for (let i = -3; i <= 3; i++) {
        const a = i * 0.36 + Math.sin(t * 1.2 + it.h * 7) * 0.04 - Math.PI / 2;
        c.save();
        c.rotate(a + Math.PI / 2);
        ell(c, 0, -14, 3.8, 15, col);
        c.restore();
      }
    },
    shrub(c, s, t, it) {
      c.scale(s, s);
      ell(c, 0, -14, 25, 17, it.dark || '#86c97f');
      ell(c, -14, -9, 15, 11, it.dark || '#86c97f');
      ell(c, 15, -9, 14, 10, it.dark || '#86c97f');
      ell(c, -5, -19, 12, 8, it.light || '#a5da92');
    },
    rock(c, s, t, it) {
      const shape = shapeOf(it);
      const p = ROCK_SHAPES[shape.variant];
      c.scale(s * shape.w, s * shape.h);
      c.beginPath();
      c.moveTo(p[0], p[1]);
      c.quadraticCurveTo(p[2], p[3], p[4], p[5]);
      c.quadraticCurveTo(p[6], p[7], p[8], p[9]);
      c.quadraticCurveTo(p[10], p[11], p[12], p[13]);
      c.quadraticCurveTo(0, 5, p[0], p[1]);
      c.closePath();
      c.fillStyle = it.dark || '#b6b3a8';
      c.fill();
      ell(c, p[4] * 0.45, p[5] * 0.68, 11, 5.5, it.light || '#d1cec2', -0.12);
    },
    mossrock(c, s, t, it) {
      decor.rock(c, s, t, { dark: '#a7aa98', light: '#bfc1ae', h: it.h });
      ell(c, -3, -22, 15, 5.5, '#7cbb7a');
      ell(c, -13, -13, 8, 4, '#8ec785');
    },
    mushroom(c, s) {
      c.scale(s, s);
      box(c, -3.4, -11, 7, 11, 3, '#fbeed2');
      c.beginPath();
      c.arc(0, -10, 10, Math.PI, 0);
      c.closePath();
      c.fillStyle = '#e8785c';
      c.fill();
      ell(c, -4, -14, 1.8, 1.8, '#fff');
      ell(c, 3, -15, 1.6, 1.6, '#fff');
    },
    cane(c, s, t, it) {
      /* 玉山箭竹草坡 */
      c.scale(s, s);
      const sw = Math.sin(t * 2.3 + it.h * 11) * 3 + (it.wind || 0);
      for (let i = -3; i <= 3; i++) {
        c.beginPath();
        c.moveTo(i * 4, 0);
        c.quadraticCurveTo(i * 5, -16, i * 8.5 + sw, -30 - (3 - Math.abs(i)) * 5);
        c.strokeStyle = i % 2 ? (it.light || '#a9c76c') : (it.dark || '#8fb85c');
        c.lineWidth = 3.4;
        c.lineCap = 'round';
        c.stroke();
      }
    },
    windgrass(c, s, t, it) {
      c.scale(s, s);
      const sw = Math.sin(t * 3.2 + it.h * 13) * 4 + 9;
      for (let i = -2; i <= 2; i++) {
        c.beginPath();
        c.moveTo(i * 3, 0);
        c.quadraticCurveTo(i * 3 + sw * 0.25, -14, i * 3 + sw * 1.5, -26 + Math.abs(i) * 3);
        c.strokeStyle = '#d6cd8c';
        c.lineWidth = 2;
        c.lineCap = 'round';
        c.stroke();
      }
    },
    flower(c, s, t, it) {
      c.scale(s, s);
      line(c, 0, 0, 0, -14, '#6fae68', 2);
      drawFlower(c, 0, -16, 6, it.color || '#ffb1c4', it.h * 6);
    },
    hut(c, s) {
      c.scale(s, s);
      box(c, -66, -66, 132, 66, 4, '#f3e3c3');
      for (let i = 0; i < 6; i++) line(c, -66, -56 + i * 11, 66, -56 + i * 11, 'rgba(160,120,80,.16)', 1.5);
      poly(c, [-80, -62, 80, -62, 58, -104, -58, -104], '#d97f5e');
      poly(c, [-80, -62, 80, -62, 76, -70, -76, -70], '#c26e4f');
      box(c, -48, -46, 30, 46, 3, '#a4714c');
      ell(c, -24, -22, 2, 2, '#f4c76b');
      box(c, 2, -50, 46, 28, 3, '#bde7f5');
      line(c, 25, -50, 25, -22, '#fff', 3);
      line(c, 2, -36, 48, -36, '#fff', 3);
      box(c, -22, -116, 66, 22, 4, '#fff9ea');
      text(c, '服務站', 11, -105, 15, '#7a5b42');
    },
    car(c, s) {
      c.scale(s, s);
      shadow(c, 46, 6);
      box(c, -44, -28, 88, 21, 9, '#7fc4d9');
      c.beginPath();
      c.moveTo(-27, -28);
      c.quadraticCurveTo(-20, -50, 2, -50);
      c.lineTo(10, -50);
      c.quadraticCurveTo(25, -50, 33, -28);
      c.closePath();
      c.fillStyle = '#92d1e2';
      c.fill();
      c.beginPath();
      c.moveTo(-19, -29);
      c.quadraticCurveTo(-14, -45, 2, -45);
      c.lineTo(2, -29);
      c.closePath();
      c.moveTo(7, -29);
      c.lineTo(7, -45);
      c.quadraticCurveTo(21, -45, 26, -29);
      c.closePath();
      c.fillStyle = '#eefaff';
      c.fill();
      [-25, 25].forEach((wx) => {
        ell(c, wx, -7, 9.5, 9.5, '#4a5468');
        ell(c, wx, -7, 4, 4, '#dfe6ea');
      });
    },
    parking(c, s) {
      c.scale(s, s);
      line(c, 0, 0, 0, -56, '#8a8f98', 4.5);
      box(c, -15, -80, 30, 30, 6, '#4f8fd1');
      text(c, 'P', 0, -64, 22, '#fff', 800);
    },
    gate(c, s, t, it) {
      /* 牌樓 */
      c.scale(s, s);
      box(c, -78, -132, 15, 132, 4, '#b5694a');
      box(c, 63, -132, 15, 132, 4, '#b5694a');
      box(c, -84, -8, 27, 9, 3, '#8a8f98');
      box(c, 57, -8, 27, 9, 3, '#8a8f98');
      box(c, -92, -128, 184, 14, 4, '#c97a57');
      box(c, -60, -160, 120, 36, 5, '#fff3d6');
      rr(c, -60, -160, 120, 36, 5);
      c.strokeStyle = '#b5694a';
      c.lineWidth = 3;
      c.stroke();
      text(c, it.label || '登山口', 0, -141, 23, '#8a4a30', 800);
      c.beginPath();
      c.moveTo(-108, -160);
      c.quadraticCurveTo(0, -180, 108, -160);
      c.quadraticCurveTo(84, -192, 0, -194);
      c.quadraticCurveTo(-84, -192, -108, -160);
      c.fillStyle = '#7ba77e';
      c.fill();
    },
    notice(c, s) {
      c.scale(s, s);
      box(c, -40, -36, 8, 36, 2, '#94694a');
      box(c, 32, -36, 8, 36, 2, '#94694a');
      box(c, -52, -94, 104, 64, 5, '#a4714c');
      box(c, -46, -88, 92, 52, 3, '#fff9ea');
      text(c, '步道告示', 0, -77, 14, '#7a5b42');
      line(c, -36, -64, 36, -64, '#d8c6a4', 3);
      line(c, -36, -55, 22, -55, '#d8c6a4', 3);
      line(c, -36, -46, 30, -46, '#d8c6a4', 3);
      poly(c, [-62, -92, 62, -92, 52, -106, -52, -106], '#c97a57');
    },
    stagesign(c, s, t, it) {
      c.scale(s, s);
      box(c, -6, -80, 12, 80, 3, '#94694a');
      c.beginPath();
      c.moveTo(-72, -122);
      c.lineTo(66, -122);
      c.lineTo(88, -96);
      c.lineTo(66, -70);
      c.lineTo(-72, -70);
      c.closePath();
      c.fillStyle = '#fff3d6';
      c.fill();
      c.strokeStyle = '#a4714c';
      c.lineWidth = 3.5;
      c.lineJoin = 'round';
      c.stroke();
      text(c, it.label, 2, -105, 20, '#7a5b42', 800);
      text(c, it.sub, 2, -83, 15, '#a4714c');
    },
    bridgepost(c, s) {
      c.scale(s, s);
      box(c, -4, -30, 8, 30, 2, '#94694a');
    },
    trig(c, s) {
      /* 三角點：方柱石標 */
      c.scale(s, s);
      box(c, -24, -8, 48, 9, 3, '#a9a79d');
      box(c, -14, -44, 28, 38, 2, '#e4e1d6');
      box(c, -14, -50, 28, 8, 2, '#f2efe6');
      line(c, -6, -46, 6, -46, '#8a8f98', 2.6);
      line(c, 0, -49, 0, -43, '#8a8f98', 2.6);
      text(c, '三角點', 0, -26, 8.5, '#6d6a62');
    },
    stele(c, s, t, it) {
      c.scale(s, s);
      c.beginPath();
      c.moveTo(-34, 0);
      c.lineTo(-30, -92);
      c.quadraticCurveTo(0, -112, 30, -92);
      c.lineTo(34, 0);
      c.closePath();
      c.fillStyle = '#b9b6ab';
      c.fill();
      c.beginPath();
      c.moveTo(-22, -10);
      c.lineTo(-20, -84);
      c.quadraticCurveTo(0, -97, 20, -84);
      c.lineTo(22, -10);
      c.closePath();
      c.fillStyle = '#d4d1c6';
      c.fill();
      text(c, it.label, 0, -66, 18, '#6b5240', 800);
      text(c, it.sub, 0, -42, 13, '#6b5240');
    },
    lantern(c, s, t, it) {
      c.scale(s, s);
      const pulse = 0.82 + Math.sin(t * 2 + it.h * 9) * 0.14;
      c.globalAlpha = 0.4 * pulse;
      const g = c.createRadialGradient(0, -52, 2, 0, -52, 46);
      g.addColorStop(0, '#ffdf9a');
      g.addColorStop(1, 'rgba(255,200,120,0)');
      c.fillStyle = g;
      c.fillRect(-46, -98, 92, 92);
      c.globalAlpha = 1;
      line(c, 0, 0, 0, -38, '#6d4a2d', 4);
      box(c, -10, -66, 20, 28, 8, '#ffb55c');
      box(c, -10, -69, 20, 5, 2, '#a4583a');
      box(c, -10, -40, 20, 4, 2, '#a4583a');
      ell(c, 0, -52, 5, 8, '#fff0c4');
    },
    cabin(c, s) {
      c.scale(s, s);
      box(c, -74, -62, 148, 62, 3, '#a87a55');
      for (let i = 0; i < 6; i++) line(c, -74, -52 + i * 10, 74, -52 + i * 10, 'rgba(90,60,40,.26)', 2);
      poly(c, [-90, -58, 90, -58, 0, -128], '#8a5a44');
      box(c, -16, -44, 32, 44, 3, '#6d4a2d');
      box(c, 34, -44, 28, 24, 3, '#ffdf9a');
      box(c, -62, -44, 28, 24, 3, '#ffdf9a');
      box(c, -28, -86, 56, 20, 4, '#fff3d6');
      text(c, '山屋', 0, -76, 13, '#7a5b42', 800);
    },
    bench(c, s) {
      c.scale(s, s);
      box(c, -28, -18, 56, 7, 3, '#a4714c');
      box(c, -24, -11, 6, 11, 2, '#8a5a44');
      box(c, 18, -11, 6, 11, 2, '#8a5a44');
    },
  };

  /* 結局插圖 ---------------------------------------------------- */
  function skyFill(c, w, h, top, bottom) {
    const g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, top);
    g.addColorStop(1, bottom);
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
  }
  function bumps(c, w, y, h, step, color, phase) {
    c.fillStyle = color;
    c.fillRect(0, y, w, h);
    for (let x = -step; x < w + step; x += step) {
      const r = step * (0.62 + 0.25 * Math.sin(x * 0.04 + (phase || 0)));
      c.beginPath();
      c.arc(x, y + 2, r, 0, TAU);
      c.fill();
    }
  }
  function miniCloud(c, x, y, s, color) {
    ell(c, x, y, 26 * s, 12 * s, color);
    ell(c, x - 16 * s, y + 2 * s, 14 * s, 8 * s, color);
    ell(c, x + 17 * s, y + 2 * s, 15 * s, 9 * s, color);
    ell(c, x + 2 * s, y - 8 * s, 14 * s, 10 * s, color);
  }

  const endings = {
    good(c, w, h, t, outfit) {
      skyFill(c, w, h, '#8fcdf2', '#fff0d2');
      const sx = w * 0.72;
      const sy = h * 0.32;
      c.save();
      c.translate(sx, sy);
      c.rotate(t * 0.12);
      for (let i = 0; i < 12; i++) {
        c.rotate(TAU / 12);
        poly(c, [0, 0, h * 0.09, -h * 1.1, -h * 0.09, -h * 1.1], 'rgba(255,240,190,.28)');
      }
      c.restore();
      ell(c, sx, sy, h * 0.14, h * 0.14, '#ffd27a');
      miniCloud(c, w * 0.18 + Math.sin(t * 0.3) * 8, h * 0.2, 1, '#fff');
      bumps(c, w, h * 0.66, h, 34, '#e6f4fa', t * 0.5);
      const cx = w * 0.42;
      poly(c, [cx - h * 0.72, h * 1.02, cx, h * 0.44, cx + h * 0.72, h * 1.02], '#8fcb9f');
      poly(c, [cx - h * 0.26, h * 0.65, cx, h * 0.44, cx + h * 0.26, h * 0.65, cx + h * 0.09, h * 0.6, cx, h * 0.68, cx - h * 0.11, h * 0.6], '#b8e0a8');
      bumps(c, w, h * 0.9, h, 30, '#f3fafc', t * 0.7 + 2);
      c.save();
      c.translate(cx + 28, h * 0.48);
      line(c, 0, 0, 0, -h * 0.34, '#8a5a44', 3);
      const fy = -h * 0.34;
      c.beginPath();
      c.moveTo(0, fy);
      c.quadraticCurveTo(26, fy + 6 + Math.sin(t * 5) * 4, 50, fy + 3);
      c.lineTo(50, fy + h * 0.12);
      c.quadraticCurveTo(26, fy + h * 0.12 + 4 + Math.sin(t * 5) * 4, 0, fy + h * 0.12);
      c.closePath();
      c.fillStyle = '#e8785c';
      c.fill();
      c.restore();
      const jump = Math.abs(Math.sin(t * 3.2)) * 14;
      drawHiker(c, cx - 8, h * 0.5, { t, pose: 'cheer', jump, scale: Math.min(1, h / 230), outfit });
      for (let i = 0; i < 7; i++) {
        const fx = w * ((i * 0.147 + 0.07) % 1);
        const fy2 = ((t * 22 + i * 57) % (h * 0.7));
        drawFlower(c, fx, fy2, 5, ['#ffb1c4', '#ffd965', '#fff', '#ffc78f'][i % 4], t + i);
      }
    },
    normal(c, w, h, t, outfit) {
      skyFill(c, w, h, '#9a8fc4', '#ffc99a');
      ell(c, w * 0.8, h * 0.28, h * 0.1, h * 0.1, '#fff3c9');
      ell(c, w * 0.8 + h * 0.04, h * 0.26, h * 0.085, h * 0.085, '#ae9cc4');
      miniCloud(c, w * 0.24 + Math.sin(t * 0.3) * 6, h * 0.22, 0.9, 'rgba(255,240,230,.72)');
      poly(c, [0, h * 0.72, w * 0.26, h * 0.34, w * 0.5, h * 0.72], '#a688af');
      poly(c, [w * 0.34, h * 0.76, w * 0.68, h * 0.4, w, h * 0.76], '#b57f90');
      c.fillStyle = '#c9a46f';
      c.fillRect(0, h * 0.72, w, h);
      c.save();
      c.translate(w * 0.72, h * 0.78);
      decor.lantern(c, 1, t, { h: 0.2 });
      c.restore();
      c.save();
      c.translate(w * 0.43, h * 0.88);
      decor.bench(c, 1.9, t, {});
      c.restore();
      const sc = Math.min(0.95, h / 240);
      drawHiker(c, w * 0.43, h * 0.8, { t, risk: 62, scale: sc, headTilt: 0.05, outfit });
      box(c, w * 0.43 - 2 * sc, h * 0.8 - 80 * sc, 14 * sc, 5 * sc, 2, '#fff9ea');
      const steam = Math.sin(t * 2) * 3;
      c.save();
      c.translate(w * 0.58, h * 0.84);
      box(c, -9, -14, 18, 16, 4, '#fff9ea');
      c.beginPath();
      c.moveTo(-2 + steam, -18);
      c.quadraticCurveTo(4 + steam, -25, -1 - steam, -33);
      c.strokeStyle = 'rgba(255,255,255,.75)';
      c.lineWidth = 2;
      c.stroke();
      c.restore();
    },
    /* 救援結局：直升機維持原本的 Q 版模樣，檢討寫在文字裡，畫面不放慶祝的東西 */
    bad(c, w, h, t, outfit) {
      skyFill(c, w, h, '#a6dcf0', '#ffe6c2');
      const sunX = w * 0.14;
      const sunY = h * 0.2;
      ell(c, sunX, sunY, h * 0.2, h * 0.2, 'rgba(255,226,160,.42)');
      ell(c, sunX, sunY, h * 0.11, h * 0.11, '#ffd98a');
      miniCloud(c, w * 0.36 + Math.sin(t * 0.3) * 8, h * 0.14, 0.9, 'rgba(255,255,255,.92)');
      miniCloud(c, w * 0.92 - Math.sin(t * 0.25) * 8, h * 0.42, 0.8, 'rgba(255,255,255,.82)');
      c.fillStyle = '#b9d9c4';
      c.beginPath();
      c.moveTo(0, h * 0.82);
      c.quadraticCurveTo(w * 0.2, h * 0.42, w * 0.46, h * 0.78);
      c.quadraticCurveTo(w * 0.72, h * 0.34, w, h * 0.74);
      c.lineTo(w, h);
      c.lineTo(0, h);
      c.closePath();
      c.fill();
      c.fillStyle = '#a5d58f';
      c.beginPath();
      c.moveTo(0, h * 0.8);
      c.quadraticCurveTo(w * 0.5, h * 0.68, w, h * 0.82);
      c.lineTo(w, h);
      c.lineTo(0, h);
      c.closePath();
      c.fill();
      for (let i = 0; i < 7; i++) {
        const fx = w * (0.06 + i * 0.145);
        drawFlower(c, fx, h * (0.9 + (i % 2) * 0.05), 4.2, ['#ffb1c4', '#ffd965', '#fff'][i % 3], i);
      }

      const sc = Math.min(1, h / 240, w / 420);
      const hx = w * 0.74 + Math.sin(t * 0.8) * 5;
      const hy = h * 0.23 + Math.sin(t * 1.3) * 3;
      const crew = { jacket: '#e8605c', jacketDark: '#c94d4a', pants: '#4a5468', hat: '#fffdf6', hatBand: '#e8605c', pack: '#f4c76b', packDark: '#d8a94c', hair: '#3a2c24' };

      /* 救援繩與垂降中的隊員 */
      const rope = h * 0.3 + Math.sin(t * 0.7) * h * 0.012;
      line(c, hx, hy + 22 * sc, hx, hy + 22 * sc + rope, '#fffdf6', 2.2);
      drawHiker(c, hx, hy + 22 * sc + rope + 72 * sc * 0.62, { t, pose: 'wave', dir: -1, scale: sc * 0.62, colors: crew, helmet: true, blinkSeed: 5 });

      /* Q 版直升機 */
      c.save();
      c.translate(hx, hy);
      c.scale(sc, sc);
      line(c, 38, -6, 92, -15, '#e8605c', 9);
      ell(c, 95, -17, 10, 10, '#fffdf6');
      ell(c, 95, -17, 7, 2.4, '#7a8798', t * 9);
      line(c, -30, 30, 34, 30, '#4a5468', 3.8);
      line(c, -18, 19, -18, 30, '#4a5468', 3.4);
      line(c, 22, 19, 22, 30, '#4a5468', 3.4);
      ell(c, 0, -2, 50, 25, '#f2736b');
      box(c, -46, 2, 92, 10, 5, '#fffdf6');
      box(c, 12, -15, 22, 13, 4, '#fffdf6');
      box(c, 20.5, -13, 5, 9, 1.3, '#e8605c');
      box(c, 18.5, -11, 9, 5, 1.3, '#e8605c');
      /* 駕駛艙與笑臉 */
      c.beginPath();
      c.moveTo(-45, -6);
      c.quadraticCurveTo(-42, -23, -18, -23);
      c.lineTo(-9, -23);
      c.lineTo(-9, -3);
      c.closePath();
      c.fillStyle = '#dcf3fb';
      c.fill();
      ell(c, -30, -11, 2.2, 2.8, '#3a3028');
      ell(c, -18, -11, 2.2, 2.8, '#3a3028');
      c.beginPath();
      c.arc(-24, -8, 4, 0.25, Math.PI - 0.25);
      c.strokeStyle = '#7a3e32';
      c.lineWidth = 1.8;
      c.lineCap = 'round';
      c.stroke();
      box(c, -5, -34, 10, 10, 3, '#4a5468');
      const blade = 58 + Math.sin(t * 40) * 18;
      box(c, -blade, -38, blade * 2, 5, 2.5, 'rgba(70,80,100,.62)');
      c.restore();

      /* 平安的登山客與地面隊員 */
      const gx = w * 0.2;
      const gy = h * 0.84;
      const gs = sc * 0.82;
      drawHiker(c, gx, gy, { t, risk: 10, pose: 'wave', scale: gs, blinkSeed: 1, outfit });
      const rx = gx + 88 * sc;
      drawHiker(c, rx, gy + 3, { t, pose: 'idle', dir: -1, scale: gs, colors: crew, helmet: true, blinkSeed: 3 });
      /* 地上的急救包 */
      c.save();
      c.translate(rx + 46 * sc, gy + 2);
      c.scale(sc * 0.9, sc * 0.9);
      icons.medkit(c);
      c.restore();
      speech(c, Math.max(84, gx + 44 * sc), Math.max(36, gy - 122 * gs - 20), '是我準備不足。');
    },
  };

  DH.art = {
    FONT, rr, ell, box, line, poly, text, drop,
    drawHiker, drawAnimal, drawButterfly, drawFlower, speech,
    decor, endings, animals, icons, markerIcon, reducedMotion, viewZ: 1,
  };
})();
