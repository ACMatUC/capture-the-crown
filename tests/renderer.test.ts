import { afterEach, describe, expect, it, vi } from "vitest";
import { createRenderer, type Renderer } from "../client/renderer.js";
import type { GameState } from "../shared/protocol.js";

interface CanvasCall {
  readonly method: string;
  readonly args: unknown[];
  readonly font: string;
}

interface TextCall extends CanvasCall {
  readonly method: "fillText";
  readonly args: [string, number, number, number?];
}

interface MockCanvas {
  width: number;
  height: number;
  getBoundingClientRect(): { width: number; height: number };
}

interface MockContext {
  canvas: MockCanvas;
  font: string;
  [property: string]: unknown;
}

function setup(reducedMotion = false) {
  const clock = vi.spyOn(performance, "now").mockReturnValue(100);
  vi.stubGlobal("matchMedia", () => ({ matches: reducedMotion }));
  const calls: CanvasCall[] = [];
  const context: MockContext = {
    canvas: {
      width: 800,
      height: 600,
      getBoundingClientRect: () => ({ width: 800, height: 600 }),
    },
    font: "11px sans-serif",
  };
  for (const method of [
    "clearRect",
    "fillRect",
    "save",
    "restore",
    "beginPath",
    "moveTo",
    "lineTo",
    "stroke",
    "fill",
    "setLineDash",
    "arc",
    "arcTo",
    "closePath",
    "translate",
    "fillText",
  ]) {
    context[method] = (...args: unknown[]) => {
      calls.push({ method, args, font: method === "fillText" ? context.font : "" });
    };
  }
  context.measureText = (text: string) => ({
    width: text.length * fontSize(context.font) * 0.55,
  });
  context.createRadialGradient = () => {
    throw new Error("The paper arena should not create gradients.");
  };
  Object.defineProperty(context, "fillStyle", {
    set(value: string) {
      calls.push({ method: "fillStyle", args: [value], font: "" });
    },
  });
  const renderer = createRenderer();
  const nativeContext = context as unknown as CanvasRenderingContext2D;

  return {
    context,
    renderer,
    calls,
    draw(
      state: GameState,
      playerId: string | null = "player-1",
      time = 100,
      target: Renderer = renderer,
    ) {
      clock.mockReturnValue(time);
      calls.length = 0;
      target.draw(nativeContext, state, playerId);
      return calls;
    },
  };
}

function fontSize(font: string): number {
  return Number.parseFloat(font.match(/[\d.]+px/)?.[0] ?? "11");
}

function makeState(score = 0, x = 120, y = 160, coinX = 480): GameState {
  return {
    type: "state",
    players: [
      { id: "player-1", name: "Player One", x, y, score },
      { id: "player-2", name: "Player Two", x: 710, y: 530, score: 0 },
    ],
    coins: [{ id: "coin-1", x: coinX, y: 320 }],
  };
}

function textCalls(calls: readonly CanvasCall[]): TextCall[] {
  return calls.filter((call): call is TextCall => call.method === "fillText");
}

function pickupLabels(calls: readonly CanvasCall[]): string[] {
  return textCalls(calls)
    .filter(({ args }) => /^\+\d+$/.test(args[0]))
    .map(({ args }) => args[0]);
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("arena renderer", () => {
  it("preserves authoritative snapshots and draws their exact positions", () => {
    const { draw, calls } = setup();
    const state = makeState();
    const expected = structuredClone(state);
    for (const item of [...state.players, ...state.coins]) Object.freeze(item);
    Object.freeze(state.players);
    Object.freeze(state.coins);
    Object.freeze(state);

    draw(state);
    for (const player of state.players) {
      expect(
        calls.some(
          ({ method, args }) =>
            method === "arc" &&
            args[0] === player.x &&
            args[1] === player.y &&
            args[2] === 16,
        ),
      ).toBe(true);
    }
    expect(
      calls.some(
        ({ method, args }) =>
          method === "translate" && args[0] === 480 && args[1] === 320,
      ),
    ).toBe(true);
    draw(state, "player-1", 400);
    expect(state).toEqual(expected);
  });

  it("shows pickups only for confirmed score increases and expires them", () => {
    const { draw } = setup();
    expect(pickupLabels(draw(makeState(4)))).toEqual([]);
    expect(pickupLabels(draw(makeState(4), "player-1", 150))).toEqual([]);
    expect(pickupLabels(draw(makeState(4, 140, 160, 540), "player-1", 200))).toEqual([]);

    const earned = makeState(6);
    expect(pickupLabels(draw(earned, "player-1", 250))).toEqual(["+2"]);
    expect(pickupLabels(draw(earned, "player-1", 400))).toEqual(["+2"]);
    expect(pickupLabels(draw(earned, "player-1", 1001))).toEqual([]);
    expect(pickupLabels(draw(makeState(3), "player-1", 1050))).toEqual([]);
  });

  it("disables pickup animation and keeps the arena still with reduced motion", () => {
    const { draw } = setup(true);
    const first = [...draw(makeState(0), "player-1", 100)];
    const later = [...draw(makeState(1), "player-1", 600)];
    expect(pickupLabels(later)).toEqual([]);
    expect(later).toEqual(first);
  });

  it("fits name labels inside every arena edge", () => {
    const { draw } = setup();
    for (const [x, y] of [
      [16, 16],
      [784, 16],
      [16, 584],
      [784, 584],
    ] as const) {
      const labels = textCalls(draw(makeState(0, x, y))).filter(({ args }) =>
        args[0].includes("YOU"),
      );
      expect(labels).toHaveLength(1);
      for (const label of labels) {
        const [, labelX, labelY, maxWidth = 0] = label.args;
        expect(maxWidth).toBeGreaterThan(0);
        expect(labelX - maxWidth / 2).toBeGreaterThanOrEqual(0);
        expect(labelX + maxWidth / 2).toBeLessThanOrEqual(800);
        expect(labelY - 10).toBeGreaterThanOrEqual(0);
        expect(labelY + 10).toBeLessThanOrEqual(600);
      }
    }
  });

  it("resets feedback and score comparisons for a new session", () => {
    const { draw, renderer } = setup();
    draw(makeState(0));
    expect(pickupLabels(draw(makeState(1), "player-1", 150))).toEqual(["+1"]);
    renderer.reset();
    expect(pickupLabels(draw(makeState(8), "player-1", 200))).toEqual([]);
    expect(() =>
      draw({ type: "state", players: [], coins: [] }, null, 300),
    ).not.toThrow();
  });

  it("keeps scaled and letterboxed labels readable without resizing players", () => {
    const { draw, context } = setup();
    for (const [width, height] of [
      [800, 600],
      [380, 285],
      [520, 390],
      [800, 300],
    ] as const) {
      context.canvas.getBoundingClientRect = () => ({ width, height });
      const scale = Math.min(width / 800, height / 600);
      for (const [x, y] of [
        [16, 16],
        [784, 584],
      ] as const) {
        const calls = draw(makeState(0, x, y));
        const labels = textCalls(calls).filter(({ args }) => args[0].includes("YOU"));
        expect(labels).toHaveLength(1);
        for (const label of labels) {
          const size = fontSize(label.font);
          const [, labelX, labelY, maxWidth = 0] = label.args;
          expect(size * scale).toBeGreaterThanOrEqual(9);
          expect(labelX - maxWidth / 2).toBeGreaterThanOrEqual(0);
          expect(labelX + maxWidth / 2).toBeLessThanOrEqual(800);
          expect(labelY - size).toBeGreaterThanOrEqual(0);
          expect(labelY + size).toBeLessThanOrEqual(600);
        }
        expect(
          calls.some(
            ({ method, args }) =>
              method === "arc" && args[0] === x && args[1] === y && args[2] === 16,
          ),
        ).toBe(true);
      }
    }
  });

  it("does not share pickup history between renderer instances", () => {
    const { draw } = setup();
    const other = createRenderer();
    draw(makeState(0));
    expect(pickupLabels(draw(makeState(1), "player-1", 150))).toEqual(["+1"]);
    expect(pickupLabels(draw(makeState(1), "player-1", 150, other))).toEqual([]);
  });
});
