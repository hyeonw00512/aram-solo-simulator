import type {Game} from '../engine/types';
import {usePortal,walkFromBase} from '../engine/portal';
import {GameDialog,DialogHeading} from './GameDialog';
export function RespawnPrompt({game,update,open=true,onMinimize=()=>{}}:{game:Game;update:(op:(g:Game)=>void)=>void;open?:boolean;onMinimize?:()=>void}){
 if(!game.respawnPrompt||!game.blue[0].alive||!game.blue[0].atFountain||game.phase!=='playing')return null;
 return <GameDialog open={open} label="부활 후 복귀 선택" className="respawn-window" onMinimize={onMinimize}>
  <DialogHeading eyebrow="RESPAWN · 전장 복귀" title="어떻게 복귀하시겠습니까?" onMinimize={onMinimize}/>
  <div className="game-dialog-body"><div className="respawn-champion"><img src={`/assets/champions/${game.blue[0].champion.id}.png`} alt=""/><div><strong>{game.blue[0].champion.name} 부활</strong><p>복귀 방법을 선택하세요. 경기와 팀원들의 전투는 계속 진행됩니다.</p></div></div><div className="respawn-options"><button onClick={()=>update(g=>{walkFromBase(g)})}>걸어서 복귀</button><button className="primary" onClick={()=>update(g=>{usePortal(g)})}>포탈로 복귀</button></div></div>
 </GameDialog>;
}
