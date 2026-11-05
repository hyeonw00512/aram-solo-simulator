import type {Game} from '../engine/types';
import definitions from '../../data/encounters.json';
import {mapPoint,mapPolygon,laneUnitPoint} from './mapGeometry';
import {encounterPresentation,tacticalSnapshot,observable,onBattlefield} from './encounter-view';
import {MemoryReaction,TrustChanges} from './TeamMemory';

export function TacticalLayer({game}:{game:Game}){
 const snapshot=game.phase==='decision'?tacticalSnapshot(game):undefined;
 const view=encounterPresentation(game);
 return <g className="tactical-layer" pointerEvents="none">
  {snapshot&&<>
   <polygon points={mapPolygon(Math.max(0,snapshot.player.position-12),Math.min(100,snapshot.player.position+12),-88,88)} fill="#ebc97912" stroke="#ebc97977" strokeDasharray="6 6"/>
   {[snapshot.danger,snapshot.exposed].map((u,i)=>{if(!u)return null;const p=laneUnitPoint(u);return <g key={`${i}-${u.id}`}><ellipse cx={p.x} cy={p.y} rx="29" ry="28" fill="none" stroke={i===0?'#ff8c9f':'#f5d58e'} strokeWidth="3" className="tactical-pulse"/><text x={p.x} y={p.y-38} textAnchor="middle" fill={i===0?'#ffb2be':'#ffe3a7'} fontSize="12" stroke="#091824" strokeWidth="4" paintOrder="stroke">{i===0?'체력 위험':'지원 간격'}</text></g>})}
  </>}
  {!snapshot&&view?.round?.movements?.map(move=>{
   const u=[...game.blue,...game.red].find(u=>u.id===move.unitId);
   if(!u||!move.visible||!onBattlefield(u)||!observable(game,u)||Math.abs(move.to-move.from)<.5)return null;
   const from=laneUnitPoint(u,move.from),to=laneUnitPoint(u,move.to),color=u.team==='blue'?'#80e8e1':'#ff97ab';
   return <g key={`${view.encounter.id}-${view.round!.time}-${u.id}`} className="tactical-trail"><path d={`M${from.x} ${from.y}L${to.x} ${to.y}`} stroke={color} strokeWidth={u.id===game.playerId?4:2} strokeDasharray="5 4" opacity=".8"/><circle cx={from.x} cy={from.y} r="4" fill="none" stroke={color}/><circle cx={to.x} cy={to.y} r="5" fill={color}/></g>;
  })}
  {!snapshot&&view?.rows.filter(r=>r.unit.team==='blue'&&onBattlefield(r.unit)).map(({unit,plan,late})=>{
   const p=laneUnitPoint(unit),color=plan.misunderstood?'#ffc18b':plan.action==='retreat'?'#bac5ee':'#9ce4db';
   const label=plan.misunderstood?'오해 · 진입':late?'뒤늦은 합류':plan.memory?.factors.includes('caution')?'기억 · 주저':plan.memory&&plan.memory.trust<0&&plan.memory.factors.includes('angle')?'각 보고 호응':plan.action==='hesitate'?'각을 보는 중':definitions.actions[plan.action];
   return <g key={`reaction-${unit.id}`} transform={`translate(${p.x} ${p.y-44})`}><rect x="-40" y="-11" width="80" height="21" rx="5" fill="#0b1b28ed" stroke={color}/><text textAnchor="middle" y="3" fill={color} fontSize="11">{label}</text></g>;
  })}
 </g>;
}

export function TacticalPreview({game}:{game:Game}){
 const view=tacticalSnapshot(game);
 return <section className="tactical-preview" aria-label="선택 직전 전장 상황">
  <div className="tactical-mini"><svg viewBox="0 0 900 560" role="img" aria-label="현재 위치 요약. 금색은 나, 붉은 원은 체력이 위험한 아군, 금색 원은 지원 간격이 벌어진 적.">
   <polygon points={mapPolygon(0,100,-100,100)} fill="#203e4a" stroke="#587581" strokeWidth="4"/>
   <path d="M65 450L835 110" stroke="#648b9644" strokeWidth="4" strokeDasharray="12 12"/>
   {game.world?.buildings.filter(b=>b.alive).map(b=>{const p=mapPoint(b.position,b.laneOffset);return <rect key={b.id} x={p.x-7} y={p.y-7} width="14" height="14" fill={b.team==='blue'?'#509baa':'#b4697c'}/>})}
   <TacticalLayer game={game}/>
   {[...view.allies,...view.enemies].map(u=>{const p=laneUnitPoint(u);return <g key={u.id} transform={`translate(${p.x} ${p.y})`}><title>{u.champion.name} · 체력 {Math.round(u.health/u.maxHealth*100)}%</title><rect x="-19" y="-19" width="38" height="38" rx="4" fill="#102331" stroke={u.id===game.playerId?'#ffe0a1':u.team==='blue'?'#7de7e1':'#ff93aa'} strokeWidth="4"/><image href={`/assets/champions/${u.champion.id}.png`} x="-16" y="-16" width="32" height="32"/><text y="38" textAnchor="middle" fill="#e9f3f6" fontSize="16" stroke="#10202b" strokeWidth="5" paintOrder="stroke">{u.id===game.playerId?'나':u.champion.name}</text></g>})}
  </svg><small>현재 위치 · 주변 인원 기준</small></div>
  <div className="tactical-facts"><span className="eyebrow">판단의 순간</span>{view.facts.map(f=><p key={f.text} className={f.tone}><i aria-hidden="true"/>{f.text}</p>)}<small>체력·거리의 현재 상태입니다. 호응과 교전 결과는 각자의 판단에 따라 달라집니다.</small></div>
 </section>;
}

export function EncounterMoment({game}:{game:Game}){
 const view=encounterPresentation(game);
 if(!view)return null;
 const {encounter,round,result,rows,stage}=view;
 const player=rows.find(r=>r.unit.id===game.playerId),allies=rows.filter(r=>r.unit.team==='blue'&&r.unit.id!==game.playerId),enemies=rows.filter(r=>r.unit.team==='red');
 const intent=definitions.choices.find(c=>c.id===encounter.intent)?.label;
 return <section className="encounter-moment" aria-label="선택 이후 교전 흐름">
  <div className="moment-heading"><div><span className="eyebrow">{result?'교전 종료':'선택 이후'}</span><h2>{intent}</h2></div><span>{result?'결과 확인':`${encounter.rounds.length} / 4차 판단`}{round&&` · ${Math.floor(round.time/60)}:${String(round.time%60).padStart(2,'0')}`}</span></div>
  <ol className="moment-steps" aria-label="교전 읽기 순서">{['내 행동','팀원 반응','상대 대응','교전 결과'].map((text,i)=><li key={text} className={stage===i?'current':stage>i?'done':''} aria-current={stage===i?'step':undefined}><b>{i+1}</b>{text}</li>)}</ol>
  <p className="moment-player">{player?<><b>나 · {definitions.actions[player.plan.action]}</b><span>{player.plan.reason}</span></>:'선택을 전달했습니다. 다음 판단에서 각자의 반응이 드러납니다.'}</p>
  {!!allies.length&&<div className="moment-allies" key={`${encounter.id}-${round?.time}`}>{allies.map(({unit,plan,late})=><article key={unit.id} className={plan.misunderstood?'misread':''}><div><img src={`/assets/champions/${unit.champion.id}.png`} alt=""/><span><strong>{unit.champion.name}</strong><b>{definitions.actions[plan.action]}{late?' · 뒤늦은 합류':''}</b></span></div>{plan.misunderstood&&<em>교환을 진입 신호로 오해</em>}<p>{plan.reason}</p><MemoryReaction game={game} plan={plan}/></article>)}</div>}
  {!!enemies.length&&<details className="moment-enemies"><summary>상대 대응{enemies.map(({unit,plan})=><span key={unit.id}>{unit.champion.name} · {definitions.actions[plan.action]}</span>)}</summary>{enemies.map(({unit,plan})=><p key={unit.id}><b>{unit.champion.name}</b> {plan.reason}</p>)}</details>}
  {result&&<><p className="moment-result" role="status">{result.text}</p><TrustChanges game={game} result={result}/></>}
  <small className="moment-note">{round?'마지막 판단 시점의 기록 · 점선은 해당 판단에서의 실제 이동 · 전투는 양 팀 동시 판단으로 진행됩니다.':'팀원들은 이전 경험, 현재 체력과 각을 보고 독립적으로 판단합니다.'}</small>
 </section>;
}
