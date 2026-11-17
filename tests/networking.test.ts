import { afterEach, describe, expect, it, vi } from "vitest";
import { createGameConnection, type GameConnection } from "../client/networking.js";

class TestSocket extends EventTarget {
  readyState = 0;
  sent: string[] = [];
  failSend = false;
  open(): void {
    this.readyState = 1;
    this.dispatchEvent(new Event("open"));
  }
  receive(value: unknown): void {
    this.raw(JSON.stringify(value));
  }
  raw(data: string): void {
    this.dispatchEvent(new MessageEvent("message", { data }));
  }
  send(data: string): void {
    if (this.failSend) throw new Error("Socket closed during send");
    this.sent.push(data);
  }
  close(): void {
    this.readyState = 3;
    this.dispatchEvent(new Event("close"));
  }
}

const connections: GameConnection[] = [];
const welcome = { type: "welcome", id: "player-1", arenaWidth: 800, arenaHeight: 600 };
function setup() {
  const sockets: TestSocket[] = [];
  const connection = createGameConnection({
    createSocket: () => {
      const socket = new TestSocket();
      sockets.push(socket);
      return socket as unknown as WebSocket;
    },
  });
  connections.push(connection);
  const connect = () => {
    connection.connect("A", "ws://192.168.1.10:3000");
    const socket = sockets.at(-1);
    if (!socket) throw new Error("Socket factory was not called");
    return socket;
  };
  return { connection, sockets, connect };
}

afterEach(() => {
  for (const connection of connections.splice(0)) connection.dispose();
  vi.useRealTimers();
});

describe("client connection lifecycle", () => {
  it("joins on open but enables gameplay only after welcome", () => {
    const { connection, connect } = setup();
    const socket = connect();
    socket.open();
    expect(socket.sent.map((raw) => JSON.parse(raw) as unknown)).toEqual([
      { type: "join", name: "A" },
    ]);
    expect(connection.getSnapshot().status).toBe("connecting");
    expect(connection.sendDirection({ dx: 1, dy: 0 })).toBe(false);
    socket.receive(welcome);
    expect(connection.getSnapshot().status).toBe("connected");
    expect(connection.sendDirection({ dx: 1, dy: 0 })).toBe(true);
    expect(JSON.parse(socket.sent.at(-1) ?? "null")).toEqual({
      type: "input",
      dx: 1,
      dy: 0,
    });
  });

  it("ignores events from a retired connection and clears its timer", () => {
    vi.useFakeTimers();
    const { connection, connect } = setup();
    const old = connect();
    const current = connect();
    current.open();
    current.receive(welcome);
    old.open();
    old.receive({ ...welcome, id: "stale" });
    old.close();
    vi.advanceTimersByTime(9000);
    expect(old.readyState).toBe(3);
    expect(connection.getSnapshot().playerId).toBe("player-1");
    expect(connection.getSnapshot().status).toBe("connected");
    expect(vi.getTimerCount()).toBe(0);
  });

  it("distinguishes a reachable socket that never sends a game welcome", () => {
    vi.useFakeTimers();
    const { connection, connect } = setup();
    const socket = connect();
    socket.open();
    vi.advanceTimersByTime(8000);
    expect(connection.getSnapshot().status).toBe("disconnected");
    expect(connection.getSnapshot().error).toContain("timed out");
    expect(connection.getSnapshot().error).toContain("WebSocket opened");
    expect(socket.readyState).toBe(3);
  });

  it("explains a timeout before the WebSocket handshake completes", () => {
    vi.useFakeTimers();
    const { connection, connect } = setup();
    const socket = connect();
    vi.advanceTimersByTime(8000);
    expect(connection.getSnapshot().status).toBe("disconnected");
    expect(connection.getSnapshot().error).toContain("before WebSocket opened");
    expect(connection.getSnapshot().error).toContain("VPN forwarding");
    expect(socket.readyState).toBe(3);
  });

  it("shows a server-full rejection instead of a timeout or generic disconnect", () => {
    vi.useFakeTimers();
    const { connection, connect } = setup();
    const socket = connect();
    socket.open();
    socket.receive({
      type: "error",
      code: "server_full",
      message: "This game is full (32 players). Try again when someone leaves.",
    });
    socket.close();
    vi.advanceTimersByTime(8000);
    expect(connection.getSnapshot().status).toBe("disconnected");
    expect(connection.getSnapshot().error).toContain("full (32 players)");
    expect(vi.getTimerCount()).toBe(0);
  });

  it("keeps valid state when malformed server messages arrive", () => {
    const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { connection, connect } = setup();
    const socket = connect();
    socket.open();
    socket.receive(welcome);
    const state = {
      type: "state",
      players: [{ id: "player-1", name: "A", x: 4, y: 5, score: 2 }],
      coins: [],
    };
    socket.receive(state);
    socket.raw("{");
    socket.receive({ type: "state", players: null, coins: [] });
    expect(connection.getSnapshot().state).toEqual(state);
    expect(warning).toHaveBeenCalledTimes(2);
  });

  it("echoes ping and labels the timestamp comparison as a clock delta", () => {
    vi.useFakeTimers();
    vi.setSystemTime(5000);
    const { connection, connect } = setup();
    const socket = connect();
    socket.open();
    socket.receive(welcome);
    socket.receive({ type: "ping", sentAt: 4500 });
    expect(connection.getSnapshot().stats.clockDeltaMs).toBe(500);
    expect(JSON.parse(socket.sent.at(-1) ?? "null")).toEqual({
      type: "pong",
      sentAt: 4500,
    });
  });

  it("clears identity, state, and stats on leaving and rejoining", () => {
    const { connection, connect } = setup();
    const first = connect();
    first.open();
    first.receive(welcome);
    connection.disconnect();
    expect(connection.getSnapshot()).toMatchObject({
      status: "disconnected",
      playerId: null,
      stats: { sent: 0, received: 0 },
    });
    const second = connect();
    second.open();
    second.receive({ ...welcome, id: "player-2" });
    expect(connection.getSnapshot().playerId).toBe("player-2");
    expect(connection.getSnapshot().error).toBe("");
  });

  it("recovers from construction, transport, and send failures", () => {
    const failed = createGameConnection({
      createSocket: () => {
        throw new Error("invalid URL");
      },
    });
    connections.push(failed);
    failed.connect("A", "bad");
    expect(failed.getSnapshot().error).toContain("Could not open");
    const { connection, connect } = setup();
    const socket = connect();
    socket.open();
    socket.receive(welcome);
    socket.failSend = true;
    expect(connection.sendDirection({ dx: 1, dy: 0 })).toBe(false);
    expect(connection.getSnapshot().error).toContain("Connection lost");
    const retry = connect();
    retry.dispatchEvent(new Event("error"));
    expect(connection.getSnapshot().status).toBe("disconnected");
  });
});
