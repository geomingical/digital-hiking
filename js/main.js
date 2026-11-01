/* 遊戲主程式：狀態、更新迴圈、輸入、測試鉤子。 */
(function () {
  const DH = window.DH;
  const { core, world, ui, audio, art, prep, prepLogic } = DH;
  const { FINISH_X, store } = core;
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  const SPEED = 250;
  const HINT_RANGE = 150;
  const AUTO_RANGE = 44;
  const START_X = 120;
  const MAX_X = FINISH_X + 40;
  const { reducedMotion } = art;
  /* Canvas 裡的時間：減少動態時整個停住，雲、草、眨眼與結局插圖一起靜止 */
  const STILL_T = 1;
  const artTime = () => (reducedMotion() ? STILL_T : view.t);
  const HERO_H = 112;
  const ATTRACT = { lo: 640, hi: 775 };

  const params = new URLSearchParams(location.search);
  const seedParam = params.get('seed');
  const hasSeed = seedParam !== null && seedParam !== '' && Number.isFinite(Number(seedParam));
  const seedValue = hasSeed ? Number(seedParam) : (Date.now() ^ (Math.random() * 1e9));
  const rng = core.makeRng(seedValue);
  /* ?classic=1 直接走原版流程（沒有行前準備），現有版面測試靠它 */
  const classicParam = params.get('classic') === '1';

  const canvas = document.getElementById('scene');
  const ctx = canvas.getContext('2d');
  const endingCanvas = document.getElementById('ending-art');
  const endingCtx = endingCanvas.getContext('2d');
  let layout = null;
  let dpr = 1;
  let endingKey = '';

  store.load();

  const state = {
    screen: 'loading',
    bankReady: false,
    bankSource: null,
    bankSize: 0,
    prepReady: false,
    trip: null,
    preparation: null,
    eventRiskLog: [],
    gearImpact: { added: 0, avoided: 0 },
    selectionAudit: null,
    risk: 0,
    riskView: 0,
    exp: 0,
    streak: 0,
    bestStreak: 0,
    events: [],
    eventIndex: 0,
    current: null,
    answers: [],
    ending: null,
    nearEvent: false,
    paused: false,
    player: { x: START_X, d: 0.5, dir: 1, phase: 0, moving: false, pose: 'idle', jump: 0, say: '' },
  };

  /* 繪圖需要、但不屬於遊戲進度的東西 */
  const view = {
    t: 0,
    cam: { x: 400 },
    pan: 0,
    lift: 0,
    flash: 0,
    heroScale: 1,
    shake: { x: 0, y: 0 },
    shakeTime: 0,
    walkTarget: null,
    particles: [],
    decor: world.buildDecor(),
    npcs: world.buildNpcs(),
    npcSpeech: null,
    outfit: null,
    fx: { fog: 0, rain: 0, wind: 0, cold: 0 },
  };
  const allNpcs = view.npcs;

  const input = { keys: new Set(), joy: { x: 0, y: 0 } };
  let bank = [];
  /* 原版流程不出 8 題新增題：它們的條件都依賴山岳、天氣與裝備 */
  let coreBank = [];
  let jumpV = 0;
  let poseTimer = 0;
  let sayTimer = 0;
  let stepClock = 0;
  let currentSection = null;
  let answerLockUntil = 0;
  let lastRiskStep = 0;
  let pendingToast = null;
  let attractPause = 1.2;

  /* 題庫 ---------------------------------------------------------- */
  async function loadBank() {
    state.bankReady = false;
    ui.setLoadState('loading');
    let loaded = [];
    if (location.protocol !== 'file:') {
      try {
        const res = await fetch('data/scenarios.json', { cache: 'no-cache' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        loaded = core.cleanBank(await res.json());
      } catch (err) {
        console.warn('題庫讀取失敗，改用內建題庫：', err.message);
      }
    }
    if (loaded.length) {
      bank = loaded;
      state.bankSource = 'file';
      ui.setLoadState('ok');
    } else {
      bank = core.cleanBank(window.DH_FALLBACK_SCENARIOS);
      state.bankSource = 'fallback';
      ui.setLoadState(bank.length ? 'fallback' : 'error', bank.length);
    }
    coreBank = bank.filter((s) => !prepLogic.isPrepId(s.id));
    state.bankSize = coreBank.length;
    state.bankReady = bank.length > 0;
    await loadPrepData();
  }

  /* 山岳與裝備資料：讀不到或驗證失敗就整包不用，改走原版流程 */
  async function loadPrepData() {
    state.prepReady = false;
    if (classicParam) return;
    if (location.protocol === 'file:') {
      ui.setPrepNotice('直接開啟檔案時讀不到裝備資料，未開啟行前準備，改玩原版模式。用網頁伺服器開啟就能選山打包。');
      return;
    }
    if (state.bankSource !== 'file') return;
    try {
      const get = async (path) => {
        const res = await fetch(path, { cache: 'no-cache' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      };
      const [mountains, gear] = await Promise.all([get('data/mountains.json'), get('data/gear.json')]);
      prepLogic.validateData(mountains, gear, bank);
      prep.init({ mountains, gear, seed: seedValue, handlers: prepHandlers });
      state.prepReady = true;
    } catch (err) {
      console.warn('裝備資料讀取失敗，改用原版模式：', err.message);
      ui.setPrepNotice('裝備資料無法讀取，改玩原版模式：不用選山打包，行前風險為 0。');
    }
  }

  /* 流程 ---------------------------------------------------------- */
  function setScreen(name) {
    state.screen = name;
    ui.setScreen(name);
  }

  function resetPlayer(x) {
    const p = state.player;
    p.x = x;
    p.d = 0.5;
    p.dir = 1;
    p.moving = false;
    p.pose = 'idle';
    p.jump = 0;
    p.say = '';
    jumpV = 0;
    poseTimer = 0;
    sayTimer = 0;
  }

  /* 開始鈕：有裝備資料就進選山，否則是原版模式 */
  function beginFlow() {
    if (!state.bankReady) return false;
    if (state.prepReady) {
      prep.open();
      return true;
    }
    return startGame();
  }

  function playAgain() {
    if (state.trip && state.prepReady) prep.again();
    else startGame();
  }

  function setupTrip(trip) {
    const m = trip.mountain;
    const profile = prepLogic.altitudeProfile(m);
    core.setAltitudeProfile(profile);
    world.applyRoute(view.decor, {
      summit: m.summit_m,
      forestLabel: m.forest_label,
      altitudeAt: core.altitudeAt,
    });
    /* 這些遊憩區不製造常見黑熊的印象 */
    view.npcs = allNpcs.filter((n) => !(n.kind === 'bear' && (m.id === 'qixing' || m.id === 'hehuan')));
    view.outfit = trip.selection;
    const streams = (name) => core.makeRng(core.hash32(trip.seed, m.id, trip.season, trip.tripIndex, trip.nonce, name));
    const ctx = {
      gear: trip.gear,
      weather: prepLogic.tripWeather(trip.actual),
      route: trip.route,
      state: { pack_weight_g: trip.weight },
      season: trip.season,
    };
    const { picked, audit } = prepLogic.selectScenarios(bank, m, ctx, trip.actual, store.data.seen, streams('events'));
    state.selectionAudit = audit;
    const events = core.buildEvents(picked, streams('options'));
    prepLogic.applyVariants(events, m, ctx);
    const lastDay = m.days[1];
    events.forEach((ev) => {
      const s = ev.scenario;
      if (m.overnight && s.stage === 'forest') ev.dayLabel = '第 1 天';
      if (m.overnight && s.stage === 'ridge') ev.dayLabel = `第 ${Math.max(2, Math.ceil(lastDay / 2))} 天`;
      const missing = prepLogic.matchingRules(s.id, ctxAt(trip, s.stage)).filter((r) => r.kind === 'miss');
      if (missing.length) ev.gearNote = `裝備提醒：這趟沒帶${missing.slice(0, 2).map((r) => r.who).join('、')}。`;
    });
    state.events = events;
  }

  function ctxAt(trip, stage) {
    return {
      gear: trip.gear,
      route: trip.route,
      brief: trip.brief,
      here: prepLogic.actualFlags(trip.actual, stage),
    };
  }

  /* trip 由準備流程帶入；不帶就是原版流程，行前風險 0 */
  function startGame(trip) {
    if (!state.bankReady) return false;
    ui.closeModal();
    state.trip = trip && trip.mountain ? trip : null;
    if (state.trip) {
      setupTrip(state.trip);
    } else {
      core.setAltitudeProfile(null);
      world.applyRoute(view.decor, null);
      view.npcs = allNpcs;
      view.outfit = null;
      state.selectionAudit = null;
      state.events = core.buildEvents(core.pickScenarios(coreBank, rng, store.data.seen), rng);
    }
    /* 行前風險只在這裡寫入一次，檢查頁來回不會累加 */
    state.preparation = state.trip ? state.trip.preparation : null;
    state.eventRiskLog = [];
    state.gearImpact = { added: 0, avoided: 0 };
    state.eventIndex = 0;
    state.current = null;
    state.answers = [];
    state.ending = null;
    state.risk = state.trip ? state.preparation.risk : 0;
    state.riskView = state.risk;
    view.fx = { fog: 0, rain: 0, wind: 0, cold: 0 };
    state.exp = 0;
    state.streak = 0;
    state.bestStreak = 0;
    state.nearEvent = false;
    lastRiskStep = 0;
    endingKey = '';
    resetPlayer(START_X);
    view.cam.x = START_X + 80;
    view.pan = 0;
    view.lift = 0;
    view.walkTarget = null;
    view.particles = [];
    view.heroScale = 1;
    world.clearAroundEvents(view.decor, view.npcs, state.events);
    pendingToast = null;
    input.keys.clear();
    currentSection = null;
    store.recordStart();
    setScreen('play');
    resize();
    audio.pop();
    return true;
  }

  function nextEvent() {
    return state.events[state.eventIndex] || null;
  }

  function openEvent(ev) {
    state.current = ev;
    if (!store.data.nearHintDone) {
      store.data.nearHintDone = true;
      store.save();
    }
    view.walkTarget = null;
    view.npcSpeech = null;
    state.player.moving = false;
    state.player.dir = ev.x >= state.player.x ? 1 : -1;
    ui.clearToasts();
    setScreen('card');
    ui.openCard(ev, state.eventIndex, state.events.length);
    audio.pop();
    answerLockUntil = 0;
  }

  function answer(displayIndex) {
    const ev = state.current;
    if (!ev || ev.done || !ev.options[displayIndex]) return false;
    const opt = ev.options[displayIndex];
    const s = ev.scenario;
    ev.done = true;
    ev.correct = opt.correct;
    ev.chosen = displayIndex;
    let result = null;
    if (state.trip) {
      const ctx = ctxAt(state.trip, s.stage);
      result = prepLogic.resolveAnswer(s.id, opt.risk, opt.correct, ctx);
      result.info = prepLogic.describeResult(result);
      if (opt.correct && result.missing.length) {
        result.info.correctTip = `這次判斷正確，行前仍可補強：${result.missing.slice(0, 2).map((r) => r.who).join('、')}。`;
      }
      const actualAdded = Math.min(result.final, 100 - state.risk);
      state.eventRiskLog.push({
        id: s.id, title: s.title, stage: s.stage, base: result.base, mult: result.mult, add: result.add,
        finalRisk: result.final, gearDelta: result.delta, appliedRuleIds: result.applied, actualAdded,
        reasons: result.info.details,
      });
      state.gearImpact.added += Math.max(0, result.delta);
      state.gearImpact.avoided += Math.max(0, -result.delta);
    }
    const gained = result ? result.final : opt.risk;
    state.risk = Math.min(100, state.risk + gained);
    state.answers.push({
      id: s.id,
      category: s.category,
      key: !!s.key,
      title: s.title,
      situation: s.situation,
      chosen: opt.text,
      answer: s.options[s.answer],
      why: s.why,
      sources: s.sources,
      risk: gained,
      correct: opt.correct,
    });
    store.recordAnswer(s.id, opt.correct);

    if (opt.correct) {
      state.exp += 10;
      state.streak++;
      state.bestStreak = Math.max(state.bestStreak, state.streak);
      setPose('cheer', 1.3);
      if (!reducedMotion()) {
        jumpV = 230;
        burstFlowers();
      }
      floatExp(10);
      audio.correct();
      if (state.streak === 3 || state.streak === 5) notify(`連續答對 ${state.streak} 題！`, 'good');
    } else {
      /* 答錯的焦點只留表情與風險條，風險數字已經寫在卡片上 */
      state.streak = 0;
      setPose('stumble', 0.8);
      if (!reducedMotion()) view.shakeTime = 0.18;
      audio.wrong();
      ui.bumpRisk();
    }
    ui.showAnswer(ev, displayIndex, state.risk >= 100, result);
    answerLockUntil = performance.now() + 220;
    announceRisk();
    return true;
  }

  function announceRisk() {
    const step = state.risk >= 80 ? 2 : state.risk >= 50 ? 1 : 0;
    if (step > lastRiskStep && state.risk < 100) {
      notify(step === 2 ? '天色很差，再出錯就得求救了' : '起霧了，風險正在升高', 'warn');
    }
    lastRiskStep = Math.max(lastRiskStep, step);
  }

  /* 卡片開著時先不跳提示，免得蓋住角色；關卡片後再講，同時只留最新一則 */
  function notify(message, kind) {
    if (state.screen === 'card') pendingToast = { message, kind };
    else ui.toast(message, kind);
  }

  function continueAfterAnswer() {
    const ev = state.current;
    if (!ev || !ev.done) return false;
    if (performance.now() < answerLockUntil) return false;
    state.current = null;
    state.eventIndex++;
    if (state.risk >= 100) {
      finish(false);
      return true;
    }
    setScreen('play');
    if (pendingToast) {
      ui.toast(pendingToast.message, pendingToast.kind);
      pendingToast = null;
    }
    return true;
  }

  function finish(completed) {
    const grade = core.gradeFor(state.risk);
    const { fresh, isNewBest } = store.recordEnding({
      risk: state.risk,
      grade,
      completed,
      bestStreak: state.bestStreak,
      bankIds: coreBank.map((s) => s.id),
    });
    state.ending = { completed, risk: state.risk, gradeKey: grade.key, tier: grade.tier, title: grade.title };
    state.current = null;
    view.walkTarget = null;
    /* 結局要讓插畫、成績與徽章先被看見 */
    pendingToast = null;
    ui.clearToasts();
    view.particles = [];
    state.player.say = '';
    setScreen('ending');
    ui.showEnding({
      grade,
      risk: state.risk,
      answers: state.answers,
      totalEvents: state.events.length,
      exp: state.exp,
      best: store.data.best,
      freshBadges: fresh,
      isNewBest,
      trip: tripEnding(completed),
      keyConcepts: state.events.filter((ev) => ev.scenario.key).map((ev) => ({
        id: ev.scenario.id,
        concept: ev.scenario.keyConcept,
        title: ev.scenario.title,
        status: !ev.done ? 'skip' : ev.correct ? 'ok' : 'ng',
      })),
    });
    sizeEndingCanvas();
    if (grade.tier === 'bad') audio.siren();
    else audio.fanfare();
  }

  /* 結局卡片要用的摘要；對帳 preparation.risk + Σ actualAdded = state.risk */
  function tripEnding(completed) {
    const trip = state.trip;
    if (!trip) return null;
    const p = state.preparation;
    const log = state.eventRiskLog;
    const eventTotal = log.reduce((sum, r) => sum + r.actualAdded, 0);
    const rows = log.filter((r) => r.finalRisk > 0 && r.appliedRuleIds.length).map((r) => {
      const main = r.gearDelta === 0 ? `原 ${r.base} → 本次 ${r.finalRisk}（無差異）`
        : r.gearDelta > 0 ? `原 ${r.base} → 本次 ${r.finalRisk}（缺裝 +${r.gearDelta}）`
          : `原 ${r.base} → 本次 ${r.finalRisk}（備援 −${-r.gearDelta}）`;
      const cut = r.actualAdded < r.finalRisk ? `；已到上限，實際只加 ${r.actualAdded}` : '';
      return { id: r.id, title: r.title, text: main + cut };
    });
    const index = prep.index;
    const sel = trip.selection;
    const names = prepLogic.selectedIds(sel).map((id) => index[id].name);
    return {
      summary: `${trip.mountain.name}｜${prepLogic.seasonName(trip.season)}｜行前風險 ${p.risk}｜累積風險 ${Math.round(state.risk)}｜${completed ? '完成下山' : '提前求援'}`,
      preparation: p,
      improvements: p.findings.filter((x) => x.hit).sort((a, b) => b.points - a.points).slice(0, 3).map((x) => x.text),
      gearText: `${names.join('、')}（可選物估重 ${(trip.weight / 1000).toFixed(1)} 公斤）`,
      impact: state.gearImpact,
      log: rows,
      eventTotal,
      risk: Math.round(state.risk),
    };
  }

  function interact() {
    if (state.screen === 'card') {
      if (state.current && state.current.done) continueAfterAnswer();
      return;
    }
    if (state.screen !== 'play') return;
    const ev = nextEvent();
    if (ev && Math.abs(ev.x - state.player.x) < HINT_RANGE) {
      openEvent(ev);
    } else {
      say(ev ? '前面還有路，繼續走吧' : '往終點牌樓走吧！', 1.5);
    }
  }

  /* 小動作與回饋 ------------------------------------------------------ */
  function setPose(name, seconds) {
    state.player.pose = name;
    poseTimer = seconds;
  }
  function say(text, seconds) {
    state.player.say = text;
    sayTimer = seconds;
  }

  function doAction(name) {
    if (state.screen !== 'play') return;
    if (name === 'wave') {
      setPose('wave', 1.3);
      say('嗨～山友！', 1.4);
      audio.pop();
    } else if (name === 'drink') {
      setPose('drink', 1.5);
      say('補水休息一下', 1.6);
      audio.pop();
    } else if (name === 'photo') {
      setPose('photo', 1.1);
      say('喀嚓！記下這片風景', 1.6);
      view.flash = reducedMotion() ? 0 : 0.7;
      audio.shutter();
    }
  }

  function burstFlowers() {
    const p = state.player;
    const y = layout ? world.playerY(layout, p.x, p.d) - 74 : 0;
    const colors = ['#ffb1c4', '#ffd965', '#ffffff', '#c9b6f2', '#ffc78f'];
    for (let i = 0; i < 8; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 50 + Math.random() * 90;
      view.particles.push({
        kind: 'flower', x: p.x, y,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 110,
        g: 340, r: 3.5 + Math.random() * 3, rot: Math.random() * 6,
        color: colors[i % colors.length], life: 0.8 + Math.random() * 0.4,
      });
    }
  }

  const EXP_LIFE = 1.1;
  const EXP_RISE = 24;
  const EXP_MERGE = 0.6;

  /* 同類經驗值 600ms 內合併成一則，從頭頂上浮約 24px 後淡出 */
  function floatExp(amount) {
    const p = state.player;
    const y = layout ? world.playerY(layout, p.x, p.d) - (HERO_H + 16) * view.heroScale : 0;
    const vy = reducedMotion() ? 0 : -EXP_RISE / EXP_LIFE / (layout ? layout.z : 1);
    const prev = view.particles.find((q) => q.kind === 'text' && EXP_LIFE - q.life < EXP_MERGE);
    if (prev) {
      prev.amount += amount;
      prev.text = `+${prev.amount} 經驗`;
      Object.assign(prev, { x: p.x, y, vy, life: EXP_LIFE });
      return;
    }
    view.particles.push({
      kind: 'text', amount, text: `+${amount} 經驗`, color: '#237a45', size: 20,
      x: p.x, y, vx: 0, vy, g: 0, rot: 0, life: EXP_LIFE,
    });
  }

  /* 更新 ---------------------------------------------------------- */
  function moveVector() {
    const k = input.keys;
    let x = (k.has('right') ? 1 : 0) - (k.has('left') ? 1 : 0);
    let y = (k.has('down') ? 1 : 0) - (k.has('up') ? 1 : 0);
    if (x || y) {
      const n = Math.hypot(x, y);
      return { x: x / n, y: y / n };
    }
    if (input.joy.x || input.joy.y) return input.joy;
    return null;
  }

  function updatePlayer(dt) {
    const p = state.player;
    const vec = moveVector();
    let vx = 0;
    let vy = 0;
    if (vec) {
      view.walkTarget = null;
      vx = vec.x * SPEED;
      vy = vec.y * SPEED * 0.62;
    } else if (view.walkTarget) {
      const dx = view.walkTarget.x - p.x;
      const dy = (view.walkTarget.d - p.d) * world.PATH_H;
      const dist = Math.hypot(dx, dy);
      if (dist < 7) {
        view.walkTarget = null;
      } else {
        vx = (dx / dist) * SPEED;
        vy = (dy / dist) * SPEED;
      }
    }
    const speed = Math.hypot(vx, vy);
    p.moving = speed > 1;
    if (p.moving) {
      p.x = clamp(p.x + vx * dt, 30, MAX_X);
      p.d = clamp(p.d + (vy * dt) / world.PATH_H, 0, 1);
      if (Math.abs(vx) > 6) p.dir = vx > 0 ? 1 : -1;
      p.phase += dt * (5 + (speed / SPEED) * 6.5);
      if (p.pose !== 'cheer' && p.pose !== 'stumble') {
        p.pose = 'idle';
        poseTimer = 0;
      }
      stepClock -= dt;
      if (stepClock <= 0) {
        stepClock = 0.31;
        audio.step();
      }
      view.pan *= Math.pow(0.02, dt);
    }
  }

  function updateEvents() {
    const p = state.player;
    const ev = nextEvent();
    state.nearEvent = false;
    if (ev) {
      const dist = Math.abs(ev.x - p.x);
      state.nearEvent = dist < HINT_RANGE;
      if (dist < AUTO_RANGE) {
        openEvent(ev);
        return;
      }
      const touch = document.body.classList.contains('touch');
      ui.setNearEvent(state.nearEvent, touch, !!store.data.nearHintDone);
    } else {
      const left = FINISH_X - p.x;
      ui.setInteractLabel(false);
      ui.setPrompt(left < 500 && left > 0 ? '平安下山牌樓就在前面！' : null);
      if (p.x >= FINISH_X) finish(true);
    }
  }

  function updateNpcSpeech() {
    const p = state.player;
    let found = null;
    for (const n of view.npcs) {
      if (Math.abs(n.x - p.x) < 130) { found = n; break; }
    }
    view.npcSpeech = found;
  }

  function updateSection() {
    const sec = core.sectionAt(state.player.x);
    if (sec !== currentSection) {
      if (currentSection && state.screen === 'play') {
        /* 區域名稱與海拔已在 HUD 上，換區時讓那裡亮一下就好 */
        ui.flashStage();
        audio.jingle();
      }
      audio.setAmbience(sec.key);
      currentSection = sec;
    }
  }

  function updateCommon(dt) {
    const p = state.player;
    view.t += dt;
    state.riskView += (state.risk - state.riskView) * Math.min(1, dt * 2.6);

    if (poseTimer > 0) {
      poseTimer -= dt;
      if (poseTimer <= 0) p.pose = 'idle';
    }
    if (sayTimer > 0) {
      sayTimer -= dt;
      if (sayTimer <= 0) p.say = '';
    }
    if (jumpV !== 0 || p.jump > 0) {
      p.jump += jumpV * dt;
      jumpV -= 980 * dt;
      if (p.jump <= 0) {
        jumpV = 0;
        p.jump = 0;
      }
    }

    if (view.shakeTime > 0) {
      view.shakeTime = Math.max(0, view.shakeTime - dt);
      const m = view.shakeTime * 11;
      view.shake.x = Math.sin(view.t * 62) * m;
      view.shake.y = Math.cos(view.t * 49) * m * 0.55;
    } else {
      view.shake.x = 0;
      view.shake.y = 0;
    }
    if (view.flash > 0) view.flash = Math.max(0, view.flash - dt * 2.6);

    for (let i = view.particles.length - 1; i >= 0; i--) {
      const q = view.particles[i];
      q.life -= dt;
      if (q.life <= 0) {
        view.particles.splice(i, 1);
        continue;
      }
      /* 浮字跟著角色，不會留在原地或被夾到畫面邊緣 */
      if (q.kind === 'text') q.x = p.x;
      q.vy += q.g * dt;
      q.x += q.vx * dt;
      q.y += q.vy * dt;
      q.rot += dt * 3;
    }

    if (layout) {
      if (state.screen === 'start' || state.screen === 'loading' || state.screen === 'prep') {
        /* 首頁是固定構圖，鏡頭位置在 startLayout() 算好 */
        view.cam.x = layout.camX;
        view.lift = 0;
        view.heroScale = 1;
        return;
      }
      const cardRect = state.screen === 'card' ? document.getElementById('card').getBoundingClientRect() : null;
      /* 寬螢幕：把登山客移到卡片旁邊。窄螢幕放不下，改把場景往上抬。 */
      const beside = cardRect && cardRect.left >= 130;
      let target;
      if (beside) {
        /* 卡片外空位夠大時，角色靠外側站、面向路標，兩者都留在空位內；
           空位小（手機橫式）只放得下角色，就置中 */
        const free = cardRect.left / layout.z;
        const facingLeft = state.current && state.current.x < p.x;
        const heroAt = free >= 300 ? free * (facingLeft ? 0.8 : 0.2) : free / 2;
        target = p.x - heroAt + layout.vw / 2;
      } else {
        target = p.x + p.dir * Math.min(120, layout.vw * 0.12) + view.pan;
      }
      const lo = layout.vw * 0.3;
      const hi = FINISH_X + 260;
      view.cam.x += (clamp(target, lo, hi) - view.cam.x) * Math.min(1, dt * 4.5);

      let liftTarget = 0;
      let scaleTarget = 1;
      if (cardRect && !beside) {
        /* 腳底離卡片至少 12px、帽頂離 HUD 8px；擠不下就先縮小角色 */
        const z = layout.z;
        const feetY = (world.playerY(layout, p.x, p.d) + 6) * z;
        const topLimit = document.getElementById('hud').getBoundingClientRect().bottom + 8;
        const natural = HERO_H * (0.92 + p.d * 0.12) * z;
        const room = cardRect.top - 12 - topLimit;
        scaleTarget = clamp(room / natural, 0.58, 1);
        const headY = feetY - natural * scaleTarget;
        const over = feetY - (cardRect.top - 12);
        liftTarget = clamp(over, 0, Math.max(0, headY - topLimit)) / z;
      }
      view.lift += (liftTarget - view.lift) * Math.min(1, dt * 5);
      view.heroScale += (scaleTarget - view.heroScale) * Math.min(1, dt * 5);
    }
  }

  /* 首頁：在牌樓與告示牌之間來回走，也順便展示左右朝向 */
  function updateAttract(dt) {
    const p = state.player;
    if (reducedMotion()) {
      p.moving = false;
      return;
    }
    if (attractPause > 0) {
      attractPause -= dt;
      p.moving = false;
      return;
    }
    p.moving = true;
    p.phase += dt * 8;
    p.x += p.dir * dt * 54;
    if (p.x >= ATTRACT.hi || p.x <= ATTRACT.lo) {
      p.x = clamp(p.x, ATTRACT.lo, ATTRACT.hi);
      p.dir = -p.dir;
      attractPause = 1.6;
    }
  }

  /* 山名、季節與天氣要看得見：HUD 一行字，場景的霧、雨、風與冷色調跟著路段變化 */
  function updateTripWeather(dt, stage) {
    const trip = state.trip;
    if (!trip) {
      ui.setTripHud('');
      return;
    }
    const a = trip.actual;
    const here = prepLogic.actualFlags(a, stage);
    const exposed = stage === 'ridge' || stage === 'summit';
    const target = {
      fog: here.fog ? 1 : 0,
      rain: here.wet ? 1 : 0,
      wind: here.strong_wind && exposed ? 1 : 0,
      cold: here.cold ? 1 : 0,
    };
    Object.keys(target).forEach((k) => {
      view.fx[k] += (target[k] - view.fx[k]) * Math.min(1, dt * 1.4);
    });
    const words = [];
    if (here.thunder) words.push('雷雨');
    else if (here.wet) words.push('下雨');
    if (here.fog) words.push('濃霧');
    if (here.strong_wind && exposed) words.push('強風');
    if (here.ice) words.push('結冰');
    if (!words.length) words.push(here.cold ? '偏冷' : '天氣穩定');
    const [lo, hi] = prepLogic.stageTemp(a, stage);
    ui.setTripHud(`${trip.mountain.name}｜${prepLogic.seasonName(trip.season)}｜${words.join('・')}｜約 ${Math.round(lo)}～${Math.round(hi)}°C`);
  }

  function update(dt) {
    updateCommon(dt);
    if (state.screen === 'play') {
      updatePlayer(dt);
      updateNpcSpeech();
      updateSection();
      updateEvents();
    } else if (state.screen === 'start' || state.screen === 'loading') {
      updateAttract(dt);
    } else if (state.screen === 'prep') {
      prep.tick(artTime());
    }
    if (state.screen === 'play' || state.screen === 'card') {
      const p = state.player;
      const sec = core.sectionAt(p.x);
      updateTripWeather(dt, sec.key);
      const m = state.trip && state.trip.mountain;
      const name = m && sec.key === 'forest' ? m.forest_label : sec.name;
      ui.updateHud(p.x, core.altitudeAt(p.x), name, state.riskView, m ? m.summit_m : 0);
    }
  }

  /* 繪製 ---------------------------------------------------------- */
  function resize() {
    const w = Math.max(1, canvas.clientWidth);
    const h = Math.max(1, canvas.clientHeight);
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    layout = state.screen === 'start' || state.screen === 'loading' || state.screen === 'prep' ? startLayout(w, h) : world.makeLayout(w, h);
    sizeEndingCanvas();
    needsRedraw = true;
    if (state.screen === 'prep') prep.onResize();
  }

  /* 首頁構圖：
     - 卡片在左：場景從卡片右緣開始，小屋、牌樓、告示牌都不被遮
     - 卡片在上（手機）：牌樓與角色緊接在卡片下方，近景花草補滿下半部 */
  function startLayout(w, h) {
    const card = document.querySelector('.start-card').getBoundingClientRect();
    const SCENE_LEFT = 62;
    const SCENE_SPAN = 960; /* 含告示牌與右側山友，兩者都留安全邊距 */
    if (card.width > w * 0.6) {
      const z = clamp(w / 390, 0.75, 1.2);
      const legal = document.getElementById('legal').offsetHeight;
      const basePx = Math.min(card.bottom + 24 + 166 * z, h - legal - 128 * z);
      return world.makeLayout(w, h, { z, basePx, camX: 660 });
    }
    const gap = 16;
    const z = clamp((w - card.right - gap) / SCENE_SPAN, 0.55, 1.05);
    const left = SCENE_LEFT - (card.right + gap) / z;
    return world.makeLayout(w, h, { z, camX: left + w / z / 2 });
  }

  function sizeEndingCanvas() {
    if (state.screen !== 'ending') return;
    const w = Math.max(1, endingCanvas.clientWidth);
    const h = Math.max(1, endingCanvas.clientHeight);
    endingCanvas.width = Math.round(w * dpr);
    endingCanvas.height = Math.round(h * dpr);
    endingKey = `${w}x${h}`;
  }

  function drawScene() {
    ctx.setTransform(dpr * layout.z, 0, 0, dpr * layout.z, 0, 0);
    world.render(ctx, layout, {
      t: artTime(),
      cam: view.cam,
      lift: view.lift,
      heroScale: view.heroScale,
      bottomSafe: document.getElementById('legal').offsetHeight / layout.z,
      shake: view.shake,
      flash: view.flash,
      riskView: state.riskView,
      decor: view.decor,
      npcs: view.npcs,
      events: state.events,
      eventIndex: state.eventIndex,
      nearEvent: state.nearEvent && state.screen === 'play',
      player: state.player,
      walkTarget: view.walkTarget,
      particles: view.particles,
      npcSpeech: state.screen === 'play' && !state.player.say ? view.npcSpeech : null,
      topSafe: (document.getElementById('hud').getBoundingClientRect().bottom + 22) / layout.z,
      outfit: view.outfit,
      fx: view.fx,
    });
  }

  function drawEnding() {
    if (!state.ending) return;
    const w = endingCanvas.clientWidth;
    const h = endingCanvas.clientHeight;
    if (!w || !h) return;
    if (endingKey !== `${w}x${h}`) sizeEndingCanvas();
    endingCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    art.viewZ = 1;
    art.endings[state.ending.tier](endingCtx, w, h, artTime());
  }

  /* 結局畫面蓋住場景時不用重畫，省電 */
  let needsRedraw = true;
  let rafId = 0;
  let lastTime = 0;

  function frame(now) {
    rafId = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - lastTime) / 1000 || 0);
    lastTime = now;
    if (!layout) return;
    update(dt);
    if (state.screen === 'ending') {
      if (needsRedraw) {
        drawScene();
        needsRedraw = false;
      }
      drawEnding();
    } else {
      drawScene();
    }
  }

  function setPaused(paused) {
    if (paused === state.paused) return;
    state.paused = paused;
    if (paused) {
      cancelAnimationFrame(rafId);
      input.keys.clear();
      audio.suspend();
    } else {
      lastTime = performance.now();
      rafId = requestAnimationFrame(frame);
      audio.resume();
    }
  }

  /* 輸入 ---------------------------------------------------------- */
  const KEY_DIRS = {
    ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down',
    KeyA: 'left', KeyD: 'right', KeyW: 'up', KeyS: 'down',
  };
  const NUM_KEYS = { Digit1: 0, Digit2: 1, Digit3: 2, Numpad1: 0, Numpad2: 1, Numpad3: 2 };
  const ACTIONS = ['wave', 'drink', 'photo'];

  function toggleSound() {
    const on = !audio.enabled;
    if (audio.setEnabled(on)) {
      ui.setSound(on);
      if (on) {
        audio.setAmbience(core.sectionAt(state.player.x).key);
        setTimeout(() => audio.pop(), 60);
      }
    }
  }

  window.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (ui.modalOpen) {
      if (e.code === 'Escape') ui.closeModal();
      return;
    }
    if (e.code === 'KeyM' && !e.repeat) toggleSound();

    if (state.screen === 'card') {
      const ev = state.current;
      if (KEY_DIRS[e.code]) input.keys.add(KEY_DIRS[e.code]);
      if (ev && !ev.done && e.code in NUM_KEYS && !e.repeat) {
        e.preventDefault();
        answer(NUM_KEYS[e.code]);
      } else if (ev && ev.done && !e.repeat && (e.code === 'KeyE' || e.code === 'Space' || e.code === 'Enter')) {
        e.preventDefault();
        continueAfterAnswer();
      }
      return;
    }
    if (state.screen !== 'play') return;

    if (KEY_DIRS[e.code]) {
      input.keys.add(KEY_DIRS[e.code]);
      view.walkTarget = null;
      e.preventDefault();
    } else if ((e.code === 'KeyE' || e.code === 'Space') && !e.repeat) {
      e.preventDefault();
      interact();
    } else if (e.code in NUM_KEYS && !e.repeat) {
      doAction(ACTIONS[NUM_KEYS[e.code]]);
    }
  });
  window.addEventListener('keyup', (e) => {
    if (KEY_DIRS[e.code]) input.keys.delete(KEY_DIRS[e.code]);
  });
  window.addEventListener('blur', () => {
    input.keys.clear();
    releaseJoy();
  });

  /* 點地面走過去、拖曳看周圍 */
  const drag = { id: null, x: 0, y: 0, moved: false, startPan: 0 };
  canvas.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'touch') document.body.classList.add('touch');
    if (state.screen !== 'play') return;
    drag.id = e.pointerId;
    drag.x = e.clientX;
    drag.y = e.clientY;
    drag.moved = false;
    drag.startPan = view.pan;
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x;
    if (!drag.moved && Math.hypot(dx, e.clientY - drag.y) > 10) drag.moved = true;
    if (drag.moved) view.pan = clamp(drag.startPan - dx / layout.z, -700, 700);
  });
  function endDrag(e) {
    if (e.pointerId !== drag.id) return;
    drag.id = null;
    if (e.type !== 'pointerup' || drag.moved || state.screen !== 'play') return;
    const left = view.cam.x - layout.vw / 2;
    const wx = clamp(e.clientX / layout.z + left, 30, MAX_X);
    const wy = e.clientY / layout.z + view.lift;
    const top = world.pathTop(layout, wx);
    const d = clamp((wy - top - 16) / (world.PATH_H - 32), 0, 1);
    view.walkTarget = { x: wx, d };
    view.pan = 0;
  }
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);

  /* 虛擬搖桿 */
  const joy = document.getElementById('joy');
  const knob = document.getElementById('joy-knob');
  let joyId = null;
  function joyMove(e) {
    const r = joy.getBoundingClientRect();
    const max = r.width * 0.36;
    let dx = e.clientX - (r.left + r.width / 2);
    let dy = e.clientY - (r.top + r.height / 2);
    const len = Math.hypot(dx, dy);
    if (len > max) {
      dx = (dx / len) * max;
      dy = (dy / len) * max;
    }
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
    const nx = dx / max;
    const ny = dy / max;
    const dead = Math.hypot(nx, ny) < 0.14;
    input.joy.x = dead ? 0 : nx;
    input.joy.y = dead ? 0 : ny;
  }
  function releaseJoy() {
    joyId = null;
    input.joy.x = 0;
    input.joy.y = 0;
    knob.style.transform = '';
  }
  joy.addEventListener('pointerdown', (e) => {
    joyId = e.pointerId;
    joy.setPointerCapture(e.pointerId);
    joyMove(e);
    e.preventDefault();
  });
  joy.addEventListener('pointermove', (e) => {
    if (e.pointerId === joyId) joyMove(e);
  });
  joy.addEventListener('pointerup', releaseJoy);
  joy.addEventListener('pointercancel', releaseJoy);

  /* 分享 ---------------------------------------------------------- */
  async function share() {
    const end = state.ending;
    if (!end) return;
    const where = state.trip ? `走了一趟${state.trip.mountain.name}` : '走完一趟山徑';
    const text = `我在《數位登山》${where}，稱號是「${end.title}」，出事風險 ${Math.round(end.risk)}%。你也來試試自己的登山判斷！`;
    const url = location.href.split('?')[0];
    if (navigator.share) {
      try {
        await navigator.share({ title: '數位登山', text, url });
      } catch (e) { /* 使用者取消分享 */ }
      return;
    }
    try {
      await navigator.clipboard.writeText(`${text} ${url}`);
      ui.toast('已複製分享文字', 'good');
    } catch (e) {
      ui.toast('這個瀏覽器無法複製，手動截圖分享吧', 'warn');
    }
  }

  /* 測試鉤子 -------------------------------------------------------- */
  const GRADE_RISK = { good: 10, normal: 60, bad: 100 };

  window.__game = {
    state,
    view,
    store,
    rng,
    prep,
    logic: prepLogic,
    getBank: () => bank,
    startGame: () => startGame(),
    teleportToNextEvent() {
      const ev = nextEvent();
      if (!ev || state.screen !== 'play') return null;
      state.player.x = ev.x - 110;
      view.walkTarget = null;
      return ev.scenario.id;
    },
    teleportToFinish() {
      if (state.screen !== 'play') return false;
      state.player.x = FINISH_X - 60;
      view.walkTarget = null;
      return true;
    },
    triggerNextEvent() {
      const ev = nextEvent();
      if (!ev || state.screen !== 'play') return null;
      state.player.x = ev.x - 60;
      openEvent(ev);
      return ev.scenario.id;
    },
    /* i 是畫面上的選項順序（洗牌後），可搭配 correctIndex() 使用 */
    answer,
    correctIndex() {
      return state.current ? state.current.options.findIndex((o) => o.correct) : -1;
    },
    wrongIndex() {
      return state.current ? state.current.options.findIndex((o) => !o.correct) : -1;
    },
    continue() {
      answerLockUntil = 0;
      return continueAfterAnswer();
    },
    /* 不帶參數：以目前風險直接結束。可帶 'good'｜'normal'｜'bad' 或數字指定風險。 */
    skipToEnding(what) {
      if (state.screen === 'start' || state.screen === 'loading' || state.screen === 'prep') startGame();
      if (typeof what === 'number') state.risk = clamp(what, 0, 100);
      else if (what in GRADE_RISK) state.risk = GRADE_RISK[what];
      state.riskView = state.risk;
      finish(state.risk < 100);
      return state.ending;
    },
  };

  /* 準備流程的進出與出發 */
  const prepHandlers = {
    enter() {
      setScreen('prep');
      resize();
    },
    exit() {
      setScreen('start');
      resize();
      view.cam.x = layout.camX;
    },
    launch(trip) {
      startGame(trip);
    },
    tapSound() {
      audio.pop();
    },
    artTime,
  };

  /* 啟動 ---------------------------------------------------------- */
  ui.init({
    start: beginFlow,
    again: playAgain,
    mountains() {
      if (state.prepReady) prep.toMountains();
    },
    retryLoad: () => loadBank().then(resize),
    share,
    next: () => continueAfterAnswer(),
    answer,
    interact,
    action: doAction,
    toggleSound,
    bankSize: () => bank.length,
    modalChange() {
      input.keys.clear();
      releaseJoy();
    },
  });

  if (matchMedia('(pointer: coarse)').matches) document.body.classList.add('touch');

  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', resize);
  document.addEventListener('visibilitychange', () => setPaused(document.hidden));

  setScreen('start');
  state.screen = 'loading';
  resetPlayer(ATTRACT.lo + 60);
  state.player.d = 0.55;
  resize();
  view.cam.x = layout.camX;
  rafId = requestAnimationFrame(frame);
  loadBank().then(() => {
    if (state.screen === 'loading') state.screen = 'start';
    /* 載入失敗的提示會把卡片撐高，重算首頁構圖 */
    resize();
  });

})();
