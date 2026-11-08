// ============================================================================
// constants.js
//
// WHAT THIS FILE IS:
// A single place to tune the "physics" (very simple, non-physics) numbers
// and networking timing for the whole server. Nothing in here talks to the
// network directly -- it just defines shared numbers so the rest of the
// server code doesn't have magic numbers scattered everywhere.
//
// WHY IT EXISTS:
// When you (the student) want to experiment -- e.g. "what happens if the
// server only updates 2 times per second instead of 20?" -- this is the
// one file you need to touch.
// ============================================================================

module.exports = {
  // How many times per second the server recalculates the game state and
  // sends a fresh "state" message to every connected client.
  //
  // This is the single most important networking number in the whole
  // project. Lower it and you will SEE the multiplayer experience become
  // jumpy/laggy, because clients only find out about the world 5 times a
  // second instead of 20.
  //
  // ==========================================================
  // WORKSHOP EXERCISE #5
  // ==========================================================
  // Try changing this to something dramatic like 2 (2 updates per
  // second) or 1, restart the server, and reconnect two client PCs.
  // Movement will look jumpy/laggy even on a quiet LAN -- purely because
  // clients are hearing about the world less often. Put it back to 20
  // when you're done.
  TICK_RATE: 20,

  // Size of the shared arena in pixels. The server uses this to keep
  // players and the coins inside the playable area. The client uses the
  // same numbers to size its <canvas>.
  ARENA_WIDTH: 800,
  ARENA_HEIGHT: 600,

  // How many pixels a player moves per tick when holding a direction key.
  // This lives on the SERVER because the server is authoritative -- the
  // client is not trusted to decide how fast it can move.
  PLAYER_SPEED: 4,

  // Radius (in pixels) used for both drawing players and detecting whether
  // a player has touched a coin. Kept simple on purpose: no real
  // physics engine, just "distance between two circle centers."
  PLAYER_RADIUS: 16,
  COIN_COUNT: 10,
  COIN_RADIUS: 12,

  // How far apart (in pixels) a player's center and a coin's center can
  // be before we count it as "touching" the coin.
  COIN_PICKUP_DISTANCE: 16 + 12, // PLAYER_RADIUS + COIN_RADIUS

  // How often (milliseconds) the server pings clients to measure latency.
  // This powers the "ping" number in the debug overlay.
  PING_INTERVAL_MS: 2000,
};
