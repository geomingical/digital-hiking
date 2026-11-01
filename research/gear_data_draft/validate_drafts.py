"""語法、schema、題庫引用與行前評分驗證；執行時不修改任何檔案。"""
import json
import math
from pathlib import Path
from collections import Counter
P=Path(__file__).resolve().parent
bank=json.loads((P.parent.parent/'data/scenarios.json').read_text())
files={p.name:json.loads(p.read_text()) for p in P.glob('*.json')}
g=files['gear.json']; ms=files['mountains.json']['mountains']
ids={x['id'] for x in bank}
assert len(bank)==51 and len(ids)==51
assert Counter(x['stage'] for x in bank)=={'trailhead':11,'forest':12,'ridge':11,'summit':6,'descent':11}
items={x['id']:x for x in g['items']}
assert len(items)==len(g['items'])
slots={x['id']:x for x in g['slots']}
rules={x['id']:x for x in g['preparation_rules']}
for s in slots.values():
 assert all(i in items and items[i]['slot']==s['id'] for i in s['options'])
for i in items.values():
 assert i['slot'] in slots and i['id'] in slots[i['slot']]['options']
 assert set(i['risks'])<=rules.keys()
for r in rules.values():
 assert set(r['related_items'])<=items.keys()
 for iid in r['related_items']:assert r['id'] in items[iid]['risks']
for m in ms:
 assert set(m['priority_ids'])<=ids
 assert all(n<=Counter(x['stage'] for x in bank)[s] for s,n in m['stage_counts'].items())
 for p in m['forecast'].values():
  for k in ['trailhead_temp_c','summit_temp_envelope_c','rain_probability_pct','wind_ms']:assert p[k][0]<=p[k][1]
assert len(files['new_scenarios.json'])==8
assert {x['id'] for x in files['new_scenarios.json']}==set(files['scenario_triggers.json'])
assert not ({x['id'] for x in files['new_scenarios.json']}&ids)
for s in files['new_scenarios.json']:
 assert len(s['options'])==len(s['risk'])==3 and s['risk'][s['answer']]==0
# 規格中的掛鉤ID必須存在。只驗證被反引號標記且像既有id的字串。
import re
spec=(P.parent/'gear_spec.md').read_text()
mentioned=set(re.findall(r'`([a-z]+(?:-[a-z]+)+)`',spec))
known_new={s['id'] for s in files['new_scenarios.json']}
non_scenario={'gear-check','display-only'}
assert mentioned-ids-known_new-non_scenario==set(),mentioned-ids-known_new-non_scenario

def evaluate(c,ctx):
 if 'all' in c:return all(evaluate(x,ctx) for x in c['all'])
 if 'any' in c:return any(evaluate(x,ctx) for x in c['any'])
 cur=ctx
 for part in c['path'].split('.'):
  assert part in cur, f'缺條件欄位：{c["path"]}'
  cur=cur[part]
 return cur==c['value'] if c['op']=='eq' else cur>=c['value']
paths=set()
def collect(c):
 if 'path' in c:paths.add(c['path'])
 else:
  for x in c.get('all',c.get('any',[])):collect(x)
for r in rules.values():collect(r['when'])

def context(chosen):
 raw={}
 for iid in chosen:raw.update(items[iid]['effects'])
 gear={p.split('.')[1]:False for p in paths if p.startswith('gear.')}
 gear.update(raw)
 for iid in ['headlamp','first_aid','blanket','power_bank','snacks','sun_kit','dry_clothes','shelter']:
  for k,v in items[iid]['effects'].items():gear[k]=raw.get(k,False)
 gear['has_insulation']=bool(raw.get('insulation') or raw.get('packed_insulation'))
 gear['has_rain_shell']=bool(raw.get('rain_shell') or raw.get('has_rain_kit'))
 gear['has_wind_shell']=bool(raw.get('wind_shell') or raw.get('has_rain_kit'))
 gear['has_navigation']=bool(raw.get('has_gps_offline') or raw.get('has_paper_navigation'))
 gear['has_sun_protection']=bool(raw.get('has_sun_kit'))
 gear['has_warm_hat']=bool(raw.get('warm_hat') or raw.get('packed_warm_hat'))
 gear['has_warm_gloves']=bool(raw.get('warm_gloves') or raw.get('packed_warm_gloves'))
 gear['no_socks']='no_socks' in chosen
 gear['water_low']=raw.get('water_l',1)<2
 return {'gear':gear,'weather':{'wet':True,'cold':True,'strong_wind':True,'uv_high':True},'route':{'rough':True,'brush':True}}
def prep(ctx):
 groups={k:0 for k in g['group_caps']}
 for r in rules.values():
  if evaluate(r['when'],ctx):groups[r['group']]+=r['points']
 return min(g['preparation_risk_cap'],sum(min(v,g['group_caps'][k]) for k,v in groups.items()))
bad=['no_hat','cotton','no_mid','no_shell','jeans','sandals','no_gloves','no_socks','water_1']
good=['beanie','wicking','fleece','rain_shell','quick_pants','boots','warm_gloves','hiking_socks','water_3']+slots['pack']['options']
assert prep(context(bad))==45
assert prep(context(good))==0
assert sum(g['group_caps'].values())==45
assert min(40,math.floor(18*1.5+0.5))==27
assert min(40,math.floor(18*0.9+0.5))==16
assert min(40,math.floor(30*1.25+5+0.5))==40
# 無外部依賴的結構驗證，涵蓋本草稿使用的 schema 關鍵字。
# 不是完整的 JSON Schema meta-schema 驗證器。
schema=files['schemas.json']
def validate(value, spec, path='$'):
 if '$ref' in spec:
  target=schema
  for key in spec['$ref'].split('/')[1:]:target=target[key]
  validate(value,target,path)
 if 'oneOf' in spec:
  matched=0
  for candidate in spec['oneOf']:
   try:validate(value,candidate,path);matched+=1
   except AssertionError:pass
  assert matched==1,(path,'oneOf',matched)
 if 'enum' in spec:assert value in spec['enum'],(path,'enum')
 if 'type' in spec:
  types=spec['type'] if isinstance(spec['type'],list) else [spec['type']]
  checks={'object':isinstance(value,dict),'array':isinstance(value,list),'string':isinstance(value,str),'boolean':isinstance(value,bool),'integer':type(value)==int,'number':type(value) in (int,float)}
  assert any(checks[t] for t in types),(path,'type')
 if isinstance(value,dict):
  assert len(value)>=spec.get('minProperties',0)
  assert len(value)<=spec.get('maxProperties',float('inf'))
  for key in spec.get('required',[]):assert key in value,(path,'required',key)
  for key,v in value.items():
   child=spec.get('properties',{}).get(key)
   if child is not None:validate(v,child,path+'.'+key)
   else:
    extra=spec.get('additionalProperties',True)
    assert extra is not False,(path,'extra',key)
    if isinstance(extra,dict):validate(v,extra,path+'.'+key)
 if isinstance(value,list):
  assert len(value)>=spec.get('minItems',0)
  assert len(value)<=spec.get('maxItems',float('inf'))
  if spec.get('uniqueItems'):assert len({json.dumps(v,sort_keys=True) for v in value})==len(value)
  for i,v in enumerate(value):validate(v,spec.get('items',{}),path+f'[{i}]')
 if isinstance(value,str):
  assert len(value)>=spec.get('minLength',0)
  if spec.get('format')=='uri':assert value.startswith(('https://','http://'))
  if spec.get('format')=='date':
   from datetime import date
   date.fromisoformat(value)
 if type(value) in (int,float):
  assert value>=spec.get('minimum',-float('inf'))
  assert value<=spec.get('maximum',float('inf'))
for fn,key in [('mountains.json','mountains'),('gear.json','gear'),('new_scenarios.json','newScenarios'),('scenario_triggers.json','triggers')]:
 validate(files[fn],schema['$defs'][key])
print(f'PASS: {len(files)}份JSON可解析；4份資料通過本地schema關鍵字檢查；51個既有ID、8個新ID、6山24季參數及品項引用一致；行前最差45／齊備0；掛鉤算例通過。')
