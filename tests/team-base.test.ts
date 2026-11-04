import {describe,it,expect} from 'vitest';
import {createGame,tick} from '../src/engine/game';
import {playableChampions,augments} from '../src/engine/data';
import {state} from '../src/engine/runtime';
import {refreshStats} from '../src/engine/stats';
import {parseOrder,sendTeamChat,activeOrder} from '../src/engine/team-chat';
import {aiShopping,buyItem} from '../src/engine/shop';
import {antiHealPlan,ownsAntiHeal,routeFor,pickAiAugment,augmentFit} from '../src/engine/build-advisor';
import {returnToBase,advanceBases} from '../src/engine/base';
import {advanceCombat,applyDamage} from '../src/engine/combat-v4';
import {advancePortals,walkFromBase} from '../src/engine/portal';
import {canShop,itemStatLines,hasOriginalItemEffect,purchaseReason} from '../src/engine/items';
import {spawnPosition} from '../src/engine/map-layout';
import {openDecision,startEncounter,planResponse} from '../src/engine/encounter';
import {Rng} from '../src/engine/rng';
import {teammateLine} from '../src/engine/chat-voice';
function lane(seed=17){const g=createGame(seed);g.phase='playing';g.time=100;g.nextDecision=9999;g.nextAugmentLevel=99;for(const u of [...g.blue,...g.red]){u.atFountain=false;u.position=u.team==='blue'?44:54;u.items=[];u.combat=undefined;refreshStats(u,true);state(u)}return g}
function accepted(path:'ap'|'ad'|'tank'){
 for(let seed=1;seed<200;seed++){const g=lane(seed),u=g.blue[1];state(u).buildPath=path;sendTeamChat(g,'치감템 가줘',u.id);if(u.shopRequest)return g}throw Error('No accepted request');
}
describe('team chat and real purchases',()=>{
 it('allows a dead player to buy without reviving or changing their respawn time',()=>{
  const g=lane(),u=g.blue[0];u.alive=false;u.health=0;u.atFountain=false;u.respawnAt=g.time+20;u.gold=1000;
  expect(canShop(g,u)).toBe(true);expect(buyItem(g,'1036')).toBe(true);expect(u.items).toContain('1036');expect(u.gold).toBe(650);expect(u.alive).toBe(false);expect(u.health).toBe(0);expect(u.respawnAt).toBe(g.time+20);
 });
 it('silently accepts and fulfills antiheal requests while dead',()=>{
  for(const path of ['ap','ad','tank'] as const){const g=accepted(path),u=g.blue[1];u.alive=false;u.health=0;u.atFountain=false;u.gold=1000;u.shopRequest=undefined;g.chat=undefined;
   expect(sendTeamChat(g,'치감템 가줘',u.id)).toBe(true);expect(u.shopRequest).toMatchObject({status:'pending'});expect(g.chat!.messages.filter(m=>m.sender===u.id)).toEqual([]);
   aiShopping(g,u);expect(ownsAntiHeal(u)).toBe(true);expect(u.shopRequest).toMatchObject({status:'fulfilled'});expect(u.gold).toBeLessThan(1000);expect(u.alive).toBe(false);expect(g.chat!.messages.filter(m=>m.sender===u.id)).toEqual([]);
  }
 });
 it('keeps dialogue deterministic without mutating gameplay and avoids consecutive repeated replies',()=>{
  const g=lane(),u=g.blue[1];u.traits=['공격적입니다'];const saved=structuredClone(g),first=teammateLine(g,u,'gold',{item:'망각의 구',gold:125});expect(first).toContain('125');expect(first).not.toContain('{');expect(first).toEqual(teammateLine(g,u,'gold',{item:'망각의 구',gold:125}));expect(g).toEqual(saved);
  g.chat={serial:1,orderSerial:0,messages:[{id:1,at:g.time,sender:u.id,text:first,tone:'defer'}]};expect(teammateLine(g,u,'gold',{item:'망각의 구',gold:125})).not.toBe(first);
  u.relationships[g.playerId]={trust:-40,reckless:0,experiences:3,reason:'test',updatedAt:0};expect(teammateLine(g,u,'engage')).toContain('이번엔');
 });
 it('understands supported Korean orders and rejects negated or unrelated text',()=>{
  expect(parseOrder('치감템 가줘')).toBe('antiheal');expect(parseOrder('같이 들어가자')).toBe('engage');expect(parseOrder('라인 정리해줘')).toBe('clear');expect(parseOrder('치감 사지 마')).toBeUndefined();expect(parseOrder('고마워')).toBeUndefined();
 });
 it('keeps different reactions deterministic and dependent on trust',()=>{
  let friendly=0,stubborn=0;const tones=new Set<string>();
  for(let seed=1;seed<=80;seed++){for(const positive of [true,false]){const g=lane(seed),u=g.blue[1];u.traits=[positive?'사립니다':'고집이 셉니다'];u.relationships[g.playerId]={trust:positive?80:-80,reckless:0,experiences:5,reason:'test',updatedAt:0};const copy=structuredClone(g);sendTeamChat(g,'합류해줘',u.id);sendTeamChat(copy,'합류해줘',u.id);expect(g).toEqual(copy);if(u.order){if(positive)friendly++;else stubborn++}g.chat!.messages.forEach(m=>tones.add(m.tone));}}
  expect(friendly).toBeGreaterThan(stubborn+30);expect(tones.has('accept')).toBe(true);expect(tones.has('ignore')).toBe(true);
 });
 it('limits recipients and preserves chat on save/load without accepting finished-game orders',()=>{
  const g=lane();expect(sendTeamChat(g,'안녕',g.red[0].id)).toBe(false);sendTeamChat(g,'안녕',g.blue[1].id);expect(sendTeamChat(g,'합류해줘')).toBe(false);expect(JSON.parse(JSON.stringify(g)).chat).toEqual(g.chat);g.phase='finished';expect(sendTeamChat(g,'치감템 가줘')).toBe(false);
 });
 it('waits for a shop then spends gold on build-appropriate antiheal, without duplicate purchases',()=>{
  for(const path of ['ap','ad','tank'] as const){const g=accepted(path),u=g.blue[1],plan=antiHealPlan(u);u.gold=1000;aiShopping(g,u);expect(u.items).toEqual([]);expect(u.gold).toBe(1000);u.atFountain=true;aiShopping(g,u);expect(u.items).toContain(plan.component);expect(u.gold).toBeLessThan(1000);expect(u.shopRequest?.status).toBe('fulfilled');const inventory=[...u.items];u.gold=0;aiShopping(g,u);expect(u.items).toEqual(inventory);expect(g.logs.some(l=>l.text.includes('구매'))).toBe(true);}
 });
 it('never gives a poor or full-build teammate free items or sells their gear',()=>{
  const g=accepted('ap'),u=g.blue[1];u.atFountain=true;u.gold=0;aiShopping(g,u);expect(u.items).toEqual([]);expect(u.shopRequest?.status).toBe('pending');u.items=routeFor(u);u.gold=50000;const inventory=[...u.items];aiShopping(g,u);expect(u.items).toEqual(inventory);expect(ownsAntiHeal(u)).toBe(false);
 });
 it('turns accepted combat orders into a temporary decision preference',()=>{
  const g=lane(),u=g.blue[1];openDecision(g);startEncounter(g,g.pending!.choices[0].id);const before=planResponse(g,u,new Rng(5));u.order={id:1,kind:'retreat',until:g.time+24,reason:'test'};const after=planResponse(g,u,new Rng(5));expect(after.weights.retreat).toBe(before.weights.retreat+14);g.time+=24;expect(activeOrder(g,u)).toBeUndefined();
 });
});
describe('fountain and suitable builds',()=>{
 it('walks back through danger without unlocking shop, holds position, and departs manually',()=>{
  const g=lane(),u=g.blue[0];u.champion=playableChampions.find(c=>c.id==='Ahri')!;u.combat=undefined;refreshStats(u,true);u.health=u.maxHealth/2;expect(returnToBase(g)).toBe(true);advanceBases(g);expect(u.position).toBeLessThan(44);expect(u.position).toBeGreaterThan(spawnPosition('blue'));const hp=u.health;applyDamage(g,g.red[0],u,50,'true');expect(u.health).toBeLessThan(hp);expect(canShop(g,u)).toBe(false);
  for(let i=0;i<30;i++){g.time++;advanceBases(g)}expect(u.atFountain).toBe(true);expect(canShop(g,u)).toBe(false);expect(u.holdAtBase).toBe(true);const injured=u.health;state(u).mana=0;advanceCombat(g);expect(u.health).toBeGreaterThan(injured);expect(state(u).mana).toBeGreaterThan(0);g.time+=30;advancePortals(g);expect(u.portal).toBeUndefined();expect(walkFromBase(g)).toBe(true);expect(u.atFountain).toBe(false);
 });
 it('does not open a combat decision while returning and survives save/load',()=>{
  const g=lane();g.nextDecision=0;returnToBase(g);const next=tick(g);expect(next.phase).toBe('playing');expect(next).toEqual(tick(JSON.parse(JSON.stringify(g))));expect(returnToBase({...g,phase:'decision'})).toBe(false);
 });
 it('buys legal full builds for all supported champions and both Malphite styles',()=>{
  for(const c of playableChampions){for(const seed of [3,4]){const g=lane(seed),u=g.blue[1];u.champion=c;u.combat=undefined;u.atFountain=true;u.gold=100000;aiShopping(g,u);expect(u.items).toEqual(routeFor(u));expect(u.items).toHaveLength(6);expect(new Set(u.items).size).toBe(6);}}
 });
 it('usually gives healers healing augments and never offers casters a harmful conversion in the silver pool',()=>{
  const g=lane(),u=g.blue[1],silver=augments.filter(a=>a.tier==='silver');u.champion=playableChampions.find(c=>c.id==='Nami')!;state(u).buildPath='support';let heals=0;
  for(let seed=1;seed<=100;seed++)if(pickAiAugment(u,silver,new Rng(seed))!.a.name==='응급 처치 키트')heals++;expect(heals).toBeGreaterThanOrEqual(85);
  u.champion=playableChampions.find(c=>c.id==='Ahri')!;state(u).buildPath='ap';for(let seed=1;seed<=100;seed++)expect(pickAiAugment(u,silver,new Rng(seed))!.a.name).not.toBe('마법사 (물리)');expect(pickAiAugment(u,[],new Rng(1))).toBeUndefined();
  u.champion=playableChampions.find(c=>c.id==='Kaisa')!;expect(augmentFit(u,augments.find(a=>a.name.startsWith('거석상'))!).score).toBe(1);
 });
 it('shows only actual stats for basic items without inventing a passive',()=>{
  expect(itemStatLines('1036')).toContain('공격력 +10');expect(hasOriginalItemEffect('1036')).toBe(false);expect(hasOriginalItemEffect('3084')).toBe(true);
 });
});
