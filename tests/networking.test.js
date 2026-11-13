const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(
  path.join(__dirname, "../public/networking.js"),
  "utf8",
);

function setup() {
  const timers = [];
  const sockets = [];
  class FakeWebSocket {
    static CONNECTING = 0;
    static OPEN = 1;
    static CLOSING = 2;
    static CLOSED = 3;
    constructor(url) {
      if (url === "bad") throw new Error("Invalid URL");
      this.readyState = FakeWebSocket.CONNECTING;
      this.listeners = {};
      this.sent = [];
      sockets.push(this);
    }
    addEventListener(type, listener) {
      (this.listeners[type] ||= []).push(listener);
    }
    emit(type, data) {
      for (const listener of this.listeners[type] || []) listener(data);
    }
    open() {
      this.readyState = FakeWebSocket.OPEN;
      this.emit("open");
    }
    receive(message) {
      this.emit("message", { data: JSON.stringify(message) });
    }
    send(message) {
      this.sent.push(JSON.parse(message));
    }
    close() {
      this.closed = true;
      this.readyState = FakeWebSocket.CLOSED;
      this.emit("close");
    }
  }
  const sandbox = {
    WebSocket: FakeWebSocket,
    window: { debugOverlay: { refresh() {} } },
    console: { log() {}, warn() {} },
    setTimeout(callback, delay) {
      const timer = { callback, delay, cleared: false };
      timers.push(timer);
      return timer;
    },
    clearTimeout(timer) {
      if (timer) timer.cleared = true;
    },
  };
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox);
  const statuses = [];
  const welcomes = [];
  const states = [];
  const callbacks = {
    onConnectionChange: (...args) => statuses.push(args),
    onWelcome: (message) => welcomes.push(message),
    onStateUpdate: (state) => states.push(state),
  };
  return {
    api: sandbox,
    callbacks,
    statuses,
    welcomes,
    states,
    sockets,
    timers,
  };
}

const welcome = {
  type: "welcome",
  id: "player-1",
  arenaWidth: 800,
  arenaHeight: 600,
};
const state = {
  type: "state",
  players: [{ id: "player-1", name: "Player", x: 100, y: 100, score: 2 }],
  coins: [{ id: "coin-1", x: 400, y: 300 }],
};

test("connected means the server accepted the join, not merely that the socket opened", () => {
  const h = setup();
  h.api.connectToServer("Player", "ws://server:3000", h.callbacks);
  h.sockets[0].open();
  assert.deepEqual(h.sockets[0].sent, [{ type: "join", name: "Player" }]);
  assert.deepEqual(h.statuses, [["connecting"]]);
  h.sockets[0].receive(welcome);
  assert.deepEqual(h.statuses, [["connecting"], ["connected"]]);
  assert.equal(h.api.getMyPlayerId(), "player-1");
  assert.equal(h.welcomes.length, 1);
  assert.equal(h.timers[0].cleared, true);
  h.sockets[0].receive(welcome);
  assert.equal(h.welcomes.length, 1);
});

test("repeated connect closes the retired socket and ignores its late events and timer", () => {
  const h = setup();
  h.api.connectToServer("First", "ws://server:3000", h.callbacks);
  const first = h.sockets[0];
  h.api.connectToServer("Second", "ws://server:3000", h.callbacks);
  const second = h.sockets[1];
  assert.equal(first.closed, true);
  second.open();
  second.receive(welcome);
  first.open();
  first.receive({ ...welcome, id: "stale-player" });
  first.receive(state);
  first.emit("error");
  first.emit("close");
  h.timers[0].callback(); // Simulate a queued timer even after cancellation.
  assert.equal(h.api.getMyPlayerId(), "player-1");
  assert.equal(second.closed, undefined);
  assert.equal(first.sent.length, 0);
  assert.equal(h.welcomes.length, 1);
  assert.equal(h.states.length, 0);
  assert.deepEqual(h.statuses, [["connecting"], ["connecting"], ["connected"]]);
});

test("an attempt times out even if the socket opens without a welcome", () => {
  for (const openSocket of [false, true]) {
    const h = setup();
    h.api.connectToServer("Player", "ws://server:3000", h.callbacks);
    if (openSocket) h.sockets[0].open();
    assert.equal(h.timers[0].delay, 8000);
    h.timers[0].callback();
    assert.equal(h.sockets[0].closed, true);
    assert.equal(h.statuses.at(-1)[0], "disconnected");
    assert.match(h.statuses.at(-1)[1], /timed out/);
    assert.equal(h.api.getMyPlayerId(), null);
  }
});

test("malformed JSON and malformed protocol shapes cannot crash or replace game state", () => {
  const h = setup();
  h.api.connectToServer("Player", "ws://server:3000", h.callbacks);
  const socket = h.sockets[0];
  socket.open();
  socket.receive(welcome);
  socket.receive(state);
  assert.doesNotThrow(() => {
    socket.emit("message", { data: "{" });
    socket.receive(null);
    socket.receive({ type: "state", players: null, coins: [] });
    socket.receive({ type: "state", players: [null], coins: [] });
    socket.receive({ type: "ping", sentAt: "yesterday" });
  });
  assert.equal(h.states.length, 1);
  assert.equal(h.api.getLatestState().players[0].score, 2);
});

test("intentional leave clears identity, snapshot, statistics, and reports an empty reason once", () => {
  const h = setup();
  h.api.connectToServer("Player", "ws://server:3000", h.callbacks);
  const socket = h.sockets[0];
  socket.open();
  socket.receive(welcome);
  socket.receive(state);
  assert.ok(h.api.getNetStats().received > 0);
  h.api.disconnectFromServer();
  assert.deepEqual(h.statuses.at(-1), ["disconnected", ""]);
  assert.equal(h.api.getMyPlayerId(), null);
  assert.equal(h.api.getLatestState().players.length, 0);
  assert.equal(h.api.getNetStats().sent, 0);
  assert.equal(h.api.getNetStats().received, 0);
  socket.emit("close");
  socket.emit("error");
  assert.equal(
    h.statuses.filter(([status]) => status === "disconnected").length,
    1,
  );
  assert.equal(h.api.sendMessage({ type: "input", dx: 1, dy: 0 }), false);
});

test("connection errors and constructor failures leave a usable disconnected session", () => {
  const h = setup();
  assert.doesNotThrow(() =>
    h.api.connectToServer("Player", "bad", h.callbacks),
  );
  assert.equal(h.statuses.at(-1)[0], "disconnected");
  assert.match(h.statuses.at(-1)[1], /address/);
  h.api.connectToServer("Player", "ws://server:3000", h.callbacks);
  h.sockets[0].emit("error");
  assert.equal(h.statuses.at(-1)[0], "disconnected");
  assert.match(h.statuses.at(-1)[1], /Could not connect/);
  assert.equal(h.sockets[0].closed, true);
});

test("unexpected disconnect explains score reset and a fresh connection resets old data", () => {
  const h = setup();
  h.api.connectToServer("Player", "ws://server:3000", h.callbacks);
  h.sockets[0].open();
  h.sockets[0].receive(welcome);
  h.sockets[0].receive(state);
  h.sockets[0].close();
  assert.match(h.statuses.at(-1)[1], /Rejoining starts a new score/);
  assert.equal(h.api.getLatestState().coins.length, 0);
  h.api.connectToServer("New player", "ws://server:3000", h.callbacks);
  assert.equal(h.api.getNetStats().received, 0);
  assert.equal(h.api.getMyPlayerId(), null);
  h.sockets[1].open();
  h.sockets[1].receive({ ...welcome, id: "player-2" });
  assert.equal(h.api.getMyPlayerId(), "player-2");
});
