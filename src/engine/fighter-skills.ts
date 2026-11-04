import type {Game,Unit,SkillSlot,Minion} from './types';
import type {Ability} from './kits';
import {abilityName,rankedAbility} from './kits';
import {skillRank} from './skill-training';
import {state,allUnits,available,addEffect,effect,proc,hasAugment,blocked} from './runtime';
import {statsFor} from './stats';
import {visibleTarget} from './evelynn';
import {awardMinionExperience} from './progression';
import type {Rng} from './rng';
import {levelGrowth,skillCost,spendResource} from './resources';

// Combat callbacks keep item/augment processing shared with the rest of the roster.
export interface FighterCombat {
 damage:typeof import('./combat-v4').applyDamage;
 heal:typeof import('./combat-v4').heal;
 shield:typeof import('./combat-v4').grantShield;
 cc:(g:Game,u:Unit,v:Unit,kind:'stun'|'root'|'slow',duration:number)=>void;
 hit:(g:Game,u:Unit,v:Unit,damage:number,spell:Ability|undefined)=>void;
 visual:typeof import('./combat-v4').visual;
}
const opponents=(g:Game,u:Unit)=>allUnits(g).filter(v=>v.team!==u.team&&available(v));
const clamp=(p:number)=>Math.max(0,Math.min(100,p));
export function fighterCanCast(g:Game,u:Unit,v:Unit|undefined,slot:SkillSlot){
 const r=state(u);
 if(u.champion.id==='Aatrox'&&slot==='E')return !!v&&available(v)&&visibleTarget(g,v)&&Math.abs(v.position-u.position)<=32;
 if(u.champion.id==='Garen'&&slot==='E')return (r.procs.garenSpinUntil??0)<=g.time;
 return true;
}
export function fighterPrefersAttack(g:Game,u:Unit,v:Unit){return u.champion.id==='Garen'&&(state(u).procs.garenQUntil??0)>g.time&&Math.abs(v.position-u.position)<=statsFor(u).attackRange;}
export function fighterCannotAttack(g:Game,u:Unit){return u.champion.id==='Garen'&&(state(u).procs.garenSpinUntil??0)>g.time;}
export function triggerBrittle(g:Game,u:Unit,v:Unit,api:FighterCombat){
 const key='brittle:'+u.id,r=state(v);
 if((r.procs[key]??0)<=g.time)return false;
 delete r.procs[key];api.damage(g,u,v,v.maxHealth*(.10+.08*(u.level-1)/17),'불안정 폭발','magic',true);return true;
}
function markBrittle(g:Game,u:Unit,v:Unit){if(v.alive){state(v).procs['brittle:'+u.id]=g.time+3;v.status='불안정';}}
function land(g:Game,u:Unit,v:Unit,n:number,a:Ability,api:FighterCombat,rng?:Rng,unavoidable=false){
 const vr=state(v),ur=state(u);
 if((vr.procs.spellshieldUntil??0)>g.time||(v.items.some(id=>['3102','3814','4632'].includes(id))&&proc(v,'banshee',g.time,35)))return false;
 if(!unavoidable&&rng?.chance(blocked(v)||effect(v,'root')?0:.12)){api.visual(g,{from:u.id,to:v.id,type:'miss',amount:0});v.status='회피';return false;}
 let amount=n*(1+(ur.counters.shojin??0))*(u.items.includes('2522')?1.15:1);
 if(hasAugment(u,'보석 건틀릿')&&rng?.chance(statsFor(u).crit))amount*=1.75;
 const before=v.health;api.damage(g,u,v,amount,abilityName(u,a.slot),a.type??'magic');
 const dealt=before-v.health;api.hit(g,u,v,dealt,a);if(statsFor(u).omnivamp)api.heal(g,u,u,dealt*statsFor(u).omnivamp,true);
 return true;
}
function clearMinions(g:Game,u:Unit,position:number,radius:number,damage:number){
 for(const m of g.world?.minions??[])if(m.team!==u.team&&m.health>0&&Math.abs(m.position-position)<=radius){
  m.health=Math.max(0,m.health-damage);if(!m.health){u.gold+=15;awardMinionExperience(g,m,u);}
 }
}
export function castFighter(g:Game,u:Unit,v:Unit|undefined,a:Ability,rng:Rng,api:FighterCombat):boolean{
 if(!['Ornn','Garen','Aatrox'].includes(u.champion.id))return false;
 const r=state(u),c=r.counters,s=statsFor(u),rank=skillRank(u,a.slot),slot=a.slot;
 if(u.champion.id==='Garen'){
  if(slot==='Q'){r.effects=r.effects.filter(e=>e.kind!=='slow');addEffect(u,{kind:'speed',value:.35,until:g.time+1+.5*rank,key:'garen-q'});r.procs.garenQUntil=g.time+4.5;r.nextAttack=g.time;}
  if(slot==='W'){r.procs.garenWUntil=g.time+1+rank;api.shield(g,u,u,45+20*rank+s.bonusHp*.20,'garen-w',.75);c.garenTenacity=.6;r.procs.garenTenacityUntil=g.time+.75;}
  if(slot==='E'){r.procs.garenSpinUntil=g.time+3;c.garenSpinTicks=0;u.status='심판 · 회전 중';}
  if(slot==='R'&&v){const damage=[150,300,450][rank-1]+(v.maxHealth-v.health)*[.25,.30,.35][rank-1];land(g,u,v,damage,a,api,rng,true);}
  return true;
 }
 if(u.champion.id==='Aatrox'){
  if(slot==='R'){c.aatroxUlt=rank;r.procs.aatroxUltUntil=g.time+10;addEffect(u,{kind:'speed',value:.4+.2*rank,until:g.time+3,key:'aatrox-r'});u.status='세계의 종결자';}
  if(slot==='E'&&v){const desired=v.position-Math.sign(v.position-u.position||1)*([23,16,5][c.aatroxQStage??0]??5);u.position=clamp(u.position+Math.max(-12,Math.min(12,desired-u.position)));r.nextAttack=g.time;}
  if(slot==='Q'&&v){
   const stage=c.aatroxQStage??0,distance=Math.abs(v.position-u.position),sweet=stage===0?distance>=19:stage===1?distance>=12:distance<=7;
   r.procs.aatroxQCooldown=r.ready.Q??g.time;
   const n=(10+15*(rank-1)+s.ad*(.6+.1*(rank-1)))*[1,1.25,1.5][stage];
   for(const t of opponents(g,u).filter(t=>Math.abs(t.position-v.position)<=a.area!&&Math.abs(t.position-u.position)<=a.range)){
    const dist=Math.abs(t.position-u.position),edge=stage===0?dist>=19:stage===1?dist>=12:dist<=7;
    if(land(g,u,t,n*(edge?1.75:1),a,api,rng)&&edge){if(proc(u,'aatroxSweetCdr',g.time,1))r.procs.aatroxPassive=Math.max(g.time,(r.procs.aatroxPassive??0)-2);if(t.alive)api.cc(g,u,t,'stun',.6);}
   }
   clearMinions(g,u,v.position,a.area!,n*.55);c.aatroxQStage=(stage+1)%3;r.procs.aatroxQWindow=g.time+4;
   r.ready.Q=stage<2?g.time+1:Math.max(g.time+1,r.procs.aatroxQCooldown);u.status=`다르킨의 검 ${stage+1}타${sweet?' · 검의 끝':''}`;
  }
  if(slot==='W'&&v&&land(g,u,v,20+10*rank+s.ad*.4,a,api,rng)){
   api.cc(g,u,v,'slow',1.5);state(v).procs['chain:'+u.id]=g.time+2;state(v).counters['chain:'+u.id]=v.position;v.status='지옥사슬 · 범위 이탈 필요';
  }
  return true;
 }
 if(!v)return true;
 if(slot==='Q'){
  c.ornnPillar=v.position;r.procs.ornnPillarUntil=g.time+4;
  for(const t of opponents(g,u).filter(t=>Math.abs(t.position-v.position)<=4))if(land(g,u,t,20+25*(rank-1)+s.ad*1.1,a,api,rng))api.cc(g,u,t,'slow',2);
  clearMinions(g,u,v.position,4,20+25*(rank-1)+s.ad*1.1);
 }
 if(slot==='W'){
  r.procs.unstoppableUntil=g.time+1;
  for(const t of opponents(g,u).filter(t=>Math.abs(t.position-u.position)<=20&&(t.position-u.position)*(v.position-u.position)>=0))if(land(g,u,t,t.maxHealth*(.10+.02*rank),a,api,rng))markBrittle(g,u,t);
  clearMinions(g,u,u.position,20,80+20*rank);
 }
 if(slot==='E'){
  u.position=clamp(v.position-Math.sign(v.position-u.position||1)*2);
  const collision=(r.procs.ornnPillarUntil??0)>g.time&&Math.abs(c.ornnPillar-u.position)<=8;
  const growth=levelGrowth(u),bonusArmor=s.armor-u.champion.stats.armor-u.champion.stats.armorperlevel*growth,bonusMr=s.mr-u.champion.stats.spellblock-u.champion.stats.spellblockperlevel*growth;
  for(const t of opponents(g,u).filter(t=>Math.abs(t.position-u.position)<=8))if(land(g,u,t,40+30*rank+.4*bonusArmor+.4*bonusMr,a,api,rng)&&collision)api.cc(g,u,t,'stun',1.25);
  if(collision){r.procs.ornnPillarUntil=0;u.status='화산 기둥 충돌 · 공중에 띄우기';}
 }
 if(slot==='R'){
  const recast=!!c.ornnRam;
  if(!recast){r.procs.ornnRCooldown=r.ready.R??g.time;c.ornnRam=1;r.procs.ornnRWindow=g.time+4;r.ready.R=g.time+1;}
  else {c.ornnRam=0;r.ready.R=Math.max(g.time+1,r.procs.ornnRCooldown);}
  for(const t of opponents(g,u).filter(t=>Math.abs(t.position-u.position)<=50&&(t.position-u.position)*(v.position-u.position)>=0)){
   if(land(g,u,t,125+50*(rank-1)+s.ap*.2,a,api,rng)){if(recast)api.cc(g,u,t,'stun',1);else api.cc(g,u,t,'slow',2);markBrittle(g,u,t);}
  }
  u.status=recast?'대장장이 신의 부름 · 되받아치기':'대장장이 신의 부름 · 불의 정령';
 }
 return true;
}
export function fighterOnAttack(g:Game,u:Unit,v:Unit,api:FighterCombat){
 const r=state(u),s=statsFor(u);if(!u.alive||!v.alive)return;
 if(u.champion.id==='Ornn'&&triggerBrittle(g,u,v,api)&&v.alive)api.cc(g,u,v,'stun',.5);
 if(u.champion.id==='Garen'&&(r.procs.garenQUntil??0)>g.time){
  r.procs.garenQUntil=0;api.damage(g,u,v,30*skillRank(u,'Q')+s.ad*.5,'결정타 강화 공격','physical');
  if(v.alive)addEffect(v,{kind:'silence',value:1,until:g.time+1.5*(1-statsFor(v).tenacity),source:u.id,key:'garen-silence'});
 }
 if(u.champion.id==='Aatrox'&&proc(u,'aatroxPassive',g.time,24-12*(u.level-1)/17)){
  const hp=v.health;api.damage(g,u,v,v.maxHealth*(.04+.06*(u.level-1)/17),'사신 태세','magic',true);api.heal(g,u,u,hp-v.health,true);
 }
}
export function advanceFighter(g:Game,u:Unit,api:FighterCombat){
 const r=state(u),c=r.counters;
 if((r.procs.garenTenacityUntil??0)<=g.time||!u.alive)c.garenTenacity=0;
 if((r.procs.aatroxUltUntil??0)<=g.time||!u.alive)c.aatroxUlt=0;
 if(c.aatroxQStage&&((r.procs.aatroxQWindow??0)<g.time||!u.alive)){c.aatroxQStage=0;r.ready.Q=Math.max(g.time,r.procs.aatroxQCooldown??0);}
 if(c.ornnRam&&((r.procs.ornnRWindow??0)<g.time||!u.alive)){c.ornnRam=0;r.ready.R=Math.max(g.time,r.procs.ornnRCooldown??0);}
 if(!u.alive){for(const key of Object.keys(r.procs).filter(k=>k.startsWith('chain:')))delete r.procs[key];r.procs.ornnPillarUntil=0;r.procs.unstoppableUntil=0;r.procs.garenSpinUntil=0;r.procs.garenQUntil=0;r.procs.garenWUntil=0;return;}
 if(u.champion.id==='Garen'&&g.time-(r.procs.garenDamagedAt??-100)>=8)api.heal(g,u,u,u.maxHealth*(.02+.10*(u.level-1)/17)/5,true);
 if(!available(u))return;
 if(u.champion.id==='Garen'&&(r.procs.garenSpinUntil??0)>=g.time&&(c.garenSpinTicks??3)<3){
  // Three one-second packets preserve the total spin count and six-hit shred.
  const a=rankedAbility(u,'E')!,s=statsFor(u),rank=skillRank(u,'E');
  const count=7+Math.floor(Math.max(0,s.attackSpeed/u.champion.stats.attackspeed-1)*4),tick=++c.garenSpinTicks;
  const spins=Math.floor(count*tick/3)-Math.floor(count*(tick-1)/3),n=(4*rank+(u.level-1)*.4+s.ad*(.30+.02*rank))*spins;
  const close=opponents(g,u).filter(t=>Math.abs(t.position-u.position)<=13).sort((a,b)=>Math.abs(a.position-u.position)-Math.abs(b.position-u.position));
  close.forEach((t,i)=>{if(land(g,u,t,n*(i===0?1.25:1)*(1+s.crit*.75),a,api,undefined,true)&&Math.floor(count*tick/3)>=6)addEffect(t,{kind:'armor-shred',value:.25,until:g.time+6,key:'garen-e'});});
  clearMinions(g,u,u.position,13,n);u.status='심판 · 회전 중';
 }
 for(const key of Object.keys(r.procs).filter(k=>k.startsWith('chain:'))){
  // Once a target leaves, re-entering before the deadline does not reattach it.
  if(Math.abs(u.position-c[key])>12){delete r.procs[key];delete c[key];continue;}
  if(r.procs[key]>g.time)continue;
  const owner=allUnits(g).find(t=>t.id===key.slice(6));delete r.procs[key];
  if(owner&&available(owner)&&Math.abs(u.position-c[key])<=12){u.position=c[key];land(g,owner,u,20+10*skillRank(owner,'W')+statsFor(owner).ad*.4,rankedAbility(owner,'W')!,api,undefined,true);u.status='지옥사슬 · 끌려옴';}
  delete c[key];
 }
}

/** Minion casts share combo clocks and spinning damage with champion combat. */
export function castFighterWave(g:Game,u:Unit,m:Minion,a:Ability){
 if(!['Ornn','Garen','Aatrox'].includes(u.champion.id))return false;
 const r=state(u),s=statsFor(u),rank=skillRank(u,a.slot);
 spendResource(u,skillCost(u,a));r.ready[a.slot]=g.time+a.cd/(1+s.haste/100);r.lastCast=a.slot;r.procs.spellblade=g.time+6;
 if(u.champion.id==='Garen'&&a.slot==='E'){r.procs.garenSpinUntil=g.time+3;r.counters.garenSpinTicks=0;}
 else if(u.champion.id==='Aatrox'&&a.slot==='Q'){
  const stage=r.counters.aatroxQStage??0;r.procs.aatroxQCooldown=r.ready.Q!;
  clearMinions(g,u,m.position,a.area??5,(a.base+s.ad*(a.ad??0))*[1,1.25,1.5][stage]*.55);
  r.counters.aatroxQStage=(stage+1)%3;r.procs.aatroxQWindow=g.time+4;r.ready.Q=stage<2?g.time+1:Math.max(g.time+1,r.procs.aatroxQCooldown);
 }else{
  if(a.slot==='Q'){r.counters.ornnPillar=m.position;r.procs.ornnPillarUntil=g.time+4;}
  const damage=a.slot==='W'?80+20*rank:a.base+s.ad*(a.ad??0)+s.armor*(a.armor??0);
  clearMinions(g,u,m.position,a.area??5,damage);
 }
 u.status=abilityName(u,a.slot)+' · 라인 정리';return true;
}
