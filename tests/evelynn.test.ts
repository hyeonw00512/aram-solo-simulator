import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {createGame} from '../src/engine/game';
import {playableChampions} from '../src/engine/data';
import {refreshStats,statsFor} from '../src/engine/stats';
import {state,effect,blocked} from '../src/engine/runtime';
import {castAbility,advanceCombat,applyDamage,resolveAttack} from '../src/engine/combat';
import {demonShade,camouflaged,eveDamage,eveHealThreshold} from '../src/engine/evelynn';
import {kitFor} from '../src/engine/kits';
import {Rng} from '../src/engine/rng';
import {resourceKind} from '../src/engine/resources';

function fight(){const g=createGame(12);g.phase='playing';g.time=50;g.world!.buildings=[];const u=g.blue[0],v=g.red[0];u.champion=playableChampions.find(c=>c.id==='Evelynn')!;u.level=6;u.skillRanks={Q:3,W:1,E:1,R:1};u.combat=undefined;refreshStats(u,true);for(const t of [...g.blue,...g.red]){t.atFountain=true;t.position=t.team==='blue'?0:100;}u.atFountain=v.atFountain=false;u.position=50;v.position=54;v.items=[];v.combat=undefined;refreshStats(v,true);return {g,u,v};}
// Deterministically avoid evasion so tests isolate the ability rules.
const hit=()=>({chance:()=>false,next:()=>.5,int:()=>0} as unknown as Rng);
describe('Evelynn source stats and skill identity',()=>{
 it('has the Riot stats, mana, portrait, growth, and skill ranks',()=>{const {u}=fight();expect(u.champion.stats.hp).toBe(642);expect(u.champion.stats.armor).toBe(37);expect(u.champion.stats.attackdamageperlevel).toBe(3);expect(resourceKind(u)).toBe('mana');expect(kitFor(u).map(a=>a.cd)).toEqual([4,15,8,120]);expect([...readFileSync('public/assets/champions/Evelynn.png').subarray(0,4)]).toEqual([137,80,78,71]);});
 it('regenerates only to the Demon Shade threshold, with camouflage beginning at level 6',()=>{const {g,u,v}=fight();v.atFountain=true;u.health=100;advanceCombat(g);expect(demonShade(u,g.time)).toBe(true);expect(u.health).toBeGreaterThan(100);expect(u.health).toBeLessThan(eveHealThreshold(u));expect(state(u).counters.empoweredE).toBe(1);expect(camouflaged(g,u)).toBe(true);u.level=5;expect(camouflaged(g,u)).toBe(false);u.level=6;v.atFountain=false;v.position=60;expect(camouflaged(g,u)).toBe(false);});
 it('W preserves camouflage and mature marks charm, refund mana, and shred MR before damage',()=>{const {g,u,v}=fight();v.position=85;expect(camouflaged(g,u)).toBe(true);const mana=state(u).mana;expect(castAbility(g,u,v,'W',hit())).toBe(true);expect(state(u).mana).toBe(mana-60);expect(camouflaged(g,u)).toBe(true);const hp=v.health;resolveAttack(g,u,v,hit());expect(v.health).toBe(hp);g.time+=3;v.position=54;const mr=statsFor(v).mr;castAbility(g,u,v,'Q',hit());expect(blocked(v)).toBe(true);expect(effect(v,'charm')).toBe(1);expect(statsFor(v).mr).toBeCloseTo(mr*.65);expect(state(u).mana).toBe(mana-50);expect(camouflaged(g,u)).toBe(false);});
 it('an early W detonation only slows rather than charms',()=>{const {g,u,v}=fight();castAbility(g,u,v,'W',hit());g.time++;castAbility(g,u,v,'Q',hit());expect(effect(v,'slow')).toBe(.45);expect(effect(v,'charm')).toBe(0);expect(effect(v,'magic-shred')).toBe(0);});
 it('Q allows three free recasts, with a three-hit mark and one cooldown after the sequence',()=>{const {g,u,v}=fight();v.health=v.maxHealth=10000;const mana=state(u).mana;expect(castAbility(g,u,v,'Q',hit())).toBe(true);expect(state(v).counters['eve-q:'+u.id]).toBe(3);for(let i=0;i<3;i++){g.time++;expect(castAbility(g,u,v,'Q',hit())).toBe(true);}expect(state(u).mana).toBe(mana-50);expect(state(u).counters.qRecasts).toBe(0);expect(state(v).counters['eve-q:'+u.id]).toBe(0);g.time++;expect(castAbility(g,u,v,'Q',hit())).toBe(false);});
 it('empowered E scales with target maximum HP and AP, closes the gap and grants movement speed',()=>{const {g,u,v}=fight();u.items=['3089'];refreshStats(u,true);state(u).counters.empoweredE=1;v.position=60;const damage=eveDamage(u,v,'E',true);expect(damage).toBeGreaterThan(eveDamage(u,v,'E'));const hp=v.health;expect(castAbility(g,u,v,'E',hit())).toBe(true);expect(u.position).toBe(v.position-2);expect(hp-v.health).toBeGreaterThan(0);expect(effect(u,'speed')).toBeCloseTo(.3);expect(state(u).counters.empoweredE).toBe(0);});
 it('R deals 2.4x below 30%, retreats and is briefly untargetable',()=>{const {g,u,v}=fight();v.health=v.maxHealth*.5;const normal=eveDamage(u,v,'R');v.health=v.maxHealth*.29;expect(eveDamage(u,v,'R')).toBeCloseTo(normal*2.4);const position=u.position;expect(castAbility(g,u,v,'R',hit())).toBe(true);expect(u.position).toBe(position-28);const hp=u.health;applyDamage(g,v,u,999,'counter');expect(u.health).toBe(hp);g.time++;applyDamage(g,v,u,10,'counter');expect(u.health).toBeLessThan(hp);});
 it('cannot directly target an undetected camouflaged Evelynn',()=>{const {g,u,v}=fight();v.position=90;expect(camouflaged(g,u)).toBe(true);const hp=u.health;expect(resolveAttack(g,v,u,hit())).toBe(false);expect(u.health).toBe(hp);});
 it('Q recasts hit nearby enemies and E triggers the Lich Bane on-hit effect',()=>{
  const {g,u,v}=fight(),other=g.red[1];other.atFountain=false;other.position=v.position+2;const hp=other.health;castAbility(g,u,v,'Q',hit());expect(other.health).toBe(hp);g.time++;castAbility(g,u,v,'Q',hit());expect(other.health).toBeLessThan(hp);
  u.items=['3100'];state(u).mana=1000;castAbility(g,u,v,'E',hit());expect(state(u).procs.spellblade).toBe(-1);
 });
 it('R hits in front, not a champion behind the caster',()=>{
  const {g,u,v}=fight(),behind=g.red[1];behind.atFountain=false;behind.position=u.position-3;const hp=behind.health;castAbility(g,u,v,'R',hit());expect(behind.health).toBe(hp);expect(v.health).toBeLessThan(v.maxHealth);
 });
});
