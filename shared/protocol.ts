export const MAX_PLAYER_NAME_LENGTH = 16;
export const MAX_PLAYERS = 32;

export type Axis = -1 | 0 | 1;

export interface Direction {
  readonly dx: Axis;
  readonly dy: Axis;
}

export interface PlayerSnapshot {
  readonly id: string;
  readonly name: string;
  readonly x: number;
  readonly y: number;
  readonly score: number;
}

export interface CoinSnapshot {
  readonly id: string;
  readonly x: number;
  readonly y: number;
}

export interface GameState {
  readonly type: "state";
  readonly players: readonly PlayerSnapshot[];
  readonly coins: readonly CoinSnapshot[];
}

export interface WelcomeMessage {
  readonly type: "welcome";
  readonly id: string;
  readonly arenaWidth: number;
  readonly arenaHeight: number;
}

export interface ServerErrorMessage {
  readonly type: "error";
  readonly code: "server_full";
  readonly message: string;
}

export type ClientMessage =
  | { readonly type: "join"; readonly name: string }
  | ({ readonly type: "input" } & Direction)
  | { readonly type: "pong"; readonly sentAt: number };

export type ServerMessage =
  | WelcomeMessage
  | ServerErrorMessage
  | GameState
  | {
      readonly type: "playerJoined" | "playerLeft";
      readonly id: string;
      readonly name: string;
    }
  | { readonly type: "ping"; readonly sentAt: number };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function isAxis(value: unknown): value is Axis {
  return value === -1 || value === 0 || value === 1;
}

export function isDirection(value: unknown): value is Direction {
  return isRecord(value) && isAxis(value.dx) && isAxis(value.dy);
}

export function isClientMessage(value: unknown): value is ClientMessage {
  if (!isRecord(value)) return false;
  switch (value.type) {
    case "join":
      return isText(value.name) && value.name.length <= MAX_PLAYER_NAME_LENGTH;
    case "input":
      return isDirection(value);
    case "pong":
      return isFiniteNumber(value.sentAt);
    default:
      return false;
  }
}

function isPlayer(value: unknown): value is PlayerSnapshot {
  return (
    isRecord(value) &&
    isText(value.id) &&
    isText(value.name) &&
    isFiniteNumber(value.x) &&
    isFiniteNumber(value.y) &&
    isFiniteNumber(value.score) &&
    Number.isInteger(value.score) &&
    value.score >= 0
  );
}

function isCoin(value: unknown): value is CoinSnapshot {
  return (
    isRecord(value) &&
    isText(value.id) &&
    isFiniteNumber(value.x) &&
    isFiniteNumber(value.y)
  );
}

export function isServerMessage(value: unknown): value is ServerMessage {
  if (!isRecord(value)) return false;
  switch (value.type) {
    case "welcome":
      return (
        isText(value.id) &&
        isFiniteNumber(value.arenaWidth) &&
        value.arenaWidth > 0 &&
        isFiniteNumber(value.arenaHeight) &&
        value.arenaHeight > 0
      );
    case "state":
      return (
        Array.isArray(value.players) &&
        value.players.every(isPlayer) &&
        Array.isArray(value.coins) &&
        value.coins.every(isCoin)
      );
    case "ping":
      return isFiniteNumber(value.sentAt);
    case "error":
      return value.code === "server_full" && isText(value.message);
    case "playerJoined":
    case "playerLeft":
      return isText(value.id) && isText(value.name);
    default:
      return false;
  }
}

export function decodeClientMessage(raw: string): ClientMessage | null {
  try {
    const value: unknown = JSON.parse(raw);
    return isClientMessage(value) ? value : null;
  } catch {
    return null;
  }
}

export function decodeServerMessage(raw: string): ServerMessage | null {
  try {
    const value: unknown = JSON.parse(raw);
    return isServerMessage(value) ? value : null;
  } catch {
    return null;
  }
}
