#!/usr/bin/env python3
"""相簿與成績卡的存圖：桌機要真的下載 PNG，手機（沒有 navigator.share）要出現長按存圖的大圖。"""
import pathlib
import struct
import subprocess
import sys
import time

from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
FINAL = ROOT / "screenshots" / "final"
PORT = 8766
URL = f"http://localhost:{PORT}/index.html"
failures = []


def check(cond, label):
    print(("  ok  " if cond else "  FAIL") + " " + label)
    if not cond:
        failures.append(label)


def track_errors(page, errors):
    page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
    page.on("pageerror", lambda e: errors.append(str(e)))


def to_album(page):
    """走捷徑到結局頁：skipToEnding 會補一張這趟的照片，再按一下跳過結局鏡頭。"""
    page.goto(URL + "?seed=123&classic=1")
    page.wait_for_function("window.__game && window.__game.state.bankReady")
    page.wait_for_timeout(250)
    page.click("#btn-start")
    page.wait_for_function("window.__game.state.screen === 'play'")
    page.evaluate("window.__game.skipToEnding('normal')")
    page.wait_for_selector("#ending-screen:not([hidden])")
    if page.evaluate("document.getElementById('app').classList.contains('cine')"):
        page.keyboard.press("Enter")
    # 測試關掉 WebGL，3D 拍不到照片時改用 2D 畫面排一張同樣相框的照片
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


def png_info(data):
    if len(data) < 33 or data[:8] != b"\x89PNG\r\n\x1a\n" or data[12:16] != b"IHDR":
        return None
    return struct.unpack(">II", data[16:24])


def desktop_flow(browser, errors):
    print("桌機 Chromium：直接下載")
    ctx = browser.new_context(viewport={"width": 1280, "height": 720}, accept_downloads=True)
    page = ctx.new_page()
    track_errors(page, errors)
    to_album(page)
    check(page.evaluate("window.__game.state.photos.length") >= 1, "結局頁相簿至少有一張照片")
    check(not page.evaluate("DH.saveImage.isMobile()"), "桌機不會被當成手機")
    with page.expect_download() as info:
        page.click("#album-save")
    dl = info.value
    path = dl.path()
    data = pathlib.Path(path).read_bytes() if path else b""
    size = png_info(data)
    check(dl.suggested_filename.endswith(".png") and "數位登山" in dl.suggested_filename, f"檔名正確（{dl.suggested_filename}）")
    check(size is not None and len(data) > 10000, f"下載的是有效、非空的 PNG（{len(data)} bytes）")
    check(size == (1080, 124 + 1080 + 226), f"圖片尺寸符合相框（{size}）")
    check(page.locator("#save-sheet").count() == 0, "桌機不會跳出長按遮罩")
    check(page.evaluate("document.querySelectorAll('a[download]').length") == 0, "下載用的暫時連結有清掉")

    with page.expect_download() as info:
        page.click("#btn-share")
    card = info.value
    card_data = pathlib.Path(card.path()).read_bytes()
    check(png_info(card_data) is not None and card.suggested_filename == "數位登山成績卡.png", "成績卡也能下載成 PNG")

    # 被跨網域圖片污染的畫布：toBlob 會丟 SecurityError，要變成繁中提示而不是沒反應
    page.evaluate(f"""new Promise((resolve) => {{
      const img = new Image();
      img.onload = () => {{
        const cv = document.createElement('canvas');
        cv.width = cv.height = 64;
        cv.getContext('2d').drawImage(img, 0, 0, 64, 64);
        const info = window.__game.state.photos[0].info;
        DH.photo.showAlbum([{{ canvas: cv, info }}]);
        resolve();
      }};
      img.src = 'http://127.0.0.1:{PORT}/assets/' + {repr(first_asset_image())};
    }})""")
    page.click("#album-save")
    page.wait_for_selector(".toast")
    toast = page.inner_text(".toast")
    check("外部素材" in toast and "存不下來" in toast, f"畫布被污染時顯示繁中錯誤（{toast}）")
    ctx.close()


def first_asset_image():
    for p in sorted((ROOT / "assets").rglob("*")):
        if p.suffix.lower() in (".png", ".jpg", ".jpeg", ".webp"):
            return p.relative_to(ROOT / "assets").as_posix()
    raise RuntimeError("assets 裡找不到圖片")


def mobile_flow(p, browser, errors):
    print("iPhone 13 模擬（沒有 navigator.share）：長按存圖")
    ctx = browser.new_context(**p.devices["iPhone 13"])
    ctx.add_init_script("delete Navigator.prototype.share; delete Navigator.prototype.canShare;")
    page = ctx.new_page()
    track_errors(page, errors)
    downloads = []
    page.on("download", lambda d: downloads.append(d))
    to_album(page)
    check(page.evaluate("typeof navigator.share") == "undefined", "模擬環境沒有 navigator.share")
    check(page.evaluate("DH.saveImage.isMobile()"), "iPhone 被認成手機")
    page.locator("#album-save").scroll_into_view_if_needed()
    page.click("#album-save")
    page.wait_for_selector("#save-sheet", state="visible")
    page.wait_for_function("document.querySelector('#save-sheet img').complete && document.querySelector('#save-sheet img').naturalWidth > 0")
    check("長按圖片即可儲存" in page.inner_text("#save-sheet"), "遮罩提示長按圖片即可儲存")
    src = page.get_attribute("#save-sheet img", "src") or ""
    check(src.startswith("data:image/png"), "大圖用 data URL，WebView 也能長按存")
    check(page.evaluate("document.querySelector('#save-sheet img').naturalWidth") == 1080, "遮罩裡是完整解析度的照片")
    box = page.locator("#save-sheet img").bounding_box()
    check(box and box["width"] <= 390 and box["y"] >= 0 and box["y"] + box["height"] <= 844, "大圖完整放進手機螢幕")
    check(page.locator(".save-sheet-close").is_visible(), "有關閉按鈕")
    page.wait_for_function("document.getAnimations().every((a) => a.playState !== 'running')")
    FINAL.mkdir(parents=True, exist_ok=True)
    page.screenshot(path=str(FINAL / "download_fix_mobile.png"))
    page.click(".save-sheet-close")
    check(page.locator("#save-sheet").count() == 0, "按關閉收起遮罩")
    check(not downloads, "手機不走 a.download")

    # LINE 內建瀏覽器的 UA 也要認得
    check(page.evaluate("""(() => {
      const ua = Object.getOwnPropertyDescriptor(Navigator.prototype, 'userAgent');
      Object.defineProperty(Navigator.prototype, 'userAgent', { configurable: true, get: () => 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Line/14.1.0' });
      const r = DH.saveImage.isMobile();
      Object.defineProperty(Navigator.prototype, 'userAgent', ua);
      return r;
    })()"""), "LINE 內建瀏覽器也走手機流程")
    ctx.close()


def share_flow(p, browser, errors):
    print("手機有 navigator.share：走分享面板，取消不算錯")
    ctx = browser.new_context(**p.devices["iPhone 13"])
    ctx.add_init_script("""
      window.__shared = [];
      Navigator.prototype.canShare = function (d) { return !!(d && d.files && d.files.length); };
      Navigator.prototype.share = function (d) {
        window.__shared.push(d.files[0].name + ':' + d.files[0].size);
        return window.__cancelShare ? Promise.reject(new DOMException('cancel', 'AbortError')) : Promise.resolve();
      };
    """)
    page = ctx.new_page()
    track_errors(page, errors)
    to_album(page)
    page.click("#album-save")
    page.wait_for_function("window.__shared.length === 1")
    shared = page.evaluate("window.__shared[0]")
    name, size = shared.rsplit(":", 1)
    check(name.endswith(".png") and int(size) > 10000, f"分享面板拿到 PNG 檔（{shared}）")
    check(page.locator("#save-sheet").count() == 0, "能分享就不另外開遮罩")
    page.evaluate("window.__cancelShare = true")
    page.click("#album-save")
    page.wait_for_function("window.__shared.length === 2")
    page.wait_for_timeout(300)
    check(page.locator(".toast").count() == 0, "使用者取消分享不顯示錯誤")
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
            share_flow(p, browser, errors)
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
