/* 選山卡、預報、分享卡用的山景與換裝房間：都是即時算出來的 3D 模型，和路上同一種玩具風格。
   只算一次，算完存成畫布，之後當成一般圖片用。山形是依地形描述做的示意，不是實際地形。 */
(function () {
  const DH = (window.DH = window.DH || {});
  const T = window.THREE;

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const smooth = (a, b, v) => {
    const k = clamp((v - a) / (b - a), 0, 1);
    return k * k * (3 - 2 * k);
  };
  const hash = (x, y) => {
    const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
    return s - Math.floor(s);
  };
  function noise(x, y) {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    const fx = x - ix;
    const fy = y - iy;
    const ux = fx * fx * (3 - 2 * fx);
    const uy = fy * fy * (3 - 2 * fy);
    return (hash(ix, iy) * (1 - ux) + hash(ix + 1, iy) * ux) * (1 - uy) + (hash(ix, iy + 1) * (1 - ux) + hash(ix + 1, iy + 1) * ux) * uy;
  }
  const fbm = (x, y) => noise(x, y) * 0.55 + noise(x * 2.1, y * 2.1) * 0.28 + noise(x * 4.3, y * 4.3) * 0.17;
  /* 銳利的山脊：把雜訊折起來 */
  const ridged = (x, y) => 1 - Math.abs(fbm(x, y) * 2 - 1);
  const C = (hex) => new T.Color(hex);

  const peak = (x, z, px, pz, radius, height) => height * Math.exp(-((x - px) ** 2 + (z - pz) ** 2) / (radius * radius));

  /* 每座山：height(x, z) 是山形（半徑 1 的圓盤上），paint(h, slope, x, z) 是顏色，trees 是樹長在哪、什麼顏色 */
  const MOUNTAINS = {
    qixing: {
      sky: ['#9fc9df', '#f4e7cf'],
      height: (x, z) => 0.62 * Math.pow(Math.max(0, 1 - (x * x + z * z) / 0.92), 0.72) + (fbm(x * 3 + 2, z * 3) - 0.5) * 0.05,
      paint: (h, x, z) => (fbm(x * 9, z * 9) > 0.56 ? C('#e4d596') : C('#bcb268')).lerp(C('#6f8f54'), 1 - smooth(0.02, 0.2, h)),
      plumes: 900,
      trees: { count: 40, where: (h) => h < 0.13, tint: ['#5f8f55'], round: true },
      steam: [[0.52, 0.42]],
      trail: [[-0.1, 0.92], [0.18, 0.55], [-0.1, 0.28], [0.02, 0]],
      trailColor: '#a9a596',
    },
    hehuan: {
      sky: ['#79b8e8', '#e4f3f5'],
      height: (x, z) => peak(x, z, -0.1, -0.15, 0.72, 0.5) + peak(x, z, 0.55, 0.05, 0.42, 0.26) + (fbm(x * 2.4, z * 2.4) - 0.5) * 0.08,
      paint: (h, x, z) => (fbm(x * 12, z * 12) > 0.5 ? C('#7fae62') : C('#68994f')).lerp(C('#a7b37a'), smooth(0.34, 0.52, h) * 0.65),
      blobs: { count: 460, tint: '#6d9f55', s: [0.018, 0.04] },
      trees: { count: 14, where: (h) => h < 0.1, tint: ['#3f7a5f'] },
      trail: [[0.2, 0.92], [-0.2, 0.55], [0.05, 0.3], [-0.1, -0.15]],
      trailColor: '#ddd5bc',
    },
    jiali: {
      sky: ['#8cc6dd', '#e5f2e0'],
      height: (x, z) => peak(x, z, 0.02, -0.12, 0.55, 0.56) + peak(x, z, -0.48, 0.2, 0.34, 0.2) + peak(x, z, 0.52, 0.18, 0.3, 0.17) + (fbm(x * 3, z * 3) - 0.5) * 0.08,
      paint: () => C('#3f7f4c'),
      trees: { count: 780, where: (h) => h < 0.5, tint: ['#2f7f5e', '#3a8f58', '#2a7558', '#4f9d58'], mixRound: 0.45 },
      stream: [[-0.65, 0.76], [-0.2, 0.55], [0.1, 0.62], [0.45, 0.48], [0.82, 0.48]],
      trail: [[0.15, 0.96], [-0.02, 0.62], [0.1, 0.3], [0.02, -0.12]],
      trailColor: '#b08f63',
    },
    yushan: {
      sky: ['#5f9ad8', '#f0dfc8'],
      height: (x, z) => {
        const body = peak(x, z, 0, -0.1, 0.48, 0.82) + peak(x, z, -0.42, -0.02, 0.28, 0.26) + peak(x, z, 0.44, 0.02, 0.26, 0.3);
        return body * (0.78 + ridged(x * 3.4 + 7, z * 3.4) * 0.34) + (fbm(x * 6, z * 6) - 0.5) * 0.03;
      },
      paint: (h, x, z) => {
        const rock = (fbm(x * 8, z * 8) > 0.52 ? C('#5f6068') : C('#83848a')).lerp(C('#9a8069'), smooth(0.52, 0.72, fbm(x * 5 + 3, z * 5)) * 0.2);
        return C('#3f7f5f').lerp(rock, smooth(0.2, 0.32, h + (fbm(x * 7, z * 7) - 0.5) * 0.1));
      },
      trees: { count: 520, where: (h) => h < 0.2, tint: ['#2f6f58', '#3a7f60'] },
      clouds: [[-0.75, 0.22, 0.1], [0.8, 0.28, 0.25], [0.1, 0.3, 0.72]],
      trail: [[0.3, 0.92], [0.5, 0.45], [0.15, 0.3], [0.2, 0.05], [0, -0.1]],
      trailColor: '#cdbd9f',
    },
    xueshan: {
      sky: ['#7fb0dc', '#e9eef0'],
      height: (x, z) => {
        const r = Math.hypot(x, z + 0.08);
        const ang = Math.atan2(x, z + 0.08);
        /* 圈谷：後方與兩側一圈岩壁，前方開口 */
        const open = smooth(0.2, 1.3, Math.abs(ang));
        const rim = Math.exp(-((r - 0.55) ** 2) / 0.05) * open * 0.74;
        return rim * (0.84 + ridged(x * 4 + 3, z * 4) * 0.26) + 0.09 * (1 - r * r) + (fbm(x * 4, z * 4) - 0.5) * 0.04;
      },
      paint: (h, x, z) => {
        const rock = fbm(x * 9, z * 9) > 0.5 ? C('#c0bfb4') : C('#a3a297');
        const snow = smooth(0.4, 0.56, h + (fbm(x * 14, z * 14) - 0.5) * 0.14);
        return C('#2f5f4c').lerp(rock, smooth(0.12, 0.2, h)).lerp(C('#f6f8f8'), snow * 0.92);
      },
      trees: { count: 560, where: (h, x, z) => h < 0.15 && z > 0.05, tint: ['#143a32', '#173f36', '#1b463c'], s: 1.25 },
      trail: [[0.05, 0.94], [-0.12, 0.6], [0.1, 0.34], [0, 0.04], [0, -0.42]],
      trailColor: '#d3c6aa',
    },
    nanhu: {
      sky: ['#6fa8d6', '#e8e5d6'],
      height: (x, z) => {
        const shoulders = peak(x, z, 0, -0.2, 0.62, 0.58) + peak(x, z, -0.5, -0.1, 0.4, 0.26) + peak(x, z, 0.55, -0.1, 0.42, 0.3);
        /* 五岩峰：一列小尖峰沿著前方的長稜排開 */
        let spires = 0;
        for (let i = 0; i < 5; i++) spires += peak(x, z, 0.22 + i * 0.13, 0.16 + i * 0.09, 0.055, 0.2);
        return shoulders * (0.84 + ridged(x * 3 + 11, z * 3) * 0.24) + spires;
      },
      paint: (h, x, z) => {
        const rock = fbm(x * 8, z * 8) > 0.5 ? C('#8f8d84') : C('#a7a497');
        const grass = fbm(x * 11, z * 11) > 0.5 ? C('#7f9c5a') : C('#6c8f54');
        return C('#3f7a5c').lerp(grass, smooth(0.08, 0.16, h)).lerp(rock, smooth(0.3, 0.42, h + (fbm(x * 6, z * 6) - 0.5) * 0.14)).lerp(C('#f4f6f5'), smooth(0.56, 0.62, h) * (fbm(x * 15, z * 15) > 0.46 ? 0.9 : 0.1));
      },
      trees: { count: 300, where: (h) => h < 0.09, tint: ['#2f6f58', '#3a7a60'] },
      trail: [[-0.3, 0.92], [-0.05, 0.6], [0.2, 0.44], [0.08, 0.2], [0, -0.2]],
      trailColor: '#d8cbac',
    },
  };

  function bluntCone(radius, height) {
    const pts = [[0, 0], [radius * 0.82, 0.02], [radius, height * 0.12], [radius * 0.5, height * 0.68], [radius * 0.16, height * 0.97], [0, height]];
    return new T.LatheGeometry(pts.map(([x, y]) => new T.Vector2(x, y)), 9);
  }

  function nearPolyline(x, z, line) {
    let best = Infinity;
    for (let i = 0; i < line.length - 1; i++) {
      const [ax, az] = line[i];
      const [bx, bz] = line[i + 1];
      const dx = bx - ax;
      const dz = bz - az;
      const k = clamp(((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz), 0, 1);
      best = Math.min(best, Math.hypot(x - ax - dx * k, z - az - dz * k));
    }
    return best;
  }

  function buildLand(m, RINGS = 150, SEGS = 260) {
    const verts = [];
    const colors = [];
    const index = [];
    const heightOf = (x, z) => {
      const r = Math.hypot(x, z);
      return Math.max(0, m.height(x, z)) * (1 - smooth(0.86, 1, r)) + 0.012;
    };
    const col = new T.Color();
    verts.push(0, heightOf(0, 0), 0);
    colors.push(0.5, 0.5, 0.5);
    for (let r = 1; r <= RINGS; r++) {
      const rad = r / RINGS;
      for (let q = 0; q < SEGS; q++) {
        const a = (q / SEGS) * Math.PI * 2;
        const x = Math.sin(a) * rad;
        const z = Math.cos(a) * rad;
        const h = heightOf(x, z);
        col.copy(m.paint(h, x, z));
        if (m.trail && nearPolyline(x, z, m.trail) < 0.012) col.set(m.trailColor);
        if (m.stream && nearPolyline(x, z, m.stream) < 0.02) col.set('#7cc6e4');
        col.multiplyScalar(0.94 + noise(x * 30, z * 30) * 0.12);
        verts.push(x, h, z);
        colors.push(col.r, col.g, col.b);
      }
    }
    for (let q = 0; q < SEGS; q++) index.push(0, 1 + q, 1 + ((q + 1) % SEGS));
    for (let r = 0; r < RINGS - 1; r++) {
      for (let q = 0; q < SEGS; q++) {
        const a = 1 + r * SEGS + q;
        const b = 1 + r * SEGS + ((q + 1) % SEGS);
        const c = a + SEGS;
        const d = b + SEGS;
        index.push(a, c, b, b, c, d);
      }
    }
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(verts, 3));
    g.setAttribute('color', new T.Float32BufferAttribute(colors, 3));
    g.setIndex(index);
    g.computeVertexNormals();
    const land = new T.Mesh(g, new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, side: T.DoubleSide }));
    land.castShadow = true;
    land.receiveShadow = true;
    return { land, heightOf };
  }

  function instanced(group, geo, list, castShadow) {
    if (!list.length) return;
    const inst = new T.InstancedMesh(geo, new T.MeshStandardMaterial({ roughness: 0.85 }), list.length);
    const d = new T.Object3D();
    list.forEach((it, i) => {
      d.position.set(it.x, it.y, it.z);
      d.rotation.set(it.rx || 0, it.yaw || 0, 0);
      d.scale.set(it.s, it.sy || it.s, it.s);
      d.updateMatrix();
      inst.setMatrixAt(i, d.matrix);
      inst.setColorAt(i, it.c);
    });
    inst.castShadow = castShadow !== false;
    inst.receiveShadow = true;
    group.add(inst);
  }

  function randomIn(i, salt) {
    return hash(i * 1.37 + salt, i * 0.71 - salt);
  }

  function buildMountain(id) {
    const m = MOUNTAINS[id];
    const group = new T.Group();
    const { land, heightOf } = buildLand(m);
    group.add(land);
    /* 底座：一塊切下來的土台，看起來像桌上的模型 */
    const base = new T.Mesh(new T.CylinderGeometry(1, 0.93, 0.16, 96), new T.MeshStandardMaterial({ color: '#8d6a4e', roughness: 1 }));
    base.position.y = -0.07;
    base.castShadow = true;
    base.receiveShadow = true;
    group.add(base);
    const top = new T.Mesh(new T.CylinderGeometry(1, 1, 0.022, 96), new T.MeshStandardMaterial({ color: '#6f8f54', roughness: 1 }));
    top.position.y = 0.002;
    group.add(top);

    const pointOnDisc = (i, salt) => {
      const a = randomIn(i, salt) * Math.PI * 2;
      const r = Math.sqrt(randomIn(i, salt + 3)) * 0.93;
      return { x: Math.sin(a) * r, z: Math.cos(a) * r };
    };
    const cones = [];
    const trunks = [];
    const rounds = [];
    if (m.trees) {
      const tree = m.trees;
      let planted = 0;
      for (let i = 0; i < tree.count * 6 && planted < tree.count; i++) {
        const { x, z } = pointOnDisc(i, 1);
        const h = heightOf(x, z);
        if (!tree.where(h, x, z)) continue;
        if (m.trail && nearPolyline(x, z, m.trail) < 0.028) continue;
        if (m.stream && nearPolyline(x, z, m.stream) < 0.04) continue;
        planted++;
        const s = (0.016 + randomIn(i, 5) * 0.012) * (tree.s || 1);
        const c = C(tree.tint[i % tree.tint.length]).multiplyScalar(0.86 + randomIn(i, 6) * 0.28);
        trunks.push({ x, y: h, z, s: s * 0.7, sy: s, c: C('#7b5438') });
        if (tree.round || randomIn(i, 7) < (tree.mixRound || 0)) rounds.push({ x, y: h + s * 2.6, z, s: s * 1.5, c });
        else cones.push({ x, y: h + s * 0.5, z, s, sy: s * 1.25, c, yaw: randomIn(i, 8) * 6 });
      }
    }
    instanced(group, new T.CylinderGeometry(0.28, 0.34, 2.4, 6).translate(0, 1.2, 0), trunks, false);
    instanced(group, bluntCone(1.25, 4.6), cones);
    instanced(group, new T.IcosahedronGeometry(1, 1), rounds);

    if (m.plumes) {
      const list = [];
      for (let i = 0; i < m.plumes; i++) {
        const { x, z } = pointOnDisc(i, 21);
        if (nearPolyline(x, z, m.trail) < 0.02) continue;
        list.push({ x, y: heightOf(x, z), z, s: 0.012, sy: 0.018 + randomIn(i, 22) * 0.012, yaw: randomIn(i, 23) * 6, rx: 0.2, c: C('#f2e9cc').multiplyScalar(0.9 + randomIn(i, 24) * 0.14) });
      }
      instanced(group, new T.ConeGeometry(0.9, 2.4, 5).translate(0, 1.2, 0), list, false);
    }
    if (m.blobs) {
      const list = [];
      for (let i = 0; i < m.blobs.count; i++) {
        const { x, z } = pointOnDisc(i, 31);
        if (nearPolyline(x, z, m.trail) < 0.03) continue;
        const s = m.blobs.s[0] + randomIn(i, 32) * (m.blobs.s[1] - m.blobs.s[0]);
        list.push({ x, y: heightOf(x, z) + s * 0.1, z, s, sy: s * 0.55, c: C(m.blobs.tint).multiplyScalar(0.85 + randomIn(i, 33) * 0.3) });
      }
      instanced(group, new T.IcosahedronGeometry(1, 1), list);
    }
    const puffMat = new T.MeshStandardMaterial({ color: '#ffffff', roughness: 1, emissive: '#ffffff', emissiveIntensity: 0.35 });
    (m.clouds || []).forEach(([x, y, z], c) => {
      for (let i = 0; i < 6; i++) {
        const p = new T.Mesh(new T.IcosahedronGeometry(1, 2), puffMat);
        const s = 0.07 + randomIn(i, c + 40) * 0.07;
        p.position.set(x + (i - 2.5) * 0.08, y + randomIn(i, c + 41) * 0.03, z + randomIn(i, c + 42) * 0.08);
        p.scale.set(s, s * 0.6, s);
        group.add(p);
      }
    });
    (m.steam || []).forEach(([x, z]) => {
      const y = heightOf(x, z);
      for (let i = 0; i < 7; i++) {
        const p = new T.Mesh(new T.IcosahedronGeometry(1, 2), new T.MeshStandardMaterial({ color: '#ffffff', roughness: 1, emissive: '#ffffff', emissiveIntensity: 0.35, transparent: true, opacity: 0.8 - i * 0.08 }));
        const s = 0.022 + i * 0.012;
        p.position.set(x + Math.sin(i * 1.4) * 0.018 * i * 0.5, y + 0.03 + i * 0.036, z);
        p.scale.setScalar(s);
        group.add(p);
      }
    });
    return group;
  }

  function skyTexture(top, low) {
    const cv = document.createElement('canvas');
    cv.width = 4;
    cv.height = 256;
    const c = cv.getContext('2d');
    const g = c.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0, top);
    g.addColorStop(0.75, low);
    g.addColorStop(1, low);
    c.fillStyle = g;
    c.fillRect(0, 0, 4, 256);
    const tex = new T.CanvasTexture(cv);
    tex.colorSpace = T.SRGBColorSpace;
    return tex;
  }

  function addLights(scene, sunColor, sunPower, hemiPower) {
    scene.add(new T.HemisphereLight('#fff6e8', '#8a8f7a', hemiPower));
    const sun = new T.DirectionalLight(sunColor, sunPower);
    sun.position.set(-2.4, 3.4, 2.8);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    Object.assign(sun.shadow.camera, { left: -1.4, right: 1.4, top: 1.4, bottom: -1.4, near: 0.5, far: 9 });
    sun.shadow.bias = -0.0008;
    sun.shadow.normalBias = 0.012;
    scene.add(sun);
  }

  function snapshot(renderer) {
    const cv = document.createElement('canvas');
    cv.width = renderer.domElement.width;
    cv.height = renderer.domElement.height;
    cv.getContext('2d').drawImage(renderer.domElement, 0, 0);
    return cv;
  }

  function renderMountain(renderer, id) {
    const m = MOUNTAINS[id];
    const scene = new T.Scene();
    scene.background = skyTexture(m.sky[0], m.sky[1]);
    addLights(scene, '#fff0d4', 2.7, 1.5);
    const group = buildMountain(id);
    group.position.y = -0.14;
    scene.add(group);
    /* 選山卡很扁，所以把整座模型放在畫面中央偏小，上下留白讓裁切不會切到山 */
    const camera = new T.PerspectiveCamera(24, 3 / 2, 0.1, 30);
    camera.position.set(0, 1.25, 5.4);
    camera.lookAt(0, 0.3, 0);
    renderer.setSize(1080, 720, false);
    renderer.render(scene, camera);
    return snapshot(renderer);
  }

  /* 出發前夜的房間：直視的一面牆加地板，中間留給角色站 */
  function renderRoom(renderer) {
    const scene = new T.Scene();
    scene.background = C('#2e2a33');
    scene.add(new T.HemisphereLight('#ffe9cc', '#8a6a4e', 1.25));
    const lamp = new T.PointLight('#ffc27a', 7, 7);
    lamp.position.set(1.55, 1.75, 0.5);
    lamp.castShadow = true;
    scene.add(lamp);
    const mat = (color, o) => new T.MeshStandardMaterial(Object.assign({ color, roughness: 0.82 }, o));
    const box = (w, h, d, color, x, y, z, o) => {
      const m = new T.Mesh(new T.BoxGeometry(w, h, d), mat(color, o));
      m.position.set(x, y, z);
      m.castShadow = true;
      m.receiveShadow = true;
      scene.add(m);
      return m;
    };
    box(7, 4, 0.1, '#f2dfbb', 0, 2, -1.1);
    box(7, 0.1, 5, '#b98452', 0, -0.05, 1.2);
    for (let i = 0; i < 11; i++) box(0.012, 0.012, 5, '#8f6238', -3.3 + i * 0.66, 0.002, 1.2);
    box(7, 0.14, 0.05, '#c9a878', 0, 0.07, -1.03);
    /* 窗外：黃昏的天色和遠山 */
    const cv = document.createElement('canvas');
    cv.width = 256;
    cv.height = 256;
    const c = cv.getContext('2d');
    const g = c.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0, '#39477c');
    g.addColorStop(0.72, '#f0a878');
    c.fillStyle = g;
    c.fillRect(0, 0, 256, 256);
    c.fillStyle = '#34405f';
    c.beginPath();
    c.moveTo(0, 256);
    [[0, 190], [50, 150], [96, 176], [150, 112], [200, 170], [256, 148], [256, 256]].forEach(([x, y]) => c.lineTo(x, y));
    c.fill();
    const tex = new T.CanvasTexture(cv);
    tex.colorSpace = T.SRGBColorSpace;
    const pane = new T.Mesh(new T.PlaneGeometry(1.15, 1.15), new T.MeshBasicMaterial({ map: tex }));
    pane.position.set(-1.25, 2.02, -1.03);
    scene.add(pane);
    box(1.32, 0.08, 0.1, '#fff5e2', -1.25, 2.62, -1.0);
    box(1.32, 0.1, 0.16, '#fff5e2', -1.25, 1.42, -0.98);
    box(0.08, 1.2, 0.1, '#fff5e2', -1.87, 2.02, -1.0);
    box(0.08, 1.2, 0.1, '#fff5e2', -0.63, 2.02, -1.0);
    box(1.15, 0.05, 0.05, '#fff5e2', -1.25, 2.02, -1.0);
    /* 床 */
    box(1.5, 0.34, 1.9, '#8a5a3b', -2.15, 0.2, -0.05);
    box(1.44, 0.2, 1.84, '#fbf2dc', -2.15, 0.46, -0.05);
    box(1.48, 0.1, 1.2, '#5f9a7f', -2.15, 0.6, 0.3);
    box(0.92, 0.18, 0.46, '#fffdf6', -2.15, 0.64, -0.68);
    /* 書架與檯燈 */
    box(1.25, 0.08, 0.5, '#9a6a44', 1.75, 0.62, -0.72);
    box(1.25, 0.08, 0.5, '#9a6a44', 1.75, 1.2, -0.72);
    [-0.58, 0.58].forEach((d) => box(0.08, 1.24, 0.5, '#8a5a3b', 1.75 + d, 0.62, -0.72));
    ['#c9553f', '#3f7f6a', '#e2b04e', '#55708f', '#b36b8a', '#7f9a55'].forEach((color, i) => {
      box(0.1, 0.34 + (i % 3) * 0.05, 0.3, color, 1.3 + i * 0.12, 0.84 + ((i % 3) * 0.05) / 2, -0.72);
    });
    box(0.1, 0.02, 0.1, '#6b4a34', 1.55, 1.25, -0.72);
    box(0.03, 0.42, 0.03, '#6b4a34', 1.55, 1.46, -0.72);
    const shade = new T.Mesh(new T.ConeGeometry(0.2, 0.22, 16), mat('#ffe2a8', { emissive: '#ffbe6a', emissiveIntensity: 1.3 }));
    shade.position.set(1.55, 1.76, -0.72);
    scene.add(shade);
    /* 牆上的等高線地圖，沒有字 */
    const mapCv = document.createElement('canvas');
    mapCv.width = 256;
    mapCv.height = 192;
    const mc = mapCv.getContext('2d');
    mc.fillStyle = '#f7efd8';
    mc.fillRect(0, 0, 256, 192);
    mc.strokeStyle = '#a8865a';
    mc.lineWidth = 2;
    [20, 38, 56, 74, 92].forEach((r) => {
      mc.beginPath();
      mc.ellipse(124, 100, r * 1.3, r, 0.3, 0, Math.PI * 2);
      mc.stroke();
    });
    mc.strokeStyle = '#c9553f';
    mc.lineWidth = 4;
    mc.beginPath();
    mc.moveTo(20, 170);
    mc.bezierCurveTo(70, 150, 90, 120, 124, 100);
    mc.stroke();
    const mapTex = new T.CanvasTexture(mapCv);
    mapTex.colorSpace = T.SRGBColorSpace;
    const map = new T.Mesh(new T.PlaneGeometry(1.15, 0.86), new T.MeshStandardMaterial({ map: mapTex, roughness: 0.9 }));
    map.position.set(1.6, 2.4, -1.03);
    scene.add(map);
    /* 地毯：角色站的地方 */
    const rug = new T.Mesh(new T.CylinderGeometry(1.15, 1.15, 0.03, 48), mat('#d9765a'));
    rug.position.set(0, 0.016, 0.45);
    rug.scale.z = 0.62;
    rug.receiveShadow = true;
    scene.add(rug);
    const rugIn = new T.Mesh(new T.CylinderGeometry(0.9, 0.9, 0.034, 48), mat('#f0c98f'));
    rugIn.position.set(0, 0.018, 0.45);
    rugIn.scale.z = 0.62;
    scene.add(rugIn);
    const camera = new T.PerspectiveCamera(36, 1, 0.1, 30);
    camera.position.set(0, 1.55, 5.2);
    camera.lookAt(0, 1.15, 0);
    renderer.setSize(720, 720, false);
    renderer.render(scene, camera);
    return snapshot(renderer);
  }

  DH.diorama = {
    ids: Object.keys(MOUNTAINS),
    /* 路線盡頭遠方的那座山：和選山卡同一個形狀，玩家看得出自己正走向它 */
    landmark(id, detail) {
      const m = MOUNTAINS[id];
      return m ? buildLand(m, detail, detail * 2).land : null;
    },
    /* 全部畫好放進 paintings，檔名與手繪版相同，所以用圖的地方都不用改 */
    paintAll(paintings, onPainted) {
      const renderer = new T.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
      renderer.setPixelRatio(1);
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = T.PCFSoftShadowMap;
      /* 一次畫一張，中間把時間還給瀏覽器，開場不會卡住 */
      const jobs = Object.keys(MOUNTAINS).map((id) => [`mtn-${id}`, () => renderMountain(renderer, id)]);
      jobs.push(['room-night', () => renderRoom(renderer)]);
      const next = () => {
        const job = jobs.shift();
        if (!job) {
          renderer.dispose();
          renderer.forceContextLoss();
          return;
        }
        paintings[job[0]] = job[1]();
        onPainted(job[0]);
        setTimeout(next, 0);
      };
      next();
    },
  };
})();
