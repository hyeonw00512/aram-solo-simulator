import type {Game} from '../engine/types';
import {resourceLabel} from '../engine/resources';
import {abilityName} from '../engine/kits';
import {ResourceBar} from './ResourceBar';
import {ExperienceBar} from './ProgressionPanel';
import {Inventory} from './Roster';
import {AugmentStrip} from './AugmentIcon';
import {playerHudState} from './player-hud-state';
import './player-hud.css';

export function PlayerHud({game,onSettings,onShop,onFocus}:{game:Game;onSettings:()=>void;onShop:()=>void;onFocus:()=>void}){
 const h=playerHudState(game),u=h.unit,hp=Math.max(0,Math.min(u.maxHealth,u.health));
 return <section className={`player-hud ${!u.alive?'is-dead':''} ${u.alive&&hp/u.maxHealth<=.3?'is-danger':''}`} aria-label="내 챔피언 전용 HUD">
  <div className="hud-vitals">
   <button className="hud-portrait" onClick={onFocus} aria-label="지도에서 내 챔피언 강조"><img src={`/assets/champions/${u.champion.id}.png`} alt={u.champion.name}/><b>Lv.{u.level}</b></button>
   <div className="hud-bars"><div className="hud-name"><strong>{u.champion.name} <small>나</small></strong><span>{u.kills} / {u.deaths} / {u.assists}</span></div>
    <div className="hud-health" role="meter" aria-label="내 체력" aria-valuemin={0} aria-valuemax={u.maxHealth} aria-valuenow={hp}><i style={{width:`${hp/u.maxHealth*100}%`}}/><span>{Math.ceil(hp)} / {Math.round(u.maxHealth)}{h.shield>0&&` · 보호막 +${Math.round(h.shield)}`}</span></div>
    <ResourceBar unit={u}/><ExperienceBar unit={u}/>
   </div>
  </div>
  <div className="hud-skills"><div className="hud-section-title"><span>스킬 · 자동 전투</span><button onClick={onSettings} aria-haspopup="dialog" className={h.points?'has-points':''}>{h.points?`스킬 투자 +${h.points}`:'선마 설정'}</button></div>
   <div className="hud-skill-grid">{h.skills.map(s=><div key={s.slot} className={`hud-skill ${s.tone}`} aria-label={`${s.slot} ${s.name}, ${s.rank}랭크, ${s.label}`}><div><b>{s.slot}</b><strong>{s.label}</strong></div><span className="hud-skill-name" title={s.name}>{s.name}</span><div className="hud-ranks" aria-label={`${s.rank} / ${s.maxRank}랭크`}>{Array.from({length:s.maxRank},(_,i)=><i key={i} className={i<s.rank?'filled':''}/>)}</div><small>{s.cost?`${resourceLabel(u)} ${s.cost}`:'소모 없음'}</small></div>)}</div>
   <small className="hud-skill-note">재사용 가능 상태에서도 사거리·대상·성향에 따라 자동 시전합니다.{u.combat?.lastCast&&` 마지막 시전: ${u.combat.lastCast} ${abilityName(u,u.combat.lastCast)}`}</small>
  </div>
  <div className="hud-loadout"><button className="hud-shop" onClick={onShop} aria-haspopup="dialog"><span>아이템 상점</span><strong>{u.gold.toLocaleString('ko-KR')} G</strong><Inventory unit={u}/></button><AugmentStrip unit={u}/></div>
  <div className="hud-action"><div><span className="hud-action-label">현재 행동</span><strong>{h.action}</strong><small>{h.reason}</small></div><button onClick={onSettings} aria-haspopup="dialog">성향 · {h.style.name}</button></div>
  {(h.warnings.length>0||h.effects.length>0||h.recentDamage>0||h.recentHeal>0||h.recentDodges>0)&&<div className="hud-feedback">
   {h.warnings.map(w=><strong className="hud-warning" key={w}>{w}</strong>)}
   {h.effects.map(e=><span className="hud-effect" key={e.kind}>{e.label} {e.seconds}초</span>)}
   {(h.recentDamage>0||h.recentHeal>0||h.recentDodges>0)&&<span className="hud-recent">최근 2초 {h.recentDamage>0&&<b className="damage">−{Math.round(h.recentDamage)}</b>} {h.recentHeal>0&&<b className="heal">+{Math.round(h.recentHeal)}</b>} {h.recentDodges>0&&<b>회피 {h.recentDodges}회</b>}</span>}
  </div>}
 </section>;
}
