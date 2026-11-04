"""Add the source snapshots used by the Ornn/Garen/Aatrox implementation."""
import json,re,urllib.request,concurrent.futures,importlib.util
from pathlib import Path
root=Path(__file__).resolve().parents[1]
names=['Ornn','Garen','Aatrox']
def get(url):
 with urllib.request.urlopen(url,timeout=45) as r:return r.read()
def collect(name):
 # The current CharacterRecord endpoint denies access. Use Riot's older public
 # snapshot for AD growth, which is erroneously zero in the bundled 16.21 data.
 url=f'https://ddragon.leagueoflegends.com/cdn/15.24.1/data/en_US/champion/{name}.json'
 raw=get(url);(root/f'data/raw/{name.lower()}-15.24.1.json').write_bytes(raw)
 (root/f'public/assets/champions/{name}.png').write_bytes(get(f'https://ddragon.leagueoflegends.com/cdn/16.21.1/img/champion/{name}.png'))
 buildurl=f'https://op.gg/ko/lol/modes/aram-mayhem/{name.lower()}/build'
 html=get(buildurl).decode('utf-8')
 spec=importlib.util.spec_from_file_location('opgg_items',root/'scripts/fetch-opgg-items.py');module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
 builds={'url':buildurl,**module.parse(html)}
 augurl=f'https://op.gg/ko/lol/modes/aram-mayhem/{name.lower()}/augments'
 html=get(augurl).decode('utf-8')
 stream=''.join(json.loads(m.group(1)) for m in re.finditer(r'self\.__next_f\.push\(\[1,("(?:[^"\\]|\\.)*")\]\)',html))
 rows=[]
 for line in stream.splitlines():
  try:obj=json.loads(line.split(':',1)[1])
  except (ValueError,IndexError):continue
  if isinstance(obj,list) and len(obj)>3 and isinstance(obj[3],dict):
   data=obj[3].get('data')
   if isinstance(data,list) and any(isinstance(x,dict) and 'largeIcon' in x and 'performance' in x for x in data):rows=data
 if not rows:raise ValueError('Missing augments: '+name)
 return name,json.loads(raw),url,builds,{'url':augurl,'rows':[{k:r[k] for k in ['id','tier','name','key','largeIcon','rarity','performance','popular'] if k in r} for r in rows if 'name' in r]}
with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:results=list(pool.map(collect,names))
def load(file):return json.loads((root/'data'/file).read_text(encoding='utf-8'))
growth=load('champion-growth.json');ranks=load('skill-ranks.json');builds=load('opgg-item-builds.json');augments=load('opgg-augment-tiers.json');grades=load('augment-grades.json');champions=load('champions.json')['data']
selected=[re.sub(r'\s*\([★☆-]+\)','',n) for n in re.findall(r'\["([^"]+)", "(?:silver|gold|prism)"',(root/'src/engine/data.ts').read_text(encoding='utf-8'))]
for name,raw,url,build,augment in results:
 record=raw['data'][name]['stats']
 if record['attackdamageperlevel']<=0:raise ValueError('Missing AD growth: '+name)
 growth['champions'][name]={'attackdamageperlevel':record['attackdamageperlevel'],'attackspeedratio':record['attackspeed'],'source':url,'note':'AD growth from Riot 15.24.1; attack speed ratio approximated by base attack speed.'}
 print(name,'AD growth',record['attackdamageperlevel'],'core builds',len(build['cores']),'augments',len(augment['rows']))
 source=next(c for c in champions if c['id']==name)
 ranks['champions'][name]=[{'cost':s['cost'],'cooldown':s['cooldown']} for s in source['spells']]
 build['retrievedAt']='2026-11-02';augment['retrievedAt']='2026-11-02'
 builds['champions'][name]=build;augments['champions'][name]=augment
 grades['champions'][name]={'url':augment['url'],'grades':{r['name']:grades['tierMapping'].get(str(r['tier'])) for r in augment['rows'] if r['name'] in selected}}
for file,data in [('champion-growth.json',growth),('skill-ranks.json',ranks),('opgg-item-builds.json',builds),('opgg-augment-tiers.json',augments),('augment-grades.json',grades)]:
 (root/'data'/file).write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
