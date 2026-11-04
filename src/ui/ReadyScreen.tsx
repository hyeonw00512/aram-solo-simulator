import {AbyssScenery} from './AbyssScenery';
import './ready-screen.css';

export function ReadyScreen({canResume,onAccept,onResume}:{canResume:boolean;onAccept:()=>void;onResume:()=>void}){
 return <main className="ready-screen" aria-label="게임 시작">
  <div className="ready-scenery" aria-hidden="true"><svg viewBox="0 0 900 560" preserveAspectRatio="xMidYMid slice"><AbyssScenery/></svg></div>
  <header className="ready-brand"><span>증바람</span><small>HOWLING ABYSS · SOLO</small></header>
  <section className="ready-card" aria-labelledby="ready-title">
   <span className="ready-eyebrow">칼바람 나락 · 아수라장</span>
   <div className="ready-emblem" aria-hidden="true"><div><span>⟡</span><small>준비 완료</small></div></div>
   <h1 id="ready-title">게임을 시작하시겠습니까?</h1>
   <p>당신과 아홉 명의 AI, 하나의 전장.<br/>수락하면 챔피언 선택이 시작됩니다.</p>
   <button className="ready-accept" onClick={onAccept}>수락</button>
   {canResume&&<div className="ready-resume"><p>저장된 경기가 있습니다. 수락하면 새 경기를 시작합니다.</p><button onClick={onResume}>이전 경기 이어하기</button></div>}
   <div className="ready-platforms"><span>1인 플레이</span><i>·</i><span>PC · 모바일</span></div>
  </section>
  <footer className="ready-footer">팬 제작 비공식 게임 · Riot Games와 관련이 없습니다.</footer>
 </main>;
}
