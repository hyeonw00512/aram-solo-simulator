import type {Game,Unit} from '../engine/types';
import {portalPoint,landmark} from '../engine/map-layout';
// Uniform ground-plane projection shared with engine/map-layout.ts.
export const mapPoint = (position: number, lateral = 0) => ({
  x: 65 + position * 7.7 + lateral * 340 / Math.hypot(770,340),
  y: 450 - position * 3.4 + lateral * 770 / Math.hypot(770,340),
});
export const mapPolygon = (start: number, end: number, near: number, far: number) =>
  [[start, near], [end, near], [end, far], [start, far]].map(([p, l]) => {
    const point = mapPoint(p, l); return `${point.x},${point.y}`;
  }).join(' ');

// Display offsets are shared by portraits, tactical highlights and movement trails.
export const laneUnitPoint=(u:Unit,position=u.position)=>mapPoint(position+(u.team==='blue'?-2.2:2.2),(Number(u.id.split('-')[1])-2)*34);
export function unitPoint(u:Unit,game:Game){
 if(u.portal){const entry=portalPoint(u.team,'entry',game),exit=portalPoint(u.team,'exit',game),t=Math.max(0,Math.min(1,(game.time-u.portal.startedAt)/(u.portal.arriveAt-u.portal.startedAt)));return mapPoint(entry.position+(exit.position-entry.position)*t,entry.laneOffset+(exit.laneOffset-entry.laneOffset)*t)}
 if(u.atFountain){const base=landmark(u.team,'spawn'),slot=Number(u.id.split('-')[1]);return mapPoint(base.position+(slot%3-1)*4,base.laneOffset+(Math.floor(slot/3)-.5)*32)}
 return laneUnitPoint(u);
}
