export * from './combat-v4';
import type {Game} from './types';
import {allUnits,state,hasAugment} from './runtime';
import {rollScientist} from './augments';
import {resetAugmentCombat} from './augment-effects';
import {refreshStats,statsFor} from './stats';
import {aiShopping} from './shop';
import {log,grantShield} from './combat-v4';
import {spawnPosition} from './map-layout';
export function respawn(game:Game){
 for(const unit of allUnits(game))if(!unit.alive&&unit.respawnAt<=game.time){
  unit.forge=undefined;state(unit).procs.aatroxPassive=game.time;unit.alive=true;unit.returningToBase=false;unit.holdAtBase=unit.id===game.playerId;unit.shopUnlocked=true;unit.atFountain=true;unit.fountainSince=game.time;unit.portal=undefined;
  const r=state(unit);r.effects=[];r.nextAttack=game.time;r.procs['ultimate-recast']=game.time;r.counters.growthHp=0;r.counters.wasShade=0;r.counters.qRecasts=0;r.counters.empoweredE=0;
  resetAugmentCombat(unit);
  for(const key of Object.keys(r.counters))if(key.startsWith('bleed:')||key.startsWith('plasma:')||['combatSeconds','magicHits','attacks','tornado','ultShots','souls'].includes(key))r.counters[key]=0;
  if(hasAugment(unit,'미친 과학자'))rollScientist(game,unit);
  refreshStats(unit,true);r.mana=statsFor(unit).mana;r.energy=statsFor(unit).energy;r.flow=0;r.counters.potionCharges=2;
  if(hasAugment(unit,'전술적 대비')){grantShield(game,unit,unit,statsFor(unit).ap*3,'tactical-shield',70);r.procs['tactical-shield']=game.time+70;}
  unit.position=spawnPosition(unit.team);unit.cooldownUntil=game.time;unit.status='우물 · 구매 가능';
  if(unit.id!==game.playerId)aiShopping(game,unit);else game.respawnPrompt=true;
  log(game,unit.champion.name+'이(가) 우물에서 부활했습니다.');
 }
}
