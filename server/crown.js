// ============================================================================
// crown.js
//
// WHAT THIS FILE IS:
// Everything about the shared coins: where they start, how they respawn, and
// how we detect a player touching them.
//
// WHY IT EXISTS:
// Same reasoning as player.js -- pulling this out keeps game.js focused on
// "run the loop" rather than "also contain every detail about the coins."
// ============================================================================

const { ARENA_WIDTH, ARENA_HEIGHT, COIN_PICKUP_DISTANCE } = require("./constants");

/**
 * createCoin(id)
 *
 * WHAT IT DOES: returns a fresh coin object at a random position.
 * WHY IT EXISTS: called once at server startup, and again every time a
 *   player collects the coin (respawning it elsewhere).
 * RECEIVES: nothing.
 * RETURNS: { id, x, y } object.
 */
function createCoin(id) {
  return {
    id,
    x: Math.random() * ARENA_WIDTH,
    y: Math.random() * ARENA_HEIGHT,
  };
}

/**
 * distanceBetween(a, b)
 *
 * WHAT IT DOES: plain 2D distance formula between two {x, y} points.
 * WHY IT EXISTS: shared by the coin-collision check below. Kept as a
 *   tiny, obviously-correct helper rather than pulling in a math library.
 */
function distanceBetween(a, b) {
  const deltaX = a.x - b.x;
  const deltaY = a.y - b.y;
  return Math.sqrt(deltaX * deltaX + deltaY * deltaY);
}

/**
 * checkCoinPickups(players, coins)
 *
 * WHAT IT DOES: checks every player against every coin. Each coin that is
 * touched awards one point and respawns at a new random location.
 *
 * WHY IT EXISTS: this is the entire "game rule" of Capture the Crown, and
 * it deliberately runs ONLY on the server. Clients never decide "I touched
 * a coin" -- they just wait to see their score go up in the next
 * "state" message. This is a clean, visible example of server authority:
 * you can literally stand on top of a coin and nothing happens until
 * the server's tick loop notices and broadcasts the new state.
 *
 * WHEN IT EXECUTES: once per server tick, after all players have moved.
 *
 * RECEIVES: players (array of player objects), coins (array of coins).
 * RETURNS: the updated coins array.
 */
// ==========================================================
// WORKSHOP EXERCISE #6
// ==========================================================
// COIN_PICKUP_DISTANCE (in constants.js) controls how close a player
// must get before the server counts it as a pickup. Try making it huge
// (e.g. 300) and reloading -- you'll be able to "collect" a coin from
// across the whole arena, purely by changing one number on the server.
// This is a good demonstration that the CLIENT never decides pickup
// rules; only this server-side check does.
function checkCoinPickups(players, coins) {
  return coins.map((coin) => {
    for (const player of players) {
      if (distanceBetween(player, coin) <= COIN_PICKUP_DISTANCE) {
        player.score += 1;
        return createCoin(coin.id);
      }
    }
    return coin;
  });
}

module.exports = { createCoin, checkCoinPickups };
