# 數位登山

操控 Q 版登山客走一趟台灣山徑（登山口 → 森林 → 稜線 → 山頂 → 下山），在情境選擇中學登山安全。出發前先選山、看模擬預報，從家居服開始逐項換裝打包，再做裝備檢查；準備程度會影響路上的題目、風險與角色的狀態。純靜態網站，不需要 build，也沒有外部資源。

## 執行

```bash
python3 -m http.server 8000
# 開啟 http://localhost:8000/
```

部署時把 `index.html`、`style.css`、`js/`、`data/`、`assets/` 放到任何靜態伺服器即可。直接用 `file://` 開啟時讀不到 JSON，會改用 `js/fallback-data.js` 的精簡題庫，並以原版模式開始。`data/mountains.json`、`data/gear.json` 讀取或驗證失敗時也一樣：顯示提示、不進準備畫面、行前風險 0。

## 操作

↑／W 前進、↓／S 後退、←→／AD 橫移、點地面走過去、拖曳轉鏡頭、E／空白鍵互動、1／2／3 回答、看線索或做小動作（3 是拍照）、M 開關音效。開始畫面可選男生或女生，換裝頁也能改。手機用左下搖桿與右下互動鈕。

## 畫面

支援 WebGL 的瀏覽器走即時 3D（three.js r158，放在 `js/vendor/`，不需要建置步驟）；不支援時退回原本的 2D Canvas，遊戲規則與題目相同，只是橫向移動。3D 會依實際幀率自動降低畫質；`?quality=max` 關掉自動降畫質，截圖用。

- 開場、登頂與結局有幾秒鏡頭，按鍵或點一下就跳過；減少動態時不播。
- 題目現場：`js/stage3d.js` 把部分題目演在路上（黑熊、落石、雷雨、溪水暴漲等）。有線索的題目要先看過至少兩處才能作答，答完現場會回應。線索只寫看得到的事，不改題目與答案。
- 拍照：按 3 產生相框照片，結局可下載；相簿只存在記憶體，一趟最多 6 張，相框是遊戲畫面，與任何社群平台無關。
- 風險到 100 的結局是檢討準備不足，直升機救援畫面保留，並固定提醒真的出事要立刻撥 119 或 112。

## 題庫

`data/scenarios.json`，直接置換檔案即可，格式：

```json
[{"id":"","category":"","stage":"trailhead|forest|ridge|summit|descent","title":"","situation":"","options":["","",""],"answer":0,"risk":[0,15,25],"why":"","sources":[""]}]
```

格式不符的題目會被略過（console 會有警告）。

`prep-` 開頭的 8 題只在準備流程出現，出題條件寫在 `js/prep-logic.js` 的 `TRIGGERS`。

### 保命題

`js/core.js` 的 `KEY_TABLE` 是保命題對照表（id → 觀念名稱與「保命重點」），依 `research/key_concepts.md` 的 must-appear 清單與其明列的同義替代題；既有題的 JSON 不動，`key-` 開頭的 10 題另有 `key:true`。題目也可以在 JSON 自帶 `key`、`keyConcept`、`keyPoint`。

抽題時 `reserveKeyScenarios` 先替保命題保留名額：登山口、森林、稜線、下山路各一，高海拔加高山症、`has_stream=true` 加溪洪、雷雨日加雷雨；同一觀念一趟只出一題，跨趟優先沒見過的（首次優先 STOP 與求救）。名額不足時不放寬排除規則，只記 `console.info`，並寫入 `state.selectionAudit.keyMissing`。

## 出發前準備

- `data/mountains.json`：六座山的卡片資料、各段題數、優先題、四季天氣範圍。
- `data/gear.json`：穿著與背包品項、教學文字、行前風險規則與上限。
- 題目排除清單 `ROUTE_EXCLUDE`、修飾規則 `MODIFIERS`、敘事變體 `SCENARIO_VARIANTS` 都在 `js/prep-logic.js`。變體只產生顯示副本，不改 JSON 與 `answer` 索引。
- 穿著與飲水共 9 項都要玩家自己選過（`null` 代表未決定），全部決定後才顯示行前風險與建議清單。
- 路上的淋濕、受寒與旁白由 `js/prep-logic.js` 的 `BODY_RULES` 決定，只影響畫面與文字，不改風險點數。
- 有 3D 時，選山卡與房間由 `js/diorama3d.js` 即時算出；`assets/art/` 的 Codex 示意插畫只給 2D 備援用；例外是 `scree-slope.jpg`，它是 3D 邊坡的碎石貼圖，載不到時退回純色。兩者都不代表真實地形。
- 所有點數、機率與門檻都是遊戲設計值，不是官方標準或事故率。

## 程式結構

| 檔案 | 內容 |
| --- | --- |
| `js/core.js` | 亂數、抽題、結局分級、localStorage 紀錄 |
| `js/prep-logic.js` | 預報抽樣、裝備旗標、行前風險、選題、題目修飾與敘事變體 |
| `js/prep.js` | 選山、預報、換裝打包、裝備檢查的畫面流程 |
| `js/gear-art.js` | 角色的衣物圖層、品項圖示、選山與預報插圖 |
| `js/hero3d.js` | 3D 角色：依穿著組裝、姿勢、淋濕與受寒效果 |
| `js/world3d.js` | 3D 場景：山路、地形、天氣、鏡頭、結局畫面 |
| `js/biomes3d.js` | 六座山與四季的造景資料 |
| `js/diorama3d.js` | 選山卡與房間的 3D 小模型 |
| `js/stage3d.js` | 題目現場、線索與答題後的回應 |
| `js/photo.js` | 拍照相框、相簿與下載 |
| `js/art.js` | 2D 角色、動物、場景物件、結局插圖 |
| `js/world.js` | 2D 視差背景、地面、配色、風險天氣、整體渲染 |
| `js/vendor/` | three.js 函式庫與授權 |
| `js/ui.js` | HUD、事件卡片、結局與彈窗 |
| `js/audio.js` | WebAudio 合成音效 |
| `js/main.js` | 狀態、主迴圈、輸入、測試鉤子 |

## 測試

- `?seed=123` 固定預報、亂數與題序（換裝不影響題序）。抽題也會參考 localStorage 的作答紀錄，要完全重現請用乾淨的瀏覽器資料。
- `?classic=1` 跳過準備流程，直接走原版模式（不顯示載入提示）；舊有的版面與流程測試靠它。
- `window.__game`（只在 `localhost`／`127.0.0.1`／`file://` 或網址帶 `?debug=1` 時掛載，正式站不會有；`window.__renderAudioPreview` 同樣受此條件限制）：`state`、`startGame()`、`teleportToNextEvent()`、`teleportToFinish()`、`triggerNextEvent()`、`answer(i)`（i 為畫面上的選項順序）、`correctIndex()`、`wrongIndex()`、`continue()`、`skipToEnding(['good'|'normal'|'bad'|風險值])`、`prep`（準備流程）、`logic`（`prepLogic`）、`getBank()`。`startGame()` 走原版流程。
- 流程測試：`python3 tests/flow_test.py`，從玩家操作確認逐項換裝的放行規則，以及 3D 畫面的移動、點地面、開題與再玩一次。
- 邏輯回歸：`node tests/review_regression.cjs`，只驗邏輯，沒有真的 WebGL 與版面。
- 測試伺服器：`tests/serve.py`，內建 `http.server` 連續開頁會偶爾斷線。
- 煙霧測試：`python3 tests/smoke_test.py`，關閉 WebGL 跑，所以驗的是 2D 備援畫面；截圖輸出到 `screenshots/`；390x844、360x640、844x390、1440x900 的版面稽核截圖在 `screenshots/audit/`，準備流程截圖在 `screenshots/prep/`。
