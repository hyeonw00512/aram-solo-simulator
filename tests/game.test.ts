import { describe, expect, it } from "vitest";
import { buyStarter, chooseAugment, createGame, offerAugments, tick } from "../src/engine/game";
describe("game engine", () => {
  it("reproduces an identical initial game for the same seed", () => { const a = createGame(1024); const b = createGame(1024); expect(a.blue.map((u) => u.champion.id)).toEqual(b.blue.map((u) => u.champion.id)); });
  it("can progress from augment through combat", () => { let game = createGame(42); offerAugments(game); expect(game.pending?.choices).toHaveLength(3); chooseAugment(game, game.pending!.choices[0].id); buyStarter(game); for (let i = 0; i < 10; i++) game = tick(game); expect(game.time).toBe(10); });
});
