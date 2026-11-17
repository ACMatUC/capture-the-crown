import { describe, expect, it, onTestFinished } from "vitest";
import { WebSocket, type RawData } from "ws";
import {
  decodeServerMessage,
  MAX_PLAYERS,
  type GameState,
  type ServerErrorMessage,
  type ServerMessage,
  type WelcomeMessage,
} from "../shared/protocol.js";
import { createGame } from "../server/game.js";
import { startGameServer } from "../server/networking.js";

interface Client {
  socket: WebSocket;
  history: ServerMessage[];
  closed: Promise<{ code: number; reason: string }>;
  waitFor<T extends ServerMessage>(
    predicate: (message: ServerMessage) => message is T,
    since?: number,
  ): Promise<T>;
}

function seededRandom(seed: number): () => number {
  let current = seed;
  return () => {
    current ^= current << 13;
    current ^= current >>> 17;
    current ^= current << 5;
    return (current >>> 0) / 4294967296;
  };
}

async function connect(
  url: string,
  name: string,
  responseType: "welcome" | "error" = "welcome",
): Promise<Client> {
  const socket = new WebSocket(url);
  onTestFinished(() => socket.terminate());
  const closed = new Promise<{ code: number; reason: string }>((resolve) => {
    socket.once("close", (code, reason) => resolve({ code, reason: reason.toString() }));
  });
  const history: ServerMessage[] = [];
  const updates = new Set<() => void>();
  let failure: Error | undefined;
  socket.on("message", (raw) => {
    const message = decodeServerMessage(raw.toString());
    if (!message) {
      failure = new Error("Server sent an invalid message.");
    } else {
      history.push(message);
      if (message.type === "ping")
        socket.send(JSON.stringify({ type: "pong", sentAt: message.sentAt }));
    }
    for (const update of updates) update();
  });
  socket.on("error", (error) => {
    failure = error;
    for (const update of updates) update();
  });
  socket.on("close", () => {
    failure = new Error("Test client disconnected.");
    for (const update of updates) update();
  });
  const client: Client = {
    socket,
    history,
    closed,
    waitFor<T extends ServerMessage>(
      predicate: (message: ServerMessage) => message is T,
      since = 0,
    ): Promise<T> {
      return new Promise((resolve, reject) => {
        const cleanup = (): void => {
          clearTimeout(timer);
          updates.delete(check);
        };
        const check = (): void => {
          const message = history.slice(since).find(predicate);
          if (message) {
            cleanup();
            resolve(message);
          } else if (failure) {
            cleanup();
            reject(failure);
          }
        };
        const timer = setTimeout(() => {
          cleanup();
          reject(new Error(`Timed out waiting for ${name}'s server message.`));
        }, 4000);
        updates.add(check);
        check();
      });
    },
  };
  socket.once("open", () => socket.send(JSON.stringify({ type: "join", name })));
  await client.waitFor(
    (message): message is WelcomeMessage | ServerErrorMessage =>
      message.type === responseType,
  );
  return client;
}

function isState(message: ServerMessage): message is GameState {
  return message.type === "state";
}

function welcome(client: Client): WelcomeMessage {
  const message = client.history.find(
    (entry): entry is WelcomeMessage => entry.type === "welcome",
  );
  if (!message) throw new Error("Missing welcome message.");
  return message;
}

describe("real LAN protocol", () => {
  it("reports joined players over HTTP on the game port and releases the listener on shutdown", async () => {
    const server = await startGameServer({ host: "127.0.0.1", port: 0 });
    onTestFinished(() => server.close());
    const port = server.address().port;
    const healthUrl = `http://127.0.0.1:${port}/health`;
    const initial = await fetch(healthUrl);
    expect(initial.status).toBe(200);
    expect(initial.headers.get("cache-control")).toBe("no-store");
    expect(initial.headers.get("content-type")).toContain("application/json");
    await expect(initial.json()).resolves.toEqual({
      status: "ok",
      players: 0,
      maxPlayers: 32,
    });

    await connect(`ws://127.0.0.1:${port}`, "Health check");
    const joined = await fetch(healthUrl);
    await expect(joined.json()).resolves.toEqual({
      status: "ok",
      players: 1,
      maxPlayers: 32,
    });

    const page = await fetch(`http://127.0.0.1:${port}/`);
    expect(page.status).toBe(404);
    await expect(page.text()).resolves.toContain("index.html");

    await server.close();
    await expect(server.close()).resolves.toBeUndefined();
    const replacement = await startGameServer({ host: "127.0.0.1", port });
    onTestFinished(() => replacement.close());
    const restarted = await fetch(healthUrl);
    await expect(restarted.json()).resolves.toEqual({
      status: "ok",
      players: 0,
      maxPlayers: 32,
    });
  });

  it("admits 32 players into one world, rejects the 33rd, and reuses a freed slot", async () => {
    const server = await startGameServer({
      host: "127.0.0.1",
      port: 0,
      game: createGame({}, seededRandom(0x32c0ffee)),
    });
    onTestFinished(() => server.close());
    const url = `ws://127.0.0.1:${server.address().port}`;
    const clients = await Promise.all(
      Array.from({ length: MAX_PLAYERS }, (_, index) =>
        connect(url, `Player ${index + 1}`),
      ),
    );
    const first = clients[0];
    const departing = clients.at(-1);
    if (!first || !departing) throw new Error("Missing capacity-test clients.");

    const shared = await first.waitFor(
      (message): message is GameState =>
        isState(message) && message.players.length === MAX_PLAYERS,
    );
    await Promise.all(
      clients.map(async (client) => {
        const identical = await client.waitFor(
          (message): message is GameState =>
            isState(message) && JSON.stringify(message) === JSON.stringify(shared),
        );
        expect(identical).toEqual(shared);
      }),
    );
    expect(new Set(shared.players.map((player) => player.id)).size).toBe(32);
    expect(shared.coins).toHaveLength(10);

    const rejected = await connect(url, "Extra", "error");
    const rejection = await rejected.waitFor(
      (message): message is ServerErrorMessage => message.type === "error",
    );
    expect(rejection).toEqual({
      type: "error",
      code: "server_full",
      message: "The arena is full (32 players). Try again when a player leaves.",
    });
    expect(rejected.history.some((message) => message.type === "welcome")).toBe(false);
    await expect(rejected.closed).resolves.toEqual({ code: 1008, reason: "Server full" });
    expect(server.game.getStateSnapshot().players).toHaveLength(32);
    const fullHealth = await fetch(`http://127.0.0.1:${server.address().port}/health`);
    await expect(fullHealth.json()).resolves.toEqual({
      status: "ok",
      players: 32,
      maxPlayers: 32,
    });

    const closeMark = first.history.length;
    departing.socket.close();
    await first.waitFor(
      (message): message is GameState =>
        isState(message) && message.players.length === MAX_PLAYERS - 1,
      closeMark,
    );
    const replacement = await connect(url, "Replacement");
    const replaced = await replacement.waitFor(
      (message): message is GameState =>
        isState(message) && message.players.length === MAX_PLAYERS,
    );
    expect(welcome(replacement).id).not.toBe(welcome(departing).id);
    expect(replaced.players.some((player) => player.name === "Extra")).toBe(false);
    expect(
      replaced.players.find((player) => player.id === welcome(replacement).id),
    ).toMatchObject({
      name: "Replacement",
    });
  });

  it("shares one world, rejects forged state and repeated joins, and cleans up rejoining clients", async () => {
    const server = await startGameServer({
      host: "127.0.0.1",
      port: 0,
      game: createGame({}, seededRandom(0xc0ffee)),
    });
    onTestFinished(() => server.close());
    const url = `ws://127.0.0.1:${server.address().port}`;
    const first = await connect(url, "Alex");
    const second = await connect(url, "Sam");
    const shared = await first.waitFor(
      (message): message is GameState => isState(message) && message.players.length === 2,
    );
    const identical = await second.waitFor(
      (message): message is GameState =>
        isState(message) && JSON.stringify(message) === JSON.stringify(shared),
    );
    expect(identical).toEqual(shared);
    expect(shared.coins).toHaveLength(10);
    expect(shared.players.find((player) => player.id === welcome(second).id)?.score).toBe(
      0,
    );

    const mark = first.history.length;
    first.socket.send(JSON.stringify({ type: "join", name: "Ghost" }));
    first.socket.send(
      JSON.stringify({
        type: "state",
        players: [{ id: welcome(first).id, score: 999 }],
        coins: [],
      }),
    );
    first.socket.send("not json");
    first.socket.send(JSON.stringify({ type: "input", dx: 99, dy: 0 }));
    const afterInvalid = await first.waitFor(isState, mark);
    expect(afterInvalid.players).toEqual(shared.players);
    expect(afterInvalid.coins).toHaveLength(10);
    expect(first.history.filter((message) => message.type === "welcome")).toHaveLength(1);

    const firstId = welcome(first).id;
    const secondId = welcome(second).id;
    const origin = afterInvalid.players.find((player) => player.id === firstId);
    const stationary = afterInvalid.players.find((player) => player.id === secondId);
    if (!origin || !stationary) throw new Error("Missing joined players.");
    const dx = origin.x < 400 ? 1 : -1;
    const movementMark = first.history.length;
    first.socket.send(JSON.stringify({ type: "input", dx, dy: 0 }));
    const moved = await first.waitFor(
      (message): message is GameState =>
        isState(message) &&
        message.players.some((player) => player.id === firstId && player.x !== origin.x),
      movementMark,
    );
    first.socket.send(JSON.stringify({ type: "input", dx: 0, dy: 0 }));
    const movedPlayer = moved.players.find((player) => player.id === firstId);
    expect(movedPlayer?.y).toBe(origin.y);
    expect(((movedPlayer?.x ?? origin.x) - origin.x) * dx).toBeGreaterThan(0);
    expect(moved.players.find((player) => player.id === secondId)).toEqual(stationary);

    const closeMark = first.history.length;
    second.socket.close();
    const remaining = await first.waitFor(
      (message): message is GameState =>
        isState(message) && !message.players.some((player) => player.id === secondId),
      closeMark,
    );
    expect(remaining.players).toHaveLength(1);
    const rejoined = await connect(url, "Sam");
    expect(welcome(rejoined).id).not.toBe(secondId);
    const fresh = await rejoined.waitFor(isState);
    expect(
      fresh.players.find((player) => player.id === welcome(rejoined).id)?.score,
    ).toBe(0);
    await server.close();
    await expect(server.close()).resolves.toBeUndefined();
    expect(server.game.getStateSnapshot().players).toHaveLength(0);
  });

  it("awards a real pickup, respawns the crown, and maintains ten crowns", async () => {
    const values = [...Array<number>(20).fill(0.3), 0.1, 0.1];
    let index = 0;
    const game = createGame({}, () => values[index++] ?? 0.7);
    const server = await startGameServer({ host: "127.0.0.1", port: 0, game });
    onTestFinished(() => server.close());
    const client = await connect(`ws://127.0.0.1:${server.address().port}`, "Chaser");
    const playerId = welcome(client).id;
    let active = true;
    const drive = (raw: RawData): void => {
      const message = decodeServerMessage(raw.toString());
      if (!active || !message || message.type !== "state") return;
      const me = message.players.find((player) => player.id === playerId);
      const crown = message.coins[0];
      if (!me || !crown) return;
      client.socket.send(
        JSON.stringify({
          type: "input",
          dx: Math.sign(crown.x - me.x),
          dy: Math.sign(crown.y - me.y),
        }),
      );
    };
    client.socket.on("message", drive);
    const initial = await client.waitFor(isState);
    const pickedUp = await client.waitFor(
      (message): message is GameState =>
        isState(message) &&
        message.players.some((player) => player.id === playerId && player.score > 0),
    );
    active = false;
    client.socket.off("message", drive);
    client.socket.send(JSON.stringify({ type: "input", dx: 0, dy: 0 }));
    expect(pickedUp.coins).toHaveLength(10);
    expect(pickedUp.coins[0]).not.toEqual(initial.coins[0]);
    expect(pickedUp.coins.map((coin) => coin.id)).toEqual(
      initial.coins.map((coin) => coin.id),
    );
    for (const snapshot of client.history.filter(isState))
      expect(snapshot.coins).toHaveLength(10);
  }, 12000);

  it("surfaces listen failures without exiting the process", async () => {
    const first = await startGameServer({ host: "127.0.0.1", port: 0 });
    onTestFinished(() => first.close());
    await expect(
      startGameServer({ host: "127.0.0.1", port: first.address().port }),
    ).rejects.toMatchObject({ code: "EADDRINUSE" });
    expect(first.address().port).toBeGreaterThan(0);
  });
});
