import {skillRank} from '../engine/skill-training';
import {ExperienceBar,ProgressionPanel} from './ProgressionPanel';
import {ResourceBar} from './ResourceBar';
import {BuildDetails} from './BuildDetails';
import {ultimateReady} from '../engine/kits';
import {buildIdentity} from '../engine/stats';
import type {Game,Unit} from '../engine/types';
import {itemMap} from '../engine/items';
import {AugmentStrip,AugmentDetails} from './AugmentIcon';
import {statsFor} from '../engine/stats';
export const portrait=(u:Unit)=>`/assets/champions/${u.champion.id}.png`;
export function Inventory({unit}:{unit:Unit}) { return <div className="inventory">{Array.from({length:6},(_,i)=>{const item=itemMap[unit.items[i]];return <span className="item-slot" key={i} title={item?.name??'빈 슬롯'}>{item&&<img src={`/assets/items/${item.id}.png`} alt={item.name}/>}</span>})}</div> }
export function Roster({game,team,selected,onSelect}:{game:Game;team:'blue'|'red';selected:string;onSelect:(id:string)=>void}) {
 return <section className={`roster ${team}`} aria-label={team==='blue'?'아군 현황':'적군 현황'}><div className="section-label"><span>{team==='blue'?'BLUE TEAM':'RED TEAM'}</span><span>{game[team].filter(u=>u.alive).length}/5 생존</span></div>{game[team].map(u=>{const memory=u.relationships[game.playerId];return <button key={u.id} onClick={()=>onSelect(u.id)} className={`unit-card ${selected===u.id?'selected':''} ${!u.alive?'dead':''}`}>
 <div className="unit-top"><img className="portrait" src={portrait(u)} alt=""/><div className="unit-body"><div className="unit-name"><strong>{u.champion.name}{u.id===game.playerId&&<em>나</em>}</strong><small>Lv.{u.level}</small></div><div className="health-track"><i style={{width:`${Math.max(0,u.health/u.maxHealth*100)}%`}}/></div><div className="unit-numbers"><span>{Math.round(u.health)} / {u.maxHealth}</span><span>{u.kills} / {u.deaths} / {u.assists}</span></div></div></div>
 <ResourceBar unit={u}/><ExperienceBar unit={u}/><div className="unit-status"><span className={u.alive?'':'danger'}>{u.alive?(u.portal?`포탈 이동 · ${Math.max(0,u.portal.arriveAt-game.time)}초`:u.status):`부활 ${Math.max(0,Math.ceil(u.respawnAt-game.time))}초`}</span><span>{u.alive?(u.level<6?'궁 6레벨':!skillRank(u,'R')?'궁 미습득':ultimateReady(u,game.time)?'궁 준비':`궁 ${Math.max(0,Math.ceil((u.combat?.ready.R??0)-game.time))}초`):'사망'}</span></div><div className="loadout-row"><Inventory unit={u}/><AugmentStrip unit={u}/></div>
 {team==='blue'&&u.id!==game.playerId&&<div className="trust-line" title={memory?.reason??'함께한 판단 기록이 아직 없습니다'}><span>내 판단 신뢰</span><span className={(memory?.trust??0)<0?'danger':'teal'}>{memory?.trust??0} <small>{(memory?.trust??0)<-20?'경계':(memory?.trust??0)>20?'신뢰':'관찰'}</small></span></div>}
 </button>})}</section>
}
export function Inspector({game,unit}:{game:Game;unit:Unit}) {const s=statsFor(unit);return <section className="inspector"><div className="inspector-heading"><img className="portrait" src={portrait(unit)} alt=""/><div><h2>{unit.champion.name} <small>Lv.{unit.level}</small></h2><p>{unit.traits.join(' · ')}</p></div></div><ResourceBar unit={unit}/><div className="stat-grid">{[['공격력',s.ad],['주문력',s.ap],['방어력',s.armor],['마법 저항',s.mr],['공격 속도',Number(s.attackSpeed.toFixed(2))],['이동 속도',s.moveSpeed]].map(([name,value])=><div key={name}><span>{name}</span><strong>{typeof value==='number'?Math.round(value*100)/100:value}</strong></div>)}</div><div className="inspector-meta">보유 골드 {unit.gold}G · 누적 피해 {Math.round(unit.damage)} · 증강 {unit.augments.length}개</div>
 <ProgressionPanel game={game} unit={unit}/><BuildDetails game={game} unit={unit}/><AugmentDetails unit={unit}/><details><summary>이 플레이어가 팀원을 보는 시선</summary>{game[unit.team].filter(u=>u.id!==unit.id).map(u=>{const m=unit.relationships[u.id];return <p key={u.id}><b>{u.champion.name} · 신뢰 {m?.trust??0}</b><br/>{m?.reason??'아직 함께한 교전이 없습니다.'}{m&&<small> · {m.experiences}회 경험 / 무리한 진입 {m.reckless}회</small>}</p>})}</details></section>}
