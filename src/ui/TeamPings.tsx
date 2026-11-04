import type {CSSProperties} from 'react';
import type {Game} from '../engine/types';
import {mapPoint} from './mapGeometry';
export function TeamPings({game}:{game:Game}){
 const latest=new Map((game.chat?.pings??[]).filter(p=>game.time-p.at>=0&&game.time-p.at<7).map(p=>[p.targetId,p]));
 return <g className="team-pings" pointerEvents="none" aria-label="팀원 미아핑">{[...latest.values()].map(ping=>{
  const target=game.blue.find(u=>u.id===ping.targetId),sender=game.blue.find(u=>u.id===ping.sender);
  const p=mapPoint(ping.position-2.2,(Number(ping.targetId.split('-')[1])-2)*34);
  return <g key={ping.id} transform={`translate(${p.x} ${p.y})`} style={{'--ping-count':ping.count} as CSSProperties}>
   <title>{sender?.champion.name} → {target?.champion.name}: 미아핑 {ping.count}회 · {ping.reason}</title>
   <ellipse className="ping-ring" rx="25" ry="16" fill="none" stroke="#ffd565" strokeWidth="3"/>
   <path d="M0 -49L17 -32 0 -15 -17 -32Z" fill="#272211" stroke="#ffd565" strokeWidth="2"/>
   <text y="-25" textAnchor="middle" fill="#ffe595" fontSize="23" fontWeight="900">?</text>
   <text x="24" y="-26" fill="#ffe595" stroke="#101820" strokeWidth="3" paintOrder="stroke" fontSize="13">×{ping.count}</text>
   <text y="34" textAnchor="middle" fill="#ffe595" stroke="#101820" strokeWidth="3" paintOrder="stroke" fontSize="10">{sender?.champion.name} → {target?.champion.name}</text>
  </g>;
 })}</g>;
}
