# 數位登山：出發前準備階段規格

版本 1.0｜查證日 2026-11-01｜語系 zh-TW｜適用純靜態網頁。本文為待實作規格，不表示遊戲已有這些功能。

## 目錄

1. [設計目標與現況](#1-設計目標與現況)
2. [流程與山岳選擇](#2-流程與山岳選擇)
3. [天氣簡報與隨機算法](#3-天氣簡報與隨機算法)
4. [換裝、打包與裝備檢查](#4-換裝打包與裝備檢查)
5. [旗標與情境掛鉤](#5-旗標與情境掛鉤)
6. [資料結構與接入方式](#6-資料結構與接入方式)
7. [結局整合與驗收](#7-結局整合與驗收)
8. [附表 A：六座山岳卡片](#附表-a六座山岳卡片)
9. [附表 B：各山各季天氣候選範圍](#附表-b各山各季天氣候選範圍)
10. [附表 C：每項裝備教學與 Q 版繪製](#附表-c每項裝備教學與-q-版繪製)
11. [附表 D：行前風險規則](#附表-d行前風險規則)
12. [附表 E：新增情境草稿（8題）](#附表-e新增情境草稿8題)
13. [查證來源與不確定之處](#查證來源與不確定之處)

## 1. 設計目標與現況

玩家先了解路線、讀預報、換裝打包，再檢查準備。把「看天氣選裝備、留撤退餘裕」變成可反覆練習的決策。裝備無法抵消高山症、雷擊、崩塌與錯誤判斷。風險點數是教學遊戲量表，不是事故機率，也不能用來判定真實出發是否安全。

已讀取 `/workspace/digital-hiking/README.md`、`js/core.js` 及 `data/scenarios.json` 的全部 id、stage、category，並檢查下列掛鉤題的情境文字與選項。現況如下：

|項目|現況與接入限制|
|---|---|
|題庫|51題，JSON陣列；trailhead 11、forest 12、ridge 11、summit 6、descent 11。|
|題目欄位|id、category、stage、title、situation、options（三個字串）、answer（0–2）、risk（三個非負數）、why、sources；部分含group。|
|抽題|`pickScenarios(bank, rng, history)` 每趟10–12題；先依未看過、看過未答對、答對過排序，各stage補足配額。|
|事件與選項|`buildEvents` 依stage排位置並洗選項，保留 `orig`。掛鉤必須用原始索引，不能用畫面選項順序。|
|場景|五段共7400邏輯單位。現有 `altitudeAt()` 固定1850至3420公尺，不能直接當六座山的真實高度。|
|結局|`gradeFor` 用嚴格小於：0–19 legend、20–49 safe、50–79 close、80–99 narrow、100以上rescue。|
|儲存與重現|`digital-hiking.v1`；`?seed=` 仍受作答歷史影響。新增狀態須有版本與歷史快照。|
|資源限制|HTTP讀JSON；file協定現有精簡題庫備援。新資料讀取失敗需有明確備援模式。|

本次僅在 `research/` 提供規格與草稿，不修改遊戲原檔。附表文字與資料由 `gear_data_draft/build_drafts.py` 產生。

## 2. 流程與山岳選擇

`選山 → 選季節 → 天氣簡報 → 換裝與打包 → 裝備檢查 → 確認出發 → 原五段遊戲 → 結局回顧`。

手機每步只顯示一張主要卡片，保留「上一步」。底部顯示「第2步／共5步」。換山或換季節會重建簡報並重算準備，先保留玩家選裝以便比較。返回修改裝備不得重抽天氣；「新的一趟」才增加 tripIndex。出發前不寫入已玩次數，確認出發才 `recordStart()` 一次。

山岳列表依遊戲綜合負擔由易到難排列為七星山、合歡主峰、加里山、玉山主峰、雪山主峰、南湖大山。星等為本遊戲的相對排序，綜合步程、負重、暴露、撤退與高度，不等同官方步道分級。加里山比合歡主峰走得久，合歡主峰的高山症風險反而較高。雪山與玉山同為四星，前後順序不表示所有季節都一樣難。

六張完整卡片見附表 A。典型天數含步行安排，不含交通與額外高度適應；雪山採2–3天、南湖4–5天的規劃範圍，不作為一般新手可完成的保證。

### 路線與題庫相容

保留五段語意及7400邏輯長度，改以各山 `stage_counts` 指定7、7、10、11、12、13題。新抽題器讀配額，不能沿用現有固定10–12題限制。森林段可在合歡改畫為「林線邊緣／登山徑」，但需排除明寫林內活動的題，不把主峰步道畫成長距離黑森林。

先以路線適用性篩題，再套天氣 only-if，最後按stage選題。同一stage先抽適用的priority_ids，剩餘按原freshness及種子洗牌補足，不重複。優先清單是候選，不保證全出；例如頂峰只配1題時，不同時塞入兩題。配額不足可讓該段少題並記錄原因，不能從不同stage或不適用地形硬補。

|路線|必須排除或限制的既有ID|
|---|---|
|七星山、加里山|排除 `altitude-symptoms`、`ams-turnaround`、`severe-altitude`，不把典型高海拔症狀硬套在郊山。|
|合歡主峰|排除 `lost-stop`、`phone-power`、`rain-gear-early`、`first-aid-cut`、`hypothermia-blanket` 等明寫林間的forest題，以及兩題黑熊題；forest配額以適用的補給、團隊或新題補。|
|七星山、合歡、玉山主峰、雪山主東線|排除 `flash-flood`、`unsafe-crossing`，所選標準線不安排必須涉溪。加里山也僅在實際選線含相關溪流路段時啟用，不能強渡。|
|七星山、合歡|排除 `black-bear-encounter`、`black-bear-distance`；不製造這些遊憩區常見黑熊的印象。|
|單日線|排除 `hut-camp-planning`；`night-bivouac` 仍可作意外延誤情境。|
|所有線|`thunder-ridge`、`afternoon-thunder` 限實現雷雨；`fog-junction` 限霧；`ridge-gust` 限強風；`falling-rock` 限路線有碎石／落石地形。其餘題的情境自帶局部變化，可加「局部天氣變化」標籤。|

太短路線不因此免帶頭燈。多天路線在forest與ridge段加日次標籤，不重播五段、也不把多天當成實際步行時間模擬。優先清單和數量是教學設計。選題稽核需輸出排除原因。

七星山小油坑起登、合歡主峰入口、雪山登山口、南湖勝光或思源等入口會隨選線不同。資料的trailhead_m只是遊戲基準，UI顯示「約」並註明路線，不能當導航座標。`altitudeAt` 後續應讀山岳高度折線，峰頂落在summit段；不再顯示既有3420公尺為所有山頂。

### 出發前行政確認

另有零重量勾選列「查官方路況」「適用許可核准」「過夜床位或營地核准」「留守計畫」「高度適應與折返時間」。未完成不靠加幾分放行，維持在準備頁。無申請需求者顯示「此路線一般免申請，已查公告」，不能一律要求入山證。

此為模擬核對，不真的申辦或核驗文件。按鈕寫「我已完成本次模擬核對」。保險獨立顯示保障提醒，無保險不加人身事故風險、不給能力加成；法規或活動另有投保要求時納入行政核對。

## 3. 天氣簡報與隨機算法

附表 B 和 `mountains.json` 列出六山四季的溫度、降雨及風速候選範圍。所有機率與數值範圍均是遊戲設計值，未用氣象長期資料校準。官方只支持高海拔冷、北部季風濕冷、山區雷雨與預報不確定等方向。氣溫每升高100公尺約降0.6°C是粗估，可能受逆溫、日照、坡向及天氣系統改變。[玉山高山生理](https://www.ysnp.gov.tw/StaticPage/MountainSickness)

四季對應春3–5月、夏6–8月、秋9–11月、冬12–2月。玩家可選，或以種子等機率抽季節。季節月份只是遊戲分組；颱風不只會在夏秋，冬季抽中率設0只是基礎版簡化，不能寫成冬天不會有颱風。

### 簡報顯示

> 雪山主峰｜秋季｜遊戲模擬預報，非即時資料  
> 登山口約2,140公尺：4～19°C  
> 山頂約3,886公尺：較低溫，依本趟抽樣顯示  
> 本趟降雨機率：40%｜山頂風速：8 m/s（風較強）  
> 提醒：午後可能起霧；預留乾衣、保暖與照明。  
> 預報可能改變。出發前再查氣象署及管理機關公告，途中依實況調整。

實作時卡片範圍以本趟產生的 `forecast` 取代候選全集。顯示「登山口溫度」「山頂溫度」「冷風與濕冷提醒」三者，不能把平地預報直接貼到山頂。降雨機率不是下雨時間占比，也不是保證走幾成路會淋雨。

風速用m/s為主，不冒稱蒲福風級：<3「風較弱」、3至<8「風較明顯」、8至<14「強風情境」、≥14「很強，調整行程」。這些是遊戲標籤，非官方停走門檻。另顯示陣風估值，任一旗標達到保守中止條件就建議延期。實際是否站得穩比數字更重要。

體感顯示「風會加速散熱」「淋濕後更冷」「曝曬悶熱」，不杜撰通用體感溫度公式，也不宣稱穿對衣服可增加幾度。濕冷失溫可能發生在氣溫高於0°C的環境。[氣象署對濕度、風與體感的說明](https://climate.cwa.gov.tw/HighTemperature)

### 種子與關聯抽樣

`makeRng()` 可沿用。以32位FNV-1a雜湊字串 `seed|mountainId|season|tripIndex|stream`，stream分 `forecast`、`actual`、`events`、`options`，避免換一件衣服改變後面題目。完整重播還需保存historySnapshot及資料版本。

```text
forecastRng = makeRng(hash32(seed, mountainId, season, tripIndex, "forecast"))
actualRng = makeRng(hash32(seed, mountainId, season, tripIndex, "actual"))
p = mountain.forecast[season]
low = uniform(p.trailhead_temp_c[0], p.trailhead_temp_c[1] - 4)
high = min(p.trailhead_temp_c[1], low + uniform(4, 8))
lapse = (summit_m - trailhead_m) * 0.006
jitter = uniform(-2, 2)  // 共用於該山頂時段的低高值
forecast.summit = [low - lapse + jitter, high - lapse + jitter]
forecast.trailhead = [low, high]
forecast.rain_probability = roundTo5(uniform(p.rain_probability_pct))
forecast.wind_ms = uniform(p.wind_ms)
for event in [thunder, front, typhoon, fog, ice, gust]:
    forecast.hazards[event] = bernoulli(p.hazard_probability[event])
forecast.ice = forecast.hazards.ice AND min(forecast.summit) <= 2
               AND (forecast.hazards.front OR forecast.hazards.fog OR season == winter)
if forecast.hazards.front: rain_probability = max(rain_probability, 70)
if forecast.hazards.thunder: rain_probability = max(rain_probability, 70)
if forecast.hazards.typhoon: rain_probability = max(rain_probability, 80)
forecast.gust_ms = forecast.wind_ms + (hazards.gust ? uniform(4,8) : 0)
if hazards.typhoon: forecast.gust_ms = max(forecast.gust_ms, 18)
clamp temperatures to [-25,38]; clamp winds to [0,30]

// 實況只抽一次，出發前隱藏，仍在可合理預期的誤差帶
actual.temp_error = actualRng.uniform(-3,3)
actual.temperatures = clamp(forecast.temperatures + temp_error, -25,38)
actual.rain = actualRng.next() < forecast.rain_probability / 100
actual.thunder = forecast.hazards.thunder  // 不給毫無提醒的天外雷擊
actual.rain = actual.rain OR actual.thunder
actual.fog = forecast.hazards.fog
actual.ice = forecast.ice  // 新版可做沿途未預期結冰的撤退題
actual.gust_ms = clamp(forecast.gust_ms + actualRng.uniform(-2,2), 0,30)
actual.strong_wind = actual.gust_ms >= 10 OR forecast.hazards.gust
```

`uniform([lo,hi])` 為閉區間近似均勻取樣；數字保留到顯示時才四捨五入。特殊事件抽中率是候選率，受條件篩選後實際發生率較低，不能當作山區統計。鋒面與雷雨會提高同一個降雨機率，避免晴天機率很高卻畫整天暴雨。雷雨只在午後ridge或summit段實現；鋒面、濃霧可在多段出現。

行前評分使用 `briefFlags`：wet＝降雨機率≥40%或有鋒面／雷雨／颱風提示；cold＝預報山頂最低≤10°C或(wet且≤15°C)；strong_wind＝預報陣風≥10 m/s；uv_high＝有開闊坡面且為春夏，或任何季節高海拔線。這些全是遊戲選裝門檻。實況修飾使用actualFlags，wet＝實現降雨，cold依當段實現溫度套相同條件，ice等照實況。不要回頭改動已結算的行前分數。

颱風外圍情境、官方封閉、預期步道結冰而無雪地訓練、預報陣風≥18 m/s，皆進入「延期／換路線」卡，不進一般登頂流程。選擇延期給完成行前教育的回饋，不記壞結局或扣徽章。初心者版不提供靠裝備解鎖雪地硬闖。這個18 m/s是保守遊戲中止值，不能作為實際上山的安全界線。仍可透過8題新增題中的冰面情境教學撤退。

## 4. 換裝、打包與裝備檢查

### 畫面與操作

上方常駐天氣三行摘要，中間Q版角色，下方「穿著／背包／行前」分頁。選項最小觸控區44×44 CSS px，文字放在圖示旁，不只靠顏色表達對錯。內層、外層等是單選；背包可複選；飲水必選1、2或3公升以上。標籤用「公升」，不使用日文「日帰」。

附表 C 完整列出所有穿著、背包品項的簡短教學、重量與視覺。預設穿排汗衣、快乾褲、登山鞋、排汗襪，其餘讓玩家選，仍可一鍵套用「本趟建議清單」。套用後每個品項可修改，不自動算答對。

第一版重量只顯示，不做硬容量上限或自動扣除安全物品。水每公升以約1公斤計；3公升以上此版以3公斤估，UI可註記「更多另計」。電話與基本防水內袋為共同預備品，不在可選清單重算重量。重量不完整包含背包、食物品牌與隊伍公裝，標「可選物估重」而非完整負重。8公斤的新題觸發是教學設計，不是每人通用的負重上限。

多天路線另確認睡袋、睡墊、餐食／炊煮與核准宿營模式。`overnight_kit` 是簡化組合，不保證2公斤足夠；營地須另確認帳篷、公裝與水處理，沒有就不通過行政核對。不能因選了排雲床位就推定餐食、睡袋租借已完成。

### 十大必備的功能檢核

|功能|本版對應|卡片提醒|
|---|---|---|
|導航|離線地圖與GPS，或紙圖加指北針|學會使用，建議電子與紙本互備。|
|防曬|遮陽帽、防曬乳、抗UV眼鏡|不以單戴帽子宣稱防曬完整。|
|保暖|刷毛或羽絨、毛帽手套、備用乾衣|可穿在身上，也可防水收在包內。|
|照明|頭燈與備用電池|短程也可能延誤。|
|急救|急救包及操作能力|個人藥品另確認。|
|用火工具|防水火種|須守禁火規定，禁止以生火當必選安全答案。|
|修補工具|膠帶及簡易修補工具|不能保證壞鞋可繼續走。|
|額外食物|行動糧加延誤備糧|不只估到登頂。|
|水|攜水、可用水源及處理計畫|清澈不代表可生飲。|
|緊急遮蔽|露宿袋、隔地墊、雨具及緊急毯|緊急毯不能取代所有遮蔽與保暖。|

十大必備是十類功能，並非固定十件物品。與既有 `ten-essentials` 內容一致。清單會顯示「已備／部分／未備」；用火、修補缺少先給教學提醒，第一版不另加風險，以免打包頁變成每少一物就受罰。[玉山裝備參考](https://www.ysnp.gov.tw/StaticPage/Equipment)

### 飲水規劃

七星山、合歡起點建議攜行1–2公升；加里山及三條長程高山線起點2–3公升。這是遊戲準備起點，不是全天足量承諾。炎熱曝曬、長時間活動、個人流汗多或水源不可靠時要再增加，超過此版3公升就選「補充計畫已確認」並調整行程。多天行程不能只帶3公升走完整趟，也不能假定山屋一定供水。

遊戲 `water_target_l = min(3, mountain.water_carry_l[0] + (briefFlags.hot ? 1 : 0))`；hot＝登山口預報最高≥25°C。低於目標設water_low；高於不給額外安全保證。正式版若加消耗，須另做時間與補水系統；本版water_level只代表選擇的攜行級別，不隨每題憑空扣水。補水安排不成立時改行程，不能用分數鼓勵忍渴或過量喝水。

### 風險點數與結算

每個穿著選項與背包品項的教學見附表 C，完整「條件→點數」見附表 D。未列加分者是0分，不代表無用途；如哨子、衛星通訊、登山杖主要在後續題生效，保險只做保障檢核。

```text
raw[group] = sum(points of each matching preparation_rule in that group)
preparationRisk = min(45, sum(min(raw[group], group_caps[group])))
```

群組上限為衣著15、腳部6、導航照明10、補給8、緊急備援6。每條rule最多結算一次。雨衣與外套重複具備不疊加獎勵；棉衣、牛仔褲等不同問題仍會分列，該組封頂後顯示「本組已達上限」。最差的濕冷高山配置可達45，暖乾郊山可能較低，不強行湊45。帶對所有評分功能可為0；0不是登山無風險。

例：秋季雪山預報wet、cold、uv_high，玩家棉T、無中外層、牛仔褲、拖鞋、無襪、背包空、1公升水。衣著原始18分封頂15；腳部7封頂6；無頭燈5＋無導航5＝10；水4＋無糧2＋無防曬2＝8；無急救2＋無毯2＋無乾衣1＋無遮蔽1＝6；總45。補齊本趟建議可降到0。換裝前後的差異即時更新，不在過場重加。

### Q版角色合成

附表 C 的所有穿著選項都有固定顏色和形狀。採同一骨架，頭部中心(0,-28)、軀幹(0,-8)、手掌(±12,-7)、腿(±5,10)、鞋(±6,20)，單位為角色局部座標；隨角色總scale縮放。兩腿與手臂沿現有步行角度旋轉。

繪製順序為後方背包與睡墊 → 腿與襪 → 鞋 → 內層 → 中層 → 外層 → 手臂及手套 → 頭髮與帽 → 頭燈 → 前方登山杖。中層遮住內層但領口仍露色；外層只遮軀幹和上臂，不遮手掌；雨衣A字下緣到大腿，透明度0.7，不蓋住鞋與落腳點。毛帽與遮陽帽互斥，頭燈位於帽子前方，無帽則戴在額頭。

全裝備仍畫同一尺寸背包，不能因多選出現無限堆疊。角色上僅畫頭燈、登山杖、眼鏡、哨子、水瓶、背包套、底部睡袋捲、上緣睡墊捲；其他物品用背包清單小圖示表示。備用帽、手套與中層在包內不重畫在身上。導航兩種都選時，胸前只畫手機，紙圖留清單圖示。防曬眼鏡藏在帽下、頭燈不被帽簷遮住。衣服配色不改膚色與身形，不以錯裝扮醜化角色。

### 裝備檢查總結

顯示「行前風險 18／45，會帶入旅程」與五組分數。逐項用「符合／建議調整／尚未確認」搭配圖示，不用嘲諷的對錯標語。例如「頭燈已備：延誤時可空出雙手」「防風外套不防持續降雨：這趟可能下雨，改帶防水外層」。每列可點回品項。未選物品與備援功能仍全部可展開。

底部固定「返回修改」「確認出發」。行前風險>0仍可開始一般教學行程；行政條件與延期情境未解除時不能開始。點確認將 `state.risk=preparationRisk`，不是每進檢查頁就累加。取消出發不算求救。

## 5. 旗標與情境掛鉤

### 裝備與路線旗標

裝備由選擇的item.effects推導，不讓存檔同時保存兩份可互相矛盾的真相。載入時重新計算。

|旗標|推導方式|
|---|---|
|has_headlamp、has_first_aid、has_emergency_blanket、has_power_bank、has_trekking_poles、has_whistle、has_satellite、has_food、has_dry_clothes、has_shelter、has_overnight_kit、has_water_treatment|對應背包品項勾選。|
|has_gps_offline|offline_map已勾選，表示下載並實測過，不只是有手機。|
|has_navigation|has_gps_offline OR has_paper_navigation。紙圖與指北針視為已學會操作的組合。|
|has_rain_shell|外層rain_shell OR 背包rain_kit。輕便雨衣單獨選不等於可靠高山防雨。|
|has_rain_pants|rain_kit。外套不自帶雨褲。|
|has_wind_shell|rain_shell OR windbreaker OR rain_kit。輕便雨衣不計高風防護。|
|has_insulation|fleece OR down OR spare_insulation。羽絨受濕影響另用濕冷題提醒，本版不做動態裝備損壞。|
|has_warm_hat、has_warm_gloves|穿著或背包相對品項任一。|
|has_sun_protection|sun_kit；遮陽帽是額外頭頸遮蔽，單獨不算完整防曬功能。|
|proper_shoes|boots；trainers為獨立中間選項，非一律不合格。|
|water_level、water_l|1、2、3；water_target_l及water_low依第4節。兩欄保持同值，不把等級當剩餘量。|
|cotton_base、jeans、shorts、sandals、trainers、cotton_socks、down_layer|對應item.effects；no_socks由所選id判定。|
|insurance_checked|行前已確認保障，無風險減免。|
|route.rough|加里山、玉山、雪山、南湖為true。|
|route.brush|加里山、雪山、南湖為true。只影響短褲的保護提醒。|
|route.overnight|mountain.overnight。|
|route.has_stream|只有加里山選定含風美溪路段時為true，其餘基礎路線false。|
|route.high_altitude|合歡、玉山、雪山、南湖為true。|

天氣包含rain、wet、cold、hot、strong_wind、thunder、front、typhoon、fog、ice、uv_high、official_closed。第3節定義briefFlags與actualFlags；官方封閉在純靜態版本是「模擬公告」選項，不能宣稱即時知道官方有無封山。另有事件旗標dark（天色已暗或題目描述視線不足），不等於天氣。

### 既有題目具體修飾

下表每列是可獨立實作的modifier id，僅套在「玩家選了錯誤選項且base>0」時。缺裝及有裝是互斥分支。沒有列出的題目維持原risk。未滿足情境啟用條件不套用；同題同列只算一次。

|modifier id／既有scenario id|條件|缺少時|具備時與安全選項補充|
|---|---|---|---|
|light：`headlamp-before-dark`、`night-bivouac`|dark；這兩題敘事已符合|無has_headlamp：mult=1.5|有頭燈mult=0.9。補充「先測試照明，仍不在黑暗中亂闖」。|
|rain：`rain-gear-early`、`pack-for-rain`、`wet-hypothermia`、`hypothermia-blanket`|actual.wet；pack-for-rain用brief.wet|無has_rain_shell：mult=1.25、add=2；只輕便雨衣改為mult=1.1、add=1|有has_rain_shell且has_rain_pants：mult=0.9。只有上身外套mult=1，提示仍缺雨褲。|
|warm：`layer-clothing`、`wet-hypothermia`、`hypothermia-blanket`、`night-bivouac`|actual.cold；layer-clothing用brief.cold|無has_insulation：add=3；有保暖卻無乾衣且wet：add=1|有保暖及乾衣且毯：mult=0.9。補充「遮風雨、隔地、乾衣，緊急毯只是其中一環」。|
|water：`dehydration-rest`、`heatstroke-descent`、`heatstroke-confusion`|題目已描述缺水或熱傷害，不另外要求當下高溫flag|water_low：mult=1.25、add=2|攜水達目標且有防曬：mult=0.9。仍要提醒意識異常不可灌水，帶水不保證不中暑。|
|nav：`download-offline-map`、`lost-stop`、`lost-stop-b`、`lost-gully`、`lost-signal`、`fog-junction`|迷途題；fog-junction另限fog|無has_navigation：mult=1.25、add=2|有導航：mult=0.9；雙重導航仍只一次。補充「停下核對地形，地圖不是照走到底的命令」。|
|feet：`check-hiking-boots`、`ankle-sprain`、`fracture-stay`|原題地形或傷勢|拖鞋mult=1.3、add=2；運動鞋且陡濕mult=1.1|proper_shoes：mult=0.95。鞋不預防所有骨折，也不能讓受傷者硬走。|
|pole：`ankle-sprain`|陡坡題|無登山杖不加分|有has_trekking_poles：mult=0.95。補充「需會使用，受傷後不能靠杖硬撐」。|
|aid：`first-aid-cut`、`ankle-sprain`、`leech-wound`|需要乾淨敷料|無has_first_aid：add=2|有急救包：mult=0.9，重點是正確處置。|
|power：`phone-power`、`emergency-location`|手機導航或求援電力情境|無has_power_bank：add=2|有電源：mult=0.9。補充「防水、省電，求援依約保持聯絡」。|
|signal：`rescue-signals`|待援辨識情境|無哨子但有頭燈不加分；兩者皆無add=2|有has_whistle：mult=0.9，提示可原地示意。|
|shelter：`night-bivouac`|意外待援|無has_shelter：add=2|有has_shelter且保暖：mult=0.9，仍須安全選址。|
|sun：`dehydration-rest`、`heatstroke-descent`、`heatstroke-confusion`|uv_high或題面曝曬悶熱|無has_sun_protection：add=1|具備不再減分，避免和water重複給多次獎勵。|

如 `ridge-gust`、`falling-rock`、`thunder-ridge`、`afternoon-thunder`、`altitude-symptoms`、`ams-turnaround`、`severe-altitude`、`collapsed-trail`、`unsafe-crossing`，不因穿對衣鞋、帶杖、投保或帶衛星設備降低風險。正向效果是更完整的教學說明，安全答案永遠是依狀況停止、下撤或求援。衛星設備僅在 `emergency-call`、`emergency-location` 補「可在安全地點嘗試已測試的備用通訊，確認送達」，不保證收訊或縮短救援時間。

### 可實作公式與紀錄

```text
base = scenario.risk[selectedOption.orig]
if selectedOption.orig == scenario.answer OR base == 0:
    finalRisk = base
    mult = 1; add = 0
else:
    rules = matchingModifiers(scenario.id, gearFlags, contextFlags)
    mult = clamp(product(rule.mult default 1), 0.8, 1.5)
    add = clamp(sum(rule.add default 0), 0, 6)
    finalRisk = min(40, max(0, round(base * mult + add)))
gearDelta = finalRisk - base  // 可負，僅比較該題有無裝備修飾
state.risk = min(100, state.risk + finalRisk)
if state.risk >= 100: enterRescueEndingOnce()
```

正確答案本來若有非零base則保留，但現有題庫正解為0。顯示各modifier原始值及總上限後的實際值，不能把各列自行加出的分數當最後加分。例：缺頭燈時 `headlamp-before-dark` 的base18錯誤選項變27，裝備差額+9；有頭燈則round(18×0.9)=16，差額−2。`wet-hypothermia` base30、缺雨層缺保暖，乘1.25加5得42.5，單題封頂40，裝備差額+10。安全選項0維持0。

遊戲只累積非負finalRisk，有裝備不直接把已累積風險扣回去。結局分數含一次行前分數與每次實際加到risk的event增量。每題保存base、mult、add、finalRisk、gearDelta、appliedRuleIds、actualAdded（接近100時可能小於finalRisk），防止封頂與提前結局造成回顧對不上。

卡片回答後顯示：「原選擇風險18 → 本次27。因未帶頭燈，危險行動風險×1.5（+9）。」正向顯示：「頭燈備援讓這題風險少2分，仍需先集合慢行。」多原因最多先顯示兩行，可展開完整明細。答案提交前顯示裝備提醒，不預先標哪一項正解。

### 避免裝備與原題敘事矛盾

既有 `headlamp-before-dark` 寫「背包有頭燈」、`first-aid-cut` 寫「你的急救包」、`hypothermia-blanket`、`night-bivouac` 明列一組裝備，`ankle-sprain` 則寫隊友有冷敷袋與繃帶。不能只疊分數，留下玩家明明沒帶卻自動有道具的敘事。

實作新增 `scenarioVariants[id].missingGear`，輸出顯示副本，不覆寫原JSON；不新增第4選項、不更動原answer索引。例如缺頭燈時情境改「你沒帶頭燈，手機電量不多」，原安全選項改「先在安全處停下集合，避免摸黑亂走；無法安全撤退就保暖、回報位置求援」。缺急救包改「你未備乾淨敷料」，安全選項改為「在安全處用現有最乾淨可用材料加壓，出血不止就求援，評估撤退」。明列的乾衣、隔地墊、露宿袋也逐項按旗標替換，不能稱緊急毯等於睡墊。

缺導航的 `fog-junction` 安全選項改為「先集合核對正式路標與可用資料，無法確認就停下求助」，不要求拿出不存在的圖。`rain-gear-early` 缺雨具時改為「先移至附近安全遮蔽處，保護乾衣並評估安全撤退或求援」；缺背包套不影響內袋防水的教學。`layer-clothing` 需依是否有中層、外層、乾衣描述可用備援。`ankle-sprain` 若保留「隊友有」的原文，aid規則以隊伍可用敷料判定，不因玩家自己沒帶就加分；基礎版統一改成全隊共享玩家配裝，刪除原文的免費裝備。

所有變體必須保留停止惡化、撤退、求援的可選安全答案。第一版不做裝備鎖死正解；也不因沒帶而把醫療正確處置判成錯。選對後顯示「這次判斷正確，行前仍可補強」。只有在準備頁修正才重算行前分數，答題中不憑空補貨。

## 6. 資料結構與接入方式

草稿位於 `research/gear_data_draft/`：

|檔案|內容|
|---|---|
|mountains.json|版本、模擬提示、forecast_algorithm、六山資訊與四季參數。|
|gear.json|slots、items、effects、risks、teach、visual、行前規則AST與群組上限。|
|new_scenarios.json|8題沿用既有schema的新增建議。|
|scenario_triggers.json|新題id對應only_if，不依賴原題validator接受新欄位。|
|schemas.json|JSON Schema draft 2020-12，含mountains、gear、forecast、state、scenario等定義。|
|build_drafts.py、build_schemas.py|分別重建資料附表與schema的Python腳本。|
|validate_drafts.py|結構、題庫ID引用、配額與風險上限檢查。|

`items.effects` 是原子特性，如insulation、rain_shell；第5節負責推導has_*。`items.risks` 存本品項涉及的行前rule id，rule.related_items有對應反向索引。風險規則AST只允許all、any、path/op/value；op第一版只支援eq、gte，不使用eval。讀不到path屬設定錯誤，不能默默視false而漏算。

JSON Schema採 `$defs`，每份資料驗證時以相對根 `$ref` 對應。範例：`{"$schema":"https://json-schema.org/draft/2020-12/schema","$ref":"schemas.json#/$defs/mountains"}`。draft2020-12驗證器可用；跨欄位限制仍由語意驗證負責。schema不是遊戲runtime的新依賴。

### 新增狀態

```json
{
  "prepVersion": 1,
  "dataVersion": 1,
  "phase": "gear-check",
  "seed": 123,
  "tripIndex": 0,
  "mountainId": "xueshan",
  "season": "autumn",
  "historySnapshot": {},
  "selectedGear": {
    "hat": "beanie", "base": "wicking", "mid": "fleece",
    "shell": "rain_shell", "pants": "quick_pants", "shoes": "boots",
    "gloves": "warm_gloves", "socks": "hiking_socks", "water": "water_3",
    "pack": ["headlamp", "offline_map", "first_aid", "blanket", "power_bank", "snacks", "sun_kit", "whistle", "rain_kit", "dry_clothes", "shelter", "overnight_kit", "water_treatment"]
  },
  "forecast": {},
  "actualWeather": {},
  "briefFlags": {},
  "gearFlags": {},
  "routeFlags": {},
  "preparation": {"risk": 0, "groups": {}, "findings": [], "confirmed": false},
  "adminChecks": {"route": false, "permits": false, "lodging": false, "stayContact": false, "turnaround": false},
  "risk": 0,
  "pack_weight_g": 0,
  "gearImpact": {"added": 0, "avoided": 0},
  "eventRiskLog": []
}
```

上例是未完成生成的狀態輪廓，空forecast不符合「可出發」約束。完整forecast含trailhead_temp_c、summit_temp_c（各2數）、rain_probability_pct、wind_ms、gust_ms、hazards（六個布林）、ice。actualWeather含相同溫度欄位及rain、thunder、fog、ice、gust_ms、strong_wind。生成後才可確認出發。不要把 `actualWeather` 在簡報提前公開，重播模式才可檢視。

phase為mountain、forecast、gear、gear-check、playing、ending、postponed。首次play才將risk設為preparation.risk；重複點擊不能重記或重加。重開一趟清空eventRiskLog。gearImpact.added累計max(0,gearDelta)，avoided累計max(0,−gearDelta)，只是反事實教學比較，不是risk的直接會計項目。

首次接入改動順序為資料載入與驗證 → 行前頁 → 角色顯示 → 新抽題器 → 答題時修飾與敘事變體 → 結局回顧。需同步檢查main、ui、art、world實際接點，本文沒有假裝已讀這些未要求的檔案。原題risk保留，選項建立時同時保留baseRisk與orig，在作答那一刻依當段天氣計算，避免buildEvents把尚未發生的實況寫死。

新資料HTTP載入或驗證失敗時顯示「裝備資料無法讀取，改玩原版模式」，啟動原有流程且行前風險0；不可部分資料混搭。file協定沿用精簡題庫模式並提示未開啟準備功能。可在未來把經驗證的少量山岳裝備包進fallback-data，但本次不修改。localStorage可維持v1並新增帶版本prepSummary，缺欄位以空值處理，不重算舊最佳紀錄。

## 7. 結局整合與驗收

沿用既有 `<20／<50／<80／<100／≥100` 分級，不把行前上限45當作新的結局門檻。≥100進求救結局，文案延續「盡早求救是正確選擇」，不暗示呼救本身是不良行為。實際事故不由遊戲分數診斷。

結局頂部顯示山岳、季節、行前風險、累積風險及完成／提前求援。新增兩張可展開卡：

- 「行前準備」列五組分數與前三項可改善內容，並顯示當時所選裝備、許可及留守核對。
- 「裝備影響回顧」列每題base→final、缺裝加成或備援減量。總計「危險選項因缺裝多X分；有備援少Y分」，註明是相對原題的比較，不代表能用裝備換取冒險。

總分對帳用 `preparation.risk + sum(eventRiskLog.actualAdded) = state.risk`。中止在100時，最後一題完整finalRisk及截斷後actualAdded分開顯示。加成與減量不能另外再加進risk。裝備很齊仍可能選錯到求救；準備不足也能靠早退、停下與求援作出正確選擇。結尾提供「帶著本趟清單再練習」及「回到選山」，不暗示能由此取得真實登山資格。

驗收情境至少包括：

1. 六山四季都能生成相容天氣；同種子、同tripIndex、同history與資料版本可重現。返回換裝不改預報與題序。
2. 濕冷最差配置45，建議功能齊備0；多次進檢查頁不重加。暖乾短程不硬湊45。
3. 缺頭燈錯選18→27，有頭燈18→16；安全選項仍0。缺雨保暖base30的組合不超過單題40。
4. 缺頭燈、地圖、急救、雨衣、乾衣、睡墊的情境變體不提到不存在的裝備，安全選項可選。
5. 相同裝備可在不同山岳天氣有不同結果；拖鞋始終需改善，運動鞋不是在所有情況都一律錯。
6. 只帶防風外套或背包套不算身體防雨；只帶救生毯不算完整露宿；收包的保暖層也算已備。
7. 高山症、雷擊、持續落石及崩塌不受裝備減免。行政未完成、颱風／封閉／無訓練冰雪情境導向延期。
8. 選題不跨stage亂補、不在七星山考典型高山症、不在合歡主峰突然走黑森林；8題新增題保留三選項原schema。
9. 風險99加10只記actualAdded1，正確進求救且回顧對帳。重複提交與重播結局不重記。
10. 360×640、390×844手機與橫向畫面能讀完卡片；不用顏色也能判讀；全品項角色合成無缺手、雙帽或無限捲袋。

本次驗證範圍為草稿JSON語法、本地schema關鍵字檢查與語意引用，不是遊戲整合測試。下列附表以資料草稿為準。

已執行的驗證（2026-11-01）：

```bash
python3 gear_data_draft/validate_drafts.py
python3 -m json.tool gear_data_draft/mountains.json > /dev/null
python3 -m json.tool gear_data_draft/gear.json > /dev/null
```

結果：五份JSON均另以 `python3 -m json.tool` 通過；四份資料通過本地schema所用關鍵字檢查；51題既有ID、8題新增ID、六山24組季節參數與品項雙向引用一致。行前最差配置45、齊備配置0，以及頭燈和濕冷修飾算例通過。環境未提供jsonschema套件，無法連線安裝，因此未宣稱完成第三方完整Draft2020-12或meta-schema認證；本地驗證器只涵蓋草稿使用的關鍵字。state定義是待實作介面，尚未與遊戲執行狀態整合驗證。

## 附表 A：六座山岳卡片

### 七星山主峰（`qixing`）

- 海拔約 1,120 公尺；本遊戲登山口基準約 805 公尺。典型 0.5–1 天；★（遊戲相對難度）。
- 路線：小油坑至主峰原路往返；石階、草原裸稜。
- 簡介：郊山入門，也要準備風雨備援。
- 許可與住宿：一般開放步道通常免入園、入山申請；不含另有管制的保護區。無住宿安排。
- 主要風險：濃霧、濕滑石階、強風、雷擊。
- 每段建議事件數（登山口／森林／稜線／山頂／下山）：1／2／1／1／2，共 7 題。
- 優先候選：`check-hiking-boots`、`fog-junction`、`ridge-gust`、`headlamp-before-dark`。
- 本次攜水規劃起點 1–2 公升，仍須依補水點與個人狀況重算。
- [官方路線資料](https://www.ymsnp.gov.tw/ch/sglarticle/trail-classification)。

### 合歡山主峰（`hehuan`）

- 海拔約 3,417 公尺；本遊戲登山口基準約 3,200 公尺。典型 0.5–1 天；★★（遊戲相對難度）。
- 路線：台14甲線主峰登山口原路往返；舊道路、開闊坡面。
- 簡介：步程短，高海拔與低溫仍須認真準備。
- 許可與住宿：一般合歡主峰步道通常免入園及入山申請；仍須查道路、雪季及步道管制。住宿若有需另訂。
- 主要風險：高山症、失溫、強風、雷擊、結冰。
- 每段建議事件數（登山口／森林／稜線／山頂／下山）：1／1／2／1／2，共 7 題。
- 優先候選：`altitude-symptoms`、`ridge-gust`、`afternoon-thunder`、`ams-turnaround`。
- 本次攜水規劃起點 1–2 公升，仍須依補水點與個人狀況重算。
- [官方路線資料](https://www.taroko.gov.tw/ch/listicle/faq/350)。

### 加里山（`jiali`）

- 海拔約 2,220 公尺；本遊戲登山口基準約 1,350 公尺。典型 1–1 天；★★★（遊戲相對難度）。
- 路線：鹿場主線原路往返；森林、樹根、溪流及近頂陡坡。
- 簡介：長日中級山，留足折返與照明餘裕。
- 許可與住宿：山林悠遊網列入山申請「否」，一般主線通常免入園；沿線避難設施不可當作已預約住宿。查新竹分署最新公告。
- 主要風險：迷途、濕滑樹根、扭傷、溪水暴漲、摸黑。
- 每段建議事件數（登山口／森林／稜線／山頂／下山）：2／3／2／1／2，共 10 題。
- 優先候選：`download-offline-map`、`lost-stop`、`ankle-sprain`、`unsafe-crossing`、`headlamp-before-dark`。
- 本次攜水規劃起點 2–3 公升，仍須依補水點與個人狀況重算。
- [官方路線資料](https://recreation.forest.gov.tw/Trail/RT?tr_id=043)。

### 玉山主峰（`yushan`）

- 海拔約 3,952 公尺；本遊戲登山口基準約 2,600 公尺。典型 2–2 天；★★★★（遊戲相對難度）。
- 路線：塔塔加經排雲山莊原路往返；山腰步道、碎石風口。
- 簡介：兩天行程也要有高度適應與撤退計畫。
- 許可與住宿：主峰線需入園，並確認入山核准；排雲住宿名額須依公告申請及抽籤，床位、餐食與租借分別確認。
- 主要風險：高山症、失溫、碎石落石、雷擊、冰雪。
- 每段建議事件數（登山口／森林／稜線／山頂／下山）：2／2／3／2／2，共 11 題。
- 優先候選：`check-permits`、`hut-camp-planning`、`falling-rock`、`ams-turnaround`、`headlamp-before-dark`。
- 本次攜水規劃起點 2–3 公升，仍須依補水點與個人狀況重算。
- [官方路線資料](https://www.ysnp.gov.tw/Trail/7fa5c242-df1a-4a8e-bcab-32dc55b1f7b6?Tab=5)。

### 雪山主峰（`xueshan`）

- 海拔約 3,886 公尺；本遊戲登山口基準約 2,140 公尺。典型 2–3 天；★★★★（遊戲相對難度）。
- 路線：武陵雪山登山口經東峰、黑森林及圈谷原路往返。
- 簡介：穿越森林到圈谷，天候與過夜準備都重要。
- 許可與住宿：需入園；入山需求依當期警政管制範圍核對。七卡山莊、三六九山莊相關營地或替代住宿須依核准安排；三六九重建期間不可預設有床。
- 主要風險：高山症、黑森林迷途、失溫、冰雪、長程疲勞。
- 每段建議事件數（登山口／森林／稜線／山頂／下山）：2／3／3／2／2，共 12 題。
- 優先候選：`hut-camp-planning`、`fog-junction`、`severe-altitude`、`wet-hypothermia`、`night-bivouac`。
- 本次攜水規劃起點 2–3 公升，仍須依補水點與個人狀況重算。
- [官方路線資料](https://www.taiwan.nps.gov.tw/home/zh-tw/trails/21209.html)。

### 南湖大山（`nanhu`）

- 海拔約 3,742 公尺；本遊戲登山口基準約 1,950 公尺。典型 4–5 天；★★★★★（遊戲相對難度）。
- 路線：勝光或思源一帶核准起點，經雲稜、五岩峰、圈谷往返；長程負重、岩稜。
- 簡介：多天遠程考驗，撤退餘裕比登頂更重要。
- 許可與住宿：進入生態保護區須入園；入山另依警政公告核對。雲稜、圈谷山屋或營地須核准，不保證現場有位。
- 主要風險：五岩峰暴露地形、強風、碎石坡、高山症、失溫、救援距離。
- 每段建議事件數（登山口／森林／稜線／山頂／下山）：2／3／3／2／3，共 13 題。
- 優先候選：`check-permits`、`hut-camp-planning`、`ridge-gust`、`falling-rock`、`night-bivouac`、`severe-altitude`。
- 本次攜水規劃起點 2–3 公升，仍須依補水點與個人狀況重算。
- [官方路線資料](https://www.taroko.gov.tw/ch/trailsAttractions/trail-list/58)。

## 附表 B：各山各季天氣候選範圍

全部是遊戲模擬值，不是實際預報、氣候平均或警戒標準。山頂包絡用每升高100公尺約降0.6°C，再加±2°C變異；實際抽樣先抽登山口，再推算山頂，因此兩者不獨立。

|山岳|季節|登山口°C|山頂°C包絡|降雨機率候選%|平均風速m/s|
|---|---|---|---|---|---|

|七星山主峰|春|10～22|6.1～22.1|40～80|2～9|

|七星山主峰|夏|19～30|15.1～30.1|30～70|1～7|

|七星山主峰|秋|12～25|8.1～25.1|30～75|3～11|

|七星山主峰|冬|2～16|-1.9～16.1|40～85|4～13|

|合歡山主峰|春|-2～12|-5.3～12.7|25～65|3～12|

|合歡山主峰|夏|6～18|2.7～18.7|35～75|2～10|

|合歡山主峰|秋|0～14|-3.3～14.7|15～55|3～13|

|合歡山主峰|冬|-8～7|-11.3～7.7|15～55|4～16|

|加里山|春|7～21|-0.2～17.8|35～75|1～7|

|加里山|夏|15～27|7.8～23.8|40～80|1～6|

|加里山|秋|8～23|0.8～19.8|20～60|2～8|

|加里山|冬|-1～15|-8.2～11.8|20～60|2～10|

|玉山主峰|春|0～14|-10.1～7.9|25～65|3～12|

|玉山主峰|夏|7～20|-3.1～13.9|35～75|2～10|

|玉山主峰|秋|1～16|-9.1～9.9|15～55|3～13|

|玉山主峰|冬|-6～10|-16.1～3.9|15～55|4～16|

|雪山主峰|春|3～17|-9.5～8.5|25～65|3～12|

|雪山主峰|夏|10～23|-2.5～14.5|35～75|2～10|

|雪山主峰|秋|4～19|-8.5～10.5|15～55|3～13|

|雪山主峰|冬|-4～12|-16.5～3.5|15～55|4～16|

|南湖大山|春|4～18|-8.8～9.2|25～65|3～12|

|南湖大山|夏|11～24|-1.8～15.2|35～75|2～10|

|南湖大山|秋|5～20|-7.8～11.2|15～55|3～13|

|南湖大山|冬|-3～13|-15.8～4.2|15～55|4～16|


特殊天氣為以下「候選事件抽中率」。各山各季的展開數值見 mountains.json 的 hazard_probability。各事件可並存，不能把一列相加當100%。冰僅在實現溫度≤2°C且有雨、濃霧或冬季殘冰條件時成立。

|季節|午後雷陣雨|鋒面|颱風外圍|濃霧|冰候選|強陣風候選|
|---|---|---|---|---|---|---|

|春|10%|30%|0%|35%|12%|15%|

|夏|40%|10%|10%|25%|0%|10%|

|秋|10%|15%|8%|30%|8%|25%|

|冬|1%|35%|0%|35%|50%|35%|


山岳倍率（未列事件×1，機率上限80%）：七星山霧×1.3、冰×0.03、陣風×1.2；加里山霧×1.2、冰×0.10、陣風×0.7；合歡主峰冰×1.0、陣風×1.2；玉山、雪山、南湖冰×1.1、陣風×1.1。這些倍率只控制教學出題頻率。

## 附表 C：每項裝備教學與 Q 版繪製

重量是遊戲估值，穿著重量此版不計入背包。防水、保暖不代表免疫。未勾選背包品項即無該功能，不另外畫圖。

|ID／欄位|選項|背包估重g|卡片教學|視覺|
|---|---|---|---|---|

|`sun_hat`／hat|遮陽帽|0|遮陽並保護頭頸，濕冷時另備保暖。|米色橢圓帽簷、卡其帽冠|

|`beanie`／hat|毛帽|0|冷風中減少散熱；炎熱活動時可收起。|紅色半圓帽冠與小毛球|

|`no_hat`／hat|不戴|0|曝曬與冷風都少一層保護。|露出深棕色頭髮|

|`wicking`／base|排汗衣|0|幫助排汗快乾，仍需調整速度避免汗濕。|青綠短袖圓領|

|`cotton`／base|棉T|0|吸水後不易乾，風雨中容易濕冷。|白色短袖加小藍方塊|

|`fleece`／mid|刷毛|0|保暖且較易管理濕氣，風雨中仍需外層。|橘色薄長袖、中央拉鍊|

|`down`／mid|羽絨|0|乾燥時保暖，受潮表現下降，須防水收納。|紫色蓬鬆長袖、三道橫線|

|`no_mid`／mid|不穿|0|活動熱時可不穿，但冷天需在背包備保暖層。|顯示內層|

|`rain_shell`／shell|防水透氣外套|0|遮風雨，走動仍可能悶熱；雨褲另外備。|黃色長袖、連帽邊與拉鍊|

|`poncho`／shell|輕便雨衣|0|短程備援可用，強風易飄動且可能破損。|半透明淡藍A字罩衫，露出雙手|

|`windbreaker`／shell|防風外套|0|擋風，不能當作持續降雨的防水層。|深藍貼身長袖、拉鍊|

|`no_shell`／shell|不穿|0|晴暖時可不穿，背包仍應有風雨備援。|顯示中層或內層|

|`quick_pants`／pants|快乾登山褲|0|保護腿部且較易乾，仍會濕也不等於防水。|橄欖綠兩條長褲管|

|`jeans`／pants|牛仔褲|0|濕後厚重不易乾，抬腿也較受限。|靛藍長褲、黃色側線|

|`shorts`／pants|短褲|0|炎熱開闊短程可用，草叢與濕冷長程保護少。|灰色短褲、膚色小腿|

|`boots`／shoes|登山鞋|0|已試穿、合腳且鞋底完好才可靠；仍會滑。|棕色圓鞋頭、黑厚底、兩點鞋帶|

|`trainers`／shoes|運動鞋|0|完好且有抓地力者可應付簡單乾燥路，陡濕地形要重評。|藍色圓鞋頭、白底|

|`sandals`／shoes|拖鞋|0|固定與護趾不足，不適合這些登山路線。|膚色腳掌、粉紅V帶|

|`warm_gloves`／gloves|防風保暖手套|0|冷風中保護手部，濕了需更換。|黑色圓手套，掌與拇指兩塊|

|`no_gloves`／gloves|無|0|晴暖時可不戴，冷天背包仍要備。|膚色圓手掌|

|`hiking_socks`／socks|排汗登山襪|0|合腳可減少摩擦，濕襪要更換。|灰色襪口與橘色細帶|

|`cotton_socks`／socks|棉襪|0|濕後不易乾，留意摩擦與保暖。|白色襪口|

|`no_socks`／socks|不穿襪|0|鞋內摩擦增多，需留意腳部。|露出腳踝|

|`headlamp`／pack|頭燈含備用電池|120|先測亮度與電池，不能只靠手機照明。|深灰頭帶與淡黃圓燈|

|`offline_map`／pack|離線地圖與GPS|0|先下載底圖、路線並實測定位；有手機不等於已備好。|胸前深灰手機、綠色折線|

|`paper_map`／pack|紙本地圖與指北針|80|學會判讀，和電子導航互為備援。|米白摺圖與紅白指針|

|`first_aid`／pack|急救包|200|帶合用敷料與個人藥品，並練習使用。|紅色方包、白色十字|

|`blanket`／pack|緊急保暖毯|80|減少散熱，不會自行產熱，仍需隔地與遮風雨。|銀色摺疊小矩形|

|`power_bank`／pack|行動電源與線|220|充飽並防水，低溫時保護電池。|黑色圓角長方形、白色電量點|

|`snacks`／pack|行動糧與額外備糧|400|分次補充，另留延誤備糧。|橘色能量棒袋|

|`poles`／pack|登山杖|450|調好長度、練習使用；不能替代安全落腳點。|兩支灰桿、黑握把|

|`sun_kit`／pack|防曬乳與抗UV眼鏡|100|依標示補擦，眼睛也要防護。|白色小瓶、黑框眼鏡|

|`whistle`／pack|哨子|15|示意省體力，仍要回報位置與保持聯絡。|肩帶黃色小長方體|

|`rain_kit`／pack|備用雨衣、雨褲與背包套|450|雨具易取，背包套不能取代內部分袋防水。|藍色捲袋與背包藍罩|

|`dry_clothes`／pack|防水袋裝備用乾衣|450|留一套乾衣並備襪，別等濕透才處理。|青色捲口袋|

|`spare_insulation`／pack|背包備用刷毛層|300|不穿中層時可收包，休息冷了再加。|橘色捲衣小包|

|`spare_beanie`／pack|備用毛帽|60|暖天先收包，冷風來時取出。|紅色摺帽|

|`spare_gloves`／pack|備用保暖手套|70|不必一直戴，但冷時要拿得到。|黑色手套圖示|

|`satellite`／pack|衛星或適用備用通訊設備|200|先確認服務、電力與操作；仍受地形天空遮蔽。|橘色短天線盒|

|`insurance`／pack|登山保險已確認|0|查海拔、活動、日期與除外事項；不降低物理危險。|檢查表藍色文件圖示，角色不畫|

|`fire_kit`／pack|防水收納用火工具|40|只在合法安全處使用，禁火區不點火。|紅色小防水盒|

|`repair_kit`／pack|修補工具組|100|膠帶與簡易工具供暫時處理，故障仍要評估撤退。|灰色膠帶環|

|`shelter`／pack|緊急露宿袋與隔地墊|500|遮蔽與隔地一起備，避開溪床及落石區。|深綠捲袋加灰色泡棉捲|

|`overnight_kit`／pack|核准過夜裝備組|2000|含合適睡袋、睡墊與已確認供餐或炊煮計畫；營地另備帳篷。|背包底部紫色睡袋捲|

|`water_treatment`／pack|水處理與取水計畫|100|水源先確認，選適用過濾與消毒；不能保證去除所有污染。|淺藍濾水袋|

|`water_1`／water|1公升|1000|依路線、流汗與可用補水調整；這是攜行量，不是整趟固定需求。|背包側袋藍水瓶，1個刻度|

|`water_2`／water|2公升|2000|依路線、流汗與可用補水調整；這是攜行量，不是整趟固定需求。|背包側袋藍水瓶，2個刻度|

|`water_3`／water|3公升以上（草稿以3公升計）|3000|依路線、流汗與可用補水調整；這是攜行量，不是整趟固定需求。|背包側袋藍水瓶，3個刻度|

## 附表 D：行前風險規則

條件 AST 的 gear 為推導旗標、weather 為簡報旗標。所有山共用，route 旗標依山岳推導，故也構成「山×天氣」規則；無命中即0分。

|規則ID／群組|條件（精確AST）|分數|教學理由模板|
|---|---|---|---|

|`cotton_wet`／clothing|`{"all":[{"path":"gear.cotton_base","op":"eq","value":true},{"any":[{"path":"weather.wet","op":"eq","value":true},{"path":"weather.cold","op":"eq","value":true}]}]}`|+3|棉衣濕後不易乾，風雨中較易受寒。|

|`no_warmth`／clothing|`{"all":[{"path":"weather.cold","op":"eq","value":true},{"path":"gear.has_insulation","op":"eq","value":false}]}`|+5|預期濕冷，穿著或背包需要保暖層。|

|`no_rain`／clothing|`{"all":[{"path":"weather.wet","op":"eq","value":true},{"path":"gear.has_rain_shell","op":"eq","value":false}]}`|+5|缺可靠風雨層，雨褲與乾衣也要保護。|

|`no_wind`／clothing|`{"all":[{"path":"weather.strong_wind","op":"eq","value":true},{"path":"gear.has_wind_shell","op":"eq","value":false}]}`|+3|裸稜強風時要能擋風，雨具不能抵消失衡危險。|

|`jeans_wet`／clothing|`{"all":[{"path":"gear.jeans","op":"eq","value":true},{"any":[{"path":"weather.wet","op":"eq","value":true},{"path":"weather.cold","op":"eq","value":true}]}]}`|+3|牛仔褲濕後厚重且不易乾。|

|`shorts_cold`／clothing|`{"all":[{"path":"gear.shorts","op":"eq","value":true},{"any":[{"path":"weather.cold","op":"eq","value":true},{"path":"route.brush","op":"eq","value":true}]}]}`|+2|濕冷或草叢路段，長褲較有保護。|

|`cold_extremities`／clothing|`{"all":[{"path":"weather.cold","op":"eq","value":true},{"any":[{"path":"gear.has_warm_hat","op":"eq","value":false},{"path":"gear.has_warm_gloves","op":"eq","value":false}]}]}`|+2|頭手冷時要有可取用的保暖備援。|

|`sandals`／feet|`{"path":"gear.sandals","op":"eq","value":true}`|+6|拖鞋固定與護趾不足，改穿合腳且鞋底完好的鞋。|

|`trainers_rough`／feet|`{"all":[{"path":"gear.trainers","op":"eq","value":true},{"any":[{"path":"route.rough","op":"eq","value":true},{"path":"weather.wet","op":"eq","value":true},{"path":"weather.ice","op":"eq","value":true}]}]}`|+2|陡濕路面需要合適抓地與固定，依路況重選鞋。|

|`socks_wet`／feet|`{"any":[{"path":"gear.no_socks","op":"eq","value":true},{"all":[{"path":"gear.cotton_socks","op":"eq","value":true},{"path":"weather.wet","op":"eq","value":true}]}]}`|+1|腳部潮濕或摩擦時要換乾襪並檢查。|

|`missing_light`／navigation|`{"path":"gear.has_headlamp","op":"eq","value":false}`|+5|短程也可能延誤，頭燈與備用電池要帶在身上。|

|`missing_nav`／navigation|`{"path":"gear.has_navigation","op":"eq","value":false}`|+5|需可離線使用且會操作的導航方式。|

|`missing_power`／navigation|`{"all":[{"path":"gear.has_gps_offline","op":"eq","value":true},{"path":"gear.has_power_bank","op":"eq","value":false}]}`|+1|手機負責導航時需要電力備援。|

|`water_low`／supply|`{"path":"gear.water_low","op":"eq","value":true}`|+4|攜水低於本次規劃，先補水或縮短路線。|

|`food_missing`／supply|`{"path":"gear.has_food","op":"eq","value":false}`|+2|準備行動糧，也為延誤留一份。|

|`sun_missing`／supply|`{"all":[{"path":"weather.uv_high","op":"eq","value":true},{"path":"gear.has_sun_protection","op":"eq","value":false}]}`|+2|曝曬時需遮蔽、眼睛防護與適當防曬。|

|`missing_firstaid`／emergency|`{"path":"gear.has_first_aid","op":"eq","value":false}`|+2|急救用品與使用能力都要準備。|

|`missing_blanket`／emergency|`{"path":"gear.has_emergency_blanket","op":"eq","value":false}`|+2|緊急毯減少散熱，不能替代完整保暖。|

|`missing_dry`／emergency|`{"all":[{"path":"weather.wet","op":"eq","value":true},{"path":"gear.has_dry_clothes","op":"eq","value":false}]}`|+1|乾衣要分袋防水。|

|`missing_shelter`／emergency|`{"path":"gear.has_shelter","op":"eq","value":false}`|+1|意外待援需考慮隔地與遮蔽。|

## 附表 E：新增情境草稿（8題）

完整三選項、答案索引、風險、說明、來源已寫入 new_scenarios.json，only-if 另放 scenario_triggers.json，不改原題庫。

### 今天改期（`prep-postpone`）

`trailhead`／行前規劃；only-if：`{"path": "weather.official_closed", "op": "eq", "value": true}`。

官方公告本路線封閉，背包已打包完成。

1. 改期並通知隊友與留守人（風險0，正解）
2. 帶齊裝備就能通過（風險30）
3. 走旁邊小路避開封鎖（風險30）

封閉時不進入，裝備不能替代開放與許可。

[教學背景來源](https://hike.taiwan.gov.tw/)。衛星操作另依設備手冊，情境是假設案例。

### 褲管也要防雨（`prep-rainpants`）

`forest`／裝備穿搭；only-if：`{"path": "weather.rain", "op": "eq", "value": true}`。

雨持續下，外套擋住上身，但褲管開始濕冷。

1. 加快走路烘乾褲管（風險20）
2. 在安全處穿雨褲，評估撤退（風險0，正解）
3. 只套背包套即可（風險18）

上身外套不等於全身防雨，持續濕冷應調整行程。

[教學背景來源](https://www.ysnp.gov.tw/StaticPage/Equipment)。衛星操作另依設備手冊，情境是假設案例。

### 保住乾燥保暖層（`prep-down-dry`）

`ridge`／裝備穿搭；only-if：`{"all": [{"path": "weather.rain", "op": "eq", "value": true}, {"path": "gear.down_layer", "op": "eq", "value": true}]}`。

休息前發現雨水快進入背包，裡面放著羽絨衣。

1. 把羽絨衣拿出來接雨（風險25）
2. 不用處理，羽絨永遠保暖（風險20）
3. 先在安全遮蔽處防水收納，檢查乾衣並評估撤退（風險0，正解）

羽絨受潮保暖表現下降，乾燥收納與遮蔽很重要。

[教學背景來源](https://www.ysnp.gov.tw/StaticPage/Equipment)。衛星操作另依設備手冊，情境是假設案例。

### 前方是冰面（`prep-ice-turn`）

`ridge`／天氣與地形；only-if：`{"path": "weather.ice", "op": "eq", "value": true}`。

原本沒有雪的步道出現大片結冰，你沒有雪地訓練。

1. 停止前進，沿可安全撤回的路退回，受困則求援（風險0，正解）
2. 登山鞋踩重一點就不滑（風險28）
3. 靠登山杖快速衝過（風險30）

一般登山鞋與登山杖不能保證冰面安全；雪地裝備仍需訓練。

[教學背景來源](https://www.ysnp.gov.tw/Trail/7fa5c242-df1a-4a8e-bcab-32dc55b1f7b6?Tab=5)。衛星操作另依設備手冊，情境是假設案例。

### 山屋沒有保證供水（`prep-water-plan`）

`trailhead`／體能補給；only-if：`{"path": "route.overnight", "op": "eq", "value": true}`。

你查到山屋近期缺水，原本只打算背一點水。

1. 照走再跟別人借（風險22）
2. 重算各段用水，增加攜水或改行程（風險0，正解）
3. 到湖邊直接喝（風險25）

山屋與溪流不是保證水站，先確認水況與處理方式。

[教學背景來源](https://www.ysnp.gov.tw/StaticPage/Equipment)。衛星操作另依設備手冊，情境是假設案例。

### 有雨衣也要撤（`prep-thunder-stop`）

`summit`／天氣與地形；only-if：`{"path": "weather.thunder", "op": "eq", "value": true}`。

穿好雨衣後，你在開闊山頂聽見雷聲。

1. 有雨衣可以多待一下（風險28）
2. 躲到最高的孤立樹下（風險30）
3. 立刻放棄拍照，沿安全路線離開山頂與裸稜（風險0，正解）

防水衣物不防雷，聽到雷聲就採取避雷行動。

[教學背景來源](https://www.cwa.gov.tw/V8/C/L/Mountain/Mountain.html)。衛星操作另依設備手冊，情境是假設案例。

### 衛星訊息還沒送出（`prep-sat-sky`）

`forest`／迷路與求救；only-if：`{"path": "gear.has_satellite", "op": "eq", "value": true}`。

在安全待援點，衛星設備顯示訊息尚未送達。

1. 確認操作與天空遮蔽，在安全範圍嘗試並保留電力（風險0，正解）
2. 沒送出也當作救援已收到（風險20）
3. 離開步道爬崖追訊號（風險30）

備用通訊仍有使用限制，需確認送達與保持自身安全。

[教學背景來源](https://www.ysnp.gov.tw/StaticPage/Equipment)。衛星操作另依設備手冊，情境是假設案例。

### 背得動才帶得走（`prep-overpack`）

`trailhead`／裝備穿搭；only-if：`{"path": "state.pack_weight_g", "op": "gte", "value": 8000}`。

背包整理好卻重到無法穩定行走。

1. 先把頭燈、雨衣與水丟掉（風險24）
2. 保留安全功能，協調分工、減少非必要物或縮短路線（風險0，正解）
3. 勉強背著衝上山（風險20）

負重需實際試背，不要以刪除安全備援解決。

[教學背景來源](https://www.ysnp.gov.tw/StaticPage/Equipment)。衛星操作另依設備手冊，情境是假設案例。

## 查證來源與不確定之處

下列為2026-11-01查閱的官方頁面，本文以摘要轉述。頁面的發布日、更新日與現況可能不同；路線介紹不能取代最新開放公告。所有衣著風險點數、重量估值、事件機率、季節溫度範圍、風速區間、星等與題數是遊戲設計，不是官方背書的安全係數。

|來源|查證用途與適用限制|
|---|---|
|[中央氣象署：登山](https://www.cwa.gov.tw/V8/C/L/Mountain/Mountain.html)|確認登山氣象查詢入口。頁面以JavaScript載入，本次沒有擷取各山即時逐時預報；遊戲不用假資料冒稱即時。|
|[中央氣象署：氣象隨選平台](https://wede.cwa.gov.tw/)|平台提示預報有不確定性，山區變化更快；作為「預報可能改變」教學依據。|
|[中央氣象署：高溫](https://climate.cwa.gov.tw/HighTemperature)|濕度、風速影響體感，支持質性冷熱提示；本文未套用數值體感公式。|
|[陽明山管理處：步道分級](https://www.ymsnp.gov.tw/ch/sglarticle/trail-classification)|七星山主峰約1120公尺；小油坑至冷水坑為其中一種選線；秋冬季風與霧、夏季午後雷陣雨提醒。本文採主峰原路往返，不把不同起終點里程混用。|
|[國家公園署：遠眺七星山](https://www.taiwan.nps.gov.tw/home/zh-tw/live/30187.html)|交叉確認海拔與森林、草原景觀；不同入口造成步程差異。|
|[太魯閣管理處：合歡主峰步道](https://www.taroko.gov.tw/AttractionTrailContent.aspx?n=5511&s=50&sa=X&sms=11272)|確認主峰海拔3417公尺。|
|[太魯閣管理處：建議遊程](https://www.taroko.gov.tw/ch/titlelist/suggested-itineraries/326)|主峰遊程約1.5–2小時的參考，仍須看交通與步道公告。遊戲不以短步程豁免高度風險。|
|[太魯閣管理處：路線常見問答](https://www.taroko.gov.tw/ch/listicle/faq/350)|合歡山區非生態保護區的一般入園規則；也可看南湖至中央尖多天行程，但本文南湖主峰往返4–5天是規劃範圍，不直接照抄六天縱走。|
|[太魯閣管理處：合歡山步道問答](https://www.taroko.gov.tw/News_toggle.aspx?_CSN=2348%2C2352%2C2350%2C2351&n=5407&sms=10316)|一般合歡步道免入園、入山的說明。例外管制、雪季與改走其他山線仍須重查。|
|[林業及自然保育署／山林悠遊網：加里山](https://recreation.forest.gov.tw/Trail/RT?tr_id=043)|確認海拔1350–2220公尺、建議一天、鹿場主線陡坡及溪流、入山申請標示「否」。同頁總里程與分段行程數字不完全一致，本文不給精確全長或保證時間。|
|[玉山管理處：登山裝備](https://www.ysnp.gov.tw/StaticPage/Equipment)|個人與緊急維生裝備的參考。功能清單會依路線調整，不宣稱該頁列出的清單等於唯一「十大必備」。|
|[玉山管理處：高山生理、高山症預防及處理](https://www.ysnp.gov.tw/StaticPage/MountainSickness)|粗估海拔與氣溫遞減，及高海拔相關生理風險。體能及保暖裝備不能保證不發生高山症。|
|[玉山管理處：玉山群峰注意事項](https://www.ysnp.gov.tw/Trail/7fa5c242-df1a-4a8e-bcab-32dc55b1f7b6?Tab=5)|主峰風口碎石、強風、冬季冰雪；排雲住宿、供餐與睡袋另確認。|
|[國土測繪中心：玉山高度測量](https://www.nlsc.gov.tw/cp.aspx?n=1486)|主峰高程通用標示約3952公尺，精密測量有小數與測量誤差。遊戲不用小數營造導航精度。|
|[警政署：入山與入園許可差異](https://www.npa.gov.tw/ch/app/faq/view?id=2144&module=faq&serno=A1078887)|入園、入山是不同核准，玉山主要線涉及的保護區及山地管制要各別確認；非所有台灣步道一律需要兩證。|
|[臺灣登山申請一站式服務網](https://hike.taiwan.gov.tw/)|確認各管理機關分別審核的申請入口、床位與抽籤查詢。查閱時有新公告與雪季資訊，本文不把首頁歷史公告當成永久規定。|
|[一站式服務網：玉山申辦須知](https://hike.taiwan.gov.tw/notice_a1.aspx)|確認排雲申請與抽籤機制。抽籤日期、名額、外籍保留名額、費用、申請窗口均不寫死於遊戲。|
|[國家公園署：雪東線](https://www.taiwan.nps.gov.tw/home/zh-tw/trails/21209.html)|確認經東峰到主峰的路線，七卡與三六九為路線上的山莊名稱；官方介紹含三天兩夜安排。沒有把「雪山東峰」誤作山屋名。|
|[交通部觀光署：雪霸國家公園](https://www.taiwan.net.tw/m1.aspx?id=3268&print=1&sno=0001112)|交叉確認雪山主峰約3886公尺。|
|[雪霸管理處：單日往返雪山折返提醒](https://www.spnp.gov.tw/News_Content.aspx?n=14470&s=328952&sms=12570)|確認主峰線長程負擔與摸黑、濃霧、強降雨風險；本文不提供單攻玩法，也不把官方單攻特定折返時刻套到所有路線。|
|[雪霸管理處：最新消息](https://www.spnp.gov.tw/ch/specialreport/latest-news)|三六九重建及住宿變動須看公告，不能承諾現況有床。|
|[監察院：三六九山莊重建調查](https://www.cy.gov.tw/CyBsBoxContent.aspx?s=49454)|2026年公開調查顯示重建仍有後續追蹤。本次未取得可確認當日可入住的完成公告，因此不推定已啟用。|
|[太魯閣管理處：南湖大山線](https://www.taroko.gov.tw/ch/trailsAttractions/trail-list/58)|官方山峰表約3742公尺及沿線山屋資訊。山屋容量與供水易變動，本文不承諾床位或水量。|
|[雪霸管理處：山區短延時強降雨提醒](https://www.spnp.gov.tw/ch/specialreport/latest-news/2885)|雷擊、落石與溪水暴漲等風險，以及出發前查看氣象與路況的原則。|
|[太魯閣管理處：最新公告](https://www.taroko.gov.tw/ch/titlelist/news)|地震、颱風後的路線開放可能變動。遊戲卡片不是當日通行許可。|

仍需保留的限制：

- 山名不等於路線。本文每山只挑一種標準線，換起終點、支線或冬季模式須重新核對難度、申請與天數。南湖有資料使用約3740公尺，本文依太管處所列3742標成「約」，不宣稱最新精密測量值。
- 雪山的2天安排對部分隊伍負擔很重。三六九山莊重建及替代宿營可能改變行程，未核准就不出發。七卡不是「住了就一定能兩天輕鬆登主峰」的保證。
- 水量與保暖沒有所有人通用的固定數字。遊戲的1–3公升選項未涵蓋所有長程需求，正式行程須計入每段時間、流汗、水源與煮食。裝備重量為估值，非購買規格。
- 溫度候選值不是年均溫或極值範圍。寒流、逆溫、局部熱源、坡向及極端天氣可能超出；資料需將simulation_notice一路顯示在簡報。
- 申請門檻與保險要求可能因路線、活動、季節或法規變動，應連到當期官方公告。草稿沒有保存「目前開放」布林值，也不代替申請。
- 衛星設備受系統、服務區、天空遮蔽及電力影響；新增題只教確認送達。醫療處置沿用既有題庫教育方向，不靠虛構裝備效果改變急救原則。
- 題庫有些既有sources只有機關名稱，沒有連結。本文掛鉤不是對51題醫療與法規內容的全面重新審核；新增題均附官方背景連結，裝備變體仍需在正式實作時逐題校對。
