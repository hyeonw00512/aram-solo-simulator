import type {Game} from '../engine/types';
import {unspentSkills} from '../engine/skill-training';

export type Popup='decision'|'shop'|'respawn'|'settings'|'base'|'result'|'restart';
export interface PopupState {active:Popup|null;back:Popup[];seen:Partial<Record<Popup,string>>;}
export const emptyPopups=():PopupState=>({active:null,back:[],seen:{}});
const priority:Record<Popup,number>={settings:30,base:40,shop:50,respawn:70,decision:80,result:90,restart:100};
const inGame=(g:Game)=>!['pick','swap','matchup'].includes(g.phase);
export function popupValid(p:Popup,g:Game){
 if(p==='restart')return true;
 if(!inGame(g))return false;
 if(p==='decision')return ['decision','augment'].includes(g.phase);
 if(p==='respawn')return !!g.respawnPrompt&&g.blue[0].alive&&g.blue[0].atFountain&&g.phase==='playing';
 if(p==='result')return g.phase==='finished';
 return true;
}
export function openPopup(s:PopupState,p:Popup):PopupState{
 if(s.active===p)return s;
 return {...s,active:p,back:[...s.back.filter(v=>v!==p),...(s.active?[s.active]:[])]};
}
export function closePopup(s:PopupState,g:Game):PopupState{
 const back=s.back.filter(p=>popupValid(p,g));return {...s,active:back.pop()??null,back};
}
export function minimizePopups(s:PopupState):PopupState{return {...s,active:null,back:[]};}
export function syncPopups(previous:PopupState,g:Game):PopupState{
 let s:PopupState={...previous,back:previous.back.filter(p=>popupValid(p,g)),seen:{...previous.seen}};
 if(s.active&&!popupValid(s.active,g))s=closePopup(s,g);
 const u=g.blue[0],events:{kind:Popup;key:string;priority?:number}[]=[];
 if(inGame(g)){
  if(g.phase==='decision'||g.phase==='augment')events.push({kind:'decision',key:g.phase==='augment'?`augment:${g.augmentSerial??0}`:`decision:${g.encounterSerial}:${g.pending?.title??''}`});
  if(g.phase==='shop')events.push({kind:'shop',key:'starting-shop'});
  // Open once per death, ahead of newly earned augments. Closing the shop
  // reveals the queued augment; inspecting/minimizing must not reopen it.
  if(!u.alive&&g.time>0&&g.phase!=='finished')events.push({kind:'shop',key:`death:${u.deaths}:${u.respawnAt}`,priority:85});
  if(popupValid('respawn',g))events.push({kind:'respawn',key:`${u.deaths}:${u.respawnAt}`});
  if(g.time>0&&g.phase!=='finished'&&!u.autoSkills&&unspentSkills(u)>0)events.push({kind:'settings',key:`skill:${u.level}`});
  if(g.phase==='finished')events.push({kind:'result',key:`${g.winner}:${g.time}`});
 }
 for(const {kind,key,priority:eventPriority} of events.sort((a,b)=>(a.priority??priority[a.kind])-(b.priority??priority[b.kind]))){
  if(s.seen[kind]===key)continue;s.seen[kind]=key;
  if(s.active===kind)continue;
  if(!s.active||(eventPriority??priority[kind])>priority[s.active])s=openPopup(s,kind);
  else if(!s.back.includes(kind))s.back=[kind,...s.back];
 }
 return JSON.stringify(s)===JSON.stringify(previous)?previous:s;
}
