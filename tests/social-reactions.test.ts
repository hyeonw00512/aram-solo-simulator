import {expect,it} from 'vitest';
import {createGame} from '../src/engine/game';
import {sendTeamChat} from '../src/engine/team-chat';
import {missingPing} from '../src/engine/chat-social';
import {rememberEncounter} from '../src/engine/memory';
import {openDecision,startEncounter} from '../src/engine/encounter';
import type {ResponsePlan} from '../src/engine/types';
function lane(seed:number){const g=createGame(seed);g.time=100;g.phase='playing';for(const u of [...g.blue,...g.red]){u.atFountain=false;u.position=u.team==='blue'?44:54;}return g;}
it('usually stays silent whether following or refusing, without fabricating a reply for silence',()=>{
 let silentFollow=0,silentIgnore=0,replies=0;
 for(let seed=1;seed<=150;seed++){const g=lane(seed),u=g.blue[1];sendTeamChat(g,'합류해줘',u.id);const spoke=g.chat!.messages.some(m=>m.sender===u.id);if(spoke)replies++;else if(u.order)silentFollow++;else silentIgnore++;}
 expect(silentFollow).toBeGreaterThan(30);expect(silentIgnore).toBeGreaterThan(10);expect(replies).toBeLessThan(70);
});
it('says nothing about being dead or completing purchases, and gives no automated explanation for ordinary chat',()=>{
 for(let seed=1;seed<=30;seed++){const g=lane(seed),u=g.blue[1];u.alive=false;u.health=0;sendTeamChat(g,'합류해줘',u.id);expect(g.chat!.messages).toHaveLength(1);expect(u.order).toBeUndefined();}
 const g=lane(1);sendTeamChat(g,'ㅋㅋ');expect(g.chat!.messages).toHaveLength(1);expect(g.chat!.messages[0].sender).toBe(g.playerId);
});
it('creates persistent bounded ping bursts at the target location and prevents unlimited same-moment spam',()=>{
 const g=lane(3),u=g.blue[1],target=g.blue[2];expect(missingPing(g,u,target,20,'test')).toBe(true);expect(g.chat!.pings?.[0]).toMatchObject({targetId:target.id,position:44,count:3});expect(g.chat!.messages).toHaveLength(1);
 const copy=JSON.parse(JSON.stringify(g));expect(missingPing(copy,copy.blue[1],copy.blue[2],20,'test')).toBe(false);expect(copy).toEqual(g);
 g.time+=9;expect(missingPing(g,u,target,3,'test')).toBe(false);g.time++;expect(missingPing(g,u,target,3,'test')).toBe(true);
 for(let i=0;i<100;i++){g.time+=10;missingPing(g,u,target,100,'test');}expect(g.chat!.pings).toHaveLength(24);expect(g.chat!.messages).toHaveLength(80);expect(g.chat!.pings!.every(p=>p.count===3)).toBe(true);
});
it('reacts to witnessed repeated reckless losses with up to three pings, including AI teammates as targets',()=>{
 let bursts=0;
 for(let seed=1;seed<=20;seed++){
  const g=lane(seed),observer=g.blue[1],target=g.blue[2];observer.traits=['고집이 셉니다'];observer.relationships[target.id]={trust:-30,reckless:1,experiences:2,reason:'test',updatedAt:0};
  openDecision(g);startEncounter(g,g.pending!.choices[0].id);const e=g.encounter!;e.initialOpportunity=-.5;
  const plan=(id:string,action:ResponsePlan['action']):ResponsePlan=>({unitId:id,action,reason:'test',misunderstood:false,weights:{engage:0,join:0,retreat:0,cover:0,poke:0,hesitate:0,chase:0,clear:0,push:0}});
  e.rounds=[{time:g.time,plans:[plan(observer.id,'cover'),plan(target.id,'engage')]}];target.deaths++;target.alive=false;target.health=0;
  const saved=structuredClone(g);rememberEncounter(g);rememberEncounter(saved);expect(g).toEqual(saved);
  expect(observer.relationships[target.id].reckless).toBe(2);if(g.chat?.pings?.some(p=>p.sender===observer.id&&p.targetId===target.id&&p.count===3))bursts++;
 }
 expect(bursts).toBeGreaterThan(10);
});
