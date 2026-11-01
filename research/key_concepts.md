# 登山保命觀念涵蓋審查

查核日期：2026-11-01。這是教育題庫的內容審查與抽題建議，新增題尚未接入遊戲。

## 審查範圍與題數

逐題檢查 `../data/scenarios.json` 的 situation、三個 options、answer、why 與 sources，以及 `gear_data_draft/new_scenarios.json` 全部八題。主檔目前實際為 **59 題、59 個唯一 id**，不是51題；前51題之後已收錄草稿的八個 `prep-` id。兩檔聯集仍為59題，不能再把草稿八題追加一次。重疊題的選項、情境或來源格式部分不同，以主檔為目前正式版本，草稿只作交叉檢查。

下表「直接」表示正確選項或教學解說明確教到該觀念；「輔助」表示只教到裝備、預防或相鄰概念，不算完整涵蓋。錯誤選項提到某種做法，不等於已教完其正確處置。

## 各項觀念、缺口與來源

| 觀念 | 既有題 id 與實際內容 | 是否充分 | 缺口與新增題 | 官方依據 |
| --- | --- | --- | --- | --- |
| 1. 脫隊迷路先停；向上或向下 | 直接：`lost-stop` 停下定位、不下溪溝；`lost-stop-b` 脫隊停止求援；`lost-gully` 不下切未知溪谷；`lost-signal` 僅能沿確認安全路線到短程通訊點。 | 部分充分：已能阻止下切，但沒有「確定主徑在上方，才安全回溯」的選擇。 | 新增 `key-lost-up-or-down`，限定無雷雨、無傷病且來路可安全回走，優先往上回已知稜線主徑，不能概括成盲目登高。 | [S1]、[S2]、[S3]、[S5] |
| 2. STOP及待援與移動 | 直接：`lost-stop` 提STOP但未展開英文；`lost-stop-b` 有停止、思考、觀察、計畫；`lost-signal` 有安全短程移動；`night-bivouac` 天暗避風露宿。輔助：`prep-sat-sky` 確認衛星送達，不能冒險追訊號。 | 部分充分：概念已有，缺完整英文與決策順序，也缺待援點轉危險時如何處理。 | `key-stop-stay-or-move` 展開Stop, Think, Observe, Plan，安全處且回路不明就待援；`key-wait-relocation-note` 處理避險必要移位、留訊息與更新位置。 | [S1]、[S2]、[S8] |
| 3. 回最後確定路標或系結帶；不開路 | 直接：`fog-junction` 核對路標地圖，不憑舊布條數量；`collapsed-trail` 不自行闢路繞崩塌。輔助：`download-offline-map` 離線導航與紙圖備援；`team-roles` 不走捷徑。 | 不足：沒有安全原路回到最後確定標示的正面練習。 | `key-last-known-marker` 回先前確認的編號路標；系結帶只作交叉核對的路線線索，不能看見就跟。 | [S1]、[S4]、[S19] |
| 4. 119與112、回報、手機省電 | 直接：`emergency-call`、`emergency-location` 已教112按9轉119及須任一業者涵蓋，後者解說含人數、座標格式、回電；`phone-power` 飛航配離線定位、定時聯繫與電源防水；`rescue-signals` 保留可回電。輔助：`prep-sat-sky` 衛星備援需確認送達。 | 大致有核心，細節不足：缺亮度、非必要App活動、協調間歇開機與救援回電時段。 | `key-rescue-phone-power` 合併報位人數傷況、備援電源與省電；飛航或關機要先協調，不能錯過救援回電或中斷急救指導。補充行前確認VoLTE。 | [S5]、[S6]、[S7]、[S2] |
| 5. 待援保暖與可見 | 直接：`night-bivouac` 避風隔濕保暖；`rescue-signals` 原地哨音反光、不可追燈下陡坡。輔助：`hypothermia-blanket`、`wet-hypothermia` 為已發病處置，`ten-essentials`、`layer-clothing`、`pack-for-rain`、`rain-gear-early`、`prep-rainpants`、`prep-down-dry` 為裝備與濕冷預防。 | 部分充分：尚未整合保暖、亮色物、哨音節奏、頭燈與必要移位留言。 | `key-wait-warm-visible`、`key-wait-relocation-note`。安全優先於開闊；不可為可見而上裸稜或暴露於風雨。 | [S8]、[S9]；三聲節奏另見[S20]，不是官方唯一標準。 |
| 6. 預設折返、日落前返回、不執著登頂 | 直接：`turnaround-time` 已有預設最晚下撤、最慢隊員、日落與緩衝；`thunder-ridge`、`afternoon-thunder`、`prep-thunder-stop` 有危險即放棄登頂。輔助：`headlamp-before-dark` 是延誤照明，不能取代折返。 | 大致充分，但唯一時間題已在山頂。 | `key-turnaround-before-summit` 在ridge測驗未到頂也照約折返，避免只會「到頂別久留」。 | [S10]、[S11] |
| 7. 暴漲不強渡、上游雨 | 直接：`flash-flood` 當地沒雨但上游烏雲、溪濁漂木就撤溪床；`unsafe-crossing` 水急不渡、舊繩人鏈不保證安全。 | 大致充分：缺等水退的地點與等待後重評，以及不能沿未知溪岸找淺處。 | `key-flood-wait-retreat` 補安全等候、水退仍重評；改道或折返限確認安全通路，受困及早求援。 | [S12]、[S13] |
| 8a. 失溫先處置並安全後送 | 直接：`hypothermia-blanket` 停行保暖求援、避免勉強走、輕柔搬動；`wet-hypothermia` 反應變差不等於好轉、隔風隔地保暖。輔助：上述濕冷預防題。 | 病徵與當下處置充分，不能將下撤教成強制自行走。 | `key-hypothermia-evacuation` 明示有人陪護，先保護，再評估安全後送；中重度或意識異常不硬走。 | [S8]、[S9] |
| 8b. 高山症停升、及早下降、不留病人 | 直接：`altitude-symptoms`、`ams-turnaround` 症狀休息不改善就陪同下降；`severe-altitude` 步態不穩、休息仍喘、反應慢立即求援安排下降。 | 充分：已分初期與重症，明示不能獨留或獨走。 | 不再加同義題。高山症是降低海拔，失溫則先阻止散熱，兩者不能共用「讓患者立刻自己走下山」口訣。 | [S14]、[S15] |
| 9. 雷雨離裸稜、孤立高點、不躲孤樹 | 直接：`thunder-ridge`、`afternoon-thunder`、`prep-thunder-stop` 均有聽雷即放棄登頂，孤立大樹為錯誤避難處。 | 充分且有同義重複。 | 不新增。同趟至多抽一題，避雷下撤也須排除溪洪、落石危險。 | [S16]、[S13] |
| 10a. 留守、申請與取消 | 直接：`leave-trip-plan` 路線、隊員、時程、撤退、逾時通報；`check-permits` 逐項確認核准；`hut-camp-planning` 管制與住宿不能臨場賭；`typhoon-route-check` 查最新山區氣象並必要取消；`prep-postpone` 封閉改期。 | 充分。申請不等於安全保證，無需許可的步道也要留行程。 | 不新增，納入行前保證抽題池。預定聯絡、變更及平安下山回報皆屬留守制度。 | [S2]、[S11]、[S12]、[S17] |
| 10b. 不獨攀、不拆隊、不丟下人 | 直接：`team-roles` 領隊殿後、慢者配速、岔路集合；`altitude-symptoms`、`ams-turnaround`、`severe-altitude` 不獨留或獨走；`lost-stop-b` 落單不追。 | 大致充分：不獨攀偏隱含於團隊情境。 | 不為口號另加題；文件明確建議結伴，遇傷病留人陪護。通訊可用時先對外求援，不讓全隊離開患者。 | [S2]、[S4]、[S15] |
| 10c. 受傷與突發倒地 | 直接：`first-aid-cut` 加壓清潔；`ankle-sprain` 停負重評估；`fracture-stay` 安全現場不亂搬、不復位；`snakebite-rescue` 減活動固定求援；`leech-wound` 清潔直接加壓。 | 局部傷勢充分，缺成人無反應、無正常呼吸的急救辨識，這是不可省的缺口。 | `key-collapse-cpr` 在安全現場立即求援CPR，不先背下山、不灌水。重傷持續監測呼吸、處理嚴重出血，搬移須有必要且避免二次傷害。 | [S8]、[S18]、[S21]、[S22] |
| 10d. 補給、熱傷害與地形能力 | 直接：`pace-and-snacks` 不追隊耗竭；`water-source-safety`、`dehydration-rest` 缺水縮程、不生飲；`heatstroke-descent`、`heatstroke-confusion` 高熱意識異常立即求援降溫、不灌水；`falling-rock`、`collapsed-trail` 不強行；`ridge-gust` 先穩住再退；`prep-ice-turn` 無雪地訓練不硬過。輔助：`prep-water-plan` 供水不保證；`prep-overpack` 安全功能不能因減重刪掉；`check-hiking-boots` 鞋底檢核；`ten-essentials` 備援功能。 | 本次核心安全選擇大致充分，裝備不能替代路況與能力。 | 不新增同義題。熱傷害、落石、結冰等可作核心池以外的情境加抽；急救操作仍須實作訓練。 | [S4]、[S9]、[S12]、[S13] |

## 易誤教措辭的查證結論

1. 先停止擴大迷途範圍，再判斷是否能安全回到最後確定的步道。內政部[S1]寫明不能回原路就留下待援；新竹縣政府所載消防救援經驗[S3]支持沿稜線方向的求生思路，但不能把該報導的找路建議套用為人人都要上攀。新增題將「優先往上」限於已知主徑在上方、可確認安全來路且天候體力允許的情境。雷雨、傷病與陡崖會推翻此移動選擇。
2. 不要輕易下切未知溪谷或沿溪找出口。國家公園署[S2]要求迷途時不要下切；溪谷可能有瀑布斷崖，也可能較難通訊、撤離和搜救。這些是地形風險，不是每條溪谷必然沒訊號，亦不是禁止沿已知、開放且安全的正式步道下山。[S5]也說明山區通訊受地形等因素影響。不能以「河水流向山下」推出「沿溪可安全下山」。
3. 回最後確定的路標或系結帶，前提是能辨識安全來路。系結帶是路線標示線索，可能老舊、誤綁、通往支線；林業保育署[S4]連簡易路標都要求搭配地圖與現地判讀。不得拿手機直線箭頭橫切山坡，也不新增布條當作常規行前措施。
4. 手機顯示無自家訊號仍可試112，接通後按9轉119；不是「完全無任何電信訊號也一定通」。[S5][S6]支持此區分。飛航模式與關機會阻斷通聯，必須在聯絡需求容許且與救援約妥的空檔採用，沒有回電安排就不能逕自整夜關機。間歇開機、停用非必要App活動是本審查依保電與通聯需求提出的操作建議，並非上述官方逐字口訣，也不保證特定續航。
5. STOP的Think可譯思考或回想，Observe包括現地危險、資源與天候，Plan不只「繼續往哪走」，也包括待援與補給分配。原地已安全且位置回報後就維持位置；若有立即落石或洪水危險，安全優先，作必要短移並補報。留紙條限安全可行，不能返回險地留言。[S1][S8]
6. 開闊要加上安全、避風與不受雷擊溪洪落石威脅。頭燈、亮色物及哨子可增加辨識；三聲一組、停聽是登山教學[S20]的做法，本次未找到上述臺灣中央官方頁面明訂三聲為唯一求救信號，因此不冒稱官方統一規定。官方[S8]支持聲光標誌，不能把三聲與完整SOS摩斯碼混為一談，也不要追聲光下切。
7. 失溫與高山症都須停止原行程、不能續攻更高處或獨留患者，但處置不同。失溫先隔風隔濕、保暖與求援，評估離開寒冷環境及後送，反應遲鈍者不硬走。疑高山症先停升，症狀持續不改善或惡化下降；重症立即求援並協助安全下降，不能等過夜或靠藥物續爬。[S8][S9][S14][S15]
8. 「日落前下山」用於規劃日間健行；多日路線則以天黑前抵達當日安全宿點、各段另訂折返時間。不是叫受困者為趕日落冒險夜闖。新時間題明確是日間往返，不拿頭燈當延後折返的理由。[S10][S11]

## 官方來源與適用範圍

以下均已以網路搜尋核對內容；S20是補充登山教學，另列來源性質。多數既有題的sources只有機關與文章名稱，不能視為已附可直接查核的URL。本次新增題使用實際URL，不修改原題。

- S1 [內政部：登山迷途勿驚慌！牢記STOP口訣並求援](https://www.moi.gov.tw/News_Content.aspx?Create=1&n=2&s=260664)。STOP、回路不能確認即待援、避免溪谷及保暖計畫。
- S2 [國家公園署：在國家公園登山迷途怎麼辦？聰明自救保平安](https://www.taiwan.nps.gov.tw/home/zh-tw/topic/18576)。團隊留守、離線導航與電源、迷途止步和不下切。
- S3 [新竹縣政府：1人1狗登山失蹤，竹縣消防局順利尋獲](https://www.hsinchu.gov.tw/News_Content.aspx?n=153&s=153883)。消防救援人員談稜線求生；屬案例經驗，不是無條件攀高命令。
- S4 [林業保育署：自然步道常見問答](https://www.forest.gov.tw/faqs/trail?p=11)。結伴、循指標、不自闢路；簡易路標不可作唯一判路資訊。
- S5 [林業保育署：山區手機可通訊點標示，更新至115年2月](https://www.forest.gov.tw/0004548/0078318)。通訊受地形等影響；任一電信涵蓋、112轉9及VoLTE條件。
- S6 [消防署：119、112](https://www.nfa.gov.tw/cht/?code=list&ids=66)。消防求救與跨業者緊急通話。
- S7 [觀光署東北角及宜蘭海岸管理處：淡蘭國家綠道路線地圖下載](https://danlantrail.necoast-nsa.gov.tw/map-list.aspx?a=2868&l=1&r=65409622)。離線地圖教學的省電提醒含降低亮度、飛航及行動電源。
- S8 [玉山管理處：維生待援守則](https://www.ysnp.gov.tw/StaticPage/Survival)。自保、防二次事故、保暖、原地待援、聲光標誌與字條；本文未採其舊式通訊頻率或用火訊號建議。
- S9 [陽明山管理處：登山安全注意事項](https://www.ymsnp.gov.tw/ch/titlelist/mountaineering-precautions/19)。迷途、濕冷耗竭與失溫、隔地覆蓋保暖及行前裝備。
- S10 [雪霸管理處：秋季登山安全提醒](https://www.spnp.gov.tw/ch/specialreport/latest-news/3856)。事前約撤退時間、替代路線及緊急聯絡，重視隊員狀況。
- S11 [玉山管理處：生態保護區登山計畫書範例](https://hike.taiwan.gov.tw/nationpark/manasystem/news/files/news/91b15a33-e82e-40e0-be6d-0e86da92814a.pdf)。行前風險、留守通聯時段、避免落單與安全撤退。
- S12 [林業保育署南投分署：雨季入山活動請小心注意安全](https://www.forest.gov.tw/news/0078616)。行前準備、溪水混濁水升就撤安全處、避免獨行。
- S13 [雪霸管理處：近期天氣不穩定，上山前請留意氣象預報並做好準備](https://www.spnp.gov.tw/ch/specialreport/latest-news/2885)。短延時強降雨、雷擊落石溪洪與取消調整。
- S14 [國家公園署：體力好也可能會高山症，緩慢爬升及早下撤](https://www.taiwan.nps.gov.tw/home/zh-tw/news/33929.html)。症狀持續惡化就下降、不可繼續升高。
- S15 [疾管署：高山症](https://www.cdc.gov.tw/Category/ListContent/wL-8Abm9o5_5l4gSOR8M5g?uaid=Csksrnww6dJKa8if66If5g)。醫療主管機關補強：初期不再升高，重症立即下降，患者不可落單。
- S16 [保訓會：安全維護宣導，避免雷擊](https://www.csptc.gov.tw/News_Content.aspx?n=554&s=35166)。稜線、高地與孤立大樹危險；官方補強雷擊行動措辭。
- S17 [臺灣登山申請一站式服務網](https://hike.taiwan.gov.tw/)。各管理機關申請入口；依路線當期公告核對，非所有路線都需同一許可。
- S18 [消防署：大家不可不會的CPR，民眾版成人心肺復甦術](https://www.nfa.gov.tw/cht/index.php?article_id=905&code=list&flag=detail&ids=21)。無反應、無正常呼吸、119線上指導與CPR，不等AED。
- S19 [林業保育署：自然步道路標使用說明](https://www.forest.gov.tw/faqs/trail?p=11)。與S4同頁，特別支持地圖交叉核對，不盲信單一標示。
- S20 [健行筆記：給剛爬山的人第7篇](https://tw.hiking.biji.co/index.php?act=info&id=3450&q=news)。非官方的登山教學補充；搜尋結果可核對三聲一組、停止聽回應，本次全文開啟失敗，不用它支撐其他醫療或地形結論。
- S21 [衛福部：民眾版心肺復甦術參考指引，成人流程圖](https://dep.mohw.gov.tw/DOMA/dl-13882-22bd0839-e9ad-45b6-8665-1bdd2344446a.html)。成人按壓頻率深度、正常呼吸分流與AED。
- S22 [我的E政府：臺灣全民安全指引](https://www.gov.tw/News_Content_26_843106)。重傷現場安全、嚴重出血與必要搬運。

## 逐題核對紀錄

此節保留主檔59題的逐題判讀，避免只按id猜測。數字對應上方觀念編號；「相鄰」不代表已充分教完所有處置。

| 主檔序號 | id | stage | 讀取情境、答案與解說後的涵蓋判定 |
| --- | --- | --- | --- |
| 1 | `check-permits` | trailhead | 10a：山屋訂位不等於入園、入山核准。 |
| 2 | `leave-trip-plan` | trailhead | 10a：完整行程交留守人，變更與下山回報。 |
| 3 | `typhoon-route-check` | trailhead | 10a：山下晴也查山區颱風路況，必要取消。 |
| 4 | `ten-essentials` | trailhead | 5、10d輔助：短程也備導航保暖照明急救功能。 |
| 5 | `pack-for-rain` | trailhead | 5輔助：乾衣電子用品分袋防水，雨具急救易取。 |
| 6 | `layer-clothing` | trailhead | 5、8a輔助：排汗與分層增減、備乾衣。 |
| 7 | `check-hiking-boots` | trailhead | 10d：鞋底開裂換鞋，不能用裝備賭路況。 |
| 8 | `check-insurance` | trailhead | 相鄰：查保險承保，非直接自救處置。 |
| 9 | `team-roles` | trailhead | 10b、3輔助：領隊殿後、慢者配速、岔路集合不抄捷徑。 |
| 10 | `download-offline-map` | trailhead | 3、4輔助：下載測試離線圖、紙圖指北針備援。 |
| 11 | `pace-and-snacks` | forest | 10d：追隊耗竭，降速補給縮程。 |
| 12 | `water-source-safety` | forest | 10d：供水不足縮程，溪水須淨化。 |
| 13 | `rain-gear-early` | forest | 5、8a輔助：濕透前穿雨具並評估撤退。 |
| 14 | `first-aid-cut` | forest | 10c：擦傷加壓、清潔覆蓋。 |
| 15 | `hypothermia-blanket` | forest | 8a：含糊發抖警訊，保暖求援、輕柔搬動不硬走。 |
| 16 | `phone-power` | forest | 4：飛航可離線定位，回報求援需關飛航。 |
| 17 | `lost-stop` | forest | 1、2：不知來路就停定位求援，不下溪溝。 |
| 18 | `emergency-call` | forest | 4：119不通試112轉9，任一業者涵蓋才可通。 |
| 19 | `lnt-toilet-waste` | forest | 相鄰：如廁垃圾衛生與無痕山林，非本次核心處置。 |
| 20 | `black-bear-encounter` | forest | 相鄰：遇熊不跑不餵、緩退。 |
| 21 | `hornet-warning` | forest | 相鄰及10c：蜂警戒循來路退，呼吸意識異常求援。 |
| 22 | `thunder-ridge` | ridge | 9、6：聽雷停止登頂，離裸稜孤立高點。 |
| 23 | `altitude-symptoms` | ridge | 8b、10b：高山症停升、未改善陪同下降。 |
| 24 | `turnaround-time` | summit | 6：已到頂遵守最晚下撤，按日落與慢者留緩衝。 |
| 25 | `headlamp-before-dark` | descent | 6輔助：提早用頭燈、集合通報，不加速追天光。 |
| 26 | `heatstroke-descent` | descent | 10d、10c：高熱恍神即求援降溫，意識不清不灌水。 |
| 27 | `lost-stop-b` | ridge | 1、2、10b：脫隊不追，STOP中文與安全處求援。 |
| 28 | `lost-gully` | descent | 1：溪聲不代表出口，不下切未知瀑布陡壁。 |
| 29 | `lost-signal` | ridge | 1、2、4：僅安全往返已知通訊點，不能盲目攀高。 |
| 30 | `emergency-location` | summit | 4：座標格式、路線里程、人數傷況回電與112限制。 |
| 31 | `flash-flood` | descent | 7：下游無雨仍有上游洪水，濁水漂木就撤溪床。 |
| 32 | `unsafe-crossing` | descent | 7：不試水不信人鏈舊繩，退安全處評估求援。 |
| 33 | `falling-rock` | ridge | 10d：持續落石退範圍外，頭盔不代表可通。 |
| 34 | `collapsed-trail` | descent | 3、10d：崩塌封閉不闢路，腳印草根非安全證據。 |
| 35 | `afternoon-thunder` | summit | 9、6：聽雷放棄登頂，不等下雨不躲孤樹。 |
| 36 | `ridge-gust` | ridge | 10d：強風失衡先穩住再退，不牽手硬過。 |
| 37 | `wet-hypothermia` | ridge | 8a：反應慢與不再抖非好轉，隔濕保暖求援。 |
| 38 | `heatstroke-confusion` | summit | 10d、10c：流汗不能排除中暑，快降溫不灌水。 |
| 39 | `dehydration-rest` | ridge | 10d：缺水休息分次補充，縮短行程不硬撐。 |
| 40 | `ams-turnaround` | summit | 8b、10b：持續頭痛噁心不續升，陪同下撤不獨留。 |
| 41 | `severe-altitude` | ridge | 8b、10b：重症立即求援安全下降，不能獨走。 |
| 42 | `ankle-sprain` | descent | 10c：停負重初步處理，無變形仍可能骨折。 |
| 43 | `fracture-stay` | descent | 10c：現場安全不亂搬、不拉直復位，固定求援。 |
| 44 | `snakebite-rescue` | descent | 10c：蛇咬固定減活動求援，不追蛇冰敷勒綁。 |
| 45 | `black-bear-distance` | forest | 相鄰：遇熊保持距離、不餵緩退。 |
| 46 | `leech-wound` | descent | 10c：山蛭脫落後直接加壓，不上泥土不勒白。 |
| 47 | `monkey-no-feeding` | summit | 相鄰：猴群不投食、收食物垃圾。 |
| 48 | `night-bivouac` | ridge | 2、5：天暗選安全避風露宿，避溪床崩塌邊。 |
| 49 | `fog-junction` | ridge | 3、10b：集合核對圖路標，布條顏色數量非保證。 |
| 50 | `hut-camp-planning` | trailhead | 10a：住宿管制確認，不臨場通融占步道。 |
| 51 | `rescue-signals` | descent | 4、5：原地聲光示意，留電回電不追燈下陡坡。 |
| 52 | `prep-postpone` | trailhead | 10a：封閉改期，裝備不能替代許可。 |
| 53 | `prep-rainpants` | forest | 5、8a輔助：穿雨褲避免下身濕冷並評估撤退。 |
| 54 | `prep-down-dry` | ridge | 5、8a輔助：保暖羽絨層保持乾燥。 |
| 55 | `prep-ice-turn` | ridge | 10d：結冰且無雪訓不硬過，受困求援。 |
| 56 | `prep-water-plan` | trailhead | 10d：山屋缺水重算攜水、改行程。 |
| 57 | `prep-thunder-stop` | summit | 9、6：雨衣不防雷，離山頂不躲孤樹。 |
| 58 | `prep-sat-sky` | forest | 2、4輔助：衛星未送達不能當已報案，不爬崖追訊號。 |
| 59 | `prep-overpack` | trailhead | 10d輔助：負重過量減非必要物，保留安全功能。 |

### 草稿八題逐題交叉核對

以下八題在兩檔都有相同id且核心答案相同；並非八道未收錄新題。草稿sources用URL，主檔多改為名稱，部分主檔選項已加長。

| 草稿id | 主檔序號 | 草稿與正式版的實際差異及判讀 |
| --- | --- | --- |
| `prep-postpone` | 52 | 同為封閉改期，主檔把錯誤選項擴寫；涵蓋10a。 |
| `prep-rainpants` | 53 | 同為安全穿雨褲評估撤退，主檔擴寫省略的情境選項；輔助5與8a。 |
| `prep-down-dry` | 54 | 草稿休息前背包進水，主檔補走熱脫下收包；均教保暖層防水；輔助5與8a。 |
| `prep-ice-turn` | 55 | 草稿正解明寫安全原路退回，主檔為「能撤就退」；均不跨無訓練冰面；10d。 |
| `prep-water-plan` | 56 | 草稿錯誤選項取湖水，主檔改較廣泛水邊生飲；均重算水量改行程；10d。 |
| `prep-thunder-stop` | 57 | 草稿正解明寫沿安全路線離開，主檔縮為立刻離開；均不留高點不躲孤樹；9。 |
| `prep-sat-sky` | 58 | 草稿「安全範圍嘗試」與主檔「安全處再試」同義，均確認送達省電；輔助2與4。 |
| `prep-overpack` | 59 | 草稿明寫減非必要物與分工，主檔簡寫分工減量；均保留安全功能；10d。 |

## 新增題與驗證

`key_scenarios.json`新增10題。答案位置0、1、2分別4、3、3題；每題三選項的字數最大差距不超過2字，正解不固定最長。選項用常見但錯誤的動機，如節省體力、趕日落、等訊號、追人或保住定位，避免只有荒謬答案可排除。

- 全部沿用既有category及stage值，id以`key-`開頭，另有`key: true`。
- why每題2至4句，清楚指明官方依據；三聲哨音的補充來源另行說明，沒有冒充官方統一標準。
- risk是遊戲教學分數，非實測死亡率或官方危險量表；正解0，錯解24至28。
- 執行`python3 -m json.tool key_scenarios.json`確認合法JSON；另驗證id格式、不與兩份輸入重複、三選項、答案範圍、風險整數及title長度。
- 原始主檔59個唯一id，草稿8個唯一id且全部重疊；新增10題互不重複，三檔聯集為69個唯一id。未改動data或js。

## must-appear保命題與每趟保證抽題規則

這是14題核心候選清單，並非要求每趟14題全出。既有題不寫入key_scenarios.json重複建檔，未修改既有題的key欄位；抽題實作應使用本清單明列的id與觀念對照，而非只看新增題的key值。

| id | 既有或新增 | 保命觀念 | 題目原stage | 路線適用與限制 |
| --- | --- | --- | --- | --- |
| `leave-trip-plan` | 既有 | 10a 完整計畫、留守逾時通報 | trailhead | 全山。 |
| `typhoon-route-check` | 既有 | 10a 最新氣象、惡劣取消 | trailhead | 全山，情境須允許討論颱風接近。 |
| `team-roles` | 既有 | 10b 領隊殿後、慢者配速、不拆隊 | trailhead | 全山。 |
| `key-lost-up-or-down` | 新增 | 1 先停、安全回到上方已知主徑、不下溪谷 | ridge | 全山的假設迷途情境；上回條件須保留，實際雷雨不可套用。 |
| `key-stop-stay-or-move` | 新增 | 2 STOP完整順序、安全處待援 | forest | 全山，forest可依既有forest_label顯示步道路段。 |
| `key-last-known-marker` | 新增 | 3 回最後確定路標、布條交叉核對 | forest | 有實際編號路標或相應路線標示的情境。 |
| `key-rescue-phone-power` | 新增 | 4 112與119、位置人數傷況、約通聯、省電 | forest | 全山，不保證緊急電話在完全無訊號處接通。 |
| `key-wait-warm-visible` | 新增 | 5 安全處保暖、聲光亮色示意、固定待援 | descent | 全山的延誤待援情境。 |
| `key-turnaround-before-summit` | 新增 | 6 未登頂也守折返時間、不靠頭燈賭 | ridge | 日間返程安全的攻頂日；多日非攻頂路段不硬套此題。 |
| `key-flood-wait-retreat` | 新增 | 7 上游雨、不強渡、安全等退水、受困求援 | descent | 僅has_stream=true且行程實有渡溪或溪洪暴露。 |
| `key-hypothermia-evacuation` | 新增 | 8a 保暖求援、陪護、安全後送、不硬走 | ridge | 所有山均可失溫，不能因低海拔排除。 |
| `severe-altitude` | 既有 | 8b 重症立刻求援下降、不可獨走 | ridge | 僅high_altitude=true。 |
| `thunder-ridge` | 既有 | 9 聽雷即撤裸稜高點，不躲孤樹 | ridge | 有雷雨與裸露路段的情境；三道同義雷題同趟至多一題。 |
| `key-collapse-cpr` | 新增 | 10c 無反應無正常呼吸，立即求援CPR | forest | 全山。 |

### 保證抽題順序

1. 先依山的實際路線與當趟情境過濾，再保留stage名額，最後抽一般題。建議每趟至少4道保命題，涵蓋4種主要觀念，不讓純隨機或既有priority_ids先占完位置。只計每題的主要觀念一次，不能把一題的解說拆算成三道保命題。
2. 基本四個名額：trailhead選一道人員或行前預防題；forest選一道人命急救、迷途或通訊題；ridge選`key-turnaround-before-summit`；descent選`key-wait-warm-visible`。四個名額保證行前、途中、折返、待援都有出現。日間無攻頂情境時ridge名額改為本清單的安全決策題，將折返觀念放入相符的行程設定教學，不偽造已到頂。
3. 高海拔路線再保留一個ridge名額給`severe-altitude`；與既有`altitude-symptoms`或`ams-turnaround`合計至少一題高山症，原則同趟不重複同一AMS解法。實有渡溪風險再保留一個descent名額給`key-flood-wait-retreat`，可與`unsafe-crossing`輪替。此時最低為5題；若兩種風險兼有則最低6題，須先檢查stage容量。
4. 遊戲若產生雷雨，額外確保`thunder-ridge`或同義題一題，優先用尚餘ridge或summit名額。只有summit名額時用既有`afternoon-thunder`，不直接把ridge題的stage改掉。不得讓迷途往上題的安全回溯答案，被套到同時雷雨的裸稜狀態。
5. 各觀念池跨趟輪替尚未見過者；同id不重抽，同一概念如雷雨、STOP、AMS避免被不同id重複占滿。首次體驗優先STOP與求救，後續補路標、向上回溯、失溫、CPR。`key-wait-relocation-note`與`key-flood-wait-retreat`以外的既有同義題可輪替加抽；替代題須逐題確認仍教到缺口，不是光看category一致。
6. 抽完核對數量、不同觀念、stage容量與相容性；不足時在相同stage以相容核心題替換一般題，不回填已排除的溪洪或高山症題。無足夠相容題時記錄缺額並用相符安全教學補位，不能默默宣稱已達保證。

### 與目前六座山設定相容

此處只讀取`../data/mountains.json`既有route_flags、stage_counts與路線描述，作遊戲設定相容性審查，不代表重新核准路線、確認開放或保證當日安全。旗標及路線仍須行前核對公告。

| 山id | 題數容量，依trailhead/forest/ridge/summit/descent | 最低保證與特殊限制 |
| --- | --- | --- |
| `qixing` 七星山 | 1/2/1/1/2，共7 | 基本4題；has_stream=false排除所有實際溪邊、渡溪題，high_altitude=false排除AMS。迷途下切溪谷可作誤選方向，不暗示主線必經溪床。 |
| `hehuan` 合歡山 | 1/1/2/1/2，共7 | 基本4加高山症1，共5；forest只有一格，在STOP、求救、CPR間跨趟輪替。has_stream=false排除溪洪。 |
| `jiali` 加里山 | 2/3/2/1/2，共10 | 基本4加渡溪1，共5；has_stream=true，descent兩格可容納待援與溪洪。high_altitude=false不抽AMS。 |
| `yushan` 玉山 | 2/2/3/2/2，共11 | 基本4加高山症1，共5；has_stream=false不因高山有溪谷就抽渡溪。多日行程的折返時間按攻頂日設定，其他日保留天黑前到宿點餘裕。 |
| `xueshan` 雪山 | 2/3/3/2/2，共12 | 基本4加高山症1，共5；has_stream=false排除溪洪；迷途題可用森林情境，失溫不因季節暖就排除。 |
| `nanhu` 南湖大山 | 2/3/3/2/3，共13 | 基本4加高山症1，共5；has_stream=false按現設定排除渡溪，長程另加待援露宿或必要移位留言題。 |

`flash-flood`、`unsafe-crossing`、`key-flood-wait-retreat`都屬實際溪水情境，has_stream=false必須排除。`lost-gully`、`lost-signal`及`key-lost-up-or-down`的溪谷則是迷途後的錯誤方向選擇，不要求路線實際涉溪；仍須保留安全來路、天候與體力限制。`key-last-known-marker`目前情境指編號路標，若特定路段未有可對應標示，改用STOP題，不假造現地設施。
