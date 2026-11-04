import {describe,it,expect} from 'vitest';
import {createGame,tick} from '../src/engine/game';
import {playableChampions,augments} from '../src/engine/data';
import {statsFor,refreshStats,buildIdentity} from '../src/engine/stats';
import {state,effect,addEffect} from '../src/engine/runtime';
import {castAbility,resolveAttack,advanceCombat,grantShield,heal} from '../src/engine/combat';
import {ensureWorld,damageBuilding,advanceWorld,structureUnlocked} from '../src/engine/world';
import {applyAugment} from '../src/engine/augments';
import {landmark} from '../src/engine/map-layout';
import {portalDestination} from '../src/engine/portal';
import {openDecision,planResponse,startEncounter} from '../src/engine/encounter';
import {aiShopping,buildRoutes,useConsumable} from '../src/engine/shop';
import {routeFor} from '../src/engine/build-advisor';
import {Rng} from '../src/engine/rng';
import type {Game,Unit} from '../src/engine/types';
import {upgradeBattleSave} from '../src/storage';
function lane(){const g=createGame(17);g.phase='playing';g.time=100;for(const u of [...g.blue,...g.red]){u.atFountain=false;u.position=u.team==='blue'?44:52;u.level=10;u.skillRanks={Q:1,W:1,E:1,R:1};u.items=[];u.augments=[];u.combat=undefined;refreshStats(u,true);state(u)}return g}
function champion(u:Unit,id:string,items:string[]=[]){u.champion=playableChampions.find(c=>c.id===id)!;u.items=items;u.combat=undefined;refreshStats(u,true);state(u);return u}
function augment(g:Game,u:Unit,name:string){applyAugment(g,u,augments.find(a=>a.name.startsWith(name))!)}
function wave(g:Game,position:number){ensureWorld(g).minions.push({id:'test-wave',team:'blue',kind:'melee',position,health:500,maxHealth:500,damage:20,range:2,nextAttack:9999})}
function basics(u:Unit){state(u).ready={Q:99999,W:99999,E:99999,R:99999}}
describe('structures and persistent lane state',()=>{
 it('upgrades old saves with one-time augment rewards without duplicating rewards or losing progress',()=>{
  const g=createGame(17);g.time=250;g.blue[0].augments=[augments.find(a=>a.name==='능력치!')!];g.blue[0].gold=1234;g.world=undefined;
  upgradeBattleSave(g);const counters=structuredClone(state(g.blue[0]).counters);expect(Object.keys(counters).some(k=>k.startsWith('anvil'))).toBe(true);
  upgradeBattleSave(g);expect(state(g.blue[0]).counters).toEqual(counters);expect(g.time).toBe(250);expect(g.blue[0].gold).toBe(1234);expect(g.world).toBeDefined();
 });
 it('requires the previous building, and minions remove backdoor protection',()=>{
  const g=lane(),w=ensureWorld(g),outer=w.buildings.find(b=>b.team==='red'&&b.kind==='outer')!,inner=w.buildings.find(b=>b.team==='red'&&b.kind==='inner')!;
  expect(damageBuilding(g,inner,1000,'blue')).toBe(0);expect(damageBuilding(g,outer,1000,'blue')).toBe(100);
  wave(g,outer.position);expect(damageBuilding(g,outer,1000,'blue')).toBe(1000);damageBuilding(g,outer,100000,'blue');expect(structureUnlocked(g,inner)).toBe(true);
 });
 it('spawns super minions after inhibitor destruction and restores it after its timer',()=>{
  const g=lane(),w=ensureWorld(g);for(const u of [...g.blue,...g.red])u.atFountain=true;
  for(const b of w.buildings.filter(b=>b.team==='red'&&['outer','inner'].includes(b.kind))){b.alive=false;b.health=0}
  const inhib=w.buildings.find(b=>b.team==='red'&&b.kind==='inhibitor')!;damageBuilding(g,inhib,100000,'blue');w.nextWave=g.time;advanceWorld(g,false);
  expect(w.minions.some(m=>m.team==='blue'&&m.kind==='super')).toBe(true);g.time=inhib.respawnAt!;advanceWorld(g,false);expect(inhib.alive).toBe(true);expect(inhib.health).toBe(inhib.maxHealth);
 });
 it('moves portal exits backward and ends only when an unlocked nexus is destroyed',()=>{
  const g=lane(),w=ensureWorld(g);expect(portalDestination('blue',g)).toBeGreaterThan(landmark('blue','outer').position);let second=0;
  for(const b of w.buildings.filter(b=>b.team==='blue')){if(b.kind==='outer'){b.alive=false;second=portalDestination('blue',g);expect(second).toBeLessThan(landmark('blue','outer').position)}else if(b.kind==='inner'){b.alive=false;expect(portalDestination('blue',g)).toBe(second)}}
  const nexus=w.buildings.find(b=>b.team==='red'&&b.kind==='nexus')!;expect(damageBuilding(g,nexus,100000,'blue')).toBe(0);
  for(const b of w.buildings.filter(b=>b.team==='red'&&b.kind!=='nexus')){b.alive=false;b.health=0}
  damageBuilding(g,nexus,100000,'blue');expect(g.phase).toBe('finished');expect(g.winner).toBe('blue');expect(nexus.health).toBe(0);
 });
 it('does not award a score victory at ten minutes, and save/load reproduces the world',()=>{
  const g=lane();g.time=600;g.nextDecision=9999;g.nextAugmentLevel=99;const saved=JSON.parse(JSON.stringify(g));
  const next=tick(g);expect(next.phase).not.toBe('finished');expect(next).toEqual(tick(saved));expect(g.time).toBe(600);
 });
});
describe('champion kits, builds and synergies',()=>{
 it('makes AP Malphite hit harder with R while tank Malphite has more health and armor',()=>{
  const ap=lane(),tank=lane();const a=champion(ap.blue[0],'Malphite',['3089','3135']),b=champion(tank.blue[0],'Malphite',['3084','3068']);
  expect(buildIdentity(a).role).toBe('mage');expect(buildIdentity(b).role).toBe('tank');expect(statsFor(b).hp).toBeGreaterThan(statsFor(a).hp);expect(statsFor(b).armor).toBeGreaterThan(statsFor(a).armor);
  const hpA=ap.red[0].health,hpB=tank.red[0].health;expect(castAbility(ap,a,ap.red[0],'R',new Rng(7))).toBe(true);castAbility(tank,b,tank.red[0],'R',new Rng(7));expect(hpA-ap.red[0].health).toBeGreaterThan(hpB-tank.red[0].health);
 });
 it('checks mana, cooldown and stun before a cast, and zero-damage CC does not harm',()=>{
  const g=lane(),u=champion(g.blue[0],'Veigar'),v=g.red[0];state(u).mana=0;expect(castAbility(g,u,v,'E',new Rng(1))).toBe(false);
  state(u).mana=500;const hp=v.health;expect(castAbility(g,u,v,'E',new Rng(1))).toBe(true);expect(v.health).toBe(hp);expect(effect(v,'stun')).toBeGreaterThan(0);expect(castAbility(g,u,v,'E',new Rng(1))).toBe(false);
  addEffect(u,{kind:'stun',value:1,until:g.time+3});expect(castAbility(g,u,v,'Q',new Rng(1))).toBe(false);
 });
 it('combines healing augment, recipient Spirit Visage and Ardent support buffs',()=>{
  const g=lane(),u=champion(g.blue[0],'Janna',['3504']),v=g.blue[1];v.items=['3065'];refreshStats(v,true);augment(g,u,'응급 처치 키트');
  const speed=statsFor(v).attackSpeed;grantShield(g,u,v,100,'test');expect(effect(v,'shield')).toBeGreaterThanOrEqual(150);expect(statsFor(v).attackSpeed).toBeGreaterThan(speed);
  v.health-=500;const normal=heal(g,u,v,100);addEffect(v,{kind:'heal-cut',value:.4,until:g.time+3});expect(heal(g,u,v,100)).toBeLessThan(normal);
 });
 it('combines Heartsteel growth with Giant and Heavy Hitter on basic attacks',()=>{
  const base=lane(),stack=lane(),a=champion(base.blue[0],'Malphite',['3084']),b=champion(stack.blue[0],'Malphite',['3084']);basics(a);basics(b);augment(stack,b,'거인 (');augment(stack,b,'강타자');refreshStats(b,true);
  const hpA=base.red[0].health,hpB=stack.red[0].health,prior=statsFor(b).hp;resolveAttack(base,a,base.red[0],new Rng(4));resolveAttack(stack,b,stack.red[0],new Rng(4));
  expect(hpB-stack.red[0].health).toBeGreaterThan(hpA-base.red[0].health);expect(statsFor(b).hp).toBeGreaterThan(prior);
 });
 it('applies spell burn over time and permits exactly one immediate ultimate recast',()=>{
  const g=lane(),u=champion(g.blue[0],'Malphite',['6653']),v=g.red[0];augment(g,u,'궁극기 대변혁');castAbility(g,u,v,'R',new Rng(1));expect(state(v).effects.some(e=>e.kind==='burn')).toBe(true);
  const hp=v.health;g.time++;advanceCombat(g);expect(v.health).toBeLessThan(hp);expect(castAbility(g,u,v,'R',new Rng(1))).toBe(true);g.time++;expect(castAbility(g,u,v,'R',new Rng(1))).toBe(false);
 });
 it('Kaisa requires a plasma mark before dashing and shielding',()=>{
  const g=lane(),u=champion(g.blue[0],'Kaisa'),v=g.red[0];expect(castAbility(g,u,v,'R',new Rng(1))).toBe(false);state(v).counters['plasma:'+u.id]=1;
  expect(castAbility(g,u,v,'R',new Rng(1))).toBe(true);expect(Math.abs(u.position-v.position)).toBe(3);expect(effect(u,'shield')).toBeGreaterThan(0);
 });
 it('anvil rewards survive save/load and cannot be claimed twice',()=>{
  const g=lane(),u=g.blue[0];augment(g,u,'능력치!');const before=structuredClone(state(u).counters);augment(g,u,'능력치!');expect(state(u).counters).toEqual(before);expect(JSON.parse(JSON.stringify(g)).blue[0].combat.counters).toEqual(before);expect(Object.keys(before).filter(k=>k.startsWith('anvil')).length).toBeGreaterThan(0);
 });
});
describe('build-aware choices and shopping',()=>{
 it('changes siege choices and AI intent when a friendly wave reaches the tower',()=>{
  const g=lane();g.blue.forEach(u=>u.position=landmark('red','outer').position-8);openDecision(g);expect(g.pending!.situation).toBe('no-wave');startEncounter(g,g.pending!.choices[0].id);
  const before=planResponse(g,g.blue[1],new Rng(5));wave(g,landmark('red','outer').position);const after=planResponse(g,g.blue[1],new Rng(5));expect(after.weights.push).toBeGreaterThan(before.weights.push);
  g.encounter=undefined;g.phase='playing';openDecision(g);expect(g.pending!.situation).toBe('siege');expect(g.pending!.choices.map(c=>c.id)).toContain('push');
 });
 it('AI buys an entire route without stray components or duplicate completed items',()=>{
  for(const path of ['tank','ap','ad','support'] as const){const g=lane(),u=g.blue[1];u.atFountain=true;u.gold=100000;state(u).buildPath=path;aiShopping(g,u);expect(u.items).toEqual(routeFor(u));expect(u.items).toHaveLength(6)}
 });
 it('refillable potions do not recharge merely by walking back to the fountain',()=>{
  const g=lane(),u=g.blue[0];u.items=['2031'];u.health=100;expect(useConsumable(g,0)).toBe(true);expect(useConsumable(g,0)).toBe(true);expect(useConsumable(g,0)).toBe(false);u.atFountain=true;advanceCombat(g);expect(useConsumable(g,0)).toBe(false);expect(u.items).toEqual(['2031']);
 });
});
