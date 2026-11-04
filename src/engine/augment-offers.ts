import type {Game,Tier} from './types';
import {augments} from './data';
import {Rng} from './rng';

export const augmentLevels=[1,7,11,15];
const tiers:Tier[]=['silver','gold','prism'];
const validTier=(t:unknown):t is Tier=>tiers.includes(t as Tier);
// Independent, equal-probability rolls for the whole lobby, fixed for a match.
// Separate RNG stream: champions, rerolls and death timing cannot change tiers.
export function augmentTierSchedule(game:Game):Tier[]{
 if(game.augmentTiers?.length===augmentLevels.length&&game.augmentTiers.every(validTier))return game.augmentTiers;
 const rng=new Rng(game.seed^0x5a17c3);
 const generated=augmentLevels.map(()=>rng.pick(tiers));
 // Upgrade old saves without changing already received or currently offered tiers.
 return generated.map((tier,i)=>{
  const current=i===game.blue[0].augments.length&&game.phase==='augment'?augments.find(a=>a.id===game.pending?.choices[0]?.id)?.tier:undefined;
  const known=game.augmentTiers?.[i]??game.blue[0].augments[i]?.tier??current??[...game.blue,...game.red].find(u=>u.augments[i])?.augments[i]?.tier;
  return validTier(known)?known:tier;
 });
}
export function ensureAugmentTiers(game:Game){return game.augmentTiers=augmentTierSchedule(game);}
export const augmentTier=(game:Game,round:number):Tier=>augmentTierSchedule(game)[round];

// Player-local, match-long exposure history. An offer counts even if rejected
// or rerolled; AI choices do not remove options from the player's pool.
export function seenAugmentIds(game:Game){
 return new Set([
  ...(game.seenAugments??[]),
  ...game.blue[0].augments.map(a=>a.id),
  ...(game.phase==='augment'?game.pending?.choices.map(c=>c.id)??[]:[]),
 ]);
}
export function rememberAugments(game:Game,ids:string[]=[]){game.seenAugments=[...new Set([...seenAugmentIds(game),...ids])];}
// Reject offers beyond the four-round limit without resetting the match.
export function closeCompletedAugmentOffer(game:Game){
 if(game.phase!=='augment'||game.blue[0].augments.length<augmentLevels.length)return false;
 rememberAugments(game);game.pending=undefined;game.augmentRerolls=undefined;game.phase=game.time>0?'playing':'shop';return true;
}
export function unseenAugments(game:Game,tier:Tier){const seen=seenAugmentIds(game);return augments.filter(a=>a.tier===tier&&!seen.has(a.id));}
// Each future round needs three offers AND three independent replacements.
export function futureAugmentReserve(game:Game,tier:Tier){return 6*augmentTierSchedule(game).slice(game.blue[0].augments.length+1).filter(t=>t===tier).length;}
export function augmentRerollReason(game:Game,index:number):string|undefined{
 if(game.phase!=='augment'||!game.pending||!Number.isInteger(index)||index<0||index>=game.pending.choices.length)return '증강 선택 중이 아닙니다';
 if(game.blue[0].augments.length>=augmentLevels.length)return '증강 선택 완료';
 if(game.augmentRerolls?.[index])return '새로고침 사용함';
 const old=augments.find(a=>a.id===game.pending!.choices[index].id);
 if(!old)return '새로고침할 수 없습니다';
 const count=unseenAugments(game,old.tier).length;
 if(!count)return '새 증강 없음';
 if(count<=futureAugmentReserve(game,old.tier))return '다음 증강 선택용 후보만 남음';
}
