import type {Game,Unit,Augment} from './types';
import {state} from './runtime';
import {refreshStats} from './stats';
import {Rng} from './rng';
import {expandedAugments} from './augment-catalog';
import {augments} from './data';
const clean=(n:string)=>n.replace(/\s*\([★☆-]+\)/g,'');
const descriptions:Record<string,string>={
 '보석 건틀릿':'치명타 확률 +20%. 스킬 피해가 치명타로 적중하면 피해 175%. 이 시뮬레이션의 적용 수치입니다.',
 '강타자':'평타에 내 최대 체력의 2.5% 물리 피해. 체력·공격 속도 빌드와 시너지.',
 '능력치!':'시드에 따라 능력치 모루 보상 2개: 체력 180 / 주문력 25 / 공격력 15 / 방어력 15 중 지급. 실제 획득치는 기록됩니다.',
 '응급 처치 키트':'자신이 주는 회복·보호막 20% 증폭. 정령의 형상·향로·월석과 연계.',
 '마법사 (물리)':'주문력 1당 추가 공격력 0.6으로 전환하고 공격력 15% 증가. 주문력 계수는 전환 후 0으로 계산.',
 '감쇠 광선':'기본 공격 대상의 주는 피해 15% 감소, 3초.',
 '극악무도':'스킬 적중 시 영구 주문력 +1, 1초 재사용. 첫 증강이 아니면 주문력 +40.',
 '급속 성장':'교전 중 체력 60% 아래면 자동 발동: 7초 동안 300+최대 체력20% 추가 체력, 주변 적 기절. 재사용 60초.',
 '마법 미사일':'스킬 적중 시 이동 거리에 따라 대상 최대 체력의 최대 3% 고정 피해. 주문력·다중 적중 스킬과 연계.',
 '거석상의 용기':'적에게 이동 불가 효과를 걸면 내 최대 체력5% 보호막. 재사용 3초.',
 '거인':'최대 체력35%, 공격력·주문력15% 증가. 체력 비례 스킬·강타자와 연계.',
 '거인 학살자':'이동 속도25% 증가. 나보다 체력이 큰 적을 상대로 피해10~30% 증가.',
 '궁극기 대변혁':'궁극기 사용 후 한 번 더 사용 가능. 재사용75초, 사망 후 부활 시 재충전.',
 '능수능란':'추가 공격 속도 +60%. 아이템 공격 속도와 합산하며 공격 속도 상한을 적용합니다.',
 '육중한 힘':'총 공격력 20% 증가. 아이템과 성장 공격력에도 적용합니다.',
 '되풀이':'스킬 가속 +60. 아이템의 스킬 가속과 합산합니다.',
 '치명적인 공격':'치명타 확률 +50%. 최대 100%, 야스오의 치명타 확률 증가도 적용합니다.',
 '능력치 더하기 능력치 더하기 능력치!':'능력치 모루 보상 4개: 체력 180 / 주문력 25 / 공격력 15 / 방어력 15 중 지급. 실제 획득치는 기록됩니다.',
 '유레카':'최종 주문력의 30%만큼 스킬 가속을 얻습니다.',
 '최상급 조준경 부착':'기본 공격 사거리 +250, 원거리 챔피언은 +150. 지도 거리로 환산해 적용합니다.',
 '프로틴 음료':'회복·보호막 효과 +25%, 추가 방어력·마법 저항력 합계 1당 +0.35% 증가.',
 '신비한 주먹':'기본 공격 적중 시 Q·W·E·R의 남은 재사용 대기시간을 1.25초 줄입니다.',
 '유리 대포':'최대 체력 30% 감소. 주 공격으로 실제 입힌 피해의 25%만큼 추가 고정 피해. 추가 효과에는 재발동하지 않습니다.',
 '미친 과학자':'선택·부활마다 두 형태 중 하나: 체력 +20%와 공격력·주문력 +30%, 또는 스킬 가속 +70과 이동 속도 +30%. 시뮬레이션의 자동 변신 규칙입니다.',
};
export function augmentDescription(name:string){const extra=expandedAugments.find(([id])=>augments.find(a=>a.id===id)?.name===name);return descriptions[clean(name)]??(extra?extra[2]+' (시뮬레이션 적용 규칙)':'이 증강 효과는 아직 지원되지 않습니다.');}
export function rollScientist(g:Game,u:Unit){
 const rng=new Rng(g.seed+g.time+u.deaths*131+Number(u.id.split('-')[1])*113+(u.team==='red'?101:0));
 state(u).counters.scientistForm=rng.int(2)+1;
 g.logs.push({time:g.time,text:u.champion.name+': 미친 과학자 · '+(state(u).counters.scientistForm===1?'거대화 (체력·공격력·주문력)':'소형화 (가속·이동 속도)'),tone:'good'});
}
export function applyAugment(g:Game,u:Unit,a:Augment){
 if(u.augments.some(old=>old.id===a.id))return false;
 const r=state(u),n=clean(a.name);
 if(n==='극악무도'&&u.augments.length)r.counters.permanentAp=(r.counters.permanentAp??0)+40;
 if(n==='미친 과학자')rollScientist(g,u);
 if(n==='후원'){u.gold+=1750;g.logs.push({time:g.time,text:u.champion.name+': 후원 +1750G',tone:'good'});}
 if(['능력치!','능력치 더하기 능력치!','능력치 더하기 능력치 더하기 능력치!'].includes(n)){const rng=new Rng(g.seed+g.time+Number(u.id.split('-')[1])*113+(u.team==='red'?101:0));
  const pool=[['anvilHp',180,'체력'],['anvilAp',25,'주문력'],['anvilAd',15,'공격력'],['anvilArmor',15,'방어력']] as const;
  for(let i=0;i<(n==='능력치!'?2:n==='능력치 더하기 능력치!'?3:4);i++){const [key,value,label]=rng.pick([...pool]);r.counters[key]=(r.counters[key]??0)+value;g.logs.push({time:g.time,text:u.champion.name+': 모루 보상 '+label+' +'+value,tone:'good'});}
 }
 u.augments.push(a);refreshStats(u);return true;
}
