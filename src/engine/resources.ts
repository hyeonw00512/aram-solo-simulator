import config from '../../data/simulation.json';
import type {Unit} from './types';
import type {Ability} from './kits';
import rules from '../../data/champion-resources.json';
export type ResourceKind='mana'|'energy'|'flow'|'none';
export function resourceRule(u:Unit){return (rules.champions as Record<string,{kind:ResourceKind;regen:number;regenGrowth:number}>)[u.champion.id]??{kind:'none' as const,regen:0,regenGrowth:0};}
export const resourceKind=(u:Unit)=>resourceRule(u).kind;
export const resourceLabel=(u:Unit)=>({mana:'마나',energy:'기력',flow:'기류',none:'무자원'}[resourceKind(u)]);
export const levelGrowth=(u:Unit)=>(u.level-1)*(config.levelGrowth.base+config.levelGrowth.perLevel*(u.level-1));
export const baseResourceMax=(u:Unit)=>u.champion.stats.mp+u.champion.stats.mpperlevel*levelGrowth(u);
export function currentResource(u:Unit,max=baseResourceMax(u)){
 const kind=resourceKind(u),r=u.combat;
 return Math.max(0,Math.min(max,kind==='energy'?r?.energy??max:kind==='mana'?r?.mana??max:kind==='flow'?r?.flow??0:0));
}
export function skillCost(u:Unit,a:Ability){return resourceKind(u)==='mana'?a.mana*(u.items.includes('2522')?2:1):resourceKind(u)==='energy'?a.mana:0;}
export function spendResource(u:Unit,cost:number){
 const r=u.combat;if(!r)return false;
 const kind=resourceKind(u),key=kind==='energy'?'energy':'mana';
 if(kind!=='mana'&&kind!=='energy')return cost===0;
 const current=r[key]??baseResourceMax(u);if(current<cost)return false;
 r[key]=current-cost;return true;
}
