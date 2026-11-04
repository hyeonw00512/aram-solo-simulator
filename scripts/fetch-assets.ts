import { mkdir, writeFile, access } from 'node:fs/promises';
import { playableChampions } from '../src/engine/data';
import { itemMap } from '../src/engine/items';
import data from '../data/champions.json';
const jobs = [...playableChampions.map(c => ({folder:'champions',file:c.id+'.png',url:`https://ddragon.leagueoflegends.com/cdn/${data.version}/img/champion/${c.id}.png`})), ...Object.values(itemMap).map(i => ({folder:'items',file:i.id+'.png',url:`https://ddragon.leagueoflegends.com/cdn/${data.version}/img/item/${i.id}.png`}))];
await Promise.all(['champions','items'].map(f => mkdir(`public/assets/${f}`, {recursive:true})));
let completed=0; const failed:string[]=[];
await Promise.all(Array.from({length:6}, async () => { while(jobs.length) { const job=jobs.shift()!; const path=`public/assets/${job.folder}/${job.file}`;
  try { await access(path); completed++; continue; } catch {}
  try { const response=await fetch(job.url,{signal:AbortSignal.timeout(20000)}); if(!response.ok) throw Error(String(response.status)); await writeFile(path,new Uint8Array(await response.arrayBuffer())); completed++; } catch(e) {failed.push(job.file+': '+String(e));}
}}));
console.log(JSON.stringify({version:data.version,completed,failed},null,2));
if(failed.length) process.exitCode=1;
