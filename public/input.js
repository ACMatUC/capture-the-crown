// ============================================================================
// input.js  (CLIENT SIDE)
//
// WHAT THIS FILE IS:
// Listens for keyboard events and turns them into "input" network
// messages. This file is intentionally tiny and "dumb" -- it doesn't move
// anyone, doesn't know anyone's position, and doesn't touch the canvas.
// It only answers one question: "which direction does the player currently
// want to move?" and reports that to the server.
//
// WHY IT EXISTS:
// This is the clearest possible demonstration of "the client doesn't
// control the game, it only sends requests." Try this during the
// workshop: comment out the sendMessage() call in updateAndSendInput()
// and notice that pressing keys does *nothing at all* anymore, even
// though the keyboard listeners still fire. The client has zero authority
// on its own.
// ============================================================================

// Tracks which movement keys are currently held down.
const keysHeld = {
  up: false,
  down: false,
  left: false,
  right: false,
};

// The last direction we actually sent to the server. We only send a new
// "input" message when this changes, rather than on every keystroke or
// every frame.
let lastSentDirection = { dx: 0, dy: 0 };
let inputMode = "keyboard";

/**
 * startListeningForInput()
 *
 * WHAT IT DOES: attaches keydown/keyup listeners to the whole page that
 * update keysHeld, then calls updateAndSendInput() after every change.
 *
 * WHY IT EXISTS: called once from main.js after the player joins.
 * RECEIVES: nothing. RETURNS: nothing.
 */
function startListeningForInput() {
  window.addEventListener("keydown", (event) => {
    if (setKeyState(event.key, true)) {
      event.preventDefault();
      updateAndSendInput();
    }
  });

  window.addEventListener("keyup", (event) => {
    if (setKeyState(event.key, false)) {
      event.preventDefault();
      updateAndSendInput();
    }
  });
}

/**
 * setKeyState(key, isDown)
 *
 * WHAT IT DOES: maps a raw keyboard key (e.g. "ArrowUp", "w") onto one of
 * our four logical directions, and updates keysHeld accordingly.
 *
 * WHY IT EXISTS: separates "which physical key was that" from "which
 * direction does that mean," so the direction logic below doesn't need
 * to know about WASD vs arrow keys.
 *
 * RECEIVES: key (string, from KeyboardEvent.key), isDown (boolean).
 * RETURNS: true if this key mattered to us (so the caller knows whether
 *   to bother recomputing input), false otherwise.
 */
function setKeyState(key, isDown) {
  const lower = key.toLowerCase();

  if (lower === "w" || lower === "arrowup") {
    keysHeld.up = isDown;
  } else if (lower === "s" || lower === "arrowdown") {
    keysHeld.down = isDown;
  } else if (lower === "a" || lower === "arrowleft") {
    keysHeld.left = isDown;
  } else if (lower === "d" || lower === "arrowright") {
    keysHeld.right = isDown;
  } else {
    return false;
  }
  return true;
}

/**
 * updateAndSendInput()
 *
 * WHAT IT DOES: converts keysHeld into a single {dx, dy} direction.
 * Releasing all keys sends {dx: 0, dy: 0}, so the player stops.
 */
function updateAndSendInput() {
  if (inputMode !== "keyboard") return;

  let dx = 0;
  let dy = 0;

  const anyKeyHeld = keysHeld.up || keysHeld.down || keysHeld.left || keysHeld.right;

  if (anyKeyHeld) {
    dx = (keysHeld.right ? 1 : 0) - (keysHeld.left ? 1 : 0);
    dy = (keysHeld.down ? 1 : 0) - (keysHeld.up ? 1 : 0);
  }

  sendDirection(dx, dy);
}

function setInputMode(mode) {
  if (mode !== "keyboard" && mode !== "strategy") {
    throw new Error(`Unknown input mode: ${mode}`);
  }
  inputMode = mode;
  if (mode === "keyboard") {
    updateAndSendInput();
  } else {
    sendDirection(0, 0);
  }
}

function sendStrategyDirection(dx, dy) {
  if (inputMode !== "strategy") return;
  sendDirection(dx, dy);
}

function sendDirection(dx, dy) {
  if (![dx, dy].every((value) => [-1, 0, 1].includes(value))) {
    console.warn("Strategy returned an invalid direction. Stopping player.");
    dx = 0;
    dy = 0;
  }

  if (dx === lastSentDirection.dx && dy === lastSentDirection.dy) {
    return;
  }
  lastSentDirection = { dx, dy };
  sendMessage({ type: "input", dx, dy });
}