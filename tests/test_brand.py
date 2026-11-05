#!/usr/bin/env python3
"""品牌小標記：結局頁的製作者連結、開始畫面的「關於」小卡、下載 PNG 角落的淡浮水印。
都要小、不擋到既有介面；截圖存到 research/brand_shots/。"""
import pathlib
import struct
import subprocess
import sys
import time
import zlib

from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "research" / "brand_shots"
PORT = 8767
URL = f"http://localhost:{PORT}/index.html"
SITE = "https://aimingdata.com"
MAIL = "mailto:geomingical@gmail.com"
failures = []


def check(cond, label):
    print(("  ok  " if cond else "  FAIL") + " " + label)
    if not cond:
        failures.append(label)


def track_errors(page, errors):
    page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
    page.on("pageerror", lambda e: errors.append(str(e)))


def boxes_overlap(a, b):
    return a and b and a["x"] < b["x"] + b["width"] and b["x"] < a["x"] + a["width"] \
        and a["y"] < b["y"] + b["height"] and b["y"] < a["y"] + a["height"]


def overlaps(page, selector, others):
    """回傳 selector 跟哪些可見元素重疊。沒有底色、框線的區塊只算文字實際占的範圍，
    不然標題為了讓位留的 padding 也會被算成重疊。"""
    return page.evaluate("""([sel, others]) => {
      const r = document.querySelector(sel).getBoundingClientRect();
      const painted = (el) => {
        const s = getComputedStyle(el);
        const bare = s.backgroundColor === 'rgba(0, 0, 0, 0)' && s.backgroundImage === 'none' && parseFloat(s.borderTopWidth) === 0
          && !/^(BUTTON|CANVAS|INPUT|IMG|svg)$/.test(el.tagName);
        if (!bare) return el.getBoundingClientRect();
        const range = document.createRange();
        range.selectNodeContents(el);
        return range.getBoundingClientRect();
      };
      const hit = [];
      document.querySelectorAll(others).forEach((el) => {
        if (el === document.querySelector(sel) || el.contains(document.querySelector(sel))) return;
        const o = painted(el);
        if (!o.width || !o.height || el.closest('[hidden]')) return;
        if (r.left < o.right - 0.5 && o.left < r.right - 0.5 && r.top < o.bottom - 0.5 && o.top < r.bottom - 0.5)
          hit.push(el.id || el.className || el.tagName);
      });
      return hit;
    }""", [selector, others])


def in_view(page, selector):
    return page.evaluate("""(sel) => {
      const r = document.querySelector(sel).getBoundingClientRect();
      const legal = document.getElementById('legal').getBoundingClientRect();
      return r.width > 0 && r.top >= 0 && r.left >= 0 && r.right <= innerWidth && r.bottom <= legal.top + 0.5;
    }""", selector)


def topmost(page, selector):
    """元素中心點真的是它自己（沒有被別的東西蓋住）。"""
    return page.evaluate("""(sel) => {
      const el = document.querySelector(sel);
      const r = el.getBoundingClientRect();
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return !!hit && (hit === el || el.contains(hit));
    }""", selector)


def open_start(page):
    page.goto(URL + "?seed=123&classic=1")
    page.wait_for_function("window.__game && window.__game.state.bankReady")
    page.wait_for_timeout(250)


def to_ending(page):
    """同 test_download：走捷徑到結局頁，關 WebGL 時補一張 2D 的照片。"""
    open_start(page)
    page.click("#btn-start")
    page.wait_for_function("window.__game.state.screen === 'play'")
    page.evaluate("window.__game.skipToEnding('normal')")
    page.wait_for_selector("#ending-screen:not([hidden])")
    if page.evaluate("document.getElementById('app').classList.contains('cine')"):
        page.keyboard.press("Enter")
    page.evaluate("""(() => {
      const g = window.__game;
      if (g.state.photos.length) return;
      const src = document.createElement('canvas');
      src.width = src.height = 720;
      const c = src.getContext('2d');
      const sky = c.createLinearGradient(0, 0, 0, 720);
      sky.addColorStop(0, '#a9ddf5');
      sky.addColorStop(1, '#e4f5e4');
      c.fillStyle = sky;
      c.fillRect(0, 0, 720, 720);
      c.fillStyle = '#4fa871';
      c.beginPath(); c.moveTo(0, 720); c.lineTo(260, 260); c.lineTo(420, 430); c.lineTo(560, 300); c.lineTo(720, 720); c.fill();
      const info = { mountain: '測試山', season: '春', altitude: 3952, section: 'summit', plain: false };
      g.state.photos.push({ canvas: DH.photo.compose(src, info), info });
      DH.photo.showAlbum(g.state.photos);
    })()""")
    page.wait_for_selector("#album-save", state="visible")
    page.wait_for_function("document.getAnimations().every((a) => a.playState !== 'running')")


def decode_png(data):
    """只解 8-bit RGB/RGBA、非交錯的 PNG（Chromium 的 toBlob 輸出就是這種）。"""
    assert data[:8] == b"\x89PNG\r\n\x1a\n"
    pos, idat, w = 8, b"", 0
    while pos < len(data):
        n = struct.unpack(">I", data[pos:pos + 4])[0]
        kind, body = data[pos + 4:pos + 8], data[pos + 8:pos + 8 + n]
        if kind == b"IHDR":
            w, h, depth, ctype, _, _, interlace = struct.unpack(">IIBBBBB", body)
            assert depth == 8 and ctype in (2, 6) and interlace == 0, (depth, ctype, interlace)
            bpp = 4 if ctype == 6 else 3
        elif kind == b"IDAT":
            idat += body
        pos += 12 + n
    raw = zlib.decompress(idat)
    stride = w * bpp
    rows, prev = [], bytearray(stride)
    for y in range(h):
        f = raw[y * (stride + 1)]
        line = bytearray(raw[y * (stride + 1) + 1:(y + 1) * (stride + 1)])
        for i in range(stride):
            a = line[i - bpp] if i >= bpp else 0
            b = prev[i]
            c = prev[i - bpp] if i >= bpp else 0
            if f == 1:
                line[i] = (line[i] + a) & 255
            elif f == 2:
                line[i] = (line[i] + b) & 255
            elif f == 3:
                line[i] = (line[i] + (a + b) // 2) & 255
            elif f == 4:
                pa, pb, pc = abs(b - c), abs(a - c), abs(a + b - 2 * c)
                line[i] = (line[i] + (a if pa <= pb and pa <= pc else b if pb <= pc else c)) & 255
        rows.append(bytes(line))
        prev = line
    return w, h, bpp, rows


def region_ink(png, x0, y0, x1, y1):
    """區塊裡跟背景（區塊左上角的顏色）明顯不同的像素數、以及最深的差距。"""
    w, h, bpp, rows = png
    bg = rows[y0][x0 * bpp:x0 * bpp + 3]
    count, deepest = 0, 0
    for y in range(y0, y1):
        r = rows[y]
        for x in range(x0, x1):
            d = max(abs(r[x * bpp + k] - bg[k]) for k in range(3))
            if d > 12:
                count += 1
            deepest = max(deepest, d)
    return count, deepest


def check_watermark(data, label):
    png = decode_png(data)
    w, h = png[0], png[1]
    ink, deepest = region_ink(png, w - 340, h - 60, w - 20, h - 18)
    check(ink > 300, f"{label}：右下角有浮水印字（{ink} px）")
    check(deepest < 140, f"{label}：浮水印很淡，不搶畫面（最大色差 {deepest}）")
    # 浮水印左邊緊鄰的一塊要是乾淨的，代表沒有壓到既有文字
    clean, _ = region_ink(png, w - 420, h - 58, w - 350, h - 20)
    check(clean == 0, f"{label}：浮水印左側沒有跟其他文字擠在一起（{clean} px）")


def desktop_flow(browser, errors):
    print("桌機 1280x720")
    ctx = browser.new_context(viewport={"width": 1280, "height": 720}, accept_downloads=True)
    page = ctx.new_page()
    track_errors(page, errors)

    # ---- 開始畫面「關於」 ----
    open_start(page)
    about = page.locator("#btn-about")
    check(about.is_visible() and about.inner_text().strip() == "關於", "開始畫面有「關於」")
    check(in_view(page, "#btn-about") and topmost(page, "#btn-about"), "「關於」在畫面內、沒被蓋住")
    hit = overlaps(page, "#btn-about", ".start-card *")
    check(not hit, f"「關於」不跟開始卡片其他元素重疊（{hit}）")
    size = about.bounding_box()
    check(size["height"] <= 26 and page.evaluate("parseFloat(getComputedStyle(document.getElementById('btn-about')).fontSize)") <= 13,
          f"「關於」是小字（{size['width']:.0f}x{size['height']:.0f}）")
    about.click()
    page.wait_for_selector("#modal:not([hidden])")
    page.wait_for_function("document.getAnimations().every((a) => a.playState !== 'running')")
    body = page.inner_text("#modal-box, .modal-box")
    check("AIMing Data" in body and "製作" in body, "關於小卡寫明由 AIMing Data 製作")
    site = page.locator(".about a[href^='https://aimingdata.com']")
    check(site.count() == 1 and site.get_attribute("target") == "_blank" and "noopener" in (site.get_attribute("rel") or ""),
          "網站連結另開分頁且 rel=noopener")
    mail = page.locator(".about a[href^='mailto:']")
    check(mail.count() == 1 and mail.inner_text() == "意見回饋" and (mail.get_attribute("href") or "").startswith(MAIL),
          "意見回饋是 mailto 連結")
    check(page.locator(".about form, .about input, .about textarea").count() == 0, "沒有表單")
    box = page.locator(".modal-box").bounding_box()
    check(box["width"] <= 380, f"關於是小卡片（寬 {box['width']:.0f}）")
    OUT.mkdir(parents=True, exist_ok=True)
    page.screenshot(path=str(OUT / "about.png"))
    page.keyboard.press("Escape")
    check(page.locator("#modal").is_hidden(), "Esc 關閉關於")
    check(page.evaluate("document.activeElement && document.activeElement.id") == "btn-about", "關閉後焦點回到「關於」")
    about.click()
    page.mouse.click(8, 8)
    check(page.locator("#modal").is_hidden(), "點背景關閉關於")
    about.click()
    page.click("#modal-close")
    check(page.locator("#modal").is_hidden(), "關閉鈕關閉關於")
    page.click("#btn-howto")
    check(page.evaluate("document.getElementById('modal').dataset.variant") == "", "其他彈窗不沿用關於的小卡樣式")
    page.keyboard.press("Escape")

    # ---- 結局頁一行製作者 ----
    to_ending(page)
    credit = page.locator(".ending-credit a")
    check(credit.is_visible() and credit.inner_text() == "由 AIMing Data 製作", "結局頁有「由 AIMing Data 製作」")
    check(credit.get_attribute("href").rstrip("/") == SITE and credit.get_attribute("target") == "_blank"
          and "noopener" in (credit.get_attribute("rel") or ""), "製作者連結指向官網、另開分頁")
    check(in_view(page, ".ending-credit a") and topmost(page, ".ending-credit a"), "製作者那行在畫面內、沒被蓋住")
    hit = overlaps(page, ".ending-credit", ".ending-panel button, .ending-panel canvas, .ending-panel h2, .ending-panel h3, .ending-panel p")
    check(not hit, f"製作者那行不跟結局頁其他元素重疊（{hit}）")
    fs = page.evaluate("parseFloat(getComputedStyle(document.querySelector('.ending-credit')).fontSize)")
    check(fs <= 12.5, f"製作者那行是小字（{fs}px）")
    page.screenshot(path=str(OUT / "ending.png"))

    # 畫面上的相簿不壓浮水印，只有存出去的檔案有
    shown = page.evaluate("""(() => {
      const cv = document.getElementById('album-big');
      const d = cv.getContext('2d').getImageData(cv.width - 340, cv.height - 60, 320, 42).data;
      let n = 0;
      for (let i = 0; i < d.length; i += 4) if (d[i] < 240 || d[i + 1] < 240 || d[i + 2] < 240) n++;
      return n;
    })()""")
    check(shown == 0, f"畫面上的相簿照片沒有浮水印（{shown} px）")

    with page.expect_download() as info:
        page.click("#album-save")
    photo = pathlib.Path(info.value.path()).read_bytes()
    (OUT / "photo_watermarked.png").write_bytes(photo)
    check_watermark(photo, "下載的照片")

    with page.expect_download() as info:
        page.click("#btn-share")
    card = pathlib.Path(info.value.path()).read_bytes()
    (OUT / "card_watermarked.png").write_bytes(card)
    check_watermark(card, "下載的成績卡")
    ctx.close()


def mobile_flow(p, browser, errors):
    print("iPhone 13 模擬（直式）")
    ctx = browser.new_context(**p.devices["iPhone 13"])
    ctx.add_init_script("delete Navigator.prototype.share; delete Navigator.prototype.canShare;")
    page = ctx.new_page()
    track_errors(page, errors)
    open_start(page)
    check(in_view(page, "#btn-about") and topmost(page, "#btn-about"), "手機：「關於」在畫面內、沒被蓋住")
    hit = overlaps(page, "#btn-about", ".start-card *")
    check(not hit, f"手機：「關於」不跟開始卡片其他元素重疊（{hit}）")
    page.tap("#btn-about")
    page.wait_for_selector("#modal:not([hidden])")
    page.wait_for_function("document.getAnimations().every((a) => a.playState !== 'running')")
    box = page.locator(".modal-box").bounding_box()
    check(box["x"] >= 0 and box["x"] + box["width"] <= 390 and box["y"] >= 0 and box["y"] + box["height"] <= 844,
          "手機：關於小卡完整放進螢幕")
    links = [page.locator(s).bounding_box() for s in (".about-link >> nth=0", ".about-link >> nth=1", "#modal-close")]
    check(all(b["height"] >= 40 for b in links), "手機：連結與關閉鈕好點")
    check(not boxes_overlap(links[0], links[1]), "手機：兩個連結不重疊")
    page.screenshot(path=str(OUT / "about_mobile.png"))
    page.tap(".modal-x")
    check(page.locator("#modal").is_hidden(), "手機：關閉鈕關閉關於")

    to_ending(page)
    check(page.locator(".ending-credit a").is_visible() and in_view(page, ".ending-credit a") and topmost(page, ".ending-credit a"),
          "手機：結局頁製作者那行看得到")
    hit = overlaps(page, ".ending-credit", ".ending-btns button")
    check(not hit, f"手機：製作者那行不跟按鈕重疊（{hit}）")
    page.screenshot(path=str(OUT / "ending_mobile.png"))

    # 手機存圖走長按大圖：大圖本身就是要存的檔案，也該有浮水印
    page.locator("#album-save").scroll_into_view_if_needed()
    page.tap("#album-save")
    page.wait_for_selector("#save-sheet img")
    page.wait_for_function("document.querySelector('#save-sheet img').naturalWidth > 0")
    src = page.get_attribute("#save-sheet img", "src")
    import base64
    check_watermark(base64.b64decode(src.split(",", 1)[1]), "手機長按存的照片")
    page.tap(".save-sheet-close")
    ctx.close()


def landscape_flow(p, browser, errors):
    print("iPhone 13 模擬（橫式）")
    dev = dict(p.devices["iPhone 13 landscape"])
    ctx = browser.new_context(**dev)
    page = ctx.new_page()
    track_errors(page, errors)
    open_start(page)
    check(in_view(page, "#btn-about") and topmost(page, "#btn-about"), "橫式：「關於」在畫面內、沒被蓋住")
    hit = overlaps(page, "#btn-about", ".start-card *")
    check(not hit, f"橫式：「關於」不跟開始卡片其他元素重疊（{hit}）")
    to_ending(page)
    check(in_view(page, ".ending-credit a") and topmost(page, ".ending-credit a"), "橫式：結局頁製作者那行看得到")
    hit = overlaps(page, ".ending-credit", ".ending-btns button")
    check(not hit, f"橫式：製作者那行不跟按鈕重疊（{hit}）")
    page.screenshot(path=str(OUT / "ending_landscape.png"))
    ctx.close()


def main():
    server = subprocess.Popen([sys.executable, str(ROOT / "tests" / "serve.py"), str(PORT)],
                              cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(0.7)
    errors = []
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True, args=['--disable-webgl', '--disable-webgl2', '--disable-3d-apis'])
            desktop_flow(browser, errors)
            mobile_flow(p, browser, errors)
            landscape_flow(p, browser, errors)
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
