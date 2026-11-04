import {describe,it,expect} from 'vitest';
import {createGame,chooseDecision,resolveSwap,tick} from '../src/engine/game';
import {openDecision,planResponse} from '../src/engine/encounter';
import {applyDamage,resolveAttack} from '../src/engine/combat';
import {rememberEncounter} from '../src/engine/memory';
import {statsFor,refreshStats} from '../src/engine/stats';
import {buyItem,sellItem} from '../src/engine/shop';
import {componentQuote,itemMap,purchaseReason} from '../src/engine/items';
import {Rng} from '../src/engine/rng';
import {playableChampions} from '../src/engine/data';
import type {Game,Reaction} from '../src/engine/types';
function onLane(seed=1) {const g=createGame(seed);g.phase='playing';for(const u of [...g.blue,...g.red]){u.atFountain=false;u.position=u.team==='blue'?42:55}return g}
function encounter(seed=1) {const g=onLane(seed);openDecision(g,'ally-picked');chooseDecision(g,'engage');return g}
const plan=(id:string,action:Reaction)=>({unitId:id,action,reason:'테스트 판단',misunderstood:false,weights:{engage:1,join:1,retreat:1,cover:1,poke:1,hesitate:1,chase:1,clear:1,push:1}});
describe('persistent social memory',()=>{
 it('remembers repeated reckless dives, serializes the memory and affects the next encounter',()=>{
  const g=encounter(),observer=g.blue[1],leader=g.blue[0];
  const before=planResponse(g,observer,new Rng(4));
  for(let n=0;n<2;n++) {g.encounter!.initialOpportunity=-.6;g.encounter!.rounds=[{time:n,plans:[plan(leader.id,'engage'),plan(observer.id,'hesitate')]}];leader.deaths=g.encounter!.startUnits[0].deaths+1;rememberEncounter(g)}
  expect(observer.relationships[leader.id].trust).toBe(-32);expect(observer.relationships[leader.id].reckless).toBe(2);
  const loaded=JSON.parse(JSON.stringify(g)) as Game;
  expect(planResponse(loaded,loaded.blue[1],new Rng(4)).weights.hesitate).toBeGreaterThan(before.weights.hesitate);
  loaded.encounter=undefined;loaded.phase='playing';openDecision(loaded,'ally-picked');chooseDecision(loaded,'engage');
  expect(loaded.blue[1].relationships[leader.id].trust).toBe(-32);
 });
 it('still joins a good opportunity despite distrust and responds to necessity',()=>{
  const g=encounter(),observer=g.blue[1];observer.relationships[g.playerId]={trust:-60,reckless:3,experiences:3,reason:'반복된 무리',updatedAt:0};
  const prior=planResponse(g,observer,new Rng(1));g.red.forEach(u=>u.health=u.maxHealth*.1);
  const favorable=planResponse(g,observer,new Rng(1));expect(favorable.weights.join).toBeGreaterThan(prior.weights.join);
  expect(Array.from({length:100},(_,i)=>planResponse(g,observer,new Rng(i+1)).action)).toContain('join');
  observer.position=20;g.red.forEach(u=>u.position=26);
  expect(planResponse(g,observer,new Rng(1)).weights.cover).toBeGreaterThan(favorable.weights.cover);
 });
 it('tracks trust toward AI teammates, and restores trust only for actual protection',()=>{
  const g=encounter(),observer=g.blue[1],leader=g.blue[2];
  observer.relationships[leader.id]={trust:-30,reckless:2,experiences:2,reason:'불신',updatedAt:0};
  g.encounter!.rounds=[{time:0,plans:[plan(observer.id,'retreat'),plan(leader.id,'cover')]}];rememberEncounter(g);
  expect(observer.relationships[leader.id].trust).toBe(-30);
  g.encounter!.protections.push({protector:leader.id,protected:observer.id});rememberEncounter(g);
  expect(observer.relationships[leader.id].trust).toBe(-23);
 });
 it('does not classify every lost fight as reckless',()=>{
  const g=encounter();g.encounter!.initialOpportunity=.3;g.encounter!.rounds=[{time:0,plans:[plan(g.playerId,'engage'),plan('blue-1','join')]}];g.blue[0].deaths++;
  rememberEncounter(g);expect(g.blue[1].relationships[g.playerId].reckless).toBe(0);expect(g.blue[1].relationships[g.playerId].trust).toBe(-4);
 });
});
describe('contextual decisions and unique roster',()=>{
 it('never duplicates champions across 10 slots, including swaps',()=>{for(let seed=1;seed<=500;seed++){const g=createGame(seed);resolveSwap(g,true);expect(new Set([...g.blue,...g.red].map(u=>u.champion.id)).size).toBe(10)}});
 it('offers different menus and rejects choices outside the current situation',()=>{
  const g=onLane(12);openDecision(g,'standoff');expect(g.pending!.choices.map(c=>c.id)).toEqual(['engage','trade','wait']);chooseDecision(g,'healthpack');expect(g.phase).toBe('decision');
  g.phase='playing';g.pending=undefined;g.blue[0].health=g.blue[0].maxHealth*.2;openDecision(g);expect(g.pending!.situation).toBe('low-health');expect(g.pending!.choices.map(c=>c.id)).toContain('healthpack');
  g.packs.blue=100;g.phase='playing';openDecision(g);expect(g.pending!.choices.map(c=>c.id)).not.toContain('healthpack');
 });
 it('waiting holds position and getting a health pack has a real cooldown',()=>{
  let g=onLane(14);openDecision(g,'standoff');chooseDecision(g,'wait');const pos=g.blue[0].position;g=tick(g);expect(g.blue[0].position).toBe(pos);expect(g.encounter!.rounds[0].plans[0].action).toBe('hesitate');
  g=onLane(14);g.blue[0].position=30;g.blue[0].health=100;g.red.forEach(u=>u.position=60);openDecision(g,'low-health');chooseDecision(g,'healthpack');g=tick(g);expect(g.blue[0].position).toBe(27);expect(g.blue[0].health).toBeGreaterThan(100);expect(g.packs.blue).toBeGreaterThan(g.time);
 });
});
describe('champion stats and combat',()=>{
 it('uses distinct source stats and growth',()=>{const g=createGame(3);expect(new Set(g.blue.map(u=>u.maxHealth)).size).toBeGreaterThan(1);expect(g.blue.every(u=>u.maxHealth>500)).toBe(true);const u=g.blue[0],before=statsFor(u);u.level=10;refreshStats(u);expect(u.maxHealth).toBeGreaterThan(before.hp);expect(statsFor(u).armor).toBeGreaterThan(before.armor)});
 it('applies armor, MR and true damage independently',()=>{
  const g=createGame(8),u=g.blue[0];u.items=['1031'];refreshStats(u,true);const health=u.health,s=statsFor(u);applyDamage(g,undefined,u,100,'test');expect(health-u.health).toBe(Math.round(100*100/(100+s.armor)));
  refreshStats(u,true);applyDamage(g,undefined,u,100,'test','magic');expect(u.maxHealth-u.health).toBe(Math.round(100*100/(100+s.mr)));
  refreshStats(u,true);applyDamage(g,undefined,u,100,'test','true');expect(u.maxHealth-u.health).toBe(100);
 });
 it('can dodge spells, leaving health intact and recording a visible miss',()=>{
  let seen=false;for(let seed=1;seed<=200&&!seen;seed++){const g=createGame(1),attacker=g.red[0],victim=g.blue[0];attacker.champion=playableChampions.find(c=>c.id==='Ahri')!;attacker.atFountain=false;victim.atFountain=false;attacker.position=45;victim.position=55;const hp=victim.health;resolveAttack(g,attacker,victim,new Rng(seed),{victimAction:'retreat'});if(g.visualEvents.some(e=>e.type==='miss')){seen=true;expect(victim.health).toBe(hp)}}expect(seen).toBe(true);
 });
});
describe('real item recipes and purchasing',()=>{
 it('allows duplicate intermediate components required by a recipe',()=>{
  const g=createGame(),u=g.blue[0];g.phase='shop';u.gold=10000;expect(buyItem(g,'1011')).toBe(true);expect(buyItem(g,'1011')).toBe(true);expect(u.items).toEqual(['1011','1011']);expect(componentQuote('3083',u.items).consumed).toEqual(['1011','1011']);expect(buyItem(g,'3083')).toBe(true);expect(u.items).toEqual(['3083']);
 });
 it('charges the remaining recipe cost and consumes each component once',()=>{
  const g=createGame(),u=g.blue[0];g.phase='shop';u.gold=5000;expect(buyItem(g,'1029')).toBe(true);expect(buyItem(g,'1029')).toBe(true);const quote=componentQuote('3076',u.items);expect(quote.consumed).toEqual(['1029','1029']);const gold=u.gold;expect(buyItem(g,'3076')).toBe(true);expect(u.gold).toBe(gold-quote.price);expect(u.items).toEqual(['3076']);expect(statsFor(u).armor).toBeGreaterThan(u.champion.stats.armor);
 });
 it('can upgrade at six slots but cannot add a seventh',()=>{
  const g=createGame(),u=g.blue[0];g.phase='shop';u.gold=99999;u.items=['1029','1029','1036','1036','1052','1028'];expect(purchaseReason(g,u,'1001')).toContain('가득');expect(buyItem(g,'3076')).toBe(true);expect(u.items).toHaveLength(5);
 });
 it('rejects unaffordable and outside-shop purchases without mutations',()=>{
  const g=createGame(),u=g.blue[0];g.phase='playing';u.atFountain=false;const before=structuredClone(g);expect(buyItem(g,'1036')).toBe(false);expect(g).toEqual(before);g.phase='shop';u.gold=1;expect(buyItem(g,'1036')).toBe(false);expect(u.gold).toBe(1);expect(u.items).toHaveLength(0);
 });
 it('applies stats, enforces boot limit and uses exact sell price',()=>{
  const g=createGame(),u=g.blue[0];g.phase='shop';u.gold=10000;const ad=statsFor(u).ad;buyItem(g,'1036');expect(statsFor(u).ad).toBe(ad+10);const gold=u.gold;sellItem(g,0);expect(u.gold).toBe(gold+itemMap['1036'].gold.sell);expect(statsFor(u).ad).toBe(ad);buyItem(g,'1001');expect(purchaseReason(g,u,'1001')).toContain('장화');
 });
});
