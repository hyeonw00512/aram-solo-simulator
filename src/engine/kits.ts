import type {SkillSlot,Unit} from './types';
import rankData from '../../data/skill-ranks.json';
import {skillRank} from './skill-training';
// Simulation tuning for the supported roster. Names/descriptions come from the
// bundled Riot snapshot; numbers below intentionally use our time/distance scale.
export interface Ability {slot:SkillSlot;kind:'damage'|'heal'|'shield'|'buff';base:number;growth:number;ap:number;ad?:number;armor?:number;hp?:number;targetHp?:number;type?:'physical'|'magic'|'true';cd:number;mana:number;range:number;area?:number;cc?:'stun'|'root'|'slow';duration?:number;dash?:boolean;pull?:boolean;special?:string;}
const d=(slot:SkillSlot,base:number,ap:number,cd:number,range:number,extra:Partial<Ability>={}):Ability=>({slot,kind:'damage',base,growth:9,ap,cd,mana:slot==='R'?100:50,range,...extra});
export const kits:Record<string,Ability[]>={
 Ornn:[d('Q',20,0,9,32,{ad:1.1,type:'physical',growth:6.25,area:4,cc:'slow'}),d('W',0,0,12,20,{targetHp:.12,area:10,growth:0}),d('E',70,0,16,32,{armor:.4,area:8,dash:true,growth:7.5}),d('R',125,.2,140,50,{area:6,growth:8.333333,cc:'stun'})],
 Garen:[d('Q',0,0,8,0,{kind:'buff',mana:0,growth:0,ad:.5}),d('W',0,0,23,0,{kind:'buff',mana:0,growth:0}),d('E',4,0,9,13,{ad:.32,type:'physical',mana:0,area:13,growth:1}),d('R',150,0,120,16,{type:'true',mana:0,growth:25})],
 Aatrox:[d('Q',10,0,14,26,{ad:.6,type:'physical',mana:0,area:5,growth:3.75,cc:'stun'}),d('W',30,0,20,33,{ad:.4,type:'magic',mana:0,cc:'slow',growth:2.5}),d('E',0,0,9,0,{kind:'buff',dash:true,mana:0,growth:0}),d('R',0,0,120,0,{kind:'buff',mana:0,growth:0})],
 Evelynn:[d('Q',25,.25,4,800/25,{growth:1.25,special:'hate-spike'}),d('W',0,0,15,1200/25,{kind:'buff',growth:0,special:'allure'}),d('E',60,0,8,290/25,{growth:7.5,special:'whiplash'}),d('R',125,.75,120,450/25,{growth:125/6,special:'last-caress',area:450/25})],
 Ahri:[d('Q',70,.5,7,30,{special:'orb',area:5}),d('W',65,.45,9,18,{area:4}),d('E',65,.6,12,28,{cc:'stun',duration:2}),d('R',100,.4,55,22,{dash:true,area:6})],
 Ashe:[d('Q',0,0,9,24,{kind:'buff',mana:30,special:'flurry',ad:.35}),d('W',45,0,8,32,{ad:1,area:7,cc:'slow',duration:3,type:'physical'}),d('E',0,0,24,100,{kind:'buff',mana:0,special:'scout'}),d('R',180,1,65,45,{cc:'stun',duration:3,area:5})],
 Blitzcrank:[d('Q',90,1,15,28,{pull:true,cc:'stun',duration:1}),d('W',0,0,12,0,{kind:'buff',special:'overdrive'}),d('E',0,0,8,9,{ad:2,type:'physical',cc:'stun',duration:1,mana:25}),d('R',180,1,45,12,{area:10,cc:'stun',duration:1})],
 Darius:[d('Q',60,0,7,12,{ad:1.1,area:10,type:'physical',special:'heal-cleave'}),d('W',10,0,7,9,{ad:1.4,cc:'slow',duration:2,type:'physical',mana:30}),d('E',0,0,15,16,{pull:true,cc:'slow',duration:2,special:'pull',mana:40,growth:0}),d('R',90,0,60,10,{ad:.7,type:'true',special:'execute',mana:100})],
 Janna:[d('Q',65,.5,10,30,{cc:'stun',duration:2,area:5}),d('W',50,.6,8,24,{cc:'slow',duration:3}),d('E',80,.55,10,26,{kind:'shield',special:'shield-ad'}),d('R',150,.65,65,25,{kind:'heal',area:25,special:'disengage'})],
 Kaisa:[d('Q',60,.4,7,20,{ad:.8,area:6,type:'physical'}),d('W',90,.9,13,38,{ad:.5,special:'plasma'}),d('E',0,0,12,0,{kind:'buff',special:'overdrive'}),d('R',120,1,55,30,{kind:'shield',dash:true,special:'dive-shield'})],
 Kennen:[d('Q',75,.75,7,30,{mana:60}),d('W',60,.55,10,20,{mana:40,area:8}),d('E',70,.6,12,18,{mana:80,dash:true,area:6,special:'lightning-rush'}),d('R',200,1.2,65,16,{mana:0,area:14})],
 Leona:[d('Q',40,.3,6,9,{cc:'stun',duration:1.5}),d('W',65,.4,11,12,{area:9,armor:.35,special:'resist'}),d('E',55,.4,10,24,{dash:true,cc:'root',duration:1}),d('R',110,.8,60,32,{cc:'stun',duration:2,area:8})],
 Lux:[d('Q',75,.65,10,32,{cc:'root',duration:2,area:3}),d('W',65,.4,10,28,{kind:'shield',area:20}),d('E',80,.8,9,32,{area:8,cc:'slow',duration:2}),d('R',180,1.2,45,45,{area:6})],
 Malphite:[d('Q',70,.6,8,24,{cc:'slow',duration:3,special:'steal-speed'}),d('W',20,0,10,10,{armor:.35,ad:.5,area:5,type:'physical',special:'resist'}),d('E',60,.6,9,12,{armor:.45,area:10,special:'attack-slow'}),d('R',180,.9,65,30,{dash:true,area:10,cc:'stun',duration:2})],
 Morgana:[d('Q',80,.9,10,32,{cc:'root',duration:3}),d('W',65,.7,10,30,{area:9,special:'pool'}),d('E',90,.7,14,28,{kind:'shield',special:'spellshield'}),d('R',150,.7,65,16,{area:14,cc:'stun',duration:2})],
 Nami:[d('Q',70,.5,10,28,{area:5,cc:'stun',duration:2}),d('W',75,.4,9,26,{kind:'heal',special:'bounce'}),d('E',35,.2,10,26,{kind:'buff',special:'ally-empower'}),d('R',120,.6,65,40,{area:12,cc:'stun',duration:2})],
 Sona:[d('Q',65,.4,7,26,{area:6,special:'powerchord'}),d('W',55,.3,9,26,{kind:'heal',special:'heal-shield',area:15}),d('E',0,0,10,25,{kind:'buff',special:'team-speed'}),d('R',120,.6,65,26,{area:9,cc:'stun',duration:2})],
 Veigar:[d('Q',60,.6,7,30,{area:3}),d('W',90,1,10,30,{area:7}),d('E',0,0,16,28,{cc:'stun',duration:2,area:9,special:'cage',growth:0}),d('R',170,.8,60,25,{special:'missing-health'})],
 Vex:[d('Q',70,.7,8,34,{area:6}),d('W',65,.3,11,12,{area:10,special:'self-shield'}),d('E',55,.5,11,30,{area:9,cc:'slow',duration:2}),d('R',180,1.1,60,40,{dash:true,area:7,special:'reset'})],
 Yasuo:[d('Q',30,0,4,12,{ad:1.05,type:'physical',area:5,special:'tornado',mana:0}),d('W',0,0,20,0,{kind:'buff',special:'windwall',mana:0}),d('E',45,.6,6,18,{dash:true,mana:0}),d('R',140,0,45,22,{ad:1.3,type:'physical',cc:'stun',duration:1,mana:0,special:'airborne'})],
};
export const abilityName=(unit:Unit,slot:SkillSlot)=>unit.champion.skills[['Q','W','E','R'].indexOf(slot)+1]??slot;
export function rankedAbility(unit:Unit,slot:SkillSlot,rank=skillRank(unit,slot)){
 const original=kits[unit.champion.id]?.find(a=>a.slot===slot);if(!original)return undefined;
 const index=['Q','W','E','R'].indexOf(slot),source=(rankData.champions as Record<string,{cost:number[];cooldown:number[]}[]>)[unit.champion.id]?.[index],i=Math.max(0,rank-1);
 // ARAM Mayhem 26.20 override; Data Dragon contains the base-mode cooldown.
 if(unit.champion.id==='Garen'&&slot==='W')return {...original,cd:18-1.5*i,mana:0};
 if(unit.champion.id==='Evelynn'&&slot==='Q'&&(unit.combat?.counters.qRecasts??0)>0)return {...original,base:20+5*rank,growth:0,range:550/25,area:4,cd:source?.cooldown[i]??4,mana:0};
 if(unit.champion.id==='Evelynn'&&slot==='W')return {...original,range:(1100+100*rank)/25,cd:source?.cooldown[i]??15,mana:source?.cost[i]??60};
 if(unit.champion.id==='Evelynn'&&slot==='E'&&unit.combat?.counters.empoweredE)return {...original,base:40+40*rank,growth:0,range:385/25,area:4,dash:true,cd:source?.cooldown[i]??8,mana:source?.cost[i]??40};
 if(unit.champion.id==='Ornn'&&slot==='R'&&(unit.combat?.counters.ornnRam??0)>0)return {...original,mana:0,cd:source?.cooldown[i]??140};
 if(unit.champion.id==='Aatrox'&&slot==='Q')return {...original,base:10+15*i,ad:.6+.1*i,range:[26,20,16][unit.combat?.counters.aatroxQStage??0]??26,cd:source?.cooldown[i]??14,mana:0,growth:0};
 // Rank damage uses the simulator's existing scale; cost and cooldown use Riot's rank arrays.
 return {...original,base:original.base+original.growth*i*(slot==='R'?6:4),growth:0,cd:source?.cooldown[i]??original.cd,mana:source?.cost[i]??original.mana};
}
export const kitFor=(unit:Unit)=>(kits[unit.champion.id]??[]).map(a=>rankedAbility(unit,a.slot)!);
export function ultimateReady(unit:Unit,time:number){return unit.level>=6&&skillRank(unit,'R')>0&&(unit.combat?.ready.R??0)<=time;}
export const passiveText:Record<string,string>={
 Ornn:'간이 대장간: 안전한 곳에서 비소모품 제작(3초, 피격·이동 시 취소). 추가 체력·방어력·마법 저항 10% 증가. 13레벨부터 자신, 이후 레벨마다 아군 한 명의 완성품 자동 강화. Q 기둥→E 충돌, W·R 불안정 표식을 평타·이동 불가로 폭발. R 재시전 가능. 1초·직선 전장 판정으로 근사합니다.',
 Garen:'인내심: 챔피언·포탑 피해 없이 8초 경과 시 체력 재생. 무자원. Q 둔화 해제·다음 평타 강화와 침묵, W 보호막·강인함·피해 감소, E 3초 회전·6회 적중 시 방어력 감소, R 잃은 체력 비례 고정 피해. W 처치 중첩으로 저항력 증가.',
 Aatrox:'사신 태세: 주기적인 평타에 최대 체력 비례 마법 피해·회복. 무자원. Q 3연타·끝부분 적중 시 추가 피해·공중에 띄우기, W 사슬에서 벗어나지 못하면 끌어당김, E 짧은 돌진과 챔피언 피해 흡혈, R 공격력·자기 회복 강화·처치 관여 시 연장. 검의 끝 판정은 직선 거리로 근사합니다.',
 Evelynn:'악의 장막: 4초 비전투 후 저체력 재생·E 강화, 6레벨부터 위장. 적 챔피언 감지 거리 700. Q 최초 적중 후 3회 추가 가시·표식, W 2.5초 숙성 후 매혹·마법 저항 감소, E 최대 체력 비례 피해, R 체력 30% 미만에 2.4배 피해·후방 이동. 1초 단위 자동 전투로 근사합니다.',
 Kennen:'스킬 3회 적중 시 기절·기력 25 회복 (표식 6초). 번개 질주 적중 시 기력 40 회복.',
 Ahri:'스킬 9회 적중마다 정수 회복',Ashe:'기본 공격으로 둔화',Blitzcrank:'저체력일 때 마나 비례 보호막',Darius:'출혈 중첩과 5중첩 궁극기 강화',Janna:'보호막에 공격력 강화',Kaisa:'플라즈마 5중첩 폭발',Leona:'햇빛 표식을 아군 공격이 폭발',Lux:'스킬 표식을 기본 공격으로 폭발',Malphite:'피해를 받지 않으면 최대 체력 비례 보호막·방어력 강화',Morgana:'스킬 피해 흡혈',Nami:'회복·보호 시 이동 속도 보조',Sona:'스킬 3회 후 강화 기본 공격',Veigar:'스킬 적중으로 주문력 영구 성장',Vex:'주기적으로 스킬 공포·궁극기 처치 시 초기화',Yasuo:'치명타 확률 강화·이동으로 기류 충전 후 피격 시 보호막·Q 3타 에어본'};
