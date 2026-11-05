import type {Game,Unit,OrderKind,ChatMessage,Reaction,QuickOrder} from './types';
import {available} from './runtime';
import {camouflaged} from './evelynn';
import traits from '../../data/traits.json';
import {antiHealPlan,ownsAntiHeal} from './build-advisor';
import {itemMap,componentQuote,canShop} from './items';
import {Rng} from './rng';
import {chatState,chatLine,teammateReply} from './chat-social';
export {chatState,chatLine} from './chat-social';
export const orderNames:Record<OrderKind,string>={antiheal:'치감템 요청',engage:'진입 요청',retreat:'후퇴 요청',group:'합류 요청',clear:'라인 정리 요청',defend:'기지 수비 요청',focus:'집중 공격 요청'};
export const focusVisible=(g:Game,u:Unit)=>available(u)&&!u.returningToBase&&(!camouflaged(g,u)||(u.combat?.procs.revealedUntil??0)>g.time);
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
export function sendTeamChat(g:Game,raw:string,targetId?:string,quick?:{kind:QuickOrder['kind'];focusId?:string}){
 const text=raw.trim().slice(0,160);if(!text||chatReason(g))return false;
 if(quick&&(g.phase!=='playing'||quick.kind==='focus'&&!g.red.some(u=>u.id===quick.focusId&&focusVisible(g,u))))return false;
 const c=chatState(g),allies=g.blue.filter(u=>u.id!==g.playerId);
 const named=allies.filter(u=>text.includes(u.champion.name));
 const targets=targetId?allies.filter(u=>u.id===targetId):named.length?named:allies;
 if(!targets.length)return false;
 c.lastSentAt=g.time;chatLine(g,g.playerId,text,'player');
 const kind=quick?.kind??parseOrder(text);if(!kind)return true;
 const id=++c.orderSerial;
 const receipt:QuickOrder|undefined=quick?{id,kind:quick.kind,at:g.time,focusId:quick.focusId,responses:[]}:undefined;
 for(const u of targets){
  const rng=new Rng(g.seed+id*131+Number(u.id.split('-')[1])*997),trust=u.relationships[g.playerId]?.trust??0;
  const cohesion=u.traits.reduce((n,t)=>n+traits[t].cohesion,0)/Math.max(1,u.traits.length);
  const health=u.health/Math.max(1,u.maxHealth),danger=(kind==='engage'||kind==='focus')&&(health<.35||g.blue.filter(t=>t.alive).length<g.red.filter(t=>t.alive).length);
  const chance=Math.max(.12,Math.min(.94,.25+cohesion*.8+trust/180+(kind==='retreat'&&health<.4?.2:0)-(danger?.3:0)));
  const reason=`${u.traits.join(' · ')} / 내 판단 신뢰 ${trust}${danger?' / 현재 진입 위험':''}`;
  if(receipt&&(!u.alive||u.portal||u.atFountain||u.returningToBase)){receipt.responses.push({unitId:u.id,status:'unavailable',reason:!u.alive?'사망 중':u.portal?'포탈 이동 중':u.atFountain?'기지 대기 중':'기지로 복귀 중'});continue;}
  if(kind==='antiheal'&&ownsAntiHeal(u)){teammateReply(g,u,'owned','accept',reason);continue;}
  if(!rng.chance(chance)){receipt?.responses.push({unitId:u.id,status:'ignored',reason});teammateReply(g,u,'refuse','ignore',reason,{},kind==='engage'&&(danger||trust< -20)?g.blue[0]:undefined);continue;}
  if(kind==='antiheal'){
   const plan=antiHealPlan(u,g.seed),quote=componentQuote(plan.component,u.items),room=quote.remaining.length<6;
   u.shopRequest={orderId:id,itemId:plan.component,status:'pending',reason};
   const deferred=!canShop(g,u)||u.gold<quote.price||!room;
   teammateReply(g,u,!room?'slots':u.gold<quote.price?'gold':!canShop(g,u)?'later':'buy',deferred?'defer':'accept',reason,{item:itemMap[plan.component].name,gold:Math.max(0,quote.price-u.gold)});
  }else if(!u.alive||u.portal||u.atFountain||danger){
   receipt?.responses.push({unitId:u.id,status:'unavailable',reason:danger?'지금 진입하기에는 체력·인원이 불리함':reason});
   teammateReply(g,u,!u.alive?'dead':u.portal?'portal':u.atFountain?'base':'danger','defer',reason,{},danger?g.blue[0]:undefined);
  }else{
   u.order={id,kind,until:g.time+24,reason,...(kind==='focus'?{focusId:quick?.focusId}:{})};
   receipt?.responses.push({unitId:u.id,status:'accepted',reason});
   teammateReply(g,u,kind==='focus'?'engage':kind,'accept',reason);
  }
 }
 if(receipt)c.quickOrder=receipt;
 return true;
}
export function activeOrder(g:Game,u:Unit){const order=u.alive&&u.order&&u.order.until>g.time?u.order:undefined;return order?.kind==='focus'&&!g.red.some(t=>t.id===order.focusId&&focusVisible(g,t))?undefined:order;}
export function expireFocusOrders(g:Game){
 for(const u of g.blue){const order=u.order;if(order?.kind==='focus'&&order.until>g.time&&(!u.alive||!g.red.some(t=>t.id===order.focusId&&focusVisible(g,t))))order.until=g.time;}
}
export function focusTarget(g:Game,u:Unit){const order=activeOrder(g,u);return order?.kind==='focus'?g.red.find(t=>t.id===order.focusId):undefined;}
export function quickOrderReason(g:Game,kind?:QuickOrder['kind'],focusId?:string){
 if(g.phase!=='playing')return '경기가 진행 중일 때 빠른 지시를 보낼 수 있습니다';
 if(chatReason(g))return chatReason(g);
 if(kind==='focus'&&!g.red.some(u=>u.id===focusId&&focusVisible(g,u)))return '지도나 적군 목록에서 공격할 적을 선택하세요';
}
export function sendQuickOrder(g:Game,kind:QuickOrder['kind'],recipientId?:string,focusId?:string){
 if(quickOrderReason(g,kind,focusId))return false;
 if(recipientId&&!g.blue.some(u=>u.id===recipientId&&u.id!==g.playerId))return false;
 const lines:Record<QuickOrder['kind'],string>={engage:'같이 들어가자',retreat:'후퇴하자',group:'합류해줘',clear:'라인 정리해줘',defend:'기지 수비해줘',focus:`${g.red.find(u=>u.id===focusId)?.champion.name??'적'}부터 집중 공격하자`};
 if(!Object.hasOwn(lines,kind))return false;
 return sendTeamChat(g,lines[kind],recipientId,{kind,focusId:kind==='focus'?focusId:undefined});
}
export function orderResponse(g:Game,u:Unit):{action:Reaction;reason:string}|undefined{
 const order=activeOrder(g,u);if(!order)return;
 const action:Reaction=order.kind==='engage'||order.kind==='focus'?(u.health/u.maxHealth<.3?'cover':'join'):order.kind==='retreat'?'retreat':order.kind==='clear'?'clear':order.kind==='group'?'cover':'cover';
 return {action,reason:`채팅 ${orderNames[order.kind]}에 호응${['engage','focus'].includes(order.kind)&&action==='cover'?'하되 체력이 낮아 엄호로 전환합니다':'합니다'}`};
}
