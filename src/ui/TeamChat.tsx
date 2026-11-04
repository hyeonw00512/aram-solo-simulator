import {useEffect,useRef,useState} from 'react';
import type {Game} from '../engine/types';
import {sendTeamChat,chatReason,orderNames,activeOrder} from '../engine/team-chat';
import {aiShopping} from '../engine/shop';
import {itemMap} from '../engine/items';
export function TeamChat({game,update}:{game:Game;update:(op:(g:Game)=>void)=>void}){
 const [text,setText]=useState(''),[target,setTarget]=useState(''),history=useRef<HTMLDivElement>(null);
 const messages=game.chat?.messages??[],reason=chatReason(game);
 useEffect(()=>{history.current?.scrollTo({top:history.current.scrollHeight})},[messages.length,game.chat?.serial]);
 const send=(value:string)=>{if(!value.trim()||reason)return;update(g=>{if(sendTeamChat(g,value,target||undefined))for(const u of g.blue.filter(u=>u.id!==g.playerId&&u.shopRequest?.status==='pending'))aiShopping(g,u)});setText('');};
 return <section className="team-chat" aria-label="팀 채팅과 오더"><header><div><span className="eyebrow">TEAM CHAT</span><h2>팀 채팅 · 오더</h2></div><small>성향 · 신뢰 · 현재 상황에 따라 반응</small></header>
 <div className="chat-history" ref={history} role="log" aria-label="팀 채팅 기록" aria-live="polite">{!messages.length&&<p className="chat-empty">“치감템 가줘”, “같이 들어가자”, “라인 정리해줘”처럼 말해보세요.<br/>특정 팀원을 선택하거나 이름을 적을 수 있습니다.</p>}{messages.map(m=><div className={`chat-message ${m.tone}`} key={m.id} title={m.reason}><time>{Math.floor(m.at/60)}:{String(m.at%60).padStart(2,'0')}</time><b>{m.sender==='system'?'안내':game.blue.find(u=>u.id===m.sender)?.champion.name??'팀원'}{m.sender===game.playerId?' (나)':''}</b><span>{m.text}</span></div>)}</div>
 <form onSubmit={e=>{e.preventDefault();send(text)}}><label className="sr-only" htmlFor="chat-target">오더 대상</label><select id="chat-target" value={target} onChange={e=>setTarget(e.target.value)}><option value="">팀 전체</option>{game.blue.filter(u=>u.id!==game.playerId).map(u=><option key={u.id} value={u.id}>{u.champion.name}</option>)}</select><input aria-label="팀 채팅 입력" value={text} maxLength={160} onChange={e=>setText(e.target.value)} placeholder="예: 치감템 가줘"/><button type="submit" disabled={!text.trim()||!!reason}>전송</button></form>
 <div className="chat-quick">{['치감템 가줘','같이 들어가자','후퇴하자','합류해줘','라인 정리해줘','기지 수비해줘'].map(value=><button key={value} disabled={!!reason} onClick={()=>send(value)}>{value}</button>)}</div>{reason&&<small role="status">{reason}</small>}
 <details className="order-inspector"><summary>팀원 행동 확인</summary><div className="order-status">{game.blue.filter(u=>u.id!==game.playerId&&(activeOrder(game,u)||u.shopRequest)).map(u=><div key={u.id}><img src={`/assets/champions/${u.champion.id}.png`} alt=""/><span><b>{u.champion.name}</b>{activeOrder(game,u)&&<small>{orderNames[u.order!.kind]} · {u.order!.until-game.time}초</small>}{u.shopRequest&&<small>{itemMap[u.shopRequest.itemId]?.name} · {u.shopRequest.status==='fulfilled'?'구매 완료':'구매 대기'}</small>}</span></div>)}</div></details>
 <small className="chat-help">로컬 게임 속 AI 채팅입니다. 답장 없이 따르거나 무시할 수 있습니다. 무리한 진입에는 미아핑이 찍힐 수 있습니다. 전투 오더는 24초간 판단에 반영됩니다.</small>
 </section>;
}
