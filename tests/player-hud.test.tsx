import {describe,it,expect} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {createGame,chooseDecision} from '../src/engine/game';
import {openDecision,advanceEncounter} from '../src/engine/encounter';
import {playableChampions} from '../src/engine/data';
import {state} from '../src/engine/runtime';
import {refreshStats} from '../src/engine/stats';
import {playerHudState} from '../src/ui/player-hud-state';
import {PlayerHud} from '../src/ui/PlayerHud';

function match(champion='Ahri'){
 const g=createGame(173);g.phase='playing';g.time=40;
 g.blue.forEach(u=>{u.position=42;u.atFountain=false});g.red.forEach(u=>{u.position=55;u.atFountain=false});
 const u=g.blue[0];u.champion=playableChampions.find(c=>c.id===champion)!;u.level=6;u.skillRanks={Q:3,W:1,E:1,R:1};u.combat=undefined;refreshStats(u);u.health=u.maxHealth;state(u);
 return g;
}
describe('player HUD follows simulation state',()=>{
 it('renders every supported champion without changing game state or initializing missing combat state',()=>{
  for(const c of playableChampions){
   const g=match(c.id);g.blue[0].combat=undefined;const before=structuredClone(g);
   const html=renderToStaticMarkup(<PlayerHud game={g} onSettings={()=>{}} onShop={()=>{}} onFocus={()=>{}}/>);
   expect(html).toContain('내 챔피언 전용 HUD');expect(html).toContain(c.name);expect(playerHudState(g).skills).toHaveLength(4);expect(g).toEqual(before);
  }
 });
 it('distinguishes mana and energy shortage, while flow and resourceless champions do not spend mana',()=>{
  for(const [champion,label] of [['Ahri','마나 부족'],['Kennen','기력 부족']]){
   const g=match(champion);state(g.blue[0]).mana=0;state(g.blue[0]).energy=0;
   expect(playerHudState(g).skills.find(s=>s.slot==='Q')?.label).toBe(label);
  }
  for(const champion of ['Garen','Aatrox','Yasuo']){
   const g=match(champion);state(g.blue[0]).mana=0;state(g.blue[0]).flow=0;
   expect(playerHudState(g).skills.every(s=>s.cost===0)).toBe(true);
   expect(playerHudState(g).skills.some(s=>s.tone==='starved')).toBe(false);
  }
 });
 it('reads remaining cooldown, rank locks and actual item-adjusted costs',()=>{
  const g=match(),u=g.blue[0],r=state(u);r.ready.Q=43.2;
  expect(playerHudState(g).skills[0].label).toBe('4초');g.time=44;expect(playerHudState(g).skills[0].label).toBe('재사용 가능');
  const cost=playerHudState(g).skills[0].cost;u.items.push('2522');expect(playerHudState(g).skills[0].cost).toBe(cost*2);
  u.skillRanks!.R=0;expect(playerHudState(g).skills[3].label).toBe('미습득');u.level=5;expect(playerHudState(g).skills[3].label).toBe('6레벨 필요');
 });
 it('shows active control and shield durations, ignores expired effects and restricts rooted dashes',()=>{
  const g=match(),r=state(g.blue[0]);r.effects=[{kind:'silence',value:1,until:42},{kind:'shield',value:100,until:45},{kind:'shield',value:30,until:41},{kind:'stun',value:1,until:39}];
  const h=playerHudState(g);expect(h.shield).toBe(130);expect(h.skills[0].label).toBe('침묵');expect(h.effects.some(e=>e.kind==='stun')).toBe(false);
  g.time=42;expect(playerHudState(g).shield).toBe(100);expect(playerHudState(g).skills[0].label).toBe('재사용 가능');
  r.effects.push({kind:'root',value:1,until:46});expect(playerHudState(g).skills[3].label).toBe('속박');expect(playerHudState(g).skills[0].label).toBe('재사용 가능');
  r.procs.polymorphUntil=47;expect(playerHudState(g).skills[0].label).toBe('변이');
 });
 it('prioritizes death, transit, base and finished states over stale action text',()=>{
  const g=match(),u=g.blue[0];u.status='진입';u.alive=false;u.respawnAt=51.3;u.health=0;
  expect(playerHudState(g).action).toBe('부활까지 12초');expect(playerHudState(g).warnings).toEqual([]);expect(playerHudState(g).skills[0].label).toBe('사망');
  u.alive=true;u.portal={from:0,to:30,startedAt:40,arriveAt:43};expect(playerHudState(g).action).toBe('포탈 이동 · 3초');expect(playerHudState(g).skills[0].label).toBe('포탈 이동');
  u.portal=undefined;u.atFountain=true;g.respawnPrompt=true;expect(playerHudState(g).action).toBe('복귀 방식 선택');
  g.phase='finished';g.winner='blue';expect(playerHudState(g).action).toBe('승리');expect(playerHudState(g).warnings).toEqual([]);
 });
 it('uses direct encounter decisions and actual plans rather than the routine playstyle explanation',()=>{
  const g=match();g.blue[0].playStyle='coward';g.blue[0].tacticalReason='체력이 낮아 후퇴';openDecision(g,'standoff');
  expect(playerHudState(g).action).toBe('내 판단 대기');chooseDecision(g,'engage');expect(playerHudState(g).action).toBe('이니시를 연다');
  g.time=g.encounter!.nextWaveAt;advanceEncounter(g);const plan=g.encounter!.rounds[0].plans.find(p=>p.unitId===g.playerId)!;
  expect(playerHudState(g).reason).toBe(plan.reason);expect(playerHudState(g).action).toBe('진입');
 });
 it('shows only recent events involving the player and counts only nearby field participants for danger',()=>{
  const g=match(),u=g.blue[0];u.health=u.maxHealth*.2;g.blue.slice(1).forEach(a=>a.atFountain=true);
  g.visualEvents=[{at:40,to:u.id,type:'physical',amount:120},{at:39,to:u.id,type:'heal',amount:25},{at:38,to:u.id,type:'miss',amount:0},{at:37,to:u.id,type:'magic',amount:500},{at:40,to:g.blue[1].id,type:'physical',amount:200},{at:42,to:u.id,type:'physical',amount:200}];
  const h=playerHudState(g);expect(h.recentDamage).toBe(120);expect(h.recentHeal).toBe(25);expect(h.recentDodges).toBe(1);expect(h.warnings).toContain('체력 위험 · 20%');expect(h.warnings).toContain('주변 인원 열세 · 아군 1 / 보이는 적 5');
  g.time=43;expect(playerHudState(g).recentHeal).toBe(0);expect(playerHudState(g).recentDodges).toBe(0);
 });
});
