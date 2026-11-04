import {it,expect} from 'vitest';
import {createGame,tick} from '../src/engine/game';
import {playableChampions} from '../src/engine/data';
import {refreshStats,statsFor} from '../src/engine/stats';
import {state,effect} from '../src/engine/runtime';
import {currentResource,resourceKind,skillCost} from '../src/engine/resources';
import {castAbility,advanceCombat,applyDamage} from '../src/engine/combat-v4';
import {respawn} from '../src/engine/combat';
import {advanceWorld,ensureWorld} from '../src/engine/world';
import {kitFor} from '../src/engine/kits';
import {Rng} from '../src/engine/rng';
function setup(id:string){const g=createGame(17);g.phase='playing';g.time=100;g.nextDecision=9999;g.nextAugmentLevel=99;for(const t of [...g.blue,...g.red]){t.atFountain=false;t.position=t.team==='blue'?44:54;}const u=g.blue[0];u.champion=playableChampions.find(c=>c.id===id)!;u.level=10;u.skillRanks={Q:1,W:1,E:1,R:1};u.items=[];u.combat=undefined;refreshStats(u,true);state(u);return {g,u,v:g.red[0]};}
it('spends champion mana and uses champion-specific regeneration and item growth',()=>{
 const {g,u,v}=setup('Ahri'),s=statsFor(u),cost=skillCost(u,kitFor(u)[0]),before=currentResource(u,s.resourceMax);expect(resourceKind(u)).toBe('mana');expect(castAbility(g,u,v,'Q',new Rng(7))).toBe(true);expect(state(u).mana).toBeCloseTo(before-cost);state(u).mana=0;g.time++;advanceCombat(g);expect(state(u).mana).toBeCloseTo(s.manaRegen);u.items=['1027'];expect(statsFor(u).mana).toBeGreaterThan(s.mana);
});
it('uses a separate 200 energy pool unaffected by mana or mana regeneration items',()=>{
 const {g,u,v}=setup('Kennen');expect(resourceKind(u)).toBe('energy');expect(statsFor(u).mana).toBe(0);expect(statsFor(u).energy).toBe(200);expect(state(u).energy).toBe(200);expect(castAbility(g,u,v,'Q',new Rng(7))).toBe(true);expect(state(u).energy).toBe(140);expect(state(u).mana).toBe(0);
 u.items=['1027','1004'];const s=statsFor(u);expect(s.energy).toBe(200);expect(s.mana).toBe(0);expect(s.energyRegen).toBe(10);g.time++;advanceCombat(g);expect(state(u).energy).toBe(150);
});
it('blocks energy spells when empty but permits a no-cost ultimate; refills on respawn',()=>{
 const {g,u,v}=setup('Kennen');state(u).energy=0;state(u).mana=10000;expect(castAbility(g,u,v,'Q',new Rng(7))).toBe(false);expect(state(u).ready.Q).toBeUndefined();expect(castAbility(g,u,v,'R',new Rng(7))).toBe(true);expect(state(u).energy).toBe(0);u.alive=false;u.health=0;u.respawnAt=g.time;respawn(g);expect(state(u).energy).toBe(200);expect(state(u).mana).toBe(0);
});
it('stuns on three Kennen marks and restores energy only after successful hits',()=>{
 const {g,u,v}=setup('Kennen');state(u).energy=200;state(v).counters['kennen:'+u.id]=2;state(v).procs['kennen:'+u.id]=g.time+6;state(v).effects.push({kind:'root',value:1,until:g.time+5});castAbility(g,u,v,'Q',new Rng(7));expect(effect(v,'stun')).toBeGreaterThan(0);expect(state(u).energy).toBe(165);
});
it('spends energy when clearing minions as well as when fighting champions',()=>{
 const {g,u}=setup('Kennen');for(const t of g.red)t.atFountain=true;const w=ensureWorld(g);w.nextWave=99999;w.minions=[{id:'wave',team:'red',kind:'melee',position:46,health:900,maxHealth:900,damage:0,range:2,nextAttack:99999}];u.order={id:1,kind:'clear',until:200,reason:'test'};state(u).energy=200;advanceWorld(g);expect(state(u).energy).toBe(160);expect(state(u).mana).toBe(0);
});
it('shows Yasuo flow instead of mana, charges through movement and consumes it on a champion hit',()=>{
 const {g,u,v}=setup('Yasuo');u.items=['1027'];expect(statsFor(u).mana).toBe(0);expect(resourceKind(u)).toBe('flow');state(u).counters.lastPosition=u.position-25;advanceCombat(g);expect(state(u).flow).toBe(100);expect(castAbility(g,u,v,'Q',new Rng(7))).toBe(true);expect(state(u).flow).toBe(100);applyDamage(g,v,u,1,'test');expect(state(u).flow).toBe(0);expect(effect(u,'shield')).toBeGreaterThan(0);
});
it('preserves resource values across save/load and freezes them during a pending choice',()=>{
 const {g,u}=setup('Kennen');state(u).energy=57;const restored=JSON.parse(JSON.stringify(g));expect(tick(g)).toEqual(tick(restored));g.phase='decision';expect(tick(g)).toBe(g);expect(state(u).energy).toBe(57);
});
