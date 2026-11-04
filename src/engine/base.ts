import type {Game,Unit} from './types';
import {spawnPosition} from './map-layout';
import {state,blocked,effect} from './runtime';
import {statsFor} from './stats';
export const BASE_RADIUS=3;
export const inBase=(u:Unit)=>Math.abs(u.position-spawnPosition(u.team))<=BASE_RADIUS;
export function returnToBase(g:Game,u=g.blue[0]){
 if(g.phase!=='playing'||g.encounter||!u.alive||u.portal||u.forge||u.atFountain)return false;
 u.shopUnlocked=false;u.returningToBase=true;u.status='기지로 후퇴 중';return true;
}
export function advanceBases(g:Game){
 for(const u of [...g.blue,...g.red]){
  if(!u.alive){u.returningToBase=false;u.holdAtBase=false;continue;}
  if(u.portal)continue;
  if(u.returningToBase&&!blocked(u)&&!effect(u,'root')){
   const goal=spawnPosition(u.team);u.position+=Math.sign(goal-u.position)*Math.min(Math.abs(goal-u.position),statsFor(u).moveSpeed/325*2.4);u.status='기지로 후퇴 중';
  }
  if(u.returningToBase&&inBase(u)){
   u.position=spawnPosition(u.team);u.returningToBase=false;u.atFountain=true;u.holdAtBase=u.id===g.playerId;u.fountainSince=g.time;
   u.status='우물 · 대기';g.logs.push({time:g.time,text:u.champion.name+': 기지 도착. 살아서 복귀한 우물은 추가 회복·구매를 제공하지 않습니다.'});
  }

 }
}
