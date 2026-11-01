# 數位登山

操控 Q 版登山客走一趟台灣山徑（登山口 → 森林 → 稜線 → 山頂 → 下山），在情境選擇中學登山安全。出發前先選山、看模擬預報、換裝打包並做裝備檢查，準備程度會影響路上的題目與風險。純靜態網站，不需要 build，也沒有外部資源。

## 執行

```bash
python3 -m http.server 8000
# 開啟 http://localhost:8000/
```

部署時把 `index.html`、`style.css`、`js/`、`data/` 放到任何靜態伺服器即可。直接用 `file://` 開啟時讀不到 JSON，會改用 `js/fallback-data.js` 的精簡題庫，並以原版模式開始。`data/mountains.json`、`data/gear.json` 讀取或驗證失敗時也一樣：顯示提示、不進準備畫面、行前風險 0。

## 操作

方向鍵／WASD 移動、點地面走過去、拖曳看周圍、E／空白鍵互動、1／2／3 回答或做小動作、M 開關音效。手機用左下搖桿與右下互動鈕。

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
- 所有點數、機率與門檻都是遊戲設計值，不是官方標準或事故率。

## 程式結構

| 檔案 | 內容 |
| --- | --- |
| `js/core.js` | 亂數、抽題、結局分級、localStorage 紀錄 |
| `js/prep-logic.js` | 預報抽樣、裝備旗標、行前風險、選題、題目修飾與敘事變體 |
| `js/prep.js` | 選山、預報、換裝打包、裝備檢查的畫面流程 |
| `js/gear-art.js` | 角色的衣物圖層、品項圖示、選山與預報插圖 |
| `js/art.js` | 角色、動物、場景物件、結局插圖 |
| `js/world.js` | 視差背景、地面、配色、風險天氣、整體渲染 |
| `js/ui.js` | HUD、事件卡片、結局與彈窗 |
| `js/audio.js` | WebAudio 合成音效 |
| `js/main.js` | 狀態、主迴圈、輸入、測試鉤子 |

## 測試

- `?seed=123` 固定預報、亂數與題序（換裝不影響題序）。抽題也會參考 localStorage 的作答紀錄，要完全重現請用乾淨的瀏覽器資料。
- `?classic=1` 跳過準備流程，直接走原版模式（不顯示載入提示）；舊有的版面與流程測試靠它。
- `window.__game`：`state`、`startGame()`、`teleportToNextEvent()`、`teleportToFinish()`、`triggerNextEvent()`、`answer(i)`（i 為畫面上的選項順序）、`correctIndex()`、`wrongIndex()`、`continue()`、`skipToEnding(['good'|'normal'|'bad'|風險值])`、`prep`（準備流程）、`logic`（`prepLogic`）、`getBank()`。`startGame()` 走原版流程。
- 煙霧測試：`python3 tests/smoke_test.py`，截圖輸出到 `screenshots/`；390x844、360x640、844x390、1440x900 的版面稽核截圖在 `screenshots/audit/`，準備流程截圖在 `screenshots/prep/`。
