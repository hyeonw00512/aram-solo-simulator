import {it,expect} from 'vitest';
import {existsSync} from 'node:fs';
import {createGame} from '../src/engine/game';
import {augments,playableChampions} from '../src/engine/data';
import {applyAugment,augmentDescription} from '../src/engine/augments';
import {statsFor,refreshStats} from '../src/engine/stats';
import {state,effect} from '../src/engine/runtime';
import {applyDamage,resolveAttack,grantShield,respawn} from '../src/engine/combat';
import {Rng} from '../src/engine/rng';
import icons from '../data/augment-icons.json';
import type {Game,Unit} from '../src/engine/types';
function match(){const g=createGame(17);g.phase='playing';g.time=100;for(const u of [...g.blue,...g.red]){u.atFountain=false;u.position=u.team==='blue'?44:52;u.level=10;u.champion=playableChampions.find(c=>c.id==='Ashe')!;u.items=[];u.augments=[];u.combat=undefined;refreshStats(u,true);state(u);}return g;}
function grant(g:Game,u:Unit,name:string){applyAugment(g,u,augments.find(a=>a.name===name)!);}
it('has enough distinct implemented cards and local icons for every individual reroll',()=>{
 for(const tier of ['silver','gold','prism'])expect(augments.filter(a=>a.tier===tier)).toHaveLength(24);
 expect(new Set(augments.map(a=>a.id)).size).toBe(augments.length);
 for(const a of augments){expect(augmentDescription(a.name)).not.toContain('아직 지원되지');const icon=(icons.data as Record<string,{file:string}>)[a.id];expect(icon,a.name).toBeDefined();expect(existsSync('public'+icon.file),a.name).toBe(true);}
});
it('applies attack speed, attack damage, haste and crit to actual combat stats',()=>{
 const g=match(),u=g.blue[0],before=statsFor(u);grant(g,u,'능수능란');expect(statsFor(u).attackSpeed).toBeGreaterThan(before.attackSpeed);grant(g,u,'육중한 힘');expect(statsFor(u).ad).toBeCloseTo(before.ad*1.2);
 grant(g,u,'되풀이');expect(statsFor(u).haste).toBe(60);grant(g,u,'치명적인 공격');expect(statsFor(u).crit).toBe(.5);
});
it('uses final AP for Eureka, extends attack reach and scales shields from bonus resistances',()=>{
 const g=match(),u=g.blue[0];u.items=['3089','1031'];const before=statsFor(u);grant(g,u,'유레카');expect(statsFor(u).haste).toBeCloseTo(before.ap*.3);
 grant(g,u,'최상급 조준경 부착');expect(statsFor(u).attackRange-before.attackRange).toBe(6);
 grant(g,u,'프로틴 음료 (-)');expect(statsFor(u).healPower).toBeGreaterThan(1.25);grantShield(g,u,u,100,'protein');expect(effect(u,'shield')).toBe(Math.round(100*statsFor(u).healPower));
});
it('grants four anvil rewards once, preserving them through duplicate selection attempts',()=>{
 const g=match(),u=g.blue[0];grant(g,u,'능력치 더하기 능력치 더하기 능력치!');const c=state(u).counters;expect((c.anvilHp??0)/180+(c.anvilAp??0)/25+(c.anvilAd??0)/15+(c.anvilArmor??0)/15).toBe(4);
 const before=structuredClone(c);grant(g,u,'능력치 더하기 능력치 더하기 능력치!');expect(c).toEqual(before);
});
it('reduces cooldowns on a real basic attack without resetting them or going before current time',()=>{
 const g=match(),u=g.blue[0],v=g.red[0];grant(g,u,'신비한 주먹 (-)');state(u).ready={Q:200,W:200,E:200,R:200};state(u).nextAttack=0;
 resolveAttack(g,u,v,new Rng(1));expect(state(u).ready).toEqual({Q:198.75,W:198.75,E:198.75,R:198.75});
});
it('trades health for one non-recursive true damage hit and awards a lethal hit only once',()=>{
 const g=match(),u=g.blue[0],v=g.red[0],hp=u.maxHealth;grant(g,u,'유리 대포');expect(u.maxHealth).toBe(Math.round(hp*.7));
 const before=v.health;applyDamage(g,u,v,100,'test','true');expect(before-v.health).toBe(125);
 v.health=110;const kills=u.kills;expect(applyDamage(g,u,v,100,'test','true')).toBe(true);expect(u.kills-kills).toBe(1);expect(v.deaths).toBe(1);
});
it('applies both scientist forms and rerolls a valid form on respawn',()=>{
 const g=match(),u=g.blue[0],before=statsFor(u);grant(g,u,'미친 과학자 (★★)');state(u).counters.scientistForm=1;expect(statsFor(u).hp).toBe(Math.round(before.hp*1.2));expect(statsFor(u).ad).toBeCloseTo(before.ad*1.3);
 state(u).counters.scientistForm=2;expect(statsFor(u).haste).toBe(70);expect(statsFor(u).moveSpeed).toBeCloseTo(before.moveSpeed*1.3);
 u.alive=false;u.respawnAt=g.time;u.deaths++;respawn(g);expect([1,2]).toContain(state(u).counters.scientistForm);expect(u.health).toBe(statsFor(u).hp);
});
