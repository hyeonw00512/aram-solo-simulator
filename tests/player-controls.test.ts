import {it,expect} from 'vitest';
import {createGame} from '../src/engine/game';
import {grantExperience,grantBonusLevel,xpAtLevel} from '../src/engine/progression';
import {autoTrainSkills,skillRank,trainSkill,unspentSkills,maxSkillRank} from '../src/engine/skill-training';
import {rankedAbility} from '../src/engine/kits';
import {playableChampions} from '../src/engine/data';
import {castAbility,resolveAttack} from '../src/engine/combat-v4';
import {refreshStats} from '../src/engine/stats';
import {state} from '../src/engine/runtime';
import {Rng} from '../src/engine/rng';
import {playStyles,setPlayStyle,tacticalPlan} from '../src/engine/tactics';
import {ensureWorld,advanceWorld} from '../src/engine/world';
import {upgradeBattleSave} from '../src/storage';
import {openDecision,startEncounter} from '../src/engine/encounter';
const context={own:{position:20},tower:{position:80},wave:true};
function lane(){const g=createGame(42);g.phase='playing';g.time=100;for(const u of [...g.blue,...g.red]){u.atFountain=false;u.position=u.team==='blue'?45:60;}ensureWorld(g).nextWave=9999;return g;}
it('banks player points on level-up while AI learns automatically, even during death',()=>{
 const g=createGame(1),u=g.blue[0],ai=g.blue[1];g.phase='playing';u.alive=false;u.health=0;
 grantExperience(g,u,xpAtLevel(6));grantExperience(g,ai,xpAtLevel(6));
 expect(u.level).toBe(6);expect(unspentSkills(u)).toBe(3);expect(skillRank(u,'R')).toBe(0);expect(skillRank(ai,'R')).toBe(1);expect(unspentSkills(ai)).toBe(0);
 expect(trainSkill(g,'R')).toBe(true);expect(trainSkill(g,'R')).toBe(false);expect(u.alive).toBe(false);
});
it('enforces level gates and consumes each point once through level 18',()=>{
 const g=createGame(1),u=g.blue[0];g.phase='playing';grantBonusLevel(g,u);
 expect(trainSkill(g,'Q')).toBe(true);expect(trainSkill(g,'Q')).toBe(false);expect(skillRank(u,'Q')).toBe(2);
 for(let level=5;level<=18;level++){grantBonusLevel(g,u);autoTrainSkills(u);for(const slot of ['Q','W','E','R'] as const)expect(skillRank(u,slot)).toBeLessThanOrEqual(maxSkillRank(slot,level));}
 expect(u.skillRanks).toEqual({Q:5,W:5,E:5,R:3});expect(unspentSkills(u)).toBe(0);
});
it('auto preference applies to future levels and save migration preserves invested and banked points',()=>{
 const g=createGame(5),u=g.blue[0];g.phase='playing';u.autoSkills=true;grantBonusLevel(g,u);expect(unspentSkills(u)).toBe(0);
 u.autoSkills=false;grantBonusLevel(g,u);setPlayStyle(g,'suspicious');const restored=JSON.parse(JSON.stringify(g));upgradeBattleSave(restored);
 expect(restored.blue[0].skillRanks).toEqual(u.skillRanks);expect(unspentSkills(restored.blue[0])).toBe(1);expect(restored.blue[0].playStyle).toBe('suspicious');
 delete restored.blue[1].skillRanks;restored.blue[1].level=11;upgradeBattleSave(restored);expect(skillRank(restored.blue[1],'R')).toBe(2);expect(unspentSkills(restored.blue[1])).toBe(0);
});
it('rank changes power, resource cost and cooldown; unlearned R cannot cast',()=>{
 const g=lane(),u=g.blue[0];u.champion=playableChampions.find(c=>c.id==='Ahri')!;u.level=6;refreshStats(u,true);
 expect(rankedAbility(u,'Q',2)!.base).toBeGreaterThan(rankedAbility(u,'Q',1)!.base);expect(rankedAbility(u,'Q',2)!.mana).toBeGreaterThan(rankedAbility(u,'Q',1)!.mana);
 expect(rankedAbility(u,'R',2)!.cd).toBeLessThan(rankedAbility(u,'R',1)!.cd);
 expect(castAbility(g,u,g.red[0],'R',new Rng(2))).toBe(false);expect(trainSkill(g,'R')).toBe(true);expect(castAbility(g,u,g.red[0],'R',new Rng(2))).toBe(true);
});
it('styles can change while dead or at a decision without teleporting or spending a turn',()=>{
 const g=lane(),u=g.blue[0];u.alive=false;g.phase='decision';const before={pos:u.position,time:g.time};
 for(const p of playStyles)expect(setPlayStyle(g,p.id)).toBe(true);
 expect({pos:u.position,time:g.time}).toEqual(before);expect(setPlayStyle(g,'invalid')).toBe(false);
});
it('coward retreats earlier, aggressive closes distance, suspicious waits when isolated',()=>{
 const g=lane(),u=g.blue[0],v=g.red[0];u.health=u.maxHealth*.6;
 setPlayStyle(g,'aggressive');const attack=tacticalPlan(g,u,v,context);setPlayStyle(g,'coward');const run=tacticalPlan(g,u,v,context);
 expect(attack.goal!).toBeGreaterThan(u.position);expect(run.goal!).toBeLessThan(u.position);expect(run.allowDash).toBe(false);
 for(const ally of g.blue.slice(1))ally.atFountain=true;setPlayStyle(g,'suspicious');expect(tacticalPlan(g,u,v,context).reason).toContain('아군 수');
});
it('farm prioritizes waves, chase selects a weak enemy and peel follows a hurt ally',()=>{
 const g=lane(),u=g.blue[0],v=g.red[0];g.red[1].health=1;
 setPlayStyle(g,'farm');expect(tacticalPlan(g,u,v,context,48).prioritizeWave).toBe(true);
 setPlayStyle(g,'chase');expect(tacticalPlan(g,u,v,context).target?.id).toBe(g.red[1].id);
 g.blue[1].health=1;setPlayStyle(g,'peel');expect(tacticalPlan(g,u,v,context).reason).toContain(g.blue[1].champion.name);
});
it('routine world movement changes with style and preserves explicit encounter control',()=>{
 const a=lane(),u=a.blue[0];u.health=u.maxHealth*.6;const b=structuredClone(a);
 setPlayStyle(a,'aggressive');setPlayStyle(b,'coward');advanceWorld(a,false);advanceWorld(b,false);expect(a.blue[0].position).toBeGreaterThan(b.blue[0].position);
 openDecision(a,'low-health');startEncounter(a,'retreat');expect(a.encounter?.intent).toBe('retreat');
 const pos=u.position;advanceWorld(a,false);expect(u.position).toBe(pos);expect(u.tacticalReason).toContain('직접 선택');
});
it('safe attack policy prevents a dash but still lets explicit combat cast it',()=>{
 const g=lane(),u=g.blue[0],v=g.red[0];u.champion=playableChampions.find(c=>c.id==='Malphite')!;u.level=6;u.skillRanks={Q:2,W:1,E:2,R:1};refreshStats(u,true);state(u).ready={Q:9999,W:9999,E:9999};
 resolveAttack(g,u,v,new Rng(1),{action:'engage',allowDash:false});expect(state(u).ready.R).toBeUndefined();expect(u.position).toBe(45);
 resolveAttack(g,u,v,new Rng(1),{action:'engage'});expect(state(u).ready.R).toBeGreaterThan(g.time);expect(u.position).toBe(v.position-2);
});
it('safe attack policy also blocks a shield ultimate that dashes to the enemy',()=>{
 const g=lane(),u=g.blue[0],v=g.red[0];u.champion=playableChampions.find(c=>c.id==='Kaisa')!;u.level=6;u.skillRanks={Q:2,W:1,E:2,R:1};refreshStats(u,true);u.health=u.maxHealth*.5;
 state(v).counters['plasma:'+u.id]=1;state(u).ready={Q:9999,W:9999,E:9999};
 resolveAttack(g,u,v,new Rng(1),{action:'engage',allowDash:false});expect(state(u).ready.R).toBeUndefined();expect(u.position).toBe(45);
 resolveAttack(g,u,v,new Rng(1),{action:'engage'});expect(state(u).ready.R).toBeGreaterThan(g.time);expect(u.position).toBe(v.position-3);
});
it('every supported champion can allocate exactly 18 points with legal ranks',()=>{
 for(const champion of playableChampions){const g=createGame(5),u=g.blue[1];u.champion=champion;g.phase='playing';for(let level=4;level<=18;level++)grantBonusLevel(g,u);expect(u.skillRanks).toEqual({Q:5,W:5,E:5,R:3});}
});
