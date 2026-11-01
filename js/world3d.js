/* 3D 山徑：把遊戲的 (x, d) 路線座標放進一條蜿蜒的立體步道。遊戲邏輯仍只看 x 與 d。 */
(function () {
  const DH = window.DH;
  const T = window.THREE;
  const A = DH.art;
  const H = DH.hero3d;
  let look = DH.biomes.resolve('default', 'summer');
  const swayU = { time: { value: 0 }, amp: { value: 0.05 } };
  const { FINISH_X, makeRng } = DH.core;

  const UNIT = 0.03;
  const PATH_W = 3.4;
  const STEP = 20;
  const X_MIN = -700;
  const X_MAX = FINISH_X + 700;
  /* 手機先用輕一點的設定，電腦才開滿；之後 watchSpeed 還會依實際速度再調 */
  const PHONE = matchMedia('(pointer: coarse)').matches;
  const CELL = PHONE ? 1.25 : 0.95;
  /* 截圖用：不要因為截圖環境慢就自動降畫質 */
  const FULL_QUALITY = new URLSearchParams(location.search).get('quality') === 'max';
  const ELEVATION = [[-700, 0], [1400, 2.5], [3200, 11], [4800, 18], [5300, 20], [5800, 19.5], [7400, 2], [8100, 0]];

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
  const fbm = (x, y) => noise(x, y) * 0.6 + noise(x * 2.1, y * 2.1) * 0.28 + noise(x * 4.3, y * 4.3) * 0.12;

  function elevationAt(x) {
    for (let i = 1; i < ELEVATION.length; i++) {
      if (x <= ELEVATION[i][0]) {
        const [x0, y0] = ELEVATION[i - 1];
        const [x1, y1] = ELEVATION[i];
        return y0 + (y1 - y0) * smooth(x0, x1, x);
      }
    }
    return 0;
  }

  /* 路線：每 STEP 取一點，往前（-Z）蜿蜒 */
  const route = (() => {
    const pts = [];
    let px = 0;
    let pz = 0;
    for (let x = X_MIN; x <= X_MAX; x += STEP) {
      const heading = 0.5 * Math.sin(x / 820) + 0.26 * Math.sin(x / 330 + 1.2);
      px += Math.sin(heading) * STEP * UNIT;
      pz -= Math.cos(heading) * STEP * UNIT;
      pts.push({ x, px, pz, y: elevationAt(x), tx: Math.sin(heading), tz: -Math.cos(heading) });
    }
    return pts;
  })();

  function sampleRoute(x) {
    const f = clamp((x - X_MIN) / STEP, 0, route.length - 1.001);
    const i = Math.floor(f);
    const k = f - i;
    const a = route[i];
    const b = route[i + 1];
    const tx = a.tx + (b.tx - a.tx) * k;
    const tz = a.tz + (b.tz - a.tz) * k;
    return { px: a.px + (b.px - a.px) * k, pz: a.pz + (b.pz - a.pz) * k, y: a.y + (b.y - a.y) * k, tx, tz, nx: -tz, nz: tx };
  }

  /* 路面上的位置；d 是路寬比例（0～1），u 是離路中央的距離 */
  function place(x, u) {
    const s = sampleRoute(x);
    return new T.Vector3(s.px + s.nx * u, s.y, s.pz + s.nz * u);
  }

  /* 地形：路旁壓平。登山口與森林兩側微微隆起；稜線與山頂兩側往下落。 */
  const sectionMix = (x) => ({
    ridge: smooth(2900, 3700, x) * (1 - smooth(5900, 6500, x)),
    summit: smooth(4700, 5100, x) * (1 - smooth(5650, 5950, x)),
    forest: smooth(1100, 1700, x) * (1 - smooth(3000, 3500, x)),
    dusk: smooth(5800, 6500, x),
  });

  function terrainHeight(x, dist, wx, wz) {
    const m = sectionMix(x);
    const R = look.biome.relief;
    /* 路旁先略低於路面，地形網格才不會從步道穿出來 */
    const edge = smooth(PATH_W * 0.8, PATH_W * 2.4, dist);
    const sink = -0.32 * (1 - smooth(PATH_W * 0.72, PATH_W, dist));
    const n = fbm(wx * 0.06, wz * 0.06);
    const gentle = dist * 0.09 + (n - 0.42) * 7 * R.rough;
    const falling = Math.max(-15, -Math.pow(Math.max(0, dist - 3), 1.2) * 0.62) * R.fall + (n - 0.5) * 5 * R.rough;
    /* 圈谷：稜線以上兩側是環抱的岩壁，不是往下掉的山崖 */
    const wall = R.wall * m.ridge * smooth(9, 42, dist) * (20 + n * 16);
    return sink + edge * (gentle * (1 - m.ridge) + falling * m.ridge + wall);
  }

  /* 這個高度積多少雪（0～1）；只有冬天、且高過這座山的雪線才有 */
  function snowAt(y, n) {
    return look.seasonFx.snow * smooth(look.biome.snowFrom, look.biome.snowFrom + 3.5, y + (n - 0.5) * 3);
  }

  function groundColor(x, dist, col, y) {
    const m = sectionMix(x);
    const n = fbm(x * 0.012, dist * 0.14);
    const G = look.biome.ground;
    const base = new T.Color(G.open);
    base.lerp(new T.Color(G.forest), m.forest);
    base.lerp(new T.Color(G.ridge), m.ridge * 0.9);
    base.lerp(new T.Color(G.summit), m.summit);
    base.lerp(new T.Color(G.dusk), m.dusk * 0.8);
    base.lerp(new T.Color('#c9ad5e'), look.seasonFx.gold);
    base.multiplyScalar(0.72 + n * 0.56);
    base.lerp(new T.Color('#f9fcff'), snowAt(y, fbm(x * 0.03, dist * 0.3)) * 0.92);
    col.copy(base);
  }

  function buildTerrain() {
    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;
    route.forEach((p) => {
      minX = Math.min(minX, p.px);
      maxX = Math.max(maxX, p.px);
      minZ = Math.min(minZ, p.pz);
      maxZ = Math.max(maxZ, p.pz);
    });
    const M = 62;
    minX -= M;
    maxX += M;
    minZ -= M;
    maxZ += M;
    const cols = Math.ceil((maxX - minX) / CELL) + 1;
    const rows = Math.ceil((maxZ - minZ) / CELL) + 1;
    const heights = new Float32Array(cols * rows);
    const away = new Float32Array(cols * rows);
    const pos = new Float32Array(cols * rows * 3);
    const colors = new Float32Array(cols * rows * 3);
    const col = new T.Color();
    const coarse = route.filter((_, i) => i % 6 === 0);
    for (let r = 0; r < rows; r++) {
      const wz = minZ + r * CELL;
      for (let q = 0; q < cols; q++) {
        const wx = minX + q * CELL;
        let bestI = 0;
        let best = Infinity;
        coarse.forEach((p, i) => {
          const dd = (p.px - wx) ** 2 + (p.pz - wz) ** 2;
          if (dd < best) {
            best = dd;
            bestI = i * 6;
          }
        });
        let near = route[bestI];
        for (let i = Math.max(0, bestI - 6); i <= Math.min(route.length - 1, bestI + 6); i++) {
          const p = route[i];
          const dd = (p.px - wx) ** 2 + (p.pz - wz) ** 2;
          if (dd <= best) {
            best = dd;
            near = p;
          }
        }
        const dist = Math.sqrt(best);
        const h = near.y + terrainHeight(near.x, dist, wx, wz);
        const idx = r * cols + q;
        heights[idx] = h;
        away[idx] = smooth(PATH_W * 1.2, PATH_W * 3.2, dist);
        pos[idx * 3] = wx;
        pos[idx * 3 + 1] = h;
        pos[idx * 3 + 2] = wz;
        groundColor(near.x, dist, col, h);
        colors[idx * 3] = col.r;
        colors[idx * 3 + 1] = col.g;
        colors[idx * 3 + 2] = col.b;
      }
    }
    /* 路線轉彎處，最近的路段會突然換一段，高度跟著斷開；離路遠的地方磨平成山坡 */
    for (let pass = 0; pass < 6; pass++) {
      const copy = heights.slice();
      for (let r = 1; r < rows - 1; r++) {
        for (let q = 1; q < cols - 1; q++) {
          const i = r * cols + q;
          const avg = (copy[i - 1] + copy[i + 1] + copy[i - cols] + copy[i + cols] + copy[i] * 2) / 6;
          heights[i] = copy[i] + (avg - copy[i]) * away[i];
        }
      }
    }
    for (let i = 0; i < heights.length; i++) pos[i * 3 + 1] = heights[i];
    const index = new Uint32Array((cols - 1) * (rows - 1) * 6);
    let n = 0;
    for (let r = 0; r < rows - 1; r++) {
      for (let q = 0; q < cols - 1; q++) {
        const a = r * cols + q;
        const b = a + 1;
        const c = a + cols;
        const d = c + 1;
        index[n++] = a; index[n++] = c; index[n++] = b;
        index[n++] = b; index[n++] = c; index[n++] = d;
      }
    }
    const geo = new T.BufferGeometry();
    geo.setAttribute('position', new T.BufferAttribute(pos, 3));
    geo.setAttribute('color', new T.BufferAttribute(colors, 3));
    geo.setIndex(new T.BufferAttribute(index, 1));
    geo.computeVertexNormals();
    const mesh = new T.Mesh(geo, new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }));
    mesh.receiveShadow = true;
    const heightAt = (wx, wz) => {
      const fx = clamp((wx - minX) / CELL, 0, cols - 1.001);
      const fz = clamp((wz - minZ) / CELL, 0, rows - 1.001);
      const q = Math.floor(fx);
      const r = Math.floor(fz);
      const kx = fx - q;
      const kz = fz - r;
      const at = (a, b) => heights[b * cols + a];
      return (at(q, r) * (1 - kx) + at(q + 1, r) * kx) * (1 - kz) + (at(q, r + 1) * (1 - kx) + at(q + 1, r + 1) * kx) * kz;
    };
    mesh.userData.heightAt = heightAt;
    return { mesh, heightAt };
  }

  /* 步道：貼地的路面，邊緣略暗 */
  function buildPath() {
    const verts = [];
    const colors = [];
    const index = [];
    const lanes = [-1, -0.82, 0, 0.82, 1];
    const dirt = new T.Color(look.biome.path.dirt);
    const edge = new T.Color(look.biome.path.edge);
    const white = new T.Color('#f4f8fb');
    route.forEach((p, r) => {
      const nx = -p.tz;
      const nz = p.tx;
      lanes.forEach((l, q) => {
        const u = l * (PATH_W / 2 + 0.25);
        verts.push(p.px + nx * u, p.y + 0.06, p.pz + nz * u);
        const c = dirt.clone().lerp(edge, Math.abs(l) > 0.9 ? 1 : 0).multiplyScalar(0.92 + hash(r, q) * 0.14);
        c.lerp(white, snowAt(p.y, hash(r, q)) * 0.62);
        colors.push(c.r, c.g, c.b);
      });
    });
    const w = lanes.length;
    for (let r = 0; r < route.length - 1; r++) {
      for (let q = 0; q < w - 1; q++) {
        const a = r * w + q;
        index.push(a, a + 1, a + w, a + 1, a + w + 1, a + w);
      }
    }
    const geo = new T.BufferGeometry();
    geo.setAttribute('position', new T.Float32BufferAttribute(verts, 3));
    geo.setAttribute('color', new T.Float32BufferAttribute(colors, 3));
    geo.setIndex(index);
    geo.computeVertexNormals();
    const mesh = new T.Mesh(geo, new T.MeshStandardMaterial({ vertexColors: true, roughness: 1 }));
    mesh.receiveShadow = true;
    return mesh;
  }

  /* 玩具感的植被與石頭：同一種形狀大量重複，用 InstancedMesh 才跑得動 */
  function bluntCone(radius, height) {
    const pts = [[0, 0], [radius * 0.82, 0.02], [radius, height * 0.12], [radius * 0.5, height * 0.68], [radius * 0.16, height * 0.97], [0, height]];
    return new T.LatheGeometry(pts.map(([x, y]) => new T.Vector2(x, y)), PHONE ? 6 : 9);
  }
  const lump = (seed, r) => {
    const g = new T.IcosahedronGeometry(r, 2);
    const a = g.attributes.position;
    for (let i = 0; i < a.count; i++) {
      const k = 0.82 + hash(Math.round(a.getX(i) * 30) + seed, Math.round(a.getY(i) * 30) + Math.round(a.getZ(i) * 20)) * 0.3;
      a.setXYZ(i, a.getX(i) * k, a.getY(i) * k * 0.72, a.getZ(i) * k);
    }
    g.computeVertexNormals();
    return g;
  };

  /* 葉片隨風搖，靠頂點著色器做，省下每幀更新幾萬個物件 */
  function swaying(material) {
    material.onBeforeCompile = (shader) => {
      shader.uniforms.swayTime = swayU.time;
      shader.uniforms.swayAmp = swayU.amp;
      shader.vertexShader = `uniform float swayTime; uniform float swayAmp;\n${shader.vertexShader}`.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        #ifdef USE_INSTANCING
          float swayPhase = instanceMatrix[3].x * 0.7 + instanceMatrix[3].z * 0.5;
          float swayK = position.y * position.y;
          transformed.x += sin(swayTime * 1.7 + swayPhase) * swayAmp * swayK;
          transformed.z += cos(swayTime * 1.3 + swayPhase) * swayAmp * 0.6 * swayK;
        #endif`,
      );
    };
    return material;
  }

  const zoneOf = (m) => (m.summit > 0.5 ? 'summit' : m.ridge > 0.5 ? 'ridge' : m.forest > 0.5 ? 'forest' : m.dusk > 0.5 ? 'dusk' : 'open');

  function scatter(scene, heightAt) {
    const stream = makeRng(20261101);
    const rng = () => stream.next();
    const r = (a, b) => a + rng() * (b - a);
    const rows = { trunk: [], tier1: [], tier2: [], tier3: [], round: [], rock: [], bush: [], tuft: [], flower: [], fern: [], stem: [], pistil: [], plume: [], bamboo: [] };
    const white = new T.Color('#fbfdff');
    const snowy = (color, y, k) => color.lerp(white, snowAt(y, rng()) * k);
    const put = (kind, x, u, s, color, extra) => {
      const p = place(x, u);
      p.y = heightAt(p.x, p.z);
      rows[kind].push({ p, s, color: snowy(color, p.y, 0.72), yaw: r(0, 6.28), sy: (extra && extra.sy) || s });
    };
    const tree = (x, u, s, tint) => {
      const p = place(x, u);
      p.y = heightAt(p.x, p.z) - 0.1;
      const g = new T.Color(tint).multiplyScalar(r(0.85, 1.14));
      rows.trunk.push({ p, s, color: new T.Color('#7b5438'), yaw: 0, sy: s });
      ['tier1', 'tier2', 'tier3'].forEach((kind, i) => rows[kind].push({ p, s, color: snowy(g.clone().multiplyScalar(1 + i * 0.09), p.y, 0.45 + i * 0.25), yaw: r(0, 6.28), sy: s }));
    };
    const roundTree = (x, u, s, tint) => {
      const p = place(x, u);
      p.y = heightAt(p.x, p.z) - 0.1;
      const g = new T.Color(tint).lerp(new T.Color('#c98a4a'), look.seasonFx.gold * 0.8).multiplyScalar(r(0.88, 1.12));
      rows.trunk.push({ p, s: s * 0.9, color: new T.Color('#7b5438'), yaw: 0, sy: s * 0.6 });
      rows.round.push({ p: p.clone().setY(p.y + 2.6 * s), s, color: snowy(g, p.y, 0.5), yaw: r(0, 6.28), sy: s * 0.92 });
    };
    /* 一叢草是幾片細葉；一朵花是莖、花瓣與花心 */
    const tuft = (x, u, s, tint) => {
      for (let i = 0; i < 4; i++) {
        put('tuft', x + r(-5, 5), u + r(-0.3, 0.3), s * r(0.7, 1.1), new T.Color(tint).lerp(new T.Color('#c9ad5e'), look.seasonFx.gold).multiplyScalar(r(0.82, 1.15)));
      }
    };
    /* 芒草：細稈頂著一束淺色花穗 */
    const plume = (x, u, s) => {
      const p = place(x, u);
      p.y = heightAt(p.x, p.z);
      const c = new T.Color('#f0e6c8').multiplyScalar(r(0.9, 1.05));
      rows.plume.push({ p, s, color: snowy(c, p.y, 0.3), yaw: r(0, 6.28), sy: s * r(0.9, 1.3) });
    };
    const flower = (x, u, s, tint) => {
      const p = place(x, u);
      p.y = heightAt(p.x, p.z);
      rows.stem.push({ p, s, color: new T.Color('#5f9f58'), yaw: 0, sy: s });
      rows.flower.push({ p, s, color: new T.Color(tint), yaw: r(0, 6.28), sy: s });
      rows.pistil.push({ p, s, color: new T.Color('#ffc24a'), yaw: 0, sy: s });
    };
    const side = () => (rng() < 0.5 ? -1 : 1);
    const flowers = look.seasonFx.flower > 1.2 ? ['#ff9fc0', '#ffc2d8', '#ffffff', '#e8a7e0', '#ffd965'] : ['#ffb1c4', '#ffd965', '#ffffff', '#c9b6f2', '#ffc78f'];
    const zones = look.biome.flora;

    for (let x = -650; x < 8050; x += r(5, 17)) {
      const z = zones[zoneOf(sectionMix(x))];
      const u = side() * (PATH_W + r(0.1, 8));
      if (z.smallRock && rng() < z.smallRock[1]) put('rock', x, u, r(0.25, 0.9), new T.Color(z.smallRock[0]).multiplyScalar(r(0.85, 1.12)));
      if (z.grass && rng() < z.grass[3]) tuft(x, u, r(z.grass[1], z.grass[2]), z.grass[0]);
      if (z.bush && rng() < z.bush[1]) put('bush', x, u, r(0.7, 1.3), new T.Color(z.bush[0]).multiplyScalar(r(0.85, 1.2)));
      if (z.fern && rng() < z.fern) put('fern', x, side() * (PATH_W * 0.8 + r(0.1, 5)), r(0.8, 1.5), new T.Color('#3f9a5a').multiplyScalar(r(0.8, 1.15)));
      if (z.plume) for (let i = 0; i < 3; i++) if (rng() < z.plume) plume(x + r(-6, 6), side() * (PATH_W * 0.78 + r(0.1, 9)), r(1, 1.7));
      if (z.bamboo) for (let i = 0; i < 4; i++) if (rng() < z.bamboo) put('bamboo', x + r(-6, 6), side() * (PATH_W * 0.85 + r(0.1, 16)), r(0.8, 1.5), new T.Color('#6f9f58').lerp(new T.Color('#b6a95e'), look.seasonFx.gold).multiplyScalar(r(0.82, 1.15)));
      if (z.flower && rng() < z.flower * look.seasonFx.flower) {
        flower(x + r(-5, 5), side() * (PATH_W * 0.72 + r(0.1, 6)), r(0.7, 1.1), flowers[Math.floor(r(0, 5))]);
      }
    }
    for (let x = -650; x < 8050; x += r(9, 22)) {
      const z = zones[zoneOf(sectionMix(x))];
      const near = side() * r(5.5, 13);
      const far = side() * r(13, 50);
      (z.trees || []).forEach((t) => {
        if (rng() >= t.p) return;
        const u = t.band === 'near' ? near : far;
        if (t.type === 'cone') tree(x + r(-4, 4), u, r(t.s[0], t.s[1]), t.tint);
        else roundTree(x + r(-4, 4), u, r(t.s[0], t.s[1]), t.tint);
      });
      if (z.rock && rng() < z.rock[1]) put('rock', x, rng() < 0.5 ? near * 0.8 : far * 0.5, r(z.rock[2], z.rock[3]), new T.Color(z.rock[0]).multiplyScalar(r(0.85, 1.1)));
    }

    const mat = (o) => new T.MeshStandardMaterial(Object.assign({ color: '#ffffff', roughness: 0.82 }, o));
    const tuftGeo = new T.ConeGeometry(0.05, 0.72, 4);
    tuftGeo.translate(0, 0.36, 0);
    /* 蕨類：一圈往外彎的細長葉片 */
    const fernVerts = [];
    const FRONDS = 7;
    for (let i = 0; i < FRONDS; i++) {
      const a = (i / FRONDS) * Math.PI * 2;
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      const at = (r, y, w) => [ca * r - sa * w, y, sa * r + ca * w];
      const tip = at(0.72, 0.3, 0);
      const midL = at(0.4, 0.42, 0.13);
      const midR = at(0.4, 0.42, -0.13);
      const root = at(0, 0.02, 0);
      fernVerts.push(...root, ...midR, ...midL, ...midL, ...midR, ...tip);
    }
    const fernGeo = new T.BufferGeometry();
    fernGeo.setAttribute('position', new T.Float32BufferAttribute(fernVerts, 3));
    fernGeo.computeVertexNormals();
    const bambooGeo = new T.SphereGeometry(0.46, 7, 5);
    bambooGeo.scale(1, 0.5, 1);
    bambooGeo.translate(0, 0.16, 0);
    /* 芒草一株：細稈往上，頂端散開成一束花穗 */
    const plumeGeo = new T.LatheGeometry(
      [[0, 0], [0.014, 0], [0.012, 0.95], [0.05, 1.08], [0.1, 1.34], [0.075, 1.58], [0.03, 1.74], [0, 1.82]].map(([x, y]) => new T.Vector2(x, y)),
      6,
    );
    const trunkGeo = new T.CylinderGeometry(0.17, 0.25, 2.2, 8);
    trunkGeo.translate(0, 1.1, 0);
    const t1 = bluntCone(1.35, 2.2);
    t1.translate(0, 1.2, 0);
    const t2 = bluntCone(1.05, 1.9);
    t2.translate(0, 2.5, 0);
    const t3 = bluntCone(0.72, 1.7);
    t3.translate(0, 3.7, 0);
    const flowerGeo = new T.CylinderGeometry(0.12, 0.06, 0.04, 6);
    flowerGeo.translate(0, 0.4, 0);
    const stemGeo = new T.CylinderGeometry(0.012, 0.016, 0.4, 5);
    stemGeo.translate(0, 0.2, 0);
    const pistilGeo = new T.SphereGeometry(0.045, 8, 6);
    pistilGeo.translate(0, 0.43, 0);
    const geos = {
      trunk: trunkGeo, tier1: t1, tier2: t2, tier3: t3,
      round: new T.IcosahedronGeometry(1.35, 2), rock: lump(3, 0.8), bush: lump(9, 0.62), tuft: tuftGeo, flower: flowerGeo, fern: fernGeo, stem: stemGeo, pistil: pistilGeo, plume: plumeGeo, bamboo: bambooGeo,
    };
    const dummy = new T.Object3D();
    Object.keys(rows).forEach((kind) => {
      const list = rows[kind];
      if (!list.length) return;
      const soft = ['flower', 'tuft', 'fern', 'stem', 'pistil', 'plume', 'bamboo'];
      const mesh = new T.InstancedMesh(geos[kind], soft.includes(kind) ? swaying(mat(kind === 'fern' ? { side: T.DoubleSide } : {})) : mat(), list.length);
      list.forEach((it, i) => {
        dummy.position.copy(it.p);
        dummy.rotation.set(0, it.yaw, 0);
        if (kind === 'plume') dummy.rotateX(0.16 + (i % 5) * 0.05);
        dummy.scale.set(it.s, it.sy, it.s);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
        mesh.setColorAt(i, it.color);
      });
      mesh.castShadow = !soft.includes(kind);
      mesh.userData.soft = soft.includes(kind);
      mesh.receiveShadow = true;
      mesh.frustumCulled = false;
      scene.add(mesh);
    });
  }

  /* 布景小物 ---------------------------------------------------------- */
  const m3 = (color, o) => new T.MeshStandardMaterial(Object.assign({ color, roughness: 0.78 }, o));
  function mesh(parent, geo, color, p, r, s) {
    const m = new T.Mesh(geo, typeof color === 'string' ? m3(color) : color);
    m.castShadow = true;
    m.receiveShadow = true;
    if (p) m.position.set(p[0], p[1], p[2]);
    if (r) m.rotation.set(r[0], r[1], r[2]);
    if (s) m.scale.set(s[0], s[1], s[2]);
    parent.add(m);
    return m;
  }
  const box = (w, h, d) => new T.BoxGeometry(w, h, d);
  const cyl = (a, b, h, n) => new T.CylinderGeometry(a, b, h, n || 14);
  const sph = (r) => new T.SphereGeometry(r, 18, 14);

  function textPlate(label, sub, opts) {
    const o = opts || {};
    const W = 512;
    const H_ = sub ? 256 : 180;
    const cv = document.createElement('canvas');
    cv.width = W;
    cv.height = H_;
    const c = cv.getContext('2d');
    c.fillStyle = o.bg || '#fff3d9';
    c.fillRect(0, 0, W, H_);
    c.strokeStyle = o.line || '#8a5a3b';
    c.lineWidth = 14;
    c.strokeRect(7, 7, W - 14, H_ - 14);
    A.text(c, label, W / 2, sub ? 96 : H_ / 2, label.length > 4 ? 76 : 96, '#6b3f26', 800);
    if (sub) A.text(c, sub, W / 2, 190, 46, '#8a6a4b', 700);
    const tex = new T.CanvasTexture(cv);
    tex.colorSpace = T.SRGBColorSpace;
    tex.anisotropy = 4;
    return new T.MeshStandardMaterial({ map: tex, roughness: 0.85 });
  }

  function signPost(label, sub) {
    const g = new T.Group();
    mesh(g, cyl(0.1, 0.12, 2), '#7b5438', [0, 1, 0]);
    const plate = box(2.1, sub ? 1.05 : 0.75, 0.1);
    mesh(g, plate, [m3('#8a5a3b'), m3('#8a5a3b'), m3('#8a5a3b'), m3('#8a5a3b'), textPlate(label, sub), m3('#8a5a3b')], [0, 2.1, 0.13]);
    return g;
  }

  function archGate(label, color) {
    const g = new T.Group();
    const wood = color || '#a8654a';
    [-2.9, 2.9].forEach((x) => {
      mesh(g, cyl(0.22, 0.27, 4.4), wood, [x, 2.2, 0]);
      mesh(g, cyl(0.42, 0.42, 0.22), '#8d8d86', [x, 0.1, 0]);
    });
    mesh(g, box(6.8, 0.36, 0.42), wood, [0, 4.15, 0]);
    mesh(g, cyl(0.2, 0.2, 7.3, 8), '#5f9a6f', [0, 4.75, 0], [0, 0, Math.PI / 2], [1, 1, 2.4]);
    const signFace = textPlate(label);
    mesh(g, box(3.3, 1.1, 0.16), [m3('#8a5a3b'), m3('#8a5a3b'), m3('#8a5a3b'), m3('#8a5a3b'), signFace, signFace], [0, 3.7, 0.22]);
    return g;
  }

  function cabin(label) {
    const g = new T.Group();
    mesh(g, box(5, 2.6, 3.6), '#f1e2c2', [0, 1.3, 0]);
    const roof = new T.ConeGeometry(4.3, 1.7, 4);
    mesh(g, roof, '#d47a5c', [0, 3.42, 0], [0, Math.PI / 4, 0], [1, 1, 0.76]);
    mesh(g, box(0.95, 1.8, 0.1), '#8a5a3b', [-1.2, 0.9, 1.82]);
    mesh(g, box(1.3, 0.9, 0.1), '#a9ddf5', [1, 1.5, 1.82]);
    mesh(g, box(1.42, 0.08, 0.14), '#fffdf6', [1, 1.5, 1.85]);
    if (label) {
      const face = textPlate(label);
      mesh(g, box(2, 0.68, 0.1), [m3('#fff3d9'), m3('#fff3d9'), m3('#fff3d9'), m3('#fff3d9'), face, m3('#fff3d9')], [0, 3.0, 1.92]);
    }
    return g;
  }

  function car() {
    const g = new T.Group();
    mesh(g, sph(1), '#6fb2d6', [0, 0.72, 0], null, [0.92, 0.42, 1.72]);
    mesh(g, sph(0.8), '#cfeaf5', [0, 1.05, -0.1], null, [0.95, 0.6, 1.2]);
    [[-0.86, 1.1], [0.86, 1.1], [-0.86, -1.1], [0.86, -1.1]].forEach(([x, z]) => {
      mesh(g, cyl(0.34, 0.34, 0.22), '#3f4650', [x, 0.34, z], [0, 0, Math.PI / 2]);
    });
    return g;
  }

  function lantern() {
    const g = new T.Group();
    mesh(g, cyl(0.05, 0.07, 1.8), '#6b4a34', [0, 0.9, 0]);
    mesh(g, box(0.34, 0.42, 0.34), new T.MeshStandardMaterial({ color: '#ffd58a', emissive: '#ffb84a', emissiveIntensity: 1.1 }), [0, 1.95, 0]);
    mesh(g, box(0.46, 0.08, 0.46), '#6b4a34', [0, 2.2, 0]);
    return g;
  }

  /* 動物：幾顆圓球組成的小玩偶 */
  function animal(kind) {
    const g = new T.Group();
    const dot = (p, c, s) => mesh(g, sph(0.05), c || '#2d241f', p, null, s);
    if (kind === 'macaque') {
      mesh(g, sph(0.42), '#b5977a', [0, 0.45, 0], null, [1, 1.1, 0.95]);
      mesh(g, sph(0.32), '#b5977a', [0, 1.02, 0.08]);
      mesh(g, sph(0.2), '#e6927f', [0, 1, 0.26], null, [1, 0.85, 0.5]);
      dot([-0.08, 1.05, 0.36]);
      dot([0.08, 1.05, 0.36]);
    } else if (kind === 'pheasant') {
      mesh(g, sph(0.36), '#3f5f9b', [0, 0.52, 0], null, [0.85, 0.9, 1.25]);
      mesh(g, sph(0.18), '#7a3fa0', [0, 0.95, 0.3]);
      mesh(g, new T.ConeGeometry(0.17, 1, 8), '#ffffff', [0, 0.65, -0.72], [-1.25, 0, 0]);
      mesh(g, new T.ConeGeometry(0.05, 0.15, 8), '#f0b53a', [0, 0.95, 0.5], [1.5, 0, 0]);
      dot([-0.09, 0.99, 0.43]);
      dot([0.09, 0.99, 0.43]);
      [-0.1, 0.1].forEach((x) => mesh(g, cyl(0.025, 0.025, 0.32), '#d9554d', [x, 0.16, 0]));
    } else if (kind === 'muntjac') {
      mesh(g, sph(0.4), '#b9824f', [0, 0.72, 0], null, [0.8, 0.82, 1.3]);
      mesh(g, sph(0.25), '#b9824f', [0, 1.18, 0.46]);
      mesh(g, sph(0.1), '#fffdf6', [0, 0.82, -0.52]);
      [[-0.17, 0.3], [0.17, 0.3], [-0.17, -0.3], [0.17, -0.3]].forEach(([x, z]) => mesh(g, cyl(0.05, 0.04, 0.5), '#9a6a3e', [x, 0.25, z]));
      [-0.1, 0.1].forEach((x) => mesh(g, cyl(0.012, 0.02, 0.24), '#6b4a34', [x, 1.45, 0.42]));
      dot([-0.1, 1.22, 0.67]);
      dot([0.1, 1.22, 0.67]);
    } else if (kind === 'bear') {
      mesh(g, sph(0.72), '#2e2b2c', [0, 0.82, 0], null, [1, 0.95, 1.2]);
      mesh(g, sph(0.46), '#2e2b2c', [0, 1.4, 0.68]);
      mesh(g, sph(0.2), '#f4efdf', [0, 1.05, 1.02], null, [1.2, 0.5, 0.5]);
      [-0.32, 0.32].forEach((x) => mesh(g, sph(0.15), '#2e2b2c', [x, 1.8, 0.62]));
      dot([-0.15, 1.48, 1.08], '#fffdf6');
      dot([0.15, 1.48, 1.08], '#fffdf6');
    }
    return g;
  }

  function helicopter() {
    const g = new T.Group();
    mesh(g, sph(1.5), '#f2736b', [0, 0, 0], null, [1, 0.86, 1.65]);
    mesh(g, sph(1.1), '#dcf3fb', [0, 0.2, 1.3], null, [1, 0.8, 0.82]);
    mesh(g, box(0.34, 0.34, 3.6), '#e8605c', [0, 0.36, -3.1]);
    mesh(g, box(0.1, 1.2, 0.6), '#fffdf6', [0, 0.85, -4.7]);
    mesh(g, cyl(0.1, 0.1, 0.8), '#4a5468', [0, 1.5, 0]);
    const rotor = new T.Group();
    rotor.position.set(0, 1.92, 0);
    mesh(rotor, box(7, 0.06, 0.34), '#4a5468');
    mesh(rotor, box(0.34, 0.06, 7), '#4a5468');
    g.add(rotor);
    [-1, 1].forEach((x) => mesh(g, box(0.14, 0.14, 3.2), '#4a5468', [x, -1.65, 0]));
    g.userData.rotor = rotor;
    return g;
  }

  /* 碎石邊坡的貼圖，Codex 生成，可無縫重複 */
  let screeTex = null;
  function screeTexture() {
    if (!screeTex) {
      screeTex = new T.TextureLoader().load('assets/art/scree-slope.jpg', undefined, undefined, (err) => console.warn('邊坡貼圖載入失敗', err));
      screeTex.wrapS = T.RepeatWrapping;
      screeTex.wrapT = T.RepeatWrapping;
      screeTex.colorSpace = T.SRGBColorSpace;
      screeTex.anisotropy = 4;
    }
    return screeTex;
  }

  /* 路標：柱子加一面畫了題目圖示的圓牌 */
  const markerTextures = new Map();
  function clearOwned(group) {
    const geometries = new Set();
    const materials = new Set();
    const textures = new Set();
    const instances = new Set();
    const sharedTextures = new Set(markerTextures.values());
    if (screeTex) sharedTextures.add(screeTex);
    const visit = (n) => {
      if (n.userData.parts) {
        H.dispose(n);
        return;
      }
      // THREE.Sprite geometry is shared by all sprites, including other stages.
      if (n.geometry && !n.isSprite) geometries.add(n.geometry);
      if (n.isInstancedMesh) instances.add(n);
      const list = Array.isArray(n.material) ? n.material : [n.material];
      list.forEach((m) => { if (m) materials.add(m); });
      n.children.forEach(visit);
    };
    group.children.forEach(visit);
    materials.forEach((m) => {
      Object.values(m).forEach((value) => {
        if (value && value.isTexture && !sharedTextures.has(value) && !DH.stage3d.isSharedTexture(value)) textures.add(value);
      });
    });
    instances.forEach((n) => n.dispose());
    geometries.forEach((g) => g.dispose());
    materials.forEach((m) => m.dispose());
    textures.forEach((t) => t.dispose());
    group.clear();
  }

  function markerTexture(scenario) {
    const icon = scenario.key ? 'lifebuoy' : A.markerIcon(scenario.category, scenario.title);
    const key = `${icon}|${!!scenario.key}`;
    if (markerTextures.has(key)) return markerTextures.get(key);
    const cv = document.createElement('canvas');
    cv.width = 192;
    cv.height = 192;
    const c = cv.getContext('2d');
    c.fillStyle = scenario.key ? '#fff3e6' : '#fffdf6';
    c.beginPath();
    c.arc(96, 96, 96, 0, Math.PI * 2);
    c.fill();
    c.translate(96, 96);
    c.scale(3.3, 3.3);
    (A.icons[icon] || A.icons.sign)(c);
    const tex = new T.CanvasTexture(cv);
    tex.colorSpace = T.SRGBColorSpace;
    markerTextures.set(key, tex);
    return tex;
  }

  function eventMarker(ev) {
    const g = new T.Group();
    const color = ev.scenario.key ? '#e5484d' : '#ee8549';
    mesh(g, cyl(0.07, 0.09, 1.7), '#8a5a3b', [0, 0.85, 0]);
    const head = new T.Group();
    head.position.y = 2.25;
    mesh(head, cyl(0.68, 0.68, 0.14, 28), color, [0, 0, 0], [Math.PI / 2, 0, 0]);
    const face = new T.Mesh(new T.CircleGeometry(0.58, 28), new T.MeshStandardMaterial({ map: markerTexture(ev.scenario), roughness: 0.8 }));
    face.position.z = 0.08;
    head.add(face);
    const back = face.clone();
    back.position.z = -0.08;
    back.rotation.y = Math.PI;
    head.add(back);
    g.add(head);
    const glow = new T.Mesh(new T.RingGeometry(0.75, 1.0, 32), new T.MeshBasicMaterial({ color: '#ffd27a', transparent: true, opacity: 0, side: T.DoubleSide  }));
    glow.rotation.x = -Math.PI / 2;
    glow.position.y = 0.08;
    g.add(glow);
    g.userData = { head, glow, ev };
    return g;
  }

  /* 天色：沿路變化；風險高或變天時整個轉暗 */
  const SKY = {
    dawn: { top: '#6a8ed2', low: '#ffbf8c', sun: 2.5, hemi: 1.4 },
    trailhead: { top: '#6db9ea', low: '#d8f0f2', sun: 2.6, hemi: 1.8 },
    forest: { top: '#79bfd9', low: '#d7eedb', sun: 2.2, hemi: 1.7 },
    ridge: { top: '#4f9fe0', low: '#e6f1e8', sun: 2.8, hemi: 1.7 },
    summit: { top: '#3b7fcf', low: '#dcecf4', sun: 3, hemi: 1.7 },
    descent: { top: '#7f86c6', low: '#ffcf9f', sun: 2.1, hemi: 1.5 },
  };
  const STORM = { top: '#74828f', low: '#bcc6cb' };
  const DUSK = { top: '#6d6bb0', low: '#ffb98a' };

  const terrainOf = (land) => land.children[0];
  const PHOTO = { back: 5.2, side: 0.9, up: 1.7, lookUp: 1.55, lead: 0.6 };
  const LANDMARK = { size: 270, x: 40, y: -22, z: -760, sink: 250 };
  const FOG_FAR = 1150;
  const SPARKS = {
    cheer: { n: 26, speed: 2.6, up: 5.4, gravity: 7, spread: 0.2, y: 1.6, life: 1.5, size: 0.075, colors: ['#ffb1c4', '#ffd965', '#ffffff', '#9fdcb0', '#ffc78f'] },
    stumble: { n: 12, speed: 1.3, up: 0.9, gravity: 1, spread: 0.35, y: 0.12, life: 0.8, size: 0.13, colors: ['#cdbb97', '#b8a684'] },
    step: { n: 2, speed: 0.3, up: 0.5, gravity: 0.5, spread: 0.14, y: 0.08, life: 0.5, size: 0.065, colors: ['#d8c8a6'] },
  };
  /* 首頁：稜線上看日出，雲海在腳下 */
  const START_SHOT = { x: 4300, side: 0.92, back: 11, up: 2.5, lookUp: 5 };
  const startDirection = (s) => new T.Vector3(s.tx + s.nx * START_SHOT.side, 0, s.tz + s.nz * START_SHOT.side).normalize();

  const world3d = {
    ready: false,
    init(canvas) {
      const renderer = new T.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, PHONE ? 1.5 : 2));
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = T.PCFSoftShadowMap;
      const scene = new T.Scene();
      scene.fog = new T.Fog('#d8f0f2', 70, FOG_FAR);
      const camera = new T.PerspectiveCamera(42, 1, 0.1, 1200);

      const hemi = new T.HemisphereLight('#fff6e8', '#7f9a6b', 1.8);
      scene.add(hemi);
      const sun = new T.DirectionalLight('#fff0d4', 2.6);
      sun.castShadow = true;
      sun.shadow.mapSize.setScalar(PHONE ? 1024 : 2048);
      Object.assign(sun.shadow.camera, { left: -22, right: 22, top: 22, bottom: -22, near: 1, far: 120 });
      sun.shadow.bias = -0.0006;
      sun.shadow.normalBias = 0.03;
      scene.add(sun, sun.target);

      const skyUniforms = { top: { value: new T.Color('#6db9ea') }, low: { value: new T.Color('#d8f0f2') } };
      const sky = new T.Mesh(new T.SphereGeometry(900, 24, 16), new T.ShaderMaterial({
        side: T.BackSide,
        depthWrite: false,
        fog: false,
        uniforms: skyUniforms,
        vertexShader: 'varying vec3 v; void main(){ v = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
        fragmentShader: 'uniform vec3 top; uniform vec3 low; varying vec3 v; void main(){ float h = clamp(normalize(v).y * 2.4 + 0.08, 0.0, 1.0); gl_FragColor = vec4(mix(low, top, h), 1.0);\n#include <colorspace_fragment>\n}',
      }));
      scene.add(sky);
      const sunDisc = new T.Mesh(new T.CircleGeometry(26, 32), new T.MeshBasicMaterial({ color: '#fff3c4', transparent: true, fog: false }));
      scene.add(sunDisc);

      const land = new T.Group();
      scene.add(land);
      const rain = this.buildRain(scene);

      const props = new T.Group();
      scene.add(props);
      const markers = new T.Group();
      scene.add(markers);
      const npcs = new T.Group();
      scene.add(npcs);
      const extras = new T.Group();
      scene.add(extras);

      Object.assign(this, {
        renderer, scene, camera, hemi, sun, sky: skyUniforms, skyMesh: sky, sunDisc, land, rain, props, markers, npcs, extras,
        canvas, ready: true, heroKey: '', hero: null, hx: 0, hz: 0, yaw: 0, camPos: new T.Vector3(), camInit: false,
        view: { ox: 0, oy: 0, card: 0, orbit: 0 }, size: { w: 0, h: 0 }, frameMs: 16, slowFrames: 0,
      });
      this.buildLand();
      this.buildSparks(scene);
      this.setHero({ colors: null });
      return this;
    },

    /* 換一座山或換季就重蓋整片山景。同一座山同一季不重蓋。 */
    setBiome(id, seasonId) {
      const next = DH.biomes.resolve(id, seasonId);
      if (next.id === look.id && next.season === look.season) return;
      look = next;
      if (this.ready) this.buildLand();
    },

    buildLand() {
      const land = this.land;
      clearOwned(land);
      route.forEach((p) => { p.y = elevationAt(p.x) * look.biome.rise; });
      const { mesh: terrain, heightAt } = buildTerrain();
      land.add(terrain, buildPath());
      scatter(land, heightAt);
      this.buildRange(land);
      this.buildLandmark(land);
      this.clouds = this.buildClouds(land);
      this.terrain = terrain;
      this.heightAt = heightAt;
      this.steam = this.buildFeatures(land);
      if (this.sparse) this.applySparse();
    },

    buildLandmark(land) {
      this.peak = null;
      const peak = DH.diorama.landmark(look.id, PHONE ? 60 : 110);
      if (!peak) return;
      peak.scale.setScalar(LANDMARK.size);
      peak.position.set(LANDMARK.x, LANDMARK.y, LANDMARK.z);
      peak.castShadow = false;
      peak.receiveShadow = false;
      land.add(peak);
      this.peak = peak;
    },

    /* 只有某些山才有的東西：溪流、噴氣孔、鐵鍊護欄 */
    buildFeatures(land) {
      const B = look.biome;
      const water = new T.MeshStandardMaterial({ color: '#7cc4e0', roughness: 0.25, metalness: 0.1, emissive: '#3f8fb0', emissiveIntensity: 0.18 });
      (B.streams || []).forEach((x) => {
        const verts = [];
        const index = [];
        const N = 140;
        const s = sampleRoute(x);
        for (let i = 0; i <= N; i++) {
          const u = (i / N - 0.5) * 70;
          const wob = Math.sin(u * 0.22) * 2.2;
          [-1.15, 1.15].forEach((off) => {
            const wx = s.px + s.nx * u + s.tx * (wob + off);
            const wz = s.pz + s.nz * u + s.tz * (wob + off);
            const y = Math.max(this.heightAtSafe(wx, wz, terrainOf(land)), Math.abs(u) < PATH_W * 1.2 ? s.y : -999) + 0.16;
            verts.push(wx, y, wz);
          });
          if (i < N) {
            const a = i * 2;
            index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
          }
        }
        const g = new T.BufferGeometry();
        g.setAttribute('position', new T.Float32BufferAttribute(verts, 3));
        g.setIndex(index);
        g.computeVertexNormals();
        const m = new T.Mesh(g, water);
        m.material.side = T.DoubleSide;
        m.receiveShadow = true;
        land.add(m);
        /* 踩著石頭過溪 */
        [-1.1, -0.35, 0.4, 1.1].forEach((d, i) => {
          const stone = new T.Mesh(lump(i + 5, 0.34), m3('#a5a79c'));
          const p = place(x + d * 14, (i - 1.5) * 0.3);
          stone.position.set(p.x, s.y + 0.14, p.z);
          stone.castShadow = true;
          land.add(stone);
        });
      });
      if (B.chains) {
        const iron = m3('#4a4d52', { metalness: 0.5, roughness: 0.5 });
        for (let x = B.chains[0]; x <= B.chains[1]; x += 44) {
          const p = place(x, -(PATH_W / 2 + 0.28));
          const post = new T.Mesh(cyl(0.05, 0.06, 1.1, 8), iron);
          post.position.set(p.x, sampleRoute(x).y + 0.55, p.z);
          post.castShadow = true;
          land.add(post);
          const q = place(x + 44, -(PATH_W / 2 + 0.28));
          const a = new T.Vector3(p.x, sampleRoute(x).y + 0.95, p.z);
          const b = new T.Vector3(q.x, sampleRoute(x + 44).y + 0.95, q.z);
          if (x + 44 <= B.chains[1]) {
            const curve = new T.QuadraticBezierCurve3(a, a.clone().lerp(b, 0.5).add(new T.Vector3(0, -0.22, 0)), b);
            land.add(new T.Mesh(new T.TubeGeometry(curve, 8, 0.018, 5), iron));
          }
        }
      }
      if (!B.steam) return null;
      const puffs = [];
      B.steam.forEach((x, v) => {
        const u = (v % 2 ? 1 : -1) * 7.5;
        const p = place(x, u);
        const y = this.heightAtSafe(p.x, p.z, terrainOf(land));
        const crust = new T.Mesh(lump(v + 11, 1.1), m3('#d8c56f'));
        crust.position.set(p.x, y + 0.1, p.z);
        land.add(crust);
        for (let i = 0; i < 6; i++) puffs.push({ x: p.x, y: y + 0.5, z: p.z, phase: i / 6 + v * 0.13 });
      });
      const inst = new T.InstancedMesh(new T.IcosahedronGeometry(0.5, 1), new T.MeshStandardMaterial({ color: '#ffffff', roughness: 1, emissive: '#ffffff', emissiveIntensity: 0.35, transparent: true, opacity: 0.62 }), puffs.length);
      inst.frustumCulled = false;
      land.add(inst);
      return { inst, puffs };
    },

    heightAtSafe(wx, wz, terrain) {
      return terrain.userData.heightAt(wx, wz);
    },

    /* 遠方群山：大圓錐加雜訊，山頂一點雪，交給霧融進天空 */
    buildRange(scene) {
      const stream = makeRng(77);
      const rng = () => stream.next();
      const make = (x, z, radius, height, tint) => {
        const g = new T.ConeGeometry(radius, height, 56, 18);
        const a = g.attributes.position;
        const colors = [];
        const rock = new T.Color(tint);
        const snow = new T.Color('#f4f6f4');
        for (let i = 0; i < a.count; i++) {
          const px = a.getX(i);
          const pz = a.getZ(i);
          const k = (a.getY(i) + height / 2) / height;
          const wob = 1 + (fbm(px * 0.03 + x, pz * 0.03 + z) - 0.5) * 0.7 * (1 - k * 0.5);
          a.setX(i, px * wob);
          a.setZ(i, pz * wob);
          const line = look.biome.range.snow - look.seasonFx.snow * 0.3;
          const c = rock.clone().multiplyScalar(0.85 + k * 0.25).lerp(snow, smooth(line, line + 0.11, k));
          colors.push(c.r, c.g, c.b);
        }
        g.setAttribute('color', new T.Float32BufferAttribute(colors, 3));
        g.computeVertexNormals();
        const m = new T.Mesh(g, new T.MeshStandardMaterial({ vertexColors: true, roughness: 1 }));
        m.position.set(x, height / 2 - 18, z);
        scene.add(m);
      };
      const mid = route[Math.floor(route.length / 2)];
      const R = look.biome.range;
      for (let i = 0; i < 26; i++) {
        const a = rng() * Math.PI * 2;
        const r = 330 + rng() * 240;
        const mx = mid.px + Math.cos(a) * r;
        const mz = mid.pz + Math.sin(a) * r * 1.2;
        const clearOfLandmark = look.id === 'default' || Math.hypot(mx - LANDMARK.x, mz - LANDMARK.z) > LANDMARK.size * 1.25;
        if (clearOfLandmark) make(mx, mz, 90 + rng() * 90, R.height[0] + rng() * (R.height[1] - R.height[0]), R.tints[i % 3]);
      }
      /* 尖峰：玉山的鋸齒、南湖的五岩峰一帶 */
      for (let i = 0; i < R.spires; i++) {
        const a = rng() * Math.PI * 2;
        const r = 240 + rng() * 130;
        const mx = mid.px + Math.cos(a) * r;
        const mz = mid.pz + Math.sin(a) * r * 1.2;
        if (Math.hypot(mx - LANDMARK.x, mz - LANDMARK.z) > LANDMARK.size * 1.25) make(mx, mz, 34 + rng() * 26, R.height[1] * (0.62 + rng() * 0.35), R.tints[i % 3]);
      }
    },

    buildClouds(scene) {
      const stream = makeRng(31);
      const rng = () => stream.next();
      const group = new T.Group();
      const geo = new T.IcosahedronGeometry(1, 3);
      const material = new T.MeshStandardMaterial({ color: '#ffffff', roughness: 1, emissive: '#ffffff', emissiveIntensity: 0.62 });
      const list = [];
      const mid = route[Math.floor(route.length / 2)];
      /* 上方的雲 */
      for (let i = 0; i < 36; i++) {
        const cx = mid.px + (rng() - 0.5) * 420;
        const cz = mid.pz + (rng() - 0.5) * 520;
        const cy = 62 + rng() * 45;
        for (let k = 0; k < 5; k++) list.push({ x: cx + (k - 2) * 7 + rng() * 3, y: cy + rng() * 3, z: cz + rng() * 6, s: 4 + rng() * 5 });
      }
      /* 稜線兩側腳下的雲海 */
      for (let i = 0; i < look.biome.sea; i++) {
        const x = 3000 + rng() * 3400;
        const s = sampleRoute(x);
        const u = (rng() < 0.5 ? -1 : 1) * (50 + rng() * 90);
        list.push({ x: s.px + s.nx * u, y: s.y - 12 + rng() * 3, z: s.pz + s.nz * u, s: 4 + rng() * 6 });
      }
      const inst = new T.InstancedMesh(geo, material, list.length);
      const dummy = new T.Object3D();
      list.forEach((it, i) => {
        dummy.position.set(it.x, it.y, it.z);
        dummy.scale.set(it.s, it.s * 0.56, it.s);
        dummy.updateMatrix();
        inst.setMatrixAt(i, dummy.matrix);
      });
      inst.frustumCulled = false;
      group.add(inst);
      scene.add(group);
      return { group, material };
    },

    /* 小粒子：答對的花瓣、跌倒與腳步的揚塵 */
    buildSparks(scene) {
      const N = 90;
      const inst = new T.InstancedMesh(new T.IcosahedronGeometry(1, 1), new T.MeshStandardMaterial({ roughness: 0.9 }), N);
      inst.frustumCulled = false;
      inst.castShadow = false;
      const dummy = new T.Object3D();
      dummy.scale.setScalar(0);
      dummy.updateMatrix();
      for (let i = 0; i < N; i++) {
        inst.setMatrixAt(i, dummy.matrix);
        inst.setColorAt(i, new T.Color('#ffffff'));
      }
      scene.add(inst);
      this.sparks = { inst, items: Array.from({ length: N }, () => ({ life: 0 })), cursor: 0, dummy };
    },

    burst(kind) {
      if (!this.ready || !this.hero || A.reducedMotion()) return;
      const S = this.sparks;
      const preset = SPARKS[kind];
      const col = new T.Color();
      for (let i = 0; i < preset.n; i++) {
        const a = Math.random() * Math.PI * 2;
        const v = preset.speed * (0.5 + Math.random() * 0.8);
        const it = S.items[S.cursor];
        it.life = it.max = preset.life * (0.7 + Math.random() * 0.6);
        it.x = this.hero.position.x + Math.cos(a) * preset.spread;
        it.y = this.hero.position.y + preset.y;
        it.z = this.hero.position.z + Math.sin(a) * preset.spread;
        it.vx = Math.cos(a) * v;
        it.vy = preset.up * (0.6 + Math.random() * 0.7);
        it.vz = Math.sin(a) * v;
        it.g = preset.gravity;
        it.s = preset.size * (0.7 + Math.random() * 0.6);
        S.inst.setColorAt(S.cursor, col.set(preset.colors[i % preset.colors.length]));
        S.cursor = (S.cursor + 1) % S.items.length;
      }
      S.inst.instanceColor.needsUpdate = true;
    },

    updateSparks(dt) {
      const S = this.sparks;
      S.items.forEach((it, i) => {
        if (it.life <= 0) return;
        it.life -= dt;
        it.vy -= it.g * dt;
        it.x += it.vx * dt;
        it.y += it.vy * dt;
        it.z += it.vz * dt;
        S.dummy.position.set(it.x, it.y, it.z);
        S.dummy.scale.setScalar(it.life > 0 ? it.s * Math.min(1, (it.life / it.max) * 2.2) : 0);
        S.dummy.updateMatrix();
        S.inst.setMatrixAt(i, S.dummy.matrix);
      });
      S.inst.instanceMatrix.needsUpdate = true;
    },

    buildRain(scene) {
      const N = 500;
      const seeds = new Float32Array(N * 3);
      for (let i = 0; i < N * 3; i++) seeds[i] = Math.random();
      const pos = new Float32Array(N * 6);
      const geo = new T.BufferGeometry();
      geo.setAttribute('position', new T.BufferAttribute(pos, 3));
      const mesh_ = new T.LineSegments(geo, new T.LineBasicMaterial({ color: '#cfe4f4', transparent: true, opacity: 0 }));
      mesh_.frustumCulled = false;
      scene.add(mesh_);
      return { mesh: mesh_, seeds, pos, N };
    },

    setHero(o) {
      const key = JSON.stringify([o.outfit || o.colors || 'classic', DH.player.gender]);
      if (key === this.heroKey) return;
      this.heroKey = key;
      if (this.hero) {
        this.scene.remove(this.hero);
        H.dispose(this.hero);
      }
      this.hero = H.build(o);
      this.scene.add(this.hero);
    },

    /* 把換到這趟的路牌、題目路標與 NPC 放上場景 */
    sync(decor, npcList, events) {
      this.restoreShot();
      clearOwned(this.props);
      clearOwned(this.markers);
      clearOwned(this.npcs);
      const put = (obj, x, u, faceBack) => {
        const p = place(x, u);
        p.y = this.heightAt(p.x, p.z);
        if (Math.abs(u) < PATH_W) p.y = sampleRoute(x).y;
        obj.position.copy(p);
        const s = sampleRoute(x);
        obj.rotation.y = Math.atan2(s.tx, s.tz) + (faceBack ? 0 : Math.PI);
        this.props.add(obj);
        return obj;
      };
      const P = look.biome.places || {};
      put(cabin('服務站'), 480, -13);
      put(car(), 640, -8);
      put(archGate(P.gate || '登山口'), 700, 0);
      put(signPost('步道告示', '請留行程'), 860, 3.6);
      decor.forEach((it) => {
        if (it.type === 'stagesign') put(signPost(it.label, it.sub), it.x, 3.3);
        else if (it.type === 'stele') put(signPost(it.label, it.sub), it.x, -3.2);
        else if (it.type === 'trig') {
          const g = new T.Group();
          mesh(g, box(0.5, 0.8, 0.5), '#cfcabb', [0, 0.4, 0]);
          put(g, it.x, 3);
        } else if (it.type === 'cabin') put(cabin(P.hut || '山屋'), it.x, -9.5);
        else if (it.type === 'bench') {
          const g = new T.Group();
          mesh(g, box(1.8, 0.1, 0.5), '#a8754f', [0, 0.5, 0]);
          [-0.7, 0.7].forEach((x) => mesh(g, box(0.12, 0.5, 0.42), '#7b5438', [x, 0.25, 0]));
          put(g, it.x, 3);
        } else if (it.type === 'lantern') put(lantern(), it.x, it.oy < 0 ? -2.6 : 2.6);
        else if (it.type === 'gate') put(archGate(it.label, '#8d6a4e'), it.x, 0);
      });
      npcList.forEach((n) => {
        const obj = n.kind === 'hiker' ? H.build({ colors: n.colors }) : animal(n.kind);
        const u = n.kind === 'hiker' ? (n.oy >= 0 ? -2.6 : 2.6) : -(3.6 + Math.abs(n.oy) * 0.07);
        const p = place(n.x, u);
        p.y = this.heightAt(p.x, p.z);
        if (n.kind === 'hiker') p.y = Math.max(p.y, sampleRoute(n.x).y);
        obj.position.copy(p);
        const s = sampleRoute(n.x);
        obj.rotation.y = Math.atan2(s.tx, s.tz) + (n.dir === 1 ? -1.1 : 1.9);
        obj.scale.setScalar(n.kind === 'bear' ? 1.15 : 1);
        obj.userData.npc = n;
        this.npcs.add(obj);
      });
      events.forEach((ev) => {
        const marker = eventMarker(ev);
        const p = place(ev.x, 2.35);
        p.y = sampleRoute(ev.x).y;
        marker.position.copy(p);
        const s = sampleRoute(ev.x);
        marker.rotation.y = Math.atan2(s.tx, s.tz) + Math.PI;
        this.markers.add(marker);
      });
      this.buildStages(events);
    },

    /* 題目的現場，見 js/stage3d.js */
    buildStages(events) {
      this.restoreShot();
      if (!this.stages) {
        this.stages = new T.Group();
        this.scene.add(this.stages);
      }
      clearOwned(this.stages);
      this.stageList = [];
      events.forEach((ev) => {
        const stage = DH.stage3d.build(ev, this.stageKit(ev), look.biome);
        if (!stage) return;
        this.stages.add(stage.group);
        this.stageList.push(stage);
      });
    },
    stageOf(ev) {
      return (this.stageList || []).find((st) => st.ev === ev) || null;
    },
    stageKit(ev) {
      const self = this;
      const atZ = (z) => ev.x + z / UNIT;
      const ground = (z, u) => {
        const x = atZ(z);
        const p = place(x, u);
        const route = sampleRoute(x).y;
        p.y = Math.abs(u) < PATH_W ? route : Math.max(self.heightAt(p.x, p.z), route - 3);
        return p;
      };
      const yaw = (z) => {
        const s = sampleRoute(atZ(z));
        return Math.atan2(s.tx, s.tz);
      };
      const rocks = new Map();
      let geoSphere;
      const kit = {
        mesh, ground, yaw, animal,
        get geoSphere() { return geoSphere || (geoSphere = new T.IcosahedronGeometry(1, 2)); },
        mat: m3,
        rand: (n) => hash(Math.round(ev.x) + n, n * 3),
        rock(r, color) {
          const key = Math.round(r * 10);
          if (!rocks.has(key)) rocks.set(key, lump(key, r));
          const stone = new T.Mesh(rocks.get(key), m3(color));
          stone.castShadow = true;
          return stone;
        },
        sign(label, sub, z, u) {
          const post = signPost(label, sub);
          post.position.copy(ground(z, u));
          post.rotation.y = yaw(z) + Math.PI;
          return post;
        },
        /* 動作由 poseHiker 每幀更新，隊友才不會僵在原地 */
        hiker(pose, z, u) {
          const body = H.build({ colors: { jacket: '#3f8fbf', pack: '#d9643f', hat: '#f2d27a', hatBand: '#a8754f', pants: '#4a5468', hair: '#2e2b2c' } });
          body.position.copy(ground(z, u));
          body.rotation.y = yaw(z) + Math.PI;
          body.userData.stagePose = pose;
          kit.add(body);
          return body;
        },
        poseHiker(body, t, walking) {
          H.pose(body, { t, moving: !!walking, phase: t * 6, pose: body.userData.stagePose });
        },
        /* 順著地形鋪一片：水面、碎石、冰面、缺口都用它 */
        ribbon({ z0, z1, u0, u1, color, lift, roughness, rise, cols, rows, flat, textured }) {
          const COLS = cols || 28;
          const ROWS = rows || 10;
          const verts = [];
          const uvs = [];
          const index = [];
          for (let r = 0; r <= ROWS; r++) {
            const z = z0 + ((z1 - z0) * r) / ROWS;
            for (let c = 0; c <= COLS; c++) {
              const u = u0 + ((u1 - u0) * c) / COLS;
              const p = ground(z, u);
              verts.push(p.x, p.y + lift + (rise ? rise(u, z) : 0), p.z);
              uvs.push(u * 0.11, z * 0.11);
              if (r < ROWS && c < COLS) {
                const a = r * (COLS + 1) + c;
                index.push(a, a + COLS + 1, a + 1, a + 1, a + COLS + 1, a + COLS + 2);
              }
            }
          }
          const geo = new T.BufferGeometry();
          geo.setAttribute('position', new T.Float32BufferAttribute(verts, 3));
          geo.setAttribute('uv', new T.Float32BufferAttribute(uvs, 2));
          geo.setIndex(index);
          geo.computeVertexNormals();
          const plate = new T.Mesh(geo, m3(color, { roughness: roughness === undefined ? 0.9 : roughness, side: T.DoubleSide, flatShading: !!flat }));
          plate.receiveShadow = true;
          /* 貼圖載不到時就是純色的坡，不影響遊戲 */
          if (textured) {
            plate.material.map = screeTexture();
            plate.material.color.set(textured);
            plate.material.needsUpdate = true;
          }
          return plate;
        },
      };
      return kit;
    },

    resize(w, h) {
      if (this.size.w === w && this.size.h === h) return;
      this.size = { w, h };
      this.renderer.setSize(w, h, false);
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
    },

    /* 螢幕座標 → 路線座標，給「點地面走過去」用 */
    pick(clientX, clientY, nearX) {
      const r = this.canvas.getBoundingClientRect();
      const ndc = new T.Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
      const ray = new T.Raycaster();
      ray.setFromCamera(ndc, this.camera);
      const hit = ray.intersectObject(this.terrain, false)[0];
      if (!hit) return null;
      let bestX = nearX;
      let best = Infinity;
      for (let x = Math.max(30, nearX - 1500); x <= Math.min(FINISH_X + 40, nearX + 1500); x += STEP) {
        const s = sampleRoute(x);
        const dd = (s.px - hit.point.x) ** 2 + (s.pz - hit.point.z) ** 2;
        if (dd < best) {
          best = dd;
          bestX = x;
        }
      }
      const s = sampleRoute(bestX);
      const u = (hit.point.x - s.px) * s.nx + (hit.point.z - s.pz) * s.nz;
      return { x: bestX, d: clamp(0.5 + u / PATH_W, 0, 1) };
    },

    /* 世界座標 → 螢幕座標，給對話泡泡與浮字 */
    project(v) {
      const p = v.clone().project(this.camera);
      return { x: (p.x + 1) * 0.5 * this.size.w, y: (1 - p.y) * 0.5 * this.size.h };
    },
    heroHead() {
      return this.project(this.hero.position.clone().add(new T.Vector3(0, 2.45 + this.hero.userData.parts.body.position.y, 0)));
    },
    npcHead(npc) {
      const obj = this.npcs.children.find((n) => n.userData.npc === npc);
      if (!obj) return null;
      return this.project(obj.position.clone().add(new T.Vector3(0, npc.kind === 'hiker' ? 2.4 : 1.8, 0)));
    },

    /* 每幀畫面 ---------------------------------------------------------- */
    applySky(g, tint) {
      const key = g.screen === 'start' ? 'dawn' : g.section;
      const pal = SKY[key] || SKY.trailhead;
      const fx = g.fx || { fog: 0, rain: 0, wind: 0, cold: 0 };
      const riskK = smooth(35, 100, g.riskView || 0);
      const storm = Math.max(fx.rain * 0.85, fx.fog * 0.7, riskK * 0.8);
      const top = new T.Color(pal.top).lerp(new T.Color(STORM.top), storm);
      const low = new T.Color(pal.low);
      const seasonSky = look.seasonFx.sky;
      if (seasonSky && key !== 'descent' && key !== 'dawn') {
        top.lerp(new T.Color(seasonSky.top), seasonSky.k * (1 - storm));
        low.lerp(new T.Color(seasonSky.low), seasonSky.k);
      }
      low.lerp(new T.Color(STORM.low), storm);
      if (tint === 'dusk') {
        top.lerp(new T.Color(DUSK.top), 0.85);
        low.lerp(new T.Color(DUSK.low), 0.85);
      }
      const k = 0.04;
      this.sky.top.value.lerp(top, tint ? 1 : k);
      this.sky.low.value.lerp(low, tint ? 1 : k);
      this.scene.fog.color.copy(this.sky.low.value);
      const near = 70 - Math.max(fx.fog * 62, riskK * 40, fx.rain * 38);
      const far = FOG_FAR - Math.max(fx.fog * (FOG_FAR - 55), riskK * (FOG_FAR - 180), fx.rain * (FOG_FAR - 260));
      this.scene.fog.near += (near - this.scene.fog.near) * (tint ? 1 : k);
      this.scene.fog.far += (far - this.scene.fog.far) * (tint ? 1 : k);
      const light = 1 - storm * 0.5;
      this.sun.intensity = pal.sun * (1 - storm * 0.72);
      this.hemi.intensity = pal.hemi * (0.74 + light * 0.26);
      this.sunDisc.material.opacity = 1 - Math.min(1, storm * 1.5);
      this.clouds.material.color.set('#ffffff').lerp(new T.Color('#b9c3c8'), storm);
      this.rainLevel = fx.rain;
    },

    updateRain(t) {
      const R = this.rain;
      R.mesh.material.opacity = this.rainLevel * 0.7;
      R.mesh.visible = this.rainLevel > 0.02;
      if (!R.mesh.visible) return;
      const c = this.camera.position;
      for (let i = 0; i < R.N; i++) {
        const x = c.x + (R.seeds[i * 3] - 0.5) * 36;
        const z = c.z + (R.seeds[i * 3 + 1] - 0.5) * 36;
        const y = c.y + 14 - ((t * 22 + R.seeds[i * 3 + 2] * 28) % 28);
        R.pos.set([x, y, z, x + 0.08, y - 0.7, z], i * 6);
      }
      R.mesh.geometry.attributes.position.needsUpdate = true;
    },

    placeSun(heroPos, low) {
      this.sun.position.copy(heroPos).add(low ? new T.Vector3(-26, 22, -30) : new T.Vector3(18, 46, 22));
      this.sun.target.position.copy(heroPos);
      this.skyMesh.position.copy(this.camera.position);
      const dir = low
        ? new T.Vector3().subVectors(this.camLook, this.camera.position).setY(0).normalize().add(new T.Vector3(0, 0.09, 0)).normalize()
        : new T.Vector3(-0.55, 0.42, -0.72).normalize();
      this.sunDisc.position.copy(this.camera.position).addScaledVector(dir, 720);
      this.sunDisc.lookAt(this.camera.position);
    },

    render(g) {
      this.restoreShot();
      this.resize(g.w, g.h);
      const t = g.t;
      this.applySky(g);
      const p = g.player;
      this.lastBody = { t, body: g.body, risk: g.riskView };
      if (g.outfit) this.setHero({ outfit: g.outfit });
      else this.setHero({});
      const onTrail = g.screen === 'play' || g.screen === 'card';
      const atStart = g.screen === 'start';
      const hero = this.hero;
      const heroX = atStart ? START_SHOT.x : p.x;
      const s = sampleRoute(heroX);
      const pos = place(heroX, atStart ? 0 : (p.d - 0.5) * PATH_W);
      pos.y = s.y;
      hero.position.copy(pos);
      hero.visible = onTrail || atStart;

      /* 看現場時（觀察或答題）鏡頭與角色都轉向題目發生的地方 */
      const stage = onTrail ? g.observing || (g.card && g.current ? this.stageOf(g.current) : null) : null;
      /* 角色面向移動方向；開卡片時轉向路標 */
      /* 換場時位置是瞬間跳過去的，那一步不算走路，否則角色會朝跳的方向轉身 */
      const dx = g.snap ? 0 : p.x - (this.lastX === undefined ? p.x : this.lastX);
      const dd = g.snap ? 0 : (p.d - (this.lastD === undefined ? p.d : this.lastD)) * PATH_W;
      this.lastX = p.x;
      this.lastD = p.d;
      const base = Math.atan2(s.tx, s.tz);
      if (g.snap) this.yaw = base;
      let target = this.yaw;
      if (Math.abs(dx) > 0.01 || Math.abs(dd) > 0.001) {
        const fwd = dx * UNIT;
        target = Math.atan2(s.tx * fwd + s.nx * dd, s.tz * fwd + s.nz * dd);
      } else if (stage) {
        target = Math.atan2(stage.focus.x - pos.x, stage.focus.z - pos.z);
      } else if (g.card && g.current) {
        const mp = place(g.current.x, 2.35);
        target = Math.atan2(mp.x - pos.x, mp.z - pos.z);
      }
      let delta = target - this.yaw;
      delta = Math.atan2(Math.sin(delta), Math.cos(delta));
      this.yaw += delta * Math.min(1, g.dt * 9);
      if (atStart) {
        const view = startDirection(s);
        hero.rotation.y = Math.atan2(view.x, view.z);
      } else {
        hero.rotation.y = this.yaw;
      }
      /* 拍照：角色轉過來面對鏡頭比姿勢 */
      if (g.photo > 0 && onTrail) {
        const front = this.photoShot(heroX, p.d).yaw;
        hero.rotation.y = hero.rotation.y + Math.atan2(Math.sin(front - hero.rotation.y), Math.cos(front - hero.rotation.y)) * g.photo;
      }
      H.pose(hero, { t, phase: p.phase, moving: p.moving, pose: g.photo > 0 ? 'cheer' : p.pose, jump: (p.jump || 0) * 0.008, body: g.body, risk: g.riskView });

      this.npcs.children.forEach((n) => {
        if (n.userData.parts) H.pose(n, { t: t + n.position.x, pose: n.userData.npc.pose || 'idle' });
      });
      this.markers.children.forEach((m) => {
        const { head, glow, ev } = m.userData;
        const isNext = g.events[g.eventIndex] === ev;
        /* 走到現場時路標收起來，別擋住眼前的狀況 */
        m.visible = !ev.done && !(stage && stage.ev === ev);
        if (!m.visible) return;
        head.position.y = 2.25 + (isNext ? Math.sin(t * 2.2 + ev.x) * 0.07 : 0);
        head.scale.setScalar(isNext ? 1 : 0.72);
        head.rotation.y = isNext ? Math.sin(t * 0.8) * 0.25 : 0;
        glow.material.opacity = isNext && g.nearEvent ? 0.8 : 0;
      });
      this.clouds.group.position.x = Math.sin(t * 0.02) * 12;
      /* 爬得越高，遠方那座山就越低；到山頂時你已經站在最高處 */
      if (this.peak) this.peak.position.y = LANDMARK.y - LANDMARK.sink * smooth(1200, 4700, heroX);
      const still = A.reducedMotion();
      let flash = 0;
      (this.stageList || []).forEach((st) => {
        DH.stage3d.update(st, { t, dt: g.dt, still, heroX, inCard: g.screen === 'card' });
        flash = Math.max(flash, st.flash);
      });
      this.hemi.intensity += flash * 1.5;
      swayU.time.value = still ? 0 : t;
      swayU.amp.value = still ? 0 : 0.05 + (g.fx ? g.fx.wind : 0) * 0.14 + sectionMix(p.x).ridge * 0.05;
      if (this.steam) {
        const dummy = this.steamDummy || (this.steamDummy = new T.Object3D());
        this.steam.puffs.forEach((q, i) => {
          const k = still ? q.phase : (t * 0.18 + q.phase) % 1;
          dummy.position.set(q.x + Math.sin(k * 7 + q.phase * 20) * 0.5 * k, q.y + k * 5.5, q.z);
          dummy.scale.setScalar(0.6 + k * 2.6 * (1 - k * 0.55));
          dummy.updateMatrix();
          this.steam.inst.setMatrixAt(i, dummy.matrix);
        });
        this.steam.inst.instanceMatrix.needsUpdate = true;
      }

      /* 鏡頭：走路時跟在身後；看題目時繞到側前方，把角色放在卡片外的空位 */
      const V = this.view;
      const card = g.cardRect;
      const ease = still || g.snap ? 1 : Math.min(1, g.dt * 3.2);
      let txOff = 0;
      let tyOff = 0;
      if (card) {
        const beside = card.left >= 130;
        if (beside) txOff = g.w / 2 - card.left / 2;
        else tyOff = g.h / 2 - (g.hudBottom + card.top) / 2;
      } else if (g.observing && g.w < g.h) {
        /* 直式畫面下方是說明面板，把現場往上推 */
        tyOff = g.h * 0.13;
      } else if (atStart) {
        /* 標題卡在左邊（手機在上方），把人物推到另一側 */
        if (g.w > 760) txOff = -g.w * 0.17;
        else tyOff = -g.h * 0.05;
      }
      V.ox += (txOff - V.ox) * ease;
      V.oy += (tyOff - V.oy) * ease;
      V.card += ((g.screen === 'card' ? 1 : 0) - V.card) * ease;
      this.camera.setViewOffset(g.w, g.h, V.ox, V.oy, g.w, g.h);

      let cam;
      let lookAt;
      if (onTrail) {
        const panYaw = (g.pan || 0) / 700;
        const rearYaw = Math.atan2(-s.tx, -s.tz) + panYaw * 1.2;
        const frontYaw = this.yaw + 0.62;
        let dy = frontYaw - rearYaw;
        dy = Math.atan2(Math.sin(dy), Math.cos(dy));
        const yaw = rearYaw + dy * V.card;
        /* 直式畫面的卡片佔掉下半部，鏡頭退遠一點，頭才不會鑽到上方面板後面 */
        const dist = 8.4 - V.card * (g.w < g.h ? 1 : 3.2);
        const high = 4.1 - V.card * 2.7;
        cam = new T.Vector3(pos.x + Math.sin(yaw) * dist, pos.y + high, pos.z + Math.cos(yaw) * dist);
        lookAt = new T.Vector3(pos.x + s.tx * (1 - V.card) * 2.4, pos.y + 1.15 + (1 - V.card) * 0.5, pos.z + s.tz * (1 - V.card) * 2.4);
        /* 有現場的題目：鏡頭留在肩後，看著角色面對眼前的狀況 */
        V.stage = (V.stage || 0) + ((stage ? 1 : 0) - (V.stage || 0)) * ease;
        if (stage) V.focus = stage.focus;
        if (V.stage > 0.002 && V.focus) {
          const ahead = new T.Vector3(V.focus.x - pos.x, 0, V.focus.z - pos.z).normalize();
          /* 直式畫面很窄：退遠、拉高、少偏移，才框得進角色和現場 */
          const tall = g.w < g.h;
          const shoulder = pos.clone().addScaledVector(ahead, tall ? -13 : -6.8).add(new T.Vector3(-ahead.z * (tall ? 0.7 : 2.2), tall ? 6.4 : 3.6, ahead.x * (tall ? 0.7 : 2.2)));
          cam.lerp(shoulder, V.stage);
          lookAt.lerp(pos.clone().lerp(V.focus, tall ? 0.72 : 0.6).add(new T.Vector3(0, 0.6, 0)), V.stage);
        }
      } else if (atStart) {
        const drift = A.reducedMotion() ? 0 : Math.sin(t * 0.09) * 0.5;
        const view = startDirection(s);
        cam = pos.clone().addScaledVector(view, -START_SHOT.back).add(new T.Vector3(-view.z * drift, START_SHOT.up, view.x * drift));
        lookAt = pos.clone().addScaledVector(view, 24).add(new T.Vector3(0, START_SHOT.lookUp, 0));
      } else {
        /* 準備流程後方：站在牌樓前看遠方 */
        const c = place(330, 1.2);
        cam = new T.Vector3(c.x, sampleRoute(330).y + 2.6, c.z);
        const l = place(1000, 0);
        lookAt = new T.Vector3(l.x, sampleRoute(1000).y + 2.5, l.z);
      }
      if (!this.camInit || g.snap || atStart !== this.wasStart) {
        this.wasStart = atStart;
        this.camPos.copy(cam);
        this.camLook = lookAt.clone();
        this.camInit = true;
      }
      const follow = still ? 1 : Math.min(1, g.dt * 5);
      this.camPos.lerp(cam, follow);
      this.camLook.lerp(lookAt, follow);
      /* 開場從高處往下俯衝到人物身後；登頂時繞著人物轉一圈 */
      if (g.intro > 0 && onTrail) {
        const k = g.intro * g.intro * (3 - 2 * g.intro);
        const high = pos.clone().addScaledVector(new T.Vector3(s.tx, 0, s.tz), -26).add(new T.Vector3(s.nx * 8, 24, s.nz * 8));
        const ahead = pos.clone().addScaledVector(new T.Vector3(s.tx, 0, s.tz), 70).add(new T.Vector3(0, 24, 0));
        this.camPos.copy(cam).lerp(high, k);
        this.camLook.copy(lookAt).lerp(ahead, k);
      } else if (g.orbit > 0 && onTrail) {
        /* 從身後順著繞到正面，才拍得到慶祝的表情；不走直線，免得穿過人物 */
        const k = Math.min(1, Math.min(g.orbit, 1 - g.orbit) * 4);
        const blend = k * k * (3 - 2 * k);
        const rear = Math.atan2(-s.tx, -s.tz);
        const front = Math.atan2(s.tx, s.tz) + (g.orbit - 0.5) * 1.1;
        const turn = Math.atan2(Math.sin(front - rear), Math.cos(front - rear));
        const a = rear + turn * blend;
        const reach = 8.4 + blend * 0.6;
        const around = pos.clone().add(new T.Vector3(Math.sin(a) * reach, 4.1 - blend * 2.3, Math.cos(a) * reach));
        around.y = Math.max(around.y, this.heightAt(around.x, around.z) + 1.1);
        this.camPos.copy(cam).lerp(around, blend);
        this.camLook.copy(lookAt).lerp(pos.clone().add(new T.Vector3(0, 2.9, 0)), blend);
      }
      if (g.photo > 0 && onTrail) {
        const shot = this.photoShot(heroX, p.d);
        const k = g.photo * g.photo * (3 - 2 * g.photo);
        this.camPos.copy(cam).lerp(shot.cam, k);
        this.camLook.copy(lookAt).lerp(shot.look, k);
      }
      /* 看現場時，鏡頭和角色之間的路牌、燈柱先讓開 */
      const shot = new T.Line3(this.camPos, pos);
      const near = new T.Vector3();
      this.props.children.forEach((prop) => {
        prop.visible = !(V.stage > 0.2 || g.orbit > 0) || shot.closestPointToPoint(prop.position, true, near).distanceTo(prop.position) > 3.2;
      });
      this.clearShot(this.camPos, pos, g.photo > 0);
      /* 鏡頭不鑽進地裡 */
      const floor = this.heightAt(this.camPos.x, this.camPos.z) + 1.1;
      if (this.camPos.y < floor) this.camPos.y = floor;
      this.camera.position.copy(this.camPos);
      this.camera.lookAt(this.camLook);
      this.placeSun(pos, atStart);
      this.updateRain(t);
      this.updateSparks(g.dt);

      this.renderer.render(this.scene, this.camera);
      this.watchSpeed(g.dt);
    },

    /* 跑不動時先降解析度、再關陰影，不讓操作卡頓 */
    watchSpeed(dt) {
      if (FULL_QUALITY) return;
      this.frameMs += (dt * 1000 - this.frameMs) * 0.05;
      if (this.frameMs > 42) this.slowFrames++;
      else this.slowFrames = 0;
      if (this.slowFrames > 70) {
        this.slowFrames = 0;
        const ratio = this.renderer.getPixelRatio();
        if (ratio > 1) {
          this.setQuality(Math.max(1, ratio - 0.5));
        } else if (this.sun.castShadow) {
          this.sun.castShadow = false;
        } else if (ratio > 0.75) {
          this.setQuality(Math.max(0.75, ratio - 0.25));
        } else if (!this.sparse) {
          /* 最後一招：拿掉草和花，遊戲內容不受影響 */
          this.sparse = true;
          this.applySparse();
        }
      }
    },

    setQuality(ratio) {
      this.renderer.setPixelRatio(ratio);
      this.renderer.setSize(this.size.w, this.size.h, false);
    },
    applySparse() {
      this.land.traverse((n) => {
        if (n.isInstancedMesh && n.userData.soft) n.visible = false;
      });
    },

    /* 結局：把這趟的角色放在真正的場景裡拍一張會動的畫面 */
    renderEnding(c2d, w, h, g) {
      this.restoreShot();
      const tier = g.tier;
      if (this.endingTier !== tier) {
        this.endingTier = tier;
        clearOwned(this.extras);
        this.heli = null;
        /* 路牌與路人會擋鏡頭，這一幕只留主角和這個結局需要的東西 */
        this.props.visible = false;
        this.npcs.visible = false;
        /* 好結局不停在山頂：平安回到登山口才算走完 */
        const x = tier === 'good' ? FINISH_X - 60 : tier === 'normal' ? 6800 : clamp(g.player.x, 900, 7000);
        this.endingX = x;
        const s = sampleRoute(x);
        const base = place(x, 0);
        base.y = s.y;
        this.endingPos = base;
        if (tier === 'good') {
          const gate = archGate('平安下山', '#8d6a4e');
          gate.position.copy(place(x - 150, 0));
          gate.position.y = sampleRoute(x - 150).y;
          gate.rotation.y = Math.atan2(s.tx, s.tz);
          const parked = car();
          parked.position.copy(place(x + 10, 6.2));
          parked.position.y = this.heightAt(parked.position.x, parked.position.z);
          parked.rotation.y = Math.atan2(s.tx, s.tz) + 0.8;
          this.extras.add(gate, parked);
        }
        if (tier === 'normal') {
          const l = lantern();
          l.position.copy(base).add(new T.Vector3(s.nx * 1.8, 0, s.nz * 1.8));
          this.extras.add(l);
        }
        if (tier === 'bad') {
          const crew = { jacket: '#e8605c', pack: '#f4c76b', hat: '#fffdf6', hatBand: '#e8605c', pants: '#4a5468', hair: '#3a2c24' };
          const medic = H.build({ colors: crew, helmet: true });
          medic.position.copy(base).add(new T.Vector3(s.nx * 1.7, 0, s.nz * 1.7));
          medic.rotation.y = Math.atan2(-s.nx, -s.nz);
          medic.userData.crew = 'stand';
          const rescuer = H.build({ colors: crew, helmet: true });
          const heli = helicopter();
          heli.position.copy(base).add(new T.Vector3(-s.tx * 4 - s.nx * 2.4, 8.6, -s.tz * 4 - s.nz * 2.4));
          heli.rotation.y = Math.atan2(s.nx, s.nz);
          rescuer.position.copy(heli.position).add(new T.Vector3(0, -6, 0));
          rescuer.rotation.y = Math.atan2(-s.tx, -s.tz);
          rescuer.userData.crew = 'hang';
          const rope = new T.Mesh(cyl(0.025, 0.025, 4.2), m3('#fffdf6'));
          rope.position.copy(heli.position).add(new T.Vector3(0, -3.2, 0));
          this.extras.add(heli, medic, rescuer, rope);
          this.heli = heli;
        }
      }
      const s = sampleRoute(this.endingX);
      const pos = this.endingPos;
      if (g.outfit) this.setHero({ outfit: g.outfit });
      else this.setHero({});
      this.hero.position.copy(pos);
      this.hero.visible = true;
      const faceCam = Math.atan2(s.tx + s.nx * 0.45, s.tz + s.nz * 0.45);
      this.hero.rotation.y = faceCam;
      const t = g.t;
      const jump = tier === 'good' && !A.reducedMotion() ? Math.abs(Math.sin(t * 3.2)) * 0.35 : 0;
      H.pose(this.hero, { t, pose: tier === 'good' ? 'cheer' : tier === 'bad' ? 'wave' : 'idle', jump, risk: tier === 'normal' ? 62 : 10 });
      this.extras.children.forEach((n) => {
        if (n.userData.parts) H.pose(n, { t: t + 2, pose: n.userData.crew === 'hang' ? 'wave' : 'idle' });
      });
      if (this.heli) this.heli.userData.rotor.rotation.y = A.reducedMotion() ? 0.5 : t * 22;

      this.resize(w, h);
      this.camera.clearViewOffset();
      this.applySky(Object.assign({}, g, {
        section: tier === 'normal' ? 'descent' : 'trailhead',
        riskView: 0,
        fx: { fog: 0, rain: 0, wind: 0, cold: 0 },
      }), tier === 'normal' ? 'dusk' : 'clear');
      /* 全螢幕的那幾秒，鏡頭從遠處緩緩推近、繞半圈；之後小框裡靜靜停著 */
      const sweep = g.cine === undefined ? 0 : g.cine;
      const camDir = new T.Vector3(s.tx + s.nx * 0.45, 0, s.tz + s.nz * 0.45).normalize().applyAxisAngle(new T.Vector3(0, 1, 0), sweep * 0.9);
      /* 直式畫面比較窄，退遠一點才不會切到人 */
      const fit = w / h < 1 ? 1.3 : 1;
      const far = (tier === 'bad' ? 13 : 7.4) * (1 + sweep * 0.6) * fit;
      /* 救援畫面常在樹林裡，把鏡頭拉高到樹梢之上才看得到人和直升機 */
      this.camera.position.copy(pos).addScaledVector(camDir, far).add(new T.Vector3(0, tier === 'bad' ? 7.5 + sweep * 4 : 1.7, 0));
      const floor = this.heightAt(this.camera.position.x, this.camera.position.z) + 1;
      if (this.camera.position.y < floor) this.camera.position.y = floor;
      this.camera.lookAt(pos.x, pos.y + (tier === 'bad' ? (c2d ? 5.4 : 6.5) : c2d ? 1.25 : 2.5), pos.z);
      this.markers.visible = false;
      this.placeSun(pos);
      this.updateRain(0);
      this.renderer.render(this.scene, this.camera);
      if (c2d) c2d.drawImage(this.canvas, 0, 0, w, h);
    },

    /* 拍照的鏡位：站在角色身後一點，角色轉過身來，背景就是前方的山 */
    photoShot(x, d) {
      const s = sampleRoute(x);
      const pos = place(x, (d - 0.5) * PATH_W);
      pos.y = s.y;
      const cam = pos.clone().add(new T.Vector3(-s.tx * PHOTO.back + s.nx * PHOTO.side, PHOTO.up, -s.tz * PHOTO.back + s.nz * PHOTO.side));
      cam.y = Math.max(cam.y, this.heightAt(cam.x, cam.z) + 1);
      const look = pos.clone().add(new T.Vector3(s.tx * PHOTO.lead, PHOTO.lookUp, s.tz * PHOTO.lead));
      return { pos, cam, look, yaw: Math.atan2(cam.x - pos.x, cam.z - pos.z) };
    },
    restoreShot() {
      if (!this.shotHidden) return;
      this.shotHidden.forEach((obj) => { obj.visible = true; });
      this.shotHidden.clear();
    },
    /* 只恢復拍照暫時藏起來的物件，不能重新顯示已答完的路標。 */
    clearShot(from, to, enabled) {
      this.restoreShot();
      if (!enabled) return;
      if (!this.shotHidden) this.shotHidden = new Set();
      const line = new T.Line3(from, to);
      const near = new T.Vector3();
      [this.props, this.markers, this.npcs].forEach((group) => {
        group.children.forEach((obj) => {
          if (obj.visible && line.closestPointToPoint(obj.position, true, near).distanceTo(obj.position) < 3.2) {
            this.shotHidden.add(obj);
            obj.visible = false;
          }
        });
      });
    },
    /* 照片是另外算一張正方形，和視窗比例無關；算完把畫面大小還原。 */
    capturePhoto({ x, d, pose, size }) {
      const shot = this.photoShot(x, d);
      const hero = this.hero;
      const last = this.lastBody || {};
      hero.visible = true;
      hero.position.copy(shot.pos);
      hero.rotation.y = shot.yaw;
      H.pose(hero, { t: last.t || 0, phase: 0, moving: false, pose, jump: 0, body: last.body, risk: last.risk });
      this.clearShot(shot.cam, shot.pos, true);
      const r = this.renderer;
      const ratio = r.getPixelRatio();
      const { w, h } = this.size;
      r.setPixelRatio(1);
      r.setSize(size, size, false);
      this.camera.clearViewOffset();
      this.camera.aspect = 1;
      this.camera.updateProjectionMatrix();
      this.camera.position.copy(shot.cam);
      this.camera.lookAt(shot.look);
      r.render(this.scene, this.camera);
      const cv = document.createElement('canvas');
      cv.width = cv.height = size;
      cv.getContext('2d').drawImage(this.canvas, 0, 0);
      r.setPixelRatio(ratio);
      r.setSize(w, h, false);
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      return cv;
    },

    /* 全螢幕段落結束時，把最後一格留下來當結局頁的背景 */
    snapshotTo(cv) {
      cv.width = this.canvas.width;
      cv.height = this.canvas.height;
      cv.getContext('2d').drawImage(this.canvas, 0, 0);
    },

    leaveEnding() {
      this.restoreShot();
      this.endingTier = null;
      this.heli = null;
      this.markers.visible = true;
      this.props.visible = true;
      this.npcs.visible = true;
      clearOwned(this.extras);
    },
  };

  DH.world3d = world3d;
})();
