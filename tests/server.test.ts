import { describe, expect, it } from "vitest";
import { createGameConfig, DEFAULT_GAME_CONFIG, parsePort } from "../server/constants.js";
import { createGame, GameFullError } from "../server/game.js";
import { MAX_PLAYERS } from "../shared/protocol.js";

function sequenceRandom(values: readonly number[], fallback = 0.9): () => number {
  let index = 0;
  return () => values[index++] ?? fallback;
}

describe("authoritative game", () => {
  it("caps the game at 32 players and makes a departed player's slot available", () => {
    const game = createGame();
    const players = Array.from({ length: MAX_PLAYERS }, (_, index) =>
      game.addPlayer(`Player ${index + 1}`),
    );
    expect(game.getStateSnapshot().players).toHaveLength(32);
    expect(() => game.addPlayer("Extra")).toThrow(GameFullError);
    expect(game.getStateSnapshot().players).toHaveLength(32);

    const departing = players[0];
    if (!departing) throw new Error("Missing capacity-test player.");
    game.removePlayer(departing.id);
    expect(game.addPlayer("Replacement")).toMatchObject({
      id: "player-33",
      score: 0,
    });
    expect(game.getStateSnapshot().players).toHaveLength(32);
  });

  it("keeps instances and returned snapshots independent", () => {
    const first = createGame({}, () => 0.5);
    const second = createGame({}, () => 0.5);
    const player = first.addPlayer(" Alex ");
    expect(player).toMatchObject({
      id: "player-1",
      name: "Alex",
      score: 0,
      x: 400,
      y: 300,
    });
    expect(second.getStateSnapshot().players).toHaveLength(0);
    const snapshot = first.getStateSnapshot();
    first.setPlayerInput(player.id, 1, 0);
    first.tick();
    expect(snapshot.players[0]?.x).toBe(400);
    expect(first.getStateSnapshot().players[0]?.x).toBe(404);
  });

  it.each([0, 1 - Number.EPSILON])(
    "spawns players and crowns fully within the arena (%s)",
    (value) => {
      const game = createGame({}, () => value);
      const player = game.addPlayer("Edge");
      expect(player.x).toBeGreaterThanOrEqual(16);
      expect(player.x).toBeLessThanOrEqual(784);
      expect(player.y).toBeGreaterThanOrEqual(16);
      expect(player.y).toBeLessThanOrEqual(584);
      expect(player.score).toBe(0);
      for (const coin of game.getStateSnapshot().coins) {
        expect(coin.x).toBeGreaterThanOrEqual(20);
        expect(coin.x).toBeLessThanOrEqual(780);
        expect(coin.y).toBeGreaterThanOrEqual(20);
        expect(coin.y).toBeLessThanOrEqual(580);
      }
    },
  );

  it("applies one movement step per tick and preserves the original diagonal speed", () => {
    const game = createGame({ coinCount: 1 }, sequenceRandom([0.9, 0.9, 0.5, 0.5]));
    const player = game.addPlayer("Mover");
    game.setPlayerInput(player.id, 1, -1);
    for (let index = 0; index < 30; index += 1) game.setPlayerInput(player.id, 1, -1);
    expect(game.getStateSnapshot().players[0]).toMatchObject({ x: 400, y: 300 });
    game.tick();
    expect(game.getStateSnapshot().players[0]).toMatchObject({ x: 404, y: 296 });
    game.setPlayerInput(player.id, 0, 0);
    game.tick();
    expect(game.getStateSnapshot().players[0]).toMatchObject({ x: 404, y: 296 });
  });

  it("clamps movement at all four edges", () => {
    const game = createGame({ coinCount: 1 }, sequenceRandom([0.5, 0.5, 0, 0]));
    const player = game.addPlayer("Edge");
    game.setPlayerInput(player.id, -1, -1);
    game.tick();
    expect(game.getStateSnapshot().players[0]).toMatchObject({ x: 16, y: 16 });
    game.setPlayerInput(player.id, 1, 1);
    for (let index = 0; index < 300; index += 1) game.tick();
    expect(game.getStateSnapshot().players[0]).toMatchObject({ x: 784, y: 584 });
  });

  it("awards a shared crown only once and respawns only the collected crown", () => {
    const game = createGame(
      { coinCount: 2 },
      sequenceRandom([0.2, 0.2, 0.8, 0.8, 0.2, 0.2, 0.2, 0.2]),
    );
    const first = game.addPlayer("First");
    const second = game.addPlayer("Second");
    const before = game.getStateSnapshot();
    game.tick();
    const after = game.getStateSnapshot();
    expect(after.players.find((player) => player.id === first.id)?.score).toBe(1);
    expect(after.players.find((player) => player.id === second.id)?.score).toBe(0);
    expect(after.coins).toHaveLength(2);
    expect(after.coins[0]?.id).toBe(before.coins[0]?.id);
    expect(after.coins[0]).not.toEqual(before.coins[0]);
    expect(after.coins[1]).toEqual(before.coins[1]);
  });

  it("collects a crown at exactly the pickup boundary, but not beyond it", () => {
    // Crown at (400,300); player at (428,300).
    const boundaryX = (428 - 16) / (800 - 32);
    const game = createGame({ coinCount: 1 }, sequenceRandom([0.5, 0.5, boundaryX, 0.5]));
    game.addPlayer("Boundary");
    game.tick();
    expect(game.getStateSnapshot().players[0]?.score).toBe(1);

    const outsideX = (429 - 16) / (800 - 32);
    const outside = createGame(
      { coinCount: 1 },
      sequenceRandom([0.5, 0.5, outsideX, 0.5]),
    );
    outside.addPlayer("Outside");
    outside.tick();
    expect(outside.getStateSnapshot().players[0]?.score).toBe(0);
  });

  it("removes a player and starts a rejoin with a fresh ID and zero score", () => {
    const game = createGame({}, () => 0.5);
    const oldPlayer = game.addPlayer("Alex");
    game.tick();
    expect(game.getStateSnapshot().players[0]?.score).toBe(10);
    game.removePlayer(oldPlayer.id);
    expect(game.getStateSnapshot().players).toHaveLength(0);
    const rejoined = game.addPlayer("Alex");
    expect(rejoined.id).not.toBe(oldPlayer.id);
    expect(rejoined.score).toBe(0);
    expect(game.getStateSnapshot().coins).toHaveLength(10);
  });

  it("rejects empty or oversized names and a broken random source", () => {
    const game = createGame();
    expect(() => game.addPlayer("  ")).toThrow(RangeError);
    expect(() => game.addPlayer("x".repeat(17))).toThrow(RangeError);
    expect(() => createGame({}, () => Number.NaN)).toThrow(RangeError);
    expect(() => createGame({}, () => 1)).toThrow(RangeError);
  });
});

describe("configuration", () => {
  it("retains the workshop defaults and rejects invalid game settings", () => {
    expect(createGameConfig()).toEqual(DEFAULT_GAME_CONFIG);
    expect(createGameConfig({ tickRate: 2 }).tickRate).toBe(2);
    for (const settings of [
      { tickRate: 0 },
      { playerSpeed: -1 },
      { coinCount: 1.5 },
      { coinCount: 0 },
      { arenaWidth: 40 },
      { pingIntervalMs: 0 },
      { arenaHeight: Number.POSITIVE_INFINITY },
    ])
      expect(() => createGameConfig(settings)).toThrow(RangeError);
  });

  it("parses an explicit port instead of letting invalid values silently choose a port", () => {
    expect(parsePort(undefined)).toBe(3000);
    expect(parsePort("4000")).toBe(4000);
    for (const value of ["", "0", "-1", "3.5", "3000abc", "65536", " ", "1e3"]) {
      expect(() => parsePort(value)).toThrow(RangeError);
    }
  });
});
