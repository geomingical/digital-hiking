/* 出發前準備的畫面流程：選山 → 季節與預報 → 換裝打包 → 裝備檢查 → 出發。 */
(function () {
  const DH = window.DH;
  const L = DH.prepLogic;
  const GA = DH.gearArt;
  const NOTICE = '遊戲模擬預報，非即時資料；預報可能改變';
  const STEPS = [
    { key: 'mountain', title: '選一座山' },
    { key: 'forecast', title: '季節與天氣簡報' },
    { key: 'gear', title: '換裝與打包' },
    { key: 'check', title: '裝備檢查總結' },
  ];
  const HAZARD_NAMES = { thunder: '午後雷陣雨', front: '鋒面', typhoon: '颱風外圍', fog: '濃霧', ice: '結冰', gust: '強陣風' };
  const ICON = {
    temp: '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M10 5a2 2 0 0 1 4 0v9.3a4 4 0 1 1-4 0z" fill="#fff5ef" stroke="#d96f3e" stroke-width="2"/><circle cx="12" cy="17.6" r="2.2" fill="#d96f3e"/></svg>',
    rain: '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M12 3c4 5 6 8 6 11a6 6 0 0 1-12 0c0-3 2-6 6-11z" fill="#8fc8ea"/></svg>',
    wind: '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M3 9h11a3 3 0 1 0-3-3M3 14h15a3 3 0 1 1-3 3" fill="none" stroke="#6f93a8" stroke-width="2.2" stroke-linecap="round"/></svg>',
    alert: '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M12 3 2.5 20h19z" fill="#f4c34a"/><path d="M12 9v5.5" stroke="#5a4a2a" stroke-width="2.2" stroke-linecap="round"/><circle cx="12" cy="17.2" r="1.3" fill="#5a4a2a"/></svg>',
  };

  const $ = (id) => document.getElementById(id);
  const el = (tag, cls, txt) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (txt !== undefined) n.textContent = txt;
    return n;
  };
  const button = (cls, txt, fn) => {
    const b = el('button', cls, txt);
    b.type = 'button';
    if (fn) b.addEventListener('click', fn);
    return b;
  };
  const round = (v) => Math.round(v);
  const range = (pair) => `${round(pair[0])}～${round(pair[1])}°C`;
  const meters = (m) => `約 ${m.toLocaleString('en-US')} 公尺`;
  const stars = (n) => `${'★'.repeat(n)}${'☆'.repeat(5 - n)}`;

  /* 依 CSS 尺寸設好 canvas，回傳可直接用 CSS 座標畫圖的 context */
  function fitCanvas(cv, w, h) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = Math.round(w * dpr);
    cv.height = Math.round(h * dpr);
    const c = cv.getContext('2d');
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    return c;
  }
  function iconCanvas(id, size) {
    const cv = el('canvas', 'gear-icon');
    cv.style.width = `${size}px`;
    cv.style.height = `${size}px`;
    cv.setAttribute('aria-hidden', 'true');
    GA.drawIcon(fitCanvas(cv, size, size), id, size / 2, size / 2, size * 0.86);
    return cv;
  }

  const prep = {
    data: null,
    handlers: {},
    index: null,
    seed: 0,
    tripIndex: 0,
    step: 'mountain',
    mountainId: null,
    activeMountain: null,
    seasonChoice: null,
    season: null,
    nonce: 0,
    forecast: null,
    actual: null,
    selection: L.emptySelection(),
    tab: 'wear',
    whyOpen: false,
    launched: false,
    preview: null,

    init({ mountains, gear, seed, handlers }) {
      this.data = { mountains, gear };
      this.index = L.makeItemIndex(gear);
      this.seed = seed;
      this.handlers = handlers;
      this.step = 'mountain';
    },

    get mountain() {
      return this.data.mountains.mountains.find((m) => m.id === this.mountainId) || null;
    },
    get brief() {
      return this.forecast ? L.briefFlags(this.mountain, this.forecast) : null;
    },
    context() {
      const brief = this.brief;
      return {
        gear: L.gearFlags(this.selection, this.index, this.mountain, brief),
        weather: brief,
        route: this.mountain.route_flags,
        state: { pack_weight_g: L.packWeight(this.selection, this.index) },
      };
    },
    assessment() {
      return L.assessPreparation(this.data.gear, this.context());
    },

    /* 流程 ---------------------------------------------------------- */
    open() {
      this.step = 'mountain';
      this.launched = false;
      this.handlers.enter();
      this.render();
    },
    go(step) {
      this.step = step;
      this.render();
    },
    back() {
      const i = STEPS.findIndex((s) => s.key === this.step);
      if (i === 0) {
        this.handlers.exit();
        return;
      }
      this.go(STEPS[i - 1].key);
    },
    /* 再走一趟：同一份清單，換新的 tripIndex 與預報 */
    again() {
      this.tripIndex++;
      this.nonce = 0;
      this.launched = false;
      if (this.seasonChoice) this.rollForecast();
      this.step = 'forecast';
      this.handlers.enter();
      this.render();
    },
    toMountains() {
      this.tripIndex++;
      this.nonce = 0;
      this.launched = false;
      this.forecast = null;
      this.actual = null;
      this.seasonChoice = null;
      this.mountainId = null;
      this.activeMountain = null;
      /* 重新選山就是新的一趟，從家居服重新穿 */
      this.selection = L.emptySelection();
      this.open();
    },

    selectMountain(id) {
      this.activeMountain = id;
      if (id !== this.mountainId) {
        /* 換山要重做簡報；已經選的配裝先留著，不用重穿 */
        this.mountainId = id;
        this.seasonChoice = null;
        this.season = null;
        this.forecast = null;
        this.actual = null;
        this.nonce = 0;
      }
      this.render();
    },

    rollForecast() {
      const m = this.mountain;
      this.season = this.seasonChoice === 'random'
        ? L.pickSeason(this.seed, m.id, this.tripIndex, this.nonce)
        : this.seasonChoice;
      this.forecast = L.generateForecast(m, this.season, this.seed, this.tripIndex, this.nonce);
      this.actual = L.generateActual(m, this.forecast, this.seed, this.tripIndex, this.nonce);
    },
    chooseSeason(key) {
      if (key === this.seasonChoice && this.forecast) return;
      this.seasonChoice = key;
      this.nonce = 0;
      this.rollForecast();
      this.render();
    },
    reroll() {
      this.nonce++;
      this.rollForecast();
      this.render();
    },
    undecided() {
      return L.undecidedSlots(this.selection, this.data.gear);
    },
    postponed() {
      return this.forecast ? L.postponeReasons(this.forecast) : [];
    },

    setSingle(slot, id) {
      this.selection[slot] = id;
      this.refreshGear(true);
    },
    togglePack(id) {
      const p = this.selection.pack;
      const i = p.indexOf(id);
      if (i >= 0) p.splice(i, 1);
      else p.push(id);
      this.refreshGear(true);
    },
    applyRecommended() {
      this.selection = L.recommendedSelection(this.mountain, this.brief);
      this.refreshGear(true);
    },

    confirm() {
      if (this.launched || this.postponed().length || !this.forecast || this.undecided().length) return false;
      this.launched = true;
      const ctx = this.context();
      const preparation = Object.assign(this.assessment(), { confirmed: true });
      this.handlers.launch({
        seed: this.seed,
        tripIndex: this.tripIndex,
        nonce: this.nonce,
        mountain: this.mountain,
        season: this.season,
        forecast: this.forecast,
        actual: this.actual,
        brief: this.brief,
        selection: JSON.parse(JSON.stringify(this.selection)),
        gear: ctx.gear,
        route: ctx.route,
        weight: ctx.state.pack_weight_g,
        preparation,
      });
      return true;
    },

    /* 繪製骨架 ------------------------------------------------------ */
    render() {
      const panel = $('prep-panel');
      /* 同一步重畫（選山、抽預報）不把捲動位置拉回頂端 */
      const oldBody = $('prep-body');
      const keep = panel.dataset.step === this.step && oldBody ? oldBody.scrollTop : 0;
      panel.textContent = '';
      panel.dataset.step = this.step;
      this.preview = null;
      const i = STEPS.findIndex((s) => s.key === this.step);
      const head = el('header', 'prep-head');
      head.appendChild(button('btn btn-small prep-back', i === 0 ? '‹ 回首頁' : '‹ 上一步', () => this.back()));
      const title = el('div', 'prep-title');
      title.appendChild(el('span', 'prep-step', `第 ${i + 1} 步／共 ${STEPS.length} 步`));
      title.appendChild(el('h2', '', STEPS[i].title));
      head.appendChild(title);
      const dots = el('ol', 'prep-dots');
      dots.setAttribute('aria-hidden', 'true');
      STEPS.forEach((s, k) => dots.appendChild(el('li', k === i ? 'on' : k < i ? 'done' : '')));
      head.appendChild(dots);
      panel.appendChild(head);
      const body = el('div', 'prep-body');
      body.id = 'prep-body';
      const foot = el('footer', 'prep-foot');
      foot.id = 'prep-foot';
      panel.appendChild(body);
      panel.appendChild(foot);
      this[`render_${this.step}`](body, foot);
      body.scrollTop = keep;
    },

    /* 視窗或手機方向改變時，依新尺寸重畫插圖 */
    onResize() {
      if (this.step === 'gear' && $('gear-preview')) this.refreshGear(false);
      else if (this.data) this.render();
    },

    /* 第 1 步：選山 --------------------------------------------------- */
    render_mountain(body, foot) {
      const list = this.data.mountains.mountains;
      if (!this.activeMountain) this.activeMountain = this.mountainId || list[0].id;
      const chips = el('div', 'mtn-chips');
      chips.setAttribute('role', 'tablist');
      list.forEach((m) => {
        /* on 只代表正在瀏覽；真的選了這座山才有勾 */
        const isPicked = m.id === this.mountainId;
        const b = button(`mtn-chip ${m.id === this.activeMountain ? 'on' : ''} ${isPicked ? 'picked' : ''}`, `${isPicked ? '✓ ' : ''}${m.name.replace('主峰', '')}`, () => {
          this.activeMountain = m.id;
          this.render();
        });
        b.dataset.id = m.id;
        chips.appendChild(b);
      });
      body.appendChild(chips);

      const grid = el('div', 'mtn-grid');
      list.forEach((m) => {
        const picked = m.id === this.mountainId;
        const card = el('article', `mtn-card ${picked ? 'picked' : ''} ${m.id === this.activeMountain ? 'active' : ''}`);
        card.dataset.id = m.id;
        card.addEventListener('click', (e) => {
          if (!e.target.closest('button, summary')) this.selectMountain(m.id);
        });
        const bannerCv = el('canvas', 'mtn-banner');
        bannerCv.setAttribute('aria-hidden', 'true');
        card.appendChild(bannerCv);
        const top = el('div', 'mtn-top');
        top.appendChild(el('h3', '', m.name));
        const star = el('span', 'mtn-stars', stars(m.difficulty_stars));
        star.setAttribute('aria-label', `遊戲相對難度 ${m.difficulty_stars} 星`);
        top.appendChild(star);
        card.appendChild(top);
        card.appendChild(el('p', 'mtn-intro', m.intro));
        const facts = (rows) => {
          const dl = el('dl', 'mtn-facts');
          rows.forEach(([k, v]) => {
            dl.appendChild(el('dt', '', k));
            dl.appendChild(el('dd', '', v));
          });
          return dl;
        };
        card.appendChild(facts([
          ['海拔', `${meters(m.summit_m)}（登山口基準${meters(m.trailhead_m)}）`],
          ['天數', L.formatDays(m.days)],
        ]));
        const more = el('details', 'mtn-more');
        more.open = picked;
        more.appendChild(el('summary', '', '步道、氣候與許可'));
        more.appendChild(facts([['步道', m.terrain], ['氣候', m.climate], ['許可', m.permits_note]]));
        card.appendChild(more);
        const pick = button(`btn btn-small mtn-pick ${picked ? 'on' : ''}`, picked ? '✓ 已選這座山' : '選這座山', () => this.selectMountain(m.id));
        pick.setAttribute('aria-pressed', String(picked));
        card.appendChild(pick);
        grid.appendChild(card);
      });
      body.appendChild(grid);
      body.appendChild(el('p', 'prep-note', '山景為示意插畫。星等是本遊戲綜合步程、負重、暴露與撤退的相對排序，不等同官方步道分級。天數不含交通與額外高度適應。實際路況與申請規定請查當期官方公告。'));
      /* 畫面排好後才知道插圖尺寸 */
      grid.querySelectorAll('.mtn-card').forEach((card) => {
        const cv = card.querySelector('.mtn-banner');
        const w = cv.clientWidth;
        const h = cv.clientHeight;
        if (w && h) GA.drawMountainBanner(fitCanvas(cv, w, h), w, h, list.find((x) => x.id === card.dataset.id));
      });

      /* 許可需求直接放在下一步旁邊：看得到，不用再多勾一格 */
      const m = this.mountain;
      foot.appendChild(el('p', 'prep-foot-note', m ? `${m.name}的許可與住宿：${m.permits_note}` : '先選一座山，這裡會列出它的許可與住宿需求。'));
      const next = button('btn btn-primary', '下一步：看天氣', () => this.go('forecast'));
      next.id = 'prep-next';
      next.disabled = !m;
      foot.appendChild(next);
    },

    /* 第 2 步：季節與預報 ----------------------------------------------- */
    render_forecast(body, foot) {
      const m = this.mountain;
      const wrap = el('div', 'fc-wrap');
      const side = el('div', 'fc-side');
      const cv = el('canvas', 'fc-art');
      cv.id = 'fc-art';
      cv.setAttribute('aria-hidden', 'true');
      side.appendChild(cv);
      side.appendChild(el('h3', 'fc-mtn', m.name));
      side.appendChild(el('p', 'fc-sub', `${stars(m.difficulty_stars)}｜${L.formatDays(m.days)}`));
      const seasons = el('div', 'season-grid');
      seasons.setAttribute('role', 'radiogroup');
      seasons.setAttribute('aria-label', '選擇季節');
      L.SEASONS.concat([{ key: 'random', name: '隨機', months: '交給天意' }]).forEach((s) => {
        const on = this.seasonChoice === s.key;
        const b = button(`season-btn ${on ? 'on' : ''}`, '', () => this.chooseSeason(s.key));
        b.dataset.season = s.key;
        b.setAttribute('role', 'radio');
        b.setAttribute('aria-checked', String(on));
        b.appendChild(el('strong', '', s.name));
        b.appendChild(el('small', '', s.months));
        seasons.appendChild(b);
      });
      side.appendChild(seasons);
      wrap.appendChild(side);

      const main = el('div', 'fc-main');
      if (!this.forecast) {
        main.appendChild(el('p', 'fc-empty', '先選一個季節，或讓遊戲隨機抽一個。選好就會看到這趟的模擬預報。'));
      } else {
        /* 延期卡排在前面，手機不用捲動就看得到 */
        const reasons = this.postponed();
        if (reasons.length) main.appendChild(this.postponeCard(reasons));
        main.appendChild(this.forecastCard());
      }
      wrap.appendChild(main);
      body.appendChild(wrap);

      const w = cv.clientWidth;
      const h = cv.clientHeight;
      const f = this.forecast;
      if (w && h) {
        GA.drawMountainBanner(fitCanvas(cv, w, h), w, h, m, f ? {
          season: this.season,
          dim: f.rain_probability_pct >= 60 || f.hazards.front || f.hazards.typhoon,
          cloud: f.rain_probability_pct >= 40,
          rain: f.rain_probability_pct >= 60 || f.hazards.front || f.hazards.typhoon,
          fog: f.hazards.fog,
          bolt: f.hazards.thunder,
          wind: f.gust_ms >= 10,
        } : {});
      }

      if (this.forecast && !this.postponed().length) {
        foot.appendChild(el('p', 'prep-foot-note', '返回這一步不會改變預報。'));
      } else {
        foot.appendChild(el('p', 'prep-foot-note', this.forecast ? '這趟先不出發，換個安排再來。' : '選好季節才能打包。'));
      }
      const next = button('btn btn-primary', '下一步：換裝打包', () => this.go('gear'));
      next.id = 'prep-next';
      next.disabled = !this.forecast || this.postponed().length > 0;
      foot.appendChild(next);
    },

    forecastCard() {
      const f = this.forecast;
      const m = this.mountain;
      const brief = this.brief;
      const card = el('section', 'fc-card');
      card.id = 'fc-card';
      const title = el('div', 'fc-title');
      title.appendChild(el('strong', '', `${L.seasonName(this.season)}${this.seasonChoice === 'random' ? '（隨機抽中）' : ''}`));
      title.appendChild(el('span', 'fc-notice', NOTICE));
      card.appendChild(title);
      const rows = el('div', 'fc-rows');
      const row = (icon, label, value, sub) => {
        const r = el('div', 'fc-row');
        const ic = el('span', 'fc-ic');
        ic.innerHTML = icon;
        r.appendChild(ic);
        r.appendChild(el('span', 'fc-label', label));
        const v = el('span', 'fc-value');
        v.appendChild(el('b', '', value));
        if (sub) v.appendChild(el('small', '', sub));
        r.appendChild(v);
        rows.appendChild(r);
      };
      row(ICON.temp, `登山口${meters(m.trailhead_m)}`, range(f.trailhead_temp_c));
      row(ICON.temp, `山頂${meters(m.summit_m)}`, range(f.summit_temp_c), '山上不能直接套用平地預報');
      row(ICON.rain, '降雨機率', `${f.rain_probability_pct}%`, '機率不等於會淋雨的時間比例');
      row(ICON.wind, '山頂風速', `${round(f.wind_ms)} m/s`, `${L.windLabel(f.wind_ms)}；陣風約 ${round(f.gust_ms)} m/s`);
      card.appendChild(rows);

      const special = el('div', 'fc-hazards');
      const on = Object.keys(HAZARD_NAMES).filter((k) => (k === 'ice' ? f.ice : f.hazards[k]));
      special.appendChild(el('span', 'fc-label', '特殊天氣'));
      if (on.length) on.forEach((k) => {
        const chip = el('span', `hz-chip hz-${k}`);
        chip.dataset.hazard = k;
        const ic = el('span', 'hz-ic');
        ic.innerHTML = ICON.alert;
        chip.appendChild(ic);
        chip.appendChild(document.createTextNode(HAZARD_NAMES[k]));
        special.appendChild(chip);
      });
      else special.appendChild(el('span', 'hz-none', '本次未預報特殊天氣，仍可能局部變化'));
      card.appendChild(special);

      const tips = [];
      if (brief.strong_wind || f.wind_ms >= 8) tips.push('風會加速散熱');
      if (brief.wet) tips.push('淋濕後更冷');
      if (brief.hot) tips.push('曝曬悶熱，流汗多要多補水');
      if (f.hazards.fog) tips.push('可能起霧，預留照明與導航');
      tips.push('出發前再查氣象署及管理機關公告，途中依實況調整。');
      card.appendChild(el('p', 'fc-tips', `提醒：${tips.join('；')}`));
      return card;
    },

    postponeCard(reasons) {
      const card = el('section', 'postpone-card');
      card.id = 'postpone-card';
      card.setAttribute('role', 'alert');
      card.appendChild(el('h3', '', '建議延期，這趟先不走'));
      const ul = el('ul');
      reasons.forEach((r) => {
        const li = el('li', '', r.text);
        li.dataset.reason = r.id;
        ul.appendChild(li);
      });
      card.appendChild(ul);
      card.appendChild(el('p', '', '願意延期也是登山判斷的一部分，不會留下任何壞紀錄。換個安排再出發：'));
      const btns = el('div', 'postpone-btns');
      btns.appendChild(button('btn btn-small', '換山', () => this.go('mountain')));
      btns.appendChild(button('btn btn-small', '換季節', () => {
        this.seasonChoice = null;
        this.season = null;
        this.forecast = null;
        this.actual = null;
        this.nonce = 0;
        this.render();
      }));
      const re = button('btn btn-small', '重新抽預報', () => this.reroll());
      re.id = 'btn-reroll';
      btns.appendChild(re);
      card.appendChild(btns);
      return card;
    },

    /* 第 3 步：換裝打包 ------------------------------------------------- */
    render_gear(body, foot) {
      const f = this.forecast;
      const m = this.mountain;
      const brief = el('div', 'gear-brief');
      brief.appendChild(el('p', 'gear-eve', '出發前夜。明天要穿什麼、帶什麼，現在決定。'));
      brief.appendChild(el('strong', '', `${m.name}｜${L.seasonName(this.season)}｜模擬預報`));
      brief.appendChild(el('span', '', `登山口 ${range(f.trailhead_temp_c)}；山頂 ${range(f.summit_temp_c)}`));
      const hz = Object.keys(HAZARD_NAMES).filter((k) => (k === 'ice' ? f.ice : f.hazards[k])).map((k) => HAZARD_NAMES[k]);
      brief.appendChild(el('span', '', `降雨 ${f.rain_probability_pct}%；陣風約 ${round(f.gust_ms)} m/s${hz.length ? `；${hz.join('、')}` : ''}`));

      const layout = el('div', 'gear-layout');
      const left = el('div', 'gear-left');
      left.appendChild(brief);
      const visual = el('div', 'gear-visual');
      const stage = el('div', 'gear-stage');
      const cv = el('canvas', 'gear-preview');
      cv.id = 'gear-preview';
      cv.setAttribute('role', 'img');
      cv.setAttribute('aria-label', '角色目前的穿著');
      stage.appendChild(cv);
      const heroLabel = () => (DH.player.gender === 'male' ? '換女生' : '換男生');
      const heroSwitch = button('btn hero-switch', heroLabel(), () => {
        DH.player.set(DH.player.gender === 'male' ? 'female' : 'male');
        heroSwitch.textContent = heroLabel();
        this.refreshGear(false);
      });
      stage.appendChild(heroSwitch);
      visual.appendChild(stage);
      const traySlot = el('div', 'gear-tray-slot');
      traySlot.id = 'gear-tray-slot';
      visual.appendChild(traySlot);
      left.appendChild(visual);
      const summary = el('p', 'gear-summary');
      summary.id = 'gear-summary';
      left.appendChild(summary);
      const meter = el('div', 'gear-meter');
      meter.id = 'gear-meter';
      left.appendChild(meter);
      /* 先自己判斷一次，選完才能對照建議，否則一鍵就跳過了整個學習 */
      const rec = button('btn btn-small gear-rec', '對照本趟建議清單', () => this.applyRecommended());
      rec.id = 'btn-recommend';
      rec.hidden = true;
      left.appendChild(rec);
      layout.appendChild(left);

      const right = el('div', 'gear-right');
      const tabs = el('div', 'gear-tabs');
      tabs.setAttribute('role', 'tablist');
      [['wear', '穿著'], ['pack', '背包'], ['review', '行前']].forEach(([key, name]) => {
        const b = button('gear-tab', name, () => this.setTab(key));
        b.dataset.tab = key;
        b.setAttribute('role', 'tab');
        tabs.appendChild(b);
      });
      /* 手機：主捲動區捲過預覽後，分頁置頂，下方貼一條小摘要 */
      const stick = el('div', 'gear-stick');
      stick.appendChild(tabs);
      const mini = el('div', 'gear-mini');
      mini.id = 'gear-mini';
      const miniCv = el('canvas', 'gear-mini-art');
      miniCv.id = 'gear-mini-art';
      miniCv.setAttribute('aria-hidden', 'true');
      mini.appendChild(miniCv);
      const miniText = el('p', 'gear-mini-text');
      miniText.id = 'gear-mini-text';
      mini.appendChild(miniText);
      stick.appendChild(mini);
      right.appendChild(stick);
      const scroll = el('div', 'gear-scroll');
      scroll.id = 'gear-scroll';
      scroll.appendChild(this.wearPanel());
      scroll.appendChild(this.packPanel());
      const review = el('div', 'gear-panel');
      review.dataset.panel = 'review';
      review.id = 'review-panel';
      scroll.appendChild(review);
      right.appendChild(scroll);
      layout.appendChild(right);
      body.appendChild(layout);

      const note = el('p', 'prep-foot-note');
      note.id = 'gear-foot-note';
      foot.appendChild(note);
      const next = button('btn btn-primary', '', () => this.advanceGear());
      next.id = 'prep-next';
      foot.appendChild(next);

      this.sizePreview();
      this.setTab(this.tab);
      this.refreshGear(false);
      body.addEventListener('scroll', () => this.updateMini());
    },

    /* 下一步：有沒選的就帶去第一個沒選的，都選完才進檢查 */
    advanceGear() {
      const [first] = this.undecided();
      if (!first) {
        this.go('check');
        return;
      }
      this.setTab(first.id === 'water' ? 'pack' : 'wear');
      const target = document.querySelector(`.gear-slot[data-slot="${first.id}"]`);
      document.querySelectorAll('.gear-opt.flash').forEach((n) => n.classList.remove('flash'));
      target.scrollIntoView({ block: 'center' });
      target.querySelector('.gear-opt').classList.add('flash');
    },

    updateMini() {
      const body = $('prep-body');
      const left = document.querySelector('.gear-left');
      const mini = $('gear-mini');
      if (!body || !left || !mini) return;
      mini.classList.toggle('show', body.scrollTop > left.offsetHeight + 8);
      /* 收合時 display:none 量不到尺寸，顯示中才畫 */
      const cv = $('gear-mini-art');
      if (cv.clientWidth) GA.drawPreview(fitCanvas(cv, cv.clientWidth, cv.clientHeight), cv.clientWidth, cv.clientHeight, this.selection, { t: 1, fx: this.previewFx() });
    },

    setTab(key) {
      this.tab = key;
      document.querySelectorAll('.gear-tab').forEach((b) => {
        const on = b.dataset.tab === key;
        b.classList.toggle('on', on);
        b.setAttribute('aria-selected', String(on));
      });
      document.querySelectorAll('.gear-panel').forEach((p) => { p.hidden = p.dataset.panel !== key; });
      const scroll = $('gear-scroll');
      if (scroll) scroll.scrollTop = 0;
      /* 手機的分頁置頂時，換分頁回到新清單開頭，不停在舊分頁的捲動位置 */
      const body = $('prep-body');
      const right = document.querySelector('.gear-right');
      if (body && right && body.scrollTop > right.offsetTop) body.scrollTop = right.offsetTop;
    },

    optionButton(slot, item, multiple) {
      const b = button('gear-opt', '', () => (multiple ? this.togglePack(item.id) : this.setSingle(slot, item.id)));
      b.dataset.slot = slot;
      b.dataset.item = item.id;
      b.setAttribute('role', multiple ? 'checkbox' : 'radio');
      b.appendChild(iconCanvas(item.id, 40));
      const text = el('span', 'gear-opt-text');
      const nameRow = el('span', 'gear-opt-name');
      nameRow.appendChild(el('b', '', item.name));
      if (item.weight_g && slot === 'pack') nameRow.appendChild(el('small', '', `${item.weight_g >= 1000 ? `${item.weight_g / 1000} 公斤` : `${item.weight_g} 克`}`));
      text.appendChild(nameRow);
      text.appendChild(el('span', 'gear-opt-teach', item.teach));
      b.appendChild(text);
      b.appendChild(el('span', 'gear-opt-mark'));
      return b;
    },

    wearPanel() {
      const panel = el('div', 'gear-panel');
      panel.dataset.panel = 'wear';
      this.data.gear.slots.filter((s) => s.id !== 'pack' && s.id !== 'water').forEach((slot) => {
        const group = el('div', 'gear-slot');
        group.setAttribute('role', 'radiogroup');
        group.setAttribute('aria-label', slot.name);
        group.dataset.slot = slot.id;
        group.appendChild(el('h4', '', slot.name));
        const opts = el('div', 'gear-opts is-short');
        slot.options.forEach((id) => opts.appendChild(this.optionButton(slot.id, this.index[id], false)));
        group.appendChild(opts);
        /* 手機兩欄放不下每項說明，只列目前所選的那一項 */
        const note = el('p', 'gear-slot-note');
        note.dataset.slot = slot.id;
        group.appendChild(note);
        panel.appendChild(group);
      });
      return panel;
    },

    packPanel() {
      const panel = el('div', 'gear-panel');
      panel.dataset.panel = 'pack';
      const water = this.data.gear.slots.find((s) => s.id === 'water');
      const wg = el('div', 'gear-slot');
      wg.setAttribute('role', 'radiogroup');
      wg.setAttribute('aria-label', '飲水');
      wg.dataset.slot = 'water';
      const wh = el('h4', '', '飲水');
      const target = el('small', 'gear-target');
      target.id = 'water-target';
      wh.appendChild(target);
      wg.appendChild(wh);
      const wo = el('div', 'gear-opts');
      water.options.forEach((id) => wo.appendChild(this.optionButton('water', this.index[id], false)));
      wg.appendChild(wo);
      panel.appendChild(wg);

      const pack = this.data.gear.slots.find((s) => s.id === 'pack');
      const pg = el('div', 'gear-slot');
      const ph = el('h4', '', '背包（可複選）');
      const weight = el('small', 'gear-target');
      weight.id = 'pack-weight';
      ph.appendChild(weight);
      pg.appendChild(ph);
      const po = el('div', 'gear-opts');
      pack.options.forEach((id) => po.appendChild(this.optionButton('pack', this.index[id], true)));
      pg.appendChild(po);
      panel.appendChild(pg);
      return panel;
    },

    sizePreview() {
      const cv = $('gear-preview');
      if (!cv) return;
      const w = cv.clientWidth;
      const h = cv.clientHeight;
      if (!w || !h) return;
      this.preview = { c: fitCanvas(cv, w, h), w, h };
    },

    /* 預覽角色的天氣背景 */
    previewFx() {
      return { cold: this.brief && this.brief.cold, room: true };
    },
    drawPreview(t, pose) {
      if (!this.preview) return;
      const { c, w, h } = this.preview;
      GA.drawPreview(c, w, h, this.selection, { t, fx: this.previewFx(), pose });
    },
    tick(t) {
      if (this.step === 'gear' && this.preview) this.drawPreview(t);
    },

    refreshGear(changed) {
      if (this.step !== 'gear') return;
      const sel = this.selection;
      document.querySelectorAll('.gear-opt').forEach((b) => {
        const { slot, item } = b.dataset;
        const on = slot === 'pack' ? sel.pack.includes(item) : sel[slot] === item;
        b.classList.toggle('on', on);
        b.setAttribute('aria-checked', String(on));
      });
      const pending = this.undecided();
      const meter = $('gear-meter');
      meter.textContent = '';
      $('btn-recommend').hidden = pending.length > 0;
      $('prep-next').textContent = pending.length ? `還差 ${pending.length} 項：${pending[0].name}` : '下一步：裝備檢查';
      $('prep-next').classList.toggle('is-pending', pending.length > 0);
      $('gear-foot-note').textContent = pending.length ? '連「不穿」也要自己選過。全部決定後才看得到行前風險。' : '點數是教學量表，不是事故機率。';
      if (pending.length) {
        this.renderDressing(meter, pending);
      } else {
        this.renderMeter(meter);
      }
      document.querySelectorAll('.gear-slot-note').forEach((n) => {
        const chosen = sel[n.dataset.slot];
        n.textContent = chosen ? this.index[chosen].teach : '還沒決定';
      });
      const outfit = this.outfitSummary(sel);
      $('gear-summary').textContent = outfit;
      $('gear-preview').setAttribute('aria-label', `角色目前的穿著：${outfit}`);
      $('gear-tray-slot').replaceChildren(this.trayEl());
      const f = this.forecast;
      const weather = f ? `${this.mountain.name}｜山頂 ${range(f.summit_temp_c)}｜降雨 ${f.rain_probability_pct}%` : '';
      $('gear-mini-text').textContent = `${weather}\n${pending.length ? `還差 ${pending.length} 項` : `行前風險 ${this.assessment().risk}／${this.assessment().cap}`}｜${outfit}`;

      const target = $('water-target');
      if (target) target.textContent = `本趟起點建議至少 ${L.waterTarget(this.mountain, this.brief)} 公升，水源與流汗再調整`;
      const weight = $('pack-weight');
      if (weight) weight.textContent = `可選物估重 ${(L.packWeight(sel, this.index) / 1000).toFixed(1)} 公斤（含水，不含背包與公裝）`;
      this.renderReview($('review-panel'), pending);
      this.sizePreview();
      this.drawPreview(this.handlers.artTime ? this.handlers.artTime() : 1);
      this.updateMini();
      if (changed) this.handlers.tapSound();
    },

    renderDressing(meter, pending) {
      const total = this.data.gear.slots.filter((s) => s.id !== 'pack').length;
      const top = el('div', 'meter-top');
      top.appendChild(el('span', '', '準備進度'));
      top.appendChild(el('b', 'meter-num', `${total - pending.length}`));
      top.appendChild(el('span', 'meter-cap', `／${total}`));
      meter.appendChild(top);
      const bar = el('div', 'meter-bar');
      const fill = el('i');
      fill.style.width = `${((total - pending.length) / total) * 100}%`;
      fill.style.background = '#7dbf8b';
      bar.appendChild(fill);
      meter.appendChild(bar);
      meter.appendChild(el('p', 'meter-pending', `還沒決定：${pending.map((s) => s.name).join('、')}`));
    },

    renderMeter(meter) {
      const a = this.assessment();
      const top = el('div', 'meter-top');
      top.appendChild(el('span', '', '行前風險'));
      const num = el('b', 'meter-num', `${a.risk}`);
      num.id = 'prep-risk';
      top.appendChild(num);
      top.appendChild(el('span', 'meter-cap', `／${a.cap}`));
      meter.appendChild(top);
      const bar = el('div', 'meter-bar');
      const fill = el('i');
      fill.style.width = `${(a.risk / a.cap) * 100}%`;
      fill.style.background = DH.core.riskColor(a.risk * 1.6);
      bar.appendChild(fill);
      meter.appendChild(bar);
      const hits = a.findings.filter((x) => x.hit).sort((x, y) => y.points - x.points);
      const why = el('ul', 'meter-why');
      why.id = 'prep-why';
      /* 不默默藏掉原因：手機先列最重的一條，其餘用按鈕展開 */
      const limit = this.whyOpen ? hits.length : window.matchMedia('(max-width: 760px)').matches ? 1 : 3;
      if (hits.length) hits.slice(0, limit).forEach((x) => why.appendChild(el('li', '', `＋${x.points}　${x.text}`)));
      else why.appendChild(el('li', 'ok', '這份配裝符合本趟評分項目。0 分不代表登山沒有風險。'));
      meter.appendChild(why);
      if (hits.length > limit || (this.whyOpen && hits.length > 1)) {
        const more = button('meter-more', this.whyOpen ? '收合' : `查看其餘 ${hits.length - limit} 項`, () => {
          this.whyOpen = !this.whyOpen;
          this.refreshGear(false);
        });
        more.id = 'prep-why-more';
        meter.appendChild(more);
      }
    },

    /* 預覽下方的文字摘要：內層・中層・外層・鞋 */
    outfitSummary(sel) {
      if (!sel.base && !sel.mid && !sel.shell && !sel.shoes) return '還穿著家居服，光著腳';
      const label = (slot, none, noneText, undecidedText) => (!sel[slot] ? undecidedText : sel[slot] === none ? noneText : this.index[sel[slot]].name);
      return [
        label('base', null, '', '內層未定'),
        label('mid', 'no_mid', '不穿中層', '中層未定'),
        label('shell', 'no_shell', '不穿外層', '外層未定'),
        label('shoes', null, '', '鞋子未定'),
      ].join('・');
    },

    /* 背包物品盤：依用途分組；hover 或點一下看名稱 */
    trayEl() {
      const tray = el('div', 'gear-tray');
      const pack = this.selection.pack;
      if (!pack.length) {
        tray.classList.add('empty');
        tray.appendChild(el('p', 'tray-empty', '背包還是空的'));
        tray.appendChild(button('btn btn-small tray-go', '前往背包挑裝備', () => {
          if (this.step === 'gear') this.setTab('pack');
          else {
            this.tab = 'pack';
            this.go('gear');
          }
        }));
        return tray;
      }
      const name = el('p', 'tray-name', '點圖示看名稱');
      name.setAttribute('aria-live', 'polite');
      const show = (id, b) => {
        name.textContent = this.index[id].name;
        name.classList.add('on');
        tray.querySelectorAll('.tray-item.on').forEach((n) => n.classList.remove('on'));
        b.classList.add('on');
      };
      GA.TRAY_GROUPS.forEach((g) => {
        const ids = g.ids.filter((id) => pack.includes(id));
        if (!ids.length) return;
        const row = el('div', 'tray-group');
        row.dataset.group = g.key;
        row.appendChild(el('span', 'tray-label', g.name));
        const icons = el('div', 'tray-icons');
        ids.forEach((id) => {
          const b = button('tray-item', '', () => show(id, b));
          b.dataset.item = id;
          b.title = this.index[id].name;
          b.setAttribute('aria-label', this.index[id].name);
          b.addEventListener('mouseenter', () => show(id, b));
          b.appendChild(iconCanvas(id, 28));
          icons.appendChild(b);
        });
        row.appendChild(icons);
        tray.appendChild(row);
      });
      tray.appendChild(name);
      return tray;
    },

    renderReview(panel, pending) {
      if (!panel) return;
      panel.textContent = '';
      if (pending.length) {
        panel.appendChild(el('p', 'review-ok', '全部決定後，這裡會列出行前風險與十大必備功能檢核。'));
        return;
      }
      const a = this.assessment();
      const ctx = this.context();
      panel.appendChild(this.groupBars(a));
      const list = el('div', 'review-reasons');
      list.appendChild(el('h4', '', '目前的風險原因'));
      const hits = a.findings.filter((x) => x.hit);
      if (!hits.length) list.appendChild(el('p', 'review-ok', '沒有命中評分項目。'));
      else {
        const ul = el('ul');
        hits.forEach((x) => ul.appendChild(el('li', '', `＋${x.points}（${L.GROUP_NAMES[x.group]}）${x.text}`)));
        list.appendChild(ul);
      }
      panel.appendChild(list);
      panel.appendChild(this.essentials(ctx));
    },

    groupBars(a) {
      const box = el('div', 'group-bars');
      L.GROUP_KEYS.forEach((k) => {
        const g = a.groups[k];
        const row = el('div', 'group-row');
        row.dataset.group = k;
        row.appendChild(el('span', 'group-name', g.name));
        const bar = el('div', 'meter-bar');
        const fill = el('i');
        fill.style.width = `${(g.score / g.cap) * 100}%`;
        fill.style.background = g.score ? '#e29a4f' : '#7dbf8b';
        bar.appendChild(fill);
        row.appendChild(bar);
        row.appendChild(el('span', 'group-score', `${g.score}／${g.cap}`));
        if (g.capped) row.appendChild(el('span', 'group-cap', '本組已達上限'));
        box.appendChild(row);
      });
      return box;
    },

    essentials(ctx) {
      const wrap = el('details', 'essentials');
      wrap.open = true;
      const statuses = L.essentialStatus(this.data.gear, this.selection, ctx.gear);
      wrap.appendChild(el('summary', '', `十大必備功能檢核：已備 ${statuses.filter((s) => s.status === 'done').length} / ${statuses.length}`));
      const LABEL = { done: '已備', part: '部分', none: '未備' };
      const ul = el('ul');
      statuses.forEach((s) => {
        const li = el('li', `ess-${s.status}`);
        li.appendChild(el('b', 'ess-tag', LABEL[s.status]));
        li.appendChild(el('span', 'ess-name', s.name));
        li.appendChild(el('small', '', s.note));
        ul.appendChild(li);
      });
      wrap.appendChild(ul);
      wrap.appendChild(el('p', 'prep-note', '用火與修補缺少時只提醒、不計分。保險只做保障檢核，不降低風險。'));
      return wrap;
    },

    /* 必備功能還缺什麼，直接擺出來並能回去補；仍然可以選擇出發 */
    essentialGaps(ctx) {
      const statuses = L.essentialStatus(this.data.gear, this.selection, ctx.gear);
      const gaps = statuses.filter((s) => s.status !== 'done').sort((a, b) => (a.status === 'none' ? 0 : 1) - (b.status === 'none' ? 0 : 1));
      const box = el('div', 'ess-gaps');
      if (!gaps.length) {
        box.appendChild(el('p', 'ess-gaps-ok', '十大必備功能都備齊了。'));
        return box;
      }
      box.appendChild(el('h4', '', `必備功能還缺 ${gaps.length} 項`));
      const ul = el('ul');
      gaps.slice(0, 3).forEach((s) => {
        const li = el('li');
        li.appendChild(el('b', '', s.name));
        li.appendChild(el('span', '', s.note));
        ul.appendChild(li);
      });
      box.appendChild(ul);
      const fix = button('btn ess-gaps-fix', '回背包補齊', () => {
        this.tab = 'pack';
        this.go('gear');
      });
      box.appendChild(fix);
      return box;
    },

    /* 第 4 步：裝備檢查 ------------------------------------------------- */
    render_check(body, foot) {
      const a = this.assessment();
      const ctx = this.context();
      const wrap = el('div', 'check-wrap');
      const left = el('div', 'check-left');
      const total = el('div', 'check-total');
      total.appendChild(el('span', '', '行前風險'));
      const big = el('strong', '');
      big.id = 'check-risk';
      big.textContent = `${a.risk} / ${a.cap}`;
      total.appendChild(big);
      total.appendChild(el('small', '', a.risk > 0 ? '會帶入這趟旅程的累積風險' : '0 不代表登山沒有風險，路上的判斷一樣重要'));
      left.appendChild(total);
      left.appendChild(this.groupBars(a));
      const cv = el('canvas', 'check-preview');
      cv.setAttribute('role', 'img');
      cv.setAttribute('aria-label', `角色目前的穿著：${this.outfitSummary(this.selection)}`);
      left.appendChild(cv);
      left.appendChild(this.trayEl());
      wrap.appendChild(left);

      const right = el('div', 'check-right');
      const rows = el('ul', 'check-list');
      rows.id = 'check-list';
      const hits = a.findings.filter((x) => x.hit).sort((x, y) => y.points - x.points);
      const passes = a.findings.filter((x) => !x.hit);
      /* 一次看到十幾條警告，玩家不知道從哪裡下手：先給最值得改的三件，其他收起來 */
      const TOP = 3;
      if (hits.length) right.appendChild(el('h4', 'check-top-title', hits.length > TOP ? '先改這三件最有用' : '建議先改這些'));
      const addRow = (x, list) => {
        const li = el('li');
        const b = button(`check-row ${x.hit ? 'adjust' : 'pass'}`, '', () => this.jumpToRule(x));
        b.dataset.rule = x.id;
        b.appendChild(el('span', 'check-mark', x.hit ? '!' : '✓'));
        const text = el('span', 'check-text');
        const label = el('b', '', `${x.hit ? '建議調整' : '符合'}｜${L.GROUP_NAMES[x.group]}`);
        text.appendChild(label);
        text.appendChild(el('span', '', x.text));
        b.appendChild(text);
        if (x.hit) b.appendChild(el('span', 'check-pts', `＋${x.points}`));
        li.appendChild(b);
        list.appendChild(li);
      };
      /* 全部合格時沒有要改的，直接列出符合的項目 */
      (hits.length ? hits.slice(0, TOP) : passes).forEach((x) => addRow(x, rows));
      right.appendChild(rows);
      const folded = (title, items) => {
        if (!items.length) return;
        const more = el('details', 'check-more');
        more.appendChild(el('summary', '', title));
        const list = el('ul', 'check-list');
        items.forEach((x) => addRow(x, list));
        more.appendChild(list);
        right.appendChild(more);
      };
      folded(`其他 ${Math.max(0, hits.length - TOP)} 項可以再調整`, hits.slice(TOP));
      if (hits.length) folded(`已經符合的 ${passes.length} 項`, passes);
      right.appendChild(el('p', 'prep-note', '風險點數是教學量表，不是事故機率。行前風險大於 0 仍可出發，路上多留餘裕；每一列都可以點回去修改。'));
      right.appendChild(this.essentialGaps(ctx));
      right.appendChild(this.essentials(ctx));
      right.querySelector('.essentials').open = false;
      wrap.appendChild(right);
      body.appendChild(wrap);

      foot.appendChild(el('p', 'prep-foot-note', a.risk > 0 ? `從行前風險 ${a.risk} 開始累積。` : '行前都準備好了，路上一樣要判斷。'));
      const back = button('btn', '返回修改', () => this.go('gear'));
      back.id = 'prep-edit';
      foot.appendChild(back);
      const go = button('btn btn-primary', '確認出發', () => this.confirm());
      go.id = 'prep-confirm';
      foot.appendChild(go);

      const w = cv.clientWidth;
      const h = cv.clientHeight;
      if (w && h) GA.drawPreview(fitCanvas(cv, w, h), w, h, this.selection, { t: 1, fx: this.previewFx() });
    },

    /* 點檢查項目就回到相關的選項 */
    jumpToRule(x) {
      const id = x.items[0];
      const slot = id && this.index[id] ? this.index[id].slot : null;
      this.tab = !slot ? 'review' : slot === 'pack' || slot === 'water' ? 'pack' : 'wear';
      this.go('gear');
      if (slot) {
        const target = document.querySelector(`.gear-opt[data-item="${id}"]`);
        if (target) {
          target.scrollIntoView({ block: 'center' });
          target.classList.add('flash');
        }
      }
    },

    /* 測試與對帳用 ---------------------------------------------------- */
    /* 用固定時間畫一張離屏預覽，回傳可比較的字串（眨眼與呼吸不影響結果） */
    previewHash(selection) {
      const sel = selection || this.selection;
      const cv = document.createElement('canvas');
      cv.width = 320;
      cv.height = 320;
      const c = cv.getContext('2d');
      GA.drawPreview(c, 320, 320, sel, { t: 1 });
      return `${cv.toDataURL()}|${sel.pack.join(',')}`;
    },
    /* 只給測試：強制本趟預報的特殊條件 */
    forceForecast(patch) {
      Object.assign(this.forecast, patch);
      if (patch.hazards) this.forecast.hazards = Object.assign({}, this.forecast.hazards, patch.hazards);
      this.render();
    },
  };

  DH.prep = prep;
})();
