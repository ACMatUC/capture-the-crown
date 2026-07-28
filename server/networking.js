// ============================================================================
// networking.js  (SERVER SIDE)
//
// WHAT THIS FILE IS:
// The bridge between "the network" (raw WebSocket connections) and "the
// game" (game.js). This is arguably the single most important file in the
// project for the workshop's learning goals -- read it slowly.
//
// WHY IT EXISTS:
// We deliberately keep networking code and game-logic code in separate
// files. game.js knows nothing about WebSockets. This file knows nothing
// about how movement or scoring works. That separation is itself a
// networking lesson: the "game" and the "network" are two different
// concerns that only talk to each other through a small, well-defined
// interface (addPlayer, removePlayer, setPlayerInput, getStateSnapshot).
// ============================================================================

const WebSocket = require("ws");
const { isValidMessage } = require("./protocol");
const { PING_INTERVAL_MS } = require("./constants");
const game = require("./game");

// Set this to true to see every single message this server sends/receives
// printed to the terminal. Great for the workshop -- turn it on and watch
// the console while two client PCs play together.
const DEBUG = true;

// Maps a live WebSocket connection -> the player id it belongs to. We need
// this both directions: when a message arrives on a socket, we need to
// know which player sent it; when a player leaves, we need to find their
// socket to clean it up (see handleClose).
const socketToPlayerId = new Map();
const playerIdToSocket = new Map();

/**
 * logDebug(direction, socketLabel, message)
 *
 * WHAT IT DOES: prints a one-line, readable log of a message that just
 * went over the wire, prefixed with SEND or RECV.
 *
 * WHY IT EXISTS: makes the invisible network traffic visible in the
 * terminal, which is the whole point of a networking workshop. Students
 * can watch this scroll by while they play and match it up against what
 * they see in the browser's own debug overlay (public/debug.js).
 *
 * WHEN IT EXECUTES: called from sendTo() and handleMessage() below,
 * whenever DEBUG is true.
 */
const live = {
  state: null,
  inputs: {},
};

function render() {
  
  //Comment the below line to stop clearing the console on every tick. This is useful for debugging, but can be overwhelming if you want to see a history of messages.
  process.stdout.write("\x1Bc");

  console.log("=== GAME STATE ===");
  console.log(JSON.stringify(live.state, null, 2));

  console.log("\n=== LATEST INPUTS ===");
  console.log(JSON.stringify(live.inputs, null, 2));
}

function logDebug(direction, socketLabel, message) {
  if (!DEBUG) return;

  if (direction === "SEND" && message.type === "state") {
    live.state = message;
  }

  if (direction === "RECV" && message.type === "input") {
    live.inputs[socketLabel] = message;
  }

  render();
}

/**
 * sendTo(socket, message)
 *
 * WHAT IT DOES: serializes a JS object to JSON and sends it down one
 * specific WebSocket connection.
 *
 * WHY IT EXISTS: every outgoing message in this whole server passes
 * through this one function, which is exactly what makes DEBUG logging
 * (and JSON.stringify, i.e. "serialization") simple to explain: this is
 * the ONE place where a JS object becomes text that travels over the
 * network.
 *
 * RECEIVES: socket (a ws WebSocket instance), message (plain JS object).
 * RETURNS: nothing.
 */
function sendTo(socket, message) {
  if (socket.readyState !== WebSocket.OPEN) return;
  const id = socketToPlayerId.get(socket) || "unknown";
  logDebug("SEND", id, message);
  socket.send(JSON.stringify(message));
}

/**
 * broadcast(message)
 *
 * WHAT IT DOES: sends the same message to every currently-connected
 * client.
 *
 * WHY IT EXISTS: used for "state" (every tick) and for "playerJoined" /
 * "playerLeft" notifications. This is how "one server, many clients"
 * synchronization actually happens: everyone receives the exact same
 * JSON at (roughly) the exact same time.
 *
 * RECEIVES: message (plain JS object).
 * RETURNS: nothing.
 */
function broadcast(message) {
  for (const socket of playerIdToSocket.values()) {
    sendTo(socket, message);
  }
}

/**
 * startWebSocketServer(options, onListening)
 *
 * WHAT IT DOES: creates a standalone ws WebSocketServer, wires up
 * connection/message/close handling, and starts the game's fixed-rate
 * tick loop.
 *
 * WHY IT EXISTS: called once from server.js at startup. This function is
 * the "entry point" for all networking in the project. The server binds
 * directly to 0.0.0.0:<PORT> so client PCs on the same LAN can connect.
 *
 * RECEIVES:
 *   options ({ host, port }) - bind address and port.
 *   onListening (function) - called once the OS has opened the port.
 * RETURNS: nothing.
 */
function startWebSocketServer(options, onListening) {
  const wss = new WebSocket.Server(options, onListening);

  wss.on("error", (err) => {
    console.error(`WebSocket server failed to listen on ${options.host}:${options.port}.`);
    console.error(`${err.code || "ERROR"}: ${err.message}`);
    process.exit(1);
  });

  wss.on("connection", (socket) => {
    console.log("A LAN client connected. Waiting for its 'join' message...");

    socket.on("message", (raw) => handleMessage(socket, raw));
    socket.on("close", () => handleClose(socket));

    // Every connected socket gets pinged periodically so we can measure
    // round-trip latency for the debug overlay. See protocol.js "ping".
    const pingTimer = setInterval(() => {
      sendTo(socket, { type: "ping", sentAt: Date.now() });
    }, PING_INTERVAL_MS);
    socket.on("close", () => clearInterval(pingTimer));
  });

  // Start the authoritative game loop. Every tick, game.js hands us a
  // fresh snapshot of the whole world, and our only job is to broadcast
  // it to everyone. game.js has NO idea WebSockets exist -- it just calls
  // this callback.
  game.startGameLoop((stateMessage) => {
    broadcast(stateMessage);
  });
}

/**
 * handleMessage(socket, raw)
 *
 * WHAT IT DOES: the front door for every incoming network message.
 * Parses the raw text as JSON ("deserialization"), validates it, and
 * routes it to the right handler based on its "type" field.
 *
 * WHY IT EXISTS: keeps message routing in one obvious place instead of
 * scattering socket.on("message", ...) handlers throughout the codebase.
 *
 * WHEN IT EXECUTES: every time ANY connected client sends ANY message.
 *
 * RECEIVES: socket (the ws connection it came from), raw (a Buffer/string
 *   of JSON text -- this is what "bytes on the wire" actually look like
 *   before we turn them back into a JS object).
 * RETURNS: nothing.
 */
function handleMessage(socket, raw) {
  let message;
  try {
    // JSON.parse is "deserialization": turning network text back into a
    // JS object we can work with.
    message = JSON.parse(raw.toString());
  } catch (err) {
    console.warn("Received text that was not valid JSON. Ignoring it.");
    return;
  }

  if (!isValidMessage(message)) {
    console.warn("Received a validly-formed JSON message we don't recognize or trust:", message);
    return;
  }

  const knownId = socketToPlayerId.get(socket);
  logDebug("RECV", knownId || "new-connection", message);

  if (message.type === "join") {
    handleJoin(socket, message);
  } else if (message.type === "input") {
    handleInput(socket, message);
  } else if (message.type === "pong") {
    // We don't do anything with pong beyond logging it above -- a real
    // application might use it to compute and store a per-player ping.
    // WORKSHOP EXERCISE candidate: try computing latency here!
  }
}

/**
 * handleJoin(socket, message)
 *
 * WHAT IT DOES: registers a brand-new player, tells THEM their id via
 * "welcome", and tells EVERYONE ELSE that a new player joined.
 *
 * WHY IT EXISTS: called from handleMessage() when message.type === "join".
 * This is the very first real interaction between a browser client and the
 * server.
 */
function handleJoin(socket, message) {
  const player = game.addPlayer(message.name);

  socketToPlayerId.set(socket, player.id);
  playerIdToSocket.set(player.id, socket);

  sendTo(socket, {
    type: "welcome",
    id: player.id,
    arenaWidth: require("./constants").ARENA_WIDTH,
    arenaHeight: require("./constants").ARENA_HEIGHT,
  });

  for (const [otherId, otherSocket] of playerIdToSocket) {
    if (otherId === player.id) continue;
    sendTo(otherSocket, { type: "playerJoined", id: player.id, name: player.name });
  }

  console.log(`${player.name} joined as ${player.id}`);
}

/**
 * handleInput(socket, message)
 *
 * WHAT IT DOES: forwards a client's requested movement direction into
 * game.js. Notice this function does NOT change any position itself --
 * it just records "this player wants to move this way." The actual
 * movement happens later, inside game.js's fixed tick loop.
 *
 * WHY IT EXISTS: called from handleMessage() when message.type === "input".
 */
function handleInput(socket, message) {
  const playerId = socketToPlayerId.get(socket);
  if (!playerId) return; // Ignore input from a socket that never joined.
  game.setPlayerInput(playerId, message.dx, message.dy);
}

/**
 * handleClose(socket)
 *
 * WHAT IT DOES: cleans up all bookkeeping for a socket that disconnected,
 * removes the player from the game, and tells everyone else they left.
 *
 * WHY IT EXISTS: registered as a "close" listener in startWebSocketServer.
 * Multiplayer servers must always handle the "someone just vanished"
 * case -- connections drop for all kinds of ordinary reasons (closing a
 * tab, laptop going to sleep, wifi hiccup).
 */
function handleClose(socket) {
  const playerId = socketToPlayerId.get(socket);
  if (!playerId) return;

  const player = game.getStateSnapshot().players.find((p) => p.id === playerId);

  game.removePlayer(playerId);
  socketToPlayerId.delete(socket);
  playerIdToSocket.delete(playerId);

  broadcast({ type: "playerLeft", id: playerId, name: player ? player.name : "unknown" });
  console.log(`${playerId} disconnected.`);
}

module.exports = { startWebSocketServer };
