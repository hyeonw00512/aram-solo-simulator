import { describe, expect, it } from "vitest";
import { createGame, chooseDecision, tick, offerAugments, chooseAugment, buyStarter } from "../src/engine/game";
import { openDecision, planResponse } from "../src/engine/encounter";
import { applyDamage } from "../src/engine/combat";
import { Rng } from "../src/engine/rng";
import type { Game, Intent } from "../src/engine/types";
import { damageSkillNames } from "../src/engine/data";
import {usePortal} from '../src/engine/portal';

function prepared(seed = 1) {
  const game = createGame(seed); game.phase = "playing";
  game.blue.forEach(u => { u.position = 42; u.atFountain=false; }); game.red.forEach(u => { u.position = 55; u.atFountain=false; });
  return game;
}
function finish(game: Game) {
  for (let i = 0; i < 20 && game.encounter; i++) {
    // A death can interrupt the encounter with a time-stopping augment choice.
    if(game.phase==='augment'&&game.pending)chooseAugment(game,game.pending.choices[0].id);
    game=tick(game);
  }
  return game;
}
describe("independent encounter decisions", () => {
  it("does not name non-damaging healing/shield skills as direct attacks", () => {
    expect(damageSkillNames.Janna).not.toContain("계절풍");
    expect(damageSkillNames.Sona).not.toContain("인내의 아리아");
    expect(damageSkillNames.Sona).not.toContain("기민함의 노래");
    expect(damageSkillNames.Kaisa).not.toContain("사냥본능");
    expect(damageSkillNames.Ahri).toContain("현혹의 구슬");
  });
  it("freezes time at a decision and rejects invalid or repeated selection", () => {
    const game = prepared(); openDecision(game); expect(tick(game)).toEqual(game);
    chooseDecision(game, "invalid"); expect(game.phase).toBe("decision");
    chooseDecision(game, "trade"); const before = structuredClone(game);
    chooseDecision(game, "engage"); expect(game).toEqual(before);
  });
  it("does not add a permanent stat or augment for any player choice", () => {
    for (const intent of ["engage", "retreat", "trade"]) {
      const game = prepared(); openDecision(game, "ally-picked"); chooseDecision(game, intent);
      const result = finish(game); expect(result.blue[0].augments).toEqual([]);
      expect(result.encounter).toBeUndefined(); expect(result.encounterHistory).toHaveLength(1);
    }
  });
  it("replays identically across serialization and does not mutate tick input", () => {
    let game = prepared(173); openDecision(game); chooseDecision(game, "trade");
    const before = structuredClone(game); game = tick(game); expect(before.time).toBe(0);
    expect(tick(before)).toEqual(game); expect(before.encounter?.wave).toBe(0);
    expect(finish(game)).toEqual(finish(JSON.parse(JSON.stringify(game))));
  });
  it("only offers decisions to a living player", () => {
    const game = prepared(); game.blue[0].alive = false; openDecision(game); expect(game.pending).toBeUndefined();
  });
  it("uses low health, cooldown and distance as actual response factors", () => {
    const game = prepared(); openDecision(game); chooseDecision(game, "engage");
    const ally = game.blue[1]; ally.traits = ["사립니다"];
    const healthy = planResponse(game, ally, new Rng(10));
    ally.health = 5; ally.cooldownUntil = 20; ally.position = 0;
    const injured = planResponse(game, ally, new Rng(10));
    expect(injured.weights.retreat).toBeGreaterThan(healthy.weights.retreat);
    expect(injured.weights.hesitate).toBeGreaterThan(healthy.weights.hesitate);
  });
  it("traits change willingness to follow and to misread a short exchange", () => {
    const game = prepared(); openDecision(game); chooseDecision(game, "trade"); const ally = game.blue[1];
    ally.traits = ["사립니다"]; const cautious = planResponse(game, ally, new Rng(2));
    ally.traits = ["공격적입니다"]; const aggressive = planResponse(game, ally, new Rng(2));
    expect(aggressive.weights.engage).toBeGreaterThan(cautious.weights.engage);
  });
  it("short exchange attacks then withdraws, and withdrawal changes real distance", () => {
    let game = prepared(42); openDecision(game); chooseDecision(game, "trade"); game = tick(game);
    expect(game.encounter!.rounds[0].plans.find(p => p.unitId === game.playerId)!.action).toBe("poke");
    game.blue[0].health = 1000; game.blue[0].maxHealth = 1000;
    game = tick(tick(tick(game)));
    expect(game.encounter!.rounds[1].plans.find(p => p.unitId === game.playerId)!.action).toBe("retreat");
    expect(game.blue[0].position).toBeLessThan(42);
  });
  it("prevents dead participants from reacting and respawns each unit independently", () => {
    let game = prepared(); applyDamage(game, game.red[0], game.blue[1], 100000, "테스트 피격");
    const respawnAt = game.blue[1].respawnAt; openDecision(game, "ally-picked", game.blue[1]); chooseDecision(game, "retreat");
    game = tick(game); expect(game.encounter!.rounds[0].plans.some(p => p.unitId === "blue-1")).toBe(false);
    game = finish(game); game.time = respawnAt - 1; game.nextDecision = 1000; game = tick(game);
    expect(game.blue[1].alive).toBe(true); expect(game.blue[1].health).toBeGreaterThan(0);
    expect(game.logs.some(l => l.text === `${game.blue[1].champion.name}이(가) 우물에서 부활했습니다.`)).toBe(true);
  });
  it("triggers the ally-picked prompt from an actual ambient death", () => {
    let observed = false;
    for (let seed = 1; seed <= 100 && !observed; seed++) {
      const game = prepared(seed); game.time = 25;
      game.blue.slice(1).forEach(u => { u.health = 1; });
      const next = tick(game);
      if (next.pending?.situation === "ally-picked") {
        observed = true; expect(next.blue.some(u => !u.alive)).toBe(true); expect(next.phase).toBe("decision");
      }
    }
    expect(observed).toBe(true);
  });
  it("produces both cooperation and misunderstanding, with varied losses for the same intent", () => {
    const intents: Intent[] = ["engage", "retreat", "trade"];
    const observed = new Set<string>();
    for (const intent of intents) {
      const outcomes = new Set<string>();
      for (let seed = 1; seed <= 80; seed++) {
        const game = prepared(seed);
        const rng = new Rng(seed + 41);
        [...game.blue, ...game.red].forEach(u => { u.health = Math.round(u.maxHealth * (.2 + rng.next() * .8)); });
        openDecision(game, "ally-picked"); chooseDecision(game, intent);
        const result = finish(game), report = result.encounterHistory[0];
        outcomes.add(`${report.allyLosses}:${report.enemyLosses}`);
        for (const round of report.rounds) for (const plan of round.plans) {
          observed.add(plan.action); if (plan.misunderstood) observed.add("misunderstanding");
          expect(plan.reason.length).toBeGreaterThan(0);
        }
        for (const unit of [...result.blue, ...result.red]) {
          expect(unit.health).toBeGreaterThanOrEqual(0); expect(unit.health).toBeLessThanOrEqual(unit.maxHealth);
        }
      }
      expect(outcomes.size).toBeGreaterThan(2);
    }
    for (const action of ["join", "retreat", "cover", "chase", "hesitate", "misunderstanding"]) expect(observed.has(action)).toBe(true);
  });
  it("finishes complete games without losing level-up choices or stalling after death", () => {
    for (const seed of [42, 173, 984]) {
      let game = createGame(seed); offerAugments(game); chooseAugment(game, game.pending!.choices[0].id); buyStarter(game);
      let guard = 0;
      while (game.phase !== "finished" && guard++ < 5000) {
        if (game.phase === "decision") chooseDecision(game, game.pending!.choices[guard % game.pending!.choices.length].id);
        else if (game.phase === "augment") chooseAugment(game, game.pending!.choices[0].id);
        else {if(game.respawnPrompt)usePortal(game);game = tick(game);}
      }
      expect(game.phase).toBe("finished"); expect(game.world!.buildings.some(b=>b.kind==="nexus"&&!b.alive)).toBe(true);expect(game.blue[0].augments.length).toBeLessThanOrEqual(game.blue[0].augmentClaims??1);
    }
  }, 60000);
});
