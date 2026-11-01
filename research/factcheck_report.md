# 登山安全情境題查核報告

查核日期：2026-11-01。原始資料共51題，逐題檢視情境、三個選項、answer、risk及解析。

## 交付狀態

本環境只允許寫入 `/workspace/digital-hiking/research` 與 `/tmp`，無法寫入指定的 `/workspace/digital-hiking/data/scenarios.json`。原檔未修改。已完成修正版 `scenarios.factchecked.json` 及差異檔 `scenarios.factcheck.patch`，均位於本報告同目錄。這是待套用結果，不能視為原檔已修正。

修正版共修改7題文字，44題保留。所有題目的schema、欄位順序、id、題序、answer及risk均不變。risk僅能判讀為遊戲的相對風險／代價分數，沒有官方資料可支持這些精確數值或把它們當事故機率；正答0分也不代表真實環境零風險，因此未任意調整分數。

在各題明定情境與三個完整選項下，修正後皆有唯一最適當答案。錯誤選項涉及增加事故風險、延誤處置、污染、違反管制或保障缺口，並非每項都直接造成身體傷害。

## 修改題目與理由

- 第7題 `check-hiking-boots`：「平底休閒鞋」本身不必然不安全。將錯誤選項限定為鞋底磨平、抓地不良，讓風險條件明確，避免以鞋款名稱判定對錯。
- 第14題 `first-aid-cut`：正確選項原本僅寫「沖洗」，補明使用乾淨飲用水或生理食鹽水，避免在溪邊情境誤用未處理溪水。
- 第15題 `hypothermia-blanket`：患者已有言語含糊與動作遲緩，原文「停止行進至」語意不清，可能誤導為要求患者自行走到遮蔽處。改為停止行程、輕柔協助移至鄰近遮蔽，並在遮蔽下換乾衣。
- 第18題 `emergency-call`：消防署支持112接通後依語音按9轉119。保留此操作，將「完全無任何業者訊號時仍可能不通」改為明確無法使用行動網路通話，消除仍可能靠112接通的誤解。
- 第21題 `hornet-warning`：原本蜂螫後僅提醒呼吸困難時求援，補明被螫後儘速就醫、多處螫傷及暈眩等警訊，避免誤解為沒有呼吸困難即可繼續行程。
- 第27題 `lost-stop-b`：原正確選項與說明只有規劃待援，未交代主動聯繫。補明無法確認路線時求援並回報位置，避免無人知悉的被動等待。
- 第30題 `emergency-location`：將「112轉9」寫成接通後依語音按9轉119，明確說明9是語音選單操作，不是另一組報案號碼。原有訊號限制及座標格式說明保留。

## 逐題結果

「保留」均指在題目限定情境下正答唯一、兩個錯誤選項有具體風險或代價。

| 題次 | id | 結果 | 判定重點 |
|---|---|---|---|
| 1 | `check-permits` | 保留 | 床位不等於入園或入山許可；依路線確認，非所有山區都須申請。 |
| 2 | `leave-trip-plan` | 保留 | 留守計畫須有路線、時間及逾時通報約定。 |
| 3 | `typhoon-route-check` | 保留 | 山下晴天及昨日預報不能取代最新山區警報。 |
| 4 | `ten-essentials` | 保留 | 十類為功能檢核；短程仍需照明、保暖及備援。 |
| 5 | `pack-for-rain` | 保留 | 背包套不能取代內部防水；重物須穩定靠背。 |
| 6 | `layer-clothing` | 保留 | 依活動增減衣物，避免汗濕或淋濕後受寒。 |
| 7 | `check-hiking-boots` | 修正 | 鞋底抓地狀況須符合濕滑路況。 |
| 8 | `check-insurance` | 保留 | 保險保障依條款；此題涉及保障缺口，risk不是受傷機率。 |
| 9 | `team-roles` | 保留 | 配速須顧及慢者，岔路集合；不能只靠訊息維繫隊伍。 |
| 10 | `download-offline-map` | 保留 | 離線底圖、路線與定位須預先測試。 |
| 11 | `pace-and-snacks` | 保留 | 過度喘促應減速休息，不能靠提神飲料硬撐。 |
| 12 | `water-source-safety` | 保留 | 清澈溪水仍有病原，淨水用品須符合用途並依說明使用。 |
| 13 | `rain-gear-early` | 保留 | 濕透前穿雨具，持續惡劣時撤退。 |
| 14 | `first-aid-cut` | 修正 | 小傷先止血，再用乾淨水沖洗並覆蓋。 |
| 15 | `hypothermia-blanket` | 修正 | 疑似失溫且神經功能異常應保暖求援，避免勉強步行。 |
| 16 | `phone-power` | 保留 | 飛航模式省電有條件，求援及回報時須關閉。 |
| 17 | `lost-stop` | 保留 | STOP、避開溪谷及避免分頭搜索均合理。 |
| 18 | `emergency-call` | 修正 | 112按9轉119正確，但不能突破完全無行動網路涵蓋的限制。 |
| 19 | `lnt-toilet-waste` | 保留 | 排遺依場域規範處理，果皮及衛生紙帶走。 |
| 20 | `black-bear-encounter` | 保留 | 本題是熊尚未靠近的情境；緩退、不投食、不爬樹合理。 |
| 21 | `hornet-warning` | 修正 | 未遭攻擊時安靜退離；群蜂攻擊時護頭頸迅速撤離。 |
| 22 | `thunder-ridge` | 保留 | 聞雷即撤離裸稜，孤立高樹不能作避雷處。 |
| 23 | `altitude-symptoms` | 保留 | 疑似AMS不可再上升；惡化須下降求援。 |
| 24 | `turnaround-time` | 保留 | 不得為拍照延後預定下撤時間或靠趕路補時。 |
| 25 | `headlamp-before-dark` | 保留 | 光線不足即使用頭燈，避免耗盡通訊手機電力。 |
| 26 | `heatstroke-descent` | 保留 | 高熱合併意識異常須疑似中暑處理，有汗亦不能排除。 |
| 27 | `lost-stop-b` | 修正 | 迷途停止移動之外，須主動聯繫求援及回報位置。 |
| 28 | `lost-gully` | 保留 | 溪谷可能接瀑布、陡壁，不能視作下山路。 |
| 29 | `lost-signal` | 保留 | 僅可在確認路線與安全往返下短移至已知通訊點。 |
| 30 | `emergency-location` | 修正 | 緊急通話狀態可試112；回報座標格式及里程有助定位。 |
| 31 | `flash-flood` | 保留 | 溪水混濁、漂流物為撤離警訊，不能在溪中大石待避。 |
| 32 | `unsafe-crossing` | 保留 | 漲水後停止渡溪；舊繩與人鏈無法保證安全。 |
| 33 | `falling-rock` | 保留 | 未進落石區即退避合理；頭盔不能消除落石威脅。 |
| 34 | `collapsed-trail` | 保留 | 封閉與持續滑落應停止通行，不能沿腳印繞越。 |
| 35 | `afternoon-thunder` | 保留 | 聞雷即放棄登頂，避免最高樹下停留。 |
| 36 | `ridge-gust` | 保留 | 先穩住、再安全退回；牽手互拉及撐傘會增加失衡風險。 |
| 37 | `wet-hypothermia` | 保留 | 失溫反應變差、不抖不代表好轉；禁酒及搓揉正確。 |
| 38 | `heatstroke-confusion` | 保留 | 疑似中暑須一面求援一面快速降溫，意識異常不餵水。 |
| 39 | `dehydration-rest` | 保留 | 清醒可吞嚥者分次補水，缺水時應縮短行程。 |
| 40 | `ams-turnaround` | 保留 | 持續AMS症狀未改善即停止上升、陪同下降。 |
| 41 | `severe-altitude` | 保留 | 靜息喘及步態、意識異常為嚴重高山病警訊，下降與救援優先。 |
| 42 | `ankle-sprain` | 保留 | RICE作短期初處置可保留；非完整復健方案，無變形仍可能骨折。 |
| 43 | `fracture-stay` | 保留 | 變形疑似骨折不拉直、不試走，支托固定並檢查末端循環。 |
| 44 | `snakebite-rescue` | 保留 | 未知蛇種且腫脹應減少活動固定送醫，不追蛇、不冰敷、不緊勒。 |
| 45 | `black-bear-distance` | 保留 | 熊未靠近且可退離時保持距離緩退，不奔跑或投食。 |
| 46 | `leech-wound` | 保留 | 已脫落山蛭的小傷口清潔加壓合理，不能用泥土或勒至發白。 |
| 47 | `monkey-no-feeding` | 保留 | 收好食物、不投餵、不搶奪可降低抓咬風險。 |
| 48 | `night-bivouac` | 保留 | 迷途天黑前準備安全露宿並通報，乾溪溝仍有洪水風險。 |
| 49 | `fog-junction` | 保留 | 霧中集合交叉核對位置，不能依布條數量或分組探路。 |
| 50 | `hut-camp-planning` | 保留 | 山屋入住、步道管制與適用許可須出發前確認。 |
| 51 | `rescue-signals` | 保留 | 待援時原地示意、保持回電，不自行下切追救援燈光。 |

## 重點查證與官方來源

- 112：消防署[報案專線119、112常見Q&A](https://www.nfa.gov.tw/cht/index.php?article_id=31&code=list&flag=detail&ids=21)及[救援案例與報案提醒](https://mag.nfa.gov.tw/article.php?id=3979)支持接通112後依語音按9轉119。須有相容行動網路涵蓋；112不是衛星電話。官方舊文仍出現3G/GSM用語，本次未將過時網路世代限制搬進題目。
- 入山與入園：警政署[申請差異說明](https://www.npa.gov.tw/ch/app/faq/view?id=2144&module=faq&serno=A1078887)及[入山申辦系統](https://nv2.npa.gov.tw/NM107-604Client/nV02A01Q_01_Action.do?method=doList&mode=query)。入山主要對應山地管制區；入園及自然保護區進入申請依個別範圍與管理規範，山屋訂位不能代替。
- 失溫：疾管署[高溫與酷寒](https://www.cdc.gov.tw/Category/ListContent/wL-8Abm9o5_5l4gSOR8M5g?uaid=_VBRPRbLJSqI9J9_wSjD2w)列出言語不清、意識混亂等警訊，須立刻保暖、乾爽並求醫。第15題修正使其與第37題避免勉強行走及輕柔搬動的處置一致。
- 中暑：國健署[熱傷害的診斷與處置](https://www.hpa.gov.tw/Pages/Detail.aspx?ccms_cs=1&nodeid=577&pid=10746)及[熱傷害急救處理](https://www.hpa.gov.tw/Pages/Detail.aspx?nodeid=577&pid=10751&sid=18379)。疑似中暑應快速降溫與求援，意識異常不餵水。診斷頁全文擷取曾回傳502，僅採可取得內容並交叉核對急救頁，未宣稱完整讀取該頁。流汗不能作為排除勞動型中暑的依據。
- 骨折及扭傷：健保署[肌肉拉傷、關節扭傷、脫臼及骨折](https://www.nhi.gov.tw/ch/cp-2758-39bb9-2951-1.html)。本題不自行復位、不測試行走的方向正確。RICE保留為短期處置，不宣稱是完整治療或長期復健原則。
- 蛇咬：健保署[蛇咬傷](https://www.nhi.gov.tw/ch/cp-2770-54417-2951-1.html)。官方衛教對包紮方式有差異，不把一般人加壓包紮列為未知蛇種且已腫脹情境的必要步驟；保留減少活動、固定、移除束縛及儘速送醫。不追捕、不切吸、不冰敷、不用細繩緊勒均合理。
- 黑熊：林業保育署[在山上遇到熊怎麼辦](https://www.forest.gov.tw/0009874)及玉山國家公園[與熊共存](https://www.ysnp.gov.tw/StaticPage/Coexist)。兩題都限定熊尚未靠近且可退離，不將緩退答案泛化為所有攻擊情境。
- 虎頭蜂：林業保育署[殺蟲劑防蜂風險提醒](https://www.forest.gov.tw/mailto/news/0074343)、[山上遇到虎頭蜂怎麼辦](https://www.forest.gov.tw/0009872)，以及臺北榮總[蜂螫之照護](https://ihealth.vghtpe.gov.tw/media/1165)。平靜退離與遭攻擊時迅速撤離有情境差異；多處螫傷即使未呼吸困難也須就醫。
- 雷擊：中央氣象署[天然災害災防問答集](https://www.cwa.gov.tw/Data/service/notice/download/publish_20200310092516.pdf)、保訓會[避免雷擊](https://www.csptc.gov.tw/News_Content.aspx?n=554&s=35166)及雪霸[山區天候安全提醒](https://www.spnp.gov.tw/ch/specialreport/latest-news/3693)。聞雷就撤離裸稜、不躲孤立高樹合理；原題未宣稱山洞、樹林、帳篷或緊急毯能保證避雷，故不擴寫。
- 高山病：疾管署[高山症](https://www.cdc.gov.tw/Category/ListContent/wL-8Abm9o5_5l4gSOR8M5g?uaid=Csksrnww6dJKa8if66If5g)。持續症狀不再爬高，步態不穩、意識異常或靜息喘應下降並緊急求援。
- 裝備、計畫與迷途：運動部[登山活動應注意事項](https://law.sports.gov.tw/LawContent.aspx?id=GL000058&media=print)、玉山[登山裝備](https://www.ysnp.gov.tw/StaticPage/Equipment)、國家公園署[迷途自救](https://www.taiwan.nps.gov.tw/home/zh-tw/topic/18576.html)及內政部[STOP與求援](https://www.moi.gov.tw/News_Content.aspx?Create=1&n=2&s=260664)。適用裝備依路況選擇，迷途須停止亂走並回報位置。
- 傷口清潔：衛福部[台灣ｅ院傷口問題衛教](https://sp1.hso.mohw.gov.tw/doctor/Often_question/type_detail.php?UrlClass=%E5%A4%96%E7%A7%91&q_type=%E5%82%B7%E5%8F%A3%E5%95%8F%E9%A1%8C)支持用清水或生理食鹽水清潔並覆蓋乾淨紗布。山區題目明定乾淨水，避免與未處理溪水混淆。

原JSON的sources是來源名稱而非完整引用；本次保留既有欄位，本報告補上可查證連結。保留題目代表未發現影響答案或安全的必要修正，不代表逐一認證所有既有來源名稱或所有分數。

## 驗證

已執行 `python3 -m json.tool /workspace/digital-hiking/research/scenarios.factchecked.json` 及 `python3 -m json.tool /workspace/digital-hiking/data/scenarios.json`，皆通過。另以Python逐筆比對51題的欄位、id、順序、answer、risk及選項數，確認僅7題文字有差異。

原檔SHA256為 `83bcf2f87d817dbb78907edfae2f1e16a28b49e1d6b40ddcf48a6e0488f7f856`。
