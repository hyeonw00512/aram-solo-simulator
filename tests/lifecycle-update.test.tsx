import {describe,it,expect} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {createGame,offerAugments,chooseAugment,rerollAugment,tick} from '../src/engine/game';
import {applyDamage,advanceCombat,respawn} from '../src/engine/combat';
import {canShop,shopItems} from '../src/engine/items';
import {buyItem} from '../src/engine/shop';
import {returnToBase,advanceBases} from '../src/engine/base';
import {usePortal,walkFromBase,advancePortals} from '../src/engine/portal';
import {spawnPosition} from '../src/engine/map-layout';
import {openDecision} from '../src/engine/encounter';
import {state,addEffect} from '../src/engine/runtime';
import {playableChampions,augments} from '../src/engine/data';
import {statsFor,refreshStats} from '../src/engine/stats';
import {respondPickTrade,requestPickTrade,advancePickLobby,ensurePickLobby} from '../src/engine/pick-lobby';
import {augmentGrade} from '../src/engine/augment-grades';
import {Shop} from '../src/ui/Shop';
import {RespawnPrompt} from '../src/ui/RespawnPrompt';
import {DecisionWindow} from '../src/ui/DecisionWindow';
import {WorldStatus} from '../src/ui/WorldLayer';
import {upgradeBattleSave} from '../src/storage';

function match(){const g=createGame(60);offerAugments(g);chooseAugment(g,g.pending!.choices[0].id);g.phase='playing';g.time=30;g.nextDecision=99999;return g;}
describe('pick exchange and augment refresh',()=>{
 it('adds newly supported champions to an existing pick lobby without duplicates',()=>{
  const g=createGame(1),unassigned=g.lobby!.bench[0];g.lobby!.bench=g.lobby!.bench.filter(id=>id!==unassigned);ensurePickLobby(g);ensurePickLobby(g);expect(g.lobby!.bench.filter(id=>id===unassigned)).toHaveLength(1);expect(new Set([...g.blue,...g.red].map(u=>u.champion.id)).size).toBe(10);
 });
 it('can request the same partner immediately after accepting an incoming exchange',()=>{
  const g=createGame(1),l=g.lobby!,u=g.blue[1];l.elapsed=20;l.trade={partnerId:u.id,direction:'incoming',playerChampion:g.blue[0].champion.id,partnerChampion:u.champion.id,resolveAt:30};
  const old=g.blue[0].champion.id;expect(respondPickTrade(g,true)).toBe(true);expect(u.champion.id).toBe(old);expect(requestPickTrade(g,u.id)).toBe(true);
 });
 it('can immediately request another exchange after an outgoing request is accepted',()=>{
  let accepted=0;for(let seed=1;seed<=30;seed++){const g=createGame(seed),old=g.blue[0].champion.id,u=g.blue[1];requestPickTrade(g,u.id);for(let i=0;i<3;i++)advancePickLobby(g);if(u.champion.id===old){accepted++;expect(requestPickTrade(g,u.id)).toBe(true);}}expect(accepted).toBeGreaterThan(0);
 });
 it('rerolls each card at most once without reusing any earlier offer, through the fourth round',()=>{
  const g=createGame(9),seen=new Set<string>();for(let slot=0;slot<4;slot++){
   if(slot){g.time=100;g.blue[0].augmentClaims=slot+1;g.phase='playing';}
   offerAugments(g);expect(g.pending!.choices.length).toBeGreaterThan(0);expect(g.pending!.choices.length).toBeLessThanOrEqual(3);
   for(const choice of g.pending!.choices){expect(seen.has(choice.id)).toBe(false);seen.add(choice.id);}
   for(let index=0;index<g.pending!.choices.length;index++){
    const before=structuredClone(g);if(rerollAugment(g,index)){const next=g.pending!.choices[index].id;expect(seen.has(next)).toBe(false);seen.add(next);expect(rerollAugment(g,index)).toBe(false);}else expect(g).toEqual(before);
    expect(new Set(g.pending!.choices.map(c=>c.id)).size).toBe(g.pending!.choices.length);
   }
   expect(tick(JSON.parse(JSON.stringify(g)))).toEqual(tick(g));chooseAugment(g,g.pending!.choices[0].id);
  }expect(g.blue[0].augments).toHaveLength(4);
 });
});
describe('death-gated preparation and continuous simulation',()=>{
 it('migrates an old level-up offer without granting an unearned augment',()=>{
  const g=match();delete g.preparationRules;g.blue[0].level=11;g.phase='augment';g.pending={title:'old',description:'old level-up',choices:[]};
  upgradeBattleSave(g);expect(g.phase).toBe('playing');expect(g.pending).toBeUndefined();expect(g.blue[0].augmentClaims).toBe(1);expect(g.blue[0].augments).toHaveLength(1);
 });
 it('unlocks augments on death and freezes the battle until selection finishes',()=>{
  let g=match();const u=g.blue[0];u.level=7;u.atFountain=false;u.position=40;
  for(const v of g.red)v.atFountain=true;
  g=tick(g);expect(g.phase).toBe('playing');expect(g.blue[0].augments).toHaveLength(1);
  applyDamage(g,undefined,g.blue[0],99999,'test','true');g=tick(g);expect(g.phase).toBe('augment');expect(g.pending!.choices.every(c=>augments.find(a=>a.id===c.id)?.tier===g.augmentTiers![1])).toBe(true);
  const snapshot=structuredClone(g);for(let i=0;i<30;i++)g=tick(g);expect(g).toEqual(snapshot);expect(g.blue[0].alive).toBe(false);
  chooseAugment(g,g.pending!.choices[0].id);expect(g.phase).toBe('playing');expect(g.blue[0].augments).toHaveLength(2);
  g.time=g.blue[0].respawnAt;g=tick(g);expect(g.blue[0].alive).toBe(true);expect(g.respawnPrompt).toBe(true);expect(g.blue[0].atFountain).toBe(true);
 });
 it('only grants AI later augments after their own death',()=>{
  let g=match();const u=g.red[1];u.level=11;g=tick(g);expect(g.red[1].augments).toHaveLength(1);g.red[1].portal=undefined;applyDamage(g,undefined,g.red[1],99999,'test','true');g=tick(g);expect(g.red[1].augments).toHaveLength(3);expect(g.blue[0].augments).toHaveLength(1);
 });
 it('offers every respawn and keeps running outside the shop without auto-departure',()=>{
  let g=match();for(let death=0;death<2;death++){
   applyDamage(g,undefined,g.blue[0],99999,'test','true');expect(canShop(g,g.blue[0])).toBe(true);expect(buyItem(g,'1036')).toBe(true);
   g.time=g.blue[0].respawnAt;respawn(g);expect(g.respawnPrompt).toBe(true);expect(g.blue[0].shopUnlocked).toBe(true);
   const before=g.time;g=tick(g);expect(g.time).toBe(before+1);expect(g.blue[0].atFountain).toBe(true);g.time+=100;advancePortals(g);expect(g.blue[0].portal).toBeUndefined();
   expect(death?usePortal(g):walkFromBase(g)).toBe(true);expect(g.respawnPrompt).toBe(false);expect(canShop(g,g.blue[0])).toBe(false);g.blue[0].portal=undefined;
  }
 });
 it('returning alive grants neither fountain healing, purchases, potions nor augments',()=>{
  const g=match(),u=g.blue[0];u.champion=playableChampions.find(c=>c.id==='Ashe')!;u.items=[];u.combat=undefined;refreshStats(u,true);u.atFountain=false;u.position=spawnPosition('blue')+1;u.health=200;state(u).mana=0;state(u).counters.potionCharges=0;
  expect(returnToBase(g)).toBe(true);advanceBases(g);const hp=u.health;advanceCombat(g);
  expect(u.atFountain).toBe(true);expect(u.health-hp).toBe(Math.round(statsFor(u).hpRegen));expect(state(u).mana).toBeLessThan(statsFor(u).mana);expect(state(u).counters.potionCharges).toBe(0);expect(canShop(g,u)).toBe(false);expect(u.augments).toHaveLength(1);
 });
 it('skips tactical choices when dead, at base, travelling, crowd controlled or too far away',()=>{
  for(const condition of ['dead','base','portal','returning','stunned','distant']){const g=match(),u=g.blue[0];u.atFountain=false;u.position=45;g.red.forEach(v=>{v.atFountain=false;v.position=55});
   if(condition==='dead')u.alive=false;if(condition==='base')u.atFountain=true;if(condition==='portal')u.portal={from:0,to:40,startedAt:30,arriveAt:32};if(condition==='returning')u.returningToBase=true;if(condition==='stunned')addEffect(u,{kind:'stun',value:1,until:35});if(condition==='distant')u.position=5;
   openDecision(g,'standoff');expect(g.phase,condition).toBe('playing');expect(g.pending,condition).toBeUndefined();
  }
 });
});
describe('rendered information',()=>{
 it('renders four respawn choices, tower health and legal item upgrade links',()=>{
  const g=match();g.respawnPrompt=true;const update=()=>{};const prompt=renderToStaticMarkup(<RespawnPrompt game={g} update={update}/>);expect(prompt).toContain('<dialog');expect(prompt).toContain('전장 보기');for(const choice of ['포탈로 복귀','걸어서 복귀'])expect(prompt).toContain(choice);expect(prompt).not.toContain('아이템 구매 후');expect((prompt.match(/<div class="respawn-options">([\s\S]*?)<\/div>/)?.[1].match(/<button/g)??[])).toHaveLength(2);
  const towers=renderToStaticMarkup(<WorldStatus game={g}/>);expect(towers.match(/<progress/g)?.length).toBe(g.world!.buildings.length);expect(towers).toContain('아군');
  const shop=renderToStaticMarkup(<Shop game={g} update={update}/>);expect(shop).toContain('상위 아이템');for(const i of shopItems.filter(i=>i.from?.includes('1036')))expect(shop).toContain(i.name);
 });
 it('renders icons, champion-specific grades, and refresh controls without inventing missing grades',()=>{
  const g=createGame(1);offerAugments(g);const html=renderToStaticMarkup(<DecisionWindow game={g} open={false} update={()=>{}} onSettings={()=>{}} onMinimize={()=>{}}/>);expect(html).toContain('/assets/augments/');expect(html.match(/번 증강 새로고침/g)).toHaveLength(3);expect(html).toContain('OP.GG');expect(augmentGrade('Evelynn','극악무도').grade).toBe('S');expect(augmentGrade('Evelynn','가짜 증강').grade).toBeUndefined();
 });
});
