import type { Game, Unit, TrustChange } from "./types";
import config from "../../data/simulation.json";
import { statsFor } from "./stats";
import { available } from './runtime';
import { ultimateReady } from './kits';
import {reactToMisplay} from './chat-social';

export const trustOf = (observer: Unit, leader: Unit) => observer.relationships[leader.id]?.trust ?? 0;
export function opportunity(game: Game, team: "blue" | "red") {
  const strength = (members: Unit[]) => members.filter(available).reduce((sum, u) => {
    const s = statsFor(u); return sum + (s.ad + s.ap * .5 + s.hp / 12) * (u.health / u.maxHealth) * (u.cooldownUntil <= game.time ? 1.15 : .85) * (ultimateReady(u,game.time)?1.15:1);
  }, 0);
  const ours = strength(team === "blue" ? game.blue : game.red), theirs = strength(team === "blue" ? game.red : game.blue);
  return (ours - theirs) / Math.max(1, ours + theirs);
}
export function rememberEncounter(game: Game):TrustChange[] {
  const changes:TrustChange[]=[];
  const e = game.encounter; if (!e) return changes;
  for (const team of [game.blue, game.red]) for (const observer of team) {
    const tookPart = e.rounds.some(r => r.plans.some(p => p.unitId === observer.id));
    if (!tookPart) continue;
    for (const leader of team.filter(u => u.id !== observer.id)) {
      const start = e.startUnits.find(u => u.id === leader.id)!;
      const plans = e.rounds.flatMap(r => r.plans.filter(p => p.unitId === leader.id));
      if (!plans.length) continue;
      const ownLoss = team.reduce((sum, u) => sum + u.deaths - e.startUnits.find(s => s.id === u.id)!.deaths, 0);
      const enemies = team === game.blue ? game.red : game.blue;
      const enemyLoss = enemies.reduce((sum, u) => sum + u.deaths - e.startUnits.find(s => s.id === u.id)!.deaths, 0);
      const prior = observer.relationships[leader.id] ?? { trust: 0, reckless: 0, experiences: 0, reason: "아직 함께한 교전이 없습니다", updatedAt: 0 };
      const initialAngle = leader.team === "blue" ? e.initialOpportunity : -e.initialOpportunity;
      const charged = plans[0].action === "engage" || plans[0].action === "chase";
      const reckless = charged && initialAngle < -.15 && ownLoss > enemyLoss && leader.deaths > start.deaths;
      const helped = e.protections.some(p => p.protector === leader.id && p.protected === observer.id);
      let delta = 0, reason = "같은 교전을 겪었습니다. 판단을 유보합니다";
      if (reckless) { delta = -config.memory.recklessPenalty - Math.min(10, prior.reckless * 2); reason = "불리한 인원·체력에서 무리하게 들어가 손실을 냈습니다"; }
      else if (helped) { delta = config.memory.protection; reason = "위험할 때 뒤에 남아 엄호해 주었습니다"; }
      else if (enemyLoss > ownLoss && leader.damage > start.damage) { delta = config.memory.goodDecision; reason = "함께한 교전에서 실제 피해를 주며 이득을 만들었습니다"; }
      else if (charged && ownLoss > enemyLoss) { delta = -config.memory.failurePenalty; reason = "진입 결과가 좋지 않았지만 무리한 판단이라고 단정하지는 않습니다"; }
      else if (leader.id === game.playerId && ["wait", "retreat", "hold"].includes(e.intent) && ownLoss === 0 && initialAngle < 0) { delta = 3; reason = "불리한 상황에서 무리하지 않아 추가 손실을 피했습니다"; }
      const after=Math.max(config.memory.minTrust, Math.min(config.memory.maxTrust, prior.trust + delta));
      observer.relationships[leader.id] = { trust: after, reckless: prior.reckless + Number(reckless), experiences: prior.experiences + 1, reason, updatedAt: game.time,
        lastChange:delta?{time:game.time,reason,encounterId:e.id}:prior.lastChange };
      changes.push({observerId:observer.id,leaderId:leader.id,time:game.time,before:prior.trust,after,reckless:observer.relationships[leader.id].reckless,reason});
      if(reckless||(charged&&ownLoss>enemyLoss))reactToMisplay(game,observer,leader,reckless,reason);
      if (leader.id === game.playerId && after!==prior.trust) game.logs.push({ time: game.time, text: `${observer.champion.name}의 내 판단에 대한 신뢰 ${after > prior.trust ? "+" : ""}${after-prior.trust} → ${after}: ${reason}.`, tone: after > prior.trust ? "good" : "bad" });
    }
  }
  return changes;
}
