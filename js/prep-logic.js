/* 出發前準備的純邏輯：天氣抽樣、裝備旗標、行前風險、選題、題目修飾與敘事變體。不碰畫面。
   所有點數、機率與門檻都是遊戲設計值，不是官方標準或事故率。 */
(function () {
  const DH = (window.DH = window.DH || {});
  const { makeRng, byFreshness, STAGE_KEYS, hash32, KEY_POOLS, reserveKeyScenarios, logKeyShortage } = DH.core;

  const SEASONS = [
    { key: 'spring', name: '春季', months: '3–5 月' },
    { key: 'summer', name: '夏季', months: '6–8 月' },
    { key: 'autumn', name: '秋季', months: '9–11 月' },
    { key: 'winter', name: '冬季', months: '12–2 月' },
  ];
  const seasonName = (key) => (SEASONS.find((s) => s.key === key) || {}).name || '';
  const GROUP_NAMES = { clothing: '衣著', feet: '腳部', navigation: '導航照明', supply: '補給', emergency: '緊急備援' };
  const GROUP_KEYS = Object.keys(GROUP_NAMES);
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  /* 新增 8 題的出題條件（路徑語法同 gear.json 的行前規則） */
  const eq = (path, value) => ({ path, op: 'eq', value });
  const TRIGGERS = {
    'prep-postpone': eq('weather.official_closed', true),
    'prep-rainpants': eq('weather.rain', true),
    'prep-down-dry': { all: [eq('weather.rain', true), eq('gear.down_layer', true)] },
    'prep-ice-turn': eq('weather.ice', true),
    'prep-water-plan': eq('route.overnight', true),
    'prep-thunder-stop': eq('weather.thunder', true),
    'prep-sat-sky': eq('gear.has_satellite', true),
    'prep-overpack': { path: 'state.pack_weight_g', op: 'gte', value: 8000 },
  };
  /* 既有題目的天氣、地形限制 */
  const ONLY_IF = {
    'thunder-ridge': eq('weather.thunder', true),
    'afternoon-thunder': eq('weather.thunder', true),
    'fog-junction': eq('weather.fog', true),
    'ridge-gust': eq('weather.strong_wind', true),
    'falling-rock': eq('route.rocky', true),
    /* 「往上回主徑」的前提是沒有雷雨，雷雨日不能出在裸稜上 */
    'key-lost-up-or-down': eq('weather.thunder', false),
  };
  const isPrepId = (id) => Object.prototype.hasOwnProperty.call(TRIGGERS, id);

  /* 條件 AST：只有 all、any、path/op/value。路徑不存在是資料設定錯誤，直接丟錯，不默默當 false。 */
  function evalCond(node, ctx) {
    if (node.all) return node.all.every((n) => evalCond(n, ctx));
    if (node.any) return node.any.some((n) => evalCond(n, ctx));
    const [head, key] = node.path.split('.');
    if (!ctx[head] || !(key in ctx[head])) throw new Error(`條件路徑不存在：${node.path}`);
    const v = ctx[head][key];
    if (node.op === 'eq') return v === node.value;
    if (node.op === 'gte') return v >= node.value;
    throw new Error(`不支援的條件運算：${node.op}`);
  }

  /* 天氣 ------------------------------------------------------------ */
  function pickSeason(seed, mountainId, tripIndex, nonce) {
    const rng = makeRng(hash32(seed, mountainId, tripIndex, nonce, 'season'));
    return rng.pick(SEASONS).key;
  }

  function generateForecast(mountain, season, seed, tripIndex, nonce) {
    const rng = makeRng(hash32(seed, mountain.id, season, tripIndex, nonce, 'forecast'));
    const uni = (lo, hi) => rng.range(lo, hi);
    const p = mountain.forecast[season];
    const [tLo, tHi] = p.trailhead_temp_c;
    const low = uni(tLo, tHi - 4);
    const high = Math.min(tHi, low + uni(4, 8));
    const lapse = (mountain.summit_m - mountain.trailhead_m) * 0.006;
    /* 山頂抖動不超過高差降溫的一半：低矮的山也不會抽出山頂比登山口熱 */
    const jitter = Math.min(uni(-2, 2), lapse * 0.5);
    const hazards = {};
    ['thunder', 'front', 'typhoon', 'fog', 'ice', 'gust'].forEach((k) => {
      hazards[k] = rng.next() < p.hazard_probability[k];
    });
    let rain = Math.round(uni(p.rain_probability_pct[0], p.rain_probability_pct[1]) / 5) * 5;
    if (hazards.front || hazards.thunder) rain = Math.max(rain, 70);
    if (hazards.typhoon) rain = Math.max(rain, 80);
    const wind = clamp(uni(p.wind_ms[0], p.wind_ms[1]), 0, 30);
    let gust = wind + (hazards.gust ? uni(4, 8) : 0);
    if (hazards.typhoon) gust = Math.max(gust, 18);
    const temp = (v) => clamp(v, -25, 38);
    const summit = [temp(low - lapse + jitter), temp(high - lapse + jitter)];
    return {
      season,
      trailhead_temp_c: [temp(low), temp(high)],
      summit_temp_c: summit,
      rain_probability_pct: rain,
      wind_ms: wind,
      gust_ms: clamp(gust, 0, 30),
      hazards,
      ice: hazards.ice && summit[0] <= 2 && (hazards.front || hazards.fog || season === 'winter'),
    };
  }

  /* 實況只抽一次，出發前不顯示；與預報有合理誤差。
     預報沒報結冰、實況卻降到冰點且有雨霧時，才會出現「沿途未預期結冰」。 */
  function generateActual(mountain, forecast, seed, tripIndex, nonce) {
    const rng = makeRng(hash32(seed, mountain.id, forecast.season, tripIndex, nonce, 'actual'));
    const err = rng.range(-3, 3);
    const temp = (v) => clamp(v + err, -25, 38);
    const thunder = forecast.hazards.thunder;
    const rain = rng.next() < forecast.rain_probability_pct / 100 || thunder;
    const fog = forecast.hazards.fog;
    const gust = clamp(forecast.gust_ms + rng.range(-2, 2), 0, 30);
    const summit = forecast.summit_temp_c.map(temp);
    return {
      trailhead_temp_c: forecast.trailhead_temp_c.map(temp),
      summit_temp_c: summit,
      rain,
      thunder,
      fog,
      ice: forecast.ice || (forecast.hazards.ice && summit[0] <= 2 && (rain || fog)),
      gust_ms: gust,
      strong_wind: gust >= 10 || forecast.hazards.gust,
    };
  }

  function briefFlags(mountain, f) {
    const wet = f.rain_probability_pct >= 40 || f.hazards.front || f.hazards.thunder || f.hazards.typhoon;
    const summitLow = f.summit_temp_c[0];
    const route = mountain.route_flags;
    return {
      rain: wet,
      wet,
      cold: summitLow <= 10 || (wet && summitLow <= 15),
      hot: f.trailhead_temp_c[1] >= 25,
      strong_wind: f.gust_ms >= 10,
      thunder: f.hazards.thunder,
      front: f.hazards.front,
      typhoon: f.hazards.typhoon,
      fog: f.hazards.fog,
      ice: f.ice,
      uv_high: route.high_altitude || (route.open_slope && (f.season === 'spring' || f.season === 'summer')),
      official_closed: false,
    };
  }

  /* 各段高度比例：0 是登山口，1 是山頂 */
  const STAGE_LEVEL = { trailhead: 0, forest: 0.3, ridge: 0.75, summit: 1, descent: 0.45 };

  function stageTemp(actual, stage) {
    const k = STAGE_LEVEL[stage];
    return [0, 1].map((i) => actual.trailhead_temp_c[i] + (actual.summit_temp_c[i] - actual.trailhead_temp_c[i]) * k);
  }

  /* 某一段實際走到時的天氣旗標；行前分數不會回頭改 */
  function actualFlags(actual, stage) {
    const [low] = stageTemp(actual, stage);
    const wet = actual.rain;
    return {
      rain: wet,
      wet,
      cold: low <= 10 || (wet && low <= 15),
      thunder: actual.thunder && (stage === 'ridge' || stage === 'summit'),
      fog: actual.fog,
      ice: actual.ice,
      strong_wind: actual.strong_wind,
      official_closed: false,
    };
  }

  /* 整趟出題用：雷雨只在稜線、山頂成真，其他欄位全程相同 */
  function tripWeather(actual) {
    return Object.assign(actualFlags(actual, 'summit'), { thunder: actual.thunder });
  }

  /* 建議延期的原因；回傳空陣列表示可以繼續 */
  function postponeReasons(f) {
    const out = [];
    if (f.hazards.typhoon) out.push({ id: 'typhoon', text: '預報提到颱風外圍影響，風雨與路況都難預期。' });
    if (f.gust_ms >= 18) out.push({ id: 'gust', text: `預報陣風約 ${Math.round(f.gust_ms)} m/s，稜線可能站不穩。這是本遊戲保守的停走設定，不是實際上山的安全界線。` });
    if (f.ice) out.push({ id: 'ice', text: '預期步道結冰，而角色沒有雪地訓練。登山鞋與登山杖不能取代雪地裝備與訓練。' });
    return out;
  }

  function windLabel(ms) {
    if (ms < 3) return '風較弱';
    if (ms < 8) return '風較明顯';
    if (ms < 14) return '強風情境';
    return '很強，調整行程';
  }

  function formatDays(days) {
    const [a, b] = days;
    return a === b ? `${a} 天` : `${a}–${b} 天`;
  }

  /* 裝備選擇 ---------------------------------------------------------- */
  /* null 代表玩家還沒決定；連「不穿」都要自己選過才算 */
  function emptySelection() {
    return { hat: null, base: null, mid: null, shell: null, pants: null, shoes: null, gloves: null, socks: null, water: null, pack: [] };
  }

  /* 資料驗證與測試用的一份完整配裝，不會出現在玩家面前 */
  function sampleSelection() {
    return {
      hat: 'no_hat', base: 'wicking', mid: 'no_mid', shell: 'no_shell', pants: 'quick_pants',
      shoes: 'boots', gloves: 'no_gloves', socks: 'hiking_socks', water: 'water_1', pack: [],
    };
  }

  /* 依 gear.json 的順序列出還沒決定的欄位 */
  function undecidedSlots(sel, gear) {
    return gear.slots.filter((s) => s.id !== 'pack' && !sel[s.id]);
  }

  function makeItemIndex(gear) {
    const byId = {};
    gear.items.forEach((it) => { byId[it.id] = it; });
    return byId;
  }

  function selectedIds(sel) {
    const out = sel.pack.slice();
    Object.keys(sel).forEach((k) => { if (k !== 'pack' && sel[k]) out.push(sel[k]); });
    return out;
  }

  function packWeight(sel, index) {
    return selectedIds(sel).reduce((sum, id) => sum + (index[id].weight_g || 0), 0);
  }

  function waterTarget(mountain, brief) {
    return Math.min(3, mountain.water_carry_l[0] + (brief.hot ? 1 : 0));
  }

  /* 旗標永遠由選擇推導，不另存一份可能矛盾的真相 */
  function gearFlags(sel, index, mountain, brief) {
    const fx = {};
    selectedIds(sel).forEach((id) => Object.assign(fx, index[id].effects));
    const yes = (k) => fx[k] === true;
    const hasRainKit = yes('has_rain_kit');
    const waterL = fx.water_l;
    const target = waterTarget(mountain, brief);
    return {
      has_headlamp: yes('has_headlamp'),
      has_first_aid: yes('has_first_aid'),
      has_emergency_blanket: yes('has_emergency_blanket'),
      has_power_bank: yes('has_power_bank'),
      has_trekking_poles: yes('has_trekking_poles'),
      has_whistle: yes('has_whistle'),
      has_satellite: yes('has_satellite'),
      has_food: yes('has_food'),
      has_dry_clothes: yes('has_dry_clothes'),
      has_shelter: yes('has_shelter'),
      has_overnight_kit: yes('has_overnight_kit'),
      has_water_treatment: yes('has_water_treatment'),
      has_gps_offline: yes('has_gps_offline'),
      has_paper_navigation: yes('has_paper_navigation'),
      has_navigation: yes('has_gps_offline') || yes('has_paper_navigation'),
      has_rain_shell: yes('rain_shell') || hasRainKit,
      has_rain_pants: hasRainKit,
      has_wind_shell: yes('wind_shell') || hasRainKit,
      light_rain_only: yes('light_rain_cover') && !yes('rain_shell') && !hasRainKit,
      has_insulation: yes('insulation') || yes('packed_insulation'),
      has_warm_hat: yes('warm_hat') || yes('packed_warm_hat'),
      has_warm_gloves: yes('warm_gloves') || yes('packed_warm_gloves'),
      has_sun_protection: yes('has_sun_kit'),
      proper_shoes: yes('proper_shoes'),
      trainers: yes('trainers'),
      sandals: yes('sandals'),
      cotton_base: yes('cotton_base'),
      jeans: yes('jeans'),
      shorts: yes('shorts'),
      cotton_socks: yes('cotton_socks'),
      no_socks: sel.socks === 'no_socks',
      down_layer: yes('down_layer'),
      insurance_checked: yes('insurance_checked'),
      water_l: waterL,
      water_level: waterL,
      water_target_l: target,
      water_low: waterL < target,
    };
  }

  /* 走到某一段時，身上的裝備遇到當下天氣的結果。只影響畫面與旁白，不改風險點數。 */
  const BODY_RULES = [
    { id: 'soaked_cotton', when: (g, h) => h.rain && !g.has_rain_shell && g.cotton_base, soaked: true, tone: 'warn', text: '雨落下來了。棉T吸飽水貼在身上，風一吹就冷。' },
    { id: 'soaked', when: (g, h) => h.rain && !g.has_rain_shell && !g.light_rain_only, soaked: true, tone: 'warn', text: '雨落下來了。身上沒有雨具，衣服開始濕透。' },
    { id: 'poncho', when: (g, h) => h.rain && g.light_rain_only, soaked: true, tone: 'warn', text: '雨變大了。輕便雨衣被風掀開，袖子和褲腳都濕了。' },
    { id: 'dry', when: (g, h) => h.rain && g.has_rain_shell, tone: 'good', text: '雨落下來了。你穿上雨具，身體還是乾的。' },
    { id: 'chilled', when: (g, h) => h.cold && !g.has_insulation, chilled: true, tone: 'warn', text: '越走越冷。身上和背包都沒有保暖層，只能靠走路撐著。' },
    { id: 'warm', when: (g, h) => h.cold && g.has_insulation, tone: 'good', text: '氣溫掉下來了。你加上保暖層，手腳還靈活。' },
    { id: 'slippery', when: (g, h) => h.wet && g.sandals, tone: 'warn', text: '濕滑的路上，拖鞋幾乎抓不住地，每一步都要小心。' },
  ];

  function bodyEffects(gear, here) {
    const hits = BODY_RULES.filter((r) => r.when(gear, here));
    return {
      soaked: hits.some((r) => r.soaked),
      chilled: hits.some((r) => r.chilled),
      /* 同一種天氣只留最具體的一句：表的順序就是優先序 */
      notes: hits.filter((r, i) => !(r.id === 'soaked' && hits[i - 1] && hits[i - 1].id === 'soaked_cotton')),
    };
  }

  /* 依山與預報給一份讓所有評分功能都齊備的清單 */
  function recommendedSelection(mountain, brief) {
    const route = mountain.route_flags;
    const pack = ['headlamp', 'offline_map', 'paper_map', 'first_aid', 'blanket', 'power_bank', 'snacks', 'sun_kit',
      'whistle', 'rain_kit', 'dry_clothes', 'shelter', 'repair_kit'];
    if (route.rough) pack.push('poles');
    if (route.overnight) pack.push('overnight_kit', 'water_treatment');
    if (!brief.cold) pack.push('spare_insulation');
    const target = waterTarget(mountain, brief);
    return {
      hat: brief.cold ? 'beanie' : 'sun_hat',
      base: 'wicking',
      mid: brief.cold ? 'fleece' : 'no_mid',
      shell: brief.wet || brief.cold ? 'rain_shell' : brief.strong_wind ? 'windbreaker' : 'no_shell',
      pants: 'quick_pants',
      shoes: 'boots',
      gloves: brief.cold ? 'warm_gloves' : 'no_gloves',
      socks: 'hiking_socks',
      water: `water_${target}`,
      pack,
    };
  }

  /* 行前風險 ---------------------------------------------------------- */
  const PASS_TEXT = {
    cotton_wet: (c) => (c.gear.cotton_base ? '棉衣這趟預報不濕冷，仍要留意流汗後受寒。' : '內層排汗快乾，濕冷時比較好管理。'),
    no_warmth: (c) => (c.gear.has_insulation ? '保暖層已備：穿著或收在包內都算。' : '預報不算冷，仍建議收一件保暖層以防延誤。'),
    no_rain: (c) => (c.gear.has_rain_shell ? '可靠雨具已備：雨來得早就先穿。' : '本趟預報降雨機率較低，背包仍建議留雨具備援。'),
    no_wind: (c) => (c.gear.has_wind_shell ? '有防風層：裸露稜線較不易被風帶走體溫。' : '預報陣風不大，仍要隨實況調整。'),
    jeans_wet: (c) => (c.gear.jeans ? '牛仔褲這趟預報不濕冷，抬腿仍較受限。' : '褲子濕後不會太厚重。'),
    shorts_cold: (c) => (c.gear.shorts ? '短褲適合這趟暖乾的開闊路段，草叢仍要留意。' : '長褲對濕冷與草叢較有保護。'),
    cold_extremities: (c) => (c.weather.cold ? '頭手的保暖備援都拿得到。' : '預報不算冷，頭手保暖可依實況增減。'),
    sandals: () => '鞋子有固定與護趾。',
    trainers_rough: (c) => (c.gear.trainers ? '運動鞋在這趟簡單乾燥路段可用，鞋底要完好。' : '登山鞋已試穿合腳才可靠，濕滑時仍會滑。'),
    socks_wet: () => '襪子合用，濕了記得更換。',
    missing_light: () => '頭燈已備：延誤時可空出雙手。',
    missing_nav: () => '離線導航已備：記得先學會操作。',
    missing_power: (c) => (c.gear.has_gps_offline ? '手機導航有電力備援。' : '這趟不靠手機導航，手機電力留給聯絡。'),
    water_low: (c) => `攜水 ${c.gear.water_l} 公升，達本趟起點建議；仍要依流汗與水源調整。`,
    food_missing: () => '行動糧已備，也留了延誤備糧。',
    sun_missing: (c) => (c.gear.has_sun_protection ? '防曬乳與眼睛防護已備。' : '這趟曝曬較少，仍可依實況防曬。'),
    missing_firstaid: () => '急救包已備：也要會用。',
    missing_blanket: () => '緊急毯已備：它減少散熱，不會自己產熱。',
    missing_dry: (c) => (c.gear.has_dry_clothes ? '乾衣已分袋防水。' : '預報較乾，出汗多時仍建議帶替換衣物。'),
    missing_shelter: () => '遮蔽與隔地已備：待援時避開溪床與落石區。',
  };

  function assessPreparation(gear, ctx) {
    const raw = {};
    GROUP_KEYS.forEach((k) => { raw[k] = 0; });
    const findings = gear.preparation_rules.map((rule) => {
      const hit = evalCond(rule.when, ctx);
      if (hit) raw[rule.group] += rule.points;
      return {
        id: rule.id,
        group: rule.group,
        points: hit ? rule.points : 0,
        hit,
        text: hit ? rule.teach : PASS_TEXT[rule.id](ctx),
        items: rule.related_items || [],
      };
    });
    const groups = {};
    GROUP_KEYS.forEach((k) => {
      const cap = gear.group_caps[k];
      groups[k] = { name: GROUP_NAMES[k], raw: raw[k], score: Math.min(raw[k], cap), cap, capped: raw[k] > cap };
    });
    const sum = GROUP_KEYS.reduce((s, k) => s + groups[k].score, 0);
    return { risk: Math.min(gear.preparation_risk_cap, sum), cap: gear.preparation_risk_cap, groups, findings };
  }

  /* 十大必備：列出已備／部分／未備，缺用火與修補只提醒、不計分 */
  function essentialStatus(gear, sel, flags) {
    const on = new Set(selectedIds(sel));
    const NOTE = {
      導航: '學會使用，建議電子與紙本互備。', 防曬: '遮陽帽單獨不算完整防曬。', 保暖: '可穿在身上，也可防水收在包內。',
      照明: '短程也可能延誤。', 急救: '個人藥品另確認。', 用火工具: '須守禁火規定。',
      修補工具: '不能保證壞鞋可繼續走。', 額外食物: '不只估到登頂。', 水: '清澈不代表可生飲。',
      緊急遮蔽: '緊急毯不能取代所有遮蔽與保暖。',
    };
    return Object.keys(gear.essential_functions).map((name) => {
      const ids = gear.essential_functions[name];
      const n = ids.filter((id) => on.has(id)).length;
      let status = n ? 'done' : 'none';
      if (name === '防曬') status = on.has('sun_kit') ? 'done' : n ? 'part' : 'none';
      else if (name === '保暖') status = flags.has_insulation && flags.has_dry_clothes ? 'done' : n ? 'part' : 'none';
      else if (name === '水') status = flags.water_low ? 'part' : 'done';
      else if (name === '緊急遮蔽') status = n === ids.length ? 'done' : n ? 'part' : 'none';
      return { name, status, note: NOTE[name] || '' };
    });
  }

  /* 選題 ------------------------------------------------------------ */
  const list = (s) => s.split(' ');
  const ROUTE_EXCLUDE = [
    { routes: list('qixing jiali'), ids: list('altitude-symptoms ams-turnaround severe-altitude'), why: '郊山不套用典型高山症題' },
    { routes: list('hehuan'), ids: list('lost-stop phone-power rain-gear-early first-aid-cut hypothermia-blanket team-roles lnt-toilet-waste hornet-warning download-offline-map'), why: '合歡主峰步道沒有長段林間路' },
    { routes: list('hehuan'), ids: list('severe-altitude water-source-safety lost-gully leech-wound snakebite-rescue'), why: '合歡主峰步道的地形與情境不符' },
    { routes: list('qixing'), ids: list('water-source-safety lost-gully'), why: '七星山標準線不沿溪' },
    { routes: list('qixing hehuan yushan xueshan nanhu'), ids: list('flash-flood unsafe-crossing'), why: '所選標準線不安排涉溪' },
    { routes: list('qixing hehuan'), ids: list('black-bear-encounter black-bear-distance'), why: '不製造這些遊憩區常見黑熊的印象' },
    { routes: list('qixing hehuan jiali'), ids: list('hut-camp-planning check-permits'), why: '單日線通常沒有住宿與入山核准題' },
    { routes: list('qixing jiali'), ids: list('check-insurance'), why: '題目描述的是高山路線' },
    { routes: list('jiali yushan xueshan nanhu'), ids: list('ten-essentials'), why: '題目描述的是半日步道' },
    { routes: list('yushan xueshan nanhu'), ids: list('monkey-no-feeding'), why: '不把獼猴題放在這些高海拔山頂' },
  ];
  const HEAT_IDS = list('heatstroke-descent heatstroke-confusion');
  const COLD_SEASON_IDS = list('snakebite-rescue leech-wound');
  const PREP_GROUP = { 'prep-thunder-stop': 'thunder', 'prep-rainpants': 'rain', 'prep-ice-turn': 'ice' };

  /* 不適用的題目回傳原因字串；適用回傳 null */
  function exclusionReason(s, mountain, ctx, actual) {
    const hit = ROUTE_EXCLUDE.find((r) => r.routes.includes(mountain.id) && r.ids.includes(s.id));
    if (hit) return hit.why;
    if (KEY_POOLS.flood.includes(s.id) && !mountain.route_flags.has_stream) return '路線沒有溪水暴露，不出溪洪題';
    if (KEY_POOLS.altitude.includes(s.id) && !mountain.route_flags.high_altitude) return '非高海拔路線，不出高山症題';
    if (TRIGGERS[s.id] && !evalCond(TRIGGERS[s.id], ctx)) return '本趟未符合出題條件';
    if (ONLY_IF[s.id] && !evalCond(ONLY_IF[s.id], ctx)) return '本趟未符合天氣或地形條件';
    if (HEAT_IDS.includes(s.id) && stageTemp(actual, s.stage)[1] < 12) return '這段氣溫太低，不出熱傷害題';
    if (COLD_SEASON_IDS.includes(s.id) && ctx.season === 'winter') return '冬季不出這類題';
    return null;
  }

  function selectScenarios(bank, mountain, ctx, actual, history, rng) {
    const excluded = {};
    const usable = bank.filter((s) => {
      const why = exclusionReason(s, mountain, ctx, actual);
      if (why) excluded[s.id] = why;
      return !why;
    });
    /* 先保留保命題名額，priority_ids 與一般題排在剩下的位置 */
    const reserved = reserveKeyScenarios(usable, mountain.stage_counts, {
      highAltitude: mountain.route_flags.high_altitude,
      hasStream: mountain.route_flags.has_stream,
      thunder: !!(ctx.weather && ctx.weather.thunder),
    }, rng, history);
    logKeyShortage(mountain.id, reserved);
    const concepts = reserved.concepts;
    /* 雷雨、高山症等同一觀念，一趟只出一題 */
    const dupConcept = (s) => s.key && concepts.has(s.keyConcept);
    const picked = [];
    const shortfall = {};
    STAGE_KEYS.forEach((stage) => {
      const want = mountain.stage_counts[stage];
      const fixed = reserved.picked.filter((s) => s.stage === stage);
      const room = want - fixed.length;
      const pool = usable.filter((s) => s.stage === stage && !fixed.includes(s));
      const prio = pool.filter((s) => mountain.priority_ids.includes(s.id));
      const triggered = pool.filter((s) => isPrepId(s.id) && !prio.includes(s));
      const rest = pool.filter((s) => !prio.includes(s) && !triggered.includes(s));
      /* 配額有兩題以上時，留一格給本趟條件觸發的新增題，不讓優先清單佔滿；
         保命題用掉位置後只剩一格，就由兩者輪流 */
      const prioOrder = byFreshness(prio, rng, history);
      const trigOrder = byFreshness(triggered, rng, history);
      const coin = rng.next() < 0.5;
      let head;
      if (room >= 2) head = prioOrder.slice(0, room - 1).concat(trigOrder.slice(0, 1));
      else if (want >= 2 && coin) head = trigOrder.slice(0, 1);
      else head = prioOrder.slice(0, 1);
      const order = head.concat(prioOrder, trigOrder, byFreshness(rest, rng, history)).filter((s, i, a) => a.indexOf(s) === i);
      /* 同一段先避開同主題（例如兩題雷雨），不夠才放寬 */
      const groupOf = (s) => s.group || PREP_GROUP[s.id] || null;
      const chosen = fixed.slice();
      const usedGroups = new Set(fixed.map(groupOf).filter(Boolean));
      const add = (s) => {
        chosen.push(s);
        if (s.key) concepts.add(s.keyConcept);
      };
      order.forEach((s) => {
        const g = groupOf(s);
        if (chosen.length < want && !dupConcept(s) && !(g && usedGroups.has(g))) {
          add(s);
          if (g) usedGroups.add(g);
        }
      });
      order.forEach((s) => { if (chosen.length < want && !chosen.includes(s) && !dupConcept(s)) add(s); });
      if (chosen.length < want) {
        order.forEach((s) => { if (chosen.length < want && !chosen.includes(s)) add(s); });
      }
      if (chosen.length < want) shortfall[stage] = want - chosen.length;
      picked.push(...rng.shuffle(chosen));
    });
    return { picked, audit: { excluded, shortfall, keyMissing: reserved.missing } };
  }

  /* 題目修飾（規格第 5 節）---------------------------------------------- */
  const miss = (who, mult, add) => ({ kind: 'miss', who, mult, add });
  const help = (label, mult, tail) => ({ kind: 'help', label, mult, add: 0, tail });
  const note = (text) => ({ kind: 'note', text, mult: 1, add: 0 });

  const MODIFIERS = [
    {
      id: 'light', ids: list('headlamp-before-dark night-bivouac'),
      apply: ({ gear }) => (gear.has_headlamp
        ? help('頭燈備援', 0.9, '先測試照明，仍不在黑暗中亂闖。')
        : miss('頭燈', 1.5, 0)),
    },
    {
      id: 'rain', ids: list('rain-gear-early pack-for-rain wet-hypothermia hypothermia-blanket'),
      when: ({ id, brief, here }) => (id === 'pack-for-rain' ? brief.wet : here.wet),
      apply: ({ gear }) => {
        if (gear.light_rain_only) return miss('可靠雨具（輕便雨衣只能短程備援）', 1.1, 1);
        if (!gear.has_rain_shell) return miss('雨具', 1.25, 2);
        if (gear.has_rain_pants) return help('雨衣與雨褲', 0.9, '趁未濕透先穿，持續惡劣仍要撤退。');
        return note('外套擋住上身，仍缺雨褲。');
      },
    },
    {
      id: 'warm', ids: list('layer-clothing wet-hypothermia hypothermia-blanket night-bivouac'),
      when: ({ id, brief, here }) => (id === 'layer-clothing' ? brief.cold : here.cold),
      apply: ({ gear, here }) => {
        if (!gear.has_insulation) return miss('保暖層', 1, 3);
        if (!gear.has_dry_clothes && here.wet) return miss('備用乾衣', 1, 1);
        if (gear.has_dry_clothes && gear.has_emergency_blanket) return help('保暖、乾衣與緊急毯', 0.9, '遮風雨、隔地、乾衣，緊急毯只是其中一環。');
        return null;
      },
    },
    {
      id: 'water', ids: list('dehydration-rest heatstroke-descent heatstroke-confusion'),
      apply: ({ gear }) => {
        if (gear.water_low) return miss(`足夠的水（本趟建議至少 ${gear.water_target_l} 公升）`, 1.25, 2);
        if (gear.has_sun_protection) return help('足夠的水與防曬', 0.9, '帶水不保證不中暑，意識異常不可灌水。');
        return null;
      },
    },
    {
      id: 'nav', ids: list('download-offline-map lost-stop lost-stop-b lost-gully lost-signal fog-junction'),
      when: ({ id, here }) => id !== 'fog-junction' || here.fog,
      apply: ({ gear }) => (gear.has_navigation
        ? help('導航備援', 0.9, '停下核對地形，地圖不是照走到底的命令。')
        : miss('離線地圖或紙圖指北針', 1.25, 2)),
    },
    {
      id: 'feet', ids: list('check-hiking-boots ankle-sprain fracture-stay'),
      apply: ({ gear, route, here }) => {
        if (gear.sandals) return { kind: 'miss', who: '合適的鞋（穿拖鞋）', mult: 1.3, add: 2 };
        if (gear.trainers && (route.rough || here.wet)) return { kind: 'miss', who: '抓地較好的鞋（運動鞋遇陡濕路）', mult: 1.1, add: 0 };
        if (gear.proper_shoes) return help('合腳的登山鞋', 0.95, '鞋不預防所有骨折，受傷也不能硬走。');
        return null;
      },
    },
    {
      id: 'pole', ids: list('ankle-sprain'),
      apply: ({ gear }) => (gear.has_trekking_poles ? help('登山杖', 0.95, '需會使用，受傷後不能靠杖硬撐。') : null),
    },
    {
      id: 'aid', ids: list('first-aid-cut ankle-sprain leech-wound'),
      apply: ({ gear }) => (gear.has_first_aid ? help('急救包', 0.9, '重點仍是正確處置。') : miss('急救包', 1, 2)),
    },
    {
      id: 'power', ids: list('phone-power emergency-location'),
      apply: ({ gear }) => (gear.has_power_bank
        ? help('行動電源', 0.9, '防水、省電，求援依約保持聯絡。')
        : miss('行動電源', 1, 2)),
    },
    {
      id: 'signal', ids: list('rescue-signals'),
      apply: ({ gear }) => {
        if (gear.has_whistle) return help('哨子', 0.9, '可原地示意，省體力。');
        return gear.has_headlamp ? null : miss('哨子與頭燈', 1, 2);
      },
    },
    {
      id: 'shelter', ids: list('night-bivouac'),
      apply: ({ gear }) => {
        if (!gear.has_shelter) return miss('緊急遮蔽', 1, 2);
        return gear.has_insulation ? help('緊急遮蔽與保暖層', 0.9, '仍須安全選址。') : null;
      },
    },
    {
      id: 'sun', ids: list('dehydration-rest heatstroke-descent heatstroke-confusion'),
      apply: ({ gear }) => (gear.has_sun_protection ? null : miss('防曬用品', 1, 1)),
    },
    {
      id: 'satellite', ids: list('emergency-call emergency-location'),
      apply: ({ gear }) => (gear.has_satellite ? note('可在安全地點嘗試已測試的備用通訊並確認送達，不保證收訊。') : null),
    },
  ];

  function matchingRules(id, ctx) {
    const arg = Object.assign({ id }, ctx);
    const out = [];
    MODIFIERS.forEach((m) => {
      if (!m.ids.includes(id) || (m.when && !m.when(arg))) return;
      const r = m.apply(arg);
      if (r) out.push(Object.assign({ rule: m.id }, r));
    });
    return out;
  }

  /* 只有選錯且 base>0 才有加減；選對時仍回傳規則，用來提醒行前可補強 */
  function resolveAnswer(id, base, correct, ctx) {
    const rules = matchingRules(id, ctx);
    if (correct || base <= 0) {
      return { base, mult: 1, add: 0, final: base, delta: 0, rules: [], applied: [], missing: rules.filter((r) => r.kind === 'miss'), notes: [] };
    }
    const effective = rules.filter((r) => r.kind !== 'note');
    const mult = clamp(effective.reduce((p, r) => p * r.mult, 1), 0.8, 1.5);
    const add = clamp(effective.reduce((s, r) => s + r.add, 0), 0, 6);
    const uncapped = Math.round(base * mult + add);
    const final = Math.min(40, Math.max(0, uncapped));
    return {
      base, mult, add, final, delta: final - base, capped: uncapped > 40,
      rules: effective, applied: rules.map((r) => r.rule),
      missing: effective.filter((r) => r.kind === 'miss'),
      notes: rules.filter((r) => r.kind === 'note').map((r) => r.text),
    };
  }

  function effectText(r) {
    const parts = [];
    if (r.mult !== 1) parts.push(`風險×${r.mult}`);
    if (r.add) parts.push(`+${r.add}`);
    return parts.join('、');
  }

  /* 給回饋區的文字：多原因先顯示兩行，完整明細放展開區 */
  function describeResult(res) {
    if (!res.rules.length) return { headline: '', lines: res.notes.slice(0, 2), details: [] };
    const moved = res.delta !== 0;
    const misses = res.rules.filter((r) => r.kind === 'miss');
    const helps = res.rules.filter((r) => r.kind === 'help');
    const lines = [];
    let headline = moved ? `原風險 ${res.base} → 本次 ${res.final}` : `原風險 ${res.base}，本次相同`;
    if (misses.length) {
      const whys = misses.slice(0, 2).map((r) => `${r.who}（${effectText(r)}）`).join('、');
      headline += `，因為你沒帶${whys}${res.capped ? '（單題上限 40）' : ''}。`;
    } else if (res.delta < 0) {
      headline += '。';
      lines.push(`${helps.map((r) => r.label).slice(0, 2).join('、')}讓這題風險少 ${-res.delta} 分。`);
    } else {
      headline += '。';
    }
    if (helps.length) lines.push(helps[0].tail);
    lines.push(...res.notes);
    const details = res.rules.map((r) => (r.kind === 'miss' ? `缺少 ${r.who}：${effectText(r)}` : `${r.label}：${effectText(r)}。${r.tail}`));
    details.push(`計算：${res.base} × ${Math.round(res.mult * 100) / 100} + ${res.add}，四捨五入後單題上限 40，得 ${res.final}。`);
    return { headline, lines: lines.slice(0, 2), details };
  }

  /* 敘事變體：只回傳要覆蓋的欄位，不改原題、不改 answer 索引 ------------------- */
  const SCENARIO_VARIANTS = {
    'headlamp-before-dark': ({ gear }, s) => (gear.has_headlamp ? null : {
      situation: '你下撤時遇到濃霧，森林比預期早暗下來。你沒帶頭燈，手機電量也不多。',
      options: { 0: '趁還看得到輪廓加快下坡，避免停下來耽誤更多時間', 1: '停在安全處集合，不摸黑亂走；無法撤退就保暖求援', 2: '用手機手電筒一路照明，電量用完了再想下一步' },
      why: '沒有頭燈時，摸黑趕路或用手機硬撐都容易滑倒，也會耗掉求援電力。先集合、保暖並回報位置；短程也要帶頭燈與備用電池。',
    }),
    'first-aid-cut': ({ gear }) => (gear.has_first_aid ? null : {
      situation: '你在林間跌倒，小腿擦傷滲血，人仍清醒且能正常活動。你這趟沒帶急救包，也沒有備用敷料。',
      options: { 0: '在安全處用手邊最乾淨的布料加壓，出血不止就求援', 2: '隨手找東西綁住傷口止血，回家洗完澡後再好好清理' },
      why: '沒有敷料時，先用手邊最乾淨的材料加壓止血，再用飲用水清潔；未清理就封住或用未處理溪水，都可能增加感染。出血不止或疑似重傷應求援，評估撤退。',
    }),
    'night-bivouac': ({ gear }) => {
      if (gear.has_headlamp && gear.has_insulation && gear.has_shelter) return null;
      const have = [];
      if (gear.has_headlamp) have.push('頭燈');
      if (gear.has_insulation) have.push('保暖衣');
      if (gear.has_shelter) have.push('隔地墊與緊急露宿袋');
      const out = {
        situation: `你在稜線附近迷路，天色將暗，風開始變冷。${have.length ? `你有${have.join('、')}，其他露宿裝備這趟沒帶。` : '你沒帶露宿與照明裝備，只有身上的衣物。'}`,
        options: { 0: `及早選安全避風處待援，${gear.has_shelter ? '隔濕保暖' : '用現有衣物保暖'}並回報位置` },
      };
      if (!gear.has_headlamp) out.options[2] = '趁手機還有電，繼續沿陡坡摸索下山，盡快離開這段稜線';
      return out;
    },
    'rain-gear-early': ({ gear }) => {
      const opt2 = gear.has_rain_pants ? {} : { 2: '先只顧著保護背包，衣服淋濕了之後再想辦法' };
      const keep = gear.has_dry_clothes ? '保護乾衣並' : '保暖並';
      if (gear.has_rain_shell && gear.has_rain_pants) return null;
      if (gear.has_rain_shell) {
        return { situation: '你走在林間，雨滴漸密，衣領開始濕冷。你只有防水外套，沒有雨褲；隊友提議等到大雨再穿。', options: { 1: `在安全處先穿防水外層，${keep}評估撤退`, ...opt2 } };
      }
      if (gear.light_rain_only) {
        return { situation: '你走在林間，雨滴漸密，衣領開始濕冷。你只帶了輕便雨衣；隊友提議等到大雨再穿。', options: { 1: `在安全處先穿輕便雨衣，${keep}評估撤退`, ...opt2 } };
      }
      return {
        situation: '你走在林間，雨滴漸密，衣領開始濕冷。你這趟沒帶可靠的雨具，隊友提議走快一點就好。',
        options: { 1: `先移到附近安全遮蔽處，${keep}評估撤退或求援`, ...opt2 },
        why: '趁尚未濕透就先避雨，比事後補救更有效。加速可能增加流汗與滑倒，也擋不住風雨；沒有可靠雨具時，更要及早評估撤退或求援。',
      };
    },
    'hypothermia-blanket': ({ gear }) => {
      if (gear.has_dry_clothes && gear.has_shelter && gear.has_emergency_blanket) return null;
      const have = [];
      if (gear.has_dry_clothes) have.push('乾衣');
      if (gear.has_shelter) have.push('隔地墊');
      if (gear.has_emergency_blanket) have.push('緊急毯');
      const steps = [];
      if (gear.has_dry_clothes) steps.push('換乾衣');
      if (gear.has_shelter) steps.push('隔地');
      steps.push(gear.has_emergency_blanket ? '包緊急毯' : '用現有衣物包覆');
      const out = {
        situation: `你發現同行者淋雨後持續發抖，說話含糊、動作變慢。${have.length ? `你帶有${have.join('、')}。` : '你手邊只有身上的衣物。'}`,
        options: { 0: `停止行程並求援，輕移避風處，${steps.join('、')}` },
      };
      if (!gear.has_emergency_blanket) out.options[1] = '只多披一件衣物保暖，留在迎風步道上等雨停了再繼續走';
      return out;
    },
    'key-wait-warm-visible': ({ gear }, s) => {
      const pad = gear.has_shelter || gear.has_overnight_kit;
      const bright = gear.has_rain_shell || gear.light_rain_only;
      if (gear.has_dry_clothes && pad && gear.has_headlamp && gear.has_whistle && bright) return null;
      const have = [];
      if (gear.has_dry_clothes) have.push('乾衣');
      if (pad) have.push('睡墊');
      if (gear.has_headlamp) have.push('頭燈');
      if (bright) have.push('亮色外套');
      if (gear.has_whistle) have.push('哨子');
      const out = {
        situation: s.situation.replace('你有乾衣、睡墊、頭燈、亮色外套與哨子。', have.length ? `你有${have.join('、')}，其他這趟沒帶。` : '你手邊只有身上的衣物和背包。'),
        options: { 1: `穿衣隔地擺亮色物，${gear.has_whistle ? '三聲吹哨停聽' : '定時呼喊停聽'}${gear.has_headlamp ? '並用燈示意' : '，有光再示意'}` },
      };
      if (!gear.has_whistle) out.options[2] = s.options[2].replace('沿途吹哨', '沿途呼喊');
      return out;
    },
    'key-hypothermia-evacuation': ({ gear }, s) => {
      const pad = gear.has_shelter || gear.has_overnight_kit;
      if (gear.has_dry_clothes && pad && gear.has_emergency_blanket) return null;
      const have = [];
      if (gear.has_dry_clothes) have.push('乾衣');
      if (pad) have.push('睡墊');
      if (gear.has_emergency_blanket) have.push('緊急毯');
      const out = {
        situation: s.situation.replace('全隊有乾衣、睡墊和緊急毯。', have.length ? `全隊只有${have.join('、')}。` : '全隊沒帶乾衣、睡墊或緊急毯，只有身上的衣物。'),
      };
      if (!gear.has_dry_clothes) out.options = { 1: s.options[1].replace('留乾衣', '留衣物') };
      return out;
    },
    'key-last-known-marker': ({ gear }, s) => (gear.has_gps_offline ? null : {
      situation: s.situation.replace('離線軌跡與現場來路吻合', gear.has_paper_navigation ? '紙本地圖與現場來路吻合' : '記得的方向與現場來路吻合'),
    }),
    'key-lost-up-or-down': ({ gear }, s) => (gear.has_navigation ? null : {
      situation: s.situation.replace('停下核對地圖', '停下核對路標與來時地形'),
    }),
    'lost-gully': ({ gear }, s) => (gear.has_navigation ? null : {
      situation: s.situation.replace('地圖上看不出', '你沒帶地圖，看不出'),
    }),
    'key-turnaround-before-summit': ({ gear }, s) => (gear.has_headlamp ? null : {
      situation: s.situation.replace('隊友想靠頭燈完成登頂', '隊友想靠手機照明完成登頂'),
    }),
    'fog-junction': ({ gear }) => (gear.has_navigation ? null : {
      options: { 0: '先集合核對正式路標與可用資料，無法確認就停下求助' },
    }),
    'ankle-sprain': ({ gear }) => (gear.has_first_aid ? {
      situation: '你下坡踩空扭到腳踝，坐下後逐漸腫痛，外觀沒有明顯變形。你的急救包裡有彈性繃帶與冷敷用品。',
    } : {
      situation: '你下坡踩空扭到腳踝，坐下後逐漸腫痛，外觀沒有明顯變形。全隊都沒帶繃帶與冷敷用品。',
      options: { 1: '先用力把腫處揉開，再用衣物綁緊繼續走', 2: '停止負重，抬高休息、衣物固定並評估撤退' },
    }),
    'layer-clothing': ({ gear }) => {
      const have = [];
      if (gear.has_insulation) have.push('保暖層');
      if (gear.has_rain_shell) have.push('防風雨外層');
      return {
        situation: `你穿著${gear.cotton_base ? '棉質上衣' : '排汗上衣'}準備爬升，${have.length ? `身上和背包裡有${have.join('、')}` : '身上和背包裡都沒有多餘的保暖或防風雨層'}。清晨很涼，走動後卻容易流汗。`,
        options: {
          0: `${gear.cotton_base ? '先放慢速度控制流汗' : '保持排汗底層'}，依冷熱增減現有衣物，${gear.has_dry_clothes ? '另備乾衣' : '濕冷就撤退'}`,
          1: `繼續穿${gear.cotton_base ? '棉衣，柔軟又透氣' : '同一件，不必調整'}，濕了就靠體溫在路上慢慢烘乾`,
        },
      };
    },
    'pack-for-rain': ({ gear }) => (gear.has_rain_shell || gear.light_rain_only ? null : {
      situation: '你正整理背包，水袋和硬物集中在外側。今天可能隨時下雨，你也沒帶雨具。',
      options: {
        0: '重物靠背固定，常用物易取，衣物與電子用品防水',
        1: '維持原樣比較好走，淋雨時再把背包倒空找替代品',
        2: '只用塑膠袋包住背包就夠，內部衣物與手機不必防水',
      },
    }),
    'water-source-safety': ({ gear }) => (gear.has_water_treatment ? null : {
      situation: '你剩下的水不足以支應後半程，旁邊有清澈溪水，卻沒有可靠的補水資訊。你沒帶淨水用品。',
      options: { 1: '先調整或縮短行程；不生飲，必要時求援或確認水源' },
    }),
    'turnaround-time': ({ gear }) => (gear.has_headlamp ? null : {
      options: { 2: '等雲海出現再走，反正有手機照明，天黑了也不用怕' },
    }),
    'download-offline-map': ({ gear }) => {
      const out = {};
      if (gear.has_gps_offline) out.situation = '你準備進入收訊差的森林，才發現離線地圖沒下載到這段路線，手機裡只有網頁地圖截圖。這條步道有多個支線。';
      if (!gear.has_paper_navigation) out.options = { 0: '下載離線地圖與路線並測試定位，不確定就改走簡單路線' };
      return out;
    },
    'emergency-location': ({ gear }) => (gear.has_gps_offline ? null : {
      situation: '你在山頂附近受傷，手機顯示只能緊急通話。手機定位仍能顯示座標，身旁有步道里程牌。',
    }),
    'rescue-signals': ({ gear }) => (gear.has_whistle ? null : {
      options: { 0: '原地用燈光或反光物示意，保持可回電並聽指示' },
    }),
    'check-hiking-boots': ({ gear }) => {
      if (gear.sandals) {
        return {
          situation: '你在登山口才發現自己穿著拖鞋，今天有濕滑石階。隊友說走慢一點就好。',
          options: { 0: '用膠帶把拖鞋纏牢固，照原定長程路線放慢速度走完' },
        };
      }
      if (gear.trainers) return { situation: '你在登山口發現運動鞋鞋底已磨得很平，今天有濕滑石階。隊友說綁緊鞋帶就好。' };
      return null;
    },
    'prep-rainpants': ({ gear }) => {
      if (gear.has_rain_pants) return null;
      return {
        situation: gear.has_rain_shell
          ? '雨持續下，外套擋住上身，但你沒帶雨褲，褲管開始濕冷。'
          : '雨持續下，你沒有可靠的雨具，衣服和褲管都開始濕冷。',
        options: { 1: '到安全遮蔽處保暖，評估撤退' },
      };
    },
    'prep-thunder-stop': ({ gear }) => (gear.has_rain_shell || gear.light_rain_only ? null : {
      title: '聽到雷聲就要撤',
      situation: '雲層快速堆高，你在開闊山頂聽見雷聲。',
      options: { 0: '雷聲還很遠，可以再多待一下' },
    }),
  };

  /* 路線用詞：單日線沒有山屋，合歡主峰沒有長段森林 */
  const ROUTE_VARIANTS = {
    'headlamp-before-dark': (m, v) => (m.id === 'hehuan' ? { situation: v.situation.replace('森林', '山路') } : null),
    'altitude-symptoms': (m, v) => (m.id === 'hehuan' ? {
      situation: v.situation.replace('撐到山屋', '撐到山頂'),
      options: { 2: v.options[2].replace('更高的山屋走到再休息', '更高的山頂走到再休息') },
    } : null),
    'wet-hypothermia': (m, v) => (m.route_flags.overnight ? null : {
      situation: v.situation.replace('前方山屋', '前方登山口'),
      options: { 0: v.options[0].replace('前方的山屋', '前方的登山口') },
    }),
    'key-hypothermia-evacuation': (m, v) => (m.route_flags.overnight ? null : {
      situation: v.situation.replace('原定山屋卻還要陡爬兩小時', '下到登山口卻還要走兩小時'),
      options: { 1: v.options[1].replace('全隊上山屋找人再回接', '全隊下山找人再回接') },
    }),
  };

  function scenarioVariant(s, mountain, ctx) {
    let view = { title: s.title, situation: s.situation, options: s.options.slice(), why: s.why };
    const merge = (o) => {
      if (!o) return;
      if (o.title) view.title = o.title;
      if (o.situation) view.situation = o.situation;
      if (o.why) view.why = o.why;
      if (o.options) Object.keys(o.options).forEach((i) => { view.options[i] = o.options[i]; });
    };
    const g = SCENARIO_VARIANTS[s.id];
    if (g) merge(g(ctx, s));
    const r = ROUTE_VARIANTS[s.id];
    if (r) merge(r(mountain, view));
    return view;
  }

  /* 把事件的題目換成顯示副本：洗牌順序與 orig、answer 都不動 */
  function applyVariants(events, mountain, ctx) {
    events.forEach((ev) => {
      const view = scenarioVariant(ev.scenario, mountain, ctx);
      ev.scenario = Object.assign({}, ev.scenario, view);
      ev.options.forEach((opt) => { opt.text = view.options[opt.orig]; });
    });
    return events;
  }

  function altitudeProfile(m) {
    const t = m.trailhead_m;
    const d = m.summit_m - t;
    const at = (k) => Math.round(t + d * k);
    return [[0, t], [1400, at(0.12)], [3200, at(0.55)], [4800, at(0.9)], [5250, m.summit_m], [5500, m.summit_m], [5800, at(0.95)], [7400, t]];
  }

  /* 載入驗證：任一處不符就整包不用，不做部分混搭 */
  function validateData(mountains, gear, bank) {
    const fail = (msg) => { throw new Error(msg); };
    if (!mountains || !Array.isArray(mountains.mountains) || mountains.mountains.length !== 6) fail('山岳資料不完整');
    if (!gear || !Array.isArray(gear.slots) || !Array.isArray(gear.items) || !Array.isArray(gear.preparation_rules)) fail('裝備資料不完整');
    const ids = new Set(bank.map((s) => s.id));
    const index = makeItemIndex(gear);
    gear.slots.forEach((slot) => slot.options.forEach((id) => { if (!index[id]) fail(`未知品項 ${id}`); }));
    mountains.mountains.forEach((m) => {
      SEASONS.forEach((s) => { if (!m.forecast[s.key]) fail(`${m.id} 缺 ${s.key} 預報`); });
      STAGE_KEYS.forEach((k) => { if (!Number.isInteger(m.stage_counts[k])) fail(`${m.id} 缺 ${k} 配額`); });
      m.priority_ids.forEach((id) => { if (!ids.has(id)) fail(`${m.id} 優先題不存在：${id}`); });
    });
    Object.keys(TRIGGERS).forEach((id) => { if (!ids.has(id)) fail(`新增題不存在：${id}`); });
    /* 用預設配裝實際跑一次所有條件，路徑打錯在這裡就會丟錯 */
    const m = mountains.mountains[0];
    const f = generateForecast(m, 'spring', 1, 0, 0);
    const brief = briefFlags(m, f);
    const sel = sampleSelection();
    const ctx = { gear: gearFlags(sel, index, m, brief), weather: brief, route: m.route_flags, state: { pack_weight_g: 0 } };
    gear.preparation_rules.forEach((r) => {
      evalCond(r.when, ctx);
      if (!PASS_TEXT[r.id]) fail(`規則缺少符合說明：${r.id}`);
    });
    Object.values(TRIGGERS).concat(Object.values(ONLY_IF)).forEach((c) => evalCond(c, ctx));
  }

  DH.prepLogic = {
    SEASONS, GROUP_KEYS, GROUP_NAMES, TRIGGERS, ROUTE_EXCLUDE,
    seasonName, isPrepId, evalCond, pickSeason, generateForecast, generateActual, briefFlags, actualFlags, tripWeather,
    stageTemp, postponeReasons, windLabel, formatDays, emptySelection, sampleSelection, undecidedSlots, bodyEffects, waterTarget, makeItemIndex, selectedIds, packWeight,
    gearFlags, recommendedSelection, assessPreparation, essentialStatus, selectScenarios,
    exclusionReason, matchingRules, resolveAnswer, describeResult, scenarioVariant, applyVariants, altitudeProfile, validateData,
  };
})();
