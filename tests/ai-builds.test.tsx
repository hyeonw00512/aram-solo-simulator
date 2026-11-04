import {describe,it,expect} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {createGame} from '../src/engine/game';
import {buildStyleFor,buildSource,ensureAiBuild} from '../src/engine/ai-builds';
import {aiShopping} from '../src/engine/shop';
import {routeFor,buildRoutes} from '../src/engine/build-advisor';
import {playableChampions,augments} from '../src/engine/data';
import {shopItems,itemMap} from '../src/engine/items';
import {unavailableItems} from '../src/engine/item-effects';
import {AiBuildDetails} from '../src/ui/AiBuildDetails';
import {applyAugment} from '../src/engine/augments';
import {upgradeBattleSave} from '../src/storage';

describe('persistent human-like item builds',()=>{
 it('collects five real core rows and boots for every supported champion',()=>{
  for(const c of playableChampions){const s=buildSource(c.id);expect(s,c.id).toBeDefined();expect(s.cores,c.id).toHaveLength(5);expect(s.cores.every(row=>row.length>=3),c.id).toBe(true);expect(s.boots.length).toBeGreaterThan(0);expect(s.url).toContain('/aram-mayhem/');}
  expect(buildSource('Janna').cores[0]).toContain('6617');expect(buildSource('Ashe').cores[0]).toContain('3031');
 });
 it('mostly follows common builds, sometimes adapts, and only rarely goes far off',()=>{
  const g=createGame(1),u=g.blue[1],counts={standard:0,adaptive:0,offbeat:0};
  for(let seed=0;seed<10000;seed++)counts[buildStyleFor(seed,u)]++;
  expect(counts.standard).toBeGreaterThan(7900);expect(counts.standard).toBeLessThan(8500);expect(counts.adaptive).toBeGreaterThan(1300);expect(counts.adaptive).toBeLessThan(1900);expect(counts.offbeat).toBeGreaterThan(120);expect(counts.offbeat).toBeLessThan(300);
  const same=Array.from({length:100},(_,seed)=>buildStyleFor(seed,g.blue[1])===buildStyleFor(seed,g.red[1])).filter(Boolean).length;
  expect(same).toBeLessThan(90);
 });
 it('standard and adaptive builds retain the observed core; rare offbeat builds change role coherently',()=>{
  const g=createGame(9),u=g.blue[1];u.champion=playableChampions.find(c=>c.id==='Lux')!;
  const seen=new Set<string>();for(let seed=1;seed<400&&seen.size<3;seed++){
   g.seed=seed;u.aiBuild=undefined;u.combat=undefined;const p=ensureAiBuild(g,u);seen.add(p.style);
   expect(p.route).toHaveLength(6);
   if(p.style==='offbeat'){expect(p.path).not.toBe('ap');expect(p.core.every(id=>buildRoutes[p.path].includes(id))).toBe(true);}
   else {expect(buildSource('Lux').cores.some(row=>p.core.every(id=>row.includes(id)))).toBe(true);expect(p.core.every(id=>p.route.includes(id))).toBe(true);}
  }expect(seen.size).toBe(3);
 });
 it('retains personality and purchases across death, time, and save/load',()=>{
  const g=createGame(8),u=g.blue[1];g.phase='playing';u.gold=600;aiShopping(g,u);const p=structuredClone(u.aiBuild!);const items=[...u.items];g.time+=100;u.deaths++;u.gold=30000;expect(ensureAiBuild(g,u)).toEqual(p);expect(u.items).toEqual(items);
  const loaded=upgradeBattleSave(JSON.parse(JSON.stringify(g)));expect(ensureAiBuild(loaded,loaded.blue[1])).toEqual(p);aiShopping(loaded,loaded.blue[1]);expect(loaded.blue[1].items).toEqual(p.route);
 });
 it('produces legal six-item builds and actually buys them for all champions and personalities',()=>{
  for(const c of playableChampions){const tested=new Set<string>();for(let seed=1;seed<400&&tested.size<3;seed++){
   const g=createGame(seed),u=g.blue[1];u.champion=c;u.combat=undefined;u.aiBuild=undefined;const style=buildStyleFor(seed,u);if(tested.has(style))continue;tested.add(style);g.phase='playing';u.gold=100000;
   const p=ensureAiBuild(g,u);expect(p.route,c.id+' '+style).toHaveLength(6);expect(new Set(p.route).size).toBe(6);expect(p.route.filter(id=>itemMap[id].tags.includes('Boots'))).toHaveLength(1);
   for(const id of p.route){expect(shopItems.some(i=>i.id===id)).toBe(true);expect(unavailableItems[id]).toBeUndefined();}
   aiShopping(g,u);expect(u.items,c.id+' '+style).toEqual(routeFor(u,g.seed));
  }expect(tested.size,c.id).toBe(3);}
 });
 it('honors accepted antiheal requests and preserves existing completed items',()=>{
  const g=createGame(34),u=g.blue[1];u.champion=playableChampions.find(c=>c.id==='Lux')!;u.items=['3157'];u.gold=100000;g.phase='playing';u.shopRequest={orderId:1,itemId:'3916',status:'pending',reason:'치감 요청'};
  aiShopping(g,u);expect(u.items).toContain('3157');expect(u.items).toContain('3165');expect(u.shopRequest.status).toBe('fulfilled');expect(u.lastBuildReason).toContain('치감 요청 반영');expect(u.items.length).toBeLessThanOrEqual(6);
 });
 it('makes an augment-forced AD conversion without rerolling personality',()=>{
  const g=createGame(12),u=g.blue[1];u.champion=playableChampions.find(c=>c.id==='Lux')!;const before=ensureAiBuild(g,u);applyAugment(g,u,augments.find(a=>a.name==='마법사 (물리)')!);const after=ensureAiBuild(g,u);expect(after.path).toBe('ad');expect(after.style).toBe(before.style);expect(after.reason).toContain('증강');
 });
 it('shows the plan and source in the champion details',()=>{
  const g=createGame(14),u=g.blue[1];ensureAiBuild(g,u);const html=renderToStaticMarkup(<AiBuildDetails unit={u}/>);expect(html).toContain('구매 성향');expect(html).toContain('OP.GG');expect(html).toContain('/assets/items/');expect(html).toContain(u.aiBuild!.source);
 });
});
