import type {Game,Unit} from './types';
import type {Ability} from './kits';
import type {FighterCombat} from './fighter-skills';
import {state,hasAugment,allUnits,available,proc,addEffect} from './runtime';
import {statsFor} from './stats';
import {visibleTarget} from './evelynn';
import {Rng} from './rng';

const foes=(g:Game,u:Unit)=>allUnits(g).filter(v=>v.team!==u.team&&available(v)&&visibleTarget(g,v));
export const isMovementAbility=(a:Ability,u:Unit)=>!!a.dash||a.special==='last-caress'||a.special==='whiplash'&&!!state(u).counters.empoweredE;
export function augmentSkillHaste(u:Unit,a:Ability){return (hasAugment(u,({Q:'빵과 버터',W:'빵과 잼',E:'빵과 치즈',R:''})[a.slot])?100:0)+(isMovementAbility(a,u)&&hasAugment(u,'돌진')?175:0);}
export function augmentOnCast(g:Game,u:Unit,a:Ability,api:FighterCombat){
 const r=state(u),c=r.counters,s=statsFor(u);
 if(hasAugment(u,'불길한 서약'))u.health=Math.max(1,u.health*.95);
 if(hasAugment(u,'결투의 대가')){c.duelistAd=(c.duelistAd??0)+3+6*(u.level-1)/17;c.duelistAdUntil=g.time+8;}
 if(isMovementAbility(a,u)){
  if(hasAugment(u,'그림자 질주')){c.dashMove=300;c.dashMoveUntil=g.time+2;}
  if(hasAugment(u,'무법자의 투지')){c.outlaw=Math.min(5,(c.outlaw??0)+1);c.outlawUntil=g.time+8;}
  if(hasAugment(u,'대지의 각성')&&proc(u,'earthwake',g.time,1)){
   // A separate saved event per cast preserves trails from multiple movement skills.
   const key=`earthwake:${g.time}:${a.slot}`;
   c[key]=u.position;c[key+':damage']=90+160*(u.level-1)/17+1.25*(s.ad-s.baseAd)+s.ap*.6;r.procs[key]=g.time+1;
  }
 }
 if(a.slot!=='R')return;
 if(hasAugment(u,'도망갈 수 없어')&&proc(u,'cant-escape',g.time,8)){
  c.augmentReduction=.25;c.augmentReductionUntil=g.time+3;
  for(const v of foes(g,u).filter(v=>Math.abs(v.position-u.position)<=15)){
   if((state(v).procs.unstoppableUntil??0)>g.time||(state(v).procs.spellshieldUntil??0)>g.time)continue;
   addEffect(v,{kind:'charm',value:1,until:g.time+1.5*(1-statsFor(v).tenacity),source:u.id,key:'cant-escape:'+u.id});
  }
 }
 if(hasAugment(u,'궁극의 저지 불가')&&proc(u,'ultimate-unstoppable',g.time,8))r.procs.unstoppableUntil=Math.max(r.procs.unstoppableUntil??0,g.time+3);
 if(hasAugment(u,'난공불락')&&proc(u,'ultimate-invulnerable',g.time,8))r.procs.augmentInvulnerableUntil=g.time+2;
 if(hasAugment(u,'최종 형태')&&proc(u,'final-form',g.time,30)){
  api.shield(g,u,u,s.hp*.5,'final-form',10);c.finalVamp=.2;c.finalVampUntil=g.time+10;
  addEffect(u,{kind:'speed',value:.3,until:g.time+10,key:'final-form-speed'});
 }
}
export function augmentOnHit(g:Game,u:Unit,v:Unit,damage:number,spell:Ability|undefined,api:FighterCombat){
 if(damage<=0)return;
 const r=state(u),c=r.counters,s=statsFor(u);
 if(!spell){
  if(hasAugment(u,'불을 밝혀'))c.fireworkAttacks=(c.fireworkAttacks??0)+1;
  if(hasAugment(u,'결투의 대가')){c.duelistAp=(c.duelistAp??0)+6+12*(u.level-1)/17;c.duelistApUntil=g.time+8;}
  if(hasAugment(u,'탭 댄서')){c.tapStacks=(c.tapStacks??0)+1;c.tapStacksUntil=g.time+5;}
 }
 if(!v.alive)return;
 if(spell?.slot==='R'&&hasAugment(u,'요정 마법')&&(state(v).procs.unstoppableUntil??0)<=g.time&&proc(u,'fairy:'+v.id,g.time,8)){
  const until=g.time+2*(1-statsFor(v).tenacity);state(v).procs.polymorphUntil=until;state(v).counters.polymorphSlow=60;state(v).counters.polymorphSlowUntil=until;v.status='요정 마법 · 변이';
 }
 if((!spell||spell.slot!=='R')&&hasAugment(u,'지옥불 영혼')&&proc(u,'infernal-soul',g.time,3))api.damage(g,u,v,30+60*(u.level-1)/17+(s.ad-s.baseAd)*.15+s.ap*.1,'지옥불 영혼','magic',true);
 if(hasAugment(u,'부식')){
  const vr=state(v),key='corrosion:'+u.id,stacks=(vr.procs[key]??0)>g.time?(vr.counters[key]??0):0;
  vr.counters[key]=Math.min(20,stacks+1);vr.procs[key]=g.time+4;
  addEffect(v,{kind:'armor-shred',value:vr.counters[key]*.015,until:g.time+4,key:key+':armor'});
  addEffect(v,{kind:'magic-shred',value:vr.counters[key]*.015,until:g.time+4,key:key+':magic'});
 }
 if(!spell){
  const repeat=hasAugment(u,'한 발에 두 놈')&&c.attackCritical?2:1;
  if(hasAugment(u,'도취'))api.damage(g,u,v,s.mana*(u.champion.stats.attackrange<300?.07:.05)*repeat,'도취','magic',true);
  if(hasAugment(u,'마법 명사수'))api.damage(g,u,v,s.ap*.75*repeat,'마법 명사수','physical',true);
  if(hasAugment(u,'불을 밝혀')&&c.fireworkAttacks%4===0)api.damage(g,u,v,15+90*(u.level-1)/17+(s.ad-s.baseAd)*.45+s.ap*.19,'불을 밝혀','magic',true);
 }
 if(spell&&v.alive&&hasAugment(u,'지옥의 전도체')&&proc(u,'conduit:'+v.id,g.time,1)){
  const key=u.id+':conduit',old=state(v).effects.find(e=>e.key===key&&e.until>g.time)?.value??0;
  addEffect(v,{kind:'burn',value:old+1+11*(u.level-1)/17+s.ap*.012+(s.ad-s.baseAd)*.28,until:g.time+5,source:u.id,key});
 }
}
export function augmentOnTakedown(g:Game,u:Unit){if(hasAugment(u,'신난다!')){state(u).counters.excitedAs=.15;state(u).counters.excitedAsUntil=g.time+4;addEffect(u,{kind:'speed',value:1,until:g.time+4,key:'excited'});}}
export function augmentHealingMultiplier(g:Game,u:Unit,amount:number){
 if(amount<=0||!hasAugment(u,'치명적 치유'))return 1;
 const c=state(u).counters,serial=c.criticalHeals=(c.criticalHeals??0)+1;
 return new Rng(g.seed+g.time*31+serial*97+Number(u.id.split('-')[1])*11+(u.team==='red'?997:0)).chance(statsFor(u).crit)?1.5:1;
}
export function augmentOnHeal(g:Game,u:Unit,restored:number,api:FighterCombat){
 if(restored<=0||!available(u)||!hasAugment(u,'죽음의 순환'))return;
 const target=foes(g,u).filter(v=>Math.abs(v.position-u.position)<=25).sort((a,b)=>Math.abs(a.position-u.position)-Math.abs(b.position-u.position))[0];
 if(target&&proc(u,'circle-of-death',g.time,1))api.damage(g,u,target,restored*.7,'죽음의 순환','magic',true);
}
export function augmentTick(g:Game,u:Unit,api:FighterCombat){
 const r=state(u),c=r.counters;
 for(const name of ['dashMove','outlaw','duelistAd','duelistAp','tapStacks','excitedAs','finalVamp','chillFlat','polymorphSlow','augmentReduction'])if((c[name+'Until']??0)<=g.time)c[name]=0;
 c.homeguard=hasAugment(u,'민병대')&&g.time-r.lastDamage>=6?1:0;
 for(const key of Object.keys(r.procs).filter(k=>k.startsWith('earthwake:')&&r.procs[k]<=g.time)){
  for(const v of foes(g,u).filter(v=>Math.abs(v.position-c[key])<=10))api.damage(g,u,v,c[key+':damage'],'대지의 각성','physical',true);
  delete c[key];delete c[key+':damage'];delete r.procs[key];
 }
 c.chaseBonus=0;if(!available(u))return;
 const near=foes(g,u).filter(v=>Math.abs(v.position-u.position)<=30),s=statsFor(u),previous=c.chasePosition??u.position;
 c.chaseBonus=hasAugment(u,'확보된 킬')&&near.some(v=>v.health/v.maxHealth<=.4&&Math.abs(v.position-u.position)<Math.abs(v.position-previous))?1:0;c.chasePosition=u.position;
 if(hasAugment(u,'대지의 영혼')&&g.time-r.lastDamage>=8&&proc(u,'mountain-soul',g.time,10))api.shield(g,u,u,s.hp*.1,'mountain-soul',10);
 if(hasAugment(u,'부메랑 투척')&&near.length&&proc(u,'boomerang',g.time,10)){
  const target=near.sort((a,b)=>Math.abs(a.position-u.position)-Math.abs(b.position-u.position))[0];api.damage(g,u,target,40+160*(u.level-1)/17+(s.ad-s.baseAd)*.22+s.ap*.15,'부메랑 투척',s.ap>s.ad-s.baseAd?'magic':'physical',true);
 }
 if(hasAugment(u,'빛의 인도자 결의')){
  if(u.health/u.maxHealth<.5&&proc(u,'dawnbringer',g.time,45)){c.dawnTicks=3;c.dawnHeal=s.hp*.1;r.procs.dawnNext=g.time;}
  if((c.dawnTicks??0)>0&&(r.procs.dawnNext??0)<=g.time){c.dawnTicks--;r.procs.dawnNext=g.time+1;api.heal(g,u,u,c.dawnHeal,true);}
 }
 if(hasAugment(u,'전술적 대비')&&proc(u,'tactical-shield',g.time,70))api.shield(g,u,u,statsFor(u).ap*3,'tactical-shield',70);
 if(hasAugment(u,'폴터가이스트')&&u.health/u.maxHealth<.5&&foes(g,u).some(v=>Math.abs(v.position-u.position)<30)&&proc(u,'poltergeist',g.time,40)){
  api.shield(g,u,u,110+330*(u.level-1)/17,'poltergeist',5);addEffect(u,{kind:'speed',value:.3,until:g.time+5,key:'poltergeist-speed'});
 }
}
export function resetAugmentCombat(u:Unit){
 const r=state(u);for(const name of ['dashMove','outlaw','duelistAd','duelistAp','tapStacks','excitedAs','finalVamp','homeguard','chaseBonus','dawnTicks','augmentReduction','polymorphSlow']){r.counters[name]=0;r.counters[name+'Until']=0;}
 delete r.procs.dawnbringer;delete r.procs.polymorphUntil;r.counters.fireworkAttacks=0;
 // Periodic AP shield is explicitly refreshed on respawn, other cooldowns persist.
 delete r.procs['tactical-shield'];
}
