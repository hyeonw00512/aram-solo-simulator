import {ensurePickLobby} from './engine/pick-lobby';
import {ensureWorld} from "./engine/world";
import { createGame } from "./engine/game";
import type { Game } from "./engine/types";
import {applyAugment} from './engine/augments';
import {state} from './engine/runtime';
import {refreshStats,statsFor} from './engine/stats';
import {totalXp} from './engine/progression';
import {ensureSkills} from './engine/skill-training';
import {rememberAugments,ensureAugmentTiers,augmentLevels,closeCompletedAugmentOffer} from './engine/augment-offers';

export function upgradeBattleSave(game:Game){
  // Legacy saves only reveal owned and currently offered cards; older discarded
  // offers cannot be reconstructed. Keep all history recorded from now on.
  ensureAugmentTiers(game);rememberAugments(game);
  if(!game.preparationRules){
    for(const u of [...game.blue,...game.red]){
      u.augmentClaims=Math.max(u.augments.length,!u.alive?augmentLevels.filter(level=>u.level>=level).length:0);
      u.shopUnlocked=game.time===0||!u.alive||u.atFountain&&u.fountainSince===u.respawnAt;
    }
    if(game.time>0&&game.phase==='augment'){game.phase='playing';game.pending=undefined;}
    game.preparationRules=1;
  }
  if(game.time>0&&game.blue[0].alive&&game.blue[0].atFountain){game.blue[0].holdAtBase=true;game.respawnPrompt=true;}
  if(game.phase==="matchup")game.matchupRemaining=Number.isFinite(game.matchupRemaining)?Math.max(1,Math.min(7,Math.ceil(game.matchupRemaining!))):7;
  ensureWorld(game);if(game.time===0)ensurePickLobby(game);
  // Older saves did not track XP. Keep their levels and current death deadlines.
  for(const unit of [...game.blue,...game.red]){ensureSkills(unit);unit.shopUnlocked??=game.time===0||!unit.alive||unit.atFountain&&unit.fountainSince===unit.respawnAt;unit.augmentClaims??=Math.max(unit.augments.length,1);unit.experience=totalXp(unit);refreshStats(unit);if(unit.combat)unit.combat.mana=Math.min(unit.combat.mana,statsFor(unit).mana);}
  for(const unit of [...game.blue,...game.red])if(!unit.combat){
    const owned=[...unit.augments];unit.augments=[];state(unit);
    for(const augment of owned)applyAugment(game,unit,augment);
    refreshStats(unit);state(unit).mana=statsFor(unit).mana;
  }
  for(const u of [...game.blue,...game.red])u.augmentClaims=Math.min(augmentLevels.length,Math.max(u.augmentClaims??1,u.augments.length,!u.alive?augmentLevels.filter(level=>u.level>=level).length:0));
  closeCompletedAugmentOffer(game);
  return game;
}

// Preserve v1 saves, but do not import their permanent choice bonuses.
export const SAVE_KEY = "chaos-brawl-game-v3";
export function loadGame(): Game {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) {
      const game = JSON.parse(raw) as Game;
      const validUnits = [...game.blue, ...game.red].every(u => u.champion.stats && Number.isFinite(u.maxHealth) && u.maxHealth > 0 && Number.isFinite(u.health) && u.relationships && Array.isArray(u.items));
      if (game.schemaVersion === 3 && game.blue.length === 5 && game.red.length === 5 && validUnits && Array.isArray(game.encounterHistory) && Array.isArray(game.visualEvents) && game.packs && (!game.encounter || Array.isArray(game.encounter.protections)) && new Set([...game.blue, ...game.red].map(u => u.champion.id)).size === 10) return upgradeBattleSave(game);
    }
  } catch { /* Corrupt or unavailable storage does not prevent starting. */ }
  return createGame();
}
