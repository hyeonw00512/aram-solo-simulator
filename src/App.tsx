import {RespawnPrompt} from './ui/RespawnPrompt';
import {MatchupScreen} from "./ui/MatchupScreen";
import {PickLobby} from "./ui/PickLobby";
import {ReadyScreen} from './ui/ReadyScreen';
import {advancePickLobby,advanceMatchup,picking} from "./engine/pick-lobby";
import { useEffect, useRef, useState } from "react";
import { chooseAugment, chooseDecision, createGame, depart, offerAugments } from "./engine/game";
import type { Game } from "./engine/types";
import { loadGame, SAVE_KEY } from "./storage";
import { Battlefield } from "./ui/Battlefield";
import {EncounterMoment} from './ui/EncounterMoment';
import {PlayerHud} from './ui/PlayerHud';
import { Inspector, Roster } from "./ui/Roster";
import { ShopWindow } from "./ui/ShopWindow";
import {PlaySettings} from "./ui/PlaySettings";
import {DecisionWindow} from "./ui/DecisionWindow";
import {playableChampions,augments} from "./engine/data";
import {BaseWindow,ResultWindow,RestartWindow} from './ui/GameWindows';
import {GameDialog,DialogHeading} from './ui/GameDialog';
import {emptyPopups,syncPopups,openPopup,closePopup,minimizePopups,popupValid,type Popup} from './ui/popup-flow';
import {tickPlayback} from './ui/game-clock';
import {unspentSkills} from './engine/skill-training';
import { TeamChat } from "./ui/TeamChat";
import "./ui/team-base.css";
import {WorldStatus} from "./ui/WorldLayer";
import "./ui/battle-rules.css";
import definitions from "../data/encounters.json";
import "./style.css";
import "./spectator-polish.css";
import "./ui/portal-assets.css";
import "./ui/observer-layout.css";
import "./ui/game-dialog.css";
import "./ui/mobile.css";
import "./ui/encounter-moment.css";
const clock = (seconds: number) => `${String(Math.floor(seconds / 60)).padStart(2,"0")}:${String(seconds % 60).padStart(2,"0")}`;
export default function App({initialGame,saveEnabled=true,showStartScreen=initialGame===undefined}:{initialGame?:Game;saveEnabled?:boolean;showStartScreen?:boolean}) {
 const [entryGame]=useState(()=>initialGame??loadGame());
 const [sessionGame,setSessionGame]=useState(entryGame),[accepted,setAccepted]=useState(!showStartScreen);
 // The simulation is not mounted until acceptance: lobby timers, autosave and
 // match time cannot advance behind the ready screen.
 if(!accepted)return <ReadyScreen canResume={!picking(entryGame)&&entryGame.phase!=='finished'} onAccept={()=>{setSessionGame(picking(entryGame)?entryGame:createGame());setAccepted(true)}} onResume={()=>{setSessionGame(entryGame);setAccepted(true)}}/>;
 return <GameApp initialGame={sessionGame} saveEnabled={saveEnabled}/>;
}
function GameApp({initialGame,saveEnabled=true}:{initialGame:Game;saveEnabled?:boolean}) {
 const [game,setGame]=useState<Game>(()=>initialGame?structuredClone(initialGame):loadGame()),[speed,setSpeed]=useState(1),[paused,setPaused]=useState(false),[saveError,setSaveError]=useState(false),[selected,setSelected]=useState('blue-0'),[allLogs,setAllLogs]=useState(false);
 const [popups,setPopups]=useState(()=>syncPopups(emptyPopups(),game)),mapRef=useRef<HTMLDivElement>(null);
 const preparing=picking(game),player=game.blue[0],points=unspentSkills(player);
 const active=popups.active&&popupValid(popups.active,game)?popups.active:null;
 const inspected=[...game.blue,...game.red].find(u=>u.id===selected)??player;
 const update=(operation:(draft:Game)=>void)=>setGame(current=>{const draft=structuredClone(current);operation(draft);return draft});
 const open=(popup:Popup)=>setPopups(s=>openPopup(s,popup));
 const close=()=>setPopups(s=>closePopup(s,game));
 const minimize=()=>{setPopups(minimizePopups);requestAnimationFrame(()=>mapRef.current?.scrollIntoView({block:'start',behavior:'smooth'}))};
 const openSettings=()=>open('settings'),openShop=()=>open('shop');
 useEffect(()=>{setPopups(s=>syncPopups(s,game))},[game]);
 useEffect(()=>{if(game.phase==='augment'&&!game.pending)update(offerAugments)},[game.phase,!!game.pending]);
 useEffect(()=>{if(!saveEnabled)return;try{localStorage.setItem(SAVE_KEY,JSON.stringify(game));setSaveError(false)}catch{setSaveError(true)}},[game,saveEnabled]);
 useEffect(()=>{if(paused||active==='shop'||game.phase!=='playing')return;const id=window.setInterval(()=>setGame(current=>tickPlayback(current,paused,active)),1000/speed);return()=>clearInterval(id)},[paused,speed,game.phase,active]);
 useEffect(()=>{if(!picking(game))return;const timer=window.setInterval(()=>setGame(current=>{if(!picking(current))return current;const next=structuredClone(current);advancePickLobby(next);return next}),1000);return()=>clearInterval(timer)},[game.phase]);
 useEffect(()=>{if(game.phase!=="matchup")return;const timer=window.setInterval(()=>setGame(current=>{if(current.phase!=="matchup")return current;const next=structuredClone(current);advanceMatchup(next);return next}),1000);return()=>clearInterval(timer)},[game.phase]);
 useEffect(()=>{const onKey=(event:KeyboardEvent)=>{
  if(event.defaultPrevented||event.repeat||event.altKey||event.ctrlKey||event.metaKey)return;
  const typing=event.target instanceof HTMLElement&&event.target.closest('input,textarea,select,[contenteditable=true]');
  if(typing||picking(game)||game.phase==='matchup'||active==='restart')return;
  if(event.key.toLowerCase()==='p'){event.preventDefault();if(active==='shop')minimize();else openShop();return}
  if(active!=='decision')return;
  const choice=game.pending?.choices[Number(event.key)-1];if(choice){event.preventDefault();update(draft=>{if(draft.phase==='decision')chooseDecision(draft,choice.id);else if(draft.phase==='augment')chooseAugment(draft,choice.id)})}
 };window.addEventListener('keydown',onKey);return()=>window.removeEventListener('keydown',onKey)},[game.phase,game.pending,active]);
 const score=(team:Game["blue"])=>team.reduce((sum,u)=>sum+u.kills,0);
 const reset=()=>open('restart');
 const confirmReset=()=>{setGame(createGame());setPopups(emptyPopups());setPaused(false);setSelected('blue-0')};
 const visibleLogs=(allLogs?game.logs:game.logs.filter(l=>l.tone)).slice(-70).reverse();
 if(game.phase==="matchup")return <MatchupScreen game={game}/>;
 if(preparing)return <>
  <PickLobby game={game} update={update} onReset={reset}/>
  {saveError&&<p role="status" className="warning">진행을 저장하지 못했습니다.</p>}
  <RestartWindow open={active==='restart'} onCancel={close} onConfirm={confirmReset}/>
 </>;
 return <main>
  <header className="topbar"><div className="brand"><span className="brand-mark">⟡</span><div><h1>증바람 <span>관전실</span></h1><small>TEXT CHAOS · SOLO SIMULATION</small></div></div><div className="scoreboard"><span className="teal">BLUE <b>{score(game.blue)}</b></span><div><strong>{clock(game.time)}</strong><small>{game.phase==='finished'?'경기 종료':game.phase==='augment'?'증강 선택 · 시간 정지':game.phase==='decision'?'선택 대기':active==='shop'?'아이템 구매 · 시간 정지':paused?'일시정지':game.phase==='playing'?'LIVE MATCH':'경기 준비'}</small></div><span className="coral"><b>{score(game.red)}</b> RED</span></div><nav aria-label="재생 조작"><button onClick={()=>setPaused(!paused)}>{paused?"▶ 재개":"Ⅱ 정지"}</button>{[1,2,4].map(value=><button className={speed===value?"active":""} key={value} onClick={()=>setSpeed(value)}>{value}×</button>)}<button onClick={reset}>새 경기</button></nav></header>
  {saveError&&<p role="status" className="warning">브라우저 저장 공간이 부족해 진행을 저장하지 못했습니다.</p>}
  <div className="match-layout">
   <div className="stage" ref={mapRef}><div className="stage-caption"><span><i className="live-dot"/> 칼바람 나락</span><span>전장 시뮬레이션 · {game.encounter?"교전 중":game.phase==="decision"?"판단의 순간":"관전 모드"}</span></div>
    <Battlefield game={game} selected={selected} onSelect={setSelected} onUsePortal={()=>open(popupValid('respawn',game)?'respawn':'base')} onShop={openShop}/>
    <PlayerHud game={game} onSettings={openSettings} onShop={openShop} onFocus={()=>setSelected(game.playerId)}/>
    <EncounterMoment game={game}/>
    <WorldStatus game={game}/>
   </div>
   <div className="team-rosters"><Roster game={game} team="blue" selected={selected} onSelect={setSelected}/><Roster game={game} team="red" selected={selected} onSelect={setSelected}/></div>
    <section className="decision-panel match-status" hidden={game.phase!=='playing'||!!game.pending||!!game.encounter} aria-live="polite">
     {game.phase==="playing"&&<><span className="eyebrow">{game.encounter?"ENGAGEMENT IN PROGRESS":"WATCH THE BATTLE"}</span><h2>{!player.alive?`부활까지 ${Math.max(0,Math.ceil(player.respawnAt-game.time))}초`:game.encounter?`${definitions.choices.find(c=>c.id===game.encounter!.intent)?.label} · ${game.encounter.wave}/4단계`:"전장을 지켜보는 중"}</h2><p>{game.encounter?"팀원들은 성향, 이전 경험, 현재 각을 보고 각자 반응합니다.":"이동·교환이 계속 진행됩니다. 상황이 발생하면 선택지가 열립니다."}</p>{game.encounter&&<div className="reaction-strip">{game.blue.filter(u=>u.alive).map(u=><span key={u.id}><b>{u.champion.name}</b>{u.status}</span>)}</div>}</>}
    </section>
    <TeamChat game={game} update={update}/>
    <Inspector game={game} unit={inspected}/>
  </div>
  <nav className="game-action-dock" aria-label="인게임 팝업 메뉴">
   <div className="dock-player"><img src={`/assets/champions/${player.champion.id}.png`} alt=""/><span><strong>{player.champion.name}</strong><small className="gold">{player.gold}G</small></span></div>
   {game.pending&&<button className="primary attention" aria-haspopup="dialog" onClick={()=>open('decision')}>{game.phase==='augment'?'증강 선택':'분기 선택'} 다시 열기</button>}
   {popupValid('respawn',game)&&<button className="primary attention" aria-haspopup="dialog" onClick={()=>open('respawn')}>부활 · 복귀 선택</button>}
   {game.phase==='finished'&&<button className="primary" aria-haspopup="dialog" onClick={()=>open('result')}>경기 결과</button>}
   <button aria-haspopup="dialog" onClick={openShop}>{game.phase==='shop'?'출발 준비 · 아이템':'아이템 창'} <kbd>P</kbd></button>
   <button aria-haspopup="dialog" onClick={()=>open('base')}>기지 · 포탈</button>
   <button className={points?'has-points':''} aria-haspopup="dialog" onClick={openSettings}>스킬 · 성향{points>0&&<b> +{points}</b>}</button>
  </nav>
  <DecisionWindow game={game} open={active==='decision'} onMinimize={minimize} onSettings={openSettings} update={update}/>
  {game.phase==='augment'&&!game.pending&&<GameDialog open={active==='decision'} label="첫 증강 선택" onMinimize={minimize}><DialogHeading eyebrow="AUGMENT SELECT" title="증강 선택" onMinimize={minimize}/><div className="game-dialog-body"><p>선택할 증강을 준비하고 있습니다.</p><button onClick={()=>update(offerAugments)}>증강 3개 확인</button></div></GameDialog>}
  <RespawnPrompt game={game} open={active==='respawn'} update={update} onMinimize={minimize}/>
  <ShopWindow open={active==='shop'} game={game} paused={paused} update={update} onClose={close} onDecision={()=>setPopups(s=>openPopup({...s,active:null,back:s.back.filter(p=>p!=='shop'&&p!=='decision')},'decision'))} onMinimize={minimize} onDepart={()=>{update(depart);close()}}/>
  <PlaySettings game={game} open={active==='settings'} onToggle={openSettings} onClose={minimize} update={update} showToggle={false}/>
  <BaseWindow game={game} open={active==='base'} update={op=>{update(op);close()}} onShop={openShop} onMinimize={minimize}/>
  <ResultWindow game={game} open={active==='result'} onMinimize={minimize} onRestart={reset}/>
  <RestartWindow open={active==='restart'} onCancel={close} onConfirm={confirmReset}/>
  <div className="bottom-grid"><section className="journal panel"><div className="section-label"><h2>경기 타임라인</h2><label><input type="checkbox" checked={allLogs} onChange={e=>setAllLogs(e.target.checked)}/> 상세 로그</label></div><div className="log">{visibleLogs.map((line,i)=><p key={i} className={line.tone??""}><time>{clock(line.time)}</time><span>{line.text}</span></p>)}</div></section><section className="recaps panel"><h2>교전 복기</h2><p className="muted">선택 → 팀원의 판단 → 실제 결과 → 다음 교전의 신뢰</p>{!game.encounterHistory.length&&<p>첫 교전이 끝나면 팀원별 판단 근거가 기록됩니다.</p>}{[...game.encounterHistory].reverse().map(result=><details key={result.id}><summary>{result.text}</summary>{result.rounds.map(round=><div key={round.time}><h3>{clock(round.time)} · 판단 근거</h3>{round.plans.map(plan=><p key={plan.unitId}><b>{[...game.blue,...game.red].find(u=>u.id===plan.unitId)?.champion.name} · {definitions.actions[plan.action]}</b><br/>{plan.reason}{plan.misunderstood?" [진입 신호로 오해]":""}</p>)}</div>)}</details>)}</section></div>
  <footer>팬 제작 로컬 시뮬레이션 · Riot Games 비공식 · 데이터 16.21.1 · 스킬·아이템·증강은 독립 시뮬레이션 규칙입니다. <details><summary>구현 범위와 저장 안내</summary><p>챔피언 기본·성장 능력치와 아이템 능력치/가격/조합은 원본 데이터 기반입니다. {playableChampions.length}명 챔피언의 개별 스킬, {augments.length}종 선택 증강, 지원 아이템 효과와 넥서스 파괴를 적용합니다. 수치·사거리·자동 발동은 원작과 다르며, 이블린 위장은 감지 거리와 표적 제한으로 구현했으며, 자유 조작·완전한 시야와 일부 아이템은 아직 미지원입니다. v3는 새 경기로 시작하며 이전 v1/v2 저장 키는 삭제하지 않습니다.</p></details></footer>
 </main>;
}
