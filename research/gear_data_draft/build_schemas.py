"""建立資料草稿的 JSON Schema；不修改遊戲檔案。"""
import json
from pathlib import Path
P=Path(__file__).resolve().parent
S={'type':'string','minLength':1};N={'type':'number'};B={'type':'boolean'}
def arr(t,**kw):return {'type':'array','items':t,**kw}
def obj(props,req=None,extra=False):return {'type':'object','properties':props,'required':list(props) if req is None else req,'additionalProperties':extra}
def ref(n):return {'$ref':'#/$defs/'+n}
def enum(*x):return {'enum':list(x)}
def bounded(lo,hi,integer=False):return {'type':'integer' if integer else 'number','minimum':lo,'maximum':hi}
R=arr(N,minItems=2,maxItems=2)
stages=['trailhead','forest','ridge','summit','descent']
hazards=['thunder','front','typhoon','fog','ice','gust']
seasons=['spring','summer','autumn','winter']
defs={}
defs['condition']={'oneOf':[
 obj({'all':arr(ref('condition'),minItems=1)}),
 obj({'any':arr(ref('condition'),minItems=1)}),
 obj({'path':S,'op':enum('eq','gte'),'value':{'type':['boolean','number','string']}})]}
defs['forecastParameters']=obj({'trailhead_temp_c':R,'summit_temp_envelope_c':R,'rain_probability_pct':arr(bounded(0,100),minItems=2,maxItems=2),'wind_ms':arr(bounded(0,30),minItems=2,maxItems=2),'hazard_probability':obj({h:bounded(0,1) for h in hazards})})
defs['mountain']=obj({'id':S,'name':S,'summit_m':bounded(0,4000),'trailhead_m':bounded(0,4000),'days':arr(bounded(0.5,10),minItems=2,maxItems=2),'difficulty_stars':bounded(1,5,True),'terrain':S,'intro':S,'permits_note':S,'primary_risks':arr(S,minItems=1),'water_carry_l':arr(bounded(1,10),minItems=2,maxItems=2),'overnight':B,'stage_counts':obj({s:bounded(0,4,True) for s in stages}),'priority_ids':arr(S,uniqueItems=True),'forecast':obj({s:ref('forecastParameters') for s in seasons}),'source_urls':arr({'type':'string','format':'uri'},minItems=1),'checked_on':{'type':'string','format':'date'},'status':enum('recheck_before_trip')})
defs['forecastAlgorithm']=obj({'lapse_c_per_m':bounded(0.004,0.009),'summit_jitter_c':R,'observation_error_c':R,'min_temp_c':N,'max_temp_c':N,'gust_increment_ms':R,'max_wind_ms':bounded(0,50),'warning_cancel_flags':arr(S),'winter_ice_action':S})
defs['mountains']=obj({'version':enum(1),'simulation_notice':S,'forecast_algorithm':ref('forecastAlgorithm'),'mountains':arr(ref('mountain'),minItems=6,maxItems=6)})
defs['slot']=obj({'id':S,'name':S,'mode':enum('single','multiple'),'required':B,'options':arr(S,minItems=1,uniqueItems=True)})
defs['item']=obj({'id':S,'slot':S,'name':S,'weight_g':bounded(0,20000),'teach':S,'visual':S,'effects':{'type':'object','additionalProperties':{'type':['boolean','number']}},'risks':arr(S,uniqueItems=True),'essential':S},['id','slot','name','weight_g','teach','visual','effects','risks'])
defs['preparationRule']=obj({'id':S,'group':enum('clothing','feet','navigation','supply','emergency'),'when':ref('condition'),'points':bounded(0,10,True),'teach':S,'related_items':arr(S,minItems=1,uniqueItems=True)})
defs['gear']=obj({'version':enum(1),'slots':arr(ref('slot'),minItems=1),'items':arr(ref('item'),minItems=1),'group_caps':obj({k:bounded(0,45,True) for k in ['clothing','feet','navigation','supply','emergency']}),'preparation_risk_cap':enum(45),'preparation_rules':arr(ref('preparationRule')),'weight_mode':enum('display_only'),'default_provisions':arr(S),'essential_functions':{'type':'object','minProperties':10,'maxProperties':10,'additionalProperties':arr(S,minItems=1)}})
defs['scenario']=obj({'id':S,'category':S,'stage':enum(*stages),'title':S,'situation':S,'options':arr(S,minItems=3,maxItems=3),'answer':bounded(0,2,True),'risk':arr(bounded(0,100),minItems=3,maxItems=3),'why':S,'sources':arr(S,minItems=1)},extra=False)
defs['newScenarios']=arr(ref('scenario'),minItems=6,maxItems=10)
defs['triggers']={'type':'object','additionalProperties':obj({'only_if':ref('condition')})}
defs['forecast']=obj({'trailhead_temp_c':R,'summit_temp_c':R,'rain_probability_pct':bounded(0,100),'wind_ms':bounded(0,30),'gust_ms':bounded(0,30),'hazards':obj({h:B for h in hazards}),'ice':B})
defs['actualWeather']=obj({'trailhead_temp_c':R,'summit_temp_c':R,'rain':B,'thunder':B,'fog':B,'ice':B,'gust_ms':bounded(0,30),'strong_wind':B})
defs['eventLog']=obj({'scenarioId':S,'orig':bounded(0,2,True),'base':bounded(0,100),'mult':bounded(0.8,1.5),'add':bounded(0,6),'finalRisk':bounded(0,40),'gearDelta':N,'actualAdded':bounded(0,40),'appliedRuleIds':arr(S)})
flags={'type':'object','additionalProperties':{'type':['boolean','number']}}
selected=obj({**{k:S for k in ['hat','base','mid','shell','pants','shoes','gloves','socks','water']},'pack':arr(S,uniqueItems=True)})
defs['state']=obj({'prepVersion':enum(1),'dataVersion':enum(1),'phase':enum('mountain','forecast','gear','gear-check','playing','ending','postponed'),'seed':bounded(0,4294967295,True),'tripIndex':bounded(0,1000000,True),'mountainId':S,'season':enum(*seasons),'historySnapshot':{'type':'object'},'selectedGear':selected,'forecast':ref('forecast'),'actualWeather':ref('actualWeather'),'briefFlags':flags,'gearFlags':flags,'routeFlags':flags,'preparation':obj({'risk':bounded(0,45,True),'groups':{'type':'object','additionalProperties':bounded(0,45)},'findings':arr({'type':'object'}),'confirmed':B}),'adminChecks':obj({k:B for k in ['route','permits','lodging','stayContact','turnaround']}),'risk':bounded(0,100),'pack_weight_g':bounded(0,100000),'gearImpact':obj({'added':bounded(0,10000),'avoided':bounded(0,10000)}),'eventRiskLog':arr(ref('eventLog'))},extra=True)
(P/'schemas.json').write_text(json.dumps({'$schema':'https://json-schema.org/draft/2020-12/schema','$defs':defs},ensure_ascii=False,indent=2)+'\n')
print('schemas.json 已產生')
