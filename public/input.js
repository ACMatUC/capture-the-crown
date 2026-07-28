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

// Tracks which movement keys are currently held down.[cite: 1]
const keysHeld = {
  up: false,
  down: false,
  left: false,
  right: false,
};

// The last direction we actually sent to the server. We only send a new[cite: 1]
// "input" message when this changes, rather than on every keystroke or[cite: 1]
// every frame -- see updateAndSendInput() below for why.[cite: 1]
let lastSentDirection = { dx: 0, dy: 0 };

/**
 * startListeningForInput()
 *
 * WHAT IT DOES: attaches keydown/keyup listeners to the whole page that[cite: 1]
 * update keysHeld, then calls updateAndSendInput() after every change.[cite: 1]
 *
 * WHY IT EXISTS: called once from main.js after the player joins.[cite: 1]
 * RECEIVES: nothing. RETURNS: nothing.[cite: 1]
 */
function startListeningForInput() {
  window.addEventListener("keydown", (event) => {
    if (setKeyState(event.key, true)) { //[cite: 1]
      event.preventDefault(); //[cite: 1]
      updateAndSendInput(); //[cite: 1]
    }
  });

  window.addEventListener("keyup", (event) => {
    if (setKeyState(event.key, false)) { //[cite: 1]
      event.preventDefault(); //[cite: 1]
      updateAndSendInput(); //[cite: 1]
    }
  });
}

/**
 * setKeyState(key, isDown)
 *
 * WHAT IT DOES: maps a raw keyboard key (e.g. "ArrowUp", "w") onto one of[cite: 1]
 * our four logical directions, and updates keysHeld accordingly.[cite: 1]
 *
 * WHY IT EXISTS: separates "which physical key was that" from "which[cite: 1]
 * direction does that mean," so the direction logic below doesn't need[cite: 1]
 * to know about WASD vs arrow keys.[cite: 1]
 *
 * RECEIVES: key (string, from KeyboardEvent.key), isDown (boolean).[cite: 1]
 * RETURNS: true if this key mattered to us (so the caller knows whether[cite: 1]
 *   to bother recomputing input), false otherwise.[cite: 1]
 */
function setKeyState(key, isDown) {
  const lower = key.toLowerCase(); //[cite: 1]

  if (lower === "w" || lower === "arrowup") { //[cite: 1]
    keysHeld.up = isDown; //[cite: 1]
  } else if (lower === "s" || lower === "arrowdown") { //[cite: 1]
    keysHeld.down = isDown; //[cite: 1]
  } else if (lower === "a" || lower === "arrowleft") { //[cite: 1]
    keysHeld.left = isDown; //[cite: 1]
  } else if (lower === "d" || lower === "arrowright") { //[cite: 1]
    keysHeld.right = isDown; //[cite: 1]
  } else {
    return false; //[cite: 1]
  }
  return true; //[cite: 1]
}

/**
 * updateAndSendInput()
 *
 * WHAT IT DOES: converts keysHeld into a single {dx, dy} direction.[cite: 1]
 * If no keys are held down, it automatically calculates the direction
 * towards the crown and guides the player there.[cite: 2]
 */
function updateAndSendInput() {
  let dx = 0;
  let dy = 0;

  // Check if the player is actively pressing any manual movement keys[cite: 1]
  const anyKeyHeld = keysHeld.up || keysHeld.down || keysHeld.left || keysHeld.right;

  if (anyKeyHeld) {
    // Normal keyboard input control[cite: 1]
    dx = (keysHeld.right ? 1 : 0) - (keysHeld.left ? 1 : 0); //[cite: 1]
    dy = (keysHeld.down ? 1 : 0) - (keysHeld.up ? 1 : 0); //[cite: 1]
  } else {
    // Auto-follow crown logic
    const state = getLatestState(); //[cite: 2]
    const myId = getMyPlayerId();   //[cite: 2]

    if (state && state.crown && myId) { //[cite: 2]
      // Find our own player in the active players list[cite: 2]
      const myPlayer = state.players.find(p => p.id === myId); //[cite: 2]
      
      if (myPlayer) {
        const threshold = 5; // Prevents back-and-forth jittering when overlapping the crown
        const diffX = state.crown.x - myPlayer.x; //[cite: 2]
        const diffY = state.crown.y - myPlayer.y; //[cite: 2]

        if (Math.abs(diffX) > threshold) {
          dx = diffX > 0 ? 1 : -1;
        }
        if (Math.abs(diffY) > threshold) {
          dy = diffY > 0 ? 1 : -1;
        }
      }
    }
  }

  if (dx === lastSentDirection.dx && dy === lastSentDirection.dy) { //[cite: 1]
    return; // Nothing changed -- don't waste a network message.[cite: 1]
  }
  lastSentDirection = { dx, dy }; //[cite: 1]

  sendMessage({ type: "input", dx, dy }); //[cite: 1]
}