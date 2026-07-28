// ============================================================================
// renderer.js  (CLIENT SIDE)
//
// WHAT THIS FILE IS:
// Draws the current game state onto the <canvas>. That's it. This file
// has no idea a WebSocket exists -- it just receives a "state" object
// (see server/protocol.js) and draws exactly what it's told.
//
// WHY IT EXISTS:
// Separating "draw what we were told" from "receive what we were told"
// (networking.js) makes the server-authoritative model visually obvious:
// this file NEVER moves anything on its own. If you stopped receiving
// "state" messages, the canvas would simply freeze -- try it by connecting
// two client PCs and killing the server terminal mid-game.
//
// A handful of named colors are used for player circles so that, with
// several players connected, everyone is easy to tell apart at a glance.
// ============================================================================

const PLAYER_COLORS = ["#ffb454", "#5fd39a", "#7aa2f7", "#f7768e", "#bb9af7", "#9ece6a"];

/**
 * colorForPlayer(id)
 *
 * WHAT IT DOES: deterministically picks a color for a player id, so the
 * same player is always drawn in the same color across frames.
 * WHY IT EXISTS: small helper used by drawPlayers() below.
 */
function colorForPlayer(id) {
  // Turn the numeric part of "player-7" into an index into PLAYER_COLORS.
  const num = parseInt(id.replace(/[^0-9]/g, ""), 10) || 0;
  return PLAYER_COLORS[num % PLAYER_COLORS.length];
}

/**
 * drawFrame(ctx, state, myPlayerId)
 *
 * WHAT IT DOES: clears the canvas and redraws EVERYTHING from scratch
 * based on the given state. This is the single entry point main.js calls
 * on every animation frame.
 *
 * WHY IT EXISTS: this "clear and redraw everything" approach (as opposed
 * to incrementally moving existing shapes) is deliberately simple -- it
 * guarantees what's on screen is always a direct, honest reflection of
 * the last "state" message received, with no leftover visual state to
 * reason about.
 *
 * RECEIVES:
 *   ctx (CanvasRenderingContext2D)
 *   state ({ players: [...], crown: {x,y} }) -- see protocol.js
 *   myPlayerId (string|null) -- used to highlight "you" on the board.
 * RETURNS: nothing.
 */
function drawFrame(ctx, state, myPlayerId) {
  const width = ctx.canvas.width;
  const height = ctx.canvas.height;

  ctx.clearRect(0, 0, width, height);
  drawGrid(ctx, width, height);

  if (state.crown) {
    drawCrown(ctx, state.crown);
  }

  for (const player of state.players) {
    drawPlayer(ctx, player, player.id === myPlayerId);
  }
}

/**
 * drawGrid(ctx, width, height)
 *
 * WHAT IT DOES: draws a faint background grid, purely so the arena has
 * some visual reference points and player movement is easy to perceive.
 * WHY IT EXISTS: cosmetic only -- no networking meaning whatsoever.
 */
function drawGrid(ctx, width, height) {
  const spacing = 40;
  ctx.strokeStyle = "rgba(255,255,255,0.04)";
  ctx.lineWidth = 1;

  for (let x = 0; x <= width; x += spacing) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  for (let y = 0; y <= height; y += spacing) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }
}

/**
 * drawPlayer(ctx, player, isMe)
 *
 * WHAT IT DOES: draws one player as a colored circle with their name
 * above it. If isMe is true, draws a thin highlight ring so you can find
 * yourself among several players.
 *
 * RECEIVES: ctx, player ({id, name, x, y, score}), isMe (boolean).
 * RETURNS: nothing.
 */
function drawPlayer(ctx, player, isMe) {
  const radius = 16;

  // ==========================================================
  // WORKSHOP EXERCISE #7
  // ==========================================================
  // The server does not send a "radius" for players -- it's a purely
  // visual/client-side number. Try making radius grow with score, e.g.
  //   const radius = 16 + player.score * 2;
  // This is a good exercise for noticing the difference between DATA
  // (score, which comes from the server) and PRESENTATION (radius, a
  // choice this file makes about how to draw that data).

  ctx.beginPath();
  ctx.arc(player.x, player.y, radius, 0, Math.PI * 2);
  ctx.fillStyle = colorForPlayer(player.id);
  ctx.fill();

  if (isMe) {
    ctx.lineWidth = 3;
    ctx.strokeStyle = "#ffffff";
    ctx.stroke();
  }

  ctx.fillStyle = "#e7ebf0";
  ctx.font = "12px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(player.name + (isMe ? " (you)" : ""), player.x, player.y - radius - 6);
}

/**
 * drawCrown(ctx, crown)
 *
 * WHAT IT DOES: draws the shared crown as a simple gold diamond.
 * RECEIVES: ctx, crown ({x, y}).
 * RETURNS: nothing.
 */
function drawCrown(ctx, crown) {
  const size = 12;

  ctx.save();
  ctx.translate(crown.x, crown.y);
  ctx.rotate(Math.PI / 4);
  ctx.fillStyle = "#f2c14e";
  ctx.fillRect(-size / 2, -size / 2, size, size);
  ctx.restore();

  // ==========================================================
  // WORKSHOP EXERCISE #3
  // ==========================================================
  // The server's "state" message currently sends { x, y } for the crown.
  // Try having the server ALSO send a "spawnedAt" timestamp (a small
  // change to server/crown.js's createCrown() and server/game.js's
  // getStateSnapshot()), then draw something here based on how long ago
  // the crown spawned -- e.g. make it pulse right after it respawns.
}
