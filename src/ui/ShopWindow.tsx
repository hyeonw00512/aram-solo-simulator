import {GameDialog} from './GameDialog';
import type {Game} from '../engine/types';
import {portalReason,usePortal,walkFromBase} from '../engine/portal';
import {Shop} from './Shop';
import './shop-window.css';

export function ShopWindow({open,game,paused,update,onClose,onDepart,onMinimize=onClose,onDecision=onClose}:{open:boolean;game:Game;paused:boolean;update:(op:(g:Game)=>void)=>void;onClose:()=>void;onDepart:()=>void;onMinimize?:()=>void;onDecision?:()=>void}) {
 const player=game.blue[0];
 const waiting=game.phase==='decision'||game.phase==='augment';
 const selectionPauses=waiting;
 const time=`${String(Math.floor(game.time/60)).padStart(2,'0')}:${String(game.time%60).padStart(2,'0')}`;
 const status=game.phase==='finished'?'경기 종료':game.phase==='shop'?'출발 준비':selectionPauses?'선택 대기 · 시간 정지':open?'아이템 구매 · 시간 정지':paused?'경기 일시정지':game.phase==='playing'?'경기 진행 중':'경기 준비';
 return <GameDialog open={open} className="shop-window" label="아이템 창" onMinimize={onMinimize} focusSelector='input[type="search"]'>
  <header className="shop-window-bar"><div className="shop-window-player"><img src={`/assets/champions/${player.champion.id}.png`} alt=""/><div><strong>{player.champion.name} <small>Lv.{player.level}</small></strong><span>{time} · {status}</span></div></div><button className="shop-return" onClick={onMinimize}>창 내리고 전장 보기 <kbd>Esc</kbd></button></header>
  {waiting&&<div className="shop-match-alert" role="status"><span>{game.phase==='decision'?'전장에서 판단을 기다리고 있습니다.':'증강을 선택할 차례입니다.'}</span><button onClick={onDecision}>선택하러 돌아가기 →</button></div>}
  <Shop game={game} update={update}/>
  <footer className="shop-window-footer"><span>아이템 창 <kbd>P</kbd> · 닫기 <kbd>Esc</kbd><small>상점을 열어둔 동안 경기 시간이 멈춥니다. 창을 닫으면 재개됩니다.</small></span>{game.phase==='shop'?<button className="primary" onClick={onDepart}>구매 완료 · 포탈로 출발 →</button>:game.shopReturn==='walk'&&game.phase==='playing'&&player.alive&&player.atFountain?<button className="primary" onClick={()=>{update(g=>{walkFromBase(g)});onClose()}}>구매 완료 · 걸어서 복귀 →</button>:!portalReason(game)?<button className="primary" onClick={()=>{update(g=>{usePortal(g)});onClose()}}>구매 완료 · 포탈로 합류 →</button>:<button onClick={onMinimize}>관전 화면으로 →</button>}</footer>
 </GameDialog>;
}
