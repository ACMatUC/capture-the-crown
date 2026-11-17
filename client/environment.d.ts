import type { Direction, GameState, PlayerSnapshot } from "../shared/protocol.js";

declare global {
  interface Window {
    chooseDirection?: (state: GameState, me: PlayerSnapshot) => Direction;
  }
}

export {};
