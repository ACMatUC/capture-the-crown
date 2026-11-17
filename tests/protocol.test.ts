import { describe, expect, it } from "vitest";
import {
  decodeClientMessage,
  decodeServerMessage,
  isClientMessage,
  isServerMessage,
} from "../shared/protocol.js";

describe("wire protocol boundaries", () => {
  it("accepts client requests without accepting forged server state", () => {
    expect(isClientMessage({ type: "join", name: "Krish" })).toBe(true);
    expect(isClientMessage({ type: "input", dx: -1, dy: 1 })).toBe(true);
    expect(isClientMessage({ type: "pong", sentAt: 123 })).toBe(true);
    for (const value of [
      null,
      [],
      4,
      { type: "state", players: [], coins: [] },
      { type: "welcome", id: "forged" },
      { type: "input", dx: 2, dy: 0 },
      { type: "input", dx: "1", dy: 0 },
      { type: "pong", sentAt: Infinity },
      { type: "join", name: " " },
      { type: "join", name: "x".repeat(17) },
    ]) {
      expect(isClientMessage(value)).toBe(false);
    }
  });

  it("checks finite positions, scores, and arena dimensions at runtime", () => {
    const player = { id: "player-1", name: "A", x: 10, y: 20, score: 0 };
    expect(
      isServerMessage({
        type: "state",
        players: [player],
        coins: [{ id: "coin-1", x: 2, y: 4 }],
      }),
    ).toBe(true);
    for (const invalid of [
      { ...player, x: NaN },
      { ...player, score: -1 },
      { ...player, score: 0.5 },
      { ...player, name: "" },
    ]) {
      expect(isServerMessage({ type: "state", players: [invalid], coins: [] })).toBe(
        false,
      );
    }
    expect(
      isServerMessage({
        type: "welcome",
        id: "player-1",
        arenaWidth: 0,
        arenaHeight: 600,
      }),
    ).toBe(false);
    expect(isServerMessage({ type: "join", name: "A" })).toBe(false);
  });

  it("rejects malformed JSON without throwing", () => {
    expect(decodeClientMessage("{")).toBeNull();
    expect(decodeServerMessage("null")).toBeNull();
    expect(decodeServerMessage('{"type":"state","players":null,"coins":[]}')).toBeNull();
    expect(decodeClientMessage('{"type":"input","dx":0,"dy":1}')).toEqual({
      type: "input",
      dx: 0,
      dy: 1,
    });
  });

  it("accepts a server capacity rejection without allowing clients to forge it", () => {
    const full = {
      type: "error",
      code: "server_full",
      message: "The arena is full (32 players). Try again when a player leaves.",
    };
    expect(isServerMessage(full)).toBe(true);
    expect(decodeServerMessage(JSON.stringify(full))).toEqual(full);
    expect(isClientMessage(full)).toBe(false);
    expect(isServerMessage({ ...full, code: "unknown" })).toBe(false);
    expect(isServerMessage({ ...full, message: " " })).toBe(false);
  });
});
