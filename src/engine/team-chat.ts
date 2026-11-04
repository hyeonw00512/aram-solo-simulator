import type {Game,Unit,OrderKind,ChatMessage,Reaction} from './types';
import traits from '../../data/traits.json';
import {antiHealPlan,ownsAntiHeal} from './build-advisor';
import {itemMap,componentQuote,canShop} from './items';
import {Rng} from './rng';
import {chatState,chatLine,teammateReply} from './chat-social';
export {chatState,chatLine} from './chat-social';
export const orderNames:Record<OrderKind,string>={antiheal:'치감템 요청',engage:'진입 요청',retreat:'후퇴 요청',group:'합류 요청',clear:'라인 정리 요청',defend:'기지 수비 요청'};
export function parseOrder(text:string):OrderKind|undefined{
 if(/(?:하지\s*마|가지\s*마|사\s*지\s*마|말아|필요\s*없)/.test(text))return;
 if(/치감|치유\s*감소|회복\s*감소|고통스러운\s*상처|망각의\s*구|덤불\s*조끼|처형인의/.test(text))return 'antiheal';
 if(/후퇴|빠져|빠지|빼자|빼줘|도망/.test(text))return 'retreat';
 if(/수비|기지\s*지켜|넥서스\s*지켜|포탑\s*지켜/.test(text))return 'defend';
 if(/라인|미니언|웨이브/.test(text))return 'clear';
 if(/모여|모이|합류|같이\s*가/.test(text))return 'group';
 if(/이니시|들어가|들어와|진입|싸우자/.test(text))return 'engage';
}
export function chatReason(g:Game){if(g.phase==='finished')return '종료된 경기에는 오더를 보낼 수 없습니다';const last=g.chat?.lastSentAt;if(g.phase==='playing'&&last!==undefined&&g.time-last<3)return '오더는 3초 간격으로 보낼 수 있습니다';}
export function sendTeamChat(g:Game,raw:string,targetId?:string){
 const text=raw.trim().slice(0,160);if(!text||chatReason(g))return false;
 const c=chatState(g),allies=g.blue.filter(u=>u.id!==g.playerId);
 const named=allies.filter(u=>text.includes(u.champion.name));
 const targets=targetId?allies.filter(u=>u.id===targetId):named.length?named:allies;
 if(!targets.length)return false;
 c.lastSentAt=g.time;chatLine(g,g.playerId,text,'player');
 const kind=parseOrder(text);if(!kind)return true;
 const id=++c.orderSerial;
 for(const u of targets){
  const rng=new Rng(g.seed+id*131+Number(u.id.split('-')[1])*997),trust=u.relationships[g.playerId]?.trust??0;
  const cohesion=u.traits.reduce((n,t)=>n+traits[t].cohesion,0)/Math.max(1,u.traits.length);
  const health=u.health/Math.max(1,u.maxHealth),danger=kind==='engage'&&(health<.35||g.blue.filter(t=>t.alive).length<g.red.filter(t=>t.alive).length);
  const chance=Math.max(.12,Math.min(.94,.25+cohesion*.8+trust/180+(kind==='retreat'&&health<.4?.2:0)-(danger?.3:0)));
  const reason=`${u.traits.join(' · ')} / 내 판단 신뢰 ${trust}${danger?' / 현재 진입 위험':''}`;
  if(kind==='antiheal'&&ownsAntiHeal(u)){teammateReply(g,u,'owned','accept',reason);continue;}
  if(!rng.chance(chance)){teammateReply(g,u,'refuse','ignore',reason,{},kind==='engage'&&(danger||trust< -20)?g.blue[0]:undefined);continue;}
  if(kind==='antiheal'){
   const plan=antiHealPlan(u,g.seed),quote=componentQuote(plan.component,u.items),room=quote.remaining.length<6;
   u.shopRequest={orderId:id,itemId:plan.component,status:'pending',reason};
   const deferred=!canShop(g,u)||u.gold<quote.price||!room;
   teammateReply(g,u,!room?'slots':u.gold<quote.price?'gold':!canShop(g,u)?'later':'buy',deferred?'defer':'accept',reason,{item:itemMap[plan.component].name,gold:Math.max(0,quote.price-u.gold)});
  }else if(!u.alive||u.portal||u.atFountain||danger){
   teammateReply(g,u,!u.alive?'dead':u.portal?'portal':u.atFountain?'base':'danger','defer',reason,{},danger?g.blue[0]:undefined);
  }else{
   u.order={id,kind,until:g.time+24,reason};
   teammateReply(g,u,kind,'accept',reason);
  }
 }
 return true;
}
export function activeOrder(g:Game,u:Unit){return u.alive&&u.order&&u.order.until>g.time?u.order:undefined;}
export function orderResponse(g:Game,u:Unit):{action:Reaction;reason:string}|undefined{
 const order=activeOrder(g,u);if(!order)return;
 const action:Reaction=order.kind==='engage'?(u.health/u.maxHealth<.3?'cover':'join'):order.kind==='retreat'?'retreat':order.kind==='clear'?'clear':order.kind==='group'?'cover':'cover';
 return {action,reason:`채팅 ${orderNames[order.kind]}에 호응${order.kind==='engage'&&action==='cover'?'하되 체력이 낮아 엄호로 전환합니다':'합니다'}`};
}
