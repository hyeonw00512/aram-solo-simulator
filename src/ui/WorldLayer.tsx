import type {Game,Building} from '../engine/types';
import {mapPoint} from './mapGeometry';
import {Tower,Nexus} from './AbyssScenery';
import {structureUnlocked} from '../engine/world';
function buildingLabel(b:Building){
 const p=mapPoint(b.position,b.laneOffset);
 if(b.kind==='nexus')return {x:p.x+(b.team==='blue'?-45:45),y:p.y-50};
 if(b.kind==='nexus-tower')return {x:p.x+(b.laneOffset>0?20:-10),y:p.y+(b.laneOffset>0?27:-48)};
 return {x:p.x,y:p.y-(b.kind==='inhibitor'?35:58)};
}
export function WorldLayer({game}:{game:Game}){
 return <g>{game.world?.buildings.slice().sort((a,b)=>mapPoint(a.position,a.laneOffset).y-mapPoint(b.position,b.laneOffset).y).map(b=>{const p=mapPoint(b.position,b.laneOffset),color=b.team==='blue'?'#75e9ee':'#fb8c9d',locked=b.alive&&!structureUnlocked(game,b),label=buildingLabel(b);
 return <g key={b.id}><title>{b.team==='blue'?'아군':'적'} {b.name} · {Math.ceil(b.health)}/{b.maxHealth}{locked?' · 선행 건물 파괴 필요':''}{!b.alive?' · 파괴됨':''}</title>
 {b.alive?(b.kind==='nexus'?<Nexus position={b.position} lateral={b.laneOffset} red={b.team==='red'}/>:b.kind==='inhibitor'?<g transform={`translate(${p.x} ${p.y})`}><path d="M-16 0L0 -13 16 0 0 13Z" fill="#263b55" stroke={color}/><path d="M0 -25L-9 -7 0 4 9 -7Z" fill={color}/></g>:<Tower position={b.position} lateral={b.laneOffset} red={b.team==='red'} small={b.kind==='nexus-tower'}/>):<g transform={`translate(${p.x} ${p.y})`}><path d="M-18 8L-8 -3 0 2 10 -5 20 8Z" fill="#344656" stroke="#6c7b85"/>{b.respawnAt&&<text y="22" textAnchor="middle" fontSize="8" fill="#a7bfca">{Math.max(0,b.respawnAt-game.time)}초</text>}</g>}
 {b.alive&&<g><path d={`M${p.x} ${p.y-18}L${label.x} ${label.y+5}`} fill="none" stroke={color} strokeWidth=".7" opacity=".4"/><g transform={`translate(${label.x-22} ${label.y})`}><rect width="44" height="5" rx="2" fill="#09131d"/><rect width={44*b.health/b.maxHealth} height="5" rx="2" fill={locked?'#617889':color}/><text x="22" y="-5" textAnchor="middle" fill={color} fontSize="9" stroke="#09131d" strokeWidth="2" paintOrder="stroke">{b.kind==='nexus-tower'?b.name.replace('넥서스 포탑','쌍둥이'):b.name}{locked?' ◇':''}</text></g></g>}
 </g>})}
 {game.world?.minions.map(m=>{const p=mapPoint(m.position,((Number(m.id.slice(1))%6)-2.5)*7),color=m.team==='blue'?'#8addf0':'#f49baf',size=m.kind==='super'?7:m.kind==='cannon'?5:3;
 return <g key={m.id} transform={`translate(${p.x} ${p.y})`}><title>{m.team==='blue'?'아군':'적'} {m.kind==='super'?'슈퍼':m.kind==='cannon'?'공성':m.kind==='caster'?'원거리':'근접'} 미니언 · {Math.ceil(m.health)}</title><rect x={-size} y={-size} width={size*2} height={size*2} fill={color} stroke="#173043"/><rect x="-5" y={size+2} width={10*m.health/m.maxHealth} height="2" fill={color}/></g>})}</g>;
}
export function WorldStatus({game}:{game:Game}){
 return <section className="world-status" aria-label="공성 현황">{(['blue','red'] as const).map(team=><div key={team}><strong className={team==='blue'?'teal':'coral'}>{team==='blue'?'아군':'적군'}</strong>{game.world?.buildings.filter(b=>b.team===team).map(b=><span key={b.id} className={!b.alive?'destroyed':''} title={b.name+' '+Math.ceil(b.health)+'/'+b.maxHealth}>{b.kind==='outer'?'외곽':b.kind==='inner'?'안쪽':b.kind==='inhibitor'?'억제기':b.kind==='nexus'?'넥서스':'쌍둥이'} <b>{b.alive?`${Math.ceil(b.health)} / ${b.maxHealth}`:'파괴'}</b><progress aria-label={`${b.team==='blue'?'아군':'적군'} ${b.name} 체력`} max={b.maxHealth} value={b.health}/></span>)}</div>)}<small>웨이브 {game.world?.wave??0} · 넥서스 파괴 시 승리 · 미니언 없는 건물 공격 피해 90% 감소</small></section>;
}
