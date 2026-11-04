import {castFighter,advanceFighter,fighterOnAttack,fighterCanCast,fighterPrefersAttack,fighterCannotAttack,triggerBrittle} from './fighter-skills';
import {demonShade,camouflaged,visibleTarget,eveDamage,eveHealThreshold} from './evelynn';
import {skillRank} from './skill-training';
import {resourceKind,currentResource,skillCost,spendResource} from './resources';
import type {Game,Unit,SkillSlot,Reaction} from './types';
import {kits,kitFor,abilityName,ultimateReady,type Ability} from './kits';
import {statsFor,refreshStats,resistanceMultiplier,buildIdentity} from './stats';
import {state,effect,addEffect,proc,hasAugment,allUnits,available,blocked} from './runtime';
import {hasItem} from './item-effects';
import {Rng} from './rng';
import balance from '../../data/encounter-balance.json';
import {awardChampionExperience,awardMinionExperience,respawnSeconds,grantBonusLevel} from './progression';
import {augmentLevels} from './augment-offers';
import {augmentHealingMultiplier,augmentOnHeal,augmentOnCast,augmentOnHit,augmentOnTakedown,augmentTick,augmentSkillHaste,resetAugmentCombat} from './augment-effects';
const fighterApi={damage:applyDamage,heal,shield:grantShield,cc:crowdControl,hit:hitProcs,visual};
export const units=allUnits;
export const healthRatio=(u:Unit)=>u.health/Math.max(1,u.maxHealth);
export const power=(u:Unit)=>{const s=statsFor(u);return s.ad*s.attackSpeed+s.ap*.6+s.hp/15+s.armor+s.mr};
export function log(g:Game,text:string,tone?:'good'|'bad'|'major'){g.logs.push({time:g.time,text,...(tone?{tone}:{})});if(g.logs.length>650)g.logs.splice(0,g.logs.length-650);}
export function visual(g:Game,e:{from?:string;to:string;type:'physical'|'magic'|'true'|'heal'|'miss';amount:number}){g.visualEvents.push({...e,at:g.time});g.visualEvents=g.visualEvents.slice(-40);}
const has=(u:Unit,...ids:string[])=>hasItem(u.items,...ids);
const enemies=(g:Game,u:Unit)=>allUnits(g).filter(v=>v.team!==u.team&&available(v)&&visibleTarget(g,v));
const friends=(g:Game,u:Unit)=>allUnits(g).filter(v=>v.team===u.team&&available(v));
export const attackName=(u:Unit,_rng:Rng)=>abilityName(u,state(u).lastCast??'Q');
export function attackReach(u:Unit,time:number){const r=state(u);return Math.max(statsFor(u).attackRange,...kitFor(u).filter(s=>s.kind==='damage'&&skillRank(u,s.slot)>0&&(s.slot!=='R'||u.level>=6)&&(r.ready[s.slot]??0)<=time&&currentResource(u,statsFor(u).resourceMax)>=skillCost(u,s)).map(s=>s.range));}
export function grantShield(g:Game,source:Unit,target:Unit,amount:number,key:string,seconds=4,linked=false){
 if(!target.alive)return;
 const value=Math.round(amount*augmentHealingMultiplier(g,source,amount)*statsFor(source).healPower*(source!==target&&hasAugment(source,'너만을 위해')?1.3:1)*(has(target,'3065')?1.25:1));
 addEffect(target,{kind:'shield',value,until:g.time+seconds,source:source.id,key});
 if(!linked)supportProcs(g,source,target,value,true);
}
export function heal(g:Game,source:Unit,target:Unit,amount:number,linked=false){
 if(!target.alive||effect(target,'stasis'))return 0;
 const restored=Math.max(0,Math.min(target.maxHealth-target.health,Math.round(amount*augmentHealingMultiplier(g,source,amount)*statsFor(source).healPower*(source!==target&&hasAugment(source,'너만을 위해')?1.3:1)*(source===target&&source.champion.id==='Aatrox'&&(state(source).counters.aatroxUlt??0)>0?1.25+.25*state(source).counters.aatroxUlt:1)*(has(target,'3065')?1.25:1)*(effect(target,'heal-cut')? .6:1))));
 target.health+=restored;augmentOnHeal(g,target,restored,fighterApi);if(restored>=10)visual(g,{from:source.id,to:target.id,type:'heal',amount:restored});
 if(!linked)supportProcs(g,source,target,restored,false);return restored;
}
function supportProcs(g:Game,u:Unit,v:Unit,amount:number,shield:boolean){
 if(u.id===v.id)return;const r=state(u);
 if(has(u,'3504'))for(const t of [u,v]){state(t).counters.ardent=.25;state(t).counters.ardentUntil=g.time+6;}
 if(has(u,'6616'))for(const t of [u,v]){Object.assign(state(t).counters,{staffAp:40,staffHaste:15,staffUntil:g.time+6});}
 if(has(u,'2526'))r.counters.supportCharge=Math.min(360,(r.counters.supportCharge??0)+12);
 if(has(u,'6620')&&(r.counters.souls??0)>0){heal(g,u,v,r.counters.souls,true);r.counters.souls=0;}
 if(u.champion.id==='Nami')addEffect(v,{kind:'speed',value:.2,until:g.time+3,key:'nami-speed'});
 if(has(u,'6617')){const other=friends(g,u).filter(t=>t!==v&&Math.abs(t.position-v.position)<20).sort((a,b)=>healthRatio(a)-healthRatio(b))[0];if(other){if(shield)grantShield(g,u,other,amount*.35,'moonstone',4,true);else heal(g,u,other,amount*.3,true);}}
}
function onKill(g:Game,u:Unit,v:Unit){
 u.kills++;u.gold+=balance.killGold+(has(u,'6676')?25:0);
 const contributors=allUnits(g).filter(a=>a.team!==v.team&&(state(a).procs['hit:'+v.id]??-1)>=g.time-5);
 for(const a of contributors){if(a!==u)a.assists++;const r=state(a);
  augmentOnTakedown(g,a);
  if(a.champion.id==='Aatrox'&&(r.procs.aatroxUltUntil??0)>g.time){r.procs.aatroxUltUntil+=5;addEffect(a,{kind:'speed',value:.4+.2*skillRank(a,'R'),until:g.time+3,key:'aatrox-r'});}
  if(has(a,'6696'))r.ready.R=Math.max(g.time,(r.ready.R??0)-20);
  if(has(a,'3137')&&proc(a,'cryptbloom',g.time,30))friends(g,a).filter(t=>Math.abs(t.position-v.position)<25).forEach(t=>heal(g,a,t,100+statsFor(a).ap*.2));
  if(has(a,'6333')){r.effects=r.effects.filter(e=>e.key!=='death-dance');heal(g,a,a,statsFor(a).ad*.8);}
 }
 if(has(u,'6664'))for(const t of enemies(g,u).filter(t=>Math.abs(t.position-v.position)<10))applyDamage(g,u,t,60+statsFor(u).hp*.02,'공허한 광휘 폭발','magic',true);
 if(u.champion.id==='Darius'&&state(u).lastCast==='R')state(u).ready.R=g.time;
 if(u.champion.id==='Vex'&&state(u).lastCast==='R')state(u).ready.R=g.time+2;
}
export function applyDamage(g:Game,attacker:Unit|undefined,victim:Unit,amount:number,cause:string,type:'physical'|'magic'|'true'='physical',secondary=false){
 if(!victim.alive||victim.portal||effect(victim,'stasis')||(state(victim).procs.untargetableUntil??0)>g.time||(state(victim).procs.augmentInvulnerableUntil??0)>g.time)return false;
 const r=state(victim);
 if(attacker?.champion.id==='Evelynn'&&!secondary){
  const ar=state(attacker),key='allure:'+attacker.id,marked=r.procs[key];
  if(marked!==undefined&&g.time-marked<=5){
   if(g.time-marked>=2.5){const rank=skillRank(attacker,'W');addEffect(victim,{kind:'charm',value:1,until:g.time+(1+.25*rank)*(1-statsFor(victim).tenacity),source:attacker.id,key:'eve-charm'});addEffect(victim,{kind:'magic-shred',value:.325+.025*rank,until:g.time+4,key:'eve-shred'});victim.status='황홀한 저주 · 매혹';if(hasAugment(attacker,'거석상의 용기')&&proc(attacker,'colossus',g.time,3))grantShield(g,attacker,attacker,attacker.maxHealth*.05,'colossus');}
   else addEffect(victim,{kind:'slow',value:.45,until:g.time+1.5,key:'eve-slow'});
   ar.mana=Math.min(statsFor(attacker).mana,ar.mana+(kitFor(attacker).find(a=>a.slot==='W')?.mana??60));delete r.procs[key];
  }
  ar.procs.shadeReady=g.time+4;
 }
 const s=statsFor(victim),a=attacker?statsFor(attacker):undefined;
 let resist=type==='physical'?s.armor:type==='magic'?s.mr:0;
 if(a&&type==='physical')resist=Math.max(0,resist*(1-a.armorPen)-a.lethality);
 if(a&&type==='magic')resist=Math.max(0,resist*(1-a.magicPen)-a.flatMagicPen);
 let damage=Math.max(0,Math.round(amount*resistanceMultiplier(resist)*(attacker?1-Math.min(.6,effect(attacker,'weaken')):1)));
 if(attacker&&hasAugment(attacker,'천상의 신체'))damage=Math.round(damage*.9);
 damage=Math.round(damage*(1-(r.counters.augmentReduction??0)));
 if(type!=='true'&&victim.champion.id==='Garen'&&(r.procs.garenWUntil??0)>g.time)damage=Math.round(damage*.7);
 if(attacker&&has(attacker,'3147','6653','4633'))damage=Math.round(damage*(1+Math.min(has(attacker,'4633')?.08:.06,(state(attacker).counters.combatSeconds??0)*.02)));
 if(attacker&&type==='magic'&&allUnits(g).some(a=>a.team===attacker.team&&available(a)&&has(a,'8020')&&Math.abs(a.position-victim.position)<20))damage=Math.round(damage*1.12);
 if(attacker&&has(attacker,'4645')&&type!=='physical'&&healthRatio(victim)<.4)damage=Math.round(damage*1.2);
 if(attacker&&hasAugment(attacker,'거인 학살자'))damage=Math.round(damage*(1+Math.min(.3,.1+Math.max(0,victim.maxHealth-attacker.maxHealth)/10000)));
 if(attacker&&has(victim,"2051")&&!secondary)damage=Math.max(0,damage-15);
 if(!secondary&&has(victim,'6333')&&type!=='true'){const delayed=damage*.25;damage-=delayed;addEffect(victim,{kind:'burn',value:delayed/3,until:g.time+3,source:attacker?.id,key:'death-dance'});}
 // Auto defensive item activation is part of this observer simulator.
 if(victim.health-damage<victim.maxHealth*.3){
  if(has(victim,'3157','2420')&&proc(victim,'stasis',g.time,90)){addEffect(victim,{kind:'stasis',value:1,until:g.time+2.5,key:'stasis'});victim.status='존야 · 경직';if(has(victim,'2420'))victim.items=victim.items.map(id=>id==='2420'?'2421':id);log(g,victim.champion.name+': 경직으로 공격을 피했습니다.','major');return false;}
  if(has(victim,'3053','6673','2525')&&proc(victim,'lifeline',g.time,60)){grantShield(g,victim,victim,150+s.bonusHp*.5,'lifeline',5);if(has(victim,'2525')){r.counters.growthHp=150+s.hp*.15;r.counters.growthUntil=g.time+5;refreshStats(victim);heal(g,victim,victim,r.counters.growthHp);}}
  if(type==='magic'&&has(victim,'3155','3156')&&proc(victim,'magic-lifeline',g.time,60)){grantShield(g,victim,victim,180+s.ad*.8,'magic-lifeline',5);if(has(victim,'3156')){r.counters.mawVamp=.1;r.counters.mawUntil=g.time+8;}}
  if(victim.champion.id==='Blitzcrank'&&proc(victim,'mana-barrier',g.time,60))grantShield(g,victim,victim,r.mana*.3,'mana-barrier',6);
 }
 if(victim.champion.id==='Yasuo'&&(r.flow??0)>=100&&damage>0&&attacker){r.flow=0;grantShield(g,victim,victim,s.hp*.1,'flow-shield',2,true);}
 if(attacker&&has(attacker,'6695'))for(const e of r.effects.filter(e=>e.kind==='shield'))e.value*=.5;
 for(const shield of r.effects.filter(e=>e.kind==='shield'&&(!e.key?.startsWith('magic-')||type==='magic'))){const absorb=Math.min(damage,shield.value);shield.value-=absorb;damage-=absorb;}
 if(!secondary){const protector=friends(g,victim).find(t=>t!==victim&&has(t,'3109')&&healthRatio(t)>.3&&Math.abs(t.position-victim.position)<16);if(protector){const share=damage*.14;damage-=share;applyDamage(g,attacker,protector,share,'기사의 맹세 피해 분담','true',true);}}
 const dealt=Math.min(victim.health,Math.round(damage));victim.health-=dealt;victim.taken+=dealt;r.lastDamage=g.time;
 if(dealt>0)r.counters.homeguard=0;
 if(attacker||cause.includes('포탑'))r.procs.garenDamagedAt=g.time;
 if(attacker?.champion.id==='Aatrox'&&attacker!==victim&&skillRank(attacker,'E')>0&&cause!=='가시 반사')heal(g,attacker,attacker,dealt*(.16+statsFor(attacker).bonusHp*.00013),true);
 if(type==='magic')r.counters.magicHits=(r.counters.magicHits??0)+1;
 if(attacker&&g.world&&!secondary)for(const b of g.world.buildings.filter(b=>b.team===victim.team&&b.alive&&Math.abs(attacker.position-b.position)<14)){b.targetId=attacker.id;b.aggroUntil=g.time+4;}
 if(attacker){attacker.damage+=dealt;state(attacker).procs['hit:'+victim.id]=g.time;}
 if(dealt){visual(g,{from:attacker?.id,to:victim.id,amount:dealt,type});log(g,cause+' — '+victim.champion.name+' -'+dealt);}
 if(victim.health>0){
  if(attacker&&attacker!==victim&&!secondary&&dealt>0&&hasAugment(attacker,'유리 대포'))return applyDamage(g,attacker,victim,dealt*.25,'유리 대포','true',true);
  return false;
 }
 victim.augmentClaims=Math.min(augmentLevels.length,Math.max(victim.augmentClaims??1,augmentLevels.filter(level=>victim.level>=level).length));victim.alive=false;victim.returningToBase=false;victim.deaths++;victim.atFountain=false;victim.status='부활 대기';victim.diedAt=g.time;victim.deathDuration=respawnSeconds(victim.level,g.time);victim.respawnAt=g.time+victim.deathDuration;r.effects=[];
 resetAugmentCombat(victim);
 awardChampionExperience(g,victim,attacker);
 if(attacker)onKill(g,attacker,victim);
 log(g,victim.champion.name+' 처치'+(attacker?' · '+attacker.champion.name:''),victim.team==='red'?'good':'bad');return true;
}
function crowdControl(g:Game,u:Unit,v:Unit,kind:'stun'|'root'|'slow',duration:number){
 if(!v.alive||state(v).procs.spellshieldUntil>g.time||(state(v).procs.unstoppableUntil??0)>g.time)return;
 if(kind!=='slow'){for(const smith of allUnits(g).filter(t=>t.team===u.team&&t.champion.id==='Ornn'))if(triggerBrittle(g,smith,v,fighterApi)){duration*=1.3;if(!v.alive)return;}}
 const strength=kind==='slow'?.3:1;addEffect(v,{kind,value:strength,until:g.time+duration*(1-statsFor(v).tenacity),source:u.id,key:kind+u.id});
 if(kind==='slow'&&hasAugment(u,'차가운 냉기')){state(v).counters.chillFlat=75;state(v).counters.chillFlatUntil=g.time+duration*(1-statsFor(v).tenacity);}
 if(kind!=='slow'&&hasAugment(u,'거석상의 용기')&&proc(u,'colossus',g.time,3))grantShield(g,u,u,u.maxHealth*.05,'colossus');
 if(has(u,'4005'))state(v).procs['mandate:'+u.id]=g.time+4;
 if(has(u,'3119')&&(state(u).counters.manaCharge??0)>=360&&proc(u,'winter',g.time,8))grantShield(g,u,u,80+statsFor(u).mana*.05,'winter');
 if(has(u,'2524'))for(const t of friends(g,u).filter(t=>Math.abs(t.position-u.position)<20)){state(t).counters.ardent=.2;state(t).counters.ardentUntil=g.time+6;}
}
function burn(g:Game,u:Unit,v:Unit,amount:number,key:string,duration=3){addEffect(v,{kind:'burn',value:amount,until:g.time+duration,source:u.id,key:u.id+key});}
function hitProcs(g:Game,u:Unit,v:Unit,damage:number,spell:Ability|undefined){
 const s=statsFor(u),r=state(u);
 augmentOnHit(g,u,v,damage,spell,fighterApi);
 if(!spell&&damage>0&&hasAugment(u,'신비한 주먹'))for(const slot of ['Q','W','E','R'] as const)r.ready[slot]=Math.max(g.time,(r.ready[slot]??g.time)-1.25);
 if(u.champion.id==='Aatrox'&&damage>0&&(!spell||proc(u,'aatroxSpellCdr',g.time,1)))r.procs.aatroxPassive=Math.max(g.time,(r.procs.aatroxPassive??0)-2);
 if(!v.alive)return;
 if(u.champion.id==='Evelynn'&&spell?.slot!=='W'){const vr=state(v),key='eve-q:'+u.id;if((vr.procs[key]??-1)>g.time&&(vr.counters[key]??0)>0){vr.counters[key]--;applyDamage(g,u,v,5+10*skillRank(u,'Q')+.25*s.ap,'증오의 가시 표식','magic',true);}}
 const extra=(n:number,type:'physical'|'magic'|'true'='magic',label='추가 효과')=>applyDamage(g,u,v,n,label,type,true);
 if(has(u,'6620'))r.counters.souls=Math.min(300,(r.counters.souls??0)+damage*.3);
 const hitType=spell?(spell.type??'magic'):'physical';
 if(hitType==='physical'&&has(u,'3033','3123','6609')||hitType==='magic'&&has(u,'3165','3916'))addEffect(v,{kind:'heal-cut',value:.4,until:g.time+3,key:'wounds'});
 if(hitType==='physical'&&has(u,'3071'))addEffect(v,{kind:'armor-shred',value:.06,until:g.time+6});
 if(hitType==='magic'&&has(u,'8010')){state(v).counters.mrShred=Math.min(.3,(state(v).counters.mrShred??0)+.075);state(v).counters.mrShredUntil=g.time+6;}
 if(has(u,'3145')&&proc(u,'alternator',g.time,20))extra(45+s.ap*.1);
 if(has(u,'4646')&&damage>v.maxHealth*.2&&proc(u,'stormsurge',g.time,25)){state(v).procs['storm:'+u.id]=g.time+2;state(v).counters['storm:'+u.id]=120+s.ap*.24;}
 if(has(u,'6692')){const prev=r.procs.eclipseHit??-99;r.procs.eclipseHit=g.time;if(g.time-prev<=3&&proc(u,'eclipse',g.time,8))grantShield(g,u,u,100+s.ad*.3,'eclipse',2);}
 if(has(u,'4629')&&spell)addEffect(u,{kind:'speed',value:.12,until:g.time+4,key:'cosmic'});
 for(const mark of Object.keys(state(v).procs).filter(k=>k.startsWith('mandate:')&&state(v).procs[k]>=g.time&&k!=='mandate:'+u.id)){extra(v.maxHealth*.04);state(v).procs[mark]=-1;}
 if(spell){
  const stackGain=hasAugment(u,'다단 중첩')?2:1;
  if(hasAugment(u,'극악무도')&&proc(u,'phenomenal',g.time,1))r.counters.permanentAp=(r.counters.permanentAp??0)+stackGain;
  if(u.champion.id==='Veigar')r.counters.permanentAp=(r.counters.permanentAp??0)+stackGain;
  if(hasAugment(u,'마법 미사일')&&proc(u,'missiles',g.time,1))extra(v.maxHealth*.03*Math.min(1,Math.abs(u.position-v.position)/25),'true','마법 미사일');
  if(has(u,'6653'))burn(g,u,v,v.maxHealth*.02,'liandry');
  if(has(u,'2503','2508'))burn(g,u,v,has(u,'2503')?10+s.ap*.04:5,'blackfire');
  if(has(u,'3118')&&spell.slot==='R')burn(g,u,v,15+s.ap*.06,'malignance');
  if(has(u,'3116','6694'))crowdControl(g,u,v,'slow',2);
  if(has(u,'6655')&&proc(u,'luden',g.time,10)){for(const t of enemies(g,u).filter(t=>Math.abs(t.position-v.position)<9).slice(0,3))applyDamage(g,u,t,55+s.ap*.1,'루덴 메아리','magic',true);}
  if(has(u,'3161'))r.counters.shojin=Math.min(.12,(r.counters.shojin??0)+.03);
  if(u.champion.id==='Lux')state(v).procs['lux:'+u.id]=g.time+6;
  if(u.champion.id==='Leona')state(v).procs['sunlight:'+u.id]=g.time+4;
  if(u.champion.id==='Morgana')heal(g,u,u,damage*.15,true);
  if(u.champion.id==='Ahri'){r.counters.essence=(r.counters.essence??0)+1;if(r.counters.essence%9===0)heal(g,u,u,70+s.ap*.25);}
 }
 if(!spell||u.champion.id==='Evelynn'&&spell.slot==='E'){
  const repeat=(!spell&&hasAugment(u,'한 발에 두 놈')&&r.counters.attackCritical?1:0)+(has(u,'3124')&&(r.counters.attacks??0)%3===0?2:1)+((r.procs.spellblade??0)>=g.time&&has(u,'2510')?1:0);
  if(hasAugment(u,'강타자'))extra(u.maxHealth*.025*repeat,'physical','강타자');
  if(hasAugment(u,'감쇠 광선'))addEffect(v,{kind:'weaken',value:.15,until:g.time+3,key:'shrink'});
  if(has(u,'3004')&&(r.counters.manaCharge??0)>=360)extra(s.mana*.025,'physical','마나 충격');
  if(has(u,'3004'))r.counters.manaCharge=Math.min(360,(r.counters.manaCharge??0)+3);
  if(has(u,'1043'))extra(15*repeat,'physical');
  if(has(u,'3115'))extra((15+s.ap*.2)*repeat);
  if(has(u,'3091','3124','3302'))extra(30*repeat);
  if(has(u,'3153')){extra(v.health*.06*repeat,'physical','몰락한 왕의 검');if(r.counters.attacks%3===0)crowdControl(g,u,v,'slow',1);}
  if(has(u,'6672')&&r.counters.attacks%3===0)extra(75+s.ad*.4,'physical','크라켄 3타');
  if(has(u,'3181')&&r.counters.attacks%5===0)extra(50+s.bonusHp*.03,'physical','선체파괴자');
  if(has(u,'3748'))extra(5+s.hp*.015,'physical');
  if(has(u,'3084')&&Math.abs(u.position-v.position)<12&&proc(u,'heart:'+v.id,g.time,30)){const n=70+s.hp*.06;extra(n,'physical','강철심장');r.counters.permanentHp=(r.counters.permanentHp??0)+Math.round(n*.1);refreshStats(u);}
  if(has(u,'6610')&&proc(u,'sundered:'+v.id,g.time,8)){extra(s.ad*.5,'physical');heal(g,u,u,30+(u.maxHealth-u.health)*.08);}
  if((r.procs.spellblade??0)>=g.time&&has(u,'3057','3078','3100','6662','3508','2510')){r.procs.spellblade=-1;extra(has(u,'3100')?s.baseAd*.75+s.ap*.4:has(u,'3078')?s.baseAd*2:s.baseAd,has(u,'3100','2510')?'magic':'physical','주문 검');if(has(u,'6662'))crowdControl(g,u,v,'slow',2);if(resourceKind(u)==='mana'&&has(u,'3508'))r.mana=Math.min(s.mana,r.mana+40);if(has(u,'2510'))heal(g,u,u,40);if(has(u,'3078'))addEffect(u,{kind:'speed',value:.06,until:g.time+2,key:'trinity-speed'});}
  if(has(u,'3087','3094','3095','6699')&&proc(u,'energized',g.time,8)){extra(has(u,'6699')?v.health*.05:60);if(has(u,'3095'))addEffect(u,{kind:'speed',value:.45,until:g.time+2,key:'stormrazor-speed'});if(has(u,'3087'))enemies(g,u).filter(t=>t!==v&&Math.abs(t.position-v.position)<10).slice(0,2).forEach(t=>applyDamage(g,u,t,50,'연쇄 번개','magic',true));}
  if(has(u,'3742')&&(r.counters.moved??0)>=10){extra(40+s.baseAd*.5,'physical','망자의 갑옷');r.counters.moved=0;}
  if(has(u,'3044'))addEffect(u,{kind:'speed',value:.06,until:g.time+2,key:'phage'});
  if(has(u,'3144')&&proc(u,'slingshot',g.time,12))extra(40,'magic','정찰병 새총');
  const splash=has(u,'3077','3074','3748','6631','6698')?s.ad*.35:has(u,'3085')?s.ad*.4:0;
  if(splash)enemies(g,u).filter(t=>t!==v&&Math.abs(t.position-v.position)<8).slice(0,2).forEach(t=>applyDamage(g,u,t,splash*(has(u,'6698')&&healthRatio(t)<.5?1.5:1),'주변 타격','physical',true));
  if(has(u,'6675'))for(const slot of ['Q','W','E'] as SkillSlot[])r.ready[slot]=g.time+Math.max(0,(r.ready[slot]??0)-g.time)*.85;
  if(u.champion.id==='Ashe')crowdControl(g,u,v,'slow',2);
  if(u.champion.id==='Lux'&&(state(v).procs['lux:'+u.id]??0)>g.time){extra(20+u.level*5+s.ap*.2);state(v).procs['lux:'+u.id]=-1;}
  if((r.counters.ardent??0)>0)extra(20);
  if(u.champion.id==='Sona'&&(r.counters.chord??0)>=3){extra(30+u.level*5+s.ap*.2);r.counters.chord=0;}
  if(effect(u,'empower'))extra(effect(u,'empower'));
  if(has(v,'3075','3076')){applyDamage(g,v,u,has(v,'3075')?15+statsFor(v).armor*.15:10,'가시 반사','magic',true);addEffect(u,{kind:'heal-cut',value:.4,until:g.time+3,key:'thorns'});}
 }
 if(u.champion.id==='Kaisa'){const k='plasma:'+u.id;state(v).counters[k]=(state(v).counters[k]??0)+(spell?.slot==='W'?2:1);if(state(v).counters[k]>=5){state(v).counters[k]=0;extra(50+s.ap*.25+(v.maxHealth-v.health)*.12,'magic','플라즈마 폭발');}}
 if(u.champion.id==='Darius'&&spell?.slot!=='E'){const k='bleed:'+u.id;state(v).counters[k]=Math.min(5,(state(v).counters[k]??0)+1);burn(g,u,v,state(v).counters[k]*(3+s.ad*.025),'bleed',5);}
 for(const mark of Object.keys(state(v).procs).filter(k=>k.startsWith('sunlight:')&&k!=='sunlight:'+u.id&&state(v).procs[k]>=g.time)){extra(20+u.level*4,'magic','햇빛');state(v).procs[mark]=-1;}
 if(has(u,'6676')&&healthRatio(v)<.05)extra(v.health+1,'true','징수 처형');
}
export function castAbility(g:Game,u:Unit,v:Unit|undefined,slot:SkillSlot,rng:Rng){
 const spell=kitFor(u).find(s=>s.slot===slot),r=state(u),s=statsFor(u);
 if((r.procs.polymorphUntil??0)>g.time||!spell||!skillRank(u,slot)||!available(u)||blocked(u)||effect(u,'silence')||!fighterCanCast(g,u,v,slot)||(slot==='R'&&u.level<6)||(r.ready[slot]??0)>g.time)return false;
 const recast=u.champion.id==='Evelynn'&&slot==='Q'&&(r.counters.qRecasts??0)>0&&(r.procs.qWindow??0)>=g.time;
 if(spell.special==='allure'&&(!v||!available(v)||!visibleTarget(g,v)||Math.abs(u.position-v.position)>spell.range))return false;
 const cost=recast?0:skillCost(u,spell);if(currentResource(u,s.resourceMax)<cost)return false;
 if(spell.kind==='damage'&&(!v||!available(v)||!visibleTarget(g,v)||Math.abs(u.position-v.position)>spell.range))return false;
 if((spell.dash||spell.special==='last-caress')&&effect(u,'root'))return false;
 if(spell.special==='dive-shield'&&(!v||!available(v)||!visibleTarget(g,v)||Math.abs(u.position-v.position)>spell.range||(state(v).counters['plasma:'+u.id]??0)===0))return false;
 let targets:Unit[]=[];
 if(spell.kind==='heal'||spell.kind==='shield'){const pool=friends(g,u).filter(t=>Math.abs(t.position-u.position)<=spell.range).sort((a,b)=>healthRatio(a)-healthRatio(b));
  const target=spell.special==='dive-shield'?u:pool[0];if(!target)return false;
  if(spell.kind==='heal'&&healthRatio(target)>.85)return false;
  if(spell.kind==='shield'&&effect(target,'shield')>s.hp*.1)return false;
  targets=spell.area?pool.filter(t=>Math.abs(t.position-target.position)<=spell.area!):[target];
 }
 if(!spendResource(u,cost))return false;const haste=s.haste+augmentSkillHaste(u,spell)+(slot==='R'&&has(u,'3118','3073','2512')?25:0)+(slot!=='R'&&has(u,'3161')?25:0);
 r.ready[slot]=g.time+Math.max(1,spell.cd/(1+haste/100));r.lastCast=slot;r.procs.spellblade=g.time+6;r.counters.chord=(r.counters.chord??0)+1;
 u.cooldownUntil=Math.min(...kitFor(u).filter(a=>a.kind==='damage'&&a.slot!=='R').map(a=>r.ready[a.slot]??g.time));
 log(g,u.champion.name+': '+slot+' '+abilityName(u,slot));
 augmentOnCast(g,u,spell,fighterApi);
 if(resourceKind(u)==='mana'&&has(u,'3803','6657'))heal(g,u,u,cost*.25,true);
 if(has(u,'3070','3003','3004','3119'))r.counters.manaCharge=Math.min(360,(r.counters.manaCharge??0)+6);
 if(slot==='R'&&!(u.champion.id==='Ornn'&&r.counters.ornnRam)){
  if(has(u,'3073','2512')){r.counters.ultSpeed=.5;r.counters.ultSpeedUntil=g.time+8;r.counters.ultShots=has(u,'2512')?3:0;addEffect(u,{kind:"speed",value:.15,until:g.time+8,key:"ult-speed"});}
  if(has(u,'3050'))for(const t of enemies(g,u).filter(t=>Math.abs(t.position-u.position)<14)){crowdControl(g,u,t,'slow',3);burn(g,u,t,30,'zeke');}
  if(hasAugment(u,'궁극기 대변혁')&&proc(u,'ultimate-recast',g.time,75)){r.ready.R=g.time+1;log(g,u.champion.name+': 궁극기 대변혁 — 궁극기를 다시 사용할 수 있습니다.','major');}
 }
 if(castFighter(g,u,v,spell,rng,fighterApi))return true;
 const amount=(spell.base+spell.growth*(u.level-1)+s.ap*spell.ap+s.ad*(spell.ad??0)+s.armor*(spell.armor??0)+s.hp*(spell.hp??0))*(has(u,'2522')?1.15:1);
 if(spell.kind==='heal'||spell.kind==='shield'){
  if(spell.special==='dive-shield'&&v)u.position=Math.max(0,Math.min(100,v.position+(u.team==='blue'?-3:3)));
  for(const t of targets){if(spell.kind==='heal')heal(g,u,t,amount);else grantShield(g,u,t,amount,u.id+slot);
   if(spell.special==='shield-ad')addEffect(t,{kind:'empower',value:15+s.ap*.1,until:g.time+4,key:'janna-ad'});
   if(spell.special==='spellshield')state(t).procs.spellshieldUntil=g.time+4;
   if(spell.special==='heal-shield')grantShield(g,u,t,amount*.5,u.id+'sona');
  }
  if(spell.special==='bounce'&&v&&Math.abs(u.position-v.position)<26){applyDamage(g,u,v,amount,'나미 밀물 썰물','magic');}
  if(spell.special==='disengage')for(const t of enemies(g,u).filter(t=>Math.abs(t.position-u.position)<16)){t.position=Math.max(0,Math.min(100,t.position+(u.team==='blue'?8:-8)));crowdControl(g,u,t,'slow',2);}
  return true;
 }
 if(u.champion.id==='Evelynn'&&slot!=='W')r.procs.shadeReady=g.time+4;
 if(spell.special==='allure'&&v){state(v).procs['allure:'+u.id]=g.time;v.status='황홀한 저주 · 숙성 중';return true;}
 if(spell.special==='hate-spike'){
  if(recast){r.counters.qRecasts--;r.ready.Q=g.time+(r.counters.qRecasts?1:spell.cd/(1+haste/100));}
  else {r.counters.qRecasts=3;r.procs.qWindow=g.time+4;r.ready.Q=g.time+1;}
 }
 if(spell.kind==='buff'){
  if(spell.special==='flurry'){r.counters.flurry=.2+.05*skillRank(u,slot);r.counters.flurryUntil=g.time+5;}
  if(spell.special==='overdrive'){r.counters.overdrive=.3+.05*skillRank(u,slot);r.counters.overdriveUntil=g.time+5;addEffect(u,{kind:'speed',value:.2+.025*skillRank(u,slot),until:g.time+5,key:'overdrive'});}
  if(spell.special==='windwall'){grantShield(g,u,u,80+skillRank(u,slot)*40,'windwall',4);r.procs.spellshieldUntil=g.time+2;}
  if(spell.special==='team-speed')for(const t of friends(g,u))addEffect(t,{kind:'speed',value:.15+.025*skillRank(u,slot),until:g.time+4,key:'sona-speed'});
  if(spell.special==='ally-empower'){const t=friends(g,u).sort((a,b)=>statsFor(b).attackSpeed-statsFor(a).attackSpeed)[0];if(t)addEffect(t,{kind:'empower',value:amount,until:g.time+6,key:'nami-e'});}
  if(spell.special==='scout')r.procs.scout=g.time+8;
  return true;
 }
 if(!v)return true;
 if(spell.dash)u.position=v.position+(u.team==='blue'?-2:2);
 if(spell.pull)v.position=u.position+(u.team==='blue'?3:-3);
 if(spell.special==='resist')r.counters.resistUntil=g.time+5;
 if(spell.special==='self-shield')grantShield(g,u,u,60+s.ap*.6,'vex-w');
 let rushRefund=false;
 const group=spell.special==='last-caress'?enemies(g,u).filter(t=>Math.abs(t.position-u.position)<=spell.range&&(t.position-u.position)*(v.position-u.position)>=0):spell.area?enemies(g,u).filter(t=>Math.abs(t.position-v.position)<=spell.area!):[v];
 for(const t of group){
  if((state(t).procs.spellshieldUntil??-1)>g.time||(has(t,'3102','3814','4632')&&proc(t,'banshee',g.time,35))){log(g,t.champion.name+': 주문 보호막이 '+abilityName(u,slot)+' 차단');continue;}
  const dodge=spell.dash||spell.special==='cage'||spell.special==='whiplash'||spell.special==='last-caress'?0:.08+(effect(t,'stun')||effect(t,'root')?-.08:statsFor(t).moveSpeed/325*.04);
  if(rng.chance(dodge)){visual(g,{from:u.id,to:t.id,type:'miss',amount:0});t.status='회피';continue;}
  let n=(u.champion.id==='Evelynn'&&slot!=='W'?eveDamage(u,t,slot,!!r.counters.empoweredE):amount)*(1+(r.counters.shojin??0));if(hasAugment(u,'보석 건틀릿')&&rng.chance(s.crit))n*=1.75;
  if(spell.special==='missing-health')n*=1+(1-healthRatio(t));
  if(spell.special==='execute')n*=1+(state(t).counters['bleed:'+u.id]??0)*.2;
  if(spell.special==='orb')n*=1.5;
  const before=t.health;if(n>0){applyDamage(g,u,t,n,abilityName(u,slot),spell.type??'magic');hitProcs(g,u,t,before-t.health,spell);}
  if(u.champion.id==='Evelynn'&&t.alive&&slot==='Q'&&!recast){state(t).counters['eve-q:'+u.id]=3;state(t).procs['eve-q:'+u.id]=g.time+4;}
  if(u.champion.id==='Kennen'){const tr=state(t),key='kennen:'+u.id;tr.counters[key]=(tr.procs[key]??0)>g.time?(tr.counters[key]??0)+1:1;tr.procs[key]=g.time+6;if(tr.counters[key]>=3){tr.counters[key]=0;if(t.alive)crowdControl(g,u,t,'stun',1.25);r.energy=Math.min(s.energy,(r.energy??0)+25);}if(spell.special==='lightning-rush'&&!rushRefund){rushRefund=true;r.energy=Math.min(s.energy,(r.energy??0)+40);}}
  if(t.alive&&spell.cc)crowdControl(g,u,t,spell.cc,spell.duration??2);
  if(t.alive&&u.champion.id==='Vex'&&proc(u,'doom',g.time,14))crowdControl(g,u,t,'stun',1.5);
  if(spell.special==='tornado'){r.counters.tornado=(r.counters.tornado??0)+1;if(r.counters.tornado%3===0&&t.alive)crowdControl(g,u,t,'stun',1);}
  if(spell.special==='heal-cleave')heal(g,u,u,(u.maxHealth-u.health)*.12);
  if(spell.special==='attack-slow'){state(t).counters.frozen=1;state(t).counters.frozenUntil=g.time+3;}
  if(spell.special==='steal-speed')addEffect(u,{kind:'speed',value:.15,until:g.time+3,key:'malphite-q'});
  if(s.omnivamp)heal(g,u,u,(before-t.health)*s.omnivamp,true);
 }
 if(spell.special==='whiplash'){r.counters.empoweredE=0;addEffect(u,{kind:'speed',value:.25+.05*skillRank(u,'E'),until:g.time+2,key:'eve-e-speed'});}
 if(spell.special==='last-caress'){u.position=Math.max(0,Math.min(100,u.position-Math.sign(v.position-u.position|| (u.team==='blue'?1:-1))*700/25));r.procs.untargetableUntil=g.time+.35;r.procs.shadeReady=g.time+1.25;r.procs.shadeResetDamage=r.lastDamage;u.status='최후의 포옹 · 후방 이탈';}
 // Area spells clear nearby minions with the same champion scaling.
 if(spell.area&&g.world)for(const m of g.world.minions.filter(m=>m.health>0&&m.team!==u.team&&Math.abs(m.position-v.position)<spell.area!)){m.health=Math.max(0,m.health-amount*.65);if(m.health===0){u.gold+=15;awardMinionExperience(g,m,u);}}
 return true;
}
export function resolveAttack(g:Game,u:Unit,v:Unit,rng:Rng,options:{multiplier?:number;victimAction?:Reaction;coverer?:Unit;action?:Reaction;allowDash?:boolean;holdUltimate?:boolean}={}){
 if(!available(u)||!available(v)||!visibleTarget(g,v)||blocked(u))return false;
 const r=state(u),s=statsFor(u),wasAlive=v.alive;
 if(u.champion.id==='Evelynn'){const marked=state(v).procs['allure:'+u.id];if(marked!==undefined&&g.time-marked<2.5&&healthRatio(u)>.3){u.status='황홀한 저주 숙성 대기';return false;}}
 const preferAttack=fighterPrefersAttack(g,u,v);
 const allowed=(a:Ability)=>!preferAttack&&!(a.dash&&options.allowDash===false||a.slot==='R'&&options.holdUltimate);
 const support=kitFor(u).filter(a=>allowed(a)&&(a.kind==='heal'||a.kind==='shield'));
 const hurt=friends(g,u).some(t=>healthRatio(t)<.65&&Math.abs(t.position-u.position)<25);
 if(hurt)for(const a of support)if(castAbility(g,u,v,a.slot,rng))return !v.alive;
 for(const a of kitFor(u).filter(a=>allowed(a)&&a.kind==='buff'))if(castAbility(g,u,v,a.slot,rng))return false;
 const distance=Math.abs(v.position-u.position),offensive=kitFor(u).filter(a=>allowed(a)&&a.kind==='damage'&&a.range>=distance);
 const priority=offensive.sort((a,b)=>(b.slot==='R'?10:0)+(b.cc?3:0)-(a.slot==='R'?10:0)-(a.cc?3:0));
 for(const a of priority){if(u.champion.id==='Garen'&&a.slot==='R'&&v.health>([150,300,450][Math.max(0,skillRank(u,'R')-1)]+(v.maxHealth-v.health)*(.2+.05*skillRank(u,'R')))&&healthRatio(u)>.2)continue;if(u.champion.id==='Evelynn'&&a.slot==='R'&&healthRatio(v)>=.3&&healthRatio(u)>.25)continue;if(a.dash&&options.allowDash===false||a.slot==='R'&&(options.holdUltimate||options.action==='poke'&&healthRatio(v)>.45))continue;if(castAbility(g,u,v,a.slot,rng))return wasAlive&&!v.alive;}
 if((r.procs.polymorphUntil??0)>g.time||fighterCannotAttack(g,u)||r.nextAttack>g.time||distance>s.attackRange)return false;
 const swings=s.attackSpeed>1?Math.floor(s.attackSpeed)+(rng.chance(s.attackSpeed%1)?1:0):1;
 r.nextAttack=g.time+Math.max(1,1/s.attackSpeed);r.counters.attacks=(r.counters.attacks??0)+1;
 let critical=rng.chance(s.crit)||(r.counters.ultShots??0)>0;if(r.counters.ultShots)r.counters.ultShots--;
 r.counters.attackCritical=critical?1:0;
 let damage=s.ad*(critical?(has(u,'3031')?2.05:1.75):1)*(options.multiplier??1);
 if(has(v,'3047'))damage*=.9;if(has(v,'3082'))damage=Math.max(0,damage-8);if(critical&&has(v,'3143'))damage*=.7;
 if(options.coverer){damage*=.65;g.encounter?.protections.push({protector:options.coverer.id,protected:v.id});log(g,options.coverer.champion.name+'의 엄호가 피해를 줄였습니다.');}
 if(has(u,"3036"))damage*=1+Math.min(.15,statsFor(v).bonusHp/10000);if(has(u,"2523"))damage*=1+Math.min(.1,distance/250);
 if(u.champion.id==='Evelynn')r.procs.shadeReady=g.time+4;
 const before=v.health;for(let hit=0;hit<swings&&u.alive&&v.alive;hit++){const prior=v.health;applyDamage(g,u,v,damage,u.champion.name+" 기본 공격","physical");hitProcs(g,u,v,prior-v.health,undefined);fighterOnAttack(g,u,v,fighterApi);if(hit<swings-1)r.counters.attacks++;}
 const recovered=(before-v.health)*(s.lifesteal+s.omnivamp+(critical&&hasAugment(u,'영혼 흡수')?.12:0)),missing=u.maxHealth-u.health;heal(g,u,u,recovered,true);
 if(has(u,"3072")&&recovered>missing)grantShield(g,u,u,Math.min(200,effect(u,"shield")+recovered-missing),"bloodthirster",10,true);
 return wasAlive&&!v.alive;
}
export function supportTurn(g:Game,u:Unit,rng:Rng,options:{allowDash?:boolean;holdUltimate?:boolean}={}){
 if(!available(u)||blocked(u))return;
 const hurt=friends(g,u).some(t=>healthRatio(t)<.7&&Math.abs(t.position-u.position)<25);
 for(const a of kitFor(u).filter(a=>!(a.dash&&options.allowDash===false||a.slot==='R'&&options.holdUltimate)&&(hurt?(a.kind==='heal'||a.kind==='shield'):a.kind==='buff'&&enemies(g,u).some(t=>Math.abs(t.position-u.position)<25))))if(castAbility(g,u,undefined,a.slot,rng))break;
}
export function advanceCombat(g:Game){
 for(const u of allUnits(g)){
  const r=state(u),c=r.counters;
  if(u.champion.id==='Evelynn'&&(r.procs.qWindow??0)<g.time)c.qRecasts=0;
  // Apply DoT once per simulation second, then expire it; status clocks save with the game.
  for(const e of [...r.effects])if(e.kind==='burn'&&e.until>=g.time&&u.alive){const source=allUnits(g).find(a=>a.id===e.source);const before=u.health;applyDamage(g,source,u,e.value,e.key==='death-dance'?'죽음의 무도 지연 피해':'지속 피해',e.key==='death-dance'?'true':'magic',true);if(source&&before>u.health&&hasAugment(source,'지옥의 전도체')&&proc(source,'conduit-cdr',g.time,1))for(const slot of ['Q','W','E'] as const)state(source).ready[slot]=Math.max(g.time,(state(source).ready[slot]??g.time)-.08);}
  r.effects=r.effects.filter(e=>e.until>g.time&&e.value>0);
  augmentTick(g,u,fighterApi);
  for(const key of Object.keys(c).filter(k=>k.startsWith('bleed:')))if(!r.effects.some(e=>e.key===key.slice(6)+'bleed'&&e.source===key.slice(6)))c[key]=0;
  for(const [value,timer] of [['overdrive','overdriveUntil'],['flurry','flurryUntil'],['ardent','ardentUntil'],['staffAp','staffUntil'],['staffHaste','staffUntil'],['ultSpeed','ultSpeedUntil'],['frozen','frozenUntil'],['mawVamp','mawUntil'],['mrShred','mrShredUntil'],['growthHp','growthUntil'],['elixirHp','elixirUntil'],['elixirAd','elixirUntil'],['elixirAp','elixirUntil']])if((c[timer]??0)<=g.time)c[value]=0;
  if((c.resistUntil??0)<=g.time)c.resistUntil=0;
  c.itemAge=has(u,'6657')?g.time-(r.procs['bought:6657']??=g.time):0;
  const moved=Math.abs(u.position-(c.lastPosition??u.position));c.moved=(c.moved??0)+moved;if(resourceKind(u)==='flow'&&available(u))r.flow=Math.min(100,(r.flow??0)+moved*4);c.lastPosition=u.position;
  if(c.itemAge>=600&&!c.rodLevel){grantBonusLevel(g,u);c.rodLevel=1;}
  for(const key of Object.keys(r.procs).filter(k=>k.startsWith('storm:')&&r.procs[k]===g.time)){const source=allUnits(g).find(a=>a.id===key.slice(6));applyDamage(g,source,u,c[key]??0,'폭풍 쇄도 지연 폭발','magic',true);}
  const inCombat=available(u)&&enemies(g,u).some(t=>Math.abs(t.position-u.position)<30);
  c.combatSeconds=inCombat?(c.combatSeconds??0)+1:0;
  c.frozen=enemies(g,u).some(t=>has(t,'3110')&&Math.abs(t.position-u.position)<20)?1:(c.frozen??0);
  c.burningTargets=enemies(g,u).filter(t=>state(t).effects.some(e=>e.kind==='burn'&&e.source===u.id)).length;
  refreshStats(u);const s=statsFor(u);r.mana=Math.min(s.mana,r.mana+s.manaRegen);if(resourceKind(u)==='energy')r.energy=Math.min(s.energy,(r.energy??s.energy)+s.energyRegen);
  advanceFighter(g,u,fighterApi);
  if(!u.alive)continue;
  heal(g,u,u,s.hpRegen,true);
  if(u.champion.id==='Evelynn'){
   const shade=demonShade(u,g.time);
   if(shade){if(!c.wasShade){c.empoweredE=1;r.ready.E=g.time;}c.wasShade=1;heal(g,u,u,Math.max(0,Math.min(15+135*(u.level-1)/17,eveHealThreshold(u)-u.health)),true);if(camouflaged(g,u))u.status='악의 장막 · 위장';}
   else c.wasShade=0;
  }
  const charm=r.effects.find(e=>e.kind==='charm'),charmer=charm&&allUnits(g).find(t=>t.id===charm.source);
  if(charmer)u.position+=Math.sign(charmer.position-u.position)*Math.min(1.2,Math.abs(charmer.position-u.position));
  if(u.champion.id==='Malphite'&&g.time-r.lastDamage>10&&proc(u,'passive-shield',g.time,12))grantShield(g,u,u,s.hp*.1,'passive-shield',20,true);
  if(has(u,'2504')&&g.time-r.lastDamage>15&&proc(u,'kaenic',g.time,20))grantShield(g,u,u,s.hp*.15,'magic-kaenic',30,true);
  if(has(u,'3083')&&s.bonusHp>=2000&&g.time-r.lastDamage>8)heal(g,u,u,s.hp*.06,true);
  if(has(u,'1054')&&g.time-r.lastDamage<8)heal(g,u,u,4,true);
  if(!available(u))continue;
  if(blocked(u)&&has(u,'3140','3139')&&proc(u,'quicksilver',g.time,60))r.effects=r.effects.filter(e=>e.kind!=='stun'&&e.kind!=='root');
  if(blocked(u))continue;
  const close=enemies(g,u).filter(t=>Math.abs(t.position-u.position)<12),allies=friends(g,u).filter(t=>Math.abs(t.position-u.position)<25),hurt=allies.find(t=>healthRatio(t)<.4);
  if(has(u,'3068','6660','6664')&&inCombat)for(const t of close)applyDamage(g,u,t,(has(u,'6660')?8:15)+s.bonusHp*.01,'불사르기','magic',true);
  if(has(u,'2502')&&close.length&&proc(u,'despair',g.time,4))for(const t of close){const hp=t.health;applyDamage(g,u,t,20+s.hp*.01,'끝없는 절망','magic',true);heal(g,u,u,(hp-t.health)*2.5,true);}
  if(has(u,'3190')&&hurt&&proc(u,'locket',g.time,45))allies.forEach(t=>grantShield(g,u,t,180+u.level*8,'locket'));
  if(has(u,'3107')&&hurt&&proc(u,'redemption',g.time,45)){r.procs.redemptionAt=g.time+2;r.counters.redemptionPosition=hurt.position;}
  if(r.procs.redemptionAt===g.time)allies.filter(t=>Math.abs(t.position-r.counters.redemptionPosition)<18).forEach(t=>heal(g,u,t,150+u.level*10));
  if(has(u,'3222')){const cc=allies.find(t=>blocked(t)||effect(t,'root'));if(cc&&proc(u,'mikael',g.time,40)){state(cc).effects=state(cc).effects.filter(e=>!['stun','root','slow'].includes(e.kind));heal(g,u,cc,150);}}
  if(close.length&&has(u,'3143','6631')&&proc(u,'slow-active',g.time,20))close.forEach(t=>crowdControl(g,u,t,'slow',2));
  if(inCombat&&has(u,'2065','3142')&&proc(u,'speed-active',g.time,30))allies.forEach(t=>addEffect(t,{kind:'speed',value:.3,until:g.time+4,key:'shurelya'}));
  if(inCombat&&has(u,'3152','3146')&&proc(u,'hextech-active',g.time,30)){const t=enemies(g,u).sort((a,b)=>Math.abs(a.position-u.position)-Math.abs(b.position-u.position))[0];if(t){if(has(u,'3152')&&!effect(u,'root'))u.position+=Math.sign(t.position-u.position)*4;applyDamage(g,u,t,70+s.ap*.15,'마법공학 사용 효과','magic',true);crowdControl(g,u,t,'slow',2);}}
  if(inCombat&&hasAugment(u,'급속 성장')&&healthRatio(u)<.6&&proc(u,'growth',g.time,60)){c.growthHp=300+s.hp*.2;c.growthUntil=g.time+7;refreshStats(u);heal(g,u,u,c.growthHp,true);close.forEach(t=>crowdControl(g,u,t,'stun',1));log(g,u.champion.name+': 급속 성장 발동','major');}
  if(has(u,'3003')&&(c.manaCharge??0)>=360&&healthRatio(u)<.35&&proc(u,'seraph',g.time,45))grantShield(g,u,u,s.mana*.2,'seraph',4);
 }
}
