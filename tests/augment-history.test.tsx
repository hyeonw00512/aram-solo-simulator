import {describe,it,expect} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {createGame,offerAugments,rerollAugment,chooseAugment} from '../src/engine/game';
import {augments} from '../src/engine/data';
import {augmentRerollReason,seenAugmentIds} from '../src/engine/augment-offers';
import {upgradeBattleSave} from '../src/storage';
import {DecisionWindow} from '../src/ui/DecisionWindow';

describe('match-long augment offer history',()=>{
 it('never recycles an unchosen or rerolled card and always permits four selections',()=>{
  for(let seed=0;seed<50;seed++){
   const g=createGame(seed),seen=new Set<string>();let rerolls=0;
   for(let round=0;round<4;round++){
    if(round){g.time=100+round;g.phase='playing';g.blue[0].augmentClaims=round+1;}
    offerAugments(g);expect(g.phase).toBe('augment');expect(g.pending!.choices).toHaveLength(3);
    for(const c of g.pending!.choices){expect(seen.has(c.id)).toBe(false);seen.add(c.id);}
    // Vary the rerolled position so removing any of the three cards is covered.
    for(let offset=0;offset<g.pending!.choices.length;offset++){
     const index=(seed+offset)%g.pending!.choices.length;
     const before=g.pending!.choices.map(c=>c.id);expect(augmentRerollReason(g,index)).toBeUndefined();expect(rerollAugment(g,index)).toBe(true);rerolls++;
     const id=g.pending!.choices[index].id;expect(seen.has(id)).toBe(false);seen.add(id);
     for(let other=0;other<3;other++)if(other!==index)expect(g.pending!.choices[other].id).toBe(before[other]);
     expect(rerollAugment(g,index)).toBe(false);
    }
    expect(new Set(g.seenAugments)).toEqual(seen);chooseAugment(g,g.pending!.choices[seed%g.pending!.choices.length].id);
   }
   expect(rerolls).toBe(12);expect(g.blue[0].augments).toHaveLength(4);expect(g.pending).toBeUndefined();
  }
 });
 it('retains dismissed cards across saving and loading without changing the deterministic replacement',()=>{
  const g=createGame(12);offerAugments(g);const before=g.pending!.choices.map(c=>c.id);expect(rerollAugment(g,0)).toBe(true);
  const copy=upgradeBattleSave(JSON.parse(JSON.stringify(g)));expect(copy.seenAugments).toEqual(g.seenAugments);before.forEach(id=>expect(seenAugmentIds(copy).has(id)).toBe(true));
  expect(rerollAugment(copy,1)).toBe(rerollAugment(g,1));expect(copy.pending).toEqual(g.pending);expect(copy.seenAugments).toEqual(g.seenAugments);
 });
 it('backfills only known cards in legacy saves and does not treat tactical choices as augments',()=>{
  const g=createGame(10);offerAugments(g);const initial=g.pending!.choices.map(c=>c.id);delete g.seenAugments;
  upgradeBattleSave(g);expect(new Set(g.seenAugments)).toEqual(new Set(initial));chooseAugment(g,initial[0]);
  delete g.seenAugments;g.phase='decision';g.pending={title:'test',description:'test',choices:[{id:'engage',label:'교전',bonus:0}]};upgradeBattleSave(g);
  expect(g.seenAugments).toEqual([initial[0]]);expect(g.seenAugments).not.toContain('engage');
 });
 it('disables unavailable rerolls visibly, preserves current choices, and spends no reroll on failure',()=>{
  const g=createGame(1);offerAugments(g);expect(rerollAugment(g,0)).toBe(true);
  // Deliberately exhausted/legacy state, not the ordinary first reroll.
  g.seenAugments=augments.filter(a=>a.tier===g.augmentTiers![0]).map(a=>a.id);
  const before=structuredClone(g);expect(augmentRerollReason(g,1)).toBe('새 증강 없음');expect(rerollAugment(g,1)).toBe(false);expect(g).toEqual(before);
  const html=renderToStaticMarkup(<DecisionWindow game={g} open={false} update={()=>{}} onSettings={()=>{}} onMinimize={()=>{}}/>);
  expect(html).toContain('한 번 제시된 증강');expect(html).toContain('새 증강 없음');expect(html.match(/class="reroll" disabled/g)).toHaveLength(3);
  expect(g.pending!.choices).toHaveLength(3);
 });
 it('keeps the other two reroll buttons enabled after replacing one card, including a saved old offer',()=>{
  const g=createGame(1);offerAugments(g);expect(rerollAugment(g,0)).toBe(true);
  const copy=upgradeBattleSave(JSON.parse(JSON.stringify(g)));
  expect(copy.augmentRerolls).toEqual([true,false,false]);
  expect(augmentRerollReason(copy,1)).toBeUndefined();expect(augmentRerollReason(copy,2)).toBeUndefined();
  const html=renderToStaticMarkup(<DecisionWindow game={copy} open={false} update={()=>{}} onSettings={()=>{}} onMinimize={()=>{}}/>);
  expect(html.match(/class="reroll" disabled/g)).toHaveLength(1);
  expect(html.match(/↻ 새로고침 · 1회/g)).toHaveLength(2);
 });
 it('resets history for a new match and does not exclude AI-owned augments',()=>{
  const g=createGame(5);g.red[0].augments=augments.filter(a=>a.tier==='silver');offerAugments(g);expect(g.pending!.choices).toHaveLength(3);
  const fresh=createGame(5);expect(seenAugmentIds(fresh).size).toBe(0);offerAugments(fresh);expect(fresh.pending).toEqual(g.pending);
 });
 it('reopening an offer does not change cards or replenish rerolls',()=>{
  const g=createGame(1);offerAugments(g);rerollAugment(g,0);const saved=structuredClone(g);offerAugments(g);expect(g).toEqual(saved);
 });
});
