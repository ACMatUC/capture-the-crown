import {
  decodeServerMessage,
  isDirection,
  MAX_PLAYER_NAME_LENGTH,
  type ClientMessage,
  type Direction,
  type GameState,
  type ServerMessage,
} from "../shared/protocol.js";

export type ConnectionStatus = "disconnected" | "connecting" | "connected";

export interface NetworkStats {
  readonly sent: number;
  readonly received: number;
  readonly lastSent: ClientMessage | null;
  readonly lastReceived: ServerMessage | null;
  readonly clockDeltaMs: number | null;
}

export interface ConnectionSnapshot {
  readonly status: ConnectionStatus;
  readonly playerId: string | null;
  readonly state: GameState;
  readonly arena: { readonly width: number; readonly height: number };
  readonly error: string;
  readonly stats: NetworkStats;
}

export interface ConnectionOptions {
  readonly createSocket?: (url: string) => WebSocket;
  readonly joinTimeoutMs?: number;
}

const CONNECTION_LOST =
  "Connection lost. Check the server and join again. Rejoining starts a new score.";

function emptySnapshot(error = ""): ConnectionSnapshot {
  return {
    status: "disconnected",
    playerId: null,
    state: { type: "state", players: [], coins: [] },
    arena: { width: 800, height: 600 },
    error,
    stats: {
      sent: 0,
      received: 0,
      lastSent: null,
      lastReceived: null,
      clockDeltaMs: null,
    },
  };
}

export class GameConnection {
  private snapshot = emptySnapshot();
  private socket: WebSocket | null = null;
  private generation = 0;
  private joinTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly listeners = new Set<() => void>();
  private readonly createSocket: (url: string) => WebSocket;
  private readonly joinTimeoutMs: number;

  constructor(options: ConnectionOptions = {}) {
    this.createSocket = options.createSocket ?? ((url) => new WebSocket(url));
    this.joinTimeoutMs = options.joinTimeoutMs ?? 8000;
  }

  getSnapshot = (): ConnectionSnapshot => this.snapshot;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  connect(name: string, url: string): void {
    this.retireSocket();
    const playerName = name.trim().slice(0, MAX_PLAYER_NAME_LENGTH);
    if (!playerName) {
      this.publish(emptySnapshot("Enter a player name before joining."));
      return;
    }
    this.publish({ ...emptySnapshot(), status: "connecting" });
    const generation = this.generation;
    let socket: WebSocket;
    try {
      socket = this.createSocket(url);
    } catch {
      this.finish("Could not open this address. Use ws://HOST:PORT.");
      return;
    }
    this.socket = socket;
    const isCurrent = () => this.generation === generation && this.socket === socket;

    this.joinTimer = setTimeout(() => {
      if (isCurrent()) {
        this.finish(
          socket.readyState === 1
            ? "WebSocket opened, but the game welcome timed out. Check that this port runs Capture the Crown."
            : "Timed out before WebSocket opened. Host PC: use localhost. Check TCP/VPN forwarding and firewall.",
        );
      }
    }, this.joinTimeoutMs);

    socket.addEventListener("open", () => {
      if (!isCurrent()) {
        this.closeSocket(socket);
        return;
      }
      this.send({ type: "join", name: playerName });
    });
    socket.addEventListener("message", (event: MessageEvent<unknown>) => {
      if (!isCurrent()) return;
      const message =
        typeof event.data === "string" ? decodeServerMessage(event.data) : null;
      if (!message) {
        console.warn("Ignored a server message that does not match the game protocol.");
        return;
      }
      this.receive(message);
    });
    const handleFailure = () => {
      if (!isCurrent()) return;
      this.finish(
        this.snapshot.playerId
          ? CONNECTION_LOST
          : "Could not connect. Check the host address, TCP port, VPN forwarding, and firewall.",
      );
    };
    socket.addEventListener("close", handleFailure);
    socket.addEventListener("error", handleFailure);
  }

  disconnect(): void {
    if (!this.socket && this.snapshot.status === "disconnected") return;
    this.finish("You left the game. Rejoining starts at zero.");
  }

  sendDirection(direction: Direction): boolean {
    if (this.snapshot.status !== "connected" || !isDirection(direction)) return false;
    return this.send({ type: "input", ...direction });
  }

  dispose(): void {
    this.disconnect();
    this.listeners.clear();
  }

  private receive(message: ServerMessage): void {
    if (message.type === "state" && !this.snapshot.playerId) return;
    if (message.type === "welcome" && this.snapshot.playerId) return;
    const stats = {
      ...this.snapshot.stats,
      received: this.snapshot.stats.received + 1,
      lastReceived: message,
    };
    switch (message.type) {
      case "error":
        this.finish(message.message);
        break;
      case "welcome":
        this.clearJoinTimer();
        this.publish({
          ...this.snapshot,
          status: "connected",
          playerId: message.id,
          arena: { width: message.arenaWidth, height: message.arenaHeight },
          stats,
        });
        break;
      case "state":
        this.publish({ ...this.snapshot, state: message, stats });
        break;
      case "ping":
        this.publish({
          ...this.snapshot,
          stats: { ...stats, clockDeltaMs: Date.now() - message.sentAt },
        });
        this.send({ type: "pong", sentAt: message.sentAt });
        break;
      default:
        this.publish({ ...this.snapshot, stats });
    }
  }

  private send(message: ClientMessage): boolean {
    const socket = this.socket;
    if (!socket || socket.readyState !== 1) return false;
    try {
      socket.send(JSON.stringify(message));
    } catch {
      this.finish(CONNECTION_LOST);
      return false;
    }
    this.publish({
      ...this.snapshot,
      stats: {
        ...this.snapshot.stats,
        sent: this.snapshot.stats.sent + 1,
        lastSent: message,
      },
    });
    return true;
  }

  private finish(error: string): void {
    this.retireSocket();
    this.publish(emptySnapshot(error));
  }

  private retireSocket(): void {
    this.generation += 1;
    this.clearJoinTimer();
    const previous = this.socket;
    this.socket = null;
    if (previous) this.closeSocket(previous);
  }

  private clearJoinTimer(): void {
    if (this.joinTimer !== null) clearTimeout(this.joinTimer);
    this.joinTimer = null;
  }

  private closeSocket(socket: WebSocket): void {
    if (socket.readyState >= 2) return;
    try {
      socket.close();
    } catch {
      // Retired sockets are also closed by their late open handler.
      console.warn("The browser could not close an opening connection yet.");
    }
  }

  private publish(snapshot: ConnectionSnapshot): void {
    this.snapshot = snapshot;
    for (const listener of this.listeners) listener();
  }
}

export function createGameConnection(options?: ConnectionOptions): GameConnection {
  return new GameConnection(options);
}
