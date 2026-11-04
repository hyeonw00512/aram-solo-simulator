import type {Game} from '../engine/types';
import {mapPoint} from './mapGeometry';
import {portalReason} from '../engine/portal';
import {portalPoint,portalAnchor} from '../engine/map-layout';
export function PortalMap({game,onUse}:{game:Game;onUse:()=>void}) {
 const reason=portalReason(game);
 return <g>{(['blue','red'] as const).map(team=>{
  const entrance=portalPoint(team,'entry',game),destination=portalPoint(team,'exit',game),entry=mapPoint(entrance.position,entrance.laneOffset),exit=mapPoint(destination.position,destination.laneOffset),color=team==='blue'?'#6beaf7':'#d19cff';
  return <g key={team}><path d={`M${entry.x} ${entry.y}Q${(entry.x+exit.x)/2} ${Math.min(entry.y,exit.y)-30} ${exit.x} ${exit.y}`} fill="none" stroke={color} strokeWidth="1.4" strokeDasharray="4 6" opacity=".6"/>
   <g transform={`translate(${entry.x} ${entry.y})`} role={team==='blue'?'button':undefined} aria-label={team==='blue'?'기지 포탈로 합류':undefined} aria-disabled={team==='blue'?!!reason:undefined} tabIndex={team==='blue'?0:undefined} className="portal-map-gate" onClick={()=>{if(team==='blue'&&!reason)onUse()}} onKeyDown={e=>{if(team==='blue'&&(e.key==='Enter'||e.key===' ')){e.preventDefault();if(!reason)onUse()}}}><title>{team==='blue'?reason??'클릭하여 전방 포탑으로 합류':'적군 기지 포탈'}</title><ellipse cy="3" rx="19" ry="10" fill="#152e4a" stroke={color}/><ellipse cy="-10" rx="12" ry="21" fill="#14334ed9" stroke={color} strokeWidth="3"/><ellipse cy="-10" rx="7" ry="15" fill={color} opacity=".28"/><path d="M-4 -19L4 -12-4 -5 4 2" fill="none" stroke="#e5ffff" strokeWidth="2"/><text y="25" textAnchor="middle" fill={color} fontSize="10" stroke="#0b1929" strokeWidth="3" paintOrder="stroke">기지 포탈</text></g>
   <g transform={`translate(${exit.x} ${exit.y})`}><title>{portalAnchor(team,game)==='outer'?'외곽 포탑 앞':'두 번째 포탑 앞 · 파괴 후에도 유지'}</title><ellipse rx="17" ry="9" fill="#1b354a" stroke={color} strokeWidth="2"/><ellipse rx="10" ry="5" fill={color} opacity=".5"/><text y="22" textAnchor="middle" fill={color} fontSize="9" stroke="#0b1929" strokeWidth="3" paintOrder="stroke">도착</text></g>
  </g>;
 })}</g>;
}
