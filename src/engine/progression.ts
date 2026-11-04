import rules from '../../data/progression.json';
import layout from '../../data/howling-abyss-layout.json';
import type {Game,Unit,Minion} from './types';
import {allUnits,state} from './runtime';
import {refreshStats,statsFor} from './stats';
import {ensureSkills,autoTrainSkills} from './skill-training';
export {rules as progressionRules};
export const xpRequired=(level:number)=>rules.xpToNextFromLevel3[level-3]??0;
export const xpAtLevel=(level:number)=>rules.xpToNextFromLevel3.slice(0,Math.max(0,Math.min(18,level)-3)).reduce((sum,x)=>sum+x,0);
export const totalXp=(u:Unit)=>Number.isFinite(u.experience)?Math.max(xpAtLevel(u.level),u.experience!):xpAtLevel(u.level);
export function xpProgress(u:Unit){const required=xpRequired(u.level),earned=Math.max(0,totalXp(u)-xpAtLevel(u.level));return {earned:Math.min(required,earned),required,percent:required?Math.min(100,earned/required*100):100};}
export function respawnSeconds(level:number,time=0){
 const base=rules.respawnSecondsFromLevel3[Math.max(0,Math.min(15,Math.floor(level)-3))],scale=rules.respawnScaling;
 const steps=Math.max(0,Math.floor((time-scale.startSeconds)/scale.stepSeconds));
 return Math.round(base*Math.min(scale.maxMultiplier,1+steps*scale.perStep)*1000)/1000;
}
const mapLength=Math.hypot(layout.bounds.max[0]-layout.bounds.min[0],layout.bounds.max[1]-layout.bounds.min[1]);
const inRange=(u:Unit,position:number,range:number)=>!u.atFountain&&!u.portal&&Math.abs(u.position-position)*mapLength/100<=range;
function levelUp(g:Game,u:Unit){
 const before=statsFor(u),r=state(u);ensureSkills(u);u.level++;if(u.id!==g.playerId||u.autoSkills)autoTrainSkills(u);refreshStats(u);
 const after=statsFor(u);r.mana=Math.min(after.mana,r.mana+Math.max(0,after.mana-before.mana));
 if(u.items.includes('3802'))r.mana=Math.min(after.mana,r.mana+after.mana*.2);
 g.logs.push({time:g.time,text:`${u.champion.name} 레벨 ${u.level}${u.level===6?' · 궁극기 투자 가능':''}`,tone:u.id===g.playerId?'good':undefined});
 if(g.logs.length>650)g.logs.splice(0,g.logs.length-650);
}
export function grantExperience(g:Game,u:Unit,amount:number){
 if(!Number.isFinite(amount)||amount<=0||g.phase==='finished')return;
 u.experience=Math.min(xpAtLevel(18),totalXp(u)+amount);
 while(u.level<18&&u.experience>=xpAtLevel(u.level+1))levelUp(g,u);
}
export function grantBonusLevel(g:Game,u:Unit){
 if(u.level>=18)return;
 const fraction=xpProgress(u).percent/100;
 levelUp(g,u);u.experience=xpAtLevel(u.level)+xpRequired(u.level)*fraction;
}
export function advanceExperience(g:Game){if(g.phase==='playing')for(const u of allUnits(g))grantExperience(g,u,rules.passiveXpPerSecond);}
export function awardMinionExperience(g:Game,m:Minion,killer?:Unit){
 if(m.health>0||m.experienceGranted)return;m.experienceGranted=true;
 if(killer?.champion.id==='Garen')state(killer).counters.garenCourage=Math.min(30,(state(killer).counters.garenCourage??0)+.75);
 const recipients=allUnits(g).filter(u=>u.team!==m.team&&(u.id===killer?.id||u.alive&&inRange(u,m.position,rules.minionXpRange)));
 const share=rules.minionXp[m.kind]*(rules.minionXpShareByRecipients[recipients.length-1]??0);
 for(const u of recipients)grantExperience(g,u,share);
}
// Kill XP is an explicit approximation; eligibility, sharing and level differences are modeled.
export function awardChampionExperience(g:Game,victim:Unit,killer?:Unit){
 if(killer?.champion.id==='Garen')state(killer).counters.garenCourage=Math.min(30,(state(killer).counters.garenCourage??0)+1);
 const recipients=allUnits(g).filter(u=>u.team!==victim.team&&(u.id===killer?.id||(u.combat?.procs['hit:'+victim.id]??-Infinity)>=g.time-5||((u.alive||g.time-(u.diedAt??-Infinity)<=rules.championDeathGraceSeconds)&&inRange(u,victim.position,rules.championXpRange))));
 const c=rules.championXpApproximation,base=rules.championBaseXp[victim.level-1]/Math.max(1,recipients.length);
 const decimalLevel=(u:Unit)=>u.level+(u.level<18?xpProgress(u).percent/100:0),victimLevel=decimalLevel(victim);
 const rewards=recipients.map(u=>{const difference=victimLevel-decimalLevel(u);return {u,xp:base*Math.max(c.minMultiplier,Math.min(c.maxBonus,1+Math.sign(difference)*Math.max(0,Math.abs(difference)-1)*c.levelDifferenceBonus))};});
 for(const {u,xp} of rewards)grantExperience(g,u,xp);
}
