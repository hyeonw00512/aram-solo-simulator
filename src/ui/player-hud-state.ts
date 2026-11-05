import type {Game,StatusEffect} from '../engine/types';
import {abilityName,rankedAbility} from '../engine/kits';
import {skillRank,skillSlots,unspentSkills} from '../engine/skill-training';
import {currentResource,resourceLabel,skillCost} from '../engine/resources';
import {statsFor} from '../engine/stats';
import {styleFor} from '../engine/tactics';
import {observable,onBattlefield} from './encounter-view';
import definitions from '../../data/encounters.json';

const effectNames:Record<StatusEffect['kind'],string>={silence:'침묵',charm:'매혹',stun:'기절',root:'속박',slow:'둔화',shield:'보호막',burn:'지속 피해','magic-shred':'마법 저항 감소','armor-shred':'방어력 감소',weaken:'공격 약화',stasis:'경직','heal-cut':'회복 감소',empower:'공격 강화',speed:'이동 가속'};

/** All HUD values are read from the simulation; rendering must not initialize it. */
export function playerHudState(game:Game){
 const unit=game.blue.find(u=>u.id===game.playerId)!;
 const stats=statsFor(unit),resource=currentResource(unit,stats.resourceMax),style=styleFor(unit);
 const activeEffects=(unit.combat?.effects??[]).filter(e=>e.until>game.time&&e.value>0);
 const effects=Object.entries(effectNames).flatMap(([kind,label])=>{
  const matches=activeEffects.filter(e=>e.kind===kind);
  return matches.length?[{kind,label,seconds:Math.ceil(Math.max(...matches.map(e=>e.until))-game.time),value:matches.reduce((sum,e)=>sum+e.value,0)}]:[];
 });
 if((unit.combat?.procs.polymorphUntil??0)>game.time)effects.unshift({kind:'polymorph',label:'변이',seconds:Math.ceil(unit.combat!.procs.polymorphUntil-game.time),value:1});
 const shield=activeEffects.filter(e=>e.kind==='shield').reduce((sum,e)=>sum+e.value,0);
 const control=effects.find(e=>['stun','charm','stasis','polymorph','silence'].includes(e.kind));
 const skills=skillSlots.map(slot=>{
  const rank=skillRank(unit,slot),ability=rankedAbility(unit,slot),cost=ability?skillCost(unit,ability):0;
  const cooldown=Math.max(0,Math.ceil((unit.combat?.ready[slot]??0)-game.time));
  let label='재사용 가능',tone='ready';
  if(!ability||!rank||slot==='R'&&unit.level<6){label=slot==='R'&&unit.level<6?'6레벨 필요':'미습득';tone='locked'}
  else if(!unit.alive){label='사망';tone='locked'}
  else if(game.phase==='finished'){label='경기 종료';tone='locked'}
  else if(cooldown){label=`${cooldown}초`;tone='cooldown'}
  else if(unit.portal||unit.atFountain||unit.returningToBase){label=unit.portal?'포탈 이동':unit.atFountain?'기지 대기':'복귀 중';tone='locked'}
  else if(unit.forge||control){label=unit.forge?'제작 중':control!.label;tone='blocked'}
  else if(activeEffects.some(e=>e.kind==='root')&&(ability.dash||ability.special==='last-caress')){label='속박';tone='blocked'}
  else if(resource<cost){label=`${resourceLabel(unit)} 부족`;tone='starved'}
  else if(unit.champion.id==='Garen'&&slot==='E'&&(unit.combat?.procs.garenSpinUntil??0)>game.time){label='회전 중';tone='blocked'}
  return {slot,name:abilityName(unit,slot),rank,maxRank:slot==='R'?3:5,cost,cooldown,label,tone};
 });
 const plan=game.encounter?.rounds.at(-1)?.plans.find(p=>p.unitId===unit.id);
 const intent=definitions.choices.find(c=>c.id===game.encounter?.intent)?.label;
 const respawn=Math.max(0,Math.ceil(unit.respawnAt-game.time));
 let action=plan?definitions.actions[plan.action]:unit.status,reason=plan?.reason??unit.tacticalReason??style.text;
 if(game.encounter&&!plan){action=intent??'교전 판단';reason='팀원들의 다음 반응을 기다립니다.'}
 if(game.phase==='decision'){action='내 판단 대기';reason=game.pending?.title??'전장 상황을 살피고 선택하세요.'}
 if(unit.returningToBase){action='기지로 복귀 중';reason='현재 복귀 명령을 따르고 있습니다.'}
 if(unit.atFountain){action=game.respawnPrompt?'복귀 방식 선택':'기지 대기';reason='포탈 또는 걸어서 전장에 합류할 수 있습니다.'}
 if(unit.portal){action=`포탈 이동 · ${Math.max(0,Math.ceil(unit.portal.arriveAt-game.time))}초`;reason='도착 후 전장에 합류합니다.'}
 if(!unit.alive){action=`부활까지 ${respawn}초`;reason='아이템을 구매하고 다음 교전을 준비하세요.'}
 if(game.phase==='finished'){action=game.winner===unit.team?'승리':'패배';reason='경기가 종료되었습니다.'}
 const nearbyEnemies=game.red.filter(u=>onBattlefield(u)&&observable(game,u)&&Math.abs(u.position-unit.position)<=32);
 const nearbyAllies=game.blue.filter(u=>onBattlefield(u)&&Math.abs(u.position-unit.position)<=32);
 const warnings:string[]=[];
 if(onBattlefield(unit)&&game.phase!=='finished'){
  if(control)warnings.push(`${control.label} ${control.seconds}초`);
  if(unit.health/Math.max(1,unit.maxHealth)<=.3)warnings.push(`체력 위험 · ${Math.round(unit.health/unit.maxHealth*100)}%`);
  if(nearbyEnemies.length>nearbyAllies.length)warnings.push(`주변 인원 열세 · 아군 ${nearbyAllies.length} / 보이는 적 ${nearbyEnemies.length}`);
 }
 const recent=game.visualEvents.filter(e=>e.to===unit.id&&game.time-e.at>=0&&game.time-e.at<=2);
 return {unit,stats,style,shield,skills,effects,action,reason,warnings,points:unspentSkills(unit),
  recentDamage:recent.filter(e=>['physical','magic','true'].includes(e.type)).reduce((sum,e)=>sum+e.amount,0),
  recentHeal:recent.filter(e=>e.type==='heal').reduce((sum,e)=>sum+e.amount,0),
  recentDodges:recent.filter(e=>e.type==='miss').length};
}
