import type {EncounterResult,Game,ResponsePlan,TrustChange,Unit} from '../engine/types';
import definitions from '../../data/encounters.json';
import './team-memory.css';
const signed=(n:number)=>n>0?`+${n}`:String(n);
const clock=(t:number)=>`${Math.floor(t/60)}:${String(t%60).padStart(2,'0')}`;
const name=(game:Game,id:string)=>[...game.blue,...game.red].find(u=>u.id===id)?.champion.name??'팀원';

export function memoryReactionLabel(plan:ResponsePlan){
 const m=plan.memory;if(!m)return '';
 if(m.factors.includes('caution'))return '이전 경험 때문에 주저';
 if(m.factors.includes('necessity'))return m.trust<0?'불신하지만 함께 받아침':'물러설 곳이 없어 함께 대응';
 if(m.trust<0&&m.factors.includes('angle'))return '불신하지만 이번 각에는 호응';
 if(m.factors.includes('trust'))return '쌓인 신뢰가 호응에 영향';
 return `기억을 가진 채 ${definitions.actions[plan.action]}`;
}

export function MemoryReaction({game,plan}:{game:Game;plan:ResponsePlan}){
 const m=plan.memory;if(!m)return null;
 return <details className={`memory-reaction ${m.trust<0?'wary':'confident'}`}><summary>{memoryReactionLabel(plan)}<small>{name(game,m.leaderId)}에 대한 당시 신뢰 {signed(m.trust)}</small></summary><p><b>기억한 경험 · {clock(m.rememberedAt)}</b>{m.reason}</p><small>함께한 교전 {m.experiences}회 · 무리한 진입으로 기억한 횟수 {m.reckless}회</small></details>;
}

export function TeamMemoryPreview({game}:{game:Game}){
 const allies=game.blue.filter(u=>u.id!==game.playerId);
 return <details className="team-memory-preview"><summary><span>팀원들이 내 판단을 보는 시선</span><span className="memory-faces">{allies.map(u=><span key={u.id} className={(u.relationships[game.playerId]?.trust??0)<0?'wary':'confident'}><img src={`/assets/champions/${u.champion.id}.png`} alt={u.champion.name}/>{signed(u.relationships[game.playerId]?.trust??0)}</span>)}</span></summary>
  <div className="memory-preview-grid">{allies.map(u=>{const m=u.relationships[game.playerId];return <div key={u.id}><b>{u.champion.name} · {m?.experiences?`신뢰 ${signed(m.trust)}`:'아직 함께한 판단 없음'}</b><p>{m?.lastChange?.reason??m?.reason??'이번 교전부터 서로의 플레이를 기억합니다.'}</p><small>{!u.alive?'현재 사망 중':u.portal||u.atFountain||u.returningToBase?'현재 합류 전':'전장 참여 중'}{m?` · 무리한 진입 기억 ${m.reckless}회`:''}</small></div>})}</div>
  <p className="memory-note">신뢰가 낮아도 현재 각과 필요에 따라 호응합니다. 이번 반응을 미리 확정하는 표시는 아닙니다.</p>
 </details>;
}

function ChangeRow({game,change}:{game:Game;change:TrustChange}){
 const d=change.after-change.before;
 return <article className={`memory-change ${d<0?'wary':d>0?'confident':'neutral'}`}><div><strong>{name(game,change.observerId)} → {change.leaderId===game.playerId?'나':name(game,change.leaderId)}</strong><b>{signed(change.before)} → {signed(change.after)} <small>({d?signed(d):'유지'})</small></b></div><p>{change.reason}</p>{change.reckless>0&&<small>무리한 진입으로 기억한 횟수 {change.reckless}회</small>}</article>;
}

export function TrustChanges({game,result}:{game:Game;result:EncounterResult}){
 if(!result.memoryChanges)return <p className="memory-note">이전 저장의 교전에는 신뢰 변화 기록이 없습니다.</p>;
 const allies=new Set(game.blue.filter(u=>u.id!==game.playerId).map(u=>u.id));
 const changes=result.memoryChanges.filter(c=>allies.has(c.observerId));
 const mine=changes.filter(c=>c.leaderId===game.playerId),others=changes.filter(c=>c.leaderId!==game.playerId&&c.before!==c.after);
 return <section className="trust-changes" aria-label="이번 교전이 남긴 기억"><h3>이번 교전이 남긴 기억</h3><div className="memory-change-grid">{mine.map(c=><ChangeRow key={c.observerId} game={game} change={c}/>)}</div>{!mine.length&&<p className="memory-note">이번 교전에서 내 플레이에 대한 새 평가가 기록되지 않았습니다.</p>}{others.length>0&&<details><summary>팀원끼리 달라진 신뢰 · {others.length}건</summary><div className="memory-change-grid">{others.map(c=><ChangeRow key={`${c.observerId}-${c.leaderId}`} game={game} change={c}/>)}</div></details>}</section>;
}

export function MemoryHistory({game,unit}:{game:Game;unit:Unit}){
 const records=[...game.encounterHistory].reverse().flatMap(result=>(result.memoryChanges??[]).filter(c=>c.observerId===unit.id&&c.before!==c.after).map(change=>({id:result.id,change})));
 return <details className="memory-history"><summary>이 플레이어의 신뢰 변화 기록 · 최근 {game.encounterHistory.length}개 교전</summary>{records.length?records.map(({id,change})=><div key={`${id}-${change.leaderId}`}><small>{clock(change.time)} · 교전 {id}</small><ChangeRow game={game} change={change}/></div>):<p className="memory-note">기록된 신뢰 변화가 없습니다. 이전 저장에 없던 과거 기록을 새로 만들어 표시하지 않습니다.</p>}</details>;
}

export function EncounterRecaps({game}:{game:Game}){
 return <section className="recaps panel"><h2>교전 복기</h2><p className="muted">선택 → 팀원의 판단 → 실제 결과 → 다음 교전의 신뢰</p>{!game.encounterHistory.length&&<p>첫 교전이 끝나면 팀원별 판단 근거가 기록됩니다.</p>}{[...game.encounterHistory].reverse().map(result=><details key={result.id}><summary>{result.text}</summary><TrustChanges game={game} result={result}/>{result.rounds.map(round=><div key={round.time}><h3>{clock(round.time)} · 판단 근거</h3>{round.plans.map(plan=><div key={plan.unitId}><p><b>{name(game,plan.unitId)} · {definitions.actions[plan.action]}</b><br/>{plan.reason}{plan.misunderstood?' [진입 신호로 오해]':''}</p><MemoryReaction game={game} plan={plan}/></div>)}</div>)}</details>)}</section>;
}
