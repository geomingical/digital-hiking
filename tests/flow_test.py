#!/usr/bin/env python3
"""玩家看得到的準備流程：進換裝時還沒穿好、選完才放行、選擇會跟著走到路上與結局。"""
import math
import pathlib
import subprocess
import sys
import time

from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
PORT = 8791
URL = f"http://127.0.0.1:{PORT}/index.html?seed=12"
failures = []


def check(cond, label):
    print(("  ok  " if cond else "  FAIL") + " " + label)
    if not cond:
        failures.append(label)


def to_gear(page):
    page.goto(URL)
    page.wait_for_function("window.__game && window.__game.state.prepReady")
    page.click("#btn-start")
    page.click(".mtn-card[data-id='yushan'] .mtn-pick")
    check(page.locator("#prep-ack").count() == 0, "選山不用再另外勾選已閱讀")
    check("許可" in page.inner_text("#prep-foot"), "選山後，下一步旁邊就看得到許可需求")
    page.click("#prep-next")
    page.click("[data-season='autumn']")
    page.click("#prep-next")
    page.wait_for_selector("#gear-preview")


def choose_all_worn(page):
    for item in ["no_hat", "cotton", "no_mid", "no_shell", "jeans", "sandals", "no_gloves", "no_socks"]:
        page.click(f".gear-opt[data-item='{item}']")


def scene_is_sharp(page) -> bool:
    return page.evaluate(
        """() => {
          const c = document.getElementById('scene3d');
          return Math.abs(c.width / c.height - c.clientWidth / c.clientHeight) < 0.02;
        }"""
    )


def check_scene_3d(page) -> None:
    page.wait_for_timeout(1500)
    check(page.evaluate("document.getElementById('app').classList.contains('is-3d')"), "支援 WebGL 的瀏覽器走 3D 畫面")
    check(len(page.locator("#scene3d").screenshot()) > 30000, "3D 畫面不是空白的")
    check(scene_is_sharp(page), "3D 畫面的比例跟視窗一致")

    yaw_start = page.evaluate("DH.world3d.hero.rotation.y")
    x_start = page.evaluate("window.__game.state.player.x")
    page.keyboard.down("ArrowUp")
    page.wait_for_function(f"window.__game.state.player.x > {x_start} + 40", timeout=15000)
    yaw_walk = page.evaluate("DH.world3d.hero.rotation.y")
    page.keyboard.up("ArrowUp")
    turn = abs(math.atan2(math.sin(yaw_walk - yaw_start), math.cos(yaw_walk - yaw_start)))
    check(turn < 0.35, f"開場就面向山路，往前走不用先轉身（轉了 {turn:.2f} 弧度）")

    x_before = page.evaluate("window.__game.state.player.x")
    box = page.locator("#scene3d").bounding_box()
    page.mouse.click(box["x"] + box["width"] / 2, box["y"] + box["height"] * 0.62)
    page.wait_for_function(f"window.__game.state.player.x > {x_before} + 5", timeout=15000)
    check(True, "點前方的地面，角色會走過去")

    page.evaluate("window.__game.teleportToNextEvent()")
    page.keyboard.down("ArrowUp")
    page.wait_for_function("window.__game.state.nearEvent || window.__game.state.screen === 'card'", timeout=30000)
    page.keyboard.up("ArrowUp")
    if page.evaluate("window.__game.state.screen") != "card":
        page.keyboard.press("e")
    page.wait_for_function("window.__game.state.screen === 'card'", timeout=10000)
    check(True, "走到路標按互動，題目會打開")
    page.evaluate("window.__game.answer(window.__game.wrongIndex())")
    page.wait_for_timeout(200)
    page.evaluate("window.__game.continue()")
    page.wait_for_function("window.__game.state.screen === 'play'")


def check_moments_and_mountains(page) -> None:
    page.evaluate("window.__game.state.player.x = 4600")
    page.wait_for_timeout(500)
    page.evaluate("window.__game.state.player.x = 4900")
    page.wait_for_function("window.__game.view.moment && window.__game.view.moment.kind === 'summit'", timeout=8000)
    check("山頂" in page.inner_text("#cine-title"), "第一次到山頂有慶祝鏡頭")
    page.wait_for_function("!window.__game.view.moment", timeout=10000)
    check(page.locator("#cine-title").is_hidden(), "慶祝完介面會回來")

    errors = page.evaluate(
        """() => {
          const out = [];
          for (const id of DH.biomes.ids) for (const season of ['spring', 'summer', 'autumn', 'winter']) {
            try {
              DH.world3d.setBiome(id, season);
              DH.world3d.sync(window.__game.view.decor, window.__game.view.npcs, window.__game.state.events);
            } catch (err) { out.push(`${id}/${season}: ${err.message}`); }
          }
          DH.world3d.setBiome('yushan', 'autumn');
          DH.world3d.sync(window.__game.view.decor, window.__game.view.npcs, window.__game.state.events);
          return out;
        }"""
    )
    check(not errors, f"六座山四季的場景都蓋得起來 {errors[:2]}")
    painted = page.evaluate("Object.keys(DH.gearArt.paintings).sort().join()")
    check(painted.count("mtn-") == 6 and "room-night" in painted, "選山卡與房間都換成同風格的 3D 模型")
    check(page.evaluate("DH.gearArt.paintings['mtn-yushan'] instanceof HTMLCanvasElement"), "有 3D 時不再用手繪圖")


def check_observe_stage(page) -> None:
    missing = page.evaluate(
        """() => {
          const ids = new Set(window.__game.getBank().map((s) => s.id));
          return DH.stage3d.ids.filter((id) => !ids.has(id));
        }"""
    )
    check(not missing, f"每個現場都對應到題庫裡的題目 {missing[:3]}")
    index = page.evaluate(
        """() => {
          const g = window.__game;
          const i = g.state.events.findIndex((e) => e.scenario.id === 'falling-rock');
          if (i >= 0) { g.state.eventIndex = i; g.state.player.x = g.state.events[i].x - 30; }
          return i;
        }"""
    )
    check(index >= 0, "玉山這趟一定會走到主峰碎石坡的落石現場")
    page.wait_for_function("!!window.__game.view.observe", timeout=10000)
    check("玉山主峰碎石坡" in page.inner_text("#observe-title"), "落石現場標出這座山的地名")
    check(page.get_attribute("#observe-go", "aria-disabled") == "true", "還沒看現場不能直接作答")
    page.locator("#observe-go").evaluate("e => e.click()")
    check(page.evaluate("window.__game.state.screen") == "play", "按下判斷也不會跳過觀察")
    page.keyboard.press("1")
    page.keyboard.press("2")
    check(page.locator("#observe-notes li").count() == 2, "按數字鍵也能看線索")
    check(page.get_attribute("#observe-go", "aria-disabled") == "false", "看過兩處就能下判斷")
    page.keyboard.press("e")
    page.wait_for_function("window.__game.state.screen === 'card'", timeout=5000)
    check("坡頂" in page.inner_text("#card-seen"), "題目卡記得你看到了什麼")
    check("持續掉下" not in page.inner_text("#card-sit"), "看過現場後，題目不再把線索講一遍")
    check("小石頭" in page.inner_text("#card-seen"), "看過的線索可以回看")
    page.evaluate("window.__game.answer(window.__game.wrongIndex())")
    check(page.locator("#fb-world").is_visible(), "答完看得到現場怎麼回應")
    check("隊友" in page.inner_text("#fb-world"), "沒看的線索會在解說裡補上")
    page.evaluate("window.__game.continue()")
    page.wait_for_function("window.__game.state.screen === 'play'")
    page.wait_for_function(
        "!DH.world3d.stageOf(window.__game.state.events[%d]).group.visible" % index, timeout=30000
    )
    check(True, "離開題目後現場會收掉，路走得過去")
    page.evaluate("window.__game.state.player.x = 1500")


def check_rescue_ending(page) -> None:
    page.evaluate("window.__game.skipToEnding('bad')")
    page.wait_for_selector("#ending-screen:not([hidden])")
    page.keyboard.press("Enter")
    check("本來可以避免" in page.inner_text("#ending-title"), "風險 100 的結局標題是檢討，不是鼓勵")
    check("119" in page.inner_text("#ending-safety") and "112" in page.inner_text("#ending-safety"), "檢討結局仍明寫真的出事要立刻求救")
    check("行前就帶著" in page.inner_text("#ending-review"), "檢討列出這趟風險的實際來源")
    check(page.locator("#ending-badges .badge-chip").count() == 0, "動用救援的一趟不發徽章")
    check(page.inner_text("#ending-best") == "", "動用救援的一趟不算最佳紀錄")
    badge_names = page.evaluate("DH.core.BADGES.map((b) => b.name).join()")
    check("求救" not in badge_names, "沒有獎勵求救結局的徽章")
    check(page.evaluate("!!DH.world3d.heli"), "直升機救援場面保留")
    page.click("#btn-again")
    page.wait_for_selector("#prep-next, #prep-confirm")
    for _ in range(4):
        if page.locator("#prep-confirm").is_visible():
            break
        page.click("#prep-next")
        page.wait_for_timeout(200)
    page.click("#prep-confirm")
    page.wait_for_function("window.__game.state.screen === 'play'")
    page.wait_for_timeout(500)


def check_photo(page) -> None:
    page.evaluate("window.__game.state.eventIndex = window.__game.state.events.length; window.__game.state.player.x = 1700")
    page.wait_for_timeout(300)
    page.keyboard.press("3")
    check(page.locator("#photo-mode").is_visible(), "按拍照會切到拍照模式")
    page.wait_for_function("!document.getElementById('photo-view').hidden", timeout=20000)
    info = page.evaluate("window.__game.state.photos.at(-1).info")
    check(info["mountain"] == "玉山主峰", "照片寫上這座山")
    check(info["altitude"] > 2000, f"照片寫上當下的海拔（{info['altitude']}）")
    check(not page.evaluate("document.getElementById('hud').checkVisibility({ opacityProperty: true })"), "拍照時介面退開")
    page.click("#photo-again")
    page.wait_for_function("window.__game.state.photos.length === 2", timeout=20000)
    check(True, "可以再拍一張")
    page.keyboard.press("ArrowUp")
    check(not page.evaluate("window.__game.view.photoMode"), "按任意鍵回到遊戲")
    check(page.locator("#photo-mode").is_hidden(), "回到遊戲後相框收起來")
    page.keyboard.up("ArrowUp")


def check_album(page) -> None:
    check(page.locator("#album-big").is_visible(), "結局頁有我的山景照")
    thumbs = page.locator(".album-thumb").count()
    photos = page.evaluate("window.__game.state.photos.length")
    check(thumbs == photos == 2, f"拍幾張就有幾張可選（{thumbs} 個縮圖，{photos} 張照片）")
    with page.expect_download() as download:
        page.click("#album-save")
    check(download.value.suggested_filename.endswith(".png") and "玉山主峰" in download.value.suggested_filename, "下載的照片檔名有山名")


def check_phone_brief_feedback(browser) -> None:
    ctx = browser.new_context(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True)
    page = ctx.new_page()
    page.goto(URL)
    page.wait_for_function("window.__game && window.__game.state.prepReady")
    page.evaluate("window.__game.startGame()")
    page.wait_for_timeout(800)
    page.evaluate(
        """() => {
          const g = window.__game;
          const s = g.getBank().find((x) => x.id === 'falling-rock');
          const ev = g.state.events[g.state.eventIndex];
          ev.scenario = s;
          ev.options = s.options.map((text, i) => ({ text, correct: i === s.answer, risk: s.risk[i] }));
          DH.world3d.buildStages(g.state.events);
          g.triggerNextEvent();
        }"""
    )
    page.wait_for_function("window.__game.state.screen === 'card'")
    page.evaluate("window.__game.answer(window.__game.wrongIndex())")
    page.wait_for_timeout(400)
    check("看解析" in page.inner_text("#card-next"), "手機答完先看現場，按鈕是看解析")
    check(page.locator("#card-opts").is_hidden(), "手機第一步不擠選項和長解說")
    height = page.evaluate("document.getElementById('card').getBoundingClientRect().height")
    check(height < 844 * 0.42, f"手機第一步的卡片留出大半現場（高 {height:.0f}px）")
    page.wait_for_timeout(300)
    page.click("#card-next")
    check(page.evaluate("window.__game.state.screen") == "card", "第一次按只是展開解析，不會直接離開")
    check(page.locator("#fb-more").is_visible(), "展開後看得到完整解析")
    check("回到山路" in page.inner_text("#card-next"), "展開後按鈕變回回到山路")
    ctx.close()


def run(browser):
    errors = []
    page = browser.new_context(viewport={"width": 1440, "height": 900}).new_page()
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)

    page.goto(URL)
    page.wait_for_function("window.__game && window.__game.state.prepReady")
    page.evaluate("localStorage.clear()")
    page.reload()
    page.wait_for_function("window.__game && window.__game.state.prepReady")
    check(page.locator("#hero-pick input:checked").count() == 1, "開場就看得到選角色，不會多卡一步")
    page.check("#hero-pick input[value='female']", force=True)
    check(page.evaluate("DH.player.gender") == "female", "選女生就換成女生")
    page.reload()
    page.wait_for_function("window.__game && window.__game.state.prepReady")
    check(page.is_checked("#hero-pick input[value='female']"), "重新整理後記得選過的角色")
    page.focus("#hero-pick input[value='female']")
    page.keyboard.press("ArrowLeft")
    check(page.evaluate("DH.player.gender") == "male", "方向鍵也能換角色")
    box = page.locator(".hero-opt").first.bounding_box()
    check(box["height"] >= 44, "選角色的按鈕夠大")
    to_gear(page)
    male_hash = page.evaluate("window.__game.prep.previewHash()")
    page.click(".hero-switch")
    page.wait_for_timeout(200)
    check(page.evaluate("DH.player.gender") == "female", "換裝時也能改角色")
    check(page.evaluate("window.__game.prep.previewHash()") != male_hash, "換角色，預覽的人物真的變了")
    page.click(".hero-switch")
    check(page.locator(".gear-opt.on").count() == 0, "第一次進換裝，沒有任何品項是預選的")
    check("家居服" in page.inner_text("#gear-summary"), "摘要說明角色還穿著家居服")
    check(page.locator("#prep-risk").count() == 0, "還沒穿好前不顯示行前風險分數")
    check(page.locator("#btn-recommend").is_hidden(), "還沒自己選過，不提供一鍵建議清單")
    undressed = page.evaluate("window.__game.prep.previewHash()")

    check("9" in page.inner_text("#prep-next"), "下一步按鈕顯示還差 9 項")
    page.click("#prep-next")
    check(page.locator("#gear-preview").count() == 1, "還沒選完不能進裝備檢查")
    check(page.locator(".gear-opt.flash").count() == 1, "按下一步會帶到第一個還沒選的項目")

    page.click(".gear-opt[data-item='boots']")
    check(page.evaluate("window.__game.prep.previewHash()") != undressed, "選一件，角色身上就變一件")

    choose_all_worn(page)
    page.click("#prep-next")
    check(page.get_attribute(".gear-tab[data-tab='pack']", "aria-selected") == "true", "穿好後，下一步帶到背包的飲水")
    page.click(".gear-opt[data-item='water_1']")
    check(page.locator("#prep-risk").count() == 1, "全部選完才顯示行前風險")
    check(page.locator("#btn-recommend").is_visible(), "全部選完後可以對照建議清單")
    page.click("#prep-next")
    page.wait_for_selector("#check-list")
    check(page.locator("#prep-confirm").is_visible(), "全部選完可以進裝備檢查")

    page.click("#prep-confirm")
    page.wait_for_function("window.__game.state.screen === 'play'")
    check(page.locator("#cine-title").is_visible() and "玉山" in page.inner_text("#cine-title"), "出發時有開場鏡頭，標出這座山")
    check_scene_3d(page)
    check_observe_stage(page)
    check_moments_and_mountains(page)
    page.evaluate("window.__game.state.player.x = 1500")
    page.wait_for_timeout(300)

    check_rescue_ending(page)
    check_photo(page)
    page.evaluate("window.__game.skipToEnding('normal')")
    page.wait_for_selector("#ending-screen:not([hidden])")
    check(page.evaluate("document.getElementById('app').classList.contains('cine')"), "結局先給全螢幕的畫面")
    page.keyboard.press("Enter")
    check(not page.evaluate("document.getElementById('app').classList.contains('cine')"), "按一下就能跳過結局鏡頭")
    check(page.locator("#ending-screen").is_visible(), "跳過鏡頭那一下，不會順手按到再玩一次")
    check(page.locator("#ending-trail svg").count() == 1, "結局有這趟的高度足跡圖")
    check_album(page)
    page.click("#btn-again")
    page.wait_for_selector("#gear-preview, .fc-card, #prep-panel[data-step='forecast']")
    check(page.evaluate("window.__game.prep.selection.shoes") == "sandals", "再走一趟會帶著同一份清單")
    page.wait_for_selector("#prep-next")
    for _ in range(4):
        if page.locator("#prep-confirm").is_visible():
            break
        page.click("#prep-next")
        page.wait_for_timeout(200)
    page.click("#prep-confirm")
    page.wait_for_function("window.__game.state.screen === 'play'")
    page.wait_for_timeout(1500)
    check(page.evaluate("DH.world3d.markers.visible"), "再走一趟，路上的題目路標還在")
    check(scene_is_sharp(page), "從結局回來後，3D 畫面的解析度跟視窗一致")

    page.goto(URL)
    page.wait_for_function("window.__game && window.__game.state.prepReady")
    page.evaluate("window.__game.prep.selection = window.__game.logic.sampleSelection(); window.__game.prep.toMountains()")
    check(page.evaluate("window.__game.prep.selection.shoes") is None, "回到選山重新開始，就從家居服重新穿")

    check(not errors, f"沒有 JavaScript 錯誤 {errors[:3]}")


srv = subprocess.Popen([sys.executable, str(ROOT / "tests" / "serve.py"), str(PORT)], cwd=ROOT,
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1)
try:
    with sync_playwright() as p:
        b = p.chromium.launch()
        run(b)
        check_phone_brief_feedback(b)
        b.close()
finally:
    srv.terminate()
print(f"\n{len(failures)} failed")
sys.exit(1 if failures else 0)
