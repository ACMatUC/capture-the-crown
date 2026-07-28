// ============================================================================
// main.js  (CLIENT SIDE)
//
// WHAT THIS FILE IS:
// The entry point for the browser client. It wires the join screen, the
// networking layer, the input listener, the renderer, and the debug
// overlay together. It intentionally contains almost no logic of its
// own -- it just connects the other files.
//
// WHY IT EXISTS:
// Every other client file (networking.js, input.js, renderer.js,
// debug.js) can be understood in isolation. This file is where you come
// to see how they fit together into one running page.
// ============================================================================

const joinScreen = document.getElementById("joinScreen");
const gameScreen = document.getElementById("gameScreen");
const nameInput = document.getElementById("nameInput");
const serverUrlInput = document.getElementById("serverUrlInput");
const joinError = document.getElementById("joinError");
const joinButton = document.getElementById("joinButton");
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const debugToggle = document.getElementById("debugToggle");
const DEFAULT_WS_PORT = "3000";

/**
 * handleJoinClick()
 *
 * WHAT IT DOES: reads the typed name, switches from the join screen to
 * the game screen, and kicks off the WebSocket connection.
 *
 * WHY IT EXISTS: the click handler for the "Connect & Join" button. This
 * is the moment a student's browser client first talks to the network.
 */
function handleJoinClick() {
  const name = nameInput.value.trim() || `Player${Math.floor(Math.random() * 1000)}`;
  const serverUrl = normalizeServerUrl(serverUrlInput.value);

  if (!serverUrl) {
    joinError.textContent = "Enter the server PC LAN address as ws://<SERVER_IP>:<PORT>.";
    return;
  }

  if (isLocalServerUrl(serverUrl)) {
    joinError.textContent = "Use the server PC's LAN IP address, not localhost or 127.0.0.1.";
    return;
  }

  joinError.textContent = "";
  joinButton.disabled = true;

  connectToServer(name, serverUrl, {
    onConnectionChange: handleConnectionChange,
    onWelcome: handleWelcome,
    onStateUpdate: handleStateUpdate,
  });
}

function normalizeServerUrl(rawValue) {
  const trimmed = rawValue.trim();
  if (!trimmed) return null;

  const withScheme = trimmed.includes("://") ? trimmed : `ws://${trimmed}`;

  try {
    const url = new URL(withScheme);
    if (url.protocol !== "ws:") return null;
    if (!url.hostname) return null;
    if (!url.port) url.port = DEFAULT_WS_PORT;
    url.pathname = "/";
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch (err) {
    return null;
  }
}

function isLocalServerUrl(serverUrl) {
  const hostname = new URL(serverUrl).hostname.toLowerCase();
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

/**
 * handleConnectionChange(status)
 *
 * WHAT IT DOES: reflects the current WebSocket connection state
 * ("connecting" / "connected" / "disconnected") in the UI.
 *
 * WHY IT EXISTS: passed into connectToServer() as a callback, so
 * networking.js can report status changes without needing to know how
 * the UI displays them.
 */
function handleConnectionChange(status) {
  window.debugOverlay.setConnectionStatus(status);
  if (status === "disconnected") joinButton.disabled = false;
}

/**
 * handleWelcome(message)
 *
 * WHAT IT DOES: runs once, the moment the server confirms our join by
 * sending "welcome". Switches from the join screen to the game screen and
 * starts listening for keyboard input.
 *
 * WHY IT EXISTS: passed into connectToServer() as the onWelcome callback.
 *
 * RECEIVES: message ({ type: "welcome", id, arenaWidth, arenaHeight }).
 */
function handleWelcome(message) {
  joinScreen.classList.add("hidden");
  gameScreen.classList.remove("hidden");

  canvas.width = message.arenaWidth;
  canvas.height = message.arenaHeight;

  startListeningForInput();
  requestAnimationFrame(renderLoop);
}

/**
 * handleStateUpdate(state)
 *
 * WHAT IT DOES: refreshes the scoreboard sidebar whenever a fresh "state"
 * message arrives. (The canvas itself is redrawn separately, every
 * animation frame, in renderLoop() below -- see the comment there for
 * why those are handled differently.)
 *
 * RECEIVES: state ({ players: [...], crown: {...} }).
 */
function handleStateUpdate(state) {
  renderScoreboard(state.players);
}

/**
 * renderScoreboard(players)
 *
 * WHAT IT DOES: rebuilds the <ol id="scoreboard"> list from the current
 * player list, sorted highest score first.
 *
 * RECEIVES: players (array from the latest "state" message).
 */
function renderScoreboard(players) {
  const list = document.getElementById("scoreboard");
  const myId = getMyPlayerId();

  const sorted = [...players].sort((a, b) => b.score - a.score);

  list.innerHTML = "";
  for (const player of sorted) {
    const item = document.createElement("li");
    if (player.id === myId) item.classList.add("is-you");

    const name = document.createElement("span");
    name.textContent = player.name + (player.id === myId ? " (you)" : "");

    const score = document.createElement("span");
    score.className = "score-value";
    score.textContent = player.score;

    item.appendChild(name);
    item.appendChild(score);
    list.appendChild(item);
  }
}

/**
 * renderLoop()
 *
 * WHAT IT DOES: draws the canvas every animation frame (~60 times per
 * second), using whatever the LATEST "state" message said -- not waiting
 * for a new network message to arrive first.
 *
 * WHY IT EXISTS: the network only sends a fresh "state" ~20 times per
 * second (see server/constants.js TICK_RATE), but redrawing the canvas
 * more often than that doesn't hurt and keeps things visually smooth.
 * Notice this loop does NOT invent any new positions between network
 * updates -- it just redraws the same last-known state until a new one
 * arrives. That's a direct, visible consequence of server authority:
 * nothing moves on screen without the server having said so first.
 *
 * RECEIVES: nothing. RETURNS: nothing (re-schedules itself).
 */
function renderLoop() {
  drawFrame(ctx, getLatestState(), getMyPlayerId());
  requestAnimationFrame(renderLoop);
}

// ----------------------------------------------------------------------------
// Wire up the join screen controls.
// ----------------------------------------------------------------------------
joinButton.addEventListener("click", handleJoinClick);
nameInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") handleJoinClick();
});
serverUrlInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") handleJoinClick();
});

// ----------------------------------------------------------------------------
// Wire up the debug panel's "live" checkbox.
// ----------------------------------------------------------------------------
debugToggle.addEventListener("change", () => {
  window.debugOverlay.setEnabled(debugToggle.checked);
});

// Start with an accurate "disconnected" status shown before anyone clicks
// Join.
window.debugOverlay.setConnectionStatus("disconnected");

const serverParam = new URLSearchParams(window.location.search).get("server");
if (serverParam) serverUrlInput.value = serverParam;

// ==========================================================
// WORKSHOP EXERCISE #4
// ==========================================================
// Add a new <dt>/<dd> pair to the debug panel in index.html (e.g.
// "arena size"), then set it here inside handleWelcome() using
// message.arenaWidth / message.arenaHeight. This is a good exercise for
// practicing "take a value that's already in a message you receive, and
// just display it somewhere new."
