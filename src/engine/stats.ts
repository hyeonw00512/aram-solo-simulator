import type { Unit } from "./types";
import { itemBonuses } from "./items";
import config from "../../data/simulation.json";
import {effect,augmentName} from './runtime';
import {resourceKind,resourceRule,baseResourceMax} from './resources';
import growthStats from '../../data/champion-growth.json';
export function statsFor(unit: Unit) {
 const aug=new Set(unit.augments.map(a=>augmentName(a.name)));
 const base={...unit.champion.stats,...(growthStats.champions as Record<string,{attackdamageperlevel:number;attackspeedratio:number}>)[unit.champion.id]},item=itemBonuses(unit.items),r=unit.combat,c=r?.counters??{};
 const growth=(unit.level-1)*(config.levelGrowth.base+config.levelGrowth.perLevel*(unit.level-1));
 if(unit.masterwork&&unit.items.includes(unit.masterwork.itemId))for(const [k,v] of Object.entries(unit.masterwork.bonuses))item[k]=(item[k]??0)+v;
 const add=(key:string)=>item[key]??0,has=(id:string)=>unit.items.includes(id);
 const stacks=has('6657')?Math.min(10,Math.floor((c.itemAge??0)/60)):0;
 let bonusHp=add('FlatHPPoolMod')+(c.permanentHp??0)+(c.anvilHp??0)+(c.growthHp??0)+stacks*10+(c.elixirHp??0);
 if(has('3083'))bonusHp+=add('FlatHPPoolMod')*.12;
 const kind=resourceKind(unit),resource=resourceRule(unit);
 const mana=kind==='mana'?Math.max(0,baseResourceMax(unit)+add('FlatMPPoolMod')+(c.manaCharge??0)+stacks*30):0;
 const energy=kind==='energy'?baseResourceMax(unit):0;
 if(aug.has('정신 변환'))bonusHp+=mana*.5;
 if(aug.has('천상의 신체'))bonusHp+=1500;
 if(has('3119'))bonusHp+=mana*.08;
 if(unit.champion.id==='Ornn')bonusHp*=1.1+.04*(c.ornnUpgrades??0);
 let hp=(base.hp+base.hpperlevel*growth+bonusHp)*(aug.has('거인')?1.35:1);
 const scientist=aug.has('미친 과학자')?c.scientistForm:0;
 if(scientist===1)hp*=1.2;if(aug.has('유리 대포'))hp*=.7;
 const baseAd=base.attackdamage+base.attackdamageperlevel*growth;
 const pact=aug.has('불길한 서약')?Math.min(1,Math.max(0,1-unit.health/Math.max(1,unit.maxHealth))/.7):0;
 let ad=baseAd+add('FlatPhysicalDamageMod')+(c.anvilAd??0)+(c.elixirAd??0)+(c.duelistAd??0);
 let ap=add('FlatMagicDamageMod')+(c.permanentAp??0)+(c.anvilAp??0)+(c.staffAp??0)+stacks*3+(c.elixirAp??0)+(c.duelistAp??0)+(aug.has('사악한 정신')?20+60*(unit.level-1)/17:0)+(aug.has('불길한 서약')?75+75*pact:0);
 if(has('4633'))ap+=bonusHp*.02;if(has('3003'))ap+=mana*.01;
 if(has('3004'))ad+=mana*.025;if(has('2501'))ad=(ad+bonusHp*.025)*(1+.12*(1-unit.health/Math.max(1,unit.maxHealth)));
 if(unit.champion.id==='Aatrox'&&(c.aatroxUlt??0)>0)ad*=1.1+.1*c.aatroxUlt;
 if(has('3089'))ap*=1.3;if(has('2503'))ap*=1+.04*(c.burningTargets??0);
 if(has('6621'))ap+=add('manaRegenPercent')*.15;
 if(aug.has('거인')){ad*=1.15;ap*=1.15}
 if(scientist===1){ad*=1.3;ap*=1.3}
 if(aug.has('마법사 (물리)')){ad=(ad+ap*.6)*1.15;ap=0}
 if(aug.has('육중한 힘'))ad*=1.2;
 let armor=base.armor+base.armorperlevel*growth+add('FlatArmorMod')+(c.anvilArmor??0),mr=base.spellblock+base.spellblockperlevel*growth+add('FlatSpellBlockMod');
 if(unit.champion.id==='Ornn'){const bonus=.1+.04*(c.ornnUpgrades??0);armor+=add('FlatArmorMod')*bonus;mr+=add('FlatSpellBlockMod')*bonus;}
 if(unit.champion.id==='Garen'){armor+=Math.min(30,c.garenCourage??0);mr+=Math.min(30,c.garenCourage??0);if((c.garenCourage??0)>=30){armor+=add('FlatArmorMod')*.1;mr+=add('FlatSpellBlockMod')*.1;}}
 if(unit.champion.id==='Malphite')armor*=1.15;
 armor+=(c.outlaw??0)*12;mr+=(c.outlaw??0)*12;
 if((c.resistUntil??0)>0){armor+=20+unit.level;mr+=20+unit.level}
 if(has('6665')&&(c.combatSeconds??0)>=5){armor+=add('FlatArmorMod')*.3;mr+=add('FlatSpellBlockMod')*.3}
 if(has('4401')&&(c.magicHits??0)>=8)mr+=70;if(has('3302')){armor+=Math.min(20,c.attacks??0);mr+=Math.min(20,c.attacks??0)}
 armor*=1-Math.min(.5,effect(unit,'armor-shred'));mr*=(1-Math.min(.4,c.mrShred??0))*(1-Math.min(.45,effect(unit,'magic-shred')));
 const asBonus=(c.overdrive??0)+(c.flurry??0)+(c.ardent??0)+(has('3124')?Math.min(4,c.attacks??0)*.08:0)+(has('3032')&&(c.attacks??0)>0?.3:0)+(c.ultSpeed??0)+(aug.has('능수능란')?.6:0);
 const protein=aug.has('프로틴 음료')?.25+.0035*(Math.max(0,armor-base.armor-base.armorperlevel*growth)+Math.max(0,mr-base.spellblock-base.spellblockperlevel*growth)):0;
 const haste=add('haste')+(aug.has('되풀이')?60:0)+(aug.has('유레카')?ap*.3:0)+(scientist===2?70:0)+(c.staffHaste??0)+(has('2517')?Math.max(0,ad-baseAd)*.15:0);
 return {hp:Math.round(hp),bonusHp,armor,mr,ad,baseAd,ap,mana,energy,resourceMax:kind==='flow'?100:mana+energy,
 attackSpeed:Math.min(2.5,(base.attackspeed+(base.attackspeedratio??base.attackspeed)*(base.attackspeedperlevel*growth/100+add('PercentAttackSpeedMod')+asBonus+(aug.has('광신자')?.35:0)+(c.excitedAs??0)+(c.tapStacks??0)*.001))*(c.frozen? .8:1)),
 moveSpeed:Math.max(0,(base.movespeed+add('FlatMovementSpeedMod')+(aug.has('하체 운동의 날')?50:0)+(aug.has('속행')?haste*.7:0)+(c.dashMove??0)+(c.tapStacks??0)*10)*(1+add('PercentMovementSpeedMod')+effect(unit,'speed')+(aug.has('거인 학살자')?.25:0)+(scientist===2?.3:0)+(c.homeguard??0)+(c.chaseBonus??0)+pact*.5+(has('4401')&&(c.magicHits??0)>=8?.06:0))*(1-Math.min(.7,effect(unit,'slow')*(has('3009')?.75:1)*(aug.has('하체 운동의 날')?.6:1)))-(c.chillFlat??0)-(c.polymorphSlow??0)),
 attackRange:Math.max(9,base.attackrange/25)+(aug.has('조준경 부착')?(base.attackrange<300?75:50)/25:0)+(aug.has('상급 조준경 부착')?(base.attackrange<300?200:100)/25:0)+(aug.has('최상급 조준경 부착')?(base.attackrange<300?250:150)/25:0)+(has('3094')?5:0)+(has('2523')?Math.min(5,unit.kills+unit.assists):0),
 hpRegen:(has('2051')?4:0)+(has('3112')&&mana===0?3:0)+(base.hpregen+base.hpregenperlevel*growth)/5*(1+add('hpRegenPercent')/100)+add('FlatHPRegenMod'),
 manaRegen:kind==='mana'?(resource.regen+resource.regenGrowth*growth)/5*(1+add('manaRegenPercent')/100)+(has('3112')?2:0)+(has('1056')?1:0):0,
 energyRegen:kind==='energy'?resource.regen/5:0,
 haste,
 crit:Math.min(1,(add('FlatCritChanceMod')+(['영혼 흡수','치명적 치유','한 발에 두 놈'].filter(name=>aug.has(name)).length*.25)+(aug.has('광신자')?.25:0)+(aug.has('치명적인 공격')?.5:0)+(aug.has('보석 건틀릿')?.2:0)+(has('3039')?Math.min(.3,bonusHp/5000):0)+(has('3032')?Math.min(.25,(c.attacks??0)*.005):0))*(unit.champion.id==='Yasuo'?2:1)),
 lifesteal:add('PercentLifeStealMod')+(has('3074')?.1:0),
 omnivamp:(aug.has('선혈포식')?.15:0)+pact*.2+(c.finalVamp??0)+(has('3146')?.1:0)+(has('4633')&&(c.combatSeconds??0)>=4?.08:0)+(has('1055')?.025:0)+(has('1086')?.015:0)+(has('2517')?.05:0)+(has('3008')?.04+Math.min(10,unit.kills+unit.assists)*.006:0)+(c.mawVamp??0)+((c.elixirAd??0)>0?.1:0),
 healPower:1+protein+add('healPower')/100+(has('6621')?add('manaRegenPercent')*.0002:0)+(aug.has('응급 처치 키트')?.2:0)+(has('2526')&&(c.supportCharge??0)>=360?.15:0),
 armorPen:1-(1-Math.max(add('armorPen'),has('3035')?.18:0,has('3033')?.3:0,has('3036')||has('6694')?.35:0))*(aug.has('바늘에 실 끼우기')?.82:1),
 magicPen:1-(1-Math.max(has('3135')?.4:0,has('3137')?.3:0,has('4630')?.13:0))*(aug.has('바늘에 실 끼우기')?.82:1),
 flatMagicPen:add('flatMagicPen'),lethality:add('lethality'),tenacity:1-(1-add('tenacity')/100)*(1-(c.garenTenacity??0))};
}
export function buildIdentity(u:Unit){const s=statsFor(u);const tank=s.bonusHp/7+(s.armor+s.mr-65)*1.2,magic=s.ap*1.2,physical=(s.ad-s.baseAd)*1.3+(s.attackSpeed-.65)*90+s.crit*70;
 const score=Math.max(tank,magic,physical);
 if(score<45)return {role:['Janna','Nami','Sona'].includes(u.champion.id)?'support':u.champion.roles[0],label:'기본 빌드',tank,magic,physical};
 const role=magic>=tank&&magic>=physical?'mage':physical>=tank?'marksman':'tank';
 return {role,label:role==='mage'?'주문력 중심':role==='tank'?'생존·전방 유지':'평타·물리 피해',tank,magic,physical};
}
export function refreshStats(unit:Unit,fill=false){const hp=statsFor(unit).hp,missing=unit.maxHealth-unit.health;unit.maxHealth=hp;unit.health=unit.alive?fill?hp:Math.max(1,Math.min(hp,hp-missing)):0;}
export function resistanceMultiplier(resistance:number){return resistance>=0?100/(100+resistance):2-100/(100-resistance);}
