import {it,expect,vi} from 'vitest';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import App from '../src/App';
import {createGame,offerAugments,chooseAugment,depart} from '../src/engine/game';
import {advancePickLobby,advanceMatchup,cancelPickTrade,chooseBenchChampion,ensurePickLobby,lockPicks,requestPickTrade,respondPickTrade} from '../src/engine/pick-lobby';
import {upgradeBattleSave} from '../src/storage';
import {playableChampions} from '../src/engine/data';
function step(g:ReturnType<typeof createGame>,n:number){for(let i=0;i<n;i++)advancePickLobby(g);}
function unique(g:ReturnType<typeof createGame>){const ids=[...g.blue,...g.red].map(u=>u.champion.id).concat(g.lobby!.bench);expect(new Set(ids).size).toBe(ids.length);expect(ids.length).toBe(playableChampions.length);}
it('offers unused champions and returns the previous pick to the bench with refreshed stats',()=>{
 const g=createGame(4),u=g.blue[0],before=u.champion.id,target=g.lobby!.bench[0];expect(chooseBenchChampion(g,target)).toBe(true);
 expect(u.champion.id).toBe(target);expect(g.lobby!.bench).toContain(before);expect(u.health).toBe(u.maxHealth);expect(u.skillRanks).toEqual({Q:1,W:1,E:1,R:0});
 expect(chooseBenchChampion(g,g.red[0].champion.id)).toBe(false);expect(chooseBenchChampion(g,g.blue[1].champion.id)).toBe(false);unique(g);
});
it('can request every teammate, protects pending picks, and supports cancellation',()=>{
 for(let i=1;i<5;i++){const g=createGame(5),id=g.blue[i].id;expect(requestPickTrade(g,id)).toBe(true);expect(g.lobby!.trade?.partnerId).toBe(id);
  expect(chooseBenchChampion(g,g.lobby!.bench[0])).toBe(false);expect(chooseBenchChampion(g,g.lobby!.bench[0],id)).toBe(false);expect(lockPicks(g)).toBe(false);
  expect(requestPickTrade(g,g.blue[1].id)).toBe(false);cancelPickTrade(g);expect(g.lobby!.trade).toBeUndefined();expect(requestPickTrade(g,id)).toBe(false);unique(g);
 }
});
it('AI can accept or reject outgoing trades without duplicating champions',()=>{
 const outcomes=new Set<boolean>();
 for(let seed=1;seed<=80;seed++){const g=createGame(seed),old=g.blue[0].champion.id,other=g.blue[3].champion.id;requestPickTrade(g,g.blue[3].id);step(g,3);
  const accepted=g.blue[0].champion.id===other;outcomes.add(accepted);expect(g.blue[3].champion.id).toBe(accepted?old:other);expect(g.lobby!.trade).toBeUndefined();unique(g);
 }
 expect([...outcomes].sort()).toEqual([false,true]);
});
it('teammates change bench picks and send offers the player can accept or reject',()=>{
 for(const accept of [true,false]){const g=createGame(17),initial=g.blue.map(u=>u.champion.id);step(g,12);
  expect(g.blue.map(u=>u.champion.id)).not.toEqual(initial);expect(g.lobby!.trade?.direction).toBe('incoming');const t=g.lobby!.trade!,u=g.blue.find(u=>u.id===t.partnerId)!;
  expect(respondPickTrade(g,accept)).toBe(true);expect(g.blue[0].champion.id).toBe(accept?t.partnerChampion:t.playerChampion);expect(u.champion.id).toBe(accept?t.playerChampion:t.partnerChampion);unique(g);
 }
});
it('expires incoming offers and bounds bench activity while keeping the game clock at zero',()=>{
 const g=createGame(7);step(g,27);expect(g.lobby!.trade).toBeUndefined();step(g,120);expect(g.time).toBe(0);
 expect(Object.values(g.lobby!.aiChanges).every(n=>n<=2)).toBe(true);unique(g);
});
it('freezes all picks through augment and shop preparation, then departs normally',()=>{
 const g=createGame(12);expect(lockPicks(g)).toBe(true);const chosen=g.blue.map(u=>u.champion.id),elapsed=g.lobby!.elapsed;
 expect(chooseBenchChampion(g,g.lobby!.bench[0])).toBe(false);expect(requestPickTrade(g,g.blue[1].id)).toBe(false);step(g,40);expect(g.lobby!.elapsed).toBe(elapsed);
 expect(g.phase).toBe('matchup');for(let i=0;i<7;i++)advanceMatchup(g);
 offerAugments(g);chooseAugment(g,g.pending!.choices[0].id);expect(g.phase).toBe('shop');depart(g);expect(g.phase).toBe('playing');expect(g.blue.map(u=>u.champion.id)).toEqual(chosen);unique(g);
});
it('restores pending offers, bench state and timers without restarting preparation',()=>{
 const g=createGame(5);step(g,12);const saved=JSON.stringify(g.lobby),restored=upgradeBattleSave(JSON.parse(JSON.stringify(g)));expect(JSON.stringify(restored.lobby)).toBe(saved);
 delete restored.lobby;ensurePickLobby(restored);unique(restored);
});
it('never renders enemy identities, rosters or the battlefield until picks are locked',()=>{
 const g=createGame(4);
 try{
  for(const phase of ['pick','swap'] as const){g.phase=phase;vi.stubGlobal('localStorage',{getItem:()=>JSON.stringify(g)});const html=renderToStaticMarkup(createElement(App,{showStartScreen:false}));
   expect(html).toContain('상대팀 비공개');expect(html).not.toContain('aria-label="적군 현황"');expect(html).not.toContain('aria-label="칼바람 나락 관전 지도');
   for(const u of g.red){expect(html).not.toContain(`/assets/champions/${u.champion.id}.png`);expect(html.includes(`>${u.champion.name}<`)).toBe(false);}
  }
 }finally{vi.unstubAllGlobals();}
});
