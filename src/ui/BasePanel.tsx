import {ResourceBar} from './ResourceBar';
import type {Game} from '../engine/types';
import {returnToBase} from '../engine/base';
import {statsFor} from '../engine/stats';
import {PortalControls} from './PortalControls';
import {landmark} from '../engine/map-layout';
import {mapPoint} from './mapGeometry';
export function FountainLayer({game,onShop}:{game:Game;onShop:()=>void}){
 return <g>{(['blue','red'] as const).map(team=>{const anchor=landmark(team,'spawn'),p=mapPoint(anchor.position,anchor.laneOffset),color=team==='blue'?'#82eee3':'#f3a4bb',count=game[team].filter(u=>u.alive&&u.atFountain).length;
 return <g key={team} transform={`translate(${p.x} ${p.y})`} role={team==='blue'?'button':undefined} tabIndex={team==='blue'?0:undefined} aria-label={team==='blue'?'아군 우물 상점 열기':undefined} onClick={()=>{if(team==='blue')onShop()}} onKeyDown={e=>{if(team==='blue'&&(e.key==='Enter'||e.key===' ')){e.preventDefault();onShop()}}}><title>{team==='blue'?'아군':'적군'} 우물 · 부활 · 출발 전 상점 · 현재 {count}명</title><ellipse rx="44" ry="28" fill="#122c3d" fillOpacity=".8" stroke={color} strokeWidth="2"/><ellipse rx="33" ry="20" fill="none" stroke={color} strokeDasharray="4 4" opacity=".5"/><path d="M0 -13L9 -3 0 8 -9 -3Z" fill={color}/><path d="M-26 10L-26 -4 -18 -10 -10 -4V10Z" fill="#445b71" stroke={color}/><text y="41" textAnchor="middle" fill={color} fontSize="12" fontWeight="700" stroke="#091824" strokeWidth="3" paintOrder="stroke">{team==='blue'?'아군':'적군'} 우물 · {count}명</text></g>;
 })}</g>;
}
export function BasePanel({game,update,onShop}:{game:Game;update:(op:(g:Game)=>void)=>void;onShop:()=>void}){
 const u=game.blue[0],s=statsFor(u),disabled=game.phase!=='playing'||!!game.encounter||!u.alive||!!u.portal||u.atFountain;
 return <section className="base-panel" aria-label="기지와 우물"><header><div><span className="eyebrow">BLUE SANCTUARY</span><h2>기지 · 우물</h2></div><strong>{!u.alive?`부활까지 ${Math.max(0,Math.ceil(u.respawnAt-game.time))}초`:u.atFountain?'우물에서 정비 중':u.returningToBase?'기지로 후퇴 중':'전장에 있습니다'}</strong></header>
 <div className="base-vitals"><span>체력 <b>{Math.ceil(u.health)} / {u.maxHealth}</b><meter min="0" max={u.maxHealth} value={u.health}/></span><ResourceBar unit={u}/></div>
 <p>우물은 추가 체력·자원 회복이나 증강을 제공하지 않습니다. 구매는 사망 중 또는 부활 후 출발 전까지 가능합니다. 살아서 돌아오면 자연 재생만 적용됩니다.</p><div className="base-occupants">{game.blue.filter(a=>a.atFountain&&a.alive).map(a=><span key={a.id}><img src={`/assets/champions/${a.champion.id}.png`} alt=""/>{a.champion.name}</span>)}</div>
 <div className="button-row"><button onClick={onShop}>우물 상점 열기 <kbd>P</kbd></button>{u.returningToBase?<button onClick={()=>update(g=>{g.blue[0].returningToBase=false;g.blue[0].status='복귀 취소 · 전장 복귀'})}>복귀 취소</button>:<button disabled={disabled} title={game.encounter?'현재 교전이 끝나면 복귀할 수 있습니다':undefined} onClick={()=>update(g=>{returnToBase(g)})}>기지로 후퇴</button>}</div>
 {u.holdAtBase&&u.atFountain&&<small>대기 중입니다. 정비를 마치면 아래 포탈 또는 도보로 출발하세요.</small>}
 <PortalControls game={game} update={update}/>
 </section>;
}
