// Real WebSocket integration check against a disposable server. This never
// contacts an organizer's running server or changes its players and scores.
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const net = require("node:net");
const path = require("node:path");
const vm = require("node:vm");
const WebSocket = require("ws");

const projectRoot = path.join(__dirname, "..");
const allClients = [];

async function reservePort() {
  const reservation = net.createServer();
  return new Promise((resolve, reject) => {
    reservation.once("error", reject);
    reservation.listen(0, "127.0.0.1", () => {
      const port = reservation.address().port;
      reservation.close((error) => (error ? reject(error) : resolve(port)));
    });
  });
}

function startServer(port) {
  // Deterministic spawn locations avoid an accidental pickup on the first
  // tick obscuring the initial score-zero/rejoin checks. Run the real entry
  // networking code after replacing only randomness inside this isolated child.
  const bootstrap = `
    let seed = 0xC0FFEE;
    Math.random = () => {
      seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5;
      return (seed >>> 0) / 4294967296;
    };
    require('./server/networking').startWebSocketServer(
      { host: '127.0.0.1', port: Number(process.env.PORT) },
      () => console.log('LAN_SMOKE_READY')
    );
  `;
  const child = spawn(process.execPath, ["-e", bootstrap], {
    cwd: projectRoot,
    env: { ...process.env, PORT: String(port) },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  let startupOutput = "";
  let stderr = "";
  let ready = false;
  const started = new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error("Test server did not start within 8 seconds.")),
      8000,
    );
    const fail = (error) => {
      clearTimeout(timer);
      reject(error);
    };
    child.once("error", fail);
    child.once("exit", (code) => {
      if (!ready) fail(new Error(`Test server exited (${code}): ${stderr}`));
    });
    child.stdout.on("data", (chunk) => {
      // Drain the verbose workshop logs without printing a 20 Hz state dump.
      if (ready) return;
      startupOutput = (startupOutput + chunk.toString()).slice(-4096);
      if (startupOutput.includes("LAN_SMOKE_READY")) {
        ready = true;
        clearTimeout(timer);
        resolve();
      }
    });
    child.stderr.on("data", (chunk) => {
      stderr = (stderr + chunk.toString()).slice(-4096);
    });
  });
  return { child, started };
}

function waitFor(client, predicate, { since = 0, timeout = 6000 } = {}) {
  const existing = client.history.find(
    (entry) => entry.sequence > since && predicate(entry.message),
  );
  if (existing) return Promise.resolve(existing.message);
  if (client.failure) return Promise.reject(client.failure);
  return new Promise((resolve, reject) => {
    const waiter = {
      predicate,
      since,
      resolve(message) {
        clearTimeout(timer);
        client.waiters.delete(waiter);
        resolve(message);
      },
      reject(error) {
        clearTimeout(timer);
        client.waiters.delete(waiter);
        reject(error);
      },
    };
    const timer = setTimeout(
      () =>
        waiter.reject(
          new Error(`Timed out waiting for ${client.name}'s server message.`),
        ),
      timeout,
    );
    client.waiters.add(waiter);
  });
}

async function joinClient(url, name) {
  const client = {
    socket: new WebSocket(url),
    name,
    id: null,
    sequence: 0,
    history: [],
    waiters: new Set(),
    failure: null,
    controller: null,
  };
  allClients.push(client);
  const fail = (error) => {
    client.failure = error;
    for (const waiter of [...client.waiters]) waiter.reject(error);
  };
  client.socket.on("error", fail);
  client.socket.on("close", () => fail(new Error(`${name} disconnected.`)));
  client.socket.on("open", () => send(client, { type: "join", name }));
  client.socket.on("message", (raw) => {
    try {
      const message = JSON.parse(raw.toString());
      const sequence = ++client.sequence;
      client.history.push({ sequence, message });
      if (message.type === "welcome") client.id = message.id;
      if (message.type === "ping")
        send(client, { type: "pong", sentAt: message.sentAt });
      if (message.type === "state" && client.controller)
        client.controller(message);
      for (const waiter of [...client.waiters]) {
        if (sequence > waiter.since && waiter.predicate(message))
          waiter.resolve(message);
      }
    } catch (error) {
      fail(error);
    }
  });
  await waitFor(client, (message) => message.type === "welcome");
  return client;
}

function send(client, message) {
  if (client.socket.readyState === WebSocket.OPEN)
    client.socket.send(JSON.stringify(message));
}

function closeClient(client) {
  if (client.socket.readyState === WebSocket.CLOSED) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error("Client did not close.")),
      3000,
    );
    client.socket.once("close", () => {
      clearTimeout(timer);
      resolve();
    });
    client.socket.close();
  });
}

async function stopServer(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  await new Promise((resolve) => {
    const timer = setTimeout(resolve, 3000);
    child.once("exit", () => {
      clearTimeout(timer);
      resolve();
    });
    child.kill();
  });
}

async function run() {
  let child;
  try {
    const port = await reservePort();
    const server = startServer(port);
    child = server.child;
    await server.started;
    const url = `ws://127.0.0.1:${port}`;
    const first = await joinClient(url, "Smoke A");
    const second = await joinClient(url, "Smoke B");
    const shared = await waitFor(
      first,
      (message) => message.type === "state" && message.players.length === 2,
    );
    await waitFor(
      second,
      (message) =>
        message.type === "state" &&
        JSON.stringify(message) === JSON.stringify(shared),
    );
    assert.equal(shared.coins.length, 10);
    assert.equal(
      shared.players.find((player) => player.id === second.id).score,
      0,
    );

    let since = first.sequence;
    for (let i = 0; i < 3; i += 1) send(first, { type: "join", name: "Ghost" });
    for (let i = 0; i < 3; i += 1) {
      const snapshot = await waitFor(
        first,
        (message) => message.type === "state",
        { since },
      );
      assert.equal(
        snapshot.players.length,
        2,
        "Repeated join must not add a phantom player.",
      );
      since = first.sequence;
    }
    assert.equal(
      first.history.filter(({ message }) => message.type === "welcome").length,
      1,
    );

    const starting = await waitFor(
      first,
      (message) => message.type === "state",
      { since },
    );
    const mover = starting.players.find((player) => player.id === first.id);
    const stationary = starting.players.find(
      (player) => player.id === second.id,
    );
    const dx = mover.x < 400 ? 1 : -1;
    since = first.sequence;
    send(first, { type: "input", dx, dy: 0 });
    const moved = await waitFor(
      first,
      (message) =>
        message.type === "state" &&
        message.players.find((player) => player.id === first.id).x !== mover.x,
      { since },
    );
    send(first, { type: "input", dx: 0, dy: 0 });
    const movedPlayer = moved.players.find((player) => player.id === first.id);
    const unmovedPlayer = moved.players.find(
      (player) => player.id === second.id,
    );
    assert.ok((movedPlayer.x - mover.x) * dx > 0);
    assert.equal(movedPlayer.y, mover.y);
    assert.equal(unmovedPlayer.x, stationary.x);
    assert.equal(unmovedPlayer.y, stationary.y);

    // Execute the actual member-authored strategy against real state messages.
    let lastDirection = "";
    const strategy = {
      console,
      sendStrategyDirection(nextDx, nextDy) {
        assert.ok(
          [nextDx, nextDy].every((value) => [-1, 0, 1].includes(value)),
        );
        const signature = `${nextDx},${nextDy}`;
        if (signature === lastDirection) return;
        lastDirection = signature;
        send(first, { type: "input", dx: nextDx, dy: nextDy });
      },
    };
    vm.createContext(strategy);
    vm.runInContext(
      fs.readFileSync(path.join(projectRoot, "public/strategy.js"), "utf8"),
      strategy,
    );
    since = first.sequence;
    first.controller = (snapshot) => strategy.runStrategy(snapshot, first.id);
    const collected = await waitFor(
      first,
      (message) =>
        message.type === "state" &&
        message.players.find((player) => player.id === first.id).score >
          movedPlayer.score,
      { since, timeout: 15000 },
    );
    first.controller = null;
    send(first, { type: "input", dx: 0, dy: 0 });
    const gain =
      collected.players.find((player) => player.id === first.id).score -
      movedPlayer.score;
    assert.ok(
      gain >= 1,
      "Following the strategy must collect a real server-awarded crown.",
    );
    assert.equal(collected.coins.length, 10);
    assert.deepEqual(
      collected.coins.map((coin) => coin.id),
      moved.coins.map((coin) => coin.id),
    );
    assert.ok(
      collected.coins.some(
        (coin, index) =>
          coin.x !== moved.coins[index].x || coin.y !== moved.coins[index].y,
      ),
      "At least one collected crown must respawn.",
    );

    const oldId = second.id;
    since = first.sequence;
    await closeClient(second);
    const remaining = await waitFor(
      first,
      (message) =>
        message.type === "state" &&
        !message.players.some((player) => player.id === oldId),
      { since },
    );
    assert.equal(remaining.players.length, 1);
    assert.equal(remaining.players[0].id, first.id);
    const rejoined = await joinClient(url, "Smoke B");
    assert.notEqual(rejoined.id, oldId);
    const fresh = await waitFor(
      rejoined,
      (message) =>
        message.type === "state" &&
        message.players.some((player) => player.id === rejoined.id),
    );
    assert.equal(fresh.players.length, 2);
    assert.equal(
      fresh.players.find((player) => player.id === rejoined.id).score,
      0,
    );
    for (const client of allClients) {
      for (const { message } of client.history) {
        if (message.type === "state") assert.equal(message.coins.length, 10);
      }
    }
    console.log(
      "LAN smoke passed: shared world, duplicate joins, movement, strategy pickup, 10 crowns, disconnect, and fresh rejoin.",
    );
  } finally {
    for (const client of allClients) client.socket.terminate();
    await stopServer(child);
  }
}

run().catch((error) => {
  console.error(`LAN smoke failed: ${error.stack || error.message}`);
  process.exitCode = 1;
});
