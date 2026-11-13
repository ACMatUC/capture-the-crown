// ============================================================================
// input.js (CLIENT SIDE)
//
// Keyboard and touch controls only request a direction. The server still
// decides where the player moves and whether a crown was collected.
// ============================================================================

const keysHeld = { up: false, down: false, left: false, right: false };
const movementKeys = new Set();
const pointerDirections = new Map();
let lastSentDirection = { dx: 0, dy: 0 };
let inputMode = "keyboard";
let inputEnabled = false;
let listeningForInput = false;
let inputWindowFocused = true;

function directionForKey(key) {
  const directions = {
    w: "up",
    arrowup: "up",
    s: "down",
    arrowdown: "down",
    a: "left",
    arrowleft: "left",
    d: "right",
    arrowright: "right",
  };
  const lower = key.toLowerCase();
  return Object.hasOwn(directions, lower) ? directions[lower] : null;
}

function canSendInput() {
  return (
    inputEnabled && inputWindowFocused && document.visibilityState !== "hidden"
  );
}

function isEditingControl(target) {
  return (
    target &&
    target.closest &&
    target.closest(
      "input, textarea, select, [contenteditable]:not([contenteditable='false']), button:not([data-direction])",
    )
  );
}

// Attach listeners just once, including when someone reconnects.
function startListeningForInput() {
  setInputEnabled(true);
  if (listeningForInput) return;
  listeningForInput = true;

  window.addEventListener("keydown", (event) => {
    if (
      !canSendInput() ||
      inputMode !== "keyboard" ||
      isEditingControl(event.target)
    )
      return;
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (setKeyState(event.key, true)) {
      event.preventDefault();
      updateAndSendInput();
    }
  });

  window.addEventListener("keyup", (event) => {
    // Always release a held key, even if focus moved to a text field meanwhile.
    const wasHeld = movementKeys.has(event.key.toLowerCase());
    if (setKeyState(event.key, false)) {
      if (
        wasHeld &&
        canSendInput() &&
        inputMode === "keyboard" &&
        !isEditingControl(event.target)
      ) {
        event.preventDefault();
      }
      updateAndSendInput();
    }
  });

  window.addEventListener("blur", () => {
    inputWindowFocused = false;
    resetInput();
  });
  window.addEventListener("focus", () => {
    inputWindowFocused = true;
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") resetInput();
  });
  document.addEventListener("focusin", (event) => {
    if (isEditingControl(event.target)) {
      movementKeys.clear();
      updateAndSendInput();
    }
  });

  for (const button of document.querySelectorAll("[data-direction]")) {
    button.addEventListener("pointerdown", (event) => {
      if (!canSendInput() || inputMode !== "keyboard" || event.button !== 0)
        return;
      event.preventDefault();
      pointerDirections.set(event.pointerId, button.dataset.direction);
      button.setPointerCapture(event.pointerId);
      updateAndSendInput();
    });
    button.addEventListener("lostpointercapture", (event) => {
      pointerDirections.delete(event.pointerId);
      updateAndSendInput();
    });
    // Focusable buttons work with Enter/Space as well as pointer input.
    button.addEventListener("keydown", (event) => {
      if (event.key !== " " && event.key !== "Enter") return;
      if (!canSendInput() || inputMode !== "keyboard") return;
      event.preventDefault();
      pointerDirections.set(
        `button-${button.dataset.direction}`,
        button.dataset.direction,
      );
      updateAndSendInput();
    });
    button.addEventListener("keyup", (event) => {
      if (event.key !== " " && event.key !== "Enter") return;
      event.preventDefault();
      pointerDirections.delete(`button-${button.dataset.direction}`);
      updateAndSendInput();
    });
    button.addEventListener("blur", () => {
      pointerDirections.delete(`button-${button.dataset.direction}`);
      updateAndSendInput();
    });
  }

  const releasePointer = (event) => {
    if (!pointerDirections.delete(event.pointerId)) return;
    updateAndSendInput();
  };
  window.addEventListener("pointerup", releasePointer);
  window.addEventListener("pointercancel", releasePointer);
}

function setKeyState(key, isDown) {
  const lower = key.toLowerCase();
  if (!directionForKey(lower)) return false;
  if (isDown) movementKeys.add(lower);
  else movementKeys.delete(lower);
  return true;
}

function updateAndSendInput() {
  for (const direction of Object.keys(keysHeld)) keysHeld[direction] = false;
  for (const key of movementKeys) keysHeld[directionForKey(key)] = true;
  for (const direction of pointerDirections.values()) {
    if (Object.hasOwn(keysHeld, direction)) keysHeld[direction] = true;
  }
  for (const button of document.querySelectorAll("[data-direction]")) {
    const pressed = keysHeld[button.dataset.direction];
    button.classList.toggle("is-pressed", pressed);
    button.setAttribute("aria-pressed", String(pressed));
  }
  if (inputMode !== "keyboard" || !canSendInput()) return;
  sendDirection(
    Number(keysHeld.right) - Number(keysHeld.left),
    Number(keysHeld.down) - Number(keysHeld.up),
  );
}

// Main calls this when disconnecting/rejoining so old held keys cannot leak
// into a new game. It can also pause all movement while a dialog is open.
function setInputEnabled(enabled) {
  inputEnabled = Boolean(enabled);
  resetInput();
}

function resetInput() {
  movementKeys.clear();
  pointerDirections.clear();
  updateAndSendInput();
  sendDirection(0, 0);
}

function setInputMode(mode) {
  if (mode !== "keyboard" && mode !== "strategy") {
    throw new Error(`Unknown input mode: ${mode}`);
  }
  inputMode = mode;
  resetInput();
}

function sendStrategyDirection(dx, dy) {
  if (inputMode !== "strategy" || !canSendInput()) return;
  sendDirection(dx, dy);
}

function sendDirection(dx, dy) {
  if (![dx, dy].every((value) => [-1, 0, 1].includes(value))) {
    console.warn("Strategy returned an invalid direction. Stopping player.");
    dx = 0;
    dy = 0;
  }
  if (dx === lastSentDirection.dx && dy === lastSentDirection.dy) return;
  lastSentDirection = { dx, dy };
  sendMessage({ type: "input", dx, dy });
}
