/* 純邏輯：亂數、抽題、分級、紀錄。不碰畫面。 */
(function () {
  const DH = (window.DH = window.DH || {});

  const SECTIONS = [
    { key: 'trailhead', name: '登山口', sign: '登山口', from: 0, to: 1400 },
    { key: 'forest', name: '森林步道', sign: '森林步道', from: 1400, to: 3200 },
    { key: 'ridge', name: '稜線', sign: '稜線步道', from: 3200, to: 4800 },
    { key: 'summit', name: '山頂', sign: '山頂', from: 4800, to: 5800 },
    { key: 'descent', name: '下山路', sign: '下山路', from: 5800, to: 7400 },
  ];
  const FINISH_X = 7400;
  const STAGE_KEYS = SECTIONS.map((s) => s.key);
  const QUOTA = { trailhead: [2, 3], forest: [2, 3], ridge: [2, 3], summit: [1, 2], descent: [2, 3] };
  const ALTITUDE = [[0, 1850], [1400, 2000], [3200, 2800], [4800, 3300], [5300, 3420], [5800, 3380], [7400, 1850]];
  let altitudePts = ALTITUDE;

  /* 依所選山岳換高度折線；傳 null 回到原版路線 */
  function setAltitudeProfile(pts) {
    altitudePts = pts || ALTITUDE;
  }

  function altitudeAt(x) {
    const pts = altitudePts;
    if (x <= pts[0][0]) return pts[0][1];
    for (let i = 1; i < pts.length; i++) {
      if (x <= pts[i][0]) {
        const t = (x - pts[i - 1][0]) / (pts[i][0] - pts[i - 1][0]);
        return pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * t;
      }
    }
    return pts[pts.length - 1][1];
  }

  function sectionAt(x) {
    for (const s of SECTIONS) if (x < s.to) return s;
    return SECTIONS[SECTIONS.length - 1];
  }

  /* 32 位元 FNV-1a：把種子、山、季節與用途組成獨立亂數流，換一件衣服不會改變後面題目 */
  function hash32(...parts) {
    const str = parts.join('|');
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    return h >>> 0;
  }

  function makeRng(seed) {
    let a = seed >>> 0;
    const next = () => {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    const int = (lo, hi) => lo + Math.floor(next() * (hi - lo + 1));
    return {
      next,
      int,
      range: (lo, hi) => lo + next() * (hi - lo),
      pick: (arr) => arr[Math.floor(next() * arr.length)],
      shuffle(arr) {
        const out = arr.slice();
        for (let i = out.length - 1; i > 0; i--) {
          const j = int(0, i);
          [out[i], out[j]] = [out[j], out[i]];
        }
        return out;
      },
    };
  }

  /* 保命題對照表（依 research/key_concepts.md 的 must-appear 清單與其明列的同義替代題）。
     concept 相同視為同一觀念，同趟不重複；point 是作答後的「保命重點」，act 是 point 裡要加粗的必做行動。 */
  const KEY_TABLE = {
    'leave-trip-plan': { concept: '留守與行程計畫', act: '交給留守人', point: '出發前把路線、隊員、時程、撤退方案與逾時通報時間交給留守人；行程變更與平安下山都要回報。' },
    'typhoon-route-check': { concept: '最新氣象與取消', act: '出發前查最新山區氣象與路況', point: '山下晴不代表山區安全；出發前查最新山區氣象與路況，情況惡劣就調整或取消。' },
    'team-roles': { concept: '不拆隊、配合最慢者', act: '全隊配合最慢成員配速', point: '全隊配合最慢成員配速，領隊與殿後掌握人數，岔路集合，不各走各的。' },
    'key-lost-up-or-down': { concept: '迷路：先停、回已知步道', group: 'lost', act: '先 STOP', point: '先 STOP，能確認安全來路才回最後確定的路標或已知步道；主徑在上方就優先往上回。不要輕易下切未知溪谷，易遇瀑布斷崖、收訊差、搜救也難。' },
    'key-stop-stay-or-move': { concept: 'STOP：停、想、看、計畫', group: 'lost', act: '留在安全處，報位、保暖、待援', point: 'STOP 是停止、思考、觀察、計畫；無法確認來路就留在安全處，報位、保暖、待援，不猜路也不拆隊。' },
    'key-last-known-marker': { concept: '迷路：回最後確定路標', group: 'lost', act: '回最後確定的路標或系結帶', point: '能安全回溯才回最後確定的路標或系結帶，並與地圖、地形核對；不跟單一舊布條，也不自己開路。' },
    'key-rescue-phone-power': { concept: '求救與省電', group: 'lowsignal', act: '報座標、路線、人數與傷況', point: '119 不通可試 112 按 9 轉接（須有任一業者涵蓋）；報座標、路線、人數與傷況，約好下次聯絡時段再省電。' },
    'key-wait-warm-visible': { concept: '待援保暖、讓人看見', act: '留在安全處保暖隔地', point: '留在安全處保暖隔地，用亮色物、哨音與燈光示意；不為了被看見而走上裸稜或崖邊。' },
    'key-wait-relocation-note': { concept: '待援點變危險就短移', act: '只作必要短移', point: '原地待援不等於留在危險中；只作必要短移，安全許可才留字條，到安全處盡快補報新位置。' },
    'key-turnaround-before-summit': { concept: '折返時間', act: '照約下山', point: '折返時間一到，就算還沒登頂也照約下山；頭燈只是延誤備援，不能拿來賭登頂。' },
    'key-flood-wait-retreat': { concept: '溪水不渡', group: 'stream', act: '退到安全處等候', point: '當地沒雨，上游下雨也會暴漲；別強渡或沿未知溪岸找淺處，退到安全處等候，水退仍要重評，沒有安全通路就求援。' },
    'flash-flood': { concept: '溪水不渡', act: '離開溪床，撤到安全處', point: '頭頂沒雨，上游下雨也會暴漲；水變濁、有漂流物就離開溪床，撤到安全處。' },
    'unsafe-crossing': { concept: '溪水不渡', act: '退到高於溪水威脅處', point: '去程能過不代表回程安全；不渡急流、不靠人鏈或舊繩，退到高於溪水威脅處，受困就求援。' },
    'key-hypothermia-evacuation': { concept: '失溫先保暖', group: 'hypo', act: '先隔風隔濕、換乾衣、隔地保暖並求援', point: '先隔風隔濕、換乾衣、隔地保暖並求援，全程有人陪護；反應遲鈍者不硬走，評估後依救援指示安全後送。' },
    'severe-altitude': { concept: '高山症', act: '立即求援', point: '休息仍喘、走路歪斜、反應變慢是重症警訊：立即求援，在安全與人力允許下協助下降，不讓患者獨走或等過夜。' },
    'altitude-symptoms': { concept: '高山症', act: '先停止上升', point: '高海拔頭痛噁心先停止上升；休息未改善就有人陪同下降，不靠藥物或體力硬撐。' },
    'ams-turnaround': { concept: '高山症', act: '不再上升，陪同下降', point: '持續頭痛噁心、休息未改善就不再上升，陪同下降，不讓不適者獨處或獨走。' },
    'thunder-ridge': { concept: '雷雨離稜線', act: '放棄登頂，離開裸稜與孤立高點', point: '聽到雷聲就放棄登頂，離開裸稜與孤立高點，不躲孤立大樹，往較低且無溪洪落石風險處撤。' },
    'afternoon-thunder': { concept: '雷雨離稜線', act: '及早離開山頂與裸稜', point: '聽到雷聲不必等下雨就要撤：及早離開山頂與裸稜，孤立高樹下不是避雷處。' },
    'prep-thunder-stop': { concept: '雷雨離稜線', act: '離開開闊山頂', point: '雨衣不防雷；聽到雷聲就離開開闊山頂，不留在高點，也不躲孤樹。' },
    'key-collapse-cpr': { concept: '倒地沒呼吸：CPR', act: '立刻求援並開始壓胸', point: '無反應且沒有正常呼吸（偶爾喘一下不算）：立刻求援並開始壓胸，依 119 指導持續，不灌水、不先背下山。' },
  };
  /* 保證抽題的名額池。陣列順序是「都沒見過時」的優先序：首次先 STOP 與求救，其後補路標、CPR。 */
  const KEY_POOLS = {
    trailhead: ['leave-trip-plan', 'team-roles', 'typhoon-route-check'],
    forest: ['key-stop-stay-or-move', 'key-rescue-phone-power', 'key-last-known-marker', 'key-collapse-cpr'],
    ridge: ['key-turnaround-before-summit', 'key-lost-up-or-down', 'key-hypothermia-evacuation'],
    descent: ['key-wait-warm-visible', 'key-wait-relocation-note'],
    altitude: ['severe-altitude', 'altitude-symptoms', 'ams-turnaround'],
    flood: ['key-flood-wait-retreat', 'unsafe-crossing', 'flash-flood'],
    thunder: ['thunder-ridge', 'afternoon-thunder', 'prep-thunder-stop'],
  };
  const FIRST_TIME_FOREST = KEY_POOLS.forest.slice(0, 2);
  const MIN_KEY = 4;

  function isValidScenario(s) {
    return !!s
      && (s.key === undefined || typeof s.key === 'boolean')
      && typeof s.id === 'string' && s.id !== ''
      && STAGE_KEYS.includes(s.stage)
      && typeof s.title === 'string'
      && typeof s.situation === 'string'
      && Array.isArray(s.options) && s.options.length === 3 && s.options.every((o) => typeof o === 'string')
      && Number.isInteger(s.answer) && s.answer >= 0 && s.answer <= 2
      && Array.isArray(s.risk) && s.risk.length === 3 && s.risk.every((n) => Number.isFinite(n) && n >= 0)
      && typeof s.why === 'string';
  }

  function cleanBank(raw) {
    if (!Array.isArray(raw)) return [];
    const seen = new Set();
    const out = [];
    for (const s of raw) {
      if (!isValidScenario(s)) {
        console.warn('略過格式不符的題目：', s && s.id);
        continue;
      }
      if (seen.has(s.id)) continue;
      seen.add(s.id);
      out.push(withKeyInfo(s));
    }
    return out;
  }

  /* 只加欄位不動原文；題庫標 key:true 但對照表沒有的，仍是保命題，用分類當觀念名稱 */
  function withKeyInfo(s) {
    const info = KEY_TABLE[s.id];
    if (!info && !s.key) return s;
    return Object.assign({}, s, {
      key: true,
      keyConcept: s.keyConcept || (info ? info.concept : s.category || '保命觀念'),
      keyPoint: s.keyPoint || (info ? info.point : s.why.split(/(?<=[。！？])/)[0]),
      keyAct: info && info.act,
      group: s.group || (info && info.group) || undefined,
    });
  }

  /* 0 = 沒看過、1 = 看過但沒答對過、2 = 答對過。數字小的先抽。 */
  function freshness(id, history) {
    const h = history && history[id];
    if (!h) return 0;
    return h.correct > 0 ? 2 : 1;
  }

  function byFreshness(list, rng, history) {
    const shuffled = rng.shuffle(list);
    return shuffled
      .map((s, i) => ({ s, i, f: freshness(s.id, history) }))
      .sort((a, b) => a.f - b.f || a.i - b.i)
      .map((e) => e.s);
  }

  /* 依新鮮度排序；同樣沒見過時才照名額池順序（首次優先 STOP 與求救） */
  function rankKeyPool(ids, bank, rng, history, ranked) {
    const found = ids.map((id) => bank.find((s) => s.id === id)).filter(Boolean);
    return rng.shuffle(found)
      .map((s, i) => ({ s, i, f: freshness(s.id, history), r: ranked ? ids.indexOf(s.id) : 0 }))
      .sort((a, b) => a.f - b.f || (a.f === 0 ? a.r - b.r : 0) || a.i - b.i)
      .map((e) => e.s);
  }

  /* 先替保命題保留名額：基本四段各一，再依路線與天氣加高山症、溪洪、雷雨。
     bank 必須已濾掉本路線排除的題目；不會為了湊數放寬排除或超過 capacity。
     opts：{ highAltitude, hasStream, thunder } */
  function reserveKeyScenarios(bank, capacity, opts, rng, history) {
    const left = Object.assign({}, capacity);
    const picked = [];
    const missing = [];
    const concepts = new Set();
    const take = (s) => {
      picked.push(s);
      left[s.stage]--;
      concepts.add(s.keyConcept);
    };
    const fits = (s) => left[s.stage] > 0 && !picked.includes(s) && !concepts.has(s.keyConcept);
    const reserve = (name, ranked = true) => {
      const hit = rankKeyPool(KEY_POOLS[name], bank, rng, history, ranked).find(fits);
      if (hit) take(hit);
      else missing.push(name);
      return hit;
    };
    ['trailhead', 'forest', 'ridge', 'descent'].forEach((slot) => reserve(slot));
    if (opts.highAltitude) reserve('altitude');
    if (opts.hasStream) reserve('flood');
    if (opts.thunder) reserve('thunder', false);
    /* 首次體驗：森林還有位置，就把 STOP 與求救都排上 */
    const firstTime = FIRST_TIME_FOREST
      .map((id) => bank.find((s) => s.id === id))
      .find((s) => s && freshness(s.id, history) === 0 && fits(s));
    if (firstTime) take(firstTime);
    /* 相容題不足才走到這裡：同段以其他尚未用到的保命觀念補，仍不足就回報缺額 */
    if (concepts.size < MIN_KEY) {
      byFreshness(bank.filter((s) => s.key), rng, history).filter(fits).forEach((s) => {
        if (concepts.size < MIN_KEY && fits(s)) take(s);
      });
    }
    return { picked, missing, concepts };
  }

  function logKeyShortage(where, res) {
    if (res.missing.length || res.concepts.size < MIN_KEY) {
      console.info(`[保命題] ${where}：名額不足 ${res.missing.join('、') || '無'}；本趟 ${res.picked.length} 題、${res.concepts.size} 種觀念（未放寬排除規則）`);
    }
  }

  /* 回傳依路線順序排好的題目：各 stage 內隨機，題庫不足時從其他 stage 補。 */
  function pickScenarios(bank, rng, history) {
    const total = Math.min(bank.length, rng.int(10, 12));
    const quota = {};
    STAGE_KEYS.forEach((k) => { quota[k] = QUOTA[k][0]; });
    let extra = Math.max(0, total - 9);
    while (extra > 0) {
      const open = STAGE_KEYS.filter((k) => quota[k] < QUOTA[k][1]);
      quota[rng.pick(open)]++;
      extra--;
    }

    /* 原版路線沒有山岳設定，但一路爬到 3400 公尺，比照高海拔線保留高山症名額 */
    const reserved = reserveKeyScenarios(bank, quota, { highAltitude: true }, rng, history);
    logKeyShortage('原版路線', reserved);
    const chosen = reserved.picked.slice();
    const taken = new Set(chosen.map((s) => s.id));
    /* 一般題若也是保命題，同一觀念不重複出現 */
    const dupConcept = (s) => s.key && reserved.concepts.has(s.keyConcept);
    STAGE_KEYS.forEach((k) => {
      let room = quota[k] - chosen.filter((s) => s.stage === k).length;
      byFreshness(bank.filter((s) => s.stage === k && !taken.has(s.id)), rng, history).forEach((s) => {
        if (room <= 0 || dupConcept(s)) return;
        room--;
        chosen.push(s);
        taken.add(s.id);
        if (s.key) reserved.concepts.add(s.keyConcept);
      });
    });
    const spare = byFreshness(bank.filter((s) => !taken.has(s.id) && !dupConcept(s)), rng, history)
      .concat(byFreshness(bank.filter((s) => !taken.has(s.id) && dupConcept(s)), rng, history));
    while (chosen.length < total && spare.length) chosen.push(spare.shift());

    /* 補進來的題目留在自己的 stage，場景才對得上（稜線的雷雨不會跑到停車場）。 */
    const grouped = [];
    STAGE_KEYS.forEach((k) => {
      grouped.push(...rng.shuffle(chosen.filter((s) => s.stage === k)));
    });
    return grouped;
  }

  /* 把題目排進路線上的 x 座標，並洗牌選項。 */
  function buildEvents(scenarios, rng) {
    const events = [];
    SECTIONS.forEach((sec) => {
      const list = scenarios.filter((s) => s.stage === sec.key);
      const lead = sec.key === 'trailhead' ? 620 : 140;
      const tail = sec.key === 'descent' ? 220 : 120;
      const span = sec.to - sec.from - lead - tail;
      list.forEach((scenario, i) => {
        const slot = span / list.length;
        events.push({
          scenario,
          x: Math.round(sec.from + lead + slot * (i + 0.5) + rng.range(-0.15, 0.15) * slot),
          d: rng.range(0.25, 0.75),
          marker: rng.pick(['bubble', 'stele', 'animal']),
          animal: rng.pick(['macaque', 'muntjac', 'pheasant']),
          options: rng.shuffle(scenario.options.map((text, orig) => ({
            text,
            orig,
            risk: scenario.risk[orig],
            correct: orig === scenario.answer,
          }))),
          done: false,
          correct: null,
        });
      });
    });
    return events;
  }

  const GRADES = [
    {
      key: 'legend', tier: 'good', max: 20,
      kicker: '好結局',
      title: '平安滿載的山神級登山客',
      message: '從準備到下山，你的判斷都很穩。這份謹慎就是最好的裝備，下一座山也照這樣走。',
    },
    {
      key: 'safe', tier: 'good', max: 50,
      kicker: '好結局',
      title: '有驚無險',
      message: '大部分判斷都很好，有幾個地方差一點出事。看看下面的總結，下次就能更從容。',
    },
    {
      key: 'close', tier: 'normal', max: 80,
      kicker: '普通結局',
      title: '驚險下山',
      message: '平安回來了，但這趟有不少運氣成分，安全觀念還需要加強。出發前先把下面答錯的題目看熟吧。',
    },
    {
      key: 'narrow', tier: 'normal', max: 100,
      kicker: '普通結局',
      title: '險象環生',
      message: '你撐到了終點，但離出事只差一步。真實的山不一定會給第二次機會，建議先參加登山安全課程再挑戰。',
    },
    {
      key: 'rescue', tier: 'bad', max: Infinity,
      kicker: '這趟沒有走完',
      title: '這場救援本來可以避免',
      message: '風險累積到你自己處理不了，搜救人員和直升機只好進山來接你。他們要為此承擔風險，這些人力也沒辦法去處理別的緊急事件。這不是運氣不好，是準備不足和一次次判斷失誤疊出來的結果。',
      safety: '要檢討的是準備不足，不是求救。真的出事要立刻撥 119 或 112，不要怕丟臉。',
    },
  ];

  function gradeFor(risk) {
    return GRADES.find((g) => risk < g.max);
  }

  const RISK_STOPS = [
    [0, [91, 191, 122]],
    [40, [242, 201, 76]],
    [70, [242, 153, 74]],
    [100, [229, 72, 77]],
  ];
  function riskRgb(risk) {
    for (let i = 1; i < RISK_STOPS.length; i++) {
      const [p1, c1] = RISK_STOPS[i];
      const [p0, c0] = RISK_STOPS[i - 1];
      if (risk <= p1) {
        const t = (risk - p0) / (p1 - p0);
        return c0.map((v, k) => Math.round(v + (c1[k] - v) * t));
      }
    }
    return RISK_STOPS[RISK_STOPS.length - 1][1];
  }
  const riskColor = (risk) => `rgb(${riskRgb(Math.max(0, risk)).join(',')})`;

  const BADGES = [
    { id: 'first', name: '第一次下山', desc: '完成一趟完整路線' },
    { id: 'legend', name: '山神認證', desc: '風險低於 20 完成路線' },
    { id: 'zero', name: '零風險', desc: '風險 0 完成路線' },
    { id: 'streak5', name: '判斷連發', desc: '一趟中連續答對 5 題' },
    { id: 'scholar', name: '山岳百科', desc: '看過題庫裡的每一題' },
  ];

  const STORE_KEY = 'digital-hiking.v1';
  const emptyStore = () => ({ plays: 0, finishes: 0, rescues: 0, best: null, seen: {}, badges: [] });

  /* localStorage 可能被擋（隱私模式），退回記憶體內的一份，遊戲照常進行。 */
  const store = {
    data: emptyStore(),
    load() {
      try {
        const raw = localStorage.getItem(STORE_KEY);
        if (raw) this.data = Object.assign(emptyStore(), JSON.parse(raw));
        /* 舊紀錄裡的「勇於求救」徽章已取消：動用救援不該拿到獎勵 */
        this.data.badges = this.data.badges.filter((id) => id !== 'rescue');
      } catch (e) {
        this.data = emptyStore();
      }
      return this.data;
    },
    save() {
      try {
        localStorage.setItem(STORE_KEY, JSON.stringify(this.data));
      } catch (e) { /* 存不了就只留在這次遊玩 */ }
    },
    reset() {
      /* 清紀錄不等於換角色 */
      const heroGender = this.data.heroGender;
      this.data = Object.assign(emptyStore(), { heroGender });
      this.save();
    },
    recordStart() {
      this.data.plays++;
      this.save();
    },
    recordAnswer(id, correct) {
      const h = this.data.seen[id] || (this.data.seen[id] = { seen: 0, correct: 0 });
      h.seen++;
      if (correct) h.correct++;
      this.save();
    },
    /* 回傳本趟新解鎖的徽章。 */
    recordEnding({ risk, grade, completed, bestStreak, bankIds }) {
      const d = this.data;
      if (completed) d.finishes++;
      else d.rescues++;
      const cur = { risk, title: grade.title, completed, date: new Date().toISOString().slice(0, 10) };
      /* 動用救援的一趟不算紀錄 */
      const isNewBest = completed && (!d.best || !d.best.completed || risk < d.best.risk);
      if (isNewBest) d.best = cur;
      const earned = [];
      if (completed) earned.push('first');
      if (completed && risk < 20) earned.push('legend');
      if (completed && risk === 0) earned.push('zero');
      if (completed && bestStreak >= 5) earned.push('streak5');
      if (completed && bankIds.length && bankIds.every((id) => d.seen[id])) earned.push('scholar');
      const fresh = earned.filter((id) => !d.badges.includes(id));
      d.badges.push(...fresh);
      this.save();
      return { fresh, isNewBest };
    },
  };

  /* 玩家選的角色。其他 NPC 不看這裡 */
  const HERO_GENDERS = ['male', 'female'];
  DH.player = {
    gender: 'male',
    onChange: null,
    load() {
      if (HERO_GENDERS.includes(store.data.heroGender)) this.gender = store.data.heroGender;
    },
    set(gender) {
      if (!HERO_GENDERS.includes(gender) || gender === this.gender) return;
      this.gender = gender;
      store.data.heroGender = gender;
      store.save();
      if (this.onChange) this.onChange(gender);
    },
  };

  DH.core = {
    SECTIONS, FINISH_X, STAGE_KEYS, BADGES, GRADES,
    altitudeAt, setAltitudeProfile, sectionAt, makeRng, hash32, cleanBank, byFreshness, pickScenarios, buildEvents,
    KEY_TABLE, KEY_POOLS, MIN_KEY, reserveKeyScenarios, logKeyShortage,
    gradeFor, riskColor, store,
  };
})();
