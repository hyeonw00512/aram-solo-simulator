import {it,expect} from 'vitest';
import {createGame,offerAugments,chooseAugment,rerollAugment,tick} from '../src/engine/game';
import {applyDamage} from '../src/engine/combat';
import {augments} from '../src/engine/data';
import {augmentLevels,augmentTierSchedule} from '../src/engine/augment-offers';
import {upgradeBattleSave} from '../src/storage';
import type {Tier} from '../src/engine/types';
const tiers:Tier[]=['silver','gold','prism'];
it('allows every four-round tier sequence, including four prism, four gold and descending tiers',()=>{
 const schedules=new Set<string>();for(let seed=0;seed<1500;seed++){const g=createGame(seed);expect(g.augmentTiers).toHaveLength(4);schedules.add(g.augmentTiers!.join(','));expect(createGame(seed).augmentTiers).toEqual(g.augmentTiers);}
 expect(schedules.size).toBe(81);expect(schedules.has('prism,prism,prism,prism')).toBe(true);expect(schedules.has('gold,gold,gold,gold')).toBe(true);expect(schedules.has('prism,prism,gold,silver')).toBe(true);
});
it('supports all 81 schedules with three independent rerolls every round and matching AI tiers',()=>{
 for(const a of tiers)for(const b of tiers)for(const c of tiers)for(const d of tiers){
  const g=createGame(17);g.augmentTiers=[a,b,c,d];const seen=new Set<string>();
  for(let round=0;round<4;round++){
   if(round){g.time=100;g.phase='playing';for(const u of [...g.blue,...g.red])u.augmentClaims=round+1;}
   offerAugments(g);expect(g.pending!.choices).toHaveLength(3);
   for(const card of g.pending!.choices){expect(seen.has(card.id)).toBe(false);seen.add(card.id);expect(augments.find(a=>a.id===card.id)!.tier).toBe(g.augmentTiers[round]);}
   for(let index=0;index<3;index++){expect(rerollAugment(g,index)).toBe(true);const card=g.pending!.choices[index];expect(seen.has(card.id)).toBe(false);seen.add(card.id);expect(augments.find(a=>a.id===card.id)!.tier).toBe(g.augmentTiers[round]);expect(rerollAugment(g,index)).toBe(false);}
   chooseAugment(g,g.pending!.choices[0].id);for(const u of [...g.blue,...g.red])expect(u.augments.map(a=>a.tier)).toEqual(g.augmentTiers.slice(0,round+1));
  }
  expect(seen.size).toBe(24);g.blue[0].augmentClaims=99;offerAugments(g);expect(g.pending).toBeUndefined();expect(g.blue[0].augments).toHaveLength(4);
 }
});
it('uses levels 1/7/11/15 and unlocks later rounds on death rather than level-up alone',()=>{
 expect(augmentLevels).toEqual([1,7,11,15]);
 for(const [level,claims] of [[6,1],[7,2],[10,2],[11,3],[14,3],[15,4],[18,4]]){
  let g=createGame(5);offerAugments(g);chooseAugment(g,g.pending!.choices[0].id);g.phase='playing';g.time=100;g.nextDecision=99999;g.blue[0].level=level;
  g=tick(g);expect(g.blue[0].augmentClaims).toBe(1);expect(g.blue[0].augments).toHaveLength(1);
  applyDamage(g,undefined,g.blue[0],999999,'test','true');expect(g.blue[0].augmentClaims).toBe(claims);
 }
});
it('keeps current and future tiers stable across rerolls, time changes and saved games',()=>{
 const g=createGame(50),schedule=[...g.augmentTiers!];offerAugments(g);rerollAugment(g,0);const copy=upgradeBattleSave(JSON.parse(JSON.stringify(g)));expect(copy.augmentTiers).toEqual(schedule);expect(copy.pending).toEqual(g.pending);expect(copy.augmentRerolls).toEqual([true,false,false]);
 copy.time=900;expect(augmentTierSchedule(copy)).toEqual(schedule);const next=structuredClone(g);rerollAugment(copy,1);rerollAugment(next,1);expect(copy.pending).toEqual(next.pending);
});
it('migrates old fixed-tier games without changing past rewards or cancelling the fourth choice',()=>{
 const g=createGame(5);g.augmentTiers=['silver','gold','prism','prism'];for(let round=0;round<3;round++){if(round){g.time=100;g.phase='playing';g.blue[0].augmentClaims=round+1;}offerAugments(g);chooseAugment(g,g.pending!.choices[0].id);}
 g.blue[0].augmentClaims=4;offerAugments(g);const cards=structuredClone(g.pending),owned=structuredClone(g.blue[0].augments);delete g.augmentTiers;
 upgradeBattleSave(g);expect(g.augmentTiers).toEqual(['silver','gold','prism','prism']);expect(g.pending).toEqual(cards);expect(g.blue[0].augments).toEqual(owned);chooseAugment(g,g.pending!.choices[0].id);expect(g.blue[0].augments).toHaveLength(4);expect(g.phase).toBe('playing');
});
it('preserves death-earned claims on reload instead of granting more from the current level',()=>{
 const dead=createGame(3);dead.phase='playing';dead.time=100;dead.blue[0].level=15;dead.blue[0].alive=false;dead.blue[0].augmentClaims=3;upgradeBattleSave(dead);expect(dead.blue[0].augmentClaims).toBe(3);
 const live=createGame(3);live.phase='playing';live.time=100;live.blue[0].level=15;live.blue[0].augmentClaims=3;upgradeBattleSave(live);expect(live.blue[0].augmentClaims).toBe(3);
});
it('requires another death when a level threshold is crossed during respawn waiting',()=>{
 let g=createGame(11);offerAugments(g);chooseAugment(g,g.pending!.choices[0].id);g.phase='playing';g.time=100;g.nextDecision=99999;g.blue[0].atFountain=false;g.blue[0].level=6;
 applyDamage(g,undefined,g.blue[0],999999,'test','true');expect(g.blue[0].augmentClaims).toBe(1);
 g.blue[0].level=7;g=upgradeBattleSave(JSON.parse(JSON.stringify(g)));g=tick(g);expect(g.blue[0].augmentClaims).toBe(1);expect(g.phase).toBe('playing');expect(g.pending).toBeUndefined();
 g.time=g.blue[0].respawnAt;g=tick(g);expect(g.blue[0].alive).toBe(true);expect(g.blue[0].augmentClaims).toBe(1);
 applyDamage(g,undefined,g.blue[0],999999,'test','true');g=tick(g);expect(g.blue[0].augmentClaims).toBe(2);expect(g.phase).toBe('augment');
});
