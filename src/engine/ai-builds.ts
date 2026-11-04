import snapshot from '../../data/opgg-item-builds.json';
import type {Game,Unit,BuildPath} from './types';
import {itemMap,shopItems} from './items';
import {unavailableItems} from './item-effects';
import {buildRoutes,routeFor,preferredPath} from './build-advisor';
import {state,hasAugment} from './runtime';
import {Rng} from './rng';

export type BuildStyle='standard'|'adaptive'|'offbeat';
export interface AiBuildPlan {champion:string;style:BuildStyle;path:BuildPath;route:string[];core:string[];source?:string;patch?:string;reason:string;omitted:string[];}
type Source={url:string;patch:string;cores:string[][];boots:string[][];starters:string[][]};
export const buildSource=(id:string)=>(snapshot.champions as Record<string,Source>)[id];
export const buildSourceDate=snapshot.retrieved;
const legal=new Set(shopItems.filter(i=>!unavailableItems[i.id]&&!i.requiredChampion&&!i.tags.includes('Consumable')).map(i=>i.id));
const boots=(id:string)=>itemMap[id]?.tags.includes('Boots');
const finished=(id:string)=>legal.has(id)&&!boots(id)&&itemMap[id].gold.total>=1800;
function hash(value:string){let h=2166136261;for(const c of value)h=Math.imul(h^c.charCodeAt(0),16777619);return h>>>0;}
export function buildStyleFor(seed:number,u:Unit):BuildStyle{
 const roll=new Rng(hash(`${seed}:${u.id}:build-personality`)).next();
 return roll<.82?'standard':roll<.98?'adaptive':'offbeat';
}
export function corePath(core:string[],fallback:BuildPath):BuildPath{
 if(core.some(id=>['6617','3504','6616','6620','4005','2530','3107'].includes(id)))return 'support';
 let ap=0,ad=0,tank=0;for(const id of core){const s=itemMap[id]?.stats??{};ap+=s.FlatMagicDamageMod??0;ad+=(s.FlatPhysicalDamageMod??0)+(s.PercentAttackSpeedMod??0)*80;tank+=(s.FlatArmorMod??0)+(s.FlatSpellBlockMod??0)+(s.FlatHPPoolMod??0)/10;}
 return ap>ad&&ap>tank*.65?'ap':ad>ap&&ad>tank*.5?'ad':tank>0?'tank':fallback;
}
function complete(core:string[],boot:string|undefined,tail:string[],u:Unit){
 const route:string[]=[];
 // Keep completed investments when migrating an existing match or changing for an augment.
 const keep=u.items.filter(id=>finished(id)||boots(id)&&itemMap[id].gold.total>=900);
 const candidates=[...keep,...core.slice(0,1),...(boot?[boot]:[]),...core.slice(1),...tail];
 for(const id of candidates){if(!legal.has(id)||route.includes(id)||boots(id)&&route.some(boots))continue;route.push(id);if(route.length===6)break;}
 return route;
}
export function ensureAiBuild(g:Game,u:Unit):AiBuildPlan{
 const conversion=hasAugment(u,'마법사 (물리)'),old=u.aiBuild;
 if(old?.champion===u.champion.id&&(!conversion||old.path==='ad'))return old;
 const source=buildSource(u.champion.id),rng=new Rng(hash(`${g.seed}:${u.id}:${u.champion.id}:build-route`));
 const style=old?.style??buildStyleFor(g.seed,u),fallback=preferredPath(u,g.seed);
 const rows=(source?.cores??[]).map(raw=>({raw,core:raw.filter(finished)})).filter(row=>row.core.length>=2);
 // Explicit alternative paths (e.g. tank Malphite) remain coherent if a source row supports them.
 const compatible=state(u).buildPath?rows.filter(row=>corePath(row.core,fallback)===state(u).buildPath):rows;
 const candidates=compatible.length?compatible:rows;
 const roll=rng.next(),row=candidates[Math.min(candidates.length-1,roll<.8?0:roll<.95?1:2)];
 let core=row?.core.slice(0,3)??[],path=conversion?'ad' as const:corePath(core,fallback);
 let boot=source?.boots.flat().find(id=>legal.has(id)&&boots(id));
 let reason=source&&core.length?'OP.GG 핵심 빌드 참고':'지원 아이템으로 구성한 챔피언 기본 빌드';
 let tail=[...buildRoutes[path]];
 if(style==='offbeat'&&!conversion){
  const normalPaths=new Set(rows.map(r=>corePath(r.core,fallback)));normalPaths.add(fallback);
  const alternatives=(['tank','ap','ad'] as BuildPath[]).filter(p=>!normalPaths.has(p));
  path=rng.pick(alternatives.length?alternatives:(['tank','ap','ad'] as BuildPath[]).filter(p=>p!==path));
  core=buildRoutes[path].filter(id=>!boots(id)).slice(0,3);tail=[...buildRoutes[path]];boot=buildRoutes[path].find(boots);
  reason='독자 빌드 · 정석보다 본인 취향을 우선';
 }else if(conversion){core=buildRoutes.ad.filter(id=>!boots(id)).slice(0,3);tail=[...buildRoutes.ad];boot=buildRoutes.ad.find(boots);reason='마법사 (물리) 증강에 맞춰 물리 공격 빌드로 전환';}
 else if(style==='adaptive'){
  const enemies=g[u.team==='blue'?'red':'blue'];
  const physical=enemies.filter(e=>['ad'].includes(preferredPath(e,g.seed))).length;
  const defensive=physical>=3?'3047':'3111';
  boot=defensive;reason+=physical>=3?' · 물리 공격이 많은 상대에 판금 장화':' · 마법 피해·제어 대비 헤르메스';
  const alternative=path==='ap'?'3157':path==='ad'?'3072':path==='tank'?(physical>=3?'3075':'3065'):'3190';
  tail=[alternative,...tail];
 }
 if(!core.length){const fallbackRoute=routeFor({...u,aiBuild:undefined},g.seed);core=fallbackRoute.filter(id=>!boots(id)).slice(0,3);boot??=fallbackRoute.find(boots);tail=[...fallbackRoute,...tail];}
 const route=complete(core,boot,[...tail,...buildRoutes[path]],u);
 const omitted=row?.raw.filter(id=>!core.includes(id)&&!finished(id))??[];
 if(omitted.length)reason+=' · 미지원 완성품·선행 재료는 지원 구매 경로로 보완';
 u.aiBuild={champion:u.champion.id,style,path,route,core,source:source?.url,patch:source?.patch,reason,omitted};
 state(u).buildPath=path;return u.aiBuild;
}
