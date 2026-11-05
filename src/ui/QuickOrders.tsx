import {useState} from 'react';
import type {Game,QuickOrder} from '../engine/types';
import {activeOrder,focusVisible,orderNames,quickOrderReason,sendQuickOrder} from '../engine/team-chat';
import {unitPoint} from './mapGeometry';
import './quick-orders.css';
const commands:{kind:QuickOrder['kind'];label:string;symbol:string}[]=[{kind:'group',label:'합류',symbol:'◎'},{kind:'retreat',label:'후퇴',symbol:'↙'},{kind:'engage',label:'이니시',symbol:'↗'},{kind:'clear',label:'라인 정리',symbol:'≋'},{kind:'defend',label:'수비',symbol:'◇'},{kind:'focus',label:'집중 공격',symbol:'⌖'}];
export function quickResponseLabel(game:Game,response:QuickOrder['responses'][number]){
 const receipt=game.chat?.quickOrder,u=game.blue.find(u=>u.id===response.unitId);
 if(response.status==='unavailable')return '참여 어려움';
 if(response.status==='ignored')return '이번 지시 미수락';
 if(!u?.alive)return '사망으로 중단';
 if(!receipt||game.time>=receipt.at+24)return '지시 종료';
 if(u.order?.id!==receipt.id)return '다른 지시로 변경';
 if(u.order.until<=game.time)return '지시 종료';
 if(u.portal||u.atFountain||u.returningToBase)return '합류 전';
 if(receipt.kind==='focus'&&!activeOrder(game,u))return '대상 이탈 · 종료';
 return u.health/u.maxHealth<.3&&['engage','focus'].includes(receipt.kind)?'엄호로 전환':'지시 반영 중';
}
export function QuickOrders({game,selected,update}:{game:Game;selected:string;update:(op:(g:Game)=>void)=>void}){
 const [recipient,setRecipient]=useState('');
 const focus=game.red.find(u=>u.id===selected&&focusVisible(game,u)),receipt=game.chat?.quickOrder;
 const recent=receipt&&game.time-receipt.at<=30,reason=quickOrderReason(game);
 return <section className="quick-orders" aria-label="전장 빠른 지시">
  <div className="quick-order-heading"><strong>빠른 지시</strong><label>전달 대상 <select value={recipient} onChange={e=>setRecipient(e.target.value)}><option value="">팀 전체</option>{game.blue.filter(u=>u.id!==game.playerId).map(u=><option key={u.id} value={u.id}>{u.champion.name}</option>)}</select></label><small>{reason??'지시해도 팀원은 각자 판단합니다 · 3초 간격'}</small></div>
  <div className="quick-order-buttons">{commands.map(c=>{const blocked=quickOrderReason(game,c.kind,focus?.id);return <button key={c.kind} disabled={!!blocked} title={blocked??orderNames[c.kind]} onClick={()=>update(g=>{sendQuickOrder(g,c.kind,recipient||undefined,focus?.id)})}><span aria-hidden="true">{c.symbol}</span>{c.label}{c.kind==='focus'&&focus&&<small>{focus.champion.name}</small>}</button>})}</div>
  {!focus&&<small className="quick-focus-help">집중 공격: 지도나 적군 목록에서 적 챔피언을 먼저 선택하세요.</small>}
  {recent&&<details className="quick-responses" open><summary>최근 지시 · {orderNames[receipt.kind]}{receipt.focusId&&` · ${game.red.find(u=>u.id===receipt.focusId)?.champion.name??'대상'}`}<small>{Math.max(0,receipt.at+24-game.time)}초 남음</small></summary><div>{receipt.responses.map(r=>{const u=game.blue.find(u=>u.id===r.unitId);if(!u)return null;return <article key={r.unitId} className={r.status}><img src={`/assets/champions/${u.champion.id}.png`} alt=""/><div><strong>{u.champion.name}</strong><span>{quickResponseLabel(game,r)}</span><small>{r.reason}{r.status==='ignored'&&activeOrder(game,u)?' · 기존 지시는 유지':''}</small></div></article>})}</div><small>답장이 아니라 실제 지시 반영 상태입니다. 선택한 내 행동은 그대로 유지됩니다.</small></details>}
 </section>;
}
export function QuickOrderMarker({game}:{game:Game}){
 const order=game.chat?.quickOrder;if(!order||order.kind!=='focus'||game.time>=order.at+24)return null;
 const target=game.red.find(u=>u.id===order.focusId&&focusVisible(game,u));if(!target)return null;
 const p=unitPoint(target,game);
 return <g pointerEvents="none" aria-label={`${target.champion.name} 집중 공격 요청`}><circle cx={p.x} cy={p.y} r="34" fill="none" stroke="#ffe0a1" strokeWidth="2" strokeDasharray="8 4"/><path d={`M${p.x-43} ${p.y}h12 M${p.x+31} ${p.y}h12 M${p.x} ${p.y-43}v12 M${p.x} ${p.y+31}v12`} stroke="#ffe0a1" strokeWidth="3"/><text x={p.x} y={p.y+51} textAnchor="middle" fill="#ffe3a3" fontSize="11" stroke="#0b1e2b" strokeWidth="4" paintOrder="stroke">집중 공격 요청</text></g>;
}
