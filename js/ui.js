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
    const scrollable = /auto|scroll/.test(getComputedStyle(n).overflowY);
    n.classList.toggle('has-more', scrollable && n.scrollHeight - n.scrollTop - n.clientHeight > 6);
    updateMoreHint();
  }
  /* 光靠淡出，玩家會以為下面的按鈕是停用的；明白寫出還能往下捲。全頁只有一顆，跟著目前可捲的清單走 */
  const HINT_LISTS = ['#gear-scroll', '#prep-body', '.ending-left', '.ending-right'];
  let moreHintEl = null;
  function updateMoreHint() {
    /* 捲過一次就知道能捲了，提示別再蓋住正在讀的字 */
    const owner = HINT_LISTS.map((q) => document.querySelector(q)).find((n) => n && n.offsetParent && n.clientHeight > 100 && /auto|scroll/.test(getComputedStyle(n).overflowY) && n.classList.contains('has-more') && n.scrollTop < 24);
    if (!owner) {
      if (moreHintEl && !moreHintEl.hidden) moreHintEl.hidden = true;
      return;
    }
    if (!moreHintEl) {
      moreHintEl = el('button', 'more-hint', '往下還有 ▾');
      moreHintEl.type = 'button';
      moreHintEl.tabIndex = -1;
      moreHintEl.setAttribute('aria-hidden', 'true');
      document.body.appendChild(moreHintEl);
    }
    moreHintEl.onclick = () => owner.scrollBy({ top: owner.clientHeight * 0.7, behavior: DH.art.reducedMotion() ? 'auto' : 'smooth' });
    if (moreHintEl.hidden) moreHintEl.hidden = false;
    const box = owner.getBoundingClientRect();
    moreHintEl.style.left = `${box.left + box.width / 2}px`;
    moreHintEl.style.top = `${box.bottom - 40}px`;
    const hint = moreHintEl.getBoundingClientRect();
    moreHintEl.hidden = Array.from(owner.querySelectorAll('h2, h3, h4, legend, #ending-safety')).some((n) => {
      const r = n.getBoundingClientRect();
      return r.bottom > hint.top && r.top < hint.bottom && r.right > hint.left && r.left < hint.right;
    });
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
      const syncHeroPick = (gender) => {
        const radio = document.querySelector(`#hero-pick input[value="${gender}"]`);
        if (radio) radio.checked = true;
      };
      syncHeroPick(DH.player.gender);
      DH.player.onChange = syncHeroPick;
      $('hero-pick').addEventListener('change', (e) => DH.player.set(e.target.value));
      $('start-slogan').textContent = DH.core.SLOGANS.start;
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
      /* 開局時 HUD 的文字和提示同一刻更新，等排版完成再量高度 */
      requestAnimationFrame(() => {
        box.style.top = hud.hidden ? '12px' : `${hud.getBoundingClientRect().bottom - stageTop + 8}px`;
      });
      box.textContent = '';
      box.appendChild(t);
      setTimeout(() => t.classList.add('out'), 2600);
      setTimeout(() => t.remove(), 3000);
    },

    clearToasts() {
      $('toasts').textContent = '';
    },

    /* 觀察現場：標記釘在 3D 物件上，點開才知道看到什麼 */
    setPlayControlsInert(on) {
      ['hud', 'controls', 'hints', 'actions', 'prompt'].forEach((id) => { $(id).inert = on; });
    },
    trapFocus(e, id) {
      const box = $(id);
      const buttons = Array.from(box.querySelectorAll('button:not(:disabled), a[href], summary, input, select, textarea, [tabindex="0"]'))
        .filter((n) => n.getClientRects().length && !n.closest('[hidden], [inert]'));
      const at = buttons.indexOf(document.activeElement);
      if (!buttons.length) { e.preventDefault(); box.focus({ preventScroll: true }); return; }
      if (at < 0 || (!e.shiftKey && at === buttons.length - 1) || (e.shiftKey && at === 0)) {
        e.preventDefault();
        buttons[e.shiftKey ? buttons.length - 1 : 0].focus();
      }
    },
    openObserve(stage, onClue, onGo) {
      $('observe-title').textContent = stage.title;
      $('observe-notes').textContent = '';
      const spots = $('observe-spots');
      spots.textContent = '';
      stage.list.forEach((c, i) => {
        const b = el('button', 'observe-spot');
        b.type = 'button';
        b.appendChild(el('span', 'observe-num', String(i + 1)));
        b.appendChild(el('span', '', c.name));
        b.addEventListener('click', () => onClue(i));
        spots.appendChild(b);
      });
      const go = $('observe-go');
      go.onclick = onGo;
      $('observe').hidden = false;
      $('observe-panel').scrollTop = 0;
      this.updateObserve(0, Math.min(2, stage.list.length));
      spots.firstChild.focus({ preventScroll: true });
    },
    noteClue(i, clue) {
      const spot = $('observe-spots').children[i];
      spot.classList.add('seen');
      const li = el('li', '');
      li.appendChild(el('b', '', clue.name));
      li.appendChild(el('span', '', clue.text));
      $('observe-notes').appendChild(li);
    },
    updateObserve(count, need) {
      const go = $('observe-go');
      const ready = count >= need;
      go.textContent = ready ? '我看好了，做判斷' : `再看 ${need - count} 處`;
      go.setAttribute('aria-disabled', String(!ready));
      go.classList.toggle('is-waiting', !ready);
      if (ready && count === need) go.focus();
    },
    placeObserve(points) {
      const app = $('app').getBoundingClientRect();
      const panel = $('observe-panel').getBoundingClientRect();
      const placed = [];
      const spots = $('observe-spots');
      spots.classList.remove('as-list');
      Array.from($('observe-spots').children).forEach((b, i) => {
        const w = b.offsetWidth;
        const x = Math.max(w / 2 + 8, Math.min(app.width - w / 2 - 8, points[i].x));
        let y = Math.max(46, Math.min(panel.top - app.top - 34, points[i].y));
        /* 標記不互相疊住，也不跑到說明面板底下 */
        placed.forEach((q) => {
          if (Math.abs(q.x - x) < (w + q.w) / 2 + 6 && Math.abs(q.y - y) < 42) y = q.y - 46;
        });
        y = Math.max(30, y);
        placed.push({ x, y, w });
        b.style.transform = `translate(${Math.round(x - w / 2)}px, ${Math.round(y - 20)}px)`;
      });
      const overlaps = placed.some((p, i) => placed.slice(0, i).some((q) => Math.abs(p.x - q.x) < (p.w + q.w) / 2 + 6 && Math.abs(p.y - q.y) < 46));
      if (overlaps || panel.top - app.top < 180) {
        spots.classList.add('as-list');
        Array.from(spots.children).forEach((b) => { b.style.transform = ''; });
      }
    },
    closeObserve() {
      $('observe').hidden = true;
    },

    openCard(ev, index, total) {
      const s = ev.scenario;
      $('card').classList.remove('fb-brief');
      $('card').classList.toggle('is-key', !!s.key);
      $('card-key-strip').hidden = !s.key;
      $('card-key-name').textContent = s.key ? s.keyConcept : '';
      $('card-tag').textContent = s.category || '情境';
      $('card-count').textContent = `${ev.dayLabel ? `${ev.dayLabel}・` : ''}第 ${index + 1} / ${total} 題`;
      const observed = !!(ev.seenNotes && ev.seenNotes.length && ev.ask);
      /* 看過現場的題目用地名當標題：危險要靠剛才自己看，不由標題說破 */
      const title = observed ? (ev.place && ev.place !== s.title ? ev.place : '前方路段') : s.title;
      $('card-title').textContent = title;
      const fixedTitle = $('card-fixed-title');
      fixedTitle.textContent = title;
      fixedTitle.setAttribute('aria-label', `${title}，回到題目與選項`);
      $('card-sit').textContent = observed ? ev.ask : s.situation;
      const note = $('card-gear-note');
      note.hidden = !ev.gearNote;
      note.textContent = ev.gearNote || '';
      const seen = $('card-seen');
      seen.hidden = !(ev.seen && ev.seen.length);
      seen.textContent = '';
      seen.open = false;
      /* 線索收起來：題目只問怎麼做，判斷要靠剛才自己看到的，忘了才點開回看 */
      if (!seen.hidden) seen.appendChild(el('summary', '', `回看剛才記下的 ${ev.seenNotes.length} 條線索`));
      (ev.seenNotes || []).forEach((note) => seen.appendChild(el('span', '', note)));
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
        if (shownRisk > 0) head.appendChild(el('span', 'fb-loss', `風險點數 +${shownRisk}`));
      } else {
        head.appendChild(el('strong', '', '這樣有點危險'));
        head.appendChild(el('span', 'fb-loss', `風險點數 +${shownRisk}`));
        /* 捲到解說時看不到題目了，把自己選的那句留在最上面 */
        head.appendChild(el('p', 'fb-chosen', `你選的是：${chosen.text}`));
      }
      this.showGearEffect(result);
      const world = $('fb-world');
      world.hidden = !ev.worldNote;
      world.textContent = '';
      if (ev.worldNote) {
        world.appendChild(el('p', 'fb-world-text', ev.worldNote.text));
        if (ev.worldNote.missed.length) world.appendChild(el('p', 'fb-world-missed', `你沒看到的線索：${ev.worldNote.missed.join(' ')}`));
      }
      if (ev.worldNote && ev.worldNote.halt) world.appendChild(el('p', 'fb-world-real', `這裡是練習，遊戲會帶你走完路線。${DH.core.SLOGANS.turnBack}`));
      $('fb-why').textContent = ev.scenario.why;
      const src = ev.scenario.sources;
      const isKey = !!ev.scenario.key;
      /* 保命題已經有「保命重點」，完整解說收起來，不重複講同一件事 */
      const more = $('fb-more');
      more.open = !isKey;
      more.classList.toggle('is-plain', !isKey);
      $('fb-key').hidden = !isKey;
      fillKeyPoint($('fb-key-point'), isKey ? ev.scenario.keyPoint : '', ev.scenario.keyAct);
      fillSources($('fb-key-src'), '來源：', isKey ? src : null);
      fillSources($('fb-src'), '參考：', isKey ? null : src);
      $('card-fb').hidden = false;
      const next = $('card-next');
      next.textContent = sos ? '風險破表，只能求救' : ev.worldNote && ev.worldNote.halt ? '下一段練習' : '回到山路';
      next.classList.toggle('btn-sos', !!sos);
      $('card-foot').hidden = false;
      /* 手機直式：先把畫面留給現場的回應，想看解析再展開 */
      if (ev.worldNote && matchMedia('(max-width: 760px) and (orientation: portrait)').matches) {
        next.dataset.after = next.textContent;
        next.textContent = '看解析';
        $('card').classList.add('fb-brief');
      }
      next.focus({ preventScroll: true });
      /* 卡片高度已隨 .answered 放大；只捲內層，把解說帶進視野 */
      const scroll = $('card-scroll');
      const box = scroll.getBoundingClientRect();
      const fb = $('card-fb').getBoundingClientRect();
      const need = Math.min(fb.bottom - box.bottom, fb.top - box.top);
      if (need > 0) scroll.scrollTop += need;
    },

    /* 回傳 true 表示這一下是展開解析，不是繼續前進 */
    expandBrief() {
      const card = $('card');
      if (!card.classList.contains('fb-brief')) return false;
      card.classList.remove('fb-brief');
      const next = $('card-next');
      next.textContent = next.dataset.after;
      $('card-scroll').scrollTop = 0;
      $('card-fb').scrollIntoView({ block: 'start' });
      return true;
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

    showRescueReview(review) {
      const box = $('ending-review');
      box.textContent = '';
      box.hidden = !review || !(review.causes.length || review.fixes.length);
      if (box.hidden) return;
      /* 檢討排在右欄最上面，別被其他回顧蓋過去 */
      box.parentElement.prepend(box);
      const section = (title, items, cls) => {
        if (!items.length) return;
        box.appendChild(el('h4', '', title));
        const list = el(cls === 'fixes' ? 'ol' : 'ul', cls);
        items.forEach((t) => list.appendChild(el('li', '', t)));
        box.appendChild(list);
      };
      box.classList.toggle('is-lesson', !!review.lesson);
      section(review.lesson ? '這趟最值得改的決定' : '這趟為什麼走到這一步', review.causes, 'causes');
      section(review.lesson ? '下一次這樣做' : '下一趟先改這幾件', review.fixes, 'fixes');
    },

    showEnding(data) {
      const { grade, risk, answers, totalEvents, exp, best, freshBadges, isNewBest } = data;
      this.showTripEnding(data.trip || null);
      this.showKeyEnding(data.keyConcepts || []);
      this.showTrail(data.trail);
      $('ending-screen').dataset.tier = grade.tier;
      $('ending-kicker').textContent = grade.kicker;
      $('ending-title').textContent = grade.title;
      $('ending-slogan').textContent = DH.core.SLOGANS[grade.tier] || '';
      $('ending-msg').textContent = grade.message;
      const safety = $('ending-safety');
      safety.hidden = !grade.safety;
      safety.textContent = grade.safety || '';
      this.showRescueReview(data.review);
      const riskEl = $('ending-risk');
      riskEl.textContent = `${Math.round(risk)} / 100`;
      const right = answers.filter((a) => a.correct).length;
      $('ending-correct').textContent = `${right} / ${answers.length}`;
      $('ending-exp').textContent = String(exp);
      $('ending-best').textContent = grade.tier === 'bad' ? '' : isNewBest
        ? '這是你目前的最佳紀錄！'
        : best ? `最佳紀錄：${best.title}（風險 ${best.risk} 點）` : '';

      const badgeBox = $('ending-badges');
      badgeBox.textContent = '';
      /* 動用救援的一趟不發獎勵，徽章留到平安下山再看 */
      (grade.tier === 'bad' ? [] : freshBadges).forEach((id) => {
        const b = BADGES.find((x) => x.id === id);
        if (b) badgeBox.appendChild(el('span', 'badge-chip', `新徽章：${b.name}`));
      });

      const left = totalEvents - answers.length;
      const wrong = answers.filter((a) => !a.correct).length;
      const hint = wrong ? '答錯的題目已展開，答對的點開可看理由。' : '全部答對！點開任一題可複習理由。';
      $('summary-note').textContent = left > 0
        ? `這趟沒有走完，還有 ${left} 題沒遇到。${hint}`
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

    /* 這趟的足跡：海拔剖面上標出每個決定，讓「哪一步出事」一眼看見 */
    showTrail(trail) {
      const box = $('ending-trail');
      box.textContent = '';
      box.hidden = !trail;
      if (!trail) return;
      const W = 640;
      const H = 170;
      const alts = trail.samples.map((s) => s.alt);
      const lo = Math.min(...alts);
      const hi = Math.max(...alts);
      const px = (x) => 14 + ((x - trail.startX) / (trail.endX - trail.startX)) * (W - 28);
      const py = (alt) => H - 30 - ((alt - lo) / Math.max(1, hi - lo)) * (H - 66);
      const NS = 'http://www.w3.org/2000/svg';
      const node = (name, attrs, parent) => {
        const n = document.createElementNS(NS, name);
        Object.entries(attrs).forEach(([k, v]) => n.setAttribute(k, v));
        parent.appendChild(n);
        return n;
      };
      box.appendChild(el('h4', '', '這趟的足跡'));
      const svg = document.createElementNS(NS, 'svg');
      svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
      svg.setAttribute('role', 'img');
      const wrong = trail.stops.filter((s) => !s.correct).length;
      svg.setAttribute('aria-label', `海拔剖面圖，從登山口 ${Math.round(alts[0])} 公尺到最高 ${Math.round(hi)} 公尺。沿途 ${trail.stops.length} 個決定，${wrong} 個判斷失誤。`);
      const pts = trail.samples.map((s) => `${px(s.x).toFixed(1)},${py(s.alt).toFixed(1)}`);
      node('polygon', { points: `${px(trail.startX)},${H - 22} ${pts.join(' ')} ${px(trail.endX)},${H - 22}`, class: 'trail-area' }, svg);
      node('polyline', { points: pts.join(' '), class: 'trail-line' }, svg);
      trail.stops.forEach((s) => {
        const dot = node('circle', { cx: px(s.x), cy: py(s.alt), r: s.correct ? 6 : 8, class: s.correct ? 'trail-ok' : 'trail-ng' }, svg);
        node('title', {}, dot).textContent = `${s.title}：${s.correct ? '判斷正確' : `風險 +${s.risk}`}`;
      });
      const label = (x, text, anchor) => {
        const t = node('text', { x, y: H - 6, class: 'trail-label', 'text-anchor': anchor }, svg);
        t.textContent = text;
      };
      label(14, '登山口', 'start');
      label(W - 14, trail.stops.length && trail.stops[trail.stops.length - 1].x < trail.endX * 0.6 ? '未走完' : '下山', 'end');
      box.appendChild(svg);
      const legend = el('p', 'trail-legend');
      legend.append(el('i', 'dot-ok'), '判斷正確', el('i', 'dot-ng'), '判斷失誤');
      box.appendChild(legend);
      if (trail.worst) {
        const worst = el('p', 'trail-worst');
        worst.appendChild(el('b', '', '這趟最險的一步'));
        worst.appendChild(document.createTextNode(`${trail.worst.title}（海拔約 ${Math.round(trail.worst.alt).toLocaleString('en-US')} 公尺，風險 +${trail.worst.risk}）`));
        box.appendChild(worst);
      }
      if (trail.body.length) {
        const ul = el('ul', 'trail-body');
        trail.body.forEach((b) => ul.appendChild(el('li', b.tone, b.text)));
        box.appendChild(ul);
      }
    },

    /* 分享用的直式成績卡：可下載或傳給朋友的 PNG */
    async shareCardFile(end, trip, trail, url) {
      const W = 1080;
      const H = 1350;
      const cv = document.createElement('canvas');
      cv.width = W;
      cv.height = H;
      const c = cv.getContext('2d');
      const font = (size, weight) => `${weight} ${size}px ${DH.art.FONT}`;
      c.fillStyle = '#fff8e8';
      c.fillRect(0, 0, W, H);
      const painting = trip && DH.gearArt.paintings[`mtn-${trip.mountain.id}`];
      if (painting) {
        c.save();
        c.beginPath();
        c.rect(0, 0, W, 620);
        c.clip();
        DH.gearArt.drawCover(c, painting, W, 620);
        c.restore();
      } else {
        c.fillStyle = '#a9ddf5';
        c.fillRect(0, 0, W, 620);
      }
      if (trip) DH.art.drawHiker(c, DH.hero3d.active ? 875 : 540, 600, { t: 1, scale: 2.2, pose: 'wave', outfit: trip.selection, blinkSeed: 2 });
      c.textAlign = 'left';
      c.fillStyle = '#bd542b';
      c.font = font(36, 700);
      c.fillText(trip ? `${trip.mountain.name}｜${DH.prepLogic.seasonName(trip.season)}` : '數位登山', 70, 700);
      c.fillStyle = '#2f6b52';
      /* 長標題縮字，不要超出卡片 */
      c.font = font(92, 800);
      const titleSize = Math.min(92, Math.floor((92 * (W - 140)) / c.measureText(end.title).width));
      c.font = font(titleSize, 800);
      c.fillText(end.title, 70, 805);
      c.fillStyle = '#4b4136';
      c.font = font(40, 700);
      const right = trail.stops.filter((s) => s.correct).length;
      c.fillText(`風險點數 ${Math.round(end.risk)} / 100　　判斷正確 ${right} / ${trail.stops.length}`, 70, 880);
      const alts = trail.samples.map((s) => s.alt);
      const lo = Math.min(...alts);
      const hi = Math.max(...alts);
      const px = (x) => 70 + ((x - trail.startX) / (trail.endX - trail.startX)) * (W - 140);
      const py = (alt) => 1170 - ((alt - lo) / Math.max(1, hi - lo)) * 210;
      c.beginPath();
      c.moveTo(px(trail.startX), 1190);
      trail.samples.forEach((s) => c.lineTo(px(s.x), py(s.alt)));
      c.lineTo(px(trail.endX), 1190);
      c.closePath();
      c.fillStyle = '#dcebd9';
      c.fill();
      trail.stops.forEach((s) => {
        c.beginPath();
        c.arc(px(s.x), py(s.alt), s.correct ? 11 : 15, 0, Math.PI * 2);
        c.fillStyle = s.correct ? '#2f8f62' : '#d0482f';
        c.fill();
      });
      c.fillStyle = '#6d6255';
      c.font = font(32, 500);
      c.fillText('《數位登山》你會帶什麼上山？', 70, 1270);
      c.font = font(26, 500);
      /* 本機網址給別人也開不了，不印在卡片上 */
      if (!/^https?:\/\/(localhost|127\.|\[::1\])/.test(url)) c.fillText(url, 70, 1312);
      const blob = await new Promise((resolve, reject) => cv.toBlob((b) => (b ? resolve(b) : reject(new Error('無法輸出圖片'))), 'image/png'));
      return new File([blob], '數位登山成績卡.png', { type: 'image/png' });
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
        ['回答', '點選項或按 1、2、3 回答，看完解說按下方按鈕繼續。'],
        ['保命觀念', '紅框救生圈的事件是一定要會的保命題，每趟都會遇到幾題，結局會列出哪些還要複習。'],
        ['小動作', '沒有事件時，按 1 揮手、2 喝水、3 拍照。'],
        ['風險點數', '選錯會增加點數，天色也會跟著變差；累積到 100，這趟就失敗，得動用救援。點數是遊戲的教學量表，不是真實的事故機率。'],
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
      [['遊玩次數', d.plays], ['完成路線', d.finishes], ['動用救援', d.rescues]].forEach(([k, v]) => {
        const box = el('div');
        box.appendChild(el('span', '', k));
        box.appendChild(el('b', '', String(v)));
        stats.appendChild(box);
      });
      wrap.appendChild(stats);

      const bestBox = el('div', 'records-best');
      bestBox.appendChild(el('span', '', '最佳紀錄'));
      bestBox.appendChild(el('strong', '', d.best ? `${d.best.title}（風險 ${d.best.risk} 點）` : '還沒有紀錄，先走一趟吧！'));
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
