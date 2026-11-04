"""Extract the item rows OP.GG actually renders; no inferred win rates."""
import concurrent.futures,json,re,urllib.request
from pathlib import Path
root=Path(__file__).resolve().parents[1]
champions=list(json.loads((root/'data/augment-grades.json').read_text(encoding='utf-8'))['champions'])
def parse(text):
 rows={};fragments={}
 stream=''.join(json.loads(m.group(1)) for m in re.finditer(r'self\.__next_f\.push\(\[1,("(?:[^"\\]|\\.)*")\]\)',text))
 for line in stream.splitlines():
  try:key,value=line.split(':',1);fragments[key]=json.loads(value)
  except (ValueError,IndexError):pass
 def reference(value):
  path=value[1:].split(':');node=fragments.get(path[0].removeprefix('L'))
  for key in path[1:]:
   if key=='props' and isinstance(node,list) and len(node)>3:node=node[3]
   elif isinstance(node,dict):node=node.get(key)
   elif isinstance(node,list) and key.isdigit() and int(key)<len(node):node=node[int(key)]
   else:return None
  return node
 def ids(node,seen=frozenset()):
  if isinstance(node,str) and node.startswith('$') and node not in seen:return ids(reference(node),seen|{node})
  if isinstance(node,dict):
   if node.get('metaType')=='item':return [str(node['metaId'])]
   image=re.search(r'/item/(\d+)\.png',str(node.get('src','')))
   if image:return [image.group(1)]
   return [i for v in node.values() for i in ids(v,seen)]
  if isinstance(node,list):return [i for v in node for i in ids(v,seen)]
  return []
 def walk(node):
  if isinstance(node,list):
   if len(node)>3 and node[0]=='$' and node[1]=='tr' and isinstance(node[2],str) and re.fullmatch(r'(core_items|boots|starter_items)_\d+',node[2]):
    row=ids(node[3]);
    if row:rows[node[2]]=row
   for child in node:walk(child)
  elif isinstance(node,dict):
   for child in node.values():walk(child)
 for fragment in fragments.values():walk(fragment)
 result={kind:[row for key,row in sorted(rows.items(),key=lambda pair:int(pair[0].rsplit('_',1)[1])) if key.startswith(prefix)] for kind,prefix in [('cores','core_items_'),('boots','boots_'),('starters','starter_items_')]}
 patches=re.findall(r'/lol/(\d+\.\d+\.\d+)/item/',text)
 if not result['cores'] or not result['boots'] or not patches:raise ValueError('Missing build rows/patch')
 result['patch']=max(set(patches),key=patches.count)
 return result
def fetch(champion):
 url=f'https://op.gg/ko/lol/modes/aram-mayhem/{champion.lower()}/build'
 with urllib.request.urlopen(url,timeout=40) as response:text=response.read().decode('utf-8')
 return champion,{'url':url,**parse(text)}
if __name__=='__main__':
 with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:data=dict(pool.map(fetch,champions))
 result={'retrieved':'2026-10-31','source':'OP.GG ARAM Mayhem item build tables','note':'Ordered core triples, boots and starters from public build pages. No pick/win rates inferred. Five/six-item completions and personality probabilities are simulator rules.','champions':data}
 (root/'data/opgg-item-builds.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
 print(json.dumps({cid:{'patch':v['patch'],'cores':len(v['cores']),'first':v['cores'][0]} for cid,v in data.items()}))
