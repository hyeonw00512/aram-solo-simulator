import {AiBuildDetails} from './AiBuildDetails';
import {skillRank} from '../engine/skill-training';
import {ResourceBar} from './ResourceBar';
import {resourceLabel,resourceKind,skillCost} from '../engine/resources';
import type {Game,Unit} from '../engine/types';
import {statsFor,buildIdentity} from '../engine/stats';
import {kitFor,abilityName,passiveText} from '../engine/kits';
import {effect} from '../engine/runtime';
import {itemEffects,itemEffectStatus} from '../engine/item-effects';
import {bonusStatLines,itemMap,itemStatLines,hasOriginalItemEffect} from '../engine/items';
export function BuildDetails({game,unit}:{game:Game;unit:Unit}){
 const s=statsFor(unit),build=buildIdentity(unit),r=unit.combat;
 return <section className="build-details"><h3>{build.label} <small>현재 장비·능력치 기준</small></h3><ResourceBar unit={unit}/><p>보호막 {Math.round(effect(unit,'shield'))}</p><div className="skill-strip">{kitFor(unit).map(a=>{const cd=Math.max(0,Math.ceil((r?.ready[a.slot]??0)-game.time)),locked=skillRank(unit,a.slot)===0;return <div key={a.slot} title={a.kind+' · AP '+a.ap+' / AD '+(a.ad??0)+' / 방어력 '+(a.armor??0)}><b>{a.slot} · {skillRank(unit,a.slot)}랭크</b><strong>{abilityName(unit,a.slot)}</strong><span>{locked?'미습득':cd?cd+'초':'준비'} · {skillCost(unit,a)?`${resourceLabel(unit)} ${skillCost(unit,a)}`:'소모 없음'}</span></div>})}</div><p className="passive-note">패시브 · {passiveText[unit.champion.id]}</p>{unit.lastBuildReason&&<p>구매 계획 · {unit.lastBuildReason}</p>}{unit.masterwork&&unit.items.includes(unit.masterwork.itemId)&&<p className="passive-note">오른의 걸작 · {itemMap[unit.masterwork.itemId]?.name} · 기본 전투 능력치 추가 강화 (1000G 상당, 비율 배분 근사)<br/>{bonusStatLines(unit.masterwork.bonuses).join(' · ')}</p>}<AiBuildDetails unit={unit}/>{unit.lastAugmentReason&&<p>증강 판단 · {unit.lastAugmentReason}</p>}<details><summary>아이템 시너지와 자동 발동 효과</summary>{unit.items.map((id,i)=><p key={i}><b>{itemMap[id]?.name}</b> — {itemStatLines(id).join(' · ')}{(itemEffects[id]||hasOriginalItemEffect(id))&&<><br/>{itemEffects[id]??itemEffectStatus(id)}</>}</p>)}<small>사용 아이템은 전장 조건에 맞춰 AI가 자동 발동합니다. 물약·영약은 상점에서 직접 사용합니다.</small></details></section>;
}
