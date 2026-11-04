import type {Game,Unit} from './types';
import {state,available,allUnits} from './runtime';
import {statsFor} from './stats';
import {skillRank} from './skill-training';

// Riot 16.21 character data. Distances use the simulator's existing /25 scale;
// fractional timers resolve on the next one-second tick.
export const demonShade=(u:Unit,time:number)=>{
 if(u.champion.id!=='Evelynn'||!u.alive)return false;
 const r=u.combat,lastDamage=r?.lastDamage??-100,damageDelay=lastDamage===r?.procs.shadeResetDamage?-Infinity:lastDamage+4;
 return time>=Math.max(damageDelay,r?.procs.shadeReady??0);
};
export function camouflaged(g:Game,u:Unit){
 return u.level>=6&&demonShade(u,g.time)&&!allUnits(g).some(t=>t.team!==u.team&&available(t)&&Math.abs(t.position-u.position)<=700/25)&&!g.world?.buildings.some(b=>b.team!==u.team&&b.alive&&b.kind!=='inhibitor'&&Math.abs(b.position-u.position)<=14);
}
export const visibleTarget=(g:Game,u:Unit)=>!camouflaged(g,u)||(state(u).procs.revealedUntil??0)>g.time;
export function eveDamage(u:Unit,v:Unit,slot:'Q'|'E'|'R',empowered=false){
 const rank=skillRank(u,slot),ap=statsFor(u).ap;
 if(slot==='Q')return 20+5*rank+.25*ap;
 if(slot==='E')return (empowered?40+40*rank:30+30*rank)+v.maxHealth*((empowered?.04:.03)+ap*(empowered?.00025:.00015));
 return (125*rank+.75*ap)*(v.health/v.maxHealth<.3?2.4:1);
}
export const eveHealThreshold=(u:Unit)=>250+20*(u.level-1)+2.5*statsFor(u).ap;
