/* 3D 玩偶角色：依配裝組出模型、播放動作，也能畫成 2D 畫面裡的一張圖（換裝預覽、成績卡）。 */
(function () {
  const DH = window.DH;
  const T = window.THREE;
  const SKIN = '#ffdcbc';
  const HAIR = '#4c3325';
  const TAU = Math.PI * 2;

  const TOPS = {
    home_tee: '#dcd6ec', wicking: '#35b0a3', cotton: '#fbf7ee',
    fleece: '#ef8f4b', down: '#9078cc', rain_shell: '#f5c93b', windbreaker: '#34558f',
  };
  const PANTS = {
    home_shorts: { color: '#b6aed0', short: true },
    shorts: { color: '#8f9499', short: true },
    jeans: { color: '#3f68ad', cuff: '#7d9fd9' },
    quick_pants: { color: '#6c7a4a', cuff: '#58653a' },
  };
  const HOME_SHORTS_MALE = { color: '#4f6078', short: true };
  const SOCKS = { hiking_socks: '#a7abae', cotton_socks: '#fffdf6' };
  const PUFF = { down: 0.085, fleece: 0.03 };
  const CLASSIC = {
    top: '#f59e6c', pants: { color: '#55637a', cuff: '#465368' }, pack: '#4fb3a5', hat: '#f4c76b', band: '#e8785c',
  };

  const materials = new Map();
  function mat(color, opts) {
    const key = `${color}|${opts ? JSON.stringify(opts) : ''}`;
    if (!materials.has(key)) materials.set(key, new T.MeshStandardMaterial(Object.assign({ color, roughness: 0.72, metalness: 0 }, opts)));
    return materials.get(key);
  }
  const geoSphere = new T.SphereGeometry(1, 28, 20);
  const geoCyl = new T.CylinderGeometry(1, 1, 1, 20);
  const geoCap = new T.CapsuleGeometry(1, 1, 6, 16);

  function add(parent, geo, material, p, s, r) {
    const m = new T.Mesh(geo, material);
    m.castShadow = true;
    if (p) m.position.set(p[0], p[1], p[2]);
    if (s) m.scale.set(s[0], s[1], s[2]);
    if (r) m.rotation.set(r[0], r[1], r[2]);
    parent.add(m);
    return m;
  }
  const ball = (parent, color, p, s, r) => add(parent, geoSphere, mat(color), p, s, r);
  const rod = (parent, color, p, radius, len, r) => add(parent, geoCyl, mat(color), p, [radius, len, radius], r);
  const ring = (parent, color, p, radius, tube, r) => add(parent, new T.TorusGeometry(radius, tube, 10, 28), mat(color), p, null, r);
  const limb = (parent, color, p, radius, len) => add(parent, geoCap, mat(color), p, [radius, len / 2, radius]);

  /* 臉用貼圖畫：表情切換只要換貼圖 */
  const faces = {};
  function faceTexture(kind, gender) {
    const faceKey = `${kind}|${gender || ''}`;
    if (faces[faceKey]) return faces[faceKey];
    const cv = document.createElement('canvas');
    cv.width = 256;
    cv.height = 256;
    const c = cv.getContext('2d');
    const eye = (x) => {
      c.fillStyle = '#2d241f';
      c.beginPath();
      c.ellipse(x, 112, 21, 28, 0, 0, TAU);
      c.fill();
      c.fillStyle = '#fff';
      c.beginPath();
      c.ellipse(x + 7, 100, 8, 10, 0, 0, TAU);
      c.fill();
      c.beginPath();
      c.ellipse(x - 6, 124, 3.5, 4.5, 0, 0, TAU);
      c.fill();
    };
    /* 腮紅只留給女生；男生靠粗眉和短髮辨識 */
    if (gender !== 'male') {
      c.fillStyle = 'rgba(255,135,135,.55)';
      [58, 198].forEach((x) => {
        c.beginPath();
        c.ellipse(x, 158, 26, 15, 0, 0, TAU);
        c.fill();
      });
    }
    c.strokeStyle = '#2d241f';
    c.lineWidth = 8;
    c.lineCap = 'round';
    if (kind === 'blink') {
      [84, 172].forEach((x) => { c.beginPath(); c.moveTo(x - 20, 114); c.lineTo(x + 20, 114); c.stroke(); });
    } else if (kind === 'happy') {
      [84, 172].forEach((x) => { c.beginPath(); c.arc(x, 118, 21, Math.PI * 1.1, Math.PI * 1.9); c.stroke(); });
    } else {
      [84, 172].forEach(eye);
    }
    /* 女生：外眼角的睫毛；男生：粗短眉 */
    if (gender === 'female' && kind !== 'happy') {
      c.lineWidth = 5;
      const top = kind === 'blink' ? 112 : 92;
      [[84, -1], [172, 1]].forEach(([x, side]) => {
        [[17, 0, 28, -8], [21, 8, 32, 4]].forEach(([x0, y0, x1, y1]) => {
          c.beginPath();
          c.moveTo(x + side * x0, top + y0);
          c.lineTo(x + side * x1, top + y1);
          c.stroke();
        });
      });
    }
    if (gender === 'male' && kind !== 'worried') {
      c.lineWidth = 13;
      c.strokeStyle = '#3a271c';
      [[84, 1], [172, -1]].forEach(([x, inner]) => { c.beginPath(); c.moveTo(x - inner * 24, 66); c.lineTo(x + inner * 22, 72); c.stroke(); });
      c.strokeStyle = '#2d241f';
    }
    if (kind === 'worried') {
      c.lineWidth = 6;
      c.beginPath(); c.moveTo(62, 72); c.lineTo(98, 62); c.stroke();
      c.beginPath(); c.moveTo(194, 72); c.lineTo(158, 62); c.stroke();
    }
    c.lineWidth = 6;
    c.strokeStyle = '#8a4638';
    c.beginPath();
    if (kind === 'happy') {
      c.moveTo(106, 158);
      c.quadraticCurveTo(128, 196, 150, 158);
      c.closePath();
      c.fillStyle = '#e8605c';
      c.fill();
    } else if (kind === 'worried') {
      c.moveTo(110, 178);
      c.quadraticCurveTo(128, 160, 146, 178);
      c.stroke();
    } else if (kind === 'shock') {
      c.fillStyle = '#8a4638';
      c.ellipse(128, 170, 12, 16, 0, 0, TAU);
      c.fill();
    } else {
      c.moveTo(110, 162);
      c.quadraticCurveTo(128, 182, 146, 162);
      c.stroke();
    }
    const tex = new T.CanvasTexture(cv);
    tex.colorSpace = T.SRGBColorSpace;
    tex.anisotropy = 4;
    faces[faceKey] = tex;
    return tex;
  }

  /* 上身由下往上窄、肩膀圓 */
  function torsoGeometry() {
    const pts = [[0, 0], [0.31, 0], [0.345, 0.06], [0.335, 0.26], [0.285, 0.48], [0.16, 0.61], [0, 0.635]];
    return new T.LatheGeometry(pts.map(([x, y]) => new T.Vector2(x, y)), 28);
  }
  const geoTorso = torsoGeometry();
  /* 男生肩膀寬、上身直；女生肩窄、有腰身 */
  const FIGURES = {
    male: { w: 1.06, armX: 0.365, legX: 0.165, limb: 1.08, height: 1.02 },
    female: { w: 0.97, armX: 0.31, legX: 0.145, limb: 0.92, height: 0.97 },
  };
  const FIGURE_NEUTRAL = { w: 1, armX: 0.335, legX: 0.155, limb: 1, height: 1 };
  const geoTorsoFemale = new T.LatheGeometry(
    [[0, 0], [0.315, 0], [0.335, 0.06], [0.275, 0.27], [0.27, 0.44], [0.15, 0.6], [0, 0.635]].map(([x, y]) => new T.Vector2(x, y)),
    28,
  );
  /* 男生上身方正，下襬不外擴，才不會看起來像裙子 */
  const geoTorsoMale = new T.LatheGeometry(
    [[0, 0], [0.325, 0], [0.335, 0.03], [0.345, 0.3], [0.335, 0.47], [0.18, 0.6], [0, 0.635]].map(([x, y]) => new T.Vector2(x, y)),
    28,
  );
  const sharedGeometries = new Set([geoSphere, geoCyl, geoCap, geoTorso, geoTorsoFemale, geoTorsoMale]);

  function dispose(root) {
    const geometries = new Set();
    const privateMaterials = new Set();
    const sharedMaterials = new Set(materials.values());
    root.traverse((n) => {
      if (n.geometry && !sharedGeometries.has(n.geometry)) geometries.add(n.geometry);
      const list = Array.isArray(n.material) ? n.material : [n.material];
      list.forEach((m) => {
        if (m && !sharedMaterials.has(m)) privateMaterials.add(m);
      });
    });
    geometries.forEach((g) => g.dispose());
    privateMaterials.forEach((m) => m.dispose());
    // Face textures and cached materials belong to the module, not the actor.
  }

  /* 把配裝換成畫模型用的規格；沒有 outfit 時用 NPC 配色 */
  function specOf(o) {
    const sp = baseSpec(o);
    /* 只有玩家跟著選擇走；NPC 與救難隊用自己的打扮 */
    sp.gender = o.colors || o.helmet ? null : DH.player.gender;
    sp.figure = FIGURES[sp.gender] || FIGURE_NEUTRAL;
    return sp;
  }
  function baseSpec(o) {
    if (o.outfit) {
      const out = DH.gearArt.resolve(o.outfit);
      const s = out.sel;
      return {
        s, pack: out.pack, hasPack: out.hasPack, poles: out.poles, water: s.water ? out.water : 0,
        layers: [s.base, s.mid !== 'no_mid' ? s.mid : null, s.shell === 'rain_shell' || s.shell === 'windbreaker' ? s.shell : null].filter(Boolean),
        poncho: s.shell === 'poncho',
        puff: PUFF[s.mid] || 0,
        pants: PANTS[s.pants] || PANTS.quick_pants,
        packColor: out.pack.has('rain_kit') ? '#5c9bd6' : '#4fb3a5',
      };
    }
    const col = Object.assign({}, CLASSIC, o.colors && {
      top: o.colors.jacket, pack: o.colors.pack, hat: o.colors.hat, band: o.colors.hatBand,
      pants: { color: o.colors.pants || '#55637a', cuff: '#465368' },
    });
    return {
      s: { hat: o.helmet ? 'helmet' : 'npc_hat', shoes: 'boots', socks: 'no_socks', gloves: 'no_gloves' },
      pack: new Set(), hasPack: true, poles: !o.helmet && !o.colors, water: 1,
      layers: ['npc'], npcTop: col.top, poncho: false, puff: 0, pants: col.pants, packColor: col.pack,
      hatColor: col.hat, bandColor: col.band, hair: o.colors && o.colors.hair,
    };
  }

  function buildShoe(leg, sp) {
    const { shoes, socks } = sp.s;
    const sockColor = SOCKS[socks];
    if (sockColor && shoes !== 'boots') rod(leg, sockColor, [0, -0.33, 0], 0.088, 0.12);
    if (shoes === 'boots') {
      rod(leg, '#7c5033', [0, -0.35, 0.005], 0.1, 0.17);
      ball(leg, '#8a5a3b', [0, -0.42, 0.05], [0.125, 0.085, 0.18]);
      add(leg, geoCyl, mat('#2f2a28'), [0, -0.475, 0.045], [0.13, 0.045, 0.19]);
      ring(leg, '#f5e6c8', [0, -0.34, 0.005], 0.1, 0.012, [Math.PI / 2, 0, 0]);
    } else if (shoes === 'trainers') {
      ball(leg, '#4a8fd6', [0, -0.42, 0.05], [0.115, 0.075, 0.17]);
      add(leg, geoCyl, mat('#fffdf6'), [0, -0.47, 0.045], [0.118, 0.04, 0.178]);
    } else if (shoes === 'sandals') {
      ball(leg, sockColor || SKIN, [0, -0.43, 0.05], [0.1, 0.055, 0.15]);
      add(leg, geoCyl, mat('#e88aa8'), [0, -0.48, 0.045], [0.125, 0.025, 0.18]);
      rod(leg, '#d9668c', [0.045, -0.43, 0.09], 0.012, 0.13, [0.3, 0, 0.8]);
      rod(leg, '#d9668c', [-0.045, -0.43, 0.09], 0.012, 0.13, [0.3, 0, -0.8]);
    } else {
      ball(leg, sockColor || SKIN, [0, -0.44, 0.05], [0.1, 0.06, 0.15]);
    }
  }

  function buildLeg(sp, side) {
    const leg = new T.Group();
    leg.position.set(side * sp.figure.legX, 0.5, 0);
    leg.scale.set(sp.figure.limb, 1, sp.figure.limb);
    const pants = sp.gender === 'male' && sp.pants === PANTS.home_shorts ? HOME_SHORTS_MALE : sp.pants;
    if (pants.short) {
      limb(leg, SKIN, [0, -0.27, 0], 0.08, 0.2);
      limb(leg, pants.color, [0, -0.09, 0], 0.115, 0.08);
    } else {
      limb(leg, pants.color, [0, -0.17, 0], 0.11, 0.2);
      ring(leg, pants.cuff || pants.color, [0, -0.31, 0], 0.095, 0.025, [Math.PI / 2, 0, 0]);
    }
    buildShoe(leg, sp);
    return leg;
  }

  function buildArm(sp, side, spec) {
    const arm = new T.Group();
    const p = sp.puff;
    arm.position.set(side * (sp.figure.armX + p * 0.85), 0.93, 0);
    arm.scale.set(sp.figure.limb, 1, sp.figure.limb);
    const outer = spec.outer;
    const bare = spec.bare;
    if (bare) {
      limb(arm, outer, [0, -0.07, 0], 0.095, 0.05);
      limb(arm, SKIN, [0, -0.2, 0], 0.075, 0.13);
    } else {
      limb(arm, outer, [0, -0.15, 0], 0.095 + p * 0.5, 0.16);
    }
    const gloved = sp.s.gloves === 'warm_gloves';
    if (spec.midCuff) ring(arm, spec.midCuff, [0, -0.28, 0], 0.09, 0.03, [Math.PI / 2, 0, 0]);
    const hand = ball(arm, gloved ? '#3a3a40' : SKIN, [0, -0.34, 0], [0.105, 0.105, 0.105]);
    if (gloved) ball(arm, '#55555c', [side * -0.08, -0.31, 0.04], [0.04, 0.05, 0.04]);
    arm.userData.hand = hand;
    return arm;
  }

  function buildPack(body, sp) {
    if (!sp.hasPack) return;
    const pack = new T.Group();
    pack.position.set(0, 0.86, -0.34 - sp.puff * 0.9);
    const main = sp.packColor;
    const dark = new T.Color(main).multiplyScalar(0.8).getStyle();
    ball(pack, main, [0, 0, 0], [0.285, 0.34, 0.17]);
    ball(pack, dark, [0, -0.1, -0.13], [0.18, 0.15, 0.07]);
    if (sp.pack.has('shelter')) rod(pack, '#8d9489', [0, 0.36, 0], 0.09, 0.42, [0, 0, Math.PI / 2]);
    if (sp.pack.has('overnight_kit')) rod(pack, '#8667bd', [0, -0.34, 0.02], 0.1, 0.5, [0, 0, Math.PI / 2]);
    if (sp.water) {
      rod(pack, '#6cc1e6', [-0.3, 0.02, 0.02], 0.058, 0.3);
      rod(pack, '#e8785c', [-0.3, 0.2, 0.02], 0.03, 0.05);
      for (let i = 0; i < sp.water; i++) ring(pack, '#fffdf6', [-0.3, -0.08 + i * 0.08, 0.02], 0.058, 0.006, [Math.PI / 2, 0, 0]);
    }
    body.add(pack);
    const strap = new T.Color(main).multiplyScalar(0.72).getStyle();
    [-1, 1].forEach((side) => {
      const r = 0.2 + sp.puff * 0.5;
      const m = rod(body, strap, [side * r * 0.72, 0.87, 0.21 + sp.puff * 0.8], 0.03, 0.4, [0.28, 0, 0]);
      m.scale.z = 0.012 / 0.03 * 0.03;
    });
  }

  function buildTorso(body, sp) {
    const list = sp.layers;
    const top = list[list.length - 1];
    const color = top === 'npc' ? sp.npcTop : TOPS[top];
    const dark = new T.Color(color).multiplyScalar(0.82).getStyle();
    const k = (1 + sp.puff * 2.4) * sp.figure.w;
    const torso = add(body, sp.gender === 'female' ? geoTorsoFemale : sp.gender === 'male' ? geoTorsoMale : geoTorso, mat(color), [0, 0.42, 0], [k, 1, k * 0.92]);
    torso.receiveShadow = true;
    ring(body, dark, [0, 0.46, 0], 0.335 * k, 0.03, [Math.PI / 2, 0, 0]).scale.set(1, 0.92, 1);
    const under = list[list.length - 2];
    if (under) {
      const c = TOPS[under];
      ring(body, c, [0, 1.03, 0.02], 0.15, 0.05, [Math.PI / 2, 0, 0]);
      ring(body, c, [0, 0.425, 0], 0.32 * k, 0.03, [Math.PI / 2, 0, 0]);
    }
    if (top === 'cotton') add(body, geoCyl, mat('#6d9bd1'), [0.1, 0.8, 0.31], [0.07, 0.01, 0.07], [Math.PI / 2, 0, 0]);
    if (top === 'rain_shell' || top === 'windbreaker' || top === 'fleece') {
      rod(body, new T.Color(color).multiplyScalar(0.68).getStyle(), [0, 0.74, 0.335 * k - 0.01], 0.012, 0.56, [-0.05, 0, 0]);
    }
    if (top === 'rain_shell') ball(body, dark, [0, 1.06, -0.19], [0.27, 0.13, 0.15]);
    if (top === 'down') {
      [0.58, 0.72, 0.86].forEach((y) => ring(body, dark, [0, y, 0], 0.345 * k * (y > 0.8 ? 0.84 : 1), 0.016, [Math.PI / 2, 0, 0]));
    }
    if (sp.poncho) {
      const m = new T.Mesh(new T.ConeGeometry(0.56, 0.95, 28, 1, true), mat('#bfe4f5', { transparent: true, opacity: 0.68, side: T.DoubleSide }));
      m.position.set(0, 0.75, 0);
      body.add(m);
    }
    if (sp.pack.has('whistle')) ball(body, '#f2c230', [-0.12, 0.76, 0.31], [0.05, 0.03, 0.03]);
    if (sp.pack.has('offline_map')) add(body, geoCyl, mat('#4a5468'), [0.13, 0.64, 0.33], [0.05, 0.012, 0.07], [Math.PI / 2, 0, 0]);
    return { outer: color, bare: top === 'wicking' || top === 'cotton' || top === 'home_tee', midCuff: list.length >= 3 ? TOPS[list[1]] : null };
  }

  function buildHead(body, sp) {
    const head = new T.Group();
    head.position.set(0, 1.42, 0.02);
    const R = 0.46;
    ball(head, SKIN, [0, 0, 0], [R, R * 0.95, R * 0.95]);
    ball(head, '#ffcfa6', [-0.455, -0.01, 0], [0.06, 0.08, 0.06]);
    ball(head, '#ffcfa6', [0.455, -0.01, 0], [0.06, 0.08, 0.06]);
    const face = new T.Mesh(
      new T.SphereGeometry(R * 1.008, 24, 16, Math.PI / 2 - 0.95, 1.9, Math.PI / 2 - 0.82, 1.64),
      new T.MeshStandardMaterial({ map: faceTexture('calm', sp.gender), transparent: true, roughness: 0.8 }),
    );
    face.scale.set(1, 0.95, 0.95);
    head.add(face);

    const { hat } = sp.s;
    const hair = sp.hair || HAIR;
    const cap = new T.Mesh(new T.SphereGeometry(R * 1.05, 28, 18, 0, TAU, 0, 1.4), mat(hair));
    cap.rotation.x = -0.42;
    cap.scale.set(1, 0.97, 1);
    cap.castShadow = true;
    head.add(cap);
    if (sp.gender === 'female') {
      /* 側分瀏海、耳邊髮絲，加一束從身後也看得到的馬尾 */
      ball(head, hair, [-0.15, 0.3, 0.28], [0.27, 0.1, 0.13], [0.5, 0, 0.5]);
      ball(head, hair, [0.2, 0.25, 0.3], [0.15, 0.09, 0.1], [0.5, 0, -0.55]);
      [-1, 1].forEach((x) => ball(head, hair, [x * 0.44, -0.13, 0.08], [0.075, 0.2, 0.1]));
      ball(head, hair, [0, -0.08, -0.3], [0.36, 0.3, 0.17]);
      ball(head, '#4fb3a5', [0, 0.1, -0.47], [0.075, 0.075, 0.05]);
      const tail = new T.Group();
      tail.position.set(0, 0.1, -0.5);
      ball(tail, hair, [0, -0.15, -0.07], [0.13, 0.2, 0.12], [-0.3, 0, 0]);
      ball(tail, hair, [0, -0.38, -0.1], [0.1, 0.2, 0.09], [-0.08, 0, 0]);
      ball(tail, hair, [0, -0.55, -0.09], [0.055, 0.1, 0.05]);
      head.add(tail);
      head.userData.tail = tail;
    } else if (sp.gender === 'male') {
      /* 平頭短髮：髮際線高、前額幾根尖刺。頂上不放圓球，圓球看起來就是包包頭 */
      cap.rotation.x = -0.5;
      cap.scale.set(1.01, 0.95, 1.02);
      if (!['sun_hat', 'npc_hat', 'beanie', 'helmet'].includes(hat)) {
        const spike = new T.ConeGeometry(0.085, 0.2, 7);
        [[-0.25, 0.34, 0.2, 0.45, 0.45], [-0.13, 0.4, 0.23, 0.55, 0.22], [0, 0.42, 0.24, 0.6, 0], [0.13, 0.4, 0.23, 0.55, -0.22], [0.25, 0.34, 0.2, 0.45, -0.45],
          [-0.16, 0.46, 0.02, 0.1, 0.25], [0.04, 0.48, 0.02, 0.1, -0.05], [0.2, 0.44, 0, 0.1, -0.3]].forEach(([x, y, z, rx, rz]) => {
          add(head, spike, mat(hair), [x, y, z], null, [rx, 0, rz]);
        });
      }
    } else {
      ball(head, hair, [-0.1, 0.28, 0.3], [0.24, 0.1, 0.13], [0.5, 0, 0.35]);
      ball(head, hair, [0.14, 0.3, 0.29], [0.18, 0.08, 0.12], [0.5, 0, -0.25]);
    }

    const dome = (color, r) => {
      const m = new T.Mesh(new T.SphereGeometry(r, 28, 14, 0, TAU, 0, Math.PI / 2), mat(color));
      m.castShadow = true;
      head.add(m);
      return m;
    };
    if (hat === 'sun_hat' || hat === 'npc_hat') {
      const crown = hat === 'sun_hat' ? '#d9bd85' : sp.hatColor;
      const band = hat === 'sun_hat' ? '#a98a57' : sp.bandColor;
      const d = dome(crown, 0.4);
      d.position.y = 0.2;
      add(head, geoCyl, mat(crown), [0, 0.2, 0], [0.72, 0.03, 0.72]);
      rod(head, band, [0, 0.235, 0], 0.405, 0.075);
    } else if (hat === 'beanie') {
      const d = dome('#d9534a', 0.49);
      d.position.y = 0.1;
      ring(head, '#b53f38', [0, 0.11, 0], 0.46, 0.055, [Math.PI / 2, 0, 0]);
      ball(head, '#f8e6d2', [0, 0.63, 0], [0.11, 0.11, 0.11]);
    } else if (hat === 'helmet') {
      const d = dome('#fffdf6', 0.5);
      d.position.y = 0.1;
      add(head, new T.BoxGeometry(0.2, 0.06, 0.03), mat('#e8605c'), [0, 0.38, 0.33], null, [-0.7, 0, 0]);
      add(head, new T.BoxGeometry(0.06, 0.2, 0.03), mat('#e8605c'), [0, 0.38, 0.33], null, [-0.7, 0, 0]);
    }
    if (sp.pack.has('sun_kit')) {
      [-0.16, 0.16].forEach((x) => ball(head, '#2c2a2e', [x, 0.03, 0.42], [0.105, 0.09, 0.03]));
      rod(head, '#2c2a2e', [0, 0.05, 0.44], 0.012, 0.08, [0, 0, Math.PI / 2]);
    }
    if (sp.pack.has('headlamp')) {
      ring(head, '#3d4450', [0, 0.14, 0], 0.46, 0.022, [Math.PI / 2, 0, 0]);
      rod(head, '#3d4450', [0, 0.14, 0.46], 0.07, 0.05, [Math.PI / 2, 0, 0]);
      ball(head, '#ffe98a', [0, 0.14, 0.49], [0.052, 0.052, 0.02]);
    }
    head.userData.face = face;
    head.userData.gender = sp.gender;
    body.add(head);
    return head;
  }

  /* 組出一個角色。原點在腳底，面向 +Z。 */
  function build(o) {
    const sp = specOf(o);
    const root = new T.Group();
    const body = new T.Group();
    body.scale.setScalar(sp.figure.height);
    root.add(body);
    const legL = buildLeg(sp, -1);
    const legR = buildLeg(sp, 1);
    body.add(legL, legR);
    const spec = buildTorso(body, sp);
    buildPack(body, sp);
    const armL = buildArm(sp, -1, spec);
    const armR = buildArm(sp, 1, spec);
    body.add(armL, armR);
    const head = buildHead(body, sp);

    let poleL = null;
    if (sp.poles) {
      poleL = new T.Group();
      poleL.position.set(0, -0.34, 0);
      rod(poleL, '#4a5468', [0, 0.02, 0], 0.03, 0.14);
      rod(poleL, '#8a8f98', [0, -0.28, 0.12], 0.014, 0.75, [0.32, 0, 0]);
      armR.add(poleL);
    }
    const bottle = new T.Group();
    bottle.position.set(0, -0.4, 0.04);
    rod(bottle, '#6cc1e6', [0, 0, 0], 0.055, 0.22);
    rod(bottle, '#e8785c', [0, 0.13, 0], 0.03, 0.04);
    bottle.visible = false;
    armR.add(bottle);
    const camera = new T.Group();
    camera.position.set(0, -0.4, 0.1);
    add(camera, new T.BoxGeometry(0.24, 0.16, 0.1), mat('#4a5468'));
    add(camera, geoCyl, mat('#a9ddf5'), [0, 0, 0.06], [0.05, 0.03, 0.05], [Math.PI / 2, 0, 0]);
    camera.visible = false;
    armR.add(camera);

    /* 淋濕滴水與呼出白氣 */
    const drips = [0, 1, 2].map(() => ball(root, '#8fd3f4', [0, -5, 0], [0.035, 0.05, 0.035]));
    const breath = new T.Mesh(geoSphere, new T.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0 }));
    breath.visible = false;
    root.add(breath);
    root.userData.parts = { body, head, legL, legR, armL, armR, bottle, camera, drips, breath, seed: Math.random() * 10 };
    return root;
  }

  function faceKind(s, seed) {
    if (s.pose === 'cheer') return 'happy';
    if (s.pose === 'stumble') return 'shock';
    if (!DH.art.reducedMotion() && (s.t + seed) % 3.7 < 0.12) return 'blink';
    return (s.risk || 0) >= 60 ? 'worried' : 'calm';
  }

  /* 依狀態擺姿勢；只改角度與位置，不重建模型 */
  function pose(root, s) {
    const P = root.userData.parts;
    const t = s.t || 0;
    const phase = s.phase || 0;
    const mv = s.moving ? 1 : 0;
    const swing = Math.sin(phase) * mv;
    const lift = Math.abs(Math.cos(phase)) * mv;
    const still = DH.art.reducedMotion();
    const breathing = still ? 0 : Math.sin(t * 2.1) * 0.012;

    P.body.position.set(0, lift * 0.05 + breathing + (s.jump || 0), 0);
    P.body.rotation.set(mv * 0.1, 0, 0);
    P.legL.rotation.x = -swing * 0.75;
    P.legR.rotation.x = swing * 0.75;
    P.armL.rotation.set(swing * 0.65, 0, -0.14);
    P.armR.rotation.set(-swing * 0.65, 0, 0.14);
    P.head.rotation.set(0, 0, s.headTilt || 0);
    P.bottle.visible = false;
    P.camera.visible = false;

    if (s.pose === 'cheer') {
      P.armL.rotation.set(0, 0, -2.6);
      P.armR.rotation.set(0, 0, 2.6);
    } else if (s.pose === 'wave') {
      P.armR.rotation.set(0, 0, 2.5 + Math.sin(t * 10) * 0.28);
    } else if (s.pose === 'drink') {
      P.armR.rotation.set(-2.5, 0, 0.1);
      P.bottle.visible = true;
      P.head.rotation.x = -0.25;
    } else if (s.pose === 'photo') {
      P.armR.rotation.set(-1.5, 0, 0.45);
      P.armL.rotation.set(-1.5, 0, -0.45);
      P.camera.visible = true;
    } else if (s.pose === 'stumble') {
      P.body.rotation.z = (still ? -0.08 : Math.sin(t * 20) * 0.1) - 0.05;
      P.armL.rotation.z = -1.1;
      P.armR.rotation.z = 1.1;
    } else if (s.pose === 'sit') {
      P.body.position.y -= 0.34;
      P.legL.rotation.x = -1.35;
      P.legR.rotation.x = -1.35;
    } else if ((s.risk || 0) >= 80) {
      P.body.rotation.x += 0.12;
    }

    const body = s.body || {};
    if (body.chilled) {
      if (!still) P.body.position.x = Math.sin(t * 34) * 0.012;
      if (!mv) {
        P.armL.rotation.set(-0.7, 0, 0.35);
        P.armR.rotation.set(-0.7, 0, -0.35);
      }
    }
    P.drips.forEach((d, i) => {
      if (!body.soaked) {
        d.visible = false;
        return;
      }
      const k = (t * 0.9 + i / 3) % 1;
      d.visible = true;
      d.position.set(-0.3 + i * 0.3, 1.2 - k * 0.65, 0.3 - i * 0.12);
    });
    if (body.chilled) {
      const k = (t * 0.55) % 1;
      P.breath.visible = true;
      P.breath.position.set(0.1, 1.3 + k * 0.28, 0.72 + k * 0.4);
      P.breath.scale.setScalar(0.03 + k * 0.1);
      P.breath.material.opacity = (1 - k) * 0.5;
    } else {
      P.breath.visible = false;
    }
    P.head.userData.face.material.map = faceTexture(faceKind(s, P.seed), P.head.userData.gender);
    /* 馬尾跟著腳步甩 */
    if (P.head.userData.tail) P.head.userData.tail.rotation.x = s.moving ? Math.sin((s.phase || 0) * 2) * 0.2 - 0.08 : Math.sin((s.t || 0) * 1.4) * 0.03;
  }

  /* 畫進 2D 畫面的小舞台：換裝預覽、成績卡 ------------------------------------ */
  const stage = {
    renderer: null,
    scene: null,
    camera: null,
    holder: null,
    actors: new Map(),
  };

  function initStage() {
    const renderer = new T.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
    renderer.setClearColor(0x000000, 0);
    const scene = new T.Scene();
    scene.add(new T.HemisphereLight('#fff7e6', '#c9b28f', 1.9));
    const key = new T.DirectionalLight('#fff4dc', 2.3);
    key.position.set(2.5, 5, 5);
    scene.add(key);
    const camera = new T.PerspectiveCamera(22, 1, 0.1, 40);
    camera.position.set(0, 1.5, 9);
    camera.lookAt(0, 1.2, 0);
    const holder = new T.Group();
    scene.add(holder);
    Object.assign(stage, { renderer, scene, camera, holder });
  }

  /* 同一套打扮只組一次模型，不用每幀重建 */
  function actorFor(o) {
    const key = JSON.stringify([o.outfit || null, o.colors || null, !!o.helmet, DH.player.gender]);
    if (!stage.actors.has(key)) {
      if (stage.actors.size > 24) {
        stage.actors.forEach((actor) => {
          actor.removeFromParent();
          dispose(actor);
        });
        stage.actors.clear();
      }
      stage.actors.set(key, build(o));
    }
    return stage.actors.get(key);
  }

  /* 和 2D 的 drawHiker 同一份參數：(x, y) 是腳底，scale 1 約 112 像素高 */
  function drawSprite(c, x, y, o) {
    if (!stage.renderer) initStage();
    const s = o.scale || 1;
    const size = 190 * s;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const px = Math.min(1024, Math.max(128, Math.round(size * ratio)));
    if (stage.renderer.domElement.width !== px) stage.renderer.setSize(px, px, false);
    const actor = actorFor(o);
    stage.holder.children.slice().forEach((n) => stage.holder.remove(n));
    stage.holder.add(actor);
    actor.rotation.y = (o.dir === -1 ? -1 : 1) * 0.42;
    pose(actor, { t: o.t, phase: o.phase, moving: o.moving, pose: o.pose, jump: (o.jump || 0) * 0.012, body: o.body, risk: o.risk, headTilt: o.headTilt });
    stage.renderer.render(stage.scene, stage.camera);
    c.save();
    c.fillStyle = 'rgba(50,30,20,.2)';
    c.beginPath();
    c.ellipse(x, y - 1, 46 * s, 11 * s, 0, 0, TAU);
    c.fill();
    c.drawImage(stage.renderer.domElement, x - size / 2, y - size * 0.86, size, size);
    c.restore();
  }

  function supported() {
    if (!T) return false;
    try {
      const cv = document.createElement('canvas');
      return !!(cv.getContext('webgl2') || cv.getContext('webgl'));
    } catch (e) {
      return false;
    }
  }

  DH.hero3d = { active: false, supported, build, pose, dispose, drawSprite };
})();
