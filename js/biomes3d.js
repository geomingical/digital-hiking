/* 每座山在 3D 裡長什麼樣子。只放資料，場景怎麼用它們在 js/world3d.js。
   這些是依 data/mountains.json 的地形描述做的示意造景，不是實際地形。 */
(function () {
  const DH = (window.DH = window.DH || {});

  const cone = (tint, p, band, s) => ({ type: 'cone', tint, p, band, s });
  const round = (tint, p, band, s) => ({ type: 'round', tint, p, band, s });

  const DEFAULT = {
    rise: 1,
    relief: { fall: 1, wall: 0, rough: 1 },
    ground: { open: '#7db268', forest: '#4f9a58', ridge: '#b5bd5e', summit: '#a9a491', dusk: '#7a9457' },
    path: { dirt: '#dcc18f', edge: '#b49a68' },
    snowFrom: 99,
    sea: 220,
    range: { tints: ['#6b8fa3', '#7a9aa5', '#5f8a86'], height: [80, 190], snow: 0.82, spires: 0 },
    flora: {
      open: {
        grass: ['#5fa758', 0.5, 0.95, 1], flower: 0.55,
        trees: [round('#6eb76f', 0.5, 'far', [0.9, 1.5]), cone('#4f9d78', 0.28, 'far', [0.8, 1.2])],
        bush: ['#6fb46a', 0.4],
      },
      forest: {
        grass: ['#3f8f58', 1, 1.6, 0.7], bush: ['#3f8f58', 0.3], flower: 0.12,
        trees: [cone('#2f7f5e', 1, 'near', [0.85, 1.5]), cone('#37886a', 1, 'far', [1, 1.7])],
        rock: ['#7f9483', 0.3, 0.4, 0.8],
      },
      ridge: {
        grass: ['#c7c26a', 0.9, 1.5, 1], flower: 0.12,
        trees: [cone('#4a8b70', 0.14, 'far', [0.6, 0.95])],
        rock: ['#a6a292', 0.35, 0.4, 0.9],
      },
      summit: { flower: 0.12, smallRock: ['#a39f92', 0.65], rock: ['#918e83', 0.4, 0.8, 1.7] },
      dusk: {
        grass: ['#5fa758', 0.5, 0.95, 1], flower: 0.3,
        trees: [cone('#4d7d5e', 0.6, 'far', [0.8, 1.3]), round('#7f9a55', 0.5, 'near', [0.9, 1.3])],
      },
    },
  };

  const flora = (over) => {
    const out = {};
    Object.keys(DEFAULT.flora).forEach((k) => {
      out[k] = Object.assign({}, DEFAULT.flora[k], over[k] || {});
    });
    return out;
  };

  const BIOMES = {
    /* 七星山：矮胖的火山圓頂、滿坡芒草、噴氣孔、石階路 */
    qixing: {
      places: { gate: '小油坑' },
      rise: 0.42,
      relief: { fall: 0.3, wall: 0, rough: 0.8 },
      ground: { open: '#a4ab62', forest: '#8fa35c', ridge: '#c6bb73', summit: '#bcb37c', dusk: '#a49b63' },
      path: { dirt: '#b7b3a4', edge: '#8f8b7c' },
      sea: 30,
      steam: [900, 1500, 2600, 3800],
      range: { tints: ['#6f9a8f', '#7fa89a', '#88a9a0'], height: [40, 90], snow: 2, spires: 0 },
      flora: flora({
        open: { grass: ['#c9c183', 0.8, 1.3, 1], plume: 0.8, flower: 0.12, trees: [round('#6f9a55', 0.22, 'far', [0.8, 1.2])], bush: ['#7fa35c', 0.3] },
        forest: { grass: ['#c9c183', 0.9, 1.4, 1], plume: 0.9, flower: 0.08, trees: [round('#5f8f55', 0.3, 'far', [0.9, 1.3])], bush: ['#7fa35c', 0.25], rock: ['#8e8a76', 0.2, 0.4, 0.8] },
        ridge: { grass: ['#d8cd8a', 1, 1.6, 1], plume: 1, flower: 0.04, trees: [], rock: ['#8e8a76', 0.2, 0.4, 0.8] },
        summit: { grass: ['#d8cd8a', 0.8, 1.2, 1], plume: 0.7, flower: 0.04, smallRock: ['#8e8a76', 0.3], rock: ['#8e8a76', 0.15, 0.6, 1.1] },
        dusk: { grass: ['#c9c183', 0.8, 1.3, 1], plume: 0.8, flower: 0.06, trees: [round('#6f9a55', 0.2, 'far', [0.8, 1.2])] },
      }),
    },
    /* 合歡山：開闊的高山草坡、低矮箭竹，幾乎沒有樹 */
    hehuan: {
      places: { gate: '合歡主峰' },
      rise: 0.7,
      relief: { fall: 0.55, wall: 0, rough: 0.7 },
      ground: { open: '#7ea765', forest: '#6c9e5f', ridge: '#8fb06a', summit: '#9fb477', dusk: '#83a064' },
      path: { dirt: '#d9d0b6', edge: '#aaa288' },
      snowFrom: 2,
      sea: 140,
      range: { tints: ['#7096b4', '#83a7c1', '#6d93a9'], height: [90, 170], snow: 0.86, spires: 0 },
      flora: flora({
        open: { grass: ['#6c9e5f', 0.5, 0.8, 1], bamboo: 1, flower: 0.2, trees: [cone('#4a8064', 0.12, 'far', [0.6, 0.9])], bush: null },
        forest: { grass: ['#6c9e5f', 0.5, 0.8, 1], bamboo: 1, flower: 0.15, trees: [cone('#3f7a5f', 0.3, 'far', [0.7, 1])], bush: null, rock: null },
        ridge: { grass: ['#86a966', 0.4, 0.7, 0.6], bamboo: 1, flower: 0.12, trees: [], rock: ['#a7a595', 0.12, 0.4, 0.7] },
        summit: { grass: ['#86a966', 0.4, 0.7, 0.6], bamboo: 0.8, flower: 0.08, smallRock: ['#a7a595', 0.2], rock: ['#a7a595', 0.1, 0.5, 0.9] },
        dusk: { grass: ['#6c9e5f', 0.5, 0.8, 1], bamboo: 1, flower: 0.15, trees: [cone('#4a8064', 0.12, 'far', [0.6, 0.9])] },
      }),
    },
    /* 加里山：一路都在茂密的森林裡，有溪流與蕨類 */
    jiali: {
      places: { gate: '鹿場' },
      rise: 0.55,
      relief: { fall: 0.1, wall: 0, rough: 1.2 },
      ground: { open: '#548d52', forest: '#3f7f4c', ridge: '#4b8a50', summit: '#6f8f5a', dusk: '#4f8450' },
      path: { dirt: '#b08f63', edge: '#82664a' },
      sea: 0,
      streams: [1500, 2500],
      range: { tints: ['#4f7f6c', '#5c8c76', '#467463'], height: [70, 130], snow: 2, spires: 0 },
      flora: flora({
        open: { grass: ['#3f8f58', 0.8, 1.3, 0.7], fern: 0.6, flower: 0.1, trees: [cone('#2f7f5e', 0.9, 'near', [0.9, 1.5]), round('#4f9d58', 0.9, 'far', [1, 1.6])], bush: ['#3f8f58', 0.4] },
        forest: { grass: ['#2f7f4f', 0.8, 1.3, 0.6], fern: 0.8, flower: 0.06, trees: [round('#3f8f50', 1, 'near', [1.1, 1.8]), cone('#2a7558', 1, 'far', [1.1, 1.8])], bush: ['#357f4d', 0.4], rock: ['#6f8a7a', 0.35, 0.4, 0.9] },
        ridge: { grass: ['#3f8f58', 0.8, 1.3, 0.6], fern: 0.7, flower: 0.06, trees: [cone('#2f7f5e', 1, 'near', [0.9, 1.5]), round('#4a9558', 1, 'far', [1, 1.6])], bush: ['#357f4d', 0.3], rock: ['#6f8a7a', 0.3, 0.4, 0.9] },
        summit: { grass: ['#4f9758', 0.7, 1.1, 0.7], fern: 0.4, flower: 0.08, smallRock: ['#7f8a7a', 0.2], trees: [cone('#2f7f5e', 0.8, 'far', [0.9, 1.4])], rock: ['#7f8a7a', 0.2, 0.5, 1] },
        dusk: { grass: ['#3f8f58', 0.8, 1.3, 0.7], fern: 0.6, flower: 0.08, trees: [round('#4a8f50', 1, 'near', [1, 1.6]), cone('#2f7558', 1, 'far', [1, 1.6])] },
      }),
    },
    /* 玉山：森林之上是碎石坡與風口，山頂是裸岩，最後一段有鐵鍊 */
    yushan: {
      places: { gate: '塔塔加', hut: '排雲山莊', scree: '玉山主峰碎石坡' },
      rise: 1,
      relief: { fall: 1.1, wall: 0, rough: 1.3 },
      ground: { open: '#6f9b63', forest: '#4a8b5a', ridge: '#98998a', summit: '#85837a', dusk: '#7a8e62' },
      path: { dirt: '#cdbd9f', edge: '#9a8c74' },
      snowFrom: 11,
      sea: 260,
      chains: [4700, 5280],
      range: { tints: ['#66788f', '#74869a', '#5d6f82'], height: [110, 220], snow: 0.76, spires: 10 },
      flora: flora({
        open: { trees: [cone('#3f7f64', 0.8, 'far', [0.9, 1.5]), cone('#4a8f70', 0.3, 'near', [0.8, 1.2])], flower: 0.2, bush: ['#5f9a64', 0.3] },
        ridge: { grass: ['#a3a36a', 0.6, 1, 0.5], flower: 0.03, smallRock: ['#8d8b80', 0.55], trees: [round('#587f60', 0.14, 'far', [0.45, 0.7])], rock: ['#85837a', 0.6, 0.6, 1.5] },
        summit: { flower: 0, smallRock: ['#77756d', 0.85], rock: ['#6f6d66', 0.65, 0.9, 2.1] },
        dusk: { grass: ['#8c9960', 0.6, 1, 0.8], flower: 0.08, trees: [cone('#3f6f58', 0.5, 'far', [0.8, 1.3])], smallRock: ['#8d8b80', 0.3] },
      }),
    },
    /* 雪山：幽暗的黑森林，再走進岩壁環抱的圈谷 */
    xueshan: {
      places: { gate: '武陵', hut: '三六九山莊' },
      rise: 0.95,
      relief: { fall: 0.15, wall: 1, rough: 1.1 },
      ground: { open: '#67935f', forest: '#2f6650', ridge: '#a4a593', summit: '#b5b4a8', dusk: '#5f8660' },
      path: { dirt: '#c7b596', edge: '#94856e' },
      snowFrom: 8,
      sea: 40,
      range: { tints: ['#6e7f92', '#7f8fa0', '#65778a'], height: [110, 200], snow: 0.7, spires: 4 },
      flora: flora({
        open: { trees: [cone('#2f6a55', 0.8, 'far', [1, 1.6])], flower: 0.25, bush: ['#5f9a64', 0.3] },
        forest: { grass: ['#2c6a4c', 0.7, 1.2, 0.5], fern: 0.3, flower: 0.02, trees: [cone('#173f36', 1, 'near', [1.3, 2]), cone('#143a32', 1, 'far', [1.4, 2.2])], bush: null, rock: ['#54655c', 0.2, 0.4, 0.8] },
        ridge: { grass: ['#a3a36a', 0.5, 0.9, 0.5], flower: 0.08, smallRock: ['#a5a498', 0.5], trees: [cone('#2f5f50', 0.08, 'far', [0.5, 0.8])], rock: ['#979689', 0.5, 0.6, 1.5] },
        summit: { flower: 0.02, smallRock: ['#9f9e92', 0.7], rock: ['#8f8e83', 0.55, 0.8, 1.9] },
        dusk: { trees: [cone('#1f4f42', 0.8, 'far', [1.1, 1.7])], flower: 0.06, grass: ['#3f7a56', 0.6, 1, 0.8] },
      }),
    },
    /* 南湖大山：又長又遠的稜線、箭竹與岩峰，山形厚實 */
    nanhu: {
      places: { gate: '南湖登山口', hut: '雲稜山莊' },
      rise: 0.95,
      relief: { fall: 0.7, wall: 0.3, rough: 1.2 },
      ground: { open: '#71995f', forest: '#467f58', ridge: '#8fa268', summit: '#a5a38e', dusk: '#7d9460' },
      path: { dirt: '#d3c5a6', edge: '#a0937a' },
      snowFrom: 9,
      sea: 200,
      range: { tints: ['#5e7c95', '#6f8ca3', '#577288'], height: [120, 230], snow: 0.74, spires: 14 },
      flora: flora({
        open: { trees: [cone('#3a7a60', 0.7, 'far', [1, 1.6]), round('#5f9a60', 0.25, 'near', [0.8, 1.2])], flower: 0.2, bush: ['#5f9a64', 0.3] },
        ridge: { grass: ['#8aa864', 0.5, 0.8, 0.7], bamboo: 0.9, flower: 0.08, trees: [cone('#3f7a60', 0.06, 'far', [0.5, 0.8])], rock: ['#8f8d80', 0.5, 0.7, 1.7], smallRock: ['#9a988a', 0.25] },
        summit: { bamboo: 0.3, flower: 0.03, smallRock: ['#8a887c', 0.7], rock: ['#7f7d72', 0.55, 0.9, 2] },
        dusk: { grass: ['#7f9c60', 0.5, 0.9, 0.8], bamboo: 0.6, flower: 0.08, trees: [cone('#3f6f58', 0.4, 'far', [0.8, 1.3])] },
      }),
    },
  };

  /* 季節：snow 是雪線以上積多少雪；gold 是草地轉黃的程度 */
  const SEASONS = {
    spring: { flower: 1.6, gold: 0, snow: 0, sky: null },
    summer: { flower: 1, gold: 0, snow: 0, sky: { top: '#4f9fe6', low: '#dff1f2', k: 0.35 } },
    autumn: { flower: 0.5, gold: 0.34, snow: 0, sky: { top: '#6aa6d8', low: '#f7e3c4', k: 0.55 } },
    winter: { flower: 0.08, gold: 0.28, snow: 1, sky: { top: '#86aacb', low: '#e7edf2', k: 0.7 } },
  };

  DH.biomes = {
    resolve(id, seasonId) {
      const b = Object.assign({}, DEFAULT, BIOMES[id] || {});
      return { id: BIOMES[id] ? id : 'default', season: SEASONS[seasonId] ? seasonId : 'summer', biome: b, seasonFx: SEASONS[seasonId] || SEASONS.summer };
    },
    ids: Object.keys(BIOMES),
  };
})();
