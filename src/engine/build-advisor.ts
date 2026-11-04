import type {Unit,BuildPath,Augment} from './types';
import {kitFor} from './kits';
import {hasAugment} from './runtime';
import {statsFor} from './stats';
import {Rng} from './rng';
import references from '../../data/build-references.json';
import {augmentGrade} from './augment-grades';
export const buildRoutes:Record<BuildPath,string[]>={
 tank:['3084','3047','3068','3065','2502','3083'],
 ap:['6655','3020','3089','3135','3157','6653'],
 ad:['6672','3006','3153','3031','3036','3072'],
 support:['6617','3158','3504','6616','3190','3107'],
};
export function suggestedPath(u:Unit,seed=0):BuildPath{
 if(u.champion.id==='Malphite')return seed%3===0?'ap':'tank';
 if(['Ornn','Leona','Blitzcrank'].includes(u.champion.id))return 'tank';
 if(['Janna','Nami','Sona'].includes(u.champion.id))return 'support';
 if(['Garen','Aatrox','Ashe','Yasuo','Darius'].includes(u.champion.id))return 'ad';
 if(u.champion.id==='Kaisa')return seed%3===0?'ap':'ad';
 return 'ap';
}
export function preferredPath(u:Unit,seed=0):BuildPath{
 if(hasAugment(u,'마법사 (물리)'))return 'ad';
 return u.combat?.buildPath??suggestedPath(u,seed);
}
export function routeFor(u:Unit,seed=0){
 const path=preferredPath(u,seed);
 if(u.aiBuild?.champion===u.champion.id&&u.aiBuild.path===path)return [...u.aiBuild.route];
 if(path==='ap'&&u.champion.id==='Evelynn')return ['3100','3020','3089','4645','3135','3157'];
 if(path==='ad'&&u.champion.id==='Garen')return ['6631','3006','3046','3033','3742','3053'];
 if(path==='ad'&&u.champion.id==='Aatrox')return ['6692','3047','3161','3071','6333','3065'];
 if(path==='ad'&&u.champion.id==='Darius')return ['3078','3047','3053','3071','6333','3065'];
 if(path==='ad'&&u.champion.id==='Yasuo')return ['3006','3087','3031','3153','6333','3072'];
 if(path==='ad'&&u.champion.id==='Kaisa')return ['6672','3006','3124','3115','3153','3036'];
 if(path==='ap'&&u.champion.id==='Kaisa')return ['3115','3020','3124','3089','3135','3157'];
 if(path==='ap'&&u.champion.id==='Malphite')return ['3118','3020','4646','4645','3089','3157'];
 if(path==='ap'&&u.champion.id==='Kennen')return ['3152','3020','3157','4645','3089','3135'];
 return [...buildRoutes[path]];
}
export const antiHealIds=['3123','3033','3076','3075','3916','3165'];
export const ownsAntiHeal=(u:Unit)=>u.items.some(id=>antiHealIds.includes(id));
export function antiHealPlan(u:Unit,seed=0){const p=preferredPath(u,seed);return p==='tank'?{component:'3076',final:'3075'}:p==='ad'?{component:'3123',final:'3033'}:{component:'3916',final:'3165'};}
export function augmentFit(u:Unit,a:Augment,seed=0){
 const path=preferredPath(u,seed),kit=kitFor(u),s=statsFor(u),n=a.name.replace(/\s*\([★☆-]+\)/g,'');
 const caster=path==='ap',support=path==='support',tank=path==='tank',attacker=path==='ad';
 const hardCC=['Ornn','Aatrox','Kennen','Evelynn'].includes(u.champion.id)||kit.some(k=>k.cc==='stun'||k.cc==='root'),healer=['Garen','Aatrox'].includes(u.champion.id)||kit.some(k=>k.kind==='heal'||k.kind==='shield');
 let score=30,reason='범용 능력치를 보완합니다';
 if(a.tags.includes('basic-attack')){score=attacker?88:tank?45:25;reason='공격 속도와 기본 공격 중심 빌드에 연결합니다';}
 if(a.tags.includes('ability-power')){score=caster?90:support?72:25;reason='주문력·스킬 위주 빌드를 강화합니다';}
 if(a.tags.includes('damage')){score=attacker||caster?80:40;reason='현재 공격 능력치로 피해를 늘립니다';}
 if(a.tags.includes('adaptive')){score=65;reason='여러 빌드에 사용할 수 있는 능력치를 더합니다';}
 if(a.tags.includes('durability')){score=tank?90:55;reason='생존력과 전방 유지 시간을 늘립니다';}
 if(a.tags.includes('heal-shield')){score=support?95:healer?65:5;reason=healer?'회복·보호막 효과를 강화합니다':'회복·보호막 수단이 적어 효율이 낮습니다';}
 if(a.tags.includes('mana')){score=s.mana>0?(caster||tank?80:50):0;reason=s.mana>0?'최대 마나와 마나 아이템을 활용합니다':'마나를 사용하지 않아 이 효과를 활용할 수 없습니다';}
 if(a.tags.includes('movement')){score=60;reason='기동성과 전장 복귀를 보완합니다';}
 if(['그림자 질주','무법자의 투지','대지의 각성','돌진'].includes(n)){const dash=kit.some(k=>k.dash||['last-caress','whiplash'].includes(k.special??''));score=dash?85:1;reason=dash?'이동 스킬로 추가 효과를 발동합니다':'발동할 이동 스킬이 없습니다';}
 if(n==='차가운 냉기'){const slow=kit.some(k=>k.cc==='slow')||['Ashe','Nami','Evelynn'].includes(u.champion.id)||u.items.includes('3116');score=slow?75:5;reason=slow?'기존 둔화로 추격·보호를 강화합니다':'둔화 수단이 적어 효과를 발동하기 어렵습니다';}
 if(n==='다단 중첩'){const stacks=u.champion.id==='Veigar'||hasAugment(u,'극악무도');score=stacks?100:1;reason=stacks?'영구 주문력 중첩을 빠르게 쌓습니다':'지원되는 영구 주문력 중첩 수단이 없습니다';}
 if(['도취','정신 변환'].includes(n)&&s.mana===0)score=0;
 if(['마법 명사수','전술적 대비','유레카'].includes(n)){score=caster?90:s.ap>80?75:10;reason='주문력 아이템을 추가 피해·보호막·가속으로 연결합니다';}
 if(n==='너만을 위해'){const allySupport=kit.some(k=>k.kind==='heal'||k.kind==='shield'&&k.range>0);score=allySupport?95:1;reason=allySupport?'아군에게 사용하는 회복·보호막을 강화합니다':'아군 회복·보호막 스킬이 없어 효과가 제한됩니다';}
 if(n==='후원'){score=65;reason='핵심 아이템 구매 시점을 앞당깁니다';}
 if(['궁극의 저지 불가','난공불락','최종 형태'].includes(n)){score=tank||attacker?80:65;reason='궁극기 사용 후 생존과 후속 교전을 보완합니다';}
 if(n==='응급 처치 키트'){score=support?100:healer?45:4;reason=healer?'회복·보호막 스킬을 강화합니다':'회복·보호 스킬이 적어 효율이 낮습니다';}
 if(n==='마법사 (물리)'){score=attacker?75:2;reason=attacker?'물리 공격 빌드와 연결합니다':'주문력을 공격력으로 바꾸면 현재 스킬 계수가 손해입니다';}
 if(n==='강타자'){score=tank||attacker?82:25;score+=Math.min(15,s.bonusHp/100);reason='체력과 기본 공격을 함께 활용합니다';}
 if(n==='능력치!'){score=60;reason='현재 역할에 범용 능력치를 더합니다';}
 if(n==='감쇠 광선'){score=attacker?90:tank?55:25;reason='기본 공격으로 적의 피해를 낮춥니다';}
 if(n==='극악무도'){score=caster?95:support?55:attacker?8:30;reason='반복 스킬 적중과 주문력 계수를 활용합니다';}
 if(n==='급속 성장'){score=tank?88:attacker?65:50;reason='저체력 생존과 근접 교전을 보완합니다';}
 if(n==='마법 미사일'){score=caster?90:support?65:45;reason='스킬 적중과 원거리 견제에 연결합니다';}
 if(n==='거석상의 용기'){score=hardCC?(tank?100:65):1;reason=hardCC?'이동 불가 스킬로 보호막을 발동합니다':'발동 가능한 이동 불가 스킬이 없습니다';}
 if(n==='거인'){score=tank?92:attacker?70:55;reason='체력과 피해 능력치를 함께 키웁니다';if(hasAugment(u,'강타자')||u.items.includes('3084'))score+=20;}
 if(n==='거인 학살자'){score=caster||attacker?85:25;reason='딜러 빌드의 큰 체력 대상 공격을 강화합니다';}
 if(n==='궁극기 대변혁'){score=kit.some(k=>k.slot==='R')?80:1;reason='궁극기 연계를 한 번 더 사용할 수 있습니다';}
 const grade=augmentGrade(u.champion.id,a.name);
 if(grade.grade){if(score>=40)score+=({S:18,A:10,B:4,C:0,D:-4,E:-8} as Record<string,number>)[grade.grade]??0;return {score,reason:reason+` · OP.GG ${grade.grade} 티어 (${grade.patch})`,source:grade.url};}
 const source=(references.champions as Record<string,{url:string;augments:string[]}>)[u.champion.id];
 const referenced=!!source?.augments.includes(n);if(referenced&&score>=40)score+=12;
 return {score,reason:reason+(referenced?' · OP.GG 추천 목록 참고':''),source:referenced?source.url:undefined};
}
export function pickAiAugment(u:Unit,options:Augment[],rng:Rng,seed=0){
 const ranked=options.map(a=>({a,...augmentFit(u,a,seed)})).sort((a,b)=>b.score-a.score);
 if(!ranked.length)return undefined;
 // Mostly the best fit; alternatives remain within a useful synergy band.
 const pool=ranked.filter(a=>a.score>=ranked[0].score*.65);
 return rng.chance(.88)?ranked[0]:rng.pick(pool);
}
