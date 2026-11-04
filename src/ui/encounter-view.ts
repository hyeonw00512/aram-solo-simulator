import type {Game,Unit} from '../engine/types';
import {camouflaged} from '../engine/evelynn';
import {ultimateReady} from '../engine/kits';

export const onBattlefield=(u:Unit)=>u.alive&&!u.atFountain&&!u.portal&&!u.returningToBase;
export const observable=(game:Game,u:Unit)=>u.team==='blue'||!camouflaged(game,u)||(u.combat?.procs.revealedUntil??0)>game.time;
const ratio=(u:Unit)=>u.health/Math.max(1,u.maxHealth);

/** Read-only presentation: never rolls an AI response or initializes combat state. */
export function tacticalSnapshot(game:Game){
 const player=game.blue.find(u=>u.id===game.playerId)!;
 const nearby=(u:Unit)=>onBattlefield(u)&&Math.abs(u.position-player.position)<=35;
 const allies=game.blue.filter(nearby),enemies=game.red.filter(u=>nearby(u)&&observable(game,u));
 const danger=[...allies].filter(u=>ratio(u)<.4).sort((a,b)=>ratio(a)-ratio(b))[0];
 const exposed=[...enemies].sort((a,b)=>a.position-b.position).find(u=>!game.red.some(other=>other.id!==u.id&&onBattlefield(other)&&observable(game,other)&&Math.abs(other.position-u.position)<16));
 const ready=allies.filter(u=>ultimateReady(u,game.time));
 const tower=game.world?.buildings.find(b=>b.alive&&b.team==='red'&&['outer','inner','nexus-tower'].includes(b.kind)&&Math.abs(b.position-player.position)<18);
 const facts:{tone:'danger'|'opportunity'|'neutral';text:string}[]=[{tone:allies.length<enemies.length?'danger':'neutral',text:`내 주변 아군 ${allies.length}명 · 보이는 적 ${enemies.length}명`}];
 if(danger)facts.push({tone:'danger',text:`${danger.champion.name} 체력 ${Math.round(ratio(danger)*100)}% · 엄호 판단 필요`});
 if(tower)facts.push({tone:'danger',text:`${tower.name} 인접 · 포탑 공격 주의`});
 if(exposed)facts.push({tone:'opportunity',text:`${exposed.champion.name} 주변 적 지원 간격이 벌어짐`});
 facts.push({tone:ready.length?'opportunity':'neutral',text:ready.length?`궁극기 준비: ${ready.map(u=>u.champion.name).join(' · ')}`:'주변 아군 중 준비된 궁극기 없음'});
 return {player,allies,enemies,danger,exposed,facts:facts.slice(0,4)};
}

export function encounterPresentation(game:Game){
 const latest=game.encounterHistory.at(-1);
 const result=!game.encounter&&game.phase!=='decision'&&latest&&game.time-(latest.rounds.at(-1)?.time??-Infinity)<=8?latest:undefined;
 const encounter=game.encounter??result;
 if(!encounter)return undefined;
 const round=encounter.rounds.at(-1),previous=encounter.rounds.at(-2);
 const members=[...game.blue,...game.red];
 const rows=(round?.plans??[]).flatMap(plan=>{
  const unit=members.find(u=>u.id===plan.unitId);
  if(!unit||(unit.team==='red'&&(round?.movements?.find(m=>m.unitId===unit.id)?.visible===false||!observable(game,unit))))return [];
  const late=previous?.plans.some(p=>p.unitId===unit.id&&p.action==='hesitate')&&['join','engage','cover'].includes(plan.action);
  return [{unit,plan,late:!!late}];
 });
 return {encounter,round,result,rows,stage:result?3:round?Math.min(2,Math.max(0,game.time-round.time)):0};
}
