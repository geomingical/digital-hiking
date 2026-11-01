#!/usr/bin/env python3
import pathlib, subprocess, time, sys
from playwright.sync_api import sync_playwright
ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "screenshots" / "final"; OUT.mkdir(exist_ok=True)
BASE = sys.argv[1] if len(sys.argv) > 1 else None
srv = None
if not BASE:
    srv = subprocess.Popen([sys.executable, "-m", "http.server", "8777", "--bind", "127.0.0.1"], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(1); BASE = "http://127.0.0.1:8777"
errs = []
OUTFITS = {
 "A-recommended": None,
 "B-cotton-sneakers": dict(hat='no_hat', base='cotton', mid='no_mid', shell='no_shell', pants='jeans', shoes='sandals', gloves='no_gloves'),
 "C-full-winter": dict(hat='beanie', base='wicking', mid='down', shell='rain_shell', pants='quick_pants', gloves='warm_gloves', shoes='boots'),
}
def run(p):
    b = p.chromium.launch()
    for tag, vp, mobile in [("d", {"width":1440,"height":900}, False), ("m", {"width":390,"height":844}, True)]:
        ctx = b.new_context(viewport=vp, device_scale_factor=2 if mobile else 1, is_mobile=mobile, has_touch=mobile)
        pg = ctx.new_page()
        pg.on("console", lambda m: errs.append(m.text) if m.type=="error" else None)
        pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.goto(f"{BASE}/index.html?seed=12"); pg.wait_for_function("window.__game && window.__game.state.prepReady"); pg.wait_for_timeout(300)
        pg.screenshot(path=str(OUT/f"{tag}-01-start.png"))
        pg.click("#btn-start"); pg.wait_for_selector("#prep-panel[data-step='mountain']"); pg.wait_for_timeout(300)
        pg.screenshot(path=str(OUT/f"{tag}-02-mountain.png"))
        chip = pg.locator(".mtn-chip[data-id='yushan']")
        if chip.is_visible(): (chip.tap() if mobile else chip.click()); pg.wait_for_timeout(300); pg.screenshot(path=str(OUT/f"{tag}-02b-mountain-picked.png"))
        pg.locator(".mtn-card[data-id='yushan'] .mtn-pick").tap() if mobile else pg.click(".mtn-card[data-id='yushan'] .mtn-pick")
        pg.check("#prep-ack"); pg.wait_for_timeout(200); pg.screenshot(path=str(OUT/f"{tag}-02c-ack.png")); pg.click("#prep-next")
        pg.click("[data-season='autumn']"); pg.wait_for_timeout(300)
        pg.screenshot(path=str(OUT/f"{tag}-03-season.png"))
        pg.click("#prep-next"); pg.wait_for_selector("#gear-preview"); pg.wait_for_timeout(400)
        pg.screenshot(path=str(OUT/f"{tag}-04-forecast-dress-default.png"))
        for name, sel in OUTFITS.items():
            if sel is None:
                pg.click("#btn-recommend")
            else:
                pg.evaluate("sel => { const P = window.__game.prep; Object.assign(P.selection, sel); P.setTab('wear'); P.refreshGear(false); }", sel)
            pg.wait_for_timeout(300)
            pg.screenshot(path=str(OUT/f"{tag}-05-dress-{name}.png"))
        pg.click("#btn-recommend"); pg.wait_for_timeout(200)
        pg.click("#prep-next"); pg.wait_for_selector("#check-list"); pg.wait_for_timeout(300)
        pg.screenshot(path=str(OUT/f"{tag}-06-gearcheck.png"))
        ctx.close()
    b.close()
with sync_playwright() as p: run(p)
if srv: srv.terminate()
print("errors:", errs)
