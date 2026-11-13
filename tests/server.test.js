const test = require("node:test");
const assert = require("node:assert/strict");
const { createCoin, checkCoinPickups } = require("../server/crown");
const { createPlayer, movePlayer } = require("../server/player");
const {
  ARENA_WIDTH,
  ARENA_HEIGHT,
  COIN_RADIUS,
  COIN_PICKUP_DISTANCE,
  PLAYER_RADIUS,
  PLAYER_SPEED,
} = require("../server/constants");

// Exercise the extreme random values, rather than relying on chance to
// discover an object spawning partly outside the arena.
function withRandom(value, check) {
  const original = Math.random;
  Math.random = () => value;
  try {
    check();
  } finally {
    Math.random = original;
  }
}

test("crowns spawn fully visible and reachable at both arena extremes", () => {
  for (const random of [0, 1 - Number.EPSILON]) {
    withRandom(random, () => {
      const coin = createCoin("coin-1");
      const inset = COIN_RADIUS + 8;
      assert.equal(coin.id, "coin-1");
      assert.ok(coin.x >= inset && coin.x <= ARENA_WIDTH - inset);
      assert.ok(coin.y >= inset && coin.y <= ARENA_HEIGHT - inset);
    });
  }
});

test("players spawn fully inside the arena with zero score and no motion", () => {
  for (const random of [0, 1 - Number.EPSILON]) {
    withRandom(random, () => {
      const player = createPlayer("player-1", "Player");
      assert.equal(player.id, "player-1");
      assert.equal(player.name, "Player");
      assert.ok(
        player.x >= PLAYER_RADIUS && player.x <= ARENA_WIDTH - PLAYER_RADIUS,
      );
      assert.ok(
        player.y >= PLAYER_RADIUS && player.y <= ARENA_HEIGHT - PLAYER_RADIUS,
      );
      assert.equal(player.score, 0);
      assert.equal(player.dx, 0);
      assert.equal(player.dy, 0);
    });
  }
});

test("one shared crown awards one point to one player and only it respawns", () => {
  const first = { x: 100, y: 100, score: 4 };
  const second = { x: 100, y: 100, score: 2 };
  const collected = { id: "coin-1", x: 100, y: 100 };
  const untouched = { id: "coin-2", x: 700, y: 500 };
  withRandom(0.5, () => {
    const result = checkCoinPickups([first, second], [collected, untouched]);
    assert.equal(first.score, 5);
    assert.equal(second.score, 2);
    assert.equal(result.length, 2);
    assert.equal(result[0].id, collected.id);
    assert.notStrictEqual(result[0], collected);
    assert.ok(
      Math.hypot(result[0].x - collected.x, result[0].y - collected.y) >
        COIN_PICKUP_DISTANCE,
    );
    assert.strictEqual(result[1], untouched);
  });
});

test("crowns outside pickup range keep their positions and no points are awarded", () => {
  const player = { x: 100, y: 100, score: 3 };
  const coin = { id: "coin-1", x: 100 + COIN_PICKUP_DISTANCE + 1, y: 100 };
  const result = checkCoinPickups([player], [coin]);
  assert.strictEqual(result[0], coin);
  assert.equal(player.score, 3);
});

test("touching the pickup boundary collects a crown", () => {
  const player = { x: 100, y: 100, score: 0 };
  checkCoinPickups(
    [player],
    [{ id: "coin-1", x: 100 + COIN_PICKUP_DISTANCE, y: 100 }],
  );
  assert.equal(player.score, 1);
});

test("movement follows server speed and keeps the whole player inside every edge", () => {
  const moving = { x: 100, y: 100, dx: 1, dy: -1 };
  movePlayer(moving);
  assert.equal(moving.x, 100 + PLAYER_SPEED);
  assert.equal(moving.y, 100 - PLAYER_SPEED);

  const topLeft = { x: PLAYER_RADIUS, y: PLAYER_RADIUS, dx: -1, dy: -1 };
  movePlayer(topLeft);
  assert.equal(topLeft.x, PLAYER_RADIUS);
  assert.equal(topLeft.y, PLAYER_RADIUS);

  const bottomRight = {
    x: ARENA_WIDTH - PLAYER_RADIUS,
    y: ARENA_HEIGHT - PLAYER_RADIUS,
    dx: 1,
    dy: 1,
  };
  movePlayer(bottomRight);
  assert.equal(bottomRight.x, ARENA_WIDTH - PLAYER_RADIUS);
  assert.equal(bottomRight.y, ARENA_HEIGHT - PLAYER_RADIUS);
});
