import {describe,it,expect} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {createGame,chooseDecision} from '../src/engine/game';
import {sendQuickOrder,sendTeamChat,activeOrder,focusTarget,orderResponse,expireFocusOrders} from '../src/engine/team-chat';
import {openDecision,advanceEncounter} from '../src/engine/encounter';
import {advanceWorld,ensureWorld} from '../src/engine/world';
import {state} from '../src/engine/runtime';
import {refreshStats} from '../src/engine/stats';
import {playableChampions} from '../src/engine/data';
import {QuickOrders,QuickOrderMarker,quickResponseLabel} from '../src/ui/QuickOrders';
function lane(seed=1){const g=createGame(seed);g.phase='playing';g.time=100;for(const u of [...g.blue,...g.red]){u.atFountain=false;u.position=u.team==='blue'?42:52;u.items=[];u.augments=[];u.combat=undefined;refreshStats(u,true);state(u)}return g;}
function focusFight(seed=1){
 const g=lane(seed),attacker=g.blue[1],target=g.red[1];
 for(const u of [...g.blue,...g.red]){u.skillRanks={Q:0,W:0,E:0,R:0};state(u).nextAttack=99999;u.atFountain=true;}
 for(const u of [g.blue[0],attacker,g.red[0],target])u.atFountain=false;
 attacker.champion=playableChampions.find(c=>c.id==='Ashe')!;attacker.combat=undefined;refreshStats(attacker,true);state(attacker).nextAttack=0;
 g.red[0].position=46;target.position=54;attacker.order={id:1,kind:'focus',focusId:target.id,until:124,reason:'test'};
 const world=ensureWorld(g);world.nextWave=99999;world.minions=[];world.buildings.forEach(b=>b.nextAttack=99999);
 return {g,attacker,target};
}
describe('quick battlefield commands',()=>{
 it('records actual, deterministic individual responses and preserves them on save/load',()=>{
  let accepted=0,ignored=0;
  for(let seed=1;seed<=40;seed++){
   const g=lane(seed),copy=structuredClone(g);expect(sendQuickOrder(g,'group')).toBe(true);sendQuickOrder(copy,'group');expect(g).toEqual(copy);
   const report=g.chat!.quickOrder!;expect(report.responses).toHaveLength(4);
   for(const r of report.responses){const u=g.blue.find(u=>u.id===r.unitId)!;if(r.status==='accepted'){accepted++;expect(u.order?.id).toBe(report.id)}else if(r.status==='ignored'){ignored++;expect(u.order).toBeUndefined()}}
   expect(JSON.parse(JSON.stringify(g)).chat.quickOrder).toEqual(report);
  }
  expect(accepted).toBeGreaterThan(20);expect(ignored).toBeGreaterThan(10);
 });
 it('limits recipients, shares the chat cooldown and rejects paused-decision/preparation phases',()=>{
  const g=lane();expect(sendQuickOrder(g,'retreat',g.blue[1].id)).toBe(true);expect(g.chat!.quickOrder!.responses.map(r=>r.unitId)).toEqual([g.blue[1].id]);
  expect(sendQuickOrder(g,'group')).toBe(false);expect(sendTeamChat(g,'합류해줘')).toBe(false);g.time+=3;expect(sendTeamChat(g,'합류해줘')).toBe(true);
  for(const phase of ['pick','matchup','augment','shop','decision','finished'] as const){const copy=lane();copy.phase=phase;const before=structuredClone(copy);expect(sendQuickOrder(copy,'retreat')).toBe(false);expect(copy).toEqual(before)}
  const copy=lane(),before=structuredClone(copy);expect(sendQuickOrder(copy,'group',copy.red[0].id)).toBe(false);expect(copy).toEqual(before);
 });
 it('does not fabricate dead or portal replies and allows the dead player to direct living teammates',()=>{
  const g=lane();g.blue[0].alive=false;g.blue[1].alive=false;g.blue[2].portal={from:0,to:30,startedAt:100,arriveAt:103};g.blue[3].atFountain=true;g.blue[4].returningToBase=true;
  expect(sendQuickOrder(g,'group')).toBe(true);expect(g.chat!.quickOrder!.responses.every(r=>r.status==='unavailable')).toBe(true);expect(g.chat!.messages).toHaveLength(1);expect(g.blue.every(u=>!u.order)).toBe(true);
 });
 it('requires a visible living enemy for focus and expires it when that target dies or hides',()=>{
  const g=lane(),u=g.blue[1],target=g.red[0],before=structuredClone(g);
  expect(sendQuickOrder(g,'focus',undefined,g.blue[0].id)).toBe(false);expect(g).toEqual(before);
  target.champion=playableChampions.find(c=>c.id==='Evelynn')!;target.level=6;target.position=90;target.combat=undefined;
  expect(sendQuickOrder(g,'focus',undefined,target.id)).toBe(false);
  target.position=50;u.order={id:1,kind:'focus',focusId:target.id,until:124,reason:'test'};expect(focusTarget(g,u)?.id).toBe(target.id);
  target.position=90;expect(activeOrder(g,u)).toBeUndefined();expireFocusOrders(g);target.position=50;expect(activeOrder(g,u)).toBeUndefined();
  u.order.until=124;target.alive=false;expireFocusOrders(g);target.alive=true;expect(activeOrder(g,u)).toBeUndefined();
 });
 it('moves accepted focus orders toward the target and attacks that target ahead of a nearer enemy in normal play',()=>{
  let hits=0;
  for(let seed=1;seed<=10;seed++){const {g,attacker,target}=focusFight(seed);const before=attacker.position;advanceWorld(g);
   const events=g.visualEvents.filter(e=>e.from===attacker.id);hits+=events.length;expect(events.every(e=>e.to===target.id)).toBe(true);expect(attacker.position).not.toBe(before);
  }
  expect(hits).toBeGreaterThan(0);
 });
 it('prioritizes the focus target during encounters too, without changing the player decision',()=>{
  let hits=0;
  for(let seed=1;seed<=20;seed++){
   const {g,attacker,target}=focusFight(seed);openDecision(g,'standoff');chooseDecision(g,'wait');g.time=g.encounter!.nextWaveAt;advanceEncounter(g);
   expect(g.encounter?.intent??g.encounterHistory.at(-1)?.intent).toBe('wait');
   const events=g.visualEvents.filter(e=>e.from===attacker.id);hits+=events.length;expect(events.every(e=>e.to===target.id)).toBe(true);
  }
  expect(hits).toBeGreaterThan(0);
 });
 it('retreat and grouping change actual movement, while low health changes a focus preference to cover',()=>{
  const g=lane(),u=g.blue[1];u.position=60;u.order={id:1,kind:'retreat',until:124,reason:'test'};advanceWorld(g,false);expect(u.position).toBeLessThan(60);
  u.position=20;g.blue[0].position=42;u.order.kind='group';advanceWorld(g,false);expect(u.position).toBeGreaterThan(20);
  u.order.kind='focus';u.order.focusId=g.red[0].id;u.health=u.maxHealth*.2;expect(orderResponse(g,u)?.action).toBe('cover');g.time=124;expect(activeOrder(g,u)).toBeUndefined();
 });
 it('renders actual responses, stops claiming expired orders and keeps marker state read-only',()=>{
  const g=lane();sendQuickOrder(g,'group');const report=g.chat!.quickOrder!,r=report.responses.find(r=>r.status==='accepted')!;expect(r).toBeDefined();
  expect(quickResponseLabel(g,r)).toBe('지시 반영 중');g.time+=24;expect(quickResponseLabel(g,r)).toBe('지시 종료');
  const before=structuredClone(g);const html=renderToStaticMarkup(<QuickOrders game={g} selected={g.red[0].id} update={()=>{}}/>);expect(html).toContain('전장 빠른 지시');expect(html).toContain('집중 공격');
  renderToStaticMarkup(<svg><QuickOrderMarker game={g}/></svg>);expect(g).toEqual(before);
 });
});
