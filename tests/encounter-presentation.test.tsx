import {describe,it,expect} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {createGame,chooseDecision} from '../src/engine/game';
import {openDecision,advanceEncounter} from '../src/engine/encounter';
import {playableChampions} from '../src/engine/data';
import {tacticalSnapshot,encounterPresentation} from '../src/ui/encounter-view';
import {TacticalPreview,EncounterMoment,TacticalLayer} from '../src/ui/EncounterMoment';
import {DecisionWindow} from '../src/ui/DecisionWindow';

function match(){
 const g=createGame(173);g.phase='playing';g.time=40;
 g.blue.forEach(u=>{u.position=42;u.atFountain=false});g.red.forEach(u=>{u.position=55;u.atFountain=false});
 return g;
}
describe('tactical context and recorded encounter presentation',()=>{
 it('uses local living participants, excluding base, transit, returning and distant allies without changing state',()=>{
  const g=match();g.blue[1].atFountain=true;g.blue[2].portal={from:0,to:30,startedAt:40,arriveAt:43};g.blue[3].returningToBase=true;g.blue[4].position=0;
  g.red[1].alive=false;g.red[2].atFountain=true;g.red[3].position=99;
  const before=structuredClone(g),view=tacticalSnapshot(g);
  expect(view.allies.map(u=>u.id)).toEqual([g.playerId]);expect(view.enemies).toHaveLength(2);
  renderToStaticMarkup(<TacticalPreview game={g}/>);expect(g).toEqual(before);
 });
 it('does not expose an undetected enemy through the tactical map and does not invent an isolated target',()=>{
  const g=match();const target=g.red[0];target.champion=playableChampions.find(c=>c.id==='Evelynn')!;target.level=6;target.position=75;target.combat=undefined;
  g.blue.forEach(u=>u.position=42);g.red.slice(1).forEach(u=>u.position=99);
  expect(tacticalSnapshot(g).enemies).not.toContain(target);expect(target.combat).toBeUndefined();
  target.champion=playableChampions.find(c=>c.id==='Garen')!;
  g.red[1].position=80; // Outside the local window, but still close enough to support the target.
  expect(tacticalSnapshot(g).enemies).toContain(target);expect(tacticalSnapshot(g).exposed).toBeUndefined();
 });
 it('records actual movement and held position, and survives saved-game serialization',()=>{
  const g=match();openDecision(g,'standoff');chooseDecision(g,'wait');
  const initial=new Map([...g.blue,...g.red].map(u=>[u.id,u.position]));
  g.time=g.encounter!.nextWaveAt;advanceEncounter(g);
  for(const move of g.encounter!.rounds[0].movements!){
   expect(move.from).toBe(initial.get(move.unitId));expect(move.to).toBe([...g.blue,...g.red].find(u=>u.id===move.unitId)!.position);
  }
  const playerMove=g.encounter!.rounds[0].movements!.find(m=>m.unitId===g.playerId)!;
  expect(playerMove.from).toBe(playerMove.to);
  expect(encounterPresentation(JSON.parse(JSON.stringify(g)))).toEqual(encounterPresentation(g));
 });
 it('reads actual AI reasons and misunderstanding, with no predicted reactions before the first wave',()=>{
  const g=match();openDecision(g,'standoff');chooseDecision(g,'trade');
  expect(encounterPresentation(g)?.rows).toEqual([]);
  expect(renderToStaticMarkup(<EncounterMoment game={g}/>)).toContain('다음 판단');
  g.time=g.encounter!.nextWaveAt;advanceEncounter(g);
  const round=g.encounter!.rounds[0],plan=round.plans.find(p=>p.unitId===g.blue[1].id)!;
  plan.misunderstood=true;plan.reason='짧은 교환을 전면 진입 신호로 받아들였습니다';
  const before=structuredClone(g),html=renderToStaticMarkup(<EncounterMoment game={g}/>);
  expect(html).toContain(plan.reason);expect(html).toContain('교환을 진입 신호로 오해');expect(g).toEqual(before);
  expect(encounterPresentation(g)?.stage).toBe(0);g.time++;expect(encounterPresentation(g)?.stage).toBe(1);g.time++;expect(encounterPresentation(g)?.stage).toBe(2);
 });
 it('recognizes late joining from prior plans and supports old saves with no movement snapshots',()=>{
  const g=match();openDecision(g,'standoff');chooseDecision(g,'engage');g.time=g.encounter!.nextWaveAt;advanceEncounter(g);
  const first=g.encounter!.rounds[0],ally=first.plans.find(p=>p.unitId===g.blue[1].id)!;ally.action='hesitate';
  const second=structuredClone(first);second.time++;second.plans.find(p=>p.unitId===ally.unitId)!.action='join';delete first.movements;delete second.movements;g.encounter!.rounds.push(second);
  expect(encounterPresentation(g)?.rows.find(r=>r.unit.id===ally.unitId)?.late).toBe(true);
  expect(renderToStaticMarkup(<EncounterMoment game={g}/>)).toContain('뒤늦은 합류');
  expect(()=>renderToStaticMarkup(<svg><TacticalLayer game={g}/></svg>)).not.toThrow();
 });
 it('keeps the real result briefly and removes it for a new decision or after eight game seconds',()=>{
  const g=match();openDecision(g,'standoff');chooseDecision(g,'trade');
  for(let i=0;i<4&&g.encounter;i++){g.time=g.encounter.nextWaveAt;advanceEncounter(g)}
  expect(g.encounter).toBeUndefined();const result=g.encounterHistory.at(-1)!;
  expect(renderToStaticMarkup(<EncounterMoment game={g}/>)).toContain(result.text);
  g.phase='decision';expect(encounterPresentation(g)).toBeUndefined();g.phase='playing';g.time+=9;expect(encounterPresentation(g)).toBeUndefined();
 });
 it('only adds the tactical preview to combat decisions, preserving augment selection',()=>{
  const g=match();openDecision(g,'standoff');
  const render=()=>renderToStaticMarkup(<DecisionWindow game={g} open onMinimize={()=>{}} onSettings={()=>{}} update={()=>{}}/>);
  expect(render()).toContain('선택 직전 전장 상황');g.phase='augment';g.pending={title:'증강 선택',description:'',choices:[]};
  expect(render()).not.toContain('선택 직전 전장 상황');
 });
});
