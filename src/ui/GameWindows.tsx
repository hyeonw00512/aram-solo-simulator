import type {Game} from '../engine/types';
import {GameDialog,DialogHeading} from './GameDialog';
import {BasePanel} from './BasePanel';

export function BaseWindow({game,open,update,onShop,onMinimize}:{game:Game;open:boolean;update:(op:(g:Game)=>void)=>void;onShop:()=>void;onMinimize:()=>void}){
 return <GameDialog open={open} label="기지와 복귀 선택" className="base-window" onMinimize={onMinimize}>
  <DialogHeading eyebrow="BASE · RETURN" title="기지 정비 · 전장 복귀" onMinimize={onMinimize}><p>경기는 계속 진행됩니다. 준비가 끝나면 합류 방법을 선택하세요.</p></DialogHeading>
  <div className="game-dialog-body"><BasePanel game={game} update={update} onShop={onShop}/></div>
 </GameDialog>;
}
export function ResultWindow({game,open,onMinimize,onRestart}:{game:Game;open:boolean;onMinimize:()=>void;onRestart:()=>void}){
 const u=game.blue[0];return <GameDialog open={open} label="경기 결과" className="result-window" onMinimize={onMinimize}>
  <DialogHeading eyebrow="MATCH COMPLETE" title={game.winner==='blue'?'승리':'패배'} onMinimize={onMinimize}/>
  <div className="game-dialog-body"><p>넥서스 파괴 · {Math.floor(game.time/60)}분 {game.time%60}초</p><div className="result-score"><img src={`/assets/champions/${u.champion.id}.png`} alt=""/><strong>{u.champion.name}</strong><span>{u.kills} / {u.deaths} / {u.assists}</span><span>피해량 {Math.round(u.damage).toLocaleString()}</span></div></div>
  <footer className="game-dialog-actions"><button onClick={onMinimize}>전장과 교전 기록 살펴보기</button><button className="primary" onClick={onRestart}>새 경기</button></footer>
 </GameDialog>;
}
export function RestartWindow({open,onCancel,onConfirm}:{open:boolean;onCancel:()=>void;onConfirm:()=>void}){
 return <GameDialog open={open} label="새 경기 시작 확인" className="restart-window" onMinimize={onCancel}>
  <DialogHeading eyebrow="NEW MATCH" title="새 경기를 시작할까요?" onMinimize={onCancel}/>
  <div className="game-dialog-body"><p>현재 경기 저장은 새 경기로 교체됩니다.</p></div><footer className="game-dialog-actions"><button onClick={onCancel}>현재 경기 계속하기</button><button className="primary" onClick={onConfirm}>새 경기 시작</button></footer>
 </GameDialog>;
}
