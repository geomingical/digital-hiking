#!/usr/bin/env python3
"""把 js/audio.js 的每個音效用 OfflineAudioContext 離線算成 WAV，印出峰值與 RMS，方便試聽。

輸出到 research/audio_preview/<name>.wav，並串成 all_sounds.wav（有 ffmpeg 就再轉 mp3）。
"""
import array
import base64
import math
import pathlib
import shutil
import subprocess
import sys
import wave

from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "research" / "audio_preview"
PORT = 8767
URL = f"http://localhost:{PORT}/index.html"
PEAK_LIMIT_DB = -1.0
GAP = 0.6


def db(x):
    return 20 * math.log10(x) if x > 0 else float("-inf")


def write_wav(path, samples, sr):
    pcm = array.array("h", (int(max(-1.0, min(1.0, s)) * 32767) for s in samples))
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(sr)
        w.writeframes(pcm.tobytes())


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    server = subprocess.Popen([sys.executable, str(ROOT / "tests" / "serve.py"), str(PORT)],
                              cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    over = []
    combined = []
    sr = 44100
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch()
            page = browser.new_page()
            for _ in range(50):
                try:
                    page.goto(URL)
                    break
                except Exception:
                    page.wait_for_timeout(200)
            page.wait_for_function("typeof window.__renderAudioPreview === 'function'")
            names = page.evaluate("() => window.__renderAudioPreview()")
            print(f"{'sound':<10} {'peak dBFS':>10} {'RMS dBFS':>10} {'len s':>6}")
            for name in names:
                res = page.evaluate("(n) => window.__renderAudioPreview(n)", name)
                sr = res["sampleRate"]
                samples = array.array("f")
                samples.frombytes(base64.b64decode(res["data"]))
                peak = max(abs(s) for s in samples)
                rms = math.sqrt(sum(s * s for s in samples) / len(samples))
                print(f"{name:<10} {db(peak):>10.1f} {db(rms):>10.1f} {len(samples) / sr:>6.1f}")
                if db(peak) >= PEAK_LIMIT_DB:
                    over.append(name)
                write_wav(OUT / f"{name}.wav", samples, sr)
                combined.extend(samples)
                combined.extend([0.0] * int(sr * GAP))
            browser.close()
    finally:
        server.terminate()

    write_wav(OUT / "all_sounds.wav", combined, sr)
    print(f"wrote {OUT / 'all_sounds.wav'}")
    if shutil.which("ffmpeg"):
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(OUT / "all_sounds.wav"),
                        "-codec:a", "libmp3lame", "-q:a", "3", str(OUT / "all_sounds.mp3")], check=True)
        print(f"wrote {OUT / 'all_sounds.mp3'}")
    if over:
        print(f"FAIL: peak >= {PEAK_LIMIT_DB} dBFS: {', '.join(over)}")
        sys.exit(1)


if __name__ == "__main__":
    main()
