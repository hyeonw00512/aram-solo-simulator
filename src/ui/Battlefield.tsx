import {camouflaged} from '../engine/evelynn';
import {resourceKind,resourceLabel,currentResource} from '../engine/resources';
import {statsFor} from '../engine/stats';
import type { Game } from '../engine/types';
import {WorldLayer} from './WorldLayer';
import { PortalMap } from './PortalMap';
import { AbyssScenery } from './AbyssScenery';
import { FountainLayer } from './BasePanel';
import {TeamPings} from './TeamPings';
import { mapPoint,unitPoint as point } from './mapGeometry';
import {TacticalLayer} from './EncounterMoment';
import simulation from '../../data/simulation.json';

export function Battlefield({game,selected,onSelect,onUsePortal,onShop}:{game:Game;selected:string;onSelect:(id:string)=>void;onUsePortal:()=>void;onShop:()=>void}) {
 const members=[...game.blue,...game.red];
 return <div className="battlefield abyss-map"><svg viewBox="0 0 900 560" role="group" aria-label="칼바람 나락 관전 지도. 좌하단 아군 기지에서 우상단 적 기지로 이어지는 눈 덮인 외길 석교.">
  <AbyssScenery/>
  <FountainLayer game={game} onShop={onShop}/>
  <WorldLayer game={game}/>
  <PortalMap game={game} onUse={onUsePortal}/>
  {(['blue','red'] as const).map(side=>{
   const p=mapPoint(side==='blue'?simulation.packs.bluePosition:simulation.packs.redPosition,side==='blue'?54:-54),ready=game.packs[side]<=game.time;
   return <g key={side} transform={`translate(${p.x} ${p.y})`}><title>체력팩 · {ready?'사용 가능':`${game.packs[side]-game.time}초 후 생성`}</title><ellipse rx="16" ry="9" fill="#183c43" stroke={ready?'#6bdab0':'#4b6773'} opacity=".85"/><path d="M-10 -7L0 -13 10 -7V2L0 8-10 2Z" fill={ready?'#325f55':'#354b57'}/><path d="M-3 -18H3V-13H8V-7H3V-2H-3V-7H-8V-13H-3Z" fill={ready?'#9af1bf':'#607b82'} filter={ready?'url(#abyss-glow)':undefined}/><text y="23" textAnchor="middle" fill={ready?'#a2e6c7':'#8fa5b5'} fontSize="10" stroke="#10202c" strokeWidth="3" paintOrder="stroke">{ready?'체력팩':`${game.packs[side]-game.time}초`}</text></g>;
  })}
  <TacticalLayer game={game}/>
  {members.filter(u=>u.alive).map(u=>{
   const maxResource=statsFor(u).resourceMax,resource=currentResource(u,maxResource),kind=resourceKind(u);
   const p=point(u,game),color=u.team==='blue'?'#71e2ed':'#ff869a',chosen=u.id===selected;
   return <g key={u.id} className={`map-unit ${camouflaged(game,u)?"map-camouflage":""} ${u.portal?"portal-transit":""}`} style={{transform:`translate(${p.x}px, ${p.y}px)`}} onClick={()=>onSelect(u.id)} role="button" tabIndex={0} aria-label={`${u.champion.name} 상세 보기`} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();onSelect(u.id)}}}>
    <title>{u.champion.name} · {Math.round(u.health)}/{u.maxHealth} · {u.status} · {resourceLabel(u)} {Math.round(resource)}/{Math.round(maxResource)}</title>
    {u.portal&&<g><ellipse rx="23" ry="27" fill="#6de6f02b" stroke="#8cedf7" strokeDasharray="4 3"/><text y="-36" textAnchor="middle" fill="#b7f8ff" fontSize="10">포탈 이동</text></g>}
    <ellipse cy="10" rx="17" ry="8" fill="#06121c" opacity=".7"/>
    {chosen&&<ellipse cy="10" rx="22" ry="12" fill="none" stroke="#ffe0a1" strokeWidth="1.5" opacity=".9"/>}
    <rect x="-14" y="-16" width="28" height="29" rx="2" fill="#0c1522" stroke={chosen?'#ffe0a1':color} strokeWidth="2"/>
    <image href={`/assets/champions/${u.champion.id}.png`} x="-12" y="-14" width="24" height="24"/>
    <rect x="-15" y="15" width="30" height="4" fill="#081420" stroke="#0b1721" strokeWidth="2"/>
    <rect x="-15" y="15" width={30*Math.max(0,u.health/u.maxHealth)} height="4" fill={color}/>
    {maxResource>0&&<g><rect x="-15" y="21" width="30" height="3" fill="#0a1521"/><rect className="map-resource" x="-15" y="21" width={30*resource/maxResource} height="3" fill={kind==='energy'?'#ead45c':kind==='flow'?'#dae9ee':'#599ee8'}/></g>}
    {u.id===game.playerId&&<path d="M-5 -29H5L0 -22Z" fill="#ffe0a1"/>}
    <text x={u.team==='blue'?-20:20} y="1" textAnchor={u.team==='blue'?'end':'start'} fill={chosen?'#ffdfa7':'#e5f2f7'} fontSize="11" fontWeight={chosen?700:500} stroke="#091824" strokeWidth="3" paintOrder="stroke">{u.champion.name}</text>
   </g>;
  })}
  {game.visualEvents.filter(e=>game.time-e.at<=2).map((e,i)=>{
   const to=members.find(u=>u.id===e.to);if(!to)return null;
   const from=members.find(u=>u.id===e.from),p=point(to,game),tower=game.world?.buildings.filter(b=>b.team!==to.team&&b.alive&&['outer','inner','nexus-tower'].includes(b.kind)).sort((a,b)=>Math.abs(a.position-to.position)-Math.abs(b.position-to.position))[0],a=from?point(from,game):tower?mapPoint(tower.position,tower.laneOffset):p;
   const color=e.type==='miss'?'#d1e0e8':e.type==='heal'?'#6ce3ac':e.type==='magic'?'#c4a5ff':'#ffcc89';
   return <g key={`${e.at}-${i}`} className="combat-fx" pointerEvents="none">{e.type!=='heal'&&<path d={`M${a.x} ${a.y-12}L${p.x} ${p.y}`} stroke={color} strokeWidth="2.5" strokeDasharray={e.type==='miss'?'5 5':undefined} opacity=".85"/>}<text x={p.x+20} y={p.y-25-i%3*13} fill={color} fontSize="15" fontWeight="800" stroke="#06111c" strokeWidth="3" paintOrder="stroke">{e.type==='miss'?'회피':`${e.type==='heal'?'+':'−'}${e.amount}`}</text></g>;
  })}
  <TeamPings game={game}/>
  <g pointerEvents="none"><path d="M0 0H900V55H0Z" fill="#0a1827" opacity=".72"/><text x="24" y="27" fill="#e0ebee" fontSize="15" fontWeight="700" letterSpacing="2">칼바람 나락</text><text x="24" y="43" fill="#81a9bc" fontSize="8" letterSpacing="2.3">HOWLING ABYSS / SPECTATOR VIEW</text><circle cx="797" cy="26" r="3" fill={game.phase==='decision'?'#e4c085':'#76e1b5'}/><text x="876" y="30" textAnchor="end" fill="#d2e0e7" fontSize="12">{game.phase==='decision'?'Ⅱ 선택 대기':game.encounter?`교전 ${game.encounter.wave}/4`:'전장 관전'}</text>
   <text x="21" y="515" fill="#7bdded" fontSize="11" letterSpacing="1">BLUE BASE</text><text x="879" y="77" textAnchor="end" fill="#f393a5" fontSize="11" letterSpacing="1">RED BASE</text>
   <path d="M0 535H900V560H0Z" fill="#081422" opacity=".92"/><text x="450" y="551" textAnchor="middle" fill="#8ba6b6" fontSize="9">건물 간격: 칼바람 나락 원본 좌표 기준 · 포탈 세부 위치는 추정 · 수풀 은신 미지원</text>
  </g>
 </svg></div>;
}
