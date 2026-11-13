// ============================================================================
// main.js (CLIENT SIDE)
// Wires the interface to the networking, controls, renderer, and member strategy.
// The browser never decides a position, pickup, or score.
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
const strategyToggle = document.getElementById("strategyToggle");
const helpDialog = document.getElementById("helpDialog");
const networkDialog = document.getElementById("networkDialog");
const openNetwork = document.getElementById("openNetwork");
const standingsDialog = document.getElementById("standingsDialog");
const openStandings = document.getElementById("openStandings");
const standingsDialogBody = document.getElementById("standingsDialogBody");
const leaderboardPanel = document.querySelector(".leaderboard-panel");
const leaderboardHome = document.createComment("Desktop leaderboard position");
leaderboardPanel.before(leaderboardHome);
const mobileStandings = matchMedia("(max-width: 780px)");
const workshopTools = document.getElementById("workshopTools");
const pickupNotice = document.getElementById("pickupNotice");
const DEFAULT_WS_PORT = "3000";
let joined = false;
let connectionStatus = "disconnected";
let lastScore = null;
let scoreboardSignature = "";
let lastLocationUpdate = 0;
let pickupNoticeTimer;

function isGameDialogOpen() {
  return helpDialog.open || networkDialog.open || standingsDialog.open;
}

// Move the same live standings node; there is never a second scoreboard or
// a second set of IDs to keep synchronized on a smaller screen.
function placeStandings() {
  if (mobileStandings.matches) {
    standingsDialogBody.append(leaderboardPanel);
  } else {
    if (standingsDialog.open) standingsDialog.close();
    leaderboardHome.after(leaderboardPanel);
  }
}

function resumeAfterDialog(fallback) {
  const canPlay =
    joined && connectionStatus === "connected" && !isGameDialogOpen();
  setInputEnabled(canPlay);
  updateControlMode();
  if (isGameDialogOpen()) return;
  if (canPlay) canvas.focus({ preventScroll: true });
  else if (fallback) fallback.focus({ preventScroll: true });
}

// A clearly labeled, static illustration before joining. These are example
// players, never presented as live participants or sent to the server.
const previewState = {
  players: [
    { id: "example-1", name: "Alex", x: 155, y: 165, score: 0 },
    { id: "example-2", name: "Sam", x: 645, y: 415, score: 0 },
    { id: "example-3", name: "You", x: 220, y: 435, score: 0 },
  ],
  coins: [
    [100, 95],
    [325, 120],
    [560, 90],
    [710, 195],
    [95, 305],
    [630, 290],
    [390, 465],
    [100, 520],
    [690, 525],
    [470, 215],
  ].map(([x, y], index) => ({ id: `coin-${index + 1}`, x, y })),
};

function handleJoinClick(event) {
  if (event) event.preventDefault();
  if (joinButton.disabled || joined) return;
  const name = nameInput.value.trim();
  if (!name) {
    joinError.textContent = "Pick a player name to enter the arena.";
    nameInput.focus();
    return;
  }
  const serverUrl = normalizeServerUrl(serverUrlInput.value);
  if (!serverUrl) {
    joinError.textContent = "Enter a LAN address, like ws://192.168.1.10:3000.";
    serverUrlInput.setAttribute("aria-invalid", "true");
    serverUrlInput.focus();
    return;
  }
  if (isLocalServerUrl(serverUrl)) {
    joinError.textContent =
      "Use the server PC’s LAN IP. Localhost points to your own computer.";
    serverUrlInput.setAttribute("aria-invalid", "true");
    serverUrlInput.focus();
    return;
  }
  serverUrlInput.removeAttribute("aria-invalid");
  serverUrlInput.value = serverUrl;
  joinError.textContent = "";
  connectToServer(name.slice(0, 16), serverUrl, {
    onConnectionChange: handleConnectionChange,
    onWelcome: handleWelcome,
    onStateUpdate: handleStateUpdate,
  });
}

function normalizeServerUrl(rawValue) {
  const trimmed = rawValue.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed.includes("://") ? trimmed : `ws://${trimmed}`);
    if (url.protocol !== "ws:" || !url.hostname || url.username || url.password)
      return null;
    if (url.pathname !== "/" || url.search || url.hash) return null;
    if (!url.port) url.port = DEFAULT_WS_PORT;
    return url.toString();
  } catch (error) {
    return null;
  }
}

function isLocalServerUrl(serverUrl) {
  const hostname = new URL(serverUrl).hostname
    .toLowerCase()
    .replace(/^\[|\]$/g, "");
  return (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.startsWith("127.") ||
    hostname === "::1" ||
    hostname === "0.0.0.0" ||
    hostname === "::" ||
    hostname === "::ffff:7f00:1"
  );
}

function handleConnectionChange(status, reason = "") {
  connectionStatus = status;
  window.debugOverlay.setConnectionStatus(status);
  const labels = {
    connected: "Connected",
    connecting: "Connecting…",
    disconnected: "Not connected",
  };
  setText("connectionLabel", labels[status] || status);
  joinButton.disabled = status === "connecting" || status === "connected";
  joinButton.querySelector("span").textContent =
    status === "connecting" ? "Connecting…" : "Let me in";
  nameInput.disabled = status === "connecting";
  serverUrlInput.disabled = status === "connecting";
  if (status !== "disconnected") return;

  const wasJoined = joined;
  joined = false;
  if (standingsDialog.open) standingsDialog.close();
  document.body.classList.remove("is-playing");
  setInputEnabled(false);
  resetRenderer();
  lastScore = null;
  scoreboardSignature = "";
  clearTimeout(pickupNoticeTimer);
  pickupNotice.classList.remove("visible");
  joinScreen.classList.remove("hidden");
  gameScreen.classList.add("hidden");
  document.getElementById("previewNotice").classList.remove("hidden");
  setText("arenaState", "PREVIEW");
  setText("crownCount", "10");
  canvas.width = 800;
  canvas.height = 600;
  canvas.style.aspectRatio = "4 / 3";
  document.getElementById("locationSummary").replaceChildren();
  setText(
    "arenaCaption",
    "Arena preview with example players. Join a server for live play.",
  );
  updateControlMode();
  if (reason) joinError.textContent = reason;
  else if (wasJoined)
    joinError.textContent =
      "You left the arena. Join again whenever you’re ready. A new run starts at zero.";
  if (wasJoined && !isGameDialogOpen()) {
    nameInput.focus({ preventScroll: true });
  }
}

function handleWelcome(message) {
  joined = true;
  document.body.classList.add("is-playing");
  lastScore = null;
  scoreboardSignature = "";
  lastLocationUpdate = 0;
  joinScreen.classList.add("hidden");
  gameScreen.classList.remove("hidden");
  document.getElementById("previewNotice").classList.add("hidden");
  setText("arenaState", "LIVE");
  setText("myScore", "0");
  setText("myRank", "—");
  setText("playerName", nameInput.value.trim());
  setText("playerAvatar", nameInput.value.trim().slice(0, 1).toUpperCase());
  setText(
    "arenaCaption",
    "Live arena. You have a red ring and a YOU label. Collect gold crowns for one point each. The standings show your rank and score.",
  );
  canvas.width = message.arenaWidth;
  canvas.height = message.arenaHeight;
  canvas.style.aspectRatio = `${message.arenaWidth} / ${message.arenaHeight}`;
  resetRenderer();
  startListeningForInput();
  updateControlMode();
  if (isGameDialogOpen()) setInputEnabled(false);
  else canvas.focus({ preventScroll: true });
  // file:// clients may restrict storage. Remembering fields is optional.
  try {
    localStorage.setItem("ctc-name", nameInput.value.trim());
    localStorage.setItem("ctc-server", serverUrlInput.value);
  } catch (error) {
    /* The game works without browser storage. */
  }
}

function handleStateUpdate(state) {
  if (!joined) return;
  renderScoreboard(state.players);
  setText("crownCount", state.coins.length);
  const me = state.players.find((player) => player.id === getMyPlayerId());
  if (me) {
    setText("myScore", me.score);
    if (lastScore !== null && me.score > lastScore) {
      const gain = me.score - lastScore;
      pickupNotice.textContent = `+${gain} ${gain === 1 ? "crown" : "crowns"}`;
      pickupNotice.classList.add("visible");
      clearTimeout(pickupNoticeTimer);
      pickupNoticeTimer = setTimeout(
        () => pickupNotice.classList.remove("visible"),
        1600,
      );
    }
    lastScore = me.score;
  }
  // The lesson stays live when opened; avoid rebuilding hidden coordinates
  // and an unchanged leaderboard on every 20 Hz position update.
  if (workshopTools.open && performance.now() - lastLocationUpdate >= 150) {
    renderLocationSummary(state);
    lastLocationUpdate = performance.now();
  }
  if (strategyToggle.checked && !isGameDialogOpen())
    runStrategy(state, getMyPlayerId());
}

function renderScoreboard(players) {
  const signature = JSON.stringify(
    players.map(({ id, name, score }) => [id, name, score]),
  );
  if (signature === scoreboardSignature) return;
  scoreboardSignature = signature;
  const list = document.getElementById("scoreboard");
  const myId = getMyPlayerId();
  const sorted = [...players].sort(
    (a, b) =>
      b.score - a.score ||
      a.name.localeCompare(b.name) ||
      a.id.localeCompare(b.id),
  );
  const fragment = document.createDocumentFragment();
  let previousScore = null;
  let rank = 0;
  for (const [index, player] of sorted.entries()) {
    if (player.score !== previousScore) {
      rank = index + 1;
      previousScore = player.score;
    }
    const isMe = player.id === myId;
    const item = document.createElement("li");
    if (isMe) {
      item.className = "is-you";
      setText("myRank", `#${rank}`);
    }
    item.setAttribute(
      "aria-label",
      `Rank ${rank}, ${player.name}${isMe ? ", you" : ""}, ${player.score} points`,
    );
    const rankLabel = document.createElement("span");
    rankLabel.className = "leaderboard-rank";
    rankLabel.textContent = String(rank).padStart(2, "0");
    const avatar = document.createElement("span");
    avatar.className = "leaderboard-avatar";
    avatar.style.setProperty(
      "--player-color",
      isMe ? SELF_COLOR : colorForPlayer(player.id),
    );
    avatar.textContent = player.name.slice(0, 1).toUpperCase();
    avatar.setAttribute("aria-hidden", "true");
    const name = document.createElement("span");
    name.className = "leaderboard-name";
    name.textContent = player.name;
    const score = document.createElement("span");
    score.className = "score-value";
    score.textContent = player.score;
    item.append(rankLabel, avatar, name);
    if (isMe) {
      const you = document.createElement("span");
      you.className = "you-badge";
      you.textContent = "YOU";
      item.append(you);
    }
    item.append(score);
    fragment.append(item);
  }
  list.replaceChildren(fragment);
  setText("playerCount", players.length);
}

function renderLocationSummary(state) {
  const list = document.getElementById("locationSummary");
  const fragment = document.createDocumentFragment();
  for (const player of state.players) {
    const item = document.createElement("li");
    item.textContent = `${player.name}: (${player.x}, ${player.y})`;
    if (player.id === getMyPlayerId()) item.className = "is-you";
    fragment.append(item);
  }
  const crowns = document.createElement("li");
  crowns.className = "coin-locations";
  crowns.textContent = `Crowns: ${state.coins.map((coin) => `#${coin.id.replace("coin-", "")} (${coin.x}, ${coin.y})`).join(" · ")}`;
  fragment.append(crowns);
  list.replaceChildren(fragment);
}

function updateControlMode() {
  const automatic = strategyToggle.checked;
  setInputMode(automatic ? "strategy" : "keyboard");
  setText(
    "controlModeLabel",
    automatic ? "Strategy running" : "Keyboard / touch",
  );
  setText(
    "strategyDescription",
    automatic
      ? "strategy.js is choosing your next move."
      : "Your strategy takes over the controls.",
  );
  for (const button of document.querySelectorAll("[data-direction]"))
    button.disabled = !joined || automatic || isGameDialogOpen();
}

// One animation loop for the lifetime of the page, including reconnects.
// Cosmetic animation does not invent movement between server updates.
function renderLoop() {
  drawFrame(
    ctx,
    joined ? getLatestState() : previewState,
    joined ? getMyPlayerId() : "example-3",
  );
  requestAnimationFrame(renderLoop);
}

document.getElementById("joinForm").addEventListener("submit", handleJoinClick);
document.getElementById("leaveButton").addEventListener("click", () => {
  setInputEnabled(false);
  disconnectFromServer();
});
serverUrlInput.addEventListener("input", () => {
  serverUrlInput.removeAttribute("aria-invalid");
  joinError.textContent = "";
});
debugToggle.addEventListener("change", () => {
  window.debugOverlay.setEnabled(debugToggle.checked);
  if (debugToggle.checked) window.debugOverlay.refresh();
});
strategyToggle.addEventListener("change", () => {
  updateControlMode();
  if (joined && !isGameDialogOpen()) canvas.focus({ preventScroll: true });
  if (joined && strategyToggle.checked && !isGameDialogOpen())
    runStrategy(getLatestState(), getMyPlayerId());
});
workshopTools.addEventListener("toggle", () => {
  if (workshopTools.open) {
    window.debugOverlay.refresh();
    if (joined) renderLocationSummary(getLatestState());
  }
});
openNetwork.addEventListener("click", () => {
  setInputEnabled(false);
  workshopTools.open = true;
  networkDialog.showModal();
  updateControlMode();
  window.debugOverlay.refresh();
  if (joined) renderLocationSummary(getLatestState());
});
document.getElementById("closeNetwork").addEventListener("click", () => {
  networkDialog.close();
});
networkDialog.addEventListener("close", () => {
  workshopTools.open = false;
  resumeAfterDialog(openNetwork);
});
openStandings.addEventListener("click", () => {
  if (!joined || !mobileStandings.matches) return;
  setInputEnabled(false);
  standingsDialog.showModal();
  updateControlMode();
});
document.getElementById("closeStandings").addEventListener("click", () => {
  standingsDialog.close();
});
standingsDialog.addEventListener("close", () => {
  resumeAfterDialog(joined ? openStandings : nameInput);
});
mobileStandings.addEventListener("change", placeStandings);
placeStandings();
for (const button of document.querySelectorAll("[data-open-help]"))
  button.addEventListener("click", () => {
    setInputEnabled(false);
    helpDialog.showModal();
    updateControlMode();
  });
for (const id of ["closeHelp", "helpDone"])
  document
    .getElementById(id)
    .addEventListener("click", () => helpDialog.close());
helpDialog.addEventListener("close", () => {
  resumeAfterDialog();
});

try {
  nameInput.value = localStorage.getItem("ctc-name") || "";
  serverUrlInput.value = localStorage.getItem("ctc-server") || "";
} catch (error) {
  /* Storage is optional for file:// workshop clients. */
}
const serverParam = new URLSearchParams(window.location.search).get("server");
if (serverParam) serverUrlInput.value = serverParam;
window.debugOverlay.setConnectionStatus("disconnected");
setText("connectionLabel", "Not connected");
requestAnimationFrame(renderLoop);

// WORKSHOP EXERCISE #4: add arena dimensions to Network Debug using the
// arenaWidth and arenaHeight values received in handleWelcome().
