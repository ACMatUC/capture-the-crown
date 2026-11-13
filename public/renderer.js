// ============================================================================
// renderer.js (CLIENT SIDE)
//
// Draws the server's latest snapshot. Positions, pickups, and scores are still
// decided exclusively by the server; paper, ink, and confetti are presentation.
// Keep this file independent of WebSockets so workshop members can customize it.
// ============================================================================

const PLAYER_COLORS = [
  "#8eabd1",
  "#c5a1c9",
  "#96b294",
  "#e2a37f",
  "#d6bd6b",
  "#a5a5c9",
];
const SELF_COLOR = "#c32f28";
const ARENA_INK = "#171715";
const ARENA_PAPER = "#f7f4eb";
let lastRenderedState = null;
let previousScores = new Map();
let pickupEffects = [];

function colorForPlayer(id) {
  const num = parseInt(id.replace(/[^0-9]/g, ""), 10) || 0;
  return PLAYER_COLORS[num % PLAYER_COLORS.length];
}

// Call on a new connection so a previous session cannot create pickup effects.
function resetRenderer() {
  lastRenderedState = null;
  previousScores.clear();
  pickupEffects = [];
}

/** Redraw the arena from the latest authoritative state, without prediction. */
function drawFrame(ctx, state, myPlayerId) {
  const width = ctx.canvas.width;
  const height = ctx.canvas.height;
  const displayScale = canvasDisplayScale(ctx.canvas);
  const now = performance.now();
  const reducedMotion =
    typeof matchMedia === "function" &&
    matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Only a confirmed score increase can trigger a celebration.
  if (state !== lastRenderedState) {
    for (const player of state.players || []) {
      const previous = previousScores.get(player.id);
      if (previous !== undefined && player.score > previous && !reducedMotion) {
        pickupEffects.push({
          x: player.x,
          y: player.y,
          amount: player.score - previous,
          at: now,
          mine: player.id === myPlayerId,
        });
      }
    }
    previousScores = new Map(
      (state.players || []).map((player) => [player.id, player.score]),
    );
    lastRenderedState = state;
    pickupEffects = pickupEffects.slice(-24);
  }

  ctx.clearRect(0, 0, width, height);
  drawGrid(ctx, width, height);
  for (const coin of state.coins || []) drawCoin(ctx, coin);

  // Draw your player last so you remain easy to locate in a crowded arena.
  for (const player of state.players || []) {
    if (player.id !== myPlayerId) drawPlayer(ctx, player, false, displayScale);
  }
  const me = (state.players || []).find((player) => player.id === myPlayerId);
  if (me) drawPlayer(ctx, me, true, displayScale);

  pickupEffects = pickupEffects.filter((effect) => now - effect.at < 750);
  if (!reducedMotion)
    for (const effect of pickupEffects) drawPickupEffect(ctx, effect, now);
}

/** Graph paper and a few ruled lines make this a little club playground. */
function drawGrid(ctx, width, height) {
  ctx.fillStyle = ARENA_PAPER;
  ctx.fillRect(0, 0, width, height);

  ctx.save();
  ctx.lineWidth = 1;
  ctx.strokeStyle = "rgba(56, 68, 64, 0.09)";
  ctx.beginPath();
  for (let x = 0.5; x <= width; x += 40) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
  }
  for (let y = 0.5; y <= height; y += 40) {
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
  }
  ctx.stroke();

  ctx.strokeStyle = "rgba(23, 23, 21, 0.22)";
  roundedPath(ctx, 12, 12, width - 24, height - 24, 2);
  ctx.stroke();
  ctx.setLineDash([5, 10]);
  ctx.beginPath();
  ctx.moveTo(width / 2, 12);
  ctx.lineTo(width / 2, height - 12);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.arc(width / 2, height / 2, 72, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(width / 2, height / 2, 4, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(195, 47, 40, 0.2)";
  ctx.fill();

  // Registration marks echo a printed game sheet, rather than physical walls.
  ctx.strokeStyle = SELF_COLOR;
  ctx.lineWidth = 2;
  for (const [x, y, dx, dy] of [
    [12, 12, 1, 1],
    [width - 12, 12, -1, 1],
    [12, height - 12, 1, -1],
    [width - 12, height - 12, -1, -1],
  ]) {
    ctx.beginPath();
    ctx.moveTo(x, y + dy * 17);
    ctx.lineTo(x, y);
    ctx.lineTo(x + dx * 17, y);
    ctx.stroke();
  }
  ctx.restore();
}

function canvasDisplayScale(canvas) {
  const rect = canvas.getBoundingClientRect?.();
  const width = rect?.width || canvas.clientWidth || canvas.width;
  const height = rect?.height || canvas.clientHeight || canvas.height;
  return Math.max(
    0.35,
    Math.min(1, width / canvas.width, height / canvas.height),
  );
}

function drawPlayer(
  ctx,
  player,
  isMe,
  displayScale = canvasDisplayScale(ctx.canvas),
) {
  // WORKSHOP EXERCISE #7: try changing this visual radius using player.score.
  // The server's collision radius remains unchanged: data and display differ.
  const radius = 16;
  const color = isMe ? SELF_COLOR : colorForPlayer(player.id);
  ctx.save();

  if (isMe) {
    ctx.beginPath();
    ctx.arc(player.x, player.y, radius + 6, 0, Math.PI * 2);
    ctx.strokeStyle = SELF_COLOR;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([3, 3]);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  ctx.beginPath();
  ctx.arc(player.x, player.y, radius, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = ARENA_INK;
  ctx.stroke();

  ctx.fillStyle = isMe ? ARENA_PAPER : ARENA_INK;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = '800 12px "DM Sans", sans-serif';
  ctx.fillText(
    (player.name || "?").slice(0, 1).toUpperCase(),
    player.x,
    player.y + 1,
  );

  // Size only the labels for the displayed canvas: game coordinates and player
  // radii remain authoritative, while names stay legible on a small screen.
  const label =
    isMe && player.name.toLowerCase() === "you"
      ? "YOU"
      : player.name + (isMe ? " · YOU" : "");
  const fontSize = Math.max(11, 9 / displayScale);
  const labelPadding = Math.max(16, 8 / displayScale);
  const labelHeight = Math.max(20, 18 / displayScale);
  const edgePadding = Math.max(6, 3 / displayScale);
  ctx.font = `${isMe ? "800" : "600"} ${fontSize}px "DM Sans", sans-serif`;
  const labelWidth = Math.min(
    ctx.measureText(label).width + labelPadding,
    ctx.canvas.width - edgePadding * 2,
  );
  const labelX = Math.max(
    edgePadding + labelWidth / 2,
    Math.min(ctx.canvas.width - edgePadding - labelWidth / 2, player.x),
  );
  const labelOffset = radius + 7 / displayScale + labelHeight / 2;
  const desiredY =
    player.y < labelOffset + labelHeight / 2 + edgePadding
      ? player.y + labelOffset
      : player.y - labelOffset;
  const labelY = Math.max(
    labelHeight / 2 + edgePadding,
    Math.min(ctx.canvas.height - labelHeight / 2 - edgePadding, desiredY),
  );
  ctx.fillStyle = isMe ? SELF_COLOR : ARENA_PAPER;
  roundedPath(
    ctx,
    labelX - labelWidth / 2,
    labelY - labelHeight / 2,
    labelWidth,
    labelHeight,
    2 / displayScale,
  );
  ctx.fill();
  if (!isMe) {
    ctx.lineWidth = 1;
    ctx.strokeStyle = "rgba(23,23,21,0.2)";
    ctx.stroke();
  }
  ctx.fillStyle = isMe ? ARENA_PAPER : ARENA_INK;
  ctx.fillText(label, labelX, labelY + 0.5, labelWidth - labelPadding);
  ctx.restore();
}

/** Each coin in the protocol is presented as a small collectible crown. */
function drawCoin(ctx, coin) {
  ctx.save();
  ctx.translate(coin.x, coin.y);

  // WORKSHOP EXERCISE #3: customize this crown's shape or color.
  ctx.beginPath();
  ctx.moveTo(-10, -6);
  ctx.lineTo(-5, -1);
  ctx.lineTo(0, -9);
  ctx.lineTo(5, -1);
  ctx.lineTo(10, -6);
  ctx.lineTo(7, 7);
  ctx.lineTo(-7, 7);
  ctx.closePath();
  ctx.fillStyle = "#efb827";
  ctx.fill();
  ctx.strokeStyle = ARENA_INK;
  ctx.lineWidth = 1.8;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-6, 4);
  ctx.lineTo(6, 4);
  ctx.strokeStyle = ARENA_INK;
  ctx.stroke();

  // One little ink sparkle makes a crown read as a prize at phone size too.
  ctx.beginPath();
  ctx.moveTo(13, -13);
  ctx.lineTo(13, -7);
  ctx.moveTo(10, -10);
  ctx.lineTo(16, -10);
  ctx.lineWidth = 1.3;
  ctx.stroke();
  ctx.restore();
}

function drawPickupEffect(ctx, effect, now) {
  const progress = (now - effect.at) / 750;
  ctx.save();
  ctx.globalAlpha = 1 - progress;
  ctx.strokeStyle = effect.mine ? SELF_COLOR : "#aa7500";
  ctx.lineWidth = 2.5 * (1 - progress);
  ctx.beginPath();
  ctx.arc(effect.x, effect.y, 20 + progress * 30, 0, Math.PI * 2);
  ctx.stroke();
  for (let index = 0; index < 6; index++) {
    const angle = (index * Math.PI) / 3;
    const distance = 18 + progress * 34;
    ctx.fillStyle = [SELF_COLOR, "#efb827", ARENA_INK][index % 3];
    ctx.fillRect(
      effect.x + Math.cos(angle) * distance - 1.5,
      effect.y + Math.sin(angle) * distance - 1.5,
      3,
      3,
    );
  }
  ctx.fillStyle = SELF_COLOR;
  ctx.font = '800 16px "DM Sans", sans-serif';
  ctx.textAlign = "center";
  const x = Math.max(20, Math.min(ctx.canvas.width - 20, effect.x));
  const y = Math.max(20, effect.y - 25 - progress * 25);
  ctx.fillText(`+${effect.amount}`, x, y);
  ctx.restore();
}

function roundedPath(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
}
