import type { Game, Unit } from "./types";
import { baseShop, canShop, forgeReason, itemBonuses, componentQuote, itemMap, purchaseReason, shopItems, itemPurchasePlan } from "./items";
import {preferredPath,routeFor,ownsAntiHeal} from './build-advisor';
import {state} from "./runtime";
import {buildIdentity} from "./stats";
import type {BuildPath} from "./types";
import { refreshStats } from "./stats";
import {ensureAiBuild} from './ai-builds';

export function buyItem(game: Game, id: string, unit = game.blue[0], completedForge=false): boolean {
  const problem = purchaseReason(game, unit, id); if (problem) return false;
  if(!baseShop(game,unit)&&!completedForge){unit.forge={itemId:id,finishAt:game.time+3,position:unit.position,startedAt:game.time};unit.returningToBase=false;unit.status='간이 대장간 · 제작 중';return true;}
  const quote = componentQuote(id, unit.items);
  const previousHp=unit.health,field=!baseShop(game,unit);
  unit.gold -= quote.price; unit.items = [...quote.remaining, id]; state(unit).procs["bought:"+id]=game.time; if(id==="6657")state(unit).counters.rodLevel=0; refreshStats(unit);
  if(field){unit.health=Math.min(previousHp,unit.maxHealth);state(unit).procs.forgeReadyAt=game.time+90-80*(Math.min(18,unit.level)-1)/17;unit.status='간이 대장간 · 제작 완료';}
  game.logs.push({ time: game.time, text: `${unit.champion.name}: ${itemMap[id].name} 구매 (${quote.price}G${quote.consumed.length ? `, 하위 아이템 ${quote.consumed.map(c => itemMap[c].name).join(" · ")} 합성` : ""}).`, tone: "good" });
  return true;
}
export function buyItemGoal(game:Game,id:string,unit=game.blue[0]):boolean{
 const plan=itemPurchasePlan(game,unit,id);if(plan.reason||!plan.steps.length)return false;
 const bought:{id:string;price:number}[]=[];
 for(const step of plan.steps){if(!buyItem(game,step.id,unit))break;bought.push(step);if(unit.forge)break;}
 if(plan.components&&bought.length&&!unit.forge)game.logs.push({time:game.time,text:`${unit.champion.name}: ${itemMap[id].name}의 하위 재료 구매 — ${bought.map(s=>itemMap[s.id].name).join(' · ')} (${bought.reduce((sum,s)=>sum+s.price,0)}G).`,tone:'good'});
 return bought.length>0;
}
export function sellItem(game: Game, index: number, unit = game.blue[0]) {
  const item = itemMap[unit.items[index]];
  if (!baseShop(game, unit) || unit.forge || !item) return false;
  unit.items.splice(index, 1); unit.gold += item.gold.sell; refreshStats(unit);
  game.logs.push({ time: game.time, text: `${unit.champion.name}: ${item.name} 판매 (+${item.gold.sell}G).` }); return true;
}

export {buildRoutes,suggestedPath} from './build-advisor';
export function aiShopping(game:Game,unit:Unit){
 if(!canShop(game,unit))return;
 const plan=ensureAiBuild(game,unit),r=state(unit);r.buildPath=plan.path;
 let route=routeFor(unit,game.seed);
 const request=unit.shopRequest;
 if(request){
  const final=request.itemId==='3076'?'3075':request.itemId==='3123'?'3033':'3165';
  route=route.map(id=>final==='3033'&&id==='3036'?final:id);if(!route.includes(final))route=[...route.slice(0,5),final];
 }
 unit.lastBuildReason=unit.champion.name+' · '+plan.reason+(request?' · 치감 요청 반영':'');
 for(let step=0;step<12;step++){
  if(unit.forge)break;
  if(request&&ownsAntiHeal(unit)&&request.status==='pending'){
   request.status='fulfilled';
  }
  const priority=request?.status==='pending'?request.itemId:undefined;
  const goal=priority??route.find(id=>!unit.items.includes(id));if(!goal)return;
  const remaining=[...unit.items];
  const needed=(id:string,root=false):string[]=>{const i=remaining.indexOf(id);if(!root&&i>=0){remaining.splice(i,1);return []}return [id,...(itemMap[id]?.from??[]).flatMap(child=>needed(child))]};
  const candidates=needed(goal,true).filter(id=>!purchaseReason(game,unit,id));
  if(candidates[0])buyItem(game,candidates[0],unit);
  else if(priority&&unit.items.length===6){
   // Only combine owned pieces to free a slot; never sell a player's/AI's item to obey an order.
   const combine=route.find(id=>!unit.items.includes(id)&&componentQuote(id,unit.items).consumed.length>0&&!purchaseReason(game,unit,id));
   if(combine)buyItem(game,combine,unit);else break;
  }else break;
 }
 if(request&&request.status==='pending'&&ownsAntiHeal(unit)){request.status='fulfilled';}
}
export function advanceForges(game:Game){
 const units=[...game.blue,...game.red];
 for(const u of units){
  const forge=u.forge;
  if(forge){
   if(!u.alive||u.portal||Math.abs(u.position-forge.position)>.1||state(u).lastDamage>=forge.startedAt||state(u).effects.some(e=>['stun','charm','silence','stasis'].includes(e.kind)&&e.until>game.time)){
    u.forge=undefined;game.logs.push({time:game.time,text:u.champion.name+': 제작 중단 · 골드와 재료를 사용하지 않았습니다.'});
   }else if(game.time>=forge.finishAt){u.forge=undefined;if(!buyItem(game,forge.itemId,u,true))game.logs.push({time:game.time,text:u.champion.name+': 제작 조건이 바뀌어 취소되었습니다.'});}
  }
 }
 for(const smith of units.filter(u=>u.champion.id==='Ornn'&&u.alive&&u.level>=13&&!u.portal&&!u.forge)){
  if(!baseShop(game,smith)&&forgeReason(game,smith))continue;
  const team=units.filter(u=>u.team===smith.team),made=team.filter(u=>u.masterwork?.smithId===smith.id);
  const alliesMade=made.filter(u=>u!==smith).length;
  const candidate=[smith,...team.filter(u=>u!==smith)].find(u=>!u.masterwork&&u.alive&&!u.portal&&(u===smith||alliesMade<Math.min(4,smith.level-13)&&Math.abs(u.position-smith.position)<=15)&&u.items.some(masterworkEligible));
  if(!candidate)continue;
  const id=candidate.items.find(masterworkEligible)!,base=itemBonuses([id]);
  // Allocate a 1000G stat budget proportionally over supported basic combat stats.
  const values:Record<string,number>={FlatHPPoolMod:8/3,FlatPhysicalDamageMod:35,FlatMagicDamageMod:20,FlatArmorMod:20,FlatSpellBlockMod:18,PercentAttackSpeedMod:3000,haste:50};
  const total=Object.entries(values).reduce((sum,[k,value])=>sum+(base[k]??0)*value,0);
  const bonuses=Object.fromEntries(Object.keys(values).filter(k=>base[k]>0).map(k=>[k,base[k]*1000/total]));
  candidate.masterwork={itemId:id,smithId:smith.id,bonuses};state(smith).counters.ornnUpgrades=made.length+1;
  const hp=candidate.health;refreshStats(candidate);candidate.health=Math.min(hp,candidate.maxHealth);
  game.logs.push({time:game.time,text:`${smith.champion.name}: ${candidate.champion.name}의 ${itemMap[id].name} 걸작 강화`,tone:'major'});
 }
}
function masterworkEligible(id:string){const item=itemMap[id];return !!item&&item.gold.total>=1800&&!item.tags.includes('Boots')&&!item.into?.length&&Object.keys(item.stats).some(k=>['FlatHPPoolMod','FlatPhysicalDamageMod','FlatMagicDamageMod','FlatArmorMod','FlatSpellBlockMod','PercentAttackSpeedMod'].includes(k));}
export function useConsumable(game:Game,index:number,unit=game.blue[0]){
 if(game.phase!=='playing'||!unit.alive||unit.portal)return false;
 const id=unit.items[index],r=state(unit);
 if(id==='2003'||id==='2031'){
  const charges=r.counters.potionCharges??2;if(id==='2031'&&charges<=0)return false;
  unit.health=Math.min(unit.maxHealth,unit.health+120);
  if(id==='2031')r.counters.potionCharges=charges-1;else unit.items.splice(index,1);
 }else if(['2138','2139','2140'].includes(id)){
  Object.assign(r.counters,{elixirUntil:game.time+120,elixirHp:id==='2138'?300:0,elixirAp:id==='2139'?50:0,elixirAd:id==='2140'?30:0});unit.items.splice(index,1);refreshStats(unit);
 }else return false;
 game.logs.push({time:game.time,text:unit.champion.name+': '+itemMap[id].name+' 사용',tone:'good'});return true;
}
