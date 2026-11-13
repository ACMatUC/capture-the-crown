// ============================================================================
// networking.js (CLIENT SIDE)
//
// Owns the browser's WebSocket connection. Other client files use the
// functions below instead of reaching into the socket directly.
//
// PROTOCOL REFERENCE (see server/protocol.js):
//   [C -> S] join  { type: "join", name }
//   [C -> S] input { type: "input", dx, dy }
//   [C -> S] pong  { type: "pong", sentAt }
//   [S -> C] welcome, state, playerJoined, playerLeft, ping
// ============================================================================

const DEBUG = true;
const JOIN_TIMEOUT_MS = 8000;
let socket = null;
let myPlayerId = null;
let latestState = { players: [], coins: [] };
let connectionAttempt = 0;
let joinTimer = null;
let activeCallbacks = null;

const netStats = {
  sent: 0,
  received: 0,
  lastSent: null,
  lastReceived: null,
  pingMs: null,
};

/**
 * Opens one WebSocket and joins when it becomes available. A replacement
 * connection retires the old socket; late events cannot change this session.
 */
function connectToServer(playerName, serverUrl, callbacks) {
  const attempt = ++connectionAttempt;
  const previousSocket = socket;
  socket = null;
  clearTimeout(joinTimer);
  joinTimer = null;
  resetNetworkState();
  activeCallbacks = callbacks;
  closeSocket(previousSocket);
  callbacks.onConnectionChange("connecting");

  let nextSocket;
  try {
    nextSocket = new WebSocket(serverUrl);
  } catch (error) {
    finishConnection(
      "Could not open this address. Check the server LAN address and try again.",
      attempt,
    );
    return;
  }
  socket = nextSocket;
  const isCurrent = () =>
    connectionAttempt === attempt && socket === nextSocket;

  // Covers both an unreachable server and a socket that opens but never
  // accepts our join. Each timer belongs to exactly one connection attempt.
  joinTimer = setTimeout(() => {
    if (!isCurrent()) return;
    finishConnection(
      "Connection timed out. Check the server address, shared network, and that the server is running.",
      attempt,
    );
  }, JOIN_TIMEOUT_MS);

  nextSocket.addEventListener("open", () => {
    if (!isCurrent()) {
      closeSocket(nextSocket);
      return;
    }
    sendMessage({ type: "join", name: playerName });
  });

  nextSocket.addEventListener("message", (event) => {
    if (!isCurrent()) return;
    let message;
    try {
      message = JSON.parse(event.data);
    } catch (error) {
      console.warn("Ignored a server message that was not valid JSON.");
      return;
    }
    handleIncomingMessage(message, callbacks, attempt);
  });

  nextSocket.addEventListener("close", () => {
    if (!isCurrent()) return;
    const reason = myPlayerId
      ? "Connection lost. Check the server and join again. Rejoining starts a new score."
      : "Could not join. Check the server LAN address, shared network, and that the server is running.";
    finishConnection(reason, attempt);
  });

  nextSocket.addEventListener("error", () => {
    if (!isCurrent()) return;
    const reason = myPlayerId
      ? "Connection lost. Check the server and join again. Rejoining starts a new score."
      : "Could not connect. Check the server LAN address, shared network, and that the server is running.";
    finishConnection(reason, attempt);
  });
}

/** Leaves intentionally; an empty reason lets the UI distinguish leaving. */
function disconnectFromServer() {
  finishConnection("");
}

function finishConnection(reason, attempt = connectionAttempt) {
  if (attempt !== connectionAttempt) return;
  const closingSocket = socket;
  const callbacks = activeCallbacks;
  socket = null;
  activeCallbacks = null;
  connectionAttempt += 1;
  clearTimeout(joinTimer);
  joinTimer = null;
  resetNetworkState();
  closeSocket(closingSocket);
  if (callbacks) callbacks.onConnectionChange("disconnected", reason);
}

function closeSocket(closingSocket) {
  if (!closingSocket || closingSocket.readyState >= WebSocket.CLOSING) return;
  try {
    closingSocket.close();
  } catch (error) {
    // Some browsers reject close() while opening. This socket is already
    // retired, so none of its events can affect the active connection.
    console.warn("Could not close a retired connection.");
  }
}

function resetNetworkState() {
  myPlayerId = null;
  latestState = { players: [], coins: [] };
  Object.assign(netStats, {
    sent: 0,
    received: 0,
    lastSent: null,
    lastReceived: null,
    pingMs: null,
  });
  if (window.debugOverlay) window.debugOverlay.refresh();
}

/**
 * Serializes and sends one message. This is the only client socket.send call.
 */
function sendMessage(message) {
  if (!socket || socket.readyState !== WebSocket.OPEN) return false;

  try {
    socket.send(JSON.stringify(message));
  } catch (error) {
    finishConnection(
      "Connection lost. Check the server and join again. Rejoining starts a new score.",
    );
    return false;
  }
  netStats.sent += 1;
  netStats.lastSent = message;
  if (DEBUG) console.log("[SEND]", message);
  if (window.debugOverlay) window.debugOverlay.refresh();
  return true;
}

/**
 * Routes a parsed incoming message and stores it for the debug panel.
 */
function handleIncomingMessage(message, callbacks, attempt) {
  if (!isValidServerMessage(message)) {
    console.warn("Ignored a server message with an unexpected shape.");
    return;
  }
  if (message.type === "state" && !myPlayerId) return;

  netStats.received += 1;
  netStats.lastReceived = message;
  if (DEBUG) console.log("[RECV]", message);

  if (message.type === "welcome") {
    if (myPlayerId) return;
    clearTimeout(joinTimer);
    joinTimer = null;
    myPlayerId = message.id;
    callbacks.onConnectionChange("connected");
    if (attempt === connectionAttempt) callbacks.onWelcome(message);
  } else if (message.type === "state") {
    latestState = message;
    callbacks.onStateUpdate(message);
  } else if (message.type === "ping") {
    // This compares two PCs' clocks, not round-trip latency. The UI labels
    // it as a clock delta; clock skew can legitimately make it negative.
    netStats.pingMs = Date.now() - message.sentAt;
    sendMessage({ type: "pong", sentAt: message.sentAt });
  }

  if (window.debugOverlay) window.debugOverlay.refresh();
}

// Keep a student's malformed server edit from crashing the browser UI.
// This is deliberately small and mirrors the shapes in server/protocol.js.
function isValidServerMessage(message) {
  if (!message || typeof message !== "object") return false;
  if (message.type === "welcome") {
    return (
      typeof message.id === "string" &&
      message.id.length > 0 &&
      Number.isFinite(message.arenaWidth) &&
      message.arenaWidth > 0 &&
      Number.isFinite(message.arenaHeight) &&
      message.arenaHeight > 0
    );
  }
  if (message.type === "state") {
    return (
      Array.isArray(message.players) &&
      Array.isArray(message.coins) &&
      message.players.every(
        (player) =>
          player &&
          typeof player.id === "string" &&
          typeof player.name === "string" &&
          Number.isFinite(player.x) &&
          Number.isFinite(player.y) &&
          Number.isFinite(player.score),
      ) &&
      message.coins.every(
        (coin) =>
          coin &&
          typeof coin.id === "string" &&
          Number.isFinite(coin.x) &&
          Number.isFinite(coin.y),
      )
    );
  }
  if (message.type === "ping") return Number.isFinite(message.sentAt);
  if (message.type === "playerJoined" || message.type === "playerLeft") {
    return typeof message.id === "string" && typeof message.name === "string";
  }
  return false;
}

function getMyPlayerId() {
  return myPlayerId;
}

function getLatestState() {
  return latestState;
}

function getNetStats() {
  return netStats;
}
