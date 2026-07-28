// ============================================================================
// game.js
//
// WHAT THIS FILE IS:
// The heart of server authority. It holds the ONE true copy of the game
// world (every player, the crown) and runs a fixed-rate loop that updates
// that world and hands a fresh snapshot to networking.js to broadcast.
//
// WHY IT EXISTS:
// In a client-server multiplayer game, there must be exactly one place
// that is allowed to say "this is what's really happening right now."
// This file is that place. No other file mutates player positions or
// scores except through the functions defined here (and player.js /
// crown.js, which this file calls).
//
// WHEN IT EXECUTES:
// startGameLoop() is called once, at server startup (see server.js). From
// then on, the loop ticks itself on a timer -- nothing else needs to call
// into this file except when a player joins, leaves, or sends input.
// ============================================================================

const { TICK_RATE } = require("./constants");
const { createPlayer, movePlayer } = require("./player");
const { createCrown, checkCrownPickup } = require("./crown");

// ----------------------------------------------------------------------------
// THE AUTHORITATIVE STATE
//
// `players` is a Map from player id -> player object (see player.js).
// `crown`   is the single shared crown object (see crown.js).
//
// These two variables are the entire game world. Everything the server
// sends to clients in a "state" message is derived directly from them.
// ----------------------------------------------------------------------------
const players = new Map();
let crown = createCrown();

// Simple incrementing counter used to hand out unique, readable player ids
// like "player-1", "player-2", etc.
let nextPlayerId = 1;

/**
 * addPlayer(name)
 *
 * WHAT IT DOES: creates a new player and adds them to the world.
 * WHY IT EXISTS: called by networking.js when a "join" message arrives.
 * RECEIVES: name (string) typed by the student in the browser.
 * RETURNS: the newly created player object (so networking.js can send
 *   back a "welcome" message containing their id).
 */
function addPlayer(name) {
  const id = `player-${nextPlayerId}`;
  nextPlayerId += 1;

  const player = createPlayer(id, name);
  players.set(id, player);
  return player;
}

/**
 * removePlayer(id)
 *
 * WHAT IT DOES: removes a player from the world, typically because their
 * WebSocket connection closed.
 * WHY IT EXISTS: called by networking.js on socket "close".
 * RECEIVES: id (string).
 * RETURNS: nothing.
 */
function removePlayer(id) {
  players.delete(id);
}

/**
 * setPlayerInput(id, dx, dy)
 *
 * WHAT IT DOES: records the latest movement direction a player wants to
 * move in. It does NOT move them immediately -- that only happens inside
 * the tick loop below (tickOnce). This separation is intentional: it
 * means player movement always happens at a predictable, fixed rate,
 * regardless of how often a client happens to send "input" messages.
 *
 * WHY IT EXISTS: called by networking.js every time an "input" message
 * arrives from a client.
 *
 * RECEIVES: id (string), dx/dy (each -1, 0, or 1).
 * RETURNS: nothing.
 */
function setPlayerInput(id, dx, dy) {
  const player = players.get(id);
  if (!player) return;
  player.dx = dx;
  player.dy = dy;
}

/**
 * tickOnce()
 *
 * WHAT IT DOES: advances the game world by exactly one tick:
 *   1. Moves every player according to their last input.
 *   2. Checks whether any player has picked up the crown.
 *
 * WHY IT EXISTS: this is THE authoritative update step. It is the only
 * function in the whole project that changes player positions or scores.
 *
 * WHEN IT EXECUTES: called automatically, TICK_RATE times per second, by
 * startGameLoop() below.
 *
 * RECEIVES: nothing (reads/writes the module-level `players` and `crown`).
 * RETURNS: nothing.
 */
function tickOnce() {
  for (const player of players.values()) {
    movePlayer(player);
  }
  crown = checkCrownPickup(Array.from(players.values()), crown);
}

/**
 * getStateSnapshot()
 *
 * WHAT IT DOES: builds a plain JS object containing exactly the data that
 * belongs in a "state" network message -- no more, no less. Notably, it
 * strips out fields like `dx`/`dy` that are server-internal bookkeeping
 * and don't need to be sent over the network.
 *
 * WHY IT EXISTS: called by networking.js on every tick, right before
 * broadcasting. Kept separate from tickOnce() so "updating the world" and
 * "describing the world for the network" are two clearly distinct steps.
 *
 * RECEIVES: nothing.
 * RETURNS: { players: [...], crown: {...} } -- see protocol.js "state".
 */
function getStateSnapshot() {
  return {
    type: "state",
    players: Array.from(players.values()).map((p) => ({
      id: p.id,
      name: p.name,
      x: Math.round(p.x),
      y: Math.round(p.y),
      score: p.score,
    })),
    crown: { x: Math.round(crown.x), y: Math.round(crown.y) },
  };
}

// ==========================================================
// WORKSHOP EXERCISE #10 (add a new property to a JSON message)
// ==========================================================
// Add a new field to each player in the snapshot above, e.g. a
// "joinedAt" timestamp captured in player.js's createPlayer(). Once it's
// in the "state" message, open your browser DevTools console (networking
// DEBUG is on) and confirm you can see it arrive in a [RECV] log -- then
// try displaying it somewhere in the client, e.g. next to a player's name
// in main.js's renderScoreboard().

/**
 * startGameLoop(onTick)
 *
 * WHAT IT DOES: starts a setInterval-based loop that calls tickOnce() and
 * then hands the caller a fresh state snapshot, TICK_RATE times per
 * second.
 *
 * WHY IT EXISTS: this is the piece of code that makes the whole project
 * "real-time." Compare this to a typical web page, which only updates
 * when the user clicks something -- here, the server proactively pushes
 * new information out on a fixed schedule, whether or not anything
 * "interesting" happened.
 *
 * WHEN IT EXECUTES: called exactly once, from server.js, at startup.
 *
 * RECEIVES: onTick, a callback function that will be called with the
 *   result of getStateSnapshot() every tick. server.js/networking.js
 *   passes in a function that broadcasts this snapshot to every client.
 * RETURNS: nothing.
 */
function startGameLoop(onTick) {
  const intervalMs = 1000 / TICK_RATE;
  setInterval(() => {
    tickOnce();
    onTick(getStateSnapshot());
  }, intervalMs);
}

module.exports = {
  addPlayer,
  removePlayer,
  setPlayerInput,
  startGameLoop,
  getStateSnapshot,
};
