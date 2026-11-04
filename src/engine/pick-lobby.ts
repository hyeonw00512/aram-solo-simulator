import type {Champion,Game,Unit} from './types';
import {playableChampions} from './data';
import {Rng} from './rng';
import {refreshStats} from './stats';
export const picking=(g:Game)=>g.phase==='pick'||g.phase==='swap';
export function ensurePickLobby(g:Game){
 if(!g.lobby){const used=new Set([...g.blue,...g.red].map(u=>u.champion.id));g.lobby={elapsed:0,bench:playableChampions.filter(c=>!used.has(c.id)).map(c=>c.id),serial:0,events:['아군 5명이 입장했습니다. 후보 챔피언을 선택하거나 교환을 요청하세요.'],cooldowns:{},aiChanges:{},locked:!picking(g)};}
 if(picking(g)&&!g.lobby.locked){const used=new Set([...g.blue,...g.red].map(u=>u.champion.id));for(const c of playableChampions)if(!used.has(c.id)&&!g.lobby.bench.includes(c.id))g.lobby.bench.push(c.id);}
 return g.lobby;
}
function note(g:Game,text:string){const l=ensurePickLobby(g);l.events.push(text);l.events=l.events.slice(-30);}
function resetChampion(u:Unit,champion:Champion){u.champion=champion;u.masterwork=undefined;u.forge=undefined;u.aiBuild=undefined;u.combat=undefined;u.skillRanks={Q:1,W:1,E:1,R:0};u.cooldownUntil=0;u.status='픽 준비';refreshStats(u,true);}
function exchange(g:Game,partner:Unit){const player=g.blue[0],before=player.champion;resetChampion(player,partner.champion);resetChampion(partner,before);note(g,`교환 완료 · 나는 ${player.champion.name}, 팀원 ${Number(partner.id.split('-')[1])+1}: ${partner.champion.name}`);}
const editable=(g:Game)=>picking(g)&&!ensurePickLobby(g).locked;
export function chooseBenchChampion(g:Game,id:string,unitId=g.playerId){
 if(!editable(g))return false;const l=ensurePickLobby(g),u=g.blue.find(t=>t.id===unitId),index=l.bench.indexOf(id),c=playableChampions.find(t=>t.id===id);
 if(!u||index<0||!c||[...g.blue,...g.red].some(t=>t.champion.id===id)||l.trade&&(u.id===g.playerId||u.id===l.trade.partnerId))return false;
 const old=u.champion;l.bench[index]=old.id;resetChampion(u,c);note(g,`${u.id===g.playerId?'나':`팀원 ${Number(u.id.split('-')[1])+1}`} · ${old.name} → ${c.name} 변경. ${old.name} 후보 복귀.`);return true;
}
function fit(u:Unit,c:Champion,g:Game){
 let score=0;
 if(u.traits.includes('포킹만 합니다'))score+=c.roles.includes('mage')?3:0;
 if(u.traits.includes('사립니다'))score+=c.roles.some(r=>['support','marksman','mage'].includes(r))?2:0;
 if(u.traits.includes('공격적입니다')||u.traits.includes('죽음을 두려워하지 않습니다'))score+=c.roles.some(r=>['tank','fighter','assassin'].includes(r))?2:0;
 const other=g.blue.filter(t=>t.id!==u.id);if(!other.some(t=>t.champion.roles.includes('tank'))&&c.roles.includes('tank'))score+=2;
 return score;
}
export function requestPickTrade(g:Game,partnerId:string){
 if(!editable(g))return false;const l=ensurePickLobby(g),partner=g.blue.find(u=>u.id===partnerId&&u.id!==g.playerId);
 if(!partner||l.trade||(l.cooldowns[partnerId]??0)>l.elapsed)return false;
 l.serial++;l.trade={partnerId,direction:'outgoing',playerChampion:g.blue[0].champion.id,partnerChampion:partner.champion.id,resolveAt:l.elapsed+3};
 note(g,`${partner.champion.name}에게 ${g.blue[0].champion.name} ↔ ${partner.champion.name} 교환 요청을 보냈습니다.`);return true;
}
export function respondPickTrade(g:Game,accept:boolean){
 if(!editable(g))return false;const l=ensurePickLobby(g),t=l.trade;if(!t||t.direction!=='incoming')return false;
 const partner=g.blue.find(u=>u.id===t.partnerId);if(!partner||partner.champion.id!==t.partnerChampion||g.blue[0].champion.id!==t.playerChampion){l.trade=undefined;return false;}
 if(accept)exchange(g,partner);else note(g,`${partner.champion.name}의 교환 요청을 거절했습니다.`);
 l.cooldowns[t.partnerId]=accept?l.elapsed:l.elapsed+12;l.trade=undefined;return true;
}
export function cancelPickTrade(g:Game){const l=ensurePickLobby(g);if(!editable(g)||l.trade?.direction!=='outgoing')return;note(g,'교환 요청을 취소했습니다.');l.cooldowns[l.trade.partnerId]=l.elapsed+8;l.trade=undefined;}
export function lockPicks(g:Game){if(!editable(g))return false;const l=ensurePickLobby(g);if(l.trade)return false;l.locked=true;g.phase='matchup';g.matchupRemaining=7;g.pending=undefined;note(g,'픽 확정 · 양 팀 조합 확인 후 전장에 입장합니다.');return true;}
export function advancePickLobby(g:Game){
 if(!editable(g))return;const l=ensurePickLobby(g);l.elapsed++;
 const rng=new Rng(g.seed+l.elapsed*7919+l.serial*31),t=l.trade;
 if(t&&t.direction==='outgoing'&&l.elapsed>=t.resolveAt){
  const partner=g.blue.find(u=>u.id===t.partnerId);let accepted=false;
  if(partner&&partner.champion.id===t.partnerChampion&&g.blue[0].champion.id===t.playerChampion){
   const chance=Math.max(.15,Math.min(.9,.58+(fit(partner,g.blue[0].champion,g)-fit(partner,partner.champion,g))*.1-(partner.traits.includes('고집이 셉니다')?.28:0)));
   if(rng.chance(chance)){note(g,`${partner.champion.name}: ㅇㅋ 바꾸자`);exchange(g,partner);accepted=true;}else note(g,`${partner.champion.name}: ㄴㄴ 이거 할게 (교환 거절)`);
  }else note(g,'픽이 달라져 교환 요청이 취소되었습니다.');
  l.cooldowns[t.partnerId]=accepted?l.elapsed:l.elapsed+12;l.trade=undefined;
 }
 // Each teammate considers a bench change at most twice, preventing endless churn.
 if(l.elapsed%8===0){
  const candidates=g.blue.slice(1).filter(u=>(l.aiChanges[u.id]??0)<2&&u.id!==l.trade?.partnerId);
  if(candidates.length&&l.bench.length){const u=rng.pick(candidates);const options=l.bench.map(id=>playableChampions.find(c=>c.id===id)!).filter(Boolean);const ranked=options.map(c=>({c,score:fit(u,c,g)+rng.next()*2})).sort((a,b)=>b.score-a.score);
   if(ranked[0]&&chooseBenchChampion(g,ranked[0].c.id,u.id))l.aiChanges[u.id]=(l.aiChanges[u.id]??0)+1;
  }
 }
 if([12,28,44].includes(l.elapsed)&&!l.trade){
  const candidates=g.blue.slice(1).filter(u=>(l.cooldowns[u.id]??0)<=l.elapsed);if(!candidates.length)return;
  const partner=rng.pick(candidates);l.serial++;l.trade={partnerId:partner.id,direction:'incoming',playerChampion:g.blue[0].champion.id,partnerChampion:partner.champion.id,resolveAt:l.elapsed+15};note(g,`${partner.champion.name}: ${g.blue[0].champion.name} 교환 가능?`);
 }
 if(l.trade?.direction==='incoming'&&l.elapsed>=l.trade.resolveAt){note(g,'응답이 없어 팀원이 교환 요청을 거뒀습니다.');l.cooldowns[l.trade.partnerId]=l.elapsed+12;l.trade=undefined;}
}

export function advanceMatchup(g:Game){
 if(g.phase!=='matchup')return;
 g.matchupRemaining=Math.max(0,(g.matchupRemaining??7)-1);
 if(g.matchupRemaining===0){g.phase='augment';delete g.matchupRemaining;}
}
