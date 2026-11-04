import {visibleTarget} from './evelynn';
import type {Game,Unit,Reaction} from './types';
import {available} from './runtime';
import {statsFor} from './stats';
export const playStyles=[
 {id:'balanced',name:'균형',text:'사거리와 체력을 보며 교환 · 체력 30% 이하면 후퇴',retreat:.3,gap:0,mode:'balanced'},
 {id:'aggressive',name:'공격적',text:'거리를 좁혀 먼저 진입 · 체력 20%까지 교전',retreat:.2,gap:-5,mode:'engage'},
 {id:'defensive',name:'수비적',text:'아군 포탑 앞에서 받아치기 · 체력 45%면 후퇴',retreat:.45,gap:4,mode:'defend'},
 {id:'suspicious',name:'의심병환자',text:'주변 아군 수가 부족하면 호응을 기다림 · 혼자 돌진하지 않음',retreat:.4,gap:5,mode:'suspicious'},
 {id:'coward',name:'쫄보',text:'체력 70%부터 물러남 · 돌진 없이 최대 거리 유지',retreat:.7,gap:7,mode:'safe'},
 {id:'poke',name:'포킹 집중',text:'스킬 최대 거리에서 견제 · 돌진과 궁극기는 아낌',retreat:.4,gap:5,mode:'poke'},
 {id:'peel',name:'아군 보호',text:'체력이 낮은 아군 곁에서 그 아군에 가까운 적을 견제',retreat:.35,gap:2,mode:'peel'},
 {id:'chase',name:'킬 추격',text:'근처 적 중 체력이 낮은 적을 우선 추격 · 체력 25%면 후퇴',retreat:.25,gap:-3,mode:'chase'},
 {id:'farm',name:'성장 우선',text:'근처 미니언 정리 우선 · 적이 붙으면 반격',retreat:.45,gap:3,mode:'farm'},
 {id:'siege',name:'철거 우선',text:'아군 미니언이 도착하면 포탑 압박 · 없으면 라인 정리',retreat:.35,gap:0,mode:'siege'},
 {id:'counter',name:'역습 대기',text:'아군 쪽으로 들어온 적만 공격 · 먼저 돌진하지 않음',retreat:.4,gap:3,mode:'counter'},
 {id:'group',name:'뭉쳐 다니기',text:'가장 가까운 아군과 간격 유지 · 고립되면 전진 중단',retreat:.4,gap:2,mode:'group'},
] as const;
export const styleFor=(u:Unit)=>playStyles.find(s=>s.id===u.playStyle)??playStyles[0];
export function setPlayStyle(g:Game,id:string){
 if(g.phase==='finished'||!playStyles.some(s=>s.id===id))return false;
 const u=g.blue[0];u.playStyle=id;u.tacticalReason='다음 행동부터 적용';return true;
}
// Only the player's routine autopilot uses these preferences. Explicit encounter choices win.
export function tacticalPlan(g:Game,u:Unit,defaultEnemy:Unit|undefined,context:{own:{position:number};tower:{position:number};wave:boolean},minionPosition?:number){
 const style=styleFor(u),s=statsFor(u),back=u.team==='blue'?-1:1;
 const friends=g[u.team].filter(t=>t.id!==u.id&&available(t)),enemies=g[u.team==='blue'?'red':'blue'].filter(t=>available(t)&&visibleTarget(g,t));
 const nearby=enemies.filter(t=>Math.abs(t.position-u.position)<=32);
 let target=defaultEnemy,goal:number|undefined,reason:string=style.text,attack=true,prioritizeWave=false;
 const hurt=[...friends].sort((a,b)=>a.health/a.maxHealth-b.health/b.maxHealth)[0];
 if(style.mode==='chase')target=[...nearby].sort((a,b)=>a.health/a.maxHealth-b.health/b.maxHealth)[0]??target;
 if(style.mode==='peel'&&hurt){target=[...nearby].sort((a,b)=>Math.abs(a.position-hurt.position)-Math.abs(b.position-hurt.position))[0]??target;goal=hurt.position+back*3;reason=`${hurt.champion.name} 곁에서 보호`;}
 const gap=style.mode==='poke'?28:Math.max(3,Math.min(style.mode==='engage'||style.mode==='chase'?12:22,s.attackRange+style.gap));
 goal??=target?target.position+back*gap:undefined;
 if(style.mode==='defend'||style.mode==='counter'){goal=context.own.position-back*8;reason='아군 포탑 앞에서 받아칠 거리 유지';if(style.mode==='counter')attack=!!target&&(target.position-context.own.position)*back>=-20;}
 if(style.mode==='group'){const friend=[...friends].sort((a,b)=>Math.abs(a.position-u.position)-Math.abs(b.position-u.position))[0];goal=friend?.position??context.own.position;reason=friend?`${friend.champion.name}와 합류 유지`:'아군 합류 대기';}
 if(style.mode==='suspicious'&&friends.filter(t=>Math.abs(t.position-u.position)<22).length<Math.max(1,nearby.length)){goal=context.own.position+back*3;reason='근처 아군 수가 부족해 호응을 기다림';}
 if(style.mode==='farm'||style.mode==='siege'){prioritizeWave=minionPosition!==undefined&&(!target||Math.abs(target.position-u.position)>8);goal=prioritizeWave?minionPosition:goal;reason=prioritizeWave?'미니언 정리 우선':reason;if(style.mode==='siege'&&context.wave&&(!target||Math.abs(target.position-u.position)>12)){goal=context.tower.position+back*s.attackRange;prioritizeWave=true;reason='아군 미니언과 포탑 압박';}}
 const retreat=u.health/u.maxHealth<style.retreat;
 if(retreat){goal=context.own.position+back*6;reason=`체력 ${Math.round(u.health/u.maxHealth*100)}% · ${style.name} 후퇴 기준`;}
 // All presets respect a turret without an allied wave.
 if(goal!==undefined&&!context.wave&&(goal-context.tower.position)*back<16)goal=context.tower.position+back*16;
 const allowDash=!retreat&&['engage','chase','balanced'].includes(style.mode);
 const action:Reaction=style.mode==='engage'?'engage':style.mode==='chase'?'chase':'poke';
 return {target,goal,reason,attack,prioritizeWave,allowDash,holdUltimate:style.mode==='poke',action};
}
