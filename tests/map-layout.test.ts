import {describe,it,expect} from 'vitest';
import layout from '../data/howling-abyss-layout.json';
import {landmark,projectWorld,portalPoint,spawnPosition} from '../src/engine/map-layout';
import {mapPoint} from '../src/ui/mapGeometry';
import {createGame} from '../src/engine/game';
import {ensureWorld} from '../src/engine/world';
import {portalDestination,usePortal,advancePortals} from '../src/engine/portal';

describe('original Map12 layout',()=>{
 it('uses extracted outer tower coordinates and preserves every pairwise ground distance',()=>{
  expect(layout.teams.blue.outer).toMatchObject({x:4943,z:4929});
  expect(layout.teams.red.outer).toMatchObject({x:7885.13818359375,z:7773.90185546875});
  const points=Object.values(layout.teams).flatMap(t=>Object.values(t));
  let scale:number|undefined;
  for(const a of points)for(const b of points){
   if(a===b)continue;
   const pa=projectWorld(a.x,a.z),pb=projectWorld(b.x,b.z),sa=mapPoint(pa.position,pa.laneOffset),sb=mapPoint(pb.position,pb.laneOffset);
   const ratio=Math.hypot(sa.x-sb.x,sa.y-sb.y)/Math.hypot(a.x-b.x,a.z-b.z);
   scale??=ratio;expect(ratio).toBeCloseTo(scale,10);
  }
 });
 it.each(['blue','red'] as const)('keeps %s gates behind the nexus and ahead of the active tower, including its ruins',team=>{
  const g=createGame(10),sign=team==='blue'?1:-1;
  const outer=g.world!.buildings.find(b=>b.team===team&&b.kind==='outer')!,inner=g.world!.buildings.find(b=>b.team===team&&b.kind==='inner')!;
  expect((portalPoint(team,'entry').position-landmark(team,'nexus').position)*sign).toBeLessThan(0);
  expect((portalDestination(team,g)-outer.position)*sign).toBeGreaterThan(0);
  outer.alive=false;const second=portalDestination(team,g);
  expect((second-inner.position)*sign).toBeGreaterThan(0);
  expect((second-outer.position)*sign).toBeLessThan(0);
  inner.alive=false;expect(portalDestination(team,g)).toBe(second);
  g.phase='playing';const u=g[team][0];u.position=spawnPosition(team);expect(usePortal(g,u)).toBe(true);expect(u.portal!.to).toBe(second);
 });
 it('retargets an in-flight portal when the outer tower falls',()=>{
  const g=createGame(10);g.phase='playing';usePortal(g);
  g.world!.buildings.find(b=>b.team==='blue'&&b.kind==='outer')!.alive=false;
  g.time=2;advancePortals(g);
  expect(g.blue[0].portal).toBeUndefined();expect(g.blue[0].position).toBe(portalDestination('blue',g));
 });
 it('migrates saved structure positions once without healing, resurrecting or resetting progress',()=>{
  const g=createGame(7),w=g.world!;delete w.layoutVersion;
  w.wave=15;w.nextWave=321;
  const outer=w.buildings.find(b=>b.team==='blue'&&b.kind==='outer')!;
  outer.position=20;outer.laneOffset=-22;outer.health=0;outer.alive=false;
  const inner=w.buildings.find(b=>b.team==='blue'&&b.kind==='inner')!;
  inner.position=12;inner.health=127;inner.targetId=g.red[0].id;
  g.blue[0].portal={from:8,to:20,startedAt:10,arriveAt:12};
  ensureWorld(g);
  expect(outer.position).toBe(landmark('blue','outer').position);expect(outer.health).toBe(0);expect(outer.alive).toBe(false);
  expect(inner.health).toBe(127);expect(inner.targetId).toBe(g.red[0].id);
  expect(w.wave).toBe(15);expect(w.nextWave).toBe(321);expect(g.blue[0].portal!.to).toBe(portalDestination('blue',g));
  const snapshot=structuredClone(g);ensureWorld(g);expect(g).toEqual(snapshot);
 });
});
