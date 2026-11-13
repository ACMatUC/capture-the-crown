const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function setup({ reducedMotion = false } = {}) {
  let now = 100;
  const calls = [];
  const ctx = { canvas: { width: 800, height: 600 } };
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
    ctx[method] = (...args) => calls.push({ method, args });
  }
  ctx.measureText = (text) => ({
    width:
      text.length * (parseFloat(ctx.font.match(/[\d.]+px/)[0]) || 11) * 0.55,
  });
  ctx.createRadialGradient = () => {
    throw new Error("The paper arena uses flat ink, not gradients.");
  };
  Object.defineProperty(ctx, "fillStyle", {
    set(value) {
      calls.push({ method: "fillStyle", args: [value] });
    },
  });
  const context = vm.createContext({
    performance: { now: () => now },
    matchMedia: () => ({ matches: reducedMotion }),
  });
  vm.runInContext(
    fs.readFileSync(path.join(__dirname, "../public/renderer.js"), "utf8"),
    context,
  );
  return {
    context,
    ctx,
    calls,
    draw(state, playerId = "player-1", at = now) {
      now = at;
      calls.length = 0;
      context.drawFrame(ctx, state, playerId);
      return calls;
    },
  };
}

function makeState(score = 0) {
  return {
    players: [
      { id: "player-1", name: "Player One", x: 120, y: 160, score },
      { id: "player-2", name: "Player Two", x: 710, y: 530, score: 0 },
    ],
    coins: [{ id: "coin-1", x: 480, y: 320 }],
  };
}

function pickupLabels(calls) {
  return calls.filter(
    ({ method, args }) => method === "fillText" && /^\+\d+$/.test(args[0]),
  );
}

test("rendering preserves authoritative snapshots and uses their exact positions", () => {
  const { draw, calls } = setup();
  const state = makeState();
  const expected = JSON.parse(JSON.stringify(state));
  for (const item of [...state.players, ...state.coins]) Object.freeze(item);
  Object.freeze(state.players);
  Object.freeze(state.coins);
  Object.freeze(state);

  draw(state);
  for (const player of state.players) {
    assert.ok(
      calls.some(
        ({ method, args }) =>
          method === "arc" &&
          args[0] === player.x &&
          args[1] === player.y &&
          args[2] === 16,
      ),
    );
  }
  assert.ok(
    calls.some(
      ({ method, args }) =>
        method === "translate" && args[0] === 480 && args[1] === 320,
    ),
  );
  draw(state, "player-1", 400);
  assert.deepEqual(state, expected);
});

test("pickup feedback follows a confirmed score increase and expires", () => {
  const { draw } = setup();
  assert.equal(
    pickupLabels(draw(makeState(4))).length,
    0,
    "joining with points is not a pickup",
  );
  assert.equal(
    pickupLabels(draw(makeState(4), "player-1", 150)).length,
    0,
    "unchanged scores are not pickups",
  );
  const moved = makeState(4);
  moved.players[0].x += 20;
  moved.coins[0].x += 60;
  assert.equal(
    pickupLabels(draw(moved, "player-1", 200)).length,
    0,
    "movement alone cannot award visual points",
  );

  const earned = makeState(6);
  assert.deepEqual(
    pickupLabels(draw(earned, "player-1", 250)).map(({ args }) => args[0]),
    ["+2"],
  );
  assert.equal(
    pickupLabels(draw(earned, "player-1", 400)).length,
    1,
    "redrawing one snapshot does not duplicate effects",
  );
  assert.equal(
    pickupLabels(draw(earned, "player-1", 1001)).length,
    0,
    "old feedback disappears",
  );
  assert.equal(
    pickupLabels(draw(makeState(3), "player-1", 1050)).length,
    0,
    "score decreases do not celebrate",
  );
});

test("reduced motion disables pickup animation and keeps the paper arena still", () => {
  const { draw } = setup({ reducedMotion: true });
  const first = [...draw(makeState(0), "player-1", 100)];
  const later = [...draw(makeState(1), "player-1", 600)];
  assert.equal(pickupLabels(later).length, 0);
  assert.deepEqual(later, first, "a score update does not animate the arena");
});

test("player name labels fit inside every arena edge", () => {
  const { context, ctx, calls } = setup();
  for (const [x, y] of [
    [16, 16],
    [784, 16],
    [16, 584],
    [784, 584],
  ]) {
    calls.length = 0;
    context.drawPlayer(
      ctx,
      { id: "player-1", name: "SixteenCharacter", x, y, score: 0 },
      true,
    );
    const label = calls.find(
      ({ method, args }) => method === "fillText" && args[0].endsWith(" · YOU"),
    );
    assert.ok(label, "self label remains visible");
    const [, labelX, labelY, maxWidth] = label.args;
    assert.ok(labelX - maxWidth / 2 >= 0, "label fits left edge");
    assert.ok(
      labelX + maxWidth / 2 <= ctx.canvas.width,
      "label fits right edge",
    );
    assert.ok(
      labelY - 10 >= 0 && labelY + 10 <= ctx.canvas.height,
      "label fits vertical edges",
    );
  }
});

test("resetting a connection clears feedback and prevents old-score comparisons", () => {
  const { context, draw } = setup();
  draw(makeState(0));
  assert.equal(pickupLabels(draw(makeState(1), "player-1", 150)).length, 1);
  context.resetRenderer();
  assert.equal(pickupLabels(draw(makeState(8), "player-1", 200)).length, 0);
  assert.doesNotThrow(() => draw({ players: [], coins: [] }, null, 300));
});

test("scaled arenas retain readable name labels without resizing players", () => {
  const { context, ctx, calls } = setup();
  for (const [width, height] of [
    [800, 600],
    [380, 285],
    [520, 390],
    [800, 300],
  ]) {
    ctx.canvas.getBoundingClientRect = () => ({ width, height });
    const scale = Math.min(
      width / ctx.canvas.width,
      height / ctx.canvas.height,
    );
    for (const [x, y] of [
      [16, 16],
      [784, 584],
    ]) {
      calls.length = 0;
      context.drawPlayer(
        ctx,
        { id: "player-1", name: "SixteenCharacter", x, y, score: 0 },
        true,
      );
      const fontSize = parseFloat(ctx.font.match(/[\d.]+px/)[0]);
      assert.ok(
        fontSize * scale >= 9,
        "label text stays at least nine displayed pixels",
      );
      const label = calls.find(
        ({ method, args }) =>
          method === "fillText" && args[0].endsWith(" · YOU"),
      );
      const [, labelX, labelY, maxWidth] = label.args;
      assert.ok(labelX - maxWidth / 2 >= 0 && labelX + maxWidth / 2 <= 800);
      assert.ok(labelY - fontSize >= 0 && labelY + fontSize <= 600);
      assert.ok(
        calls.some(
          ({ method, args }) =>
            method === "arc" &&
            args[0] === x &&
            args[1] === y &&
            args[2] === 16,
        ),
      );
    }
  }
});
