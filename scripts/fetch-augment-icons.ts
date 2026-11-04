import {mkdir,readFile,writeFile,access} from 'node:fs/promises';
import raw from '../data/augments.json';
const version='16.21';
const root=`https://raw.communitydragon.org/${version}/plugins/rcp-be-lol-game-data/global`;
const sourceUrl=`${root}/ko_kr/v1/cherry-augments.json`;
await mkdir('data/raw',{recursive:true});await mkdir('public/assets/augments',{recursive:true});
const cache='data/raw/cherry-augments-16.21.json';
let source:any[];
try {source=JSON.parse(await readFile(cache,'utf8'));}catch {
 const response=await fetch(sourceUrl,{signal:AbortSignal.timeout(30000)});if(!response.ok)throw Error(`Augment catalog ${response.status}`);
 source=await response.json() as any[];await writeFile(cache,JSON.stringify(source,null,2));
}
const clean=(name:string)=>name.replace(/\s*\([★☆-]+\)/g,'').replace(/\s+/g,'').normalize('NFKC');
const aliases:Record<string,string>={'퀘스트: 이케시아의 몰락':'이케시아의 몰락'};
const manifest:Record<string,{name:string;sourceName:string;sourceId:number;file:string;url:string}>={};
const missing:string[]=[];
for(const augment of raw.data){
 const matches=source.filter(s=>clean(s.nameTRA??s.name??'')===clean(aliases[augment.name]??augment.name));
 if(!matches.length){missing.push(augment.name);continue;}
 const modeMatches=matches.filter(s=>s.augmentNameId?.startsWith('ARAM_'));
 const candidates=modeMatches.length?modeMatches:matches;
 const item=candidates.find(s=>s.rarity===({silver:'kSilver',gold:'kGold',prism:'kPrismatic'}[augment.tier]))??candidates[0];
 const icon=item.augmentSmallIconPath??item.augmentIconPath??item.iconLarge??item.largeIconPath??item.iconPath??item.iconSmall;
 if(!icon){missing.push(`${augment.name}: no icon (${Object.keys(item).join(',')})`);continue;}
 const relative=String(icon).replace(/^\/lol-game-data\/assets\//i,'').toLowerCase();
 const url=`${root}/default/${relative}`;
 manifest[augment.id]={name:augment.name,sourceName:item.nameTRA??item.name,sourceId:item.id,file:`/assets/augments/${augment.id}.png`,url};
}
const queue=Object.entries(manifest),failed:string[]=[];
await Promise.all(Array.from({length:6},async()=>{while(queue.length){const [id,entry]=queue.shift()!;const file=`public${entry.file}`;try{await access(file);continue}catch{}
 try{const response=await fetch(entry.url,{signal:AbortSignal.timeout(25000)});if(!response.ok)throw Error(String(response.status));const bytes=new Uint8Array(await response.arrayBuffer());if(bytes[0]!==137||bytes[1]!==80)throw Error('Not a PNG');await writeFile(file,bytes)}catch(e){failed.push(`${id}: ${String(e)}`)}
}}));
await writeFile('data/augment-icons.json',JSON.stringify({version,sourceUrl,collectedAt:new Date().toISOString(),data:manifest,missing,failed},null,2)+'\n');
console.log(JSON.stringify({sourceCount:source.length,matched:Object.keys(manifest).length,missing,failed,sample:source[0]},null,2));
if(failed.length)process.exitCode=1;
