/* 題目發生的現場：走到題目前就看得到，答完場景會回應。
   規則與答案都不在這裡，這裡只決定「玩家眼前發生什麼」。線索只描述看得到的事，不暗示選項。 */
(function () {
  const DH = (window.DH = window.DH || {});
  const T = window.THREE;

  const clue = (at, name, text) => ({ at, name, text });

  /* 每種現場答完之後世界怎麼回應。錯的選項不只一種，這裡只寫現場本身的變化 */
  const REACT = {
    rockfall: { calm: '你離開了落石的路徑。坡上的石頭還在掉，但已經碰不到你。', danger: '現場沒有等你。又一輪石頭滾過你剛才要走的那段路。' },
    thunder: { calm: '你離開了最高處。雷聲還在，但你已經不是這裡最高的東西。', danger: '閃電打得更近了，雷聲幾乎和閃光同時到。' },
    flood: { calm: '你離開了溪床。幾分鐘後，剛才站的石頭已經看不見了。', danger: '水位在你眼前往上漲，水裡的枯枝流得更快了。' },
    fog: { calm: '大家回到彼此看得見的距離，先確認位置再動。', danger: '霧更濃了，同伴的身影已經看不清楚。' },
    bear: { calm: '你慢慢拉開距離。黑熊有了離開的空間，走進林子裡。', danger: '黑熊抬起頭，朝你這邊走了幾步。' },
    hornets: { calm: '你退開之後，虎頭蜂慢慢飛回巢邊。', danger: '更多虎頭蜂從巢裡飛出來，繞著你打轉。' },
    macaques: { calm: '獼猴發現這裡沒有吃的，慢慢走開了。', danger: '獼猴學會了人有食物，靠得更近了。' },
    collapse: { calm: '你退回穩固的路面。對面的土石還在滑。', danger: '又有一片土石從對面滑下來，路基缺口變大了。' },
    mate: { calm: '隊友的狀況穩下來，大家有時間做下一步。', danger: '隊友的狀況看起來更糟了。' },
    ice: { calm: '你在冰面前停下，沒有拿自己冒險。', danger: '腳下一滑，冰面比看起來更難站穩。' },
    gust: { calm: '你壓低重心退到避風處，風從頭上過去。', danger: '一陣更強的風推得你站不穩。' },
    closure: { calm: '封閉的路留給它自己。山一直都在，下次再來。', danger: '告示還立在那裡，公告不會因為你到了就改變。' },
    snake: { calm: '蛇已經離開。你把注意力放回傷口和求援。', danger: '傷處比剛才更腫了。' },
  };

  /* 這些現場的正解是停下或折返，但路線只有一條，遊戲會繼續：要對玩家講清楚這是練習 */
  const HALTS = new Set(['rockfall', 'thunder', 'flood', 'collapse', 'ice', 'gust', 'closure']);

  const THUNDER_CLUES = (biome) => [
    clue('cloud', '雲', '雲頂一直往上長，底部越來越黑。'),
    clue('bolt', '雷聲', '遠方有閃光，接著聽得見雷聲。'),
    clue('ahead', '前面的路', biome.chains ? '前面是裸露岩壁和鐵鍊，沒有任何遮蔽。' : '前面的路完全裸露，沒有任何遮蔽。'),
  ];
  const BY_ID = {
    'falling-rock': { kind: 'rockfall', clues: () => [
      clue('source', '坡頂', '小石頭一顆接一顆往下掉，不是偶爾一顆。'),
      clue('slope', '碎石坡', '整片坡都是鬆散的碎石，中間沒有地方可以躲。'),
      clue('mate', '隊友', '隊友站在坡上招手，說戴著頭盔快過就好。'),
    ] },
    'thunder-ridge': { kind: 'thunder', clues: THUNDER_CLUES },
    'afternoon-thunder': { kind: 'thunder', mate: 'photo', clues: THUNDER_CLUES },
    'prep-thunder-stop': { kind: 'thunder' },
    'flash-flood': { kind: 'flood', clues: () => [
      clue('water', '水色', '剛才還清清的水，現在變得混濁。'),
      clue('log', '枯枝', '水面開始漂來枯枝。'),
      clue('cloud', '上游', '你頭頂沒下雨，但上游被烏雲遮住了。'),
    ] },
    'unsafe-crossing': { kind: 'flood', mate: 'wave', clues: () => [
      clue('water', '水位', '水比去程高，踏腳的石頭幾乎看不見。'),
      clue('log', '水流', '水流很急，枯枝一下就被帶走。'),
      clue('mate', '隊友', '隊友在岸邊招手，建議大家拉住彼此快速通過。'),
    ] },
    'key-flood-wait-retreat': { kind: 'flood' },
    'fog-junction': { kind: 'fog', fork: true, clues: () => [
      clue('fork', '岔路', '路在這裡分成兩條，霧裡只看得見幾公尺。'),
      clue('ribbon', '布條', '幾條舊布條顏色都不一樣，看不出是誰綁的。'),
      clue('mate', '隊友', '隊友已經快走出你的視線。'),
    ] },
    'lost-stop': { kind: 'fog' },
    'lost-stop-b': { kind: 'fog' },
    'black-bear-encounter': { kind: 'bear', mate: 'idle', clues: () => [
      clue('bear', '黑熊', '臺灣黑熊就在前方轉彎處，還沒有靠近。'),
      clue('mate', '隊友', '隊友很緊張，手裡握著食物袋。'),
      clue('back', '來路', '你身後的路還是空的。'),
    ] },
    'black-bear-distance': { kind: 'bear', clues: () => [
      clue('bear', '黑熊', '臺灣黑熊在步道轉彎處，暫時沒有靠近。'),
      clue('back', '來路', '沿來路往回，還有空間可以退開。'),
    ] },
    'hornet-warning': { kind: 'hornets', mate: 'idle', clues: () => [
      clue('swarm', '虎頭蜂', '幾隻虎頭蜂反覆飛近，又退回去。'),
      clue('nest', '樹上', '前方樹上有一團褐色的東西，看起來像蜂巢。'),
      clue('mate', '同行者', '同行者舉起登山杖，想把牠們趕走。'),
    ] },
    'monkey-no-feeding': { kind: 'macaques' },
    'collapsed-trail': { kind: 'collapse', clues: () => [
      clue('gap', '路基', '步道的路基缺了一大段。'),
      clue('sign', '告示', '這裡立著封閉告示，旁邊有一條新踩出來的陡坡小徑。'),
      clue('slide', '對面', '雨還在下，對面仍有零星土石滑落。'),
    ] },
    'prep-ice-turn': { kind: 'ice' },
    'ridge-gust': { kind: 'gust' },
    'prep-postpone': { kind: 'closure' },
    'snakebite-rescue': { kind: 'snake' },
    'hypothermia-blanket': { kind: 'mate' },
    'wet-hypothermia': { kind: 'mate' },
    'key-hypothermia-evacuation': { kind: 'mate' },
    'heatstroke-descent': { kind: 'mate' },
    'heatstroke-confusion': { kind: 'mate' },
    'ams-turnaround': { kind: 'mate' },
    'severe-altitude': { kind: 'mate' },
    'fracture-stay': { kind: 'mate' },
    'key-collapse-cpr': { kind: 'mate' },
  };

  /* 看過現場後，題目不再把線索講一遍；判斷的依據要來自剛才看到的東西 */
  const ASK = {
    'falling-rock': '你站在碎石坡前，還沒踏上去。接下來怎麼做？',
    'thunder-ridge': '你正走向稜線，離山頂只剩一小段。接下來怎麼做？',
    'afternoon-thunder': '離山頂只剩一小段，隊友想先拍登頂照。接下來怎麼做？',
    'flash-flood': '你原本想在溪邊休息。接下來怎麼做？',
    'unsafe-crossing': '這是你去程走過的渡溪點。接下來怎麼做？',
    'fog-junction': '你站在稜線的岔路口。接下來怎麼做？',
    'black-bear-encounter': '你在林道轉彎處停下腳步。接下來怎麼做？',
    'black-bear-distance': '你在步道轉彎處停下腳步。接下來怎麼做？',
    'hornet-warning': '你在林間停下腳步，還沒被螫。接下來怎麼做？',
    'collapsed-trail': '你正在下撤，眼前的路走不下去了。接下來怎麼做？',
  };

  const VIEW_RANGE = 1400;

  function softTexture() {
    const cv = document.createElement('canvas');
    cv.width = cv.height = 128;
    const c = cv.getContext('2d');
    const grad = c.createRadialGradient(64, 64, 8, 64, 64, 64);
    grad.addColorStop(0, 'rgba(255,255,255,.9)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = grad;
    c.fillRect(0, 0, 128, 128);
    return new T.CanvasTexture(cv);
  }
  let soft = null;

  /* 路的上坡側立起一面邊坡：坡面有起伏，兩端收進地形，中間一道落石滑過的淺色痕跡 */
  function hillside(k, { z0, z1, foot, top, height, chute }) {
    const clamp01 = (v) => Math.max(0, Math.min(1, v));
    const rise = (u, z) => {
      const t = clamp01((foot - u) / (foot - top));
      const ends = clamp01(Math.min(z - z0, z1 - z) / 3.2);
      const fade = ends * ends * (3 - 2 * ends);
      const bumps = Math.sin(z * 1.7 + u * 0.9) * 0.4 + Math.sin(z * 0.6 - u * 1.3) * 0.6;
      return (Math.pow(t, 1.2) * height + bumps * t) * fade;
    };
    k.add(k.ribbon({ z0, z1, u0: top, u1: foot, color: '#7f7a6f', lift: 0.1, rise, cols: 22, rows: 26, flat: true, textured: '#d6d0c4' }));
    k.add(k.ribbon({ z0: chute[0], z1: chute[1], u0: top * 0.97, u1: foot, color: '#a9a394', lift: 0.17, rise, cols: 18, rows: 8, flat: true, textured: '#ffffff' }));
    return { rise, on: (z, u) => k.ground(z, u).add(new T.Vector3(0, rise(u, z), 0)) };
  }

  /* 每個 builder 回傳 update(s)，s = { t, dt, mood, age, still }；age 是答題後過了幾秒 */
  const BUILD = {
    rockfall(k, out, spec) {
      const WALL_FOOT = -2.9;
      const WALL_TOP = -13;
      const hill = hillside(k, { z0: 0.5, z1: 19, foot: WALL_FOOT, top: WALL_TOP, height: 12, chute: [6, 11.5] });
      const onSlope = hill.on;
      k.add(k.ribbon({ z0: 5.6, z1: 11.9, u0: WALL_FOOT, u1: 9, color: '#8f8a7f', lift: 0.1, textured: '#f4efe4' }));
      for (let i = 0; i < 40; i++) {
        const rng = (n) => k.rand(i * 7 + n);
        const stone = k.rock(0.25 + rng(1) * 0.55, rng(2) > 0.5 ? '#a19c90' : '#7c7a72');
        stone.position.copy(onSlope(3 + rng(3) * 13, WALL_TOP + rng(4) * 21));
        stone.rotation.set(rng(5) * 3, rng(6) * 3, 0);
        k.add(stone);
      }
      [[5.2, 1.2], [7, 1.7], [8.8, 2.1], [10.6, 1.8], [12.4, 1.4], [14, 1.1]].forEach(([z, r]) => {
        const crag = k.rock(r, '#5f5c55');
        crag.position.copy(onSlope(z, WALL_TOP)).add(new T.Vector3(0, 0.4, 0));
        k.add(crag);
      });
      k.add(k.sign(k.places.scree || '碎石坡', '落石注意', 2.5, 3.4));
      out.mate = k.hiker(spec.mate || 'wave', 9.5, 0.3);
      const flying = [0, 1, 2, 3, 4, 5].map((i) => {
        const r = k.rock(0.3 + i * 0.07, '#57544e');
        k.add(r);
        return { r, phase: i / 6, z: 6.3 + i * 0.95 };
      });
      const roll = (z, u, bounce) => onSlope(z, WALL_TOP + 0.6 + u * 23).add(new T.Vector3(0, 0.35 + Math.abs(Math.sin(u * 15)) * bounce * (1 - u * 0.6), 0));
      const boulder = k.rock(1.05, '#4f4c47');
      boulder.visible = false;
      k.add(boulder);
      out.clues = { source: onSlope(9.6, WALL_TOP).add(new T.Vector3(0, 2.6, 0)), slope: onSlope(8.2, -6.5).add(new T.Vector3(0, 0.8, 0)), mate: out.mate.position.clone().add(new T.Vector3(0, 2.4, 0)) };
      out.focus = k.ground(9, -2.8).add(new T.Vector3(0, 3.2, 0));
      /* 固定全景：落石源頭、坡面、步道與角色同框，答對退開時看得到自己走出落石區 */
      out.shot = {
        tall: { cam: k.ground(-21, 5.5).add(new T.Vector3(0, 10, 0)), look: k.ground(7, -2.2).add(new T.Vector3(0, 4.4, 0)) },
        wide: { cam: k.ground(-17, 8).add(new T.Vector3(0, 7.5, 0)), look: k.ground(5, -3.5).add(new T.Vector3(0, 3.6, 0)) },
      };
      return (s) => {
        const speed = s.mood === 'danger' ? 0.62 : 0.32;
        flying.forEach((f) => {
          const u = s.still ? f.phase : (s.t * speed + f.phase) % 1;
          f.r.position.copy(roll(f.z, u, 1.1));
          f.r.rotation.x = u * 22;
        });
        boulder.visible = s.mood === 'danger' && !s.still && s.age < 3.2;
        if (boulder.visible) {
          const u = Math.min(1, s.age / 1.7);
          boulder.position.copy(roll(6.6, u, 1.3)).add(new T.Vector3(0, 0.6, 0));
          boulder.rotation.x = u * 16;
        }
        k.poseHiker(out.mate, s.t);
      };
    },

    thunder(k, out, spec) {
      const cloudAt = k.ground(80, -24).add(new T.Vector3(0, 30, 0));
      const dark = k.mat('#4f5868', { roughness: 1 });
      [[0, 0, 0, 20], [-16, -7, 5, 15], [15, -8, -2, 16], [4, 13, 0, 13], [-6, 22, 2, 8], [-24, -10, 8, 10], [24, -11, 4, 10]].forEach(([x, y, z, r], i) => {
        const puff = new T.Mesh(k.geoSphere, i < 3 ? dark : k.mat('#68727f', { roughness: 1 }));
        puff.position.copy(cloudAt).add(new T.Vector3(x, y, z));
        puff.scale.setScalar(r);
        k.add(puff);
      });
      const boltMat = new T.MeshBasicMaterial({ color: '#fff6c9', transparent: true, opacity: 0, fog: false });
      const boltAt = cloudAt.clone().add(new T.Vector3(10, -18, 8));
      const bolt = new T.Group();
      let y = 0;
      let x = 0;
      for (let i = 0; i < 6; i++) {
        const len = 5 + (i % 2);
        const lean = i % 2 ? -0.5 : 0.42;
        const seg = new T.Mesh(new T.BoxGeometry(0.5, len, 0.5), boltMat);
        seg.position.set(x + Math.sin(lean) * len * 0.5, y - Math.cos(lean) * len * 0.5, 0);
        seg.rotation.z = lean;
        bolt.add(seg);
        x += Math.sin(lean) * len;
        y -= Math.cos(lean) * len;
      }
      bolt.position.copy(boltAt);
      k.add(bolt);
      const cairn = k.rock(0.9, '#8e8a7f');
      cairn.position.copy(k.ground(13, 2));
      k.add(cairn);
      out.mate = spec.mate ? k.hiker(spec.mate, 8, -0.8) : null;
      out.clues = { cloud: cloudAt.clone().add(new T.Vector3(0, 6, 0)), bolt: boltAt.clone().add(new T.Vector3(0, -12, 0)), ahead: k.ground(11, 0).add(new T.Vector3(0, 1.4, 0)) };
      out.focus = k.ground(30, -3).add(new T.Vector3(0, 7, 0));
      return (s) => {
        const period = s.mood === 'danger' ? 1.7 : 4.2;
        const phase = s.t % period;
        const on = !s.still && phase < 0.18 && Math.floor(s.t * 40) % 2 === 0;
        boltMat.opacity = on ? 1 : 0;
        out.flash = on ? (s.mood === 'danger' ? 1.1 : 0.55) : 0;
        if (out.mate) k.poseHiker(out.mate, s.t);
      };
    },

    flood(k, out, spec) {
      const mat = { color: '#8a6336', lift: 0.42, roughness: 0.28 };
      const water = k.ribbon(Object.assign({ z0: 3.6, z1: 13.5, u0: -26, u1: 26 }, mat));
      k.add(water);
      /* 水面的白沫往下游流，看起來才像急流，不像土路 */
      const foamMat = new T.MeshStandardMaterial({ color: '#f4efe2', roughness: 0.6, transparent: true, opacity: 0.82 });
      const foam = [];
      for (let i = 0; i < 26; i++) {
        const f = new T.Mesh(k.geoSphere, foamMat);
        const r = (n) => k.rand(i * 13 + n);
        f.scale.set(0.5 + r(1) * 1.1, 0.05, 0.14 + r(2) * 0.2);
        k.add(f);
        foam.push({ f, z: 4 + r(3) * 9, phase: r(4) });
      }
      const logs = [0, 1, 2, 3].map((i) => {
        const log = new T.Mesh(new T.CylinderGeometry(0.13, 0.17, 2.2, 8), k.mat('#6b4e38'));
        log.rotation.set(0, 0, Math.PI / 2 + i * 0.3);
        k.add(log);
        return { log, phase: i / 4, z: 6 + i * 1.2 };
      });
      [[-2.2, 6], [0.8, 7.5], [2.6, 9.4]].forEach(([u, z], i) => {
        const rock = k.rock(0.42 + i * 0.05, '#8d8e85');
        rock.position.copy(k.ground(z, u)).add(new T.Vector3(0, 0.2, 0));
        k.add(rock);
      });
      const cloudAt = k.ground(70, -38).add(new T.Vector3(0, 20, 0));
      [[0, 0, 12], [-11, -3, 9], [11, -4, 9]].forEach(([x, y, r]) => {
        const puff = new T.Mesh(k.geoSphere, k.mat('#59616e', { roughness: 1 }));
        puff.position.copy(cloudAt).add(new T.Vector3(x, y, 0));
        puff.scale.setScalar(r);
        k.add(puff);
      });
      out.mate = spec.mate ? k.hiker(spec.mate, 3.4, -2) : null;
      out.clues = { water: k.ground(8, 3).add(new T.Vector3(0, 0.7, 0)), log: k.ground(7, -5).add(new T.Vector3(0, 0.9, 0)), cloud: cloudAt, mate: out.mate ? out.mate.position.clone().add(new T.Vector3(0, 2.4, 0)) : null };
      out.focus = k.ground(11, -2).add(new T.Vector3(0, 1.5, 0));
      const base = water.position.y;
      return (s) => {
        const rise = s.mood === 'danger' ? Math.min(1.1, s.age * 0.35) : s.mood === 'calm' ? Math.min(0.5, s.age * 0.1) : 0;
        water.position.y = base + rise + (s.still ? 0 : Math.sin(s.t * 1.7) * 0.03);
        const flow = s.mood === 'danger' ? 0.16 : 0.09;
        foam.forEach((q) => {
          const u = s.still ? q.phase : (s.t * flow + q.phase) % 1;
          const p = k.ground(q.z, 25 - u * 50);
          q.f.position.set(p.x, Math.max(p.y, k.ground(q.z, 0).y) + 0.48 + rise, p.z);
          q.f.rotation.y = k.yaw(q.z) + Math.PI / 2;
        });
        logs.forEach((l) => {
          const u = s.still ? l.phase : (s.t * (s.mood === 'danger' ? 0.2 : 0.1) + l.phase) % 1;
          const p = k.ground(l.z, 26 - u * 52);
          p.y = Math.max(p.y, k.ground(l.z, 0).y) + 0.4 + rise;
          l.log.position.copy(p);
        });
        if (out.mate) k.poseHiker(out.mate, s.t);
      };
    },

    fog(k, out, spec) {
      soft = soft || softTexture();
      const puffs = [];
      for (let i = 0; i < 16; i++) {
        const sp = new T.Sprite(new T.SpriteMaterial({ map: soft, color: '#eef2f2', transparent: true, opacity: 0.62, depthWrite: false, fog: false }));
        const r = (n) => k.rand(i * 11 + n);
        sp.position.copy(k.ground(2 + r(1) * 26, -16 + r(2) * 32)).add(new T.Vector3(0, 1 + r(3) * 3, 0));
        sp.scale.setScalar(10 + r(4) * 10);
        k.add(sp);
        puffs.push(sp);
      }
      if (spec.fork) {
        const post = k.sign('往？', '岔路', 7.2, 0.2);
        k.add(post);
        const left = k.ribbon({ z0: 7.5, z1: 20, u0: -8, u1: -2.3, color: '#cfb68a', lift: 0.08 });
        k.add(left);
        const colors = ['#d9443d', '#e8c23a', '#3f7fd0'];
        colors.forEach((color, i) => {
          const g = new T.Group();
          k.mesh(g, new T.CylinderGeometry(0.05, 0.05, 1.5, 8), '#6b4e38', [0, 0.75, 0]);
          k.mesh(g, new T.BoxGeometry(0.1, 0.5, 0.03), color, [0.07, 1.25, 0]);
          g.position.copy(k.ground(4.4 + i * 1.2, -2.3 - i * 0.4));
          k.add(g);
        });
        out.mate = k.hiker('idle', 14, 0.1);
        out.mate.rotation.y += Math.PI;
        out.clues = { fork: post.position.clone().add(new T.Vector3(0, 2.8, 0)), ribbon: k.ground(5.2, -2.7).add(new T.Vector3(0, 1.8, 0)), mate: out.mate.position.clone().add(new T.Vector3(0, 2.3, 0)) };
      }
      out.focus = k.ground(10, 0).add(new T.Vector3(0, 1.7, 0));
      return (s) => {
        const o = (s.mood === 'danger' ? 0.86 : s.mood === 'calm' ? 0.45 : 0.62) * (1 - s.gone);
        puffs.forEach((sp, i) => {
          sp.material.opacity += (o - sp.material.opacity) * Math.min(1, s.dt * (s.gone ? 6 : 1.5));
          if (!s.still) sp.material.rotation = s.t * 0.03 + i;
        });
        if (out.mate) k.poseHiker(out.mate, s.t, true);
      };
    },

    bear(k, out, spec) {
      const bear = k.animal('bear');
      const home = k.ground(11, -0.6);
      bear.position.copy(home);
      bear.scale.setScalar(1.25);
      bear.rotation.y = k.yaw(11) + Math.PI;
      k.add(bear);
      [[-4, 11], [3.8, 12.5], [-5.4, 9.5], [4.8, 10]].forEach(([u, z], i) => {
        const bush = k.rock(1.1 + i * 0.1, '#4d8d58');
        bush.position.copy(k.ground(z, u)).add(new T.Vector3(0, 0.5, 0));
        k.add(bush);
      });
      out.mate = spec.mate ? k.hiker(spec.mate, 1.6, 2.6) : null;
      if (out.mate) {
        const bag = new T.Mesh(new T.BoxGeometry(0.34, 0.4, 0.2), k.mat('#d97642'));
        bag.position.set(0.42, 0.95, 0.25);
        out.mate.add(bag);
      }
      out.clues = { bear: home.clone().add(new T.Vector3(0, 3.1, 0)), mate: out.mate ? out.mate.position.clone().add(new T.Vector3(0, 2.4, 0)) : null, back: k.ground(-5, -1.3).add(new T.Vector3(0, 0.3, 0)) };
      out.focus = home.clone().add(new T.Vector3(0, 1.3, 0));
      return (s) => {
        bear.position.copy(home);
        if (s.mood === 'calm') {
          const u = Math.min(1, s.age / 3.5);
          bear.position.copy(k.ground(11 + u * 2, -0.6 - u * 11));
          bear.rotation.y = k.yaw(11) - Math.PI / 2;
        } else if (s.mood === 'danger') {
          bear.position.copy(k.ground(11 - Math.min(1, s.age / 1.4) * 3.2, -0.6));
        }
        if (!s.still) bear.position.y += Math.sin(s.t * 2.1) * 0.04;
        if (out.mate) k.poseHiker(out.mate, s.t);
      };
    },

    hornets(k, out, spec) {
      const trunk = k.ground(10, -3.4);
      const g = new T.Group();
      k.mesh(g, new T.CylinderGeometry(0.28, 0.42, 5.4, 10), '#5e4432', [0, 2.7, 0]);
      k.mesh(g, new T.IcosahedronGeometry(2.4, 1), '#2f7f5e', [0, 6, 0]);
      const nest = k.mesh(g, new T.SphereGeometry(0.62, 14, 12), '#a57744', [0.62, 3.5, 0.2], null, [1, 1.3, 1]);
      g.position.copy(trunk);
      k.add(g);
      const center = nest.position.clone().add(trunk);
      const bee = new T.SphereGeometry(0.075, 8, 6);
      const bees = [];
      for (let i = 0; i < 14; i++) {
        const b = new T.Mesh(bee, k.mat(i % 3 ? '#e4b526' : '#2b2622'));
        k.add(b);
        bees.push(b);
      }
      out.mate = spec.mate ? k.hiker('wave', 1.6, 1.6) : null;
      const near = k.ground(6.5, -1).add(new T.Vector3(0, 1.7, 0));
      out.clues = { swarm: near.clone().add(new T.Vector3(0, 0.7, 0)), nest: center.clone().add(new T.Vector3(0.4, 0.9, 0)), mate: out.mate ? out.mate.position.clone().add(new T.Vector3(0, 2.4, 0)) : null };
      out.focus = center.clone().lerp(near, 0.5);
      const here = new T.Vector3();
      const heroAt = k.ground(-1, 0).add(new T.Vector3(0, 1.7, 0));
      return (s) => {
        const pull = s.mood === 'danger' ? Math.min(1, s.age / 1.5) : s.mood === 'calm' ? -0.5 : 0;
        bees.forEach((b, i) => {
          const a = (s.still ? i : s.t * (2 + (i % 4) * 0.6)) + i * 1.3;
          const r = 0.5 + (i % 5) * 0.32;
          here.copy(near).lerp(pull < 0 ? center : heroAt, Math.abs(pull));
          b.position.set(here.x + Math.cos(a) * r, here.y + Math.sin(a * 1.7) * 0.5, here.z + Math.sin(a) * r);
        });
        if (out.mate) k.poseHiker(out.mate, s.t);
      };
    },

    macaques(k, out) {
      const pack = [[6, 1.8, 1], [7.5, -1.2, 0.85], [5, -2.6, 0.72]].map(([z, u, scale]) => {
        const m = k.animal('macaque');
        m.position.copy(k.ground(z, u));
        m.scale.setScalar(scale);
        m.rotation.y = k.yaw(z) + Math.PI;
        k.add(m);
        return { m, z, u };
      });
      out.focus = k.ground(6, 0).add(new T.Vector3(0, 0.9, 0));
      return (s) => {
        pack.forEach((p) => {
          p.m.position.copy(k.ground(p.z, p.u));
          if (s.mood === 'calm') p.m.position.copy(k.ground(p.z + Math.min(1, s.age / 3) * 9, p.u * 2));
          else if (s.mood === 'danger') p.m.position.copy(k.ground(p.z - Math.min(1, s.age / 2) * 3, p.u * 0.6));
          if (!s.still) p.m.position.y += Math.abs(Math.sin(s.t * 2 + p.z)) * 0.08;
        });
      };
    },

    collapse(k, out) {
      const gap = k.ribbon({ z0: 6, z1: 12, u0: -5, u1: 18, color: '#5a4636', lift: 0.14 });
      k.add(gap);
      const track = k.ribbon({ z0: 3, z1: 15, u0: -7.8, u1: -5.4, color: '#a48c63', lift: 0.08 });
      k.add(track);
      const barrier = new T.Group();
      k.mesh(barrier, new T.BoxGeometry(3.6, 0.28, 0.08), '#e8a12c', [0, 1.15, 0]);
      k.mesh(barrier, new T.BoxGeometry(3.6, 0.16, 0.08), '#e8a12c', [0, 0.7, 0]);
      [-1.6, 1.6].forEach((x) => k.mesh(barrier, new T.BoxGeometry(0.12, 1.3, 0.12), '#6b4e38', [x, 0.65, 0]));
      barrier.position.copy(k.ground(4.2, 0));
      barrier.rotation.y = k.yaw(4.2);
      k.add(barrier);
      const sign = k.sign('步道封閉', '請勿通行', 3.9, -3.1);
      k.add(sign);
      const hill = hillside(k, { z0: 5, z1: 21, foot: 5, top: -12, height: 11, chute: [11, 15.5] });
      const slides = [0, 1, 2, 3, 4].map((i) => {
        const r = k.rock(0.28 + i * 0.06, '#71675a');
        k.add(r);
        return { r, phase: i / 5, z: 11.4 + i * 0.9 };
      });
      out.clues = { gap: k.ground(9, 3).add(new T.Vector3(0, 0.8, 0)), sign: sign.position.clone().add(new T.Vector3(0, 2.8, 0)), slide: hill.on(13, -7).add(new T.Vector3(0, 1.4, 0)) };
      out.focus = k.ground(10, 0).add(new T.Vector3(0, 1.2, 0));
      return (s) => {
        const speed = s.mood === 'danger' ? 0.55 : 0.22;
        slides.forEach((d) => {
          const u = s.still ? d.phase : (s.t * speed + d.phase) % 1;
          d.r.position.copy(hill.on(d.z, -11 + u * 17)).add(new T.Vector3(0, 0.35 + Math.abs(Math.sin(u * 12)) * 0.5, 0));
          d.r.rotation.x = u * 14;
        });
      };
    },

    mate(k, out) {
      out.mate = k.hiker('sit', 3.2, -1.1);
      out.mate.rotation.y += 0.7;
      const blanket = new T.Mesh(new T.SphereGeometry(0.72, 14, 10, 0, Math.PI * 2, 0, Math.PI / 1.7), k.mat('#f0a13a', { metalness: 0.5, roughness: 0.35 }));
      blanket.position.y = 0.42;
      blanket.scale.set(1, 1.15, 1);
      blanket.visible = false;
      out.mate.add(blanket);
      out.focus = out.mate.position.clone().add(new T.Vector3(0, 0.8, 0));
      return (s) => {
        blanket.visible = s.mood === 'calm';
        out.mate.rotation.x = s.mood === 'danger' ? -Math.min(0.5, s.age * 0.3) : 0;
        k.poseHiker(out.mate, s.t);
      };
    },

    ice(k, out) {
      const ice = k.ribbon({ z0: 3.2, z1: 13, u0: -5, u1: 5, color: '#d4edf6', lift: 0.13, roughness: 0.12 });
      k.add(ice);
      out.focus = k.ground(8, 0).add(new T.Vector3(0, 0.6, 0));
      return () => {};
    },

    gust(k, out) {
      const lines = [];
      const mat = new T.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.55 });
      for (let i = 0; i < 12; i++) {
        const line = new T.Mesh(new T.BoxGeometry(2.6, 0.04, 0.04), mat);
        k.add(line);
        lines.push({ line, z: 1 + (i % 6) * 2, h: 0.8 + (i % 4) * 0.7, phase: i / 12 });
      }
      out.focus = k.ground(8, 0).add(new T.Vector3(0, 1.8, 0));
      return (s) => {
        const yaw = k.yaw(6) + Math.PI / 2;
        lines.forEach((l) => {
          const u = s.still ? l.phase : (s.t * (s.mood === 'danger' ? 1.2 : 0.7) + l.phase) % 1;
          l.line.position.copy(k.ground(l.z, -14 + u * 28)).add(new T.Vector3(0, l.h, 0));
          l.line.rotation.y = yaw;
        });
      };
    },

    closure(k, out) {
      BUILD.collapse(k, {});
      out.focus = k.ground(6, 0).add(new T.Vector3(0, 1.3, 0));
      return () => {};
    },

    snake(k, out) {
      const parts = [0, 1, 2, 3, 4, 5, 6].map((i) => {
        const part = new T.Mesh(new T.SphereGeometry(0.11 - i * 0.008, 10, 8), k.mat('#5b6a3e'));
        k.add(part);
        return part;
      });
      out.focus = k.ground(3, 1.4).add(new T.Vector3(0, 0.5, 0));
      return (s) => {
        const away = s.mood === 'idle' ? 0 : Math.min(1, s.age / 2.2) * 7;
        parts.forEach((part, i) => {
          part.position.copy(k.ground(3.2 - i * 0.2 + away * 0.2, 1.5 + away + Math.sin(i * 1.1 + (s.still ? 0 : s.t * 5)) * 0.14)).add(new T.Vector3(0, 0.1, 0));
        });
      };
    },
  };

  DH.stage3d = {
    isSharedTexture: (texture) => texture === soft,
    ids: Object.keys(BY_ID),
    kindOf: (id) => (BY_ID[id] ? BY_ID[id].kind : null),
    askOf: (id) => ASK[id] || '',
    halts: (id) => !!BY_ID[id] && HALTS.has(BY_ID[id].kind),
    reaction(id, correct) {
      const spec = BY_ID[id];
      return spec ? REACT[spec.kind][correct ? 'calm' : 'danger'] : '';
    },

    /* kit 由 js/world3d.js 提供：把「事件前方 z、路中心橫移 u」換算成世界座標與造型工具 */
    build(ev, kit, biome) {
      const spec = BY_ID[ev.scenario.id];
      if (!spec) return null;
      const group = new T.Group();
      const out = { ev, group, kind: spec.kind, focus: null, clues: {}, mate: null, flash: 0, list: [], age: 0, gone: ev.done ? 1 : 0 };
      const k = kit;
      k.add = (o) => group.add(o);
      k.places = biome.places || {};
      out.step = BUILD[spec.kind](k, out, spec);
      const clues = spec.clues ? spec.clues(biome) : [];
      out.list = clues.filter((c) => out.clues[c.at]).map((c) => Object.assign({}, c, { pos: out.clues[c.at] }));
      out.title = spec.kind === 'rockfall' && k.places.scree ? k.places.scree : ev.scenario.title;
      return out;
    },

    update(stage, s) {
      const mood = stage.ev.done ? (stage.ev.correct ? 'calm' : 'danger') : 'idle';
      if (mood !== stage.mood) {
        stage.mood = mood;
        stage.age = 0;
      }
      stage.age = s.still ? 10 : stage.age + s.dt;
      stage.flash = 0;
      /* 答完離開卡片後，現場沉進地面收掉，路要走得過去 */
      if (stage.ev.done && !s.inCard) stage.gone = s.still ? 1 : Math.min(1, stage.gone + s.dt * 1.3);
      stage.group.position.y = -stage.gone * 7;
      stage.group.visible = stage.gone < 1 && Math.abs(stage.ev.x - s.heroX) < VIEW_RANGE;
      if (stage.group.visible) stage.step(Object.assign({}, s, { mood, age: stage.age, gone: stage.gone }));
    },
  };
})();
