/* 換裝與打包的 Canvas 繪圖：角色身上的衣物圖層、品項小圖示、選山與預報的小插圖。
   角色骨架沿用 art.js 的 drawHiker，這裡只負責把配裝畫上去。 */
(function () {
  const DH = window.DH;
  const A = DH.art;
  const { ell, box, line, poly } = A;
  const SKIN = '#ffe0c2';
  const HAIR = '#5a3d2b';

  const BASE = {
    wicking: { body: '#35b0a3', dark: '#2a9186' },
    cotton: { body: '#fbf7ee', dark: '#e3dccc' },
  };
  const MID = {
    fleece: { body: '#ef8f4b', arm: '#d97a38' },
    down: { body: '#9078cc', arm: '#7a61b4' },
  };
  const SHELL = {
    rain_shell: { body: '#f5c93b', arm: '#dfae22' },
    windbreaker: { body: '#34558f', arm: '#2a4678' },
  };

  const PUFF = { down: 6, fleece: 1.6, no_mid: -1.4 };
  const ARM_W = { down: 13.5, fleece: 9, no_mid: 7 };

  /* 配裝 → 畫圖用的資料。同一副背包，不因多選而無限堆疊。 */
  function resolve(sel) {
    const pack = new Set(sel.pack);
    const shell = SHELL[sel.shell];
    const mid = MID[sel.mid];
    return {
      sel,
      pack,
      poles: pack.has('poles'),
      arm: shell ? shell.arm : mid ? mid.arm : SKIN,
      bareArm: !shell && !mid,
      /* 中層厚度決定上身輪廓與袖子：羽絨最蓬、刷毛中等、不穿最薄 */
      puff: PUFF[sel.mid] === undefined ? 0 : PUFF[sel.mid],
      armW: !shell && !mid ? 6.8 : (ARM_W[sel.mid] || 7.5),
      water: sel.water === 'water_3' ? 3 : sel.water === 'water_2' ? 2 : 1,
    };
  }

  function drawPack(c, out, bob) {
    const cover = out.pack.has('rain_kit');
    const main = cover ? '#5c9bd6' : '#4fb3a5';
    const dark = cover ? '#4a86bf' : '#3c978b';
    /* 側袋水瓶：刻度代表攜水量 */
    box(c, -44, -47 - bob, 9.5, 23, 3, '#6cc1e6');
    box(c, -42.2, -50 - bob, 6, 4, 1.5, '#e8785c');
    for (let i = 0; i < out.water; i++) line(c, -42, -30 - i * 5.5 - bob, -37, -30 - i * 5.5 - bob, '#fffdf6', 1.8);
    if (out.pack.has('overnight_kit')) {
      box(c, -39, -28 - bob, 27, 11, 5.5, '#8667bd');
      line(c, -32, -28 - bob, -32, -17 - bob, '#6f52a4', 1.6);
      line(c, -19, -28 - bob, -19, -17 - bob, '#6f52a4', 1.6);
    }
    box(c, -36, -54 - bob, 21, 33, 8, main);
    box(c, -34, -38 - bob, 13, 13, 4, dark);
    if (out.pack.has('shelter')) {
      box(c, -37, -63 - bob, 23, 11, 5.5, '#8d9489');
      line(c, -31, -63 - bob, -31, -52 - bob, '#6f766c', 1.5);
      line(c, -20, -63 - bob, -20, -52 - bob, '#6f766c', 1.5);
    }
  }

  /* lift：預覽把上身抬高，腿才有長度能看清褲型與鞋型；遊戲中為 0 */
  function drawLeg(c, out, fx, ly, bob, lift) {
    const { pants, socks, shoes } = out.sel;
    const up = lift || 0;
    const topX = fx * (up ? 0.7 : 0.3);
    const topY = -22 - bob - up;
    const ankle = -8 - ly;
    const cuffY = -14 - ly;
    const midX = topX + (fx - topX) * 0.55;
    const midY = topY + (ankle - topY) * 0.55;
    /* 先畫皮膚，褲與襪疊上去 */
    if (pants === 'shorts') {
      line(c, midX, midY, fx, ankle, SKIN, 7.5);
      line(c, topX, topY, midX, midY, '#8f9499', 11);
      line(c, midX - 5, midY + 1, midX + 5, midY + 1, '#74797e', 2);
    } else if (pants === 'jeans') {
      /* 牛仔長褲：直筒到腳踝，外側淺藍褲縫，褲口反折 */
      line(c, topX, topY, fx, cuffY, '#3f68ad', 10.5);
      line(c, topX + 3.6, topY + 2, fx + 3.6, cuffY - 1, '#a5c3ef', 1.3);
      line(c, topX - 2.4, topY + 3, fx - 2.4, cuffY - 2, '#355a98', 1.3);
      line(c, fx - 4.2, cuffY + 0.6, fx + 4.2, cuffY + 0.6, '#7d9fd9', 3.4);
    } else {
      /* 快乾登山褲：貼身收口，膝蓋有車片 */
      line(c, topX, topY, fx, cuffY, '#6c7a4a', 9);
      line(c, midX - 3.6, midY, midX + 3.6, midY - 0.8, '#58653a', 1.5);
      line(c, fx - 3.4, cuffY + 0.4, fx + 3.4, cuffY + 0.4, '#58653a', 2.4);
    }
    /* 襪：腳踝上方一小段 */
    const sockY = cuffY + 1.5;
    if (socks === 'hiking_socks') {
      line(c, fx, sockY, fx, ankle, '#a7abae', 8);
      line(c, fx - 3, sockY + 1.2, fx + 3, sockY + 1.2, '#ee8549', 2);
    } else if (socks === 'cotton_socks') {
      line(c, fx, sockY, fx, ankle, '#fffdf6', 8);
    } else {
      line(c, fx, sockY, fx, ankle, SKIN, 7.5);
    }
    /* 鞋：登山鞋高筒厚底、運動鞋低筒白底、拖鞋只有鞋底與 Y 字夾帶 */
    if (shoes === 'boots') {
      box(c, fx - 6, -11 - ly, 11, 9, 3, '#7c5033');
      box(c, fx - 6.5, -7.5 - ly, 18, 7.5, 3.6, '#8a5a3b');
      box(c, fx - 7.5, -2.8 - ly, 20, 3.4, 1.4, '#2f2a28');
      [-5, -1, 3, 7].forEach((dx) => line(c, fx + dx * 1.1, -0.6 - ly, fx + dx * 1.1, 0.8 - ly, '#2f2a28', 1.6));
      line(c, fx - 1, -9 - ly, fx + 4, -8 - ly, '#f5e6c8', 1.1);
      line(c, fx + 1, -6.6 - ly, fx + 6, -5.8 - ly, '#f5e6c8', 1.1);
    } else if (shoes === 'trainers') {
      box(c, fx - 6, -7 - ly, 17, 6.4, 3.2, '#4a8fd6');
      box(c, fx - 6.5, -2.2 - ly, 18.5, 2.6, 1.2, '#fffdf6');
      line(c, fx + 2, -6 - ly, fx + 6, -4.6 - ly, '#fffdf6', 1.2);
    } else {
      const foot = socks === 'no_socks' ? SKIN : socks === 'hiking_socks' ? '#a7abae' : '#fffdf6';
      box(c, fx - 5.5, -4.6 - ly, 16, 4.2, 2.1, foot);
      box(c, fx - 7, -1.2 - ly, 19, 2, 1, '#e88aa8');
      /* 夾腳帶從腳趾間分到腳背兩側，沒有後跟固定 */
      line(c, fx + 7, -2.2 - ly, fx + 2, -5.4 - ly, '#d9668c', 1.7);
      line(c, fx + 7, -2.2 - ly, fx + 9.6, -5 - ly, '#d9668c', 1.7);
    }
  }

  function drawTorso(c, out, bob) {
    const y = -48 - bob;
    const { base, mid, shell } = out.sel;
    const b = BASE[base];
    const p = out.puff;
    const m = MID[mid];
    const s = SHELL[shell];
    /* 上身輪廓：全部依厚度 p 放大，外套穿在羽絨外面也撐得起來 */
    const x = -17 - p;
    const w = 34 + p * 2;
    const top = y - Math.max(p, 0) * 0.55;
    const h = y + 30 - top;
    box(c, x, top, w, h, 12, b.body);
    box(c, x, y + 23, w, 7, 3, b.dark);
    if (base === 'cotton' && !m && !s) box(c, -2, y + 11, 8, 8, 2, '#6d9bd1');
    if (m) {
      /* 下襬比外層長一點，穿上外套也看得到中層顏色 */
      const hem = mid === 'down' ? 6 : 3.5;
      box(c, x, top, w, h + hem, 12, m.body);
      box(c, x, y + 26 + hem - 4, w, 8, 4, m.arm);
      if (!s) {
        if (mid === 'down') {
          [9, 16, 23].forEach((dy) => line(c, x + 1.5, y + dy, x + w - 1.5, y + dy, m.arm, 2.2));
          [9, 16, 23].forEach((dy) => { ell(c, x + 0.5, y + dy - 3.5, 2.6, 3.4, m.body); ell(c, x + w - 0.5, y + dy - 3.5, 2.6, 3.4, m.body); });
        } else {
          line(c, 2, y + 5, 2, y + 28, '#b9622c', 1.8);
        }
      }
    }
    if (s) {
      box(c, x - 0.5, top - 0.5, w + 1, h + 0.5, 12, s.body);
      box(c, x - 0.5, y + 24, w + 1, 6, 3, s.arm);
      line(c, 2, y + 4, 2, y + 29, shell === 'windbreaker' ? '#8fa9d4' : '#b98a14', 1.9);
      if (shell === 'rain_shell') {
        /* 連帽邊 */
        ell(c, -12 - p * 0.6, top + 2.5, 9, 5, s.arm);
      }
      /* 外套被羽絨撐起的鼓面：只用受光面表現，不把車線畫到外套上 */
      if (mid === 'down') {
        ell(c, x + 9, y + 11, 6.5, 8.5, 'rgba(255,255,255,.2)');
        ell(c, x + w - 9, y + 11, 6.5, 8.5, 'rgba(255,255,255,.2)');
      }
    }
    /* 領口：外層包中層、中層包內層，一層一層露出顏色 */
    if (m && (s || mid === 'down')) ell(c, 2, top + 2.4, 11 + Math.max(p, 0), 4.6 + Math.max(p, 0) * 0.3, m.body);
    if (m || s) ell(c, 2, top + 1.8, 7.5, 2.8, b.body);
    /* 背帶 */
    line(c, -8 - p * 0.5, y + 2, -6 - p * 0.5, y + 23, out.pack.has('rain_kit') ? '#4a86bf' : '#3c978b', 3);
  }

  function drawHand(c, out, x, y, r) {
    /* 中層從外層袖口露出一圈 */
    const m = MID[out.sel.mid];
    if (m && SHELL[out.sel.shell]) ell(c, x, y, r + (out.sel.mid === 'down' ? 2.4 : 1.4), r + (out.sel.mid === 'down' ? 2.4 : 1.4), m.body);
    if (out.sel.gloves === 'warm_gloves') {
      ell(c, x, y, r + 0.6, r + 0.6, '#3a3a40');
      ell(c, x - r * 0.7, y - r * 0.5, r * 0.46, r * 0.46, '#55555c');
    } else {
      ell(c, x, y, r, r, SKIN);
    }
  }

  function drawFront(c, out, bob) {
    const y = -48 - bob;
    /* 短袖袖口 */
    if (out.bareArm) line(c, 13, y + 6, 16.5, y + 11, BASE[out.sel.base].body, 8);
    if (out.pack.has('whistle')) {
      line(c, -7, y + 6, -3, y + 11, '#8a8f98', 1.1);
      box(c, -5, y + 10, 7.5, 4.6, 1.5, '#f2c230');
    }
    if (out.sel.shell === 'poncho') {
      const wide = Math.max(out.puff, 0);
      c.save();
      c.globalAlpha *= 0.7;
      c.beginPath();
      c.moveTo(-13 - wide, y - 1);
      c.quadraticCurveTo(2, y - 5, 16 + wide, y - 1);
      c.lineTo(24 + wide, y + 37);
      c.quadraticCurveTo(2, y + 43, -21 - wide, y + 37);
      c.closePath();
      c.fillStyle = '#bfe4f5';
      c.fill();
      c.restore();
      line(c, -21 - wide, y + 37, 24 + wide, y + 37, 'rgba(120,180,215,.75)', 1.6);
    }
    if (out.pack.has('offline_map')) {
      box(c, -2, y + 13, 12, 16, 2.6, '#4a5468');
      box(c, -0.5, y + 14.6, 9, 12.6, 1.4, '#e7f3e6');
      line(c, 1, y + 25, 4, y + 20, '#4fa871', 1.5);
      line(c, 4, y + 20, 7, y + 17, '#4fa871', 1.5);
    }
  }

  /* 帽子與頭燈、眼鏡：原點在頭部中心 */
  function drawHeadwear(c, out) {
    const hat = out.sel.hat;
    if (hat === 'sun_hat') {
      c.beginPath();
      c.moveTo(-23, -14);
      c.quadraticCurveTo(-22, -39, 2, -39);
      c.quadraticCurveTo(26, -39, 27, -14);
      c.closePath();
      c.fillStyle = '#cdb07a';
      c.fill();
      ell(c, 2, -14, 41, 8.5, '#f1e4c0', -0.03);
      ell(c, 2, -16, 25, 5, 'rgba(150,110,60,.2)');
      box(c, -23, -24, 50, 6, 3, '#a98a57');
    } else if (hat === 'beanie') {
      c.beginPath();
      c.moveTo(-29, -8);
      c.quadraticCurveTo(-28, -37, 2, -37);
      c.quadraticCurveTo(32, -37, 33, -8);
      c.closePath();
      c.fillStyle = '#d9534a';
      c.fill();
      box(c, -30, -13, 64, 9, 4.5, '#b53f38');
      ell(c, 2, -40, 7.5, 7.5, '#f8e6d2');
    } else {
      /* 不戴帽：露出頭髮 */
      c.beginPath();
      c.moveTo(-29, -6);
      c.quadraticCurveTo(-27, -31, 2, -31);
      c.quadraticCurveTo(29, -31, 31, -9);
      c.quadraticCurveTo(14, -18, -6, -13);
      c.quadraticCurveTo(-20, -10, -29, -6);
      c.closePath();
      c.fillStyle = HAIR;
      c.fill();
    }
    if (out.pack.has('sun_kit')) {
      /* 半透明鏡片：看得到眼睛，鏡框維持墨鏡的形狀 */
      [1, 19].forEach((ex) => {
        ell(c, ex, 2.2, 8, 7.4, 'rgba(70,62,58,.42)');
        c.beginPath();
        c.ellipse(ex, 2.2, 8, 7.4, 0, 0, Math.PI * 2);
        c.strokeStyle = '#2c2a2e';
        c.lineWidth = 1.5;
        c.stroke();
      });
      line(c, 9, 0.5, 11, 0.5, '#2c2a2e', 1.8);
      line(c, -7, 0, -24, -3, '#2c2a2e', 1.8);
    }
    if (out.pack.has('headlamp')) {
      const by = hat === 'sun_hat' ? -8 : hat === 'beanie' ? -13 : -11;
      line(c, -27, by - 1, 31, by + 0.5, '#3d4450', 3.6);
      ell(c, 30, by, 7, 7, '#3d4450');
      ell(c, 30.6, by, 4.6, 4.6, '#ffe98a');
    }
  }

  /* 品項小圖示：以 (0,0) 為中心、約 24 單位見方 ------------------------------ */
  function tee(c, body, sleeve) {
    box(c, -8, -8, 16, 18, 4, body);
    line(c, -8, -6, -12, -1, sleeve || body, 5);
    line(c, 8, -6, 12, -1, sleeve || body, 5);
  }
  function jacket(c, body, zip, sleeve) {
    box(c, -8, -9, 16, 20, 4, body);
    line(c, -8, -6, -11, 9, sleeve, 5);
    line(c, 8, -6, 11, 9, sleeve, 5);
    line(c, 0, -8, 0, 10, zip, 1.6);
  }
  function none(c) {
    c.beginPath();
    c.arc(0, 0, 9.5, 0, Math.PI * 2);
    c.setLineDash([3, 3]);
    c.strokeStyle = '#b9ab94';
    c.lineWidth = 2;
    c.stroke();
    c.setLineDash([]);
  }
  const ICONS = {
    sun_hat(c) { box(c, -8, -8, 16, 12, 6, '#cdb07a'); ell(c, 0, 4, 13, 4, '#f1e4c0'); },
    beanie(c) { box(c, -9, -6, 18, 14, 7, '#d9534a'); box(c, -10, 4, 20, 5, 2.5, '#b53f38'); ell(c, 0, -8, 3.6, 3.6, '#f8e6d2'); },
    no_hat: none,
    wicking(c) { tee(c, BASE.wicking.body); },
    cotton(c) { tee(c, BASE.cotton.body, '#e3dccc'); box(c, -2.5, -2, 5, 5, 1.2, '#6d9bd1'); },
    fleece(c) { jacket(c, MID.fleece.body, '#b9622c', MID.fleece.arm); },
    down(c) { jacket(c, MID.down.body, MID.down.arm, MID.down.arm); [-3, 2, 7].forEach((y) => line(c, -7, y, 7, y, MID.down.arm, 1.3)); },
    no_mid: none,
    rain_shell(c) { jacket(c, SHELL.rain_shell.body, '#b98a14', SHELL.rain_shell.arm); ell(c, 0, -9, 5, 3, SHELL.rain_shell.arm); },
    poncho(c) { poly(c, [-4, -10, 4, -10, 11, 10, -11, 10], 'rgba(150,205,235,.85)'); ell(c, 0, -10, 4, 2.6, '#8cc6e4'); },
    windbreaker(c) { jacket(c, SHELL.windbreaker.body, '#8fa9d4', SHELL.windbreaker.arm); },
    no_shell: none,
    quick_pants(c) { line(c, -3, -8, -4.5, 10, '#6c7a4a', 6.5); line(c, 3, -8, 4.5, 10, '#6c7a4a', 6.5); },
    jeans(c) { line(c, -3, -8, -4.5, 10, '#3f68ad', 6.5); line(c, 3, -8, 4.5, 10, '#3f68ad', 6.5); line(c, 6, -7, 8, 10, '#a5c3ef', 1.2); },
    shorts(c) { line(c, -3, -7, -4.5, 2, '#8f9499', 7); line(c, 3, -7, 4.5, 2, '#8f9499', 7); line(c, -4.5, 3, -5, 10, SKIN, 5); line(c, 4.5, 3, 5, 10, SKIN, 5); },
    boots(c) { box(c, -6, -9, 10, 13, 3, '#8a5a3b'); box(c, -6, -1, 17, 7, 3.5, '#8a5a3b'); box(c, -7, 5, 19, 3.6, 1.6, '#2f2a28'); },
    trainers(c) { box(c, -8, -3, 18, 8, 4, '#4a8fd6'); box(c, -9, 4, 20, 3.2, 1.4, '#fffdf6'); box(c, -8, 4, 20, 1, 0.4, '#d7d0c4'); },
    sandals(c) { box(c, -11, 4, 23, 4, 2, '#e88aa8'); line(c, 7, 4, 0, -3, '#d9668c', 2.4); line(c, 7, 4, 10, -3, '#d9668c', 2.4); },
    warm_gloves(c) { box(c, -7, -7, 13, 16, 6, '#3a3a40'); ell(c, 8, 0, 3.2, 4.6, '#55555c', 0.3); },
    no_gloves(c) { ell(c, 0, 1, 6.5, 8, SKIN); ell(c, 7.5, 0, 2.6, 4, SKIN, 0.3); },
    hiking_socks(c) { box(c, -5, -9, 9, 14, 3, '#a7abae'); box(c, -5, 1, 16, 8, 4, '#a7abae'); box(c, -5, -7, 9, 3, 1, '#ee8549'); },
    cotton_socks(c) { box(c, -5, -9, 9, 14, 3, '#fffdf6'); box(c, -5, 1, 16, 8, 4, '#fffdf6'); box(c, -5, -9, 9, 3, 1, '#e3dccc'); },
    no_socks(c) { box(c, -5, -9, 9, 14, 3, SKIN); box(c, -5, 1, 16, 8, 4, SKIN); },
    headlamp(c) { line(c, -11, -2, 11, -2, '#3d4450', 4); ell(c, 0, -1, 7, 7, '#3d4450'); ell(c, 0, -1, 4.6, 4.6, '#ffe98a'); },
    offline_map(c) { box(c, -7, -11, 14, 22, 3, '#4a5468'); box(c, -5.2, -9, 10.4, 17, 1.4, '#e7f3e6'); line(c, -3, 6, 0, 0, '#4fa871', 1.8); line(c, 0, 0, 3, -5, '#4fa871', 1.8); },
    paper_map(c) { poly(c, [-11, -8, -3, -10, 4, -8, 11, -10, 11, 8, 4, 10, -3, 8, -11, 10], '#f4ecd6'); line(c, -3, -10, -3, 8, '#d9ccae', 1.2); line(c, 4, -8, 4, 10, '#d9ccae', 1.2); ell(c, 5, 3, 4.6, 4.6, '#fffdf6'); poly(c, [5, -1, 6.6, 3, 3.4, 3], '#d9534a'); },
    first_aid(c) { box(c, -10, -8, 20, 17, 4, '#d9534a'); box(c, -2, -5, 4, 11, 1, '#fff'); box(c, -5.5, -1.5, 11, 4, 1, '#fff'); },
    blanket(c) { box(c, -9, -8, 18, 15, 2, '#c8ced6'); poly(c, [-9, -8, 9, -8, 9, 7], '#e6eaef'); line(c, -9, 7, 9, -8, '#aab2bd', 1); },
    power_bank(c) { box(c, -6.5, -10, 13, 21, 3.5, '#37383f'); [-5, -1, 3].forEach((y) => ell(c, 0, y, 1.5, 1.5, '#fff')); },
    snacks(c) { box(c, -6, -11, 12, 22, 2.5, '#ee8549'); box(c, -6, -5, 12, 9, 0, '#f8c27d'); },
    poles(c) { line(c, -3, -11, -7, 11, '#8a8f98', 2.4); line(c, 3, -11, 7, 11, '#8a8f98', 2.4); line(c, -3, -11, -3.8, -6, '#2f2a28', 3.6); line(c, 3, -11, 3.8, -6, '#2f2a28', 3.6); },
    sun_kit(c) { box(c, -9, -10, 8, 15, 2.5, '#fffdf6'); box(c, -7.5, -12, 5, 3, 1, '#e8785c'); ell(c, 3, 5, 3.4, 3, '#37383f'); ell(c, 9.6, 5, 3.4, 3, '#37383f'); line(c, 6, 4.4, 7, 4.4, '#37383f', 1.4); },
    whistle(c) { box(c, -9, -3, 15, 8, 3, '#f2c230'); box(c, 4, -3, 6, 3.6, 1, '#f2c230'); ell(c, -4, 1, 2, 2, '#b98a14'); },
    rain_kit(c) { box(c, -10, -6, 20, 13, 6, '#5c9bd6'); line(c, -4, -6, -4, 7, '#4a86bf', 1.4); line(c, 4, -6, 4, 7, '#4a86bf', 1.4); drawDrop(c, 7, -9); },
    dry_clothes(c) { box(c, -9, -5, 18, 15, 3, '#58c0b4'); box(c, -9, -9, 18, 5, 2.5, '#3f9f94'); },
    spare_insulation(c) { box(c, -10, -6, 20, 13, 6, MID.fleece.body); line(c, -3, -6, -3, 7, MID.fleece.arm, 1.5); line(c, 4, -6, 4, 7, MID.fleece.arm, 1.5); },
    spare_beanie(c) { ICONS.beanie(c); },
    spare_gloves(c) { ICONS.warm_gloves(c); },
    satellite(c) { box(c, -7, -4, 14, 15, 3, '#ee8549'); line(c, 3, -4, 3, -12, '#37383f', 2.6); ell(c, 0, 4, 4, 2.6, '#fff0d8'); },
    insurance(c) { box(c, -8, -11, 16, 21, 2, '#7fa7d9'); line(c, -4, -5, 4, -5, '#fff', 1.5); line(c, -4, -1, 4, -1, '#fff', 1.5); line(c, -4, 3, 2, 3, '#fff', 1.5); },
    fire_kit(c) { box(c, -8, -6, 16, 13, 3, '#d9534a'); box(c, -8, -9, 16, 5, 2, '#b53f38'); },
    repair_kit(c) { c.beginPath(); c.arc(0, 0, 7.5, 0, Math.PI * 2); c.strokeStyle = '#8f9499'; c.lineWidth = 6; c.stroke(); },
    shelter(c) { box(c, -10, -9, 20, 9, 4.5, '#2f7a57'); box(c, -10, 1, 20, 8, 4, '#8d9489'); },
    overnight_kit(c) { box(c, -11, -6, 22, 13, 6.5, '#8667bd'); line(c, -4, -6, -4, 7, '#6f52a4', 1.6); line(c, 4, -6, 4, 7, '#6f52a4', 1.6); },
    water_treatment(c) { box(c, -6, -10, 12, 18, 5, '#a9dcf0'); box(c, -2.5, 7, 5, 5, 1, '#5c9bd6'); },
    water_1(c) { bottle(c, 1); },
    water_2(c) { bottle(c, 2); },
    water_3(c) { bottle(c, 3); },
  };
  function drawDrop(c, x, y) { A.drop(c, x, y, 0.8); }
  function bottle(c, n) {
    box(c, -5.5, -8, 11, 20, 3.5, '#6cc1e6');
    box(c, -3, -12, 6, 5, 1.5, '#e8785c');
    for (let i = 0; i < n; i++) line(c, -3, 8 - i * 5, 3, 8 - i * 5, '#fffdf6', 1.8);
  }

  function drawIcon(c, id, x, y, size) {
    const fn = ICONS[id];
    if (!fn) return;
    c.save();
    c.translate(x, y);
    c.scale(size / 24, size / 24);
    fn(c);
    c.restore();
  }

  /* 換裝預覽 --------------------------------------------------------- */
  function backdrop(c, w, h, groundY, fx) {
    const sky = c.createLinearGradient(0, 0, 0, groundY);
    const cold = fx && fx.cold;
    sky.addColorStop(0, cold ? '#bcd7ec' : '#bfe6f7');
    sky.addColorStop(1, cold ? '#e6eff5' : '#f3f8e6');
    c.fillStyle = sky;
    c.fillRect(0, 0, w, h);
    poly(c, [0, groundY, w * 0.22, groundY - h * 0.2, w * 0.42, groundY - h * 0.08, w * 0.66, groundY - h * 0.26, w, groundY - h * 0.06, w, groundY], cold ? '#b5cbd8' : '#bcd9bb');
    c.fillStyle = '#a9d48e';
    c.fillRect(0, groundY, w, h - groundY);
    ell(c, w * 0.5, h + h * 0.05, w * 0.8, (h - groundY) * 0.9, '#97c97c');
  }

  /* 背包物品的分組：預覽下方的物品盤用，順序固定方便核對 */
  const TRAY_GROUPS = [
    { key: 'nav', name: '照明導航', ids: ['headlamp', 'offline_map', 'paper_map', 'power_bank'] },
    { key: 'supply', name: '補給', ids: ['snacks', 'water_treatment', 'sun_kit', 'poles', 'rain_kit', 'dry_clothes', 'spare_insulation', 'spare_beanie', 'spare_gloves', 'overnight_kit'] },
    { key: 'rescue', name: '緊急備援', ids: ['first_aid', 'blanket', 'whistle', 'satellite', 'insurance', 'fire_kit', 'repair_kit', 'shelter'] },
  ];

  /* 全身站姿：腿拉長、兩腳分開，物品盤在畫布外，不會蓋到腿與鞋 */
  const PREVIEW_LEG = 20;
  function drawPreview(c, w, h, sel, opts) {
    const o = opts || {};
    A.viewZ = 1;
    const groundY = h * 0.84;
    backdrop(c, w, h, groundY, o.fx);
    const scale = Math.min(2.5, (h - 14) / (118 + PREVIEW_LEG));
    A.drawHiker(c, w * 0.54, h - 6, { t: o.t || 0, scale, outfit: sel, pose: o.pose, blinkSeed: 2, standLift: PREVIEW_LEG });
  }

  /* 選山與預報的小插圖：每座山有自己的地形與植被 ---------------------------- */
  const SEASON_TONE = {
    spring: { grass: '#8fcf85', far: '#bfe0bd', leaf: '#5fa877' },
    summer: { grass: '#74bd72', far: '#b2d8b4', leaf: '#3f8f64' },
    autumn: { grass: '#c2c070', far: '#d6d6b0', leaf: '#6f9a58' },
    winter: { grass: '#c3d4c8', far: '#d7e2e4', leaf: '#5a8676' },
  };
  function pineTree(c, x, base, size, col) {
    box(c, x - size * 0.07, base - size * 0.26, size * 0.14, size * 0.28, 1, '#7a5a3f');
    poly(c, [x - size * 0.34, base - size * 0.2, x, base - size * 0.72, x + size * 0.34, base - size * 0.2], col);
    poly(c, [x - size * 0.26, base - size * 0.5, x, base - size, x + size * 0.26, base - size * 0.5], col);
  }
  function roundTree(c, x, base, size, col) {
    box(c, x - size * 0.06, base - size * 0.4, size * 0.12, size * 0.42, 1, '#7a5a3f');
    ell(c, x, base - size * 0.62, size * 0.36, size * 0.4, col);
  }
  function grassTufts(c, w, h, y0, y1, col, n) {
    for (let i = 0; i < n; i++) {
      const x = ((i + 0.5) / n + (((i * 7) % 5) - 2) * 0.012) * w;
      const y = y0 + (((i * 41) % 37) / 37) * (y1 - y0);
      line(c, x - 2, y, x - 3.5, y - 5, col, 1.4);
      line(c, x, y, x, y - 6.5, col, 1.4);
      line(c, x + 2, y, x + 3.5, y - 5, col, 1.4);
    }
  }
  /* 平滑的山坡：points 為 [x比例, y比例] */
  function hill(c, w, h, points, col) {
    c.beginPath();
    c.moveTo(-4, h + 2);
    c.lineTo(-4, points[0][1] * h);
    for (let i = 0; i < points.length - 1; i++) {
      const [x0, y0] = points[i];
      const [x1, y1] = points[i + 1];
      const mx = (x0 + x1) / 2;
      c.bezierCurveTo(mx * w, y0 * h, mx * w, y1 * h, x1 * w, y1 * h);
    }
    c.lineTo(w + 4, h + 2);
    c.closePath();
    c.fillStyle = col;
    c.fill();
  }
  const BANNERS = {
    /* 七星山：渾圓火山錐與芒草坡 */
    qixing(c, w, h, tone) {
      hill(c, w, h, [[0, 0.72], [0.28, 0.6], [0.55, 0.74], [1, 0.58]], tone.far);
      hill(c, w, h, [[0, 0.84], [0.22, 0.62], [0.5, 0.2], [0.76, 0.6], [1, 0.8]], tone.grass);
      hill(c, w, h, [[0, 0.92], [0.4, 0.8], [1, 0.9]], '#a3cf79');
      grassTufts(c, w, h, h * 0.72, h * 0.98, '#e3d9a0', Math.round(w / 22));
    },
    /* 合歡山：開闊圓緩的高山草原 */
    hehuan(c, w, h, tone) {
      hill(c, w, h, [[0, 0.6], [0.2, 0.4], [0.45, 0.56], [0.72, 0.28], [1, 0.5]], tone.far);
      hill(c, w, h, [[0, 0.72], [0.34, 0.52], [0.66, 0.68], [1, 0.56]], tone.grass);
      hill(c, w, h, [[0, 0.86], [0.5, 0.76], [1, 0.84]], '#a6d68f');
      grassTufts(c, w, h, h * 0.62, h * 0.98, tone.leaf, Math.round(w / 16));
    },
    /* 加里山：層層森林 */
    jiali(c, w, h, tone) {
      hill(c, w, h, [[0, 0.56], [0.3, 0.36], [0.58, 0.18], [0.82, 0.42], [1, 0.54]], tone.far);
      hill(c, w, h, [[0, 0.74], [0.5, 0.56], [1, 0.72]], tone.leaf);
      const n = Math.max(9, Math.round(w / 22));
      for (let i = 0; i < n; i++) {
        const x = (i + 0.5) / n * w;
        const base = h * (0.78 + ((i * 7) % 5) * 0.022);
        const size = h * (0.3 + ((i * 3) % 4) * 0.045);
        (i % 3 === 1 ? pineTree : roundTree)(c, x, base, size, i % 2 ? tone.leaf : '#7fbd88');
      }
      c.fillStyle = tone.grass;
      c.fillRect(0, h * 0.92, w, h * 0.08);
    },
    /* 玉山：裸岩尖峰與碎石稜線 */
    yushan(c, w, h, tone, season) {
      poly(c, [-4, h, -4, h * 0.6, w * 0.14, h * 0.42, w * 0.28, h * 0.6, w, h * 0.68, w, h], '#c3c9cd');
      poly(c, [w * 0.2, h, w * 0.5, h * 0.08, w * 0.58, h * 0.24, w * 0.64, h * 0.16, w * 0.92, h], '#8f8a84');
      poly(c, [w * 0.5, h * 0.08, w * 0.54, h, w * 0.2, h], '#a7a198');
      [[0.42, 0.36, 0.48, 0.62], [0.58, 0.3, 0.66, 0.6], [0.72, 0.5, 0.76, 0.76]].forEach(([x0, y0, x1, y1]) => line(c, x0 * w, y0 * h, x1 * w, y1 * h, '#6f6a64', 1.5));
      if (season === 'winter') poly(c, [w * 0.44, h * 0.2, w * 0.5, h * 0.08, w * 0.58, h * 0.24, w * 0.53, h * 0.21, w * 0.49, h * 0.27], '#fdfbf5');
      hill(c, w, h, [[0, 0.92], [0.5, 0.84], [1, 0.9]], tone.leaf);
    },
    /* 雪山：圈谷碗狀山壁，下方黑森林 */
    xueshan(c, w, h, tone, season) {
      poly(c, [w * 0.08, h, w * 0.3, h * 0.26, w * 0.5, h * 0.12, w * 0.7, h * 0.24, w * 0.94, h], '#9aa5a4');
      /* 圈谷：稜下挖出的淺碗 */
      c.beginPath();
      c.moveTo(w * 0.34, h * 0.32);
      c.quadraticCurveTo(w * 0.5, h * 0.76, w * 0.66, h * 0.3);
      c.quadraticCurveTo(w * 0.5, h * 0.16, w * 0.34, h * 0.32);
      c.fillStyle = season === 'winter' ? '#f4f6f6' : '#c5cdc5';
      c.fill();
      hill(c, w, h, [[0, 0.8], [0.5, 0.68], [1, 0.8]], '#3f7a64');
      const n = Math.max(10, Math.round(w / 18));
      for (let i = 0; i < n; i++) {
        pineTree(c, (i + 0.5) / n * w, h * (0.9 + ((i * 5) % 4) * 0.025), h * (0.3 + ((i * 3) % 3) * 0.05), i % 2 ? '#2f6a55' : '#3f7f68');
      }
    },
    /* 南湖大山：寬闊山塊與高山草原，冬季稜上積雪 */
    nanhu(c, w, h, tone, season) {
      poly(c, [-4, h, w * 0.14, h * 0.46, w * 0.34, h * 0.24, w * 0.46, h * 0.32, w * 0.62, h * 0.16, w * 0.82, h * 0.38, w + 4, h * 0.56, w + 4, h], '#9fb0a6');
      const snow = season === 'winter' ? 0.2 : season === 'autumn' ? 0.1 : 0.07;
      [[0.34, 0.24], [0.62, 0.16]].forEach(([px, py]) => {
        const d = snow * w * 0.6;
        const dy = snow * h * 1.1;
        poly(c, [px * w - d, py * h + dy, px * w, py * h, px * w + d, py * h + dy, px * w + d * 0.3, py * h + dy * 0.7, px * w - d * 0.3, py * h + dy * 1.05], '#fdfbf5');
      });
      hill(c, w, h, [[0, 0.72], [0.35, 0.56], [0.7, 0.68], [1, 0.6]], tone.grass);
      hill(c, w, h, [[0, 0.88], [0.5, 0.8], [1, 0.88]], '#a6d68f');
      grassTufts(c, w, h, h * 0.66, h * 0.98, tone.leaf, Math.round(w / 18));
    },
  };

  function drawMountainBanner(c, w, h, m, fx) {
    const f = fx || {};
    const sky = c.createLinearGradient(0, 0, 0, h);
    if (f.dim) {
      sky.addColorStop(0, '#9fb4c6');
      sky.addColorStop(1, '#dfe5e6');
    } else {
      sky.addColorStop(0, '#a9ddf5');
      sky.addColorStop(1, '#f7f3dc');
    }
    c.fillStyle = sky;
    c.fillRect(0, 0, w, h);
    if (!f.dim) {
      ell(c, w * 0.86, h * 0.24, h * 0.13, h * 0.13, '#ffe391');
    }
    const tone = SEASON_TONE[f.season] || SEASON_TONE.summer;
    const scene = BANNERS[m.id] || BANNERS.hehuan;
    scene(c, w, h, tone, f.season);
    if (f.fog) {
      c.fillStyle = 'rgba(235,238,240,.62)';
      c.fillRect(0, h * 0.46, w, h * 0.32);
      ell(c, w * 0.25, h * 0.48, w * 0.3, h * 0.08, 'rgba(240,242,244,.8)');
      ell(c, w * 0.75, h * 0.62, w * 0.3, h * 0.08, 'rgba(240,242,244,.8)');
    }
    if (f.cloud) {
      ell(c, w * 0.27, h * 0.22, w * 0.13, h * 0.08, '#eef1f3');
      ell(c, w * 0.36, h * 0.17, w * 0.1, h * 0.09, '#f6f7f8');
      ell(c, w * 0.72, h * 0.2, w * 0.13, h * 0.08, '#eef1f3');
    }
    if (f.rain) {
      c.strokeStyle = 'rgba(120,160,205,.75)';
      c.lineWidth = 1.6;
      c.lineCap = 'round';
      c.beginPath();
      for (let i = 0; i < 26; i++) {
        const x = ((i * 37) % (w + 10)) - 4;
        const y = (i * 53) % (h * 0.9);
        c.moveTo(x, y);
        c.lineTo(x - 3, y + 9);
      }
      c.stroke();
    }
    if (f.bolt) poly(c, [w * 0.62, h * 0.1, w * 0.56, h * 0.34, w * 0.61, h * 0.33, w * 0.57, h * 0.54, w * 0.68, h * 0.27, w * 0.63, h * 0.28], '#ffd650');
    if (f.wind) {
      [0.2, 0.34].forEach((yy, i) => {
        c.beginPath();
        c.moveTo(w * (0.06 + i * 0.1), h * yy);
        c.quadraticCurveTo(w * 0.3, h * (yy - 0.06), w * (0.42 + i * 0.1), h * yy);
        c.strokeStyle = 'rgba(255,255,255,.9)';
        c.lineWidth = 2.4;
        c.lineCap = 'round';
        c.stroke();
      });
    }
  }

  DH.gearArt = { resolve, drawPack, drawLeg, drawTorso, drawHand, drawFront, drawHeadwear, drawIcon, drawPreview, drawMountainBanner, ICONS, TRAY_GROUPS };
})();
