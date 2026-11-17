export const DEFAULT_GAME_CONFIG = Object.freeze({
    tickRate: 20,
    arenaWidth: 800,
    arenaHeight: 600,
    playerSpeed: 4,
    playerRadius: 16,
    coinCount: 10,
    coinRadius: 12,
    coinSpawnPadding: 8,
    pickupDistance: 28,
    pingIntervalMs: 2000,
});
export function createGameConfig(overrides = {}) {
    const config = { ...DEFAULT_GAME_CONFIG, ...overrides };
    for (const [key, value] of Object.entries(config)) {
        if (!Number.isFinite(value) || value < 0) {
            throw new RangeError(`Invalid game setting ${key}: expected a finite, nonnegative number.`);
        }
    }
    if (config.tickRate <= 0 || config.pingIntervalMs <= 0) {
        throw new RangeError("Tick rate and ping interval must be greater than zero.");
    }
    if (!Number.isInteger(config.coinCount) || config.coinCount < 1) {
        throw new RangeError("Crown count must be a positive integer.");
    }
    const inset = Math.max(config.playerRadius, config.coinRadius + config.coinSpawnPadding);
    if (config.arenaWidth <= inset * 2 || config.arenaHeight <= inset * 2) {
        throw new RangeError("The arena must be larger than its spawn margins.");
    }
    return Object.freeze(config);
}
export function parsePort(value) {
    if (value === undefined)
        return 3000;
    if (!/^\d+$/.test(value))
        throw new RangeError("PORT must be an integer from 1 through 65535.");
    const port = Number(value);
    if (!Number.isSafeInteger(port) || port < 1 || port > 65535) {
        throw new RangeError("PORT must be an integer from 1 through 65535.");
    }
    return port;
}
//# sourceMappingURL=constants.js.map