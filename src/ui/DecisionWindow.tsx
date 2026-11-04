import {GameDialog} from './GameDialog';
import type {Game} from '../engine/types';
import {chooseAugment,chooseDecision,rerollAugment} from '../engine/game';
import {augmentRerollReason} from '../engine/augment-offers';
import {AugmentGrade} from './AugmentGrade';
import {AugmentIcon} from './AugmentIcon';
import {ResourceBar} from './ResourceBar';
export function DecisionWindow({game,open,onMinimize,onSettings,update}:{game:Game;open:boolean;onMinimize:()=>void;onSettings:()=>void;update:(op:(g:Game)=>void)=>void}){
 const pending=game.pending;
 if(!pending)return null;
 return <GameDialog open={open} label={pending.title} className="decision-window" onMinimize={onMinimize}>
  <header><div><span className="eyebrow">{game.phase==='augment'?'AUGMENT SELECT':'TACTICAL DECISION'}</span><small>선택할 때까지 경기 시간 정지</small></div><button onClick={onSettings}>스킬·성향 설정</button><button onClick={onMinimize}>창 내리고 상황 살피기 <kbd>Esc</kbd></button></header>
  <h2 id="decision-window-title" tabIndex={-1}>{pending.title}</h2><p>{pending.description.replace('선택 중에도 경기는 계속 진행됩니다.','선택을 마칠 때까지 경기 시간이 멈춥니다.')}</p>
  <div className="choice-context"><span>아군 생존 {game.blue.filter(u=>u.alive).length} / 5</span><span>적군 생존 {game.red.filter(u=>u.alive).length} / 5</span><span>내 체력 {Math.ceil(game.blue[0].health)} / {game.blue[0].maxHealth}</span><ResourceBar unit={game.blue[0]}/></div>
  <div className={`choices ${game.phase==='augment'?'augment-options':''}`}>{pending.choices.map((choice,i)=><div className="choice-card" key={i}><button onClick={()=>update(g=>g.phase==='decision'?chooseDecision(g,choice.id):chooseAugment(g,choice.id))}>
   <kbd>{i+1}</kbd>{game.phase==='augment'&&<AugmentIcon id={choice.id} name={choice.label}/>}<span className="augment-card-copy"><strong>{choice.label}</strong>{choice.hint&&<small>{choice.hint}</small>}</span><span className="choice-arrow">↗</span>
  </button>{game.phase==='augment'&&<div className="augment-card-footer"><AugmentGrade champion={game.blue[0].champion.id} name={choice.label}/><button className="reroll" disabled={!!augmentRerollReason(game,i)} title={augmentRerollReason(game,i)} aria-label={`${i+1}번 증강 새로고침`} onClick={()=>update(g=>{rerollAugment(g,i)})}>{augmentRerollReason(game,i)??'↻ 새로고침 · 1회'}</button></div>}</div>)}</div>
  <p className="choice-footnote">{game.phase==='decision'?'내 선택을 보고 팀원들이 각자 판단합니다. 호응은 보장되지 않습니다.':'현재 챔피언·아이템과의 시너지를 확인하고 선택하세요.'} 창을 내려도 선택지는 유지됩니다.</p>
 </GameDialog>;
}
