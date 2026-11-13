// ============================================================================
// debug.js  (CLIENT SIDE)
//
// WHAT THIS FILE IS:
// Manages the "Network Debug" panel in the sidebar: connection status,
// player id, ping, message counters, and a live view of the last
// SEND/RECV JSON payloads.
//
// WHY IT EXISTS:
// The entire point of this workshop is to make an invisible thing
// (network traffic) visible. This panel is that visibility. Rather than
// asking students to open browser DevTools, we surface the exact same
// information directly on the page.
//
// This file exposes a single global `window.debugOverlay` object with a
// refresh() method. Other files (networking.js) call
// window.debugOverlay.refresh() any time something worth displaying
// happens, rather than this file polling on a timer.
// ============================================================================

const debugOverlay = {
  enabled: true,

  /**
   * refresh()
   *
   * WHAT IT DOES: reads the latest values out of networking.js (message
   * counts, last sent/received messages, ping, connection info) and
   * writes them into the debug panel's DOM elements.
   *
   * WHY IT EXISTS: called every time something network-related happens
   * (a message sent, a message received) so the panel is always current
   * without needing its own polling loop.
   *
   * RECEIVES: nothing. RETURNS: nothing.
   */
  refresh() {
    if (!this.enabled) return;
    // Build payload previews only while the workshop tools are visible.
    const tools = document.getElementById("workshopTools");
    if (tools && !tools.open) return;

    const stats = getNetStats();
    const state = getLatestState();
    const myId = getMyPlayerId();

    setText("dbgPlayerId", myId || "\u2014");
    setText("dbgPing", stats.pingMs !== null ? `${stats.pingMs} ms` : "\u2014");
    setText("dbgPlayers", state.players ? state.players.length : "\u2014");
    setText("dbgSent", stats.sent);
    setText("dbgReceived", stats.received);
    setText(
      "dbgLastSent",
      stats.lastSent ? JSON.stringify(stats.lastSent) : "\u2014",
    );
    setText(
      "dbgLastReceived",
      stats.lastReceived ? JSON.stringify(stats.lastReceived) : "\u2014",
    );

    // ==========================================================
    // WORKSHOP EXERCISE #8
    // ==========================================================
    // Try computing and displaying "average message size" here: measure
    // JSON.stringify(stats.lastReceived).length and show it in a new
    // <dt>/<dd> row (add the row to index.html first, then setText it
    // here, similar to the lines just above).
  },

  /**
   * setConnectionStatus(status)
   *
   * WHAT IT DOES: updates the small colored dot + label in the top bar
   * AND the "connection" row inside the debug panel, both driven from one
   * status string.
   *
   * RECEIVES: status ("connecting" | "connected" | "disconnected").
   * RETURNS: nothing.
   */
  setConnectionStatus(status) {
    const dot = document.getElementById("connectionDot");
    const label = document.getElementById("connectionLabel");

    dot.className = `status-dot status-${status}`;
    label.textContent = status;
    setText("dbgConnection", status);
  },

  /**
   * setEnabled(isEnabled)
   *
   * WHAT IT DOES: toggles whether the panel keeps updating, wired to the
   * "live" checkbox in the sidebar.
   * RECEIVES: isEnabled (boolean). RETURNS: nothing.
   */
  setEnabled(isEnabled) {
    this.enabled = isEnabled;
  },
};

/**
 * setText(elementId, value)
 *
 * WHAT IT DOES: tiny helper to set an element's textContent, used
 * throughout this file to avoid repeating document.getElementById(...).
 */
function setText(elementId, value) {
  const el = document.getElementById(elementId);
  if (el) el.textContent = String(value);
}

// Expose globally so networking.js can call window.debugOverlay.refresh()
// without needing to import anything (remember: no build tools here, so
// "importing" just means "hope the variable is on window").
window.debugOverlay = debugOverlay;
