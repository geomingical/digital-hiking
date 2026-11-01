# 任務：在「數位登山」(/workspace/digital-hiking) 加入「保命觀念」必出題機制

背景：research/key_concepts.md（Codex 審查，含官方來源與 must-appear 清單、保證抽題規則、各山相容性）與 research/key_scenarios.json（10 道新增保命題，key:true）。請先完整閱讀，並閱讀現有程式（js/core.js 抽題、js/prep-logic.js 選題、js/ui.js 題卡、data/scenarios.json、tests/smoke_test.py）。

要做：
1. 將 research/key_scenarios.json 的 10 題併入 data/scenarios.json（id 不重複；驗證器需接受 key 欄位；answer 位置維持分散；執行期仍洗牌選項、風險用 orig）。再依 key_concepts.md 的「must-appear 保命題」清單，把清單中的既有題也標成保命題：用程式內對照表（id → 保命觀念名稱，如「迷路：先停、回已知路標」「求救與省電」「失溫」「高山症」「雷雨離稜線」「折返時間」「溪水不渡」「CPR」…）或直接在 JSON 加 key:true 與 keyConcept 欄位（不改原文字）。
2. 保證抽題：每趟（依所選山）依 key_concepts.md 的「保證抽題順序」至少抽 4 題保命題（至少涵蓋 4 種不同觀念；trailhead/forest/ridge/descent 各至少一個名額；高海拔山加高山症題、has_stream=true 的山才加溪洪題、雷雨日加雷雨題），其餘照原選題規則；尊重各山 stage_counts 與路線排除表；跨趟優先抽尚未見過者（首次優先 STOP 與求救）。若名額不足，不得默默破壞排除規則，記錄於 console.info。
3. 視覺標記：保命題的題卡頂部顯示醒目但可愛的「保命觀念」徽章（紅/橘色救生圈或盾牌圖示 + 觀念名稱），與一般題的 category 標籤區分；作答後的解說區加上「保命重點」一行摘要（來自該題 why 的第一句或新增 keyPoint 欄位）與來源。地圖上的事件標記（world.js eventMarker）保命題用不同顏色/圖示。結局摘要列出「本趟保命觀念」清單（已答對/需複習）。
4. 迷路題的內容必須避免過度絕對：以 key_concepts.md 的措辭為準（先 STOP；回到最後確定的路標/已知步道；來路安全可確認時優先往上回稜線/主徑；不要輕易下切未知溪谷，因溪谷易遇瀑布斷崖、收訊差、搜救困難）。
5. 更新 tests/smoke_test.py：每趟（六座山各跑多次不同 seed）都至少 4 題保命題、不同觀念≥4；has_stream=false 的山不含溪洪題；高海拔才含高山症題；保命徽章在題卡上可見（桌面 1440x900 與手機 390x844）；既有測試維持通過、無 console error。
6. 截圖到 screenshots/prep/：key-badge-desktop.png、key-badge-mobile.png（保命題題卡，作答後含保命重點）、ending-key-summary.png；用 Read 看過，修到好看、不遮擋。
7. 完成後簡述改動。不要部署，不要改 research/ 內檔案。
