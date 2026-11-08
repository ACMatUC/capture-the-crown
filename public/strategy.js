// ============================================================================
// strategy.js  (MEMBER CODE)
//
// Edit chooseDirection() to build a competition strategy. It can request
// movement, but the server still decides the actual position and score.
// ============================================================================

/**
 * chooseDirection(state, me)
 *
 * Return { dx, dy }, where each value is -1, 0, or 1.
 * `state` is the latest server snapshot and `me` is this player's snapshot.
 */
function chooseDirection(state, me) {
  const target = state.coins.reduce((closest, coin) => {
    if (!closest) return coin;
    const closestDistance = Math.hypot(closest.x - me.x, closest.y - me.y);
    const coinDistance = Math.hypot(coin.x - me.x, coin.y - me.y);
    return coinDistance < closestDistance ? coin : closest;
  }, null);
  if (!target) return { dx: 0, dy: 0 };

  const horizontal = Math.sign(target.x - me.x);
  const vertical = Math.sign(target.y - me.y);
  return { dx: horizontal, dy: vertical };
}

function runStrategy(state, playerId) {
  const me = state.players.find((player) => player.id === playerId);
  if (!me || !state.coins.length) return;

  try {
    const direction = chooseDirection(state, me);
    sendStrategyDirection(direction && direction.dx, direction && direction.dy);
  } catch (error) {
    console.error("Strategy failed; stopping player.", error);
    sendStrategyDirection(0, 0);
  }
}
