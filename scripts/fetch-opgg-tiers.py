import json,re,urllib.request,concurrent.futures
from datetime import date
from pathlib import Path
root=Path(__file__).resolve().parents[1]
ids=['Ornn','Garen','Aatrox','Ahri','Ashe','Blitzcrank','Darius','Evelynn','Janna','Kaisa','Kennen','Leona','Lux','Malphite','Morgana','Nami','Sona','Veigar','Vex','Yasuo']
def fetch(champion):
 url=f'https://op.gg/ko/lol/modes/aram-mayhem/{champion.lower()}/augments'
 text=urllib.request.urlopen(url,timeout=45).read().decode('utf-8')
 patch=re.search(r'패치\s+(\d+\.\d+)',text)
 if not patch:raise ValueError(f'No patch metadata: {champion}')
 chunks=[json.loads(m.group(1)) for m in re.finditer(r'self\.__next_f\.push\(\[1,("(?:[^"\\]|\\.)*")\]\)',text)]
 rows=[]
 for chunk in [''.join(chunks)]:
  for line in chunk.splitlines():
   try: obj=json.loads(line.split(':',1)[1])
   except (ValueError,IndexError): continue
   if isinstance(obj,list) and len(obj)>3 and isinstance(obj[3],dict):
    data=obj[3].get('data')
    if isinstance(data,list) and any(isinstance(x,dict) and 'largeIcon' in x and 'performance' in x for x in data):rows=data
 if not rows:raise ValueError(f'No augment ranking data: {champion}')
 return champion,{'url':url,'patch':patch.group(1),'rows':[{k:r[k] for k in ['id','tier','name','key','largeIcon','rarity','performance','popular'] if k in r} for r in rows if 'name' in r]}
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool: data=dict(pool.map(fetch,ids))
patches={c['patch'] for c in data.values()}
if len(patches)!=1:raise ValueError(f'Mixed patches: {patches}')
snapshot={'retrieved':date.today().isoformat(),'patch':patches.pop(),'source':'OP.GG ARAM Mayhem','tierMapping':{'0':'S','1':'A','2':'B','3':'C','4':'D','5':'E'},'champions':data}
(root/'data/opgg-augment-tiers.json').write_text(json.dumps(snapshot,ensure_ascii=False,indent=2),encoding='utf-8')
names=[re.sub(r'\s*\([★☆-]+\)','',n) for n in re.findall(r'\["([^"]+)", "(?:silver|gold|prism)"',(root/'src/engine/data.ts').read_text(encoding='utf-8'))]
compact={k:snapshot[k] for k in ['retrieved','patch','source','tierMapping']}
compact['champions']={cid:{'url':c['url'],'grades':{r['name']:snapshot['tierMapping'].get(str(r['tier'])) for r in c['rows'] if r['name'] in names}} for cid,c in data.items()}
(root/'data/augment-grades.json').write_text(json.dumps(compact,ensure_ascii=False,indent=2),encoding='utf-8')
print('Saved champion rankings:',len(data),'rows:',sum(len(c['rows']) for c in data.values()))
