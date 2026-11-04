import {it,expect,vi} from 'vitest';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import App from '../src/App';
import {createGame,tick,offerAugments,chooseAugment,depart} from '../src/engine/game';
import {advanceMatchup,advancePickLobby,lockPicks,chooseBenchChampion} from '../src/engine/pick-lobby';
import {upgradeBattleSave} from '../src/storage';
import {composition} from '../src/ui/MatchupScreen';
it('shows the locked lineups for seven steps before entering the game to prepare augments',()=>{
 const g=createGame(51);lockPicks(g);const lineup=JSON.stringify([...g.blue,...g.red]),bench=[...g.lobby!.bench];
 expect(g.phase).toBe('matchup');expect(g.matchupRemaining).toBe(7);expect(tick(g)).toBe(g);
 expect(chooseBenchChampion(g,bench[0])).toBe(false);advancePickLobby(g);offerAugments(g);expect(g.pending).toBeUndefined();
 for(let i=1;i<=6;i++){advanceMatchup(g);expect(g.phase).toBe('matchup');expect(g.matchupRemaining).toBe(7-i);}
 expect(JSON.stringify([...g.blue,...g.red])).toBe(lineup);expect(g.time).toBe(0);advanceMatchup(g);
 expect(g.phase).toBe('augment');expect(g.matchupRemaining).toBeUndefined();offerAugments(g);chooseAugment(g,g.pending!.choices[0].id);expect(g.phase).toBe('shop');depart(g);expect(g.phase).toBe('playing');
});
it('preserves remaining preview time across save reload and ignores countdown outside preview',()=>{
 const g=createGame(1);lockPicks(g);advanceMatchup(g);advanceMatchup(g);const restored=upgradeBattleSave(JSON.parse(JSON.stringify(g)));
 expect(restored.matchupRemaining).toBe(5);for(let i=0;i<5;i++)advanceMatchup(restored);expect(restored.phase).toBe('augment');advanceMatchup(restored);expect(restored.phase).toBe('augment');
});
it('renders both teams only after lock, with no shop or augment overlay on the VS screen',()=>{
 const g=createGame(31);lockPicks(g);
 try{vi.stubGlobal('localStorage',{getItem:()=>JSON.stringify(g)});const html=renderToStaticMarkup(createElement(App));
  expect(html).toContain('양 팀 대결 미리보기');expect(html).toContain('아군 조합');expect(html).toContain('상대 조합');
  for(const u of [...g.blue,...g.red])expect(html).toContain(`/assets/champions/${u.champion.id}.png`);
  expect(html).not.toContain('아이템 창');expect(html).not.toContain('<dialog');expect(html).not.toContain('플레이 설정');
  for(let i=0;i<7;i++)advanceMatchup(g);const inGame=renderToStaticMarkup(createElement(App));expect(inGame).toContain('칼바람 나락 관전 지도');expect(inGame).toContain('증강 3개 확인');expect(inGame).not.toContain('pick-screen');
  offerAugments(g);chooseAugment(g,g.pending!.choices[0].id);const shop=renderToStaticMarkup(createElement(App));expect(shop).toContain('칼바람 나락 관전 지도');expect(shop).not.toContain('pick-screen');
 }finally{vi.unstubAllGlobals();}
});
it('summarizes each team using champion roles, counting hybrid roles explicitly',()=>{
 const g=createGame(1),summary=composition(g.blue);for(const item of summary)expect(item.count).toBe(g.blue.filter(u=>u.champion.roles.includes(item.role)).length);
 expect(summary.reduce((sum,r)=>sum+r.count,0)).toBe(g.blue.reduce((sum,u)=>sum+u.champion.roles.length,0));
});
