#!/usr/bin/env python3
"""數位登山煙霧測試：實際走動、作答、到結局，並輸出截圖。"""
import hashlib
import json
import pathlib
import subprocess
import sys
import time

from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
SHOTS = ROOT / "screenshots"
PORT = 8765
URL = f"http://localhost:{PORT}/index.html"

STAGES = {"trailhead": 16, "forest": 16, "ridge": 14, "summit": 8, "descent": 14}
failures = []


def check(cond, label):
    print(("  ok  " if cond else "  FAIL") + " " + label)
    if not cond:
        failures.append(label)


def mock_bank():
    """模擬置換後的完整題庫，才能測抽題配額與風險破表。"""
    out = []
    for stage, n in STAGES.items():
        for i in range(n):
            ans = i % 3
            risk = [40, 40, 40]
            risk[ans] = 0
            out.append({
                "id": f"{stage}-{i}", "category": "模擬分類", "stage": stage,
                "title": f"{stage} 情境 {i}",
                "situation": "你走到一段濕滑的路，天色開始變暗，隊友在後方喊著要你等一下，前方的路標也有點看不清楚。",
                "options": [f"選項{j}：先確認狀況再決定下一步該怎麼走才安全" for j in range(3)],
                "answer": ans, "risk": risk,
                "why": "這是用來測試版面的解說文字，長度接近正式題庫：先停下來判斷，再決定行動。貿然前進可能讓小問題變成大事故，請保留體力與退路。",
                "sources": ["模擬來源"],
            })
    return out


def new_page(browser, errors, mobile=False, bank=None):
    if mobile:
        ctx = browser.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2,
                                  is_mobile=True, has_touch=True)
    else:
        ctx = browser.new_context(viewport={"width": 1280, "height": 720})
    page = ctx.new_page()
    page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
    page.on("pageerror", lambda e: errors.append(str(e)))
    if bank is not None:
        page.route("**/data/scenarios.json", lambda r: r.fulfill(
            status=200, content_type="application/json", body=json.dumps(bank)))
    return page


def open_game(page, query="?seed=123"):
    """既有流程都在測原版模式；準備流程另有 prep_* 測試。"""
    page.goto(URL + query + ("&" if "?" in query else "?") + "classic=1")
    page.wait_for_function("window.__game && window.__game.state.bankReady")
    page.wait_for_timeout(250)


def g(page, expr):
    return page.evaluate(f"window.__game.{expr}")


def play_through(page, pick):
    """用真實的 interact 流程走完所有事件。pick 為 correctIndex 或 wrongIndex。"""
    while True:
        if g(page, "state.screen") == "ending":
            return
        if g(page, "teleportToNextEvent()") is None:
            return
        page.wait_for_timeout(40)
        page.keyboard.press("e")
        page.wait_for_selector("#card:not([hidden])")
        page.evaluate(f"window.__game.answer(window.__game.{pick}())")
        page.wait_for_selector("#card-foot:not([hidden])")
        page.evaluate("window.__game.continue()")
        page.wait_for_timeout(30)


def desktop_flow(browser, errors):
    print("桌面版（正式題庫）")
    bank = mock_bank()
    page = new_page(browser, errors)
    open_game(page)
    page.screenshot(path=str(SHOTS / "start.png"))
    check(page.locator("#btn-start").is_enabled(), "開始按鈕可按")
    check("112" in page.inner_text("#legal"), "頁尾有求救電話")

    page.click("#btn-howto")
    check(page.locator("#modal").is_visible(), "操作說明彈窗開啟")
    page.screenshot(path=str(SHOTS / "help.png"))
    page.keyboard.press("Escape")
    check(not page.locator("#modal").is_visible(), "Esc 可關閉彈窗")
    page.click("#btn-records")
    page.screenshot(path=str(SHOTS / "records.png"))
    page.click("#modal-close")

    page.click("#btn-start")
    check(g(page, "state.bankSize") >= 50, "載入完整題庫")
    check(g(page, "state.screen") == "play", "進入遊戲")
    events = g(page, "state.events.map(e => e.scenario.stage)")
    ids = g(page, "state.events.map(e => e.scenario.id)")
    check(10 <= len(events) <= 12, f"題數 10–12（{len(events)}）")
    check(len(set(ids)) == len(ids), "題目不重複")
    limits = {"trailhead": (2, 3), "forest": (2, 3), "ridge": (2, 3), "summit": (1, 2), "descent": (2, 3)}
    for k, (lo, hi) in limits.items():
        check(lo <= events.count(k) <= hi, f"{k} 配額 {events.count(k)}")
    xs = g(page, "state.events.map(e => e.x)")
    check(xs == sorted(xs), "事件沿路線排序")

    x0 = g(page, "state.player.x")
    page.keyboard.down("ArrowRight")
    page.wait_for_timeout(500)
    page.keyboard.up("ArrowRight")
    x1 = g(page, "state.player.x")
    check(x1 > x0 + 40, f"方向鍵走動 {x0:.0f}→{x1:.0f}")
    d0 = g(page, "state.player.d")
    page.keyboard.down("s")
    page.wait_for_timeout(250)
    page.keyboard.up("s")
    check(g(page, "state.player.d") > d0, "WASD 可上下走動")

    page.mouse.click(1100, 480)
    page.wait_for_timeout(500)
    x2 = g(page, "state.player.x")
    check(x2 > x1 + 40, f"點地面走過去 {x1:.0f}→{x2:.0f}")
    page.keyboard.press("ArrowLeft")
    check(g(page, "view.walkTarget") is None, "按方向鍵會取消自動行走")
    page.wait_for_timeout(60)

    page.mouse.move(800, 300)
    page.mouse.down()
    page.mouse.move(500, 300, steps=4)
    pan = g(page, "view.pan")
    page.mouse.up()
    check(pan > 100, f"拖曳看周圍 pan={pan:.0f}")
    check(g(page, "view.walkTarget") is None, "拖曳不會變成走路")

    page.keyboard.press("2")
    page.wait_for_timeout(100)
    check(g(page, "state.player.pose") == "drink", "按 2 喝水")

    # 實際走到事件點，自動觸發
    ev_x = g(page, "state.events[0].x")
    page.evaluate(f"window.__game.state.player.x = {ev_x} - 200")
    page.keyboard.down("ArrowRight")
    page.wait_for_function("window.__game.state.nearEvent || window.__game.state.screen === 'card'", timeout=4000)
    check(page.locator("#prompt").is_visible() or g(page, "state.screen") == "card", "靠近提示出現")
    page.wait_for_selector("#card:not([hidden])", timeout=4000)
    page.keyboard.up("ArrowRight")
    check(g(page, "state.screen") == "card", "走近自動觸發")
    page.wait_for_timeout(450)
    page.screenshot(path=str(SHOTS / "scenario.png"))

    opts = page.locator("#card-opts .opt")
    check(opts.count() == 3, "三個選項")
    check(min(opts.nth(i).bounding_box()["height"] for i in range(3)) >= 48, "選項高度 ≥ 48px")

    # 答錯：按鍵盤選項
    wrong = g(page, "wrongIndex()")
    n = g(page, "state.current.options[%d].risk" % wrong)
    page.keyboard.press(str(wrong + 1))
    check(g(page, "state.risk") == n, f"答錯風險 +{n}")
    check(f"+{n}" in page.inner_text("#fb-head"), "卡片顯示風險 +N")
    check(page.locator("#card-fb").is_visible() and len(page.inner_text("#fb-why")) > 5, "同卡片顯示解說")
    page.wait_for_timeout(400)
    page.screenshot(path=str(SHOTS / "scenario-wrong.png"))
    page.keyboard.press("Space")
    check(g(page, "state.screen") == "play", "空白鍵繼續前進")
    page.wait_for_timeout(100)

    # 答對：點按鈕
    g(page, "teleportToNextEvent()")
    page.wait_for_timeout(60)
    check(page.locator("#prompt").is_visible(), "teleport 後顯示靠近提示")
    page.click("#prompt")
    check(g(page, "state.screen") == "card", "點提示開啟事件")
    r0 = g(page, "state.risk")
    page.locator("#card-opts .opt").nth(g(page, "correctIndex()")).click()
    check(g(page, "state.risk") == r0, "答對風險不變")
    check(g(page, "state.exp") == 10, "答對加經驗")
    check(g(page, "state.streak") == 1, "答對累計連續次數")
    page.wait_for_timeout(350)
    check(g(page, "view.particles.length") > 0, "答對有小花粒子")
    page.screenshot(path=str(SHOTS / "scenario-right.png"))
    page.wait_for_timeout(300)
    page.click("#card-next")

    # 一路答對到森林段截圖，再走到終點
    while g(page, "state.current") is None:
        ev = page.evaluate("(() => { const s = window.__game.state; return s.events[s.eventIndex]?.scenario.stage; })()")
        if ev != "trailhead":
            break
        g(page, "triggerNextEvent()")
        page.evaluate("window.__game.answer(window.__game.correctIndex())")
        page.evaluate("window.__game.continue()")
    page.evaluate("window.__game.state.player.x = 2130")
    page.wait_for_timeout(1300)
    check(g(page, "state.screen") in ("play", "card"), "森林段正常")
    if g(page, "state.screen") == "card":
        page.evaluate("window.__game.answer(window.__game.correctIndex())")
        page.evaluate("window.__game.continue()")
        page.wait_for_timeout(200)
    page.screenshot(path=str(SHOTS / "walking-forest.png"))

    # 各段場景巡禮（只截圖）
    for name, x in [("ridge", 3900), ("summit", 5300), ("descent", 6650)]:
        page.evaluate(f"""() => {{
            const g = window.__game;
            while (g.state.events[g.state.eventIndex] && g.state.events[g.state.eventIndex].x < {x} + 60) {{
                g.triggerNextEvent(); g.answer(g.correctIndex()); g.continue();
            }}
            g.state.player.x = {x};
        }}""")
        page.wait_for_timeout(1100)
        page.screenshot(path=str(SHOTS / f"walking-{name}.png"))

    play_through(page, "correctIndex")
    check(g(page, "teleportToFinish()"), "可走向終點")
    page.keyboard.down("ArrowRight")
    page.wait_for_selector("#ending-screen:not([hidden])", timeout=4000)
    page.keyboard.up("ArrowRight")
    end = g(page, "state.ending")
    first_risk = end["risk"]
    check(end["completed"] and end["tier"] == "good", f"好結局：{end['title']}（風險 {first_risk}）")
    answered = page.locator("#summary-list li").count()
    check(answered == len(events), f"總結列出 {answered} 題")
    page.wait_for_timeout(500)
    page.screenshot(path=str(SHOTS / "ending-good.png"))
    plays = page.evaluate("JSON.parse(localStorage.getItem('digital-hiking.v1')).plays")
    check(plays == 1, "localStorage 記錄遊玩次數")

    # 再玩一次：優先抽沒看過的題
    page.click("#btn-again")
    check(g(page, "state.screen") == "play", "再玩一次")
    check(g(page, "state.risk") == 0, "風險歸零")
    ids2 = g(page, "state.events.map(e => e.scenario.id)")
    overlap = set(ids) & set(ids2)
    check(not overlap, f"第二趟不重複上一趟（重疊 {len(overlap)}）")

    # 壞結局：一路答錯到破表
    r = 0
    while r < 12:
        g(page, "triggerNextEvent()")
        page.evaluate("""() => {
            const g = window.__game, opts = g.state.current.options;
            const worst = opts.reduce((b, o, i) => (o.risk > opts[b].risk ? i : b), 0);
            g.answer(worst);
        }""")
        r += 1
        if g(page, "state.risk") >= 100:
            break
        g(page, "continue()")
    check(g(page, "state.risk") == 100, f"風險封頂 100（第 {r} 題）")
    page.wait_for_timeout(1200)
    check("求救" in page.inner_text("#card-next"), "破表後按鈕改為求救")
    page.screenshot(path=str(SHOTS / "scenario-sos.png"))
    page.evaluate("window.__game.continue()")
    end = g(page, "state.ending")
    check(not end["completed"] and end["tier"] == "bad" and end["title"] == "這場救援本來可以避免", "壞結局：這場救援本來可以避免")
    check(page.locator("#summary-list li").count() == r, "壞結局總結只列走過的題目")
    page.wait_for_timeout(500)
    page.screenshot(path=str(SHOTS / "ending-bad.png"))
    best = page.evaluate("JSON.parse(localStorage.getItem('digital-hiking.v1')).best")
    check(best["completed"] and best["risk"] == first_risk, "最佳紀錄仍是完成的那趟")

    # 普通結局
    g(page, "startGame()")
    g(page, "skipToEnding('normal')")
    page.wait_for_timeout(500)
    check(g(page, "state.ending.title") == "驚險下山", "50–79 驚險下山")
    page.screenshot(path=str(SHOTS / "ending-normal.png"))
    for risk, title in [(0, "平安滿載的山神級登山客"), (19, "平安滿載的山神級登山客"), (20, "有驚無險"),
                        (49, "有驚無險"), (50, "驚險下山"), (79, "驚險下山"), (80, "險象環生"), (99, "險象環生"), (100, "這場救援本來可以避免")]:
        g(page, "startGame()")
        got = page.evaluate(f"window.__game.skipToEnding({risk}).title")
        check(got == title, f"風險 {risk} → {title}")
    page.context.close()

    print("風險視覺")
    page = new_page(browser, errors, bank=bank)
    open_game(page)
    page.click("#btn-start")
    page.evaluate("() => { const s = window.__game.state; s.player.x = 3900; s.events.length = 0; s.risk = 85; s.riskView = 85; }")
    page.wait_for_timeout(700)
    page.screenshot(path=str(SHOTS / "risk-high.png"))
    page.context.close()

    print("音效、暫停、縮放、分享")
    page = new_page(browser, errors)
    open_game(page)
    page.click("#btn-sound-start")
    check(page.get_attribute("#btn-sound-start", "aria-pressed") == "true", "音效可開啟（預設靜音）")
    page.click("#btn-start")
    page.keyboard.down("ArrowRight")
    page.wait_for_timeout(500)
    page.keyboard.up("ArrowRight")
    page.keyboard.press("m")
    check(page.get_attribute("#btn-sound", "aria-pressed") == "false", "M 鍵關閉音效")

    page.evaluate("""() => {
        Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
        document.dispatchEvent(new Event('visibilitychange'));
    }""")
    check(g(page, "state.paused") is True, "切換頁籤暫停")
    t0 = g(page, "view.t")
    page.wait_for_timeout(200)
    check(g(page, "view.t") == t0, "暫停時不更新")
    page.evaluate("""() => {
        Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
        document.dispatchEvent(new Event('visibilitychange'));
    }""")
    page.wait_for_timeout(200)
    check(g(page, "view.t") > t0 and g(page, "state.paused") is False, "切回後恢復")

    page.set_viewport_size({"width": 900, "height": 500})
    page.wait_for_timeout(150)
    check(page.evaluate("document.getElementById('scene').width") == 900, "視窗縮放後畫布跟著調整")
    g(page, "skipToEnding('good')")
    page.wait_for_timeout(100)
    page.click("#btn-share")
    page.wait_for_timeout(150)
    check(page.locator(".toast").count() >= 1, "分享有回饋")
    page.context.close()

    print("固定種子")
    orders = []
    for _ in range(2):
        p = new_page(browser, errors, bank=bank)
        open_game(p, "?seed=777")
        p.click("#btn-start")
        orders.append(g(p, "state.events.map(e => [e.scenario.id, e.options.map(o => o.orig)])"))
        p.context.close()
    check(orders[0] == orders[1], "?seed 固定抽題與選項順序")
    shuffled = any(o[1] != [0, 1, 2] for o in orders[0])
    check(shuffled, "選項有洗牌")


def small_bank_flow(browser, errors):
    print("題庫不足時從其他 stage 補")
    bank = [s for s in mock_bank() if s["stage"] == "trailhead"] + [s for s in mock_bank() if s["stage"] == "summit"][:1]
    page = new_page(browser, errors, bank=bank)
    open_game(page)
    page.click("#btn-start")
    n = g(page, "state.events.length")
    stages = g(page, "state.events.map(e => e.scenario.stage)")
    check(10 <= n <= 12 and stages.count("summit") == 1, f"偏斜題庫仍抽滿 {n} 題")
    page.context.close()

    print("內建 3 題題庫走完全程")
    page = new_page(browser, errors, bank=[])
    open_game(page, "?seed=5")
    check(g(page, "state.bankSource") == "fallback" and g(page, "state.bankSize") == 3, "空題庫退回內建題庫")
    page.click("#btn-start")
    play_through(page, "correctIndex")
    g(page, "teleportToFinish()")
    page.keyboard.down("ArrowRight")
    page.wait_for_selector("#ending-screen:not([hidden])", timeout=5000)
    page.keyboard.up("ArrowRight")
    check(g(page, "state.ending.risk") == 0, "全對風險 0")
    page.context.close()


def load_failure_flow(browser):
    print("題庫載入失敗")
    ctx = browser.new_context(viewport={"width": 1280, "height": 720})
    page = ctx.new_page()
    page.route("**/data/scenarios.json", lambda r: r.abort())
    page.goto(URL)
    page.wait_for_function("window.__game && window.__game.state.bankReady")
    check(page.locator("#load-notice").is_visible(), "顯示友善錯誤")
    check(page.locator("#btn-start").is_enabled(), "可用內建題庫開始")
    page.screenshot(path=str(SHOTS / "load-error.png"))
    page.unroute("**/data/scenarios.json")
    page.click("#btn-retry")
    page.wait_for_function("window.__game.state.bankSource === 'file'")
    check(not page.locator("#load-notice").is_visible(), "重試成功後提示消失")
    ctx.close()

    print("file:// 開啟")
    errs = []
    ctx = browser.new_context()
    page = ctx.new_page()
    page.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)
    page.on("pageerror", lambda e: errs.append(str(e)))
    page.goto((ROOT / "index.html").as_uri())
    page.wait_for_function("window.__game && window.__game.state.bankReady")
    check(g(page, "state.bankSource") == "fallback", "file:// 使用內建題庫")
    check(not errs, f"file:// 無 console error {errs}")
    ctx.close()


def mobile_flow(browser, errors):
    print("手機直式 390x844")
    page = new_page(browser, errors, mobile=True)
    open_game(page)
    page.screenshot(path=str(SHOTS / "mobile-start.png"))
    check(page.evaluate("document.getElementById('scene').width") == 780, "畫布依 devicePixelRatio 繪製")
    page.tap("#btn-start")
    page.wait_for_timeout(300)
    check(page.locator("#joy").is_visible(), "顯示搖桿")
    check(page.locator("#btn-interact").is_visible(), "顯示互動鈕")
    x0 = g(page, "state.player.x")
    box = page.locator("#joy").bounding_box()
    cx, cy = box["x"] + box["width"] / 2, box["y"] + box["height"] / 2
    page.mouse.move(cx, cy)
    page.mouse.down()
    page.mouse.move(cx + 45, cy, steps=3)
    page.wait_for_timeout(500)
    page.mouse.up()
    x1 = g(page, "state.player.x")
    check(x1 > x0 + 40, f"搖桿走動 {x0:.0f}→{x1:.0f}")
    page.touchscreen.tap(330, 560)
    page.wait_for_timeout(450)
    check(g(page, "state.player.x") > x1 + 20, "觸控地面走過去")

    page.evaluate("""() => {
        const g = window.__game;
        while (g.state.events[g.state.eventIndex].x < 2100) { g.triggerNextEvent(); g.answer(g.correctIndex()); g.continue(); }
        g.state.player.x = 2130;
    }""")
    page.wait_for_timeout(1300)
    page.screenshot(path=str(SHOTS / "mobile-walking-forest.png"))

    g(page, "teleportToNextEvent()")
    page.wait_for_timeout(100)
    page.tap("#btn-interact")
    check(g(page, "state.screen") == "card", "互動鈕開啟事件")
    page.wait_for_timeout(700)
    page.screenshot(path=str(SHOTS / "mobile-scenario.png"))
    page.locator("#card-opts .opt").nth(g(page, "wrongIndex()")).tap()
    page.wait_for_timeout(700)
    page.screenshot(path=str(SHOTS / "mobile-scenario-answered.png"))
    box = page.locator("#card-next").bounding_box()
    check(box and box["y"] + box["height"] <= 844, "繼續前進按鈕在畫面內")
    page.wait_for_timeout(200)
    page.tap("#card-next")
    check(g(page, "state.screen") == "play", "繼續前進")

    g(page, "skipToEnding('good')")
    page.wait_for_timeout(500)
    page.screenshot(path=str(SHOTS / "mobile-ending-good.png"))
    check(page.locator("#btn-again").is_visible(), "再玩一次可見")
    g(page, "startGame()")
    g(page, "skipToEnding('bad')")
    page.wait_for_timeout(500)
    page.screenshot(path=str(SHOTS / "mobile-ending-bad.png"))
    page.context.close()

    print("最長題目的手機版面")
    page = new_page(browser, errors, mobile=True)
    open_game(page)
    page.tap("#btn-start")
    page.evaluate("""async () => {
        const bank = await (await fetch('data/scenarios.json')).json();
        const size = (s) => s.situation.length + s.why.length + s.options.join('').length;
        const longest = bank.reduce((a, b) => (size(b) > size(a) ? b : a));
        const ev = window.__game.state.events[0];
        ev.scenario = longest;
        ev.options = longest.options.map((text, orig) => ({ text, orig, risk: longest.risk[orig], correct: orig === longest.answer }));
    }""")
    g(page, "triggerNextEvent()")
    page.wait_for_timeout(500)
    page.locator("#card-opts .opt").nth(g(page, "wrongIndex()")).tap()
    page.wait_for_timeout(600)
    page.screenshot(path=str(SHOTS / "mobile-scenario-longest.png"))
    box = page.locator("#card-next").bounding_box()
    check(box and box["y"] + box["height"] <= 844, "最長題目的繼續按鈕仍在畫面內")
    card = page.locator("#card").bounding_box()
    hud = page.locator("#hud").bounding_box()
    check(card["y"] >= hud["y"] + hud["height"] - 1, "卡片不蓋住 HUD")
    fits = page.evaluate("(() => { const s = document.getElementById('card-scroll'); s.scrollTop = 1e6; const f = document.getElementById('card-fb').getBoundingClientRect(); return f.bottom <= s.getBoundingClientRect().bottom + 1; })()")
    check(fits, "解說可捲動讀完")
    page.context.close()

    print("手機橫式 844x390")
    ctx = browser.new_context(viewport={"width": 844, "height": 390}, device_scale_factor=2, is_mobile=True, has_touch=True)
    page = ctx.new_page()
    page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
    page.on("pageerror", lambda e: errors.append(str(e)))
    open_game(page)
    page.screenshot(path=str(SHOTS / "mobile-landscape-start.png"))
    page.tap("#btn-start")
    page.wait_for_timeout(600)
    page.screenshot(path=str(SHOTS / "mobile-landscape-walking.png"))
    g(page, "triggerNextEvent()")
    page.wait_for_timeout(600)
    page.screenshot(path=str(SHOTS / "mobile-landscape-scenario.png"))
    page.locator("#card-opts .opt").nth(0).tap()
    page.wait_for_timeout(400)
    page.screenshot(path=str(SHOTS / "mobile-landscape-answered.png"))
    box = page.locator("#card-next").bounding_box()
    check(box and box["y"] + box["height"] <= 390, "橫式繼續按鈕在畫面內")
    ctx.close()

AUDIT_SHOTS = SHOTS / "audit"

# 找出：文字被截斷、超出視窗、互相重疊的元素。只看目前可見的元素。
AUDIT_JS = """(selectors) => {
    const issues = [];
    const vw = innerWidth, vh = innerHeight;
    const visible = (n) => {
        const r = n.getBoundingClientRect();
        const cs = getComputedStyle(n);
        return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none';
    };
    const label = (n) => n.id ? '#' + n.id : n.tagName.toLowerCase() + '.' + n.className;
    document.querySelectorAll('#stage *, #legal, #legal *').forEach((n) => {
        if (!visible(n) || n.closest('svg') || n.tagName === 'CANVAS') return;
        const hasText = [...n.childNodes].some((c) => c.nodeType === 3 && c.textContent.trim());
        if (!hasText) return;
        const r = n.getBoundingClientRect();
        const scroller = n.closest('.card-scroll, .ending-scroll, .ending-left, .ending-right, .modal-box, .start-card');
        if (!scroller && (r.left < -1 || r.right > vw + 1 || r.top < -1 || r.bottom > vh + 1)) issues.push('超出視窗 ' + label(n));
        if (n.scrollWidth > n.clientWidth + 1 && getComputedStyle(n).overflow !== 'visible') issues.push('文字截斷 ' + label(n));
        if (scroller && r.right > scroller.getBoundingClientRect().right + 1) issues.push('橫向溢出 ' + label(n));
    });
    for (let i = 0; i < selectors.length; i++) {
        for (let j = i + 1; j < selectors.length; j++) {
            const a = document.querySelector(selectors[i]);
            const b = document.querySelector(selectors[j]);
            if (!a || !b || !visible(a) || !visible(b)) continue;
            const x = a.getBoundingClientRect(), y = b.getBoundingClientRect();
            if (x.left < y.right - 1 && y.left < x.right - 1 && x.top < y.bottom - 1 && y.top < x.bottom - 1) {
                issues.push('重疊 ' + selectors[i] + ' × ' + selectors[j]);
            }
        }
    }
    return issues;
}"""

LAYOUT_PARTS = ["#hud", ".toast", "#prompt", "#card", "#joy", "#btn-interact", "#actions", "#hints", ".start-card"]


def audit(page, tag, name):
    issues = page.evaluate(AUDIT_JS, LAYOUT_PARTS)
    check(not issues, f"{tag} {name} 版面無溢出重疊 {issues[:4]}")
    page.screenshot(path=str(AUDIT_SHOTS / f"{tag}-{name}.png"))


def hero_gap(page):
    """角色腳底、帽頂與卡片、HUD 的實際距離（px）。"""
    return page.evaluate("""() => {
        const g = window.__game, W = window.DH.world, s = g.state.player;
        const c = document.getElementById('scene');
        const L = W.makeLayout(c.clientWidth, c.clientHeight);
        const card = document.getElementById('card').getBoundingClientRect();
        const hud = document.getElementById('hud').getBoundingClientRect();
        const feet = (W.playerY(L, s.x, s.d) - g.view.lift + 6) * L.z;
        const height = 112 * (0.92 + s.d * 0.12) * g.view.heroScale * L.z;
        return { left: card.left, card: card.top, feetGap: card.top - feet, headGap: feet - height - hud.bottom, scale: g.view.heroScale };
    }""")


def layout_audit_flow(browser, errors):
    AUDIT_SHOTS.mkdir(exist_ok=True)
    bank = json.loads((ROOT / "data" / "scenarios.json").read_text(encoding="utf-8"))
    for w, h in [(390, 844), (360, 640), (844, 390), (1440, 900)]:
        tag = f"{w}x{h}"
        print(f"版面稽核 {tag}")
        mobile = w < 1000
        ctx = browser.new_context(viewport={"width": w, "height": h}, device_scale_factor=2 if mobile else 1,
                                  is_mobile=mobile, has_touch=mobile)
        page = ctx.new_page()
        page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
        page.on("pageerror", lambda e: errors.append(str(e)))
        open_game(page)
        audit(page, tag, "start")
        legal_h = page.evaluate("document.getElementById('legal').offsetHeight")
        check(legal_h <= 44, f"{tag} 頁尾不超過兩行（{legal_h}px）")
        lines = page.evaluate("""() => {
            const n = document.querySelector('#legal .legal-short');
            const shown = getComputedStyle(n).display !== 'none';
            if (!shown) return 0;
            const cs = getComputedStyle(document.getElementById('legal'));
            const inner = document.getElementById('legal').clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
            return Math.round(inner / parseFloat(cs.lineHeight));
        }""")
        check(lines <= 2, f"{tag} 短版頁尾最多兩行（{lines}）")
        if mobile and w < h:
            box = page.locator("#btn-start").bounding_box()
            check(52 <= box["height"] <= 56, f"{tag} 開始鈕 52–56px（{box['height']}）")
            a = page.locator("#btn-howto").bounding_box()
            b = page.locator("#btn-records").bounding_box()
            check(abs(a["y"] - b["y"]) < 1, f"{tag} 兩個次要入口同列")
        if mobile:
            lines2 = page.evaluate("(() => { const n = document.getElementById('btn-records'); return n.scrollWidth <= n.clientWidth && n.offsetHeight <= 48; })()")
            check(lines2, f"{tag} 次要入口文字不換行也不溢出")
        page.click("#btn-howto")
        audit(page, tag, "help")
        check("他業者訊號轉接119" in page.inner_text("#modal-body"), f"{tag} 操作說明附上求救說明")
        page.click("#modal-close")
        page.click("#btn-records")
        audit(page, tag, "records")
        page.click("#modal-close")

        page.click("#btn-start")
        page.wait_for_timeout(300)
        if mobile and w < h:
            hud = page.locator("#hud").bounding_box()
            check(104 <= hud["height"] <= 112, f"{tag} HUD 高 104–112（{hud['height']}）")
        audit(page, tag, "walking")
        g(page, "teleportToNextEvent()")
        page.wait_for_timeout(400)
        audit(page, tag, "near-event")
        covered = page.evaluate("""() => {
            const g = window.__game, W = window.DH.world, s = g.state.player;
            const c = document.getElementById('scene');
            const L = W.makeLayout(c.clientWidth, c.clientHeight);
            const x = (s.x - (g.view.cam.x - L.vw / 2)) * L.z;
            const feet = W.playerY(L, s.x, s.d) * L.z;
            const hero = { left: x - 42 * L.z, right: x + 42 * L.z, top: feet - 112 * L.z, bottom: feet };
            return ['#prompt', '#actions', '#joy', '#btn-interact', '#hud'].filter((sel) => {
                const n = document.querySelector(sel);
                if (!n || !n.getBoundingClientRect().width) return false;
                const r = n.getBoundingClientRect();
                return r.left < hero.right && hero.left < r.right && r.top < hero.bottom && hero.top < r.bottom;
            });
        }""")
        check(not covered, f"{tag} 操作元件不蓋住角色 {covered}")

        # 最長題目：最容易溢出
        page.evaluate("""(bank) => {
            const size = (s) => s.situation.length + s.why.length + s.options.join('').length;
            const longest = bank.reduce((a, b) => (size(b) > size(a) ? b : a));
            const g = window.__game, ev = g.state.events[g.state.eventIndex];
            ev.scenario = longest;
            ev.options = longest.options.map((text, orig) => ({ text, orig, risk: longest.risk[orig], correct: orig === longest.answer }));
        }""", bank)
        g(page, "triggerNextEvent()")
        page.wait_for_timeout(1500)
        audit(page, tag, "card")
        def hero_clear(state):
            gap = hero_gap(page)
            if gap["left"] >= 130:
                check(True, f"{tag} {state} 角色在卡片旁")
                return
            check(gap["feetGap"] >= 11, f"{tag} {state} 腳底離卡片 ≥12px（{gap['feetGap']:.0f}，縮放 {gap['scale']:.2f}）")
            check(gap["headGap"] >= 0, f"{tag} {state} 角色完整可見（帽頂距 HUD {gap['headGap']:.0f}）")
        hero_clear("作答前")
        page.evaluate("window.__game.answer(window.__game.wrongIndex())")
        page.wait_for_timeout(1500)
        audit(page, tag, "answered")
        hero_clear("作答後")
        box = page.locator("#card-next").bounding_box()
        check(box and box["y"] + box["height"] <= h, f"{tag} 繼續鈕固定可見")
        g(page, "continue()")
        g(page, "state.riskView = window.__game.state.risk = 62")
        page.wait_for_timeout(300)
        check(page.evaluate("document.getElementById('hud-risk').classList.contains('is-warn')"), f"{tag} 風險過半有警示")
        audit(page, tag, "risk-warn")

        for kind in ("good", "bad"):
            g(page, "startGame()")
            if kind == "bad":
                page.evaluate("""() => {
                    const g = window.__game;
                    g.triggerNextEvent(); g.answer(g.wrongIndex()); g.continue();
                    g.triggerNextEvent(); g.answer(g.correctIndex()); g.continue();
                }""")
            g(page, f"skipToEnding('{kind}')")
            page.wait_for_timeout(500)
            audit(page, tag, f"ending-{kind}")
            box = page.locator("#btn-again").bounding_box()
            check(box and box["y"] + box["height"] <= h, f"{tag} 結局 {kind} 再玩一次在畫面內")
            check(page.locator(".toast").count() == 0 and g(page, "view.particles.length") == 0, f"{tag} 結局清除提示與浮字")
        check(page.locator(".sum-item.ng details[open]").count() >= 1, f"{tag} 答錯題預設展開")
        check(page.locator(".sum-item.ok details[open]").count() == 0, f"{tag} 答對題預設收合")
        ok = page.locator(".sum-item.ok summary").first
        ok.click()
        check(page.locator(".sum-item.ok details[open] .sum-key").first.is_visible(), f"{tag} 答對題可點開")
        ctx.close()


def desktop_card_flow(browser, errors):
    """桌面各階段：角色、事件路標都在卡片外，且完整留在畫面內。"""
    for w, h in [(1440, 900), (1280, 720), (1024, 768), (1920, 1080), (800, 600)]:
        tag = f"{w}x{h}"
        print(f"桌面卡片不遮角色 {tag}")
        ctx = browser.new_context(viewport={"width": w, "height": h})
        page = ctx.new_page()
        page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
        page.on("pageerror", lambda e: errors.append(str(e)))
        open_game(page)
        page.click("#btn-start")

        def measure():
            return page.evaluate("""() => {
                const g = window.__game, W = window.DH.world, p = g.state.player, ev = g.state.current;
                const c = document.getElementById('scene');
                const L = W.makeLayout(c.clientWidth, c.clientHeight);
                const left = g.view.cam.x - L.vw / 2;
                const feet = (W.playerY(L, p.x, p.d) - g.view.lift) * L.z;
                return {
                    stage: ev.scenario.stage, z: L.z,
                    hero: (p.x - left) * L.z, marker: (ev.x - left) * L.z, feet,
                    head: feet - 112 * (0.92 + p.d * 0.12) * g.view.heroScale * L.z,
                    card: document.getElementById('card').getBoundingClientRect().left,
                    hud: document.getElementById('hud').getBoundingClientRect().bottom,
                };
            }""")

        def clear(m):
            return (m["hero"] - 42 * m["z"] >= 0 and m["hero"] + 42 * m["z"] <= m["card"]
                    and m["marker"] - 30 * m["z"] >= 0 and m["marker"] + 30 * m["z"] <= m["card"]
                    and m["head"] >= m["hud"] and m["feet"] <= h)

        bad, stages = [], set()
        while g(page, "teleportToNextEvent()") is not None:
            page.wait_for_timeout(40)
            page.keyboard.press("e")
            page.wait_for_selector("#card:not([hidden])")
            page.wait_for_timeout(900)
            before = measure()
            page.evaluate("window.__game.answer(window.__game.correctIndex())")
            page.wait_for_timeout(300)
            after = measure()
            stages.add(before["stage"])
            bad += [m for m in (before, after) if not clear(m)]
            page.evaluate("window.__game.continue()")
            page.wait_for_timeout(30)
        check(stages == set(STAGES), f"{tag} 走過全部階段 {sorted(stages)}")
        check(not bad, f"{tag} 角色與路標都在卡片外 {bad[:2]}")
        ctx.close()


def option_balance(bank, tag):
    """選項長度不洩漏答案，risk 仍跟著正確選項。"""
    over = []
    for s in bank:
        lens = [len(o) for o in s["options"]]
        mean = sum(lens) / 3
        if max(lens) > mean * 1.25 or min(lens) < mean * 0.75:
            over.append(s["id"])
    check(not over, f"{tag} 三選項字數差距在 ±25% 內 {over[:5]}")
    check(all(s["risk"][s["answer"]] == 0 for s in bank), f"{tag} 正確選項風險為 0")
    counts = [sum(s["answer"] == i for s in bank) for i in range(3)]
    check(max(counts) - min(counts) <= 1, f"{tag} 正解位置平均 {counts}")


def data_rules_flow(browser, errors):
    print("題庫選項平衡")
    current = json.loads((ROOT / "data" / "scenarios.json").read_text(encoding="utf-8"))
    digest = hashlib.sha256(json.dumps(current[:51], ensure_ascii=False, sort_keys=True).encode()).hexdigest()
    check(digest == "e802628c0bc300bbc3bcf976ee8b740103cd359fed705b9a2b18c6e31384266a", "原 51 題內容未更動")
    check(all(s["id"].startswith("prep-") for s in current[51:59]), "接著 8 題都是 prep- 新增題")
    check(all(s["id"].startswith("key-") and s.get("key") is True for s in current[59:]) and len(current[59:]) == 10, "最後 10 題都是 key- 保命題")
    bank = json.loads((ROOT / "data" / "scenarios.json").read_text(encoding="utf-8"))
    check(len(bank) == 69 and len({s["id"] for s in bank}) == 69, f"完整題庫 51＋8＋10 題、id 不重複（{len(bank)}）")
    option_balance(bank, "完整題庫")
    longest = sum(len(s["options"][s["answer"]]) == max(map(len, s["options"])) for s in bank)
    check(longest <= len(bank) * 0.45, f"正確選項不常是最長（{longest}/{len(bank)}）")
    page = new_page(browser, errors)
    open_game(page)
    option_balance(page.evaluate("window.DH_FALLBACK_SCENARIOS"), "內建題庫")
    page.context.close()


def art_rules_flow(browser, errors):
    print("美術規則")
    page = new_page(browser, errors)
    open_game(page)

    # 主按鈕對比
    bg = page.evaluate("getComputedStyle(document.getElementById('btn-start')).backgroundColor")
    check(bg == "rgb(189, 84, 43)", f"主按鈕深橘 {bg}")

    # DOM 與 Canvas 字體相同
    same = page.evaluate("window.DH.art.FONT.replace(/\\s|\"|'/g,'') === getComputedStyle(document.body).fontFamily.replace(/\\s|\"|'/g,'')")
    check(same, "DOM 與 Canvas 字體堆疊相同")

    # 首頁卡片不遮小屋與牌樓
    rect = page.evaluate("""() => {
        const g = window.__game, c = document.querySelector('.start-card').getBoundingClientRect();
        const scene = document.getElementById('scene');
        return { right: c.right, cam: g.view.cam.x, w: scene.clientWidth };
    }""")
    z = page.evaluate("""() => {
        const c = document.querySelector('.start-card').getBoundingClientRect();
        return Math.min(1.05, Math.max(0.6, (innerWidth - c.right - 16) / 960));
    }""")
    left = rect["cam"] - rect["w"] / z / 2
    check((70 - left) * z >= rect["right"], "首頁卡片不遮登山口小屋")
    check((698 - left) * z <= rect["w"], "牌樓完整在畫面內")

    page.click("#btn-start")
    # 乾淨區與稜線草叢數
    clean = page.evaluate("""() => {
        const g = window.__game;
        const veg = new Set(['cedar','broadleaf','fir','fern','shrub','rock','mossrock','mushroom','cane','windgrass','flower']);
        return g.view.decor.filter((it) => !it.hide && veg.has(it.type) && it.oy < 158
            && g.state.events.some((e) => Math.abs(e.x - it.x) < 56)).length;
    }""")
    check(clean == 0, "事件標記周圍 56 單位內沒有植被")
    grass = page.evaluate("window.__game.view.decor.filter((it) => (it.type === 'cane' || it.type === 'windgrass') && it.x >= 3200 && it.x < 4860).length")
    check(60 <= grass <= 85, f"稜線草叢約為原本（111）的 2/3：{grass}")

    # 同類經驗值合併
    page.evaluate("""() => {
        const g = window.__game;
        g.triggerNextEvent(); g.answer(g.correctIndex()); g.continue();
        g.triggerNextEvent(); g.answer(g.correctIndex());
    }""")
    texts = g(page, "view.particles.filter(p => p.kind === 'text').map(p => p.text)")
    check(texts == ["+20 經驗"], f"600ms 內經驗值合併 {texts}")
    page.wait_for_timeout(1400)
    check(g(page, "view.particles.filter(p => p.kind === 'text').length") == 0, "浮字 1.2 秒內淡出")
    g(page, "continue()")

    # 答錯：一個焦點
    g(page, "triggerNextEvent()")
    page.evaluate("window.__game.answer(window.__game.wrongIndex())")
    check(g(page, "view.particles.length") == 0, "答錯沒有浮字與粒子")
    dur = page.evaluate("getComputedStyle(document.getElementById('card')).animationDuration")
    check(dur == "0.18s", f"答錯卡片搖晃 180ms（{dur}）")
    g(page, "continue()")

    # 提示脈動只有兩次
    g(page, "teleportToNextEvent()")
    page.wait_for_timeout(80)
    count = page.evaluate("getComputedStyle(document.getElementById('prompt')).animationIterationCount")
    check(count == "2", f"互動提示脈動兩次（{count}）")

    # 同時只有一則 Toast，且貼著 HUD
    page.evaluate("window.DH.ui.toast('一'); window.DH.ui.toast('二');")
    check(page.locator(".toast").count() == 1, "同時只顯示一則 Toast")
    gap = page.evaluate("document.querySelector('.toast').getBoundingClientRect().top - document.getElementById('hud').getBoundingClientRect().bottom")
    check(abs(gap - 8) < 12, f"Toast 位於 HUD 底緣下方（{gap:.0f}px）")

    # 換區不再跳大標籤
    page.evaluate("window.DH.ui.clearToasts(); window.__game.state.events.length = 0; window.__game.state.player.x = 1500;")
    page.wait_for_timeout(100)
    check(page.locator(".toast").count() == 0, "換區只更新 HUD，不跳提示")
    page.context.close()

    print("prefers-reduced-motion")
    ctx = browser.new_context(viewport={"width": 1280, "height": 720}, reduced_motion="reduce")
    page = ctx.new_page()
    page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
    page.on("pageerror", lambda e: errors.append(str(e)))
    open_game(page)
    x0 = g(page, "state.player.x")
    page.wait_for_timeout(1800)
    check(g(page, "state.player.x") == x0, "首頁角色不走動")
    page.click("#btn-start")
    g(page, "triggerNextEvent()")
    page.evaluate("window.__game.answer(window.__game.correctIndex())")
    page.wait_for_timeout(80)
    check(g(page, "state.player.jump") == 0, "答對不跳")
    check(g(page, "view.particles.filter(p => p.kind === 'flower').length") == 0, "答對沒有花瓣")
    g(page, "continue()")
    g(page, "triggerNextEvent()")
    page.evaluate("window.__game.answer(window.__game.wrongIndex())")
    check(g(page, "view.shakeTime") == 0, "答錯畫面不震動")
    check(page.evaluate("getComputedStyle(document.getElementById('card')).animationName") == "none", "卡片沒有 CSS 動畫")
    g(page, "continue()")
    g(page, "state.riskView = window.__game.state.risk = 70")
    page.wait_for_timeout(100)
    check(page.evaluate("getComputedStyle(document.getElementById('hud-risk')).animationName") == "none", "風險條不晃動")
    ctx.close()


# 出發前準備 ---------------------------------------------------------------
PREP_SHOTS = SHOTS / "prep"
HEADLAMP = "headlamp-before-dark"


def dress_sample(page):
    """這裡測的是配裝之後的行為：跳過逐項選擇（逐項選擇由 flow_test.py 測）。"""
    page.evaluate("""() => {
        const P = window.__game.prep;
        if (P.undecided().length) { P.selection = window.__game.logic.sampleSelection(); P.refreshGear(false); }
    }""")


def open_prep(page, seed=12):
    page.goto(f"{URL}?seed={seed}")
    page.wait_for_function("window.__game && window.__game.state.prepReady")
    page.wait_for_timeout(150)


def safe_seed(page, mountain, season, cond="true"):
    """找一個不必延期、又符合條件 cond（可用 f、b）的種子。"""
    return page.evaluate(f"""() => {{
        const G = window.__game, L = G.logic, m = G.prep.data.mountains.mountains.find(x => x.id === '{mountain}');
        for (let s = 1; s < 20000; s++) {{
            const f = L.generateForecast(m, '{season}', s, 0, 0), b = L.briefFlags(m, f);
            if (!L.postponeReasons(f).length && ({cond})) return s;
        }}
        throw new Error('找不到符合條件的種子');
    }}""")


def press(page, selector, touch=False):
    (page.tap if touch else page.click)(selector)


def walk_to_gear(page, mountain, season, touch=False):
    press(page, "#btn-start", touch)
    page.wait_for_selector("#prep-panel[data-step='mountain']")
    chip = page.locator(f".mtn-chip[data-id='{mountain}']")
    if chip.is_visible():
        press(page, f".mtn-chip[data-id='{mountain}']", touch)
    press(page, f".mtn-card[data-id='{mountain}'] .mtn-pick", touch)
    press(page, "#prep-next", touch)
    press(page, f"[data-season='{season}']", touch)
    press(page, "#prep-next", touch)
    page.wait_for_selector("#gear-preview")
    dress_sample(page)


def prep_flow(browser, errors):
    print("準備流程（1440x900）")
    ctx = browser.new_context(viewport={"width": 1440, "height": 900})
    page = ctx.new_page()
    page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
    page.on("pageerror", lambda e: errors.append(str(e)))
    open_prep(page)
    seed = safe_seed(page, "jiali", "autumn", "b.wet && b.cold")
    open_prep(page, seed)
    plays0 = page.evaluate("window.__game.store.data.plays")
    page.click("#btn-start")
    check(g(page, "state.screen") == "prep", "開始後進入選山")
    cards = page.locator(".mtn-card")
    check(cards.count() == 6, "六座山")
    txt = page.inner_text(".mtn-grid")
    check("1–1" not in txt and "2–2" not in txt, "天數不出現 1–1 這種寫法")
    check(all(k in txt for k in ["海拔", "天數", "步道", "氣候", "許可"]), "選山卡有海拔、天數、步道、氣候、許可")
    check(not page.locator("#prep-next").is_enabled(), "未選山與未勾選不能下一步")
    page.click(".mtn-card[data-id='jiali'] .mtn-pick")
    check("許可" in page.inner_text("#prep-foot"), "選山後下一步旁邊顯示許可需求")
    page.wait_for_timeout(120)
    page.screenshot(path=str(PREP_SHOTS / "01-mountain-select.png"))
    page.click("#prep-next")

    check(not page.locator("#prep-next").is_enabled(), "未選季節不能打包")
    page.click("[data-season='autumn']")
    page.wait_for_selector("#fc-card")
    fc = page.inner_text("#fc-card")
    check("遊戲模擬預報，非即時資料；預報可能改變" in fc, "顯示模擬預報提示")
    check(all(k in fc for k in ["登山口", "山頂", "降雨機率", "風速", "陣風", "特殊天氣"]), "預報欄位齊全")
    page.wait_for_timeout(150)
    page.screenshot(path=str(PREP_SHOTS / "02-forecast.png"))
    f0 = page.evaluate("JSON.stringify(window.__game.prep.forecast)")
    page.click("#prep-next")
    page.click(".prep-back")
    page.click("[data-season='autumn']")
    check(page.evaluate("JSON.stringify(window.__game.prep.forecast)") == f0, "返回並重按同季節不重抽預報")
    page.click("#prep-next")
    page.wait_for_selector("#gear-preview")
    dress_sample(page)

    # 配裝與分頁
    check(page.locator(".gear-opt[data-item='wicking'].on").count() == 1, "測試配裝穿排汗衣")
    check(page.locator(".gear-tab").count() == 3, "穿著／背包／行前分頁")
    base_risk = int(page.inner_text("#prep-risk"))
    check(0 < base_risk <= 45, f"測試配裝有行前風險 {base_risk}")
    check(len(page.inner_text("#prep-why")) > 5, "即時顯示風險原因")
    page.click(".gear-opt[data-item='sandals']")
    check(int(page.inner_text("#prep-risk")) > base_risk, "換拖鞋行前風險即時上升")
    page.click(".gear-opt[data-item='boots']")

    # 全建議清單 = 0；最差配置 ≤ 45
    page.evaluate("window.__game.prep.applyRecommended()")
    check(page.inner_text("#prep-risk") == "0", "套用建議清單後行前風險 0")
    page.evaluate("""() => {
        const P = window.__game.prep;
        P.selection = { hat:'no_hat', base:'cotton', mid:'no_mid', shell:'no_shell', pants:'jeans', shoes:'sandals',
                        gloves:'no_gloves', socks:'no_socks', water:'water_1', pack:[] };
        P.refreshGear(false);
    }""")
    worst = int(page.inner_text("#prep-risk"))
    check(35 <= worst <= 45, f"加里山濕冷最差配置接近上限，不硬湊 45（{worst}）")
    worst_xueshan = page.evaluate("""() => {
        const G = window.__game, L = G.logic, P = G.prep, m = P.data.mountains.mountains.find(x => x.id === 'xueshan');
        for (let s = 1; s < 5000; s++) {
            const f = L.generateForecast(m, 'autumn', s, 0, 0), b = L.briefFlags(m, f);
            if (!b.wet || !b.cold) continue;
            const sel = { hat:'no_hat', base:'cotton', mid:'no_mid', shell:'no_shell', pants:'jeans', shoes:'sandals',
                          gloves:'no_gloves', socks:'no_socks', water:'water_1', pack:[] };
            return L.assessPreparation(P.data.gear, { gear: L.gearFlags(sel, P.index, m, b), weather: b, route: m.route_flags, state: { pack_weight_g: 0 } }).risk;
        }
    }""")
    check(worst_xueshan == 45, f"雪山秋季濕冷最差配置 45（{worst_xueshan}）")
    check(page.evaluate("JSON.stringify(window.__game.prep.forecast)") == f0, "換裝不改預報")
    check(page.locator("#gear-preview").evaluate("c => c.getContext('2d').getImageData(c.width / 2, c.height / 3, 1, 1).data[3]") > 0, "預覽畫布有內容")

    # 所有山、季節、種子：最差 ≤45、建議 = 0、實況可重現
    audit = page.evaluate("""() => {
        const G = window.__game, L = G.logic, P = G.prep, out = { worstMax: 0, recMax: 0, repro: true, n: 0 };
        const worstSel = () => ({ hat:'no_hat', base:'cotton', mid:'no_mid', shell:'no_shell', pants:'jeans', shoes:'sandals',
                                  gloves:'no_gloves', socks:'no_socks', water:'water_1', pack:[] });
        P.data.mountains.mountains.forEach(m => L.SEASONS.forEach(s => {
            for (let seed = 1; seed <= 60; seed++) {
                const f = L.generateForecast(m, s.key, seed, 0, 0), b = L.briefFlags(m, f);
                if (JSON.stringify(f) !== JSON.stringify(L.generateForecast(m, s.key, seed, 0, 0))) out.repro = false;
                const score = (sel) => L.assessPreparation(P.data.gear, {
                    gear: L.gearFlags(sel, P.index, m, b), weather: b, route: m.route_flags, state: { pack_weight_g: 0 } }).risk;
                out.worstMax = Math.max(out.worstMax, score(worstSel()));
                out.recMax = Math.max(out.recMax, score(L.recommendedSelection(m, b)));
                out.n++;
            }
        }));
        return out;
    }""")
    check(audit["worstMax"] <= 45, f"{audit['n']} 組預報最差配置都 ≤45（最高 {audit['worstMax']}）")
    check(audit["recMax"] == 0, f"{audit['n']} 組預報的建議清單都是 0（最高 {audit['recMax']}）")
    check(audit["repro"], "同種子預報可重現")

    # 角色外觀：每個選項的畫布像素都不同
    page.evaluate("""() => {
        const P = window.__game.prep;
        P.selection = Object.assign(P.selection, { hat:'no_hat', base:'wicking', mid:'no_mid', shell:'no_shell', pants:'quick_pants',
            shoes:'boots', gloves:'no_gloves', socks:'hiking_socks', water:'water_1', pack:[] });
        P.setTab('wear'); P.refreshGear(false);
    }""")
    same = []
    for tab, selector in [("wear", ".gear-panel[data-panel='wear'] .gear-opt"), ("pack", ".gear-panel[data-panel='pack'] .gear-opt")]:
        page.click(f".gear-tab[data-tab='{tab}']")
        items = page.locator(selector).evaluate_all("ns => ns.map(n => [n.dataset.slot, n.dataset.item])")
        for slot, item in items:
            before = page.evaluate("window.__game.prep.previewHash()")
            original = page.evaluate(f"window.__game.prep.selection['{slot}']")
            if slot != "pack" and original == item:
                continue
            page.click(f".gear-opt[data-item='{item}']")
            if page.evaluate("window.__game.prep.previewHash()") == before:
                same.append(item)
            if slot == "pack":
                page.click(f".gear-opt[data-item='{item}']")
            else:
                page.click(f".gear-opt[data-item='{original}']")
    check(not same, f"每個穿著與背包選項都改變角色預覽或物品盤 {same}")
    page.evaluate("window.__game.prep.selection.mid = 'fleece'; window.__game.prep.selection.shell = 'rain_shell'; window.__game.prep.refreshGear(false)")
    h1 = page.evaluate("window.__game.prep.previewHash()")
    page.evaluate("window.__game.prep.selection.base = 'cotton'; window.__game.prep.refreshGear(false)")
    check(page.evaluate("window.__game.prep.previewHash()") != h1, "外層蓋住時內層仍從領口看得出來")

    # 展示用配裝：缺頭燈、其他大致齊全
    page.evaluate("window.__game.prep.applyRecommended()")
    page.click(".gear-tab[data-tab='pack']")
    page.click(".gear-opt[data-item='headlamp']")
    page.click(".gear-opt[data-item='rain_kit']")
    page.click(".gear-tab[data-tab='wear']")
    page.click(".gear-opt[data-item='poncho']")
    page.click(".gear-tab[data-tab='pack']")
    page.wait_for_timeout(150)
    page.locator("#gear-scroll").evaluate("n => { n.scrollTop = 0; }")
    page.screenshot(path=str(PREP_SHOTS / "03-dress-up.png"))
    check(page.locator(".gear-opt[data-item='headlamp']").get_attribute("aria-checked") == "false", "頭燈確實未帶")
    prep_risk = int(page.inner_text("#prep-risk"))

    # 裝備檢查：進出多次不累加
    page.click("#prep-next")
    page.wait_for_selector("#check-list")
    check(g(page, "state.risk") == 0, "檢查頁不寫入 state.risk")
    check(page.locator("#check-list .check-row").count() <= 3, "檢查頁先列最多三件該改的")
    page.evaluate("document.querySelectorAll('.check-more').forEach((d) => { d.open = true; })")
    list_txt = page.inner_text(".check-right")
    check("建議調整" in list_txt and "符合" in list_txt, "展開後逐項顯示符合／建議調整")
    check(page.locator(".group-row").count() == 5, "五組分數")
    check(f"{prep_risk} / 45" in page.inner_text("#check-risk"), "檢查頁總分與打包頁一致")
    page.wait_for_timeout(150)
    page.screenshot(path=str(PREP_SHOTS / "04-gear-check.png"))
    page.click("#prep-edit")
    page.wait_for_selector("#gear-preview")
    dress_sample(page)
    page.click("#prep-next")
    page.locator(".check-row.adjust").first.click()
    page.wait_for_selector("#gear-preview")
    dress_sample(page)
    check(g(page, "prep.step") == "gear", "點檢查列回到品項")
    page.click("#prep-next")
    check(g(page, "state.risk") == 0 and page.evaluate("window.__game.store.data.plays") == plays0, "來回檢查不加風險、不計遊玩次數")

    # 出發：連點也只算一次
    page.evaluate("document.getElementById('prep-confirm').click(); window.__game.prep.confirm();")
    check(g(page, "state.screen") == "play", "確認出發後開始登山")
    check(g(page, "state.risk") == prep_risk, f"行前風險寫入 state.risk（{prep_risk}）")
    check(page.evaluate("window.__game.store.data.plays") == plays0 + 1, "只記一次遊玩")
    trip = page.evaluate("""() => { const s = window.__game.state;
        return { stages: s.events.map(e => e.scenario.stage), ids: s.events.map(e => e.scenario.id),
                 counts: s.trip.mountain.stage_counts, summit: s.trip.mountain.summit_m, trailhead: s.trip.mountain.trailhead_m }; }""")
    # 加里山下山路只有 2 格，依 key_concepts.md 給待援與溪洪；頭燈題的裝備修飾改在 prep_headlamp_flow 用玉山測
    jiali_descent = [i for i, st in zip(trip["ids"], trip["stages"]) if st == "descent"]
    check("key-wait-warm-visible" in jiali_descent and "key-flood-wait-retreat" in jiali_descent, f"加里山下山路保留待援與溪洪 {jiali_descent}")

    # 高度表
    check(round(page.evaluate("window.DH.core.altitudeAt(0)")) == trip["trailhead"], "高度表從所選山的登山口開始")
    check(round(page.evaluate("window.DH.core.altitudeAt(5300)")) == trip["summit"], "高度表山頂是所選山的海拔")
    check("加里山" in page.inner_text("#hud-trip") and "秋季" in page.inner_text("#hud-trip"), "HUD 顯示山名與季節")
    check(any("2,220" in str(d.get("sub")) for d in g(page, "view.decor.filter(d => d.type === 'stele')")), "山頂石碑顯示所選山海拔")
    page.evaluate("window.__game.state.player.x = 5300")
    page.wait_for_timeout(120)
    check("2,220" in page.inner_text("#hud-alt"), "走到山頂 HUD 顯示 2,220m")
    page.evaluate("window.__game.state.player.x = 300")
    page.wait_for_timeout(1500)
    check(g(page, "view.fx.rain") + g(page, "view.fx.fog") + g(page, "view.fx.cold") >= 0, "天氣效果已接上場景")

    # 走到第一題作答
    first_id = g(page, "teleportToNextEvent()")
    page.wait_for_timeout(50)
    page.keyboard.press("e")
    page.wait_for_selector("#card:not([hidden])")
    check(g(page, "state.current.scenario.id") == first_id, "走到第一題")
    r0 = g(page, "state.risk")
    opt = page.evaluate("""() => { const c = window.__game.state.current;
        const i = c.options.findIndex(o => !o.correct); return { i, base: c.options[i].risk }; }""")
    page.locator("#card-opts .opt").nth(opt["i"]).click()
    last = g(page, "state.eventRiskLog.at(-1)")
    check(g(page, "state.risk") == r0 + last["finalRisk"], f"作答後風險變化 {r0}→{g(page, 'state.risk')}")
    check(last["base"] == opt["base"], "紀錄原風險")
    page.wait_for_timeout(250)
    g(page, "continue()")

    # 結局與對帳
    while page.evaluate("(() => { const s = window.__game.state; return !!s.events[s.eventIndex] && s.screen === 'play'; })()"):
        page.evaluate("() => { const G = window.__game; G.triggerNextEvent(); G.answer(G.correctIndex()); G.continue(); }")
    g(page, "teleportToFinish()")
    page.keyboard.down("ArrowRight")
    page.wait_for_selector("#ending-screen:not([hidden])", timeout=4000)
    page.keyboard.up("ArrowRight")
    recon = page.evaluate("""() => { const s = window.__game.state;
        return { p: s.preparation.risk, sum: s.eventRiskLog.reduce((a, r) => a + r.actualAdded, 0), risk: s.risk }; }""")
    check(recon["p"] + recon["sum"] == recon["risk"], f"對帳 {recon['p']}+{recon['sum']}={recon['risk']}")
    trip_line = page.inner_text("#ending-trip")
    check(all(k in trip_line for k in ["加里山", "秋季", "行前風險", "累積風險"]), f"結局摘要：{trip_line}")
    check(page.locator("#card-prep-review").count() == 1 and page.locator("#card-gear-review").count() == 1, "兩張回顧卡")
    page.locator("#card-gear-review summary").click()
    check(f"累積 {recon['risk']}" in page.inner_text("#trip-recon"), "回顧卡顯示對帳")
    # 再練習：清單保留、新預報
    page.click("#btn-again")
    check(g(page, "prep.step") == "forecast" and g(page, "state.screen") == "prep", "再練習回到預報")
    check(g(page, "prep.selection.pack").count("first_aid") == 1, "保留本趟清單")
    page.click(".prep-back")
    check(g(page, "prep.step") == "mountain", "可再往回到選山")
    ctx.close()


def prep_headlamp_flow(browser, errors):
    """沒帶頭燈走到 headlamp-before-dark：玉山下山路保留待援後，還有一格給優先題。"""
    print("缺頭燈的題目修飾")
    ctx = browser.new_context(viewport={"width": 1280, "height": 720})
    page = ctx.new_page()
    page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
    page.on("pageerror", lambda e: errors.append(str(e)))
    open_prep(page)
    seed = safe_seed(page, "yushan", "autumn")
    open_prep(page, seed)
    walk_to_gear(page, "yushan", "autumn")
    page.evaluate("window.__game.prep.selection.pack = window.__game.prep.selection.pack.filter(id => id !== 'headlamp'); window.__game.prep.refreshGear(false)")
    page.click("#prep-next")
    page.click("#prep-confirm")
    check(HEADLAMP in g(page, "state.events.map(e => e.scenario.id)"), "玉山優先題出現 headlamp-before-dark")

    # 走到 headlamp-before-dark，選錯
    while page.evaluate("(() => { const s = window.__game.state; return s.events[s.eventIndex].scenario.id; })()") != HEADLAMP:
        page.evaluate("() => { const G = window.__game; G.triggerNextEvent(); G.answer(G.correctIndex()); G.continue(); }")
    g(page, "triggerNextEvent()")
    page.wait_for_selector("#card:not([hidden])")
    sit = page.inner_text("#card-sit")
    opts_txt = page.inner_text("#card-opts")
    check("沒帶頭燈" in sit, "缺頭燈時情境改寫")
    check("頭燈" not in opts_txt, "缺頭燈時選項不提頭燈")
    check("裝備提醒" in page.inner_text("#card-gear-note"), "作答前有裝備提醒")
    orig = page.evaluate("window.__game.getBank().find(s => s.id === 'headlamp-before-dark')")
    check("背包有頭燈" in orig["situation"], "原題文字未被覆寫")
    check(g(page, "state.current.scenario.answer") == orig["answer"], "answer 索引不變")
    idx = page.evaluate("window.__game.state.current.options.findIndex(o => o.orig === 2)")
    r1 = g(page, "state.risk")
    page.locator("#card-opts .opt").nth(idx).click()
    fb = page.inner_text("#fb-gear")
    check("原風險 18 → 本次 27" in fb and "沒帶頭燈" in fb, f"缺頭燈 18→27 並說明原因：{fb.splitlines()[0]}")
    check(g(page, "state.risk") == r1 + 27, "風險實際加 27")
    check("+27" in page.inner_text("#fb-head"), "回饋標題顯示 +27")
    page.wait_for_timeout(450)
    page.screenshot(path=str(PREP_SHOTS / "05-scenario-gear-effect.png"))
    g(page, "continue()")

    while page.evaluate("(() => { const s = window.__game.state; return !!s.events[s.eventIndex] && s.screen === 'play'; })()"):
        page.evaluate("() => { const G = window.__game; G.triggerNextEvent(); G.answer(G.correctIndex()); G.continue(); }")
    if g(page, "state.screen") == "play":
        g(page, "skipToEnding()")
    page.wait_for_selector("#ending-screen:not([hidden])")
    page.locator("#card-gear-review summary").click()
    check(HEADLAMP in page.locator("#card-gear-review .trip-log li").evaluate_all("ns => ns.map(n => n.dataset.id)"), "裝備影響回顧列出頭燈題")
    page.wait_for_timeout(300)
    page.screenshot(path=str(PREP_SHOTS / "ending-review.png"))

    ctx.close()


def prep_modifier_flow(browser, errors):
    print("裝備修飾與敘事變體")
    page = new_page(browser, errors)
    open_prep(page)
    r = page.evaluate("""() => {
        const G = window.__game, L = G.logic, P = G.prep;
        const m = P.data.mountains.mountains.find(x => x.id === 'xueshan');
        const f = L.generateForecast(m, 'autumn', 1, 0, 0), b = L.briefFlags(m, f);
        const flags = (patch) => {
            const sel = Object.assign(L.sampleSelection(), patch);
            return L.gearFlags(sel, P.index, m, b);
        };
        const ctx = (gear, here) => ({ gear, route: m.route_flags, brief: Object.assign({}, b, { wet: true, cold: true }),
            here: Object.assign({ wet: true, cold: true, fog: true }, here) });
        const none = flags({});
        const lamp = flags({ pack: ['headlamp'] });
        const res = (id, base, gear, correct) => L.resolveAnswer(id, base, !!correct, ctx(gear));
        const rainOk = flags({ pack: ['rain_kit'] });
        const out = {
            noLamp: res('headlamp-before-dark', 18, none).final,
            lamp: res('headlamp-before-dark', 18, lamp).final,
            safe: res('headlamp-before-dark', 0, none, true).final,
            wetBoth: res('wet-hypothermia', 30, none).final,
            wetDelta: res('wet-hypothermia', 30, none).delta,
            rainPass: res('rain-gear-early', 23, rainOk).delta,
            water: res('dehydration-rest', 22, flags({ water: 'water_1' })).final,
            nav: res('lost-stop', 25, none).final,
            navOn: res('lost-stop', 25, flags({ pack: ['offline_map'] })).final,
            sandals: res('ankle-sprain', 22, flags({ shoes: 'sandals' })).delta,
            thunder: res('thunder-ridge', 30, none).delta,
            ams: res('severe-altitude', 30, flags({ pack: ['first_aid','poles'] })).delta,
            aid: res('first-aid-cut', 18, none).final,
            ponchoOnly: res('rain-gear-early', 20, flags({ shell: 'poncho' })).final,
            bankBefore: JSON.stringify(G.getBank()),
        };
        const noGear = { gear: none, route: m.route_flags, brief: b };
        const allIds = ['headlamp-before-dark','first-aid-cut','night-bivouac','rain-gear-early','hypothermia-blanket','fog-junction','ankle-sprain','layer-clothing','pack-for-rain'];
        out.variants = allIds.map(id => {
            const s = G.getBank().find(x => x.id === id);
            const v = L.scenarioVariant(s, m, noGear);
            return { id, answer: s.answer, opts: v.options, sit: v.situation, n: v.options.length };
        });
        const full = L.recommendedSelection(m, b);
        out.fullHeadlamp = L.scenarioVariant(G.getBank().find(x => x.id === 'headlamp-before-dark'), m,
            { gear: L.gearFlags(full, P.index, m, b), route: m.route_flags, brief: b }).situation;
        out.bankAfter = JSON.stringify(G.getBank());
        return out;
    }""")
    check(r["noLamp"] == 27, f"缺頭燈 18→{r['noLamp']}")
    check(r["lamp"] == 16, f"有頭燈 18→{r['lamp']}")
    check(r["safe"] == 0, "安全選項仍 0")
    check(r["wetBoth"] == 40 and r["wetDelta"] == 10, f"濕冷 base30 缺雨缺保暖封頂 40（{r['wetBoth']}）")
    check(r["rainPass"] < 0, "雨衣雨褲齊備降低雨題風險")
    check(r["water"] > 22, f"缺水放大脫水題 {r['water']}")
    check(r["nav"] > 25 and r["navOn"] < 25, f"導航影響迷路題 {r['nav']}／{r['navOn']}")
    check(r["sandals"] > 0, "拖鞋放大扭傷題")
    check(r["thunder"] == 0 and r["ams"] == 0, "雷擊、高山症不受裝備減免")
    check(r["aid"] == 20, "缺急救包 +2")
    check(r["ponchoOnly"] == 23, f"只有輕便雨衣 ×1.1+1（{r['ponchoOnly']}）")
    check(r["bankBefore"] == r["bankAfter"], "計算不改動原題庫")
    words = {"headlamp-before-dark": ["頭燈"], "first-aid-cut": ["急救包", "敷料"], "night-bivouac": ["頭燈", "睡墊"],
             "rain-gear-early": ["雨衣", "雨褲", "乾衣"], "hypothermia-blanket": ["緊急毯", "隔地墊"],
             "fog-junction": ["地圖", "軌跡"], "ankle-sprain": ["繃帶"], "pack-for-rain": ["雨衣", "背包套"], "layer-clothing": ["排汗衣", "防風雨層"]}
    for v in r["variants"]:
        bad = [w for w in words[v["id"]] if any(w in o for o in v["opts"])]
        check(not bad and v["n"] == 3, f"{v['id']} 缺裝時選項不提沒帶的東西 {bad}")
    check("背包有頭燈" in r["fullHeadlamp"], "有帶頭燈時維持原文")

    # 風險 99 的截斷
    page.click("#btn-start")
    seed = safe_seed(page, "qixing", "summer", "true")
    page.goto(f"{URL}?seed={seed}")
    page.wait_for_function("window.__game && window.__game.state.prepReady")
    walk_to_gear(page, "qixing", "summer")
    page.click("#prep-next")
    page.click("#prep-confirm")
    page.evaluate("""() => { const G = window.__game; G.state.preparation.risk = 0; G.state.risk = 0;
        G.state.eventRiskLog.push({ id:'x', title:'x', base:99, mult:1, add:0, finalRisk:99, gearDelta:0, appliedRuleIds:[], actualAdded:99 }); G.state.risk = 99; }""")
    g(page, "triggerNextEvent()")
    page.evaluate("window.__game.answer(window.__game.wrongIndex())")
    row = g(page, "state.eventRiskLog.at(-1)")
    check(row["actualAdded"] == 1 and row["finalRisk"] > 1, f"風險 99 只記實際增加 1（題目 {row['finalRisk']}）")
    check(g(page, "state.risk") == 100, "封頂 100")
    g(page, "continue()")
    check(g(page, "state.ending.tier") == "bad", "進入救援結局")
    recon = page.evaluate("window.__game.state.preparation.risk + window.__game.state.eventRiskLog.reduce((a, r) => a + r.actualAdded, 0)")
    check(recon == 100, "截斷後仍能對帳")
    page.context.close()


def prep_selection_flow(browser, errors):
    print("各山選題")
    page = new_page(browser, errors)
    open_prep(page)
    res = page.evaluate("""() => {
        const G = window.__game, L = G.logic, P = G.prep, bank = G.getBank(), core = window.DH.core;
        const out = { over: [], excludedHit: [], cross: [], dup: [], shortfalls: {}, seen: {}, n: 0, thunderLeak: 0, fogLeak: 0 };
        P.data.mountains.mountains.forEach(m => {
            out.seen[m.id] = new Set();
            L.SEASONS.forEach(season => {
                for (let seed = 1; seed <= 40; seed++) {
                    const f = L.generateForecast(m, season.key, seed, 0, 0), a = L.generateActual(m, f, seed, 0, 0), b = L.briefFlags(m, f);
                    const sel = L.recommendedSelection(m, b);
                    const ctx = { gear: L.gearFlags(sel, P.index, m, b), weather: L.tripWeather(a), route: m.route_flags,
                                  state: { pack_weight_g: L.packWeight(sel, P.index) }, season: season.key };
                    const rng = core.makeRng(seed);
                    const { picked, audit } = L.selectScenarios(bank, m, ctx, a, {}, rng);
                    out.n++;
                    const counts = {};
                    picked.forEach(s => {
                        counts[s.stage] = (counts[s.stage] || 0) + 1;
                        out.seen[m.id].add(s.id);
                        if (L.exclusionReason(s, m, ctx, a)) out.excludedHit.push(s.id);
                        if (s.id === 'thunder-ridge' && !a.thunder) out.thunderLeak++;
                        if (s.id === 'fog-junction' && !a.fog) out.fogLeak++;
                    });
                    core.STAGE_KEYS.forEach(k => {
                        if ((counts[k] || 0) > m.stage_counts[k]) out.over.push(`${m.id}/${k}`);
                        if ((counts[k] || 0) + (audit.shortfall[k] || 0) !== m.stage_counts[k]) out.cross.push(`${m.id}/${k}`);
                        if (audit.shortfall[k]) out.shortfalls[`${m.id}/${k}`] = (out.shortfalls[`${m.id}/${k}`] || 0) + 1;
                    });
                    const ids = picked.map(s => s.id);
                    if (new Set(ids).size !== ids.length) out.dup.push(m.id);
                }
            });
            out.seen[m.id] = Array.from(out.seen[m.id]);
        });
        return out;
    }""")
    check(not res["over"] and not res["cross"], f"{res['n']} 趟選題都符合各段配額，不跨段 {res['over'][:3]}{res['cross'][:3]}")
    check(not res["excludedHit"], f"不含被排除題 {res['excludedHit'][:3]}")
    check(not res["dup"], "同趟題目不重複")
    check(res["thunderLeak"] == 0 and res["fogLeak"] == 0, "雷雨題限雷雨日、濃霧題限霧日")
    check(not res["shortfalls"], f"題庫足夠，各段不短缺 {res['shortfalls']}")
    seen = res["seen"]
    for mid in ("qixing", "jiali"):
        check(not ({"altitude-symptoms", "ams-turnaround", "severe-altitude"} & set(seen[mid])), f"{mid} 不出高山症題")
    check(not ({"black-bear-encounter", "black-bear-distance", "lost-stop", "first-aid-cut"} & set(seen["hehuan"])), "合歡不出黑熊與林間題")
    for mid in ("qixing", "hehuan", "yushan", "xueshan"):
        check(not ({"flash-flood", "unsafe-crossing"} & set(seen[mid])), f"{mid} 不出涉溪題")
    for mid in ("qixing", "hehuan", "jiali"):
        check("hut-camp-planning" not in seen[mid], f"{mid} 單日線不出山屋題")
    check("falling-rock" not in seen["qixing"], "七星山不出碎石落石題")
    check("prep-water-plan" in seen["nanhu"] and "prep-water-plan" not in seen["qixing"], "多天線才出山屋水源題")
    all_seen = set(sum(seen.values(), []))
    hit = {k for k in all_seen if k.startswith("prep-")}
    check({"prep-rainpants", "prep-thunder-stop", "prep-water-plan"} <= hit, f"新增題會依條件出現 {sorted(hit)}")

    # 新增題條件逐一驗證（依 only_if）
    triggers = page.evaluate("""() => {
        const G = window.__game, L = G.logic, P = G.prep, out = {};
        const m = P.data.mountains.mountains.find(x => x.id === 'xueshan');
        const f = L.generateForecast(m, 'autumn', 1, 0, 0), a = L.generateActual(m, f, 1, 0, 0), b = L.briefFlags(m, f);
        const base = () => ({ gear: L.gearFlags(L.sampleSelection(), P.index, m, b), route: m.route_flags,
            weather: { rain:false, wet:false, cold:false, thunder:false, fog:false, ice:false, strong_wind:false, official_closed:false },
            state: { pack_weight_g: 0 }, season: 'autumn' });
        const has = (id, c) => L.evalCond(L.TRIGGERS[id], c);
        const c0 = base();
        out.closed0 = has('prep-postpone', c0);
        const c = base();
        c.weather.official_closed = true; c.weather.rain = true; c.weather.ice = true; c.weather.thunder = true;
        c.gear.has_satellite = true; c.gear.down_layer = true; c.state.pack_weight_g = 8000;
        out.all = Object.keys(L.TRIGGERS).every(id => has(id, c));
        c0.route = Object.assign({}, m.route_flags, { overnight: false });
        out.none = Object.keys(L.TRIGGERS).filter(id => has(id, c0));
        return out;
    }""")
    check(triggers["all"] and triggers["none"] == [], f"8 題 only_if 條件正確 {triggers['none']}")

    # 六座山實際走完：沒帶任何裝備、一路選最危險的選項，看結局與對帳
    for mid in ("qixing", "hehuan", "jiali", "yushan", "xueshan", "nanhu"):
        p = new_page(browser, errors)
        open_prep(p)
        s = safe_seed(p, mid, "spring")
        open_prep(p, s)
        walk_to_gear(p, mid, "spring")
        p.click("#prep-next")
        p.click("#prep-confirm")
        out = p.evaluate("""() => {
            const G = window.__game, st = G.state, words = [];
            const start = st.risk, summit = st.trip.mountain.summit_m;
            while (st.screen === 'play' && st.events[st.eventIndex]) {
                G.triggerNextEvent();
                const c = st.current, opts = c.options;
                words.push(c.scenario.situation + opts.map(o => o.text).join(''));
                const worst = opts.reduce((b, o, i) => (o.risk > opts[b].risk ? i : b), 0);
                G.answer(worst);
                G.continue();
            }
            if (st.screen === 'play') G.skipToEnding();
            return { start, risk: st.risk, added: st.eventRiskLog.reduce((a, r) => a + r.actualAdded, 0),
                     summary: document.getElementById('ending-trip').textContent, screen: st.screen,
                     tier: st.ending.tier, recon: document.getElementById('trip-recon').textContent, text: words.join('') };
        }""")
        check(out["screen"] == "ending" and out["start"] + out["added"] == out["risk"], f"{mid} 走完對帳 {out['start']}+{out['added']}={out['risk']}（{out['tier']}）")
        check(f"累積 {round(out['risk'])}" in out["recon"], f"{mid} 回顧卡顯示同樣的累積風險")
        check("你的急救包" not in out["text"] and "背包有頭燈" not in out["text"], f"{mid} 沒帶裝備時題目不說你有")
        p.context.close()

    # 同種子可重現，換裝不影響題序
    orders = []
    for pack in ("", "headlamp"):
        p = new_page(browser, errors)
        open_prep(p, 777)
        walk_to_gear(p, "yushan", "autumn")
        if g(p, "prep.postponed().length") == 0:
            if pack:
                p.click(".gear-tab[data-tab='pack']")
                p.click(f".gear-opt[data-item='{pack}']")
            p.click("#prep-next")
            p.click("#prep-confirm")
            orders.append(g(p, "state.events.map(e => [e.scenario.id, e.options.map(o => o.orig)])"))
        p.context.close()
    check(len(orders) == 2 and orders[0] == orders[1], "?seed 固定題序與選項；換裝不改題序")
    check(any(o[1] != [0, 1, 2] for o in orders[0]), "選項仍洗牌")
    page.context.close()


def key_selection_flow(browser, errors):
    print("保命題保證抽題")
    page = new_page(browser, errors)
    infos = []
    page.on("console", lambda m: infos.append(m.text) if m.type == "info" else None)
    open_prep(page)
    res = page.evaluate("""() => {
        const G = window.__game, L = G.logic, P = G.prep, bank = G.getBank(), core = window.DH.core;
        const FLOOD = core.KEY_POOLS.flood, AMS = core.KEY_POOLS.altitude, THUNDER = core.KEY_POOLS.thunder;
        const out = { n: 0, few: [], fewConcepts: [], slot: [], flood: [], noFlood: [], ams: [], noAms: [], amsDup: [], thunder: [],
                      lostStorm: [], excluded: [], over: [], missing: [], first: [], minKeys: {}, seenKeys: {} };
        const count = (ids, picked) => picked.filter(s => ids.includes(s.id)).length;
        P.data.mountains.mountains.forEach(m => {
            const R = m.route_flags;
            out.minKeys[m.id] = 99;
            out.seenKeys[m.id] = new Set();
            L.SEASONS.forEach(season => {
                for (let seed = 1; seed <= 30; seed++) {
                    const f = L.generateForecast(m, season.key, seed, 0, 0), a0 = L.generateActual(m, f, seed, 0, 0), b = L.briefFlags(m, f);
                    const sel = L.recommendedSelection(m, b);
                    [a0.thunder, !a0.thunder].forEach(thunder => {
                        const a = Object.assign({}, a0, { thunder });
                        const ctx = { gear: L.gearFlags(sel, P.index, m, b), weather: L.tripWeather(a), route: R,
                                      state: { pack_weight_g: L.packWeight(sel, P.index) }, season: season.key };
                        [{}, Object.fromEntries(bank.map(s => [s.id, { seen: 1, correct: 1 }]))].forEach((history, hi) => {
                            const { picked, audit } = L.selectScenarios(bank, m, ctx, a, history, core.makeRng(seed * 31 + hi));
                            const tag = `${m.id}/${season.key}/${seed}/${thunder}/${hi}`;
                            const keys = picked.filter(s => s.key);
                            const concepts = new Set(keys.map(s => s.keyConcept));
                            out.n++;
                            out.minKeys[m.id] = Math.min(out.minKeys[m.id], keys.length);
                            keys.forEach(s => out.seenKeys[m.id].add(s.id));
                            if (keys.length < 4) out.few.push(tag);
                            if (concepts.size < 4) out.fewConcepts.push(tag);
                            if (['trailhead', 'forest', 'ridge', 'descent'].some(k => !keys.some(s => s.stage === k))) out.slot.push(tag);
                            if (!R.has_stream && count(FLOOD, picked)) out.flood.push(tag);
                            if (R.has_stream && count(FLOOD, picked) < 1) out.noFlood.push(tag);
                            if (!R.high_altitude && count(AMS, picked)) out.ams.push(tag);
                            if (R.high_altitude && count(AMS, picked) < 1) out.noAms.push(tag);
                            if (count(AMS, picked) > 1) out.amsDup.push(tag);
                            if (count(THUNDER, picked) !== (thunder ? 1 : 0)) out.thunder.push(tag);
                            if (thunder && picked.some(s => s.id === 'key-lost-up-or-down')) out.lostStorm.push(tag);
                            if (picked.some(s => L.exclusionReason(s, m, ctx, a))) out.excluded.push(tag);
                            if (core.STAGE_KEYS.some(k => picked.filter(s => s.stage === k).length > m.stage_counts[k])) out.over.push(tag);
                            if (audit.keyMissing.length) out.missing.push(`${tag}:${audit.keyMissing}`);
                            if (hi === 0) {
                                const ids = picked.map(s => s.id);
                                const wantRescue = m.stage_counts.forest >= 2;
                                if (!ids.includes('key-stop-stay-or-move') || (wantRescue && !ids.includes('key-rescue-phone-power'))) out.first.push(tag);
                            }
                        });
                    });
                }
            });
            out.seenKeys[m.id] = Array.from(out.seenKeys[m.id]);
        });
        return out;
    }""")
    check(res["n"] > 2000, f"跑了 {res['n']} 趟（六山×四季×種子×雷雨有無×新舊玩家）")
    check(not res["few"], f"每趟至少 4 題保命題（各山最少 {res['minKeys']}）{res['few'][:3]}")
    check(not res["fewConcepts"], f"每趟至少 4 種不同觀念 {res['fewConcepts'][:3]}")
    check(not res["slot"], f"登山口、森林、稜線、下山路各有保命題 {res['slot'][:3]}")
    check(not res["flood"], f"has_stream=false 不含溪洪題 {res['flood'][:3]}")
    check(not res["noFlood"], f"has_stream=true 一定有溪洪題 {res['noFlood'][:3]}")
    check(not res["ams"], f"非高海拔不含高山症題 {res['ams'][:3]}")
    check(not res["noAms"] and not res["amsDup"], f"高海拔恰有一題高山症 {res['noAms'][:3]}{res['amsDup'][:3]}")
    check(not res["thunder"], f"雷雨日恰一題雷雨、其他日沒有 {res['thunder'][:3]}")
    check(not res["lostStorm"], f"雷雨日不出往上回主徑題 {res['lostStorm'][:3]}")
    check(not res["excluded"] and not res["over"], f"不破壞排除表與配額 {res['excluded'][:3]}{res['over'][:3]}")
    check(not res["missing"], f"六山都沒有名額缺口 {res['missing'][:3]}")
    check(not res["first"], f"首次優先 STOP 與求救 {res['first'][:3]}")
    check(not [i for i in infos if "保命題" in i], f"真實題庫不觸發缺額紀錄 {infos[:2]}")
    check("severe-altitude" not in res["seenKeys"]["hehuan"], "合歡仍排除 severe-altitude，改用其他高山症題")

    rot = page.evaluate("""() => {
        const G = window.__game, L = G.logic, P = G.prep, bank = G.getBank(), core = window.DH.core, out = {};
        P.data.mountains.mountains.forEach(m => {
            const f = L.generateForecast(m, 'autumn', 5, 0, 0), a = Object.assign(L.generateActual(m, f, 5, 0, 0), { thunder: false }), b = L.briefFlags(m, f);
            const sel = L.recommendedSelection(m, b);
            const ctx = { gear: L.gearFlags(sel, P.index, m, b), weather: L.tripWeather(a), route: m.route_flags,
                          state: { pack_weight_g: 0 }, season: 'autumn' };
            const history = {}, seen = new Set();
            for (let i = 0; i < 6; i++) {
                L.selectScenarios(bank, m, ctx, a, history, core.makeRng(100 + i)).picked.forEach(s => {
                    history[s.id] = { seen: 1, correct: 1 };
                    if (s.key) seen.add(s.keyConcept);
                });
            }
            out[m.id] = seen.size;
        });
        return out;
    }""")
    check(all(n >= 9 for n in rot.values()), f"六趟內輪替到多種觀念 {rot}")

    logged = page.evaluate("""() => {
        const G = window.__game, core = window.DH.core, m = G.prep.data.mountains.mountains[0], L = G.logic;
        const f = L.generateForecast(m, 'autumn', 5, 0, 0), a = L.generateActual(m, f, 5, 0, 0), b = L.briefFlags(m, f);
        const ctx = { gear: L.gearFlags(L.recommendedSelection(m, b), G.prep.index, m, b), weather: L.tripWeather(a), route: m.route_flags,
                      state: { pack_weight_g: 0 }, season: 'autumn' };
        const thin = G.getBank().filter(s => s.id !== 'leave-trip-plan' && s.id !== 'team-roles' && s.id !== 'typhoon-route-check');
        const { audit } = L.selectScenarios(thin, m, ctx, a, {}, core.makeRng(1));
        return audit.keyMissing;
    }""")
    page.wait_for_timeout(50)
    check("trailhead" in logged and any("保命題" in i and "trailhead" in i for i in infos), f"名額不足時記錄 console.info {logged}")

    classic = new_page(browser, errors)
    open_game(classic)
    res2 = classic.evaluate("""() => {
        const core = window.DH.core, bank = window.__game.getBank().filter(s => !window.__game.logic.isPrepId(s.id)), bad = [];
        for (let seed = 1; seed <= 200; seed++) {
            const picked = core.pickScenarios(bank, core.makeRng(seed), {});
            const keys = picked.filter(s => s.key);
            if (keys.length < 4 || new Set(keys.map(s => s.keyConcept)).size !== keys.length) bad.push(seed);
        }
        const q = core.buildEvents(bank.filter(s => s.key), core.makeRng(9));
        const riskOk = q.every(e => e.options.every(o => o.risk === e.scenario.risk[o.orig] && o.correct === (o.orig === e.scenario.answer)));
        const shuffled = q.some(e => e.options.some((o, i) => o.orig !== i));
        return { bad, riskOk, shuffled, tableOk: Object.keys(core.KEY_TABLE).every(id => bank.some(s => s.id === id) || id.startsWith('prep-')) };
    }""")
    check(not res2["bad"], f"原版模式也至少 4 題、同觀念不重複 {res2['bad'][:3]}")
    check(res2["riskOk"] and res2["shuffled"], "保命題選項有洗牌，風險跟著 orig")
    check(res2["tableOk"], "對照表的 id 都存在於題庫")
    classic.context.close()
    page.context.close()


def goto_key_event(page, predicate="true"):
    """用真實流程走到第一題符合條件的保命題；途中其他題都答對。"""
    return page.evaluate(f"""() => {{
        const G = window.__game, st = G.state;
        while (st.screen === 'play' && st.events[st.eventIndex]) {{
            const s = st.events[st.eventIndex].scenario;
            G.triggerNextEvent();
            if (s.key && ({predicate})) return s.id;
            G.answer(G.correctIndex());
            G.continue();
        }}
        return null;
    }}""")


def key_card_flow(browser, errors):
    for tag, kw, shot in [("桌面 1440x900", dict(viewport={"width": 1440, "height": 900}), "key-badge-desktop.png"),
                          ("手機 390x844", dict(viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True, has_touch=True), "key-badge-mobile.png")]:
        print(f"保命徽章 {tag}")
        ctx = browser.new_context(**kw)
        page = ctx.new_page()
        page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
        page.on("pageerror", lambda e: errors.append(str(e)))
        open_prep(page)
        seed = safe_seed(page, "xueshan", "autumn")
        open_prep(page, seed)
        walk_to_gear(page, "xueshan", "autumn", touch="手機" in tag)
        page.click("#prep-next")
        page.click("#prep-confirm")
        st = page.evaluate("""() => {
            const W = window.DH.world, evs = window.__game.state.events;
            const key = evs.find(e => e.scenario.key).scenario, plain = evs.find(e => !e.scenario.key).scenario;
            const a = W.markerStyle(key, true), b = W.markerStyle(plain, true), c = W.markerStyle(key, false), d = W.markerStyle(plain, false);
            return { differ: a.frame !== b.frame && a.icon !== b.icon && c.frame !== d.frame && a.icon === 'lifebuoy' && !!window.DH.art.icons.lifebuoy };
        }""")
        check(st["differ"], f"{tag} 地圖標記保命題用不同顏色與圖示")
        sid = goto_key_event(page, "s.id === 'key-wait-warm-visible' || s.id === 'key-lost-up-or-down' || s.stage === 'ridge'")
        check(bool(sid), f"{tag} 走到保命題 {sid}")
        page.wait_for_timeout(450)
        vw, vh = kw["viewport"]["width"], kw["viewport"]["height"]
        vis = page.evaluate("""() => {
            const b = document.getElementById('card-key'), r = b.getBoundingClientRect(), s = getComputedStyle(b);
            const strip = document.getElementById('card-key-strip');
            const hit = document.elementFromPoint(r.left + 12, r.top + r.height / 2);
            const tag = document.getElementById('card-tag').getBoundingClientRect();
            return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, shown: !strip.hidden && s.display !== 'none',
                     name: document.getElementById('card-key-name').textContent, label: b.querySelector('small').textContent,
                     onTop: b.contains(hit), tagBelow: tag.top >= r.bottom - 1, h: r.height, icon: b.querySelector('svg').getBoundingClientRect().width,
                     use: !!document.querySelector('#icon-lifebuoy') };
        }""")
        check(vis["shown"] and vis["onTop"] and vis["label"] == "保命觀念" and vis["name"], f"{tag} 徽章可見且不被遮：{vis['label']}／{vis['name']}")
        check(0 <= vis["left"] and vis["right"] <= vw and 0 <= vis["top"] and vis["bottom"] <= vh, f"{tag} 徽章完整在畫面內")
        check(vis["tagBelow"] and vis["icon"] >= 24, f"{tag} 徽章與分類標籤分開，有救生圈圖示")
        page.evaluate("window.__game.answer(window.__game.correctIndex())")
        page.wait_for_selector("#fb-key:not([hidden])")
        page.wait_for_timeout(400)
        fb = page.evaluate("""() => {
            const point = document.getElementById('fb-key-point').textContent, src = document.getElementById('fb-key-src');
            const box = document.getElementById('fb-key').getBoundingClientRect(), scroll = document.getElementById('card-scroll').getBoundingClientRect();
            const next = document.getElementById('card-next').getBoundingClientRect();
            return { point, src: src.textContent, links: src.querySelectorAll('a').length, rawUrl: /https?:/.test(src.textContent),
                     plainSrc: document.getElementById('fb-src').textContent, boxTop: box.top, scrollTop: scroll.top, scrollBottom: scroll.bottom,
                     nextBottom: next.bottom, overflowX: document.getElementById('card-scroll').scrollWidth > document.getElementById('card-scroll').clientWidth };
        }""")
        check(len(fb["point"]) >= 15 and fb["src"].startswith("來源："), f"{tag} 作答後顯示保命重點與來源")
        after = page.evaluate("""() => { const r = document.getElementById('card-key').getBoundingClientRect();
            return document.getElementById('card-key').contains(document.elementFromPoint(r.left + 12, r.top + r.height / 2)) && r.top >= 0; }""")
        check(after, f"{tag} 作答捲動後徽章仍可見")
        check(not fb["rawUrl"] and not fb["plainSrc"], f"{tag} 來源顯示機關名稱，不重複列出")
        check(fb["boxTop"] < fb["scrollBottom"] and fb["boxTop"] >= fb["scrollTop"] - 1 and fb["nextBottom"] <= vh and not fb["overflowX"], f"{tag} 保命重點在捲動區內，繼續鈕在畫面內")
        page.screenshot(path=str(PREP_SHOTS / shot))
        ctx.close()


def key_ending_flow(browser, errors):
    print("結局的本趟保命觀念")
    page = browser.new_context(viewport={"width": 1440, "height": 900}).new_page()
    page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
    page.on("pageerror", lambda e: errors.append(str(e)))
    open_prep(page)
    seed = safe_seed(page, "yushan", "autumn")
    open_prep(page, seed)
    walk_to_gear(page, "yushan", "autumn")
    page.click("#prep-next")
    page.click("#prep-confirm")
    out = page.evaluate("""() => {
        const G = window.__game, st = G.state;
        let wrongLeft = 2;
        while (st.screen === 'play' && st.events[st.eventIndex]) {
            G.triggerNextEvent();
            const s = st.current.scenario, wrong = s.key && wrongLeft > 0;
            if (wrong) wrongLeft--;
            G.answer(wrong ? G.wrongIndex() : G.correctIndex());
            G.continue();
        }
        if (st.screen === 'play') G.skipToEnding();
        const items = [...document.querySelectorAll('.ending-key-item')].map(li => ({ c: li.className, n: li.querySelector('.ending-key-name').textContent, s: li.querySelector('.ending-key-status').textContent }));
        return { items, keys: st.events.filter(e => e.scenario.key).length, wrong: st.events.filter(e => e.scenario.key && e.done && !e.correct).length,
                 box: !document.getElementById('ending-key').hidden, score: document.getElementById('ending-key-score').textContent };
    }""")
    check(out["box"] and len(out["items"]) == out["keys"] >= 4, f"結局列出全部保命觀念（{len(out['items'])}）")
    check(sum(i["s"] == "需複習" for i in out["items"]) == out["wrong"] == 2 and out["items"][0]["s"] == "需複習", "答錯標需複習且排最前")
    check(sum(i["s"] == "已答對" for i in out["items"]) == out["keys"] - 2, f"答對標已答對（{out['score']}）")
    page.wait_for_timeout(300)
    page.screenshot(path=str(PREP_SHOTS / "ending-key-summary.png"))
    page.context.close()

    page = browser.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True, has_touch=True).new_page()
    page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
    open_game(page)
    page.tap("#btn-start")
    page.evaluate("""() => {
        const G = window.__game, st = G.state;
        while (st.screen === 'play' && st.events[st.eventIndex]) {
            G.triggerNextEvent();
            G.answer(st.current.scenario.key && st.eventIndex % 2 ? G.wrongIndex() : G.correctIndex());
            G.continue();
        }
        if (st.screen === 'play') G.skipToEnding();
    }""")
    page.wait_for_timeout(250)
    box = page.evaluate("""() => { const n = document.getElementById('ending-key');
        n.scrollIntoView({ block: 'start' });
        const r = n.getBoundingClientRect(); return { l: r.left, r: r.right, wide: n.scrollWidth > n.clientWidth }; }""")
    check(box["l"] >= 0 and box["r"] <= 390 and not box["wide"], "手機結局保命清單不超出畫面")
    page.wait_for_timeout(100)
    page.screenshot(path=str(PREP_SHOTS / "ending-key-summary-mobile.png"))
    page.context.close()

    # 提前求救：沒走到的保命題要標「沒遇到」
    page = new_page(browser, errors)
    open_game(page)
    page.click("#btn-start")
    skip = page.evaluate("""() => {
        const G = window.__game;
        G.skipToEnding('bad');
        return [...document.querySelectorAll('.ending-key-status')].map(n => n.textContent);
    }""")
    check(len(skip) >= 4 and set(skip) == {"沒遇到"}, f"提前求救時標示沒遇到（{len(skip)}）")
    page.context.close()


def prep_postpone_flow(browser, errors):
    print("建議延期")
    page = new_page(browser, errors)
    open_prep(page)
    seed = page.evaluate("""() => {
        const G = window.__game, L = G.logic, m = G.prep.data.mountains.mountains.find(x => x.id === 'qixing');
        for (let s = 1; s < 5000; s++) if (L.generateForecast(m, 'summer', s, 0, 0).hazards.typhoon) return s;
    }""")
    open_prep(page, seed)
    page.click("#btn-start")
    page.click(".mtn-card[data-id='qixing'] .mtn-pick")
    page.click("#prep-next")
    page.click("[data-season='summer']")
    page.wait_for_selector("#postpone-card")
    check(page.locator("#postpone-card li[data-reason='typhoon']").count() == 1, "颱風外圍顯示建議延期")
    check("颱風外圍" in page.inner_text("#fc-card"), "預報顯示颱風外圍")
    check(not page.locator("#prep-next").is_enabled(), "延期時不能往下走")
    txt = page.inner_text("#postpone-card")
    check(all(k in txt for k in ["換山", "換季節", "重新抽預報"]), "延期卡三個選擇")
    page.wait_for_timeout(100)
    page.screenshot(path=str(PREP_SHOTS / "postpone-typhoon.png"))
    store0 = page.evaluate("JSON.stringify(window.__game.store.data)")
    check(g(page, "prep.confirm()") is False, "延期時無法直接出發")
    f0 = page.evaluate("JSON.stringify(window.__game.prep.forecast)")
    page.click("#btn-reroll")
    check(page.evaluate("JSON.stringify(window.__game.prep.forecast)") != f0, "重新抽預報會換新")
    # 抽到能走為止
    for _ in range(50):
        if page.locator("#postpone-card").count() == 0:
            break
        page.click("#btn-reroll")
    check(page.locator("#postpone-card").count() == 0, "重抽後可繼續")
    check(page.locator("#prep-next").is_enabled(), "解除後可往下走")
    page.evaluate("window.__game.prep.forceForecast({ gust_ms: 20 })")
    check(page.locator("#postpone-card li[data-reason='gust']").count() == 1, "陣風 18 m/s 以上建議延期")
    page.evaluate("window.__game.prep.forceForecast({ gust_ms: 5, ice: true })")
    check(page.locator("#postpone-card li[data-reason='ice']").count() == 1, "結冰且沒訓練建議延期")
    top = page.locator("#postpone-card").bounding_box()["y"]
    check(top < page.locator("#fc-card").bounding_box()["y"], "延期卡排在預報前面")
    page.locator("#postpone-card .btn", has_text="換季節").click()
    check(g(page, "prep.forecast") is None and page.locator("#fc-card").count() == 0, "換季節回到未選")
    page.click("[data-season='autumn']")
    if page.locator("#postpone-card").count():
        page.locator("#postpone-card .btn", has_text="換山").click()
        check(g(page, "prep.step") == "mountain", "換山回到選山")
    check(page.evaluate("JSON.stringify(window.__game.store.data)") == store0, "延期不留壞紀錄")
    page.context.close()


def prep_fallback_flow(browser):
    print("裝備資料載入失敗：原版模式")
    for name, handler in [("abort", lambda r: r.abort()),
                          ("404", lambda r: r.fulfill(status=404, body="")),
                          ("壞掉的 JSON", lambda r: r.fulfill(status=200, content_type="application/json", body='{"mountains":[]}'))]:
        ctx = browser.new_context(viewport={"width": 1280, "height": 720})
        page = ctx.new_page()
        pageerrors = []
        page.on("pageerror", lambda e: pageerrors.append(str(e)))
        page.route("**/data/mountains.json", handler)
        page.goto(URL + "?seed=9")
        page.wait_for_function("window.__game && window.__game.state.bankReady")
        page.wait_for_timeout(250)
        check(g(page, "state.prepReady") is False, f"{name}：未開啟準備")
        check("原版模式" in page.inner_text("#load-notice"), f"{name}：友善提示")
        if name == "abort":
            page.screenshot(path=str(PREP_SHOTS / "fallback-classic.png"))
        page.click("#btn-start")
        check(g(page, "state.screen") == "play" and g(page, "state.trip") is None, f"{name}：直接開始")
        check(g(page, "state.risk") == 0, f"{name}：行前風險 0")
        check(not page.locator("#prep-screen").is_visible(), f"{name}：不顯示準備畫面")
        ids = g(page, "state.events.map(e => e.scenario.id)")
        check(10 <= len(ids) <= 12 and not any(i.startswith("prep-") for i in ids), f"{name}：原版題組")
        check(round(page.evaluate("window.DH.core.altitudeAt(5300)")) == 3420, f"{name}：原版高度表")
        check(not pageerrors, f"{name}：沒有程式錯誤 {pageerrors}")
        ctx.close()

    print("file:// 原版模式")
    ctx = browser.new_context()
    page = ctx.new_page()
    errs = []
    page.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)
    page.on("pageerror", lambda e: errs.append(str(e)))
    page.goto((ROOT / "index.html").as_uri())
    page.wait_for_function("window.__game && window.__game.state.bankReady")
    page.wait_for_timeout(200)
    check("原版模式" in page.inner_text("#load-notice"), "file://：提示未開啟準備")
    page.click("#btn-start")
    check(g(page, "state.screen") == "play", "file://：直接開始")
    check(not errs, f"file://：無 console error {errs}")
    ctx.close()


def prep_mobile_flow(browser, errors):
    print("手機 390x844 準備流程")
    ctx = browser.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
    page = ctx.new_page()
    page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
    page.on("pageerror", lambda e: errors.append(str(e)))
    open_prep(page)
    seed = safe_seed(page, "xueshan", "autumn", "b.wet && b.cold && f.hazards.fog")
    open_prep(page, seed)

    def small(selector):
        return page.locator(selector).evaluate_all(
            "ns => ns.filter(n => n.offsetParent !== null).map(n => n.getBoundingClientRect())"
            ".filter(r => r.height < 44 || r.width < 44).map(r => [Math.round(r.width), Math.round(r.height)])")

    def overflow():
        return page.evaluate("""() => {
            const p = document.getElementById('prep-panel');
            const r = p.getBoundingClientRect();
            return p.scrollWidth > p.clientWidth + 1 || r.right > innerWidth + 1
                || document.getElementById('prep-body').scrollWidth > document.getElementById('prep-body').clientWidth + 1;
        }""")

    page.tap("#btn-start")
    page.wait_for_selector("#prep-panel[data-step='mountain']")
    check(page.locator(".mtn-card:visible").count() == 1, "手機一次只顯示一張山岳卡")
    page.tap(".mtn-chip[data-id='xueshan']")
    check(page.locator(".mtn-card:visible").get_attribute("data-id") == "xueshan", "點山名切換卡片")
    page.tap(".mtn-card.active .mtn-pick")
    check(not small(".mtn-chip, .mtn-pick, #prep-next, .prep-back"), f"選山按鈕 ≥44px {small('.mtn-chip, .mtn-pick, #prep-next, .prep-back')}")
    check(not overflow(), "選山沒有橫向溢出")
    page.wait_for_timeout(120)
    page.screenshot(path=str(PREP_SHOTS / "mobile-01-mountain-select.png"))
    page.tap("#prep-next")
    page.tap("[data-season='autumn']")
    page.wait_for_selector("#fc-card")
    check(not small(".season-btn, #prep-next, .prep-back"), "季節按鈕 ≥44px")
    check(not overflow(), "預報沒有橫向溢出")
    page.wait_for_timeout(120)
    page.screenshot(path=str(PREP_SHOTS / "mobile-02-forecast.png"))
    page.tap("#prep-next")
    page.wait_for_selector("#gear-preview")
    dress_sample(page)
    box = page.locator("#gear-scroll").bounding_box()
    check(box["height"] >= 220, f"手機選項區夠高 {box['height']:.0f}px")
    check(not overflow(), "換裝沒有橫向溢出")
    check(not small(".gear-opt, .gear-tab, #prep-next, .prep-back"), f"換裝按鈕 ≥44px {small('.gear-opt, .gear-tab, #prep-next, .prep-back')}")
    page.tap(".gear-opt[data-item='beanie']")
    page.tap(".gear-opt[data-item='fleece']")
    page.wait_for_timeout(180)
    page.screenshot(path=str(PREP_SHOTS / "mobile-03-dress-up.png"))
    page.tap(".gear-tab[data-tab='pack']")
    check(page.locator(".gear-panel[data-panel='pack']").is_visible(), "切到背包分頁")
    check(not small(".gear-panel[data-panel='pack'] .gear-opt"), "背包選項 ≥44px")
    page.tap(".gear-opt[data-item='headlamp']")
    page.wait_for_timeout(150)
    page.screenshot(path=str(PREP_SHOTS / "mobile-03b-pack.png"))
    page.tap(".gear-tab[data-tab='review']")
    check(page.locator(".group-row:visible").count() == 5, "行前分頁顯示五組分數")
    page.wait_for_timeout(100)
    page.screenshot(path=str(PREP_SHOTS / "mobile-03c-review.png"))
    page.tap("#prep-next")
    page.wait_for_selector("#check-list")
    check(not overflow(), "檢查頁沒有橫向溢出")
    check(not small(".check-row, #prep-confirm, #prep-edit"), "檢查頁按鈕 ≥44px")
    page.wait_for_timeout(120)
    page.screenshot(path=str(PREP_SHOTS / "mobile-04-gear-check.png"))
    risk = int(page.inner_text("#check-risk").split("/")[0])
    page.tap("#prep-confirm")
    page.wait_for_timeout(500)
    check(g(page, "state.screen") == "play" and g(page, "state.risk") == risk, "手機可以出發")
    check(page.locator("#hud-trip").is_visible(), "手機 HUD 顯示山岳資訊")
    page.screenshot(path=str(PREP_SHOTS / "mobile-05-play.png"))
    g(page, "triggerNextEvent()")
    page.wait_for_timeout(350)
    page.evaluate("window.__game.answer(window.__game.wrongIndex())")
    page.wait_for_timeout(350)
    foot = page.locator("#card-foot").bounding_box()
    check(foot["y"] + foot["height"] <= 844, "手機作答後繼續鈕在畫面內")
    page.screenshot(path=str(PREP_SHOTS / "mobile-06-answered.png"))
    g(page, "skipToEnding()")
    page.wait_for_timeout(350)
    check(page.locator("#card-prep-review").is_visible(), "手機結局有回顧卡")
    ctx.close()

    print("其他尺寸的準備畫面")
    for w, h in [(360, 640), (844, 390), (1280, 720)]:
        mobile = w < 1000
        ctx = browser.new_context(viewport={"width": w, "height": h}, is_mobile=mobile, has_touch=mobile, device_scale_factor=2 if mobile else 1)
        page = ctx.new_page()
        page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
        page.on("pageerror", lambda e: errors.append(str(e)))
        open_prep(page)
        s = safe_seed(page, "nanhu", "autumn")
        open_prep(page, s)
        walk_to_gear(page, "nanhu", "autumn", touch=mobile)
        page.wait_for_timeout(150)
        panel = page.locator("#prep-panel").bounding_box()
        check(panel["x"] >= 0 and panel["x"] + panel["width"] <= w + 1 and panel["y"] + panel["height"] <= h + 1, f"{w}x{h} 面板在畫面內")
        vis = page.locator("#gear-scroll").bounding_box()
        check(vis["height"] >= 120, f"{w}x{h} 選項區可操作（{vis['height']:.0f}px）")
        page.screenshot(path=str(PREP_SHOTS / f"size-{w}x{h}.png"))
        ctx.close()


def new_ctx_page(browser, errors, w, h):
    mobile = w < 1000
    ctx = browser.new_context(viewport={"width": w, "height": h}, device_scale_factor=2 if mobile else 1,
                              is_mobile=mobile, has_touch=mobile)
    page = ctx.new_page()
    page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
    page.on("pageerror", lambda e: errors.append(str(e)))
    return ctx, page


OUTFIT_B = "{hat:'no_hat', base:'cotton', mid:'no_mid', shell:'no_shell', pants:'jeans', shoes:'sandals', gloves:'no_gloves'}"
OUTFIT_C = "{hat:'beanie', base:'wicking', mid:'down', shell:'rain_shell', pants:'quick_pants', gloves:'warm_gloves', shoes:'boots'}"


def set_outfit(page, outfit):
    page.evaluate(f"(() => {{ const P = window.__game.prep; Object.assign(P.selection, {outfit}); P.setTab('wear'); P.refreshGear(false); }})()")
    page.wait_for_timeout(80)


def why_state(page):
    return page.evaluate("""() => {
        const u = document.getElementById('prep-why');
        const items = [...u.querySelectorAll('li')].map((n) => {
            const cs = getComputedStyle(n);
            return { text: n.textContent, shown: cs.display !== 'none', nowrap: cs.whiteSpace === 'nowrap', clipped: n.scrollWidth > n.clientWidth + 1 || n.scrollHeight > n.clientHeight + 1 };
        });
        const more = document.getElementById('prep-why-more');
        return { shown: getComputedStyle(u).display !== 'none', items, more: more ? more.textContent : '' };
    }""")


def polish_mobile_gear_flow(browser, errors):
    for w, h in [(390, 844), (360, 640)]:
        tag = f"{w}x{h}"
        print(f"手機換裝美感 {tag}")
        ctx, page = new_ctx_page(browser, errors, w, h)
        open_prep(page)
        seed = safe_seed(page, "yushan", "autumn")
        open_prep(page, seed)
        walk_to_gear(page, "yushan", "autumn", touch=True)
        page.evaluate("window.__game.prep.applyRecommended()")
        page.wait_for_timeout(120)
        hash_a = page.evaluate("window.__game.prep.previewHash()")
        summary_a = page.inner_text("#gear-summary")
        st = why_state(page)
        ok = st["shown"] and st["items"][0]["shown"] and not st["items"][0]["nowrap"] and not st["items"][0]["clipped"]
        check(ok and "0 分不代表登山沒有風險" in st["items"][0]["text"], f"{tag} A 的風險說明完整換行顯示")
        tab_y = page.locator(".gear-tabs").bounding_box()["y"]
        foot_y = page.locator("#prep-foot").bounding_box()["y"]
        check(foot_y - tab_y >= 120 if h < 700 else foot_y - tab_y >= 220, f"{tag} 首屏仍留選項高度（{foot_y - tab_y:.0f}px）")
        stage = page.locator(".gear-stage").bounding_box()
        check(stage["height"] >= 118, f"{tag} 預覽高度足夠（{stage['height']:.0f}px）")
        tray = page.locator("#gear-tray-slot").bounding_box()
        check(tray["x"] >= stage["x"] + stage["width"] - 1 or tray["y"] >= stage["y"] + stage["height"] - 1, f"{tag} 物品盤不蓋住預覽角色")

        set_outfit(page, OUTFIT_C)
        st = why_state(page)
        check(not st["items"][0]["clipped"] and "0 分不代表登山沒有風險" in st["items"][0]["text"], f"{tag} C 的風險說明完整")
        check(page.evaluate("window.__game.prep.previewHash()") != hash_a, f"{tag} A／C 的預覽畫面不同")
        summary_c = page.inner_text("#gear-summary")
        check(summary_a != summary_c and "羽絨" in summary_c and "刷毛" in summary_a, f"{tag} A／C 的文字摘要不同：{summary_a}／{summary_c}")

        set_outfit(page, OUTFIT_B)
        check(page.inner_text("#gear-summary") == "棉T・不穿中層・不穿外層・拖鞋", f"{tag} B 的摘要與資料名稱一致：{page.inner_text('#gear-summary')}")
        st = why_state(page)
        check(st["items"][0]["shown"] and not st["items"][0]["clipped"] and "查看其餘" in st["more"], f"{tag} B 第一條完整，其餘有展開入口（{st['more']}）")
        check(page.locator("#prep-why-more").bounding_box()["height"] >= 44, f"{tag} 展開鈕 ≥44px")
        total = page.evaluate("window.__game.prep.assessment().findings.filter((x) => x.hit).length")
        page.tap("#prep-why-more")
        page.wait_for_timeout(80)
        st = why_state(page)
        check(len(st["items"]) == total and all(i["shown"] and not i["clipped"] for i in st["items"]), f"{tag} 展開後列出全部 {total} 條原因")
        page.tap("#prep-why-more")

        cols = page.evaluate("""() => [...document.querySelectorAll('.gear-panel[data-panel="wear"] .gear-opts')].map((n) => getComputedStyle(n).gridTemplateColumns.split(' ').length)""")
        check(all(c == 1 for c in cols), f"{tag} 穿著選項一欄，附用途說明 {cols}")
        small = page.evaluate("""() => [...document.querySelectorAll('.gear-opt, .gear-tab')].filter((n) => n.offsetParent).map((n) => n.getBoundingClientRect()).filter((r) => r.height < 44 || r.width < 44).length""")
        check(small == 0, f"{tag} 選項與分頁點擊區 ≥44px")
        over = page.evaluate("""() => { const b = document.getElementById('prep-body'); return b.scrollWidth > b.clientWidth + 1; }""")
        check(not over, f"{tag} 換裝沒有橫向溢出")
        check(page.evaluate("document.getElementById('prep-body').classList.contains('has-more')"), f"{tag} 主捲動區有底部淡出提示")
        page.evaluate("document.getElementById('prep-body').scrollTop = 500")
        page.wait_for_timeout(150)
        pin = page.evaluate("""() => {
            const body = document.getElementById('prep-body').getBoundingClientRect();
            const tabs = document.querySelector('.gear-tabs').getBoundingClientRect();
            const mini = document.getElementById('gear-mini');
            const art = document.getElementById('gear-mini-art');
            const painted = art.width > 0 && art.getContext('2d').getImageData(art.width / 2, art.height / 2, 1, 1).data[3] > 0;
            return { pinned: Math.abs(tabs.top - body.top) <= 1, mini: getComputedStyle(mini).display !== 'none', h: mini.getBoundingClientRect().height, text: mini.textContent, painted };
        }""")
        check(pin["pinned"] and pin["mini"], f"{tag} 捲動後分頁置頂並收成小摘要")
        check(pin["h"] <= 80 and pin["painted"] and "／" in pin["text"], f"{tag} 小摘要有小角色與配裝（{pin['h']:.0f}px）")
        page.tap(".gear-tab[data-tab='pack']")
        page.wait_for_timeout(80)
        first = page.locator(".gear-panel[data-panel='pack'] h4").first.bounding_box()
        tabs = page.locator(".gear-tabs").bounding_box()
        check(first["y"] >= tabs["y"] + tabs["height"] - 1, f"{tag} 換分頁回到新清單開頭")
        page.evaluate("(() => { document.getElementById('prep-body').scrollTop = 0; window.__game.prep.setTab('wear'); })()")
        page.evaluate("window.__game.prep.applyRecommended()")
        page.wait_for_timeout(80)
        page.tap(".tray-item[data-item='headlamp']")
        check(page.inner_text(".tray-name") == "頭燈含備用電池", f"{tag} 手機點物品顯示名稱")
        ctx.close()


def polish_desktop_flow(browser, errors):
    for w, h in [(1440, 900), (1280, 720)]:
        tag = f"{w}x{h}"
        print(f"桌機美感 {tag}")
        ctx, page = new_ctx_page(browser, errors, w, h)
        open_prep(page)
        seed = safe_seed(page, "yushan", "autumn")
        open_prep(page, seed)
        page.click("#btn-start")
        page.wait_for_selector("#prep-panel[data-step='mountain']")
        size = page.evaluate("""() => {
            const px = (q) => { const n = document.querySelector(q), s = getComputedStyle(n); return [parseFloat(s.fontSize), parseFloat(s.lineHeight) / parseFloat(s.fontSize)]; };
            const legal = getComputedStyle(document.getElementById('legal'));
            return { intro: px('.mtn-intro'), facts: px('.mtn-facts dd'), legal: parseFloat(legal.fontSize), color: legal.color, op: legal.opacity };
        }""")
        check(size["intro"][0] >= 14 and size["intro"][1] >= 1.49 and size["facts"][0] >= 14 and size["facts"][1] >= 1.49, f"{tag} 選山內文 ≥14px、行高 1.5 {size['intro']} {size['facts']}")
        check(size["legal"] >= 12 and size["op"] == "1" and size["color"] == "rgb(107, 92, 80)", f"{tag} 安全說明 ≥12px 深褐色不降透明度 {size}")
        chk = page.evaluate("""() => {
            const n = document.getElementById('prep-next'), s = getComputedStyle(n);
            return { bg: s.backgroundColor, shadow: s.boxShadow, need: document.getElementById('prep-foot').textContent };
        }""")
        check(chk["shadow"] == "none" and "先選一座山" in chk["need"], f"{tag} 停用的下一步沒有陰影並寫明欠缺 {chk['need']}")
        page.click(".mtn-card[data-id='yushan'] .mtn-pick")
        banners = page.evaluate("""() => [...document.querySelectorAll('.mtn-banner')].map((c) => c.toDataURL())""")
        check(len(set(banners)) == 6, f"{tag} 六座山的插圖都不同")
        check(page.locator("#prep-next").is_enabled(), f"{tag} 選山後才能下一步")
        page.click("#prep-next")
        page.click("[data-season='autumn']")
        page.wait_for_timeout(100)
        fc = page.evaluate("""() => getComputedStyle(document.querySelector('.fc-sub')).color""")
        check(fc == "rgb(107, 92, 80)", f"{tag} 季節頁補充文字深褐色 {fc}")
        page.click("#prep-next")
        page.wait_for_selector("#gear-preview")
        dress_sample(page)
        page.evaluate("window.__game.prep.applyRecommended()")
        page.wait_for_timeout(120)
        st = page.evaluate("""() => {
            const px = (q) => { const n = document.querySelector(q), s = getComputedStyle(n); return [parseFloat(s.fontSize), parseFloat(s.lineHeight) / parseFloat(s.fontSize)]; };
            const r = (q) => document.querySelector(q).getBoundingClientRect();
            const a = r('.gear-preview'), t = r('#gear-tray-slot');
            const list = document.getElementById('gear-scroll');
            return { teach: px('.gear-opt-teach'), name: parseFloat(getComputedStyle(document.querySelector('.gear-opt-name b')).fontSize),
                     apart: t.top >= a.bottom - 1 || t.left >= a.right - 1, groups: document.querySelectorAll('.tray-group').length,
                     over: list.scrollWidth > list.clientWidth + 1, fade: list.classList.contains('has-more'),
                     pad: parseFloat(getComputedStyle(list).paddingBottom), sp: parseFloat(getComputedStyle(list).scrollPaddingBottom) };
        }""")
        check(st["teach"][0] >= 14 and st["teach"][1] >= 1.49 and 15 <= st["name"] <= 16, f"{tag} 換裝說明與名稱字級 {st['teach']} {st['name']}")
        check(st["apart"], f"{tag} 物品盤不蓋住角色腿部")
        check(st["groups"] == 3, f"{tag} 物品盤分三組")
        check(not st["over"] and st["fade"] and st["pad"] >= 20 and st["sp"] >= 20, f"{tag} 清單不溢出、有底部 padding 與淡出提示")
        before = page.inner_text(".tray-name")
        page.click(".tray-item[data-item='headlamp']")
        check(before != page.inner_text(".tray-name") and page.inner_text(".tray-name") == "頭燈含備用電池", f"{tag} 點物品顯示名稱")
        check(page.get_attribute(".tray-item[data-item='headlamp']", "title") == "頭燈含備用電池", f"{tag} 物品 hover 有名稱")
        page.evaluate("document.getElementById('gear-scroll').scrollTop = 1e6")
        page.wait_for_timeout(100)
        check(not page.evaluate("document.getElementById('gear-scroll').classList.contains('has-more')"), f"{tag} 捲到底就收起淡出提示")
        page.evaluate("(() => { const P = window.__game.prep; P.selection.pack = []; P.refreshGear(false); })()")
        page.wait_for_timeout(60)
        check(page.locator(".tray-go").is_visible(), f"{tag} 空背包有前往背包的按鈕")
        page.click(".tray-go")
        check(page.locator(".gear-panel[data-panel='pack']").is_visible(), f"{tag} 空背包按鈕切到背包分頁")
        page.evaluate("window.__game.prep.applyRecommended()")
        page.click("#prep-next")
        page.wait_for_selector("#check-list")
        ct = page.evaluate("""() => {
            const s = getComputedStyle(document.querySelector('.check-text'));
            return { f: parseFloat(s.fontSize), lh: parseFloat(s.lineHeight) / parseFloat(s.fontSize), tray: document.querySelectorAll('.check-left .tray-group').length };
        }""")
        check(ct["f"] >= 14 and ct["lh"] >= 1.49 and ct["tray"] == 3, f"{tag} 檢查頁字級與物品分組 {ct}")
        ctx.close()

        ctx, page = new_ctx_page(browser, errors, w, h)
        open_game(page)
        npc = page.evaluate("""() => {
            const g = window.__game, W = window.DH.world, c = document.getElementById('scene');
            const card = document.querySelector('.start-card').getBoundingClientRect();
            const z = Math.min(1.05, Math.max(0.55, (c.clientWidth - card.right - 16) / 960));
            const left = g.view.cam.x - c.clientWidth / z / 2;
            const hiker = g.view.npcs.find((n) => n.kind === 'hiker');
            return { right: (hiker.x + 42 * hiker.s - left) * z, w: c.clientWidth };
        }""")
        check(npc["right"] <= npc["w"] - 8, f"{tag} 開始畫面山友完整在安全邊距內（右緣 {npc['right']:.0f}／{npc['w']}）")
        page.click("#btn-start")
        page.wait_for_timeout(250)
        if page.locator("#hints").is_visible():
            hint = page.evaluate("""() => { const s = getComputedStyle(document.getElementById('hints')); return [s.backgroundColor, s.color, s.textShadow]; }""")
            check(hint[0] == "rgb(251, 243, 224)" and hint[2] == "none", f"{tag} 走路指引奶油色實底 {hint}")
        ctx.close()


def polish_mountain_flow(browser, errors):
    print("手機選山狀態")
    ctx, page = new_ctx_page(browser, errors, 390, 844)
    open_prep(page)
    page.tap("#btn-start")
    page.wait_for_selector("#prep-panel[data-step='mountain']")
    st = page.evaluate("""() => {
        const on = document.querySelector('.mtn-chip.on'), s = getComputedStyle(on), n = getComputedStyle(document.getElementById('prep-next'));
        return { text: on.textContent, bottom: parseFloat(s.borderBottomWidth), bg: s.backgroundColor, shadow: n.boxShadow, need: document.getElementById('prep-foot').textContent };
    }""")
    check("✓" not in st["text"] and st["bottom"] >= 3, f"瀏覽中的山名是底線，沒有勾：{st['text']}")
    check(st["shadow"] == "none" and "先選一座山" in st["need"], f"手機停用下一步降噪並寫明欠缺：{st['need']}")
    page.tap(".mtn-chip[data-id='xueshan']")
    check("✓" not in page.inner_text(".mtn-chip[data-id='xueshan']") and g(page, "prep.mountainId") is None, "切換山名不等於選山")
    page.tap(".mtn-card.active .mtn-pick")
    check("✓" in page.inner_text(".mtn-chip[data-id='xueshan']") and "已選" in page.inner_text(".mtn-card.active .mtn-pick"), "按了選這座山才有勾與已選")
    check(page.locator("#prep-next").is_enabled(), "選山後可下一步")
    ctx.close()


def polish_walking_flow(browser, errors):
    print("手機走路入口")
    ctx, page = new_ctx_page(browser, errors, 390, 844)
    open_game(page)
    page.tap("#btn-start")
    page.wait_for_timeout(300)
    if page.locator("#prep-panel").is_visible():
        walk_to_gear(page, "qixing", "autumn", touch=True)
        page.tap("#prep-next")
        page.tap("#prep-confirm")
        page.wait_for_timeout(300)
    check(page.inner_text("#btn-interact") == "互動", "沒靠近事件時主鈕是互動")
    g(page, "teleportToNextEvent()")
    page.wait_for_timeout(250)
    check(page.inner_text("#btn-interact") == "查看狀況", "靠近事件時主鈕改標查看狀況")
    check(page.locator("#prompt").is_visible(), "第一次靠近仍有教學提示")
    room = page.evaluate("""() => { const b = document.getElementById('btn-interact'), c = getComputedStyle(b);
        return (b.clientWidth - parseFloat(c.paddingLeft) - parseFloat(c.paddingRight)) / parseFloat(c.fontSize); }""")
    check(2 <= room < 3, f"查看狀況斷成兩字兩行（可容 {room:.1f} 字）")
    box = page.evaluate("""() => {
        const r = (id) => document.getElementById(id).getBoundingClientRect();
        const a = r('actions'), j = r('joy'), b = r('btn-interact');
        const cross = (p, q) => p.left < q.right && q.left < p.right && p.top < q.bottom && q.top < p.bottom;
        return { joy: cross(a, j), btn: cross(a, b), left: a.left, center: innerWidth / 2 };
    }""")
    check(not box["joy"] and not box["btn"] and box["left"] > box["center"] + 42, f"小動作不擋搖桿與角色前方 {box}")
    check(page.locator(".act-btn:visible").count() == 0, "小動作預設收合")
    page.tap("#btn-actions")
    check(page.locator(".act-btn:visible").count() == 3, "點開可看到三個小動作")
    box = page.evaluate("""() => {
        const a = document.getElementById('actions').getBoundingClientRect(), j = document.getElementById('joy').getBoundingClientRect();
        return { joy: a.left < j.right && j.left < a.right && a.top < j.bottom && j.top < a.bottom, left: a.left, center: innerWidth / 2 };
    }""")
    check(not box["joy"] and box["left"] > box["center"] + 42, f"展開後也不擋搖桿與角色 {box}")
    page.tap(".act-btn[data-act='wave']")
    check(page.locator(".act-btn:visible").count() == 0, "選了小動作就收起")
    page.tap("#btn-interact")
    page.wait_for_timeout(250)
    check(g(page, "state.screen") == "card", "主鈕可開啟事件")
    page.evaluate("window.__game.answer(window.__game.correctIndex())")
    page.wait_for_timeout(250)
    g(page, "continue()")
    page.wait_for_timeout(120)
    check(page.evaluate("JSON.parse(localStorage.getItem(Object.keys(localStorage)[0])).nearHintDone") is True, "第一次互動記錄在 localStorage")
    g(page, "teleportToNextEvent()")
    page.wait_for_timeout(250)
    check(g(page, "state.nearEvent") and not page.locator("#prompt").is_visible() and page.inner_text("#btn-interact") == "查看狀況", "互動後收起中央提示，只留主鈕")
    page.screenshot(path=str(PREP_SHOTS / "walking-near-mobile.png"))
    ctx.close()


def polish_card_flow(browser, errors):
    for w, h in [(390, 844), (360, 640)]:
        tag = f"{w}x{h}"
        print(f"手機題卡固定區 {tag}")
        ctx, page = new_ctx_page(browser, errors, w, h)
        open_prep(page)
        seed = safe_seed(page, "xueshan", "autumn")
        open_prep(page, seed)
        walk_to_gear(page, "xueshan", "autumn", touch=True)
        page.tap("#prep-next")
        page.tap("#prep-confirm")
        sid = goto_key_event(page, "true")
        page.wait_for_timeout(400)

        def fixed():
            return page.evaluate("""() => {
                const f = document.getElementById('card-fixed').getBoundingClientRect();
                const t = document.getElementById('card-fixed-title'), r = t.getBoundingClientRect();
                const b = document.getElementById('card-key').getBoundingClientRect();
                const s = document.getElementById('card-scroll');
                const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
                return { h: f.height, title: t.textContent, want: window.__game.state.current.scenario.title, shown: r.width > 40 && (t === hit || t.contains(hit)),
                         clipped: t.scrollHeight > t.clientHeight + 1 || t.scrollWidth > t.clientWidth + 1, badgeIn: b.height <= f.height, outside: !s.contains(t), scrollTop: s.scrollTop, y: f.top,
                         strip: getComputedStyle(document.getElementById('card-key-strip')).borderBottomWidth };
            }""")
        st = fixed()
        check(sid and st["h"] <= 56 and st["shown"] and st["title"] == st["want"] and st["outside"] and not st["clipped"], f"{tag} 未作答：徽章旁固定題名，固定區 {st['h']:.0f}px")
        check(st["strip"] == "0px", f"{tag} 保命條去掉一層巢狀邊框")
        page.evaluate("window.__game.answer(window.__game.wrongIndex())")
        page.wait_for_selector("#fb-key:not([hidden])")
        page.wait_for_timeout(400)
        st = fixed()
        check(st["h"] <= 56 and st["shown"] and st["title"] == st["want"], f"{tag} 答錯後題名仍在（{st['h']:.0f}px）")
        fb = page.evaluate("""() => {
            const f = getComputedStyle(document.getElementById('fb-key')), p = document.getElementById('fb-key-point');
            const strong = p.querySelector('strong');
            return { left: parseFloat(f.borderLeftWidth), top: parseFloat(f.borderTopWidth), strong: strong ? strong.textContent : '', all: p.textContent, weight: getComputedStyle(p.parentElement).fontWeight };
        }""")
        check(fb["left"] >= 3 and fb["top"] == 0 and fb["weight"] == "400", f"{tag} 保命重點改左側單線、內文不粗 {fb['left']}/{fb['top']}/{fb['weight']}")
        check(fb["strong"] and fb["strong"] in fb["all"] and len(fb["strong"]) < len(fb["all"]), f"{tag} 粗體只用在必做行動：{fb['strong']}")
        page.tap("#card-fixed-title")
        page.wait_for_timeout(600)
        back = page.evaluate("""() => {
            const s = document.getElementById('card-scroll'), r = s.getBoundingClientRect();
            const o = document.querySelector('#card-opts .opt').getBoundingClientRect();
            return { top: s.scrollTop, first: o.top >= r.top - 1 && o.top < r.bottom };
        }""")
        check(back["top"] == 0 and back["first"], f"{tag} 點題名可回看題目與選項")
        page.evaluate("document.getElementById('card-scroll').scrollTop = 1e6")
        page.wait_for_timeout(120)
        end = page.evaluate("""() => {
            const s = document.getElementById('card-scroll'), r = s.getBoundingClientRect();
            const last = document.getElementById('fb-more').getBoundingClientRect(), next = document.getElementById('card-next').getBoundingClientRect();
            return { lastIn: last.bottom <= r.bottom, fade: s.classList.contains('has-more'), next: next.bottom <= innerHeight, pad: parseFloat(getComputedStyle(s).paddingBottom) };
        }""")
        check(end["lastIn"] and not end["fade"] and end["next"] and end["pad"] >= 16, f"{tag} 解說最下方與繼續鈕都到得了 {end}")
        ctx.close()


def polish_ending_flow(browser, errors):
    print("結局需複習樣式")
    ctx, page = new_ctx_page(browser, errors, 1440, 900)
    open_prep(page)
    seed = safe_seed(page, "xueshan", "autumn")
    open_prep(page, seed)
    walk_to_gear(page, "xueshan", "autumn")
    page.click("#prep-next")
    page.click("#prep-confirm")
    goto_key_event(page, "true")
    page.evaluate("window.__game.answer(window.__game.wrongIndex())")
    page.wait_for_timeout(100)
    g(page, "continue()")
    g(page, "skipToEnding()")
    page.wait_for_timeout(300)
    st = page.evaluate("""() => {
        const n = document.querySelector('.ending-key-item.ng .ending-key-status');
        const s = getComputedStyle(n), b = getComputedStyle(n, '::before');
        const list = document.querySelector('.ending-right');
        return { bg: s.backgroundColor, color: s.color, icon: b.content, text: n.textContent, fade: list.classList.contains('has-more'), pad: parseFloat(getComputedStyle(list).paddingBottom) };
    }""")
    check(st["bg"] == "rgb(253, 232, 228)" and st["color"] == "rgb(169, 47, 40)" and st["icon"] == '"!"' and st["text"] == "需複習", f"需複習是淺紅底深紅字加圖示 {st}")
    check(st["pad"] >= 20, "結局回顧有底部 padding")
    ctx.close()


def polish_variant_flow(browser, errors):
    print("情境文字依實際裝備")
    ctx, page = new_ctx_page(browser, errors, 1280, 720)
    open_prep(page)
    out = page.evaluate("""() => {
        const L = window.DH.prepLogic, G = window.__game, bank = G.getBank();
        const m = G.prep.data.mountains.mountains.find((x) => x.id === 'xueshan');
        const none = new Proxy({}, { get: () => false });
        const all = new Proxy({}, { get: () => true });
        const view = (id, gear) => { const s = bank.find((x) => x.id === id); return { raw: s, v: L.scenarioVariant(s, m, { gear }) }; };
        const res = {};
        ['key-wait-warm-visible', 'key-hypothermia-evacuation', 'key-last-known-marker', 'key-lost-up-or-down', 'lost-gully', 'key-turnaround-before-summit', 'download-offline-map'].forEach((id) => {
            const a = view(id, none), b = view(id, all);
            res[id] = { none: a.v.situation, full: b.v.situation, raw: a.raw.situation, noneOpts: a.v.options, fullOpts: b.v.options, rawOpts: a.raw.options, answer: a.raw.answer, risk: a.raw.risk };
        });
        return res;
    }""")
    banned = {"key-wait-warm-visible": ["乾衣", "睡墊", "頭燈", "亮色外套", "哨子"], "key-hypothermia-evacuation": ["全隊有乾衣"],
              "key-last-known-marker": ["離線軌跡"], "key-lost-up-or-down": ["核對地圖"], "lost-gully": ["地圖上看不出"],
              "key-turnaround-before-summit": ["靠頭燈"]}
    for sid, words in banned.items():
        v = out[sid]
        check(not any(w in v["none"] for w in words), f"{sid} 沒帶裝備時不提 {words}：{v['none'][-30:]}")
        check(v["full"] == v["raw"], f"{sid} 裝備齊全時維持原文")
        check(len(v["noneOpts"]) == len(v["rawOpts"]) and v["fullOpts"] == v["rawOpts"], f"{sid} 選項數量不變")
    w = out["key-wait-warm-visible"]
    check("吹哨" not in w["noneOpts"][1] and "用燈" not in w["noneOpts"][1] and "亮色物" in w["noneOpts"][1], f"沒哨子與頭燈時正解改用可行做法：{w['noneOpts'][1]}")
    check("吹哨" not in w["noneOpts"][2], "沒哨子時誤答選項不寫吹哨")
    check(out["key-hypothermia-evacuation"]["noneOpts"][1].startswith("留衣物"), "沒乾衣時選項不寫留乾衣")
    check("離線地圖沒下載到" in out["download-offline-map"]["full"], "帶了離線地圖時改說明缺的是這段路線")
    raw = {s["id"]: s for s in json.loads((ROOT / "data" / "scenarios.json").read_text(encoding="utf-8"))}
    check(all(out[i]["raw"] == raw[i]["situation"] and out[i]["answer"] == raw[i]["answer"] and out[i]["risk"] == raw[i]["risk"] for i in out), "題庫原文、答案與風險不變")
    ctx.close()


def main():
    SHOTS.mkdir(exist_ok=True)
    server = subprocess.Popen([sys.executable, str(ROOT / "tests" / "serve.py"), str(PORT)],
                              cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(0.7)
    errors = []
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True, args=['--disable-webgl', '--disable-webgl2', '--disable-3d-apis'])
            desktop_flow(browser, errors)
            small_bank_flow(browser, errors)
            mobile_flow(browser, errors)
            art_rules_flow(browser, errors)
            layout_audit_flow(browser, errors)
            desktop_card_flow(browser, errors)
            data_rules_flow(browser, errors)
            load_failure_flow(browser)
            PREP_SHOTS.mkdir(exist_ok=True)
            prep_flow(browser, errors)
            prep_headlamp_flow(browser, errors)
            prep_modifier_flow(browser, errors)
            prep_selection_flow(browser, errors)
            key_selection_flow(browser, errors)
            key_card_flow(browser, errors)
            key_ending_flow(browser, errors)
            prep_postpone_flow(browser, errors)
            prep_fallback_flow(browser)
            prep_mobile_flow(browser, errors)
            polish_mobile_gear_flow(browser, errors)
            polish_desktop_flow(browser, errors)
            polish_mountain_flow(browser, errors)
            polish_walking_flow(browser, errors)
            polish_card_flow(browser, errors)
            polish_ending_flow(browser, errors)
            polish_variant_flow(browser, errors)
            browser.close()
    finally:
        server.terminate()
    check(not errors, f"無 console error：{errors[:5]}")
    print(f"\n{'全部通過' if not failures else f'{len(failures)} 項失敗'}")
    for f in failures:
        print("  -", f)
    sys.exit(1 if failures else 0)


if __name__ == "__main__":
    main()
