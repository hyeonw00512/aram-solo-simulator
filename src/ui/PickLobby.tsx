import type {Game} from '../engine/types';
import {playableChampions} from '../engine/data';
import {cancelPickTrade,chooseBenchChampion,lockPicks,picking,requestPickTrade,respondPickTrade} from '../engine/pick-lobby';
import {AbyssScenery} from './AbyssScenery';
import './pick-lobby.css';
const roles:Record<string,string>={tank:'탱커',fighter:'전사',mage:'마법사',marksman:'원거리 딜러',support:'서포터',assassin:'암살자'};
export function PickLobby({game,update,onReset}:{game:Game;update:(op:(g:Game)=>void)=>void;onReset:()=>void}){
 const lobby=game.lobby!,player=game.blue[0],editing=picking(game)&&!lobby.locked,t=lobby.trade,partner=game.blue.find(u=>u.id===t?.partnerId);
 return <main className="pick-screen">
  <div className="pick-scenery" aria-hidden="true"><svg viewBox="0 0 900 560" preserveAspectRatio="xMidYMid slice"><AbyssScenery/></svg></div>
  <header className="pick-header"><div><span className="eyebrow">HOWLING ABYSS · SOLO</span><h1>무작위 총력전 <span>아수라장</span></h1></div><button onClick={onReset}>새 경기</button></header>
  <ol className="pick-steps" aria-label="경기 준비 단계">{['챔피언 선택','5 vs 5 조합 확인','전장 입장'].map((name,i)=><li key={name} className={(editing?0:game.phase==='augment'?1:2)===i?'current':''}><b>0{i+1}</b>{name}</li>)}</ol>
  <section className="pick-bench" aria-label="후보 챔피언"><div className="pick-section-title"><h2>후보 챔피언</h2><span>{editing?'선택하면 현재 챔피언과 교체됩니다':'챔피언 선택 완료'}</span></div><div className="bench-cards">{lobby.bench.map(id=>{const c=playableChampions.find(c=>c.id===id);return c&&<button key={id} disabled={!editing||!!t} onClick={()=>update(g=>{chooseBenchChampion(g,id)})} title={c.roles.map(r=>roles[r]).join(' · ')} aria-label={`${c.name} 선택`}><img src={`/assets/champions/${id}.png`} alt=""/><strong>{c.name}</strong><small>{c.roles.map(r=>roles[r]).join(' · ')}</small></button>})}</div></section>
  <div className="pick-main">
   <section className="pick-allies" aria-label="아군 챔피언 선택"><div className="pick-section-title"><h2>우리 팀</h2><span>5 / 5 연결됨</span></div><div className="pick-team-cards">{game.blue.map((u,i)=>{const cooldown=Math.max(0,(lobby.cooldowns[u.id]??0)-lobby.elapsed);return <article key={u.id} className={`pick-team-card ${i===0?'is-me':''}`}><span className="pick-seat">{i===0?'나':`팀원 ${i+1}`}<small>{editing?'선택 중':'픽 확정'}</small></span><div className="pick-portrait"><img src={`/assets/champions/${u.champion.id}.png`} alt={u.champion.name}/></div><h3>{u.champion.name}</h3><p>{u.champion.roles.map(r=>roles[r]).join(' · ')}</p>{i===0?<span className="my-pick-label">내 챔피언</span>:<button disabled={!editing||!!t||cooldown>0} onClick={()=>update(g=>{requestPickTrade(g,u.id)})} aria-label={`팀원 ${i+1} ${u.champion.name}에게 교환 요청`}>{cooldown?`${cooldown}초 후 재요청`:'⇄ 교환 요청'}</button>}</article>})}</div></section>
   <aside className="pick-enemies" aria-label="상대팀 비공개"><h2>상대 팀</h2>{Array.from({length:5},(_,i)=><div className="unknown-pick" key={i}><b>?</b><span>상대 {i+1}<small>챔피언 비공개</small></span><i>◇</i></div>)}<p>상대 챔피언은<br/>픽 확정 후 공개됩니다.</p></aside>
  </div>
  <div className="pick-bottom"><section className="pick-activity" aria-label="픽 변경 기록"><h2>대기실 소식</h2><div role="log" aria-live="polite">{lobby.events.slice(-4).map((e,i)=><p key={`${lobby.events.length}-${i}`}>{e}</p>)}</div></section>
   <section className="pick-action" aria-label="픽 확정과 교환">
    {t&&partner?<div className="pick-trade" role="status"><h3>{t.direction==='incoming'?'팀원의 교환 요청':'교환 응답 대기'}</h3><div className="trade-pair"><img src={`/assets/champions/${player.champion.id}.png`} alt=""/><b>{player.champion.name} ⇄ {partner.champion.name}</b><img src={`/assets/champions/${partner.champion.id}.png`} alt=""/></div>{t.direction==='incoming'?<><p>팀원 {Number(partner.id.split('-')[1])+1} · 교환을 요청했습니다. {Math.max(0,t.resolveAt-lobby.elapsed)}초 남음</p><div className="button-row"><button className="primary" onClick={()=>update(g=>{respondPickTrade(g,true)})}>교환 수락</button><button onClick={()=>update(g=>{respondPickTrade(g,false)})}>교환 거절</button></div></>:<><p>팀원이 자신의 선호와 팀 조합을 보고 결정합니다.</p><button onClick={()=>update(cancelPickTrade)}>요청 취소</button></>}</div>:<><h2>{editing?'준비되셨나요?':game.phase==='augment'?'첫 증강 선택':'출발 준비'}</h2><p>{editing?'팀원도 후보 챔피언을 선택하거나 교환을 요청합니다. 내 픽을 확정하면 팀 전체 선택이 마감됩니다.':game.phase==='augment'?'선택한 챔피언에 어울리는 증강을 고르세요.':'아이템을 구매하고 칼바람 나락으로 출발하세요.'}</p></>}
    <button className="primary lock-pick" disabled={!!t||!editing} onClick={()=>update(g=>{lockPicks(g)})}>픽 확정 · 조합 확인 →</button>
    <p className="pick-next-note">양 팀 조합을 7초간 확인한 뒤 전장에 입장합니다. 증강과 아이템은 인게임에서 준비합니다.</p>
   </section></div>
  <footer>팬 제작 칼바람 픽창 · 지원 챔피언 {playableChampions.length}명 · 양 팀과 후보에 중복 챔피언 없음</footer>
 </main>;
}
