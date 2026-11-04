import {it,expect} from 'vitest';
import {createGame,tick} from '../src/engine/game';
import {playableChampions,augments} from '../src/engine/data';
import {expandedAugments} from '../src/engine/augment-catalog';
import {applyAugment,augmentDescription} from '../src/engine/augments';
import {augmentFit} from '../src/engine/build-advisor';
import {statsFor,refreshStats} from '../src/engine/stats';
import {state,effect,hasAugment} from '../src/engine/runtime';
import {castAbility,resolveAttack,applyDamage,advanceCombat,heal,grantShield,respawn} from '../src/engine/combat';
import {augmentSkillHaste} from '../src/engine/augment-effects';
import {kitFor} from '../src/engine/kits';
import {Rng} from '../src/engine/rng';
import type {Game,Unit} from '../src/engine/types';
function lane(champion='Lux'){
 const g=createGame(17);g.phase='playing';g.time=100;g.nextDecision=99999;
 for(const u of [...g.blue,...g.red]){u.atFountain=false;u.position=u.team==='blue'?44:52;u.level=10;u.champion=playableChampions.find(c=>c.id===champion)!;u.items=[];u.augments=[];u.combat=undefined;u.skillRanks={Q:1,W:1,E:1,R:1};refreshStats(u,true);state(u);}
 return g;
}
function grant(g:Game,name:string,u=g.blue[0]){return applyAugment(g,u,augments.find(a=>a.name===name)!);}
function rng(){const r=new Rng(17);r.chance=()=>false;return r;}
function attack(g:Game,u=g.blue[0],v=g.red[0]){state(u).ready={Q:99999,W:99999,E:99999,R:99999};state(u).nextAttack=0;return resolveAttack(g,u,v,rng());}
it('includes 48 expanded effects and 72 distinct cards',()=>{
 expect(expandedAugments).toHaveLength(48);expect(augments).toHaveLength(72);
 for(const [id] of expandedAugments){const a=augments.find(a=>a.id===id)!;expect(a).toBeDefined();expect(augmentDescription(a.name)).toContain('시뮬레이션');}
});
it('applies scaling AP, attack stats, lifesteal and additive scope range',()=>{
 const g=lane(),u=g.blue[0],before=statsFor(u);grant(g,'광신자');expect(statsFor(u).crit).toBe(.25);expect(statsFor(u).attackSpeed).toBeGreaterThan(before.attackSpeed);
 grant(g,'사악한 정신');expect(statsFor(u).ap).toBeCloseTo(20+60*9/17);u.level=18;expect(statsFor(u).ap).toBe(80);
 grant(g,'선혈포식');expect(statsFor(u).omnivamp).toBe(.15);grant(g,'조준경 부착');grant(g,'상급 조준경 부착');expect(statsFor(u).attackRange-before.attackRange).toBe(6);
});
it('uses mana for health and on-hit damage, with no benefit on energy champions',()=>{
 const g=lane(),u=g.blue[0];u.items=['1027'];refreshStats(u,true);const s=statsFor(u);grant(g,'정신 변환');expect(statsFor(u).bonusHp).toBeCloseTo(s.bonusHp+s.mana*.5);
 const control=structuredClone(g);grant(g,'도취');attack(g);attack(control);expect(g.red[0].health).toBeLessThan(control.red[0].health);
 const energy=lane('Kennen'),e=energy.blue[0],hp=e.maxHealth;grant(energy,'정신 변환');expect(e.maxHealth).toBe(hp);expect(augmentFit(e,augments.find(a=>a.name==='도취')!).score).toBe(0);
});
it('applies AP on-hit and multiplicative percentage penetration',()=>{
 const g=lane(),u=g.blue[0];u.items=['3089','3135','3036'];const s=statsFor(u);grant(g,'바늘에 실 끼우기');expect(statsFor(u).armorPen).toBeCloseTo(1-(1-s.armorPen)*.82);expect(statsFor(u).magicPen).toBeCloseTo(1-(1-s.magicPen)*.82);
 const control=structuredClone(g);grant(g,'마법 명사수');attack(g);attack(control);expect(g.red[0].health).toBeLessThan(control.red[0].health);
});
it('grants support-only amplification and one-time gold and anvil rewards',()=>{
 const g=lane(),u=g.blue[0],v=g.blue[1];grant(g,'너만을 위해');u.health-=500;v.health-=500;expect(heal(g,u,u,100)).toBe(100);expect(heal(g,u,v,100)).toBe(130);grantShield(g,u,v,100,'test');expect(effect(v,'shield')).toBe(130);
 const gold=u.gold;grant(g,'후원');grant(g,'후원');expect(u.gold-gold).toBe(1750);grant(g,'능력치 더하기 능력치!');const c=state(u).counters;expect((c.anvilHp??0)/180+(c.anvilAp??0)/25+(c.anvilAd??0)/15+(c.anvilArmor??0)/15).toBe(3);
});
it('reduces only the selected ability cooldown for the three bread augments',()=>{
 for(const [name,slot] of [['빵과 버터','Q'],['빵과 잼','W'],['빵과 치즈','E']] as const){
  const g=lane(),u=g.blue[0];grant(g,name);const spell=kitFor(u).find(a=>a.slot===slot)!;
  expect(augmentSkillHaste(u,spell)).toBe(100);expect(augmentSkillHaste(u,kitFor(u).find(a=>a.slot==='R')!)).toBe(0);
  expect(castAbility(g,u,g.red[0],slot,rng())).toBe(true);expect(state(u).ready[slot]!-g.time).toBeCloseTo(spell.cd/2);
 }
});
it('combines dash haste, speed and resistance then expires temporary stacks',()=>{
 const g=lane('Kennen'),u=g.blue[0],before=statsFor(u);for(const name of ['그림자 질주','무법자의 투지','돌진'])grant(g,name);
 const spell=kitFor(u).find(a=>a.slot==='E')!;expect(castAbility(g,u,g.red[0],'E',rng())).toBe(true);expect(state(u).ready.E!-g.time).toBeCloseTo(spell.cd/2.75);
 expect(statsFor(u).armor-before.armor).toBe(12);expect(statsFor(u).mr-before.mr).toBe(12);expect(statsFor(u).moveSpeed-before.moveSpeed).toBe(300);
 g.time+=3;advanceCombat(g);expect(state(u).counters.dashMove).toBe(0);g.time+=6;advanceCombat(g);expect(state(u).counters.outlaw).toBe(0);
});
it('gives ultimate CC immunity, damage immunity and final-form buffs independently',()=>{
 const g=lane(),u=g.blue[0];for(const name of ['궁극의 저지 불가','난공불락 (-)','최종 형태'])grant(g,name);
 expect(castAbility(g,u,g.red[0],'R',rng())).toBe(true);expect(state(u).procs.unstoppableUntil).toBe(g.time+3);expect(state(u).procs.augmentInvulnerableUntil).toBe(g.time+2);expect(effect(u,'shield')).toBeGreaterThanOrEqual(u.maxHealth*.5-.5);expect(statsFor(u).omnivamp).toBe(.2);
 const hp=u.health;applyDamage(g,g.red[0],u,100,'test','true');expect(u.health).toBe(hp);expect(castAbility(g,g.red[1],u,'Q',rng())).toBe(true);expect(effect(u,'root')).toBe(0);
 g.time+=11;advanceCombat(g);expect(state(u).counters.finalVamp).toBe(0);state(u).effects=[];applyDamage(g,g.red[0],u,100,'test','true');expect(u.health).toBeLessThan(hp);
});
it('adds celestial health with its damage penalty and scales dark bargain with missing health',()=>{
 const g=lane(),u=g.blue[0],hp=u.maxHealth;grant(g,'천상의 신체');expect(u.maxHealth-hp).toBe(1500);const before=g.red[0].health;applyDamage(g,u,g.red[0],100,'test','true');expect(before-g.red[0].health).toBe(90);
 const pact=lane(),p=pact.blue[0];grant(pact,'불길한 서약');expect(statsFor(p).ap).toBe(75);p.health=p.maxHealth*.3;expect(statsFor(p).ap).toBe(150);expect(statsFor(p).omnivamp).toBeCloseTo(.2);const old=p.health;castAbility(pact,p,pact.red[0],'Q',rng());expect(p.health).toBeGreaterThan(old*.95); // cost followed by spell vamp
});
it('tracks corrosion without leaking expired stacks and doubles permanent AP gains',()=>{
 const g=lane(),u=g.blue[0],v=g.red[0];grant(g,'부식');attack(g);expect(effect(v,'armor-shred')).toBeCloseTo(.015);attack(g);expect(effect(v,'magic-shred')).toBeCloseTo(.03);g.time+=5;attack(g);expect(effect(v,'armor-shred')).toBeCloseTo(.015);
 const mage=lane('Veigar');grant(mage,'극악무도');grant(mage,'다단 중첩');castAbility(mage,mage.blue[0],mage.red[0],'Q',rng());expect(state(mage.blue[0]).counters.permanentAp).toBeGreaterThanOrEqual(4);
});
it('slows more with chilly effects and resists slowing with leg day',()=>{
 const g=lane(),u=g.blue[0],v=g.red[0];grant(g,'차가운 냉기');const ms=statsFor(v).moveSpeed;castAbility(g,u,v,'E',rng());expect(state(v).counters.chillFlat).toBe(75);expect(statsFor(v).moveSpeed).toBeCloseTo(ms*.7-75);
 grant(g,'하체 운동의 날',v);expect(statsFor(v).moveSpeed).toBeCloseTo((ms+50)*(1-.3*.6)-75);g.time+=4;advanceCombat(g);expect(state(v).counters.chillFlat).toBe(0);
});
it('uses homeguard outside combat, haste for movement and kill participation for speed',()=>{
 const g=lane(),u=g.blue[0],base=statsFor(u).moveSpeed;grant(g,'민병대');advanceCombat(g);expect(statsFor(u).moveSpeed).toBe(base*2);applyDamage(g,g.red[0],u,10,'test','true');expect(statsFor(u).moveSpeed).toBe(base);
 grant(g,'되풀이');grant(g,'속행');expect(statsFor(u).moveSpeed).toBe(base+42);
 grant(g,'신난다!');applyDamage(g,u,g.red[0],999999,'test','true');expect(state(u).counters.excitedAs).toBe(.15);expect(effect(u,'speed')).toBe(1);g.time+=5;advanceCombat(g);expect(state(u).counters.excitedAs).toBe(0);
});
it('activates poltergeist in danger and reapplies the AP shield on respawn',()=>{
 const g=lane(),u=g.blue[0];grant(g,'폴터가이스트');u.health=u.maxHealth*.4;advanceCombat(g);expect(effect(u,'shield')).toBeGreaterThan(100);expect(effect(u,'speed')).toBe(.3);
 grant(g,'전술적 대비');u.items=['3089'];u.alive=false;u.respawnAt=g.time;respawn(g);expect(effect(u,'shield')).toBeCloseTo(statsFor(u).ap*3,0);expect(state(u).procs['tactical-shield']).toBe(g.time+70);
});
it('stacks duelist and tap dancer, then clears them after expiry and respawn',()=>{
 const g=lane(),u=g.blue[0];grant(g,'결투의 대가 (-)');grant(g,'탭 댄서');const base=statsFor(u);attack(g);expect(statsFor(u).ap).toBeGreaterThan(base.ap);expect(statsFor(u).moveSpeed-base.moveSpeed).toBe(10);
 state(u).ready.Q=0;castAbility(g,u,g.red[0],'Q',rng());expect(statsFor(u).ad).toBeGreaterThan(base.ad);g.time+=9;advanceCombat(g);expect(state(u).counters.duelistAd).toBe(0);expect(state(u).counters.tapStacks).toBe(0);
 attack(g);u.alive=false;u.respawnAt=g.time;respawn(g);expect(state(u).counters.duelistAp).toBe(0);
});
it('explodes saved earthwake trails once and applies stacking conduit burn with cooldown refunds',()=>{
 const g=lane('Kennen'),u=g.blue[0],v=g.red[0];grant(g,'대지의 각성');castAbility(g,u,v,'E',rng());const after=v.health;g.time++;advanceCombat(g);expect(v.health).toBeLessThan(after);expect(Object.keys(state(u).procs).filter(k=>k.startsWith('earthwake:'))).toHaveLength(0);
 const h=lane(),a=h.blue[0],b=h.red[0];grant(h,'지옥의 전도체');castAbility(h,a,b,'Q',rng());expect(state(b).effects.some(e=>e.key?.endsWith(':conduit'))).toBe(true);const ready=state(a).ready.Q!;h.time++;advanceCombat(h);expect(state(a).ready.Q).toBeCloseTo(ready-.08);
});
it('continues identically after saving expanded augment combat state',()=>{
 const g=lane();for(const name of ['대지의 각성','지옥의 전도체','민병대','결투의 대가 (-)'])grant(g,name);
 castAbility(g,g.blue[0],g.red[0],'Q',rng());const restored=JSON.parse(JSON.stringify(g));expect(tick(g)).toEqual(tick(restored));
 expect(augmentFit(g.blue[0],augments.find(a=>a.name==='돌진')!).score).toBe(1);
 expect(hasAugment(g.blue[0],'지옥의 전도체')).toBe(true);
});
it('supports mountain shielding, every-fourth-hit fireworks and infernal proc cooldowns',()=>{
 const g=lane(),u=g.blue[0];grant(g,'대지의 영혼');advanceCombat(g);expect(effect(u,'shield')).toBe(Math.round(u.maxHealth*.1));
 grant(g,'불을 밝혀');grant(g,'지옥불 영혼');for(let i=0;i<4;i++)attack(g);
 expect(g.logs.filter(l=>l.text.startsWith('불을 밝혀 —'))).toHaveLength(1);expect(g.logs.filter(l=>l.text.startsWith('지옥불 영혼 —'))).toHaveLength(1);
});
it('only grants chase speed while moving toward a low-health nearby enemy',()=>{
 const g=lane(),u=g.blue[0],v=g.red[0],ms=statsFor(u).moveSpeed;grant(g,'확보된 킬');v.health=v.maxHealth*.3;advanceCombat(g);expect(statsFor(u).moveSpeed).toBe(ms);
 u.position+=1;g.time++;advanceCombat(g);expect(statsFor(u).moveSpeed).toBe(ms*2);u.position-=1;g.time++;advanceCombat(g);expect(statsFor(u).moveSpeed).toBe(ms);
});
it('fires boomerangs on cooldown and heals dawnbringer over three ticks',()=>{
 const g=lane(),u=g.blue[0];grant(g,'부메랑 투척');advanceCombat(g);g.time++;advanceCombat(g);expect(g.logs.filter(l=>l.text.startsWith('부메랑 투척 —'))).toHaveLength(1);
 const h=lane(),a=h.blue[0];a.health=a.maxHealth*.3;const control=structuredClone(h);grant(h,'빛의 인도자 결의');for(let i=0;i<3;i++){h.time++;control.time++;advanceCombat(h);advanceCombat(control);}
 expect(a.health-control.blue[0].health).toBe(Math.round(a.maxHealth*.1)*3);expect(state(a).counters.dawnTicks).toBe(0);applyDamage(h,undefined,a,99999,'test','true');expect(state(a).procs.dawnbringer).toBeUndefined();
});
it('makes critical healing deterministic and adds soul-siphon recovery on critical attacks',()=>{
 const g=lane(),u=g.blue[0];for(const name of ['치명적 치유','치명적인 공격','한 발에 두 놈'])grant(g,name);u.health-=500;const copy=structuredClone(g);
 expect(heal(g,u,u,100)).toBe(150);expect(heal(copy,copy.blue[0],copy.blue[0],100)).toBe(150);expect(state(u).counters.criticalHeals).toBe(state(copy.blue[0]).counters.criticalHeals);grantShield(g,u,u,100,'critical');expect(effect(u,'shield')).toBe(150);
 const h=lane(),a=h.blue[0];a.health-=500;grant(h,'영혼 흡수');state(a).ready={Q:99999,W:99999,E:99999,R:99999};const before=a.health,r=new Rng(1);r.chance=()=>true;resolveAttack(h,a,h.red[0],r);expect(a.health).toBeGreaterThan(before);
});
it('applies ultimate lure and damage reduction, and polymorph prevents actions until expiry',()=>{
 const g=lane(),u=g.blue[0],v=g.red[0];grant(g,'도망갈 수 없어 (-)');castAbility(g,u,v,'R',rng());expect(effect(v,'charm')).toBe(1);const hp=u.health;applyDamage(g,v,u,100,'test','true');expect(hp-u.health).toBe(75);
 const h=lane(),a=h.blue[0],b=h.red[0];grant(h,'요정 마법');castAbility(h,a,b,'R',rng());expect(state(b).procs.polymorphUntil).toBe(h.time+2);expect(castAbility(h,b,a,'Q',rng())).toBe(false);const before=a.health;attack(h,b,a);expect(a.health).toBe(before);
 h.time+=3;advanceCombat(h);state(b).ready.Q=0;expect(castAbility(h,b,a,'Q',rng())).toBe(true);
});
it('deals circle-of-death damage from actual healing without recursion or overheal damage',()=>{
 const g=lane(),u=g.blue[0],v=g.red[0];grant(g,'죽음의 순환');const hp=v.health;heal(g,u,u,100);expect(v.health).toBe(hp);
 u.health-=300;heal(g,u,u,100);expect(v.health).toBeLessThan(hp);const after=v.health;heal(g,u,u,100);expect(v.health).toBe(after);g.time++;heal(g,u,u,100);expect(v.health).toBeLessThan(after);
});
it('repeats eligible on-hit damage once on a critical attack',()=>{
 const g=lane(),u=g.blue[0];grant(g,'강타자');const control=structuredClone(g);grant(g,'한 발에 두 놈');
 for(const h of [g,control]){const a=h.blue[0],r=new Rng(1);r.chance=()=>true;state(a).ready={Q:99999,W:99999,E:99999,R:99999};resolveAttack(h,a,h.red[0],r);}
 expect(g.red[0].health).toBeLessThan(control.red[0].health);
});
