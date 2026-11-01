# 任務：為「數位登山」(/workspace/digital-hiking) 實作「出發前準備階段」

先完整閱讀 research/gear_spec.md（規格）以及 research/gear_data_draft/ 下的 mountains.json、gear.json、new_scenarios.json、scenario_triggers.json（資料草稿），再讀現有程式（index.html、style.css、js/*.js、data/scenarios.json、README.md、tests/smoke_test.py）。UI 全繁體中文，遊戲畫面不得提到任何開發工具／AI／模型名稱。純靜態、無外部資源、無 build。

## 使用者要求（必須達成）
1. 選山畫面：6 座山（七星山、合歡山主峰、加里山、玉山主峰、雪山主峰、南湖大山），卡片顯示海拔、難度星等、天數、步道型態、典型氣候、許可需求（保守文字）。
2. 天氣/氣溫簡報：先選季節（或「隨機」），依各山各季範圍隨機產生預報：登山口與山頂氣溫、降雨機率、風速/陣風、特殊天氣（午後雷陣雨、鋒面、颱風外圍、濃霧、結冰）。顯示「遊戲模擬預報，非即時資料；預報可能改變」。
3. 換裝/打包畫面：Q 版角色依每個選擇即時更新外觀（canvas 繪製，延續現有 js/art.js 的 drawHiker 畫風）。穿著欄位：帽子（遮陽帽/毛帽/不戴）、內層（排汗衣/棉T）、中層（刷毛/羽絨/不穿）、外層（防水透氣外套/輕便雨衣/防風外套/不穿）、褲子、鞋子（登山鞋/運動鞋/拖鞋）、手套、襪子；背包可複選（頭燈、離線地圖/GPS、紙圖指北針、急救包、緊急保暖毯、行動電源、行動糧、登山杖、防曬組、哨子、雨具組、備用乾衣、露宿遮蔽、衛星/備用通訊、水處理…依 gear.json）與飲水量。以 gear.json 的 slots/items 為準。每個選項有簡短教學說明；選擇會依 山＋預報 計算「行前風險」，即時顯示並說明原因（上限 45，規則見 spec 附表 D / gear.json）。提供「套用本趟建議清單」按鈕。手機要好用（觸控區 ≥44px，單欄分頁：穿著／背包／行前）。
4. 「裝備檢查總結」畫面：行前風險總分、五組分數、逐項「符合／建議調整」與原因（教學，不嘲諷）、可返回修改、確認出發。確認出發才把行前風險寫入 state.risk（不得重複累加）。
5. 裝備影響後續情境（依 spec 第 5 節）：實作 gear flags/天氣 flags，對既有題目 id 套用 modifier（缺頭燈→`headlamp-before-dark`、`night-bivouac` 錯誤選項風險×1.5 等；缺雨具＋降雨→雨/失溫題；缺水→中暑/脫水題；缺導航→迷路題；拖鞋→扭傷題等）。公式：finalRisk = min(40, max(0, round(base*mult+add)))，僅套在錯誤選項且 base>0；用選項的 orig 索引（選項在執行期仍須洗牌）。作答後在回饋區顯示「原風險X → 本次Y，因為你沒帶…」（正向也要顯示，如「頭燈備援讓這題風險少2分」）。同時實作敘事變體（至少 `headlamp-before-dark`、`first-aid-cut`、`night-bivouac`、`rain-gear-early`、`hypothermia-blanket`、`fog-junction`、`ankle-sprain`）：缺裝備時顯示副本的情境文字／安全選項文字，不得提到玩家沒帶的東西，也不改 answer 索引、不覆寫原 JSON。
6. 所選山決定該趟題目：依 spec 第 2 節「路線與題庫相容」排除不適用題（例如七星山不出高山症題）、依各山 stage_counts 選題、優先清單、天氣 only-if（雷雨題限雷雨日…）；加入 new_scenarios.json 的 8 題（觸發條件依 scenario_triggers.json）到題庫。高度表 `altitudeAt` 依所選山（登山口→峰頂）顯示，不再是固定 3420m。場景佈景可沿用現有，但山名、海拔、天氣（霧、雨、風、冷色調）要在畫面/HUD 上反映；風險高的既有視覺保留。
7. 結局整合：結局摘要加入山岳/季節/行前風險/累積風險，與「行前準備」和「裝備影響回顧」可展開卡（spec 第 7 節）。對帳：preparation.risk + Σ actualAdded = state.risk。

## 範圍調整（與規格不同處，以此為準，為了控制複雜度）
- 行政核對簡化：選山卡上顯示許可/住宿需求，進入準備頁前只需一個「我已閱讀本路線許可與住宿需求（模擬）」勾選；不做五項核對。
- 颱風外圍／預報陣風≥18 m/s／（結冰且沒訓練）：顯示「建議延期」卡，提供「換山」「換季節」「重新抽預報」，不進入登山；不計壞結局。
- 重量只顯示，不做硬上限。不做保存/重播的 historySnapshot；保留 ?seed= 重現（seed 影響預報與題序），但不需要 localStorage 版本遷移，只要不破壞既有紀錄。
- 資料檔放 data/mountains.json、data/gear.json；新增 8 題可直接併入 data/scenarios.json（以 only_if 於程式內用 id 對照表處理，驗證器需接受），scenarios.json 原 51 題文字不要動。若 mountains/gear 載入失敗（或 file:// 開啟），顯示友善提示並以「原版模式」直接開始（行前風險 0，不顯示準備畫面）。js/fallback-data.js 維持原用途。
- 不要引入框架；新增檔案例如 js/prep.js、js/gear-art.js 可自由拆分，並在 index.html 載入。保持現有程式風格與無 console error。
- 開始畫面流程：開始 → 選山 → 季節與預報簡報 → 換裝打包 → 裝備檢查 → 出發；每步可返回；手機一次只顯示一張主要卡片。返回不重抽天氣。
- 研究資料中的「典型 1–1 天」這類格式請改寫為「1 天」。事實保守，沿用草稿來源。

## 驗證與截圖（必做）
- 更新 tests/smoke_test.py：新增準備階段流程測試（選山→預報→換裝→檢查→出發→走到第一題→作答→風險變化；缺頭燈時 `headlamp-before-dark` 風險加成顯示；最差配置行前風險 ≤45；全建議清單=0；返回不改預報；各山選題不跨 stage、不含被排除題；角色外觀在每個選項變化（canvas 像素不同）；颱風延期卡；載入失敗後原版模式；1440x900 與 390x844 無 console error）。既有測試須維持通過。
- 用 playwright（box 上已安裝）截圖，存到 screenshots/prep/：01-mountain-select(.png desktop)、02-forecast、03-dress-up、04-gear-check、05-scenario-gear-effect（缺頭燈時 headlamp-before-dark 作答後的風險說明畫面）、以及 mobile-01~04（390x844）。每張都用 Read 看過，發現醜、重疊、被截斷就修到好看為止（Q 版、溫暖、與既有畫風一致）。
- 完成後簡述：改了哪些檔案、新增哪些功能、與規格不同處。不要部署，不要動 research/ 之外以外的備份。
