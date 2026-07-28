// ============================================================================
// protocol.js  (SERVER SIDE)
//
// WHAT THIS FILE IS:
// The single source of truth for every JSON message that can travel over
// our WebSocket connection, in EITHER direction. Think of this as the
// "contract" between client and server.
//
// WHY IT EXISTS:
// In a real networked application, client and server are often written by
// different people (or even different companies!). They can only work
// together if they agree ahead of time on exactly what the messages look
// like. This file is that agreement, written down as code and comments.
//
// A matching, client-side copy of this documentation lives in
// public/networking.js so students can compare "what the server expects"
// with "what the client actually sends."
//
// MESSAGE DIRECTION KEY:
//   [C -> S]  Client sends this to the Server
//   [S -> C]  Server sends this to a Client
// ============================================================================

// ----------------------------------------------------------------------------
// [C -> S] "join"
//
// Sent ONCE, immediately after the WebSocket connection opens. It tells the
// server "a human wants to play, and here is the name they typed in."
//
// Shape:
// {
//   "type": "join",
//   "name": "Alice"
// }
// ----------------------------------------------------------------------------

// ----------------------------------------------------------------------------
// [C -> S] "input"
//
// Sent every time the player's movement direction changes (e.g. a key is
// pressed or released). This is the ONLY way a client can influence the
// game world -- it never sends a new position, only "which way am I trying
// to move right now."
//
// dx and dy are each one of -1, 0, or 1 (a simple direction, not a real
// physics vector). The SERVER decides how far that translates to in
// pixels -- see constants.js PLAYER_SPEED.
//
// Shape:
// {
//   "type": "input",
//   "dx": 1,
//   "dy": 0
// }
// ----------------------------------------------------------------------------

// ----------------------------------------------------------------------------
// [S -> C] "welcome"
//
// Sent ONCE, immediately after the server accepts a client's "join"
// message. It tells the new client its own player ID, which it needs so it
// can pick itself out of the player list inside future "state" messages.
//
// Shape:
// {
//   "type": "welcome",
//   "id": "player-3",
//   "arenaWidth": 800,
//   "arenaHeight": 600
// }
// ----------------------------------------------------------------------------

// ----------------------------------------------------------------------------
// [S -> C] "state"
//
// THE most important message in this entire project. Broadcast to every
// connected client on every server tick (see constants.js TICK_RATE). It
// contains the full, authoritative snapshot of the entire game world:
// every player's position, name and score, plus the crown's position.
//
// The client does nothing clever with this -- it just throws away
// whatever it drew last frame and redraws using these exact numbers. This
// is what "server-authoritative" means in practice: the client has no
// opinion of its own about where anything is.
//
// Shape:
// {
//   "type": "state",
//   "players": [
//     { "id": "player-1", "name": "Alice", "x": 120, "y": 340, "score": 2 },
//     { "id": "player-2", "name": "Bob",   "x": 500, "y": 220, "score": 0 }
//   ],
//   "crown": { "x": 400, "y": 300 }
// }
// ----------------------------------------------------------------------------

// ----------------------------------------------------------------------------
// [S -> C] "playerJoined"
//
// Broadcast to all OTHER clients when a new player finishes joining. Purely
// informational -- the next "state" message would tell them anyway, but
// this lets us show a distinct log entry / event, which is useful for
// demonstrating that "join" and "state" are separate, independent
// messages.
//
// Shape:
// {
//   "type": "playerJoined",
//   "id": "player-3",
//   "name": "Charlie"
// }
// ----------------------------------------------------------------------------

// ----------------------------------------------------------------------------
// [S -> C] "playerLeft"
//
// Broadcast to all remaining clients when a player disconnects (closes the
// tab, loses connection, etc). Lets the UI show "Bob left" without waiting
// for the player to simply vanish from the next "state" message.
//
// Shape:
// {
//   "type": "playerLeft",
//   "id": "player-2",
//   "name": "Bob"
// }
// ----------------------------------------------------------------------------

// ----------------------------------------------------------------------------
// [S -> C] "ping"   /   [C -> S] "pong"
//
// A tiny back-and-forth used ONLY to measure latency for the debug
// overlay. The server sends "ping" with a timestamp; the client echoes it
// straight back inside "pong"; the server compares "now" to that
// timestamp to compute round-trip time in milliseconds.
//
// Shape (ping, S -> C):
// {
//   "type": "ping",
//   "sentAt": 1719872345123
// }
//
// Shape (pong, C -> S):
// {
//   "type": "pong",
//   "sentAt": 1719872345123
// }
// ----------------------------------------------------------------------------

// A list of every valid "type" value, used for simple validation below.
const VALID_TYPES = [
  "join",
  "input",
  "welcome",
  "state",
  "playerJoined",
  "playerLeft",
  "ping",
  "pong",
];

/**
 * isValidMessage(msg)
 *
 * WHAT IT DOES:
 * Performs very lightweight validation on a message that was just
 * JSON.parse()'d from the network. Real-world protocols often use schema
 * validation libraries; we keep it intentionally simple and readable here.
 *
 * WHY IT EXISTS:
 * Network input should never be trusted. A malformed or malicious message
 * (or just a student's typo while doing an exercise!) should not crash the
 * server. This function is the server's first line of defense.
 *
 * WHEN IT EXECUTES:
 * Called by server/networking.js immediately after parsing every incoming
 * message, before any game logic touches it.
 *
 * RECEIVES: a parsed JS object (or possibly not-an-object, if the JSON was
 *   valid but weird, e.g. just the number 5).
 * RETURNS: true/false.
 */
function isValidMessage(msg) {
  if (typeof msg !== "object" || msg === null) return false;
  if (!VALID_TYPES.includes(msg.type)) return false;

  if (msg.type === "join") {
    return typeof msg.name === "string" && msg.name.trim().length > 0;
  }

  if (msg.type === "input") {
    return (
      [-1, 0, 1].includes(msg.dx) && [-1, 0, 1].includes(msg.dy)
    );
  }

  if (msg.type === "pong") {
    return typeof msg.sentAt === "number";
  }

  // welcome / state / playerJoined / playerLeft / ping are server-authored
  // and not expected to arrive FROM a client, but we don't need to be
  // stricter than this for a teaching project.
  return true;
}

module.exports = { VALID_TYPES, isValidMessage };
