export const MAX_PLAYER_NAME_LENGTH = 16;
export const MAX_PLAYERS = 32;
function isRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
function isText(value) {
    return typeof value === "string" && value.trim().length > 0;
}
function isFiniteNumber(value) {
    return typeof value === "number" && Number.isFinite(value);
}
export function isAxis(value) {
    return value === -1 || value === 0 || value === 1;
}
export function isDirection(value) {
    return isRecord(value) && isAxis(value.dx) && isAxis(value.dy);
}
export function isClientMessage(value) {
    if (!isRecord(value))
        return false;
    switch (value.type) {
        case "join":
            return isText(value.name) && value.name.length <= MAX_PLAYER_NAME_LENGTH;
        case "input":
            return isDirection(value);
        case "pong":
            return isFiniteNumber(value.sentAt);
        default:
            return false;
    }
}
function isPlayer(value) {
    return (isRecord(value) &&
        isText(value.id) &&
        isText(value.name) &&
        isFiniteNumber(value.x) &&
        isFiniteNumber(value.y) &&
        isFiniteNumber(value.score) &&
        Number.isInteger(value.score) &&
        value.score >= 0);
}
function isCoin(value) {
    return (isRecord(value) &&
        isText(value.id) &&
        isFiniteNumber(value.x) &&
        isFiniteNumber(value.y));
}
export function isServerMessage(value) {
    if (!isRecord(value))
        return false;
    switch (value.type) {
        case "welcome":
            return (isText(value.id) &&
                isFiniteNumber(value.arenaWidth) &&
                value.arenaWidth > 0 &&
                isFiniteNumber(value.arenaHeight) &&
                value.arenaHeight > 0);
        case "state":
            return (Array.isArray(value.players) &&
                value.players.every(isPlayer) &&
                Array.isArray(value.coins) &&
                value.coins.every(isCoin));
        case "ping":
            return isFiniteNumber(value.sentAt);
        case "error":
            return value.code === "server_full" && isText(value.message);
        case "playerJoined":
        case "playerLeft":
            return isText(value.id) && isText(value.name);
        default:
            return false;
    }
}
export function decodeClientMessage(raw) {
    try {
        const value = JSON.parse(raw);
        return isClientMessage(value) ? value : null;
    }
    catch {
        return null;
    }
}
export function decodeServerMessage(raw) {
    try {
        const value = JSON.parse(raw);
        return isServerMessage(value) ? value : null;
    }
    catch {
        return null;
    }
}
//# sourceMappingURL=protocol.js.map