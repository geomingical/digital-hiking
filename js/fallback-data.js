/* 讀不到 data/scenarios.json（例如從 file:// 開啟）時使用的精簡題庫。 */
window.DH_FALLBACK_SCENARIOS = [
  {"id":"sample-plan","category":"行前規劃","stage":"trailhead","title":"登山計畫書","situation":"明天要上山，朋友問你要不要留行程給家人。","options":["留下登山計畫書與預計下山時間給親友","不用留，我的手機隨時都在，有事再聯絡","先不用留，出發後再傳訊息告訴親友就好"],"answer":0,"risk":[0,15,10],"why":"登山計畫書讓親友在你逾時未歸時，能提供救援單位路線與時間。","sources":["內政部消防署"]},
  {"id":"sample-lost","category":"迷路","stage":"forest","title":"走錯路了","situation":"你發現已經看不到路標，也找不到隊友。","options":["沿著溪谷往下走，水流應該能通到山下有人處","停下冷靜回想來時路，必要時原地等待並求救112","繼續往前走碰運氣，也許很快就能接回路標"],"answer":1,"risk":[28,0,20],"why":"STOP：停、想、觀察、計畫。溪谷常有瀑布與濕滑，盲目移動會更危險。","sources":["消防署"]},
  {"id":"sample-bear","category":"野生動物","stage":"ridge","title":"遇到黑熊","situation":"前方遠處出現一隻台灣黑熊。","options":["大叫嚇阻並衝過去，趁機拍下牠的照片留證","丟食物給牠分散注意，再趁機從旁邊走開","保持冷靜，慢慢後退，不要背對、不要奔跑"],"answer":2,"risk":[25,25,0],"why":"保持距離、不餵食、慢慢離開。","sources":["林業及自然保育署"]}
];
