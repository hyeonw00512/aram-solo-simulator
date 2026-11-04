import { mkdir, writeFile } from "node:fs/promises";
import { createGame, chooseDecision, tick } from "../src/engine/game";
import { openDecision } from "../src/engine/encounter";
import { Rng } from "../src/engine/rng";
import type { Intent } from "../src/engine/types";

// Each seed gives ALL three intentions exactly the same pre-decision snapshot.
// This measures scenario coverage, not champion/augment balance or live LoL odds.
const scenarios = 1000;
const rows: Record<string, Record<string, number>> = {};
const examples: Record<string, { seed: number; intent: Intent; log: string[] }> = {};
for (const intent of ["engage", "retreat", "trade"] as Intent[]) {
  const counts = rows[intent] = { runs: 0, gains: 0, losses: 0, even: 0, misunderstood: 0, lateJoin: 0, cover: 0, towerPunishment: 0, playerEscapedAllyDied: 0, playerEscapedEnemyDied: 0, noFollow: 0 };
  for (let seed = 1; seed <= scenarios; seed++) {
    let game = createGame(seed); const rng = new Rng(seed + 31337);
    game.phase = "playing";
    for (const u of [...game.blue, ...game.red]) { u.atFountain = false; u.position = u.team === "blue" ? 32 + rng.int(19) : 50 + rng.int(20); u.health = Math.round(u.maxHealth * (.2 + rng.next() * .8)); u.cooldownUntil = rng.int(10); }
    game.blue[1].alive = false; game.blue[1].health = 0; game.blue[1].deaths = 1; game.blue[1].respawnAt = 30;
    openDecision(game, "ally-picked", game.blue[1]); chooseDecision(game, intent);
    for (let guard = 0; game.encounter && guard < 20; guard++) game = tick(game);
    if (game.encounter || game.encounterHistory.length !== 1) throw new Error(`Unresolved encounter ${seed}/${intent}`);
    const report = game.encounterHistory[0], text = game.logs.map(l => l.text);
    counts.runs++;
    const diff = report.enemyLosses - report.allyLosses; counts[diff > 0 ? "gains" : diff < 0 ? "losses" : "even"]++;
    const flags = {
      misunderstood: report.rounds.some(r => r.plans.some(p => p.misunderstood)),
      lateJoin: text.some(l => l.includes("뒤늦게 교전에")),
      cover: text.some(l => l.includes("피해를 줄였습니다")),
      towerPunishment: text.some(l => l.includes("포탑의 반격")),
      playerEscapedAllyDied: report.playerEscaped && report.allyLosses > 0,
      playerEscapedEnemyDied: report.playerEscaped && report.enemyLosses > 0,
      noFollow: text.some(l => l.includes("함께 들어오는 아군이 없습니다")),
    };
    for (const [key, occurred] of Object.entries(flags)) if (occurred) {
      counts[key]++; const exampleKey = `${intent}:${key}`;
      examples[exampleKey] ??= { seed, intent, log: game.logs.map(l => `[${l.time}] ${l.text}`) };
    }
  }
}
await mkdir("reports", { recursive: true });
await writeFile("reports/decision-coverage.json", JSON.stringify({ scenarios, encounters: scenarios * 3, note: "아군 1명 사망 상태에서 동일 시드별 세 선택을 각각 비교. 승률이 아닌 경우의수 검증.", rows, examples }, null, 2) + "\n");
console.log(JSON.stringify(rows, null, 2));
