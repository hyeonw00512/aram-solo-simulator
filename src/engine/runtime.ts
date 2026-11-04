import type {Game,Unit,StatusEffect} from './types';
import {resourceKind,baseResourceMax} from './resources';
export function state(u:Unit){return u.combat??={mana:resourceKind(u)==='mana'?baseResourceMax(u):0,energy:resourceKind(u)==='energy'?baseResourceMax(u):0,flow:0,ready:{},nextAttack:0,effects:[],counters:{},procs:{},lastDamage:-100};}
export function effect(u:Unit,kind:StatusEffect['kind']){return (u.combat?.effects??[]).filter(e=>e.kind===kind).reduce((sum,e)=>sum+e.value,0);}
export function addEffect(u:Unit,e:StatusEffect){const r=state(u);if(e.key)r.effects=r.effects.filter(old=>old.key!==e.key);r.effects.push(e);}
export function proc(u:Unit,key:string,time:number,cd:number){const r=state(u);if((r.procs[key]??-1)>time)return false;r.procs[key]=time+cd;return true;}
const normalizedAugmentNames=new Map<string,string>();
export function augmentName(name:string){let normalized=normalizedAugmentNames.get(name);if(normalized===undefined){normalized=name.replace(/\s*\([★☆-]+\)/g,'');normalizedAugmentNames.set(name,normalized);}return normalized;}
export function hasAugment(u:Unit,name:string){return u.augments.some(a=>augmentName(a.name)===name);}
export const allUnits=(g:Game)=>[...g.blue,...g.red];
export const available=(u:Unit)=>u.alive&&!u.portal&&!u.atFountain;
export function blocked(u:Unit){return !!u.forge||effect(u,'charm')>0||effect(u,'stun')>0||effect(u,'stasis')>0;}
