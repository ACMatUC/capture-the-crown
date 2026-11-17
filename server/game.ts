import {
  MAX_PLAYER_NAME_LENGTH,
  MAX_PLAYERS,
  isAxis,
  type Axis,
  type CoinSnapshot,
  type GameState,
  type PlayerSnapshot,
} from "../shared/protocol.js";
import { createGameConfig, type GameConfig } from "./constants.js";

interface Player {
  id: string;
  name: string;
  x: number;
  y: number;
  score: number;
  dx: Axis;
  dy: Axis;
}

interface Coin {
  id: string;
  x: number;
  y: number;
}

export interface Game {
  readonly config: Readonly<GameConfig>;
  addPlayer(name: string): PlayerSnapshot;
  removePlayer(id: string): void;
  setPlayerInput(id: string, dx: Axis, dy: Axis): void;
  tick(): void;
  getStateSnapshot(): GameState;
}

export class GameFullError extends Error {
  constructor() {
    super(`The arena is full (${MAX_PLAYERS} players). Try again when a player leaves.`);
    this.name = "GameFullError";
  }
}

function snapshotPlayer(player: Player): PlayerSnapshot {
  return {
    id: player.id,
    name: player.name,
    x: Math.round(player.x),
    y: Math.round(player.y),
    score: player.score,
  };
}

function snapshotCoin(coin: Coin): CoinSnapshot {
  return { id: coin.id, x: Math.round(coin.x), y: Math.round(coin.y) };
}

export function createGame(
  overrides: Partial<GameConfig> = {},
  random: () => number = Math.random,
): Game {
  const config = createGameConfig(overrides);
  const players = new Map<string, Player>();
  let nextPlayerId = 1;

  function randomCoordinate(size: number, inset: number): number {
    const value = random();
    if (!Number.isFinite(value) || value < 0 || value >= 1) {
      throw new RangeError("The random source must return a number in [0, 1).");
    }
    return inset + value * (size - inset * 2);
  }

  function createCoin(id: string): Coin {
    const inset = config.coinRadius + config.coinSpawnPadding;
    return {
      id,
      x: randomCoordinate(config.arenaWidth, inset),
      y: randomCoordinate(config.arenaHeight, inset),
    };
  }

  let coins = Array.from({ length: config.coinCount }, (_, index) =>
    createCoin(`coin-${index + 1}`),
  );

  return {
    config,
    addPlayer(name) {
      const trimmedName = name.trim();
      if (!trimmedName || trimmedName.length > MAX_PLAYER_NAME_LENGTH) {
        throw new RangeError(
          `Player names must contain 1-${MAX_PLAYER_NAME_LENGTH} characters.`,
        );
      }
      if (players.size >= MAX_PLAYERS) throw new GameFullError();
      const id = `player-${nextPlayerId++}`;
      const player: Player = {
        id,
        name: trimmedName,
        x: randomCoordinate(config.arenaWidth, config.playerRadius),
        y: randomCoordinate(config.arenaHeight, config.playerRadius),
        score: 0,
        dx: 0,
        dy: 0,
      };
      players.set(id, player);
      return snapshotPlayer(player);
    },
    removePlayer(id) {
      players.delete(id);
    },
    setPlayerInput(id, dx, dy) {
      if (!isAxis(dx) || !isAxis(dy))
        throw new RangeError("Movement axes must be -1, 0, or 1.");
      const player = players.get(id);
      if (player) {
        player.dx = dx;
        player.dy = dy;
      }
    },
    tick() {
      for (const player of players.values()) {
        player.x = Math.max(
          config.playerRadius,
          Math.min(
            config.arenaWidth - config.playerRadius,
            player.x + player.dx * config.playerSpeed,
          ),
        );
        player.y = Math.max(
          config.playerRadius,
          Math.min(
            config.arenaHeight - config.playerRadius,
            player.y + player.dy * config.playerSpeed,
          ),
        );
      }
      // A crown belongs to the first touching player this tick and respawns once.
      coins = coins.map((coin) => {
        for (const player of players.values()) {
          if (Math.hypot(player.x - coin.x, player.y - coin.y) <= config.pickupDistance) {
            player.score += 1;
            return createCoin(coin.id);
          }
        }
        return coin;
      });
    },
    getStateSnapshot() {
      return {
        type: "state",
        players: Array.from(players.values(), snapshotPlayer),
        coins: coins.map(snapshotCoin),
      };
    },
  };
}
