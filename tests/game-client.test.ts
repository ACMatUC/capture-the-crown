import { describe, expect, it } from "vitest";
import {
  isUnspecifiedServerUrl,
  normalizeServerUrl,
  rankPlayers,
} from "../client/game.js";

describe("joining and standings", () => {
  it("normalizes LAN, VPN and loopback addresses while preserving explicit ports", () => {
    expect(normalizeServerUrl(" 192.168.1.10 ")).toBe("ws://192.168.1.10:3000/");
    expect(normalizeServerUrl("ws://192.168.1.10:4000")).toBe("ws://192.168.1.10:4000/");
    expect(normalizeServerUrl("ws://192.168.1.10:80")).toBe("ws://192.168.1.10/");
    expect(normalizeServerUrl("localhost:27411")).toBe("ws://localhost:27411/");
    expect(normalizeServerUrl("127.0.0.1:27411")).toBe("ws://127.0.0.1:27411/");
    expect(normalizeServerUrl("203.0.113.10:27411")).toBe("ws://203.0.113.10:27411/");
    for (const value of [
      "",
      "http://192.168.1.10",
      "wss://192.168.1.10",
      "ws://user:pass@192.168.1.10",
      "ws://192.168.1.10/path",
      "ws://192.168.1.10?x=1",
      "ws://192.168.1.10:99999",
    ]) {
      expect(normalizeServerUrl(value)).toBeNull();
    }
  });

  it("rejects unspecified listen addresses while allowing host loopback tests", () => {
    expect(isUnspecifiedServerUrl("ws://0.0.0.0:3000")).toBe(true);
    expect(isUnspecifiedServerUrl("ws://[::]:3000")).toBe(true);
    for (const address of [
      "localhost",
      "127.0.0.1",
      "[::1]",
      "192.168.1.10",
      "203.0.113.10",
    ]) {
      expect(isUnspecifiedServerUrl(`ws://${address}:27411`)).toBe(false);
    }
  });

  it("uses competition ranks without mutating the received snapshot", () => {
    const players = Object.freeze([
      { id: "player-3", name: "Sam", x: 0, y: 0, score: 1 },
      { id: "player-1", name: "Jo", x: 0, y: 0, score: 5 },
      { id: "player-2", name: "Alex", x: 0, y: 0, score: 5 },
    ]);
    expect(rankPlayers(players).map(({ player, rank }) => [player.name, rank])).toEqual([
      ["Alex", 1],
      ["Jo", 1],
      ["Sam", 3],
    ]);
    expect(players[0]?.name).toBe("Sam");
  });
});
