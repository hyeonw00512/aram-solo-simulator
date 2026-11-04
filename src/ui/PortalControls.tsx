import type {Game} from '../engine/types';
import {nearPortal,portalReason,usePortal,walkFromBase} from '../engine/portal';
import config from '../../data/portal.json';
export function PortalControls({game,update}:{game:Game;update:(op:(g:Game)=>void)=>void}) {
 const player=game.blue[0],reason=portalReason(game),transit=player.portal;
 if(game.phase==='pick'||game.phase==='swap'||game.phase==='finished')return null;
 const left=player.atFountain?Math.max(0,config.playerAutoSeconds-(game.time-(player.fountainSince??game.time))):0;
 return <section className={`portal-controls ${transit?'travelling':''}`} aria-label="포탈 합류"><div className="portal-symbol" aria-hidden="true">⟐</div><div><strong>{transit?'포탈로 합류 중':!player.alive?'부활 후 포탈 이용 가능':'기지 포탈'}</strong><p>{transit?`전방 포탑 도착까지 ${Math.max(0,transit.arriveAt-game.time)}초` : player.alive&&player.atFountain&&nearPortal(player)&&game.phase==='playing'?`구매 후 포탈 또는 도보로 합류하세요 · ${player.holdAtBase?"우물 대기 중":`${left}초 후 자동 탑승`}`:!player.alive?`부활까지 ${Math.max(0,Math.ceil(player.respawnAt-game.time))}초 · 사망 중 상점 이용 가능`:'기지 → 아군 전방 포탑 · 이동 중에는 공격하지 않습니다'}</p></div><div className="portal-control-buttons"><button disabled={!!reason} title={reason??'기지 포탈로 전방 포탑에 합류합니다'} onClick={()=>update(g=>{usePortal(g)})}>포탈로 합류</button>{player.alive&&player.atFountain&&game.phase==='playing'&&!transit&&<button onClick={()=>update(g=>{walkFromBase(g)})}>걸어서 합류</button>}</div></section>;
}
