import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { WebSocket, WebSocketServer, type RawData } from "ws";
import {
  decodeClientMessage,
  MAX_PLAYERS,
  type ServerMessage,
} from "../shared/protocol.js";
import { createGame, GameFullError, type Game } from "./game.js";

export interface ServerLogger {
  log(message: string): void;
  warn(message: string): void;
  error(message: string): void;
}

export interface GameServerOptions {
  readonly host?: string;
  readonly port?: number;
  readonly debug?: boolean;
  readonly game?: Game;
  readonly logger?: ServerLogger;
}

export interface GameServer {
  readonly game: Game;
  address(): AddressInfo;
  close(): Promise<void>;
}

export async function startGameServer(
  options: GameServerOptions = {},
): Promise<GameServer> {
  const host = options.host ?? "0.0.0.0";
  const port = options.port ?? 3000;
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new RangeError("Server port must be an integer from 0 through 65535.");
  }
  const game = options.game ?? createGame();
  const logger = options.logger ?? console;
  const debug = options.debug ?? false;
  const playerIds = new Map<WebSocket, string>();
  const pingTimers = new Map<WebSocket, ReturnType<typeof setInterval>>();
  const httpServer = createServer((request, response) => {
    response.setHeader("Cache-Control", "no-store");
    if (request.method === "GET" && request.url === "/health") {
      response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
      response.end(
        JSON.stringify({
          status: "ok",
          players: playerIds.size,
          maxPlayers: MAX_PLAYERS,
        }),
      );
      return;
    }
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end(
      "Open the client folder's index.html to play. Check /health for server status.\n",
    );
  });
  const server = new WebSocketServer({ server: httpServer, maxPayload: 4096 });
  let stopping = false;
  let closing: Promise<void> | undefined;

  function logMessage(
    direction: "SEND" | "RECV",
    playerId: string,
    message: unknown,
  ): void {
    if (debug) logger.log(`${direction} ${playerId} ${JSON.stringify(message)}`);
  }

  function send(socket: WebSocket, message: ServerMessage): void {
    if (socket.readyState !== WebSocket.OPEN) return;
    logMessage("SEND", playerIds.get(socket) ?? "unjoined", message);
    socket.send(JSON.stringify(message), (error) => {
      if (error) {
        logger.warn(`Could not send to a client: ${error.message}`);
        socket.terminate();
      }
    });
  }

  function broadcast(message: ServerMessage): void {
    for (const socket of playerIds.keys()) send(socket, message);
  }

  function removeClient(socket: WebSocket): void {
    const timer = pingTimers.get(socket);
    if (timer) clearInterval(timer);
    pingTimers.delete(socket);
    const id = playerIds.get(socket);
    if (!id) return;
    const player = game.getStateSnapshot().players.find((entry) => entry.id === id);
    playerIds.delete(socket);
    game.removePlayer(id);
    if (!stopping && player) broadcast({ type: "playerLeft", id, name: player.name });
  }

  function receive(socket: WebSocket, raw: RawData): void {
    if (stopping) return;
    const message = decodeClientMessage(raw.toString());
    if (!message) {
      if (debug) logger.warn("Ignored an invalid client message.");
      return;
    }
    const id = playerIds.get(socket);
    logMessage("RECV", id ?? "unjoined", message);
    if (message.type === "join") {
      if (id) return;
      let player;
      try {
        player = game.addPlayer(message.name);
      } catch (error) {
        if (!(error instanceof GameFullError)) throw error;
        send(socket, { type: "error", code: "server_full", message: error.message });
        socket.close(1008, "Server full");
        return;
      }
      playerIds.set(socket, player.id);
      send(socket, {
        type: "welcome",
        id: player.id,
        arenaWidth: game.config.arenaWidth,
        arenaHeight: game.config.arenaHeight,
      });
      broadcast({ type: "playerJoined", id: player.id, name: player.name });
    } else if (message.type === "input" && id) {
      game.setPlayerInput(id, message.dx, message.dy);
    }
  }

  server.on("connection", (socket) => {
    if (stopping) {
      socket.terminate();
      return;
    }
    socket.on("message", (raw) => receive(socket, raw));
    socket.on("close", () => removeClient(socket));
    socket.on("error", (error) => {
      logger.warn(`Client socket error: ${error.message}`);
      socket.terminate();
    });
    pingTimers.set(
      socket,
      setInterval(() => {
        send(socket, { type: "ping", sentAt: Date.now() });
      }, game.config.pingIntervalMs),
    );
  });

  try {
    await new Promise<void>((resolve, reject) => {
      const onError = (error: Error): void => {
        server.off("listening", onListening);
        reject(error);
      };
      const onListening = (): void => {
        server.off("error", onError);
        resolve();
      };
      server.once("error", onError);
      server.once("listening", onListening);
      httpServer.listen(port, host);
    });
  } catch (error) {
    server.close();
    httpServer.close();
    throw error;
  }
  server.on("error", (error) => logger.error(`Game server error: ${error.message}`));

  const gameTimer = setInterval(() => {
    game.tick();
    broadcast(game.getStateSnapshot());
  }, 1000 / game.config.tickRate);

  return {
    game,
    address() {
      const address = httpServer.address();
      if (!address || typeof address === "string")
        throw new Error("The game server is not listening.");
      return address;
    },
    close() {
      if (closing) return closing;
      stopping = true;
      clearInterval(gameTimer);
      for (const timer of pingTimers.values()) clearInterval(timer);
      pingTimers.clear();
      for (const socket of server.clients) {
        removeClient(socket);
        socket.terminate();
      }
      const websocketClosing = new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
      const httpClosing = new Promise<void>((resolve, reject) => {
        httpServer.close((error) => (error ? reject(error) : resolve()));
      });
      httpServer.closeAllConnections();
      closing = Promise.all([websocketClosing, httpClosing]).then(() => undefined);
      return closing;
    },
  };
}
