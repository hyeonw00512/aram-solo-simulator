import {it,expect} from 'vitest';
import {createGame} from '../src/engine/game';
import {grantBonusLevel,grantExperience,xpAtLevel} from '../src/engine/progression';
import {autoTrainSkills,skillMaxOrders,skillRank,unspentSkills} from '../src/engine/skill-training';
import {upgradeBattleSave} from '../src/storage';

it.each(skillMaxOrders)('returns to the first available skill in %s/%s/%s order after a level gate', (first,second,third)=>{
 const g=createGame(1),u=g.blue[0];g.phase='playing';u.autoSkills=true;u.skillMaxOrder=[first,second,third];
 const expected=[
  [4,2,1,1,0],[5,3,1,1,0],[6,3,1,1,1],[7,4,1,1,1],
  [8,4,2,1,1],[9,5,2,1,1],[10,5,3,1,1],[11,5,3,1,2],
  [12,5,4,1,2],[13,5,5,1,2],[14,5,5,2,2],[15,5,5,3,2],
  [16,5,5,3,3],[17,5,5,4,3],[18,5,5,5,3],
 ];
 for(const [level,a,b,c,r] of expected){grantBonusLevel(g,u);expect([u.level,skillRank(u,first),skillRank(u,second),skillRank(u,third),skillRank(u,'R')]).toEqual([level,a,b,c,r]);expect(unspentSkills(u)).toBe(0);}
});
it('disabling ultimate priority puts R after the three basic skills',()=>{
 const g=createGame(1),u=g.blue[0];g.phase='playing';u.autoSkills=true;u.skillMaxOrder=['Q','E','W'];u.prioritizeUltimate=false;
 for(let level=4;level<=15;level++)grantBonusLevel(g,u);
 expect(u.skillRanks).toEqual({Q:5,W:5,E:5,R:0});
 for(let level=16;level<=18;level++)grantBonusLevel(g,u);
 expect(u.skillRanks).toEqual({Q:5,W:5,E:5,R:3});
});
it('changing the plan preserves investments and applies the new priority to subsequent points',()=>{
 const g=createGame(1),u=g.blue[0];g.phase='playing';u.autoSkills=true;u.skillMaxOrder=['Q','E','W'];grantBonusLevel(g,u);
 expect(skillRank(u,'Q')).toBe(2);u.skillMaxOrder=['E','W','Q'];grantBonusLevel(g,u);
 expect(u.skillRanks).toEqual({Q:2,W:1,E:2,R:0});
 u.autoSkills=false;grantBonusLevel(g,u);expect(unspentSkills(u)).toBe(1);
 u.prioritizeUltimate=true;autoTrainSkills(u);expect(skillRank(u,'R')).toBe(1);expect(skillRank(u,'Q')).toBe(2);
});
it('persists custom order and R preference; manual mode still banks multi-level points',()=>{
 const g=createGame(1),u=g.blue[0];g.phase='playing';u.skillMaxOrder=['W','E','Q'];u.prioritizeUltimate=false;
 grantExperience(g,u,xpAtLevel(9));expect(unspentSkills(u)).toBe(6);
 const restored=JSON.parse(JSON.stringify(g));upgradeBattleSave(restored);const player=restored.blue[0];
 expect(player.skillMaxOrder).toEqual(['W','E','Q']);expect(player.prioritizeUltimate).toBe(false);expect(player.skillRanks).toEqual(u.skillRanks);
 player.autoSkills=true;autoTrainSkills(player);expect(player.skillRanks).toEqual({Q:1,W:5,E:3,R:0});expect(unspentSkills(player)).toBe(0);
});
