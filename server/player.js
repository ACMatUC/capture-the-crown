// ============================================================================
// player.js
//
// WHAT THIS FILE IS:
// Defines what data the server keeps track of for each connected player,
// and a couple of small helper functions for creating and moving them.
//
// WHY IT EXISTS:
// Keeping "what is a player" in its own small file makes game.js (the
// tick loop) easier to read, since it can just say "move this player" and
// "clamp this player" without those details cluttering the main loop.
//
// IMPORTANT: none of this file touches the network directly. It only
// manages server-side data. Sending this data to clients is
// networking.js's job.
// ============================================================================

const { ARENA_WIDTH, ARENA_HEIGHT, PLAYER_SPEED, PLAYER_RADIUS } = require("./constants");

/**
 * createPlayer(id, name)
 *
 * WHAT IT DOES: builds a fresh player object with a random starting
 * position, zero score, and no movement input yet.
 *
 * WHY IT EXISTS: called once per player, right when their "join" message
 * is processed (see networking.js).
 *
 * RECEIVES: id (string) - unique player id assigned by the server.
 *           name (string) - display name the client typed in.
 * RETURNS: a plain player object. We use a plain object (not a class)
 *   on purpose -- it is the simplest thing that can be JSON.stringify'd
 *   directly into a "state" message.
 */
function createPlayer(id, name) {
  return {
    id,
    name,
    x: Math.random() * ARENA_WIDTH,
    y: Math.random() * ARENA_HEIGHT,
    score: 0,
    // Current movement direction, set by the most recent "input" message.
    // Not sent to clients as-is; it's just what the tick loop reads from.
    dx: 0,
    dy: 0,
  };
}

/**
 * movePlayer(player)
 *
 * WHAT IT DOES: applies one tick's worth of movement to a player, based
 * on their last known input direction (player.dx, player.dy), then keeps
 * them inside the arena boundaries.
 *
 * WHY IT EXISTS: this is the ONLY place player positions change. Because
 * it lives on the server and runs inside the authoritative tick loop
 * (game.js), the client has no way to move a player except by sending
 * "input" and waiting for the server to act on it.
 *
 * WHEN IT EXECUTES: once per player, on every server tick (~20 times per
 * second, see constants.js TICK_RATE).
 *
 * RECEIVES: a player object (mutated in place).
 * RETURNS: nothing (the player object is modified directly).
 */
function movePlayer(player) {
  player.x += player.dx * PLAYER_SPEED;
  player.y += player.dy * PLAYER_SPEED;

  // Keep the player fully inside the arena rectangle.
  player.x = Math.max(PLAYER_RADIUS, Math.min(ARENA_WIDTH - PLAYER_RADIUS, player.x));
  player.y = Math.max(PLAYER_RADIUS, Math.min(ARENA_HEIGHT - PLAYER_RADIUS, player.y));
}

module.exports = { createPlayer, movePlayer };
