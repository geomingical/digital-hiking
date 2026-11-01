/* DOM 介面：HUD、事件卡片、開始與結局畫面、彈窗、提示。 */
(function () {
  const DH = (window.DH = window.DH || {});
  const { SECTIONS, FINISH_X, BADGES, riskColor, store } = DH.core;
  const $ = (id) => document.getElementById(id);
  const el = (tag, cls, txt) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (txt !== undefined) n.textContent = txt;
    return n;
  };

  const SOUND_ICON = {
    on: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M4 9.5v5h3.6L12 18.5v-13L7.6 9.5z" fill="currentColor"/><path d="M15.4 9a4.2 4.2 0 0 1 0 6M17.8 6.6a7.6 7.6 0 0 1 0 10.8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    off: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M4 9.5v5h3.6L12 18.5v-13L7.6 9.5z" fill="currentColor"/><path d="m15.5 9.5 5 5m0-5-5 5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  };

  const FACES = [
    { max: 20, mouth: 'M10.5 19.5 Q16 25 21.5 19.5', drop: 0 },
    { max: 50, mouth: 'M11 21 L21 21', drop: 0 },
    { max: 80, mouth: 'M10.5 23 Q16 18.5 21.5 23', drop: 1 },
    { max: Infinity, mouth: 'M10 23 Q13 20 16 22.5 Q19 25 22 21.5', drop: 1 },
  ];

  const lastHud = { stage: '', alt: '', pct: -1 };

  const LEGAL_FULL = '山中緊急求救請撥 112（可由他業者訊號轉接119）或 119；完全無訊號時無法通話，請先備妥衛星通訊或約定回報。';

  /* 解說的第一句當關鍵提醒，其餘放在後面補充 */
  function splitWhy(why) {
    const m = why.match(/^.*?[。！？]/);
    const key = m ? m[0] : why;
    return { key, rest: why.slice(key.length).trim() };
  }

  /* 題庫來源可能是網址或機關名稱；網址顯示成機關名稱的連結 */
  const SOURCE_NAMES = [
    ['moi.gov.tw', '內政部'], ['taiwan.nps.gov.tw', '國家公園署'], ['hsinchu.gov.tw', '新竹縣政府'],
    ['forest.gov.tw', '林業保育署'], ['nfa.gov.tw', '消防署'], ['119.tainan.gov.tw', '臺南市消防局'],
    ['necoast-nsa.gov.tw', '觀光署東北角管理處'], ['ysnp.gov.tw', '玉山管理處'], ['ymsnp.gov.tw', '陽明山管理處'],
    ['spnp.gov.tw', '雪霸管理處'], ['hike.taiwan.gov.tw', '登山申請一站式服務網'], ['mohw.gov.tw', '衛福部'],
    ['hiking.biji.co', '健行筆記（登山教學）'],
  ];
  function fillSources(node, prefix, sources) {
    node.textContent = '';
    if (!Array.isArray(sources) || !sources.length) return;
    node.appendChild(document.createTextNode(prefix));
    const used = new Set();
    sources.forEach((src) => {
      const isUrl = /^https?:\/\//.test(src);
      const hit = isUrl && SOURCE_NAMES.find(([host]) => new URL(src).hostname.endsWith(host));
      const label = hit ? hit[1] : src;
      if (used.has(label)) return;
      if (used.size) node.appendChild(document.createTextNode('、'));
      used.add(label);
      if (!isUrl) {
        node.appendChild(document.createTextNode(label));
        return;
      }
      const a = el('a', '', label);
      a.href = src;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      node.appendChild(a);
    });
  }


  /* 保命重點：只有必做行動用粗體 */
  function fillKeyPoint(node, point, act) {
    node.textContent = '';
    const at = act ? point.indexOf(act) : -1;
    if (at < 0) {
      node.textContent = point;
      return;
    }
    node.appendChild(document.createTextNode(point.slice(0, at)));
    node.appendChild(el('strong', '', act));
    node.appendChild(document.createTextNode(point.slice(at + act.length)));
  }

  /* 捲動清單下面還有內容時，底部淡出提示；捲到底就恢復。 */
  const FADE_LISTS = '#card-scroll, #prep-body, #gear-scroll, .gear-left, .ending-scroll, .ending-left, .ending-right';
  function updateScrollFade(n) {
    n.classList.toggle('has-more', n.scrollHeight - n.scrollTop - n.clientHeight > 6);
  }
  function setupScrollFade() {
    let queued = false;
    const refresh = () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => {
        queued = false;
        document.querySelectorAll(FADE_LISTS).forEach(updateScrollFade);
      });
    };
    document.addEventListener('scroll', (e) => {
      if (e.target instanceof Element && e.target.matches(FADE_LISTS)) updateScrollFade(e.target);
    }, true);
    window.addEventListener('resize', refresh);
    const watch = new MutationObserver(refresh);
    ['card', 'prep-screen', 'ending-screen'].forEach((id) => watch.observe($(id), { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['hidden', 'open'] }));
  }

  const ui = {
    handlers: {},

    init(handlers) {
      this.handlers = handlers;
      const ticks = $('route-ticks');
      SECTIONS.slice(1).forEach((s) => {
        const tick = el('i', 'route-tick');
        tick.style.left = `${(s.from / FINISH_X) * 100}%`;
        ticks.appendChild(tick);
      });

      $('btn-start').addEventListener('click', handlers.start);
      $('btn-again').addEventListener('click', handlers.again);
      $('btn-mountains').addEventListener('click', handlers.mountains);
      $('btn-howto').addEventListener('click', () => this.showHelp());
      $('btn-help').addEventListener('click', () => this.showHelp());
      $('btn-records').addEventListener('click', () => this.showRecords());
      $('btn-retry').addEventListener('click', handlers.retryLoad);
      $('btn-share').addEventListener('click', handlers.share);
      $('modal-close').addEventListener('click', () => this.closeModal());
      $('modal').addEventListener('pointerdown', (e) => {
        if (e.target === $('modal')) this.closeModal();
      });
      $('card-next').addEventListener('click', handlers.next);
      $('prompt').addEventListener('click', handlers.interact);
      $('btn-interact').addEventListener('click', handlers.interact);
      $('btn-sound').addEventListener('click', handlers.toggleSound);
      $('btn-sound-start').addEventListener('click', handlers.toggleSound);
      const actions = $('actions');
      const setActionsOpen = (open) => {
        actions.classList.toggle('open', open);
        $('btn-actions').setAttribute('aria-expanded', String(open));
      };
      $('btn-actions').addEventListener('click', () => setActionsOpen(!actions.classList.contains('open')));
      document.querySelectorAll('.act-btn').forEach((b) => {
        b.addEventListener('click', () => {
          handlers.action(b.dataset.act);
          setActionsOpen(false);
          b.blur();
        });
      });
      $('card-fixed-title').addEventListener('click', () => $('card-scroll').scrollTo({ top: 0, behavior: 'smooth' }));
      setupScrollFade();
      /* bump 播完就拿掉，才不會壓過風險過半的輕晃動畫 */
      $('hud-risk').addEventListener('animationend', (e) => {
        if (e.animationName === 'bump') $('hud-risk').classList.remove('bump');
      });
      this.setSound(false);
    },

    setScreen(name) {
      $('start-screen').hidden = name !== 'start';
      $('ending-screen').hidden = name !== 'ending';
      $('prep-screen').hidden = name !== 'prep';
      const playing = name === 'play' || name === 'card';
      $('hud').hidden = !playing;
      $('controls').hidden = name !== 'play';
      $('card').hidden = name !== 'card';
      if (name !== 'play') this.setPrompt(null);
    },

    setSound(on) {
      ['btn-sound', 'btn-sound-start'].forEach((id) => {
        const b = $(id);
        b.innerHTML = on ? SOUND_ICON.on : SOUND_ICON.off;
        b.setAttribute('aria-pressed', String(on));
        const label = on ? '關閉音效' : '開啟音效';
        b.setAttribute('aria-label', label);
        b.title = `${label}（M）`;
        b.classList.toggle('is-on', on);
      });
    },

    setLoadState(state, count) {
      const start = $('btn-start');
      const notice = $('load-notice');
      if (state === 'loading') {
        start.disabled = true;
        start.textContent = '整理背包中…';
        notice.hidden = true;
      } else if (state === 'ok') {
        start.disabled = false;
        start.textContent = '開始登山';
        notice.hidden = true;
      } else if (state === 'fallback') {
        start.disabled = false;
        start.textContent = '開始登山';
        notice.hidden = false;
        $('load-notice-text').textContent = `題庫暫時讀不到，可能是網路不穩。先用內建的精簡題庫（${count} 題）出發也可以，或再試一次。`;
      } else {
        start.disabled = true;
        start.textContent = '暫時無法開始';
        notice.hidden = false;
        $('load-notice-text').textContent = '題庫讀不到，山路資料還沒送到。請確認網路後再試一次。';
      }
    },

    /* 裝備或題庫讀不到時的原版模式提示 */
    setPrepNotice(text) {
      $('load-notice').hidden = false;
      $('load-notice-text').textContent = text;
    },

    /* 山岳、季節與目前路段的天氣 */
    setTripHud(text) {
      const n = $('hud-trip');
      n.hidden = !text;
      if (text && n.textContent !== text) n.textContent = text;
    },

    /* peak 為所選山岳的山頂高度：走到山頂時顯示實際數字，其他地方取整到 10 公尺 */
    updateHud(x, altitude, sectionName, risk, peak) {
      const pct = Math.round(Math.min(1, Math.max(0, x / FINISH_X)) * 100);
      const shown = peak && altitude >= peak - 3 ? peak : Math.round(altitude / 10) * 10;
      const alt = `海拔 ${shown.toLocaleString('en-US')}m`;
      if (lastHud.stage !== sectionName) {
        $('hud-stage').textContent = sectionName;
        lastHud.stage = sectionName;
      }
      if (lastHud.alt !== alt) {
        $('hud-alt').textContent = alt;
        lastHud.alt = alt;
      }
      if (lastHud.pct !== pct) {
        $('route-fill').style.width = `${pct}%`;
        $('route-dot').style.left = `${pct}%`;
        $('route-bar').setAttribute('aria-valuenow', String(pct));
        lastHud.pct = pct;
      }
      this.updateRisk(risk);
    },

    updateRisk(risk) {
      const color = riskColor(risk);
      const fill = $('risk-fill');
      $('risk-num').textContent = String(Math.round(risk));
      $('hud-risk').classList.toggle('is-warn', risk > 50);
      fill.style.width = `${Math.min(100, risk)}%`;
      fill.style.background = color;
      $('risk-bar').setAttribute('aria-valuenow', String(Math.round(risk)));
      $('risk-face-bg').setAttribute('fill', color);
      const face = FACES.find((f) => risk < f.max);
      $('risk-face-mouth').setAttribute('d', face.mouth);
      $('risk-face-drop').setAttribute('opacity', String(face.drop));
    },

    bumpRisk() {
      const n = $('hud-risk');
      n.classList.remove('bump');
      void n.offsetWidth;
      n.classList.add('bump');
    },

    /* 換區時讓 HUD 的區域名稱亮一下 */
    flashStage() {
      const n = $('hud-stage');
      n.classList.remove('flash');
      void n.offsetWidth;
      n.classList.add('flash');
    },

    setPrompt(text) {
      const p = $('prompt');
      if (!text) {
        p.hidden = true;
        $('btn-interact').classList.remove('is-ready');
        return;
      }
      if (p.textContent !== text) p.textContent = text;
      p.hidden = false;
      $('btn-interact').classList.add('is-ready');
    },

    setInteractLabel(near) {
      const btn = $('btn-interact');
      const label = near ? '查看狀況' : '互動';
      if (btn.textContent !== label) btn.textContent = label;
    },

    /* 靠近事件：右下主鈕是主要入口；手機的中央提示只教第一次，互動過就收起 */
    setNearEvent(near, touch, hintDone) {
      this.setInteractLabel(near);
      if (!near) {
        this.setPrompt(null);
        return;
      }
      const mobile = touch || window.matchMedia('(max-width: 760px)').matches;
      if (mobile && hintDone) {
        $('prompt').hidden = true;
        $('btn-interact').classList.add('is-ready');
        return;
      }
      this.setPrompt(touch ? '前方有狀況，點這裡查看' : '前方有狀況，按 E／空白鍵查看');
    },

    /* 同時只顯示一則，位置貼著 HUD 實際底緣 */
    toast(message, kind) {
      const box = $('toasts');
      const t = el('div', `toast ${kind || ''}`, message);
      const hud = $('hud');
      const stageTop = $('stage').getBoundingClientRect().top;
      box.style.top = hud.hidden ? '12px' : `${hud.getBoundingClientRect().bottom - stageTop + 8}px`;
      box.textContent = '';
      box.appendChild(t);
      setTimeout(() => t.classList.add('out'), 2600);
      setTimeout(() => t.remove(), 3000);
    },

    clearToasts() {
      $('toasts').textContent = '';
    },

    openCard(ev, index, total) {
      const s = ev.scenario;
      $('card').classList.toggle('is-key', !!s.key);
      $('card-key-strip').hidden = !s.key;
      $('card-key-name').textContent = s.key ? s.keyConcept : '';
      $('card-tag').textContent = s.category || '情境';
      $('card-count').textContent = `${ev.dayLabel ? `${ev.dayLabel}・` : ''}第 ${index + 1} / ${total} 題`;
      $('card-title').textContent = s.title;
      const fixedTitle = $('card-fixed-title');
      fixedTitle.textContent = s.title;
      fixedTitle.setAttribute('aria-label', `${s.title}，回到題目與選項`);
      $('card-sit').textContent = s.situation;
      const note = $('card-gear-note');
      note.hidden = !ev.gearNote;
      note.textContent = ev.gearNote || '';
      const opts = $('card-opts');
      opts.textContent = '';
      ev.options.forEach((opt, i) => {
        const b = el('button', 'opt');
        b.type = 'button';
        b.dataset.i = String(i);
        b.appendChild(el('span', 'opt-key', String(i + 1)));
        b.appendChild(el('span', 'opt-text', opt.text));
        b.addEventListener('click', () => this.handlers.answer(i));
        opts.appendChild(b);
      });
      $('card-fb').hidden = true;
      $('card-foot').hidden = true;
      const card = $('card');
      card.classList.remove('answered', 'is-right', 'is-wrong', 'shake');
      $('card-scroll').scrollTop = 0;
      card.focus({ preventScroll: true });
    },

    /* result 只有走準備流程才有：修飾後的風險與裝備說明 */
    showAnswer(ev, displayIndex, sos, result) {
      const chosen = ev.options[displayIndex];
      const shownRisk = result ? result.final : chosen.risk;
      const card = $('card');
      card.classList.add('answered', chosen.correct ? 'is-right' : 'is-wrong');
      if (!chosen.correct) {
        void card.offsetWidth;
        card.classList.add('shake');
      }
      document.querySelectorAll('#card-opts .opt').forEach((b, i) => {
        const opt = ev.options[i];
        b.disabled = true;
        if (opt.correct) b.classList.add('correct');
        if (i === displayIndex && !opt.correct) b.classList.add('wrong');
        const key = b.querySelector('.opt-key');
        if (opt.correct) key.textContent = '✓';
        else if (i === displayIndex) key.textContent = '✕';
      });
      const head = $('fb-head');
      head.textContent = '';
      if (chosen.correct) {
        head.appendChild(el('strong', '', '判斷正確！'));
        head.appendChild(el('span', 'fb-gain', '+10 經驗'));
        if (shownRisk > 0) head.appendChild(el('span', 'fb-loss', `出事風險 +${shownRisk}`));
      } else {
        head.appendChild(el('strong', '', '這樣有點危險'));
        head.appendChild(el('span', 'fb-loss', `出事風險 +${shownRisk}`));
      }
      this.showGearEffect(result);
      $('fb-why').textContent = ev.scenario.why;
      const src = ev.scenario.sources;
      const isKey = !!ev.scenario.key;
      $('fb-key').hidden = !isKey;
      fillKeyPoint($('fb-key-point'), isKey ? ev.scenario.keyPoint : '', ev.scenario.keyAct);
      fillSources($('fb-key-src'), '來源：', isKey ? src : null);
      fillSources($('fb-src'), '參考：', isKey ? null : src);
      $('card-fb').hidden = false;
      const next = $('card-next');
      next.textContent = sos ? '風險破表，發出求救' : '繼續前進';
      next.classList.toggle('btn-sos', !!sos);
      $('card-foot').hidden = false;
      next.focus({ preventScroll: true });
      /* 卡片高度已隨 .answered 放大；只捲內層，把解說帶進視野 */
      const scroll = $('card-scroll');
      const box = scroll.getBoundingClientRect();
      const fb = $('card-fb').getBoundingClientRect();
      const need = Math.min(fb.bottom - box.bottom, fb.top - box.top);
      if (need > 0) scroll.scrollTop += need;
    },

    showGearEffect(result) {
      const box = $('fb-gear');
      box.textContent = '';
      box.className = 'fb-gear';
      const info = result && result.info;
      if (!info || (!info.headline && !info.lines.length && !info.correctTip)) {
        box.hidden = true;
        return;
      }
      box.hidden = false;
      if (info.correctTip) {
        box.classList.add('tip');
        box.appendChild(el('p', 'fb-gear-main', info.correctTip));
        return;
      }
      box.classList.add(result.delta > 0 ? 'more' : result.delta < 0 ? 'less' : 'same');
      if (info.headline) box.appendChild(el('p', 'fb-gear-main', info.headline));
      info.lines.forEach((t) => box.appendChild(el('p', '', t)));
      if (info.details.length) {
        const det = el('details');
        det.appendChild(el('summary', '', '完整明細'));
        info.details.forEach((t) => det.appendChild(el('p', '', t)));
        box.appendChild(det);
      }
    },

    /* 結局的行前準備與裝備影響回顧卡 */
    showTripEnding(trip) {
      const line = $('ending-trip');
      const box = $('ending-prep');
      line.hidden = !trip;
      box.hidden = !trip;
      $('btn-mountains').hidden = !trip;
      $('btn-again').textContent = trip ? '帶著本趟清單再練習' : '再玩一次';
      document.querySelector('.ending-btns').classList.toggle('has-trip', !!trip);
      box.textContent = '';
      if (!trip) return;
      line.textContent = trip.summary;

      const prepCard = el('details', 'trip-card');
      prepCard.id = 'card-prep-review';
      const ps = el('summary');
      ps.appendChild(el('span', 'sum-title', '行前準備'));
      ps.appendChild(el('span', 'trip-score', `行前風險 ${trip.preparation.risk}／${trip.preparation.cap}`));
      prepCard.appendChild(ps);
      const pb = el('div', 'trip-body');
      const groups = el('ul', 'trip-groups');
      Object.values(trip.preparation.groups).forEach((g) => groups.appendChild(el('li', '', `${g.name} ${g.score}／${g.cap}`)));
      pb.appendChild(groups);
      if (trip.improvements.length) {
        pb.appendChild(el('h4', '', '可以先改善'));
        const ul = el('ul');
        trip.improvements.forEach((t) => ul.appendChild(el('li', '', t)));
        pb.appendChild(ul);
      }
      pb.appendChild(el('h4', '', '當時的裝備'));
      pb.appendChild(el('p', '', trip.gearText));
      pb.appendChild(el('p', 'trip-note', '已勾選閱讀本路線許可與住宿需求（模擬）。實際申請與留守計畫請依官方公告辦理。'));
      prepCard.appendChild(pb);
      box.appendChild(prepCard);

      const gearCard = el('details', 'trip-card');
      gearCard.id = 'card-gear-review';
      const gs = el('summary');
      gs.appendChild(el('span', 'sum-title', '裝備影響回顧'));
      gs.appendChild(el('span', 'trip-score', `+${trip.impact.added}／−${trip.impact.avoided}`));
      gearCard.appendChild(gs);
      const gb = el('div', 'trip-body');
      gb.appendChild(el('p', 'trip-total', `危險選項因缺裝多 ${trip.impact.added} 分；有備援少 ${trip.impact.avoided} 分。`));
      gb.appendChild(el('p', 'trip-note', '這是相對原題的比較，不代表能用裝備換取冒險。'));
      if (trip.log.length) {
        const ul = el('ul', 'trip-log');
        trip.log.forEach((r) => {
          const li = el('li');
          li.dataset.id = r.id;
          li.appendChild(el('b', '', r.title));
          li.appendChild(el('span', '', r.text));
          ul.appendChild(li);
        });
        gb.appendChild(ul);
      } else {
        gb.appendChild(el('p', '', '這趟沒有選到會被裝備影響的危險選項。'));
      }
      const rec = el('p', 'trip-recon');
      rec.id = 'trip-recon';
      rec.textContent = `對帳：行前 ${trip.preparation.risk} ＋ 途中 ${trip.eventTotal} ＝ 累積 ${trip.risk}`;
      gb.appendChild(rec);
      gearCard.appendChild(gb);
      box.appendChild(gearCard);
    },

    /* 本趟抽到的保命觀念：需複習排前面，提前求援沒遇到的另外標示 */
    showKeyEnding(items) {
      const box = $('ending-key');
      const list = $('ending-key-list');
      list.textContent = '';
      box.hidden = !items.length;
      if (!items.length) return;
      const LABEL = { ng: '需複習', ok: '已答對', skip: '沒遇到' };
      const RANK = { ng: 0, skip: 1, ok: 2 };
      items.slice().sort((a, b) => RANK[a.status] - RANK[b.status]).forEach((k) => {
        const li = el('li', `ending-key-item ${k.status}`);
        li.dataset.id = k.id;
        li.appendChild(el('span', 'ending-key-name', k.concept));
        li.appendChild(el('span', 'ending-key-status', LABEL[k.status]));
        list.appendChild(li);
      });
      $('ending-key-score').textContent = `答對 ${items.filter((k) => k.status === 'ok').length} / ${items.length}`;
    },

    showEnding(data) {
      const { grade, risk, answers, totalEvents, exp, best, freshBadges, isNewBest } = data;
      this.showTripEnding(data.trip || null);
      this.showKeyEnding(data.keyConcepts || []);
      $('ending-screen').dataset.tier = grade.tier;
      $('ending-kicker').textContent = grade.kicker;
      $('ending-title').textContent = grade.title;
      $('ending-msg').textContent = grade.message;
      const riskEl = $('ending-risk');
      riskEl.textContent = `${Math.round(risk)}%`;
      const right = answers.filter((a) => a.correct).length;
      $('ending-correct').textContent = `${right} / ${answers.length}`;
      $('ending-exp').textContent = String(exp);
      $('ending-best').textContent = isNewBest
        ? '這是你目前的最佳紀錄！'
        : best ? `最佳紀錄：${best.title}（風險 ${best.risk}%）` : '';

      const badgeBox = $('ending-badges');
      badgeBox.textContent = '';
      freshBadges.forEach((id) => {
        const b = BADGES.find((x) => x.id === id);
        if (b) badgeBox.appendChild(el('span', 'badge-chip', `新徽章：${b.name}`));
      });

      const left = totalEvents - answers.length;
      const wrong = answers.filter((a) => !a.correct).length;
      const hint = wrong ? '答錯的題目已展開，答對的點開可看理由。' : '全部答對！點開任一題可複習理由。';
      $('summary-note').textContent = left > 0
        ? `這趟在途中啟動求救，還有 ${left} 題沒遇到，下次再把它們走完。${hint}`
        : `這趟遇到 ${answers.length} 個情境。${hint}`;

      const list = $('summary-list');
      list.textContent = '';
      const ordered = answers.filter((a) => !a.correct).concat(answers.filter((a) => a.correct));
      ordered.forEach((a) => {
        const li = el('li', `sum-item ${a.correct ? 'ok' : 'ng'}${a.key ? ' is-key' : ''}`);
        const det = el('details');
        det.open = !a.correct;
        const sum = el('summary');
        sum.appendChild(el('span', 'sum-title', a.title));
        sum.appendChild(el('span', a.correct ? 'sum-res ok' : 'sum-res ng', a.correct ? '答對' : `風險 +${a.risk}`));
        det.appendChild(sum);

        const { key, rest } = splitWhy(a.why);
        const body = el('div', 'sum-body');
        body.appendChild(el('p', 'sum-key', key));
        if (!a.correct) body.appendChild(el('p', 'sum-sit', a.situation));
        const dl = el('dl');
        dl.appendChild(el('dt', '', '你的選擇'));
        dl.appendChild(el('dd', a.correct ? 'c-ok' : 'c-ng', a.chosen));
        if (!a.correct) {
          dl.appendChild(el('dt', '', '正確答案'));
          dl.appendChild(el('dd', 'c-ok', a.answer));
        }
        if (rest) {
          dl.appendChild(el('dt', '', '為什麼'));
          dl.appendChild(el('dd', '', rest));
        }
        body.appendChild(dl);
        if (a.sources && a.sources.length) {
          const srcLine = el('p', 'sum-src');
          fillSources(srcLine, '參考：', a.sources);
          body.appendChild(srcLine);
        }
        det.appendChild(body);
        li.appendChild(det);
        list.appendChild(li);
      });
      document.querySelector('.ending-scroll').scrollTop = 0;
      document.querySelector('.ending-left').scrollTop = 0;
      document.querySelector('.ending-right').scrollTop = 0;
      $('btn-again').focus({ preventScroll: true });
    },

    get modalOpen() { return !$('modal').hidden; },

    openModal(title, body) {
      $('modal-title').textContent = title;
      const box = $('modal-body');
      box.textContent = '';
      box.appendChild(body);
      $('modal').hidden = false;
      this.handlers.modalChange(true);
      $('modal-close').focus({ preventScroll: true });
    },

    closeModal() {
      if ($('modal').hidden) return;
      $('modal').hidden = true;
      this.handlers.modalChange(false);
    },

    showHelp() {
      const wrap = el('div', 'help');
      const rows = [
        ['走動', '方向鍵或 WASD；也可以點地面，登山客會自己走過去。手機用左下角搖桿。'],
        ['看周圍', '在畫面上按住拖曳，就能看看前後的風景。'],
        ['情境事件', '路上的圓形圖示就是事件，橘框是下一個。走近會自動開啟；出現「查看」時按 E、空白鍵或互動鈕，也可以提早查看。'],
        ['回答', '點選項或按 1、2、3 回答，看完解說按「繼續前進」。'],
        ['保命觀念', '紅框救生圈的事件是一定要會的保命題，每趟都會遇到幾題，結局會列出哪些還要複習。'],
        ['小動作', '沒有事件時，按 1 揮手、2 喝水、3 拍照。'],
        ['出事風險', '選錯會增加風險，天色也會跟著變差；累積到 100 就得發出求救。'],
        ['音效', '預設靜音，按喇叭圖示或 M 鍵開關。'],
      ];
      const dl = el('dl', 'help-list');
      rows.forEach(([k, v]) => {
        dl.appendChild(el('dt', '', k));
        dl.appendChild(el('dd', '', v));
      });
      wrap.appendChild(dl);
      wrap.appendChild(el('p', 'help-note', '目標：平安走到「平安下山」牌樓，把風險壓得越低越好。'));
      wrap.appendChild(el('p', 'help-note help-sos', LEGAL_FULL));
      this.openModal('操作說明', wrap);
    },

    showRecords() {
      const d = store.data;
      const wrap = el('div', 'records');
      const stats = el('div', 'records-stats');
      [['遊玩次數', d.plays], ['完成路線', d.finishes], ['求救結局', d.rescues]].forEach(([k, v]) => {
        const box = el('div');
        box.appendChild(el('span', '', k));
        box.appendChild(el('b', '', String(v)));
        stats.appendChild(box);
      });
      wrap.appendChild(stats);

      const bestBox = el('div', 'records-best');
      bestBox.appendChild(el('span', '', '最佳紀錄'));
      bestBox.appendChild(el('strong', '', d.best ? `${d.best.title}（風險 ${d.best.risk}%）` : '還沒有紀錄，先走一趟吧！'));
      if (d.best && d.best.date) bestBox.appendChild(el('small', '', d.best.date));
      wrap.appendChild(bestBox);

      const total = this.handlers.bankSize();
      const seen = Object.keys(d.seen).filter((id) => !id.startsWith('prep-')).length;
      wrap.appendChild(el('p', 'records-seen', `已看過 ${Math.min(seen, total || seen)}${total ? ` / ${total}` : ''} 個情境，下次會優先遇到沒看過的題目。`));

      wrap.appendChild(el('h3', '', '徽章'));
      const grid = el('div', 'badge-grid');
      BADGES.forEach((b) => {
        const on = d.badges.includes(b.id);
        const cell = el('div', `badge ${on ? 'on' : ''}`);
        cell.appendChild(el('strong', '', b.name));
        cell.appendChild(el('span', '', on ? b.desc : `未解鎖：${b.desc}`));
        grid.appendChild(cell);
      });
      wrap.appendChild(grid);

      const reset = el('button', 'btn btn-small btn-ghost', '清除所有紀錄');
      reset.type = 'button';
      let armed = false;
      reset.addEventListener('click', () => {
        if (!armed) {
          armed = true;
          reset.textContent = '確定要清除嗎？再按一次';
          return;
        }
        store.reset();
        this.showRecords();
      });
      wrap.appendChild(reset);
      this.openModal('成就與最佳紀錄', wrap);
    },
  };

  DH.ui = ui;
})();
