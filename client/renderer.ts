import type { CoinSnapshot, GameState, PlayerSnapshot } from "../shared/protocol.js";

const PLAYER_COLORS = [
  "#8eabd1",
  "#c5a1c9",
  "#96b294",
  "#e2a37f",
  "#d6bd6b",
  "#a5a5c9",
] as const;

export const SELF_COLOR = "#c32f28";
const ARENA_INK = "#171715";
const ARENA_PAPER = "#f7f4eb";
const EFFECT_DURATION_MS = 750;

interface PickupEffect {
  readonly x: number;
  readonly y: number;
  readonly amount: number;
  readonly at: number;
  readonly mine: boolean;
}

export interface Renderer {
  draw(
    context: CanvasRenderingContext2D,
    state: GameState,
    myPlayerId: string | null,
  ): void;
  reset(): void;
}

export function colorForPlayer(id: string): string {
  const number = Number.parseInt(id.replace(/[^0-9]/g, ""), 10) || 0;
  return PLAYER_COLORS[number % PLAYER_COLORS.length] ?? PLAYER_COLORS[0];
}

// Effects belong to a mounted arena, so reconnects and separate clients cannot
// compare scores against a previous session's rendering history.
export function createRenderer(): Renderer {
  let lastRenderedState: GameState | null = null;
  let previousScores = new Map<string, number>();
  let pickupEffects: PickupEffect[] = [];

  return {
    reset() {
      lastRenderedState = null;
      previousScores.clear();
      pickupEffects = [];
    },

    draw(context, state, myPlayerId) {
      const { width, height } = context.canvas;
      const displayScale = canvasDisplayScale(context.canvas);
      const now = performance.now();
      const reducedMotion =
        typeof matchMedia === "function" &&
        matchMedia("(prefers-reduced-motion: reduce)").matches;

      if (state !== lastRenderedState) {
        for (const player of state.players) {
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
          state.players.map((player) => [player.id, player.score]),
        );
        lastRenderedState = state;
        pickupEffects = pickupEffects.slice(-24);
      }

      context.clearRect(0, 0, width, height);
      drawGrid(context, width, height);
      for (const coin of state.coins) drawCoin(context, coin);

      // Drawing yourself last keeps the local token visible in a crowd.
      for (const player of state.players) {
        if (player.id !== myPlayerId) {
          drawPlayer(context, player, false, displayScale);
        }
      }
      const me = state.players.find((player) => player.id === myPlayerId);
      if (me) drawPlayer(context, me, true, displayScale);

      pickupEffects = pickupEffects.filter(
        (effect) => now - effect.at < EFFECT_DURATION_MS,
      );
      if (!reducedMotion) {
        for (const effect of pickupEffects) {
          drawPickupEffect(context, effect, now);
        }
      }
    },
  };
}

function drawGrid(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
): void {
  context.fillStyle = ARENA_PAPER;
  context.fillRect(0, 0, width, height);

  context.save();
  context.lineWidth = 1;
  context.strokeStyle = "rgba(56, 68, 64, 0.09)";
  context.beginPath();
  for (let x = 0.5; x <= width; x += 40) {
    context.moveTo(x, 0);
    context.lineTo(x, height);
  }
  for (let y = 0.5; y <= height; y += 40) {
    context.moveTo(0, y);
    context.lineTo(width, y);
  }
  context.stroke();

  context.strokeStyle = "rgba(23, 23, 21, 0.22)";
  roundedPath(context, 12, 12, width - 24, height - 24, 2);
  context.stroke();
  context.setLineDash([5, 10]);
  context.beginPath();
  context.moveTo(width / 2, 12);
  context.lineTo(width / 2, height - 12);
  context.stroke();
  context.setLineDash([]);
  context.beginPath();
  context.arc(width / 2, height / 2, 72, 0, Math.PI * 2);
  context.stroke();
  context.beginPath();
  context.arc(width / 2, height / 2, 4, 0, Math.PI * 2);
  context.fillStyle = "rgba(195, 47, 40, 0.2)";
  context.fill();

  context.strokeStyle = SELF_COLOR;
  context.lineWidth = 2;
  const corners: readonly (readonly [number, number, number, number])[] = [
    [12, 12, 1, 1],
    [width - 12, 12, -1, 1],
    [12, height - 12, 1, -1],
    [width - 12, height - 12, -1, -1],
  ];
  for (const [x, y, dx, dy] of corners) {
    context.beginPath();
    context.moveTo(x, y + dy * 17);
    context.lineTo(x, y);
    context.lineTo(x + dx * 17, y);
    context.stroke();
  }
  context.restore();
}

function canvasDisplayScale(canvas: HTMLCanvasElement): number {
  const rectangle = canvas.getBoundingClientRect();
  const width = rectangle.width || canvas.clientWidth || canvas.width;
  const height = rectangle.height || canvas.clientHeight || canvas.height;
  return Math.max(0.35, Math.min(1, width / canvas.width, height / canvas.height));
}

function drawPlayer(
  context: CanvasRenderingContext2D,
  player: PlayerSnapshot,
  isMe: boolean,
  displayScale: number,
): void {
  const radius = 16;
  const color = isMe ? SELF_COLOR : colorForPlayer(player.id);
  context.save();

  if (isMe) {
    context.beginPath();
    context.arc(player.x, player.y, radius + 6, 0, Math.PI * 2);
    context.strokeStyle = SELF_COLOR;
    context.lineWidth = 1.5;
    context.setLineDash([3, 3]);
    context.stroke();
    context.setLineDash([]);
  }

  context.beginPath();
  context.arc(player.x, player.y, radius, 0, Math.PI * 2);
  context.fillStyle = color;
  context.fill();
  context.lineWidth = 2.5;
  context.strokeStyle = ARENA_INK;
  context.stroke();

  context.fillStyle = isMe ? ARENA_PAPER : ARENA_INK;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.font = '800 12px "DM Sans", sans-serif';
  context.fillText(
    (player.name || "?").slice(0, 1).toUpperCase(),
    player.x,
    player.y + 1,
  );

  // Only labels scale to the display. Token radii and game positions do not.
  const label =
    isMe && player.name.toLowerCase() === "you"
      ? "YOU"
      : player.name + (isMe ? " \u00b7 YOU" : "");
  const fontSize = Math.max(11, 9 / displayScale);
  const labelPadding = Math.max(16, 8 / displayScale);
  const labelHeight = Math.max(20, 18 / displayScale);
  const edgePadding = Math.max(6, 3 / displayScale);
  context.font = `${isMe ? "800" : "600"} ${fontSize}px "DM Sans", sans-serif`;
  const labelWidth = Math.min(
    context.measureText(label).width + labelPadding,
    context.canvas.width - edgePadding * 2,
  );
  const labelX = Math.max(
    edgePadding + labelWidth / 2,
    Math.min(context.canvas.width - edgePadding - labelWidth / 2, player.x),
  );
  const labelOffset = radius + 7 / displayScale + labelHeight / 2;
  const desiredY =
    player.y < labelOffset + labelHeight / 2 + edgePadding
      ? player.y + labelOffset
      : player.y - labelOffset;
  const labelY = Math.max(
    labelHeight / 2 + edgePadding,
    Math.min(context.canvas.height - labelHeight / 2 - edgePadding, desiredY),
  );

  context.fillStyle = isMe ? SELF_COLOR : ARENA_PAPER;
  roundedPath(
    context,
    labelX - labelWidth / 2,
    labelY - labelHeight / 2,
    labelWidth,
    labelHeight,
    2 / displayScale,
  );
  context.fill();
  if (!isMe) {
    context.lineWidth = 1;
    context.strokeStyle = "rgba(23,23,21,0.2)";
    context.stroke();
  }
  context.fillStyle = isMe ? ARENA_PAPER : ARENA_INK;
  context.fillText(label, labelX, labelY + 0.5, labelWidth - labelPadding);
  context.restore();
}

function drawCoin(context: CanvasRenderingContext2D, coin: CoinSnapshot): void {
  context.save();
  context.translate(coin.x, coin.y);
  context.beginPath();
  context.moveTo(-10, -6);
  context.lineTo(-5, -1);
  context.lineTo(0, -9);
  context.lineTo(5, -1);
  context.lineTo(10, -6);
  context.lineTo(7, 7);
  context.lineTo(-7, 7);
  context.closePath();
  context.fillStyle = "#efb827";
  context.fill();
  context.strokeStyle = ARENA_INK;
  context.lineWidth = 1.8;
  context.stroke();
  context.beginPath();
  context.moveTo(-6, 4);
  context.lineTo(6, 4);
  context.strokeStyle = ARENA_INK;
  context.stroke();

  context.beginPath();
  context.moveTo(13, -13);
  context.lineTo(13, -7);
  context.moveTo(10, -10);
  context.lineTo(16, -10);
  context.lineWidth = 1.3;
  context.stroke();
  context.restore();
}

function drawPickupEffect(
  context: CanvasRenderingContext2D,
  effect: PickupEffect,
  now: number,
): void {
  const progress = (now - effect.at) / EFFECT_DURATION_MS;
  context.save();
  context.globalAlpha = 1 - progress;
  context.strokeStyle = effect.mine ? SELF_COLOR : "#aa7500";
  context.lineWidth = 2.5 * (1 - progress);
  context.beginPath();
  context.arc(effect.x, effect.y, 20 + progress * 30, 0, Math.PI * 2);
  context.stroke();
  for (let index = 0; index < 6; index++) {
    const angle = (index * Math.PI) / 3;
    const distance = 18 + progress * 34;
    context.fillStyle = [SELF_COLOR, "#efb827", ARENA_INK][index % 3] ?? ARENA_INK;
    context.fillRect(
      effect.x + Math.cos(angle) * distance - 1.5,
      effect.y + Math.sin(angle) * distance - 1.5,
      3,
      3,
    );
  }
  context.fillStyle = SELF_COLOR;
  context.font = '800 16px "DM Sans", sans-serif';
  context.textAlign = "center";
  const x = Math.max(20, Math.min(context.canvas.width - 20, effect.x));
  const y = Math.max(20, effect.y - 25 - progress * 25);
  context.fillText(`+${effect.amount}`, x, y);
  context.restore();
}

function roundedPath(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.arcTo(x + width, y, x + width, y + height, radius);
  context.arcTo(x + width, y + height, x, y + height, radius);
  context.arcTo(x, y + height, x, y, radius);
  context.arcTo(x, y, x + width, y, radius);
  context.closePath();
}
