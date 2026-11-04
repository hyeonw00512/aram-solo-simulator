import type {Game} from '../engine/types';
import {usePortal,walkFromBase} from '../engine/portal';
import {GameDialog,DialogHeading} from './GameDialog';
export function RespawnPrompt({game,update,onShop,open=true,onMinimize=()=>{}}:{game:Game;update:(op:(g:Game)=>void)=>void;onShop:()=>void;open?:boolean;onMinimize?:()=>void}){
 if(!game.respawnPrompt||!game.blue[0].alive||!game.blue[0].atFountain||game.phase!=='playing')return null;
 const shop=(route:'portal'|'walk')=>{update(g=>{g.shopReturn=route});onShop()};
 return <GameDialog open={open} label="부활 후 복귀 선택" className="respawn-window" onMinimize={onMinimize}>
  <DialogHeading eyebrow="RESPAWN · 전장 복귀" title="포탈을 타고 진입하시겠습니까?" onMinimize={onMinimize}/>
  <div className="game-dialog-body"><div className="respawn-champion"><img src={`/assets/champions/${game.blue[0].champion.id}.png`} alt=""/><div><strong>{game.blue[0].champion.name} 부활</strong><p>선택할 때까지 우물에서 대기합니다. 경기와 팀원들의 전투는 계속 진행됩니다.</p></div></div><div className="respawn-options"><button className="primary" onClick={()=>update(g=>{usePortal(g)})}>예 · 포탈 진입</button><button onClick={()=>update(g=>{walkFromBase(g)})}>아니오 · 걸어서 복귀</button><button onClick={()=>shop('portal')}>아이템 구매 후 포탈</button><button onClick={()=>shop('walk')}>아이템 구매 후 걸어서 복귀</button></div></div>
 </GameDialog>;
}
