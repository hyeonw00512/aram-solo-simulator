import type {Game,Unit} from './types';
import {portalPoint} from './map-layout';
import config from '../../data/portal.json';

export const portalDestination=(team:Unit['team'],game?:Game)=>portalPoint(team,'exit',game).position;
export const nearPortal=(unit:Unit)=>unit.team==='blue'?unit.position<=config.entranceRange:unit.position>=100-config.entranceRange;
export function portalReason(game:Game,unit=game.blue[0]):string|undefined {
 if(unit.forge)return '아이템 제작 중입니다';
 if(!unit.alive)return '부활한 뒤 이용할 수 있습니다';
 if(unit.portal)return '포탈로 이동 중입니다';
 if(game.phase!=='playing')return '출발 또는 현재 선택을 완료한 뒤 이용할 수 있습니다';
 if(!nearPortal(unit))return '기지 포탈 입구 근처에서만 이용할 수 있습니다';
 if((unit.portalReadyAt??0)>game.time)return `포탈 재사용까지 ${unit.portalReadyAt!-game.time}초`;
}
export function usePortal(game:Game,unit=game.blue[0]) {
 if(portalReason(game,unit))return false;
 const destination=portalDestination(unit.team,game);
 unit.portal={from:unit.position,to:destination,startedAt:game.time,arriveAt:game.time+config.travelSeconds};
 unit.shopUnlocked=false;if(unit.id===game.playerId){game.respawnPrompt=false;game.shopReturn=undefined;}unit.atFountain=false;unit.returningToBase=false;unit.holdAtBase=false;unit.portalReadyAt=game.time+config.reuseSeconds;unit.status='포탈 이동 중';
 game.logs.push({time:game.time,text:`${unit.champion.name}: 기지 포탈 탑승. ${config.travelSeconds}초 후 아군 전방 포탑에 합류합니다.`,tone:'major'});
 return true;
}
export function walkFromBase(game:Game,unit=game.blue[0]) {
 if(game.phase!=='playing'||!unit.alive||unit.portal||unit.forge||!unit.atFountain)return false;
 unit.shopUnlocked=false;if(unit.id===game.playerId){game.respawnPrompt=false;game.shopReturn=undefined;}unit.atFountain=false;unit.returningToBase=false;unit.holdAtBase=false;unit.status='걸어서 합류';
 // Move away from the entrance so the normal marching loop takes over.
 unit.position+=unit.team==='blue'?config.walkStep:-config.walkStep;
 game.logs.push({time:game.time,text:`${unit.champion.name}: 포탈 대신 걸어서 전장에 복귀합니다.`});return true;
}
export function advancePortals(game:Game) {
 for(const unit of [...game.blue,...game.red]){
  const transit=unit.portal;
  if(transit){
   if(!unit.alive){unit.portal=undefined;continue;}
   transit.to=portalDestination(unit.team,game);
   const progress=Math.max(0,Math.min(1,(game.time-transit.startedAt)/(transit.arriveAt-transit.startedAt)));
   unit.position=transit.from+(transit.to-transit.from)*progress;
   if(game.time>=transit.arriveAt){unit.position=transit.to;unit.portal=undefined;unit.status='포탈 도착 · 합류';game.logs.push({time:game.time,text:`${unit.champion.name}: 포탈에서 내려 전방 포탑에 합류했습니다.`,tone:'major'});}
   continue;
  }
  if(unit.alive&&unit.atFountain&&nearPortal(unit)){
   unit.fountainSince??=game.time;
   if(unit.id!==game.playerId)usePortal(game,unit);
  }
 }
}
