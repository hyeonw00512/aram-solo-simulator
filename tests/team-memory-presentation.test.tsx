import {describe,it,expect} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {createGame,chooseDecision} from '../src/engine/game';
import {openDecision,planResponse,advanceEncounter} from '../src/engine/encounter';
import {rememberEncounter} from '../src/engine/memory';
import {Rng} from '../src/engine/rng';
import type {ResponsePlan,EncounterResult} from '../src/engine/types';
import {MemoryReaction,TrustChanges,MemoryHistory,TeamMemoryPreview,memoryReactionLabel} from '../src/ui/TeamMemory';
function match(){const g=createGame(173);g.time=100;g.phase='playing';for(const u of [...g.blue,...g.red]){u.atFountain=false;u.position=u.team==='blue'?42:55}openDecision(g,'standoff');chooseDecision(g,'engage');return g;}
const plan=(id:string,action:ResponsePlan['action']):ResponsePlan=>({unitId:id,action,reason:'test',misunderstood:false,weights:{engage:1,join:1,retreat:1,cover:1,poke:1,hesitate:1,chase:1,clear:1,push:1}});
const prior={trust:-60,reckless:3,experiences:4,reason:'반복된 불리한 진입',updatedAt:30};
describe('persistent memories are visible without rewriting past reactions',()=>{
 it('records actual before/after values for repeated mistakes, preserving meaningful memories through neutral fights',()=>{
  const g=match(),observer=g.blue[1],leader=g.blue[0],e=g.encounter!;e.initialOpportunity=-.6;e.rounds=[{time:100,plans:[plan(leader.id,'engage'),plan(observer.id,'hesitate')]}];leader.deaths++;
  const first=rememberEncounter(g).find(c=>c.observerId===observer.id&&c.leaderId===leader.id)!;expect(first).toMatchObject({before:0,after:-15,reckless:1});
  g.time++;const second=rememberEncounter(g).find(c=>c.observerId===observer.id&&c.leaderId===leader.id)!;expect(second).toMatchObject({before:-15,after:-32,reckless:2});
  const impression=structuredClone(observer.relationships[leader.id].lastChange);e.rounds[0].plans[0].action='poke';g.time++;
  const neutral=rememberEncounter(g).find(c=>c.observerId===observer.id&&c.leaderId===leader.id)!;
  expect(neutral.before).toBe(neutral.after);expect(observer.relationships[leader.id].lastChange).toEqual(impression);
 });
 it('does not turn an ordinary failed initiation into a reckless memory and records actual capped recovery',()=>{
  const g=match(),e=g.encounter!,u=g.blue[1],p=g.blue[0];e.initialOpportunity=.5;e.rounds=[{time:100,plans:[plan(p.id,'engage'),plan(u.id,'cover')]}];p.deaths++;
  const fail=rememberEncounter(g).find(c=>c.observerId===u.id&&c.leaderId===p.id)!;expect(fail).toMatchObject({before:0,after:-4,reckless:0});
  expect(fail.reason).toContain('단정하지');u.relationships[p.id].trust=78;e.protections=[{protector:p.id,protected:u.id}];
  const recovery=rememberEncounter(g).find(c=>c.observerId===u.id&&c.leaderId===p.id)!;expect(recovery.after-recovery.before).toBe(2);expect(recovery.reason).toContain('엄호');
 });
 it('shows caution only when memory is a recorded leading factor, and preserves the snapshot after trust changes',()=>{
  const g=match(),u=g.blue[1];u.relationships[g.playerId]={...prior};
  const chosen=Array.from({length:200},(_,i)=>planResponse(g,u,new Rng(i+1))).find(p=>p.memory?.factors.includes('caution'))!;
  expect(chosen).toBeDefined();expect(chosen.action).toBe('hesitate');expect(memoryReactionLabel(chosen)).toBe('이전 경험 때문에 주저');
  u.relationships[g.playerId].trust=50;u.relationships[g.playerId].reason='새로운 경험';
  const html=renderToStaticMarkup(<MemoryReaction game={g} plan={chosen}/>);expect(html).toContain('당시 신뢰 -60');expect(html).toContain(prior.reason);expect(html).not.toContain('새로운 경험');
  expect(JSON.parse(JSON.stringify(chosen)).memory).toEqual(chosen.memory);
 });
 it('explains favorable-angle cooperation despite distrust, while the same distrust can still cause caution',()=>{
  const g=match(),u=g.blue[1];u.relationships[g.playerId]={...prior};g.red.forEach(e=>e.health=e.maxHealth*.1);
  const choices=Array.from({length:300},(_,i)=>planResponse(g,u,new Rng(i+1)));
  const join=choices.find(p=>p.action==='join'&&p.memory?.factors.includes('angle'))!;
  expect(join).toBeDefined();expect(memoryReactionLabel(join)).toBe('불신하지만 이번 각에는 호응');expect(choices.some(p=>p.memory?.factors.includes('caution'))).toBe(true);
  u.position=20;g.red.forEach(e=>e.position=26);
  const cover=Array.from({length:300},(_,i)=>planResponse(g,u,new Rng(i+1))).find(p=>p.memory?.factors.includes('necessity'))!;
  expect(cover).toBeDefined();expect(cover.action).toBe('cover');expect(memoryReactionLabel(cover)).toBe('불신하지만 함께 받아침');
 });
 it('tracks the actual AI front leader, rather than attributing every memory to the player',()=>{
  const g=match(),u=g.blue[1],leader=g.blue[2];g.encounter!.intent='trade';g.encounter!.rounds=[{time:99,plans:[plan(leader.id,'engage')]}];u.relationships[leader.id]={...prior};
  const p=planResponse(g,u,new Rng(2));expect(p.memory?.leaderId).toBe(leader.id);
  expect(renderToStaticMarkup(<MemoryReaction game={g} plan={p}/>)).toContain(leader.champion.name);
 });
 it('stores encounter changes for recaps, renders AI-to-AI changes and keeps old saves compatible',()=>{
  const g=match();for(let i=0;i<4&&g.encounter;i++){g.time=g.encounter.nextWaveAt;advanceEncounter(g)}
  const result=g.encounterHistory.at(-1)!;expect(result.memoryChanges?.length).toBeGreaterThan(0);
  expect(JSON.parse(JSON.stringify(result)).memoryChanges).toEqual(result.memoryChanges);
  result.memoryChanges!.push({observerId:g.blue[1].id,leaderId:g.blue[2].id,time:g.time,before:-20,after:-13,reckless:1,reason:'실제 엄호 기록'});
  expect(renderToStaticMarkup(<TrustChanges game={g} result={result}/>)).toContain('팀원끼리 달라진 신뢰');
  expect(renderToStaticMarkup(<MemoryHistory game={g} unit={g.blue[1]}/>)).toContain('실제 엄호 기록');
  const old:EncounterResult={...result,memoryChanges:undefined};expect(renderToStaticMarkup(<TrustChanges game={g} result={old}/>)).toContain('신뢰 변화 기록이 없습니다');
  expect(renderToStaticMarkup(<MemoryReaction game={g} plan={plan(g.blue[1].id,'join')}/>)).toBe('');
 });
 it('does not create relationship memories for nonparticipants or mutate state while displaying the preview',()=>{
  const g=match(),e=g.encounter!;e.rounds=[{time:100,plans:[plan(g.playerId,'poke'),plan(g.blue[1].id,'poke')]}];const changes=rememberEncounter(g);
  expect(changes.some(c=>c.observerId===g.blue[2].id||c.leaderId===g.blue[2].id)).toBe(false);
  const before=structuredClone(g);renderToStaticMarkup(<TeamMemoryPreview game={g}/>);expect(g).toEqual(before);
 });
});
