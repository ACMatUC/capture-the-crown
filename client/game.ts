import type { GameState, PlayerSnapshot } from "../shared/protocol.js";

export interface RankedPlayer {
  readonly player: PlayerSnapshot;
  readonly rank: number;
}

export function rankPlayers(players: readonly PlayerSnapshot[]): RankedPlayer[] {
  const sorted = [...players].sort(
    (a, b) =>
      b.score - a.score || a.name.localeCompare(b.name) || a.id.localeCompare(b.id),
  );
  let previousScore: number | null = null;
  let rank = 0;
  return sorted.map((player, index) => {
    if (player.score !== previousScore) rank = index + 1;
    previousScore = player.score;
    return { player, rank };
  });
}

export function normalizeServerUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const address = trimmed.includes("://") ? trimmed : `ws://${trimmed}`;
  try {
    const url = new URL(address);
    if (
      url.protocol !== "ws:" ||
      !url.hostname ||
      url.username ||
      url.password ||
      url.pathname !== "/" ||
      url.search ||
      url.hash
    )
      return null;
    // URL normalizes explicit port 80 to an empty string. Keep that choice.
    const explicitPort = /:\d+\/?$/.test(address);
    if (!url.port && !explicitPort) url.port = "3000";
    return url.toString();
  } catch {
    return null;
  }
}

export function isUnspecifiedServerUrl(address: string): boolean {
  const hostname = new URL(address).hostname.toLowerCase().replace(/^\[|\]$/g, "");
  return hostname === "0.0.0.0" || hostname === "::";
}

export const PREVIEW_PLAYER_ID = "example-3";
export const PREVIEW_STATE: GameState = {
  type: "state",
  players: [
    { id: "example-1", name: "Alex", x: 155, y: 165, score: 0 },
    { id: "example-2", name: "Sam", x: 645, y: 415, score: 0 },
    { id: PREVIEW_PLAYER_ID, name: "You", x: 220, y: 435, score: 0 },
  ],
  coins: (
    [
      [100, 95],
      [325, 120],
      [560, 90],
      [710, 195],
      [95, 305],
      [630, 290],
      [390, 465],
      [100, 520],
      [690, 525],
      [470, 215],
    ] as const
  ).map(([x, y], index) => ({
    id: `coin-${index + 1}`,
    x,
    y,
  })),
};
