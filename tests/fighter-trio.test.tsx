import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {renderToStaticMarkup} from 'react-dom/server';
import {createGame,tick,chooseDecision} from '../src/engine/game';
import {playableChampions,augments} from '../src/engine/data';
import {state,effect,blocked} from '../src/engine/runtime';
import {statsFor,refreshStats} from '../src/engine/stats';
import {castAbility,applyDamage,advanceCombat,resolveAttack,respawn} from '../src/engine/combat';
import {kitFor} from '../src/engine/kits';
import {recommendedRanks} from '../src/engine/skill-training';
import {resourceKind} from '../src/engine/resources';
import {Rng} from '../src/engine/rng';
import {canShop,purchaseReason} from '../src/engine/items';
import {buyItem,sellItem,advanceForges} from '../src/engine/shop';
import {ensureAiBuild,buildSource} from '../src/engine/ai-builds';
import {augmentGrade} from '../src/engine/augment-grades';
import {upgradeBattleSave} from '../src/storage';
import {Shop} from '../src/ui/Shop';
import {BuildDetails} from '../src/ui/BuildDetails';
import {advanceWorld} from '../src/engine/world';

const hit=()=>({chance:()=>false,next:()=>.5,int:()=>0} as unknown as Rng);
function fight(name:string,level=6){
 const g=createGame(42);g.phase='playing';g.time=50;g.nextDecision=9999;g.world!.buildings=[];g.world!.minions=[];
 for(const t of [...g.blue,...g.red]){t.atFountain=true;t.position=t.team==='blue'?0:100;}
 const u=g.blue[0],v=g.red[0];u.champion=playableChampions.find(c=>c.id===name)!;v.champion=playableChampions.find(c=>c.id==='Ahri')!;
 for(const t of [u,v]){t.atFountain=false;t.level=level;t.items=[];t.augments=[];t.combat=undefined;t.skillRanks=recommendedRanks(t);refreshStats(t,true);state(t);}
 u.position=50;v.position=55;return {g,u,v};
}
describe('fighter roster and build data',()=>{
 it('offers all three without duplicate champions across teams and bench',()=>{
  for(const id of ['Ornn','Garen','Aatrox']){
   const {u}=fight(id);expect(kitFor(u)).toHaveLength(4);expect(u.champion.stats.attackdamageperlevel).toBeGreaterThan(0);
   expect(resourceKind(u)).toBe(id==='Ornn'?'mana':'none');expect([...readFileSync(`public/assets/champions/${id}.png`).subarray(0,4)]).toEqual([137,80,78,71]);
   expect(buildSource(id).cores).toHaveLength(5);expect(augments.filter(a=>augmentGrade(id,a.name).grade).length).toBeGreaterThanOrEqual(8);
  }
  for(let seed=0;seed<50;seed++){const g=createGame(seed),ids=[...g.blue,...g.red].map(u=>u.champion.id).concat(g.lobby!.bench);expect(new Set(ids).size).toBe(playableChampions.length);}
 });
 it('uses champion-appropriate normal builds and skill priorities',()=>{
  for(const id of ['Ornn','Garen','Aatrox']){const {g,u}=fight(id,9);u.aiBuild=undefined;const plan=ensureAiBuild(g,u);if(plan.style!=='offbeat')expect(plan.path).toBe(id==='Ornn'?'tank':'ad');expect(u.skillRanks![id==='Ornn'?'W':id==='Garen'?'E':'Q']).toBe(5);}
 });
});
describe('Garen',()=>{
 it('cleanses slows, primes a silencing attack and prevents silenced casting',()=>{
  const {g,u,v}=fight('Garen');state(u).effects.push({kind:'slow',value:.3,until:99});
  castAbility(g,u,v,'Q',hit());expect(effect(u,'slow')).toBe(0);expect(effect(u,'speed')).toBe(.35);
  const hp=v.health;resolveAttack(g,u,v,hit());expect(hp-v.health).toBeGreaterThan(statsFor(u).ad);expect(effect(v,'silence')).toBe(1);expect(castAbility(g,v,u,'Q',hit())).toBe(false);
  g.time+=2;advanceCombat(g);expect(effect(v,'silence')).toBe(0);
 });
 it('spins for three ticks, scales with AD, shreds armor, and cannot basic attack mid-spin',()=>{
  const {g,u,v}=fight('Garen',11);u.items=['3071'];refreshStats(u);v.health=v.maxHealth=10000;const before=v.health;
  castAbility(g,u,v,'E',hit());state(u).ready={Q:999,W:999,E:999,R:999};resolveAttack(g,u,v,hit());expect(v.health).toBe(before);
  for(let i=0;i<3;i++){g.time++;advanceCombat(g);}expect(v.health).toBeLessThan(before);expect(effect(v,'armor-shred')).toBeGreaterThanOrEqual(.25);expect(state(u).counters.garenSpinTicks).toBe(3);
 });
 it('W reduces physical/magic damage while R executes with true damage',()=>{
  const {g,u,v}=fight('Garen');castAbility(g,u,v,'W',hit());state(u).effects=[];const before=u.health;applyDamage(g,v,u,100,'test','true');expect(before-u.health).toBe(100);
  const hp=u.health;applyDamage(g,v,u,100,'test','physical');expect(hp-u.health).toBe(Math.round(Math.round(100*100/(100+statsFor(u).armor))*.7));
  v.items=['3075'];refreshStats(v,true);v.health=200;castAbility(g,u,v,'R',hit());expect(v.alive).toBe(false);expect(state(u).counters.garenCourage).toBe(1);
 });
 it('regenerates out of champion combat and minion hits do not disable the passive',()=>{
  const {g,u,v}=fight('Garen');u.health=300;applyDamage(g,v,u,1,'test');const hp=u.health;advanceCombat(g);const natural=u.health-hp;g.time+=8;applyDamage(g,undefined,u,1,'미니언 공격');const low=u.health;advanceCombat(g);expect(u.health-low).toBeGreaterThan(natural+1);
 });
});
describe('Aatrox',()=>{
 it('chains exactly three Q casts and deals greater damage at the sweet spot',()=>{
  const {g,u,v}=fight('Aatrox');v.health=v.maxHealth=10000;v.position=73;const hp=v.health;
  castAbility(g,u,v,'Q',hit());const first=hp-v.health;expect(blocked(v)).toBe(true);expect(state(u).counters.aatroxQStage).toBe(1);
  g.time++;v.position=66;castAbility(g,u,v,'Q',hit());expect(state(u).counters.aatroxQStage).toBe(2);
  g.time++;v.position=55;const last=v.health;castAbility(g,u,v,'Q',hit());expect(last-v.health).toBeGreaterThan(first);expect(state(u).counters.aatroxQStage).toBe(0);expect(castAbility(g,u,v,'Q',hit())).toBe(false);
 });
 it('lets enemies escape W, but pulls back those remaining inside the chain',()=>{
  for(const escapes of [true,false]){const {g,u,v}=fight('Aatrox');castAbility(g,u,v,'W',hit());v.position+=escapes?20:5;const moved=v.position;g.time+=2;advanceCombat(g);expect(v.position).toBe(escapes?moved:55);expect(state(v).procs['chain:'+u.id]).toBeUndefined();}
 });
 it('E dashes and healing/AD scale with R; takedowns extend R without revival',()=>{
  const {g,u,v}=fight('Aatrox');u.health=100;const ad=statsFor(u).ad;v.position=75;castAbility(g,u,v,'E',hit());expect(u.position).not.toBe(50);
  castAbility(g,u,v,'R',hit());expect(statsFor(u).ad).toBeCloseTo(ad*1.2);const until=state(u).procs.aatroxUltUntil;
  applyDamage(g,u,v,100,'test','true');expect(u.health).toBeGreaterThan(100);applyDamage(g,u,v,99999,'test','true');expect(state(u).procs.aatroxUltUntil).toBe(until+5);
  applyDamage(g,undefined,u,99999,'test','true');advanceCombat(g);expect(u.alive).toBe(false);expect(state(u).counters.aatroxUlt).toBe(0);
 });
 it('empowered attacks heal and the passive has a cooldown',()=>{
  const {g,u,v}=fight('Aatrox');u.health=100;state(u).ready={Q:999,W:999,E:999,R:999};resolveAttack(g,u,v,hit());expect(u.health).toBeGreaterThan(100);const ready=state(u).procs.aatroxPassive;g.time+=2;resolveAttack(g,u,v,hit());expect(state(u).procs.aatroxPassive).toBe(ready-2);
 });
});
describe('Ornn',()=>{
 it('creates a pillar, knocks targets up on E collision, and detonates brittle',()=>{
  const {g,u,v}=fight('Ornn');v.health=v.maxHealth=10000;castAbility(g,u,v,'Q',hit());expect(state(u).counters.ornnPillar).toBe(55);
  castAbility(g,u,v,'W',hit());expect(state(v).procs['brittle:'+u.id]).toBe(g.time+3);const hp=v.health;castAbility(g,u,v,'E',hit());expect(blocked(v)).toBe(true);expect(state(v).procs['brittle:'+u.id]).toBeUndefined();expect(hp-v.health).toBeGreaterThan(500);
 });
 it('E without a pillar does not knock up; R recasts without paying mana again',()=>{
  const {g,u,v}=fight('Ornn');v.health=v.maxHealth=10000;castAbility(g,u,v,'E',hit());expect(blocked(v)).toBe(false);
  state(u).mana=1000;castAbility(g,u,v,'R',hit());const mana=state(u).mana;expect(state(u).counters.ornnRam).toBe(1);g.time++;castAbility(g,u,v,'R',hit());expect(state(u).mana).toBe(mana);expect(state(u).counters.ornnRam).toBe(0);expect(blocked(v)).toBe(true);expect(state(u).ready.R).toBeGreaterThan(g.time+1);
 });
 it('forges in the field after a channel, charges once, preserves HP/mana, and enforces cooldown/consumable/sale restrictions',()=>{
  const {g,u,v}=fight('Ornn');v.atFountain=true;u.gold=1000;u.health=100;state(u).mana=40;u.shopUnlocked=false;
  expect(purchaseReason(g,u,'2003')).toContain('소모품');expect(buyItem(g,'1028')).toBe(true);expect(u.items).toEqual([]);expect(blocked(u)).toBe(true);
  expect(buyItem(g,'1028')).toBe(false);g.time+=3;advanceForges(g);expect(u.items).toEqual(['1028']);expect(u.gold).toBe(600);expect(u.health).toBe(100);expect(state(u).mana).toBe(40);expect(canShop(g,u)).toBe(false);expect(sellItem(g,0)).toBe(false);
  expect(renderToStaticMarkup(<Shop game={g} update={()=>{}}/>)).toContain('대장간 재사용');
 });
 it('cancels forging on incoming damage without taking gold or components',()=>{
  const {g,u,v}=fight('Ornn');v.atFountain=true;u.gold=1000;buyItem(g,'1028');applyDamage(g,undefined,u,10,'포탑 공격');g.time++;advanceForges(g);expect(u.forge).toBeUndefined();expect(u.items).toEqual([]);expect(u.gold).toBe(1000);
 });
 it('adds one persistent masterwork per ally at the proper levels and exposes it in details',()=>{
  const {g,u,v}=fight('Ornn',13);v.atFountain=true;u.items=['3068'];const ally=g.blue[1];ally.position=u.position;ally.items=['3089'];const hp=statsFor(u).hp;
  advanceForges(g);expect(u.masterwork?.itemId).toBe('3068');expect(statsFor(u).hp).toBeGreaterThan(hp);expect(ally.masterwork).toBeUndefined();
  u.level=14;advanceForges(g);expect(ally.masterwork?.itemId).toBe('3089');const old=structuredClone(ally.masterwork);advanceForges(g);expect(ally.masterwork).toEqual(old);
  expect(renderToStaticMarkup(<BuildDetails game={g} unit={u}/>)).toContain('오른의 걸작');const saved=upgradeBattleSave(JSON.parse(JSON.stringify(g)));expect(saved.blue[1].masterwork).toEqual(old);
 });
});
it('uses the new skills while clearing actual minion waves, including Garen W stacks',()=>{
 for(const id of ['Ornn','Garen','Aatrox']){
  const {g,u,v}=fight(id);v.atFountain=true;g.world=createGame(42).world;g.world!.nextWave=9999;g.world!.buildings.forEach(b=>b.nextAttack=9999);
  const m={id:'m-trio',team:'red' as const,kind:'melee' as const,position:55,health:1,maxHealth:400,damage:0,range:1,nextAttack:9999};g.world!.minions=[m];
  if(id==='Ornn')state(u).ready.Q=state(u).ready.E=9999;
  advanceWorld(g);if(id==='Garen'){g.time++;advanceCombat(g);expect(state(u).counters.garenCourage).toBe(.75);}
  expect(m.health).toBe(0);if(id==='Aatrox')expect(state(u).counters.aatroxQStage).toBe(1);
 }
});
it('drops expired combo windows on death and preserves long cooldowns through revival',()=>{
 for(const id of ['Ornn','Aatrox']){const {g,u,v}=fight(id);castAbility(g,u,v,id==='Ornn'?'R':'Q',hit());applyDamage(g,undefined,u,99999,'test','true');advanceCombat(g);expect(state(u).counters[id==='Ornn'?'ornnRam':'aatroxQStage']).toBe(0);g.time=u.respawnAt;respawn(g);expect(u.alive).toBe(true);expect(state(u).counters[id==='Ornn'?'ornnRam':'aatroxQStage']).toBe(0);}
});
it('runs deterministic full team combat with the new roster without NaN health or stuck recasts',()=>{
 let g=createGame(56);g.phase='playing';g.time=1;g.nextDecision=9999;
 const roster=['Ornn','Garen','Aatrox',...playableChampions.filter(c=>!['Ornn','Garen','Aatrox'].includes(c.id)).map(c=>c.id)];
 for(const [index,u] of [...g.blue,...g.red].entries()){u.champion=playableChampions.find(c=>c.id===roster[index])!;u.combat=undefined;u.skillRanks=recommendedRanks(u);refreshStats(u,true);u.atFountain=false;u.position=u.team==='blue'?45:55;u.augments=[augments[0]];u.augmentClaims=1;u.autoSkills=true;}
 const run=(start:typeof g)=>{let current=start;for(let i=0;i<120;i++){if(current.phase==='decision')chooseDecision(current,current.pending!.choices[0].id);current=tick(current);}return current;};
 const next=run(g);expect(next).toEqual(run(JSON.parse(JSON.stringify(g))));for(const u of [...next.blue,...next.red]){expect(Number.isFinite(u.health)).toBe(true);expect(u.health).toBeGreaterThanOrEqual(0);expect(u.health).toBeLessThanOrEqual(u.maxHealth);}
});
