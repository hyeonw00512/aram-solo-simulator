import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { buyStarter, chooseAugment, chooseDecision, createGame, offerAugments, tick } from "../src/engine/game";
import type { Game } from "../src/engine/types";
import {usePortal} from '../src/engine/portal';

const games = Number(process.argv[2] ?? 1000);
const stats = new Map<string, { games: number; wins: number }>();
const compositions = new Map<string, { games: number; wins: number }>();
function composition(game: Game, team: "blue" | "red") { const units = team === "blue" ? game.blue : game.red; const tanks = units.filter((unit) => unit.champion.roles.includes("tank")).length; const marksmen = units.filter((unit) => unit.champion.roles.includes("marksman")).length; return tanks === 5 ? "tank-5" : marksmen >= 4 ? "marksman-4plus" : "mixed"; }
function chooseAi(game: Game) {
  if (!game.pending) return;
  if (game.phase === "decision") {
    const allies = game.blue.filter(u => u.alive).length, enemies = game.red.filter(u => u.alive).length;
    const preferred = game.blue[0].health / game.blue[0].maxHealth < .4 || allies < enemies ? "retreat" : allies > enemies ? "engage" : "trade";
    chooseDecision(game, game.pending.choices.find(c => c.id === preferred)?.id ?? game.pending.choices[0].id);
  } else chooseAugment(game, [...game.pending.choices].sort((a, b) => b.bonus - a.bonus)[0].id);
}
function run(seed: number) { let game = createGame(seed); offerAugments(game); chooseAi(game); buyStarter(game); let guard = 0; while (game.phase !== "finished" && guard++ < 5000) { if (game.pending) chooseAi(game); else {if(game.respawnPrompt)usePortal(game);game = tick(game);} } if (game.phase !== "finished") throw new Error(`Incomplete game: ${seed}`); return game; }
for (let index = 1; index <= games; index++) { const game = run(index); const playerWon = game.winner === "blue"; for (const unit of game.blue) { const entry = stats.get(unit.champion.name) ?? { games: 0, wins: 0 }; entry.games++; entry.wins += Number(playerWon); stats.set(unit.champion.name, entry); for (const augment of unit.augments.filter((item) => !item.id.startsWith("choice"))) { const augmentEntry = stats.get(`증강:${augment.name}`) ?? { games: 0, wins: 0 }; augmentEntry.games++; augmentEntry.wins += Number(playerWon); stats.set(`증강:${augment.name}`, augmentEntry); } } const key = composition(game, "blue"); const comp = compositions.get(key) ?? { games: 0, wins: 0 }; comp.games++; comp.wins += Number(playerWon); compositions.set(key, comp); }
const toRows = (values: Map<string, { games: number; wins: number }>) => [...values].map(([name, value]) => ({ name, games: value.games, wins: value.wins, winRate: Number((value.wins / value.games * 100).toFixed(1)) })).sort((a, b) => b.games - a.games || b.winRate - a.winRate);
const report = { generatedAt: new Date().toISOString(), games, championAndAugmentWinRates: toRows(stats), compositionWinRates: toRows(compositions) };
await mkdir(join(process.cwd(), "reports"), { recursive: true });
await writeFile(join(process.cwd(), "reports", `balance-${games}.json`), JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify({ games, compositionWinRates: report.compositionWinRates }, null, 2));
