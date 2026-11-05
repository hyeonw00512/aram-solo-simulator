import {skillRank} from './skill-training';
import {castFighterWave,fighterCannotAttack} from './fighter-skills';
import {tacticalPlan} from './tactics';
import {currentResource,skillCost,spendResource} from './resources';
import {visibleTarget} from './evelynn';
import type {Game,Unit,Building,Minion} from './types';
import {statsFor,buildIdentity} from './stats';
import {state,available,allUnits,blocked,effect} from './runtime';
import {applyDamage,resolveAttack,log, supportTurn} from './combat-v4';
import {kitFor,abilityName,ultimateReady} from './kits';
import {activeOrder,focusTarget,expireFocusOrders} from './team-chat';
import {Rng} from './rng';
import {landmark,MAP_LAYOUT_VERSION,portalPoint} from './map-layout';
import {awardMinionExperience} from './progression';
export function ensureWorld(g:Game){
 if(g.world?.layoutVersion===MAP_LAYOUT_VERSION)return g.world;
 const buildings:Building[]=[];
 for(const team of ['blue','red'] as const)for(const [kind,name,key,hp,offset] of [
  ['outer','외곽 포탑','outer',2600,-22],['inner','안쪽 포탑','inner',2400,-15],['inhibitor','억제기','inhibitor',1800,0],
  ['nexus-tower','넥서스 포탑 A','nexusA',2000,-38],['nexus-tower','넥서스 포탑 B','nexusB',2000,38],['nexus','넥서스','nexus',3500,0],
 ] as const)buildings.push({id:team+'-'+kind+offset,team,kind,name,...landmark(team,key),health:hp,maxHealth:hp,alive:true,nextAttack:0});
 if(g.world){
  // Preserve identities, destruction, health, aggro and wave timers in old saves.
  for(const b of g.world.buildings){const next=buildings.find(n=>n.id===b.id);if(next){b.position=next.position;b.laneOffset=next.laneOffset;}}
  g.world.layoutVersion=MAP_LAYOUT_VERSION;
  for(const u of [...g.blue,...g.red])if(u.portal)u.portal.to=portalPoint(u.team,'exit',g).position;
 }else g.world={layoutVersion:MAP_LAYOUT_VERSION,buildings,minions:[],wave:0,nextWave:g.time+3,serial:0};
 return g.world;
}
export const frontline=(g:Game,team:Unit['team'])=>ensureWorld(g).buildings.find(b=>b.team===team&&b.alive&&b.kind!=='inhibitor'&&b.kind!=='nexus')??ensureWorld(g).buildings.find(b=>b.team===team&&b.kind==='nexus')!;
export function structureUnlocked(g:Game,b:Building){
 const alive=ensureWorld(g).buildings.filter(t=>t.team===b.team&&t.alive);
 if(b.kind==='outer')return true;
 if(b.kind==='inner')return !alive.some(t=>t.kind==='outer');
 if(b.kind==='inhibitor')return !alive.some(t=>t.kind==='outer'||t.kind==='inner');
 if(b.kind==='nexus-tower')return !alive.some(t=>['outer','inner','inhibitor'].includes(t.kind));
 return !alive.some(t=>t.kind!=='nexus');
}
export const alliedWaveAt=(g:Game,team:Unit['team'],position:number)=>ensureWorld(g).minions.some(m=>m.team===team&&m.health>0&&Math.abs(m.position-position)<16);
export function damageBuilding(g:Game,b:Building,amount:number,sourceTeam:Unit['team']){
 if(g.phase==='finished'||!b.alive||b.team===sourceTeam||!structureUnlocked(g,b))return 0;
 const siege=alliedWaveAt(g,sourceTeam,b.position),dealt=Math.min(b.health,Math.round(amount*(siege?1:.1)));
 b.health-=dealt;if(b.health>0)return dealt;
 b.alive=false;b.targetId=undefined;if(b.kind==='inhibitor')b.respawnAt=g.time+180;
 for(const u of g[sourceTeam])u.gold+=b.kind==='nexus'?0:100;
 log(g,(b.team==='blue'?'아군 ':'적 ')+b.name+' 파괴'+(b.kind==='inhibitor'?' · 슈퍼 미니언 출현':''),'major');
 if(b.kind==='nexus'){g.phase='finished';g.winner=sourceTeam;g.pending=undefined;g.encounter=undefined;log(g,'넥서스 파괴 — '+(sourceTeam==='blue'?'승리!':'패배.'),'major');}
 return dealt;
}
function spawnWave(g:Game){
 const w=ensureWorld(g);w.wave++;w.nextWave=g.time+20;
 for(const team of ['blue','red'] as const){
  const superWave=w.buildings.some(b=>b.team!==team&&b.kind==='inhibitor'&&!b.alive);
  const kinds:Minion['kind'][]=['melee','melee','melee','caster','caster','caster'];
  if(w.wave%3===0)kinds.push('cannon');if(superWave)kinds.push('super');
  const growth=1+g.time/400;
  kinds.forEach((kind,i)=>{const hp=(kind==='super'?950:kind==='cannon'?600:kind==='melee'?300:180)*growth;
   w.minions.push({id:'m'+ ++w.serial,team,kind,position:landmark(team,'barracks').position+(team==='blue'?-1:1)*i*.45,health:hp,maxHealth:hp,damage:(kind==='super'?90:kind==='cannon'?45:kind==='melee'?24:30)*growth,range:kind==='caster'||kind==='cannon'?9:2,nextAttack:0});});
 }
}
function moveToward(position:number,target:number,speed:number){return Math.max(0,Math.min(100,position+Math.sign(target-position)*Math.min(Math.abs(target-position),speed)));}
export function strategicContext(g:Game,u:Unit){
 const enemyTeam=u.team==='blue'?'red':'blue',tower=frontline(g,enemyTeam),own=frontline(g,u.team),team=g[u.team].filter(available);
 const nearEnemyTower=tower.kind!=='nexus'&&Math.abs(u.position-tower.position)<14;
 const wave=alliedWaveAt(g,u.team,tower.position);
 const threat=ensureWorld(g).minions.filter(m=>m.team!==u.team&&Math.abs(m.position-own.position)<20).length;
 const ready=team.filter(t=>ultimateReady(t,g.time)).length;
 return {tower,own,nearEnemyTower,wave,threat,ready,teamCount:team.length};
}
export function advanceWorld(g:Game,combat=true){
 const w=ensureWorld(g);if(g.phase!=='playing')return;
 expireFocusOrders(g);
 for(const b of w.buildings)if(!b.alive&&b.kind==='inhibitor'&&(b.respawnAt??Infinity)<=g.time){b.alive=true;b.health=b.maxHealth;log(g,(b.team==='blue'?'아군':'적')+' 억제기 재생','major');}
 if(g.time>=w.nextWave)spawnWave(g);
 const rng=new Rng(g.seed+g.time*1949),fighters=allUnits(g).filter(available),minionDamage=new Map<string,number>();
 for(const m of w.minions.filter(m=>m.health>0)){
  if(g.winner)return;
  const opponents=w.minions.filter(t=>t.team!==m.team&&t.health>0).sort((a,b)=>Math.abs(a.position-m.position)-Math.abs(b.position-m.position));
  const enemy=opponents[0],champ=fighters.filter(t=>t.team!==m.team&&visibleTarget(g,t)).sort((a,b)=>Math.abs(a.position-m.position)-Math.abs(b.position-m.position))[0];
  const b=w.buildings.find(t=>t.team!==m.team&&t.alive&&structureUnlocked(g,t));
  const target=enemy&&Math.abs(enemy.position-m.position)<=m.range?enemy:champ&&Math.abs(champ.position-m.position)<=m.range?champ:b&&Math.abs(b.position-m.position)<=m.range?b:undefined;
  if(target&&m.nextAttack<=g.time){m.nextAttack=g.time+2;
   if('kind' in target&&'maxHealth' in target&&!('champion' in target)){if('nextAttack' in target&&target.id.startsWith('m'))minionDamage.set(target.id,(minionDamage.get(target.id)??0)+m.damage);else damageBuilding(g,target as Building,m.damage,m.team);}
   else applyDamage(g,undefined,target as Unit,m.damage,'미니언 공격');
  }else if(!target){const goal=enemy?.position??champ?.position??b?.position??(m.team==='blue'?100:0);m.position=moveToward(m.position,goal,.85);}
 }
 for(const m of w.minions){m.health=Math.max(0,m.health-(minionDamage.get(m.id)??0));awardMinionExperience(g,m);}
 const order=[...fighters];for(let i=order.length-1;i>0;i--){const j=rng.int(i+1);[order[i],order[j]]=[order[j],order[i]]}
 for(const u of order){
  if(g.winner)return;
  if(!available(u)||blocked(u))continue;
  const s=statsFor(u),r=state(u),context=strategicContext(g,u);
  let enemy=fighters.filter(t=>t.team!==u.team&&available(t)&&visibleTarget(g,t)).sort((a,b)=>Math.abs(a.position-u.position)-Math.abs(b.position-u.position))[0];
  const opposing=w.minions.filter(m=>m.team!==u.team&&m.health>0).sort((a,b)=>Math.abs(a.position-u.position)-Math.abs(b.position-u.position));
  const minion=opposing[0],building=w.buildings.find(b=>b.team!==u.team&&b.alive&&structureUnlocked(g,b));
  const role=buildIdentity(u),intent=g.encounter&&u.id===g.playerId?g.encounter.intent:undefined;
  const order=activeOrder(g,u);
  enemy=focusTarget(g,u)??enemy;
  const tactic=u.id===g.playerId&&!g.encounter?tacticalPlan(g,u,enemy,context,minion?.position):undefined;
  if(tactic){enemy=tactic.target!;u.tacticalReason=tactic.reason;}
  else if(u.id===g.playerId&&g.encounter)u.tacticalReason='분기점에서 직접 선택한 행동 진행 중';
  if(!g.encounter&&!u.returningToBase&&!effect(u,'root')){
   let goal=enemy?enemy.position+(u.team==='blue'?-1:1)*(role.role==='tank'?6:Math.min(22,s.attackRange)):minion?.position??building?.position??50;
   if(healthRatioLocal(u)<.3)goal=context.own.position+(u.team==='blue'?-5:5);
   else if(context.nearEnemyTower&&!context.wave&&role.role!=='tank')goal=context.tower.position+(u.team==='blue'?-17:17);
   else if(context.threat>3)goal=minion?.position??context.own.position;
   if(tactic?.goal!==undefined)goal=tactic.goal;
   if(order?.kind==='retreat'||order?.kind==='defend')goal=context.own.position+(u.team==='blue'?-4:4);
   if(order?.kind==='group')goal=g[u.team][0].alive?g[u.team][0].position:context.own.position;
   if((order?.kind==='engage'||order?.kind==='focus')&&enemy&&healthRatioLocal(u)>.35)goal=enemy.position+(u.team==='blue'?-1:1)*(order.kind==='focus'?Math.max(6,Math.min(22,s.attackRange)):6);
   if(order?.kind==='clear')goal=minion?.position??context.own.position;
   u.position=moveToward(u.position,goal,s.moveSpeed/325*1.2);
  }
  if(!combat)continue;
  const aiPlan=g.encounter?.rounds.at(-1)?.plans.find(p=>p.unitId===u.id)?.action;
  const prioritizeWave=tactic?.prioritizeWave||order?.kind==='clear'||order?.kind==='defend'||intent==='push'||intent==='clear'||aiPlan==='clear'||aiPlan==='push'||(!tactic&&!g.encounter&&context.threat>2);
  if(enemy&&Math.abs(enemy.position-u.position)<=32&&!prioritizeWave){if(!g.encounter){supportTurn(g,u,rng,tactic);if(tactic?.attack!==false)resolveAttack(g,u,enemy,rng,{action:tactic?.action??(role.role==='tank'?'engage':'poke'),allowDash:tactic?.allowDash,holdUltimate:tactic?.holdUltimate});}continue;}
  if(g.encounter&&intent&&['retreat','wait','regroup','healthpack'].includes(intent))continue;
  if(fighterCannotAttack(g,u))continue;
  if(minion&&Math.abs(minion.position-u.position)<=Math.max(14,s.attackRange)){
   const spell=!effect(u,'silence')?kitFor(u).find(a=>a.kind==='damage'&&skillRank(u,a.slot)>0&&a.slot!=='R'&&a.area&&(r.ready[a.slot]??0)<=g.time&&currentResource(u,s.resourceMax)>=skillCost(u,a)):undefined;
   if(spell&&castFighterWave(g,u,minion,spell))continue;
   if(spell){r.ready[spell.slot]=g.time+spell.cd/(1+s.haste/100);spendResource(u,skillCost(u,spell));r.lastCast=spell.slot;r.procs.spellblade=g.time+6;
    for(const m of opposing.filter(m=>m.health>0&&Math.abs(m.position-minion.position)<(spell.area??5))){m.health=Math.max(0,m.health-(spell.base+spell.growth*u.level+spell.ap*s.ap+(spell.ad??0)*s.ad+(spell.armor??0)*s.armor));if(!m.health){u.gold+=18;awardMinionExperience(g,m,u);if(u.champion.id==='Veigar')r.counters.permanentAp=(r.counters.permanentAp??0)+1;}}
    u.status=abilityName(u,spell.slot)+' · 라인 정리';
   }else if(r.nextAttack<=g.time){r.nextAttack=g.time+1/s.attackSpeed;minion.health=Math.max(0,minion.health-s.ad*(u.items.includes('3181')?1.3:1)-(u.items.includes('1120')?5:0));if(!minion.health){u.gold+=18;awardMinionExperience(g,minion,u);}u.status='미니언 정리';}
  }else if(building&&Math.abs(building.position-u.position)<=s.attackRange+3&&r.nextAttack<=g.time){
   r.nextAttack=g.time+1/s.attackSpeed;damageBuilding(g,building,(s.baseAd+Math.max(s.ad-s.baseAd,s.ap*.6))*(u.items.includes('3181')?1.5:1),u.team);u.status=building.name+' 공격';
  }else if(!enemy&&!g.encounter)u.status='미니언과 전진';
 }
 if(g.winner)return;
 // Towers fire at enemy champions who attack under them, otherwise at minions.
 for(const b of w.buildings.filter(b=>b.alive&&['outer','inner','nexus-tower'].includes(b.kind))){
  if(b.nextAttack>g.time)continue;
  const champs=allUnits(g).filter(u=>available(u)&&u.team!==b.team&&Math.abs(u.position-b.position)<14);
  const aggro=champs.find(u=>u.id===b.targetId&&(b.aggroUntil??0)>g.time);
  const m=w.minions.find(m=>m.team!==b.team&&m.health>0&&Math.abs(m.position-b.position)<14);
  if(aggro||!m&&champs.length){const t=aggro??champs[0];applyDamage(g,undefined,t,160+g.time*.1,'적 포탑의 반격');b.nextAttack=g.time+2;}
  else if(m){m.health=Math.max(0,m.health-200-g.time*.08);awardMinionExperience(g,m);b.nextAttack=g.time+2;}
 }
 w.minions=w.minions.filter(m=>m.health>0);
}
const healthRatioLocal=(u:Unit)=>u.health/Math.max(1,u.maxHealth);
