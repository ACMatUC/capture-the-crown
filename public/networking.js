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
let socket = null;
let myPlayerId = null;
let latestState = { players: [], coins: [] };

const netStats = {
  sent: 0,
  received: 0,
  lastSent: null,
  lastReceived: null,
  pingMs: null,
};

/**
 * Opens a WebSocket and joins the game when it becomes available.
 */
function connectToServer(playerName, serverUrl, callbacks) {
  callbacks.onConnectionChange("connecting");
  socket = new WebSocket(serverUrl);

  socket.addEventListener("open", () => {
    callbacks.onConnectionChange("connected");
    sendMessage({ type: "join", name: playerName });
  });

  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    handleIncomingMessage(message, callbacks);
  });

  socket.addEventListener("close", () => {
    callbacks.onConnectionChange("disconnected");
  });

  socket.addEventListener("error", () => {
    callbacks.onConnectionChange("disconnected");
  });
}

/**
 * Serializes and sends one message. This is the only client socket.send call.
 */
function sendMessage(message) {
  if (!socket || socket.readyState !== WebSocket.OPEN) return;

  socket.send(JSON.stringify(message));
  netStats.sent += 1;
  netStats.lastSent = message;
  if (DEBUG) console.log("[SEND]", message);
  if (window.debugOverlay) window.debugOverlay.refresh();
}

/**
 * Routes a parsed incoming message and stores it for the debug panel.
 */
function handleIncomingMessage(message, callbacks) {
  netStats.received += 1;
  netStats.lastReceived = message;
  if (DEBUG) console.log("[RECV]", message);

  if (message.type === "welcome") {
    myPlayerId = message.id;
    callbacks.onWelcome(message);
  } else if (message.type === "state") {
    latestState = message;
    callbacks.onStateUpdate(message);
  } else if (message.type === "ping") {
    netStats.pingMs = Date.now() - message.sentAt;
    sendMessage({ type: "pong", sentAt: message.sentAt });
  }

  if (window.debugOverlay) window.debugOverlay.refresh();
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
