import type {Game,Unit,ChatMessage} from './types';
import {Rng} from './rng';
import {chatVoice,teammateLine,type ChatCue} from './chat-voice';

export function chatState(g:Game){return g.chat??={serial:0,orderSerial:0,messages:[]};}
export function chatLine(g:Game,sender:string,text:string,tone:ChatMessage['tone']='system',reason?:string){
 const c=chatState(g);c.messages.push({id:++c.serial,at:g.time,sender,text,tone,reason});c.messages=c.messages.slice(-80);
}
const loud=(u:Unit)=>['bold','stubborn'].includes(chatVoice(u));
const socialRng=(g:Game,u:Unit,salt=0)=>new Rng(g.seed+g.time*193+(g.chat?.orderSerial??0)*431+Number(u.id.split('-')[1])*719+salt);

export function missingPing(g:Game,sender:Unit,target:Unit,count:number,reason:string){
 if(g.phase==='finished'||sender.team!=='blue'||target.team!=='blue'||sender.id===target.id||sender.id===g.playerId)return false;
 const c=chatState(g);c.lastPingAt??={};
 if(g.time-(c.lastPingAt[sender.id]??-Infinity)<10)return false;
 c.lastPingAt[sender.id]=g.time;
 const burst={id:++c.serial,at:g.time,sender:sender.id,targetId:target.id,position:target.position,count:Math.max(1,Math.min(3,Math.round(count))),reason};
 c.pings=[...(c.pings??[]),burst].slice(-24);
 chatLine(g,sender.id,`${target.champion.name} ❓ ×${burst.count}`,'ping',reason);
 return true;
}

// Obeying, refusing, and buying are game decisions. Most of them do not warrant a chat message.
export function teammateReply(g:Game,u:Unit,cue:ChatCue,tone:ChatMessage['tone'],reason?:string,values:{item?:string;gold?:number}={},pingTarget?:Unit){
 if(!u.alive)return;
 if(['bought','bought-dead','buy-dead','dead','base','portal'].includes(cue)||(!u.alive&&cue==='buy'))return;
 const rng=socialRng(g,u),trust=u.relationships[g.playerId]?.trust??0;
 if(pingTarget&&(cue==='danger'||cue==='refuse')&&rng.chance(loud(u)?.6:.12)){
  const count=loud(u)?trust< -25?3:rng.pick([2,3]):rng.pick([1,2,3]);
  if(missingPing(g,u,pingTarget,count,reason??'진입 판단에 의문'))return;
 }
 const chance=cue==='refuse'||cue==='danger'?(loud(u)?.35:.08):cue==='gold'||cue==='slots'?.2:.12;
 if(rng.chance(chance))chatLine(g,u.id,teammateLine(g,u,cue,values),tone,reason);
}

// Called only for observed losing initiations, after the persistent memory has been updated.
export function reactToMisplay(g:Game,observer:Unit,target:Unit,reckless:boolean,reason:string){
 if(observer.team!=='blue'||observer.id===g.playerId)return;
 const rng=socialRng(g,observer,(g.encounter?.id??0)*104729+Number(target.id.split('-')[1])*181);
 if(!rng.chance(loud(observer)?reckless?.85:.5:reckless?.25:.08))return;
 const repeated=(observer.relationships[target.id]?.reckless??0)>=2;
 if(!missingPing(g,observer,target,loud(observer)?repeated?3:rng.pick([2,3]):rng.pick([1,2,3]),reason))return;
 if(loud(observer)&&rng.chance(.25))chatLine(g,observer.id,rng.pick(repeated?['또 박네','ㅅㅂ 좀','그만 좀 들어가']:['뭐함','아니 거길 왜 들어감','?']),'ignore',reason);
}
