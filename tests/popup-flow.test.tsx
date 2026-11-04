import {it,expect} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import App from '../src/App';
import {createGame,offerAugments,chooseAugment} from '../src/engine/game';
import {grantBonusLevel} from '../src/engine/progression';
import {usePortal,walkFromBase} from '../src/engine/portal';
import {buyItem} from '../src/engine/shop';
import {applyDamage,respawn} from '../src/engine/combat';
import {tick} from '../src/engine/game';
import {upgradeBattleSave} from '../src/storage';
import {tickPlayback} from '../src/ui/game-clock';
import {emptyPopups,syncPopups,openPopup,closePopup,minimizePopups} from '../src/ui/popup-flow';

function playing(){const g=createGame(415);offerAugments(g);chooseAugment(g,g.pending!.choices[0].id);g.phase='playing';g.time=80;g.nextDecision=99999;return g;}
function revived(){const g=playing(),u=g.blue[0];g.respawnPrompt=true;u.atFountain=true;u.holdAtBase=true;u.deaths=1;u.respawnAt=g.time;return g;}
const activeLabels=(html:string)=>[...html.matchAll(/<dialog[^>]*aria-label="([^"]+)"[^>]*data-active="true"/g)].map(m=>m[1]);
it('opens the shop once on every death, and never on respawn alone',()=>{
 const g=playing();let p=syncPopups(emptyPopups(),g);g.blue[0].atFountain=false;
 applyDamage(g,undefined,g.blue[0],999999,'test','true');p=syncPopups(p,g);expect(p.active).toBe('shop');
 expect(activeLabels(renderToStaticMarkup(<App initialGame={g} saveEnabled={false}/>))).toEqual(['아이템 창']);
 p=minimizePopups(p);expect(syncPopups(p,g).active).toBeNull();
 g.time=g.blue[0].respawnAt;respawn(g);p=syncPopups(p,g);expect(p.active).toBe('respawn');
 walkFromBase(g);applyDamage(g,undefined,g.blue[0],999999,'test','true');p=syncPopups(p,g);expect(p.active).toBe('shop');
});
it('shops first after a level 11 first death, then chooses level 7 and 11 augments without respawning',()=>{
 let g=playing();g.blue[0].level=11;g.blue[0].atFountain=false;
 g=tick(g);expect(g.blue[0].augments).toHaveLength(1);expect(g.blue[0].augmentClaims).toBe(1);
 applyDamage(g,undefined,g.blue[0],999999,'test','true');g=tick(g);
 expect(g.blue[0].augmentClaims).toBe(3);expect(g.blue[0].alive).toBe(false);
 let p=syncPopups(emptyPopups(),g);expect(p.active).toBe('shop');expect(p.back).toContain('decision');
 expect(buyItem(g,'1036')).toBe(true);p=closePopup(p,g);expect(p.active).toBe('decision');
 const time=g.time;expect(g.pending!.description).toContain('7레벨 증강');chooseAugment(g,g.pending!.choices[0].id);
 g=upgradeBattleSave(JSON.parse(JSON.stringify(g)));p=syncPopups(p,g);expect(p.active).toBe('decision');expect(g.pending!.description).toContain('11레벨 증강');
 chooseAugment(g,g.pending!.choices[0].id);p=syncPopups(p,g);expect(p.active).not.toBe('shop');expect(g.phase).toBe('playing');expect(g.blue[0].augments).toHaveLength(3);expect(g.blue[0].alive).toBe(false);expect(g.time).toBe(time);
 g.time=g.blue[0].respawnAt;respawn(g);p=syncPopups(p,g);expect(p.active).toBe('respawn');expect(g.pending).toBeUndefined();
});
it('automatically opens initial augments and the starting shop over the battlefield',()=>{
 const g=createGame(1);g.phase='augment';let p=syncPopups(emptyPopups(),g);expect(p.active).toBe('decision');offerAugments(g);p=syncPopups(p,g);expect(p.active).toBe('decision');
 chooseAugment(g,g.pending!.choices[0].id);p=syncPopups(p,g);expect(p.active).toBe('shop');
 const html=renderToStaticMarkup(<App initialGame={g} saveEnabled={false}/>);expect(activeLabels(html)).toEqual(['아이템 창']);expect(html).toContain('칼바람 나락 관전 지도');
 // Preparation decisions no longer live in the inline match-status section.
 const status=html.match(/<section class="decision-panel match-status"[\s\S]*?<\/section>/)?.[0];expect(status).not.toContain('<button');
});
it('automatically shows respawn once per death and can minimize/reopen without reappearing every tick',()=>{
 const g=revived();let p=syncPopups(emptyPopups(),g);expect(p.active).toBe('respawn');p=minimizePopups(p);
 for(let i=0;i<5;i++){g.time++;p=syncPopups(p,g);expect(p.active).toBeNull();}
 p=openPopup(p,'respawn');expect(p.active).toBe('respawn');walkFromBase(g);p=syncPopups(p,g);expect(p.active).toBeNull();
 g.blue[0].deaths++;g.blue[0].respawnAt=g.time+15;g.blue[0].atFountain=true;g.respawnPrompt=true;p=syncPopups(p,g);expect(p.active).toBe('respawn');
});
it('switches respawn to shopping, preserves the return route, and leaves no stale respawn window after departure',()=>{
 const g=revived();let p=syncPopups(emptyPopups(),g);g.shopReturn='walk';p=openPopup(p,'shop');expect(p.active).toBe('shop');expect(p.back).toEqual(['respawn']);
 p=syncPopups(p,g);expect(p.active).toBe('shop');p=closePopup(p,g);expect(p.active).toBe('respawn');p=openPopup(p,'shop');walkFromBase(g);p=closePopup(p,g);expect(p.active).toBeNull();expect(p.back).toEqual([]);
});
it('queues skill training behind a required choice and prioritizes new decisions over the shop',()=>{
 const g=playing();let p=openPopup(emptyPopups(),'shop');g.phase='decision';g.pending={title:'새 교전',description:'test',choices:[]};grantBonusLevel(g,g.blue[0]);p=syncPopups(p,g);
 expect(p.active).toBe('decision');expect(p.back).toEqual(['settings','shop']);g.phase='playing';g.pending=undefined;p=syncPopups(p,g);expect(p.active).toBe('shop');p=closePopup(p,g);expect(p.active).toBe('settings');
});
it('recognizes a later tactical choice even when the augment serial has not changed',()=>{
 const g=playing();g.augmentSerial=1;g.phase='decision';g.pending={title:'동일한 상황',description:'test',choices:[]};let p=syncPopups(emptyPopups(),g);p=minimizePopups(p);
 g.encounterSerial++;p=syncPopups(p,g);expect(p.active).toBe('decision');
});
it('opens manual skill investment on each new level, but does not nag for the same points or auto-investment',()=>{
 const g=playing();grantBonusLevel(g,g.blue[0]);let p=syncPopups(emptyPopups(),g);expect(p.active).toBe('settings');p=minimizePopups(p);g.time++;expect(syncPopups(p,g).active).toBeNull();grantBonusLevel(g,g.blue[0]);expect(syncPopups(p,g).active).toBe('settings');
 const auto=playing();auto.blue[0].autoSkills=true;grantBonusLevel(auto,auto.blue[0]);expect(syncPopups(emptyPopups(),auto).active).toBeNull();
});
it('finishes augment selection before showing the respawn decision',()=>{
 const g=revived();g.blue[0].augmentClaims=2;offerAugments(g);let p=syncPopups(emptyPopups(),g);expect(p.active).toBe('decision');chooseAugment(g,g.pending!.choices[0].id);p=syncPopups(p,g);expect(p.active).toBe('respawn');
});
it('freezes the entire match while shopping and resumes when the shop closes or minimizes',()=>{
 const g=revived();let p=openPopup(syncPopups(emptyPopups(),g),'shop');expect(buyItem(g,'1036')).toBe(true);
 const snapshot=structuredClone(g);for(let i=0;i<20;i++)expect(tickPlayback(g,false,p.active)).toBe(g);expect(g).toEqual(snapshot);
 p=closePopup(p,g);expect(p.active).toBe('respawn');expect(tickPlayback(g,false,p.active).time).toBe(g.time+1);
 p=minimizePopups(openPopup(p,'shop'));expect(tickPlayback(g,false,p.active).time).toBe(g.time+1);
 expect(tickPlayback(g,true,p.active)).toBe(g);
});
it('keeps augment selection paused even when minimized or rerouted through the shop',()=>{
 const g=revived();g.blue[0].augmentClaims=2;offerAugments(g);let p=syncPopups(emptyPopups(),g);
 expect(tickPlayback(g,false,p.active)).toBe(g);p=minimizePopups(p);expect(tickPlayback(g,false,p.active)).toBe(g);
 p=openPopup(p,'shop');expect(tickPlayback(g,false,p.active)).toBe(g);p=minimizePopups(p);
 chooseAugment(g,g.pending!.choices[0].id);expect(tickPlayback(g,true,p.active)).toBe(g);expect(tickPlayback(g,false,p.active).time).toBe(g.time+1);
});
it('keeps reset confirmation on top, restores the previous window on cancellation, and opens results automatically',()=>{
 const g=playing();let p=openPopup(openPopup(emptyPopups(),'base'),'restart');g.phase='finished';g.winner='blue';p=syncPopups(p,g);expect(p.active).toBe('restart');p=closePopup(p,g);expect(p.active).toBe('base');p=closePopup(p,g);expect(p.active).toBe('result');expect(syncPopups(emptyPopups(),createGame(1)).active).toBeNull();
});
it('renders exactly one active native dialog for respawn, skills, and results, with a persistent reopen menu',()=>{
 const g=revived();let html=renderToStaticMarkup(<App initialGame={g} saveEnabled={false}/>);expect(activeLabels(html)).toEqual(['부활 후 복귀 선택']);expect(html).toContain('인게임 팝업 메뉴');expect(html).toContain('부활 · 복귀 선택');
 usePortal(g);grantBonusLevel(g,g.blue[0]);html=renderToStaticMarkup(<App initialGame={g} saveEnabled={false}/>);expect(activeLabels(html)).toEqual(['플레이 설정']);
 g.phase='finished';g.winner='blue';html=renderToStaticMarkup(<App initialGame={g} saveEnabled={false}/>);expect(activeLabels(html)).toEqual(['경기 결과']);
});
