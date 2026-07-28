// ============================================================================
// networking.js  (CLIENT SIDE)
//
// WHAT THIS FILE IS:
// Owns the single WebSocket connection from this browser client to the[cite: 2]
// server PC, and is the ONLY file allowed to call socket.send(). Everything[cite: 2]
// else in the client (input.js, renderer.js, main.js) talks to the[cite: 2]
// network only through the functions this file exposes.[cite: 2]
//
// WHY IT EXISTS:
// Just like the server keeps "networking" and "game logic" in separate[cite: 2]
// files, the client does too. renderer.js should never need to know what[cite: 2]
// a WebSocket is -- it just needs "the latest state," which main.js gets[cite: 2]
// from here and hands over.[cite: 2]
//
// PROTOCOL REFERENCE (see server/protocol.js for the full documentation):
//   [C -> S] join    { type: "join", name }
//   [C -> S] input   { type: "input", dx, dy }
//   [C -> S] pong    { type: "pong", sentAt }
//   [S -> C] welcome { type: "welcome", id, arenaWidth, arenaHeight }
//   [S -> C] state   { type: "state", players: [...], crown: {...} }
//   [S -> C] playerJoined / playerLeft / ping
// ============================================================================

// Set to true to see SEND/RECV logged to the browser console, in addition[cite: 2]
// to the on-page debug overlay (see debug.js). Handy during the workshop[cite: 2]
// to have the DevTools console open alongside the page.[cite: 2]
const DEBUG = true;

// The raw browser WebSocket object. Created in connectToServer().[cite: 2]
let socket = null;

// Our own player id, learned from the server's "welcome" message. We[cite: 2]
// need this so the renderer can tell "me" apart from other players.[cite: 2]
let myPlayerId = null;

// The most recent "state" message's contents. main.js reads this every[cite: 2]
// animation frame to redraw the canvas. Starts empty before the first[cite: 2]
// state message arrives.[cite: 2]
let latestState = { players: [], crown: null };

// Simple counters + last-message caches, purely for the debug overlay.[cite: 2]
const netStats = {
  sent: 0,
  received: 0,
  lastSent: null,
  lastReceived: null,
  pingMs: null,
};

/**
 * connectToServer(playerName, serverUrl, callbacks)
 *
 * WHAT IT DOES: opens a WebSocket connection to the workshop server PC,[cite: 2]
 * and immediately sends a "join" message once the connection is open.[cite: 2]
 *
 * WHY IT EXISTS: called once from main.js when the student clicks[cite: 2]
 * "Connect & Join."[cite: 2]
 *
 * RECEIVES:
 *   playerName (string) - typed into the join screen's text input.[cite: 2]
 *   serverUrl (string) - ws://<SERVER_LAN_IP>:<PORT>.[cite: 2]
 *   callbacks (object) - functions main.js wants called on key events:[cite: 2]
 *     { onWelcome(msg), onStateUpdate(state), onConnectionChange(status) }[cite: 2]
 * RETURNS: nothing.
 */
function connectToServer(playerName, serverUrl, callbacks) {
  callbacks.onConnectionChange("connecting"); //[cite: 2]
  socket = new WebSocket(serverUrl); //[cite: 2]

  socket.addEventListener("open", () => {
    callbacks.onConnectionChange("connected"); //[cite: 2]
    sendMessage({ type: "join", name: playerName }); //[cite: 2]
  });

  socket.addEventListener("message", (event) => {
    // JSON.parse turns the raw text that arrived over the network back[cite: 2]
    // into a JS object -- this is "deserialization," the mirror image of[cite: 2]
    // JSON.stringify in sendMessage() below.[cite: 2]
    const message = JSON.parse(event.data); //[cite: 2]
    handleIncomingMessage(message, callbacks); //[cite: 2]
  });

  socket.addEventListener("close", () => {
    callbacks.onConnectionChange("disconnected"); //[cite: 2]
  });

  socket.addEventListener("error", () => {
    callbacks.onConnectionChange("disconnected"); //[cite: 2]
  });
}

/**
 * sendMessage(message)
 *
 * WHAT IT DOES: the ONLY place in the entire client that calls[cite: 2]
 * socket.send(). Serializes a plain JS object into JSON text and sends[cite: 2]
 * it to the server, and updates debug counters.[cite: 2]
 *
 * WHY IT EXISTS: centralizing every outgoing message here means we can[cite: 2]
 * log/count them in exactly one place, and it makes it obvious, just by[cite: 2]
 * searching this file, everything this client is capable of sending.[cite: 2]
 *
 * RECEIVES: message (plain JS object, e.g. { type: "input", dx: 1, dy: 0 }).[cite: 2]
 * RETURNS: nothing.
 */
function sendMessage(message) {
  if (!socket || socket.readyState !== WebSocket.OPEN) return; //[cite: 2]

  // JSON.stringify turns our JS object into text -- "serialization." This[cite: 2]
  // is the exact text that travels over the network to the server.[cite: 2]
  socket.send(JSON.stringify(message)); //[cite: 2]

  netStats.sent += 1; //[cite: 2]
  netStats.lastSent = message; //[cite: 2]
  if (DEBUG) console.log("[SEND]", message); //[cite: 2]
  if (window.debugOverlay) window.debugOverlay.refresh(); //[cite: 2]
}

/**
 * handleIncomingMessage(message, callbacks)
 *
 * WHAT IT DOES: routes an incoming message to the right behavior based on[cite: 2]
 * its "type" field, mirroring how server/networking.js routes incoming[cite: 2]
 * client messages.[cite: 2]
 *
 * WHY IT EXISTS: called from the socket's "message" event listener above.[cite: 2]
 *
 * RECEIVES: message (parsed JS object), callbacks (from connectToServer).[cite: 2]
 * RETURNS: nothing.
 */
function handleIncomingMessage(message, callbacks) {
  netStats.received += 1; //[cite: 2]
  netStats.lastReceived = message; //[cite: 2]
  if (DEBUG) console.log("[RECV]", message); //[cite: 2]

  if (message.type === "welcome") {
    myPlayerId = message.id; //[cite: 2]
    callbacks.onWelcome(message); //[cite: 2]
  } else if (message.type === "state") {
    latestState = message; //[cite: 2]
    callbacks.onStateUpdate(message); //[cite: 2]

    // Re-evaluate the automatic tracking direction on every incoming server state update[cite: 2]
    if (typeof updateAndSendInput === "function") {
      updateAndSendInput();
    }
  } else if (message.type === "ping") {
    // Immediately echo the timestamp back so the server can compute[cite: 2]
    // round-trip time. We also compute our OWN estimate locally for the[cite: 2]
    // debug overlay, so students see a number update every ~2 seconds.[cite: 2]
    netStats.pingMs = Date.now() - message.sentAt; //[cite: 2]
    sendMessage({ type: "pong", sentAt: message.sentAt }); //[cite: 2]
  }

  if (window.debugOverlay) window.debugOverlay.refresh(); //[cite: 2]
}

/**
 * getMyPlayerId() / getLatestState() / getNetStats()
 *
 * Small read-only accessors so other client files (input.js, renderer.js,[cite: 2]
 * debug.js, main.js) can get at this file's data without reaching into[cite: 2]
 * its variables directly.[cite: 2]
 */
function getMyPlayerId() { return myPlayerId; } //[cite: 2]
function getLatestState() { return latestState; } //[cite: 2]
function getNetStats() { return netStats; } //[cite: 2]