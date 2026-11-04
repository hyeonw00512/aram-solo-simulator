import {describe,it,expect} from 'vitest';
import {createGame,depart,tick} from '../src/engine/game';
import {usePortal,portalDestination,walkFromBase,advancePortals} from '../src/engine/portal';
import {applyDamage,resolveAttack,respawn} from '../src/engine/combat';
import {openDecision} from '../src/engine/encounter';
import {Rng} from '../src/engine/rng';
import {spawnPosition} from '../src/engine/map-layout';
import config from '../data/portal.json';
describe('base portals',()=>{
 it('sends both teams from base to their own turret and serializes mid-transit',()=>{
  let g=createGame(14);g.phase='shop';depart(g);
  expect([...g.blue,...g.red].every(u=>!!u.portal&&!u.atFountain)).toBe(true);
  g=tick(g);expect(g.blue[0].position).toBeGreaterThan(8);expect(g.blue[0].position).toBeLessThan(portalDestination('blue'));
  expect(tick(JSON.parse(JSON.stringify(g)))).toEqual(tick(g));g.time++;advancePortals(g);
  for(const u of [...g.blue,...g.red]){expect(u.portal).toBeUndefined();expect(Math.abs(u.position-portalDestination(u.team))).toBeLessThan(2)}
 });
 it('departs correctly from older preparation saves with lane positions',()=>{
  const g=createGame(3);g.phase='shop';for(const u of [...g.blue,...g.red]){u.position=45;delete u.fountainSince}
  depart(g);expect([...g.blue,...g.red].every(u=>!!u.portal)).toBe(true);expect(g.blue[0].portal!.from).toBe(spawnPosition('blue'));
 });
 it('rejects remote, dead, unavailable-phase and cooldown use without mutating state',()=>{
  const g=createGame(3),u=g.blue[0];expect(usePortal(g)).toBe(false);g.phase='playing';
  u.position=40;const before=structuredClone(g);expect(usePortal(g)).toBe(false);expect(g).toEqual(before);
  u.position=8;u.alive=false;expect(usePortal(g)).toBe(false);u.alive=true;u.portalReadyAt=15;expect(usePortal(g)).toBe(false);
  g.time=15;expect(usePortal(g)).toBe(true);expect(usePortal(g)).toBe(false);
 });
 it('prevents attacks, damage and decisions while travelling',()=>{
  const g=createGame(4);g.phase='playing';const u=g.blue[0],v=g.red[0];usePortal(g);
  const hp=u.health,enemyHp=v.health;expect(resolveAttack(g,u,v,new Rng(1))).toBe(false);expect(resolveAttack(g,v,u,new Rng(1))).toBe(false);applyDamage(g,v,u,99999,'test');
  expect(u.health).toBe(hp);expect(v.health).toBe(enemyHp);openDecision(g,'standoff');expect(g.pending).toBeUndefined();
 });
 it('allows buying after respawn, sends AI immediately, and waits indefinitely for the player to choose a return route',()=>{
  const g=createGame(7);g.phase='playing';g.time=40;
  for(const u of [...g.blue,...g.red]){u.atFountain=false;u.position=50}
  for(const u of [g.blue[0],g.red[0]]){u.alive=false;u.health=0;u.respawnAt=40}
  respawn(g);advancePortals(g);expect(g.blue[0].atFountain).toBe(true);expect(g.blue[0].portal).toBeUndefined();expect(g.red[0].portal).toBeDefined();
  g.time+=config.playerAutoSeconds-1;advancePortals(g);expect(g.blue[0].portal).toBeUndefined();g.time+=60;advancePortals(g);expect(g.blue[0].portal).toBeUndefined();expect(g.respawnPrompt).toBe(true);expect(usePortal(g)).toBe(true);expect(g.respawnPrompt).toBe(false);
 });
 it('walks out without automatic portal use and supports saves without new fields',()=>{
  let g=createGame(11);g.phase='playing';delete g.blue[0].fountainSince;delete g.blue[0].portalReadyAt;
  expect(walkFromBase(g)).toBe(true);const pos=g.blue[0].position;
  for(let i=0;i<config.playerAutoSeconds+1;i++)g=tick(g);
  expect(g.blue[0].portal).toBeUndefined();expect(g.blue[0].position).toBeGreaterThan(pos);expect(g.blue[0].atFountain).toBe(false);
 });
});
