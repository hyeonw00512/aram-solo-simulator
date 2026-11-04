import type {Game,Unit,SkillSlot} from './types';
export const skillSlots:SkillSlot[]=['Q','W','E','R'];
export type SkillRanks=Record<SkillSlot,number>;
export type BasicSkill=Exclude<SkillSlot,'R'>;
export const skillMaxOrders:BasicSkill[][]=[['Q','W','E'],['Q','E','W'],['W','Q','E'],['W','E','Q'],['E','Q','W'],['E','W','Q']];
const priorities:Record<string,SkillSlot[]>={Ornn:['W','Q','E'],Garen:['E','Q','W'],Aatrox:['Q','E','W'],Evelynn:['Q','E','W'],Ahri:['Q','W','E'],Ashe:['W','Q','E'],Blitzcrank:['Q','W','E'],Darius:['Q','E','W'],Janna:['E','W','Q'],Kaisa:['Q','E','W'],Kennen:['Q','W','E'],Leona:['W','E','Q'],Lux:['E','Q','W'],Malphite:['Q','E','W'],Morgana:['Q','W','E'],Nami:['W','E','Q'],Sona:['W','Q','E'],Veigar:['Q','W','E'],Vex:['Q','W','E'],Yasuo:['Q','E','W']};
export function skillPriority(u:Unit){
 if(u.skillMaxOrder?.length===3&&new Set(u.skillMaxOrder).size===3&&u.skillMaxOrder.every(s=>['Q','W','E'].includes(s)))return u.skillMaxOrder;
 if(u.champion.id==='Malphite'&&(u.combat?.buildPath==='tank'||u.items.some(id=>['3068','3075','6665'].includes(id))))return ['W','E','Q'] as SkillSlot[];
 if(u.champion.id==='Kaisa'&&u.combat?.buildPath==='ap')return ['W','Q','E'] as SkillSlot[];
 return priorities[u.champion.id]??['Q','W','E'];
}
export function trainingPriority(u:Unit):SkillSlot[]{return u.prioritizeUltimate===false?[...skillPriority(u),'R']:['R',...skillPriority(u)];}
export const maxSkillRank=(slot:SkillSlot,level:number)=>slot==='R'?level>=16?3:level>=11?2:level>=6?1:0:Math.min(5,Math.ceil(level/2));
export function recommendedRanks(u:Unit):SkillRanks{
 const ranks:SkillRanks={Q:1,W:1,E:1,R:0};
 for(let level=4;level<=Math.min(18,u.level);level++){const slot=trainingPriority(u).find(s=>ranks[s]<maxSkillRank(s,level));if(slot)ranks[slot]++;}
 return ranks;
}
export const ranksFor=(u:Unit)=>u.skillRanks??recommendedRanks(u);
export const skillRank=(u:Unit,slot:SkillSlot)=>ranksFor(u)[slot];
export const unspentSkills=(u:Unit)=>Math.max(0,Math.min(18,u.level)-Object.values(ranksFor(u)).reduce((sum,n)=>sum+n,0));
export function ensureSkills(u:Unit){u.skillRanks??=recommendedRanks(u);}
export function skillUpgradeReason(u:Unit,slot:SkillSlot){
 if(!unspentSkills(u))return '남은 스킬 포인트가 없습니다';
 const rank=skillRank(u,slot),cap=maxSkillRank(slot,u.level);
 if(rank>=(slot==='R'?3:5))return '최대 랭크';
 if(rank>=cap)return `${slot==='R'?[6,11,16][rank]:rank*2+1}레벨 필요`;
 return '';
}
export function recommendedSkill(u:Unit){return trainingPriority(u).find(s=>!skillUpgradeReason(u,s));}
export function autoTrainSkills(u:Unit){ensureSkills(u);while(unspentSkills(u)){const slot=recommendedSkill(u);if(!slot)break;u.skillRanks![slot]++;}}
export function trainSkill(g:Game,slot:SkillSlot){
 const u=g.blue[0];ensureSkills(u);if(g.phase==='finished'||skillUpgradeReason(u,slot))return false;
 u.skillRanks![slot]++;g.logs.push({time:g.time,text:`${u.champion.name} ${slot} ${u.skillRanks![slot]}랭크 습득`,tone:'good'});g.logs=g.logs.slice(-650);return true;
}
