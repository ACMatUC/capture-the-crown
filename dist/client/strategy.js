// Edit this file, refresh the client, and check "Run my code" to try a strategy.
// The server still decides movement speed, crown pickups, and scores.
window.chooseDirection = function chooseDirection(state, me) {
  const target = state.coins.reduce((closest, coin) => {
    if (!closest) return coin;
    const closestDistance = Math.hypot(closest.x - me.x, closest.y - me.y);
    const coinDistance = Math.hypot(coin.x - me.x, coin.y - me.y);
    return coinDistance < closestDistance ? coin : closest;
  }, null);

  if (!target) return { dx: 0, dy: 0 };
  return { dx: Math.sign(target.x - me.x), dy: Math.sign(target.y - me.y) };
};
