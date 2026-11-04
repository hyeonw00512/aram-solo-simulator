import {ensurePickLobby} from './pick-lobby';
import { augments, playableChampions } from "./data";
import balance from "../../data/encounter-balance.json";
import traitData from "../../data/traits.json";
import { Rng } from "./rng";
import { advanceEncounter, openDecision, startEncounter } from "./encounter";
import { attackReach, resolveAttack, log, power, respawn, units } from "./combat";
import type { Champion, Game, Tier, Trait, Unit } from "./types";
import { refreshStats, statsFor } from "./stats";
import { advanceForges, aiShopping, buyItem, suggestedPath } from "./shop";
import simulation from "../../data/simulation.json";
import {ensureWorld,advanceWorld} from "./world";
import {spawnPosition} from './map-layout';
import {advanceBases} from './base';
import {pickAiAugment,augmentFit} from './build-advisor';
import {advanceCombat} from "./combat-v4";
import {state,hasAugment} from "./runtime";
import {augmentDescription,applyAugment} from "./augments";
import {advancePortals,nearPortal,usePortal} from './portal';
import {advanceExperience} from './progression';
import {ensureAiBuild} from './ai-builds';
import {augmentLevels,ensureAugmentTiers,augmentTier as tierAt,rememberAugments,unseenAugments,futureAugmentReserve,augmentRerollReason,closeCompletedAugmentOffer} from './augment-offers';

const traits = Object.keys(traitData) as Trait[];
function createUnit(rng: Rng, team: Unit["team"], index: number, champion: Champion): Unit {
  const unit: Unit = {
    id: team + "-" + index, champion, team,
    traits: [...new Set([rng.pick(traits), ...(rng.chance(.42) ? [rng.pick(traits)] : [])])],
    level: 3, experience:0, skillRanks:{Q:1,W:1,E:1,R:0}, kills: 0, deaths: 0, assists: 0, gold: 1400, health: 100, maxHealth: 100,
    damage: 0, taken: 0, augments: [], items: [], alive: true,
    position: spawnPosition(team),
    cooldownUntil: 0, respawnAt: 0, status: "대치 중",
    relationships: {}, shopUnlocked:true, augmentClaims:0, atFountain: true, fountainSince: 0,
  };
  refreshStats(unit, true); return unit;
}
export function createGame(seed = Math.floor(Math.random() * 2 ** 31)): Game {
  const rng = new Rng(seed);
  const pool = [...playableChampions];
  for (let i = pool.length - 1; i > 0; i--) { const j = rng.int(i + 1); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  const blue = Array.from({ length: 5 }, (_, i) => createUnit(rng, "blue", i, pool[i]));
  const red = Array.from({ length: 5 }, (_, i) => createUnit(rng, "red", i, pool[i + 5]));
  const game: Game = { preparationRules:1, schemaVersion: 3, seed, phase: "pick", time: 0, blue, red, playerId: blue[0].id, logs: [], nextDecision: balance.decisionInterval, nextAugmentLevel: 7, encounterSerial: 0, encounterHistory: [], visualEvents: [], packs: {blue: 0, red: 0} };
  ensureAugmentTiers(game);ensureWorld(game);ensurePickLobby(game);
  log(game, "시드 " + seed + " — 무작위 총력전: 아수라장이 준비되었습니다.", "major");
  return game;
}
export function beginSwap(game: Game) { game.phase = "swap"; log(game, "교체 단계입니다."); }
export function resolveSwap(game: Game, accept: boolean) {
  const player = game.blue[0];
  if (accept) { const partner = game.blue[1]; [player.champion, partner.champion] = [partner.champion, player.champion];player.combat=undefined;partner.combat=undefined; refreshStats(player, true); refreshStats(partner, true); log(game, "챔피언을 교체했습니다.", "good"); }
  else log(game, "교체 요청을 넘겼습니다.");
  game.phase = "augment";
}
export function offerAugments(game: Game) {
  const player=game.blue[0];
  if(closeCompletedAugmentOffer(game))return;
  if(game.phase==='matchup'||game.phase==='finished'||player.augments.length>=augmentLevels.length||game.time>0&&player.augments.length>=(player.augmentClaims??1))return;
  if(game.phase==='augment'&&game.pending)return;
  ensureAugmentTiers(game);rememberAugments(game);
  const tier=tierAt(game,player.augments.length),options=unseenAugments(game,tier);
  const count=Math.min(3,Math.max(0,options.length-futureAugmentReserve(game,tier)));
  if(!count)return;
  game.phase='augment';game.augmentSerial=(game.augmentSerial??0)+1;game.augmentRerolls=[false,false,false];
  const rng=new Rng(game.seed+game.time+game.augmentSerial*19);
  for(let i=options.length-1;i>0;i--){const j=rng.int(i+1);[options[i],options[j]]=[options[j],options[i]];}
  game.pending={title:(tier==='silver'?'실버':tier==='gold'?'골드':'프리즘')+' 증강 선택',description:(game.time>0?'사망으로 열린 증강입니다. 선택을 마칠 때까지 경기 시간이 멈춥니다.':'첫 증강을 선택하세요.')+` ${player.augments.length+1}/4회 선택 · ${augmentLevels[player.augments.length]}레벨 증강${game.time>0?` · 미선택 ${Math.max(0,(player.augmentClaims??1)-player.augments.length)}회`:""} · 등급은 매 회 무작위입니다.`+' 한 번 제시된 증강은 이번 경기에서 다시 나오지 않습니다. 카드마다 각각 한 번씩 새로고침할 수 있습니다.'+(count<3?` 남은 새 후보 ${count}개를 표시합니다.`:''),choices:options.slice(0,count).map(a=>augmentChoice(game,a.id))};
  rememberAugments(game);
}
function augmentChoice(game:Game,id:string){const a=augments.find(a=>a.id===id)!;return {id:a.id,label:a.name,hint:augmentDescription(a.name)+' · 추천 근거: '+augmentFit(game.blue[0],a,game.seed).reason,bonus:a.power};}
export function rerollAugment(game:Game,index:number){
 if(augmentRerollReason(game,index))return false;
 rememberAugments(game);
 const choices=game.pending!.choices,old=augments.find(a=>a.id===choices[index].id)!;
 const pool=unseenAugments(game,old.tier);
 const rng=new Rng(game.seed+(game.augmentSerial??1)*97+index*13+choices.reduce((sum,c)=>sum+c.id.charCodeAt(c.id.length-1),0));
 choices[index]=augmentChoice(game,rng.pick(pool).id);rememberAugments(game);game.augmentRerolls??=[false,false,false];game.augmentRerolls[index]=true;return true;
}
function grantAiAugments(game:Game){
 const rng=new Rng(game.seed+game.time+997);
 for(const unit of units(game).filter(u=>u.id!==game.playerId)){
  while(unit.augments.length<Math.min(augmentLevels.length,unit.augmentClaims??1)){
   ensureAiBuild(game,unit);
   const tier=tierAt(game,unit.augments.length);
   const selected=pickAiAugment(unit,augments.filter(a=>a.tier===tier&&!unit.augments.some(o=>o.id===a.id)),rng,game.seed);if(!selected)break;
   unit.lastAugmentReason=selected.reason;applyAugment(game,unit,selected.a);log(game,unit.champion.name+': '+selected.a.name+' 증강 선택.');
  }
 }
}
export function chooseAugment(game: Game, id: string) {
 if(closeCompletedAugmentOffer(game))return;
 if(game.phase!=='augment'||!game.pending?.choices.some(c=>c.id===id))return;
 rememberAugments(game);
 const a=augments.find(a=>a.id===id);if(!a||!applyAugment(game,game.blue[0],a))return;
 log(game,game.blue[0].champion.name+'이(가) '+a.name+' 증강을 선택했습니다.','good');
 if(game.time===0)for(const u of units(game))u.augmentClaims=Math.max(1,u.augmentClaims??0);
 grantAiAugments(game);game.pending=undefined;game.augmentRerolls=undefined;game.phase=game.time>0?'playing':'shop';
 if(game.time>0&&game.blue[0].augments.length<(game.blue[0].augmentClaims??1))offerAugments(game);
}
export function buyStarter(game: Game) {
  if (game.phase !== "shop") return;
  if (!game.blue[0].items.length) buyItem(game, "1054");
  depart(game);
}
export function depart(game: Game) {
  if (game.phase !== "shop") return;
  for (const unit of units(game)) if (unit.id !== game.playerId) aiShopping(game, unit);
  log(game, "구매를 마치고 기지 포탈로 출발합니다.", "good"); game.phase = "playing";
  // Older v3 preparation saves placed units on the lane despite being at the fountain.
  for (const unit of units(game)) { if(unit.atFountain)unit.position=spawnPosition(unit.team);usePortal(game,unit); }
}
export const chooseDecision = startEncounter;

function advance(game:Game){
 ensureWorld(game);game.time++;
 const prior=new Map(units(game).map(u=>[u.id,u.alive]));
 advanceForges(game);advanceBases(game);advanceCombat(game);respawn(game);
 for(const u of units(game))if(u.id!==game.playerId&&(u.shopRequest?.status==='pending'||u.champion.id==='Ornn'))aiShopping(game,u);
 advancePortals(game);
 for(const u of units(game))u.gold+=simulation.economy.goldPerSecond;
 advanceExperience(game);
 advanceWorld(game);
 if(game.phase==="finished")return;
 if(game.encounter)advanceEncounter(game);
 grantAiAugments(game);
 if(game.winner)return;
 if(game.blue[0].augments.length<Math.min(augmentLevels.length,game.blue[0].augmentClaims??1)){offerAugments(game);return;}
 if(game.encounter)return;
 const victim=game.blue.find(u=>u.id!==game.playerId&&prior.get(u.id)&&!u.alive);
 if(victim&&game.time>=game.nextDecision-balance.decisionInterval+balance.deathDecisionGap){openDecision(game,"ally-picked",victim);return;}
 if(game.time>=game.nextDecision&&game.blue[0].alive&&!game.blue[0].returningToBase&&!game.blue[0].portal&&!(game.blue[0].atFountain&&nearPortal(game.blue[0])))openDecision(game);
}

/** Pure transition shared by the UI and batch simulation. */
export function tick(game: Game): Game {
  if(game.phase==='augment'&&game.blue[0].augments.length>=augmentLevels.length){const next=structuredClone(game);closeCompletedAugmentOffer(next);return next;}
  if(game.phase!=='playing')return game;
  const next=structuredClone(game);advance(next);
  if(next.phase==='finished'){next.pending=undefined;next.respawnPrompt=false;}
  return next;
}
