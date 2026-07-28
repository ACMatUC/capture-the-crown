// ============================================================================
// crown.js
//
// WHAT THIS FILE IS:
// Everything about the one shared crown object: where it starts, how it
// respawns, and how we detect a player touching it.
//
// WHY IT EXISTS:
// Same reasoning as player.js -- pulling this out keeps game.js focused on
// "run the loop" rather than "also contain every detail about the crown."
// ============================================================================

const { ARENA_WIDTH, ARENA_HEIGHT, CROWN_PICKUP_DISTANCE } = require("./constants");

/**
 * createCrown()
 *
 * WHAT IT DOES: returns a fresh crown object at a random position.
 * WHY IT EXISTS: called once at server startup, and again every time a
 *   player collects the crown (respawning it elsewhere).
 * RECEIVES: nothing.
 * RETURNS: { x, y } object.
 */
function createCrown() {
  return {
    x: Math.random() * ARENA_WIDTH,
    y: Math.random() * ARENA_HEIGHT,
  };
}

/**
 * distanceBetween(a, b)
 *
 * WHAT IT DOES: plain 2D distance formula between two {x, y} points.
 * WHY IT EXISTS: shared by the crown-collision check below. Kept as a
 *   tiny, obviously-correct helper rather than pulling in a math library.
 */
function distanceBetween(a, b) {
  const deltaX = a.x - b.x;
  const deltaY = a.y - b.y;
  return Math.sqrt(deltaX * deltaX + deltaY * deltaY);
}

/**
 * checkCrownPickup(players, crown)
 *
 * WHAT IT DOES: checks every player against the crown's position. If any
 * player is close enough to "touch" it, that player's score goes up by 1
 * and the crown respawns at a new random location.
 *
 * WHY IT EXISTS: this is the entire "game rule" of Capture the Crown, and
 * it deliberately runs ONLY on the server. Clients never decide "I touched
 * the crown" -- they just wait to see their score go up in the next
 * "state" message. This is a clean, visible example of server authority:
 * you can literally stand on top of the crown and nothing happens until
 * the server's tick loop notices and broadcasts the new state.
 *
 * WHEN IT EXECUTES: once per server tick, after all players have moved.
 *
 * RECEIVES: players (array of player objects), crown ({x, y}).
 * RETURNS: the crown object (same one passed in, or a freshly respawned
 *   replacement -- callers should always use the return value).
 */
// ==========================================================
// WORKSHOP EXERCISE #6
// ==========================================================
// CROWN_PICKUP_DISTANCE (in constants.js) controls how close a player
// must get before the server counts it as a pickup. Try making it huge
// (e.g. 300) and reloading -- you'll be able to "collect" the crown from
// across the whole arena, purely by changing one number on the server.
// This is a good demonstration that the CLIENT never decides pickup
// rules; only this server-side check does.
function checkCrownPickup(players, crown) {
  for (const player of players) {
    if (distanceBetween(player, crown) <= CROWN_PICKUP_DISTANCE) {
      player.score += 1;
      return createCrown();
    }
  }
  return crown;
}

module.exports = { createCrown, checkCrownPickup };
