import type {Game,Unit} from '../engine/types';
import {xpProgress,respawnSeconds,progressionRules} from '../engine/progression';
import {statsFor} from '../engine/stats';
export function ExperienceBar({unit}:{unit:Unit}){
 const p=xpProgress(unit);
 return <div className="experience-bar"><div><span>Lv.{unit.level} · 경험치</span><span>{p.required?`${Math.floor(p.earned)} / ${p.required}`:'최고 레벨'}</span></div><div className="experience-track" role="meter" aria-label={`${unit.champion.name} 경험치`} aria-valuemin={0} aria-valuemax={p.required||1} aria-valuenow={p.required?p.earned:1}><i style={{width:`${p.percent}%`}}/></div></div>;
}
export function ProgressionPanel({game,unit}:{game:Game;unit:Unit}){
 const current=statsFor(unit),next=unit.level<18?statsFor({...unit,level:unit.level+1}):current;
 const entries:[string,number][]=[['최대 체력',next.hp-current.hp],['공격력',next.ad-current.ad],['방어력',next.armor-current.armor],['마법 저항',next.mr-current.mr],['마나',next.mana-current.mana],['공격 속도',next.attackSpeed-current.attackSpeed]];
 return <section className="progression-panel" aria-label="성장과 부활"><ExperienceBar unit={unit}/><div className="respawn-rule"><strong>{unit.alive?`지금 사망 시 ${respawnSeconds(unit.level,game.time)}초 후 부활`:`부활까지 ${Math.max(0,Math.ceil(unit.respawnAt-game.time))}초`}</strong><small>{unit.alive?'사망 시 레벨·경기 시간으로 대기 시간 확정':`사망 시 정해진 대기 시간 ${unit.deathDuration??'기존 저장 기준'}${unit.deathDuration?'초':''} · 사망 중 레벨업해도 연장되지 않음`}</small></div><details><summary>다음 레벨 성장량과 경험치 규칙</summary>{unit.level<18?<div className="growth-preview">{entries.filter(([,amount])=>amount>0).map(([name,amount])=><span key={name}>{name} <b>+{Number(amount.toFixed(3))}</b></span>)}</div>:<p>18레벨에 도달했습니다.</p>}<p>경기 진행 중 초당 {progressionRules.passiveXpPerSecond} 경험치. 근처 적 미니언이 죽으면 생존한 아군끼리 경험치를 나누고, 적 챔피언 처치에도 경험치를 얻습니다. 사망·기지 대기 중에는 미니언 경험치를 놓칠 수 있습니다.</p><p>칼바람 레벨별 필요 경험치와 성장 공식을 사용합니다. 기본 부활은 레벨별 11~40초. 24분 이후 매 1분마다 2.5%씩 늘어나며 최대 1.25배까지 적용됩니다. 처치 경험치 보정과 일직선 거리 판정은 근사 구현입니다.</p></details></section>;
}
