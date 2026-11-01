"""重建本目錄的資料草稿與規格附表；只讀取現有題庫，不修改遊戲。"""
import json
from pathlib import Path
ROOT=Path(__file__).resolve().parent
STAGES=['trailhead','forest','ridge','summit','descent']
def write(name,obj):
 (ROOT/name).write_text(json.dumps(obj,ensure_ascii=False,indent=2)+'\n')
mountain_rows=[
 ('qixing','七星山主峰',1120,805,[0.5,1],1,[1,2,1,1,2],['check-hiking-boots','fog-junction','ridge-gust','headlamp-before-dark'],'小油坑至主峰原路往返；石階、草原裸稜','郊山入門，也要準備風雨備援。','一般開放步道通常免入園、入山申請；不含另有管制的保護區。無住宿安排。',['濃霧','濕滑石階','強風','雷擊'],[1,2], 'https://www.ymsnp.gov.tw/ch/sglarticle/trail-classification'),
 ('hehuan','合歡山主峰',3417,3200,[0.5,1],2,[1,1,2,1,2],['altitude-symptoms','ridge-gust','afternoon-thunder','ams-turnaround'],'台14甲線主峰登山口原路往返；舊道路、開闊坡面','步程短，高海拔與低溫仍須認真準備。','一般合歡主峰步道通常免入園及入山申請；仍須查道路、雪季及步道管制。住宿若有需另訂。',['高山症','失溫','強風','雷擊','結冰'],[1,2], 'https://www.taroko.gov.tw/ch/listicle/faq/350'),
 ('jiali','加里山',2220,1350,[1,1],3,[2,3,2,1,2],['download-offline-map','lost-stop','ankle-sprain','unsafe-crossing','headlamp-before-dark'],'鹿場主線原路往返；森林、樹根、溪流及近頂陡坡','長日中級山，留足折返與照明餘裕。','山林悠遊網列入山申請「否」，一般主線通常免入園；沿線避難設施不可當作已預約住宿。查新竹分署最新公告。',['迷途','濕滑樹根','扭傷','溪水暴漲','摸黑'],[2,3], 'https://recreation.forest.gov.tw/Trail/RT?tr_id=043'),
 ('yushan','玉山主峰',3952,2600,[2,2],4,[2,2,3,2,2],['check-permits','hut-camp-planning','falling-rock','ams-turnaround','headlamp-before-dark'],'塔塔加經排雲山莊原路往返；山腰步道、碎石風口','兩天行程也要有高度適應與撤退計畫。','主峰線需入園，並確認入山核准；排雲住宿名額須依公告申請及抽籤，床位、餐食與租借分別確認。',['高山症','失溫','碎石落石','雷擊','冰雪'],[2,3], 'https://www.ysnp.gov.tw/Trail/7fa5c242-df1a-4a8e-bcab-32dc55b1f7b6?Tab=5'),
 ('xueshan','雪山主峰',3886,2140,[2,3],4,[2,3,3,2,2],['hut-camp-planning','fog-junction','severe-altitude','wet-hypothermia','night-bivouac'],'武陵雪山登山口經東峰、黑森林及圈谷原路往返','穿越森林到圈谷，天候與過夜準備都重要。','需入園；入山需求依當期警政管制範圍核對。七卡山莊、三六九山莊相關營地或替代住宿須依核准安排；三六九重建期間不可預設有床。',['高山症','黑森林迷途','失溫','冰雪','長程疲勞'],[2,3], 'https://www.taiwan.nps.gov.tw/home/zh-tw/trails/21209.html'),
 ('nanhu','南湖大山',3742,1950,[4,5],5,[2,3,3,2,3],['check-permits','hut-camp-planning','ridge-gust','falling-rock','night-bivouac','severe-altitude'],'勝光或思源一帶核准起點，經雲稜、五岩峰、圈谷往返；長程負重、岩稜','多天遠程考驗，撤退餘裕比登頂更重要。','進入生態保護區須入園；入山另依警政公告核對。雲稜、圈谷山屋或營地須核准，不保證現場有位。',['五岩峰暴露地形','強風','碎石坡','高山症','失溫','救援距離'],[2,3], 'https://www.taroko.gov.tw/ch/trailsAttractions/trail-list/58'),
]
# 溫度是遊戲行程清晨至白天的候選包絡；不是測站平均。
temps={
'qixing':[[10,22],[19,30],[12,25],[2,16]],
'hehuan':[[-2,12],[6,18],[0,14],[-8,7]],
'jiali':[[7,21],[15,27],[8,23],[-1,15]],
'yushan':[[0,14],[7,20],[1,16],[-6,10]],
'xueshan':[[3,17],[10,23],[4,19],[-4,12]],
'nanhu':[[4,18],[11,24],[5,20],[-3,13]]}
# 每季：降雨機率的抽樣範圍；平均風速 m/s 的候選範圍。
rain={'north':[[40,80],[30,70],[30,75],[40,85]],'high':[[25,65],[35,75],[15,55],[15,55]],'middle':[[35,75],[40,80],[20,60],[20,60]]}
wind={'north':[[2,9],[1,7],[3,11],[4,13]],'high':[[3,12],[2,10],[3,13],[4,16]],'middle':[[1,7],[1,6],[2,8],[2,10]]}
seasons=['spring','summer','autumn','winter']
base_hazards={
'spring':dict(thunder=0.10,front=0.30,typhoon=0.00,fog=0.35,ice=0.12,gust=0.15),
'summer':dict(thunder=0.40,front=0.10,typhoon=0.10,fog=0.25,ice=0.00,gust=0.10),
'autumn':dict(thunder=0.10,front=0.15,typhoon=0.08,fog=0.30,ice=0.08,gust=0.25),
'winter':dict(thunder=0.01,front=0.35,typhoon=0.00,fog=0.35,ice=0.50,gust=0.35)}
mountains=[]
for mid,name,z,z0,days,stars,quota,priority,terrain,intro,permits,risks,water,source in mountain_rows:
 profile='north' if mid=='qixing' else 'middle' if mid=='jiali' else 'high'
 scale={'qixing':{'fog':1.3,'ice':0.03,'gust':1.2},'jiali':{'fog':1.2,'ice':0.10,'gust':0.7},'hehuan':{'ice':1.0,'gust':1.2}}.get(mid,{'ice':1.1,'gust':1.1})
 forecasts={}
 for i,s in enumerate(seasons):
  t=temps[mid][i];delta=round((z-z0)*0.006,1)
  probs={k:round(min(0.8,v*scale.get(k,1)),3) for k,v in base_hazards[s].items()}
  forecasts[s]={'trailhead_temp_c':t,'summit_temp_envelope_c':[round(t[0]-delta-2,1),round(t[1]-delta+2,1)],'rain_probability_pct':rain[profile][i],'wind_ms':wind[profile][i],'hazard_probability':probs}
 mountains.append(dict(id=mid,name=name,summit_m=z,trailhead_m=z0,days=days,difficulty_stars=stars,terrain=terrain,intro=intro,permits_note=permits,primary_risks=risks,water_carry_l=water,overnight=days[1]>1,stage_counts=dict(zip(STAGES,quota)),priority_ids=priority,forecast=forecasts,source_urls=[source],checked_on='2026-11-01',status='recheck_before_trip'))
write('mountains.json',{'version':1,'simulation_notice':'天氣範圍、事件機率、星等與點數皆為教育遊戲設計，非官方預報或事故率。','forecast_algorithm':{'lapse_c_per_m':0.006,'summit_jitter_c':[-2,2],'observation_error_c':[-3,3],'min_temp_c':-25,'max_temp_c':38,'gust_increment_ms':[4,8],'max_wind_ms':30,'warning_cancel_flags':['typhoon','official_closed'],'winter_ice_action':'postpone_or_change_route'},'mountains':mountains})
slots=[];items=[]
def slot(sid,name,options):
 slots.append({'id':sid,'name':name,'mode':'single','required':True,'options':[o[0] for o in options]})
 for iid,label,teach,visual,effects in options:
  items.append(dict(id=iid,slot=sid,name=label,weight_g=0,teach=teach,visual=visual,effects=effects,risks=[]))
slot('hat','帽子',[
 ('sun_hat','遮陽帽','遮陽並保護頭頸，濕冷時另備保暖。','米色橢圓帽簷、卡其帽冠',{'sun_hat':True}),
 ('beanie','毛帽','冷風中減少散熱；炎熱活動時可收起。','紅色半圓帽冠與小毛球',{'warm_hat':True}),
 ('no_hat','不戴','曝曬與冷風都少一層保護。','露出深棕色頭髮',{})])
slot('base','內層',[
 ('wicking','排汗衣','幫助排汗快乾，仍需調整速度避免汗濕。','青綠短袖圓領',{'wicking_base':True}),
 ('cotton','棉T','吸水後不易乾，風雨中容易濕冷。','白色短袖加小藍方塊',{'cotton_base':True})])
slot('mid','中層',[
 ('fleece','刷毛','保暖且較易管理濕氣，風雨中仍需外層。','橘色薄長袖、中央拉鍊',{'insulation':True}),
 ('down','羽絨','乾燥時保暖，受潮表現下降，須防水收納。','紫色蓬鬆長袖、三道橫線',{'insulation':True,'down_layer':True}),
 ('no_mid','不穿','活動熱時可不穿，但冷天需在背包備保暖層。','顯示內層',{})])
slot('shell','外層',[
 ('rain_shell','防水透氣外套','遮風雨，走動仍可能悶熱；雨褲另外備。','黃色長袖、連帽邊與拉鍊',{'rain_shell':True,'wind_shell':True}),
 ('poncho','輕便雨衣','短程備援可用，強風易飄動且可能破損。','半透明淡藍A字罩衫，露出雙手',{'light_rain_cover':True}),
 ('windbreaker','防風外套','擋風，不能當作持續降雨的防水層。','深藍貼身長袖、拉鍊',{'wind_shell':True}),
 ('no_shell','不穿','晴暖時可不穿，背包仍應有風雨備援。','顯示中層或內層',{})])
slot('pants','褲子',[
 ('quick_pants','快乾登山褲','保護腿部且較易乾，仍會濕也不等於防水。','橄欖綠兩條長褲管',{'quick_pants':True}),
 ('jeans','牛仔褲','濕後厚重不易乾，抬腿也較受限。','靛藍長褲、黃色側線',{'jeans':True}),
 ('shorts','短褲','炎熱開闊短程可用，草叢與濕冷長程保護少。','灰色短褲、膚色小腿',{'shorts':True})])
slot('shoes','鞋子',[
 ('boots','登山鞋','已試穿、合腳且鞋底完好才可靠；仍會滑。','棕色圓鞋頭、黑厚底、兩點鞋帶',{'proper_shoes':True}),
 ('trainers','運動鞋','完好且有抓地力者可應付簡單乾燥路，陡濕地形要重評。','藍色圓鞋頭、白底',{'trainers':True}),
 ('sandals','拖鞋','固定與護趾不足，不適合這些登山路線。','膚色腳掌、粉紅V帶',{'sandals':True})])
slot('gloves','手套',[
 ('warm_gloves','防風保暖手套','冷風中保護手部，濕了需更換。','黑色圓手套，掌與拇指兩塊',{'warm_gloves':True}),
 ('no_gloves','無','晴暖時可不戴，冷天背包仍要備。','膚色圓手掌',{})])
slot('socks','襪子',[
 ('hiking_socks','排汗登山襪','合腳可減少摩擦，濕襪要更換。','灰色襪口與橘色細帶',{'hiking_socks':True}),
 ('cotton_socks','棉襪','濕後不易乾，留意摩擦與保暖。','白色襪口',{'cotton_socks':True}),
 ('no_socks','不穿襪','鞋內摩擦增多，需留意腳部。','露出腳踝',{})])
pack_rows=[
('headlamp','頭燈含備用電池',120,'照明','先測亮度與電池，不能只靠手機照明。','深灰頭帶與淡黃圓燈',{'has_headlamp':True}),
('offline_map','離線地圖與GPS',0,'導航','先下載底圖、路線並實測定位；有手機不等於已備好。','胸前深灰手機、綠色折線',{'has_gps_offline':True}),
('paper_map','紙本地圖與指北針',80,'導航','學會判讀，和電子導航互為備援。','米白摺圖與紅白指針',{'has_paper_navigation':True}),
('first_aid','急救包',200,'急救','帶合用敷料與個人藥品，並練習使用。','紅色方包、白色十字',{'has_first_aid':True}),
('blanket','緊急保暖毯',80,'緊急遮蔽','減少散熱，不會自行產熱，仍需隔地與遮風雨。','銀色摺疊小矩形',{'has_emergency_blanket':True}),
('power_bank','行動電源與線',220,'備援通訊','充飽並防水，低溫時保護電池。','黑色圓角長方形、白色電量點',{'has_power_bank':True}),
('snacks','行動糧與額外備糧',400,'額外食物','分次補充，另留延誤備糧。','橘色能量棒袋',{'has_food':True}),
('poles','登山杖',450,'輔助','調好長度、練習使用；不能替代安全落腳點。','兩支灰桿、黑握把',{'has_trekking_poles':True}),
('sun_kit','防曬乳與抗UV眼鏡',100,'防曬','依標示補擦，眼睛也要防護。','白色小瓶、黑框眼鏡',{'has_sun_kit':True}),
('whistle','哨子',15,'求救','示意省體力，仍要回報位置與保持聯絡。','肩帶黃色小長方體',{'has_whistle':True}),
('rain_kit','備用雨衣、雨褲與背包套',450,'緊急遮蔽','雨具易取，背包套不能取代內部分袋防水。','藍色捲袋與背包藍罩',{'has_rain_kit':True}),
('dry_clothes','防水袋裝備用乾衣',450,'保暖','留一套乾衣並備襪，別等濕透才處理。','青色捲口袋',{'has_dry_clothes':True}),
('spare_insulation','背包備用刷毛層',300,'保暖','不穿中層時可收包，休息冷了再加。','橘色捲衣小包',{'packed_insulation':True}),
('spare_beanie','備用毛帽',60,'保暖','暖天先收包，冷風來時取出。','紅色摺帽',{'packed_warm_hat':True}),
('spare_gloves','備用保暖手套',70,'保暖','不必一直戴，但冷時要拿得到。','黑色手套圖示',{'packed_warm_gloves':True}),
('satellite','衛星或適用備用通訊設備',200,'備援通訊','先確認服務、電力與操作；仍受地形天空遮蔽。','橘色短天線盒',{'has_satellite':True}),
('insurance','登山保險已確認',0,'行前行政','查海拔、活動、日期與除外事項；不降低物理危險。','檢查表藍色文件圖示，角色不畫',{'insurance_checked':True}),
('fire_kit','防水收納用火工具',40,'用火工具','只在合法安全處使用，禁火區不點火。','紅色小防水盒',{'has_fire_kit':True}),
('repair_kit','修補工具組',100,'修補工具','膠帶與簡易工具供暫時處理，故障仍要評估撤退。','灰色膠帶環',{'has_repair_kit':True}),
('shelter','緊急露宿袋與隔地墊',500,'緊急遮蔽','遮蔽與隔地一起備，避開溪床及落石區。','深綠捲袋加灰色泡棉捲',{'has_shelter':True}),
('overnight_kit','核准過夜裝備組',2000,'過夜','含合適睡袋、睡墊與已確認供餐或炊煮計畫；營地另備帳篷。','背包底部紫色睡袋捲',{'has_overnight_kit':True}),
('water_treatment','水處理與取水計畫',100,'水','水源先確認，選適用過濾與消毒；不能保證去除所有污染。','淺藍濾水袋',{'has_water_treatment':True})]
for iid,label,g,group,teach,visual,effects in pack_rows:
 items.append(dict(id=iid,slot='pack',name=label,weight_g=g,essential=group,teach=teach,visual=visual,effects=effects,risks=[]))
slots.append({'id':'pack','name':'背包','mode':'multiple','required':False,'options':[r[0] for r in pack_rows]})
slot('water','飲水',[(f'water_{v}',label,'依路線、流汗與可用補水調整；這是攜行量，不是整趟固定需求。',f'背包側袋藍水瓶，{v}個刻度',{'water_l':v}) for v,label in [(1,'1公升'),(2,'2公升'),(3,'3公升以上（草稿以3公升計）')]])
for it in items:
 if it['slot']=='water':it['weight_g']=it['effects']['water_l']*1000
# 條件使用 AST，避免執行任意字串。路徑查不到一律當設定錯誤。
def flag(path,value=True):return {'path':path,'op':'eq','value':value}
def all_(*x):return {'all':list(x)}
def any_(*x):return {'any':list(x)}
# 分組 cap 令最差配置總和為45。
rules=[]
def rule(i,group,when,points,teach,related):
 rules.append(dict(id=i,group=group,when=when,points=points,teach=teach,related_items=related))
rule('cotton_wet','clothing',all_(flag('gear.cotton_base'),any_(flag('weather.wet'),flag('weather.cold'))),3,'棉衣濕後不易乾，風雨中較易受寒。',['cotton'])
rule('no_warmth','clothing',all_(flag('weather.cold'),flag('gear.has_insulation',False)),5,'預期濕冷，穿著或背包需要保暖層。',['no_mid','spare_insulation'])
rule('no_rain','clothing',all_(flag('weather.wet'),flag('gear.has_rain_shell',False)),5,'缺可靠風雨層，雨褲與乾衣也要保護。',['rain_shell','poncho','windbreaker','no_shell','rain_kit'])
rule('no_wind','clothing',all_(flag('weather.strong_wind'),flag('gear.has_wind_shell',False)),3,'裸稜強風時要能擋風，雨具不能抵消失衡危險。',['no_shell','windbreaker'])
rule('jeans_wet','clothing',all_(flag('gear.jeans'),any_(flag('weather.wet'),flag('weather.cold'))),3,'牛仔褲濕後厚重且不易乾。',['jeans'])
rule('shorts_cold','clothing',all_(flag('gear.shorts'),any_(flag('weather.cold'),flag('route.brush'))),2,'濕冷或草叢路段，長褲較有保護。',['shorts'])
rule('cold_extremities','clothing',all_(flag('weather.cold'),any_(flag('gear.has_warm_hat',False),flag('gear.has_warm_gloves',False))),2,'頭手冷時要有可取用的保暖備援。',['no_hat','no_gloves','spare_beanie','spare_gloves'])
rule('sandals','feet',flag('gear.sandals'),6,'拖鞋固定與護趾不足，改穿合腳且鞋底完好的鞋。',['sandals'])
rule('trainers_rough','feet',all_(flag('gear.trainers'),any_(flag('route.rough'),flag('weather.wet'),flag('weather.ice'))),2,'陡濕路面需要合適抓地與固定，依路況重選鞋。',['trainers'])
rule('socks_wet','feet',any_(flag('gear.no_socks'),all_(flag('gear.cotton_socks'),flag('weather.wet'))),1,'腳部潮濕或摩擦時要換乾襪並檢查。',['no_socks','cotton_socks'])
rule('missing_light','navigation',flag('gear.has_headlamp',False),5,'短程也可能延誤，頭燈與備用電池要帶在身上。',['headlamp'])
rule('missing_nav','navigation',flag('gear.has_navigation',False),5,'需可離線使用且會操作的導航方式。',['offline_map','paper_map'])
rule('missing_power','navigation',all_(flag('gear.has_gps_offline'),flag('gear.has_power_bank',False)),1,'手機負責導航時需要電力備援。',['power_bank'])
rule('water_low','supply',flag('gear.water_low'),4,'攜水低於本次規劃，先補水或縮短路線。',['water_1','water_2','water_3'])
rule('food_missing','supply',flag('gear.has_food',False),2,'準備行動糧，也為延誤留一份。',['snacks'])
rule('sun_missing','supply',all_(flag('weather.uv_high'),flag('gear.has_sun_protection',False)),2,'曝曬時需遮蔽、眼睛防護與適當防曬。',['sun_kit','sun_hat'])
rule('missing_firstaid','emergency',flag('gear.has_first_aid',False),2,'急救用品與使用能力都要準備。',['first_aid'])
rule('missing_blanket','emergency',flag('gear.has_emergency_blanket',False),2,'緊急毯減少散熱，不能替代完整保暖。',['blanket'])
rule('missing_dry','emergency',all_(flag('weather.wet'),flag('gear.has_dry_clothes',False)),1,'乾衣要分袋防水。',['dry_clothes'])
rule('missing_shelter','emergency',flag('gear.has_shelter',False),1,'意外待援需考慮隔地與遮蔽。',['shelter'])
for it in items:it['risks']=[r['id'] for r in rules if it['id'] in r['related_items']]
gear={'version':1,'slots':slots,'items':items,'group_caps':{'clothing':15,'feet':6,'navigation':10,'supply':8,'emergency':6},'preparation_risk_cap':45,'preparation_rules':rules,'weight_mode':'display_only','default_provisions':['charged_phone','waterproof_inner_bags'],'essential_functions':{'導航':['offline_map','paper_map'],'防曬':['sun_kit','sun_hat'],'保暖':['fleece','down','spare_insulation','dry_clothes'],'照明':['headlamp'],'急救':['first_aid'],'用火工具':['fire_kit'],'修補工具':['repair_kit'],'額外食物':['snacks'],'水':['water_1','water_2','water_3','water_treatment'],'緊急遮蔽':['shelter','blanket','rain_kit']}}
write('gear.json',gear)
# 八題維持原 schema，額外觸發條件放旁表。
newrows=[
('prep-postpone','行前規劃','trailhead','今天改期','官方公告本路線封閉，背包已打包完成。',['改期並通知隊友與留守人','帶齊裝備就能通過','走旁邊小路避開封鎖'],0,[0,30,30],'封閉時不進入，裝備不能替代開放與許可。','https://hike.taiwan.gov.tw/',flag('weather.official_closed')),
('prep-rainpants','裝備穿搭','forest','褲管也要防雨','雨持續下，外套擋住上身，但褲管開始濕冷。',['加快走路烘乾褲管','在安全處穿雨褲，評估撤退','只套背包套即可'],1,[20,0,18],'上身外套不等於全身防雨，持續濕冷應調整行程。','https://www.ysnp.gov.tw/StaticPage/Equipment',flag('weather.rain')),
('prep-down-dry','裝備穿搭','ridge','保住乾燥保暖層','休息前發現雨水快進入背包，裡面放著羽絨衣。',['把羽絨衣拿出來接雨','不用處理，羽絨永遠保暖','先在安全遮蔽處防水收納，檢查乾衣並評估撤退'],2,[25,20,0],'羽絨受潮保暖表現下降，乾燥收納與遮蔽很重要。','https://www.ysnp.gov.tw/StaticPage/Equipment',all_(flag('weather.rain'),flag('gear.down_layer'))),
('prep-ice-turn','天氣與地形','ridge','前方是冰面','原本沒有雪的步道出現大片結冰，你沒有雪地訓練。',['停止前進，沿可安全撤回的路退回，受困則求援','登山鞋踩重一點就不滑','靠登山杖快速衝過'],0,[0,28,30],'一般登山鞋與登山杖不能保證冰面安全；雪地裝備仍需訓練。','https://www.ysnp.gov.tw/Trail/7fa5c242-df1a-4a8e-bcab-32dc55b1f7b6?Tab=5',flag('weather.ice')),
('prep-water-plan','體能補給','trailhead','山屋沒有保證供水','你查到山屋近期缺水，原本只打算背一點水。',['照走再跟別人借','重算各段用水，增加攜水或改行程','到湖邊直接喝'],1,[22,0,25],'山屋與溪流不是保證水站，先確認水況與處理方式。','https://www.ysnp.gov.tw/StaticPage/Equipment',flag('route.overnight')),
('prep-thunder-stop','天氣與地形','summit','有雨衣也要撤','穿好雨衣後，你在開闊山頂聽見雷聲。',['有雨衣可以多待一下','躲到最高的孤立樹下','立刻放棄拍照，沿安全路線離開山頂與裸稜'],2,[28,30,0],'防水衣物不防雷，聽到雷聲就採取避雷行動。','https://www.cwa.gov.tw/V8/C/L/Mountain/Mountain.html',flag('weather.thunder')),
('prep-sat-sky','迷路與求救','forest','衛星訊息還沒送出','在安全待援點，衛星設備顯示訊息尚未送達。',['確認操作與天空遮蔽，在安全範圍嘗試並保留電力','沒送出也當作救援已收到','離開步道爬崖追訊號'],0,[0,20,30],'備用通訊仍有使用限制，需確認送達與保持自身安全。','https://www.ysnp.gov.tw/StaticPage/Equipment',flag('gear.has_satellite')),
('prep-overpack','裝備穿搭','trailhead','背得動才帶得走','背包整理好卻重到無法穩定行走。',['先把頭燈、雨衣與水丟掉','保留安全功能，協調分工、減少非必要物或縮短路線','勉強背著衝上山'],1,[24,0,20],'負重需實際試背，不要以刪除安全備援解決。','https://www.ysnp.gov.tw/StaticPage/Equipment',{'path':'state.pack_weight_g','op':'gte','value':8000})]
new=[];triggers={}
for iid,cat,st,title,situation,opts,answer,risk,why,url,cond in newrows:
 new.append(dict(id=iid,category=cat,stage=st,title=title,situation=situation,options=opts,answer=answer,risk=risk,why=why,sources=[url]));triggers[iid]={'only_if':cond}
write('new_scenarios.json',new);write('scenario_triggers.json',triggers)
# Markdown 附表由同一份 JSON 產生，避免文件與資料漂移。
parts=['## 附表 A：六座山岳卡片\n']
for m in mountains:
 parts += [f"### {m['name']}（`{m['id']}`）\n",f"- 海拔約 {m['summit_m']:,} 公尺；本遊戲登山口基準約 {m['trailhead_m']:,} 公尺。典型 {m['days'][0]}–{m['days'][1]} 天；{'★'*m['difficulty_stars']}（遊戲相對難度）。\n- 路線：{m['terrain']}。\n- 簡介：{m['intro']}\n- 許可與住宿：{m['permits_note']}\n- 主要風險：{'、'.join(m['primary_risks'])}。\n- 每段建議事件數（登山口／森林／稜線／山頂／下山）：{'／'.join(str(v) for v in m['stage_counts'].values())}，共 {sum(m['stage_counts'].values())} 題。\n- 優先候選："+'、'.join('`'+i+'`' for i in m['priority_ids'])+f"。\n- 本次攜水規劃起點 {m['water_carry_l'][0]}–{m['water_carry_l'][1]} 公升，仍須依補水點與個人狀況重算。\n- [官方路線資料]({m['source_urls'][0]})。\n"]
parts+=['## 附表 B：各山各季天氣候選範圍\n','全部是遊戲模擬值，不是實際預報、氣候平均或警戒標準。山頂包絡用每升高100公尺約降0.6°C，再加±2°C變異；實際抽樣先抽登山口，再推算山頂，因此兩者不獨立。\n','|山岳|季節|登山口°C|山頂°C包絡|降雨機率候選%|平均風速m/s|\n|---|---|---|---|---|---|\n']
for m in mountains:
 for s,p in m['forecast'].items():
  fmt=lambda a:'～'.join(map(str,a))
  parts.append(f"|{m['name']}|{dict(zip(seasons,['春','夏','秋','冬']))[s]}|{fmt(p['trailhead_temp_c'])}|{fmt(p['summit_temp_envelope_c'])}|{fmt(p['rain_probability_pct'])}|{fmt(p['wind_ms'])}|\n")
parts+=['\n特殊天氣為以下「候選事件抽中率」。各山各季的展開數值見 mountains.json 的 hazard_probability。各事件可並存，不能把一列相加當100%。冰僅在實現溫度≤2°C且有雨、濃霧或冬季殘冰條件時成立。\n','|季節|午後雷陣雨|鋒面|颱風外圍|濃霧|冰候選|強陣風候選|\n|---|---|---|---|---|---|---|\n']
for s,p in base_hazards.items():parts.append('|'+dict(zip(seasons,['春','夏','秋','冬']))[s]+'|'+'|'.join(f'{v*100:g}%' for v in p.values())+'|\n')
parts+=['\n山岳倍率（未列事件×1，機率上限80%）：七星山霧×1.3、冰×0.03、陣風×1.2；加里山霧×1.2、冰×0.10、陣風×0.7；合歡主峰冰×1.0、陣風×1.2；玉山、雪山、南湖冰×1.1、陣風×1.1。這些倍率只控制教學出題頻率。\n','## 附表 C：每項裝備教學與 Q 版繪製\n','重量是遊戲估值，穿著重量此版不計入背包。防水、保暖不代表免疫。未勾選背包品項即無該功能，不另外畫圖。\n','|ID／欄位|選項|背包估重g|卡片教學|視覺|\n|---|---|---|---|---|\n']
for it in items:parts.append(f"|`{it['id']}`／{it['slot']}|{it['name']}|{it['weight_g']}|{it['teach']}|{it['visual']}|\n")
parts+=['## 附表 D：行前風險規則\n','條件 AST 的 gear 為推導旗標、weather 為簡報旗標。所有山共用，route 旗標依山岳推導，故也構成「山×天氣」規則；無命中即0分。\n','|規則ID／群組|條件（精確AST）|分數|教學理由模板|\n|---|---|---|---|\n']
for r in rules:parts.append(f"|`{r['id']}`／{r['group']}|`{json.dumps(r['when'],ensure_ascii=False,separators=(',',':'))}`|+{r['points']}|{r['teach']}|\n")
parts+=['## 附表 E：新增情境草稿（8題）\n','完整三選項、答案索引、風險、說明、來源已寫入 new_scenarios.json，only-if 另放 scenario_triggers.json，不改原題庫。\n']
for s in new:
 parts.append(f"### {s['title']}（`{s['id']}`）\n\n`{s['stage']}`／{s['category']}；only-if：`{json.dumps(triggers[s['id']]['only_if'],ensure_ascii=False)}`。\n\n{s['situation']}\n\n"+'\n'.join(f"{i+1}. {v}（風險{s['risk'][i]}{'，正解' if i==s['answer'] else ''}）" for i,v in enumerate(s['options']))+f"\n\n{s['why']}\n\n[教學背景來源]({s['sources'][0]})。衛星操作另依設備手冊，情境是假設案例。\n")
(ROOT/'generated_tables.md').write_text('\n'.join(parts))
print('已輸出山岳、裝備、新題、觸發條件與附表')
