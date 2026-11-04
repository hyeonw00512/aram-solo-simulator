import {it,expect} from 'vitest';
import {createGame,tick} from '../src/engine/game';
import {grantExperience,advanceExperience,awardMinionExperience,awardChampionExperience,grantBonusLevel,xpAtLevel,xpProgress,respawnSeconds} from '../src/engine/progression';
import {statsFor,refreshStats} from '../src/engine/stats';
import {state} from '../src/engine/runtime';
import {playableChampions} from '../src/engine/data';
import {levelGrowth} from '../src/engine/resources';
import {applyDamage,advanceCombat} from '../src/engine/combat-v4';
import {respawn} from '../src/engine/combat';
import {upgradeBattleSave} from '../src/storage';
import {advanceWorld,ensureWorld} from '../src/engine/world';
import type {Minion} from '../src/engine/types';
import {readFileSync} from 'node:fs';
import progressionRules from '../data/progression.json';
function setup(){const g=createGame(17);g.phase='playing';g.time=100;g.nextDecision=9999;g.nextAugmentLevel=99;for(const u of [...g.blue,...g.red]){u.position=u.team==='blue'?10:90;u.atFountain=true;}return g;}
const minion=():Minion=>({id:'m-test',team:'red',kind:'melee',health:0,maxHealth:455,damage:0,range:2,nextAttack:99999,position:50});
it('matches the local map12 ARAM and Mayhem data instead of Summoners Rift defaults',()=>{
 const raw=JSON.parse(readFileSync('data/raw/map12.bin.json','utf8'));
 for(const mode of ['ARAM','KIWI']){const ref=raw[`Maps/Shipping/Map12/Modes/${mode}`],curve=raw[ref.mExperienceCurveData];expect(progressionRules.championBaseXp).toEqual(curve.mExperienceGrantedForKillPerLevel.slice(0,18));expect(progressionRules.respawnSecondsFromLevel3).toEqual(raw[ref.mDeathTimes].mTimeDeadPerLevel.slice(2));expect(progressionRules.respawnScaling.startSeconds).toBe(raw[ref.mDeathTimes].mScalingStartTime);expect(progressionRules.minionXpShareByRecipients).toEqual(raw[ref.mExperienceModData].mPlayerMinionSplitXp.map((x:number)=>Number(x.toFixed(6))));}
});
it('scales late death timers after 24 minutes, in minute steps, capped at 1.25x',()=>{
 expect(respawnSeconds(18,1439)).toBe(40);expect(respawnSeconds(18,1440)).toBe(40);expect(respawnSeconds(18,1499)).toBe(40);expect(respawnSeconds(18,1500)).toBe(41);expect(respawnSeconds(18,1800)).toBe(46);expect(respawnSeconds(18,2040)).toBe(50);expect(respawnSeconds(18,3600)).toBe(50);expect(respawnSeconds(3,1500)).toBe(11.275);
});
it('uses the Howling Abyss threshold table with exact early and late boundaries',()=>{
 const g=setup(),u=g.blue[0];expect(u.experience).toBe(0);grantExperience(g,u,477);expect(u.level).toBe(3);grantExperience(g,u,1);expect(u.level).toBe(4);expect(xpProgress(u)).toMatchObject({earned:0,required:510});grantExperience(g,u,510+750);expect(u.level).toBe(6);expect(u.experience).toBe(1738);grantExperience(g,u,1e6);expect(u.level).toBe(18);expect(u.experience).toBe(17698);expect(xpProgress(u).required).toBe(0);
});
it('grants passive XP to living and dead units but never during a decision',()=>{
 const g=setup();g.blue[1].alive=false;for(let i=0;i<45;i++)advanceExperience(g);expect(g.blue.every(u=>u.experience===225&&u.level===3)).toBe(true);g.phase='decision';advanceExperience(g);expect(g.blue[0].experience).toBe(225);expect(tick(g)).toBe(g);
});
it('removes the old synchronized level-up at 45 seconds',()=>{
 const g=setup();g.time=44;for(const u of [...g.blue,...g.red])u.experience=220;const next=tick(g);expect(next.time).toBe(45);expect(next.blue[0].level).toBe(3);expect(next.blue[0].experience).toBe(225);
});
it('shares minion XP only with nearby living champions and awards it once',()=>{
 const g=setup(),m=minion();for(const u of g.blue.slice(0,3)){u.position=50;u.atFountain=false;}g.blue[2].alive=false;awardMinionExperience(g,m);expect(g.blue[0].experience).toBeCloseTo(64*.6);expect(g.blue[1].experience).toBeCloseTo(38.4);expect(g.blue[2].experience).toBe(0);expect(g.blue[3].experience).toBe(0);awardMinionExperience(g,m);expect(g.blue[0].experience).toBeCloseTo(38.4);
});
it('gives full solo minion XP and no XP from live or allied minions',()=>{
 const g=setup(),u=g.blue[0];u.position=50;u.atFountain=false;awardMinionExperience(g,{...minion(),health:1});expect(u.experience).toBe(0);awardMinionExperience(g,{...minion(),team:'blue'});expect(u.experience).toBe(0);awardMinionExperience(g,minion());expect(u.experience).toBeCloseTo(64*.92);
});
it('gives a ranged last hitter a share even outside proximity range',()=>{
 const g=setup(),u=g.blue[0];awardMinionExperience(g,minion(),u);expect(u.experience).toBeCloseTo(64*.92);
});
it('uses the map data champion XP bounty and starts catch-up after a full level gap',()=>{
 const g=setup(),u=g.blue[0],v=g.red[0];awardChampionExperience(g,v,u);expect(u.experience).toBe(155);u.experience=0;v.level=4;v.experience=xpAtLevel(4);awardChampionExperience(g,v,u);expect(u.experience).toBe(215);u.experience=0;v.level=5;v.experience=xpAtLevel(5);awardChampionExperience(g,v,u);expect(u.experience).toBeCloseTo(275*1.16);
});
it('awards XP for minions killed by a tower in the actual world tick',()=>{
 const g=setup(),w=ensureWorld(g),u=g.blue[0],tower=w.buildings.find(b=>b.team==='blue'&&b.kind==='outer')!;u.atFountain=false;u.position=tower.position;w.nextWave=99999;w.minions=[{...minion(),position:tower.position,health:1}];advanceWorld(g,false);expect(u.experience).toBeCloseTo(64*.92);expect(w.minions).toHaveLength(0);
});
it('awards kill XP to remote contributors and recent nearby dead allies, excluding stale deaths',()=>{
 const g=setup(),v=g.red[0],killer=g.blue[0],assist=g.blue[1],recent=g.blue[2],stale=g.blue[3];v.position=50;state(assist).procs['hit:'+v.id]=99;for(const u of [recent,stale]){u.alive=false;u.atFountain=false;u.position=50;}recent.diedAt=90;stale.diedAt=89;awardChampionExperience(g,v,killer);expect(killer.experience).toBeGreaterThan(0);expect(assist.experience).toBe(killer.experience);expect(recent.experience).toBe(killer.experience);expect(stale.experience).toBe(0);
});
it('uses actual nonlinear growth: .72 at level 2 and exactly 17 growths at level 18',()=>{
 const g=setup(),u=g.blue[0];u.champion=playableChampions.find(c=>c.id==='Ahri')!;u.level=2;expect(levelGrowth(u)).toBeCloseTo(.72);u.level=18;expect(levelGrowth(u)).toBe(17);const s=statsFor(u),b=u.champion.stats;expect(s.hp).toBe(Math.round(b.hp+b.hpperlevel*17));expect(s.ad).toBeCloseTo(b.attackdamage+b.attackdamageperlevel*17);expect(s.armor).toBeCloseTo(b.armor+b.armorperlevel*17);expect(s.mana).toBeCloseTo(b.mp+b.mpperlevel*17);
});
it('level-up adds the gained health and mana without refilling missing pools or reviving',()=>{
 const g=setup(),u=g.blue[0];u.champion=playableChampions.find(c=>c.id==='Ahri')!;u.combat=undefined;refreshStats(u,true);u.health-=100;state(u).mana-=70;grantExperience(g,u,478);expect(u.maxHealth-u.health).toBeCloseTo(100);expect(statsFor(u).mana-state(u).mana).toBeCloseTo(70);u.alive=false;u.health=0;grantExperience(g,u,510);expect(u.level).toBe(5);expect(u.health).toBe(0);expect(u.alive).toBe(false);
});
it('repairs zero AD growth from Data Dragon and uses each champions separate attack speed ratio',()=>{
 const g=setup(),u=g.blue[0];for(const champion of playableChampions){expect(champion.stats.attackdamageperlevel).toBeGreaterThan(0);}
 u.champion=playableChampions.find(c=>c.id==='Ahri')!;u.level=18;expect(statsFor(u).baseAd).toBe(104);
 u.champion=playableChampions.find(c=>c.id==='Kennen')!;u.level=18;expect(statsFor(u).baseAd).toBeCloseTo(111.75);expect(statsFor(u).attackSpeed).toBeCloseTo(.625+.69*(.034*17));
 // Old saves embed the incorrect raw stats; calculations must still be repaired.
 u.champion=structuredClone(u.champion);u.champion.stats.attackdamageperlevel=0;expect(statsFor(u).baseAd).toBeCloseTo(111.75);
});
it('keeps energy capped and restores Lost Chapter mana on personal level-up',()=>{
 const g=setup(),u=g.blue[0];u.champion=playableChampions.find(c=>c.id==='Kennen')!;u.combat=undefined;state(u).energy=50;grantExperience(g,u,478);expect(state(u).energy).toBe(50);expect(statsFor(u).energy).toBe(200);u.champion=playableChampions.find(c=>c.id==='Ahri')!;u.items=['3802'];u.combat=undefined;state(u).mana=0;const oldMax=statsFor(u).mana;grantExperience(g,u,510);expect(state(u).mana).toBeCloseTo(statsFor(u).mana-oldMax+statsFor(u).mana*.2);
});
it('uses level and elapsed time for death timers and fixes the deadline at death',()=>{
 const g=setup(),u=g.blue[0];u.champion=playableChampions.find(c=>c.id==='Ahri')!;u.combat=undefined;applyDamage(g,undefined,u,100000,'test','true');expect(u.deathDuration).toBe(11);expect(u.respawnAt).toBe(111);grantExperience(g,u,478);expect(u.level).toBe(4);expect(u.respawnAt).toBe(111);g.time=110;respawn(g);expect(u.alive).toBe(false);g.time=111;respawn(g);expect(u.alive).toBe(true);expect(u.health).toBe(u.maxHealth);g.time=1800;u.level=18;u.combat=undefined;applyDamage(g,undefined,u,100000,'test','true');expect(u.respawnAt).toBe(1846);expect(respawnSeconds(6)).toBe(17);expect(respawnSeconds(11)).toBe(26);
});
it('preserves fractional XP on a bonus level and does not grant it twice',()=>{
 const g=setup(),u=g.blue[0];grantExperience(g,u,239);grantBonusLevel(g,u);expect(u.level).toBe(4);expect(xpProgress(u).percent).toBeCloseTo(50);u.items=['6657'];state(u).counters.itemAge=600;advanceCombat(g);const level=u.level;advanceCombat(g);expect(u.level).toBe(level);expect(xpProgress(u).percent).toBeCloseTo(50);
});
it('migrates old saves without losing levels, dead status or existing respawn deadlines',()=>{
 const g=setup(),u=g.blue[0];delete u.experience;u.level=12;u.alive=false;u.health=0;u.respawnAt=150;upgradeBattleSave(g);expect(u.experience).toBe(xpAtLevel(12));expect(u.level).toBe(12);expect(u.health).toBe(0);expect(u.respawnAt).toBe(150);const copy=structuredClone(g);upgradeBattleSave(g);expect(g).toEqual(copy);
});
it('keeps a save/reload transition deterministic with individual XP',()=>{
 const g=setup();grantExperience(g,g.blue[0],477);expect(tick(g)).toEqual(tick(JSON.parse(JSON.stringify(g))));
});
